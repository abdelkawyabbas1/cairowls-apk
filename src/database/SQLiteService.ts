import { Capacitor } from '@capacitor/core'
import {
  CapacitorSQLite,
  SQLiteConnection,
  SQLiteDBConnection,
} from '@capacitor-community/sqlite'

export const DATABASE_NAME = 'premium_crm'

export interface TransactionalConnection {
  run(statement: string, values?: unknown[]): Promise<void>
  query<T = Record<string, unknown>>(statement: string, values?: unknown[]): Promise<T[]>
  execute(statements: string): Promise<void>
}

function toTransactionalConnection(db: SQLiteDBConnection): TransactionalConnection {
  return {
    async run(statement, values = []) {
      await db.run(statement, values, false)
    },
    async query<T>(statement: string, values: unknown[] = []) {
      const result = await db.query(statement, values)
      return (result.values ?? []) as T[]
    },
    async execute(statements) {
      await db.execute(statements, false)
    },
  }
}

/**
 * Thin, typed wrapper around @capacitor-community/sqlite.
 *
 * Responsibilities:
 * - Open a single named connection and hand it out to repositories.
 * - Run migrations exactly once per session, before anything else touches
 *   the database (see Migration.ts).
 * - Provide `run` / `query` / `transaction` helpers so repositories never
 *   talk to the plugin directly.
 * - Work in the browser too (via the jeep-sqlite web store) so `npm run dev`
 *   keeps working during development, not just the native iPad build.
 */
class SQLiteServiceClass {
  private sqlite: SQLiteConnection = new SQLiteConnection(CapacitorSQLite)
  private connection: SQLiteDBConnection | null = null
  private openPromise: Promise<SQLiteDBConnection> | null = null
  private webStoreReady = false
  private transactionTail: Promise<void> = Promise.resolve()

  private async ensureWebStore(): Promise<void> {
    if (this.webStoreReady) return
    if (Capacitor.getPlatform() !== 'web') {
      this.webStoreReady = true
      return
    }

    // jeep-sqlite backs the plugin with an in-browser wasm SQLite + IndexedDB
    // persistence layer so the exact same repository code runs in `npm run dev`.
    const jeepSqlite = document.createElement('jeep-sqlite')
    document.body.appendChild(jeepSqlite)
    await customElements.whenDefined('jeep-sqlite')
    await this.sqlite.initWebStore()
    this.webStoreReady = true
  }

  /** Opens (or returns the already-open) database connection. Idempotent. */
  async open(): Promise<SQLiteDBConnection> {
    if (this.connection) return this.connection
    if (this.openPromise) return this.openPromise

    const pending = (async () => {
      await this.ensureWebStore()

      const isConsistent = await this.sqlite.checkConnectionsConsistency()
      const alreadyOpen = (await this.sqlite.isConnection(DATABASE_NAME, false)).result

      const db = isConsistent.result && alreadyOpen
        ? await this.sqlite.retrieveConnection(DATABASE_NAME, false)
        : await this.sqlite.createConnection(DATABASE_NAME, false, 'no-encryption', 1, false)

      await db.open()
      // SQLite disables foreign-key enforcement per-connection by default,
      // so ON DELETE CASCADE (customers -> cards/notes/history) needs this
      // set every time a connection is opened, not just during migrations.
      await db.execute('PRAGMA foreign_keys = ON;', false)
      this.connection = db
      return db
    })()
    this.openPromise = pending
    try {
      return await pending
    } catch (error) {
      this.openPromise = null
      throw error
    }
  }

  /** Executes a single write statement (INSERT/UPDATE/DELETE/DDL). */
  async run(statement: string, values: unknown[] = []): Promise<void> {
    const db = await this.open()
    await db.run(statement, values)
  }

  /** Executes a read query and returns typed rows. */
  async query<T = Record<string, unknown>>(statement: string, values: unknown[] = []): Promise<T[]> {
    const db = await this.open()
    const result = await db.query(statement, values)
    return (result.values ?? []) as T[]
  }

  /**
   * Runs `work` inside a single SQLite transaction. All statements issued
   * through the provided connection either all commit or all roll back.
   */
  async transaction<T>(work: (db: TransactionalConnection) => Promise<T>): Promise<T> {
    let release!: () => void
    const previous = this.transactionTail
    this.transactionTail = new Promise<void>((resolve) => {
      release = resolve
    })

    await previous
    let began = false
    let db: SQLiteDBConnection | null = null
    try {
      db = await this.open()
      await db.beginTransaction()
      began = true
      const result = await work(toTransactionalConnection(db))
      await db.commitTransaction()
      return result
    } catch (error) {
      if (began && db) await db.rollbackTransaction().catch(() => undefined)
      throw error
    } finally {
      release()
    }
  }

  /** Flushes the in-memory database out to the native filesystem / IndexedDB store. */
  async saveToStore(): Promise<void> {
    if (Capacitor.getPlatform() !== 'web') return
    await this.sqlite.saveToStore(DATABASE_NAME)
  }

  /** Closes the connection. Used before exporting/restoring the raw database file. */
  async close(): Promise<void> {
    if (!this.connection) return
    await this.sqlite.closeConnection(DATABASE_NAME, false)
    this.connection = null
    this.openPromise = null
  }

  getRawConnection(): SQLiteConnection {
    return this.sqlite
  }
}

export const sqliteService = new SQLiteServiceClass()

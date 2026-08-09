import { sqliteService } from '@/database/SQLiteService'

export interface Migration {
  version: number
  description: string
  statements: string[]
}

/**
 * Ordered, additive migrations. Never edit a migration that has already
 * shipped — append a new one instead, and give it the next version number.
 * `runMigrations` applies every migration whose version is greater than the
 * database's current `user_version`, in order, inside one transaction.
 */
export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    description: 'Initial schema: customers, cards, notes, history, settings, backups',
    statements: [
      `PRAGMA foreign_keys = ON;`,

      `CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        company TEXT NOT NULL,
        phone TEXT NOT NULL,
        email TEXT NOT NULL DEFAULT '',
        address TEXT NOT NULL DEFAULT '',
        country TEXT NOT NULL DEFAULT '',
        job_titles_json TEXT NOT NULL DEFAULT '[]',
        other_job_title TEXT NOT NULL DEFAULT '',
        business_types_json TEXT NOT NULL DEFAULT '[]',
        products_json TEXT NOT NULL DEFAULT '[]',
        product_type TEXT NOT NULL DEFAULT 'complete',
        interest TEXT,
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );`,
      `CREATE INDEX IF NOT EXISTS customers_created_at_idx ON customers(created_at DESC);`,
      `CREATE INDEX IF NOT EXISTS customers_name_idx ON customers(name);`,
      `CREATE INDEX IF NOT EXISTS customers_company_idx ON customers(company);`,
      `CREATE INDEX IF NOT EXISTS customers_phone_idx ON customers(phone);`,

      `CREATE TABLE IF NOT EXISTS cards (
        id TEXT PRIMARY KEY NOT NULL,
        customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        image TEXT,
        created_at TEXT NOT NULL
      );`,
      `CREATE INDEX IF NOT EXISTS cards_customer_id_idx ON cards(customer_id);`,

      `CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY NOT NULL,
        customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
        body TEXT NOT NULL,
        created_at TEXT NOT NULL
      );`,
      `CREATE INDEX IF NOT EXISTS notes_customer_id_idx ON notes(customer_id);`,

      `CREATE TABLE IF NOT EXISTS history (
        id TEXT PRIMARY KEY NOT NULL,
        customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
        action TEXT NOT NULL,
        created_at TEXT NOT NULL
      );`,
      `CREATE INDEX IF NOT EXISTS history_customer_id_idx ON history(customer_id);`,
      `CREATE INDEX IF NOT EXISTS history_created_at_idx ON history(created_at DESC);`,

      `CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );`,

      `CREATE TABLE IF NOT EXISTS backups (
        id TEXT PRIMARY KEY NOT NULL,
        path TEXT NOT NULL,
        created_at TEXT NOT NULL
      );`,
    ],
  },
]

export async function runMigrations(): Promise<void> {
  await sqliteService.transaction(async (db) => {
    const versionRows = await db.query<{ user_version: number }>('PRAGMA user_version;')
    const currentVersion = Number(versionRows[0]?.user_version ?? 0)

    const pending = MIGRATIONS.filter((migration) => migration.version > currentVersion)
      .sort((a, b) => a.version - b.version)

    for (const migration of pending) {
      for (const statement of migration.statements) {
        await db.execute(statement)
      }
      await db.execute(`PRAGMA user_version = ${migration.version};`)
    }
  })

  await sqliteService.saveToStore()
}

import { sqliteService } from '@/database/SQLiteService'
import { runMigrations } from '@/database/Migration'

let initPromise: Promise<void> | null = null

/**
 * Single entry point for bringing the local database online. Safe to call
 * multiple times (e.g. from main.tsx and again from a repository) — the
 * work only happens once per app session.
 *
 * - Opens the native SQLite connection (or the web/jeep-sqlite fallback
 *   used by `npm run dev`).
 * - Creates the database file automatically on first run.
 * - Applies every pending migration in Migration.ts.
 */
export function initDatabase(): Promise<void> {
  if (!initPromise) {
    const pending = (async () => {
      await sqliteService.open()
      await runMigrations()
    })()
    initPromise = pending.catch((error) => {
      initPromise = null
      throw error
    })
  }
  return initPromise
}

export { sqliteService } from '@/database/SQLiteService'
export { DATABASE_NAME } from '@/database/SQLiteService'

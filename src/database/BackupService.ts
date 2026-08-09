import { Directory, Filesystem } from '@capacitor/filesystem'
import { Capacitor } from '@capacitor/core'
import { sqliteService } from '@/database/SQLiteService'

const BACKUP_FOLDER = 'backups'

function filenameDate(date = new Date()): string {
  return date.toISOString().slice(0, 10)
}

async function ensureBackupFolder(): Promise<void> {
  try {
    await Filesystem.mkdir({ path: BACKUP_FOLDER, directory: Directory.Data, recursive: true })
  } catch {
    // Already exists.
  }
}

/**
 * Exports the raw SQLite database file to Documents/backups on native, or
 * triggers a browser download when running on the web. Returns the path (or
 * filename, on web) that was written, so callers can record it in the
 * `backups` table.
 */
export async function exportDatabaseFile(): Promise<string> {
  // exportToJson lives on the individual SQLiteDBConnection instance
  // (the open, database-bound connection) — not on the SQLiteConnection
  // manager returned by sqliteService.getRawConnection().
  const db = await sqliteService.open()
  const exported = await db.exportToJson('full')
  const json = JSON.stringify(exported.export ?? {})
  const filename = `premium-crm-db-${filenameDate()}.json`

  if (Capacitor.getPlatform() === 'web') {
    downloadText(json, filename, 'application/json;charset=utf-8')
    return filename
  }

  await ensureBackupFolder()
  const path = `${BACKUP_FOLDER}/${filename}`
  await Filesystem.writeFile({ path, directory: Directory.Data, data: json, encoding: undefined })
  return path
}

/** Restores a database previously produced by exportDatabaseFile. */
export async function restoreDatabaseFile(jsonContents: string): Promise<void> {
  const parsed = JSON.parse(jsonContents)
  await sqliteService.close()
  await sqliteService.getRawConnection().importFromJson(JSON.stringify(parsed))
  await sqliteService.open()
}

function downloadText(text: string, filename: string, mimeType: string): void {
  const blob = new Blob([text], { type: mimeType })
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0)
}

/** Records a completed export/backup in the `backups` table. */
export async function recordBackup(path: string): Promise<void> {
  const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`

  await sqliteService.run(
    `INSERT INTO backups (id, path, created_at) VALUES (?, ?, ?)`,
    [id, path, new Date().toISOString()],
  )
}

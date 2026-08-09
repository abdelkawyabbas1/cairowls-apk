# Premium CRM (كايرو لايت CRM) — Native iPad Build

واجهة تسجيل العملاء محفوظة كما هي بالكامل — لم يتغيّر أي تصميم أو شاشة أو ميزة —
لكن طبقة البيانات أصبحت الآن **SQLite أصلي (native)** عبر Capacitor، بدل
IndexedDB، ليعمل التطبيق كتطبيق iPad حقيقي مثبّت من App Store أو TestFlight،
بلا اتصال إنترنت بالكامل.

## What changed vs. what didn't

- ✅ **Unchanged:** every screen, component, form, table, style, and feature in `src/App.tsx`.
- ✅ **Unchanged:** the public `CustomerRepository` contract (`src/repositories/CustomerRepository.ts`) — same method names, same arguments.
- 🔄 **Replaced:** the storage engine underneath that contract — IndexedDB → native SQLite (`@capacitor-community/sqlite`).
- 🔄 **Replaced:** business-card image storage — binary blobs in IndexedDB → real files on disk via `@capacitor/filesystem`, with only the file *path* stored in SQLite.
- ➕ **Added:** Capacitor shell (`@capacitor/core`, `@capacitor/cli`, `@capacitor/ios`, `@capacitor/app`, `@capacitor/filesystem`, `@capacitor/preferences`), a typed migration system, a `cards`/`notes`/`history`/`settings`/`backups` schema, and a GitHub Actions iOS build pipeline.

## Project structure (data layer)

```
src/database/
  SQLiteService.ts     # low-level connection wrapper (open/run/query/transaction)
  Migration.ts          # versioned schema migrations (customers, cards, notes, history, settings, backups)
  Database.ts            # initDatabase() — single entry point, safe to call many times
  CustomerRepository.ts  # SQLite implementation of the existing CustomerRepository interface
  CardRepository.ts      # typed CRUD helpers for the `cards` table
  BackupService.ts       # raw SQLite database export / import (JSON snapshot of the .db)
src/services/
  ImageStorageService.ts # Capacitor Filesystem wrapper for business-card images
  BackupService.ts        # JSON backup + real XLSX export for web and iOS
```

## How to install

Requires Node.js 20+, Xcode 15+, and CocoaPods (for the iOS half). Dependencies
and exact versions are recorded in `package-lock.json`; install them with:

```bash
npm install
```

## How to run (web / development)

Same as before — the SQLite layer works in the browser too, backed by an
in-browser wasm SQLite store (`jeep-sqlite`) so `npm run dev` still gives you
a fully working, persistent local database without Xcode:

```bash
npm run dev
```

## How to build

```bash
npm run build     # type-checks with tsc, then runs `vite build` → dist/
```

## How to sync Capacitor

Run this after every change to `dist/` (or just use the combined script):

```bash
npm run cap:sync   # = npm run build && npx cap sync ios
```

## How to build iOS

1. Add the iOS platform once (creates the `ios/` Xcode project — this step
   needs network access to fetch the native template, so it isn't included
   in this build):
   ```bash
   npm run cap:add:ios
   ```
2. Sync the latest web build into the native project:
   ```bash
   npm run cap:sync
   ```
3. Open in Xcode and run on a simulator or a signed device/TestFlight build:
   ```bash
   npm run cap:open:ios
   ```

`capacitor.config.ts` already sets the App Name (`Premium CRM`) and App ID
(`com.premium.crm`) used when the `ios/` project is generated.

CI does this automatically on every push — see `.github/workflows/ios.yml`,
which installs Node, runs `npm ci`, builds the Vite bundle, adds the iOS
platform if missing, runs `npx cap sync ios`, archives the project with
`xcodebuild`, and uploads the `.xcarchive` and web `dist/` as build artifacts.

## How SQLite works

- One local database, `premium_crm`, created automatically on first launch.
- Tables: `customers`, `cards`, `notes`, `history`, `settings`, `backups` — see `src/database/Migration.ts` for the full DDL. Foreign keys (`ON DELETE CASCADE`) keep a customer's cards/notes/history rows in sync automatically.
- All access goes through typed, async repositories (`CustomerRepository.ts`, `CardRepository.ts`) — no raw SQL outside `src/database/`.
- Every write to `customers` or `cards` runs inside a transaction (`sqliteService.transaction`), and a `history` row is logged on create/update.
- Business-card images are **not** stored as BLOBs — they're written to `Directory.Data/business-cards/` via `@capacitor/filesystem`, and the `cards.image` column stores only the relative path. The folder is recreated automatically if missing.
- Schema changes are additive migrations in `Migration.ts`, tracked with SQLite's `PRAGMA user_version` — never edit a shipped migration, append a new one.

## How backups work

The Settings screen keeps its existing two buttons, now backed by SQLite data:

- **نسخة احتياطية (Backup):** downloads a JSON file of every customer + their business-card image (base64), unchanged format (`downloadBackup` in `src/services/BackupService.ts`).
- **تصدير Excel:** creates a formatted `.xlsx` workbook. The web build downloads it directly; the iOS build opens the native share/save sheet through `@capacitor/share`.
- **استرجاع (Restore):** replaces all customers/cards in SQLite from a JSON backup file, unchanged UI flow.

Additionally, `src/database/BackupService.ts` adds two lower-level,
programmatic-only helpers (not wired into the UI, to avoid changing any
screen) for exporting/restoring the **raw SQLite database file** itself:

```ts
import { exportDatabaseFile, restoreDatabaseFile } from '@/database/BackupService'

const path = await exportDatabaseFile()   // full DB snapshot -> Documents/backups/*.json (native) or download (web)
await restoreDatabaseFile(jsonContents)   // replaces the entire local database
```

Never commit backups, exports, or customer data/images to GitHub — `.gitignore` already excludes `backups/`, `exports/`, and `*.db`/`*.sqlite*`.

## Included native project

The complete `ios/` Xcode workspace and CocoaPods configuration are included. Open `ios/App/App.xcworkspace` (not the `.xcodeproj`) to sign, run, archive, or upload the app.


## Android (Capacitor 7)

The project now includes an Android platform configured for **Capacitor 7.6.8** and Android 15 / API 35.
The existing React UI and repository APIs are unchanged. `@capacitor-community/sqlite` remains the native local database engine on Android.

Install/sync/open:

```bash
npm install
npm run cap:sync:android
npm run cap:open:android
```

Android Studio should use **JDK 21**. The generated Android project targets SDK 35, which is the supported target for Capacitor 7.

Native Android behavior covered by the existing app flow:

- Customer create/list/search/update/delete uses the same SQLite repository.
- Delete still requires the existing confirmation dialog.
- Business-card images are stored in `Directory.Data/business-cards/` and referenced from SQLite.
- JSON backup includes customer data plus card images as base64; restore recreates both rows and image files.
- Excel export uses ExcelJS to create a real `.xlsx` workbook.
- JSON/XLSX exports are written to the app cache and passed to the native Android share/save sheet through `@capacitor/share`.

After changing web code, always run `npm run cap:sync:android` before building the APK/AAB.

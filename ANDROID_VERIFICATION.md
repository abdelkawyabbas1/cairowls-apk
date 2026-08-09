# Android verification

## Source-level verification completed

- Capacitor Android dependency pinned to 7.6.8 (same Capacitor 7 line as core/CLI/iOS).
- Android platform project added with API 35 target/compile SDK and min SDK 23.
- Native SQLite plugin included in `android/capacitor.settings.gradle` and `android/app/build.gradle`.
- Existing CRUD flow continues to call `SQLiteCustomerRepository`.
- Delete remains guarded by the existing `window.confirm(...)`.
- Business-card images continue to use `@capacitor/filesystem` under `Directory.Data/business-cards`.
- JSON backup serializes all customers and card images; restore recreates files and database rows.
- Excel export uses ExcelJS `workbook.xlsx.writeBuffer()` and produces `.xlsx`.
- Native exports write to `Directory.Cache`, call `Filesystem.getUri()`, then invoke `Share.share()` so Android displays its share/save chooser.

## Device/emulator smoke test

Run after `npm install` and `npm run cap:sync:android`:

1. Create a customer with Arabic/English fields and a card image.
2. Search by name/company/mobile and reopen the saved customer.
3. Edit and verify persistence after app restart.
4. Delete a test customer and verify the confirmation prompt.
5. Open a saved customer and verify the business-card image renders.
6. Export JSON and save/share it from Android's system sheet.
7. Export XLSX and save/share it from Android's system sheet; open it in Excel/Sheets.
8. Restore the JSON and verify customer count, fields, and card images.

The current execution environment could not complete `npm ci` because its package proxy returned HTTP 404 for public npm tarballs, so an Android emulator/Gradle build could not be executed here. This is an environment dependency-fetch limitation, not a captured project build error.

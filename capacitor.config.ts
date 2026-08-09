import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Capacitor configuration for the native iPad build of Premium CRM.
 *
 * webDir points at the Vite production output (see vite.config.ts / package.json
 * "build" script). Run `npm run build` before `npx cap sync ios` so the native
 * shell always ships the latest web bundle.
 */
const config: CapacitorConfig = {
  appId: 'com.premium.crm',
  appName: 'Premium CRM',
  webDir: 'dist',
  android: {
    // Capacitor 7 targets Android 15 / API 35. HTTPS scheme keeps WebView
    // storage/origin behavior consistent with native plugin expectations.
    allowMixedContent: false,
  },
  server: {
    androidScheme: 'https',
  },
  ios: {
    contentInset: 'always',
    // iPad-only, portrait + landscape. Configured on the Xcode project after
    // `npx cap add ios` (see README → "Build iOS"), this flag just documents intent.
    limitsNavigationsToAppBoundDomains: true,
  },
  plugins: {
    CapacitorSQLite: {
      iosDatabaseLocation: 'Library/CapacitorDatabase',
      iosIsEncryption: false,
      iosBiometric: {
        biometricAuth: false,
      },
    },
    Preferences: {
      group: 'com.premium.crm.preferences',
    },
  },
}

export default config

import React from 'react'
import ReactDOM from 'react-dom/client'
import { App as CapacitorApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'
import { defineCustomElements } from 'jeep-sqlite/loader'
import App from './App'
import { initDatabase, sqliteService } from '@/database/Database'
import './index.css'

async function bootstrap(): Promise<void> {
  if (Capacitor.getPlatform() === 'web') {
    defineCustomElements(window)
  }
  await initDatabase()

  // First-run flag stored via @capacitor/preferences (outside the SQLite
  // database on purpose - cheap key/value storage that survives even if the
  // SQLite file is ever reset by a restore).
  const firstRun = await Preferences.get({ key: 'premium-crm-first-run-complete' })
  if (!firstRun.value) {
    await Preferences.set({ key: 'premium-crm-first-run-complete', value: 'true' })
  }

  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}

const root = ReactDOM.createRoot(document.getElementById('root')!)

void bootstrap().catch((error: unknown) => {
  console.error('Application startup failed', error)
  root.render(
    <div dir="rtl" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '24px', fontFamily: 'Cairo, sans-serif', background: '#F7F8FA' }}>
      <div style={{ maxWidth: '480px', padding: '28px', borderRadius: '20px', background: '#FFF', boxShadow: '0 10px 30px rgba(0,0,0,0.08)', textAlign: 'center' }}>
        <h1 style={{ marginTop: 0, fontSize: '22px' }}>تعذر تشغيل قاعدة البيانات</h1>
        <p style={{ color: '#667085', lineHeight: 1.8 }}>أغلق التطبيق وافتحه مرة أخرى. لن يتم حذف بيانات العملاء المحفوظة.</p>
        <button type="button" className="btn-primary" onClick={() => window.location.reload()}>إعادة المحاولة</button>
      </div>
    </div>,
  )
})

// The service worker is only registered in a production web build - never
// inside the native Capacitor iOS shell, which uses its own WKWebView cache.
if (import.meta.env.PROD && Capacitor.getPlatform() === 'web' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`)
  })
}

// Native iOS/Android may suspend the app and reclaim resources in the background. Reopening
// the SQLite connection on resume keeps the native plugin's connection table
// consistent instead of holding a stale handle.
if (Capacitor.isNativePlatform()) {
  CapacitorApp.addListener('appStateChange', ({ isActive }) => {
    if (isActive) {
      void sqliteService.open()
    }
  })
}

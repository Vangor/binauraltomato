import { Suspense, lazy } from 'react'

/** Load app content in a separate chunk so useAudio/Tone never run on first paint (avoids Electron crash). */
const AppContent = lazy(() => import('./AppContent'))

export default function App() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
          <div className="text-slate-400 text-sm">Loading…</div>
        </div>
      }
    >
      <AppContent />
    </Suspense>
  )
}

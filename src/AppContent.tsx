import { useState, useEffect, useCallback, useRef, useMemo, Suspense, lazy } from 'react'
import { Settings, Maximize2, Minimize2, ChevronDown, X, PanelRight, PanelRightClose } from 'lucide-react'
import { Timer } from './components/Timer'
import { Calendar } from './components/Calendar'
import { useTimer } from './hooks/useTimer'
import { useLocalStorage } from './hooks/useLocalStorage'
import { useAudio, getTone } from './hooks/useAudio'
import { PomodoroConfig, NoiseConfig, Session } from './types'
import { saveSession, updateSession } from './utils/sessionStorage'
import { requestNotificationPermission, showNotification } from './utils/notifications'
import { playChime } from './utils/sounds'
import { migrateNoiseConfig, BINAURAL_PRESETS, AMBIENT_PRESETS } from './AudioPanel'

const AudioPanel = lazy(() => import('./AudioPanel'))

const DEFAULT_CONFIG: PomodoroConfig = {
  workDuration: 25,
  shortBreakDuration: 5,
  longBreakDuration: 15,
  cyclesUntilLongBreak: 4,
}

const DEFAULT_NOISE_CONFIG: NoiseConfig = {
  enabled: false,
  binauralPreset: 'off',
  ambientPreset: 'off',
  binauralVolume: 0.5,
  ambientVolume: 0.5,
  fadeIn: true,
  fadeOut: true,
}

export default function AppContent() {
  const [config, setConfig] = useLocalStorage<PomodoroConfig>('pomodoro_config', DEFAULT_CONFIG)
  const [noiseConfig, setNoiseConfig] = useLocalStorage<NoiseConfig>('noise_config', DEFAULT_NOISE_CONFIG)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [settingsDropdownOpen, setSettingsDropdownOpen] = useState(false)
  const [pomodoroModalOpen, setPomodoroModalOpen] = useState(false)
  const [audioModalOpen, setAudioModalOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [audioStartError, setAudioStartError] = useState<string | null>(null)
  const [currentSession, setCurrentSession] = useState<Session | null>(null)
  const [currentBreakSession, setCurrentBreakSession] = useState<Session | null>(null)
  const timerRef = useRef<ReturnType<typeof useTimer> | null>(null)
  const configRef = useRef(config)
  const currentSessionRef = useRef(currentSession)
  const currentBreakSessionRef = useRef(currentBreakSession)
  const settingsDropdownRef = useRef<HTMLDivElement>(null)

  const effectiveNoiseConfig = useMemo(
    () => migrateNoiseConfig(noiseConfig as unknown as Record<string, unknown>),
    [noiseConfig]
  )
  const { ambientLoadError } = useAudio(effectiveNoiseConfig)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (settingsDropdownRef.current && !settingsDropdownRef.current.contains(e.target as Node)) {
        setSettingsDropdownOpen(false)
      }
    }
    if (settingsDropdownOpen) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [settingsDropdownOpen])

  useEffect(() => {
    configRef.current = config
  }, [config])

  useEffect(() => {
    currentSessionRef.current = currentSession
  }, [currentSession])

  useEffect(() => {
    currentBreakSessionRef.current = currentBreakSession
  }, [currentBreakSession])

  const handleTimerComplete = useCallback(() => {
    if (!timerRef.current) return

    const timer = timerRef.current
    const config = configRef.current
    const currentSession = currentSessionRef.current
    const currentBreakSession = currentBreakSessionRef.current
    const isWork = timer.isWorkSession
    const newCycle = isWork ? timer.currentCycle + 1 : timer.currentCycle

    if (currentSession && isWork) {
      const plannedSeconds = config.workDuration * 60
      const actualMinutes = Math.max(
        0,
        Math.round((plannedSeconds - timer.timeRemaining) / 60)
      )
      updateSession(currentSession.id, {
        cyclesCompleted: newCycle,
        totalMinutes: currentSession.totalMinutes + actualMinutes,
        endTime: new Date().toISOString(),
      })
    }

    if (currentBreakSession && !isWork) {
      const breakDuration =
        newCycle % config.cyclesUntilLongBreak === 0
          ? config.longBreakDuration
          : config.shortBreakDuration
      const plannedSeconds = breakDuration * 60
      const actualMinutes = Math.max(
        0,
        Math.round((plannedSeconds - timer.timeRemaining) / 60)
      )
      updateSession(currentBreakSession.id, {
        endTime: new Date().toISOString(),
        totalMinutes: actualMinutes,
      })
      setCurrentBreakSession(null)
    }

    if (isWork) {
      playChime()
      showNotification('Focus session complete!', {
        body: 'Start break when ready, or stop to end session',
        tag: 'pomodoro-complete',
      })

      const breakDuration = newCycle % config.cyclesUntilLongBreak === 0
        ? config.longBreakDuration
        : config.shortBreakDuration

      timer.setIsWorkSession(false)
      timer.setCurrentCycle(newCycle)
      timer.resetTimer(breakDuration)
      // Do not auto-start: wait for user to press Start (break) or Stop (end session)
    } else {
      playChime()
      showNotification('Break complete!', {
        body: 'Start focus when ready',
        tag: 'break-complete',
      })

      timer.setIsWorkSession(true)
      timer.resetTimer(config.workDuration)
      // Do not auto-start: wait for user to press Start (next focus) or Stop
    }
  }, [])

  const timer = useTimer({
    config,
    onComplete: handleTimerComplete,
  })

  timerRef.current = timer

  useEffect(() => {
    requestNotificationPermission()
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) {
        return
      }

      switch (e.key) {
        case ' ':
          e.preventDefault()
          if (timer.state === 'running') {
            timer.pause()
          } else {
            timer.start()
          }
          break
        case 's':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            timer.stop()
          }
          break
        case 'f':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            toggleFullscreen()
          }
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [timer])

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }, [])

  const handleStart = useCallback(() => {
    if (!currentSession && timer.isWorkSession) {
      const newSession: Session = {
        id: crypto.randomUUID(),
        date: new Date().toISOString().split('T')[0],
        startTime: new Date().toISOString(),
        cyclesCompleted: 0,
        totalMinutes: 0,
        type: 'work',
      }
      setCurrentSession(newSession)
      saveSession(newSession)
    }
    if (!currentBreakSession && !timer.isWorkSession) {
      const newBreakSession: Session = {
        id: crypto.randomUUID(),
        date: new Date().toISOString().split('T')[0],
        startTime: new Date().toISOString(),
        cyclesCompleted: 0,
        totalMinutes: 0,
        type: 'break',
      }
      setCurrentBreakSession(newBreakSession)
      saveSession(newBreakSession)
    }
    if (timer.isWorkSession) {
      setAudioStartError(null)
      getTone()
        .then((T) => {
          const start = T.start as (() => Promise<void>) | undefined
          if (typeof start === 'function') return start()
        })
        .then(() => setNoiseConfig((c) => ({ ...c, enabled: true })))
        .catch((e) => setAudioStartError(e instanceof Error ? e.message : String(e)))
    }
    timer.start()
  }, [timer, currentSession, currentBreakSession, setNoiseConfig])

  const handleStop = useCallback(() => {
    setNoiseConfig((c) => ({ ...c, enabled: false }))
    const t = timerRef.current
    if (currentSession && t?.isWorkSession) {
      const endTime = new Date().toISOString()
      const actualMinutes = Math.max(
        0,
        Math.round((config.workDuration * 60 - (t?.timeRemaining ?? 0)) / 60)
      )
      updateSession(currentSession.id, {
        endTime,
        totalMinutes: currentSession.totalMinutes + actualMinutes,
      })
      setCurrentSession(null)
    } else if (currentSession && !t?.isWorkSession) {
      setCurrentSession(null)
    }
    if (currentBreakSession) {
      const breakDuration =
        (t?.currentCycle ?? 0) % config.cyclesUntilLongBreak === 0
          ? config.longBreakDuration
          : config.shortBreakDuration
      const actualMinutes =
        t && !t.isWorkSession
          ? Math.max(
              0,
              Math.round(
                (breakDuration * 60 - (t?.timeRemaining ?? 0)) / 60
              )
            )
          : 0
      updateSession(currentBreakSession.id, {
        endTime: new Date().toISOString(),
        totalMinutes: actualMinutes,
      })
      setCurrentBreakSession(null)
    }
    timer.stop()
  }, [timer, currentSession, currentBreakSession, config, setNoiseConfig])

  const handleShuffle = useCallback(() => {
    const binauralOptions = BINAURAL_PRESETS.filter((p) => p !== 'off')
    const ambientOptions = AMBIENT_PRESETS.filter((p) => p !== 'off')
    const binauralPreset = binauralOptions[Math.floor(Math.random() * binauralOptions.length)]
    const ambientPreset = ambientOptions[Math.floor(Math.random() * ambientOptions.length)]
    setNoiseConfig((c) => ({ ...c, binauralPreset, ambientPreset, enabled: true }))
  }, [setNoiseConfig])

  const handleStopRef = useRef(handleStop)
  handleStopRef.current = handleStop

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.userAgent.toLowerCase().includes('electron')) {
      return
    }
    const onSessionEndSignal = () => {
      handleStopRef.current()
    }
    window.addEventListener('session-end-signal', onSessionEndSignal)
    return () => window.removeEventListener('session-end-signal', onSessionEndSignal)
  }, [])

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header
        className="border-b border-slate-800 p-4"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-end">
          <div
            className="flex items-center gap-2"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          >
            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
              aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            >
              {isFullscreen ? (
                <Minimize2 className="w-5 h-5" />
              ) : (
                <Maximize2 className="w-5 h-5" />
              )}
            </button>
            <div className="relative" ref={settingsDropdownRef}>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setSettingsDropdownOpen((o) => !o)
                }}
                className="p-2 rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-1"
                aria-label="Settings"
                aria-expanded={settingsDropdownOpen}
              >
                <Settings className="w-5 h-5" />
                <ChevronDown className="w-4 h-4" />
              </button>
              {settingsDropdownOpen && (
                <div className="absolute right-0 top-full mt-1 py-1 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-lg z-50">
                  <button
                    type="button"
                    className="w-full px-4 py-2 text-left text-sm hover:bg-slate-700 rounded-t-lg"
                    onClick={() => {
                      setPomodoroModalOpen(true)
                      setSettingsDropdownOpen(false)
                    }}
                  >
                    Pomodoro
                  </button>
                  <button
                    type="button"
                    className="w-full px-4 py-2 text-left text-sm hover:bg-slate-700 rounded-b-lg"
                    onClick={() => {
                      setAudioModalOpen(true)
                      setSettingsDropdownOpen(false)
                    }}
                  >
                    Audio
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={() => setSidebarOpen((o) => !o)}
              className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
              aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
            >
              {sidebarOpen ? (
                <PanelRightClose className="w-5 h-5" />
              ) : (
                <PanelRight className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row max-w-7xl mx-auto w-full min-h-0">
        <main className="flex-1 flex flex-col min-h-0 p-8 flex-basis-0">
          <div className="flex flex-col items-center justify-center py-8">
            <Timer
            timeRemaining={timer.timeRemaining}
            progress={timer.progress}
            state={timer.state}
            isWorkSession={timer.isWorkSession}
            sessionStartTime={timer.sessionStartTime}
            onStart={handleStart}
            onPause={timer.pause}
            onStop={handleStop}
            onSkip={timer.skip}
            onAdjustMinutes={(delta) => timer.adjustTime(delta * 60)}
            onShuffle={handleShuffle}
          />
          </div>
        </main>

        {sidebarOpen && (
          <aside className="w-full lg:w-96 border-t lg:border-t-0 lg:border-l border-slate-800 p-6 shrink-0 flex flex-col min-h-0 overflow-y-auto lg:self-stretch lg:min-h-full">
            <Calendar />
          </aside>
        )}
      </div>

      {pomodoroModalOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4"
          onClick={() => setPomodoroModalOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Pomodoro settings"
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-md shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium">Pomodoro</h2>
              <button
                type="button"
                onClick={() => setPomodoroModalOpen(false)}
                className="p-2 rounded-lg hover:bg-slate-800"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-2">
                  Work Duration: {config.workDuration} min
                </label>
                <input
                  type="range"
                  min="5"
                  max="60"
                  step="5"
                  value={config.workDuration}
                  onChange={(e) =>
                    setConfig({ ...config, workDuration: parseInt(e.target.value) })
                  }
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-2">
                  Short Break: {config.shortBreakDuration} min
                </label>
                <input
                  type="range"
                  min="1"
                  max="15"
                  step="1"
                  value={config.shortBreakDuration}
                  onChange={(e) =>
                    setConfig({ ...config, shortBreakDuration: parseInt(e.target.value) })
                  }
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-2">
                  Long Break: {config.longBreakDuration} min
                </label>
                <input
                  type="range"
                  min="5"
                  max="30"
                  step="5"
                  value={config.longBreakDuration}
                  onChange={(e) =>
                    setConfig({ ...config, longBreakDuration: parseInt(e.target.value) })
                  }
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-2">
                  Cycles until long break: {config.cyclesUntilLongBreak}
                </label>
                <input
                  type="range"
                  min="2"
                  max="8"
                  step="1"
                  value={config.cyclesUntilLongBreak}
                  onChange={(e) =>
                    setConfig({ ...config, cyclesUntilLongBreak: parseInt(e.target.value) })
                  }
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {audioModalOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4"
          onClick={() => setAudioModalOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Audio settings"
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium">Audio</h2>
              <button
                type="button"
                onClick={() => setAudioModalOpen(false)}
                className="p-2 rounded-lg hover:bg-slate-800"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <Suspense fallback={<div className="text-slate-400 text-sm">Loading audio…</div>}>
              <AudioPanel
                noiseConfig={noiseConfig}
                setNoiseConfig={setNoiseConfig}
                ambientLoadError={ambientLoadError}
                startError={audioStartError}
                onStartError={(err) => setAudioStartError(err == null ? null : err instanceof Error ? err.message : String(err))}
              />
            </Suspense>
          </div>
        </div>
      )}
    </div>
  )
}

import { useState, useEffect, useCallback, useRef } from 'react'
import { Settings, Maximize2, Minimize2, ChevronDown, ChevronRight } from 'lucide-react'
import { Timer } from './components/Timer'
import { Calendar } from './components/Calendar'
import { NoiseGenerator } from './components/NoiseGenerator'
import { useTimer } from './hooks/useTimer'
import { useAudio } from './hooks/useAudio'
import { useLocalStorage } from './hooks/useLocalStorage'
import { PomodoroConfig, NoiseConfig, BinauralPreset, AmbientPreset, Session } from './types'
import { saveSession, updateSession } from './utils/sessionStorage'

const BINAURAL_PRESETS: BinauralPreset[] = ['off', 'focus', 'study', 'work', 'relax', 'rest', 'energy', 'calm', 'block-noise']
const AMBIENT_PRESETS: AmbientPreset[] = ['off', 'cafe', 'coffee-shop', 'airport', 'rain', 'library']

function migrateNoiseConfig(stored: Record<string, unknown>): NoiseConfig {
  const base = { ...DEFAULT_NOISE_CONFIG, ...stored }
  const oldPreset = stored.preset as string | undefined

  let binauralPreset = base.binauralPreset ?? (BINAURAL_PRESETS.includes(oldPreset as BinauralPreset) ? oldPreset : 'off')
  let ambientPreset = base.ambientPreset ?? (AMBIENT_PRESETS.includes(oldPreset as AmbientPreset) ? oldPreset : 'off')

  if (oldPreset && !base.binauralPreset && !base.ambientPreset) {
    if (BINAURAL_PRESETS.includes(oldPreset as BinauralPreset)) binauralPreset = oldPreset as BinauralPreset
    else if (AMBIENT_PRESETS.includes(oldPreset as AmbientPreset)) ambientPreset = oldPreset as AmbientPreset
  }

  const volume = typeof stored.volume === 'number' ? stored.volume : 0.5
  return {
    ...base,
    binauralPreset: binauralPreset as BinauralPreset,
    ambientPreset: ambientPreset as AmbientPreset,
    binauralVolume: base.binauralVolume ?? volume,
    ambientVolume: base.ambientVolume ?? volume,
  }
}
import { requestNotificationPermission, showNotification } from './utils/notifications'
import { playChime } from './utils/sounds'

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

function App() {
  const [config, setConfig] = useLocalStorage<PomodoroConfig>('pomodoro_config', DEFAULT_CONFIG)
  const [noiseConfig, setNoiseConfig] = useLocalStorage<NoiseConfig>('noise_config', DEFAULT_NOISE_CONFIG)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [audioCollapsed, setAudioCollapsed] = useState(true)
  const [pomodoroCollapsed, setPomodoroCollapsed] = useState(true)
  const [currentSession, setCurrentSession] = useState<Session | null>(null)
  const timerRef = useRef<ReturnType<typeof useTimer> | null>(null)
  const configRef = useRef(config)
  const currentSessionRef = useRef(currentSession)

  useEffect(() => {
    configRef.current = config
  }, [config])

  useEffect(() => {
    currentSessionRef.current = currentSession
  }, [currentSession])

  const handleTimerComplete = useCallback(() => {
    if (!timerRef.current) return

    const timer = timerRef.current
    const config = configRef.current
    const currentSession = currentSessionRef.current
    const isWork = timer.isWorkSession
    const newCycle = isWork ? timer.currentCycle + 1 : timer.currentCycle

    if (currentSession && isWork) {
      updateSession(currentSession.id, {
        cyclesCompleted: newCycle,
        totalMinutes: currentSession.totalMinutes + config.workDuration,
      })
    }

    if (isWork) {
      playChime()
      showNotification('Focus session complete!', {
        body: 'Time for a break',
        tag: 'pomodoro-complete',
      })

      const breakDuration = newCycle % config.cyclesUntilLongBreak === 0
        ? config.longBreakDuration
        : config.shortBreakDuration

      timer.setIsWorkSession(false)
      timer.resetTimer(breakDuration)
      timer.setCurrentCycle(newCycle)
    } else {
      playChime()
      showNotification('Break complete!', {
        body: 'Ready to focus again?',
        tag: 'break-complete',
      })

      timer.setIsWorkSession(true)
      timer.resetTimer(config.workDuration)
    }

    timer.start()
  }, [])

  const timer = useTimer({
    config,
    onComplete: handleTimerComplete,
  })

  timerRef.current = timer

  const { ambientLoadError } = useAudio(migrateNoiseConfig(noiseConfig as unknown as Record<string, unknown>))

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
    timer.start()
  }, [timer, currentSession])

  const handleStop = useCallback(() => {
    if (currentSession) {
      updateSession(currentSession.id, {
        endTime: new Date().toISOString(),
      })
      setCurrentSession(null)
    }
    timer.stop()
  }, [timer, currentSession])

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="border-b border-slate-800 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-semibold">FocusForge</h1>
          <div className="flex items-center gap-2">
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
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
              aria-label="Toggle settings"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row max-w-7xl mx-auto w-full">
        <main className="flex-1 flex items-center justify-center p-8">
          <Timer
            timeRemaining={timer.timeRemaining}
            progress={timer.progress}
            state={timer.state}
            isWorkSession={timer.isWorkSession}
            onStart={handleStart}
            onPause={timer.pause}
            onStop={handleStop}
            onSkip={timer.skip}
          />
        </main>

        <aside
          className={`w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-slate-800 p-6 space-y-6 overflow-y-auto shrink-0 transition-[width,opacity] duration-200 ${
            showSettings ? 'block opacity-100' : 'hidden opacity-0'
          }`}
        >
          <section className="border-b border-slate-800 pb-6">
            <button
              type="button"
              onClick={() => setAudioCollapsed((c) => !c)}
              className="flex items-center gap-2 w-full text-left text-sm font-medium text-slate-300 hover:text-slate-200"
              aria-expanded={!audioCollapsed}
            >
              {audioCollapsed ? (
                <ChevronRight className="w-4 h-4 shrink-0" />
              ) : (
                <ChevronDown className="w-4 h-4 shrink-0" />
              )}
              Audio
            </button>
            {!audioCollapsed && (
              <div className="mt-4">
                <NoiseGenerator
                  config={migrateNoiseConfig(noiseConfig as unknown as Record<string, unknown>)}
                  ambientLoadError={ambientLoadError}
                  onToggle={() => setNoiseConfig({ ...noiseConfig, enabled: !noiseConfig.enabled })}
                  onBinauralPresetChange={(binauralPreset) => setNoiseConfig({ ...noiseConfig, binauralPreset })}
                  onAmbientPresetChange={(ambientPreset) => setNoiseConfig({ ...noiseConfig, ambientPreset })}
                  onBinauralVolumeChange={(binauralVolume) => setNoiseConfig({ ...noiseConfig, binauralVolume })}
                  onAmbientVolumeChange={(ambientVolume) => setNoiseConfig({ ...noiseConfig, ambientVolume })}
                />
              </div>
            )}
          </section>

          <section className="border-t border-slate-800 pt-6">
            <button
              type="button"
              onClick={() => setPomodoroCollapsed((c) => !c)}
              className="flex items-center gap-2 w-full text-left text-sm font-medium text-slate-300 hover:text-slate-200"
              aria-expanded={!pomodoroCollapsed}
            >
              {pomodoroCollapsed ? (
                <ChevronRight className="w-4 h-4 shrink-0" />
              ) : (
                <ChevronDown className="w-4 h-4 shrink-0" />
              )}
              Pomodoro Settings
            </button>
            {!pomodoroCollapsed && (
            <div className="mt-4 space-y-4">
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
            )}
          </section>

          <div className="border-t border-slate-800 pt-6">
            <Calendar />
          </div>
        </aside>
      </div>
    </div>
  )
}

export default App

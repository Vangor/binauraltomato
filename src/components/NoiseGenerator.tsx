import { useState } from 'react'
import { Play, Square, AlertCircle } from 'lucide-react'
import { NoiseConfig, BinauralPreset, AmbientPreset } from '../types'

interface NoiseGeneratorProps {
  config: NoiseConfig
  ambientLoadError?: AmbientPreset | null
  startError?: string | null
  onToggle: () => void
  onBeforeStart?: () => Promise<void>
  onStartError?: (err: unknown) => void
  onBinauralPresetChange: (preset: BinauralPreset) => void
  onAmbientPresetChange: (preset: AmbientPreset) => void
  onBinauralVolumeChange: (volume: number) => void
  onAmbientVolumeChange: (volume: number) => void
}

const BINAURAL_OPTIONS: { value: BinauralPreset; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'focus', label: 'Focus' },
  { value: 'study', label: 'Study' },
  { value: 'work', label: 'Work' },
  { value: 'relax', label: 'Relax' },
  { value: 'rest', label: 'Rest' },
  { value: 'energy', label: 'Energy' },
  { value: 'calm', label: 'Calm' },
  { value: 'block-noise', label: 'Block noise' },
]

const AMBIENT_OPTIONS: { value: AmbientPreset; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'cafe', label: 'Cafe' },
  { value: 'coffee-shop', label: 'Coffee shop' },
  { value: 'airport', label: 'Airport' },
  { value: 'rain', label: 'Rain' },
  { value: 'library', label: 'Library' },
]

export function NoiseGenerator({
  config,
  ambientLoadError = null,
  startError = null,
  onToggle,
  onBeforeStart,
  onStartError,
  onBinauralPresetChange,
  onAmbientPresetChange,
  onBinauralVolumeChange,
  onAmbientVolumeChange,
}: NoiseGeneratorProps) {
  const [starting, setStarting] = useState(false)

  const handleToggle = async () => {
    if (config.enabled) {
      onToggle()
      return
    }
    setStarting(true)
    try {
      await onBeforeStart?.()
      onToggle()
    } catch (err) {
      console.error('[audio] Start failed', err)
      onStartError?.(err)
    } finally {
      setStarting(false)
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-slate-300">Binaural &amp; Ambient</h3>

      {startError && (
        <div className="rounded-lg bg-red-900/30 border border-red-700/50 p-2 text-xs text-red-200">
          {startError}
        </div>
      )}

      <button
        type="button"
        onClick={handleToggle}
        disabled={starting}
        className={`w-full flex items-center justify-center gap-2 rounded-lg py-3 px-4 font-medium transition-colors ${
          config.enabled
            ? 'bg-red-600/80 hover:bg-red-600 text-white'
            : 'bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50'
        }`}
        aria-label={config.enabled ? 'Stop audio' : 'Start audio'}
      >
        {config.enabled ? (
          <>
            <Square className="w-5 h-5" aria-hidden />
            Stop
          </>
        ) : starting ? (
          'Starting…'
        ) : (
          <>
            <Play className="w-5 h-5" aria-hidden />
            Start
          </>
        )}
      </button>

      {config.enabled && (
        <div className="space-y-4 pl-2">
          <div>
            <label className="block text-xs text-slate-400 mb-2">Binaural / focus tones</label>
            <select
              value={config.binauralPreset}
              onChange={(e) => onBinauralPresetChange(e.target.value as BinauralPreset)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {BINAURAL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {config.binauralPreset !== 'off' && (
              <div className="mt-2">
                <label className="block text-xs text-slate-400 mb-1">
                  Binaural: {Math.round(config.binauralVolume * 100)}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={config.binauralVolume}
                  onChange={(e) => onBinauralVolumeChange(parseFloat(e.target.value))}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-2">Ambient (cafe, airport, etc.)</label>
            <select
              value={config.ambientPreset}
              onChange={(e) => onAmbientPresetChange(e.target.value as AmbientPreset)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {AMBIENT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {config.ambientPreset !== 'off' && (
              <div className="mt-2">
                <label className="block text-xs text-slate-400 mb-1">
                  Ambient: {Math.round(config.ambientVolume * 100)}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={config.ambientVolume}
                  onChange={(e) => onAmbientVolumeChange(parseFloat(e.target.value))}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>
            )}
            {ambientLoadError && ambientLoadError === config.ambientPreset && (
              <div className="mt-2 flex items-start gap-2 rounded-lg bg-amber-900/30 border border-amber-700/50 p-2 text-xs text-amber-200">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden />
                <span>
                  Couldn’t load bundled ambient sound (source:{' '}
                  <a href="https://github.com/remvze/moodist" target="_blank" rel="noopener noreferrer" className="underline">Moodist</a>
                  ). Try another preset or restart the app.
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

import { useState, useEffect } from 'react'
import { getTone, useAudio } from './hooks/useAudio'
import { NoiseGenerator } from './components/NoiseGenerator'
import { NoiseConfig, BinauralPreset, AmbientPreset } from './types'

const BINAURAL_PRESETS: BinauralPreset[] = ['off', 'focus', 'study', 'work', 'relax', 'rest', 'energy', 'calm', 'block-noise']
const AMBIENT_PRESETS: AmbientPreset[] = ['off', 'cafe', 'coffee-shop', 'airport', 'rain', 'library']

const DEFAULT_NOISE_CONFIG: NoiseConfig = {
  enabled: false,
  binauralPreset: 'off',
  ambientPreset: 'off',
  binauralVolume: 0.5,
  ambientVolume: 0.5,
  fadeIn: true,
  fadeOut: true,
}

function migrateNoiseConfig(stored: Record<string, unknown>): NoiseConfig {
  const safe =
    stored != null && typeof stored === 'object' && !Array.isArray(stored)
      ? stored
      : {}
  const base = { ...DEFAULT_NOISE_CONFIG, ...safe }
  const oldPreset = safe.preset as string | undefined
  let binauralPreset = base.binauralPreset ?? (BINAURAL_PRESETS.includes(oldPreset as BinauralPreset) ? oldPreset : 'off')
  let ambientPreset = base.ambientPreset ?? (AMBIENT_PRESETS.includes(oldPreset as AmbientPreset) ? oldPreset : 'off')
  if (oldPreset && !base.binauralPreset && !base.ambientPreset) {
    if (BINAURAL_PRESETS.includes(oldPreset as BinauralPreset)) binauralPreset = oldPreset as BinauralPreset
    else if (AMBIENT_PRESETS.includes(oldPreset as AmbientPreset)) ambientPreset = oldPreset as AmbientPreset
  }
  const volume = typeof safe.volume === 'number' ? safe.volume : 0.5
  return {
    ...base,
    binauralPreset: binauralPreset as BinauralPreset,
    ambientPreset: ambientPreset as AmbientPreset,
    binauralVolume: base.binauralVolume ?? volume,
    ambientVolume: base.ambientVolume ?? volume,
  }
}

interface AudioPanelProps {
  noiseConfig: NoiseConfig
  setNoiseConfig: (c: NoiseConfig | ((prev: NoiseConfig) => NoiseConfig)) => void
}

export default function AudioPanel({ noiseConfig, setNoiseConfig }: AudioPanelProps) {
  const config = migrateNoiseConfig(noiseConfig as unknown as Record<string, unknown>)
  const { ambientLoadError } = useAudio(config)
  const [startError, setStartError] = useState<string | null>(null)

  useEffect(() => {
    if (config.enabled) setStartError(null)
  }, [config.enabled])

  const onBeforeStart = async () => {
    const Tone = await getTone()
    const start = Tone.start as (() => Promise<void>) | undefined
    if (typeof start === 'function') await start()
  }

  return (
    <div className="mt-4">
      <NoiseGenerator
        config={config}
        ambientLoadError={ambientLoadError}
        startError={startError}
        onToggle={() => setNoiseConfig((c) => ({ ...c, enabled: !c.enabled }))}
        onBeforeStart={onBeforeStart}
        onStartError={(err) => setStartError(err instanceof Error ? err.message : String(err))}
        onBinauralPresetChange={(binauralPreset) => setNoiseConfig((c) => ({ ...c, binauralPreset }))}
        onAmbientPresetChange={(ambientPreset) => setNoiseConfig((c) => ({ ...c, ambientPreset }))}
        onBinauralVolumeChange={(binauralVolume) => setNoiseConfig((c) => ({ ...c, binauralVolume }))}
        onAmbientVolumeChange={(ambientVolume) => setNoiseConfig((c) => ({ ...c, ambientVolume }))}
      />
    </div>
  )
}

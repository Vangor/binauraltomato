import { useEffect, useRef, useCallback, useState } from 'react'
import * as Tone from 'tone'
import { NoiseConfig, BinauralPreset, AmbientPreset } from '../types'

const BINAURAL_BEAT_HZ: Partial<Record<BinauralPreset, number>> = {
  focus: 20,
  study: 10,
  work: 40,
  relax: 6,
  rest: 2,
  energy: 25,
  calm: 14,
}

const AMBIENT_PRESETS: AmbientPreset[] = ['cafe', 'airport', 'rain', 'library', 'coffee-shop']

/** Bundled ambient sounds (from Moodist, MIT/CC0). Resolve at runtime for correct base in dev vs Electron. */
function getAmbientUrl(preset: AmbientPreset): string {
  if (preset === 'off') return ''
  const base = typeof import.meta.env?.BASE_URL === 'string' ? import.meta.env.BASE_URL : './'
  const paths: Record<Exclude<AmbientPreset, 'off'>, string> = {
    cafe: 'sounds/places/cafe.mp3',
    'coffee-shop': 'sounds/places/restaurant.mp3',
    airport: 'sounds/places/airport.mp3',
    rain: 'sounds/rain/light-rain.mp3',
    library: 'sounds/places/library.mp3',
  }
  return base.replace(/\/?$/, '/') + paths[preset]
}

const CARRIER_HZ = 200

function linearToDb(linear: number): number {
  if (linear <= 0) return -100
  return 20 * Math.log10(linear)
}

export function useAudio(config: NoiseConfig) {
  const [ambientLoadError, setAmbientLoadError] = useState<AmbientPreset | null>(null)
  const noiseRef = useRef<Tone.Noise | null>(null)
  const playerRef = useRef<Tone.Player | null>(null)
  const leftOscRef = useRef<Tone.Oscillator | null>(null)
  const rightOscRef = useRef<Tone.Oscillator | null>(null)
  const mergeRef = useRef<Tone.Merge | null>(null)
  const binauralGainRef = useRef<Tone.Gain | null>(null)
  const ambientGainRef = useRef<Tone.Gain | null>(null)
  const binauralCancelledRef = useRef(false)
  const ambientCancelledRef = useRef(false)

  const disposeBinaural = useCallback(() => {
    try {
      noiseRef.current?.stop().dispose()
      noiseRef.current = null
    } catch (_e) {
      /* already disposed */
    }
    try {
      leftOscRef.current?.stop().dispose()
      leftOscRef.current = null
    } catch (_e) {
      /* already disposed */
    }
    try {
      rightOscRef.current?.stop().dispose()
      rightOscRef.current = null
    } catch (_e) {
      /* already disposed */
    }
    try {
      mergeRef.current?.dispose()
      mergeRef.current = null
    } catch (_e) {
      /* already disposed */
    }
    try {
      binauralGainRef.current?.dispose()
      binauralGainRef.current = null
    } catch (_e) {
      /* already disposed */
    }
  }, [])

  const disposeAmbient = useCallback(() => {
    try {
      playerRef.current?.stop().dispose()
      playerRef.current = null
    } catch (_e) {
      /* already disposed */
    }
    try {
      ambientGainRef.current?.dispose()
      ambientGainRef.current = null
    } catch (_e) {
      /* already disposed */
    }
  }, [])

  const disposeAll = useCallback(() => {
    disposeBinaural()
    disposeAmbient()
  }, [disposeBinaural, disposeAmbient])

  useEffect(() => () => disposeAll(), [disposeAll])

  // ---- Binaural layer: own effect so changing ambient doesn't touch it ----
  useEffect(() => {
    if (!config.enabled) {
      disposeBinaural()
      return
    }
    if (config.binauralPreset === 'off') {
      disposeBinaural()
      return
    }

    binauralCancelledRef.current = false
    const fadeInSec = config.fadeIn ? 1 : 0
    const fadeOutSec = config.fadeOut ? 1 : 0

    const startBinaural = async () => {
      await Tone.start()
      if (binauralCancelledRef.current) return
      disposeBinaural()

      const binauralGain = new Tone.Gain(config.binauralVolume)
      binauralGain.connect(Tone.Destination)

      if (config.binauralPreset === 'block-noise') {
        const noise = new Tone.Noise({
          type: 'white',
          fadeIn: fadeInSec,
          fadeOut: fadeOutSec,
        })
        noise.volume.value = linearToDb(1)
        noise.connect(binauralGain)
        noise.start()
        if (binauralCancelledRef.current) {
          try { noise.stop().dispose() } catch (_e) { /* already disposed */ }
          try { binauralGain.dispose() } catch (_e) { /* already disposed */ }
          return
        }
        binauralGainRef.current = binauralGain
        noiseRef.current = noise
      } else {
        const beatHz = BINAURAL_BEAT_HZ[config.binauralPreset]
        if (beatHz != null) {
          const leftFreq = CARRIER_HZ - beatHz / 2
          const rightFreq = CARRIER_HZ + beatHz / 2
          const merge = new Tone.Merge().connect(binauralGain)
          const leftOsc = new Tone.Oscillator({ frequency: leftFreq, type: 'sine' }).connect(merge, 0, 0)
          const rightOsc = new Tone.Oscillator({ frequency: rightFreq, type: 'sine' }).connect(merge, 0, 1)
          leftOsc.volume.value = linearToDb(0.5)
          rightOsc.volume.value = linearToDb(0.5)
          const when = Tone.now()
          leftOsc.start(when)
          rightOsc.start(when)
          if (binauralCancelledRef.current) {
            try { leftOsc.stop().dispose() } catch (_e) { /* already disposed */ }
            try { rightOsc.stop().dispose() } catch (_e) { /* already disposed */ }
            try { merge.dispose() } catch (_e) { /* already disposed */ }
            try { binauralGain.dispose() } catch (_e) { /* already disposed */ }
            return
          }
          binauralGainRef.current = binauralGain
          mergeRef.current = merge
          leftOscRef.current = leftOsc
          rightOscRef.current = rightOsc
        }
      }
    }

    startBinaural().catch(console.error)

    return () => {
      binauralCancelledRef.current = true
      if (config.fadeOut && binauralGainRef.current) {
        binauralGainRef.current.gain.linearRampTo(0.001, 1, Tone.now())
        setTimeout(disposeBinaural, 1100)
      } else {
        disposeBinaural()
      }
    }
  }, [
    config.enabled,
    config.binauralPreset,
    config.fadeIn,
    config.fadeOut,
    disposeBinaural,
  ])

  // ---- Ambient layer: own effect so changing binaural doesn't touch it ----
  useEffect(() => {
    if (!config.enabled) {
      setAmbientLoadError(null)
      disposeAmbient()
      return
    }
    if (config.ambientPreset === 'off') {
      setAmbientLoadError(null)
      disposeAmbient()
      return
    }
    if (!AMBIENT_PRESETS.includes(config.ambientPreset)) {
      disposeAmbient()
      return
    }

    ambientCancelledRef.current = false
    const fadeInSec = config.fadeIn ? 1 : 0
    const fadeOutSec = config.fadeOut ? 1 : 0

    setAmbientLoadError(null)

    const startAmbient = async () => {
      try {
        await Tone.start()
        if (ambientCancelledRef.current) return
        disposeAmbient()

        const ambientGain = new Tone.Gain(config.ambientVolume)
        ambientGain.connect(Tone.Destination)

        const url = getAmbientUrl(config.ambientPreset)
        const player = new Tone.Player()
        player.loop = true
        player.fadeIn = fadeInSec
        player.fadeOut = fadeOutSec
        player.volume.value = linearToDb(1)
        player.connect(ambientGain)
        ambientGainRef.current = ambientGain
        playerRef.current = player

        const tryLoad = (retry = false) => {
          player.load(url).then(() => {
            if (ambientCancelledRef.current) {
              try { player.dispose() } catch (_e) { /* already disposed */ }
              try { ambientGain.dispose() } catch (_e) { /* already disposed */ }
              return
            }
            setAmbientLoadError(null)
            if (playerRef.current === player && !player.disposed) {
              player.start()
            }
          }).catch(() => {
            if (ambientCancelledRef.current) return
            if (!retry) {
              setTimeout(() => tryLoad(true), 800)
            } else {
              setAmbientLoadError(config.ambientPreset)
            }
          })
        }
        tryLoad()
      } catch (err) {
        if (!ambientCancelledRef.current) {
          setAmbientLoadError(config.ambientPreset)
          disposeAmbient()
        }
      }
    }

    startAmbient().catch(() => {
      if (!ambientCancelledRef.current) {
        setAmbientLoadError(config.ambientPreset)
        disposeAmbient()
      }
    })

    return () => {
      ambientCancelledRef.current = true
      if (config.fadeOut && ambientGainRef.current) {
        ambientGainRef.current.gain.linearRampTo(0.001, 1, Tone.now())
        setTimeout(disposeAmbient, 1100)
      } else {
        disposeAmbient()
      }
    }
  }, [
    config.enabled,
    config.ambientPreset,
    config.fadeIn,
    config.fadeOut,
    disposeAmbient,
  ])

  // Volume updates (don't recreate nodes)
  useEffect(() => {
    if (binauralGainRef.current) {
      binauralGainRef.current.gain.value = config.binauralVolume
    }
    if (ambientGainRef.current) {
      ambientGainRef.current.gain.value = config.ambientVolume
    }
  }, [config.binauralVolume, config.ambientVolume])

  return { ambientLoadError }
}

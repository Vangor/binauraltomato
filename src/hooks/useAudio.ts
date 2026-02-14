import { useEffect, useRef, useCallback, useState } from 'react'
import { NoiseConfig, BinauralPreset, AmbientPreset } from '../types'

function isElectron(): boolean {
  return typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('electron')
}

/** In Electron we use raw Web Audio API + HTMLAudioElement to avoid Tone.js crashes. */
const electronContextRef = { current: null as AudioContext | null }

/** Lazy-loaded Tone.js: no static import so the module is never loaded at app startup (avoids Electron crash). */
const toneModuleRef = { current: null as Record<string, unknown> | null }

/** Call from a user gesture (e.g. click) before enabling audio so the context can start. */
export async function getTone(): Promise<Record<string, unknown>> {
  if (isElectron()) {
    if (!electronContextRef.current) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      electronContextRef.current = new Ctx()
    }
    await electronContextRef.current.resume()
    return {} as Record<string, unknown>
  }
  if (toneModuleRef.current) return toneModuleRef.current
  const Tone = (await import('tone')) as Record<string, unknown>
  toneModuleRef.current = Tone
  return Tone
}

const AUDIO_DEBUG = import.meta.env.DEV
function logAudio(msg: string, data?: Record<string, unknown>): void {
  if (AUDIO_DEBUG) {
    const payload = data ? ` ${JSON.stringify(data)}` : ''
    console.log(`[audio] ${msg}${payload}`)
  }
}

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

const AMBIENT_PATHS: Record<Exclude<AmbientPreset, 'off'>, string> = {
  cafe: 'sounds/places/cafe.mp3',
  'coffee-shop': 'sounds/places/restaurant.mp3',
  airport: 'sounds/places/airport.mp3',
  rain: 'sounds/rain/light-rain.mp3',
  library: 'sounds/places/library.mp3',
}

/** Bundled ambient sounds (from Moodist, MIT/CC0). Resolve at runtime for correct base in dev vs Electron. */
function getAmbientUrl(preset: AmbientPreset): string {
  if (preset === 'off') return ''
  if (isElectron() && typeof window !== 'undefined') {
    return window.location.origin + '/' + AMBIENT_PATHS[preset]
  }
  const base = typeof import.meta.env?.BASE_URL === 'string' ? import.meta.env.BASE_URL : './'
  return base.replace(/\/?$/, '/') + AMBIENT_PATHS[preset]
}

const CARRIER_HZ = 200

function linearToDb(linear: number): number {
  if (linear <= 0) return -100
  return 20 * Math.log10(linear)
}

/** Minimal type for Tone nodes so we never need to import 'tone' at load time. */
interface ToneNodeLike {
  stop?(): void
  dispose?(): void
  gain?: { value: number; linearRampTo(a: number, b: number, c: number): void }
}

export function useAudio(config: NoiseConfig) {
  const [ambientLoadError, setAmbientLoadError] = useState<AmbientPreset | null>(null)
  const noiseRef = useRef<ToneNodeLike | null>(null)
  const playerRef = useRef<ToneNodeLike | null>(null)
  const leftOscRef = useRef<ToneNodeLike | null>(null)
  const rightOscRef = useRef<ToneNodeLike | null>(null)
  const mergeRef = useRef<ToneNodeLike | null>(null)
  const binauralGainRef = useRef<ToneNodeLike | null>(null)
  const ambientGainRef = useRef<ToneNodeLike | null>(null)
  const binauralCancelledRef = useRef(false)
  const ambientCancelledRef = useRef(false)
  // Electron-only: raw Web Audio API refs (no Tone)
  const nativeLeftOscRef = useRef<OscillatorNode | null>(null)
  const nativeRightOscRef = useRef<OscillatorNode | null>(null)
  const nativeNoiseRef = useRef<AudioBufferSourceNode | null>(null)
  const nativeBinauralGainRef = useRef<GainNode | null>(null)
  const nativeAmbientAudioRef = useRef<HTMLAudioElement | null>(null)
  const nativeAmbientBlobUrlRef = useRef<string | null>(null)

  const disposeNativeBinaural = useCallback(() => {
    try {
      nativeLeftOscRef.current?.stop()
      nativeLeftOscRef.current = null
    } catch (_e) { /* ignore */ }
    try {
      nativeRightOscRef.current?.stop()
      nativeRightOscRef.current = null
    } catch (_e) { /* ignore */ }
    try {
      nativeNoiseRef.current?.stop()
      nativeNoiseRef.current = null
    } catch (_e) { /* ignore */ }
    try {
      nativeBinauralGainRef.current?.disconnect()
      nativeBinauralGainRef.current = null
    } catch (_e) { /* ignore */ }
  }, [])

  const disposeBinaural = useCallback(() => {
    if (isElectron()) {
      disposeNativeBinaural()
      return
    }
    try {
      const n = noiseRef.current
      if (n) {
        n.stop?.()
        n.dispose?.()
      }
      noiseRef.current = null
    } catch (_e) {
      /* already disposed */
    }
    try {
      const l = leftOscRef.current
      if (l) {
        l.stop?.()
        l.dispose?.()
      }
      leftOscRef.current = null
    } catch (_e) {
      /* already disposed */
    }
    try {
      const r = rightOscRef.current
      if (r) {
        r.stop?.()
        r.dispose?.()
      }
      rightOscRef.current = null
    } catch (_e) {
      /* already disposed */
    }
    try {
      mergeRef.current?.dispose?.()
      mergeRef.current = null
    } catch (_e) {
      /* already disposed */
    }
    try {
      binauralGainRef.current?.dispose?.()
      binauralGainRef.current = null
    } catch (_e) {
      /* already disposed */
    }
  }, [])

  /** Dispose only the given nodes (does not clear refs). Use when replacing so old sound keeps playing until new is ready. */
  const disposeBinauralNodes = useCallback((prev: {
    noise: ToneNodeLike | null
    left: ToneNodeLike | null
    right: ToneNodeLike | null
    merge: ToneNodeLike | null
    gain: ToneNodeLike | null
  }) => {
      try {
        const n = prev.noise
        if (n) {
          n.stop?.()
          n.dispose?.()
        }
      } catch (_e) {
        /* already disposed */
      }
      try {
        const l = prev.left
        if (l) {
          l.stop?.()
          l.dispose?.()
        }
      } catch (_e) {
        /* already disposed */
      }
      try {
        const r = prev.right
        if (r) {
          r.stop?.()
          r.dispose?.()
        }
      } catch (_e) {
        /* already disposed */
      }
      try {
        prev.merge?.dispose?.()
      } catch (_e) {
        /* already disposed */
      }
      try {
        prev.gain?.dispose?.()
      } catch (_e) {
        /* already disposed */
      }
    },
    []
  )

  const disposeAmbient = useCallback(() => {
    try {
      const p = playerRef.current
      if (p) {
        p.stop?.()
        p.dispose?.()
      }
      playerRef.current = null
    } catch (_e) {
      /* already disposed */
    }
    try {
      ambientGainRef.current?.dispose?.()
      ambientGainRef.current = null
    } catch (_e) {
      /* already disposed */
    }
    try {
      const a = nativeAmbientAudioRef.current
      if (a) {
        a.pause()
        a.src = ''
      }
      nativeAmbientAudioRef.current = null
    } catch (_e) {
      /* ignore */
    }
  }, [])

  const disposeAll = useCallback(() => {
    if (isElectron()) {
      disposeNativeBinaural()
    } else {
      disposeBinaural()
    }
    disposeAmbient()
  }, [disposeBinaural, disposeAmbient, disposeNativeBinaural])

  useEffect(() => () => disposeAll(), [disposeAll])

  // ---- Binaural layer: own effect so changing ambient doesn't touch it ----
  useEffect(() => {
    logAudio('binaural effect run', {
      enabled: config.enabled,
      preset: config.binauralPreset,
      electron: isElectron(),
    })
    if (!config.enabled) {
      logAudio('binaural: disabled, disposing')
      disposeBinaural()
      return
    }
    if (config.binauralPreset === 'off') {
      logAudio('binaural: preset off, disposing')
      disposeBinaural()
      return
    }

    if (isElectron()) {
      const ctx = electronContextRef.current
      if (!ctx) {
        logAudio('binaural: Electron context not ready, skipping')
        return
      }
      const runNativeBinaural = () => {
        try {
          disposeNativeBinaural()
          const beatHz = BINAURAL_BEAT_HZ[config.binauralPreset]
          if (beatHz == null && config.binauralPreset !== 'block-noise') return
          const gain = ctx.createGain()
          gain.gain.value = config.binauralVolume
          gain.connect(ctx.destination)
          nativeBinauralGainRef.current = gain
          if (config.binauralPreset === 'block-noise') {
            const bufSize = 2 * ctx.sampleRate
            const buffer = ctx.createBuffer(1, bufSize, ctx.sampleRate)
            const data = buffer.getChannelData(0)
            for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1
            const noise = ctx.createBufferSource()
            noise.buffer = buffer
            noise.loop = true
            noise.connect(gain)
            noise.start(0)
            nativeNoiseRef.current = noise
          } else {
            const leftFreq = CARRIER_HZ - beatHz! / 2
            const rightFreq = CARRIER_HZ + beatHz! / 2
            const left = ctx.createOscillator()
            const right = ctx.createOscillator()
            left.frequency.value = leftFreq
            right.frequency.value = rightFreq
            left.type = 'sine'
            right.type = 'sine'
            const merger = ctx.createChannelMerger(2)
            merger.connect(gain)
            left.connect(merger, 0, 0)
            right.connect(merger, 0, 1)
            left.start(0)
            right.start(0)
            nativeLeftOscRef.current = left
            nativeRightOscRef.current = right
          }
          logAudio('binaural: started (native)', { preset: config.binauralPreset })
        } catch (err) {
          console.error('[audio] binaural native start failed', err)
        }
      }
      if (ctx.state === 'suspended') {
        ctx.resume().then(() => runNativeBinaural()).catch((err: unknown) => console.error('[audio] context resume failed', err))
      } else {
        runNativeBinaural()
      }
      return () => {
        disposeNativeBinaural()
      }
    }

    binauralCancelledRef.current = false
    const fadeInSec = config.fadeIn ? 1 : 0
    const fadeOutSec = config.fadeOut ? 1 : 0

    const startBinaural = async () => {
      type ToneOsc = { volume: { value: number }; connect: (n: unknown, a?: number, b?: number) => ToneOsc; start: (t: number) => void; stop: () => void; dispose: () => void }
      type ToneMerge = { connect: (n: unknown) => ToneMerge; dispose: () => void }
      const Tone = (await getTone()) as {
        start: () => Promise<void>
        Destination: unknown
        Gain: new (v: number) => { connect: (d: unknown) => void; dispose: () => void; gain: { value: number; linearRampTo: (a: number, b: number, c: number) => void } }
        Noise: new (o: unknown) => { volume: { value: number }; connect: (n: unknown) => void; start: () => void; stop: () => void; dispose: () => void }
        Merge: new () => ToneMerge
        Oscillator: new (o: unknown) => ToneOsc
        now: () => number
      }
      await Tone.start()
      if (binauralCancelledRef.current) {
        logAudio('binaural: cancelled after Tone.start(), skipping')
        return
      }
      const prev = {
        noise: noiseRef.current,
        left: leftOscRef.current,
        right: rightOscRef.current,
        merge: mergeRef.current,
        gain: binauralGainRef.current,
      }

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
          logAudio('binaural: cancelled after block-noise create, skipping')
          try { noise.stop(); noise.dispose() } catch (_e) { /* already disposed */ }
          try { binauralGain.dispose() } catch (_e) { /* already disposed */ }
          disposeBinauralNodes(prev)
          return
        }
        binauralGainRef.current = binauralGain
        noiseRef.current = noise
        disposeBinauralNodes(prev)
        logAudio('binaural: started', { preset: 'block-noise' })
      } else {
        const beatHz = BINAURAL_BEAT_HZ[config.binauralPreset]
        if (beatHz != null) {
          const leftFreq = CARRIER_HZ - beatHz / 2
          const rightFreq = CARRIER_HZ + beatHz / 2
          const merge: ToneMerge = new Tone.Merge().connect(binauralGain)
          const leftOsc: ToneOsc = new Tone.Oscillator({ frequency: leftFreq, type: 'sine' }).connect(merge, 0, 0)
          const rightOsc: ToneOsc = new Tone.Oscillator({ frequency: rightFreq, type: 'sine' }).connect(merge, 0, 1)
          leftOsc.volume.value = linearToDb(0.5)
          rightOsc.volume.value = linearToDb(0.5)
          const when = Tone.now()
          leftOsc.start(when)
          rightOsc.start(when)
          if (binauralCancelledRef.current) {
            logAudio('binaural: cancelled after beat create, skipping')
            try { leftOsc.stop(); leftOsc.dispose() } catch (_e) { /* already disposed */ }
            try { rightOsc.stop(); rightOsc.dispose() } catch (_e) { /* already disposed */ }
            try { merge.dispose() } catch (_e) { /* already disposed */ }
            try { binauralGain.dispose() } catch (_e) { /* already disposed */ }
            disposeBinauralNodes(prev)
            return
          }
          binauralGainRef.current = binauralGain
          mergeRef.current = merge
          leftOscRef.current = leftOsc
          rightOscRef.current = rightOsc
          disposeBinauralNodes(prev)
          logAudio('binaural: started', { preset: config.binauralPreset, beatHz })
        }
      }
    }

    startBinaural().catch((err: unknown) => {
      logAudio('binaural: startBinaural rejected', { err: String(err) })
      console.error(err)
    })

    return () => {
      logAudio('binaural: cleanup (defer dispose)', { preset: config.binauralPreset })
      binauralCancelledRef.current = true
      const prev = {
        noise: noiseRef.current,
        left: leftOscRef.current,
        right: rightOscRef.current,
        merge: mergeRef.current,
        gain: binauralGainRef.current,
      }
      noiseRef.current = null
      leftOscRef.current = null
      rightOscRef.current = null
      mergeRef.current = null
      binauralGainRef.current = null
      if (config.fadeOut && prev.gain && toneModuleRef.current) {
        try {
          prev.gain.gain?.linearRampTo(0.001, 1, (toneModuleRef.current as { now: () => number }).now())
        } catch (_e) {
          /* already disposed */
        }
        setTimeout(() => disposeBinauralNodes(prev), 1100)
      } else {
        setTimeout(() => disposeBinauralNodes(prev), 0)
      }
    }
  }, [
    config.enabled,
    config.binauralPreset,
    config.fadeIn,
    config.fadeOut,
    disposeBinaural,
    disposeBinauralNodes,
  ])

  // ---- Ambient layer: own effect so changing binaural doesn't touch it ----
  useEffect(() => {
    logAudio('ambient effect run', {
      enabled: config.enabled,
      preset: config.ambientPreset,
      electron: isElectron(),
    })
    if (!config.enabled) {
      logAudio('ambient: disabled, disposing')
      setAmbientLoadError(null)
      disposeAmbient()
      return
    }
    if (config.ambientPreset === 'off') {
      logAudio('ambient: preset off, disposing')
      setAmbientLoadError(null)
      disposeAmbient()
      return
    }
    if (!AMBIENT_PRESETS.includes(config.ambientPreset)) {
      logAudio('ambient: invalid preset, disposing', { preset: config.ambientPreset })
      disposeAmbient()
      return
    }

    if (isElectron()) {
      setAmbientLoadError(null)
      nativeAmbientBlobUrlRef.current = null
      const url = getAmbientUrl(config.ambientPreset)
      fetch(url)
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          return res.blob()
        })
        .then((blob) => {
          const blobUrl = URL.createObjectURL(blob)
          nativeAmbientBlobUrlRef.current = blobUrl
          const audio = new Audio(blobUrl)
          audio.loop = true
          audio.volume = config.ambientVolume
          nativeAmbientAudioRef.current = audio
          return audio.play()
        })
        .then(() => logAudio('ambient: started (native blob)', { preset: config.ambientPreset }))
        .catch((err: unknown) => {
          console.error('[audio] ambient native load/play failed', url, err)
          setAmbientLoadError(config.ambientPreset)
        })
      return () => {
        const a = nativeAmbientAudioRef.current
        if (a) {
          try {
            a.pause()
            a.src = ''
          } catch (_e) { /* ignore */ }
          nativeAmbientAudioRef.current = null
        }
        const blobUrl = nativeAmbientBlobUrlRef.current
        if (blobUrl) {
          try {
            URL.revokeObjectURL(blobUrl)
          } catch (_e) { /* ignore */ }
          nativeAmbientBlobUrlRef.current = null
        }
      }
    }

    ambientCancelledRef.current = false
    const fadeInSec = config.fadeIn ? 1 : 0
    const fadeOutSec = config.fadeOut ? 1 : 0

    setAmbientLoadError(null)

    const startAmbient = async () => {
      try {
        const Tone = (await getTone()) as {
          start: () => Promise<void>
          Destination: unknown
          Gain: new (v: number) => { connect: (d: unknown) => void; dispose: () => void; gain: { value: number; linearRampTo: (a: number, b: number, c: number) => void } }
          Player: new () => { loop: boolean; fadeIn: number; fadeOut: number; volume: { value: number }; connect: (n: unknown) => void; load: (u: string) => Promise<void>; start: () => void; dispose: () => void; disposed: boolean }
        }
        await Tone.start()
        if (ambientCancelledRef.current) {
          logAudio('ambient: cancelled after Tone.start(), skipping')
          return
        }
        const prevPlayer = playerRef.current
        const prevGain = ambientGainRef.current

        const ambientGain = new Tone.Gain(config.ambientVolume)
        ambientGain.connect(Tone.Destination)

        const url = getAmbientUrl(config.ambientPreset)
        logAudio('ambient: created player, loading url (previous stays until ready)', {
          preset: config.ambientPreset,
          url,
        })
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
            try {
              const cancelled = ambientCancelledRef.current
              const refMatch = playerRef.current === player
              const notDisposed = !player.disposed
              const willStart = !cancelled && refMatch && notDisposed
              logAudio('ambient: load completed', {
                preset: config.ambientPreset,
                cancelled,
                refMatch,
                notDisposed,
                willStart,
              })
              if (cancelled) {
                try { player.dispose() } catch (_e) { /* already disposed */ }
                try { ambientGain.dispose() } catch (_e) { /* already disposed */ }
                try {
                  prevPlayer?.stop?.()
                  prevPlayer?.dispose?.()
                } catch (_e) { /* already disposed */ }
                try { prevGain?.dispose?.() } catch (_e) { /* already disposed */ }
                return
              }
              try {
                prevPlayer?.stop?.()
                prevPlayer?.dispose?.()
              } catch (_e) {
                /* already disposed */
              }
              try {
                prevGain?.dispose?.()
              } catch (_e) {
                /* already disposed */
              }
              setAmbientLoadError(null)
              if (refMatch && notDisposed) {
                player.loop = true
                player.start()
                logAudio('ambient: started (looping)', { preset: config.ambientPreset })
              } else {
                logAudio('ambient: not starting (ref mismatch or disposed)', {
                  refMatch,
                  notDisposed,
                })
                try { player.dispose() } catch (_e) { /* already disposed */ }
                try { ambientGain.dispose() } catch (_e) { /* already disposed */ }
              }
            } catch (err: unknown) {
              console.error('[audio] ambient: error after load (start/dispose)', err)
              logAudio('ambient: error after load', {
                preset: config.ambientPreset,
                err: String(err),
              })
              if (!ambientCancelledRef.current) {
                setAmbientLoadError(config.ambientPreset)
                try { player.dispose() } catch (_e) { /* already disposed */ }
                try { ambientGain.dispose() } catch (_e) { /* already disposed */ }
              }
            }
          }).catch((err: unknown) => {
            console.error('[audio] ambient: load failed', config.ambientPreset, err)
            logAudio('ambient: load failed', {
              preset: config.ambientPreset,
              retry,
              err: String(err),
            })
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
        console.error('[audio] ambient: startAmbient threw', config.ambientPreset, err)
        logAudio('ambient: startAmbient threw', { preset: config.ambientPreset, err: String(err) })
        if (!ambientCancelledRef.current) {
          setAmbientLoadError(config.ambientPreset)
          disposeAmbient()
        }
      }
    }

    startAmbient().catch((err: unknown) => {
      console.error('[audio] ambient: startAmbient promise rejected', config.ambientPreset, err)
      logAudio('ambient: startAmbient promise rejected', { preset: config.ambientPreset, err: String(err) })
      if (!ambientCancelledRef.current) {
        setAmbientLoadError(config.ambientPreset)
        disposeAmbient()
      }
    })

    return () => {
      logAudio('ambient: cleanup (defer dispose)', { preset: config.ambientPreset })
      ambientCancelledRef.current = true
      const prevPlayer = playerRef.current
      const prevGain = ambientGainRef.current
      playerRef.current = null
      ambientGainRef.current = null
      const disposeCaptured = () => {
        try {
          if (prevPlayer) {
            prevPlayer.stop?.()
            prevPlayer.dispose?.()
          }
        } catch (_e) {
          /* already disposed */
        }
        try {
          prevGain?.dispose?.()
        } catch (_e) {
          /* already disposed */
        }
      }
      if (config.fadeOut && prevGain && toneModuleRef.current) {
        try {
          prevGain.gain?.linearRampTo(0.001, 1, (toneModuleRef.current as { now: () => number }).now())
        } catch (_e) {
          /* already disposed */
        }
        setTimeout(disposeCaptured, 1100)
      } else {
        setTimeout(disposeCaptured, 0)
      }
    }
  }, [
    config.enabled,
    config.ambientPreset,
    config.fadeIn,
    config.fadeOut,
  ])

  // Volume updates (don't recreate nodes)
  useEffect(() => {
    if (isElectron()) {
      if (nativeBinauralGainRef.current) {
        nativeBinauralGainRef.current.gain.value = config.binauralVolume
      }
      if (nativeAmbientAudioRef.current) {
        nativeAmbientAudioRef.current.volume = config.ambientVolume
      }
    } else {
      if (binauralGainRef.current?.gain != null) {
        binauralGainRef.current.gain.value = config.binauralVolume
      }
      if (ambientGainRef.current?.gain != null) {
        ambientGainRef.current.gain.value = config.ambientVolume
      }
    }
  }, [config.binauralVolume, config.ambientVolume])

  return { ambientLoadError }
}

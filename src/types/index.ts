export interface PomodoroConfig {
  workDuration: number // in minutes
  shortBreakDuration: number // in minutes
  longBreakDuration: number // in minutes
  cyclesUntilLongBreak: number
}

export interface Session {
  id: string
  date: string // ISO date string
  startTime: string // ISO datetime string
  endTime?: string // ISO datetime string
  cyclesCompleted: number
  totalMinutes: number
  type: 'work' | 'break'
}

export type TimerState = 'idle' | 'running' | 'paused' | 'completed'

export type BinauralPreset =
  | 'off'
  | 'focus'
  | 'study'
  | 'work'
  | 'relax'
  | 'rest'
  | 'energy'
  | 'calm'
  | 'block-noise'

export type AmbientPreset =
  | 'off'
  | 'cafe'
  | 'coffee-shop'
  | 'airport'
  | 'rain'
  | 'library'

export interface NoiseConfig {
  enabled: boolean
  binauralPreset: BinauralPreset
  ambientPreset: AmbientPreset
  binauralVolume: number // 0-1
  ambientVolume: number // 0-1
  fadeIn: boolean
  fadeOut: boolean
}

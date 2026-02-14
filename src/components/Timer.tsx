import { Play, Pause, Square, SkipForward, Shuffle } from 'lucide-react'
import { formatTime } from '../utils/formatTime'
import { TimerState } from '../types'

interface TimerProps {
  timeRemaining: number
  progress: number
  state: TimerState
  isWorkSession: boolean
  onStart: () => void
  onPause: () => void
  onStop: () => void
  onSkip: () => void
  onAdjustMinutes?: (delta: number) => void
  onShuffle?: () => void
}

export function Timer({
  timeRemaining,
  progress,
  state,
  isWorkSession,
  onStart,
  onPause,
  onStop,
  onSkip,
  onAdjustMinutes,
  onShuffle,
}: TimerProps) {
  const circumference = 2 * Math.PI * 90
  const offset = circumference * (1 - progress)

  return (
    <div className="flex flex-col items-center justify-center gap-8">
      <div className="flex items-center gap-3">
        {onAdjustMinutes && (
          <button
            type="button"
            onClick={() => onAdjustMinutes(-5)}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium tabular-nums"
            aria-label="Decrease time by 5 minutes"
          >
            −5
          </button>
        )}
        <div className="relative w-64 h-64">
          <svg className="transform -rotate-90 w-64 h-64">
            <circle
              cx="128"
              cy="128"
              r="90"
              stroke="currentColor"
              strokeWidth="8"
              fill="none"
              className="text-slate-700"
            />
            <circle
              cx="128"
              cy="128"
              r="90"
              stroke="currentColor"
              strokeWidth="8"
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              className="text-blue-500 transition-all duration-1000"
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-5xl font-light tabular-nums">
              {formatTime(timeRemaining)}
            </div>
            <div className="text-sm text-slate-400 mt-2">
              {isWorkSession ? 'Focus Time' : 'Break Time'}
            </div>
          </div>
        </div>
        {onAdjustMinutes && (
          <button
            type="button"
            onClick={() => onAdjustMinutes(5)}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium tabular-nums"
            aria-label="Increase time by 5 minutes"
          >
            +5
          </button>
        )}
      </div>

      <div className="flex gap-4">
        {state === 'running' ? (
          <button
            onClick={onPause}
            className="p-4 rounded-full bg-slate-800 hover:bg-slate-700 transition-colors"
            aria-label="Pause timer"
          >
            <Pause className="w-6 h-6" />
          </button>
        ) : (
          <button
            onClick={onStart}
            className="p-4 rounded-full bg-blue-600 hover:bg-blue-500 transition-colors"
            aria-label="Start timer"
          >
            <Play className="w-6 h-6" />
          </button>
        )}
        <button
          onClick={onStop}
          className="p-4 rounded-full bg-slate-800 hover:bg-slate-700 transition-colors"
          aria-label="Stop timer"
        >
          <Square className="w-6 h-6" />
        </button>
        <button
          onClick={onSkip}
          className="p-4 rounded-full bg-slate-800 hover:bg-slate-700 transition-colors"
          aria-label="Skip to next session"
        >
          <SkipForward className="w-6 h-6" />
        </button>
        {onShuffle && (
          <button
            onClick={onShuffle}
            className="p-4 rounded-full bg-slate-800 hover:bg-slate-700 transition-colors"
            aria-label="Shuffle binaural and ambient"
          >
            <Shuffle className="w-6 h-6" />
          </button>
        )}
      </div>
    </div>
  )
}

import { useState, useEffect, useRef, useCallback } from 'react'
import { TimerState, PomodoroConfig } from '../types'

interface UseTimerOptions {
  config: PomodoroConfig
  onComplete: () => void
}

export function useTimer({ config, onComplete }: UseTimerOptions) {
  const [state, setState] = useState<TimerState>('idle')
  const [timeRemaining, setTimeRemaining] = useState(config.workDuration * 60)
  const [currentCycle, setCurrentCycle] = useState(0)
  const [isWorkSession, setIsWorkSession] = useState(true)
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null)
  const intervalRef = useRef<number | null>(null)

  const start = useCallback(() => {
    if (state === 'running') return
    setSessionStartTime(Date.now())
    setState('running')
  }, [state])

  const pause = useCallback(() => {
    if (state !== 'running') return
    setState('paused')
  }, [state])

  const stop = useCallback(() => {
    setState('idle')
    setSessionStartTime(null)
    setIsWorkSession(true)
    setCurrentCycle(0)
    setTimeRemaining(config.workDuration * 60)
  }, [config.workDuration])

  const skip = useCallback(() => {
    onComplete()
  }, [onComplete])

  const adjustTime = useCallback((deltaSeconds: number) => {
    setTimeRemaining((prev) => Math.max(0, prev + deltaSeconds))
  }, [])

  useEffect(() => {
    if (state === 'running') {
      intervalRef.current = window.setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            setSessionStartTime(null)
            setState('completed')
            onComplete()
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [state, onComplete])

  const resetTimer = useCallback((duration: number) => {
    setTimeRemaining(duration * 60)
    setState('idle')
  }, [])

  useEffect(() => {
    if (state === 'idle') {
      const duration = isWorkSession
        ? config.workDuration * 60
        : (currentCycle % config.cyclesUntilLongBreak === 0
            ? config.longBreakDuration * 60
            : config.shortBreakDuration * 60)
      setTimeRemaining(duration)
    }
  }, [isWorkSession, currentCycle, config, state])

  const currentDuration = isWorkSession
    ? config.workDuration * 60
    : (currentCycle % config.cyclesUntilLongBreak === 0
        ? config.longBreakDuration * 60
        : config.shortBreakDuration * 60)
  // Use max so progress stays in [0,1] when user adds time; blue = elapsed proportion
  const totalDuration = Math.max(currentDuration, timeRemaining)
  const progress = totalDuration > 0 ? 1 - timeRemaining / totalDuration : 0

  return {
    state,
    timeRemaining,
    sessionStartTime,
    currentCycle,
    isWorkSession,
    progress,
    start,
    pause,
    stop,
    skip,
    adjustTime,
    resetTimer,
    setCurrentCycle,
    setIsWorkSession,
  }
}

import { Session } from '../types'

const STORAGE_KEY = 'echoflow_sessions'

export function getSessions(): Session[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    return data ? JSON.parse(data) : []
  } catch (error) {
    console.error('Error reading sessions from localStorage:', error)
    return []
  }
}

export function saveSession(session: Session): void {
  try {
    const sessions = getSessions()
    sessions.push(session)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions))
  } catch (error) {
    console.error('Error saving session to localStorage:', error)
  }
}

export function updateSession(sessionId: string, updates: Partial<Session>): void {
  try {
    const sessions = getSessions()
    const index = sessions.findIndex(s => s.id === sessionId)
    if (index !== -1) {
      sessions[index] = { ...sessions[index], ...updates }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions))
    }
  } catch (error) {
    console.error('Error updating session in localStorage:', error)
  }
}

export function deleteSession(sessionId: string): void {
  try {
    const sessions = getSessions().filter(s => s.id !== sessionId)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions))
  } catch (error) {
    console.error('Error deleting session from localStorage:', error)
  }
}

export function getSessionsByDate(date: string): Session[] {
  const sessions = getSessions()
  return sessions.filter(s => s.date === date)
}

export function getTotalMinutesByDate(date: string): number {
  const sessions = getSessionsByDate(date)
  return sessions.reduce((total, s) => total + s.totalMinutes, 0)
}

/** Total focused (work) minutes for a date. */
export function getFocusMinutesByDate(date: string): number {
  const sessions = getSessionsByDate(date).filter((s) => s.type === 'work' && s.totalMinutes > 0)
  return sessions.reduce((total, s) => total + s.totalMinutes, 0)
}

export interface DayBlock {
  type: 'work' | 'break'
  start: Date
  end: Date
  durationMinutes: number
  label?: string
  /** Set for work blocks: id of the session. */
  sessionId?: string
}

export interface GetDayBlocksOptions {
  /** When true, show inferred break (gray) blocks between work sessions. Use only for seed/mock data. */
  includeInferredBreaks?: boolean
}

/** Timeline blocks for a day: work (red) and optionally inferred break (gray) between work sessions. */
export function getDayBlocks(
  dateStr: string,
  dayStartHour = 6,
  dayEndHour = 23,
  options: GetDayBlocksOptions = {}
): DayBlock[] {
  const { includeInferredBreaks = false } = options
  const day = new Date(dateStr + 'T12:00:00')
  const startOfDay = new Date(day)
  startOfDay.setHours(dayStartHour, 0, 0, 0)
  const endOfDay = new Date(day)
  endOfDay.setHours(dayEndHour, 59, 59, 999)
  const now = new Date()
  const isToday = dateStr === now.toISOString().split('T')[0]

  // Work blocks use actual focus duration (start + totalMinutes), not wall-clock endTime
  const sessions = getSessionsByDate(dateStr)
    .filter((s) => s.type === 'work' && s.startTime && s.totalMinutes > 0)
    .map((s) => {
      const start = new Date(s.startTime)
      const end = new Date(start.getTime() + s.totalMinutes * 60 * 1000)
      return { id: s.id, start, end }
    })
    .filter((s) => s.end > s.start)
    .sort((a, b) => a.start.getTime() - b.start.getTime())

  const blocks: DayBlock[] = []
  let cursor = startOfDay.getTime()

  for (const s of sessions) {
    const sStart = s.start.getTime()
    const sEnd = s.end.getTime()
    if (includeInferredBreaks && sStart > cursor) {
      const breakEnd = Math.min(sStart, endOfDay.getTime())
      if (breakEnd > cursor) {
        blocks.push({
          type: 'break',
          start: new Date(cursor),
          end: new Date(breakEnd),
          durationMinutes: (breakEnd - cursor) / (60 * 1000),
          label: 'Break',
        })
      }
      cursor = breakEnd
    } else if (sStart > cursor) {
      cursor = Math.min(sStart, endOfDay.getTime())
    }
    if (sEnd > cursor && sStart < endOfDay.getTime()) {
      const blockStart = Math.max(sStart, startOfDay.getTime())
      const blockEnd = Math.min(sEnd, endOfDay.getTime())
      if (blockEnd > blockStart) {
        blocks.push({
          type: 'work',
          start: new Date(blockStart),
          end: new Date(blockEnd),
          durationMinutes: (blockEnd - blockStart) / (60 * 1000),
          label: 'Focus',
          sessionId: s.id,
        })
      }
      cursor = Math.max(cursor, sEnd)
    }
  }
  if (includeInferredBreaks && cursor < endOfDay.getTime()) {
    const endCap = isToday ? Math.min(now.getTime(), endOfDay.getTime()) : endOfDay.getTime()
    if (endCap > cursor) {
      blocks.push({
        type: 'break',
        start: new Date(cursor),
        end: new Date(endCap),
        durationMinutes: (endCap - cursor) / (60 * 1000),
        label: 'Break',
      })
    }
  }
  return blocks
}

export function getStreak(): number {
  const sessions = getSessions()
  if (sessions.length === 0) return 0

  const sortedSessions = sessions
    .filter(s => s.type === 'work' && s.totalMinutes > 0)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  if (sortedSessions.length === 0) return 0

  let streak = 0
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  for (let i = 0; i < sortedSessions.length; i++) {
    const sessionDate = new Date(sortedSessions[i].date)
    sessionDate.setHours(0, 0, 0, 0)
    const daysDiff = Math.floor((today.getTime() - sessionDate.getTime()) / (1000 * 60 * 60 * 24))

    if (daysDiff === streak) {
      streak++
    } else if (daysDiff > streak) {
      break
    }
  }

  return streak
}

export function getTotalHours(): number {
  const sessions = getSessions()
  const totalMinutes = sessions
    .filter(s => s.type === 'work')
    .reduce((total, s) => total + s.totalMinutes, 0)
  return Math.round((totalMinutes / 60) * 10) / 10
}

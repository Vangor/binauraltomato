import { Session } from '../types'

const STORAGE_KEY = 'focusforge_sessions'

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

export function getSessionsByDate(date: string): Session[] {
  const sessions = getSessions()
  return sessions.filter(s => s.date === date)
}

export function getTotalMinutesByDate(date: string): number {
  const sessions = getSessionsByDate(date)
  return sessions.reduce((total, s) => total + s.totalMinutes, 0)
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

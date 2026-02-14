import { useState } from 'react'
import { ChevronLeft, ChevronRight, Clock, Target, Pencil, Trash2 } from 'lucide-react'
import {
  getSessionsByDate,
  getFocusMinutesByDate,
  getStreak,
  getTotalHours,
  updateSession,
  deleteSession,
} from '../utils/sessionStorage'
import { formatDuration } from '../utils/formatTime'
import { DayView } from './DayView'
import type { Session } from '../types'

function formatTimeInput(d: Date): string {
  const h = d.getHours()
  const m = d.getMinutes()
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}

function parseTimeInput(dateStr: string, value: string): Date {
  const d = new Date(dateStr + 'T12:00:00')
  const [h, m] = value.split(':').map(Number)
  d.setHours(Number.isNaN(h) ? 0 : h, Number.isNaN(m) ? 0 : m, 0, 0)
  return d
}

function SessionsList({
  selectedDate,
  onSessionsChange,
}: {
  selectedDate: string
  onSessionsChange: () => void
}) {
  const daySessions = getSessionsByDate(selectedDate).filter(
    (s) => s.type === 'work' && s.totalMinutes > 0
  )
  const dayTotal = daySessions.reduce((sum, s) => sum + s.totalMinutes, 0)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editStart, setEditStart] = useState('')
  const [editMinutes, setEditMinutes] = useState('')

  const startEdit = (session: Session) => {
    const start = new Date(session.startTime)
    setEditingId(session.id)
    setEditStart(formatTimeInput(start))
    setEditMinutes(String(session.totalMinutes))
  }
  const saveEdit = () => {
    if (!editingId) return
    const start = parseTimeInput(selectedDate, editStart)
    const mins = Math.max(1, Math.min(480, parseInt(editMinutes, 10) || 1))
    const end = new Date(start.getTime() + mins * 60 * 1000)
    updateSession(editingId, {
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      totalMinutes: mins,
    })
    setEditingId(null)
    onSessionsChange()
  }
  const removeSession = (id: string) => {
    deleteSession(id)
    setEditingId(null)
    onSessionsChange()
  }

  return (
    <div className="space-y-3 border-t border-slate-700 pt-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-slate-400">Sessions</span>
        {dayTotal > 0 && (
          <span className="text-xs text-slate-400 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {formatDuration(dayTotal)} total
          </span>
        )}
      </div>
      {daySessions.length === 0 ? (
        <p className="text-sm text-slate-500">No completed focus sessions this day</p>
      ) : (
        <ul className="space-y-2">
          {daySessions.map((session) => (
            <li
              key={session.id}
              className="flex items-center gap-2 text-sm text-slate-300 flex-wrap"
            >
              {editingId === session.id ? (
                <>
                  <input
                    type="time"
                    value={editStart}
                    onChange={(e) => setEditStart(e.target.value)}
                    className="w-24 rounded bg-slate-700 px-1.5 py-0.5 text-xs"
                  />
                  <input
                    type="number"
                    min={1}
                    max={480}
                    value={editMinutes}
                    onChange={(e) => setEditMinutes(e.target.value)}
                    className="w-14 rounded bg-slate-700 px-1.5 py-0.5 text-xs tabular-nums"
                  />
                  <span className="text-slate-500 text-xs">min</span>
                  <button
                    type="button"
                    onClick={saveEdit}
                    className="text-xs text-blue-400 hover:text-blue-300"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="text-xs text-slate-400 hover:text-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => removeSession(session.id)}
                    className="p-0.5 rounded text-red-400 hover:text-red-300"
                    aria-label="Delete session"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              ) : (
                <>
                  <Target className="w-4 h-4 text-slate-500 shrink-0" />
                  <span>
                    {session.cyclesCompleted} {session.cyclesCompleted === 1 ? 'cycle' : 'cycles'}
                    {' · '}
                    {formatDuration(session.totalMinutes)}
                    {' · '}
                    {formatTimeInput(new Date(session.startTime))}
                  </span>
                  <button
                    type="button"
                    onClick={() => startEdit(session)}
                    className="p-0.5 rounded text-slate-400 hover:text-slate-300 ml-auto"
                    aria-label="Edit session"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeSession(session.id)}
                    className="p-0.5 rounded text-slate-400 hover:text-red-400"
                    aria-label="Delete session"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function Calendar() {
  const [selectedDate, setSelectedDate] = useState<string | null>(
    () => new Date().toISOString().split('T')[0]
  )
  const [currentDate, setCurrentDate] = useState(new Date())
  const [refresh, setRefresh] = useState(0)

  const getDaysInView = () => {
    const start = new Date(currentDate)
    const day = start.getDay()
    const diff = start.getDate() - day
    start.setDate(diff)
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(start)
      date.setDate(start.getDate() + i)
      return date
    })
  }

  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate)
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7))
    setCurrentDate(newDate)
  }

  const getDateKey = (date: Date): string => {
    return date.toISOString().split('T')[0]
  }

  const days = getDaysInView()
  const streak = getStreak()
  const totalHours = getTotalHours()

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-slate-300">
          {days[0].toLocaleString('default', { month: 'long', year: 'numeric' })}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => navigateDate('prev')}
            className="p-1 rounded hover:bg-slate-800"
            aria-label="Previous week"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => navigateDate('next')}
            className="p-1 rounded hover:bg-slate-800"
            aria-label="Next week"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2">
        <>
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => (
            <div key={i} className="text-center text-xs text-slate-500 py-2">
              {day}
            </div>
          ))}
          {days.map((date, i) => {
          const dateKey = getDateKey(date)
          const focusMinutes = getFocusMinutesByDate(dateKey)
          const isToday = getDateKey(new Date()) === dateKey
          const isCurrentMonth = date.getMonth() === currentDate.getMonth()

          return (
            <button
              key={i}
              onClick={() => setSelectedDate(selectedDate === dateKey ? null : dateKey)}
              className={`p-2 rounded-lg text-sm transition-colors flex flex-col items-center ${
                isToday
                  ? 'bg-blue-600 text-white'
                  : selectedDate === dateKey
                  ? 'bg-slate-700 text-white'
                  : isCurrentMonth
                  ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  : 'bg-slate-900 text-slate-600'
              }`}
            >
              <div className="text-xs font-medium">{date.getDate()}</div>
              {focusMinutes > 0 && (
                <div className="text-[10px] opacity-90 mt-0.5 tabular-nums">
                  {formatDuration(focusMinutes)}
                </div>
              )}
            </button>
          )
        })}
        </>
      </div>

      <div className="grid grid-cols-2 gap-4 pt-4">
        <div className="bg-slate-800 rounded-lg p-4">
          <div className="text-xs text-slate-400 mb-1">Streak</div>
          <div className="text-2xl font-semibold">{streak} days</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-4">
          <div className="text-xs text-slate-400 mb-1">Total Hours</div>
          <div className="text-2xl font-semibold">{totalHours}h</div>
        </div>
      </div>

      {selectedDate && (
        <div key={refresh} className="bg-slate-800 rounded-lg p-4 space-y-4">
          <DayView
            selectedDate={selectedDate}
            onSessionsChange={() => setRefresh((r) => r + 1)}
          />
          <SessionsList
            selectedDate={selectedDate}
            onSessionsChange={() => setRefresh((r) => r + 1)}
          />
        </div>
      )}
    </div>
  )
}

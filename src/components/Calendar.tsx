import { useState } from 'react'
import { ChevronLeft, ChevronRight, Clock, Target } from 'lucide-react'
import { getSessionsByDate, getTotalMinutesByDate, getStreak, getTotalHours } from '../utils/sessionStorage'
import { formatDuration } from '../utils/formatTime'

export function Calendar() {
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [currentDate, setCurrentDate] = useState(new Date())

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
          const minutes = getTotalMinutesByDate(dateKey)
          const isToday = getDateKey(new Date()) === dateKey
          const isCurrentMonth = date.getMonth() === currentDate.getMonth()

          return (
            <button
              key={i}
              onClick={() => setSelectedDate(selectedDate === dateKey ? null : dateKey)}
              className={`p-2 rounded-lg text-sm transition-colors ${
                isToday
                  ? 'bg-blue-600 text-white'
                  : selectedDate === dateKey
                  ? 'bg-slate-700 text-white'
                  : isCurrentMonth
                  ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  : 'bg-slate-900 text-slate-600'
              }`}
            >
              <div className="text-xs mb-1">{date.getDate()}</div>
              {minutes > 0 && (
                <div className="h-1 bg-blue-500 rounded-full" style={{ width: `${Math.min(minutes / 60, 1) * 100}%` }} />
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

      {selectedDate && (() => {
        const daySessions = getSessionsByDate(selectedDate).filter(
          (s) => s.totalMinutes > 0
        )
        const dayTotal = daySessions.reduce((sum, s) => sum + s.totalMinutes, 0)
        const displayDate = new Date(selectedDate + 'T12:00:00')
        const isToday = getDateKey(displayDate) === getDateKey(new Date())
        const dateLabel = isToday
          ? 'Today'
          : displayDate.toLocaleDateString('default', {
              weekday: 'long',
              month: 'short',
              day: 'numeric',
            })
        return (
          <div className="bg-slate-800 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-slate-200">
                {dateLabel}
              </span>
              {dayTotal > 0 && (
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {formatDuration(dayTotal)} total
                </span>
              )}
            </div>
            {daySessions.length === 0 ? (
              <p className="text-sm text-slate-400">
                No completed sessions this day
              </p>
            ) : (
              <ul className="space-y-2">
                {daySessions.map((session) => (
                  <li
                    key={session.id}
                    className="flex items-center gap-2 text-sm text-slate-300"
                  >
                    <Target className="w-4 h-4 text-slate-500 shrink-0" />
                    <span>
                      {session.cyclesCompleted} {session.cyclesCompleted === 1 ? 'cycle' : 'cycles'}
                      {' · '}
                      {formatDuration(session.totalMinutes)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      })()}
    </div>
  )
}

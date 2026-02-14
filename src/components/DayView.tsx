import { useRef, useState, useCallback, useEffect } from 'react'
import {
  getDayBlocks,
  getFocusMinutesByDate,
  getSessionsByDate,
  updateSession,
  saveSession,
  deleteSession,
} from '../utils/sessionStorage'
import { formatDuration } from '../utils/formatTime'
import { Trash2 } from 'lucide-react'
import type { Session } from '../types'

const DAY_START_HOUR = 6
const DAY_END_HOUR = 23
const TOTAL_HOURS = DAY_END_HOUR - DAY_START_HOUR + 1
const ROW_HEIGHT_PX = 28
const MIN_BLOCK_HEIGHT_PX = 22
const SNAP_MINUTES = 5
const VISIBLE_HOURS = 8
const VISIBLE_TRACK_HEIGHT_PX = VISIBLE_HOURS * ROW_HEIGHT_PX

function getDateKey(date: Date): string {
  return date.toISOString().split('T')[0]
}

function snapMinutes(minutes: number): number {
  return Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES
}

interface DayViewProps {
  selectedDate: string
  onSessionsChange?: () => void
}

export function DayView({ selectedDate, onSessionsChange }: DayViewProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [createPreview, setCreatePreview] = useState<{ startY: number; endY: number } | null>(null)
  const [dragState, setDragState] = useState<
    | { type: 'move'; sessionId: string; offsetY: number; previewStartMinutes?: number }
    | { type: 'resize'; sessionId: string; startMinutes: number; previewDurationMinutes?: number }
    | null
  >(null)
  const [, setMinuteTick] = useState(0)

  const hasSeedData = getSessionsByDate(selectedDate).some((s) => s.id.startsWith('seed-'))
  const blocks = getDayBlocks(selectedDate, DAY_START_HOUR, DAY_END_HOUR, {
    includeInferredBreaks: hasSeedData,
  })
  const focusMinutes = getFocusMinutesByDate(selectedDate)
  const day = new Date(selectedDate + 'T12:00:00')
  const isToday = getDateKey(day) === getDateKey(new Date())
  const dateLabel = isToday
    ? 'Today'
    : day.toLocaleDateString('default', { weekday: 'long', month: 'short', day: 'numeric' })

  const startOfDay = new Date(day)
  startOfDay.setHours(DAY_START_HOUR, 0, 0, 0)
  const endOfDay = new Date(day)
  endOfDay.setHours(DAY_END_HOUR, 59, 59, 999)
  const totalMs = endOfDay.getTime() - startOfDay.getTime()
  const trackHeightPx = TOTAL_HOURS * ROW_HEIGHT_PX

  const now = new Date()
  const currentTimeTopPx =
    isToday && now >= startOfDay && now <= endOfDay
      ? ((now.getTime() - startOfDay.getTime()) / totalMs) * trackHeightPx
      : null

  useEffect(() => {
    if (!isToday) return
    const id = setInterval(() => setMinuteTick((t) => t + 1), 60_000)
    return () => clearInterval(id)
  }, [isToday])

  useEffect(() => {
    if (!isToday) return
    const el = scrollContainerRef.current
    if (!el) return
    const now = new Date()
    const startOfDayNow = new Date(selectedDate + 'T12:00:00')
    startOfDayNow.setHours(DAY_START_HOUR, 0, 0, 0)
    const endOfDayNow = new Date(selectedDate + 'T12:00:00')
    endOfDayNow.setHours(DAY_END_HOUR, 59, 59, 999)
    if (now < startOfDayNow || now > endOfDayNow) return
    const totalMs = endOfDayNow.getTime() - startOfDayNow.getTime()
    const currentTop = ((now.getTime() - startOfDayNow.getTime()) / totalMs) * trackHeightPx
    const visible = VISIBLE_TRACK_HEIGHT_PX
    const scrollTo = currentTop - visible / 2 + ROW_HEIGHT_PX / 2
    el.scrollTop = Math.max(0, Math.min(scrollTo, el.scrollHeight - visible))
  }, [selectedDate, isToday, trackHeightPx])

  const pxToMinutes = useCallback(
    (px: number) => {
      const pct = Math.max(0, Math.min(1, px / trackHeightPx))
      return snapMinutes((pct * (DAY_END_HOUR - DAY_START_HOUR + 1) * 60))
    },
    [trackHeightPx]
  )
  const topPxFor = useCallback(
    (d: Date) => {
      const ms = Math.max(0, d.getTime() - startOfDay.getTime())
      return (ms / totalMs) * trackHeightPx
    },
    [totalMs, trackHeightPx]
  )
  const heightPxFor = useCallback(
    (start: Date, end: Date) => {
      const ms = end.getTime() - start.getTime()
      return Math.max(MIN_BLOCK_HEIGHT_PX, (ms / totalMs) * trackHeightPx)
    },
    [totalMs, trackHeightPx]
  )
  const minutesToPx = useCallback(
    (minutes: number) => {
      const pct = minutes / ((DAY_END_HOUR - DAY_START_HOUR + 1) * 60)
      return pct * trackHeightPx
    },
    [trackHeightPx]
  )

  const getY = useCallback(
    (e: React.MouseEvent | MouseEvent) => {
      const track = trackRef.current
      if (!track) return 0
      const rect = track.getBoundingClientRect()
      return e.clientY - rect.top
    },
    []
  )

  const handleTrackMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest('[data-block]') || (e.target as HTMLElement).closest('[data-resize-handle]')) return
      const y = getY(e)
      setCreatePreview({ startY: y, endY: y })
    },
    [getY]
  )
  const handleTrackMouseMove = useCallback(
    (e: MouseEvent) => {
      if (createPreview !== null) {
        setCreatePreview((prev) => (prev ? { ...prev, endY: getY(e) } : null))
        return
      }
      if (dragState?.type === 'move') {
        const y = getY(e)
        const newStartMinutes = Math.max(0, pxToMinutes(y - dragState.offsetY))
        const sessions = getSessionsByDate(selectedDate)
        const session = sessions.find((s) => s.id === dragState.sessionId)
        if (!session) return
        const duration = session.totalMinutes
        const maxStart = (DAY_END_HOUR - DAY_START_HOUR) * 60 - duration
        const clamped = Math.min(maxStart, newStartMinutes)
        setDragState((prev) => (prev?.type === 'move' ? { ...prev, previewStartMinutes: clamped } : null))
        return
      }
      if (dragState?.type === 'resize') {
        const y = getY(e)
        const endMinutes = pxToMinutes(y)
        const newDuration = Math.max(SNAP_MINUTES, snapMinutes(endMinutes - dragState.startMinutes))
        setDragState((prev) => (prev?.type === 'resize' ? { ...prev, previewDurationMinutes: newDuration } : null))
      }
    },
    [createPreview, dragState, getY, pxToMinutes, selectedDate]
  )
  const handleTrackMouseUp = useCallback(
    (_e: MouseEvent) => {
      if (createPreview !== null) {
        const startM = pxToMinutes(Math.min(createPreview.startY, createPreview.endY))
        const endM = pxToMinutes(Math.max(createPreview.startY, createPreview.endY))
        const duration = Math.max(SNAP_MINUTES, endM - startM)
        if (duration >= SNAP_MINUTES) {
          const newStart = new Date(selectedDate + 'T12:00:00')
          newStart.setHours(DAY_START_HOUR, 0, 0, 0)
          newStart.setMinutes(newStart.getMinutes() + startM)
          const newEnd = new Date(newStart.getTime() + duration * 60 * 1000)
          const newSession: Session = {
            id: crypto.randomUUID(),
            date: selectedDate,
            startTime: newStart.toISOString(),
            endTime: newEnd.toISOString(),
            cyclesCompleted: Math.max(1, Math.floor(duration / 25)),
            totalMinutes: duration,
            type: 'work',
          }
          saveSession(newSession)
          onSessionsChange?.()
        }
        setCreatePreview(null)
        return
      }
      if (dragState?.type === 'move' && dragState.previewStartMinutes !== undefined) {
        const sessions = getSessionsByDate(selectedDate)
        const session = sessions.find((s) => s.id === dragState.sessionId)
        if (session) {
          const newStart = new Date(selectedDate + 'T12:00:00')
          newStart.setHours(DAY_START_HOUR, 0, 0, 0)
          newStart.setMinutes(newStart.getMinutes() + dragState.previewStartMinutes)
          const newEnd = new Date(newStart.getTime() + session.totalMinutes * 60 * 1000)
          updateSession(dragState.sessionId, {
            startTime: newStart.toISOString(),
            endTime: newEnd.toISOString(),
          })
          onSessionsChange?.()
        }
      }
      if (dragState?.type === 'resize' && dragState.previewDurationMinutes !== undefined) {
        const sessions = getSessionsByDate(selectedDate)
        const session = sessions.find((s) => s.id === dragState.sessionId)
        if (session) {
          const start = new Date(session.startTime)
          const newEnd = new Date(start.getTime() + dragState.previewDurationMinutes * 60 * 1000)
          updateSession(dragState.sessionId, {
            totalMinutes: dragState.previewDurationMinutes,
            endTime: newEnd.toISOString(),
          })
          onSessionsChange?.()
        }
      }
      setDragState(null)
    },
    [createPreview, dragState, pxToMinutes, selectedDate, onSessionsChange]
  )

  useEffect(() => {
    if (createPreview === null && dragState === null) return
    window.addEventListener('mousemove', handleTrackMouseMove)
    window.addEventListener('mouseup', handleTrackMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleTrackMouseMove)
      window.removeEventListener('mouseup', handleTrackMouseUp)
    }
  }, [createPreview, dragState, handleTrackMouseMove, handleTrackMouseUp])

  const onBlockMouseDown = useCallback(
    (sessionId: string, e: React.MouseEvent) => {
      e.preventDefault()
      if ((e.target as HTMLElement).closest('[data-resize-handle]')) return
      const block = blocks.find((b) => b.sessionId === sessionId)
      if (!block) return
      const y = getY(e)
      const blockTop = topPxFor(block.start)
      setDragState({ type: 'move', sessionId, offsetY: y - blockTop })
    },
    [blocks, getY, topPxFor]
  )
  const onResizeMouseDown = useCallback((sessionId: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const session = getSessionsByDate(selectedDate).find((s) => s.id === sessionId)
    if (!session) return
    const start = new Date(session.startTime)
    const startMinutes = (start.getHours() - DAY_START_HOUR) * 60 + start.getMinutes()
    setDragState({ type: 'resize', sessionId, startMinutes })
  }, [selectedDate])

  const onDeleteBlock = useCallback(
    (sessionId: string, e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      deleteSession(sessionId)
      onSessionsChange?.()
    },
    [onSessionsChange]
  )

  const hours = Array.from({ length: TOTAL_HOURS }, (_, i) => DAY_START_HOUR + i)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-slate-200">{dateLabel}</span>
        {focusMinutes > 0 && (
          <span className="text-xs font-medium text-slate-300 tabular-nums">
            {formatDuration(focusMinutes)} focus
          </span>
        )}
      </div>
      <p className="text-[10px] text-slate-500">Drag blocks to move, drag bottom edge to resize. Drag on empty area to add focus.</p>
      {blocks.length === 0 && !createPreview ? (
        <p className="text-xs text-slate-500 py-4">No sessions this day. Drag on the track below to create one.</p>
      ) : null}
      <div
        ref={scrollContainerRef}
        className="overflow-y-auto overflow-x-hidden"
        style={{ maxHeight: VISIBLE_TRACK_HEIGHT_PX, scrollbarGutter: 'stable' }}
      >
        <div className="flex gap-3">
          <div
            className="flex flex-col justify-between text-xs text-slate-500 shrink-0 w-14 py-0.5"
            style={{ height: trackHeightPx }}
          >
            {hours.map((h) => (
              <span key={h} className="leading-none">
                {new Date(2000, 0, 1, h).toLocaleTimeString('default', {
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true,
                })}
              </span>
            ))}
          </div>
          <div
            ref={trackRef}
            role="application"
            aria-label="Day timeline"
            className="flex-1 relative min-w-0 rounded-lg overflow-visible border border-slate-700/80 bg-slate-800/30 select-none cursor-crosshair"
            style={{ height: trackHeightPx, minHeight: trackHeightPx }}
            onMouseDown={handleTrackMouseDown}
          >
          {isToday && currentTimeTopPx != null && (
            <div
              className="absolute left-0 right-0 z-10 pointer-events-none flex items-center"
              style={{ top: currentTimeTopPx, transform: 'translateY(-50%)' }}
              aria-hidden
            >
              <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
              <div className="flex-1 h-0.5 bg-red-500/90" />
            </div>
          )}
          {createPreview && (
            <div
              className="absolute left-0 right-0 rounded-sm bg-blue-600/60 border border-blue-400 pointer-events-none"
              style={{
                top: `${Math.min(createPreview.startY, createPreview.endY)}px`,
                height: `${Math.max(MIN_BLOCK_HEIGHT_PX, Math.abs(createPreview.endY - createPreview.startY))}px`,
              }}
            />
          )}
          {blocks.map((block, i) => {
            let top = topPxFor(block.start)
            let height = heightPxFor(block.start, block.end)
            if (block.sessionId && dragState?.type === 'move' && dragState.sessionId === block.sessionId && dragState.previewStartMinutes !== undefined) {
              top = minutesToPx(dragState.previewStartMinutes)
              const sessions = getSessionsByDate(selectedDate)
              const session = sessions.find((s) => s.id === block.sessionId)
              if (session) height = minutesToPx(session.totalMinutes)
            }
            if (block.sessionId && dragState?.type === 'resize' && dragState.sessionId === block.sessionId && dragState.previewDurationMinutes !== undefined) {
              height = Math.max(MIN_BLOCK_HEIGHT_PX, minutesToPx(dragState.previewDurationMinutes))
            }
            const isWork = block.type === 'work'
            const showLabel = height >= 24
            return (
              <div
                key={block.sessionId ?? `break-${i}`}
                data-block
                className="absolute left-0 right-0 rounded-sm px-2 flex flex-col gap-0 text-xs border-0 cursor-grab active:cursor-grabbing"
                style={{
                  top: `${top}px`,
                  height: `${height}px`,
                  minHeight: `${MIN_BLOCK_HEIGHT_PX}px`,
                  backgroundColor: isWork ? 'rgb(185 28 28)' : 'rgb(71 85 105)',
                  color: isWork ? 'rgb(254 226 226)' : 'rgb(203 213 225)',
                  pointerEvents: isWork ? 'auto' : 'none',
                  cursor: isWork ? 'grab' : 'default',
                }}
                title={block.sessionId ? 'Drag to move. Drag bottom edge to resize. Click trash to delete.' : undefined}
                onMouseDown={block.sessionId ? (e) => onBlockMouseDown(block.sessionId!, e) : undefined}
              >
                <div className="flex items-center justify-between gap-1 flex-1 min-h-0">
                  {showLabel ? (
                    <>
                      <span className="font-medium truncate">{block.label ?? block.type}</span>
                      <span className="flex items-center gap-0.5 shrink-0">
                        <span className="tabular-nums">{formatDuration(block.durationMinutes)}</span>
                        {isWork && block.sessionId && (
                          <button
                            type="button"
                            className="opacity-70 hover:opacity-100 hover:text-white p-0.5 rounded cursor-pointer touch-manipulation"
                            onClick={(e) => onDeleteBlock(block.sessionId!, e)}
                            onMouseDown={(e) => e.stopPropagation()}
                            aria-label="Delete block"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="tabular-nums opacity-90">{formatDuration(block.durationMinutes)}</span>
                      {isWork && block.sessionId && (
                        <button
                          type="button"
                          className="opacity-70 hover:opacity-100 p-0.5 rounded cursor-pointer touch-manipulation shrink-0"
                          onClick={(e) => onDeleteBlock(block.sessionId!, e)}
                          onMouseDown={(e) => e.stopPropagation()}
                          aria-label="Delete block"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </>
                  )}
                </div>
                {isWork && block.sessionId && height >= 20 && (
                  <div
                    data-resize-handle
                    className="absolute bottom-0 left-0 right-0 h-1.5 cursor-ns-resize bg-white/20 rounded-b-sm hover:bg-white/40"
                    onMouseDown={(e) => onResizeMouseDown(block.sessionId!, e)}
                    aria-label="Resize block"
                  />
                )}
              </div>
            )
          })}
          </div>
        </div>
      </div>
    </div>
  )
}

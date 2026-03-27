import * as React from 'react'
import { cn } from '../lib/utils'

interface ActivityEvent {
  id: string
  event_type: string
  summary: string | null
  created_at: string
  actor?: {
    full_name: string | null
  } | null
}

interface ActivityFeedProps {
  events: ActivityEvent[]
  className?: string
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'gerade eben'
  if (mins < 60) return `vor ${mins} Min.`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `vor ${hours} Std.`
  const days = Math.floor(hours / 24)
  if (days < 30) return `vor ${days} Tag${days !== 1 ? 'en' : ''}`
  return new Date(dateStr).toLocaleDateString('de-DE')
}

function eventTypeLabel(type: string): string {
  const map: Record<string, string> = {
    'project.created': 'Erstellt',
    'project.updated': 'Aktualisiert',
    'project.deleted': 'Archiviert',
    'company.created': 'Erstellt',
    'company.updated': 'Aktualisiert',
    'company.deleted': 'Deaktiviert',
    'contact.created': 'Erstellt',
    'contact.updated': 'Aktualisiert',
    'contact.deleted': 'Deaktiviert',
    'report.created': 'Bericht erstellt',
    'report.updated': 'Bericht aktualisiert',
    'report.deleted': 'Bericht archiviert',
  }
  return map[type] ?? type
}

function eventDotColor(type: string): string {
  if (type.endsWith('.deleted')) return 'bg-red-400'
  if (type.endsWith('.created')) return 'bg-green-400'
  return 'bg-blue-400'
}

export function ActivityFeed({ events, className }: ActivityFeedProps) {
  if (events.length === 0) {
    return (
      <div className={cn('py-8 text-center text-sm text-zinc-400', className)}>
        Noch keine Aktivität.
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col', className)}>
      {events.map((event, i) => (
        <div key={event.id} className="flex gap-3 py-3 relative">
          {i < events.length - 1 && (
            <div className="absolute left-[7px] top-8 bottom-0 w-px bg-zinc-100" />
          )}
          <div className={cn('mt-1 h-3.5 w-3.5 rounded-full flex-shrink-0 ring-2 ring-white', eventDotColor(event.event_type))} />
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
                {eventTypeLabel(event.event_type)}
              </span>
              <span className="text-xs text-zinc-400">{timeAgo(event.created_at)}</span>
            </div>
            <p className="mt-0.5 text-sm text-zinc-700">{event.summary}</p>
            {event.actor?.full_name && (
              <p className="mt-0.5 text-xs text-zinc-400">{event.actor.full_name}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

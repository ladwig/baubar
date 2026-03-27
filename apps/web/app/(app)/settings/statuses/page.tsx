'use client'

import { useState, useEffect } from 'react'
import { Plus, GripVertical } from 'lucide-react'
import { PageHeader, StatusBadge } from '@baubar/ui'

type Status = {
  id: string; label: string; status_type: string; color: string; sort_order: number; is_default: boolean
}

const STATUS_TYPES = [
  { value: 'OPEN', label: 'Offen' },
  { value: 'IN_PROGRESS', label: 'In Arbeit' },
  { value: 'WAITING', label: 'Wartend' },
  { value: 'BLOCKED', label: 'Blockiert' },
  { value: 'DONE', label: 'Abgeschlossen' },
]

export default function StatusesPage() {
  const [statuses, setStatuses] = useState<Status[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ label: '', status_type: 'OPEN', color: '#6B7280' })
  const [submitting, setSubmitting] = useState(false)

  const load = () =>
    fetch('/api/v1/admin/statuses').then((r) => r.json()).then((d) => { setStatuses(d); setLoading(false) })

  useEffect(() => { load() }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    await fetch('/api/v1/admin/statuses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, sort_order: statuses.length }),
    })
    setForm({ label: '', status_type: 'OPEN', color: '#6B7280' })
    setShowForm(false)
    setSubmitting(false)
    load()
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <PageHeader
        title="Status-Verwaltung"
        description="Definieren Sie die Projektstatus Ihrer Organisation"
        action={
          <button
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center gap-1.5 rounded-md bg-zinc-900 px-3.5 py-2 text-sm font-medium text-white shadow hover:bg-zinc-800 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Neuer Status
          </button>
        }
      />

      {showForm && (
        <form onSubmit={handleCreate} className="rounded-lg border border-zinc-200 bg-white p-5 flex flex-col gap-4">
          <h3 className="text-sm font-semibold text-zinc-900">Neuen Status erstellen</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-zinc-700">Bezeichnung</label>
              <input required value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })}
                placeholder="z.B. Ausschreibung"
                className="flex h-9 w-full rounded-md border border-zinc-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-900" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-zinc-700">System-Typ</label>
              <select value={form.status_type} onChange={(e) => setForm({ ...form, status_type: e.target.value })}
                className="flex h-9 w-full rounded-md border border-zinc-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-900">
                {STATUS_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-zinc-700">Farbe</label>
              <div className="flex items-center gap-2">
                <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })}
                  className="h-9 w-12 rounded-md border border-zinc-200 cursor-pointer p-0.5" />
                <input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })}
                  placeholder="#6B7280"
                  className="flex h-9 flex-1 rounded-md border border-zinc-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-900" />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="submit" disabled={submitting}
              className="inline-flex h-9 items-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 transition-colors">
              {submitting ? 'Wird erstellt...' : 'Erstellen'}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="inline-flex h-9 items-center rounded-md border border-zinc-200 px-4 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition-colors">
              Abbrechen
            </button>
          </div>
        </form>
      )}

      <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-zinc-400">Lädt...</div>
        ) : statuses.length === 0 ? (
          <div className="p-8 text-center text-sm text-zinc-400">Keine Status definiert.</div>
        ) : (
          <div className="divide-y divide-zinc-50">
            {statuses.map((s) => (
              <div key={s.id} className="flex items-center gap-4 px-4 py-3">
                <GripVertical className="h-4 w-4 text-zinc-300 flex-shrink-0 cursor-grab" />
                <StatusBadge label={s.label} color={s.color} />
                <span className="text-xs text-zinc-400 ml-1">
                  {STATUS_TYPES.find((t) => t.value === s.status_type)?.label}
                </span>
                {s.is_default && (
                  <span className="ml-auto text-xs text-zinc-400 bg-zinc-50 border border-zinc-100 rounded px-2 py-0.5">Standard</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

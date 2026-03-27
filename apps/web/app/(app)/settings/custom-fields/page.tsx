'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { PageHeader } from '@baubar/ui'

type FieldDef = {
  id: string; name: string; label: string; entity_type: string; field_type: string
  options?: string[] | null; sort_order?: number | null
}

const ENTITY_TYPES = [
  { value: 'project', label: 'Projekt' },
  { value: 'company', label: 'Unternehmen' },
  { value: 'contact', label: 'Kontakt' },
  { value: 'report', label: 'Bericht' },
]

const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Zahl' },
  { value: 'boolean', label: 'Ja/Nein' },
  { value: 'date', label: 'Datum' },
  { value: 'select', label: 'Auswahl' },
]

export default function CustomFieldsPage() {
  const [fields, setFields] = useState<FieldDef[]>([])
  const [loading, setLoading] = useState(true)
  const [activeEntity, setActiveEntity] = useState('project')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', label: '', field_type: 'text', options: '' })
  const [submitting, setSubmitting] = useState(false)

  const load = () => {
    setLoading(true)
    fetch(`/api/v1/admin/custom-fields?entity_type=${activeEntity}`)
      .then((r) => r.json())
      .then((d) => { setFields(d); setLoading(false) })
  }

  useEffect(() => { load() }, [activeEntity])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)

    const payload = {
      entity_type: activeEntity,
      name: form.name.toLowerCase().replace(/\s+/g, '_'),
      label: form.label,
      field_type: form.field_type,
      options: form.field_type === 'select' ? form.options.split(',').map((o) => o.trim()).filter(Boolean) : undefined,
      sort_order: fields.length,
    }

    await fetch('/api/v1/admin/custom-fields', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    setForm({ name: '', label: '', field_type: 'text', options: '' })
    setShowForm(false)
    setSubmitting(false)
    load()
  }

  async function handleDelete(id: string) {
    if (!confirm('Dieses Feld wirklich deaktivieren?')) return
    await fetch('/api/v1/admin/custom-fields', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    load()
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <PageHeader
        title="Benutzerdefinierte Felder"
        description="Ergänzen Sie Entitäten mit eigenen Feldern"
        action={
          <button onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center gap-1.5 rounded-md bg-zinc-900 px-3.5 py-2 text-sm font-medium text-white shadow hover:bg-zinc-800 transition-colors">
            <Plus className="h-4 w-4" />
            Neues Feld
          </button>
        }
      />

      {/* Entity type tabs */}
      <div className="flex gap-1 border-b border-zinc-200">
        {ENTITY_TYPES.map((t) => (
          <button key={t.value} onClick={() => setActiveEntity(t.value)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeEntity === t.value ? 'border-zinc-900 text-zinc-900' : 'border-transparent text-zinc-500 hover:text-zinc-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="rounded-lg border border-zinc-200 bg-white p-5 flex flex-col gap-4">
          <h3 className="text-sm font-semibold text-zinc-900">Neues Feld für {ENTITY_TYPES.find((t) => t.value === activeEntity)?.label}</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-zinc-700">Bezeichnung (UI-Label)</label>
              <input required value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value, name: e.target.value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z_]/g, '') })}
                placeholder="z.B. Gesamtpreis (€)"
                className="flex h-9 w-full rounded-md border border-zinc-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-900" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-zinc-700">Interner Key</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="gesamtpreis_eur"
                pattern="^[a-z_]+$"
                className="flex h-9 w-full rounded-md border border-zinc-200 bg-white px-3 py-1 text-sm font-mono shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-900" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-zinc-700">Feldtyp</label>
              <select value={form.field_type} onChange={(e) => setForm({ ...form, field_type: e.target.value })}
                className="flex h-9 w-full rounded-md border border-zinc-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-900">
                {FIELD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            {form.field_type === 'select' && (
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-zinc-700">Optionen (kommagetrennt)</label>
                <input value={form.options} onChange={(e) => setForm({ ...form, options: e.target.value })}
                  placeholder="Option A, Option B, Option C"
                  className="flex h-9 w-full rounded-md border border-zinc-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-900" />
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button type="submit" disabled={submitting}
              className="inline-flex h-9 items-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 transition-colors">
              {submitting ? 'Wird erstellt...' : 'Feld erstellen'}
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
        ) : fields.length === 0 ? (
          <div className="p-8 text-center text-sm text-zinc-400">
            Keine Felder für {ENTITY_TYPES.find((t) => t.value === activeEntity)?.label} definiert.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50">
                {['Bezeichnung', 'Key', 'Typ', 'Optionen', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fields.map((f) => (
                <tr key={f.id} className="border-b border-zinc-50 last:border-0">
                  <td className="px-4 py-3 font-medium text-zinc-900">{f.label}</td>
                  <td className="px-4 py-3 font-mono text-xs text-zinc-500">{f.name}</td>
                  <td className="px-4 py-3 text-zinc-500">{FIELD_TYPES.find((t) => t.value === f.field_type)?.label}</td>
                  <td className="px-4 py-3 text-zinc-400 text-xs">
                    {f.options ? (f.options as string[]).join(', ') : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => handleDelete(f.id)}
                      className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-zinc-400 hover:bg-red-50 hover:text-red-500 transition-colors">
                      <Trash2 className="h-3 w-3" />
                      Entfernen
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

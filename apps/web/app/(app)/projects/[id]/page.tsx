'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ChevronRight, Pencil, Plus, Trash2, X } from 'lucide-react'
import { StatusBadge, ActivityFeed, PageHeader, CustomFieldsForm } from '@baubar/ui'
import { cachedFetch, invalidate, TTL } from '@/lib/cache'

type Project = {
  id: string
  name: string
  address: string | null
  planned_hours: string | null
  custom_properties: Record<string, unknown>
  created_at: string | null
  company_id: string | null
  contact_id: string | null
  status_id: string | null
  status: { id: string; label: string; color: string } | null
  company: { id: string; name: string } | null
}

type Report = {
  id: string
  report_type: string
  text_content: string | null
  created_at: string | null
  author: { id: string; full_name: string | null } | null
}

type ActivityEvent = {
  id: string
  event_type: string
  summary: string | null
  changes?: Record<string, { old: unknown; new: unknown }> | null
  created_at: string
  actor: { id: string; full_name: string | null } | null
}

type Status = { id: string; label: string; color: string }
type Company = { id: string; name: string }
type Contact = { id: string; first_name: string; last_name: string }
type FieldDef = { id: string; name: string; label: string; field_type: string; options?: string[] | null; sort_order?: number | null }

const TABS = ['Übersicht', 'Berichte', 'Aktivität'] as const
type Tab = (typeof TABS)[number]

const REPORT_TYPES = ['Tagesbericht', 'Mängelprotokoll', 'Abnahme', 'Begehung', 'Sonstiges']

export default function ProjectDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [tab, setTab] = useState<Tab>('Übersicht')
  const [project, setProject] = useState<Project | null>(null)
  const [reports, setReports] = useState<Report[]>([])
  const [activity, setActivity] = useState<ActivityEvent[]>([])
  const [loading, setLoading] = useState(true)

  // Project edit mode
  const [editMode, setEditMode] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', address: '', planned_hours: '', status_id: '', company_id: '', contact_id: '' })
  const [editCustomProps, setEditCustomProps] = useState<Record<string, unknown>>({})
  const [statuses, setStatuses] = useState<Status[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [contactsList, setContactsList] = useState<Contact[]>([])
  const [fieldDefs, setFieldDefs] = useState<FieldDef[]>([])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // New report form
  const [showReportForm, setShowReportForm] = useState(false)
  const [reportType, setReportType] = useState(REPORT_TYPES[0]!)
  const [reportText, setReportText] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Per-report edit state
  const [editingReportId, setEditingReportId] = useState<string | null>(null)
  const [editReportType, setEditReportType] = useState('')
  const [editReportText, setEditReportText] = useState('')
  const [savingReport, setSavingReport] = useState(false)

  useEffect(() => {
    cachedFetch<Project>(`/api/v1/projects/${id}`, TTL.DETAIL)
      .then((d) => { setProject(d); setLoading(false) })
  }, [id])

  useEffect(() => {
    if (tab === 'Berichte') {
      cachedFetch<Report[]>(`/api/v1/projects/${id}/reports`, TTL.LIST).then(setReports)
    }
    if (tab === 'Aktivität') {
      fetch(`/api/v1/events?entity_id=${id}&entity_type=project`).then((r) => r.json()).then(setActivity)
    }
  }, [tab, id])

  async function enterEditMode() {
    if (!project) return
    const [s, c, ct, f] = await Promise.all([
      cachedFetch<Status[]>('/api/v1/admin/statuses', TTL.REFERENCE),
      cachedFetch<Company[]>('/api/v1/companies', TTL.REFERENCE),
      cachedFetch<Contact[]>('/api/v1/contacts', TTL.REFERENCE),
      cachedFetch<FieldDef[]>('/api/v1/admin/custom-fields?entity_type=project', TTL.REFERENCE),
    ])
    setStatuses(s)
    setCompanies(c)
    setContactsList(ct)
    setFieldDefs(f)
    setEditForm({
      name: project.name,
      address: project.address ?? '',
      planned_hours: project.planned_hours ?? '',
      status_id: project.status_id ?? '',
      company_id: project.company_id ?? '',
      contact_id: project.contact_id ?? '',
    })
    setEditCustomProps(project.custom_properties ?? {})
    setSaveError(null)
    setEditMode(true)
  }

  async function handleSave() {
    setSaving(true)
    setSaveError(null)
    const res = await fetch(`/api/v1/projects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: editForm.name,
        address: editForm.address || undefined,
        planned_hours: editForm.planned_hours ? parseFloat(editForm.planned_hours) : 0,
        status_id: editForm.status_id || undefined,
        company_id: editForm.company_id || undefined,
        contact_id: editForm.contact_id || undefined,
        custom_properties: editCustomProps,
      }),
    })
    if (!res.ok) {
      const data = await res.json()
      setSaveError(data.error?.formErrors?.[0] ?? 'Fehler beim Speichern.')
      setSaving(false)
      return
    }
    const updated = await res.json()
    invalidate(`/api/v1/projects/${id}`, '/api/v1/projects')
    setProject(updated)
    setEditMode(false)
    setSaving(false)
  }

  async function handleAddReport() {
    setSubmitting(true)
    const res = await fetch(`/api/v1/projects/${id}/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ report_type: reportType, text_content: reportText }),
    })
    if (res.ok) {
      invalidate(`/api/v1/projects/${id}/reports`)
      const fresh = await cachedFetch<Report[]>(`/api/v1/projects/${id}/reports`, TTL.LIST)
      setReports(fresh)
    }
    setReportText('')
    setShowReportForm(false)
    setSubmitting(false)
  }

  function startEditReport(r: Report) {
    setEditingReportId(r.id)
    setEditReportType(r.report_type)
    setEditReportText(r.text_content ?? '')
  }

  async function handleSaveReport(reportId: string) {
    setSavingReport(true)
    const res = await fetch(`/api/v1/projects/${id}/reports/${reportId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ report_type: editReportType, text_content: editReportText }),
    })
    if (res.ok) {
      invalidate(`/api/v1/projects/${id}/reports`)
      const fresh = await cachedFetch<Report[]>(`/api/v1/projects/${id}/reports`, TTL.LIST)
      setReports(fresh)
    }
    setEditingReportId(null)
    setSavingReport(false)
  }

  async function handleDeleteReport(reportId: string) {
    if (!confirm('Bericht wirklich archivieren?')) return
    await fetch(`/api/v1/projects/${id}/reports/${reportId}`, { method: 'DELETE' })
    invalidate(`/api/v1/projects/${id}/reports`)
    setReports((prev) => prev.filter((r) => r.id !== reportId))
  }

  async function handleDelete() {
    if (!confirm(`Projekt "${project?.name}" wirklich archivieren?`)) return
    await fetch(`/api/v1/projects/${id}`, { method: 'DELETE' })
    invalidate('/api/v1/projects', `/api/v1/projects/${id}`)
    router.push('/projects')
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6 max-w-4xl">
        <div className="h-8 w-48 animate-pulse rounded bg-zinc-100" />
        <div className="h-64 animate-pulse rounded-lg bg-zinc-100" />
      </div>
    )
  }

  if (!project) {
    return <div className="text-sm text-zinc-500">Projekt nicht gefunden.</div>
  }

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div className="flex items-start justify-between">
        <PageHeader
          title={project.name}
          breadcrumb={
            <span className="flex items-center gap-1">
              <Link href="/projects" className="hover:text-zinc-600">Projekte</Link>
              <ChevronRight className="h-3 w-3" />
              {project.name}
            </span>
          }
        />
        <button
          onClick={handleDelete}
          className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Archivieren
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-zinc-200">
        <div className="flex gap-0">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setEditMode(false) }}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === t ? 'border-zinc-900 text-zinc-900' : 'border-transparent text-zinc-500 hover:text-zinc-700'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Overview – read mode */}
      {tab === 'Übersicht' && !editMode && (
        <div className="flex flex-col gap-4">
          <div className="flex justify-end">
            <button
              onClick={enterEditMode}
              className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" />
              Bearbeiten
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-zinc-200 bg-white p-5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">Details</h3>
              <dl className="space-y-2.5">
                <div className="flex justify-between text-sm">
                  <dt className="text-zinc-500">Status</dt>
                  <dd>
                    {project.status ? (
                      <StatusBadge label={project.status.label} color={project.status.color} />
                    ) : (
                      <span className="text-zinc-400">—</span>
                    )}
                  </dd>
                </div>
                <div className="flex justify-between text-sm">
                  <dt className="text-zinc-500">Adresse</dt>
                  <dd className="text-zinc-900 text-right max-w-[60%]">{project.address ?? '—'}</dd>
                </div>
                <div className="flex justify-between text-sm">
                  <dt className="text-zinc-500">Geplante Stunden</dt>
                  <dd className="text-zinc-900">{project.planned_hours ?? '0'} h</dd>
                </div>
                <div className="flex justify-between text-sm">
                  <dt className="text-zinc-500">Erstellt</dt>
                  <dd className="text-zinc-900">
                    {project.created_at ? new Date(project.created_at).toLocaleDateString('de-DE') : '—'}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="rounded-lg border border-zinc-200 bg-white p-5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">Auftraggeber</h3>
              {project.company ? (
                <div className="flex flex-col gap-1">
                  <Link href={`/companies/${project.company.id}`} className="text-sm font-medium text-zinc-900 hover:underline">
                    {project.company.name}
                  </Link>
                  <span className="text-xs text-zinc-400">Unternehmen</span>
                </div>
              ) : (
                <p className="text-sm text-zinc-400">Kein Auftraggeber zugeordnet.</p>
              )}
            </div>

            {Object.keys(project.custom_properties ?? {}).length > 0 && (
              <div className="sm:col-span-2 rounded-lg border border-zinc-200 bg-white p-5">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">Weitere Felder</h3>
                <dl className="grid grid-cols-2 gap-2.5">
                  {Object.entries(project.custom_properties).map(([k, v]) => (
                    <div key={k} className="flex flex-col gap-0.5">
                      <dt className="text-xs text-zinc-400 capitalize">{k.replace(/_/g, ' ')}</dt>
                      <dd className="text-sm text-zinc-900">{String(v)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Overview – edit mode */}
      {tab === 'Übersicht' && editMode && (
        <div className="flex flex-col gap-6">
          <div className="rounded-lg border border-zinc-200 bg-white p-6">
            <h3 className="text-sm font-semibold text-zinc-900 mb-4">Grunddaten</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2 flex flex-col gap-1.5">
                <label className="text-sm font-medium text-zinc-700">Projektname <span className="text-red-500">*</span></label>
                <input
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-zinc-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-900"
                />
              </div>
              <div className="sm:col-span-2 flex flex-col gap-1.5">
                <label className="text-sm font-medium text-zinc-700">Adresse</label>
                <input
                  value={editForm.address}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  placeholder="Straße, PLZ Stadt"
                  className="flex h-9 w-full rounded-md border border-zinc-200 bg-white px-3 py-1 text-sm shadow-sm placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-900"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-zinc-700">Status</label>
                <select
                  value={editForm.status_id}
                  onChange={(e) => setEditForm({ ...editForm, status_id: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-zinc-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-900"
                >
                  <option value="">Kein Status</option>
                  {statuses.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-zinc-700">Geplante Stunden</label>
                <input
                  type="number" min="0" step="0.5"
                  value={editForm.planned_hours}
                  onChange={(e) => setEditForm({ ...editForm, planned_hours: e.target.value })}
                  placeholder="0"
                  className="flex h-9 w-full rounded-md border border-zinc-200 bg-white px-3 py-1 text-sm shadow-sm placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-900"
                />
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-6">
            <h3 className="text-sm font-semibold text-zinc-900 mb-4">Auftraggeber</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-zinc-700">Unternehmen</label>
                <select
                  value={editForm.company_id}
                  onChange={(e) => setEditForm({ ...editForm, company_id: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-zinc-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-900"
                >
                  <option value="">Kein Unternehmen</option>
                  {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-zinc-700">Kontaktperson</label>
                <select
                  value={editForm.contact_id}
                  onChange={(e) => setEditForm({ ...editForm, contact_id: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-zinc-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-900"
                >
                  <option value="">Kein Kontakt</option>
                  {contactsList.map((c) => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
                </select>
              </div>
            </div>
          </div>

          {fieldDefs.length > 0 && (
            <div className="rounded-lg border border-zinc-200 bg-white p-6">
              <h3 className="text-sm font-semibold text-zinc-900 mb-4">Weitere Felder</h3>
              <CustomFieldsForm
                definitions={fieldDefs}
                values={editCustomProps}
                onChange={(name, val) => setEditCustomProps((p) => ({ ...p, [name]: val }))}
              />
            </div>
          )}

          {saveError && (
            <div className="rounded-md bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">{saveError}</div>
          )}

          <div className="flex items-center gap-3">
            <button onClick={handleSave} disabled={saving}
              className="inline-flex h-9 items-center rounded-md bg-zinc-900 px-6 text-sm font-medium text-white shadow hover:bg-zinc-800 disabled:opacity-50 transition-colors">
              {saving ? 'Wird gespeichert...' : 'Speichern'}
            </button>
            <button onClick={() => setEditMode(false)}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-zinc-200 px-4 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition-colors">
              <X className="h-3.5 w-3.5" />
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {/* Reports */}
      {tab === 'Berichte' && (
        <div className="flex flex-col gap-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowReportForm(!showReportForm)}
              className="inline-flex items-center gap-1.5 rounded-md bg-zinc-900 px-3.5 py-2 text-sm font-medium text-white shadow hover:bg-zinc-800 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Bericht hinzufügen
            </button>
          </div>

          {showReportForm && (
            <div className="rounded-lg border border-zinc-200 bg-white p-5 flex flex-col gap-4">
              <h3 className="text-sm font-semibold text-zinc-900">Neuer Bericht</h3>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-zinc-700">Typ</label>
                <select value={reportType} onChange={(e) => setReportType(e.target.value)}
                  className="flex h-9 rounded-md border border-zinc-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-900">
                  {REPORT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-zinc-700">Inhalt</label>
                <textarea value={reportText} onChange={(e) => setReportText(e.target.value)} rows={4}
                  placeholder="Beschreibung, Beobachtungen, Maßnahmen..."
                  className="flex w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-900 resize-none" />
              </div>
              <div className="flex gap-2">
                <button onClick={handleAddReport} disabled={submitting}
                  className="inline-flex h-9 items-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 transition-colors">
                  {submitting ? 'Wird gespeichert...' : 'Speichern'}
                </button>
                <button onClick={() => setShowReportForm(false)}
                  className="inline-flex h-9 items-center rounded-md border border-zinc-200 px-4 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition-colors">
                  Abbrechen
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3">
            {reports.length === 0 ? (
              <p className="py-8 text-center text-sm text-zinc-400">Noch keine Berichte vorhanden.</p>
            ) : (
              reports.map((r) => (
                <div key={r.id} className="rounded-lg border border-zinc-200 bg-white p-4">
                  {editingReportId === r.id ? (
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium text-zinc-700">Typ</label>
                        <select value={editReportType} onChange={(e) => setEditReportType(e.target.value)}
                          className="flex h-9 rounded-md border border-zinc-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-900">
                          {REPORT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium text-zinc-700">Inhalt</label>
                        <textarea value={editReportText} onChange={(e) => setEditReportText(e.target.value)} rows={4}
                          className="flex w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-900 resize-none" />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleSaveReport(r.id)} disabled={savingReport}
                          className="inline-flex h-8 items-center rounded-md bg-zinc-900 px-4 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50 transition-colors">
                          {savingReport ? 'Speichern...' : 'Speichern'}
                        </button>
                        <button onClick={() => setEditingReportId(null)}
                          className="inline-flex h-8 items-center rounded-md border border-zinc-200 px-3 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition-colors">
                          Abbrechen
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{r.report_type}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-zinc-400">
                            {r.created_at ? new Date(r.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                            {r.author?.full_name ? ` · ${r.author.full_name}` : ''}
                          </span>
                          <button onClick={() => startEditReport(r)}
                            className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-xs text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50 transition-colors">
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button onClick={() => handleDeleteReport(r.id)}
                            className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-xs text-zinc-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                      <p className="text-sm text-zinc-700 whitespace-pre-wrap">{r.text_content}</p>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Activity */}
      {tab === 'Aktivität' && (
        <div className="rounded-lg border border-zinc-200 bg-white p-5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-4">Aktivitätsverlauf</h3>
          <ActivityFeed events={activity} />
        </div>
      )}
    </div>
  )
}

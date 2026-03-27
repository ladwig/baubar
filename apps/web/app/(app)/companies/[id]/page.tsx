'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ChevronRight, Pencil, Trash2, X } from 'lucide-react'
import { PageHeader, CustomFieldsForm, StatusBadge, ActivityFeed } from '@baubar/ui'
import { cachedFetch, invalidate, TTL } from '@/lib/cache'

type Company = {
  id: string
  name: string
  address: string | null
  industry: string | null
  custom_properties: Record<string, unknown>
  created_at: string | null
}

type ContactRow = {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  contact_type: string | null
}

type ProjectRow = {
  id: string
  name: string
  address: string | null
  status: { label: string; color: string } | null
}

type ActivityEvent = {
  id: string
  event_type: string
  summary: string | null
  created_at: string
  actor: { id: string; full_name: string | null } | null
}

type FieldDef = { id: string; name: string; label: string; field_type: string; options?: string[] | null; sort_order?: number | null }

const TABS = ['Übersicht', 'Kontakte', 'Projekte', 'Aktivität'] as const
type Tab = (typeof TABS)[number]

export default function CompanyDetailPage() {
  const { id } = useParams() as { id: string }
  const router = useRouter()

  const [tab, setTab] = useState<Tab>('Übersicht')
  const [company, setCompany] = useState<Company | null>(null)
  const [contacts, setContacts] = useState<ContactRow[]>([])
  const [projects, setProjects] = useState<ProjectRow[]>([])
  const [activity, setActivity] = useState<ActivityEvent[]>([])
  const [loading, setLoading] = useState(true)

  // Edit mode
  const [editMode, setEditMode] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', address: '', industry: '' })
  const [editCustomProps, setEditCustomProps] = useState<Record<string, unknown>>({})
  const [fieldDefs, setFieldDefs] = useState<FieldDef[]>([])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    cachedFetch<Company>(`/api/v1/companies/${id}`, TTL.DETAIL)
      .then((d) => { setCompany(d); setLoading(false) })
  }, [id])

  useEffect(() => {
    if (tab === 'Kontakte') {
      cachedFetch<ContactRow[]>(`/api/v1/contacts?company_id=${id}`, TTL.LIST).then(setContacts)
    }
    if (tab === 'Projekte') {
      cachedFetch<ProjectRow[]>(`/api/v1/projects?company_id=${id}`, TTL.LIST).then(setProjects)
    }
    if (tab === 'Aktivität') {
      fetch(`/api/v1/events?entity_id=${id}&entity_type=company`).then((r) => r.json()).then(setActivity)
    }
  }, [tab, id])

  async function enterEditMode() {
    if (!company) return
    const f = await cachedFetch<FieldDef[]>('/api/v1/admin/custom-fields?entity_type=company', TTL.REFERENCE)
    setFieldDefs(f)
    setEditForm({ name: company.name, address: company.address ?? '', industry: company.industry ?? '' })
    setEditCustomProps(company.custom_properties ?? {})
    setSaveError(null)
    setEditMode(true)
  }

  async function handleSave() {
    setSaving(true)
    setSaveError(null)
    const res = await fetch(`/api/v1/companies/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: editForm.name,
        address: editForm.address || undefined,
        industry: editForm.industry || undefined,
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
    invalidate(`/api/v1/companies/${id}`, '/api/v1/companies')
    setCompany(updated)
    setEditMode(false)
    setSaving(false)
  }

  async function handleDelete() {
    if (!confirm(`Unternehmen "${company?.name}" wirklich archivieren?`)) return
    await fetch(`/api/v1/companies/${id}`, { method: 'DELETE' })
    invalidate('/api/v1/companies', `/api/v1/companies/${id}`)
    router.push('/companies')
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6 max-w-4xl">
        <div className="h-8 w-48 animate-pulse rounded bg-zinc-100" />
        <div className="h-64 animate-pulse rounded-lg bg-zinc-100" />
      </div>
    )
  }

  if (!company) return <div className="text-sm text-zinc-500">Unternehmen nicht gefunden.</div>

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div className="flex items-start justify-between">
        <PageHeader
          title={company.name}
          breadcrumb={
            <span className="flex items-center gap-1">
              <Link href="/companies" className="hover:text-zinc-600">Unternehmen</Link>
              <ChevronRight className="h-3 w-3" />
              {company.name}
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
                  <dt className="text-zinc-500">Branche</dt>
                  <dd className="text-zinc-900">{company.industry ?? '—'}</dd>
                </div>
                <div className="flex justify-between text-sm">
                  <dt className="text-zinc-500">Adresse</dt>
                  <dd className="text-zinc-900 text-right max-w-[60%]">{company.address ?? '—'}</dd>
                </div>
                <div className="flex justify-between text-sm">
                  <dt className="text-zinc-500">Erstellt</dt>
                  <dd className="text-zinc-900">
                    {company.created_at ? new Date(company.created_at).toLocaleDateString('de-DE') : '—'}
                  </dd>
                </div>
              </dl>
            </div>

            {Object.keys(company.custom_properties ?? {}).length > 0 && (
              <div className="sm:col-span-2 rounded-lg border border-zinc-200 bg-white p-5">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">Weitere Felder</h3>
                <dl className="grid grid-cols-2 gap-2.5">
                  {Object.entries(company.custom_properties).map(([k, v]) => (
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
                <label className="text-sm font-medium text-zinc-700">Name <span className="text-red-500">*</span></label>
                <input
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-zinc-200 bg-white px-3 py-1 text-sm shadow-sm placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-900"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-zinc-700">Branche</label>
                <input
                  value={editForm.industry}
                  onChange={(e) => setEditForm({ ...editForm, industry: e.target.value })}
                  placeholder="z.B. Architekturbüro"
                  className="flex h-9 w-full rounded-md border border-zinc-200 bg-white px-3 py-1 text-sm shadow-sm placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-900"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-zinc-700">Adresse</label>
                <input
                  value={editForm.address}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  placeholder="Straße, PLZ Stadt"
                  className="flex h-9 w-full rounded-md border border-zinc-200 bg-white px-3 py-1 text-sm shadow-sm placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-900"
                />
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
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex h-9 items-center rounded-md bg-zinc-900 px-6 text-sm font-medium text-white shadow hover:bg-zinc-800 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Wird gespeichert...' : 'Speichern'}
            </button>
            <button
              onClick={() => setEditMode(false)}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-zinc-200 px-4 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {/* Contacts tab */}
      {tab === 'Kontakte' && (
        <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden">
          {contacts.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-400">Keine Kontakte zugeordnet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-zinc-100 bg-zinc-50">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500">Name</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500">Typ</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500">E-Mail</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500">Telefon</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {contacts.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => router.push(`/contacts/${c.id}`)}
                    className="cursor-pointer hover:bg-zinc-50 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-zinc-900">{c.first_name} {c.last_name}</td>
                    <td className="px-4 py-3 text-zinc-500">{c.contact_type ?? '—'}</td>
                    <td className="px-4 py-3 text-zinc-500">{c.email ?? '—'}</td>
                    <td className="px-4 py-3 text-zinc-400">{c.phone ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Projects tab */}
      {tab === 'Projekte' && (
        <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden">
          {projects.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-400">Keine Projekte zugeordnet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-zinc-100 bg-zinc-50">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500">Projektname</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500">Status</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500">Adresse</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {projects.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => router.push(`/projects/${p.id}`)}
                    className="cursor-pointer hover:bg-zinc-50 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-zinc-900">{p.name}</td>
                    <td className="px-4 py-3">
                      {p.status ? (
                        <StatusBadge label={p.status.label} color={p.status.color} />
                      ) : (
                        <span className="text-zinc-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-500">{p.address ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Activity tab */}
      {tab === 'Aktivität' && (
        <div className="rounded-lg border border-zinc-200 bg-white p-5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-4">Aktivitätsverlauf</h3>
          <ActivityFeed events={activity} />
        </div>
      )}
    </div>
  )
}

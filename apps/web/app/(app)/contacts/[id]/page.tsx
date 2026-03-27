'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ChevronRight, Pencil, Trash2, X } from 'lucide-react'
import { PageHeader, CustomFieldsForm, StatusBadge, ActivityFeed } from '@baubar/ui'
import { cachedFetch, invalidate, TTL } from '@/lib/cache'

type Contact = {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  contact_type: string | null
  company_id: string | null
  custom_properties: Record<string, unknown>
  created_at: string | null
}

type Company = { id: string; name: string }

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

const CONTACT_TYPES = ['Architekt', 'Bauherr', 'Bauleiter', 'Planer', 'Privat', 'Sonstiges']
const TABS = ['Übersicht', 'Projekte', 'Aktivität'] as const
type Tab = (typeof TABS)[number]

export default function ContactDetailPage() {
  const { id } = useParams() as { id: string }
  const router = useRouter()

  const [tab, setTab] = useState<Tab>('Übersicht')
  const [contact, setContact] = useState<Contact | null>(null)
  const [projects, setProjects] = useState<ProjectRow[]>([])
  const [activity, setActivity] = useState<ActivityEvent[]>([])
  const [loading, setLoading] = useState(true)

  // Edit mode
  const [editMode, setEditMode] = useState(false)
  const [editForm, setEditForm] = useState({ first_name: '', last_name: '', email: '', phone: '', contact_type: '', company_id: '' })
  const [editCustomProps, setEditCustomProps] = useState<Record<string, unknown>>({})
  const [companies, setCompanies] = useState<Company[]>([])
  const [fieldDefs, setFieldDefs] = useState<FieldDef[]>([])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Company name for display
  const [companyName, setCompanyName] = useState<string | null>(null)

  useEffect(() => {
    cachedFetch<Contact>(`/api/v1/contacts/${id}`, TTL.DETAIL)
      .then((d) => { setContact(d); setLoading(false) })
  }, [id])

  useEffect(() => {
    if (contact?.company_id) {
      cachedFetch<{ name: string }>(`/api/v1/companies/${contact.company_id}`, TTL.REFERENCE)
        .then((c) => setCompanyName(c.name))
    }
  }, [contact?.company_id])

  useEffect(() => {
    if (tab === 'Projekte') {
      cachedFetch<ProjectRow[]>(`/api/v1/projects?contact_id=${id}`, TTL.LIST).then(setProjects)
    }
    if (tab === 'Aktivität') {
      fetch(`/api/v1/events?entity_id=${id}&entity_type=contact`).then((r) => r.json()).then(setActivity)
    }
  }, [tab, id])

  async function enterEditMode() {
    if (!contact) return
    const [c, f] = await Promise.all([
      cachedFetch<Company[]>('/api/v1/companies', TTL.REFERENCE),
      cachedFetch<FieldDef[]>('/api/v1/admin/custom-fields?entity_type=contact', TTL.REFERENCE),
    ])
    setCompanies(c)
    setFieldDefs(f)
    setEditForm({
      first_name: contact.first_name,
      last_name: contact.last_name,
      email: contact.email ?? '',
      phone: contact.phone ?? '',
      contact_type: contact.contact_type ?? '',
      company_id: contact.company_id ?? '',
    })
    setEditCustomProps(contact.custom_properties ?? {})
    setSaveError(null)
    setEditMode(true)
  }

  async function handleSave() {
    setSaving(true)
    setSaveError(null)
    const res = await fetch(`/api/v1/contacts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        first_name: editForm.first_name,
        last_name: editForm.last_name,
        email: editForm.email || undefined,
        phone: editForm.phone || undefined,
        contact_type: editForm.contact_type || undefined,
        company_id: editForm.company_id || undefined,
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
    invalidate(`/api/v1/contacts/${id}`, '/api/v1/contacts')
    setContact(updated)
    if (updated.company_id) {
      cachedFetch<{ name: string }>(`/api/v1/companies/${updated.company_id}`, TTL.REFERENCE)
        .then((c) => setCompanyName(c.name))
    } else {
      setCompanyName(null)
    }
    setEditMode(false)
    setSaving(false)
  }

  async function handleDelete() {
    if (!contact) return
    if (!confirm(`Kontakt "${contact.first_name} ${contact.last_name}" wirklich archivieren?`)) return
    await fetch(`/api/v1/contacts/${id}`, { method: 'DELETE' })
    invalidate('/api/v1/contacts', `/api/v1/contacts/${id}`)
    router.push('/contacts')
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6 max-w-4xl">
        <div className="h-8 w-48 animate-pulse rounded bg-zinc-100" />
        <div className="h-64 animate-pulse rounded-lg bg-zinc-100" />
      </div>
    )
  }

  if (!contact) return <div className="text-sm text-zinc-500">Kontakt nicht gefunden.</div>

  const fullName = `${contact.first_name} ${contact.last_name}`

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div className="flex items-start justify-between">
        <PageHeader
          title={fullName}
          breadcrumb={
            <span className="flex items-center gap-1">
              <Link href="/contacts" className="hover:text-zinc-600">Kontakte</Link>
              <ChevronRight className="h-3 w-3" />
              {fullName}
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
                  <dt className="text-zinc-500">Typ</dt>
                  <dd className="text-zinc-900">{contact.contact_type ?? '—'}</dd>
                </div>
                <div className="flex justify-between text-sm">
                  <dt className="text-zinc-500">E-Mail</dt>
                  <dd className="text-zinc-900">{contact.email ?? '—'}</dd>
                </div>
                <div className="flex justify-between text-sm">
                  <dt className="text-zinc-500">Telefon</dt>
                  <dd className="text-zinc-900">{contact.phone ?? '—'}</dd>
                </div>
                <div className="flex justify-between text-sm">
                  <dt className="text-zinc-500">Erstellt</dt>
                  <dd className="text-zinc-900">
                    {contact.created_at ? new Date(contact.created_at).toLocaleDateString('de-DE') : '—'}
                  </dd>
                </div>
              </dl>
            </div>

            {contact.company_id && (
              <div className="rounded-lg border border-zinc-200 bg-white p-5">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">Unternehmen</h3>
                <Link
                  href={`/companies/${contact.company_id}`}
                  className="text-sm font-medium text-zinc-900 hover:underline"
                >
                  {companyName ?? '…'}
                </Link>
              </div>
            )}

            {Object.keys(contact.custom_properties ?? {}).length > 0 && (
              <div className="sm:col-span-2 rounded-lg border border-zinc-200 bg-white p-5">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">Weitere Felder</h3>
                <dl className="grid grid-cols-2 gap-2.5">
                  {Object.entries(contact.custom_properties).map(([k, v]) => (
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
            <h3 className="text-sm font-semibold text-zinc-900 mb-4">Kontaktdaten</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-zinc-700">Vorname <span className="text-red-500">*</span></label>
                <input
                  required
                  value={editForm.first_name}
                  onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-zinc-200 bg-white px-3 py-1 text-sm shadow-sm placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-900"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-zinc-700">Nachname <span className="text-red-500">*</span></label>
                <input
                  required
                  value={editForm.last_name}
                  onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-zinc-200 bg-white px-3 py-1 text-sm shadow-sm placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-900"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-zinc-700">E-Mail</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  placeholder="max@beispiel.de"
                  className="flex h-9 w-full rounded-md border border-zinc-200 bg-white px-3 py-1 text-sm shadow-sm placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-900"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-zinc-700">Telefon (E.164)</label>
                <input
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  placeholder="+491234567890"
                  className="flex h-9 w-full rounded-md border border-zinc-200 bg-white px-3 py-1 text-sm shadow-sm placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-900"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-zinc-700">Typ</label>
                <select
                  value={editForm.contact_type}
                  onChange={(e) => setEditForm({ ...editForm, contact_type: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-zinc-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-900"
                >
                  <option value="">Kein Typ</option>
                  {CONTACT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
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

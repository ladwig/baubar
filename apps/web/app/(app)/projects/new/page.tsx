'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { PageHeader, CustomFieldsForm } from '@baubar/ui'

type Status = { id: string; label: string; color: string }
type Company = { id: string; name: string }
type Contact = { id: string; first_name: string; last_name: string }
type FieldDef = { id: string; name: string; label: string; field_type: string; options?: string[] | null; sort_order?: number | null }

export default function NewProjectPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [statuses, setStatuses] = useState<Status[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [fieldDefs, setFieldDefs] = useState<FieldDef[]>([])

  const [form, setForm] = useState({
    name: '',
    address: '',
    planned_hours: '',
    status_id: '',
    company_id: '',
    contact_id: '',
  })
  const [customProps, setCustomProps] = useState<Record<string, unknown>>({})

  useEffect(() => {
    Promise.all([
      fetch('/api/v1/admin/statuses').then((r) => r.json()),
      fetch('/api/v1/companies').then((r) => r.json()),
      fetch('/api/v1/contacts').then((r) => r.json()),
      fetch('/api/v1/admin/custom-fields?entity_type=project').then((r) => r.json()),
    ]).then(([s, c, ct, f]) => {
      setStatuses(s)
      setCompanies(c)
      setContacts(ct)
      setFieldDefs(f)
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const payload = {
      name: form.name,
      address: form.address || undefined,
      planned_hours: form.planned_hours ? parseFloat(form.planned_hours) : 0,
      status_id: form.status_id || undefined,
      company_id: form.company_id || undefined,
      contact_id: form.contact_id || undefined,
      custom_properties: customProps,
    }

    const res = await fetch('/api/v1/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error?.formErrors?.[0] ?? 'Fehler beim Erstellen')
      setLoading(false)
      return
    }

    const project = await res.json()
    router.push(`/projects/${project.id}`)
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <PageHeader
        title="Neues Projekt"
        breadcrumb={
          <span className="flex items-center gap-1">
            <Link href="/projects" className="hover:text-zinc-600 transition-colors">Projekte</Link>
            <ChevronRight className="h-3 w-3" />
            Neu
          </span>
        }
      />

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div className="rounded-lg border border-zinc-200 bg-white p-6">
          <h3 className="text-sm font-semibold text-zinc-900 mb-4">Grunddaten</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 flex flex-col gap-1.5">
              <label htmlFor="name" className="text-sm font-medium text-zinc-700">
                Projektname <span className="text-red-500">*</span>
              </label>
              <input
                id="name"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="z.B. Neubau Mehrfamilienhaus Musterstraße"
                className="flex h-9 w-full rounded-md border border-zinc-200 bg-white px-3 py-1 text-sm shadow-sm placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-900"
              />
            </div>

            <div className="sm:col-span-2 flex flex-col gap-1.5">
              <label htmlFor="address" className="text-sm font-medium text-zinc-700">Adresse</label>
              <input
                id="address"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Straße, PLZ Stadt"
                className="flex h-9 w-full rounded-md border border-zinc-200 bg-white px-3 py-1 text-sm shadow-sm placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-900"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="status_id" className="text-sm font-medium text-zinc-700">Status</label>
              <select
                id="status_id"
                value={form.status_id}
                onChange={(e) => setForm({ ...form, status_id: e.target.value })}
                className="flex h-9 w-full rounded-md border border-zinc-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-900"
              >
                <option value="">Kein Status</option>
                {statuses.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="planned_hours" className="text-sm font-medium text-zinc-700">Geplante Stunden</label>
              <input
                id="planned_hours"
                type="number"
                min="0"
                step="0.5"
                value={form.planned_hours}
                onChange={(e) => setForm({ ...form, planned_hours: e.target.value })}
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
              <label htmlFor="company_id" className="text-sm font-medium text-zinc-700">Unternehmen</label>
              <select
                id="company_id"
                value={form.company_id}
                onChange={(e) => setForm({ ...form, company_id: e.target.value })}
                className="flex h-9 w-full rounded-md border border-zinc-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-900"
              >
                <option value="">Kein Unternehmen</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="contact_id" className="text-sm font-medium text-zinc-700">Kontaktperson</label>
              <select
                id="contact_id"
                value={form.contact_id}
                onChange={(e) => setForm({ ...form, contact_id: e.target.value })}
                className="flex h-9 w-full rounded-md border border-zinc-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-900"
              >
                <option value="">Kein Kontakt</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>
                ))}
              </select>
            </div>
            <p className="sm:col-span-2 text-xs text-zinc-400">
              Mindestens Unternehmen oder Kontaktperson muss angegeben werden.
            </p>
          </div>
        </div>

        {fieldDefs.length > 0 && (
          <div className="rounded-lg border border-zinc-200 bg-white p-6">
            <h3 className="text-sm font-semibold text-zinc-900 mb-4">Weitere Felder</h3>
            <CustomFieldsForm
              definitions={fieldDefs}
              values={customProps}
              onChange={(name, val) => setCustomProps((p) => ({ ...p, [name]: val }))}
            />
          </div>
        )}

        {error && (
          <div className="rounded-md bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex h-9 items-center justify-center rounded-md bg-zinc-900 px-6 text-sm font-medium text-white shadow hover:bg-zinc-800 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Wird erstellt...' : 'Projekt erstellen'}
          </button>
          <Link
            href="/projects"
            className="inline-flex h-9 items-center justify-center rounded-md border border-zinc-200 px-4 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition-colors"
          >
            Abbrechen
          </Link>
        </div>
      </form>
    </div>
  )
}

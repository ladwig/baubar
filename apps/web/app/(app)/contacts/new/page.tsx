'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { PageHeader, CustomFieldsForm } from '@baubar/ui'
import { invalidate } from '@/lib/cache'

type Company = { id: string; name: string }
type FieldDef = { id: string; name: string; label: string; field_type: string; options?: string[] | null; sort_order?: number | null }

const CONTACT_TYPES = ['Architekt', 'Bauherr', 'Bauleiter', 'Planer', 'Privat', 'Sonstiges']

export default function NewContactPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [companies, setCompanies] = useState<Company[]>([])
  const [fieldDefs, setFieldDefs] = useState<FieldDef[]>([])
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '', contact_type: '', company_id: '' })
  const [customProps, setCustomProps] = useState<Record<string, unknown>>({})

  useEffect(() => {
    Promise.all([
      fetch('/api/v1/companies').then((r) => r.json()),
      fetch('/api/v1/admin/custom-fields?entity_type=contact').then((r) => r.json()),
    ]).then(([c, f]) => { setCompanies(c); setFieldDefs(f) })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const payload = {
      ...form,
      phone: form.phone || undefined,
      email: form.email || undefined,
      company_id: form.company_id || undefined,
      custom_properties: customProps,
    }

    const res = await fetch('/api/v1/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error?.formErrors?.[0] ?? 'Fehler beim Erstellen.')
      setLoading(false)
      return
    }

    const contact = await res.json()
    invalidate('/api/v1/contacts')
    router.push(`/contacts/${contact.id}`)
  }

  const field = (id: keyof typeof form, label: string, required = false, placeholder = '') => (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-zinc-700">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input id={id} required={required} value={form[id]}
        onChange={(e) => setForm({ ...form, [id]: e.target.value })}
        placeholder={placeholder}
        className="flex h-9 w-full rounded-md border border-zinc-200 bg-white px-3 py-1 text-sm shadow-sm placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-900" />
    </div>
  )

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <PageHeader
        title="Neuer Kontakt"
        breadcrumb={
          <span className="flex items-center gap-1">
            <Link href="/contacts" className="hover:text-zinc-600">Kontakte</Link>
            <ChevronRight className="h-3 w-3" />
            Neu
          </span>
        }
      />

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div className="rounded-lg border border-zinc-200 bg-white p-6">
          <h3 className="text-sm font-semibold text-zinc-900 mb-4">Kontaktdaten</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {field('first_name', 'Vorname', true, 'Max')}
            {field('last_name', 'Nachname', true, 'Mustermann')}
            {field('email', 'E-Mail', false, 'max@beispiel.de')}
            {field('phone', 'Telefon (E.164)', false, '+491234567890')}

            <div className="flex flex-col gap-1.5">
              <label htmlFor="contact_type" className="text-sm font-medium text-zinc-700">Typ</label>
              <select id="contact_type" value={form.contact_type} onChange={(e) => setForm({ ...form, contact_type: e.target.value })}
                className="flex h-9 w-full rounded-md border border-zinc-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-900">
                <option value="">Kein Typ</option>
                {CONTACT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="company_id" className="text-sm font-medium text-zinc-700">Unternehmen</label>
              <select id="company_id" value={form.company_id} onChange={(e) => setForm({ ...form, company_id: e.target.value })}
                className="flex h-9 w-full rounded-md border border-zinc-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-900">
                <option value="">Kein Unternehmen</option>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
        </div>

        {fieldDefs.length > 0 && (
          <div className="rounded-lg border border-zinc-200 bg-white p-6">
            <h3 className="text-sm font-semibold text-zinc-900 mb-4">Weitere Felder</h3>
            <CustomFieldsForm definitions={fieldDefs} values={customProps} onChange={(n, v) => setCustomProps((p) => ({ ...p, [n]: v }))} />
          </div>
        )}

        {error && <div className="rounded-md bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">{error}</div>}

        <div className="flex items-center gap-3">
          <button type="submit" disabled={loading}
            className="inline-flex h-9 items-center rounded-md bg-zinc-900 px-6 text-sm font-medium text-white shadow hover:bg-zinc-800 disabled:opacity-50 transition-colors">
            {loading ? 'Wird erstellt...' : 'Kontakt erstellen'}
          </button>
          <Link href="/contacts"
            className="inline-flex h-9 items-center rounded-md border border-zinc-200 px-4 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition-colors">
            Abbrechen
          </Link>
        </div>
      </form>
    </div>
  )
}

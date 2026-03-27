'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { PageHeader, CustomFieldsForm } from '@baubar/ui'

type FieldDef = { id: string; name: string; label: string; field_type: string; options?: string[] | null; sort_order?: number | null }

export default function NewCompanyPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldDefs, setFieldDefs] = useState<FieldDef[]>([])
  const [form, setForm] = useState({ name: '', address: '', industry: '' })
  const [customProps, setCustomProps] = useState<Record<string, unknown>>({})

  useEffect(() => {
    fetch('/api/v1/admin/custom-fields?entity_type=company').then((r) => r.json()).then(setFieldDefs)
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const res = await fetch('/api/v1/companies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, custom_properties: customProps }),
    })

    if (!res.ok) {
      setError('Fehler beim Erstellen.')
      setLoading(false)
      return
    }

    const company = await res.json()
    router.push(`/companies/${company.id}`)
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <PageHeader
        title="Neues Unternehmen"
        breadcrumb={
          <span className="flex items-center gap-1">
            <Link href="/companies" className="hover:text-zinc-600">Unternehmen</Link>
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
                Name <span className="text-red-500">*</span>
              </label>
              <input id="name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Muster GmbH"
                className="flex h-9 w-full rounded-md border border-zinc-200 bg-white px-3 py-1 text-sm shadow-sm placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-900" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="industry" className="text-sm font-medium text-zinc-700">Branche</label>
              <input id="industry" value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })}
                placeholder="z.B. Architekturbüro"
                className="flex h-9 w-full rounded-md border border-zinc-200 bg-white px-3 py-1 text-sm shadow-sm placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-900" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="address" className="text-sm font-medium text-zinc-700">Adresse</label>
              <input id="address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Straße, PLZ Stadt"
                className="flex h-9 w-full rounded-md border border-zinc-200 bg-white px-3 py-1 text-sm shadow-sm placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-900" />
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
            {loading ? 'Wird erstellt...' : 'Unternehmen erstellen'}
          </button>
          <Link href="/companies"
            className="inline-flex h-9 items-center rounded-md border border-zinc-200 px-4 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition-colors">
            Abbrechen
          </Link>
        </div>
      </form>
    </div>
  )
}

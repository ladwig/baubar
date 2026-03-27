'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ChevronRight, Trash2 } from 'lucide-react'
import { PageHeader } from '@baubar/ui'

type Company = {
  id: string; name: string; address: string | null; industry: string | null
  custom_properties: Record<string, unknown>; created_at: string | null
}

export default function CompanyDetailPage() {
  const { id } = useParams() as { id: string }
  const router = useRouter()
  const [company, setCompany] = useState<Company | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/v1/companies/${id}`).then((r) => r.json()).then((d) => { setCompany(d); setLoading(false) })
  }, [id])

  async function handleDelete() {
    if (!confirm(`Unternehmen "${company?.name}" wirklich deaktivieren?`)) return
    await fetch(`/api/v1/companies/${id}`, { method: 'DELETE' })
    router.push('/companies')
  }

  if (loading) return <div className="h-48 animate-pulse rounded-lg bg-zinc-100" />
  if (!company) return <div className="text-sm text-zinc-500">Unternehmen nicht gefunden.</div>

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
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
        <button onClick={handleDelete}
          className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600 transition-colors">
          <Trash2 className="h-3.5 w-3.5" />
          Deaktivieren
        </button>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-5">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">Details</h3>
        <dl className="space-y-2.5">
          {[
            ['Branche', company.industry],
            ['Adresse', company.address],
            ['Erstellt', company.created_at ? new Date(company.created_at).toLocaleDateString('de-DE') : null],
          ].map(([label, value]) => (
            <div key={label as string} className="flex justify-between text-sm">
              <dt className="text-zinc-500">{label}</dt>
              <dd className="text-zinc-900">{value ?? '—'}</dd>
            </div>
          ))}
        </dl>
      </div>

      {Object.keys(company.custom_properties ?? {}).length > 0 && (
        <div className="rounded-lg border border-zinc-200 bg-white p-5">
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
  )
}

'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ChevronRight, Trash2 } from 'lucide-react'
import { PageHeader } from '@baubar/ui'

type Contact = {
  id: string; first_name: string; last_name: string
  email: string | null; phone: string | null; contact_type: string | null
  company_id: string | null; custom_properties: Record<string, unknown>; created_at: string | null
}

export default function ContactDetailPage() {
  const { id } = useParams() as { id: string }
  const router = useRouter()
  const [contact, setContact] = useState<Contact | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/v1/contacts/${id}`).then((r) => r.json()).then((d) => { setContact(d); setLoading(false) })
  }, [id])

  async function handleDelete() {
    if (!confirm(`Kontakt "${contact?.first_name} ${contact?.last_name}" wirklich deaktivieren?`)) return
    await fetch(`/api/v1/contacts/${id}`, { method: 'DELETE' })
    router.push('/contacts')
  }

  if (loading) return <div className="h-48 animate-pulse rounded-lg bg-zinc-100" />
  if (!contact) return <div className="text-sm text-zinc-500">Kontakt nicht gefunden.</div>

  const fullName = `${contact.first_name} ${contact.last_name}`

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
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
            ['Typ', contact.contact_type],
            ['E-Mail', contact.email],
            ['Telefon', contact.phone],
            ['Erstellt', contact.created_at ? new Date(contact.created_at).toLocaleDateString('de-DE') : null],
          ].map(([label, value]) => (
            <div key={label as string} className="flex justify-between text-sm">
              <dt className="text-zinc-500">{label}</dt>
              <dd className="text-zinc-900">{value ?? '—'}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}

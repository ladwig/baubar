'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable, DataTableToolbar } from '@baubar/ui'
import { cachedFetch, TTL } from '@/lib/cache'

type FieldDef = { id: string; name: string; label: string }
type ContactRow = {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  contact_type: string | null
  custom_properties: Record<string, unknown> | null
  created_at: string | null
  company: { id: string; name: string } | null
}

export function ContactsTable() {
  const router = useRouter()
  const [data, setData] = useState<ContactRow[]>([])
  const [fieldDefs, setFieldDefs] = useState<FieldDef[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    cachedFetch<FieldDef[]>('/api/v1/admin/custom-fields?entity_type=contact', TTL.REFERENCE).then(setFieldDefs)
  }, [])

  useEffect(() => {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    setLoading(true)
    cachedFetch<ContactRow[]>(`/api/v1/contacts?${params}`, TTL.LIST)
      .then(setData)
      .finally(() => setLoading(false))
  }, [search])

  const columns = useMemo<ColumnDef<ContactRow>[]>(() => [
    {
      id: 'name',
      header: 'Name',
      cell: ({ row }) => (
        <span className="font-medium text-zinc-900">
          {row.original.first_name} {row.original.last_name}
        </span>
      ),
    },
    {
      id: 'company',
      header: 'Unternehmen',
      cell: ({ row }) => <span className="text-zinc-500">{row.original.company?.name ?? '—'}</span>,
    },
    {
      accessorKey: 'contact_type',
      header: 'Typ',
      cell: ({ row }) => <span className="text-zinc-500">{row.original.contact_type ?? '—'}</span>,
    },
    {
      accessorKey: 'email',
      header: 'E-Mail',
      cell: ({ row }) => <span className="text-zinc-500 text-xs">{row.original.email ?? '—'}</span>,
    },
    {
      accessorKey: 'phone',
      header: 'Telefon',
      cell: ({ row }) => <span className="text-zinc-400 text-xs">{row.original.phone ?? '—'}</span>,
    },
    ...fieldDefs.map<ColumnDef<ContactRow>>((def) => ({
      id: `custom_${def.name}`,
      header: def.label,
      cell: ({ row }) => {
        const val = row.original.custom_properties?.[def.name]
        return <span className="text-zinc-500 text-xs">{val != null ? String(val) : '—'}</span>
      },
    })),
  ], [fieldDefs])

  return (
    <DataTable
      columns={columns}
      data={data}
      isLoading={loading}
      onRowClick={(row) => router.push(`/contacts/${row.id}`)}
      emptyMessage="Keine Kontakte gefunden."
      toolbar={
        <DataTableToolbar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Kontakte suchen..."
        />
      }
    />
  )
}

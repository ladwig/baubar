'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable, DataTableToolbar } from '@baubar/ui'

type ContactRow = {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  contact_type: string | null
  created_at: string | null
  company: { id: string; name: string } | null
}

const columns: ColumnDef<ContactRow>[] = [
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
    cell: ({ row }) => (
      <span className="text-zinc-500">{row.original.company?.name ?? '—'}</span>
    ),
  },
  {
    accessorKey: 'contact_type',
    header: 'Typ',
    cell: ({ row }) => (
      <span className="text-zinc-500">{row.original.contact_type ?? '—'}</span>
    ),
  },
  {
    accessorKey: 'email',
    header: 'E-Mail',
    cell: ({ row }) => (
      <span className="text-zinc-500 text-xs">{row.original.email ?? '—'}</span>
    ),
  },
  {
    accessorKey: 'phone',
    header: 'Telefon',
    cell: ({ row }) => (
      <span className="text-zinc-400 text-xs">{row.original.phone ?? '—'}</span>
    ),
  },
]

export function ContactsTable() {
  const router = useRouter()
  const [data, setData] = useState<ContactRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    setLoading(true)
    fetch(`/api/v1/contacts?${params}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false))
  }, [search])

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

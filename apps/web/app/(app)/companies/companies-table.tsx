'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable, DataTableToolbar } from '@baubar/ui'

type CompanyRow = {
  id: string
  name: string
  industry: string | null
  address: string | null
  created_at: string | null
}

const columns: ColumnDef<CompanyRow>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => (
      <span className="font-medium text-zinc-900">{row.original.name}</span>
    ),
  },
  {
    accessorKey: 'industry',
    header: 'Branche',
    cell: ({ row }) => (
      <span className="text-zinc-500">{row.original.industry ?? '—'}</span>
    ),
  },
  {
    accessorKey: 'address',
    header: 'Adresse',
    cell: ({ row }) => (
      <span className="text-zinc-500 text-xs">{row.original.address ?? '—'}</span>
    ),
  },
  {
    accessorKey: 'created_at',
    header: 'Erstellt',
    cell: ({ row }) => (
      <span className="text-zinc-400 text-xs">
        {row.original.created_at
          ? new Date(row.original.created_at).toLocaleDateString('de-DE')
          : '—'}
      </span>
    ),
  },
]

export function CompaniesTable() {
  const router = useRouter()
  const [data, setData] = useState<CompanyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    const params = new URLSearchParams()
    if (search) params.set('search', search)

    setLoading(true)
    fetch(`/api/v1/companies?${params}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false))
  }, [search])

  return (
    <DataTable
      columns={columns}
      data={data}
      isLoading={loading}
      onRowClick={(row) => router.push(`/companies/${row.id}`)}
      emptyMessage="Keine Unternehmen gefunden."
      toolbar={
        <DataTableToolbar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Unternehmen suchen..."
        />
      }
    />
  )
}

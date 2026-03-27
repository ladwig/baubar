'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable, DataTableToolbar } from '@baubar/ui'
import { cachedFetch, TTL } from '@/lib/cache'

type FieldDef = { id: string; name: string; label: string }
type CompanyRow = {
  id: string
  name: string
  industry: string | null
  address: string | null
  custom_properties: Record<string, unknown> | null
  created_at: string | null
}

export function CompaniesTable() {
  const router = useRouter()
  const [data, setData] = useState<CompanyRow[]>([])
  const [fieldDefs, setFieldDefs] = useState<FieldDef[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    cachedFetch<FieldDef[]>('/api/v1/admin/custom-fields?entity_type=company', TTL.REFERENCE).then(setFieldDefs)
  }, [])

  useEffect(() => {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    setLoading(true)
    cachedFetch<CompanyRow[]>(`/api/v1/companies?${params}`, TTL.LIST)
      .then(setData)
      .finally(() => setLoading(false))
  }, [search])

  const columns = useMemo<ColumnDef<CompanyRow>[]>(() => [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => <span className="font-medium text-zinc-900">{row.original.name}</span>,
    },
    {
      accessorKey: 'industry',
      header: 'Branche',
      cell: ({ row }) => <span className="text-zinc-500">{row.original.industry ?? '—'}</span>,
    },
    {
      accessorKey: 'address',
      header: 'Adresse',
      cell: ({ row }) => <span className="text-zinc-500 text-xs">{row.original.address ?? '—'}</span>,
    },
    ...fieldDefs.map<ColumnDef<CompanyRow>>((def) => ({
      id: `custom_${def.name}`,
      header: def.label,
      cell: ({ row }) => {
        const val = row.original.custom_properties?.[def.name]
        return <span className="text-zinc-500 text-xs">{val != null ? String(val) : '—'}</span>
      },
    })),
    {
      accessorKey: 'created_at',
      header: 'Erstellt',
      cell: ({ row }) => (
        <span className="text-zinc-400 text-xs">
          {row.original.created_at ? new Date(row.original.created_at).toLocaleDateString('de-DE') : '—'}
        </span>
      ),
    },
  ], [fieldDefs])

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

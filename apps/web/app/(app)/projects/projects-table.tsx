'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable, DataTableToolbar, StatusBadge } from '@baubar/ui'
import { cachedFetch, invalidate, TTL } from '@/lib/cache'

type FieldDef = { id: string; name: string; label: string }
type ProjectRow = {
  id: string
  name: string
  address: string | null
  planned_hours: string | null
  custom_properties: Record<string, unknown> | null
  created_at: string | null
  status: { id: string; label: string; color: string; status_type: string } | null
  company: { id: string; name: string } | null
}

export function ProjectsTable() {
  const router = useRouter()
  const [data, setData] = useState<ProjectRow[]>([])
  const [fieldDefs, setFieldDefs] = useState<FieldDef[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  useEffect(() => {
    cachedFetch<FieldDef[]>('/api/v1/admin/custom-fields?entity_type=project', TTL.REFERENCE).then(setFieldDefs)
  }, [])

  useEffect(() => {
    const params = new URLSearchParams()
    if (statusFilter) params.set('status_type', statusFilter)
    if (search) params.set('search', search)

    setLoading(true)
    cachedFetch<ProjectRow[]>(`/api/v1/projects?${params}`, TTL.LIST)
      .then(setData)
      .finally(() => setLoading(false))
  }, [search, statusFilter])

  const columns = useMemo<ColumnDef<ProjectRow>[]>(() => [
    {
      accessorKey: 'name',
      header: 'Projektname',
      cell: ({ row }) => <span className="font-medium text-zinc-900">{row.original.name}</span>,
    },
    {
      id: 'client',
      header: 'Auftraggeber',
      cell: ({ row }) => <span className="text-zinc-600">{row.original.company?.name ?? '—'}</span>,
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) =>
        row.original.status ? (
          <StatusBadge label={row.original.status.label} color={row.original.status.color} />
        ) : (
          <span className="text-zinc-400 text-xs">Kein Status</span>
        ),
    },
    {
      accessorKey: 'address',
      header: 'Adresse',
      cell: ({ row }) => <span className="text-zinc-500 text-xs">{row.original.address ?? '—'}</span>,
    },
    ...fieldDefs.map<ColumnDef<ProjectRow>>((def) => ({
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
      onRowClick={(row) => router.push(`/projects/${row.id}`)}
      emptyMessage="Keine Projekte gefunden. Legen Sie ein neues Projekt an."
      toolbar={
        <DataTableToolbar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Projekte suchen..."
          filters={
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-600 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-900"
            >
              <option value="">Alle Status</option>
              <option value="OPEN">Offen</option>
              <option value="IN_PROGRESS">In Arbeit</option>
              <option value="WAITING">Wartend</option>
              <option value="BLOCKED">Blockiert</option>
              <option value="DONE">Abgeschlossen</option>
            </select>
          }
        />
      }
    />
  )
}

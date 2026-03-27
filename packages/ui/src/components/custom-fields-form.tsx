'use client'

import * as React from 'react'
import { Input } from './input'
import { Label } from './label'
import { cn } from '../lib/utils'

interface CustomFieldDefinition {
  id: string
  name: string
  label: string
  field_type: string
  options?: string[] | null
  sort_order?: number | null
}

interface CustomFieldsFormProps {
  definitions: CustomFieldDefinition[]
  values: Record<string, unknown>
  onChange: (name: string, value: unknown) => void
  className?: string
}

export function CustomFieldsForm({
  definitions,
  values,
  onChange,
  className,
}: CustomFieldsFormProps) {
  if (definitions.length === 0) return null

  const sorted = [...definitions].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))

  return (
    <div className={cn('grid gap-4 sm:grid-cols-2', className)}>
      {sorted.map((def) => {
        const value = values[def.name]

        if (def.field_type === 'boolean') {
          return (
            <div key={def.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                id={def.name}
                checked={Boolean(value)}
                onChange={(e) => onChange(def.name, e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
              />
              <Label htmlFor={def.name}>{def.label}</Label>
            </div>
          )
        }

        if (def.field_type === 'select' && def.options) {
          return (
            <div key={def.id} className="flex flex-col gap-1.5">
              <Label htmlFor={def.name}>{def.label}</Label>
              <select
                id={def.name}
                value={String(value ?? '')}
                onChange={(e) => onChange(def.name, e.target.value)}
                className="flex h-9 w-full rounded-md border border-zinc-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-900"
              >
                <option value="">Bitte wählen...</option>
                {def.options.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          )
        }

        return (
          <div key={def.id} className="flex flex-col gap-1.5">
            <Label htmlFor={def.name}>{def.label}</Label>
            <Input
              id={def.name}
              type={def.field_type === 'number' ? 'number' : def.field_type === 'date' ? 'date' : 'text'}
              value={String(value ?? '')}
              onChange={(e) => {
                const v = def.field_type === 'number' ? Number(e.target.value) : e.target.value
                onChange(def.name, v)
              }}
              placeholder={`${def.label} eingeben...`}
            />
          </div>
        )
      })}
    </div>
  )
}

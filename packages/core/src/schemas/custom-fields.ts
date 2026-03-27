import { z } from 'zod'
import type { CustomFieldDefinition } from '@baubar/db'

export function buildCustomPropertiesSchema(definitions: CustomFieldDefinition[]) {
  const shape = Object.fromEntries(
    definitions.map((def) => {
      const baseSchema =
        def.field_type === 'number'
          ? z.number()
          : def.field_type === 'boolean'
            ? z.boolean()
            : def.field_type === 'date'
              ? z.string().date()
              : def.field_type === 'select'
                ? z.enum(def.options as [string, ...string[]])
                : z.string()
      return [def.name, baseSchema.optional()]
    })
  )
  return z.object(shape).default({})
}

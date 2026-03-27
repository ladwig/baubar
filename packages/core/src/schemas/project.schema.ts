import { z } from 'zod'

export const createProjectSchema = (customSchema = z.object({}).default({})) =>
  z.object({
    name: z.string().min(1, 'Name ist erforderlich'),
    address: z.string().optional(),
    planned_hours: z.union([z.number(), z.string()]).transform(String).optional(),
    status_id: z.string().uuid().optional(),
    company_id: z.string().uuid().optional(),
    contact_id: z.string().uuid().optional(),
    custom_properties: customSchema,
  })

export const updateProjectSchema = (customSchema = z.object({}).default({})) =>
  z.object({
    name: z.string().min(1).optional(),
    address: z.string().optional(),
    planned_hours: z.union([z.number(), z.string()]).transform(String).optional(),
    status_id: z.string().uuid().nullable().optional(),
    company_id: z.string().uuid().nullable().optional(),
    contact_id: z.string().uuid().nullable().optional(),
    custom_properties: customSchema.optional(),
  })

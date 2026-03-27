import { z } from 'zod'

export const createCompanySchema = (customSchema = z.object({}).default({})) =>
  z.object({
    name: z.string().min(1, 'Name ist erforderlich'),
    address: z.string().optional(),
    industry: z.string().optional(),
    custom_properties: customSchema,
  })

export const updateCompanySchema = (customSchema = z.object({}).default({})) =>
  z.object({
    name: z.string().min(1).optional(),
    address: z.string().optional(),
    industry: z.string().optional(),
    custom_properties: customSchema.optional(),
  })

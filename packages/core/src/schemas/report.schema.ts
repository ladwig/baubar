import { z } from 'zod'

export const createReportSchema = (customSchema = z.object({}).default({})) =>
  z.object({
    report_type: z.string().min(1, 'Berichtstyp ist erforderlich'),
    text_content: z.string().optional(),
    custom_properties: customSchema,
  })

export const updateReportSchema = (customSchema = z.object({}).default({})) =>
  z.object({
    text_content: z.string().optional(),
    custom_properties: customSchema.optional(),
  })

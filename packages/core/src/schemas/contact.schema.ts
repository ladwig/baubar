import { z } from 'zod'

const e164Phone = z
  .string()
  .regex(/^\+[1-9]\d{6,14}$/, 'Telefonnummer muss im E.164-Format sein (z.B. +491234567890)')
  .optional()

export const createContactSchema = (customSchema = z.object({}).default({})) =>
  z.object({
    first_name: z.string().min(1, 'Vorname ist erforderlich'),
    last_name: z.string().min(1, 'Nachname ist erforderlich'),
    email: z.string().email().optional(),
    phone: e164Phone,
    contact_type: z.string().optional(),
    company_id: z.string().uuid().optional(),
    custom_properties: customSchema,
  })

export const updateContactSchema = (customSchema = z.object({}).default({})) =>
  z.object({
    first_name: z.string().min(1).optional(),
    last_name: z.string().min(1).optional(),
    email: z.string().email().optional(),
    phone: e164Phone,
    contact_type: z.string().optional(),
    company_id: z.string().uuid().nullable().optional(),
    custom_properties: customSchema.optional(),
  })

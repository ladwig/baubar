import { pgSchema, pgEnum } from 'drizzle-orm/pg-core'
import {
  uuid,
  text,
  boolean,
  integer,
  decimal,
  jsonb,
  timestamp,
} from 'drizzle-orm/pg-core'

export const pm = pgSchema('project_management')

// ─── Enums ───────────────────────────────────────────────────────────────────
export const statusTypeEnum = pm.enum('status_type', [
  'OPEN',
  'IN_PROGRESS',
  'WAITING',
  'BLOCKED',
  'DONE',
])

// ─── Organizations ────────────────────────────────────────────────────────────
export const organizations = pm.table('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  deleted_at: timestamp('deleted_at', { withTimezone: true }),
})

// ─── Users ────────────────────────────────────────────────────────────────────
export const users = pm.table('users', {
  id: uuid('id').primaryKey(),
  full_name: text('full_name'),
  avatar_url: text('avatar_url'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

// ─── Org Members ─────────────────────────────────────────────────────────────
export const orgMembers = pm.table('org_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  user_id: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  role: text('role').notNull().default('worker'),
  deleted_at: timestamp('deleted_at', { withTimezone: true }),
})

// ─── Project Statuses ─────────────────────────────────────────────────────────
export const projectStatuses = pm.table('project_statuses', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  label: text('label').notNull(),
  status_type: statusTypeEnum('status_type').notNull(),
  color: text('color').default('#6B7280'),
  sort_order: integer('sort_order').default(0),
  is_default: boolean('is_default').default(false),
  deleted_at: timestamp('deleted_at', { withTimezone: true }),
})

// ─── Custom Field Definitions ─────────────────────────────────────────────────
export const customFieldDefinitions = pm.table('custom_field_definitions', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  entity_type: text('entity_type').notNull(),
  name: text('name').notNull(),
  label: text('label').notNull(),
  field_type: text('field_type').notNull(),
  options: jsonb('options'),
  sort_order: integer('sort_order').default(0),
  deleted_at: timestamp('deleted_at', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

// ─── Companies ────────────────────────────────────────────────────────────────
export const companies = pm.table('companies', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  address: text('address'),
  industry: text('industry'),
  custom_properties: jsonb('custom_properties').default({}),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  deleted_at: timestamp('deleted_at', { withTimezone: true }),
})

// ─── Contacts ─────────────────────────────────────────────────────────────────
export const contacts = pm.table('contacts', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  company_id: uuid('company_id').references(() => companies.id, { onDelete: 'set null' }),
  first_name: text('first_name').notNull(),
  last_name: text('last_name').notNull(),
  email: text('email'),
  phone: text('phone'),
  contact_type: text('contact_type'),
  custom_properties: jsonb('custom_properties').default({}),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  deleted_at: timestamp('deleted_at', { withTimezone: true }),
})

// ─── Projects ─────────────────────────────────────────────────────────────────
export const projects = pm.table('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  company_id: uuid('company_id').references(() => companies.id, { onDelete: 'set null' }),
  contact_id: uuid('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
  status_id: uuid('status_id').references(() => projectStatuses.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  address: text('address'),
  planned_hours: decimal('planned_hours').default('0.0'),
  custom_properties: jsonb('custom_properties').default({}),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  deleted_at: timestamp('deleted_at', { withTimezone: true }),
})

// ─── Project Members ──────────────────────────────────────────────────────────
export const projectMembers = pm.table('project_members', {
  project_id: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  user_id: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  role: text('role').default('worker'),
  deleted_at: timestamp('deleted_at', { withTimezone: true }),
})

// ─── Project Reports ──────────────────────────────────────────────────────────
export const projectReports = pm.table('project_reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  project_id: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  author_id: uuid('author_id').references(() => users.id),
  report_type: text('report_type').notNull(),
  text_content: text('text_content'),
  custom_properties: jsonb('custom_properties').default({}),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  deleted_at: timestamp('deleted_at', { withTimezone: true }),
})

// ─── Report Images ────────────────────────────────────────────────────────────
export const reportImages = pm.table('report_images', {
  id: uuid('id').primaryKey().defaultRandom(),
  report_id: uuid('report_id')
    .notNull()
    .references(() => projectReports.id, { onDelete: 'cascade' }),
  storage_path: text('storage_path').notNull(),
  uploaded_by: uuid('uploaded_by').references(() => users.id),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

// ─── Report Comments ──────────────────────────────────────────────────────────
export const reportComments = pm.table('report_comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  report_id: uuid('report_id')
    .notNull()
    .references(() => projectReports.id, { onDelete: 'cascade' }),
  author_id: uuid('author_id').references(() => users.id),
  text: text('text').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  deleted_at: timestamp('deleted_at', { withTimezone: true }),
})

// ─── Events ───────────────────────────────────────────────────────────────────
export const events = pm.table('events', {
  id: uuid('id').primaryKey().defaultRandom(),
  org_id: uuid('org_id')
    .notNull()
    .references(() => organizations.id),
  actor_id: uuid('actor_id').references(() => users.id),
  event_type: text('event_type').notNull(),
  entity_type: text('entity_type').notNull(),
  entity_id: uuid('entity_id').notNull(),
  summary: text('summary'),
  changes: jsonb('changes'),
  payload: jsonb('payload').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  processed_at: timestamp('processed_at', { withTimezone: true }),
})

// ─── Types ────────────────────────────────────────────────────────────────────
export type Organization = typeof organizations.$inferSelect
export type User = typeof users.$inferSelect
export type OrgMember = typeof orgMembers.$inferSelect
export type ProjectStatus = typeof projectStatuses.$inferSelect
export type CustomFieldDefinition = typeof customFieldDefinitions.$inferSelect
export type Company = typeof companies.$inferSelect
export type Contact = typeof contacts.$inferSelect
export type Project = typeof projects.$inferSelect
export type ProjectMember = typeof projectMembers.$inferSelect
export type ProjectReport = typeof projectReports.$inferSelect
export type ReportImage = typeof reportImages.$inferSelect
export type ReportComment = typeof reportComments.$inferSelect
export type Event = typeof events.$inferSelect

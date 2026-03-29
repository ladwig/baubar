import { pgSchema, pgEnum } from 'drizzle-orm/pg-core'
import {
  uuid,
  text,
  boolean,
  integer,
  decimal,
  jsonb,
  timestamp,
  bigserial,
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
  phone: text('phone'),
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

// ─── AI Schema ────────────────────────────────────────────────────────────────

export const ai = pgSchema('ai')

export const aiThreads = ai.table('threads', {
  id:          uuid('id').primaryKey().defaultRandom(),
  org_id:      uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  channel:     text('channel').notNull(), // 'web' | 'whatsapp' | 'mobile'
  external_id: text('external_id').notNull(), // user UUID or phone number
  created_at:  timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export const aiMessages = ai.table('messages', {
  id:         uuid('id').primaryKey().defaultRandom(),
  thread_id:  uuid('thread_id').notNull().references(() => aiThreads.id, { onDelete: 'cascade' }),
  role:       text('role').notNull(), // 'user' | 'assistant' | 'tool'
  content:    jsonb('content').notNull(),
  seq:        bigserial('seq', { mode: 'bigint' }),  // insertion order — used for deterministic sorting
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export const aiConfigs = ai.table('configs', {
  id:            uuid('id').primaryKey().defaultRandom(),
  org_id:        uuid('org_id').notNull().unique().references(() => organizations.id, { onDelete: 'cascade' }),
  system_prompt: text('system_prompt'),
  language:      text('language').default('de'),
  created_at:    timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at:    timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

// ─── Gateway Schema ───────────────────────────────────────────────────────────

export const gw = pgSchema('gateway')

export const gatewayOrgNumbers = gw.table('org_numbers', {
  id:                 uuid('id').primaryKey().defaultRandom(),
  org_id:             uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  phone_number:       text('phone_number').notNull(),
  provider:           text('provider').notNull(), // 'twilio' | 'meta'
  provider_number_id: text('provider_number_id').notNull(),
  display_name:       text('display_name'),
  created_at:         timestamp('created_at', { withTimezone: true }).defaultNow(),
  deactivated_at:     timestamp('deactivated_at', { withTimezone: true }),
})

export const gatewayAllowedContacts = gw.table('allowed_contacts', {
  id:            uuid('id').primaryKey().defaultRandom(),
  org_id:        uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  contact_phone: text('contact_phone').notNull(),
  contact_id:    uuid('contact_id'),  // soft ref → pm.contacts
  created_at:    timestamp('created_at', { withTimezone: true }).defaultNow(),
  created_by:    uuid('created_by'),  // soft ref → pm.users
})

export const gatewayConversations = gw.table('conversations', {
  id:              uuid('id').primaryKey().defaultRandom(),
  org_id:          uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  org_number_id:   uuid('org_number_id').notNull(), // → gatewayOrgNumbers
  contact_phone:   text('contact_phone'),
  group_id:        text('group_id'),
  type:            text('type').notNull().default('direct'), // 'direct' | 'group'
  thread_id:       uuid('thread_id'),  // soft ref → ai.threads
  last_message_at: timestamp('last_message_at', { withTimezone: true }),
  created_at:      timestamp('created_at', { withTimezone: true }).defaultNow(),
  deactivated_at:  timestamp('deactivated_at', { withTimezone: true }),
  // Opaque context set by the agent — passed back on the next inbound message.
  // Gateway never interprets this; only the agent reads/writes it.
  pending_context: jsonb('pending_context'),
})

export const gatewayMessages = gw.table('messages', {
  id:                  uuid('id').primaryKey().defaultRandom(),
  conversation_id:     uuid('conversation_id').notNull(), // → gatewayConversations
  direction:           text('direction').notNull(), // 'inbound' | 'outbound'
  from_number:         text('from_number').notNull(),
  type:                text('type').notNull().default('text'), // 'text' | 'image' | 'audio' | 'document'
  content:             text('content'),
  media_storage_url:   text('media_storage_url'),
  mime_type:           text('mime_type'),
  provider_message_id: text('provider_message_id'),
  sent_at:             timestamp('sent_at', { withTimezone: true }).defaultNow(),
  delivered_at:        timestamp('delivered_at', { withTimezone: true }),
  read_at:             timestamp('read_at', { withTimezone: true }),
  failed_at:           timestamp('failed_at', { withTimezone: true }),
  error_code:          text('error_code'),
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
export type AiThread = typeof aiThreads.$inferSelect
export type AiMessage = typeof aiMessages.$inferSelect
export type AiConfig = typeof aiConfigs.$inferSelect
export type GatewayOrgNumber = typeof gatewayOrgNumbers.$inferSelect
export type GatewayAllowedContact = typeof gatewayAllowedContacts.$inferSelect
export type GatewayConversation = typeof gatewayConversations.$inferSelect
export type GatewayMessage = typeof gatewayMessages.$inferSelect

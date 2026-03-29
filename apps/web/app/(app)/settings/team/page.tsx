'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import { PageHeader } from '@baubar/ui'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

type OrgUser = { id: string; full_name: string | null; role: string; created_at: string | null; removed_at: string | null }
type Me = { id: string; full_name: string | null; phone: string | null }

export default function TeamPage() {
  const [users, setUsers] = useState<OrgUser[]>([])
  const [me, setMe] = useState<Me | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ email: '', full_name: '', role: 'worker' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [phone, setPhone] = useState('')
  const [phoneError, setPhoneError] = useState<string | null>(null)
  const [phoneSaving, setPhoneSaving] = useState(false)

  async function load() {
    const [data, meData] = await Promise.all([
      fetch('/api/v1/admin/users').then((r) => r.json()),
      fetch('/api/v1/me').then((r) => r.json()),
    ])
    setUsers(data)
    setMe(meData)
    setPhone(meData.phone ?? '')
    setLoading(false)
  }

  useEffect(() => {
    load()
    createSupabaseBrowserClient().auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null))
  }, [])

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const res = await fetch('/api/v1/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      setForm({ email: '', full_name: '', role: 'worker' })
      setShowForm(false)
      load()
    } else {
      const data = await res.json()
      setError(data.error ?? 'Fehler beim Einladen.')
    }
    setSubmitting(false)
  }

  async function handleRemove(userId: string) {
    if (!confirm('Benutzer aus der Organisation entfernen?')) return
    await fetch(`/api/v1/admin/users/${userId}`, { method: 'DELETE' })
    setUsers((prev) => prev.filter((u) => u.id !== userId))
  }

  async function handleSavePhone(e: React.FormEvent) {
    e.preventDefault()
    setPhoneError(null)
    setPhoneSaving(true)
    const res = await fetch('/api/v1/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: phone.trim() || null }),
    })
    if (res.ok) {
      const data = await res.json()
      setMe((prev) => prev ? { ...prev, phone: data.phone } : prev)
    } else {
      const data = await res.json()
      setPhoneError(data.error?.formErrors?.[0] ?? data.error ?? 'Ungültige Nummer.')
    }
    setPhoneSaving(false)
  }

  return (
    <div className="flex flex-col gap-8 max-w-2xl">
      <div className="flex items-start justify-between">
        <PageHeader title="Team" description="Mitglieder der Organisation verwalten." />
        <button
          onClick={() => { setShowForm(true); setError(null) }}
          className="inline-flex items-center gap-1.5 rounded-md bg-zinc-900 px-3.5 py-2 text-sm font-medium text-white shadow hover:bg-zinc-800 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Einladen
        </button>
      </div>

      {/* My phone number */}
      <div className="rounded-lg border border-zinc-200 bg-white p-5 flex flex-col gap-4">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900">Meine WhatsApp-Nummer</h3>
          <p className="text-sm text-zinc-500 mt-0.5">
            Damit werden deine Nachrichten via WhatsApp deinem Account zugeordnet.
          </p>
        </div>
        <form onSubmit={handleSavePhone} className="flex items-start gap-3">
          <div className="flex flex-col gap-1 flex-1">
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+4915112345678"
              className="flex h-9 w-full rounded-md border border-zinc-200 bg-white px-3 py-1 text-sm shadow-sm placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-900"
            />
            {phoneError && <p className="text-xs text-red-500">{phoneError}</p>}
            <p className="text-xs text-zinc-400">Format: +4915112345678 (E.164)</p>
          </div>
          <button
            type="submit"
            disabled={phoneSaving}
            className="inline-flex h-9 items-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 transition-colors shrink-0"
          >
            {phoneSaving ? 'Speichern...' : 'Speichern'}
          </button>
        </form>
      </div>

      {showForm && (
        <form onSubmit={handleInvite} className="rounded-lg border border-zinc-200 bg-white p-5 flex flex-col gap-4">
          <h3 className="text-sm font-semibold text-zinc-900">Neues Mitglied einladen</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-zinc-700">Name <span className="text-red-500">*</span></label>
              <input
                required
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                placeholder="Max Mustermann"
                className="flex h-9 w-full rounded-md border border-zinc-200 bg-white px-3 py-1 text-sm shadow-sm placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-900"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-zinc-700">E-Mail <span className="text-red-500">*</span></label>
              <input
                required
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="max@firma.de"
                className="flex h-9 w-full rounded-md border border-zinc-200 bg-white px-3 py-1 text-sm shadow-sm placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-900"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-zinc-700">Rolle</label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="flex h-9 w-full rounded-md border border-zinc-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-900"
              >
                <option value="worker">Mitarbeiter</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          {error && (
            <div className="rounded-md bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">{error}</div>
          )}
          <div className="flex items-center gap-3">
            <button type="submit" disabled={submitting}
              className="inline-flex h-9 items-center rounded-md bg-zinc-900 px-5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 transition-colors">
              {submitting ? 'Wird eingeladen...' : 'Einladung senden'}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-zinc-200 px-4 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition-colors">
              <X className="h-3.5 w-3.5" />
              Abbrechen
            </button>
          </div>
        </form>
      )}

      <div className="rounded-lg border border-zinc-200 bg-white divide-y divide-zinc-100">
        {loading ? (
          <div className="p-4 space-y-3">
            {[1, 2].map((i) => <div key={i} className="h-8 animate-pulse rounded bg-zinc-100" />)}
          </div>
        ) : users.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-400">Noch keine Mitglieder.</p>
        ) : (
          users.map((u) => (
            <div key={u.id} className={`flex items-center justify-between px-4 py-3 ${u.removed_at ? 'opacity-40' : ''}`}>
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-zinc-200 flex items-center justify-center text-sm font-medium text-zinc-600 shrink-0">
                  {(u.full_name ?? '?')[0]?.toUpperCase()}
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-zinc-900">{u.full_name ?? '—'}</span>
                  <span className="text-xs text-zinc-400">
                    {u.removed_at ? 'Entfernt' : u.role === 'admin' ? 'Admin' : 'Mitarbeiter'}
                  </span>
                </div>
              </div>
              {!u.removed_at && u.id !== currentUserId && (
                <button
                  onClick={() => handleRemove(u.id)}
                  className="rounded p-1.5 text-zinc-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

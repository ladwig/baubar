'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Building2, Users, FolderKanban, Settings, LogOut, BarChart3 } from 'lucide-react'
import { cn } from '@baubar/ui'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const navItems = [
  { href: '/projects', label: 'Projekte', icon: FolderKanban },
  { href: '/companies', label: 'Unternehmen', icon: Building2 },
  { href: '/contacts', label: 'Kontakte', icon: Users },
]

const settingsItems = [
  { href: '/settings/statuses', label: 'Status', icon: BarChart3 },
  { href: '/settings/custom-fields', label: 'Felder', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="flex h-screen w-56 flex-col border-r border-zinc-200 bg-white">
      {/* Brand */}
      <div className="flex h-14 items-center gap-2.5 px-4 border-b border-zinc-100">
        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-zinc-900">
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
            <rect x="2" y="10" width="5" height="8" rx="1" fill="white" />
            <rect x="7.5" y="5" width="5" height="13" rx="1" fill="white" />
            <rect x="13" y="2" width="5" height="16" rx="1" fill="white" />
          </svg>
        </div>
        <span className="font-semibold text-zinc-900 text-sm tracking-tight">baubar</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {navItems.map((item) => {
          const active = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-zinc-100 text-zinc-900'
                  : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700'
              )}
            >
              <item.icon className={cn('h-4 w-4 flex-shrink-0', active ? 'text-zinc-900' : 'text-zinc-400')} />
              {item.label}
            </Link>
          )
        })}

        <div className="pt-4 pb-1">
          <p className="px-2.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            Einstellungen
          </p>
        </div>

        {settingsItems.map((item) => {
          const active = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-zinc-100 text-zinc-900'
                  : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700'
              )}
            >
              <item.icon className={cn('h-4 w-4 flex-shrink-0', active ? 'text-zinc-900' : 'text-zinc-400')} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-zinc-100 p-2">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700 transition-colors"
        >
          <LogOut className="h-4 w-4 text-zinc-400" />
          Abmelden
        </button>
      </div>
    </aside>
  )
}

import { redirect } from 'next/navigation'
import { getOrgContext } from '@/lib/auth'
import { Sidebar } from '@/components/sidebar'
import { LogoutButton } from '@/components/logout-button'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, orgId } = await getOrgContext()

  if (!user) redirect('/login')
  if (!orgId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <div className="flex flex-col items-center text-center">
          <p className="text-sm text-zinc-500">
            Kein Organisationszugang. Bitte Administrator kontaktieren.
          </p>
          <LogoutButton />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-50">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-6 py-8">
          {children}
        </div>
      </main>
    </div>
  )
}

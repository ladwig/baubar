import Link from 'next/link'
import { Plus } from 'lucide-react'
import { PageHeader } from '@baubar/ui'
import { ContactsTable } from './contacts-table'

export default function ContactsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Kontakte"
        description="Ansprechpartner und externe Kontakte"
        action={
          <Link
            href="/contacts/new"
            className="inline-flex items-center gap-1.5 rounded-md bg-zinc-900 px-3.5 py-2 text-sm font-medium text-white shadow hover:bg-zinc-800 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Neuer Kontakt
          </Link>
        }
      />
      <ContactsTable />
    </div>
  )
}

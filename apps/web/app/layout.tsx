import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'baubar – Construction OS',
  description: 'Projektmanagement für Baufirmen',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  )
}

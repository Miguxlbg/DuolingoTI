import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Duolingo da TI — Aprenda tecnologia jogando',
  description: 'Inglês técnico, Engenharia de Software e bootcamps em uma jornada gamificada.',
  manifest: '/manifest.json',
  icons: {
    icon: [{ url: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
    apple: '/apple-touch-icon.png',
  },
  appleWebApp: { capable: true, title: 'DuoTI', statusBarStyle: 'default' },
}

export const viewport: Viewport = {
  themeColor: '#58cc02',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  )
}

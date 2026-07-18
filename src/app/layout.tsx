import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Duolingo da TI — Aprenda tecnologia jogando',
  description: 'Inglês técnico, Engenharia de Software e bootcamps em uma jornada gamificada.',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  )
}

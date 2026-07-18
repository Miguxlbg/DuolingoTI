'use client'
import { Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'

export function ThemeToggle() {
  const [dark, setDark] = useState(false)
  useEffect(() => {
    const saved = localStorage.getItem('duoti.theme')
    const value = saved ? saved === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches
    setDark(value); document.documentElement.dataset.theme = value ? 'dark' : 'light'
  }, [])
  function toggle() {
    const next = !dark; setDark(next); document.documentElement.dataset.theme = next ? 'dark' : 'light'; localStorage.setItem('duoti.theme', next ? 'dark' : 'light')
  }
  return <button className="icon-button" onClick={toggle} aria-label={dark ? 'Ativar tema claro' : 'Ativar tema escuro'}>{dark ? <Sun size={19}/> : <Moon size={19}/>}</button>
}

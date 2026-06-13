'use client'
import { useEffect } from 'react'
import type { Locale } from '@/lib/types'

/** Synchronise <html lang> avec la locale active (le layout racine est au-dessus du segment). */
export function HtmlLang({ locale }: { locale: Locale }) {
  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])
  return null
}

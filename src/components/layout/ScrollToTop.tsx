'use client'
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

export default function ScrollToTop() {
  const pathname = usePathname()

  useEffect(() => {
    // ברגע שהנתיב משתנה, גלול למעלה בצורה חלקה
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname])

  return null
}

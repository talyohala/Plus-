'use client'
import { useEffect } from 'react'

export default function AppManager({ children }: { children: React.ReactNode }) {
  
  const applySettings = () => {
    const isDark = localStorage.getItem('setting_dark_mode') === 'true'
    const isContrast = localStorage.getItem('setting_contrast') === 'true'
    
    // החלת מצב לילה
    if (isDark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }

    // החלת ניגודיות
    if (isContrast) {
      document.body.classList.add('high-contrast')
    } else {
      document.body.classList.remove('high-contrast')
    }
  }

  useEffect(() => {
    // החלה בטעינה ראשונה
    applySettings()

    // האזנה לשינויים ב-Storage (כשמשנים הגדרות בעמוד אחר)
    window.addEventListener('storage', applySettings)
    
    // בדיקה תקופתית קצרה (עבור שינויים באותו חלון)
    const interval = setInterval(applySettings, 1000)
    
    return () => {
      window.removeEventListener('storage', applySettings)
      clearInterval(interval)
    }
  }, [])

  return <>{children}</>
}

// פונקציה גלובלית להשמעת צליל (ניתן לקרוא לה מכל מקום)
export const playSystemSound = (soundType: 'message' | 'notification' | 'click') => {
  const soundsEnabled = localStorage.getItem('setting_sounds') !== 'false'
  if (!soundsEnabled) return

  const audioMap = {
    message: 'https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3',
    notification: 'https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3',
    click: 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3'
  }

  const audio = new Audio(audioMap[soundType])
  audio.play().catch(() => {}) // מונע שגיאות אם הדפדפן חוסם ניגון אוטומטי
}

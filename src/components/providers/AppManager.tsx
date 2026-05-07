'use client'

import { useState, useEffect, useCallback, ReactNode } from 'react'

export default function AppManager({ children }: { children: ReactNode }) {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [showInstallBanner, setShowInstallBanner] = useState(false)

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      // מניעת הופעת הפופ-אפ המקורי של הדפדפן
      e.preventDefault()
      // שמרת האירוע כדי שנוכל להפעיל אותו אחר כך
      setDeferredPrompt(e)
      // הצגת הבאנר המעוצב שלנו
      setShowInstallBanner(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return
    // הצגת פופ-אפ ההתקנה המקורי של גוגל
    deferredPrompt.prompt()
    // המתנה לתשובת המשתמש
    const { outcome } = await deferredPrompt.userChoice
    console.log(`User response to install prompt: ${outcome}`)
    if (outcome === 'accepted') {
      setShowInstallBanner(false)
    }
    setDeferredPrompt(null)
  }, [deferredPrompt])

  return (
    <>
      {children}
      {showInstallBanner && deferredPrompt && (
        // באנר התקנה צף מעוצב (Glassmorphism)
        <div className="fixed bottom-3 left-3 right-3 p-3.5 bg-white/95 backdrop-blur-sm rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-gray-100 z-[9999] transition-all duration-500 ease-out animate-in fade-in slide-in-from-bottom-10">
          <div className="flex items-center justify-between gap-4 max-w-sm mx-auto">
            <div className="flex items-center gap-3">
              {/* הלוגו הפיזי שהעלית */}
              <img src="/icon-192.png" alt="שכן+ Logo" className="w-11 h-11 rounded-xl shadow-inner border border-gray-100 shrink-0" />
              <div className="text-right">
                <h3 className="font-semibold text-gray-950 leading-tight">שכן+ עכשיו בטלפון שלך</h3>
                <p className="text-[13px] text-gray-700 mt-0.5">לחוויה מלאה, מהירה ונוחה יותר</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {/* כפתור סגירה נקי */}
              <button onClick={() => setShowInstallBanner(false)} className="bg-gray-100 text-gray-600 hover:bg-gray-200 px-4 py-2.5 rounded-full font-medium transition-colors text-sm">סגור</button>
              {/* כפתור התקנה יוקרתי עם גראדיאנט */}
              <button onClick={handleInstall} className="bg-gradient-to-br from-blue-600 to-blue-700 text-white px-5 py-2.5 rounded-full font-medium shadow-md shadow-blue-200 hover:brightness-110 active:scale-95 transition-all text-sm flex items-center gap-1.5">
                התקנה
                <span aria-hidden className="text-lg leading-none">↓</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

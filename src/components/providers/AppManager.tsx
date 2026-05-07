'use client'

import { useState, useEffect, useCallback, ReactNode } from 'react'

// החזרת פונקציית הסאונד החסרה כדי לפתור את שגיאת ה-Build
export const playSystemSound = (soundType: string = 'click') => {
  if (typeof window !== 'undefined') {
    try {
      // מנגנון השמעת צלילים בטוח שלא קורס
      const audio = new Audio(`/sounds/${soundType}.mp3`);
      audio.play().catch(() => {});
    } catch (e) {
      console.error("Audio error:", e);
    }
  }
};

export default function AppManager({ children }: { children: ReactNode }) {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [showInstallBanner, setShowInstallBanner] = useState(false)

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShowInstallBanner(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setShowInstallBanner(false)
    }
    setDeferredPrompt(null)
  }, [deferredPrompt])

  return (
    <>
      {children}
      {showInstallBanner && deferredPrompt && (
        <div className="fixed bottom-5 inset-x-4 max-w-sm mx-auto bg-white/85 backdrop-blur-xl border border-gray-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.08)] rounded-xl p-4 z-[9999] animate-in fade-in slide-in-from-bottom-5 duration-500">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-[#1D4ED8] rounded-xl flex items-center justify-center shrink-0 shadow-sm">
              <span className="text-white font-bold text-lg tracking-tight">שכן+</span>
            </div>
            
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 text-base leading-none">שכן+</h3>
              <p className="text-sm text-gray-500 mt-1">התקן לחוויה חלקה ומהירה</p>
            </div>
            
            <div className="flex flex-col gap-2 shrink-0">
              <button 
                onClick={handleInstall} 
                className="bg-[#1D4ED8] text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
              >
                התקנה
              </button>
              <button 
                onClick={() => setShowInstallBanner(false)} 
                className="text-gray-400 hover:text-gray-600 px-4 py-1 rounded-lg text-xs font-medium transition-colors"
              >
                לא עכשיו
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

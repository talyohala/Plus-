'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

export default function Header() {
  const [profile, setProfile] = useState<any>(null)
  const [buildingName, setBuildingName] = useState<string>('טוען...')
  const [unreadCount, setUnreadCount] = useState(0)
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    const fetchHeaderData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profileData } = await supabase.from('profiles').select('*, buildings(name)').eq('id', user.id).single()
      if (profileData) {
        setProfile(profileData)
        setBuildingName(profileData.buildings?.name || 'ללא בניין')
      }

      const { count } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('receiver_id', user.id).eq('is_read', false)
      setUnreadCount(count || 0)
    }
    
    fetchHeaderData()
  }, [])

  return (
    <header className="w-full max-w-md bg-white/90 backdrop-blur-md border-b border-gray-100 rounded-b-2xl px-5 pt-7 pb-4 shadow-sm z-50 shrink-0 sticky top-0" dir="rtl">
      <div className="flex justify-between items-center relative h-12">
        
        {/* צד ימין: כפתור התראות או חזור */}
        <div className="z-10 w-10 h-10">
          {pathname === '/' ? (
            <Link href="/notifications" className="relative w-10 h-10 flex items-center justify-center bg-gray-50 rounded-xl text-brand-gray hover:text-brand-blue transition-all active:scale-95 border border-gray-100">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path>
              </svg>
              {unreadCount > 0 && (
                <span className="absolute top-0 right-0 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border-2 border-white"></span>
                </span>
              )}
            </Link>
          ) : (
            <button onClick={() => router.back()} className="w-10 h-10 flex items-center justify-center bg-gray-50 rounded-xl text-brand-gray hover:text-brand-blue transition-all active:scale-95 border border-gray-100">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7"></path></svg>
            </button>
          )}
        </div>

        {/* מרכז: לוגו ושם בניין */}
        <div className="absolute left-1/2 transform -translate-x-1/2 text-center flex flex-col items-center pointer-events-none">
          <h1 className="text-xl font-black text-brand-blue leading-none mb-1">
            שכן<span className="text-brand-dark">+</span>
          </h1>
          <p className="text-[10px] font-bold text-brand-gray bg-brand-light px-2 py-0.5 rounded-md border border-gray-100 uppercase tracking-tight">
            {buildingName}
          </p>
        </div>
        
        {/* צד שמאל: תמונת פרופיל */}
        <Link href="/profile" className="z-10">
          <div className="w-10 h-10 rounded-xl bg-gray-100 overflow-hidden shadow-sm border border-white transition-transform active:scale-95">
            <img 
              src={profile?.avatar_url || `https://api.dicebear.com/8.x/initials/svg?seed=${profile?.full_name || 'Guest'}&backgroundColor=f1f5f9&textColor=60a5fa`} 
              alt="פרופיל" 
              className="w-full h-full object-cover" 
            />
          </div>
        </Link>

      </div>
    </header>
  )
}

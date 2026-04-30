'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

export default function Header() {
  const [profile, setProfile] = useState<any>(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    const fetchHeaderData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setProfile(data)
        const { count } = await supabase.from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('receiver_id', user.id).eq('is_read', false)
        setUnreadCount(count || 0)
      }
    }
    fetchHeaderData()
    const channel = supabase.channel('header_realtime_v3').on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, fetchHeaderData).subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  return (
    <header className="w-full max-w-md bg-white/80 backdrop-blur-md rounded-b-3xl p-6 pt-10 shadow-sm mb-6 z-20 shrink-0">
      <div className="flex justify-between items-center" dir="rtl">
        
        {/* צד ימין: פעמון במסך הבית, חץ חזור בצ'אט */}
        {pathname === '/chat' ? (
          <button onClick={() => router.back()} className="p-2 text-brand-dark hover:bg-gray-100 rounded-full transition active:scale-95">
            <svg className="w-6 h-6 transform flip-x" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7"></path>
            </svg>
          </button>
        ) : (
          <Link href="/notifications" className="relative p-2 text-brand-dark hover:scale-105 transition">
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path>
            </svg>
            {unreadCount > 0 && <span className="absolute top-2 right-2 w-3 h-3 bg-red-500 border-2 border-white rounded-full"></span>}
          </Link>
        )}

        {/* מרכז: לוגו וכתובת */}
        <div className="text-center flex-1">
          <h1 className="text-2xl font-black text-brand-blue leading-none mb-1">שכן<span className="text-brand-dark">+</span></h1>
          <p className="text-lg font-bold text-brand-dark leading-none">רחוב האלון 15</p>
          <p className="text-[10px] font-medium text-brand-gray mt-1">בניין 32 • A דיירים</p>
        </div>

        {/* צד שמאל: פרופיל */}
        <Link href="/profile" className="w-12 h-12 rounded-full border-2 border-white shadow-sm overflow-hidden bg-gray-100 transition active:scale-95">
          <img src={profile?.avatar_url || 'https://api.dicebear.com/7.x/notionists/svg?seed=guest'} className="w-full h-full object-cover" />
        </Link>

      </div>
    </header>
  )
}

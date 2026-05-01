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

  const fetchHeaderData = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) return

    const { data: profileData } = await supabase.from('profiles').select('*, buildings(name)').eq('id', user.id).single()
    if (profileData) {
      setProfile(profileData)
      setBuildingName(profileData.buildings?.name || 'ללא בניין')
    }

    const { count } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('receiver_id', user.id).eq('is_read', false)
    setUnreadCount(count || 0)
  }

  useEffect(() => {
    fetchHeaderData()
    const channel = supabase.channel('header_global')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, fetchHeaderData)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  return (
    <header className="w-full max-w-md bg-white/80 backdrop-blur-md rounded-b-3xl p-6 pt-10 shadow-sm mb-6 z-20 shrink-0" dir="rtl">
      <div className="flex justify-between items-center">
        {pathname === '/' ? (
          <Link href="/notifications" className="relative p-2 text-brand-dark hover:scale-110 transition">
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path>
            </svg>
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-500 border-2 border-white"></span>
              </span>
            )}
          </Link>
        ) : (
          <button onClick={() => router.back()} className="p-2 text-brand-dark hover:bg-gray-100 rounded-full transition">
            <svg className="w-6 h-6 transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7"></path>
            </svg>
          </button>
        )}

        <div className="text-center flex-1">
          <h1 className="text-2xl font-black text-brand-blue leading-none mb-1">שכן<span className="text-brand-dark">+</span></h1>
          <p className="text-lg font-bold text-brand-dark leading-none">{buildingName}</p>
        </div>

        <Link href="/profile" className="w-12 h-12 rounded-full border-2 border-white shadow-sm overflow-hidden bg-brand-blue/10">
          <img src={profile?.avatar_url || `https://api.dicebear.com/8.x/initials/svg?seed=${profile?.full_name || 'Guest'}`} className="w-full h-full object-cover" />
        </Link>
      </div>
    </header>
  )
}

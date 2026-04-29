'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import Link from 'next/link'

export default function Header() {
  const [unreadCount, setUnreadCount] = useState(0)

  const fetchUnread = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_id', user.id)
        .eq('is_read', false)
      setUnreadCount(count || 0)
    }
  }

  useEffect(() => {
    fetchUnread()
    const channel = supabase.channel('realtime_notifications')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, fetchUnread)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  return (
    <header className="w-full max-w-md flex justify-between items-center py-6 px-2 z-20">
      {/* כפתור התראות בצד שמאל */}
      <Link href="/notifications" className="relative p-2 glass-panel rounded-2xl hover:scale-105 transition">
        <svg className="w-6 h-6 text-brand-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path>
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-2 right-2 w-3 h-3 bg-red-500 border-2 border-white rounded-full animate-pulse"></span>
        )}
      </Link>
      
      {/* לוגו "שכן+" בצד ימין */}
      <div className="text-right">
        <h1 className="text-2xl font-black text-brand-blue tracking-tight">
          שכן<span className="text-brand-dark">+</span>
        </h1>
        <p className="text-[10px] font-bold text-brand-gray uppercase tracking-widest">Building Community</p>
      </div>
    </header>
  )
}

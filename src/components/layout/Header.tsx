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
        let channel: any;

        const fetchHeaderData = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data: profileData } = await supabase.from('profiles').select('*, buildings(name)').eq('id', user.id).single()
            if (profileData) {
                setProfile(profileData)
                setBuildingName(profileData.buildings?.name || 'ללא בניין')
            }

            const fetchCount = async () => {
                const { count } = await supabase.from('notifications')
                    .select('*', { count: 'exact', head: true })
                    .eq('receiver_id', user.id)
                    .eq('is_read', false)
                setUnreadCount(count || 0)
            }

            fetchCount()

            // האזנה בזמן אמת להתראות חדשות או כאלה שסומנו כנקראו
            channel = supabase.channel('header_realtime_count')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `receiver_id=eq.${user.id}` }, () => {
                    fetchCount()
                })
                .subscribe()
        }

        fetchHeaderData()

        return () => {
            if (channel) supabase.removeChannel(channel)
        }
    }, [])

    return (
        <header className="w-full max-w-md bg-white/90 backdrop-blur-md border-b border-gray-100 rounded-b-2xl px-5 pt-7 pb-4 shadow-sm z-50 shrink-0 sticky top-0" dir="rtl">
            <div className="flex justify-between items-center relative h-12">
                
                {/* צד ימין: כפתור התראות או חזור */}
                <div className="z-10 w-10 h-10">
                    {pathname === '/' ? (
                        <Link href="/notifications" className="relative w-10 h-10 flex items-center justify-center bg-gray-50 rounded-xl text-slate-500 hover:text-[#1D4ED8] transition-all active:scale-95 border border-gray-100 shadow-sm">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path>
                            </svg>
                            {unreadCount > 0 && (
                                <div className="absolute -top-1.5 -right-1.5 flex items-center justify-center">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-40"></span>
                                    <span className="relative flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1.5 border-2 border-white shadow-sm">
                                        <span className="text-[10px] font-black text-white leading-none mt-px">{unreadCount > 99 ? '99+' : unreadCount}</span>
                                    </span>
                                </div>
                            )}
                        </Link>
                    ) : (
                        <button onClick={() => router.back()} className="w-10 h-10 flex items-center justify-center bg-gray-50 rounded-xl text-slate-500 hover:text-[#1D4ED8] transition-all active:scale-95 border border-gray-100 shadow-sm">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7"></path></svg>
                        </button>
                    )}
                </div>
                
                {/* מרכז: לוגו ושם בניין */}
                <div className="absolute left-1/2 transform -translate-x-1/2 text-center flex flex-col items-center pointer-events-none">
                    <h1 className="text-xl font-black text-[#1D4ED8] leading-none mb-1">
                        שכן<span className="text-slate-800">+</span>
                    </h1>
                    <p className="text-[10px] font-bold text-slate-500 bg-slate-50 px-2 py-0.5 rounded-md border border-gray-100 uppercase tracking-tight">
                        {buildingName}
                    </p>
                </div>
                
                {/* צד שמאל: תמונת פרופיל */}
                <Link href="/profile" className="z-10">
                    <div className="w-10 h-10 rounded-xl bg-gray-100 overflow-hidden shadow-sm border border-white transition-transform hover:scale-105 active:scale-95">
                        <img
                            src={profile?.avatar_url || `https://api.dicebear.com/8.x/initials/svg?seed=${profile?.full_name || 'Guest'}&backgroundColor=eff6ff&textColor=1d4ed8`}
                            alt="פרופיל"
                            className="w-full h-full object-cover"
                        />
                    </div>
                </Link>
            </div>
        </header>
    )
}

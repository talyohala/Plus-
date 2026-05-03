'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import Link from 'next/link'
import { playSystemSound } from '../../components/providers/AppManager'

export default function HomePage() {
  const [profile, setProfile] = useState<any>(null)
  const [building, setBuilding] = useState<any>(null)
  const [unpaidCount, setUnpaidCount] = useState(0)
  const [openTickets, setOpenTickets] = useState(0)
  const [latestAnnouncement, setLatestAnnouncement] = useState<any>(null)

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: prof } = await supabase.from('profiles').select('*, buildings(*)').eq('id', user.id).single()
    if (prof) {
      setProfile(prof)
      setBuilding(prof.buildings)
      
      const { count: unpaid } = await supabase.from('payments')
        .select('*', { count: 'exact', head: true })
        .eq('payer_id', user.id)
        .eq('status', 'pending')
      setUnpaidCount(unpaid || 0)

      const { count: tickets } = await supabase.from('service_tickets')
        .select('*', { count: 'exact', head: true })
        .eq('building_id', prof.building_id)
        .neq('status', 'טופל')
      setOpenTickets(tickets || 0)

      // שליפת ההודעה האחרונה מהצ'אט עבור מסך הבית
      const { data: msg } = await supabase.from('messages')
        .select('content')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      if (msg) setLatestAnnouncement(msg)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  return (
    <div className="flex flex-col flex-1 w-full pb-24 space-y-6" dir="rtl">
      
      <div className="px-3 mt-6 mb-2">
        <h1 className="text-3xl font-black text-brand-dark">שלום, {profile?.full_name?.split(' ')[0] || 'שכן'} 👋</h1>
        <p className="text-brand-gray font-medium text-lg mt-1">מה נרצה לעשות היום?</p>
      </div>

      <div className="grid grid-cols-1 gap-5 px-3">
        
        {/* כפתור תשלומים - הדגשה אם יש חוב */}
        <Link href="/payments" onClick={() => playSystemSound('click')}
          className={`relative overflow-hidden p-6 rounded-[2rem] shadow-md transition active:scale-95 flex items-center gap-5 ${unpaidCount > 0 ? 'bg-brand-blue text-white' : 'bg-white border border-gray-100 text-brand-dark'}`}>
          <div className={`p-4 rounded-2xl shrink-0 ${unpaidCount > 0 ? 'bg-white/20' : 'bg-brand-blue/10 text-brand-blue'}`}>
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path></svg>
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-black mb-1">ועד בית</h2>
            <p className={`text-sm font-bold ${unpaidCount > 0 ? 'opacity-90' : 'text-green-500'}`}>
              {unpaidCount > 0 ? `ממתינים ${unpaidCount} תשלומים` : 'הכל משולם!'}
            </p>
          </div>
          <svg className="w-6 h-6 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7"></path></svg>
        </Link>

        {/* כפתור תקלות */}
        <Link href="/services" onClick={() => playSystemSound('click')}
          className="bg-white border border-gray-100 p-6 rounded-[2rem] shadow-sm flex items-center gap-5 active:scale-95 transition">
          <div className="p-4 rounded-2xl bg-orange-50 text-orange-500 shrink-0">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-black text-brand-dark mb-1">פתיחת תקלה</h2>
            <p className="text-sm text-brand-gray font-bold">{openTickets > 0 ? `${openTickets} תקלות בטיפול הוועד` : 'הבניין מתפקד מעולה'}</p>
          </div>
          <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7"></path></svg>
        </Link>

        {/* כפתור צ'אט/קהילה */}
        <Link href="/chat" onClick={() => playSystemSound('click')}
          className="bg-white border border-gray-100 p-6 rounded-[2rem] shadow-sm flex items-center gap-5 active:scale-95 transition">
          <div className="p-4 rounded-2xl bg-green-50 text-green-500 shrink-0">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path></svg>
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-black text-brand-dark mb-1">קבוצת הבניין</h2>
            <p className="text-sm text-brand-gray font-bold truncate max-w-[180px]">
              {latestAnnouncement ? latestAnnouncement.content : 'לחצו כדי לדבר עם השכנים'}
            </p>
          </div>
          <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7"></path></svg>
        </Link>

      </div>
    </div>
  )
}

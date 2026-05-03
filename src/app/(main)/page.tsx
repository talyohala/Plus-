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

    // שליפת פרופיל ובניין
    const { data: prof } = await supabase.from('profiles').select('*, buildings(*)').eq('id', user.id).single()
    if (prof) {
      setProfile(prof)
      setBuilding(prof.buildings)
      
      // סטטוס תשלומים - כמה תשלומים ממתינים יש לי
      const { count: unpaid } = await supabase.from('payments')
        .select('*', { count: 'exact', head: true })
        .eq('payer_id', user.id)
        .eq('status', 'pending')
      setUnpaidCount(unpaid || 0)

      // סטטוס תקלות בבניין - כמה פתוחות יש
      const { count: tickets } = await supabase.from('service_tickets')
        .select('*', { count: 'exact', head: true })
        .eq('building_id', prof.building_id)
        .neq('status', 'טופל')
      setOpenTickets(tickets || 0)

      // הודעה אחרונה מהוועד (פוסט נעוץ או אחרון)
      const { data: post } = await supabase.from('posts')
        .select('*, profiles(full_name)')
        .eq('user_id', user.id) // במציאות נשלוף פוסט מנהל
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      if (post) setLatestAnnouncement(post)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  return (
    <div className="flex flex-col flex-1 w-full pb-24 space-y-6" dir="rtl">
      
      {/* כותרת בוקר טוב */}
      <div className="px-2 mt-4">
        <h1 className="text-2xl font-black text-brand-dark">היי, {profile?.full_name?.split(' ')[0]} 👋</h1>
        <p className="text-brand-gray font-medium">מה תרצה לעשות היום בבניין?</p>
      </div>

      {/* כפתורי One-Tap UX - גדולים וברורים */}
      <div className="grid grid-cols-1 gap-4 px-2">
        
        {/* כפתור תשלום מהיר */}
        <Link href="/payments" onClick={() => playSystemSound('click')}
          className={`relative overflow-hidden p-6 rounded-[2.5rem] shadow-lg transition active:scale-95 flex items-center justify-between ${unpaidCount > 0 ? 'bg-brand-blue text-white' : 'bg-white border border-gray-100 text-brand-dark'}`}>
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-2xl ${unpaidCount > 0 ? 'bg-white/20' : 'bg-brand-blue/10 text-brand-blue'}`}>
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path></svg>
            </div>
            <div>
              <h2 className="text-xl font-black">שלם ועד בית</h2>
              <p className={`text-sm font-bold ${unpaidCount > 0 ? 'opacity-80' : 'text-green-500'}`}>
                {unpaidCount > 0 ? `יש לך ${unpaidCount} תשלומים ממתינים` : 'הכל שולם! תודה.'}
              </p>
            </div>
          </div>
          <svg className="w-6 h-6 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7"></path></svg>
        </Link>

        {/* כפתור דיווח תקלה */}
        <Link href="/services" onClick={() => playSystemSound('click')}
          className="bg-white border border-gray-100 p-6 rounded-[2.5rem] shadow-sm flex items-center justify-between active:scale-95 transition group">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-orange-50 text-orange-500 group-hover:bg-orange-500 group-hover:text-white transition">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
            </div>
            <div>
              <h2 className="text-xl font-black text-brand-dark">דווח על תקלה</h2>
              <p className="text-sm text-brand-gray font-bold">{openTickets} תקלות בטיפול כרגע</p>
            </div>
          </div>
          <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7"></path></svg>
        </Link>

        {/* לוח מודעות / הודעות ועד */}
        <Link href="/chat" onClick={() => playSystemSound('click')}
          className="bg-white border border-gray-100 p-6 rounded-[2.5rem] shadow-sm flex items-center justify-between active:scale-95 transition group">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-green-50 text-green-500 group-hover:bg-green-500 group-hover:text-white transition">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path></svg>
            </div>
            <div>
              <h2 className="text-xl font-black text-brand-dark">הודעות ועד וצ'אט</h2>
              <p className="text-sm text-brand-gray font-bold truncate max-w-[150px]">
                {latestAnnouncement ? latestAnnouncement.content : 'אין הודעות חדשות'}
              </p>
            </div>
          </div>
          <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7"></path></svg>
        </Link>

      </div>

      {/* אזור עדכונים מהירים - "מה חדש בבניין" */}
      <div className="px-2">
        <h3 className="text-sm font-black text-brand-gray uppercase tracking-wider mb-4 mr-2">עדכונים אחרונים</h3>
        <div className="bg-white/50 backdrop-blur-sm border border-white p-4 rounded-3xl space-y-4">
          <div className="flex items-center justify-between text-xs font-bold text-brand-dark">
             <div className="flex items-center gap-2">
               <div className="w-2 h-2 bg-green-500 rounded-full"></div>
               <span>מערכת ה-AI זיהתה חזרה של תקלת מעלית</span>
             </div>
             <span className="text-brand-gray">לפני שעה</span>
          </div>
          <div className="flex items-center justify-between text-xs font-bold text-brand-dark">
             <div className="flex items-center gap-2">
               <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
               <span>הופק דוח גבייה חודשי לאישור הוועד</span>
             </div>
             <span className="text-brand-gray">הבוקר</span>
          </div>
        </div>
      </div>

    </div>
  )
}

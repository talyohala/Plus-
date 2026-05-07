'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import Link from 'next/link'

export default function EventsPage() {
  const [events, setEvents] = useState<any[]>([])
  const [profile, setProfile] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchEvents = async () => {
    setIsLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    setProfile(prof)

    if (prof) {
      const { data: eventsData } = await supabase
        .from('events')
        .select(`
          *,
          event_rsvps (
            id,
            user_id,
            status,
            note,
            profiles ( full_name )
          )
        `)
        .eq('building_id', prof.building_id)
        .gte('event_date', new Date().toISOString())
        .order('event_date', { ascending: true })

      if (eventsData) setEvents(eventsData)
    }
    setIsLoading(false)
  }

  useEffect(() => {
    fetchEvents()
  }, [])

  const handleRSVP = async (eventId: string, status: string, note: string = '') => {
    if (!profile) return
    const { error } = await supabase
      .from('event_rsvps')
      .upsert({ 
        event_id: eventId, 
        user_id: profile.id, 
        status, 
        note 
      }, { onConflict: 'event_id,user_id' })

    if (!error) fetchEvents()
  }

  return (
    <div className="flex flex-col flex-1 w-full pb-24 space-y-6 relative" dir="rtl">
      
      {/* כותרת הדף עם כפתור חזור */}
      <div className="px-5 mt-8 mb-2 flex items-start gap-4">
        <Link href="/" className="mt-1 bg-white p-2.5 rounded-2xl shadow-sm border border-slate-100 text-slate-500 hover:text-slate-800 transition-colors shrink-0">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7"></path></svg>
        </Link>
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">לוח אירועים</h1>
          <p className="text-slate-500 font-bold text-base mt-1.5">האירועים הקרובים בבניין</p>
        </div>
      </div>
      
      <div className="px-4 w-full relative z-10">
        {isLoading ? (
          <div className="text-center text-slate-500 mt-10 font-bold">טוען אירועים...</div>
        ) : events.length === 0 ? (
          <div className="text-center mt-20 text-slate-400 bg-white/80 backdrop-blur-md border border-white shadow-sm p-10 rounded-[3rem]">
            <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
            <p className="font-black text-xl text-slate-700">אין אירועים קרובים</p>
            <p className="text-sm font-bold mt-2">הוועד יעדכן כשיהיו אירועים חדשים 📅</p>
          </div>
        ) : (
          events.map(event => {
            const myRsvp = event.event_rsvps.find((r: any) => r.user_id === profile.id)
            const attendingCount = event.event_rsvps.filter((r: any) => r.status === 'attending').length
            const isCommittee = profile.role === 'committee'

            return (
              <div key={event.id} className="bg-white/80 backdrop-blur-md rounded-[2rem] p-6 shadow-sm border border-white mb-4">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="text-2xl font-black text-slate-800 mb-1">{event.title}</h2>
                    <p className="text-sm font-bold text-slate-500">{new Date(event.event_date).toLocaleString('he-IL', { dateStyle: 'full', timeStyle: 'short' })}</p>
                  </div>
                  <div className="bg-rose-50 text-rose-500 p-4 rounded-2xl border border-rose-100 shrink-0 shadow-sm">
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                  </div>
                </div>
                
                {event.description && <p className="text-slate-600 mb-4 text-sm font-medium leading-relaxed">{event.description}</p>}
                {event.location && <p className="text-rose-600 mb-6 text-sm font-bold bg-rose-50 inline-block px-3 py-1.5 rounded-lg border border-rose-100">📍 מיקום: {event.location}</p>}

                {/* אזור פעולה - כפתורי RSVP */}
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                  <p className="font-black text-base text-slate-800 mb-4 text-center">האם תגיעו?</p>
                  <div className="flex gap-2">
                    <button onClick={() => handleRSVP(event.id, 'attending')} className={`flex-1 py-3 rounded-xl text-sm font-black transition-all active:scale-95 ${myRsvp?.status === 'attending' ? 'bg-gradient-to-r from-rose-500 to-red-400 text-white shadow-md border border-rose-400/50' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>מגיע 🎉</button>
                    <button onClick={() => handleRSVP(event.id, 'maybe')} className={`flex-1 py-3 rounded-xl text-sm font-black transition-all active:scale-95 ${myRsvp?.status === 'maybe' ? 'bg-gradient-to-r from-slate-500 to-slate-600 text-white shadow-md border border-slate-400/50' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>אולי 🤔</button>
                    <button onClick={() => handleRSVP(event.id, 'declined')} className={`flex-1 py-3 rounded-xl text-sm font-black transition-all active:scale-95 ${myRsvp?.status === 'declined' ? 'bg-slate-200 text-slate-500 shadow-inner' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>לא מגיע</button>
                  </div>
                </div>

                {/* דשבורד לועד הבית */}
                {isCommittee && event.event_rsvps.length > 0 && (
                  <div className="mt-6 pt-5 border-t border-slate-100">
                    <h3 className="font-black text-sm text-slate-800 mb-3 flex items-center gap-2">
                      <span className="bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-md text-xs">{attendingCount} אישרו הגעה</span>
                      סטטוס משתתפים:
                    </h3>
                    <ul className="text-sm space-y-2">
                      {event.event_rsvps.map((rsvp: any) => (
                        <li key={rsvp.id} className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100/50">
                          <span className="font-bold text-slate-700">{rsvp.profiles?.full_name}</span>
                          <span className={`text-xs font-black px-2.5 py-1 rounded-lg ${rsvp.status === 'attending' ? 'bg-emerald-100 text-emerald-600' : rsvp.status === 'maybe' ? 'bg-amber-100 text-amber-600' : 'bg-slate-200 text-slate-500'}`}>
                            {rsvp.status === 'attending' ? 'מגיע' : rsvp.status === 'maybe' ? 'אולי' : 'לא מגיע'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

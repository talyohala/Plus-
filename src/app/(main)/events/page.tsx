'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import TopNav from '../../../components/layout/TopNav'

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
      // מושך אירועים יחד עם תגובות ה-RSVP של כל המשתמשים
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

    if (!error) fetchEvents() // רענון הנתונים אחרי הצבעה
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 pb-20">
      <TopNav title="לוח אירועים" />
      
      <div className="flex-1 p-5 space-y-6 max-w-lg mx-auto w-full">
        {isLoading ? (
          <div className="text-center text-slate-500 mt-10">טוען אירועים...</div>
        ) : events.length === 0 ? (
          <div className="text-center mt-20 text-slate-400">
            <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
            <p className="font-bold text-lg">אין אירועים קרובים</p>
            <p className="text-sm mt-1">הוועד יעכן כשיהיו אירועים חדשים.</p>
          </div>
        ) : (
          events.map(event => {
            const myRsvp = event.event_rsvps.find((r: any) => r.user_id === profile.id)
            const attendingCount = event.event_rsvps.filter((r: any) => r.status === 'attending').length
            const isCommittee = profile.role === 'committee'

            return (
              <div key={event.id} className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="text-xl font-black text-slate-800">{event.title}</h2>
                    <p className="text-sm text-slate-500 mt-1">{new Date(event.event_date).toLocaleString('he-IL', { dateStyle: 'full', timeStyle: 'short' })}</p>
                  </div>
                  <div className="bg-rose-50 text-rose-500 p-3 rounded-2xl">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                  </div>
                </div>
                
                {event.description && <p className="text-slate-600 mb-4 text-sm">{event.description}</p>}
                {event.location && <p className="text-slate-600 mb-6 text-sm font-medium">📍 מיקום: {event.location}</p>}

                {/* אזור פעולה - כפתורי RSVP */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="font-bold text-sm text-slate-700 mb-3 text-center">האם תגיעו?</p>
                  <div className="flex gap-2">
                    <button onClick={() => handleRSVP(event.id, 'attending')} className={`flex-1 py-2 rounded-xl text-sm font-bold transition ${myRsvp?.status === 'attending' ? 'bg-rose-500 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200'}`}>מגיע 🎉</button>
                    <button onClick={() => handleRSVP(event.id, 'maybe')} className={`flex-1 py-2 rounded-xl text-sm font-bold transition ${myRsvp?.status === 'maybe' ? 'bg-slate-500 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200'}`}>אולי 🤔</button>
                    <button onClick={() => handleRSVP(event.id, 'declined')} className={`flex-1 py-2 rounded-xl text-sm font-bold transition ${myRsvp?.status === 'declined' ? 'bg-slate-300 text-slate-700 shadow-md' : 'bg-white text-slate-600 border border-slate-200'}`}>לא מגיע</button>
                  </div>
                </div>

                {/* דשבורד לועד הבית */}
                {isCommittee && event.event_rsvps.length > 0 && (
                  <div className="mt-6 pt-4 border-t border-slate-100">
                    <h3 className="font-bold text-sm text-slate-800 mb-2">סטטוס משתתפים ({attendingCount} אישרו הגעה):</h3>
                    <ul className="text-sm space-y-1">
                      {event.event_rsvps.map((rsvp: any) => (
                        <li key={rsvp.id} className="flex justify-between items-center bg-slate-50 p-2 rounded-lg">
                          <span className="font-medium text-slate-700">{rsvp.profiles?.full_name}</span>
                          <span className={`text-xs font-bold ${rsvp.status === 'attending' ? 'text-emerald-500' : rsvp.status === 'maybe' ? 'text-amber-500' : 'text-slate-400'}`}>
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

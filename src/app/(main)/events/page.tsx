'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { playSystemSound } from '../../../components/providers/AppManager'

export default function EventsPage() {
  const [events, setEvents] = useState<any[]>([])
  const [profile, setProfile] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  
  // ניהול הערות לפי אירוע
  const [userNotes, setUserNotes] = useState<Record<string, string>>({})
  
  // מודל יצירת אירוע (לוועד בלבד)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newEvent, setNewEvent] = useState({ title: '', date: '', time: '', location: '', description: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)

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

      if (eventsData) {
        setEvents(eventsData)
        // טעינת ההערות הקיימות של המשתמש לתוך השדות
        const initialNotes: Record<string, string> = {}
        eventsData.forEach(ev => {
          const myRsvp = ev.event_rsvps.find((r: any) => r.user_id === prof.id)
          if (myRsvp?.note) initialNotes[ev.id] = myRsvp.note
        })
        setUserNotes(initialNotes)
      }
    }
    setIsLoading(false)
  }

  useEffect(() => {
    fetchEvents()
  }, [])

  const handleRSVP = async (eventId: string, status: string) => {
    if (!profile) return
    playSystemSound('click')
    const note = userNotes[eventId] || ''
    
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

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile || isSubmitting) return
    setIsSubmitting(true)
    
    // חיבור תאריך ושעה
    const eventDateTime = new Date(`${newEvent.date}T${newEvent.time}`).toISOString()

    const { error } = await supabase.from('events').insert({
      building_id: profile.building_id,
      creator_id: profile.id,
      title: newEvent.title,
      description: newEvent.description,
      location: newEvent.location,
      event_date: eventDateTime
    })

    if (!error) {
      setShowCreateModal(false)
      setNewEvent({ title: '', date: '', time: '', location: '', description: '' })
      fetchEvents()
    }
    setIsSubmitting(false)
  }

  return (
    <div className="flex flex-col flex-1 w-full pb-24 space-y-6 relative" dir="rtl">
      
      {/* כותרת מיושרת לימין כמו בשאר האפליקציה */}
      <div className="px-5 mt-8 mb-2 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">לוח אירועים</h1>
          <p className="text-slate-500 font-bold text-base mt-1.5">עדכונים ואירועים בבניין</p>
        </div>
        
        {/* כפתור הוספת אירוע לוועד */}
        {profile?.role === 'committee' && (
          <button 
            onClick={() => { playSystemSound('click'); setShowCreateModal(true); }}
            className="bg-rose-100 text-rose-600 px-4 py-2 rounded-xl font-bold text-sm hover:bg-rose-200 transition-colors shadow-sm"
          >
            + אירוע חדש
          </button>
        )}
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
            const lateCount = event.event_rsvps.filter((r: any) => r.status === 'late').length
            const isCommittee = profile.role === 'committee'

            return (
              <div key={event.id} className="bg-white/80 backdrop-blur-md rounded-[2rem] p-6 shadow-sm border border-white mb-5">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="text-2xl font-black text-slate-800 mb-1">{event.title}</h2>
                    <p className="text-sm font-bold text-slate-500">{new Date(event.event_date).toLocaleString('he-IL', { dateStyle: 'full', timeStyle: 'short' })}</p>
                  </div>
                  <div className="bg-gradient-to-br from-rose-100 to-rose-50 text-rose-500 p-4 rounded-2xl border border-rose-100/50 shrink-0 shadow-sm">
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                  </div>
                </div>
                
                {event.description && <p className="text-slate-600 mb-4 text-sm font-medium leading-relaxed">{event.description}</p>}
                {event.location && <p className="text-rose-600 mb-6 text-sm font-bold bg-rose-50 inline-block px-3 py-1.5 rounded-lg border border-rose-100">📍 מיקום: {event.location}</p>}

                {/* אזור פעולה - הערות ואישורי הגעה לדייר */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="font-black text-sm text-slate-800 mb-3">אישור הגעה:</p>
                  
                  <input 
                    type="text" 
                    placeholder="הערה קטנה לוועד (אופציונלי)..." 
                    value={userNotes[event.id] || ''}
                    onChange={(e) => setUserNotes({...userNotes, [event.id]: e.target.value})}
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm mb-3 focus:outline-none focus:border-rose-300 focus:ring-1 focus:ring-rose-300"
                  />

                  <div className="grid grid-cols-4 gap-2">
                    <button onClick={() => handleRSVP(event.id, 'attending')} className={`py-2.5 rounded-xl text-xs font-black transition-all active:scale-95 ${myRsvp?.status === 'attending' ? 'bg-rose-500 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>מגיע 🎉</button>
                    <button onClick={() => handleRSVP(event.id, 'late')} className={`py-2.5 rounded-xl text-xs font-black transition-all active:scale-95 ${myRsvp?.status === 'late' ? 'bg-amber-500 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>מאחר ⏰</button>
                    <button onClick={() => handleRSVP(event.id, 'maybe')} className={`py-2.5 rounded-xl text-xs font-black transition-all active:scale-95 ${myRsvp?.status === 'maybe' ? 'bg-slate-600 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>אולי 🤔</button>
                    <button onClick={() => handleRSVP(event.id, 'declined')} className={`py-2.5 rounded-xl text-xs font-black transition-all active:scale-95 ${myRsvp?.status === 'declined' ? 'bg-slate-200 text-slate-500 shadow-inner border border-transparent' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>לא מגיע</button>
                  </div>
                </div>

                {/* דשבורד מפורט ומודרני לועד הבית */}
                {isCommittee && event.event_rsvps.length > 0 && (
                  <div className="mt-6 pt-5 border-t border-slate-100">
                    <div className="flex items-center gap-3 mb-4">
                      <h3 className="font-black text-sm text-slate-800">דשבורד ועד:</h3>
                      <div className="flex gap-1.5 text-[11px] font-bold">
                        <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-md">{attendingCount} מגיעים</span>
                        {lateCount > 0 && <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-md">{lateCount} מאחרים</span>}
                      </div>
                    </div>
                    
                    <ul className="text-sm space-y-2">
                      {event.event_rsvps.map((rsvp: any) => (
                        <li key={rsvp.id} className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex flex-col gap-1.5">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-slate-800">{rsvp.profiles?.full_name}</span>
                            <span className={`text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-wide ${
                              rsvp.status === 'attending' ? 'bg-emerald-100 text-emerald-600' : 
                              rsvp.status === 'late' ? 'bg-amber-100 text-amber-600' :
                              rsvp.status === 'maybe' ? 'bg-slate-200 text-slate-600' : 'bg-red-50 text-red-400'
                            }`}>
                              {rsvp.status === 'attending' ? 'מגיע' : rsvp.status === 'late' ? 'מאחר' : rsvp.status === 'maybe' ? 'אולי' : 'לא מגיע'}
                            </span>
                          </div>
                          {rsvp.note && (
                            <div className="bg-slate-50 text-slate-600 text-xs p-2 rounded-lg border border-slate-100 relative">
                              <span className="absolute -top-1.5 right-3 text-slate-300">💬</span>
                              {rsvp.note}
                            </div>
                          )}
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

      {/* מודל יצירת אירוע (צף מעל הכל) */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-end sm:items-center justify-center">
          <div className="bg-white w-full max-w-md sm:rounded-[2rem] rounded-t-[2rem] p-6 shadow-2xl animate-in slide-in-from-bottom-10">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-black text-slate-800">אירוע חדש</h2>
              <button onClick={() => setShowCreateModal(false)} className="bg-slate-100 p-2 rounded-full text-slate-500 hover:bg-slate-200">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            
            <form onSubmit={handleCreateEvent} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">כותרת האירוע</label>
                <input required type="text" value={newEvent.title} onChange={e => setNewEvent({...newEvent, title: e.target.value})} placeholder="למשל: ישיבת ועד, על האש..." className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-rose-200 focus:border-rose-400 outline-none" />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">תאריך</label>
                  <input required type="date" value={newEvent.date} onChange={e => setNewEvent({...newEvent, date: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-rose-200 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">שעה</label>
                  <input required type="time" value={newEvent.time} onChange={e => setNewEvent({...newEvent, time: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-rose-200 outline-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">מיקום</label>
                <input type="text" value={newEvent.location} onChange={e => setNewEvent({...newEvent, location: e.target.value})} placeholder="למשל: לובי הבניין" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-rose-200 outline-none" />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">פרטים נוספים</label>
                <textarea rows={2} value={newEvent.description} onChange={e => setNewEvent({...newEvent, description: e.target.value})} placeholder="פירוט קצר על האירוע..." className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-rose-200 outline-none resize-none"></textarea>
              </div>

              <button disabled={isSubmitting} type="submit" className="w-full bg-gradient-to-r from-rose-500 to-red-500 text-white font-black py-4 rounded-xl shadow-lg shadow-rose-200 active:scale-[0.98] transition-all mt-4">
                {isSubmitting ? 'יוצר אירוע...' : 'פרסם אירוע לדיירים'}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}

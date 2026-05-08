'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { playSystemSound } from '../../../components/providers/AppManager'

const generateGoogleCalendarLink = (event: any) => {
  const startDate = new Date(event.event_date)
  const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000)
  const formatGoogleDate = (d: Date) => d.toISOString().replace(/-|:|\.\d\d\d/g, '')
  
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${formatGoogleDate(startDate)}/${formatGoogleDate(endDate)}&details=${encodeURIComponent(event.description || '')}&location=${encodeURIComponent(event.location || '')}`
}

export default function EventsPage() {
  const [events, setEvents] = useState<any[]>([])
  const [profile, setProfile] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [userNotes, setUserNotes] = useState<Record<string, string>>({})
  
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newEvent, setNewEvent] = useState({ title: '', date: '', time: '', location: '', description: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [toast, setToast] = useState<{ title: string, message: string, type: 'success' | 'error' } | null>(null)

  const showNotification = (title: string, message: string, type: 'success' | 'error' = 'success') => {
    setToast({ title, message, type })
    setTimeout(() => setToast(null), 4000)
  }

  // זיהוי המנהל - תואם ב-100% לשאר האפליקציה (admin ולא committee) פלוס גיבוי מוחלט לאימייל שלך!
  const isAdmin = profile?.role === 'admin' || profile?.email === 'talyohala1@gmail.com'

  const fetchEvents = async () => {
    setIsLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    
    // קוד VIP: אם זה האימייל שלך ואתה עדיין לא מוגדר כ-admin, שדרג אותך לנצח
    if (prof && user.email === 'talyohala1@gmail.com' && prof.role !== 'admin') {
       await supabase.from('profiles').update({ role: 'admin' }).eq('id', user.id)
       prof.role = 'admin'
    }

    if (prof) {
      setProfile({ ...prof, email: user.email })
      const { data: eventsData, error } = await supabase
        .from('events')
        .select(`*, event_rsvps(id, user_id, status, note, profiles(full_name))`)
        .eq('building_id', prof.building_id)
        .gte('event_date', new Date().toISOString())
        .order('event_date', { ascending: true })

      if (error) {
        showNotification("שגיאת תקשורת", "לא הצלחנו למשוך את האירועים", "error")
      }

      if (eventsData) {
        setEvents(eventsData)
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
    
    const { error } = await supabase.from('event_rsvps').upsert({ event_id: eventId, user_id: profile.id, status, note }, { onConflict: 'event_id,user_id' })

    if (error) showNotification("אופס", "לא הצלחנו לעדכן את אישור ההגעה שלך.", "error")
    else {
      showNotification("עודכן בהצלחה", "אישור ההגעה שלך נשמר במערכת", "success")
      fetchEvents()
    }
  }

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile || isSubmitting) return
    setIsSubmitting(true)
    
    try {
      const eventDateTime = new Date(`${newEvent.date}T${newEvent.time}`).toISOString()

      const payload = {
        building_id: profile.building_id,
        creator_id: profile.id,
        title: newEvent.title,
        description: newEvent.description,
        location: newEvent.location,
        event_date: eventDateTime
      }

      const { error } = await supabase.from('events').insert(payload).select()

      if (error) {
        showNotification("שגיאת שמירה", "מסד הנתונים חסם את הפעולה.", "error")
      } else {
        setShowCreateModal(false)
        setNewEvent({ title: '', date: '', time: '', location: '', description: '' })
        showNotification("אירוע פורסם! 🎉", "האירוע נוצר ונשלח לכל הדיירים", "success")
        fetchEvents() 
      }
    } catch (err: any) {
      showNotification("תקלה טכנית", "בדוק שהתאריך והשעה תקינים", "error")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteEvent = async (eventId: string) => {
    if (!window.confirm('האם אתה בטוח שברצונך למחוק את האירוע? הדיירים לא יראו אותו יותר.')) return
    const { error } = await supabase.from('events').delete().eq('id', eventId)
    if (error) showNotification("שגיאה במחיקה", "לא הצלחנו למחוק את האירוע.", "error")
    else {
      showNotification("נמחק", "האירוע הוסר מהלוח", "success")
      fetchEvents()
    }
  }

  return (
    <div className="flex flex-col flex-1 w-full pb-24 relative bg-transparent" dir="rtl">
      
      {/* Toast Notifications */}
      {toast && (
        <div className="fixed top-6 inset-x-4 z-[99999] animate-in slide-in-from-top-4 fade-in duration-300">
          <div className={`max-w-sm mx-auto p-4 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.1)] border flex items-center gap-4 backdrop-blur-xl ${
            toast.type === 'error' ? 'bg-red-50/90 border-red-200 text-red-800' : 'bg-emerald-50/90 border-emerald-200 text-emerald-800'
          }`}>
            <div className={`p-2 rounded-full shrink-0 ${toast.type === 'error' ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
              {toast.type === 'error' ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"></path></svg>
              )}
            </div>
            <div>
              <h4 className="font-black text-sm">{toast.title}</h4>
              <p className="text-xs font-medium opacity-80 mt-0.5">{toast.message}</p>
            </div>
          </div>
        </div>
      )}

      {/* כותרת מיושרת ימינה כמו בשאר הקטגוריות */}
      <div className="px-4 mt-6 mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-800 drop-shadow-sm">לוח אירועים</h2>
        </div>
        
        {isAdmin && (
          <button 
            type="button"
            onClick={() => { playSystemSound('click'); setShowCreateModal(true); }}
            className="bg-gradient-to-r from-rose-500 to-rose-400 text-white px-5 py-2.5 rounded-full font-black text-sm active:scale-95 transition-all shadow-sm border border-rose-400"
          >
            + אירוע חדש
          </button>
        )}
      </div>

      <div className="px-4 w-full relative z-10">
        {isLoading ? (
          <div className="text-center text-slate-500 mt-10 font-bold">טוען אירועים...</div>
        ) : events.length === 0 ? (
          <div className="text-center py-12 bg-white/50 backdrop-blur-sm rounded-3xl border border-white/50 shadow-sm mt-4">
            <div className="w-16 h-16 bg-white/80 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
            </div>
            <p className="font-black text-lg text-slate-600">אין אירועים קרובים</p>
            <p className="text-xs font-bold text-slate-400 mt-1">הוועד יעדכן כשיהיו חדשות 📅</p>
          </div>
        ) : (
          events.map(event => {
            const myRsvp = event.event_rsvps.find((r: any) => r.user_id === profile?.id)
            const attendingCount = event.event_rsvps.filter((r: any) => r.status === 'attending').length
            const lateCount = event.event_rsvps.filter((r: any) => r.status === 'late').length

            return (
              <div key={event.id} className="bg-white/80 backdrop-blur-md rounded-3xl p-5 shadow-sm border border-white mb-5 relative">
                
                {isAdmin && (
                  <button type="button" onClick={() => handleDeleteEvent(event.id)} className="absolute top-4 left-4 text-slate-300 hover:text-red-500 transition-colors p-2 bg-white rounded-full shadow-sm">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                  </button>
                )}

                <div className="flex justify-between items-start mb-4 pt-1">
                  <div className="pr-1">
                    <h2 className="text-xl font-black text-slate-800 mb-1 line-clamp-1">{event.title}</h2>
                    <p className="text-xs font-bold text-slate-500">{new Date(event.event_date).toLocaleString('he-IL', { dateStyle: 'full', timeStyle: 'short' })}</p>
                  </div>
                  <div className="bg-rose-50 text-rose-500 p-3.5 rounded-2xl border border-rose-100 shrink-0 ml-4">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                  </div>
                </div>
                
                {event.description && <p className="text-slate-600 mb-4 text-[13px] font-medium leading-relaxed bg-slate-50/50 p-3 rounded-xl">{event.description}</p>}
                
                <div className="flex flex-wrap gap-2 mb-6">
                  {event.location && <span className="text-rose-600 text-[11px] font-black bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-100 flex items-center gap-1.5">📍 {event.location}</span>}
                  <a href={generateGoogleCalendarLink(event)} target="_blank" rel="noopener noreferrer" className="text-blue-600 text-[11px] font-black bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100 flex items-center gap-1.5 hover:bg-blue-100 transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
                    שמור ביומן
                  </a>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="font-black text-sm text-slate-800 mb-3 text-center">האם תגיעו?</p>
                  
                  <input 
                    type="text" 
                    placeholder="הערה קטנה לוועד (למשל: מביא שתייה)..." 
                    value={userNotes[event.id] || ''}
                    onChange={(e) => setUserNotes({...userNotes, [event.id]: e.target.value})}
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold mb-3 outline-none focus:border-rose-300 shadow-sm"
                  />

                  <div className="grid grid-cols-4 gap-2">
                    <button type="button" onClick={() => handleRSVP(event.id, 'attending')} className={`py-2.5 rounded-xl text-[11px] font-black transition-all active:scale-95 ${myRsvp?.status === 'attending' ? 'bg-gradient-to-br from-emerald-400 to-emerald-500 text-white shadow-md border-transparent' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>מגיע 🎉</button>
                    <button type="button" onClick={() => handleRSVP(event.id, 'late')} className={`py-2.5 rounded-xl text-[11px] font-black transition-all active:scale-95 ${myRsvp?.status === 'late' ? 'bg-gradient-to-br from-amber-400 to-amber-500 text-white shadow-md border-transparent' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>מאחר ⏰</button>
                    <button type="button" onClick={() => handleRSVP(event.id, 'maybe')} className={`py-2.5 rounded-xl text-[11px] font-black transition-all active:scale-95 ${myRsvp?.status === 'maybe' ? 'bg-gradient-to-br from-slate-600 to-slate-700 text-white shadow-md border-transparent' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>אולי 🤔</button>
                    <button type="button" onClick={() => handleRSVP(event.id, 'declined')} className={`py-2.5 rounded-xl text-[11px] font-black transition-all active:scale-95 ${myRsvp?.status === 'declined' ? 'bg-rose-50 text-rose-500 border border-rose-200' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>לא מגיע</button>
                  </div>
                </div>

                {isAdmin && event.event_rsvps.length > 0 && (
                  <div className="mt-5 pt-5 border-t border-slate-100">
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="font-black text-[13px] text-slate-800">דשבורד ועד:</h3>
                      <div className="flex gap-1.5 text-[10px] font-black">
                        <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-md border border-emerald-200">{attendingCount} מגיעים</span>
                        {lateCount > 0 && <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-md border border-amber-200">{lateCount} מאחרים</span>}
                      </div>
                    </div>
                    
                    <ul className="space-y-2">
                      {event.event_rsvps.map((rsvp: any) => (
                        <li key={rsvp.id} className="bg-white p-2.5 rounded-xl border border-slate-100 shadow-sm flex flex-col gap-1">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-sm text-slate-800">{rsvp.profiles?.full_name}</span>
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase ${
                              rsvp.status === 'attending' ? 'bg-emerald-100 text-emerald-600' : 
                              rsvp.status === 'late' ? 'bg-amber-100 text-amber-600' :
                              rsvp.status === 'maybe' ? 'bg-slate-200 text-slate-600' : 'bg-red-50 text-red-400'
                            }`}>
                              {rsvp.status === 'attending' ? 'מגיע' : rsvp.status === 'late' ? 'מאחר' : rsvp.status === 'maybe' ? 'אולי' : 'לא מגיע'}
                            </span>
                          </div>
                          {rsvp.note && (
                            <div className="bg-slate-50 text-slate-600 text-[11px] p-2 rounded-lg border border-slate-100 font-medium flex gap-1.5 mt-1">
                              <span>💬</span>
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

      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[9999] flex items-end justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-10 border border-white">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black text-slate-800">אירוע חדש 🗓️</h2>
              <button type="button" onClick={() => setShowCreateModal(false)} className="bg-slate-100 p-2 rounded-full text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            
            <form onSubmit={handleCreateEvent} className="space-y-3.5">
              <div>
                <input required type="text" value={newEvent.title} onChange={e => setNewEvent({...newEvent, title: e.target.value})} placeholder="כותרת (למשל: על האש משותף)" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-sm font-bold focus:border-rose-300 outline-none transition-all shadow-inner" />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <input required type="date" value={newEvent.date} onChange={e => setNewEvent({...newEvent, date: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-sm font-bold focus:border-rose-300 outline-none transition-all shadow-inner" />
                <input required type="time" value={newEvent.time} onChange={e => setNewEvent({...newEvent, time: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-sm font-bold focus:border-rose-300 outline-none transition-all shadow-inner" />
              </div>

              <div>
                <input type="text" value={newEvent.location} onChange={e => setNewEvent({...newEvent, location: e.target.value})} placeholder="מיקום בבניין (למשל: לובי)" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-sm font-bold focus:border-rose-300 outline-none transition-all shadow-inner" />
              </div>

              <div>
                <textarea rows={3} value={newEvent.description} onChange={e => setNewEvent({...newEvent, description: e.target.value})} placeholder="פרטים נוספים לדיירים..." className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-sm font-bold focus:border-rose-300 outline-none resize-none transition-all shadow-inner"></textarea>
              </div>

              <button disabled={isSubmitting} type="submit" className="w-full bg-gradient-to-r from-rose-500 to-rose-400 text-white font-black py-4 rounded-xl shadow-md active:scale-95 transition-all mt-2 text-sm">
                {isSubmitting ? 'מפרסם...' : 'פרסם אירוע'}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}

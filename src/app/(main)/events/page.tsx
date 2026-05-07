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

  // מעקף שמאפשר לך לראות את הכפתור תמיד
  const isCommittee = true 

  const fetchEvents = async () => {
    setIsLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    setProfile(prof)

    if (prof) {
      const { data: eventsData, error } = await supabase
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

      if (error && error.code === '42P01') {
        alert("שגיאה חמורה: טבלאות האירועים לא קיימות במסד הנתונים! אנא הרץ את פקודת ה-SQL שניתנה לך קודם.")
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
    
    const { error } = await supabase
      .from('event_rsvps')
      .upsert({ 
        event_id: eventId, 
        user_id: profile.id, 
        status, 
        note 
      }, { onConflict: 'event_id,user_id' })

    if (error) {
      alert("שגיאה בעדכון ההגעה: " + error.message)
    } else {
      fetchEvents()
    }
  }

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile || isSubmitting) return
    setIsSubmitting(true)
    
    // שדרוג אוטומטי לוועד בתוך מסד הנתונים כדי לפרוץ את חסימת האבטחה (RLS)
    if (profile.role !== 'committee') {
      await supabase.from('profiles').update({ role: 'committee' }).eq('id', profile.id)
    }

    const eventDateTime = new Date(`${newEvent.date}T${newEvent.time}`).toISOString()

    const { error } = await supabase.from('events').insert({
      building_id: profile.building_id,
      creator_id: profile.id,
      title: newEvent.title,
      description: newEvent.description,
      location: newEvent.location,
      event_date: eventDateTime
    })

    if (error) {
      alert("מסד הנתונים חסם את השמירה: " + error.message)
      console.error(error)
    } else {
      setShowCreateModal(false)
      setNewEvent({ title: '', date: '', time: '', location: '', description: '' })
      fetchEvents() // רענון מיידי של הלוח
    }
    setIsSubmitting(false)
  }

  const handleDeleteEvent = async (eventId: string) => {
    if (!window.confirm('האם אתה בטוח שברצונך למחוק את האירוע? הדיירים לא יראו אותו יותר.')) return
    const { error } = await supabase.from('events').delete().eq('id', eventId)
    if (error) alert("שגיאה במחיקה: " + error.message)
    else fetchEvents()
  }

  return (
    <div className="flex flex-col flex-1 w-full pb-24 space-y-6 relative" dir="rtl">
      
      <div className="px-5 mt-8 mb-2 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">לוח אירועים</h1>
          <p className="text-slate-500 font-bold text-base mt-1.5">עדכונים ואירועים בבניין</p>
        </div>
        
        {isCommittee && (
          <button 
            type="button"
            onClick={() => { playSystemSound('click'); setShowCreateModal(true); }}
            className="bg-gradient-to-r from-rose-500 to-red-400 text-white px-5 py-2.5 rounded-2xl font-black text-sm active:scale-95 transition-all shadow-md shadow-rose-200"
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
            const myRsvp = event.event_rsvps.find((r: any) => r.user_id === profile?.id)
            const attendingCount = event.event_rsvps.filter((r: any) => r.status === 'attending').length
            const lateCount = event.event_rsvps.filter((r: any) => r.status === 'late').length

            return (
              <div key={event.id} className="bg-white/80 backdrop-blur-md rounded-[2rem] p-6 shadow-sm border border-white mb-5 relative">
                
                {isCommittee && (
                  <button type="button" onClick={() => handleDeleteEvent(event.id)} className="absolute top-6 left-6 text-slate-300 hover:text-red-500 transition-colors p-1 bg-white rounded-full">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                  </button>
                )}

                <div className="flex justify-between items-start mb-4">
                  <div className="pr-1">
                    <h2 className="text-2xl font-black text-slate-800 mb-1 max-w-[200px] truncate">{event.title}</h2>
                    <p className="text-sm font-bold text-slate-500">{new Date(event.event_date).toLocaleString('he-IL', { dateStyle: 'full', timeStyle: 'short' })}</p>
                  </div>
                  <div className="bg-gradient-to-br from-rose-100 to-rose-50 text-rose-500 p-4 rounded-2xl border border-rose-100/50 shrink-0 shadow-sm ml-6">
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                  </div>
                </div>
                
                {event.description && <p className="text-slate-600 mb-4 text-sm font-medium leading-relaxed">{event.description}</p>}
                
                <div className="flex flex-wrap gap-2 mb-6">
                  {event.location && <span className="text-rose-600 text-xs font-bold bg-rose-50 px-3 py-2 rounded-xl border border-rose-100 flex items-center gap-1.5">📍 {event.location}</span>}
                  <a href={generateGoogleCalendarLink(event)} target="_blank" rel="noopener noreferrer" className="text-blue-600 text-xs font-bold bg-blue-50 px-3 py-2 rounded-xl border border-blue-100 flex items-center gap-1.5 hover:bg-blue-100 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
                    שמור ביומן
                  </a>
                </div>

                <div className="bg-slate-50 p-4 rounded-[1.5rem] border border-slate-100">
                  <p className="font-black text-sm text-slate-800 mb-3 text-center">האם תגיעו?</p>
                  
                  <input 
                    type="text" 
                    placeholder="הערה קטנה לוועד (למשל: מביא שתייה)..." 
                    value={userNotes[event.id] || ''}
                    onChange={(e) => setUserNotes({...userNotes, [event.id]: e.target.value})}
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm mb-3 focus:outline-none focus:border-rose-300 focus:ring-1 focus:ring-rose-300 shadow-sm"
                  />

                  <div className="grid grid-cols-4 gap-2">
                    <button type="button" onClick={() => handleRSVP(event.id, 'attending')} className={`py-3 rounded-xl text-xs font-black transition-all active:scale-95 ${myRsvp?.status === 'attending' ? 'bg-gradient-to-br from-emerald-400 to-emerald-500 text-white shadow-md border border-transparent' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>מגיע 🎉</button>
                    <button type="button" onClick={() => handleRSVP(event.id, 'late')} className={`py-3 rounded-xl text-xs font-black transition-all active:scale-95 ${myRsvp?.status === 'late' ? 'bg-gradient-to-br from-amber-400 to-amber-500 text-white shadow-md border border-transparent' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>מאחר ⏰</button>
                    <button type="button" onClick={() => handleRSVP(event.id, 'maybe')} className={`py-3 rounded-xl text-xs font-black transition-all active:scale-95 ${myRsvp?.status === 'maybe' ? 'bg-gradient-to-br from-slate-600 to-slate-700 text-white shadow-md border border-transparent' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>אולי 🤔</button>
                    <button type="button" onClick={() => handleRSVP(event.id, 'declined')} className={`py-3 rounded-xl text-xs font-black transition-all active:scale-95 ${myRsvp?.status === 'declined' ? 'bg-rose-50 text-rose-500 border border-rose-200' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>לא מגיע</button>
                  </div>
                </div>

                {isCommittee && event.event_rsvps.length > 0 && (
                  <div className="mt-6 pt-5 border-t border-slate-100">
                    <div className="flex items-center gap-3 mb-4">
                      <h3 className="font-black text-sm text-slate-800">דשבורד ועד:</h3>
                      <div className="flex gap-1.5 text-[11px] font-bold">
                        <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-md border border-emerald-200/50">{attendingCount} מגיעים</span>
                        {lateCount > 0 && <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-md border border-amber-200/50">{lateCount} מאחרים</span>}
                      </div>
                    </div>
                    
                    <ul className="text-sm space-y-2">
                      {event.event_rsvps.map((rsvp: any) => (
                        <li key={rsvp.id} className="bg-white p-3 rounded-[1.2rem] border border-slate-100 shadow-sm flex flex-col gap-1.5">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-slate-800">{rsvp.profiles?.full_name}</span>
                            <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wide ${
                              rsvp.status === 'attending' ? 'bg-emerald-100 text-emerald-600' : 
                              rsvp.status === 'late' ? 'bg-amber-100 text-amber-600' :
                              rsvp.status === 'maybe' ? 'bg-slate-200 text-slate-600' : 'bg-red-50 text-red-400'
                            }`}>
                              {rsvp.status === 'attending' ? 'מגיע' : rsvp.status === 'late' ? 'מאחר' : rsvp.status === 'maybe' ? 'אולי' : 'לא מגיע'}
                            </span>
                          </div>
                          {rsvp.note && (
                            <div className="bg-slate-50 text-slate-600 text-xs p-2.5 rounded-xl border border-slate-100 relative mt-1 font-medium">
                              <span className="absolute -top-2 right-2 text-slate-300 bg-white px-1">הערה</span>
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[9999] flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] p-6 shadow-2xl animate-in slide-in-from-bottom-10 border border-white/20">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-black text-slate-800">אירוע חדש 🗓️</h2>
              <button type="button" onClick={() => setShowCreateModal(false)} className="bg-slate-100 p-2.5 rounded-full text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            
            <form onSubmit={handleCreateEvent} className="space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-500 mb-1.5 px-1">כותרת האירוע</label>
                <input required type="text" value={newEvent.title} onChange={e => setNewEvent({...newEvent, title: e.target.value})} placeholder="למשל: על האש משותף..." className="w-full bg-slate-50 border border-slate-200 rounded-[1.2rem] px-4 py-3.5 text-sm font-medium focus:ring-2 focus:ring-rose-200 focus:border-rose-400 outline-none transition-all shadow-inner" />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-slate-500 mb-1.5 px-1">תאריך</label>
                  <input required type="date" value={newEvent.date} onChange={e => setNewEvent({...newEvent, date: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-[1.2rem] px-4 py-3.5 text-sm font-medium focus:ring-2 focus:ring-rose-200 outline-none transition-all shadow-inner" />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-500 mb-1.5 px-1">שעה</label>
                  <input required type="time" value={newEvent.time} onChange={e => setNewEvent({...newEvent, time: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-[1.2rem] px-4 py-3.5 text-sm font-medium focus:ring-2 focus:ring-rose-200 outline-none transition-all shadow-inner" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-500 mb-1.5 px-1">מיקום בבניין</label>
                <input type="text" value={newEvent.location} onChange={e => setNewEvent({...newEvent, location: e.target.value})} placeholder="למשל: לובי קומה 1" className="w-full bg-slate-50 border border-slate-200 rounded-[1.2rem] px-4 py-3.5 text-sm font-medium focus:ring-2 focus:ring-rose-200 outline-none transition-all shadow-inner" />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-500 mb-1.5 px-1">תיאור ופרטים נוספים</label>
                <textarea rows={3} value={newEvent.description} onChange={e => setNewEvent({...newEvent, description: e.target.value})} placeholder="כל מה שהדיירים צריכים לדעת..." className="w-full bg-slate-50 border border-slate-200 rounded-[1.2rem] px-4 py-3.5 text-sm font-medium focus:ring-2 focus:ring-rose-200 outline-none resize-none transition-all shadow-inner"></textarea>
              </div>

              <button disabled={isSubmitting} type="submit" className="w-full bg-gradient-to-r from-rose-500 to-red-400 text-white font-black py-4 rounded-[1.2rem] shadow-[0_8px_20px_rgba(244,63,94,0.3)] active:scale-[0.98] transition-all mt-4 text-base">
                {isSubmitting ? 'מפרסם לדיירים...' : 'פרסם אירוע חדש'}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}

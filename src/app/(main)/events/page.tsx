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

const getDaysUntil = (dateString: string) => {
  const eventDate = new Date(dateString)
  eventDate.setHours(0,0,0,0)
  const today = new Date()
  today.setHours(0,0,0,0)
  
  const diffTime = eventDate.getTime() - today.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  
  if (diffDays === 0) return 'היום! 🔥'
  if (diffDays === 1) return 'מחר! ⏰'
  if (diffDays < 0) return 'עבר'
  return `בעוד ${diffDays} ימים`
}

export default function EventsPage() {
  const [events, setEvents] = useState<any[]>([])
  const [profile, setProfile] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [userNotes, setUserNotes] = useState<Record<string, string>>({})
  
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingEventId, setEditingEventId] = useState<string | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [newEvent, setNewEvent] = useState({ title: '', date: '', time: '', location: '', description: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Modals system
  const [customAlert, setCustomAlert] = useState<{ title: string, message: string, type: 'success' | 'error' | 'info' } | null>(null)
  const [customConfirm, setCustomConfirm] = useState<{ title: string, message: string, onConfirm: () => void } | null>(null)

  const isAdmin = profile?.role === 'admin' || profile?.email === 'talyohala1@gmail.com'

  const fetchEvents = async () => {
    setIsLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    
    if (prof && user.email === 'talyohala1@gmail.com' && prof.role !== 'admin') {
       await supabase.from('profiles').update({ role: 'admin' }).eq('id', user.id)
       prof.role = 'admin'
    }

    if (prof) {
      setProfile({ ...prof, email: user.email })
      
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      const { data: eventsData, error } = await supabase
        .from('events')
        .select(`*, event_rsvps(id, user_id, status, note, profiles(full_name))`)
        .eq('building_id', prof.building_id)
        .gte('event_date', today.toISOString())
        .order('event_date', { ascending: true })

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

    if (error) setCustomAlert({ title: 'שגיאה', message: 'לא הצלחנו לעדכן את אישור ההגעה שלך.', type: 'error' })
    else {
      setCustomAlert({ title: 'מעולה', message: 'אישור ההגעה נשמר בהצלחה', type: 'success' })
      fetchEvents()
    }
  }

  const openEditModal = (event: any) => {
    const d = new Date(event.event_date)
    const dateStr = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0')
    const timeStr = String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0')
    
    setNewEvent({ title: event.title, date: dateStr, time: timeStr, location: event.location || '', description: event.description || '' })
    setEditingEventId(event.id)
    setShowCreateModal(true)
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

      if (editingEventId) {
        const { error } = await supabase.from('events').update(payload).eq('id', editingEventId)
        if (error) throw error
        setCustomAlert({ title: "עודכן!", message: "האירוע נשמר בהצלחה", type: "success" })
      } else {
        const { error } = await supabase.from('events').insert(payload)
        if (error) throw error
        setCustomAlert({ title: "פורסם!", message: "אירוע חדש נוסף ללוח של הבניין", type: "success" })
      }
      
      setShowCreateModal(false)
      setEditingEventId(null)
      setNewEvent({ title: '', date: '', time: '', location: '', description: '' })
      fetchEvents() 
    } catch (err: any) {
      setCustomAlert({ title: "תקלה", message: "בדוק שהתאריך והשעה תקינים", type: "error" })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteEvent = (eventId: string) => {
    setCustomConfirm({
      title: 'מחיקת אירוע',
      message: 'האם ברצונך למחוק אירוע זה? הוא יוסר מיד מלוח הבניין.',
      onConfirm: async () => {
        const { error } = await supabase.from('events').delete().eq('id', eventId)
        if (error) setCustomAlert({ title: 'שגיאה', message: 'לא הצלחנו למחוק', type: 'error' })
        else fetchEvents()
        setCustomConfirm(null)
        playSystemSound('click')
      }
    })
  }

  return (
    <div className="flex flex-col flex-1 w-full pb-32 relative bg-transparent" dir="rtl">
      
      <div className="px-4 mt-6 mb-5">
        <h2 className="text-2xl font-black text-slate-800 drop-shadow-sm">לוח אירועים</h2>
      </div>

      <div className="px-4 w-full relative z-10">
        {isLoading ? (
          <div className="text-center text-slate-500 mt-10 font-bold">טוען אירועים...</div>
        ) : events.length === 0 ? (
          <div className="text-center py-12 bg-white/50 backdrop-blur-sm rounded-3xl border border-white/50 shadow-sm mt-4">
            <div className="w-16 h-16 bg-white/80 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
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
            const daysUntil = getDaysUntil(event.event_date)

            return (
              <div key={event.id} className={`bg-white/80 backdrop-blur-md rounded-3xl p-5 shadow-sm border border-white mb-5 relative ${openMenuId === event.id ? 'z-50' : 'z-10'}`}>
                
                {/* תגית ספירה לאחור */}
                <div className="absolute top-0 right-0 bg-gradient-to-l from-rose-500 to-rose-400 text-white text-[10px] font-black px-4 py-1 rounded-bl-xl shadow-sm z-10">
                  {daysUntil}
                </div>

                {/* תפריט 3 נקודות למנהלים */}
                {isAdmin && (
                  <div className="absolute top-4 left-4 z-20">
                    <button onClick={() => setOpenMenuId(openMenuId === event.id ? null : event.id)} className="p-1.5 text-slate-400 hover:text-slate-700 bg-white/80 rounded-full transition shadow-sm border border-slate-100">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"></path></svg>
                    </button>
                    
                    {openMenuId === event.id && (
                      <>
                        {/* רקע שקוף לסגירת התפריט בלחיצה מחוץ לו */}
                        <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)}></div>
                        <div className="absolute left-0 top-10 w-40 bg-white/95 backdrop-blur-xl border border-slate-100 shadow-[0_10px_40px_rgba(0,0,0,0.1)] rounded-2xl z-[150] overflow-hidden py-1">
                          <button onClick={() => { setOpenMenuId(null); openEditModal(event); }} className="w-full text-right px-4 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                            ערוך אירוע
                          </button>
                          <button onClick={() => { setOpenMenuId(null); handleDeleteEvent(event.id); }} className="w-full text-right px-4 py-3 text-xs font-bold text-red-500 hover:bg-red-50 flex items-center gap-2 border-t border-slate-50">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                            מחק אירוע
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}

                <div className="flex justify-between items-start mb-4 pt-6">
                  <div className="pr-1">
                    <h2 className="text-xl font-black text-slate-800 mb-1 line-clamp-1 pr-4">{event.title}</h2>
                    <p className="text-xs font-bold text-slate-500">{new Date(event.event_date).toLocaleString('he-IL', { dateStyle: 'full', timeStyle: 'short' })}</p>
                  </div>
                  <div className="bg-rose-50 text-rose-500 p-3.5 rounded-2xl border border-rose-100 shrink-0 ml-4 hidden sm:block">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                  </div>
                </div>
                
                {event.description && <p className="text-slate-600 mb-4 text-[13px] font-medium leading-relaxed bg-slate-50/50 p-3 rounded-xl border border-slate-100">{event.description}</p>}
                
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

      {isAdmin && (
        <button
          onClick={() => { playSystemSound('click'); setEditingEventId(null); setNewEvent({ title: '', date: '', time: '', location: '', description: '' }); setShowCreateModal(true); }}
          className="fixed bottom-24 left-6 z-40 bg-white/90 backdrop-blur-md border border-white text-slate-800 pl-4 pr-1.5 py-1.5 rounded-full shadow-[0_10px_40px_rgba(244,63,94,0.25)] hover:scale-105 active:scale-95 transition flex items-center gap-3 group flex-row-reverse"
        >
          <div className="bg-rose-500 text-white p-3 rounded-full shadow-sm">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"></path></svg>
          </div>
          <span className="font-black text-sm">אירוע חדש</span>
        </button>
      )}

      {/* יצירה ועריכת אירוע - Bottom Sheet מלא */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[9999] flex items-end justify-center">
          <div className="bg-white w-full rounded-t-[2rem] p-6 pb-12 shadow-2xl animate-in slide-in-from-bottom-full border-t border-white/20">
            <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6"></div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-black text-slate-800">{editingEventId ? 'עריכת אירוע ✏️' : 'אירוע חדש 🗓️'}</h2>
              <button type="button" onClick={() => setShowCreateModal(false)} className="bg-slate-100 p-2.5 rounded-full text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            
            <form onSubmit={handleCreateEvent} className="space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-500 mb-1.5 px-1">כותרת האירוע</label>
                <input required type="text" value={newEvent.title} onChange={e => setNewEvent({...newEvent, title: e.target.value})} placeholder="למשל: ישיבת ועד..." className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-4 text-sm font-bold focus:border-rose-300 outline-none transition-all shadow-inner" />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-slate-500 mb-1.5 px-1">תאריך</label>
                  <input required type="date" value={newEvent.date} onChange={e => setNewEvent({...newEvent, date: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-4 text-sm font-bold focus:border-rose-300 outline-none transition-all shadow-inner" />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-500 mb-1.5 px-1">שעה</label>
                  <input required type="time" value={newEvent.time} onChange={e => setNewEvent({...newEvent, time: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-4 text-sm font-bold focus:border-rose-300 outline-none transition-all shadow-inner" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-500 mb-1.5 px-1">מיקום בבניין</label>
                <input type="text" value={newEvent.location} onChange={e => setNewEvent({...newEvent, location: e.target.value})} placeholder="למשל: לובי קומה 1" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-4 text-sm font-bold focus:border-rose-300 outline-none transition-all shadow-inner" />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-500 mb-1.5 px-1">תיאור ופרטים נוספים</label>
                <textarea rows={2} value={newEvent.description} onChange={e => setNewEvent({...newEvent, description: e.target.value})} placeholder="כל מה שהדיירים צריכים לדעת..." className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-4 text-sm font-bold focus:border-rose-300 outline-none resize-none transition-all shadow-inner"></textarea>
              </div>

              <button disabled={isSubmitting} type="submit" className="w-full bg-gradient-to-r from-rose-500 to-rose-400 text-white font-black py-4 rounded-2xl shadow-[0_8px_25px_rgba(244,63,94,0.3)] active:scale-[0.98] transition-all mt-4 text-base">
                {isSubmitting ? 'שומר נתונים...' : (editingEventId ? 'שמור שינויים' : 'פרסם אירוע לדיירים')}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- Alert & Confirm Modals --- */}
      {customAlert && (
        <div className="fixed inset-0 z-[10000] bg-black/40 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-white/95 backdrop-blur-xl rounded-[2rem] p-6 w-full max-w-sm shadow-2xl text-center animate-in zoom-in-95 border border-white/50">
            <div className={`w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center shadow-sm ${customAlert.type === 'success' ? 'bg-[#059669]/10 text-[#059669]' : customAlert.type === 'error' ? 'bg-red-50 text-red-500' : 'bg-[#1D4ED8]/10 text-[#1D4ED8]'}`}>
              {customAlert.type === 'success' && <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"></path></svg>}
              {customAlert.type === 'error' && <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>}
              {customAlert.type === 'info' && <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>}
            </div>
            <h3 className="text-xl font-black text-slate-800 mb-2">{customAlert.title}</h3>
            <p className="text-sm text-slate-500 mb-6 leading-relaxed">{customAlert.message}</p>
            <button onClick={() => setCustomAlert(null)} className="w-full bg-slate-800 text-white font-bold py-3.5 rounded-xl active:scale-95 transition shadow-sm">סגירה</button>
          </div>
        </div>
      )}

      {customConfirm && (
        <div className="fixed inset-0 z-[10000] bg-black/40 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-white/95 backdrop-blur-xl rounded-[2rem] p-6 w-full max-w-sm shadow-2xl text-center animate-in zoom-in-95 border border-white/50">
            <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center bg-rose-50 text-rose-500 shadow-sm"><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg></div>
            <h3 className="text-xl font-black text-slate-800 mb-2">{customConfirm.title}</h3>
            <p className="text-sm text-slate-500 mb-6 leading-relaxed">{customConfirm.message}</p>
            <div className="flex gap-3">
              <button onClick={() => setCustomConfirm(null)} className="flex-1 bg-white text-slate-600 font-bold py-3.5 rounded-xl hover:bg-gray-50 transition active:scale-95 border border-gray-200 shadow-sm">ביטול</button>
              <button onClick={customConfirm.onConfirm} className="flex-1 bg-rose-500 text-white font-bold py-3.5 rounded-xl transition shadow-sm active:scale-95">אישור מחיקה</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

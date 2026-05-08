'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { playSystemSound } from '../../../components/providers/AppManager'

export default function EventsPage() {
  const [events, setEvents] = useState<any[]>([])
  const [profile, setProfile] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [userNotes, setUserNotes] = useState<Record<string, string>>({})
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newEvent, setNewEvent] = useState({ title: '', date: '', time: '', location: '', description: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [toast, setToast] = useState<{ title: string, message: string, type: 'success' | 'error' } | null>(null)

  // זיהוי ועד חכם - גם לפי תפקיד וגם לפי אימייל המנהל
  const isCommittee = profile?.role === 'committee' || profile?.email === 'talyohala1@gmail.com'

  const showNotification = (title: string, message: string, type: 'success' | 'error' = 'success') => {
    setToast({ title, message, type })
    setTimeout(() => setToast(null), 4000)
  }

  const fetchEvents = async () => {
    setIsLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    
    // הוספת האימייל לפרופיל לזיהוי ועד
    setProfile({ ...prof, email: user.email })

    if (prof) {
      const { data: eventsData } = await supabase
        .from('events')
        .select('*, event_rsvps(*, profiles(full_name))')
        .eq('building_id', prof.building_id)
        .gte('event_date', new Date().toISOString())
        .order('event_date', { ascending: true })

      if (eventsData) {
        setEvents(eventsData)
        const notes: Record<string, string> = {}
        eventsData.forEach(ev => {
          const myRsvp = ev.event_rsvps.find((r: any) => r.user_id === prof.id)
          if (myRsvp?.note) notes[ev.id] = myRsvp.note
        })
        setUserNotes(notes)
      }
    }
    setIsLoading(false)
  }

  useEffect(() => { fetchEvents() }, [])

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile || isSubmitting) return
    setIsSubmitting(true)
    
    const eventDateTime = new Date(`${newEvent.date}T${newEvent.time}`).toISOString()
    const { error } = await supabase.from('events').insert({
      building_id: profile.building_id,
      creator_id: profile.id,
      title: newEvent.title,
      description: newEvent.description,
      location: newEvent.location,
      event_date: eventDateTime
    }).select()

    if (error) {
      showNotification("שגיאת שמירה", "מסד הנתונים חסם את הפעולה. וודא שהרצת את ה-SQL.", "error")
    } else {
      setShowCreateModal(false)
      setNewEvent({ title: '', date: '', time: '', location: '', description: '' })
      showNotification("פורסם בהצלחה! 🎉", "האירוע עודכן בלוח הבניין", "success")
      fetchEvents()
    }
    setIsSubmitting(false)
  }

  return (
    <div className="flex flex-col flex-1 w-full pb-24 space-y-6 bg-[#F8FAFC]" dir="rtl">
      {/* מערכת התראות Toast */}
      {toast && (
        <div className="fixed top-6 inset-x-4 z-[9999] animate-in slide-in-from-top-4 duration-300">
          <div className={`max-w-sm mx-auto p-4 rounded-[1.5rem] shadow-2xl backdrop-blur-md border flex items-center gap-4 ${
            toast.type === 'error' ? 'bg-red-50/90 border-red-200 text-red-800' : 'bg-emerald-50/90 border-emerald-200 text-emerald-800'
          }`}>
            <div className="font-black text-sm">{toast.title}: {toast.message}</div>
          </div>
        </div>
      )}

      <div className="px-5 mt-8 flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter">אירועים</h1>
          <p className="text-slate-500 font-bold text-base mt-1">לוח הפעילויות של הבניין</p>
        </div>
        {isCommittee && (
          <button onClick={() => { playSystemSound('click'); setShowCreateModal(true); }} className="bg-rose-500 text-white px-6 py-3 rounded-2xl font-black text-sm shadow-lg shadow-rose-200 active:scale-95 transition-all">
            + אירוע חדש
          </button>
        )}
      </div>

      <div className="px-4 space-y-4">
        {isLoading ? (
          <div className="p-10 text-center font-bold text-slate-400">מחפש אירועים קרובים...</div>
        ) : events.length === 0 ? (
          <div className="bg-white rounded-[2.5rem] p-12 text-center border border-slate-100 shadow-sm">
             <p className="text-xl font-black text-slate-700">הלוח ריק כרגע</p>
             <p className="text-slate-400 font-bold mt-2 text-sm">הוועד יעדכן כאן על אירועים קרובים</p>
          </div>
        ) : (
          events.map(event => (
            <div key={event.id} className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 relative overflow-hidden group">
               <div className="flex justify-between items-start">
                  <div className="flex-1">
                     <span className="text-[10px] font-black uppercase tracking-widest text-rose-500 bg-rose-50 px-2 py-1 rounded-md">אירוע קרוב</span>
                     <h2 className="text-2xl font-black text-slate-800 mt-2">{event.title}</h2>
                     <p className="text-slate-500 font-bold text-sm mt-1">{new Date(event.event_date).toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })} בשעה {new Date(event.event_date).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  {isCommittee && (
                    <button onClick={async () => { if(confirm('למחוק?')) { await supabase.from('events').delete().eq('id', event.id); fetchEvents(); } }} className="text-slate-200 hover:text-red-500 transition-colors p-2">
                       <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                  )}
               </div>
            </div>
          ))
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[9999] flex items-end justify-center p-4">
           <div className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl animate-in slide-in-from-bottom-20">
              <h2 className="text-2xl font-black text-slate-800 mb-6">יצירת אירוע חדש</h2>
              <form onSubmit={handleCreateEvent} className="space-y-4">
                 <input required type="text" value={newEvent.title} onChange={e => setNewEvent({...newEvent, title: e.target.value})} placeholder="מה האירוע?" className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 font-bold text-sm outline-none focus:ring-2 focus:ring-rose-200 transition-all" />
                 <div className="grid grid-cols-2 gap-3">
                    <input required type="date" value={newEvent.date} onChange={e => setNewEvent({...newEvent, date: e.target.value})} className="bg-slate-50 border-none rounded-2xl px-5 py-4 font-bold text-sm outline-none" />
                    <input required type="time" value={newEvent.time} onChange={e => setNewEvent({...newEvent, time: e.target.value})} className="bg-slate-50 border-none rounded-2xl px-5 py-4 font-bold text-sm outline-none" />
                 </div>
                 <button disabled={isSubmitting} type="submit" className="w-full bg-rose-500 text-white font-black py-5 rounded-2xl shadow-xl shadow-rose-100 active:scale-95 transition-all">
                    {isSubmitting ? 'מפרסם...' : 'פרסם אירוע בבניין'}
                 </button>
                 <button type="button" onClick={() => setShowCreateModal(false)} className="w-full text-slate-400 font-bold py-2 text-sm">ביטול</button>
              </form>
           </div>
        </div>
      )}
    </div>
  )
}

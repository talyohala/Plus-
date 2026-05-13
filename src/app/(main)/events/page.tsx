'use client'

import { useEffect, useState, useCallback } from 'react'
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
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [newEvent, setNewEvent] = useState({ title: '', date: '', time: '', location: '', description: '' })
  const [customAlert, setCustomAlert] = useState<{ title: string, message: string, type: 'success' | 'error' | 'info' } | null>(null)

  const fetchEvents = useCallback(async () => {
    setIsLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return

    const { data: prof } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
    if (prof) {
      setProfile(prof)
      const { data: eventsData } = await supabase
        .from('events')
        .select(`*, event_rsvps(id, user_id, status, profiles(full_name, avatar_url))`)
        .eq('building_id', prof.building_id)
        .gte('event_date', new Date().toISOString())
        .order('event_date', { ascending: true })
      setEvents(eventsData || [])
    }
    setIsLoading(false)
  }, [])

  useEffect(() => { fetchEvents() }, [fetchEvents])

  const handleRSVP = async (eventId: string, status: string) => {
    if (!profile) return
    playSystemSound('click')
    await supabase.from('event_rsvps').upsert({ event_id: eventId, user_id: profile.id, status }, { onConflict: 'event_id,user_id' })
    fetchEvents()
  }

  return (
    <div className="flex flex-col flex-1 w-full pb-32 bg-[#F8FAFC] min-h-screen" dir="rtl">
      <div className="px-6 pt-8 mb-6 sticky top-0 bg-[#F8FAFC] z-20">
        <h2 className="text-2xl font-black text-slate-800">לוח אירועים 🗓️</h2>
      </div>

      <div className="px-5 space-y-5">
        {events.map(event => {
          const attending = event.event_rsvps.filter((r: any) => r.status === 'attending');
          const myRsvp = event.event_rsvps.find((r: any) => r.user_id === profile?.id);

          return (
            <div key={event.id} className="bg-white/90 backdrop-blur-md rounded-[2rem] p-5 shadow-sm border border-slate-100 relative overflow-hidden">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-black text-slate-800">{event.title}</h3>
                  <p className="text-[11px] font-bold text-slate-500 mt-0.5">
                    {new Date(event.event_date).toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'short' })} | 
                    {new Date(event.event_date).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-[#1D4ED8]/5 flex items-center justify-center text-[#1D4ED8] font-black text-xl">
                  {new Date(event.event_date).getDate()}
                </div>
              </div>

              <p className="text-xs text-slate-600 font-medium mb-4 leading-relaxed bg-slate-50 p-3 rounded-xl">{event.description}</p>

              {/* RSVP Stack */}
              <div className="flex items-center gap-3 mb-5">
                <div className="flex -space-x-3 rtl:space-x-reverse">
                  {attending.slice(0, 4).map((r: any, i: number) => (
                    <img key={i} src={r.profiles?.avatar_url} className="w-8 h-8 rounded-full border-2 border-white shadow-sm" alt="guest" />
                  ))}
                  {attending.length > 4 && (
                    <div className="w-8 h-8 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center text-[10px] font-bold text-slate-600">+{attending.length - 4}</div>
                  )}
                </div>
                <span className="text-[11px] font-bold text-slate-500">{attending.length} אישרו הגעה</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => handleRSVP(event.id, 'attending')} className={`h-12 rounded-2xl text-xs font-black transition active:scale-95 ${myRsvp?.status === 'attending' ? 'bg-[#1D4ED8] text-white' : 'bg-slate-100 text-slate-600'}`}>אני מגיע 🎉</button>
                <a href={generateGoogleCalendarLink(event)} target="_blank" className="h-12 flex items-center justify-center rounded-2xl text-xs font-black bg-white border border-slate-200 text-slate-600">ליומן 📅</a>
              </div>
            </div>
          )
        })}
      </div>

      {/* יתר הקוד להוספת אירוע נשאר זהה... */}
    </div>
  )
}

'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../../../lib/supabase'
import { playSystemSound } from '../../../components/providers/AppManager'
import { createPortal } from 'react-dom'

const generateCalendarLink = (event: any, isIOS: boolean) => {
  const startDate = new Date(event.event_date)
  const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000)

  if (isIOS) {
    const formatICSDate = (d: Date) => d.toISOString().replace(/-|:|\.\d\d\d/g, '')
    const icsContent = `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nDTSTART:${formatICSDate(startDate)}\nDTEND:${formatICSDate(endDate)}\nSUMMARY:${event.title}\nDESCRIPTION:${event.description || ''}\nLOCATION:${event.location || ''}\nEND:VEVENT\nEND:VCALENDAR`
    return `data:text/calendar;charset=utf8,${encodeURIComponent(icsContent)}`
  } else {
    const formatGoogleDate = (d: Date) => d.toISOString().replace(/-|:|\.\d\d\d/g, '')
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${formatGoogleDate(startDate)}/${formatGoogleDate(endDate)}&details=${encodeURIComponent(event.description || '')}&location=${encodeURIComponent(event.location || '')}`
  }
}

const getDaysUntil = (dateString: string) => {
  const eventDate = new Date(dateString)
  eventDate.setHours(0,0,0,0)
  const today = new Date()
  today.setHours(0,0,0,0)
  const diffTime = eventDate.getTime() - today.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'היום! ⏰'
  if (diffDays === 1) return 'מחר! ⏰'
  if (diffDays < 0) return 'עבר'
  return `בעוד ${diffDays} ימים`
}

export default function EventsPage() {
  const [events, setEvents] = useState<any[]>([])
  const [profile, setProfile] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [userNotes, setUserNotes] = useState<Record<string, string>>({})
  const [filterTab, setFilterTab] = useState<'all' | 'my_events'>('all')
  const [isIOS, setIsIOS] = useState(false)
  
  // ניהול פתיחה/סגירה של רשימות הדיירים הארוכות
  const [expandedEvents, setExpandedEvents] = useState<Record<string, boolean>>({})
  
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingEventId, setEditingEventId] = useState<string | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  
  const [newEvent, setNewEvent] = useState({ title: '', date: '', time: '', location: '', description: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isAiProcessing, setIsAiProcessing] = useState(false)
  
  const [customAlert, setCustomAlert] = useState<{ title: string, message: string, type: 'success' | 'error' | 'info' } | null>(null)
  const [customConfirm, setCustomConfirm] = useState<{ title: string, message: string, onConfirm: () => void } | null>(null)
  const [mounted, setMounted] = useState(false)

  // Swipeable Bottom Sheet States
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [translateY, setTranslateY] = useState(0);

  const isAdmin = profile?.role === 'admin' || profile?.email === 'talyohala1@gmail.com'

  useEffect(() => {
    setMounted(true)
    const ua = window.navigator.userAgent;
    const ios = !!ua.match(/iPad/i) || !!ua.match(/iPhone/i);
    const webkit = !!ua.match(/WebKit/i);
    const isMac = !!ua.match(/Macintosh/i);
    setIsIOS(ios || (webkit && isMac && 'ontouchend' in document));
  }, [])

  const fetchEvents = useCallback(async () => {
    setIsLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
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
      
      const { data: eventsData } = await supabase
        .from('events')
        .select(`*, event_rsvps(id, user_id, status, note, profiles(full_name, avatar_url))`)
        .eq('building_id', prof.building_id)
        .gte('event_date', today.toISOString())
        .order('event_date', { ascending: true })

      if (eventsData) {
        setEvents(eventsData)
      }
    }
    setIsLoading(false)
  }, [])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  useEffect(() => {
    let isMounted = true;
    let channel: any = null;
    
    const setupRealtime = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user || !isMounted) return
      
      const { data: prof } = await supabase.from('profiles').select('building_id').eq('id', user.id).single()
      if (!prof?.building_id || !isMounted) return
      
      const channelTopic = `events_realtime_${user.id}_${Date.now()}`;
      channel = supabase.channel(channelTopic)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'events', filter: `building_id=eq.${prof.building_id}` }, () => { fetchEvents(); })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'event_rsvps' }, () => { fetchEvents(); })
        .subscribe();
    }
    
    setupRealtime();
    
    return () => {
      isMounted = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, [fetchEvents]);

  // Bottom Sheet Handlers
  const handleCloseModal = useCallback(() => {
    setShowCreateModal(false);
    setEditingEventId(null);
    setTranslateY(0);
    setNewEvent({ title: '', date: '', time: '', location: '', description: '' });
  }, []);

  useEffect(() => {
    if (showCreateModal || openMenuId) {
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
    } else {
      document.body.style.overflow = 'unset';
      document.body.style.touchAction = 'auto';
    }
    return () => { document.body.style.overflow = 'unset'; document.body.style.touchAction = 'auto'; };
  }, [showCreateModal, openMenuId]);

  const onTouchStart = (e: React.TouchEvent) => setTouchStart(e.targetTouches[0].clientY);
  const onTouchMove = (e: React.TouchEvent) => {
    if (!touchStart) return;
    const diff = e.targetTouches[0].clientY - touchStart;
    if (diff > 0) setTranslateY(diff);
  };
  const onTouchEnd = () => {
    if (translateY > 150) handleCloseModal();
    setTranslateY(0);
    setTouchStart(null);
  };

  const handleRSVP = async (eventId: string, status: string, isNoteUpdateOnly = false) => {
    if (!profile) return
    playSystemSound('click')
    const note = userNotes[eventId] || ''
    
    let finalNote = note;
    if (!isNoteUpdateOnly && !note) {
      const ev = events.find(e => e.id === eventId);
      const myRsvp = ev?.event_rsvps.find((r: any) => r.user_id === profile.id);
      if (myRsvp?.note) {
        finalNote = myRsvp.note;
      }
    }

    const { error } = await supabase.from('event_rsvps').upsert({ event_id: eventId, user_id: profile.id, status, note: finalNote }, { onConflict: 'event_id,user_id' })
    
    if (error) {
      setCustomAlert({ title: 'שגיאה', message: 'לא הצלחנו לעדכן את הפעולה.', type: 'error' })
    } else {
      if (isNoteUpdateOnly) {
        setCustomAlert({ title: 'ההערה נשמרה', message: 'ההערה שכתבת עודכנה בהצלחה באירוע.', type: 'success' })
        setUserNotes(prev => ({...prev, [eventId]: ''}))
      } else {
        setCustomAlert({ title: 'סטטוס עודכן', message: 'סטטוס ההגעה שלך נשמר במערכת בהצלחה.', type: 'success' })
      }
      fetchEvents()
    }
  }

  const handleUpdateNoteOnly = (eventId: string) => {
    if (!profile) return;
    if (!userNotes[eventId] || userNotes[eventId].trim() === '') return;
    
    const ev = events.find(e => e.id === eventId);
    const myRsvp = ev?.event_rsvps.find((r: any) => r.user_id === profile.id);
    const currentStatus = myRsvp ? myRsvp.status : 'maybe';
    
    handleRSVP(eventId, currentStatus, true);
  }

  const handleAddToCalendar = (event: any) => {
    playSystemSound('click');
    const startDate = new Date(event.event_date);
    const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000);
    const formatICSDate = (d: Date) => d.toISOString().replace(/-|:|\.\d\d\d/g, '');
    const icsContent = `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nDTSTART:${formatICSDate(startDate)}\nDTEND:${formatICSDate(endDate)}\nSUMMARY:${event.title}\nDESCRIPTION:${event.description || ''}\nLOCATION:${event.location || ''}\nEND:VEVENT\nEND:VCALENDAR`;
    
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${event.title}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const handleShareWhatsApp = (event: any) => {
    playSystemSound('click');
    const d = new Date(event.event_date);
    const dateStr = d.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
    const text = `היי שכנים! 🏢\nמוזמנים לאירוע שלנו:\n*${event.title}*\n\n🗓️ מתי? ${dateStr}\n📍 איפה? ${event.location || 'בבניין'}\n\n${event.description ? `💡 קצת פרטים:\n${event.description}\n\n` : ''}כנסו לאפליקציית שכן+ לאשר הגעה! נתראה ✨`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    setOpenMenuId(null);
  }

  const openEditModal = (event: any) => {
    const d = new Date(event.event_date)
    const dateStr = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0')
    const timeStr = String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0')
    
    setNewEvent({ title: event.title, date: dateStr, time: timeStr, location: event.location || '', description: event.description || '' })
    setEditingEventId(event.id)
    setShowCreateModal(true)
    setOpenMenuId(null)
  }

  const handleToggleFreeze = async (eventId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'frozen' ? 'active' : 'frozen'
    const { error } = await supabase.from('events').update({ status: newStatus }).eq('id', eventId)
    
    if (error) {
      setCustomAlert({ title: 'שגיאה במסד הנתונים', message: 'שגיאה בהקפאת האירוע.', type: 'error' })
    } else {
      playSystemSound('notification')
      if (newStatus === 'frozen') {
        const { data: tenants } = await supabase.from('profiles').select('id').eq('building_id', profile.building_id).neq('id', profile.id)
        if (tenants && tenants.length > 0) {
          const notifs = tenants.map(t => ({
            receiver_id: t.id, sender_id: profile.id, type: 'system',
            title: 'אירוע הוקפא ❄️', content: `האירוע הוקפא. מועד חדש יעודכן בהמשך.`, link: '/events'
          }))
          await supabase.from('notifications').insert(notifs)
        }
      }
      fetchEvents()
    }
  }

  const togglePinEvent = async (event: any) => {
    const isPinned = !event.is_pinned;
    await supabase.from('events').update({ is_pinned: isPinned }).eq('id', event.id);
    playSystemSound('click');
    fetchEvents();
  };

  const handleEndEvent = (eventId: string) => {
    setCustomConfirm({
      title: 'סיום וביטול אירוע',
      message: 'פעולה זו תמחק לחלוטין את האירוע והוא יוסר מלוח הבניין. להמשיך?',
      onConfirm: async () => {
        const { error } = await supabase.from('events').delete().eq('id', eventId)
        if (error) setCustomAlert({ title: 'שגיאה', message: 'לא הצלחנו למחוק', type: 'error' })
        else fetchEvents()
        setCustomConfirm(null)
        playSystemSound('click')
      }
    })
  }

  const handleAIEnhance = async () => {
    if (!newEvent.description) {
      setCustomAlert({title: 'רגע אחד', message: 'כתוב לפחות כמה מילים כדי שה-AI יוכל לעזור 🪄', type: 'info'});
      return;
    }
    
    playSystemSound('click');
    setIsAiProcessing(true);
    
    try {
      const prompt = `שפר את הניסוח של מודעת האירוע הבאה לשכנים בבניין. הפוך אותה למזמינה, ברורה וחגיגית. השתמש באימוג'י אחד או שניים מתאימים. הטקסט המקורי: "${newEvent.description}"`;
      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: prompt, mode: 'insight' })
      });
      const data = await res.json();
      
      if (data.text) {
         playSystemSound('notification');
         const enhancedText = data.text.trim();
         setNewEvent(prev => ({...prev, description: enhancedText}));
      }
    } catch (err) {
       setCustomAlert({title: 'שגיאה', message: 'ה-AI קצת עייף עכשיו, נסה שוב מאוחר יותר', type: 'error'});
    }
    setIsAiProcessing(false);
  };

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
        
        const { data: tenants } = await supabase.from('profiles').select('id').eq('building_id', profile.building_id).neq('id', profile.id)
        if (tenants && tenants.length > 0) {
            const notifs = tenants.map(t => ({
                receiver_id: t.id,
                sender_id: profile.id,
                type: 'event',
                title: 'אירוע קהילתי חדש! 🎉',
                content: `הוועד קבע אירוע: ${newEvent.title}. הכנסו כדי לאשר הגעה.`,
                link: '/events'
            }))
            await supabase.from('notifications').insert(notifs)
        }
        setCustomAlert({ title: "פורסם!", message: "אירוע חדש נוסף ללוח של הבניין. כל הדיירים קיבלו התראה.", type: "success" })
      }

      handleCloseModal()
      fetchEvents()
    } catch (err: any) {
      setCustomAlert({ title: "תקלה", message: "בדוק שהתאריך והשעה תקינים", type: "error" })
    } finally {
      setIsSubmitting(false)
    }
  }

  const toggleExpand = (id: string) => {
    playSystemSound('click')
    setExpandedEvents(prev => ({...prev, [id]: !prev[id]}))
  }

  const displayedEvents = events.filter(ev => {
    if (filterTab === 'all') return true;
    if (isAdmin) return true;
    const myRsvp = ev.event_rsvps.find((r: any) => r.user_id === profile?.id);
    return myRsvp != null;
  }).sort((a, b) => {
    if (a.is_pinned && !b.is_pinned) return -1;
    if (!a.is_pinned && b.is_pinned) return 1;
    return new Date(a.event_date).getTime() - new Date(b.event_date).getTime();
  });

  const alertsPortal = mounted && customAlert ? createPortal(
    <div className="fixed inset-0 z-[10000] bg-black/40 backdrop-blur-sm flex justify-center items-center p-4" onClick={() => setCustomAlert(null)} dir="rtl">
      <div className="bg-white/95 backdrop-blur-xl rounded-[2rem] p-6 w-full max-w-sm shadow-2xl text-center animate-in zoom-in-95 border border-white/50" onClick={e => e.stopPropagation()}>
        <div className={`w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center shadow-lg ${customAlert.type === 'success' ? 'bg-[#10B981]/10 text-[#10B981] animate-[bounce_1s_infinite]' : customAlert.type === 'error' ? 'bg-red-50 text-red-500' : 'bg-[#1D4ED8]/10 text-[#1D4ED8]'}`}>
          {customAlert.type === 'success' && <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>}
          {customAlert.type === 'error' && <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>}
          {customAlert.type === 'info' && <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>}
        </div>
        <h3 className="text-2xl font-black text-slate-800 mb-2">{customAlert.title}</h3>
        <p className="text-base text-slate-500 mb-6 leading-relaxed font-medium">{customAlert.message}</p>
        <button onClick={() => setCustomAlert(null)} className="w-full h-14 flex items-center justify-center bg-[#1E293B] hover:bg-slate-800 text-white font-bold rounded-xl active:scale-95 transition shadow-sm text-lg">סגירה</button>
      </div>
    </div>, document.body
  ) : null;

  const confirmsPortal = mounted && customConfirm ? createPortal(
    <div className="fixed inset-0 z-[10000] bg-black/40 backdrop-blur-sm flex justify-center items-center p-4" dir="rtl">
      <div className="bg-white/95 backdrop-blur-xl rounded-[2rem] p-6 w-full max-w-sm shadow-2xl text-center animate-in zoom-in-95 border border-white/50">
        <div className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center bg-rose-50 text-rose-500 shadow-lg">
          <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77-1.333.192 3 1.732 3z"></path></svg>
        </div>
        <h3 className="text-2xl font-black text-slate-800 mb-2">{customConfirm.title}</h3>
        <p className="text-base text-slate-500 mb-6 leading-relaxed font-medium">{customConfirm.message}</p>
        <div className="flex gap-3">
          <button onClick={() => setCustomConfirm(null)} className="flex-1 h-14 flex items-center justify-center bg-white text-slate-600 font-bold rounded-xl hover:bg-gray-50 transition active:scale-95 border border-gray-200 shadow-sm text-lg">ביטול</button>
          <button onClick={customConfirm.onConfirm} className="flex-1 h-14 flex items-center justify-center bg-rose-500 text-white font-bold rounded-xl transition shadow-sm active:scale-95 text-lg hover:bg-rose-600">אישור מחיקה</button>
        </div>
      </div>
    </div>, document.body
  ) : null;

  return (
    <div className="flex flex-col flex-1 w-full pb-32 relative bg-transparent min-h-[100dvh]" dir="rtl" onClick={() => setOpenMenuId(null)}>
      {alertsPortal}
      {confirmsPortal}

      <div className="px-4 mt-6 mb-5">
        <h2 className="text-2xl font-black text-slate-800 tracking-tight">לוח אירועים</h2>
      </div>

      <div className="px-5 mb-6">
        <div className="flex bg-white/60 backdrop-blur-md p-1.5 rounded-full border border-rose-100 shadow-sm">
          <button onClick={() => setFilterTab('all')} className={`flex-1 py-3 text-sm rounded-full transition-all flex items-center justify-center gap-1.5 ${filterTab === 'all' ? 'text-rose-600 font-black bg-rose-50 shadow-sm border border-rose-100' : 'text-slate-500 font-bold hover:text-slate-700'}`}>
            כל האירועים
          </button>
          <button onClick={() => setFilterTab('my_events')} className={`flex-1 py-3 text-sm rounded-full transition-all flex items-center justify-center gap-1.5 ${filterTab === 'my_events' ? 'text-rose-600 font-black bg-rose-50 shadow-sm border border-rose-100' : 'text-slate-500 font-bold hover:text-slate-700'}`}>
            הסטטוס שלי
          </button>
        </div>
      </div>

      <div className="px-5 w-full relative z-10 space-y-6">
        {isLoading ? (
          <div className="text-center py-20"><div className="w-12 h-12 border-4 border-rose-200 border-t-rose-500 rounded-full animate-spin mx-auto"></div></div>
        ) : displayedEvents.length === 0 ? (
          <div className="text-center py-16 bg-white/60 backdrop-blur-xl rounded-[2rem] border border-white shadow-sm mt-4 animate-in fade-in zoom-in-95">
            <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm text-rose-300">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
            </div>
            <p className="font-black text-xl text-slate-700">הלוח שקט כרגע</p>
            <p className="text-sm font-medium text-slate-500 mt-2">הוועד יעדכן כשיהיו פעילויות בבניין ✨</p>
          </div>
        ) : (
          displayedEvents.map((event, idx) => {
            const isFrozen = event.status === 'frozen'
            const myRsvp = event.event_rsvps.find((r: any) => r.user_id === profile?.id)
            const attendingList = event.event_rsvps.filter((r: any) => r.status === 'attending')
            const attendingCount = attendingList.length
            const lateCount = event.event_rsvps.filter((r: any) => r.status === 'late').length
            
            const daysUntil = getDaysUntil(event.event_date)
            const isHero = idx === 0 && filterTab === 'all' && !isFrozen;
            const isExpanded = expandedEvents[`${filterTab}-${event.id}`] || false;

            if (filterTab === 'my_events') {
              return (
                <div key={event.id} className="bg-white/90 backdrop-blur-md rounded-[1.5rem] p-5 shadow-sm border border-slate-100 flex flex-col gap-4 animate-in fade-in">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-black text-slate-800">{event.title}</h3>
                      <p className="text-[11px] font-bold text-slate-500 mt-1">🗓️ {new Date(event.event_date).toLocaleString('he-IL', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    {myRsvp && (
                      <div className={`text-[10px] font-black px-2.5 py-1 rounded-lg uppercase shadow-sm border ${
                        myRsvp.status === 'attending' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                        myRsvp.status === 'late' ? 'bg-amber-50 text-amber-600 border-amber-100' : 
                        myRsvp.status === 'maybe' ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-rose-50 text-rose-500 border-rose-100'
                      }`}>
                        {myRsvp.status === 'attending' ? 'אני מגיע 🎉' : myRsvp.status === 'late' ? 'אני מאחר ⏰' : myRsvp.status === 'maybe' ? 'אני אולי אגיע 🤔' : 'לא מגיע ❌'}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100 shadow-sm">
                    <div className="flex -space-x-2.5 rtl:space-x-reverse">
                      {attendingList.slice(0, 4).map((r: any, i: number) => (
                        <img key={i} src={r.profiles?.avatar_url || `https://api.dicebear.com/8.x/initials/svg?seed=${r.profiles?.full_name}`} className="w-8 h-8 rounded-full border-[2px] border-white shadow-sm object-cover" alt="avatar" />
                      ))}
                      {attendingCount > 4 && (
                        <div className="w-8 h-8 rounded-full bg-slate-200 border-[2px] border-white flex items-center justify-center text-[10px] font-black text-slate-500 shadow-sm">
                          +{attendingCount - 4}
                        </div>
                      )}
                      {attendingCount === 0 && <span className="text-[10px] font-bold text-slate-400">אף אחד לא אישר עדין</span>}
                    </div>
                    <div className="flex flex-col items-end gap-1 text-[9px] font-black">
                      {attendingCount > 0 && <span className="text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200">{attendingCount} מגיעים</span>}
                      {lateCount > 0 && <span className="text-amber-700 bg-amber-100 px-2 py-0.5 rounded border border-amber-200">{lateCount} מאחרים</span>}
                    </div>
                  </div>

                  {event.event_rsvps.length > 0 && (
                    <div className="mt-2 border-t border-slate-100 pt-3">
                      <button onClick={() => toggleExpand(`${filterTab}-${event.id}`)} className="w-full flex items-center justify-between group active:scale-95 transition-transform">
                        <span className="text-[11px] font-black text-slate-500">פירוט הגעה קהילתי ({event.event_rsvps.length})</span>
                        <div className={`w-6 h-6 flex items-center justify-center rounded-full bg-slate-50 text-slate-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7"></path></svg>
                        </div>
                      </button>

                      <div className={`overflow-hidden transition-all duration-500 ease-in-out ${isExpanded ? 'max-h-[1500px] opacity-100 mt-3' : 'max-h-0 opacity-0'}`}>
                        <div className="space-y-2.5">
                          {event.event_rsvps.map((rsvp: any) => (
                            <div key={rsvp.id} className="flex items-center justify-between bg-slate-50 border border-slate-100 p-3 rounded-xl shadow-sm">
                              <div className="flex items-center gap-3 flex-1 overflow-hidden">
                                <img src={rsvp.profiles?.avatar_url || `https://api.dicebear.com/8.x/initials/svg?seed=${rsvp.profiles?.full_name}&backgroundColor=EFF6FF&textColor=1D4ED8`} className="w-9 h-9 rounded-full object-cover shadow-sm border-[2px] border-white shrink-0" alt="avatar" />
                                <div className="flex flex-col overflow-hidden">
                                  <span className="text-xs font-black text-slate-800 truncate">{rsvp.profiles?.full_name}</span>
                                  {rsvp.note && (
                                    <span className="text-[10px] font-bold text-slate-500 truncate mt-0.5">💬 {rsvp.note}</span>
                                  )}
                                </div>
                              </div>
                              <div className={`shrink-0 ml-2 text-[10px] font-black px-2.5 py-1.5 rounded-lg uppercase border shadow-sm ${
                                rsvp.status === 'attending' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                                rsvp.status === 'late' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                                rsvp.status === 'maybe' ? 'bg-slate-200 text-slate-700 border-slate-300' : 'bg-rose-50 text-rose-500 border-rose-200'
                              }`}>
                                {rsvp.status === 'attending' ? 'מגיע 🎉' : rsvp.status === 'late' ? 'מאחר ⏰' : rsvp.status === 'maybe' ? 'אולי 🤔' : 'לא מגיע ❌'}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            }

            return (
              <div key={event.id} className={`backdrop-blur-xl rounded-[2rem] p-5 shadow-[0_8px_30px_rgba(244,63,94,0.05)] border relative overflow-hidden transition-all duration-300 ${isHero ? 'bg-gradient-to-br from-rose-50/80 to-white border-rose-200/60' : 'bg-white/90 border-slate-100'} ${openMenuId === event.id ? 'z-50' : 'z-10'}`}>
                
                {event.is_pinned ? (
                  <div className="absolute top-0 right-0 flex overflow-hidden rounded-bl-[1.5rem] rounded-tr-[2rem] z-10">
                    <div className="px-4 py-1.5 bg-[#1D4ED8] text-white text-[10px] font-black flex items-center gap-1">📌 נעוץ חשוב</div>
                  </div>
                ) : (
                  <div className={`absolute top-0 right-0 text-white text-[10px] font-black px-4 py-1.5 rounded-bl-[1.5rem] shadow-sm z-10 ${isFrozen ? 'bg-slate-400' : 'bg-rose-500'}`}>
                    {isFrozen ? 'מוקפא ❄️' : daysUntil}
                  </div>
                )}

                {isAdmin && (
                  <div className="absolute top-4 left-4 z-20">
                    <button onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === event.id ? null : event.id); }} className="w-10 h-10 flex items-center justify-center bg-transparent text-slate-400 hover:text-rose-500 transition-colors active:scale-95">
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"></path></svg>
                    </button>

                    {openMenuId === event.id && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)}></div>
                        <div className="absolute left-0 top-12 w-[200px] bg-white/95 backdrop-blur-xl border border-rose-100 shadow-[0_10px_40px_rgba(0,0,0,0.1)] rounded-2xl z-[150] overflow-hidden py-2 animate-in zoom-in-95">
                          
                          <button onClick={() => handleShareWhatsApp(event)} className="w-full text-right px-4 h-12 text-sm font-bold text-slate-700 hover:bg-rose-50 flex items-center gap-3">
                            <svg className="w-5 h-5 text-[#25D366]" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                            </svg>
                            שיתוף לוואטסאפ
                          </button>
                          
                          <div className="h-px bg-slate-100 my-1 mx-2"></div>

                          <button onClick={() => { setOpenMenuId(null); togglePinEvent(event); }} className="w-full text-right px-4 h-12 text-sm font-bold text-slate-700 hover:bg-rose-50 flex items-center gap-3">
                             <svg className="w-5 h-5 text-[#1D4ED8]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"></path></svg>
                             {event.is_pinned ? 'בטל נעיצה' : 'נעץ אירוע'}
                          </button>
                          
                          <button onClick={() => { setOpenMenuId(null); openEditModal(event); }} className="w-full text-right px-4 h-12 text-sm font-bold text-slate-700 hover:bg-rose-50 flex items-center gap-3">
                            <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                            עריכת פרטים
                          </button>
                          
                          <button onClick={() => { setOpenMenuId(null); handleToggleFreeze(event.id, event.status); }} className="w-full text-right px-4 h-12 text-sm font-bold text-slate-700 hover:bg-rose-50 flex items-center gap-3">
                            {isFrozen ? (
                              <><svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg> שחרר מהקפאה</>
                            ) : (
                              <><svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg> הקפאת אירוע</>
                            )}
                          </button>
                          
                          <button onClick={() => { setOpenMenuId(null); handleEndEvent(event.id); }} className="w-full text-right px-4 h-12 text-sm font-bold text-rose-500 hover:bg-red-50 flex items-center gap-3 border-t border-slate-50 mt-1 pt-1">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                            מחיקת אירוע
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}

                <div className="flex justify-between items-start mb-4 pt-6 pr-1">
                  <div>
                    <h3 className={`${isHero ? 'text-2xl' : 'text-xl'} font-black text-slate-800 leading-tight mb-1.5 pr-1`}>{event.title}</h3>
                    <p className={`text-sm font-bold flex items-center gap-1.5 ${isFrozen ? 'text-slate-400 line-through' : 'text-rose-600'}`}>
                      <span>🗓️</span> {new Date(event.event_date).toLocaleString('he-IL', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>

                {event.description && (
                  <div className="bg-white/60 p-4 rounded-2xl mb-5 border border-rose-50 shadow-sm">
                    <p className="text-sm font-medium text-slate-600 leading-relaxed">{event.description}</p>
                  </div>
                )}

                <div className="flex flex-wrap gap-2 mb-6">
                  {event.location && <span className={`text-[11px] font-black px-3.5 py-2 rounded-xl border flex items-center gap-1.5 shadow-sm ${isFrozen ? 'bg-slate-50 text-slate-400 border-slate-100' : 'text-slate-700 bg-white border-slate-100'}`}>📍 {event.location}</span>}
                  
                  {!isFrozen && (
                    <button onClick={() => handleAddToCalendar(event)} className="text-[#1D4ED8] text-[11px] font-black bg-[#1D4ED8]/5 px-4 h-[34px] rounded-xl border border-[#1D4ED8]/20 shadow-sm flex items-center justify-center gap-1.5 hover:bg-[#1D4ED8]/10 transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
                      הוסף ליומן
                    </button>
                  )}
                </div>

                {!isFrozen && attendingCount > 0 && (
                  <div className="flex items-center gap-3 mb-6 bg-white/80 p-3.5 rounded-2xl border border-rose-50 shadow-sm">
                    <div className="flex -space-x-3 rtl:space-x-reverse">
                      {attendingList.slice(0, 5).map((r: any, i: number) => (
                        <img key={i} src={r.profiles?.avatar_url || `https://api.dicebear.com/8.x/initials/svg?seed=${r.profiles?.full_name}&backgroundColor=EFF6FF&textColor=1D4ED8`} className="w-10 h-10 rounded-full border-[2.5px] border-white shadow-sm object-cover" alt="avatar" />
                      ))}
                      {attendingCount > 5 && (
                        <div className="w-10 h-10 rounded-full bg-slate-100 border-[2.5px] border-white flex items-center justify-center text-xs font-black text-slate-500 shadow-sm">
                          +{attendingCount - 5}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-black text-slate-800">{attendingCount} דיירים מגיעים</span>
                      <span className="text-xs font-bold text-rose-500">הצטרפו אליהם!</span>
                    </div>
                  </div>
                )}

                {isFrozen ? (
                  <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 text-center mt-2 shadow-inner">
                    <div className="text-4xl mb-2">❄️</div>
                    <p className="font-black text-base text-slate-600">האירוע הוקפא כרגע</p>
                    <p className="text-sm font-bold text-slate-500 mt-1">מועד חדש יעודכן בהמשך על ידי הוועד.</p>
                  </div>
                ) : (
                  <div className="bg-slate-50/80 p-5 rounded-[1.5rem] border border-slate-100 shadow-sm">
                    <p className="font-black text-sm text-slate-800 mb-3 text-center">אישור הגעה</p>
                    
                    <div className="relative mb-4">
                      <input
                        type="text"
                        placeholder="הערה לוועד..."
                        value={userNotes[event.id] || ''}
                        onChange={(e) => setUserNotes({...userNotes, [event.id]: e.target.value})}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleUpdateNoteOnly(event.id);
                          }
                        }}
                        className="w-full bg-white border border-slate-200 rounded-xl py-3.5 pr-4 pl-12 text-sm font-bold outline-none focus:border-rose-400 shadow-sm transition-all placeholder:text-[10px]"
                        dir="rtl"
                      />
                      <button
                        type="button"
                        onClick={() => handleUpdateNoteOnly(event.id)}
                        className="absolute left-2 top-2 bottom-2 w-10 flex items-center justify-center bg-rose-50 hover:bg-rose-100 text-rose-500 rounded-lg transition active:scale-95"
                      >
                        <svg className="w-5 h-5 transform -rotate-90 -translate-x-px" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
                      </button>
                    </div>

                    <div className="grid grid-cols-4 gap-2.5">
                      <button type="button" onClick={() => handleRSVP(event.id, 'attending')} className={`h-16 flex flex-col items-center justify-center gap-0.5 rounded-xl text-xs font-black transition-all active:scale-95 ${myRsvp?.status === 'attending' ? 'bg-gradient-to-br from-emerald-400 to-emerald-500 text-white shadow-md border-transparent scale-105' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 shadow-sm'}`}>
                        <span>מגיע</span>
                        <span className="text-sm">🎉</span>
                      </button>
                      <button type="button" onClick={() => handleRSVP(event.id, 'late')} className={`h-16 flex flex-col items-center justify-center gap-0.5 rounded-xl text-xs font-black transition-all active:scale-95 ${myRsvp?.status === 'late' ? 'bg-gradient-to-br from-amber-400 to-amber-500 text-white shadow-md border-transparent scale-105' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 shadow-sm'}`}>
                        <span>מאחר</span>
                        <span className="text-sm">⏰</span>
                      </button>
                      <button type="button" onClick={() => handleRSVP(event.id, 'maybe')} className={`h-16 flex flex-col items-center justify-center gap-0.5 rounded-xl text-xs font-black transition-all active:scale-95 ${myRsvp?.status === 'maybe' ? 'bg-gradient-to-br from-slate-600 to-slate-700 text-white shadow-md border-transparent scale-105' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 shadow-sm'}`}>
                        <span>אולי</span>
                        <span className="text-sm">🤔</span>
                      </button>
                      <button type="button" onClick={() => handleRSVP(event.id, 'declined')} className={`h-16 flex flex-col items-center justify-center gap-0.5 rounded-xl text-xs font-black transition-all active:scale-95 ${myRsvp?.status === 'declined' ? 'bg-rose-50 text-rose-500 border border-rose-200 shadow-sm scale-105' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 shadow-sm'}`}>
                        <span>לא מגיע</span>
                        <span className="text-sm">❌</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* דשבורד ועד ומערכת התגובות */}
                {event.event_rsvps.length > 0 && (
                  <div className="mt-6 pt-5 border-t border-slate-100">
                    <button onClick={() => toggleExpand(`${filterTab}-${event.id}`)} className="w-full flex items-center justify-between group active:scale-95 transition-transform">
                      <div className="flex items-center gap-3">
                        <h3 className="font-black text-sm text-slate-800">{isAdmin ? 'דשבורד ועד:' : 'תגובות השכנים:'}</h3>
                        {isAdmin && (
                          <div className="flex gap-2 text-xs font-black">
                            <span className="bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-lg border border-emerald-200">{attendingCount}</span>
                            {lateCount > 0 && <span className="bg-amber-100 text-amber-700 px-2.5 py-1 rounded-lg border border-amber-200">{lateCount}</span>}
                          </div>
                        )}
                      </div>
                      <div className={`w-8 h-8 flex items-center justify-center rounded-full bg-slate-50 text-slate-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7"></path></svg>
                      </div>
                    </button>

                    <div className={`overflow-hidden transition-all duration-500 ease-in-out ${isExpanded ? 'max-h-[1500px] opacity-100 mt-4' : 'max-h-0 opacity-0'}`}>
                      <ul className="space-y-3">
                        {event.event_rsvps.map((rsvp: any) => {
                          if (!isAdmin && !rsvp.note) return null;
                          return (
                            <li key={rsvp.id} className="bg-slate-50/50 p-3 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-1.5">
                              <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                  <img src={rsvp.profiles?.avatar_url || `https://api.dicebear.com/8.x/initials/svg?seed=${rsvp.profiles?.full_name}&backgroundColor=EFF6FF&textColor=1D4ED8`} className="w-6 h-6 rounded-full object-cover shadow-sm" alt="avatar" />
                                  <span className="font-black text-sm text-slate-800">{rsvp.profiles?.full_name}</span>
                                </div>
                                {isAdmin && (
                                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-md uppercase shadow-sm border ${
                                    rsvp.status === 'attending' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                                    rsvp.status === 'late' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                                    rsvp.status === 'maybe' ? 'bg-slate-200 text-slate-700 border-slate-300' : 'bg-rose-50 text-rose-500 border-rose-200'
                                  }`}>
                                    {rsvp.status === 'attending' ? 'מגיע' : rsvp.status === 'late' ? 'מאחר' : rsvp.status === 'maybe' ? 'אולי' : 'לא מגיע'}
                                  </span>
                                )}
                              </div>
                              {rsvp.note && (
                                <div className="bg-white text-slate-700 text-xs p-3 rounded-xl border border-slate-100 font-bold flex gap-2 mt-1 shadow-sm mr-8 relative">
                                  <div className="absolute -right-2 top-2 w-3 h-3 bg-white border-t border-r border-slate-100 transform rotate-45"></div>
                                  <span className="relative z-10">{rsvp.note}</span>
                                </div>
                              )}
                            </li>
                          )
                        })}
                      </ul>
                    </div>
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
          className="fixed bottom-24 left-6 z-40 bg-white/90 backdrop-blur-md border border-slate-200 text-slate-800 pl-4 pr-1.5 py-1.5 rounded-full shadow-sm hover:scale-105 active:scale-95 transition flex items-center gap-2 group flex-row-reverse"
        >
          <div className="bg-rose-500 text-white w-10 h-10 flex items-center justify-center rounded-full shadow-md font-black text-xl">
            ＋
          </div>
          <span className="font-black text-xs text-rose-500">אירוע חדש</span>
        </button>
      )}

      {/* --- Swipeable Bottom Sheet --- */}
      {showCreateModal && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-end justify-center touch-none overscroll-none"
          onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onClick={(e) => { if(e.target === e.currentTarget) handleCloseModal(); }}
        >
          <div style={{ transform: `translateY(${translateY}px)` }} className="bg-white w-full rounded-t-[2.5rem] p-6 pb-12 shadow-2xl transition-transform duration-75 ease-out relative border-t border-white/20" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6 cursor-grab active:cursor-grabbing"></div>
            
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-black text-slate-800">{editingEventId ? 'עריכת אירוע ✏️' : 'אירוע חדש 🗓️'}</h2>
            </div>
            
            <form onSubmit={handleCreateEvent} className="space-y-4">
              <div>
                <input required type="text" value={newEvent.title} onChange={e => setNewEvent({...newEvent, title: e.target.value})} placeholder="כותרת האירוע (למשל: ישיבת ועד מיוחדת...)" className="w-full h-14 bg-rose-50/50 border border-rose-100 rounded-2xl px-4 text-sm font-bold focus:border-rose-400 focus:ring-2 focus:ring-rose-400/10 outline-none shadow-inner transition-all" />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <input required type="date" value={newEvent.date} onChange={e => setNewEvent({...newEvent, date: e.target.value})} className="w-full h-14 bg-rose-50/50 border border-rose-100 rounded-2xl px-4 text-sm font-bold focus:border-rose-400 outline-none shadow-inner transition-all text-slate-500" />
                </div>
                <div>
                  <input required type="time" value={newEvent.time} onChange={e => setNewEvent({...newEvent, time: e.target.value})} className="w-full h-14 bg-rose-50/50 border border-rose-100 rounded-2xl px-4 text-sm font-bold focus:border-rose-400 outline-none shadow-inner transition-all text-slate-500" />
                </div>
              </div>
              
              <div>
                <input type="text" value={newEvent.location} onChange={e => setNewEvent({...newEvent, location: e.target.value})} placeholder="מיקום (למשל: לובי קומה 1)" className="w-full h-14 bg-rose-50/50 border border-rose-100 rounded-2xl px-4 text-sm font-bold focus:border-rose-400 focus:ring-2 focus:ring-rose-400/10 outline-none shadow-inner transition-all" />
              </div>
              
              <div className="relative group">
                <textarea rows={4} value={newEvent.description} onChange={e => setNewEvent({...newEvent, description: e.target.value})} placeholder="כל מה שהדיירים צריכים לדעת..." className="w-full bg-rose-50/50 border border-rose-100 rounded-2xl px-4 py-4 pb-12 text-sm font-bold focus:border-rose-400 focus:ring-2 focus:ring-rose-400/10 outline-none resize-none shadow-inner transition-all"></textarea>
                
                <button type="button" onClick={handleAIEnhance} disabled={isAiProcessing} className="absolute bottom-3 left-3 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white text-[10px] font-black px-3 py-1.5 rounded-xl shadow-md flex items-center gap-1.5 transition-all active:scale-95 z-10 disabled:opacity-70">
                   {isAiProcessing ? <span className="animate-pulse">מנסח...</span> : <><span>✨</span> נסח חגיגית</>}
                </button>
              </div>
              
              <button disabled={isSubmitting} type="submit" className="w-full h-14 flex items-center justify-center bg-rose-500 hover:bg-rose-600 text-white font-black rounded-2xl shadow-[0_8px_25px_rgba(244,63,94,0.3)] active:scale-[0.98] transition-all mt-4 text-lg">
                {isSubmitting ? 'שומר נתונים...' : (editingEventId ? 'שמור שינויים' : 'פרסם אירוע לדיירים')}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

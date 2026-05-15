'use client'

import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import useSWR from 'swr'
import { supabase } from '../../../lib/supabase'
import { playSystemSound } from '../../../components/providers/AppManager'
import AnimatedSheet from '../../../components/ui/AnimatedSheet'
import { WhatsAppIcon, EditIcon, DeleteIcon, PinIcon } from '../../../components/ui/ActionIcons'

interface Profile { full_name: string; avatar_url: string; apartment?: string; phone?: string; }
interface RSVP { id: string; user_id: string; status: string; note: string; profiles?: Profile; }
interface BuildingEvent { id: string; building_id: string; creator_id: string; title: string; description: string; location: string; event_date: string; status: string; event_type?: string; is_pinned: boolean; created_at: string; event_rsvps: RSVP[]; }
interface EventUser { id: string; full_name: string; building_id: string; role: string; email?: string; avatar_url?: string; phone?: string; }

const fetcher = async () => {
  const { data: { session }, error: sessErr } = await supabase.auth.getSession();
  if (sessErr || !session) throw new Error('Unauthorized');
  
  const { data: prof } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
  if (!prof) throw new Error('Profile missing');
  
  const { data: eventsData, error } = await supabase
    .from('events')
    .select('*, event_rsvps(id, user_id, status, note, profiles(full_name, avatar_url))')
    .eq('building_id', prof.building_id)
    .order('event_date', { ascending: true });
    
  if (error) console.error("Error fetching events:", error);
  return { profile: prof as EventUser, events: (eventsData || []) as BuildingEvent[] };
};

const getDaysUntil = (dateString: string) => {
  const eventDate = new Date(dateString);
  eventDate.setHours(0,0,0,0);
  const today = new Date();
  today.setHours(0,0,0,0);
  const diffDays = Math.ceil((eventDate.getTime() - today.getTime()) / 86400000);
  if (diffDays === 0) return 'היום! ⏰';
  if (diffDays === 1) return 'מחר! ⏰';
  if (diffDays < 0) return 'עבר';
  return `בעוד ${diffDays} ימים`;
};

const getEventStyle = (type?: string) => {
  switch (type) {
    case 'meeting': return { bg: 'bg-[#1D4ED8]/10', border: 'border-[#1D4ED8]/20', text: 'text-[#1D4ED8]', icon: '👥', label: 'אסיפת דיירים' };
    case 'maintenance': return { bg: 'bg-rose-50', border: 'border-rose-100', text: 'text-rose-600', icon: '🔧', label: 'תחזוקה' };
    case 'booking': return { bg: 'bg-[#10B981]/10', border: 'border-[#10B981]/20', text: 'text-[#10B981]', icon: '🎉', label: 'אירוע דייר' };
    default: return { bg: 'bg-slate-100', border: 'border-slate-200', text: 'text-slate-600', icon: '🗓️', label: 'כללי' };
  }
};

const generateCalendarLink = (event: BuildingEvent, isIOS: boolean) => {
  const startDate = new Date(event.event_date);
  const endDate = new Date(startDate.getTime() + 2 * 3600000);
  const formatGoogleDate = (d: Date) => d.toISOString().replace(/-|:|\.\d\d\d/g, '');
  
  if (isIOS) {
    const icsContent = `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nDTSTART:${formatGoogleDate(startDate)}\nDTEND:${formatGoogleDate(endDate)}\nSUMMARY:${event.title}\nDESCRIPTION:${event.description || ''}\nLOCATION:${event.location || ''}\nEND:VEVENT\nEND:VCALENDAR`;
    return `data:text/calendar;charset=utf8,${encodeURIComponent(icsContent)}`;
  }
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${formatGoogleDate(startDate)}/${formatGoogleDate(endDate)}&details=${encodeURIComponent(event.description || '')}&location=${encodeURIComponent(event.location || '')}`;
};

export default function EventsPage() {
  const { data, error, mutate } = useSWR('events_data', fetcher, { revalidateOnFocus: true, keepPreviousData: true, dedupingInterval: 2000 });
  
  const profile = data?.profile;
  const events = data?.events || [];
  
  const [filterTab, setFilterTab] = useState<'upcoming' | 'my_events' | 'history'>('upcoming');
  const [userNotes, setUserNotes] = useState<Record<string, string>>({});
  const [expandedEvents, setExpandedEvents] = useState<Record<string, boolean>>({});
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  
  const [eventType, setEventType] = useState<'meeting' | 'booking' | 'maintenance'>('meeting');
  const [newEvent, setNewEvent] = useState({ title: '', date: '', time: '', location: '', description: '' });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [customAlert, setCustomAlert] = useState<{ title: string, message: string, type: 'success' | 'error' | 'info' } | null>(null);
  const [customConfirm, setCustomConfirm] = useState<{ title: string, message: string, onConfirm: () => void } | null>(null);
  const [mounted, setMounted] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  
  const [aiInsight, setAiInsight] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(true);
  const [showAiBubble, setShowAiBubble] = useState(false);
  const lastAnalyzedRef = useRef('');
  
  const isAdmin = profile?.role === 'admin' || profile?.email === 'talyohala1@gmail.com';
  const aiAvatarUrl = profile?.avatar_url || "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Smilies/Robot.png";

  useEffect(() => {
    setMounted(true);
    const ua = window.navigator.userAgent;
    setIsIOS(!!ua.match(/iPad/i) || !!ua.match(/iPhone/i) || (!!ua.match(/WebKit/i) && !!ua.match(/Macintosh/i) && 'ontouchend' in document));
  }, []);

  useEffect(() => {
    if (!profile?.building_id) return;
    const channel = supabase.channel(`events_realtime_${profile.building_id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events', filter: `building_id=eq.${profile.building_id}` }, () => mutate())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_rsvps' }, () => mutate())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile?.building_id, mutate]);

  useEffect(() => {
    if (!profile || events.length === 0) { setIsAiLoading(false); return; }
    const currentHash = `${profile.id}-${events.length}`;
    if (lastAnalyzedRef.current === currentHash) return;
    lastAnalyzedRef.current = currentHash;
    
    const processAiAnalysis = async () => {
      setIsAiLoading(true);
      const upcomingEvent = events.find(e => e.status !== 'frozen' && new Date(e.event_date) >= new Date());
      const attendingCount = upcomingEvent?.event_rsvps.filter(r => r.status === 'attending').length || 0;
      
      try {
        let context = isAdmin 
          ? `מנהל הוועד: ${profile.full_name}. אירוע קרוב: "${upcomingEvent?.title || 'אין'}". מאשרים: ${attendingCount}. נסח משפט חיזוק קצר למנהל. 2 שורות. מקסימום 2 אימוג'ים בכל הטקסט.`
          : `דייר: ${profile.full_name}. אירוע קהילתי קרוב: "${upcomingEvent?.title || 'אין'}". אישרו: ${attendingCount}. נסח הודעה נעימה מגוף ראשון. 2 שורות. מקסימום 2 אימוג'ים בכל הטקסט.`;
          
        const res = await fetch('/api/ai/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ description: context, mode: 'insight' }) });
        const aiData = await res.json();
        setAiInsight(aiData.text || '');
      } catch (err) {
        setAiInsight(isAdmin ? `האירוע הקרוב מתקרב 🚀\n${attendingCount} דיירים כבר אישרו הגעה!` : `היי ${profile.full_name}, נפגשים בקרוב! ✨\nכבר ${attendingCount} שכנים אישרו הגעה.`);
      } finally {
        setIsAiLoading(false); setShowAiBubble(true); setTimeout(() => setShowAiBubble(false), 20000);
      }
    };
    processAiAnalysis();
  }, [profile, events, isAdmin, data]);

  const handleRSVP = async (eventId: string, status: string, isNoteUpdateOnly = false) => {
    if (!profile) return;
    playSystemSound('click');
    let finalNote = userNotes[eventId] || '';
    
    if (!isNoteUpdateOnly && !finalNote) {
      const myRsvp = events.find(e => e.id === eventId)?.event_rsvps.find(r => r.user_id === profile.id);
      if (myRsvp?.note) finalNote = myRsvp.note;
    }

    const { error } = await supabase.from('event_rsvps').upsert({ 
      event_id: eventId, user_id: profile.id, status, note: finalNote 
    }, { onConflict: 'event_id,user_id' });
    
    if (!error) {
      setCustomAlert({ title: isNoteUpdateOnly ? 'ההערה נשמרה' : 'סטטוס עודכן', message: isNoteUpdateOnly ? 'ההערה שכתבת צורפה לאישור ותוצג בלוח.' : 'סטטוס ההגעה שלך נשמר בהצלחה.', type: 'success' });
      if (isNoteUpdateOnly) setUserNotes(prev => ({...prev, [eventId]: ''}));
      mutate();
    }
  };

  const handleUpdateNoteOnly = (eventId: string) => {
    if (!profile || !userNotes[eventId]?.trim()) return;
    // באג פיקס: אם אין לו סטטוס קודם והוא רק כתב הערה, נגדיר אותו כ-attending
    const currentStatus = events.find(e => e.id === eventId)?.event_rsvps.find(r => r.user_id === profile.id)?.status || 'attending';
    handleRSVP(eventId, currentStatus, true);
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const payload = { 
        building_id: profile.building_id, 
        creator_id: profile.id, 
        title: newEvent.title, 
        description: newEvent.description, 
        location: newEvent.location, 
        event_type: eventType,
        event_date: new Date(`${newEvent.date}T${newEvent.time}`).toISOString() 
      };
      
      if (editingEventId) {
        await supabase.from('events').update(payload).eq('id', editingEventId);
        setCustomAlert({ title: "עודכן!", message: "האירוע נשמר בהצלחה ועודכן בלוח.", type: "success" });
      } else {
        await supabase.from('events').insert(payload);
        const { data: tenants } = await supabase.from('profiles').select('id').eq('building_id', profile.building_id).neq('id', profile.id);
        if (tenants) {
          await supabase.from('notifications').insert(tenants.map(t => ({ receiver_id: t.id, sender_id: profile.id, type: 'event', title: 'אירוע קהילתי חדש! 🎉', content: `נקבע אירוע: ${newEvent.title}.`, link: '/events' })));
        }
        setCustomAlert({ title: "פורסם!", message: "אירוע חדש נוסף ללוח ולחברי הקהילה.", type: "success" });
      }
      setShowCreateModal(false); setEditingEventId(null); setNewEvent({ title: '', date: '', time: '', location: '', description: '' }); mutate();
    } catch (err) {
      setCustomAlert({ title: "תקלה", message: "בדוק שהתאריך והשעה תקינים ונסה שוב.", type: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleFreeze = async (eventId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'frozen' ? 'active' : 'frozen';
    await supabase.from('events').update({ status: newStatus }).eq('id', eventId);
    playSystemSound('notification'); mutate(); setOpenMenuId(null);
  };

  const togglePinEvent = async (event: BuildingEvent) => {
    await supabase.from('events').update({ is_pinned: !event.is_pinned }).eq('id', event.id);
    playSystemSound('click'); mutate(); setOpenMenuId(null);
  };

  const handleEndEvent = (eventId: string) => {
    setCustomConfirm({ title: 'מחיקת אירוע', message: 'האירוע יוסר לחלוטין מלוח הבניין. להמשיך?', onConfirm: async () => { await supabase.from('events').delete().eq('id', eventId); mutate(); setCustomConfirm(null); playSystemSound('click'); setOpenMenuId(null); }});
  };

  const handleAIEnhance = async () => {
    if (!newEvent.title) { setCustomAlert({title: 'רגע אחד', message: 'הזן לפחות כותרת כדי שה-AI יוכל לעזור 🪄', type: 'info'}); return; }
    playSystemSound('click');
    setIsAiProcessing(true);
    try {
      const res = await fetch('/api/ai/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ description: `נסח תיאור אירוע חגיגי ונעים. הגבלה חמורה: השתמש בדיוק ב-2 אימוג'ים בכל הטקסט. אירוע: "${newEvent.title}". ${newEvent.description ? `פרטים: ${newEvent.description}` : ''}`, mode: 'insight' }) });
      const data = await res.json();
      if (data.text) { playSystemSound('notification'); setNewEvent(prev => ({...prev, description: data.text.trim()})); }
    } catch (err) {}
    setIsAiProcessing(false);
  };

  const openEditModal = (event: BuildingEvent) => {
    // באג פיקס: חילוץ התאריך המקומי ללא קפיצת Timezone
    const d = new Date(event.event_date);
    const localDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const localTime = d.toTimeString().slice(0, 5);
    
    setEventType((event.event_type as any) || 'meeting');
    setNewEvent({ title: event.title, date: localDate, time: localTime, location: event.location || '', description: event.description || '' });
    setEditingEventId(event.id); setShowCreateModal(true); setOpenMenuId(null);
  };

  const handleShareWhatsApp = (event: BuildingEvent) => {
    playSystemSound('click'); setOpenMenuId(null);
    const dateStr = new Date(event.event_date).toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
    const text = `היי שכנים! 🏢\nמוזמנים לאירוע שלנו:\n*${event.title}*\n\n🗓️ מתי? ${dateStr}\n📍 איפה? ${event.location || 'בבניין'}\n\n${event.description ? `💡 פרטים:\n${event.description}\n\n` : ''}כנסו לאפליקציית שכן+ לאשר הגעה! ✨`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const copyToClipboard = (event: BuildingEvent) => {
    playSystemSound('click'); setOpenMenuId(null);
    const dateStr = new Date(event.event_date).toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
    const text = `*${event.title}*\n🗓️ ${dateStr}\n📍 ${event.location || 'בבניין'}\n${event.description ? `\n${event.description}` : ''}`;
    navigator.clipboard.writeText(text);
    setCustomAlert({ title: 'הועתק!', message: 'פרטי האירוע הועתקו ללוח.', type: 'info' });
  };

  if (!data && !error) return <div className="flex justify-center items-center h-[100dvh]"><div className="w-12 h-12 border-4 border-[#1D4ED8]/30 border-t-[#1D4ED8] rounded-full animate-spin"></div></div>;

  const todayStart = new Date();
  todayStart.setHours(0,0,0,0);
  
  const displayedEvents = events.filter(ev => {
    const isPast = new Date(ev.event_date) < todayStart;
    if (filterTab === 'history') return isPast;
    if (filterTab === 'my_events') return ev.creator_id === profile?.id;
    return !isPast;
  }).sort((a, b) => {
    if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
    const timeA = new Date(a.event_date).getTime();
    const timeB = new Date(b.event_date).getTime();
    return filterTab === 'history' ? timeB - timeA : timeA - timeB; 
  });

  return (
    <div className="flex flex-col flex-1 w-full pb-32 relative bg-transparent min-h-[100dvh]" dir="rtl" onClick={() => setOpenMenuId(null)}>
      
      {mounted && customAlert && createPortal(
        <div className="fixed inset-0 z-[10000] bg-black/40 backdrop-blur-sm flex justify-center items-center p-4" onClick={() => setCustomAlert(null)} dir="rtl">
          <div className="bg-white/95 backdrop-blur-xl rounded-[1.5rem] p-6 w-full max-w-sm shadow-2xl text-center animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <div className={`w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center shadow-lg ${customAlert.type === 'success' ? 'bg-[#10B981]/10 text-[#10B981]' : customAlert.type === 'info' ? 'bg-slate-100 text-slate-600' : 'bg-red-50 text-red-500'}`}>
              {customAlert.type === 'success' ? <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg> : <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>}
            </div>
            <h3 className="text-2xl font-black text-slate-800 mb-2">{customAlert.title}</h3>
            <p className="text-base text-slate-500 mb-6 font-medium">{customAlert.message}</p>
            <button onClick={() => setCustomAlert(null)} className="w-full h-14 bg-[#1E293B] text-white font-bold rounded-xl active:scale-95 transition text-lg">סגירה</button>
          </div>
        </div>, document.body
      )}

      {mounted && customConfirm && createPortal(
        <div className="fixed inset-0 z-[10000] bg-black/40 backdrop-blur-sm flex justify-center items-center p-4" dir="rtl">
          <div className="bg-white/95 backdrop-blur-xl rounded-[1.5rem] p-6 w-full max-w-sm shadow-2xl text-center animate-in zoom-in-95">
            <div className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center bg-rose-50 text-rose-500 shadow-sm"><svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77-1.333.192 3 1.732 3z"></path></svg></div>
            <h3 className="text-2xl font-black text-slate-800 mb-2">{customConfirm.title}</h3>
            <p className="text-base text-slate-500 mb-6 font-medium">{customConfirm.message}</p>
            <div className="flex gap-3">
              <button onClick={() => setCustomConfirm(null)} className="flex-1 h-14 bg-gray-100 text-slate-600 font-bold rounded-xl hover:bg-gray-200 transition text-lg">ביטול</button>
              <button onClick={customConfirm.onConfirm} className="flex-1 h-14 bg-rose-500 text-white font-bold rounded-xl transition shadow-sm active:scale-95 text-lg">אישור מחיקה</button>
            </div>
          </div>
        </div>, document.body
      )}

      <div className="px-6 pt-6 pb-4"><h2 className="text-2xl font-black text-slate-800 tracking-tight">לוח אירועים</h2></div>

      <div className="px-6 mb-5">
        <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1 relative z-10">
          {[
            { id: 'upcoming', label: 'קרובים' },
            { id: 'my_events', label: 'ההזמנות שלי' },
            { id: 'history', label: 'היסטוריה' }
          ].map(tab => {
            const isActive = filterTab === tab.id;
            return (
              <button key={tab.id} onClick={(e) => { e.stopPropagation(); playSystemSound('click'); setFilterTab(tab.id as any); }} className={`px-5 h-10 rounded-full text-[13px] transition-all flex items-center justify-center font-bold whitespace-nowrap shrink-0 border shadow-sm ${isActive ? 'bg-[#1D4ED8] text-white border-[#1D4ED8]' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-6 space-y-4 w-full relative z-10 animate-in fade-in duration-300">
        {displayedEvents.length === 0 ? (
          <div className="text-center py-16 bg-white/60 backdrop-blur-md rounded-[2rem] border border-[#1D4ED8]/10 shadow-sm">
            <div className="w-16 h-16 bg-[#1D4ED8]/5 rounded-full flex items-center justify-center mx-auto mb-3 shadow-inner text-[#1D4ED8]"><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg></div>
            <p className="text-slate-500 font-bold text-sm">הלוח שקט כרגע ✨</p>
            <p className="text-slate-400 text-xs mt-1">אין אירועים בקטגוריה זו</p>
          </div>
        ) : (
          displayedEvents.map((event, idx) => {
            const isFrozen = event.status === 'frozen';
            const isPast = new Date(event.event_date) < todayStart;
            const myRsvp = event.event_rsvps.find(r => r.user_id === profile?.id);
            const attendingList = event.event_rsvps.filter(r => r.status === 'attending');
            const attendingCount = attendingList.length;
            const lateCount = event.event_rsvps.filter(r => r.status === 'late').length;
            const daysUntil = getDaysUntil(event.event_date);
            const isExpanded = expandedEvents[`${filterTab}-${event.id}`] || false;
            const style = getEventStyle(event.event_type);
            const isOwner = event.creator_id === profile?.id;

            return (
              <div key={event.id} className={`backdrop-blur-xl rounded-[2rem] p-5 border relative overflow-hidden transition-all duration-300 ${event.is_pinned ? 'border-orange-200/60 bg-gradient-to-br from-orange-50/80 to-white shadow-[0_8px_25px_rgba(249,115,22,0.15)]' : 'bg-white/90 border-slate-100 shadow-[0_8px_30px_rgba(29,78,216,0.04)]'} ${openMenuId === event.id ? 'z-50' : 'z-10'}`}>
                
                <div className="absolute top-0 right-0 flex overflow-hidden rounded-bl-[1.5rem] rounded-tr-[2rem] shadow-sm z-10 border-b border-l border-white/20">
                  {event.is_pinned ? (
                    <div className="px-5 py-1.5 bg-[#F59E0B] text-white text-[11px] font-black uppercase tracking-wider">נעוץ</div>
                  ) : (
                    <div className={`px-4 py-1.5 text-white text-[10px] font-black ${isPast || isFrozen ? 'bg-slate-400' : 'bg-[#1D4ED8]'}`}>{isFrozen ? 'מוקפא ❄️' : isPast ? 'הסתיים' : daysUntil}</div>
                  )}
                </div>

                <div className="flex justify-between items-start mb-2">
                  <div className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border w-max ${style.bg} ${style.border}`}>
                    <span>{style.icon}</span>
                    <span className={`text-[10px] font-black uppercase ${style.text}`}>{style.label}</span>
                  </div>

                  {(isAdmin || isOwner) && (
                    <div className="relative z-20 mr-auto pl-1">
                      <button onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === event.id ? null : event.id); }} className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-[#1D4ED8] bg-white/50 border border-slate-100 shadow-sm transition-colors active:scale-95">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"></path></svg>
                      </button>
                      {openMenuId === event.id && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)}></div>
                          <div className="absolute left-0 top-10 w-[170px] bg-white/95 backdrop-blur-xl border border-slate-100 shadow-[0_15px_50px_rgba(0,0,0,0.15)] rounded-2xl z-[150] py-1.5 animate-in zoom-in-95">
                            <button onClick={() => handleShareWhatsApp(event)} className="w-full text-right px-4 h-11 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-3 border-b border-slate-100/50"><WhatsAppIcon className="w-4 h-4" />שיתוף לוואטסאפ</button>
                            <button onClick={() => copyToClipboard(event)} className="w-full text-right px-4 h-11 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-3 border-b border-slate-100/50"><svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>העתק פרטים</button>
                            {isAdmin && <button onClick={() => togglePinEvent(event)} className="w-full text-right px-4 h-11 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-3 border-b border-slate-100/50"><PinIcon className={`w-4 h-4 ${event.is_pinned ? 'text-[#F59E0B]' : 'text-[#1D4ED8]'}`} />{event.is_pinned ? 'בטל נעיצה' : 'נעץ אירוע'}</button>}
                            <button onClick={() => openEditModal(event)} className="w-full text-right px-4 h-11 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-3 border-b border-slate-100/50"><EditIcon className="w-4 h-4 text-slate-400" />עריכת פרטים</button>
                            <button onClick={() => handleToggleFreeze(event.id, event.status)} className="w-full text-right px-4 h-11 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-3 border-b border-slate-100/50">
                              {isFrozen ? <><svg className="w-4 h-4 text-[#10B981]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path></svg>שחרר מהקפאה</> : <><svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>הקפאת אירוע</>}
                            </button>
                            <button onClick={() => handleEndEvent(event.id)} className="w-full text-right px-4 h-11 text-xs font-bold text-rose-500 hover:bg-red-50 flex items-center gap-3 mt-1 pt-1"><DeleteIcon className="w-4 h-4 text-rose-500" />מחיקת אירוע</button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>

                <div className="pt-1 pr-1 pl-4">
                  <h3 className={`text-xl font-black leading-tight mb-2 pr-1 ${event.is_pinned ? 'text-orange-600' : 'text-slate-800'}`}>{event.title}</h3>
                  <p className={`text-sm font-bold flex items-center gap-1.5 ${isFrozen || isPast ? 'text-slate-400' : 'text-[#1D4ED8]'}`}>
                    <svg className="w-4 h-4 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg> {new Date(event.event_date).toLocaleString('he-IL', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                  </p>
                  
                  {event.description && (
                    <div className="bg-[#F8FAFC]/80 p-3.5 rounded-2xl border border-slate-100 mt-3 mb-3 shadow-inner">
                      <p className="text-sm font-medium text-slate-600 whitespace-pre-wrap leading-relaxed">{event.description}</p>
                    </div>
                  )}
                  
                  {event.location && (
                    <span className={`text-[11px] font-black px-3 py-1.5 mt-2 rounded-xl border inline-flex items-center gap-1.5 shadow-sm ${isFrozen || isPast ? 'bg-slate-50 text-slate-400 border-slate-100' : 'text-slate-700 bg-white border-slate-100'}`}>
                      <svg className="w-3 h-3 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg> {event.location}
                    </span>
                  )}
                  
                  {!isFrozen && !isPast && (
                    <button onClick={(e) => { e.stopPropagation(); playSystemSound('click'); window.open(generateCalendarLink(event, isIOS), '_blank'); }} className="text-[#1D4ED8] text-[10px] font-black bg-[#1D4ED8]/5 px-3 h-7 rounded-lg border border-[#1D4ED8]/20 shadow-sm inline-flex items-center justify-center gap-1 hover:bg-[#1D4ED8]/10 transition-colors mr-2 mt-2">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg> יומן
                    </button>
                  )}
                </div>

                {!isFrozen && attendingCount > 0 && (
                  <div className={`flex items-center gap-3 mt-4 px-2 py-3 border-t rounded-xl ${isPast ? 'border-slate-100 bg-slate-50' : 'border-[#1D4ED8]/5 bg-[#1D4ED8]/[0.02]'}`}>
                    <div className="flex -space-x-2 -space-x-reverse mr-1">
                      {attendingList.slice(0, 5).map((r, i) => (<img key={i} src={r.profiles?.avatar_url || `https://api.dicebear.com/8.x/initials/svg?seed=${r.profiles?.full_name}`} className="w-9 h-9 rounded-full border-[2.5px] border-white shadow-sm object-cover" alt="avatar" />))}
                      {attendingCount > 5 && <div className="w-9 h-9 rounded-full border-[2.5px] border-white bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-500 shadow-sm">+{attendingCount - 5}</div>}
                    </div>
                    <div className="flex flex-col">
                      <span className={`text-xs font-black ${isPast ? 'text-slate-500' : 'text-slate-800'}`}>{attendingCount} {isPast ? 'הגיעו' : 'מגיעים!'}</span>
                      {!isPast && <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">הצטרפו אליהם</span>}
                    </div>
                  </div>
                )}

                <div className="mt-4 pt-3 border-t border-slate-100">
                  {isFrozen ? (
                    <div className="text-center bg-slate-50 border border-slate-100 rounded-2xl p-4 shadow-sm">
                      <div className="text-2xl mb-1">❄️</div>
                      <h4 className="font-black text-slate-800 text-sm">האירוע הוקפא כרגע</h4>
                      <p className="text-xs text-slate-500 font-bold mt-0.5">מועד חדש יעודכן בהמשך על ידי הוועד.</p>
                    </div>
                  ) : isPast ? (
                    <div className="text-center bg-slate-50 border border-slate-100 rounded-2xl p-3 shadow-inner">
                      <h4 className="font-black text-slate-600 text-sm flex items-center justify-center gap-1.5"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"></path></svg> האירוע הסתיים</h4>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      <p className="text-[10px] font-black text-slate-400 uppercase px-1">אישור הגעה</p>
                      
                      <div className="flex gap-2">
                        <button type="button" onClick={(e) => { e.stopPropagation(); handleRSVP(event.id, 'attending'); }} className={`flex-1 h-12 flex flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-black transition-all active:scale-95 ${myRsvp?.status === 'attending' ? 'bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20 shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 shadow-sm'}`}><span className="text-sm">🎉</span> מגיע</button>
                        <button type="button" onClick={(e) => { e.stopPropagation(); handleRSVP(event.id, 'late'); }} className={`flex-1 h-12 flex flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-black transition-all active:scale-95 ${myRsvp?.status === 'late' ? 'bg-amber-50 text-amber-600 border border-amber-100 shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 shadow-sm'}`}><span className="text-sm">⏰</span> מאחר</button>
                        <button type="button" onClick={(e) => { e.stopPropagation(); handleRSVP(event.id, 'maybe'); }} className={`flex-1 h-12 flex flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-black transition-all active:scale-95 ${myRsvp?.status === 'maybe' ? 'bg-slate-100 text-slate-700 border border-slate-200 shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 shadow-sm'}`}><span className="text-sm">🤔</span> אולי</button>
                        <button type="button" onClick={(e) => { e.stopPropagation(); handleRSVP(event.id, 'declined'); }} className={`flex-1 h-12 flex flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-black transition-all active:scale-95 ${myRsvp?.status === 'declined' ? 'bg-rose-50 text-rose-500 border border-rose-200 shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 shadow-sm'}`}><span className="text-sm">❌</span> לא בא</button>
                      </div>

                      <div className="relative mt-1">
                        <input type="text" placeholder="הערה קצרה לוועד / שכנים..." value={userNotes[event.id] || ''} onChange={(e) => setUserNotes({...userNotes, [event.id]: e.target.value})} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleUpdateNoteOnly(event.id); } }} className="w-full bg-[#F8FAFC] border border-slate-200 rounded-xl py-3 pr-4 pl-12 text-xs font-bold outline-none focus:border-[#1D4ED8] shadow-inner transition-all placeholder-slate-400" dir="rtl" onClick={(e) => e.stopPropagation()} />
                        <button type="button" onClick={(e) => { e.stopPropagation(); handleUpdateNoteOnly(event.id); }} className="absolute left-1.5 top-1.5 bottom-1.5 w-9 flex items-center justify-center bg-white border border-slate-200 hover:bg-slate-50 text-[#1D4ED8] rounded-lg transition active:scale-95 shadow-sm">
                          <svg className="w-4 h-4 transform -rotate-45" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
                        </button>
                      </div>
                    </div>
                  )}

                  {event.event_rsvps.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <button onClick={(e) => { e.stopPropagation(); playSystemSound('click'); setExpandedEvents(prev => ({...prev, [`${filterTab}-${event.id}`]: !prev[`${filterTab}-${event.id}`]})); }} className="w-full flex items-center justify-between group active:scale-95 transition-transform">
                        <div className="flex items-center gap-2 text-xs font-black text-[#1D4ED8]">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z"></path></svg>
                          {isAdmin ? 'דשבורד ועד:' : 'תגובות השכנים:'}
                        </div>
                        {isAdmin && (
                          <div className="flex gap-1.5 text-[9px] font-black uppercase">
                            <span className="bg-[#10B981]/10 text-[#10B981] px-2 py-0.5 rounded-lg border border-[#10B981]/20 shadow-sm">{attendingCount} אישרו</span>
                            {lateCount > 0 && <span className="bg-amber-50 text-amber-600 px-2 py-0.5 rounded-lg border border-amber-100 shadow-sm">{lateCount} יאחרו</span>}
                          </div>
                        )}
                        <div className={`w-7 h-7 flex items-center justify-center rounded-full bg-[#1D4ED8]/5 text-[#1D4ED8] transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"></path></svg>
                        </div>
                      </button>

                      <div className={`overflow-hidden transition-all duration-500 ease-in-out ${isExpanded ? 'max-h-[1500px] opacity-100 mt-3' : 'max-h-0 opacity-0'}`}>
                        <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100 flex flex-col gap-3 shadow-inner">
                          {event.event_rsvps.map((rsvp: any) => {
                            if (!isAdmin && !rsvp.note) return null;
                            return (
                              <div key={rsvp.id} className="flex items-start justify-between bg-white p-2.5 rounded-xl border border-slate-100 shadow-sm">
                                <div className="flex gap-2.5 items-center flex-1">
                                  <img src={rsvp.profiles?.avatar_url || `https://api.dicebear.com/8.x/initials/svg?seed=${rsvp.profiles?.full_name}`} className="w-8 h-8 rounded-full object-cover shadow-sm border border-slate-200 shrink-0" alt="avatar" />
                                  <div className="flex flex-col">
                                    <span className="text-[11px] font-black text-slate-800">{rsvp.profiles?.full_name}</span>
                                    {rsvp.note && <span className="text-[10px] font-bold text-slate-500 mt-0.5 leading-snug break-words pr-1">{rsvp.note}</span>}
                                  </div>
                                </div>
                                {isAdmin && (
                                  <span className={`shrink-0 ml-1 text-[9px] font-black px-2 py-0.5 rounded-lg uppercase border shadow-sm ${rsvp.status === 'attending' ? 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/20' : rsvp.status === 'late' ? 'bg-amber-50 text-amber-600 border-amber-100' : rsvp.status === 'maybe' ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-rose-50 text-rose-500 border-rose-100'}`}>
                                    {rsvp.status === 'attending' ? 'מגיע' : rsvp.status === 'late' ? 'מאחר' : rsvp.status === 'maybe' ? 'אולי' : 'לא מגיע'}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <button onClick={(e) => { e.stopPropagation(); playSystemSound('click'); setEditingEventId(null); setNewEvent({ title: '', date: '', time: '', location: '', description: '' }); setShowCreateModal(true); }} className="fixed bottom-24 left-6 z-40 bg-white/90 backdrop-blur-md border border-[#1D4ED8]/20 text-slate-800 pl-4 pr-1.5 py-1.5 rounded-full shadow-[0_8px_30px_rgba(29,78,216,0.15)] hover:scale-105 active:scale-95 transition flex items-center gap-2 group flex-row-reverse">
        <div className="bg-[#1D4ED8] text-white w-10 h-10 flex items-center justify-center rounded-full shadow-md text-xl font-black">＋</div>
        <span className="font-black text-xs text-[#1D4ED8]">אירוע חדש</span>
      </button>

      {/* --- Unified Animated Sheet (Creation/Editing) עם עיצוב מדויק לפי התמונה --- */}
      <AnimatedSheet isOpen={showCreateModal} onClose={() => setShowCreateModal(false)}>
        <div className="flex justify-between items-center mb-6"><h2 className="text-2xl font-black text-slate-800 text-center w-full">{editingEventId ? 'עריכת אירוע ✏️' : 'יצירת אירוע חדש'}</h2></div>
        
        <div className="flex gap-2 mb-6 overflow-x-auto hide-scrollbar pb-1 justify-center relative z-10">
          {[
            { id: 'meeting', label: 'אסיפת דיירים' },
            { id: 'booking', label: 'הזמנת מתחם' },
            { id: 'maintenance', label: 'עבודות תחזוקה' }
          ].map(tag => (
            <button key={tag.id} type="button" onClick={() => setEventType(tag.id as any)} className={`px-4 py-2.5 rounded-full text-[13px] font-black shrink-0 transition-all shadow-sm border ${eventType === tag.id ? 'bg-[#1D4ED8] text-white border-[#1D4ED8]' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
              {tag.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleCreateEvent} className="flex flex-col relative min-h-[420px]">
          <div className="flex-1 overflow-y-auto hide-scrollbar pb-24 pt-1 space-y-4">
            
            <div className="w-full bg-white border border-slate-200 rounded-[1.5rem] p-4 flex flex-col gap-2 shadow-sm">
              <input type="text" required value={newEvent.title} onChange={e => setNewEvent({...newEvent, title: e.target.value})} placeholder={eventType === 'meeting' ? "נושא האסיפה..." : "שם האירוע..."} className="w-full bg-transparent text-xl font-black text-slate-800 placeholder-slate-400 outline-none tracking-tight" />
              <div className="h-[1px] w-full bg-slate-100 my-1 rounded-full"></div>
              <textarea rows={3} value={newEvent.description} onChange={e => setNewEvent({...newEvent, description: e.target.value})} placeholder={isAiProcessing ? "משדרג את התיאור בשבילך... ✨" : "פרטים נוספים, אג'נדה (ניתן להיעזר ב-AI מטה)..."} className={`w-full bg-transparent text-sm font-medium outline-none resize-none min-h-[80px] transition-all ${isAiProcessing ? 'text-[#1D4ED8] animate-pulse' : 'text-slate-500 placeholder-slate-400'}`} />
            </div>

            <div className="grid grid-cols-2 gap-3 mt-2">
              <div className="bg-white border border-slate-200 rounded-[1.2rem] p-3 flex flex-col shadow-sm">
                <span className="text-[10px] text-slate-400 font-bold uppercase block mb-1">תאריך</span>
                <input required type="date" value={newEvent.date} onChange={e => setNewEvent({...newEvent, date: e.target.value})} className="w-full bg-transparent font-bold text-slate-800 outline-none" min={!editingEventId ? new Date().toISOString().split('T')[0] : undefined} />
              </div>
              <div className="bg-white border border-slate-200 rounded-[1.2rem] p-3 flex flex-col shadow-sm">
                <span className="text-[10px] text-slate-400 font-bold uppercase block mb-1">מיקום (אופציונלי)</span>
                <input type="text" value={newEvent.location} onChange={e => setNewEvent({...newEvent, location: e.target.value})} placeholder="לובי" className="w-full bg-transparent font-bold text-slate-800 outline-none" />
              </div>
              <div className="bg-white border border-slate-200 rounded-[1.2rem] p-3 flex flex-col shadow-sm">
                <span className="text-[10px] text-slate-400 font-bold uppercase block mb-1">התחלה</span>
                <input required type="time" value={newEvent.time} onChange={e => setNewEvent({...newEvent, time: e.target.value})} className="w-full bg-transparent font-bold text-slate-800 outline-none" />
              </div>
              <div className="bg-white border border-slate-200 rounded-[1.2rem] p-3 flex flex-col shadow-sm">
                <span className="text-[10px] text-slate-400 font-bold uppercase block mb-1">סיום</span>
                <input type="time" placeholder="--:--" className="w-full bg-transparent font-bold text-slate-800 outline-none opacity-50" title="אופציונלי - כרגע לא נשמר בבסיס הנתונים" />
              </div>
            </div>

          </div>

          <div className="absolute bottom-0 left-0 right-0 pt-4 bg-gradient-to-t from-white via-white to-transparent flex items-center justify-between border-t border-slate-100">
            <button type="button" onClick={handleAIEnhance} disabled={isAiProcessing || !newEvent.title} className="w-[60px] h-[60px] rounded-full bg-blue-50 hover:bg-blue-100 text-[#1D4ED8] flex items-center justify-center transition-all active:scale-95 shadow-sm border border-[#1D4ED8]/10 disabled:opacity-50 group shrink-0">
              {isAiProcessing ? <span className="w-6 h-6 border-[2.5px] border-[#1D4ED8] border-t-transparent rounded-full animate-spin" /> : <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none"><path d="M12 2L14.4 7.6L20 10L14.4 12.4L12 18L9.6 12.4L4 10L9.6 7.6L12 2Z" fill="currentColor"/><path opacity="0.5" d="M18 16L19 18.5L21.5 19.5L19 20.5L18 23L17 20.5L14.5 19.5L17 18.5L18 16Z" fill="currentColor"/><path opacity="0.5" d="M6 14L6.6 15.5L8.1 16.1L6.6 16.7L6 18.2L5.4 16.7L3.9 16.1L5.4 15.5L6 14Z" fill="currentColor"/></svg>}
            </button>

            <button type="submit" disabled={isSubmitting || !newEvent.title || !newEvent.date || !newEvent.time} className="flex-1 mr-3 h-[60px] rounded-2xl bg-[#60A5FA] hover:bg-[#3b82f6] text-white flex items-center justify-center font-black text-lg shadow-lg active:scale-95 transition disabled:opacity-50">
              {isSubmitting ? <span className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin inline-block align-middle" /> : 'שמור ביומן'}
            </button>
          </div>
        </form>
      </AnimatedSheet>

      <div className={`fixed bottom-24 right-6 z-50 flex flex-col items-end pointer-events-none transition-all duration-700 ${isAiLoading || showAiBubble ? 'opacity-100 translate-y-0 visible' : 'opacity-0 translate-y-10 invisible'}`}>
        {showAiBubble && !isAiLoading && <div className="absolute bottom-[60px] right-0 mb-2 bg-white/95 backdrop-blur-md text-slate-800 p-4 rounded-2xl shadow-lg text-xs font-bold w-max max-w-[240px] leading-snug border border-[#1D4ED8]/20 text-right pointer-events-auto break-words">{aiInsight}</div>}
        <button onClick={() => setShowAiBubble(!showAiBubble)} className={`w-12 h-12 bg-transparent flex items-center justify-center pointer-events-auto active:scale-95 transition-transform duration-300 ${isAiLoading ? 'animate-pulse' : ''}`}>
          {isAiLoading ? <div className="w-12 h-12 bg-[#1D4ED8]/10 backdrop-blur-sm rounded-full flex items-center justify-center border border-[#1D4ED8]/30"><div className="w-5 h-5 border-2 border-[#1D4ED8] border-t-transparent rounded-full animate-spin" /></div> : <img src={aiAvatarUrl} alt="AI" className="w-12 h-12 object-contain drop-shadow-md rounded-full" />}
        </button>
      </div>

    </div>
  );
}

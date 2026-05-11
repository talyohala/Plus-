'use client'
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import { playSystemSound } from '../../../components/providers/AppManager';
import TicketCard, { ServiceTicket } from '../../../components/services/TicketCard';

interface UserProfile {
  id: string;
  full_name: string;
  building_id: string;
  role: string;
  avatar_url?: string;
  apartment?: string;
}

const mainTabs = ['הכל', 'פתוחות', 'בטיפול', 'טופלו'];

export default function ServicesPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [tickets, setTickets] = useState<ServiceTicket[]>([]);
  const [activeTab, setActiveTab] = useState('הכל');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('כללי');
  const [urgency, setUrgency] = useState('רגיל');
  const [mediaFile, setMediaFile] = useState<{ file: File; preview: string } | null>(null);

  const [customAlert, setCustomAlert] = useState<{ title: string; message: string; type: 'success' | 'error' | 'info' } | null>(null);
  
  const [aiSummary, setAiSummary] = useState<string>('');
  const [isAiLoading, setIsAiLoading] = useState(true);
  const [showAiBubble, setShowAiBubble] = useState(false);

  const isAdmin = profile?.role === 'admin';

  const aiAvatarUrl = useMemo(() => {
    return profile?.avatar_url || "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Smilies/Robot.png";
  }, [profile?.avatar_url]);

  const fetchTickets = useCallback(async (userId: string) => {
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (!prof || !prof.building_id) return;
    setProfile(prof);

    const { data } = await supabase.from('service_tickets')
      .select('*, profiles(full_name, avatar_url, apartment)')
      .eq('building_id', prof.building_id)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false });

    if (data) setTickets(data);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) fetchTickets(user.id);
    });
  }, [fetchTickets]);

  useEffect(() => {
    if (!profile?.building_id) return;
    const channelTopic = `tickets_realtime_${profile.building_id}`;
    const channel = supabase.channel(channelTopic)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_tickets', filter: `building_id=eq.${profile.building_id}` }, () => {
        fetchTickets(profile.id);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile?.building_id, profile?.id, fetchTickets]);

  useEffect(() => {
    if (!profile || tickets.length === 0) return;
    
    const analyzeTickets = async () => {
      setIsAiLoading(true);
      const openCount = tickets.filter(t => t.status !== 'טופל').length;
      const urgentCount = tickets.filter(t => t.status !== 'טופל' && t.urgency === 'דחוף').length;
      
      const context = `
        דייר: ${profile.full_name}.
        תקלות: ${openCount} פתוחות בבניין, מתוכן ${urgentCount} דחופות.
        נסח הודעת עזר קצרה ונעימה מגוף ראשון כעוזר הבניין.
        בדיוק 2 שורות. אימוג'י 1 בלבד.
      `;

      try {
        const res = await fetch('/api/ai/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ description: context, mode: 'insight' })
        });
        const data = await res.json();
        setAiSummary(data.text);
      } catch (err) {
        setAiSummary(`יש כרגע ${openCount} תקלות פתוחות בבניין. הוועד מטפל בהן בהקדם! ✨`);
      } finally {
        setIsAiLoading(false);
        setShowAiBubble(true);
        setTimeout(() => setShowAiBubble(false), 15000);
      }
    };

    analyzeTickets();
  }, [profile, tickets.length]);

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.building_id || !title.trim()) return;
    setIsSubmitting(true);

    let imageUrl: string | undefined = undefined;
    if (mediaFile) {
      const fileExt = mediaFile.file.name.split('.').pop();
      const filePath = `tickets/${profile.id}_${Date.now()}.${fileExt}`;
      const { error } = await supabase.storage.from('chat_uploads').upload(filePath, mediaFile.file);
      if (!error) {
        imageUrl = supabase.storage.from('chat_uploads').getPublicUrl(filePath).data.publicUrl;
      }
    }

    const payload = {
      building_id: profile.building_id,
      user_id: profile.id,
      title: title.trim(),
      description: description.trim(),
      category,
      urgency,
      status: 'פתוח',
      image_url: imageUrl,
      is_pinned: false,
      source: 'app'
    };

    const { error } = await supabase.from('service_tickets').insert([payload]);
    if (!error) {
      playSystemSound('notification');
      setIsModalOpen(false);
      setTitle('');
      setDescription('');
      setMediaFile(null);
      fetchTickets(profile.id);
      setCustomAlert({ title: 'התקלה דווחה!', message: 'הוועד עודכן ויטפל בנושא בהקדם.', type: 'success' });
    }
    setIsSubmitting(false);
  };

  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
      if (activeTab === 'פתוחות') return t.status === 'פתוח';
      if (activeTab === 'בטיפול') return t.status === 'בטיפול';
      if (activeTab === 'טופלו') return t.status === 'טופל';
      return true;
    });
  }, [tickets, activeTab]);

  return (
    <div className="flex flex-col flex-1 w-full pb-28 relative bg-transparent min-h-screen" dir="rtl" onClick={() => setOpenMenuId(null)}>
      <div className="px-4 mt-6 mb-5">
        <h2 className="text-2xl font-black text-slate-800 tracking-tight">תקלות ושירות</h2>
      </div>

      <div className="px-4 mb-6">
        <div className="flex bg-white/80 backdrop-blur-md p-1.5 rounded-full border border-[#1D4ED8]/10 shadow-sm relative z-10 overflow-x-auto hide-scrollbar">
          {mainTabs.map(tab => (
            <button
              key={tab}
              onClick={(e) => {
                e.stopPropagation();
                setActiveTab(tab);
              }}
              className={`flex-1 min-w-[70px] h-10 px-2 rounded-full text-xs transition-all flex items-center justify-center whitespace-nowrap ${
                activeTab === tab 
                  ? 'text-[#1D4ED8] font-black bg-[#1D4ED8]/10 shadow-sm border border-[#1D4ED8]/20' 
                  : 'text-slate-500 font-bold hover:text-[#1D4ED8]/70'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4 px-4 relative">
        {filteredTickets.length === 0 ? (
          <div className="text-center py-12 bg-[#1D4ED8]/5 rounded-3xl border border-[#1D4ED8]/10">
            <p className="text-[#1D4ED8]/60 font-bold text-xs">אין תקלות בסטטוס זה כרגע ✨</p>
          </div>
        ) : (
          filteredTickets.map(ticket => (
            <TicketCard
              key={ticket.id}
              ticket={ticket}
              currentUserId={profile?.id}
              isAdmin={isAdmin}
              openMenuId={openMenuId}
              onToggleMenu={setOpenMenuId}
              onUpdateStatus={(id, s) => { supabase.from('service_tickets').update({status: s}).eq('id', id).then(() => fetchTickets(profile!.id)); }}
              onTogglePin={(id, s) => { supabase.from('service_tickets').update({is_pinned: !s}).eq('id', id).then(() => fetchTickets(profile!.id)); }}
              onDelete={(id) => { supabase.from('service_tickets').delete().eq('id', id).then(() => fetchTickets(profile!.id)); }}
              onImageClick={(url) => setFullScreenImage(url)}
            />
          ))
        )}
      </div>

      <button 
        onClick={(e) => { e.stopPropagation(); setIsModalOpen(true); }} 
        className="fixed bottom-24 left-6 z-40 bg-white/90 backdrop-blur-md border border-[#1D4ED8]/20 text-slate-800 pl-4 pr-1.5 py-1.5 rounded-full shadow-[0_8px_30px_rgba(29,78,216,0.2)] hover:scale-105 active:scale-95 transition flex items-center gap-2 group flex-row-reverse"
      >
        <div className="bg-[#1D4ED8] text-white w-10 h-10 flex items-center justify-center rounded-full shadow-md font-black text-base">＋</div>
        <span className="font-black text-xs text-[#1D4ED8]">דיווח תקלה</span>
      </button>

      <div className={`fixed bottom-24 right-6 z-50 flex flex-col items-end pointer-events-none transition-all duration-700 ease-in-out ${showAiBubble ? 'opacity-100 translate-y-0 visible' : 'opacity-0 translate-y-10 invisible'}`}>
        {!isAiLoading && (
          <div className="absolute bottom-[60px] right-0 mb-2 bg-white/90 backdrop-blur-md border border-[#1D4ED8]/20 rounded-2xl px-4 py-2 shadow-[0_-4px_20px_rgba(0,0,0,0.1)] text-xs font-bold text-slate-700 w-max max-w-[240px] leading-snug text-right pointer-events-auto break-words animate-in fade-in slide-in-from-bottom-2 duration-500">
            {aiSummary}
          </div>
        )}
        <button onClick={(e) => { e.stopPropagation(); if (showAiBubble) setShowAiBubble(false); else if (!isAiLoading) setShowAiBubble(true); }} className={`w-12 h-12 bg-transparent flex items-center justify-center pointer-events-auto active:scale-95 transition-transform duration-300 ${isAiLoading ? 'animate-pulse' : 'animate-[bounce_3s_infinite]'}`}>
          {isAiLoading ? <div className="w-12 h-12 bg-[#1D4ED8]/10 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm border border-[#1D4ED8]/30"><div className="w-5 h-5 border-2 border-[#1D4ED8] border-t-transparent rounded-full animate-spin"></div></div> : <img src={aiAvatarUrl} alt="AI Avatar" className="w-12 h-12 object-contain drop-shadow-md rounded-full" />}
        </button>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex justify-center items-end" onClick={() => setIsModalOpen(false)}>
          <div className="bg-blue-50/95 backdrop-blur-xl w-full max-w-md rounded-t-[2rem] p-6 pb-8 shadow-2xl animate-in slide-in-from-bottom-10 max-h-[90vh] overflow-y-auto border-t border-[#1D4ED8]/20" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-1.5 bg-[#1D4ED8]/20 rounded-full mx-auto mb-6" />
            <div className="flex justify-between items-center mb-5">
              <div className="flex items-center gap-2">
                <span className="text-[#1D4ED8] font-black text-lg">🛠️</span>
                <h3 className="font-black text-xl text-blue-950">דיווח תקלה חדשה</h3>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 bg-[#1D4ED8]/10 rounded-full text-[#1D4ED8] hover:bg-[#1D4ED8]/20 transition">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <form onSubmit={handleCreateTicket} className="space-y-4">
              <div>
                <input id="ticket-img-upload" type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if(f) setMediaFile({file: f, preview: URL.createObjectURL(f)}); }} />
                {!mediaFile ? (
                  <label htmlFor="ticket-img-upload" className="w-full aspect-video bg-white/80 border border-dashed border-[#1D4ED8]/20 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:bg-white transition shadow-xs block">
                    <span className="text-xs font-bold text-[#1D4ED8]">הוספת תמונת התקלה</span>
                  </label>
                ) : (
                  <div className="w-full aspect-video relative rounded-2xl overflow-hidden shadow-xs border border-blue-100">
                    <img src={mediaFile.preview} className="w-full h-full object-cover" alt="preview" />
                    <button type="button" onClick={() => setMediaFile(null)} className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center bg-black/50 backdrop-blur-md text-white rounded-full hover:bg-red-500 transition active:scale-95 text-xs">✕</button>
                  </div>
                )}
              </div>

              <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-white/80 border border-[#1D4ED8]/15 rounded-2xl px-4 py-3.5 text-xs font-bold outline-none focus:border-[#1D4ED8] transition shadow-xs text-slate-800" placeholder="מה התקלה?" />
              <div className="flex gap-2">
                <select value={category} onChange={(e) => setCategory(e.target.value)} className="flex-1 h-12 bg-white/80 border border-[#1D4ED8]/15 rounded-2xl px-3 text-xs font-bold outline-none focus:border-[#1D4ED8] transition shadow-xs text-slate-800">
                  <option value="כללי">כללי</option><option value="מעלית">מעלית</option><option value="חשמל">חשמל</option><option value="אינסטלציה">אינסטלציה</option>
                </select>
                <select value={urgency} onChange={(e) => setUrgency(e.target.value)} className="flex-1 h-12 bg-white/80 border border-[#1D4ED8]/15 rounded-2xl px-3 text-xs font-bold outline-none focus:border-[#1D4ED8] transition shadow-xs text-slate-800">
                  <option value="רגיל">רגיל</option><option value="בינוני">בינוני</option><option value="דחוף">דחוף 🔥</option>
                </select>
              </div>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full bg-white/80 border border-[#1D4ED8]/15 rounded-2xl px-4 py-3.5 text-xs font-medium outline-none focus:border-[#1D4ED8] transition min-h-[80px] shadow-xs text-slate-800 resize-none" placeholder="פירוט נוסף..." />

              <button type="submit" disabled={isSubmitting} className="w-full h-12 bg-[#1D4ED8] text-white font-bold rounded-2xl shadow-md mt-2 active:scale-95 transition disabled:opacity-50 text-sm">
                {isSubmitting ? 'מעדכן...' : 'שליחת דיווח'}
              </button>
            </form>
          </div>
        </div>
      )}

      {fullScreenImage && (
        <div className="fixed inset-0 z-[150] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in cursor-pointer" onClick={() => setFullScreenImage(null)}>
          <button className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center text-white bg-white/10 hover:bg-white/20 rounded-full transition z-10 border border-white/20">✕</button>
          <img src={fullScreenImage} alt="Fullscreen" className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}

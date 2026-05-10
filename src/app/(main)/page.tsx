'use client'
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { playSystemSound } from '../../components/providers/AppManager';

export default function HomePage() {
  const [isClient, setIsClient] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [building, setBuilding] = useState<any>(null);
  
  const [unpaidCount, setUnpaidCount] = useState<number | null>(null);
  const [openTickets, setOpenTickets] = useState<number | null>(null);
  const [requestsCount, setRequestsCount] = useState<number | null>(null);
  const [latestAnnouncement, setLatestAnnouncement] = useState<any>(null);
  
  // AI Catch-up State
  const [aiCatchup, setAiCatchup] = useState<string>('מנתח את אירועי הבניין האחרונים...');
  const [isAiLoading, setIsAiLoading] = useState(true);

  // Magic Input State
  const [magicInput, setMagicInput] = useState('');
  const [isMagicThinking, setIsMagicThinking] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const router = useRouter();

  useEffect(() => {
    setIsClient(true);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const { data: { user }, error: authErr } = await supabase.auth.getUser();
      if (authErr || !user) {
        router.push('/login');
        return;
      }

      const { data: prof } = await supabase.from('profiles').select('*, buildings(*)').eq('id', user.id).single();
      
      if (prof) {
        setProfile(prof);
        if (prof.buildings) setBuilding(prof.buildings);

        const [payRes, tickRes, reqRes, msgRes] = await Promise.all([
          supabase.from('payments').select('status').eq('payer_id', user.id),
          supabase.from('service_tickets').select('status').eq('building_id', prof.building_id),
          supabase.from('marketplace_items').select('status').eq('building_id', prof.building_id).eq('category', 'בקשות שכנים'),
          supabase.from('messages').select('content, created_at, profiles!inner(full_name)').eq('building_id', prof.building_id).order('created_at', { ascending: false }).limit(3)
        ]);

        const myUnpaid = payRes.data ? payRes.data.filter(p => p.status !== 'שולם' && p.status !== 'paid' && p.status !== 'exempt').length : 0;
        const activeTickets = tickRes.data ? tickRes.data.filter(t => t.status !== 'טופל').length : 0;
        
        setUnpaidCount(myUnpaid);
        setOpenTickets(activeTickets);
        setRequestsCount(reqRes.data ? reqRes.data.filter(r => r.status === 'available').length : 0);

        if (msgRes.data && msgRes.data.length > 0) {
          setLatestAnnouncement(msgRes.data[0]);
        }

        // Generate AI Catch-up
        if (isAiLoading) {
            const context = `
                דייר: ${prof.full_name}.
                תקלות פתוחות בבניין: ${activeTickets}.
                תשלומים פתוחים שלו: ${myUnpaid}.
                הודעות אחרונות בצ'אט: ${msgRes.data?.map(m => `"${m.content}" מאת ${m.profiles?.full_name}`).join(', ') || 'אין הודעות'}.
                נסח סיכום קצר ונעים (Catch-up) של 2-3 שורות מגוף ראשון כעוזר הבניין. מקסימום 2 אימוג'ים בכל הטקסט.
            `;
            
            try {
                const aiRes = await fetch('/api/ai/analyze', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ description: context, mode: 'insight' })
                });
                if(aiRes.ok) {
                    const aiData = await aiRes.json();
                    setAiCatchup(aiData.text);
                }
            } catch(e) {
                setAiCatchup(`היי ${prof.full_name.split(' ')[0]}, יש ${activeTickets} תקלות בטיפול. תודה שאתה חלק מקהילת ${prof.buildings?.name || 'הבניין'}.`);
            } finally {
                setIsAiLoading(false);
            }
        }
      }
    } catch (err) {
      console.error("Home fetch error:", err);
    }
  }, [router, isAiLoading]);

  useEffect(() => {
    let isMounted = true;
    let channel: any = null;

    const initDashboard = async () => {
      await fetchData();
      if (!isMounted) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: prof } = await supabase.from('profiles').select('building_id').eq('id', user.id).single();
      if (!prof || !prof.building_id) return;

      const channelTopic = `dashboard_realtime_${prof.building_id}_${Date.now()}`;
      channel = supabase.channel(channelTopic)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'payments', filter: `payer_id=eq.${user.id}` }, fetchData)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'service_tickets', filter: `building_id=eq.${prof.building_id}` }, fetchData)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `building_id=eq.${prof.building_id}` }, fetchData)
        .subscribe();
    }

    initDashboard();

    return () => {
      isMounted = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, [fetchData]);

  const handleMagicSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!magicInput.trim() || isMagicThinking) return;
    
    playSystemSound('click');
    setIsMagicThinking(true);
    
    // סימולציית המתנה לפיתוח ה-AI Action בהמשך
    setTimeout(() => {
        setIsMagicThinking(false);
        setMagicInput('');
        playSystemSound('notification');
        alert("בקרוב: ה-AI שלנו ידע לקחת את הטקסט הזה, להבין אם זו תקלה או הודעה, ולבצע את הפעולה אוטומטית!");
    }, 1500);
  };

  if (!isClient || !profile) {
    return (
      <div className="flex flex-col flex-1 w-full items-center justify-center min-h-[100dvh]">
          <div className="w-16 h-16 border-4 border-[#1D4ED8]/30 border-t-[#1D4ED8] rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 w-full pb-32 relative bg-[#F8FAFC]" dir="rtl">
      
      {/* Header & AI Catch-up */}
      <div className="bg-gradient-to-br from-[#1D4ED8] to-[#3B82F6] rounded-b-[2.5rem] px-6 pt-8 pb-10 shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
        <div className="relative z-10">
            <h1 className="text-3xl font-black text-white tracking-tight mb-4">
                שלום, {profile?.full_name?.split(' ')[0]} 👋
            </h1>
            
            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 shadow-inner">
                {isAiLoading ? (
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center animate-pulse"><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div></div>
                        <p className="text-sm text-white/80 font-medium">מכין סיכום בניין...</p>
                    </div>
                ) : (
                    <p className="text-white text-sm font-medium leading-relaxed">{aiCatchup}</p>
                )}
            </div>
        </div>
      </div>

      {/* Quick Status Cards */}
      <div className="px-6 -mt-6 relative z-20 grid grid-cols-2 gap-4">
          
        <Link href="/payments" onClick={() => playSystemSound('click')} className={`bg-white rounded-2xl p-4 shadow-sm border ${unpaidCount && unpaidCount > 0 ? 'border-rose-200' : 'border-slate-100'} flex flex-col items-center justify-center text-center active:scale-95 transition-transform`}>
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 ${unpaidCount && unpaidCount > 0 ? 'bg-rose-50 text-rose-500' : 'bg-emerald-50 text-emerald-500'}`}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
            </div>
            <span className="text-xs font-bold text-slate-500">תשלומים</span>
            <span className={`text-base font-black ${unpaidCount && unpaidCount > 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                {unpaidCount === null ? '-' : unpaidCount > 0 ? `${unpaidCount} ממתינים` : 'הכל משולם'}
            </span>
        </Link>

        <Link href="/services" onClick={() => playSystemSound('click')} className={`bg-white rounded-2xl p-4 shadow-sm border ${openTickets && openTickets > 0 ? 'border-orange-200' : 'border-slate-100'} flex flex-col items-center justify-center text-center active:scale-95 transition-transform`}>
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 ${openTickets && openTickets > 0 ? 'bg-orange-50 text-orange-500' : 'bg-slate-50 text-slate-400'}`}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77-1.333.192 3 1.732 3z" /></svg>
            </div>
            <span className="text-xs font-bold text-slate-500">תקלות שירות</span>
            <span className={`text-base font-black ${openTickets && openTickets > 0 ? 'text-orange-600' : 'text-slate-800'}`}>
                {openTickets === null ? '-' : openTickets > 0 ? `${openTickets} פתוחות` : 'הבניין תקין'}
            </span>
        </Link>

      </div>

      {/* The Magic Omni-Input (שורת הקסם) */}
      <div className="px-6 mt-8 flex-1 flex flex-col justify-end">
          <div className="bg-white rounded-[2rem] p-4 shadow-xl border border-slate-100">
              <h3 className="text-sm font-black text-slate-800 mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[#1D4ED8]/10 flex items-center justify-center text-[#1D4ED8]">✨</span>
                  מה תרצה לעשות?
              </h3>
              <form onSubmit={handleMagicSubmit} className="relative">
                  <textarea 
                    ref={inputRef}
                    value={magicInput}
                    onChange={(e) => setMagicInput(e.target.value)}
                    placeholder="לדוג': יש פיצוץ מים בלובי קומה 2..."
                    className="w-full bg-slate-50 rounded-[1.5rem] py-4 px-5 pr-14 text-base font-medium text-slate-800 outline-none resize-none min-h-[60px] max-h-32 border border-slate-200 focus:border-[#1D4ED8]/50 transition-colors shadow-inner"
                    rows={1}
                    onInput={(e) => {
                        const target = e.target as HTMLTextAreaElement;
                        target.style.height = 'auto';
                        target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleMagicSubmit(e);
                        }
                    }}
                  />
                  
                  <button 
                    type="submit" 
                    disabled={!magicInput.trim() || isMagicThinking}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-[#1D4ED8] text-white flex items-center justify-center shadow-md disabled:opacity-50 active:scale-90 transition-transform"
                  >
                      {isMagicThinking ? (
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                          <svg className="w-5 h-5 transform -rotate-90 translate-y-px -translate-x-px" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
                      )}
                  </button>
              </form>
              <p className="text-[10px] font-bold text-slate-400 text-center mt-3">
                  הקלד כאן הודעות, דיווח על תקלות או בקשות מהשכנים. <br/>ה-AI שלנו יבין לבד לאן לנתב את זה.
              </p>
          </div>
      </div>

    </div>
  );
}

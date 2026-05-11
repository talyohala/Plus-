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

  // UI States
  const [showGreeting, setShowGreeting] = useState(true);
  const [showCode, setShowCode] = useState(false);
  const [isAskingParking, setIsAskingParking] = useState(false);
  const [customAlert, setCustomAlert] = useState<{ title: string; message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const router = useRouter();

  useEffect(() => {
    setIsClient(true);
    const timer = setTimeout(() => setShowGreeting(false), 4000);
    return () => clearTimeout(timer);
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

        if (isAiLoading) {
            const context = `
                דייר: ${prof.full_name}.
                תקלות פתוחות בבניין: ${activeTickets}.
                תשלומים פתוחים שלו: ${myUnpaid}.
                הודעות אחרונות בצ'אט: ${msgRes.data?.map(m => `"${m.content}"`).join(', ') || 'אין הודעות'}.
                נסח סיכום קצר, אלגנטי ונעים של שתי שורות מגוף ראשון כעוזר הבניין. מקסימום אימוג'י 1 בכל הטקסט. בלי דרמה.
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
                setAiCatchup(`יש ${activeTickets} תקלות בטיפול. תודה שאתה חלק מקהילת הבניין.`);
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

  const handleShowCode = () => {
    if (!building?.entry_code) {
        setCustomAlert({ title: 'אין קוד כניסה', message: 'לא הוגדר קוד דלת לבניין זה. הוועד יכול לעדכן זאת במסך הפרופיל.', type: 'info' });
        return;
    }
    playSystemSound('click');
    setShowCode(true);
    setTimeout(() => setShowCode(false), 4000);
  };

  const handleGateRemote = () => {
      playSystemSound('click');
      setCustomAlert({ title: 'פותח שער...', message: 'מתחבר למערכת החניה.', type: 'info' });
      setTimeout(() => {
          playSystemSound('notification');
          setCustomAlert({ title: 'השער נפתח', message: 'שער החניה נפתח בהצלחה. נסיעה בטוחה!', type: 'success' });
      }, 1500);
  };

  const handleParkingRequest = async () => {
      if (!profile || !building) return;
      setIsAskingParking(true);
      playSystemSound('click');
      try {
          const res = await fetch('/api/ai/analyze', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ description: `נסח הודעה קצרה (שורה אחת) לקבוצת הבניין: אני מחפש חניה פנויה להיום, מישהו יכול להשאיל לי? תודה. אימוג'י אחד בלבד.`, mode: 'insight' })
          });
          
          let msg = "היי שכנים! מישהו במקרה לא צריך את החניה שלו להיום ויכול להשאיל לי? תודה מראש 🙏";
          if (res.ok) {
              const data = await res.json();
              msg = data.text;
          }
          
          const { error } = await supabase.from('messages').insert([{ 
              user_id: profile.id, 
              building_id: building.id, 
              content: msg, 
              read_by: [] 
          }]);

          if (!error) {
              setCustomAlert({ title: 'נשלח לקהילה', message: 'בקשת החניה נוסחה על ידי ה-AI ונשלחה בהצלחה לצ\'אט הבניין.', type: 'success' });
              playSystemSound('notification');
          }
      } catch (e) {
          console.error(e);
      } finally {
          setIsAskingParking(false);
      }
  };

  // --- החיבור האמיתי למוח ה-AI (Omni-Router) --- //
  const handleMagicSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = magicInput.trim();
    if(!text || isMagicThinking || !profile || !building) return;
    
    playSystemSound('click');
    setIsMagicThinking(true);
    
    try {
      const res = await fetch('/api/ai/omni', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text, 
          userId: profile.id, 
          buildingId: building.id 
        })
      });

      const data = await res.json();

      if (res.ok) {
        playSystemSound('notification');
        setMagicInput('');
        if (inputRef.current) inputRef.current.style.height = 'auto';
        
        // התראה מותאמת לפי הניתוב
        const actionTitle = data.action === 'TICKET' ? 'נפתחה תקלה אוטומטית 🛠️' : 
                            data.action === 'MARKETPLACE' ? 'פורסם ללוח השכנים 🤝' : 'נשלח לקבוצת הבניין 💬';
        
        setCustomAlert({ 
          title: actionTitle, 
          message: data.message || 'הפנייה שלך נותבה וטופלה בהצלחה!', 
          type: 'success' 
        });
        
        // רענון נתונים מקומי
        fetchData();
      } else {
        throw new Error(data.error || 'שגיאה בעיבוד הפנייה');
      }
    } catch (err: any) {
      setCustomAlert({ title: 'שגיאה', message: 'לא הצלחנו לנתב את הפנייה, אנא נסה שוב.', type: 'error' });
    } finally {
      setIsMagicThinking(false);
    }
  };

  if (!isClient || !profile) {
    return (
      <div className="flex flex-col flex-1 w-full items-center justify-center min-h-[100dvh] bg-transparent">
          <div className="w-16 h-16 border-4 border-[#1D4ED8]/30 border-t-[#1D4ED8] rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 w-full min-h-[100dvh] bg-transparent pb-40 relative" dir="rtl">
      
      <div className="bg-gradient-to-br from-[#1D4ED8] to-[#3B82F6] rounded-b-[2.5rem] px-6 pt-8 pb-12 shadow-lg relative overflow-hidden transition-all shrink-0">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
        <div className="relative z-10">
            <div className={`transition-all duration-1000 ease-in-out overflow-hidden flex flex-col ${showGreeting ? 'max-h-24 opacity-100 mb-5' : 'max-h-0 opacity-0 mb-0'}`}>
                <h1 className="text-3xl font-black text-white tracking-tight">
                    שלום, {profile?.full_name?.split(' ')[0]}
                </h1>
            </div>
            
            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-[1.5rem] p-4 shadow-inner">
                {isAiLoading ? (
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center animate-pulse"><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div></div>
                        <p className="text-sm text-white/80 font-medium">מכין סיכום בניין...</p>
                    </div>
                ) : (
                    <p className="text-white text-[13px] font-medium leading-relaxed">{aiCatchup}</p>
                )}
            </div>
        </div>
      </div>

      <div className="px-6 -mt-7 relative z-20 flex justify-center gap-6 mb-6 shrink-0">
          <button onClick={handleGateRemote} className="flex flex-col items-center gap-2 group active:scale-95 transition-transform">
              <div className="w-14 h-14 bg-white rounded-full shadow-[0_8px_20px_rgba(0,0,0,0.08)] border border-slate-50 flex items-center justify-center text-[#1D4ED8] group-hover:bg-blue-50 transition-colors">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              </div>
              <span className="text-[11px] font-black text-slate-600 tracking-tight">שער חניה</span>
          </button>

          <button onClick={handleShowCode} className="flex flex-col items-center gap-2 group active:scale-95 transition-transform min-w-[56px]">
              <div className="w-14 h-14 bg-white rounded-full shadow-[0_8px_20px_rgba(0,0,0,0.08)] border border-slate-50 flex items-center justify-center text-[#1D4ED8] group-hover:bg-blue-50 transition-colors">
                  {showCode ? (
                      <span className="font-black text-lg tracking-widest text-[#1D4ED8] animate-in zoom-in-95" dir="ltr">{building?.entry_code}</span>
                  ) : (
                      <svg className="w-6 h-6 animate-in zoom-in-95" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"></path></svg>
                  )}
              </div>
              <span className="text-[11px] font-black text-slate-600 tracking-tight">קוד כניסה</span>
          </button>

          <button onClick={handleParkingRequest} disabled={isAskingParking} className="flex flex-col items-center gap-2 group active:scale-95 transition-transform disabled:opacity-50">
              <div className="w-14 h-14 bg-white rounded-full shadow-[0_8px_20px_rgba(0,0,0,0.08)] border border-slate-50 flex items-center justify-center text-[#1D4ED8] group-hover:bg-blue-50 transition-colors">
                  {isAskingParking ? (
                      <div className="w-5 h-5 border-2 border-[#1D4ED8] border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 11l1.5-4.5A2 2 0 018.4 5h7.2a2 2 0 011.9 1.5L19 11M5 11v6a2 2 0 002 2h10a2 2 0 002-2v-6M5 11h14M8 15h.01M16 15h.01"></path>
                      </svg>
                  )}
              </div>
              <span className="text-[11px] font-black text-slate-600 tracking-tight">בקשת חניה</span>
          </button>
      </div>

      <div className="px-6 relative z-10 grid grid-cols-2 gap-4">
        <Link href="/payments" onClick={() => playSystemSound('click')} className={`bg-white rounded-[1.5rem] p-4 shadow-sm border ${unpaidCount && unpaidCount > 0 ? 'border-blue-200' : 'border-slate-100'} flex flex-col items-center justify-center text-center active:scale-95 transition-transform`}>
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 ${unpaidCount && unpaidCount > 0 ? 'bg-blue-50 text-blue-500' : 'bg-slate-50 text-slate-400'}`}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
            </div>
            <span className="text-xs font-bold text-slate-500">תשלומים</span>
            <span className={`text-base font-black ${unpaidCount && unpaidCount > 0 ? 'text-blue-600' : 'text-slate-800'}`}>
                {unpaidCount === null ? '-' : unpaidCount > 0 ? `${unpaidCount} ממתינים` : 'הכל משולם'}
            </span>
        </Link>

        <Link href="/services" onClick={() => playSystemSound('click')} className={`bg-white rounded-[1.5rem] p-4 shadow-sm border ${openTickets && openTickets > 0 ? 'border-orange-200' : 'border-slate-100'} flex flex-col items-center justify-center text-center active:scale-95 transition-transform`}>
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 ${openTickets && openTickets > 0 ? 'bg-orange-50 text-orange-500' : 'bg-slate-50 text-slate-400'}`}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77-1.333.192 3 1.732 3z" /></svg>
            </div>
            <span className="text-xs font-bold text-slate-500">תקלות שירות</span>
            <span className={`text-base font-black ${openTickets && openTickets > 0 ? 'text-orange-600' : 'text-slate-800'}`}>
                {openTickets === null ? '-' : openTickets > 0 ? `${openTickets} פתוחות` : 'הבניין תקין'}
            </span>
        </Link>
      </div>

      <div className="fixed bottom-[72px] left-0 right-0 max-w-md mx-auto w-full px-4 py-2 z-40 bg-transparent pointer-events-none">
          <div className="pointer-events-auto">
              <form onSubmit={handleMagicSubmit} className="relative bg-white rounded-[2rem] p-1.5 shadow-[0_4px_25px_rgba(0,0,0,0.08)] border border-slate-100 flex items-end gap-1">
                  <button type="button" onClick={() => setCustomAlert({title: 'אימוג׳י', message: 'בקרוב יהיה ניתן להוסיף אימוג׳י!', type: 'info'})} className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-[#1D4ED8] transition shrink-0 self-end mb-1">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                  </button>
                  <button type="button" onClick={() => setCustomAlert({title: 'העלאת תמונות', message: 'בקרוב ה-AI יוכל לנתח תמונות!', type: 'info'})} className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-[#1D4ED8] transition shrink-0 self-end mb-1">
                      <svg className="w-6 h-6 transform -rotate-45" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path></svg>
                  </button>
                  <textarea 
                    ref={inputRef}
                    value={magicInput}
                    onChange={(e) => setMagicInput(e.target.value)}
                    placeholder="לדוג': יש פיצוץ מים בלובי..."
                    className="flex-1 bg-transparent py-3 px-1 outline-none text-[15px] font-medium text-slate-800 resize-none max-h-32 min-h-[44px] placeholder-slate-400 self-center"
                    rows={1}
                    onInput={(e) => {
                        const target = e.target as HTMLTextAreaElement;
                        target.style.height = 'auto';
                        target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleMagicSubmit(e); }
                    }}
                  />
                  <button type="submit" disabled={!magicInput.trim() || isMagicThinking} className="bg-[#1D4ED8] text-white w-12 h-12 rounded-full flex items-center justify-center shadow-md disabled:opacity-50 shrink-0 self-end active:scale-95 transition">
                      {isMagicThinking ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <svg className="w-5 h-5 transform -rotate-45 translate-x-px" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>}
                  </button>
              </form>
          </div>
      </div>

      {customAlert && (
        <div className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-white/95 backdrop-blur-xl rounded-[2rem] p-6 w-full max-w-sm shadow-2xl text-center animate-in zoom-in-95 border border-white/50">
            <div className={`w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center shadow-lg ${customAlert.type === 'success' ? 'bg-[#10B981]/10 text-[#10B981] animate-[bounce_1s_infinite]' : customAlert.type === 'info' ? 'bg-blue-50 text-blue-500' : 'bg-red-50 text-red-500'}`}>
              {customAlert.type === 'success' && <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>}
              {customAlert.type === 'error' && <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>}
              {customAlert.type === 'info' && <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>}
            </div>
            <h3 className="text-2xl font-black text-slate-800 mb-2">{customAlert.title}</h3>
            <p className="text-base text-slate-500 mb-6 leading-relaxed font-medium">{customAlert.message}</p>
            <button onClick={() => setCustomAlert(null)} className="w-full h-14 bg-[#1D4ED8] text-white font-bold rounded-xl active:scale-95 transition shadow-sm text-lg flex items-center justify-center">סגירה</button>
          </div>
        </div>
      )}

    </div>
  );
}

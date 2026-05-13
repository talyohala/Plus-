'use client'
import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../lib/supabase';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { playSystemSound } from '../../components/providers/AppManager';
import MarketplaceItemCard, { MarketplaceItem } from '../../components/marketplace/MarketplaceItemCard';

export default function HomePage() {
  const [isClient, setIsClient] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [building, setBuilding] = useState<any>(null);
  
  const [unpaidCount, setUnpaidCount] = useState<number | null>(null);
  const [openTickets, setOpenTickets] = useState<number | null>(null);
  const [upcomingEventsCount, setUpcomingEventsCount] = useState<number | null>(null);
  
  const [marketItems, setMarketItems] = useState<MarketplaceItem[]>([]);
  const [savedItemsIds, setSavedItemsIds] = useState<Set<string>>(new Set());
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [editItemData, setEditItemData] = useState({ title: '', description: '', price: '', contact_phone: '', category: 'למכירה' });
  const [fullScreenMedia, setFullScreenMedia] = useState<{ url: string; type: string } | null>(null);

  const [aiCatchup, setAiCatchup] = useState<string>('מנתח נתונים...');
  const [aiRequest, setAiRequest] = useState<any>(null); // State for Smart AI Requests
  const lastDataHashRef = useRef<string>('');

  const [magicInput, setMagicInput] = useState('');
  const [isMagicThinking, setIsMagicThinking] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const [showGreeting, setShowGreeting] = useState(true);
  const [showCode, setShowCode] = useState(false);
  const [isAskingParking, setIsAskingParking] = useState(false);
  const [customAlert, setCustomAlert] = useState<{ title: string; message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [successModal, setSuccessModal] = useState(false);
  const [mounted, setMounted] = useState(false);

  const router = useRouter();
  const isAdmin = profile?.role === 'admin';
  const mainCategories = ['הכל', 'חבילות ודואר', 'השאלות כלים', 'למסירה', 'למכירה'];

  useEffect(() => {
    setIsClient(true);
    setMounted(true);
    const timer = setTimeout(() => setShowGreeting(false), 4000);
    return () => clearTimeout(timer);
  }, []);

  const fetchAiRequest = useCallback(async (userId: string) => {
    const { data } = await supabase.from('ai_smart_requests')
      .select('*')
      .eq('user_id', userId)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1).single();
    setAiRequest(data || null);
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
        fetchAiRequest(user.id);

        const { data: saves } = await supabase.from('marketplace_saves').select('item_id').eq('user_id', prof.id);
        const savesSet = new Set<string>();
        if (saves) {
          saves.forEach(s => savesSet.add(s.item_id));
          setSavedItemsIds(savesSet);
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const [payRes, tickRes, msgRes, rawMarketRes, eventsRes] = await Promise.all([
          supabase.from('payments').select('status').eq('payer_id', user.id),
          supabase.from('service_tickets').select('status').eq('building_id', prof.building_id),
          supabase.from('messages').select('content').eq('building_id', prof.building_id).order('created_at', { ascending: false }).limit(1),
          supabase.from('marketplace_items')
            .select('*, profiles(full_name, avatar_url, apartment, floor, role)')
            .eq('building_id', prof.building_id)
            .eq('status', 'available')
            .order('created_at', { ascending: false })
            .limit(30),
          supabase.from('events')
            .select('id')
            .eq('building_id', prof.building_id)
            .gte('event_date', today.toISOString())
        ]);

        const myUnpaid = payRes.data ? payRes.data.filter(p => p.status !== 'paid' && p.status !== 'exempt').length : 0;
        const activeTickets = tickRes.data ? tickRes.data.filter(t => t.status !== 'טופל').length : 0;
        const activeEvents = eventsRes.data ? eventsRes.data.length : 0;

        setUnpaidCount(myUnpaid);
        setOpenTickets(activeTickets);
        setUpcomingEventsCount(activeEvents);

        const rawItems = rawMarketRes.data || [];
        const preferredCategories = new Set<string>();
        savesSet.forEach(savedId => {
          const found = rawItems.find(it => it.id === savedId);
          if (found) preferredCategories.add(found.category);
        });

        const timePeriodSeed = Math.floor(Date.now() / (1000 * 3600 * 4));

        const scoredItems = rawItems.map(item => {
          let score = 0;
          if (item.is_pinned) score += 10000;
          if (preferredCategories.has(item.category)) score += 500;
          const hoursElapsed = (Date.now() - new Date(item.created_at).getTime()) / (1000 * 3600);
          score += Math.max(0, 200 - hoursElapsed * 3);
          let hash = timePeriodSeed;
          for (let i = 0; i < item.id.length; i++) {
            hash = ((hash << 5) - hash) + item.id.charCodeAt(i);
            hash |= 0;
          }
          score += Math.abs(hash) % 40;
          return { item, score };
        });

        scoredItems.sort((a, b) => b.score - a.score);
        const personalizedTop5 = scoredItems.slice(0, 5).map(s => s.item);
        setMarketItems(personalizedTop5);

        const currentHash = `${activeTickets}-${myUnpaid}-${personalizedTop5.length}-${msgRes.data?.[0]?.content || ''}`;
        if (lastDataHashRef.current !== currentHash) {
          lastDataHashRef.current = currentHash;
          const context = `בניין: ${prof.full_name}. ${activeTickets} תקלות, ${myUnpaid} תשלומים, ${personalizedTop5.length} בלוח. צ'אט: "${msgRes.data?.[0]?.content || 'אין'}". כתוב משפט סיכום אחד בלבד, קצר וקולע. אימוג'י 1.`;
          try {
            const aiRes = await fetch('/api/ai/analyze', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ description: context, mode: 'insight' })
            });
            if (aiRes.ok) {
              const aiData = await aiRes.json();
              setAiCatchup(aiData.text);
            }
          } catch (e) {
            setAiCatchup(`הכל תקין בבניין. יום נפלא! ✨`);
          }
        }
      }
    } catch (err) {
      console.error("Home fetch error:", err);
    }
  }, [router, fetchAiRequest]);

  useEffect(() => {
    let isMounted = true;
    let channel: any = null;

    const initDashboard = async () => {
      await fetchData();
      if (!isMounted) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: prof = null } = await supabase.from('profiles').select('building_id').eq('id', user.id).single();
      if (!prof || !prof.building_id) return;

      const channelTopic = `dashboard_realtime_${prof.building_id}_${Date.now()}`;
      channel = supabase.channel(channelTopic)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'payments', filter: `payer_id=eq.${user.id}` }, fetchData)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'service_tickets', filter: `building_id=eq.${prof.building_id}` }, fetchData)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'marketplace_items', filter: `building_id=eq.${prof.building_id}` }, fetchData)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'events', filter: `building_id=eq.${prof.building_id}` }, fetchData)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'ai_smart_requests', filter: `user_id=eq.${user.id}` }, () => fetchAiRequest(user.id))
        .subscribe();
    }

    initDashboard();

    return () => {
      isMounted = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, [fetchData, fetchAiRequest]);

  const handleShowCode = () => {
    if (!building?.entry_code) {
      setCustomAlert({ title: 'אין קוד כניסה', message: 'לא הוגדר קוד דלת לבניין זה.', type: 'info' });
      return;
    }
    playSystemSound('click');
    setShowCode(true);
    setTimeout(() => setShowCode(false), 4000);
  };

  const handleGateRemote = () => {
    playSystemSound('click');
    setCustomAlert({ title: 'פותח שער...', message: 'מתחבר לשער החניה.', type: 'info' });
    setTimeout(() => {
      playSystemSound('notification');
      setCustomAlert({ title: 'השער נפתח', message: 'נסיעה בטוחה!', type: 'success' });
    }, 1500);
  };

  const handleParkingRequest = async () => {
    if (!profile || !building) return;
    setIsAskingParking(true);
    playSystemSound('click');
    try {
      const { data: req, error } = await supabase.from('ai_smart_requests').insert({
        building_id: building.id,
        user_id: profile.id,
        type: 'parking',
        status: 'searching'
      }).select().single();

      if (error) {
        console.error("Insert Error:", error);
        throw new Error(error.message);
      }

      // ההודעה מקבלת תגית מיוחדת שהצ'אט ידע לקרוא
      const msg = `🚗 היי שכנים, אני מחפש/ת חניה ל-24 השעות הקרובות.\nלמישהו יש משהו פנוי להציע?\n\n[AI_REQ:${req.id}]`;
      const { error: msgErr } = await supabase.from('messages').insert([{ user_id: profile.id, building_id: building.id, content: msg, read_by: [] }]);
      
      if (msgErr) {
        console.error("Message Error:", msgErr);
        throw new Error("לא הצלחנו לשלוח את ההודעה לקבוצה");
      }
      
      // עדכון אופטימיסטי מהיר של ה-UI
      setAiRequest({ ...req, status: 'searching' });
      setCustomAlert({ title: 'בקשת חניה הופעלה', message: 'השכנים קיבלו הודעה חכמה בצ\'אט. הבקשה תפוג בעוד 24 שעות.', type: 'success' });
      playSystemSound('notification');
    } catch (err: any) {
      console.error("Full Parking Req Error:", err);
      setCustomAlert({ title: 'שגיאה', message: err.message || 'אירעה שגיאה בבקשת החניה', type: 'error' });
    } finally {
      setIsAskingParking(false);
    }
  };

  const handleMagicSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = magicInput.trim();
    if (!text || isMagicThinking || !profile || !building) return;
    playSystemSound('click');
    setIsMagicThinking(true);
    try {
      const res = await fetch('/api/ai/omni', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, userId: profile.id, buildingId: building.id })
      });
      const data = await res.json();
      if (res.ok) {
        playSystemSound('notification');
        setMagicInput('');
        if (inputRef.current) inputRef.current.style.height = 'auto';
        const actionTitle = data.action === 'TICKET' ? 'תקלה נפתחה 🛠️' : 
                            data.action === 'MARKETPLACE' ? 'פורסם בלוח 🤝' : 'נשלח לצ\'אט 💬';
        setCustomAlert({ title: actionTitle, message: 'טופל בהצלחה.', type: 'success' });
        fetchData();
      } else {
        throw new Error(data.error || 'שגיאת עיבוד');
      }
    } catch (err: any) {
      setCustomAlert({ title: 'שגיאה', message: 'לא הצלחנו לנתב את הפנייה.', type: 'error' });
    } finally {
      setIsMagicThinking(false);
    }
  };

  const toggleSave = async (e: React.MouseEvent, id: string, isCurrentlySaved: boolean) => {
    e.stopPropagation();
    setOpenMenuId(null);
    if (!profile) return;
    playSystemSound('click');
    if (isCurrentlySaved) {
      await supabase.from('marketplace_saves').delete().match({ item_id: id, user_id: profile.id });
      setSavedItemsIds(prev => { const next = new Set(prev); next.delete(id); return next; });
    } else {
      await supabase.from('marketplace_saves').insert([{ item_id: id, user_id: profile.id }]);
      setSavedItemsIds(prev => { const next = new Set(prev); next.add(id); return next; });
    }
  };

  const togglePin = async (id: string, currentStatus: boolean) => {
    await supabase.from('marketplace_items').update({ is_pinned: !currentStatus }).eq('id', id);
    setOpenMenuId(null);
    playSystemSound('click');
    fetchData();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('marketplace_items').delete().eq('id', id);
    setOpenMenuId(null);
    playSystemSound('click');
    fetchData();
  };

  const handleInlineEditSubmit = async (e: React.FormEvent, id: string) => {
    e.preventDefault();
    const parsedPrice = editItemData.category === 'למסירה' || editItemData.category === 'חבילות ודואר' || editItemData.category === 'השאלות כלים' ? 0 : parseFloat(editItemData.price) || 0;
    await supabase.from('marketplace_items').update({
      title: editItemData.title, description: editItemData.description, price: parsedPrice, contact_phone: editItemData.contact_phone, category: editItemData.category,
    }).eq('id', id);
    playSystemSound('notification');
    setEditingItemId(null);
    fetchData();
  };

  const formatWhatsApp = (phone: string) => {
    let clean = phone.replace(/\D/g, '');
    if (clean.startsWith('0')) clean = '972' + clean.slice(1);
    return `https://wa.me/${clean}`;
  };

  const timeFormat = (dateStr: string) => {
    const date = new Date(dateStr);
    const diffDays = Math.floor((Date.now() - date.getTime()) / (1000 * 3600 * 24));
    if (diffDays === 0) return date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
    if (diffDays === 1) return 'אתמול';
    return date.toLocaleDateString('he-IL');
  };

  const successPortal = mounted && successModal ? createPortal(
    <div className="fixed inset-0 z-[99999] bg-black/40 backdrop-blur-sm flex justify-center items-center p-4" onClick={() => setSuccessModal(false)} dir="rtl">
      <div className="bg-white rounded-[2rem] p-6 w-full max-w-sm shadow-2xl text-center border border-white/50 animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
        <div className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center bg-[#059669]/10 text-[#059669] shadow-sm animate-[bounce_1s_infinite]">
          <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
        </div>
        <h3 className="text-2xl font-black text-slate-800 mb-2">תגובה נשלחה!</h3>
        <p className="text-base text-slate-500 mb-6 leading-relaxed font-medium">עודכן במודעה והשכן קיבל התראה.</p>
        <button onClick={() => setSuccessModal(false)} className="w-full h-14 bg-[#1E293B] hover:bg-slate-800 text-white font-bold rounded-xl active:scale-95 transition shadow-md text-lg">סגירה</button>
      </div>
    </div>,
    document.body
  ) : null;

  const alertPortal = mounted && customAlert ? createPortal(
    <div className="fixed inset-0 z-[99999] bg-black/40 backdrop-blur-sm flex justify-center items-center p-4" onClick={() => setCustomAlert(null)} dir="rtl">
      <div className="bg-white rounded-[2rem] p-6 w-full max-w-sm shadow-2xl text-center border border-white/50 animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
        <div className={`w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center shadow-sm ${customAlert.type === 'success' ? 'bg-emerald-50 text-emerald-600 animate-[bounce_1s_infinite]' : customAlert.type === 'info' ? 'bg-blue-50 text-[#1D4ED8]' : 'bg-red-50 text-red-500'}`}>
          {customAlert.type === 'success' && <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
          {customAlert.type === 'info' && <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          {customAlert.type === 'error' && <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>}
        </div>
        <h3 className="text-2xl font-black text-slate-800 mb-2">{customAlert.title}</h3>
        <p className="text-base text-slate-500 mb-6 leading-relaxed font-medium">{customAlert.message}</p>
        <button onClick={() => setCustomAlert(null)} className="w-full h-14 bg-[#1D4ED8] text-white font-bold rounded-xl active:scale-95 transition shadow-sm text-lg">סגירה</button>
      </div>
    </div>,
    document.body
  ) : null;

  const mediaPortal = mounted && fullScreenMedia ? createPortal(
    <div className="fixed inset-0 z-[99999] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in cursor-pointer" onClick={() => setFullScreenMedia(null)}>
      <button className="absolute top-6 right-6 w-12 h-12 flex items-center justify-center text-white bg-white/10 hover:bg-white/20 rounded-full transition z-10 border border-white/20">✕</button>
      {fullScreenMedia.type === 'video' ? (
        <video src={fullScreenMedia.url} controls autoPlay className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()} />
      ) : (
        <img src={fullScreenMedia.url} alt="Fullscreen" className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()} />
      )}
    </div>,
    document.body
  ) : null;

  if (!isClient || !profile) {
    return (
      <div className="flex flex-col flex-1 w-full items-center justify-center min-h-[100dvh] bg-transparent">
        <div className="w-16 h-16 border-4 border-[#1D4ED8]/30 border-t-[#1D4ED8] rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 w-full min-h-[100dvh] bg-transparent pb-40 relative" dir="rtl">
      {successPortal}
      {alertPortal}
      {mediaPortal}

      <div className="bg-gradient-to-br from-[#1D4ED8] to-[#3B82F6] rounded-b-[2.5rem] px-6 pt-8 pb-14 shadow-lg relative overflow-hidden shrink-0">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
        <div className="relative z-10">
          <div className={`transition-all duration-1000 ease-in-out overflow-hidden flex flex-col ${showGreeting ? 'max-h-24 opacity-100 mb-5' : 'max-h-0 opacity-0 mb-0'}`}>
            <h1 className="text-3xl font-black text-white tracking-tight">שלום, {profile?.full_name?.split(' ')[0]}</h1>
          </div>
          <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-[1.5rem] p-4 shadow-inner">
            <p className="text-white text-[13px] font-medium leading-relaxed">{aiCatchup}</p>
          </div>
        </div>
      </div>

      <div className="px-6 -mt-8 relative z-20 flex justify-center gap-6 mb-6 shrink-0">
        <button onClick={handleGateRemote} className="flex flex-col items-center gap-2 group active:scale-95 transition-transform">
          <div className="w-16 h-16 bg-white rounded-full shadow-[0_8px_20px_rgba(29,78,216,0.1)] border border-blue-50 flex items-center justify-center text-[#1D4ED8] group-hover:bg-blue-50 transition-colors">
            <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="7" y="4" width="10" height="16" rx="5" /><circle cx="12" cy="10" r="2" fill="currentColor" /><path d="M12 16v2" /><path d="M5 6a8 8 0 0 0 0 6" /><path d="M19 6a8 8 0 0 1 0 6" /></svg>
          </div>
          <span className="text-[11px] font-black text-slate-600 tracking-tight">שער חניה</span>
        </button>

        <button onClick={handleShowCode} className="flex flex-col items-center gap-2 group active:scale-95 transition-transform min-w-[64px]">
          <div className="w-16 h-16 bg-white rounded-full shadow-[0_8px_20px_rgba(29,78,216,0.1)] border border-blue-50 flex items-center justify-center text-[#1D4ED8] group-hover:bg-blue-50 transition-colors">
            {showCode ? (
              <span className="font-black text-xs tracking-widest text-[#1D4ED8] animate-in zoom-in-95" dir="ltr">{building?.entry_code}</span>
            ) : (
              <svg className="w-7 h-7 animate-in zoom-in-95" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"></path></svg>
            )}
          </div>
          <span className="text-[11px] font-black text-slate-600 tracking-tight">קוד כניסה</span>
        </button>

        <button onClick={handleParkingRequest} disabled={isAskingParking || (aiRequest && aiRequest.status === 'searching')} className="flex flex-col items-center gap-2 group active:scale-95 transition-transform disabled:opacity-50">
          <div className="w-16 h-16 bg-white rounded-full shadow-[0_8px_20px_rgba(29,78,216,0.1)] border border-blue-50 flex items-center justify-center text-[#1D4ED8] group-hover:bg-blue-50 transition-colors">
            {isAskingParking ? (
              <div className="w-6 h-6 border-2 border-[#1D4ED8] border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 0 0 3-3V8a3 3 0 0 0-3-3H6a3 3 0 0 0-3 3v8a3 3 0 0 0 3 3z" /><path d="M4 10l1.5-4h13l1.5 4" /></svg>
            )}
          </div>
          <span className="text-[11px] font-black text-slate-600 tracking-tight">בקשת חניה</span>
        </button>
      </div>

      {/* --- Smart AI Bubble לסטטוס בקשת החניה --- */}
      {aiRequest && (
        <div className="px-6 mb-6">
          <div className={`p-4 rounded-[1.5rem] border backdrop-blur-xl shadow-sm flex items-center gap-4 transition-all duration-500 animate-in fade-in slide-in-from-top-4 ${
            aiRequest.status === 'matched' ? 'bg-emerald-50 border-emerald-200' : 'bg-white/80 border-[#1D4ED8]/15'
          }`}>
            <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 shadow-inner ${aiRequest.status === 'matched' ? 'bg-emerald-100 text-emerald-600' : 'bg-[#1D4ED8]/10 text-[#1D4ED8]'}`}>
              {aiRequest.status === 'matched' ? <span className="text-xl">🎉</span> : <div className="w-5 h-5 border-2 border-[#1D4ED8] border-t-transparent rounded-full animate-spin"></div>}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <h4 className="font-black text-sm text-slate-800 leading-none">העוזר האישי (AI)</h4>
                {aiRequest.status === 'searching' && <span className="bg-[#1D4ED8]/10 text-[#1D4ED8] text-[9px] font-black px-1.5 py-0.5 rounded-md">פעיל</span>}
              </div>
              <p className={`text-xs font-bold leading-snug ${aiRequest.status === 'matched' ? 'text-emerald-700' : 'text-slate-500'}`}>
                {aiRequest.status === 'matched' ? `${aiRequest.matched_name || 'שכן'} הציע/ה לך חניה! בדוק בהתראות/צ'אט.` : 'הפעלתי חיפוש חניה לשכנים בבניין. (הבקשה תפוג מעצמה מחר)'}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="px-6 relative z-10 grid grid-cols-2 gap-4 mb-8">
        <Link href="/payments" onClick={() => playSystemSound('click')} className="bg-white rounded-[1.5rem] p-4 shadow-[0_4px_15px_rgba(29,78,216,0.05)] border border-[#1D4ED8]/20 flex flex-col items-center justify-center text-center active:scale-95 transition-transform">
          <div className="w-12 h-12 rounded-full flex items-center justify-center mb-2 bg-blue-50 text-[#1D4ED8]"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg></div>
          <span className="text-xs font-bold text-slate-500">תשלומים</span>
          <span className={`text-base font-black ${unpaidCount && unpaidCount > 0 ? 'text-[#1D4ED8]' : 'text-slate-800'}`}>{unpaidCount === null ? '-' : unpaidCount > 0 ? `${unpaidCount} ממתינים` : 'הכל משולם'}</span>
        </Link>
        <Link href="/services" onClick={() => playSystemSound('click')} className="bg-white rounded-[1.5rem] p-4 shadow-[0_4px_15px_rgba(29,78,216,0.05)] border border-[#1D4ED8]/20 flex flex-col items-center justify-center text-center active:scale-95 transition-transform">
          <div className="w-12 h-12 rounded-full flex items-center justify-center mb-2 bg-orange-50 text-orange-500"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77-1.333.192 3 1.732 3z" /></svg></div>
          <span className="text-xs font-bold text-slate-500">תקלות שירות</span>
          <span className={`text-base font-black ${openTickets && openTickets > 0 ? 'text-[#1D4ED8]' : 'text-slate-800'}`}>{openTickets === null ? '-' : openTickets > 0 ? `${openTickets} פתוחות` : 'הבניין תקין'}</span>
        </Link>
        <Link href="/events" onClick={() => playSystemSound('click')} className="bg-white rounded-[1.5rem] p-4 shadow-[0_4px_15px_rgba(29,78,216,0.05)] border border-[#1D4ED8]/20 flex flex-col items-center justify-center text-center active:scale-95 transition-transform">
          <div className="w-12 h-12 rounded-full flex items-center justify-center mb-2 bg-rose-50 text-rose-500"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg></div>
          <span className="text-xs font-bold text-slate-500">לוח אירועים</span>
          <span className={`text-base font-black ${upcomingEventsCount && upcomingEventsCount > 0 ? 'text-[#1D4ED8]' : 'text-slate-800'}`}>{upcomingEventsCount === null ? '-' : upcomingEventsCount > 0 ? `${upcomingEventsCount} קרובים` : 'אין אירועים'}</span>
        </Link>
        <Link href="/chat" onClick={() => playSystemSound('click')} className="bg-white rounded-[1.5rem] p-4 shadow-[0_4px_15px_rgba(29,78,216,0.05)] border border-[#1D4ED8]/20 flex flex-col items-center justify-center text-center active:scale-95 transition-transform">
          <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center mb-2"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z"></path></svg></div>
          <span className="text-xs font-bold text-slate-500">קבוצת הבניין</span>
          <span className="text-base font-black text-slate-800">צ'אט שכנים</span>
        </Link>
      </div>

      <div className="px-6 mb-8 relative z-10">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-black text-slate-800">הלוח הקהילתי</h3>
          <Link href="/marketplace" className="text-xs font-bold text-[#1D4ED8] hover:underline">לכל העדכונים ({marketItems.length})</Link>
        </div>

        {marketItems.length === 0 ? (
          <div className="bg-white/80 p-6 rounded-3xl border border-[#1D4ED8]/10 text-center shadow-sm">
            <p className="text-xs font-bold text-slate-400">אין עדכונים בלוח כרגע ✨</p>
          </div>
        ) : (
          <div className="space-y-3">
            {marketItems.map(item => (
              <MarketplaceItemCard
                key={item.id}
                item={item}
                currentUserId={profile?.id}
                isAdmin={isAdmin}
                isSaved={savedItemsIds.has(item.id)}
                openMenuId={openMenuId}
                editingItemId={editingItemId}
                editItemData={editItemData}
                mainCategories={mainCategories}
                isSubmitting={false}
                onToggleMenu={setOpenMenuId}
                onToggleSave={toggleSave}
                onTogglePin={togglePin}
                onStartEdit={it => {
                  setEditingItemId(it.id);
                  setEditItemData({ title: it.title, description: it.description || '', price: it.price === 0 ? '' : it.price.toString(), contact_phone: it.contact_phone, category: it.category });
                  setOpenMenuId(null);
                }}
                onCancelEdit={() => setEditingItemId(null)}
                onUpdateEditData={setEditItemData}
                onSubmitEdit={handleInlineEditSubmit}
                onDelete={handleDelete}
                onMediaClick={(url, type) => setFullScreenMedia({ url, type })}
                onCommentSuccess={() => setSuccessModal(true)}
                formatWhatsApp={formatWhatsApp}
                timeFormat={timeFormat}
              />
            ))}
          </div>
        )}
      </div>

      <div className="fixed bottom-[84px] left-0 right-0 max-w-md mx-auto w-full px-4 py-2 z-40 bg-transparent pointer-events-none">
        <div className="pointer-events-auto">
          <form onSubmit={handleMagicSubmit} className="relative bg-white rounded-[2rem] p-2 shadow-[0_8px_30px_rgba(29,78,216,0.15)] border border-[#1D4ED8]/20 flex items-end gap-2 transition-all">
            <button type="button" onClick={() => setCustomAlert({title: 'ניתוח מתקדם', message: 'בקרוב ה-AI ינתח גם תמונות!', type: 'info'})} className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-[#1D4ED8] bg-slate-50 rounded-full transition shrink-0 self-end mb-0.5"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path></svg></button>
            <textarea ref={inputRef} value={magicInput} onChange={(e) => setMagicInput(e.target.value)} placeholder="מה קורה בבניין?" className="flex-1 bg-transparent py-2.5 px-1 outline-none text-xs font-bold text-slate-800 resize-none max-h-32 min-h-[44px] placeholder-slate-400 self-center tracking-tight" rows={1} onInput={(e) => { const target = e.target as HTMLTextAreaElement; target.style.height = 'auto'; target.style.height = `${Math.min(target.scrollHeight, 120)}px`; }} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleMagicSubmit(e); } }} />
            <button type="submit" disabled={!magicInput.trim() || isMagicThinking} className="bg-[#1D4ED8] text-white w-12 h-12 rounded-full flex items-center justify-center shadow-md disabled:opacity-50 shrink-0 self-end mb-0.5 active:scale-95 transition">{isMagicThinking ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <svg className="w-5 h-5 transform -rotate-45 translate-x-px" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>}</button>
          </form>
        </div>
      </div>
    </div>
  );
}

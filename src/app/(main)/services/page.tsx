'use client'
import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import { playSystemSound } from '../../../components/providers/AppManager';
import TicketCard, { Ticket, Vendor } from '../../../components/services/TicketCard';
import VendorBook from '../../../components/services/VendorBook';
import ReportForm from '../../../components/services/ReportForm';

interface Profile {
  id: string;
  full_name: string;
  building_id: string;
  role: string;
  avatar_url?: string;
}

const PAGE_SIZE = 30;

export default function ServicesPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [activeFilter, setActiveFilter] = useState('הכל');
  const [pageOffset, setPageOffset] = useState(0);
  const [hasMoreTickets, setHasMoreTickets] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // States לניהול תצוגות ומודלים
  const [isReporting, setIsReporting] = useState(false);
  const [showVendors, setShowVendors] = useState(false);
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  // States לעריכת תקלות
  const [activeTicketMenu, setActiveTicketMenu] = useState<Ticket | null>(null);
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);
  const [editDescription, setEditDescription] = useState('');
  const [toastId, setToastId] = useState<string | null>(null);
  const [customAlert, setCustomAlert] = useState<{ title: string; message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // States לבינה מלאכותית
  const [aiInsight, setAiInsight] = useState<string>('');
  const [isAiLoading, setIsAiLoading] = useState(true);
  const [showAiBubble, setShowAiBubble] = useState(false);

  const menuOpenTime = useRef<number>(0);
  const lastAnalyzedRef = useRef<string>('');
  const isAdmin = profile?.role === 'admin';

  const aiAvatarUrl = useMemo(() => {
    const fallbackRobot = "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Smilies/Robot.png";
    return profile?.avatar_url || fallbackRobot;
  }, [profile?.avatar_url]);

  // הארכת זמן ה-Toast לגיל הזהב (4 שניות)
  const showToast = (id: string) => {
    setToastId(id);
    setTimeout(() => setToastId(null), 4000);
  };

  const fetchInitialData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    if (!prof || !prof.building_id) return;
    setProfile(prof);

    const { data: vnds } = await supabase.from('building_vendors')
      .select('*, profiles!building_vendors_recommender_id_fkey(full_name)')
      .eq('building_id', prof.building_id)
      .order('created_at', { ascending: false });
    if (vnds) setVendors(vnds);

    const { data: tks } = await supabase.from('service_tickets')
      .select('*, profiles(full_name, apartment, avatar_url)')
      .eq('building_id', prof.building_id)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .range(0, PAGE_SIZE - 1);

    if (tks) {
      setTickets(tks);
      setPageOffset(PAGE_SIZE);
      setHasMoreTickets(tks.length === PAGE_SIZE);
    }
  }, []);

  const loadMoreTickets = async () => {
    if (!profile || isLoadingMore || !hasMoreTickets) return;
    setIsLoadingMore(true);

    const { data: tks } = await supabase.from('service_tickets')
      .select('*, profiles(full_name, apartment, avatar_url)')
      .eq('building_id', profile.building_id)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .range(pageOffset, pageOffset + PAGE_SIZE - 1);

    if (tks && tks.length > 0) {
      setTickets(prev => [...prev, ...tks]);
      setPageOffset(prev => prev + PAGE_SIZE);
      setHasMoreTickets(tks.length === PAGE_SIZE);
    } else {
      setHasMoreTickets(false);
    }
    setIsLoadingMore(false);
  };

  const refreshTickets = async () => {
    if (!profile) return;
    const { data: tks } = await supabase.from('service_tickets')
      .select('*, profiles(full_name, apartment, avatar_url)')
      .eq('building_id', profile.building_id)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(pageOffset || PAGE_SIZE);

    if (tks) setTickets(tks);
  };

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // האזנה יציבה ל-Realtime של התקלות פר בניין
  useEffect(() => {
    if (!profile?.building_id) return;
    const channelTopic = `tickets_notifs_${profile.id}`;
    const channel = supabase.channel(channelTopic)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_tickets', filter: `building_id=eq.${profile.building_id}` }, () => {
        refreshTickets();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile?.building_id, profile?.id]);

  const openVendorsModal = () => {
    playSystemSound('click');
    setShowVendors(true);
    if (typeof window !== 'undefined') {
      window.history.pushState({ modal: 'vendors' }, '');
    }
  };

  const closeVendorsModal = () => {
    setShowVendors(false);
    if (typeof window !== 'undefined' && window.history.state?.modal === 'vendors') {
      window.history.back();
    }
  };

  useEffect(() => {
    const handlePopState = () => { if (showVendors) setShowVendors(false); };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [showVendors]);

  const formatWhatsApp = useCallback((phone: string, text = '') => {
    const cleanPhone = phone.replace(/\D/g, '');
    const baseUrl = cleanPhone.startsWith('0') ? `https://wa.me/972${cleanPhone.substring(1)}` : `https://wa.me/${cleanPhone}`;
    return text ? `${baseUrl}?text=${encodeURIComponent(text)}` : baseUrl;
  }, []);

  const timeFormat = useCallback((dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' })} • ${date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`;
  }, []);

  const addVendor = async (vData: any) => {
    if (!profile) return;
    await supabase.from('building_vendors').insert([{ building_id: profile.building_id, recommender_id: profile.id, ...vData }]);
    playSystemSound('notification');
    fetchInitialData();
  };

  const updateVendor = async (id: string, updates: any) => {
    await supabase.from('building_vendors').update(updates).eq('id', id);
    playSystemSound('notification');
    fetchInitialData();
  };

  const deleteVendor = async (id: string) => {
    await supabase.from('building_vendors').delete().eq('id', id);
    playSystemSound('click');
    fetchInitialData();
  };

  const updateTicketStatus = async (id: string, newStatus: string, userId: string, ticketTitle: string) => {
    if (!profile) return;
    const updates: { status: string; is_pinned?: boolean } = { status: newStatus };
    if (newStatus === 'טופל') updates.is_pinned = false;

    const { error } = await supabase.from('service_tickets').update(updates).eq('id', id);
    if (!error && userId !== profile.id) {
      const msgTitle = newStatus === 'בטיפול' ? 'התקלה שלך בטיפול! 🛠️' : 'התקלה שלך טופלה! ✅';
      const msgContent = newStatus === 'בטיפול' ? `הוועד החל לטפל בפנייה: ${ticketTitle}` : `הוועד סגר את הפנייה: ${ticketTitle}`;
      await supabase.from('notifications').insert([{ receiver_id: userId, sender_id: profile.id, type: 'system', title: msgTitle, content: msgContent, link: '/services' }]);
    }
    playSystemSound('click');
    refreshTickets();
  };

  const togglePin = async (id: string, currentPin: boolean) => {
    await supabase.from('service_tickets').update({ is_pinned: !currentPin }).eq('id', id);
    playSystemSound('click');
    refreshTickets();
  };

  const deleteTicket = async (id: string) => {
    await supabase.from('service_tickets').delete().eq('id', id);
    playSystemSound('click');
    refreshTickets();
  };

  const saveTicketEdit = async () => {
    if (!editingTicket || !editDescription.trim()) return;
    await supabase.from('service_tickets').update({ description: editDescription }).eq('id', editingTicket.id);
    playSystemSound('notification');
    setEditingTicket(null);
    refreshTickets();
  };

  const findMatchingVendor = useCallback((tags: string[] = [], fixedArr: Vendor[], recommendedArr: Vendor[]) => {
    if (!tags.length) return null;
    const dictionary: Record<string, string[]> = {
      'חשמלאי': ['חשמל', 'תאורה', 'מנורה', 'קצר', 'פקק', 'שקע', 'תקע', 'לוח', 'לד', 'חוטים'],
      'אינסטלטור': ['מים', 'אינסטלציה', 'פיצוץ', 'נזילה', 'ביוב', 'צינור', 'סתימה', 'ניאגרה', 'ברז', 'דוד'],
      'מנקה': ['ניקיון', 'אשפה', 'פח', 'שטיפה', 'לכלוך', 'ספונג\'ה', 'לובי', 'זבל', 'ריח'],
      'טכנאי מעליות': ['מעלית', 'תקועה', 'כפתור', 'דלת לא נסגרת'],
      'גנן': ['גינון', 'גינה', 'עצים', 'דשא', 'השקיה', 'ממטרות', 'צמחיה', 'גיזום'],
      'מנעולן': ['מנעול', 'דלת', 'מפתח', 'קודן', 'פריצה', 'צילינדר', 'ציר'],
      'מדביר': ['הדברה', 'ג\'וקים', 'מקקים', 'נמלים', 'חולדות', 'עכברים', 'יתושים', 'ריסוס'],
      'אינטרקום': ['אינטרקום', 'מצלמה', 'זמזם', 'לא שומעים', 'צ\'יפ'],
      'שיפוצניק': ['שיפוץ', 'צבע', 'טיח', 'קיר', 'סדק', 'קרמיקה', 'הנדימן', 'שבור'],
      'מסגר': ['מעקה', 'סורג', 'שער', 'ברזל', 'ריתוך']
    };

    const expandedTags = new Set<string>();
    tags.forEach(tag => {
      const t = tag.toLowerCase();
      expandedTags.add(t);
      for (const [category, words] of Object.entries(dictionary)) {
        if (category.includes(t) || t.includes(category) || words.some(w => t.includes(w) || w.includes(t))) {
          expandedTags.add(category);
          words.forEach(w => expandedTags.add(w));
        }
      }
    });

    const searchInArray = (vends: Vendor[]) => vends.find(v => {
      const prof = v.profession.toLowerCase();
      return Array.from(expandedTags).some(tag => prof.includes(tag) || tag.includes(prof));
    });

    const fixedMatch = searchInArray(fixedArr);
    if (fixedMatch) return { vendor: fixedMatch, type: 'fixed' as const };

    const recMatch = searchInArray(recommendedArr);
    if (recMatch) return { vendor: recMatch, type: 'recommended' as const };

    return null;
  }, []);

  // מנוע AI חכם לתקלות - עדכון זמן קריאה ל-20 שניות לגיל הזהב
  useEffect(() => {
    if (!profile || !profile.building_id || tickets.length === 0) return;
    const currentHash = `${profile.id}-${tickets.length}`;
    if (lastAnalyzedRef.current === currentHash) return;
    lastAnalyzedRef.current = currentHash;

    const fetchAiData = async () => {
      setIsAiLoading(true);
      try {
        const openFaults = tickets.filter(f => f.status === 'פתוח' || f.status === 'בטיפול');
        const closedFaults = tickets.filter(f => f.status === 'טופל');
        let context = '';
        const now = Date.now();
        if (profile.role === 'admin') {
          const openDetails = openFaults.map(f => {
            const days = Math.floor((now - new Date(f.created_at).getTime()) / (1000 * 60 * 60 * 24));
            return `"${f.title}" (${f.status}, פתוח ${days} ימים, תגיות: ${f.ai_tags?.join(',') || 'אין'})`;
          }).slice(0, 6).join(' | ');
          context = `מנהל אחזקה מומחה: ${profile.full_name}. סטטוס בניין: ${openFaults.length} תקלות פתוחות/בטיפול, ו-${closedFaults.length} נסגרו. פירוט: ${openDetails || 'אין'}. נסח ניתוח עומק מקצועי וממוקד מגוף ראשון כרובוט מומחה לאחזקת מבנים. בדיוק 3 שורות ענייניות ומכובדות. אימוג'י רלוונטי בכל שורה.`;
        } else {
          const myFaults = openFaults.filter(f => f.user_id === profile.id);
          const myDetails = myFaults.map(f => `"${f.title}" (${f.status})`).join(', ');
          context = `דייר: ${profile.full_name}. בבניין ${openFaults.length} תקלות פעילות. דיווח על: ${myDetails || 'אין'}. נסח עדכון חכם ומסביר פנים מגוף ראשון כרובוט שירות. בדיוק 3 שורות קצרות. אימוג'י נעים בכל שורה.`;
        }
        const res = await fetch('/api/ai/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ description: context, mode: 'insight' }),
        });
        const data = await res.json();
        setAiInsight(data.text);
      } catch (err) {
        setAiInsight(`שלום ${profile.full_name}, המערכת מסונכרנת 🛠️\nצוות הניהול עוקב אחר הדיווחים 📋\nהמשך יום נעים! ✨`);
      } finally {
        setIsAiLoading(false);
        setShowAiBubble(true);
        setTimeout(() => setShowAiBubble(false), 20000); // 20 שניות שהיה
      }
    };
    fetchAiData();
  }, [profile, tickets]);

  const fixedVendors = useMemo(() => vendors.filter(v => v.is_fixed), [vendors]);
  const recommendedVendors = useMemo(() => vendors.filter(v => !v.is_fixed), [vendors]);
  const filteredTickets = useMemo(() => activeFilter === 'הכל' ? tickets : tickets.filter(t => t.status === activeFilter), [tickets, activeFilter]);

  const currentYear = new Date().getFullYear();
  const pinnedTickets = useMemo(() => filteredTickets.filter(t => t.is_pinned), [filteredTickets]);
  const unpinnedTickets = useMemo(() => filteredTickets.filter(t => !t.is_pinned), [filteredTickets]);

  const currentYearTickets = useMemo(() => unpinnedTickets.filter(t => new Date(t.created_at).getFullYear() === currentYear), [unpinnedTickets, currentYear]);
  const archivedTickets = useMemo(() => unpinnedTickets.filter(t => new Date(t.created_at).getFullYear() < currentYear), [unpinnedTickets, currentYear]);

  const groupedByMonth = useMemo(() => currentYearTickets.reduce<Record<string, Ticket[]>>((acc, ticket) => {
    const month = new Date(ticket.created_at).toLocaleDateString('he-IL', { month: 'long' });
    if (!acc[month]) acc[month] = [];
    acc[month].push(ticket);
    return acc;
  }, {}), [currentYearTickets]);

  const groupedByYear = useMemo(() => archivedTickets.reduce<Record<string, Ticket[]>>((acc, ticket) => {
    const year = new Date(ticket.created_at).getFullYear().toString();
    if (!acc[year]) acc[year] = [];
    acc[year].push(ticket);
    return acc;
  }, {}), [archivedTickets]);

  const toggleGroup = (groupKey: string) => {
    setExpandedTabs(prev => ({ ...prev, [groupKey]: !prev[groupKey] }));
  };

  const renderGroup = (title: string, list: Ticket[], groupKey: string) => {
    if (!list.length) return null;
    const isExpanded = expandedGroups[groupKey];
    const visibleList = isExpanded ? list : list.slice(0, 5);
    const hasMore = list.length > 5;

    return (
      <div key={groupKey} className="space-y-4 mb-6">
        <div className="flex items-center gap-3 py-1">
          <h3 className="text-xs font-black text-gray-400">{title}</h3>
          <div className="flex-1 h-px bg-gray-100" />
        </div>
        {visibleList.map(ticket => (
          <TicketCard
            key={ticket.id}
            ticket={ticket}
            isAdmin={isAdmin}
            currentUserId={profile?.id}
            toastId={toastId}
            matchResult={isAdmin && ticket.status !== 'טופל' ? findMatchingVendor(ticket.ai_tags, fixedVendors, recommendedVendors) : null}
            onPressStart={t => { menuOpenTime.current = Date.now(); setActiveTicketMenu(t); }}
            onPressEnd={() => {}}
            onShowToast={showToast}
            onImageClick={setFullScreenImage}
            onUpdateStatus={updateTicketStatus}
            formatWhatsApp={formatWhatsApp}
            timeFormat={timeFormat}
          />
        ))}
        {hasMore && (
          <button onClick={() => toggleGroup(groupKey)} className="w-full flex items-center justify-center gap-1.5 py-3.5 bg-white border border-gray-100 rounded-2xl text-xs font-bold text-gray-500 shadow-sm active:scale-95 transition">
            {isExpanded ? 'הצג פחות' : `הצג עוד ${list.length - 5} תקלות`}
            <svg className={`w-4 h-4 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col flex-1 w-full pb-24 relative" dir="rtl">
      <div className="px-4 mb-4 mt-4"><h2 className="text-2xl font-black text-slate-800">תקלות שירות</h2></div>

      {isReporting && (
        <div className="px-4 mb-6 animate-in slide-in-from-top duration-300">
          <ReportForm
            buildingId={profile?.building_id || ''}
            userId={profile?.id || ''}
            userFullName={profile?.full_name || ''}
            onClose={() => setIsReporting(false)}
            onSuccess={() => { 
              setIsReporting(false); 
              refreshTickets(); 
              setCustomAlert({ title: 'התקלה דווחה!', message: 'הדיווח נשלח בהצלחה לוועד הבית ויטופל בהקדם.', type: 'success' });
              playSystemSound('notification');
            }}
          />
        </div>
      )}

      {/* שורת הטאבים עם כפתור ספקים נקי (אזורי לחיצה מוגדלים) */}
      <div className="px-4 mb-5">
        <div className="flex bg-white/60 backdrop-blur-md p-1.5 rounded-full border border-white shadow-sm relative z-10 items-center overflow-x-auto hide-scrollbar">
          {['הכל', 'פתוח', 'בטיפול', 'טופל'].map(f => (
            <button key={f} onClick={() => setActiveFilter(f)} className={`flex-1 py-3 text-xs rounded-full transition-all flex items-center justify-center gap-1 min-w-[70px] ${activeFilter === f ? 'text-orange-500 font-black bg-orange-500/10 border border-orange-500/20 shadow-sm' : 'text-slate-500 font-bold'}`}>
              {f === 'פתוח' ? 'פתוחות' : f === 'טופל' ? 'טופלו' : f}
              <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black ${activeFilter === f ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-500'}`}>{f === 'הכל' ? tickets.length : tickets.filter(t => t.status === f).length}</span>
            </button>
          ))}
          <div className="w-px h-6 bg-gray-200/80 mx-1 shrink-0" />
          <button onClick={openVendorsModal} className="h-12 px-4 bg-indigo-50/80 text-[#1D4ED8] rounded-full text-xs font-black flex items-center justify-center gap-1.5 hover:bg-indigo-100 transition shadow-sm border border-indigo-100 shrink-0 active:scale-95">
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            <span>ספקים</span>
          </button>
        </div>
      </div>

      <div className="space-y-4 px-4 animate-in fade-in duration-300">
        {filteredTickets.length === 0 ? (
          <div className="text-center py-12 bg-white/50 rounded-3xl border border-gray-100">
            <p className="text-gray-400 font-medium text-sm">אין תקלות בסטטוס זה</p>
          </div>
        ) : (
          <div>
            {pinnedTickets.length > 0 && renderGroup('נעוץ ע"י הוועד', pinnedTickets, 'pinned')}
            {Object.entries(groupedByMonth).map(([month, list]) => renderGroup(month, list, `month_${month}`))}
            {Object.entries(groupedByYear).map(([year, list]) => renderGroup(`ארכיון ${year}`, list, `year_${year}`))}
            
            {hasMoreTickets && (
              <button onClick={loadMoreTickets} disabled={isLoadingMore} className="w-full bg-white/80 border border-orange-200 text-orange-600 font-black py-4 rounded-2xl shadow-sm hover:bg-white active:scale-95 transition mt-4">
                {isLoadingMore ? 'טוען תקלות ישנות...' : 'טען עוד תקלות 🛠️'}
              </button>
            )}
          </div>
        )}
      </div>

      {!isReporting && (
        <button onClick={() => { playSystemSound('click'); setIsReporting(true); }} className="fixed bottom-24 left-6 z-40 bg-white/90 backdrop-blur-md border border-white text-slate-800 pl-4 pr-1.5 py-1.5 rounded-full shadow-[0_10px_40px_rgba(249,115,22,0.25)] hover:scale-105 active:scale-95 transition flex items-center gap-3 group flex-row-reverse">
          <div className="bg-orange-500 text-white p-3 rounded-full shadow-sm w-12 h-12 flex items-center justify-center"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"></path></svg></div>
          <span className="font-black text-sm text-orange-500">דווח תקלה</span>
        </button>
      )}

      {/* AI Floating Character */}
      <div className={`fixed bottom-24 right-6 z-50 flex flex-col items-end pointer-events-none transition-all duration-700 ${isAiLoading || showAiBubble ? 'opacity-100 translate-y-0 visible' : 'opacity-0 translate-y-10 invisible'}`}>
        {showAiBubble && <div className="absolute bottom-[80px] right-0 mb-3 bg-white/95 backdrop-blur-xl text-slate-800 p-4 rounded-[2rem] rounded-br-md shadow-[0_10px_40px_rgba(0,0,0,0.15)] text-[12px] font-bold w-[260px] leading-relaxed border border-orange-200 pointer-events-auto">{aiInsight}</div>}
        <button onClick={() => setShowAiBubble(!showAiBubble)} className="w-20 h-20 bg-transparent pointer-events-auto active:scale-95 transition-transform flex items-center justify-center"><img src={aiAvatarUrl} alt="AI" className="w-16 h-16 drop-shadow-2xl" /></button>
      </div>

      {/* תפריט פעולות לתקלות (Touch Targets 48x48) */}
      {activeTicketMenu && (
        <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-end justify-center" onClick={() => setActiveTicketMenu(null)}>
          <div className="bg-white w-full max-w-md rounded-t-[2rem] p-6 pb-12 shadow-2xl animate-in slide-in-from-bottom-full" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6" />
            <h3 className="text-lg font-black text-slate-800 text-center mb-6 truncate">{activeTicketMenu.title}</h3>
            <div className="flex justify-center gap-8">
              {isAdmin && (
                <button onClick={() => { togglePin(activeTicketMenu.id, activeTicketMenu.is_pinned); setActiveTicketMenu(null); }} className="flex flex-col items-center gap-2 group active:scale-95 transition">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center shadow-sm border ${activeTicketMenu.is_pinned ? 'bg-orange-50 border-orange-200 text-orange-500' : 'bg-gray-50 border-gray-100 text-gray-600'}`}>
                    <svg className="w-7 h-7" fill={activeTicketMenu.is_pinned ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" /></svg>
                  </div>
                  <span className="text-xs font-black text-slate-800">{activeTicketMenu.is_pinned ? 'ביטול נעיצה' : 'נעיצה'}</span>
                </button>
              )}
              {(isAdmin || profile?.id === activeTicketMenu.user_id) && (
                <>
                  <button onClick={() => { setEditDescription(activeTicketMenu.description || ''); setEditingTicket(activeTicketMenu); setActiveTicketMenu(null); }} className="flex flex-col items-center gap-2 group active:scale-95 transition">
                    <div className="w-16 h-16 rounded-full bg-orange-50 border border-orange-100 text-orange-500 flex items-center justify-center shadow-sm"><svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></div>
                    <span className="text-xs font-black text-orange-500">עריכה</span>
                  </button>
                  <button onClick={() => { deleteTicket(activeTicketMenu.id); setActiveTicketMenu(null); }} className="flex flex-col items-center gap-2 group active:scale-95 transition">
                    <div className="w-16 h-16 rounded-full bg-red-50 border border-red-100 text-red-500 flex items-center justify-center shadow-sm"><svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></div>
                    <span className="text-xs font-black text-red-500">מחיקה</span>
                  </button>
                </>
              )}
            </div>
            <button onClick={() => setActiveTicketMenu(null)} className="mt-8 w-full h-14 flex items-center justify-center bg-gray-50 text-gray-500 font-bold rounded-2xl text-sm active:scale-95 transition">ביטול</button>
          </div>
        </div>
      )}

      {editingTicket && (
        <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[1.5rem] p-6 shadow-2xl animate-in zoom-in-95 text-right">
            <h3 className="text-xl font-black text-slate-800 mb-4">עריכת דיווח</h3>
            <textarea autoFocus value={editDescription} onChange={e => setEditDescription(e.target.value)} className="w-full bg-gray-50 rounded-2xl p-4 text-sm outline-none resize-none min-h-[120px] mb-4 text-slate-800 border border-gray-100 focus:border-orange-300 transition" />
            <div className="flex gap-2">
              <button onClick={saveTicketEdit} disabled={!editDescription.trim()} className="flex-1 h-12 flex items-center justify-center bg-orange-500 text-white font-bold rounded-xl text-sm shadow-md active:scale-95 transition disabled:opacity-50">שמור שינויים</button>
              <button onClick={() => setEditingTicket(null)} className="px-6 h-12 flex items-center justify-center bg-gray-100 text-gray-500 font-bold rounded-xl text-sm active:scale-95 transition">ביטול</button>
            </div>
          </div>
        </div>
      )}

      {showVendors && (
        <VendorBook
          vendors={vendors}
          isAdmin={isAdmin}
          currentUserId={profile?.id}
          toastId={toastId}
          onClose={closeVendorsModal}
          onAddVendor={addVendor}
          onUpdateVendor={updateVendor}
          onDeleteVendor={deleteVendor}
          onShowToast={showToast}
          formatWhatsApp={formatWhatsApp}
        />
      )}

      {fullScreenImage && (
        <div className="fixed inset-0 z-[150] bg-black/95 flex items-center justify-center animate-in fade-in zoom-in-95" onClick={() => setFullScreenImage(null)}>
          <button onClick={() => setFullScreenImage(null)} className="absolute top-6 right-6 w-12 h-12 flex items-center justify-center bg-white/10 rounded-full text-white hover:bg-white/20 transition active:scale-95"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg></button>
          <img src={fullScreenImage} className="w-full h-auto max-h-screen object-contain p-4" alt="מוגדלת" />
        </div>
      )}

      {/* --- התראות מערכת להצלחה בדיווח תקלות --- */}
      {customAlert && (
        <div className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-white/95 backdrop-blur-xl rounded-[2rem] p-6 w-full max-w-sm shadow-2xl text-center animate-in zoom-in-95 border border-white/50">
            <div className={`w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center shadow-lg ${customAlert.type === 'success' ? 'bg-[#059669]/10 text-[#059669] animate-[bounce_1s_infinite]' : customAlert.type === 'info' ? 'bg-blue-50 text-blue-500' : 'bg-red-50 text-red-500'}`}>
              {customAlert.type === 'success' && <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>}
              {customAlert.type === 'error' && <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>}
              {customAlert.type === 'info' && <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>}
            </div>
            <h3 className="text-2xl font-black text-slate-800 mb-2">{customAlert.title}</h3>
            <p className="text-base text-slate-500 mb-6 leading-relaxed font-medium">{customAlert.message}</p>
            <button onClick={() => setCustomAlert(null)} className="w-full h-14 bg-slate-800 text-white font-bold rounded-xl active:scale-95 transition shadow-sm text-lg flex items-center justify-center">סגירה</button>
          </div>
        </div>
      )}
    </div>
  );
}

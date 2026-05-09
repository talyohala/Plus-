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

  // States לניהול תצוגות
  const [isReporting, setIsReporting] = useState(false);
  const [showVendors, setShowVendors] = useState(false);
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  // States לעריכת תקלות
  const [activeTicketMenu, setActiveTicketMenu] = useState<Ticket | null>(null);
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);
  const [editDescription, setEditDescription] = useState('');
  const [toastId, setToastId] = useState<string | null>(null);

  // States לבינה מלאכותית
  const [aiInsight, setAiInsight] = useState<string>('');
  const [isAiLoading, setIsAiLoading] = useState(true);
  const [showAiBubble, setShowAiBubble] = useState(false);

  const menuOpenTime = useRef<number>(0);
  const isAdmin = profile?.role === 'admin';

  const aiAvatarUrl = useMemo(() => {
    const fallbackRobot = "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Smilies/Robot.png";
    return profile?.avatar_url || fallbackRobot;
  }, [profile?.avatar_url]);

  const showToast = (id: string) => {
    setToastId(id);
    setTimeout(() => setToastId(null), 2000);
  };

  // משיכה ראשונית של פרופיל, ספקים והמנה הראשונה של התקלות
  const fetchInitialData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    if (!prof || !prof.building_id) return;
    setProfile(prof);

    // משיכת ספקים
    const { data: vnds } = await supabase.from('building_vendors')
      .select('*, profiles!building_vendors_recommender_id_fkey(full_name)')
      .eq('building_id', prof.building_id)
      .order('created_at', { ascending: false });
    if (vnds) setVendors(vnds);

    // משיכת תקלות (מנה ראשונה - פגינציה)
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

  // טעינת מנות נוספות (Infinite Scroll / Load More)
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

  // רענון לאחר עדכון/יצירה
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

  // מנוע תובנות AI
  useEffect(() => {
    const fetchAiData = async () => {
      if (!profile || !profile.building_id || tickets.length === 0 || (!isAiLoading && showAiBubble)) return;
      setIsAiLoading(true);

      try {
        const openFaults = tickets.filter(f => f.status === 'פתוח' || f.status === 'בטיפול');
        const closedFaults = tickets.filter(f => f.status === 'טופל');

        let context = '';
        if (profile.role === 'admin') {
          context = `מנהל הוועד: ${profile.full_name}. יש בבניין ${openFaults.length} תקלות פתוחות ו-${closedFaults.length} טופלו. נסח הודעת עזר מגוף ראשון כרובוט ניהול ואחזקה שעוזר לו. תן עדכון קצר, כתוב בדיוק 3 שורות עם ירידת שורה ביניהן (\n). הוסף אימוג'י בכל שורה.`;
        } else {
          const myFaults = openFaults.filter(f => f.user_id === profile.id);
          context = `דייר: ${profile.full_name}. בבניין יש ${openFaults.length} תקלות בטיפול. הדייר דיווח על ${myFaults.length} מהן. נסח הודעת עזר אישית מגוף ראשון כעוזר התחזוקה החמוד שלו. כתוב בדיוק 3 שורות קצרות עם ירידת שורה ביניהן (\n). הוסף אימוג'י חמוד בכל שורה.`;
        }

        const res = await fetch('/api/ai/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ description: context, mode: 'insight' }),
        });

        if (res.ok) {
          const data = await res.json();
          setAiInsight(data.text);
        } else {
          throw new Error('Fallback AI');
        }
      } catch (err) {
        setAiInsight(`שלום ${profile.full_name}, המערכת מסונכרנת 🛠️\nצוות הניהול עוקב אחר הדיווחים 📋\nהמשך יום נעים! ✨`);
      } finally {
        setIsAiLoading(false);
        setShowAiBubble(true);
        setTimeout(() => setShowAiBubble(false), 10000);
      }
    };

    if (tickets.length > 0 && !showAiBubble && isAiLoading) fetchAiData();
  }, [profile, tickets.length, showAiBubble, isAiLoading]);

  // לוגיקת ספקים ותקלות (CRUD)
  const addVendor = async (vData: { name: string; profession: string; phone: string; isFixed: boolean; rating: number }) => {
    if (!profile) return;
    await supabase.from('building_vendors').insert([{
      building_id: profile.building_id,
      recommender_id: profile.id,
      is_fixed: vData.isFixed,
      rating: vData.rating,
      name: vData.name,
      profession: vData.profession,
      phone: vData.phone,
    }]);
    playSystemSound('notification');
    // רענון ספקים
    const { data: vnds } = await supabase.from('building_vendors')
      .select('*, profiles!building_vendors_recommender_id_fkey(full_name)')
      .eq('building_id', profile.building_id)
      .order('created_at', { ascending: false });
    if (vnds) setVendors(vnds);
  };

  const updateTicketStatus = async (id: string, newStatus: string, userId: string, ticketTitle: string) => {
    if (!profile) return;
    const updates: { status: string; is_pinned?: boolean } = { status: newStatus };
    if (newStatus === 'טופל') updates.is_pinned = false;

    const { error } = await supabase.from('service_tickets').update(updates).eq('id', id);
    if (!error && userId !== profile.id) {
      const msgTitle = newStatus === 'בטיפול' ? 'התקלה שלך בטיפול! 🛠️' : 'התקלה שלך טופלה! ✅';
      const msgContent = newStatus === 'בטיפול' ? `הוועד החל לטפל בפנייה: ${ticketTitle}` : `הוועד סגר את הפנייה: ${ticketTitle}`;
      await supabase.from('notifications').insert([{
        receiver_id: userId,
        sender_id: profile.id,
        type: 'system',
        title: msgTitle,
        content: msgContent,
        link: '/services'
      }]);
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

  // מנוע התאמת ספקים חכם
  const findMatchingVendor = (tags: string[] = [], fixedArr: Vendor[], recommendedArr: Vendor[]) => {
    if (!tags.length) return null;
    const dictionary: Record<string, string[]> = {
      'חשמלאי': ['חשמל', 'תאורה', 'מנורה', 'קצר', 'פקק קפץ', 'שקע', 'תקע', 'לוח חשמל', 'פנדל', 'פלורסנט', 'לד', 'חוטים', 'שעון שבת', 'טיימר', 'גוף תאורה'],
      'אינסטלטור': ['מים', 'אינסטלציה', 'פיצוץ', 'נזילה', 'ביוב', 'צינור', 'סתימה', 'סתום', 'ניאגרה', 'ברז', 'טפטוף', 'חלודה', 'דוד', 'פומפה', 'צנרת', 'דוד שמש', 'מרזב'],
      'מנקה': ['ניקיון', 'אשפה', 'פח', 'שטיפה', 'לכלוך', 'מסריח', 'ספונג\'ה', 'פוליש', 'חדר מדרגות', 'לובי', 'זבל', 'ריח', 'כתם', 'שואב'],
      'טכנאי מעליות': ['מעלית', 'מעליות', 'תקועה', 'כפתור', 'דלת לא נסגרת', 'שבת', 'פיר', 'חילוץ'],
      'גנן': ['גינון', 'גינה', 'עצים', 'דשא', 'עשבים', 'השקיה', 'ממטרות', 'גזום', 'שתילים', 'יבש', 'צמחיה', 'טפטפות', 'גיזום'],
      'מנעולן': ['מנעול', 'דלת', 'מפתח', 'קודן', 'פריצה', 'צילינדר', 'תקוע', 'ציר', 'טריקה', 'מחזיר דלת'],
      'מדביר': ['הדברה', 'ג\'וקים', 'מקקים', 'נמלים', 'חולדות', 'עכברים', 'יתושים', 'ריסוס', 'חרקים', 'פשפשים', 'תיקנים', 'חולדה', 'עכבר'],
      'אינטרקום': ['אינטרקום', 'מצלמה', 'זמזם', 'לא שומעים', 'מסך', 'תקשורת', 'מערכת', 'צ\'יפ'],
      'שיפוצניק': ['שיפוץ', 'צבע', 'טיח', 'קיר', 'סדק', 'שבר', 'חור', 'פאנלים', 'בלטות', 'קרמיקה', 'רובה', 'התקנה', 'תיקון', 'הנדימן', 'שבור'],
      'מסגר': ['מעקה', 'סורג', 'סורגים', 'שער', 'ברזל', 'ריתוך', 'רתך', 'מסגרות', 'חניה'],
      'איטום': ['גג', 'זפת', 'איטום', 'רטיבות', 'יריעות', 'נזילה מהגג', 'טפטוף מהתקרה'],
      'כיבוי אש': ['מטף', 'גלאי עשן', 'ארון כיבוי', 'ספרינקלר', 'ספרינקלרים', 'אש', 'שריפה', 'זרנוק'],
      'משאבות': ['משאבה', 'משאבת מים', 'משאבה טבולה', 'משאבות ביוב', 'הצפה']
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
  };

  const fixedVendors = vendors.filter(v => v.is_fixed);
  const recommendedVendors = vendors.filter(v => !v.is_fixed);
  const filteredTickets = activeFilter === 'הכל' ? tickets : tickets.filter(t => t.status === activeFilter);

  const currentYear = new Date().getFullYear();
  const pinnedTickets = filteredTickets.filter(t => t.is_pinned);
  const unpinnedTickets = filteredTickets.filter(t => !t.is_pinned);

  const currentYearTickets = unpinnedTickets.filter(t => new Date(t.created_at).getFullYear() === currentYear);
  const archivedTickets = unpinnedTickets.filter(t => new Date(t.created_at).getFullYear() < currentYear);

  const groupedByMonth = currentYearTickets.reduce<Record<string, Ticket[]>>((acc, ticket) => {
    const month = new Date(ticket.created_at).toLocaleDateString('he-IL', { month: 'long' });
    if (!acc[month]) acc[month] = [];
    acc[month].push(ticket);
    return acc;
  }, {});

  const groupedByYear = archivedTickets.reduce<Record<string, Ticket[]>>((acc, ticket) => {
    const year = new Date(ticket.created_at).getFullYear().toString();
    if (!acc[year]) acc[year] = [];
    acc[year].push(ticket);
    return acc;
  }, {});

  const formatWhatsApp = (phone: string, text = '') => {
    const cleanPhone = phone.replace(/\D/g, '');
    const baseUrl = cleanPhone.startsWith('0') ? `https://wa.me/972${cleanPhone.substring(1)}` : `https://wa.me/${cleanPhone}`;
    return text ? `${baseUrl}?text=${encodeURIComponent(text)}` : baseUrl;
  };

  const timeFormat = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' })} • ${date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`;
  };

  const toggleGroup = (groupKey: string) => {
    setExpandedGroups(prev => ({ ...prev, [groupKey]: !prev[groupKey] }));
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
          <button onClick={() => toggleGroup(groupKey)} className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-white border border-gray-100 rounded-2xl text-xs font-bold text-gray-500 shadow-sm active:scale-95 transition">
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
      <div className="px-4 mb-4 mt-4">
        <h2 className="text-2xl font-black text-slate-800">תקלות שירות</h2>
      </div>

      <div className="grid grid-cols-3 gap-3 px-4 mb-6">
        {!isReporting ? (
          <button onClick={() => setIsReporting(true)} className="col-span-2 bg-white border border-orange-100 rounded-[1.5rem] p-5 shadow-[0_8px_30px_rgb(249,115,22,0.06)] flex flex-col items-start justify-center active:scale-95 transition relative overflow-hidden group">
            <div className="absolute -left-10 -top-10 w-32 h-32 bg-orange-100 rounded-full blur-3xl opacity-70" />
            <h3 className="font-black text-orange-500 text-lg mb-0.5 relative z-10">דיווח תקלה</h3>
            <p className="text-[11px] font-bold text-gray-500 relative z-10">המערכת תסווג לבד</p>
          </button>
        ) : (
          <div className="col-span-3">
            <ReportForm
              buildingId={profile?.building_id || ''}
              userId={profile?.id || ''}
              userFullName={profile?.full_name || ''}
              onClose={() => setIsReporting(false)}
              onSuccess={refreshTickets}
            />
          </div>
        )}

        {!isReporting && (
          <button onClick={() => setShowVendors(true)} className="col-span-1 bg-white border border-gray-100 rounded-[1.5rem] p-4 shadow-sm flex flex-col items-center justify-center active:scale-95 transition text-center gap-2">
            <div className="w-10 h-10 bg-indigo-50 text-[#1D4ED8] rounded-full flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="text-[11px] font-black text-slate-800">ספקים</span>
          </button>
        )}
      </div>

      <div className="space-y-4 px-4 mb-5 pt-2">
        <div className="flex bg-white/60 backdrop-blur-md p-1.5 rounded-full border border-white shadow-sm relative z-10">
          {['הכל', 'פתוח', 'בטיפול', 'טופל'].map(f => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`flex-1 py-3 text-xs rounded-full transition-all flex items-center justify-center gap-1.5 ${
                activeFilter === f ? 'text-orange-500 font-black bg-orange-500/10 shadow-sm border border-orange-500/20' : 'text-slate-500 font-bold hover:text-orange-500/70'
              }`}
            >
              {f === 'פתוח' ? 'פתוחות' : f === 'טופל' ? 'טופלו' : f}
              <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black ${activeFilter === f ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                {f === 'הכל' ? tickets.length : tickets.filter(t => t.status === f).length}
              </span>
            </button>
          ))}
        </div>

        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          {filteredTickets.length === 0 ? (
            <div className="text-center py-10 bg-white/50 rounded-3xl border border-gray-100">
              <p className="text-gray-400 font-medium text-sm">אין תקלות בסטטוס זה</p>
            </div>
          ) : (
            <div>
              {pinnedTickets.length > 0 && renderGroup('נעוץ ע"י הוועד', pinnedTickets, 'pinned')}
              {Object.entries(groupedByMonth).map(([month, list]) => renderGroup(month, list, `month_${month}`))}
              {Object.entries(groupedByYear).map(([year, list]) => renderGroup(`ארכיון ${year}`, list, `year_${year}`))}
              
              {/* כפתור פגינציה אמיתי (Infinite Scroll Manual Trigger) */}
              {hasMoreTickets && (
                <button
                  onClick={loadMoreTickets}
                  disabled={isLoadingMore}
                  className="w-full bg-white/80 border border-orange-200/50 text-orange-600 font-black py-3 rounded-2xl shadow-sm hover:bg-white active:scale-95 transition mt-4"
                >
                  {isLoadingMore ? 'טוען תקלות ישנות...' : 'טען עוד תקלות 🛠️'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* AI Floating Character */}
      <div className={`fixed bottom-24 right-6 z-50 flex flex-col items-end pointer-events-none transition-all duration-700 ${isAiLoading || showAiBubble ? 'opacity-100 translate-y-0 visible' : 'opacity-0 translate-y-10 invisible'}`}>
        {showAiBubble && !isAiLoading && (
          <div className="absolute bottom-[80px] right-0 mb-3 bg-white/95 backdrop-blur-xl text-slate-800 p-4 rounded-[2rem] rounded-br-md shadow-[0_10px_40px_rgba(0,0,0,0.15)] text-[12px] font-bold w-[260px] leading-relaxed border border-orange-200 animate-in fade-in slide-in-from-bottom-2 duration-500 whitespace-pre-wrap text-right pointer-events-auto">
            {aiInsight}
          </div>
        )}
        <button onClick={() => setShowAiBubble(!showAiBubble)} className={`w-20 h-20 bg-transparent flex items-center justify-center pointer-events-auto active:scale-95 transition-transform duration-300 ${isAiLoading ? 'animate-pulse' : 'animate-[bounce_3s_infinite]'}`}>
          {isAiLoading ? (
            <div className="w-10 h-10 bg-white/50 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg border border-white">
              <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <img src={aiAvatarUrl} alt="AI Avatar" className="w-16 h-16 object-contain drop-shadow-2xl" />
          )}
        </button>
      </div>

      {/* תפריט פעולות ועריכת תקלות */}
      {activeTicketMenu && (
        <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-end" onClick={() => setActiveTicketMenu(null)}>
          <div className="bg-white w-full rounded-t-[1.5rem] pt-3 px-6 pb-12 animate-in slide-in-from-bottom-full shadow-[0_-20px_60px_rgba(0,0,0,0.15)]" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-8" />
            <div className="flex justify-center gap-6">
              {isAdmin && (
                <button onClick={() => { togglePin(activeTicketMenu.id, activeTicketMenu.is_pinned); setActiveTicketMenu(null); }} className="flex flex-col items-center gap-2 group active:scale-95 transition">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center shadow-sm border ${activeTicketMenu.is_pinned ? 'bg-orange-50 border-orange-200 text-orange-500' : 'bg-gray-50 border-gray-100 text-gray-600'}`}>
                    <svg className="w-7 h-7" fill={activeTicketMenu.is_pinned ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                    </svg>
                  </div>
                  <span className="text-xs font-black text-slate-800">{activeTicketMenu.is_pinned ? 'ביטול נעיצה' : 'נעיצה'}</span>
                </button>
              )}
              {(isAdmin || profile?.id === activeTicketMenu.user_id) && (
                <>
                  <button onClick={() => { setEditDescription(activeTicketMenu.description || ''); setEditingTicket(activeTicketMenu); setActiveTicketMenu(null); }} className="flex flex-col items-center gap-2 group active:scale-95 transition">
                    <div className="w-16 h-16 rounded-full bg-orange-50 border border-orange-100 text-orange-500 flex items-center justify-center shadow-sm">
                      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </div>
                    <span className="text-xs font-black text-orange-500">עריכה</span>
                  </button>
                  <button onClick={() => { deleteTicket(activeTicketMenu.id); setActiveTicketMenu(null); }} className="flex flex-col items-center gap-2 group active:scale-95 transition">
                    <div className="w-16 h-16 rounded-full bg-red-50 border border-red-100 text-red-500 flex items-center justify-center shadow-sm">
                      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </div>
                    <span className="text-xs font-black text-red-500">מחיקה</span>
                  </button>
                </>
              )}
            </div>
            <button onClick={() => setActiveTicketMenu(null)} className="mt-8 w-full py-4 bg-gray-50 text-gray-500 font-bold rounded-2xl active:scale-95 transition text-sm">ביטול</button>
          </div>
        </div>
      )}

      {editingTicket && (
        <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[1.5rem] p-6 shadow-2xl animate-in zoom-in-95 text-right">
            <h3 className="text-xl font-black text-slate-800 mb-4">עריכת דיווח</h3>
            <textarea autoFocus value={editDescription} onChange={e => setEditDescription(e.target.value)} className="w-full bg-gray-50 rounded-2xl p-4 text-sm outline-none resize-none min-h-[120px] mb-4 text-slate-800 border border-gray-100 focus:border-orange-300 transition" />
            <div className="flex gap-2">
              <button onClick={saveTicketEdit} disabled={!editDescription.trim()} className="flex-1 bg-orange-500 text-white font-bold py-3.5 rounded-xl text-sm shadow-md active:scale-95 transition disabled:opacity-50">שמור שינויים</button>
              <button onClick={() => setEditingTicket(null)} className="px-6 bg-gray-100 text-gray-500 font-bold rounded-xl text-sm active:scale-95 transition">ביטול</button>
            </div>
          </div>
        </div>
      )}

      {/* הצגת פנקס ספקים מלא */}
      {showVendors && (
        <VendorBook
          vendors={vendors}
          isAdmin={isAdmin}
          currentUserId={profile?.id}
          toastId={toastId}
          onClose={() => setShowVendors(false)}
          onAddVendor={addVendor}
          onVendorPressStart={() => {}}
          onVendorPressEnd={() => {}}
          onShowToast={showToast}
          formatWhatsApp={formatWhatsApp}
        />
      )}

      {fullScreenImage && (
        <div className="fixed inset-0 z-[150] bg-black/95 flex items-center justify-center animate-in fade-in zoom-in-95" onClick={() => setFullScreenImage(null)}>
          <button onClick={() => setFullScreenImage(null)} className="absolute top-6 right-6 p-2 bg-white/10 rounded-full text-white hover:bg-white/20 transition">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <img src={fullScreenImage} className="w-full h-auto max-h-screen object-contain p-4" alt="מוגדלת" />
        </div>
      )}
    </div>
  );
}

'use client'

import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import useSWR from 'swr';
import { supabase } from '../../../lib/supabase';
import { playSystemSound } from '../../../components/providers/AppManager';
import MarketplaceItemCard, { MarketplaceItem } from '../../../components/marketplace/MarketplaceItemCard';
import CreateMarketplaceItemModal from '../../../components/marketplace/CreateMarketplaceItemModal';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MarketplaceUser {
  id: string;
  full_name: string;
  building_id: string;
  role: string;
  phone?: string;
  avatar_url?: string;
  apartment?: string;
}

interface FetcherResult {
  profile: MarketplaceUser;
  items: MarketplaceItem[];
  savesArray: string[];
}

interface AlertState {
  title: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MAIN_CATEGORIES = ['הכל', 'סקרים', 'קהילה', 'למסירה', 'למכירה', 'שמורים'] as const;

const COMMUNITY_CATEGORIES = ['חבילות ודואר', 'השאלות כלים', 'בקשות שכנים'];

const SMART_CATEGORIES = [
  { tag: 'חבילות ודואר',   keywords: ['חבילה', 'דואר', 'מעטפה', 'שליח', 'לובי', 'בסלון', 'אספתי', 'חבילות', 'בארון'] },
  { tag: 'השאלות כלים',   keywords: ['כבלים', 'מקדחה', 'סולם', 'מברגה', 'להשאיל', 'צריך', 'כלים', 'פטיש'] },
  { tag: 'רהיטים',         keywords: ['ארון', 'שולחן', 'מיטה', 'ספה', 'כיסא', 'שידה', 'מזנון'] },
  { tag: 'אלקטרוניקה',    keywords: ['מחשב', 'טלוויזיה', 'מטען', 'אייפון', 'רמקול', 'מסך'] },
] as const;

const FREE_PRICE_CATEGORIES = ['למסירה', 'חבילות ודואר', 'השאלות כלים', 'בקשות שכנים', 'סקרים'];

const AI_BUBBLE_DURATION_MS = 15_000;

// ─── Fetcher ──────────────────────────────────────────────────────────────────

const fetcher = async (): Promise<FetcherResult> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Unauthorized');

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single();
  if (!profile) throw new Error('Profile missing');

  const [itemsRes, savesRes] = await Promise.all([
    supabase
      .from('marketplace_items')
      .select('*, profiles(full_name, avatar_url, apartment, floor, role)')
      .eq('building_id', profile.building_id)
      .eq('status', 'available')
      .order('is_pinned', { ascending: false })
      .order('created_at',  { ascending: false }),
    supabase
      .from('marketplace_saves')
      .select('item_id')
      .eq('user_id', profile.id),
  ]);

  return {
    profile,
    items:      itemsRes.data ?? [],
    savesArray: savesRes.data?.map(s => s.item_id) ?? [],
  };
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

/** יציב: מחשב Set רק כשתוכן המערך משתנה, לא ה-reference */
function useSavedIds(savesArray: string[] | undefined): Set<string> {
  // key יציב שמשתנה רק אם באמת השתנה תוכן ה-saves
  const stableKey = savesArray ? savesArray.slice().sort().join(',') : '';
  return useMemo(() => new Set(savesArray ?? []), [stableKey]); // eslint-disable-line react-hooks/exhaustive-deps
}

function useAiInsight(profile: MarketplaceUser | undefined, items: MarketplaceItem[], dataReady: boolean) {
  const [insight, setInsight]       = useState('');
  const [isLoading, setIsLoading]   = useState(true);
  const [showBubble, setShowBubble] = useState(false);
  const lastHashRef                 = useRef('');
  const bubbleTimerRef              = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!dataReady) return;
    if (!profile || items.length === 0) { setIsLoading(false); return; }

    const hash = `${profile.id}-${items.length}`;
    if (lastHashRef.current === hash) return;
    lastHashRef.current = hash;

    const packs = items.filter(i => i.category === 'חבילות ודואר').length;
    const polls = items.filter(i => i.item_type === 'poll').length;
    const ctx   = `דייר: ${profile.full_name}. סטטוס הלוח: ${packs} חבילות ממתינות, ו-${polls} סקרים באוויר. נסח הודעת עזר קהילתית משמחת מגוף ראשון כדובר הלוח. 2 שורות בדיוק עם ירידת שורה. אימוג'י 1 בכל שורה.`;

    setIsLoading(true);

    (async () => {
      try {
        const res    = await fetch('/api/ai/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ description: ctx, mode: 'insight' }) });
        const aiData = await res.json();
        setInsight(aiData.text || '');
      } catch {
        setInsight(`יש כרגע ${packs} חבילות בלובי 📦\nו-${polls} סקרים להצבעה. שווה להציץ! ✨`);
      } finally {
        setIsLoading(false);
        setShowBubble(true);
        clearTimeout(bubbleTimerRef.current);
        bubbleTimerRef.current = setTimeout(() => setShowBubble(false), AI_BUBBLE_DURATION_MS);
      }
    })();

    return () => clearTimeout(bubbleTimerRef.current);
  }, [profile?.id, items.length, dataReady]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleBubble = useCallback(() => {
    if (isLoading) return;
    setShowBubble(prev => !prev);
  }, [isLoading]);

  return { insight, isLoading, showBubble, toggleBubble };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPhone(phone: string): string {
  const clean = phone.replace(/\D/g, '');
  return `https://wa.me/${clean.startsWith('0') ? '972' + clean.slice(1) : clean}`;
}

function formatTime(dateStr: string): string {
  const date     = new Date(dateStr);
  const diffDays = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (diffDays === 0) return date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return 'אתמול';
  return date.toLocaleDateString('he-IL');
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function AlertModal({ alert, onClose }: { alert: AlertState; onClose: () => void }) {
  const isSuccess = alert.type === 'success';
  return createPortal(
    <div className="fixed inset-0 z-[10000] bg-black/40 backdrop-blur-sm flex justify-center items-center p-4" onClick={onClose} dir="rtl">
      <div className="bg-white/95 backdrop-blur-xl rounded-[2rem] p-6 w-full max-w-sm shadow-2xl text-center animate-in zoom-in-95 border border-white/50" onClick={e => e.stopPropagation()}>
        <div className={`w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center shadow-lg ${isSuccess ? 'bg-[#10B981]/10 text-[#10B981] animate-[bounce_1s_infinite]' : 'bg-red-50 text-red-500'}`}>
          {isSuccess
            ? <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
            : <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>}
        </div>
        <h3 className="text-2xl font-black text-slate-800 mb-2">{alert.title}</h3>
        <p className="text-base text-slate-500 mb-6 leading-relaxed font-medium">{alert.message}</p>
        <button onClick={onClose} className="w-full h-14 flex items-center justify-center bg-[#1E293B] hover:bg-slate-800 text-white font-bold rounded-xl active:scale-95 transition shadow-sm text-lg">סגירה</button>
      </div>
    </div>,
    document.body,
  );
}

function AiBubble({ insight, isLoading, showBubble, avatarUrl, onToggle }: {
  insight: string; isLoading: boolean; showBubble: boolean; avatarUrl: string; onToggle: () => void;
}) {
  return (
    <div className={`fixed bottom-24 right-6 z-50 flex flex-col items-end pointer-events-none transition-all duration-700 ease-in-out ${showBubble ? 'opacity-100 translate-y-0 visible' : 'opacity-0 translate-y-10 invisible'}`}>
      {!isLoading && (
        <div className="absolute bottom-[60px] right-0 mb-2 bg-white/90 backdrop-blur-md border border-[#1D4ED8]/20 rounded-2xl px-4 py-2 shadow-[0_-4px_20px_rgba(0,0,0,0.1)] text-xs font-bold text-slate-700 w-max max-w-[240px] leading-snug text-right pointer-events-auto break-words animate-in fade-in slide-in-from-bottom-2 duration-500">
          {insight}
        </div>
      )}
      <button
        onClick={e => { e.stopPropagation(); onToggle(); }}
        className={`w-12 h-12 bg-transparent flex items-center justify-center pointer-events-auto active:scale-95 transition-transform duration-300 ${isLoading ? 'animate-pulse' : 'animate-[bounce_3s_infinite]'}`}
      >
        {isLoading
          ? <div className="w-12 h-12 bg-[#1D4ED8]/10 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm border border-[#1D4ED8]/30"><div className="w-5 h-5 border-2 border-[#1D4ED8] border-t-transparent rounded-full animate-spin" /></div>
          : <img src={avatarUrl} alt="AI" className="w-12 h-12 object-contain drop-shadow-md rounded-full" />}
      </button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MarketplacePage() {
  const { data, error, mutate } = useSWR<FetcherResult>('marketplace_data', fetcher, {
    revalidateOnFocus:  true,
    dedupingInterval:   2000,
    keepPreviousData:   true,
  });

  const profile  = data?.profile;
  const items    = data?.items ?? [];
  const isAdmin  = profile?.role === 'admin';

  // ─── יציב: לא נוצר reference חדש בכל render ───────────────────────────────
  const savedItemsIds = useSavedIds(data?.savesArray);

  // ─── State ────────────────────────────────────────────────────────────────
  const [activeCategory,      setActiveCategory]      = useState('הכל');
  const [searchQuery,         setSearchQuery]          = useState('');
  const [isModalOpen,         setIsModalOpen]          = useState(false);
  const [isRequestModalOpen,  setIsRequestModalOpen]   = useState(false);
  const [isSubmitting,        setIsSubmitting]         = useState(false);
  const [fullScreenMedia,     setFullScreenMedia]      = useState<{ url: string; type: string } | null>(null);
  const [editingItemId,       setEditingItemId]        = useState<string | null>(null);
  const [openMenuId,          setOpenMenuId]           = useState<string | null>(null);
  const [editItemData,        setEditItemData]         = useState({ title: '', description: '', price: '', contact_phone: '', category: 'למכירה' });
  const [customAlert,         setCustomAlert]          = useState<AlertState | null>(null);
  const [mounted,             setMounted]              = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // ─── AI ───────────────────────────────────────────────────────────────────
  const aiAvatarUrl = profile?.avatar_url ?? 'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Smilies/Robot.png';
  const ai = useAiInsight(profile, items, !!data);

  // ─── Realtime ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!profile?.building_id) return;
    const channel = supabase
      .channel(`marketplace_bld_${profile.building_id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'marketplace_items', filter: `building_id=eq.${profile.building_id}` }, () => mutate())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'marketplace_votes' }, () => mutate())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile?.building_id, mutate]);

  // ─── Handlers ─────────────────────────────────────────────────────────────
  const handleAddPostSubmit = useCallback(async (postData: any) => {
    if (!profile?.building_id) return;
    setIsSubmitting(true);

    let mediaUrl: string | undefined;
    if (postData.file) {
      const ext      = postData.file.name.split('.').pop();
      const filePath = `marketplace/${profile.id}_${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('chat_uploads').upload(filePath, postData.file);
      if (!error) mediaUrl = supabase.storage.from('chat_uploads').getPublicUrl(filePath).data.publicUrl;
    }

    const { error } = await supabase.from('marketplace_items').insert([{
      building_id:  profile.building_id,
      user_id:      profile.id,
      title:        postData.title,
      description:  postData.description,
      price:        postData.price,
      contact_phone:postData.contact_phone,
      category:     postData.category,
      media_url:    mediaUrl,
      media_type:   postData.type,
      item_type:    postData.item_type ?? 'post',
      poll_options: postData.poll_options ?? [],
    }]);

    if (!error) {
      playSystemSound('notification');
      setIsModalOpen(false);
      mutate();
      setCustomAlert({ title: 'פורסם בהצלחה!', message: 'העדכון נוסף ללוח הקהילתי.', type: 'success' });
    }
    setIsSubmitting(false);
  }, [profile, mutate]);

  const handleAddRequestSubmit = useCallback(async (title: string, description: string) => {
    if (!profile?.building_id) return;
    setIsSubmitting(true);

    const { error } = await supabase.from('marketplace_items').insert([{
      building_id:   profile.building_id,
      user_id:       profile.id,
      title,
      description,
      price:         0,
      contact_phone: profile.phone ?? '',
      category:      'בקשות שכנים',
    }]);

    if (!error) {
      playSystemSound('notification');
      setIsRequestModalOpen(false);
      mutate();
      setCustomAlert({ title: 'הבקשה נשלחה!', message: 'הבקשה נוספה ללוח בהצלחה.', type: 'success' });
    }
    setIsSubmitting(false);
  }, [profile, mutate]);

  const handleInlineEditSubmit = useCallback(async (e: React.FormEvent, id: string) => {
    e.preventDefault();
    setIsSubmitting(true);
    const price = FREE_PRICE_CATEGORIES.includes(editItemData.category) ? 0 : parseFloat(editItemData.price) || 0;
    await supabase.from('marketplace_items').update({ ...editItemData, price }).eq('id', id);
    playSystemSound('notification');
    setEditingItemId(null);
    mutate();
    setIsSubmitting(false);
  }, [editItemData, mutate]);

  const handleDelete = useCallback(async (id: string) => {
    await supabase.from('marketplace_items').delete().eq('id', id);
    setOpenMenuId(null);
    mutate();
    playSystemSound('click');
  }, [mutate]);

  const togglePin = useCallback(async (id: string, current: boolean) => {
    await supabase.from('marketplace_items').update({ is_pinned: !current }).eq('id', id);
    setOpenMenuId(null);
    playSystemSound('click');
    mutate();
  }, [mutate]);

  const toggleSave = useCallback(async (e: React.MouseEvent, id: string, isSaved: boolean) => {
    e.stopPropagation();
    setOpenMenuId(null);
    if (!profile) return;
    playSystemSound('click');
    if (isSaved) {
      await supabase.from('marketplace_saves').delete().match({ item_id: id, user_id: profile.id });
    } else {
      await supabase.from('marketplace_saves').insert([{ item_id: id, user_id: profile.id }]);
    }
    mutate();
  }, [profile, mutate]);

  const handleQuickReply = useCallback((item: MarketplaceItem, replyType: string) => {
    if (!item.contact_phone) {
      setCustomAlert({ title: 'אופס!', message: 'לא מעודכן מספר טלפון באפליקציה.', type: 'error' });
      return;
    }
    playSystemSound('click');
    const apt  = profile?.apartment ? `מדירה ${profile.apartment}` : '';
    const name = item.profiles?.full_name?.split(' ')[0] ?? '';
    const text = encodeURIComponent(`היי ${name}, לגבי העדכון בלוח שכן+ ("${item.title}") -\n*${replyType}* ✨\n\n(מוזמן/ת אליי ${apt})`);
    window.open(`${formatPhone(item.contact_phone)}?text=${text}`, '_blank');
  }, [profile]);

  // ─── Filtered items ───────────────────────────────────────────────────────
  const filteredItems = useMemo(() => {
    const smartTag = SMART_CATEGORIES.find(c => c.tag === searchQuery);

    return items.filter(item => {
      const isSaved = savedItemsIds.has(item.id);

      const matchesCategory =
        activeCategory === 'הכל'     ? true :
        activeCategory === 'שמורים'  ? isSaved :
        activeCategory === 'קהילה'   ? COMMUNITY_CATEGORIES.includes(item.category) :
        activeCategory === 'סקרים'   ? item.item_type === 'poll' :
        item.category === activeCategory;

      const matchesSearch = !searchQuery ? true :
        smartTag
          ? smartTag.keywords.some(kw => `${item.title} ${item.description ?? ''}`.toLowerCase().includes(kw)) || item.category === smartTag.tag
          : `${item.title} ${item.description ?? ''}`.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesCategory && matchesSearch;
    });
  }, [items, activeCategory, searchQuery, savedItemsIds]);

  // ─── Loading state ────────────────────────────────────────────────────────
  if (!data && !error) {
    return (
      <div className="flex flex-col flex-1 w-full items-center justify-center min-h-[100dvh] bg-transparent">
        <div className="w-12 h-12 border-4 border-[#1D4ED8]/30 border-t-[#1D4ED8] rounded-full animate-spin" />
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col flex-1 w-full pb-28 relative bg-transparent min-h-screen" dir="rtl" onClick={() => setOpenMenuId(null)}>

      {/* Alert */}
      {mounted && customAlert && <AlertModal alert={customAlert} onClose={() => setCustomAlert(null)} />}

      {/* Header */}
      <div className="px-4 mt-6 mb-5">
        <h2 className="text-2xl font-black text-slate-800 tracking-tight">לוח קהילתי</h2>
      </div>

      {/* Search */}
      <div className="px-4 mb-5">
        <div className="relative">
          <input
            type="text"
            placeholder="חיפוש חבילה, כלים, סקר או עדכון..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-[#1D4ED8]/20 rounded-[1.2rem] py-3.5 pr-4 pl-12 text-xs font-bold shadow-sm outline-none text-slate-800 focus:border-[#1D4ED8] transition"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute inset-y-0 left-0 w-12 h-12 flex items-center justify-center text-slate-400 hover:text-[#1D4ED8] transition">✕</button>
          )}
        </div>
      </div>

      {/* Categories */}
      <div className="px-4 mb-6">
        <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1 relative z-10">
          {MAIN_CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={e => { e.stopPropagation(); playSystemSound('click'); setActiveCategory(cat); }}
              className={`px-5 h-10 rounded-full text-[13px] transition-all flex items-center justify-center font-bold whitespace-nowrap shrink-0 border shadow-sm ${activeCategory === cat ? 'bg-[#1D4ED8] text-white border-[#1D4ED8]' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Items */}
      <div className="space-y-4 px-4 animate-in fade-in duration-300 relative">
        {filteredItems.length === 0 ? (
          <div className="text-center py-12 bg-[#1D4ED8]/5 rounded-3xl border border-[#1D4ED8]/10">
            <p className="text-[#1D4ED8]/60 font-bold text-xs">הלוח שקט כרגע ✨</p>
          </div>
        ) : (
          filteredItems.map(item => (
            <MarketplaceItemCard
              key={item.id}
              item={item}
              currentUserId={profile?.id}
              isAdmin={isAdmin}
              isSaved={savedItemsIds.has(item.id)}
              openMenuId={openMenuId}
              editingItemId={editingItemId}
              editItemData={editItemData}
              mainCategories={['חבילות ודואר', 'השאלות כלים', 'בקשות שכנים', 'למסירה', 'למכירה']}
              isSubmitting={isSubmitting}
              onToggleMenu={setOpenMenuId}
              onToggleSave={toggleSave}
              onTogglePin={togglePin}
              onStartEdit={it => { setEditingItemId(it.id); setEditItemData({ title: it.title, description: it.description ?? '', price: it.price === 0 ? '' : String(it.price), contact_phone: it.contact_phone, category: it.category }); setOpenMenuId(null); }}
              onCancelEdit={() => setEditingItemId(null)}
              onUpdateEditData={setEditItemData}
              onSubmitEdit={handleInlineEditSubmit}
              onDelete={handleDelete}
              onMediaClick={(url, type) => setFullScreenMedia({ url, type })}
              onQuickReply={handleQuickReply}
              formatWhatsApp={formatPhone}
              timeFormat={formatTime}
            />
          ))
        )}
      </div>

      {/* FAB */}
      <button
        onClick={e => { e.stopPropagation(); activeCategory === 'קהילה' ? setIsRequestModalOpen(true) : setIsModalOpen(true); }}
        className="fixed bottom-24 left-6 z-40 bg-white/90 backdrop-blur-md border border-[#1D4ED8]/20 text-slate-800 pl-4 pr-1.5 py-1.5 rounded-full shadow-[0_8px_30px_rgba(29,78,216,0.15)] hover:scale-105 active:scale-95 transition flex items-center gap-2 group flex-row-reverse"
      >
        <div className="bg-[#1D4ED8] text-white w-10 h-10 flex items-center justify-center rounded-full shadow-md">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m7-7H5" /></svg>
        </div>
        <span className="font-black text-xs text-[#1D4ED8]">{activeCategory === 'קהילה' ? 'בקשת עזרה' : 'סקר / מודעה'}</span>
      </button>

      {/* AI Bubble */}
      <AiBubble
        insight={ai.insight}
        isLoading={ai.isLoading}
        showBubble={ai.showBubble}
        avatarUrl={aiAvatarUrl}
        onToggle={ai.toggleBubble}
      />

      {/* Fullscreen media */}
      {fullScreenMedia && (
        <div className="fixed inset-0 z-[150] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in cursor-pointer" onClick={() => setFullScreenMedia(null)}>
          <button className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center text-white bg-white/10 hover:bg-white/20 rounded-full transition z-10 border border-white/20">✕</button>
          {fullScreenMedia.type === 'video'
            ? <video src={fullScreenMedia.url} controls autoPlay className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()} />
            : <img    src={fullScreenMedia.url} alt="Fullscreen"  className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()} />}
        </div>
      )}

      {/* Modals */}
      {isRequestModalOpen && (
        <CreateMarketplaceItemModal
          type="request"
          mainCategories={['חבילות ודואר', 'השאלות כלים', 'למסירה', 'למכירה']}
          defaultPhone={profile?.phone ?? ''}
          isSubmitting={isSubmitting}
          onClose={() => setIsRequestModalOpen(false)}
          onSubmitPost={async () => {}}
          onSubmitRequest={handleAddRequestSubmit}
        />
      )}
      {isModalOpen && (
        <CreateMarketplaceItemModal
          type="post"
          mainCategories={['חבילות ודואר', 'השאלות כלים', 'למסירה', 'למכירה']}
          defaultPhone={profile?.phone ?? ''}
          isSubmitting={isSubmitting}
          onClose={() => setIsModalOpen(false)}
          onSubmitPost={handleAddPostSubmit}
          onSubmitRequest={async () => {}}
        />
      )}
    </div>
  );
}

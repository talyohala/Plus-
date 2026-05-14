'use client'

import React, { useEffect, useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import useSWR from 'swr';
import { supabase } from '../../../lib/supabase';
import { playSystemSound } from '../../../components/providers/AppManager';
import MarketplaceItemCard, { MarketplaceItem } from '../../../components/marketplace/MarketplaceItemCard';
import CreateMarketplaceItemModal from '../../../components/marketplace/CreateMarketplaceItemModal';

interface MarketplaceUser { id: string; full_name: string; building_id: string; role: string; phone?: string; avatar_url?: string; apartment?: string; }

const mainCategories = ['הכל', 'סקרים', 'קהילה', 'למסירה', 'למכירה', 'שמורים'];
const smartCategoriesMap = [
  { tag: 'חבילות ודואר', keywords: ['חבילה', 'דואר', 'מעטפה', 'שליח', 'לובי', 'בסלון', 'אספתי', 'חבילות', 'בארון'] },
  { tag: 'השאלות כלים', keywords: ['כבלים', 'מקדחה', 'סולם', 'מברגה', 'להשאיל', 'צריך', 'כלים', 'פטיש'] },
  { tag: 'רהיטים', keywords: ['ארון', 'שולחן', 'מיטה', 'ספה', 'כיסא', 'שידה', 'מזנון'] },
  { tag: 'אלקטרוניקה', keywords: ['מחשב', 'טלוויזיה', 'מטען', 'אייפון', 'רמקול', 'מסך'] }
];

const fetcher = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Unauthorized');
  
  const { data: prof } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
  if (!prof) throw new Error('Profile missing');

  const [itemsRes, savesRes] = await Promise.all([
    supabase.from('marketplace_items').select('*, profiles(full_name, avatar_url, apartment, floor, role)').eq('building_id', prof.building_id).eq('status', 'available').order('is_pinned', { ascending: false }).order('created_at', { ascending: false }),
    supabase.from('marketplace_saves').select('item_id').eq('user_id', prof.id)
  ]);

  return { profile: prof, items: itemsRes.data || [], saves: savesRes.data ? new Set(savesRes.data.map(s => s.item_id)) : new Set() };
};

export default function MarketplacePage() {
  const { data, error, mutate } = useSWR('/api/marketplace/fetch', fetcher, { revalidateOnFocus: true });
  
  const profile = data?.profile;
  const items: MarketplaceItem[] = data?.items || [];
  const savedItemsIds = data?.saves || new Set<string>();

  const [activeCategory, setActiveCategory] = useState('הכל');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fullScreenMedia, setFullScreenMedia] = useState<{ url: string; type: string } | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [editItemData, setEditItemData] = useState({ title: '', description: '', price: '', contact_phone: '', category: 'למכירה' });
  
  const [customAlert, setCustomAlert] = useState<{ title: string; message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [aiInsight, setAiInsight] = useState<string>('');
  const [isAiLoading, setIsAiLoading] = useState(true);
  const [showAiBubble, setShowAiBubble] = useState(false);
  const [mounted, setMounted] = useState(false);
  const lastAnalyzedRef = useRef<string>('');

  const isAdmin = profile?.role === 'admin';
  const aiAvatarUrl = profile?.avatar_url || "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Smilies/Robot.png";

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!profile?.building_id) return;
    const channel = supabase.channel(`marketplace_${profile.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'marketplace_items', filter: `building_id=eq.${profile.building_id}` }, () => mutate())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'marketplace_votes' }, () => mutate())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile?.building_id, mutate]);

  useEffect(() => {
    if (!profile || items.length === 0) {
      if (data) setIsAiLoading(false);
      return;
    }
    const currentHash = `${profile.id}-${items.length}`;
    if (lastAnalyzedRef.current === currentHash) return;
    lastAnalyzedRef.current = currentHash;

    const fetchInsight = async () => {
      setIsAiLoading(true);
      const packs = items.filter(i => i.category === 'חבילות ודואר').length;
      const polls = items.filter(i => i.item_type === 'poll').length;
      const context = `דייר: ${profile.full_name}. סטטוס הלוח: ${packs} חבילות ממתינות, ו-${polls} סקרים באוויר. נסח הודעת עזר קהילתית משמחת מגוף ראשון כדובר הלוח. 2 שורות בדיוק עם ירידת שורה. אימוג'י 1 בכל שורה.`;
      
      try {
        const res = await fetch('/api/ai/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ description: context, mode: 'insight' }) });
        const aiData = await res.json();
        setAiInsight(aiData.text || '');
      } catch (err) {
        setAiInsight(`יש כרגע ${packs} חבילות בלובי 📦\nו-${polls} סקרים להצבעה. שווה להציץ! ✨`);
      } finally {
        setIsAiLoading(false);
        setShowAiBubble(true);
        setTimeout(() => setShowAiBubble(false), 15000);
      }
    };
    fetchInsight();
  }, [profile, items, data]);

  const handleAddPostSubmit = async (postData: any) => {
    if (!profile?.building_id) return;
    setIsSubmitting(true);
    let mediaUrl: string | undefined = undefined;
    
    if (postData.file) {
      const fileExt = postData.file.name.split('.').pop();
      const filePath = `marketplace/${profile.id}_${Date.now()}.${fileExt}`;
      const { error } = await supabase.storage.from('chat_uploads').upload(filePath, postData.file);
      if (!error) mediaUrl = supabase.storage.from('chat_uploads').getPublicUrl(filePath).data.publicUrl;
    }

    const { error } = await supabase.from('marketplace_items').insert([{
      building_id: profile.building_id, user_id: profile.id, title: postData.title, description: postData.description,
      price: postData.price, contact_phone: postData.contact_phone, category: postData.category, media_url: mediaUrl, media_type: postData.type,
      item_type: postData.item_type || 'post', poll_options: postData.poll_options || []
    }]);

    if (!error) {
      playSystemSound('notification'); setIsModalOpen(false); mutate();
      setCustomAlert({ title: 'פורסם בהצלחה!', message: 'העדכון נוסף ללוח הקהילתי.', type: 'success' });
    }
    setIsSubmitting(false);
  };

  const handleAddRequestSubmit = async (title: string, description: string) => {
    if (!profile?.building_id) return;
    setIsSubmitting(true);
    const { error } = await supabase.from('marketplace_items').insert([{
      building_id: profile.building_id, user_id: profile.id, title, description, price: 0, contact_phone: profile.phone || '', category: 'בקשות שכנים',
    }]);
    if (!error) {
      playSystemSound('notification'); setIsRequestModalOpen(false); mutate();
      setCustomAlert({ title: 'הבקשה נשלחה!', message: 'הבקשה נוספה ללוח בהצלחה.', type: 'success' });
    }
    setIsSubmitting(false);
  };

  const handleInlineEditSubmit = async (e: React.FormEvent, id: string) => {
    e.preventDefault();
    setIsSubmitting(true);
    const parsedPrice = ['למסירה', 'חבילות ודואר', 'השאלות כלים', 'בקשות שכנים', 'סקרים'].includes(editItemData.category) ? 0 : parseFloat(editItemData.price) || 0;
    await supabase.from('marketplace_items').update({ title: editItemData.title, description: editItemData.description, price: parsedPrice, contact_phone: editItemData.contact_phone, category: editItemData.category }).eq('id', id);
    playSystemSound('notification'); setEditingItemId(null); mutate(); setIsSubmitting(false);
  };

  const handleDelete = async (id: string) => { await supabase.from('marketplace_items').delete().eq('id', id); setOpenMenuId(null); mutate(); playSystemSound('click'); };
  const togglePin = async (id: string, currentStatus: boolean) => { await supabase.from('marketplace_items').update({ is_pinned: !currentStatus }).eq('id', id); setOpenMenuId(null); playSystemSound('click'); mutate(); };

  const toggleSave = async (e: React.MouseEvent, id: string, isCurrentlySaved: boolean) => {
    e.stopPropagation(); setOpenMenuId(null);
    if (!profile) return;
    playSystemSound('click');
    if (isCurrentlySaved) {
      await supabase.from('marketplace_saves').delete().match({ item_id: id, user_id: profile.id });
    } else {
      await supabase.from('marketplace_saves').insert([{ item_id: id, user_id: profile.id }]);
    }
    mutate();
  };

  const handleQuickReply = (item: MarketplaceItem, replyType: string) => {
    if (!item.contact_phone) { setCustomAlert({ title: 'אופס!', message: 'לא מעודכן מספר טלפון באפליקציה.', type: 'error' }); return; }
    playSystemSound('click');
    const aptText = profile?.apartment ? `מדירה ${profile.apartment}` : '';
    const text = encodeURIComponent(`היי ${item.profiles?.full_name?.split(' ')[0] || ''}, לגבי העדכון בלוח שכן+ ("${item.title}") -\n*${replyType}* ✨\n\n(מוזמן/ת אליי ${aptText})`);
    let clean = item.contact_phone.replace(/\D/g, '');
    window.open(`https://wa.me/${clean.startsWith('0') ? '972' + clean.slice(1) : clean}?text=${text}`, '_blank');
  };

  const filteredItems = useMemo(() => {
    const matchedSmartTag = smartCategoriesMap.find(c => c.tag === searchQuery);
    return items.filter(item => {
      const isSaved = savedItemsIds.has(item.id);
      let matchesFilter = activeCategory === 'הכל' ? true : activeCategory === 'שמורים' ? isSaved : activeCategory === 'קהילה' ? ['חבילות ודואר', 'השאלות כלים', 'בקשות שכנים'].includes(item.category) : activeCategory === 'סקרים' ? item.item_type === 'poll' : item.category === activeCategory;
      let matchesSearch = !searchQuery ? true : matchedSmartTag ? matchedSmartTag.keywords.some(kw => (item.title + ' ' + (item.description || '')).toLowerCase().includes(kw)) || item.category === matchedSmartTag.tag : item.title.toLowerCase().includes(searchQuery.toLowerCase()) || (item.description?.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesFilter && matchesSearch;
    });
  }, [items, activeCategory, searchQuery, savedItemsIds]);

  const formatWhatsApp = (phone: string) => { let clean = phone.replace(/\D/g, ''); return `https://wa.me/${clean.startsWith('0') ? '972' + clean.slice(1) : clean}`; };
  const timeFormat = (dateStr: string) => { const date = new Date(dateStr); const diffDays = Math.floor((Date.now() - date.getTime()) / 86400000); return diffDays === 0 ? date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : diffDays === 1 ? 'אתמול' : date.toLocaleDateString('he-IL'); };

  if (!data && !error) return <div className="flex flex-col flex-1 w-full items-center justify-center min-h-[100dvh] bg-transparent"><div className="w-12 h-12 border-4 border-[#1D4ED8]/30 border-t-[#1D4ED8] rounded-full animate-spin"></div></div>;

  return (
    <div className="flex flex-col flex-1 w-full pb-28 relative bg-transparent min-h-screen" dir="rtl" onClick={() => setOpenMenuId(null)}>
      {mounted && customAlert && createPortal(
        <div className="fixed inset-0 z-[10000] bg-black/40 backdrop-blur-sm flex justify-center items-center p-4" onClick={() => setCustomAlert(null)} dir="rtl">
          <div className="bg-white/95 backdrop-blur-xl rounded-[2rem] p-6 w-full max-w-sm shadow-2xl text-center animate-in zoom-in-95 border border-white/50" onClick={e => e.stopPropagation()}>
            <div className={`w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center shadow-lg ${customAlert.type === 'success' ? 'bg-[#10B981]/10 text-[#10B981] animate-[bounce_1s_infinite]' : customAlert.type === 'error' ? 'bg-red-50 text-red-500' : 'bg-[#1D4ED8]/10 text-[#1D4ED8]'}`}>
              {customAlert.type === 'success' ? <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg> : <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>}
            </div>
            <h3 className="text-2xl font-black text-slate-800 mb-2">{customAlert.title}</h3>
            <p className="text-base text-slate-500 mb-6 leading-relaxed font-medium">{customAlert.message}</p>
            <button onClick={() => setCustomAlert(null)} className="w-full h-14 flex items-center justify-center bg-[#1E293B] hover:bg-slate-800 text-white font-bold rounded-xl active:scale-95 transition shadow-sm text-lg">סגירה</button>
          </div>
        </div>, document.body
      )}
      
      <div className="px-4 mt-6 mb-5"><h2 className="text-2xl font-black text-slate-800 tracking-tight">לוח קהילתי</h2></div>

      <div className="px-4 mb-5">
        <div className="relative">
          <input type="text" placeholder="חיפוש חבילה, כלים, סקר או עדכון..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-white border border-[#1D4ED8]/20 rounded-[1.2rem] py-3.5 pr-4 pl-12 text-xs font-bold shadow-sm outline-none text-slate-800 focus:border-[#1D4ED8] transition" />
          {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute inset-y-0 left-0 w-12 h-12 flex items-center justify-center text-slate-400 hover:text-[#1D4ED8] transition">✕</button>}
        </div>
      </div>

      <div className="px-4 mb-6">
        <div className="flex bg-white/80 backdrop-blur-md p-1.5 rounded-full border border-[#1D4ED8]/10 shadow-sm relative z-10 overflow-x-auto hide-scrollbar">
          {mainCategories.map(cat => (
            <button key={cat} onClick={(e) => { e.stopPropagation(); setActiveCategory(cat); }} className={`flex-1 min-w-[70px] h-10 px-2 rounded-full text-[13px] transition-all flex items-center justify-center font-bold whitespace-nowrap ${activeCategory === cat ? 'text-[#1D4ED8] bg-blue-50 border border-blue-100 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{cat}</button>
          ))}
        </div>
      </div>

      <div className="space-y-4 px-4 animate-in fade-in duration-300 relative">
        {filteredItems.length === 0 ? (
          <div className="text-center py-12 bg-[#1D4ED8]/5 rounded-3xl border border-[#1D4ED8]/10">
            <p className="text-[#1D4ED8]/60 font-bold text-xs">הלוח שקט כרגע ✨</p>
          </div>
        ) : (
          filteredItems.map(item => (
            <MarketplaceItemCard key={item.id} item={item} currentUserId={profile?.id} isAdmin={isAdmin} isSaved={savedItemsIds.has(item.id)} openMenuId={openMenuId} editingItemId={editingItemId} editItemData={editItemData} mainCategories={['חבילות ודואר', 'השאלות כלים', 'בקשות שכנים', 'למסירה', 'למכירה']} isSubmitting={isSubmitting} onToggleMenu={setOpenMenuId} onToggleSave={toggleSave} onTogglePin={togglePin} onStartEdit={it => { setEditingItemId(it.id); setEditItemData({ title: it.title, description: it.description || '', price: it.price === 0 ? '' : it.price.toString(), contact_phone: it.contact_phone, category: it.category }); setOpenMenuId(null); }} onCancelEdit={() => setEditingItemId(null)} onUpdateEditData={setEditItemData} onSubmitEdit={handleInlineEditSubmit} onDelete={handleDelete} onMediaClick={(url, type) => setFullScreenMedia({ url, type })} onQuickReply={handleQuickReply} formatWhatsApp={formatWhatsApp} timeFormat={timeFormat} />
          ))
        )}
      </div>

      <button onClick={(e) => { e.stopPropagation(); activeCategory === 'קהילה' ? setIsRequestModalOpen(true) : setIsModalOpen(true); }} className="fixed bottom-24 left-6 z-40 bg-white/90 backdrop-blur-md border border-[#1D4ED8]/20 text-slate-800 pl-4 pr-1.5 py-1.5 rounded-full shadow-[0_8px_30px_rgba(29,78,216,0.15)] hover:scale-105 active:scale-95 transition flex items-center gap-2 group flex-row-reverse">
        <div className="bg-[#1D4ED8] text-white w-10 h-10 flex items-center justify-center rounded-full shadow-md"><svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m7-7H5"></path></svg></div>
        <span className="font-black text-xs text-[#1D4ED8]">{activeCategory === 'קהילה' ? 'בקשת עזרה' : 'סקר / מודעה'}</span>
      </button>

      {/* בועת AI */}
      <div className={`fixed bottom-24 right-6 z-50 flex flex-col items-end pointer-events-none transition-all duration-700 ease-in-out ${showAiBubble ? 'opacity-100 translate-y-0 visible' : 'opacity-0 translate-y-10 invisible'}`}>
        {!isAiLoading && <div className="absolute bottom-[60px] right-0 mb-2 bg-white/90 backdrop-blur-md border border-[#1D4ED8]/20 rounded-2xl px-4 py-2 shadow-[0_-4px_20px_rgba(0,0,0,0.1)] text-xs font-bold text-slate-700 w-max max-w-[240px] leading-snug text-right pointer-events-auto break-words animate-in fade-in slide-in-from-bottom-2 duration-500">{aiInsight}</div>}
        <button onClick={(e) => { e.stopPropagation(); if (showAiBubble) setShowAiBubble(false); else if (!isAiLoading) setShowAiBubble(true); }} className={`w-12 h-12 bg-transparent flex items-center justify-center pointer-events-auto active:scale-95 transition-transform duration-300 ${isAiLoading ? 'animate-pulse' : 'animate-[bounce_3s_infinite]'}`}>
          {isAiLoading ? <div className="w-12 h-12 bg-[#1D4ED8]/10 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm border border-[#1D4ED8]/30"><div className="w-5 h-5 border-2 border-[#1D4ED8] border-t-transparent rounded-full animate-spin"></div></div> : <img src={aiAvatarUrl} alt="AI Avatar" className="w-12 h-12 object-contain drop-shadow-md rounded-full" />}
        </button>
      </div>

      {fullScreenMedia && (
        <div className="fixed inset-0 z-[150] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in cursor-pointer" onClick={() => setFullScreenMedia(null)}>
          <button className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center text-white bg-white/10 hover:bg-white/20 rounded-full transition z-10 border border-white/20">✕</button>
          {fullScreenMedia.type === 'video' ? <video src={fullScreenMedia.url} controls autoPlay className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()} /> : <img src={fullScreenMedia.url} alt="Fullscreen" className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()} />}
        </div>
      )}

      {isRequestModalOpen && <CreateMarketplaceItemModal type="request" mainCategories={['חבילות ודואר', 'השאלות כלים', 'למסירה', 'למכירה']} defaultPhone={profile?.phone || ''} isSubmitting={isSubmitting} onClose={() => setIsRequestModalOpen(false)} onSubmitPost={async () => {}} onSubmitRequest={handleAddRequestSubmit} />}
      {isModalOpen && <CreateMarketplaceItemModal type="post" mainCategories={['חבילות ודואר', 'השאלות כלים', 'למסירה', 'למכירה']} defaultPhone={profile?.phone || ''} isSubmitting={isSubmitting} onClose={() => setIsModalOpen(false)} onSubmitPost={handleAddPostSubmit} onSubmitRequest={async () => {}} />}
    </div>
  );
}

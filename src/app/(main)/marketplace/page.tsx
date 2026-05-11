'use client'
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import { playSystemSound } from '../../../components/providers/AppManager';
import MarketplaceItemCard, { MarketplaceItem } from '../../../components/marketplace/MarketplaceItemCard';
import CreateMarketplaceItemModal from '../../../components/marketplace/CreateMarketplaceItemModal';

interface MarketplaceUser {
  id: string;
  full_name: string;
  building_id: string;
  role: string;
  phone?: string;
  avatar_url?: string;
  apartment?: string;
}

const mainCategories = ['הכל', 'עזרה וחבילות', 'למסירה', 'למכירה', 'שמורים'];

const smartCategoriesMap = [
  { tag: 'חבילות ודואר', keywords: ['חבילה', 'דואר', 'מעטפה', 'שליח', 'לובי', 'בסלון', 'אספתי', 'חבילות'] },
  { tag: 'השאלות כלים', keywords: ['כבלים', 'מקדחה', 'סולם', 'מברגה', 'להשאיל', 'צריך', 'כלים', 'פטיש'] },
  { tag: 'רהיטים', keywords: ['ארון', 'שולחן', 'מיטה', 'ספה', 'כיסא', 'שידה', 'מזנון'] },
  { tag: 'אלקטרוניקה', keywords: ['מחשב', 'טלוויזיה', 'מטען', 'אייפון', 'רמקול', 'מסך'] }
];

export default function MarketplacePage() {
  const [profile, setProfile] = useState<MarketplaceUser | null>(null);
  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [savedItemsIds, setSavedItemsIds] = useState<Set<string>>(new Set());
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

  const isAdmin = profile?.role === 'admin';

  const aiAvatarUrl = useMemo(() => {
    return profile?.avatar_url || "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Smilies/Robot.png";
  }, [profile?.avatar_url]);

  const fetchData = useCallback(async (userId: string) => {
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (!prof || !prof.building_id) return;
    setProfile(prof);

    const { data: saves } = await supabase.from('marketplace_saves').select('item_id').eq('user_id', prof.id);
    if (saves) {
      setSavedItemsIds(new Set(saves.map(s => s.item_id)));
    }

    const { data } = await supabase.from('marketplace_items')
      .select('*, profiles(full_name, avatar_url, apartment, floor, role)')
      .eq('building_id', prof.building_id)
      .eq('status', 'available')
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false });

    if (data) setItems(data);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) fetchData(user.id);
    });
  }, [fetchData]);

  useEffect(() => {
    if (!profile?.building_id) return;
    const channelTopic = `marketplace_realtime_${profile.id}`;
    const channel = supabase.channel(channelTopic)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'marketplace_items', filter: `building_id=eq.${profile.building_id}` }, () => {
        fetchData(profile.id);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile?.building_id, profile?.id, fetchData]);

  useEffect(() => {
    if (!profile || items.length === 0) return;
    
    const fetchInsight = async () => {
      setIsAiLoading(true);
      const packs = items.filter(i => i.category === 'חבילות ודואר').length;
      const borrows = items.filter(i => i.category === 'השאלות כלים' || i.category === 'בקשות שכנים').length;
      
      const context = `
        דייר: ${profile.full_name}.
        סטטוס לוח: ${packs} חבילות בלובי, ו-${borrows} השאלות/בקשות פתוחות.
        נסח הודעת עזר קהילתית מגוף ראשון כדובר הלוח.
        בדיוק 2 שורות. אימוג'י 1 בלבד.
      `;

      try {
        const res = await fetch('/api/ai/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ description: context, mode: 'insight' })
        });
        const data = await res.json();
        setAiInsight(data.text);
      } catch (err) {
        setAiInsight(`יש כרגע ${packs} חבילות בלובי ו-${borrows} בקשות עזרה. שווה להציץ! ✨`);
      } finally {
        setIsAiLoading(false);
        setShowAiBubble(true);
        setTimeout(() => setShowAiBubble(false), 15000);
      }
    };

    fetchInsight();
  }, [profile, items.length]);

  const handleAddPost = async (postData: { title: string; description: string; price: number; contact_phone: string; category: string; file: File | null; type: string }) => {
    if (!profile?.building_id) return;
    setIsSubmitting(true);

    let mediaUrl: string | undefined = undefined;
    if (postData.file) {
      const fileExt = postData.file.name.split('.').pop();
      const filePath = `marketplace/${profile.id}_${Date.now()}.${fileExt}`;
      const { error } = await supabase.storage.from('chat_uploads').upload(filePath, postData.file);
      if (!error) {
        mediaUrl = supabase.storage.from('chat_uploads').getPublicUrl(filePath).data.publicUrl;
      }
    }

    const payload = {
      building_id: profile.building_id,
      user_id: profile.id,
      title: postData.title,
      description: postData.description,
      price: postData.price,
      contact_phone: postData.contact_phone,
      category: postData.category,
      media_url: mediaUrl,
      media_type: postData.file ? postData.type : undefined,
    };

    const { error } = await supabase.from('marketplace_items').insert([payload]);
    if (!error) {
      playSystemSound('notification');
      setIsModalOpen(false);
      fetchData(profile.id);
      setCustomAlert({ title: 'פורסם בהצלחה!', message: 'העדכון נוסף ללוח הקהילתי.', type: 'success' });
    }
    setIsSubmitting(false);
  };

  const handleAddRequest = async (title: string, description: string) => {
    if (!profile?.building_id) return;
    setIsSubmitting(true);

    const payload = {
      building_id: profile.building_id,
      user_id: profile.id,
      title,
      description,
      price: 0,
      contact_phone: profile.phone || '',
      category: 'בקשות שכנים',
    };

    const { error } = await supabase.from('marketplace_items').insert([payload]);
    if (!error) {
      playSystemSound('notification');
      setIsRequestModalOpen(false);
      fetchData(profile.id);
      setCustomAlert({ title: 'הבקשה נשלחה!', message: 'כל השכנים קיבלו פוש בזה הרגע.', type: 'success' });
    }
    setIsSubmitting(false);
  };

  const handleInlineEditSubmit = async (e: React.FormEvent, id: string) => {
    e.preventDefault();
    setIsSubmitting(true);
    const parsedPrice = editItemData.category === 'למסירה' || editItemData.category === 'חבילות ודואר' || editItemData.category === 'השאלות כלים' ? 0 : parseFloat(editItemData.price) || 0;
    
    await supabase.from('marketplace_items').update({
      title: editItemData.title,
      description: editItemData.description,
      price: parsedPrice,
      contact_phone: editItemData.contact_phone,
      category: editItemData.category,
    }).eq('id', id);

    playSystemSound('notification');
    setEditingItemId(null);
    if (profile) fetchData(profile.id);
    setIsSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    await supabase.from('marketplace_items').delete().eq('id', id);
    setOpenMenuId(null);
    if (profile) fetchData(profile.id);
    playSystemSound('click');
  };

  const togglePin = async (id: string, currentStatus: boolean) => {
    await supabase.from('marketplace_items').update({ is_pinned: !currentStatus }).eq('id', id);
    setOpenMenuId(null);
    playSystemSound('click');
    if (profile) fetchData(profile.id);
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

  const handleQuickReply = (item: MarketplaceItem, replyType: string) => {
    if (!item.contact_phone) {
      setCustomAlert({ title: 'אופס!', message: 'לא מעודכן מספר טלפון באפליקציה.', type: 'error' });
      return;
    }
    playSystemSound('click');
    const aptText = profile?.apartment ? `מדירה ${profile.apartment}` : '';
    const text = encodeURIComponent(`היי ${item.profiles?.full_name?.split(' ')[0] || ''}, לגבי העדכון בלוח שכן+ ("${item.title}") -\n*${replyType}* ✨\n\n(מוזמן/ת אליי ${aptText})`);
    let clean = item.contact_phone.replace(/\D/g, '');
    if (clean.startsWith('0')) clean = '972' + clean.slice(1);
    window.open(`https://wa.me/${clean}?text=${text}`, '_blank');
  };

  const filteredItems = useMemo(() => {
    const matchedSmartTag = smartCategoriesMap.find(c => c.tag === searchQuery);
    return items.filter(item => {
      const isSaved = savedItemsIds.has(item.id);
      
      let matchesFilter = false;
      if (activeCategory === 'הכל') {
        matchesFilter = true;
      } else if (activeCategory === 'שמורים') {
        matchesFilter = isSaved;
      } else if (activeCategory === 'עזרה וחבילות') {
        matchesFilter = item.category === 'חבילות ודואר' || item.category === 'השאלות כלים' || item.category === 'בקשות שכנים';
      } else {
        matchesFilter = item.category === activeCategory;
      }

      let matchesSearch = false;
      if (!searchQuery) {
        matchesSearch = true;
      } else if (matchedSmartTag) {
        const text = (item.title + ' ' + (item.description || '')).toLowerCase();
        matchesSearch = matchedSmartTag.keywords.some(kw => text.includes(kw)) || item.category === matchedSmartTag.tag;
      } else {
        const searchLower = searchQuery.toLowerCase();
        matchesSearch = item.title.toLowerCase().includes(searchLower) || (item.description && item.description.toLowerCase().includes(searchLower));
      }
      return matchesFilter && matchesSearch;
    });
  }, [items, activeCategory, searchQuery, savedItemsIds]);

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

  return (
    <div className="flex flex-col flex-1 w-full pb-28 relative bg-transparent min-h-screen" dir="rtl" onClick={() => setOpenMenuId(null)}>
      <div className="px-4 mt-6 mb-5">
        <h2 className="text-2xl font-black text-slate-800 tracking-tight">לוח קהילתי</h2>
      </div>

      <div className="px-4 mb-5">
        <div className="relative">
          <input
            type="text"
            placeholder="חיפוש חבילה, כלי עבודה או עדכון..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-[#1D4ED8]/20 rounded-[1.2rem] py-3.5 pr-4 pl-12 text-xs font-bold shadow-sm outline-none text-slate-800 focus:border-[#1D4ED8] transition"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute inset-y-0 left-0 w-12 h-12 flex items-center justify-center text-slate-400 hover:text-[#1D4ED8] transition">
              ✕
            </button>
          )}
        </div>
      </div>

      <div className="px-4 mb-6">
        <div className="flex bg-white/80 backdrop-blur-md p-1.5 rounded-full border border-[#1D4ED8]/10 shadow-sm relative z-10 overflow-x-auto hide-scrollbar">
          {mainCategories.map(cat => (
            <button
              key={cat}
              onClick={(e) => {
                e.stopPropagation();
                setActiveCategory(cat);
              }}
              className={`flex-1 min-w-[70px] h-10 px-2 rounded-full text-xs transition-all flex items-center justify-center whitespace-nowrap ${
                activeCategory === cat 
                  ? 'text-[#1D4ED8] font-black bg-[#1D4ED8]/10 shadow-sm border border-[#1D4ED8]/20' 
                  : 'text-slate-500 font-bold hover:text-[#1D4ED8]/70'
              }`}
            >
              {cat}
            </button>
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
              onStartEdit={it => {
                setEditingItemId(it.id);
                setEditItemData({
                  title: it.title,
                  description: it.description || '',
                  price: it.price === 0 ? '' : it.price.toString(),
                  contact_phone: it.contact_phone,
                  category: it.category,
                });
                setOpenMenuId(null);
              }}
              onCancelEdit={() => setEditingItemId(null)}
              onUpdateEditData={setEditItemData}
              onSubmitEdit={handleInlineEditSubmit}
              onDelete={handleDelete}
              onMediaClick={(url, type) => setFullScreenMedia({ url, type })}
              onQuickReply={handleQuickReply}
              formatWhatsApp={formatWhatsApp}
              timeFormat={timeFormat}
            />
          ))
        )}
      </div>

      {activeCategory === 'עזרה וחבילות' ? (
        <button 
          onClick={(e) => {
            e.stopPropagation();
            setIsRequestModalOpen(true);
          }} 
          className="fixed bottom-24 left-6 z-40 bg-white/90 backdrop-blur-md border border-[#1D4ED8]/20 text-slate-800 pl-4 pr-1.5 py-1.5 rounded-full shadow-[0_8px_30px_rgba(29,78,216,0.2)] hover:scale-105 active:scale-95 transition flex items-center gap-2 group flex-row-reverse"
        >
          {/* אייקון לב נקי ואלגנטי ללא פלוס */}
          <div className="bg-emerald-600 text-white w-10 h-10 flex items-center justify-center rounded-full shadow-md">
            <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
          </div>
          <span className="font-black text-xs text-emerald-700">בקשת עזרה</span>
        </button>
      ) : (
        <button 
          onClick={(e) => {
            e.stopPropagation();
            setIsModalOpen(true);
          }} 
          className="fixed bottom-24 left-6 z-40 bg-white/90 backdrop-blur-md border border-[#1D4ED8]/20 text-slate-800 pl-4 pr-1.5 py-1.5 rounded-full shadow-[0_8px_30px_rgba(29,78,216,0.2)] hover:scale-105 active:scale-95 transition flex items-center gap-2 group flex-row-reverse"
        >
          <div className="bg-[#1D4ED8] text-white w-10 h-10 flex items-center justify-center rounded-full shadow-md font-black text-base">＋</div>
          <span className="font-black text-xs text-[#1D4ED8]">עדכון ללוח</span>
        </button>
      )}

      {/* בועת AI מרחפת, מותאמת בדיוק לגודל 48x48 לפי חוקי הברזל (w-12 h-12) */}
      <div className={`fixed bottom-24 right-6 z-50 flex flex-col items-end pointer-events-none transition-all duration-700 ease-in-out ${showAiBubble ? 'opacity-100 translate-y-0 visible' : 'opacity-0 translate-y-10 invisible'}`}>
        {!isAiLoading && (
          <div className="absolute bottom-[60px] right-0 mb-2 bg-white/90 backdrop-blur-md border border-[#1D4ED8]/20 rounded-2xl px-4 py-2 shadow-[0_-4px_20px_rgba(0,0,0,0.1)] text-xs font-bold text-slate-700 w-max max-w-[240px] leading-snug text-right pointer-events-auto break-words animate-in fade-in slide-in-from-bottom-2 duration-500">
            {aiInsight}
          </div>
        )}
        <button onClick={(e) => { e.stopPropagation(); if (showAiBubble) setShowAiBubble(false); else if (!isAiLoading) setShowAiBubble(true); }} className={`w-12 h-12 bg-transparent flex items-center justify-center pointer-events-auto active:scale-95 transition-transform duration-300 ${isAiLoading ? 'animate-pulse' : 'animate-[bounce_3s_infinite]'}`}>
          {isAiLoading ? <div className="w-12 h-12 bg-[#1D4ED8]/10 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm border border-[#1D4ED8]/30"><div className="w-5 h-5 border-2 border-[#1D4ED8] border-t-transparent rounded-full animate-spin"></div></div> : <img src={aiAvatarUrl} alt="AI Avatar" className="w-12 h-12 object-contain drop-shadow-md rounded-full" />}
        </button>
      </div>

      {isRequestModalOpen && <CreateMarketplaceItemModal type="request" mainCategories={['חבילות ודואר', 'השאלות כלים', 'למסירה', 'למכירה']} defaultPhone={profile?.phone || ''} isSubmitting={isSubmitting} onClose={() => setIsRequestModalOpen(false)} onSubmitPost={async () => {}} onSubmitRequest={handleAddRequest} />}
      {isModalOpen && <CreateMarketplaceItemModal type="post" mainCategories={['חבילות ודואר', 'השאלות כלים', 'למסירה', 'למכירה']} defaultPhone={profile?.phone || ''} isSubmitting={isSubmitting} onClose={() => setIsModalOpen(false)} onSubmitPost={handleAddPost} onSubmitRequest={async () => {}} />}

      {fullScreenMedia && (
        <div className="fixed inset-0 z-[150] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in cursor-pointer" onClick={() => setFullScreenMedia(null)}>
          <button className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center text-white bg-white/10 hover:bg-white/20 rounded-full transition z-10 border border-white/20">✕</button>
          {fullScreenMedia.type === 'video' ? <video src={fullScreenMedia.url} controls autoPlay className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()} /> : <img src={fullScreenMedia.url} alt="Fullscreen" className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()} />}
        </div>
      )}

      {customAlert && (
        <div className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-white/95 backdrop-blur-xl rounded-[2rem] p-6 w-full max-w-sm shadow-2xl text-center animate-in zoom-in-95 border border-white/50">
            <div className={`w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center shadow-lg ${customAlert.type === 'success' ? 'bg-[#1D4ED8]/10 text-[#1D4ED8] animate-[bounce_1s_infinite]' : 'bg-red-50 text-red-500'}`}><span className="text-2xl font-black">{customAlert.type === 'success' ? '✓' : '✕'}</span></div>
            <h3 className="text-xl font-black text-[#1D4ED8] mb-2">{customAlert.title}</h3>
            <p className="text-xs text-slate-500 mb-6 leading-relaxed font-medium">{customAlert.message}</p>
            <button onClick={() => setCustomAlert(null)} className="w-full h-12 bg-[#1D4ED8] text-white font-bold rounded-xl active:scale-95 transition shadow-sm text-xs flex items-center justify-center">הבנתי</button>
          </div>
        </div>
      )}
    </div>
  );
}

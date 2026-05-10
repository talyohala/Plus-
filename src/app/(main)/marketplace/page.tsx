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
  apartment?: string;
}

const mainCategories = ['הכל', 'למכירה', 'למסירה'];
const secondaryCategories = ['בקשות שכנים', 'שמורים'];

const smartCategoriesMap = [
  { tag: 'רהיטים', keywords: ['ארון', 'שולחן', 'מיטה', 'ספה', 'כיסא', 'שידה', 'כורסא', 'רהיט', 'מזנון', 'מדפים', 'כוורת', 'ויטרינה', 'סלון', 'פינת אוכל', 'מזרן'] },
  { tag: 'אלקטרוניקה', keywords: ['מחשב', 'טלוויזיה', 'מטען', 'אייפון', 'סמארטפון', 'רמקול', 'אוזניות', 'מסך', 'פלאפון', 'אייפד', 'טאבלט', 'מקלדת', 'עכבר', 'לפטופ', 'נייד', 'מצלמה', 'שואב', 'מקרן'] },
  { tag: 'לבית', keywords: ['מקרר', 'מכונת כביסה', 'מיקרוגל', 'תנור', 'מזגן', 'סיר', 'צלחות', 'כוסות', 'שטיח', 'תמונה', 'מדיח', 'מייבש', 'קומקום', 'טוסטר', 'בלנדר'] },
  { tag: 'ילדים', keywords: ['עגלה', 'משחק', 'לול', 'תינוק', 'ילדים', 'צעצוע', 'סלקל', 'בגדי ילדים', 'מיטת מעבר', 'טיולון', 'טרמפולינה', 'מובייל', 'פאזל', 'לגו'] },
  { tag: 'ספורט', keywords: ['אופניים', 'הליכון', 'משקולות', 'כדור', 'יוגה', 'ספורט', 'טניס', 'כושר', 'קורקינט', 'קסדה', 'גלגיליות', 'סקייטבורד'] },
  { tag: 'חיות מחמד', keywords: ['כלב', 'חתול', 'אוכל לכלבים', 'רצועה', 'כלוב', 'אקווריום', 'חיות', 'חול לחתולים', 'מיטה לכלב', 'קולר', 'צעצוע לכלב'] },
  { tag: 'כלי עבודה', keywords: ['מקדחה', 'סולם', 'מברגה', 'פטיש', 'ברגים', 'ארגז כלים', 'כבלים', 'כבל מרים', 'פלאייר', 'מפתח שוודי', 'דיסק', 'מסור'] },
  { tag: 'אופנה', keywords: ['בגדים', 'שמלה', 'חולצה', 'מכנסיים', 'נעליים', 'תיק', 'מעיל', 'גקט', 'חצאית', 'סוודר', 'כובע', 'תכשיט', 'שעון'] },
  { tag: 'לימודים', keywords: ['ספר', 'מחברת', 'קורס', 'פסיכומטרי', 'לימודים', 'סטודנט', 'ילקוט', 'קלמר', 'רומן', 'ספר קריאה'] }
];

export default function MarketplacePage() {
  const [profile, setProfile] = useState<MarketplaceUser | null>(null);
  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [savedItemsIds, setSavedItemsIds] = useState<Set<string>>(new Set());
  const [activeCategory, setActiveCategory] = useState('הכל');
  const [searchQuery, setSearchQuery] = useState('');

  // States למודלים ופעולות
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fullScreenMedia, setFullScreenMedia] = useState<{ url: string; type: string } | null>(null);
  
  // States לעריכה מובנית
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [editItemData, setEditItemData] = useState({ title: '', description: '', price: '', contact_phone: '', category: 'למכירה' });

  // חיווי למשתמש מתקדם
  const [customAlert, setCustomAlert] = useState<{ title: string; message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [customConfirm, setCustomConfirm] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

  const isAdmin = profile?.role === 'admin';

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

  // האזנה יציבה ל-Realtime של לוח המודעות
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

  // לוגיקת פעולות CRUD
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
      const { data: neighbors } = await supabase.from('profiles').select('id').eq('building_id', profile.building_id).neq('id', profile.id);
      if (neighbors && neighbors.length > 0) {
        const notifs = neighbors.map(n => ({
          receiver_id: n.id,
          sender_id: profile.id,
          type: 'marketplace',
          title: postData.category === 'למסירה' ? 'משהו למסירה בחינם! 🎁' : 'פריט חדש בלוח מודעות 🛍️',
          content: `${profile.full_name} פרסם/ה: ${postData.title}`,
          link: '/marketplace'
        }));
        await supabase.from('notifications').insert(notifs);
      }
      playSystemSound('notification');
      setIsModalOpen(false);
      fetchData(profile.id);
      setCustomAlert({ title: 'פורסם בהצלחה!', message: 'המודעה שלך נוספה ללוח הבניין.', type: 'success' });
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
      const { data: neighbors } = await supabase.from('profiles').select('id').eq('building_id', profile.building_id).neq('id', profile.id);
      if (neighbors && neighbors.length > 0) {
        const notifs = neighbors.map(n => ({
          receiver_id: n.id, sender_id: profile.id, type: 'marketplace',
          title: 'בקשת שכן חדשה 🤝', content: `${profile.full_name} זקוק/ה לעזרה: ${title}`, link: '/marketplace'
        }));
        await supabase.from('notifications').insert(notifs);
      }
      playSystemSound('notification');
      setIsRequestModalOpen(false);
      fetchData(profile.id);
      setCustomAlert({ title: 'הבקשה נשלחה!', message: 'כל דיירי הבניין קיבלו עכשיו התראה ויעזרו לך.', type: 'success' });
    }
    setIsSubmitting(false);
  };

  const handleInlineEditSubmit = async (e: React.FormEvent, id: string) => {
    e.preventDefault();
    setIsSubmitting(true);
    const parsedPrice = editItemData.category === 'למסירה' || editItemData.category === 'בקשות שכנים' ? 0 : parseFloat(editItemData.price) || 0;
    
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

  const handleDelete = (id: string) => {
    setCustomConfirm({
      title: 'מחיקת מודעה',
      message: 'האם למחוק מודעה זו לתמיד מלוח הבניין?',
      onConfirm: async () => {
        await supabase.from('marketplace_items').delete().eq('id', id);
        setOpenMenuId(null);
        if (profile) fetchData(profile.id);
        playSystemSound('click');
        setCustomConfirm(null);
      }
    });
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
      setCustomAlert({ title: 'אופס!', message: 'לשכן זה לא מעודכן מספר טלפון באפליקציה.', type: 'error' });
      return;
    }
    playSystemSound('click');
    const aptText = profile?.apartment ? `מדירה ${profile.apartment}` : '';
    const text = encodeURIComponent(`היי ${item.profiles?.full_name?.split(' ')[0] || ''}, לגבי הבקשה שלך בשכן+ ("${item.title}") -\n*${replyType}* ✨\n\n(מוזמן/ת אליי ${aptText})`);
    let clean = item.contact_phone.replace(/\D/g, '');
    if (clean.startsWith('0')) clean = '972' + clean.slice(1);
    window.open(`https://wa.me/${clean}?text=${text}`, '_blank');
  };

  const dynamicTags = useMemo(() => {
    const tags = new Set<string>();
    items.forEach(item => {
      const text = (item.title + ' ' + (item.description || '')).toLowerCase();
      smartCategoriesMap.forEach(cat => {
        if (cat.keywords.some(kw => text.includes(kw))) tags.add(cat.tag);
      });
    });
    const tagArray = Array.from(tags);
    return tagArray.length === 0 ? ['למסירה', 'בקשות שכנים'] : tagArray.slice(0, 10);
  }, [items]);

  const filteredItems = useMemo(() => {
    const matchedSmartTag = smartCategoriesMap.find(c => c.tag === searchQuery);
    return items.filter(item => {
      const isSaved = savedItemsIds.has(item.id);
      if (activeCategory === 'שמורים' && !isSaved) return false;

      const matchesFilter = activeCategory === 'הכל' || activeCategory === 'שמורים' || item.category === activeCategory;
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
    <div className="flex flex-col flex-1 w-full pb-28 relative bg-transparent" dir="rtl">
      <div className="px-4 mt-6 mb-5 flex items-center justify-between">
        <h2 className="text-2xl font-black text-slate-800 drop-shadow-sm">לוח מודעות</h2>
      </div>

      {/* שורת חיפוש */}
      <div className="px-4 mb-5">
        <div className="relative">
          <input
            type="text"
            placeholder="חיפוש מודעה, חפץ או שכנים..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/90 backdrop-blur-sm border border-white rounded-[1.2rem] py-3.5 pr-4 pl-12 text-sm shadow-sm outline-none text-slate-800 focus:border-purple-300 transition placeholder:text-slate-400"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute inset-y-0 left-0 w-12 h-12 flex items-center justify-center text-slate-400 hover:text-slate-600 transition">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          )}
        </div>
      </div>

      {/* תגיות מהירות */}
      {dynamicTags.length > 0 && (
        <div className="px-4 mb-6">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2.5">מוצרים פופולריים בבניין:</p>
          <div className="flex flex-wrap gap-2">
            {dynamicTags.map(tag => (
              <button key={tag} onClick={() => setSearchQuery(tag)} className="bg-white/60 backdrop-blur-sm text-slate-700 px-3 py-1.5 rounded-full text-[11px] font-bold hover:bg-white transition border border-white shadow-sm">
                {tag}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* טאבים ראשיים */}
      <div className="px-4 mb-3">
        <div className="flex bg-white/60 backdrop-blur-md p-1.5 rounded-full border border-white shadow-sm relative z-10 overflow-x-auto hide-scrollbar">
          {mainCategories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`flex-1 min-w-[80px] h-10 px-4 rounded-full text-xs transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${activeCategory === cat ? 'text-purple-600 font-black bg-purple-600/10 shadow-sm border border-purple-600/20' : 'text-slate-500 font-bold hover:text-purple-600/70'}`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* טאבים משניים */}
      <div className="px-4 mb-6">
        <div className="flex bg-white/60 backdrop-blur-md p-1.5 rounded-full border border-white shadow-sm relative z-10 w-max overflow-x-auto hide-scrollbar max-w-full">
          {secondaryCategories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`h-9 px-5 rounded-full text-[11px] transition-all flex items-center gap-1.5 whitespace-nowrap ${activeCategory === cat ? 'text-purple-600 font-black bg-purple-600/10 shadow-sm border border-purple-600/20' : 'text-slate-500 font-bold hover:text-purple-600/70'}`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* רשימת המודעות */}
      <div className="space-y-4 px-4 animate-in fade-in duration-300 relative">
        {filteredItems.length === 0 ? (
          <div className="text-center py-12 bg-white/50 backdrop-blur-sm rounded-3xl border border-white/50 shadow-sm">
            <p className="text-slate-500 font-bold">לא מצאנו תוצאות 🧐</p>
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
              mainCategories={mainCategories}
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

      {/* כפתורי פרסום (FAB) משודרגים 48x48 */}
      {activeCategory === 'בקשות שכנים' ? (
        <button onClick={() => setIsRequestModalOpen(true)} className="fixed bottom-24 left-6 z-50 bg-white/90 backdrop-blur-md border border-white text-slate-800 pl-4 pr-1.5 py-1.5 rounded-full shadow-[0_8px_30px_rgba(16,185,129,0.25)] hover:scale-105 active:scale-95 transition flex items-center gap-3 group flex-row-reverse">
          <div className="bg-emerald-500 text-white w-12 h-12 flex items-center justify-center rounded-full shadow-sm">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" /></svg>
          </div>
          <span className="font-black text-sm text-emerald-600">בקשת שכן</span>
        </button>
      ) : (
        <button onClick={() => setIsModalOpen(true)} className="fixed bottom-24 left-6 z-50 bg-white/90 backdrop-blur-md border border-white text-slate-800 pl-4 pr-1.5 py-1.5 rounded-full shadow-[0_10px_40px_rgba(147,51,234,0.25)] hover:scale-105 active:scale-95 transition flex items-center gap-3 group flex-row-reverse">
          <div className="bg-purple-600 text-white w-12 h-12 flex items-center justify-center rounded-full shadow-sm">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg>
          </div>
          <span className="font-black text-sm text-purple-600">פרסם מודעה</span>
        </button>
      )}

      {/* מודלים של יצירה */}
      {isRequestModalOpen && (
        <CreateMarketplaceItemModal
          type="request"
          mainCategories={mainCategories}
          defaultPhone={profile?.phone || ''}
          isSubmitting={isSubmitting}
          onClose={() => setIsRequestModalOpen(false)}
          onSubmitPost={async () => {}}
          onSubmitRequest={handleAddRequest}
        />
      )}

      {isModalOpen && (
        <CreateMarketplaceItemModal
          type="post"
          mainCategories={mainCategories}
          defaultPhone={profile?.phone || ''}
          isSubmitting={isSubmitting}
          onClose={() => setIsModalOpen(false)}
          onSubmitPost={handleAddPost}
          onSubmitRequest={async () => {}}
        />
      )}

      {/* מסך מלא למדיה מוגדל נגישות */}
      {fullScreenMedia && (
        <div className="fixed inset-0 z-[150] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in cursor-pointer" onClick={() => setFullScreenMedia(null)}>
          <button className="absolute top-6 left-6 w-12 h-12 flex items-center justify-center text-white bg-white/10 hover:bg-white/20 rounded-full transition z-10">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
          {fullScreenMedia.type === 'video' ? (
            <video src={fullScreenMedia.url} controls autoPlay className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()} />
          ) : (
            <img src={fullScreenMedia.url} alt="Fullscreen" className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()} />
          )}
        </div>
      )}

      {/* התראות ומודלים בעיצוב פרימיום חדש */}
      {customAlert && (
        <div className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-white/95 backdrop-blur-xl rounded-[2rem] p-6 w-full max-w-sm shadow-2xl text-center animate-in zoom-in-95 border border-white/50">
            <div className={`w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center shadow-lg ${customAlert.type === 'success' ? 'bg-[#10B981]/10 text-[#10B981] animate-[bounce_1s_infinite]' : customAlert.type === 'info' ? 'bg-purple-50 text-purple-600' : 'bg-red-50 text-red-500'}`}>
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

      {customConfirm && (
        <div className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-white/95 backdrop-blur-xl rounded-[2rem] p-6 w-full max-w-sm shadow-2xl text-center animate-in zoom-in-95 border border-white/50">
            <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center bg-purple-50 text-purple-600 shadow-sm">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77-1.333.192 3 1.732 3z"></path></svg>
            </div>
            <h3 className="text-xl font-black text-slate-800 mb-2">{customConfirm.title}</h3>
            <p className="text-sm text-slate-500 mb-6 leading-relaxed">{customConfirm.message}</p>
            <div className="flex gap-3">
              <button onClick={() => setCustomConfirm(null)} className="flex-1 h-14 bg-white text-slate-600 font-bold rounded-xl hover:bg-gray-50 transition active:scale-95 border border-gray-200 shadow-sm text-base">ביטול</button>
              <button onClick={customConfirm.onConfirm} className="flex-1 h-14 bg-purple-600 text-white font-bold rounded-xl transition shadow-sm active:scale-95 text-base">אישור</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

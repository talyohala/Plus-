import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../lib/supabase';
import { playSystemSound } from '../providers/AppManager';

export interface MarketplaceItem {
  id: string;
  title: string;
  description?: string;
  price: number;
  category: string;
  contact_phone: string;
  media_url?: string;
  media_type?: string;
  is_pinned: boolean;
  created_at: string;
  user_id: string;
  profiles?: {
    full_name: string;
    avatar_url?: string;
    apartment?: string;
    floor?: string;
    role?: string;
  };
}

interface MarketplaceItemCardProps {
  item: MarketplaceItem;
  currentUserId?: string;
  isAdmin: boolean;
  isSaved: boolean;
  openMenuId: string | null;
  editingItemId: string | null;
  editItemData: { title: string; description: string; price: string; contact_phone: string; category: string };
  mainCategories: string[];
  isSubmitting: boolean;
  onToggleMenu: (id: string | null) => void;
  onToggleSave: (e: React.MouseEvent, id: string, isSaved: boolean) => void;
  onTogglePin: (id: string, currentStatus: boolean) => void;
  onStartEdit: (item: MarketplaceItem) => void;
  onCancelEdit: () => void;
  onUpdateEditData: (data: { title: string; description: string; price: string; contact_phone: string; category: string }) => void;
  onSubmitEdit: (e: React.FormEvent, id: string) => void;
  onDelete: (id: string) => void;
  onMediaClick: (url: string, type: string) => void;
  onCommentSuccess?: () => void;
  formatWhatsApp: (phone: string) => string;
  timeFormat: (dateStr: string) => string;
}

export default function MarketplaceItemCard({
  item, currentUserId, isAdmin, isSaved, openMenuId, editingItemId, editItemData, mainCategories, isSubmitting,
  onToggleMenu, onToggleSave, onTogglePin, onStartEdit, onCancelEdit, onUpdateEditData, onSubmitEdit, onDelete, onMediaClick, formatWhatsApp, timeFormat,
}: MarketplaceItemCardProps) {
  const [comments, setComments] = useState<any[]>([]);
  const [customNote, setCustomNote] = useState('');
  const [customAlert, setCustomAlert] = useState<{ title: string; message: string } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const isOwner = currentUserId === item.user_id;
  const isPackage = item.category === 'חבילות ודואר';
  const isRequest = item.category === 'בקשות שכנים' || item.category === 'השאלות כלים';

  const tenantReplies = isPackage ? ['אני ארד לאסוף! 🏃‍♂️', 'תודה, אספתי! 🙏', 'זה שלי, תודה ✨'] : ['יש לי, מוזמן/ת! 👍', 'בוא/י לקחת באהבה 🎁', 'תודה, הצלת אותי! 🙏'];
  const ownerReplies = ['בבקשה באהבה! ❤️', 'שמחתי לעזור ✨', 'בכיף, בשמחה! 🌸'];

  let catBg = 'bg-[#10B981]'; 
  if (item.category === 'בקשות שכנים' || item.category === 'השאלות כלים') catBg = 'bg-emerald-500';
  if (item.category === 'חבילות ודואר') catBg = 'bg-[#1D4ED8]';
  if (item.category === 'למכירה') catBg = 'bg-amber-500';

  const isOpen = openMenuId === item.id;

  const fetchComments = useCallback(async () => {
    try {
      const { data } = await supabase.from('marketplace_comments').select('*, profiles(full_name, avatar_url)').eq('item_id', item.id).order('created_at', { ascending: true });
      if (data) setComments(data);
    } catch (e) { console.error(e); }
  }, [item.id]);

  useEffect(() => { fetchComments(); }, [fetchComments]);

  const handleAddComment = async (text: string) => {
    if (!currentUserId) return;
    playSystemSound('click');
    const { error } = await supabase.from('marketplace_comments').insert([{ item_id: item.id, user_id: currentUserId, content: text }]);
    if (!error) {
      const { data: senderProfile } = await supabase.from('profiles').select('full_name').eq('id', currentUserId).single();
      const senderName = senderProfile?.full_name || 'שכן';
      if (!isOwner) {
        await supabase.from('notifications').insert([{ receiver_id: item.user_id, sender_id: currentUserId, type: 'marketplace', title: `תגובה מ${senderName} 🤝`, content: `לגבי "${item.title}": ${text}`, link: '/marketplace', is_read: false }]);
      } else {
        const otherUserIds = [...new Set(comments.filter(c => c.user_id !== currentUserId).map(c => c.user_id))];
        if (otherUserIds.length > 0) {
          const notifs = otherUserIds.map(uid => ({ receiver_id: uid, sender_id: currentUserId, type: 'marketplace', title: `מפרסם המודעה הגיב לך 💬`, content: `לגבי "${item.title}": ${text}`, link: '/marketplace', is_read: false }));
          await supabase.from('notifications').insert(notifs);
        }
      }
      fetchComments();
      playSystemSound('notification');
      setCustomAlert({ title: 'תגובה נשלחה!', message: 'הודעתך עודכנה ישירות על המודעה והשכן קיבל התראה.' });
    }
  };

  const modalContent = customAlert ? (
    <div className="fixed inset-0 z-[99999] bg-black/40 backdrop-blur-sm flex justify-center items-center p-4" onClick={() => setCustomAlert(null)} dir="rtl">
      <div className="bg-white rounded-[2rem] p-6 w-full max-w-sm shadow-2xl text-center border border-white/50 animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
        <div className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center bg-[#059669]/10 text-[#059669] shadow-sm animate-[bounce_1s_infinite]">
          <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
        </div>
        <h3 className="text-2xl font-black text-slate-800 mb-2">{customAlert.title}</h3>
        <p className="text-base text-slate-500 mb-6 leading-relaxed font-medium">{customAlert.message}</p>
        <button onClick={() => setCustomAlert(null)} className="w-full h-14 bg-[#1E293B] hover:bg-slate-800 text-white font-bold rounded-xl active:scale-95 transition shadow-md text-lg">סגירה</button>
      </div>
    </div>
  ) : null;

  return (
    <div className={`bg-white/90 backdrop-blur-xl p-4 pt-7 rounded-[1.5rem] shadow-[0_4px_20px_rgba(29,78,216,0.03)] border transition-all relative ${item.is_pinned ? 'border-[#1D4ED8]/40 shadow-[0_0_20px_rgba(29,78,216,0.1)] bg-white/95' : 'border-[#1D4ED8]/10'} ${isOpen ? 'z-[100]' : 'z-10'}`} dir="rtl">
      
      {mounted && customAlert && createPortal(modalContent, document.body)}

      <div className="absolute top-0 right-0 flex overflow-hidden rounded-bl-[1.5rem] rounded-tr-[1.5rem] shadow-sm z-10 border-b border-l border-white/20">
        <div className={`px-4 py-1.5 text-white text-[10px] font-black ${catBg}`}>
          {item.category}
        </div>
        {item.is_pinned && (
          <div className="px-3 py-1.5 bg-rose-50 text-rose-600 text-[10px] font-black border-r border-rose-100/50">
            📌 נעוץ
          </div>
        )}
      </div>

      <div className="absolute top-2 left-2 z-50 flex items-center gap-1.5">
        {isSaved && (
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-rose-500 animate-in zoom-in-95 shrink-0 drop-shadow-sm">
            <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
          </svg>
        )}
        <button onClick={(e) => { e.stopPropagation(); onToggleMenu(isOpen ? null : item.id); }} className="w-8 h-8 flex items-center justify-center transition hover:scale-110 text-slate-400 hover:text-[#1D4ED8] relative z-10">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" /></svg>
        </button>

        {isOpen && (
          <div className="absolute left-0 top-8 w-48 bg-white/95 backdrop-blur-xl border border-[#1D4ED8]/20 shadow-[0_10px_40px_rgba(0,0,0,0.15)] rounded-2xl z-[150] overflow-hidden py-1">
            <button onClick={(e) => { onToggleSave(e, item.id, isSaved); }} className="w-full text-right px-4 py-3 text-xs font-bold text-slate-700 hover:bg-[#1D4ED8]/5 flex items-center gap-2.5 border-b border-slate-50">
              <span className={`text-base leading-none ${isSaved ? 'text-rose-500' : 'text-slate-400'}`}>{isSaved ? '♥' : '♡'}</span>
              <span>{isSaved ? 'הסר משמירות' : 'שמור למועדפים'}</span>
            </button>
            {isAdmin && (
              <button onClick={() => { onTogglePin(item.id, item.is_pinned); }} className="w-full text-right px-4 py-3 text-xs font-bold text-[#1D4ED8] hover:bg-[#1D4ED8]/5 flex items-center gap-2.5 border-t border-slate-50">
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h-8a1 1 0 0 0-1 1v5l-1.5 3.5h11l-1.5-3.5v-5a1 1 0 0 0-1-1z" /><path d="M12 14v7" /></svg>
                <span>{item.is_pinned ? 'בטל נעיצה' : 'נעץ פריט'}</span>
              </button>
            )}
            {isOwner && (
              <button onClick={() => { onStartEdit(item); }} className="w-full text-right px-4 py-3 text-xs font-bold text-slate-700 hover:bg-[#1D4ED8]/5 flex items-center gap-2.5 border-t border-slate-50">
                <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.536L16.732 3.732z" /></svg>
                <span>ערוך מודעה</span>
              </button>
            )}
            {(isOwner || isAdmin) && (
              <button onClick={() => { onDelete(item.id); }} className="w-full text-right px-4 py-3 text-xs font-bold text-red-500 hover:bg-red-50 flex items-center gap-2.5 border-t border-slate-50">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                <span>מחק לצמיתות</span>
              </button>
            )}
          </div>
        )}
      </div>

      {editingItemId === item.id ? (
        <form onSubmit={(e) => onSubmitEdit(e, item.id)} className="p-3 flex flex-col gap-3 bg-[#1D4ED8]/5 rounded-2xl mt-5 border border-[#1D4ED8]/10">
          <input type="text" required value={editItemData.title} onChange={(e) => onUpdateEditData({ ...editItemData, title: e.target.value })} className="w-full bg-white border border-[#1D4ED8]/20 rounded-xl px-3 py-2.5 text-xs font-bold outline-none focus:border-[#1D4ED8] shadow-sm text-slate-800" placeholder="כותרת" />
          <div className="flex gap-2">
            <select value={editItemData.category} onChange={(e) => onUpdateEditData({ ...editItemData, category: e.target.value })} className="flex-1 bg-white border border-[#1D4ED8]/20 rounded-xl px-2 py-2.5 text-xs font-bold outline-none shadow-sm text-slate-800">
              {mainCategories.filter(c => c !== 'הכל' && c !== 'שמורים').map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            {editItemData.category !== 'בקשות שכנים' && editItemData.category !== 'למסירה' && editItemData.category !== 'חבילות ודואר' && (
              <input type="number" value={editItemData.price} onChange={(e) => onUpdateEditData({ ...editItemData, price: e.target.value })} className="flex-1 bg-white border border-[#1D4ED8]/20 rounded-xl px-2 py-2.5 text-xs outline-none shadow-sm text-slate-800" placeholder="מחיר" />
            )}
          </div>
          <input type="tel" required value={editItemData.contact_phone} onChange={(e) => onUpdateEditData({ ...editItemData, contact_phone: e.target.value })} className="w-full bg-white border border-[#1D4ED8]/20 rounded-xl px-3 py-2.5 text-xs font-mono outline-none text-left shadow-sm text-slate-800" dir="ltr" placeholder="050-0000000" />
          <textarea value={editItemData.description} onChange={(e) => onUpdateEditData({ ...editItemData, description: e.target.value })} className="w-full bg-white border border-[#1D4ED8]/20 rounded-xl px-3 py-2.5 text-xs font-medium outline-none min-h-[60px] shadow-sm text-slate-800 resize-none" placeholder="תיאור" />
          <div className="flex justify-end gap-2 mt-1">
            <button type="button" onClick={onCancelEdit} className="flex-1 h-10 flex items-center justify-center text-xs font-bold text-slate-500 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition shadow-sm">ביטול</button>
            <button type="submit" disabled={isSubmitting} className="flex-1 h-10 flex items-center justify-center text-xs font-bold text-white bg-[#1D4ED8] rounded-xl shadow-sm active:scale-95 transition">שמירה</button>
          </div>
        </form>
      ) : (
        <>
          <div className="flex gap-3 min-h-[70px] relative mt-4">
            {item.media_url && (
              <div onClick={() => onMediaClick(item.media_url!, item.media_type || 'image')} className="w-[80px] h-[85px] rounded-2xl bg-slate-50 shrink-0 border border-[#1D4ED8]/10 overflow-hidden cursor-pointer relative shadow-sm">
                {item.media_type === 'video' ? (
                  <><video src={item.media_url} className="w-full h-full object-cover" /><div className="absolute inset-0 flex items-center justify-center bg-black/20"><span className="text-white text-xs font-bold">▶️</span></div></>
                ) : (<img src={item.media_url} alt="מודעה" className="w-full h-full object-cover" />)}
              </div>
            )}

            <div className="flex-1 py-0.5 flex flex-col pl-1 text-right">
              <div className="flex items-center gap-2 mb-1 justify-between">
                <h3 className="font-black text-xs text-slate-800 tracking-tight leading-snug line-clamp-1">{item.title}</h3>
                {item.price > 0 && item.category !== 'חבילות ודואר' && item.category !== 'למסירה' && (
                  <span className="text-[11px] font-black text-[#1D4ED8] shrink-0">₪{item.price.toLocaleString()}</span>
                )}
              </div>
              <p className="text-[11px] font-medium leading-relaxed tracking-wide text-slate-600 line-clamp-2 mt-0.5">{item.description}</p>
              
              <div className="mt-auto pt-3 border-t border-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-slate-600 min-w-0">
                  <img src={item.profiles?.avatar_url || `https://api.dicebear.com/8.x/initials/svg?seed=${item.profiles?.full_name || 'U'}&backgroundColor=EFF6FF&textColor=1D4ED8`} className="w-5 h-5 rounded-full border border-gray-100 shadow-sm object-cover shrink-0" alt="avatar" />
                  <div className="flex flex-col text-right truncate">
                    <span className="text-[11px] font-bold text-slate-800 leading-tight truncate">{item.profiles?.full_name || 'שכן'}</span>
                    <div className="flex items-center gap-1 text-[9px] text-slate-400 font-medium">
                      {item.profiles?.apartment && <span>דירה {item.profiles.apartment}</span>}
                      <span>•</span><span>{timeFormat(item.created_at)}</span>
                    </div>
                  </div>
                </div>

                {!isOwner && item.contact_phone && (
                  <div className="flex items-center gap-1.5 shrink-0 pl-0.5">
                    <a href={`tel:${item.contact_phone}`} onClick={(e) => e.stopPropagation()} className="w-8 h-8 rounded-full bg-[#1D4ED8] text-white hover:opacity-90 transition active:scale-95 flex items-center justify-center shadow-xs" title="חייג לשכן">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                    </a>
                    <a href={formatWhatsApp(item.contact_phone)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="w-8 h-8 rounded-full bg-[#25D366] text-white hover:opacity-90 transition active:scale-95 flex items-center justify-center shadow-xs" title="שלח וואטסאפ">
                      <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.305-.883-.653-1.48-1.459-1.653-1.758-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.413z"/></svg>
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-50/80">
            {comments.length > 0 && (
              <div className="space-y-1.5 mb-2.5 max-h-32 overflow-y-auto hide-scrollbar pr-0.5">
                {comments.map(c => (
                  <div key={c.id} className="flex items-start gap-1.5 bg-[#1D4ED8]/5 p-2 rounded-xl text-right">
                    <img src={c.profiles?.avatar_url || `https://api.dicebear.com/8.x/initials/svg?seed=${c.profiles?.full_name}`} className="w-4 h-4 rounded-full object-cover mt-0.5 shrink-0 border border-white" />
                    <div className="flex-1 min-w-0 leading-tight">
                      <span className="text-[10px] font-black text-[#1D4ED8] ml-1">{c.profiles?.full_name}:</span>
                      <span className="text-[11px] text-slate-700 font-medium">{c.content}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {(isPackage || isRequest || isOwner) && (
              <div className="flex gap-1.5 overflow-x-auto hide-scrollbar pb-1 mb-2">
                {(isOwner ? ownerReplies : tenantReplies).map((reply, idx) => (
                  <button 
                    key={idx} 
                    onClick={() => handleAddComment(reply)} 
                    className="h-7 px-2.5 bg-white hover:bg-[#1D4ED8]/5 text-[#1D4ED8] border border-[#1D4ED8]/15 rounded-lg text-[10px] font-bold shrink-0 transition active:scale-95 shadow-xs"
                  >
                    {reply}
                  </button>
                ))}
              </div>
            )}

            <form onSubmit={(e) => { e.preventDefault(); if(customNote.trim()) { handleAddComment(customNote.trim()); setCustomNote(''); } }} className="flex items-center gap-1 bg-white border border-slate-150 rounded-xl px-2.5 py-1 shadow-xs">
              <input 
                type="text" 
                value={customNote} 
                onChange={e => setCustomNote(e.target.value)} 
                placeholder={isOwner ? "השב לשכן..." : "כתוב הערה קטנה על המודעה..."} 
                className="flex-1 bg-transparent text-[11px] outline-none font-medium text-slate-800 placeholder-slate-400" 
              />
              <button type="submit" disabled={!customNote.trim()} className="text-[#1D4ED8] disabled:opacity-30 p-1 active:scale-95 transition">
                <svg className="w-3.5 h-3.5 transform -rotate-45" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}

import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../lib/supabase';
import { playSystemSound } from '../providers/AppManager';
import { WhatsAppIcon, EditIcon, DeleteIcon, PinIcon } from '../ui/ActionIcons';

export interface MarketplaceItem {
  id: string; title: string; description?: string; price: number; category: string;
  contact_phone: string; media_url?: string; media_type?: string; is_pinned: boolean;
  created_at: string; user_id: string;
  profiles?: { full_name: string; avatar_url?: string; apartment?: string; floor?: string; role?: string; };
}

interface MarketplaceItemCardProps {
  item: MarketplaceItem; currentUserId?: string; isAdmin: boolean; isSaved: boolean;
  openMenuId: string | null; editingItemId: string | null; editItemData: any; mainCategories: string[]; isSubmitting: boolean;
  onToggleMenu: (id: string | null) => void;
  onToggleSave: (e: React.MouseEvent, id: string, isSaved: boolean) => void;
  onTogglePin: (id: string, currentStatus: boolean) => void;
  onStartEdit: (item: MarketplaceItem) => void; onCancelEdit: () => void;
  onUpdateEditData: (data: any) => void; onSubmitEdit: (e: React.FormEvent, id: string) => void;
  onDelete: (id: string) => void; onMediaClick: (url: string, type: string) => void;
  formatWhatsApp: (phone: string) => string; timeFormat: (dateStr: string) => string;
}

export default function MarketplaceItemCard({ item, currentUserId, isAdmin, isSaved, openMenuId, editingItemId, editItemData, mainCategories, isSubmitting, onToggleMenu, onToggleSave, onTogglePin, onStartEdit, onCancelEdit, onUpdateEditData, onSubmitEdit, onDelete, onMediaClick, formatWhatsApp, timeFormat }: MarketplaceItemCardProps) {
  const [comments, setComments] = useState<any[]>([]);
  const [customNote, setCustomNote] = useState('');
  const [customAlert, setCustomAlert] = useState<{ title: string; message: string } | null>(null);
  const [mounted, setMounted] = useState(false);

  const isOwner = currentUserId === item.user_id;
  const isOpen = openMenuId === item.id;
  
  const isPackage = item.category === 'חבילות ודואר';
  const isRequest = item.category === 'בקשות שכנים' || item.category === 'השאלות כלים';

  const tenantReplies = isPackage ? ['אני ארד לאסוף! 🏃‍♂️', 'תודה, אספתי! 🙏', 'זה שלי, תודה ✨'] : ['יש לי, מוזמן/ת! 👍', 'בוא/י לקחת באהבה 🎁', 'תודה, הצלת אותי! 🙏'];
  const ownerReplies = ['בבקשה באהבה! ❤️', 'שמחתי לעזור ✨', 'בכיף, בשמחה! 🌸'];

  useEffect(() => { setMounted(true); }, []);

  const fetchComments = useCallback(async () => {
    const { data } = await supabase.from('marketplace_comments').select('*, profiles(full_name, avatar_url)').eq('item_id', item.id).order('created_at', { ascending: true });
    if (data) setComments(data);
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
      fetchComments(); playSystemSound('notification');
      setCustomAlert({ title: 'תגובה נשלחה!', message: 'הודעתך עודכנה ישירות על המודעה והשכן קיבל התראה.' });
      setCustomNote('');
    }
  };

  const modalContent = customAlert ? (
    <div className="fixed inset-0 z-[99999] bg-black/40 backdrop-blur-sm flex justify-center items-center p-4" onClick={() => setCustomAlert(null)} dir="rtl">
      <div className="bg-white rounded-[2rem] p-6 w-full max-w-sm shadow-2xl text-center border border-white/50 animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
        <div className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center bg-[#059669]/10 text-[#059669] shadow-sm animate-[bounce_1s_infinite]">
          <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
        </div>
        <h3 className="text-2xl font-black text-slate-800 mb-2">{customAlert.title}</h3>
        <p className="text-base text-slate-500 mb-6 font-medium">{customAlert.message}</p>
        <button onClick={() => setCustomAlert(null)} className="w-full h-14 bg-[#1E293B] hover:bg-slate-800 text-white font-bold rounded-xl active:scale-95 transition shadow-md text-lg">סגירה</button>
      </div>
    </div>
  ) : null;

  return (
    <div className={`backdrop-blur-xl p-4 rounded-[2rem] border relative overflow-hidden transition-all duration-300 ${item.is_pinned ? 'bg-gradient-to-br from-orange-50/80 to-white border-orange-200/60 shadow-[0_8px_20px_rgba(249,115,22,0.15)]' : 'bg-white/90 border-slate-100 shadow-sm'} ${isOpen ? 'z-50' : 'z-10'}`}>
      {mounted && customAlert && createPortal(modalContent, document.body)}

      <div className="absolute top-0 right-0 flex overflow-hidden rounded-bl-[1.5rem] rounded-tr-[2rem] z-10 shadow-sm">
        {item.is_pinned ? (
          <div className="px-5 py-1.5 bg-[#F59E0B] text-white text-[11px] font-black uppercase tracking-wider">נעוץ</div>
        ) : (
          <div className="px-4 py-1.5 bg-[#1D4ED8] text-white text-[10px] font-black shadow-sm">{item.category}</div>
        )}
      </div>

      <div className="absolute top-3 left-3 z-50 flex items-center gap-1.5">
        {isSaved && (
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-rose-500 animate-in zoom-in-95 shrink-0 drop-shadow-sm">
            <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
          </svg>
        )}
        <button onClick={(e) => { e.stopPropagation(); onToggleMenu(isOpen ? null : item.id); }} className="w-8 h-8 flex items-center justify-center transition hover:scale-110 text-slate-400 hover:text-[#1D4ED8] bg-white/50 border border-slate-100 rounded-full shadow-sm">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" /></svg>
        </button>

        {isOpen && (
          <div className="absolute left-0 top-10 w-44 bg-white/95 backdrop-blur-xl border border-slate-100 shadow-[0_15px_50px_rgba(0,0,0,0.15)] rounded-2xl z-[150] py-2 overflow-hidden">
            <button onClick={(e) => onToggleSave(e, item.id, isSaved)} className="w-full text-right px-4 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" fill={isSaved ? "currentColor" : "none"} viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className={`w-4 h-4 shrink-0 ${isSaved ? 'text-rose-500' : 'text-slate-400'}`}><path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" /></svg>
              <span>{isSaved ? 'הסר משמירות' : 'שמור למועדפים'}</span>
            </button>
            {isAdmin && (
              <button onClick={() => onTogglePin(item.id, item.is_pinned)} className="w-full text-right px-4 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2 border-t border-slate-50">
                <PinIcon className="w-4 h-4 text-[#F59E0B]" />
                <span>{item.is_pinned ? 'בטל נעיצה' : 'נעץ הודעה'}</span>
              </button>
            )}
            {isOwner && (
              <button onClick={() => onStartEdit(item)} className="w-full text-right px-4 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2 border-t border-slate-50">
                <EditIcon className="w-4 h-4 text-slate-500" />
                <span>ערוך מודעה</span>
              </button>
            )}
            {(isOwner || isAdmin) && (
              <button onClick={() => onDelete(item.id)} className="w-full text-right px-4 py-3 text-xs font-bold text-rose-600 hover:bg-red-50 flex items-center gap-2 border-t border-slate-50">
                <DeleteIcon className="w-4 h-4 text-rose-500" />
                <span>מחק לצמיתות</span>
              </button>
            )}
          </div>
        )}
      </div>

      {editingItemId === item.id ? (
        <form onSubmit={(e) => onSubmitEdit(e, item.id)} className="p-3 flex flex-col gap-3 bg-[#1D4ED8]/5 rounded-2xl mt-8 border border-[#1D4ED8]/10">
          <input type="text" required value={editItemData.title} onChange={(e) => onUpdateEditData({ ...editItemData, title: e.target.value })} className="w-full bg-white border border-[#1D4ED8]/20 rounded-xl px-3 py-2.5 text-xs font-bold outline-none focus:border-[#1D4ED8] shadow-sm text-slate-800" placeholder="כותרת" />
          <div className="flex gap-2">
            <select value={editItemData.category} onChange={(e) => onUpdateEditData({ ...editItemData, category: e.target.value })} className="flex-1 bg-white border border-[#1D4ED8]/20 rounded-xl px-2 py-2.5 text-xs font-bold outline-none shadow-sm text-slate-800">
              {mainCategories.filter(c => c !== 'הכל' && c !== 'שמורים' && c !== 'קהילה').map(c => <option key={c} value={c}>{c}</option>)}
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
          <div className="pt-8 pr-1 flex justify-between items-start">
            <div className="flex-1">
              <h3 className="text-[17px] font-black text-slate-800 leading-tight mb-1.5">{item.title}</h3>
              <p className="text-sm font-medium text-slate-600 mb-3">{item.description}</p>
            </div>
            {item.price > 0 && !['חבילות ודואר', 'למסירה', 'בקשות שכנים', 'השאלות כלים'].includes(item.category) && (
              <span className="text-lg font-black text-[#1D4ED8] shrink-0 pl-1">₪{item.price.toLocaleString()}</span>
            )}
          </div>

          {item.media_url && (
            <div onClick={() => onMediaClick(item.media_url!, item.media_type || 'image')} className="w-full aspect-video rounded-2xl overflow-hidden mb-4 cursor-pointer shadow-inner border border-slate-100">
              {item.media_type === 'video' ? (
                <div className="relative w-full h-full bg-black">
                  <video src={item.media_url} className="w-full h-full object-contain" />
                  <div className="absolute inset-0 flex items-center justify-center"><span className="text-white text-3xl opacity-80 drop-shadow-lg">▶️</span></div>
                </div>
              ) : (
                <img src={item.media_url} className="w-full h-full object-cover" />
              )}
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-slate-100 mt-2">
            <div className="flex items-center gap-2.5">
               <img src={item.profiles?.avatar_url || `https://api.dicebear.com/8.x/initials/svg?seed=${item.profiles?.full_name}`} className="w-9 h-9 rounded-full border border-slate-200 object-cover shadow-sm" alt="avatar" />
               <div className="flex flex-col">
                 <span className="text-xs font-black text-slate-800">{item.profiles?.full_name}</span>
                 <span className="text-[10px] text-slate-500 font-bold">{item.profiles?.apartment ? `דירה ${item.profiles.apartment} • ` : ''}{timeFormat(item.created_at)}</span>
               </div>
            </div>

            {!isOwner && item.contact_phone && (
              <div className="flex items-center gap-2 shrink-0">
                <a href={`tel:${item.contact_phone}`} onClick={(e) => e.stopPropagation()} className="w-9 h-9 rounded-xl bg-[#1D4ED8] text-white hover:opacity-90 transition active:scale-95 flex items-center justify-center shadow-md">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                </a>
                <a href={formatWhatsApp(item.contact_phone)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="w-9 h-9 rounded-xl bg-[#25D366] text-white hover:opacity-90 transition active:scale-95 flex items-center justify-center shadow-md">
                  <WhatsAppIcon className="w-5 h-5 fill-current" />
                </a>
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-50">
            {comments.length > 0 && (
              <div className="space-y-2 mb-3 max-h-40 overflow-y-auto hide-scrollbar">
                {comments.map(c => (
                  <div key={c.id} className="flex items-start gap-2 bg-slate-50/50 p-2.5 rounded-xl text-right border border-slate-100">
                    <img src={c.profiles?.avatar_url || `https://api.dicebear.com/8.x/initials/svg?seed=${c.profiles?.full_name}`} className="w-5 h-5 rounded-full object-cover shrink-0 border border-white shadow-sm" />
                    <div className="flex-1 min-w-0 leading-tight pt-0.5">
                      <span className="text-[11px] font-black text-[#1D4ED8] ml-1">{c.profiles?.full_name}:</span>
                      <span className="text-[11px] text-slate-700 font-medium">{c.content}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {(isPackage || isRequest || isOwner) && (
              <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1 mb-3">
                {(isOwner ? ownerReplies : tenantReplies).map((reply, idx) => (
                  <button key={idx} onClick={() => handleAddComment(reply)} className="h-8 px-3 bg-white hover:bg-slate-50 text-[#1D4ED8] border border-[#1D4ED8]/20 rounded-xl text-[11px] font-bold shrink-0 transition active:scale-95 shadow-sm">{reply}</button>
                ))}
              </div>
            )}

            <form onSubmit={(e) => { e.preventDefault(); if(customNote.trim()) handleAddComment(customNote.trim()); }} className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-inner">
              <input type="text" value={customNote} onChange={e => setCustomNote(e.target.value)} placeholder={isOwner ? "השב לשכנים..." : "הגב על המודעה..."} className="flex-1 bg-transparent text-xs outline-none font-bold text-slate-800 placeholder-slate-400 h-8" />
              <button type="submit" disabled={!customNote.trim()} className="text-white bg-[#1D4ED8] disabled:bg-slate-300 w-8 h-8 rounded-lg flex items-center justify-center active:scale-95 transition shadow-sm shrink-0">
                <svg className="w-4 h-4 transform -rotate-90 -translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}

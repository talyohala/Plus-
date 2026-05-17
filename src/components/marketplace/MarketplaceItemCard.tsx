import React, { useState } from 'react';

export interface MarketplaceComment {
  id: string; content: string; created_at: string; user_id: string;
  profiles?: { full_name: string; avatar_url?: string; };
}

export interface MarketplaceItem {
  id: string; building_id: string; user_id: string; title: string; description?: string; price: number; contact_phone: string;
  category: string; media_url?: string; media_type?: string; status: string; is_pinned: boolean; created_at: string;
  item_type?: string; poll_options?: any[];
  profiles?: { full_name: string; avatar_url?: string; apartment?: string; floor?: string; role: string; hide_phone?: boolean; };
  marketplace_comments?: MarketplaceComment[];
}

interface Props {
  item: MarketplaceItem; currentUserId?: string; isAdmin: boolean; isSaved: boolean; openMenuId: string | null;
  editingItemId: string | null; editItemData: any; mainCategories: string[]; isSubmitting: boolean;
  onToggleMenu: (id: string | null) => void; onToggleSave: (e: React.MouseEvent, id: string, isSaved: boolean) => void;
  onTogglePin: (id: string, isPinned: boolean) => void; onStartEdit: (item: MarketplaceItem) => void;
  onCancelEdit: () => void; onUpdateEditData: (data: any) => void; onSubmitEdit: (e: React.FormEvent, id: string) => void;
  onDelete: (id: string) => void; onMediaClick: (url: string, type: string) => void; onResolveItem?: (id: string) => void;
  onAddComment: (itemId: string, text: string) => void;
  formatWhatsApp: (phone: string) => string; timeFormat: (dateStr: string) => string;
}

const getCategoryStyle = (cat: string) => {
  switch (cat) {
    case 'סקרים': return 'bg-purple-500 text-white';
    case 'בקשות שכנים': return 'bg-emerald-500 text-white';
    case 'למכירה': return 'bg-[#1D4ED8] text-white';
    case 'למסירה': return 'bg-[#F59E0B] text-white';
    case 'חבילות ודואר': return 'bg-indigo-500 text-white';
    case 'השאלות כלים': return 'bg-teal-500 text-white';
    default: return 'bg-rose-500 text-white';
  }
};

export default function MarketplaceItemCard({ item, currentUserId, isAdmin, isSaved, openMenuId, editingItemId, editItemData, mainCategories, isSubmitting, onToggleMenu, onToggleSave, onTogglePin, onStartEdit, onCancelEdit, onUpdateEditData, onSubmitEdit, onDelete, onMediaClick, onResolveItem, onAddComment, formatWhatsApp, timeFormat }: Props) {
  const [commentText, setCommentText] = useState('');
  const isOwner = currentUserId === item.user_id;
  const showContact = item.contact_phone && (!item.profiles?.hide_phone || isOwner || isAdmin);
  const isEditing = editingItemId === item.id;
  const catStyle = getCategoryStyle(item.category);

  const isPackage = item.category === 'חבילות ודואר';
  const quickReplies = isPackage ? ['אספתי את זה! 📦', 'אני בדרך לאסוף 🏃', 'אפשר להשאיר ליד הדלת? 🙏'] :
                       item.category === 'בקשות שכנים' ? ['אני יכול לעזור! 💪', 'דבר איתי בפרטי 📞', 'יש לי כזה, בוא קח 🤝'] :
                       ['רלוונטי? 🤔', 'מתי אפשר לאסוף? ⏳', 'מעוניין! 😍'];

  const handleCommentSubmit = (e?: React.FormEvent, presetText?: string) => {
    e?.preventDefault();
    const textToSend = presetText || commentText;
    if (!textToSend.trim()) return;
    onAddComment(item.id, textToSend);
    setCommentText('');
  };

  const comments = item.marketplace_comments ? [...item.marketplace_comments].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) : [];

  if (isEditing) {
    return (
      <div className="bg-white/95 backdrop-blur-xl rounded-[2rem] p-5 shadow-lg border border-[#1D4ED8]/20 animate-in zoom-in-95">
        <form onSubmit={(e) => onSubmitEdit(e, item.id)} className="flex flex-col gap-3">
          <input type="text" value={editItemData.title} onChange={e => onUpdateEditData({...editItemData, title: e.target.value})} className="w-full bg-[#F8FAFC] border border-slate-200 rounded-xl px-4 h-12 text-sm font-bold focus:border-[#1D4ED8] outline-none" placeholder="כותרת" />
          <textarea value={editItemData.description} onChange={e => onUpdateEditData({...editItemData, description: e.target.value})} className="w-full bg-[#F8FAFC] border border-slate-200 rounded-xl p-4 text-sm font-medium focus:border-[#1D4ED8] outline-none min-h-[80px]" placeholder="תיאור" />
          {!['למסירה', 'חבילות ודואר', 'השאלות כלים', 'בקשות שכנים', 'סקרים'].includes(editItemData.category) && (
            <input type="number" value={editItemData.price} onChange={e => onUpdateEditData({...editItemData, price: e.target.value})} className="w-full bg-[#F8FAFC] border border-slate-200 rounded-xl px-4 h-12 text-sm font-bold focus:border-[#1D4ED8] outline-none" placeholder="מחיר (₪)" />
          )}
          <div className="flex gap-2 mt-2">
            <button type="button" onClick={onCancelEdit} className="flex-1 h-12 bg-slate-100 text-slate-600 font-bold rounded-xl active:scale-95 transition">ביטול</button>
            <button type="submit" disabled={isSubmitting} className="flex-1 h-12 bg-[#1D4ED8] text-white font-bold rounded-xl active:scale-95 transition flex items-center justify-center">{isSubmitting ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span> : 'שמור שינויים'}</button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className={`bg-white/90 backdrop-blur-xl rounded-[2rem] pt-5 pb-5 relative transition-all duration-300 overflow-hidden ${item.is_pinned ? 'border border-orange-200/60 bg-gradient-to-br from-orange-50/80 to-white shadow-[0_8px_25px_rgba(249,115,22,0.15)]' : 'border border-[#1D4ED8]/10 shadow-[0_8px_30px_rgba(29,78,216,0.04)]'} ${openMenuId === item.id ? 'z-50' : 'z-10'}`}>
      
      {/* תגיות עליונות - צבע מלא וטקסט לבן */}
      <div className="absolute top-0 right-0 flex overflow-hidden rounded-bl-[1.5rem] shadow-sm z-10">
        {item.is_pinned && <div className="px-4 py-1.5 bg-[#F59E0B] text-white text-[10px] font-black uppercase tracking-wider border-l border-white/20">נעוץ</div>}
        <div className={`px-4 py-1.5 text-[10px] font-black tracking-wide ${catStyle}`}>
          {item.category}
        </div>
      </div>

      {/* תפריט מנהל / יוצר ושמירה */}
      <div className="absolute top-3 left-3 z-20">
        <button onClick={(e) => { e.stopPropagation(); onToggleMenu(openMenuId === item.id ? null : item.id); }} className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-[#1D4ED8] bg-white/50 border border-slate-100 shadow-sm transition-colors active:scale-95">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"></path></svg>
        </button>
        {openMenuId === item.id && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => onToggleMenu(null)}></div>
            <div className="absolute left-0 top-10 w-[170px] bg-white/95 backdrop-blur-xl border border-slate-100 shadow-[0_15px_50px_rgba(0,0,0,0.15)] rounded-2xl z-[150] py-1.5 animate-in zoom-in-95">
              
              <button onClick={(e) => onToggleSave(e, item.id, isSaved)} className="w-full text-right px-4 h-11 text-xs font-bold text-slate-700 hover:bg-rose-50 flex items-center gap-3 border-b border-slate-100/50">
                {isSaved ? (
                  <svg className="w-4 h-4 text-rose-500 fill-rose-500" viewBox="0 0 24 24"><path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z"/></svg>
                ) : (
                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"/></svg>
                )}
                {isSaved ? 'הסר משמורים' : 'שמור מודעה'}
              </button>

              {isAdmin && (
                <button onClick={() => onTogglePin(item.id, item.is_pinned)} className="w-full text-right px-4 h-11 text-xs font-bold text-slate-700 hover:bg-orange-50 flex items-center gap-3 border-b border-slate-100/50">
                  <svg className={`w-4 h-4 ${item.is_pinned ? 'text-orange-500 fill-orange-500' : 'text-slate-400'}`} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 4.5l-4 4L7.5 7.5a.75.75 0 00-1.06 1.06L9 11.12l-5.22 5.22a.75.75 0 001.06 1.06L10.06 12l2.56 2.56a.75.75 0 001.06-1.06l-1.06-2.56 4-4a2.121 2.121 0 00-3-3z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 4.5l5 5" /></svg>
                  {item.is_pinned ? 'בטל נעיצה' : 'נעץ מודעה'}
                </button>
              )}

              {(isAdmin || isOwner) && (
                <>
                  {isPackage && onResolveItem && (
                    <button onClick={() => onResolveItem(item.id)} className="w-full text-right px-4 h-11 text-xs font-bold text-emerald-600 hover:bg-emerald-50 flex items-center gap-3 border-b border-slate-100/50">
                      <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"></path></svg>
                      סמן שנאסף
                    </button>
                  )}
                  <button onClick={() => onStartEdit(item)} className="w-full text-right px-4 h-11 text-xs font-bold text-slate-700 hover:bg-blue-50 flex items-center gap-3 border-b border-slate-100/50">
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125"></path></svg>
                    עריכה
                  </button>
                  <button onClick={() => onDelete(item.id)} className="w-full text-right px-4 h-11 text-xs font-bold text-rose-500 hover:bg-red-50 flex items-center gap-3 mt-1 pt-1">
                    <svg className="w-4 h-4 text-rose-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    מחיקה
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* מידע על המפרסם */}
      <div className="pt-7 pr-5 pl-10 flex items-center gap-3 mb-3">
        <img src={item.profiles?.avatar_url || `https://api.dicebear.com/8.x/initials/svg?seed=${item.profiles?.full_name}`} className="w-10 h-10 rounded-full border border-slate-200 object-cover shadow-sm" alt="avatar" />
        <div className="flex flex-col">
          <span className="text-[13px] font-black text-slate-800 leading-none">{item.profiles?.full_name}</span>
          <span className="text-[10px] font-bold text-slate-400 mt-1">דירה {item.profiles?.apartment || '-'} • {timeFormat(item.created_at)}</span>
        </div>
      </div>

      {/* תוכן המודעה */}
      <div className="px-5">
        <h3 className={`text-lg font-black leading-tight mb-2 pr-1 ${item.is_pinned ? 'text-orange-600' : 'text-slate-800'}`}>{item.title}</h3>
        {item.description && <p className="text-sm font-medium text-slate-600 whitespace-pre-wrap leading-relaxed px-1 mb-2">{item.description}</p>}
      </div>
      
      {/* אזור המחיר ויצירת קשר באותה שורה */}
      <div className="flex justify-between items-center px-5 mb-2 mt-1">
        {item.price > 0 ? (
          <div className="inline-flex items-center gap-1 bg-[#1D4ED8]/5 px-3 py-1.5 rounded-xl border border-[#1D4ED8]/10">
            <span className="text-lg font-black text-[#1D4ED8]">{item.price.toLocaleString()}</span>
            <span className="text-[10px] font-bold text-[#1D4ED8]/70">₪</span>
          </div>
        ) : <div />}

        {showContact ? (
          <div className="flex gap-2">
            <a href={`tel:${item.contact_phone}`} onClick={(e) => e.stopPropagation()} className="w-10 h-10 rounded-full bg-[#1D4ED8] flex items-center justify-center text-white shadow-md hover:scale-105 active:scale-95 transition-all" aria-label="חייג לדייר">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"></path></svg>
            </a>
            <button onClick={(e) => { e.stopPropagation(); window.open(formatWhatsApp(item.contact_phone), '_blank'); }} className="w-10 h-10 rounded-full bg-[#25D366] flex items-center justify-center text-white shadow-md hover:scale-105 active:scale-95 transition-all" aria-label="שלח וואטסאפ">
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.305-.883-.653-1.48-1.459-1.653-1.758-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.413z"/></svg>
            </button>
          </div>
        ) : (
          <div className="text-[10px] font-black text-slate-400 bg-slate-50 px-3 h-8 flex items-center rounded-xl border border-slate-100">
            המספר חסוי
          </div>
        )}
      </div>

      {/* תמונות / וידאו מקצה לקצה בלי ריצוד */}
      {item.media_url && (
        <div className="mt-4 mb-0 -mx-0 relative w-full cursor-pointer overflow-hidden border-y border-slate-100/50" onClick={() => onMediaClick(item.media_url!, item.media_type || 'image')}>
          {item.media_type === 'video' ? (
            <div className="relative w-full h-full flex items-center justify-center bg-black/5">
              <video src={item.media_url} className="w-full max-h-[350px] object-cover" />
              <div className="absolute inset-0 bg-black/10 flex items-center justify-center">
                <div className="w-12 h-12 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg">
                  <svg className="w-5 h-5 text-[#1D4ED8] ml-1" fill="currentColor" viewBox="0 0 20 20"><path d="M8 5v10l7-5-7-5z" /></svg>
                </div>
              </div>
            </div>
          ) : (
            <img src={item.media_url} className="w-full max-h-[350px] object-cover bg-slate-50" alt="media" loading="lazy" />
          )}
        </div>
      )}

      {/* אזור התגובות והצ'אט (In-App Comments) */}
      <div className="px-5 py-4 bg-slate-50/50 border-t border-slate-100/50">
        
        {/* רשימת תגובות קיימות */}
        {comments.length > 0 && (
          <div className="flex flex-col gap-3 mb-4">
            {comments.map(c => (
              <div key={c.id} className="flex gap-2 items-start">
                <img src={c.profiles?.avatar_url || `https://api.dicebear.com/8.x/initials/svg?seed=${c.profiles?.full_name}`} className="w-6 h-6 rounded-full object-cover shadow-sm mt-0.5" alt="avatar" />
                <div className="bg-white px-3 py-2 rounded-2xl rounded-tr-sm border border-slate-100 shadow-sm flex-1">
                  <div className="flex justify-between items-center mb-0.5">
                    <span className="text-[10px] font-black text-slate-800">{c.profiles?.full_name}</span>
                    <span className="text-[9px] font-bold text-slate-400">{timeFormat(c.created_at)}</span>
                  </div>
                  <p className="text-xs text-slate-600 font-medium">{c.content}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* שורת הקלדת תגובה */}
        <form onSubmit={handleCommentSubmit} className="relative flex items-center gap-2 mb-2">
          <input type="text" placeholder="כתוב תגובה..." value={commentText} onChange={(e) => setCommentText(e.target.value)} className="flex-1 bg-white border border-slate-200 rounded-full h-10 pr-4 pl-10 text-xs font-bold outline-none focus:border-[#1D4ED8] shadow-sm transition-all" />
          <button type="submit" disabled={!commentText.trim()} className="absolute left-1 top-1 bottom-1 w-8 flex items-center justify-center bg-[#1D4ED8] text-white rounded-full transition active:scale-95 disabled:opacity-50 disabled:bg-slate-300">
            <svg className="w-3.5 h-3.5 transform -rotate-45" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
          </button>
        </form>

        {/* תגובות מהירות מותאמות אישית בהתאם לקטגוריה - עכשיו כותבות ישירות לתגובות! */}
        <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
          {quickReplies.map(reply => (
            <button key={reply} onClick={(e) => { e.stopPropagation(); handleCommentSubmit(e, reply); }} className="whitespace-nowrap px-3 h-7 bg-white hover:bg-slate-50 text-slate-600 text-[10px] font-black rounded-full border border-slate-200 transition-colors active:scale-95 shadow-sm flex items-center justify-center shrink-0">
              {reply}
            </button>
          ))}
        </div>

      </div>
    </div>
  );
}

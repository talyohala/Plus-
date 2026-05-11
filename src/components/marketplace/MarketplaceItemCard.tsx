import React from 'react';

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
  onQuickReply: (item: MarketplaceItem, text: string) => void;
  formatWhatsApp: (phone: string) => string;
  timeFormat: (dateStr: string) => string;
}

export default function MarketplaceItemCard({
  item,
  currentUserId,
  isAdmin,
  isSaved,
  openMenuId,
  editingItemId,
  editItemData,
  mainCategories,
  isSubmitting,
  onToggleMenu,
  onToggleSave,
  onTogglePin,
  onStartEdit,
  onCancelEdit,
  onUpdateEditData,
  onSubmitEdit,
  onDelete,
  onMediaClick,
  onQuickReply,
  formatWhatsApp,
  timeFormat,
}: MarketplaceItemCardProps) {
  const isOwner = currentUserId === item.user_id;
  const isPackage = item.category === 'חבילות ודואר';
  const isRequest = item.category === 'בקשות שכנים' || item.category === 'השאלות כלים';

  const quickReplies = isPackage 
    ? ['אני ארד לאסוף! 🏃‍♂️', 'תודה רבה! 🙏', 'זה שלי, אוסף היום ✨']
    : ['יש לי, מוזמן/ת! 👍', 'בוא/י לקחת באהבה 🎁', 'אשמח לעזור ✨'];

  let cardStyle = 'border-[#1D4ED8]/10 bg-white/90';
  let badgeStyle = 'bg-[#1D4ED8]/10 text-[#1D4ED8] border-b border-l border-[#1D4ED8]/20';

  if (item.category === 'בקשות שכנים') {
    cardStyle = 'border-emerald-200/80 bg-emerald-50/5';
    badgeStyle = 'bg-emerald-100 text-emerald-800 border-b border-l border-emerald-200/60';
  } else if (isPackage) {
    cardStyle = 'border-blue-200/80 bg-blue-50/20';
    badgeStyle = 'bg-blue-100 text-[#1D4ED8] border-b border-l border-blue-200/60';
  } else if (item.is_pinned) {
    cardStyle = 'border-[#1D4ED8]/40 shadow-[0_0_20px_rgba(29,78,216,0.1)] bg-white/95';
  }

  const isOpen = openMenuId === item.id;

  return (
    <div className={`backdrop-blur-xl p-4 pt-7 rounded-[1.5rem] shadow-[0_4px_20px_rgba(29,78,216,0.03)] border transition-all relative ${cardStyle} ${isOpen ? 'z-[100]' : 'z-10'}`} dir="rtl">
      
      <div className={`absolute top-0 right-0 text-[10px] font-black px-3 py-1 rounded-tr-[1.5rem] rounded-bl-xl shadow-sm z-10 ${badgeStyle}`}>
        {item.category} {item.is_pinned && '📌'}
      </div>

      <div className="absolute top-2 left-2 z-50 flex items-center gap-1">
        {isSaved && (
          <span className="text-rose-500 text-sm animate-in zoom-in-95 leading-none shrink-0 font-black">♥</span>
        )}

        <button 
          onClick={(e) => {
            e.stopPropagation();
            onToggleMenu(isOpen ? null : item.id);
          }} 
          className="w-8 h-8 flex items-center justify-center transition hover:scale-110 text-slate-400 hover:text-[#1D4ED8] relative z-10"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" /></svg>
        </button>

        {isOpen && (
          <div className="absolute left-0 top-8 w-48 bg-white/95 backdrop-blur-xl border border-[#1D4ED8]/20 shadow-[0_10px_40px_rgba(0,0,0,0.15)] rounded-2xl z-[150] overflow-hidden py-1">
            <button onClick={(e) => { onToggleSave(e, item.id, isSaved); }} className="w-full text-right px-4 py-3 text-xs font-bold text-slate-700 hover:bg-[#1D4ED8]/5 flex items-center gap-2.5">
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
        <form onSubmit={(e) => onSubmitEdit(e, item.id)} className="p-3 flex flex-col gap-3 bg-[#1D4ED8]/5 rounded-2xl mt-2 border border-[#1D4ED8]/10">
          <input type="text" required value={editItemData.title} onChange={(e) => onUpdateEditData({ ...editItemData, title: e.target.value })} className="w-full bg-white border border-[#1D4ED8]/20 rounded-xl px-3 py-2.5 text-xs font-bold outline-none focus:border-[#1D4ED8] shadow-sm text-slate-800" placeholder="כותרת" />
          <div className="flex gap-2">
            <select value={editItemData.category} onChange={(e) => onUpdateEditData({ ...editItemData, category: e.target.value })} className="flex-1 bg-white border border-[#1D4ED8]/20 rounded-xl px-2 py-2.5 text-xs font-bold outline-none shadow-sm text-slate-800">
              <option value="חבילות ודואר">חבילות ודואר</option>
              <option value="בקשות שכנים">בקשות שכנים</option>
              <option value="השאלות כלים">השאלות כלים</option>
              <option value="למסירה">למסירה</option>
              <option value="למכירה">למכירה</option>
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
          <div className="flex gap-3 min-h-[70px] relative mt-1">
            {item.media_url && (
              <div onClick={() => onMediaClick(item.media_url!, item.media_type || 'image')} className="w-[80px] h-[85px] rounded-2xl bg-slate-50 shrink-0 border border-[#1D4ED8]/10 overflow-hidden cursor-pointer relative shadow-sm">
                {item.media_type === 'video' ? (
                  <>
                    <video src={item.media_url} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20"><span className="text-white text-xs font-bold">▶️</span></div>
                  </>
                ) : (
                  <img src={item.media_url} alt="מודעה" className="w-full h-full object-cover" />
                )}
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

              <div className="mt-auto text-[10px] text-slate-400 font-bold flex items-center justify-between pt-2.5 border-t border-slate-50">
                <span className="flex items-center gap-1.5 text-slate-600">
                  <img src={item.profiles?.avatar_url || `https://api.dicebear.com/8.x/initials/svg?seed=${item.profiles?.full_name || 'U'}&backgroundColor=EFF6FF&textColor=1D4ED8`} className="w-4 h-4 rounded-full border border-gray-100 shadow-sm object-cover" alt="avatar" />
                  <span className="font-bold">{item.profiles?.full_name || 'שכן'}</span>
                  {item.profiles?.apartment && <span className="text-[9px] bg-slate-100 px-1 py-0.2 rounded text-slate-500 font-medium">דירה {item.profiles.apartment}</span>}
                </span>
                <span>{timeFormat(item.created_at)}</span>
              </div>
            </div>
          </div>

          {!isOwner && (isPackage || isRequest) && (
            <div className="flex gap-2 mt-3 pt-2 border-t border-slate-100/80">
              {quickReplies.map((reply, idx) => (
                <button key={idx} onClick={() => onQuickReply(item, reply)} className={`flex-1 h-10 border text-[11px] font-bold rounded-xl active:scale-95 transition flex items-center justify-center whitespace-nowrap shadow-sm ${item.category === 'בקשות שכנים' ? 'bg-emerald-50/50 border-emerald-200/60 text-emerald-700 hover:bg-emerald-100/50' : 'bg-[#1D4ED8]/5 border-[#1D4ED8]/20 text-[#1D4ED8] hover:bg-[#1D4ED8]/10'}`}>
                  {reply}
                </button>
              ))}
            </div>
          )}

          {!isOwner && !isPackage && item.contact_phone && (
            <div className="flex gap-2 mt-3 pt-2 border-t border-slate-100/80">
              <a href={formatWhatsApp(item.contact_phone)} target="_blank" rel="noopener noreferrer" className="flex-1 h-10 bg-[#25D366] text-white rounded-xl flex items-center justify-center gap-1.5 font-bold text-xs active:scale-95 transition shadow-sm">וואטסאפ</a>
              <a href={`tel:${item.contact_phone}`} className="flex-1 h-10 bg-[#1D4ED8] text-white rounded-xl flex items-center justify-center gap-1.5 font-bold text-xs active:scale-95 transition shadow-sm">חייג לשכן</a>
            </div>
          )}
        </>
      )}
    </div>
  );
}

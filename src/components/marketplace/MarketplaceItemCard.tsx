import React, { useState } from 'react';

export interface MarketplaceComment { id: string; content: string; created_at: string; user_id: string; profiles?: { full_name: string; avatar_url?: string; }; }
export interface MarketplaceVote { id: string; user_id: string; vote_value: string; }

export interface MarketplaceItem {
  id: string; building_id: string; user_id: string; title: string; description?: string; price: number; contact_phone: string;
  category: string; media_url?: string; media_type?: string; status: string; is_pinned: boolean; created_at: string;
  item_type?: string; poll_options?: any[];
  profiles?: { full_name: string; avatar_url?: string; apartment?: string; floor?: string; role: string; hide_phone?: boolean; };
  marketplace_comments?: MarketplaceComment[];
  marketplace_votes?: MarketplaceVote[];
}

interface Props {
  item: MarketplaceItem; currentUserId?: string; isAdmin: boolean; isSaved: boolean; openMenuId: string | null;
  editingItemId: string | null; editItemData: any; mainCategories: string[]; isSubmitting: boolean;
  onToggleMenu: (id: string | null) => void; onToggleSave: (e: React.MouseEvent, id: string, isSaved: boolean) => void;
  onTogglePin: (id: string, isPinned: boolean) => void; onStartEdit: (item: MarketplaceItem) => void;
  onCancelEdit: () => void; onDelete: (id: string) => void; onMediaClick: (url: string, type: string) => void; 
  onResolveItem?: (id: string) => void; onAddComment: (itemId: string, text: string) => void; onVote: (itemId: string, vote: string) => void;
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

export default function MarketplaceItemCard({ item, currentUserId, isAdmin, isSaved, openMenuId, editingItemId, editItemData, isSubmitting, onToggleMenu, onToggleSave, onTogglePin, onStartEdit, onCancelEdit, onDelete, onMediaClick, onResolveItem, onAddComment, onVote, formatWhatsApp, timeFormat }: Props) {
  const [commentText, setCommentText] = useState('');
  const isOwner = currentUserId === item.user_id;
  const showContact = item.contact_phone && (!item.profiles?.hide_phone || isOwner || isAdmin);
  const isEditing = editingItemId === item.id;
  const catStyle = getCategoryStyle(item.category);
  
  const isPoll = item.item_type === 'poll' || item.category === 'סקרים';
  
  const yesVotes = item.marketplace_votes?.filter(v => v.vote_value === 'yes').length || 0;
  const noVotes = item.marketplace_votes?.filter(v => v.vote_value === 'no').length || 0;
  const totalVotes = yesVotes + noVotes;
  const yesPercent = totalVotes > 0 ? Math.round((yesVotes / totalVotes) * 100) : 0;
  const noPercent = totalVotes > 0 ? Math.round((noVotes / totalVotes) * 100) : 0;
  const myVote = item.marketplace_votes?.find(v => v.user_id === currentUserId)?.vote_value;

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
      <div className="bg-white/95 backdrop-blur-xl rounded-[2rem] p-5 shadow-lg border border-[#1D4ED8]/20 animate-in zoom-in-95" dir="rtl">
        <form onSubmit={(e) => { e.preventDefault(); }} className="flex flex-col gap-3">
          <input type="text" value={editItemData.title} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 h-12 text-sm font-bold outline-none" placeholder="כותרת" readOnly />
          <textarea value={editItemData.description} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-medium outline-none min-h-[80px]" placeholder="תיאור" readOnly />
          <div className="flex gap-2 mt-2">
            <button type="button" onClick={onCancelEdit} className="flex-1 h-12 bg-slate-100 text-slate-600 font-bold rounded-xl active:scale-95 transition">ביטול</button>
            <button type="button" className="flex-1 h-12 bg-[#1D4ED8] text-white font-bold rounded-xl active:scale-95 transition flex items-center justify-center">שמור שינויים</button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className={`bg-white/90 backdrop-blur-xl rounded-[2rem] pt-5 pb-4 relative transition-all duration-300 overflow-hidden ${item.is_pinned ? 'border border-orange-200/60 bg-gradient-to-br from-orange-50/80 to-white shadow-[0_8px_25px_rgba(249,115,22,0.15)]' : 'border border-slate-100 shadow-[0_8px_30px_rgba(29,78,216,0.04)]'} ${openMenuId === item.id ? 'z-50' : 'z-10'}`} dir="rtl">
      
      {/* תגיות עליונות צבע מלא */}
      <div className="absolute top-0 right-0 flex overflow-hidden rounded-bl-[1.5rem] shadow-sm z-10">
        {item.is_pinned && <div className="px-4 py-1.5 bg-[#F59E0B] text-white text-[10px] font-black uppercase tracking-wider border-l border-white/20">נעוץ</div>}
        <div className={`px-4 py-1.5 text-[10px] font-black tracking-wide ${catStyle}`}>
          {item.category}
        </div>
      </div>

      {/* תפריט מנהל + אייקון לב נקי וחלק - צמודים יחד */}
      <div className="absolute top-3 left-3 z-20 flex items-center gap-2">
        {isSaved && (
          <svg className="w-5 h-5 text-rose-500 fill-rose-500 drop-shadow-sm" viewBox="0 0 24 24" title="נשמר במועדפים">
            <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z"/>
          </svg>
        )}
        <button onClick={(e) => { e.stopPropagation(); onToggleMenu(openMenuId === item.id ? null : item.id); }} className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-[#1D4ED8] bg-white/50 border border-slate-100 shadow-sm transition-colors active:scale-95">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"></path></svg>
        </button>

        {openMenuId === item.id && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => onToggleMenu(null)}></div>
            <div className="absolute left-0 top-10 w-[200px] bg-white/95 backdrop-blur-xl border border-slate-100 shadow-[0_15px_50px_rgba(0,0,0,0.15)] rounded-2xl z-[150] py-2 animate-in zoom-in-95 overflow-hidden">
              
              <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(`${item.title}\n${item.description || ''}`); onToggleMenu(null); }} className="w-full text-right px-4 h-12 text-sm font-bold text-slate-700 hover:bg-slate-50 flex items-center justify-start gap-3 transition-colors border-b border-slate-100/50">
                <svg className="w-5 h-5 text-slate-500 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                <span>העתק פרטים</span>
              </button>

              <button onClick={(e) => { e.stopPropagation(); window.open(`https://wa.me/?text=${encodeURIComponent(`*${item.title}*\n${item.description || ''}`)}`, '_blank'); onToggleMenu(null); }} className="w-full text-right px-4 h-12 text-sm font-bold text-slate-700 hover:bg-slate-50 flex items-center justify-start gap-3 transition-colors border-b border-slate-100/50">
                <svg className="w-5 h-5 text-[#25D366] fill-[#25D366] shrink-0" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.305-.883-.653-1.48-1.459-1.653-1.758-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.413z"/></svg>
                <span>שיתוף לוואטסאפ</span>
              </button>

              <button onClick={(e) => onToggleSave(e, item.id, isSaved)} className="w-full text-right px-4 h-12 text-sm font-bold text-slate-700 hover:bg-slate-50 flex items-center justify-start gap-3 transition-colors border-b border-slate-100/50">
                {isSaved ? (
                  <svg className="w-5 h-5 text-rose-500 fill-rose-500 shrink-0" viewBox="0 0 24 24"><path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z"/></svg>
                ) : (
                  <svg className="w-5 h-5 text-slate-500 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"/></svg>
                )}
                <span>{isSaved ? 'הסר משמורים' : 'שמור מודעה'}</span>
              </button>

              {isAdmin && (
                <button onClick={() => onTogglePin(item.id, item.is_pinned)} className="w-full text-right px-4 h-12 text-sm font-bold text-slate-700 hover:bg-slate-50 flex items-center justify-start gap-3 transition-colors border-b border-slate-100/50">
                  {item.is_pinned ? (
                    <svg className="w-5 h-5 text-[#F59E0B] fill-[#F59E0B] shrink-0" viewBox="0 0 24 24"><path d="M16 11V5.5L17.5 4V3H6.5V4L8 5.5V11L6 14V15H11V21H13V15H18V14L16 11Z"/></svg>
                  ) : (
                    <svg className="w-5 h-5 text-blue-700 shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M16 11V5.5L17.5 4V3H6.5V4L8 5.5V11L6 14V15H11V21H13V15H18V14L16 11Z"/></svg>
                  )}
                  <span>{item.is_pinned ? 'בטל נעיצה' : 'נעץ אירוע'}</span>
                </button>
              )}

              {(isAdmin || isOwner) && (
                <>
                  <button onClick={() => onStartEdit(item)} className="w-full text-right px-4 h-12 text-sm font-bold text-slate-700 hover:bg-slate-50 flex items-center justify-start gap-3 transition-colors border-b border-slate-100/50">
                    <svg className="w-5 h-5 text-slate-500 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                    <span>עריכת פרטים</span>
                  </button>
                  {isPackage && onResolveItem && (
                    <button onClick={() => onResolveItem(item.id)} className="w-full text-right px-4 h-12 text-sm font-bold text-slate-700 hover:bg-slate-50 flex items-center justify-start gap-3 transition-colors border-b border-slate-100/50">
                      <svg className="w-5 h-5 text-slate-500 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"></path></svg>
                      <span>סמן שנאסף</span>
                    </button>
                  )}
                  <button onClick={() => onDelete(item.id)} className="w-full text-right px-4 h-12 text-sm font-bold text-rose-500 hover:bg-red-50 flex items-center justify-start gap-3 mt-1 pt-1 transition-colors">
                    <svg className="w-5 h-5 text-rose-500 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    <span>מחיקה</span>
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>

      <div className="pt-7 pr-4 pl-10 flex items-center gap-3 mb-3">
        <img src={item.profiles?.avatar_url || `https://api.dicebear.com/8.x/initials/svg?seed=${item.profiles?.full_name}`} className="w-10 h-10 rounded-full border border-slate-200 object-cover shadow-sm" alt="avatar" />
        <div className="flex flex-col">
          <span className="text-[13px] font-black text-slate-800 leading-none">{item.profiles?.full_name}</span>
          <span className="text-[10px] font-bold text-slate-400 mt-1">דירה {item.profiles?.apartment || '-'} • {timeFormat(item.created_at)}</span>
        </div>
      </div>

      <div className="px-4">
        <h3 className={`text-lg font-black leading-tight mb-2 ${item.is_pinned ? 'text-orange-600' : 'text-slate-800'}`}>{item.title.replace(/^\[.*?\]\s*/, '')}</h3>
        {item.description && <p className="text-sm font-medium text-slate-600 whitespace-pre-wrap leading-relaxed mb-3">{item.description}</p>}
      </div>
      
      {/* תמונה / וידאו - נקי לחלוטין מריצוד, קונטיינר aspect-video עם שוליים עדינים כדי לראות את הפינות המעוגלות */}
      {item.media_url && (
        <div className="mt-2 mb-4 px-3 w-full">
          <div className="w-full aspect-video rounded-2xl flex items-center justify-center cursor-pointer overflow-hidden shadow-sm bg-slate-50 border border-slate-200 relative" onClick={() => onMediaClick(item.media_url!, item.media_type || 'image')}>
            {item.media_type === 'video' ? (
              <div className="relative w-full h-full flex items-center justify-center">
                <video src={item.media_url} className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/10 flex items-center justify-center">
                  <div className="w-12 h-12 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg">
                    <svg className="w-5 h-5 text-[#1D4ED8] ml-1" fill="currentColor" viewBox="0 0 20 20"><path d="M8 5v10l7-5-7-5z" /></svg>
                  </div>
                </div>
              </div>
            ) : (
              <img src={item.media_url} className="absolute inset-0 w-full h-full object-cover" alt="media" loading="lazy" />
            )}
          </div>
        </div>
      )}

      {/* פסי סקרים מודרניים עם אנימציה אינטראקטיבית - טקסט נקי, אחוזים בשמאל, בלי אייקונים */}
      {isPoll && (
        <div className="mt-4 px-4 mb-4 flex flex-col gap-3">
          <button onClick={(e) => { e.stopPropagation(); onVote(item.id, 'yes'); }} className={`relative w-full h-14 rounded-2xl overflow-hidden transition-all duration-300 border ${myVote === 'yes' ? 'border-[#10B981] shadow-md scale-[0.98]' : 'border-slate-200 bg-slate-50 hover:bg-slate-100 shadow-sm'} active:scale-95`}>
            <div className={`absolute top-0 right-0 bottom-0 transition-all duration-1000 ease-out ${myVote === 'yes' ? 'bg-[#10B981]/20' : 'bg-[#10B981]/10'}`} style={{ width: `${yesPercent}%` }} />
            <div className="absolute inset-0 flex items-center font-black pointer-events-none px-4">
              <span className={`text-sm ml-auto ${myVote === 'yes' ? 'text-[#10B981]' : 'text-slate-500'}`}>{yesPercent}%</span>
              <span className="absolute left-1/2 -translate-x-1/2 text-slate-800 text-sm">בעד</span>
              {myVote === 'yes' && <div className="absolute right-4"><svg className="w-5 h-5 text-[#10B981]" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"></path></svg></div>}
            </div>
          </button>

          <button onClick={(e) => { e.stopPropagation(); onVote(item.id, 'no'); }} className={`relative w-full h-14 rounded-2xl overflow-hidden transition-all duration-300 border ${myVote === 'no' ? 'border-rose-500 shadow-md scale-[0.98]' : 'border-slate-200 bg-slate-50 hover:bg-slate-100 shadow-sm'} active:scale-95`}>
            <div className={`absolute top-0 right-0 bottom-0 transition-all duration-1000 ease-out ${myVote === 'no' ? 'bg-rose-500/20' : 'bg-rose-500/10'}`} style={{ width: `${noPercent}%` }} />
            <div className="absolute inset-0 flex items-center font-black pointer-events-none px-4">
              <span className={`text-sm ml-auto ${myVote === 'no' ? 'text-rose-500' : 'text-slate-500'}`}>{noPercent}%</span>
              <span className="absolute left-1/2 -translate-x-1/2 text-slate-800 text-sm">נגד</span>
              {myVote === 'no' && <div className="absolute right-4"><svg className="w-5 h-5 text-rose-500" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"></path></svg></div>}
            </div>
          </button>
          
          {totalVotes > 0 && <div className="text-center text-[10px] font-bold text-slate-400 mt-1">סה״כ {totalVotes} מצביעים</div>}
        </div>
      )}

      {/* המחיר ויצירת הקשר - מסודרים למטה */}
      {!isPoll && (
        <div className="flex justify-between items-center mb-4 px-4 mt-2">
          {item.price > 0 ? (
            <div className="inline-flex items-center gap-1 bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-100">
              <span className="text-lg font-black text-[#1D4ED8]">{item.price.toLocaleString()}</span>
              <span className="text-[10px] font-bold text-[#1D4ED8]/70">₪</span>
            </div>
          ) : <div />}

          {showContact ? (
            <div className="flex gap-2">
              <a href={`tel:${item.contact_phone}`} onClick={(e) => e.stopPropagation()} className="w-10 h-10 rounded-xl bg-[#1D4ED8] flex items-center justify-center text-white shadow-md hover:scale-105 active:scale-95 transition-all" aria-label="חייג לדייר">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"></path></svg>
              </a>
              <button onClick={(e) => { e.stopPropagation(); window.open(formatWhatsApp(item.contact_phone), '_blank'); }} className="w-10 h-10 rounded-xl bg-[#25D366] flex items-center justify-center text-white shadow-md hover:scale-105 active:scale-95 transition-all" aria-label="שלח וואטסאפ">
                <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.305-.883-.653-1.48-1.459-1.653-1.758-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.413z"/></svg>
              </button>
            </div>
        ) : (
          <div className="text-[10px] font-black text-slate-400 bg-slate-50 px-3 h-8 flex items-center rounded-xl border border-slate-100">
            המספר חסוי
          </div>
        )}
      </div>
      )}

      {/* אזור התגובות הפנימיות */}
      <div className="pt-4 border-t border-slate-100/50">
        {comments.length > 0 && (
          <div className="flex flex-col gap-3 mb-3 max-h-[160px] overflow-y-auto hide-scrollbar pl-1 px-4">
            {comments.map(c => (
              <div key={c.id} className="flex gap-2 items-start">
                <img src={c.profiles?.avatar_url || `https://api.dicebear.com/8.x/initials/svg?seed=${c.profiles?.full_name}`} className="w-7 h-7 rounded-full object-cover shadow-sm mt-0.5" alt="avatar" />
                <div className="bg-[#F8FAFC] px-3 py-2 rounded-2xl rounded-tr-sm border border-slate-100 shadow-sm flex-1">
                  <div className="flex justify-between items-center mb-0.5">
                    <span className="text-[11px] font-black text-slate-800">{c.profiles?.full_name}</span>
                    <span className="text-[9px] font-bold text-slate-400">{timeFormat(c.created_at)}</span>
                  </div>
                  <p className="text-xs text-slate-600 font-medium">{c.content}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleCommentSubmit} className="relative flex items-center gap-2 mb-3 px-4">
          <input type="text" placeholder="השב למודעה..." value={commentText} onChange={(e) => setCommentText(e.target.value)} className="flex-1 bg-white border border-slate-200 rounded-xl h-11 pr-4 pl-12 text-xs font-bold outline-none focus:border-[#1D4ED8] shadow-sm transition-all" />
          <button type="submit" disabled={!commentText.trim()} className="absolute left-5 top-1 bottom-1 w-10 flex items-center justify-center bg-[#1D4ED8] text-white rounded-lg transition active:scale-95 disabled:opacity-50 disabled:bg-slate-300">
            <svg className="w-4 h-4 transform -rotate-45" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
          </button>
        </form>

        <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1 px-4">
          {quickReplies.map(reply => (
            <button key={reply} onClick={(e) => { e.stopPropagation(); handleCommentSubmit(e, reply); }} className="whitespace-nowrap px-4 h-8 bg-white hover:bg-slate-50 text-[#1D4ED8] text-[11px] font-black rounded-xl border border-[#1D4ED8]/20 transition-colors active:scale-95 shadow-sm flex items-center justify-center shrink-0">
              {reply}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

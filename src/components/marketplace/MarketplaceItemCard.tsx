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
  const isRequest = item.category === 'בקשות שכנים';

  return (
    <div
      className={`bg-white/80 backdrop-blur-md p-4 rounded-3xl shadow-sm border transition-all ${
        isRequest ? 'bg-emerald-50/50 border-emerald-100' : 'border-white'
      } ${item.is_pinned ? 'border-purple-500/30 shadow-[0_4px_20px_rgba(147,51,234,0.15)]' : 'hover:shadow-md'} relative ${
        openMenuId === item.id ? 'z-[100]' : 'z-10'
      }`}
      dir="rtl"
    >
      {item.is_pinned && (
        <div className="absolute top-0 right-4 bg-purple-600 text-white text-[9px] font-black px-3 py-0.5 rounded-b-lg shadow-sm flex items-center gap-1 z-10">
          <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" />
          </svg>
          נעוץ מנהל
        </div>
      )}

      {/* כפתור תפריט צף - נגיש 48x48 */}
      <div className="absolute top-1 left-1 z-40">
        <div className="relative">
          <button
            onClick={() => onToggleMenu(openMenuId === item.id ? null : item.id)}
            className="w-12 h-12 flex items-center justify-center transition hover:scale-110 text-slate-400 hover:text-slate-700"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
            </svg>
          </button>

          {openMenuId === item.id && (
            <div className="absolute left-2 top-10 w-48 bg-white/95 backdrop-blur-xl border border-white shadow-[0_10px_40px_rgba(0,0,0,0.15)] rounded-2xl z-[150] overflow-hidden py-1">
              <button
                onClick={(e) => onToggleSave(e, item.id, isSaved)}
                className="w-full text-right px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-3"
              >
                {isSaved ? (
                  <>
                    <svg className="w-5 h-5 text-rose-500" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                    </svg>{' '}
                    הסר משמירות
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>{' '}
                    שמור למועדפים
                  </>
                )}
              </button>

              {isAdmin && (
                <button
                  onClick={() => onTogglePin(item.id, item.is_pinned)}
                  className="w-full text-right px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-3 border-t border-slate-100"
                >
                  <svg className="w-5 h-5 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" />
                  </svg>
                  {item.is_pinned ? 'בטל נעיצה' : 'נעץ פריט'}
                </button>
              )}

              {isOwner && (
                <button
                  onClick={() => onStartEdit(item)}
                  className="w-full text-right px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-3 border-t border-slate-100"
                >
                  <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  ערוך מודעה
                </button>
              )}

              {(isOwner || isAdmin) && (
                <button
                  onClick={() => onDelete(item.id)}
                  className="w-full text-right px-4 py-3 text-sm font-bold text-red-500 hover:bg-red-50 flex items-center gap-3 border-t border-slate-100"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  מחק לצמיתות
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* עריכה מהירה מותאמת */}
      {editingItemId === item.id ? (
        <form onSubmit={(e) => onSubmitEdit(e, item.id)} className="p-2 flex flex-col gap-3 bg-slate-50 rounded-2xl mt-4 border border-slate-100">
          <input
            type="text"
            required
            value={editItemData.title}
            onChange={(e) => onUpdateEditData({ ...editItemData, title: e.target.value })}
            className="w-full bg-white border border-white rounded-xl px-3 py-4 text-sm outline-none focus:border-purple-300 shadow-sm"
            placeholder="כותרת"
          />
          <div className="flex gap-3">
            <select
              value={editItemData.category}
              onChange={(e) => onUpdateEditData({ ...editItemData, category: e.target.value })}
              className="flex-1 bg-white border border-white rounded-xl px-3 py-4 text-sm outline-none shadow-sm"
            >
              {mainCategories.filter((c) => c !== 'הכל').map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
              <option value="בקשות שכנים">בקשות שכנים</option>
            </select>
            {editItemData.category !== 'בקשות שכנים' && editItemData.category !== 'למסירה' && (
              <input
                type="number"
                value={editItemData.price}
                onChange={(e) => onUpdateEditData({ ...editItemData, price: e.target.value })}
                className="flex-1 bg-white border border-white rounded-xl px-3 py-4 text-sm outline-none shadow-sm"
                placeholder="מחיר"
              />
            )}
          </div>
          <input
            type="tel"
            required
            value={editItemData.contact_phone}
            onChange={(e) => onUpdateEditData({ ...editItemData, contact_phone: e.target.value })}
            className="w-full bg-white border border-white rounded-xl px-3 py-4 text-sm outline-none text-left shadow-sm"
            dir="ltr"
            placeholder="050-0000000"
          />
          <textarea
            value={editItemData.description}
            onChange={(e) => onUpdateEditData({ ...editItemData, description: e.target.value })}
            className="w-full bg-white border border-white rounded-xl px-3 py-4 text-sm outline-none min-h-[80px] shadow-sm"
            placeholder="תיאור"
          />

          <div className="flex justify-end gap-3 mt-2">
            <button
              type="button"
              onClick={onCancelEdit}
              className="h-12 px-6 flex items-center justify-center text-sm font-bold text-slate-500 bg-white border border-slate-100 rounded-xl hover:bg-slate-50 transition shadow-sm"
            >
              ביטול
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="h-12 px-6 flex items-center justify-center text-sm font-bold text-white bg-purple-600 rounded-xl shadow-sm transition active:scale-95"
            >
              {isSubmitting ? 'שומר...' : 'שמור מודעה'}
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className="flex gap-4 min-h-[100px] relative mt-1.5">
            {!isRequest && (
              <div
                className="w-[100px] h-[110px] rounded-[1.2rem] bg-slate-50 shrink-0 border border-slate-100 overflow-hidden cursor-pointer relative shadow-sm"
                onClick={() => item.media_url && onMediaClick(item.media_url, item.media_type || 'image')}
              >
                {item.media_url ? (
                  item.media_type === 'video' ? (
                    <>
                      <video src={item.media_url} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                        <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </>
                  ) : (
                    <img src={item.media_url} alt="מודעה" className="w-full h-full object-cover" />
                  )
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-purple-600/20 bg-purple-600/5">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
              </div>
            )}

            <div className={`flex-1 py-1 flex flex-col pt-1 ${!isRequest ? 'pl-5' : 'pl-2'}`}>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <h3 className={`font-black text-base leading-tight line-clamp-1 pr-1 ${isRequest ? 'text-emerald-800' : 'text-slate-800'}`}>
                  {item.title}
                </h3>
              </div>

              {!isRequest && (
                <div className="mb-2">
                  <span
                    className={`text-[10px] font-black px-2.5 py-1 rounded-lg border shadow-sm ${
                      item.price === 0 || item.category === 'למסירה' ? 'bg-rose-50 text-rose-500 border-rose-100' : 'bg-purple-50 text-purple-600 border-purple-100'
                    }`}
                  >
                    {item.price === 0 || item.category === 'למסירה' ? 'ללא עלות' : `₪${item.price.toLocaleString()}`}
                  </span>
                </div>
              )}

              <p className={`text-[13px] font-medium leading-snug line-clamp-2 ${isRequest ? 'text-emerald-700' : 'text-slate-600'}`}>
                {item.description}
              </p>

              <div className="mt-auto text-[11px] text-slate-400 font-bold flex items-center justify-between pt-3">
                <span className="flex items-center gap-1.5">
                  <img
                    src={item.profiles?.avatar_url || `https://api.dicebear.com/8.x/initials/svg?seed=${item.profiles?.full_name || 'U'}&backgroundColor=EFF6FF&textColor=1D4ED8`}
                    className="w-6 h-6 rounded-full border border-gray-100 shadow-sm object-cover"
                    alt="avatar"
                  />
                  {item.profiles?.full_name || 'שכן'}
                </span>
                <span>{timeFormat(item.created_at)}</span>
              </div>
            </div>
          </div>

          {/* תגובות מהירות לבקשות שכנים מוגדלות */}
          {!isOwner && isRequest && (
            <div className="flex gap-2 mt-4 pt-3 border-t border-emerald-100/50">
              <button
                onClick={() => onQuickReply(item, 'יש לי את זה! 🙋‍♂️')}
                className="flex-1 h-12 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-xl font-bold text-xs active:scale-95 transition hover:bg-emerald-100 shadow-sm flex items-center justify-center"
              >
                יש לי!
              </button>
              <button
                onClick={() => onQuickReply(item, 'בוא/י לקחת באהבה 🎁')}
                className="flex-1 h-12 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-xl font-bold text-xs active:scale-95 transition hover:bg-emerald-100 shadow-sm flex items-center justify-center"
              >
                בוא/י לקחת
              </button>
              <button
                onClick={() => onQuickReply(item, 'אשמח לעזור עם זה ✨')}
                className="flex-1 h-12 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-xl font-bold text-xs active:scale-95 transition hover:bg-emerald-100 shadow-sm flex items-center justify-center"
              >
                אשמח לעזור
              </button>
            </div>
          )}

          {/* יצירת קשר למודעות רגילות מוגדלות */}
          {!isOwner && !isRequest && item.contact_phone && (
            <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100">
              <a
                href={formatWhatsApp(item.contact_phone)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 h-12 bg-[#25D366] text-white rounded-xl flex items-center justify-center gap-2 font-bold text-sm active:scale-95 transition shadow-sm"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347" />
                </svg>
                וואטסאפ
              </a>
              <a
                href={`tel:${item.contact_phone}`}
                className="flex-1 h-12 bg-purple-600 text-white rounded-xl flex items-center justify-center gap-2 font-bold text-sm active:scale-95 transition shadow-sm"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                חייג לשכן
              </a>
            </div>
          )}
        </>
      )}
    </div>
  );
}

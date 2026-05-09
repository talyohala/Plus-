import React from 'react';

export interface Ticket {
  id: string;
  title: string;
  description?: string;
  status: string;
  image_url?: string;
  is_pinned: boolean;
  created_at: string;
  user_id: string;
  ai_tags?: string[];
  profiles?: {
    full_name: string;
    apartment?: string;
    avatar_url?: string;
  };
}

export interface Vendor {
  id: string;
  name: string;
  profession: string;
  phone: string;
  is_fixed: boolean;
  rating?: number;
  recommender_id: string;
  profiles?: {
    full_name: string;
  };
}

interface TicketCardProps {
  ticket: Ticket;
  isAdmin: boolean;
  currentUserId?: string;
  toastId: string | null;
  matchResult: { vendor: Vendor; type: 'fixed' | 'recommended' } | null;
  onPressStart: (ticket: Ticket) => void;
  onPressEnd: () => void;
  onShowToast: (id: string) => void;
  onImageClick: (url: string) => void;
  onUpdateStatus: (id: string, status: string, userId: string, title: string) => void;
  formatWhatsApp: (phone: string, text: string) => string;
  timeFormat: (dateStr: string) => string;
}

export default function TicketCard({
  ticket,
  isAdmin,
  currentUserId,
  toastId,
  matchResult,
  onPressStart,
  onPressEnd,
  onShowToast,
  onImageClick,
  onUpdateStatus,
  formatWhatsApp,
  timeFormat,
}: TicketCardProps) {
  const vendorMessage = matchResult
    ? `היי ${matchResult.vendor.name}, מדברים מוועד הבית.\nאשמח לעזרתך לגבי: ${ticket.title}\nתיאור: ${ticket.description || ''}\nנוכל לתאם?`
    : '';

  const shouldShowDesc = ticket.description && ticket.description !== ticket.title && ticket.description.length >= 40;

  return (
    <div className={`relative ${toastId === ticket.id ? 'z-50' : 'z-0'}`}>
      {toastId === ticket.id && (
        <div className="absolute -top-10 left-2 bg-[#FFF7ED] border border-[#FED7AA] text-[#F97316] text-[11px] font-black px-3 py-1.5 rounded-xl shadow-sm animate-in slide-in-from-bottom-2 fade-in pointer-events-none whitespace-nowrap">
          לחיצה ארוכה לניהול
        </div>
      )}
      <div
        onTouchStart={() => onPressStart(ticket)}
        onTouchEnd={onPressEnd}
        onTouchMove={onPressEnd}
        onClick={() => {
          if (isAdmin || currentUserId === ticket.user_id) {
            onShowToast(ticket.id);
          }
        }}
        className={`bg-white p-5 rounded-3xl shadow-[0_2px_20px_rgb(0,0,0,0.03)] border ${
          ticket.is_pinned ? 'border-orange-500/30' : 'border-gray-100/60'
        } flex flex-col gap-2 relative overflow-hidden text-right transition-transform active:scale-[0.98] select-none [-webkit-touch-callout:none]`}
      >
        <div
          className={`absolute top-0 right-0 w-1.5 h-full ${
            ticket.status === 'פתוח' ? 'bg-red-400' : ticket.status === 'בטיפול' ? 'bg-orange-400' : 'bg-green-400'
          }`}
        />

        <div className="flex justify-between items-center pr-2 pointer-events-none">
          <div className="flex items-center gap-2">
            {ticket.profiles?.avatar_url ? (
              <img src={ticket.profiles.avatar_url} className="w-8 h-8 rounded-full border border-gray-100 object-cover" alt="פרופיל" />
            ) : (
              <img
                src={`https://api.dicebear.com/8.x/initials/svg?seed=${ticket.profiles?.full_name || 'User'}&backgroundColor=eef2ff&textColor=f97316`}
                className="w-8 h-8 rounded-full border border-gray-100 object-cover"
                alt="פרופיל"
              />
            )}
            <div>
              <p className="text-xs font-bold text-slate-800">{ticket.profiles?.full_name || 'דייר'}</p>
              <p className="text-[10px] text-gray-400">{timeFormat(ticket.created_at)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {ticket.is_pinned && (
              <svg className="w-3.5 h-3.5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
              </svg>
            )}
            <span
              className={`text-[10px] font-black px-2.5 py-1 rounded-lg ${
                ticket.status === 'פתוח'
                  ? 'text-red-500 bg-red-50'
                  : ticket.status === 'בטיפול'
                  ? 'text-orange-500 bg-orange-50'
                  : 'text-green-500 bg-green-50'
              }`}
            >
              {ticket.status}
            </span>
          </div>
        </div>

        <div className="pr-2 mt-1 pointer-events-none">
          <p className="text-sm font-black text-slate-800 flex items-center gap-1.5">{ticket.title}</p>
          {shouldShowDesc && (
            <p className="text-xs text-gray-600 mt-2 leading-relaxed bg-gray-50/80 p-3 rounded-xl border border-gray-50">
              "{ticket.description}"
            </p>
          )}
        </div>

        {ticket.image_url && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              if (ticket.image_url) onImageClick(ticket.image_url);
            }}
            className="w-full h-32 rounded-2xl overflow-hidden cursor-pointer mt-2 border border-gray-50 relative z-10"
          >
            <img src={ticket.image_url} className="w-full h-full object-cover pointer-events-none" alt="תמונה" />
          </div>
        )}

        {isAdmin && ticket.status !== 'טופל' && (
          <div className="mt-3 bg-gradient-to-r from-orange-50/50 to-amber-50/50 border border-orange-100/50 rounded-2xl p-3 relative z-10 flex items-center justify-between">
            <div onClick={(e) => e.stopPropagation()}>
              <p className="text-[10px] font-black text-orange-600 flex items-center gap-1">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" />
                </svg>
                זיהוי מערכת
              </p>
              {matchResult ? (
                <>
                  <p className="text-xs font-bold text-slate-800 mt-0.5">
                    סיווג: מתאים ל{matchResult.vendor.name} ({matchResult.vendor.profession})
                  </p>
                  {matchResult.type === 'recommended' && (
                    <p className="text-[9px] text-slate-600 mt-0.5 font-bold">
                      הומלץ ע"י {matchResult.vendor.profiles?.full_name}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-xs font-bold text-slate-800 mt-0.5">
                  הבעיה דורשת: <span className="text-orange-500">{ticket.ai_tags?.[0] || 'איש מקצוע'}</span>
                </p>
              )}
            </div>
            {matchResult && (
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={`tel:${matchResult.vendor.phone}`}
                  onClick={(e) => e.stopPropagation()}
                  className="w-10 h-10 rounded-xl bg-[#2D5AF0] text-white shadow-md active:scale-95 transition flex items-center justify-center pointer-events-auto"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </a>
                <a
                  href={formatWhatsApp(matchResult.vendor.phone, vendorMessage)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="w-10 h-10 rounded-xl bg-[#25D366] text-white shadow-md active:scale-95 transition flex items-center justify-center pointer-events-auto"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347" />
                  </svg>
                </a>
              </div>
            )}
          </div>
        )}

        {isAdmin && ticket.status !== 'טופל' && (
          <div className="flex gap-2 mt-3 pt-3 border-t border-gray-50 relative z-10">
            {ticket.status === 'פתוח' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdateStatus(ticket.id, 'בטיפול', ticket.user_id, ticket.title);
                }}
                className="flex-1 bg-orange-50 text-orange-600 text-xs font-bold py-2.5 rounded-xl transition active:scale-95"
              >
                העבר לטיפול
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onUpdateStatus(ticket.id, 'טופל', ticket.user_id, ticket.title);
              }}
              className="flex-1 bg-green-50 text-green-600 text-xs font-bold py-2.5 rounded-xl transition active:scale-95"
            >
              סמן כטופל
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

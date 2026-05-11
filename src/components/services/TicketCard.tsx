import React from 'react';

export interface ServiceTicket {
  id: string;
  building_id: string;
  user_id: string;
  title: string;
  description: string;
  category?: string;
  urgency?: string;
  status: string;
  image_url?: string;
  is_pinned?: boolean;
  created_at: string;
  profiles?: {
    full_name: string;
    avatar_url?: string;
    apartment?: string;
  };
}

interface TicketCardProps {
  ticket: ServiceTicket;
  currentUserId?: string;
  isAdmin: boolean;
  openMenuId: string | null;
  onToggleMenu: (id: string | null) => void;
  onUpdateStatus: (id: string, newStatus: string) => void;
  onTogglePin?: (id: string, currentStatus: boolean) => void;
  onDelete: (id: string) => void;
  onImageClick: (url: string) => void;
}

export default function TicketCard({
  ticket,
  currentUserId,
  isAdmin,
  openMenuId,
  onToggleMenu,
  onUpdateStatus,
  onTogglePin,
  onDelete,
  onImageClick,
}: TicketCardProps) {
  const isOwner = currentUserId === ticket.user_id;
  const isOpen = openMenuId === ticket.id;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'טופל':
        return { text: 'טופל', style: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
      case 'בטיפול':
        return { text: 'בטיפול', style: 'bg-orange-100 text-orange-800 border-orange-200' };
      default:
        return { text: 'פתוח', style: 'bg-[#1D4ED8]/10 text-[#1D4ED8] border-[#1D4ED8]/20' };
    }
  };

  const getUrgencyBadge = (urgency?: string) => {
    if (urgency === 'דחוף') return 'bg-rose-50 text-rose-600 border-rose-100';
    if (urgency === 'בינוני') return 'bg-amber-50 text-amber-600 border-amber-100';
    return 'bg-slate-50 text-slate-500 border-slate-100';
  };

  const badge = getStatusBadge(ticket.status);

  const timeFormat = (dateStr: string) => {
    const date = new Date(dateStr);
    const diffDays = Math.floor((Date.now() - date.getTime()) / (1000 * 3600 * 24));
    if (diffDays === 0) return date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
    if (diffDays === 1) return 'אתמול';
    return date.toLocaleDateString('he-IL');
  };

  const shareToWhatsApp = () => {
    const text = encodeURIComponent(`*עדכון תקלה בבניין:* ${ticket.title}\n*סטטוס:* ${ticket.status}\n*דווח על ידי:* ${ticket.profiles?.full_name || 'שכן'}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
    onToggleMenu(null);
  };

  return (
    <div className={`bg-white/90 backdrop-blur-xl p-4 pt-7 rounded-[1.5rem] shadow-[0_4px_20px_rgba(29,78,216,0.03)] border transition-all relative ${
      ticket.is_pinned ? 'border-[#1D4ED8]/40 shadow-[0_0_20px_rgba(29,78,216,0.1)] bg-white/95' : 'border-[#1D4ED8]/10'
    } ${isOpen ? 'z-[100]' : 'z-10'}`} dir="rtl">
      
      <div className={`absolute top-0 right-0 text-[10px] font-black px-3 py-1 rounded-tr-[1.5rem] rounded-bl-xl shadow-sm z-10 border-b border-l ${badge.style}`}>
        {badge.text} {ticket.is_pinned && '📌'}
      </div>

      <div className="absolute top-2 left-2 z-50">
        <button onClick={(e) => { e.stopPropagation(); onToggleMenu(isOpen ? null : ticket.id); }} className="w-8 h-8 flex items-center justify-center transition hover:scale-110 text-slate-400 hover:text-[#1D4ED8] relative z-10">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" /></svg>
        </button>

        {isOpen && (
          <div className="absolute left-0 top-8 w-48 bg-white/95 backdrop-blur-xl border border-[#1D4ED8]/20 shadow-[0_10px_40px_rgba(0,0,0,0.15)] rounded-2xl z-[150] overflow-hidden py-1 text-right font-medium">
            <button onClick={shareToWhatsApp} className="w-full text-right px-4 py-3 text-xs text-slate-700 hover:bg-[#1D4ED8]/5 flex items-center gap-2.5">
              <svg className="w-4 h-4 text-[#25D366] shrink-0 fill-current" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.305-.883-.653-1.48-1.459-1.653-1.758-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.413z"/></svg>
              <span>שתף לוואטסאפ</span>
            </button>

            {isAdmin && (
              <>
                {onTogglePin && (
                  <button onClick={() => { onTogglePin(ticket.id, !!ticket.is_pinned); onToggleMenu(null); }} className="w-full text-right px-4 py-3 text-xs text-slate-700 hover:bg-[#1D4ED8]/5 flex items-center gap-2.5 border-t border-slate-50">
                    <svg className="w-4 h-4 text-[#1D4ED8] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h-8a1 1 0 0 0-1 1v5l-1.5 3.5h11l-1.5-3.5v-5a1 1 0 0 0-1-1z" /><path d="M12 14v7" /></svg>
                    <span>{ticket.is_pinned ? 'בטל נעיצה' : 'נעץ תקלה'}</span>
                  </button>
                )}
                <button onClick={() => { onUpdateStatus(ticket.id, 'בטיפול'); onToggleMenu(null); }} className="w-full text-right px-4 py-3 text-xs text-slate-700 hover:bg-[#1D4ED8]/5 flex items-center gap-2.5 border-t border-slate-50">
                  <svg className="w-4 h-4 text-orange-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 15 15" /></svg>
                  <span>סמן כ״בטיפול״</span>
                </button>
                <button onClick={() => { onUpdateStatus(ticket.id, 'טופל'); onToggleMenu(null); }} className="w-full text-right px-4 py-3 text-xs text-slate-700 hover:bg-emerald-50 flex items-center gap-2.5 border-t border-slate-50">
                  <svg className="w-4 h-4 text-emerald-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  <span>סמן כ״טופל״</span>
                </button>
              </>
            )}

            {(isAdmin || isOwner) && (
              <button onClick={() => { onDelete(ticket.id); onToggleMenu(null); }} className="w-full text-right px-4 py-3 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2.5 border-t border-slate-50 font-bold">
                <svg className="w-4 h-4 text-red-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                <span>מחק תקלה</span>
              </button>
            )}
          </div>
        )}
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-40 bg-transparent" onClick={() => onToggleMenu(null)} />
      )}

      <div className="flex gap-3 min-h-[70px] relative mt-1">
        {ticket.image_url && (
          <div onClick={() => onImageClick(ticket.image_url!)} className="w-[80px] h-[85px] rounded-2xl bg-slate-50 shrink-0 border border-[#1D4ED8]/10 overflow-hidden cursor-pointer relative shadow-sm">
            <img src={ticket.image_url} alt="תקלה" className="w-full h-full object-cover" />
          </div>
        )}

        <div className="flex-1 py-0.5 flex flex-col pl-1 text-right justify-between">
          <div>
            <h3 className="font-black text-xs text-slate-800 tracking-tight leading-snug line-clamp-1 mb-1">{ticket.title}</h3>
            <p className="text-[11px] font-medium leading-relaxed tracking-wide text-slate-600 line-clamp-2">{ticket.description}</p>
          </div>

          <div className="mt-2 text-[10px] text-slate-400 font-bold flex items-center justify-between pt-2 border-t border-slate-50">
            <span className="flex items-center gap-1.5 text-slate-600">
              <img src={ticket.profiles?.avatar_url || `https://api.dicebear.com/8.x/initials/svg?seed=${ticket.profiles?.full_name || 'U'}&backgroundColor=EFF6FF&textColor=1D4ED8`} className="w-4 h-4 rounded-full border border-gray-100 shadow-sm object-cover" alt="avatar" />
              <span className="font-bold">{ticket.profiles?.full_name || 'שכן'}</span>
              {ticket.profiles?.apartment && <span className="text-[9px] bg-slate-100 px-1 py-0.2 rounded text-slate-500 font-medium">דירה {ticket.profiles.apartment}</span>}
            </span>

            <div className="flex items-center gap-2">
              {ticket.urgency && (
                <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${getUrgencyBadge(ticket.urgency)} shrink-0`}>
                  {ticket.urgency}
                </span>
              )}
              <span>{timeFormat(ticket.created_at)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

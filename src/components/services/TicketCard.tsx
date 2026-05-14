import React from 'react';
import { WhatsAppIcon, DeleteIcon, PinIcon } from '../ui/ActionIcons';

export interface ServiceTicket {
  id: string; building_id: string; user_id: string; title: string; description: string;
  category?: string; urgency?: string; status: string; image_url?: string;
  is_pinned?: boolean; created_at: string;
  profiles?: { full_name: string; avatar_url?: string; apartment?: string; };
}

interface TicketCardProps {
  ticket: ServiceTicket; currentUserId?: string; isAdmin: boolean;
  openMenuId: string | null; onToggleMenu: (id: string | null) => void;
  onUpdateStatus: (id: string, newStatus: string) => void;
  onTogglePin?: (id: string, currentStatus: boolean) => void;
  onDelete: (id: string) => void; onImageClick: (url: string) => void;
}

export default function TicketCard({
  ticket, currentUserId, isAdmin, openMenuId, onToggleMenu, onUpdateStatus, onTogglePin, onDelete, onImageClick,
}: TicketCardProps) {
  const isOwner = currentUserId === ticket.user_id;
  const isOpen = openMenuId === ticket.id;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'טופל': return { text: 'טופל', style: 'bg-[#10B981] text-white' };
      case 'בטיפול': return { text: 'בטיפול', style: 'bg-orange-500 text-white' };
      default: return { text: 'פתוח', style: 'bg-[#1D4ED8] text-white' };
    }
  };

  const badge = getStatusBadge(ticket.status);
  const timeFormat = (dateStr: string) => {
    const date = new Date(dateStr);
    const diffDays = Math.floor((Date.now() - date.getTime()) / 86400000);
    if (diffDays === 0) return date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
    return diffDays === 1 ? 'אתמול' : date.toLocaleDateString('he-IL');
  };

  return (
    <div className={`bg-white/90 backdrop-blur-xl p-4 pt-8 rounded-[2rem] shadow-sm border transition-all relative overflow-hidden ${
      ticket.is_pinned ? 'border-amber-200 bg-gradient-to-br from-amber-50/80 to-white shadow-md' : 'border-[#1D4ED8]/10'
    } ${isOpen ? 'z-50' : 'z-10'}`} dir="rtl">
      
      <div className="absolute top-0 right-0 flex overflow-hidden rounded-bl-[1.5rem] rounded-tr-[2rem] z-10 shadow-sm">
        {ticket.is_pinned ? (
          <div className="px-4 py-1.5 bg-amber-500 text-white text-[10px] font-black tracking-wide">נעוץ</div>
        ) : (
          <div className={`px-4 py-1.5 font-black text-[10px] ${badge.style}`}>{badge.text}</div>
        )}
      </div>

      <div className="absolute top-2 left-2 z-50">
        <button onClick={(e) => { e.stopPropagation(); onToggleMenu(isOpen ? null : ticket.id); }} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-[#1D4ED8] bg-white/50 border border-slate-100 rounded-full transition">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" /></svg>
        </button>

        {isOpen && (
          <div className="absolute left-0 top-10 w-44 bg-white/95 backdrop-blur-xl border border-slate-100 shadow-[0_15px_50px_rgba(0,0,0,0.15)] rounded-2xl z-[150] py-1 overflow-hidden">
            <button onClick={() => { window.open(`https://wa.me/?text=${encodeURIComponent(ticket.title)}`, '_blank'); onToggleMenu(null); }} className="w-full text-right px-4 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2"><WhatsAppIcon className="w-4 h-4 text-[#25D366]" />שיתוף וואטסאפ</button>
            {isAdmin && onTogglePin && (
              <button onClick={() => { onTogglePin(ticket.id, !!ticket.is_pinned); onToggleMenu(null); }} className="w-full text-right px-4 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2 border-t border-slate-50"><PinIcon className={`w-4 h-4 ${ticket.is_pinned ? 'text-amber-500' : 'text-slate-400'}`} />{ticket.is_pinned ? 'ביטול נעיצה' : 'נעץ תקלה'}</button>
            )}
            {ticket.status === 'פתוח' && isAdmin && (
              <button onClick={() => { onUpdateStatus(ticket.id, 'בטיפול'); onToggleMenu(null); }} className="w-full text-right px-4 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2 border-t border-slate-50"><svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>סמן בטיפול</button>
            )}
            {ticket.status !== 'טופל' && isAdmin && (
              <button onClick={() => { onUpdateStatus(ticket.id, 'טופל'); onToggleMenu(null); }} className="w-full text-right px-4 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2 border-t border-slate-50"><svg className="w-4 h-4 text-[#10B981]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"></path></svg>סמן כטופל</button>
            )}
            {(isAdmin || isOwner) && (
              <button onClick={() => onDelete(ticket.id)} className="w-full text-right px-4 py-3 text-xs font-bold text-rose-600 hover:bg-red-50 flex items-center gap-2 border-t border-slate-50"><DeleteIcon className="w-4 h-4 text-rose-500" />מחק תקלה</button>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-3">
        {ticket.image_url && (
          <div onClick={() => onImageClick(ticket.image_url!)} className="w-20 h-20 rounded-2xl bg-slate-100 shrink-0 border border-white overflow-hidden cursor-pointer shadow-sm"><img src={ticket.image_url} className="w-full h-full object-cover" alt="תקלה" /></div>
        )}
        <div className="flex-1 py-0.5">
          <h3 className={`font-black text-sm mb-1 ${ticket.is_pinned ? 'text-amber-800' : 'text-slate-800'}`}>{ticket.title}</h3>
          <p className="text-[11px] font-medium text-slate-600 line-clamp-2 leading-relaxed">{ticket.description}</p>
          <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
               <img src={ticket.profiles?.avatar_url || `https://api.dicebear.com/8.x/initials/svg?seed=${ticket.profiles?.full_name}`} className="w-5 h-5 rounded-full border border-slate-200 shadow-sm" alt="avatar" />
               <span className="text-[10px] font-black text-slate-500">{ticket.profiles?.full_name} • דירה {ticket.profiles?.apartment || '?'}</span>
            </div>
            <span className="text-[9px] font-bold text-slate-400">{timeFormat(ticket.created_at)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

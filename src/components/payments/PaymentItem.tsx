import React from 'react';
import { DownloadIcon } from '../ui/ActionIcons'; // הוספנו אייקון הורדה אוניברסלי (יווצר בהמשך אם חסר)

export interface PaymentProfile {
  full_name: string;
  apartment?: string;
  avatar_url?: string;
  role?: string;
  phone?: string;
}

export interface PaymentRecord {
  id: string;
  title: string;
  amount: number;
  status: 'pending' | 'pending_approval' | 'paid' | 'exempt' | 'canceled';
  created_at: string;
  payer_id: string;
  building_id: string;
  is_pinned: boolean;
  profiles?: PaymentProfile;
}

interface PaymentItemProps {
  payment: PaymentRecord;
  type: 'pending' | 'approval' | 'history';
  currentUserId: string;
  isAdmin: boolean;
  toastId: string | null;
  onPressStart: (payment: PaymentRecord) => void;
  onPressEnd: () => void;
  onStartFlow: (payment: PaymentRecord) => void;
  onShowToast: (id: string) => void;
  onDownloadReceipt: (payment: PaymentRecord) => void;
  onApprove: (paymentId: string, payerId: string, title: string) => void;
  formatShortDate: (dateStr: string) => string;
}

export default function PaymentItem({
  payment,
  type,
  currentUserId,
  isAdmin,
  toastId,
  onPressStart,
  onPressEnd,
  onStartFlow,
  onShowToast,
  onDownloadReceipt,
  onApprove,
  formatShortDate,
}: PaymentItemProps) {
  const isPayerMe = payment.payer_id === currentUserId;
  const isOverdue = type === 'pending' && new Date().getTime() - new Date(payment.created_at).getTime() > 30 * 24 * 60 * 60 * 1000;

  const formatAmount = (amount: number) => (
    <div className="flex items-baseline gap-1" dir="ltr">
      <span className="text-[10px] text-slate-400 font-bold mb-0.5">₪</span>
      <span className="tracking-tight">{amount.toLocaleString()}</span>
    </div>
  );

  return (
    <div className="relative group z-10">
      {toastId === payment.id && (
        <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-[#E3F2FD] border border-[#BFDBFE] text-[#1D4ED8] text-[11px] font-black px-3 py-1.5 rounded-full shadow-sm animate-in slide-in-from-bottom-2 pointer-events-none whitespace-nowrap z-50">
          לחיצה ארוכה לאפשרויות
        </div>
      )}
      <div
        onTouchStart={() => onPressStart(payment)}
        onTouchEnd={onPressEnd}
        onTouchMove={onPressEnd}
        onClick={() => {
          if (isPayerMe && type === 'pending') onStartFlow(payment);
          else onShowToast(payment.id);
        }}
        className={`bg-white/90 backdrop-blur-xl border p-5 rounded-[2rem] flex items-center justify-between transition-transform active:scale-[0.98] select-none [-webkit-touch-callout:none] overflow-hidden ${
          payment.is_pinned
            ? 'border-2 border-[#1D4ED8] shadow-[0_0_15px_rgba(29,78,216,0.3)] bg-[#1D4ED8]/5'
            : 'border-[#1D4ED8]/10 shadow-[0_4px_15px_rgba(29,78,216,0.03)]'
        }`}
      >
        {/* תוויות עליונות */}
        <div className="absolute top-0 right-0 flex overflow-hidden rounded-bl-[1.5rem] rounded-tr-[2rem] shadow-sm z-10 border-b border-l border-white/20">
          <div className={`px-4 py-1.5 text-white text-[10px] font-black ${payment.status === 'paid' || payment.status === 'exempt' ? 'bg-[#10B981]' : payment.status === 'pending_approval' ? 'bg-orange-500' : 'bg-[#1D4ED8]'}`}>
            {payment.status === 'paid' ? 'שולם' : payment.status === 'exempt' ? 'פטור' : payment.status === 'pending_approval' ? 'ממתין לאישור' : 'פתוח לתשלום'}
          </div>
          {isOverdue && (
            <div className="px-3 py-1.5 bg-rose-50 text-rose-600 text-[10px] font-black border-r border-rose-100/50 animate-pulse">באיחור</div>
          )}
        </div>

        <div className="flex-1 pr-1 pt-4 pl-4">
          <h3 className={`text-[17px] font-black leading-tight mb-2.5 flex items-center gap-1.5 ${payment.is_pinned ? 'text-[#1D4ED8]' : 'text-slate-800'}`}>
            {payment.is_pinned && <svg className="w-4 h-4 text-[#1D4ED8] shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>}
            {payment.title}
          </h3>
          <div className="flex items-center gap-2.5 mt-2">
            <img src={payment.profiles?.avatar_url || `https://api.dicebear.com/8.x/initials/svg?seed=${payment.profiles?.full_name || 'U'}`} alt="avatar" className="w-8 h-8 rounded-full border border-slate-200 object-cover shadow-sm" />
            <div className="flex flex-col">
              <span className="text-[14px] font-black text-slate-700 leading-none flex items-center gap-1">
                {payment.profiles?.full_name || 'דייר'}
                {payment.profiles?.role === 'admin' && <span className="bg-[#1D4ED8]/10 text-[#1D4ED8] px-1.5 py-0.5 rounded-md font-black text-[9px] mr-1">ועד</span>}
              </span>
              <span className="text-[10px] font-bold text-slate-400 mt-1">
                דירה {payment.profiles?.apartment || '-'} • {formatShortDate(payment.created_at)}
              </span>
            </div>
          </div>
        </div>

        <div className="text-left shrink-0 flex flex-col items-end gap-2.5 pt-4">
          <div className={`text-lg font-black flex items-center justify-end ${type === 'history' ? 'text-[#059669]' : 'text-[#1D4ED8]'}`}>
            {formatAmount(payment.amount)}
          </div>

          {isPayerMe && type === 'pending' && (
            <button onClick={(e) => { e.stopPropagation(); onStartFlow(payment); }} className="h-9 px-6 bg-[#1D4ED8] text-white rounded-xl font-bold text-xs shadow-md active:scale-95 transition">
              תשלום
            </button>
          )}
          {isPayerMe && type === 'history' && (
            <button onClick={(e) => { e.stopPropagation(); onDownloadReceipt(payment); }} className="h-9 px-4 text-[11px] font-bold text-[#10B981] hover:text-emerald-700 transition flex items-center gap-1 bg-[#10B981]/10 border border-emerald-100 rounded-xl">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg> קבלה
            </button>
          )}
          {isAdmin && !isPayerMe && type === 'approval' && (
            <button onClick={(e) => { e.stopPropagation(); onApprove(payment.id, payment.payer_id, payment.title); }} className="h-9 px-5 bg-[#059669] text-white rounded-xl font-bold text-xs shadow-md active:scale-95 transition">
              אישור
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

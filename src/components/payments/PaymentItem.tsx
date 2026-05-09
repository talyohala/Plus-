import React from 'react';

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
  const isOverdue =
    type === 'pending' &&
    new Date().getTime() - new Date(payment.created_at).getTime() > 30 * 24 * 60 * 60 * 1000;

  const formatAmount = (amount: number) => (
    <div className="flex items-baseline gap-1" dir="ltr">
      <span className="text-[10px] text-slate-400 font-bold mb-0.5">₪</span>
      <span>{amount.toLocaleString()}</span>
    </div>
  );

  return (
    <div className="relative group">
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
        className={`bg-white/70 backdrop-blur-xl border p-4 rounded-3xl flex items-center justify-between transition-transform active:scale-[0.98] select-none [-webkit-touch-callout:none] overflow-hidden ${
          payment.is_pinned
            ? 'border-[#1D4ED8]/60 shadow-[0_0_25px_rgba(29,78,216,0.15)] bg-[#1D4ED8]/5'
            : 'border-white/80 shadow-sm'
        }`}
      >
        {payment.is_pinned && (
          <div className="absolute top-0 right-4 bg-[#1D4ED8] text-white text-[9px] font-black px-2.5 py-0.5 rounded-b-lg shadow-sm z-10 flex items-center gap-1">
            <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          </div>
        )}

        <div className="flex-1 pr-1">
          <h4 className={`font-black text-[15px] ${payment.is_pinned ? 'mt-2 text-[#1D4ED8]' : 'text-slate-800'}`}>
            {payment.title}
          </h4>
          <div className="text-[9px] font-bold text-slate-400 mt-0.5 mb-1.5 flex items-center gap-1.5">
            {formatShortDate(payment.created_at)}
            {isOverdue && (
              <span className="bg-red-50 text-red-500 px-1.5 py-0.5 rounded-md font-black border border-red-100">
                באיחור
              </span>
            )}
          </div>
          <div className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5">
            {payment.profiles?.avatar_url && (
              <img src={payment.profiles.avatar_url} alt="avatar" className="w-4 h-4 rounded-full object-cover" />
            )}
            <span className="truncate">{payment.profiles?.full_name || 'דייר'}</span>
            {payment.profiles?.role === 'admin' && (
              <span className="bg-[#1D4ED8]/10 text-[#1D4ED8] px-1.5 py-0.5 rounded-md font-black text-[9px]">
                ועד
              </span>
            )}
            <span>דירה {payment.profiles?.apartment || '?'}</span>
          </div>
        </div>

        <div className="text-left shrink-0 flex flex-col items-end gap-2.5">
          <div
            className={`text-lg font-black flex items-center justify-end ${
              type === 'history' ? 'text-[#059669]' : 'text-[#1D4ED8]'
            }`}
          >
            {formatAmount(payment.amount)}
          </div>

          {isPayerMe && type === 'pending' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onStartFlow(payment);
              }}
              className="bg-[#1D4ED8] text-white text-[11px] font-black px-5 py-2.5 rounded-xl shadow-md active:scale-95 transition"
            >
              שלם
            </button>
          )}
          {isPayerMe && type === 'history' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDownloadReceipt(payment);
              }}
              className="text-[10px] font-bold text-[#1D4ED8] hover:text-[#0044cc] transition flex items-center gap-1 bg-[#1D4ED8]/10 px-3.5 py-2 rounded-xl"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>{' '}
              קבלה
            </button>
          )}
          {isAdmin && !isPayerMe && type === 'approval' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onApprove(payment.id, payment.payer_id, payment.title);
              }}
              className="bg-[#059669] text-white text-[11px] font-black px-4 py-2.5 rounded-xl shadow-md active:scale-95 transition"
            >
              אשר
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

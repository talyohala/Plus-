import React from 'react';
import { PaymentRecord } from './PaymentItem';

export interface SavedCard {
  id: string;
  type: string;
  last4: string;
  exp: string;
}

interface CheckoutFlowProps {
  payingItem: PaymentRecord;
  step: 'select' | 'new_card' | 'processing' | 'success';
  savedCards: SavedCard[];
  newCardDetails: { number: string; expiry: string; cvv: string; saveCard: boolean };
  onClose: () => void;
  onSetStep: (step: 'select' | 'new_card' | 'processing' | 'success') => void;
  onUpdateCardDetails: (details: { number: string; expiry: string; cvv: string; saveCard: boolean }) => void;
  onProcessPayment: (method: string) => void;
  onDeleteSavedCard: (cardId: string) => void;
}

export default function CheckoutFlow({
  payingItem,
  step,
  savedCards,
  newCardDetails,
  onClose,
  onSetStep,
  onUpdateCardDetails,
  onProcessPayment,
  onDeleteSavedCard,
}: CheckoutFlowProps) {
  return (
    <div className="w-full text-right" dir="rtl">
      <h3 className="font-black text-2xl text-slate-800 mb-6 text-center">הסדרת תשלום</h3>

      <div className="bg-white rounded-2xl p-4 mb-6 flex justify-between items-center border border-gray-100 shadow-sm">
        <div>
          <p className="text-[10px] text-slate-400 font-bold mb-0.5 uppercase tracking-wider">עבור:</p>
          <p className="text-sm font-black text-slate-800">{payingItem.title}</p>
        </div>
        <div className="text-left">
          <p className="text-[10px] text-slate-400 font-bold mb-0.5 uppercase tracking-wider">לתשלום:</p>
          <div className="text-2xl font-black text-[#1D4ED8] flex items-end justify-end gap-1" dir="ltr">
            <span className="text-[12px] text-slate-400 mb-0.5">₪</span>
            {payingItem.amount.toLocaleString()}
          </div>
        </div>
      </div>

      {step === 'select' && (
        <div className="flex flex-col gap-3">
          <p className="text-[10px] font-black text-slate-400 tracking-wider uppercase mb-1">אמצעי תשלום</p>

          {savedCards.map((card) => (
            <div key={card.id} className="w-full flex items-center justify-between bg-white border border-[#1D4ED8]/10 p-4 rounded-xl shadow-sm hover:border-[#1D4ED8]/50 transition">
              <button onClick={() => onProcessPayment('saved_card')} className="flex items-center gap-3 flex-1 text-right">
                <div className="w-10 h-6 bg-slate-800 rounded shrink-0 flex items-center justify-center relative overflow-hidden shadow-sm">
                  <div className="absolute top-0 right-0 w-8 h-8 bg-white/10 rounded-full -mr-4 -mt-4" />
                  <span className="text-[8px] font-black text-white tracking-widest italic">VISA</span>
                </div>
                <div>
                  <p className="text-sm font-black text-slate-800 font-mono tracking-widest">**** {card.last4}</p>
                </div>
              </button>
              <button onClick={() => onDeleteSavedCard(card.id)} className="p-2 text-gray-300 hover:text-red-500 transition hover:bg-red-50 rounded-lg">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))}

          <button onClick={() => onSetStep('new_card')} className="w-full flex items-center justify-center gap-2 bg-white text-[#1D4ED8] border border-[#1D4ED8]/30 py-4 rounded-xl font-bold hover:bg-[#1D4ED8]/5 active:scale-95 transition shadow-sm">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
            </svg>
            הוסף כרטיס אשראי חדש
          </button>

          <div className="relative flex items-center justify-center mt-4 mb-2">
            <div className="border-t border-gray-200 w-full absolute" />
            <span className="bg-white/95 backdrop-blur-xl px-3 text-[10px] font-bold text-slate-400 relative z-10 uppercase tracking-widest">או</span>
          </div>

          <button onClick={() => onProcessPayment('bit')} className="w-full flex items-center justify-between px-5 bg-white border border-[#1D4ED8]/10 py-4 rounded-xl font-bold hover:bg-gray-50 active:scale-95 transition shadow-sm">
            <div className="flex items-center gap-3 text-slate-800">
              <div className="w-8 h-8 rounded-full bg-[#1D4ED8]/10 flex items-center justify-center text-[#1D4ED8]">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              דיווח תשלום בביט/מזומן
            </div>
          </button>
        </div>
      )}

      {step === 'new_card' && (
        <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-right-4">
          <button onClick={() => onSetStep('select')} className="text-[10px] font-bold text-[#1D4ED8] flex items-center gap-1 mb-2">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
            </svg>{' '}
            חזור לאמצעי תשלום
          </button>

          <div>
            <input
              type="text"
              placeholder="מספר כרטיס אשראי"
              maxLength={19}
              className="w-full bg-white border border-[#1D4ED8]/20 rounded-xl px-4 py-3.5 text-sm outline-none focus:border-[#1D4ED8] transition font-mono tracking-widest text-left shadow-sm"
              dir="ltr"
              value={newCardDetails.number}
              onChange={(e) => onUpdateCardDetails({ ...newCardDetails, number: e.target.value })}
            />
          </div>

          <div className="flex gap-3">
            <input
              type="text"
              placeholder="תוקף (MM/YY)"
              maxLength={5}
              className="flex-1 bg-white border border-[#1D4ED8]/20 rounded-xl px-4 py-3.5 text-sm outline-none focus:border-[#1D4ED8] transition font-mono text-center shadow-sm"
              dir="ltr"
              value={newCardDetails.expiry}
              onChange={(e) => onUpdateCardDetails({ ...newCardDetails, expiry: e.target.value })}
            />
            <input
              type="password"
              placeholder="CVV"
              maxLength={3}
              className="flex-1 bg-white border border-[#1D4ED8]/20 rounded-xl px-4 py-3.5 text-sm outline-none focus:border-[#1D4ED8] transition font-mono text-center tracking-widest shadow-sm"
              dir="ltr"
              value={newCardDetails.cvv}
              onChange={(e) => onUpdateCardDetails({ ...newCardDetails, cvv: e.target.value })}
            />
          </div>

          <label className="flex items-center gap-3 p-4 rounded-xl border border-[#1D4ED8]/20 bg-[#1D4ED8]/5 cursor-pointer mt-2 shadow-sm">
            <input
              type="checkbox"
              checked={newCardDetails.saveCard}
              onChange={(e) => onUpdateCardDetails({ ...newCardDetails, saveCard: e.target.checked })}
              className="w-4 h-4 text-[#1D4ED8] rounded border-gray-300"
            />
            <span className="text-xs font-bold text-slate-800">שמור כרטיס לתשלומים הבאים בבניין</span>
          </label>

          <button onClick={() => onProcessPayment('new_card')} className="w-full bg-[#1D4ED8] text-white font-bold py-4 rounded-xl shadow-[0_8px_20px_rgba(29,78,216,0.3)] mt-4 active:scale-95 transition">
            בצע תשלום
          </button>
        </div>
      )}

      {step === 'processing' && (
        <div className="flex flex-col items-center justify-center py-10 gap-4">
          <div className="w-12 h-12 border-4 border-[#1D4ED8]/20 border-t-[#1D4ED8] rounded-full animate-spin" />
          <p className="font-bold text-[#1D4ED8] animate-pulse">מעבד תשלום מאובטח...</p>
        </div>
      )}

      {step === 'success' && (
        <div className="flex flex-col items-center justify-center py-6 gap-3 animate-in zoom-in">
          <div className="w-20 h-20 bg-[#059669]/10 text-[#059669] rounded-full flex items-center justify-center mb-2 shadow-sm">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-2xl font-black text-slate-800">התשלום בוצע!</h3>
          <p className="text-sm text-slate-500 text-center">העברת ₪{payingItem.amount.toLocaleString()} נרשמה בהצלחה בקופה.</p>

          <button onClick={onClose} className="w-full bg-[#1D4ED8] text-white font-bold py-4 rounded-xl shadow-[0_8px_20px_rgba(29,78,216,0.3)] mt-6 active:scale-95 transition">
            סיום
          </button>
        </div>
      )}
    </div>
  );
}

import React, { useState } from 'react';

interface CreatePaymentModalProps {
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (title: string, amount: number) => Promise<void>;
}

export default function CreatePaymentModal({ isSubmitting, onClose, onSubmit }: CreatePaymentModalProps) {
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (!title.trim() || isNaN(parsedAmount) || parsedAmount <= 0) return;
    await onSubmit(title.trim(), parsedAmount);
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex justify-center items-end" dir="rtl">
      <div className="bg-white/95 backdrop-blur-xl w-full max-w-md rounded-t-[2rem] p-6 pb-8 shadow-2xl animate-in slide-in-from-bottom-10 border-t border-white/50">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-black text-xl text-slate-800">דרישת תשלום חדשה</h3>
          <button onClick={onClose} className="p-2 bg-gray-100 rounded-full text-slate-600 hover:bg-gray-200 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex gap-2 mb-4 overflow-x-auto hide-scrollbar pb-2">
          {['ועד בית', 'גינון ותחזוקה', 'תיקון מעלית'].map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setTitle(preset)}
              className="bg-[#1D4ED8]/10 text-[#1D4ED8] px-3 py-1.5 rounded-full text-[11px] font-bold shrink-0 border border-[#1D4ED8]/20 active:scale-95 transition"
            >
              {preset}
            </button>
          ))}
        </div>

        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-white border border-[#1D4ED8]/20 rounded-xl px-4 py-4 text-sm font-bold outline-none focus:border-[#1D4ED8] transition shadow-sm text-slate-800"
              placeholder="עבור מה? (לדוג': ועד חודש מאי)"
            />
          </div>
          <div>
            <input
              type="number"
              required
              min="1"
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-white border border-[#1D4ED8]/20 rounded-xl px-4 py-4 text-sm outline-none focus:border-[#1D4ED8] transition shadow-sm text-slate-800 font-black text-lg"
              placeholder="סכום פר דייר (₪)"
            />
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-[#1D4ED8] text-white font-bold py-4 rounded-xl shadow-[0_8px_20px_rgba(29,78,216,0.3)] mt-4 active:scale-95 transition disabled:opacity-50 text-base"
          >
            {isSubmitting ? 'משדר לכולם...' : 'שלח לכל הבניין'}
          </button>
        </form>
      </div>
    </div>
  );
}

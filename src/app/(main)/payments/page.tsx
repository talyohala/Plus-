'use client'

import React, { useEffect, useState } from 'react';
import useSWR from 'swr';
import { supabase } from '../../../lib/supabase';
import { playSystemSound } from '../../../components/providers/AppManager';

interface Payment { id: string; title: string; amount: number; status: string; created_at: string; }

const fetcher = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Unauthorized');
  
  const { data: payments } = await supabase.from('payments').select('*').eq('payer_id', session.user.id).order('created_at', { ascending: false });
  return { payments: payments || [] };
};

export default function PaymentsPage() {
  const { data, error, mutate } = useSWR('/api/payments/fetch', fetcher);
  const payments: Payment[] = data?.payments || [];
  const [activeTab, setActiveTab] = useState('לתשלום');

  const timeFormat = (dateStr: string) => { 
    const date = new Date(dateStr); 
    const diffDays = Math.floor((Date.now() - date.getTime()) / 86400000); 
    return diffDays === 0 ? date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : diffDays === 1 ? 'אתמול' : date.toLocaleDateString('he-IL'); 
  };

  const tabCounts: Record<string, number> = {
    'לתשלום': payments.filter(p => p.status === 'pending').length,
    'היסטוריה': payments.filter(p => p.status === 'paid').length
  };

  const filteredPayments = payments.filter(p => activeTab === 'לתשלום' ? p.status === 'pending' : p.status === 'paid');

  const handlePay = async (id: string) => {
    playSystemSound('click');
    // כאן בעתיד נתחבר לסליקה אמיתית, כרגע זה רק מעדכן סטטוס
    await supabase.from('payments').update({ status: 'paid' }).eq('id', id);
    playSystemSound('success');
    mutate();
  };

  if (!data && !error) return <div className="flex justify-center items-center h-[100dvh]"><div className="w-12 h-12 border-4 border-[#1D4ED8]/30 border-t-[#1D4ED8] rounded-full animate-spin"></div></div>;

  return (
    <div className="flex flex-col flex-1 w-full pb-32 relative bg-transparent min-h-[100dvh]" dir="rtl">
      <div className="px-4 mt-6 mb-5"><h2 className="text-2xl font-black text-slate-800 tracking-tight">תשלומים לוועד</h2></div>
      
      {/* טאבים עליונים בעיצוב קפסולות עקבי כמו בכל האפליקציה */}
      <div className="px-4 mb-6">
        <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
          {['לתשלום', 'היסטוריה'].map(tab => {
            const isActive = activeTab === tab;
            return (
              <button key={tab} onClick={() => { playSystemSound('click'); setActiveTab(tab); }} className={`px-5 h-10 rounded-full text-[13px] transition-all flex items-center justify-center font-bold gap-1.5 whitespace-nowrap shrink-0 border shadow-sm ${isActive ? 'bg-[#1D4ED8] text-white border-[#1D4ED8]' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
                <span>{tab}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>{tabCounts[tab]}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-4 space-y-4 animate-in fade-in duration-300">
         {filteredPayments.length === 0 ? (
            <div className="text-center py-16 bg-white/60 backdrop-blur-md rounded-[2rem] border border-[#1D4ED8]/10 shadow-sm">
              <div className="w-16 h-16 bg-[#10B981]/10 rounded-full flex items-center justify-center mx-auto mb-3 shadow-inner text-[#10B981]">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"></path></svg>
              </div>
              <p className="text-slate-500 font-bold text-sm">אין תשלומים פתוחים כרגע ✨</p>
            </div>
         ) : (
            filteredPayments.map(payment => (
              <div key={payment.id} className="bg-white/90 backdrop-blur-xl rounded-[1.5rem] p-5 border border-[#1D4ED8]/10 shadow-[0_4px_20px_rgba(29,78,216,0.03)] flex flex-col gap-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-base font-black text-slate-800">{payment.title}</h3>
                    <p className="text-[10px] font-bold text-slate-400 mt-0.5">הופק: {timeFormat(payment.created_at)}</p>
                  </div>
                  <div className="text-xl font-black text-[#1D4ED8] font-mono tracking-tighter bg-blue-50/50 px-3 py-1 rounded-xl">
                    ₪{payment.amount}
                  </div>
                </div>
                {payment.status === 'pending' && (
                  <button onClick={() => handlePay(payment.id)} className="w-full h-12 bg-[#1D4ED8] text-white font-bold rounded-xl mt-2 active:scale-95 transition shadow-sm flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path></svg>
                    שלם עכשיו
                  </button>
                )}
              </div>
            ))
         )}
      </div>
    </div>
  );
}

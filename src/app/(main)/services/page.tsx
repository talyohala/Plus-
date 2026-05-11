'use client'
import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { playSystemSound } from '../../../components/providers/AppManager';

const VENDOR_DICTIONARY: Record<string, string[]> = {
  'חשמלאי': ['חשמל', 'תאורה', 'מנורה', 'קצר', 'לוח חשמל', 'שקע'],
  'אינסטלטור': ['מים', 'אינסטלציה', 'פיצוץ', 'נזילה', 'ביוב', 'צינור', 'סתימה'],
  'טכנאי מעליות': ['מעלית', 'תקוע', 'דלת מעלית'],
  'איטום וזיפות': ['גשם', 'רטיבות', 'עובש', 'גג', 'קיר חיצוני'],
  'גינון': ['גינה', 'עצים', 'השקיה', 'דשא', 'גוזם'],
  'ניקיון ותחזוקה': ['ניקיון', 'פח', 'לובי', 'חדר מדרגות', 'חלונות']
};

interface ServiceTicket {
  id: string;
  title: string;
  description: string;
  status: string;
  ai_category?: string;
  tags?: string[];
  created_at: string;
  profiles?: { full_name: string };
  vendor_id?: string;
  cost?: number;
}

interface Vendor {
  id: string;
  name: string;
  category: string;
  phone: string;
  rating_avg: number;
  reviews_count: number;
}

export default function ServicesPage() {
  const [tickets, setTickets] = useState<ServiceTicket[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [buildingId, setBuildingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const fetchData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: prof } = await supabase.from('profiles').select('building_id').eq('id', user.id).single();
      if (!prof || !prof.building_id) return;

      setBuildingId(prof.building_id);

      const [ticketsRes, vendorsRes] = await Promise.all([
        supabase.from('service_tickets')
          .select('*, profiles(full_name)')
          .eq('building_id', prof.building_id)
          .order('created_at', { ascending: false }),
        supabase.from('vendors').select('*').order('rating_avg', { ascending: false })
      ]);

      if (ticketsRes.data) setTickets(ticketsRes.data);
      if (vendorsRes.data) setVendors(vendorsRes.data);
    } catch (err) {
      console.error("Services fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const findMatchingVendor = useCallback((tags?: string[] | null) => {
    if (!tags || !Array.isArray(tags) || !tags.length) return null;

    for (const tag of tags) {
      for (const [category, keywords] of Object.entries(VENDOR_DICTIONARY)) {
        if (keywords.some(kw => tag.includes(kw) || kw.includes(tag))) {
          const matched = vendors.find(v => v.category === category);
          if (matched) return matched;
        }
      }
    }
    return null;
  }, [vendors]);

  const updateTicketStatus = async (ticketId: string, newStatus: string) => {
    playSystemSound('click');
    await supabase.from('service_tickets').update({ status: newStatus }).eq('id', ticketId);
    fetchData();
  };

  if (isLoading) {
    return (
      <div className="flex flex-col flex-1 w-full items-center justify-center min-h-[100dvh] bg-[#F8FAFC]">
        <div className="w-16 h-16 border-4 border-orange-500/30 border-t-orange-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  const groupedTickets = {
    'פתוח': tickets.filter(t => t.status === 'פתוח' || t.status === 'open'),
    'בטיפול': tickets.filter(t => t.status === 'בטיפול' || t.status === 'in_progress'),
    'טופל': tickets.filter(t => t.status === 'טופל' || t.status === 'closed' || t.status === 'resolved'),
  };

  const renderGroup = (title: string, groupTickets: ServiceTicket[]) => {
    if (!groupTickets.length) return null;

    return (
      <div key={title} className="space-y-3">
        <h3 className="text-sm font-black text-slate-400 px-1">{title} ({groupTickets.length})</h3>
        {groupTickets.map(ticket => {
          const suggestedVendor = findMatchingVendor(ticket.tags || (ticket.ai_category ? [ticket.ai_category] : []));

          return (
            <div key={ticket.id} className="bg-white rounded-[1.5rem] p-5 shadow-sm border border-slate-100 flex flex-col gap-3">
              <div className="flex justify-between items-start gap-2">
                <div>
                  <h4 className="font-black text-lg text-slate-800">{ticket.title}</h4>
                  <p className="text-xs text-slate-400 mt-0.5">דווח ע"י {ticket.profiles?.full_name || 'דייר'} • {new Date(ticket.created_at).toLocaleDateString('he-IL')}</p>
                </div>
                <span className={`text-[10px] font-black px-3 py-1 rounded-full shrink-0 ${
                  ticket.status === 'פתוח' ? 'bg-orange-50 text-orange-600' :
                  ticket.status === 'בטיפול' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'
                }`}>
                  {ticket.status}
                </span>
              </div>

              <p className="text-sm text-slate-600 font-medium leading-relaxed bg-slate-50/50 p-3 rounded-xl">
                {ticket.description}
              </p>

              {suggestedVendor && ticket.status !== 'טופל' && (
                <div className="bg-orange-50/50 border border-orange-100 rounded-xl p-3 flex items-center justify-between gap-2 mt-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">⚡</span>
                    <div>
                      <p className="text-xs font-black text-orange-800">המלצת AI: {suggestedVendor.name}</p>
                      <p className="text-[10px] text-orange-600 font-medium">{suggestedVendor.category} • דירוג קהילתי: ⭐{suggestedVendor.rating_avg}</p>
                    </div>
                  </div>
                  <a 
                    href={`tel:${suggestedVendor.phone}`} 
                    onClick={() => playSystemSound('click')}
                    className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-4 py-2 rounded-lg transition active:scale-95 shrink-0"
                  >
                    חייג
                  </a>
                </div>
              )}

              {ticket.status !== 'טופל' && (
                <div className="flex gap-2 pt-1 border-t border-slate-50 mt-1">
                  {ticket.status === 'פתוח' && (
                    <button 
                      onClick={() => updateTicketStatus(ticket.id, 'בטיפול')}
                      className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold text-xs py-2.5 rounded-xl transition active:scale-95"
                    >
                      סמן כבטיפול
                    </button>
                  )}
                  <button 
                    onClick={() => updateTicketStatus(ticket.id, 'טופל')}
                    className="flex-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 font-bold text-xs py-2.5 rounded-xl transition active:scale-95"
                  >
                    סגור תקלה
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col flex-1 w-full min-h-[100dvh] bg-[#F8FAFC] pb-32" dir="rtl">
      <div className="px-6 pt-8 pb-4 flex justify-between items-center sticky top-0 bg-[#F8FAFC]/90 backdrop-blur-md z-30">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">תקלות ושירות</h2>
          <p className="text-xs font-bold text-slate-500 mt-0.5">ניהול חכם מבוסס AI</p>
        </div>
        <Link 
          href="/" 
          onClick={() => playSystemSound('click')}
          className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm border border-slate-100 text-slate-500 active:scale-95 transition"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg>
        </Link>
      </div>

      <div className="px-6 space-y-6 mt-2">
        {Object.entries(groupedTickets).map(([status, items]) => renderGroup(status, items))}

        {!tickets.length && (
          <div className="text-center py-20 bg-white rounded-[2rem] border border-slate-100 p-6 shadow-sm">
            <span className="text-4xl block mb-2">🌿</span>
            <h3 className="font-black text-slate-700 text-base">אין תקלות פתוחות בבניין</h3>
            <p className="text-xs text-slate-400 mt-1">הכל תקין ועובד כמו שצריך. להוספת תקלה הקלד בשורת ה-AI במסך הראשי.</p>
          </div>
        )}
      </div>
    </div>
  );
}

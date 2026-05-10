'use client'
import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { playSystemSound } from '../../components/providers/AppManager';

export default function HomePage() {
  const [profile, setProfile] = useState<any>(null);
  const [building, setBuilding] = useState<any>(null);
  const [unpaidCount, setUnpaidCount] = useState<number | null>(null);
  const [openTickets, setOpenTickets] = useState<number | null>(null);
  const [requestsCount, setRequestsCount] = useState<number | null>(null);
  const [latestAnnouncement, setLatestAnnouncement] = useState<any>(null);
  const [upcomingEvent, setUpcomingEvent] = useState<any>(null);
  const router = useRouter();

  const fetchData = useCallback(async () => {
    try {
      const { data: { user }, error: authErr } = await supabase.auth.getUser();
      
      // הגנה קריטית: אם אין משתמש בדפדפן הזה, זרוק אותו מיד להתחברות!
      if (authErr || !user) {
        router.push('/login');
        return;
      }

      const { data: prof } = await supabase.from('profiles').select('*, buildings(*)').eq('id', user.id).single();

      if (prof) {
        setProfile(prof);
        setBuilding(prof.buildings);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const [payRes, tickRes, reqRes, msgRes, eventsRes] = await Promise.all([
          supabase.from('payments').select('status').eq('payer_id', user.id),
          supabase.from('service_tickets').select('status').eq('building_id', prof.building_id),
          supabase.from('marketplace_items').select('status').eq('building_id', prof.building_id).eq('category', 'בקשות שכנים'),
          supabase.from('messages').select('content, created_at').order('created_at', { ascending: false }).limit(1),
          supabase.from('events').select('*').eq('building_id', prof.building_id).gte('event_date', today.toISOString()).order('event_date', { ascending: true })
        ]);

        setUnpaidCount(payRes.data ? payRes.data.filter(p => p.status !== 'שולם' && p.status !== 'paid' && p.status !== 'exempt').length : 0);
        setOpenTickets(tickRes.data ? tickRes.data.filter(t => t.status !== 'טופל').length : 0);
        setRequestsCount(reqRes.data ? reqRes.data.filter(r => r.status === 'available').length : 0);

        if (msgRes.data && msgRes.data.length > 0) {
          const msg = msgRes.data[0];
          const diffHours = (new Date().getTime() - new Date(msg.created_at).getTime()) / (1000 * 3600);
          setLatestAnnouncement(diffHours <= 72 ? msg : { content: 'אין הודעות חדשות 🌿', isPlaceholder: true });
        } else {
          setLatestAnnouncement({ content: 'אין הודעות חדשות 🌿', isPlaceholder: true });
        }

        if (eventsRes && !eventsRes.error && eventsRes.data && eventsRes.data.length > 0) {
          const activeEvent = eventsRes.data.find(e => e.status !== 'frozen') || eventsRes.data[0];
          setUpcomingEvent(activeEvent);
        } else {
          setUpcomingEvent({ isPlaceholder: true });
        }
      }
    } catch (err) {
      console.error("Home fetch error:", err);
      router.push('/login');
    }
  }, [router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="flex flex-col flex-1 w-full pb-24 space-y-6 relative" dir="rtl">
      <div className="px-5 mt-8 mb-2">
        <h1 className="text-3xl font-black text-slate-800 tracking-tight">
          שלום, {profile?.full_name?.split(' ')[0] || 'שכן'} 👋
        </h1>
        <p className="text-slate-500 font-bold text-base mt-1.5">מה נרצה לעשות היום?</p>
      </div>

      <div className="grid grid-cols-1 gap-4 px-4 relative z-10">
        {/* ועד הבית */}
        <Link href="/payments" onClick={() => playSystemSound('click')}
          className={`relative overflow-hidden p-6 rounded-[2rem] transition-all active:scale-[0.98] flex items-center gap-5 ${
            (unpaidCount !== null && unpaidCount > 0)
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-[0_0_25px_rgba(37,99,235,0.4)] border border-blue-400/50 scale-[1.02] z-20'
              : 'bg-white/80 backdrop-blur-md border border-white shadow-sm text-slate-800 hover:bg-white'
          }`}
        >
          {(unpaidCount !== null && unpaidCount > 0) && <div className="absolute inset-0 bg-blue-400/20 animate-pulse pointer-events-none" />}
          <div className={`relative p-4 rounded-2xl shrink-0 shadow-sm ${
            unpaidCount === null ? 'bg-slate-50 text-slate-400 border border-slate-100' :
            unpaidCount > 0 ? 'bg-white/20 text-white border border-white/30' : 'bg-blue-50 text-blue-600 border border-blue-100'
          }`}>
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
          </div>
          <div className="flex-1 relative z-10 min-w-0">
            <h2 className="text-xl font-black mb-0.5">ועד הבית</h2>
            <p className={`text-sm font-bold ${unpaidCount === null ? 'text-slate-400' : unpaidCount > 0 ? 'text-blue-100' : 'text-emerald-500'}`}>
              {unpaidCount === null ? 'טוען נתונים...' : unpaidCount > 0 ? `ממתינים ${unpaidCount} תשלומים להסדרה` : 'הכל משולם ומעודכן! ✨'}
            </p>
          </div>
        </Link>

        {/* תקלות ושירות */}
        <Link href="/services" onClick={() => playSystemSound('click')}
          className={`relative overflow-hidden p-6 rounded-[2rem] transition-all active:scale-[0.98] flex items-center gap-5 ${
            (openTickets !== null && openTickets > 0)
              ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-[0_0_25px_rgba(249,115,22,0.4)] border border-orange-400/50 scale-[1.02] z-20'
              : 'bg-white/80 backdrop-blur-md border border-white shadow-sm text-slate-800 hover:bg-white'
          }`}
        >
          {(openTickets !== null && openTickets > 0) && <div className="absolute inset-0 bg-orange-400/20 animate-pulse pointer-events-none" />}
          <div className={`relative p-4 rounded-2xl shrink-0 shadow-sm ${
            openTickets === null ? 'bg-slate-50 text-slate-400 border border-slate-100' :
            openTickets > 0 ? 'bg-white/20 text-white border border-white/30' : 'bg-orange-50 text-orange-500 border border-orange-100'
          }`}>
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          </div>
          <div className="flex-1 relative z-10 min-w-0">
            <h2 className="text-xl font-black mb-0.5">תקלות ושירות</h2>
            <p className={`text-sm font-bold ${openTickets === null ? 'text-slate-400' : openTickets > 0 ? 'text-orange-100' : 'text-emerald-500'}`}>
              {openTickets === null ? 'טוען נתונים...' : openTickets > 0 ? `${openTickets} תקלות בטיפול הוועד 🛠️` : 'הבניין תקין לחלוטין ✨'}
            </p>
          </div>
        </Link>

        {/* לוח מודעות */}
        <Link href="/marketplace" onClick={() => playSystemSound('click')}
          className={`relative overflow-hidden p-6 rounded-[2rem] transition-all active:scale-[0.98] flex items-center gap-5 ${
            (requestsCount !== null && requestsCount > 0)
              ? 'bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white shadow-[0_0_25px_rgba(168,85,247,0.4)] border border-purple-400/50 scale-[1.02] z-20'
              : 'bg-white/80 backdrop-blur-md border border-white shadow-sm text-slate-800 hover:bg-white'
          }`}
        >
          <div className={`relative p-4 rounded-2xl shrink-0 shadow-sm ${
            requestsCount === null ? 'bg-slate-50 text-slate-400 border border-slate-100' :
            requestsCount > 0 ? 'bg-white/20 text-white border border-white/30' : 'bg-purple-50 text-purple-600 border border-purple-100'
          }`}>
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
          </div>
          <div className="flex-1 relative z-10 min-w-0">
            <h2 className="text-xl font-black mb-0.5">לוח מודעות</h2>
            <p className={`text-sm font-bold ${requestsCount === null ? 'text-slate-400' : requestsCount > 0 ? 'text-purple-100' : 'text-emerald-500'}`}>
              {requestsCount === null ? 'טוען נתונים...' : requestsCount > 0 ? `יש ${requestsCount} בקשות משכנים 🤝` : 'אין בקשות פתוחות ☕'}
            </p>
          </div>
        </Link>

        {/* קבוצת הבניין */}
        <Link href="/chat" onClick={() => playSystemSound('click')}
          className="bg-white/80 backdrop-blur-md border border-white shadow-sm p-6 rounded-[2rem] flex items-center gap-5 text-slate-800 hover:bg-white"
        >
          <div className="p-4 bg-emerald-50 text-emerald-500 rounded-2xl shrink-0 shadow-sm border border-emerald-100">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-black mb-0.5 truncate">קבוצת הבניין</h2>
            <p className="text-sm font-bold text-slate-400 truncate">
              {!latestAnnouncement ? 'טוען הודעות...' : latestAnnouncement.content}
            </p>
          </div>
        </Link>

        {/* לוח אירועים */}
        <Link href="/events" onClick={() => playSystemSound('click')}
          className="bg-white/80 backdrop-blur-md border border-white shadow-sm p-6 rounded-[2rem] flex items-center gap-5 text-slate-800 hover:bg-white"
        >
          <div className="p-4 bg-rose-50 text-rose-500 rounded-2xl shrink-0 shadow-sm border border-rose-100">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-black mb-0.5">לוח אירועים</h2>
            <p className="text-sm font-bold text-slate-400">
              {!upcomingEvent ? 'טוען נתונים...' : !upcomingEvent.isPlaceholder ? `בקרוב: ${upcomingEvent.title} 🎉` : 'אין אירועים קרובים 📅'}
            </p>
          </div>
        </Link>
      </div>
    </div>
  );
}

'use client'
import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { playSystemSound } from '../../components/providers/AppManager';

export default function Header() {
  const [profile, setProfile] = useState<any>(null);
  const [buildingName, setBuildingName] = useState<string>('טוען...');
  const [unreadCount, setUnreadCount] = useState(0);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    let channel: any = null;
    let isMounted = true;

    const loadUserData = async (userId: string) => {
      try {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, buildings(name)')
          .eq('id', userId)
          .single();

        if (profileData && isMounted) {
          setProfile(profileData);
          setBuildingName(profileData.buildings?.name || 'ללא קהילה');
        }

        const updateCount = async () => {
          const { count } = await supabase
            .from('notifications')
            .select('*', { count: 'exact', head: true })
            .eq('receiver_id', userId)
            .eq('is_read', false);

          if (isMounted) {
            setUnreadCount(count || 0);
          }
        };

        await updateCount();
        if (!isMounted) return;

        const channelTopic = `header_notifs_${userId}_${Date.now()}`;
        channel = supabase.channel(channelTopic)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'notifications', filter: `receiver_id=eq.${userId}` },
            updateCount
          )
          .subscribe();
      } catch (err) {
        console.error("Header data load error:", err);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user && isMounted) {
        loadUserData(session.user.id);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user && isMounted) {
        loadUserData(session.user.id);
      }
    }).catch(() => {});

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  const isHome = pathname === '/';

  return (
    <header className="w-full max-w-md bg-white/95 backdrop-blur-xl border-b border-slate-100 rounded-b-[16px] px-5 pt-7 pb-4 shadow-xs z-50 shrink-0 sticky top-0 mx-auto" dir="rtl">
      <div className="flex justify-between items-center relative h-12">
        {/* צד ימין: כפתור פעולה */}
        <div className="z-10">
          {isHome ? (
            <Link
              href="/notifications"
              onClick={() => playSystemSound('click')}
              className="relative w-11 h-11 flex items-center justify-center bg-slate-100 hover:bg-slate-200 border border-slate-200/60 rounded-xl text-slate-700 shadow-xs active:scale-95 transition-all"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {unreadCount > 0 && (
                <div className="absolute -top-1.5 -right-1.5">
                  <span className="flex h-5 min-w-[20px] items-center justify-center rounded-lg bg-rose-500 px-1 border-2 border-white text-[10px] font-black text-white shadow-xs">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                </div>
              )}
            </Link>
          ) : (
            <button
              onClick={() => { playSystemSound('click'); router.back(); }}
              className="w-11 h-11 flex items-center justify-center bg-slate-100 hover:bg-slate-200 border border-slate-200/60 rounded-xl text-slate-700 shadow-xs active:scale-95 transition-all"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>

        {/* מרכז: לוגו מורם ותיאור בניין */}
        <div className="absolute left-1/2 transform -translate-x-1/2 -top-1 text-center flex flex-col items-center pointer-events-none w-full max-w-[160px]">
          <h1 className="text-[22px] font-black text-[#1D4ED8] tracking-tighter leading-none mb-0.5">
            שכן<span className="text-slate-800">+</span>
          </h1>
          <div className="bg-slate-100/50 px-3 py-0.5 rounded-full border border-slate-200/40 mt-1 backdrop-blur-sm shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
            <p className="text-[10px] font-black text-[#1D4ED8] uppercase tracking-wide truncate max-w-[120px]">
              {buildingName}
            </p>
          </div>
        </div>

        {/* צד שמאל: פרופיל */}
        <Link href="/profile" onClick={() => playSystemSound('click')} className="z-10">
          <div className="w-11 h-11 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200/60 p-0.5 shadow-xs active:scale-95 transition-all overflow-hidden flex items-center justify-center">
            <img
              src={profile?.avatar_url || `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(profile?.full_name || 'G')}&backgroundColor=f1f5f9&textColor=334155`}
              className="w-full h-full object-cover rounded-[9px]"
              alt="פרופיל"
            />
          </div>
        </Link>
      </div>
    </header>
  );
}

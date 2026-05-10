'use client'
import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

interface HeaderProfile {
  id: string;
  full_name: string;
  avatar_url?: string;
  buildings?: {
    name: string;
  };
}

export default function Header() {
  const [profile, setProfile] = useState<HeaderProfile | null>(null);
  const [buildingName, setBuildingName] = useState<string>('טוען...');
  const [unreadCount, setUnreadCount] = useState(0);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const fetchHeaderData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, buildings(name)')
        .eq('id', user.id)
        .single();

      if (profileData) {
        setProfile(profileData);
        setBuildingName(profileData.buildings?.name || 'ללא בניין');
      }

      const fetchCount = async () => {
        const { count } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('receiver_id', user.id)
          .eq('is_read', false);

        setUnreadCount(count || 0);
      };

      fetchCount();

      const channelTopic = `header_notifs_${user.id}`;
      
      channel = supabase.channel(channelTopic)
        .on(
          'postgres_changes',
          { 
            event: '*', 
            schema: 'public', 
            table: 'notifications', 
            filter: `receiver_id=eq.${user.id}` 
          },
          () => {
            fetchCount();
          }
        )
        .subscribe();
    };

    fetchHeaderData();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  return (
    <header className="w-full max-w-md bg-white/90 backdrop-blur-md border-b border-gray-100 rounded-b-2xl px-5 pt-7 pb-4 shadow-sm z-50 shrink-0 sticky top-0" dir="rtl">
      <div className="flex justify-between items-center relative h-12">
        
        <div className="z-10 flex items-center justify-center">
          {pathname === '/' ? (
            <Link href="/notifications" className="relative w-12 h-12 flex items-center justify-center bg-gray-50 rounded-xl text-slate-500 hover:text-[#1D4ED8] transition-all active:scale-95 border border-gray-100 shadow-sm">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {unreadCount > 0 && (
                <div className="absolute top-1.5 right-1.5 flex items-center justify-center translate-x-1/2 -translate-y-1/2">
                  <span className="relative flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1.5 border-2 border-white shadow-[0_0_8px_rgba(244,63,94,0.4)] animate-pulse">
                    <span className="text-[10px] font-black text-white leading-none mt-px">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  </span>
                </div>
              )}
            </Link>
          ) : (
            <button onClick={() => router.back()} className="w-12 h-12 flex items-center justify-center bg-gray-50 rounded-xl text-slate-500 hover:text-[#1D4ED8] transition-all active:scale-95 border border-gray-100 shadow-sm">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>
        
        <div className="absolute left-1/2 transform -translate-x-1/2 text-center flex flex-col items-center pointer-events-none w-full max-w-[150px]">
          <h1 className="text-xl font-black text-[#1D4ED8] leading-none mb-1 truncate w-full">
            שכן<span className="text-slate-800">+</span>
          </h1>
          <p className="text-[10px] font-bold text-slate-500 bg-slate-50 px-2 py-0.5 rounded-md border border-gray-100 uppercase tracking-tight truncate w-full">
            {buildingName}
          </p>
        </div>
        
        <Link href="/profile" className="z-10 w-12 h-12 flex items-center justify-center">
          <div className="w-11 h-11 rounded-xl bg-gray-100 overflow-hidden shadow-sm border border-white transition-transform hover:scale-105 active:scale-95">
            <img
              src={profile?.avatar_url || `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(profile?.full_name || 'Guest')}&backgroundColor=eff6ff&textColor=1d4ed8`}
              alt="פרופיל"
              className="w-full h-full object-cover"
            />
          </div>
        </Link>
      </div>
    </header>
  );
}

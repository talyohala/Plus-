'use client'
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

export default function BottomNav() {
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);
  const [profile, setProfile] = useState<any>(null);

  // האזנה להתראות חדשות בזמן אמת
  useEffect(() => {
    let currentUser: any = null;

    const fetchUnreadCount = async (userId: string) => {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_id', userId)
        .eq('is_read', false);
      
      setUnreadCount(count || 0);
    };

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        currentUser = user;
        setProfile(user);
        fetchUnreadCount(user.id);
      }
    });

    const channel = supabase.channel('bottom_nav_notifications')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => {
        if (currentUser) fetchUnreadCount(currentUser.id);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // אם אנחנו בצ'אט - אל תציג את התפריט התחתון
  if (pathname === '/chat') return null;

  return (
    <nav className="fixed bottom-0 w-full max-w-md glass-panel flex justify-around items-center p-3 pb-6 z-50 rounded-t-3xl border-b-0 shadow-[0_-5px_20px_rgba(0,0,0,0.05)] bg-white/90 backdrop-blur-lg">
      <Link href="/" className={`flex flex-col items-center transition gap-1 w-14 ${pathname === '/' ? 'text-brand-blue' : 'text-brand-gray hover:text-brand-blue/70'}`}>
        <svg className="w-6 h-6" fill={pathname === '/' ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={pathname === '/' ? '0' : '2'} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>
        <span className={`text-[10px] ${pathname === '/' ? 'font-black' : 'font-medium'}`}>בית</span>
      </Link>
      
      <Link href="/payments" className={`flex flex-col items-center transition gap-1 w-14 ${pathname === '/payments' ? 'text-brand-blue' : 'text-brand-gray hover:text-brand-blue/70'}`}>
        <svg className="w-6 h-6" fill={pathname === '/payments' ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={pathname === '/payments' ? '0' : '2'} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path></svg>
        <span className={`text-[10px] ${pathname === '/payments' ? 'font-black' : 'font-medium'}`}>תשלומים</span>
      </Link>
      
      <Link href="/services" className="flex flex-col items-center text-brand-blue transition gap-1 w-14 -mt-6 group">
        <div className="bg-brand-blue text-white p-3.5 rounded-full shadow-[0_8px_20px_rgba(0,68,204,0.3)] group-hover:scale-105 transition-transform">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
        </div>
      </Link>
      
      <Link href="/chat" className={`flex flex-col items-center transition gap-1 w-14 ${pathname === '/chat' ? 'text-brand-blue' : 'text-brand-gray hover:text-brand-blue/70'}`}>
        <svg className="w-6 h-6" fill={pathname === '/chat' ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={pathname === '/chat' ? '0' : '2'} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>
        <span className={`text-[10px] ${pathname === '/chat' ? 'font-black' : 'font-medium'}`}>צ'אט</span>
      </Link>
      
      <Link href="/notifications" className={`flex flex-col items-center transition gap-1 w-14 relative ${pathname === '/notifications' ? 'text-brand-blue' : 'text-brand-gray hover:text-brand-blue/70'}`}>
        <div className="relative">
          <svg className="w-6 h-6" fill={pathname === '/notifications' ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={pathname === '/notifications' ? '0' : '2'} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border border-white"></span>
            </span>
          )}
        </div>
        <span className={`text-[10px] ${pathname === '/notifications' ? 'font-black' : 'font-medium'}`}>התראות</span>
      </Link>
    </nav>
  );
}

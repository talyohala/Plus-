'use client'
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { playSystemSound } from '../providers/AppManager';

export default function BottomNav() {
  const pathname = usePathname();

  // מסתירים את התפריט בתוך הצ'אט כדי לחסוך מקום במסך
  if (pathname === '/chat') return null;

  const getNavLinkClass = (path: string) => {
    const isActive = pathname === path;
    const baseClass = "flex flex-col items-center gap-1.5 w-16 transition-all duration-200 active:scale-95";
    return isActive 
      ? `${baseClass} text-brand-blue` 
      : `${baseClass} text-gray-400 hover:text-brand-blue/70`;
  };

  return (
    <nav className="fixed bottom-0 w-full max-w-md flex justify-between items-center px-6 pt-4 pb-6 z-50 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.06)] bg-white/95 backdrop-blur-xl border-t border-gray-100">
      
      <Link href="/" onClick={() => playSystemSound('click')} className={getNavLinkClass('/')}>
        <svg className="w-7 h-7 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={pathname === '/' ? "2.5" : "2"}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path>
        </svg>
        <span className="text-[11px] font-black tracking-wide">ראשי</span>
      </Link>
      
      <Link href="/payments" onClick={() => playSystemSound('click')} className={getNavLinkClass('/payments')}>
        <svg className="w-7 h-7 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={pathname === '/payments' ? "2.5" : "2"}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path>
        </svg>
        <span className="text-[11px] font-black tracking-wide">תשלומים</span>
      </Link>
      
      <Link href="/services" onClick={() => playSystemSound('click')} className={getNavLinkClass('/services')}>
        <svg className="w-8 h-8 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={pathname === '/services' ? "2.5" : "2"}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
        </svg>
        <span className="text-[11px] font-black tracking-wide">תקלות</span>
      </Link>
      
      <Link href="/chat" onClick={() => playSystemSound('click')} className={getNavLinkClass('/chat')}>
        <svg className="w-7 h-7 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={pathname === '/chat' ? "2.5" : "2"}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
        </svg>
        <span className="text-[11px] font-black tracking-wide">קבוצה</span>
      </Link>

    </nav>
  );
}

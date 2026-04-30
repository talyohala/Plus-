'use client'
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function BottomNav() {
  const pathname = usePathname();

  // אם אנחנו בצ'אט - אל תציג את התפריט התחתון
  if (pathname === '/chat') return null;

  // פונקציית עזר לניהול הצבעים - נקי לחלוטין
  const getNavLinkClass = (path: string) => {
    const isActive = pathname === path;
    const baseClass = "flex flex-col items-center gap-1.5 w-14 transition-all duration-200 active:scale-90";
    
    // פעיל = כחול. לא פעיל = אפור ניטרלי נקי.
    return isActive 
      ? `${baseClass} text-brand-blue` 
      : `${baseClass} text-gray-400 hover:text-brand-blue/70`;
  };

  return (
    <nav className="fixed bottom-0 w-full max-w-md flex justify-around items-center p-3 pb-7 z-50 rounded-t-[32px] shadow-[0_-10px_40px_rgba(0,0,0,0.04)] bg-white/90 backdrop-blur-xl border-t border-white/20">
      
      <Link href="/" className={getNavLinkClass('/')}>
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={pathname === '/' ? "2.5" : "2"}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path>
        </svg>
        <span className="text-[10px] font-bold">בית</span>
      </Link>
      
      <Link href="/payments" className={getNavLinkClass('/payments')}>
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={pathname === '/payments' ? "2.5" : "2"}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path>
        </svg>
        <span className="text-[10px] font-bold">תשלומים</span>
      </Link>
      
      <Link href="/services" className={getNavLinkClass('/services')}>
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={pathname === '/services' ? "2.5" : "2"}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
        </svg>
        <span className="text-[10px] font-bold">שירותים</span>
      </Link>
      
      <Link href="/chat" className={getNavLinkClass('/chat')}>
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={pathname === '/chat' ? "2.5" : "2"}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
        </svg>
        <span className="text-[10px] font-bold">צ'אט</span>
      </Link>
      
      <Link href="/recommendations" className={getNavLinkClass('/recommendations')}>
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={pathname === '/recommendations' ? "2.5" : "2"}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"></path>
        </svg>
        <span className="text-[10px] font-bold">המלצות</span>
      </Link>

    </nav>
  );
}

'use client'
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function BottomNav() {
  const pathname = usePathname();
  
  // אם אנחנו בצ'אט - אל תציג את התפריט התחתון
  if (pathname === '/chat') return null;

  return (
    <nav className="fixed bottom-0 w-full max-w-md glass-panel flex justify-around items-center p-3 pb-6 z-50 rounded-t-3xl border-b-0 shadow-[0_-5px_20px_rgba(0,0,0,0.05)] bg-white/90 backdrop-blur-lg">
      <Link href="/" className="flex flex-col items-center text-brand-gray hover:text-brand-blue transition gap-1 w-14">
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"></path></svg>
        <span className="text-[10px] font-bold">בית</span>
      </Link>
      <Link href="/chat" className="flex flex-col items-center text-brand-gray hover:text-brand-blue transition gap-1 w-14">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>
        <span className="text-[10px] font-medium">צ'אט</span>
      </Link>
      <Link href="/create" className="flex flex-col items-center text-brand-blue hover:scale-110 transition gap-1 w-14">
        <div className="bg-brand-blue/10 p-2 rounded-full">
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"></path></svg>
        </div>
        <span className="text-[10px] font-bold">חדש</span>
      </Link>
      <Link href="/services" className="flex flex-col items-center text-brand-gray hover:text-brand-blue transition gap-1 w-14">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
        <span className="text-[10px] font-medium">שירותים</span>
      </Link>
      <Link href="/profile" className="flex flex-col items-center text-brand-gray hover:text-brand-blue transition gap-1 w-14">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
        <span className="text-[10px] font-medium">פרופיל</span>
      </Link>
    </nav>
  );
}

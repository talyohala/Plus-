import Header from '../../components/layout/Header';
import BottomNav from '../../components/layout/BottomNav';
import ScrollToTop from '../../components/layout/ScrollToTop';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-[100dvh] flex flex-col items-center pb-36 overflow-x-hidden selection:bg-brand-blue/20">
      <ScrollToTop />
      <Header />
      <div className="w-full max-w-md px-4 flex-1 flex flex-col">
        {children}
      </div>
      <BottomNav />
    </div>
  );
}

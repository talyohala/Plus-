import Header from '../../components/layout/Header';
import BottomNav from '../../components/layout/BottomNav';

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center pb-24 selection:bg-brand-blue/20">
      <Header />
      <div className="w-full max-w-md px-4">
        {children}
      </div>
      <BottomNav />
    </div>
  );
}

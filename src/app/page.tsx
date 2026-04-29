import Header from '../components/layout/Header';
import BottomNav from '../components/layout/BottomNav';
import QuickActions from '../components/home/QuickActions';
import Feed from '../components/home/Feed';

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center pb-24 selection:bg-brand-blue/20">
      <Header />
      <div className="w-full max-w-md px-4">
        <QuickActions />
        <Feed />
      </div>
      <BottomNav />
    </main>
  );
}

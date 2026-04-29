export default function Header() {
  return (
    <header className="w-full max-w-md flex justify-between items-start p-5 sticky top-0 glass-panel z-20 rounded-b-3xl mb-6">
      <button className="p-2 text-brand-dark hover:bg-white/50 rounded-full transition relative">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
        <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
      </button>
      <div className="flex flex-col items-center flex-1">
        <h1 className="text-2xl font-black text-brand-blue tracking-tight">שכן<span className="text-xl">+</span></h1>
        <h2 className="text-lg font-bold text-brand-dark">רחוב האלון 15</h2>
        <p className="text-xs text-brand-gray font-medium">בניין A • 32 דיירים</p>
      </div>
      <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden border-2 border-white shadow-sm">
        <img src="https://api.dicebear.com/7.x/notionists/svg?seed=Yossi&backgroundColor=e2e8f0" alt="פרופיל" className="w-full h-full object-cover" />
      </div>
    </header>
  );
}

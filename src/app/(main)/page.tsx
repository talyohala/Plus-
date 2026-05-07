'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import Link from 'next/link'
import { playSystemSound } from '../../components/providers/AppManager'

export default function HomePage() {
    const [profile, setProfile] = useState<any>(null)
    const [building, setBuilding] = useState<any>(null)
    const [unpaidCount, setUnpaidCount] = useState(0)
    const [openTickets, setOpenTickets] = useState(0)
    const [requestsCount, setRequestsCount] = useState(0)
    const [latestAnnouncement, setLatestAnnouncement] = useState<any>(null)
    
    // PWA Install States
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
    const [showInstallPrompt, setShowInstallPrompt] = useState(false)

    const fetchData = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: prof } = await supabase.from('profiles').select('*, buildings(*)').eq('id', user.id).single()
        if (prof) {
            setProfile(prof)
            setBuilding(prof.buildings)

            const { count: unpaid } = await supabase.from('payments')
                .select('*', { count: 'exact', head: true })
                .eq('payer_id', user.id)
                .eq('status', 'pending')
            setUnpaidCount(unpaid || 0)

            const { count: tickets } = await supabase.from('service_tickets')
                .select('*', { count: 'exact', head: true })
                .eq('building_id', prof.building_id)
                .neq('status', 'טופל')
            setOpenTickets(tickets || 0)

            const { count: requests } = await supabase.from('marketplace_items')
                .select('*', { count: 'exact', head: true })
                .eq('building_id', prof.building_id)
                .eq('category', 'בקשות שכנים')
            setRequestsCount(requests || 0)

            const { data: msg } = await supabase.from('messages')
                .select('content')
                .order('created_at', { ascending: false })
                .limit(1)
                .single()
            if (msg) setLatestAnnouncement(msg)
        }
    }

    useEffect(() => {
        fetchData()

        // 1. רישום של קובץ הרקע כדי לאפשר התקנה
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').catch(console.error)
        }

        // 2. תפיסת אירוע ההתקנה של הדפדפן (כדי להציג את הבאנר המעוצב שלנו)
        const handleBeforeInstallPrompt = (e: any) => {
            e.preventDefault()
            setDeferredPrompt(e)
            setShowInstallPrompt(true)
        }

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

        return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }, [])

    const handleInstallClick = async () => {
        if (deferredPrompt) {
            playSystemSound('click')
            deferredPrompt.prompt()
            const { outcome } = await deferredPrompt.userChoice
            if (outcome === 'accepted') {
                setShowInstallPrompt(false)
            }
            setDeferredPrompt(null)
        }
    }

    return (
        <div className="flex flex-col flex-1 w-full pb-24 space-y-6 relative" dir="rtl">
            
            <div className="px-5 mt-8 mb-2">
                <h1 className="text-3xl font-black text-slate-800 tracking-tight">שלום, {profile?.full_name?.split(' ')[0] || 'שכן'} 👋</h1>
                <p className="text-slate-500 font-bold text-base mt-1.5">מה נרצה לעשות היום?</p>
            </div>

            {/* באנר התקנת אפליקציה - מופיע רק אם אפשר להתקין! */}
            {showInstallPrompt && (
                <div className="mx-4 mb-2 bg-gradient-to-r from-[#1D4ED8] to-[#3B82F6] p-4 rounded-[1.5rem] shadow-[0_8px_25px_rgba(29,78,216,0.3)] text-white flex items-center justify-between animate-in slide-in-from-top-4 fade-in z-20 relative">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white text-[#1D4ED8] rounded-xl flex items-center justify-center font-black text-xl shadow-sm shrink-0">ש+</div>
                        <div>
                            <h3 className="font-black text-sm">התקנת האפליקציה</h3>
                            <p className="text-[10px] text-blue-100 font-bold mt-0.5">הוסף למסך הבית לגישה מהירה</p>
                        </div>
                    </div>
                    <button onClick={handleInstallClick} className="bg-white text-[#1D4ED8] px-4 py-2.5 rounded-xl text-xs font-black shadow-sm active:scale-95 transition shrink-0">
                        התקנה
                    </button>
                </div>
            )}

            <div className="grid grid-cols-1 gap-4 px-4 relative z-10">
                
                <Link href="/payments" onClick={() => playSystemSound('click')}
                    className={`relative overflow-hidden p-6 rounded-[2rem] transition-all active:scale-[0.98] flex items-center gap-5 ${
                        unpaidCount > 0
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-[0_0_25px_rgba(37,99,235,0.4)] border border-blue-400/50 scale-[1.02] z-20'
                        : 'bg-white/80 backdrop-blur-md border border-white shadow-sm text-slate-800 hover:bg-white'
                    }`}
                >
                    {unpaidCount > 0 && <div className="absolute inset-0 bg-blue-400/20 animate-pulse pointer-events-none"></div>}
                    <div className={`relative p-4 rounded-2xl shrink-0 shadow-sm ${unpaidCount > 0 ? 'bg-white/20 text-white border border-white/30' : 'bg-blue-50 text-blue-600 border border-blue-100'}`}>
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path></svg>
                    </div>
                    <div className="flex-1 relative z-10 min-w-0">
                        <h2 className="text-xl font-black mb-0.5 truncate">ועד הבית</h2>
                        <p className={`text-sm font-bold truncate ${unpaidCount > 0 ? 'text-blue-100' : 'text-emerald-500'}`}>
                            {unpaidCount > 0 ? `ממתינים ${unpaidCount} תשלומים להסדרה` : 'הכל משולם ומעודכן! ✨'}
                        </p>
                    </div>
                    <svg className={`w-6 h-6 relative z-10 shrink-0 ${unpaidCount > 0 ? 'text-white/50' : 'text-slate-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7"></path></svg>
                </Link>

                <Link href="/services" onClick={() => playSystemSound('click')}
                    className={`relative overflow-hidden p-6 rounded-[2rem] transition-all active:scale-[0.98] flex items-center gap-5 ${
                        openTickets > 0
                        ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-[0_0_25px_rgba(249,115,22,0.4)] border border-orange-400/50 scale-[1.02] z-20'
                        : 'bg-white/80 backdrop-blur-md border border-white shadow-sm text-slate-800 hover:bg-white'
                    }`}
                >
                    {openTickets > 0 && <div className="absolute inset-0 bg-orange-400/20 animate-pulse pointer-events-none"></div>}
                    <div className={`relative p-4 rounded-2xl shrink-0 shadow-sm ${openTickets > 0 ? 'bg-white/20 text-white border border-white/30' : 'bg-orange-50 text-orange-500 border border-orange-100'}`}>
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                    </div>
                    <div className="flex-1 relative z-10 min-w-0">
                        <h2 className="text-xl font-black mb-0.5 truncate">תקלות ושירותים</h2>
                        <p className={`text-sm font-bold truncate ${openTickets > 0 ? 'text-orange-100' : 'text-slate-500'}`}>
                            {openTickets > 0 ? `${openTickets} תקלות בטיפול הוועד 🛠️` : 'הבניין מתפקד מעולה 🛠️'}
                        </p>
                    </div>
                    <svg className={`w-6 h-6 relative z-10 shrink-0 ${openTickets > 0 ? 'text-white/50' : 'text-slate-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7"></path></svg>
                </Link>

                <Link href="/marketplace" onClick={() => playSystemSound('click')}
                    className={`relative overflow-hidden p-6 rounded-[2rem] transition-all active:scale-[0.98] flex items-center gap-5 ${
                        requestsCount > 0
                        ? 'bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white shadow-[0_0_25px_rgba(168,85,247,0.4)] border border-purple-400/50 scale-[1.02] z-20'
                        : 'bg-white/80 backdrop-blur-md border border-white shadow-sm text-slate-800 hover:bg-white'
                    }`}
                >
                    {requestsCount > 0 && <div className="absolute inset-0 bg-purple-400/20 animate-pulse pointer-events-none"></div>}
                    <div className={`relative p-4 rounded-2xl shrink-0 shadow-sm ${requestsCount > 0 ? 'bg-white/20 text-white border border-white/30' : 'bg-purple-50 text-purple-600 border border-purple-100'}`}>
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path></svg>
                    </div>
                    <div className="flex-1 relative z-10 min-w-0">
                        <h2 className="text-xl font-black mb-0.5 truncate">לוח מודעות</h2>
                        <p className={`text-sm font-bold truncate ${requestsCount > 0 ? 'text-purple-100' : 'text-slate-500'}`}>
                            {requestsCount > 0 ? `יש ${requestsCount} בקשות משכנים לעזרה 🤝` : 'קנייה, מכירה ובקשות שכנים 🛒'}
                        </p>
                    </div>
                    <svg className={`w-6 h-6 relative z-10 shrink-0 ${requestsCount > 0 ? 'text-white/50' : 'text-slate-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7"></path></svg>
                </Link>

                <Link href="/chat" onClick={() => playSystemSound('click')}
                    className={`relative overflow-hidden p-6 rounded-[2rem] transition-all active:scale-[0.98] flex items-center gap-5 ${
                        latestAnnouncement
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-[0_0_25px_rgba(16,185,129,0.4)] border border-emerald-400/50 scale-[1.02] z-20'
                        : 'bg-white/80 backdrop-blur-md border border-white shadow-sm text-slate-800 hover:bg-white'
                    }`}
                >
                    {latestAnnouncement && <div className="absolute inset-0 bg-emerald-400/20 animate-pulse pointer-events-none"></div>}
                    <div className={`relative p-4 rounded-2xl shrink-0 shadow-sm ${latestAnnouncement ? 'bg-white/20 text-white border border-white/30' : 'bg-emerald-50 text-emerald-500 border border-emerald-100'}`}>
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path></svg>
                    </div>
                    <div className="flex-1 relative z-10 min-w-0">
                        <h2 className="text-xl font-black mb-0.5 truncate">קבוצת הבניין</h2>
                        <p className={`text-sm font-bold truncate ${latestAnnouncement ? 'text-emerald-100' : 'text-slate-500'}`}>
                            {latestAnnouncement ? latestAnnouncement.content : 'לחצו כדי לדבר עם השכנים 💬'}
                        </p>
                    </div>
                    <svg className={`w-6 h-6 relative z-10 shrink-0 ${latestAnnouncement ? 'text-white/50' : 'text-slate-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7"></path></svg>
                </Link>

            </div>
        </div>
    )
}

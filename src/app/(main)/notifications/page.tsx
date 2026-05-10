'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../../../lib/supabase'
import { useRouter } from 'next/navigation'
import { playSystemSound } from '../../../components/providers/AppManager'

export default function NotificationsPage() {
    const [notifications, setNotifications] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [profile, setProfile] = useState<any>(null)
    
    // States לניהול לחיצה ארוכה ותפריט מחיקה
    const [toastId, setToastId] = useState<string | null>(null);
    const [activeActionMenu, setActiveActionMenu] = useState<any | null>(null);
    const pressTimer = useRef<NodeJS.Timeout | null>(null);
    const isLongPressTriggered = useRef(false);

    const router = useRouter()

    const fetchNotifications = useCallback(async (userId: string) => {
        const { data, error } = await supabase
            .from('notifications')
            .select('*, sender:profiles!notifications_sender_fkey(full_name, avatar_url)')
            .eq('receiver_id', userId)
            .order('created_at', { ascending: false })
            .limit(50)
            
        if (error) console.error("Notification Fetch Error:", error)
        if (data) setNotifications(data)
        setIsLoading(false)
    }, [])

    useEffect(() => {
        let isMounted = true;
        let channel: any = null;
        
        const load = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user || !isMounted) return;
            
            setProfile(user)
            await fetchNotifications(user.id)

            if (!isMounted) return;

            // האזנה יציבה וממודרת ל-Realtime פר משתמש בלבד למניעת קריסות שרת
            const channelTopic = `notifs_realtime_${user.id}_${Date.now()}`;
            channel = supabase.channel(channelTopic)
                .on('postgres_changes', { 
                    event: '*', 
                    schema: 'public', 
                    table: 'notifications',
                    filter: `receiver_id=eq.${user.id}`
                }, () => {
                    if (isMounted) fetchNotifications(user.id)
                })
                .subscribe()
        }
        
        load()

        return () => { 
            isMounted = false;
            if (channel) supabase.removeChannel(channel) 
        }
    }, [fetchNotifications])

    const showToast = (id: string) => { 
        setToastId(id); 
        setTimeout(() => setToastId(null), 4000); 
    };

    const handlePressStart = (notif: any) => {
        isLongPressTriggered.current = false;
        const timer = setTimeout(() => {
            isLongPressTriggered.current = true;
            if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(50);
            setActiveActionMenu(notif);
            playSystemSound('click');
        }, 700); // הוגדל ל-700ms ללחיצה יציבה ובטוחה
        pressTimer.current = timer;
    };

    const handlePressEnd = () => { 
        if (pressTimer.current) clearTimeout(pressTimer.current); 
    };

    const markAsReadAndNavigate = async (notification: any) => {
        playSystemSound('click')
        
        if (!notification.is_read) {
            await supabase.from('notifications').update({ is_read: true }).eq('id', notification.id)
            setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, is_read: true } : n))
        }

        if (notification.link) {
            router.push(notification.link)
        }
    }

    const markAllAsRead = async () => {
        if (!profile) return
        playSystemSound('notification')
        await supabase.from('notifications').update({ is_read: true }).eq('receiver_id', profile.id).eq('is_read', false)
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    }

    const deleteNotification = async (id: string) => {
        playSystemSound('click')
        await supabase.from('notifications').delete().eq('id', id)
        setNotifications(prev => prev.filter(n => n.id !== id))
        setActiveActionMenu(null)
    }

    const timeAgo = (dateString: string) => {
        const now = new Date()
        const date = new Date(dateString)
        const diffMs = now.getTime() - date.getTime()
        const diffMins = Math.floor(diffMs / 60000)
        
        if (diffMins < 1) return 'ממש עכשיו'
        if (diffMins < 60) return `לפני ${diffMins} דק'`
        const diffHours = Math.floor(diffMins / 60)
        if (diffHours < 24) return `לפני ${diffHours} שעות`
        if (diffHours < 48) return 'אתמול'
        return date.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })
    }

    const getIconConfig = (type: string) => {
        switch (type) {
            case 'chat': return { bg: 'bg-emerald-50 text-emerald-500', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path> }
            case 'payment': return { bg: 'bg-[#1D4ED8]/10 text-[#1D4ED8]', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path> }
            case 'event': return { bg: 'bg-rose-50 text-rose-500', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path> }
            case 'marketplace': return { bg: 'bg-purple-100 text-purple-600', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path> }
            case 'system': return { bg: 'bg-orange-50 text-orange-500', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path> }
            default: return { bg: 'bg-slate-100 text-slate-500', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path> }
        }
    }

    const unreadCount = notifications.filter(n => !n.is_read).length

    if (isLoading) {
        return <div className="flex flex-col flex-1 w-full items-center justify-center min-h-[100dvh] bg-transparent"><div className="w-16 h-16 border-4 border-[#1D4ED8]/30 border-t-[#1D4ED8] rounded-full animate-spin"></div></div>
    }

    return (
        <div className="flex flex-col flex-1 w-full pb-32 bg-transparent min-h-[100dvh] relative" dir="rtl">
            <div className="px-6 pt-6 pb-4 flex justify-between items-center sticky top-0 z-30 bg-transparent">
                <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-black text-slate-800 drop-shadow-sm">התראות</h2>
                    {unreadCount > 0 && (
                        <span className="bg-rose-500 text-white text-[11px] font-black px-2.5 py-0.5 rounded-full shadow-sm animate-pulse">
                            {unreadCount}
                        </span>
                    )}
                </div>
                {unreadCount > 0 && (
                    <button onClick={markAllAsRead} className="text-xs font-bold text-[#1D4ED8] bg-white/60 backdrop-blur-md px-4 min-h-[48px] flex items-center justify-center rounded-full border border-white/50 active:scale-95 transition shadow-sm">
                        סמן הכל כנקרא
                    </button>
                )}
            </div>

            <div className="px-5 mt-2 flex-1">
                {notifications.length === 0 ? (
                    <div className="text-center py-20 bg-white/50 backdrop-blur-sm rounded-3xl border border-white/50 shadow-sm mt-4">
                        <div className="w-20 h-20 bg-white/80 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm border border-slate-100">
                            <svg className="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
                        </div>
                        <h3 className="font-black text-xl text-slate-700 mb-1">הכל שקט כאן</h3>
                        <p className="text-sm font-medium text-slate-500">אין לך התראות חדשות כרגע. נעדכן כשיהיה משהו מעניין!</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {notifications.map((notif) => {
                            const iconConfig = getIconConfig(notif.type)
                            return (
                                <div key={notif.id} className="relative group select-none [-webkit-touch-callout:none]">
                                    {toastId === notif.id && (
                                        <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-[#E3F2FD] border border-[#BFDBFE] text-[#1D4ED8] text-[11px] font-black px-3 py-1.5 rounded-full shadow-sm animate-in slide-in-from-bottom-2 pointer-events-none whitespace-nowrap z-50">
                                            לחיצה ארוכה לאפשרויות
                                        </div>
                                    )}
                                    <div 
                                        onTouchStart={() => handlePressStart(notif)}
                                        onTouchEnd={handlePressEnd}
                                        onTouchMove={handlePressEnd}
                                        onClick={(e) => {
                                            // אם התפריט נפתח בעקבות לחיצה ארוכה - אל תעשה כלום ותבטל את הקליק
                                            if (isLongPressTriggered.current) {
                                                isLongPressTriggered.current = false;
                                                e.preventDefault();
                                                return;
                                            }
                                            markAsReadAndNavigate(notif);
                                            showToast(notif.id);
                                        }}
                                        className={`relative p-4 rounded-[1.5rem] border shadow-sm transition-all active:scale-[0.98] cursor-pointer flex gap-4 overflow-hidden ${notif.is_read ? 'bg-white/60 border-white/50 opacity-80' : 'bg-white border-[#1D4ED8]/10 shadow-[0_4px_15px_rgba(29,78,216,0.05)]'}`}
                                    >
                                        {!notif.is_read && <div className="absolute top-0 right-0 w-1.5 h-full bg-[#1D4ED8]"></div>}

                                        <div className="relative shrink-0 mt-1 pointer-events-none">
                                            {notif.sender?.avatar_url ? (
                                                <img src={notif.sender.avatar_url} className="w-12 h-12 rounded-full object-cover shadow-sm border border-slate-100" alt="Avatar" />
                                            ) : (
                                                <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-sm border border-white ${iconConfig.bg}`}>
                                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">{iconConfig.icon}</svg>
                                                </div>
                                            )}
                                            {notif.sender?.avatar_url && (
                                                <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center border-2 border-white ${iconConfig.bg}`}>
                                                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">{iconConfig.icon}</svg>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex-1 min-w-0 pr-1 pointer-events-none">
                                            <div className="flex justify-between items-start mb-0.5">
                                                <h4 className={`text-sm pr-2 truncate ${notif.is_read ? 'font-bold text-slate-700' : 'font-black text-slate-900'}`}>{notif.title}</h4>
                                                <span className="text-[10px] font-bold text-slate-400 shrink-0 mt-0.5">{timeAgo(notif.created_at)}</span>
                                            </div>
                                            <p className={`text-xs leading-relaxed line-clamp-2 pr-2 ${notif.is_read ? 'text-slate-500 font-medium' : 'text-slate-600 font-bold'}`}>
                                                {notif.content || (notif.type === 'like' ? 'אהב את הפוסט שלך' : 'הגיב לך')}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* --- Bottom Sheet: תפריט פעולות (לחיצה ארוכה למחיקה) --- */}
            {activeActionMenu && (
                <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex justify-center items-end" onClick={() => setActiveActionMenu(null)}>
                    <div className="bg-white/95 backdrop-blur-xl w-full max-w-md rounded-t-[2rem] p-6 pb-12 shadow-2xl animate-in slide-in-from-bottom-10 relative border-t border-white/50" onClick={e => e.stopPropagation()}>
                        <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6"></div>

                        {/* כפתור איקס נקי ומינימליסטי למעלה בצד שמאל */}
                        <button onClick={() => setActiveActionMenu(null)} className="absolute top-5 left-5 p-2 text-slate-400 hover:text-slate-600 transition active:scale-95" title="סגירה">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
                        </button>

                        <h3 className="font-black text-xl text-slate-800 text-center mb-8 px-10 truncate">פעולות</h3>

                        <div className="flex flex-col gap-3">
                            <button onClick={() => deleteNotification(activeActionMenu.id)} className="w-full flex items-center justify-between bg-white border border-red-100 p-4 rounded-xl hover:border-red-200 transition active:scale-95 shadow-sm group">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center group-hover:bg-red-500 group-hover:text-white transition">
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                    </div>
                                    <div className="text-right">
                                        <h4 className="font-bold text-base text-red-500">מחק התראה זו</h4>
                                        <p className="text-[11px] font-bold text-slate-500">ההתראה תוסר לצמיתות מהרשימה.</p>
                                    </div>
                                </div>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

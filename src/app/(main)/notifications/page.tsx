'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useRouter } from 'next/navigation'
import { playSystemSound } from '../../../components/providers/AppManager'

export default function NotificationsPage() {
    const [notifications, setNotifications] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [profile, setProfile] = useState<any>(null)
    const router = useRouter()

    const fetchNotifications = async (userId: string) => {
        // שימוש מדויק במפתח ה-Foreign Key שלך ממסד הנתונים
        const { data, error } = await supabase
            .from('notifications')
            .select('*, sender:profiles!notifications_sender_fkey(full_name, avatar_url)')
            .eq('receiver_id', userId)
            .order('created_at', { ascending: false })
            .limit(50)
            
        if (error) console.error("Notification Fetch Error:", error)
        if (data) setNotifications(data)
        setIsLoading(false)
    }

    useEffect(() => {
        let currentUser: any = null
        
        const load = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                currentUser = user
                setProfile(user)
                fetchNotifications(user.id)
            }
        }
        load()

        const channel = supabase.channel('notif_page_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => {
                if (currentUser) fetchNotifications(currentUser.id)
            })
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [])

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

    const deleteNotification = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation()
        playSystemSound('click')
        await supabase.from('notifications').delete().eq('id', id)
        setNotifications(prev => prev.filter(n => n.id !== id))
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
        return <div className="flex flex-col flex-1 w-full items-center justify-center min-h-[100dvh] bg-transparent"><div className="w-12 h-12 border-4 border-[#1D4ED8]/30 border-t-[#1D4ED8] rounded-full animate-spin"></div></div>
    }

    return (
        <div className="flex flex-col flex-1 w-full pb-32 bg-transparent min-h-[100dvh] relative" dir="rtl">
            <div className="px-6 pt-6 pb-4 flex justify-between items-center sticky top-0 z-30 bg-transparent">
                <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-black text-slate-800 drop-shadow-sm">מרכז ההתראות</h2>
                    {unreadCount > 0 && (
                        <span className="bg-rose-500 text-white text-[11px] font-black px-2.5 py-0.5 rounded-full shadow-sm animate-pulse">
                            {unreadCount}
                        </span>
                    )}
                </div>
                {unreadCount > 0 && (
                    <button onClick={markAllAsRead} className="text-[11px] font-bold text-[#1D4ED8] bg-white/60 backdrop-blur-md px-3 py-2 rounded-full border border-white/50 active:scale-95 transition shadow-sm">
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
                                <div 
                                    key={notif.id} 
                                    onClick={() => markAsReadAndNavigate(notif)}
                                    className={`relative p-4 rounded-[1.5rem] border shadow-sm transition-all active:scale-[0.98] cursor-pointer flex gap-4 overflow-hidden group ${notif.is_read ? 'bg-white/60 border-white/50 opacity-80' : 'bg-white border-[#1D4ED8]/10 shadow-[0_4px_15px_rgba(29,78,216,0.05)]'}`}
                                >
                                    {/* פס סימון להתראה שלא נקראה */}
                                    {!notif.is_read && <div className="absolute top-0 right-0 w-1.5 h-full bg-[#1D4ED8]"></div>}

                                    <div className="relative shrink-0 mt-1">
                                        {notif.sender?.avatar_url ? (
                                            <img src={notif.sender.avatar_url} className="w-12 h-12 rounded-full object-cover shadow-sm border border-slate-100" alt="Avatar" />
                                        ) : (
                                            <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-sm border border-white ${iconConfig.bg}`}>
                                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">{iconConfig.icon}</svg>
                                            </div>
                                        )}
                                        {/* אייקון קטן מעל התמונה אם יש תמונת פרופיל או אייקון מערכת */}
                                        <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center border-2 border-white ${iconConfig.bg}`}>
                                            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">{iconConfig.icon}</svg>
                                        </div>
                                    </div>

                                    <div className="flex-1 min-w-0 pr-1">
                                        <div className="flex justify-between items-start mb-0.5">
                                            <h4 className={`text-sm pr-2 truncate ${notif.is_read ? 'font-bold text-slate-700' : 'font-black text-slate-900'}`}>{notif.title}</h4>
                                            <span className="text-[10px] font-bold text-slate-400 shrink-0 mt-0.5">{timeAgo(notif.created_at)}</span>
                                        </div>
                                        <p className={`text-xs leading-relaxed line-clamp-2 pr-2 ${notif.is_read ? 'text-slate-500 font-medium' : 'text-slate-600 font-bold'}`}>
                                            {notif.content || (notif.type === 'like' ? 'אהב את הפוסט שלך' : 'הגיב לך')}
                                        </p>
                                    </div>

                                    {/* כפתור מחיקה - מופיע בהחלקה או Hover */}
                                    <button 
                                        onClick={(e) => deleteNotification(e, notif.id)} 
                                        className="absolute left-3 top-1/2 -translate-y-1/2 p-2 bg-red-50 text-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity active:scale-90"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                    </button>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}

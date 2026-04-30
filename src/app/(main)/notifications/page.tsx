'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([])
  const [profile, setProfile] = useState<any>(null)
  const router = useRouter()

  const fetchNotifications = async (userId: string) => {
    // התיקון הקריטי: הגדרה מדויקת מאיזה שדה למשוך את פרטי השולח (sender_id)
    const { data, error } = await supabase
      .from('notifications')
      .select('*, sender:profiles!sender_id(full_name, avatar_url)')
      .eq('receiver_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)
    
    if (error) {
      console.error("Supabase Notifications Error:", error)
    }
    if (data) {
      setNotifications(data)
    }
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

    const channel = supabase.channel('notifications_realtime_final')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => currentUser && fetchNotifications(currentUser.id))
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const markAsReadAndNavigate = async (notif: any) => {
    if (!notif.is_read) {
      await supabase.from('notifications').update({ is_read: true }).eq('id', notif.id)
      fetchNotifications(profile.id)
    }
    
    if (notif.link) {
      router.push(notif.link)
    } else if (notif.type === 'payment') {
      router.push('/payments')
    } else if (notif.type === 'service') {
      router.push('/services')
    } else {
      router.push('/')
    }
  }

  const markAllAsRead = async () => {
    if (!profile) return
    await supabase.from('notifications').update({ is_read: true }).eq('receiver_id', profile.id).eq('is_read', false)
    fetchNotifications(profile.id)
  }

  const deleteNotification = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    await supabase.from('notifications').delete().eq('id', id)
    fetchNotifications(profile.id)
  }

  const timeAgo = (dateString: string) => {
    const now = new Date()
    const date = new Date(dateString)
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return 'עכשיו'
    if (diffMins < 60) return `לפני ${diffMins} דק'`
    if (diffHours < 24) return `לפני ${diffHours} שעות`
    if (diffDays === 1) return 'אתמול'
    return `לפני ${diffDays} ימים`
  }

  const getSystemIcon = (type: string) => {
    if (type === 'payment') return <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
    if (type === 'service') return <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
    return <svg className="w-5 h-5 text-brand-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
  }

  const unreadCount = notifications.filter(n => !n.is_read).length

  return (
    <div className="flex flex-col flex-1 w-full pb-24 pt-4 relative" dir="rtl">
      
      <div className="px-4 mb-6 mt-2 flex justify-between items-end">
        <div>
          <h2 className="text-xl font-bold text-brand-dark mb-1">התראות</h2>
          {unreadCount > 0 && <p className="text-[11px] text-brand-blue font-bold">יש לך {unreadCount} התראות חדשות</p>}
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllAsRead} className="text-[10px] font-bold text-gray-500 bg-white border border-gray-200 px-3 py-1.5 rounded-lg active:scale-95 transition shadow-sm">
            סמן הכל כנקרא
          </button>
        )}
      </div>

      <div className="px-4 flex flex-col gap-3">
        {notifications.length === 0 ? (
          <div className="glass-panel p-10 rounded-3xl text-center text-brand-gray border border-white">
            <div className="w-12 h-12 bg-gray-100/50 rounded-full flex items-center justify-center mx-auto mb-3 text-gray-300">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
            </div>
            אין התראות חדשות
          </div>
        ) : (
          notifications.map(n => (
            <div 
              key={n.id} 
              onClick={() => markAsReadAndNavigate(n)}
              className={`glass-panel p-4 rounded-3xl border flex items-center gap-3 cursor-pointer relative overflow-hidden transition active:scale-[0.98] ${
                n.is_read ? 'bg-white/40 border-white/50 opacity-80' : 'bg-white/80 border-brand-blue/20 shadow-sm'
              }`}
            >
              {!n.is_read && (
                <div className="absolute top-4 left-4 w-2 h-2 bg-brand-blue rounded-full shadow-[0_0_8px_rgba(0,68,204,0.6)]"></div>
              )}
              
              {n.sender?.avatar_url ? (
                 <img src={n.sender.avatar_url} className="w-11 h-11 rounded-full border border-gray-100 object-cover shrink-0" />
              ) : (
                 <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 border border-gray-100 ${n.type === 'payment' ? 'bg-green-50' : n.type === 'service' ? 'bg-orange-50' : 'bg-brand-blue/5'}`}>
                   {getSystemIcon(n.type)}
                 </div>
              )}

              <div className="flex-1 pr-1">
                <p className={`text-sm leading-snug ${n.is_read ? 'text-brand-dark/80' : 'font-medium text-brand-dark'}`}>
                  {n.sender ? (
                    <>
                      <span className="font-bold">{n.sender.full_name}</span> 
                      {n.content ? ` ${n.content}` : (n.type === 'like' ? ' אהב/ה את הפוסט שלך' : ' הגיב/ה לפרסום שלך')}
                    </>
                  ) : (
                    <>
                      <span className="font-bold">{n.title}</span><br/>
                      <span className="text-xs text-brand-gray">{n.content}</span>
                    </>
                  )}
                </p>
                <p className="text-[10px] text-brand-gray mt-1.5 font-medium">{timeAgo(n.created_at)}</p>
              </div>

              {n.is_read && (
                <button onClick={(e) => deleteNotification(e, n.id)} className="absolute bottom-2 left-2 p-1.5 text-gray-300 hover:text-red-500 transition rounded-full hover:bg-red-50">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

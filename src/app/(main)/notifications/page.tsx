'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([])
  const [profile, setProfile] = useState<any>(null)
  const router = useRouter()

  const fetchNotifications = async (userId: string) => {
    const { data } = await supabase
      .from('notifications')
      .select('*, sender:profiles!notifications_sender_id_fkey(full_name, avatar_url)')
      .eq('receiver_id', userId)
      .order('created_at', { ascending: false })
      .limit(50) // מגביל ל-50 ההתראות האחרונות
    
    if (data) setNotifications(data)
  }

  useEffect(() => {
    let currentUser: any = null
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        currentUser = user
        setProfile(user)
        fetchNotifications(user.id)
      }
    })

    const channel = supabase.channel('notifications_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => currentUser && fetchNotifications(currentUser.id))
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const markAsReadAndNavigate = async (notif: any) => {
    if (!notif.is_read) {
      await supabase.from('notifications').update({ is_read: true }).eq('id', notif.id)
      fetchNotifications(profile.id)
    }
    
    // ניתוב חכם לפי סוג ההתראה
    if (notif.link) {
      router.push(notif.link)
    } else if (notif.type === 'payment') {
      router.push('/payments')
    } else if (notif.type === 'service') {
      router.push('/services')
    } else if (notif.type === 'post') {
      router.push('/')
    }
  }

  const markAllAsRead = async () => {
    if (!profile) return
    await supabase.from('notifications').update({ is_read: true }).eq('receiver_id', profile.id).eq('is_read', false)
    fetchNotifications(profile.id)
  }

  const deleteNotification = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation() // מונע מעבר לעמוד אחר בעת לחיצה על מחיקה
    await supabase.from('notifications').delete().eq('id', id)
    fetchNotifications(profile.id)
  }

  // פונקציית עזר להצגת זמן (למשל "לפני שעתיים")
  const timeAgo = (dateString: string) => {
    const now = new Date()
    const date = new Date(dateString)
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return 'עכשיו'
    if (diffMins < 60) return `לפני ${diffMins} דקות`
    if (diffHours < 24) return `לפני ${diffHours} שעות`
    if (diffDays === 1) return 'אתמול'
    return `לפני ${diffDays} ימים`
  }

  // התאמת אייקון וצבע לפי סוג ההתראה
  const getIconForType = (type: string) => {
    switch (type) {
      case 'payment':
        return {
          bg: 'bg-green-100', text: 'text-green-600',
          svg: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
        }
      case 'service':
        return {
          bg: 'bg-orange-100', text: 'text-orange-600',
          svg: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
        }
      case 'post':
        return {
          bg: 'bg-purple-100', text: 'text-purple-600',
          svg: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z"></path></svg>
        }
      default:
        return {
          bg: 'bg-brand-blue/10', text: 'text-brand-blue',
          svg: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
        }
    }
  }

  const unreadCount = notifications.filter(n => !n.is_read).length

  return (
    <div className="flex flex-col flex-1 w-full pb-24 relative" dir="rtl">
      
      <div className="px-4 mb-6 mt-2 flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-black text-brand-dark">התראות</h2>
          <p className="text-xs text-brand-gray mt-1">יש לך {unreadCount} התראות חדשות</p>
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllAsRead} className="text-[11px] font-bold text-brand-blue bg-brand-blue/10 px-3 py-1.5 rounded-lg active:scale-95 transition">
            סמן הכל כנקרא
          </button>
        )}
      </div>

      <div className="px-4 flex flex-col gap-3">
        {notifications.length === 0 ? (
          <div className="text-center py-16 bg-white/50 rounded-3xl border border-gray-100 shadow-sm flex flex-col items-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4 text-gray-300">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
            </div>
            <p className="text-brand-gray font-bold text-sm">אין לך התראות כרגע.</p>
          </div>
        ) : (
          notifications.map(notif => {
            const style = getIconForType(notif.type)
            return (
              <div 
                key={notif.id} 
                onClick={() => markAsReadAndNavigate(notif)}
                className={`bg-white p-4 rounded-3xl shadow-sm border cursor-pointer relative overflow-hidden flex items-start gap-3 transition active:scale-[0.98] ${notif.is_read ? 'border-gray-50 opacity-70' : 'border-brand-blue/20'}`}
              >
                {!notif.is_read && (
                  <div className="absolute top-4 left-4 w-2.5 h-2.5 bg-brand-blue rounded-full shadow-[0_0_8px_rgba(0,68,204,0.6)]"></div>
                )}
                
                {notif.sender?.avatar_url ? (
                   <img src={notif.sender.avatar_url} className="w-12 h-12 rounded-full border border-gray-100 object-cover shrink-0" />
                ) : (
                   <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${style.bg} ${style.text}`}>
                     {style.svg}
                   </div>
                )}

                <div className="flex-1 pr-1 pb-1">
                  <div className="flex justify-between items-start mb-0.5">
                    <h3 className={`text-sm leading-tight pr-2 ${notif.is_read ? 'font-bold text-brand-dark/80' : 'font-black text-brand-dark'}`}>{notif.title}</h3>
                  </div>
                  <p className={`text-xs leading-snug mb-2 ${notif.is_read ? 'text-gray-500' : 'text-brand-gray font-medium'}`}>{notif.content}</p>
                  <p className="text-[9px] text-gray-400 font-bold">{timeAgo(notif.created_at)}</p>
                </div>

                {notif.is_read && (
                  <button onClick={(e) => deleteNotification(e, notif.id)} className="absolute bottom-3 left-3 p-1.5 text-gray-300 hover:text-red-500 transition rounded-full hover:bg-red-50">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                  </button>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

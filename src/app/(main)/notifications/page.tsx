'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([])
  const [profile, setProfile] = useState<any>(null)
  const router = useRouter()

  const fetchNotifications = async (userId: string) => {
    // שימוש בשם המפתח המדויק שהגדרנו ב-SQL
    const { data, error } = await supabase
      .from('notifications')
      .select('*, sender:profiles!notifications_sender_fkey(full_name, avatar_url)')
      .eq('receiver_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)
    
    if (error) console.error("Notification Fetch Error:", error)
    if (data) setNotifications(data)
  }

  useEffect(() => {
    let currentUser: any = null
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        currentUser = user
        setProfile(user)
        fetchNotifications(user.id)
        // סימון כנקרא רק כשנכנסים לדף
        await supabase.from('notifications').update({ is_read: true }).eq('receiver_id', user.id)
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

  const timeAgo = (dateString: string) => {
    const now = new Date()
    const date = new Date(dateString)
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 1) return 'עכשיו'
    if (diffMins < 60) return `לפני ${diffMins} דק'`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `לפני ${diffHours} שעות`
    return date.toLocaleDateString('he-IL')
  }

  return (
    <div className="pt-4 text-right px-4 pb-24" dir="rtl">
      <h2 className="text-xl font-bold text-brand-dark mb-4">התראות</h2>
      <div className="space-y-3">
        {notifications.length === 0 ? (
          <div className="glass-panel p-10 rounded-3xl text-center text-brand-gray border border-white">אין התראות חדשות</div>
        ) : (
          notifications.map(n => (
            <div key={n.id} className={`glass-panel p-4 rounded-2xl flex items-center gap-3 border transition ${n.is_read ? 'bg-white/50 border-white' : 'bg-white border-brand-blue/20 shadow-sm'}`}>
              <img src={n.sender?.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${n.sender?.full_name || 'System'}`} className="w-10 h-10 rounded-full border border-white shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-brand-dark">
                  <span className="font-bold">{n.sender?.full_name || 'מערכת'}</span> {n.content || (n.type === 'like' ? 'אהב את הפוסט שלך' : 'הגיב לך')}
                </p>
                <p className="text-[10px] text-brand-gray">{timeAgo(n.created_at)}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

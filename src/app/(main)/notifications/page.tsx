'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([])

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase.from('notifications').select('*, sender:profiles!notifications_sender_id_fkey(full_name, avatar_url)').eq('receiver_id', user.id).order('created_at', { ascending: false })
        setNotifications(data || [])
        await supabase.from('notifications').update({ is_read: true }).eq('receiver_id', user.id)
      }
    }
    load()
  }, [])

  return (
    <div className="pt-4 text-right px-4 pb-24" dir="rtl">
      <h2 className="text-xl font-bold text-brand-dark mb-4">התראות</h2>
      <div className="space-y-3">
        {notifications.length === 0 ? (<div className="glass-panel p-10 rounded-3xl text-center text-brand-gray">אין התראות חדשות</div>) : (
          notifications.map(n => (
            <div key={n.id} className="glass-panel p-4 rounded-2xl flex items-center gap-3 bg-white/50 border border-white">
              <img src={n.sender?.avatar_url} className="w-10 h-10 rounded-full border border-white" />
              <div>
                <p className="text-sm text-brand-dark"><span className="font-bold">{n.sender?.full_name}</span> {n.type === 'like' ? ' אהב את הפוסט שלך' : ' הגיב לפרסום שלך'}</p>
                <p className="text-[10px] text-brand-gray">{new Date(n.created_at).toLocaleDateString('he-IL')}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

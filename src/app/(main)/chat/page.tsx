'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../../lib/supabase'
import Link from 'next/link'

export default function ChatPage() {
  const [messages, setMessages] = useState<any[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [currentUser, setCurrentUser] = useState<any>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setCurrentUser(user))
    
    const fetchMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*, profiles(full_name, avatar_url)')
        .order('created_at', { ascending: true })
      if (data) setMessages(data)
    }
    
    fetchMessages()

    const channel = supabase.channel('chat_realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, fetchMessages)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !currentUser) return
    const text = newMessage
    setNewMessage('')
    await supabase.from('messages').insert([{ user_id: currentUser.id, content: text }])
  }

  return (
    // fixed inset-0 ו-z-[60] מבטיחים שהצ'אט יכסה את כל המסך, כולל התפריט התחתון
    <div className="fixed inset-0 bg-gray-50 z-[60] flex flex-col" dir="rtl">
      
      {/* כותרת הצ'אט עם חץ חזור */}
      <div className="bg-white p-4 pt-12 flex items-center gap-4 shadow-sm">
        <Link href="/" className="p-2 hover:bg-gray-100 rounded-full transition">
          <svg className="w-6 h-6 text-brand-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
          </svg>
        </Link>
        <div>
          <h2 className="font-bold text-brand-dark">צ'אט הבניין</h2>
          <p className="text-[10px] text-brand-gray font-medium">32 שכנים מחוברים</p>
        </div>
      </div>

      {/* אזור ההודעות */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-28">
        {messages.map((msg) => {
          const isMe = currentUser?.id === msg.user_id
          return (
            <div key={msg.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
              {!isMe && (
                <img src={msg.profiles?.avatar_url} className="w-8 h-8 rounded-full border border-white self-end" />
              )}
              <div className={`max-w-[80%] p-3 rounded-2xl text-sm shadow-sm relative ${
                isMe 
                ? 'bg-brand-blue text-white rounded-br-none' 
                : 'bg-white text-brand-dark border border-gray-100 rounded-bl-none'
              }`}>
                {!isMe && <p className="font-bold text-[10px] text-brand-blue mb-1">{msg.profiles?.full_name}</p>}
                <p className="leading-relaxed">{msg.content}</p>
                <p className={`text-[9px] mt-1 text-left ${isMe ? 'text-blue-100' : 'text-gray-400'}`}>
                  {new Date(msg.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* שורת הקלדה - צמודה לקצה התחתון של המכשיר */}
      <div className="p-4 bg-white border-t border-gray-100 pb-8">
        <form onSubmit={handleSend} className="flex items-center gap-2 bg-gray-50 p-1 pr-4 rounded-full border border-gray-200">
          <input 
            type="text" 
            value={newMessage} 
            onChange={(e) => setNewMessage(e.target.value)} 
            placeholder="הקלד הודעה..." 
            className="flex-1 bg-transparent py-2 outline-none text-sm text-brand-dark"
          />
          <button type="submit" disabled={!newMessage.trim()} className="bg-brand-blue text-white w-10 h-10 rounded-full flex items-center justify-center shadow-md disabled:opacity-50 active:scale-90 transition">
            <svg className="w-5 h-5 -ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
          </button>
        </form>
      </div>
    </div>
  )
}

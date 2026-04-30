'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../../lib/supabase'

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
    <div className="flex flex-col flex-1 w-full relative" dir="rtl">
      
      {/* אזור ההודעות */}
      <div className="flex-1 space-y-4 pb-12">
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

      {/* שורת הקלדה - דבוקה לתחתית המסך לחלוטין */}
      <div className="fixed bottom-0 left-0 w-full flex justify-center z-50 pointer-events-none">
        <div className="w-full max-w-md px-4 pb-6 pt-4 bg-gradient-to-t from-gray-50 via-gray-50 to-transparent pointer-events-auto">
          <form onSubmit={handleSend} className="flex items-center gap-2 bg-white p-1 pr-4 rounded-full border border-gray-200 shadow-lg">
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

    </div>
  )
}

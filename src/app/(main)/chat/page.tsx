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
    setNewMessage('') // ניקוי מיידי לחוויית משתמש חלקה
    await supabase.from('messages').insert([{ user_id: currentUser.id, content: text }])
  }

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] pt-2" dir="rtl">
      {/* אזור ההודעות */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-20 px-2 scrollbar-hide">
        {messages.map((msg) => {
          const isMe = currentUser?.id === msg.user_id
          return (
            <div key={msg.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
              {!isMe && (
                <img src={msg.profiles?.avatar_url} className="w-8 h-8 rounded-full border border-white" />
              )}
              <div className={`max-w-[75%] p-3 rounded-2xl text-sm shadow-sm ${isMe ? 'bg-[#dcf8c6] text-brand-dark rounded-tl-none' : 'bg-white text-brand-dark rounded-tr-none'}`}>
                {!isMe && <p className="font-bold text-[10px] text-brand-blue mb-1">{msg.profiles?.full_name}</p>}
                <p>{msg.content}</p>
                <p className="text-[9px] text-gray-500 text-left mt-1">
                  {new Date(msg.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* שורת הקלדה קבועה למטה */}
      <form onSubmit={handleSend} className="fixed bottom-24 left-0 w-full max-w-md px-4 z-40">
        <div className="bg-white p-2 rounded-full shadow-lg flex items-center gap-2 border border-gray-100">
          <input 
            type="text" 
            value={newMessage} 
            onChange={(e) => setNewMessage(e.target.value)} 
            placeholder="הקלד הודעה..." 
            className="flex-1 bg-transparent px-4 outline-none text-sm text-brand-dark"
          />
          <button type="submit" disabled={!newMessage.trim()} className="bg-brand-blue text-white w-10 h-10 rounded-full flex items-center justify-center disabled:opacity-50 transition active:scale-90">
            <svg className="w-5 h-5 -ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
          </button>
        </div>
      </form>
    </div>
  )
}

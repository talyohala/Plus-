'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../../lib/supabase'
import EmojiPicker from 'emoji-picker-react'
import { playSystemSound } from '../../../components/providers/AppManager'

const hebrewCategories = [
  { category: 'suggested', name: 'בשימוש לאחרונה' },
  { category: 'smileys_people', name: 'פרצופים ואנשים' },
  { category: 'animals_nature', name: 'חיות וטבע' },
  { category: 'food_drink', name: 'אוכל ושתייה' },
  { category: 'travel_places', name: 'נסיעות ומקומות' },
  { category: 'activities', name: 'פעילויות' },
  { category: 'objects', name: 'חפצים' },
  { category: 'symbols', name: 'סמלים' },
  { category: 'flags', name: 'דגלים' }
]

export default function ChatPage() {
  const [messages, setMessages] = useState<any[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [showEmoji, setShowEmoji] = useState(false)
  
  const [activeMenu, setActiveMenu] = useState<any | null>(null)
  const [replyingTo, setReplyingTo] = useState<any | null>(null)
  
  const bottomRef = useRef<HTMLDivElement>(null)
  const pressTimer = useRef<any>(null)

  useEffect(() => {
    const initUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setCurrentUser(prof)
      }
    }
    initUser()

    const fetchMessages = async () => {
      const { data } = await supabase.from('messages').select('*, profiles(full_name, avatar_url, role)').order('created_at', { ascending: true })
      if (data) {
        setMessages(data)
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
      }
    }
    fetchMessages()

    const channel = supabase.channel('chat_realtime_smart')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, fetchMessages)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!newMessage.trim() || !currentUser) return
    playSystemSound('message')

    await supabase.from('messages').insert([{ 
      user_id: currentUser.id, 
      content: newMessage,
      reply_to_id: replyingTo?.id || null 
    }])

    setNewMessage('')
    setShowEmoji(false)
    setReplyingTo(null)
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  // הפונקציה להמרת הודעה לקריאת שירות (One-Tap Ticket)
  const convertToTicket = async (msg: any) => {
    if (!currentUser || currentUser.role !== 'admin') return
    setActiveMenu(null)
    
    const { error } = await supabase.from('service_tickets').insert([{
      building_id: currentUser.building_id,
      user_id: msg.user_id,
      title: 'נפתח אוטומטית מתוך הצ\'אט',
      description: msg.content,
      source: 'app',
      status: 'פתוח'
    }])

    if (!error) {
      await supabase.from('messages').insert([{
        user_id: currentUser.id,
        content: `✅ היי, פתחתי קריאת שירות מסודרת בלוח התקלות של הבניין בעקבות ההודעה שלך. נושא בטיפול.`,
        reply_to_id: msg.id
      }])
      playSystemSound('notification')
    }
  }

  const handlePressStart = (msg: any) => {
    pressTimer.current = setTimeout(() => {
      setActiveMenu(msg)
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(50)
    }, 400)
  }

  const handlePressEnd = () => { if (pressTimer.current) clearTimeout(pressTimer.current) }

  const getRepliedMsg = (id: string) => messages.find(m => m.id === id)

  return (
    <div className="flex flex-col flex-1 w-full relative min-h-[100dvh]" dir="rtl">
      <div className="fixed inset-0 bg-[#F0F2F5] -z-10" />

      {activeMenu && <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={() => setActiveMenu(null)} />}

      <div className="flex-1 space-y-4 pb-32 pt-2 px-3 overflow-y-auto">
        {messages.map((msg) => {
          const isMe = currentUser?.id === msg.user_id
          const isActive = activeMenu?.id === msg.id

          return (
            <div key={msg.id} className={`flex gap-2 relative ${isMe ? 'flex-row-reverse' : ''} ${isActive ? 'z-[60]' : 'z-10'}`}>
              {!isMe && <img src={msg.profiles?.avatar_url || `https://api.dicebear.com/8.x/initials/svg?seed=${msg.profiles?.full_name}`} className="w-8 h-8 rounded-full border border-white self-end shrink-0 shadow-sm" />}

              <div 
                className={`max-w-[78%] flex flex-col items-start ${isMe ? 'items-end' : ''} cursor-pointer`}
                onTouchStart={() => handlePressStart(msg)}
                onTouchEnd={handlePressEnd}
                onTouchMove={handlePressEnd}
              >
                {msg.reply_to_id && getRepliedMsg(msg.reply_to_id) && (
                  <div className={`w-full rounded-xl px-2.5 py-1.5 mb-1 border-r-4 text-[11px] text-left opacity-90 shadow-sm ${isMe ? 'bg-[#D0E6FB] border-[#2D5AF0]' : 'bg-gray-50 border-[#2D5AF0]'}`} dir="rtl">
                    <span className="font-black block mb-0.5 text-[#2D5AF0]">{getRepliedMsg(msg.reply_to_id).profiles?.full_name}</span>
                    <span className="line-clamp-1 text-gray-600">{getRepliedMsg(msg.reply_to_id).content}</span>
                  </div>
                )}

                <div className={`p-3 text-sm shadow-sm relative z-0 ${isMe ? 'bg-[#E3F2FD] text-brand-dark rounded-2xl rounded-br-sm' : 'bg-white text-brand-dark rounded-2xl border border-gray-100/50 rounded-bl-sm'}`}>
                  {!isMe && <p className="font-bold text-[10px] text-[#2D5AF0] mb-1">{msg.profiles?.full_name}</p>}
                  <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {activeMenu && (
        <div className="fixed inset-0 z-[100] flex flex-col justify-end pointer-events-none">
          <div className="bg-white w-full rounded-t-3xl pb-10 pt-5 px-4 relative z-10 animate-in slide-in-from-bottom-full shadow-[0_-10px_40px_rgba(0,0,0,0.2)] pointer-events-auto">
            <div className="flex justify-around items-start mt-4 px-2">
              <button onClick={() => { setReplyingTo(activeMenu); setActiveMenu(null); }} className="flex flex-col items-center gap-2">
                <div className="w-14 h-14 rounded-full bg-[#2D5AF0]/10 text-[#2D5AF0] flex items-center justify-center">
                  <svg className="w-6 h-6 transform rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"></path></svg>
                </div>
                <span className="text-[11px] font-bold text-brand-dark">תגובה</span>
              </button>

              {currentUser?.role === 'admin' && (
                <button onClick={() => convertToTicket(activeMenu)} className="flex flex-col items-center gap-2">
                  <div className="w-14 h-14 rounded-full bg-orange-50 text-orange-500 flex items-center justify-center">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                  </div>
                  <span className="text-[11px] font-bold text-orange-500">הפוך לתקלה</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="fixed bottom-0 left-0 w-full flex justify-center z-50 pointer-events-none pb-4 pt-10">
        <div className="w-full max-w-md px-4 pointer-events-auto relative">
          {replyingTo && (
            <div className="bg-white/95 backdrop-blur-md border-r-4 border-[#2D5AF0] p-2.5 rounded-2xl mb-2 flex justify-between items-center shadow-lg border border-gray-100">
              <div className="flex flex-col overflow-hidden pl-2">
                <span className="font-bold text-xs text-[#2D5AF0] mb-0.5">{replyingTo.profiles?.full_name}</span>
                <span className="text-xs text-brand-dark/70 truncate">{replyingTo.content}</span>
              </div>
              <button onClick={() => setReplyingTo(null)} className="p-1 text-gray-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
          )}

          <form onSubmit={handleSend} className="flex items-center gap-1 bg-white p-1 pr-2 rounded-full border border-gray-200 shadow-xl pointer-events-auto">
            <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="כתוב משהו..." className="flex-1 bg-transparent py-2 px-3 outline-none text-sm text-brand-dark" />
            <button type="submit" disabled={!newMessage.trim()} className="bg-brand-blue text-white w-10 h-10 rounded-full flex items-center justify-center shadow-md disabled:opacity-50 shrink-0">
              <svg className="w-4 h-4 transform -rotate-45 translate-x-px" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

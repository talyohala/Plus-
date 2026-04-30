'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../../lib/supabase'
import EmojiPicker from 'emoji-picker-react'
import Link from 'next/link'

export default function ChatPage() {
  const [messages, setMessages] = useState<any[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [showEmoji, setShowEmoji] = useState(false)
  const [uploading, setUploading] = useState(false)
  
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null)
  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  const [pendingMedia, setPendingMedia] = useState<{file: File, preview: string, type: string} | null>(null)
  const [mediaCaption, setMediaCaption] = useState('')

  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setCurrentUser(user))
    
    const fetchMessages = async () => {
      const { data } = await supabase.from('messages').select('*, profiles(full_name, avatar_url)').order('created_at', { ascending: true })
      if (data) setMessages(data)
    }
    fetchMessages()

    const channel = supabase.channel('chat_realtime_v6')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, fetchMessages)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!newMessage.trim() || !currentUser) return
    
    if (editingMsgId) {
      // עדכון מיידי במסך
      setMessages(prev => prev.map(m => m.id === editingMsgId ? { ...m, content: newMessage } : m))
      const { error } = await supabase.from('messages').update({ content: newMessage }).eq('id', editingMsgId)
      if(error) alert("שגיאה בעריכה: " + error.message)
      setEditingMsgId(null)
    } else {
      await supabase.from('messages').insert([{ user_id: currentUser.id, content: newMessage }])
    }
    
    setNewMessage('')
    setShowEmoji(false)
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  const handleDelete = async (id: string) => {
    // מחיקה מיידית מהמסך (Optimistic UI) - מגיב באותה שנייה
    setMessages(prev => prev.filter(m => m.id !== id))
    setActiveMenu(null)
    const { error } = await supabase.from('messages').delete().eq('id', id)
    if(error) alert("שגיאה במחיקה: " + error.message)
  }

  const handleEditClick = (msg: any) => {
    setActiveMenu(null)
    setEditingMsgId(msg.id)
    setNewMessage(msg.content)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const type = file.type.startsWith('video/') ? 'video' : file.type.startsWith('image/') ? 'image' : 'file'
    setPendingMedia({ file, preview: URL.createObjectURL(file), type })
  }

  const confirmSendMedia = async () => {
    if (!pendingMedia || !currentUser) return
    setUploading(true)
    
    const fileExt = pendingMedia.file.name.split('.').pop()
    const fileName = `${Math.random()}.${fileExt}`
    const filePath = `${currentUser.id}/${fileName}`

    const { error } = await supabase.storage.from('chat_uploads').upload(filePath, pendingMedia.file)
    if (!error) {
      const { data } = supabase.storage.from('chat_uploads').getPublicUrl(filePath)
      await supabase.from('messages').insert([{ 
        user_id: currentUser.id, 
        content: mediaCaption, 
        media_url: data.publicUrl,
        media_type: pendingMedia.type
      }])
    }
    
    setPendingMedia(null)
    setMediaCaption('')
    setUploading(false)
  }

  return (
    <div className="flex flex-col flex-1 w-full relative" dir="rtl">
      
      {/* רקע שקוף שעוצר לחיצות וסוגר את התפריט - משתמש ב-onPointerDown לטאצ' מיידי */}
      {(activeMenu || showEmoji) && (
        <div className="fixed inset-0 z-40 bg-transparent" onPointerDown={() => { setActiveMenu(null); setShowEmoji(false); }} />
      )}

      <div className="flex-1 space-y-4 pb-32 pt-2 relative z-0 px-2">
        {messages.map((msg) => {
          const isMe = currentUser?.id === msg.user_id
          const hasMedia = !!msg.media_url
          const isActive = activeMenu === msg.id
          
          return (
            <div key={msg.id} className={`flex gap-2 relative ${isMe ? 'flex-row-reverse' : ''} ${isActive ? 'z-[60]' : 'z-10'}`}>
              {!isMe && <img src={msg.profiles?.avatar_url || `https://api.dicebear.com/7.x/notionists/svg?seed=${msg.user_id}`} className="w-8 h-8 rounded-full border border-white self-end shrink-0 shadow-sm" />}
              
              <div className={`max-w-[75%] flex flex-col relative group items-start ${isMe ? 'items-end' : ''}`}>
                
                {/* 3 נקודות - נקיות, פרופורציונליות, ללא מסגרת מכוערת */}
                {isMe && (
                  <button onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); setActiveMenu(isActive ? null : msg.id); }} className="absolute top-1 -right-6 text-gray-400 hover:text-brand-blue p-1 z-20">
                     <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="12" cy="5" r="2"></circle>
                        <circle cx="12" cy="12" r="2"></circle>
                        <circle cx="12" cy="19" r="2"></circle>
                     </svg>
                  </button>
                )}
                
                {/* תפריט מחיקה/עריכה נקי וקומפקטי */}
                {isActive && (
                  <div className="absolute top-0 -right-20 bg-white shadow-lg rounded-xl border border-gray-100 py-1 text-xs z-50 flex flex-col min-w-[70px]">
                    <button onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); handleEditClick(msg); }} className="text-brand-blue font-bold w-full text-center py-2 active:bg-gray-50 transition">ערוך</button>
                    <div className="h-px bg-gray-100 w-full" />
                    <button onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(msg.id); }} className="text-red-500 font-bold w-full text-center py-2 active:bg-gray-50 transition">מחק</button>
                  </div>
                )}

                {hasMedia && (
                  <div className="mb-1 relative z-0">
                    {msg.media_type === 'image' && <img src={msg.media_url} className="rounded-2xl max-w-full shadow-sm border border-gray-100" alt="media" />}
                    {msg.media_type === 'video' && <video src={msg.media_url} controls className="rounded-2xl max-w-full shadow-sm border border-gray-100" />}
                    {msg.media_type === 'file' && <a href={msg.media_url} target="_blank" className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 underline font-bold flex items-center gap-2 text-sm"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path></svg> מסמך מצורף</a>}
                  </div>
                )}

                {msg.content && (
                  <div className={`p-3 text-sm shadow-sm relative z-0 ${hasMedia ? 'bg-white text-brand-dark rounded-2xl w-full border border-gray-100 mt-1' : isMe ? 'bg-brand-blue text-white rounded-2xl rounded-br-none' : 'bg-white text-brand-dark rounded-2xl border border-gray-100 rounded-bl-none'}`}>
                    {!isMe && !hasMedia && <p className="font-bold text-[10px] text-brand-blue mb-1">{msg.profiles?.full_name}</p>}
                    <p className="leading-relaxed">{msg.content}</p>
                  </div>
                )}
                
                <p className={`text-[9px] mt-1 text-left px-1 text-gray-400 font-medium`}>
                  {new Date(msg.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* תצוגה מקדימה לפני העלאת קובץ */}
      {pendingMedia && (
        <div className="fixed inset-0 bg-black/95 z-[70] flex flex-col">
          <div className="p-4 pt-12 flex justify-between text-white">
            <button onClick={() => setPendingMedia(null)} className="p-2"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
            <span className="font-bold text-sm mt-2">שלח מדיה</span>
          </div>
          <div className="flex-1 flex items-center justify-center p-4">
            {pendingMedia.type === 'image' && <img src={pendingMedia.preview} className="max-h-full rounded-2xl object-contain" />}
            {pendingMedia.type === 'video' && <video src={pendingMedia.preview} controls className="max-h-full rounded-2xl" />}
          </div>
          <div className="p-4 pb-8 flex gap-2 items-center">
            <input type="text" value={mediaCaption} onChange={e=>setMediaCaption(e.target.value)} placeholder="הוסף כיתוב (אופציונלי)..." className="flex-1 bg-white/10 text-white rounded-full px-4 py-3 outline-none backdrop-blur-md border border-white/20 text-sm" />
            <button onClick={confirmSendMedia} disabled={uploading} className="bg-brand-blue text-white w-12 h-12 rounded-full flex items-center justify-center shadow-lg disabled:opacity-50">
              {uploading ? <span className="text-xs font-bold animate-pulse">שולח</span> : <svg className="w-5 h-5 transform -translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>}
            </button>
          </div>
        </div>
      )}

      {/* אזור מקלדת תחתון */}
      <div className="fixed bottom-0 left-0 w-full flex justify-center z-50 pointer-events-none">
        <div className="w-full max-w-md px-4 pb-6 pt-4 pointer-events-auto relative">
          
          {showEmoji && (
            <div className="absolute bottom-[85px] right-2 left-2 z-50 shadow-2xl rounded-[2rem] overflow-hidden border border-gray-100 bg-white">
              <EmojiPicker onEmojiClick={(e) => { setNewMessage(prev => prev + e.emoji); setShowEmoji(false); }} width="100%" height={300} searchDisabled />
            </div>
          )}

          {editingMsgId && <div className="text-xs text-brand-blue font-bold mb-2 px-3 flex justify-between items-center bg-white/90 backdrop-blur-sm rounded-full py-1.5 border border-gray-200 shadow-sm"><span>עורך הודעה...</span><button onClick={() => {setEditingMsgId(null); setNewMessage('')}} className="text-gray-500 font-medium text-xs hover:text-red-500 bg-gray-100 px-2 py-0.5 rounded-full">ביטול</button></div>}

          <form onSubmit={handleSend} className="flex items-center gap-1 bg-white p-1 pr-2 rounded-full border border-gray-200 shadow-xl">
            
            <button type="button" onClick={() => setShowEmoji(!showEmoji)} className="p-2 text-gray-400 hover:text-brand-blue transition active:scale-95">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            </button>

            <input type="file" id="chat-file-final" className="hidden" accept="image/*,video/*,application/pdf" onChange={handleFileSelect} />
            <label htmlFor="chat-file-final" className="p-2 text-gray-400 hover:text-brand-blue transition cursor-pointer active:scale-95">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path></svg>
            </label>

            <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} onFocus={() => setShowEmoji(false)} placeholder={editingMsgId ? "ערוך הודעה..." : "הודעה..."} className="flex-1 bg-transparent py-2 px-1 outline-none text-sm text-brand-dark" />
            
            <button type="submit" disabled={!newMessage.trim()} className="bg-brand-blue text-white w-10 h-10 min-w-[40px] rounded-full flex items-center justify-center shadow-md disabled:opacity-50 transition active:scale-90 shrink-0">
              <svg className="w-4 h-4 transform -rotate-45 translate-x-px" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

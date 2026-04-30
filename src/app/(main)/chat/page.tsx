'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../../lib/supabase'
import EmojiPicker from 'emoji-picker-react'

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

    const channel = supabase.channel('chat_realtime_v4')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, fetchMessages)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!newMessage.trim() || !currentUser) return
    
    if (editingMsgId) {
      await supabase.from('messages').update({ content: newMessage }).eq('id', editingMsgId)
      setEditingMsgId(null)
    } else {
      await supabase.from('messages').insert([{ user_id: currentUser.id, content: newMessage }])
    }
    
    setNewMessage('')
    setShowEmoji(false)
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  const handleDelete = async (id: string) => {
    await supabase.from('messages').delete().eq('id', id)
    setActiveMenu(null)
  }

  const handleEditClick = (msg: any) => {
    setEditingMsgId(msg.id)
    setNewMessage(msg.content)
    setActiveMenu(null)
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
      
      {/* שכבת הרקע לסגירת תפריטים (z-40 כדי שהתפריט יהיה מעליה) */}
      {(activeMenu || showEmoji) && (
        <div className="fixed inset-0 z-40" onClick={() => { setActiveMenu(null); setShowEmoji(false); }} />
      )}

      {/* אזור ההודעות הפנימי */}
      <div className="flex-1 space-y-5 pb-32 pt-2 relative z-0 px-2">
        {messages.map((msg) => {
          const isMe = currentUser?.id === msg.user_id
          const hasMedia = !!msg.media_url
          
          return (
            <div key={msg.id} className={`flex gap-2 relative ${isMe ? 'flex-row-reverse' : ''} ${activeMenu === msg.id ? 'z-50' : 'z-10'}`}>
              {!isMe && <img src={msg.profiles?.avatar_url || `https://api.dicebear.com/7.x/notionists/svg?seed=${msg.user_id}`} className="w-8 h-8 rounded-full border border-white self-end shrink-0" />}
              
              <div className={`max-w-[75%] flex flex-col relative group items-start ${isMe ? 'items-end' : ''}`}>
                
                {/* כפתור 3 נקודות */}
                {isMe && (
                  <button onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === msg.id ? null : msg.id); }} className="absolute -top-1 -right-6 text-gray-400 opacity-100 group-hover:opacity-100 transition p-1 z-20">
                     <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"></path></svg>
                  </button>
                )}
                
                {/* תפריט מחיקה/עריכה נפתח ימינה (z-50) */}
                {activeMenu === msg.id && (
                  <div className="absolute top-0 -right-24 bg-white shadow-xl rounded-xl border border-gray-100 py-2 px-4 text-xs z-50 flex flex-col gap-3 min-w-[70px] items-center">
                    <button onClick={(e) => { e.stopPropagation(); handleEditClick(msg); }} className="text-brand-blue font-bold w-full text-center hover:scale-105 transition">ערוך</button>
                    <div className="h-px bg-gray-100 w-full" />
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(msg.id); }} className="text-red-500 font-bold w-full text-center hover:scale-105 transition">מחק</button>
                  </div>
                )}

                {hasMedia && (
                  <div className="mb-1 relative z-0">
                    {msg.media_type === 'image' && <img src={msg.media_url} className="rounded-2xl max-w-full shadow-sm" alt="media" />}
                    {msg.media_type === 'video' && <video src={msg.media_url} controls className="rounded-2xl max-w-full shadow-sm" />}
                    {msg.media_type === 'file' && <a href={msg.media_url} target="_blank" className="bg-white p-3 rounded-2xl shadow-sm underline font-bold flex items-center gap-1 text-sm"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path></svg> צפה בקובץ</a>}
                  </div>
                )}

                {msg.content && (
                  <div className={`p-3 text-sm shadow-sm relative z-0 ${hasMedia ? 'bg-white text-brand-dark rounded-2xl w-full border border-gray-100 mt-1' : isMe ? 'bg-brand-blue text-white rounded-2xl rounded-br-none' : 'bg-white text-brand-dark rounded-2xl border border-gray-100 rounded-bl-none'}`}>
                    {!isMe && !hasMedia && <p className="font-bold text-[10px] text-brand-blue mb-1">{msg.profiles?.full_name}</p>}
                    <p className="leading-relaxed">{msg.content}</p>
                  </div>
                )}
                
                <p className={`text-[9px] mt-1 text-left px-1 text-gray-400`}>
                  {new Date(msg.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* אזור מקלדת תחתון */}
      <div className="fixed bottom-0 left-0 w-full flex justify-center z-50 pointer-events-none">
        <div className="w-full max-w-md px-4 pb-6 pt-4 pointer-events-auto relative">
          
          {/* אימוג'ים */}
          {showEmoji && (
            <div className="absolute bottom-[85px] right-2 left-2 z-50 shadow-2xl rounded-[2rem] overflow-hidden border border-gray-100 bg-white">
              <EmojiPicker 
                onEmojiClick={(e) => {
                  setNewMessage(prev => prev + e.emoji);
                  setShowEmoji(false); // סגירה אוטומטית בלחיצה
                }} 
                width="100%" 
                height={300} 
                searchDisabled 
              />
            </div>
          )}

          {editingMsgId && <div className="text-xs text-brand-blue font-bold mb-2 px-3 flex justify-between items-center bg-white/90 backdrop-blur-sm rounded-full py-1.5 border border-gray-200"><span>עורך הודעה...</span><button onClick={() => {setEditingMsgId(null); setNewMessage('')}} className="text-gray-500 font-medium text-xs hover:text-red-500">ביטול</button></div>}

          <form onSubmit={handleSend} className="flex items-center gap-1 bg-white p-1 pr-2 rounded-full border border-gray-200 shadow-xl">
            
            <button type="button" onClick={() => setShowEmoji(!showEmoji)} className="p-2 text-gray-400 hover:text-brand-blue transition active:scale-95">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            </button>

            <input type="file" id="chat-file-v4" className="hidden" accept="image/*,video/*,application/pdf" onChange={handleFileSelect} />
            <label htmlFor="chat-file-v4" className="p-2 text-gray-400 hover:text-brand-blue transition cursor-pointer active:scale-95">
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

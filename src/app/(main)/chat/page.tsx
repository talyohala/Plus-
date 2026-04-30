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
  
  // עריכה, מחיקה ומדיה
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null)
  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  const [pendingMedia, setPendingMedia] = useState<{file: File, preview: string, type: string} | null>(null)
  const [mediaCaption, setMediaCaption] = useState('')

  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setCurrentUser(user))
    
    const fetchMessages = async () => {
      const { data } = await supabase.from('messages').select('*, profiles(full_name, avatar_url)').order('created_at', { ascending: true })
      if (data) setMessages(data)
    }
    fetchMessages()

    const channel = supabase.channel('chat_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, fetchMessages)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  useEffect(() => {
    // גלילה חלקה למטה רק באזור ההודעות, כדי לא לדחוף את הכותרת
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages])

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
    <div className="fixed inset-0 bg-gray-50 z-[60] flex flex-col" dir="rtl">
      
      {/* כותרת קבועה עליונה */}
      <div className="bg-white p-4 pt-12 flex items-center gap-4 shadow-sm z-20 shrink-0">
        <Link href="/" className="p-2 hover:bg-gray-100 rounded-full transition">
          <svg className="w-6 h-6 text-brand-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
        </Link>
        <div>
          <h2 className="font-bold text-brand-dark">צ'אט הבניין</h2>
          <p className="text-[10px] text-brand-gray font-medium">קהילת הבניין • מחוברים עכשיו</p>
        </div>
      </div>

      {/* אזור ההודעות הפנימי - רק הוא נגלל */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-5 pb-24 relative">
        {messages.map((msg) => {
          const isMe = currentUser?.id === msg.user_id
          const hasMedia = !!msg.media_url
          
          return (
            <div key={msg.id} className={`flex gap-2 relative ${isMe ? 'flex-row-reverse' : ''}`}>
              {!isMe && <img src={msg.profiles?.avatar_url || `https://api.dicebear.com/7.x/notionists/svg?seed=${msg.user_id}`} className="w-8 h-8 rounded-full border border-white self-end shrink-0" />}
              
              <div className={`max-w-[75%] flex flex-col relative group ${isMe ? 'items-end' : 'items-start'}`}>
                
                {/* תפריט מחיקה/עריכה למשתמש עצמו */}
                {isMe && (
                  <button onClick={() => setActiveMenu(activeMenu === msg.id ? null : msg.id)} className="absolute top-1 -right-6 text-gray-400 opacity-0 group-hover:opacity-100 transition p-1">
                     <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"></path></svg>
                  </button>
                )}
                
                {activeMenu === msg.id && (
                  <div className="absolute top-6 -right-2 bg-white shadow-lg rounded-xl border border-gray-100 py-1 px-3 text-xs z-10 flex flex-col gap-2">
                    <button onClick={() => handleEditClick(msg)} className="text-brand-blue hover:font-bold">ערוך</button>
                    <button onClick={() => handleDelete(msg.id)} className="text-red-500 hover:font-bold">מחק</button>
                  </div>
                )}

                {/* אם יש תמונה/סרטון - מראה נקי בלי בועה */}
                {hasMedia ? (
                  <div className="mb-1">
                    {msg.media_type === 'image' && <img src={msg.media_url} className="rounded-2xl max-w-full shadow-sm" alt="media" />}
                    {msg.media_type === 'video' && <video src={msg.media_url} controls className="rounded-2xl max-w-full shadow-sm" />}
                    {msg.media_type === 'file' && <a href={msg.media_url} target="_blank" className="bg-white p-3 rounded-2xl shadow-sm underline font-bold flex items-center gap-1 text-sm"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path></svg> צפה בקובץ</a>}
                  </div>
                ) : null}

                {/* הבועה הרגילה רק לטקסט, או כתוספת מתחת לתמונה */}
                {msg.content && (
                  <div className={`p-3 text-sm shadow-sm relative ${hasMedia ? 'bg-white text-brand-dark rounded-2xl w-full border border-gray-100 mt-1' : isMe ? 'bg-brand-blue text-white rounded-2xl rounded-br-none' : 'bg-white text-brand-dark rounded-2xl border border-gray-100 rounded-bl-none'}`}>
                    {!isMe && !hasMedia && <p className="font-bold text-[10px] text-brand-blue mb-1">{msg.profiles?.full_name}</p>}
                    <p className="leading-relaxed">{msg.content}</p>
                  </div>
                )}
                
                <p className={`text-[9px] mt-1 text-left px-1 ${isMe ? 'text-gray-400' : 'text-gray-400'}`}>
                  {new Date(msg.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {/* תצוגה מקדימה לפני העלאת קובץ (Overlay) */}
      {pendingMedia && (
        <div className="absolute inset-0 bg-black/90 z-50 flex flex-col">
          <div className="p-4 pt-12 flex justify-between text-white">
            <button onClick={() => setPendingMedia(null)} className="p-2"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
            <span className="font-bold text-sm mt-2">שלח מדיה</span>
          </div>
          <div className="flex-1 flex items-center justify-center p-4">
            {pendingMedia.type === 'image' && <img src={pendingMedia.preview} className="max-h-full rounded-2xl object-contain" />}
            {pendingMedia.type === 'video' && <video src={pendingMedia.preview} controls className="max-h-full rounded-2xl" />}
            {pendingMedia.type === 'file' && <div className="text-white text-center"><svg className="w-20 h-20 mx-auto mb-2 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>קובץ מצורף</div>}
          </div>
          <div className="p-4 pb-8 flex gap-2 items-center">
            <input type="text" value={mediaCaption} onChange={e=>setMediaCaption(e.target.value)} placeholder="הוסף כיתוב (אופציונלי)..." className="flex-1 bg-white/10 text-white rounded-full px-4 py-3 outline-none backdrop-blur-md border border-white/20 text-sm" />
            <button onClick={confirmSendMedia} disabled={uploading} className="bg-brand-blue text-white w-12 h-12 rounded-full flex items-center justify-center shadow-lg disabled:opacity-50">
              {uploading ? <span className="text-xs font-bold animate-pulse">שולח</span> : <svg className="w-5 h-5 transform -translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>}
            </button>
          </div>
        </div>
      )}

      {/* אזור הקלדה תחתון */}
      <div className="bg-white border-t border-gray-100 p-3 pb-6 shrink-0 relative">
        
        {/* אימוג'ים - צפים מעל חלון ההקלדה */}
        {showEmoji && (
          <div className="absolute bottom-[80px] right-2 left-2 z-50 shadow-2xl rounded-[2rem] overflow-hidden border border-gray-100">
            <EmojiPicker onEmojiClick={(e) => setNewMessage(prev => prev + e.emoji)} width="100%" height={300} searchDisabled />
          </div>
        )}

        {editingMsgId && <div className="text-xs text-brand-blue font-bold mb-2 px-2 flex justify-between items-center"><span>עורך הודעה...</span><button onClick={() => {setEditingMsgId(null); setNewMessage('')}}>ביטול</button></div>}

        <form onSubmit={handleSend} className="flex items-center gap-2 bg-gray-50 p-1.5 pr-2 rounded-full border border-gray-200">
          
          <button type="button" onClick={() => setShowEmoji(!showEmoji)} className="p-2 text-gray-400 hover:text-brand-blue transition">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          </button>

          <input type="file" id="chat-file" className="hidden" accept="image/*,video/*,application/pdf" onChange={handleFileSelect} />
          <label htmlFor="chat-file" className="p-2 text-gray-400 hover:text-brand-blue transition cursor-pointer">
            <svg className="w-6 h-6 transform rotate-45" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path></svg>
          </label>

          <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} onFocus={() => setShowEmoji(false)} placeholder={editingMsgId ? "ערוך את ההודעה..." : "הודעה..."} className="flex-1 bg-transparent py-2 px-1 outline-none text-sm text-brand-dark" />
          
          <button type="submit" disabled={!newMessage.trim()} className="bg-brand-blue text-white w-10 h-10 min-w-[40px] rounded-full flex items-center justify-center shadow-md disabled:opacity-50 transition active:scale-90">
            {/* כפתור נטוי, עגול ומושלם */}
            <svg className="w-4 h-4 transform -translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
          </button>
        </form>
      </div>
    </div>
  )
}

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
    // גלילה אוטומטית למטה להודעה החדשה ביותר
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }, [messages])

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!newMessage.trim() || !currentUser) return
    const text = newMessage
    setNewMessage('')
    setShowEmoji(false)
    await supabase.from('messages').insert([{ user_id: currentUser.id, content: text }])
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !currentUser) return

    setUploading(true)
    const fileExt = file.name.split('.').pop()
    const fileName = `${Math.random()}.${fileExt}`
    const filePath = `${currentUser.id}/${fileName}`

    const { error: uploadError } = await supabase.storage.from('chat_uploads').upload(filePath, file)
    if (!uploadError) {
      const { data } = supabase.storage.from('chat_uploads').getPublicUrl(filePath)
      let type = 'file'
      if (file.type.startsWith('image/')) type = 'image'
      if (file.type.startsWith('video/')) type = 'video'

      await supabase.from('messages').insert([{ 
        user_id: currentUser.id, 
        content: '', 
        media_url: data.publicUrl,
        media_type: type
      }])
    } else {
      alert('שגיאה בהעלאת הקובץ')
    }
    setUploading(false)
  }

  return (
    <div className="flex flex-col flex-1 w-full relative" dir="rtl">
      
      {/* אזור ההודעות */}
      <div className="flex-1 space-y-4 pb-12 pt-4">
        {messages.map((msg) => {
          const isMe = currentUser?.id === msg.user_id
          return (
            <div key={msg.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
              {!isMe && (
                <img src={msg.profiles?.avatar_url || `https://api.dicebear.com/7.x/notionists/svg?seed=${msg.user_id}`} className="w-8 h-8 rounded-full border border-white self-end" />
              )}
              <div className={`max-w-[80%] p-3 rounded-2xl text-sm shadow-sm relative ${
                isMe ? 'bg-brand-blue text-white rounded-br-none' : 'bg-white text-brand-dark border border-gray-100 rounded-bl-none'
              }`}>
                {!isMe && <p className="font-bold text-[10px] text-brand-blue mb-1">{msg.profiles?.full_name}</p>}
                
                {/* תצוגת קבצים/תמונות/סרטונים */}
                {msg.media_url && (
                  <div className="mb-2">
                    {msg.media_type === 'image' && <img src={msg.media_url} className="rounded-xl max-w-full h-auto" alt="attachment" />}
                    {msg.media_type === 'video' && <video src={msg.media_url} controls className="rounded-xl max-w-full h-auto" />}
                    {msg.media_type === 'file' && <a href={msg.media_url} target="_blank" className="underline font-bold flex items-center gap-1"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path></svg> צפה בקובץ</a>}
                  </div>
                )}
                
                {msg.content && <p className="leading-relaxed">{msg.content}</p>}
                <p className={`text-[9px] mt-1 text-left ${isMe ? 'text-blue-100' : 'text-gray-400'}`}>
                  {new Date(msg.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          )
        })}
        {uploading && <div className="text-center text-xs text-brand-gray font-bold animate-pulse">שולח קובץ...</div>}
        <div ref={bottomRef} />
      </div>

      {/* אזור הקלדה קבוע למטה */}
      <div className="fixed bottom-0 left-0 w-full flex justify-center z-50">
        <div className="w-full max-w-md px-4 pb-6 pt-4 bg-gradient-to-t from-gray-50 via-gray-50 to-transparent relative">
          
          {/* חלון האימוג'ים */}
          {showEmoji && (
            <div className="absolute bottom-24 right-4 z-50 shadow-2xl rounded-3xl overflow-hidden">
              <EmojiPicker onEmojiClick={(e) => setNewMessage(prev => prev + e.emoji)} width={300} height={350} />
            </div>
          )}

          <form onSubmit={handleSend} className="flex items-center gap-2 bg-white p-1 pr-2 rounded-full border border-gray-200 shadow-lg">
            
            {/* כפתור אימוג'י */}
            <button type="button" onClick={() => setShowEmoji(!showEmoji)} className="p-2 text-gray-400 hover:text-brand-blue transition">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            </button>

            {/* כפתור מצלמה/קבצים */}
            <input type="file" id="file-upload" className="hidden" accept="image/*,video/*,application/pdf" onChange={handleFileUpload} />
            <label htmlFor="file-upload" className="p-2 text-gray-400 hover:text-brand-blue transition cursor-pointer">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path></svg>
            </label>

            <input 
              type="text" 
              value={newMessage} 
              onChange={(e) => setNewMessage(e.target.value)} 
              placeholder="הודעה לכל הבניין..." 
              className="flex-1 bg-transparent py-2 px-2 outline-none text-sm text-brand-dark"
              onFocus={() => setShowEmoji(false)}
            />
            
            {/* כפתור שליחה נטוי שמאלה כמו מטוס נייר */}
            <button type="submit" disabled={!newMessage.trim()} className="bg-brand-blue text-white w-10 h-10 rounded-full flex items-center justify-center shadow-md disabled:opacity-50 active:scale-90 transition">
              <svg className="w-5 h-5 mr-1 transform -rotate-[30deg]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
            </button>

          </form>
        </div>
      </div>
    </div>
  )
}

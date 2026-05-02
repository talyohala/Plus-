'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../../lib/supabase'
import EmojiPicker from 'emoji-picker-react'

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
  const [uploading, setUploading] = useState(false)

  const [editingMsgId, setEditingMsgId] = useState<string | null>(null)
  const [activeMenu, setActiveMenu] = useState<any | null>(null)
  const [pendingMedia, setPendingMedia] = useState<{file: File, preview: string, type: string} | null>(null)
  const [mediaCaption, setMediaCaption] = useState('')
  const [fullScreenMedia, setFullScreenMedia] = useState<{url: string, type: string} | null>(null)
  
  const [replyingTo, setReplyingTo] = useState<any | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<{isOpen: boolean, msgId: string | null}>({ isOpen: false, msgId: null })

  const bottomRef = useRef<HTMLDivElement>(null)
  const pressTimer = useRef<any>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setCurrentUser(user))

    const fetchMessages = async () => {
      const { data } = await supabase.from('messages').select('*, profiles(full_name, avatar_url, role)').order('created_at', { ascending: true })
      if (data) {
        setMessages(data)
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
      }
    }
    fetchMessages()

    const channel = supabase.channel('chat_realtime_v15')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, fetchMessages)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!newMessage.trim() || !currentUser) return

    if (editingMsgId) {
      setMessages(prev => prev.map(m => m.id === editingMsgId ? { ...m, content: newMessage } : m))
      const { error } = await supabase.from('messages').update({ content: newMessage }).eq('id', editingMsgId)
      if(error) setErrorMessage("שגיאה בעריכה: " + error.message)
      setEditingMsgId(null)
    } else {
      await supabase.from('messages').insert([{ 
        user_id: currentUser.id, 
        content: newMessage,
        reply_to_id: replyingTo?.id || null 
      }])
    }

    setNewMessage('')
    setShowEmoji(false)
    setReplyingTo(null)
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  const handlePressStart = (msg: any) => {
    pressTimer.current = setTimeout(() => {
      setActiveMenu(msg)
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(50)
      }
    }, 400)
  }

  const handlePressEnd = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current)
  }

  const promptDelete = (id: string) => {
    setActiveMenu(null)
    setConfirmDialog({ isOpen: true, msgId: id })
  }

  const confirmDeleteAction = async () => {
    const id = confirmDialog.msgId
    if (!id) return
    setConfirmDialog({ isOpen: false, msgId: null })

    setMessages(prev => prev.filter(m => m.id !== id))
    const { error } = await supabase.from('messages').delete().eq('id', id)
    if(error) setErrorMessage("שגיאה במחיקה: " + error.message)
  }

  const handleEditClick = (msg: any) => {
    setActiveMenu(null)
    setEditingMsgId(msg.id)
    setNewMessage(msg.content)
  }

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setActiveMenu(null)
    } catch (err) {
      console.error('Failed to copy text', err)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const type = file.type.startsWith('video/') ? 'video' : file.type.startsWith('image/') ? 'image' : 'file'
    setPendingMedia({ file, preview: URL.createObjectURL(file), type })
    e.target.value = '' // התיקון שמאפשר לבחור את אותו קובץ שוב או לפתוח גלריה ברצף!
  }

  const confirmSendMedia = async () => {
    if (!pendingMedia || !currentUser) return
    setUploading(true)

    const fileExt = pendingMedia.file.name.split('.').pop()
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
    const filePath = `${currentUser.id}/${fileName}`

    const { error } = await supabase.storage.from('chat_uploads').upload(filePath, pendingMedia.file)
    if (!error) {
      const { data } = supabase.storage.from('chat_uploads').getPublicUrl(filePath)
      await supabase.from('messages').insert([{
        user_id: currentUser.id,
        content: mediaCaption,
        media_url: data.publicUrl,
        media_type: pendingMedia.type,
        file_name: pendingMedia.file.name,
        reply_to_id: replyingTo?.id || null
      }])
    } else {
      setErrorMessage("שגיאה בהעלאה: " + error.message)
    }

    setPendingMedia(null)
    setMediaCaption('')
    setReplyingTo(null)
    setUploading(false)
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 300)
  }

  const getRepliedMsg = (id: string) => messages.find(m => m.id === id)

  const getMessageDateLabel = (dateString: string) => {
    const date = new Date(dateString)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (date.toDateString() === today.toDateString()) return 'היום'
    if (date.toDateString() === yesterday.toDateString()) return 'אתמול'
    return date.toLocaleDateString('he-IL')
  }

  let lastDateLabel = ''

  return (
    <div className="flex flex-col flex-1 w-full relative min-h-[100dvh]" dir="rtl">

      {/* הרקע האחורי הקבוע - חלק ונקי */}
      <div className="fixed inset-0 bg-[#F0F2F5] -z-10" />

      {(activeMenu || showEmoji) && (
        <div className="fixed inset-0 z-40 bg-transparent" onClick={() => { setActiveMenu(null); setShowEmoji(false); }} />
      )}

      {/* אזור ההודעות */}
      <div className="flex-1 space-y-4 pb-40 pt-2 px-3 overflow-y-auto">
        {messages.map((msg) => {
          const isMe = currentUser?.id === msg.user_id
          const hasMedia = !!msg.media_url
          const isActive = activeMenu?.id === msg.id

          const currentLabel = getMessageDateLabel(msg.created_at)
          const showDateSeparator = currentLabel !== lastDateLabel
          lastDateLabel = currentLabel

          return (
            <div key={msg.id}>
              {showDateSeparator && (
                <div className="flex justify-center my-4">
                  <span className="bg-white text-gray-500 text-[10px] font-bold px-3 py-1 rounded-full shadow-sm">
                    {currentLabel}
                  </span>
                </div>
              )}

              <div className={`flex gap-2 relative ${isMe ? 'flex-row-reverse' : ''} ${isActive ? 'z-[60]' : 'z-10'}`}>
                {!isMe && <img src={msg.profiles?.avatar_url || `https://api.dicebear.com/7.x/notionists/svg?seed=${msg.user_id}`} className="w-8 h-8 rounded-full border border-white self-end shrink-0 shadow-sm" />}

                <div 
                  className={`max-w-[78%] flex flex-col relative group items-start ${isMe ? 'items-end' : ''} cursor-pointer select-none`}
                  style={{ WebkitTouchCallout: 'none' }}
                  onTouchStart={() => handlePressStart(msg)}
                  onTouchEnd={handlePressEnd}
                  onTouchMove={handlePressEnd}
                  onMouseDown={() => handlePressStart(msg)}
                  onMouseUp={handlePressEnd}
                  onMouseLeave={handlePressEnd}
                >

                  {msg.reply_to_id && getRepliedMsg(msg.reply_to_id) && (
                    <div className={`w-full rounded-xl px-2.5 py-1.5 mb-1 border-r-4 text-[11px] text-left opacity-90 shadow-sm ${isMe ? 'bg-[#D0E6FB] border-[#2D5AF0]' : 'bg-gray-50 border-[#2D5AF0]'}`} dir="rtl">
                      <span className="font-black block mb-0.5 text-[#2D5AF0]">{getRepliedMsg(msg.reply_to_id).profiles?.full_name}</span>
                      <span className="line-clamp-1 text-gray-600">{getRepliedMsg(msg.reply_to_id).content || 'מדיה צורפה'}</span>
                    </div>
                  )}

                  {hasMedia && (
                    <div className="mb-1 relative z-0 w-full" onClick={() => setFullScreenMedia({ url: msg.media_url, type: msg.media_type })}>
                      {msg.media_type === 'image' && <img src={msg.media_url} className="rounded-[16px] w-full max-w-full h-auto max-h-[250px] object-cover shadow-sm" alt="media" />}
                      {msg.media_type === 'video' && <div className="relative bg-black w-full rounded-[16px] overflow-hidden shadow-sm"><video src={msg.media_url} className="w-full max-h-[250px] object-cover opacity-80 pointer-events-none" /><div className="absolute inset-0 flex items-center justify-center"><div className="bg-white/20 backdrop-blur-sm p-3 rounded-full"><svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd"></path></svg></div></div></div>}
                      {msg.media_type === 'file' && (
                        <a href={msg.media_url} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-3 p-2 rounded-xl shadow-sm transition active:scale-95 ${isMe ? 'bg-[#D0E6FB]' : 'bg-white'}`}>
                          <div className={`p-2 rounded-lg ${isMe ? 'bg-[#2D5AF0] text-white' : 'bg-[#2D5AF0]/10 text-[#2D5AF0]'}`}>
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                          </div>
                          <div className="flex flex-col text-left">
                            <span className="text-xs font-bold line-clamp-1 text-brand-dark">{msg.file_name || 'מסמך מצורף'}</span>
                            <span className="text-[10px] text-gray-500">לחץ להורדה</span>
                          </div>
                        </a>
                      )}
                    </div>
                  )}

                  {msg.content && (
                    <div className={`p-3 text-sm shadow-sm relative z-0 ${hasMedia ? 'bg-white text-brand-dark rounded-2xl w-full mt-1' : isMe ? 'bg-[#E3F2FD] text-brand-dark rounded-2xl rounded-br-sm' : 'bg-white text-brand-dark rounded-2xl border border-gray-100/50 rounded-bl-sm'}`}>
                      {!isMe && !hasMedia && <p className="font-bold text-[10px] text-[#2D5AF0] mb-1">{msg.profiles?.full_name}</p>}
                      <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  )}

                  <div className={`flex items-center gap-1 mt-1 px-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <p className="text-[9px] text-gray-400 font-medium">
                      {new Date(msg.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    {isMe && <svg className="w-3.5 h-3.5 text-[#34B7F1] opacity-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"></path></svg>}
                  </div>

                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* תפריט Bottom Sheet לפעולות (לחיצה ארוכה) */}
      {activeMenu && (
        <div className="fixed inset-0 z-[100] flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity animate-in fade-in" onClick={() => setActiveMenu(null)} />
          <div className="bg-white w-full rounded-t-3xl pb-10 pt-5 px-4 relative z-10 animate-in slide-in-from-bottom-full shadow-[0_-10px_40px_rgba(0,0,0,0.2)]">
            <div className="absolute top-3 left-1/2 -translate-x-1/2 w-10 h-1.5 bg-gray-200 rounded-full" />
            
            <div className="flex justify-around items-start mt-6 px-2">
              <button onClick={() => { setReplyingTo(activeMenu); setActiveMenu(null); }} className="flex flex-col items-center gap-2 group transition active:scale-95">
                <div className="w-14 h-14 rounded-full bg-[#2D5AF0]/10 text-[#2D5AF0] flex items-center justify-center group-hover:bg-[#2D5AF0] group-hover:text-white transition">
                  <svg className="w-6 h-6 transform rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"></path></svg>
                </div>
                <span className="text-[11px] font-bold text-brand-dark">השבה</span>
              </button>

              {activeMenu.content && (
                <button onClick={() => handleCopy(activeMenu.content)} className="flex flex-col items-center gap-2 group transition active:scale-95">
                  <div className="w-14 h-14 rounded-full bg-gray-100 text-brand-dark flex items-center justify-center group-hover:bg-gray-200 transition">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                  </div>
                  <span className="text-[11px] font-bold text-brand-dark">העתקה</span>
                </button>
              )}

              {/* הוספת כפתור עריכה */}
              {currentUser?.id === activeMenu.user_id && activeMenu.content && !activeMenu.media_url && (
                <button onClick={() => handleEditClick(activeMenu)} className="flex flex-col items-center gap-2 group transition active:scale-95">
                  <div className="w-14 h-14 rounded-full bg-gray-100 text-brand-dark flex items-center justify-center group-hover:bg-gray-200 transition">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                  </div>
                  <span className="text-[11px] font-bold text-brand-dark">עריכה</span>
                </button>
              )}

              {(currentUser?.id === activeMenu.user_id || currentUser?.role === 'admin') && (
                <button onClick={() => promptDelete(activeMenu.id)} className="flex flex-col items-center gap-2 group transition active:scale-95">
                  <div className="w-14 h-14 rounded-full bg-red-50 text-red-500 flex items-center justify-center group-hover:bg-red-100 transition">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                  </div>
                  <span className="text-[11px] font-bold text-red-500">מחיקה</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* תצוגת מסך מלא למדיה */}
      {fullScreenMedia && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex items-center justify-center p-2 animate-in fade-in" onClick={() => setFullScreenMedia(null)}>
          <button className="absolute top-6 left-6 p-1 text-white/70 hover:text-white transition z-10">
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
          {fullScreenMedia.type === 'video' ? <video src={fullScreenMedia.url} controls autoPlay className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl" onClick={e => e.stopPropagation()} /> : <img src={fullScreenMedia.url} className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl" onClick={e => e.stopPropagation()} />}
        </div>
      )}

      {/* תצוגה מקדימה לפני שליחת מדיה - כפתור ה-X נקי ובשמאל */}
      {pendingMedia && (
        <div className="fixed inset-0 bg-black/95 z-[999] flex flex-col animate-in fade-in" dir="rtl">
          <div className="p-4 pt-12 flex justify-between items-center text-white w-full">
            <div className="w-10"></div>
            <span className="font-bold text-lg">תצוגה מקדימה</span>
            <button onClick={() => setPendingMedia(null)} className="p-1 text-white/70 hover:text-white transition">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
            {pendingMedia.type === 'image' && <img src={pendingMedia.preview} className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl" />}
            {pendingMedia.type === 'video' && <video src={pendingMedia.preview} controls className="max-w-full max-h-full rounded-2xl shadow-2xl" />}
            {pendingMedia.type === 'file' && <div className="bg-white/10 p-10 rounded-3xl flex flex-col items-center gap-4"><svg className="w-20 h-20 text-brand-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg><p className="text-white font-bold text-center">{pendingMedia.file.name}</p></div>}
          </div>
          <div className="p-5 pb-10 bg-black flex gap-3 items-center">
            <input type="text" value={mediaCaption} onChange={e=>setMediaCaption(e.target.value)} placeholder="הוסף כיתוב..." className="flex-1 bg-white/20 text-white placeholder-white/60 rounded-full px-5 py-4 outline-none border border-white/10 text-sm focus:border-[#2D5AF0] transition" />
            <button onClick={confirmSendMedia} disabled={uploading} className="bg-[#2D5AF0] text-white w-14 h-14 rounded-full flex items-center justify-center shadow-lg disabled:opacity-50 active:scale-95 transition shrink-0">
              {uploading ? <span className="text-[10px] font-bold animate-pulse">מעלה</span> : <svg className="w-6 h-6 transform -rotate-45 translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>}
            </button>
          </div>
        </div>
      )}

      {/* מודלים מעוצבים לשגיאות */}
      {errorMessage && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-in zoom-in-95">
            <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mb-4 mx-auto text-red-500"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg></div>
            <h3 className="font-black text-lg text-center text-brand-dark mb-2">אופס, משהו השתבש</h3>
            <p className="text-sm text-center text-brand-gray mb-6 leading-relaxed">{errorMessage}</p>
            <button onClick={() => setErrorMessage(null)} className="w-full bg-gray-100 text-brand-dark font-bold py-3 rounded-xl hover:bg-gray-200 transition active:scale-95">הבנתי, סגור</button>
          </div>
        </div>
      )}

      {confirmDialog.isOpen && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-in zoom-in-95">
            <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mb-4 mx-auto text-red-500"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></div>
            <h3 className="font-black text-lg text-center text-brand-dark mb-2">מחיקת הודעה</h3>
            <p className="text-sm text-center text-brand-gray mb-6 leading-relaxed">האם למחוק את ההודעה לצמיתות?</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDialog({ isOpen: false, msgId: null })} className="flex-1 bg-gray-100 text-brand-dark font-bold py-3 rounded-xl hover:bg-gray-200 transition active:scale-95">ביטול</button>
              <button onClick={confirmDeleteAction} className="flex-1 bg-red-500 text-white font-bold py-3 rounded-xl hover:bg-red-600 transition active:scale-95">מחק</button>
            </div>
          </div>
        </div>
      )}

      {/* אזור ההקלדה התחתון */}
      <div className="fixed bottom-0 left-0 w-full flex justify-center z-50 pointer-events-none pb-4 pt-10">
        <div className="w-full max-w-md px-4 pointer-events-auto relative">

          {showEmoji && (
            <div className="absolute bottom-[100%] right-4 left-4 mb-2 z-50 shadow-2xl rounded-3xl overflow-hidden border border-gray-100 bg-white animate-in slide-in-from-bottom-2">
              <EmojiPicker 
                onEmojiClick={(e) => { setNewMessage(prev => prev + e.emoji); setShowEmoji(false); }} 
                width="100%" 
                height={320} 
                searchDisabled={true} 
                skinTonesDisabled={true}
                previewConfig={{ showPreview: false }} 
                categories={hebrewCategories}
              />
            </div>
          )}

          {replyingTo && (
            <div className="bg-white/95 backdrop-blur-md border-r-4 border-[#2D5AF0] p-2.5 rounded-2xl mb-2 flex justify-between items-center shadow-lg border border-gray-100 animate-in fade-in slide-in-from-bottom-2">
              <div className="flex flex-col overflow-hidden pl-2">
                <span className="font-bold text-xs text-[#2D5AF0] mb-0.5">{replyingTo.profiles?.full_name}</span>
                <span className="text-xs text-brand-dark/70 truncate">{replyingTo.content || (replyingTo.media_url ? 'מדיה' : '')}</span>
              </div>
              <button onClick={() => setReplyingTo(null)} className="p-1 text-gray-400 hover:text-gray-600 transition shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
          )}

          {editingMsgId && (
            <div className="text-xs text-[#2D5AF0] font-bold mb-2 flex justify-between items-center bg-white/95 backdrop-blur-md rounded-2xl p-2.5 border border-gray-100 shadow-lg animate-in fade-in">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                עורך הודעה...
              </div>
              <button onClick={() => {setEditingMsgId(null); setNewMessage('')}} className="p-1 text-[#2D5AF0]/60 hover:text-[#2D5AF0] transition shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
          )}

          <form onSubmit={handleSend} className="flex items-center gap-1 bg-white p-1 pr-2 rounded-full border border-gray-200 shadow-xl pointer-events-auto">
            
            <button type="button" onClick={() => setShowEmoji(!showEmoji)} className={`p-2 transition active:scale-95 ${showEmoji ? 'text-brand-blue bg-brand-blue/10 rounded-full' : 'text-gray-400 hover:text-brand-blue'}`}>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            </button>

            <input type="file" ref={fileInputRef} className="hidden" accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx" onChange={handleFileSelect} />
            <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 text-gray-400 hover:text-brand-blue transition cursor-pointer active:scale-95">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path></svg>
            </button>

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

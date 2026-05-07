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
    const [editingMessage, setEditingMessage] = useState<any | null>(null)
    const [editContent, setEditContent] = useState('')
    const [isUploading, setIsUploading] = useState(false)
    const [fullScreenImage, setFullScreenImage] = useState<string | null>(null)

    const bottomRef = useRef<HTMLDivElement>(null)
    const pressTimer = useRef<any>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

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

        const contentToSend = newMessage
        const replyIdToSend = replyingTo?.id || null

        setNewMessage('')
        setShowEmoji(false)
        setReplyingTo(null)
        
        await supabase.from('messages').insert([{
            user_id: currentUser.id,
            building_id: currentUser.building_id,
            content: contentToSend,
            reply_to_id: replyIdToSend
        }])

        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    }

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file || !currentUser) return

        setIsUploading(true)
        playSystemSound('click')
        setShowEmoji(false)

        const fileExt = file.name.split('.').pop()
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`
        const filePath = `chat/${fileName}`

        const { error: uploadError } = await supabase.storage.from('chat_uploads').upload(filePath, file)
        
        if (!uploadError) {
            const { data } = supabase.storage.from('chat_uploads').getPublicUrl(filePath)
            
            await supabase.from('messages').insert([{
                user_id: currentUser.id,
                building_id: currentUser.building_id,
                content: '',
                image_url: data.publicUrl,
                reply_to_id: replyingTo?.id || null
            }])
            playSystemSound('notification')
        }
        
        setIsUploading(false)
        setReplyingTo(null)
        if(fileInputRef.current) fileInputRef.current.value = ''
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    }

    const handleSaveEdit = async () => {
        if (!editingMessage || !editContent.trim()) return;
        await supabase.from('messages').update({ content: editContent }).eq('id', editingMessage.id);
        playSystemSound('notification');
        setEditingMessage(null);
    }

    const deleteMessage = async (msgId: string) => {
        setActiveMenu(null)
        await supabase.from('messages').delete().eq('id', msgId)
        playSystemSound('click')
    }

    // העתקת טקסט וביטול התפריט
    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text)
        playSystemSound('click')
        setActiveMenu(null)
    }

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
                building_id: currentUser.building_id,
                content: `✅ היי, פתחתי קריאת שירות מסודרת בלוח התקלות של הבניין בעקבות ההודעה שלך. נושא בטיפול.`,
                reply_to_id: msg.id
            }])
            playSystemSound('notification')
        }
    }

    const handlePressStart = (msg: any) => {
        pressTimer.current = setTimeout(() => {
            setActiveMenu(msg)
            setShowEmoji(false)
            if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(50)
        }, 400)
    }

    const handlePressEnd = () => { if (pressTimer.current) clearTimeout(pressTimer.current) }

    const getRepliedMsg = (id: string) => messages.find(m => m.id === id)

    return (
        <div className="flex flex-col flex-1 w-full relative min-h-[100dvh]" dir="rtl">
            <div className="fixed inset-0 bg-[#F0F2F5] -z-10" />

            {activeMenu && <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={() => setActiveMenu(null)} />}
            {showEmoji && <div className="fixed inset-0 z-40" onClick={() => setShowEmoji(false)} />}

            <div className="flex-1 space-y-4 pb-32 pt-2 px-3 overflow-y-auto">
                {messages.map((msg) => {
                    const isMe = currentUser?.id === msg.user_id
                    const isActive = activeMenu?.id === msg.id

                    return (
                        <div key={msg.id} className={`flex gap-2 relative ${isMe ? 'flex-row-reverse' : ''} ${isActive ? 'z-[60]' : 'z-10'}`}>
                            {!isMe && <img src={msg.profiles?.avatar_url || `https://api.dicebear.com/8.x/initials/svg?seed=${msg.profiles?.full_name}`} className="w-8 h-8 rounded-full border border-white self-end shrink-0 shadow-sm" />}
                            
                            <div
                                // תוספת חסימת בחירת הטקסט המובנית של המכשיר
                                className={`max-w-[78%] flex flex-col items-start ${isMe ? 'items-end' : ''} cursor-pointer select-none [-webkit-touch-callout:none] [-webkit-user-select:none]`}
                                onContextMenu={(e) => e.preventDefault()}
                                onTouchStart={() => handlePressStart(msg)}
                                onTouchEnd={handlePressEnd}
                                onTouchMove={handlePressEnd}
                            >
                                {msg.reply_to_id && getRepliedMsg(msg.reply_to_id) && (
                                    <div className={`w-full rounded-xl px-2.5 py-1.5 mb-1 border-r-4 text-[11px] text-left opacity-90 shadow-sm ${isMe ? 'bg-[#D0E6FB] border-[#2D5AF0]' : 'bg-gray-50 border-[#2D5AF0]'}`} dir="rtl">
                                        <span className="font-black block mb-0.5 text-[#2D5AF0]">{getRepliedMsg(msg.reply_to_id).profiles?.full_name}</span>
                                        <span className="line-clamp-1 text-gray-600">{getRepliedMsg(msg.reply_to_id).content || 'תמונה'}</span>
                                    </div>
                                )}

                                <div className={`p-1.5 text-sm shadow-sm relative z-0 ${isMe ? 'bg-[#E3F2FD] text-brand-dark rounded-2xl rounded-br-sm' : 'bg-white text-brand-dark rounded-2xl border border-gray-100/50 rounded-bl-sm'}`}>
                                    {!isMe && <p className="font-bold text-[10px] text-[#2D5AF0] mb-1 px-1.5 pt-1">{msg.profiles?.full_name}</p>}
                                    
                                    {msg.image_url && (
                                        <div className="mt-1 mb-1 rounded-xl overflow-hidden cursor-pointer" onClick={(e) => { e.stopPropagation(); setFullScreenImage(msg.image_url) }}>
                                            <img src={msg.image_url} alt="Uploaded content" className="max-w-[200px] max-h-[250px] object-cover rounded-xl" />
                                        </div>
                                    )}
                                    
                                    {msg.content && <p className="leading-relaxed whitespace-pre-wrap px-1.5 pb-1 pt-0.5 pointer-events-none">{msg.content}</p>}
                                </div>
                            </div>
                        </div>
                    )
                })}
                <div ref={bottomRef} />
            </div>

            {/* תפריט פעולות (לחיצה ארוכה) */}
            {activeMenu && (
                <div className="fixed inset-0 z-[100] flex flex-col justify-end pointer-events-none">
                    <div className="bg-white w-full rounded-t-3xl pb-10 pt-5 px-4 relative z-10 animate-in slide-in-from-bottom-full shadow-[0_-10px_40px_rgba(0,0,0,0.2)] pointer-events-auto">
                        <div className="flex flex-wrap justify-center gap-6 mt-4 px-2">
                            
                            <button onClick={() => { setReplyingTo(activeMenu); setActiveMenu(null); }} className="flex flex-col items-center gap-2 active:scale-95 transition">
                                <div className="w-14 h-14 rounded-full bg-[#2D5AF0]/10 text-[#2D5AF0] flex items-center justify-center">
                                    <svg className="w-6 h-6 transform rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"></path></svg>
                                </div>
                                <span className="text-[11px] font-bold text-brand-dark">תגובה</span>
                            </button>

                            {/* כפתור העתקה חדש */}
                            {activeMenu.content && (
                                <button onClick={() => copyToClipboard(activeMenu.content)} className="flex flex-col items-center gap-2 active:scale-95 transition">
                                    <div className="w-14 h-14 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center">
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                                    </div>
                                    <span className="text-[11px] font-bold text-slate-600">העתקה</span>
                                </button>
                            )}

                            {currentUser?.role === 'admin' && activeMenu.content && (
                                <button onClick={() => convertToTicket(activeMenu)} className="flex flex-col items-center gap-2 active:scale-95 transition">
                                    <div className="w-14 h-14 rounded-full bg-orange-50 text-orange-500 flex items-center justify-center">
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                                    </div>
                                    <span className="text-[11px] font-bold text-orange-500">לתקלה</span>
                                </button>
                            )}

                            {currentUser?.id === activeMenu.user_id && (
                                <>
                                    {activeMenu.content && (
                                        <button onClick={() => { setEditContent(activeMenu.content); setEditingMessage(activeMenu); setActiveMenu(null); }} className="flex flex-col items-center gap-2 active:scale-95 transition">
                                            <div className="w-14 h-14 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center">
                                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                                            </div>
                                            <span className="text-[11px] font-bold text-blue-500">עריכה</span>
                                        </button>
                                    )}
                                    <button onClick={() => deleteMessage(activeMenu.id)} className="flex flex-col items-center gap-2 active:scale-95 transition">
                                        <div className="w-14 h-14 rounded-full bg-red-50 text-red-500 flex items-center justify-center">
                                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                        </div>
                                        <span className="text-[11px] font-bold text-red-500">מחיקה</span>
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* חלון עריכת הודעה */}
            {editingMessage && (
                <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-md rounded-[1.5rem] p-6 shadow-2xl animate-in zoom-in-95 text-right">
                        <h3 className="text-xl font-black text-brand-dark mb-4">עריכת הודעה</h3>
                        <textarea autoFocus value={editContent} onChange={e => setEditContent(e.target.value)} className="w-full bg-gray-50 rounded-2xl p-4 text-sm outline-none resize-none min-h-[100px] mb-4 text-brand-dark border border-gray-100 focus:border-[#1D4ED8]/30 transition" />
                        <div className="flex gap-2">
                            <button onClick={handleSaveEdit} disabled={!editContent.trim() || editContent === editingMessage.content} className="flex-1 bg-[#2D5AF0] text-white font-bold py-3.5 rounded-xl text-sm shadow-md active:scale-95 transition disabled:opacity-50">שמור שינויים</button>
                            <button onClick={() => setEditingMessage(null)} className="px-6 bg-gray-100 text-gray-500 font-bold rounded-xl text-sm active:scale-95 transition">ביטול</button>
                        </div>
                    </div>
                </div>
            )}

            {/* תצוגת תמונה במסך מלא */}
            {fullScreenImage && (
                <div className="fixed inset-0 z-[150] bg-black/95 flex items-center justify-center animate-in fade-in zoom-in-95" onClick={() => setFullScreenImage(null)}>
                    <button onClick={() => setFullScreenImage(null)} className="absolute top-6 right-6 p-2 bg-white/10 rounded-full text-white hover:bg-white/20 transition">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                    <img src={fullScreenImage} className="w-full h-auto max-h-screen object-contain p-4" alt="תמונה מוגדלת" />
                </div>
            )}

            {/* שורת ההקלדה והאימוג'י */}
            <div className="fixed bottom-0 left-0 w-full flex flex-col items-center z-50 pointer-events-none pb-4 pt-2">
                <div className="w-full max-w-md px-4 pointer-events-auto relative">
                    
                    {/* חלונית האימוג'ים */}
                    {showEmoji && (
                        <div className="absolute bottom-[100%] right-0 w-full mb-2 bg-white rounded-3xl shadow-[0_-5px_30px_rgba(0,0,0,0.1)] overflow-hidden border border-gray-100 animate-in fade-in slide-in-from-bottom-2 z-50">
                            <EmojiPicker 
                                onEmojiClick={(emojiData) => setNewMessage(prev => prev + emojiData.emoji)}
                                width="100%"
                                height={350}
                                categories={hebrewCategories as any}
                                searchDisabled
                                skinTonesDisabled
                            />
                        </div>
                    )}

                    {/* חלונית תגובה */}
                    {replyingTo && (
                        <div className="bg-white/95 backdrop-blur-md border-r-4 border-[#2D5AF0] p-2.5 rounded-2xl mb-2 flex justify-between items-center shadow-lg border border-gray-100">
                            <div className="flex flex-col overflow-hidden pl-2">
                                <span className="font-bold text-xs text-[#2D5AF0] mb-0.5">{replyingTo.profiles?.full_name}</span>
                                <span className="text-xs text-brand-dark/70 truncate">{replyingTo.content || 'תמונה'}</span>
                            </div>
                            <button onClick={() => setReplyingTo(null)} className="p-1 text-gray-400">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </div>
                    )}

                    <form onSubmit={handleSend} className="flex items-end gap-1 bg-white p-1 pr-1 rounded-[1.5rem] border border-gray-200 shadow-xl pointer-events-auto">
                        
                        {/* כפתור אימוג'י */}
                        <button type="button" onClick={() => setShowEmoji(!showEmoji)} className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-[#2D5AF0] transition shrink-0 self-end mb-0.5">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        </button>
                        
                        {/* כפתור העלאת קבצים ותמונות */}
                        <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
                        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-[#2D5AF0] transition shrink-0 self-end mb-0.5">
                            {isUploading ? (
                                <div className="w-5 h-5 border-2 border-gray-300 border-t-[#2D5AF0] rounded-full animate-spin"></div>
                            ) : (
                                <svg className="w-6 h-6 transform -rotate-45" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path></svg>
                            )}
                        </button>

                        <textarea 
                            value={newMessage} 
                            onChange={(e) => setNewMessage(e.target.value)} 
                            placeholder="הקלד הודעה..." 
                            className="flex-1 bg-transparent py-3 px-1 outline-none text-sm text-brand-dark resize-none max-h-32 min-h-[44px]" 
                            rows={1}
                            onInput={(e) => {
                                const target = e.target as HTMLTextAreaElement;
                                target.style.height = 'auto';
                                target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }}
                        />

                        <button type="submit" disabled={!newMessage.trim() || isUploading} className="bg-brand-blue text-white w-10 h-10 rounded-full flex items-center justify-center shadow-md disabled:opacity-50 shrink-0 self-end mb-0.5 ml-1 active:scale-95 transition">
                            <svg className="w-4 h-4 transform -rotate-45 translate-x-px" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
                        </button>
                    </form>
                </div>
            </div>
        </div>
    )
}

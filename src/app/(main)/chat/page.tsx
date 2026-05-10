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

    const [customAlert, setCustomAlert] = useState<{ title: string, message: string, type: 'error' | 'success' | 'info' } | null>(null)
    const [readInfoList, setReadInfoList] = useState<any[] | null>(null)

    const bottomRef = useRef<HTMLDivElement>(null)
    const pressTimer = useRef<any>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        let channel: any = null;

        const initChat = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return;
            const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
            if (!prof) return;
            setCurrentUser(prof);

            const fetchMessages = async () => {
                // אבטחת מידע קריטית: שליפה רק של הבניין הנוכחי
                const { data } = await supabase.from('messages')
                    .select('*, profiles(full_name, avatar_url, role)')
                    .eq('building_id', prof.building_id)
                    .order('created_at', { ascending: true })
                if (data) {
                    setMessages(data)
                    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
                }
            }
            await fetchMessages();

            // האזנה יציבה לסקייל גבוה (ממודרת פר בניין)
            channel = supabase.channel(`chat_realtime_${prof.building_id}`)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `building_id=eq.${prof.building_id}` }, fetchMessages)
                .subscribe()
        }
        
        initChat()

        return () => { if (channel) supabase.removeChannel(channel) }
    }, [])

    useEffect(() => {
        const markAsRead = async () => {
            if (!currentUser || messages.length === 0) return;
            const unreadMessages = messages.filter(m => m.user_id !== currentUser.id && (!m.read_by || !m.read_by.includes(currentUser.id)));
            if (unreadMessages.length > 0) {
                const msgsToUpdate = unreadMessages.slice(-15);
                for (const msg of msgsToUpdate) {
                    const newReadBy = [...(msg.read_by || []), currentUser.id];
                    await supabase.from('messages').update({ read_by: newReadBy }).eq('id', msg.id);
                }
            }
        }
        markAsRead()
    }, [messages.length, currentUser])

    const checkConversationActivity = async () => {
        if (!currentUser?.building_id) return true;
        const { data: lastMsg } = await supabase.from('messages')
            .select('created_at')
            .eq('building_id', currentUser.building_id)
            .order('created_at', { ascending: false })
            .limit(1);
        
        if (lastMsg && lastMsg.length > 0) {
            const lastTime = new Date(lastMsg[0].created_at).getTime();
            if (Date.now() - lastTime < 30 * 60 * 1000) {
                return false; 
            }
        }
        return true;
    }

    const sendSmartNotifications = async (content: string, replyToId: string | null, isImage: boolean, isNewConversation: boolean) => {
        const senderName = currentUser.full_name ? currentUser.full_name.split(' ')[0] : 'שכן';
        let repliedUserId = null;

        if (replyToId) {
            const originalMsg = messages.find(m => m.id === replyToId);
            if (originalMsg && originalMsg.user_id !== currentUser.id) {
                repliedUserId = originalMsg.user_id;
            }
        }

        const { data: neighbors } = await supabase.from('profiles').select('id').eq('building_id', currentUser.building_id).neq('id', currentUser.id);
        if (!neighbors || neighbors.length === 0) return;

        const notifsToInsert: any[] = [];

        neighbors.forEach(n => {
            if (n.id === repliedUserId) {
                notifsToInsert.push({
                    receiver_id: n.id,
                    sender_id: currentUser.id,
                    type: 'chat',
                    title: `${senderName} הגיב/ה לך`,
                    content: isImage ? 'נשלחה תמונה בתגובה אליך 📷' : `"${content.length > 35 ? content.substring(0, 35) + '...' : content}"`,
                    link: '/chat'
                });
            } else if (isNewConversation) {
                notifsToInsert.push({
                    receiver_id: n.id,
                    sender_id: currentUser.id,
                    type: 'chat',
                    title: `שיחה חדשה בבניין 💬`,
                    content: `${senderName} שלח/ה הודעה בקבוצת הבניין.`,
                    link: '/chat'
                });
            }
        });

        if (notifsToInsert.length > 0) {
            await supabase.from('notifications').insert(notifsToInsert);
        }
    }

    const handleSend = async (e?: React.FormEvent) => {
        e?.preventDefault()
        if (!newMessage.trim() || !currentUser) return
        playSystemSound('message')

        const contentToSend = newMessage
        const replyIdToSend = replyingTo?.id || null

        const isNewConv = await checkConversationActivity();

        setNewMessage('')
        setShowEmoji(false)
        setReplyingTo(null)
        
        const optimisticMsg = {
            id: 'temp-' + Date.now(),
            user_id: currentUser.id,
            building_id: currentUser.building_id,
            content: contentToSend,
            reply_to_id: replyIdToSend,
            read_by: [],
            created_at: new Date().toISOString(),
            profiles: currentUser
        }
        
        setMessages(prev => [...prev, optimisticMsg])
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)

        const { error } = await supabase.from('messages').insert([{
            user_id: currentUser.id,
            building_id: currentUser.building_id,
            content: contentToSend,
            reply_to_id: replyIdToSend,
            read_by: []
        }])

        if (error) {
            setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id))
            setCustomAlert({ title: 'שגיאת שרת', message: error.message, type: 'error' })
            return
        }

        await sendSmartNotifications(contentToSend, replyIdToSend, false, isNewConv);
    }

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file || !currentUser) return
        
        setIsUploading(true)
        playSystemSound('click')
        setShowEmoji(false)

        const isNewConv = await checkConversationActivity();

        const tempUrl = URL.createObjectURL(file)
        const optimisticMsg = {
            id: 'temp-img-' + Date.now(),
            user_id: currentUser.id,
            building_id: currentUser.building_id,
            content: '',
            image_url: tempUrl,
            reply_to_id: replyingTo?.id || null,
            read_by: [],
            created_at: new Date().toISOString(),
            profiles: currentUser
        }
        setMessages(prev => [...prev, optimisticMsg])
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)

        const fileExt = file.name.split('.').pop()
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`
        const filePath = `chat/${fileName}`

        const { error: uploadError } = await supabase.storage.from('chat_uploads').upload(filePath, file)
        
        if (!uploadError) {
            const { data } = supabase.storage.from('chat_uploads').getPublicUrl(filePath)
            
            const { error: msgError } = await supabase.from('messages').insert([{
                user_id: currentUser.id,
                building_id: currentUser.building_id,
                content: '',
                image_url: data.publicUrl,
                reply_to_id: replyingTo?.id || null,
                read_by: []
            }])

            if (!msgError) {
                await sendSmartNotifications('', replyingTo?.id || null, true, isNewConv);
            }
            playSystemSound('notification')
        } else {
            setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id))
            setCustomAlert({ title: 'שגיאה בהעלאה', message: uploadError.message, type: 'error' })
        }
        
        setIsUploading(false)
        setReplyingTo(null)
        if(fileInputRef.current) fileInputRef.current.value = ''
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

    const showReadInfo = async (msg: any) => {
        setActiveMenu(null)
        if (!msg.read_by || msg.read_by.length === 0) {
            setCustomAlert({ title: 'צפיות בהודעה', message: 'אף שכן עדיין לא נכנס לקרוא את ההודעה.', type: 'info' })
            return
        }
        
        const { data } = await supabase.from('profiles').select('full_name, avatar_url').in('id', msg.read_by)
        if (data) setReadInfoList(data)
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

    const timeFormat = (dateString: string) => {
        return new Date(dateString).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
    }

    return (
        <div className="flex flex-col flex-1 w-full relative min-h-[100dvh]" dir="rtl">
            <div className="fixed inset-0 bg-[#F0F2F5] -z-10" />

            {activeMenu && <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={() => setActiveMenu(null)} />}
            {showEmoji && <div className="fixed inset-0 z-40" onClick={() => setShowEmoji(false)} />}

            <div className="flex-1 space-y-4 pb-32 pt-4 px-3 overflow-y-auto">
                {messages.map((msg) => {
                    const isMe = currentUser?.id === msg.user_id
                    const isActive = activeMenu?.id === msg.id
                    const hasBeenRead = msg.read_by && msg.read_by.length > 0;

                    return (
                        <div key={msg.id} className={`flex gap-2 relative ${isMe ? 'flex-row-reverse' : ''} ${isActive ? 'z-[60]' : 'z-10'}`}>
                            {!isMe && <img src={msg.profiles?.avatar_url || `https://api.dicebear.com/8.x/initials/svg?seed=${msg.profiles?.full_name}`} className="w-8 h-8 rounded-full border border-white self-end shrink-0 shadow-sm object-cover" />}
                            
                            <div
                                className={`max-w-[78%] min-w-[100px] flex flex-col items-start ${isMe ? 'items-end' : ''} cursor-pointer select-none [-webkit-touch-callout:none] [-webkit-user-select:none]`}
                                onContextMenu={(e) => e.preventDefault()}
                                onTouchStart={() => handlePressStart(msg)}
                                onTouchEnd={handlePressEnd}
                                onTouchMove={handlePressEnd}
                            >
                                {msg.reply_to_id && getRepliedMsg(msg.reply_to_id) && (
                                    <div className={`w-full rounded-xl px-2.5 py-1.5 mb-1 border-r-4 text-[11px] text-left shadow-sm ${isMe ? 'bg-black/25 border-white/60 text-white' : 'bg-gray-50 border-[#10B981] text-slate-600'}`} dir="rtl">
                                        <span className={`font-black block mb-0.5 ${isMe ? 'text-white' : 'text-[#10B981]'}`}>{getRepliedMsg(msg.reply_to_id).profiles?.full_name || 'שכן'}</span>
                                        <span className={`line-clamp-1 ${isMe ? 'text-white/90' : 'text-slate-500'}`}>{getRepliedMsg(msg.reply_to_id).content || 'תמונה'}</span>
                                    </div>
                                )}

                                <div className={`p-2.5 text-sm shadow-sm relative z-0 transition-transform ${isMe ? 'bg-gradient-to-tr from-[#10B981] to-emerald-400 text-white rounded-[1.2rem] rounded-br-sm shadow-[0_4px_15px_rgba(16,185,129,0.15)]' : 'bg-white text-slate-800 rounded-[1.2rem] border border-slate-100 rounded-bl-sm shadow-[0_2px_10px_rgba(0,0,0,0.02)]'}`}>
                                    {!isMe && <p className="font-bold text-[10px] text-[#10B981] mb-1 px-1.5 pt-0.5">{msg.profiles?.full_name}</p>}
                                    
                                    {msg.image_url && (
                                        <div className="mt-1 mb-1 rounded-xl overflow-hidden cursor-pointer bg-black/5" onClick={(e) => { e.stopPropagation(); setFullScreenImage(msg.image_url) }}>
                                            <img src={msg.image_url} alt="Uploaded content" className="max-w-[200px] max-h-[250px] object-cover rounded-xl" />
                                        </div>
                                    )}
                                    
                                    {msg.content && <p className="leading-relaxed whitespace-pre-wrap px-1.5 pb-0.5 pt-0.5 pointer-events-none">{msg.content}</p>}

                                    <div className="flex items-center justify-end gap-1 mt-1 mr-1" dir="ltr">
                                        {isMe && (
                                            <svg className={`w-3.5 h-3.5 ${hasBeenRead ? 'text-[#38BDF8] drop-shadow-sm' : 'text-emerald-100'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M18 6L7 17l-5-5"></path>
                                                {hasBeenRead && <path d="M22 10l-7.5 7.5L13 16"></path>}
                                            </svg>
                                        )}
                                        <span className={`text-[9px] font-bold ${isMe ? 'text-emerald-50' : 'text-slate-400'}`}>{timeFormat(msg.created_at)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                })}
                <div ref={bottomRef} />
            </div>

            {activeMenu && (
                <div className="fixed inset-0 z-[100] flex flex-col justify-end pointer-events-none">
                    <div className="bg-white w-full rounded-t-[2rem] pb-12 pt-6 px-6 relative z-10 animate-in slide-in-from-bottom-full shadow-[0_-10px_40px_rgba(0,0,0,0.2)] pointer-events-auto border-t border-slate-100">
                        <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6"></div>
                        
                        <div className="flex flex-col overflow-hidden bg-white rounded-2xl border border-slate-100 shadow-sm">
                            
                            <button onClick={() => { setReplyingTo(activeMenu); setActiveMenu(null); }} className="w-full text-right px-5 h-14 text-base font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-3">
                                <svg className="w-5 h-5 text-slate-400 transform rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"></path></svg>
                                הגב להודעה
                            </button>

                            {activeMenu.content && (
                                <button onClick={() => copyToClipboard(activeMenu.content)} className="w-full text-right px-5 h-14 text-base font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-3 border-t border-slate-50">
                                    <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                                    העתק טקסט
                                </button>
                            )}

                            {currentUser?.role === 'admin' && activeMenu.content && (
                                <button onClick={() => convertToTicket(activeMenu)} className="w-full text-right px-5 h-14 text-base font-bold text-orange-500 hover:bg-orange-50 flex items-center gap-3 border-t border-slate-50">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77-1.333.192 3 1.732 3z"></path></svg>
                                    פתח כתקלת שירות
                                </button>
                            )}

                            {currentUser?.id === activeMenu.user_id && (
                                <>
                                    <button onClick={() => showReadInfo(activeMenu)} className="w-full text-right px-5 h-14 text-base font-bold text-blue-500 hover:bg-blue-50 flex items-center gap-3 border-t border-slate-50">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                                        מי קרא?
                                    </button>

                                    {activeMenu.content && (
                                        <button onClick={() => { setEditContent(activeMenu.content); setEditingMessage(activeMenu); setActiveMenu(null); }} className="w-full text-right px-5 h-14 text-base font-bold text-[#10B981] hover:bg-emerald-50 flex items-center gap-3 border-t border-slate-50">
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                                            עריכת הודעה
                                        </button>
                                    )}
                                    <button onClick={() => deleteMessage(activeMenu.id)} className="w-full text-right px-5 h-14 text-base font-bold text-red-500 hover:bg-red-50 flex items-center gap-3 border-t border-slate-50">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                        מחיקת הודעה
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {readInfoList && (
                <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-end justify-center">
                    <div className="bg-white w-full max-w-md rounded-t-[2rem] p-6 pb-12 shadow-2xl animate-in slide-in-from-bottom-full max-h-[70vh] flex flex-col">
                        <div className="flex justify-between items-center mb-6 shrink-0">
                            <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                                <span className="text-[#38BDF8]">✓✓</span> צפיות בהודעה
                            </h3>
                            <button onClick={() => setReadInfoList(null)} className="w-12 h-12 flex items-center justify-center bg-gray-50 rounded-full text-slate-500 hover:text-slate-800 transition active:scale-95">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </div>
                        
                        <div className="overflow-y-auto hide-scrollbar space-y-3 pr-2">
                            {readInfoList.map((reader, idx) => (
                                <div key={idx} className="flex items-center gap-3 bg-slate-50 border border-slate-100 p-3 rounded-2xl">
                                    <img src={reader.avatar_url || `https://api.dicebear.com/8.x/initials/svg?seed=${reader.full_name}`} className="w-10 h-10 rounded-full border border-white shadow-sm" />
                                    <span className="font-bold text-slate-700">{reader.full_name}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {editingMessage && (
                <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-md rounded-[1.5rem] p-6 shadow-2xl animate-in zoom-in-95 text-right">
                        <h3 className="text-xl font-black text-slate-800 mb-4">עריכת הודעה</h3>
                        <textarea autoFocus value={editContent} onChange={e => setEditContent(e.target.value)} className="w-full bg-slate-50 rounded-2xl p-4 text-sm outline-none resize-none min-h-[100px] mb-4 text-slate-800 border border-slate-100 focus:border-[#10B981] transition" />
                        <div className="flex gap-3">
                            <button onClick={() => setEditingMessage(null)} className="h-12 px-6 flex items-center justify-center bg-slate-100 text-slate-500 font-bold rounded-xl text-sm active:scale-95 transition">ביטול</button>
                            <button onClick={handleSaveEdit} disabled={!editContent.trim() || editContent === editingMessage.content} className="flex-1 h-12 flex items-center justify-center bg-[#10B981] text-white font-bold rounded-xl text-sm shadow-md active:scale-95 transition disabled:opacity-50">שמור שינויים</button>
                        </div>
                    </div>
                </div>
            )}

            {customAlert && (
                <div className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm flex justify-center items-center p-4">
                    <div className="bg-white/95 backdrop-blur-xl rounded-[2rem] p-6 w-full max-w-sm shadow-2xl text-center animate-in zoom-in-95 border border-white/50">
                        <div className={`w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center shadow-lg ${customAlert.type === 'success' ? 'bg-[#10B981]/10 text-[#10B981] animate-[bounce_1s_infinite]' : customAlert.type === 'info' ? 'bg-blue-50 text-blue-500' : 'bg-red-50 text-red-500'}`}>
                            {customAlert.type === 'success' && <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>}
                            {customAlert.type === 'error' && <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>}
                            {customAlert.type === 'info' && <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>}
                        </div>
                        <h3 className="text-2xl font-black text-slate-800 mb-2">{customAlert.title}</h3>
                        <p className="text-base text-slate-500 mb-6 leading-relaxed font-medium">{customAlert.message}</p>
                        <button onClick={() => setCustomAlert(null)} className="w-full h-14 flex items-center justify-center bg-slate-800 text-white font-bold rounded-xl active:scale-95 transition shadow-sm text-lg">סגירה</button>
                    </div>
                </div>
            )}

            {fullScreenImage && (
                <div className="fixed inset-0 z-[150] bg-black/95 flex items-center justify-center animate-in fade-in zoom-in-95" onClick={() => setFullScreenImage(null)}>
                    <button onClick={() => setFullScreenImage(null)} className="absolute top-6 right-6 w-12 h-12 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full text-white transition active:scale-95">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                    <img src={fullScreenImage} className="w-full h-auto max-h-screen object-contain p-4" alt="תמונה מוגדלת" />
                </div>
            )}

            <div className="fixed bottom-0 left-0 w-full flex flex-col items-center z-50 pointer-events-none pb-4 pt-2">
                <div className="w-full max-w-md px-4 pointer-events-auto relative">
                    
                    {showEmoji && (
                        <div className="absolute bottom-[100%] right-0 w-full mb-2 bg-white rounded-3xl shadow-[0_-5px_30px_rgba(0,0,0,0.1)] overflow-hidden border border-slate-100 animate-in fade-in slide-in-from-bottom-2 z-50">
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

                    {replyingTo && (
                        <div className="bg-white/95 backdrop-blur-md border-r-4 border-[#10B981] p-2.5 rounded-2xl mb-2 flex justify-between items-center shadow-lg border border-slate-100">
                            <div className="flex flex-col overflow-hidden pl-2">
                                <span className="font-bold text-xs text-[#10B981] mb-0.5">{replyingTo.profiles?.full_name}</span>
                                <span className="text-xs text-slate-600 truncate">{replyingTo.content || 'תמונה'}</span>
                            </div>
                            <button onClick={() => setReplyingTo(null)} className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-600 transition active:scale-95">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </div>
                    )}

                    <form onSubmit={handleSend} className="flex items-end gap-1 bg-white p-1.5 pr-1.5 rounded-[1.5rem] border border-slate-200 shadow-xl pointer-events-auto">
                        
                        <button type="button" onClick={() => setShowEmoji(!showEmoji)} className="w-12 h-12 flex items-center justify-center text-slate-400 hover:text-[#10B981] transition shrink-0 self-end">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        </button>
                        
                        <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
                        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="w-12 h-12 flex items-center justify-center text-slate-400 hover:text-[#10B981] transition shrink-0 self-end">
                            {isUploading ? (
                                <div className="w-5 h-5 border-2 border-slate-200 border-t-[#10B981] rounded-full animate-spin"></div>
                            ) : (
                                <svg className="w-6 h-6 transform -rotate-45" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path></svg>
                            )}
                        </button>

                        <textarea 
                            value={newMessage} 
                            onChange={(e) => setNewMessage(e.target.value)} 
                            placeholder="הקלד הודעה..." 
                            className="flex-1 bg-transparent py-3.5 px-2 outline-none text-base font-medium text-slate-800 resize-none max-h-32 min-h-[48px]" 
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

                        <button type="submit" disabled={!newMessage.trim() || isUploading} className="bg-[#10B981] text-white w-12 h-12 rounded-full flex items-center justify-center shadow-md disabled:opacity-50 shrink-0 self-end ml-1 active:scale-95 transition">
                            <svg className="w-5 h-5 transform -rotate-45 translate-x-px" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
                        </button>
                    </form>
                </div>
            </div>
        </div>
    )
}

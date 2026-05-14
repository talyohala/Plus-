'use client'
import { useEffect, useState, useRef, useMemo } from 'react'
import useSWR from 'swr'
import { supabase } from '../../../lib/supabase'
import EmojiPicker from 'emoji-picker-react'
import { playSystemSound } from '../../../components/providers/AppManager'
import AnimatedSheet from '../../../components/ui/AnimatedSheet'
import { EditIcon, DeleteIcon } from '../../../components/ui/ActionIcons'

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
];

const fetcher = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Unauthorized');

  const { data: prof } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
  if (!prof) throw new Error('Profile missing');

  const [msgsRes, aiReqsRes] = await Promise.all([
    supabase.from('messages').select('*, profiles(full_name, avatar_url, role)').eq('building_id', prof.building_id).order('created_at', { ascending: true }),
    supabase.from('ai_smart_requests').select('*').eq('building_id', prof.building_id)
  ]);

  const reqsMap: any = {};
  if (aiReqsRes.data) aiReqsRes.data.forEach(r => reqsMap[r.id] = r);

  return { currentUser: prof, messages: msgsRes.data || [], aiRequests: reqsMap };
};

export default function ChatPage() {
  const { data, error, mutate } = useSWR('/api/chat/fetch', fetcher, { revalidateOnFocus: true });
  
  const currentUser = data?.currentUser;
  const messages = data?.messages || [];
  const aiRequests = data?.aiRequests || {};

  const [newMessage, setNewMessage] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [activeMenu, setActiveMenu] = useState<any | null>(null);
  const [replyingTo, setReplyingTo] = useState<any | null>(null);
  const [editingMessage, setEditingMessage] = useState<any | null>(null);
  const [editContent, setEditContent] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  const [customAlert, setCustomAlert] = useState<{ title: string, message: string, type: 'error' | 'success' | 'info' } | null>(null);
  const [readInfoList, setReadInfoList] = useState<any[] | null>(null);

  const [aiSummary, setAiSummary] = useState<string>('קורא את הודעות הבניין...');
  const [showAiBubble, setShowAiBubble] = useState(false);
  const lastSummaryCountRef = useRef<number>(0);

  const bottomRef = useRef<HTMLDivElement>(null);
  const pressTimer = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Realtime Subscription ---
  useEffect(() => {
    if (!currentUser?.building_id) return;
    const channel = supabase.channel(`chat_${currentUser.building_id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `building_id=eq.${currentUser.building_id}` }, () => mutate())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ai_smart_requests', filter: `building_id=eq.${currentUser.building_id}` }, () => mutate())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentUser?.building_id, mutate]);

  // --- Scroll to Bottom ---
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }, [messages.length]);

  // --- Mark as Read ---
  useEffect(() => {
    const markAsRead = async () => {
      if (!currentUser || messages.length === 0) return;
      const unreadMessages = messages.filter(m => m.user_id !== currentUser.id && (!m.read_by || !m.read_by.includes(currentUser.id)));
      if (unreadMessages.length > 0) {
        const msgsToUpdate = unreadMessages.slice(-15);
        for (const msg of msgsToUpdate) {
          await supabase.from('messages').update({ read_by: [...(msg.read_by || []), currentUser.id] }).eq('id', msg.id);
        }
        mutate();
      }
    };
    markAsRead();
  }, [messages.length, currentUser, mutate]);

  // --- AI Summary Trigger ---
  useEffect(() => {
    if (messages.length === 0 || lastSummaryCountRef.current === messages.length) return;
    lastSummaryCountRef.current = messages.length;

    const triggerAiAnalysis = async () => {
      const contextMsgs = messages.slice(-8).map(m => `${m.profiles?.full_name || 'שכן'}: ${m.content?.replace(/\[AI_REQ:.+?\]/, '') || 'תמונה'}`).join('\n');
      try {
        const res = await fetch('/api/ai/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ description: `אלו ההודעות האחרונות בצ'אט הבניין:\n${contextMsgs}\n\nנסח משפט סיכום קצר ואלגנטי של שורה אחת. מקסימום אימוג'י 1.`, mode: 'insight' })
        });
        const aiData = await res.json();
        setAiSummary(aiData.text || "מדברים על ענייני השעה בבניין ✨");
      } catch (e) {
        setAiSummary("הצ'אט פעיל ומתעדכן ✨");
      } finally {
        setShowAiBubble(true);
        setTimeout(() => setShowAiBubble(false), 15000);
      }
    };
    triggerAiAnalysis();
  }, [messages]);

  const checkConversationActivity = async () => {
    if (!currentUser?.building_id || messages.length === 0) return true;
    const lastTime = new Date(messages[messages.length - 1].created_at).getTime();
    return (Date.now() - lastTime > 30 * 60 * 1000); // More than 30 mins -> new conversation
  };

  const sendSmartNotifications = async (content: string, replyToId: string | null, isImage: boolean, isNewConversation: boolean) => {
    const senderName = currentUser.full_name ? currentUser.full_name.split(' ')[0] : 'שכן';
    let repliedUserId = replyToId ? messages.find(m => m.id === replyToId)?.user_id : null;

    const { data: neighbors } = await supabase.from('profiles').select('id').eq('building_id', currentUser.building_id).neq('id', currentUser.id);
    if (!neighbors) return;

    const notifsToInsert: any[] = [];
    neighbors.forEach(n => {
      if (n.id === repliedUserId) {
        notifsToInsert.push({ receiver_id: n.id, sender_id: currentUser.id, type: 'chat', title: `${senderName} הגיב/ה לך`, content: isImage ? 'נשלחה תמונה בתגובה אליך 📷' : `"${content.substring(0, 35)}..."`, link: '/chat' });
      } else if (isNewConversation) {
        notifsToInsert.push({ receiver_id: n.id, sender_id: currentUser.id, type: 'chat', title: `שיחה חדשה בבניין 💬`, content: `${senderName} שלח/ה הודעה.`, link: '/chat' });
      }
    });

    if (notifsToInsert.length > 0) await supabase.from('notifications').insert(notifsToInsert);
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!newMessage.trim() || !currentUser) return;
    playSystemSound('message');

    const contentToSend = newMessage;
    const replyIdToSend = replyingTo?.id || null;
    const isNewConv = await checkConversationActivity();

    setNewMessage(''); setShowEmoji(false); setReplyingTo(null);

    const { error } = await supabase.from('messages').insert([{ user_id: currentUser.id, building_id: currentUser.building_id, content: contentToSend, reply_to_id: replyIdToSend, read_by: [] }]);
    if (error) setCustomAlert({ title: 'שגיאת שרת', message: error.message, type: 'error' });
    else await sendSmartNotifications(contentToSend, replyIdToSend, false, isNewConv);
    mutate();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file || !currentUser) return;
    setIsUploading(true); playSystemSound('click'); setShowEmoji(false);

    const isNewConv = await checkConversationActivity();
    const fileExt = file.name.split('.').pop();
    const filePath = `chat/${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;

    const { error: uploadError } = await supabase.storage.from('chat_uploads').upload(filePath, file);
    if (!uploadError) {
      const { data } = supabase.storage.from('chat_uploads').getPublicUrl(filePath);
      const { error: msgError } = await supabase.from('messages').insert([{ user_id: currentUser.id, building_id: currentUser.building_id, content: '', image_url: data.publicUrl, reply_to_id: replyingTo?.id || null, read_by: [] }]);
      if (!msgError) await sendSmartNotifications('', replyingTo?.id || null, true, isNewConv);
      playSystemSound('notification'); mutate();
    } else {
      setCustomAlert({ title: 'שגיאה בהעלאה', message: uploadError.message, type: 'error' });
    }

    setIsUploading(false); setReplyingTo(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSaveEdit = async () => {
    if (!editingMessage || !editContent.trim()) return;
    await supabase.from('messages').update({ content: editContent }).eq('id', editingMessage.id);
    playSystemSound('notification'); setEditingMessage(null); mutate();
  };

  const deleteMessage = async (msgId: string) => {
    setActiveMenu(null);
    await supabase.from('messages').delete().eq('id', msgId);
    playSystemSound('click'); mutate();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text); playSystemSound('click'); setActiveMenu(null);
  };

  const convertToTicket = async (msg: any) => {
    if (!currentUser || currentUser.role !== 'admin') return;
    setActiveMenu(null);

    const { error } = await supabase.from('service_tickets').insert([{ building_id: currentUser.building_id, user_id: msg.user_id, title: 'נפתח אוטומטית מתוך הצ\'אט', description: msg.content?.replace(/\[AI_REQ:.+?\]/, '').trim(), source: 'app', status: 'פתוח' }]);
    if (!error) {
      await supabase.from('messages').insert([{ user_id: currentUser.id, building_id: currentUser.building_id, content: `✅ היי, פתחתי קריאת שירות מסודרת בלוח התקלות של הבניין בעקבות ההודעה שלך. נושא בטיפול.`, reply_to_id: msg.id }]);
      playSystemSound('notification'); mutate();
    }
  };

  const showReadInfo = async (msg: any) => {
    setActiveMenu(null);
    if (!msg.read_by || msg.read_by.length === 0) {
      setCustomAlert({ title: 'צפיות בהודעה', message: 'אף שכן עדיין לא נכנס לקרוא את ההודעה.', type: 'info' }); return;
    }
    const { data } = await supabase.from('profiles').select('full_name, avatar_url').in('id', msg.read_by);
    if (data) setReadInfoList(data);
  };

  const handleOfferParking = async (reqId: string, msgId: string, requesterId: string) => {
    if (!currentUser) return;
    playSystemSound('click');
    await supabase.from('ai_smart_requests').update({ status: 'matched', matched_by: currentUser.id, matched_name: currentUser.full_name }).eq('id', reqId);
    await supabase.from('notifications').insert([{ receiver_id: requesterId, sender_id: currentUser.id, type: 'system', title: 'מצאנו לך חניה! 🎉', content: `${currentUser.full_name} הציע חניה בעקבות הבקשה שלך.`, link: '/chat' }]);
    await supabase.from('messages').insert([{ user_id: currentUser.id, building_id: currentUser.building_id, content: `באהבה! מוזמן/ת להשתמש בחניה שלי היום. 🚙`, reply_to_id: msgId, read_by: [] }]);
    setCustomAlert({ title: 'איזה אלוף!', message: 'הודענו לשכן שהחניה שלך פנויה עבורו.', type: 'success' }); mutate();
  };

  const handleCancelParkingOffer = async (reqId: string, requesterId: string) => {
    if (!currentUser) return;
    playSystemSound('click');
    await supabase.from('ai_smart_requests').update({ status: 'searching', matched_by: null, matched_name: null }).eq('id', reqId);
    await supabase.from('notifications').insert([{ receiver_id: requesterId, sender_id: currentUser.id, type: 'system', title: 'עדכון סטטוס חניה 🔄', content: `${currentUser.full_name} ביטל את הצעת החניה. הבקשה שלך חזרה להיות פעילה!`, link: '/' }]);
    setCustomAlert({ title: 'ביטול בוצע', message: 'הצעת החניה בוטלה והשכן עודכן.', type: 'info' }); mutate();
  };

  const handlePressStart = (msg: any) => { pressTimer.current = setTimeout(() => { setActiveMenu(msg); setShowEmoji(false); if (navigator.vibrate) navigator.vibrate(50); }, 400); };
  const handlePressEnd = () => { if (pressTimer.current) clearTimeout(pressTimer.current); };

  if (!data && !error) return <div className="flex flex-col flex-1 w-full items-center justify-center min-h-[100dvh] bg-transparent"><div className="w-12 h-12 border-4 border-[#1D4ED8]/30 border-t-[#1D4ED8] rounded-full animate-spin"></div></div>;

  return (
    <div className="flex flex-col flex-1 w-full relative min-h-[100dvh]" dir="rtl">
      <div className="fixed inset-0 bg-[#F8FAFC] -z-10" />
      {showEmoji && <div className="fixed inset-0 z-40" onClick={() => setShowEmoji(false)} />}

      <div className="flex-1 space-y-4 pb-40 pt-4 px-3 overflow-y-auto hide-scrollbar">
        {messages.map((msg) => {
          const isMe = currentUser?.id === msg.user_id;
          const isActive = activeMenu?.id === msg.id;
          const hasBeenRead = msg.read_by && msg.read_by.length > 0;
          const repliedMsg = msg.reply_to_id ? messages.find(m => m.id === msg.reply_to_id) : null;

          const aiMatch = msg.content?.match(/\[AI_REQ:(.+?)\]/);
          const reqId = aiMatch ? aiMatch[1] : null;
          const cleanContent = msg.content ? msg.content.replace(/\[AI_REQ:.+?\]/, '').trim() : '';
          const repliedCleanContent = repliedMsg?.content ? repliedMsg.content.replace(/\[AI_REQ:.+?\]/, '').trim() : 'תמונה';

          return (
            <div key={msg.id} className={`flex gap-2 relative ${isMe ? 'flex-row-reverse' : ''} ${isActive ? 'z-[60]' : 'z-10'}`}>
              {!isMe && (
                <img src={msg.profiles?.avatar_url || `https://api.dicebear.com/8.x/initials/svg?seed=${msg.profiles?.full_name}`} className="w-8 h-8 rounded-full border border-white self-end shrink-0 shadow-sm object-cover" alt="avatar" />
              )}

              <div
                className={`max-w-[85%] min-w-[100px] flex flex-col items-start ${isMe ? 'items-end' : ''} cursor-pointer select-none [-webkit-touch-callout:none]`}
                onContextMenu={(e) => e.preventDefault()}
                onTouchStart={() => handlePressStart(msg)}
                onTouchEnd={handlePressEnd}
                onTouchMove={handlePressEnd}
              >
                <div className={`w-full text-xs tracking-tight leading-relaxed shadow-sm relative z-0 transition-transform ${isMe ? 'bg-[#1D4ED8] text-white rounded-[1.2rem] rounded-br-sm' : 'bg-white text-slate-800 rounded-[1.2rem] border border-slate-100 rounded-bl-sm'}`}>
                  
                  {repliedMsg && (
                    <div className={`p-2 rounded-t-[1.1rem] mb-1 text-right ${isMe ? 'bg-black/10 text-white' : 'bg-[#1D4ED8]/5 text-slate-600'}`}>
                      <span className={`font-black text-[10px] block mb-0.5 ${isMe ? 'text-blue-100' : 'text-[#1D4ED8]'}`}>{repliedMsg.profiles?.full_name || 'שכן'}</span>
                      <span className="line-clamp-1 text-[11px] font-medium opacity-90">{repliedCleanContent}</span>
                    </div>
                  )}

                  <div className="p-2.5 pt-1">
                    {!isMe && <p className="font-bold text-[10px] text-[#1D4ED8] mb-1 px-0.5 text-right">{msg.profiles?.full_name}</p>}

                    {msg.image_url && (
                      <div className="mt-1 mb-1 rounded-xl overflow-hidden cursor-pointer bg-black/5" onClick={(e) => { e.stopPropagation(); setFullScreenImage(msg.image_url!); }}>
                        <img src={msg.image_url} alt="Uploaded" className="max-w-[200px] max-h-[250px] object-cover rounded-xl" />
                      </div>
                    )}

                    {msg.content && <p className="whitespace-pre-wrap px-0.5 pb-0.5 pt-0.5 pointer-events-none font-medium text-right">{cleanContent}</p>}

                    {reqId && !isMe && (
                      <div className="mt-2 pointer-events-auto">
                        {aiRequests[reqId]?.status === 'matched' ? (
                          aiRequests[reqId]?.matched_by === currentUser.id ? (
                            <button onClick={(e) => { e.stopPropagation(); handleCancelParkingOffer(reqId, msg.user_id); }} className="w-full bg-slate-100 text-slate-600 font-black py-2.5 px-3 rounded-xl text-[11px] active:scale-95 transition shadow-sm border border-slate-200">ביטול הצעת חניה ❌</button>
                          ) : (
                            <button disabled className="w-full bg-slate-50 text-slate-400 font-black py-2.5 px-3 rounded-xl text-[11px] border border-slate-100 opacity-80 cursor-not-allowed">חניה נתפסה ע"י {aiRequests[reqId]?.matched_name} 🚙</button>
                          )
                        ) : (
                          <button onClick={(e) => { e.stopPropagation(); handleOfferParking(reqId, msg.id, msg.user_id); }} className="w-full bg-emerald-50 text-emerald-700 font-black py-2.5 px-3 rounded-xl text-[11px] active:scale-95 transition shadow-sm border border-emerald-200/60"><span className="text-sm">🚙</span> יש לי חניה פנויה בשבילך</button>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-1 mt-1" dir="ltr">
                      {isMe && (
                        <svg className={`w-3.5 h-3.5 ${hasBeenRead ? 'text-[#38BDF8] drop-shadow-sm' : 'text-blue-200'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L7 17l-5-5"></path>{hasBeenRead && <path d="M22 10l-7.5 7.5L13 16"></path>}</svg>
                      )}
                      <span className={`text-[9px] font-bold ${isMe ? 'text-blue-100' : 'text-slate-400'}`}>{new Date(msg.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* --- Unified Animated Sheets --- */}
      <AnimatedSheet isOpen={!!activeMenu} onClose={() => setActiveMenu(null)}>
        <button onClick={() => { setReplyingTo(activeMenu); setActiveMenu(null); }} className="w-full text-right px-5 h-14 text-sm font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-3">
          <svg className="w-5 h-5 text-[#1D4ED8] transform rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"></path></svg>
          הגב להודעה
        </button>
        {activeMenu?.content && (
          <button onClick={() => copyToClipboard(activeMenu.content.replace(/\[AI_REQ:.+?\]/, '').trim())} className="w-full text-right px-5 h-14 text-sm font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-3 border-t border-slate-50">
            <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
            העתק טקסט
          </button>
        )}
        {currentUser?.role === 'admin' && activeMenu?.content && (
          <button onClick={() => convertToTicket(activeMenu)} className="w-full text-right px-5 h-14 text-sm font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-3 border-t border-slate-50">
            <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77-1.333.192 3 1.732 3z"></path></svg>
            פתח כתקלת שירות
          </button>
        )}
        {currentUser?.id === activeMenu?.user_id && (
          <>
            <button onClick={() => showReadInfo(activeMenu)} className="w-full text-right px-5 h-14 text-sm font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-3 border-t border-slate-50">
              <svg className="w-5 h-5 text-[#38BDF8]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
              מי קרא?
            </button>
            {activeMenu.content && (
              <button onClick={() => { setEditContent(activeMenu.content.replace(/\[AI_REQ:.+?\]/, '').trim()); setEditingMessage(activeMenu); setActiveMenu(null); }} className="w-full text-right px-5 h-14 text-sm font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-3 border-t border-slate-50">
                <EditIcon className="w-5 h-5 text-[#1D4ED8]" />
                עריכת הודעה
              </button>
            )}
            <button onClick={() => deleteMessage(activeMenu.id)} className="w-full text-right px-5 h-14 text-sm font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-3 border-t border-slate-50">
              <DeleteIcon className="w-5 h-5 text-red-500" />
              מחיקת הודעה
            </button>
          </>
        )}
      </AnimatedSheet>

      <AnimatedSheet isOpen={!!readInfoList} onClose={() => setReadInfoList(null)}>
        <div className="flex justify-between items-center mb-6 shrink-0">
          <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
            <span className="text-[#38BDF8]">✓✓</span> צפיות בהודעה
          </h3>
        </div>
        <div className="overflow-y-auto hide-scrollbar space-y-3 pr-2 max-h-[50vh]">
          {readInfoList?.map((reader, idx) => (
            <div key={idx} className="flex items-center gap-3 bg-slate-50 border border-slate-100 p-3 rounded-2xl">
              <img src={reader.avatar_url || `https://api.dicebear.com/8.x/initials/svg?seed=${reader.full_name}`} className="w-10 h-10 rounded-full border border-white shadow-sm object-cover" alt="reader" />
              <span className="font-bold text-slate-700 text-sm">{reader.full_name}</span>
            </div>
          ))}
        </div>
      </AnimatedSheet>

      <AnimatedSheet isOpen={!!editingMessage} onClose={() => setEditingMessage(null)}>
        <h3 className="text-xl font-black text-slate-800 mb-4">עריכת הודעה</h3>
        <textarea autoFocus value={editContent} onChange={e => setEditContent(e.target.value)} className="w-full bg-slate-50 rounded-2xl p-4 text-sm font-medium outline-none resize-none min-h-[100px] mb-4 text-slate-800 border border-slate-100 focus:border-[#1D4ED8] transition tracking-tight" />
        <button onClick={handleSaveEdit} disabled={!editContent.trim() || editContent === editingMessage?.content} className="w-full h-14 flex items-center justify-center bg-[#1D4ED8] text-white font-bold rounded-xl text-lg shadow-md active:scale-95 transition disabled:opacity-50">שמירה</button>
      </AnimatedSheet>

      {/* Utilities */}
      {customAlert && (
        <div className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-white/95 backdrop-blur-xl rounded-[2rem] p-6 w-full max-w-sm shadow-2xl text-center animate-in zoom-in-95 border border-white/50">
            <h3 className="text-2xl font-black text-slate-800 mb-2">{customAlert.title}</h3>
            <p className="text-base text-slate-500 mb-6 font-medium">{customAlert.message}</p>
            <button onClick={() => setCustomAlert(null)} className="w-full h-14 bg-[#1E293B] text-white font-bold rounded-xl active:scale-95 transition text-lg">סגירה</button>
          </div>
        </div>
      )}

      {fullScreenImage && (
        <div className="fixed inset-0 z-[150] bg-black/95 flex items-center justify-center animate-in fade-in zoom-in-95" onClick={() => setFullScreenImage(null)}>
          <img src={fullScreenImage} className="w-full h-auto max-h-screen object-contain p-4" alt="תמונה מוגדלת" />
        </div>
      )}

      <div className="fixed bottom-0 left-0 w-full flex flex-col items-center z-50 pointer-events-none pb-4 pt-2">
        <div className="w-full max-w-md px-4 pointer-events-auto relative">
          
          <div className={`absolute bottom-[100%] left-0 right-0 mx-auto w-max max-w-[95%] mb-2 bg-white/90 backdrop-blur-md border border-[#1D4ED8]/20 rounded-2xl px-4 py-2 shadow-[0_-4px_20px_rgba(0,0,0,0.1)] transition-all duration-700 z-40 flex items-center gap-2.5 ${showAiBubble ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}`}>
            <span className="w-5 h-5 bg-[#1D4ED8] text-white rounded-full flex items-center justify-center font-black text-[9px] shrink-0 animate-pulse">AI</span>
            <p className="text-xs font-bold text-slate-700 tracking-tight leading-snug text-right break-words">{aiSummary}</p>
          </div>

          {showEmoji && (
            <div className="absolute bottom-[100%] right-0 w-full mb-2 bg-white rounded-3xl shadow-[0_-5px_30px_rgba(0,0,0,0.1)] overflow-hidden border border-slate-100 animate-in fade-in slide-in-from-bottom-2 z-50">
              <EmojiPicker onEmojiClick={(e) => setNewMessage(prev => prev + e.emoji)} width="100%" height={350} categories={hebrewCategories as any} searchDisabled skinTonesDisabled />
            </div>
          )}

          {replyingTo && (
            <div className="bg-white/95 backdrop-blur-md bg-[#1D4ED8]/5 p-2.5 rounded-2xl mb-2 flex justify-between items-center shadow-lg border border-[#1D4ED8]/10">
              <div className="flex flex-col overflow-hidden pl-2 text-right w-full">
                <span className="font-black text-xs text-[#1D4ED8] mb-0.5">{replyingTo.profiles?.full_name || 'שכן'}</span>
                <span className="text-xs text-slate-600 truncate font-medium">{replyingTo.content?.replace(/\[AI_REQ:.+?\]/, '').trim() || 'תמונה'}</span>
              </div>
              <button onClick={() => setReplyingTo(null)} className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-600 transition active:scale-95 shrink-0"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg></button>
            </div>
          )}

          <form onSubmit={handleSend} className="flex items-end gap-1 bg-white p-1.5 pr-1.5 rounded-[1.5rem] border border-slate-200 shadow-xl pointer-events-auto">
            <button type="button" onClick={() => setShowEmoji(!showEmoji)} className="w-12 h-12 flex items-center justify-center text-slate-400 hover:text-[#1D4ED8] transition shrink-0 self-end"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></button>
            <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="w-12 h-12 flex items-center justify-center text-slate-400 hover:text-[#1D4ED8] transition shrink-0 self-end">
              {isUploading ? <div className="w-5 h-5 border-2 border-slate-200 border-t-[#1D4ED8] rounded-full animate-spin"></div> : <svg className="w-6 h-6 transform -rotate-45" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path></svg>}
            </button>
            <textarea value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="הקלד הודעה..." className="flex-1 bg-transparent py-3.5 px-2 outline-none text-xs font-medium text-slate-800 resize-none max-h-32 min-h-[48px] tracking-tight leading-relaxed text-right" rows={1} onInput={(e) => { const target = e.target as HTMLTextAreaElement; target.style.height = 'auto'; target.style.height = `${Math.min(target.scrollHeight, 120)}px`; }} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }} />
            <button type="submit" disabled={!newMessage.trim() || isUploading} className="bg-[#1D4ED8] text-white w-12 h-12 rounded-full flex items-center justify-center shadow-md disabled:opacity-50 shrink-0 self-end ml-1 active:scale-95 transition"><svg className="w-5 h-5 transform -rotate-45 translate-x-px" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg></button>
          </form>
        </div>
      </div>
    </div>
  )
}

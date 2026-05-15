'use client'

import React, { useEffect, useState, useMemo, useRef, memo } from 'react';
import { createPortal } from 'react-dom';
import useSWR from 'swr';
import { supabase } from '../../../lib/supabase';
import { playSystemSound } from '../../../components/providers/AppManager';
import AnimatedSheet from '../../../components/ui/AnimatedSheet';
import { WhatsAppIcon, EditIcon, DeleteIcon, PinIcon } from '../../../components/ui/ActionIcons';

interface Ticket { id: string; building_id: string; user_id: string; title: string; description: string; category?: string; urgency?: string; status: string; image_url?: string; is_pinned?: boolean; created_at: string; profiles?: any; }
interface Supplier { id: string; building_id: string; name: string; category: string; type: string; phone: string; rating: number; count: number; }

// רכיב פנימי לתמונה כולל מצב טעינה ל-AI
const TicketMediaPreview = memo(({ previewUrl, onClear, isProcessing }: { previewUrl: string | null; onClear: () => void; isProcessing: boolean }) => {
  if (!previewUrl) return null;
  return (
    <div className="relative inline-block mt-3 mb-1 group animate-in zoom-in-95">
      <div className="w-24 h-24 rounded-2xl overflow-hidden shadow-sm border border-[#1D4ED8]/20 bg-slate-50 flex items-center justify-center relative">
        <img src={previewUrl} className="w-full h-full object-cover" alt="תצוגה מקדימה" />
        {isProcessing && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] flex items-center justify-center">
            <span className="w-6 h-6 border-2 border-[#1D4ED8] border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
      {!isProcessing && (
        <button 
          type="button" 
          onClick={onClear} 
          className="absolute -top-2 -left-2 w-7 h-7 bg-white backdrop-blur-md text-slate-800 rounded-full flex items-center justify-center shadow-md hover:text-rose-600 transition active:scale-90 border border-slate-200 z-20">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      )}
    </div>
  );
});

const fetcher = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Unauthorized');
  
  const { data: prof } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
  if (!prof) throw new Error('Profile missing');

  const [ticketsRes, suppliersRes, myRatingsRes] = await Promise.all([
    supabase.from('service_tickets').select('*, profiles(full_name, avatar_url, apartment)').eq('building_id', prof.building_id).order('created_at', { ascending: false }),
    supabase.from('suppliers').select('*'),
    supabase.from('supplier_ratings').select('supplier_id, rating').eq('user_id', session.user.id)
  ]);

  const ratingsMap: Record<string, number> = {};
  if (myRatingsRes.data) myRatingsRes.data.forEach(r => ratingsMap[r.supplier_id] = r.rating);

  return { profile: prof, tickets: ticketsRes.data || [], suppliers: suppliersRes.data || [], myRatings: ratingsMap };
};

const analyzeTicketAI = (text: string, suppliersList: Supplier[]) => {
  const t = text.toLowerCase();
  let category = 'תחזוקה כללית'; let urgency = 'medium';
  let summary = text.replace(/^(שלום|היי|דחוף|שימו לב|רציתי לדווח על|מדווח על)/gi, '').trim().split(/[.,;!?\n|-]/)[0].trim() || 'תקלה מדווחת';

  if (t.includes('דחיפות גבוהה') || /(פיצוץ|הצפה|דחוף|מיידי)/.test(t)) urgency = 'high';
  if (t.includes('סובל דיחוי')) urgency = 'low';

  if (/(מים|נזילה|פיצוץ|סתימה|ביוב|אינסטלטור|צינור|הצפה|רטיבות|דוד|ברז|אסלה)/.test(t)) category = 'אינסטלציה';
  else if (/(חשמל|קצר|שקע|מנורה|חושך|נשרף|פחת|חשמלאי|לוח|שרוף)/.test(t)) category = 'חשמל';
  else if (/(מעלית|תקוע|לא עובדת|מעליות|כפתור)/.test(t)) { category = 'מעליות'; urgency = 'high'; }
  else if (/(ניקיון|מלוכלך|פח|זבל|ריח|מסריח|שטיפה|ספונג'ה)/.test(t)) { category = 'ניקיון'; if (urgency === 'medium') urgency = 'low'; }
  else if (/(גינה|עץ|השקיה|דשא|גינון)/.test(t)) { category = 'גינון'; if (urgency === 'medium') urgency = 'low'; }
  else if (/(דלת|שער|מנעול|אינטרקום|קודן|חניה)/.test(t)) category = 'שערים ודלתות';
  else if (/(גז|בלון|דליפה)/.test(t)) { category = 'גז'; urgency = 'high'; }

  let assignedSupplier = null;
  const relevantSuppliers = suppliersList.filter(s => s.category === category).sort((a,b) => b.rating - a.rating);
  if (relevantSuppliers.length > 0) assignedSupplier = relevantSuppliers.find(s => s.type === 'house') || relevantSuppliers[0];

  return { category, urgency, summary, assignedSupplier };
};

const analyzeSupplierCategoryAI = (text: string) => {
  const t = text.toLowerCase();
  if (/(מים|נזילה|ביוב|אינסטלטור|דוד)/.test(t)) return 'אינסטלציה';
  if (/(חשמל|קצר|מנורה|חושך)/.test(t)) return 'חשמל';
  if (/(מעלית|תקוע)/.test(t)) return 'מעליות';
  if (/(ניקיון|מלוכלך|זבל|פוליש)/.test(t)) return 'ניקיון';
  if (/(גינה|דשא|השקיה|עץ)/.test(t)) return 'גינון';
  if (/(דלת|שער|מנעולן|קודן|אלומיניום)/.test(t)) return 'שערים ודלתות';
  return 'תחזוקה כללית';
};

export default function ServicesPage() {
  const { data, error, mutate } = useSWR('/api/services/fetch', fetcher, { revalidateOnFocus: true });
  
  const profile = data?.profile;
  const tickets: Ticket[] = data?.tickets || [];
  const suppliers: Supplier[] = data?.suppliers || [];
  const [myRatings, setMyRatings] = useState<Record<string, number>>({});
  
  const [activeTab, setActiveTab] = useState('פתוחות');
  const [supplierTab, setSupplierTab] = useState<'house' | 'recommended'>('house');
  
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [newTicketText, setNewTicketText] = useState('');
  const [manualUrgency, setManualUrgency] = useState<'low' | 'medium' | 'high' | null>(null);
  const [newSupplier, setNewSupplier] = useState({ name: '', description: '', phone: '', initialRating: 5, isHouseSupplier: false });

  // Vision AI States
  const [ticketMedia, setTicketMedia] = useState<{ file: File; preview: string; base64?: string } | null>(null);
  const [isTicketAiProcessing, setIsTicketAiProcessing] = useState(false);
  const ticketFileInputRef = useRef<HTMLInputElement>(null);

  const [customAlert, setCustomAlert] = useState<{ title: string, message: string, type: 'success' | 'error' | 'info' } | null>(null);
  const [aiInsight, setAiInsight] = useState<string>('');
  const [isAiLoading, setIsAiLoading] = useState(true);
  const [showAiBubble, setShowAiBubble] = useState(false);
  const [mounted, setMounted] = useState(false);

  const lastAnalyzedRef = useRef<string>('');
  const isAdmin = profile?.role === 'admin' || profile?.email === 'talyohala1@gmail.com';
  const aiAvatarUrl = profile?.avatar_url || "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Smilies/Robot.png";

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { if (data?.myRatings) setMyRatings(data.myRatings); }, [data?.myRatings]);

  useEffect(() => {
    return () => { if (ticketMedia?.preview) URL.revokeObjectURL(ticketMedia.preview); };
  }, [ticketMedia]);

  useEffect(() => {
    if (!profile?.building_id) return;
    const channel = supabase.channel(`services_${profile.building_id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_tickets', filter: `building_id=eq.${profile.building_id}` }, () => mutate())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile?.building_id, mutate]);

  const filteredTickets = useMemo(() => {
    let filtered = tickets.filter(t => {
      if (activeTab === 'פתוחות') return t.status === 'פתוח';
      if (activeTab === 'בטיפול') return t.status === 'בטיפול';
      if (activeTab === 'היסטוריה') return t.status === 'טופל';
      return true;
    });
    return filtered.sort((a, b) => (a.is_pinned === b.is_pinned ? 0 : a.is_pinned ? -1 : 1));
  }, [tickets, activeTab]);

  useEffect(() => {
    if (!profile || tickets.length === 0) {
      if (data) setIsAiLoading(false);
      return;
    }
    const currentHash = `${profile.id}-${tickets.length}`;
    if (lastAnalyzedRef.current === currentHash) return;
    lastAnalyzedRef.current = currentHash;

    const processAiAnalysis = async () => {
      setIsAiLoading(true);
      const openCount = tickets.filter(t => t.status === 'פתוח').length;
      const progressCount = tickets.filter(t => t.status === 'בטיפול').length;
      const recentTicket = tickets.find(t => t.status === 'פתוח')?.title || 'אין לאחרונה';

      try {
        let context = isAdmin 
          ? `מנהל הוועד: ${profile.full_name}. סטטוס בניין: ${openCount} תקלות פתוחות, ${progressCount} בטיפול. תקלה אחרונה: "${recentTicket}". נסח עדכון ענייני חכם מגוף ראשון כעוזר אישי. 3 שורות בדיוק עם ירידת שורה. אימוג'י 1 בכל שורה.`
          : `דייר: ${profile.full_name}. בבניין יש כרגע ${openCount} תקלות פתוחות ו-${progressCount} בטיפול. התקלה הבולטת: "${recentTicket}". נסח עדכון קהילתי קצר ואופטימי מרובוט הבניין. 3 שורות עם ירידת שורה. אימוג'י 1 בכל שורה.`;

        const res = await fetch('/api/ai/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ description: context, mode: 'insight' }) });
        const aiData = await res.json();
        setAiInsight(aiData.text || '');
      } catch (err) {
        setAiInsight(`תמונת מצב תקלות בבניין 🏢\n${openCount} תקלות מדווחות ממתינות לטיפול ⏳\nהוועד עובד במרץ על ${progressCount} קריאות ✨`);
      } finally {
        setIsAiLoading(false);
        setShowAiBubble(true);
        setTimeout(() => setShowAiBubble(false), 20000);
      }
    };
    processAiAnalysis();
  }, [profile, tickets, isAdmin, data]);

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    playSystemSound('click'); setOpenMenuId(null);
    const ticket = tickets.find(t => t.id === id);
    await supabase.from('service_tickets').update({ status: newStatus }).eq('id', id);
    if (ticket && ticket.user_id !== profile?.id) {
      await supabase.from('notifications').insert([{ receiver_id: ticket.user_id, sender_id: profile?.id, type: 'service', title: `עדכון בתקלה: ${newStatus} 🛠️`, content: `הוועד עדכן סטטוס לקריאה שפתחת.`, link: '/services' }]);
    }
    mutate();
  };

  const handleTogglePin = async (ticket: any) => {
    playSystemSound('click'); setOpenMenuId(null);
    await supabase.from('service_tickets').update({ is_pinned: !ticket.is_pinned }).eq('id', ticket.id);
    mutate();
  };

  const handleDeleteTicket = async (id: string) => {
    playSystemSound('click'); setOpenMenuId(null);
    await supabase.from('service_tickets').delete().eq('id', id);
    mutate();
  };

  const handleShareWhatsAppTicket = (ticket: any) => {
    playSystemSound('click'); setOpenMenuId(null);
    const analysis = analyzeTicketAI(ticket.description || '', suppliers);
    const text = encodeURIComponent(`*עדכון תקלה בבניין:*\n${ticket.title || analysis.summary}\n\n*קטגוריה:* ${analysis.category}\n*סטטוס:* ${ticket.status}\n\n*תיאור:*\n${ticket.description}\n\nדווח ע"י: ${ticket.profiles?.full_name}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  // --- קסם התמונה האוטומטי: כיווץ והפעלת AI מיידית ---
  const handleTicketFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (e.target) e.target.value = '';
    const localPreviewUrl = URL.createObjectURL(file);
    setTicketMedia({ file, preview: localPreviewUrl });
    
    // התחלת פיענוח אוטומטי
    playSystemSound('click');
    setIsTicketAiProcessing(true);

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = async () => {
        // כיווץ התמונה לרוחב 800px כדי שלא נחרוג ממגבלות השרת של Next.js
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        let width = img.width;
        let height = img.height;
        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.6);

        // קריאה מהירה ל-Vision API
        try {
          const res = await fetch('/api/ai/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: compressedBase64, mode: 'vision' })
          });
          const data = await res.json();
          if (data.description) setNewTicketText(data.description);
          if (data.urgency && ['low', 'medium', 'high'].includes(data.urgency)) setManualUrgency(data.urgency as any);
          playSystemSound('notification');
        } catch (err) {
          console.error("Vision AI Error:", err);
          setCustomAlert({ title: 'שגיאת פענוח', message: 'התמונה נשמרה אך ה-AI לא הצליח לקרוא אותה אוטומטית.', type: 'info' });
        } finally {
          setIsTicketAiProcessing(false);
        }
      };
    };
  };

  const clearTicketMedia = () => setTicketMedia(null);

  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || (!newTicketText.trim() && !ticketMedia)) return;
    setIsSubmitting(true);
    
    let imageUrl = undefined;
    if (ticketMedia) {
      const fileExt = ticketMedia.file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
      const { data, error } = await supabase.storage.from('tickets').upload(fileName, ticketMedia.file);
      if (data) {
        imageUrl = supabase.storage.from('tickets').getPublicUrl(fileName).data.publicUrl;
      }
    }

    let finalDescription = manualUrgency === 'high' ? 'דחיפות גבוהה: ' + newTicketText : manualUrgency === 'low' ? 'סובל דיחוי: ' + newTicketText : newTicketText;
    const localAnalysis = analyzeTicketAI(finalDescription, suppliers);
    let finalTitle = localAnalysis.summary;

    if (newTicketText.trim()) {
      try {
        const aiRes = await fetch('/api/ai/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ description: newTicketText, mode: 'classify' })
        });
        if (aiRes.ok) {
          const aiData = await aiRes.json();
          if (aiData.title) finalTitle = aiData.title.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/gu, '').trim();
        }
      } catch (err) {
        console.error("AI classify error", err);
      }
    } else {
      finalTitle = 'תקלה מצולמת';
    }

    const { error } = await supabase.from('service_tickets').insert([{ 
      building_id: profile.building_id, 
      user_id: profile.id, 
      title: finalTitle, 
      description: finalDescription, 
      image_url: imageUrl,
      status: 'פתוח' 
    }]);
    
    setIsSubmitting(false);
    
    if (!error) {
      setCustomAlert({ title: 'הדיווח התקבל!', message: `התקלה נותבה למחלקת "${localAnalysis.category}".`, type: 'success' });
      setNewTicketText(''); setManualUrgency(null); setTicketMedia(null); setIsTicketModalOpen(false); playSystemSound('success'); mutate();
    } else {
      setCustomAlert({ title: 'שגיאה', message: 'מערכת דיווח התקלות אינה זמינה כרגע.', type: 'error' });
    }
  };

  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupplier.name || !newSupplier.phone || !newSupplier.description) return;
    setIsSubmitting(true);
    const smartCategory = analyzeSupplierCategoryAI(newSupplier.description);
    const { error } = await supabase.from('suppliers').insert([{ building_id: profile.building_id, name: newSupplier.name, category: smartCategory, type: newSupplier.isHouseSupplier ? 'house' : 'recommended', phone: newSupplier.phone.replace(/\D/g, ''), rating: newSupplier.initialRating, count: 1 }]);
    setIsSubmitting(false);

    if (!error) {
       setCustomAlert({ title: 'הספק נשמר (AI)', message: `המערכת סיווגה אותו ל-${smartCategory} במאגר!`, type: 'success' });
       setIsSupplierModalOpen(false); setNewSupplier({ name: '', description: '', phone: '', initialRating: 5, isHouseSupplier: false }); playSystemSound('success'); mutate();
    } else {
       setCustomAlert({ title: 'שגיאה', message: 'לא ניתן לשמור ספק כרגע.', type: 'error' });
    }
  };

  const handleRateSupplier = async (supplierId: string, rating: number) => {
    playSystemSound('click');
    await supabase.from('supplier_ratings').upsert({ supplier_id: supplierId, user_id: profile.id, rating: rating });
    setMyRatings(prev => ({...prev, [supplierId]: rating}));
    setCustomAlert({ title: 'הדירוג נקלט', message: 'תודה! חוות הדעת שלך נשמרה.', type: 'success' });
  };

  const formatWhatsAppLink = (phone: string) => { let clean = phone.replace(/\D/g, ''); return `https://wa.me/${clean.startsWith('0') ? '972' + clean.substring(1) : clean}`; };
  const timeFormat = (dateStr: string) => { const date = new Date(dateStr); const diffDays = Math.floor((Date.now() - date.getTime()) / 86400000); return diffDays === 0 ? date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : diffDays === 1 ? 'אתמול' : date.toLocaleDateString('he-IL'); };

  const StarRating = ({ supplierId, currentAvg, totalVotes }: { supplierId: string, currentAvg: number, totalVotes: number }) => {
    const myVote = myRatings[supplierId] || 0;
    return (
      <div className="flex flex-col gap-1 items-end">
        <div className="flex flex-row-reverse gap-0.5 cursor-pointer group">
          {[1, 2, 3, 4, 5].map((star) => (
            <svg key={star} onClick={() => handleRateSupplier(supplierId, star)} className={`w-5 h-5 transition-all active:scale-75 ${star <= (myVote || Math.round(currentAvg)) ? 'text-amber-400 drop-shadow-sm' : 'text-slate-200 hover:text-amber-200'}`} fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          ))}
        </div>
        <span className="text-[9px] font-black text-slate-400">{myVote > 0 ? 'דירגת' : `${currentAvg} (${totalVotes})`}</span>
      </div>
    );
  };

  const tabCounts: Record<string, number> = {
    'פתוחות': tickets.filter(t => t.status === 'פתוח').length,
    'בטיפול': tickets.filter(t => t.status === 'בטיפול').length,
    'היסטוריה': tickets.filter(t => t.status === 'טופל').length,
    'ספקים': suppliers.length
  };

  if (!data && !error) return <div className="flex flex-col flex-1 w-full items-center justify-center min-h-[100dvh] bg-transparent"><div className="w-12 h-12 border-4 border-[#1D4ED8]/30 border-t-[#1D4ED8] rounded-full animate-spin"></div></div>;

  return (
    <div className="flex flex-col flex-1 w-full pb-32 relative bg-transparent min-h-[100dvh]" dir="rtl" onClick={() => setOpenMenuId(null)}>
      {mounted && customAlert && createPortal(
        <div className="fixed inset-0 z-[10000] bg-black/40 backdrop-blur-sm flex justify-center items-center p-4" onClick={() => setCustomAlert(null)} dir="rtl">
          <div className="bg-white/95 backdrop-blur-xl rounded-[1.5rem] p-6 w-full max-w-sm shadow-2xl text-center animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <div className={`w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center shadow-lg ${customAlert.type === 'success' ? 'bg-[#10B981]/10 text-[#10B981]' : 'bg-red-50 text-red-500'}`}>
              {customAlert.type === 'success' ? <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg> : <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>}
            </div>
            <h3 className="text-2xl font-black text-slate-800 mb-2">{customAlert.title}</h3>
            <p className="text-base text-slate-500 mb-6 font-medium">{customAlert.message}</p>
            <button onClick={() => setCustomAlert(null)} className="w-full h-14 bg-[#1E293B] text-white font-bold rounded-xl active:scale-95 transition text-lg">סגירה</button>
          </div>
        </div>, document.body
      )}

      <div className="px-4 mt-6 mb-5">
        <h2 className="text-2xl font-black text-slate-800 tracking-tight">שירות ותקלות</h2>
      </div>

      <div className="px-5 mb-6">
        <div className="flex bg-white/60 backdrop-blur-md p-1.5 rounded-full border border-[#1D4ED8]/10 shadow-sm relative z-10">
          {['פתוחות', 'בטיפול', 'היסטוריה', 'ספקים'].map(tab => {
            const isActive = activeTab === tab;
            return (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 h-10 rounded-full text-[13px] transition-all flex items-center justify-center font-bold gap-1 shrink-0 ${isActive ? 'text-[#1D4ED8] bg-blue-50 border border-blue-100 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                <span>{tab}</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black ${isActive ? 'bg-[#1D4ED8] text-white' : 'bg-gray-100 text-gray-500'}`}>{tabCounts[tab]}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-5 w-full relative z-10 space-y-4">
        {activeTab === 'ספקים' ? (
          <div className="animate-in fade-in space-y-5">
            <div className="flex border-b border-[#1D4ED8]/10 mx-1">
              <button onClick={() => setSupplierTab('house')} className={`flex-1 pb-3 text-sm font-black transition-all ${supplierTab === 'house' ? 'text-[#1D4ED8] border-b-2 border-[#1D4ED8]' : 'text-slate-400 border-transparent hover:text-slate-600'}`}>ספקי הבית</button>
              <button onClick={() => setSupplierTab('recommended')} className={`flex-1 pb-3 text-sm font-black transition-all ${supplierTab === 'recommended' ? 'text-[#1D4ED8] border-b-2 border-[#1D4ED8]' : 'text-slate-400 border-transparent hover:text-slate-600'}`}>מומלצים</button>
            </div>
            <div className="bg-white/90 backdrop-blur-xl rounded-[2rem] border border-[#1D4ED8]/10 shadow-[0_8px_30px_rgba(29,78,216,0.04)] overflow-hidden p-1">
              {suppliers.filter(s => s.type === supplierTab).map((supplier, idx, arr) => (
                <div key={supplier.id} className={`p-4 flex flex-col gap-3 ${idx !== arr.length - 1 ? 'border-b border-[#1D4ED8]/5' : ''} hover:bg-slate-50/50 transition-colors rounded-xl`}>
                  <div className="flex justify-between items-start">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[15px] font-black text-slate-800">{supplier.name}</span>
                      <span className="text-[11px] font-bold text-slate-500 mb-1">{supplier.category}</span>
                      <StarRating supplierId={supplier.id} currentAvg={supplier.rating} totalVotes={supplier.count} />
                    </div>
                    <div className="flex gap-2">
                      <a href={formatWhatsAppLink(supplier.phone)} target="_blank" rel="noopener noreferrer" className="w-11 h-11 bg-white border border-slate-100 rounded-xl flex items-center justify-center transition active:scale-95 shadow-sm shrink-0 hover:bg-slate-50">
                         <WhatsAppIcon className="w-7 h-7" />
                      </a>
                      <a href={`tel:${supplier.phone}`} onClick={() => playSystemSound('click')} className="w-11 h-11 bg-[#1D4ED8] text-white rounded-xl flex items-center justify-center transition active:scale-95 shadow-sm shrink-0">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
                      </a>
                    </div>
                  </div>
                </div>
              ))}
              {suppliers.filter(s => s.type === supplierTab).length === 0 && <div className="p-8 text-center text-sm font-bold text-slate-400">אין ספקים בקטגוריה זו.</div>}
            </div>
          </div>
        ) : (
          filteredTickets.length === 0 ? (
            <div className="text-center py-20 bg-white/60 backdrop-blur-xl rounded-[2rem] border border-[#1D4ED8]/10 shadow-sm animate-in fade-in">
              <p className="font-black text-xl text-slate-700">הכל תקין בבניין ✨</p>
              <p className="text-sm font-medium text-slate-500 mt-2">אין תקלות מדווחות בקטגוריה זו.</p>
            </div>
          ) : (
            filteredTickets.map(ticket => {
              const ticketAnalysis = analyzeTicketAI(ticket.description || ticket.title || '', suppliers);
              const matchedSupplier = ticketAnalysis.assignedSupplier;
              const isOwner = ticket.user_id === profile?.id;
              
              return (
                <div key={ticket.id} className={`bg-white/90 backdrop-blur-xl rounded-[2rem] p-5 mb-5 relative transition-all duration-300 ${ticket.is_pinned ? 'border-orange-200/60 bg-gradient-to-br from-orange-50/80 to-white shadow-[0_8px_25px_rgba(249,115,22,0.15)]' : 'border border-[#1D4ED8]/10 shadow-[0_8px_30px_rgba(29,78,216,0.04)]'} ${openMenuId === ticket.id ? 'z-50' : 'z-10'}`}>
                  
                  <div className="absolute top-0 right-0 flex overflow-hidden rounded-bl-[1.5rem] rounded-tr-[2rem] shadow-sm z-10">
                    {ticket.is_pinned ? (
                      <div className="px-5 py-1.5 bg-[#F59E0B] text-white text-[11px] font-black uppercase tracking-wider">נעוץ</div>
                    ) : (
                      <>
                        <div className={`px-4 py-1.5 text-white text-[10px] font-black ${ticket.status === 'פתוח' ? 'bg-[#1D4ED8]' : ticket.status === 'בטיפול' ? 'bg-orange-500' : 'bg-[#10B981]'}`}>{ticket.status}</div>
                        <div className="px-3 py-1.5 bg-blue-50 text-[#1D4ED8] text-[10px] font-black border-r border-[#1D4ED8]/10">{ticket.category || ticketAnalysis.category}</div>
                        {(ticket.urgency === 'high' || ticketAnalysis.urgency === 'high') && <div className="px-3 py-1.5 bg-rose-50 text-rose-600 text-[10px] font-black border-r border-rose-100/50 animate-pulse">דחוף</div>}
                      </>
                    )}
                  </div>

                  <div className="flex justify-between items-start pt-7 pr-1">
                    <div className="flex-1">
                      <h3 className={`text-[17px] font-black leading-tight mb-2.5 ${ticket.is_pinned ? 'text-slate-800' : 'text-slate-800'}`}>
                        {ticket.title || ticketAnalysis.summary}
                      </h3>
                      <div className="flex items-center gap-2 mb-1.5">
                        <img src={ticket.profiles?.avatar_url || `https://api.dicebear.com/8.x/initials/svg?seed=${ticket.profiles?.full_name}`} className="w-7 h-7 rounded-full object-cover shadow-sm border border-slate-200" alt="avatar" />
                        <div className="flex flex-col">
                          <span className="text-[13px] font-black text-slate-700 leading-none">{ticket.profiles?.full_name}</span>
                          <span className="text-[9px] font-bold text-slate-400 mt-0.5">{timeFormat(ticket.created_at)} • דירה {ticket.profiles?.apartment || '-'}</span>
                        </div>
                      </div>
                    </div>
                    {isAdmin && (
                      <div className="absolute top-3 left-3 z-20">
                        <button onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === ticket.id ? null : ticket.id); }} className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-[#1D4ED8] transition-colors active:scale-95 bg-white/50 border border-slate-100 shadow-sm">
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"></path></svg>
                        </button>
                        {openMenuId === ticket.id && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)}></div>
                            <div className="absolute left-0 top-10 w-[170px] bg-white/95 backdrop-blur-xl border border-slate-100 shadow-[0_15px_50px_rgba(0,0,0,0.15)] rounded-2xl z-[150] py-1.5 animate-in zoom-in-95">
                              <button onClick={() => handleShareWhatsAppTicket(ticket)} className="w-full text-right px-4 h-11 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-3 border-b border-slate-100/50"><WhatsAppIcon className="w-4 h-4" />שיתוף לוואטסאפ</button>
                              <button onClick={() => handleTogglePin(ticket)} className="w-full text-right px-4 h-11 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-3 border-b border-slate-100/50"><PinIcon className={`w-4 h-4 ${ticket.is_pinned ? 'text-[#F59E0B]' : 'text-[#1D4ED8]'}`} />{ticket.is_pinned ? 'ביטול נעיצה' : 'נעץ הודעה'}</button>
                              {ticket.status === 'פתוח' && <button onClick={() => handleUpdateStatus(ticket.id, 'בטיפול')} className="w-full text-right px-4 h-11 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-3 border-b border-slate-100/50"><svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>סמן בטיפול</button>}
                              {ticket.status !== 'טופל' && <button onClick={() => handleUpdateStatus(ticket.id, 'טופל')} className="w-full text-right px-4 h-11 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-3 border-b border-slate-100/50"><svg className="w-4 h-4 text-[#10B981]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"></path></svg>סמן כטופל</button>}
                              {(isAdmin || isOwner) && (
                                <button onClick={() => handleDeleteTicket(ticket.id)} className="w-full text-right px-4 h-11 text-xs font-bold text-rose-600 hover:bg-red-50 flex items-center gap-3"><DeleteIcon className="w-4 h-4 text-rose-500" />מחיקת תקלה</button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {ticket.image_url && (
                    <div className="w-full h-40 rounded-2xl overflow-hidden mt-3 mb-2 shadow-inner border border-slate-100">
                      <img src={ticket.image_url} alt="תקלה" className="w-full h-full object-cover" />
                    </div>
                  )}

                  <div className="bg-[#F8FAFC]/80 p-3.5 rounded-2xl border border-[#1D4ED8]/5 mt-2 shadow-sm"><p className="text-xs font-medium text-slate-600 leading-relaxed">{ticket.description}</p></div>
                  {matchedSupplier && ticket.status !== 'טופל' && (
                    <div className="bg-[#1D4ED8]/5 rounded-2xl p-3 border border-[#1D4ED8]/10 flex items-center justify-between mt-3 shadow-sm">
                      <div className="flex flex-col justify-center">
                        <span className="text-[10px] font-black text-[#1D4ED8] mb-0.5">בעל מקצוע מומלץ (AI)</span>
                        <span className="text-xs font-bold text-slate-800">{matchedSupplier.name}</span>
                      </div>
                      <div className="flex gap-2">
                        <a href={formatWhatsAppLink(matchedSupplier.phone)} target="_blank" rel="noopener noreferrer" className="w-9 h-9 bg-white border border-slate-100 rounded-xl flex items-center justify-center transition active:scale-95 shadow-sm shrink-0 hover:bg-slate-50"><WhatsAppIcon className="w-5 h-5" /></a>
                        <a href={`tel:${matchedSupplier.phone}`} onClick={() => playSystemSound('click')} className="w-9 h-9 bg-[#1D4ED8] text-white rounded-xl flex items-center justify-center transition active:scale-95 shadow-sm shrink-0"><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg></a>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )
        )}
      </div>

      {activeTab !== 'היסטוריה' && (
        <button onClick={() => { playSystemSound('click'); activeTab === 'ספקים' ? setIsSupplierModalOpen(true) : setIsTicketModalOpen(true); }} className="fixed bottom-24 left-6 z-40 bg-white/90 backdrop-blur-md border border-[#1D4ED8]/20 text-slate-800 pl-4 pr-1.5 py-1.5 rounded-full shadow-[0_8px_30px_rgba(29,78,216,0.15)] hover:scale-105 active:scale-95 transition flex items-center gap-2 group flex-row-reverse">
          <div className="bg-[#1D4ED8] text-white w-10 h-10 flex items-center justify-center rounded-full shadow-md"><svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m7-7H5"></path></svg></div>
          <span className="font-black text-xs text-[#1D4ED8]">{activeTab === 'ספקים' ? 'איש מקצוע' : 'תקלה חדשה'}</span>
        </button>
      )}

      <AnimatedSheet isOpen={isTicketModalOpen} onClose={() => setIsTicketModalOpen(false)}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-black text-slate-800">דיווח תקלה חדשה</h2>
        </div>
        
        <form onSubmit={handleSubmitTicket} className="flex flex-col relative min-h-[250px]">
          <div className="flex-1 overflow-y-auto hide-scrollbar pb-6">
            
            {/* מיכל אחיד לטקסט, לתמונה ולכפתורי הדחיפות - Focus Within עובד מעולה פה */}
            <div className="w-full bg-[#F8FAFC] border border-slate-200 rounded-[1.5rem] p-4 focus-within:border-[#1D4ED8] focus-within:shadow-[0_0_0_4px_rgba(29,78,216,0.1)] transition-all shadow-inner relative flex flex-col">
              <textarea 
                required={!ticketMedia} 
                value={newTicketText} 
                onChange={(e) => setNewTicketText(e.target.value)} 
                placeholder={isTicketAiProcessing ? "ה-AI קורא את התמונה ומפענח את התקלה..." : "מה התקלקל? אפשר פשוט לצלם וה-AI יבין לבד..."} 
                className={`w-full bg-transparent text-sm font-bold outline-none resize-none min-h-[80px] max-h-[160px] overflow-y-auto hide-scrollbar text-slate-800 transition-all ${isTicketAiProcessing ? 'placeholder-[#1D4ED8] animate-pulse' : 'placeholder-slate-400'}`} 
              />
              
              <TicketMediaPreview previewUrl={ticketMedia?.preview || null} onClear={clearTicketMedia} isProcessing={isTicketAiProcessing} />

              {/* טאבים של דחיפות בתוך המיכל! */}
              <div className="flex gap-2 mt-2 pt-3 border-t border-slate-200/60">
                <button type="button" onClick={() => setManualUrgency('high')} className={`flex-1 h-10 rounded-xl text-xs font-black transition-all border ${manualUrgency === 'high' ? 'bg-rose-500 text-white border-rose-500 shadow-md' : 'bg-white text-rose-600 border-rose-100 hover:bg-rose-50'}`}>דחוף</button>
                <button type="button" onClick={() => setManualUrgency('medium')} className={`flex-1 h-10 rounded-xl text-xs font-black transition-all border ${manualUrgency === 'medium' ? 'bg-orange-500 text-white border-orange-500 shadow-md' : 'bg-white text-orange-600 border-orange-100 hover:bg-orange-50'}`}>רגיל</button>
                <button type="button" onClick={() => setManualUrgency('low')} className={`flex-1 h-10 rounded-xl text-[11px] font-black transition-all border ${manualUrgency === 'low' ? 'bg-slate-700 text-white border-slate-700 shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>לא דחוף</button>
              </div>
            </div>

          </div>

          <div className="absolute bottom-0 left-0 right-0 pt-4 bg-gradient-to-t from-white via-white to-transparent flex items-center justify-between border-t border-slate-100">
            <div className="flex items-center gap-2">
              <input type="file" accept="image/*" className="hidden" ref={ticketFileInputRef} onChange={handleTicketFileChange} />
              <button type="button" onClick={() => ticketFileInputRef.current?.click()} className="w-12 h-12 rounded-full bg-slate-50 text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 flex items-center justify-center transition active:scale-95 shadow-sm">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              </button>
            </div>

            <button type="submit" disabled={isSubmitting || (!newTicketText.trim() && !ticketMedia) || isTicketAiProcessing} className="w-14 h-14 rounded-full bg-[#1D4ED8] text-white flex items-center justify-center shadow-lg hover:bg-blue-700 active:scale-90 transition disabled:opacity-50 disabled:scale-100">
              {isSubmitting ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <svg className="w-6 h-6 transform -rotate-45 translate-x-px" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>}
            </button>
          </div>
        </form>
      </AnimatedSheet>

      {/* שאר המודאלים כרגיל */}
      <AnimatedSheet isOpen={isSupplierModalOpen} onClose={() => setIsSupplierModalOpen(false)}>
        <h2 className="text-2xl font-black text-slate-800 mb-6">הוספת ספק מומלץ</h2>
        <form onSubmit={handleAddSupplier} className="space-y-4">
          <input required placeholder="שם הספק / איש המקצוע..." value={newSupplier.name} onChange={e => setNewSupplier({...newSupplier, name: e.target.value})} className="w-full h-14 bg-[#F8FAFC] border border-slate-200 rounded-2xl px-4 text-sm font-bold outline-none focus:border-[#1D4ED8] text-slate-800 shadow-inner" />
          <input required placeholder="מספר טלפון..." value={newSupplier.phone} onChange={e => setNewSupplier({...newSupplier, phone: e.target.value})} dir="ltr" className="w-full h-14 bg-[#F8FAFC] border border-slate-200 rounded-2xl px-4 text-sm font-bold text-right outline-none focus:border-[#1D4ED8] text-slate-800 shadow-inner" />
          <textarea required placeholder="במה הוא עוסק? (ה-AI יסווג אוטומטית לקטגוריה)" value={newSupplier.description} onChange={e => setNewSupplier({...newSupplier, description: e.target.value})} className="w-full bg-[#F8FAFC] border border-slate-200 rounded-[1.5rem] p-4 text-sm font-bold outline-none focus:border-[#1D4ED8] shadow-inner resize-none min-h-[90px] text-slate-800" />
          
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col items-center justify-center gap-2 shadow-sm">
            <span className="text-xs font-black text-slate-600">הדירוג הראשוני שלך:</span>
            <div className="flex flex-row-reverse gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <svg key={star} onClick={() => { playSystemSound('click'); setNewSupplier({...newSupplier, initialRating: star}) }} className={`w-8 h-8 cursor-pointer transition-all active:scale-75 ${star <= newSupplier.initialRating ? 'text-amber-400 drop-shadow-sm' : 'text-slate-200 hover:text-amber-200'}`} fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
              ))}
            </div>
          </div>
          {isAdmin && (
            <label className="flex items-center gap-3 bg-[#1D4ED8]/10 p-3 rounded-xl cursor-pointer border border-[#1D4ED8]/20 mt-2">
              <input type="checkbox" checked={newSupplier.isHouseSupplier} onChange={e => setNewSupplier({...newSupplier, isHouseSupplier: e.target.checked})} className="w-5 h-5 text-[#1D4ED8] rounded border-gray-300" />
              <span className="text-sm font-black text-[#1D4ED8]">הגדר כספק הבית הקבוע (מועדף)</span>
            </label>
          )}
          <button type="submit" disabled={isSubmitting} className="w-full h-14 mt-2 bg-[#1D4ED8] text-white font-black rounded-2xl shadow-lg active:scale-[0.98] transition-all text-lg">{isSubmitting ? 'שומר במאגר...' : 'אישור ושמירה'}</button>
        </form>
      </AnimatedSheet>

      <div className={`fixed bottom-24 right-6 z-50 flex flex-col items-end pointer-events-none transition-all duration-700 ${isAiLoading || showAiBubble ? 'opacity-100 translate-y-0 visible' : 'opacity-0 translate-y-10 invisible'}`}>
        {showAiBubble && !isAiLoading && <div className="absolute bottom-[60px] right-0 mb-2 bg-white/95 backdrop-blur-md text-slate-800 p-4 rounded-2xl shadow-lg text-xs font-bold w-max max-w-[240px] leading-snug border border-[#1D4ED8]/20 text-right pointer-events-auto break-words">{aiInsight}</div>}
        <button onClick={() => setShowAiBubble(!showAiBubble)} className={`w-12 h-12 bg-transparent flex items-center justify-center pointer-events-auto active:scale-95 transition-transform duration-300 ${isAiLoading ? 'animate-pulse' : ''}`}>
          {isAiLoading ? <div className="w-12 h-12 bg-[#1D4ED8]/10 backdrop-blur-sm rounded-full flex items-center justify-center border border-[#1D4ED8]/30"><div className="w-5 h-5 border-2 border-[#1D4ED8] border-t-transparent rounded-full animate-spin" /></div> : <img src={aiAvatarUrl} alt="AI" className="w-12 h-12 object-contain drop-shadow-md rounded-full" />}
        </button>
      </div>

    </div>
  );
}

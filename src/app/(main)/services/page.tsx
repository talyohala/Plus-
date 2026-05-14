'use client'

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import { playSystemSound } from '../../../components/providers/AppManager';
import { createPortal } from 'react-dom';

// --- Super Smart AI Text Analyzer ---
const analyzeTicketAI = (text: string, suppliersList: any[]) => {
  const t = text.toLowerCase();
  let category = 'תחזוקה כללית';
  let urgency = 'medium';
  
  let summary = text.trim();
  const prefixes = /^(שלום|היי|בוקר טוב|ערב טוב|צהריים טובים|לוועד|דיירים יקרים|שכנים|אשמח לעזרה|יש לנו|ראיתי ש|שמתי לב ש|רציתי לדווח על|רציתי לדווח|מדווח על|סליחה על ההפרעה|הודעה לוועד|דחוף|שימו לב|מישהו יכול|דחיפות גבוהה:|סובל דיחוי:)/gi;
  summary = summary.replace(prefixes, '').trim();
  
  let clause = summary.split(/[.,;!?\n|-]/)[0].trim();
  let words = clause.split(/\s+/);
  if (words.length > 7) {
    const badEndings = ['של', 'את', 'על', 'עם', 'או', 'וגם', 'מ', 'ל', 'ב', 'כ', 'מן', 'זה', 'כי'];
    let limit = 7;
    while (limit > 3 && badEndings.includes(words[limit - 1])) limit--;
    clause = words.slice(0, limit).join(' ');
  }
  summary = clause.replace(/[.,;?!]+$/, '').trim(); 
  if (!summary) summary = 'תקלה מדווחת';

  if (t.includes('דחיפות גבוהה')) urgency = 'high';
  if (t.includes('סובל דיחוי')) urgency = 'low';

  if (/(מים|נזילה|פיצוץ|סתימה|ביוב|אינסטלטור|צינור|טפטוף|הצפה|רטיבות|דוד|ברז|אסלה|כיור|מקלחת|דלף)/.test(t)) {
    category = 'אינסטלציה';
    if (urgency === 'medium' && /(פיצוץ|הצפה|דחוף|מיידי)/.test(t)) urgency = 'high';
  } else if (/(חשמל|קצר|שקע|מנורה|חושך|נשרף|פחת|חשמלאי|אור|הפסקת|לוח|חוטים|שרוף|הבהוב)/.test(t)) {
    category = 'חשמל';
    if (urgency === 'medium' && /(קצר|נשרף|אש|מסוכן|גיצים)/.test(t)) urgency = 'high';
  } else if (/(מעלית|תקוע|לא עובדת|מעליות|כפתור במעלית|פיר)/.test(t)) {
    category = 'מעליות';
    urgency = 'high';
  } else if (/(ניקיון|מלוכלך|פח|זבל|לנקות|ריח|מסריח|שטיפה|כתם|אבק|ספונג'ה)/.test(t)) {
    category = 'ניקיון';
    if (urgency === 'medium') urgency = 'low';
  } else if (/(גינה|עץ|השקיה|דשא|צמחים|עציץ|גינון)/.test(t)) {
    category = 'גינון';
    if (urgency === 'medium') urgency = 'low';
  } else if (/(דלת|שער|מנעול|אינטרקום|קודן|חניה|שלט|מפתח|לא נפתח|תקועה)/.test(t)) {
    category = 'שערים ודלתות';
    if (urgency === 'medium' && /(לא נפתח|תקוע)/.test(t)) urgency = 'high';
  } else if (/(גז|בלון|ריח של גז|דליפה)/.test(t)) {
    category = 'גז';
    urgency = 'high';
  }

  let assignedSupplier = null;
  const relevantSuppliers = suppliersList.filter(s => s.category === category);
  if (relevantSuppliers.length > 0) {
    const houseSups = relevantSuppliers.filter(s => s.type === 'house').sort((a,b) => b.rating - a.rating);
    assignedSupplier = houseSups.length > 0 ? houseSups[0] : relevantSuppliers.sort((a,b) => b.rating - a.rating)[0];
  }

  return { category, urgency, summary, assignedSupplier };
}

export default function ServicesPage() {
  const [profile, setProfile] = useState<any>(null);
  const [tickets, setTickets] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [myRatings, setMyRatings] = useState<Record<string, number>>({});
  
  const [activeTab, setActiveTab] = useState('פתוחות');
  const [supplierTab, setSupplierTab] = useState<'house' | 'recommended'>('house');
  
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [newTicketText, setNewTicketText] = useState('');
  const [manualUrgency, setManualUrgency] = useState<'low' | 'medium' | 'high' | null>(null);
  const [newSupplier, setNewSupplier] = useState({ name: '', category: 'תחזוקה כללית', phone: '', initialRating: 5 });

  const [customAlert, setCustomAlert] = useState<{ title: string, message: string, type: 'success' | 'error' | 'info' } | null>(null);
  const [mounted, setMounted] = useState(false);

  // Swipe logic states
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [translateY, setTranslateY] = useState(0);

  const isAdmin = profile?.role === 'admin' || profile?.email === 'talyohala1@gmail.com';

  useEffect(() => { setMounted(true) }, [])

  // נעילת גלילה כשהבוטום שיט פתוח למניעת רענון המסך בסווייפ (Pull-to-refresh)
  useEffect(() => {
    if (isTicketModalOpen || isSupplierModalOpen) {
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
    } else {
      document.body.style.overflow = 'unset';
      document.body.style.touchAction = 'auto';
    }
    return () => {
      document.body.style.overflow = 'unset';
      document.body.style.touchAction = 'auto';
    };
  }, [isTicketModalOpen, isSupplierModalOpen]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
    if (!prof) return;
    setProfile(prof);

    const { data: ticketsData } = await supabase.from('service_tickets').select('*, profiles(full_name, avatar_url, apartment)').eq('building_id', prof.building_id).order('created_at', { ascending: false });
    if (ticketsData) setTickets(ticketsData);
    setSuppliers([
        { id: '1', name: 'יוסי אינסטלציה', category: 'אינסטלציה', type: 'house', phone: '050-1112233', rating: 4.8, count: 42 },
        { id: '2', name: 'חשמל הצפון', category: 'חשמל', type: 'recommended', phone: '052-4445566', rating: 4.9, count: 128 },
        { id: '3', name: 'אורן מעליות', category: 'מעליות', type: 'house', phone: '054-7778899', rating: 4.5, count: 15 },
        { id: '4', name: 'מבריק בע"מ', category: 'ניקיון', type: 'house', phone: '053-2223344', rating: 4.2, count: 67 },
        { id: '5', name: 'טופ דורס', category: 'שערים ודלתות', type: 'recommended', phone: '050-9990011', rating: 4.7, count: 89 },
    ]);
    setIsLoading(false);
  }, []);

  useEffect(() => { fetchData() }, [fetchData]);

  useEffect(() => {
    let channel: any = null;
    if (profile?.building_id) {
      channel = supabase.channel(`services_${profile.building_id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'service_tickets', filter: `building_id=eq.${profile.building_id}` }, fetchData)
        .subscribe();
    }
    return () => { if (channel) supabase.removeChannel(channel); };
  }, [profile?.building_id, fetchData]);

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    playSystemSound('click');
    setOpenMenuId(null);
    const ticket = tickets.find(t => t.id === id);
    await supabase.from('service_tickets').update({ status: newStatus }).eq('id', id);
    if (ticket && ticket.user_id && ticket.user_id !== profile.id) {
      await supabase.from('notifications').insert([{
        receiver_id: ticket.user_id, sender_id: profile.id, type: 'service',
        title: `עדכון בתקלה: ${newStatus} 🛠️`, content: `הוועד עדכן את הסטטוס ל-${newStatus}.`, link: '/services'
      }]);
    }
    fetchData();
  };

  const handleTogglePin = async (ticket: any) => {
    playSystemSound('click');
    setOpenMenuId(null);
    await supabase.from('service_tickets').update({ is_pinned: !ticket.is_pinned }).eq('id', ticket.id);
    fetchData();
  };

  const handleDeleteTicket = async (id: string) => {
    playSystemSound('click');
    setOpenMenuId(null);
    await supabase.from('service_tickets').delete().eq('id', id);
    fetchData();
  };

  const handleShareWhatsAppTicket = (ticket: any) => {
    playSystemSound('click');
    setOpenMenuId(null);
    const analysis = analyzeTicketAI(ticket.description || '', suppliers);
    const text = `*תקלה בבניין:*\n${ticket.title || analysis.summary}\n\n*קטגוריה:* ${analysis.category}\n*סטטוס:* ${ticket.status}\n\n*תיאור:*\n${ticket.description}\n\nדווח ע"י: ${ticket.profiles?.full_name}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleTicketTyping = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewTicketText(e.target.value);
  };

  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !newTicketText.trim()) return;
    setIsSubmitting(true);
    
    let finalDescription = newTicketText;
    if (manualUrgency === 'high') finalDescription = 'דחיפות גבוהה: ' + newTicketText;
    if (manualUrgency === 'low') finalDescription = 'סובל דיחוי: ' + newTicketText;

    const analysis = analyzeTicketAI(finalDescription, suppliers);
    const { error } = await supabase.from('service_tickets').insert([{
      building_id: profile.building_id,
      user_id: profile.id,
      title: analysis.summary,
      description: finalDescription,
      status: 'פתוח'
    }]);

    setIsSubmitting(false);
    if (!error) {
      setCustomAlert({ title: 'הדיווח התקבל!', message: `התקלה נותבה ל-${analysis.category}.`, type: 'success' });
      setNewTicketText('');
      setManualUrgency(null);
      setIsTicketModalOpen(false);
      setTranslateY(0);
      playSystemSound('success');
      fetchData();
    } else {
      setCustomAlert({ title: 'שגיאה', message: 'מערכת דיווח התקלות אינה זמינה כרגע.', type: 'error' });
    }
  };

  const handleAddSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    const createdSupplier = {
      id: Date.now().toString(), name: newSupplier.name, category: newSupplier.category,
      type: 'recommended', phone: newSupplier.phone, rating: newSupplier.initialRating, count: 1
    };
    setSuppliers(prev => [createdSupplier, ...prev]);
    setCustomAlert({ title: 'הספק נוסף', message: 'תודה על תרומתך לקהילה!', type: 'success' });
    setIsSupplierModalOpen(false);
    setTranslateY(0);
    setNewSupplier({ name: '', category: 'תחזוקה כללית', phone: '', initialRating: 5 });
    playSystemSound('success');
  };

  const formatWhatsAppLink = (phone: string) => {
    let clean = phone.replace(/\D/g, '');
    if (clean.startsWith('0')) clean = '972' + clean.substring(1);
    return `https://wa.me/${clean}`;
  };

  const filteredTickets = useMemo(() => {
    let filtered = tickets.filter(t => {
      if (activeTab === 'פתוחות') return t.status === 'פתוח';
      if (activeTab === 'בטיפול') return t.status === 'בטיפול';
      if (activeTab === 'היסטוריה') return t.status === 'טופל';
      return true;
    });
    return filtered.sort((a, b) => (a.is_pinned === b.is_pinned ? 0 : a.is_pinned ? -1 : 1));
  }, [tickets, activeTab]);

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientY);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!touchStart) return;
    const currentY = e.targetTouches[0].clientY;
    const diff = currentY - touchStart;
    if (diff > 0) {
      setTranslateY(diff);
    }
  };
  const onTouchEnd = () => {
    if (translateY > 150) {
      setIsTicketModalOpen(false);
      setIsSupplierModalOpen(false);
    }
    setTranslateY(0);
    setTouchStart(null);
  };

  const StarRating = ({ supplierId, currentAvg, totalVotes }: { supplierId: string, currentAvg: number, totalVotes: number }) => {
    const myVote = myRatings[supplierId] || 0;
    return (
      <div className="flex flex-col gap-1 items-end">
        <div className="flex flex-row-reverse gap-0.5 cursor-pointer group">
          {[1, 2, 3, 4, 5].map((star) => (
            <svg key={star} onClick={() => { playSystemSound('click'); setMyRatings(prev => ({...prev, [supplierId]: star})); }} className={`w-5 h-5 transition-all active:scale-75 ${star <= (myVote || Math.round(currentAvg)) ? 'text-amber-400 drop-shadow-sm' : 'text-slate-200 hover:text-amber-200'}`} fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          ))}
        </div>
        <span className="text-[9px] font-black text-slate-400">{myVote > 0 ? 'דירגת' : `${currentAvg} (${totalVotes})`}</span>
      </div>
    );
  };

  const alertsPortal = mounted && customAlert ? createPortal(
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
  ) : null;

  return (
    <div className="flex flex-col flex-1 w-full pb-32 relative bg-transparent min-h-[100dvh]" dir="rtl" onClick={() => setOpenMenuId(null)}>
      {alertsPortal}

      <div className="px-4 mt-6 mb-5">
        <h2 className="text-2xl font-black text-slate-800 tracking-tight">שירות ותקלות</h2>
      </div>

      <div className="px-5 mb-6">
        <div className="flex bg-white/60 backdrop-blur-md p-1.5 rounded-full border border-[#1D4ED8]/10 shadow-sm relative z-10">
          {['פתוחות', 'בטיפול', 'היסטוריה', 'ספקים'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 h-10 rounded-full text-[13px] transition-all flex items-center justify-center font-bold ${activeTab === tab ? 'text-[#1D4ED8] bg-blue-50 border border-blue-100 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 w-full relative z-10 space-y-4">
        
        {/* --- Suppliers Tab --- */}
        {activeTab === 'ספקים' && (
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
                      <a href={formatWhatsAppLink(supplier.phone)} target="_blank" rel="noopener noreferrer" className="w-11 h-11 bg-[#25D366] text-white rounded-xl flex items-center justify-center transition active:scale-95 shadow-sm shrink-0">
                         <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                      </a>
                      <a href={`tel:${supplier.phone}`} onClick={() => playSystemSound('click')} className="w-11 h-11 bg-[#1D4ED8] text-white rounded-xl flex items-center justify-center transition active:scale-95 shadow-sm shrink-0">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
                      </a>
                    </div>
                  </div>
                </div>
              ))}
              {suppliers.filter(s => s.type === supplierTab).length === 0 && (
                <div className="p-8 text-center text-sm font-bold text-slate-400">אין ספקים בקטגוריה זו.</div>
              )}
            </div>
          </div>
        )}

        {/* --- Tickets View --- */}
        {activeTab !== 'ספקים' && isLoading && (
          <div className="text-center py-20"><div className="w-12 h-12 border-4 border-[#1D4ED8]/20 border-t-[#1D4ED8] rounded-full animate-spin mx-auto"></div></div>
        )}

        {activeTab !== 'ספקים' && !isLoading && filteredTickets.length === 0 && (
          <div className="text-center py-20 bg-white/60 backdrop-blur-xl rounded-[2rem] border border-[#1D4ED8]/10 shadow-sm animate-in fade-in">
            <p className="font-black text-xl text-slate-700">הכל תקין בבניין ✨</p>
            <p className="text-sm font-medium text-slate-500 mt-2">אין תקלות מדווחות בקטגוריה זו.</p>
          </div>
        )}

        {activeTab !== 'ספקים' && !isLoading && filteredTickets.length > 0 && (
          filteredTickets.map(ticket => {
            const ticketAnalysis = analyzeTicketAI(ticket.description || ticket.title || '', suppliers);
            const matchedSupplier = ticketAnalysis.assignedSupplier;
            
            return (
              <div key={ticket.id} className={`bg-white/90 backdrop-blur-xl rounded-[2rem] p-5 mb-5 relative transition-all duration-300 ${ticket.is_pinned ? 'border-2 border-[#1D4ED8] shadow-[0_0_15px_rgba(29,78,216,0.4)]' : 'border border-[#1D4ED8]/10 shadow-[0_8px_30px_rgba(29,78,216,0.04)]'} ${openMenuId === ticket.id ? 'z-50' : 'z-10'}`}>
                
                {/* Connected Top Badges */}
                <div className="absolute top-0 right-0 flex overflow-hidden rounded-bl-[1.5rem] rounded-tr-[2rem] shadow-sm z-10 border-b border-l border-white/20">
                  <div className={`px-4 py-1.5 text-white text-[10px] font-black ${ticket.status === 'פתוח' ? 'bg-[#1D4ED8]' : ticket.status === 'בטיפול' ? 'bg-orange-500' : 'bg-[#10B981]'}`}>{ticket.status}</div>
                  <div className="px-3 py-1.5 bg-blue-50 text-[#1D4ED8] text-[10px] font-black border-r border-[#1D4ED8]/10">{ticket.category || ticketAnalysis.category}</div>
                  {(ticket.urgency === 'high' || ticketAnalysis.urgency === 'high') && (
                    <div className="px-3 py-1.5 bg-rose-50 text-rose-600 text-[10px] font-black border-r border-rose-100/50 animate-pulse">דחוף</div>
                  )}
                </div>

                <div className="flex justify-between items-start pt-7 pr-1">
                  <div className="flex-1">
                    <h3 className="text-[16px] font-black text-slate-800 leading-tight mb-2.5 flex items-center gap-1.5">
                      {ticket.is_pinned && <svg className="w-4 h-4 text-[#1D4ED8] shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"></path></svg>}
                      {ticket.title || ticketAnalysis.summary}
                    </h3>
                    
                    <div className="flex items-center gap-2 mb-1.5">
                      <img src={ticket.profiles?.avatar_url || `https://api.dicebear.com/8.x/initials/svg?seed=${ticket.profiles?.full_name}`} className="w-7 h-7 rounded-full object-cover shadow-sm border border-slate-200" alt="avatar" />
                      <div className="flex flex-col">
                        <span className="text-[13px] font-black text-slate-700 leading-none">{ticket.profiles?.full_name}</span>
                        <span className="text-[9px] font-bold text-slate-400 mt-0.5">{new Date(ticket.created_at).toLocaleDateString('he-IL')} • דירה {ticket.profiles?.apartment || '-'}</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Three Dots Menu - No borders, just floating dots in the top left */}
                  {isAdmin && (
                    <div className="absolute top-3 left-3 z-20">
                      <button onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === ticket.id ? null : ticket.id); }} className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-[#1D4ED8] transition-colors active:scale-95">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"></path></svg>
                      </button>
                      
                      {openMenuId === ticket.id && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)}></div>
                          <div className="absolute left-0 top-10 w-[170px] bg-white/95 backdrop-blur-xl border border-slate-100 shadow-[0_15px_50px_rgba(0,0,0,0.15)] rounded-2xl z-[150] py-1.5 animate-in zoom-in-95">
                            <button onClick={() => handleShareWhatsAppTicket(ticket)} className="w-full text-right px-4 h-11 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-3 border-b border-slate-100/50"><svg className="w-4 h-4 text-[#25D366]" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>שיתוף לוואטסאפ</button>
                            <button onClick={() => handleTogglePin(ticket)} className="w-full text-right px-4 h-11 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-3 border-b border-slate-100/50"><svg className="w-4 h-4 text-[#1D4ED8]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"></path></svg>{ticket.is_pinned ? 'ביטול נעיצה' : 'נעץ הודעה'}</button>
                            {ticket.status === 'פתוח' && <button onClick={() => handleUpdateStatus(ticket.id, 'בטיפול')} className="w-full text-right px-4 h-11 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-3 border-b border-slate-100/50"><svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>סמן בטיפול</button>}
                            {ticket.status !== 'טופל' && <button onClick={() => handleUpdateStatus(ticket.id, 'טופל')} className="w-full text-right px-4 h-11 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-3 border-b border-slate-100/50"><svg className="w-4 h-4 text-[#10B981]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"></path></svg>סמן כטופל</button>}
                            <button onClick={() => handleDeleteTicket(ticket.id)} className="w-full text-right px-4 h-11 text-xs font-bold text-slate-700 hover:bg-rose-50 flex items-center gap-3"><svg className="w-4 h-4 text-rose-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>מחיקת תקלה</button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>

                <div className="bg-[#F8FAFC]/80 p-3.5 rounded-2xl border border-[#1D4ED8]/5 mt-2 shadow-sm">
                  <p className="text-xs font-medium text-slate-600 leading-relaxed">{ticket.description}</p>
                </div>

                {matchedSupplier && ticket.status !== 'טופל' && (
                  <div className="bg-[#1D4ED8]/5 rounded-2xl p-3 border border-[#1D4ED8]/10 flex items-center justify-between mt-3 shadow-sm">
                    <div className="flex flex-col justify-center">
                      <span className="text-[10px] font-black text-[#1D4ED8] mb-0.5">בעל מקצוע</span>
                      <span className="text-xs font-bold text-slate-800">{matchedSupplier.name}</span>
                    </div>
                    <div className="flex gap-2">
                      <a href={formatWhatsAppLink(matchedSupplier.phone)} target="_blank" rel="noopener noreferrer" className="w-9 h-9 bg-[#25D366] text-white rounded-xl flex items-center justify-center transition active:scale-95 shadow-sm shrink-0">
                         <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                      </a>
                      <a href={`tel:${matchedSupplier.phone}`} onClick={() => playSystemSound('click')} className="w-9 h-9 bg-[#1D4ED8] text-white rounded-xl flex items-center justify-center transition active:scale-95 shadow-sm shrink-0">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
                      </a>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Shared Custom FAB Component */}
      {activeTab !== 'היסטוריה' && (
        <button
          onClick={() => { playSystemSound('click'); activeTab === 'ספקים' ? setIsSupplierModalOpen(true) : setIsTicketModalOpen(true); }}
          className="fixed bottom-24 left-6 z-40 bg-white/90 backdrop-blur-md border border-[#1D4ED8]/20 text-slate-800 pl-4 pr-1.5 py-1.5 rounded-full shadow-[0_8px_30px_rgba(29,78,216,0.15)] hover:scale-105 active:scale-95 transition flex items-center gap-2 group flex-row-reverse"
        >
          <div className="bg-[#1D4ED8] text-white w-10 h-10 flex items-center justify-center rounded-full shadow-md">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m7-7H5"></path></svg>
          </div>
          <span className="font-black text-xs text-[#1D4ED8]">
            {activeTab === 'ספקים' ? 'איש מקצוע' : 'תקלה חדשה'}
          </span>
        </button>
      )}

      {/* --- Ticket & Supplier Modal with Smooth Swipe-to-Close --- */}
      {(isTicketModalOpen || isSupplierModalOpen) && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-end justify-center touch-none overscroll-none" 
          onTouchStart={onTouchStart} 
          onTouchMove={onTouchMove} 
          onTouchEnd={onTouchEnd} 
          onClick={(e) => { if(e.target === e.currentTarget) { setIsTicketModalOpen(false); setIsSupplierModalOpen(false); setTranslateY(0); }}}
        >
          <div style={{ transform: `translateY(${translateY}px)` }} className="bg-white w-full rounded-t-[2.5rem] p-6 pb-12 shadow-2xl transition-transform duration-75 ease-out">
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-8 cursor-grab active:cursor-grabbing"></div>
            <h2 className="text-2xl font-black text-slate-800 mb-6">{isTicketModalOpen ? 'דיווח תקלה' : 'הוספת ספק'}</h2>
            <form onSubmit={isTicketModalOpen ? handleSubmitTicket : handleAddSupplier} className="space-y-4">
              {isTicketModalOpen ? (
                <div className="relative">
                  <textarea 
                    required 
                    value={newTicketText} 
                    onChange={handleTicketTyping} 
                    placeholder="תאר את התקלה..." 
                    className="w-full bg-[#F8FAFC] border border-slate-200 rounded-[1.5rem] p-5 pb-16 text-sm font-bold outline-none focus:border-[#1D4ED8] shadow-inner resize-none min-h-[160px]" 
                  />
                  <div className="absolute bottom-4 left-4 right-4 flex gap-2">
                    <button type="button" onClick={() => setManualUrgency('high')} className={`flex-1 h-10 rounded-xl text-xs font-black transition-all border ${manualUrgency === 'high' ? 'bg-rose-500 text-white border-rose-500 shadow-md' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>דחוף</button>
                    <button type="button" onClick={() => setManualUrgency('medium')} className={`flex-1 h-10 rounded-xl text-xs font-black transition-all border ${manualUrgency === 'medium' ? 'bg-orange-500 text-white border-orange-500 shadow-md' : 'bg-orange-50 text-orange-600 border-orange-100'}`}>רגיל</button>
                    <button type="button" onClick={() => setManualUrgency('low')} className={`flex-1 h-10 rounded-xl text-[11px] font-black transition-all border ${manualUrgency === 'low' ? 'bg-slate-700 text-white border-slate-700 shadow-md' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>לא דחוף</button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <input required placeholder="שם הספק..." value={newSupplier.name} onChange={e => setNewSupplier({...newSupplier, name: e.target.value})} className="w-full h-14 bg-slate-50 border border-slate-200 rounded-2xl px-4 text-sm font-bold outline-none focus:border-[#1D4ED8]" />
                  <input required placeholder="טלפון..." value={newSupplier.phone} onChange={e => setNewSupplier({...newSupplier, phone: e.target.value})} className="w-full h-14 bg-slate-50 border border-slate-200 rounded-2xl px-4 text-sm font-bold outline-none focus:border-[#1D4ED8]" />
                  <select value={newSupplier.category} onChange={e => setNewSupplier({...newSupplier, category: e.target.value})} className="w-full h-14 bg-slate-50 border border-slate-200 rounded-2xl px-4 text-sm font-bold outline-none focus:border-[#1D4ED8]"><option>אינסטלציה</option><option>חשמל</option><option>מעליות</option><option>ניקיון</option></select>
                </div>
              )}
              <button type="submit" disabled={isSubmitting} className="w-full h-16 bg-[#1D4ED8] text-white font-black rounded-2xl shadow-lg active:scale-95 transition-all text-lg">{isSubmitting ? 'שולח...' : 'אישור ושמירה'}</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

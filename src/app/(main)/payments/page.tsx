'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import { playSystemSound } from '../../../components/providers/AppManager'

export default function PaymentsPage() {
  const [profile, setProfile] = useState<any>(null)
  const [building, setBuilding] = useState<any>(null)
  const [payments, setPayments] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<'pending' | 'approval' | 'history'>('pending')
  const [expandedTabs, setExpandedTabs] = useState<Record<string, boolean>>({})
  
  const [isCreating, setIsCreating] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newAmount, setNewAmount] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [aiInsight, setAiInsight] = useState<string>('')
  const [isAiLoading, setIsAiLoading] = useState(true)

  const [isShareMenuOpen, setIsShareMenuOpen] = useState(false)
  const [payingItem, setPayingItem] = useState<any | null>(null)
  const [paymentFlowStep, setPaymentFlowStep] = useState<'select' | 'new_card' | 'processing' | 'success'>('select')
  const [savedCards, setSavedCards] = useState<any[]>([])
  const [newCardDetails, setNewCardDetails] = useState({ number: '', expiry: '', cvv: '', saveCard: true })

  const [customAlert, setCustomAlert] = useState<{ title: string, message: string, type: 'success' | 'error' | 'info' } | null>(null)
  const [customConfirm, setCustomConfirm] = useState<{ title: string, message: string, onConfirm: () => void } | null>(null)

  const [activeActionMenu, setActiveActionMenu] = useState<any | null>(null)
  const [editingPaymentData, setEditingPaymentData] = useState<{ id: string, title: string, amount: string } | null>(null)
  const [toastId, setToastId] = useState<string | null>(null)
  
  const [pressTimer, setPressTimer] = useState<any>(null)

  const isAdmin = profile?.role === 'admin'

  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (prof) {
      setProfile(prof)
      if (prof.saved_payment_methods) setSavedCards(prof.saved_payment_methods)

      if (prof.building_id) {
        const { data: bld } = await supabase.from('buildings').select('*').eq('id', prof.building_id).single()
        if (bld) setBuilding(bld)
      }

      const query = supabase.from('payments')
        .select('*, profiles!payments_payer_id_fkey(full_name, apartment)')
        .neq('status', 'canceled') // מסתיר תשלומים מבוטלים מהתצוגה
        .order('created_at', { ascending: false })
      
      if (prof.role === 'admin') query.eq('building_id', prof.building_id)
      else query.eq('payer_id', prof.id)
      
      const { data: fetchedPayments } = await query
      
      if (fetchedPayments) {
        setPayments(fetchedPayments)

        // --- סנכרון אוטומטי חכם (ללא החזרת מבוטלים) ---
        if (prof.role !== 'admin') {
          const { data: activeBuildingPayments } = await supabase
            .from('payments')
            .select('title, amount')
            .eq('building_id', prof.building_id)
            .eq('status', 'pending');
            
          if (activeBuildingPayments && activeBuildingPayments.length > 0) {
            const uniqueTitles = Array.from(new Set(activeBuildingPayments.map(p => p.title)));
            
            // שולף גם היסטוריית מבוטלים כדי לא ליצור להם מחדש את הדרישה שמחקנו
            const { data: myFullHistory } = await supabase.from('payments').select('title').eq('payer_id', prof.id);
            const myHistoryTitles = myFullHistory ? myFullHistory.map(p => p.title) : [];
            
            const missingPayments = uniqueTitles.filter(title => !myHistoryTitles.includes(title));
            
            if (missingPayments.length > 0) {
              const inserts = missingPayments.map(title => {
                const amount = activeBuildingPayments.find(p => p.title === title)?.amount || 0;
                return { payer_id: prof.id, building_id: prof.building_id, title, amount, status: 'pending' };
              });
              await supabase.from('payments').insert(inserts);
              setCustomAlert({ title: 'מעודכן! 👋', message: 'נוספו דרישות תשלום קהילתיות פתוחות, אנא הסדר אותן.', type: 'info' });
            }
          }
        }
      }
    }
  }, [])

  useEffect(() => {
    fetchData()
    const channel = supabase.channel('payments_v13')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, fetchData)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchData])

  useEffect(() => {
    const fetchAiData = async () => {
      if (!profile || payments.length === 0) return;
      setIsAiLoading(true);
      try {
        const pendingItems = payments.filter(p => p.status === 'pending');
        let promptContext = '';
        if (pendingItems.length > 0) {
          const itemNames = [...new Set(pendingItems.map(p => p.title))].join(', ');
          promptContext = isAdmin ? `ממתין לתשלום עבור: ${itemNames}` : `להסדרה עבור: ${itemNames}`;
        } else {
          promptContext = 'הכל הוסדר בהצלחה.';
        }
        const prompt = `אני ${isAdmin ? 'מנהל ועד הבית' : 'דייר'}. ${promptContext}. נסח המלצה קצרה וחיובית (עם אימוג'י), ללא שימוש במילים עדינות. עד 12 מילים.`;
        
        const res = await fetch('/api/ai/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ description: prompt }) });
        const data = await res.json();
        setAiInsight(data.title || data.text || `הניהול הפיננסי בבניין מצוין! ✨`);
      } catch (error) {
        setAiInsight(`מערכת התשלומים פעילה לשירותך. ✨`);
      } finally {
        setIsAiLoading(false);
      }
    };
    fetchAiData();
  }, [profile, payments.length, isAdmin]);

  const handlePressStart = (payment: any) => {
    const timer = setTimeout(() => {
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(50);
      setActiveActionMenu(payment);
      playSystemSound('click');
    }, 400);
    setPressTimer(timer);
  };
  const handlePressEnd = () => { if (pressTimer) clearTimeout(pressTimer); };

  const handleCreatePayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile || !isAdmin || !newTitle || !newAmount) return
    setIsSubmitting(true)
    const { data: tenants } = await supabase.from('profiles').select('id').eq('building_id', profile.building_id).neq('id', profile.id)
    if (tenants && tenants.length > 0) {
      const paymentsToInsert = tenants.map(t => ({ payer_id: t.id, building_id: profile.building_id, amount: parseFloat(newAmount), title: newTitle, status: 'pending' }))
      await supabase.from('payments').insert(paymentsToInsert)
      playSystemSound('notification'); setIsCreating(false); setNewTitle(''); setNewAmount(''); fetchData()
      setCustomAlert({ title: 'הושלם', message: 'דרישת התשלום נשלחה בהצלחה לכל הדיירים.', type: 'success' })
    }
    setIsSubmitting(false)
  }

  const handleInlineEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingPaymentData) return;
    setIsSubmitting(true)
    await supabase.from('payments').update({ title: editingPaymentData.title, amount: parseInt(editingPaymentData.amount) }).eq('id', editingPaymentData.id)
    setEditingPaymentData(null); playSystemSound('notification'); fetchData();
    setIsSubmitting(false)
  }

  const executeAction = (action: Function) => { setActiveActionMenu(null); action(); }

  const deletePayment = (paymentId: string) => {
    setCustomConfirm({
      title: 'ביטול דרישת תשלום', message: 'האם לבטל דרישת תשלום זו?',
      onConfirm: async () => { 
        // משנה סטטוס למבוטל במקום למחוק, כדי שהמערכת לא תיצור אותו שוב
        await supabase.from('payments').update({ status: 'canceled' }).eq('id', paymentId); 
        fetchData(); setCustomConfirm(null); playSystemSound('click') 
      }
    })
  }

  const markAsExempt = (paymentId: string) => {
    setCustomConfirm({
      title: 'הענקת פטור', message: 'הדייר יקבל פטור מתשלום זה. לאשר?',
      onConfirm: async () => { await supabase.from('payments').update({ status: 'exempt' }).eq('id', paymentId); fetchData(); setCustomConfirm(null); playSystemSound('notification') }
    })
  }

  const togglePinPayment = async (payment: any) => {
    const isPinned = !payment.is_pinned;
    await supabase.from('payments').update({ is_pinned: isPinned }).eq('id', payment.id);
    if (isPinned) {
      const content = `📌 **דרישת תשלום בולטת** 📌\n\nהיי שכנים! 👋 רצינו לעדכן שיש דרישת תשלום פתוחה עבור **${payment.title}**.\n\nנשמח מאוד אם תוכלו להיכנס ללשונית התשלומים באפליקציה ולהסדיר אותה כדי שנוכל להמשיך לטפח את הבניין שלנו בצורה הטובה ביותר 🏢💙\n\nתודה מראש על שיתוף הפעולה!`;
      await supabase.from('messages').insert([{ user_id: profile.id, content }]);
      playSystemSound('notification');
      setCustomAlert({ title: 'התשלום ננעץ', message: 'התשלום סומן כחשוב ונשלחה הודעה מסודרת ללוח המודעות הקהילתי.', type: 'success' })
    } else {
      playSystemSound('click');
    }
    fetchData();
  }

  const handleApprovePayment = async (paymentId: string) => {
    await supabase.from('payments').update({ status: 'paid' }).eq('id', paymentId)
    playSystemSound('notification'); fetchData()
  }

  const handleNotifyBitPayment = async (paymentId: string) => {
    await supabase.from('payments').update({ status: 'pending_approval' }).eq('id', paymentId)
    playSystemSound('click'); setCustomAlert({ title: 'עודכן בהצלחה', message: 'דיווחת ששילמת. ממתין לאישור הוועד.', type: 'info' }); fetchData()
  }

  const startPaymentFlow = (payment: any) => { setPayingItem(payment); setPaymentFlowStep('select'); setActiveActionMenu(null); }

  const processPayment = async (method: string) => {
    if (!payingItem) return
    if (method === 'bit') {
      await handleNotifyBitPayment(payingItem.id); setPayingItem(null); return;
    }
    setPaymentFlowStep('processing')
    setTimeout(async () => {
      await supabase.from('payments').update({ status: 'paid' }).eq('id', payingItem.id)
      if (method === 'new_card' && newCardDetails.saveCard) {
        const last4 = newCardDetails.number.slice(-4) || '1234'
        const newCard = { id: Date.now().toString(), type: 'visa', last4: last4, exp: newCardDetails.expiry }
        const updatedCards = [...savedCards, newCard]
        await supabase.from('profiles').update({ saved_payment_methods: updatedCards }).eq('id', profile.id)
        setSavedCards(updatedCards)
      }
      setPaymentFlowStep('success'); playSystemSound('notification'); fetchData()
    }, 2000)
  }

  const deleteSavedCard = async (cardId: string) => {
    setCustomConfirm({
      title: 'הסרת אמצעי תשלום', message: 'למחוק את כרטיס האשראי השמור?',
      onConfirm: async () => {
        const updatedCards = savedCards.filter(c => c.id !== cardId)
        await supabase.from('profiles').update({ saved_payment_methods: updatedCards }).eq('id', profile.id)
        setSavedCards(updatedCards)
        setCustomConfirm(null)
      }
    })
  }

  // --- Reports & PDF (מסך מלא, טקסט שחור, כחול המותג, לוגו מדויק) ---
  const generatePDF = (title: string, htmlContent: string) => {
    const htmlTemplate = `<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><title>${title}</title><script src="https://cdn.tailwindcss.com"></script><style>@media print { .no-print { display: none !important; } } body { font-family: system-ui, sans-serif; background-color: #f9fafb; padding: 20px; }</style></head><body class="flex flex-col min-h-screen"><div class="w-full max-w-4xl mx-auto bg-white p-12 rounded-[2rem] shadow-sm border border-gray-200 flex-1 flex flex-col">${htmlContent}<div class="mt-auto pt-10 text-center no-print"><button onclick="window.print()" class="bg-[#1D4ED8] text-white px-10 py-4 rounded-xl font-black w-full mb-4 text-lg active:scale-95 transition-transform">שמור קבלה / הדפס</button><button onclick="window.close()" class="text-gray-800 font-bold px-10 py-4 rounded-xl w-full border-2 border-gray-200 text-lg hover:bg-gray-50 active:scale-95 transition-transform">סגור</button></div></div></body></html>`
    const url = URL.createObjectURL(new Blob([htmlTemplate], { type: 'text/html;charset=utf-8' }))
    if (!window.open(url, '_blank')) setCustomAlert({ title: 'שגיאה', message: 'הדפדפן חסם את פתיחת הקבלה. אפשר חלונות קופצים.', type: 'error' })
  }

  const downloadReceipt = (payment: any) => {
    const date = new Date(payment.created_at).toLocaleDateString('he-IL')
    const receiptHtml = `<div class="text-center border-b-2 border-[#1D4ED8]/20 pb-8 mb-8 mt-4"><h1 class="text-5xl font-black text-[#1D4ED8] mb-2 tracking-tight">שכן<span class="text-[#334155]">+</span></h1><h2 class="text-2xl font-bold text-black">קבלה רשמית - ועד בית</h2><p class="text-lg text-gray-600 mt-2">${building?.name}</p></div><div class="space-y-4 text-black text-lg"><div class="flex justify-between p-4 bg-gray-50 rounded-xl"><span class="font-bold">תאריך:</span><span>${date}</span></div><div class="flex justify-between p-4 bg-gray-50 rounded-xl"><span class="font-bold">שם המשלם:</span><span>${payment.profiles?.full_name || profile?.full_name}</span></div><div class="flex justify-between p-4 bg-gray-50 rounded-xl"><span class="font-bold">עבור:</span><span>${payment.title}</span></div><div class="flex justify-between p-6 bg-[#1D4ED8]/10 rounded-2xl border border-[#1D4ED8]/30 mt-6 items-center"><span class="font-black text-xl text-black">סכום ששולם:</span><span class="font-black text-[#1D4ED8] text-4xl">₪${payment.amount}</span></div></div><div class="text-center text-gray-500 text-sm mt-10"><p>התשלום התקבל בהצלחה ונרשם בקופת הבניין.</p><p class="mt-2">אסמכתא: ${payment.id.split('-')[0].toUpperCase()}</p></div>`
    generatePDF(`קבלה_${payment.title.replace(/\s+/g, '_')}`, receiptHtml)
  }

  const generateAdminReport = () => {
    setIsShareMenuOpen(false)
    const date = new Date().toLocaleDateString('he-IL')
    let tableRows = ''
    payments.forEach(p => {
      let statusHtml = p.status === 'paid' ? '<span class="text-[#1D4ED8] font-bold">שולם</span>' : p.status === 'exempt' ? '<span class="text-gray-400">פטור</span>' : '<span class="text-black font-bold">ממתין</span>'
      tableRows += `<tr class="border-b border-gray-100"><td class="py-4 pr-2 text-black font-bold">${p.profiles?.full_name}</td><td class="py-4 text-black">${p.title}</td><td class="py-4 font-black text-left text-black">₪${p.amount}</td><td class="py-4 pl-2 text-left">${statusHtml}</td></tr>`
    })
    const reportHtml = `<div class="text-center border-b-2 border-[#1D4ED8]/20 pb-8 mb-8 mt-4"><h1 class="text-5xl font-black text-[#1D4ED8] mb-2 tracking-tight">שכן<span class="text-[#334155]">+</span></h1><h2 class="text-2xl font-bold text-black">דוח קופת ועד הבית</h2><p class="text-lg text-gray-600 mt-2">${building?.name} | הופק בתאריך: ${date}</p></div><div class="flex justify-between gap-6 mb-8 text-center"><div class="flex-1 bg-gray-50 p-6 rounded-2xl border border-gray-200"><p class="text-sm text-gray-600 font-bold uppercase mb-2">נאסף בקופה</p><p class="text-3xl font-black text-[#1D4ED8]">₪${totalCollected.toLocaleString()}</p></div><div class="flex-1 bg-gray-50 p-6 rounded-2xl border border-gray-200"><p class="text-sm text-gray-600 font-bold uppercase mb-2">נותר לגבות</p><p class="text-3xl font-black text-black">₪${totalPendingVal.toLocaleString()}</p></div></div><table class="w-full text-lg text-black text-right border-collapse"><thead><tr class="text-gray-500 border-b-2 border-gray-300"><th class="py-3 pr-2">דייר</th><th class="py-3">עבור</th><th class="py-3 text-left">סכום</th><th class="py-3 pl-2 text-left">סטטוס</th></tr></thead><tbody>${tableRows}</tbody></table>`
    generatePDF(`דוח_גבייה_${date.replace(/\//g, '-')}`, reportHtml)
  }

  const sendWhatsAppReminder = (tenantName: string, amount: number, title: string) => {
    const text = encodeURIComponent(`היי ${tenantName}, תזכורת קטנה וידידותית מוועד הבית 🏢\nנשמח אם תוכל/י להסדיר את התשלום עבור "${title}" בסך ${amount} ₪ באפליקציה.\nתודה מראש ויום מקסים! ✨`)
    window.open(`https://wa.me/?text=${text}`, '_blank')
  }

  const shareToAppChat = async () => {
    setIsShareMenuOpen(false)
    const content = `📊 **סטטוס קופת הבניין** 📊\n✅ נאסף בקופה: ₪${totalCollected.toLocaleString()}\n⏳ טרם שולם: ₪${totalPendingVal.toLocaleString()}\n\nאנו מודים לכל מי שהסדיר. נא להיכנס ללשונית "תשלומים" להסדרת יתרות. 🙏`
    await supabase.from('messages').insert([{ user_id: profile.id, content }])
    setCustomAlert({ title: 'פורסם בהצלחה', message: 'הדוח נשלח לקבוצת הצ\'אט של הבניין.', type: 'success' })
  }

  if (!profile) return null

  const pending = payments.filter(p => p.status === 'pending')
  const approvals = payments.filter(p => p.status === 'pending_approval')
  const history = payments.filter(p => p.status === 'paid')
  const exempts = payments.filter(p => p.status === 'exempt')

  const totalCollected = history.reduce((sum, p) => sum + p.amount, 0)
  const totalPendingVal = [...pending, ...approvals].reduce((sum, p) => sum + p.amount, 0)
  const totalTarget = totalCollected + totalPendingVal + exempts.reduce((sum, p) => sum + p.amount, 0)

  const toggleExpand = (tab: string) => setExpandedTabs(prev => ({ ...prev, [tab]: !prev[tab] }))
  const showToast = (id: string) => { setToastId(id); setTimeout(() => setToastId(null), 2000); }

  const formatAmount = (amount: number) => (
    <div className="flex items-baseline gap-1" dir="ltr">
      <span className="text-[11px] text-slate-400 font-bold mb-0.5">₪</span>
      <span>{amount.toLocaleString()}</span>
    </div>
  )

  const renderList = (list: any[], type: 'pending' | 'approval' | 'history') => {
    if (list.length === 0) return <div className="text-center py-10 text-slate-400 font-bold text-sm bg-white/40 rounded-2xl border border-white/50 shadow-sm">אין תשלומים בקטגוריה זו</div>
    
    const sortedList = [...list].sort((a, b) => {
      if (a.is_pinned && !b.is_pinned) return -1;
      if (!a.is_pinned && b.is_pinned) return 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    })

    const isExpanded = expandedTabs[type] || false
    const displayList = isExpanded ? sortedList : sortedList.slice(0, 5)

    return (
      <div className="space-y-3">
        {displayList.map(p => (
          <div key={p.id} className="relative">
            {toastId === p.id && (
              <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-[#E3F2FD] border border-[#BFDBFE] text-[#1D4ED8] text-[11px] font-black px-3 py-1.5 rounded-full shadow-sm animate-in slide-in-from-bottom-2 pointer-events-none whitespace-nowrap z-50">
                לחיצה ארוכה לאפשרויות
              </div>
            )}
            
            <div 
              onTouchStart={() => handlePressStart(p)} onTouchEnd={handlePressEnd} onTouchMove={handlePressEnd}
              onClick={() => showToast(p.id)}
              className={`bg-white/70 backdrop-blur-xl border p-4 rounded-2xl flex items-center justify-between transition-transform active:scale-[0.98] select-none [-webkit-touch-callout:none] overflow-hidden ${p.is_pinned ? 'border-[#1D4ED8]/60 shadow-[0_0_20px_rgba(29,78,216,0.2)] bg-[#1D4ED8]/5' : 'border-white/80 shadow-sm'}`}
            >
              {p.is_pinned && (
                <div className="absolute top-0 right-4 bg-[#1D4ED8] text-white text-[9px] font-black px-2 py-0.5 rounded-b-md shadow-sm z-10 flex items-center gap-1">
                  <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24"><path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"></path></svg>
                </div>
              )}

              <div className="flex-1 pr-1">
                <h4 className={`font-black text-sm mt-1 ${p.is_pinned ? 'text-[#1D4ED8]' : 'text-slate-800'}`}>{p.title}</h4>
                <p className="text-[10px] font-bold text-slate-500 mt-0.5">
                  {isAdmin ? `${p.profiles?.full_name} דירה ${p.profiles?.apartment || '?'}` : type === 'pending' ? 'ממתין לתשלום' : type === 'approval' ? 'ממתין לאישור ועד' : 'שולם בהצלחה'}
                </p>
              </div>
              <div className="text-left shrink-0 flex flex-col items-end gap-2">
                <div className={`text-base font-black flex items-center justify-end ${type === 'history' ? 'text-[#059669]' : 'text-slate-800'}`}>{formatAmount(p.amount)}</div>
                
                {type === 'pending' && !isAdmin && <button onClick={(e) => { e.stopPropagation(); startPaymentFlow(p); }} className="bg-[#1D4ED8] text-white text-[9px] font-black px-4 py-2 rounded-xl shadow-sm active:scale-95 transition">לתשלום</button>}
                {type === 'approval' && isAdmin && <button onClick={(e) => { e.stopPropagation(); handleApprovePayment(p.id); }} className="bg-[#059669] text-white text-[9px] font-black px-4 py-2 rounded-xl shadow-sm active:scale-95 transition">אשר תשלום</button>}
                {type === 'history' && !isAdmin && (
                  <button onClick={(e) => { e.stopPropagation(); downloadReceipt(p); }} className="text-[9px] font-bold text-[#1D4ED8] hover:text-[#0044cc] transition flex items-center gap-1 bg-[#1D4ED8]/10 px-2.5 py-1.5 rounded-lg">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg> קבלה
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
        {list.length > 5 && (
          <button onClick={() => toggleExpand(type)} className="w-full flex items-center justify-center gap-1 text-[#1D4ED8] py-3 bg-white/40 rounded-2xl shadow-sm border border-white/50 hover:bg-white/80 transition mt-2">
            <span className="text-[11px] font-black">{isExpanded ? 'הצג פחות' : `הצג עוד ${list.length - 5}`}</span>
            <svg className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7"></path></svg>
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 w-full pb-32 bg-transparent min-h-screen relative" dir="rtl">
      
      <div className="px-6 pt-6 pb-2 flex justify-between items-center sticky top-0 z-30">
        <h2 className="text-2xl font-black text-slate-800 drop-shadow-sm">תשלומים</h2>
      </div>

      <div className="px-6 space-y-5 mt-4">
        
        {/* כרטיס האשראי הקהילתי (ללא מילים באנגלית, ללא שבב, ללא פס התקדמות) */}
        <div className="bg-gradient-to-br from-[#0e1e2d] to-[#1D4ED8] p-6 pt-7 rounded-[2rem] text-white shadow-xl relative overflow-hidden border border-white/10">
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -ml-10 -mb-10 pointer-events-none"></div>
          
          <div className="relative z-10">
            <p className="text-[11px] text-white/70 font-bold mb-1">{isAdmin ? 'קופת ועד הבית' : 'סך הכל שילמתי'}</p>
            <div className="text-4xl font-black font-mono tracking-tight mb-8 flex items-end gap-1.5" dir="ltr">
               <span className="text-2xl text-white/60 mb-1">₪</span>
               <span>{totalCollected.toLocaleString()}</span>
            </div>
          </div>

          <div className="flex justify-between items-end border-t border-white/10 pt-4 relative z-10">
             <div>
               <p className="text-[10px] text-white/60 font-bold mb-0.5">יעד לגבייה</p>
               <p className="text-sm font-bold text-white flex items-center gap-1" dir="ltr"><span className="text-[10px] text-white/60">₪</span>{totalTarget.toLocaleString()}</p>
             </div>
             <div className="text-right">
               <p className="text-[10px] text-white/60 font-bold mb-0.5">נותר לגבות</p>
               <p className="text-sm font-bold text-orange-300 flex items-center justify-end gap-1" dir="ltr"><span className="text-[10px] text-orange-300/70">₪</span>{totalPendingVal.toLocaleString()}</p>
             </div>
          </div>
        </div>

        {/* שורת פעולות מהירות לוועד (דרישת תשלום | דוחות) */}
        {isAdmin && (
          <div className="flex gap-3">
            <button onClick={() => setIsCreating(true)} className="flex-1 bg-white/70 backdrop-blur-md border border-white shadow-sm text-[#1D4ED8] font-black text-sm py-3.5 rounded-2xl active:scale-95 transition flex items-center justify-center gap-2">
               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"></path></svg>
               דרישת תשלום
            </button>
            <button onClick={() => setIsShareMenuOpen(true)} className="flex-1 bg-white/70 backdrop-blur-md border border-white shadow-sm text-slate-600 font-black text-sm py-3.5 rounded-2xl active:scale-95 transition flex items-center justify-center gap-2">
               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
               דוחות ושקיפות
            </button>
          </div>
        )}

        {/* AI Insight */}
        <div className="bg-white/60 backdrop-blur-md border border-white/50 p-4 rounded-2xl flex items-center gap-4 shadow-sm">
          <div className="w-10 h-10 rounded-full bg-[#1D4ED8] flex items-center justify-center shrink-0 text-white shadow-sm">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" /></svg>
          </div>
          <p className="text-xs font-bold text-slate-700 leading-relaxed">{isAiLoading ? 'מעבד נתונים...' : aiInsight}</p>
        </div>

        {/* מערכת טאבים בצורת גלולה מרחפת - ללא סוגריים במספרים */}
        <div className="space-y-4 pt-2">
          <div className="flex bg-white/60 backdrop-blur-md p-1.5 rounded-full border border-white shadow-sm">
            <button onClick={() => setActiveTab('pending')} className={`flex-1 py-2.5 text-xs rounded-full transition-all ${activeTab === 'pending' ? 'text-[#1D4ED8] font-black bg-white shadow-sm' : 'text-slate-500 font-bold hover:text-slate-700'}`}>
              לתשלום {pending.length > 0 ? pending.length : ''}
            </button>
            {isAdmin && (
              <button onClick={() => setActiveTab('approval')} className={`flex-1 py-2.5 text-xs rounded-full transition-all ${activeTab === 'approval' ? 'text-[#1D4ED8] font-black bg-white shadow-sm' : 'text-slate-500 font-bold hover:text-slate-700'}`}>
                בבדיקה {approvals.length > 0 ? approvals.length : ''}
              </button>
            )}
            <button onClick={() => setActiveTab('history')} className={`flex-1 py-2.5 text-xs rounded-full transition-all ${activeTab === 'history' ? 'text-[#1D4ED8] font-black bg-white shadow-sm' : 'text-slate-500 font-bold hover:text-slate-700'}`}>
              שולמו {history.length > 0 ? history.length : ''}
            </button>
          </div>

          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            {activeTab === 'pending' && renderList(pending, 'pending')}
            {activeTab === 'approval' && renderList(approvals, 'approval')}
            {activeTab === 'history' && renderList(history, 'history')}
          </div>
        </div>
      </div>

      {/* --- מודל דרישת תשלום --- */}
      {isCreating && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex justify-center items-end">
          <div className="bg-white/95 backdrop-blur-xl w-full max-w-md rounded-t-[2rem] p-6 pb-8 shadow-2xl animate-in slide-in-from-bottom-10 border-t border-white/50">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-black text-xl text-slate-800">דרישת תשלום חדשה</h3>
              <button onClick={() => setIsCreating(false)} className="p-2 bg-gray-100 rounded-full text-slate-600 hover:bg-gray-200 transition">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            <form onSubmit={handleCreatePayment} className="space-y-4">
              <div>
                <input type="text" required value={newTitle} onChange={e => setNewTitle(e.target.value)} className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3.5 text-sm font-bold outline-none focus:border-[#1D4ED8] transition shadow-sm text-slate-800" placeholder="עבור מה? (לדוג': ועד חודש מאי)" />
              </div>
              <div>
                <input type="number" required value={newAmount} onChange={e => setNewAmount(e.target.value)} className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3.5 text-sm outline-none focus:border-[#1D4ED8] transition shadow-sm text-slate-800 font-black text-lg" placeholder="סכום פר דייר (₪)" />
              </div>
              <button type="submit" disabled={isSubmitting} className="w-full bg-[#1D4ED8] text-white font-bold py-4 rounded-xl shadow-md mt-4 active:scale-95 transition disabled:opacity-50 text-base">
                {isSubmitting ? 'משדר לכולם...' : 'שלח לכל הבניין'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- Bottom Sheet: תפריט פעולות (לחיצה ארוכה) --- */}
      {activeActionMenu && (
        <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex justify-center items-end" onClick={() => setActiveActionMenu(null)}>
          <div className="bg-white/95 backdrop-blur-xl w-full max-w-md rounded-t-[2rem] p-6 pb-12 shadow-2xl animate-in slide-in-from-bottom-10 border-t border-white/50" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6"></div>
            
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="font-black text-xl text-slate-800">{activeActionMenu.title}</h3>
                <div className="text-xs text-slate-500 font-bold mt-1 flex items-baseline gap-1" dir="ltr">
                  <span>{activeActionMenu.profiles?.full_name || profile?.full_name}</span> <span className="mx-1">•</span> <span className="text-[10px]">₪</span><span>{activeActionMenu.amount}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-5 mt-2">
              {isAdmin && activeActionMenu.status === 'pending' && (
                <>
                  <button onClick={() => { setEditingPaymentData({ id: activeActionMenu.id, title: activeActionMenu.title, amount: activeActionMenu.amount.toString() }); setActiveActionMenu(null); }} className="flex flex-col items-center gap-2 group active:scale-95 transition">
                    <div className="w-14 h-14 rounded-full bg-blue-50 text-[#1D4ED8] flex items-center justify-center shadow-sm border border-blue-100"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg></div>
                    <span className="text-[10px] font-black text-slate-600">עריכה</span>
                  </button>
                  <button onClick={() => executeAction(() => sendWhatsAppReminder(activeActionMenu.profiles?.full_name, activeActionMenu.amount, activeActionMenu.title))} className="flex flex-col items-center gap-2 group active:scale-95 transition">
                    <div className="w-14 h-14 rounded-full bg-[#1D4ED8]/10 text-[#1D4ED8] flex items-center justify-center shadow-sm border border-[#1D4ED8]/20"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg></div>
                    <span className="text-[10px] font-black text-slate-600">תזכורת</span>
                  </button>
                  <button onClick={() => executeAction(() => togglePinPayment(activeActionMenu))} className="flex flex-col items-center gap-2 group active:scale-95 transition">
                    <div className={`w-14 h-14 rounded-full flex items-center justify-center shadow-sm border ${activeActionMenu.is_pinned ? 'bg-[#1D4ED8] text-white border-[#1D4ED8]' : 'bg-indigo-50 text-[#1D4ED8] border-indigo-100'}`}>
                      <svg className="w-6 h-6" fill={activeActionMenu.is_pinned ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"></path></svg>
                    </div>
                    <span className="text-[10px] font-black text-slate-600">{activeActionMenu.is_pinned ? 'בטל נעיצה' : 'נעיצה לפיד'}</span>
                  </button>
                  <button onClick={() => executeAction(() => markAsExempt(activeActionMenu.id))} className="flex flex-col items-center gap-2 group active:scale-95 transition">
                    <div className="w-14 h-14 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center shadow-sm border border-gray-200"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></div>
                    <span className="text-[10px] font-black text-slate-600">פטור</span>
                  </button>
                  <button onClick={() => executeAction(() => deletePayment(activeActionMenu.id))} className="flex flex-col items-center gap-2 group active:scale-95 transition">
                    <div className="w-14 h-14 rounded-full bg-red-50 text-red-500 flex items-center justify-center shadow-sm border border-red-100"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></div>
                    <span className="text-[10px] font-black text-slate-600">מחיקה</span>
                  </button>
                </>
              )}

              {isAdmin && activeActionMenu.status === 'pending_approval' && (
                <button onClick={() => executeAction(() => handleApprovePayment(activeActionMenu.id))} className="flex flex-col items-center gap-2 group active:scale-95 transition">
                  <div className="w-16 h-16 rounded-full bg-[#059669]/10 text-[#059669] flex items-center justify-center shadow-sm border border-[#059669]/20"><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"></path></svg></div>
                  <span className="text-xs font-black text-[#059669]">אשר תשלום</span>
                </button>
              )}

              {!isAdmin && activeActionMenu.status === 'pending' && (
                <>
                  <button onClick={() => executeAction(() => startPaymentFlow(activeActionMenu))} className="flex flex-col items-center gap-2 group active:scale-95 transition">
                    <div className="w-14 h-14 rounded-full bg-[#1D4ED8]/10 text-[#1D4ED8] flex items-center justify-center shadow-sm border border-[#1D4ED8]/20"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path></svg></div>
                    <span className="text-[10px] font-black text-[#1D4ED8]">תשלום אשראי</span>
                  </button>
                  <button onClick={() => executeAction(() => processPayment('bit'))} className="flex flex-col items-center gap-2 group active:scale-95 transition">
                    <div className="w-14 h-14 rounded-full bg-[#25D366]/10 text-[#25D366] flex items-center justify-center shadow-sm border border-[#25D366]/20"><svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"></path></svg></div>
                    <span className="text-[10px] font-black text-[#25D366]">ביט / מזומן</span>
                  </button>
                </>
              )}

              {activeActionMenu.status === 'paid' && (
                <button onClick={() => executeAction(() => downloadReceipt(activeActionMenu))} className="flex flex-col items-center gap-2 group active:scale-95 transition">
                  <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center shadow-sm border border-slate-200"><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg></div>
                  <span className="text-xs font-black text-slate-700">הורדת קבלה</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- חלון עריכה מהירה Inline Edit --- */}
      {editingPaymentData && (
        <div className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm flex justify-center items-center p-4">
          <form onSubmit={handleInlineEditSubmit} className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95">
            <h3 className="text-xl font-black text-slate-800 mb-4">עריכת תשלום</h3>
            <input type="text" required value={editingPaymentData.title} onChange={e => setEditingPaymentData({...editingPaymentData, title: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 mb-3 text-sm outline-none focus:border-[#1D4ED8]" />
            <input type="number" required value={editingPaymentData.amount} onChange={e => setEditingPaymentData({...editingPaymentData, amount: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 mb-5 text-sm outline-none focus:border-[#1D4ED8] font-black" />
            <div className="flex gap-3">
              <button type="button" onClick={() => setEditingPaymentData(null)} className="flex-1 bg-gray-100 text-slate-600 font-bold py-3.5 rounded-xl hover:bg-gray-200 transition">ביטול</button>
              <button type="submit" disabled={isSubmitting} className="flex-1 bg-[#1D4ED8] text-white font-bold py-3.5 rounded-xl transition shadow-sm">שמור</button>
            </div>
          </form>
        </div>
      )}

      {/* --- תפריט שיתוף מנהל --- */}
      {isShareMenuOpen && (
        <div className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm flex justify-center items-end">
          <div className="bg-white/95 backdrop-blur-xl w-full max-w-md rounded-t-[2rem] p-6 pb-12 shadow-2xl animate-in slide-in-from-bottom-10 border-t border-white/50">
            <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6"></div>
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-black text-xl text-slate-800">דוחות ושקיפות</h3>
              <button onClick={() => setIsShareMenuOpen(false)} className="p-2 bg-gray-50 rounded-xl text-slate-500 hover:text-[#1D4ED8] transition shadow-sm border border-gray-100">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            
            <div className="flex flex-col gap-3">
              <button onClick={generateAdminReport} className="w-full flex items-center justify-between bg-white border border-gray-100 p-4 rounded-xl hover:border-[#1D4ED8]/30 transition active:scale-95 shadow-sm group">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#1D4ED8]/10 text-[#1D4ED8] flex items-center justify-center group-hover:bg-[#1D4ED8] group-hover:text-white transition">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                  </div>
                  <div className="text-right">
                    <h4 className="font-bold text-sm text-slate-800">הפקת דוח גבייה (PDF)</h4>
                    <p className="text-[10px] font-bold text-slate-500">מסמך מרוכז ונוח לשמירה והדפסה.</p>
                  </div>
                </div>
              </button>
              
              <button onClick={shareToAppChat} className="w-full flex items-center justify-between bg-white border border-gray-100 p-4 rounded-xl hover:border-[#1D4ED8]/30 transition active:scale-95 shadow-sm group">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center group-hover:bg-slate-200 transition">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>
                  </div>
                  <div className="text-right">
                    <h4 className="font-bold text-sm text-slate-800">פרסום בקבוצת האפליקציה</h4>
                    <p className="text-[10px] font-bold text-slate-500">הדוח יפורסם אוטומטית בצ'אט הבניין.</p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- זרימת תשלום צ'קאאוט מאובטחת --- */}
      {payingItem && (
        <div className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm flex justify-center items-end">
          <div className="bg-white/95 backdrop-blur-xl w-full max-w-md rounded-t-[2rem] p-6 pb-12 shadow-2xl animate-in slide-in-from-bottom-10 min-h-[50vh] border-t border-white/50">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-black text-xl text-slate-800">הסדרת תשלום</h3>
              <button onClick={() => {setPayingItem(null); setPaymentFlowStep('select');}} className="p-2 bg-gray-50 border border-gray-100 rounded-xl text-slate-800 hover:bg-gray-100 transition active:scale-95 shadow-sm">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>

            <div className="bg-white rounded-2xl p-4 mb-6 flex justify-between items-center border border-gray-100 shadow-sm">
              <div>
                <p className="text-[10px] text-slate-400 font-bold mb-0.5 uppercase tracking-wider">עבור:</p>
                <p className="text-sm font-black text-slate-800">{payingItem.title}</p>
              </div>
              <div className="text-left">
                <p className="text-[10px] text-slate-400 font-bold mb-0.5 uppercase tracking-wider">לתשלום:</p>
                <div className="text-2xl font-black text-[#1D4ED8] flex items-end justify-end gap-1" dir="ltr"><span className="text-[12px] text-slate-400 mb-0.5">₪</span>{payingItem.amount}</div>
              </div>
            </div>

            {paymentFlowStep === 'select' && (
              <div className="flex flex-col gap-3">
                <p className="text-[10px] font-black text-slate-400 tracking-wider uppercase mb-1">אמצעי תשלום</p>
                
                {savedCards.length > 0 && savedCards.map(card => (
                  <div key={card.id} className="w-full flex items-center justify-between bg-white border border-gray-100 p-4 rounded-xl shadow-sm hover:border-[#1D4ED8]/50 transition">
                    <button onClick={() => processPayment('saved_card')} className="flex items-center gap-3 flex-1 text-right">
                      <div className="w-10 h-6 bg-slate-800 rounded shrink-0 flex items-center justify-center relative overflow-hidden shadow-sm">
                         <div className="absolute top-0 right-0 w-8 h-8 bg-white/10 rounded-full -mr-4 -mt-4"></div>
                         <span className="text-[8px] font-black text-white tracking-widest italic">VISA</span>
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-800 font-mono tracking-widest">**** {card.last4}</p>
                      </div>
                    </button>
                    <button onClick={() => deleteSavedCard(card.id)} className="p-2 text-gray-300 hover:text-red-500 transition hover:bg-red-50 rounded-lg">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                  </div>
                ))}

                <button onClick={() => setPaymentFlowStep('new_card')} className="w-full flex items-center justify-center gap-2 bg-white text-[#1D4ED8] border border-[#1D4ED8]/30 py-4 rounded-xl font-bold hover:bg-[#1D4ED8]/5 active:scale-95 transition shadow-sm">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"></path></svg>
                  הוסף כרטיס אשראי חדש
                </button>

                <div className="relative flex items-center justify-center mt-4 mb-2">
                  <div className="border-t border-gray-200 w-full absolute"></div>
                  <span className="bg-white/95 backdrop-blur-xl px-3 text-[10px] font-bold text-slate-400 relative z-10 uppercase tracking-widest">או</span>
                </div>

                <button onClick={() => processPayment('bit')} className="w-full flex items-center justify-between px-5 bg-white border border-gray-100 py-4 rounded-xl font-bold hover:bg-gray-50 active:scale-95 transition shadow-sm">
                  <div className="flex items-center gap-3 text-slate-800">
                    <div className="w-8 h-8 rounded-full bg-[#1D4ED8]/10 flex items-center justify-center text-[#1D4ED8]">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"></path></svg>
                    </div>
                    דיווח תשלום בביט/מזומן
                  </div>
                </button>
              </div>
            )}

            {paymentFlowStep === 'new_card' && (
              <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-right-4">
                <button onClick={() => setPaymentFlowStep('select')} className="text-[10px] font-bold text-[#1D4ED8] flex items-center gap-1 mb-2">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7"></path></svg> חזור לאמצעי תשלום
                </button>
                
                <div>
                  <input type="text" placeholder="מספר כרטיס (0000 0000 0000 0000)" maxLength={19} className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3.5 text-sm outline-none focus:border-[#1D4ED8] transition font-mono tracking-widest text-left shadow-sm" dir="ltr" onChange={e => setNewCardDetails({...newCardDetails, number: e.target.value})} />
                </div>
                
                <div className="flex gap-3">
                  <input type="text" placeholder="תוקף (MM/YY)" maxLength={5} className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-3.5 text-sm outline-none focus:border-[#1D4ED8] transition font-mono text-center shadow-sm" dir="ltr" onChange={e => setNewCardDetails({...newCardDetails, expiry: e.target.value})} />
                  <input type="password" placeholder="CVV" maxLength={3} className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-3.5 text-sm outline-none focus:border-[#1D4ED8] transition font-mono text-center tracking-widest shadow-sm" dir="ltr" onChange={e => setNewCardDetails({...newCardDetails, cvv: e.target.value})} />
                </div>

                <label className="flex items-center gap-3 p-4 rounded-xl border border-[#1D4ED8]/20 bg-[#1D4ED8]/5 cursor-pointer mt-2 shadow-sm">
                  <input type="checkbox" checked={newCardDetails.saveCard} onChange={e => setNewCardDetails({...newCardDetails, saveCard: e.target.checked})} className="w-4 h-4 text-[#1D4ED8] rounded border-gray-300" />
                  <span className="text-xs font-bold text-slate-800">שמור כרטיס לתשלומים הבאים בבניין</span>
                </label>

                <button onClick={() => processPayment('new_card')} className="w-full bg-[#1D4ED8] text-white font-bold py-4 rounded-xl shadow-sm mt-4 active:scale-95 transition">
                  בצע תשלום
                </button>
              </div>
            )}

            {paymentFlowStep === 'processing' && (
              <div className="flex flex-col items-center justify-center py-10 gap-4">
                <div className="w-12 h-12 border-4 border-[#1D4ED8]/20 border-t-[#1D4ED8] rounded-full animate-spin"></div>
                <p className="font-bold text-slate-800 animate-pulse">מעבד תשלום מאובטח...</p>
              </div>
            )}

            {paymentFlowStep === 'success' && (
              <div className="flex flex-col items-center justify-center py-6 gap-3 animate-in zoom-in">
                <div className="w-20 h-20 bg-[#059669]/10 text-[#059669] rounded-full flex items-center justify-center mb-2 shadow-sm">
                  <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                </div>
                <h3 className="text-2xl font-black text-slate-800">התשלום בוצע!</h3>
                <p className="text-sm text-slate-500 text-center">העברת ₪{payingItem.amount} נרשמה בהצלחה בקופה.</p>
                <button onClick={() => {setPayingItem(null); setPaymentFlowStep('select');}} className="w-full bg-slate-800 text-white font-bold py-4 rounded-xl shadow-sm mt-6 active:scale-95 transition">
                  סיום
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- התראות מערכת וחלוניות אישור --- */}
      {customAlert && (
        <div className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-white/95 backdrop-blur-xl rounded-[2rem] p-6 w-full max-w-sm shadow-2xl text-center animate-in zoom-in-95 border border-white/50">
            <div className={`w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center shadow-sm ${customAlert.type === 'success' ? 'bg-[#059669]/10 text-[#059669]' : customAlert.type === 'error' ? 'bg-red-50 text-red-500' : 'bg-[#1D4ED8]/10 text-[#1D4ED8]'}`}>
              {customAlert.type === 'success' && <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"></path></svg>}
              {customAlert.type === 'error' && <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>}
              {customAlert.type === 'info' && <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>}
            </div>
            <h3 className="text-xl font-black text-slate-800 mb-2">{customAlert.title}</h3>
            <p className="text-sm text-slate-500 mb-6 leading-relaxed">{customAlert.message}</p>
            <button onClick={() => setCustomAlert(null)} className="w-full bg-slate-800 text-white font-bold py-3.5 rounded-xl active:scale-95 transition shadow-sm">סגירה</button>
          </div>
        </div>
      )}

      {customConfirm && (
        <div className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-white/95 backdrop-blur-xl rounded-[2rem] p-6 w-full max-w-sm shadow-2xl text-center animate-in zoom-in-95 border border-white/50">
            <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center bg-orange-50 text-orange-500 shadow-sm">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
            </div>
            <h3 className="text-xl font-black text-slate-800 mb-2">{customConfirm.title}</h3>
            <p className="text-sm text-slate-500 mb-6 leading-relaxed">{customConfirm.message}</p>
            <div className="flex gap-3">
              <button onClick={() => setCustomConfirm(null)} className="flex-1 bg-white text-slate-600 font-bold py-3.5 rounded-xl hover:bg-gray-50 transition active:scale-95 border border-gray-200 shadow-sm">ביטול</button>
              <button onClick={customConfirm.onConfirm} className="flex-1 bg-[#1D4ED8] text-white font-bold py-3.5 rounded-xl transition shadow-sm active:scale-95">אישור</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

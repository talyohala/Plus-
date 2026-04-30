'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'

export default function PaymentsPage() {
  const [profile, setProfile] = useState<any>(null)
  const [building, setBuilding] = useState<any>(null)
  const [myPayments, setMyPayments] = useState<any[]>([])
  const [buildingPayments, setBuildingPayments] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<'my_debts' | 'admin_collection'>('my_debts')
  
  const [totalCollected, setTotalCollected] = useState(0)
  const [totalPending, setTotalPending] = useState(0)
  const [totalExempt, setTotalExempt] = useState(0)
  
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isShareMenuOpen, setIsShareMenuOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [newPayment, setNewPayment] = useState({ title: '', amount: '' })

  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null)
  const [editPaymentData, setEditPaymentData] = useState({ title: '', amount: '' })
  
  const [expandedCampaigns, setExpandedCampaigns] = useState<Record<string, boolean>>({})

  const [payingDebt, setPayingDebt] = useState<any | null>(null)
  const [paymentFlowStep, setPaymentFlowStep] = useState<'select' | 'new_card' | 'bank_transfer' | 'processing' | 'success'>('select')
  const [savedCards, setSavedCards] = useState<any[]>([])
  const [newCardDetails, setNewCardDetails] = useState({ number: '', expiry: '', cvv: '', saveCard: true, autoPay: false })

  const [customAlert, setCustomAlert] = useState<{ title: string, message: string, type: 'success' | 'error' | 'info' } | null>(null)
  const [customConfirm, setCustomConfirm] = useState<{ title: string, message: string, onConfirm: () => void } | null>(null)

  const fetchData = async (user: any) => {
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (!prof || !prof.building_id) return
    
    setProfile(prof)
    if (prof.saved_payment_methods) setSavedCards(prof.saved_payment_methods)

    const { data: bld } = await supabase.from('buildings').select('*').eq('id', prof.building_id).single()
    if (bld) setBuilding(bld)

    if (prof.role === 'admin' && activeTab === 'admin_collection') {
      // Stay
    } else if (prof.role === 'admin' && activeTab !== 'admin_collection' && myPayments.length === 0) {
      setActiveTab('admin_collection')
    }

    const { data: myData } = await supabase.from('payments')
      .select('*, collector:profiles!payments_collector_id_fkey(full_name)')
      .eq('payer_id', prof.id)
      .order('status', { ascending: false })
      .order('created_at', { ascending: false })
    
    if (myData) setMyPayments(myData)

    const { data: bldData } = await supabase.from('payments')
      .select('*, payer:profiles!payments_payer_id_fkey(full_name, avatar_url, apartment)')
      .eq('building_id', prof.building_id)
      .order('created_at', { ascending: false })
    
    if (bldData) {
      if (prof.role === 'admin') setBuildingPayments(bldData)
      let collected = 0
      let pending = 0
      let exempt = 0
      bldData.forEach(p => {
        if (p.status === 'paid') collected += p.amount
        if (p.status === 'pending') pending += p.amount
        if (p.status === 'exempt') exempt += p.amount
      })
      setTotalCollected(collected)
      setTotalPending(pending)
      setTotalExempt(exempt)
    }
  }

  useEffect(() => {
    let currentUser: any = null
    supabase.auth.getUser().then(({ data: { user } }) => {
      currentUser = user
      if (user) fetchData(user)
    })

    const channel = supabase.channel('payments_realtime_final')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => currentUser && fetchData(currentUser))
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const generatePDF = (title: string, htmlContent: string) => {
    const htmlTemplate = `
      <!DOCTYPE html>
      <html dir="rtl">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <script>
          tailwind.config = { theme: { extend: { colors: { brand: { dark: '#0e1e2d', blue: '#0044cc' } } } } }
        </script>
        <style>
          @media print { body { -webkit-print-color-adjust: exact; } .no-print { display: none !important; } }
          body { font-family: system-ui, -apple-system, sans-serif; background-color: #f9fafb; padding: 15px; }
        </style>
      </head>
      <body>
        <div class="max-w-xl mx-auto bg-white p-6 rounded-3xl shadow-md border border-gray-100 mt-5">
          ${htmlContent}
          <div class="mt-8 text-center no-print border-t border-gray-100 pt-6">
            <button onclick="window.print()" class="bg-brand-blue text-white px-8 py-3.5 rounded-xl font-bold shadow-lg active:scale-95 transition w-full">שמור כ-PDF / הדפס</button>
            <button onclick="window.close()" class="mt-3 text-gray-500 font-bold px-8 py-3 rounded-xl active:scale-95 transition w-full border border-gray-200">סגור חלון</button>
          </div>
        </div>
      </body>
      </html>
    `
    const blob = new Blob([htmlTemplate], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const newWindow = window.open(url, '_blank')
    if (!newWindow) {
      setCustomAlert({ title: 'שגיאה', message: 'הדפדפן חסם את פתיחת הקבלה. אנא אפשר חלונות קופצים (Popups).', type: 'error' })
    }
  }

  const downloadReceipt = (payment: any) => {
    const date = new Date(payment.created_at).toLocaleDateString('he-IL')
    const time = new Date(payment.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
    const receiptHtml = `
      <div class="text-center border-b-2 border-brand-blue/10 pb-6 mb-6 mt-4">
        <h1 class="text-4xl font-black text-brand-blue mb-1">שכן<span class="text-brand-dark">+</span></h1>
        <h2 class="text-xl font-bold text-gray-800">קבלה רשמית - ועד בית</h2>
        <p class="text-gray-500 mt-1">${building?.name}</p>
      </div>
      <div class="space-y-3 mb-8 text-gray-700 text-sm">
        <div class="flex justify-between p-3 bg-gray-50 rounded-xl">
          <span class="font-bold">תאריך:</span>
          <span>${date} בשעה ${time}</span>
        </div>
        <div class="flex justify-between p-3 bg-gray-50 rounded-xl">
          <span class="font-bold">שם המשלם:</span>
          <span>${profile?.full_name} ${profile?.apartment ? `(דירה ${profile.apartment})` : ''}</span>
        </div>
        <div class="flex justify-between p-3 bg-gray-50 rounded-xl">
          <span class="font-bold">עבור:</span>
          <span>${payment.title}</span>
        </div>
        <div class="flex justify-between p-4 bg-brand-blue/5 rounded-xl border border-brand-blue/20 mt-4 items-center">
          <span class="font-black text-brand-dark text-lg">סכום ששולם:</span>
          <span class="font-black text-brand-blue text-3xl">₪${payment.amount}</span>
        </div>
      </div>
      <div class="text-center text-gray-400 text-xs">
        <p>התשלום התקבל בהצלחה ונרשם בקופת הבניין.</p>
        <p class="mt-1">מספר אסמכתא: ${payment.id.split('-')[0].toUpperCase()}</p>
      </div>
    `
    generatePDF(`קבלה_${payment.title.replace(/\s+/g, '_')}`, receiptHtml)
  }

  const generateAdminReport = () => {
    setIsShareMenuOpen(false)
    const date = new Date().toLocaleDateString('he-IL')
    let tableRows = ''
    buildingPayments.forEach(p => {
      let statusHtml = ''
      if (p.status === 'paid') statusHtml = '<span class="text-green-600 font-bold">שולם</span>'
      if (p.status === 'pending') statusHtml = '<span class="text-orange-500 font-bold">ממתין לתשלום</span>'
      if (p.status === 'exempt') statusHtml = '<span class="text-gray-400">פטור</span>'
      
      tableRows += `
        <tr class="border-b border-gray-100">
          <td class="py-3 pr-2">${p.payer?.full_name} ${p.payer?.apartment ? `(${p.payer.apartment})` : ''}</td>
          <td class="py-3">${p.title}</td>
          <td class="py-3 font-bold text-left">₪${p.amount}</td>
          <td class="py-3 pl-2 text-left">${statusHtml}</td>
        </tr>
      `
    })

    const reportHtml = `
      <div class="text-center border-b-2 border-brand-blue/10 pb-6 mb-6 mt-4">
        <h1 class="text-4xl font-black text-brand-blue mb-1">שכן<span class="text-brand-dark">+</span></h1>
        <h2 class="text-xl font-bold text-gray-800">דוח מצב קופת ועד הבית</h2>
        <p class="text-gray-500 mt-1">${building?.name} | הופק בתאריך: ${date}</p>
      </div>
      
      <div class="flex justify-between gap-3 mb-8">
        <div class="flex-1 bg-green-50 p-4 rounded-2xl text-center border border-green-100">
          <p class="text-[10px] font-bold text-green-600 uppercase mb-1">יתרה בקופה</p>
          <p class="text-xl font-black text-green-700">₪${totalCollected}</p>
        </div>
        <div class="flex-1 bg-orange-50 p-4 rounded-2xl text-center border border-orange-100">
          <p class="text-[10px] font-bold text-orange-600 uppercase mb-1">תשלומים נותרים</p>
          <p class="text-xl font-black text-orange-700">₪${totalPending}</p>
        </div>
      </div>

      <h3 class="text-lg font-black text-brand-dark mb-4 border-b border-gray-100 pb-2">פירוט עסקאות</h3>
      <table class="w-full text-xs">
        <thead>
          <tr class="text-brand-gray border-b-2 border-gray-200">
            <th class="py-2 pr-2 text-right">דייר</th>
            <th class="py-2 text-right">עבור</th>
            <th class="py-2 text-left">סכום</th>
            <th class="py-2 pl-2 text-left">סטטוס</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
    `
    generatePDF(`דוח_גבייה_${date.replace(/\//g, '-')}`, reportHtml)
  }

  const shareReceiptWhatsApp = (payment: any) => {
    const text = encodeURIComponent(`🧾 *קבלה רשמית - ועד בית*\n🏢 *בניין:* ${building?.name}\n👤 *שולם ע"י:* ${profile?.full_name}\n📌 *עבור:* ${payment.title}\n💰 *סכום:* ₪${payment.amount}\n\n_שולם והופק אוטומטית מאפליקציית שכן+_ ✅`)
    window.open(`https://wa.me/?text=${text}`, '_blank')
  }

  const shareReportWhatsApp = () => {
    setIsShareMenuOpen(false)
    const text = encodeURIComponent(
      `📊 *דוח מצב קופה - ועד בית*\n🏢 *בניין:* ${building?.name}\n━━━━━━━━━━━━━━━\n✅ *יתרה נוכחית בקופה:* ₪${totalCollected.toLocaleString()}\n⏳ *תשלומים נותרים לגבייה:* ₪${totalPending.toLocaleString()}\n\nאנו מודים לכל מי שהסדיר את התשלום! 🙏\n_הדוח המלא זמין באפליקציית שכן+_ 📱`
    )
    window.open(`https://wa.me/?text=${text}`, '_blank')
  }

  const shareToAppChat = async () => {
    setIsShareMenuOpen(false)
    const content = `📊 **סטטוס קופת ועד הבית** 📊\n✅ יתרה שנאספה: ₪${totalCollected.toLocaleString()}\n⏳ תשלומים נותרים: ₪${totalPending.toLocaleString()}\n\nאנו מודים לכל מי שהסדיר את התשלומים. נא להיכנס ללשונית "תשלומים" באפליקציה כדי להסדיר תשלומים פתוחים. תודה! 🙏`
    const { error } = await supabase.from('posts').insert([{ user_id: profile.id, content }])
    if (!error) {
      setCustomAlert({ title: 'פורסם בהצלחה', message: 'הדוח פורסם בלוח המודעות של הבניין וגלוי לכל הדיירים.', type: 'success' })
    } else {
      setCustomAlert({ title: 'שגיאה', message: 'לא הצלחנו לפרסם את הדוח כרגע.', type: 'error' })
    }
  }

  // --- כאן נמצא השדרוג שמייצר את ההתראות האמיתיות למסד הנתונים! ---
  const handleCreatePaymentRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile?.building_id || !newPayment.title || !newPayment.amount) return
    setIsSubmitting(true)
    const { data: tenants } = await supabase.from('profiles').select('id').eq('building_id', profile.building_id)
    if (tenants && tenants.length > 0) {
      const paymentsToInsert = tenants.map(tenant => ({
        building_id: profile.building_id, collector_id: profile.id, payer_id: tenant.id, title: newPayment.title, amount: parseInt(newPayment.amount)
      }))
      
      // 1. יצירת התשלומים במסד הנתונים
      await supabase.from('payments').insert(paymentsToInsert)
      
      // 2. יצירת ההתראות (Notifications) לכל הדיירים (חוץ מהמנהל עצמו)
      const notificationsToInsert = tenants
        .filter(t => t.id !== profile.id)
        .map(tenant => ({
          receiver_id: tenant.id,
          sender_id: profile.id,
          type: 'payment',
          title: 'דרישת תשלום חדשה מהוועד',
          content: `נוספה דרישת תשלום עבור: ${newPayment.title} (סך ${newPayment.amount} ₪)`,
          link: '/payments'
        }))
        
      if (notificationsToInsert.length > 0) {
        await supabase.from('notifications').insert(notificationsToInsert)
      }

      setIsModalOpen(false)
      setNewPayment({ title: '', amount: '' })
      fetchData(profile)
      setCustomAlert({ title: 'מעולה!', message: 'דרישת התשלום שודרה בהצלחה והתראות נשלחו לכל הדיירים.', type: 'success' })
    }
    setIsSubmitting(false)
  }

  const handleEditClick = (payment: any) => {
    setEditingPaymentId(payment.id)
    setEditPaymentData({ title: payment.title, amount: payment.amount.toString() })
    setOpenMenuId(null)
  }

  const handleInlineEditSubmit = async (e: React.FormEvent, id: string) => {
    e.preventDefault()
    setIsSubmitting(true)
    await supabase.from('payments').update({ title: editPaymentData.title, amount: parseInt(editPaymentData.amount) }).eq('id', id)
    setEditingPaymentId(null)
    fetchData(profile)
    setIsSubmitting(false)
  }

  const deletePayment = (paymentId: string) => {
    setOpenMenuId(null)
    setCustomConfirm({
      title: 'מחיקת דרישת תשלום',
      message: 'האם למחוק דרישת תשלום זו? הפעולה אינה ניתנת לביטול.',
      onConfirm: async () => {
        await supabase.from('payments').delete().eq('id', paymentId)
        fetchData(profile)
        setCustomConfirm(null)
      }
    })
  }

  const markAsExempt = (paymentId: string) => {
    setOpenMenuId(null)
    setCustomConfirm({
      title: 'הענקת פטור',
      message: 'האם להעניק פטור? התשלום יאופס ויסומן כ"פטור".',
      onConfirm: async () => {
        await supabase.from('payments').update({ status: 'exempt' }).eq('id', paymentId)
        fetchData(profile)
        setCustomConfirm(null)
      }
    })
  }

  const markAsPaid = async (paymentId: string) => {
    await supabase.from('payments').update({ status: 'paid' }).eq('id', paymentId)
    fetchData(profile)
  }

  const sendWhatsAppReminder = (tenantName: string, amount: number, title: string) => {
    const text = encodeURIComponent(`היי ${tenantName}, תזכורת קטנה מהוועד לגבי התשלום של "${title}" (סך ${amount} ₪). אשמח להסדרה באפליקציה 🙏`)
    window.open(`https://wa.me/?text=${text}`, '_blank')
    setOpenMenuId(null)
  }

  const startPaymentFlow = (payment: any) => {
    setPayingDebt(payment)
    setPaymentFlowStep('select')
  }

  const processPayment = async (method: string) => {
    if (!payingDebt) return
    setPaymentFlowStep('processing')
    setTimeout(async () => {
      await supabase.from('payments').update({ status: 'paid' }).eq('id', payingDebt.id)
      if (method === 'new_card' && newCardDetails.saveCard) {
        const last4 = newCardDetails.number.slice(-4) || '1234'
        const newCard = { id: Date.now().toString(), type: 'visa', last4: last4, exp: newCardDetails.expiry }
        const updatedCards = [...savedCards, newCard]
        await supabase.from('profiles').update({ saved_payment_methods: updatedCards }).eq('id', profile.id)
        setSavedCards(updatedCards)
      }
      setPaymentFlowStep('success')
      fetchData(profile)
    }, 2000)
  }

  const deleteSavedCard = async (cardId: string) => {
    if(confirm('למחוק את אמצעי התשלום השמור?')) {
      const updatedCards = savedCards.filter(c => c.id !== cardId)
      await supabase.from('profiles').update({ saved_payment_methods: updatedCards }).eq('id', profile.id)
      setSavedCards(updatedCards)
    }
  }

  const handleWithdrawBank = () => {
    if (totalCollected === 0) return setCustomAlert({ title: 'ארנק ריק', message: 'אין יתרה זמינה למשיכה כרגע.', type: 'info' })
    setCustomAlert({ title: 'הבקשה התקבלה', message: `משיכת ₪${totalCollected} לחשבון הבנק הוגשה בהצלחה.`, type: 'success' })
  }

  const isAdmin = profile?.role === 'admin'
  const totalTarget = totalCollected + totalPending
  const progressPercent = totalTarget > 0 ? (totalCollected / totalTarget) * 100 : 0

  const groupedPayments = buildingPayments.reduce((acc, curr) => {
    if (!acc[curr.title]) {
      acc[curr.title] = { title: curr.title, target: 0, collected: 0, exempt: 0, items: [] }
    }
    if (curr.status !== 'exempt') acc[curr.title].target += curr.amount
    if (curr.status === 'paid') acc[curr.title].collected += curr.amount
    if (curr.status === 'exempt') acc[curr.title].exempt += curr.amount
    acc[curr.title].items.push(curr)
    return acc
  }, {})
  const campaigns = Object.values(groupedPayments) as any[]

  const toggleCampaign = (title: string) => {
    setExpandedCampaigns(prev => ({ ...prev, [title]: !prev[title] }))
  }

  const WalletCard = ({ isAdminView }: { isAdminView: boolean }) => (
    <div className="flex flex-col gap-3 mb-6">
      <div className="bg-gradient-to-br from-[#0e1e2d] to-brand-blue p-6 rounded-3xl text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-brand-blue/30 rounded-full blur-xl -ml-5 -mb-5 pointer-events-none"></div>
        
        <div className="relative z-10 flex justify-between items-start mb-2">
          <p className="text-xs font-bold text-white/80 tracking-wide uppercase">קופת ועד הבית</p>
          <svg className="w-6 h-6 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path></svg>
        </div>
        <h3 className="text-4xl font-black mb-5 relative z-10 tracking-tight">₪{totalCollected.toLocaleString()}</h3>
        
        {isAdminView && (
          <div className="flex gap-2 relative z-10 mb-5">
            <button onClick={handleWithdrawBank} className="flex-1 bg-white text-brand-dark text-[11px] font-bold py-3 rounded-xl shadow-md active:scale-95 transition flex items-center justify-center hover:bg-gray-50">
              משיכה לבנק
            </button>
          </div>
        )}
        
        <div className={`pt-4 border-t border-white/10 relative z-10 ${!isAdminView ? 'border-t-0 pt-0' : ''}`}>
          <div className="flex justify-between items-end mb-2">
             <div>
               <span className="text-[10px] text-white/70 block mb-0.5 font-bold">תשלומים נותרים: <strong className="text-orange-300">₪{totalPending.toLocaleString()}</strong></span>
               <span className="text-[9px] text-white/50 block">יעד גבייה: ₪{totalTarget.toLocaleString()} {totalExempt > 0 && `(₪${totalExempt.toLocaleString()} בפטור)`}</span>
             </div>
             <span className="text-xs font-black">{Math.round(progressPercent)}%</span>
          </div>
          <div className="w-full bg-black/20 rounded-full h-1.5 overflow-hidden flex">
            <div className="bg-[#25D366] h-1.5 rounded-full transition-all duration-1000" style={{ width: `${progressPercent}%` }}></div>
          </div>
        </div>
      </div>
      
      {isAdminView && (
        <button onClick={() => setIsShareMenuOpen(true)} className="w-full bg-white border border-gray-200 text-brand-dark text-xs font-bold py-3.5 rounded-2xl active:scale-95 transition flex items-center justify-center gap-2 hover:bg-gray-50 shadow-sm">
          <svg className="w-4 h-4 text-brand-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
          הפקת דוח ושיתוף נתונים
        </button>
      )}
    </div>
  )

  return (
    <div className="flex flex-col flex-1 w-full pb-24 relative" dir="rtl">
      
      <div className="px-4 mb-4 mt-2">
        <h2 className="text-2xl font-black text-brand-dark">תשלומים</h2>
      </div>

      <div className="flex overflow-x-auto hide-scrollbar gap-2 px-4 mb-6 pb-2">
        {isAdmin && (
          <button 
            onClick={() => setActiveTab('admin_collection')}
            className={`whitespace-nowrap px-6 py-2 rounded-full text-sm font-bold transition shadow-sm border ${
              activeTab === 'admin_collection' ? 'bg-brand-blue text-white border-brand-blue' : 'bg-white text-brand-dark border-gray-100 hover:bg-gray-50'
            }`}
          >
            ארנק וניהול גבייה
          </button>
        )}
        <button 
          onClick={() => setActiveTab('my_debts')}
          className={`whitespace-nowrap px-6 py-2 rounded-full text-sm font-bold transition shadow-sm border ${
            activeTab === 'my_debts' ? 'bg-brand-blue text-white border-brand-blue' : 'bg-white text-brand-dark border-gray-100 hover:bg-gray-50'
          }`}
        >
          התשלומים שלי
        </button>
      </div>

      <div className="space-y-4 px-4">
        {activeTab === 'my_debts' ? (
          <div className="flex flex-col gap-2">
            <WalletCard isAdminView={false} />

            <h4 className="text-sm font-black text-brand-dark mt-2 mb-1">מעקב תשלומים לפי נושא</h4>
            {campaigns.length === 0 ? (
              <div className="text-center py-8 bg-white/50 rounded-3xl border border-gray-100 shadow-sm">
                <p className="text-brand-gray font-medium text-sm">אין תשלומים פעילים בבניין כרגע.</p>
              </div>
            ) : (
              campaigns.map((camp: any, idx: number) => {
                const isExpanded = expandedCampaigns[camp.title]
                const campProgress = camp.target > 0 ? (camp.collected / camp.target) * 100 : 0
                const myPaymentInCamp = camp.items.find((p:any) => p.payer_id === profile.id)
                
                return (
                  <div key={idx} className="bg-white rounded-3xl shadow-sm border border-gray-50 flex flex-col mb-4 overflow-hidden">
                    <button onClick={() => toggleCampaign(camp.title)} className="w-full text-right p-5 flex flex-col gap-3 focus:outline-none hover:bg-gray-50/50 transition">
                      <div className="flex justify-between items-center w-full">
                        <h3 className="font-black text-brand-dark text-base">{camp.title}</h3>
                        <svg className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                      </div>
                      <div className="w-full">
                        <div className="flex justify-between text-[10px] text-brand-gray mb-1.5 font-bold">
                          <span>נאסף ₪{camp.collected} מתוך ₪{camp.target}</span>
                          <span className="text-brand-blue">{Math.round(campProgress)}%</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden flex">
                          <div className="bg-brand-blue h-1.5 rounded-full transition-all" style={{ width: `${campProgress}%` }}></div>
                        </div>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="bg-gray-50/50 border-t border-gray-50 flex flex-col p-3">
                        {myPaymentInCamp ? (
                          <div className={`bg-white p-4 rounded-2xl border flex flex-col gap-3 relative transition ${myPaymentInCamp.status === 'pending' ? 'border-brand-blue/30 shadow-[0_4px_20px_rgba(0,68,204,0.08)]' : 'border-gray-100 opacity-90'}`}>
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="text-[10px] text-brand-gray mb-1">סטטוס התשלום שלך:</p>
                                {myPaymentInCamp.status === 'pending' && <span className="text-[10px] font-bold px-2.5 py-1 rounded-md bg-orange-50 text-orange-600 border border-orange-100">ממתין לתשלום</span>}
                                {myPaymentInCamp.status === 'paid' && <span className="text-[10px] font-bold px-2.5 py-1 rounded-md bg-green-50 text-green-600 border border-green-100">שולם בהצלחה</span>}
                                {myPaymentInCamp.status === 'exempt' && <span className="text-[10px] font-bold px-2.5 py-1 rounded-md bg-gray-100 text-gray-500 border border-gray-200">פטור באדיבות הוועד</span>}
                              </div>
                              <span className={`text-xl font-black ${myPaymentInCamp.status === 'exempt' ? 'text-gray-400' : 'text-brand-dark'}`}>₪{myPaymentInCamp.amount}</span>
                            </div>

                            <div className="flex items-center justify-end gap-2 mt-2 border-t border-gray-50 pt-3">
                              {myPaymentInCamp.status === 'pending' && (
                                <button onClick={() => startPaymentFlow(myPaymentInCamp)} className="bg-brand-dark text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-[0_4px_15px_rgba(14,30,45,0.2)] active:scale-95 transition flex items-center gap-1.5">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path></svg>
                                  לתשלום מאובטח
                                </button>
                              )}
                              {myPaymentInCamp.status === 'paid' && (
                                <>
                                  <button onClick={() => shareReceiptWhatsApp(myPaymentInCamp)} className="text-[#25D366] bg-[#25D366]/10 p-2 rounded-lg hover:bg-[#25D366]/20 transition" title="שתף קבלה בוואטסאפ">
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/></svg>
                                  </button>
                                  <button onClick={() => downloadReceipt(myPaymentInCamp)} className="text-[11px] flex items-center gap-1 font-bold text-brand-blue bg-brand-blue/10 px-3 py-2 rounded-lg hover:bg-brand-blue/20 transition">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg> 
                                    הורד קבלה
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        ) : (
                          <p className="text-center text-xs text-gray-400 py-3">אין לך דרישת תשלום פתוחה בנושא זה.</p>
                        )}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        ) : (
          <div className="flex flex-col">
            <WalletCard isAdminView={true} />

            <h4 className="text-sm font-black text-brand-dark mt-2 mb-1">מעקב תשלומים לפי נושא</h4>
            {campaigns.length === 0 ? (
              <div className="text-center py-8 bg-white/50 rounded-3xl border border-gray-100 shadow-sm">
                <p className="text-brand-gray font-medium text-sm">עדיין לא יצרת דרישות תשלום.</p>
              </div>
            ) : (
              campaigns.map((camp: any, idx: number) => {
                const isExpanded = expandedCampaigns[camp.title]
                const campProgress = camp.target > 0 ? (camp.collected / camp.target) * 100 : 0
                
                return (
                  <div key={idx} className="bg-white rounded-3xl shadow-sm border border-gray-50 flex flex-col mb-4 overflow-hidden">
                    <button onClick={() => toggleCampaign(camp.title)} className="w-full text-right p-5 flex flex-col gap-3 focus:outline-none hover:bg-gray-50/50 transition">
                      <div className="flex justify-between items-center w-full">
                        <h3 className="font-black text-brand-dark text-base">{camp.title}</h3>
                        <svg className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                      </div>
                      <div className="w-full">
                        <div className="flex justify-between text-[10px] text-brand-gray mb-1.5 font-bold">
                          <span>נאסף ₪{camp.collected} מתוך ₪{camp.target}</span>
                          <span className="text-brand-blue">{Math.round(campProgress)}%</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden flex">
                          <div className="bg-brand-blue h-1.5 rounded-full transition-all" style={{ width: `${campProgress}%` }}></div>
                        </div>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="bg-gray-50/50 border-t border-gray-50 flex flex-col gap-1 p-2">
                        {camp.items.map((payment: any) => {
                          const isSelf = payment.payer_id === profile.id;
                          return (
                            <div key={payment.id} className="bg-white p-3 rounded-2xl border border-gray-100 relative group">
                              {editingPaymentId === payment.id ? (
                                <form onSubmit={(e) => handleInlineEditSubmit(e, payment.id)} className="flex flex-col gap-2 w-full p-2">
                                  <input type="text" required value={editPaymentData.title} onChange={e => setEditPaymentData({...editPaymentData, title: e.target.value})} className="w-full bg-gray-50 border border-brand-blue/30 rounded-xl px-3 py-1.5 text-xs outline-none focus:border-brand-blue" />
                                  <input type="number" required value={editPaymentData.amount} onChange={e => setEditPaymentData({...editPaymentData, amount: e.target.value})} className="w-full bg-gray-50 border border-brand-blue/30 rounded-xl px-3 py-1.5 text-xs outline-none focus:border-brand-blue font-black" />
                                  <div className="flex justify-end gap-2 mt-1">
                                    <button type="button" onClick={() => setEditingPaymentId(null)} className="px-3 py-1 text-[10px] font-bold text-gray-500 hover:bg-gray-100 rounded-lg">ביטול</button>
                                    <button type="submit" disabled={isSubmitting} className="px-3 py-1 text-[10px] font-bold text-white bg-brand-blue rounded-lg">{isSubmitting ? 'שומר...' : 'שמור'}</button>
                                  </div>
                                </form>
                              ) : (
                                <div className="flex items-center justify-between w-full pl-2">
                                  
                                  {/* צד ימין: אווטאר, שם דייר וסטטוס */}
                                  <div className="flex items-center gap-2.5 min-w-0 pr-1">
                                    <img src={payment.payer?.avatar_url || `https://api.dicebear.com/8.x/initials/svg?seed=${payment.payer?.full_name}&backgroundColor=eef2ff&textColor=1e3a8a`} className="w-8 h-8 rounded-full border border-gray-100 shrink-0" />
                                    <div className="truncate">
                                      <p className="text-xs font-bold text-brand-dark truncate">{payment.payer?.full_name} {payment.payer?.apartment ? `(${payment.payer.apartment})` : ''}</p>
                                      <div className="flex items-center gap-1 mt-0.5">
                                        {payment.status === 'pending' && <span className="text-[9px] font-bold text-orange-500">ממתין לתשלום</span>}
                                        {payment.status === 'paid' && <span className="text-[9px] font-bold text-green-500">שולם</span>}
                                        {payment.status === 'exempt' && <span className="text-[9px] font-bold text-gray-400">פטור</span>}
                                      </div>
                                    </div>
                                  </div>
                                  
                                  {/* צד שמאל מאוגד: וואטסאפ -> סכום -> 3 נקודות (בדיוק לפי הבקשה) */}
                                  <div className="flex items-center gap-2 mr-auto pl-1 shrink-0 justify-end">
                                    
                                    {payment.status === 'pending' && !isSelf && (
                                      <button onClick={() => sendWhatsAppReminder(payment.payer?.full_name, payment.amount, payment.title)} className="text-[#25D366] bg-[#25D366]/10 p-1.5 rounded-lg hover:bg-[#25D366]/20 transition shrink-0" title="שלח תזכורת בוואטסאפ">
                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/></svg>
                                      </button>
                                    )}
                                    {payment.status !== 'pending' && <div className="w-7 shrink-0"></div>}

                                    <span className={`text-sm font-black w-10 text-center ${payment.status === 'exempt' ? 'text-gray-400 line-through' : 'text-brand-dark'}`}>₪{payment.amount}</span>

                                    <div className="relative shrink-0">
                                      <button onClick={() => setOpenMenuId(openMenuId === payment.id ? null : payment.id)} className="p-1.5 text-gray-400 hover:text-brand-dark transition active:scale-95">
                                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"></path></svg>
                                      </button>
                                      
                                      {openMenuId === payment.id && (
                                        <div className="absolute left-0 mt-1 w-32 bg-white border border-gray-100 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] overflow-hidden z-30">
                                          {payment.status === 'pending' && (
                                            <button onClick={() => handleEditClick(payment)} className="w-full text-right px-4 py-3 text-xs font-bold text-brand-dark hover:bg-gray-50 flex items-center gap-2">
                                               <svg className="w-4 h-4 text-brand-gray" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                                               עריכה
                                            </button>
                                          )}
                                          {payment.status === 'pending' && !isSelf && (
                                            <button onClick={() => markAsExempt(payment.id)} className="w-full text-right px-4 py-3 text-xs font-bold text-brand-dark hover:bg-gray-50 flex items-center gap-2 border-t border-gray-50">
                                               <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                               פטור
                                            </button>
                                          )}
                                          <button onClick={() => deletePayment(payment.id)} className="w-full text-right px-4 py-3 text-xs font-bold text-red-500 hover:bg-red-50 flex items-center gap-2 border-t border-gray-50">
                                             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                             מחיקה
                                          </button>
                                        </div>
                                      )}
                                    </div>

                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>

      {isAdmin && activeTab === 'admin_collection' && (
        <button onClick={() => setIsModalOpen(true)} className="fixed bottom-28 left-4 z-40 bg-white/90 backdrop-blur-md border border-brand-blue/10 text-brand-blue p-1.5 pl-4 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:scale-105 active:scale-95 transition flex items-center gap-2">
          <div className="bg-brand-blue/10 p-2 rounded-full">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"></path></svg>
          </div>
          <span className="font-bold text-sm">דרישת תשלום</span>
        </button>
      )}

      {/* תפריט השיתוף החכם תחת הארנק למנהל */}
      {isShareMenuOpen && (
        <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex justify-center items-end">
          <div className="bg-white w-full max-w-md rounded-t-[32px] p-6 pb-8 shadow-2xl animate-in slide-in-from-bottom-10">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-black text-xl text-brand-dark">הפקת דוח ושיתוף נתונים</h3>
              <button onClick={() => setIsShareMenuOpen(false)} className="p-2 bg-gray-100 rounded-full text-brand-dark hover:bg-gray-200 transition">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            
            <div className="flex flex-col gap-3">
              <button onClick={generateAdminReport} className="w-full flex items-center justify-between bg-white border border-gray-200 p-4 rounded-2xl hover:bg-gray-50 transition active:scale-95">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-brand-blue/10 text-brand-blue flex items-center justify-center">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                  </div>
                  <div className="text-right">
                    <h4 className="font-bold text-sm text-brand-dark">הפקת דוח גבייה (PDF)</h4>
                    <p className="text-[10px] text-gray-500">מסמך מרוכז ונוח לשמירה והדפסה.</p>
                  </div>
                </div>
              </button>
              
              <button onClick={shareReportWhatsApp} className="w-full flex items-center justify-between bg-white border border-gray-200 p-4 rounded-2xl hover:bg-gray-50 transition active:scale-95">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#25D366]/10 text-[#25D366] flex items-center justify-center">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/></svg>
                  </div>
                  <div className="text-right">
                    <h4 className="font-bold text-sm text-brand-dark">שליחת סיכום לוואטסאפ</h4>
                    <p className="text-[10px] text-gray-500">שתף בקלות את יתרת הקופה בקבוצת הבניין.</p>
                  </div>
                </div>
              </button>

              <button onClick={shareToAppChat} className="w-full flex items-center justify-between bg-white border border-gray-200 p-4 rounded-2xl hover:bg-gray-50 transition active:scale-95">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-brand-blue/10 text-brand-blue flex items-center justify-center">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                  </div>
                  <div className="text-right">
                    <h4 className="font-bold text-sm text-brand-dark">פרסום בלוח המודעות (פיד)</h4>
                    <p className="text-[10px] text-gray-500">הדוח יקפוץ כשכנים ייכנסו לאפליקציה.</p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex justify-center items-end">
          <div className="bg-white w-full max-w-md rounded-t-[32px] p-6 pb-8 shadow-2xl animate-in slide-in-from-bottom-10">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-black text-xl text-brand-dark">דרישת תשלום חדשה</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 bg-gray-100 rounded-full text-brand-dark hover:bg-gray-200 transition">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            <p className="text-xs text-brand-gray mb-5">דרישת התשלום תישלח אישית לכל אחד מהדיירים בבניין.</p>
            <form onSubmit={handleCreatePaymentRequest} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-brand-dark mb-1 block">עבור מה התשלום?</label>
                <input type="text" required value={newPayment.title} onChange={e => setNewPayment({...newPayment, title: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 text-sm outline-none focus:border-brand-blue transition shadow-sm text-brand-dark" placeholder="לדוג': ועד בית חודש מאי" />
              </div>
              <div>
                <label className="text-xs font-bold text-brand-dark mb-1 block">סכום לתשלום מכל דייר (₪)</label>
                <input type="number" required value={newPayment.amount} onChange={e => setNewPayment({...newPayment, amount: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 text-sm outline-none focus:border-brand-blue transition shadow-sm text-brand-dark font-black text-lg" placeholder="150" />
              </div>
              <button type="submit" disabled={isSubmitting} className="w-full bg-brand-blue text-white font-bold py-4 rounded-2xl shadow-[0_8px_20px_rgba(0,68,204,0.3)] mt-4 active:scale-95 transition disabled:opacity-50 text-base">
                {isSubmitting ? 'משדר לכולם...' : 'שדר דרישה לכל הבניין'}
              </button>
            </form>
          </div>
        </div>
      )}

      {payingDebt && (
        <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex justify-center items-end">
          <div className="bg-white w-full max-w-md rounded-t-[32px] p-6 pb-10 shadow-2xl animate-in slide-in-from-bottom-10 min-h-[50vh]">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-black text-xl text-brand-dark">תשלום לוועד הבית</h3>
              <button onClick={() => {setPayingDebt(null); setPaymentFlowStep('select');}} className="p-2 bg-gray-100 rounded-full text-brand-dark hover:bg-gray-200 transition">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>

            <div className="bg-gray-50 rounded-2xl p-4 mb-6 flex justify-between items-center border border-gray-100">
              <div>
                <p className="text-xs text-brand-gray font-bold mb-0.5">עבור:</p>
                <p className="text-sm font-black text-brand-dark">{payingDebt.title}</p>
              </div>
              <div className="text-left">
                <p className="text-xs text-brand-gray font-bold mb-0.5">סכום לתשלום:</p>
                <p className="text-2xl font-black text-brand-blue">₪{payingDebt.amount}</p>
              </div>
            </div>

            {paymentFlowStep === 'select' && (
              <div className="flex flex-col gap-3">
                <p className="text-[11px] font-black text-brand-gray tracking-wider uppercase mb-1">אמצעי תשלום שמורים</p>
                
                {savedCards.length > 0 ? (
                  savedCards.map(card => (
                    <div key={card.id} className="w-full flex items-center justify-between bg-white border-2 border-gray-100 p-4 rounded-[20px] shadow-sm hover:border-brand-blue/50 transition">
                      <button onClick={() => processPayment('saved_card')} className="flex items-center gap-3 flex-1 text-right">
                        <div className="w-10 h-6 bg-brand-dark rounded shrink-0 flex items-center justify-center relative overflow-hidden">
                           <div className="absolute top-0 right-0 w-8 h-8 bg-white/10 rounded-full -mr-4 -mt-4"></div>
                           <span className="text-[8px] font-black text-white tracking-widest italic">VISA</span>
                        </div>
                        <div>
                          <p className="text-sm font-black text-brand-dark font-mono tracking-widest">**** {card.last4}</p>
                          <p className="text-[10px] text-brand-gray font-bold">תוקף: {card.exp}</p>
                        </div>
                      </button>
                      <button onClick={() => deleteSavedCard(card.id)} className="p-2 text-gray-300 hover:text-red-500 transition hover:bg-red-50 rounded-full">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-gray-400 italic mb-2">אין כרטיסים שמורים בחשבון.</p>
                )}

                <button onClick={() => setPaymentFlowStep('new_card')} className="w-full flex items-center justify-center gap-2 bg-brand-blue/5 text-brand-blue border-2 border-dashed border-brand-blue/30 py-4 rounded-[20px] font-bold hover:bg-brand-blue/10 active:scale-95 transition mt-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                  הוסף כרטיס אשראי חדש
                </button>

                <div className="relative flex items-center justify-center mt-4 mb-2">
                  <div className="border-t border-gray-200 w-full absolute"></div>
                  <span className="bg-white px-3 text-[10px] font-bold text-gray-400 relative z-10 uppercase tracking-widest">או</span>
                </div>

                <button onClick={() => processPayment('bank')} className="w-full flex items-center justify-between px-5 bg-white border border-gray-200 py-3.5 rounded-[20px] font-bold hover:bg-gray-50 active:scale-95 transition text-brand-dark">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z"></path></svg>
                    </div>
                    העברה בנקאית למנהל הועד
                  </div>
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
                </button>
              </div>
            )}

            {paymentFlowStep === 'new_card' && (
              <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-right-4">
                <button onClick={() => setPaymentFlowStep('select')} className="text-[10px] font-bold text-brand-blue flex items-center gap-1 mb-2">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg> חזור לאחור
                </button>
                
                <div>
                  <label className="text-[10px] font-bold text-brand-gray mb-1 block">מספר כרטיס אשראי</label>
                  <div className="relative">
                    <input type="text" placeholder="0000 0000 0000 0000" maxLength={19} className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-blue transition font-mono tracking-widest text-left" dir="ltr" onChange={e => setNewCardDetails({...newCardDetails, number: e.target.value})} />
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-[10px] font-bold text-brand-gray mb-1 block">תוקף</label>
                    <input type="text" placeholder="MM/YY" maxLength={5} className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-blue transition font-mono text-center" dir="ltr" onChange={e => setNewCardDetails({...newCardDetails, expiry: e.target.value})} />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] font-bold text-brand-gray mb-1 block">CVV</label>
                    <input type="password" placeholder="123" maxLength={3} className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-blue transition font-mono text-center tracking-widest" dir="ltr" onChange={e => setNewCardDetails({...newCardDetails, cvv: e.target.value})} />
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-2">
                  <label className="flex items-center gap-3 p-3 rounded-xl border border-brand-blue/20 bg-brand-blue/5 cursor-pointer">
                    <input type="checkbox" checked={newCardDetails.saveCard} onChange={e => setNewCardDetails({...newCardDetails, saveCard: e.target.checked})} className="w-4 h-4 text-brand-blue rounded border-gray-300 focus:ring-brand-blue" />
                    <span className="text-xs font-bold text-brand-dark">שמור כרטיס לתשלומים הבאים בבניין</span>
                  </label>
                </div>

                <button onClick={() => processPayment('new_card')} className="w-full bg-brand-dark text-white font-bold py-4 rounded-2xl shadow-lg mt-2 active:scale-95 transition flex items-center justify-center gap-2">
                  שלם ₪{payingDebt.amount}
                </button>
              </div>
            )}

            {paymentFlowStep === 'processing' && (
              <div className="flex flex-col items-center justify-center py-10 gap-4">
                <div className="w-12 h-12 border-4 border-gray-100 border-t-brand-blue rounded-full animate-spin"></div>
                <p className="font-bold text-brand-dark animate-pulse">מעבד תשלום מאובטח...</p>
              </div>
            )}

            {paymentFlowStep === 'success' && (
              <div className="flex flex-col items-center justify-center py-6 gap-3 animate-in zoom-in">
                <div className="w-20 h-20 bg-green-100 text-green-500 rounded-full flex items-center justify-center mb-2">
                  <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                </div>
                <h3 className="text-2xl font-black text-brand-dark">התשלום בוצע!</h3>
                <p className="text-sm text-brand-gray text-center px-4">העברת ₪{payingDebt.amount} לארנק הוועד בהצלחה.</p>
                <button onClick={() => {setPayingDebt(null); setPaymentFlowStep('select');}} className="w-full bg-brand-blue text-white font-bold py-3.5 rounded-2xl shadow-sm mt-6 active:scale-95 transition">
                  סיום
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- התראות מערכת --- */}
      {customAlert && (
        <div className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-white rounded-[32px] p-6 w-full max-w-sm shadow-2xl text-center animate-in zoom-in-95">
            <div className={`w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center ${customAlert.type === 'success' ? 'bg-green-50 text-green-500' : customAlert.type === 'error' ? 'bg-red-50 text-red-500' : 'bg-brand-blue/10 text-brand-blue'}`}>
              {customAlert.type === 'success' && <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"></path></svg>}
              {customAlert.type === 'error' && <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>}
              {customAlert.type === 'info' && <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>}
            </div>
            <h3 className="text-xl font-black text-brand-dark mb-2">{customAlert.title}</h3>
            <p className="text-sm text-brand-gray mb-6 leading-relaxed">{customAlert.message}</p>
            <button onClick={() => setCustomAlert(null)} className="w-full bg-brand-blue text-white font-bold py-3.5 rounded-2xl active:scale-95 transition shadow-sm">
              הבנתי, תודה
            </button>
          </div>
        </div>
      )}

      {customConfirm && (
        <div className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-white rounded-[32px] p-6 w-full max-w-sm shadow-2xl text-center animate-in zoom-in-95">
            <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center bg-brand-blue/10 text-brand-blue">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            </div>
            <h3 className="text-xl font-black text-brand-dark mb-2">{customConfirm.title}</h3>
            <p className="text-sm text-brand-gray mb-6 leading-relaxed">{customConfirm.message}</p>
            <div className="flex gap-3">
              <button onClick={() => setCustomConfirm(null)} className="flex-1 bg-gray-50 text-brand-dark font-bold py-3.5 rounded-2xl hover:bg-gray-100 transition active:scale-95 border border-gray-100">
                ביטול
              </button>
              <button onClick={customConfirm.onConfirm} className="flex-1 bg-brand-blue text-white font-bold py-3.5 rounded-2xl hover:bg-brand-blue/90 transition shadow-sm active:scale-95">
                אישור
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

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
  const [paymentFlowStep, setPaymentFlowStep] = useState<'select' | 'processing' | 'success'>('select')

  const [customAlert, setCustomAlert] = useState<{ title: string, message: string, type: 'success' | 'error' | 'info' } | null>(null)
  const [customConfirm, setCustomConfirm] = useState<{ title: string, message: string, onConfirm: () => void } | null>(null)

  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (prof) {
      setProfile(prof)
      if (prof.building_id) {
        const { data: bld } = await supabase.from('buildings').select('*').eq('id', prof.building_id).single()
        if (bld) setBuilding(bld)
      }

      const query = supabase.from('payments')
        .select('*, profiles!payments_payer_id_fkey(full_name, apartment, avatar_url)')
        .order('created_at', { ascending: false })
      
      if (prof.role === 'admin') query.eq('building_id', prof.building_id)
      else query.eq('payer_id', prof.id)
      
      const { data } = await query
      if (data) setPayments(data)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const channel = supabase.channel('payments_sync_v6')
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
        const itemNames = [...new Set(pendingItems.map(p => p.title))].slice(0, 2).join(' ו-');
        
        const context = pendingItems.length > 0 
          ? `ממתינים תשלומים על ${itemNames}.`
          : `כל התשלומים הוסדרו.`;

        const prompt = `אני ${profile.role === 'admin' ? 'מנהל ועד הבית' : 'דייר'}. ${context} נסח תובנה קצרה וחיובית (עם אימוג'י), ללא המילה 'חוב'. עד 12 מילים.`;
        
        const res = await fetch('/api/ai/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ description: prompt })
        });
        const data = await res.json();
        setAiInsight(data.title || data.text || `תודה על שיתוף הפעולה בניהול הבניין! ✨`);
      } catch (error) {
        setAiInsight(`מערכת הגבייה מעודכנת. ✨`);
      } finally {
        setIsAiLoading(false);
      }
    };
    fetchAiData();
  }, [profile, payments.length]);

  const generatePDF = (title: string, htmlContent: string) => {
    const htmlTemplate = `
      <html dir="rtl"><head><meta charset="utf-8">
      <script src="https://cdn.tailwindcss.com"></script>
      <style>@media print { .no-print { display: none !important; } } body { font-family: system-ui; padding: 20px; }</style>
      </head><body class="bg-gray-50">
        <div class="max-w-xl mx-auto bg-white p-8 rounded-3xl shadow-sm border mt-10">${htmlContent}
          <div class="mt-8 no-print"><button onclick="window.print()" class="w-full bg-slate-800 text-white py-3 rounded-xl font-bold">הדפס / שמור כ-PDF</button></div>
        </div>
      </body></html>
    `;
    const blob = new Blob([htmlTemplate], { type: 'text/html' });
    window.open(URL.createObjectURL(blob), '_blank');
  }

  const downloadReceipt = (p: any) => {
    const date = new Date(p.created_at).toLocaleDateString('he-IL');
    const content = `
      <div class="text-center mb-8 border-b pb-6">
        <h1 class="text-3xl font-black text-blue-600">שכן+</h1>
        <h2 class="text-xl font-bold mt-2">קבלה על תשלום ועד בית</h2>
        <p class="text-gray-500">${building?.name}</p>
      </div>
      <div class="space-y-4">
        <div class="flex justify-between"><strong>תאריך:</strong> <span>${date}</span></div>
        <div class="flex justify-between"><strong>עבור:</strong> <span>${p.title}</span></div>
        <div class="flex justify-between"><strong>שולם ע"י:</strong> <span>${p.profiles?.full_name} (דירה ${p.profiles?.apartment})</span></div>
        <div class="mt-6 p-4 bg-green-50 rounded-xl flex justify-between items-center border border-green-100">
          <span class="font-bold text-green-800">סכום ששולם:</span>
          <span class="text-2xl font-black text-green-600">₪${p.amount}</span>
        </div>
      </div>
      <p class="text-center text-gray-400 text-[10px] mt-10">הופק אוטומטית ע"י מערכת שכן+</p>
    `;
    generatePDF(`Receipt_${p.id}`, content);
  }

  const handleCreatePayment = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    const { data: tenants } = await supabase.from('profiles').select('id').eq('building_id', profile.building_id)
    if (tenants) {
      const pToInsert = tenants.map(t => ({ payer_id: t.id, building_id: profile.building_id, amount: parseFloat(newAmount), title: newTitle, status: 'pending' }))
      await supabase.from('payments').insert(pToInsert)
      setIsCreating(false); setNewTitle(''); setNewAmount(''); fetchData()
      setCustomAlert({ title: 'הצלחה', message: 'דרישת התשלום נשלחה לכל הבניין.', type: 'success' })
    }
    setIsSubmitting(false)
  }

  const sendWhatsAppReminder = (name: string, amount: number, title: string) => {
    const text = encodeURIComponent(`היי ${name}, תזכורת קטנה לגבי תשלום "${title}" ע"ס ₪${amount}. ניתן להסדיר בקלות באפליקציית שכן+ 🙏`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  }

  if (!profile) return null

  const pending = payments.filter(p => p.status === 'pending')
  const approvals = payments.filter(p => p.status === 'pending_approval')
  const history = payments.filter(p => p.status === 'paid')

  const totalCollected = history.reduce((s, p) => s + p.amount, 0)
  const totalPendingVal = pending.reduce((s, p) => s + p.amount, 0)

  const renderList = (list: any[], type: 'pending' | 'approval' | 'history') => {
    if (list.length === 0) return <div className="text-center py-12 bg-white/30 rounded-2xl border border-white/50 text-slate-400 font-bold">אין נתונים להצגה</div>
    const isExpanded = expandedTabs[type];
    const displayList = isExpanded ? list : list.slice(0, 5);

    return (
      <div className="space-y-3">
        {displayList.map(p => (
          <div key={p.id} className="bg-white/70 backdrop-blur-xl border border-white/80 p-4 rounded-2xl shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={p.profiles?.avatar_url || `https://api.dicebear.com/8.x/initials/svg?seed=${p.profiles?.full_name}`} className="w-10 h-10 rounded-full border border-white shadow-sm" />
              <div>
                <h4 className="font-black text-slate-800 text-sm">{p.title}</h4>
                <p className="text-[10px] font-bold text-slate-500">{isAdmin ? `${p.profiles?.full_name} (דירה ${p.profiles?.apartment})` : type === 'history' ? 'בוצע בהצלחה' : 'ממתין לתשלום'}</p>
              </div>
            </div>
            <div className="text-left flex flex-col items-end gap-1">
              <span className={`text-lg font-black ${type === 'history' ? 'text-[#059669]' : 'text-red-600'}`}>₪{p.amount}</span>
              <div className="flex gap-2">
                {type === 'pending' && !isAdmin && <button onClick={() => {setPayingItem(p); setPaymentFlowStep('select')}} className="bg-[#1D4ED8] text-white text-[9px] font-black px-3 py-1.5 rounded-lg">שלם עכשיו</button>}
                {type === 'pending' && isAdmin && <button onClick={() => sendWhatsAppReminder(p.profiles?.full_name, p.amount, p.title)} className="bg-[#25D366]/10 text-[#25D366] p-1.5 rounded-lg"><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg></button>}
                {type === 'approval' && isAdmin && <button onClick={() => handleApprovePayment(p.id)} className="bg-[#059669] text-white text-[9px] font-black px-4 py-2 rounded-lg">אשר קבלה</button>}
                {type === 'history' && <button onClick={() => downloadReceipt(p)} className="text-[#1D4ED8] bg-[#1D4ED8]/10 p-2 rounded-lg hover:bg-white transition"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg></button>}
              </div>
            </div>
          </div>
        ))}
        {list.length > 5 && (
          <button onClick={() => toggleExpand(type)} className="w-full flex items-center justify-center gap-1 text-[#1D4ED8] py-2 bg-white/20 rounded-xl mt-2 border border-white/30">
            <span className="text-[11px] font-black">{isExpanded ? 'סגור רשימה' : `הצג עוד ${list.length - 5} פריטים`}</span>
            <svg className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7"></path></svg>
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 w-full pb-32 bg-transparent min-h-screen" dir="rtl">
      <div className="px-6 pt-6 pb-4 flex justify-between items-end">
         <h2 className="text-2xl font-black text-slate-800">הארנק הדיגיטלי</h2>
         {isAdmin && <button onClick={() => setIsShareMenuOpen(true)} className="p-2 bg-white/60 backdrop-blur-md rounded-xl border border-white shadow-sm"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg></button>}
      </div>

      <div className="px-6 space-y-6">
        {/* כרטיס יתרה */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-[2rem] shadow-xl text-white relative overflow-hidden">
          <div className="relative z-10 flex justify-between">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{isAdmin ? 'קופת הבניין' : 'הסכום ששילמתי'}</p>
              <h3 className="text-4xl font-black">₪{totalCollected.toLocaleString()}</h3>
            </div>
            <div className="text-left">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">ממתין לתשלום</p>
              <h3 className="text-xl font-black text-red-400">₪{totalPendingVal.toLocaleString()}</h3>
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-white/10 flex justify-between items-center">
             <span className="text-[10px] font-bold text-white/60">אחוז גבייה בבניין:</span>
             <span className="text-xs font-black text-[#059669]">{Math.round((totalCollected / (totalCollected + totalPendingVal)) * 100 || 0)}%</span>
          </div>
        </div>

        {/* AI Advisor */}
        <div className="bg-white/60 backdrop-blur-md border border-white/50 p-4 rounded-2xl flex items-center gap-4 shadow-sm">
          <div className="w-10 h-10 rounded-full bg-[#1D4ED8] flex items-center justify-center shrink-0 text-white shadow-sm border border-blue-400/30">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" /></svg>
          </div>
          <p className="text-xs font-bold text-slate-700">{isAiLoading ? 'מעבד נתונים...' : aiInsight}</p>
        </div>

        {/* טאבים */}
        <div className="space-y-4">
          <div className="flex bg-white/40 backdrop-blur-md p-1.5 rounded-2xl border border-white shadow-sm">
            <button onClick={() => setActiveTab('pending')} className={`flex-1 py-2.5 text-[11px] font-black rounded-xl transition ${activeTab === 'pending' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500'}`}>ממתינים ({pending.length})</button>
            {isAdmin && <button onClick={() => setActiveTab('approval')} className={`flex-1 py-2.5 text-[11px] font-black rounded-xl transition ${activeTab === 'approval' ? 'bg-white text-orange-500 shadow-sm' : 'text-slate-500'}`}>לאישור ({approvals.length})</button>}
            <button onClick={() => setActiveTab('history')} className={`flex-1 py-2.5 text-[11px] font-black rounded-xl transition ${activeTab === 'history' ? 'bg-white text-[#059669] shadow-sm' : 'text-slate-500'}`}>שולמו</button>
          </div>

          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            {activeTab === 'pending' && renderList(pending, 'pending')}
            {activeTab === 'approval' && renderList(approvals, 'approval')}
            {activeTab === 'history' && renderList(history, 'history')}
          </div>
        </div>
      </div>

      {/* FAB לוועד */}
      {isAdmin && (
        <button onClick={() => setIsCreating(true)} className="fixed bottom-28 left-6 z-40 bg-[#1D4ED8] text-white px-6 py-4 rounded-full shadow-2xl active:scale-95 transition font-black text-sm border-2 border-white/20">דרישת תשלום</button>
      )}

      {/* מודל דרישה */}
      {isCreating && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end">
          <div className="bg-white w-full rounded-t-[2.5rem] p-8 pb-12 animate-in slide-in-from-bottom-full">
            <div className="flex justify-between items-center mb-6"><h3 className="font-black text-xl">דרישה קולקטיבית</h3><button onClick={() => setIsCreating(false)}><svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg></button></div>
            <form onSubmit={handleCreatePayment} className="space-y-4">
              <input type="text" placeholder="עבור מה התשלום? (לדוג: ועד יולי)" value={newTitle} onChange={e => setNewTitle(e.target.value)} required className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl outline-none focus:border-blue-500 font-bold" />
              <input type="number" placeholder="סכום פר דייר (₪)" value={newAmount} onChange={e => setNewAmount(e.target.value)} required className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl outline-none focus:border-blue-500 font-black text-xl text-red-600" />
              <button type="submit" disabled={isSubmitting} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black shadow-lg">שלח לכל הדיירים</button>
            </form>
          </div>
        </div>
      )}

      {/* הודעות מערכת */}
      {customAlert && (
        <div className="fixed inset-0 z-[120] bg-black/50 backdrop-blur-sm flex items-center justify-center p-6 text-center">
          <div className="bg-white rounded-[2rem] p-8 w-full max-w-xs shadow-2xl animate-in zoom-in-95">
             <div className="w-16 h-16 bg-green-50 text-[#059669] rounded-full flex items-center justify-center mx-auto mb-4"><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg></div>
             <h3 className="text-xl font-black mb-2">{customAlert.title}</h3>
             <p className="text-sm text-slate-500 mb-6">{customAlert.message}</p>
             <button onClick={() => setCustomAlert(null)} className="w-full bg-[#1D4ED8] text-white py-3 rounded-xl font-bold">הבנתי</button>
          </div>
        </div>
      )}

      {isShareMenuOpen && (
        <div className="fixed inset-0 z-[110] bg-black/40 backdrop-blur-sm flex items-end">
           <div className="bg-white w-full rounded-t-[2rem] p-6 pb-12 animate-in slide-in-from-bottom-full">
              <h3 className="font-black text-lg mb-6 text-center border-b pb-4">ניהול ושקיפות</h3>
              <div className="grid grid-cols-2 gap-4">
                 <button onClick={generateAdminReport} className="bg-slate-50 p-6 rounded-2xl flex flex-col items-center gap-2 border border-slate-100 shadow-sm"><svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg><span className="text-xs font-black">הפק דוח PDF</span></button>
                 <button onClick={shareToAppChat} className="bg-slate-50 p-6 rounded-2xl flex flex-col items-center gap-2 border border-slate-100 shadow-sm"><svg className="w-8 h-8 text-[#25D366]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z"></path></svg><span className="text-xs font-black">שלח לצ'אט</span></button>
              </div>
              <button onClick={() => setIsShareMenuOpen(false)} className="w-full mt-6 text-slate-400 font-bold text-sm">ביטול</button>
           </div>
        </div>
      )}

      {/* Checkout Flow */}
      {payingItem && (
        <div className="fixed inset-0 z-[150] bg-black/60 backdrop-blur-md flex items-end">
           <div className="bg-white w-full rounded-t-[3rem] p-8 pb-16 animate-in slide-in-from-bottom-full">
              <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-8"></div>
              <h3 className="text-2xl font-black text-center mb-8">הסדרת תשלום</h3>
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 mb-8 flex justify-between items-center">
                 <div><p className="text-xs text-slate-400 font-bold uppercase mb-1">עבור:</p><p className="font-black">{payingItem.title}</p></div>
                 <div className="text-left font-black text-3xl text-red-600">₪{payingItem.amount}</div>
              </div>
              
              {paymentFlowStep === 'select' && (
                <div className="space-y-4">
                   <button onClick={() => processPayment('new_card')} className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black flex items-center justify-center gap-3">
                     <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path></svg>
                     כרטיס אשראי מאובטח
                   </button>
                   <button onClick={() => processPayment('bit')} className="w-full bg-white border-2 border-slate-100 py-5 rounded-2xl font-black flex items-center justify-center gap-3 text-slate-800">
                     <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white font-black text-[10px]">bit</div>
                     דיווח תשלום בביט/מזומן
                   </button>
                </div>
              )}

              {paymentFlowStep === 'processing' && (
                <div className="flex flex-col items-center py-10 gap-4">
                  <div className="w-12 h-12 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin"></div>
                  <p className="font-bold text-slate-800 animate-pulse">מתחבר למסוף מאובטח...</p>
                </div>
              )}

              {paymentFlowStep === 'success' && (
                <div className="text-center py-6">
                  <div className="w-20 h-20 bg-green-50 text-[#059669] rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm"><svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7"></path></svg></div>
                  <h3 className="text-2xl font-black mb-6 text-slate-800">התשלום עבר!</h3>
                  <button onClick={() => setPayingItem(null)} className="w-full bg-slate-800 text-white py-4 rounded-2xl font-black">סיום</button>
                </div>
              )}
           </div>
        </div>
      )}
    </div>
  )
}

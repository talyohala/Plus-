'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'

export default function PaymentsPage() {
  const [profile, setProfile] = useState<any>(null)
  const [myPayments, setMyPayments] = useState<any[]>([])
  const [buildingPayments, setBuildingPayments] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<'my_debts' | 'admin_collection'>('my_debts')
  
  const [totalCollected, setTotalCollected] = useState(0)
  const [totalPending, setTotalPending] = useState(0)
  
  // מודל פתיחת בקשת תשלום (לוועד)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [newPayment, setNewPayment] = useState({ title: '', amount: '' })

  // עריכת בקשת תשלום קיימת (לוועד - 3 נקודות)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null)
  const [editPaymentData, setEditPaymentData] = useState({ title: '', amount: '' })

  // מערכת תשלום וארנק לדייר
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
    if (prof.saved_payment_methods) {
      setSavedCards(prof.saved_payment_methods)
    }

    if (prof.role === 'admin' && activeTab === 'admin_collection') {
      // נשאר בטאב הנוכחי
    } else if (prof.role === 'admin' && activeTab !== 'admin_collection' && myPayments.length === 0) {
      setActiveTab('admin_collection')
    }

    const { data: myData } = await supabase.from('payments')
      .select('*, collector:profiles!payments_collector_id_fkey(full_name)')
      .eq('payer_id', prof.id)
      .order('status', { ascending: false })
      .order('created_at', { ascending: false })
    
    if (myData) setMyPayments(myData)

    if (prof.role === 'admin') {
      const { data: bldData } = await supabase.from('payments')
        .select('*, payer:profiles!payments_payer_id_fkey(full_name, avatar_url, apartment)')
        .eq('building_id', prof.building_id)
        .order('created_at', { ascending: false })
      
      if (bldData) {
        setBuildingPayments(bldData)
        let collected = 0
        let pending = 0
        bldData.forEach(p => {
          if (p.status === 'paid') collected += p.amount
          if (p.status === 'pending') pending += p.amount
        })
        setTotalCollected(collected)
        setTotalPending(pending)
      }
    }
  }

  useEffect(() => {
    let currentUser: any = null
    supabase.auth.getUser().then(({ data: { user } }) => {
      currentUser = user
      if (user) fetchData(user)
    })

    const channel = supabase.channel('payments_realtime_v4')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => currentUser && fetchData(currentUser))
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  // --- פעולות ועד הבית --- //
  const handleCreatePaymentRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile?.building_id || !newPayment.title || !newPayment.amount) return
    setIsSubmitting(true)
    const { data: tenants } = await supabase.from('profiles').select('id').eq('building_id', profile.building_id)
    if (tenants && tenants.length > 0) {
      const paymentsToInsert = tenants.map(tenant => ({
        building_id: profile.building_id, collector_id: profile.id, payer_id: tenant.id, title: newPayment.title, amount: parseInt(newPayment.amount)
      }))
      await supabase.from('payments').insert(paymentsToInsert)
      setIsModalOpen(false)
      setNewPayment({ title: '', amount: '' })
      fetchData(profile)
      setCustomAlert({ title: 'מעולה!', message: 'דרישת התשלום שודרה בהצלחה לכל הדיירים.', type: 'success' })
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
      message: 'האם להעניק פטור? החוב יאופס ויסומן כ"פטור".',
      onConfirm: async () => {
        await supabase.from('payments').update({ status: 'exempt' }).eq('id', paymentId)
        fetchData(profile)
        setCustomConfirm(null)
      }
    })
  }

  const sendWhatsAppReminder = (tenantName: string, amount: number, title: string) => {
    const text = encodeURIComponent(`היי ${tenantName}, תזכורת מהוועד לגבי "${title}" (סך ${amount} ₪). אשמח להסדרה 🙏`)
    window.open(`https://wa.me/?text=${text}`, '_blank')
    setOpenMenuId(null)
  }

  // --- פעולות תשלום של הדייר --- //
  const startPaymentFlow = (payment: any) => {
    setPayingDebt(payment)
    setPaymentFlowStep('select')
  }

  const processPayment = async (method: string) => {
    if (!payingDebt) return
    setPaymentFlowStep('processing')
    
    // סימולציית תשלום (2 שניות)
    setTimeout(async () => {
      await supabase.from('payments').update({ status: 'paid' }).eq('id', payingDebt.id)
      
      // אם בחר לשמור כרטיס חדש, נשמור אותו בפרופיל
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

  const isAdmin = profile?.role === 'admin'

  return (
    <div className="flex flex-col flex-1 w-full pb-24 relative" dir="rtl">
      
      <div className="px-4 mb-4 mt-2">
        <h2 className="text-2xl font-black text-brand-dark">תשלומים וועד</h2>
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
          החובות שלי
        </button>
      </div>

      <div className="space-y-4 px-4">
        {activeTab === 'my_debts' ? (
          /* --- מסך החובות שלי --- */
          myPayments.length === 0 ? (
            <div className="text-center py-10 bg-white/50 rounded-3xl border border-gray-100 shadow-sm">
              <p className="text-brand-gray font-medium">אין לך חובות לתשלום! הכל משולם.</p>
            </div>
          ) : (
            myPayments.map(payment => (
              <div key={payment.id} className={`bg-white p-5 rounded-3xl shadow-sm border flex items-center justify-between transition ${payment.status === 'pending' ? 'border-brand-blue/30 shadow-[0_4px_20px_rgba(0,68,204,0.08)]' : 'border-gray-50 opacity-80'}`}>
                <div>
                  <h3 className={`font-black text-lg leading-tight mb-1 ${payment.status === 'exempt' ? 'text-gray-400 line-through' : 'text-brand-dark'}`}>{payment.title}</h3>
                  <p className="text-[10px] text-brand-gray mb-2">דרישה מאת: {payment.collector?.full_name}</p>
                  
                  {payment.status === 'pending' && <span className="text-[10px] font-bold px-2.5 py-1 rounded-md bg-orange-50 text-orange-600 border border-orange-100">ממתין לתשלום</span>}
                  {payment.status === 'paid' && <span className="text-[10px] font-bold px-2.5 py-1 rounded-md bg-green-50 text-green-600 border border-green-100">שולם בהצלחה</span>}
                  {payment.status === 'exempt' && <span className="text-[10px] font-bold px-2.5 py-1 rounded-md bg-gray-100 text-gray-500 border border-gray-200">פטור באדיבות הוועד</span>}
                </div>
                
                <div className="flex flex-col items-end gap-3">
                  <span className={`text-2xl font-black ${payment.status === 'exempt' ? 'text-gray-400' : 'text-brand-dark'}`}>₪{payment.amount}</span>
                  {payment.status === 'pending' && (
                    <button onClick={() => startPaymentFlow(payment)} className="bg-brand-dark text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-[0_4px_15px_rgba(14,30,45,0.2)] active:scale-95 transition flex items-center gap-1.5">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path></svg>
                      לתשלום מאובטח
                    </button>
                  )}
                </div>
              </div>
            ))
          )
        ) : (
          /* --- מסך ניהול גבייה --- */
          <div className="flex flex-col gap-4">
            <div className="bg-gradient-to-br from-[#0e1e2d] to-brand-blue p-6 rounded-3xl text-white shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
              <div className="relative z-10 flex justify-between items-start mb-2">
                <p className="text-xs font-bold text-white/80 tracking-wide uppercase">יתרת קופת ועד הבית</p>
                <svg className="w-6 h-6 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path></svg>
              </div>
              <h3 className="text-4xl font-black mb-6 relative z-10 tracking-tight">₪{totalCollected.toLocaleString()}</h3>
              <div className="flex gap-3 relative z-10">
                <button onClick={() => setCustomAlert({title:'בפיתוח', message:'חיבור ישיר לחשבון הבנק של הוועד יתאפשר בקרוב.', type:'info'})} className="flex-1 bg-white text-brand-dark text-[11px] font-bold py-3 rounded-xl shadow-md active:scale-95 transition flex items-center justify-center gap-1.5">
                  משיכה לבנק
                </button>
                <button onClick={() => setCustomAlert({title:'בפיתוח', message:'סליקה והעברה לביט יתאפשרו בקרוב.', type:'info'})} className="flex-1 bg-[#00b4db] text-white text-[11px] font-bold py-3 rounded-xl shadow-md active:scale-95 transition flex items-center justify-center gap-1.5 border border-white/10">
                  משיכה לביט
                </button>
              </div>
              <div className="mt-5 pt-4 border-t border-white/10 flex justify-between items-center text-xs relative z-10">
                <span className="text-white/70">חובות דיירים פתוחים:</span>
                <span className="font-bold text-orange-300 tracking-wide">₪{totalPending.toLocaleString()}</span>
              </div>
            </div>

            <h4 className="text-sm font-black text-brand-dark mt-2 mb-1">פירוט גבייה ותזכורות</h4>
            {buildingPayments.length === 0 ? (
              <div className="text-center py-8 bg-white/50 rounded-3xl border border-gray-100 shadow-sm">
                <p className="text-brand-gray font-medium text-sm">עדיין לא יצרת דרישות תשלום.</p>
              </div>
            ) : (
              buildingPayments.map(payment => (
                <div key={payment.id} className={`bg-white p-4 rounded-3xl shadow-sm border flex flex-col gap-3 relative transition ${payment.status === 'exempt' ? 'opacity-60 border-gray-50' : 'border-gray-50'}`}>
                  
                  {/* שלוש נקודות למנהל בניהול התשלומים */}
                  <div className="absolute top-4 left-4 z-20">
                    <div className="relative">
                      <button onClick={() => setOpenMenuId(openMenuId === payment.id ? null : payment.id)} className="p-1 text-gray-400 hover:text-brand-dark transition active:scale-95">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"></path></svg>
                      </button>
                      
                      {openMenuId === payment.id && (
                        <div className="absolute left-0 mt-1 w-36 bg-white border border-gray-100 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] overflow-hidden z-30">
                          {payment.status === 'pending' && (
                            <button onClick={() => handleEditClick(payment)} className="w-full text-right px-4 py-3 text-xs font-bold text-brand-dark hover:bg-gray-50 flex items-center gap-2">
                               <svg className="w-4 h-4 text-brand-gray" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                               ערוך דרישה
                            </button>
                          )}
                          {payment.status === 'pending' && (
                            <button onClick={() => markAsExempt(payment.id)} className="w-full text-right px-4 py-3 text-xs font-bold text-brand-dark hover:bg-gray-50 flex items-center gap-2 border-t border-gray-50">
                               <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                               הענק פטור
                            </button>
                          )}
                          <button onClick={() => deletePayment(payment.id)} className="w-full text-right px-4 py-3 text-xs font-bold text-red-500 hover:bg-red-50 flex items-center gap-2 border-t border-gray-50">
                             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                             מחק דרישה
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {editingPaymentId === payment.id ? (
                    <form onSubmit={(e) => handleInlineEditSubmit(e, payment.id)} className="bg-gray-50 p-4 rounded-2xl flex flex-col gap-3 mt-1 border border-brand-blue/20 mr-6">
                      <input type="text" required value={editPaymentData.title} onChange={e => setEditPaymentData({...editPaymentData, title: e.target.value})} className="w-full bg-white border border-brand-blue/30 rounded-xl px-3 py-2 text-sm outline-none focus:border-brand-blue" placeholder="עבור מה התשלום?" />
                      <input type="number" required value={editPaymentData.amount} onChange={e => setEditPaymentData({...editPaymentData, amount: e.target.value})} className="w-full bg-white border border-brand-blue/30 rounded-xl px-3 py-2 text-sm outline-none focus:border-brand-blue font-black" placeholder="סכום (₪)" />
                      <div className="flex justify-end gap-2 mt-1">
                        <button type="button" onClick={() => setEditingPaymentId(null)} className="px-4 py-2 text-xs font-bold text-gray-500 hover:bg-gray-100 rounded-xl transition">ביטול</button>
                        <button type="submit" disabled={isSubmitting} className="px-4 py-2 text-xs font-bold text-white bg-brand-blue rounded-xl shadow-sm transition active:scale-95">{isSubmitting ? 'שומר...' : 'שמור שינויים'}</button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div className="flex justify-between items-start pr-1">
                        <div>
                          <h3 className="font-black text-brand-dark text-base leading-tight mb-1.5 pr-1">{payment.title}</h3>
                          <div className="flex items-center gap-2">
                             <img src={payment.payer?.avatar_url || `https://api.dicebear.com/8.x/initials/svg?seed=${payment.payer?.full_name}&backgroundColor=eef2ff&textColor=1e3a8a`} className="w-5 h-5 rounded-full border border-gray-100" />
                             <p className="text-xs text-brand-gray font-bold">{payment.payer?.full_name} {payment.payer?.apartment ? `(דירה ${payment.payer.apartment})` : ''}</p>
                          </div>
                        </div>
                        <span className={`text-xl font-black ml-8 mt-1 ${payment.status === 'exempt' ? 'text-gray-400 line-through' : 'text-brand-dark'}`}>₪{payment.amount}</span>
                      </div>
                      
                      <div className="flex items-center justify-between border-t border-gray-50 pt-3">
                        <div className="flex items-center gap-2">
                          {payment.status === 'pending' && <span className="text-[10px] font-bold px-2.5 py-1 rounded-md bg-orange-50 text-orange-600">טרם שילם</span>}
                          {payment.status === 'paid' && <span className="text-[10px] font-bold px-2.5 py-1 rounded-md bg-green-50 text-green-600">שולם</span>}
                          {payment.status === 'exempt' && <span className="text-[10px] font-bold px-2.5 py-1 rounded-md bg-gray-100 text-gray-500">פטור מתשלום</span>}
                          
                          {payment.status === 'pending' && (
                            <button onClick={() => sendWhatsAppReminder(payment.payer?.full_name, payment.amount, payment.title)} className="bg-[#25D366]/10 text-[#25D366] p-1.5 rounded-lg hover:bg-[#25D366]/20 transition active:scale-95" title="שלח תזכורת בוואטסאפ">
                              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/></svg>
                            </button>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))
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

      {/* מודל פתיחת קריאת תשלום חדשה ע"י הוועד */}
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

      {/* --- ארנק דייר מורחב: תפריט תשלום מאובטח (Bottom Sheet) --- */}
      {payingDebt && (
        <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex justify-center items-end">
          <div className="bg-white w-full max-w-md rounded-t-[32px] p-6 pb-10 shadow-2xl animate-in slide-in-from-bottom-10 min-h-[50vh]">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-black text-xl text-brand-dark">תשלום לוועד הבית</h3>
              <button onClick={() => {setPayingDebt(null); setPaymentFlowStep('select');}} className="p-2 bg-gray-100 rounded-full text-brand-dark hover:bg-gray-200 transition">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>

            {/* פרטי החיוב */}
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

            {/* שלב 1: בחירת אמצעי תשלום */}
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
                      <button onClick={() => deleteSavedCard(card.id)} className="p-2 text-gray-300 hover:text-red-500 transition hover:bg-red-50 rounded-full" title="מחק כרטיס">
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
                    העברה בנקאית (קבלת פרטים)
                  </div>
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
                </button>
              </div>
            )}

            {/* שלב 2: הוספת אשראי חדש */}
            {paymentFlowStep === 'new_card' && (
              <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-right-4">
                <button onClick={() => setPaymentFlowStep('select')} className="text-[10px] font-bold text-brand-blue flex items-center gap-1 mb-2">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg> חזור לאחור
                </button>
                
                <div>
                  <label className="text-[10px] font-bold text-brand-gray mb-1 block">מספר כרטיס אשראי</label>
                  <div className="relative">
                    <input type="text" placeholder="0000 0000 0000 0000" maxLength={19} className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-blue transition font-mono tracking-widest text-left" dir="ltr" onChange={e => setNewCardDetails({...newCardDetails, number: e.target.value})} />
                    <svg className="w-5 h-5 absolute left-3 top-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path></svg>
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
                  
                  {newCardDetails.saveCard && (
                    <label className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 cursor-pointer hover:bg-gray-50 transition">
                      <input type="checkbox" checked={newCardDetails.autoPay} onChange={e => setNewCardDetails({...newCardDetails, autoPay: e.target.checked})} className="w-4 h-4 text-brand-blue rounded border-gray-300 focus:ring-brand-blue mt-0.5" />
                      <div>
                        <span className="text-xs font-bold text-brand-dark block">הפעל תשלום אוטומטי (הוראת קבע)</span>
                        <span className="text-[10px] text-brand-gray">דרישות ועד עתידיות ישולמו אוטומטית מכרטיס זה.</span>
                      </div>
                    </label>
                  )}
                </div>

                <button onClick={() => processPayment('new_card')} className="w-full bg-brand-dark text-white font-bold py-4 rounded-2xl shadow-lg mt-2 active:scale-95 transition flex items-center justify-center gap-2">
                  שלם ₪{payingDebt.amount}
                </button>
              </div>
            )}

            {/* שלב עיבוד נתונים */}
            {paymentFlowStep === 'processing' && (
              <div className="flex flex-col items-center justify-center py-10 gap-4">
                <div className="w-12 h-12 border-4 border-gray-100 border-t-brand-blue rounded-full animate-spin"></div>
                <p className="font-bold text-brand-dark animate-pulse">מעבד תשלום מאובטח...</p>
              </div>
            )}

            {/* שלב הצלחה */}
            {paymentFlowStep === 'success' && (
              <div className="flex flex-col items-center justify-center py-6 gap-3 animate-in zoom-in">
                <div className="w-20 h-20 bg-green-100 text-green-500 rounded-full flex items-center justify-center mb-2">
                  <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                </div>
                <h3 className="text-2xl font-black text-brand-dark">התשלום בוצע!</h3>
                <p className="text-sm text-brand-gray text-center px-4">העברת ₪{payingDebt.amount} לארנק הוועד בהצלחה. קבלה נשלחה למייל.</p>
                <button onClick={() => {setPayingDebt(null); setPaymentFlowStep('select');}} className="w-full bg-brand-blue text-white font-bold py-3.5 rounded-2xl shadow-sm mt-6 active:scale-95 transition">
                  חזור למסך התשלומים
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- התראות מערכת המעוצבות שלנו --- */}
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
                אישור פעולה
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

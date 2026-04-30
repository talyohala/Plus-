'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'

export default function PaymentsPage() {
  const [profile, setProfile] = useState<any>(null)
  const [requests, setRequests] = useState<any[]>([])
  const [myPayments, setMyPayments] = useState<string[]>([])
  const [allPayments, setAllPayments] = useState<any[]>([])
  const [totalWithdrawn, setTotalWithdrawn] = useState(0)
  const [isProcessing, setIsProcessing] = useState<string | null>(null)
  
  // מודלים של הוועד
  const [isReqModalOpen, setIsReqModalOpen] = useState(false)
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Form states
  const [newRequest, setNewRequest] = useState({ title: '', amount: '' })
  const [withdrawAmount, setWithdrawAmount] = useState('')

  const TOTAL_TENANTS = 32 // מספר דיירים להדגמת אחוזים

  const fetchData = async (user: any) => {
    // 1. הבאת הפרופיל (לבדוק אם הוא אדמין ולאיזה בניין הוא שייך)
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (!prof || !prof.building_id) return
    setProfile(prof)

    // 2. הבאת דרישות התשלום של הבניין הספציפי
    const { data: reqs } = await supabase.from('payment_requests')
      .select('*').eq('building_id', prof.building_id).order('created_at', { ascending: false })
    
    if (reqs) {
      setRequests(reqs)
      const reqIds = reqs.map(r => r.id)
      
      // 3. הבאת התשלומים בפועל (כדי לחשב הכנסות)
      if (reqIds.length > 0) {
        const { data: pays } = await supabase.from('tenant_payments').select('*').in('request_id', reqIds)
        if (pays) {
          setAllPayments(pays)
          setMyPayments(pays.filter(p => p.user_id === user.id).map(p => p.request_id))
        }
      } else {
        setAllPayments([])
        setMyPayments([])
      }
    }

    // 4. הבאת משיכות הכספים שהוועד ביצע
    const { data: withs } = await supabase.from('withdrawals').select('amount').eq('building_id', prof.building_id)
    if (withs) {
      setTotalWithdrawn(withs.reduce((sum, w) => sum + w.amount, 0))
    }
  }

  useEffect(() => {
    let currentUser: any = null;
    supabase.auth.getUser().then(({ data: { user } }) => {
      currentUser = user
      if (user) fetchData(user)
    })
    
    // האזנה לכל שינוי בארנק
    const channel = supabase.channel('payments_realtime_final')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tenant_payments' }, () => currentUser && fetchData(currentUser))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_requests' }, () => currentUser && fetchData(currentUser))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'withdrawals' }, () => currentUser && fetchData(currentUser))
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  // חישובים דינמיים של הקופה
  const totalIncome = allPayments.reduce((sum, pay) => {
    const req = requests.find(r => r.id === pay.request_id)
    return sum + (req ? req.amount : 0)
  }, 0)
  const currentBalance = totalIncome - totalWithdrawn
  const isAdmin = profile?.role === 'admin'

  // פעולות: תשלום של דייר
  const handlePay = async (requestId: string) => {
    if (!profile) return
    setIsProcessing(requestId)
    setTimeout(async () => {
      await supabase.from('tenant_payments').insert([{ request_id: requestId, user_id: profile.id }])
      fetchData(profile)
      setIsProcessing(null)
    }, 800)
  }

  // פעולות: בקשת תשלום (ועד)
  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newRequest.title || !newRequest.amount || !profile?.building_id) return
    setIsSubmitting(true)
    const { error } = await supabase.from('payment_requests').insert([{ 
      building_id: profile.building_id,
      title: newRequest.title, 
      amount: parseInt(newRequest.amount) 
    }])
    if (!error) {
      setIsReqModalOpen(false)
      setNewRequest({ title: '', amount: '' })
      fetchData(profile)
    }
    setIsSubmitting(false)
  }

  // פעולות: משיכת כספים (ועד)
  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault()
    const amountNum = parseInt(withdrawAmount)
    if (!amountNum || !profile?.building_id || amountNum > currentBalance) {
        alert("סכום לא תקין או עולה על היתרה בקופה.")
        return
    }
    setIsSubmitting(true)
    const { error } = await supabase.from('withdrawals').insert([{
      building_id: profile.building_id,
      admin_id: profile.id,
      amount: amountNum
    }])
    if (!error) {
      setIsWithdrawModalOpen(false)
      setWithdrawAmount('')
      fetchData(profile)
    }
    setIsSubmitting(false)
  }

  return (
    <div className="flex flex-col flex-1 w-full pb-32 relative" dir="rtl">
      
      {/* כותרת נקייה */}
      <div className="px-4 mb-6 mt-2">
        <h2 className="text-2xl font-black text-brand-dark">תשלומים</h2>
      </div>

      {/* כרטיס קופת הוועד */}
      <div className="px-4 mb-8">
        <div className="bg-brand-blue rounded-3xl p-6 text-white shadow-[0_10px_40px_rgba(0,68,204,0.3)] relative overflow-hidden">
          <div className="absolute -left-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
          <div className="absolute right-0 bottom-0 w-32 h-32 bg-[#003399]/40 rounded-full blur-2xl pointer-events-none"></div>
          
          <div className="relative z-10">
            <div className="flex justify-between items-start">
               <p className="text-sm text-blue-100 font-medium mb-1">יתרת קופת הוועד</p>
               {isAdmin && (
                 <span className="text-[10px] font-bold bg-white/20 px-2 py-1 rounded-lg">מצב ניהול</span>
               )}
            </div>
            <h3 className="text-4xl font-black mb-5">₪{currentBalance.toLocaleString()}</h3>
            
            <div className="flex gap-3 text-xs font-bold">
              <div className="bg-white/10 backdrop-blur-sm px-3 py-2 rounded-xl flex-1 border border-white/10">
                <span className="block text-blue-200 font-medium text-[10px] mb-0.5">סך הכנסות</span>
                <span>+ ₪{totalIncome.toLocaleString()}</span>
              </div>
              <div className="bg-white/10 backdrop-blur-sm px-3 py-2 rounded-xl flex-1 border border-white/10">
                <span className="block text-blue-200 font-medium text-[10px] mb-0.5">הוצאות/משיכות</span>
                <span>- ₪{totalWithdrawn.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 mb-4">
        <h3 className="font-bold text-brand-dark">פירוט תשלומים</h3>
      </div>

      {/* רשימת דרישות תשלום */}
      <div className="space-y-4 px-4">
        {requests.length === 0 ? (
           <div className="text-center py-8 bg-gray-50 rounded-3xl border border-gray-100">
             <p className="text-brand-gray text-sm">אין כרגע בקשות תשלום פתוחות.</p>
           </div>
        ) : (
          requests.map(req => {
            const isPaid = myPayments.includes(req.id)
            const processing = isProcessing === req.id
            const paidCount = allPayments.filter(p => p.request_id === req.id).length
            const progressPercent = Math.min(Math.round((paidCount / TOTAL_TENANTS) * 100), 100)

            return (
              <div key={req.id} className={`p-5 rounded-3xl border transition-all ${isPaid ? 'bg-brand-blue/5 border-brand-blue/10 shadow-none' : 'bg-white border-gray-100 shadow-sm'}`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${isPaid ? 'bg-brand-blue/10 text-brand-blue' : 'bg-gray-50 text-brand-dark'}`}>
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 11-4 0H9zM9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
                    </div>
                    <div>
                      <h4 className={`font-bold text-sm ${isPaid ? 'text-brand-blue' : 'text-brand-dark'}`}>{req.title}</h4>
                      <p className="text-[10px] text-brand-gray font-medium mt-0.5">{new Date(req.created_at).toLocaleDateString('he-IL')}</p>
                    </div>
                  </div>
                  <span className={`font-black ${isPaid ? 'text-brand-blue' : 'text-brand-dark'}`}>₪{req.amount}</span>
                </div>

                <div className="mb-4">
                  <div className="flex justify-between text-[10px] font-bold mb-1">
                    <span className="text-brand-gray">שולם ע"י {paidCount} שכנים</span>
                    <span className="text-brand-blue">{progressPercent}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-brand-blue h-1.5 rounded-full transition-all duration-1000" style={{ width: `${progressPercent}%` }}></div>
                  </div>
                </div>
                
                {isPaid ? (
                  <div className="w-full text-center text-xs font-bold text-brand-blue bg-white border border-brand-blue/20 py-2.5 rounded-xl flex justify-center items-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"></path></svg>
                    התשלום בוצע
                  </div>
                ) : (
                  <button onClick={() => handlePay(req.id)} disabled={processing} className="w-full text-xs font-bold text-white bg-brand-blue py-3 rounded-xl transition active:scale-95 disabled:opacity-50 shadow-[0_4px_15px_rgba(0,68,204,0.2)]">
                    {processing ? 'מבצע תשלום...' : 'שלם עכשיו'}
                  </button>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* כפתורי ניהול (מוצגים רק לאדמין) */}
      {isAdmin && (
        <div className="fixed bottom-24 right-0 left-0 px-4 z-40 flex gap-3 pointer-events-none">
          <div className="flex-1 pointer-events-auto">
             <button onClick={() => setIsWithdrawModalOpen(true)} className="w-full bg-white backdrop-blur-md border border-brand-dark/10 text-brand-dark py-3.5 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] hover:scale-[1.02] active:scale-95 transition font-bold text-sm">
               משיכת כספים
             </button>
          </div>
          <div className="flex-1 pointer-events-auto">
             <button onClick={() => setIsReqModalOpen(true)} className="w-full bg-brand-blue text-white py-3.5 rounded-2xl shadow-[0_8px_30px_rgba(0,68,204,0.3)] hover:scale-[1.02] active:scale-95 transition font-bold text-sm">
               בקש תשלום
             </button>
          </div>
        </div>
      )}

      {/* מודל: בקשת תשלום */}
      {isReqModalOpen && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex justify-center items-end">
          <div className="bg-white w-full max-w-md rounded-t-3xl p-6 pb-8 shadow-2xl animate-in slide-in-from-bottom-10">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-black text-lg text-brand-dark">דרישת תשלום חדשה</h3>
              <button onClick={() => setIsReqModalOpen(false)} className="p-2 bg-gray-100 rounded-full text-brand-dark hover:bg-gray-200">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            <form onSubmit={handleCreateRequest} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-brand-dark mb-1 block">עבור מה התשלום?</label>
                <input type="text" required value={newRequest.title} onChange={e => setNewRequest({...newRequest, title: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-blue" placeholder="לדוג': ועד בית יוני" />
              </div>
              <div>
                <label className="text-xs font-bold text-brand-dark mb-1 block">סכום לדייר (₪)</label>
                <input type="number" required value={newRequest.amount} onChange={e => setNewRequest({...newRequest, amount: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-blue" placeholder="0" />
              </div>
              <button type="submit" disabled={isSubmitting} className="w-full bg-brand-blue text-white font-bold py-4 rounded-xl shadow-[0_8px_20px_rgba(0,68,204,0.3)] mt-4 active:scale-95 transition disabled:opacity-50">
                {isSubmitting ? 'מעדכן...' : 'שלח בקשה לכל השכנים'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* מודל: משיכת כספים */}
      {isWithdrawModalOpen && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex justify-center items-end">
          <div className="bg-white w-full max-w-md rounded-t-3xl p-6 pb-8 shadow-2xl animate-in slide-in-from-bottom-10">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-black text-lg text-brand-dark">משיכת כספים לקופה</h3>
              <button onClick={() => setIsWithdrawModalOpen(false)} className="p-2 bg-gray-100 rounded-full text-brand-dark hover:bg-gray-200">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            <form onSubmit={handleWithdraw} className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-xl mb-4">
                <p className="text-sm font-bold text-brand-blue">יתרה זמינה למשיכה: ₪{currentBalance.toLocaleString()}</p>
              </div>
              <div>
                <label className="text-xs font-bold text-brand-dark mb-1 block">סכום למשיכה (₪)</label>
                <input type="number" required max={currentBalance} value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-blue" placeholder="0" />
              </div>
              <button type="submit" disabled={isSubmitting || parseInt(withdrawAmount) > currentBalance} className="w-full bg-brand-dark text-white font-bold py-4 rounded-xl shadow-lg mt-4 active:scale-95 transition disabled:opacity-50">
                {isSubmitting ? 'מבצע משיכה...' : 'אשר משיכה'}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}

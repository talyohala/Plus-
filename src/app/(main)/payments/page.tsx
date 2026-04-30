'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'

export default function PaymentsPage() {
  const [requests, setRequests] = useState<any[]>([])
  const [myPayments, setMyPayments] = useState<string[]>([])
  const [allPayments, setAllPayments] = useState<any[]>([])
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [isProcessing, setIsProcessing] = useState<string | null>(null)
  
  // מודל להוספת דרישת תשלום
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [newRequest, setNewRequest] = useState({ title: '', amount: '' })

  const TOTAL_TENANTS = 32 // סך הכל דיירים בבניין (לצורך חישוב אחוזים)

  const fetchData = async (user: any) => {
    // 1. משיכת דרישות התשלום
    const { data: reqs } = await supabase.from('payment_requests').select('*').order('created_at', { ascending: false })
    if (reqs) setRequests(reqs)

    // 2. משיכת כל התשלומים שבוצעו (כדי לדעת כמה שכנים שילמו כל דרישה)
    const { data: allPays } = await supabase.from('tenant_payments').select('*')
    if (allPays) {
      setAllPayments(allPays)
      // סינון התשלומים שלי בלבד
      const mine = allPays.filter(p => p.user_id === user.id).map(p => p.request_id)
      setMyPayments(mine)
    }
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUser(user)
      if (user) fetchData(user)
    })
    
    // חיבור בזמן אמת לעדכוני קופה
    const channel = supabase.channel('payments_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tenant_payments' }, () => currentUser && fetchData(currentUser))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_requests' }, () => currentUser && fetchData(currentUser))
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [currentUser])

  const handlePay = async (requestId: string) => {
    if (!currentUser) return
    setIsProcessing(requestId)
    
    setTimeout(async () => {
      const { error } = await supabase.from('tenant_payments').insert([{ request_id: requestId, user_id: currentUser.id }])
      if (!error) {
        setMyPayments(prev => [...prev, requestId])
        fetchData(currentUser) // רענון נתונים לתצוגת האחוזים
      }
      setIsProcessing(null)
    }, 800)
  }

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newRequest.title || !newRequest.amount || !currentUser) return
    
    setIsSubmitting(true)
    const { error } = await supabase.from('payment_requests').insert([{ 
      title: newRequest.title, 
      amount: parseInt(newRequest.amount) 
    }])
    
    if (!error) {
      setIsModalOpen(false)
      setNewRequest({ title: '', amount: '' })
      fetchData(currentUser)
    }
    setIsSubmitting(false)
  }

  // חישוב יתרה דמוי-אמיתי (הכנסות פחות הוצאות)
  const totalIncome = allPayments.length > 0 ? allPayments.reduce((acc, pay) => {
    const req = requests.find(r => r.id === pay.request_id)
    return acc + (req ? req.amount : 0)
  }, 0) : 0
  const currentBalance = totalIncome - 850 // נניח שיש הוצאות קבועות של 850

  return (
    <div className="flex flex-col flex-1 w-full pb-24 relative" dir="rtl">
      
      {/* כותרת נקייה */}
      <div className="px-4 mb-6 mt-2">
        <h2 className="text-2xl font-black text-brand-dark">תשלומים</h2>
      </div>

      {/* כרטיס מצב קופה - צבעי כחול מותג */}
      <div className="px-4 mb-8">
        <div className="bg-brand-blue rounded-3xl p-6 text-white shadow-[0_10px_40px_rgba(0,68,204,0.3)] relative overflow-hidden">
          {/* רקעים עדינים בכחול בהיר (Brand Blue / 10) */}
          <div className="absolute -left-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
          <div className="absolute right-0 bottom-0 w-32 h-32 bg-[#003399]/40 rounded-full blur-2xl"></div>
          
          <div className="relative z-10">
            <p className="text-sm text-blue-100 font-medium mb-1">יתרת קופת הוועד</p>
            <h3 className="text-4xl font-black mb-5">₪{currentBalance.toLocaleString()}</h3>
            
            <div className="flex gap-3 text-xs font-bold">
              <div className="bg-white/10 backdrop-blur-sm px-3 py-2 rounded-xl flex-1 border border-white/10">
                <span className="block text-blue-200 font-medium text-[10px] mb-0.5">סך הכנסות</span>
                <span>+ ₪{totalIncome.toLocaleString()}</span>
              </div>
              <div className="bg-white/10 backdrop-blur-sm px-3 py-2 rounded-xl flex-1 border border-white/10">
                <span className="block text-blue-200 font-medium text-[10px] mb-0.5">הוצאות</span>
                <span>- ₪850</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 mb-4 flex justify-between items-end">
        <h3 className="font-bold text-brand-dark">פירוט תשלומים</h3>
      </div>

      {/* רשימת חיובים */}
      <div className="space-y-4 px-4">
        {requests.map(req => {
          const isPaid = myPayments.includes(req.id)
          const processing = isProcessing === req.id
          
          // חישוב כמה דיירים שילמו
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
                
                <div className="flex flex-col items-end gap-1">
                  <span className={`font-black ${isPaid ? 'text-brand-blue' : 'text-brand-dark'}`}>₪{req.amount}</span>
                </div>
              </div>

              {/* מד התקדמות של הבניין */}
              <div className="mb-4">
                <div className="flex justify-between text-[10px] font-bold mb-1">
                  <span className="text-brand-gray">שולם ע"י {paidCount} שכנים</span>
                  <span className="text-brand-blue">{progressPercent}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-brand-blue h-1.5 rounded-full transition-all duration-1000" style={{ width: `${progressPercent}%` }}></div>
                </div>
              </div>
              
              {/* כפתור תשלום / סטטוס */}
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
        })}
      </div>

      {/* כפתור יצירת דרישת תשלום (לוועד) - מעוצב בצבעי התפריט התחתון */}
      <button onClick={() => setIsModalOpen(true)} className="fixed bottom-28 left-4 z-40 bg-white/90 backdrop-blur-md border border-brand-blue/10 text-brand-blue p-1.5 pl-4 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:scale-105 active:scale-95 transition flex items-center gap-2">
        <div className="bg-brand-blue/10 p-2 rounded-full">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"></path></svg>
        </div>
        <span className="font-bold text-sm">בקש תשלום</span>
      </button>

      {/* מודל להוספת תשלום חדש (מיועד לוועד בית) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex justify-center items-end">
          <div className="bg-white w-full max-w-md rounded-t-3xl p-6 pb-8 shadow-2xl animate-in slide-in-from-bottom-10">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-black text-lg text-brand-dark">דרישת תשלום חדשה</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 bg-gray-100 rounded-full text-brand-dark hover:bg-gray-200">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            
            <form onSubmit={handleCreateRequest} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-brand-dark mb-1 block">עבור מה התשלום?</label>
                <input type="text" required value={newRequest.title} onChange={e => setNewRequest({...newRequest, title: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-blue transition" placeholder="לדוג': ועד בית יוני / זיפות גג" />
              </div>
              
              <div>
                <label className="text-xs font-bold text-brand-dark mb-1 block">סכום לדייר (₪)</label>
                <input type="number" required value={newRequest.amount} onChange={e => setNewRequest({...newRequest, amount: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-blue transition" placeholder="0" />
              </div>

              <button type="submit" disabled={isSubmitting} className="w-full bg-brand-blue text-white font-bold py-4 rounded-xl shadow-[0_8px_20px_rgba(0,68,204,0.3)] mt-4 active:scale-95 transition disabled:opacity-50">
                {isSubmitting ? 'מעדכן...' : 'שלח בקשה לכל השכנים'}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}

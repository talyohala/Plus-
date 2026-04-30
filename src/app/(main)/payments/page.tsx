'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'

export default function PaymentsPage() {
  const [requests, setRequests] = useState<any[]>([])
  const [myPayments, setMyPayments] = useState<any[]>([])
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [isProcessing, setIsProcessing] = useState<string | null>(null)

  const fetchData = async (user: any) => {
    // משיכת דרישות התשלום
    const { data: reqs } = await supabase.from('payment_requests').select('*').order('created_at', { ascending: false })
    if (reqs) setRequests(reqs)

    // משיכת התשלומים של המשתמש הנוכחי
    const { data: pays } = await supabase.from('tenant_payments').select('request_id').eq('user_id', user.id)
    if (pays) setMyPayments(pays.map(p => p.request_id))
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUser(user)
      if (user) fetchData(user)
    })
  }, [])

  const handlePay = async (requestId: string) => {
    if (!currentUser) return
    setIsProcessing(requestId)
    
    // הדמיית השהייה קלה של סליקת אשראי
    setTimeout(async () => {
      await supabase.from('tenant_payments').insert([{ request_id: requestId, user_id: currentUser.id }])
      setMyPayments(prev => [...prev, requestId])
      setIsProcessing(null)
    }, 800)
  }

  return (
    <div className="flex flex-col flex-1 w-full pb-24" dir="rtl">
      
      <div className="px-4 mb-4 mt-2">
        <h2 className="text-2xl font-black text-brand-dark mb-1">קופת הבניין 💳</h2>
        <p className="text-xs text-brand-gray font-medium">שקיפות מלאה לתשלומי ועד הבית</p>
      </div>

      {/* כרטיס מצב קופה */}
      <div className="px-4 mb-8">
        <div className="bg-brand-dark rounded-3xl p-6 text-white shadow-lg relative overflow-hidden">
          <div className="absolute -left-10 -top-10 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
          <p className="text-sm text-gray-300 font-medium mb-1">יתרה נוכחית בקופה</p>
          <h3 className="text-4xl font-black mb-4">₪4,250</h3>
          <div className="flex gap-4 text-xs font-bold">
            <div className="bg-white/10 px-3 py-1.5 rounded-lg flex-1 text-center border border-white/10">
              <span className="block text-gray-400 font-medium text-[10px] mb-0.5">הוצאות החודש</span>
              <span className="text-red-400">- ₪850</span>
            </div>
            <div className="bg-white/10 px-3 py-1.5 rounded-lg flex-1 text-center border border-white/10">
              <span className="block text-gray-400 font-medium text-[10px] mb-0.5">הכנסות החודש</span>
              <span className="text-green-400">+ ₪2,500</span>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 mb-3 flex justify-between items-end">
        <h3 className="font-bold text-brand-dark">לתשלום</h3>
        <span className="text-xs text-brand-blue font-bold bg-blue-50 px-2 py-1 rounded-lg">היסטוריה</span>
      </div>

      {/* רשימת חיובים */}
      <div className="space-y-4 px-4">
        {requests.map(req => {
          const isPaid = myPayments.includes(req.id)
          const processing = isProcessing === req.id

          return (
            <div key={req.id} className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 flex items-center justify-between transition-all">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${isPaid ? 'bg-green-50 text-green-500' : 'bg-red-50 text-red-500'}`}>
                  {isPaid ? (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"></path></svg>
                  ) : (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                  )}
                </div>
                <div>
                  <h4 className="font-bold text-brand-dark text-sm">{req.title}</h4>
                  <p className="text-[10px] text-brand-gray font-medium">{new Date(req.created_at).toLocaleDateString('he-IL')}</p>
                </div>
              </div>
              
              <div className="flex flex-col items-end gap-1">
                <span className="font-black text-brand-dark">₪{req.amount}</span>
                {isPaid ? (
                  <span className="text-[10px] font-bold text-green-500 bg-green-50 px-2 py-0.5 rounded-md">שולם בהצלחה</span>
                ) : (
                  <button onClick={() => handlePay(req.id)} disabled={processing} className="text-[10px] font-bold text-white bg-brand-blue hover:bg-blue-700 px-4 py-1.5 rounded-lg transition active:scale-95 disabled:opacity-50">
                    {processing ? 'מעבד...' : 'שלם עכשיו'}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

    </div>
  )
}

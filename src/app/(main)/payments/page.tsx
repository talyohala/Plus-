'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'

export default function PaymentsPage() {
  const [profile, setProfile] = useState<any>(null)
  const [myPayments, setMyPayments] = useState<any[]>([])
  const [buildingPayments, setBuildingPayments] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<'my_debts' | 'admin_collection'>('my_debts')
  
  // מודל פתיחת בקשת תשלום
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [newPayment, setNewPayment] = useState({ title: '', amount: '' })

  const fetchData = async (user: any) => {
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (!prof || !prof.building_id) return
    setProfile(prof)

    // משיכת החובות שלי
    const { data: myData } = await supabase.from('payments')
      .select('*, collector:profiles!payments_collector_id_fkey(full_name)')
      .eq('payer_id', prof.id)
      .order('status', { ascending: false }) // pending יופיע לפני paid
      .order('created_at', { ascending: false })
    
    if (myData) setMyPayments(myData)

    // אם מנהל - משיכת כל התשלומים של הבניין (כדי לראות מי שילם)
    if (prof.role === 'admin') {
      const { data: bldData } = await supabase.from('payments')
        .select('*, payer:profiles!payments_payer_id_fkey(full_name, avatar_url, apartment)')
        .eq('building_id', prof.building_id)
        .order('created_at', { ascending: false })
      if (bldData) setBuildingPayments(bldData)
    }
  }

  useEffect(() => {
    let currentUser: any = null
    supabase.auth.getUser().then(({ data: { user } }) => {
      currentUser = user
      if (user) fetchData(user)
    })

    const channel = supabase.channel('payments_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => currentUser && fetchData(currentUser))
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  // שידור דרישת תשלום לכל הדיירים!
  const handleCreatePaymentRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile?.building_id || !newPayment.title || !newPayment.amount) return
    
    setIsSubmitting(true)
    
    // 1. שולפים את כל הדיירים בבניין (כולל המנהל עצמו שגם צריך לשלם)
    const { data: tenants } = await supabase.from('profiles').select('id').eq('building_id', profile.building_id)
    
    if (tenants && tenants.length > 0) {
      // 2. מכינים רשומה אישית לכל דייר
      const paymentsToInsert = tenants.map(tenant => ({
        building_id: profile.building_id,
        collector_id: profile.id,
        payer_id: tenant.id,
        title: newPayment.title,
        amount: parseInt(newPayment.amount)
      }))

      // 3. שולחים למסד הנתונים במכה אחת
      await supabase.from('payments').insert(paymentsToInsert)
      
      // אופציונלי: שליחת התראות (Notifications) לכל הדיירים
      const notifications = tenants.filter(t => t.id !== profile.id).map(tenant => ({
        receiver_id: tenant.id,
        title: 'בקשת תשלום חדשה',
        content: `ועד הבית מבקש תשלום: ${newPayment.title} ע"ס ₪${newPayment.amount}`,
        type: 'payment'
      }))
      if (notifications.length > 0) await supabase.from('notifications').insert(notifications)
    }

    setIsModalOpen(false)
    setNewPayment({ title: '', amount: '' })
    fetchData(profile)
    setIsSubmitting(false)
  }

  // סימון תשלום כשולם
  const markAsPaid = async (paymentId: string) => {
    await supabase.from('payments').update({ status: 'paid' }).eq('id', paymentId)
    fetchData(profile)
  }

  // מחיקת דרישת תשלום (רק המנהל יכול)
  const deletePayment = async (paymentId: string) => {
    if(confirm("למחוק את דרישת התשלום הזו?")) {
      await supabase.from('payments').delete().eq('id', paymentId)
      fetchData(profile)
    }
  }

  const isAdmin = profile?.role === 'admin'

  return (
    <div className="flex flex-col flex-1 w-full pb-24 relative" dir="rtl">
      
      <div className="px-4 mb-4 mt-2">
        <h2 className="text-2xl font-black text-brand-dark">תשלומים וועד</h2>
      </div>

      {/* טאבים לניווט (כחול מותג שלנו) */}
      <div className="flex overflow-x-auto hide-scrollbar gap-2 px-4 mb-6 pb-2">
        <button 
          onClick={() => setActiveTab('my_debts')}
          className={`whitespace-nowrap px-6 py-2 rounded-full text-sm font-bold transition shadow-sm border ${
            activeTab === 'my_debts' ? 'bg-brand-blue text-white border-brand-blue' : 'bg-white text-brand-dark border-gray-100 hover:bg-gray-50'
          }`}
        >
          החובות שלי
        </button>
        {isAdmin && (
          <button 
            onClick={() => setActiveTab('admin_collection')}
            className={`whitespace-nowrap px-6 py-2 rounded-full text-sm font-bold transition shadow-sm border ${
              activeTab === 'admin_collection' ? 'bg-brand-blue text-white border-brand-blue' : 'bg-white text-brand-dark border-gray-100 hover:bg-gray-50'
            }`}
          >
            ניהול גבייה (לוועד)
          </button>
        )}
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
              <div key={payment.id} className="bg-white p-5 rounded-3xl shadow-sm border border-gray-50 flex items-center justify-between">
                <div>
                  <h3 className="font-black text-brand-dark text-lg leading-tight mb-1">{payment.title}</h3>
                  <p className="text-[10px] text-brand-gray mb-2">דרישה מאת: {payment.collector?.full_name}</p>
                  
                  {payment.status === 'pending' ? (
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-md bg-orange-50 text-orange-600 border border-orange-100">ממתין לתשלום</span>
                  ) : (
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-md bg-green-50 text-green-600 border border-green-100">שולם בהצלחה</span>
                  )}
                </div>
                
                <div className="flex flex-col items-end gap-3">
                  <span className="text-2xl font-black text-brand-dark">₪{payment.amount}</span>
                  {payment.status === 'pending' && (
                    <button onClick={() => markAsPaid(payment.id)} className="bg-brand-blue text-white text-xs font-bold px-4 py-2 rounded-xl shadow-[0_4px_15px_rgba(0,68,204,0.2)] active:scale-95 transition">
                      סמן כשולם
                    </button>
                  )}
                </div>
              </div>
            ))
          )
        ) : (
          /* --- מסך ניהול גבייה (לוועד בלבד) --- */
          buildingPayments.length === 0 ? (
            <div className="text-center py-10 bg-white/50 rounded-3xl border border-gray-100 shadow-sm">
              <p className="text-brand-gray font-medium">עדיין לא יצרת דרישות תשלום לבניין.</p>
            </div>
          ) : (
            buildingPayments.map(payment => (
              <div key={payment.id} className="bg-white p-4 rounded-3xl shadow-sm border border-gray-50 flex flex-col gap-3 relative">
                
                <button onClick={() => deletePayment(payment.id)} className="absolute top-4 left-4 p-1.5 text-gray-300 hover:text-red-500 transition">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                </button>

                <div className="flex justify-between items-start pr-1">
                  <div>
                    <h3 className="font-black text-brand-dark text-base leading-tight mb-1">{payment.title}</h3>
                    <div className="flex items-center gap-2">
                       <img src={payment.payer?.avatar_url || `https://api.dicebear.com/8.x/initials/svg?seed=${payment.payer?.full_name}&backgroundColor=eef2ff&textColor=1e3a8a`} className="w-5 h-5 rounded-full border border-gray-100" />
                       <p className="text-xs text-brand-gray font-bold">{payment.payer?.full_name} {payment.payer?.apartment ? `(דירה ${payment.payer.apartment})` : ''}</p>
                    </div>
                  </div>
                  <span className="text-xl font-black text-brand-dark ml-6 mt-1">₪{payment.amount}</span>
                </div>
                
                <div className="flex items-center justify-between border-t border-gray-50 pt-3">
                  {payment.status === 'pending' ? (
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-md bg-orange-50 text-orange-600">טרם שילם</span>
                  ) : (
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-md bg-green-50 text-green-600">שילם</span>
                  )}
                  
                  {payment.status === 'pending' && (
                    <button onClick={() => markAsPaid(payment.id)} className="text-[11px] font-bold text-brand-blue hover:bg-brand-blue/5 px-3 py-1.5 rounded-lg transition active:scale-95">
                      סמן שקיבלתי במזומן/ביט
                    </button>
                  )}
                </div>
              </div>
            ))
          )
        )}
      </div>

      {/* כפתור יצירת דרישת תשלום למנהל */}
      {isAdmin && activeTab === 'admin_collection' && (
        <button onClick={() => setIsModalOpen(true)} className="fixed bottom-28 left-4 z-40 bg-white/90 backdrop-blur-md border border-brand-blue/10 text-brand-blue p-1.5 pl-4 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:scale-105 active:scale-95 transition flex items-center gap-2">
          <div className="bg-brand-blue/10 p-2 rounded-full">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"></path></svg>
          </div>
          <span className="font-bold text-sm">בקשת תשלום לדיירים</span>
        </button>
      )}

      {/* מודל פתיחת קריאת תשלום */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex justify-center items-end">
          <div className="bg-white w-full max-w-md rounded-t-[32px] p-6 pb-8 shadow-2xl animate-in slide-in-from-bottom-10">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-black text-xl text-brand-dark">בקשת תשלום חדשה</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 bg-gray-100 rounded-full text-brand-dark hover:bg-gray-200 transition">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            
            <p className="text-xs text-brand-gray mb-5">הבקשה תישלח לכל הדיירים הרשומים בבניין.</p>

            <form onSubmit={handleCreatePaymentRequest} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-brand-dark mb-1 block">עבור מה התשלום?</label>
                <input type="text" required value={newPayment.title} onChange={e => setNewPayment({...newPayment, title: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 text-sm outline-none focus:border-brand-blue transition shadow-sm text-brand-dark" placeholder="לדוג': ועד בית חודש מאי" />
              </div>

              <div>
                <label className="text-xs font-bold text-brand-dark mb-1 block">סכום לתשלום (₪)</label>
                <input type="number" required value={newPayment.amount} onChange={e => setNewPayment({...newPayment, amount: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 text-sm outline-none focus:border-brand-blue transition shadow-sm text-brand-dark font-black text-lg" placeholder="150" />
              </div>

              <button type="submit" disabled={isSubmitting} className="w-full bg-brand-blue text-white font-bold py-4 rounded-2xl shadow-[0_8px_20px_rgba(0,68,204,0.3)] mt-4 active:scale-95 transition disabled:opacity-50 text-base">
                {isSubmitting ? 'משדר לכולם...' : 'שדר בקשה לכל הבניין'}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}

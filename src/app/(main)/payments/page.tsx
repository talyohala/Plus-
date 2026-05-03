'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { playSystemSound } from '../../../components/providers/AppManager'

export default function PaymentsPage() {
  const [profile, setProfile] = useState<any>(null)
  const [payments, setPayments] = useState<any[]>([])
  
  // ניהול דרישת חוב (רק לוועד)
  const [isCreating, setIsCreating] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newAmount, setNewAmount] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (prof) {
      setProfile(prof)

      // אם מנהל - מציג את כל דרישות החוב של הבניין, אם דייר - רק את שלו
      const query = supabase.from('payments').select('*, profiles!payments_payer_id_fkey(full_name, apartment)').order('created_at', { ascending: false })
      if (prof.role === 'admin') {
        query.eq('building_id', prof.building_id)
      } else {
        query.eq('payer_id', prof.id)
      }
      
      const { data } = await query
      if (data) setPayments(data)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleCreatePayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile || profile.role !== 'admin' || !newTitle || !newAmount) return
    setIsSubmitting(true)

    // משיכת כל הדיירים בבניין (מלבד מנהל הוועד - אלא אם תרצה שגם הוא ישלם)
    const { data: tenants } = await supabase.from('profiles').select('id').eq('building_id', profile.building_id)
    
    if (tenants && tenants.length > 0) {
      const paymentsToInsert = tenants.map(t => ({
        payer_id: t.id,
        building_id: profile.building_id,
        amount: parseFloat(newAmount),
        title: newTitle,
        status: 'pending'
      }))

      await supabase.from('payments').insert(paymentsToInsert)
      playSystemSound('notification')
      setIsCreating(false)
      setNewTitle('')
      setNewAmount('')
      fetchData()
    }
    setIsSubmitting(false)
  }

  const handleSimulatePay = async (paymentId: string) => {
    // זמני - משנה ל"שולם". בעתיד יפתח פה מסך סליקה.
    await supabase.from('payments').update({ status: 'paid' }).eq('id', paymentId)
    playSystemSound('click')
    fetchData()
  }

  const isAdmin = profile?.role === 'admin'
  const pendingPayments = payments.filter(p => p.status === 'pending')
  const paidPayments = payments.filter(p => p.status === 'paid')

  return (
    <div className="flex flex-col flex-1 w-full pb-24" dir="rtl">
      <div className="px-4 mt-4 mb-6">
        <h2 className="text-2xl font-black text-brand-dark">תשלומי ועד</h2>
      </div>

      {isAdmin && (
        <div className="px-4 mb-6">
          {!isCreating ? (
            <button onClick={() => setIsCreating(true)} className="w-full bg-brand-blue text-white rounded-[2rem] p-6 shadow-md active:scale-95 transition flex items-center justify-between">
              <div>
                <h3 className="font-black text-lg text-right">הפקת דרישת תשלום</h3>
                <p className="text-xs font-bold opacity-90 text-right">שלח חוב לכל דיירי הבניין</p>
              </div>
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4"></path></svg>
              </div>
            </button>
          ) : (
            <form onSubmit={handleCreatePayment} className="bg-white border border-brand-blue/20 p-5 rounded-[2rem] shadow-lg">
              <h3 className="font-black text-brand-dark mb-4 text-center">הוספת דרישת תשלום קולקטיבית</h3>
              <input type="text" placeholder="עבור (לדוגמה: ועד חודש יוני)" value={newTitle} onChange={e => setNewTitle(e.target.value)} required className="w-full bg-gray-50 rounded-xl px-4 py-3 mb-3 text-sm outline-none focus:bg-brand-blue/5 text-brand-dark" />
              <input type="number" placeholder="סכום לתשלום (₪)" value={newAmount} onChange={e => setNewAmount(e.target.value)} required className="w-full bg-gray-50 rounded-xl px-4 py-3 mb-4 text-sm outline-none focus:bg-brand-blue/5 text-brand-dark" />
              
              <div className="flex gap-2">
                <button type="button" onClick={() => setIsCreating(false)} className="flex-1 bg-gray-100 text-brand-dark font-bold py-3 rounded-xl">ביטול</button>
                <button type="submit" disabled={isSubmitting} className="flex-1 bg-brand-blue text-white font-bold py-3 rounded-xl disabled:opacity-50">שלח לדיירים</button>
              </div>
            </form>
          )}
        </div>
      )}

      <div className="px-4 space-y-4">
        {pendingPayments.length > 0 && <h3 className="text-sm font-black text-red-500 uppercase tracking-wider mb-2">ממתינים לתשלום ({pendingPayments.length})</h3>}
        {pendingPayments.map(p => (
          <div key={p.id} className="bg-white border border-red-100 p-5 rounded-3xl shadow-sm flex items-center justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 w-2 h-full bg-red-500"></div>
            <div className="pr-2">
              <h4 className="font-black text-brand-dark">{p.title}</h4>
              <p className="text-xs font-bold text-red-500">
                {isAdmin ? `לגבייה מ: ${p.profiles?.full_name}` : 'ממתין לתשלום שלך'}
              </p>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-xl font-black text-brand-dark">₪{p.amount}</span>
              {!isAdmin && (
                <button onClick={() => handleSimulatePay(p.id)} className="mt-1 bg-brand-dark text-white text-[10px] font-black px-4 py-1.5 rounded-full active:scale-95 shadow-sm">
                  לתשלום
                </button>
              )}
            </div>
          </div>
        ))}

        {paidPayments.length > 0 && <h3 className="text-sm font-black text-brand-gray uppercase tracking-wider mt-6 mb-2">שולמו בהצלחה</h3>}
        {paidPayments.map(p => (
          <div key={p.id} className="bg-white border border-gray-100 p-4 rounded-2xl shadow-sm flex items-center justify-between opacity-80">
            <div>
              <h4 className="font-bold text-sm text-brand-dark">{p.title}</h4>
              {isAdmin && <p className="text-[10px] text-brand-gray">{p.profiles?.full_name}</p>}
            </div>
            <span className="text-sm font-black text-green-500">₪{p.amount} • שולם</span>
          </div>
        ))}
      </div>
    </div>
  )
}

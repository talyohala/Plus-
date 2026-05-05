'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import { playSystemSound } from '../../../components/providers/AppManager'

export default function PaymentsPage() {
  const [profile, setProfile] = useState<any>(null)
  const [payments, setPayments] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<'pending' | 'approval' | 'history'>('pending')
  const [expandedTabs, setExpandedTabs] = useState<Record<string, boolean>>({})
  
  const [isCreating, setIsCreating] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newAmount, setNewAmount] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [aiInsight, setAiInsight] = useState<string>('')
  const [isAiLoading, setIsAiLoading] = useState(true)

  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (prof) {
      setProfile(prof)

      const query = supabase.from('payments')
        .select('*, profiles!payments_payer_id_fkey(full_name, apartment)')
        .order('created_at', { ascending: false })
      
      if (prof.role === 'admin') {
        query.eq('building_id', prof.building_id)
      } else {
        query.eq('payer_id', prof.id)
      }
      
      const { data } = await query
      if (data) setPayments(data)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const channel = supabase.channel('payments_v4')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, fetchData)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchData])

  useEffect(() => {
    const fetchAiData = async () => {
      if (!profile || payments.length === 0) return;
      setIsAiLoading(true);
      try {
        const totalPaid = payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0);
        const totalPending = payments.filter(p => p.status === 'pending').reduce((sum, p) => sum + p.amount, 0);
        
        const prompt = `אני ${profile.role === 'admin' ? 'מנהל ועד הבית' : 'דייר'}. סך שנגבה: ${totalPaid} ש"ח. סך תשלומים שממתינים: ${totalPending} ש"ח. נסח תובנה פיננסית חיובית (בלי המילה חובות), עד 15 מילים.`;
        
        const res = await fetch('/api/ai/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ description: prompt })
        });
        const data = await res.json();
        setAiInsight(data.title || data.text || `הניהול הפיננסי בבניין מצוין! תודה על שיתוף הפעולה. ✨`);
      } catch (error) {
        setAiInsight(`מערכת התשלומים מעודכנת. ✨`);
      } finally {
        setIsAiLoading(false);
      }
    };
    fetchAiData();
  }, [profile, payments.length]);

  const handleCreatePayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile || profile.role !== 'admin' || !newTitle || !newAmount) return
    setIsSubmitting(true)
    const { data: tenants } = await supabase.from('profiles').select('id').eq('building_id', profile.building_id).neq('id', profile.id)
    if (tenants && tenants.length > 0) {
      const paymentsToInsert = tenants.map(t => ({ payer_id: t.id, building_id: profile.building_id, amount: parseFloat(newAmount), title: newTitle, status: 'pending' }))
      await supabase.from('payments').insert(paymentsToInsert)
      playSystemSound('notification'); setIsCreating(false); setNewTitle(''); setNewAmount(''); fetchData()
    }
    setIsSubmitting(false)
  }

  const toggleExpand = (tab: string) => setExpandedTabs(prev => ({ ...prev, [tab]: !prev[tab] }))

  const handleNotifyBitPayment = async (paymentId: string) => {
    await supabase.from('payments').update({ status: 'pending_approval' }).eq('id', paymentId)
    playSystemSound('click'); fetchData()
  }

  const handleApprovePayment = async (paymentId: string) => {
    await supabase.from('payments').update({ status: 'paid' }).eq('id', paymentId)
    playSystemSound('notification'); fetchData()
  }

  const deletePayment = async (id: string) => {
    if(confirm("למחוק את דרישת התשלום?")) { await supabase.from('payments').delete().eq('id', id); fetchData() }
  }

  if (!profile) return null

  const isAdmin = profile.role === 'admin'
  const pending = payments.filter(p => p.status === 'pending')
  const approvals = payments.filter(p => p.status === 'pending_approval')
  const history = payments.filter(p => p.status === 'paid')

  const totalCollected = history.reduce((sum, p) => sum + p.amount, 0)
  const totalPendingVal = pending.reduce((sum, p) => sum + p.amount, 0)

  const renderList = (list: any[], type: 'pending' | 'approval' | 'history') => {
    if (list.length === 0) return <div className="text-center py-10 text-slate-400 font-bold text-sm">אין תשלומים בקטגוריה זו</div>
    
    const isExpanded = expandedTabs[type] || false
    const displayList = isExpanded ? list : list.slice(0, 5)

    return (
      <div className="space-y-3">
        {displayList.map(p => (
          <div key={p.id} className="bg-white/70 backdrop-blur-md border border-white/50 p-4 rounded-2xl shadow-sm flex items-center justify-between">
            <div className="flex-1 pr-1">
              <h4 className="font-black text-slate-800 text-sm">{p.title}</h4>
              <p className="text-[10px] font-bold text-slate-500">
                {isAdmin ? `${p.profiles?.full_name} (ד' ${p.profiles?.apartment})` : type === 'pending' ? 'ממתין לתשלום' : type === 'approval' ? 'ממתין לאישור ועד' : 'בוצע בהצלחה'}
              </p>
            </div>
            <div className="text-left shrink-0 flex flex-col items-end gap-2">
              <span className={`text-base font-black ${type === 'history' ? 'text-[#059669]' : 'text-slate-800'}`}>₪{p.amount}</span>
              {type === 'pending' && !isAdmin && <button onClick={() => handleNotifyBitPayment(p.id)} className="bg-[#1D4ED8] text-white text-[9px] font-black px-3 py-1.5 rounded-lg">דיווח ששילמתי</button>}
              {type === 'pending' && isAdmin && <button onClick={() => deletePayment(p.id)} className="text-red-400 text-[9px] font-bold">ביטול</button>}
              {type === 'approval' && isAdmin && <button onClick={() => handleApprovePayment(p.id)} className="bg-[#059669] text-white text-[9px] font-black px-3 py-1.5 rounded-lg shadow-sm">אשר קבלה</button>}
            </div>
          </div>
        ))}
        {list.length > 5 && (
          <button onClick={() => toggleExpand(type)} className="w-full flex items-center justify-center gap-1 text-[#1D4ED8] py-2">
            <span className="text-[11px] font-black">{isExpanded ? 'הצג פחות' : `הצג עוד ${list.length - 5} תשלומים`}</span>
            <svg className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7"></path></svg>
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 w-full pb-32 bg-transparent min-h-screen" dir="rtl">
      <div className="px-6 pt-6 pb-4"><h2 className="text-2xl font-black text-slate-800">ניהול כספי</h2></div>

      <div className="px-6 space-y-6">
        {/* קופת הוועד */}
        <div className="bg-white/60 backdrop-blur-xl border border-white/50 shadow-sm rounded-[1.5rem] p-5 flex gap-4">
          <div className="flex-1 text-center">
            <p className="text-[10px] font-black text-slate-400 uppercase mb-1">{isAdmin ? 'נאסף בקופה' : 'שילמתי עד היום'}</p>
            <p className="text-2xl font-black text-[#059669]">₪{totalCollected.toLocaleString()}</p>
          </div>
          <div className="w-px bg-white/50 h-10 self-center"></div>
          <div className="flex-1 text-center">
            <p className="text-[10px] font-black text-slate-400 uppercase mb-1">ממתין לתשלום</p>
            <p className="text-2xl font-black text-slate-700">₪{totalPendingVal.toLocaleString()}</p>
          </div>
        </div>

        {/* AI Insight */}
        <div className="bg-white/60 backdrop-blur-md border border-white/50 p-4 rounded-2xl flex items-center gap-4 shadow-sm">
          <div className="w-10 h-10 rounded-full bg-[#1D4ED8] flex items-center justify-center shrink-0 text-white shadow-sm">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" /></svg>
          </div>
          <p className="text-xs font-bold text-slate-700">{isAiLoading ? 'מעבד נתונים...' : aiInsight}</p>
        </div>

        {/* הפקת דרישת תשלום (ועד) */}
        {isAdmin && (
          <div className="bg-white/60 backdrop-blur-xl border border-white/50 shadow-sm rounded-[1.5rem] p-5">
            {!isCreating ? (
              <button onClick={() => setIsCreating(true)} className="w-full bg-[#1D4ED8] text-white py-4 rounded-xl text-sm font-black shadow-md active:scale-95 transition">
                דרישת תשלום בניינית
              </button>
            ) : (
              <form onSubmit={handleCreatePayment} className="space-y-3 animate-in zoom-in-95">
                <div className="flex justify-between items-center mb-1">
                  <h3 className="text-sm font-black text-slate-800">דרישה חדשה</h3>
                  <button type="button" onClick={() => setIsCreating(false)} className="text-slate-400"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
                </div>
                <input type="text" placeholder="עבור (לדוגמה: גינון)" value={newTitle} onChange={e => setNewTitle(e.target.value)} required className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 text-sm font-bold outline-none" />
                <input type="number" placeholder="סכום (₪)" value={newAmount} onChange={e => setNewAmount(e.target.value)} required className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 text-sm font-bold outline-none" />
                <button type="submit" disabled={isSubmitting} className="w-full bg-slate-800 text-white py-3.5 rounded-xl text-xs font-black">שלח לכל הדיירים</button>
              </form>
            )}
          </div>
        )}

        {/* מערכת טאבים */}
        <div className="space-y-4">
          <div className="flex bg-white/40 backdrop-blur-md p-1 rounded-xl border border-white/50 shadow-sm">
            <button onClick={() => setActiveTab('pending')} className={`flex-1 py-2 text-[11px] font-black rounded-lg transition ${activeTab === 'pending' ? 'bg-white text-[#1D4ED8] shadow-sm' : 'text-slate-500'}`}>
              ממתינים ({pending.length})
            </button>
            {isAdmin && (
              <button onClick={() => setActiveTab('approval')} className={`flex-1 py-2 text-[11px] font-black rounded-lg transition ${activeTab === 'approval' ? 'bg-white text-orange-500 shadow-sm' : 'text-slate-500'}`}>
                לאישור ({approvals.length})
              </button>
            )}
            <button onClick={() => setActiveTab('history')} className={`flex-1 py-2 text-[11px] font-black rounded-lg transition ${activeTab === 'history' ? 'bg-white text-[#059669] shadow-sm' : 'text-slate-500'}`}>
              היסטוריה
            </button>
          </div>

          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            {activeTab === 'pending' && renderList(pending, 'pending')}
            {activeTab === 'approval' && renderList(approvals, 'approval')}
            {activeTab === 'history' && (
              <div className="space-y-5">
                <div className="bg-[#059669]/5 border border-[#059669]/20 p-3 rounded-xl">
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-[10px] font-black text-[#059669] uppercase">מד התקדמות גבייה</span>
                    <span className="text-[10px] font-black text-[#059669]">{Math.round((totalCollected / (totalCollected + totalPendingVal)) * 100 || 0)}%</span>
                  </div>
                  <div className="w-full bg-white rounded-full h-1.5 overflow-hidden">
                    <div className="bg-[#059669] h-full transition-all duration-1000" style={{ width: `${(totalCollected / (totalCollected + totalPendingVal)) * 100 || 0}%` }}></div>
                  </div>
                </div>
                {renderList(history, 'history')}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

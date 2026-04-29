'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'

export default function ServicesPage() {
  const [reports, setReports] = useState<any[]>([])
  const [desc, setDesc] = useState('')
  const [category, setCategory] = useState('כללי')
  const [loading, setLoading] = useState(false)

  const fetchReports = async () => {
    const { data } = await supabase.from('building_reports').select('*, profiles(full_name, apartment)').order('created_at', { ascending: false })
    if (data) setReports(data)
  }

  useEffect(() => {
    fetchReports()
    const sub = supabase.channel('reports').on('postgres_changes', { event: '*', schema: 'public', table: 'building_reports' }, fetchReports).subscribe()
    return () => { supabase.removeChannel(sub) }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('building_reports').insert([{ user_id: user.id, category, description: desc }])
      setDesc('')
    }
    setLoading(false)
  }

  return (
    <div className="pt-4 text-right" dir="rtl">
      <h2 className="text-xl font-bold text-brand-dark mb-4">דיווח על תקלה</h2>
      
      <form onSubmit={handleSubmit} className="glass-panel p-5 rounded-3xl mb-6 space-y-3">
        <select value={category} onChange={e => setCategory(e.target.value)} className="w-full p-3 rounded-2xl bg-white/60 border border-white outline-none focus:border-brand-blue">
          <option>כללי</option>
          <option>מעלית</option>
          <option>תאורה</option>
          <option>ניקיון</option>
          <option>גינון</option>
        </select>
        <textarea placeholder="מה התקלה?" className="w-full p-3 rounded-2xl bg-white/60 border border-white outline-none focus:border-brand-blue h-24 resize-none" value={desc} onChange={e => setDesc(e.target.value)} required />
        <button disabled={loading} className="w-full bg-brand-blue text-white py-3 rounded-2xl font-bold shadow-lg disabled:opacity-50 transition active:scale-95">שלח דיווח</button>
      </form>

      <h3 className="font-bold text-brand-dark mb-3">תקלות בטיפול</h3>
      <div className="space-y-3">
        {reports.map(r => (
          <div key={r.id} className="glass-panel p-4 rounded-2xl flex justify-between items-center bg-white/40 border-r-4 border-brand-blue">
            <div>
              <p className="font-bold text-sm text-brand-dark">{r.category}: {r.description}</p>
              <p className="text-[10px] text-brand-gray">דווח ע"י {r.profiles?.full_name} • דירה {r.profiles?.apartment}</p>
            </div>
            <span className={`text-[10px] px-3 py-1 rounded-full font-bold ${r.status === 'פתוח' ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'}`}>{r.status}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

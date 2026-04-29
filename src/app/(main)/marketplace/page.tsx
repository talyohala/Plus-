'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'

export default function MarketplacePage() {
  const [listings, setListings] = useState<any[]>([])
  const [title, setTitle] = useState('')
  const [price, setPrice] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchListings = async () => {
    const { data } = await supabase
      .from('listings')
      .select('*, profiles(full_name, apartment)')
      .order('created_at', { ascending: false })
    if (data) setListings(data)
  }

  useEffect(() => { fetchListings() }, [])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title || !price || !file) return alert('נא למלא את כל השדות ולצרף תמונה')
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // העלאת התמונה ל-Supabase Storage
    const fileExt = file.name.split('.').pop()
    const fileName = `${Math.random()}.${fileExt}`
    const { error: uploadError } = await supabase.storage
      .from('marketplace')
      .upload(fileName, file)
      
    if (uploadError) {
      alert('שגיאה בהעלאת תמונה')
      setLoading(false)
      return
    }

    // קבלת הקישור הפומבי לתמונה ושמירת המודעה בטבלה
    const { data: publicUrlData } = supabase.storage.from('marketplace').getPublicUrl(fileName)
    
    await supabase.from('listings').insert([{
      user_id: user.id,
      title,
      price,
      image_url: publicUrlData.publicUrl
    }])

    setTitle('')
    setPrice('')
    setFile(null)
    fetchListings()
    setLoading(false)
  }

  return (
    <div className="pt-4">
      <h2 className="text-xl font-bold text-brand-dark mb-4 text-center">לוח מודעות</h2>
      
      {/* אזור הוספת מודעה */}
      <form onSubmit={handleAdd} className="glass-panel p-5 rounded-3xl mb-6 space-y-3 text-right" dir="rtl">
        <h3 className="text-sm font-bold text-brand-dark mb-2">מודעה חדשה</h3>
        <input type="text" placeholder="מה תרצו למכור/למסור?" className="w-full p-3 rounded-2xl bg-white/60 border border-white outline-none focus:border-brand-blue" value={title} onChange={e=>setTitle(e.target.value)} required />
        <div className="flex gap-3">
          <input type="text" placeholder="מחיר (או 'למסירה')" className="w-1/2 p-3 rounded-2xl bg-white/60 border border-white outline-none focus:border-brand-blue" value={price} onChange={e=>setPrice(e.target.value)} required />
          <input type="file" accept="image/*" className="w-1/2 p-3 rounded-2xl bg-white/60 border border-white text-xs file:mr-0 file:py-1 file:px-3 file:rounded-full file:border-0 file:bg-brand-blue/10 file:text-brand-blue hover:file:bg-brand-blue/20" onChange={e=>setFile(e.target.files?.[0] || null)} required />
        </div>
        <button disabled={loading} className="w-full bg-brand-blue text-white py-3 rounded-2xl font-bold shadow-lg hover:scale-[1.02] transition disabled:opacity-50 mt-2">
          {loading ? 'מעלה...' : 'פרסם מודעה'}
        </button>
      </form>

      {/* תצוגת המודעות */}
      <div className="grid grid-cols-2 gap-4" dir="rtl">
        {listings.map(item => (
          <div key={item.id} className="glass-panel rounded-3xl overflow-hidden flex flex-col bg-white/40">
            <img src={item.image_url} alt={item.title} className="w-full h-32 object-cover" />
            <div className="p-3">
              <h3 className="font-bold text-sm text-brand-dark truncate">{item.title}</h3>
              <p className="text-brand-blue font-black text-sm my-1">{item.price}</p>
              <p className="text-[10px] text-brand-gray truncate">
                {item.profiles?.full_name} • דירה {item.profiles?.apartment}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

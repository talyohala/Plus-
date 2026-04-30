'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'

const categories = ['הכל', 'למכירה', 'למסירה', 'שירותים', 'דרושים']

export default function MarketplacePage() {
  const [profile, setProfile] = useState<any>(null)
  const [items, setItems] = useState<any[]>([])
  const [activeCategory, setActiveCategory] = useState('הכל')
  
  // מודל להוספת מודעה
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [newItem, setNewItem] = useState({
    title: '', description: '', price: '', contact_phone: '', category: 'למכירה'
  })

  const fetchData = async (user: any) => {
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (!prof || !prof.building_id) return
    setProfile(prof)

    let query = supabase.from('marketplace_items')
      .select('*, profiles(full_name, avatar_url)')
      .eq('building_id', prof.building_id)
      .eq('status', 'available')
      .order('created_at', { ascending: false })

    if (activeCategory !== 'הכל') {
      query = query.eq('category', activeCategory)
    }

    const { data } = await query
    if (data) setItems(data)
  }

  useEffect(() => {
    let currentUser: any = null
    supabase.auth.getUser().then(({ data: { user } }) => {
      currentUser = user
      if (user) fetchData(user)
    })

    const channel = supabase.channel('marketplace_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'marketplace_items' }, () => currentUser && fetchData(currentUser))
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [activeCategory])

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile?.building_id || !newItem.title || !newItem.contact_phone) return
    
    setIsSubmitting(true)
    const { error } = await supabase.from('marketplace_items').insert([{
      building_id: profile.building_id,
      user_id: profile.id,
      title: newItem.title,
      description: newItem.description,
      price: newItem.price === '' ? 0 : parseInt(newItem.price),
      contact_phone: newItem.contact_phone,
      category: newItem.category
    }])

    if (!error) {
      setIsModalOpen(false)
      setNewItem({ title: '', description: '', price: '', contact_phone: '', category: 'למכירה' })
      fetchData(profile)
    }
    setIsSubmitting(false)
  }

  const handleDelete = async (id: string) => {
    if(confirm("האם למחוק את המודעה?")) {
      await supabase.from('marketplace_items').delete().eq('id', id)
      fetchData(profile)
    }
  }

  return (
    <div className="flex flex-col flex-1 w-full pb-24 relative" dir="rtl">
      
      {/* כותרת חלקה */}
      <div className="px-4 mb-4 mt-2">
        <h2 className="text-2xl font-black text-brand-dark">לוח מודעות</h2>
      </div>

      {/* סינון קטגוריות חכם */}
      <div className="flex overflow-x-auto hide-scrollbar gap-2 px-4 mb-6 pb-2">
        {categories.map(cat => (
          <button 
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`whitespace-nowrap px-5 py-2 rounded-full text-sm font-bold transition shadow-sm border ${
              activeCategory === cat 
              ? 'bg-brand-blue text-white border-brand-blue' 
              : 'bg-white text-brand-dark border-gray-100 hover:bg-gray-50'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* רשימת המודעות */}
      <div className="space-y-4 px-4">
        {items.length === 0 ? (
          <div className="text-center py-10 bg-white/50 rounded-3xl border border-gray-100">
            <p className="text-brand-gray font-medium">אין מודעות כרגע בקטגוריה זו</p>
          </div>
        ) : (
          items.map(item => (
            <div key={item.id} className="bg-white p-5 rounded-3xl shadow-sm border border-gray-50 flex flex-col gap-3 relative overflow-hidden">
              
              {/* כפתור מחיקה אם המודעה שלי */}
              {profile?.id === item.user_id && (
                <button onClick={() => handleDelete(item.id)} className="absolute top-4 left-4 p-1.5 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                </button>
              )}

              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-brand-blue/10 flex items-center justify-center border border-brand-blue/20 overflow-hidden shrink-0">
                  <img src={item.profiles?.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${item.profiles?.full_name}&backgroundColor=transparent&textColor=1e3a8a`} className="w-full h-full object-cover p-1" />
                </div>
                <div>
                  <p className="text-xs font-bold text-brand-dark">{item.profiles?.full_name}</p>
                  <p className="text-[10px] text-brand-gray">{new Date(item.created_at).toLocaleDateString('he-IL')}</p>
                </div>
              </div>
              
              <div>
                <div className="flex justify-between items-start gap-2 mb-1">
                  <h3 className="font-black text-brand-dark text-base">{item.title}</h3>
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-lg shrink-0 ${item.category === 'למסירה' ? 'bg-green-50 text-green-600' : 'bg-brand-blue/10 text-brand-blue'}`}>
                    {item.category === 'למסירה' || item.price === 0 ? 'חינם' : `₪${item.price.toLocaleString()}`}
                  </span>
                </div>
                {item.description && <p className="text-sm text-brand-dark/80 leading-relaxed">{item.description}</p>}
              </div>

              {/* כפתורי יצירת קשר */}
              {profile?.id !== item.user_id && (
                <div className="flex gap-2 mt-3 pt-3 border-t border-gray-50">
                  <a href={`https://wa.me/972${item.contact_phone.replace(/^0+/, '').replace(/-/g, '')}`} target="_blank" className="flex-1 flex justify-center items-center gap-1.5 bg-[#25D366] hover:bg-[#22bf5b] text-white py-2.5 rounded-xl text-xs font-bold transition shadow-sm active:scale-95">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    וואטסאפ
                  </a>
                  <a href={`tel:${item.contact_phone}`} className="flex-1 flex justify-center items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-brand-dark py-2.5 rounded-xl text-xs font-bold transition shadow-sm active:scale-95">
                    חייג לשכן
                  </a>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* כפתור הוספת מודעה */}
      <button onClick={() => setIsModalOpen(true)} className="fixed bottom-28 left-4 z-40 bg-white/90 backdrop-blur-md border border-brand-blue/10 text-brand-blue p-1.5 pl-4 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:scale-105 active:scale-95 transition flex items-center gap-2">
        <div className="bg-brand-blue/10 p-2 rounded-full">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"></path></svg>
        </div>
        <span className="font-bold text-sm">פרסם מודעה</span>
      </button>

      {/* מודל יצירת מודעה */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex justify-center items-end">
          <div className="bg-white w-full max-w-md rounded-t-3xl p-6 pb-8 shadow-2xl animate-in slide-in-from-bottom-10 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6 sticky top-0 bg-white z-10 pt-2">
              <h3 className="font-black text-lg text-brand-dark">פרסום מודעה בבניין</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 bg-gray-100 rounded-full text-brand-dark hover:bg-gray-200">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            
            <form onSubmit={handleAddItem} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-brand-dark mb-1 block">כותרת המודעה *</label>
                <input type="text" required value={newItem.title} onChange={e => setNewItem({...newItem, title: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-blue transition" placeholder="לדוג': אופניים חשמליות במצב מעולה" />
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-xs font-bold text-brand-dark mb-1 block">סוג</label>
                  <select value={newItem.category} onChange={e => setNewItem({...newItem, category: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-blue transition">
                    {categories.filter(c => c !== 'הכל').map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-xs font-bold text-brand-dark mb-1 block">מחיר (₪) <span className="text-brand-gray font-normal">- השאר ריק אם חינם</span></label>
                  <input type="number" value={newItem.price} onChange={e => setNewItem({...newItem, price: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-blue transition" placeholder="0" />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-brand-dark mb-1 block">טלפון ליצירת קשר עם השכן *</label>
                <input type="tel" required value={newItem.contact_phone} onChange={e => setNewItem({...newItem, contact_phone: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-blue transition" placeholder="050-0000000" />
              </div>

              <div>
                <label className="text-xs font-bold text-brand-dark mb-1 block">תיאור ופרטים נוספים</label>
                <textarea value={newItem.description} onChange={e => setNewItem({...newItem, description: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-blue transition min-h-[80px]" placeholder="נמכר עקב מעבר, גמיש במחיר..."></textarea>
              </div>

              <button type="submit" disabled={isSubmitting} className="w-full bg-brand-blue text-white font-bold py-4 rounded-xl shadow-[0_8px_20px_rgba(0,68,204,0.3)] mt-2 active:scale-95 transition disabled:opacity-50">
                {isSubmitting ? 'מפרסם...' : 'פרסם עכשיו'}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}

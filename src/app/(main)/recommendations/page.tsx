'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'

const categories = ['הכל', 'אינסטלטור', 'חשמלאי', 'טכנאי מזגנים', 'מנקה', 'הנדימן', 'מנעולן', 'אחר']

export default function RecommendationsPage() {
  const [professionals, setProfessionals] = useState<any[]>([])
  const [activeCategory, setActiveCategory] = useState('הכל')
  const [currentUser, setCurrentUser] = useState<any>(null)
  
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [newPro, setNewPro] = useState({
    name: '',
    category: 'אינסטלטור',
    phone: '',
    rating: 5,
    review_text: ''
  })

  const fetchProfessionals = async () => {
    let query = supabase
      .from('professionals')
      .select('*, profiles(full_name, avatar_url)')
      .order('created_at', { ascending: false })
      
    if (activeCategory !== 'הכל') {
      query = query.eq('category', activeCategory)
    }
    const { data } = await query
    if (data) setProfessionals(data)
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setCurrentUser(user))
    fetchProfessionals()
  }, [activeCategory])

  const handleAddRecommendation = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPro.name || !newPro.phone || !currentUser) return
    
    setIsSubmitting(true)
    const { error } = await supabase.from('professionals').insert([{ 
      ...newPro, 
      added_by: currentUser.id,
      reviews_count: 1
    }])
    
    if (!error) {
      setIsModalOpen(false)
      setNewPro({ name: '', category: 'אינסטלטור', phone: '', rating: 5, review_text: '' })
      fetchProfessionals()
    } else {
      alert("שגיאה בהוספת ההמלצה: " + error.message)
    }
    setIsSubmitting(false)
  }

  return (
    <div className="flex flex-col flex-1 w-full pb-24 relative" dir="rtl">
      
      <div className="px-4 mb-4 mt-2">
        <h2 className="text-2xl font-black text-brand-dark">המלצות</h2>
      </div>

      {/* סינון קטגוריות */}
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

      {/* רשימת ההמלצות */}
      <div className="space-y-4 px-4">
        {professionals.length === 0 ? (
          <div className="text-center py-10 bg-white/50 rounded-3xl border border-gray-100">
            <p className="text-brand-gray font-medium">עדיין אין המלצות בקטגוריה זו</p>
          </div>
        ) : (
          professionals.map(pro => (
            <div key={pro.id} className="bg-white p-5 rounded-3xl shadow-sm border border-gray-50 flex flex-col gap-3 relative overflow-hidden">
              <div className="flex items-center gap-4">
                
                {/* אווטאר עגול ופרופורציונלי עם צבע כחול-אפור עדין */}
                <div className="w-14 h-14 rounded-full bg-brand-blue/10 border border-brand-blue/20 flex items-center justify-center shadow-sm z-10 shrink-0 overflow-hidden">
                  <img src={`https://api.dicebear.com/7.x/initials/svg?seed=${pro.name}&backgroundColor=transparent&textColor=1e3a8a`} alt={pro.name} className="w-full h-full object-cover p-1.5" />
                </div>

                <div className="flex-1 z-10">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-black text-brand-dark text-base">{pro.name}</h3>
                      <p className="text-[10px] font-bold text-brand-blue bg-blue-50 px-2 py-0.5 rounded-md inline-block mt-0.5">{pro.category}</p>
                    </div>
                    <div className="flex items-center gap-1 bg-orange-50 px-2 py-1 rounded-lg">
                      <span className="font-bold text-xs text-orange-600">{pro.rating}</span>
                      <svg className="w-3.5 h-3.5 text-orange-500" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path></svg>
                    </div>
                  </div>
                </div>
              </div>
              
              {pro.review_text && (
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 relative">
                  <svg className="w-4 h-4 text-gray-300 absolute top-2 right-2" fill="currentColor" viewBox="0 0 24 24"><path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" /></svg>
                  <p className="text-xs text-brand-dark pr-6 leading-relaxed">"{pro.review_text}"</p>
                  {pro.profiles && <p className="text-[9px] text-brand-gray mt-2 pr-6 font-bold">הומלץ ע"י {pro.profiles.full_name}</p>}
                </div>
              )}
              
              <div className="flex gap-2 mt-1">
                <a href={`tel:${pro.phone}`} className="flex-1 flex justify-center items-center gap-1.5 bg-brand-dark hover:bg-gray-800 text-white py-2 rounded-xl text-xs font-bold transition shadow-sm active:scale-95">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
                  חייג
                </a>
                <a href={`https://wa.me/972${pro.phone.replace(/^0+/, '').replace(/-/g, '')}`} target="_blank" className="flex-1 flex justify-center items-center gap-1.5 bg-[#25D366] hover:bg-[#22bf5b] text-white py-2 rounded-xl text-xs font-bold transition shadow-sm active:scale-95">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  וואטסאפ
                </a>
              </div>
            </div>
          ))
        )}
      </div>

      {/* כפתור "המלץ" מעוצב בדיוק כמו התפריט התחתון וממוקם קצת יותר גבוה */}
      <button onClick={() => setIsModalOpen(true)} className="fixed bottom-28 left-4 z-40 bg-white/90 backdrop-blur-md border border-brand-blue/10 text-brand-blue p-1.5 pl-4 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:scale-105 active:scale-95 transition flex items-center gap-2">
        <div className="bg-brand-blue/10 p-2 rounded-full">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"></path></svg>
        </div>
        <span className="font-bold text-sm">המלץ</span>
      </button>

      {/* מודל להוספת בעל מקצוע - z-[60] מסתיר את התפריט התחתון ומוצמד לתחתית */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex justify-center items-end">
          <div className="bg-white w-full max-w-md rounded-t-3xl p-6 pb-8 shadow-2xl animate-in slide-in-from-bottom-10 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6 sticky top-0 bg-white z-10 pt-2">
              <h3 className="font-black text-lg text-brand-dark">המלצה על בעל מקצוע</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 bg-gray-100 rounded-full text-brand-dark hover:bg-gray-200">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            
            <form onSubmit={handleAddRecommendation} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-brand-dark mb-1 block">שם איש המקצוע / העסק *</label>
                <input type="text" required value={newPro.name} onChange={e => setNewPro({...newPro, name: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-blue transition" placeholder="לדוג': אבי חשמל" />
              </div>
              
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-xs font-bold text-brand-dark mb-1 block">מספר טלפון *</label>
                  <input type="tel" required value={newPro.phone} onChange={e => setNewPro({...newPro, phone: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-blue transition" placeholder="050-0000000" />
                </div>
                <div className="flex-1">
                  <label className="text-xs font-bold text-brand-dark mb-1 block">קטגוריה</label>
                  <select value={newPro.category} onChange={e => setNewPro({...newPro, category: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-blue transition">
                    {categories.filter(c => c !== 'הכל').map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-brand-dark mb-2 block">דירוג (מ-1 עד 5)</label>
                <div className="flex gap-2 justify-center bg-gray-50 py-3 rounded-xl border border-gray-200">
                  {[1,2,3,4,5].map(star => (
                    <button key={star} type="button" onClick={() => setNewPro({...newPro, rating: star})} className="transition hover:scale-110 active:scale-95">
                      <svg className={`w-8 h-8 ${star <= newPro.rating ? 'text-orange-400 drop-shadow-sm' : 'text-gray-300'}`} fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path></svg>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-brand-dark mb-1 block">מילים חמות (למה אתה ממליץ?)</label>
                <textarea value={newPro.review_text} onChange={e => setNewPro({...newPro, review_text: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-blue transition min-h-[80px]" placeholder="הגיע בזמן, עבד נקי, לקח מחיר הוגן..."></textarea>
              </div>

              <button type="submit" disabled={isSubmitting} className="w-full bg-brand-blue text-white font-bold py-4 rounded-xl shadow-[0_8px_20px_rgba(0,68,204,0.3)] mt-2 active:scale-95 transition disabled:opacity-50">
                {isSubmitting ? 'שומר המלצה...' : 'פרסם המלצה לבניין'}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}

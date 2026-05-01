'use client'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '../../../lib/supabase'

const filterTabs = ['הכל', 'בעלי מקצוע', 'מסעדות', 'שונות']
const popularSearches = ['אינסטלטור', 'חשמלאי', 'מנקה', 'בייביסיטר', 'הנדימן', 'מזגנים']

export default function RecommendationsPage() {
  const [profile, setProfile] = useState<any>(null)
  const [items, setItems] = useState<any[]>([])
  const [activeFilter, setActiveFilter] = useState('הכל')
  const [searchQuery, setSearchQuery] = useState('')
  const [currentUser, setCurrentUser] = useState<any>(null)
  
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [newItem, setNewItem] = useState({ title: '', description: '', category: 'בעלי מקצוע', phone: '' })
  
  // הוספנו סטייט לניהול השגיאות במודל מעוצב במקום Alert
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const fetchData = useCallback(async (userToFetch: any) => {
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', userToFetch.id).single()
    if (!prof || !prof.building_id) return
    setProfile(prof)

    const { data } = await supabase
      .from('recommendations')
      .select('*, profiles(full_name, avatar_url)')
      .eq('building_id', prof.building_id)
      .order('created_at', { ascending: false })

    if (data) setItems(data)
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setCurrentUser(user)
        fetchData(user)
      }
    })

    const channel = supabase.channel('recommendations_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recommendations' }, () => {
        if (currentUser) fetchData(currentUser)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchData, currentUser])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!profile?.building_id) {
      setErrorMessage("המערכת לא מזהה שאתה משויך לבניין. נסה לרענן את העמוד.")
      return
    }
    if (!newItem.title) return

    setIsSubmitting(true)

    const { error } = await supabase.from('recommendations').insert([{
      building_id: profile.building_id,
      user_id: profile.id,
      title: newItem.title,
      description: newItem.description,
      category: newItem.category,
      phone: newItem.phone
    }])

    if (error) {
      console.error("שגיאת שמירה:", error)
      setErrorMessage("הייתה בעיה בשמירת ההמלצה: " + error.message)
    } else {
      setIsModalOpen(false)
      setNewItem({ title: '', description: '', category: 'בעלי מקצוע', phone: '' })
      if (currentUser) fetchData(currentUser)
    }
    
    setIsSubmitting(false)
  }

  const handleDelete = async (id: string, itemUserId: string) => {
    if (profile?.role === 'admin' || profile?.id === itemUserId) {
      if (confirm("למחוק את ההמלצה?")) {
        await supabase.from('recommendations').delete().eq('id', id)
        if (currentUser) fetchData(currentUser)
      }
    }
  }

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesFilter = activeFilter === 'הכל' || item.category === activeFilter
      const searchLower = searchQuery.toLowerCase()
      const matchesSearch = 
        item.title.toLowerCase().includes(searchLower) || 
        (item.description && item.description.toLowerCase().includes(searchLower)) ||
        (item.phone && item.phone.includes(searchLower))
      
      return matchesFilter && matchesSearch
    })
  }, [items, activeFilter, searchQuery])

  const formatWhatsApp = (phone: string) => {
    let clean = phone.replace(/\D/g, '')
    if (clean.startsWith('0')) clean = '972' + clean.slice(1)
    return `https://wa.me/${clean}`
  }

  return (
    <div className="flex flex-col flex-1 w-full pb-28 relative" dir="rtl">
      
      <div className="px-4 mt-2 mb-4 flex items-center justify-between">
         <h2 className="text-2xl font-black text-brand-dark">המלצות השכנים</h2>
      </div>

      <div className="px-4 mb-4">
        <div className="relative">
          <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
            <svg className="w-5 h-5 text-brand-gray/50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
          </div>
          <input 
            type="text" 
            placeholder="חפש בעל מקצוע או שירות..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-gray-100 rounded-2xl py-3.5 pr-11 pl-4 text-sm shadow-sm outline-none text-brand-dark focus:border-brand-blue/30 transition placeholder:text-brand-gray/60"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute inset-y-0 left-0 pl-4 flex items-center text-brand-gray hover:text-brand-dark transition">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
          )}
        </div>
      </div>

      <div className="px-4 mb-5">
        <p className="text-[10px] font-bold text-brand-gray mb-2">חיפושים פופולריים:</p>
        <div className="flex flex-wrap gap-2">
          {popularSearches.map(tag => (
            <button 
              key={tag}
              onClick={() => setSearchQuery(tag)}
              className="bg-brand-blue/5 text-brand-blue px-3 py-1.5 rounded-xl text-xs font-medium hover:bg-brand-blue/10 active:scale-95 transition border border-brand-blue/10 shadow-sm"
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      <div className="flex overflow-x-auto hide-scrollbar gap-2.5 px-4 mb-6 pb-1">
        {filterTabs.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveFilter(tab)}
            className={`whitespace-nowrap px-6 py-2 rounded-2xl text-sm font-bold transition shadow-sm border ${
              activeFilter === tab
                ? 'bg-brand-blue text-white border-brand-blue'
                : 'bg-white text-brand-dark/70 border-gray-100 hover:bg-gray-50'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="space-y-4 px-4">
        {filteredItems.length === 0 ? (
          <div className="text-center py-12 bg-white/50 rounded-3xl border border-gray-100">
            <p className="text-brand-gray font-medium">לא מצאנו המלצות שמתאימות לחיפוש 🧐</p>
            <button onClick={() => setIsModalOpen(true)} className="mt-3 text-sm font-bold text-brand-blue hover:underline">
              תהיה הראשון להמליץ!
            </button>
          </div>
        ) : (
          filteredItems.map(item => (
            <div 
              key={item.id} 
              className="bg-white p-5 rounded-3xl shadow-sm border border-gray-50 flex flex-col relative transition-all hover:shadow-md"
              onDoubleClick={() => handleDelete(item.id, item.user_id)}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <img src={item.profiles?.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${item.profiles?.full_name}`} className="w-7 h-7 rounded-full border border-gray-100" />
                  <div>
                    <span className="text-[10px] text-brand-gray block leading-none mb-0.5">המליץ/ה</span>
                    <span className="text-xs font-bold text-brand-dark leading-none">{item.profiles?.full_name}</span>
                  </div>
                </div>
                <span className="bg-gray-50 text-brand-gray text-[10px] font-bold px-2 py-1 rounded-lg border border-gray-100">
                  {item.category}
                </span>
              </div>
              
              <h3 className="font-black text-brand-dark text-lg leading-tight mb-1">{item.title}</h3>
              <p className="text-sm text-brand-dark/80 leading-relaxed whitespace-pre-wrap mb-4">
                {item.description}
              </p>

              {item.phone && (
                <div className="flex gap-2 mt-auto pt-4 border-t border-gray-50">
                  <a href={formatWhatsApp(item.phone)} target="_blank" rel="noopener noreferrer" className="flex-1 bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 py-2 rounded-xl flex items-center justify-center gap-2 font-bold text-xs transition">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"></path></svg>
                    וואטסאפ
                  </a>
                  <a href={`tel:${item.phone}`} className="flex-1 bg-brand-blue/10 text-brand-blue hover:bg-brand-blue/20 py-2 rounded-xl flex items-center justify-center gap-2 font-bold text-xs transition">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
                    חייג
                  </a>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <button 
        onClick={() => setIsModalOpen(true)} 
        className="fixed bottom-28 left-5 z-40 bg-white border border-brand-blue/20 text-brand-dark pl-4 pr-1.5 py-1.5 rounded-full shadow-[0_10px_40px_rgba(0,68,204,0.15)] hover:scale-105 active:scale-95 transition flex items-center gap-3 group"
      >
        <div className="bg-brand-blue/10 text-brand-blue p-2.5 rounded-full group-hover:bg-brand-blue group-hover:text-white transition">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"></path></svg>
        </div>
        <span className="font-bold text-sm">המלץ</span>
      </button>

      {isModalOpen && (
        <div className="fixed inset-0 z-[50] bg-black/60 backdrop-blur-sm flex justify-center items-end">
          <div className="bg-white w-full max-w-md rounded-t-3xl p-6 pb-8 shadow-2xl animate-in slide-in-from-bottom-10 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6 sticky top-0 bg-white z-10 pt-2">
              <h3 className="font-black text-lg text-brand-dark">הוספת המלצה</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 bg-gray-100 rounded-full text-brand-dark hover:bg-gray-200 transition">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-brand-dark mb-1 block">מי או מה מומלץ? *</label>
                <input type="text" required value={newItem.title} onChange={e => setNewItem({...newItem, title: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-blue transition text-brand-dark" placeholder="לדוג': יוסי האינסטלטור" />
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs font-bold text-brand-dark mb-1 block">קטגוריה</label>
                  <select value={newItem.category} onChange={e => setNewItem({...newItem, category: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-blue transition text-brand-dark">
                    {filterTabs.filter(t => t !== 'הכל').map(tab => <option key={tab} value={tab}>{tab}</option>)}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-xs font-bold text-brand-dark mb-1 block">טלפון (אופציונלי)</label>
                  <input type="tel" value={newItem.phone} onChange={e => setNewItem({...newItem, phone: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-blue transition text-brand-dark text-left" dir="ltr" placeholder="050-0000000" />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-brand-dark mb-1 block">למה את/ה ממליץ/ה?</label>
                <textarea required value={newItem.description} onChange={e => setNewItem({...newItem, description: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-blue transition min-h-[100px] text-brand-dark" placeholder="ספרו לשכנים על החוויה שלכם..."></textarea>
              </div>

              <button type="submit" disabled={isSubmitting} className="w-full bg-brand-blue text-white font-bold py-4 rounded-xl shadow-[0_8px_20px_rgba(0,68,204,0.3)] mt-4 active:scale-95 transition disabled:opacity-50">
                {isSubmitting ? 'שומר...' : 'שתף המלצה'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* מודל השגיאה המעוצב שלנו במקום ה-alert */}
      {errorMessage && (
        <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-in zoom-in-95">
            <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mb-4 mx-auto text-red-500">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
            </div>
            <h3 className="font-black text-lg text-center text-brand-dark mb-2">אופס, משהו השתבש</h3>
            <p className="text-sm text-center text-brand-gray mb-6 leading-relaxed">{errorMessage}</p>
            <button 
              onClick={() => setErrorMessage(null)} 
              className="w-full bg-gray-100 text-brand-dark font-bold py-3 rounded-xl hover:bg-gray-200 transition active:scale-95"
            >
              הבנתי, סגור
            </button>
          </div>
        </div>
      )}

    </div>
  )
}

'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'

const filterTabs = ['הכל', 'למכירה', 'דרושים', 'שונות']

export default function ClassifiedsPage() {
  const [profile, setProfile] = useState<any>(null)
  const [items, setItems] = useState<any[]>([])
  const [activeFilter, setActiveFilter] = useState('הכל')
  const [searchQuery, setSearchQuery] = useState('')
  const [currentUser, setCurrentUser] = useState<any>(null)
  
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [newItem, setNewItem] = useState({ title: '', description: '', category: 'למכירה' })
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null)

  const fetchData = useCallback(async (userToFetch: any) => {
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', userToFetch.id).single()
    if (!prof || !prof.building_id) return
    setProfile(prof)

    let query = supabase.from('classifieds')
      .select('*, profiles(full_name, avatar_url, apartment)')
      .eq('building_id', prof.building_id)
      .order('created_at', { ascending: false })

    if (activeFilter !== 'הכל') {
      query = query.eq('category', activeFilter)
    }
    
    if (searchQuery.trim()) {
      query = query.ilike('title', `%${searchQuery}%`)
    }

    const { data } = await query
    if (data) setItems(data)
  }, [activeFilter, searchQuery])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setCurrentUser(user)
        fetchData(user)
      }
    })

    const channel = supabase.channel('classifieds_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'classifieds' }, () => {
        if (currentUser) fetchData(currentUser)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchData, currentUser])

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      setImageFile(file)
      setImagePreview(URL.createObjectURL(file))
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile?.building_id || !newItem.title) return

    setIsSubmitting(true)
    let imageUrl = null

    if (imageFile) {
      const fileExt = imageFile.name.split('.').pop()
      const fileName = `${Date.now()}.${fileExt}`
      const { data, error: uploadError } = await supabase.storage.from('classifieds').upload(fileName, imageFile)
      if (!uploadError && data) {
        imageUrl = supabase.storage.from('classifieds').getPublicUrl(fileName).data.publicUrl
      }
    }

    const { error } = await supabase.from('classifieds').insert([{
      building_id: profile.building_id,
      user_id: profile.id,
      title: newItem.title,
      description: newItem.description,
      category: newItem.category,
      image_url: imageUrl
    }])

    if (!error && currentUser) {
      setIsModalOpen(false)
      setNewItem({ title: '', description: '', category: 'למכירה' })
      setImageFile(null)
      setImagePreview(null)
      fetchData(currentUser)
    }
    setIsSubmitting(false)
  }

  const handleDelete = async (id: string, itemUserId: string) => {
    if (profile?.role === 'admin' || profile?.id === itemUserId) {
      if (confirm("למחוק את המודעה?")) {
        await supabase.from('classifieds').delete().eq('id', id)
        if (currentUser) fetchData(currentUser)
      }
    }
  }

  const timeFormat = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 3600 * 24))
    
    if (diffDays === 0) return date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
    if (diffDays === 1) return 'אתמול'
    return date.toLocaleDateString('he-IL')
  }

  return (
    <div className="flex flex-col flex-1 w-full pb-28 relative" dir="rtl">
      
      <div className="px-4 mt-2 mb-2 flex items-center justify-between">
         <h2 className="text-2xl font-black text-brand-dark">לוח מודעות</h2>
      </div>

      <div className="flex gap-3 px-4 mb-5">
        <div className="flex-1 relative">
          <input 
            type="text" 
            placeholder="חיפוש בלוח המודעות" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-gray-100 rounded-2xl py-3.5 px-4 text-sm shadow-sm outline-none text-brand-dark focus:border-brand-blue/30 transition placeholder:text-brand-gray/60"
          />
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-[#2D5AF0] text-white rounded-[18px] w-12 h-12 flex items-center justify-center shadow-md shrink-0 active:scale-95 transition"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"></path></svg>
        </button>
      </div>

      <div className="flex overflow-x-auto hide-scrollbar gap-2.5 px-4 mb-6 pb-1">
        {filterTabs.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveFilter(tab)}
            className={`whitespace-nowrap px-6 py-2 rounded-2xl text-sm font-bold transition shadow-sm ${
              activeFilter === tab
                ? 'bg-[#2D5AF0] text-white'
                : 'bg-gray-100/80 text-brand-dark/70 hover:bg-gray-200'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="space-y-4 px-4">
        {items.length === 0 ? (
          <div className="text-center py-12 bg-white/50 rounded-3xl border border-gray-100">
            <p className="text-brand-gray font-medium">לא נמצאו מודעות</p>
          </div>
        ) : (
          items.map(item => (
            <div 
              key={item.id} 
              className="bg-white p-3 rounded-3xl shadow-sm border border-gray-50 flex gap-4 h-[120px] relative overflow-hidden"
              onDoubleClick={() => handleDelete(item.id, item.user_id)}
            >
              <div className="absolute bottom-3 left-4 text-[11px] text-brand-gray font-medium">
                {timeFormat(item.created_at)}
              </div>

              <div 
                className="w-[100px] h-full rounded-2xl bg-gray-50 shrink-0 border border-gray-100 overflow-hidden cursor-pointer"
                onClick={() => item.image_url && setFullScreenImage(item.image_url)}
              >
                {item.image_url ? (
                  <img src={item.image_url} alt="מודעה" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-brand-blue/20">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                  </div>
                )}
              </div>
              
              <div className="flex-1 py-1 flex flex-col pt-1">
                <h3 className="font-bold text-[#0F172A] text-[16px] leading-tight mb-1 pl-2">{item.title}</h3>
                <p className="text-sm text-[#334155] leading-snug line-clamp-2 pl-2">
                  {item.description}
                </p>
                <div className="mt-auto text-[11px] text-[#64748B] font-medium flex items-center gap-1.5">
                  {item.profiles?.full_name} • דירה {item.profiles?.apartment || '?'}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex justify-center items-end">
          <div className="bg-white w-full max-w-md rounded-t-3xl p-6 pb-8 shadow-2xl animate-in slide-in-from-bottom-10 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6 sticky top-0 bg-white z-10 pt-2">
              <h3 className="font-black text-lg text-brand-dark">מודעה חדשה</h3>
              <button onClick={() => { setIsModalOpen(false); setImagePreview(null); setImageFile(null); }} className="p-2 bg-gray-100 rounded-full text-brand-dark hover:bg-gray-200 transition">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-brand-dark mb-1 block">כותרת המודעה *</label>
                <input type="text" required value={newItem.title} onChange={e => setNewItem({...newItem, title: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-blue transition text-brand-dark" placeholder="לדוג': מוכרת כיסא תינוק" />
              </div>

              <div>
                <label className="text-xs font-bold text-brand-dark mb-1 block">קטגוריה</label>
                <select value={newItem.category} onChange={e => setNewItem({...newItem, category: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-blue transition text-brand-dark">
                  {filterTabs.filter(t => t !== 'הכל').map(tab => <option key={tab} value={tab}>{tab}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-brand-dark mb-1 block">תיאור ומחיר</label>
                <textarea value={newItem.description} onChange={e => setNewItem({...newItem, description: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-blue transition min-h-[80px] text-brand-dark" placeholder="לדוג': כמעט חדש, 150 ₪"></textarea>
              </div>

              <div>
                <label className="text-xs font-bold text-brand-dark mb-1 block">תמונה</label>
                <div className="relative border-2 border-dashed border-brand-blue/30 rounded-xl bg-brand-blue/5 hover:bg-brand-blue/10 transition text-center cursor-pointer overflow-hidden">
                  <input type="file" accept="image/*" onChange={handleImageChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                  {imagePreview ? (
                    <img src={imagePreview} alt="Preview" className="w-full h-32 object-cover" />
                  ) : (
                    <div className="py-6 flex flex-col items-center gap-2">
                      <svg className="w-8 h-8 text-brand-blue/50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                      <span className="text-xs font-bold text-brand-blue/70">לחץ להעלאת תמונה</span>
                    </div>
                  )}
                </div>
              </div>

              <button type="submit" disabled={isSubmitting} className="w-full bg-[#2D5AF0] text-white font-bold py-4 rounded-xl shadow-[0_8px_20px_rgba(45,90,240,0.3)] mt-4 active:scale-95 transition disabled:opacity-50">
                {isSubmitting ? 'מפרסם...' : 'פרסם מודעה'}
              </button>
            </form>
          </div>
        </div>
      )}

      {fullScreenImage && (
        <div 
          className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in cursor-pointer" 
          onClick={() => setFullScreenImage(null)}
        >
          <button className="absolute top-6 left-6 text-white p-2 hover:bg-white/20 rounded-full transition z-10">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
          <img src={fullScreenImage} alt="Fullscreen" className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  )
}

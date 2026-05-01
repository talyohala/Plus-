'use client'
import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { supabase } from '../../../lib/supabase'

// הוספנו את 'שמורים' לטאבים!
const categories = ['הכל', 'שמורים', 'למכירה', 'למסירה', 'שירותים', 'דרושים']

export default function MarketplacePage() {
  const [profile, setProfile] = useState<any>(null)
  const [items, setItems] = useState<any[]>([])
  const [savedItemsIds, setSavedItemsIds] = useState<Set<string>>(new Set()) // שמירת ה-IDs שהמשתמש שמר
  const [activeCategory, setActiveCategory] = useState('הכל')
  const [searchQuery, setSearchQuery] = useState('')
  const [currentUser, setCurrentUser] = useState<any>(null)
  
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const [newItem, setNewItem] = useState({ title: '', description: '', price: '', contact_phone: '', category: 'למכירה' })
  const [pendingMedia, setPendingMedia] = useState<{file: File, preview: string, type: string} | null>(null)
  const [fullScreenMedia, setFullScreenMedia] = useState<{url: string, type: string} | null>(null)

  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [editItemData, setEditItemData] = useState({ title: '', description: '', price: '', contact_phone: '', category: 'למכירה' })
  const [pendingEditMedia, setPendingEditMedia] = useState<{file: File, preview: string, type: string} | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const editFileInputRef = useRef<HTMLInputElement>(null)

  const fetchData = useCallback(async (userToFetch: any) => {
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', userToFetch.id).single()
    if (!prof || !prof.building_id) return
    setProfile(prof)

    // משיכת השמירות של המשתמש
    const { data: saves } = await supabase.from('marketplace_saves').select('item_id').eq('user_id', prof.id)
    if (saves) {
      setSavedItemsIds(new Set(saves.map(s => s.item_id)))
    }

    let query = supabase.from('marketplace_items')
      .select('*, profiles(full_name, avatar_url, apartment, role)')
      .eq('building_id', prof.building_id)
      .eq('status', 'available')
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })

    const { data } = await query
    if (data) setItems(data)
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setCurrentUser(user)
        fetchData(user)
      }
    })

    const channel = supabase.channel('marketplace_realtime_v7')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'marketplace_items' }, () => {
        if (currentUser) fetchData(currentUser)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchData, currentUser])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const type = file.type.startsWith('video/') ? 'video' : 'image'
    setPendingMedia({ file, preview: URL.createObjectURL(file), type })
  }

  const handleEditFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const type = file.type.startsWith('video/') ? 'video' : 'image'
    setPendingEditMedia({ file, preview: URL.createObjectURL(file), type })
  }

  const openCreateModal = () => {
    setEditingItemId(null)
    setNewItem({ title: '', description: '', price: '', contact_phone: '', category: 'למכירה' })
    setPendingMedia(null)
    setIsModalOpen(true)
  }

  const handleEditClick = (item: any) => {
    setEditingItemId(item.id)
    setEditItemData({
      title: item.title,
      description: item.description || '',
      price: item.price === 0 ? '' : item.price.toString(),
      contact_phone: item.contact_phone,
      category: item.category
    })
    setPendingEditMedia(null)
    setOpenMenuId(null)
  }

  const handleInlineEditSubmit = async (e: React.FormEvent, id: string) => {
    e.preventDefault()
    setIsSubmitting(true)

    let mediaUrl = undefined
    let mediaType = undefined

    if (pendingEditMedia) {
      const fileExt = pendingEditMedia.file.name.split('.').pop()
      const filePath = `marketplace/${profile.id}_edit_${Date.now()}.${fileExt}`
      const { error: uploadError } = await supabase.storage.from('chat_uploads').upload(filePath, pendingEditMedia.file)
      
      if (!uploadError) {
        const { data } = supabase.storage.from('chat_uploads').getPublicUrl(filePath)
        mediaUrl = data.publicUrl
        mediaType = pendingEditMedia.type
      }
    }

    const payload: any = {
      title: editItemData.title,
      description: editItemData.description,
      price: editItemData.price === '' ? 0 : parseInt(editItemData.price),
      contact_phone: editItemData.contact_phone,
      category: editItemData.category
    }

    if (pendingEditMedia) {
      payload.media_url = mediaUrl
      payload.media_type = mediaType
    }

    await supabase.from('marketplace_items').update(payload).eq('id', id)
    setEditingItemId(null)
    setPendingEditMedia(null)
    if (currentUser) fetchData(currentUser)
    setIsSubmitting(false)
  }

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!profile?.building_id) {
      setErrorMessage("המערכת לא מזהה שאתה משויך לבניין. נסה לרענן את העמוד.")
      return
    }
    if (!newItem.title || !newItem.contact_phone) return

    setIsSubmitting(true)
    let mediaUrl = undefined
    let mediaType = undefined

    if (pendingMedia) {
      const fileExt = pendingMedia.file.name.split('.').pop()
      const filePath = `marketplace/${profile.id}_${Date.now()}.${fileExt}`
      const { error: uploadError } = await supabase.storage.from('chat_uploads').upload(filePath, pendingMedia.file)
      
      if (!uploadError) {
        const { data } = supabase.storage.from('chat_uploads').getPublicUrl(filePath)
        mediaUrl = data.publicUrl
        mediaType = pendingMedia.type
      }
    }

    const payload: any = {
      building_id: profile.building_id,
      user_id: profile.id,
      title: newItem.title,
      description: newItem.description,
      price: newItem.price === '' ? 0 : parseInt(newItem.price),
      contact_phone: newItem.contact_phone,
      category: newItem.category,
    }

    if (pendingMedia) {
      payload.media_url = mediaUrl
      payload.media_type = mediaType
    }

    const { error } = await supabase.from('marketplace_items').insert([payload])

    if (error) {
      setErrorMessage("הייתה בעיה בשמירת המודעה: " + error.message)
    } else {
      setIsModalOpen(false)
      setNewItem({ title: '', description: '', price: '', contact_phone: '', category: 'למכירה' })
      setPendingMedia(null)
      if (currentUser) fetchData(currentUser)
    }
    setIsSubmitting(false)
  }

  const handleDelete = async (id: string) => {
    if(confirm("האם למחוק את המודעה?")) {
      await supabase.from('marketplace_items').delete().eq('id', id)
      setOpenMenuId(null)
      if (currentUser) fetchData(currentUser)
    }
  }

  const togglePin = async (id: string, currentStatus: boolean) => {
    await supabase.from('marketplace_items').update({ is_pinned: !currentStatus }).eq('id', id)
    setOpenMenuId(null)
    if (currentUser) fetchData(currentUser)
  }

  // פונקציית שמירת מודעה לטאב שמורים
  const toggleSave = async (id: string, isCurrentlySaved: boolean) => {
    setOpenMenuId(null) // סוגר את התפריט
    if (!profile) return

    if (isCurrentlySaved) {
      await supabase.from('marketplace_saves').delete().match({ item_id: id, user_id: profile.id })
      setSavedItemsIds(prev => { const next = new Set(prev); next.delete(id); return next; })
    } else {
      await supabase.from('marketplace_saves').insert([{ item_id: id, user_id: profile.id }])
      setSavedItemsIds(prev => { const next = new Set(prev); next.add(id); return next; })
    }
  }

  // סינון "חי" על פי קטגוריה וחיפוש (עובד גם על שמורים!)
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const isSaved = savedItemsIds.has(item.id);
      
      // אם אנחנו בטאב שמורים, תסנן רק את מה ששמור
      if (activeCategory === 'שמורים' && !isSaved) return false;

      const matchesFilter = activeCategory === 'הכל' || activeCategory === 'שמורים' || item.category === activeCategory
      const searchLower = searchQuery.toLowerCase()
      const matchesSearch = 
        item.title.toLowerCase().includes(searchLower) || 
        (item.description && item.description.toLowerCase().includes(searchLower)) ||
        (item.contact_phone && item.contact_phone.includes(searchLower))
      
      return matchesFilter && matchesSearch
    })
  }, [items, activeCategory, searchQuery, savedItemsIds])

  const formatWhatsApp = (phone: string) => {
    let clean = phone.replace(/\D/g, '')
    if (clean.startsWith('0')) clean = '972' + clean.slice(1)
    return `https://wa.me/${clean}`
  }

  const timeFormat = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 3600 * 24))
    if (diffDays === 0) return date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
    if (diffDays === 1) return 'אתמול'
    return date.toLocaleDateString('he-IL')
  }

  const isAdmin = profile?.role === 'admin'

  return (
    <div className="flex flex-col flex-1 w-full pb-28 relative" dir="rtl">
      
      <div className="px-4 mt-2 mb-4 flex items-center justify-between">
         <h2 className="text-2xl font-black text-brand-dark">לוח מודעות</h2>
      </div>

      <div className="px-4 mb-5">
        <div className="relative">
          <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
            <svg className="w-5 h-5 text-brand-gray/50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
          </div>
          <input 
            type="text" 
            placeholder="חיפוש מודעה או טלפון..." 
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

      <div className="flex overflow-x-auto hide-scrollbar gap-2.5 px-4 mb-6 pb-1">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`whitespace-nowrap px-6 py-2 rounded-2xl text-sm font-bold transition shadow-sm border ${
              activeCategory === cat
                ? 'bg-[#2D5AF0] text-white border-[#2D5AF0]'
                : 'bg-white text-brand-dark/70 border-gray-100 hover:bg-gray-50'
            }`}
          >
            {cat === 'שמורים' && <svg className="w-3.5 h-3.5 inline-block ml-1.5 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"></path></svg>}
            {cat}
          </button>
        ))}
      </div>

      <div className="space-y-4 px-4">
        {filteredItems.length === 0 ? (
          <div className="text-center py-12 bg-white/50 rounded-3xl border border-gray-100">
            <p className="text-brand-gray font-medium">לא מצאנו מודעות שמתאימות לחיפוש 🧐</p>
          </div>
        ) : (
          filteredItems.map(item => {
            const isOwner = profile?.id === item.user_id;
            const isSaved = savedItemsIds.has(item.id);

            return (
              // הוסר המאפיין overflow-hidden כדי שהתפריט יצוף מעל הכל בצורה חופשית
              <div key={item.id} className={`bg-white p-3 rounded-3xl shadow-sm border flex flex-col relative transition-all ${item.is_pinned ? 'border-brand-blue/30 shadow-[0_4px_20px_rgba(0,68,204,0.1)]' : 'border-gray-50'}`}>
                
                {item.is_pinned && (
                  <div className="absolute top-0 right-4 bg-brand-blue text-white text-[10px] font-black px-3 py-1 rounded-b-lg shadow-sm flex items-center gap-1 z-10">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z"></path></svg>
                    נעוץ
                  </div>
                )}

                {/* תפריט 3 הנקודות - נקי וקלאסי (בלי הרקע) */}
                <div className="absolute top-2 left-2 z-40">
                  <div className="relative">
                    <button onClick={() => setOpenMenuId(openMenuId === item.id ? null : item.id)} className="p-2 transition hover:scale-110 text-gray-400 hover:text-brand-dark">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"></path></svg>
                    </button>
                    
                    {/* z-[100] כדי לוודא שהתפריט עולה מעל כל האלמנטים האחרים (והתמונות) בעמוד */}
                    {openMenuId === item.id && (
                      <div className="absolute left-0 top-8 w-44 bg-white border border-gray-100 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.15)] z-[100] overflow-hidden py-1">
                        
                        {/* כפתור "שמור מודעה" - תמיד מופיע לכולם */}
                        <button onClick={() => toggleSave(item.id, isSaved)} className="w-full text-right px-4 py-2.5 text-xs font-bold text-brand-dark hover:bg-gray-50 flex items-center gap-2">
                          {isSaved ? (
                            <>
                              <svg className="w-4 h-4 text-[#2D5AF0]" fill="currentColor" viewBox="0 0 24 24"><path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"></path></svg>
                              הסר משמורים
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4 text-brand-gray" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"></path></svg>
                              שמור מודעה
                            </>
                          )}
                        </button>

                        {isAdmin && (
                          <button onClick={() => togglePin(item.id, item.is_pinned)} className="w-full text-right px-4 py-2.5 text-xs font-bold text-brand-dark hover:bg-gray-50 flex items-center gap-2 border-t border-gray-50">
                            <svg className="w-4 h-4 text-brand-blue" fill="currentColor" viewBox="0 0 20 20"><path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z"></path></svg>
                            {item.is_pinned ? 'בטל נעיצה' : 'נעץ מודעה'}
                          </button>
                        )}
                        {isOwner && (
                          <button onClick={() => handleEditClick(item)} className="w-full text-right px-4 py-2.5 text-xs font-bold text-brand-dark hover:bg-gray-50 flex items-center gap-2 border-t border-gray-50">
                            <svg className="w-4 h-4 text-brand-gray" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                            ערוך מודעה
                          </button>
                        )}
                        {(isOwner || isAdmin) && (
                          <button onClick={() => handleDelete(item.id)} className="w-full text-right px-4 py-2.5 text-xs font-bold text-red-500 hover:bg-red-50 flex items-center gap-2 border-t border-gray-50">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                            מחק מודעה
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {editingItemId === item.id ? (
                  <form onSubmit={(e) => handleInlineEditSubmit(e, item.id)} className="p-2 flex flex-col gap-3 bg-gray-50/50 rounded-2xl">
                    <div className="relative w-full aspect-video bg-gray-100 rounded-xl overflow-hidden shadow-sm mb-2 border-2 border-dashed border-gray-200 flex items-center justify-center">
                      <input type="file" accept="image/*,video/*" className="hidden" ref={editFileInputRef} onChange={handleEditFileSelect} />
                      
                      {pendingEditMedia ? (
                        <>
                          {pendingEditMedia.type === 'image' ? <img src={pendingEditMedia.preview} className="w-full h-full object-cover" /> : <video src={pendingEditMedia.preview} className="w-full h-full object-cover" />}
                          <button type="button" onClick={() => setPendingEditMedia(null)} className="absolute top-2 right-2 bg-black/60 text-white p-2 rounded-full hover:bg-red-500 transition">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                          </button>
                          <div className="absolute bottom-2 left-2 bg-brand-blue text-white text-[10px] font-bold px-2 py-1 rounded">מדיה חדשה נבחרה</div>
                        </>
                      ) : item.media_url ? (
                        <>
                          {item.media_type === 'image' ? <img src={item.media_url} className="w-full h-full object-cover opacity-60" /> : <video src={item.media_url} className="w-full h-full object-cover opacity-60" />}
                          <button type="button" onClick={() => editFileInputRef.current?.click()} className="absolute bg-white/90 text-brand-dark px-4 py-2 rounded-xl font-bold text-xs shadow-sm flex items-center gap-2 hover:scale-105 transition">
                            <svg className="w-4 h-4 text-brand-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                            החלף תמונה/סרטון
                          </button>
                        </>
                      ) : (
                        <button type="button" onClick={() => editFileInputRef.current?.click()} className="flex flex-col items-center gap-2 text-brand-blue hover:scale-105 transition">
                          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                          <span className="text-xs font-bold">הוסף מדיה למודעה</span>
                        </button>
                      )}
                    </div>
                    
                    <input type="text" required value={editItemData.title} onChange={e => setEditItemData({...editItemData, title: e.target.value})} className="w-full bg-white border border-brand-blue/30 rounded-xl px-3 py-2 text-sm outline-none focus:border-brand-blue" placeholder="כותרת" />
                    
                    <div className="flex gap-3">
                      <select value={editItemData.category} onChange={e => setEditItemData({...editItemData, category: e.target.value})} className="flex-1 bg-white border border-brand-blue/30 rounded-xl px-3 py-2 text-sm outline-none focus:border-brand-blue">
                        {categories.filter(c => c !== 'הכל' && c !== 'שמורים').map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <input type="number" value={editItemData.price} onChange={e => setEditItemData({...editItemData, price: e.target.value})} className="flex-1 bg-white border border-brand-blue/30 rounded-xl px-3 py-2 text-sm outline-none focus:border-brand-blue" placeholder="מחיר (0 = חינם)" />
                    </div>
                    
                    <input type="tel" required value={editItemData.contact_phone} onChange={e => setEditItemData({...editItemData, contact_phone: e.target.value})} className="w-full bg-white border border-brand-blue/30 rounded-xl px-3 py-2 text-sm outline-none focus:border-brand-blue text-left" dir="ltr" placeholder="050-0000000" />
                    <textarea value={editItemData.description} onChange={e => setEditItemData({...editItemData, description: e.target.value})} className="w-full bg-white border border-brand-blue/30 rounded-xl px-3 py-2 text-sm outline-none focus:border-brand-blue min-h-[60px]" placeholder="תיאור ופרטים נוספים" />
                    
                    <div className="flex justify-end gap-2 mt-1">
                      <button type="button" onClick={() => setEditingItemId(null)} className="px-4 py-2 text-xs font-bold text-gray-500 hover:bg-gray-100 rounded-xl transition">ביטול</button>
                      <button type="submit" disabled={isSubmitting} className="px-4 py-2 text-xs font-bold text-white bg-brand-blue rounded-xl shadow-sm transition active:scale-95">{isSubmitting ? 'שומר...' : 'שמור שינויים'}</button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="flex gap-4 min-h-[110px] relative">
                      
                      <div 
                        className="w-[100px] h-[110px] rounded-2xl bg-gray-50 shrink-0 border border-gray-100 overflow-hidden cursor-pointer relative"
                        onClick={() => item.media_url && setFullScreenMedia({ url: item.media_url, type: item.media_type })}
                      >
                        {item.media_url ? (
                          item.media_type === 'video' ? (
                            <>
                              <video src={item.media_url} className="w-full h-full object-cover" />
                              <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd"></path></svg>
                              </div>
                            </>
                          ) : (
                            <img src={item.media_url} alt="מודעה" className="w-full h-full object-cover" />
                          )
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-brand-blue/20">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex-1 py-1 flex flex-col pt-1 pl-7">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <h3 className="font-bold text-[#0F172A] text-[15px] leading-tight line-clamp-1">{item.title}</h3>
                        </div>
                        
                        <div className="mb-1.5">
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg border ${item.price === 0 || item.category === 'למסירה' ? 'bg-green-50 text-green-600 border-green-100' : 'bg-brand-blue/5 text-brand-blue border-brand-blue/10'}`}>
                            {item.price === 0 || item.category === 'למסירה' ? 'חינם' : `₪${item.price.toLocaleString()}`}
                          </span>
                        </div>
                        
                        <p className="text-[13px] text-[#334155] leading-snug line-clamp-2">
                          {item.description}
                        </p>
                        
                        <div className="mt-auto text-[11px] text-[#64748B] font-medium flex items-center justify-between pt-2">
                          <span>{item.profiles?.full_name} • דירה {item.profiles?.apartment || '?'}</span>
                          <span>{timeFormat(item.created_at)}</span>
                        </div>
                      </div>
                    </div>

                    {!isOwner && item.contact_phone && (
                      <div className="flex gap-2 mt-3 pt-3 border-t border-gray-50">
                        <a href={formatWhatsApp(item.contact_phone)} target="_blank" rel="noopener noreferrer" className="flex-1 bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 py-2.5 rounded-xl flex items-center justify-center gap-2 font-bold text-xs transition">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"></path></svg>
                          וואטסאפ
                        </a>
                        <a href={`tel:${item.contact_phone}`} className="flex-1 bg-brand-blue/10 text-brand-blue hover:bg-brand-blue/20 py-2.5 rounded-xl flex items-center justify-center gap-2 font-bold text-xs transition">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
                          חייג
                        </a>
                      </div>
                    )}
                  </>
                )}
              </div>
            )
          })
        )}
      </div>

      <button 
        onClick={openCreateModal} 
        className="fixed bottom-28 left-5 z-40 bg-white border border-brand-blue/20 text-brand-dark pl-4 pr-1.5 py-1.5 rounded-full shadow-[0_10px_40px_rgba(0,68,204,0.15)] hover:scale-105 active:scale-95 transition flex items-center gap-3 group"
      >
        <div className="bg-[#2D5AF0]/10 text-[#2D5AF0] p-2.5 rounded-full group-hover:bg-[#2D5AF0] group-hover:text-white transition">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"></path></svg>
        </div>
        <span className="font-bold text-sm">פרסם מודעה</span>
      </button>

      {isModalOpen && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex justify-center items-end">
          <div className="bg-white w-full max-w-md rounded-t-3xl p-6 pb-8 shadow-2xl animate-in slide-in-from-bottom-10 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6 sticky top-0 bg-white z-10 pt-2">
              <h3 className="font-black text-lg text-brand-dark">מודעה חדשה בלוח</h3>
              <button onClick={() => { setIsModalOpen(false); setPendingMedia(null); }} className="p-2 bg-gray-100 rounded-full text-brand-dark hover:bg-gray-200 transition">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>

            <form onSubmit={handleAddItem} className="space-y-4">
              
              <div>
                <input type="file" accept="image/*,video/*" className="hidden" ref={fileInputRef} onChange={handleFileSelect} />
                {!pendingMedia ? (
                  <div onClick={() => fileInputRef.current?.click()} className="w-full aspect-video bg-brand-blue/5 border-2 border-dashed border-brand-blue/30 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:bg-brand-blue/10 transition">
                    <svg className="w-8 h-8 text-brand-blue mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                    <span className="text-sm font-bold text-brand-blue">הוסף תמונה או סרטון</span>
                  </div>
                ) : (
                  <div className="w-full aspect-video relative rounded-2xl overflow-hidden shadow-sm">
                    {pendingMedia.type === 'image' ? (
                      <img src={pendingMedia.preview} className="w-full h-full object-cover" />
                    ) : (
                      <video src={pendingMedia.preview} className="w-full h-full object-cover" />
                    )}
                    <button type="button" onClick={() => setPendingMedia(null)} className="absolute top-2 right-2 bg-black/60 text-white p-2 rounded-full hover:bg-red-500 transition">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-bold text-brand-dark mb-1 block">כותרת המודעה *</label>
                <input type="text" required value={newItem.title} onChange={e => setNewItem({...newItem, title: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-blue transition" placeholder="לדוג': מוכר כיסא תינוק" />
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs font-bold text-brand-dark mb-1 block">קטגוריה</label>
                  <select value={newItem.category} onChange={e => setNewItem({...newItem, category: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-blue transition">
                    {categories.filter(c => c !== 'הכל' && c !== 'שמורים').map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-xs font-bold text-brand-dark mb-1 block">מחיר ב-₪ (0 לחינם)</label>
                  <input type="number" value={newItem.price} onChange={e => setNewItem({...newItem, price: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-blue transition" placeholder="לדוג: 150" />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-brand-dark mb-1 block">טלפון ליצירת קשר *</label>
                <input type="tel" required value={newItem.contact_phone} onChange={e => setNewItem({...newItem, contact_phone: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-blue transition text-left" dir="ltr" placeholder="050-0000000" />
              </div>

              <div>
                <label className="text-xs font-bold text-brand-dark mb-1 block">תיאור ופרטים נוספים</label>
                <textarea value={newItem.description} onChange={e => setNewItem({...newItem, description: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-blue transition min-h-[80px]" placeholder="כמעט חדש, היה בשימוש פעם אחת..."></textarea>
              </div>

              <button type="submit" disabled={isSubmitting} className="w-full bg-[#2D5AF0] text-white font-bold py-4 rounded-xl shadow-[0_8px_20px_rgba(45,90,240,0.3)] mt-2 active:scale-95 transition disabled:opacity-50">
                {isSubmitting ? 'מפרסם...' : 'פרסם בלוח'}
              </button>
            </form>
          </div>
        </div>
      )}

      {fullScreenMedia && (
        <div 
          className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in cursor-pointer" 
          onClick={() => setFullScreenMedia(null)}
        >
          <button className="absolute top-6 left-6 text-white p-2 hover:bg-white/20 rounded-full transition z-10">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
          
          {fullScreenMedia.type === 'video' ? (
            <video src={fullScreenMedia.url} controls autoPlay className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl" onClick={(e) => e.stopPropagation()} />
          ) : (
            <img src={fullScreenMedia.url} alt="Fullscreen" className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl" onClick={(e) => e.stopPropagation()} />
          )}
        </div>
      )}

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

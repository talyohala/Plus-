'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../../lib/supabase'

const categories = ['הכל', 'למכירה', 'למסירה', 'שירותים', 'דרושים']

export default function MarketplacePage() {
  const [profile, setProfile] = useState<any>(null)
  const [items, setItems] = useState<any[]>([])
  const [activeCategory, setActiveCategory] = useState('הכל')
  
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [newItem, setNewItem] = useState({ title: '', description: '', price: '', contact_phone: '', category: 'למכירה' })
  const [pendingMedia, setPendingMedia] = useState<{file: File, preview: string, type: string} | null>(null)
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchData = async (user: any) => {
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (!prof || !prof.building_id) return
    setProfile(prof)

    // סידור: קודם נעוצים, ואז לפי תאריך יצירה
    let query = supabase.from('marketplace_items')
      .select('*, profiles(full_name, avatar_url)')
      .eq('building_id', prof.building_id)
      .eq('status', 'available')
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })

    if (activeCategory !== 'הכל') query = query.eq('category', activeCategory)

    const { data } = await query
    if (data) setItems(data)
  }

  useEffect(() => {
    let currentUser: any = null
    supabase.auth.getUser().then(({ data: { user } }) => {
      currentUser = user
      if (user) fetchData(user)
    })

    const channel = supabase.channel('marketplace_realtime_v3')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'marketplace_items' }, () => currentUser && fetchData(currentUser))
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [activeCategory])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const type = file.type.startsWith('video/') ? 'video' : 'image'
    setPendingMedia({ file, preview: URL.createObjectURL(file), type })
  }

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile?.building_id) {
        alert("שגיאה: חסר שיוך לבניין.")
        return
    }
    if (!newItem.title || !newItem.contact_phone) return
    
    setIsSubmitting(true)
    
    let mediaUrl = null, mediaType = null
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

    const { error } = await supabase.from('marketplace_items').insert([{
      building_id: profile.building_id,
      user_id: profile.id,
      title: newItem.title,
      description: newItem.description,
      price: newItem.price === '' ? 0 : parseInt(newItem.price),
      contact_phone: newItem.contact_phone,
      category: newItem.category,
      media_url: mediaUrl,
      media_type: mediaType
    }])

    if (!error) {
      setIsModalOpen(false)
      setNewItem({ title: '', description: '', price: '', contact_phone: '', category: 'למכירה' })
      setPendingMedia(null)
      fetchData(profile)
    } else {
      alert("שגיאה בפרסום המודעה: " + error.message)
    }
    setIsSubmitting(false)
  }

  const handleDelete = async (id: string) => {
    if(confirm("האם למחוק את המודעה?")) {
      await supabase.from('marketplace_items').delete().eq('id', id)
      fetchData(profile)
    }
  }

  const togglePin = async (id: string, currentStatus: boolean) => {
    await supabase.from('marketplace_items').update({ is_pinned: !currentStatus }).eq('id', id)
    fetchData(profile)
  }

  const isAdmin = profile?.role === 'admin'

  return (
    <div className="flex flex-col flex-1 w-full pb-24 relative" dir="rtl">
      
      <div className="px-4 mb-4 mt-2">
        <h2 className="text-2xl font-black text-brand-dark">לוח מודעות</h2>
      </div>

      <div className="flex overflow-x-auto hide-scrollbar gap-2 px-4 mb-6 pb-2">
        {categories.map(cat => (
          <button 
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`whitespace-nowrap px-5 py-2 rounded-full text-sm font-bold transition shadow-sm border ${
              activeCategory === cat ? 'bg-brand-blue text-white border-brand-blue' : 'bg-white text-brand-dark border-gray-100 hover:bg-gray-50'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="space-y-5 px-4">
        {items.length === 0 ? (
          <div className="text-center py-10 bg-white/50 rounded-3xl border border-gray-100">
            <p className="text-brand-gray font-medium">אין מודעות כרגע בקטגוריה זו</p>
          </div>
        ) : (
          items.map(item => {
            const isOwner = profile?.id === item.user_id;
            
            return (
              <div key={item.id} className={`bg-white rounded-3xl shadow-sm border flex flex-col relative overflow-hidden transition-all ${item.is_pinned ? 'border-brand-blue/30 shadow-[0_4px_20px_rgba(0,68,204,0.1)]' : 'border-gray-50'}`}>
                
                {/* תגית נעוץ */}
                {item.is_pinned && (
                  <div className="absolute top-0 right-4 bg-brand-blue text-white text-[10px] font-black px-3 py-1 rounded-b-lg shadow-sm flex items-center gap-1 z-20">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z"></path></svg>
                    נעוץ מנהל
                  </div>
                )}

                {/* כפתורי ניהול צפים בצד שמאל */}
                <div className="absolute top-4 left-4 flex items-center gap-2 z-20">
                  {isAdmin && (
                    <button onClick={() => togglePin(item.id, item.is_pinned)} className={`p-2 rounded-full backdrop-blur-md transition shadow-sm ${item.is_pinned ? 'bg-brand-blue text-white' : 'bg-white/80 text-gray-500 hover:bg-white'}`}>
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z"></path></svg>
                    </button>
                  )}
                  {(isOwner || isAdmin) && (
                    <button onClick={() => handleDelete(item.id)} className="p-2 bg-white/80 text-red-500 backdrop-blur-md rounded-full hover:bg-red-500 hover:text-white transition shadow-sm">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                  )}
                </div>

                {/* תצוגת מדיה (תמונה/סרטון) */}
                {item.media_url && (
                  <div className="w-full aspect-video bg-gray-100 relative">
                    {item.media_type === 'image' ? (
                      <img src={item.media_url} className="w-full h-full object-cover" alt={item.title} />
                    ) : (
                      <video src={item.media_url} controls className="w-full h-full object-cover" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none"></div>
                    
                    <div className="absolute bottom-4 right-4 flex items-center gap-2">
                       <img src={item.profiles?.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${item.profiles?.full_name}&backgroundColor=0e1e2d`} className="w-8 h-8 rounded-full border border-white shadow-sm" />
                       <div className="text-white drop-shadow-md">
                         <p className="text-xs font-bold">{item.profiles?.full_name}</p>
                         <p className="text-[9px] opacity-90">{new Date(item.created_at).toLocaleDateString('he-IL')}</p>
                       </div>
                    </div>
                  </div>
                )}

                <div className={`p-5 ${item.media_url ? 'pt-4' : ''}`}>
                  {!item.media_url && (
                    <div className="flex items-center gap-3 mb-3">
                      <img src={item.profiles?.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${item.profiles?.full_name}&backgroundColor=0e1e2d`} className="w-10 h-10 rounded-full border border-gray-100" />
                      <div>
                        <p className="text-xs font-bold text-brand-dark">{item.profiles?.full_name}</p>
                        <p className="text-[10px] text-brand-gray">{new Date(item.created_at).toLocaleDateString('he-IL')}</p>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <h3 className="font-black text-brand-dark text-lg leading-tight">{item.title}</h3>
                    <span className={`text-xs font-black px-3 py-1.5 rounded-xl shrink-0 shadow-sm ${item.category === 'למסירה' || item.price === 0 ? 'bg-green-500 text-white' : 'bg-brand-blue text-white'}`}>
                      {item.category === 'למסירה' || item.price === 0 ? 'חינם' : `₪${item.price.toLocaleString()}`}
                    </span>
                  </div>
                  {item.description && <p className="text-sm text-brand-dark/80 leading-relaxed mb-4">{item.description}</p>}

                  {profile?.id !== item.user_id && (
                    <div className="flex gap-2 pt-2">
                      <a href={`https://wa.me/972${item.contact_phone.replace(/^0+/, '').replace(/-/g, '')}`} target="_blank" className="flex-1 flex justify-center items-center gap-1.5 bg-[#25D366] hover:bg-[#22bf5b] text-white py-3 rounded-xl text-xs font-bold transition shadow-sm active:scale-95">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/></svg>
                        וואטסאפ
                      </a>
                      <a href={`tel:${item.contact_phone}`} className="flex-1 flex justify-center items-center gap-1.5 bg-brand-dark hover:bg-gray-800 text-white py-3 rounded-xl text-xs font-bold transition shadow-sm active:scale-95">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
                        חייג
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      <button onClick={() => setIsModalOpen(true)} className="fixed bottom-28 left-4 z-40 bg-white/90 backdrop-blur-md border border-brand-blue/10 text-brand-blue p-1.5 pl-4 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:scale-105 active:scale-95 transition flex items-center gap-2">
        <div className="bg-brand-blue/10 p-2 rounded-full">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"></path></svg>
        </div>
        <span className="font-bold text-sm">פרסם מודעה</span>
      </button>

      {/* מודל פרסום */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex justify-center items-end">
          <div className="bg-white w-full max-w-md rounded-t-3xl p-6 pb-8 shadow-2xl animate-in slide-in-from-bottom-10 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6 sticky top-0 bg-white z-10 pt-2">
              <h3 className="font-black text-lg text-brand-dark">פרסום מודעה בבניין</h3>
              <button onClick={() => { setIsModalOpen(false); setPendingMedia(null); }} className="p-2 bg-gray-100 rounded-full text-brand-dark hover:bg-gray-200">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            
            <form onSubmit={handleAddItem} className="space-y-4">
              <div>
                <input type="file" accept="image/*,video/*" className="hidden" ref={fileInputRef} onChange={handleFileSelect} />
                {!pendingMedia ? (
                  <div onClick={() => fileInputRef.current?.click()} className="w-full aspect-video bg-blue-50 border-2 border-dashed border-brand-blue/30 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:bg-blue-100 transition">
                     <svg className="w-8 h-8 text-brand-blue mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                     <span className="text-sm font-bold text-brand-blue">הוסף תמונה או סרטון (רשות)</span>
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
                  <label className="text-xs font-bold text-brand-dark mb-1 block">מחיר (₪)</label>
                  <input type="number" value={newItem.price} onChange={e => setNewItem({...newItem, price: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-blue transition" placeholder="חינם" />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-brand-dark mb-1 block">טלפון ליצירת קשר עם השכן *</label>
                <input type="tel" required value={newItem.contact_phone} onChange={e => setNewItem({...newItem, contact_phone: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-blue transition" placeholder="050-0000000" />
              </div>

              <div>
                <label className="text-xs font-bold text-brand-dark mb-1 block">תיאור ופרטים נוספים</label>
                <textarea value={newItem.description} onChange={e => setNewItem({...newItem, description: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-blue transition min-h-[80px]" placeholder="נמכר עקב מעבר..."></textarea>
              </div>

              <button type="submit" disabled={isSubmitting} className="w-full bg-brand-blue text-white font-bold py-4 rounded-xl shadow-[0_8px_20px_rgba(0,68,204,0.3)] mt-2 active:scale-95 transition disabled:opacity-50 flex items-center justify-center gap-2">
                {isSubmitting ? <span className="animate-pulse">מעלה מודעה...</span> : 'פרסם לכל הבניין'}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}

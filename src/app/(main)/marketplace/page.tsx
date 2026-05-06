'use client'
import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { supabase } from '../../../lib/supabase'
import { playSystemSound } from '../../../components/providers/AppManager'

const mainCategories = ['הכל', 'למכירה', 'למסירה']
const secondaryCategories = ['בקשות שכנים', 'שמורים']

const smartCategoriesMap = [
  { tag: 'רהיטים', keywords: ['ארון', 'שולחן', 'מיטה', 'ספה', 'כיסא', 'שידה', 'כורסא', 'רהיט', 'מזנון', 'מדפים', 'כוורת', 'ויטרינה', 'סלון', 'פינת אוכל', 'מזרן'] },
  { tag: 'אלקטרוניקה', keywords: ['מחשב', 'טלוויזיה', 'מטען', 'אייפון', 'סמארטפון', 'רמקול', 'אוזניות', 'מסך', 'פלאפון', 'אייפד', 'טאבלט', 'מקלדת', 'עכבר', 'לפטופ', 'נייד', 'מצלמה', 'שואב', 'מקרן'] },
  { tag: 'לבית', keywords: ['מקרר', 'מכונת כביסה', 'מיקרוגל', 'תנור', 'מזגן', 'סיר', 'צלחות', 'כוסות', 'שטיח', 'תמונה', 'מדיח', 'מייבש', 'קומקום', 'טוסטר', 'בלנדר'] },
  { tag: 'ילדים', keywords: ['עגלה', 'משחק', 'לול', 'תינוק', 'ילדים', 'צעצוע', 'סלקל', 'בגדי ילדים', 'מיטת מעבר', 'טיולון', 'טרמפולינה', 'מובייל', 'פאזל', 'לגו'] },
  { tag: 'ספורט', keywords: ['אופניים', 'הליכון', 'משקולות', 'כדור', 'יוגה', 'ספורט', 'טניס', 'כושר', 'קורקינט', 'קסדה', 'גלגיליות', 'סקייטבורד'] },
  { tag: 'חיות מחמד', keywords: ['כלב', 'חתול', 'אוכל לכלבים', 'רצועה', 'כלוב', 'אקווריום', 'חיות', 'חול לחתולים', 'מיטה לכלב', 'קולר', 'צעצוע לכלב'] },
  { tag: 'כלי עבודה', keywords: ['מקדחה', 'סולם', 'מברגה', 'פטיש', 'ברגים', 'ארגז כלים', 'כבלים', 'כבל מרים', 'פלאייר', 'מפתח שוודי', 'דיסק', 'מסור'] },
  { tag: 'אופנה', keywords: ['בגדים', 'שמלה', 'חולצה', 'מכנסיים', 'נעליים', 'תיק', 'מעיל', 'גקט', 'חצאית', 'סוודר', 'כובע', 'תכשיט', 'שעון'] },
  { tag: 'לימודים', keywords: ['ספר', 'מחברת', 'קורס', 'פסיכומטרי', 'לימודים', 'סטודנט', 'ילקוט', 'קלמר', 'רומן', 'ספר קריאה'] }
]

export default function MarketplacePage() {
  const [profile, setProfile] = useState<any>(null)
  const [items, setItems] = useState<any[]>([])
  const [savedItemsIds, setSavedItemsIds] = useState<Set<string>>(new Set())
  const [activeCategory, setActiveCategory] = useState('הכל')
  const [searchQuery, setSearchQuery] = useState('')
  const [currentUser, setCurrentUser] = useState<any>(null)
  
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Custom Alerts
  const [customAlert, setCustomAlert] = useState<{ title: string, message: string, type: 'success' | 'error' | 'info' } | null>(null)
  const [customConfirm, setCustomConfirm] = useState<{ title: string, message: string, onConfirm: () => void } | null>(null)

  const [newItem, setNewItem] = useState({ title: '', description: '', price: '', contact_phone: '', category: 'למכירה' })
  const [newRequest, setNewRequest] = useState({ title: '', description: '' })
  
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

    const { data: saves } = await supabase.from('marketplace_saves').select('item_id').eq('user_id', prof.id)
    if (saves) {
      setSavedItemsIds(new Set(saves.map(s => s.item_id)))
    }

    const { data } = await supabase.from('marketplace_items')
      .select('*, profiles(full_name, avatar_url, apartment, floor, role)')
      .eq('building_id', prof.building_id)
      .eq('status', 'available')
      .order('is_pinned', { ascending: false })
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

    const channel = supabase.channel('marketplace_realtime_smart_v6')
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
    setNewItem({ title: '', description: '', price: '', contact_phone: profile?.phone || '', category: 'למכירה' })
    setPendingMedia(null)
    setIsModalOpen(true)
  }

  const handleAddRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile?.building_id) return
    if (!newRequest.title) return

    setIsSubmitting(true)
    const payload = {
      building_id: profile.building_id,
      user_id: profile.id,
      title: newRequest.title,
      description: newRequest.description,
      price: 0,
      contact_phone: profile.phone || '',
      category: 'בקשות שכנים',
    }

    const { error } = await supabase.from('marketplace_items').insert([payload])

    if (error) {
      setCustomAlert({ title: 'שגיאה', message: error.message, type: 'error' })
    } else {
      const { data: neighbors } = await supabase.from('profiles').select('id').eq('building_id', profile.building_id).neq('id', profile.id)
      if (neighbors && neighbors.length > 0) {
        const notifs = neighbors.map(n => ({
          receiver_id: n.id,
          sender_id: profile.id,
          type: 'marketplace',
          title: 'בקשת שכן חדשה',
          content: `${profile.full_name} מבקש/ת: ${newRequest.title}`,
          link: '/marketplace'
        }))
        await supabase.from('notifications').insert(notifs)
      }
      playSystemSound('notification')
      setCustomAlert({ title: 'הבקשה נשלחה!', message: 'כל דיירי הבניין קיבלו עכשיו התראה. מישהו בטח יעזור בקרוב.', type: 'success' })
      setIsRequestModalOpen(false)
      setNewRequest({ title: '', description: '' })
      if (currentUser) fetchData(currentUser)
    }
    setIsSubmitting(false)
  }

  const handleQuickReply = (item: any, replyType: string) => {
    if (!item.contact_phone) {
      setCustomAlert({ title: 'אופס!', message: 'לשכן זה לא מעודכן מספר טלפון באפליקציה.', type: 'error' });
      return;
    }
    playSystemSound('click');
    const aptText = profile?.apartment ? `מדירה ${profile.apartment}` : '';
    const text = encodeURIComponent(`היי ${item.profiles?.full_name?.split(' ')[0]}, לגבי הבקשה שלך בשכן+ ("${item.title}") -\n*${replyType}* ✨\n\n(מוזמן/ת אליי ${aptText})`);
    let clean = item.contact_phone.replace(/\D/g, '')
    if (clean.startsWith('0')) clean = '972' + clean.slice(1)
    window.open(`https://wa.me/${clean}?text=${text}`, '_blank');
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
      price: editItemData.category === 'בקשות שכנים' || editItemData.category === 'למסירה' || editItemData.price === '' ? 0 : parseInt(editItemData.price),
      contact_phone: editItemData.contact_phone,
      category: editItemData.category
    }

    if (pendingEditMedia) {
      payload.media_url = mediaUrl
      payload.media_type = mediaType
    }

    await supabase.from('marketplace_items').update(payload).eq('id', id)
    playSystemSound('notification')
    setEditingItemId(null)
    setPendingEditMedia(null)
    if (currentUser) fetchData(currentUser)
    setIsSubmitting(false)
  }

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!profile?.building_id) {
      setCustomAlert({ title: 'שגיאה', message: 'המערכת לא מזהה שאתה משויך לבניין.', type: 'error' })
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
      price: newItem.category === 'בקשות שכנים' || newItem.category === 'למסירה' || newItem.price === '' ? 0 : parseInt(newItem.price),
      contact_phone: newItem.contact_phone,
      category: newItem.category,
    }

    if (pendingMedia) {
      payload.media_url = mediaUrl
      payload.media_type = mediaType
    }

    const { error } = await supabase.from('marketplace_items').insert([payload])

    if (error) {
      setCustomAlert({ title: 'שגיאה בפרסום', message: error.message, type: 'error' })
    } else {
      playSystemSound('notification')
      setIsModalOpen(false)
      setNewItem({ title: '', description: '', price: '', contact_phone: '', category: 'למכירה' })
      setPendingMedia(null)
      if (currentUser) fetchData(currentUser)
    }
    setIsSubmitting(false)
  }

  const handleDelete = async (id: string) => {
    setCustomConfirm({
      title: 'מחיקת מודעה',
      message: 'האם למחוק מודעה זו לתמיד?',
      onConfirm: async () => {
        await supabase.from('marketplace_items').delete().eq('id', id)
        setOpenMenuId(null)
        if (currentUser) fetchData(currentUser)
        playSystemSound('click')
        setCustomConfirm(null)
      }
    })
  }

  const togglePin = async (id: string, currentStatus: boolean) => {
    await supabase.from('marketplace_items').update({ is_pinned: !currentStatus }).eq('id', id)
    setOpenMenuId(null)
    playSystemSound('click')
    if (currentUser) fetchData(currentUser)
  }

  const toggleSave = async (e: React.MouseEvent, id: string, isCurrentlySaved: boolean) => {
    e.stopPropagation()
    setOpenMenuId(null)
    if (!profile) return
    playSystemSound('click')

    if (isCurrentlySaved) {
      await supabase.from('marketplace_saves').delete().match({ item_id: id, user_id: profile.id })
      setSavedItemsIds(prev => { const next = new Set(prev); next.delete(id); return next; })
    } else {
      await supabase.from('marketplace_saves').insert([{ item_id: id, user_id: profile.id }])
      setSavedItemsIds(prev => { const next = new Set(prev); next.add(id); return next; })
    }
  }

  const dynamicTags = useMemo(() => {
    const tags = new Set<string>();
    items.forEach(item => {
      const text = (item.title + ' ' + (item.description || '')).toLowerCase();
      smartCategoriesMap.forEach(cat => {
        if (cat.keywords.some(kw => text.includes(kw))) {
          tags.add(cat.tag);
        }
      });
    });
    const tagArray = Array.from(tags);
    if (tagArray.length === 0) return ['למסירה', 'בקשות שכנים'];
    return tagArray.slice(0, 10);
  }, [items]);

  const filteredItems = useMemo(() => {
    const matchedSmartTag = smartCategoriesMap.find(c => c.tag === searchQuery);
    
    return items.filter(item => {
      const isSaved = savedItemsIds.has(item.id);
      if (activeCategory === 'שמורים' && !isSaved) return false;

      const matchesFilter = activeCategory === 'הכל' || activeCategory === 'שמורים' || item.category === activeCategory;
      
      let matchesSearch = false;
      if (!searchQuery) {
        matchesSearch = true;
      } else if (matchedSmartTag) {
        const text = (item.title + ' ' + (item.description || '')).toLowerCase();
        matchesSearch = matchedSmartTag.keywords.some(kw => text.includes(kw)) || item.category === matchedSmartTag.tag;
      } else {
        const searchLower = searchQuery.toLowerCase();
        matchesSearch = 
          item.title.toLowerCase().includes(searchLower) || 
          (item.description && item.description.toLowerCase().includes(searchLower))
      }

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
    <div className="flex flex-col flex-1 w-full pb-28 relative bg-transparent" dir="rtl">
      
      <div className="px-4 mt-6 mb-5 flex items-center justify-between">
        <h2 className="text-2xl font-black text-slate-800 drop-shadow-sm">לוח מודעות</h2>
      </div>

      <div className="px-4 mb-5">
        <div className="relative">
          <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
          </div>
          <input
            type="text"
            placeholder="חיפוש מודעה, חפץ או שכנים..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/90 backdrop-blur-sm border border-white rounded-[1.2rem] py-3.5 pr-11 pl-4 text-sm shadow-sm outline-none text-slate-800 focus:border-[#1D4ED8]/30 transition placeholder:text-slate-400"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400 hover:text-slate-600 transition">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
          )}
        </div>
      </div>

      {/* תגיות מהירות */}
      {dynamicTags.length > 0 && (
        <div className="px-4 mb-6">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2.5">מוצרים פופולריים בבניין:</p>
          <div className="flex flex-wrap gap-2">
            {dynamicTags.map(tag => (
              <button
                key={tag}
                onClick={() => setSearchQuery(tag)}
                className="bg-white/60 backdrop-blur-sm text-slate-700 px-3 py-1.5 rounded-full text-[11px] font-bold hover:bg-white transition border border-white shadow-sm"
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* --- טאבים ראשיים - עיצוב קפסולה --- */}
      <div className="px-4 mb-3">
        <div className="flex bg-white/60 backdrop-blur-md p-1.5 rounded-full border border-white shadow-sm relative z-10 overflow-x-auto hide-scrollbar">
          {mainCategories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`flex-1 min-w-[80px] py-2.5 px-4 rounded-full text-xs transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${activeCategory === cat ? 'text-[#1D4ED8] font-black bg-white shadow-sm' : 'text-slate-500 font-bold hover:text-slate-700 hover:bg-white/50'}`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* --- טאבים משניים - עיצוב קפסולה --- */}
      <div className="px-4 mb-6">
        <div className="flex bg-white/60 backdrop-blur-md p-1.5 rounded-full border border-white shadow-sm relative z-10 w-max overflow-x-auto hide-scrollbar max-w-full">
          {secondaryCategories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`py-2 px-5 rounded-full text-[11px] transition-all flex items-center gap-1.5 whitespace-nowrap ${activeCategory === cat ? 'text-slate-800 font-black bg-white shadow-sm' : 'text-slate-500 font-bold hover:text-slate-700 hover:bg-white/50'}`}
            >
              {cat === 'שמורים' && <svg className={`w-3.5 h-3.5 ${activeCategory === cat ? 'text-rose-500' : 'text-slate-400'}`} fill="currentColor" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path></svg>}
              {cat === 'בקשות שכנים' && <svg className={`w-3.5 h-3.5 ${activeCategory === cat ? 'text-emerald-500' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11"></path></svg>}
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4 px-4 animate-in fade-in duration-300 relative">
        
        {activeCategory === 'בקשות שכנים' && (
          <div className="bg-gradient-to-r from-emerald-500 to-emerald-400 p-5 rounded-3xl shadow-sm text-white flex flex-col items-start relative overflow-hidden mb-2">
            <div className="relative z-10">
              <h3 className="font-black text-lg mb-1 flex items-center gap-2">
                <span className="text-2xl">👋</span> עזרה קטנה מהשכנים?
              </h3>
              <p className="text-[13px] font-medium text-emerald-50 max-w-[90%] leading-snug">
                כבלים, סוכר, מקדחה או סתם שאלה. הבקשה תשלח מיד, ושכנים יוכלו ללחוץ כאן ולהשיב לך מתוך האפליקציה!
              </p>
            </div>
            <svg className="absolute left-0 bottom-0 opacity-10 w-32 h-32 transform translate-y-8 -translate-x-4 pointer-events-none" fill="currentColor" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path></svg>
          </div>
        )}

        {filteredItems.length === 0 ? (
          <div className="text-center py-12 bg-white/50 backdrop-blur-sm rounded-3xl border border-white/50 shadow-sm">
            <div className="w-16 h-16 bg-white/80 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            </div>
            <p className="text-slate-500 font-bold">לא מצאנו תוצאות 🧐</p>
          </div>
        ) : (
          filteredItems.map(item => {
            const isOwner = profile?.id === item.user_id;
            const isSaved = savedItemsIds.has(item.id);
            const isRequest = item.category === 'בקשות שכנים';
            
            return (
              <div key={item.id} className={`bg-white/80 backdrop-blur-md p-4 rounded-3xl shadow-sm border transition-all ${isRequest ? 'bg-emerald-50/50 border-emerald-100' : 'border-white'} ${item.is_pinned ? 'border-[#1D4ED8]/30 shadow-[0_4px_20px_rgba(29,78,216,0.1)]' : 'hover:shadow-md'} relative ${openMenuId === item.id ? 'z-[100]' : 'z-10'}`}>
                
                {item.is_pinned && (
                  <div className="absolute top-0 right-4 bg-[#1D4ED8] text-white text-[9px] font-black px-3 py-0.5 rounded-b-lg shadow-sm flex items-center gap-1 z-10">
                    <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z"></path></svg>
                    נעוץ מנהל
                  </div>
                )}

                <div className="absolute top-3 left-3 z-40">
                  <div className="relative">
                    <button onClick={() => setOpenMenuId(openMenuId === item.id ? null : item.id)} className="p-1 transition hover:scale-110 text-slate-400 hover:text-slate-700">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"></path></svg>
                    </button>
                    
                    {openMenuId === item.id && (
                      <div className="absolute left-0 top-8 w-44 bg-white/95 backdrop-blur-xl border border-white shadow-[0_10px_40px_rgba(0,0,0,0.15)] rounded-2xl z-[150] overflow-hidden py-1">
                        <button onClick={(e) => toggleSave(e, item.id, isSaved)} className="w-full text-right px-4 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                          {isSaved ? (
                            <><svg className="w-4 h-4 text-rose-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path></svg> הסר משמירות</>
                          ) : (
                            <><svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg> שמור למועדפים</>
                          )}
                        </button>
                        
                        {isAdmin && (
                          <button onClick={() => togglePin(item.id, item.is_pinned)} className="w-full text-right px-4 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2 border-t border-slate-100">
                            <svg className="w-4 h-4 text-[#1D4ED8]" fill="currentColor" viewBox="0 0 20 20"><path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z"></path></svg>
                            {item.is_pinned ? 'בטל נעיצה' : 'נעץ פריט'}
                          </button>
                        )}
                        
                        {isOwner && (
                          <button onClick={() => handleEditClick(item)} className="w-full text-right px-4 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2 border-t border-slate-100">
                            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                            ערוך מודעה
                          </button>
                        )}
                        
                        {(isOwner || isAdmin) && (
                          <button onClick={() => handleDelete(item.id)} className="w-full text-right px-4 py-3 text-xs font-bold text-red-500 hover:bg-red-50 flex items-center gap-2 border-t border-slate-100">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                            מחק לצמיתות
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {editingItemId === item.id ? (
                  <form onSubmit={(e) => handleInlineEditSubmit(e, item.id)} className="p-2 flex flex-col gap-3 bg-slate-50 rounded-2xl mt-4 border border-slate-100">
                    <input type="text" required value={editItemData.title} onChange={e => setEditItemData({...editItemData, title: e.target.value})} className="w-full bg-white border border-white rounded-xl px-3 py-3 text-sm outline-none focus:border-[#1D4ED8]/30 shadow-sm" placeholder="כותרת" />
                    <div className="flex gap-3">
                      <select value={editItemData.category} onChange={e => setEditItemData({...editItemData, category: e.target.value})} className="flex-1 bg-white border border-white rounded-xl px-3 py-3 text-sm outline-none shadow-sm">
                        {mainCategories.filter(c => c !== 'הכל').map(c => <option key={c} value={c}>{c}</option>)}
                        <option value="בקשות שכנים">בקשות שכנים</option>
                      </select>
                      {editItemData.category !== 'בקשות שכנים' && editItemData.category !== 'למסירה' && (
                        <input type="number" value={editItemData.price} onChange={e => setEditItemData({...editItemData, price: e.target.value})} className="flex-1 bg-white border border-white rounded-xl px-3 py-3 text-sm outline-none shadow-sm" placeholder="מחיר" />
                      )}
                    </div>
                    <input type="tel" required value={editItemData.contact_phone} onChange={e => setEditItemData({...editItemData, contact_phone: e.target.value})} className="w-full bg-white border border-white rounded-xl px-3 py-3 text-sm outline-none text-left shadow-sm" dir="ltr" placeholder="050-0000000" />
                    <textarea value={editItemData.description} onChange={e => setEditItemData({...editItemData, description: e.target.value})} className="w-full bg-white border border-white rounded-xl px-3 py-3 text-sm outline-none min-h-[60px] shadow-sm" placeholder="תיאור" />
                    
                    <div className="flex justify-end gap-2 mt-2">
                      <button type="button" onClick={() => setEditingItemId(null)} className="px-4 py-2.5 text-xs font-bold text-slate-500 bg-white border border-slate-100 rounded-xl hover:bg-slate-50 transition shadow-sm">ביטול</button>
                      <button type="submit" disabled={isSubmitting} className="px-5 py-2.5 text-xs font-bold text-white bg-[#1D4ED8] rounded-xl shadow-sm transition active:scale-95">{isSubmitting ? 'שומר...' : 'שמור מודעה'}</button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="flex gap-4 min-h-[100px] relative mt-1.5">
                      
                      {!isRequest && (
                        <div 
                          className="w-[100px] h-[110px] rounded-[1.2rem] bg-slate-50 shrink-0 border border-slate-100 overflow-hidden cursor-pointer relative shadow-sm"
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
                            <div className="w-full h-full flex items-center justify-center text-[#1D4ED8]/20 bg-[#1D4ED8]/5">
                              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                            </div>
                          )}
                        </div>
                      )}

                      <div className={`flex-1 py-1 flex flex-col pt-1 ${!isRequest ? 'pl-5' : 'pl-2'}`}>
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <h3 className={`font-black text-base leading-tight line-clamp-1 pr-1 ${isRequest ? 'text-emerald-800' : 'text-slate-800'}`}>{item.title}</h3>
                        </div>

                        {!isRequest && (
                          <div className="mb-2">
                            <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg border shadow-sm ${item.price === 0 || item.category === 'למסירה' ? 'bg-rose-50 text-rose-500 border-rose-100' : 'bg-[#1D4ED8]/5 text-[#1D4ED8] border-[#1D4ED8]/10'}`}>
                              {item.price === 0 || item.category === 'למסירה' ? 'ללא עלות' : `₪${item.price.toLocaleString()}`}
                            </span>
                          </div>
                        )}

                        <p className={`text-[13px] font-medium leading-snug line-clamp-2 ${isRequest ? 'text-emerald-700' : 'text-slate-600'}`}>
                          {item.description}
                        </p>

                        <div className="mt-auto text-[11px] text-slate-400 font-bold flex items-center justify-between pt-3">
                          <span className="flex items-center gap-1.5">
                            <img src={item.profiles?.avatar_url || `https://api.dicebear.com/8.x/initials/svg?seed=${item.profiles?.full_name}&backgroundColor=EFF6FF&textColor=1D4ED8`} className="w-5 h-5 rounded-full border border-gray-100 shadow-sm" />
                            {item.profiles?.full_name}
                          </span>
                          <span>{timeFormat(item.created_at)}</span>
                        </div>
                      </div>
                    </div>

                    {/* --- כפתורי תגובות מהירות לבקשות שכנים --- */}
                    {!isOwner && isRequest && (
                      <div className="flex gap-2 mt-4 pt-3 border-t border-emerald-100/50">
                        <button onClick={() => handleQuickReply(item, "יש לי את זה! 🙋‍♂️")} className="flex-1 bg-emerald-50 border border-emerald-100 text-emerald-600 py-2.5 rounded-xl font-bold text-[11px] active:scale-95 transition hover:bg-emerald-100">
                          יש לי!
                        </button>
                        <button onClick={() => handleQuickReply(item, "בוא/י לקחת באהבה 🎁")} className="flex-1 bg-emerald-50 border border-emerald-100 text-emerald-600 py-2.5 rounded-xl font-bold text-[11px] active:scale-95 transition hover:bg-emerald-100">
                          בוא/י לקחת
                        </button>
                        <button onClick={() => handleQuickReply(item, "אשמח לעזור עם זה ✨")} className="flex-1 bg-emerald-50 border border-emerald-100 text-emerald-600 py-2.5 rounded-xl font-bold text-[11px] active:scale-95 transition hover:bg-emerald-100">
                          אשמח לעזור
                        </button>
                      </div>
                    )}

                    {/* --- כפתורי התקשרות למודעות רגילות --- */}
                    {!isOwner && !isRequest && item.contact_phone && (
                      <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100">
                        <a href={formatWhatsApp(item.contact_phone)} target="_blank" rel="noopener noreferrer" className="flex-1 bg-[#25D366] text-white py-3 rounded-xl flex items-center justify-center gap-2 font-bold text-xs active:scale-95 transition shadow-sm">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                          וואטסאפ
                        </a>
                        <a href={`tel:${item.contact_phone}`} className="flex-1 bg-[#1D4ED8] text-white py-3 rounded-xl flex items-center justify-center gap-2 font-bold text-xs active:scale-95 transition shadow-sm">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
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

      {activeCategory === 'בקשות שכנים' ? (
        <button
          onClick={() => setIsRequestModalOpen(true)}
          className="fixed bottom-24 left-6 z-50 bg-white/90 backdrop-blur-md border border-white text-slate-800 pl-4 pr-1.5 py-1.5 rounded-full shadow-[0_8px_30px_rgba(16,185,129,0.25)] hover:scale-105 active:scale-95 transition flex items-center gap-3 group flex-row-reverse"
        >
          <div className="bg-emerald-500 text-white p-3 rounded-full shadow-sm">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11"></path></svg>
          </div>
          <span className="font-black text-sm">בקשת שכן</span>
        </button>
      ) : (
        <button
          onClick={openCreateModal}
          className="fixed bottom-24 left-6 z-50 bg-white/90 backdrop-blur-md border border-white text-slate-800 pl-4 pr-1.5 py-1.5 rounded-full shadow-[0_10px_40px_rgba(29,78,216,0.2)] hover:scale-105 active:scale-95 transition flex items-center gap-3 group"
        >
          <div className="bg-[#1D4ED8] text-white p-3 rounded-full shadow-sm">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"></path></svg>
          </div>
          <span className="font-black text-sm">פרסם מודעה</span>
        </button>
      )}

      {/* מודל בקשת שכן */}
      {isRequestModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex justify-center items-end">
          <div className="bg-white/95 backdrop-blur-xl w-full max-w-md rounded-t-[2rem] p-6 pb-8 shadow-2xl animate-in slide-in-from-bottom-10 border-t border-white/50">
            <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6"></div>
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-black text-xl text-slate-800 flex items-center gap-2">
                <span className="text-2xl">🙏</span> מה חסר לך?
              </h3>
              <button onClick={() => setIsRequestModalOpen(false)} className="p-2 bg-gray-50 rounded-full text-slate-500 hover:text-slate-800 transition">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>

            <form onSubmit={handleAddRequest} className="space-y-4">
              <div>
                <input type="text" required value={newRequest.title} onChange={e => setNewRequest({...newRequest, title: e.target.value})} className="w-full bg-white border border-emerald-100 rounded-xl px-4 py-4 outline-none focus:border-emerald-500 transition text-slate-800 font-bold shadow-sm" placeholder="לדוג׳: למישהו יש קצת חלב? / כבלים מרים?" />
              </div>
              <div>
                <input type="text" value={newRequest.description} onChange={e => setNewRequest({...newRequest, description: e.target.value})} className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 outline-none focus:border-emerald-500 transition text-slate-800 text-sm shadow-sm" placeholder="אפשר לפרט כאן (מספר דירה וכד')..." />
              </div>

              <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl flex items-start gap-3 shadow-sm mt-2">
                <svg className="w-6 h-6 text-emerald-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
                <span className="text-xs text-emerald-700 font-bold leading-relaxed">ברגע שתלחץ, התראה קופצת (פוש) תשלח לכל השכנים בבניין כדי שיעזרו כמה שיותר מהר.</span>
              </div>

              <button type="submit" disabled={isSubmitting} className="w-full bg-emerald-500 text-white font-bold py-4 rounded-xl shadow-md mt-4 active:scale-95 transition disabled:opacity-50 text-base">
                {isSubmitting ? 'שולח בקשה...' : 'שלח לכל השכנים!'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* מודל פרסום מודעה רגילה */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex justify-center items-end">
          <div className="bg-white/95 backdrop-blur-xl w-full max-w-md rounded-t-[2rem] p-6 pb-8 shadow-2xl animate-in slide-in-from-bottom-10 max-h-[90vh] overflow-y-auto border-t border-white/50">
            <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6"></div>
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-black text-xl text-slate-800">הוספת מודעה</h3>
              <button onClick={() => { setIsModalOpen(false); setPendingMedia(null); }} className="p-2 bg-gray-50 rounded-full text-slate-500 hover:text-slate-800 transition shadow-sm border border-gray-100">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>

            <form onSubmit={handleAddItem} className="space-y-4">
              <div>
                <input type="file" accept="image/*,video/*" className="hidden" ref={fileInputRef} onChange={handleFileSelect} />
                {!pendingMedia ? (
                  <div onClick={() => fileInputRef.current?.click()} className="w-full aspect-video bg-[#1D4ED8]/5 border-2 border-dashed border-[#1D4ED8]/30 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:bg-[#1D4ED8]/10 transition shadow-sm">
                    <svg className="w-8 h-8 text-[#1D4ED8] mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                    <span className="text-sm font-bold text-[#1D4ED8]">הוסף תמונה או סרטון</span>
                  </div>
                ) : (
                  <div className="w-full aspect-video relative rounded-2xl overflow-hidden shadow-sm">
                    {pendingMedia.type === 'image' ? (
                      <img src={pendingMedia.preview} className="w-full h-full object-cover" />
                    ) : (
                      <video src={pendingMedia.preview} className="w-full h-full object-cover" />
                    )}
                    <button type="button" onClick={() => setPendingMedia(null)} className="absolute top-2 right-2 bg-black/50 backdrop-blur-md text-white p-2 rounded-full hover:bg-red-500 transition">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                  </div>
                )}
              </div>

              <div>
                <input type="text" required value={newItem.title} onChange={e => setNewItem({...newItem, title: e.target.value})} className="w-full bg-white border border-gray-100 rounded-xl px-4 py-4 text-sm font-bold outline-none focus:border-[#1D4ED8]/50 transition shadow-sm text-slate-800" placeholder="כותרת (לדוג': מוכר כיסא תינוק)" />
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <select value={newItem.category} onChange={e => setNewItem({...newItem, category: e.target.value})} className="w-full bg-white border border-gray-100 rounded-xl px-4 py-4 text-sm font-bold outline-none focus:border-[#1D4ED8]/50 transition shadow-sm text-slate-800">
                    {mainCategories.filter(c => c !== 'הכל').map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                {newItem.category !== 'למסירה' && (
                  <div className="flex-1">
                    <input type="number" value={newItem.price} onChange={e => setNewItem({...newItem, price: e.target.value})} className="w-full bg-white border border-gray-100 rounded-xl px-4 py-4 text-sm font-bold outline-none focus:border-[#1D4ED8]/50 transition shadow-sm text-slate-800" placeholder="מחיר ב-₪" />
                  </div>
                )}
              </div>

              <div>
                <input type="tel" required value={newItem.contact_phone} onChange={e => setNewItem({...newItem, contact_phone: e.target.value})} className="w-full bg-white border border-gray-100 rounded-xl px-4 py-4 text-sm font-bold outline-none focus:border-[#1D4ED8]/50 transition text-left shadow-sm text-slate-800" dir="ltr" placeholder="050-0000000" />
              </div>

              <div>
                <textarea value={newItem.description} onChange={e => setNewItem({...newItem, description: e.target.value})} className="w-full bg-white border border-gray-100 rounded-xl px-4 py-4 text-sm font-medium outline-none focus:border-[#1D4ED8]/50 transition min-h-[100px] shadow-sm text-slate-800" placeholder="תיאור ופרטים נוספים..."></textarea>
              </div>

              <button type="submit" disabled={isSubmitting} className="w-full bg-[#1D4ED8] text-white font-bold py-4 rounded-xl shadow-md mt-4 active:scale-95 transition disabled:opacity-50 text-base">
                {isSubmitting ? 'מפרסם...' : 'פרסם מודעה'}
              </button>
            </form>
          </div>
        </div>
      )}

      {fullScreenMedia && (
        <div className="fixed inset-0 z-[150] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in cursor-pointer" onClick={() => setFullScreenMedia(null)}>
          <button className="absolute top-6 left-6 text-white p-2 hover:bg-white/20 rounded-full transition z-10">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
          
          {fullScreenMedia.type === 'video' ? (
            <video src={fullScreenMedia.url} controls autoPlay className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl" onClick={(e) => e.stopPropagation()} />
          ) : (
            <img src={fullScreenMedia.url} alt="Fullscreen" className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl" onClick={(e) => e.stopPropagation()} />
          )}
        </div>
      )}

      {/* --- התראות מערכת וחלוניות אישור מעוצבות --- */}
      {customAlert && (
        <div className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-white/95 backdrop-blur-xl rounded-[2rem] p-6 w-full max-w-sm shadow-2xl text-center animate-in zoom-in-95 border border-white/50">
            <div className={`w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center shadow-sm ${customAlert.type === 'success' ? 'bg-[#059669]/10 text-[#059669]' : customAlert.type === 'error' ? 'bg-red-50 text-red-500' : 'bg-[#1D4ED8]/10 text-[#1D4ED8]'}`}>
              {customAlert.type === 'success' && <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"></path></svg>}
              {customAlert.type === 'error' && <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>}
              {customAlert.type === 'info' && <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>}
            </div>
            <h3 className="text-xl font-black text-slate-800 mb-2">{customAlert.title}</h3>
            <p className="text-sm text-slate-500 mb-6 leading-relaxed">{customAlert.message}</p>
            <button onClick={() => setCustomAlert(null)} className="w-full bg-slate-800 text-white font-bold py-3.5 rounded-xl active:scale-95 transition shadow-sm">סגירה</button>
          </div>
        </div>
      )}

      {customConfirm && (
        <div className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-white/95 backdrop-blur-xl rounded-[2rem] p-6 w-full max-w-sm shadow-2xl text-center animate-in zoom-in-95 border border-white/50">
            <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center bg-orange-50 text-orange-500 shadow-sm">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
            </div>
            <h3 className="text-xl font-black text-slate-800 mb-2">{customConfirm.title}</h3>
            <p className="text-sm text-slate-500 mb-6 leading-relaxed">{customConfirm.message}</p>
            <div className="flex gap-3">
              <button onClick={() => setCustomConfirm(null)} className="flex-1 bg-white text-slate-600 font-bold py-3.5 rounded-xl hover:bg-gray-50 transition active:scale-95 border border-gray-200 shadow-sm">ביטול</button>
              <button onClick={customConfirm.onConfirm} className="flex-1 bg-[#1D4ED8] text-white font-bold py-3.5 rounded-xl transition shadow-sm active:scale-95">אישור</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

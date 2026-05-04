'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../../../lib/supabase'
import { playSystemSound } from '../../../components/providers/AppManager'

export default function ServicesPage() {
  const [profile, setProfile] = useState<any>(null)
  const [tickets, setTickets] = useState<any[]>([])
  const [vendors, setVendors] = useState<any[]>([])
  const [activeFilter, setActiveFilter] = useState('פתוח')
  
  const [isReporting, setIsReporting] = useState(false)
  const [showVendors, setShowVendors] = useState(false)
  const [vendorTab, setVendorTab] = useState('קבועים') 
  const [description, setDescription] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null)
  
  const [isAddingVendor, setIsAddingVendor] = useState(false)
  const [newVendor, setNewVendor] = useState({ name: '', profession: '', phone: '' })
  const [newRating, setNewRating] = useState(5)
  const [isFixedVendor, setIsFixedVendor] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (!prof || !prof.building_id) return
    setProfile(prof)

    let query = supabase.from('service_tickets').select('*, profiles(full_name, apartment, avatar_url)').eq('building_id', prof.building_id).order('created_at', { ascending: false })
    if (activeFilter !== 'הכל') query = query.eq('status', activeFilter)
    const { data: tks } = await query
    if (tks) setTickets(tks)

    const { data: vnds } = await supabase.from('building_vendors').select('*, profiles!building_vendors_recommender_id_fkey(full_name)').eq('building_id', prof.building_id).order('created_at', { ascending: false })
    if (vnds) setVendors(vnds)
  }, [activeFilter])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleAddVendor = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile?.building_id || !newVendor.name || !newVendor.phone) return
    
    const finalIsFixed = isAdmin ? isFixedVendor : false

    await supabase.from('building_vendors').insert([{
      building_id: profile.building_id,
      recommender_id: profile.id,
      is_fixed: finalIsFixed,
      rating: finalIsFixed ? 5 : newRating,
      ...newVendor
    }])
    
    setNewVendor({ name: '', profession: '', phone: '' })
    setNewRating(5)
    setIsAddingVendor(false)
    playSystemSound('notification')
    fetchData()
  }

  const handleDeleteVendor = async (id: string) => {
    if (confirm("להסיר את איש המקצוע?")) {
      await supabase.from('building_vendors').delete().eq('id', id)
      fetchData()
    }
  }

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile?.building_id || (!description.trim() && !imageFile)) return
    setIsSubmitting(true)
    let imageUrl = null

    if (imageFile) {
      const fileExt = imageFile.name.split('.').pop()
      const fileName = `${Date.now()}.${fileExt}`
      const { data, error } = await supabase.storage.from('tickets').upload(fileName, imageFile)
      if (!error && data) imageUrl = supabase.storage.from('tickets').getPublicUrl(fileName).data.publicUrl
    }

    // יצירת כותרת זמנית מהתיאור כדי למנוע היתקעות עד לחיבור ה-AI
    const fallbackTitle = description.trim().split(' ').slice(0, 4).join(' ') + (description.split(' ').length > 4 ? '...' : '')

    await supabase.from('service_tickets').insert([{
      building_id: profile.building_id,
      user_id: profile.id,
      title: fallbackTitle || 'דיווח עם תמונה',
      description: description,
      image_url: imageUrl,
      source: 'app'
    }])

    playSystemSound('notification')
    setIsReporting(false)
    setDescription('')
    setImageFile(null)
    setImagePreview(null)
    fetchData()
    setIsSubmitting(false)
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      setImageFile(file)
      setImagePreview(URL.createObjectURL(file))
    }
  }

  const updateTicketStatus = async (id: string, newStatus: string) => {
    await supabase.from('service_tickets').update({ status: newStatus }).eq('id', id)
    playSystemSound('click')
    fetchData()
  }

  const formatWhatsAppLink = (phone: string) => {
    const cleanPhone = phone.replace(/\D/g, '')
    if (cleanPhone.startsWith('0')) return `https://wa.me/972${cleanPhone.substring(1)}`
    return `https://wa.me/${cleanPhone}`
  }

  const timeFormat = (dateString: string) => {
    const date = new Date(dateString)
    const today = new Date()
    return date.toDateString() === today.toDateString() 
      ? date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) 
      : date.toLocaleDateString('he-IL')
  }

  const isAdmin = profile?.role === 'admin'
  const fixedVendors = vendors.filter(v => v.is_fixed)
  const recommendedVendors = vendors.filter(v => !v.is_fixed)

  return (
    <div className="flex flex-col flex-1 w-full pb-24" dir="rtl">
      
      {/* כותרת מיושרת לימין ללא תמונת פרופיל */}
      <div className="px-4 mb-4 mt-4 flex justify-between items-center">
        <h2 className="text-2xl font-black text-brand-dark">תקלות</h2>
        <button onClick={() => setShowVendors(true)} className="bg-[#E3F2FD] text-[#1D4ED8] px-4 py-2 rounded-2xl text-xs font-bold active:scale-95 transition shadow-sm flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
          אנשי מקצוע
        </button>
      </div>

      <div className="px-4 mb-6">
        {!isReporting ? (
          <button onClick={() => setIsReporting(true)} className="w-full bg-white border border-gray-100 rounded-[2rem] p-6 shadow-sm flex items-center gap-4 active:scale-95 transition text-right">
            <div className="w-14 h-14 bg-orange-50 text-orange-500 rounded-full flex items-center justify-center shrink-0">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
            </div>
            <div className="flex-1">
              <h3 className="font-black text-brand-dark text-lg flex items-center gap-1">
                דיווח מהיר
                <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20"><path d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z"></path></svg>
              </h3>
              <p className="text-sm text-gray-500">המערכת תזהה את הבעיה לבד</p>
            </div>
          </button>
        ) : (
          <form onSubmit={handleSubmitReport} className="bg-white border border-[#E3F2FD] rounded-[2rem] p-5 shadow-lg animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                 <h3 className="font-black text-brand-dark">מה קרה?</h3>
                 <span className="bg-[#E3F2FD] text-[#1D4ED8] text-[9px] font-bold px-2 py-0.5 rounded-full">מערכת חכמה פעילה</span>
              </div>
              <button type="button" onClick={() => setIsReporting(false)} className="p-2 bg-gray-50 rounded-full text-gray-500 hover:text-brand-dark"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
            </div>
            
            <textarea autoFocus value={description} onChange={e => setDescription(e.target.value)} placeholder="תאר במילים שלך... המערכת כבר תבין למי להפנות את זה" className="w-full bg-gray-50 rounded-2xl p-4 text-sm outline-none resize-none min-h-[100px] mb-3 text-brand-dark border border-gray-100 focus:border-[#1D4ED8]/30 transition" />
            
            {imagePreview && (
              <div className="relative w-24 h-24 mb-3 rounded-xl overflow-hidden shadow-sm">
                <img src={imagePreview} className="w-full h-full object-cover" alt="תצוגה" />
                <button type="button" onClick={() => {setImagePreview(null); setImageFile(null)}} className="absolute top-1 right-1 bg-black/50 text-white p-1 rounded-full"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
              </div>
            )}

            <div className="flex gap-2">
              <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageChange} />
              <button type="button" onClick={() => fileInputRef.current?.click()} className="bg-gray-50 border border-gray-100 text-gray-500 w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 active:scale-95 transition">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
              </button>
              <button type="submit" disabled={isSubmitting || (!description.trim() && !imageFile)} className="flex-1 bg-[#2D5AF0] text-white font-bold rounded-2xl shadow-sm disabled:opacity-50 active:scale-95 transition">שליחה לוועד</button>
            </div>
          </form>
        )}
      </div>

      <div className="flex gap-2 px-4 mb-4 overflow-x-auto hide-scrollbar">
        {['פתוח', 'בטיפול', 'טופל', 'הכל'].map(tab => (
          <button key={tab} onClick={() => setActiveFilter(tab)} className={`px-5 py-2 rounded-full text-xs font-bold transition whitespace-nowrap ${activeFilter === tab ? 'bg-[#2D5AF0] text-white shadow-sm' : 'bg-white border border-gray-100 text-gray-500'}`}>
            {tab}
          </button>
        ))}
      </div>

      <div className="space-y-4 px-4">
        {tickets.length === 0 ? (
          <div className="text-center py-10 bg-white/50 rounded-3xl border border-gray-100"><p className="text-gray-400 font-medium text-sm">אין תקלות בסטטוס זה</p></div>
        ) : (
          tickets.map(ticket => (
            <div key={ticket.id} className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 flex flex-col gap-3 relative overflow-hidden text-right">
              <div className={`absolute top-0 right-0 w-1.5 h-full ${ticket.status === 'פתוח' ? 'bg-red-400' : ticket.status === 'בטיפול' ? 'bg-orange-400' : 'bg-green-400'}`}></div>
              <div className="flex justify-between items-center pr-2">
                <div className="flex items-center gap-2">
                  <img src={ticket.profiles?.avatar_url || `https://api.dicebear.com/8.x/initials/svg?seed=${ticket.profiles?.full_name}&backgroundColor=eef2ff&textColor=1e3a8a`} className="w-8 h-8 rounded-full border border-gray-100 object-cover" alt="פרופיל" />
                  <div>
                    <p className="text-xs font-bold text-brand-dark">{ticket.profiles?.full_name}</p>
                    <p className="text-[10px] text-gray-400">{timeFormat(ticket.created_at)}</p>
                  </div>
                </div>
                <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg ${ticket.status === 'פתוח' ? 'text-red-500 bg-red-50' : ticket.status === 'בטיפול' ? 'text-orange-500 bg-orange-50' : 'text-green-500 bg-green-50'}`}>{ticket.status}</span>
              </div>
              <p className="text-sm font-bold text-brand-dark pr-2 flex items-center gap-1.5">
                {ticket.title}
              </p>
              {ticket.description && ticket.description !== ticket.title && <p className="text-xs text-gray-600 pr-2 leading-relaxed">{ticket.description}</p>}
              
              {ticket.image_url && (
                <div onClick={() => setFullScreenImage(ticket.image_url)} className="w-full h-32 rounded-2xl overflow-hidden cursor-pointer mt-1 border border-gray-50">
                  <img src={ticket.image_url} className="w-full h-full object-cover" alt="תמונה" />
                </div>
              )}

              {isAdmin && ticket.status !== 'טופל' && (
                <div className="flex gap-2 mt-2 pt-3 border-t border-gray-50">
                  {ticket.status === 'פתוח' && <button onClick={() => updateTicketStatus(ticket.id, 'בטיפול')} className="flex-1 bg-orange-50 text-orange-600 text-xs font-bold py-2.5 rounded-xl transition active:scale-95">העבר לטיפול</button>}
                  <button onClick={() => updateTicketStatus(ticket.id, 'טופל')} className="flex-1 bg-green-50 text-green-600 text-xs font-bold py-2.5 rounded-xl transition active:scale-95">סמן כטופל</button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {showVendors && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-end">
          <div className="bg-white w-full rounded-t-[3rem] p-6 pb-12 shadow-2xl animate-in slide-in-from-bottom-full max-h-[90vh] flex flex-col text-right">
            <div className="flex justify-between items-center mb-4 shrink-0">
              <h3 className="text-xl font-black text-brand-dark">אנשי מקצוע</h3>
              <button onClick={() => setShowVendors(false)} className="p-2 bg-gray-50 rounded-full text-gray-500 hover:bg-gray-100 transition"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
            </div>

            <div className="flex gap-2 mb-4 shrink-0 bg-gray-50 p-1 rounded-2xl">
              <button onClick={() => setVendorTab('קבועים')} className={`flex-1 py-2 text-sm font-bold rounded-xl transition ${vendorTab === 'קבועים' ? 'bg-white text-brand-dark shadow-sm' : 'text-gray-400'}`}>ספקי הבית</button>
              <button onClick={() => setVendorTab('המלצות')} className={`flex-1 py-2 text-sm font-bold rounded-xl transition ${vendorTab === 'המלצות' ? 'bg-white text-brand-dark shadow-sm' : 'text-gray-400'}`}>המלצות שכנים</button>
            </div>

            <div className="overflow-y-auto hide-scrollbar flex-1 pb-4">
              {!isAddingVendor ? (
                <button onClick={() => setIsAddingVendor(true)} className="w-full bg-[#E3F2FD] border border-[#BFDBFE] rounded-2xl p-4 text-[#1D4ED8] font-bold text-sm mb-4 active:scale-95 transition flex items-center justify-center gap-2 shadow-sm">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"></path></svg>
                  {vendorTab === 'קבועים' && isAdmin ? 'הוספת ספק קבוע לבניין' : 'הוספת המלצה חדשה'}
                </button>
              ) : (
                <form onSubmit={handleAddVendor} className="bg-white border border-[#BFDBFE] shadow-lg p-5 rounded-3xl mb-5 space-y-4 animate-in zoom-in-95">
                  <h4 className="font-black text-brand-dark text-center">{isAdmin && vendorTab === 'קבועים' ? 'ספק קבוע חדש' : 'המלצה חדשה'}</h4>
                  <input type="text" placeholder="שם (לדוג': יצחק החשמלאי)" value={newVendor.name} onChange={e => setNewVendor({...newVendor, name: e.target.value})} className="w-full p-3.5 bg-gray-50 border border-gray-100 rounded-xl outline-none text-sm font-bold focus:border-[#BFDBFE] transition" required />
                  <input type="text" placeholder="מקצוע (לדוג': חשמלאי)" value={newVendor.profession} onChange={e => setNewVendor({...newVendor, profession: e.target.value})} className="w-full p-3.5 bg-gray-50 border border-gray-100 rounded-xl outline-none text-sm font-bold focus:border-[#BFDBFE] transition" required />
                  <input type="tel" placeholder="טלפון נייד" value={newVendor.phone} onChange={e => setNewVendor({...newVendor, phone: e.target.value})} className="w-full p-3.5 bg-gray-50 border border-gray-100 rounded-xl outline-none text-sm font-bold text-left focus:border-[#BFDBFE] transition" dir="ltr" required />
                  
                  {isAdmin && (
                    <label className="flex items-center gap-2 bg-[#E3F2FD]/50 p-3 rounded-xl cursor-pointer border border-[#BFDBFE]/50">
                      <input type="checkbox" checked={isFixedVendor} onChange={e => setIsFixedVendor(e.target.checked)} className="w-4 h-4 text-[#2D5AF0] rounded border-gray-300" />
                      <span className="text-xs font-bold text-brand-dark">ספק קבוע של הבניין</span>
                    </label>
                  )}

                  {(!isAdmin || !isFixedVendor) && (
                    <div className="flex flex-col items-center gap-2 bg-gray-50 p-3 rounded-xl border border-gray-100">
                      <span className="text-xs font-bold text-gray-500">דרג את השירות:</span>
                      <div className="flex gap-1 flex-row-reverse">
                        {[1, 2, 3, 4, 5].map(star => (
                          <svg key={star} onClick={() => setNewRating(star)} className={`w-8 h-8 cursor-pointer transition-transform hover:scale-110 ${star <= newRating ? 'text-yellow-400 drop-shadow-sm' : 'text-gray-200'}`} fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path></svg>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <button type="submit" className="flex-1 bg-[#2D5AF0] text-white font-bold py-3.5 rounded-xl text-sm shadow-md active:scale-95 transition">שמור</button>
                    <button type="button" onClick={() => setIsAddingVendor(false)} className="px-6 bg-gray-100 text-gray-500 font-bold rounded-xl text-sm active:scale-95 transition">ביטול</button>
                  </div>
                </form>
              )}

              <div className="space-y-3">
                {(vendorTab === 'קבועים' ? fixedVendors : recommendedVendors).map(v => (
                  <div key={v.id} className="bg-white border border-gray-100 shadow-sm p-4 rounded-3xl flex flex-col gap-3 relative overflow-hidden text-right">
                    {v.is_fixed && <div className="absolute top-0 right-0 bg-[#E3F2FD] text-[#1D4ED8] text-[9px] font-black px-3 py-0.5 rounded-bl-lg">בדוק ואושר</div>}
                    
                    <div className="flex justify-between items-start pt-1">
                      <div>
                        <h4 className="font-black text-brand-dark text-lg leading-tight">{v.name}</h4>
                        <p className="text-sm font-bold text-[#1D4ED8] mb-1">{v.profession}</p>
                        {!v.is_fixed && (
                          <div className="flex items-center gap-1.5">
                            <div className="flex gap-0.5">
                              {[1, 2, 3, 4, 5].map(star => <svg key={star} className={`w-3.5 h-3.5 ${star <= (v.rating || 5) ? 'text-yellow-400' : 'text-gray-200'}`} fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path></svg>)}
                            </div>
                            <span className="text-[10px] text-gray-400 font-medium">ע"י {v.profiles?.full_name}</span>
                          </div>
                        )}
                      </div>
                      
                      {(profile.id === v.recommender_id || isAdmin) && (
                        <button onClick={() => handleDeleteVendor(v.id)} className="p-1.5 text-gray-300 hover:text-red-500 transition rounded-full hover:bg-red-50">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>
                      )}
                    </div>

                    <div className="flex gap-2 mt-1">
                      <a href={formatWhatsAppLink(v.phone)} target="_blank" rel="noopener noreferrer" className="flex-1 bg-[#25D366]/10 text-[#25D366] py-2.5 rounded-xl text-xs font-black active:scale-95 transition flex items-center justify-center gap-1.5">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                        הודעה
                      </a>
                      <a href={`tel:${v.phone}`} onClick={() => playSystemSound('click')} className="flex-1 bg-[#2D5AF0] text-white py-2.5 rounded-xl text-xs font-black shadow-md active:scale-95 transition flex items-center justify-center gap-1.5">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
                        חיוג
                      </a>
                    </div>
                  </div>
                ))}
                
                {(vendorTab === 'קבועים' ? fixedVendors : recommendedVendors).length === 0 && (
                  <div className="text-center py-10">
                    <p className="text-gray-400 text-xs font-bold">אין נתונים בלשונית זו.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {fullScreenImage && (
        <div className="fixed inset-0 z-[70] bg-black/90 flex items-center justify-center p-4 animate-in fade-in" onClick={() => setFullScreenImage(null)}>
          <button className="absolute top-6 left-6 text-white bg-white/20 p-2 rounded-full hover:bg-white/40 transition z-10"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
          <img src={fullScreenImage} className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl" onClick={e => e.stopPropagation()}/>
        </div>
      )}
    </div>
  )
}

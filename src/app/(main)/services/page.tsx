'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../../../lib/supabase'

const filterTabs = ['הכל', 'פתוח', 'בטיפול', 'טופל']
const locations = ['כללי', 'לובי', 'חניון', 'מעלית', 'גינה', 'גג', 'קומת מגורים', 'אחר']

export default function ServicesPage() {
  const [profile, setProfile] = useState<any>(null)
  const [tickets, setTickets] = useState<any[]>([])
  const [activeFilter, setActiveFilter] = useState('הכל')
  const [currentUser, setCurrentUser] = useState<any>(null)
  
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [newTicket, setNewTicket] = useState({ title: '', description: '', urgency: 'רגיל', location: 'כללי' })
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null)

  const [editingTicketId, setEditingTicketId] = useState<string | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [editTicketData, setEditTicketData] = useState({ title: '', description: '', urgency: 'רגיל', location: 'כללי' })

  const fileInputRef = useRef<HTMLInputElement>(null)

  // הפונקציה המאוחדת שמונעת את הריצוד (בדיוק כמו בלוח מודעות)
  const fetchData = useCallback(async (userToFetch: any) => {
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', userToFetch.id).single()
    if (!prof || !prof.building_id) return
    setProfile(prof)

    let query = supabase.from('service_tickets')
      .select('*, profiles(full_name, avatar_url, apartment, floor)')
      .eq('building_id', prof.building_id)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })

    if (activeFilter !== 'הכל') {
      query = query.eq('status', activeFilter)
    }

    const { data } = await query
    if (data) setTickets(data)
  }, [activeFilter])

  // טעינה חלקה פעם אחת
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setCurrentUser(user)
        fetchData(user)
      }
    })

    const channel = supabase.channel('tickets_realtime_v8')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_tickets' }, () => {
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

  const handleOpenTicket = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile?.building_id || !newTicket.title) return

    setIsSubmitting(true)
    let imageUrl = null

    if (imageFile) {
      const fileExt = imageFile.name.split('.').pop()
      const fileName = `${Date.now()}.${fileExt}`
      const { data, error: uploadError } = await supabase.storage.from('tickets').upload(fileName, imageFile)
      if (!uploadError && data) {
        imageUrl = supabase.storage.from('tickets').getPublicUrl(fileName).data.publicUrl
      }
    }

    const { error } = await supabase.from('service_tickets').insert([{
      building_id: profile.building_id,
      user_id: profile.id,
      title: newTicket.title,
      description: newTicket.description,
      urgency: newTicket.urgency,
      location: newTicket.location,
      image_url: imageUrl
    }])

    if (!error && currentUser) {
      setIsModalOpen(false)
      setNewTicket({ title: '', description: '', urgency: 'רגיל', location: 'כללי' })
      setImageFile(null)
      setImagePreview(null)
      fetchData(currentUser)
    }
    setIsSubmitting(false)
  }

  const handleEditClick = (ticket: any) => {
    setEditingTicketId(ticket.id)
    setEditTicketData({
      title: ticket.title,
      description: ticket.description || '',
      urgency: ticket.urgency || 'רגיל',
      location: ticket.location || 'כללי'
    })
    setOpenMenuId(null)
  }

  const handleInlineEditSubmit = async (e: React.FormEvent, id: string) => {
    e.preventDefault()
    setIsSubmitting(true)
    await supabase.from('service_tickets').update({
      title: editTicketData.title,
      description: editTicketData.description,
      urgency: editTicketData.urgency,
      location: editTicketData.location
    }).eq('id', id)

    setEditingTicketId(null)
    if (currentUser) fetchData(currentUser)
    setIsSubmitting(false)
  }

  const updateTicketStatus = async (id: string, newStatus: string) => {
    await supabase.from('service_tickets').update({ status: newStatus }).eq('id', id)
    if (currentUser) fetchData(currentUser)
  }

  const togglePin = async (id: string, currentStatus: boolean) => {
    await supabase.from('service_tickets').update({ is_pinned: !currentStatus }).eq('id', id)
    setOpenMenuId(null)
    if (currentUser) fetchData(currentUser)
  }

  const handleDelete = async (id: string) => {
    if(confirm("האם למחוק קריאה זו?")) {
      await supabase.from('service_tickets').delete().eq('id', id)
      setOpenMenuId(null)
      if (currentUser) fetchData(currentUser)
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

  const isAdmin = profile?.role === 'admin'

  return (
    <div className="flex flex-col flex-1 w-full pb-24 relative" dir="rtl">
      
      <div className="px-4 mb-4 mt-2">
        <h2 className="text-2xl font-black text-brand-dark">שירותים ותקלות</h2>
      </div>

      <div className="flex overflow-x-auto hide-scrollbar gap-2 px-4 mb-6 pb-2">
        {filterTabs.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveFilter(tab)}
            className={`whitespace-nowrap px-5 py-2 rounded-full text-sm font-bold transition shadow-sm border ${
              activeFilter === tab
                ? 'bg-brand-blue text-white border-brand-blue'
                : 'bg-white text-brand-dark border-gray-100 hover:bg-gray-50'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="space-y-4 px-4">
        {tickets.length === 0 ? (
          <div className="text-center py-10 bg-white/50 rounded-3xl border border-gray-100 shadow-sm">
            <p className="text-brand-gray font-medium">אין קריאות שירות פתוחות כרגע</p>
          </div>
        ) : (
          tickets.map(ticket => {
            const isMine = profile?.id === ticket.user_id
            
            let statusBg = 'bg-brand-blue/10 text-brand-blue border-brand-blue/20'
            if (ticket.status === 'בטיפול') {
              statusBg = 'bg-orange-50 text-orange-600 border-orange-200'
            } else if (ticket.status === 'טופל') {
              statusBg = 'bg-green-50 text-green-600 border-green-200'
            }

            return (
              <div key={ticket.id} className={`bg-white p-3 rounded-3xl shadow-sm border flex flex-col relative transition-all ${ticket.is_pinned ? 'border-brand-blue/30 shadow-[0_4px_20px_rgba(0,68,204,0.1)]' : 'border-gray-50'}`}>
                
                {ticket.is_pinned && (
                  <div className="absolute top-0 right-4 bg-brand-blue text-white text-[10px] font-black px-3 py-1 rounded-b-lg shadow-sm flex items-center gap-1 z-10">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z"></path></svg>
                    נעוץ מנהל
                  </div>
                )}

                <div className="absolute top-2 left-2 z-40">
                  <div className="relative">
                    <button onClick={() => setOpenMenuId(openMenuId === ticket.id ? null : ticket.id)} className="p-2 transition hover:scale-110 text-gray-400 hover:text-brand-dark">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"></path></svg>
                    </button>
                    
                    {openMenuId === ticket.id && (
                      <div className="absolute left-0 top-8 w-44 bg-white border border-gray-100 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.15)] z-[100] overflow-hidden py-1">
                        {isAdmin && (
                          <button onClick={() => togglePin(ticket.id, ticket.is_pinned)} className="w-full text-right px-4 py-2.5 text-xs font-bold text-brand-dark hover:bg-gray-50 flex items-center gap-2">
                            <svg className="w-4 h-4 text-brand-blue" fill="currentColor" viewBox="0 0 20 20"><path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z"></path></svg>
                            {ticket.is_pinned ? 'בטל נעיצה' : 'נעץ קריאה'}
                          </button>
                        )}
                        {isMine && (
                          <button onClick={() => handleEditClick(ticket)} className="w-full text-right px-4 py-2.5 text-xs font-bold text-brand-dark hover:bg-gray-50 flex items-center gap-2 border-t border-gray-50">
                            <svg className="w-4 h-4 text-brand-gray" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                            ערוך קריאה
                          </button>
                        )}
                        {(isMine || isAdmin) && (
                          <button onClick={() => handleDelete(ticket.id)} className="w-full text-right px-4 py-2.5 text-xs font-bold text-red-500 hover:bg-red-50 flex items-center gap-2 border-t border-gray-50">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                            מחק קריאה
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {editingTicketId === ticket.id ? (
                  <form onSubmit={(e) => handleInlineEditSubmit(e, ticket.id)} className="p-2 flex flex-col gap-3 bg-gray-50/50 rounded-2xl">
                    <input type="text" required value={editTicketData.title} onChange={e => setEditTicketData({...editTicketData, title: e.target.value})} className="w-full bg-white border border-brand-blue/30 rounded-xl px-3 py-2 text-sm outline-none focus:border-brand-blue" placeholder="נושא התקלה" />
                    
                    <div className="flex gap-2">
                      <select value={editTicketData.urgency} onChange={e => setEditTicketData({...editTicketData, urgency: e.target.value})} className="flex-1 bg-white border border-brand-blue/30 rounded-xl px-3 py-2 text-sm outline-none focus:border-brand-blue">
                        <option value="רגיל">דחיפות: רגיל</option>
                        <option value="דחוף">דחיפות: דחוף</option>
                      </select>
                      <select value={editTicketData.location} onChange={e => setEditTicketData({...editTicketData, location: e.target.value})} className="flex-1 bg-white border border-brand-blue/30 rounded-xl px-3 py-2 text-sm outline-none focus:border-brand-blue">
                        {locations.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                      </select>
                    </div>
                    
                    <textarea value={editTicketData.description} onChange={e => setEditTicketData({...editTicketData, description: e.target.value})} className="w-full bg-white border border-brand-blue/30 rounded-xl px-3 py-2 text-sm outline-none focus:border-brand-blue min-h-[60px]" placeholder="פירוט התקלה (אופציונלי)" />
                    
                    <div className="flex justify-end gap-2 mt-1">
                      <button type="button" onClick={() => setEditingTicketId(null)} className="px-4 py-2 text-xs font-bold text-gray-500 hover:bg-gray-100 rounded-xl transition">ביטול</button>
                      <button type="submit" disabled={isSubmitting} className="px-4 py-2 text-xs font-bold text-white bg-brand-blue rounded-xl shadow-sm transition active:scale-95">{isSubmitting ? 'שומר...' : 'שמור שינויים'}</button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="flex gap-4 min-h-[110px] relative">
                      
                      <div 
                        className="w-[100px] h-[110px] rounded-2xl bg-gray-50 shrink-0 border border-gray-100 overflow-hidden cursor-pointer relative"
                        onClick={() => ticket.image_url && setFullScreenImage(ticket.image_url)}
                      >
                        {ticket.image_url ? (
                          <img src={ticket.image_url} alt="תמונת תקלה" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-brand-blue/20 bg-brand-blue/5">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex-1 py-1 flex flex-col pt-1 pl-7">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <h3 className="font-bold text-[#0F172A] text-[15px] leading-tight line-clamp-1">{ticket.title}</h3>
                        </div>
                        
                        <div className="flex flex-wrap gap-1.5 mb-1.5">
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg border ${statusBg}`}>
                            {ticket.status}
                          </span>
                          
                          {ticket.urgency === 'דחוף' && (
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-lg bg-red-50 text-red-600 border border-red-100 flex items-center gap-1">
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"></path></svg>
                              דחוף
                            </span>
                          )}

                          {ticket.location && ticket.location !== 'כללי' && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-gray-100 text-gray-600 border border-gray-200">
                              {ticket.location}
                            </span>
                          )}
                        </div>
                        
                        <p className="text-[13px] text-[#334155] leading-snug line-clamp-2">
                          {ticket.description || 'ללא פירוט'}
                        </p>
                        
                        <div className="mt-auto text-[11px] text-[#64748B] font-medium flex items-center justify-between pt-2">
                          <span>{ticket.profiles?.full_name} • דירה {ticket.profiles?.apartment || '?'}</span>
                          <span>{timeFormat(ticket.created_at)}</span>
                        </div>
                      </div>
                    </div>

                    {(isAdmin || isMine) && ticket.status !== 'טופל' && (
                      <div className="flex gap-2 mt-3 pt-3 border-t border-gray-50">
                        {isAdmin && ticket.status === 'פתוח' && (
                          <button onClick={() => updateTicketStatus(ticket.id, 'בטיפול')} className="flex-1 text-[11px] font-bold bg-orange-50 text-orange-600 hover:bg-orange-100 py-2.5 rounded-xl transition shadow-sm border border-orange-100">
                            סמן כ״בטיפול״
                          </button>
                        )}
                        <button onClick={() => updateTicketStatus(ticket.id, 'טופל')} className="flex-1 text-[11px] font-bold bg-green-50 text-green-600 hover:bg-green-100 py-2.5 rounded-xl transition shadow-sm border border-green-100">
                          סמן כ״טופל״
                        </button>
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
        onClick={() => setIsModalOpen(true)} 
        className="fixed bottom-28 left-5 z-40 bg-white border border-brand-blue/20 text-brand-dark pl-4 pr-1.5 py-1.5 rounded-full shadow-[0_10px_40px_rgba(0,68,204,0.15)] hover:scale-105 active:scale-95 transition flex items-center gap-3 group"
      >
        <div className="bg-[#2D5AF0]/10 text-[#2D5AF0] p-2.5 rounded-full group-hover:bg-[#2D5AF0] group-hover:text-white transition">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"></path></svg>
        </div>
        <span className="font-bold text-sm">פתיחת קריאה</span>
      </button>

      {isModalOpen && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex justify-center items-end">
          <div className="bg-white w-full max-w-md rounded-t-3xl p-6 pb-8 shadow-2xl animate-in slide-in-from-bottom-10 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6 sticky top-0 bg-white z-10 pt-2">
              <h3 className="font-black text-lg text-brand-dark">פתיחת קריאת שירות</h3>
              <button onClick={() => { setIsModalOpen(false); setImagePreview(null); setImageFile(null); }} className="p-2 bg-gray-100 rounded-full text-brand-dark hover:bg-gray-200 transition">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>

            <form onSubmit={handleOpenTicket} className="space-y-4">
              
              <div>
                <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageChange} />
                {!imagePreview ? (
                  <div onClick={() => fileInputRef.current?.click()} className="w-full aspect-video bg-brand-blue/5 border-2 border-dashed border-brand-blue/30 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:bg-brand-blue/10 transition">
                    <svg className="w-8 h-8 text-brand-blue mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                    <span className="text-sm font-bold text-brand-blue">הוסף תמונה להמחשה</span>
                  </div>
                ) : (
                  <div className="w-full aspect-video relative rounded-2xl overflow-hidden shadow-sm">
                    <img src={imagePreview} className="w-full h-full object-cover" />
                    <button type="button" onClick={() => { setImagePreview(null); setImageFile(null); }} className="absolute top-2 right-2 bg-black/60 text-white p-2 rounded-full hover:bg-red-500 transition">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-bold text-brand-dark mb-1 block">נושא התקלה *</label>
                <input type="text" required value={newTicket.title} onChange={e => setNewTicket({...newTicket, title: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-blue transition shadow-sm text-brand-dark" placeholder="לדוג': נזילה בצינור בלובי" />
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs font-bold text-brand-dark mb-1 block">דחיפות</label>
                  <select value={newTicket.urgency} onChange={e => setNewTicket({...newTicket, urgency: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-blue transition shadow-sm text-brand-dark">
                    <option value="רגיל">רגיל</option>
                    <option value="דחוף">דחוף (סכנה!)</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-xs font-bold text-brand-dark mb-1 block">מיקום *</label>
                  <select value={newTicket.location} onChange={e => setNewTicket({...newTicket, location: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-blue transition shadow-sm text-brand-dark">
                    {locations.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-brand-dark mb-1 block">פירוט התקלה (אופציונלי)</label>
                <textarea value={newTicket.description} onChange={e => setNewTicket({...newTicket, description: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-blue transition shadow-sm min-h-[80px] text-brand-dark" placeholder="נא לפרט מיקום מדויק של התקלה..."></textarea>
              </div>

              <button type="submit" disabled={isSubmitting} className="w-full bg-[#2D5AF0] text-white font-bold py-4 rounded-xl shadow-[0_8px_20px_rgba(45,90,240,0.3)] mt-4 active:scale-95 transition disabled:opacity-50">
                {isSubmitting ? 'מעלה קריאה...' : 'שדר לוועד הבית'}
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
          <img 
            src={fullScreenImage} 
            alt="Fullscreen" 
            className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl" 
            onClick={(e) => e.stopPropagation()} 
          />
        </div>
      )}
    </div>
  )
}

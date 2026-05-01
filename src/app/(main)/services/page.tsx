'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'

const filterTabs = ['הכל', 'פתוח', 'בטיפול', 'טופל']
const locations = ['כללי', 'לובי', 'חניון', 'מעלית', 'גינה', 'גג', 'קומת מגורים', 'אחר']

export default function ServicesPage() {
  const [profile, setProfile] = useState<any>(null)
  const [tickets, setTickets] = useState<any[]>([])
  const [activeFilter, setActiveFilter] = useState('הכל')
  
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [newTicket, setNewTicket] = useState({ title: '', description: '', urgency: 'רגיל', location: 'כללי' })
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null)

  const [editingTicketId, setEditingTicketId] = useState<string | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [editTicketData, setEditTicketData] = useState({ title: '', description: '', urgency: 'רגיל', location: 'כללי' })

  // משיכת פרופיל פעם אחת בלבד כדי למנוע ריצודים
  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        if (prof) setProfile(prof)
      }
    }
    fetchProfile()
  }, [])

  // פונקציה חכמה למשיכת תקלות בלבד
  const fetchTickets = useCallback(async () => {
    if (!profile?.building_id) return

    let query = supabase.from('service_tickets')
      .select('*, profiles(full_name, avatar_url, apartment, floor)')
      .eq('building_id', profile.building_id)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })

    if (activeFilter !== 'הכל') {
      query = query.eq('status', activeFilter)
    }

    const { data } = await query
    if (data) setTickets(data)
  }, [profile?.building_id, activeFilter])

  // ניהול משיכת התקלות וזמן אמת
  useEffect(() => {
    if (!profile?.building_id) return
    
    fetchTickets()

    const channel = supabase.channel('tickets_realtime_v6')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_tickets' }, () => {
        fetchTickets()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchTickets, profile?.building_id])

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      setImageFile(file)
      setImagePreview(URL.createObjectURL(file))
    }
  }

  const handleOpenTicket = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile?.building_id) return
    if (!newTicket.title) return

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

    if (!error) {
      setIsModalOpen(false)
      setNewTicket({ title: '', description: '', urgency: 'רגיל', location: 'כללי' })
      setImageFile(null)
      setImagePreview(null)
      fetchTickets()
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
    fetchTickets()
    setIsSubmitting(false)
  }

  const updateTicketStatus = async (id: string, newStatus: string) => {
    await supabase.from('service_tickets').update({ status: newStatus }).eq('id', id)
    fetchTickets()
  }

  const togglePin = async (id: string, currentStatus: boolean) => {
    await supabase.from('service_tickets').update({ is_pinned: !currentStatus }).eq('id', id)
    setOpenMenuId(null)
    fetchTickets()
  }

  const handleDelete = async (id: string) => {
    if(confirm("האם למחוק קריאה זו?")) {
      await supabase.from('service_tickets').delete().eq('id', id)
      setOpenMenuId(null)
      fetchTickets()
    }
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
            
            let statusBg = 'bg-brand-blue/10 text-brand-blue'
            let statusDot = 'bg-brand-blue'
            if (ticket.status === 'בטיפול') {
              statusBg = 'bg-orange-50 text-orange-600'
              statusDot = 'bg-orange-500 animate-pulse'
            } else if (ticket.status === 'טופל') {
              statusBg = 'bg-green-50 text-green-600'
              statusDot = 'bg-green-500'
            }

            return (
              <div key={ticket.id} className={`bg-white p-5 rounded-3xl shadow-sm border flex flex-col relative overflow-hidden transition-colors ${ticket.is_pinned ? 'border-brand-blue/30 shadow-[0_4px_20px_rgba(0,68,204,0.1)]' : 'border-gray-50'}`}>
                
                {ticket.is_pinned && (
                  <div className="absolute top-0 right-4 bg-brand-blue text-white text-[10px] font-black px-3 py-1 rounded-b-lg shadow-sm flex items-center gap-1 z-10">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z"></path></svg>
                    נעוץ מנהל
                  </div>
                )}

                {(isMine || isAdmin) && ticket.status !== 'טופל' && (
                  <div className={`absolute left-3 z-20 ${ticket.is_pinned ? 'top-4' : 'top-3'}`}>
                    <div className="relative">
                      <button onClick={() => setOpenMenuId(openMenuId === ticket.id ? null : ticket.id)} className="p-1.5 transition drop-shadow-md hover:scale-110 text-brand-dark">
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"></path></svg>
                      </button>
                      {openMenuId === ticket.id && (
                        <div className="absolute left-0 mt-1 w-36 bg-white border border-gray-100 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] overflow-hidden z-30">
                          {isAdmin && (
                            <button onClick={() => togglePin(ticket.id, ticket.is_pinned)} className="w-full text-right px-4 py-3 text-xs font-bold text-brand-dark hover:bg-gray-50 flex items-center gap-2 border-b border-gray-50">
                              <svg className="w-4 h-4 text-brand-blue" fill="currentColor" viewBox="0 0 20 20"><path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z"></path></svg>
                              {ticket.is_pinned ? 'בטל נעיצה' : 'נעץ קריאה'}
                            </button>
                          )}
                          {isMine && (
                            <button onClick={() => handleEditClick(ticket)} className="w-full text-right px-4 py-3 text-xs font-bold text-brand-dark hover:bg-gray-50 flex items-center gap-2">
                              <svg className="w-4 h-4 text-brand-gray" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                              ערוך קריאה
                            </button>
                          )}
                          {(isMine || isAdmin) && (
                            <button onClick={() => handleDelete(ticket.id)} className="w-full text-right px-4 py-3 text-xs font-bold text-red-500 hover:bg-red-50 flex items-center gap-2 border-t border-gray-50">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                              מחק קריאה
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className={`flex items-start gap-3 ${ticket.is_pinned ? 'mt-3' : ''}`}>
                  <div className="w-11 h-11 rounded-full bg-brand-blue/5 border border-gray-100 overflow-hidden shrink-0 mt-1 flex items-center justify-center">
                    <img src={ticket.profiles?.avatar_url || `https://api.dicebear.com/8.x/initials/svg?seed=${ticket.profiles?.full_name}&backgroundColor=eef2ff&textColor=1e3a8a`} className="w-full h-full object-cover" />
                  </div>
                  
                  <div className="flex-1 pr-1">
                    {editingTicketId !== ticket.id && (
                      <div className="flex gap-2 items-center mb-2.5 flex-wrap pr-6">
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-md flex items-center gap-1.5 ${statusBg}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${statusDot}`}></span>
                          {ticket.status}
                        </span>
                        
                        {ticket.location && ticket.location !== 'כללי' && (
                          <span className="text-[10px] font-bold px-2.5 py-1 rounded-md bg-gray-100 text-gray-600 flex items-center gap-1 shadow-sm border border-gray-200">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                            {ticket.location}
                          </span>
                        )}

                        {ticket.urgency === 'דחוף' && (
                          <span className="text-[10px] font-bold px-2.5 py-1 rounded-md bg-red-50 text-red-500 flex items-center gap-1 shadow-sm border border-red-100/50">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"></path></svg>
                            דחוף
                          </span>
                        )}
                      </div>
                    )}

                    {editingTicketId === ticket.id ? (
                      <form onSubmit={(e) => handleInlineEditSubmit(e, ticket.id)} className="bg-gray-50 p-4 rounded-2xl flex flex-col gap-3 mt-1 border border-brand-blue/20">
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
                        <h3 className="font-black text-brand-dark text-[15px] leading-tight mb-1">{ticket.title}</h3>
                        <p className="text-[10px] text-brand-gray font-medium mb-3">
                          מאת: {ticket.profiles?.full_name} {ticket.profiles?.apartment ? `(דירה ${ticket.profiles.apartment})` : ''} • {new Date(ticket.created_at).toLocaleDateString('he-IL')}
                        </p>
                        {ticket.description && <p className="text-sm text-brand-dark/80 leading-relaxed mb-3 bg-gray-50 p-3 rounded-xl border border-gray-100">{ticket.description}</p>}
                        
                        {/* תצוגת התמונה נקייה לחלוטין (ללא האייקון) */}
                        {ticket.image_url && (
                          <div 
                            className="mt-2 rounded-xl overflow-hidden border border-gray-100 max-h-48 relative cursor-pointer hover:opacity-95 transition"
                            onClick={() => setFullScreenImage(ticket.image_url)}
                          >
                            <img src={ticket.image_url} alt="תמונת תקלה" className="w-full h-full object-cover" />
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {(isAdmin || isMine) && ticket.status !== 'טופל' && editingTicketId !== ticket.id && (
                  <div className="flex gap-2 mt-4 pt-3 border-t border-gray-50">
                    {isAdmin && ticket.status === 'פתוח' && (
                      <button onClick={() => updateTicketStatus(ticket.id, 'בטיפול')} className="flex-1 text-[11px] font-bold bg-orange-50 text-orange-600 hover:bg-orange-100 py-2.5 rounded-xl transition shadow-sm">
                        סמן כ״בטיפול״
                      </button>
                    )}
                    <button onClick={() => updateTicketStatus(ticket.id, 'טופל')} className="flex-1 text-[11px] font-bold bg-green-50 text-green-600 hover:bg-green-100 py-2.5 rounded-xl transition shadow-sm">
                      סמן כ״טופל״
                    </button>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      <button onClick={() => setIsModalOpen(true)} className="fixed bottom-28 left-4 z-40 bg-white/90 backdrop-blur-md border border-brand-blue/10 text-brand-blue p-1.5 pl-4 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:scale-105 active:scale-95 transition flex items-center gap-2">
        <div className="bg-brand-blue/10 p-2 rounded-full">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"></path></svg>
        </div>
        <span className="font-bold text-sm">פתיחת קריאה</span>
      </button>

      {/* מודל העלאת קריאה */}
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

              <div>
                <label className="text-xs font-bold text-brand-dark mb-1 block">העלאת תמונה להמחשה</label>
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

              <button type="submit" disabled={isSubmitting} className="w-full bg-brand-blue text-white font-bold py-4 rounded-xl shadow-[0_8px_20px_rgba(0,68,204,0.3)] mt-4 active:scale-95 transition disabled:opacity-50">
                {isSubmitting ? 'מעלה קריאה...' : 'שדר לוועד הבית'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* מודל תמונה במסך מלא */}
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

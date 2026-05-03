'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../../../lib/supabase'
import { playSystemSound } from '../../../components/providers/AppManager'

export default function ServicesPage() {
  const [profile, setProfile] = useState<any>(null)
  const [tickets, setTickets] = useState<any[]>([])
  const [activeFilter, setActiveFilter] = useState('פתוח')
  
  // דיווח חדש ב-One-Tap
  const [isReporting, setIsReporting] = useState(false)
  const [description, setDescription] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (!prof || !prof.building_id) return
    setProfile(prof)

    let query = supabase.from('service_tickets')
      .select('*, profiles(full_name, avatar_url, apartment)')
      .eq('building_id', prof.building_id)
      .order('created_at', { ascending: false })

    if (activeFilter !== 'הכל') {
      query = query.eq('status', activeFilter)
    }

    const { data } = await query
    if (data) setTickets(data)
  }, [activeFilter])

  useEffect(() => {
    fetchData()
    const channel = supabase.channel('tickets_realtime_smart')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_tickets' }, fetchData)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchData])

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      setImageFile(file)
      setImagePreview(URL.createObjectURL(file))
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
      if (!error && data) {
        imageUrl = supabase.storage.from('tickets').getPublicUrl(fileName).data.publicUrl
      }
    }

    // ה-AI בשרת ישלים את הכותרת והתגיות, אנחנו שולחים רק תיאור ותמונה
    const { error } = await supabase.from('service_tickets').insert([{
      building_id: profile.building_id,
      user_id: profile.id,
      title: 'מפענח נתונים...', // ישתנה אוטומטית ע"י ה-DB/AI
      description: description,
      image_url: imageUrl,
      source: 'app'
    }])

    if (!error) {
      playSystemSound('notification')
      setIsReporting(false)
      setDescription('')
      setImageFile(null)
      setImagePreview(null)
      fetchData()
    }
    setIsSubmitting(false)
  }

  const updateTicketStatus = async (id: string, newStatus: string) => {
    await supabase.from('service_tickets').update({ status: newStatus }).eq('id', id)
    playSystemSound('click')
    fetchData()
  }

  const timeFormat = (dateString: string) => {
    const date = new Date(dateString)
    const today = new Date()
    return date.toDateString() === today.toDateString() 
      ? date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) 
      : date.toLocaleDateString('he-IL')
  }

  const isAdmin = profile?.role === 'admin'

  return (
    <div className="flex flex-col flex-1 w-full pb-24 relative" dir="rtl">
      <div className="px-4 mb-4 mt-2">
        <h2 className="text-2xl font-black text-brand-dark">ניהול תקלות</h2>
      </div>

      {/* ממשק דיווח One-Tap */}
      <div className="px-4 mb-6">
        {!isReporting ? (
          <button 
            onClick={() => { setIsReporting(true); playSystemSound('click'); }}
            className="w-full bg-white border border-gray-100 rounded-[2rem] p-6 shadow-sm flex items-center gap-4 hover:shadow-md transition active:scale-95"
          >
            <div className="w-14 h-14 bg-orange-50 text-orange-500 rounded-full flex items-center justify-center shrink-0">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
            </div>
            <div className="text-right">
              <h3 className="font-black text-brand-dark text-lg">דווח על תקלה חדשה</h3>
              <p className="text-sm text-brand-gray">לחץ כאן, תאר מה קרה והמערכת תטפל בשאר.</p>
            </div>
          </button>
        ) : (
          <form onSubmit={handleSubmitReport} className="bg-white border border-brand-blue/20 rounded-[2rem] p-5 shadow-lg animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-black text-brand-dark">מה הבעיה?</h3>
              <button type="button" onClick={() => setIsReporting(false)} className="p-2 bg-gray-50 rounded-full text-gray-500 hover:text-brand-dark">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            
            <textarea 
              autoFocus
              value={description} 
              onChange={e => setDescription(e.target.value)} 
              placeholder="לדוגמה: המעלית הימנית חורקת כבר יומיים..." 
              className="w-full bg-gray-50 rounded-2xl p-4 text-sm outline-none resize-none min-h-[100px] mb-3 focus:bg-brand-blue/5 transition"
            />
            
            {imagePreview && (
              <div className="relative w-24 h-24 mb-3 rounded-xl overflow-hidden shadow-sm">
                <img src={imagePreview} className="w-full h-full object-cover" alt="תצוגה מקדימה" />
                <button type="button" onClick={() => {setImagePreview(null); setImageFile(null)}} className="absolute top-1 right-1 bg-black/50 text-white p-1 rounded-full"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
              </div>
            )}

            <div className="flex gap-2">
              <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageChange} />
              <button type="button" onClick={() => fileInputRef.current?.click()} className="bg-gray-100 text-brand-dark w-12 h-12 rounded-2xl flex items-center justify-center hover:bg-gray-200 transition shrink-0">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
              </button>
              <button type="submit" disabled={isSubmitting || (!description.trim() && !imageFile)} className="flex-1 bg-brand-blue text-white font-bold rounded-2xl shadow-sm disabled:opacity-50 active:scale-95 transition">
                {isSubmitting ? 'שולח...' : 'שגר לוועד הבית'}
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="flex gap-2 px-4 mb-4">
        {['פתוח', 'בטיפול', 'טופל', 'הכל'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveFilter(tab)}
            className={`px-4 py-2 rounded-full text-xs font-bold transition ${activeFilter === tab ? 'bg-brand-dark text-white' : 'bg-white border border-gray-100 text-brand-gray'}`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="space-y-4 px-4">
        {tickets.length === 0 ? (
          <div className="text-center py-10 bg-white/50 rounded-3xl border border-gray-100">
            <p className="text-brand-gray font-medium text-sm">אין תקלות בסטטוס זה</p>
          </div>
        ) : (
          tickets.map(ticket => (
            <div key={ticket.id} className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 flex flex-col gap-3">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <img src={ticket.profiles?.avatar_url || `https://api.dicebear.com/8.x/initials/svg?seed=${ticket.profiles?.full_name}`} className="w-8 h-8 rounded-full border border-gray-50" />
                  <div>
                    <p className="text-xs font-bold text-brand-dark">{ticket.profiles?.full_name}</p>
                    <p className="text-[10px] text-brand-gray">{timeFormat(ticket.created_at)}</p>
                  </div>
                </div>
                <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg border ${ticket.status === 'פתוח' ? 'bg-red-50 text-red-500 border-red-100' : ticket.status === 'בטיפול' ? 'bg-orange-50 text-orange-500 border-orange-100' : 'bg-green-50 text-green-500 border-green-100'}`}>
                  {ticket.status}
                </span>
              </div>
              
              {ticket.title !== 'מפענח נתונים...' && ticket.title && (
                <h4 className="font-black text-brand-dark text-sm">{ticket.title}</h4>
              )}
              
              <p className="text-sm text-brand-dark/80 whitespace-pre-wrap">{ticket.description}</p>
              
              {ticket.image_url && (
                <div onClick={() => setFullScreenImage(ticket.image_url)} className="w-full h-32 rounded-2xl overflow-hidden cursor-pointer mt-1">
                  <img src={ticket.image_url} className="w-full h-full object-cover" />
                </div>
              )}

              {isAdmin && ticket.status !== 'טופל' && (
                <div className="flex gap-2 mt-2 pt-3 border-t border-gray-50">
                  {ticket.status === 'פתוח' && (
                    <button onClick={() => updateTicketStatus(ticket.id, 'בטיפול')} className="flex-1 bg-orange-50 text-orange-600 text-xs font-bold py-2.5 rounded-xl hover:bg-orange-100 transition">
                      העבר לטיפול
                    </button>
                  )}
                  <button onClick={() => updateTicketStatus(ticket.id, 'טופל')} className="flex-1 bg-green-50 text-green-600 text-xs font-bold py-2.5 rounded-xl hover:bg-green-100 transition">
                    סמן כטופל
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {fullScreenImage && (
        <div className="fixed inset-0 z-[70] bg-black/90 flex items-center justify-center p-4 animate-in fade-in" onClick={() => setFullScreenImage(null)}>
          <img src={fullScreenImage} className="max-w-full max-h-[90vh] object-contain rounded-xl" />
        </div>
      )}
    </div>
  )
}

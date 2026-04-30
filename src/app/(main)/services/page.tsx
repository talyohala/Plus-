'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'

const filterTabs = ['הכל', 'פתוח', 'בטיפול', 'טופל']

export default function ServicesPage() {
  const [profile, setProfile] = useState<any>(null)
  const [tickets, setTickets] = useState<any[]>([])
  const [activeFilter, setActiveFilter] = useState('הכל')
  
  // מודל להוספת קריאה
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [newTicket, setNewTicket] = useState({
    title: '', description: '', urgency: 'רגיל'
  })

  const fetchData = async (user: any) => {
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (!prof || !prof.building_id) return
    setProfile(prof)

    let query = supabase.from('service_tickets')
      .select('*, profiles(full_name, avatar_url, apartment, floor)')
      .eq('building_id', prof.building_id)
      .order('created_at', { ascending: false })

    if (activeFilter !== 'הכל') {
      query = query.eq('status', activeFilter)
    }

    const { data } = await query
    if (data) setTickets(data)
  }

  useEffect(() => {
    let currentUser: any = null
    supabase.auth.getUser().then(({ data: { user } }) => {
      currentUser = user
      if (user) fetchData(user)
    })

    const channel = supabase.channel('tickets_realtime_v2')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_tickets' }, () => currentUser && fetchData(currentUser))
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [activeFilter])

  const handleOpenTicket = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile?.building_id) {
        alert("שגיאה: חסר שיוך לבניין. פנה למנהל האפליקציה.")
        return
    }
    if (!newTicket.title) return
    
    setIsSubmitting(true)
    const { error } = await supabase.from('service_tickets').insert([{
      building_id: profile.building_id,
      user_id: profile.id,
      title: newTicket.title,
      description: newTicket.description,
      urgency: newTicket.urgency
    }])

    if (!error) {
      setIsModalOpen(false)
      setNewTicket({ title: '', description: '', urgency: 'רגיל' })
      fetchData(profile)
    } else {
      alert("שגיאה בפתיחת הקריאה: " + error.message)
    }
    setIsSubmitting(false)
  }

  const updateTicketStatus = async (id: string, newStatus: string) => {
    await supabase.from('service_tickets').update({ status: newStatus }).eq('id', id)
    fetchData(profile)
  }

  const handleDelete = async (id: string) => {
    if(confirm("האם למחוק קריאה זו?")) {
      await supabase.from('service_tickets').delete().eq('id', id)
      fetchData(profile)
    }
  }

  const isAdmin = profile?.role === 'admin'

  return (
    <div className="flex flex-col flex-1 w-full pb-24 relative" dir="rtl">
      
      {/* כותרת נקייה */}
      <div className="px-4 mb-4 mt-2">
        <h2 className="text-2xl font-black text-brand-dark">שירותים ותקלות</h2>
      </div>

      {/* סינון קטגוריות חכם */}
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

      {/* רשימת קריאות השירות */}
      <div className="space-y-4 px-4">
        {tickets.length === 0 ? (
          <div className="text-center py-10 bg-white/50 rounded-3xl border border-gray-100 shadow-sm">
            <p className="text-brand-gray font-medium">אין קריאות שירות פתוחות כרגע</p>
          </div>
        ) : (
          tickets.map(ticket => {
            const isMine = profile?.id === ticket.user_id

            // קביעת צבע הסטטוס
            let statusColor = 'bg-gray-100 text-gray-600 border-gray-200'
            if (ticket.status === 'פתוח') statusColor = 'bg-red-50 text-red-500 border-red-100'
            if (ticket.status === 'בטיפול') statusColor = 'bg-orange-50 text-orange-500 border-orange-100'
            if (ticket.status === 'טופל') statusColor = 'bg-green-50 text-green-600 border-green-100'

            return (
              <div key={ticket.id} className="bg-white p-5 rounded-3xl shadow-sm border border-gray-50 flex flex-col relative overflow-hidden transition">
                
                {/* כפתור מחיקה למנהל או ליוצר הקריאה */}
                {(isMine || isAdmin) && ticket.status !== 'טופל' && (
                  <button onClick={() => handleDelete(ticket.id)} className="absolute top-4 left-4 p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-full transition z-10">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                  </button>
                )}

                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-brand-blue/10 flex items-center justify-center border border-brand-blue/20 overflow-hidden shrink-0 mt-1">
                    <img src={ticket.profiles?.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${ticket.profiles?.full_name}&backgroundColor=transparent&textColor=1e3a8a`} className="w-full h-full object-cover p-1" />
                  </div>
                  <div className="flex-1 pr-1">
                    <div className="flex gap-2 items-center mb-1 pr-6">
                      <h3 className="font-black text-brand-dark text-base leading-tight">{ticket.title}</h3>
                      {ticket.urgency === 'דחוף' && <span className="bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-md shadow-sm">דחוף</span>}
                    </div>
                    
                    <p className="text-xs font-bold text-brand-dark/70 mb-1">
                      {ticket.profiles?.full_name} {ticket.profiles?.apartment ? `(דירה ${ticket.profiles.apartment})` : ''} • {new Date(ticket.created_at).toLocaleDateString('he-IL')}
                    </p>
                    
                    {ticket.description && <p className="text-sm text-brand-dark/80 leading-relaxed mb-4 bg-gray-50 p-3 rounded-xl border border-gray-100">{ticket.description}</p>}
                    
                    <div className="flex items-center">
                       <span className={`text-[10px] font-bold px-3 py-1 rounded-lg border shadow-sm ${statusColor}`}>
                         סטטוס: {ticket.status}
                       </span>
                    </div>
                  </div>
                </div>

                {/* כפתורי ניהול סטטוס לוועד בלבד */}
                {isAdmin && ticket.status !== 'טופל' && (
                  <div className="flex gap-2 mt-2 pt-3 border-t border-gray-50">
                    {ticket.status === 'פתוח' && (
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

      {isModalOpen && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex justify-center items-end">
          <div className="bg-white w-full max-w-md rounded-t-3xl p-6 pb-8 shadow-2xl animate-in slide-in-from-bottom-10 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6 sticky top-0 bg-white z-10 pt-2">
              <h3 className="font-black text-lg text-brand-dark">פתיחת קריאת שירות</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 bg-gray-100 rounded-full text-brand-dark hover:bg-gray-200 transition">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            
            <form onSubmit={handleOpenTicket} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-brand-dark mb-1 block">נושא התקלה *</label>
                <input type="text" required value={newTicket.title} onChange={e => setNewTicket({...newTicket, title: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-blue transition shadow-sm text-brand-dark" placeholder="לדוג': נזילה בצינור בלובי" />
              </div>

              <div>
                <label className="text-xs font-bold text-brand-dark mb-1 block">רמת דחיפות</label>
                <select value={newTicket.urgency} onChange={e => setNewTicket({...newTicket, urgency: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-blue transition shadow-sm text-brand-dark">
                  <option value="רגיל">רגיל (יטופל בימים הקרובים)</option>
                  <option value="דחוף">דחוף (סכנה בטיחותית / נזק מיידי)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-brand-dark mb-1 block">פירוט התקלה (אופציונלי)</label>
                <textarea value={newTicket.description} onChange={e => setNewTicket({...newTicket, description: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-blue transition shadow-sm min-h-[80px] text-brand-dark" placeholder="נא לפרט מיקום מדויק של התקלה..."></textarea>
              </div>

              <button type="submit" disabled={isSubmitting} className="w-full bg-brand-blue text-white font-bold py-4 rounded-xl shadow-[0_8px_20px_rgba(0,68,204,0.3)] mt-4 active:scale-95 transition disabled:opacity-50">
                {isSubmitting ? 'שולח...' : 'שדר לוועד הבית'}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}

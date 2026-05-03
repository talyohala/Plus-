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
  const [description, setDescription] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // ניהול ספקים (לוועד)
  const [isAddingVendor, setIsAddingVendor] = useState(false)
  const [newVendor, setNewVendor] = useState({ name: '', profession: '', phone: '' })

  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (!prof || !prof.building_id) return
    setProfile(prof)

    // שליפת תקלות
    let query = supabase.from('service_tickets').select('*, profiles(full_name, apartment)').eq('building_id', prof.building_id).order('created_at', { ascending: false })
    if (activeFilter !== 'הכל') query = query.eq('status', activeFilter)
    const { data: tks } = await query
    if (tks) setTickets(tks)

    // שליפת אנשי מקצוע
    const { data: vnds } = await supabase.from('building_vendors').select('*').eq('building_id', prof.building_id).order('profession')
    if (vnds) setVendors(vnds)
  }, [activeFilter])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleAddVendor = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile?.building_id || !newVendor.name || !newVendor.phone) return
    
    await supabase.from('building_vendors').insert([{
      building_id: profile.building_id,
      ...newVendor
    }])
    
    setNewVendor({ name: '', profession: '', phone: '' })
    setIsAddingVendor(false)
    fetchData()
  }

  const handleDeleteVendor = async (id: string) => {
    if (confirm("להסיר את איש המקצוע מהפנקס?")) {
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

    await supabase.from('service_tickets').insert([{
      building_id: profile.building_id,
      user_id: profile.id,
      title: 'מפענח נתונים...',
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

  const isAdmin = profile?.role === 'admin'

  return (
    <div className="flex flex-col flex-1 w-full pb-24" dir="rtl">
      <div className="px-4 mb-4 mt-2 flex justify-between items-center">
        <h2 className="text-2xl font-black text-brand-dark">ניהול תקלות</h2>
        <button 
          onClick={() => setShowVendors(true)}
          className="bg-brand-blue/10 text-brand-blue px-4 py-2 rounded-2xl text-xs font-black active:scale-95 transition"
        >
          פנקס אנשי מקצוע
        </button>
      </div>

      <div className="px-4 mb-6">
        {!isReporting ? (
          <button onClick={() => setIsReporting(true)} className="w-full bg-white border border-gray-100 rounded-[2rem] p-6 shadow-sm flex items-center gap-4 active:scale-95 transition">
            <div className="w-14 h-14 bg-orange-50 text-orange-500 rounded-full flex items-center justify-center shrink-0">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
            </div>
            <div className="text-right">
              <h3 className="font-black text-brand-dark text-lg">דווח על תקלה חדשה</h3>
              <p className="text-sm text-brand-gray">לחץ לדיווח מהיר לוועד הבית</p>
            </div>
          </button>
        ) : (
          <form onSubmit={handleSubmitReport} className="bg-white border border-brand-blue/20 rounded-[2rem] p-5 shadow-lg">
            <textarea autoFocus value={description} onChange={e => setDescription(e.target.value)} placeholder="מה הבעיה בבניין?" className="w-full bg-gray-50 rounded-2xl p-4 text-sm outline-none resize-none min-h-[100px] mb-3 text-brand-dark" />
            <div className="flex gap-2">
              <button type="submit" disabled={isSubmitting} className="flex-1 bg-brand-blue text-white font-bold rounded-2xl py-3.5 shadow-sm active:scale-95 transition">שדר לוועד</button>
              <button type="button" onClick={() => setIsReporting(false)} className="px-6 bg-gray-100 text-brand-gray font-bold rounded-2xl">ביטול</button>
            </div>
          </form>
        )}
      </div>

      <div className="flex gap-2 px-4 mb-4 overflow-x-auto hide-scrollbar">
        {['פתוח', 'בטיפול', 'טופל', 'הכל'].map(tab => (
          <button key={tab} onClick={() => setActiveFilter(tab)} className={`px-5 py-2 rounded-full text-xs font-bold transition whitespace-nowrap ${activeFilter === tab ? 'bg-brand-dark text-white' : 'bg-white border border-gray-100 text-brand-gray'}`}>
            {tab}
          </button>
        ))}
      </div>

      <div className="space-y-4 px-4">
        {tickets.map(ticket => (
          <div key={ticket.id} className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 flex flex-col gap-2">
             <div className="flex justify-between items-center">
                <span className="text-[10px] font-black text-brand-gray uppercase">{ticket.status}</span>
                <span className="text-[10px] text-gray-400">{new Date(ticket.created_at).toLocaleDateString('he-IL')}</span>
             </div>
             <p className="text-sm font-bold text-brand-dark">{ticket.description}</p>
          </div>
        ))}
      </div>

      {/* מודל פנקס אנשי מקצוע */}
      {showVendors && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-end">
          <div className="bg-white w-full rounded-t-[3rem] p-6 pb-12 shadow-2xl animate-in slide-in-from-bottom-full max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-brand-dark">פנקס אנשי מקצוע</h3>
              <button onClick={() => setShowVendors(false)} className="p-2 bg-gray-100 rounded-full text-brand-dark"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
            </div>

            {isAdmin && !isAddingVendor && (
              <button onClick={() => setIsAddingVendor(true)} className="w-full bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl p-4 text-brand-blue font-bold text-sm mb-6 active:scale-95 transition">
                + הוספת איש מקצוע קבוע
              </button>
            )}

            {isAddingVendor && (
              <form onSubmit={handleAddVendor} className="bg-brand-blue/5 p-4 rounded-2xl mb-6 space-y-3">
                <input type="text" placeholder="שם (לדוג': איציק)" value={newVendor.name} onChange={e => setNewVendor({...newVendor, name: e.target.value})} className="w-full p-3 rounded-xl border border-gray-200 text-sm outline-none" required />
                <input type="text" placeholder="מקצוע (לדוג': אינסטלטור)" value={newVendor.profession} onChange={e => setNewVendor({...newVendor, profession: e.target.value})} className="w-full p-3 rounded-xl border border-gray-200 text-sm outline-none" required />
                <input type="tel" placeholder="מספר טלפון" value={newVendor.phone} onChange={e => setNewVendor({...newVendor, phone: e.target.value})} className="w-full p-3 rounded-xl border border-gray-200 text-sm outline-none text-left" dir="ltr" required />
                <div className="flex gap-2">
                  <button type="submit" className="flex-1 bg-brand-blue text-white font-bold py-3 rounded-xl text-sm">שמירה</button>
                  <button type="button" onClick={() => setIsAddingVendor(false)} className="px-6 bg-gray-200 text-brand-gray font-bold rounded-xl text-sm">ביטול</button>
                </div>
              </form>
            )}

            <div className="space-y-3">
              {vendors.map(v => (
                <div key={v.id} className="bg-gray-50 p-4 rounded-2xl flex items-center justify-between group">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-brand-blue shadow-sm">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                    </div>
                    <div>
                      <h4 className="font-black text-brand-dark text-sm">{v.name}</h4>
                      <p className="text-[11px] font-bold text-brand-blue">{v.profession}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isAdmin && (
                      <button onClick={() => handleDeleteVendor(v.id)} className="p-2 text-red-300 hover:text-red-500 transition">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                      </button>
                    )}
                    <a href={`tel:${v.phone}`} onClick={() => playSystemSound('click')} className="bg-green-500 text-white px-4 py-2.5 rounded-xl text-xs font-black shadow-md active:scale-95 transition flex items-center gap-2">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"></path></svg>
                      חיוג
                    </a>
                  </div>
                </div>
              ))}
              {vendors.length === 0 && <p className="text-center py-10 text-brand-gray text-xs font-bold italic">עדיין לא הוגדרו אנשי מקצוע לבניין.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

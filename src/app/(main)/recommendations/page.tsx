'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import Link from 'next/link'

const categories = ['הכל', 'אינסטלטור', 'חשמלאי', 'טכנאי מזגנים', 'מנקה', 'הנדימן']

export default function RecommendationsPage() {
  const [professionals, setProfessionals] = useState<any[]>([])
  const [activeCategory, setActiveCategory] = useState('הכל')

  useEffect(() => {
    const fetchProfessionals = async () => {
      let query = supabase.from('professionals').select('*').order('rating', { ascending: false })
      if (activeCategory !== 'הכל') {
        query = query.eq('category', activeCategory)
      }
      const { data } = await query
      if (data) setProfessionals(data)
    }
    fetchProfessionals()
  }, [activeCategory])

  return (
    <div className="flex flex-col flex-1 w-full pb-24" dir="rtl">
      
      <div className="px-4 mb-6 mt-2">
        <h2 className="text-2xl font-black text-brand-dark mb-1">אנשי מקצוע מומלצים ⭐</h2>
        <p className="text-xs text-brand-gray font-medium">בלי זיופים - רק המלצות של שכנים מהבניין</p>
      </div>

      {/* סינון קטגוריות - נגלל אופקית */}
      <div className="flex overflow-x-auto hide-scrollbar gap-2 px-4 mb-6 pb-2">
        {categories.map(cat => (
          <button 
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`whitespace-nowrap px-5 py-2 rounded-full text-sm font-bold transition shadow-sm border ${
              activeCategory === cat 
              ? 'bg-brand-blue text-white border-brand-blue' 
              : 'bg-white text-brand-dark border-gray-100 hover:bg-gray-50'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* רשימת בעלי המקצוע */}
      <div className="space-y-4 px-4">
        {professionals.length === 0 ? (
          <div className="text-center py-10 bg-white/50 rounded-3xl border border-gray-100">
            <p className="text-brand-gray font-medium">לא נמצאו המלצות בקטגוריה זו</p>
          </div>
        ) : (
          professionals.map(pro => (
            <div key={pro.id} className="bg-white p-5 rounded-3xl shadow-sm border border-gray-50 flex items-center gap-4 relative overflow-hidden">
              
              {/* עיגול רקע דקורטיבי */}
              <div className="absolute -left-6 -top-6 w-20 h-20 bg-blue-50 rounded-full blur-2xl opacity-50 pointer-events-none"></div>

              <img 
                src={`https://api.dicebear.com/7.x/initials/svg?seed=${pro.name}&backgroundColor=0e1e2d`} 
                alt={pro.name} 
                className="w-14 h-14 rounded-2xl shadow-sm z-10"
              />
              
              <div className="flex-1 z-10">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-black text-brand-dark text-base">{pro.name}</h3>
                    <p className="text-[10px] font-bold text-brand-blue bg-blue-50 px-2 py-0.5 rounded-md inline-block mt-0.5">{pro.category}</p>
                  </div>
                  {/* דירוג כוכבים */}
                  <div className="flex items-center gap-1 bg-orange-50 px-2 py-1 rounded-lg">
                    <span className="font-bold text-xs text-orange-600">{pro.rating}</span>
                    <svg className="w-3.5 h-3.5 text-orange-500" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path></svg>
                  </div>
                </div>
                
                <div className="flex justify-between items-end mt-3">
                  <p className="text-[10px] text-gray-400 font-medium">{pro.reviews_count} שכנים המליצו</p>
                  {/* כפתור חיוג */}
                  <a href={`tel:${pro.phone}`} className="flex items-center gap-1.5 bg-green-500 hover:bg-green-600 text-white px-4 py-1.5 rounded-full text-xs font-bold transition shadow-sm active:scale-95">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
                    חייג
                  </a>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* כפתור "הוסף המלצה" צף */}
      <button className="fixed bottom-24 left-4 z-40 bg-brand-dark text-white p-4 rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition flex items-center gap-2">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
        <span className="font-bold text-sm pr-1">המלץ</span>
      </button>

    </div>
  )
}

'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function Feed() {
  const [posts, setPosts] = useState<any[]>([])

  // פונקציה למשיכת הנתונים הראשונית
  const fetchPosts = async () => {
    const { data } = await supabase
      .from('posts')
      .select(`
        id, content, created_at,
        profiles (full_name, apartment, avatar_url)
      `)
      .order('created_at', { ascending: false })
    if (data) setPosts(data)
  }

  useEffect(() => {
    fetchPosts()

    // יצירת ערוץ האזנה לשינויים בזמן אמת
    const channel = supabase
      .channel('realtime_posts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'posts' },
        () => {
          fetchPosts() // משיכה מחדש כשיש פוסט חדש
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return (
    <>
      <div className="flex justify-between items-end mb-4 px-1 text-right" dir="rtl">
        <h2 className="text-lg font-bold text-brand-dark">פיד הבניין</h2>
        <span className="text-sm text-brand-blue font-bold cursor-pointer hover:underline">הצג הכל</span>
      </div>
      
      <div className="space-y-4" dir="rtl">
        {posts.map((post) => (
          <article key={post.id} className="glass-panel p-5 rounded-3xl relative text-right animate-in fade-in duration-500">
            <div className="flex items-center gap-3 mb-3">
              <img 
                src={post.profiles?.avatar_url || `https://api.dicebear.com/7.x/notionists/svg?seed=${post.id}`} 
                className="w-10 h-10 rounded-full border border-white shadow-sm bg-blue-50" 
              />
              <div>
                <h3 className="font-bold text-sm text-brand-dark flex items-center gap-2">
                  {post.profiles?.full_name || 'שכן'}
                  {post.profiles?.apartment && <span className="text-[10px] bg-brand-blue/10 text-brand-blue px-2 py-0.5 rounded-full">דירה {post.profiles.apartment}</span>}
                </h3>
                <p className="text-xs text-brand-gray">
                  {new Date(post.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
            <p className="text-sm text-brand-dark font-medium mb-4 leading-relaxed">
              {post.content}
            </p>
            <div className="flex gap-4 text-sm text-brand-gray font-medium border-t border-white/50 pt-3">
              <button className="flex items-center gap-1.5 hover:text-brand-blue transition">לייק</button>
              <button className="flex items-center gap-1.5 hover:text-brand-blue transition">הגב</button>
            </div>
          </article>
        ))}
      </div>
    </>
  )
}

'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function Feed() {
  const [posts, setPosts] = useState<any[]>([])
  const [currentUser, setCurrentUser] = useState<any>(null)

  const fetchPosts = async () => {
    const { data } = await supabase
      .from('posts')
      .select(`
        id, content, created_at, user_id,
        profiles (full_name, apartment, avatar_url),
        likes (user_id)
      `)
      .order('created_at', { ascending: false })
    if (data) setPosts(data)
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setCurrentUser(user))
    fetchPosts()

    const channel = supabase.channel('realtime_feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, fetchPosts)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'likes' }, fetchPosts)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const toggleLike = async (post: any) => {
    if (!currentUser) return
    const hasLiked = post.likes.some((l: any) => l.user_id === currentUser.id)
    if (hasLiked) {
      await supabase.from('likes').delete().eq('post_id', post.id).eq('user_id', currentUser.id)
    } else {
      await supabase.from('likes').insert([{ post_id: post.id, user_id: currentUser.id }])
      if (post.user_id !== currentUser.id) {
        await supabase.from('notifications').insert([{ receiver_id: post.user_id, sender_id: currentUser.id, type: 'like', post_id: post.id }])
      }
    }
  }

  return (
    <>
      <div className="flex justify-between items-end mb-4 px-1 text-right" dir="rtl">
        <h2 className="text-lg font-bold text-brand-dark">פיד הבניין</h2>
        <span className="text-sm text-brand-blue font-bold cursor-pointer hover:underline">הצג הכל</span>
      </div>
      
      <div className="space-y-4" dir="rtl">
        {posts.map((post) => {
          const hasLiked = currentUser ? post.likes.some((l: any) => l.user_id === currentUser.id) : false
          return (
            <article key={post.id} className="glass-panel p-5 rounded-3xl relative text-right animate-in fade-in duration-500 bg-white/40">
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
                <button onClick={() => toggleLike(post)} className={`flex items-center gap-1.5 transition ${hasLiked ? 'text-red-500 font-bold' : 'hover:text-brand-blue'}`}>
                  <svg className={`w-5 h-5 ${hasLiked ? 'fill-current' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.514"></path></svg> 
                  {post.likes?.length || 0} לייק
                </button>
                <button className="flex items-center gap-1.5 hover:text-brand-blue transition">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg> 
                  הגב
                </button>
              </div>
            </article>
          )
        })}
      </div>
    </>
  )
}

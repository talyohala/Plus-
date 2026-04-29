'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function Feed() {
  const [posts, setPosts] = useState<any[]>([])
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [activeCommentPost, setActiveCommentPost] = useState<string | null>(null)
  const [commentText, setCommentText] = useState('')

  const fetchPosts = async () => {
    const { data } = await supabase
      .from('posts')
      .select(`
        id, content, created_at, user_id,
        profiles (full_name, apartment, avatar_url),
        likes (user_id),
        comments (id, content, created_at, profiles(full_name, avatar_url))
      `)
      .order('created_at', { ascending: false })
    if (data) setPosts(data)
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setCurrentUser(user))
    fetchPosts()
    const channel = supabase.channel('feed_all').on('postgres_changes', { event: '*', schema: 'public' }, fetchPosts).subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  const toggleLike = async (post: any) => {
    if (!currentUser) return
    const hasLiked = post.likes.some((l: any) => l.user_id === currentUser.id)
    
    if (hasLiked) {
      await supabase.from('likes').delete().eq('post_id', post.id).eq('user_id', currentUser.id)
    } else {
      await supabase.from('likes').insert([{ post_id: post.id, user_id: currentUser.id }])
      // שליחת התראה (רק אם זה לא הפוסט של עצמי)
      if (post.user_id !== currentUser.id) {
        await supabase.from('notifications').insert([{ receiver_id: post.user_id, sender_id: currentUser.id, type: 'like', post_id: post.id }])
      }
    }
  }

  const handleAddComment = async (e: React.FormEvent, post: any) => {
    e.preventDefault()
    if (!commentText.trim() || !currentUser) return
    
    await supabase.from('comments').insert([{ post_id: post.id, user_id: currentUser.id, content: commentText }])
    
    if (post.user_id !== currentUser.id) {
      await supabase.from('notifications').insert([{ receiver_id: post.user_id, sender_id: currentUser.id, type: 'comment', post_id: post.id }])
    }
    setCommentText('')
  }

  return (
    <div className="space-y-4" dir="rtl">
      {posts.map((post) => {
        const hasLiked = currentUser ? post.likes.some((l: any) => l.user_id === currentUser.id) : false
        return (
          <article key={post.id} className="glass-panel p-5 rounded-3xl relative text-right bg-white/40 border border-white/20">
            <div className="flex items-center gap-3 mb-3">
              <img src={post.profiles?.avatar_url || `https://api.dicebear.com/7.x/notionists/svg?seed=${post.id}`} className="w-10 h-10 rounded-full border border-white" />
              <div>
                <h3 className="font-bold text-sm text-brand-dark flex items-center gap-2">
                  {post.profiles?.full_name || 'שכן'}
                  {post.profiles?.apartment && <span className="text-[10px] bg-brand-blue/10 text-brand-blue px-2 py-0.5 rounded-full">דירה {post.profiles.apartment}</span>}
                </h3>
                <p className="text-xs text-brand-gray">{new Date(post.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            </div>
            <p className="text-sm text-brand-dark font-medium mb-4">{post.content}</p>
            <div className="flex gap-4 text-sm font-bold border-t border-white/60 pt-3">
              <button onClick={() => toggleLike(post)} className={`flex items-center gap-1.5 ${hasLiked ? 'text-red-500' : 'text-brand-gray'}`}>
                <svg className="w-5 h-5" fill={hasLiked ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg>
                {post.likes?.length || 0}
              </button>
              <button onClick={() => setActiveCommentPost(activeCommentPost === post.id ? null : post.id)} className="flex items-center gap-1.5 text-brand-gray">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>
                {post.comments?.length || 0}
              </button>
            </div>
            {activeCommentPost === post.id && (
              <div className="mt-4 pt-4 border-t border-white/60 space-y-3">
                {post.comments?.map((c: any) => (
                  <div key={c.id} className="text-sm bg-white/30 p-2 rounded-xl flex gap-2">
                    <img src={c.profiles?.avatar_url} className="w-5 h-5 rounded-full" />
                    <span><span className="font-bold">{c.profiles?.full_name}:</span> {c.content}</span>
                  </div>
                ))}
                <form onSubmit={(e) => handleAddComment(e, post)} className="flex gap-2">
                  <input type="text" value={commentText} onChange={e => setCommentText(e.target.value)} placeholder="הגב..." className="flex-1 p-2 bg-white/60 rounded-full border border-white text-xs outline-none" />
                  <button type="submit" className="bg-brand-blue text-white px-4 rounded-full text-xs font-bold">שלח</button>
                </form>
              </div>
            )}
          </article>
        )
      })}
    </div>
  )
}

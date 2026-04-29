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
        id, content, created_at,
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

    const channel = supabase
      .channel('feed_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, fetchPosts)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'likes' }, fetchPosts)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, fetchPosts)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const toggleLike = async (postId: string, likes: any[]) => {
    if (!currentUser) return
    const hasLiked = likes.some(like => like.user_id === currentUser.id)
    
    if (hasLiked) {
      await supabase.from('likes').delete().eq('post_id', postId).eq('user_id', currentUser.id)
    } else {
      await supabase.from('likes').insert([{ post_id: postId, user_id: currentUser.id }])
    }
  }

  const handleAddComment = async (e: React.FormEvent, postId: string) => {
    e.preventDefault()
    if (!commentText.trim() || !currentUser) return
    
    await supabase.from('comments').insert([{ post_id: postId, user_id: currentUser.id, content: commentText }])
    setCommentText('')
  }

  return (
    <>
      <div className="flex justify-between items-end mb-4 px-1 text-right" dir="rtl">
        <h2 className="text-lg font-bold text-brand-dark">פיד הבניין</h2>
      </div>
      
      <div className="space-y-4" dir="rtl">
        {posts.map((post) => {
          const hasLiked = currentUser ? post.likes.some((l: any) => l.user_id === currentUser.id) : false
          
          return (
            <article key={post.id} className="glass-panel p-5 rounded-3xl relative text-right animate-in fade-in duration-500 bg-white/40">
              <div className="flex items-center gap-3 mb-3">
                <img src={post.profiles?.avatar_url || `https://api.dicebear.com/7.x/notionists/svg?seed=${post.id}`} className="w-10 h-10 rounded-full border border-white shadow-sm bg-blue-50" />
                <div>
                  <h3 className="font-bold text-sm text-brand-dark flex items-center gap-2">
                    {post.profiles?.full_name || 'שכן'}
                    {post.profiles?.apartment && <span className="text-[10px] bg-brand-blue/10 text-brand-blue px-2 py-0.5 rounded-full">דירה {post.profiles.apartment}</span>}
                  </h3>
                  <p className="text-xs text-brand-gray">{new Date(post.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>
              
              <p className="text-sm text-brand-dark font-medium mb-4 leading-relaxed">{post.content}</p>
              
              {/* כפתורי לייק ותגובה */}
              <div className="flex gap-4 text-sm font-bold border-t border-white/60 pt-3">
                <button onClick={() => toggleLike(post.id, post.likes)} className={`flex items-center gap-1.5 transition ${hasLiked ? 'text-red-500' : 'text-brand-gray hover:text-red-400'}`}>
                  <svg className={`w-5 h-5 ${hasLiked ? 'fill-current' : 'fill-none'}`} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg>
                  <span>{post.likes?.length > 0 && post.likes.length} לייק</span>
                </button>
                <button onClick={() => setActiveCommentPost(activeCommentPost === post.id ? null : post.id)} className="flex items-center gap-1.5 text-brand-gray hover:text-brand-blue transition">
                  <svg className="w-5 h-5 fill-none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>
                  <span>{post.comments?.length > 0 && post.comments.length} הגב</span>
                </button>
              </div>

              {/* אזור התגובות */}
              {activeCommentPost === post.id && (
                <div className="mt-4 pt-4 border-t border-white/60 space-y-3">
                  {post.comments?.map((comment: any) => (
                    <div key={comment.id} className="flex gap-2 text-sm bg-white/30 p-2 rounded-2xl">
                      <img src={comment.profiles?.avatar_url} className="w-6 h-6 rounded-full" />
                      <div>
                        <span className="font-bold text-brand-dark ml-2">{comment.profiles?.full_name}</span>
                        <span className="text-brand-dark/80">{comment.content}</span>
                      </div>
                    </div>
                  ))}
                  <form onSubmit={(e) => handleAddComment(e, post.id)} className="flex gap-2 mt-2">
                    <input type="text" value={commentText} onChange={e => setCommentText(e.target.value)} placeholder="הוסף תגובה..." className="flex-1 p-2 px-4 rounded-full bg-white/60 border border-white outline-none focus:border-brand-blue text-sm" />
                    <button type="submit" disabled={!commentText.trim()} className="bg-brand-blue text-white px-4 rounded-full text-sm font-bold disabled:opacity-50 hover:bg-blue-600 transition">שלח</button>
                  </form>
                </div>
              )}
            </article>
          )
        })}
      </div>
    </>
  )
}

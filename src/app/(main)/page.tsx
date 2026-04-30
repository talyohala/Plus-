'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import QuickActions from '../../components/home/QuickActions'

export default function HomePage() {
  const [profile, setProfile] = useState<any>(null)
  const [posts, setPosts] = useState<any[]>([])
  const [newPostContent, setNewPostContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [activeCommentPost, setActiveCommentPost] = useState<string | null>(null)
  const [commentContent, setCommentContent] = useState('')
  const [openMenuPostId, setOpenMenuPostId] = useState<string | null>(null)
  const [editingPostId, setEditingPostId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')

  const fetchData = async (user: any) => {
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (prof) setProfile(prof)

    const { data } = await supabase
      .from('posts')
      .select('*, profiles(full_name, avatar_url, role), likes(id, user_id), comments(id, content, created_at, user_id, profiles(full_name, avatar_url))')
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
    if (data) setPosts(data)
  }

  useEffect(() => {
    let currentUser: any = null
    supabase.auth.getUser().then(({ data: { user } }) => {
      currentUser = user
      if (user) fetchData(user)
    })

    const channel = supabase.channel('feed_realtime_v3')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => currentUser && fetchData(currentUser))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'likes' }, () => currentUser && fetchData(currentUser))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, () => currentUser && fetchData(currentUser))
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPostContent.trim() || !profile) return
    setIsSubmitting(true)
    await supabase.from('posts').insert([{ user_id: profile.id, content: newPostContent }])
    setNewPostContent('')
    setIsSubmitting(false)
  }

  const handleEditSubmit = async (e: React.FormEvent, postId: string) => {
    e.preventDefault()
    if (!editContent.trim()) return
    await supabase.from('posts').update({ content: editContent }).eq('id', postId)
    setEditingPostId(null)
    setOpenMenuPostId(null)
  }

  // --- שדרוג התראות ללייקים ---
  const toggleLike = async (post: any, isLiked: boolean, likeId?: string) => {
    if (!profile) return
    if (isLiked && likeId) {
      await supabase.from('likes').delete().eq('id', likeId)
    } else {
      await supabase.from('likes').insert([{ post_id: post.id, user_id: profile.id }])
      
      // שליחת התראה לבעל הפוסט (אם זה לא אני עצמי שעשיתי לייק לעצמי)
      if (post.user_id !== profile.id) {
        await supabase.from('notifications').insert([{
          receiver_id: post.user_id,
          sender_id: profile.id,
          type: 'post',
          title: 'לייק חדש',
          content: 'אהב/ה את הפוסט שלך',
          link: '/'
        }])
      }
    }
  }

  // --- שדרוג התראות לתגובות ---
  const handleAddComment = async (e: React.FormEvent, post: any) => {
    e.preventDefault()
    if (!commentContent.trim() || !profile) return
    
    await supabase.from('comments').insert([{ post_id: post.id, user_id: profile.id, content: commentContent }])
    
    // שליחת התראה לבעל הפוסט
    if (post.user_id !== profile.id) {
      await supabase.from('notifications').insert([{
        receiver_id: post.user_id,
        sender_id: profile.id,
        type: 'post',
        title: 'תגובה חדשה',
        content: `הגיב/ה: "${commentContent.substring(0, 20)}${commentContent.length > 20 ? '...' : ''}"`,
        link: '/'
      }])
    }
    
    setCommentContent('')
  }

  const togglePin = async (id: string, currentStatus: boolean) => {
    await supabase.from('posts').update({ is_pinned: !currentStatus }).eq('id', id)
    setOpenMenuPostId(null)
  }

  const handleDeletePost = async (id: string) => {
    if(confirm("האם למחוק את הפוסט?")) {
      await supabase.from('posts').delete().eq('id', id)
      setOpenMenuPostId(null)
    }
  }

  const isAdmin = profile?.role === 'admin'

  return (
    <div className="flex flex-col flex-1 w-full pb-24 relative" dir="rtl">
      <QuickActions />
      <div className="px-4 mb-6">
        <div className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 flex gap-3 items-start">
          <img src={profile?.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${profile?.full_name}&backgroundColor=0e1e2d`} className="w-10 h-10 rounded-full border border-gray-100 shrink-0" />
          <form onSubmit={handleCreatePost} className="flex-1 flex flex-col gap-2">
            <textarea
              value={newPostContent}
              onChange={e => setNewPostContent(e.target.value)}
              placeholder="מה קורה בבניין?..."
              className="w-full bg-transparent text-sm outline-none resize-none min-h-[40px] text-brand-dark"
            />
            <div className="flex justify-end">
              <button type="submit" disabled={isSubmitting || !newPostContent.trim()} className="bg-brand-blue text-white px-5 py-1.5 rounded-xl text-xs font-bold active:scale-95 disabled:opacity-50 shadow-sm transition">
                {isSubmitting ? 'מפרסם...' : 'שתף קהילה'}
              </button>
            </div>
          </form>
        </div>
      </div>
      <div className="space-y-4 px-4">
        {posts.map(post => {
          const myLike = post.likes?.find((l: any) => l.user_id === profile?.id)
          const isLiked = !!myLike
          const isOwner = profile?.id === post.user_id
          return (
            <div key={post.id} className={`bg-white p-5 rounded-3xl shadow-sm border flex flex-col relative transition-all ${post.is_pinned ? 'border-brand-blue/30 shadow-[0_4px_20px_rgba(0,68,204,0.1)]' : 'border-gray-50'}`}>
              {post.is_pinned && (
                <div className="absolute top-0 right-4 bg-brand-blue text-white text-[10px] font-black px-3 py-1 rounded-b-lg shadow-sm flex items-center gap-1 z-10">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z"></path></svg>
                  נעוץ מנהל
                </div>
              )}
              {(isOwner || isAdmin) && (
                <div className="absolute top-4 left-4 z-20">
                  <div className="relative">
                    <button onClick={() => setOpenMenuPostId(openMenuPostId === post.id ? null : post.id)} className="p-2 text-brand-gray hover:bg-gray-100 rounded-full transition">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"></path></svg>
                    </button>
                    {openMenuPostId === post.id && (
                      <div className="absolute left-0 mt-1 w-36 bg-white border border-gray-100 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] overflow-hidden z-30">
                        {isAdmin && (
                          <button onClick={() => togglePin(post.id, post.is_pinned)} className="w-full text-right px-4 py-3 text-xs font-bold text-brand-dark hover:bg-gray-50 flex items-center gap-2">
                            <svg className="w-4 h-4 text-brand-blue" fill="currentColor" viewBox="0 0 20 20"><path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z"></path></svg>
                            {post.is_pinned ? 'בטל נעיצה' : 'נעץ פוסט'}
                          </button>
                        )}
                        {isOwner && (
                          <button onClick={() => { setEditingPostId(post.id); setEditContent(post.content); setOpenMenuPostId(null); }} className="w-full text-right px-4 py-3 text-xs font-bold text-brand-dark hover:bg-gray-50 flex items-center gap-2 border-t border-gray-50">
                            <svg className="w-4 h-4 text-brand-gray" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                            ערוך פוסט
                          </button>
                        )}
                        {(isOwner || isAdmin) && (
                          <button onClick={() => handleDeletePost(post.id)} className="w-full text-right px-4 py-3 text-xs font-bold text-red-500 hover:bg-red-50 flex items-center gap-2 border-t border-gray-50">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                            מחק פוסט
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div className={`flex items-center gap-3 mb-3 ${post.is_pinned ? 'mt-2' : ''}`}>
                <img src={post.profiles?.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${post.profiles?.full_name}&backgroundColor=0e1e2d`} className="w-10 h-10 rounded-full border border-gray-100" />
                <div>
                  <p className="text-sm font-bold text-brand-dark flex items-center gap-1.5">
                    {post.profiles?.full_name}
                    {post.profiles?.role === 'admin' && <span className="text-[9px] bg-brand-blue/10 text-brand-blue px-1.5 py-0.5 rounded-md">מנהל ועד</span>}
                  </p>
                  <p className="text-[10px] text-brand-gray">{new Date(post.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })} • {new Date(post.created_at).toLocaleDateString('he-IL')}</p>
                </div>
              </div>
              {editingPostId === post.id ? (
                <form onSubmit={(e) => handleEditSubmit(e, post.id)} className="mb-4">
                  <textarea
                    value={editContent}
                    onChange={e => setEditContent(e.target.value)}
                    className="w-full bg-gray-50 border border-brand-blue/30 rounded-xl p-3 text-sm outline-none focus:border-brand-blue transition min-h-[60px]"
                  />
                  <div className="flex justify-end gap-2 mt-2">
                    <button type="button" onClick={() => setEditingPostId(null)} className="px-4 py-1.5 text-xs font-bold text-gray-500 hover:bg-gray-100 rounded-lg transition">ביטול</button>
                    <button type="submit" className="px-4 py-1.5 text-xs font-bold text-white bg-brand-blue rounded-lg shadow-sm transition active:scale-95">שמור עריכה</button>
                  </div>
                </form>
              ) : (
                <p className="text-sm text-brand-dark/90 leading-relaxed mb-4 whitespace-pre-wrap">{post.content}</p>
              )}
              <div className="flex items-center gap-4 pt-3 border-t border-gray-50">
                <button onClick={() => toggleLike(post, isLiked, myLike?.id)} className={`flex items-center gap-1.5 text-xs font-bold transition active:scale-95 ${isLiked ? 'text-red-500' : 'text-gray-400 hover:text-red-400'}`}>
                  <svg className="w-5 h-5" fill={isLiked ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg>
                  {post.likes?.length || 0}
                </button>
                <button onClick={() => setActiveCommentPost(activeCommentPost === post.id ? null : post.id)} className="flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-brand-blue transition active:scale-95">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>
                  {post.comments?.length || 0} תגובות
                </button>
              </div>
              {activeCommentPost === post.id && (
                <div className="mt-4 pt-4 border-t border-gray-50 flex flex-col gap-3">
                  {post.comments?.map((c: any) => (
                    <div key={c.id} className="flex gap-2 items-start">
                      <img src={c.profiles?.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${c.profiles?.full_name}&backgroundColor=0e1e2d`} className="w-6 h-6 rounded-full shrink-0 mt-0.5" />
                      <div className="bg-gray-50 rounded-2xl rounded-tr-none px-3 py-2 flex-1">
                        <p className="text-[10px] font-bold text-brand-dark flex items-center gap-1">{c.profiles?.full_name}</p>
                        <p className="text-xs text-brand-dark/80 mt-0.5">{c.content}</p>
                      </div>
                    </div>
                  ))}
                  <form onSubmit={(e) => handleAddComment(e, post)} className="flex items-center gap-2 mt-1">
                    <input type="text" value={commentContent} onChange={e => setCommentContent(e.target.value)} placeholder="הוסף תגובה..." className="flex-1 bg-gray-50 border border-gray-100 rounded-full px-4 py-2.5 text-xs outline-none focus:border-brand-blue text-brand-dark transition" />
                    <button type="submit" disabled={!commentContent.trim()} className="bg-brand-blue text-white p-2.5 rounded-full disabled:opacity-50 active:scale-95 transition shadow-sm">
                      <svg className="w-4 h-4 transform -rotate-45 translate-x-[1px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
                    </button>
                  </form>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { UserRound, Plus, Check, MessageCircle, Trash2, MapPin, Grid3X3, Pencil } from 'lucide-react'
import { socialClient } from '../../lib/socialClient'
import { categories } from '../../lib/categories'

export default function ProfilePage({user}) {
  const {username} = useParams()
  const navigate = useNavigate()
  const [profile,setProfile] = useState(null)
  const [error,setError] = useState('')
  const [busy,setBusy] = useState(false)
  const [adding,setAdding] = useState(false)
  const [category,setCategory] = useState('')
  const [deleting,setDeleting] = useState(null)
  const [confirmDelete,setConfirmDelete] = useState(null)
  useEffect(() => {
    let active = true
    setProfile(null);setError('');setAdding(false)
    async function load(){
      try {
        let name = username
        if(name === 'me'){
          if(!user){navigate('/login',{replace:true});return}
          const me = await socialClient.myProfile(user.id)
          if(me.error)throw new Error(me.error.message)
          name = me.data.username
        }
        const result = await socialClient.profile(name)
        if(result.error)throw new Error(result.error.message)
        const stats = await socialClient.artistSocial(result.data.id,user?.id)
        if(stats.error)throw new Error(stats.error.message)
        if(active)setProfile({...result.data,...stats.data,is_following:stats.data.following})
      }catch(e){if(active)setError(e.message)}
    }
    load();return () => {active = false}
  },[username,user?.id,navigate])
  if(!profile)return <div className="page empty">{error || 'Loading profile…'}</div>
  const own = user?.id === profile.id
  const arts = categories.filter(c => c === profile.artist?.category || profile.artist?.tags?.includes(c))
  const available = categories.filter(c => !arts.includes(c))
  const removePost = async postId => {
    setDeleting(postId);setError('')
    try {
      const result = await socialClient.deletePost(postId)
      if(result.error)throw new Error(result.error.message)
      setProfile(current => ({...current,posts:current.posts.filter(post => post.id !== postId)}))
      setConfirmDelete(null)
    } catch(e) { setError(e.message) }
    finally { setDeleting(null) }
  }
  const follow = async () => {
    if(!user){navigate('/login');return}
    setBusy(true);setError('')
    const before = profile
    setProfile({...profile,is_following:!profile.is_following,follower_count:profile.follower_count+(profile.is_following?-1:1)})
    try{const r = await socialClient.setFollowing(profile.id,user.id,!profile.is_following);if(r.error)throw new Error(r.error.message)}catch(e){setProfile(before);setError(e.message)}finally{setBusy(false)}
  }
  const add = async e => {
    e.preventDefault();setBusy(true);setError('')
    try{const r=await socialClient.addArt(user.id,category);if(r.error)throw new Error(r.error.message);setProfile({...profile,artist:r.data});setAdding(false);setCategory('')}catch(e){setError(e.message)}finally{setBusy(false)}
  }
  return <div className="profile-page page"><section className="profile-header">
    {profile.avatar_url || profile.artist?.profile_image_url ? <img src={profile.avatar_url || profile.artist.profile_image_url} alt={profile.display_name || 'Profile'}/> : <div className="profile-placeholder"><UserRound size={48}/></div>}
    <div className="profile-identity"><p className="kicker">@{profile.username}</p><h1>{profile.display_name || profile.full_name || 'Your profile'}</h1>{profile.bio && <p className="profile-bio">{profile.bio}</p>}{profile.city && <span className="profile-city"><MapPin size={16}/>{profile.city}</span>}<div className="art-badges">{arts.map(art => <span key={art}>{art}</span>)}</div><div className="profile-counts"><b>{profile.posts.length}<small>Posts</small></b><b aria-live="polite">{profile.follower_count}<small>Followers</small></b></div></div>
    <div className="profile-actions">{own ? <><Link className="button outline" to="/profile/edit"><Pencil size={16}/>Edit profile</Link><Link className="button outline" to="/messages"><MessageCircle size={18}/>Messages</Link></> : <button className={`button ${profile.is_following?'outline':''}`} disabled={busy} onClick={follow} aria-pressed={profile.is_following}>{profile.is_following && <Check size={18}/>} {profile.is_following?'Unfollow':'Follow'}</button>}</div>
    </section>{error && <p role="alert" className="form-error">{error}</p>}
    {profile.artist && <section className="profile-listing"><div><div className="art-badges">{arts.map(art => <span key={art}>{art}</span>)}</div><h2>{profile.artist.name}</h2><p>{profile.artist.bio}</p></div><Link className="button" to={`/artists/${profile.artist.id}`}>View & book</Link></section>}
    <section className="profile-posts-section"><div className="profile-posts-toolbar"><div><p className="kicker">The collection</p><h2><Grid3X3 size={23}/>Posts <span className="profile-post-total">{profile.posts.length}</span></h2><p className="profile-posts-description">{own ? 'Your moments, your performances, your work.' : 'A closer look at the person behind the performance.'}</p></div>{own && (profile.artist ? <button className="button" disabled={!available.length} onClick={() => setAdding(!adding)}><Plus size={18}/>Add art</button> : <Link className="button" to="/list-yourself"><Plus size={18}/>List your art</Link>)}</div>
      {adding && <form className="add-art-form" onSubmit={add}><label>Choose your art<select value={category} onChange={e => setCategory(e.target.value)} required><option value="">Select a category</option>{available.map(c => <option key={c}>{c}</option>)}</select></label><button className="button" disabled={busy || !category}>Add badge</button><button className="button outline" type="button" onClick={() => setAdding(false)}>Cancel</button></form>}
      <div className="profile-grid">{profile.posts.map(post => <article className="profile-post-item" key={post.id}>
        {post.media_type === 'video' ? <video src={post.post_media?.[0]?.url} controls preload="metadata"/> : <img src={post.post_media?.[0]?.url} alt={post.caption || 'Performance post'} loading="lazy"/>}
        {own && post.author_id === user.id && <div className="profile-post-controls">{confirmDelete === post.id ? <><p>Delete this post? This cannot be undone.</p><div><button disabled={!!deleting} onClick={() => removePost(post.id)}>{deleting === post.id ? 'Deleting…' : 'Delete post'}</button><button disabled={!!deleting} onClick={() => setConfirmDelete(null)}>Cancel</button></div></> : <button onClick={() => setConfirmDelete(post.id)}><Trash2 size={15}/>Delete post</button>}</div>}
      </article>)}</div>{!profile.posts.length && <div className="empty"><p>No posts yet.</p></div>}
    </section></div>
}

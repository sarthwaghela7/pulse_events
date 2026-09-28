import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, CalendarDays, MapPin, Star, X, MessageCircle, UserPlus, Check, Grid3X3, Play, Layers, Heart } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { authClient, dataClient } from '../lib/dataClient'
import { socialClient } from '../lib/socialClient'
import { categories, categoryFields } from '../lib/categories'

const fallback = 'https://images.unsplash.com/photo-1524650359799-842906ca1c06?auto=format&fit=crop&w=1400&q=85'

export default function ArtistDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [artist, setArtist] = useState(null)
  const [user, setUser] = useState(null)
  const [error, setError] = useState('')
  const [socialError, setSocialError] = useState('')
  const [social, setSocial] = useState({ posts: [], follower_count: 0, following: false })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [selected, setSelected] = useState(null)
  const [mediaIndex, setMediaIndex] = useState(0)
  const dialog = useRef(null)

  useEffect(() => {
    let active = true
    setArtist(null); setError(''); setSocialError(''); setLoading(true)
    async function load() {
      try {
        const [result, auth] = await Promise.all([dataClient.getArtist(id), authClient.getSession()])
        if (!active) return
        if (result.error) { setError(result.error.message); return }
        const viewer = auth.data?.session?.user
        setArtist(result.data); setUser(viewer || null)
        const response = await socialClient.artistSocial(result.data.user_id, viewer?.id)
        if (!active) return
        if (response.error) setSocialError(response.error.message)
        else setSocial(response.data)
      } catch (e) { if (active) setSocialError(e.message) }
      finally { if (active) setLoading(false) }
    }
    load()
    return () => { active = false }
  }, [id])

  useEffect(() => {
    if (!selected) return
    const previous = document.activeElement
    dialog.current?.showModal()
    return () => { dialog.current?.close(); previous?.focus() }
  }, [selected])

  async function follow() {
    if (!user) { navigate('/login'); return }
    const before = social
    const following = !social.following
    setBusy('follow'); setSocialError('')
    setSocial({ ...social, following, follower_count: Math.max(0, social.follower_count + (following ? 1 : -1)) })
    try {
      const response = await socialClient.setFollowing(artist.user_id, user.id, following)
      if (response.error) throw new Error(response.error.message)
    } catch (e) { setSocial(before); setSocialError(e.message) }
    finally { setBusy('') }
  }

  async function message() {
    if (!user) { navigate('/login'); return }
    setBusy('message'); setSocialError('')
    try {
      const response = await socialClient.startArtistConversation(artist, user)
      if (response.error) throw new Error(response.error.message)
      navigate(`/messages/${response.data.id}`)
    } catch (e) { setSocialError(e.message) }
    finally { setBusy('') }
  }

  if (error) return <div className="notice page"><h2>Artist not found</h2><p>{error}</p><Link to="/">All artists</Link></div>
  if (!artist) return <div className="page artist-profile-loading" aria-busy="true">Loading artist profile…</div>

  const own = user?.id === artist.user_id
  const portfolio = artist.artist_media || []
  const posts = social.posts.map(post => ({ ...post, media: [...(post.post_media || [])].sort((a,b) => a.position - b.position) }))
  const items = [...posts, ...portfolio.map(item => ({ id: `portfolio-${item.id}`, caption: `${artist.name} · Portfolio`, media: [{ url: item.media_url, kind: item.media_type }], portfolio: true }))]
  const currentMedia = selected?.media[mediaIndex]

  return <div className="artist-profile page">
    <Link to="/" className="back"><ArrowLeft size={17}/> All artists</Link>
    <section className="artist-profile-hero">
      <div className="artist-profile-photo"><img src={artist.profile_image_url || fallback} alt={artist.name}/><span>{artist.category}</span></div>
      <div className="artist-profile-info">
        <p className="kicker">Meet your next headliner</p>
        <h1>{artist.name}</h1>
        <div className="art-badges">{categories.filter(c => c === artist.category || artist.tags?.includes(c)).map(c => <span key={c}>{c}</span>)}</div>
        <div className="artist-profile-meta"><span><MapPin size={17}/>{artist.city || 'Worldwide'}</span><span><Star size={17} fill="currentColor"/>{Number(artist.rating) > 0 ? Number(artist.rating).toFixed(1) : 'New artist'}</span></div>
        <p className="artist-profile-bio">{artist.bio || 'An unforgettable performer ready to bring your event to life.'}</p>
        <div className="artist-profile-stats"><span><strong>{loading ? '—' : socialError && !social.follower_count ? '—' : social.follower_count.toLocaleString()}</strong> followers</span><span><strong>{loading ? '—' : posts.length}</strong> posts</span></div>
        <div className="artist-social-actions">{own ? <Link className="button outline" to="/list-yourself">Edit listing</Link> : <><button className={`button ${social.following ? 'outline' : ''}`} onClick={follow} disabled={!!busy || loading} aria-pressed={social.following}>{social.following ? <Check size={18}/> : <UserPlus size={18}/>} {social.following ? 'Following' : 'Follow'}</button><button className="button outline" onClick={message} disabled={!!busy}><MessageCircle size={18}/>{busy === 'message' ? 'Opening…' : 'Message'}</button></>}</div>
        {socialError && <p className="form-error" role="alert">{socialError}</p>}
        {!!artist.tags?.length && <div className="tags">{artist.tags.map(t => <span key={t}>{t}</span>)}</div>}
        <div className="performance-details">{(categoryFields[artist.category] || []).filter(field => artist.details?.[field.key]).map(field => <div key={field.key}><small>{field.label}</small><strong>{artist.details[field.key]}</strong></div>)}</div>
        <div className="artist-booking"><div><small>Starting from</small><strong>{artist.price_per_event ? `₹${Number(artist.price_per_event).toLocaleString('en-IN')}` : 'On request'}</strong><small>per event</small></div><Link className="button" to={`/artists/${id}/book`}>Check availability <CalendarDays size={18}/></Link></div>
      </div>
    </section>
    <section className="artist-posts" aria-label={`Posts from ${artist.name}`}>
      <div className="artist-posts-heading"><p className="kicker">On and off the stage</p><h2><Grid3X3 size={24}/> Posts & portfolio</h2><p>A closer look at {artist.name}’s work.</p></div>
      {loading ? <div className="artist-post-grid" aria-busy="true">{[1,2,3].map(i => <div className="skeleton" key={i}/>)}</div> : items.length ? <div className="artist-post-grid">{items.map(post => <button className="artist-post-tile" key={post.id} onClick={() => { setMediaIndex(0); setSelected(post) }} aria-label={`Open ${post.caption || 'performance post'}`}>
        {post.media[0]?.kind === 'video' ? <video src={post.media[0].url} preload="metadata" muted playsInline/> : <img src={post.media[0]?.url || fallback} alt={post.caption || `${artist.name} performance`} loading="lazy"/>}
        <span className="artist-post-type">{post.media[0]?.kind === 'video' ? <Play size={18}/> : post.media.length > 1 ? <Layers size={18}/> : <Grid3X3 size={16}/>}</span>
        <span className="artist-post-caption">{post.caption}{!post.portfolio && <small><Heart size={14}/> {post.like_count || 0}</small>}</span>
      </button>)}</div> : <div className="empty bordered"><h3>The next great moment is on its way.</h3><p>No posts yet. Follow {artist.name} to stay connected.</p></div>}
    </section>
    {selected && <dialog ref={dialog} className="artist-post-dialog" onCancel={() => setSelected(null)} onClick={event => { if (event.target === event.currentTarget) setSelected(null) }}>
      <button className="media-close" onClick={() => setSelected(null)} aria-label="Close post"><X/></button>
      {currentMedia?.kind === 'video' ? <video src={currentMedia.url} controls autoPlay/> : <img src={currentMedia?.url} alt={selected.caption || `${artist.name} performance`}/>}
      <p>{selected.caption}</p>{selected.media.length > 1 && <div className="artist-post-pagination"><button onClick={() => setMediaIndex(i => i-1)} disabled={mediaIndex === 0}>Previous</button><span>{mediaIndex+1} / {selected.media.length}</span><button onClick={() => setMediaIndex(i => i+1)} disabled={mediaIndex === selected.media.length-1}>Next</button></div>}
    </dialog>}
  </div>
}

import { useCallback, useEffect, useState } from 'react'
import { ArrowRight, CalendarDays, Camera, Check, ImagePlus, MapPin, Trash2, X } from 'lucide-react'
import { Link, Navigate } from 'react-router-dom'
import { dataClient } from '../lib/dataClient'
import { categories, categoryFields } from '../lib/categories'

const emptyForm = { name: '', category: '', bio: '', city: '', price_per_event: '', profile_image_url: '', tags: '', details: {} }

export default function ArtistDashboard({ user }) {
  const [listing, setListing] = useState(null)
  const [requests, setRequests] = useState([])
  const [portfolio, setPortfolio] = useState([])
  const [mediaFile, setMediaFile] = useState(null)
  const [mediaBusy, setMediaBusy] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    if (!user) return
    const artistResult = await dataClient.ownedArtists(user.id)
    if (artistResult.error) { setError(artistResult.error.message); setLoading(false); return }
    const owned = artistResult.data || []
    setListing(owned[0] || null)
    if (owned.length) {
      const mediaResult = await dataClient.listArtistMedia(owned[0].id)
      if (mediaResult.error) setError(mediaResult.error.message)
      else setPortfolio(mediaResult.data || [])
      const bookingResult = await dataClient.artistRequests(owned.map(item => item.id))
      if (bookingResult.error) setError(bookingResult.error.message)
      else setRequests(bookingResult.data || [])
    } else { setRequests([]); setPortfolio([]) }
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (!photoFile) { setPhotoPreview(''); return }
    const url = URL.createObjectURL(photoFile)
    setPhotoPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [photoFile])

  if (!user) return <Navigate to="/login" state={{ from: '/list-yourself' }} replace/>

  const edit = () => {
    if (!listing) return
    setForm({ ...listing, price_per_event: listing.price_per_event ?? '', tags: (listing.tags || []).join(', '), details: listing.details || {} })
    setPhotoFile(null); setShowForm(true); setError('')
    requestAnimationFrame(() => document.getElementById('listing-form')?.scrollIntoView({ behavior: 'smooth' }))
  }

  const save = async event => {
    event.preventDefault()
    if (!form.category) { setError('Choose a category.'); return }
    setSaving(true); setError(''); setNotice('')
    let photoUrl = form.profile_image_url || null
    if (photoFile) {
      const upload = await dataClient.uploadProfilePhoto(photoFile, user.id)
      if (upload.error) { setError(upload.error.message); setSaving(false); return }
      photoUrl = upload.data
    }
    const payload = {
      user_id: user.id, name: form.name.trim(), category: form.category,
      bio: form.bio.trim(), city: form.city.trim(),
      price_per_event: form.price_per_event === '' ? null : Number(form.price_per_event),
      profile_image_url: photoUrl,
      tags: form.tags.split(',').map(tag => tag.trim()).filter(Boolean),
      details: Object.fromEntries(categoryFields[form.category].map(field => [field.key, (form.details?.[field.key] || '').trim()])),
    }
    const { error: saveError } = await dataClient.saveArtist(payload, listing?.id)
    setSaving(false)
    if (saveError) { setError(saveError.message); return }
    setNotice(listing ? 'Your listing has been updated.' : 'Your listing is live in the chosen category.')
    setShowForm(false); setPhotoFile(null); setForm(emptyForm)
    await load()
  }

  const decide = async (bookingId, status) => {
    setBusyId(bookingId); setError(''); setNotice('')
    const { error: decisionError } = await dataClient.respondToBooking(bookingId, status, user.id)
    setBusyId(null)
    if (decisionError) { setError(decisionError.message); return }
    setNotice(status === 'confirmed' ? 'Booking confirmed.' : 'Booking declined.')
    await load()
  }

  const postMedia = async event => {
    event.preventDefault()
    if (!mediaFile || !listing) return
    const uploadForm = event.currentTarget
    setMediaBusy(true); setError(''); setNotice('')
    const uploaded = await dataClient.addArtistMedia(mediaFile, listing.id, user.id)
    setMediaBusy(false)
    if (uploaded.error) { setError(uploaded.error.message); return }
    setMediaFile(null)
    uploadForm.reset()
    setNotice('Your post is now visible on your public artist page.')
    const refreshed = await dataClient.listArtistMedia(listing.id)
    if (refreshed.error) setError(refreshed.error.message)
    else setPortfolio(refreshed.data || [])
  }

  const removeMedia = async item => {
    setMediaBusy(true); setError(''); setNotice('')
    const removed = await dataClient.removeArtistMedia(item, listing.id, user.id)
    setMediaBusy(false)
    if (removed.error) { setError(removed.error.message); return }
    setPortfolio(current => current.filter(media => media.id !== item.id))
    setNotice('Post removed from your artist page.')
  }

  const deleteListing = async () => {
    if (!listing || !window.confirm(`Delete ${listing.name}? This will permanently remove the listing and its booking requests.`)) return
    setDeleting(true); setError(''); setNotice('')
    const deleted = await dataClient.deleteArtist(listing.id, user.id)
    setDeleting(false)
    if (deleted.error) { setError(deleted.error.message); return }
    setListing(null); setRequests([]); setPortfolio([]); setShowForm(false); setForm(emptyForm)
    setNotice('Your listing has been deleted. You can create a new one whenever you are ready.')
  }

  return <div className="artist-studio page">
    <div className="dashboard-head"><div><p className="kicker">List yourself</p><h1>{listing ? 'Your artist listing' : 'Share your talent.'}</h1><p>{listing ? 'You can edit your listing and review booking requests here.' : 'Create one listing that customers can discover and book.'}</p></div>{listing && !showForm && <button className="button" onClick={edit}>Edit listing <ArrowRight size={17}/></button>}</div>
    {error && <p className="form-error" role="alert">{error}</p>}{notice && <p className="form-success" role="status">{notice}</p>}
    {!loading && (showForm || !listing) && <section id="listing-form" className="studio-panel"><div className="panel-heading"><div><p className="kicker">Your one public profile</p><h2>{listing ? 'Edit your details' : 'Create your listing'}</h2></div>{listing && <button className="icon-button" onClick={() => setShowForm(false)} aria-label="Close form"><X size={18}/></button>}</div>
      <form className="listing-form" onSubmit={save}>
        <fieldset className="category-choice"><legend>What kind of artist are you?</legend><div className="category-choice-grid">{categories.map(category => <label key={category} className={form.category === category ? 'category-option selected' : 'category-option'}><input type="radio" name="category" value={category} checked={form.category === category} onChange={() => setForm({ ...form, category, details: {} })}/><span>{category}</span></label>)}</div></fieldset>
        <div className="field-row"><label>Artist or stage name<input required maxLength="120" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder="How customers will find you"/></label><label>City<input required value={form.city} onChange={event => setForm({ ...form, city: event.target.value })} placeholder="Your base city"/></label></div>
        <div className="field-row"><label>Starting price per event (₹)<input type="number" required min="0" step="1" value={form.price_per_event} onChange={event => setForm({ ...form, price_per_event: event.target.value })} placeholder="12000"/></label><label>Search tags <span className="optional">Separate with commas</span><input value={form.tags} onChange={event => setForm({ ...form, tags: event.target.value })} placeholder="Weddings, live music"/></label></div>
        <label>Tell customers about your act<textarea required rows="3" value={form.bio} onChange={event => setForm({ ...form, bio: event.target.value })} placeholder="Your experience, style, and what an event with you feels like"/></label>
        {form.category && <div className="specific-fields"><div><p className="kicker">{form.category} details</p><h3>Help customers know exactly what to expect</h3></div><div className="field-row">{categoryFields[form.category].map(field => <label key={field.key}>{field.label}<input required value={form.details?.[field.key] || ''} onChange={event => setForm({ ...form, details: { ...form.details, [field.key]: event.target.value } })} placeholder={field.placeholder}/></label>)}</div></div>}
        <label className="photo-label">Profile photo <span className="optional">JPG, PNG or WebP</span><span className="photo-picker"><span className="photo-preview">{photoPreview || form.profile_image_url ? <img src={photoPreview || form.profile_image_url} alt="Profile preview"/> : <Camera size={27}/>}</span><span><strong>{photoFile ? photoFile.name : form.profile_image_url ? 'Change your photo' : 'Upload a profile photo'}</strong><small>Choose a clear picture customers will recognize.</small></span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => setPhotoFile(event.target.files?.[0] || null)}/></span></label>
        <button className="button" disabled={saving}>{saving ? 'Saving…' : listing ? 'Save listing' : 'Publish my listing'} <ArrowRight size={17}/></button>
      </form>
    </section>}
    {loading ? <p className="studio-loading">Loading your listing…</p> : listing && <section className="studio-section"><div className="panel-heading"><div><p className="kicker">Live in {listing.category}</p><h2>Your listing</h2></div></div><article className="studio-listing"><img src={listing.profile_image_url || 'https://images.unsplash.com/photo-1524650359799-842906ca1c06?auto=format&fit=crop&w=450&q=80'} alt=""/><div><span className="mini-badge">{listing.category}</span><h3>{listing.name}</h3><p><MapPin size={14}/> {listing.city || 'Location flexible'}</p></div><div className="listing-actions"><Link to={`/artists/${listing.id}`}>View listing</Link><button onClick={edit} disabled={deleting}>Edit</button><button className="delete-listing" onClick={deleteListing} disabled={deleting}><Trash2 size={15}/> {deleting ? 'Deleting…' : 'Delete'}</button></div></article></section>}
    {listing && <section className="studio-section portfolio-panel"><div className="panel-heading"><div><p className="kicker">Show your work</p><h2>Photos & videos</h2><p>Add performances, highlights, or behind-the-scenes moments. They appear on your public profile.</p></div><Link to={`/artists/${listing.id}`}>View public page <ArrowRight size={16}/></Link></div><form className="portfolio-upload" onSubmit={postMedia}><label className="portfolio-file"><ImagePlus size={23}/><span>{mediaFile ? mediaFile.name : 'Choose an image or video'}</span><input type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" onChange={event => setMediaFile(event.target.files?.[0] || null)}/></label><button className="button" disabled={!mediaFile || mediaBusy}>{mediaBusy ? 'Working…' : 'Post to profile'} <ArrowRight size={16}/></button><small>JPG, PNG, WebP, MP4 or WebM · up to 50 MB per file</small></form>{portfolio.length ? <div className="portfolio-grid">{portfolio.map(item => <article className="portfolio-item" key={item.id}>{item.media_type === 'video' ? <video src={item.media_url} controls preload="metadata"/> : <img src={item.media_url} alt={`${listing.name} portfolio`}/>}<div><span>{item.media_type === 'video' ? 'Video' : 'Photo'}</span><button type="button" disabled={mediaBusy} onClick={() => removeMedia(item)} aria-label={`Remove ${item.media_type}`}><Trash2 size={16}/> Remove</button></div></article>)}</div> : <p className="portfolio-empty">No posts yet. Add a photo or video to show customers what you do.</p>}</section>}
    {listing && <section className="studio-section"><div className="panel-heading"><div><p className="kicker">From customers</p><h2>Booking requests</h2></div><span className="request-count">{requests.filter(request => request.status === 'pending').length} pending</span></div>{requests.length ? <div className="request-list">{requests.map(request => <article className="request-card" key={request.id}><div className="request-top"><div><span className={`status ${request.status}`}>{request.status}</span><h3>{listing.name}</h3><p>From {request.profiles?.full_name || request.profiles?.email || 'Customer'}</p></div><div className="request-date"><CalendarDays size={18}/><strong>{new Date(`${request.event_date}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</strong><span>{request.event_time?.slice(0, 5) || 'Time TBD'}</span></div></div><p className="request-location"><MapPin size={15}/> {request.event_location || 'Location not shared'}</p>{request.notes && <p className="request-notes">{request.notes}</p>}{request.status === 'pending' && <div className="request-actions"><button disabled={busyId === request.id} onClick={() => decide(request.id, 'confirmed')} className="button small"><Check size={16}/> Confirm</button><button disabled={busyId === request.id} onClick={() => decide(request.id, 'cancelled')} className="button outline small"><X size={16}/> Decline</button></div>}</article>)}</div> : <div className="empty"><h3>No requests yet</h3><p>Customers can now find and request your listing.</p></div>}</section>}
  </div>
}

import { useEffect, useState } from 'react'
import { CalendarDays, Clock3, MapPin, ArrowUpRight, Search, Sparkles, CheckCircle2 } from 'lucide-react'
import { Link, Navigate } from 'react-router-dom'
import { dataClient } from '../lib/dataClient'

export default function Dashboard({ user }) {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    if (!user) return
    let active = true
    setLoading(true); setError('')
    dataClient.customerBookings(user.id).then(({ data, error }) => {
      if (!active) return
      setBookings(data || []); setError(error?.message || '')
    }).catch(e => { if (active) setError(e.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [user?.id, retry])
  if (!user) return <Navigate to="/login" replace/>

  return <div className="bookings-page page">
    <div className="bookings-heading"><div><p className="kicker">Your events, all together</p><h1>My bookings</h1><p>From the first request to the final encore.</p></div><Link className="button outline" to="/"><Search size={17}/>Find an artist</Link></div>
    {error ? <div className="bookings-empty" role="alert"><h2>We couldn’t load your bookings.</h2><p>{error}</p><button className="button" onClick={() => setRetry(value => value + 1)}>Try again</button></div>
      : loading ? <div className="bookings-loading" aria-busy="true" aria-label="Loading bookings"><div className="skeleton"/><div className="skeleton"/></div>
      : bookings.length ? <><div className="bookings-summary"><span><CalendarDays size={17}/>{bookings.length} {bookings.length === 1 ? 'booking' : 'bookings'}</span><span><CheckCircle2 size={17}/>{bookings.filter(b => b.status === 'confirmed').length} confirmed</span></div><div className="bookings-cards">{bookings.map(b => <article className="event-booking" key={b.id}>
        {b.artists?.profile_image_url ? <img src={b.artists.profile_image_url} alt={b.artists.name || 'Performer'}/> : <div className="booking-image-placeholder"><Sparkles size={32}/></div>}
        <div className="event-booking-content"><div className="event-booking-top"><span className="kicker">{b.artists?.category || 'Performance'}</span><span className={`booking-status booking-status-${b.status}`}>{b.status}</span></div><h2>{b.artists?.name || 'Artist'}</h2><div className="event-booking-details"><span><CalendarDays size={16}/>{new Date(`${b.event_date}T00:00:00`).toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' })}</span>{b.event_time && <span><Clock3 size={16}/>{b.event_time.slice(0,5)}</span>}<span><MapPin size={16}/>{b.event_location || 'Location to be decided'}</span></div><Link className="booking-artist-link" to={`/artists/${b.artist_id}`}>View artist <ArrowUpRight size={16}/></Link></div>
      </article>)}</div></>
      : <section className="bookings-empty"><div className="booking-empty-art" aria-hidden="true"><div className="booking-calendar-icon"><CalendarDays size={46} strokeWidth={1.4}/></div><span><Sparkles size={20}/></span></div><p className="kicker">Make room for something great</p><h2>Your next memorable event<br/>starts here.</h2><p>No bookings yet. Discover a performer you love,<br className="booking-desktop-break"/> choose your date, and send your first request.</p><Link className="button" to="/">Explore artists <ArrowUpRight size={18}/></Link><div className="booking-empty-note"><CalendarDays size={15}/>Your requests and confirmed events will appear here.</div></section>}
  </div>
}

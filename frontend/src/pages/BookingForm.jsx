import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, CalendarDays } from 'lucide-react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { dataClient } from '../lib/dataClient'
import { timeSlots } from '../lib/categories'

export default function BookingForm({ user }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [artist, setArtist] = useState(null)
  const [form, setForm] = useState({ event_date: '', event_time: '', event_location: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    dataClient.getArtist(id).then(({ data, error }) => {
      if (error) setError(error.message)
      else setArtist(data)
    })
  }, [id])

  if (!user) return <Navigate to="/login" state={{ from: `/artists/${id}/book` }} replace/>

  const submit = async event => {
    event.preventDefault()
    if (!form.event_time) { setError('Choose a time slot.'); return }
    setSaving(true); setError('')
    const { error: bookingError } = await dataClient.createBooking({ ...form, artist_id: id, user_id: user.id, status: 'pending', notes: form.notes || null })
    setSaving(false)
    if (bookingError) setError(bookingError.message)
    else setDone(true)
  }

  if (done) return <div className="success page"><div className="success-mark"><Check/></div><p className="kicker">Request sent</p><h1>Your booking request<br/>is on its way.</h1><p>{artist?.name} can now review your request. Check its status in My bookings.</p><button className="button" onClick={() => navigate('/dashboard')}>View my bookings <ArrowRight size={17}/></button></div>

  return <div className="booking page"><Link className="back" to={`/artists/${id}`}><ArrowLeft size={17}/> Artist profile</Link><div className="form-layout"><div className="form-copy"><p className="kicker">Step 3 · Request a booking</p><h1>Pick your date<br/><em>and time.</em></h1><p>Requesting <strong>{artist?.name || 'this artist'}</strong>. The artist will review and confirm your request.</p>{artist && <div className="booking-summary"><CalendarDays size={20}/><div><strong>{artist.name}</strong><span>{artist.category} · {artist.price_per_event ? `From ₹${Number(artist.price_per_event).toLocaleString('en-IN')}` : 'Price on request'}</span></div></div>}</div><form onSubmit={submit}><label>Event date<input type="date" required min={new Date().toLocaleDateString('en-CA')} value={form.event_date} onChange={event => setForm({ ...form, event_date: event.target.value })}/></label><fieldset className="slot-field"><legend>Choose a time slot</legend><div className="slot-grid">{timeSlots.map(slot => <button type="button" key={slot.time} className={form.event_time === slot.time ? 'slot selected' : 'slot'} onClick={() => setForm({ ...form, event_time: slot.time })}><strong>{slot.label}</strong><span>{slot.time}</span></button>)}</div></fieldset><label>Venue or location<input required placeholder="Venue, area or city" value={form.event_location} onChange={event => setForm({ ...form, event_location: event.target.value })}/></label><label>Anything the artist should know? <span className="optional">Optional</span><textarea rows="3" placeholder="Event type, audience, or special requests" value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })}/></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="button full" disabled={saving || !artist}>{saving ? 'Sending…' : 'Request booking'} <ArrowRight size={17}/></button><small className="fine-print">No payment is collected when you request a booking.</small></form></div></div>
}

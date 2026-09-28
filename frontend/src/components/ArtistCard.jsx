import { ArrowUpRight, MapPin, Star } from 'lucide-react'
import { Link } from 'react-router-dom'
import { categories } from '../lib/categories'

const fallback = 'https://images.unsplash.com/photo-1524650359799-842906ca1c06?auto=format&fit=crop&w=900&q=80'
export default function ArtistCard({ artist }) {
  const accent = ['coral','amber','green','cyan','indigo','pink'][[...artist.name].reduce((n,c)=>n+c.charCodeAt(0),0)%6]
  return <Link to={`/artists/${artist.id}`} className={`artist-card accent-${accent}`}>
    <div className="card-image"><img src={artist.profile_image_url || fallback} alt={artist.name} loading="lazy"/>{!artist.profile_image_url?.startsWith('data:image/svg+xml') && <span className="category-tag">{artist.category}</span>}{Number(artist.rating) > 0 ? <span className="card-rating"><Star size={13} fill="currentColor"/> {Number(artist.rating).toFixed(1)}</span> : <span className="card-rating card-new">New</span>}</div>
    <div className="card-content"><div className="art-badges">{categories.filter(c => c === artist.category || artist.tags?.includes(c)).map(c => <span key={c}>{c}</span>)}</div><div className="card-copy"><h3>{artist.name}</h3><p><MapPin size={14}/> {artist.city || 'Available worldwide'}</p></div><p className="card-description">{artist.bio || `Discover ${artist.name} for your next event.`}</p><div className="card-foot"><div><small>Starting from</small><strong>{artist.price_per_event ? `₹${Number(artist.price_per_event).toLocaleString('en-IN')}` : 'On request'}</strong></div><span className="card-cta">View profile <ArrowUpRight size={16}/></span></div></div>
  </Link>
}

import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { UserRound, CalendarDays, Settings } from 'lucide-react'

export default function AccountHeader({ user }) {
  const [open, setOpen] = useState(false)
  const container = useRef(null)
  const location = useLocation()
  useEffect(() => { setOpen(false) }, [location.pathname, user?.id])
  useEffect(() => {
    const close = e => { if (!container.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [])
  return <header className="account-header"><Link className="brand" to="/">evntra<i>.</i></Link>
    <nav className="primary-links" aria-label="Main navigation"><NavLink to="/discover">Discover</NavLink><NavLink to="/" end>Explore artists</NavLink><NavLink to="/messages">Messages</NavLink></nav>
    <div className="account-control" ref={container} onKeyDown={e => { if(e.key === 'Escape'){setOpen(false);container.current?.querySelector('button')?.focus()} }}>
      {user ? <><button className="profile-trigger" aria-label="Account menu" aria-expanded={open} aria-controls="account-links" onClick={() => setOpen(!open)}><UserRound size={21}/></button>{open && <div className="account-dropdown" id="account-links"><Link to="/profile/me"><UserRound size={18}/>Profile</Link><Link to="/dashboard"><CalendarDays size={18}/>My bookings</Link><Link to="/settings"><Settings size={18}/>Settings</Link></div>}</> : <Link className="button small" to="/login">Sign in</Link>}
    </div>
  </header>
}

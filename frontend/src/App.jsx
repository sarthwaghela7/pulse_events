import { useEffect, useState } from 'react'
import { Link, NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { authClient, demoMode } from './lib/dataClient'
import Home from './pages/Home'
import ArtistDetail from './pages/ArtistDetail'
import BookingForm from './pages/BookingForm'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import ArtistDashboard from './pages/ArtistDashboard'
import FeedPage from './features/discover/FeedPage'
import ProfilePage from './features/profile/ProfilePage'
import EditProfile from './features/profile/EditProfile'
import MessagesPage from './features/messages/MessagesPage'
import AccountHeader from './components/AccountHeader'
import Settings from './pages/Settings'


export default function App() {
  const [user, setUser] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  useEffect(() => {
    authClient.getSession().then(({ data }) => { setUser(data.session?.user || null); setAuthReady(true) })
    return authClient.subscribe(value => { setUser(value); setAuthReady(true) })
  }, [])
  return <><AccountHeader user={user}/>{demoMode && <div className="demo-banner" role="status">Demo mode · Data is saved only in this browser.</div>}<main>{authReady && <Routes><Route path="/" element={<Home user={user}/>}/><Route path="/discover" element={<FeedPage user={user}/>}/><Route path="/messages" element={<MessagesPage user={user}/>}/><Route path="/messages/:conversationId" element={<MessagesPage user={user}/>}/><Route path="/settings" element={<Settings user={user}/>}/><Route path="/profile/edit" element={<EditProfile user={user}/>}/><Route path="/profile/:username" element={<ProfilePage user={user}/>}/><Route path="/artists/:id" element={<ArtistDetail/>}/><Route path="/artists/:id/book" element={<BookingForm user={user}/>}/><Route path="/login" element={<Login user={user}/>}/><Route path="/login/:role" element={<Navigate to="/login" replace/>}/><Route path="/dashboard" element={<Dashboard user={user}/>}/><Route path="/list-yourself" element={<ArtistDashboard user={user}/>}/><Route path="/artist/dashboard" element={<Navigate to="/list-yourself" replace/>}/><Route path="*" element={<div className="empty page"><h2>Page not found</h2><Link className="button" to="/">Browse artists</Link></div>}/></Routes>}</main><footer><Link className="brand" to="/">evntra<i>.</i></Link><p>Great artists. Great events.</p><span>© 2026 Evntra</span></footer></>
}

import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowUpRight, ChevronRight, UserRound, Mail, Pencil, LogOut } from 'lucide-react'
import { authClient } from '../lib/dataClient'
export default function Settings({user}) {
  const navigate = useNavigate()
  const [busy,setBusy] = useState(false)
  const [error,setError] = useState('')
  if(!user)return <Navigate to="/login" replace/>
  const signOut = async () => {
    setBusy(true);setError('')
    try{const result=await authClient.signOut();if(result?.error)throw new Error(result.error.message);navigate('/')}catch(e){setError(e.message);setBusy(false)}
  }
  return <section className="account-settings page">
    <Link className="edit-back" to="/profile/me"><ArrowLeft size={16}/>Back to profile</Link>
    <div className="settings-heading"><p className="kicker">Your space</p><h1>Settings</h1><p>A few simple ways to make Evntra yours.</p></div>
    <section className="settings-card" aria-labelledby="settings-profile-title">
      <div className="settings-card-heading"><span className="settings-symbol"><UserRound size={22}/></span><div><h2 id="settings-profile-title">Profile & account</h2><p>How you show up in the community.</p></div></div>
      <Link className="settings-row" to="/profile/edit"><span className="settings-row-icon"><Pencil size={18}/></span><span className="settings-row-copy"><strong>Edit profile</strong><small>Update your photo, username, bio and city.</small></span><ChevronRight size={18}/></Link>
      <Link className="settings-row" to="/profile/me"><span className="settings-row-icon"><UserRound size={18}/></span><span className="settings-row-copy"><strong>View your profile</strong><small>Your posts, followers and art, all in one place.</small></span><ArrowUpRight size={18}/></Link>
      {user.email && <div className="settings-row settings-email"><span className="settings-row-icon"><Mail size={18}/></span><span className="settings-row-copy"><strong>Email address</strong><small>{user.email}</small></span><span className="settings-account-label">Account email</span></div>}
    </section>
    <section className="settings-session" aria-labelledby="settings-session-title"><span className="settings-signout-icon"><LogOut size={21}/></span><div><h2 id="settings-session-title">Sign out</h2><p>You can sign back in whenever you’re ready.</p></div><button onClick={signOut} disabled={busy}>{busy?'Signing out…':'Sign out'}<ArrowUpRight size={16}/></button></section>
    {error && <p className="form-error" role="alert">{error}</p>}
  </section>
}

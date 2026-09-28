import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { Navigate, useLocation } from 'react-router-dom'
import { authClient } from '../lib/dataClient'

export default function Login({ user }) {
  const location = useLocation()
  const [signup, setSignup] = useState(new URLSearchParams(location.search).get('mode') === 'signup')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  if (user) return <Navigate to={location.state?.from || '/'} replace/>

  const submit = async event => {
    event.preventDefault()
    setLoading(true); setError(''); setMessage('')
    const result = signup ? await authClient.signUp(email, password, name) : await authClient.signIn(email, password)
    setLoading(false)
    if (result.error) setError(result.error.message)
    else if (signup && !result.data.session) setMessage('Check your inbox to confirm your account, then sign in.')
  }

  return <div className="auth"><div className="auth-art"><div><p>Make moments<br/>worth remembering.</p><span>Discover. Connect. Celebrate.</span></div></div><div className="auth-form"><div><p className="kicker">One account for everything</p><h1>{signup ? 'Create your account' : 'Welcome back'}</h1><p>Book a performer, or list yourself as one. It all starts here.</p><form onSubmit={submit}>{signup && <label>Your name<input required value={name} onChange={event => setName(event.target.value)} placeholder="Your full name"/></label>}<label>Email address<input type="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com"/></label><label>Password<input type="password" required minLength="6" value={password} onChange={event => setPassword(event.target.value)} placeholder="At least 6 characters"/></label>{error && <p className="form-error" role="alert">{error}</p>}{message && <p className="form-success" role="status">{message}</p>}<button className="button full" disabled={loading}>{loading ? 'Please wait…' : signup ? 'Create account' : 'Sign in'} <ArrowRight size={17}/></button></form><p className="switch">{signup ? 'Already have an account?' : 'New to Evntra?'} <button onClick={() => { setSignup(!signup); setError(''); setMessage('') }}>{signup ? 'Sign in' : 'Create an account'}</button></p></div></div></div>
}

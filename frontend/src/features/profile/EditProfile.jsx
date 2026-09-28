import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { ArrowLeft, Camera, CheckCircle2, AlertCircle, LoaderCircle, UserRound, AtSign } from 'lucide-react'
import { socialClient } from '../../lib/socialClient'

export default function EditProfile({user}) {
  const [form,setForm] = useState({username:'',display_name:'',bio:'',city:'',avatar_url:''})
  const [loaded,setLoaded] = useState(false)
  const [error,setError] = useState('')
  const [saving,setSaving] = useState(false)
  const [uploading,setUploading] = useState(false)
  const [availability,setAvailability] = useState({status:'idle',value:''})
  const [retry,setRetry] = useState(0)
  const navigate = useNavigate()
  useEffect(() => {
    let active=true
    if(user)socialClient.myProfile(user.id).then(r => {
      if(!active)return
      if(r.error){setError(r.error.message);return}
      setForm({username:r.data.username || '',display_name:r.data.display_name || r.data.full_name || '',bio:r.data.bio || '',city:r.data.city || '',avatar_url:r.data.avatar_url || ''});setLoaded(true)
    }).catch(e => {if(active)setError(e.message)})
    return () => {active=false}
  },[user?.id])
  const username=form.username.trim().toLowerCase()
  useEffect(() => {
    if(!loaded || !user)return
    let active=true
    if(!/^[a-z0-9_.]{3,30}$/.test(username)){setAvailability({status:'invalid',value:username});return}
    setAvailability({status:'checking',value:username})
    const timer=setTimeout(async () => {
      try{
        const result=await socialClient.checkUsername(username,user.id)
        if(active)setAvailability({status:result.error?'error':result.data.available?'available':'taken',value:username})
      }catch{if(active)setAvailability({status:'error',value:username})}
    },350)
    return () => {active=false;clearTimeout(timer)}
  },[username,user?.id,loaded,retry])
  if(!user)return <Navigate to="/login" replace/>
  const status=availability.value === username ? availability.status : 'checking'
  const statusText={idle:'Choose your unique username.',checking:'Checking availability…',available:'This username is available.',taken:'This username is taken. Try another.',invalid:'Use 3–30 letters, numbers, dots or underscores.',error:'Could not check availability. Please retry.'}[status]
  const change=(key,value) => setForm(current => ({...current,[key]:value}))
  const upload=async e => {
    const file=e.target.files[0];if(!file)return
    setUploading(true);setError('')
    try{const r=await socialClient.uploadAvatar(user.id,file);if(r.error)throw new Error(r.error.message);change('avatar_url',r.data)}catch(e){setError(e.message)}finally{setUploading(false)}
  }
  const save=async e => {
    e.preventDefault();if(status !== 'available' || saving || uploading)return
    setSaving(true);setError('')
    try{const r=await socialClient.updateProfile(user.id,form);if(r.error){if(r.error.code==='USERNAME_TAKEN')setAvailability({status:'taken',value:username});throw new Error(r.error.message)}navigate(`/profile/${r.data.username}`)}catch(e){setError(e.message)}finally{setSaving(false)}
  }
  return <div className="edit-identity page"><Link className="edit-back" to="/profile/me"><ArrowLeft size={16}/>Back to profile</Link><div className="edit-heading"><p className="kicker">Make it yours</p><h1>Edit profile</h1><p>A little about you. A first impression that lasts.</p></div>
    <form className="identity-form" onSubmit={save} aria-busy={!loaded || saving}>
      <div className="identity-photo"><div className="identity-avatar">{form.avatar_url?<img src={form.avatar_url} alt="Your profile picture"/>:<UserRound size={38}/>}</div><div><h2>Profile photo</h2><p>Give your profile a familiar face.</p><label className="identity-upload"><Camera size={16}/>{uploading?'Uploading…':'Change photo'}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={upload} disabled={!loaded || uploading || saving}/></label><small>JPG, PNG or WebP · up to 5 MB</small></div></div>
      <fieldset disabled={!loaded || saving} className="identity-fields"><legend>Public profile</legend><div className="identity-field-row"><label>Display name<input required maxLength={100} value={form.display_name} onChange={e=>change('display_name',e.target.value)} placeholder="Your name" autoComplete="name"/></label><div className="username-field"><label htmlFor="edit-username">Username</label><div className="username-input"><AtSign size={16}/><input id="edit-username" required minLength={3} maxLength={30} value={form.username} onChange={e=>change('username',e.target.value.toLowerCase())} autoCapitalize="none" spellCheck={false} autoComplete="off" aria-describedby="username-feedback" aria-invalid={['taken','invalid'].includes(status)} placeholder="your.username"/></div><div id="username-feedback" className={`username-feedback ${status}`} role="status" aria-live="polite">{status==='available'?<CheckCircle2 size={14}/>:status==='checking'?<LoaderCircle size={14}/>:<AlertCircle size={14}/>}<span>{statusText}</span>{status==='error'&&<button type="button" onClick={()=>setRetry(n=>n+1)}>Retry</button>}</div></div></div>
      <label>City<input maxLength={100} value={form.city} onChange={e=>change('city',e.target.value)} placeholder="Where are you based?" autoComplete="address-level2"/></label><label>Bio<textarea maxLength={300} value={form.bio} onChange={e=>change('bio',e.target.value)} placeholder="Tell people about yourself and your art."/><span className="identity-bio-note"><span>A few words to introduce yourself.</span><span>{form.bio.length}/300</span></span></label></fieldset>
      {error&&<p role="alert" className="identity-error"><AlertCircle size={17}/>{error}</p>}
      <div className="identity-footer"><span>Your profile is visible to the community.</span><div><Link to="/profile/me" className="identity-cancel">Cancel</Link><button className="button" disabled={!loaded || saving || uploading || status!=='available' || !form.display_name.trim()}>{saving?'Saving…':'Save changes'}</button></div></div>
    </form></div>
}

import { useState } from 'react'
import { ImagePlus, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { socialClient } from '../../lib/socialClient'
import { composerState } from './policy'

export default function PostComposer({ user, listed, onCreated }) {
  const [open,setOpen]=useState(false),[caption,setCaption]=useState(''),[files,setFiles]=useState([]),[error,setError]=useState(''),[progress,setProgress]=useState(0)
  if(composerState({user,listed})==='signed-out')return <div className="composer-gate"><p>Sign in to join the Evntra community.</p><Link className="button small" to="/login">Sign in</Link></div>
  if(composerState({user,listed})==='listing-required')return <div className="composer-gate"><div><strong>List yourself to start posting</strong><p>Publish your artist service to share work with the community.</p></div><Link className="button small" to="/list-yourself">List yourself</Link></div>
  const submit=async e=>{e.preventDefault();setError('');const {data,error}=await socialClient.createPost({caption,files},setProgress);if(error){setError(error.message);return}setCaption('');setFiles([]);setOpen(false);setProgress(0);onCreated?.(data)}
  return <>{<button className="composer-launch" onClick={()=>setOpen(true)}><ImagePlus/> Share your latest performance</button>}{open&&<div className="modal-backdrop" role="presentation"><form className="post-composer" onSubmit={submit} role="dialog" aria-modal="true" aria-label="Create post"><button type="button" className="modal-close" onClick={()=>setOpen(false)} aria-label="Close"><X/></button><p className="kicker">New post</p><h2>Share your work</h2><textarea maxLength="2000" value={caption} onChange={e=>setCaption(e.target.value)} placeholder="Tell people about this moment…"/><label className="media-picker"><ImagePlus/> Choose up to 10 images or one video<input type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" multiple onChange={e=>setFiles([...e.target.files].slice(0,10))}/></label>{files.length>0&&<p>{files.map(x=>x.name).join(', ')}</p>}{progress>0&&<progress value={progress} max="100"/>}{error&&<p className="form-error">{error}</p>}<button className="button" disabled={!files.length}>Publish</button></form></div>}</>
}

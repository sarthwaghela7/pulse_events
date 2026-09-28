import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { Send, Search, MessageCircle, ArrowLeft, ArrowUpRight } from 'lucide-react'
import { socialClient } from '../../lib/socialClient'

function Avatar({person}) {
  const [failed,setFailed]=useState(false)
  useEffect(()=>setFailed(false),[person?.avatar_url])
  const name=person?.display_name || person?.full_name || 'Evntra user'
  return <span className="inbox-avatar">{person?.avatar_url && !failed ? <img src={person.avatar_url} alt="" onError={()=>setFailed(true)}/> : name.split(' ').slice(0,2).map(s=>s[0]).join('').toUpperCase()}</span>
}
const time=value=>value && !Number.isNaN(Date.parse(value)) ? new Date(value).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : ''

export default function MessagesPage({user}) {
  const {conversationId}=useParams()
  const [chats,setChats]=useState([]),[messages,setMessages]=useState([]),[body,setBody]=useState(''),[query,setQuery]=useState('')
  const [loading,setLoading]=useState(true),[loadingThread,setLoadingThread]=useState(false),[sending,setSending]=useState(false),[error,setError]=useState('')
  const bottom=useRef(null)
  const activeId=useRef(conversationId)
  activeId.current=conversationId
  useEffect(()=>{
    let active=true
    if(user)socialClient.conversations(user.id).then(r=>{if(active){if(r.error)setError(r.error.message);else setChats(r.data || [])}}).catch(e=>{if(active)setError(e.message)}).finally(()=>{if(active)setLoading(false)})
    return()=>{active=false}
  },[user?.id])
  useEffect(()=>{
    setMessages([]);setBody('');setError('')
    if(!conversationId)return
    let active=true
    setLoadingThread(true)
    const merge=rows=>setMessages(old=>[...new Map([...old,...rows].map(m=>[m.id,m])).values()].sort((a,b)=>a.created_at.localeCompare(b.created_at)))
    const unsubscribe=socialClient.subscribeMessages(conversationId,m=>{if(active)merge([m])})
    socialClient.messages(conversationId).then(r=>{if(active){if(r.error)setError(r.error.message);else merge(r.data || [])}}).catch(e=>{if(active)setError(e.message)}).finally(()=>{if(active)setLoadingThread(false)})
    return()=>{active=false;unsubscribe()}
  },[conversationId])
  useEffect(()=>{bottom.current?.scrollIntoView({block:'nearest'})},[messages.length])
  if(!user)return <Navigate to="/login" replace/>
  const other=chat=>chat?.conversations.conversation_participants?.find(p=>p.user_id!==user.id)?.profiles
  const selected=chats.find(c=>c.conversation_id===conversationId)
  const person=other(selected)
  const name=person?.display_name || person?.full_name || 'Conversation'
  const send=async e=>{
    e.preventDefault();if(!body.trim() || sending)return
    const target=conversationId,text=body.trim()
    setSending(true);setError('')
    try{
      const result=await socialClient.sendMessage(target,user.id,text)
      if(result.error)throw new Error(result.error.message)
      if(activeId.current===target){setMessages(old=>old.some(m=>m.id===result.data.id)?old:[...old,result.data]);setBody('')}
      setChats(old=>old.map(c=>c.conversation_id===target?{...c,conversations:{...c.conversations,messages:[...(c.conversations.messages || []).filter(m=>m.id!==result.data.id),result.data],last_message_at:result.data.created_at}}:c))
    }catch(e){if(activeId.current===target)setError(e.message)}finally{setSending(false)}
  }
  return <div className={`inbox-shell ${conversationId?'has-conversation':''}`}>
    <aside className="inbox-sidebar"><div className="inbox-heading"><p className="kicker">Stay connected</p><h1>Messages <span>{chats.length}</span></h1><label className="inbox-search"><Search size={17}/><input aria-label="Search conversations" placeholder="Search conversations" value={query} onChange={e=>setQuery(e.target.value)}/></label></div>
      <div className="inbox-list">{loading?<p className="inbox-hint">Loading conversations…</p>:chats.filter(c=>(other(c)?.display_name || other(c)?.full_name || '').toLowerCase().includes(query.toLowerCase())).map(chat=>{
        const contact=other(chat),last=chat.conversations.messages?.at(-1)
        return <Link key={chat.conversation_id} className={`inbox-contact ${conversationId===chat.conversation_id?'selected':''}`} to={`/messages/${chat.conversation_id}`} aria-current={conversationId===chat.conversation_id?'page':undefined}><Avatar person={contact}/><span className="inbox-contact-copy"><strong>{contact?.display_name || contact?.full_name || 'Evntra user'}</strong><small>{last?(last.type==='text'?last.body:'Shared a post'):'Start a conversation'}</small></span><time>{time(last?.created_at)}</time></Link>
      })}{!loading && !chats.length && <p className="inbox-hint">Message an artist from their profile to start a conversation.</p>}</div>
    </aside>
    <section className="inbox-thread" aria-label="Conversation">{conversationId?<><div className="inbox-thread-heading"><Link className="inbox-mobile-back" to="/messages" aria-label="Back to messages"><ArrowLeft size={20}/></Link><Avatar person={person}/><div><h2>{name}</h2><p>Direct conversation</p></div>{person?.username && <Link className="inbox-profile-link" to={`/profile/${person.username}`}>View profile <ArrowUpRight size={16}/></Link>}</div>
      <div className="inbox-message-list" role="log" aria-label="Messages">{loadingThread?<p className="inbox-hint">Loading messages…</p>:!messages.length?<div className="inbox-thread-empty"><MessageCircle size={30}/><h3>Start with a hello</h3><p>Ask about a performance or plan something special.</p></div>:messages.map((m,i)=>{
        const date=new Date(m.created_at).toLocaleDateString([], {day:'numeric',month:'short',year:'numeric'})
        const previous=i?new Date(messages[i-1].created_at).toLocaleDateString([], {day:'numeric',month:'short',year:'numeric'}):null
        return <div className="inbox-message-group" key={m.id}>{date!==previous&&<div className="inbox-date"><span>{date}</span></div>}<div className={`inbox-bubble ${m.sender_id===user.id?'outgoing':''}`}>{m.type==='text'?<p>{m.body}</p>:<Link to={m.type==='shared_post'?`/discover?post=${m.shared_post_id}`:`/artists/${m.shared_artist_id}`}>View shared {m.type==='shared_post'?'post':'artist'} <ArrowUpRight size={16}/></Link>}<time dateTime={m.created_at}>{time(m.created_at)}</time></div></div>
      })}<div ref={bottom}/></div>
      {error&&<p className="inbox-error" role="alert">{error}</p>}
      <form className="inbox-composer" onSubmit={send}><input aria-label="Message" value={body} onChange={e=>setBody(e.target.value)} maxLength={4000} placeholder={`Message ${name === 'Conversation'?'this person':name.split(' ')[0]}…`} disabled={sending}/><button disabled={!body.trim() || sending} aria-label={sending?'Sending message':'Send message'}><Send size={19}/></button></form></>:<div className="inbox-welcome"><span><MessageCircle size={34}/></span><p className="kicker">Good things start with a conversation</p><h2>Your next connection<br/>starts here.</h2><p>Choose a chat to talk dates, share ideas,<br/>and bring your next event to life.</p><Link className="button outline" to="/">Explore artists <ArrowUpRight size={16}/></Link>{error&&<p className="inbox-error" role="alert">{error}</p>}</div>}</section>
  </div>
}

import { demoMode } from './dataClient'
import { supabase } from './supabaseClient'
import { categories } from './categories'

const PREFIX = 'evntra-demo-v1-'
const read = (key, fallback = []) => { try { return JSON.parse(localStorage.getItem(PREFIX + key)) ?? fallback } catch { return fallback } }
const write = (key, value) => localStorage.setItem(PREFIX + key, JSON.stringify(value))
const ok = data => ({ data, error: null })
const fail = (message, code) => ({ data: null, error: { message, code } })
const now = () => new Date().toISOString()
const session = () => read('session', null)
const demoProfiles = () => {
  const saved = read('profiles', null)
  if (saved) return saved
  const accounts = [{ id:'artist-demo', username:'demoartist', display_name:'Demo Artist', city:'Mumbai', bio:'Creating memorable live experiences.' }, { id:'user-demo', username:'demouser', display_name:'Demo User', city:'Bengaluru', bio:'Always planning the next celebration.' }]
  const seeded = read('artists', []).map(a => ({ id:a.user_id, username:a.name.toLowerCase().replace(/[^a-z0-9]+/g,'.').replace(/^\.|\.$/g,''), display_name:a.name, avatar_url:a.profile_image_url, city:a.city, bio:a.bio }))
  const profiles = [...accounts, ...seeded]; write('profiles', profiles); return profiles
}
const demoPosts = () => {
  const saved = read('posts', null); if (saved) return saved
  const rows = read('artists', []).flatMap((artist, ai) => [0,1].map(index => ({ id:`post-${artist.id}-${index}`, author_id:artist.user_id, artist_id:artist.id, caption:index ? `A glimpse from a recent ${artist.category.toLowerCase()} performance.` : `Bookings are open in ${artist.city}. Let's make your event special.`, media_type:'image', created_at:new Date(Date.now()-(ai*2+index)*3600000).toISOString(), like_count:(ai+index)%17, comment_count:0, share_count:0, profiles:demoProfiles().find(p=>p.id===artist.user_id), artists:{id:artist.id,name:artist.name,category:artist.category,city:artist.city}, post_media:[{id:`media-${artist.id}-${index}`,url:artist.profile_image_url,kind:'image',position:0}], post_likes:[] })))
  write('posts', rows); return rows
}
const savePosts = rows => write('posts', rows)
const ownListing = uid => read('artists', []).find(a => a.user_id === uid)

export const socialClient = {
  async checkUsername(value, uid) {
    const username = value.trim().toLowerCase()
    if (!/^[a-z0-9_.]{3,30}$/.test(username)) return fail('Use 3–30 letters, numbers, dots or underscores.', 'INVALID_USERNAME')
    if (['me','edit','settings','login'].includes(username)) return ok({available:false,username})
    if (demoMode) return ok({available:!demoProfiles().some(p => p.id !== uid && p.username?.toLowerCase() === username),username})
    // Escape LIKE wildcards so underscores are matched literally.
    const match = username.replaceAll('_', '\\_')
    const result = await supabase.from('profiles').select('id').ilike('username',match).neq('id',uid).limit(1)
    return result.error ? result : ok({available:result.data.length === 0,username})
  },
  async deletePost(postId) {
    if (demoMode) {
      const user = session()
      const posts = demoPosts()
      const post = posts.find(item => item.id === postId)
      if (!user || !post || post.author_id !== user.id) return fail('You can only delete your own posts.', 'FORBIDDEN')
      savePosts(posts.filter(item => item.id !== postId))
      write('comments', read('comments').filter(item => item.post_id !== postId))
      return ok({ id: postId })
    }
    const { data, error } = await supabase.auth.getUser()
    if (error || !data.user) return fail('Sign in to delete your post.', 'AUTH_REQUIRED')
    const result = await supabase.from('posts').delete().eq('id', postId).eq('author_id', data.user.id).select('id').maybeSingle()
    if (result.error) return result
    return result.data ? ok(result.data) : fail('Post not found or not owned by you.', 'FORBIDDEN')
  },
  async addArt(ownerId, category) {
    if(!categories.includes(category))return fail('Choose an available art category.')
    if(demoMode){
      if(session()?.id !== ownerId)return fail('You can only edit your own arts.')
      const rows = read('artists'); const artist = rows.find(a => a.user_id === ownerId)
      if(!artist)return fail('List your art first.')
      const saved = {...artist,tags:[...new Set([...(artist.tags || []),category])]}
      write('artists',rows.map(a => a.id === artist.id ? saved : a));return ok(saved)
    }
    const found = await supabase.from('artists').select('*').eq('user_id',ownerId).single()
    if(found.error)return found
    return supabase.from('artists').update({tags:[...new Set([...(found.data.tags || []),category])]}).eq('id',found.data.id).eq('user_id',ownerId).select().single()
  },
  async artistSocial(ownerId, viewerId) {
    if (demoMode) {
      const follows = read('follows');
      return ok({ posts: demoPosts().filter(p => p.author_id === ownerId).sort((a,b) => b.created_at.localeCompare(a.created_at)), follower_count: follows.filter(f => f.following_id === ownerId).length, following: follows.some(f => f.following_id === ownerId && f.follower_id === viewerId) });
    }
    const posts = [];
    for (let offset = 0; ; offset += 100) {
      const page = await supabase.from('posts').select('*,post_media(*)').eq('author_id',ownerId).order('created_at',{ascending:false}).order('id').range(offset,offset+99);
      if(page.error)return page;
      posts.push(...page.data);
      if(page.data.length < 100)break;
    }
    const count = await supabase.from('follows').select('*',{count:'exact',head:true}).eq('following_id',ownerId);
    if(count.error)return count;
    const follow = viewerId ? await supabase.from('follows').select('following_id').eq('following_id',ownerId).eq('follower_id',viewerId).maybeSingle() : {data:null};
    if(follow.error)return follow;
    return ok({posts,follower_count:count.count,following:Boolean(follow.data)});
  },
  async setFollowing(ownerId, viewerId, following) {
    if(!viewerId || ownerId === viewerId)return fail('Sign in with another account to follow this artist.');
    if(!demoMode)return following ? supabase.from('follows').upsert({follower_id:viewerId,following_id:ownerId}) : supabase.from('follows').delete().eq('follower_id',viewerId).eq('following_id',ownerId);
    const rows = read('follows').filter(f => !(f.follower_id === viewerId && f.following_id === ownerId));
    if(following)rows.push({follower_id:viewerId,following_id:ownerId,created_at:now()});
    write('follows',rows);return ok(following);
  },
  async startArtistConversation(artist, viewer) {
    if(!viewer || artist.user_id === viewer.id)return fail('Choose another artist to message.');
    if(!demoMode){
      const {data} = await supabase.auth.getSession();
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'}/api/conversations`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${data.session?.access_token}`},body:JSON.stringify({user_id:artist.user_id})});
      const body = await response.json();
      return response.ok ? ok(body) : fail(body.detail?.message || 'Could not open this conversation.');
    }
    const rows = read('conversations');
    const existing = rows.find(c => [viewer.id,artist.user_id].every(uid => c.conversations.conversation_participants.some(p => p.user_id === uid)));
    if(existing)return ok({id:existing.conversation_id});
    const id = crypto.randomUUID();
    const participants = [{user_id:viewer.id,profiles:{id:viewer.id,display_name:viewer.user_metadata?.full_name || 'You'}},{user_id:artist.user_id,profiles:{id:artist.user_id,display_name:artist.name,avatar_url:artist.profile_image_url}}];
    write('conversations',[...rows,{conversation_id:id,last_read_at:null,conversations:{id,last_message_at:now(),conversation_participants:participants,messages:[]}}]);
    return ok({id});
  },
  async feed(tab='for_you', cursor=null) {
    if (!demoMode) {
      let query=supabase.from('posts').select('*,post_media(*),profiles!posts_author_id_fkey(id,username,display_name,avatar_url,city),artists(id,name,category,city),post_likes(user_id)').order('created_at',{ascending:false}).limit(10)
      if(tab==='following'){const follows=await supabase.from('follows').select('following_id').eq('follower_id',session()?.id); const ids=(follows.data||[]).map(x=>x.following_id); if(!ids.length)return ok({items:[],next_cursor:null}); query=query.in('author_id',ids)}
      if(cursor)query=query.lt('created_at',cursor); const response=await query; return response.error?response:ok({items:response.data,next_cursor:response.data?.length===10?response.data[9].created_at:null})
    }
    let rows=[...demoPosts()]; if(tab==='following'){const ids=read('follows').filter(x=>x.follower_id===session()?.id).map(x=>x.following_id);rows=rows.filter(x=>ids.includes(x.author_id))} if(cursor)rows=rows.filter(x=>x.created_at<cursor); rows.sort((a,b)=>b.created_at.localeCompare(a.created_at)); return ok({items:rows.slice(0,10),next_cursor:rows.length>10?rows[9].created_at:null})
  },
  async hasListing(uid){return demoMode?ok(Boolean(ownListing(uid))):supabase.from('artists').select('id').eq('user_id',uid).maybeSingle()},
  async createPost({caption,files},onProgress=()=>{}) {
    const user=session(); if(!user)return fail('Sign in required.','AUTH_REQUIRED'); const listing=ownListing(user.id)
    if(demoMode&&!listing)return fail('List yourself before creating a post.','LISTING_REQUIRED')
    const kind=files[0]?.type.startsWith('video/')?'video':'image'; if(!files.length||files.length>10||(kind==='video'&&files.length!==1))return fail('Choose up to 10 images or one video.')
    if(demoMode){const urls=await Promise.all(files.map(f=>new Promise(resolve=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.readAsDataURL(f)})));const profile=demoProfiles().find(p=>p.id===user.id)||{id:user.id,username:user.email.split('@')[0],display_name:user.user_metadata?.full_name};const post={id:crypto.randomUUID(),author_id:user.id,artist_id:listing.id,caption,media_type:kind,created_at:now(),like_count:0,comment_count:0,share_count:0,profiles:profile,artists:{id:listing.id,name:listing.name,category:listing.category,city:listing.city},post_media:urls.map((url,i)=>({id:crypto.randomUUID(),url,kind,position:i})),post_likes:[]};savePosts([post,...demoPosts()]);onProgress(100);return ok(post)}
    const listingResult=await supabase.from('artists').select('id').eq('user_id',user.id).maybeSingle();if(!listingResult.data)return fail('List yourself before creating a post.','LISTING_REQUIRED')
    const media=[];for(let i=0;i<files.length;i++){const f=files[i];const path=`${user.id}/${crypto.randomUUID()}.${f.name.split('.').pop()}`;const up=await supabase.storage.from('post-media').upload(path,f);if(up.error)return up;media.push({url:supabase.storage.from('post-media').getPublicUrl(path).data.publicUrl,kind,position:i});onProgress(Math.round((i+1)/files.length*80))}
    const created=await supabase.from('posts').insert({author_id:user.id,artist_id:listingResult.data.id,caption,media_type:kind}).select().single();if(created.error)return created;const saved=await supabase.from('post_media').insert(media.map(x=>({...x,post_id:created.data.id})));onProgress(100);return saved.error?saved:ok(created.data)
  },
  async toggleLike(post,uid){const liked=(post.post_likes||[]).some(x=>x.user_id===uid);if(!demoMode)return liked?supabase.from('post_likes').delete().eq('post_id',post.id).eq('user_id',uid):supabase.from('post_likes').insert({post_id:post.id,user_id:uid});const rows=demoPosts().map(p=>p.id!==post.id?p:{...p,like_count:Math.max(0,p.like_count+(liked?-1:1)),post_likes:liked?p.post_likes.filter(x=>x.user_id!==uid):[...p.post_likes,{user_id:uid}]});savePosts(rows);return ok(!liked)},
  async comments(postId){if(!demoMode)return supabase.from('post_comments').select('*,profiles!post_comments_user_id_fkey(*)').eq('post_id',postId).order('created_at');return ok(read('comments').filter(x=>x.post_id===postId))},
  async addComment(postId,body,parent_id=null){const user=session();if(!demoMode)return supabase.from('post_comments').insert({post_id:postId,user_id:user.id,body,parent_id}).select('*,profiles!post_comments_user_id_fkey(*)').single();const row={id:crypto.randomUUID(),post_id:postId,user_id:user.id,parent_id,body,created_at:now(),profiles:demoProfiles().find(x=>x.id===user.id)};write('comments',[...read('comments'),row]);savePosts(demoPosts().map(p=>p.id===postId?{...p,comment_count:p.comment_count+1}:p));return ok(row)},
  async toggleFollow(target,uid){if(target===uid)return fail('You cannot follow yourself.');const rows=read('follows');const yes=rows.some(x=>x.follower_id===uid&&x.following_id===target);if(!demoMode)return yes?supabase.from('follows').delete().eq('follower_id',uid).eq('following_id',target):supabase.from('follows').insert({follower_id:uid,following_id:target});write('follows',yes?rows.filter(x=>!(x.follower_id===uid&&x.following_id===target)):[...rows,{follower_id:uid,following_id:target,created_at:now()}]);return ok(!yes)},
  async profile(username){if(!demoMode){const p=await supabase.from('profiles').select('*').ilike('username',username).single();if(p.error)return p;const [artist,posts,followers,following]=await Promise.all([supabase.from('artists').select('*').eq('user_id',p.data.id).maybeSingle(),supabase.from('posts').select('*,post_media(*)').eq('author_id',p.data.id).order('created_at',{ascending:false}),supabase.from('follows').select('*',{count:'exact',head:true}).eq('following_id',p.data.id),supabase.from('follows').select('*',{count:'exact',head:true}).eq('follower_id',p.data.id)]);return ok({...p.data,artist:artist.data,posts:posts.data,follower_count:followers.count,following_count:following.count})}const p=demoProfiles().find(x=>x.username.toLowerCase()===username.toLowerCase());if(!p)return fail('Profile not found.');const follows=read('follows');return ok({...p,artist:ownListing(p.id),posts:demoPosts().filter(x=>x.author_id===p.id),follower_count:follows.filter(x=>x.following_id===p.id).length,following_count:follows.filter(x=>x.follower_id===p.id).length,is_following:follows.some(x=>x.follower_id===session()?.id&&x.following_id===p.id)})},
  async myProfile(uid){if(!demoMode)return supabase.from('profiles').select('*').eq('id',uid).single();let profiles=demoProfiles();let p=profiles.find(x=>x.id===uid);if(!p){const u=session();p={id:uid,username:u.email.split('@')[0],display_name:u.user_metadata?.full_name||'Evntra user',bio:'',city:''};write('profiles',[...profiles,p])}return ok(p)},
  async updateProfile(uid,values){
    const check = await this.checkUsername(values.username,uid)
    if(check.error)return check
    if(!check.data.available)return fail('That username is taken. Try another.','USERNAME_TAKEN')
    const fields = {username:check.data.username,display_name:values.display_name.trim(),bio:values.bio || '',city:values.city || '',avatar_url:values.avatar_url || null}
    if(!demoMode){const result=await supabase.from('profiles').update(fields).eq('id',uid).select().single();return result.error?.code === '23505' ? fail('That username was just taken. Try another.','USERNAME_TAKEN') : result}
    if(session()?.id !== uid)return fail('You can only edit your own profile.')
    const profiles=demoProfiles();const saved={...profiles.find(x=>x.id===uid),...fields,id:uid};write('profiles',[...profiles.filter(x=>x.id!==uid),saved]);return ok(saved)
  },
  async uploadAvatar(uid,file){if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5_000_000)return fail('Choose a JPG, PNG, or WebP image under 5 MB.');if(demoMode)return new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(ok(reader.result));reader.onerror=()=>resolve(fail('Could not read that image.'));reader.readAsDataURL(file)});const ext=file.type==='image/jpeg'?'jpg':file.type.split('/')[1],path=`${uid}/avatar-${crypto.randomUUID()}.${ext}`;const uploaded=await supabase.storage.from('artist-profiles').upload(path,file,{contentType:file.type});if(uploaded.error)return uploaded;return ok(supabase.storage.from('artist-profiles').getPublicUrl(path).data.publicUrl)},
  async conversations(uid){if(!demoMode)return supabase.from('conversation_participants').select('conversation_id,last_read_at,conversations(*,conversation_participants(user_id,profiles(*)),messages(*))').eq('user_id',uid);let rows=read('conversations',null);if(!rows){const people=demoProfiles().filter(x=>x.id!==uid).slice(0,3);rows=people.map((p,i)=>({conversation_id:`demo-chat-${i}`,last_read_at:null,conversations:{id:`demo-chat-${i}`,last_message_at:new Date(Date.now()-i*7200000).toISOString(),conversation_participants:[{user_id:uid,profiles:demoProfiles().find(x=>x.id===uid)},{user_id:p.id,profiles:p}],messages:[{id:`welcome-${i}`,conversation_id:`demo-chat-${i}`,sender_id:p.id,type:'text',body:i?'Are you available for a celebration next month?':'Welcome to Evntra messages!',created_at:new Date(Date.now()-i*7200000).toISOString()}]}}));write('conversations',rows)}return ok(rows)},
  async messages(conversationId){if(!demoMode)return supabase.from('messages').select('*,posts:shared_post_id(*,post_media(*)),artists:shared_artist_id(*)').eq('conversation_id',conversationId).order('created_at');const chat=read('conversations').find(x=>x.conversation_id===conversationId);return ok(chat?.conversations.messages||[])},
  async sendMessage(conversationId,uid,body){if(!demoMode)return supabase.from('messages').insert({conversation_id:conversationId,sender_id:uid,type:'text',body}).select().single();const rows=read('conversations');const message={id:crypto.randomUUID(),conversation_id:conversationId,sender_id:uid,type:'text',body,created_at:now()};write('conversations',rows.map(x=>x.conversation_id===conversationId?{...x,conversations:{...x.conversations,last_message_at:message.created_at,messages:[...x.conversations.messages,message]}}:x));return ok(message)},
  subscribeMessages(conversationId,callback){if(demoMode)return()=>{};const channel=supabase.channel(`messages:${conversationId}`).on('postgres_changes',{event:'INSERT',schema:'public',table:'messages',filter:`conversation_id=eq.${conversationId}`},x=>callback(x.new)).subscribe();return()=>supabase.removeChannel(channel)},
}

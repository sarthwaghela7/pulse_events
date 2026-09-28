import { supabase } from './supabaseClient'
import { categories, categoryFields } from './categories'
import theme from '../theme'

export const demoMode = import.meta.env.VITE_DEMO_MODE === 'true'
const PREFIX = 'evntra-demo-v1-'
const seedNames = {
  Singer: ['Aarav Mehta', 'Mira Kapoor', 'Riya Sen', 'Kabir Sethi', 'Ananya Rao'],
  DJ: ['DJ Nova', 'DJ Kairo', 'DJ Pulse', 'DJ Tara', 'DJ Veda'],
  Band: ['The River Notes', 'Midnight Atlas', 'The Marigolds', 'City Lights Collective', 'Monsoon Avenue'],
  Dancer: ['Ishita Dance Co.', 'Rhythm House', 'Nisha Verma', 'The Motion Project', 'Rang Dance Crew'],
  Comedian: ['Rohan Malhotra', 'Neha Batra', 'Arjun Khanna', 'Sana Mirza', 'Dev Nair'],
  Magician: ['The Great Ishaan', 'Zara Mystique', 'Armaan Illusions', 'Mystic Maya', 'The Wonder Lab'],
}
const cities = ['Mumbai', 'Bengaluru', 'Delhi', 'Pune', 'Hyderabad']
const prices = { Singer: 15000, DJ: 18000, Band: 30000, Dancer: 16000, Comedian: 12000, Magician: 14000 }
const descriptions = {
  Singer: 'Live vocals for weddings, private celebrations, and memorable evenings.',
  DJ: 'Dance floor ready music for parties, receptions, and corporate events.',
  Band: 'A live set blending crowd favourites with an original sound.',
  Dancer: 'Expressive live performances tailored to your celebration.',
  Comedian: 'A lively stand up set that gets the whole room laughing.',
  Magician: 'Interactive illusions and close up magic for every guest.',
}
const posterColors = {
  Singer: theme.colors.spectrum.coral,
  DJ: theme.colors.spectrum.indigo,
  Band: theme.colors.spectrum.green,
  Dancer: theme.colors.spectrum.pink,
  Comedian: theme.colors.spectrum.amber,
  Magician: theme.colors.spectrum.purple,
}
const posterAccents = [theme.colors.spectrum.cyan, theme.colors.spectrum.orange, theme.colors.spectrum.violet, theme.colors.spectrum.teal, theme.colors.spectrum.magenta]

function demoPoster(category, name, index) {
  const primary = posterColors[category]
  const secondary = posterAccents[index]
  const initials = name.split(' ').filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase()
  const shift = index * 24
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800"><rect width="1200" height="800" fill="${theme.colors.background.surfaceWarm}"/><path d="M${560 + shift} 0H1200V800H${820 - shift}L${400 + shift} 460Z" fill="${primary}"/><path d="M${820 + shift} 0H1200V${570 + shift}L${590 - shift} ${360 + shift}Z" fill="${secondary}" opacity=".83"/><path d="M1200 ${180 + shift}V800H${900 - shift}L${740 - shift} ${420 + shift}Z" fill="${theme.colors.background.surface}" opacity=".34"/><path d="M${640 + shift} 0L${400 + shift} 460L${590 - shift} ${360 + shift}Z" fill="${theme.colors.background.surface}" opacity=".55"/><text x="72" y="102" fill="${theme.colors.text.secondary}" font-family="sans-serif" font-size="27" font-weight="700" letter-spacing="8">EVNTRA / ${category.toUpperCase()}</text><text x="64" y="683" fill="${theme.colors.text.primary}" font-family="sans-serif" font-size="280" font-weight="700" letter-spacing="-18">${initials}</text><path d="M74 723H475" stroke="${primary}" stroke-width="12" stroke-linecap="round"/></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

const read = (name, fallback) => {
  try { return JSON.parse(localStorage.getItem(PREFIX + name)) ?? fallback } catch { return fallback }
}
const write = (name, value) => localStorage.setItem(PREFIX + name, JSON.stringify(value))
const result = data => ({ data, error: null })
const failure = message => ({ data: null, error: { message } })

function demoMediaStore(mode, value) {
  return new Promise((resolve, reject) => {
    const opening = indexedDB.open('evntra-portfolio', 1)
    opening.onupgradeneeded = () => opening.result.createObjectStore('media', { keyPath: 'id' })
    opening.onerror = () => reject(opening.error)
    opening.onsuccess = () => {
      const db = opening.result
      const transaction = db.transaction('media', mode === 'get' ? 'readonly' : 'readwrite')
      const store = transaction.objectStore('media')
      const request = mode === 'get' ? store.getAll() : mode === 'put' ? store.put(value) : store.delete(value)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
      transaction.oncomplete = () => db.close()
    }
  })
}

async function demoMediaFor(artistId) {
  const rows = await demoMediaStore('get')
  return rows.filter(row => row.artist_id === artistId).sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map(({ file, ...row }) => ({ ...row, media_url: URL.createObjectURL(file) }))
}

function seededArtists() {
  return categories.flatMap(category => seedNames[category].map((name, index) => ({
    id: `demo-${category.toLowerCase()}-${index + 1}`,
    user_id: `demo-seed-${category.toLowerCase()}-${index + 1}`,
    name, category, city: cities[index],
    bio: `${name} brings ${descriptions[category].toLowerCase()} Available for a performance shaped around your event.`,
    price_per_event: prices[category] + index * 2500,
    profile_image_url: demoPoster(category, name, index),
    tags: [category, cities[index], 'Events'], rating: 4.5 + index * 0.1,
    details: Object.fromEntries(categoryFields[category].map(field => [field.key, field.placeholder.split(',')[0]])),
    created_at: new Date().toISOString(), artist_media: [], reviews: [],
  })))
}

function artists() {
  const existing = read('artists', null)
  if (existing) {
    // Keep existing local changes while moving old sample records away from
    // the shared demo login. Every account may own only one real listing.
    const migrated = existing.map(item => {
      if (!/^demo-(singer|dj|band|dancer|comedian|magician)-[1-5]$/.test(item.id)) return item
      const index = Number(item.id.slice(-1)) - 1
      const changes = {}
      if (item.user_id === 'artist-demo') changes.user_id = item.id.replace(/^demo-/, 'demo-seed-')
      if (!item.details) changes.details = Object.fromEntries(categoryFields[item.category].map(field => [field.key, field.placeholder.split(',')[0]]))
      if (item.profile_image_url?.startsWith('https://images.unsplash.com/')) changes.profile_image_url = demoPoster(item.category, item.name, index)
      return Object.keys(changes).length ? { ...item, ...changes } : item
    })
    if (migrated.some((item, index) => item !== existing[index])) write('artists', migrated)
    return migrated
  }
  const initial = seededArtists()
  write('artists', initial)
  return initial
}

const accounts = () => [
  { id: 'artist-demo', email: 'artist@gmail.com', full_name: 'Demo Artist', password: 'password' },
  { id: 'user-demo', email: 'user@gmail.com', full_name: 'Demo User', password: 'password' },
  ...read('accounts', []),
]

async function hashPassword(password, salt) {
  const bytes = new TextEncoder().encode(`${salt}:${password}`)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

let listeners = new Set()
const broadcast = user => listeners.forEach(listener => listener(user))

export const authClient = {
  async getSession() { return demoMode ? result({ session: read('session', null) ? { user: read('session', null) } : null }) : supabase.auth.getSession() },
  subscribe(listener) {
    if (demoMode) { listeners.add(listener); return () => listeners.delete(listener) }
    const { data } = supabase.auth.onAuthStateChange((_event, session) => listener(session?.user || null))
    return () => data.subscription.unsubscribe()
  },
  async signIn(email, password) {
    if (!demoMode) return supabase.auth.signInWithPassword({ email, password })
    const account = accounts().find(item => item.email.toLowerCase() === email.trim().toLowerCase())
    const valid = account && (account.password === password || (account.passwordHash && account.passwordHash === await hashPassword(password, account.salt)))
    if (!valid) return failure('Incorrect email or password.')
    const user = { id: account.id, email: account.email, user_metadata: { full_name: account.full_name } }
    write('session', user); broadcast(user)
    return result({ user, session: { user } })
  },
  async signUp(email, password, name) {
    if (!demoMode) return supabase.auth.signUp({ email, password, options: { data: { full_name: name } } })
    if (accounts().some(item => item.email.toLowerCase() === email.trim().toLowerCase())) return failure('An account with this email already exists.')
    const salt = crypto.randomUUID()
    const user = { id: crypto.randomUUID(), email: email.trim(), full_name: name.trim(), salt, passwordHash: await hashPassword(password, salt) }
    write('accounts', [...read('accounts', []), user])
    const sessionUser = { id: user.id, email: user.email, user_metadata: { full_name: user.full_name } }
    write('session', sessionUser); broadcast(sessionUser)
    return result({ user: sessionUser, session: { user: sessionUser } })
  },
  async signOut() {
    if (!demoMode) return supabase.auth.signOut()
    localStorage.removeItem(PREFIX + 'session'); broadcast(null)
    return result(null)
  },
}

export const dataClient = {
  async listArtists() { return demoMode ? result(artists()) : supabase.from('artists').select('*').order('created_at', { ascending: false }) },
  async getArtist(id) {
    if (!demoMode) return supabase.from('artists').select('*, artist_media(*), reviews(rating, comment, created_at)').eq('id', id).single()
    const artist = artists().find(item => item.id === id)
    if (!artist) return failure('Artist not found')
    try { return result({ ...artist, artist_media: await demoMediaFor(id) }) }
    catch { return failure('Could not load artist media from this browser.') }
  },
  async listArtistMedia(artistId) {
    if (!demoMode) return supabase.from('artist_media').select('*').eq('artist_id', artistId).order('created_at', { ascending: false })
    try { return result(await demoMediaFor(artistId)) }
    catch { return failure('Could not load portfolio media from this browser.') }
  },
  async addArtistMedia(file, artistId, userId) {
    const mediaType = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : null
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm']
    if (!allowed.includes(file.type) || !mediaType) return failure('Choose a JPG, PNG, WebP, MP4, or WebM file.')
    if (file.size > 50_000_000) return failure('Each image or video must be under 50 MB.')
    if (demoMode && !artists().some(item => item.id === artistId && item.user_id === userId)) return failure('Only the listing owner can post media.')
    if (demoMode) {
      const item = { id: crypto.randomUUID(), artist_id: artistId, media_type: mediaType, created_at: new Date().toISOString(), file }
      try { await demoMediaStore('put', item); return result({ ...item, file: undefined, media_url: URL.createObjectURL(file) }) }
      catch { return failure('Could not save the file in this browser. Check available storage space.') }
    }
    const extension = file.type.split('/')[1] === 'jpeg' ? 'jpg' : file.type.split('/')[1]
    const path = `${userId}/${artistId}/${crypto.randomUUID()}.${extension}`
    const uploaded = await supabase.storage.from('artist-gallery').upload(path, file, { contentType: file.type, upsert: false })
    if (uploaded.error) return { data: null, error: uploaded.error }
    const media_url = supabase.storage.from('artist-gallery').getPublicUrl(path).data.publicUrl
    const saved = await supabase.from('artist_media').insert({ artist_id: artistId, media_type: mediaType, media_url }).select().single()
    if (saved.error) await supabase.storage.from('artist-gallery').remove([path])
    return saved
  },
  async removeArtistMedia(item, artistId, userId) {
    if (demoMode) {
      if (!artists().some(artist => artist.id === artistId && artist.user_id === userId)) return failure('Only the listing owner can remove media.')
      try { await demoMediaStore('delete', item.id); return result(null) }
      catch { return failure('Could not remove this file from the browser.') }
    }
    const removed = await supabase.from('artist_media').delete().eq('id', item.id).eq('artist_id', artistId)
    if (removed.error) return removed
    const marker = '/artist-gallery/'
    const path = item.media_url?.split(marker)[1]?.split('?')[0]
    if (path?.startsWith(`${userId}/${artistId}/`)) await supabase.storage.from('artist-gallery').remove([decodeURIComponent(path)])
    return result(null)
  },
  async saveArtist(payload, id) {
    if (!demoMode) return id ? supabase.from('artists').update(payload).eq('id', id).eq('user_id', payload.user_id) : supabase.from('artists').insert(payload)
    const all = artists()
    if (!id && all.some(item => item.user_id === payload.user_id)) return failure('You already have a listing. Edit it instead of creating another.')
    if (id && !all.some(item => item.id === id && item.user_id === payload.user_id)) return failure('Listing not found or access denied')
    const saved = { ...payload, id: id || crypto.randomUUID(), created_at: new Date().toISOString(), rating: 0, artist_media: [], reviews: [] }
    try {
      write('artists', id ? all.map(item => item.id === id ? { ...item, ...saved } : item) : [saved, ...all])
    } catch {
      return failure('Browser storage is full. Try a smaller profile photo.')
    }
    return result(saved)
  },
  async deleteArtist(id, userId) {
    if (!demoMode) return supabase.from('artists').delete().eq('id', id).eq('user_id', userId).select('id').single()
    const all = artists()
    if (!all.some(item => item.id === id && item.user_id === userId)) return failure('Listing not found or access denied')
    try {
      const media = await demoMediaFor(id)
      await Promise.all(media.map(item => demoMediaStore('delete', item.id)))
      write('artists', all.filter(item => item.id !== id))
      write('bookings', read('bookings', []).filter(item => item.artist_id !== id))
      return result({ id })
    } catch {
      return failure('Could not delete this listing from the browser.')
    }
  },
  async uploadProfilePhoto(file, userId) {
    if (!file.type.startsWith('image/') || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return failure('Choose a JPG, PNG, or WebP image.')
    if (file.size > (demoMode ? 1_500_000 : 5_000_000)) return failure(demoMode ? 'For the browser demo, use an image under 1.5 MB.' : 'Use an image under 5 MB.')
    if (demoMode) return new Promise(resolve => {
      const reader = new FileReader()
      reader.onload = () => resolve(result(reader.result))
      reader.onerror = () => resolve(failure('Could not read the image.'))
      reader.readAsDataURL(file)
    })
    const extension = file.type.split('/')[1] === 'jpeg' ? 'jpg' : file.type.split('/')[1]
    const path = `${userId}/${crypto.randomUUID()}.${extension}`
    const { error } = await supabase.storage.from('artist-profiles').upload(path, file, { contentType: file.type, upsert: false })
    if (error) return { data: null, error }
    return result(supabase.storage.from('artist-profiles').getPublicUrl(path).data.publicUrl)
  },
  async ownedArtists(userId) { return demoMode ? result(artists().filter(item => item.user_id === userId)) : supabase.from('artists').select('*').eq('user_id', userId).order('created_at', { ascending: false }) },
  async createBooking(payload) {
    if (!demoMode) return supabase.from('bookings').insert(payload)
    if (!artists().some(item => item.id === payload.artist_id)) return failure('Artist not found')
    const booking = { ...payload, id: crypto.randomUUID(), created_at: new Date().toISOString() }
    write('bookings', [...read('bookings', []), booking])
    return result(booking)
  },
  async customerBookings(userId) {
    if (!demoMode) return supabase.from('bookings').select('*, artists(name, category, profile_image_url)').eq('user_id', userId).order('event_date', { ascending: true })
    return result(read('bookings', []).filter(item => item.user_id === userId).map(item => ({ ...item, artists: artists().find(artist => artist.id === item.artist_id) })).sort((a, b) => a.event_date.localeCompare(b.event_date)))
  },
  async artistRequests(artistIds) {
    if (!demoMode) return supabase.from('bookings').select('*, artists(name, category), profiles!bookings_user_id_fkey(full_name, email)').in('artist_id', artistIds).order('created_at', { ascending: false })
    return result(read('bookings', []).filter(item => artistIds.includes(item.artist_id)).map(item => ({ ...item, artists: artists().find(artist => artist.id === item.artist_id), profiles: accounts().find(account => account.id === item.user_id) })).sort((a, b) => b.created_at.localeCompare(a.created_at)))
  },
  async respondToBooking(bookingId, status, ownerId) {
    if (!demoMode) return supabase.rpc('respond_to_booking', { p_booking_id: bookingId, p_status: status })
    const all = read('bookings', [])
    const target = all.find(item => item.id === bookingId && item.status === 'pending' && artists().some(artist => artist.id === item.artist_id && artist.user_id === ownerId))
    if (!target) return failure('Pending booking not found or access denied')
    if (status === 'confirmed' && all.some(item => item.id !== bookingId && item.artist_id === target.artist_id && item.event_date === target.event_date && item.event_time === target.event_time && item.status === 'confirmed')) return failure('This time slot is already confirmed.')
    write('bookings', all.map(item => item.id === bookingId ? { ...item, status } : item))
    return result(null)
  },
}

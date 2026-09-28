from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from supabase import Client

from ..auth import current_user_id
from ..database import get_supabase
from ..schemas import CommentCreate, PostCreate, ProfileUpdate, ShareCreate

router = APIRouter(tags=['social'])


def error(code: str, message: str, http_status: int = 400):
    raise HTTPException(http_status, {'code': code, 'message': message})


def post_query(db: Client):
    return db.table('posts').select('*, post_media(*), profiles!posts_author_id_fkey(id,username,display_name,avatar_url,city), artists(id,name,category,city), post_likes(user_id)')


@router.get('/feed')
def feed(tab: str = Query('for_you', pattern='^(for_you|following)$'), cursor: datetime | None = None,
         db: Client = Depends(get_supabase), viewer: UUID = Depends(current_user_id)):
    query = post_query(db)
    if tab == 'following':
        followed = db.table('follows').select('following_id').eq('follower_id', str(viewer)).execute().data
        ids = [row['following_id'] for row in followed]
        if not ids:
            return {'items': [], 'next_cursor': None}
        query = query.in_('author_id', ids)
    if cursor:
        query = query.lt('created_at', cursor.isoformat())
    rows = query.order('created_at', desc=True).limit(11).execute().data
    return {'items': rows[:10], 'next_cursor': rows[9]['created_at'] if len(rows) > 10 else None}


@router.post('/posts', status_code=status.HTTP_201_CREATED)
def create_post(payload: PostCreate, db: Client = Depends(get_supabase), viewer: UUID = Depends(current_user_id)):
    listing = db.table('artists').select('id').eq('user_id', str(viewer)).limit(1).execute().data
    if not listing:
        error('LISTING_REQUIRED', 'List yourself before creating a post.', 403)
    if payload.media_type == 'video' and (len(payload.media) != 1 or payload.media[0].get('kind') != 'video'):
        error('INVALID_MEDIA', 'Video posts must contain exactly one video.')
    if payload.media_type == 'image' and any(item.get('kind') != 'image' for item in payload.media):
        error('INVALID_MEDIA', 'Image posts may contain images only.')
    post = db.table('posts').insert({'author_id': str(viewer), 'artist_id': listing[0]['id'], 'caption': payload.caption, 'media_type': payload.media_type}).execute().data[0]
    media = [dict(item, post_id=post['id'], position=i) for i, item in enumerate(payload.media)]
    db.table('post_media').insert(media).execute()
    return post_query(db).eq('id', post['id']).single().execute().data


@router.get('/posts/{post_id}')
def get_post(post_id: UUID, db: Client = Depends(get_supabase), _viewer: UUID = Depends(current_user_id)):
    data = post_query(db).eq('id', str(post_id)).execute().data
    if not data: error('NOT_FOUND', 'Post not found.', 404)
    return data[0]


@router.delete('/posts/{post_id}', status_code=204)
def delete_post(post_id: UUID, db: Client = Depends(get_supabase), viewer: UUID = Depends(current_user_id)):
    data = db.table('posts').delete().eq('id', str(post_id)).eq('author_id', str(viewer)).execute().data
    if not data: error('NOT_FOUND', 'Post not found or not owned by you.', 404)


@router.post('/posts/{post_id}/like', status_code=201)
def like(post_id: UUID, db: Client = Depends(get_supabase), viewer: UUID = Depends(current_user_id)):
    db.table('post_likes').upsert({'post_id': str(post_id), 'user_id': str(viewer)}).execute()
    return {'liked': True}


@router.delete('/posts/{post_id}/like')
def unlike(post_id: UUID, db: Client = Depends(get_supabase), viewer: UUID = Depends(current_user_id)):
    db.table('post_likes').delete().eq('post_id', str(post_id)).eq('user_id', str(viewer)).execute()
    return {'liked': False}


@router.get('/posts/{post_id}/comments')
def comments(post_id: UUID, cursor: datetime | None = None, db: Client = Depends(get_supabase), _viewer: UUID = Depends(current_user_id)):
    query = db.table('post_comments').select('*, profiles!post_comments_user_id_fkey(id,username,display_name,avatar_url)').eq('post_id', str(post_id))
    if cursor: query = query.lt('created_at', cursor.isoformat())
    rows = query.order('created_at', desc=True).limit(21).execute().data
    return {'items': rows[:20], 'next_cursor': rows[19]['created_at'] if len(rows) > 20 else None}


@router.post('/posts/{post_id}/comments', status_code=201)
def comment(post_id: UUID, payload: CommentCreate, db: Client = Depends(get_supabase), viewer: UUID = Depends(current_user_id)):
    return db.table('post_comments').insert({'post_id': str(post_id), 'user_id': str(viewer), **payload.model_dump(mode='json')}).execute().data[0]


@router.delete('/comments/{comment_id}', status_code=204)
def delete_comment(comment_id: UUID, db: Client = Depends(get_supabase), viewer: UUID = Depends(current_user_id)):
    row = db.table('post_comments').select('user_id,posts!inner(author_id)').eq('id', str(comment_id)).execute().data
    if not row or str(viewer) not in (row[0]['user_id'], row[0]['posts']['author_id']): error('FORBIDDEN', 'You cannot delete this comment.', 403)
    db.table('post_comments').delete().eq('id', str(comment_id)).execute()


@router.post('/users/{user_id}/follow', status_code=201)
def follow(user_id: UUID, db: Client = Depends(get_supabase), viewer: UUID = Depends(current_user_id)):
    if user_id == viewer: error('SELF_FOLLOW', 'You cannot follow yourself.')
    db.table('follows').upsert({'follower_id': str(viewer), 'following_id': str(user_id)}).execute(); return {'following': True}


@router.delete('/users/{user_id}/follow')
def unfollow(user_id: UUID, db: Client = Depends(get_supabase), viewer: UUID = Depends(current_user_id)):
    db.table('follows').delete().eq('follower_id', str(viewer)).eq('following_id', str(user_id)).execute(); return {'following': False}


@router.get('/users/{user_id}/{direction}')
def follow_list(user_id: UUID, direction: str, db: Client = Depends(get_supabase), _viewer: UUID = Depends(current_user_id)):
    if direction not in ('followers', 'following'): error('NOT_FOUND', 'Unknown follow list.', 404)
    match, relation = ('following_id', 'follower_id') if direction == 'followers' else ('follower_id', 'following_id')
    rows = db.table('follows').select(f'{relation}, profiles!follows_{relation}_fkey(*)').eq(match, str(user_id)).execute().data
    return [row['profiles'] for row in rows]


@router.get('/profiles/{username}')
def profile(username: str, db: Client = Depends(get_supabase), viewer: UUID = Depends(current_user_id)):
    rows = db.table('profiles').select('*').ilike('username', username).execute().data
    if not rows: error('NOT_FOUND', 'Profile not found.', 404)
    result = rows[0]; uid = result['id']
    result['artist'] = next(iter(db.table('artists').select('*').eq('user_id', uid).execute().data), None)
    result['posts'] = post_query(db).eq('author_id', uid).order('created_at', desc=True).execute().data
    result['follower_count'] = len(db.table('follows').select('follower_id').eq('following_id', uid).execute().data)
    result['following_count'] = len(db.table('follows').select('following_id').eq('follower_id', uid).execute().data)
    result['is_following'] = bool(db.table('follows').select('following_id').eq('follower_id', str(viewer)).eq('following_id', uid).execute().data)
    return result


@router.patch('/profiles/me')
def update_profile(payload: ProfileUpdate, db: Client = Depends(get_supabase), viewer: UUID = Depends(current_user_id)):
    values = payload.model_dump(exclude_none=True)
    return db.table('profiles').update(values).eq('id', str(viewer)).execute().data[0]


@router.post('/posts/{post_id}/share', status_code=201)
def share(post_id: UUID, payload: ShareCreate, db: Client = Depends(get_supabase), viewer: UUID = Depends(current_user_id)):
    from .messages import ensure_conversation
    conversation = ensure_conversation(db, viewer, payload.recipient_id)
    message = db.table('messages').insert({'conversation_id': conversation, 'sender_id': str(viewer), 'type': 'shared_post', 'shared_post_id': str(post_id)}).execute().data[0]
    db.table('post_shares').insert({'post_id': str(post_id), 'sender_id': str(viewer), 'recipient_id': str(payload.recipient_id)}).execute()
    return message

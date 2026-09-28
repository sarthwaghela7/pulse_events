from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from supabase import Client
from ..auth import current_user_id
from ..database import get_supabase
from ..schemas import ConversationCreate, MessageCreate

router = APIRouter(tags=['messages'])

def ensure_conversation(db: Client, first: UUID, second: UUID):
    if first == second: raise HTTPException(400, {'code':'SELF_MESSAGE','message':'Choose another person.'})
    pair = ':'.join(sorted((str(first), str(second))))
    rows = db.table('conversations').select('id').eq('pair_key', pair).execute().data
    if rows: return rows[0]['id']
    conversation = db.table('conversations').insert({'pair_key': pair}).execute().data[0]
    db.table('conversation_participants').insert([{'conversation_id':conversation['id'],'user_id':str(first)}, {'conversation_id':conversation['id'],'user_id':str(second)}]).execute()
    return conversation['id']

def require_participant(db, conversation_id, user_id):
    if not db.table('conversation_participants').select('user_id').eq('conversation_id', str(conversation_id)).eq('user_id', str(user_id)).execute().data:
        raise HTTPException(403, {'code':'FORBIDDEN','message':'You are not part of this conversation.'})

@router.get('/conversations')
def conversations(db: Client=Depends(get_supabase), viewer: UUID=Depends(current_user_id)):
    memberships=db.table('conversation_participants').select('conversation_id,last_read_at,conversations(*,messages(*))').eq('user_id',str(viewer)).execute().data
    return sorted(memberships,key=lambda x:x['conversations']['last_message_at'],reverse=True)

@router.post('/conversations', status_code=201)
def start(payload: ConversationCreate, db: Client=Depends(get_supabase), viewer: UUID=Depends(current_user_id)):
    return {'id':ensure_conversation(db,viewer,payload.user_id)}

@router.get('/conversations/{conversation_id}/messages')
def list_messages(conversation_id: UUID, db: Client=Depends(get_supabase), viewer: UUID=Depends(current_user_id)):
    require_participant(db,conversation_id,viewer)
    return db.table('messages').select('*,posts:shared_post_id(*,post_media(*)),artists:shared_artist_id(*)').eq('conversation_id',str(conversation_id)).order('created_at').execute().data

@router.post('/conversations/{conversation_id}/messages', status_code=201)
def send(conversation_id: UUID,payload: MessageCreate,db: Client=Depends(get_supabase),viewer: UUID=Depends(current_user_id)):
    require_participant(db,conversation_id,viewer)
    if payload.type=='text' and not payload.body: raise HTTPException(422, {'code':'BODY_REQUIRED','message':'Write a message.'})
    row={'conversation_id':str(conversation_id),'sender_id':str(viewer),**payload.model_dump(mode='json')}
    message=db.table('messages').insert(row).execute().data[0]
    db.table('conversations').update({'last_message_at':message['created_at']}).eq('id',str(conversation_id)).execute()
    return message

@router.post('/conversations/{conversation_id}/read')
def read(conversation_id: UUID,db: Client=Depends(get_supabase),viewer: UUID=Depends(current_user_id)):
    require_participant(db,conversation_id,viewer)
    db.table('conversation_participants').update({'last_read_at':'now()'}).eq('conversation_id',str(conversation_id)).eq('user_id',str(viewer)).execute()
    return {'read':True}

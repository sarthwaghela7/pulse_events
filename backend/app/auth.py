from uuid import UUID

from fastapi import Depends, Header, HTTPException
from supabase import Client

from .database import get_supabase


def current_user_id(authorization: str | None = Header(default=None), db: Client = Depends(get_supabase)) -> UUID:
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(401, 'Sign in required')
    try:
        response = db.auth.get_user(authorization[7:])
        if not response.user:
            raise ValueError('No user')
        return UUID(response.user.id)
    except Exception as exc:
        raise HTTPException(401, 'Invalid session') from exc

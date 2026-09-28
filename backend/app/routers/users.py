from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from supabase import Client

from ..database import get_supabase

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/{user_id}")
def get_user(user_id: UUID, db: Client = Depends(get_supabase)):
    data = db.table("profiles").select("*").eq("id", str(user_id)).execute().data
    if not data:
        raise HTTPException(404, "User not found")
    return data[0]


import os
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from supabase import Client

from ..auth import COOKIE_NAME, SESSION_SECONDS, create_session, current_user_id, hash_password, verify_password
from ..database import get_supabase
from ..schemas import AuthCredentials

router = APIRouter(prefix="/auth", tags=["auth"])


def public_user(profile: dict) -> dict:
    name = profile.get("display_name") or profile.get("full_name") or profile["email"].split("@")[0]
    return {"id": profile["id"], "email": profile["email"], "user_metadata": {"full_name": name}}


def set_session_cookie(response: Response, user_id: UUID) -> None:
    response.set_cookie(
        COOKIE_NAME,
        create_session(user_id),
        max_age=SESSION_SECONDS,
        httponly=True,
        secure=os.getenv("COOKIE_SECURE", "false").lower() == "true",
        samesite="lax",
        path="/",
    )


@router.post("/signup", status_code=status.HTTP_201_CREATED)
def signup(payload: AuthCredentials, response: Response, db: Client = Depends(get_supabase)):
    email = payload.email.strip().lower()
    if db.table("app_accounts").select("id").eq("email", email).limit(1).execute().data:
        raise HTTPException(409, "An account with this email already exists.")
    user_id = uuid4()
    name = email.split("@", 1)[0]
    profile = {"id": str(user_id), "email": email, "full_name": name, "display_name": name, "username": f"{name[:20]}-{str(user_id)[:6]}"}
    db.table("profiles").insert(profile).execute()
    try:
        db.table("app_accounts").insert({"id": str(user_id), "email": email, "password_hash": hash_password(payload.password)}).execute()
    except Exception:
        db.table("profiles").delete().eq("id", str(user_id)).execute()
        raise
    set_session_cookie(response, user_id)
    return {"user": public_user(profile)}


@router.post("/signin")
def signin(payload: AuthCredentials, response: Response, db: Client = Depends(get_supabase)):
    email = payload.email.strip().lower()
    rows = db.table("app_accounts").select("id,email,password_hash").eq("email", email).limit(1).execute().data
    if not rows or not verify_password(payload.password, rows[0]["password_hash"]):
        raise HTTPException(401, "Incorrect email or password.")
    profiles = db.table("profiles").select("*").eq("id", rows[0]["id"]).limit(1).execute().data
    if not profiles:
        raise HTTPException(500, "Account profile is missing.")
    set_session_cookie(response, UUID(rows[0]["id"]))
    return {"user": public_user(profiles[0])}


@router.get("/session")
def session(request: Request, db: Client = Depends(get_supabase)):
    user_id = current_user_id(request)
    profiles = db.table("profiles").select("*").eq("id", str(user_id)).limit(1).execute().data
    if not profiles:
        raise HTTPException(401, "Account no longer exists.")
    return {"user": public_user(profiles[0])}


@router.post("/signout", status_code=204)
def signout(response: Response):
    response.delete_cookie(COOKIE_NAME, path="/")

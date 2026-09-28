from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from supabase import Client

from ..database import get_supabase
from ..auth import current_user_id
from ..schemas import ArtistCreate

router = APIRouter(prefix="/artists", tags=["artists"])


@router.get("/search")
def search_artists(q: str | None = None, category: list[str] = Query(default=[]), city: str | None = None,
                   min_rating: float | None = None, min_price: float | None = None, max_price: float | None = None,
                   sort: str = "relevance", cursor: int = 0, db: Client = Depends(get_supabase)):
    query = db.table("artists").select("*, profiles!artists_user_id_fkey(id,username,display_name,avatar_url), follows!follows_following_id_fkey(count)")
    if q:
        safe = q.replace(",", " ")
        query = query.or_(f"name.ilike.%{safe}%,bio.ilike.%{safe}%,category.ilike.%{safe}%,city.ilike.%{safe}%")
    if category: query = query.in_("category", category)
    if city: query = query.ilike("city", f"%{city}%")
    if min_rating is not None: query = query.gte("rating", min_rating)
    if min_price is not None: query = query.gte("price_per_event", min_price)
    if max_price is not None: query = query.lte("price_per_event", max_price)
    ordering = {"rating": ("rating", True), "price_low": ("price_per_event", False), "price_high": ("price_per_event", True), "newest": ("created_at", True)}
    column, desc = ordering.get(sort, ("created_at", True))
    rows = query.order(column, desc=desc).range(cursor, cursor + 10).execute().data
    return {"items": rows[:10], "next_cursor": cursor + 10 if len(rows) > 10 else None}


@router.get("")
def list_artists(category: str | None = None, city: str | None = None,
                 q: str | None = Query(default=None, max_length=100),
                 db: Client = Depends(get_supabase)):
    query = db.table("artists").select("*, artist_media(*)")
    if category:
        query = query.eq("category", category)
    if city:
        query = query.ilike("city", f"%{city}%")
    if q:
        safe = q.replace(",", " ")
        query = query.or_(f"name.ilike.%{safe}%,bio.ilike.%{safe}%,category.ilike.%{safe}%")
    return query.order("created_at", desc=True).execute().data


@router.get("/{artist_id}")
def get_artist(artist_id: UUID, db: Client = Depends(get_supabase)):
    data = db.table("artists").select("*, artist_media(*), reviews(rating, comment, created_at)").eq("id", str(artist_id)).execute().data
    if not data:
        raise HTTPException(404, "Artist not found")
    return data[0]


@router.post("", status_code=status.HTTP_201_CREATED)
def create_artist(payload: ArtistCreate, db: Client = Depends(get_supabase), user_id: UUID = Depends(current_user_id)):
    if payload.user_id != user_id:
        raise HTTPException(403, "You can only create your own listing")
    data = db.table("artists").insert(payload.model_dump(mode="json")).execute().data
    return data[0]


@router.put("/{artist_id}")
def update_artist(artist_id: UUID, payload: ArtistCreate, db: Client = Depends(get_supabase), user_id: UUID = Depends(current_user_id)):
    if payload.user_id != user_id:
        raise HTTPException(403, "You can only update your own listing")
    data = db.table("artists").update(payload.model_dump(mode="json")).eq("id", str(artist_id)).eq("user_id", str(user_id)).execute().data
    if not data:
        raise HTTPException(404, "Artist not found")
    return data[0]


@router.delete("/{artist_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_artist(artist_id: UUID, db: Client = Depends(get_supabase), user_id: UUID = Depends(current_user_id)):
    data = db.table("artists").delete().eq("id", str(artist_id)).eq("user_id", str(user_id)).execute().data
    if not data:
        raise HTTPException(404, "Artist not found")

from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client

from ..database import get_supabase
from ..auth import current_user_id
from ..schemas import BookingCreate

router = APIRouter(prefix="/bookings", tags=["bookings"])


@router.get("")
def list_bookings(user_id: UUID | None = None, artist_id: UUID | None = None,
                  db: Client = Depends(get_supabase), viewer_id: UUID = Depends(current_user_id)):
    if user_id and user_id != viewer_id:
        raise HTTPException(403, "You can only view your own bookings")
    if artist_id:
        artist = db.table("artists").select("user_id").eq("id", str(artist_id)).execute().data
        if not artist or artist[0]["user_id"] != str(viewer_id):
            raise HTTPException(403, "You do not own this artist")
    if not user_id and not artist_id:
        user_id = viewer_id
    query = db.table("bookings").select("*, artists(name, category, profile_image_url)")
    if artist_id:
        query = query.eq("artist_id", str(artist_id))
    else:
        query = query.eq("user_id", str(user_id))
    return query.order("event_date").execute().data


@router.post("", status_code=status.HTTP_201_CREATED)
def create_booking(user_id: UUID, payload: BookingCreate, db: Client = Depends(get_supabase), viewer_id: UUID = Depends(current_user_id)):
    if user_id != viewer_id:
        raise HTTPException(403, "You can only book for yourself")
    record = payload.model_dump(mode="json") | {"user_id": str(user_id), "status": "pending"}
    return db.table("bookings").insert(record).execute().data[0]


@router.patch("/{booking_id}/status")
def update_status(booking_id: UUID,
                  status_value: Literal["pending", "confirmed", "cancelled", "completed"] | None = None,
                  status: Literal["pending", "confirmed", "cancelled", "completed"] | None = None,
                  db: Client = Depends(get_supabase), viewer_id: UUID = Depends(current_user_id)):
    new_status = status or status_value
    if not new_status:
        raise HTTPException(422, "status query parameter is required")
    booking = db.table("bookings").select("artist_id, status").eq("id", str(booking_id)).execute().data
    if not booking:
        raise HTTPException(404, "Booking not found")
    artist = db.table("artists").select("user_id").eq("id", booking[0]["artist_id"]).execute().data
    if not artist or artist[0]["user_id"] != str(viewer_id):
        raise HTTPException(403, "Only the artist can decide this request")
    if booking[0]["status"] != "pending" or new_status not in ("confirmed", "cancelled"):
        raise HTTPException(409, "Only pending requests can be confirmed or cancelled")
    data = db.table("bookings").update({"status": new_status}).eq("id", str(booking_id)).eq("status", "pending").execute().data
    if not data:
        raise HTTPException(404, "Booking not found")
    return data[0]

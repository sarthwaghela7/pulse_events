from datetime import date, time
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


class ArtistCreate(BaseModel):
    user_id: UUID
    name: str = Field(min_length=1, max_length=120)
    category: str = Field(min_length=1, max_length=80)
    bio: str | None = None
    city: str | None = None
    price_per_event: float | None = Field(default=None, ge=0)
    profile_image_url: str | None = None
    tags: list[str] = []
    details: dict[str, str] = {}


class BookingCreate(BaseModel):
    artist_id: UUID
    event_date: date
    event_time: time | None = None
    event_location: str | None = None
    notes: str | None = None


class PostCreate(BaseModel):
    caption: str = Field(default='', max_length=2000)
    media_type: Literal['image', 'video']
    media: list[dict] = Field(min_length=1, max_length=10)


class CommentCreate(BaseModel):
    body: str = Field(min_length=1, max_length=500)
    parent_id: UUID | None = None


class ProfileUpdate(BaseModel):
    username: str | None = Field(default=None, min_length=3, max_length=30, pattern=r'^[A-Za-z0-9_.]+$')
    display_name: str | None = Field(default=None, min_length=1, max_length=100)
    bio: str | None = Field(default=None, max_length=300)
    city: str | None = Field(default=None, max_length=100)
    avatar_url: str | None = None


class ConversationCreate(BaseModel):
    user_id: UUID


class MessageCreate(BaseModel):
    type: Literal['text', 'shared_post', 'shared_artist'] = 'text'
    body: str | None = Field(default=None, max_length=4000)
    shared_post_id: UUID | None = None
    shared_artist_id: UUID | None = None


class ShareCreate(BaseModel):
    recipient_id: UUID

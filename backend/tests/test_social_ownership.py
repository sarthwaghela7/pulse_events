from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.routers.social import create_post, delete_post
from app.schemas import PostCreate


class Response:
    def __init__(self, data): self.data = data


class Query:
    def __init__(self, data): self.data = data
    def select(self, *_args, **_kwargs): return self
    def eq(self, *_args): return self
    def limit(self, *_args): return self
    def execute(self): return Response(self.data)
    def delete(self): return self


class FakeDb:
    def __init__(self, tables): self.tables = tables
    def table(self, name): return Query(self.tables.get(name, []))


def test_post_creation_requires_listing():
    viewer = uuid4()
    with pytest.raises(HTTPException) as caught:
        create_post(PostCreate(caption='hello', media_type='image', media=[{'url':'https://example.test/a.jpg','kind':'image'}]), FakeDb({'artists': []}), viewer)
    assert caught.value.status_code == 403
    assert caught.value.detail['code'] == 'LISTING_REQUIRED'


def test_delete_rejects_non_owner_or_missing_post():
    with pytest.raises(HTTPException) as caught:
        delete_post(uuid4(), FakeDb({'posts': []}), uuid4())
    assert caught.value.status_code == 404

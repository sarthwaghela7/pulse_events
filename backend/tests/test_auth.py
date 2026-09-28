from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.auth import create_session, hash_password, read_session, verify_password


def test_password_hash_is_salted_and_verifiable():
    first = hash_password("correct horse battery staple")
    second = hash_password("correct horse battery staple")
    assert first != second
    assert verify_password("correct horse battery staple", first)
    assert not verify_password("wrong password", first)


def test_signed_session_round_trip(monkeypatch):
    monkeypatch.setenv("AUTH_SECRET", "test-secret-that-is-at-least-32-characters")
    user_id = uuid4()
    assert read_session(create_session(user_id)) == user_id


def test_tampered_session_is_rejected(monkeypatch):
    monkeypatch.setenv("AUTH_SECRET", "test-secret-that-is-at-least-32-characters")
    token = create_session(uuid4())
    with pytest.raises(HTTPException) as caught:
        read_session(token + "x")
    assert caught.value.status_code == 401

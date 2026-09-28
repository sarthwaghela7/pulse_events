from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import artists, auth, bookings, users, social, messages

app = FastAPI(title="Evntra API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(artists.router)
app.include_router(auth.router)
app.include_router(bookings.router)
app.include_router(users.router)
app.include_router(social.router, prefix="/api")
app.include_router(messages.router, prefix="/api")


@app.get("/")
def root():
    return {"name": "Evntra API", "status": "ok"}


@app.get("/health")
def health():
    return {"status": "healthy"}


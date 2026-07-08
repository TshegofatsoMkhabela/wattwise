from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.api.router import api_router
from app.database import init_db, SessionLocal
from app.db_seed import seed_database

extra_origins = [
    origin.strip()
    for origin in settings.EXTRA_CORS_ORIGINS.split(",")
    if origin.strip()
]

app = FastAPI(
    title=settings.APP_NAME,
    description="Backend API for WattWise smart meter monitoring demo.",
    version="0.3.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.FRONTEND_ORIGIN,
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        *extra_origins,
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api")


@app.on_event("startup")
def on_startup():
    init_db()

    db = SessionLocal()

    try:
        seed_database(db)
    finally:
        db.close()


@app.get("/")
def root():
    return {
        "message": "WattWise backend is running",
        "docs": "/docs",
        "api_health": "/api/health",
    }

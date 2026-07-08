import requests
from fastapi import APIRouter, HTTPException

from app.config import settings

router = APIRouter()


@router.get("/token")
def generate_directline_token():
    if not settings.DIRECTLINE_SECRET:
        raise HTTPException(
            status_code=503,
            detail="Direct Line is not configured on the backend.",
        )

    url = f"{settings.DIRECTLINE_DOMAIN.rstrip('/')}/tokens/generate"
    try:
        response = requests.post(
            url,
            headers={"Authorization": f"Bearer {settings.DIRECTLINE_SECRET}"},
            timeout=10,
        )
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail="Direct Line token service unavailable.") from exc

    if not response.ok:
        raise HTTPException(status_code=response.status_code, detail="Direct Line token generation failed.")

    return response.json()

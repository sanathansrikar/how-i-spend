from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health")
async def health() -> dict[str, str]:
    """Liveness probe used by the host platform and CI smoke tests."""
    return {"status": "ok"}

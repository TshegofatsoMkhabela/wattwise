from fastapi import APIRouter

from app.api.routes import (
    health,
    meters,
    readings,
    alerts,
    dashboards,
    ussd,
    jobs,
    consumer,
    directline,
    households,
    live,
    municipality,
    dispatcher,
)

api_router = APIRouter()

api_router.include_router(health.router, prefix="/health", tags=["Health"])
api_router.include_router(meters.router, prefix="/meters", tags=["Meters"])
api_router.include_router(readings.router, prefix="/readings", tags=["Readings"])
api_router.include_router(alerts.router, prefix="/alerts", tags=["Alerts"])
api_router.include_router(dashboards.router, prefix="/dashboards", tags=["Dashboards"])
api_router.include_router(ussd.router, prefix="/ussd", tags=["USSD"])
api_router.include_router(jobs.router, prefix="/jobs", tags=["Jobs"])
api_router.include_router(live.router, prefix="/live", tags=["Live Demo"])
api_router.include_router(households.router, prefix="/households", tags=["Households"])
api_router.include_router(directline.router, prefix="/directline", tags=["Direct Line"])

# PR2 portal-specific route groups
api_router.include_router(consumer.router, prefix="/consumer", tags=["Consumer Portal"])
api_router.include_router(municipality.router, prefix="/municipality", tags=["Municipality Portal"])
api_router.include_router(dispatcher.router, prefix="/dispatcher", tags=["Dispatcher Portal"])

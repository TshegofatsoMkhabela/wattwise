import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    APP_NAME: str = os.getenv("APP_NAME", "WattWise API")
    APP_ENV: str = os.getenv("APP_ENV", "development")
    FRONTEND_ORIGIN: str = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
    EXTRA_CORS_ORIGINS: str = os.getenv("EXTRA_CORS_ORIGINS", "")

    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "sqlite:///./wattwise_demo.db",
    )
    DIRECTLINE_SECRET: str = os.getenv("DIRECTLINE_SECRET", "")
    DIRECTLINE_DOMAIN: str = os.getenv(
        "DIRECTLINE_DOMAIN",
        "https://directline.botframework.com/v3/directline",
    )
    DEMO_METER_ID: str = os.getenv("DEMO_METER_ID", "NXM-001-TZN")
    DEMO_HIGH_USAGE_THRESHOLD_WATTS: float = float(
        os.getenv("DEMO_HIGH_USAGE_THRESHOLD_WATTS", "1500")
    )
    DEMO_TARIFF_PER_KWH: float = float(os.getenv("DEMO_TARIFF_PER_KWH", "3.9"))


settings = Settings()

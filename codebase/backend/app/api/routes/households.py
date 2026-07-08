from fastapi import APIRouter, HTTPException

from app.config import settings
from app.mock_data import ALERTS, LATEST_READINGS, METERS, READING_HISTORY, now_sast
from app.simulator import simulator

router = APIRouter()


@router.get("/{meter_id}")
def get_household(meter_id: str):
    meter = METERS.get(meter_id)
    if not meter:
        raise HTTPException(status_code=404, detail="Household not found")

    reading = simulator.reading() if meter_id == settings.DEMO_METER_ID else LATEST_READINGS.get(meter_id)
    household_alerts = [alert for alert in ALERTS if alert["meter_id"] == meter_id]
    monthly_usage = 610 if reading["watts"] >= settings.DEMO_HIGH_USAGE_THRESHOLD_WATTS else 520
    previous_month_usage = 540

    return {
        "householdId": "HH-001",
        "customerName": meter["consumer_name"],
        "area": meter["area"],
        "meterId": meter_id,
        "dailyUsageKwh": reading.get("kwh", reading.get("kwh_today", 0)),
        "averageDailyUsageKwh": 10.4,
        "weeklyUsageKwh": 77.2,
        "previousWeekUsageKwh": 69.8,
        "monthlyUsageKwh": monthly_usage,
        "previousMonthUsageKwh": previous_month_usage,
        "monthlyBudgetKwh": 560,
        "estimatedMonthlyCost": round(monthly_usage * settings.DEMO_TARIFF_PER_KWH, 2),
        "peakUsageTime": "18:00-21:00",
        "areaAverageMonthlyUsageKwh": 480,
        "alertCount": len(household_alerts),
        "highestSeverityAlert": household_alerts[0]["severity"] if household_alerts else "NONE",
        "outageReported": False,
        "recommendation": "Reduce geyser, heater, and kitchen appliance usage during evening peak hours.",
        "currentReading": reading,
        "history": READING_HISTORY.get(meter_id, [])[-30:],
        "updatedAt": now_sast(),
    }


@router.get("/demo/profile")
def get_demo_household():
    return get_household(settings.DEMO_METER_ID)

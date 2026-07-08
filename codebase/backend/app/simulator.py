import math
import random
import time
from datetime import datetime, timezone, timedelta
from threading import Lock
from typing import Any, Dict, Literal

from app.config import settings

SAST = timezone(timedelta(hours=2))
SimulatorMode = Literal["normal", "high", "off"]


class HouseholdSimulator:
    def __init__(self):
        self._lock = Lock()
        self._mode: SimulatorMode = "normal"
        self._meter_id = settings.DEMO_METER_ID
        self._started_at = time.time()
        self._kwh_today = 7.8
        self._last_tick = time.time()
        self._overuse_count = 0
        self._last_watts = 720.0

    def configure(self, mode: SimulatorMode | None = None, meter_id: str | None = None) -> Dict[str, Any]:
        with self._lock:
            if mode is not None:
                self._mode = mode
                if mode != "high":
                    self._overuse_count = 0
            if meter_id is not None:
                self._meter_id = meter_id
            return self._reading_locked()

    def command(self, command: str) -> Dict[str, Any]:
        command = command.strip().upper()
        mode: SimulatorMode | None = None
        if command in {"NORMAL", "RESET"}:
            mode = "normal"
        elif command in {"HIGH", "SPIKE", "ALERT"}:
            mode = "high"
        elif command in {"OFF", "POWER_OFF"}:
            mode = "off"
        elif command == "MUTE":
            mode = None
        return self.configure(mode=mode)

    def reading(self) -> Dict[str, Any]:
        with self._lock:
            return self._reading_locked()

    def _reading_locked(self) -> Dict[str, Any]:
        now = time.time()
        elapsed = now - self._started_at
        seconds_since_tick = max(0.0, now - self._last_tick)
        self._last_tick = now

        if self._mode == "off":
            watts = 0.0
            volts = 0.0
            state = "off"
        elif self._mode == "high":
            watts = 1850 + math.sin(elapsed * 1.7) * 170 + random.uniform(-70, 90)
            volts = 230 + random.uniform(-3, 3)
            state = "alert"
        else:
            watts = 680 + math.sin(elapsed * 0.45) * 120 + random.uniform(-45, 45)
            volts = 230 + random.uniform(-2, 2)
            state = "normal"

        watts = max(0.0, watts)
        self._last_watts = watts
        self._kwh_today += (watts / 1000) * (seconds_since_tick / 3600)

        if watts >= settings.DEMO_HIGH_USAGE_THRESHOLD_WATTS:
            self._overuse_count += 1
        else:
            self._overuse_count = 0

        cost_rand = self._kwh_today * settings.DEMO_TARIFF_PER_KWH
        balance_rand = max(0.0, 250.0 - cost_rand)
        hours_left = balance_rand / max(cost_rand / max(self._kwh_today, 0.1), 1.0)

        return {
            "device_id": self._meter_id,
            "meter_id": self._meter_id,
            "ts_iso": datetime.now(SAST).isoformat(),
            "volts": round(volts, 1),
            "watts": round(watts, 1),
            "state": state,
            "mode": self._mode,
            "kwh": round(self._kwh_today, 3),
            "cost_rand": round(cost_rand, 2),
            "balance_rand": round(balance_rand, 2),
            "runout_eta": f"{max(1, int(hours_left))}h" if watts > 0 else "—",
            "overuse_count": self._overuse_count,
            "threshold_watts": settings.DEMO_HIGH_USAGE_THRESHOLD_WATTS,
            "source": "AZURE_DEMO_SIMULATOR",
        }


simulator = HouseholdSimulator()

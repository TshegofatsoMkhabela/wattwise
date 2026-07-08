from fastapi import HTTPException

from app.api.routes.directline import generate_directline_token
from app.api.routes.health import health_check
from app.api.routes.households import get_demo_household
from app.api.routes.live import SimulatorControl, control_simulator


def test_health_route_is_available():
    response = health_check()

    assert response["status"] == "ok"


def test_simulator_can_switch_to_high_usage():
    payload = control_simulator(SimulatorControl(mode="high"))

    assert payload["mode"] == "high"
    assert payload["watts"] >= 1500
    assert payload["state"] == "alert"


def test_demo_household_profile_contains_orchestrator_context():
    payload = get_demo_household()

    assert payload["householdId"] == "HH-001"
    assert payload["meterId"] == "NXM-001-TZN"
    assert "currentReading" in payload
    assert "recommendation" in payload


def test_directline_token_endpoint_does_not_work_without_backend_secret():
    try:
        generate_directline_token()
    except HTTPException as exc:
        assert exc.status_code == 503
        assert exc.detail == "Direct Line is not configured on the backend."
    else:
        raise AssertionError("Expected missing Direct Line secret to raise HTTPException")

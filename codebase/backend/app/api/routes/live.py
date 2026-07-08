import asyncio
from typing import Literal

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

from app.simulator import simulator

router = APIRouter()


class SimulatorControl(BaseModel):
    mode: Literal["normal", "high", "off"] | None = None
    meter_id: str | None = None


@router.get("/reading")
def get_live_reading():
    return simulator.reading()


@router.post("/simulator")
def control_simulator(payload: SimulatorControl):
    return simulator.configure(mode=payload.mode, meter_id=payload.meter_id)


@router.websocket("/ws")
async def live_socket(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            await websocket.send_json(simulator.reading())
            try:
                command = await asyncio.wait_for(websocket.receive_text(), timeout=1.0)
                simulator.command(command)
            except asyncio.TimeoutError:
                pass
    except WebSocketDisconnect:
        return

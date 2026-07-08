import { create } from "zustand";
import type { Reading } from "@/types";

/** Shape of the JSON the Python bridge broadcasts (bridge/predict.py build_live_message). */
interface BridgeMessage {
  device_id: string;
  ts_iso: string;
  volts: number;
  watts: number;
  state: "normal" | "alert" | "off";
  kwh: number;
  cost_rand: number;
  balance_rand: number;
  runout_eta: string;
  overuse_count: number;
}

interface LiveDataState {
  /** true only while a real bridge WebSocket is delivering data */
  connected: boolean;
  /** where the data on screen is coming from */
  source: "bridge" | "sim";
  readings: Reading[];
  current: Reading;
  todayKWh: number;
  state: "normal" | "alert" | "off";
  // Rich bridge-derived fields. null until the first real bridge message arrives.
  costRand: number | null;
  balanceRand: number | null;
  runoutEta: string | null;
  overuseCount: number;
  push: (r: Reading) => void;
  pushBridge: (m: BridgeMessage) => void;
  setConnected: (c: boolean) => void;
  /** send a command back to the bridge/Arduino, e.g. "MUTE" or "OFF" */
  sendCommand: (cmd: string) => boolean;
}

// Live socket, assigned in connect() below. Kept at module scope so the store's
// sendCommand can reach it without re-rendering subscribers.
let socket: WebSocket | null = null;

const baseline = 1950;

export const useLiveData = create<LiveDataState>((set) => ({
  connected: false,
  source: "sim",
  readings: Array.from({ length: 300 }, (_, i) => ({
    timestamp: Date.now() - (300 - i) * 1000,
    watts: baseline + Math.sin(i * 0.1) * 80 + (Math.random() - 0.5) * 60,
    voltage: 230 + (Math.random() - 0.5) * 4,
  })),
  current: { timestamp: Date.now(), watts: baseline, voltage: 230 },
  todayKWh: 18.4,
  state: "normal",
  costRand: null,
  balanceRand: null,
  runoutEta: null,
  overuseCount: 0,
  setConnected: (c) => set({ connected: c, source: c ? "bridge" : "sim" }),
  sendCommand: (cmd) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(cmd);
      return true;
    }
    return false;
  },
  push: (r) =>
    set((s) => {
      const readings = [...s.readings.slice(-299), r];
      return {
        readings,
        current: r,
        todayKWh: s.todayKWh + r.watts / 1000 / 3600,
      };
    }),
  pushBridge: (m) =>
    set((s) => {
      const r: Reading = {
        timestamp: Date.parse(m.ts_iso) || Date.now(),
        watts: m.watts,
        voltage: m.volts,
      };
      return {
        connected: true,
        source: "bridge",
        readings: [...s.readings.slice(-299), r],
        current: r,
        todayKWh: m.kwh,
        state: m.state,
        costRand: m.cost_rand,
        balanceRand: m.balance_rand,
        runoutEta: m.runout_eta,
        overuseCount: m.overuse_count,
      };
    }),
}));

// ── Live data source ────────────────────────────────────────────────
// Connect to the Python bridge over WebSocket. While it is unavailable we keep
// a synthetic simulation running so the UI is never empty during a demo. As soon
// as the bridge sends a message we switch to real data and pause the simulation.
if (typeof window !== "undefined") {
  // Default: same-origin WebSocket through the reverse proxy, so the dashboard
  // works on any host/port with zero config. Uses wss:// automatically over
  // HTTPS. Override only for raw dev (no proxy): ?ws=... or VITE_WS_URL.
  const params = new URLSearchParams(window.location.search);
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  const defaultWsUrl = `${proto}://${window.location.host}/api/live/ws`;
  const WS_URL =
    params.get("ws") ||
    (import.meta as { env?: Record<string, string> }).env?.VITE_WS_URL ||
    defaultWsUrl;

  // Synthetic fallback — only pushes while we are NOT on the real bridge.
  setInterval(() => {
    const s = useLiveData.getState();
    if (s.source === "bridge") return;
    const last = s.current.watts;
    const drift = (Math.random() - 0.5) * 80;
    const watts = Math.max(200, last + drift);
    s.push({
      timestamp: Date.now(),
      watts,
      voltage: 230 + (Math.random() - 0.5) * 4,
    });
  }, 1000);

  const connect = () => {
    let ws: WebSocket;
    try {
      ws = new WebSocket(WS_URL);
    } catch {
      setTimeout(connect, 2000);
      return;
    }
    socket = ws;
    ws.onmessage = (e) => {
      try {
        useLiveData.getState().pushBridge(JSON.parse(e.data) as BridgeMessage);
      } catch {
        /* ignore malformed frames */
      }
    };
    ws.onclose = () => {
      socket = null;
      useLiveData.getState().setConnected(false); // resume simulation
      setTimeout(connect, 2000); // auto-reconnect
    };
    ws.onerror = () => ws.close();
  };
  connect();
}

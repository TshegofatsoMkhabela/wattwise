import type { Alert } from "@/types";
import { meters } from "./meters";

const descs = [
  "Physical tamper detected — seal breach",
  "Load anomaly +68% above baseline — possible illegal connection",
  "Load anomaly +42% above baseline",
  "Voltage spike detected",
  "Reverse current flow detected",
  "Unauthorised bypass suspected",
  "Continuous overdraw for 15+ minutes",
  "Meter cover removed",
];

export const seedAlerts: Alert[] = Array.from({ length: 8 }, (_, i) => {
  const m = meters[(i * 3) % meters.length];
  const sev = i < 3 ? "critical" : i < 6 ? "warning" : "info";
  return {
    id: `ALR-${1000 + i}`,
    meterId: m.id,
    address: m.address,
    severity: sev as Alert["severity"],
    status: i < 2 ? "open" : i < 5 ? "in_progress" : "resolved",
    description: descs[i % descs.length],
    createdAt: new Date(Date.now() - i * 3600_000 * 7).toISOString(),
    assignedTo: i < 2 ? undefined : ["Sipho M.", "Lerato K.", "Andile N."][i % 3],
    deviationPct: 30 + Math.floor(Math.random() * 60),
  };
});

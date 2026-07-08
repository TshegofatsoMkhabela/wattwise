export type Role = "consumer" | "municipality" | "technician";

export type MeterStatus = "normal" | "warning" | "critical" | "offline";

export interface Meter {
  id: string;
  address: string;
  area: string;
  consumerName: string;
  consumerPhone: string;
  status: MeterStatus;
  currentDraw: number;
  baselineWatts: number;
  deviationThreshold: number;
  lastSeenAt: string;
  tamperEvents: number;
  installedAt: string;
  hardwareVersion: string;
  firmwareVersion: string;
  lat: number;
  lng: number;
}

export type AlertSeverity = "critical" | "warning" | "info";
export type AlertStatus = "open" | "in_progress" | "resolved";

export interface Alert {
  id: string;
  meterId: string;
  address: string;
  severity: AlertSeverity;
  status: AlertStatus;
  description: string;
  createdAt: string;
  assignedTo?: string;
  resolutionNote?: string;
  deviationPct?: number;
}

export interface Technician {
  id: string;
  name: string;
  phone: string;
  activeJobs: number;
  resolvedToday: number;
}

export type JobStatus = "assigned" | "en_route" | "on_site" | "resolved";

export interface Job {
  id: string;
  meterId: string;
  address: string;
  technicianId: string;
  severity: AlertSeverity;
  status: JobStatus;
  assignedAt: string;
  notes?: string;
  resolvedAt?: string;
  resolutionNote?: string;
}

export interface Reading {
  timestamp: number;
  watts: number;
  voltage: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  meterId?: string;
}

export interface LoadSheddingSchedule {
  stage: number;
  group: string;
  area: string;
  startsAt: string;
  endsAt: string;
}

import { create } from "zustand";
import type { Alert, Job } from "@/types";
import { seedAlerts } from "@/mock/alerts";
import { seedJobs } from "@/mock/technicians";

interface AlertsState {
  alerts: Alert[];
  jobs: Job[];
  dismiss: (id: string) => void;
  assign: (alertId: string, technicianName: string, jobId: string) => void;
  setJobStatus: (jobId: string, status: Job["status"], note?: string) => void;
}

export const useAlerts = create<AlertsState>((set) => ({
  alerts: seedAlerts,
  jobs: seedJobs,
  dismiss: (id) => set((s) => ({ alerts: s.alerts.filter((a) => a.id !== id) })),
  assign: (alertId, name, jobId) =>
    set((s) => ({
      alerts: s.alerts.map((a) =>
        a.id === alertId ? { ...a, assignedTo: name, status: "in_progress" } : a
      ),
      jobs: [
        ...s.jobs,
        {
          id: jobId,
          meterId: s.alerts.find((a) => a.id === alertId)?.meterId ?? "",
          address: s.alerts.find((a) => a.id === alertId)?.address ?? "",
          technicianId: "TEC-001",
          severity: s.alerts.find((a) => a.id === alertId)?.severity ?? "warning",
          status: "assigned",
          assignedAt: new Date().toISOString(),
        },
      ],
    })),
  setJobStatus: (jobId, status, note) =>
    set((s) => ({
      jobs: s.jobs.map((j) =>
        j.id === jobId
          ? {
              ...j,
              status,
              resolvedAt: status === "resolved" ? new Date().toISOString() : j.resolvedAt,
              resolutionNote: note ?? j.resolutionNote,
            }
          : j
      ),
    })),
}));

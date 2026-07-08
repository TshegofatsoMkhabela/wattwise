import type { Technician, Job } from "@/types";

export const technicians: Technician[] = [
  { id: "TEC-001", name: "Sipho Maluleke", phone: "+27 82 555 0101", activeJobs: 3, resolvedToday: 2 },
  { id: "TEC-002", name: "Lerato Khumalo", phone: "+27 82 555 0102", activeJobs: 2, resolvedToday: 4 },
  { id: "TEC-003", name: "Andile Ncube", phone: "+27 82 555 0103", activeJobs: 1, resolvedToday: 1 },
];

export const seedJobs: Job[] = [
  {
    id: "NXM-2026-0042",
    meterId: "NXM-019-TZN",
    address: "29 Mokoena St, Tzaneen South",
    technicianId: "TEC-001",
    severity: "critical",
    status: "en_route",
    assignedAt: new Date(Date.now() - 2700_000).toISOString(),
    notes: "Reported illegal bypass. Approach with caution.",
  },
  {
    id: "NXM-2026-0043",
    meterId: "NXM-020-TZN",
    address: "30 Mokoena St, Nkowankowa",
    technicianId: "TEC-001",
    severity: "critical",
    status: "assigned",
    assignedAt: new Date(Date.now() - 1200_000).toISOString(),
  },
  {
    id: "NXM-2026-0044",
    meterId: "NXM-015-TZN",
    address: "25 Mokoena St, Letsitele",
    technicianId: "TEC-001",
    severity: "warning",
    status: "on_site",
    assignedAt: new Date(Date.now() - 5400_000).toISOString(),
  },
  {
    id: "NXM-2026-0040",
    meterId: "NXM-008-TZN",
    address: "18 Mokoena St, Lenyenye",
    technicianId: "TEC-001",
    severity: "warning",
    status: "resolved",
    assignedAt: new Date(Date.now() - 14400_000).toISOString(),
    resolvedAt: new Date(Date.now() - 3600_000).toISOString(),
    resolutionNote: "False positive — geyser cycle. Baseline updated.",
  },
];

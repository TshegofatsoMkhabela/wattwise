export interface SavedReport {
  name: string;
  type: string;
  date: string;
  by: string;
  url?: string;
}

const INITIAL_SAVED: SavedReport[] = [
  {
    name: "Consumption_2025-12.csv",
    type: "Consumption",
    date: "2026-01-03",
    by: "Thandi Mokoena",
  },
  { name: "Tamper_Q4_2025.pdf", type: "Tamper", date: "2026-01-02", by: "Thandi Mokoena" },
  { name: "Loadshed_2025-12.pdf", type: "Load-shedding", date: "2025-12-31", by: "System" },
];

let reports: SavedReport[] = [...INITIAL_SAVED];
const listeners = new Set<() => void>();

export function getReports(): SavedReport[] {
  return reports;
}

export function addReport(r: SavedReport) {
  reports = [r, ...reports];
  listeners.forEach((l) => l());
}

export function subscribeReports(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

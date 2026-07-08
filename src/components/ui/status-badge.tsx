import type { MeterStatus } from "@/types";

const styles: Record<MeterStatus | "in_progress" | "open" | "resolved", string> = {
  normal: "bg-teal/10 text-teal-600 border-teal/20",
  warning: "bg-amber-200/40 text-amber-600 border-amber/30",
  critical: "bg-coral-100 text-coral-600 border-coral/30",
  offline: "bg-slate-200 text-slate-800 border-slate/30",
  open: "bg-coral-100 text-coral-600 border-coral/30",
  in_progress: "bg-amber-200/40 text-amber-600 border-amber/30",
  resolved: "bg-teal/10 text-teal-600 border-teal/20",
};

const labels: Record<string, string> = {
  normal: "Normal", warning: "Warning", critical: "Critical", offline: "Offline",
  open: "Open", in_progress: "In Progress", resolved: "Resolved",
  assigned: "Assigned", en_route: "En Route", on_site: "On Site",
};

export function StatusBadge({ status }: { status: string }) {
  const cls = styles[status as MeterStatus] ?? "bg-muted text-muted-foreground border-border";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${cls}`}>
      {labels[status] ?? status}
    </span>
  );
}

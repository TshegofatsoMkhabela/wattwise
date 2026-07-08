import { createFileRoute, Link } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card-basic";
import { useAlerts } from "@/store/alertsStore";
import { useState } from "react";
import { AlertTriangle, ShieldAlert, CheckCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { DispatchModal } from "@/components/ui/dispatch-modal";
import { StatusBadge } from "@/components/ui/status-badge";

export const Route = createFileRoute("/alerts")({
  head: () => ({ meta: [{ title: "Alerts · WattWise" }] }),
  component: () => (
    <AppLayout title="Alerts Centre">
      <AlertsCentre />
    </AppLayout>
  ),
});

const filters = ["all", "critical", "warning", "resolved", "unassigned"] as const;
const ranges = [
  { id: "24h", label: "Last 24 hours" },
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
];

function AlertsCentre() {
  const alerts = useAlerts((s) => s.alerts);
  const [filter, setFilter] = useState<typeof filters[number]>("all");
  const [range, setRange] = useState("7d");
  const [dispatchAlert, setDispatchAlert] = useState<typeof alerts[number] | null>(null);

  const filtered = alerts.filter((a) => {
    if (filter === "all") return true;
    if (filter === "resolved") return a.status === "resolved";
    if (filter === "unassigned") return !a.assignedTo;
    return a.severity === filter;
  });

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex gap-1.5">
            {filters.map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-colors ${
                  filter === f ? "bg-[#005EB8] text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                }`}>{f}</button>
            ))}
          </div>
          <div className="ml-auto">
            <select value={range} onChange={(e)=>setRange(e.target.value)} className="border border-input rounded-lg px-3 py-1.5 text-xs bg-background">
              {ranges.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </div>
        </div>
      </Card>

      <div className="space-y-3">
        {filtered.length === 0 && (
          <Card><div className="text-center py-12 text-sm text-muted-foreground">
            <div className="text-4xl mb-2">✓</div>
            No alerts match this filter. The network is calm.
          </div></Card>
        )}
        {filtered.map((a) => {
          const Icon = a.severity === "critical" ? ShieldAlert : a.severity === "warning" ? AlertTriangle : CheckCircle;
          const border = a.severity === "critical" ? "border-l-red-500" : a.severity === "warning" ? "border-l-amber-400" : "border-l-[#005EB8]";
          const color = a.severity === "critical" ? "text-red-500" : a.severity === "warning" ? "text-amber-600" : "text-[#005EB8]";
          return (
            <Card key={a.id} className={`border-l-4 ${border}`}>
              <div className="flex items-start gap-4">
                <Icon className={`w-5 h-5 mt-0.5 ${color}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[#005EB8] text-sm">{a.meterId}</span>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-sm font-medium">{a.address}</span>
                    <StatusBadge status={a.status} />
                  </div>
                  <div className="mt-1 text-sm">{a.description}</div>
                  <div className="mt-2 text-[11px] text-muted-foreground flex flex-wrap gap-3 items-center">
                    <span>{formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}</span>
                    {a.assignedTo ? (
                      <span>Assigned: <strong>{a.assignedTo}</strong></span>
                    ) : (
                      <button onClick={() => setDispatchAlert(a)} className="text-amber-600 font-semibold hover:underline">Unassigned — dispatch now</button>
                    )}
                    <Link to="/meter/$meterId" params={{ meterId: a.meterId }} className="text-[#005EB8] hover:underline">View meter →</Link>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {dispatchAlert && (
        <DispatchModal open onClose={() => setDispatchAlert(null)}
          meterId={dispatchAlert.meterId} address={dispatchAlert.address}
          alertId={dispatchAlert.id} summary={dispatchAlert.description} />
      )}
    </div>
  );
}

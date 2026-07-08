import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardTitle } from "@/components/ui/card-basic";
import { StatusBadge } from "@/components/ui/status-badge";
import { WaveformChart } from "@/components/charts/WaveformChart";
import { UsageHistoryChart } from "@/components/charts/BarCharts";
import { meters, usageHistory } from "@/mock/meters";
import { useAlerts } from "@/store/alertsStore";
import { CountUp } from "@/components/ui/count-up";
import { useLiveData } from "@/store/liveDataStore";
import { formatZAR, TARIFF_PER_KWH } from "@/lib/format";
import { ArrowLeft, Download, Send, AlertTriangle, ShieldAlert, CheckCircle, Pencil } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { useMemo, useState } from "react";
import { DispatchModal } from "@/components/ui/dispatch-modal";
import { toast } from "sonner";

export const Route = createFileRoute("/meter/$meterId")({
  head: () => ({ meta: [{ title: "Meter detail · WattWise" }] }),
  component: MeterDetailPage,
});

function MeterDetailPage() {
  const { meterId } = useParams({ from: "/meter/$meterId" });
  const meter = meters.find((m) => m.id === meterId);
  return (
    <AppLayout title={`Meter ${meterId}`}>
      {meter ? <MeterDetail meterId={meterId} /> : <div className="text-sm text-slate-400">Meter not found.</div>}
    </AppLayout>
  );
}

function MeterDetail({ meterId }: { meterId: string }) {
  const meter = meters.find((m) => m.id === meterId)!;
  const current = useLiveData((s) => s.current);
  const todayKWh = useLiveData((s) => s.todayKWh);
  const history = useMemo(() => usageHistory(meterId), [meterId]);
  const alerts = useAlerts((s) => s.alerts).filter((a) => a.meterId === meterId);
  const [dispatch, setDispatch] = useState(false);
  const [baseline, setBaseline] = useState(meter.baselineWatts);
  const [threshold, setThreshold] = useState(meter.deviationThreshold);
  const [editBaseline, setEditBaseline] = useState(false);
  const [editThreshold, setEditThreshold] = useState(false);

  return (
    <div className="space-y-6">
      {/* ─── Header ──────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link to="/municipality" className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-700 mb-2">
            <ArrowLeft className="w-3 h-3" />Back to network
          </Link>
          <h2 className="text-2xl font-mono font-bold text-slate-900">{meter.id}</h2>
          <div className="text-sm text-slate-500 mt-1">{meter.address}</div>
          <div className="mt-2 flex items-center gap-3">
            <StatusBadge status={meter.status} />
            <span className="text-xs text-slate-400">Last seen {formatDistanceToNow(new Date(meter.lastSeenAt), { addSuffix: true })}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setDispatch(true)}
            className="inline-flex items-center gap-2 bg-[#005EB8] text-white font-semibold px-3 py-2 rounded-lg text-sm hover:bg-[#003F8A] transition-colors"
          >
            <Send className="w-4 h-4" />Dispatch Technician
          </button>
          <button
            onClick={() => toast.success("Report exported")}
            className="inline-flex items-center gap-2 border border-slate-200 px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Download className="w-4 h-4" />Export PDF
          </button>
        </div>
      </div>

      {/* ─── KPI row ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MiniMetric label="Current draw" value={<><CountUp value={current.watts} /> W</>} accent="text-[#005EB8]" mono />
        <MiniMetric label="Voltage" value={<><CountUp value={current.voltage} decimals={1} /> V</>} mono />
        <MiniMetric label="Today usage" value={<><CountUp value={todayKWh} decimals={2} /> kWh</>} mono />
        <MiniMetric label="Cost today" value={formatZAR(todayKWh * TARIFF_PER_KWH)} accent="text-amber-600" />
      </div>

      {/* ─── Live power draw ─────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Live power draw</h3>
            <p className="text-xs text-slate-400 mt-0.5">Last 5 minutes · Arduino serial</p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#005EB8] bg-[#EBF5FF] px-2.5 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-[#005EB8] animate-pulse" />Live
          </span>
        </div>
        <WaveformChart height={240} />
      </div>

      {/* ─── Tamper history ──────────────────────────────────── */}
      <Card>
        <CardTitle hint={`${alerts.length} events`}>Tamper history</CardTitle>
        {alerts.length === 0 ? (
          <div className="text-xs text-slate-400 py-6 text-center">No tamper events recorded for this meter.</div>
        ) : (
          <div className="space-y-2">
            {alerts.map((a) => {
              const Icon = a.severity === "critical" ? ShieldAlert : a.severity === "warning" ? AlertTriangle : CheckCircle;
              const border = a.severity === "critical" ? "border-l-red-500" : "border-l-amber-400";
              return (
                <div key={a.id} className={`border-l-4 ${border} bg-slate-50 rounded-r-lg p-3`}>
                  <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 flex-shrink-0 ${a.severity === "critical" ? "text-red-500" : "text-amber-500"}`} />
                    <span className="text-xs font-medium text-slate-800">{a.description}</span>
                    <span className="ml-auto text-[10px] text-slate-400 flex-shrink-0">{format(new Date(a.createdAt), "yyyy-MM-dd HH:mm")}</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1 ml-6">
                    Deviation: +{a.deviationPct ?? 42}% · {a.assignedTo ? `Dispatched to ${a.assignedTo}` : "Not dispatched"}
                    {a.resolutionNote && ` · ${a.resolutionNote}`}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* ─── Usage history ───────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Usage history</h3>
            <p className="text-xs text-slate-400 mt-0.5">Last 30 days · <span className="text-red-400 font-medium">red bars</span> mark tamper days</p>
          </div>
        </div>
        <UsageHistoryChart data={history} />
      </div>

      {/* ─── Meter information ───────────────────────────────── */}
      <Card>
        <CardTitle>Meter information</CardTitle>
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-0 text-sm">
          <Info label="Consumer">{meter.consumerName}</Info>
          <Info label="Contact"><span className="font-mono">{meter.consumerPhone}</span></Info>
          <Info label="Installed">{format(new Date(meter.installedAt), "PP")}</Info>
          <Info label="Hardware version">{meter.hardwareVersion}</Info>
          <Info label="Firmware version">{meter.firmwareVersion}</Info>
          <Info label="Serial bridge">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#005EB8] animate-pulse" />
              <span className="text-[#005EB8] font-medium">Online</span>
            </span>
          </Info>
          <Info label="Baseline watts">
            {editBaseline ? (
              <input
                type="number" value={baseline} onChange={(e) => setBaseline(Number(e.target.value))}
                onBlur={() => { setEditBaseline(false); toast.success("Baseline updated"); }}
                autoFocus
                className="font-mono border border-slate-200 rounded px-2 py-0.5 w-24 focus:outline-none focus:ring-2 focus:ring-[#005EB8]/30 focus:border-[#005EB8]"
              />
            ) : (
              <button onClick={() => setEditBaseline(true)} className="font-mono inline-flex items-center gap-1 text-slate-800 hover:text-[#005EB8] transition-colors">
                {baseline} W <Pencil className="w-3 h-3" />
              </button>
            )}
          </Info>
          <Info label="Deviation threshold">
            {editThreshold ? (
              <input
                type="number" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))}
                onBlur={() => { setEditThreshold(false); toast.success("Threshold updated"); }}
                autoFocus
                className="font-mono border border-slate-200 rounded px-2 py-0.5 w-20 focus:outline-none focus:ring-2 focus:ring-[#005EB8]/30 focus:border-[#005EB8]"
              />
            ) : (
              <button onClick={() => setEditThreshold(true)} className="font-mono inline-flex items-center gap-1 text-slate-800 hover:text-[#005EB8] transition-colors">
                {threshold}% <Pencil className="w-3 h-3" />
              </button>
            )}
          </Info>
        </div>
      </Card>

      <DispatchModal
        open={dispatch} onClose={() => setDispatch(false)}
        meterId={meter.id} address={meter.address}
        summary={meter.tamperEvents > 0 ? `${meter.tamperEvents} active tamper event(s) require investigation.` : undefined}
      />
    </div>
  );
}

function MiniMetric({ label, value, mono, accent = "" }: { label: string; value: React.ReactNode; mono?: boolean; accent?: string }) {
  return (
    <Card>
      <div className="text-[11px] uppercase tracking-wider text-slate-400">{label}</div>
      <div className={`mt-1 text-xl font-bold ${mono ? "font-mono" : ""} ${accent || "text-slate-900"}`}>{value}</div>
    </Card>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between border-b border-slate-100 py-2.5">
      <span className="text-slate-400 text-xs">{label}</span>
      <span className="text-sm text-slate-800">{children}</span>
    </div>
  );
}

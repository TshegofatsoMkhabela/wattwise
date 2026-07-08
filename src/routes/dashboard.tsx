import { createFileRoute, Link } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { useLiveData } from "@/store/liveDataStore";
import { formatZAR, TARIFF_PER_KWH } from "@/lib/format";
import { AlertTriangle, Zap, Lightbulb, Sparkles, ArrowRight, X } from "lucide-react";
import { UsagePieChart } from "@/components/charts/UsagePieChart";
import { CountUp } from "@/components/ui/count-up";
import { toast } from "sonner";
import { useState, useEffect } from "react";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard · WattWise" }] }),
  component: () => (
    <AppLayout title="My Energy Dashboard">
      <ConsumerDashboard />
    </AppLayout>
  ),
});

function ConsumerDashboard() {
  const todayKWh = useLiveData((s) => s.todayKWh);
  const costRand = useLiveData((s) => s.costRand);
  const balanceRand = useLiveData((s) => s.balanceRand);
  const runoutEta = useLiveData((s) => s.runoutEta);
  const state = useLiveData((s) => s.state);
  const watts = useLiveData((s) => s.current.watts);
  const sendCommand = useLiveData((s) => s.sendCommand);
  const [dismissed, setDismissed] = useState(false);

  // Only show the alert banner when the live feed reports overuse.
  const alertVisible = state === "alert" && !dismissed;

  // Snackbar with a "Mute alarm" action so the user can silence the buzzer when
  // they can't reduce usage right now. Fires once when overuse starts.
  useEffect(() => {
    const ALARM_ID = "overuse-alarm";
    if (state === "alert") {
      toast.warning("High usage — alarm sounding", {
        id: ALARM_ID,
        description:
          "Your Kitchen is over the safe limit. Mute the buzzer if you can't reduce it now.",
        duration: Infinity,
        action: {
          label: "Mute alarm",
          onClick: () => {
            const sent = sendCommand("MUTE");
            toast.dismiss(ALARM_ID);
            toast.success(sent ? "Alarm muted" : "Mute unavailable (bridge offline)", {
              id: "overuse-alarm-ack",
              duration: 3000,
            });
          },
        },
      });
    } else {
      toast.dismiss(ALARM_ID);
    }
  }, [state, sendCommand]);

  return (
    <div className="space-y-4">
      {alertVisible && <SmartMeterAlert watts={watts} onClose={() => setDismissed(true)} />}
      <QuickStatsRow
        todayKWh={todayKWh}
        costRand={costRand}
        balanceRand={balanceRand}
        runoutEta={runoutEta}
      />
      <UsageBreakdown watts={watts} alert={state === "alert"} />
      <LoadSheddingCard />
    </div>
  );
}

/* ─── Smart Meter Alert Banner ─────────────────────────────── */
function SmartMeterAlert({ watts, onClose }: { watts: number; onClose: () => void }) {
  return (
    <div className="bg-amber-50 border-l-4 border-amber-400 rounded-2xl p-4 flex items-start gap-3">
      <div className="w-10 h-10 rounded-xl bg-amber-100 grid place-items-center flex-shrink-0 mt-0.5">
        <AlertTriangle className="w-5 h-5 text-amber-600" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="text-xs font-bold uppercase tracking-wider text-amber-700">
            Smart Meter Alert
          </span>
          <span className="text-[10px] text-white bg-amber-500 px-2 py-0.5 rounded-full font-semibold">
            Arduino · Live
          </span>
        </div>
        <p className="text-sm font-semibold text-amber-900 leading-snug">
          Your <strong>Kitchen</strong> is drawing{" "}
          <strong>{Math.round(watts).toLocaleString("en-ZA")} W</strong> right now — above your safe
          threshold.
        </p>
        <p className="text-xs text-amber-700 mt-1">
          Turn it down or switch it off to save money and avoid tripping your supply.
        </p>
      </div>
      <button
        onClick={onClose}
        className="text-amber-400 hover:text-amber-700 transition-colors flex-shrink-0 mt-0.5"
        aria-label="Dismiss alert"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

/* ─── 4-card quick stats row ──────────────────────────────── */
function QuickStatsRow({
  todayKWh,
  costRand,
  balanceRand,
  runoutEta,
}: {
  todayKWh: number;
  costRand: number | null;
  balanceRand: number | null;
  runoutEta: string | null;
}) {
  // Prefer live bridge-derived cost; fall back to the local tariff estimate.
  const cost = costRand ?? todayKWh * TARIFF_PER_KWH;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {/* Units Used */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
        <div className="flex items-center gap-1.5 mb-2.5">
          <Zap className="w-3.5 h-3.5 text-[#005EB8]" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Units Used
          </span>
        </div>
        <div className="font-mono text-2xl font-bold text-[#005EB8] tabular-nums">
          <CountUp value={todayKWh} decimals={1} />
        </div>
        <div className="text-[10px] text-slate-400 mt-1">kWh today</div>
      </div>

      {/* Est. Cost */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
        <div className="flex items-center gap-1.5 mb-2.5">
          <span className="text-xs font-bold text-amber-500 leading-none">R</span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Est. Cost
          </span>
        </div>
        <div className="font-mono text-2xl font-bold text-amber-600 tabular-nums">
          {formatZAR(cost)}
        </div>
        <div className="text-[10px] text-slate-400 mt-1">
          {runoutEta && runoutEta !== "—" ? `Runs out ${runoutEta}` : "Since midnight"}
        </div>
      </div>

      {/* Suggestions → reports */}
      <Link
        to="/reports"
        className="bg-[#EBF5FF] rounded-2xl border border-blue-100 shadow-sm p-4 hover:bg-blue-100 transition-colors group"
      >
        <div className="flex items-center gap-1.5 mb-2.5">
          <Lightbulb className="w-3.5 h-3.5 text-[#005EB8]" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#005EB8]">
            Suggestions
          </span>
        </div>
        <div className="text-2xl font-bold text-[#005EB8]">3</div>
        <div className="text-[10px] text-[#005EB8] mt-1 flex items-center gap-0.5">
          Tips for you
          <ArrowRight className="w-3 h-3 ml-0.5 group-hover:translate-x-0.5 transition-transform" />
        </div>
      </Link>

      {/* AI assistant — buy units, ask questions, report faults */}
      <Link
        to="/assistant"
        className="bg-[#005EB8] rounded-2xl shadow-sm p-4 hover:bg-[#004FA3] active:bg-[#003F8A] transition-colors text-left w-full block group"
      >
        <div className="flex items-center gap-1.5 mb-2.5">
          <Sparkles className="w-3.5 h-3.5 text-white/80" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-white/80">
            Assistant
          </span>
        </div>
        <div className="text-2xl font-bold text-white">Ask AI</div>
        <div className="text-[10px] text-blue-200 mt-1 flex items-center gap-0.5">
          {balanceRand != null ? `Buy units · ${formatZAR(balanceRand)}` : "Buy units & more"}
          <ArrowRight className="w-3 h-3 ml-0.5 group-hover:translate-x-0.5 transition-transform" />
        </div>
      </Link>
    </div>
  );
}

/* ─── Live estimate (pie chart) ──────────────────────────── */
function UsageBreakdown({ watts, alert }: { watts: number; alert: boolean }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="font-bold text-slate-900">Where is your electricity going?</h2>
          <p className="text-xs text-slate-400 mt-0.5">Live power draw by appliance</p>
        </div>
        <span className="text-xs bg-[#EBF5FF] text-[#005EB8] font-semibold px-2.5 py-1 rounded-full">
          Live draw
        </span>
      </div>
      <UsagePieChart kitchenWatts={watts} alert={alert} />
    </div>
  );
}

/* ─── Load shedding ──────────────────────────────────────── */
function LoadSheddingCard() {
  const start = new Date();
  start.setHours(18, 0, 0, 0);
  const end = new Date();
  end.setHours(20, 30, 0, 0);
  const now = new Date();
  const isActive = now >= start && now <= end;
  const target = isActive ? end : start;
  const diffSec = Math.max(0, Math.floor((target.getTime() - now.getTime()) / 1000));
  const h = Math.floor(diffSec / 3600);
  const m = Math.floor((diffSec % 3600) / 60);
  const s = diffSec % 60;
  const progress = isActive
    ? Math.min(100, ((now.getTime() - start.getTime()) / (end.getTime() - start.getTime())) * 100)
    : 0;

  return (
    <div className="bg-white rounded-2xl border border-amber-200 shadow-sm p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500 text-white text-[11px] font-bold">
              <Zap className="w-3 h-3" /> STAGE 2
            </span>
            <span className="text-[11px] text-slate-400">EskomSePush · 5 min ago</span>
          </div>
          <div className="text-xl font-bold text-slate-900">Power off: 18:00 – 20:30</div>
          <div className="text-sm text-slate-500 mt-0.5">Group 7 — Tzaneen North</div>
        </div>
        <div className="text-right">
          <div className="text-[11px] text-slate-400 uppercase tracking-wide">
            {isActive ? "Power back in" : "Power off in"}
          </div>
          <div className="font-mono text-3xl font-bold text-amber-600 tabular-nums mt-0.5">
            {String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
          </div>
        </div>
      </div>

      <div className="mt-4 h-1.5 bg-amber-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-amber-500 rounded-full transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="mt-3 flex items-center gap-2 text-xs text-amber-700 font-medium bg-amber-50 rounded-xl px-3 py-2">
        <Lightbulb className="w-3.5 h-3.5 flex-shrink-0" />
        Get ready: charge your devices and switch on the geyser before 17:45
      </div>
    </div>
  );
}

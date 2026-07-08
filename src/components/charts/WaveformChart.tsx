import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useLiveData } from "@/store/liveDataStore";
import { format } from "date-fns";

const BLUE = "#005EB8";
const TOOLTIP_STYLE = {
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  fontSize: 12,
  color: "#0f172a",
  boxShadow: "0 4px 6px -1px rgba(0,0,0,0.07)",
};

export function WaveformChart({ height = 240, points }: { height?: number; points?: { timestamp: number; watts: number }[] }) {
  const readings = useLiveData((s) => s.readings);
  const data = (points ?? readings).slice(-300).map((r) => ({
    t: r.timestamp,
    label: format(r.timestamp, "HH:mm:ss"),
    watts: Math.round(r.watts),
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="wave" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={BLUE} stopOpacity={0.18} />
            <stop offset="100%" stopColor={BLUE} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94A3B8" }} interval={Math.floor(data.length / 6)} />
        <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} width={40} />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          labelStyle={{ color: "#64748B", fontSize: 11 }}
          formatter={(v: number) => [`${v} W`, "Power"]}
        />
        <Area
          type="monotone" dataKey="watts"
          stroke={BLUE} strokeWidth={2}
          fill="url(#wave)"
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function Sparkline({ data }: { data: number[] }) {
  const chartData = data.map((v, i) => ({ i, v }));
  return (
    <ResponsiveContainer width="100%" height={40}>
      <AreaChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="spark" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={BLUE} stopOpacity={0.3} />
            <stop offset="100%" stopColor={BLUE} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke={BLUE} strokeWidth={1.5} fill="url(#spark)" isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

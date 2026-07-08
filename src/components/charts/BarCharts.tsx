import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const BLUE = "#005EB8";
const BLUE_LIGHT = "#EBF5FF";
const TOOLTIP_STYLE = {
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  fontSize: 12,
  color: "#0f172a",
  boxShadow: "0 4px 6px -1px rgba(0,0,0,0.07)",
};

export function DailyBarChart({ data, currentHour }: { data: { hour: number; kWh: number }[]; currentHour: number }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
        <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "#94A3B8" }} tickFormatter={(h) => `${h}h`} />
        <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} width={40} />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          labelStyle={{ color: "#64748B", fontSize: 11 }}
          formatter={(v: number) => [`${v.toFixed(2)} kWh`, "Usage"]}
          labelFormatter={(h) => `${h}:00`}
        />
        <Bar dataKey="kWh" radius={[4, 4, 0, 0]}>
          {data.map((d) => (
            <Cell key={d.hour} fill={d.hour === currentHour ? "#F59E0B" : BLUE} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function UsageHistoryChart({ data }: { data: { date: string; kWh: number; hadTamper: boolean }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
        <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#94A3B8" }} interval={3} tickFormatter={(d) => d.slice(5)} />
        <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} width={40} />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          labelStyle={{ color: "#64748B", fontSize: 11 }}
          formatter={(v: number) => [`${v.toFixed(2)} kWh`, "Usage"]}
        />
        <Bar dataKey="kWh" radius={[3, 3, 0, 0]}>
          {data.map((d) => (
            <Cell key={d.date} fill={d.hadTamper ? "#EF4444" : BLUE} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export { BLUE_LIGHT };

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { formatW } from "@/lib/format";

// Illustrative baseline draw (W) for the other appliances in the home. The
// Kitchen slice is the live appliance driven by the Arduino potentiometer.
const BASELINE = [
  { name: "Geyser", watts: 900, color: "#005EB8" },
  { name: "Lighting", watts: 180, color: "#4A90D9" },
  { name: "Appliances", watts: 320, color: "#7BB3E8" },
  { name: "Other", watts: 120, color: "#C5DFF8" },
];

interface Props {
  /** live power draw of the Kitchen appliance (the knob), in watts */
  kitchenWatts: number;
  /** true while the live feed reports overuse (buzzer/“bleep” state) */
  alert: boolean;
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: { name: string; value: number }[] }) {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0];
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-md px-4 py-3 text-sm">
      <div className="font-semibold text-slate-800">{name}</div>
      <div className="text-slate-500 mt-0.5">{formatW(value)} right now</div>
    </div>
  );
}

export function UsagePieChart({ kitchenWatts, alert }: Props) {
  const kitchen = {
    name: "Kitchen",
    watts: Math.max(0, Math.round(kitchenWatts)),
    color: alert ? "#EF4444" : "#1E6FBA",
  };
  const slices = [kitchen, ...BASELINE];
  const total = slices.reduce((sum, s) => sum + s.watts, 0) || 1;
  const data = slices.map((s) => ({
    name: s.name,
    value: s.watts,
    color: s.color,
    pct: Math.round((s.watts / total) * 100),
  }));

  return (
    <div className="flex flex-col md:flex-row items-center gap-6">
      <div className="w-full md:w-64 h-56 flex-shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={62}
              outerRadius={88}
              paddingAngle={3}
              dataKey="value"
              isAnimationActive={false}
            >
              {data.map((entry, i) => (
                <Cell
                  key={i}
                  fill={entry.color}
                  strokeWidth={0}
                  className={entry.name === "Kitchen" && alert ? "animate-pulse" : undefined}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex flex-col gap-2.5 w-full">
        {data.map((d) => {
          const isKitchen = d.name === "Kitchen";
          const kitchenAlert = isKitchen && alert;
          return (
            <div
              key={d.name}
              className={`flex items-center gap-3 rounded-lg ${
                kitchenAlert ? "bg-red-50 -mx-2 px-2 py-1 animate-pulse" : ""
              }`}
            >
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
              <span className={`text-sm flex-1 ${isKitchen ? "font-semibold text-slate-900" : "text-slate-700"}`}>
                {d.name}
                {isKitchen && (
                  <span
                    className={`ml-2 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
                      alert ? "bg-red-500 text-white" : "bg-[#EBF5FF] text-[#005EB8]"
                    }`}
                  >
                    {alert ? "⚠ Bleeping" : "Live · knob"}
                  </span>
                )}
              </span>
              <span
                className={`text-sm font-semibold tabular-nums ${
                  kitchenAlert ? "text-red-600" : "text-slate-800"
                }`}
              >
                {formatW(d.value)}
              </span>
              <span className="text-xs text-slate-400 tabular-nums w-9 text-right">{d.pct}%</span>
            </div>
          );
        })}
        <div className="mt-1 pt-2.5 border-t border-slate-100 flex items-center justify-between">
          <span className="text-xs text-slate-500">Total draw now</span>
          <span className="text-sm font-bold text-[#005EB8] tabular-nums">{formatW(total)}</span>
        </div>
      </div>
    </div>
  );
}

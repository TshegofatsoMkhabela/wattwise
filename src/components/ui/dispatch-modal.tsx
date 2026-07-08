import { useState } from "react";
import { technicians } from "@/mock/technicians";
import { useAlerts } from "@/store/alertsStore";
import { toast } from "sonner";
import { X, AlertTriangle, Send } from "lucide-react";

export function DispatchModal({
  open, onClose, meterId, address, alertId, summary,
}: {
  open: boolean; onClose: () => void; meterId: string; address: string;
  alertId?: string; summary?: string;
}) {
  const [techId, setTechId] = useState(technicians[0].id);
  const [priority, setPriority] = useState<"urgent" | "normal" | "low">("urgent");
  const [notes, setNotes] = useState("");
  const assign = useAlerts((s) => s.assign);

  if (!open) return null;

  const submit = () => {
    const jobId = `NXM-2026-${String(Math.floor(Math.random() * 9000) + 1000)}`;
    const tech = technicians.find((t) => t.id === techId)!;
    if (alertId) assign(alertId, tech.name, jobId);
    toast.success(`Technician dispatched · Job #${jobId} created`);
    onClose();
  };

  const priorityConfig = {
    urgent: { label: "Urgent",  active: "bg-red-500 text-white border-red-500",   dot: "bg-red-500" },
    normal: { label: "Normal",  active: "bg-amber-500 text-white border-amber-500", dot: "bg-amber-500" },
    low:    { label: "Low",     active: "bg-[#005EB8] text-white border-[#005EB8]", dot: "bg-[#005EB8]" },
  } as const;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm grid place-items-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#EBF5FF] grid place-items-center">
                <Send className="w-3.5 h-3.5 text-[#005EB8]" />
              </div>
              <h3 className="font-semibold text-slate-900">Dispatch Technician</h3>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              <span className="font-mono text-[#005EB8]">{meterId}</span>
              <span className="mx-1.5 text-slate-300">·</span>
              {address}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg grid place-items-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Summary alert */}
          {summary && (
            <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl p-3">
              <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-700 leading-relaxed">{summary}</p>
            </div>
          )}

          {/* Technician select */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Technician</label>
            <select
              value={techId} onChange={(e) => setTechId(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#005EB8]/30 focus:border-[#005EB8] transition-colors"
            >
              {technicians.map((t) => (
                <option key={t.id} value={t.id}>{t.name} — {t.activeJobs} active job{t.activeJobs !== 1 ? "s" : ""}</option>
              ))}
            </select>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Priority</label>
            <div className="flex gap-2">
              {(["urgent", "normal", "low"] as const).map((p) => {
                const cfg = priorityConfig[p];
                const isActive = priority === p;
                return (
                  <button
                    key={p}
                    onClick={() => setPriority(p)}
                    className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                      isActive ? cfg.active : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                    }`}
                  >
                    <span className="flex items-center justify-center gap-1.5">
                      {isActive && <span className={`w-1.5 h-1.5 rounded-full bg-white`} />}
                      {cfg.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Instructions */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Instructions</label>
            <textarea
              value={notes} onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Approach with caution. Check seal first…"
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white text-slate-800 placeholder-slate-300 resize-none focus:outline-none focus:ring-2 focus:ring-[#005EB8]/30 focus:border-[#005EB8] transition-colors"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-slate-100">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 text-sm rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            className="flex-1 px-4 py-2.5 text-sm rounded-xl bg-[#005EB8] text-white font-semibold hover:bg-[#003F8A] transition-colors inline-flex items-center justify-center gap-2"
          >
            <Send className="w-3.5 h-3.5" />Dispatch
          </button>
        </div>
      </div>
    </div>
  );
}

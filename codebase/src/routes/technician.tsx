import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardTitle } from "@/components/ui/card-basic";
import { useAlerts } from "@/store/alertsStore";
import { useState } from "react";
import { MapPin, CheckCircle2, ClipboardCheck, LoaderCircle } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import type { Job } from "@/types";
import { meters } from "@/mock/meters";
import { TechnicianJobMap } from "@/components/maps/TechnicianJobMap";
import { sendAgentTrigger } from "@/lib/directline";
import { WebcamCapture, type CapturedPhoto } from "@/components/ui/webcam-capture";

export const Route = createFileRoute("/technician")({
  head: () => ({ meta: [{ title: "My Jobs · GridWise" }] }),
  component: () => (
    <AppLayout title="Field Technician Workspace">
      <Technician />
    </AppLayout>
  ),
});

function Technician() {
  const jobs = useAlerts((s) => s.jobs);
  const active = jobs
    .filter((j) => j.status !== "resolved")
    .sort((a, b) => (a.severity === "critical" ? -1 : 1));
  const resolvedToday = jobs.filter((j) => j.status === "resolved");

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-6">
      <div className="space-y-6 min-w-0">
        <div>
          <h2 className="font-semibold mb-3">My active jobs ({active.length})</h2>
          <div className="space-y-3">
            {active.map((j) => (
              <JobCard key={j.id} job={j} />
            ))}
          </div>
        </div>

        <TechnicianJobMap jobs={active} meters={meters} />

        <Card>
          <CardTitle hint={`${resolvedToday.length} jobs`}>Resolved today</CardTitle>
          <div className="space-y-2 text-xs">
            {resolvedToday.length === 0 && (
              <div className="text-muted-foreground">No jobs resolved yet today.</div>
            )}
            {resolvedToday.map((j) => (
              <div
                key={j.id}
                className="flex items-center gap-3 py-2 border-b border-border last:border-0"
              >
                <CheckCircle2 className="w-4 h-4 text-[#005EB8] flex-shrink-0" />
                <div className="flex-1">
                  <div className="font-mono text-[#005EB8]">{j.meterId}</div>
                  <div className="text-muted-foreground">{j.resolutionNote ?? "Resolved"}</div>
                </div>
                <div className="text-muted-foreground">
                  {j.resolvedAt && format(new Date(j.resolvedAt), "HH:mm")}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div>
        <QuickReportForm />
      </div>
    </div>
  );
}

const pipeline: Job["status"][] = ["assigned", "en_route", "on_site", "resolved"];
const pipelineLabels = {
  assigned: "Assigned",
  en_route: "En Route",
  on_site: "On Site",
  resolved: "Resolved",
} as const;

function JobCard({ job }: { job: Job }) {
  const setJobStatus = useAlerts((s) => s.setJobStatus);
  const curIndex = pipeline.indexOf(job.status);
  const sevColor =
    job.severity === "critical" ? "bg-red-500 text-white" : "bg-amber-500 text-white";

  // Advance the job AND fire a Direct Line trigger to the orchestrator agent,
  // which routes the event to the scheduler agent. The status update is
  // optimistic; the toast reports whether the trigger reached Direct Line.
  const advance = async (
    status: Job["status"],
    statusLabel: string,
    toastTitle: string,
    note?: string,
  ) => {
    setJobStatus(job.id, status, note);
    const message =
      `Scheduler trigger — Job ${job.id} (meter ${job.meterId}, ${job.address}, ` +
      `${job.severity} severity) is now "${statusLabel}". Trigger the scheduler agent ` +
      `to plan the next step and update the ETA.`;
    const res = await sendAgentTrigger(message, {
      kind: "job_status_change",
      jobId: job.id,
      meterId: job.meterId,
      address: job.address,
      severity: job.severity,
      status,
      at: new Date().toISOString(),
    });
    toast.success(toastTitle, {
      description: res.ok
        ? "Scheduler agent triggered via Direct Line"
        : res.reason === "unconfigured"
          ? "Direct Line not connected — scheduler trigger skipped"
          : "Scheduler trigger could not be sent",
    });
  };

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${sevColor}`}
            >
              {job.severity}
            </span>
            <span className="font-mono text-xs text-muted-foreground">{job.id}</span>
          </div>
          <div className="mt-2 text-lg font-semibold">{job.address}</div>
          <div className="text-xs font-mono text-[#005EB8] mt-1">{job.meterId}</div>
          {job.notes && (
            <div className="text-xs text-muted-foreground mt-2 italic">"{job.notes}"</div>
          )}
          <div className="text-[11px] text-muted-foreground mt-1">
            Assigned {formatDistanceToNow(new Date(job.assignedAt), { addSuffix: true })}
          </div>
        </div>
        <div className="flex gap-1.5">
          <ActionBtn
            onClick={() => advance("en_route", "En Route", "Marked en route")}
            disabled={curIndex >= 1}
          >
            Mark En Route
          </ActionBtn>
          <ActionBtn
            onClick={() => advance("on_site", "On Site", "Marked on site")}
            disabled={curIndex >= 2}
          >
            Mark On Site
          </ActionBtn>
          <ActionBtn
            onClick={() => advance("resolved", "Resolved", "Job resolved", "Resolved on site")}
            primary
          >
            Resolve
          </ActionBtn>
        </div>
      </div>

      {/* Pipeline */}
      <div className="mt-4 flex items-center gap-1">
        {pipeline.map((s, i) => {
          const done = i <= curIndex;
          return (
            <div key={s} className="flex-1 flex items-center">
              <div
                className={`flex-1 h-1.5 rounded-full ${done ? "bg-[#005EB8]" : "bg-slate-200"}`}
              />
              <div
                className={`mx-2 text-[10px] uppercase font-medium ${done ? "text-[#005EB8]" : "text-muted-foreground"}`}
              >
                {pipelineLabels[s]}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function ActionBtn({
  children,
  onClick,
  disabled,
  primary,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
        primary
          ? "bg-[#005EB8] text-white hover:bg-[#003F8A]"
          : "border border-slate-200 hover:bg-slate-50"
      } disabled:opacity-40 disabled:cursor-not-allowed`}
    >
      {children}
    </button>
  );
}

function JobMap() {
  const jobs = useAlerts((s) => s.jobs).filter((j) => j.status !== "resolved");
  return (
    <Card>
      <CardTitle hint="My assigned jobs">Job map</CardTitle>
      <div className="bg-[#001F5E] rounded-xl relative overflow-hidden" style={{ height: 280 }}>
        <svg viewBox="0 0 800 280" className="w-full h-full">
          <pattern id="techstreets" width="80" height="60" patternUnits="userSpaceOnUse">
            <rect width="80" height="60" fill="#0B1628" />
            <rect x="2" y="2" width="76" height="56" fill="#112240" rx="2" />
          </pattern>
          <rect width="800" height="280" fill="url(#techstreets)" />
          {jobs.map((j, i) => {
            const x = 100 + i * 140 + (i % 2) * 30;
            const y = 80 + (i % 3) * 60;
            const color = j.severity === "critical" ? "#EF4444" : "#F59E0B";
            return (
              <g key={j.id}>
                <circle cx={x} cy={y} r="14" fill={color} opacity="0.25" />
                <circle cx={x} cy={y} r="6" fill={color} />
                <text
                  x={x}
                  y={y + 30}
                  textAnchor="middle"
                  fill="white"
                  fontSize="10"
                  fontFamily="monospace"
                >
                  {j.meterId.split("-")[1]}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </Card>
  );
}

function QuickReportForm() {
  const [meterId, setMeterId] = useState("NXM-019-TZN");
  const [findings, setFindings] = useState("Illegal bypass wire");
  const [desc, setDesc] = useState("");
  const [photo, setPhoto] = useState<CapturedPhoto | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const captureLocation = () => {
    if (!navigator.geolocation) {
      setLocationError("Location capture is not supported by this browser.");
      return;
    }

    setLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
        setLocating(false);
      },
      (error) => {
        const message =
          error.code === 1
            ? "Location permission was denied. Allow location access and try again."
            : error.code === 2
              ? "Your current location could not be determined."
              : "Location capture timed out. Please try again.";
        setLocationError(message);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 },
    );
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const meter = meters.find((m) => m.id === meterId);
    const gps = coords ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}` : "not captured";
    const message =
      `Field report submitted — Meter ${meterId}${meter ? ` (${meter.address})` : ""}. ` +
      `Findings: "${findings}". Evidence: "${desc || "—"}". GPS: ${gps}. ` +
      `Photo: ${photo ? photo.name : "none"}. Please update PowerApps with this field report.`;

    // Trigger the orchestrator (→ PowerApps). Attach the captured photo so the
    // downstream flow can store it against the report.
    const res = await sendAgentTrigger(
      message,
      {
        kind: "field_report",
        meterId,
        address: meter?.address,
        findings,
        evidence: desc,
        gps: coords,
        photoName: photo?.name ?? null,
        hasPhoto: !!photo,
        at: new Date().toISOString(),
      },
      photo
        ? [{ contentType: "image/jpeg", contentUrl: photo.dataUrl, name: photo.name }]
        : undefined,
    );

    toast.success("Field report submitted · job moved to Resolved", {
      description: res.ok
        ? "Sent to the orchestrator to update PowerApps"
        : res.reason === "unconfigured"
          ? "Direct Line not connected — PowerApps update skipped"
          : "PowerApps update could not be sent",
    });

    setDesc("");
    setPhoto(null);
    setCoords(null);
    setLocationError(null);
    setSubmitting(false);
  };

  return (
    <Card className="sticky top-20">
      <CardTitle hint="On-site">
        <ClipboardCheck className="w-4 h-4 inline mr-1 text-[#005EB8]" />
        Quick field report
      </CardTitle>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="block text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1">
            Meter ID
          </label>
          <input
            value={meterId}
            onChange={(e) => setMeterId(e.target.value)}
            className="w-full font-mono border border-input rounded-lg px-3 py-2 text-sm bg-background"
          />
        </div>
        <div>
          <label className="block text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1">
            Findings
          </label>
          <select
            value={findings}
            onChange={(e) => setFindings(e.target.value)}
            className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background"
          >
            {[
              "Illegal bypass wire",
              "Tampered seal",
              "Load anomaly only",
              "False positive — no fault found",
              "Other",
            ].map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1">
            Evidence description
          </label>
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            rows={4}
            className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background"
            placeholder="Describe what you found and the action taken…"
          />
        </div>
        <div>
          <label className="block text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1">
            Photo evidence
          </label>
          <WebcamCapture value={photo} onChange={setPhoto} />
        </div>
        <div>
          <label className="block text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1">
            GPS coordinates
          </label>
          <button
            type="button"
            onClick={captureLocation}
            disabled={locating}
            className="w-full flex items-center gap-2 border border-input rounded-lg px-3 py-2 text-xs text-left hover:bg-muted disabled:opacity-50"
          >
            {locating ? (
              <LoaderCircle className="w-4 h-4 text-[#005EB8] animate-spin" />
            ) : (
              <MapPin className="w-4 h-4 text-[#005EB8]" />
            )}
            <span className="font-mono">
              {coords
                ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`
                : locating
                  ? "Capturing..."
                  : "Tap to capture GPS"}
            </span>
          </button>
          {locationError && <div className="mt-1.5 text-[11px] text-red-500">{locationError}</div>}
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-[#005EB8] text-white font-semibold py-2.5 rounded-lg text-sm hover:bg-[#003F8A] transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {submitting && <LoaderCircle className="w-4 h-4 animate-spin" />}
          {submitting ? "Submitting…" : "Submit field report"}
        </button>
      </form>
    </Card>
  );
}

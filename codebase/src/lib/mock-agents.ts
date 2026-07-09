import { meters, hourlyUsageToday, usageHistory } from "@/mock/meters";
import { seedJobs, technicians } from "@/mock/technicians";
import type { UserIdentity } from "./user-context";

export type MockRoute = "consumer" | "government";

interface MockResult {
  routeSelected: MockRoute;
  agentUsed: "Consumer Agent" | "Government Agent";
  taskCategory: string;
  title: string;
  summary: string;
  supportingData: Record<string, string | number | boolean>;
  recommendation: string;
  escalationNeeded: boolean;
}

const money = new Intl.NumberFormat("en-ZA", {
  style: "currency",
  currency: "ZAR",
  maximumFractionDigits: 0,
});

function pct(change: number) {
  return `${change >= 0 ? "+" : ""}${Math.round(change)}%`;
}

function routeMessage(text: string, ctx: UserIdentity): MockRoute {
  const lower = text.toLowerCase();
  const governmentTerms = [
    "government",
    "municipal",
    "municipality",
    "dispatch",
    "technician",
    "fault cluster",
    "duplicate",
    "hotspot",
    "grid",
    "sla",
    "response time",
    "area",
    "regional",
    "load-shedding",
    "load shedding",
  ];

  if (ctx.role === "municipality" || ctx.role === "technician") return "government";
  return governmentTerms.some((term) => lower.includes(term)) ? "government" : "consumer";
}

function consumerAgent(text: string, ctx: UserIdentity): MockResult {
  const lower = text.toLowerCase();
  const meter = meters.find((m) => m.consumerName === ctx.username) ?? meters[0];
  const history = usageHistory(meter.id);
  const currentMonth = Math.round(history.reduce((sum, day) => sum + day.kWh, 0));
  const previousMonth = Math.round(currentMonth * 0.88);
  const change = ((currentMonth - previousMonth) / previousMonth) * 100;
  const hourly = hourlyUsageToday();
  const peak = hourly.reduce((max, row) => (row.kWh > max.kWh ? row : max), hourly[0]);
  const estCost = currentMonth * 3.9;

  if (
    lower.includes("report") ||
    lower.includes("load-shedding") ||
    lower.includes("load shedding")
  ) {
    return {
      routeSelected: "consumer",
      agentUsed: "Consumer Agent",
      taskCategory: "household-report",
      title: lower.includes("load") ? "Load-Shedding Impact Report" : "Monthly Usage Report",
      summary: `${ctx.username || meter.consumerName}'s household used about ${currentMonth} kWh this month, ${pct(change)} compared with the previous month.`,
      supportingData: {
        meterId: meter.id,
        area: meter.area,
        currentUsage: `${currentMonth} kWh`,
        previousUsage: `${previousMonth} kWh`,
        estimatedCost: money.format(estCost),
        peakWindow: `${peak.hour}:00-${peak.hour + 1}:00`,
      },
      recommendation:
        "Shift geyser, washing machine, and kettle use away from the evening peak where possible. Keep this report attached for municipal escalation if outage patterns continue.",
      escalationNeeded:
        lower.includes("outage") || lower.includes("fault") || lower.includes("load"),
    };
  }

  if (lower.includes("save") || lower.includes("tip") || lower.includes("lower")) {
    return {
      routeSelected: "consumer",
      agentUsed: "Consumer Agent",
      taskCategory: "saving-recommendation",
      title: "Household Saving Recommendation",
      summary: "Your biggest saving opportunity is reducing evening high-load appliance use.",
      supportingData: {
        peakWindow: "18:00-21:00",
        estimatedSaving: money.format(180),
        targetReduction: "46 kWh/month",
        meterId: meter.id,
      },
      recommendation:
        "Set the geyser timer outside the 18:00-21:00 window, run washing loads during the day, and switch off standby entertainment devices overnight.",
      escalationNeeded: false,
    };
  }

  if (
    lower.includes("off") ||
    lower.includes("outage") ||
    lower.includes("fault") ||
    lower.includes("power")
  ) {
    return {
      routeSelected: "consumer",
      agentUsed: "Consumer Agent",
      taskCategory: "household-fault",
      title: "Household Fault Summary",
      summary:
        "Your meter is still reporting telemetry, so this looks like a localized supply or appliance issue rather than a full meter outage.",
      supportingData: {
        meterId: meter.id,
        area: meter.area,
        meterStatus: meter.status,
        lastSeen: new Date(meter.lastSeenAt).toLocaleTimeString(),
        tamperEvents: meter.tamperEvents,
      },
      recommendation:
        "Check the main breaker first. If neighbours are also affected, submit this as an outage report for municipal review.",
      escalationNeeded: meter.status !== "normal",
    };
  }

  return {
    routeSelected: "consumer",
    agentUsed: "Consumer Agent",
    taskCategory: "usage-insight",
    title: "High Usage Insight",
    summary: `Your household is using ${pct(change)} more electricity than the previous month. The likely driver is evening appliance load.`,
    supportingData: {
      meterId: meter.id,
      currentUsage: `${currentMonth} kWh`,
      previousUsage: `${previousMonth} kWh`,
      estimatedCost: money.format(estCost),
      peakWindow: "18:00-21:00",
      currentDraw: `${Math.round(meter.currentDraw)} W`,
    },
    recommendation:
      "Reduce geyser and kettle use during evening peak hours, and check whether the fridge or pool pump is running continuously.",
    escalationNeeded: false,
  };
}

function governmentAgent(text: string): MockResult {
  const lower = text.toLowerCase();
  const critical = meters.filter((m) => m.status === "critical");
  const warning = meters.filter((m) => m.status === "warning");
  const offline = meters.filter((m) => m.status === "offline");
  const hotspotArea = critical[0]?.area ?? "Jabulani";
  const priorityJob = seedJobs.find((job) => job.severity === "critical") ?? seedJobs[0];
  const tech = technicians.find((t) => t.id === priorityJob.technicianId) ?? technicians[0];

  if (lower.includes("dispatch") || lower.includes("technician") || lower.includes("fault")) {
    return {
      routeSelected: "government",
      agentUsed: "Government Agent",
      taskCategory: "dispatch-recommendation",
      title: "Dispatch Recommendation",
      summary: `${priorityJob.id} is high priority and should be reviewed for technician dispatch approval.`,
      supportingData: {
        faultId: priorityJob.id,
        meterId: priorityJob.meterId,
        severity: priorityJob.severity,
        status: priorityJob.status,
        recommendedTechnician: tech.name,
        technicianActiveJobs: tech.activeJobs,
        affectedHouseholds: 37,
        priorityScore: 86,
      },
      recommendation:
        "Recommend dispatch for human approval. Assign the nearest qualified technician and group duplicate reports before sending another vehicle.",
      escalationNeeded: true,
    };
  }

  if (lower.includes("duplicate") || lower.includes("cluster")) {
    return {
      routeSelected: "government",
      agentUsed: "Government Agent",
      taskCategory: "fault-clustering",
      title: "Duplicate Fault Grouping",
      summary: "The agent grouped repeated outage reports into one likely service event.",
      supportingData: {
        area: hotspotArea,
        duplicateReports: 12,
        confirmedFaults: critical.length,
        unresolvedFaults: critical.length + offline.length,
        duplicateDispatchesAvoided: 2,
      },
      recommendation:
        "Treat these reports as one fault cluster until a technician confirms separate causes on site.",
      escalationNeeded: true,
    };
  }

  if (
    lower.includes("report") ||
    lower.includes("load") ||
    lower.includes("hotspot") ||
    lower.includes("grid")
  ) {
    return {
      routeSelected: "government",
      agentUsed: "Government Agent",
      taskCategory: "government-report",
      title: "Municipal Electricity Operations Report",
      summary: `${hotspotArea} is the current outage hotspot, with ${critical.length} critical meters, ${warning.length} warning meters, and ${offline.length} offline meters in the demo network.`,
      supportingData: {
        totalMeters: meters.length,
        outageHotspot: hotspotArea,
        gridStressScore: 82,
        riskLevel: "High",
        faultReportsGrouped: 12,
        responseDelayFlagged: "45 minutes",
      },
      recommendation:
        "Prioritize the hotspot area, group duplicate reports before dispatch, and monitor grid stress during the 18:00-21:00 peak window.",
      escalationNeeded: true,
    };
  }

  return {
    routeSelected: "government",
    agentUsed: "Government Agent",
    taskCategory: "grid-stress",
    title: "Grid Stress Summary",
    summary: "The demo network shows elevated grid stress around critical and offline meters.",
    supportingData: {
      criticalMeters: critical.length,
      warningMeters: warning.length,
      offlineMeters: offline.length,
      highRiskNodesDetected: 1,
      averageResponseTime: "1h 45m",
      targetResponseTime: "1h 00m",
    },
    recommendation:
      "Flag the high-risk node for operator review and keep technician dispatch recommend-only until a municipal operator approves it.",
    escalationNeeded: true,
  };
}

function formatResponse(result: MockResult) {
  const supportingRows = Object.entries(result.supportingData)
    .map(([key, value]) => `- ${key}: ${value}`)
    .join("\n");

  return `**Agent Trace**
User request received
-> Orchestrator selected ${result.agentUsed}
-> ${result.agentUsed} handled ${result.taskCategory}
-> Result returned to GridWise

**${result.title}**
${result.summary}

**Supporting Data**
${supportingRows}

**Recommendation**
${result.recommendation}

Escalation needed: ${result.escalationNeeded ? "Yes" : "No"}`;
}

export async function runMockAgent(message: string, ctx: UserIdentity): Promise<string> {
  const route = routeMessage(message, ctx);
  const result = route === "government" ? governmentAgent(message) : consumerAgent(message, ctx);
  await new Promise((resolve) => setTimeout(resolve, 550));
  return formatResponse(result);
}

export async function runMockTrigger(text: string, value?: unknown): Promise<{ ok: boolean }> {
  console.info("[mock-agent-trigger]", { text, value });
  await new Promise((resolve) => setTimeout(resolve, 200));
  return { ok: true };
}

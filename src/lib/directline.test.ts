import { describe, it, expect } from "vitest";
import {
  classifyActivity,
  waitLabel,
  isResponseTimedOut,
  RESPONSE_TIMEOUT_MS,
  parseReportReady,
  type DirectLineActivity,
} from "./directline";

const bot = { id: "bot-1", name: "Orchestrator-Agent", role: "bot" };

describe("classifyActivity", () => {
  it("classifies a bot message with text as a bot-message", () => {
    const seen = new Set<string>();
    const act: DirectLineActivity = { id: "a1", type: "message", text: "hi there", from: bot };
    const res = classifyActivity(act, seen);
    expect(res.kind).toBe("bot-message");
    if (res.kind === "bot-message") {
      expect(res.message.text).toBe("hi there");
      expect(res.message.role).toBe("bot");
    }
  });

  it("classifies a bot typing activity as typing", () => {
    const seen = new Set<string>();
    const act: DirectLineActivity = { id: "t1", type: "typing", from: bot };
    expect(classifyActivity(act, seen).kind).toBe("typing");
  });

  it("ignores our own echoed user message", () => {
    const seen = new Set<string>();
    const act: DirectLineActivity = {
      id: "u1",
      type: "message",
      text: "my prompt",
      from: { id: "user", role: "user" },
    };
    expect(classifyActivity(act, seen).kind).toBe("ignore");
  });

  it("ignores a message with no text", () => {
    const seen = new Set<string>();
    const act: DirectLineActivity = { id: "m0", type: "message", from: bot };
    expect(classifyActivity(act, seen).kind).toBe("ignore");
  });

  it("ignores non-message, non-typing activities (e.g. event)", () => {
    const seen = new Set<string>();
    const act: DirectLineActivity = { id: "e1", type: "event", from: bot };
    expect(classifyActivity(act, seen).kind).toBe("ignore");
  });

  it("dedupes by activity id: a repeated id is ignored the second time", () => {
    const seen = new Set<string>();
    const act: DirectLineActivity = { id: "dup", type: "message", text: "once", from: bot };
    expect(classifyActivity(act, seen).kind).toBe("bot-message");
    expect(classifyActivity(act, seen).kind).toBe("ignore");
  });
});

describe("waitLabel", () => {
  it("shows no label under 8s (plain dots)", () => {
    expect(waitLabel(0)).toBe("");
    expect(waitLabel(7999)).toBe("");
  });
  it("shows 'Working on it…' from 8s to under 20s", () => {
    expect(waitLabel(8000)).toBe("Working on it…");
    expect(waitLabel(19999)).toBe("Working on it…");
  });
  it("escalates at 20s and beyond", () => {
    expect(waitLabel(20000)).toBe("Still working — complex questions take a little longer…");
    expect(waitLabel(40000)).toBe("Still working — complex questions take a little longer…");
  });
});

describe("isResponseTimedOut", () => {
  it("is not timed out before the threshold", () => {
    expect(isResponseTimedOut(RESPONSE_TIMEOUT_MS - 1)).toBe(false);
  });
  it("is timed out at or after the threshold", () => {
    expect(isResponseTimedOut(RESPONSE_TIMEOUT_MS)).toBe(true);
  });
  it("uses a 45s threshold", () => {
    expect(RESPONSE_TIMEOUT_MS).toBe(45_000);
  });
});

describe("parseReportReady", () => {
  it("parses valid REPORT_READY sentinel", () => {
    const raw = `REPORT_READY|{"name":"Consumption_2025-12.csv","type":"Consumption","date":"2026-01-03","by":"Thandi Mokoena"}`;
    const report = parseReportReady(raw);
    expect(report).not.toBeNull();
    expect(report?.name).toBe("Consumption_2025-12.csv");
    expect(report?.type).toBe("Consumption");
  });

  it("returns null for non-report message", () => {
    expect(parseReportReady("Here is your report!")).toBeNull();
    expect(parseReportReady("REPORT_READY|invalid-json")).toBeNull();
  });

  it("returns null if json is missing required fields", () => {
    const raw = `REPORT_READY|{"date":"2026-01-03"}`;
    expect(parseReportReady(raw)).toBeNull();
  });
});

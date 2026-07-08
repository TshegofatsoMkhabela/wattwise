import { useCallback, useEffect, useRef, useState } from "react";
import { addReport, type SavedReport } from "../store/reports";
import { apiUrl } from "./api";
import { getAgentContext, getRolePrefix } from "./user-context";

/**
 * Minimal, dependency-free Direct Line 3.0 client for talking to a
 * Microsoft Copilot Studio agent from the browser.
 *
 * ─── How to connect (no backend required) ───────────────────────────────
 * In Copilot Studio: Settings → Channels → open your agent's web/Direct Line
 * channel and grab EITHER:
 *
 *   1. A backend token endpoint URL (recommended, safe for the browser). It
 *      returns a short-lived token and never exposes the secret. Defaults to:
 *          /api/directline/token
 *      Override only if your backend is on another host:
 *          VITE_DIRECTLINE_TOKEN_URL=https://.../api/directline/token
 *
 *   2. The raw Direct Line secret (simple, demo-only — it ships in the client
 *      bundle, so don't use it in production). Put it in:
 *          VITE_DIRECTLINE_SECRET=<secret>
 *
 * Optionally override the REST host (regional Direct Line) with:
 *          VITE_DIRECTLINE_DOMAIN=https://europe.directline.botframework.com/v3/directline
 *
 * With all of these blank the hook stays in the "unconfigured" state and the
 * UI shows a "not connected" notice instead of erroring.
 * ─────────────────────────────────────────────────────────────────────────
 */

const DEFAULT_DOMAIN = "https://directline.botframework.com/v3/directline";

const TOKEN_URL = (import.meta.env.VITE_DIRECTLINE_TOKEN_URL ?? "").trim();
const BACKEND_TOKEN_URL = apiUrl("/api/directline/token");
const SECRET = (import.meta.env.VITE_DIRECTLINE_SECRET ?? "").trim();
const DOMAIN = (import.meta.env.VITE_DIRECTLINE_DOMAIN ?? "").trim() || DEFAULT_DOMAIN;

export const isDirectLineConfigured = Boolean(TOKEN_URL || SECRET);

export type AgentStatus = "unconfigured" | "connecting" | "online" | "error";

export interface ChatMessage {
  id: string;
  role: "user" | "bot";
  text: string;
  timestamp: number;
  pending?: boolean;
}

// Shape of the activities Direct Line streams back over the WebSocket.
export interface DirectLineActivity {
  id?: string;
  type: string;
  text?: string;
  timestamp?: string;
  from?: { id?: string; name?: string; role?: string };
}

interface StartResponse {
  conversationId: string;
  token: string;
  streamUrl?: string;
}

function makeId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// ── Pure, framework-free helpers (unit-tested in directline.test.ts) ─────────

/** How long to wait for a bot reply before we stop blocking the UI and show a
 * timeout notice. Absolute (not reset by the ~4s typing heartbeat), so a stuck
 * intent can't hang the UI forever. Tunable. */
export const RESPONSE_TIMEOUT_MS = 45_000;

const TIMEOUT_NOTICE =
  "This is taking longer than usual and the assistant hasn't responded yet. You can retry or rephrase your question.";

export type ActivityClass =
  | { kind: "bot-message"; message: ChatMessage }
  | { kind: "typing" }
  | { kind: "ignore" };

/**
 * Decide what an inbound Direct Line activity means: a renderable bot message, a
 * typing/liveness heartbeat, or something to ignore (our own echo, an empty or
 * non-message activity, or a duplicate we've already seen). `seen` is mutated to
 * record message ids so reconnect replays are deduped.
 */
export function classifyActivity(act: DirectLineActivity, seen: Set<string>): ActivityClass {
  const isSelf = act.from?.role === "user" || act.from?.id === "user";
  if (act.type === "typing" && !isSelf) return { kind: "typing" };
  if (act.type !== "message" || !act.text || isSelf) return { kind: "ignore" };
  const key = act.id ?? makeId();
  if (seen.has(key)) return { kind: "ignore" };
  seen.add(key);
  return {
    kind: "bot-message",
    message: {
      id: key,
      role: "bot",
      text: act.text,
      timestamp: act.timestamp ? new Date(act.timestamp).getTime() : Date.now(),
    },
  };
}

/** Escalating, honest wait copy shown under the typing dots. Empty = plain dots. */
export function waitLabel(elapsedMs: number): string {
  if (elapsedMs >= 20_000) return "Still working — complex questions take a little longer…";
  if (elapsedMs >= 8_000) return "Working on it…";
  return "";
}

/** Whether we've waited long enough to stop blocking the UI on a reply. */
export function isResponseTimedOut(elapsedMs: number): boolean {
  return elapsedMs >= RESPONSE_TIMEOUT_MS;
}

/**
 * Obtain a Direct Line token + conversation. Prefers the token endpoint; falls
 * back to starting a conversation directly with the secret.
 */
async function startConversation(signal: AbortSignal): Promise<StartResponse> {
  // Path 1: token endpoint returns a token we then exchange for a conversation.
  const resolvedTokenUrl = TOKEN_URL || BACKEND_TOKEN_URL;
  if (resolvedTokenUrl) {
    const res = await fetch(resolvedTokenUrl, { method: "GET", signal });
    if (!res.ok) throw new Error(`Token endpoint returned ${res.status}`);
    const data = (await res.json()) as { token?: string; conversationId?: string };
    if (!data.token) throw new Error("Token endpoint did not return a token");
    return openConversation(data.token, signal, data.conversationId);
  }

  // Path 2: use the raw secret to open a conversation.
  if (SECRET) {
    return openConversation(SECRET, signal);
  }

  throw new Error("Direct Line is not configured");
}

async function openConversation(
  authToken: string,
  signal: AbortSignal,
  existingConversationId?: string,
): Promise<StartResponse> {
  const url = existingConversationId
    ? `${DOMAIN}/conversations/${existingConversationId}`
    : `${DOMAIN}/conversations`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${authToken}`,
      "Content-Type": "application/json",
    },
    signal,
  });
  if (!res.ok) throw new Error(`Failed to start conversation (${res.status})`);
  const data = (await res.json()) as StartResponse;
  // The conversation response carries a scoped token; prefer it for sending.
  return { ...data, token: data.token || authToken };
}

// ── Fire-and-forget trigger channel ─────────────────────────────────────────
// A module-level Direct Line conversation used to push one-way "trigger"
// messages to the orchestrator agent (e.g. a technician advancing a job),
// without any chat UI. The orchestrator can route these to a downstream
// scheduler agent. Kept separate from the assistant's chat conversation.
interface TriggerChannel {
  id: string;
  token: string;
  socket: WebSocket | null;
}

let triggerChannel: Promise<TriggerChannel | null> | null = null;

async function getTriggerChannel(): Promise<TriggerChannel | null> {
  if (!isDirectLineConfigured) return null;
  if (!triggerChannel) {
    triggerChannel = (async () => {
      const conv = await startConversation(new AbortController().signal);
      const channel: TriggerChannel = {
        id: conv.conversationId,
        token: conv.token,
        socket: null,
      };

      if (conv.streamUrl) {
        const ws = new WebSocket(conv.streamUrl);
        channel.socket = ws;
        const seen = new Set<string>();

        ws.onmessage = (event) => {
          if (!event.data) return;
          try {
            const payload = JSON.parse(event.data) as { activities?: DirectLineActivity[] };
            for (const act of payload.activities ?? []) {
              const res = classifyActivity(act, seen);
              if (res.kind === "bot-message") {
                const report = parseReportReady(res.message.text);
                if (report) {
                  addReport(report);
                } else {
                  console.warn("[trigger-ws] Unexpected bot message:", res.message.text);
                }
              }
            }
          } catch {
            // Ignore unparseable frames.
          }
        };

        ws.onerror = () => {
          console.warn("[trigger-ws] WebSocket error — next trigger will reconnect.");
          triggerChannel = null;
        };

        ws.onclose = () => {
          triggerChannel = null;
        };
      }

      return channel;
    })();
    // If starting fails, clear the cache so the next trigger retries cleanly.
    triggerChannel.catch(() => {
      triggerChannel = null;
    });
  }
  try {
    return await triggerChannel;
  } catch {
    return null;
  }
}

export type TriggerResult = { ok: boolean; reason?: "unconfigured" | "no-conversation" | string };

/** A Direct Line attachment; `contentUrl` may be a data: URI (e.g. a captured photo). */
export interface TriggerAttachment {
  contentType: string;
  contentUrl: string;
  name?: string;
}

/**
 * Send a one-way message ("trigger") to the orchestrator agent over Direct Line.
 * Optionally attach a structured `value` payload and/or file attachments (e.g. a
 * captured photo) the agent can act on — this is the entry point the orchestrator
 * uses to fan out to a scheduler agent or update PowerApps.
 *
 * No-ops gracefully (`ok:false, reason:"unconfigured"`) when Direct Line is
 * blank, so callers never need to guard.
 */
export async function sendAgentTrigger(
  text: string,
  value?: unknown,
  attachments?: TriggerAttachment[],
): Promise<TriggerResult> {
  if (!isDirectLineConfigured) return { ok: false, reason: "unconfigured" };
  const conv = await getTriggerChannel();
  if (!conv) return { ok: false, reason: "no-conversation" };
  try {
    const ctx = getAgentContext();
    const prefix = getRolePrefix(ctx.role);

    const res = await fetch(`${DOMAIN}/conversations/${conv.id}/activities`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${conv.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "message",
        from: { id: ctx.username || "wattwise-app", role: "user" },
        text: `${prefix} ${text}`,
        channelData: {
          userContext: ctx,
        },
        ...(value !== undefined ? { value } : {}),
        ...(attachments && attachments.length ? { attachments } : {}),
      }),
    });
    if (!res.ok) throw new Error(`Trigger failed (${res.status})`);
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "send-failed" };
  }
}

export function parseReportReady(text: string): SavedReport | null {
  if (!text || !text.startsWith("REPORT_READY|")) return null;
  try {
    const jsonStr = text.substring("REPORT_READY|".length);
    const parsed = JSON.parse(jsonStr);
    if (parsed && typeof parsed.name === "string" && typeof parsed.type === "string") {
      return parsed as SavedReport;
    }
    return null;
  } catch {
    return null;
  }
}

export async function sendReportTrigger(
  reportType: "consumption" | "tamper" | "loadshed",
  period?: string,
  format?: "pdf" | "csv",
  requestedBy?: string,
): Promise<TriggerResult> {
  const ctx = getAgentContext();
  return sendAgentTrigger("Generate report", {
    intent: "generate-report",
    reportType,
    period,
    format,
    requestedBy: requestedBy || ctx.username || "Unknown",
  });
}

/**
 * React hook that manages a live Direct Line conversation with the agent.
 */
export function useCopilotAgent() {
  const [status, setStatus] = useState<AgentStatus>(
    isDirectLineConfigured ? "connecting" : "unconfigured",
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [awaitingReply, setAwaitingReply] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const conversationRef = useRef<{ id: string; token: string } | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const seenActivityIds = useRef<Set<string>>(new Set());

  // Robustness state: when the current prompt started waiting (drives escalating
  // copy), whether we've stopped waiting (timed out), plus the pending timer and
  // the last prompt that backs the retry affordance.
  const [awaitingSince, setAwaitingSince] = useState<number | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const replyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastUserTextRef = useRef<string>("");

  const clearReplyTimeout = useCallback(() => {
    if (replyTimeoutRef.current != null) {
      clearTimeout(replyTimeoutRef.current);
      replyTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!isDirectLineConfigured) return;

    const controller = new AbortController();
    let socket: WebSocket | null = null;

    (async () => {
      try {
        setStatus("connecting");
        const conv = await startConversation(controller.signal);
        conversationRef.current = { id: conv.conversationId, token: conv.token };

        if (!conv.streamUrl) {
          // No streaming URL — we can still send, but won't receive live replies.
          setStatus("online");
          return;
        }

        socket = new WebSocket(conv.streamUrl);
        socketRef.current = socket;

        socket.onopen = () => setStatus("online");
        socket.onerror = () => {
          setStatus("error");
          setError("Lost connection to the assistant.");
        };
        socket.onmessage = (event) => {
          if (!event.data) return; // Direct Line sends empty keep-alive frames.
          try {
            const payload = JSON.parse(event.data) as { activities?: DirectLineActivity[] };
            const botMessages: ChatMessage[] = [];

            for (const act of payload.activities ?? []) {
              const res = classifyActivity(act, seenActivityIds.current);
              if (res.kind === "bot-message") {
                if (res.message.text && res.message.text.startsWith("REPORT_READY|")) {
                  const report = parseReportReady(res.message.text);
                  if (report) {
                    addReport(report);
                  } else {
                    console.warn(
                      "[useCopilotAgent] Malformed REPORT_READY message:",
                      res.message.text,
                    );
                  }
                  continue; // Eat the sentinel text regardless so user doesn't see "REPORT_READY|..."
                }
                botMessages.push(res.message);
              }
              // `typing` is the agent's ~4s liveness heartbeat. We already show a
              // waiting state via awaitingReply, and we deliberately do NOT extend
              // the absolute timeout on it — a stuck intent keeps typing forever.
            }

            if (botMessages.length > 0) {
              // A real reply landed (even a late one after a timeout): stop
              // blocking, clear the timer, and drop any timeout notice state.
              clearReplyTimeout();
              setAwaitingReply(false);
              setAwaitingSince(null);
              setTimedOut(false);
              setMessages((prev) => [...prev, ...botMessages]);
            }
          } catch {
            // Ignore frames we can't parse.
          }
        };
      } catch (err) {
        if (controller.signal.aborted) return;
        setStatus("error");
        setError(err instanceof Error ? err.message : "Failed to reach the assistant.");
      }
    })();

    return () => {
      controller.abort();
      socket?.close();
      socketRef.current = null;
      clearReplyTimeout();
    };
  }, [clearReplyTimeout]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      // Optimistically render the user's message.
      setMessages((prev) => [
        ...prev,
        { id: makeId(), role: "user", text: trimmed, timestamp: Date.now() },
      ]);

      const conv = conversationRef.current;
      if (!isDirectLineConfigured || !conv) {
        // Not connected — surface a helpful bot-side notice instead of failing silently.
        setMessages((prev) => [
          ...prev,
          {
            id: makeId(),
            role: "bot",
            text: "The assistant isn't connected yet. Add your Copilot Studio Direct Line details to .env.local to enable live replies.",
            timestamp: Date.now(),
          },
        ]);
        return;
      }

      // Begin (or restart) the wait: remember the prompt for retry, record the
      // start for escalating copy, and arm an absolute timeout so a stuck reply
      // can't hang the UI forever.
      lastUserTextRef.current = trimmed;
      setError(null);
      setTimedOut(false);
      setAwaitingReply(true);
      setAwaitingSince(Date.now());
      clearReplyTimeout();
      replyTimeoutRef.current = setTimeout(() => {
        setAwaitingReply(false);
        setAwaitingSince(null);
        setTimedOut(true);
        setMessages((prev) => [
          ...prev,
          { id: makeId(), role: "bot", text: TIMEOUT_NOTICE, timestamp: Date.now() },
        ]);
      }, RESPONSE_TIMEOUT_MS);

      try {
        const ctx = getAgentContext();
        const prefix = getRolePrefix(ctx.role);

        const res = await fetch(`${DOMAIN}/conversations/${conv.id}/activities`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${conv.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type: "message",
            from: { id: ctx.username || "wattwise-user", role: "user" },
            text: `${prefix} ${trimmed}`,
            channelData: {
              userContext: ctx,
            },
          }),
        });
        if (!res.ok) throw new Error(`Send failed (${res.status})`);
      } catch (err) {
        // The send itself failed — cancel the pending timeout so we don't also
        // show a "took too long" notice on top of the send error.
        clearReplyTimeout();
        setAwaitingReply(false);
        setAwaitingSince(null);
        setError(err instanceof Error ? err.message : "Message failed to send.");
      }
    },
    [clearReplyTimeout],
  );

  const retryLast = useCallback(() => {
    if (lastUserTextRef.current) sendMessage(lastUserTextRef.current);
  }, [sendMessage]);

  return {
    status,
    messages,
    awaitingReply,
    awaitingSince,
    timedOut,
    error,
    sendMessage,
    retryLast,
  };
}

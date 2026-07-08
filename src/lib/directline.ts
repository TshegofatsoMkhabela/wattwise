import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Minimal, dependency-free Direct Line 3.0 client for talking to a
 * Microsoft Copilot Studio agent from the browser.
 *
 * ─── How to connect (no backend required) ───────────────────────────────
 * In Copilot Studio: Settings → Channels → open your agent's web/Direct Line
 * channel and grab EITHER:
 *
 *   1. A "token endpoint" URL (recommended, safe for the browser). It returns
 *      a short-lived token and never exposes the secret. Put it in:
 *          VITE_DIRECTLINE_TOKEN_URL=https://.../directline/token
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
interface DirectLineActivity {
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

/**
 * Obtain a Direct Line token + conversation. Prefers the token endpoint; falls
 * back to starting a conversation directly with the secret.
 */
async function startConversation(signal: AbortSignal): Promise<StartResponse> {
  // Path 1: token endpoint returns a token we then exchange for a conversation.
  if (TOKEN_URL) {
    const res = await fetch(TOKEN_URL, { method: "GET", signal });
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
  existingConversationId?: string
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
let triggerConversation: Promise<{ id: string; token: string } | null> | null = null;

async function getTriggerConversation(): Promise<{ id: string; token: string } | null> {
  if (!isDirectLineConfigured) return null;
  if (!triggerConversation) {
    triggerConversation = (async () => {
      const conv = await startConversation(new AbortController().signal);
      return { id: conv.conversationId, token: conv.token };
    })();
    // If starting fails, clear the cache so the next trigger retries cleanly.
    triggerConversation.catch(() => {
      triggerConversation = null;
    });
  }
  try {
    return await triggerConversation;
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
  attachments?: TriggerAttachment[]
): Promise<TriggerResult> {
  if (!isDirectLineConfigured) return { ok: false, reason: "unconfigured" };
  const conv = await getTriggerConversation();
  if (!conv) return { ok: false, reason: "no-conversation" };
  try {
    const res = await fetch(`${DOMAIN}/conversations/${conv.id}/activities`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${conv.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "message",
        from: { id: "wattwise-app", role: "user" },
        text,
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

/**
 * React hook that manages a live Direct Line conversation with the agent.
 */
export function useCopilotAgent() {
  const [status, setStatus] = useState<AgentStatus>(isDirectLineConfigured ? "connecting" : "unconfigured");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [awaitingReply, setAwaitingReply] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const conversationRef = useRef<{ id: string; token: string } | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const seenActivityIds = useRef<Set<string>>(new Set());

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
            const activities = payload.activities ?? [];
            const botMessages: ChatMessage[] = [];

            for (const act of activities) {
              if (act.type !== "message" || !act.text) continue;
              // Ignore our own echoed messages; keep only the agent's.
              const isUser = act.from?.role === "user" || act.from?.id === "user";
              if (isUser) continue;
              const key = act.id ?? makeId();
              if (seenActivityIds.current.has(key)) continue;
              seenActivityIds.current.add(key);
              botMessages.push({
                id: key,
                role: "bot",
                text: act.text,
                timestamp: act.timestamp ? new Date(act.timestamp).getTime() : Date.now(),
              });
            }

            if (botMessages.length > 0) {
              setAwaitingReply(false);
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
    };
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      // Optimistically render the user's message.
      setMessages((prev) => [...prev, { id: makeId(), role: "user", text: trimmed, timestamp: Date.now() }]);

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

      setAwaitingReply(true);
      try {
        const res = await fetch(`${DOMAIN}/conversations/${conv.id}/activities`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${conv.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type: "message",
            from: { id: "user", role: "user" },
            text: trimmed,
          }),
        });
        if (!res.ok) throw new Error(`Send failed (${res.status})`);
      } catch (err) {
        setAwaitingReply(false);
        setError(err instanceof Error ? err.message : "Message failed to send.");
      }
    },
    []
  );

  return { status, messages, awaitingReply, error, sendMessage };
}

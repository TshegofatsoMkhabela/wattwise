# Mega-Prompt — "One Link Connects Every Agent" (Copilot Studio Direct Line)

> Paste this **after** the frontend is generated (or append it to the build
> prompt). Goal: give the app a **single orchestrator Direct Line link**, and it
> automatically wires up **every AI-agent surface** in the UI to that
> orchestrator, sends messages, **receives responses, and renders them** — chat
> replies inline, background-trigger replies as toasts/an activity feed.

---

## Objective (what "done" means)

Implement a **single, centralized Direct Line connection** to a Microsoft Copilot
Studio **orchestrator** agent. One configuration value (the Direct Line
secret **or** token-endpoint URL — the "orchestrator link") must power **all**
agent touchpoints in the app. When I paste that link once (in Settings or via
env), the app must:

1. Connect to the orchestrator over Direct Line 3.0.
2. Discover and wire **every agent interface** in the UI to that one connection.
3. **Send** user/agent-trigger messages and **receive streamed responses**.
4. **Render responses in the UI** — interactive replies as chat bubbles;
   fire-and-forget trigger replies as toasts and in a global "Agent activity"
   feed; rich replies (adaptive cards, suggested actions, images) rendered too.
5. Attribute each reply to the sub-agent that answered (`from.name`) and keep a
   live list of agents seen.
6. Degrade gracefully when unconfigured, and reconnect/refresh automatically.

There must be exactly **ONE** WebSocket/conversation shared app-wide — never one
per component.

---

## 1) Single source of truth for the orchestrator link

Read the connection config from, in priority order:

1. **Runtime setting** — a Settings → "Agent connection" panel where I paste the
   link and click **Connect**. Persist to `localStorage` (`wattwise.agent`).
2. **Env fallback** — `VITE_DIRECTLINE_TOKEN_URL`, `VITE_DIRECTLINE_SECRET`,
   optional `VITE_DIRECTLINE_DOMAIN` (regional host).

Accept **either**:
- A **token endpoint URL** (recommended, browser-safe): the app GETs it to obtain
  a short-lived token. Copilot Studio → your agent → **Channels → Direct
  Line/Web app** → "token endpoint".
- A raw **Direct Line secret** (demo only — ships in the bundle).

Auto-detect which was pasted: strings starting with `http` → token endpoint;
otherwise treat as a secret.

---

## 2) Architecture — one connection, many consumers

Create a single **`AgentConnectionProvider`** (React context) mounted at the app
root, backed by a framework-agnostic **`DirectLineClient`** singleton.

```
AgentConnectionProvider  (root)
  └─ DirectLineClient (singleton)
       ├─ status: "unconfigured" | "connecting" | "online" | "reconnecting" | "error"
       ├─ agents: { id, name, lastSeen }[]        // discovered from replies
       ├─ activity feed: AgentActivity[]          // every inbound bot activity
       ├─ sendMessage(text, { conversationId? })  // interactive
       ├─ sendTrigger(text, value?, attachments?) // fire-and-forget
       └─ subscribe(handler)                      // push inbound activities
```

Expose hooks that **every** agent surface must use (do NOT let any component open
its own Direct Line connection):

- `useAgentConnection()` → `{ status, agents, connect(link), disconnect, test() }`
- `useAgentChat(threadId)` → `{ messages, awaitingReply, sendMessage }`
- `useAgentTrigger()` → `sendTrigger(text, value?, attachments?)`

---

## 3) Direct Line 3.0 protocol (implement exactly)

Base REST host: `VITE_DIRECTLINE_DOMAIN` or
`https://directline.botframework.com/v3/directline`.

1. **Obtain a token.**
   - Token endpoint: `GET {tokenUrl}` → `{ token, expires_in, conversationId? }`.
   - Secret: use the secret as the bearer for step 2 (or
     `POST /tokens/generate`).
2. **Start conversation:** `POST /conversations` with
   `Authorization: Bearer <token|secret>` →
   `{ conversationId, token, streamUrl, expires_in }`.
3. **Kick off the greeting** (Copilot Studio needs this): immediately
   `POST /conversations/{id}/activities` with
   `{ type: "event", name: "startConversation", from: { id: "wattwise-app" } }`.
4. **Open the stream:** connect a WebSocket to `streamUrl` (wss). Frames are
   `{ activities: Activity[], watermark }`. **Ignore empty frames** (keep-alives).
5. **Send:** `POST /conversations/{id}/activities` with
   `{ type: "message", from: { id: "wattwise-app", role: "user" }, text, value?, attachments? }`.
6. **Receive:** for each inbound activity where `from.id !== "wattwise-app"`:
   - `type === "message"` → render text + `attachments` + `suggestedActions`.
   - `type === "typing"` → show a typing indicator.
   - Record `from.name`/`from.id` into the discovered-agents list.
   - **Dedupe by `activity.id`** (a `Set`), because reconnects can replay.
7. **Reconnect:** on socket close, reconnect with backoff (1s, 2s, 5s, cap 15s)
   via `GET /conversations/{id}?watermark={w}` to get a fresh `streamUrl`;
   preserve `watermark` so no messages are missed.
8. **Token refresh:** `POST /tokens/refresh` before `expires_in` elapses
   (refresh at ~50% of TTL); Direct Line tokens last ~30 min.

Message/attachment types to handle when rendering:
- `application/vnd.microsoft.card.adaptive` → render an Adaptive Card (at minimum
  its text/title/buttons).
- `application/vnd.microsoft.card.hero` and image attachments → card/image.
- `suggestedActions.actions[]` → quick-reply chips that call `sendMessage`.

---

## 4) "Find & connect every agent interface"

Treat each of these UI surfaces as an **agent interface** and wire ALL of them to
the single provider. Maintain them in one registry so none is missed:

| Interface | Mode | Response shown as |
|---|---|---|
| `/assistant` chat | interactive (`useAgentChat`) | chat bubbles + typing |
| Consumer dashboard "Ask AI" card | opens `/assistant` | — |
| Municipality "Ask AI" card | opens `/assistant` | — |
| Technician pipeline (En Route / On Site / Resolve) | trigger | toast + activity feed |
| Technician "Submit field report" | trigger (+ photo attachment) | toast + activity feed |
| Alerts "dispatch"/status changes (if present) | trigger | toast + activity feed |

Rules:
- **Every** trigger passes a structured `value` with a `kind` discriminator
  (`job_status_change`, `field_report`, …) so the orchestrator can route to the
  right sub-agent.
- Every inbound bot activity is appended to a global **Agent activity feed**
  (accessible from the top-bar bell or a dedicated panel), so a response is
  **always shown somewhere**, even when it answers a background trigger and no
  chat is open. Also raise a `toast` for trigger replies.
- If a reply carries `replyToId`/`value.jobId`, correlate it back to the
  originating job/report and reflect it on that card (e.g. "Scheduler set ETA
  16:40").
- Build the **discovered-agents list** from `from.name` across replies and show
  it in the Agent connection panel ("Connected agents: Orchestrator, Scheduler,
  PowerApps Writer…").

---

## 5) Runtime "Connect" UX (so pasting a link just works)

Add a **Settings → Agent connection** panel:

- A text field: "Paste your Copilot Studio Direct Line link (token endpoint URL
  or secret)".
- **Connect** button → saves config, (re)initializes `DirectLineClient`, starts a
  conversation, shows live status: Connecting… → Online (green) / Error (red with
  the reason).
- **Test connection** button → sends `"ping"` (or a `startConversation` event) and
  shows the **actual reply text** inline within ~10s, proving round-trip works.
- Show the discovered-agents list and the conversation id.
- **Disconnect** clears the config and closes the socket.

The same status also drives the existing status pills (`/assistant` header, the
sidebar/topbar connection dot).

---

## 6) Robustness & correctness (must-haves)

- Exactly one WebSocket app-wide; components subscribe, never reconnect.
- Graceful `unconfigured`: no fetch, no crash; UI shows "Not connected" and, on
  send, a helpful notice.
- Dedupe inbound activities by `id`; ignore our own echoed messages
  (`from.id === "wattwise-app"`).
- Reconnect with capped backoff; refresh tokens before expiry; resume from
  `watermark`.
- Handle keep-alive empty frames, non-JSON frames, and 403 (expired token →
  refresh/restart).
- **CORS:** Direct Line REST allows browser calls; if a custom
  `VITE_DIRECTLINE_DOMAIN` blocks CORS, surface a clear error (don't hang).
- Never block the UI on the network: optimistic user bubbles, async triggers.
- Keep the transport swappable behind `DirectLineClient` (so the same UI could
  later target a different agent runtime).

---

## 7) Definition of Done — acceptance tests the build must pass

1. **Configure once, connect everywhere:** paste a token endpoint URL in Settings
   → status flips to **Online**; `/assistant`, technician triggers, and report
   submit all use that one connection (verify a single WebSocket in Network tab).
2. **Send & receive:** in `/assistant`, send "hello" → the orchestrator's reply
   renders as a bubble within a few seconds; a typing indicator shows while
   waiting.
3. **Delayed/background reply:** trigger a technician status change with no chat
   open → the scheduler agent's reply appears as a **toast** and in the **Agent
   activity feed**, correlated to the job.
4. **Rich reply:** if the agent returns an adaptive card or suggested actions,
   they render and the quick-reply chips send follow-ups.
5. **Attribution:** replies show which sub-agent answered (`from.name`); the
   connected-agents list populates.
6. **Resilience:** kill the network briefly → status shows **Reconnecting**, then
   **Online**, with no duplicated messages and no lost replies.
7. **Unconfigured:** with the link blank, nothing crashes; every surface shows a
   graceful "not connected" state.
8. **Test connection** returns and displays a real reply.

---

## 8) Troubleshooting appendix (bake these in as guard rails)

- **No reply after sending** → you didn't send the `startConversation` event, or
  the bot has no greeting/trigger topic; also confirm the WebSocket actually
  opened (not just the POST).
- **401/403 on send** → token expired; implement refresh; a secret used directly
  in the browser may be disabled — prefer the token endpoint.
- **Duplicate messages** → you're not deduping by `activity.id` or you opened
  more than one socket.
- **Replies never render** → you're filtering the wrong `from` field; Copilot
  Studio bot messages have `from.role !== "user"` (and `from.id !== "wattwise-app"`).
- **Empty/garbled frames** → Direct Line sends empty keep-alive frames; guard
  `if (!event.data) return;` and wrap `JSON.parse` in try/catch.
- **Works locally, fails deployed** → mixed content (use `wss`), or a regional
  domain mismatch; set `VITE_DIRECTLINE_DOMAIN` to the correct region.

---

### Suggested files to add/modify

```
src/lib/directline.ts            → DirectLineClient singleton (token, convo,
                                    socket, reconnect, refresh, send, subscribe)
src/store/agentStore.ts          → Zustand: status, agents, activity feed
src/components/agent/
  AgentConnectionProvider.tsx     → mounts client, exposes context/hooks
  AgentActivityFeed.tsx           → global inbound-reply feed (topbar bell)
  AdaptiveCardRenderer.tsx        → minimal adaptive-card + suggested-actions
routes/settings.tsx              → "Agent connection" panel (paste link, Test)
routes/assistant.tsx             → useAgentChat (interactive)
routes/technician.tsx            → useAgentTrigger (job + report triggers)
```

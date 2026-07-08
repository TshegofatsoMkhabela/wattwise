# WattWise — Frontend Build Prompt (for Google AI Studio / Gemini)

> Paste this into Google AI Studio ("Build"). It describes the **current WattWise
> frontend exactly as it exists today** — a frontend-only React app. There is **no
> backend in scope**: live data arrives over a WebSocket (with a built-in
> simulation fallback so nothing is ever empty), and all registry/alert/report
> data is seeded mock data. Build the UI and behaviour to match this spec.
>
> _Verified against the `frontend-only` source on 2026-07-08 (full scan). The
> agent layer uses **Copilot Studio Direct Line**; maps are specified as
> **mock SVG** (the live app uses Google Maps). See `AGENT_CONNECTION_MEGA_PROMPT.md`
> for the production-grade orchestrator-connection spec._

---

## Project overview

Build a frontend-only React web app called **WattWise** — a smart electricity
monitoring and civic-reporting platform for South African households and
municipalities. The physical backend (an Arduino Uno + serial bridge) is out of
scope; the app connects to it over a WebSocket when present and otherwise runs a
1 Hz synthetic simulation so every screen is populated during a demo.

Three user roles, each with their own portal:

1. **Consumer** — a household resident monitoring their own meter.
2. **Municipality / Government operator** — oversight of all meters in an area.
3. **Field technician** — dispatched to investigate tamper alerts on-site.

There is also a **public marketing landing page** and an **AI Assistant** chat
screen (voice + text).

### Design language

Clean, confident South African civic-tech — "Eskom meets modern fintech", but
**light, not dark**. The product runs on a government tablet in Limpopo as
comfortably as a developer laptop in Sandton.

- **Light theme.** App background is near-white slate (`#F8FAFC`); cards are white
  with `rounded-2xl`, hairline `slate-100` borders and soft shadows.
- **Primary action colour is government blue `#005EB8`** (hover `#003F8A`, tint
  `#EBF5FF`). This — not teal — is the dominant accent across buttons, links,
  active nav, focus rings and highlights.
- **Amber `#F59E0B`** for warnings/load-shedding, **coral/red `#EF4444`** for
  critical/tamper, **slate** for neutral text.
- Typography: **Inter** for UI, **JetBrains Mono** for all live numbers, meter
  IDs, currency and clocks. Load both from Google Fonts.
- Money is always `R 1 234.56` (en-ZA). Timestamps are SAST (UTC+2) and shown as
  relative ("2 min ago") via date-fns.
- Colour-blind safe: severity is always icon **and** colour, never colour alone.

---

## Tech stack (match this)

- **React 19 + TypeScript**, built with **Vite**.
- **TanStack Start + TanStack Router** with **file-based routing** (routes live in
  `src/routes/*`, one file per screen; the route tree is generated). *If your
  environment can't run TanStack Start's SSR, use React 18/19 + Vite + a client
  router (React Router v6) and keep the exact URL paths below — the paths and
  behaviour matter more than the router library.*
- **Tailwind CSS v4** (CSS-first: `@import "tailwindcss"` in a global stylesheet
  with an `@theme` block — **not** a `tailwind.config.js`). Include
  `tw-animate-css`.
- **shadcn/ui** component library (Radix primitives) living in
  `src/components/ui/*`, with a `cn()` helper in `src/lib/utils.ts`
  (clsx + tailwind-merge).
- **Zustand** for global state (live readings, alerts/jobs, auth session).
- **@tanstack/react-query** provider at the root.
- **Recharts** for charts.
- **lucide-react** for icons.
- **date-fns** for time formatting.
- **sonner** for toasts (top-right, custom-styled — see below).
- **Mock maps** — the map panels are **self-contained SVG mock maps** (no Google
  Maps, no API key, no external map library). See the map spec below.

---

## Design tokens

Define these in the global stylesheet. Semantic shadcn tokens (light theme):

```
--background:#F8FAFC  --foreground:#0B1628
--card:#FFFFFF        --card-foreground:#0B1628
--primary:#00C9A7     --primary-foreground:#0B1628   /* teal = shadcn primary */
--secondary:#112240   --muted:#E2E8F0  --muted-foreground:#475569
--accent:#E0F7F2      --destructive:#EF4444
--border:#E2E8F0      --input:#E2E8F0  --ring:#00C9A7
--radius:0.625rem
```

Brand palette (used directly in class names throughout the UI):

```
gov-blue        #005EB8   (primary action colour)
gov-blue-dark   #003F8A   (hover)
gov-blue-light  #EBF5FF   (tint / active nav / chips)
navy            #0B1628 / 800 #112240 / 600 #1A3458
teal            #00C9A7 / 600 #00A389 / 400 #33D4B8
amber           #F59E0B / 600 #D97706 / 200 #FDE68A
coral           #EF4444 / 600 #DC2626 / 100 #FEE2E2
slate           #94A3B8 / 200 #E2E8F0 / 800 #1E293B
```

> Note: `--primary` is teal by legacy, but the **actual UI accent is gov-blue
> `#005EB8`**. Use gov-blue for buttons, links, focus rings and active states.

A dark theme is defined via a `.dark` class (navy surfaces) but the app ships in
light mode.

---

## Routing map

| Path | Screen | Notes |
|---|---|---|
| `/` | Marketing landing | Redirects logged-in users to their dashboard |
| `/login` | Sign-in + role selector | Fake auth, persisted |
| `/dashboard` | Consumer dashboard | Default for consumer |
| `/municipality` | Municipality network overview | Default for municipality |
| `/technician` | Field technician workspace | Default for technician |
| `/meter/$meterId` | Meter detail | From table row / alert / job |
| `/alerts` | Alerts Centre | All roles |
| `/ussd` | USSD simulator | Consumer & municipality |
| `/reports` | Reports | All roles |
| `/settings` | Settings (3 tabs) | All roles |
| `/assistant` | AI Assistant (voice + text chat) | From the dashboard "Ask AI" card |

---

## Global app shell (`AppLayout`)

Every authenticated screen is wrapped in a shared layout. If there is no logged-in
user, redirect to `/login`.

**Desktop sidebar** — fixed, **white** (not navy), 240px (`w-60`), `slate-100`
right border, soft shadow:
- Brand: a gov-blue rounded square with a `Zap` icon, "WattWise" + "Energy
  Gateway" wordmark.
- Role pill under the brand (Consumer = gov-blue tint, Municipality = emerald,
  Technician = amber) with the role's icon (`Home`/`Building2`/`Wrench`).
- **Role-based nav** (active item = gov-blue tint background + gov-blue text):
  - Consumer: Dashboard, USSD Simulator, Reports, Settings.
  - Municipality: Network, Alerts, USSD Simulator, Reports, Settings.
  - Technician: My Jobs, Alerts, Reports, Settings.
- Footer: a **live connection indicator** — green pulsing dot "Live · Serial
  bridge" when the WebSocket is connected, amber "Bridge offline" otherwise —
  then the user avatar (initials), name, email, and a logout button.

**Top bar** — sticky, white, height 56px (`h-14`), `slate-100` bottom border:
- Page title (left).
- Right side: a **live clock** `HH:mm:ss SAST` in JetBrains Mono updating every
  second; a connection dot (emerald when connected, red when not); a
  **notification bell** with a red unread dot that opens a slide-over panel
  listing current alerts (each expandable, dismissible).

**Mobile (< 768px):** sidebar becomes a hamburger drawer (with backdrop) plus a
fixed **bottom nav** of the first five role items.

---

## Live data model (Zustand `liveDataStore`)

A single store drives all live numbers. On the client it opens a WebSocket and,
until real data arrives, runs a synthetic simulation so the UI is never empty.

- WebSocket URL: default same-origin `"{ws|wss}://{host}/api/live/ws"` (override
  with `?ws=` query param or `VITE_WS_URL`). Auto-reconnect every 2s on close.
- Inbound bridge message shape (JSON):
  ```ts
  { device_id, ts_iso, volts, watts, state:"normal"|"alert"|"off",
    kwh, cost_rand, balance_rand, runout_eta, overuse_count }
  ```
- Store state: `connected`, `source:"bridge"|"sim"`, `readings: Reading[]`
  (rolling ~300 points), `current: {timestamp,watts,voltage}`, `todayKWh`,
  `state`, and nullable bridge fields `costRand`, `balanceRand`, `runoutEta`,
  `overuseCount`.
- `sendCommand(cmd)` sends a string back over the socket (e.g. `"MUTE"`, `"OFF"`)
  and returns whether the socket was open.
- **Simulation fallback:** every 1000 ms, while `source !== "bridge"`, push a new
  reading that random-walks around a baseline of ~1950 W (±, floored at 200 W),
  voltage ~230 V. As soon as a real bridge frame arrives, flip `source` to
  `"bridge"` and stop simulating.

`Reading = { timestamp:number; watts:number; voltage:number }`.

Formatting helpers (`src/lib/format.ts`): `formatZAR` → `"R1 234.56"` (en-ZA),
`formatW` → `"1 950 W"`, `formatKWh` → `"18.40 kWh"`, and
`TARIFF_PER_KWH = 2.85` (R/kWh).

---

## Domain types

```ts
type Role = "consumer" | "municipality" | "technician";
type MeterStatus = "normal" | "warning" | "critical" | "offline";
interface Meter { id; address; area; consumerName; consumerPhone; status:MeterStatus;
  currentDraw; baselineWatts; deviationThreshold; lastSeenAt; tamperEvents;
  installedAt; hardwareVersion; firmwareVersion; lat; lng; }
type AlertSeverity = "critical"|"warning"|"info";
type AlertStatus = "open"|"in_progress"|"resolved";
interface Alert { id; meterId; address; severity; status; description; createdAt;
  assignedTo?; resolutionNote?; deviationPct?; }
interface Technician { id; name; phone; activeJobs; resolvedToday; }
type JobStatus = "assigned"|"en_route"|"on_site"|"resolved";
interface Job { id; meterId; address; technicianId; severity; status; assignedAt;
  notes?; resolvedAt?; resolutionNote?; }
interface User { id; name; email; role:Role; meterId?; }
```

---

## Seed / mock data

Seed so every screen is fully populated on first load:

- **24 meters**, ids `NXM-001-SOW … NXM-024-SOW`, addresses on real Soweto streets
  (Vilakazi St/Orlando West, Chris Hani Rd/Diepkloof, Meadowlands, Dube, etc.)
  with real-ish lat/lng around −26.2°, 27.9°. Status mix: ~14 normal, 4 warning,
  3 critical, 2 offline. `currentDraw` scales with status (critical ≈ 1.65×
  baseline, warning ≈ 1.32×, offline 0). `tamperEvents` > 0 only for
  warning/critical. Baseline 1800–2400 W, threshold 45%, hardware "NX-Gateway
  v2.1", firmware "1.4.7".
- **8 alerts** (`ALR-1000…`): descriptions like "Physical tamper detected — seal
  breach", "Load anomaly +68% above baseline — possible illegal connection",
  "Reverse current flow detected", "Meter cover removed". First 3 critical, next
  3 warning, last 2 info; statuses open→in_progress→resolved; some `assignedTo`,
  some unassigned; `deviationPct` 30–90.
- **3 technicians**: Sipho Maluleke (3 active), Lerato Khumalo (2), Andile Ncube
  (1).
- **4 seed jobs** (`NXM-2026-00xx`) across the pipeline (assigned/en_route/on_site
  /resolved), critical + warning.
- **Consumer account:** "Casious Mookamedi", meter `NXM-001-TZN`, Tzaneen.
  (Municipality user "Thandi Mokoena (Ops)", technician "Sipho Maluleke".)
- **Load-shedding:** Stage 2, today 18:00–20:30, Group 7 — Tzaneen North.
- Per-meter **30-day usage history** (`{day,date,kWh,hadTamper}`) and a **24-hour**
  hourly usage generator.

---

## Screen 1 — Marketing landing (`/`)

Public page shown to logged-out visitors (logged-in users are redirected to their
role dashboard). Full light marketing page:

- Sticky translucent navbar: WattWise brand, anchor links ("How it works", "Who
  it's for"), gov-blue "Sign in" button → `/login`.
- **Hero** over a full-bleed Joburg-night-lights photo (dark overlay, white text):
  headline about ending electricity theft / seeing your usage, primary CTA to
  `/login`.
- Partner logo strip, a **stats** band, a **"problems we solve"** section, a
  **roles** section (three cards → Consumer / Municipality / Technician), a
  **"how it works"** section, a closing CTA banner, and a footer.

---

## Screen 2 — Login (`/login`)

Centred card on a `#EBF5FF` background (no split illustration). Card has a
`#003F8A` top stripe with brand, then:

- Email + password fields (pre-filled `casious@wattwise.co.za` / `password`).
- **Role selector:** three tappable cards — Household Consumer (`Home`),
  Municipality Operator (`Building2`), Field Technician (`Wrench`) — each with a
  one-line description; selected card gets a gov-blue border + tint.
- Full-width gov-blue submit **"Sign in to Gateway"** with a chevron.
- Fine-print consent line about sharing telemetry with the municipality.

Auth is faked in a **persisted Zustand store** (`authStore`, localStorage key
`nexmotion-auth`): `login(email, role)` synthesises a `User` (role-appropriate
name; consumer gets `meterId`). After login, route to `/dashboard`,
`/municipality`, or `/technician` by role.

---

## Screen 3 — Consumer dashboard (`/dashboard`)

Keep this **deliberately simple** (this is the real layout — not a wall of charts):

1. **Smart-meter alert banner** (only when `state === "alert"`): amber left-border
   card — "Your Kitchen is drawing **N W** — above your safe threshold." Also
   fire a sonner toast with a **"Mute alarm"** action that calls
   `sendCommand("MUTE")`.
2. **Quick-stats row** — 4 cards (2-col on mobile, 4-col on desktop):
   - **Units Used** — `todayKWh` (animated count-up), "kWh today", gov-blue, `Zap`.
   - **Est. Cost** — `formatZAR(costRand ?? todayKWh*TARIFF)`, amber, sub line
     "Runs out {eta}" or "Since midnight".
   - **Suggestions** — a `Link` to `/reports` (gov-blue tint card), shows "3 · Tips
     for you" with a `Lightbulb` and arrow.
   - **Ask AI** — a gov-blue `Link` to `/assistant` (`Sparkles` icon, "ASSISTANT"
     label, big "Ask AI", subtitle "Buy units & more" / balance). *This is the
     entry point to the assistant.*
3. **Usage breakdown** — white card "Where is your electricity going?" with a
   **Recharts donut/pie** of live power draw by appliance (Kitchen [live],
   Geyser, Lighting, Appliances, Other), a "Live draw" chip, and a total.
4. **Load-shedding card** — white card with amber border: "STAGE 2" amber pill,
   "Power off: 18:00 – 20:30", "Group 7 — Tzaneen North", a **live countdown**
   (`HH:MM:SS`, JetBrains Mono) to power-off/power-back, an amber progress bar,
   and a tip "charge your devices and switch on the geyser before 17:45".

Numbers animate via a `CountUp` component. All money via `formatZAR`.

---

## Screen 4 — Municipality network overview (`/municipality`)

1. **KPI row** — 5 cells: four KPI cards (mono values) + an agent card.
   Meters online (`N / 24`), Active tamper alerts (red; "View log →" scrolls to
   the alert log), Illegal-connection suspects (amber, "last 7 days"), Revenue at
   risk (`formatZAR`, red), then an **"Ask AI"** card (gov-blue, `Sparkles`,
   "ASSISTANT" label, big "Ask AI", "Network insights & more" + arrow) that is a
   `Link` to `/assistant` — **identical treatment to the consumer dashboard's Ask
   AI card**.
2. **Network map** — a **mock SVG map** (`MeterNetworkMap`, see the map spec
   below) plotting all 24 meters as coloured dots (teal normal / amber warning /
   coral critical / grey offline) over a stylised township street grid, with a
   legend and hover tooltips (Meter ID, address, status, last seen).
3. **Meter registry table** — search (ID/address/consumer), status filter,
   **click-to-sort** columns (ID, Status, Draw, Tampers — default sort tampers
   desc), pagination (20/page). Columns: Meter ID (mono), Address, Consumer,
   Status badge, Draw (W, mono), Last seen (relative), Tampers (red count badge or
   "—"), Actions ("Dispatch" opens **Dispatch Modal**). Row click → `/meter/$id`.
4. **Consumer alerts & tamper log** — a compact feed; each row: meter ID (mono),
   a TAMPER (red) / CONSUMER (blue) tag, description, severity badge, relative
   time, and assignee ("Unassigned" in amber). A "Dispatch all · N critical
   meters" button filters the table to critical.
5. **Load-shedding broadcast control** — Stage (1–8), Group (1–16), start/end time
   pickers, a "Send USSD push to offline consumers" checkbox (on), a gov-blue
   "Broadcast to Group N" button (fires a toast + prepends to a recent-broadcasts
   list, last 5).

---

## Screen 5 — Field technician workspace (`/technician`)

Two-column on wide screens (`1fr / 400px`):

- **My active jobs** — cards sorted critical-first: severity pill, job ID (mono),
  large address, meter ID (mono), optional note, "assigned X ago", and three
  actions **Mark En Route / Mark On Site / Resolve** (each advances a 4-step
  **pipeline** `Assigned → En Route → On Site → Resolved` shown as a progress-pill
  row; disabled once passed). **Each action also fires a Direct Line trigger to the
  orchestrator** (`sendAgentTrigger`) with a `value:{ kind:"job_status_change", … }`
  payload so the orchestrator routes it to a **scheduler agent**. The toast reports
  the trigger outcome ("Scheduler agent triggered via Direct Line" / "…not
  connected — skipped"). See **Agent orchestration** below.
- **Job map** — the same **mock SVG map** (`TechnicianJobMap`) filtered to this
  technician's active jobs (dots at job locations, coral critical / amber
  warning).
- **Resolved today** — compact list with resolution note + time.
- **Quick field report** (sticky right column) — Meter ID (auto-filled, editable),
  Findings dropdown ("Illegal bypass wire" / "Tampered seal" / "Load anomaly only"
  / "False positive — no fault found" / "Other"), evidence textarea, a
  **"Tap to capture GPS"** button using the real `navigator.geolocation` API
  (spinner; friendly permission/timeout errors; lat/lng mono), and **Photo evidence
  with live webcam capture** (`WebcamCapture`):
  - **Take photo** opens a webcam modal (`navigator.mediaDevices.getUserMedia`),
    shows the live video, and **Capture** snaps the frame to a JPEG via `<canvas>`
    → thumbnail with **Retake** / remove. **Upload** is a fallback. Graceful
    permission/no-camera errors inside the modal.
  - **Submit** fires a Direct Line trigger (`value:{ kind:"field_report", … }`)
    **with the captured photo as a Direct Line attachment** (`data:` URI) so the
    orchestrator can **update PowerApps** with the report + image. Shows a
    submitting spinner, a result toast ("Sent to the orchestrator to update
    PowerApps" / "…not connected — skipped"), then resets.

---

## Screen 6 — Meter detail (`/meter/$meterId`)

- **Header:** back-to-network link, meter ID (large mono), address, status badge,
  "Last seen X ago", and **Dispatch Technician** (gov-blue) + **Export PDF**
  (ghost, toast) buttons.
- **KPI row** (4 mini cards): Current draw (W, count-up, gov-blue), Voltage (V),
  Today usage (kWh), Cost today (`formatZAR`, amber).
- **Live power draw** — Recharts area **WaveformChart** of the last ~5 minutes
  from the live store, with a pulsing "Live" chip.
- **Tamper history** — timeline of this meter's alerts (severity icon +
  colour-coded left border, description, timestamp, "Deviation +X% · Dispatched
  to … / Not dispatched", resolution note).
- **Usage history** — Recharts 30-day bar chart; **tamper days rendered as red
  bars**; hover tooltip with exact kWh.
- **Meter information** — consumer, contact, installed date, hardware/firmware,
  serial-bridge "Online", and **inline-editable** Baseline watts and Deviation
  threshold (click the value → input → blur saves + toast).

---

## Screen 7 — Alerts Centre (`/alerts`)

- Filter chips: **All / Critical / Warning / Resolved / Unassigned** (active =
  gov-blue) + a date-range select (24h / 7d / 30d).
- Alert cards with a severity icon + colour-coded left border: meter ID (mono) ·
  address, status badge, description, relative time, an assignee or an
  **"Unassigned — dispatch now"** action (amber, opens Dispatch Modal), and a
  "View meter →" link.
- Friendly empty state ("The network is calm.") when a filter matches nothing.

---

## Screen 8 — USSD simulator (`/ussd`)

A centred **phone mockup** (dark rounded shell, `#001F5E` screen, mono blue text).
Start screen prompts to dial; typing `*130#` + **Dial** opens the menu. On-screen
dial pad (1–4) plus a **0 · Back** and a red **End** button navigate this tree:

```
*130#  →  1 Balance & units · 2 Current usage · 3 Power alerts · 4 Saving tips · 0 Exit
```

Each leaf shows meter-specific mock content (balance/units, live watts + 10s avg +
kWh today, tamper + load-shedding status, three saving tips). Caption explains it
mirrors dialling `*130#` offline over a SIM800L GSM module.

---

## Screen 9 — Reports (`/reports`)

- Three **report-type cards** (Consumption, Tamper, Load-shedding impact), each
  with an icon, description, and download buttons (CSV/PDF) that fire "Downloading
  …" toasts.
- A **Saved reports** table: Name (mono) · Type · Date · Generated by · Download.

---

## Screen 10 — Settings (`/settings`)

Tabbed (Account / Hardware / Notifications), max-width form column, gov-blue
active tab underline:

- **Account:** avatar + upload, name/email/phone, read-only role, change-password
  fields, Save (toast).
- **Hardware:** COM port, baud-rate select (9600 default), **Test connection**
  button (toast), baseline watts, a **deviation-threshold slider** (10–100%, live
  label), sample-interval select (500 ms / 1 s / 2 s / 5 s), EskomSePush API-key
  field, Save.
- **Notifications:** custom toggle switches (email critical alerts [on], SMS +
  number, browser push [on], and a municipality-only USSD-push toggle),
  notification-frequency select, Save.

---

## Screen 11 — AI Assistant (`/assistant`)   ⭐ voice + text chat

A dedicated chat page inside `AppLayout`, **capped to the viewport (max 100vh)** —
only the message list scrolls; the composer stays pinned at the bottom.

- **Header strip:** gov-blue `Sparkles` badge, "WattWise Assistant" / "Powered by
  Copilot Studio", and a **status pill** (Connected / Connecting… / Offline / Not
  connected).
- **Empty state:** centred `Sparkles`, "How can I help with your energy?", and
  four suggestion chips (Buy electricity units, Why is my usage high?, Tips to
  save money, Report a fault) that send that prompt.
- **Messages:** user bubbles right (gov-blue `#005EB8`, white text), assistant
  bubbles left (slate, bordered); a three-dot **typing indicator** while awaiting
  a reply.
- **Composer:** the `ai-chat-input` component — an expanding rounded input with:
  - **Voice input** — a mic button that uses the Web Speech API for live
    speech-to-text plus a 5-bar **audio waveform visualizer** (Web Audio
    `AnalyserNode`); tap again to stop.
  - **Image attachments** — a "+" button; thumbnails with a shared-element preview
    modal; up to 6.
  - **Send** — arrow button / Enter (Shift+Enter = newline).
  - The teal send/mic button morphs between arrow ↔ mic ↔ stop by state.

### Assistant backend — Copilot Studio over Direct Line (actual)

This screen talks to the agent through the shared Direct Line client
(`src/lib/directline.ts`) via the `useCopilotAgent()` hook, exposing
`{ status, messages, awaitingReply, error, sendMessage }`. It opens a Direct Line
conversation, streams the agent's replies over a WebSocket, and renders them as
assistant bubbles. Config comes from `VITE_DIRECTLINE_TOKEN_URL` (browser-safe
token endpoint, preferred) or `VITE_DIRECTLINE_SECRET`, with an optional regional
`VITE_DIRECTLINE_DOMAIN`. See **Agent orchestration** below for the full protocol
and every touchpoint.

- **Graceful unconfigured state:** with the link blank, show the "Not connected"
  pill and, on send, reply with a notice to add Direct Line details — never crash.

> **Alternative (Google AI Studio / Gemini):** if you build without Copilot Studio,
> keep the same `useCopilotAgent`/chat UI but back it with the Gemini API
> (`@google/genai`, key `GEMINI_API_KEY`/`VITE_GEMINI_API_KEY`) and a South African
> home-energy system instruction. Same interface, same UI — only the transport
> changes.

---

## Mock map spec (`MeterNetworkMap` / `TechnicianJobMap`)

The maps are **mock/placeholder maps — no Google Maps, no API key, no external
library.** Build them as a self-contained inline **SVG** panel:

- A rounded panel (~320–360px tall) with a dark navy background (`#0B1628` /
  `#112240`) and a faint repeating **street-grid pattern** (rectangular "blocks")
  to read as a township map.
- Plot each meter/job as a **dot** positioned from its `lat`/`lng` (linearly map
  the seed data's lat/lng range onto the SVG viewBox), with a soft translucent
  halo behind a solid centre dot, coloured by status: **teal** normal, **amber**
  warning, **coral** critical, **grey** offline.
- A small **legend** (teal/amber/coral/grey) and a title like "Network map — GPS
  meter locations".
- **Hover a dot** → tooltip card with Meter ID (mono), address, status, current
  draw, and last seen. On the technician map, dots are the technician's active
  jobs (label with the job's short meter number).
- Include a subtle caption: *"Mock map — connect a mapping provider to enable live
  GPS positions."*

Keep the same component names/props so the screens don't change:
`<MeterNetworkMap meters={meters} />` and `<TechnicianJobMap jobs={activeJobs}
meters={meters} />`.

---

## Agent orchestration (Copilot Studio Direct Line)

All agent behaviour goes through **one shared Direct Line client**
(`src/lib/directline.ts`) pointed at a Copilot Studio **orchestrator** agent.
Config: `VITE_DIRECTLINE_TOKEN_URL` (preferred, browser-safe token endpoint) **or**
`VITE_DIRECTLINE_SECRET`, plus optional `VITE_DIRECTLINE_DOMAIN` (regional host).
It exposes two entry points:

- **`useCopilotAgent()`** — interactive chat: starts a conversation, streams the
  agent's replies over a WebSocket, returns `{ status, messages, awaitingReply,
  error, sendMessage }`. Used by `/assistant`.
- **`sendAgentTrigger(text, value?, attachments?)`** — one-way "trigger" to the
  orchestrator (no chat UI). Sends a message activity with a structured `value`
  (discriminated by `kind`) and optional file `attachments` (e.g. a captured
  photo as a `data:` URI). The orchestrator routes these to downstream agents
  (scheduler, PowerApps writer). No-ops gracefully (`ok:false, reason:"unconfigured"`)
  when the link is blank.

**Every agent touchpoint in the app (verified against the code):**

| Touchpoint | Entry point | `value.kind` | Downstream |
|---|---|---|---|
| `/assistant` chat | `useCopilotAgent` | — | orchestrator reply → chat bubbles |
| Consumer "Ask AI" card | `Link → /assistant` | — | — |
| Municipality "Ask AI" card | `Link → /assistant` | — | — |
| Technician pipeline (En Route/On Site/Resolve) | `sendAgentTrigger` | `job_status_change` | scheduler agent |
| Technician "Submit field report" | `sendAgentTrigger` + photo attachment | `field_report` | update PowerApps |
| Dispatch Technician modal | *not wired yet* | *(add `dispatch` trigger)* | scheduler agent |

Direct Line 3.0 flow (implement in the client): get token → `POST /conversations`
→ send a `startConversation` event → open the `streamUrl` WebSocket → `POST
…/activities` to send → read `{ activities, watermark }` frames (ignore empty
keep-alives, dedupe by `activity.id`, keep bot messages where `from.id !==` our
app id). Reconnect with backoff and refresh the token before expiry.

> For the robust "one link connects every agent" spec — shared provider, reconnect,
> token refresh, adaptive cards, a global agent-activity feed, and a Settings
> "Connect" panel with **Test connection** — follow
> **`AGENT_CONNECTION_MEGA_PROMPT.md`**. It is the authoritative spec for making the
> orchestrator connection production-grade.

---

## Modal — Dispatch Technician

Triggered from the municipality table, the alerts feed, or meter detail. Centred
white modal with a blurred backdrop:

- Header: "Dispatch Technician", meter ID (mono) · address.
- Optional red summary banner (e.g. "3 active tamper event(s) require
  investigation").
- Technician `<select>` showing each name + active-job count.
- Priority segmented control: **Urgent** (red) / **Normal** (amber) / **Low**
  (gov-blue).
- Instructions textarea.
- Footer: ghost **Cancel** + gov-blue **Dispatch** → success toast "Technician
  dispatched · Job #NXM-2026-XXXX created", assigns the alert, closes.

---

## Cross-cutting UX details

- **Toasts:** sonner, top-right, close button, white card with a coloured
  left-border by type (gov-blue success/info, red error, amber warning).
- All async/mock actions fire a toast; nothing is silently a no-op.
- Charts have hover tooltips; empty states are friendly, never blank.
- Meter IDs, live numbers, currency and the header clock are **JetBrains Mono**.
- Responsive: white sidebar → hamburger drawer + bottom nav under 768px.
- Focus rings and active states use gov-blue `#005EB8`.

---

## Environment variables (frontend-only)

```
# Live sensor WebSocket override (else same-origin /api/live/ws) — optional
VITE_WS_URL=

# Agent orchestrator — Copilot Studio Direct Line (assistant chat + triggers)
VITE_DIRECTLINE_TOKEN_URL=   # preferred: browser-safe token endpoint
VITE_DIRECTLINE_SECRET=      # demo-only fallback (ships in the bundle)
VITE_DIRECTLINE_DOMAIN=      # optional: regional Direct Line host

# Alternative assistant transport — Gemini (Google AI Studio), if not using Copilot Studio
GEMINI_API_KEY=              # or VITE_GEMINI_API_KEY
```

The maps are mock SVG panels, so **no Google Maps key is required**.

---

## Suggested file structure

```
src/
  routes/            __root, index, login, dashboard, municipality, technician,
                     meter.$meterId, alerts, ussd, reports, settings, assistant
  components/
    layout/          AppLayout
    ui/              shadcn primitives + card-basic, status-badge, count-up,
                     dispatch-modal, ai-chat-input, webcam-capture, sonner
    charts/          WaveformChart (+ Sparkline), BarCharts (UsageHistoryChart,
                     DailyBarChart), UsagePieChart
    maps/            MeterNetworkMap, TechnicianJobMap   (mock SVG maps)
  store/             liveDataStore, alertsStore, authStore   (Zustand)
  lib/               utils (cn), format, directline (useCopilotAgent +
                     sendAgentTrigger)
  mock/              meters, alerts, technicians
  types/             index
```

---

## Build acceptance checklist

- [ ] Light theme, white sidebar, gov-blue `#005EB8` as the action colour.
- [ ] All 11 routes present at the exact paths, role-based nav + default routes.
- [ ] Live store with WebSocket + 1 Hz simulation fallback; header clock + live dot.
- [ ] Consumer dashboard = alert banner + 4 quick-stats (incl. **Ask AI** card) +
      live pie + load-shedding countdown (NOT a wall of charts).
- [ ] Municipality KPI row = 4 KPIs + an **Ask AI** card; table search + sort +
      paginate + dispatch modal; **mock SVG map** (coloured dots, legend, tooltips).
- [ ] Technician pipeline actions + real geolocation capture; each pipeline action
      fires a **Direct Line `job_status_change` trigger** (scheduler agent).
- [ ] Technician report: **live webcam capture** (getUserMedia + canvas) with
      upload fallback; **Submit** fires a **`field_report` trigger + photo
      attachment** to update PowerApps.
- [ ] Meter detail waveform + 30-day bars (tamper days red) + inline-edit fields.
- [ ] `/assistant`: max-100vh chat, voice input + waveform, suggestion chips,
      **Direct Line (Copilot Studio) replies** with a graceful "not connected" state.
- [ ] One shared Direct Line client (`useCopilotAgent` + `sendAgentTrigger`); no
      per-component connections (see `AGENT_CONNECTION_MEGA_PROMPT.md`).
- [ ] sonner toasts on every mock action; JetBrains Mono for IDs/numbers/clock.
```

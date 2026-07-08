# WattWise Copilot Alert Integration Design

## Goal

Connect the WattWise demo website to a published Microsoft Copilot Studio
Orchestrator through Direct Line. Simulated household readings must update the
dashboard in real time. When usage stays above 1,500 W for five seconds, the
frontend automatically sends one structured event to the Orchestrator. The
Orchestrator owns routing to the existing Alert Agent and the email workflow.

## Scope

This implementation covers:

- A controllable household electricity simulator and live reading stream.
- Real-time usage display in the WattWise frontend.
- Automatic sustained-high-usage detection in the frontend.
- A secure, shared Direct Line connection to the Orchestrator.
- Structured alert events containing meter and household context.
- Orchestrator acknowledgement and alert progress in the UI.
- Azure-ready configuration and deployment documentation.

FastAPI supplies telemetry, simulator controls, household profile data, and
temporary Direct Line tokens. It does not dispatch technicians, route agents,
or send email. Copilot Studio owns those workflows.

## Architecture

```text
Household simulator
    | WebSocket readings
    v
WattWise React frontend
    | sustained-usage detector
    | Direct Line event
    v
Copilot Studio Orchestrator
    | internal routing
    v
Alert Agent
    | email action
    v
Household email
```

The Azure deployment consists of:

- The React application on Azure Static Web Apps or App Service.
- The FastAPI telemetry service on Azure App Service or Container Apps.
- A FastAPI endpoint that exchanges the Direct Line secret for temporary
  conversation tokens.
- The Direct Line secret stored in Azure Key Vault or an App Service secret
  setting.
- Household profile data stored in the existing demo data layer or PostgreSQL.

## Frontend Components

### Shared Direct Line Client

Replace the current per-hook connection with one application-level Direct Line
client. The client obtains temporary tokens from the WattWise backend, starts a
conversation, sends the Copilot Studio start event and context, consumes the
WebSocket activity stream, refreshes tokens, and reconnects with bounded
backoff.

The browser must never accept or persist a Direct Line secret. The existing
`VITE_DIRECTLINE_SECRET` fallback is removed. All chat messages, alert events,
and activity-feed updates use the same conversation and WebSocket.

The initial context event includes the authenticated user's role, user ID,
meter ID, and area. It excludes secrets and unnecessary personal information.

### Simulator Controls

The consumer dashboard provides demo controls for normal, elevated, and
critical usage. The controls change the backend simulator state; readings
continue to arrive over the existing live-data WebSocket boundary. Each reading
contains:

- `meterId`
- `watts`
- `voltage`
- `timestamp`
- simulated appliance activity when available

### Sustained-Usage Detector

The detector observes readings for the active consumer meter. It starts timing
when usage rises above 1,500 W and triggers only if usage remains above that
threshold for five continuous seconds. A reading at or below 1,500 W resets the
timer.

After triggering, the detector is latched. Sustained high usage cannot create
additional events until usage returns to or below 1,500 W. A later rise starts a
new detection cycle.

Each trigger receives a stable event ID. Retries reuse that ID so the
Orchestrator can process the event idempotently.

### Alert Status UI

The dashboard presents these states:

```text
Normal -> Monitoring spike -> Alerting agent -> Email requested -> Alert acknowledged
```

Connection failures produce an `Agent alert pending` state. Orchestrator replies
appear in both the usage alert card and the global agent activity feed. The
frontend marks an event acknowledged only after receiving a matching response
from the Orchestrator.

## Backend Components

### Direct Line Token Endpoint

FastAPI exposes a same-origin endpoint that calls the Direct Line token
generation API with the server-held secret. It returns only the temporary token,
conversation metadata, and expiry information needed by the frontend.

The endpoint applies configured origin restrictions and basic rate limiting. It
returns sanitized errors and never logs or returns the secret. The secret is
loaded from server environment configuration and must not use a `VITE_` prefix.

### Household Profile Endpoint

The frontend obtains the active meter's household context from the backend. The
profile includes the household email used by the Orchestrator's alert workflow.
The frontend does not ask users to type an email into an alert event.

### Simulator API And Stream

The backend maintains demo simulator state per meter and provides operations to
select normal, elevated, or critical usage. The live WebSocket emits readings at
a predictable interval so a five-second sustained threshold is testable.

The simulator is explicitly demo infrastructure. It does not modify dispatch
jobs or invoke Copilot Studio itself.

## Orchestrator Event Contract

The frontend sends a Direct Line event or message with a structured value:

```json
{
  "kind": "high_usage_alert",
  "eventId": "usage-NXM-001-TZN-20260708T120000Z",
  "meterId": "NXM-001-TZN",
  "householdEmail": "customer@example.com",
  "currentWatts": 1850,
  "thresholdWatts": 1500,
  "durationSeconds": 5,
  "detectedAt": "2026-07-08T12:00:00Z"
}
```

The accompanying instruction tells the Orchestrator to route the event to its
configured high-usage alert workflow. WattWise interacts only with the
Orchestrator and makes no assumptions about the internal Alert Agent contract.

The expected acknowledgement includes the original `eventId`, a status, and a
short user-facing summary. Supported statuses are `accepted`, `completed`, and
`failed`. `accepted` means the Orchestrator accepted the request; `completed`
means its configured alert workflow reports completion. The frontend displays
the status but does not claim email delivery without the Orchestrator's
`completed` acknowledgement.

## Security

- Regenerate the Direct Line secret exposed during planning before testing.
- Store the replacement only in backend environment configuration.
- Issue short-lived Direct Line tokens to the browser.
- Apply explicit production CORS origins.
- Mask household email addresses in application logs.
- Exclude tokens, secrets, and full email addresses from telemetry.
- Do not place Direct Line secrets in source control, local storage, or frontend
  environment variables.

## Failure Handling

- Refresh Direct Line tokens before expiry.
- Reconnect the activity stream with bounded backoff and activity deduplication.
- Retry an unacknowledged alert while the page remains open, using the same
  event ID and bounded attempts.
- Preserve the latched detector state during retries to prevent duplicate
  events.
- Display actionable connection and delivery states instead of silently
  failing.
- Treat malformed or unmatched Orchestrator responses as activity-feed items,
  not alert acknowledgements.

The demo's frontend-triggered automation works only while the site is open. This
is an accepted demo limitation; production unattended monitoring would move the
threshold detector to backend or event-processing infrastructure.

## Testing

Frontend tests cover:

- Five continuous seconds above 1,500 W triggers once.
- A value at or below 1,500 W resets an uncompleted detection window.
- Sustained high usage does not trigger duplicate events.
- Returning below the threshold rearms the detector.
- Retries preserve the event ID.
- Matching acknowledgements update the correct alert.
- Direct Line reconnect does not duplicate activities.

Backend tests cover:

- Token generation success and sanitized upstream failures.
- Missing server configuration.
- Origin and rate-limit behavior.
- Household lookup by meter ID.
- Simulator mode changes and WebSocket reading shape.

End-to-end verification covers:

1. Select critical simulation mode.
2. Observe live dashboard readings above 1,500 W.
3. Observe the five-second monitoring state.
4. Verify exactly one event reaches the Orchestrator.
5. Verify the Orchestrator response appears in WattWise.
6. Verify the configured Alert Agent sends the household email.
7. Keep usage high and verify that no duplicate email is requested.
8. Drop to normal, return to critical, and verify a second cycle can trigger.

## Acceptance Criteria

- The existing assistant chat and automatic alert workflow share one secure
  Direct Line conversation.
- No Direct Line secret appears in the browser bundle or repository.
- Simulator changes are visible in the consumer dashboard in real time.
- One sustained spike produces one structured Orchestrator event.
- The UI shows monitoring, pending, and acknowledged states.
- FastAPI does not dispatch, route agents, or send email.
- The frontend and backend build and their focused tests pass.
- Azure setup and required environment variables are documented.

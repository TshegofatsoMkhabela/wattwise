# WattWise Azure Deployment Design

## Goal

Deploy the WattWise fork at `TshegofatsoMkhabela/wattwise` automatically from
`main` while preserving the existing frontend experience, validating frontend
and backend behavior before and after release, supporting straightforward
rollback, and keeping normal demo hosting below USD 30 per month.

## Architecture

```text
GitHub repository
    | push to main
    v
GitHub Actions CI
    | lint, build, unit, integration, browser tests
    +--------------------------+
    |                          |
    v                          v
Azure Static Web Apps      Azure Container Apps
TanStack SPA frontend      FastAPI + simulator + WebSocket
    |                          |
    +----------- HTTPS/WSS ----+
```

The root TanStack Start application will use SPA mode and deploy to Azure Static
Web Apps Free. The retained FastAPI application, simulator controls, live meter
WebSocket, household profile API, health checks, and Direct Line token endpoint
will deploy as one Azure Container App on the Consumption plan.

The frontend talks directly to the Container App for HTTP and WebSocket traffic.
Azure Static Web Apps does not proxy the WebSocket because its integrated API
route supports HTTP only.

## Azure Resources

Infrastructure is defined in Bicep and provisioned into a dedicated resource
group. The initial design uses:

- Resource group in `South Africa North`.
- Azure Static Web Apps Free resource with `main` as its production branch. The
  Static Web Apps control-plane location is `West Europe`; content is served
  through its global edge network.
- Azure Container Apps Consumption environment in `South Africa North`.
- One externally accessible Container App for FastAPI and the live WebSocket.
- Log Analytics/Application Insights with short retention and conservative
  ingestion limits.
- An Azure budget of USD 25 with notification thresholds before the USD 30
  ceiling.

Provisioning registers `Microsoft.Web`, `Microsoft.App`,
`Microsoft.OperationalInsights`, and `Microsoft.Insights` as required.

Container Apps uses scale-to-zero, a minimum replica count of zero, a low
maximum replica count suitable for the demo, and conservative CPU and memory
allocation. A short cold start is accepted in exchange for the cost target.

## Frontend Build

TanStack Start SPA mode produces a static application shell for Azure Static Web
Apps. A `staticwebapp.config.json` catch-all fallback routes client-side URLs to
the generated shell while preserving asset requests.

Production frontend configuration contains only public endpoint values:

```text
VITE_API_BASE_URL=https://<container-app-host>/api
VITE_WS_URL=wss://<container-app-host>/api/live/ws
```

No Direct Line secret is compiled into the frontend. The existing browser-side
secret fallback is removed as part of the Copilot integration implementation.

## Backend Build

The FastAPI service is packaged in a Docker image. The image runs as a
non-root user, exposes one HTTP port, and starts Uvicorn with proxy-header
support. Azure Container Apps ingress provides TLS and WebSocket connectivity.

The backend receives runtime settings through Container Apps environment
variables and secrets. Sensitive values, including the regenerated Direct Line
secret, are Container Apps secrets and are never placed in GitHub workflow
files, build arguments, frontend environment values, or logs.

Required backend endpoints include:

- A liveness/readiness health endpoint.
- Simulator control endpoints.
- The live meter WebSocket.
- Household profile lookup.
- The Direct Line temporary-token endpoint.

## Continuous Integration

Pull requests and pushes to `main` run the same required validation jobs:

1. Install Node dependencies with `npm ci`.
2. Run ESLint.
3. Run TypeScript/build validation.
4. Run frontend unit tests.
5. Install Python dependencies in an isolated environment.
6. Run backend tests.
7. Build the frontend and backend image.
8. Start the built services locally.
9. Run Playwright route, interaction, and screenshot checks.

Deployment jobs depend on all required validation jobs. A failed check prevents
production deployment.

## Frontend Equivalence Verification

The current frontend has no automated browser suite, so a focused Playwright
suite becomes the release contract. It verifies desktop and mobile rendering
for:

- Login and role selection.
- Consumer dashboard and live usage widgets.
- Municipality network and alerts.
- Technician jobs and field-report controls.
- Assistant panel or route.
- Reports and settings.

Tests cover direct navigation and client-side navigation. Stable screenshot
baselines are committed after manual review. Dynamic clocks, generated readings,
maps, and other nondeterministic regions are fixed or masked in visual tests.

Visual changes fail CI until the baseline change is deliberately reviewed and
committed. This detects accidental differences while allowing intentional UI
work.

## Deployment Flow

### Pull Requests

Pull requests targeting `main` receive:

- Full CI validation.
- An Azure Static Web Apps preview environment for the frontend.
- Mock data and mock-agent mode by default.
- No production Direct Line secret or production household data.

The Container Apps backend is not linked to Static Web Apps pull-request
environments. Pull-request browser tests use local backend services in CI, and
frontend previews use mock mode unless a separate nonproduction API is added
later.

### Main Branch

A push to `main` that passes CI:

1. Builds immutable frontend and backend artifacts tagged with the Git commit
   SHA.
2. Deploys the backend as a new Container Apps revision with zero production
   traffic initially.
3. Runs backend health, HTTP, and WebSocket smoke tests against the revision URL.
4. Routes production backend traffic to the healthy new revision.
5. Deploys the tested frontend artifact to Static Web Apps production.
6. Runs post-deployment end-to-end smoke tests against the public URLs.
7. Records the commit SHA, workflow run, frontend artifact, backend revision,
   and smoke-test result in the GitHub Actions summary.

If backend pre-promotion checks fail, the previous backend revision retains
production traffic. If a frontend or final smoke test fails, the workflow is
marked failed and exposes the rollback workflow as the documented recovery
step.

## Rollback

### Backend

Every backend deployment creates an immutable Container Apps revision named or
labeled with the Git commit SHA. A manual GitHub Actions workflow accepts a
known revision and moves all production traffic to it. Container Apps keeps a
bounded history of inactive revisions.

### Frontend

Every production workflow uploads the tested static frontend as a GitHub Actions
artifact identified by commit SHA. A manual rollback workflow selects a
previous successful commit, verifies that its artifact came from a successful
CI run, and redeploys that artifact to Static Web Apps.

Reverting the source commit remains the long-term correction. Artifact rollback
provides immediate recovery while the source-level revert proceeds through
normal CI.

## Functional Testing

Backend automated tests cover:

- Health and configuration behavior.
- Simulator mode changes.
- Valid live WebSocket readings.
- Household profile lookup.
- Direct Line token success and sanitized failure behavior.
- Missing-secret handling without secret disclosure.

Post-deployment smoke tests cover:

- Frontend root and direct route loading.
- Static assets and SPA fallback behavior.
- Backend health endpoint.
- CORS from the production frontend origin.
- Simulator control request.
- WebSocket connection and valid reading payload.
- Direct Line token endpoint configuration status without printing a token.

The real Orchestrator/email flow is a gated end-to-end test because it has an
external side effect. It runs manually before demonstrations and confirms that
one simulated sustained spike produces one Orchestrator alert request and one
email workflow invocation.

## Authentication And Secrets

GitHub Actions authenticates to Azure through OpenID Connect workload identity
federation. No long-lived Azure client secret is stored in GitHub.

GitHub environment protection separates preview and production deployment
permissions. The production environment can require approval for manual
rollback and infrastructure changes while ordinary tested pushes to `main`
deploy automatically.

Container Apps CORS allows the production Static Web Apps origin and explicit
local development origins. Logs mask email addresses and exclude Direct Line
tokens, secrets, authorization headers, and complete agent event payloads.

## Cost Controls

- Static Web Apps uses the Free plan.
- Container Apps uses Consumption with scale-to-zero.
- Replica, CPU, memory, and log ingestion limits are conservative.
- Log retention is short and appropriate for a demo.
- A USD 25 budget alert warns before the USD 30 monthly limit.
- Optional paid services, databases, custom domains, and always-on replicas are
  excluded from the initial deployment.

The budget alert is informational and does not automatically stop resources.
Actual charges remain usage-dependent and are reviewed in Azure Cost Management.

## Acceptance Criteria

- A successful push to `main` automatically deploys frontend and backend.
- Failed validation prevents deployment.
- Pull requests receive frontend preview environments in mock mode.
- The public frontend preserves the approved desktop and mobile behavior.
- Direct navigation to application routes succeeds.
- The deployed simulator WebSocket updates the frontend.
- Automated backend and post-deployment smoke tests pass.
- Previous frontend artifacts and backend revisions can be selected through a
  documented manual rollback workflow.
- Azure secrets do not appear in source, frontend assets, or workflow logs.
- Normal demo usage remains designed for less than USD 30 per month, with a USD
  25 budget alert configured.

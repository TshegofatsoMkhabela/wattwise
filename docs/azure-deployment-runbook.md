# WattWise Azure Demo Deployment

This repo is prepared for an Azure-hosted demo with:

- Frontend: Azure Static Web Apps, deployed from `main`.
- Backend: Azure Container Apps running the FastAPI simulator and token exchange.
- Orchestrator: Microsoft Copilot Studio through Direct Line. The frontend never stores the Direct Line secret.

## Required GitHub Secrets

Set these in GitHub repo settings before enabling automatic deploys:

- `AZURE_CLIENT_ID`
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`
- `AZURE_STATIC_WEB_APPS_API_TOKEN`

The Azure login values are for an OIDC-enabled service principal. The Static Web Apps token comes from the Static Web App deployment token.

## Required GitHub Variables

- `AZURE_RESOURCE_GROUP`, for example `rg-wattwise-demo`
- `AZURE_CONTAINER_APP_NAME`, for example `wattwise-demo-api`
- `AZURE_CONTAINER_REGISTRY`, for example the ACR name from the Bicep output
- `VITE_API_BASE_URL`, only needed if the backend deploy job is skipped

## Azure Resources

Use `infra/main.bicep` for the demo resource group:

```bash
az group create --name rg-wattwise-demo --location southafricanorth
az deployment group create \
  --resource-group rg-wattwise-demo \
  --template-file infra/main.bicep \
  --parameters appName=wattwise-demo directLineSecret='<rotated-direct-line-secret>'
```

Use `infra/subscription-budget.bicep` for a monthly warning budget:

```bash
az deployment sub create \
  --location southafricanorth \
  --template-file infra/subscription-budget.bicep \
  --parameters amount=25 startDate=2026-07-01 contactEmails='["you@example.com"]'
```

## What Deploy Does

On every push to `main`, `.github/workflows/azure-deploy.yml`:

1. Installs frontend dependencies with `npm ci`.
2. Runs lint and Vitest unit tests.
3. Installs backend dependencies and runs `pytest`.
4. Builds the frontend.
5. Runs Playwright smoke tests against the built frontend.
6. Builds and pushes the backend container image.
7. Updates the Container App to the new image.
8. Builds the frontend with the backend URL and uploads `dist/client` to Static Web Apps.

## Rollback

Backend rollback is handled by `.github/workflows/azure-rollback.yml`. Run it manually and provide a previous Container App revision name.

Frontend rollback can be done from the Azure Static Web Apps deployment history or by reverting the commit on `main` and letting the deploy workflow run again.

## Demo Flow

1. Open the deployed frontend.
2. Go to the consumer dashboard.
3. Click `High` in the Demo Simulator panel.
4. The backend WebSocket pushes high wattage readings.
5. After sustained high usage, the frontend sends a structured trigger to the Copilot Studio orchestrator.
6. The orchestrator routes the event to the Alert Agent, which sends the configured email.

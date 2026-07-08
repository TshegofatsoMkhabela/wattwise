param location string = resourceGroup().location
param staticSiteLocation string = 'West Europe'
param appName string = 'wattwise-demo'
param image string = 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'
@secure()
param directLineSecret string = ''
param frontendOrigin string = ''

var logsName = '${appName}-logs'
var envName = '${appName}-env'
var apiName = '${appName}-api'
var staticName = '${appName}-web'
var acrName = toLower(replace('${appName}acr${uniqueString(resourceGroup().id)}', '-', ''))

resource logs 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: logsName
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

resource env 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: envName
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logs.properties.customerId
        sharedKey: logs.listKeys().primarySharedKey
      }
    }
  }
}

resource acr 'Microsoft.ContainerRegistry/registries@2023-11-01-preview' = {
  name: acrName
  location: location
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: false
  }
}

resource api 'Microsoft.App/containerApps@2024-03-01' = {
  name: apiName
  location: location
  properties: {
    managedEnvironmentId: env.id
    configuration: {
      activeRevisionsMode: 'Multiple'
      ingress: {
        external: true
        targetPort: 8000
        transport: 'auto'
        allowInsecure: false
      }
      registries: [
        {
          server: acr.properties.loginServer
          identity: 'system'
        }
      ]
      secrets: [
        {
          name: 'directline-secret'
          value: directLineSecret
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'api'
          image: image
          env: [
            {
              name: 'APP_ENV'
              value: 'production'
            }
            {
              name: 'FRONTEND_ORIGIN'
              value: frontendOrigin
            }
            {
              name: 'DIRECTLINE_SECRET'
              secretRef: 'directline-secret'
            }
          ]
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
        }
      ]
      scale: {
        minReplicas: 0
        maxReplicas: 1
      }
    }
  }
  identity: {
    type: 'SystemAssigned'
  }
}

resource acrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acr.id, api.id, 'AcrPull')
  scope: acr
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d')
    principalId: api.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

resource staticSite 'Microsoft.Web/staticSites@2024-04-01' = {
  name: staticName
  location: staticSiteLocation
  sku: {
    name: 'Free'
    tier: 'Free'
  }
  properties: {
    repositoryUrl: 'https://github.com/TshegofatsoMkhabela/wattwise'
    branch: 'main'
    buildProperties: {
      appLocation: '/'
      outputLocation: 'dist/client'
    }
  }
}

output staticSiteName string = staticSite.name
output containerAppName string = api.name
output containerRegistryName string = acr.name
output apiUrl string = 'https://${api.properties.configuration.ingress.fqdn}'

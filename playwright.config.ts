import { defineConfig, devices } from '@playwright/test'

const runBrowserMatrix = process.env.E2E_BROWSER_MATRIX === '1'
const configuredBaseUrl = process.env.E2E_BASE_URL ?? 'http://localhost:3000'
const parsedBaseUrl = new URL(configuredBaseUrl)
const usesLocalServer = ['localhost', '127.0.0.1'].includes(parsedBaseUrl.hostname)
const localPort = Number(parsedBaseUrl.port || 3000)
const localHost = parsedBaseUrl.hostname === '127.0.0.1' ? '127.0.0.1' : 'localhost'
const webServerCommand = `npx next dev --hostname ${localHost} --port ${localPort}`

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  reporter: 'list',
  globalSetup: './tests/e2e/global-setup.ts',
  webServer: usesLocalServer
    ? {
        command: webServerCommand,
        port: localPort,
        reuseExistingServer: true,
        timeout: 180_000,
      }
    : undefined,
  projects: runBrowserMatrix
    ? [
        {
          name: 'chromium',
          use: { ...devices['Desktop Chrome'] },
        },
        {
          name: 'webkit',
          use: { ...devices['Desktop Safari'] },
        },
        {
          name: 'mobile-webkit',
          use: { ...devices['iPhone 13'] },
        },
      ]
    : [
        {
          name: 'chromium',
          use: { ...devices['Desktop Chrome'] },
        },
      ],
  use: {
    baseURL: configuredBaseUrl,
    trace: 'on-first-retry',
  },
})

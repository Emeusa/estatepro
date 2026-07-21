import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  expect: {
    timeout: 5_000
  },
  fullyParallel: true,
  reporter: [["list"]],
  projects: [
    {
      name: "android-chromium",
      use: {
        ...devices["Pixel 5"],
        browserName: "chromium",
        channel: "chrome"
      }
    },
    {
      name: "iphone-chromium",
      use: {
        ...devices["iPhone 13"],
        browserName: "chromium",
        channel: "chrome"
      }
    }
  ]
});

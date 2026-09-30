import { defineConfig } from "@playwright/test";

const externalBase=process.env.PLAYWRIGHT_BASE_URL;
const baseURL=externalBase||"http://127.0.0.1:4000";

export default defineConfig({
  testDir:"./tests",
  testMatch:externalBase?/.*production\.spec\.mjs$/:/.*e2e\.spec\.mjs$/,
  fullyParallel:false,
  workers:1,
  retries:process.env.CI?1:0,
  timeout:30000,
  expect:{timeout:7000},
  reporter:process.env.CI?[["line"],["html",{open:"never"}]]:"line",
  use:{
    baseURL,
    trace:"retain-on-failure",
    screenshot:"only-on-failure",
    video:"off"
  },
  webServer:externalBase?undefined:{
    command:"python3 -m http.server 4000 -d public",
    url:"http://127.0.0.1:4000",
    reuseExistingServer:!process.env.CI,
    timeout:15000
  }
});

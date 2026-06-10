import { Container } from "@cloudflare/containers";
import { env as cloudflareEnv } from "cloudflare:workers";

export class DashboardContainer extends Container {
  defaultPort = 8080;
  sleepAfter = "30m";

  envVars = {
    HOST: "0.0.0.0",
    PORT: "8080",
    TMG_DATA_HUB_BASE_URL: cloudflareEnv.TMG_DATA_HUB_BASE_URL,
    TEAM_API_KEY_DASHBOARD_EDITOR: cloudflareEnv.TEAM_API_KEY_DASHBOARD_EDITOR,
    DASHBOARD_AUTH_MODE: cloudflareEnv.DASHBOARD_AUTH_MODE || "cloudflare_access",
    ADMIN_EMAILS: cloudflareEnv.ADMIN_EMAILS,
    SALES_EMAIL_MAP: cloudflareEnv.SALES_EMAIL_MAP,
    DATA_HUB_ASSIGNMENTS_WRITE_PATH: cloudflareEnv.DATA_HUB_ASSIGNMENTS_WRITE_PATH,
    DATA_HUB_ASSIGNMENTS_READ_PATH: cloudflareEnv.DATA_HUB_ASSIGNMENTS_READ_PATH,
  };
}

export default {
  async fetch(request, env) {
    const container = env.DASHBOARD_CONTAINER.getByName("dashboard");
    return container.fetch(request);
  },
};

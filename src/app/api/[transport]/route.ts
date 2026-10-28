import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { z } from "zod";
import { verifyToken } from "@/lib/auth";

// === JOUW GARMIN SERVER ===
const UPSTREAM_MCP_URL = "https://garmin-personal-mcp-ten.vercel.app/mcp";
const UPSTREAM_BEARER_TOKEN = "1cbc2df8533ffa046d18b1924ad2be33ccf607bba66ae708bbe7ea9c95b59e2"; // de token die je in de Garmin-server hebt gezet

async function callUpstream(toolName: string, args: Record<string, unknown>) {
  const res = await fetch(UPSTREAM_MCP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${UPSTREAM_BEARER_TOKEN}`,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: toolName,
        arguments: args,
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upstream error ${res.status}: ${text}`);
  }

  const data = await res.json();
  if (data.error) {
    throw new Error(data.error.message || JSON.stringify(data.error));
  }

  return data.result;
}

const handler = createMcpHandler(
  (server) => {
    // Voorbeeld-tools – voeg hier meer toe naar wens

    server.tool(
      "get_sleep",
      "Haal slaapdata op voor een datum (YYYY-MM-DD).",
      { date: z.string().describe("Datum in formaat YYYY-MM-DD") },
      async ({ date }) => {
        const result = await callUpstream("get_sleep", { date });
        return result;
      }
    );

    server.tool(
      "get_body_battery",
      "Haal Body Battery data op (max 28 dagen).",
      {
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      },
      async (args) => {
        const result = await callUpstream("get_body_battery", args);
        return result;
      }
    );

    server.tool(
      "get_hrv",
      "Haal HRV data op voor een datum.",
      { date: z.string() },
      async ({ date }) => {
        const result = await callUpstream("get_hrv", { date });
        return result;
      }
    );

    server.tool(
      "get_daily_summaries",
      "Dagelijkse samenvattingen (stappen, stress, calories, etc).",
      {
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      },
      async (args) => {
        const result = await callUpstream("get_daily_summaries", args);
        return result;
      }
    );

    server.tool(
      "list_activities",
      "Lijst van recente activiteiten.",
      {
        start: z.number().optional(),
        limit: z.number().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      },
      async (args) => {
        const result = await callUpstream("list_activities", args);
        return result;
      }
    );
  },
  {},
  { basePath: "/api", maxDuration: 60 }
);

const authHandler = withMcpAuth(handler, verifyToken, {
  required: true,
  requiredScopes: ["mcp:tools"],
  resourceMetadataPath: "/.well-known/oauth-protected-resource/api/mcp",
});

export { authHandler as GET, authHandler as POST, authHandler as DELETE };

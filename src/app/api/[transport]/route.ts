import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { z } from "zod";
import { verifyToken } from "@/lib/auth";

const UPSTREAM_MCP_URL = "https://garmin-personal-mcp-ten.vercel.app/mcp";
const UPSTREAM_BEARER_TOKEN = process.env.UPSTREAM_BEARER_TOKEN!;

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
      params: { name: toolName, arguments: args },
    }),
  });

  if (!res.ok) {
    throw new Error(`Upstream error ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
  return data.result;
}

const handler = createMcpHandler(
  (server) => {
    server.tool(
      "get_sleep",
      "Haal slaapdata op voor een datum (YYYY-MM-DD)",
      { date: z.string() },
      async ({ date }) => callUpstream("get_sleep", { date })
    );

    server.tool(
      "get_body_battery",
      "Haal Body Battery data op",
      { startDate: z.string().optional(), endDate: z.string().optional() },
      async (args) => callUpstream("get_body_battery", args)
    );

    server.tool(
      "get_hrv",
      "Haal HRV data op voor een datum",
      { date: z.string() },
      async ({ date }) => callUpstream("get_hrv", { date })
    );

    server.tool(
      "list_activities",
      "Lijst van recente activiteiten",
      {
        start: z.number().optional(),
        limit: z.number().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      },
      async (args) => callUpstream("list_activities", args)
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

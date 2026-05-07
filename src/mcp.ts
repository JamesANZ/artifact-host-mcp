import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import {
  deleteArtifact,
  getArtifactInfo,
  listArtifacts,
  publishArtifact,
  updateArtifact,
} from "./handlers/publish";
import type { Env, RequestContext } from "./types";

function responseContent(payload: Record<string, unknown>) {
  return {
    content: [
      { type: "text" as const, text: JSON.stringify(payload, null, 2) },
    ],
    structuredContent: payload,
  };
}

function createRequestContext(env: Env, request: Request): RequestContext {
  return {
    env,
    ownerApiKey: env.OWNER_API_KEY,
    requestUrl: new URL(request.url),
  };
}

function buildMcpServer(env: Env, request: Request): McpServer {
  const context = createRequestContext(env, request);

  const server = new McpServer({
    name: "artifact-host-mcp",
    version: "0.1.0",
  });

  server.registerTool(
    "publish_artifact",
    {
      description: "Publish text or binary content to a shareable URL.",
      inputSchema: z.object({
        content: z.string(),
        filename: z.string().min(1),
        binary: z.boolean().optional(),
        content_type: z.string().optional(),
        ttl_days: z.number().int().min(-1).max(3650).optional(),
        description: z.string().max(500).optional(),
      }),
    },
    async (args) => responseContent(await publishArtifact(context, args)),
  );

  server.registerTool(
    "update_artifact",
    {
      description: "Overwrite artifact content while keeping the same URL.",
      inputSchema: z.object({
        id: z.string().min(1),
        edit_token: z.string().min(1),
        content: z.string(),
        binary: z.boolean().optional(),
      }),
    },
    async (args) =>
      responseContent(
        await updateArtifact(context, args.id, args.edit_token, args),
      ),
  );

  server.registerTool(
    "delete_artifact",
    {
      description: "Delete an artifact by id and edit token.",
      inputSchema: z.object({
        id: z.string().min(1),
        edit_token: z.string().min(1),
      }),
    },
    async (args) =>
      responseContent(await deleteArtifact(context, args.id, args.edit_token)),
  );

  server.registerTool(
    "list_artifacts",
    {
      description: "List recently published artifacts owned by this API key.",
      inputSchema: z.object({
        limit: z.number().int().min(1).max(100).optional(),
      }),
    },
    async (args) => {
      const result = await listArtifacts(context, args.limit ?? 20);
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(result, null, 2) },
        ],
        structuredContent: { artifacts: result },
      };
    },
  );

  server.registerTool(
    "get_artifact_info",
    {
      description: "Get metadata for a single artifact by id.",
      inputSchema: z.object({
        id: z.string().min(1),
      }),
    },
    async (args) => responseContent(await getArtifactInfo(context, args.id)),
  );

  return server;
}

export async function handleMcpRequest(
  request: Request,
  env: Env,
): Promise<Response> {
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  const server = buildMcpServer(env, request);
  await server.connect(transport);
  const response = await transport.handleRequest(request);
  await server.close();
  return response;
}

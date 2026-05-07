import { Hono } from "hono";
import { createPublishApiRouter } from "./handlers/publish";
import { createServeRouter } from "./handlers/serve";
import { handleMcpRequest } from "./mcp";
import { parseBearerToken, verifyApiKey } from "./lib/auth";
import type { Env } from "./types";

const app = new Hono<{ Bindings: Env; Variables: { ownerApiKey: string } }>();

function unauthorizedResponse() {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

app.get("/", (c) => c.text("ok"));

app.use("/api/*", async (c, next) => {
  const token = parseBearerToken(c.req.header("Authorization"));
  if (!verifyApiKey(token, c.env.OWNER_API_KEY)) {
    return unauthorizedResponse();
  }
  c.set("ownerApiKey", token as string);
  await next();
});

app.route("/api", createPublishApiRouter());
app.route("/", createServeRouter());

app.all("/mcp", async (c) => {
  const token = parseBearerToken(c.req.header("Authorization"));
  if (!verifyApiKey(token, c.env.OWNER_API_KEY)) {
    return unauthorizedResponse();
  }
  return handleMcpRequest(c.req.raw, c.env);
});

export default app;

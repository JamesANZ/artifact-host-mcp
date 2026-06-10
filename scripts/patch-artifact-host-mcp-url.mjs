#!/usr/bin/env node
/**
 * Points Cursor + Claude Desktop MCP configs at the deployed Worker `/mcp` URL.
 * Usage: node scripts/patch-artifact-host-mcp-url.mjs https://your-worker.subdomain.workers.dev
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const origin = process.argv[2]?.replace(/\/+$/, "") ?? "";
if (!origin.startsWith("https://")) {
  console.error(
    'Usage: node scripts/patch-artifact-host-mcp-url.mjs "https://<worker>.<subdomain>.workers.dev"',
  );
  process.exit(1);
}

const mcpUrl = `${origin}/mcp`;

const targets = [
  path.join(os.homedir(), ".cursor", "mcp.json"),
  path.join(
    os.homedir(),
    "Library",
    "Application Support",
    "Claude",
    "claude_desktop_config.json",
  ),
];

function patch(filePath) {
  if (!fs.existsSync(filePath)) {
    console.warn(`SKIP (missing): ${filePath}`);
    return;
  }
  const raw = fs.readFileSync(filePath, "utf8");
  const j = JSON.parse(raw);
  if (!j.mcpServers?.["artifact-host-mcp"]) {
    console.warn(`SKIP (no artifact-host-mcp): ${filePath}`);
    return;
  }
  j.mcpServers["artifact-host-mcp"].url = mcpUrl;
  fs.writeFileSync(filePath, JSON.stringify(j, null, 2) + "\n");
  console.log(`Updated ${filePath}`);
}

console.log(`artifact-host-mcp.url -> ${mcpUrl}`);
for (const p of targets) {
  patch(p);
}

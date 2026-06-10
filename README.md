# artifact-host-mcp

Cloudflare Worker MCP server that publishes artifacts (HTML, PDF, images, code, and binary files) to permanent shareable URLs on your own domain.

## Features

- `publish_artifact` returns a share URL + one-time edit token.
- `update_artifact` overwrites content at the same URL.
- `delete_artifact`, `list_artifacts`, and `get_artifact_info`.
- Public viewing routes (`/v/:id`, `/raw/:id`) with optional TTL expiry.
- Single API key auth for MCP and management API routes.

## Project structure

- `src/index.ts`: Worker entry, auth middleware, route mounting.
- `src/mcp.ts`: MCP server/tool registration and `/mcp` transport.
- `src/handlers/publish.ts`: API + core publish/update/delete/list/info service logic.
- `src/handlers/serve.ts`: public serving endpoints.
- `src/lib/*`: auth, IDs, content type, and R2 wrappers.

## Setup

```bash
npm install
wrangler r2 bucket create artifact-host
wrangler secret put OWNER_API_KEY
```

Use a strong key:

```bash
openssl rand -hex 32
```

Set `wrangler.toml` bucket binding:

```toml
[[r2_buckets]]
binding = "BUCKET"
bucket_name = "artifact-host"
```

## Local development

```bash
npm run dev
```

## Deploy (public share links)

Anyone can open `/v/:id` without auth. To host on Cloudflare (default `https://<worker-name>.<account>.workers.dev` or a custom domain):

**One-shot (token + MCP URL patch):**

1. Ensure `.dev.vars` exists with `OWNER_API_KEY=...` (same value agents use as the Bearer token).
2. Copy `.env.deploy.example` to `.env.deploy` and set [`CLOUDFLARE_API_TOKEN`](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/) (needs Workers Edit + Account R2 permissions for the bucket).
3. Run `npm run deploy:cloudflare` — deploys, uploads the secret, ensures the R2 bucket exists, and updates **Cursor** (`~/.cursor/mcp.json`) and **Claude Desktop** (`~/Library/Application Support/Claude/claude_desktop_config.json`) to `https://…workers.dev/mcp`.

Then reload MCP in Cursor and restart Claude Desktop.

**Manual:** `npx wrangler login` (or `CLOUDFLARE_API_TOKEN`), `npx wrangler r2 bucket create artifact-host`, `npm run deploy`, `npx wrangler secret put OWNER_API_KEY`. Point MCP at `https://<worker-host>/mcp` with `Authorization: Bearer <OWNER_API_KEY>`.

Optional `BASE_URL` in `wrangler.toml` under `[vars]` if you use a **custom domain** or want link metadata to always use a fixed origin (see commented example in `wrangler.toml`). If omitted, share URLs use the host of the request (fine for `*.workers.dev`). If you only use a custom domain (no `*.workers.dev` in the deploy log), run `node scripts/patch-artifact-host-mcp-url.mjs "https://your.custom.domain"` after deploy.

## File types and extensions

`Content-Type` comes from the publish **`filename` extension** (via `mime-types`), or from optional `content_type` / MCP `content_type`. Examples: `.html`, `.md`, `.pdf`, `.png`, `.json`, `.csv`, `.zip`, `.docx`, etc.

For **binary** uploads (PDF, images, Office, archives), send **base64** in `content` and set `binary: true` (MCP) or `"binary": true` (JSON API).

The `/v/...` route serves **inline** for common viewable types (text, images, PDF, audio, video, JSON, XML, fonts). Everything else is offered as a download on `/v/...`; `/raw/...` is always `Content-Disposition: attachment`.

## API routes

- `POST /mcp` (Bearer auth)
- `POST /api/publish` (Bearer auth)
- `PATCH /api/:id` (Bearer auth + `X-Edit-Token`)
- `DELETE /api/:id` (Bearer auth + `X-Edit-Token`)
- `GET /api/list` (Bearer auth)
- `GET /api/info/:id` (Bearer auth)
- `GET /v/:id` (public)
- `GET /v/:id/:filename` (public pretty URL alias)
- `GET /raw/:id` (public forced download)

## Example calls

Publish:

```bash
curl -X POST "https://share.example.com/api/publish" \
  -H "Authorization: Bearer $OWNER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "content":"<html><h1>Hello</h1></html>",
    "filename":"deck.html",
    "ttl_days":30
  }'
```

Update:

```bash
curl -X PATCH "https://share.example.com/api/<id>" \
  -H "Authorization: Bearer $OWNER_API_KEY" \
  -H "X-Edit-Token: <edit_token>" \
  -H "Content-Type: application/json" \
  -d '{"content":"<html><h1>Updated</h1></html>"}'
```

List:

```bash
curl "https://share.example.com/api/list?limit=20" \
  -H "Authorization: Bearer $OWNER_API_KEY"
```

## Connect to Claude custom MCP

- URL: `https://share.your-domain/mcp`
- Header: `Authorization: Bearer <OWNER_API_KEY>`

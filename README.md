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

## Deploy

```bash
npm run deploy
```

Optional environment variable for canonical URL:

- `BASE_URL` (for example `https://share.example.com`)

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

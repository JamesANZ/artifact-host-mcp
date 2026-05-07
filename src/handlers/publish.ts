import { Hono } from "hono";
import { z } from "zod";
import { hashEditToken, sha256Hex, verifyEditToken } from "../lib/auth";
import { inferContentType } from "../lib/content-type";
import { generateArtifactId, generateEditToken } from "../lib/ids";
import {
  deleteContent,
  deleteMeta,
  getMeta,
  listMetas,
  putContent,
  putMeta,
} from "../lib/r2";
import type { ArtifactMeta, Env, RequestContext } from "../types";

const publishSchema = z.object({
  content: z.string(),
  filename: z.string().min(1),
  binary: z.boolean().optional(),
  content_type: z.string().optional(),
  ttl_days: z.number().int().min(-1).max(3650).optional(),
  description: z.string().max(500).optional(),
});

const updateSchema = z.object({
  content: z.string(),
  binary: z.boolean().optional(),
});

function decodeContent(content: string, binary = false): Uint8Array {
  if (!binary) {
    return new TextEncoder().encode(content);
  }
  return Uint8Array.from(atob(content), (char) => char.charCodeAt(0));
}

function getBaseUrl(ctx: RequestContext): string {
  return (
    ctx.env.BASE_URL ?? `${ctx.requestUrl.protocol}//${ctx.requestUrl.host}`
  ).replace(/\/$/, "");
}

function buildArtifactUrls(
  ctx: RequestContext,
  id: string,
): { url: string; download_url: string } {
  const baseUrl = getBaseUrl(ctx);
  return {
    url: `${baseUrl}/v/${id}`,
    download_url: `${baseUrl}/raw/${id}`,
  };
}

function buildExpiresAt(ttlDays: number): string | null {
  if (ttlDays === -1) {
    return null;
  }
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + ttlDays);
  return date.toISOString();
}

async function requireOwnedMeta(
  ctx: RequestContext,
  id: string,
): Promise<ArtifactMeta> {
  const meta = await getMeta(ctx.env, id);
  if (!meta) {
    throw new Error("Artifact not found");
  }
  const ownerHash = await sha256Hex(ctx.ownerApiKey);
  if (meta.owner_key_hash !== ownerHash) {
    throw new Error("Artifact not found");
  }
  return meta;
}

export async function publishArtifact(
  ctx: RequestContext,
  payload: unknown,
): Promise<Record<string, unknown>> {
  const parsed = publishSchema.parse(payload);
  const bytes = decodeContent(parsed.content, parsed.binary ?? false);

  const maxUploadBytes = 25 * 1024 * 1024;
  if (bytes.byteLength > maxUploadBytes) {
    throw new Error("Upload too large. Max size is 25 MB.");
  }

  const id = generateArtifactId();
  const editToken = generateEditToken();
  const ttlDays = parsed.ttl_days ?? 30;
  const now = new Date().toISOString();
  const meta: ArtifactMeta = {
    id,
    filename: parsed.filename,
    content_type: inferContentType(parsed.filename, parsed.content_type),
    description: parsed.description,
    created_at: now,
    updated_at: now,
    expires_at: buildExpiresAt(ttlDays),
    ttl_days: ttlDays,
    edit_token_hash: await hashEditToken(editToken),
    owner_key_hash: await sha256Hex(ctx.ownerApiKey),
    size_bytes: bytes.byteLength,
    view_count: 0,
  };

  await putContent(ctx.env, id, bytes);
  await putMeta(ctx.env, id, meta);

  return {
    id,
    ...buildArtifactUrls(ctx, id),
    edit_token: editToken,
    expires_at: meta.expires_at,
  };
}

export async function updateArtifact(
  ctx: RequestContext,
  id: string,
  editToken: string,
  payload: unknown,
): Promise<Record<string, unknown>> {
  const parsed = updateSchema.parse(payload);
  const meta = await requireOwnedMeta(ctx, id);
  const verified = await verifyEditToken(editToken, meta.edit_token_hash);
  if (!verified) {
    throw new Error("Invalid edit token");
  }

  const bytes = decodeContent(parsed.content, parsed.binary ?? false);
  const maxUploadBytes = 25 * 1024 * 1024;
  if (bytes.byteLength > maxUploadBytes) {
    throw new Error("Upload too large. Max size is 25 MB.");
  }

  await putContent(ctx.env, id, bytes);

  const updatedMeta: ArtifactMeta = {
    ...meta,
    size_bytes: bytes.byteLength,
    updated_at: new Date().toISOString(),
  };

  await putMeta(ctx.env, id, updatedMeta);

  return {
    id,
    ...buildArtifactUrls(ctx, id),
    updated_at: updatedMeta.updated_at,
  };
}

export async function deleteArtifact(
  ctx: RequestContext,
  id: string,
  editToken: string,
): Promise<Record<string, unknown>> {
  const meta = await requireOwnedMeta(ctx, id);
  const verified = await verifyEditToken(editToken, meta.edit_token_hash);
  if (!verified) {
    throw new Error("Invalid edit token");
  }
  await Promise.all([deleteContent(ctx.env, id), deleteMeta(ctx.env, id)]);
  return { deleted: true };
}

export async function getArtifactInfo(
  ctx: RequestContext,
  id: string,
): Promise<Record<string, unknown>> {
  const meta = await requireOwnedMeta(ctx, id);
  const { owner_key_hash, edit_token_hash, ...publicMeta } = meta;
  void owner_key_hash;
  void edit_token_hash;
  return publicMeta;
}

export async function listArtifacts(
  ctx: RequestContext,
  limit = 20,
): Promise<Record<string, unknown>[]> {
  const ownerHash = await sha256Hex(ctx.ownerApiKey);
  const metas = await listMetas(ctx.env, limit);
  return metas
    .filter((meta) => meta.owner_key_hash === ownerHash)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit)
    .map((meta) => ({
      id: meta.id,
      filename: meta.filename,
      url: buildArtifactUrls(ctx, meta.id).url,
      description: meta.description,
      created_at: meta.created_at,
      expires_at: meta.expires_at,
      size_bytes: meta.size_bytes,
      view_count: meta.view_count,
    }));
}

export function createPublishApiRouter() {
  const app = new Hono<{ Bindings: Env; Variables: { ownerApiKey: string } }>();

  app.post("/publish", async (c) => {
    try {
      const result = await publishArtifact(
        {
          env: c.env,
          ownerApiKey: c.get("ownerApiKey"),
          requestUrl: new URL(c.req.url),
        },
        await c.req.json(),
      );
      return c.json(result);
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to publish artifact",
        },
        400,
      );
    }
  });

  app.patch("/:id", async (c) => {
    const editToken = c.req.header("X-Edit-Token");
    if (!editToken) {
      return c.json({ error: "Missing X-Edit-Token header" }, 401);
    }
    try {
      const result = await updateArtifact(
        {
          env: c.env,
          ownerApiKey: c.get("ownerApiKey"),
          requestUrl: new URL(c.req.url),
        },
        c.req.param("id"),
        editToken,
        await c.req.json(),
      );
      return c.json(result);
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to update artifact",
        },
        400,
      );
    }
  });

  app.delete("/:id", async (c) => {
    const editToken = c.req.header("X-Edit-Token");
    if (!editToken) {
      return c.json({ error: "Missing X-Edit-Token header" }, 401);
    }
    try {
      const result = await deleteArtifact(
        {
          env: c.env,
          ownerApiKey: c.get("ownerApiKey"),
          requestUrl: new URL(c.req.url),
        },
        c.req.param("id"),
        editToken,
      );
      return c.json(result);
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to delete artifact",
        },
        400,
      );
    }
  });

  app.get("/list", async (c) => {
    const parsed = z
      .object({ limit: z.coerce.number().int().min(1).max(100).optional() })
      .safeParse(c.req.query());
    const limit = parsed.success ? (parsed.data.limit ?? 20) : 20;

    try {
      const result = await listArtifacts(
        {
          env: c.env,
          ownerApiKey: c.get("ownerApiKey"),
          requestUrl: new URL(c.req.url),
        },
        limit,
      );
      return c.json(result);
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error ? error.message : "Failed to list artifacts",
        },
        400,
      );
    }
  });

  app.get("/info/:id", async (c) => {
    try {
      const result = await getArtifactInfo(
        {
          env: c.env,
          ownerApiKey: c.get("ownerApiKey"),
          requestUrl: new URL(c.req.url),
        },
        c.req.param("id"),
      );
      return c.json(result);
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to get artifact info",
        },
        404,
      );
    }
  });

  return app;
}

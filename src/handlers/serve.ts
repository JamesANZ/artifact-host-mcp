import { Hono } from "hono";
import {
  deleteContent,
  deleteMeta,
  getContent,
  getMeta,
  putMeta,
} from "../lib/r2";
import { shouldForceDownload } from "../lib/content-type";
import type { ArtifactMeta, Env } from "../types";

async function isExpired(meta: ArtifactMeta): Promise<boolean> {
  return (
    meta.expires_at !== null &&
    new Date(meta.expires_at).getTime() <= Date.now()
  );
}

async function loadValidArtifact(
  env: Env,
  id: string,
): Promise<{ meta: ArtifactMeta; content: ArrayBuffer } | null> {
  const meta = await getMeta(env, id);
  if (!meta) {
    return null;
  }

  if (await isExpired(meta)) {
    await Promise.all([deleteContent(env, id), deleteMeta(env, id)]);
    return null;
  }

  const content = await getContent(env, id);
  if (!content) {
    return null;
  }

  return { meta, content };
}

async function incrementViewCount(env: Env, meta: ArtifactMeta): Promise<void> {
  const updated: ArtifactMeta = {
    ...meta,
    view_count: (meta.view_count ?? 0) + 1,
  };
  await putMeta(env, meta.id, updated);
}

export function createServeRouter() {
  const app = new Hono<{ Bindings: Env }>();

  app.get("/v/:id", async (c) => {
    const id = c.req.param("id");
    const artifact = await loadValidArtifact(c.env, id);
    if (!artifact) {
      return c.notFound();
    }

    const headers = new Headers({
      "Content-Type": artifact.meta.content_type,
    });

    if (shouldForceDownload(artifact.meta.content_type)) {
      headers.set(
        "Content-Disposition",
        `attachment; filename="${artifact.meta.filename}"`,
      );
    }

    c.executionCtx.waitUntil(incrementViewCount(c.env, artifact.meta));
    return new Response(artifact.content, { status: 200, headers });
  });

  app.get("/v/:id/:filename", async (c) => {
    const id = c.req.param("id");
    const artifact = await loadValidArtifact(c.env, id);
    if (!artifact) {
      return c.notFound();
    }

    const headers = new Headers({
      "Content-Type": artifact.meta.content_type,
    });

    if (shouldForceDownload(artifact.meta.content_type)) {
      headers.set(
        "Content-Disposition",
        `attachment; filename="${artifact.meta.filename}"`,
      );
    }

    c.executionCtx.waitUntil(incrementViewCount(c.env, artifact.meta));
    return new Response(artifact.content, { status: 200, headers });
  });

  app.get("/raw/:id", async (c) => {
    const id = c.req.param("id");
    const artifact = await loadValidArtifact(c.env, id);
    if (!artifact) {
      return c.notFound();
    }

    const headers = new Headers({
      "Content-Type": artifact.meta.content_type,
      "Content-Disposition": `attachment; filename="${artifact.meta.filename}"`,
    });

    c.executionCtx.waitUntil(incrementViewCount(c.env, artifact.meta));
    return new Response(artifact.content, { status: 200, headers });
  });

  return app;
}

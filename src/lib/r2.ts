import type { ArtifactMeta, Env } from "../types";

const CONTENT_PREFIX = "content/";
const META_PREFIX = "meta/";

function contentKey(id: string): string {
  return `${CONTENT_PREFIX}${id}`;
}

function metaKey(id: string): string {
  return `${META_PREFIX}${id}.json`;
}

export async function putContent(
  env: Env,
  id: string,
  content: Uint8Array,
): Promise<void> {
  await env.BUCKET.put(contentKey(id), content);
}

export async function getContent(
  env: Env,
  id: string,
): Promise<ArrayBuffer | null> {
  const object = await env.BUCKET.get(contentKey(id));
  if (!object) {
    return null;
  }
  return object.arrayBuffer();
}

export async function deleteContent(env: Env, id: string): Promise<void> {
  await env.BUCKET.delete(contentKey(id));
}

export async function putMeta(
  env: Env,
  id: string,
  meta: ArtifactMeta,
): Promise<void> {
  await env.BUCKET.put(metaKey(id), JSON.stringify(meta), {
    httpMetadata: { contentType: "application/json; charset=utf-8" },
  });
}

export async function getMeta(
  env: Env,
  id: string,
): Promise<ArtifactMeta | null> {
  const object = await env.BUCKET.get(metaKey(id));
  if (!object) {
    return null;
  }
  return (await object.json<ArtifactMeta>()) ?? null;
}

export async function deleteMeta(env: Env, id: string): Promise<void> {
  await env.BUCKET.delete(metaKey(id));
}

export async function listMetas(
  env: Env,
  limit: number,
): Promise<ArtifactMeta[]> {
  const listed = await env.BUCKET.list({
    prefix: META_PREFIX,
    limit: Math.max(limit * 5, 100),
  });
  const out: ArtifactMeta[] = [];

  for (const object of listed.objects) {
    const file = await env.BUCKET.get(object.key);
    if (!file) {
      continue;
    }
    const meta = await file.json<ArtifactMeta>();
    if (meta) {
      out.push(meta);
    }
  }

  return out;
}

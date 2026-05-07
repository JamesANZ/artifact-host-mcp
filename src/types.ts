export interface Env {
  BUCKET: R2Bucket;
  OWNER_API_KEY: string;
  BASE_URL?: string;
}

export interface ArtifactMeta {
  id: string;
  filename: string;
  content_type: string;
  description?: string;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
  ttl_days: number;
  edit_token_hash: string;
  owner_key_hash: string;
  size_bytes: number;
  view_count: number;
}

export interface PublishInput {
  content: string;
  filename: string;
  binary?: boolean;
  content_type?: string;
  ttl_days?: number;
  description?: string;
}

export interface UpdateInput {
  id: string;
  edit_token: string;
  content: string;
  binary?: boolean;
}

export interface ListInput {
  limit?: number;
}

export interface RequestContext {
  env: Env;
  ownerApiKey: string;
  requestUrl: URL;
}

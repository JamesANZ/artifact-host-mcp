const encoder = new TextEncoder();

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(input));
  return toHex(digest);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export function parseBearerToken(
  authorizationHeader: string | undefined | null,
): string | null {
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }
  return token;
}

export function verifyApiKey(
  providedKey: string | null,
  expectedKey: string,
): boolean {
  if (!providedKey) {
    return false;
  }
  return timingSafeEqual(providedKey, expectedKey);
}

export async function hashEditToken(token: string): Promise<string> {
  return sha256Hex(token);
}

export function verifyEditToken(
  token: string,
  tokenHash: string,
): Promise<boolean> {
  return hashEditToken(token).then((hash) => timingSafeEqual(hash, tokenHash));
}

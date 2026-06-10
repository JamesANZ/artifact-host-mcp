import mime from "mime-types";

export function inferContentType(filename: string, override?: string): string {
  if (override && override.trim().length > 0) {
    return override;
  }

  const inferred = mime.lookup(filename);
  if (typeof inferred === "string" && inferred.length > 0) {
    return inferred;
  }

  return "application/octet-stream";
}

/**
 * Return true when the browser should treat the response as a download
 * (Content-Disposition: attachment) instead of inline viewing/playback.
 */
export function shouldForceDownload(contentType: string): boolean {
  const base = contentType.split(";")[0]?.trim().toLowerCase() ?? "";

  if (base.startsWith("text/")) return false;
  if (base.startsWith("image/")) return false;
  if (base.startsWith("audio/")) return false;
  if (base.startsWith("video/")) return false;
  if (base.startsWith("font/")) return false;

  if (
    base === "application/pdf" ||
    base === "application/json" ||
    base === "application/xml" ||
    base === "text/xml" ||
    base === "application/sql" ||
    base === "application/yaml" ||
    base === "application/x-yaml"
  ) {
    return false;
  }

  return true;
}

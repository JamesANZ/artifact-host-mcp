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

export function shouldForceDownload(contentType: string): boolean {
  return !(
    contentType.startsWith("text/") ||
    contentType === "application/pdf" ||
    contentType.startsWith("image/")
  );
}

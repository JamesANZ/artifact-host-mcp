import { customAlphabet } from "nanoid";

const artifactIdAlphabet =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const editTokenAlphabet =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_";

const createArtifactId = customAlphabet(artifactIdAlphabet, 12);
const createEditToken = customAlphabet(editTokenAlphabet, 42);

export function generateArtifactId(): string {
  return createArtifactId();
}

export function generateEditToken(): string {
  return createEditToken();
}

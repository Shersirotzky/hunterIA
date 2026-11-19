// Lightweight server-only bridge. Never import document parsers into this module.
import { createHash, randomUUID } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
export const MAX_RESUME_BYTES = 5 * 1024 * 1024;
const issuer = "hunter-resume", audience = "hunter-convex";
function secretKey() {
  const secret = process.env.LINKEDIN_BRIDGE_SECRET;
  if (!secret || secret.length < 32) throw new Error("Resume bridge is not configured");
  return new TextEncoder().encode(secret);
}
type Metadata = { sha256: string; fileName: string; mediaType: string; size: number };
export async function signResumeProof(metadata: Metadata, owner: string) {
  return await new SignJWT(metadata).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setIssuer(issuer).setAudience(audience).setSubject(owner).setJti(randomUUID()).setIssuedAt().setExpirationTime("60s").sign(secretKey());
}
export async function verifyResumeProof(proof: string, bytes: Uint8Array, fileName: string, mediaType: string, owner: string) {
  if (!bytes.length || bytes.length > MAX_RESUME_BYTES || proof.length > 4096) throw new Error("Invalid size");
  const { payload } = await jwtVerify(proof, secretKey(), { algorithms: ["HS256"], issuer, audience, subject: owner, maxTokenAge: "60s", requiredClaims: ["exp", "iat", "jti", "sub"] });
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  if (payload.sha256 !== sha256 || payload.fileName !== fileName || payload.mediaType !== mediaType || payload.size !== bytes.length || typeof payload.jti !== "string" || !/^[a-f0-9-]{36}$/.test(payload.jti)) throw new Error("Proof does not match bytes");
  const buffer = Buffer.from(bytes);
  if (mediaType === "application/pdf" && /\.pdf$/i.test(fileName)) {
    if (!/^%PDF-(1\.[0-9]|2\.0)/.test(buffer.subarray(0, 8).toString()) || !/%%EOF\s*$/.test(buffer.subarray(-1024).toString("latin1"))) throw new Error("Invalid PDF");
  } else if (mediaType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" && /\.docx$/i.test(fileName)) {
    if (bytes.length < 22 || buffer.readUInt32LE(0) !== 0x04034b50) throw new Error("Invalid DOCX");
  } else if (mediaType === "text/plain" && /\.txt$/i.test(fileName)) {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(text)) throw new Error("Invalid TXT");
  } else throw new Error("Invalid type");
  return { sha256, fileName, mediaType, size: bytes.length, jti: payload.jti, expiresAt: payload.exp! * 1000 };
}

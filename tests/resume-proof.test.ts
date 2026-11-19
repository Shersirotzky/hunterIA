import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { SignJWT } from "jose";
import { signResumeProof, verifyResumeProof } from "../lib/resume-proof";

test("resume proof binds parsed bytes, metadata, owner, audience, signature and short expiry", async () => {
  const previous = process.env.LINKEDIN_BRIDGE_SECRET;
  process.env.LINKEDIN_BRIDGE_SECRET = "resume-unit-test-secret-with-at-least-32-characters";
  try {
    const bytes = Buffer.from("Ana Silva");
    const metadata = { sha256: createHash("sha256").update(bytes).digest("hex"), fileName: "resume.txt", mediaType: "text/plain", size: bytes.length };
    const proof = await signResumeProof(metadata, "owner-1");
    const valid = await verifyResumeProof(proof, bytes, metadata.fileName, metadata.mediaType, "owner-1");
    assert.equal(valid.sha256, metadata.sha256); assert.ok(valid.jti); assert.ok(valid.expiresAt > Date.now());
    await assert.rejects(verifyResumeProof(proof, Buffer.from("Evil data"), metadata.fileName, metadata.mediaType, "owner-1"));
    await assert.rejects(verifyResumeProof(proof, bytes, "other.txt", metadata.mediaType, "owner-1"));
    await assert.rejects(verifyResumeProof(proof, bytes, metadata.fileName, "application/pdf", "owner-1"));
    await assert.rejects(verifyResumeProof(proof, bytes, metadata.fileName, metadata.mediaType, "owner-2"));
    for (const [issuer, audience, expiration] of [["hunter-linkedin", "hunter-convex", "60s"], ["hunter-resume", "wrong", "60s"], ["hunter-resume", "hunter-convex", "-1s"]]) {
      const forged = await new SignJWT(metadata).setProtectedHeader({ alg: "HS256" }).setIssuer(issuer).setAudience(audience).setSubject("owner-1").setIssuedAt().setJti(valid.jti).setExpirationTime(expiration).sign(new TextEncoder().encode(process.env.LINKEDIN_BRIDGE_SECRET));
      await assert.rejects(verifyResumeProof(forged, bytes, metadata.fileName, metadata.mediaType, "owner-1"));
    }
    process.env.LINKEDIN_BRIDGE_SECRET = "different-unit-test-secret-at-least-32-characters";
    await assert.rejects(verifyResumeProof(proof, bytes, metadata.fileName, metadata.mediaType, "owner-1"));
  } finally {
    if (previous === undefined) delete process.env.LINKEDIN_BRIDGE_SECRET;
    else process.env.LINKEDIN_BRIDGE_SECRET = previous;
  }
});

import { afterEach, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { generateKeyPair, exportJWK, SignJWT } from "jose";
import { convexTest } from "convex-test";
import { registerCore, sessionIdentity } from "@convex-dev/auth/test";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";
import { rank } from "../lib/jobFit";
import { readLinkedInExport } from "../lib/linkedinExport";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it("imports LinkedIn CSV including quoted values and skips unrelated files", async () => {
  const files = [new File(["Name\nPlaywright\nSQL"], "Skills.csv"),
    new File(['Title,Company Name\n"QA, Pleno",Example'], "Positions.csv"),
    new File(["Name\nPrivate"], "Connections.csv")];
  expect(await readLinkedInExport(files)).toMatchObject({ skills: ["Playwright","SQL"], history: ["QA, Pleno · Example"] });
});
it("scores only available career evidence", () => {
  expect(rank(["QA"], ["SQL"], "QA Pleno", ["SQL", "Cypress"])).toMatchObject({ score: 67, missing: ["Cypress"] });
  expect(rank([], [], "Analista", ["SQL"]).score).toBeNull();
  expect(rank(["QA"], ["SQL","Java"], "QA", [], "Experiência em SQL e JavaScript")).toMatchObject({ score: 67, matched: ["SQL"] });
});
it("creates a real session once per LinkedIn subject and prepares an isolated draft", async () => {
  const t = convexTest(schema, import.meta.glob("../convex/**/*.{js,ts}"));
  registerCore(t);
  vi.stubEnv("CONVEX_CLOUD_URL", "https://test.convex.cloud");
  const origin = "https://hunter.example";
  vi.stubEnv("LINKEDIN_CLIENT_ID", "hunter");
  vi.stubEnv("LINKEDIN_CLIENT_SECRET", "mock");
  vi.stubEnv("LINKEDIN_REDIRECT_URI", origin + "/api/auth/linkedin/callback");
  const keys = await generateKeyPair("RS256");
  const verifier = "a".repeat(64);
  const nonce = createHash("sha256").update(verifier).digest("hex");
  async function login(sub: string, proof = verifier) {
    const token = await new SignJWT({ nonce, name: "Pessoa QA", email: "qa@example.com" })
      .setProtectedHeader({ alg: "RS256", kid: "test" }).setIssuedAt().setExpirationTime("5m")
      .setIssuer("https://www.linkedin.com").setAudience("hunter").setSubject(sub).sign(keys.privateKey);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(Response.json({ id_token: token, expires_in: 3600 }))
      .mockResolvedValueOnce(Response.json({ keys: [{ ...await exportJWK(keys.publicKey), kid: "test" }] })));
    return t.action(api.linkedinOAuth.signIn, { origin, code: "test-code", verifier: proof });
  }
  expect(await login("qa","b".repeat(64))).toEqual({ error: "invalid_state" });
  const first = await login("qa");
  const second = await login("qa");
  const other = await login("another");
  if (!("tokens" in first && "tokens" in second && "tokens" in other)) throw new Error("Login failed");
  expect(second.tokens.userId).toBe(first.tokens.userId);
  expect(other.tokens.userId).not.toBe(first.tokens.userId);
  const owner = t.withIdentity(sessionIdentity(second.tokens));
  expect(await owner.query(api.career.profile, {})).toMatchObject({ fullName: "Pessoa QA", email: "qa@example.com" });
  await owner.mutation(api.career.save, { fullName: "Pessoa QA", email: "qa@example.com", phone: "", summary: "APIs", roles: ["QA"], skills: ["SQL"] });
  await owner.mutation(api.career.addJob, { title: "QA Pleno", company: "Empresa", url: "https://example.com/job", skills: ["SQL"] });
  const [job] = await owner.query(api.career.jobs, {});
  expect(job.score).toBe(100);
  await owner.mutation(api.career.prepare, { jobId: job._id });
  const [draft] = await owner.query(api.career.drafts, {});
  expect(draft.draft).toMatchObject({ email: "qa@example.com", summary: "APIs" });
  const stranger = t.withIdentity(sessionIdentity(other.tokens));
  expect(await stranger.query(api.career.drafts, {})).toEqual([]);
  await expect(stranger.mutation(api.career.prepare, { jobId: job._id })).rejects.toThrow();
});

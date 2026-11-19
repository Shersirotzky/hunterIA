import { registerCore } from "@convex-dev/auth/test";
import { convexTest } from "convex-test";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../convex/_generated/api";
import schema from "../convex/schema";

const modules = import.meta.glob("../convex/**/*.{ts,js}");
const origin = "https://hunter.example";
const redirectUri = `${origin}/api/auth/linkedin/callback`;
let signingKeys: Awaited<ReturnType<typeof generateKeyPair>>;

beforeAll(async () => {
  signingKeys = await generateKeyPair("RS256");
});
beforeEach(() => {
  vi.stubEnv("LINKEDIN_CLIENT_ID", "test-client");
  vi.stubEnv("LINKEDIN_CLIENT_SECRET", "test-secret");
  vi.stubEnv("LINKEDIN_REDIRECT_URI", redirectUri);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function mockProvider(audience = "test-client", seconds = 60, expiration: number | string = "5m") {
  const idToken = await new SignJWT({})
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .setIssuer("https://www.linkedin.com").setAudience(audience)
    .setSubject("linkedin-member").setIssuedAt().setExpirationTime(expiration)
    .sign(signingKeys.privateKey);
  const jwk = await exportJWK(signingKeys.publicKey);
  const request = vi.fn<typeof fetch>()
    .mockResolvedValueOnce(Response.json({
      id_token: idToken, access_token: "private-token", expires_in: seconds, scope: "openid",
    }))
    .mockResolvedValueOnce(Response.json({ keys: [{ ...jwk, kid: "test-key", alg: "RS256" }] }));
  vi.stubGlobal("fetch", request);
  return request;
}

function setup() {
  const t = convexTest(schema, modules);
  registerCore(t);
  return { t, owner: t.withIdentity({ subject: "owner" }), other: t.withIdentity({ subject: "other" }) };
}

describe("OAuth LinkedIn no Convex", () => {
  it("inicia somente para uma sessão, no endereço configurado e com o escopo mínimo", async () => {
    const { t, owner } = setup();
    await expect(t.action(api.linkedinOAuth.start, { origin })).rejects.toThrow("Unauthenticated");
    await expect(owner.action(api.linkedinOAuth.start, { origin: "https://other.example" })).resolves.toBeNull();
    const result = (await owner.action(api.linkedinOAuth.start, { origin }))!;
    const url = new URL(result.url);
    expect(url.origin + url.pathname).toBe("https://www.linkedin.com/oauth/v2/authorization");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: "test-client", redirect_uri: redirectUri, response_type: "code",
      scope: "openid", state: result.state,
    });
    expect(result.state).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(result)).not.toContain("test-secret");
  });

  it("persiste apenas os metadados verificados, isola usuários e permite desconectar", async () => {
    const { t, owner, other } = setup();
    const request = await mockProvider();
    const { state } = (await owner.action(api.linkedinOAuth.start, { origin }))!;
    const args = { state, origin, code: "provider-code" };
    expect(await other.action(api.linkedinOAuth.complete, args)).toBe("invalid_state");
    expect(await owner.action(api.linkedinOAuth.complete, args)).toBe("connected");
    expect(request.mock.calls[0]?.[0]).toBe("https://www.linkedin.com/oauth/v2/accessToken");
    expect(String(request.mock.calls[0]?.[1]?.body)).toContain("client_secret=test-secret");
    expect(await owner.action(api.linkedinOAuth.complete, args)).toBe("invalid_state");
    const records = await t.run((ctx) => ctx.db.query("externalConnections").collect());
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ ownerUserId: "owner", subject: "linkedin-member", grantedScopes: ["openid"] });
    expect(JSON.stringify(records)).not.toMatch(/private-token|test-secret|provider-code|id_token/);
    const status = await owner.query(api.linkedin.status, {});
    expect(Object.keys(status)).toEqual(["expiresAt"]);
    expect(status.expiresAt).toBeGreaterThan(Date.now());
    expect(await other.query(api.linkedin.status, {})).toEqual({ expiresAt: null });
    await other.mutation(api.linkedin.disconnect, {});
    expect(await owner.query(api.linkedin.status, {})).toEqual(status);
    await owner.mutation(api.linkedin.disconnect, {});
    expect(await owner.query(api.linkedin.status, {})).toEqual({ expiresAt: null });
  });

  it("rejeita state incorreto, expirado ou invalidado por desconexão sem chamar o provedor", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const { owner } = setup();
    const provider = vi.fn();
    vi.stubGlobal("fetch", provider);
    const { state } = (await owner.action(api.linkedinOAuth.start, { origin }))!;
    const args = { state, origin, code: "code" };
    expect(await owner.action(api.linkedinOAuth.complete, { ...args, state: "a".repeat(64) })).toBe("invalid_state");
    vi.setSystemTime(Date.now() + 600_001);
    expect(await owner.action(api.linkedinOAuth.complete, args)).toBe("invalid_state");
    const next = (await owner.action(api.linkedinOAuth.start, { origin }))!;
    await owner.mutation(api.linkedin.disconnect, {});
    expect(await owner.action(api.linkedinOAuth.complete, { ...args, state: next.state })).toBe("invalid_state");
    expect(provider).not.toHaveBeenCalled();
  });

  it("reconhece cancelamento só após validar state e não cria conexão", async () => {
    const { owner } = setup();
    const { state } = (await owner.action(api.linkedinOAuth.start, { origin }))!;
    const args = { origin, error: "user_cancelled_authorize" };
    expect(await owner.action(api.linkedinOAuth.complete, { ...args, state: "a".repeat(64) })).toBe("invalid_state");
    expect(await owner.action(api.linkedinOAuth.complete, { ...args, state })).toBe("cancelled");
    expect(await owner.query(api.linkedin.status, {})).toEqual({ expiresAt: null });
  });

  it("reporta configuração ausente", async () => {
    vi.stubEnv("LINKEDIN_CLIENT_SECRET", "");
    const { owner } = setup();
    expect(await owner.action(api.linkedinOAuth.start, { origin })).toBeNull();
  });

  it.each([
    { audience: "another-client", expiry: "5m", outcome: "provider" },
    { audience: "test-client", expiry: 1, outcome: "expired" },
  ])("rejeita token inválido ou expirado ($outcome)", async ({ audience, expiry, outcome }) => {
    const { owner } = setup();
    await mockProvider(audience, 60, expiry);
    const { state } = (await owner.action(api.linkedinOAuth.start, { origin }))!;
    expect(await owner.action(api.linkedinOAuth.complete, { state, origin, code: "code" })).toBe(outcome);
    expect(await owner.query(api.linkedin.status, {})).toEqual({ expiresAt: null });
  });

  it("trata autorização expirada ou revogada sem persistir vínculo", async () => {
    const { owner } = setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: "invalid_grant" }, { status: 400 })));
    const { state } = (await owner.action(api.linkedinOAuth.start, { origin }))!;
    expect(await owner.action(api.linkedinOAuth.complete, { state, origin, code: "code" })).toBe("expired");
    expect(await owner.query(api.linkedin.status, {})).toEqual({ expiresAt: null });
  });
});

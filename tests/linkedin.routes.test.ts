import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../app/api/auth/linkedin/route";
import { GET as callback } from "../app/api/auth/linkedin/callback/route";

const mocks = vi.hoisted(() => ({ action: vi.fn(), token: vi.fn() }));
vi.mock("convex/nextjs", () => ({ fetchAction: mocks.action }));
vi.mock("@/lib/convexAuth", () => ({ convexAuthNextjsAccessToken: mocks.token }));
const origin = "https://hunter.example";
const state = "b".repeat(64);
const endpoint = `${origin}/api/auth/linkedin`;

beforeEach(() => {
  vi.resetAllMocks();
  mocks.token.mockResolvedValue("convex-session");
});

describe("rotas LinkedIn", () => {
  it("rejeita POST de outra origem antes de consultar Convex", async () => {
    const response = await POST(new NextRequest(endpoint, {
      method: "POST", headers: { origin: "https://other.example" }, body: '{"operation":"connect"}',
    }));
    expect(response.status).toBe(403);
    expect(mocks.action).not.toHaveBeenCalled();
  });

  it("inicia consentimento com cookie temporário HttpOnly", async () => {
    const url = `https://www.linkedin.com/oauth/v2/authorization?state=${state}`;
    mocks.action.mockResolvedValue({ url, state });
    const response = await POST(new NextRequest(endpoint, {
      method: "POST", headers: { origin }, body: '{"operation":"connect"}',
    }));
    expect(await response.json()).toEqual({ url });
    expect(response.headers.get("set-cookie")).toMatch(/HttpOnly.*Secure|Secure.*HttpOnly/i);
    expect(response.headers.get("set-cookie")).toContain("Max-Age=600");
  });

  it("rejeita callback sem cookie mesmo quando há cancelamento", async () => {
    const response = await callback(new NextRequest(`${endpoint}/callback?error=access_denied&state=${state}`));
    expect(response.headers.get("location")).toBe("/admin?linkedin=invalid_state");
    expect(mocks.action).not.toHaveBeenCalled();
  });

  it("redireciona o callback confirmado e remove o code do endereço do painel", async () => {
    mocks.action.mockResolvedValue("connected");
    const response = await callback(new NextRequest(`${endpoint}/callback?code=private-code&state=${state}`, {
      headers: { cookie: `linkedin_oauth_state=${state}` },
    }));
    expect(response.headers.get("location")).toBe("/admin?linkedin=connected");
    expect(response.headers.get("set-cookie")).toContain("Expires=Thu, 01 Jan 1970");
  });

  it("retorna erro controlado quando Convex falha, sem propagar detalhes", async () => {
    mocks.action.mockRejectedValue(new Error("sensitive internal value"));
    const response = await callback(new NextRequest(`${endpoint}/callback?code=private-code&state=${state}`, {
      headers: { cookie: `linkedin_oauth_state=${state}` },
    }));
    expect(response.headers.get("location")).toBe("/admin?linkedin=backend");
  });
});

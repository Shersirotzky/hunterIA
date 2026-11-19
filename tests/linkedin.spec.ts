import { expect, test } from "@playwright/test";

test.beforeEach(async ({ context, baseURL, request }) => {
  // The local mock backend accepts this synthetic session for browser tests.
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
  const token = `eyJhbGciOiJSUzI1NiJ9.${payload}.mock`;
  await context.addCookies([{ name: "__convexAuthJWT", value: token, url: baseURL! }]);
  await request.post("/api/auth/linkedin", {
    headers: { origin: baseURL!, cookie: `__convexAuthJWT=${token}` }, data: { operation: "disconnect" },
  });
});

test("confirma o vínculo somente após callback e permite desconectar", async ({ page }) => {
  await page.route("https://www.linkedin.com/oauth/v2/authorization?*", async (route) => {
    const params = new URL(route.request().url()).searchParams;
    expect(params.get("scope")).toBe("openid");
    const callback = new URL(params.get("redirect_uri")!);
    callback.search = new URLSearchParams({ code: "ok", state: params.get("state")! }).toString();
    await route.fulfill({ status: 302, headers: { location: callback.toString() } });
  });
  await page.goto("/admin");
  const start = page.waitForResponse((response) => response.url().endsWith("/api/auth/linkedin") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Conectar LinkedIn", exact: true }).click();
  const response = await start;
  expect(response.status()).toBe(200);
  await expect(page.getByText("LinkedIn conectado", { exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("Conexão com o LinkedIn confirmada.");
  await page.reload();
  await expect(page.getByText("LinkedIn conectado", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Desconectar LinkedIn" }).click();
  await expect(page.getByRole("status")).toHaveText("LinkedIn desconectado do Hunter IA.");
  await expect(page.getByRole("button", { name: "Conectar LinkedIn", exact: true })).toBeVisible();
});

test("exibe carregamento e orienta quando falta configuração", async ({ page }) => {
  let unblock!: () => void;
  const waiting = new Promise<void>((resolve) => { unblock = resolve; });
  await page.route("**/api/auth/linkedin", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    await waiting;
    await route.fulfill({ status: 503, json: { error: "configuration" } });
  });
  await page.goto("/admin?linkedin=connected");
  await expect(page.getByText("LinkedIn conectado", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Conectar LinkedIn", exact: true }).click();
  await expect(page.getByRole("button", { name: "Conectando…" })).toBeDisabled();
  unblock();
  await expect(page.getByRole("status")).toContainText("A integração precisa de configuração.");
  await expect(page.getByRole("button", { name: "Conectar LinkedIn", exact: true })).toBeEnabled();
});

test("volta ao painel após cancelamento", async ({ page }) => {
  await page.route("https://www.linkedin.com/oauth/v2/authorization?*", async (route) => {
    const params = new URL(route.request().url()).searchParams;
    const callback = new URL(params.get("redirect_uri")!);
    callback.search = new URLSearchParams({ error: "access_denied", state: params.get("state")! }).toString();
    await route.fulfill({ status: 302, headers: { location: callback.toString() } });
  });
  await page.goto("/admin");
  await page.getByRole("button", { name: "Conectar LinkedIn", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Você cancelou a autorização");
  await expect(page.getByText("LinkedIn conectado", { exact: true })).toHaveCount(0);
});

test("mostra reconexão quando a autorização armazenada está vencida", async ({ page }) => {
  await page.route("**/api/auth/linkedin", async (route) => {
    await route.fulfill({ json: { expiresAt: Date.now() - 1000 } });
  });
  await page.goto("/admin");
  await expect(page.getByRole("button", { name: "Reconectar LinkedIn" })).toBeVisible();
  await expect(page.getByText("LinkedIn conectado", { exact: true })).toHaveCount(0);
});


test("oferece nova tentativa após falha de consulta ao Convex", async ({ page }) => {
  let unavailable = true;
  await page.route("**/api/auth/linkedin", (route) => unavailable
    ? route.fulfill({ status: 503, json: { error: "backend" } })
    : route.continue());
  await page.goto("/admin");
  await expect(page.getByRole("status")).toContainText("não conseguiu consultar o Convex");
  unavailable = false;
  await page.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(page.getByRole("button", { name: "Conectar LinkedIn", exact: true })).toBeEnabled();
});

test("o primeiro acesso oferece LinkedIn e informa quando faltam credenciais", async ({ page, context }) => {
  await context.clearCookies();
  await page.goto("/signin");
  await page.getByRole("button", { name: "Continuar com LinkedIn" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("credenciais");
  await page.goto("/signup");
  await expect(page.getByRole("button", { name: "Continuar com LinkedIn" })).toBeVisible();
});

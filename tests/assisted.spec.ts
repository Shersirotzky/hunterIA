import { test, expect, type Page } from "@playwright/test";
import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { loginLinkedin } from "./helpers";

const run = promisify(execFile);
const appUrl = "http://localhost:3100";
const externalUrl = "https://example.com/assisted-application-test";
test.use({ baseURL: appUrl });
test.setTimeout(60000);

function assertLocalDeployment() {
  const raw = readFileSync(".env.local", "utf8");
  const deployment = process.env.CONVEX_DEPLOYMENT ?? raw.match(/^CONVEX_DEPLOYMENT=["']?([^"'\s]+)/m)?.[1];
  const url = process.env.NEXT_PUBLIC_CONVEX_URL ?? raw.match(/^NEXT_PUBLIC_CONVEX_URL=["']?([^"'\s]+)/m)?.[1];
  if (!deployment?.startsWith("local:") || !url || !/^http:\/\/(127\.0\.0\.1|localhost):\d+\/?$/.test(url) || process.env.CONVEX_DEPLOY_KEY) {
    throw new Error("Fixture assistida exige deployment local e URL loopback; nenhum comando Convex será executado.");
  }
}
test.beforeAll(assertLocalDeployment);

async function prepareFixture(page: Page, question = false) {
  assertLocalDeployment();
  const subject = `assisted-${randomUUID()}`;
  await loginLinkedin(page, subject, `${subject}@example.com`);
  const accountResponse = await page.request.get(`${appUrl}/api/account`);
  expect(accountResponse.ok()).toBeTruthy();
  const account = await accountResponse.json();
  expect(account.userId).toEqual(expect.any(String));
  await page.goto("/profile");
  await page.getByLabel("Nome completo", {exact:true}).fill("Candidato QA");
  await page.getByLabel("E-mail de contato", {exact:false}).fill(`${subject}@example.com`);
  await page.getByLabel("Título profissional", {exact:true}).fill("Analista QA");
  await page.getByLabel("Resumo profissional", {exact:true}).fill("Experiência em testes de software e SQL.");
  await page.getByLabel("Cargos desejados", {exact:false}).fill("QA");
  await page.getByLabel("Habilidades", {exact:false}).fill("SQL\nTestes");
  await page.getByLabel("Locais de interesse", {exact:false}).fill("Fortaleza");
  await page.locator('[name="workHistoryJson"]').fill("QA na empresa Acme; testes de software e SQL.");
  await page.getByRole("combobox",{name:"Senioridade desejada",exact:true}).selectOption("Sênior");
  await page.getByLabel("Anos de experiência profissional",{exact:false}).fill("5");
  await page.getByLabel("Modalidades de trabalho",{exact:false}).fill("Remoto");
  await page.getByLabel("Idiomas e nível",{exact:false}).fill("Inglês: avançado");
  await page.getByLabel("Nome deste currículo", {exact:true}).fill("Currículo QA");
  await page.getByRole("textbox", {name:"Texto do currículo",exact:true}).fill("Candidato QA — experiência verdadeira em QA, SQL e testes.");
  await page.getByRole("button", { name: "Salvar perfil", exact: true }).click();
  await expect(page.getByRole("status").filter({hasText:"Perfil salvo"})).toBeVisible();
  await page.getByRole("button", { name: "Revisei e aprovo este perfil", exact: true }).click();
  await expect(page).toHaveURL(/\/jobs$/);

  // Never publish or change environment. Run only against an explicitly local deployment.
  assertLocalDeployment();
  await run(process.execPath, ["node_modules/convex/bin/main.js", "run", "--deployment", "local", "jobs:ingest", JSON.stringify({
    owner: account.userId, board: "assisted-e2e-fixture", jobs: [{
      seniority:"Senior",workMode:"Remote",languagesJson:'["English: advanced"]',minimumYearsExperience:3,
      sourceId: "qa-1", title: "QA Testes SQL", canonicalUrl: externalUrl, location: "Fortaleza", description: "Testes SQL",
      questionsStatus: "available", questionsJson: JSON.stringify(question ? [{key:"0:question_qa",label:"Descreva um teste que você executou",required:true,type:"text",options:[],sensitive:false}] : []),
    }],
  })], { cwd: process.cwd(), timeout: 30000 });
  await page.goto("/jobs");
  const card = page.getByTestId("job-card").filter({ has: page.getByRole("heading", { name: "QA Testes SQL", exact: true }) });
  await expect(card).toHaveCount(1);
  await expect(card).toContainText("100/100");
  return card;
}

async function openDraft(page: Page, question = false) {
  const card = await prepareFixture(page, question);
  const detailUrl = await card.getByRole("link", {name:"QA Testes SQL",exact:true}).getAttribute("href");
  expect(detailUrl).toBeTruthy();
  // A plain GET renders the page but never persists a draft. Client opening triggers POST.
  expect((await page.request.get(detailUrl!)).ok()).toBeTruthy();
  await page.goto("/applications");
  await expect(page.getByTestId("application-card")).toHaveCount(0);
  await page.goto("/jobs");
  const link = page.getByTestId("job-card").getByRole("link", {name:"QA Testes SQL",exact:true});
  await link.dblclick();
  await expect(page).toHaveURL(/\/applications#/);
  const application = page.getByTestId("application-card");
  await expect(application).toHaveCount(1);
  await expect(application.getByTestId("application-status")).toHaveAttribute("data-status", "preparing");
  // Reopening the same detail is idempotent, including after a full page reload.
  await page.goto(detailUrl!);
  await expect(page).toHaveURL(/\/applications#/);
  await expect(page.getByTestId("application-card")).toHaveCount(1);
  return application;
}

test("perfil legível persiste; abrir com duplo clique prepara só uma cópia preenchida", async ({ page }) => {
  const application = await openDraft(page);
  await expect(application.getByRole("textbox",{name:"Rascunho",exact:true})).toHaveValue(/Candidato QA[\s\S]*Analista QA[\s\S]*Experiência em testes[\s\S]*QA Testes SQL/);
  await expect(application.getByLabel("Nome completo",{exact:true})).toHaveValue("Candidato QA");
  await expect(application.getByRole("textbox",{name:"Experiência profissional",exact:true})).toHaveValue(/Acme/);
  await expect(application.getByRole("textbox",{name:"Texto do currículo",exact:true})).toHaveValue(/experiência verdadeira/);
  await expect(application.getByRole("button", { name: "Continuar no site da empresa" })).toHaveCount(0);
  await page.goto("/profile");
  await expect(page.getByLabel("Habilidades",{exact:false})).toHaveValue("SQL\nTestes");
  await page.getByLabel("Nome completo",{exact:true}).fill("Nome alterado depois da preparação");
  await page.getByRole("button",{name:"Salvar perfil",exact:true}).click();
  await expect(page.getByRole("status").filter({hasText:"Perfil salvo"})).toBeVisible();
  await page.goto("/applications");
  await expect(page.getByLabel("Nome completo",{exact:true})).toHaveValue("Candidato QA");
});

test("contato, currículo, rascunho, pergunta obrigatória e evidência exigem preenchimento", async ({ page }) => {
  const application = await openDraft(page, true);
  const approve = application.getByRole("button", {name:"Salvar e aprovar rascunho",exact:true});
  const email = application.getByLabel("E-mail de contato",{exact:true});
  await email.fill(""); await approve.click();
  expect(await email.evaluate((input:HTMLInputElement) => input.validity.valueMissing)).toBe(true);
  await email.fill("qa@example.com");
  const resume = application.getByRole("textbox",{name:"Texto do currículo",exact:true});
  await application.getByRole("combobox",{name:"Escolha do currículo",exact:true}).selectOption("new");
  await approve.click();
  expect(await resume.evaluate((input:HTMLTextAreaElement) => input.validity.valueMissing)).toBe(true);
  await resume.fill("Currículo específico revisado para esta vaga");
  const draft = application.getByRole("textbox",{name:"Rascunho",exact:true});
  await draft.fill(""); await approve.click();
  expect(await draft.evaluate((input:HTMLTextAreaElement) => input.validity.valueMissing)).toBe(true);
  await draft.fill("Candidato QA — rascunho revisado para QA Testes SQL.");
  const question = application.getByLabel("Descreva um teste que você executou",{exact:false});
  await approve.click();
  expect(await question.evaluate((input:HTMLTextAreaElement) => input.validity.valueMissing)).toBe(true);
  await expect(application.getByTestId("application-status")).toHaveAttribute("data-status", "preparing");
  await question.fill("Executei um teste de regressão para validar pagamentos.");
  await approve.click();
  await expect(application.getByTestId("application-status")).toHaveAttribute("data-status", "ready");
  const evidence = application.getByLabel("Evidência do envio", {exact:false});
  const confirm = application.getByRole("button", {name:"Confirmo que enviei a candidatura",exact:true});
  await confirm.click();
  expect(await evidence.evaluate((input:HTMLTextAreaElement) => input.validity.valueMissing)).toBe(true);
  await evidence.fill("curta"); await confirm.click();
  expect(await evidence.evaluate((input:HTMLTextAreaElement) => input.validity.tooShort)).toBe(true);
  await evidence.fill("Protocolo QA-12345 recebido no site da empresa.");
  await confirm.click();
  await expect(application.getByTestId("application-status")).toHaveAttribute("data-status", "confirmed");
  await page.reload();
  await expect(page.getByTestId("application-status")).toHaveAttribute("data-status", "confirmed");
  await expect(page.getByTestId("application-card")).toContainText("QA-12345");
});

test("encaminhar e abrir site externo preserva ready sem confirmação de envio", async ({ page, context }) => {
  const application = await openDraft(page);
  await application.getByRole("button", {name:"Salvar e aprovar rascunho",exact:true}).click();
  await expect(application.getByTestId("application-status")).toHaveAttribute("data-status", "ready");
  const external = application.getByRole("button", {name:"Continuar no site da empresa",exact:true});
  const requests: string[] = [];
  await context.route(`${externalUrl}**`, async route => { requests.push(route.request().method()); await route.fulfill({status:200,contentType:"text/html; charset=utf-8",body:"<h1>Formulário externo de teste</h1>"}); });
  const popupPromise = page.waitForEvent("popup"); await external.click();
  const popup = await popupPromise;
  await expect(popup.getByRole("heading",{name:"Formulário externo de teste"})).toBeVisible();
  expect(requests).toEqual(["GET"]);
  await expect(application.getByTestId("application-forwarded")).toContainText("Aguardando conclusão externa");
  await popup.close(); await page.reload();
  await expect(page.getByTestId("application-status")).toHaveAttribute("data-status", "ready");
  await expect(page.getByTestId("application-status")).toContainText("Aguardando conclusão externa");
  await expect(page.getByText("Confirmação informada por você:",{exact:false})).toHaveCount(0);
});

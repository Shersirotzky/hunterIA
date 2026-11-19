import { test, expect } from '@playwright/test';
import { loginLinkedin } from './helpers';

test('first login, reload and recurring login keep stable account identity', async ({page,context}) => {
  const subject = `qa-${crypto.randomUUID()}`;
  await loginLinkedin(page,subject);
  await expect(page).toHaveURL(/\/profile/);
  const first = await (await page.request.get('/api/account')).json();
  expect(first.userId).toBeTruthy();
  await page.reload();
  expect(await (await page.request.get('/api/account')).json()).toMatchObject({userId:first.userId});
  await context.clearCookies();
  await loginLinkedin(page,subject);
  expect(await (await page.request.get('/api/account')).json()).toMatchObject({userId:first.userId});
});

test('cancel and expired callback show retry without authenticating', async ({page}) => {
  await page.request.post('http://127.0.0.1:4400/test/profile',{data:{cancel:true}});
  await page.goto('/signin');
  await page.getByRole('link',{name:'Continuar com LinkedIn',exact:true}).click();
  await expect(page.locator('p[role=alert]')).toContainText('cancelou');
  expect((await page.request.get('/api/account')).status()).toBe(401);
  await page.goto('/api/auth/linkedin/callback?state=invalid&code=invalid');
  await expect(page.locator('p[role=alert]')).toContainText('expirou');
});

test('password account links LinkedIn without changing the user ID', async ({page,context}) => {
  const subject=`link-${crypto.randomUUID()}`;const email=`${subject}@example.test`;
  await page.goto('/signup');
  await page.getByLabel('E-mail',{exact:true}).fill(email);
  await page.getByLabel('Senha',{exact:true}).fill('Test-password-12345!');
  await page.getByRole('button',{name:'Criar conta',exact:true}).click();
  await page.waitForURL(/\/profile/);
  const first=await(await page.request.get('/api/account')).json();
  await page.request.post('http://127.0.0.1:4400/test/profile',{data:{sub:subject,email,email_verified:true,name:'Candidato QA'}});
  await page.goto('/api/auth/linkedin?mode=connect');
  await page.waitForURL(/\/profile/);
  expect(await(await page.request.get('/api/account')).json()).toMatchObject({userId:first.userId,linkedinConnected:true});
  await context.clearCookies();
  await loginLinkedin(page,subject,email);
  expect(await(await page.request.get('/api/account')).json()).toMatchObject({userId:first.userId});
});

test('an email collision requires login to existing account', async ({page,context}) => {
  const subject=`collision-${crypto.randomUUID()}`;const email=`${subject}@example.test`;
  await page.goto('/signup');await page.getByLabel('E-mail',{exact:true}).fill(email);await page.getByLabel('Senha',{exact:true}).fill('Test-password-12345!');
  await page.getByRole('button',{name:'Criar conta',exact:true}).click();await page.waitForURL(/\/profile/);await context.clearCookies();
  await page.request.post('http://127.0.0.1:4400/test/profile',{data:{sub:subject,email,email_verified:true,name:'Candidato QA'}});
  await page.goto('/api/auth/linkedin');await expect(page.locator('p[role=alert]')).toContainText('conta existente');
  expect((await page.request.get('/api/account')).status()).toBe(401);
});

test('two browsers have isolated profiles and cannot impersonate owner IDs', async ({browser}) => {
  const a=await browser.newContext(), b=await browser.newContext();
  const pa=await a.newPage(),pb=await b.newPage();
  await loginLinkedin(pa,`isolation-a-${crypto.randomUUID()}`);
  const first=await(await pa.request.get('/api/account')).json();
  await loginLinkedin(pb,`isolation-b-${crypto.randomUUID()}`);
  const second=await(await pb.request.get('/api/account')).json();
  expect(first.userId).not.toBe(second.userId);
  const {ConvexHttpClient}=await import('convex/browser');
  const {api}=await import('../convex/_generated/api');
  const {AUTH_JWT_COOKIE}=await import('@convex-dev/auth/ssr');
  const client=new ConvexHttpClient('http://127.0.0.1:3210');
  const cookie=(await b.cookies()).find(c=>c.name===AUTH_JWT_COOKIE);
  client.setAuth(cookie!.value);
  const profile=await client.query(api.profile.get,{});
  expect(profile?.ownerUserId).toBe(second.userId);
  expect(profile?.ownerUserId).not.toBe(first.userId);
  // Convex validates extra arguments instead of trusting arbitrary browser ownership.
  await expect(client.query(api.profile.get,{ownerUserId:first.userId} as never)).rejects.toThrow();
  const anonymous=new ConvexHttpClient('http://127.0.0.1:3210');
  await expect(anonymous.query(api.profile.get,{})).rejects.toThrow();
  await a.close();await b.close();
});

test('linking a LinkedIn identity already owned by another account is refused',async({page,context})=>{
 const subject=`owned-${crypto.randomUUID()}`;
 await loginLinkedin(page,subject);
 const owner=await(await page.request.get('/api/account')).json();
 await context.clearCookies();
 const otherEmail=`other-${crypto.randomUUID()}@example.test`;
 await page.goto('/signup');await page.getByLabel('E-mail',{exact:true}).fill(otherEmail);await page.getByLabel('Senha',{exact:true}).fill('Test-password-12345!');await page.getByRole('button',{name:'Criar conta',exact:true}).click();await page.waitForURL(/\/profile/);
 const other=await(await page.request.get('/api/account')).json();expect(other.userId).not.toBe(owner.userId);
 await page.request.post('http://127.0.0.1:4400/test/profile',{data:{sub:subject,name:'Candidato QA'}});
 await page.goto('/api/auth/linkedin?mode=connect');
 await expect(page.locator('p[role=alert]')).toContainText('conta existente');
 expect(await(await page.request.get('/api/account')).json()).toMatchObject({userId:other.userId,linkedinConnected:false});
});

test('reconnecting preserves reviewed corrections and opens dashboard',async({page,context})=>{
 const subject=`reviewed-${crypto.randomUUID()}`;
 await loginLinkedin(page,subject);
 const first=await(await page.request.get('/api/account')).json();
 await page.getByLabel('Nome completo',{exact:true}).fill('Nome corrigido pelo candidato');
 await page.getByLabel('Cargos desejados',{exact:false}).fill('QA');
 await page.getByRole('textbox',{name:'Texto do currículo',exact:true}).fill('Currículo aprovado pelo candidato.');
 await page.getByRole('button',{name:'Salvar perfil',exact:true}).click();
 await expect(page.getByText('Perfil salvo. Revise e aprove abaixo.',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Revisei e aprovo este perfil',exact:true}).click();
 await expect(page).toHaveURL(/\/jobs$/);
 await context.clearCookies();
 await loginLinkedin(page,subject);
 await expect(page).toHaveURL('http://localhost:3100/');
 expect(await(await page.request.get('/api/account')).json()).toMatchObject({userId:first.userId,reviewed:true});
 await page.goto('/profile');
 await expect(page.getByLabel('Nome completo',{exact:true})).toHaveValue('Nome corrigido pelo candidato');
 await expect(page.getByRole('textbox',{name:'Texto do currículo',exact:true})).toHaveValue('Currículo aprovado pelo candidato.');
});

test('provider failure and invalid nonce never establish a Hunter session',async({page})=>{
 for(const failure of [{failToken:true},{wrongNonce:true}]){
   await page.request.post('http://127.0.0.1:4400/test/profile',{data:{sub:`failure-${crypto.randomUUID()}`,name:'Candidato QA',...failure}});
   await page.goto('/signin');await page.getByRole('link',{name:'Continuar com LinkedIn',exact:true}).click();
   await expect(page.locator('p[role=alert]')).toContainText('LinkedIn');
   expect((await page.request.get('/api/account')).status()).toBe(401);
   await expect(page.getByRole('link',{name:'Continuar com LinkedIn',exact:true})).toBeVisible();
 }
});

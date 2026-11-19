import type { Page } from '@playwright/test';
export async function loginLinkedin(page: Page, subject: string, email = `${subject}@example.test`) {
  await page.request.post('http://127.0.0.1:4400/test/profile', { data: { sub: subject, email, email_verified: true, name: 'Candidato QA' } });
  await page.goto('/signin');
  await page.getByRole('link', {name:'Continuar com LinkedIn',exact:true}).click();
  await page.waitForURL(/\/(profile|$)/);
}

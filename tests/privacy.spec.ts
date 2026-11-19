import { test, expect } from '@playwright/test';
import { loginLinkedin } from './helpers';
test('PWA não conserva páginas pessoais para acesso offline',async({page,context})=>{
 await loginLinkedin(page,`offline-${crypto.randomUUID()}`);
 await page.evaluate(async()=>{ await navigator.serviceWorker.ready; });
 await page.reload();
 const cached=await page.evaluate(async()=>{
   const keys=await caches.keys();const urls:string[]=[];
   for(const key of keys.filter(key=>key.startsWith('hunter-ia-'))){const cache=await caches.open(key);urls.push(...(await cache.keys()).map(request=>new URL(request.url).pathname));}
   return urls;
 });
 expect(cached).toContain('/offline.html');expect(cached).not.toContain('/');expect(cached).not.toContain('/profile');
 await context.setOffline(true);
 await page.goto('/profile');
 await expect(page.getByRole('heading',{name:'Você está sem conexão'})).toBeVisible();
 await expect(page.getByText('Candidato QA',{exact:true})).toHaveCount(0);
 await context.setOffline(false);
});

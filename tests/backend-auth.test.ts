import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SignJWT } from 'jose';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../convex/_generated/api';
const client=new ConvexHttpClient('http://127.0.0.1:3210');
const secret='hunter-local-test-only-0000000000000000000000000000000000000000';
test('one-use login assertion cannot be replayed or forged',async()=>{
 const assertion=await new SignJWT({identity:{sub:`replay-${crypto.randomUUID()}`}}).setProtectedHeader({alg:'HS256'}).setIssuer('hunter-linkedin-callback').setAudience('hunter-convex').setJti(crypto.randomUUID()).setIssuedAt().setExpirationTime('60s').sign(new TextEncoder().encode(secret));
 const first=await client.mutation(api.auth.signInWithLinkedin,{assertion});
 assert.equal(first.status,'complete');
 await assert.rejects(client.mutation(api.auth.signInWithLinkedin,{assertion}));
 await assert.rejects(client.mutation(api.auth.signInWithLinkedin,{assertion:assertion.slice(0,-5)+'aaaaa'}));
});

test('concurrent preparation and confirmation are idempotent; another account cannot access the application',async()=>{
 const {execFileSync}=await import('node:child_process');
 const {readFileSync}=await import('node:fs');
 assert.match(readFileSync('.env.local','utf8'),/^CONVEX_DEPLOYMENT=local:/m);
 assert.equal(process.env.CONVEX_DEPLOY_KEY,undefined);
 const signIn=async()=>{
  const assertion=await new SignJWT({identity:{sub:`concurrency-${crypto.randomUUID()}`}}).setProtectedHeader({alg:'HS256'}).setIssuer('hunter-linkedin-callback').setAudience('hunter-convex').setJti(crypto.randomUUID()).setIssuedAt().setExpirationTime('60s').sign(new TextEncoder().encode(secret));
  const result=await client.mutation(api.auth.signInWithLinkedin,{assertion});
  const authenticated=new ConvexHttpClient('http://127.0.0.1:3210');authenticated.setAuth(result.tokens.accessToken);
  return authenticated;
 };
 const a=await signIn(),b=await signIn();
 const owner=await a.query(api.identity.current,{});
 await a.mutation(api.profile.save,{fullName:'Candidato QA',email:'qa@example.test',resumeText:'Currículo verdadeiro revisado.',targetRolesJson:'["QA"]',skillsJson:'["SQL"]',locationsJson:'[]',workHistoryJson:'[]',educationJson:'[]',languagesJson:'[]',workModesJson:'[]',salaryJson:'{}',preferredIndustriesJson:'[]',excludedIndustriesJson:'[]',standardAnswersJson:'{}'});
 await a.mutation(api.profile.approve,{});
 execFileSync(process.execPath,['node_modules/convex/bin/main.js','run','--deployment','local','jobs:ingest',JSON.stringify({owner:owner.userId,board:'backend-test',jobs:[{sourceId:crypto.randomUUID(),title:'QA SQL',canonicalUrl:'https://example.com/local-backend-test',location:'',description:'SQL',questionsJson:'[]',questionsStatus:'available'}]})],{stdio:'pipe'});
 const job=(await a.query(api.jobs.list,{}))[0];
 const ids=await Promise.all([a.mutation(api.jobs.prepare,{jobId:job._id}),a.mutation(api.jobs.prepare,{jobId:job._id})]);
 assert.equal(ids[0],ids[1]);assert.equal((await a.query(api.jobs.applications,{})).length,1);
 assert.equal(await b.query(api.jobs.detail,{jobId:job._id}),null);
 await assert.rejects(b.mutation(api.jobs.prepare,{jobId:job._id}));
 await assert.rejects(b.mutation(api.jobs.updateApplication,{id:ids[0],event:'review',draft:'Tentativa não autorizada'}));
 assert.deepEqual(await b.query(api.jobs.applications,{}),[]);
 await a.mutation(api.jobs.updateApplication,{id:ids[0],event:'review',draft:'Texto revisado verdadeiro.'});
 const confirm={id:ids[0],event:'confirm' as const,evidence:'Protocolo de teste local QA-12345.'};
 await Promise.all([a.mutation(api.jobs.updateApplication,confirm),a.mutation(api.jobs.updateApplication,confirm)]);
 const rows=await a.query(api.jobs.applications,{});assert.equal(rows.length,1);assert.equal(rows[0].status,'confirmed');assert.equal(rows[0].confirmationEvidence,confirm.evidence);
});

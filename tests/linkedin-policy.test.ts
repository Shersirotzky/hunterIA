import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SignJWT } from 'jose';
import { verifyLinkedinAssertion } from '../convex/linkedinPolicy';
const secret='policy-test-only-000000000000000000000000000000000';
async function issue(expires='60s',aud='hunter-convex') {return new SignJWT({identity:{sub:'qa'},linking:false}).setProtectedHeader({alg:'HS256'}).setIssuer('hunter-linkedin-callback').setAudience(aud).setJti('test-receipt').setIssuedAt().setExpirationTime(expires).sign(new TextEncoder().encode(secret));}
test('assertion rejects forged, expired and wrong-audience claims',async()=>{
 assert.equal((await verifyLinkedinAssertion(await issue(),secret)).identity.sub,'qa');
 await assert.rejects(verifyLinkedinAssertion(await issue('-1s'),secret));
 await assert.rejects(verifyLinkedinAssertion(await issue('60s','other'),secret));
 await assert.rejects(verifyLinkedinAssertion(await issue(),secret+'wrong'));
});

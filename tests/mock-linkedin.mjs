import http from 'node:http';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';
const { privateKey, publicKey } = await generateKeyPair('RS256');
const jwk = { ...await exportJWK(publicKey), kid: 'hunter-test-key', alg: 'RS256', use: 'sig' };
let profile = { sub: 'qa-default', name: 'Candidato QA', email: 'qa@example.test', email_verified: true };
const codes = new Map();
const tokens = new Map();
const server = http.createServer(async (req,res) => {
  const url = new URL(req.url, 'http://127.0.0.1:4400');
  const json = value => { res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(value)); };
  if (url.pathname === '/test/profile' && req.method === 'POST') {
    let body = ''; for await (const chunk of req) body += chunk;
    profile = JSON.parse(body); return json({ok:true});
  }
  if (url.pathname === '/health') return json({ok:true});
  if (url.pathname === '/jwks') return json({keys:[jwk]});
  if (url.pathname === '/authorize') {
    const redirect = new URL(url.searchParams.get('redirect_uri'));
    redirect.searchParams.set('state',url.searchParams.get('state'));
    if (profile.cancel) redirect.searchParams.set('error','access_denied');
    else {
      const code = crypto.randomUUID();
      codes.set(code,{profile:{...profile},nonce:url.searchParams.get('nonce')});
      redirect.searchParams.set('code',code);
    }
    res.writeHead(302,{Location:redirect.toString()}); return res.end();
  }
  if (url.pathname === '/token') {
    let body=''; for await (const chunk of req) body += chunk;
    const code = new URLSearchParams(body).get('code'); const grant=codes.get(code); codes.delete(code);
    if (!grant) {res.statusCode=400;return json({error:'invalid_grant'});}
    if(grant.profile.failToken){res.statusCode=503;return json({error:'temporarily_unavailable'});}
    const access = crypto.randomUUID(); tokens.set(access,grant.profile);
    const id_token = await new SignJWT({nonce:grant.profile.wrongNonce ? "incorrect-nonce" : grant.nonce}).setProtectedHeader({alg:'RS256',kid:'hunter-test-key'}).setIssuer('http://127.0.0.1:4400').setAudience('hunter-test-client').setSubject(grant.profile.sub).setIssuedAt().setExpirationTime('5m').sign(privateKey);
    return json({access_token:access,id_token});
  }
  if(url.pathname==='/userinfo') {
    const value=tokens.get(req.headers.authorization?.replace('Bearer ',''));
    if(!value){res.statusCode=401;return json({error:'unauthorized'});} return json(value);
  }
  res.statusCode=404;json({error:'not_found'});
});
server.listen(4400,'127.0.0.1');

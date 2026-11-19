import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
export default function setup() {
  const config = readFileSync('.env.local','utf8');
  if (!/^CONVEX_DEPLOYMENT=local:/m.test(config)) throw new Error('Testes simulados exigem deployment Convex LOCAL. Nenhum teste será executado em produção.');
  execFileSync('npx',['convex','env','set','--deployment','local','LINKEDIN_BRIDGE_SECRET','hunter-local-test-only-0000000000000000000000000000000000000000'],{stdio:'pipe'});
}

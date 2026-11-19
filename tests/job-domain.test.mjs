import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = ts.transpileModule(readFileSync(new URL('../convex/jobDomain.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { rank, terms, safeUrl, boardSlug, transition, readSnapshot, missingFields, reviewSnapshot, recommended, greenhouseQuestions, prefillQuestions } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const profile = { targetRolesJson: '["QA"]', skillsJson: '["SQL","Testes"]', locationsJson: '["Fortaleza"]' };
test('ranking determinístico, com evidências e pesos documentados', () => {
  const job = { title: 'QA', description: 'SQL', location: 'Fortaleza' };
  assert.deepEqual(rank(profile, job), rank(profile, job));
  assert.equal(rank(profile, job).score, 58);
  assert.equal(rank(profile, job).reasons.length, 3);
  assert.equal(rank(profile, { title: 'Designer' }).score, 0);
});
test('normalização, campos ausentes e duplicatas não elevam score', () => {
  assert.equal(rank({ targetRolesJson: '["Analista"]', skillsJson: '["SQL","sql"]', locationsJson: '[]' }, { title: 'ANÁLISTA SQL' }).score, 60);
  assert.deepEqual(terms('{"listed":[]}'), []);
  assert.deepEqual(terms('invalid'), []);
});
test('URLs e board restringem destino e construção do endpoint', () => {
  assert.throws(() => safeUrl('javascript:alert(1)'));
  assert.throws(() => safeUrl('https://user:pass@example.com'));
  assert.throws(() => boardSlug('../other?x=y'));
  assert.equal(boardSlug('empresa-qa'), 'empresa-qa');
});
test('encaminhamento nunca marca envio; exige revisão e confirmação com evidência', () => {
  assert.throws(() => transition('preparing', 'forward', false));
  assert.throws(() => transition('preparing', 'confirm', false, 'comprovante válido'));
  assert.equal(transition('preparing', 'review', false), 'ready');
  assert.equal(transition('ready', 'forward', true), 'ready');
  assert.throws(() => transition('ready', 'confirm', true, ''));
  assert.equal(transition('ready', 'confirm', true, 'Protocolo ABC123'), 'confirmed');
  assert.throws(() => transition('confirmed', 'review', true));
});

test('ranking distingue desconhecido de ausência de correspondência', () => {
  const result = rank(profile, { title: 'Designer' });
  assert.equal(result.criteria.find(x => x.label === 'Cargo').state, 'not_matched');
  assert.equal(result.criteria.find(x => x.label === 'Local').state, 'unknown');
  assert.equal(result.criteria.find(x => x.label === 'Habilidades').state, 'unknown');
  assert.equal(rank({...profile, locationsJson:'[]'}, {title:'QA',location:'Fortaleza'}).criteria.find(x => x.label === 'Local').state, 'unknown');
});
test('snapshot revisado exige contato e currículo e preserva cópia original', () => {
  const original = readSnapshot(JSON.stringify({fullName:'Candidato',email:'qa@example.com',capturedAt:123,profileUpdatedAt:100}));
  assert.deepEqual(missingFields(original), ['Texto do currículo']);
  assert.throws(() => reviewSnapshot(original, {resumeText:'  '}), /Texto do currículo/);
  assert.throws(() => reviewSnapshot(original, {resumeText:'Currículo',email:'invalido'}), /E-mail válido/);
  const reviewed = reviewSnapshot(original, {resumeText:'Currículo verdadeiro',capturedAt:999});
  assert.equal(reviewed.capturedAt,123);
  assert.equal(original.resumeText,'');
  assert.equal(reviewed.resumeText,'Currículo verdadeiro');
});

test('denominador fixo mantém desconhecidos sem pontos e cobertura separada', () => {
  const result=rank(profile,{title:'QA SQL Testes',description:'SQL Testes',location:'Fortaleza'});
  assert.equal(result.score,70); assert.equal(result.knownWeight,70);
  assert.equal(result.criteria.find(x=>x.label==='Senioridade').state,'unknown');
  const complete=rank({...profile,seniority:'Sênior',yearsExperience:5,workModesJson:'["Remoto"]',languagesJson:'["Inglês: avançado"]'},{title:'QA SQL Testes',description:'SQL Testes',location:'Fortaleza',seniority:'Senior',workMode:'Remote',languagesJson:'[{"name":"English","level":"Advanced"}]',minimumYearsExperience:3});
  assert.equal(complete.score,100); assert.equal(complete.knownWeight,100);
  assert.equal(complete.criteria.find(x=>x.label==='Experiência').state,'matched');
  const mismatch=rank({...profile,seniority:'Júnior',yearsExperience:1,workModesJson:'["Presencial"]',languagesJson:'["Inglês: básico"]'},{title:'QA',description:'SQL Testes',location:'Fortaleza',seniority:'Senior',workMode:'Remote',languagesJson:'["English: advanced"]',minimumYearsExperience:3});
  assert.equal(mismatch.score,70);
  for(const label of ['Senioridade','Experiência','Modalidade','Idiomas']) assert.equal(mismatch.criteria.find(x=>x.label===label).state,'not_matched');
});
test('corte 85 exclui vagas baixas e fechadas e pode produzir lista vazia', () => {
  assert.deepEqual(recommended([{status:'open',match:{score:84}},{status:'closed',match:{score:100}}]),[]);
  assert.equal(recommended([{status:'open',match:{score:85}}]).length,1);
});
test('perguntas públicas obrigatórias, prefill aprovado e sensíveis sem inferência', () => {
  const questions=greenhouseQuestions([
    {label:'Email',required:true,fields:[{name:'email',type:'input_text'}]},
    {label:'Gender',required:true,fields:[{name:'gender',type:'input_text'}]},
    {label:'Descreva um teste',required:true,fields:[{name:'question_qa',type:'textarea'}]},
  ]);
  const snapshot=readSnapshot(JSON.stringify({fullName:'Candidato QA',email:'qa@example.com',resumeText:'Currículo revisado',questionsJson:JSON.stringify(questions)}));
  snapshot.responsesJson=JSON.stringify(prefillQuestions(questions,snapshot,'{"Gender":"Não inferir","Descreva um teste":"Regressão"}'));
  const responses=JSON.parse(snapshot.responsesJson);
  assert.equal(responses['0:email'],'qa@example.com'); assert.equal(responses['1:gender'],undefined);
  assert.equal(responses['2:question_qa'],'Regressão');
  assert.deepEqual(missingFields(snapshot),['Gender']);
  assert.throws(()=>reviewSnapshot(snapshot,{}),/Gender/);
  assert.deepEqual(missingFields({...snapshot,responsesJson:JSON.stringify({...responses,'1:gender':'Resposta manual'})}),[]);
});

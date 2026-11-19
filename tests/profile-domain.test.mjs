import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = ts.transpileModule(readFileSync(new URL('../convex/profileDomain.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { readableJson, editedJson, importedContact, parseStandardAnswers, readableAnswersJson, editedAnswersJson } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
test('edição legível preserva dados estruturados sem alterações', () => {
  const raw = '[ { "company": "Acme", "title": "QA", "dates": { "from": 2020 }, "extra": ["um", "dois"] } ]';
  const displayed = readableJson(raw);
  assert.match(displayed, /Empresa: Acme/);
  assert.equal(editedJson(raw, displayed), raw);
});
test('listas são editadas com nomes sem exigir JSON', () => {
  assert.equal(editedJson('[]', 'SQL, QA\nTestes', true), '["SQL","QA","Testes"]');
  assert.equal(editedJson('{}', ''), '{}');
});
test('importação só sugere email presente no texto', () => {
  assert.deepEqual(importedContact('QA\nContato: candidato@example.com'), {email:'candidato@example.com'});
  assert.deepEqual(importedContact('Currículo sem contato'), {email:''});
});

test('respostas manuais são pares reutilizáveis e preservam originais intactos', () => {
  const raw='[ {"question":"Disponibilidade","answer":"30 dias","extra":"preservar"} ]';
  const display=readableAnswersJson(raw);
  assert.equal(display,'Disponibilidade: 30 dias');
  assert.equal(editedAnswersJson(raw,display),raw);
  assert.deepEqual(JSON.parse(editedAnswersJson(raw,'Disponibilidade: Imediata')), [{question:'Disponibilidade',answer:'Imediata'}]);
  assert.deepEqual(parseStandardAnswers('Site: https://example.com'),[{question:'Site',answer:'https://example.com'}]);
  assert.throws(()=>parseStandardAnswers('Sem separador'),/Pergunta: resposta/);
  assert.throws(()=>parseStandardAnswers('Pergunta:'),/Pergunta: resposta/);
  assert.throws(()=>parseStandardAnswers('Disponibilidade: 30 dias\ndisponibilidade: Imediata'),/duplicada/);
});

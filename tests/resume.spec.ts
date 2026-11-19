import { test, expect } from '@playwright/test';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { zipSync, strToU8 } from 'fflate';
import { loginLinkedin } from './helpers';

test('PDF e DOCX reais são extraídos; original fica privado entre contas', async ({browser}) => {
  const a=await browser.newContext(), b=await browser.newContext();
  const pa=await a.newPage(),pb=await b.newPage();
  await loginLinkedin(pa,`resume-a-${crypto.randomUUID()}`);
  const pdf=await PDFDocument.create();
  const font=await pdf.embedFont(StandardFonts.Helvetica);
  pdf.addPage().drawText('Candidato QA - Testes de software e SQL',{font,size:12});
  const bytes=Buffer.from(await pdf.save());
  const uploaded=await pa.request.post('/api/resume',{multipart:{file:{name:'curriculo.pdf',mimeType:'application/pdf',buffer:bytes}}});
  expect(uploaded.status()).toBe(200);
  const data=await uploaded.json();expect(data.text).toContain('Testes de software');
  expect(data.proof).toBeUndefined();
  const original=await pa.request.get(data.downloadUrl);expect(original.status()).toBe(200);
  expect(await original.body()).toEqual(bytes);
  expect(original.headers()['cache-control']).toContain('no-store');
  await loginLinkedin(pb,`resume-b-${crypto.randomUUID()}`);
  expect((await pb.request.get(data.downloadUrl)).status()).toBe(404);
  const {ConvexHttpClient}=await import('convex/browser');
  const {api}=await import('../convex/_generated/api');
  const {AUTH_JWT_COOKIE}=await import('@convex-dev/auth/ssr');
  const client=new ConvexHttpClient('http://127.0.0.1:3210');
  client.setAuth((await b.cookies()).find(c=>c.name===AUTH_JWT_COOKIE)!.value);
  expect(await client.action(api.resumes.download,{documentId:data.documentId})).toBeNull();
  await expect(client.action(api.resumes.upload,{bytes:bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),fileName:'curriculo.pdf',mediaType:'application/pdf',proof:'forged'})).rejects.toThrow();
  const docx=zipSync({
    '[Content_Types].xml':strToU8('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'),
    '_rels/.rels':strToU8('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'),
    'word/document.xml':strToU8('<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Candidato QA - Automacao de testes</w:t></w:r></w:p></w:body></w:document>'),
  });
  const word=await pa.request.post('/api/resume',{multipart:{file:{name:'curriculo.docx',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',buffer:Buffer.from(docx)}}});
  expect(word.status()).toBe(200);expect((await word.json()).text).toContain('Automacao de testes');
  await a.clearCookies();expect((await pa.request.get(data.downloadUrl)).status()).toBe(401);
  await a.close();await b.close();
});

test('arquivo malformado é recusado e upload exige autenticação',async({page})=>{
  const form={file:{name:'fake.pdf',mimeType:'application/pdf',buffer:Buffer.from('conteudo sem PDF')}};
  expect((await page.request.post('/api/resume',{multipart:form})).status()).toBe(401);
  await loginLinkedin(page,`resume-invalid-${crypto.randomUUID()}`);
  expect((await page.request.post('/api/resume',{multipart:form})).status()).toBe(422);
});

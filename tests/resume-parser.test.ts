import { test } from "node:test";
import assert from "node:assert/strict";
import { zipSync, strToU8 } from "fflate";
import { PDFDocument, PDFName, PDFHexString, PDFString, StandardFonts } from "pdf-lib";
import { parseResume, MAX_RESUME_BYTES } from "../lib/resume-parser";

const DOCX_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
function docx(extra: Record<string, Uint8Array> = {}) {
  return zipSync({
    "[Content_Types].xml": strToU8('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'),
    "_rels/.rels": strToU8('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'),
    "word/document.xml": strToU8('<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Ana Silva — Engenharia</w:t></w:r></w:p></w:body></w:document>'),
    ...extra,
  });
}
test("TXT UTF-8 preserves text, normalizes lines, hashes original and sanitizes name", async () => {
  const result = await parseResume(Buffer.from("Ana\r\nEngenharia"), "../currículo.txt", "text/plain");
  assert.equal(result.text, "Ana\nEngenharia"); assert.equal(result.fileName, "currículo.txt"); assert.match(result.sha256, /^[a-f0-9]{64}$/);
});
test("rejects oversize, empty, type mismatch, binary and forged PDF", async () => {
  for (const [bytes, name, type] of [[Buffer.alloc(MAX_RESUME_BYTES + 1), "a.txt", "text/plain"], [Buffer.alloc(0), "a.txt", "text/plain"], [Buffer.from("hello"), "a.pdf", "text/plain"], [Buffer.from([0, 1, 2]), "a.txt", "text/plain"], [Buffer.from("%PDF-1.7\nforged\n%%EOF"), "a.pdf", "application/pdf"], [Buffer.from("PK"), "a.docx", DOCX_TYPE]] as const) {
    await assert.rejects(parseResume(bytes, name, type));
  }
});
test("extracts valid DOCX without executing or interpreting content", async () => {
  const result = await parseResume(docx(), "resume.docx", DOCX_TYPE);
  assert.equal(result.text, "Ana Silva — Engenharia");
});
test("blocks DOCX macros, entities, OLE, external templates and CRC corruption", async () => {
  const variants = [docx({ "word/vbaProject.bin": strToU8("macro") }), docx({ "word/activeX/x.xml": strToU8("<x/>") }), docx({ "word/document.xml": strToU8('<!DOCTYPE x [<!ENTITY payload "evil">]><x>&payload;</x>') }), docx({ "word/document.xml": strToU8('<document><oleObject/></document>') }), docx({ "word/_rels/document.xml.rels": strToU8('<Relationships><Relationship Type="attachedTemplate" TargetMode="External" Target="https://evil.invalid"/></Relationships>') })];
  const corrupt = Buffer.from(docx()); const central = corrupt.indexOf(Buffer.from([0x50,0x4b,0x01,0x02])); corrupt[central + 16] ^= 1; variants.push(corrupt);
  for (const bytes of variants) await assert.rejects(parseResume(bytes, "resume.docx", DOCX_TYPE));
});
test("rejects ZIP bomb before decompression and arbitrary ZIP renamed DOCX", async () => {
  await assert.rejects(parseResume(zipSync({ "hello.txt": strToU8("hello") }), "a.docx", DOCX_TYPE));
  const bomb = Buffer.from(docx()); const central = bomb.indexOf(Buffer.from([0x50,0x4b,0x01,0x02])); bomb.writeUInt32LE(0x70000000, central + 24);
  await assert.rejects(parseResume(bomb, "a.docx", DOCX_TYPE), /20 MB/);
});
test("extracts PDF text and rejects parsed active actions and unsafe URI schemes", async () => {
  const pdf = await PDFDocument.create(); const page = pdf.addPage(); const font = await pdf.embedFont(StandardFonts.Helvetica); page.drawText("Ana Silva Engineering", { font });
  const result = await parseResume(await pdf.save(), "resume.pdf", "application/pdf"); assert.match(result.text, /Ana Silva Engineering/);
  pdf.catalog.set(PDFName.of("OpenAction"), pdf.context.obj({ S: PDFName.of("JavaScript"), JS: PDFHexString.fromText("app.alert('x')") }));
  await assert.rejects(parseResume(await pdf.save(), "resume.pdf", "application/pdf"), /ativo|ações/);
  pdf.catalog.delete(PDFName.of("OpenAction"));
  pdf.catalog.set(PDFName.of("UnsafeLink"), pdf.context.obj({ S: PDFName.of("URI"), URI: PDFString.of("javascript:alert(1)") }));
  await assert.rejects(parseResume(await pdf.save(), "resume.pdf", "application/pdf"), /inseguro/);
});
test("empty scanned PDF returns manual completion warning", async () => {
  const pdf = await PDFDocument.create(); pdf.addPage();
  const result = await parseResume(await pdf.save(), "scanned.pdf", "application/pdf");
  assert.equal(result.text, ""); assert.equal(result.warnings.length, 1);
});

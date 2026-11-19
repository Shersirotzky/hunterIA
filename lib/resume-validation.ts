import { createHash } from "node:crypto";
import { inflateRawSync } from "node:zlib";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import { PDFDocument, PDFDict, PDFArray, PDFName, PDFStream, PDFString, PDFHexString } from "pdf-lib";

export const MAX_RESUME_BYTES = 5 * 1024 * 1024;
export const MAX_RESUME_TEXT = 100_000;
const MAX_EXPANDED = 20 * 1024 * 1024;
const MIME = { pdf: "application/pdf", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", txt: "text/plain" } as const;
export class ResumeError extends Error {}
const fail = (message: string): never => { throw new ResumeError(message); };

export function safeResumeName(name: string) {
  return name.split(/[\\/]/).pop()!.replace(/[\x00-\x1f\x7f]/g, "").slice(0, 180);
}
function crc32(bytes: Uint8Array) {
  let crc = -1;
  for (const byte of bytes) { crc ^= byte; for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); }
  return (crc ^ -1) >>> 0;
}
function docxEntries(buffer: Buffer) {
  // Validate the central directory before allocating any uncompressed data.
  let end = buffer.length - 22;
  while (end >= Math.max(0, buffer.length - 65557) && buffer.readUInt32LE(end) !== 0x06054b50) end--;
  if (end < 0 || end < buffer.length - 65557 || end + 22 + buffer.readUInt16LE(end + 20) !== buffer.length) fail("DOCX ZIP incompleto.");
  const count = buffer.readUInt16LE(end + 10);
  const directorySize = buffer.readUInt32LE(end + 12);
  let offset = buffer.readUInt32LE(end + 16);
  if (!count || count > 1000 || buffer.readUInt16LE(end + 4) || buffer.readUInt16LE(end + 6) || buffer.readUInt16LE(end + 8) !== count || offset + directorySize !== end) fail("ZIP não suportado.");
  const checks = new Map<string, { crc: number; size: number; start: number; compressed: number; method: number }>();
  let total = 0;
  for (let i = 0; i < count; i++) {
    if (offset + 46 > end || buffer.readUInt32LE(offset) !== 0x02014b50) fail("Diretório ZIP inválido.");
    const flags = buffer.readUInt16LE(offset + 8), method = buffer.readUInt16LE(offset + 10);
    const size = buffer.readUInt32LE(offset + 24), compressed = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28), extra = buffer.readUInt16LE(offset + 30), comment = buffer.readUInt16LE(offset + 32);
    const local = buffer.readUInt32LE(offset + 42);
    const name = buffer.subarray(offset + 46, offset + 46 + nameLength).toString("utf8");
    total += size;
    if (flags & 0x41 || ![0, 8].includes(method) || size > MAX_EXPANDED || total > MAX_EXPANDED || checks.has(name) || !name || /[\\\x00]/.test(name) || name.startsWith("/") || name.split("/").includes("..")) fail("ZIP inseguro ou descompactado acima de 20 MB.");
    if (local + 30 > offset || buffer.readUInt32LE(local) !== 0x04034b50 || buffer.readUInt16LE(local + 6) !== flags || buffer.readUInt16LE(local + 8) !== method) fail("Cabeçalho ZIP inconsistente.");
    const localName = buffer.readUInt16LE(local + 26), localExtra = buffer.readUInt16LE(local + 28);
    if (buffer.subarray(local + 30, local + 30 + localName).toString("utf8") !== name || local + 30 + localName + localExtra + compressed > buffer.readUInt32LE(end + 16)) fail("Entrada ZIP inválida.");
    checks.set(name, { crc: buffer.readUInt32LE(offset + 16), size, start: local + 30 + localName + localExtra, compressed, method });
    offset += 46 + nameLength + extra + comment;
  }
  if (offset !== end) fail("Diretório ZIP inconsistente.");
  const entries: Record<string, Uint8Array> = Object.create(null);
  for (const [name, entry] of checks) {
    const compressed = buffer.subarray(entry.start, entry.start + entry.compressed);
    // A false size in ZIP headers must not turn into an unbounded allocation.
    entries[name] = entry.method === 0 ? compressed : inflateRawSync(compressed, { maxOutputLength: entry.size + 1 });
  }
  for (const [name, bytes] of Object.entries(entries)) {
    const expected = checks.get(name);
    if (!expected || bytes.length !== expected.size || crc32(bytes) !== expected.crc) fail("Integridade CRC do DOCX inválida.");
    const lower = name.toLowerCase();
    if (/vba|activex|embeddings|customui|\.bin$|\.exe$|\.js$|\.vbs$|\.html?$|\.svg$/.test(lower)) fail("DOCX contém conteúdo ativo ou incorporado.");
    if (!name.endsWith("/") && !/\.(xml|rels|png|jpe?g|gif|bmp|tiff?|odttf)$/i.test(name)) fail("DOCX contém um tipo de entrada não permitido.");
    if (/\.(xml|rels)$/i.test(name)) {
      const xml = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      if (/<!\s*(DOCTYPE|ENTITY)/i.test(xml) || XMLValidator.validate(xml) !== true) fail("XML inválido ou inseguro no DOCX.");
      const parsed: unknown = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true }).parse(xml);
      const walk = (node: unknown): void => {
        if (!node || typeof node !== "object") return;
        for (const [key, value] of Object.entries(node)) {
          if (/^(altChunk|object|oleObject|control|attachedTemplate)$/i.test(key)) fail("DOCX contém conteúdo ativo.");
          if (key === "@_ContentType" && /macroEnabled|vba|oleObject|activeX/i.test(String(value))) fail("DOCX contém macros ou objetos ativos.");
          if (key === "@_Type" && /oleObject|\/package$|attachedTemplate|activeX|aFChunk|externalLink/i.test(String(value))) fail("Relacionamento DOCX ativo bloqueado.");
          if (key === "@_TargetMode" && String(value).toLowerCase() === "external") {
            const record = node as Record<string, unknown>;
            if (!String(record["@_Type"]).endsWith("/hyperlink") || !/^(https?:|mailto:)/i.test(String(record["@_Target"]))) fail("Referência externa DOCX bloqueada.");
          }
          walk(value);
        }
      };
      walk(parsed);
    }
  }
  if (!entries["[Content_Types].xml"] || !entries["word/document.xml"] || !entries["_rels/.rels"]) fail("Arquivo não é um DOCX válido.");
  const types = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true }).parse(entries["[Content_Types].xml"]);
  const overrides = types.Types?.Override;
  if (!(Array.isArray(overrides) ? overrides : [overrides]).some(entry => entry?.["@_PartName"] === "/word/document.xml" && entry?.["@_ContentType"] === "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml")) fail("Tipo do documento DOCX inválido.");
  return entries;
}
async function validatePdf(buffer: Buffer) {
  if (!/^%PDF-1\.[0-9]/.test(buffer.subarray(0, 8).toString()) && !buffer.subarray(0, 8).equals(Buffer.from("%PDF-2.0"))) fail("Assinatura PDF inválida.");
  if (!/%%EOF\s*$/.test(buffer.subarray(-1024).toString("latin1"))) fail("PDF incompleto.");
  const document = await PDFDocument.load(buffer, { updateMetadata: false, throwOnInvalidObject: true });
  if (document.isEncrypted || document.getPageCount() > 100) fail("PDF protegido ou com mais de 100 páginas.");
  const visited = new Set<object>();
  const walk = (value: unknown): void => {
    if (!value || typeof value !== "object" || visited.has(value)) return;
    visited.add(value);
    if (value instanceof PDFStream) walk(value.dict);
    if (value instanceof PDFDict) for (const [key, item] of value.entries()) {
      const name = key.decodeText();
      if (/^(JavaScript|JS|AA|OpenAction|Launch|EmbeddedFiles?|EF|RichMedia|XFA|AcroForm|SubmitForm|ImportData|GoToR|GoToE|Rendition|RichMediaContent|RichMediaSettings|3DD|3DA|Movie|Sound)$/i.test(name)) fail("PDF contém ações, formulários ou anexos ativos.");
      if (name === "S" && item instanceof PDFName && /^(JavaScript|Launch|SubmitForm|ImportData|GoToR|GoToE|Rendition|Movie|Sound)$/i.test(item.decodeText())) fail("PDF contém ação ativa.");
      if ((name === "Subtype" && item instanceof PDFName && /^(RichMedia|Movie|Sound|Screen|FileAttachment|3D|Widget)$/i.test(item.decodeText())) || (name === "Type" && item instanceof PDFName && item.decodeText() === "Filespec")) fail("PDF contém mídia ou anexo ativo.");
      if (name === "URI") {
        const target = document.context.lookup(item);
        if (!(target instanceof PDFString || target instanceof PDFHexString) || !/^(https?:|mailto:)/i.test(target.decodeText()) || /[\x00-\x20]/.test(target.decodeText())) fail("PDF contém link ativo ou inseguro.");
      }
      walk(item);
    }
    if (value instanceof PDFArray) for (let i = 0; i < value.size(); i++) walk(value.get(i));
  };
  for (const [, object] of document.context.enumerateIndirectObjects()) walk(object);
}

export async function validateResume(input: Uint8Array, originalName: string, declaredType: string) {
  if (!input.byteLength || input.byteLength > MAX_RESUME_BYTES) fail("Envie um arquivo de até 5 MB, não vazio.");
  const fileName = safeResumeName(originalName);
  const extension = fileName.split(".").pop()?.toLowerCase();
  if (extension !== "pdf" && extension !== "docx" && extension !== "txt") fail("Use PDF, DOCX ou TXT.");
  const mediaType = MIME[extension as keyof typeof MIME];
  if (declaredType && declaredType !== "application/octet-stream" && declaredType.split(";")[0].trim().toLowerCase() !== mediaType) fail("Tipo informado não corresponde à extensão.");
  const buffer = Buffer.from(input);
  let text: string;
  try {
    if (extension === "pdf") { await validatePdf(buffer); text = ""; }
    else if (extension === "docx") {
      if (buffer.readUInt32LE(0) !== 0x04034b50) fail("Assinatura DOCX inválida.");
      docxEntries(buffer);
      text = "";
    } else {
      text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
      if (/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(text) || /^\s*(%PDF|PK\x03\x04|<(!doctype|html|script))/i.test(text)) fail("TXT deve conter apenas texto UTF-8.");
    }
  } catch (error) {
    if (error instanceof ResumeError) throw error;
    fail("Arquivo inválido, corrompido, protegido ou não suportado.");
  }
  text = text!.replace(/\r\n?/g, "\n").replace(/\u0000/g, "").trim();
  if (text.length > MAX_RESUME_TEXT) fail("Texto excede 100 mil caracteres.");
  return { fileName, mediaType, size: input.byteLength, sha256: createHash("sha256").update(buffer).digest("hex") };
}

import mammoth from "mammoth";
import { validateResume, ResumeError, MAX_RESUME_TEXT } from "./resume-validation";
export { MAX_RESUME_BYTES, MAX_RESUME_TEXT, ResumeError } from "./resume-validation";

export async function parseResume(input: Uint8Array, originalName: string, declaredType: string) {
  const metadata = await validateResume(input, originalName, declaredType);
  let text: string;
  try {
    if (metadata.mediaType === "application/pdf") {
      const { getData } = await import("pdf-parse/worker");
      const { PDFParse } = await import("pdf-parse");
      // Embedded worker survives server bundling; no CDN or external network access.
      PDFParse.setWorker(getData());
      const parser = new PDFParse({ data: new Uint8Array(input), isEvalSupported: false, useSystemFonts: false });
      try { text = (await parser.getText({ pageJoiner: "" })).text; } finally { await parser.destroy(); }
    } else if (metadata.mediaType === "text/plain") text = new TextDecoder("utf-8", { fatal: true }).decode(input);
    else text = (await mammoth.extractRawText({ buffer: Buffer.from(input) })).value;
  } catch { throw new ResumeError("Não foi possível extrair texto do arquivo. Confira se está íntegro e sem senha."); }
  text = text.replace(/\r\n?/g, "\n").replace(/\u0000/g, "").trim();
  if (text.length > MAX_RESUME_TEXT) throw new ResumeError("Texto excede 100 mil caracteres.");
  return { ...metadata, text, warnings: text ? [] : ["Nenhum texto extraído. Preencha manualmente; PDFs digitalizados precisam de OCR externo."] };
}

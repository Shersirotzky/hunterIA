import { zipSync, strToU8 } from "fflate";

export function resumeDocument(lines: string[]): Blob {
  const escape = (s: string) => s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  const paragraphs = lines.flatMap(s => s.split("\n")).filter(Boolean).map(s =>
    "<w:p><w:r><w:t xml:space=\"preserve\">" + escape(s) + "</w:t></w:r></w:p>").join("");
  const data = zipSync({
    "[Content_Types].xml": strToU8('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'),
    "_rels/.rels": strToU8('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'),
    "word/document.xml": strToU8('<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' + paragraphs + '<w:sectPr/></w:body></w:document>'),
  });
  return new Blob([new Uint8Array(data).buffer], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
}

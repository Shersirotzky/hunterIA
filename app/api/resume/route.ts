import { ConvexHttpClient } from "convex/browser";
import { ConvexError } from "convex/values";
import { api } from "@/convex/_generated/api";
import { convexAuthNextjsAccessToken } from "@/lib/convexAuth";

import { signResumeProof } from "@/lib/resume-proof";
import { parseResume, ResumeError } from "@/lib/resume-parser";

export const runtime = "nodejs";
const MAX_BODY = 5 * 1024 * 1024 + 64 * 1024;
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

export async function POST(request: Request) {
  const token = await convexAuthNextjsAccessToken();
  if (!token) return Response.json({ error: "Entre na sua conta." }, { status: 401, headers });
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: "Origem inválida." }, { status: 403, headers });
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data;")) return Response.json({ error: "Envie o campo file via multipart/form-data." }, { status: 415, headers });
  const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  client.setAuth(token);
  let owner: string;
  try { const identity = await client.query(api.identity.current, {}); if (!identity) throw new Error(); owner = identity.userId; }
  catch { return Response.json({ error: "Sessão inválida." }, { status: 401, headers }); }
  try {
    // Bound actual bytes, including requests without Content-Length/chunked uploads.
    if (Number(request.headers.get("content-length")) > MAX_BODY) return Response.json({ error: "Arquivo excede 5 MB." }, { status: 413, headers });
    const reader = request.body?.getReader();
    if (!reader) return Response.json({ error: "Arquivo ausente." }, { status: 400, headers });
    const chunks: Uint8Array<ArrayBuffer>[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_BODY) { await reader.cancel(); return Response.json({ error: "Arquivo excede 5 MB." }, { status: 413, headers }); }
      chunks.push(new Uint8Array(value));
    }
    const form = await new Response(new Blob(chunks), { headers: { "Content-Type": request.headers.get("content-type")! } }).formData();
    const file = form.get("file");
    if (!(file instanceof File) || form.getAll("file").length !== 1 || file.size === 0) return Response.json({ error: "Selecione um único arquivo." }, { status: 400, headers });
    if (file.size > 5 * 1024 * 1024) return Response.json({ error: "Arquivo excede 5 MB." }, { status: 413, headers });
    const bytes = await file.arrayBuffer();
    const parsed = await parseResume(new Uint8Array(bytes), file.name, file.type);
    const proof = await signResumeProof({ sha256: parsed.sha256, fileName: parsed.fileName, mediaType: parsed.mediaType, size: parsed.size }, owner);
    const result = await client.action(api.resumes.upload, { bytes, fileName: parsed.fileName, mediaType: parsed.mediaType, proof });
    return Response.json({ ...result, text: parsed.text, warnings: parsed.warnings, downloadUrl: `/api/resume/download?id=${encodeURIComponent(result.documentId)}` }, { headers });
  } catch (error) {
    if (error instanceof ResumeError) return Response.json({ error: error.message }, { status: 422, headers });
    if (error instanceof ConvexError && typeof error.data === "object" && error.data && "code" in error.data) {
      const data = error.data as { code: string; message?: string };
      return Response.json({ error: data.message ?? "Não foi possível importar." }, { status: data.code === "UNAUTHENTICATED" ? 401 : data.code === "INVALID_RESUME" ? 422 : 400, headers });
    }
    return Response.json({ error: "Não foi possível importar. Confira o arquivo e tente novamente." }, { status: 400, headers });
  }
}

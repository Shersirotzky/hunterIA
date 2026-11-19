import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { convexAuthNextjsAccessToken } from "@/lib/convexAuth";
import type { Id } from "@/convex/_generated/dataModel";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "sandbox; default-src 'none'" };
export async function GET(request: Request) {
  const token = await convexAuthNextjsAccessToken();
  if (!token) return Response.json({ error: "Entre na sua conta." }, { status: 401, headers });
  const id = new URL(request.url).searchParams.get("id");
  if (!id || !/^[a-z0-9]{20,64}$/.test(id)) return Response.json({ error: "Documento inválido." }, { status: 400, headers });
  const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  client.setAuth(token);
  try { if (!await client.query(api.identity.current, {})) throw new Error(); }
  catch { return Response.json({ error: "Sessão inválida." }, { status: 401, headers }); }
  try {
    const document = await client.action(api.resumes.download, { documentId: id as Id<"documents"> });
    if (!document) return Response.json({ error: "Documento não encontrado." }, { status: 404, headers });
    const name = document.fileName.replace(/[\x00-\x1f\x7f"\\]/g, "_");
    return new Response(document.bytes, { headers: { ...headers, "Content-Type": "application/octet-stream", "Content-Length": String(document.bytes.byteLength), "Content-Disposition": `attachment; filename="resume${name.match(/\.(pdf|docx|txt)$/i)?.[0] ?? ""}"; filename*=UTF-8''${encodeURIComponent(name).replace(/['()*]/g, c => `%${c.charCodeAt(0).toString(16)}`)}` } });
  } catch { return Response.json({ error: "Original indisponível." }, { status: 400, headers }); }
}

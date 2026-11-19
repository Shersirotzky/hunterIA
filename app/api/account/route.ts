import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { convexAuthNextjsAccessToken } from "@/lib/convexAuth";
export async function GET() {
  const token = await convexAuthNextjsAccessToken();
  if (!token) return Response.json({ error: "Entre na sua conta." }, { status: 401 });
  const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  client.setAuth(token);
  try { return Response.json(await client.query(api.identity.current, {}), { headers: { "Cache-Control": "no-store" } }); }
  catch { return Response.json({ error: "Sessão inválida." }, { status: 401 }); }
}

import { convexAuthNextjsProxy, nextjsProxyRedirect } from "@/lib/convexAuth";

export default convexAuthNextjsProxy(async (request, { isAuthenticated }) => {
  const pathname = request.nextUrl.pathname;
  const protectedPath = pathname.startsWith("/profile") || pathname.startsWith("/jobs") || pathname.startsWith("/applications") || pathname.startsWith("/admin");
  if (protectedPath && !(await isAuthenticated())) return nextjsProxyRedirect(request, "/signin");
});

export const config = { matcher: ["/((?!auth(?:/|$)|_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|icons/|icon.svg).*)"] };

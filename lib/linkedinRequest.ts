import type { NextRequest } from "next/server";

export function linkedInRequestOrigin(request: NextRequest) {
  // Next can normalize the hostname to localhost even when the HTTP host is 127.0.0.1.
  const host = request.headers.get("host");
  if (!host) return request.nextUrl.origin;
  if (!/^(?:[a-z0-9.-]+|\[[a-f0-9:]+\])(?::\d+)?$/i.test(host)) return null;
  try {
    return new URL(`${request.nextUrl.protocol}//${host}`).origin;
  } catch {
    return null;
  }
}

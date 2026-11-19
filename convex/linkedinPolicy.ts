import { jwtVerify } from "jose";
import { z } from "zod";

export const linkedinIdentity = z.object({
  sub: z.string().min(1).max(256),
  name: z.string().max(300).optional(),
  email: z.string().email().optional(),
  email_verified: z.boolean().optional(),
});
export async function verifyLinkedinAssertion(assertion: string, secret: string) {
  if (secret.length < 32) throw new Error("LinkedIn unavailable");
  const { payload } = await jwtVerify(assertion, new TextEncoder().encode(secret), {
    issuer: "hunter-linkedin-callback", audience: "hunter-convex", algorithms: ["HS256"], maxTokenAge: "60s",
  });
  if (!payload.jti) throw new Error("Invalid assertion");
  return { identity: linkedinIdentity.parse(payload.identity), jti: payload.jti, linking: payload.linking === true };
}

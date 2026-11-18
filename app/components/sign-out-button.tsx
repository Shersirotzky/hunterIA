"use client";

import { useRouter } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";

export function SignOutButton() {
  const { signOut } = useAuthActions();
  const router = useRouter();
  return <button className="nav-signout" type="button" onClick={async () => { await signOut(); router.push("/"); }}>Sair</button>;
}

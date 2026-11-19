"use client";
import { useFormStatus } from "react-dom";
export function Submit({ children, name, value }: { children: React.ReactNode; name?: string; value?: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" className="button primary" name={name} value={value} disabled={pending} aria-busy={pending}>{pending ? "Salvando…" : children}</button>;
}

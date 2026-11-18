import type { Metadata } from "next";
import "./globals.css";
import { ProductShell } from "./components/product-shell";
import { ConvexAuthNextjsServerProvider } from "@/lib/convexAuth";

export const metadata: Metadata = {
  title: "Hunter IA",
  description: "Painel privado para descoberta e acompanhamento de oportunidades.",
  icons: { icon: "/hunter-ia-logo.png", apple: "/hunter-ia-logo.png" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body><ConvexAuthNextjsServerProvider><ProductShell>{children}</ProductShell></ConvexAuthNextjsServerProvider></body>
    </html>
  );
}

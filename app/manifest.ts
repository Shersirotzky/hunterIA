import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest { return { name: "Hunter IA", short_name: "Hunter IA", description: "Assistente privado para oportunidades profissionais.", start_url: "/", display: "standalone", background_color: "#06111f", theme_color: "#06111f", lang: "pt-BR", icons: [{ src: "/hunter-ia-logo.png", sizes: "128x128", type: "image/png", purpose: "maskable" }] }; }

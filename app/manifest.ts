import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hunter IA",
    short_name: "Hunter IA",
    description: "Assistente privado para oportunidades profissionais.",
    start_url: "/",
    display: "standalone",
    background_color: "#06111f",
    theme_color: "#06111f",
    lang: "pt-BR",
    icons: [
      { src: "/icons/hunter-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/hunter-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}

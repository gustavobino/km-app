import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Km+",
    short_name: "Km+",
    description:
      "Registre seus ganhos em 20 segundos e veja quanto sobrou no bolso.",
    lang: "pt-BR",
    start_url: "/registrar",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F4F3EE",
    theme_color: "#F4F3EE",
    categories: ["finance", "productivity"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

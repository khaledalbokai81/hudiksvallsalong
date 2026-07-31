import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hudiksvalls Salong Admin",
    short_name: "Salong Admin",
    description: "Hantera innehållet på Hudiksvalls Salongs webbplats.",
    start_url: "/admin",
    scope: "/",
    display: "standalone",
    background_color: "#f7f3ee",
    theme_color: "#743d25",
    orientation: "portrait",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}

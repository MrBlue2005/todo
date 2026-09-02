import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "RX Tasks",
    short_name: "RX Tasks",
    description: "Premium RX real-estate operations and task management.",
    start_url: "/today",
    scope: "/",
    display: "standalone",
    background_color: "#09090a",
    theme_color: "#09090a",
    orientation: "portrait-primary",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

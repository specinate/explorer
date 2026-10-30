import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Specinate Species Explorer",
    short_name: "Specinate",
    description: "An interactive globe to explore the world's most endangered species.",
    start_url: "/",
    display: "standalone",
    background_color: "#f1f5f9",
    theme_color: "#ffffff",
    icons: [
      { src: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
      { src: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}

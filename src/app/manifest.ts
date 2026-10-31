import type { MetadataRoute } from "next";
import { getDictionary } from "@/lib/i18n/he";

const t = getDictionary();

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: t.appName,
    short_name: t.appShortName,
    description: t.appTagline,
    lang: "he",
    dir: "rtl",
    start_url: "/today",
    scope: "/",
    display: "standalone",
    background_color: "#f4f7f2",
    theme_color: "#246b4a",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

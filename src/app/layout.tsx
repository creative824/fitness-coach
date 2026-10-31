import type { Metadata, Viewport } from "next";
import { Manrope, Rubik } from "next/font/google";
import { getDictionary } from "@/lib/i18n/he";
import "./globals.css";

const rubik = Rubik({
  variable: "--font-rubik",
  subsets: ["hebrew", "latin"],
  display: "swap",
});

/** Latin face for display numerals (scores, gauges, stats). */
const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  display: "swap",
});

const t = getDictionary();

export const metadata: Metadata = {
  title: {
    default: t.appName,
    template: `%s · ${t.appShortName}`,
  },
  description: t.appTagline,
  applicationName: t.appName,
  appleWebApp: {
    capable: true,
    title: t.appShortName,
    statusBarStyle: "default",
  },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#f1f3ee",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="he" dir="rtl" className={`${rubik.variable} ${manrope.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

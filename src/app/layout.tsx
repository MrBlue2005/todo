import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { AmbientBackground } from "@/components/ambient-background";
import { AppShell } from "@/components/app-shell";
import "./globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
export const metadata: Metadata = {
  title: { default: "RX Tasks", template: "%s · RX Tasks" },
  description: "The private operations workspace for RX real-estate workflows.",
  applicationName: "RX Tasks", manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "RX Tasks" },
  icons: {
    icon: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }, { url: "/icon-512.png", sizes: "512x512", type: "image/png" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  formatDetection: { telephone: false },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 1, viewportFit: "cover", themeColor: "#09090a", colorScheme: "dark" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en" className={geist.variable} suppressHydrationWarning><body><AmbientBackground /><AppShell>{children}</AppShell><script dangerouslySetInnerHTML={{ __html: `if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js'))}` }} /></body></html>;
}

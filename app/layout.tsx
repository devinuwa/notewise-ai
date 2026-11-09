import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Archivo, Barlow_Condensed, Inter, Space_Mono } from "next/font/google";
import { InstallBanner } from "@/components/pwa/InstallBanner";
import { SerwistRegister } from "@/components/pwa/SerwistRegister";
import { AppErrorBoundary } from "@/components/shell/AppErrorBoundary";
import { SplashGate } from "@/components/shell/SplashGate";
import { SplashScreen } from "@/components/shell/SplashScreen";
import { TextSizeRoot } from "@/components/shell/TextSizeRoot";
import { SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/site";
import "./globals.css";

const archivo = Archivo({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-archivo",
  axes: ["wdth"],
});

const barlow = Barlow_Condensed({
  subsets: ["latin"],
  weight: "800",
  display: "swap",
  variable: "--font-barlow",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-inter",
});

const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
  variable: "--font-space",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  title: {
    default: SITE_NAME,
    template: "%s · NoteWise AI",
  },
  description: SITE_TAGLINE,
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "NoteWise",
  },
  formatDetection: {
    telephone: false,
  },
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_TAGLINE,
    url: SITE_URL,
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "NoteWise AI" }],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_TAGLINE,
    images: ["/twitter-image"],
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#3d5f58",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${barlow.variable} ${inter.variable} ${spaceMono.variable} h-full`}
    >
      <body className="min-h-full antialiased">
        <SerwistRegister>
          <AppErrorBoundary>
            <TextSizeRoot>
              <InstallBanner />
              <Suspense fallback={<SplashScreen />}>
                <SplashGate>{children}</SplashGate>
              </Suspense>
            </TextSizeRoot>
          </AppErrorBoundary>
        </SerwistRegister>
      </body>
    </html>
  );
}

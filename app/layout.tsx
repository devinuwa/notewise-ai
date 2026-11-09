import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Archivo, Barlow_Condensed, Inter, Space_Mono } from "next/font/google";
import { InstallBanner } from "@/components/pwa/InstallBanner";
import { SerwistRegister } from "@/components/pwa/SerwistRegister";
import { AppErrorBoundary } from "@/components/shell/AppErrorBoundary";
import { SplashGate } from "@/components/shell/SplashGate";
import { SplashScreen } from "@/components/shell/SplashScreen";
import { TextSizeRoot } from "@/components/shell/TextSizeRoot";
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

const APP_NAME = "NoteWise AI";
const APP_DESCRIPTION = "A local-first study companion for handwritten notes.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  applicationName: APP_NAME,
  title: {
    default: APP_NAME,
    template: "%s · NoteWise AI",
  },
  description: APP_DESCRIPTION,
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "NoteWise",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    siteName: APP_NAME,
    title: APP_NAME,
    description: APP_DESCRIPTION,
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "NoteWise AI" }],
  },
  twitter: {
    card: "summary_large_image",
    title: APP_NAME,
    description: APP_DESCRIPTION,
    images: ["/og.png"],
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

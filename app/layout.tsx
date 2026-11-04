import type { Metadata } from "next";
import { Suspense } from "react";
import { Archivo, Barlow_Condensed, Inter, Space_Mono } from "next/font/google";
import { SplashGate } from "@/components/shell/SplashGate";
import { SplashScreen } from "@/components/shell/SplashScreen";
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
  title: "NoteWise AI",
  description: "A local-first study companion for handwritten notes.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${barlow.variable} ${inter.variable} ${spaceMono.variable} h-full`}
    >
      <body className="min-h-full antialiased">
        <Suspense fallback={<SplashScreen />}>
          <SplashGate>{children}</SplashGate>
        </Suspense>
      </body>
    </html>
  );
}

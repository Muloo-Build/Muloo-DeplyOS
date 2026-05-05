import "./globals.css";
import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";

import AuthGate from "./components/AuthGate";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap"
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap"
});

export const metadata: Metadata = {
  title: "Muloo Deploy OS",
  description: "Internal HubSpot implementation orchestration platform",
  icons: {
    icon: "/muloo-mark.svg",
    shortcut: "/muloo-mark.svg",
    apple: "/muloo-mark.svg"
  }
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="font-sans">
        <AuthGate>{children}</AuthGate>
      </body>
    </html>
  );
}

import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Muloo Deploy OS",
  description: "Internal HubSpot implementation orchestration platform"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

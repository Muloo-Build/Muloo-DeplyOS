import "./globals.css";
import type { Metadata } from "next";

import AuthGate from "./components/AuthGate";

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
      <body>
        <AuthGate>{children}</AuthGate>
      </body>
    </html>
  );
}

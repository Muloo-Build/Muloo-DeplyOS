import type { ReactNode } from "react";

import ClientAuthGate from "../components/ClientAuthGate";

export default function ClientLayout({
  children
}: {
  children: ReactNode;
}) {
  return <ClientAuthGate>{children}</ClientAuthGate>;
}

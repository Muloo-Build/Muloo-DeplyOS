"use client";

import type { ReactNode } from "react";

import AIAssistantPanel from "./AIAssistantPanel";
import Sidebar from "./Sidebar";

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen overflow-x-clip bg-background-primary text-white">
      <Sidebar />
      <main className="min-h-screen pt-16 lg:pl-sidebar lg:pt-0">
        <div className="min-h-screen bg-background-primary">{children}</div>
      </main>
      <AIAssistantPanel />
    </div>
  );
}

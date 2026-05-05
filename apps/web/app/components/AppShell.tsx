"use client";

import type { ReactNode } from "react";

import AIAssistantPanel from "./AIAssistantPanel";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { ToastProvider } from "./Toast";

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <div className="min-h-screen overflow-x-clip bg-ink-0 text-text-1">
        <Sidebar />
        <main className="min-h-screen pt-14 lg:pl-nav-w lg:pt-0 flex flex-col min-w-0">
          <Topbar />
          <div className="flex-1 min-h-0 bg-ink-0">{children}</div>
        </main>
        <AIAssistantPanel />
      </div>
    </ToastProvider>
  );
}

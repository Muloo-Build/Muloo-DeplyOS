"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import type { ReactNode } from "react";

/**
 * Lightweight toast system. No external dependency — keeps the bundle small
 * and the contract under our control. Mount the provider once at the top of
 * AppShell / ClientShell. Use the hook anywhere inside.
 *
 * Usage:
 *   const { toast } = useToast();
 *   toast.success("Quote sent to Magnisol");
 *   toast.error("Couldn't reach HubSpot. Try again in a minute.");
 *   toast.info("Saved as draft");
 *
 * Behaviour:
 * - Success and info toasts auto-dismiss after 3s.
 * - Error toasts persist until clicked (intentional — errors should be seen).
 * - Stack at the bottom-right, max 4 visible at once. Older toasts fade.
 */

type ToastVariant = "success" | "error" | "info";

type ToastEntry = {
  id: number;
  variant: ToastVariant;
  message: string;
};

type ToastContextValue = {
  toast: {
    success: (message: string) => void;
    error: (message: string) => void;
    info: (message: string) => void;
  };
};

const ToastContext = createContext<ToastContextValue | null>(null);

const variantClasses: Record<ToastVariant, string> = {
  success:
    "border-emerald-400/30 bg-emerald-500/15 text-emerald-50",
  error: "border-rose-400/30 bg-rose-500/15 text-rose-50",
  info: "border-[#49cde1]/30 bg-[#49cde1]/15 text-[#9be4f0]"
};

const variantPrefix: Record<ToastVariant, string> = {
  success: "✓",
  error: "✕",
  info: "•"
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((entry) => entry.id !== id));
  }, []);

  const push = useCallback(
    (variant: ToastVariant, message: string) => {
      counter.current += 1;
      const id = counter.current;
      setToasts((current) => {
        const next = [...current, { id, variant, message }];
        // Cap at 4 visible — drop the oldest.
        return next.slice(-4);
      });
      if (variant !== "error") {
        setTimeout(() => dismiss(id), 3000);
      }
    },
    [dismiss]
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      toast: {
        success: (m) => push("success", m),
        error: (m) => push("error", m),
        info: (m) => push("info", m)
      }
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2">
        {toasts.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => dismiss(entry.id)}
            className={`pointer-events-auto flex items-start gap-3 rounded-[14px] border px-4 py-3 text-left text-sm shadow-lg backdrop-blur transition hover:opacity-90 ${variantClasses[entry.variant]}`}
            aria-live={entry.variant === "error" ? "assertive" : "polite"}
          >
            <span className="font-mono text-base leading-5">
              {variantPrefix[entry.variant]}
            </span>
            <span className="flex-1">{entry.message}</span>
            <span className="text-xs opacity-60">×</span>
          </button>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Fail soft in components that may render outside a provider — log and no-op.
    if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.warn("[useToast] used outside ToastProvider");
    }
    return {
      toast: {
        success: () => {},
        error: () => {},
        info: () => {}
      }
    };
  }
  return ctx;
}

/** Suppress unused-import warning when only ToastProvider is referenced. */
export const _toastProviderTouch = useEffect;

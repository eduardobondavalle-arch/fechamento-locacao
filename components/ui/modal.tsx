"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

export function Modal({
  title,
  description,
  onClose,
  children,
  size = "large",
}: {
  title: ReactNode;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  size?: "medium" | "large" | "fullscreen";
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const focusable = panel?.querySelector<HTMLElement>(
      "button, input, select, textarea, a[href], [tabindex]:not([tabindex='-1'])",
    );
    focusable?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab" || !panel) return;
      const items = Array.from(
        panel.querySelectorAll<HTMLElement>(
          "button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex]:not([tabindex='-1'])",
        ),
      );
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
      previous?.focus();
    };
  }, [onClose]);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-navy-900/45 backdrop-blur-[2px] ${size === "fullscreen" ? "p-0" : "p-3 sm:p-6"}`}
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        aria-describedby={description ? "modal-description" : undefined}
        className={`glass-strong flex w-full flex-col overflow-hidden border border-[var(--border)] shadow-[var(--elev-3)] ${
          size === "fullscreen"
            ? "h-dvh max-h-none max-w-none rounded-none border-0"
            : `max-h-[94vh] rounded-3xl ${size === "large" ? "max-w-6xl" : "max-w-2xl"}`
        }`}
      >
        <div className="flex items-start justify-between border-b border-[var(--border)] px-5 py-4">
          <div className="min-w-0">
            <h2
              id="modal-title"
              className="truncate text-lg font-bold text-[var(--foreground)]"
            >
              {title}
            </h2>
            {description && (
              <p
                id="modal-description"
                className="mt-0.5 text-sm text-slate-500"
              >
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="icon-button ml-3"
            aria-label="Fechar diálogo"
          >
            <X size={19} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

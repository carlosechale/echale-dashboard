"use client";

import { useRouter } from "next/navigation";

interface Props {
  clientName: string | null;
}

export default function ClientTopBar({ clientName }: Props) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-surface border-b border-border z-20 flex items-center justify-between px-6">
      {/* Left: brand + clinic */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-accent flex items-center justify-center shrink-0">
            <span className="font-display text-[11px] font-black text-background leading-none">É</span>
          </div>
          <span className="font-display text-sm font-bold text-foreground tracking-tight">
            ÉCHALE
          </span>
        </div>

        {clientName && (
          <>
            <span className="text-border text-lg leading-none select-none">/</span>
            <span className="font-sans text-sm text-muted">
              {clientName}
            </span>
          </>
        )}
      </div>

      {/* Right: logout */}
      <button
        onClick={handleLogout}
        className="flex items-center gap-2 text-xs font-sans text-muted hover:text-foreground transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
        Cerrar sesión
      </button>
    </header>
  );
}

"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { clearStoredSession, getStoredSession, syncCurrentSession } from "@/lib/api";

export default function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function guardRoute() {
      const session = getStoredSession();
      if (!session) {
        router.replace("/login");
        return;
      }

      try {
        await syncCurrentSession(session);
        if (!cancelled) {
          setReady(true);
        }
      } catch {
        clearStoredSession();
        router.replace("/login");
      }
    }

    void guardRoute();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!ready) {
    return <div className="p-6 text-sm text-slate-500">Checking your session...</div>;
  }

  return <>{children}</>;
}

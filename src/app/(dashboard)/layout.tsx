"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import Sidebar from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { clearStoredSession, getStoredSession, syncCurrentSession } from "@/lib/api";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      const session = getStoredSession();

      if (!session) {
        router.replace("/login");
        return;
      }

      try {
        const nextSession = await syncCurrentSession(session);
        if (!nextSession.user.is_superuser) {
          clearStoredSession();
          router.replace("/login");
          return;
        }
        if (!cancelled) {
          setReady(true);
        }
      } catch {
        clearStoredSession();
        router.replace("/login");
      }
    }

    void restoreSession();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!ready) {
    return <div className="p-8 text-sm text-slate-500">Opening your dashboard...</div>;
  }

  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar />

      <div className="flex flex-1 flex-col">
        <Topbar />
        <div className="p-8">{children}</div>
      </div>
    </div>
  );
}

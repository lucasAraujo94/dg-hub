import { APP_ORIGIN, isNativeApp } from "@/const";
import { useEffect, useState } from "react";

const MAX_WAIT_MS = 45000;
const POLL_INTERVAL_MS = 2500;

function getHealthUrl() {
  if (isNativeApp) {
    return `${APP_ORIGIN}/api/health`;
  }
  return "/api/health";
}

export function AppBootGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(!isNativeApp);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!isNativeApp) return;

    let cancelled = false;
    let timeoutId: number | null = null;
    let intervalId: number | null = null;

    const markReady = () => {
      if (cancelled) return;
      setReady(true);
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      if (intervalId !== null) window.clearInterval(intervalId);
    };

    const checkHealth = async () => {
      try {
        const response = await fetch(getHealthUrl(), {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });
        if (response.ok) {
          markReady();
        }
      } catch {
        // cold start or temporary network failure; keep polling
      }
    };

    void checkHealth();
    intervalId = window.setInterval(() => {
      void checkHealth();
    }, POLL_INTERVAL_MS);

    timeoutId = window.setTimeout(() => {
      if (cancelled) return;
      setTimedOut(true);
      setReady(true);
      if (intervalId !== null) window.clearInterval(intervalId);
    }, MAX_WAIT_MS);

    return () => {
      cancelled = true;
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      if (intervalId !== null) window.clearInterval(intervalId);
    };
  }, []);

  if (!ready) {
    return (
      <div className="min-h-screen bg-[#05070d] text-white">
        <div className="flex min-h-screen items-center justify-center px-6">
          <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-white/5 p-6 text-center shadow-[0_20px_80px_-40px_rgba(0,0,0,0.7)] backdrop-blur-xl">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-fuchsia-400" />
            <p className="text-xs uppercase tracking-[0.28em] text-fuchsia-300">DG Hub</p>
            <h1 className="mt-3 text-xl font-semibold">Conectando ao servidor</h1>
            <p className="mt-2 text-sm text-slate-300">
              O aplicativo está iniciando o servidor. Isso pode levar alguns segundos no plano gratuito.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {timedOut ? (
        <div className="fixed inset-x-4 top-4 z-50 rounded-2xl border border-amber-500/40 bg-[#20150a]/90 px-4 py-3 text-sm text-amber-100 shadow-lg backdrop-blur">
          O servidor demorou para responder. O app vai continuar tentando carregar em segundo plano.
        </div>
      ) : null}
      {children}
    </>
  );
}

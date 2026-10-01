"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

/**
 * TanStack Query for the app and ceremony routes only (the landing page reads no live
 * data). One client per browser session, so the cache survives moving between the
 * two route groups (Tonight → the Draw); a fresh one per server render.
 */
let browserClient: QueryClient | undefined;

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { staleTime: 15_000, retry: 1, refetchOnWindowFocus: false } } });
}

function getClient() {
  if (typeof window === "undefined") return makeClient();
  return (browserClient ??= makeClient());
}

export function QueryProvider({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={getClient()}>{children}</QueryClientProvider>;
}

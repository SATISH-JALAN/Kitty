import { notFound } from "next/navigation";
import type { ReactNode } from "react";

/** Dev-only showcases (brief 15.1). 404 in production unless NEXT_PUBLIC_LAB=1. */
export default function LabLayout({ children }: { children: ReactNode }) {
  if (process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_LAB !== "1") notFound();
  return <div className="min-h-svh">{children}</div>;
}

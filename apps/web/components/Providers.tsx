"use client";
import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { MotionProvider } from "@kitty/ui/motion/MotionProvider";
import { hydrateSession } from "@/data/session";

/** Lenis only on the landing page and the Diary (brief 8.1). */
function smoothFor(pathname: string) {
  return pathname === "/" || pathname.startsWith("/diary");
}

export function Providers({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  useEffect(() => hydrateSession(), []);
  return <MotionProvider smooth={smoothFor(pathname)}>{children}</MotionProvider>;
}

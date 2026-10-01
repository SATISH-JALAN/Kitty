import type { ReactNode } from "react";
import { DevnetTag } from "@/components/chrome/DevnetTag";
import { TransitionProvider } from "@/components/chrome/Transition";
import { QueryProvider } from "@/components/QueryProvider";
import "../app.css";

/** Ceremonies are Night-world events with no app chrome (brief 12.1). */
export default function CeremonyLayout({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <TransitionProvider world="night">
        <div data-world="night" className="ceremony-root">
          {children}
          <DevnetTag placement="top" />
        </div>
      </TransitionProvider>
    </QueryProvider>
  );
}

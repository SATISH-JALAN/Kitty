import type { ReactNode } from "react";
import { AppHeader, TabBar } from "@/components/chrome/AppChrome";
import { TransitionProvider } from "@/components/chrome/Transition";
import { QueryProvider } from "@/components/QueryProvider";
import { copy } from "@/copy/en";
import "../app.css";

/** The app is the party itself: Paper world, calm, plain around money (brief 12). */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <TransitionProvider world="paper">
        <div data-world="paper" className="app-root">
          <a href="#main" className="skip-link">
            Skip to content
          </a>
          <AppHeader />
          <main id="main" className="app-main">
            {children}
          </main>
          <TabBar />
          <span className="sr-only">{copy.devnet}</span>
        </div>
      </TransitionProvider>
    </QueryProvider>
  );
}

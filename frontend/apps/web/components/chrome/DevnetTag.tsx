"use client";
/**
 * The always-visible "Devnet · test funds only" ticket (brief 0.4, 10.2). Clicking it hangs
 * a tag explaining, plainly, that no real money is used.
 *
 * Placement (STORYBOARD §2): on the landing page it floats bottom-left as specced; in the
 * app it sits in the header (so it never covers a chip-in or a seat); on ceremony screens,
 * which have no header, it rests top-left.
 */
import { useEffect, useRef, useState } from "react";
import { Tag } from "@kitty/ui/components/Tag";
import { Tooltip } from "@kitty/ui/components/Tooltip";
import { copy } from "@/copy/en";

export function DevnetTag({ placement = "floating" }: { placement?: "floating" | "inline" | "top" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent && e.key !== "Escape") return;
      if (e instanceof PointerEvent && ref.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", close);
    };
  }, [open]);
  const tag = (
    <Tooltip content={copy.devnetExplain} open={open} placement={placement === "floating" ? "top" : "bottom"} maxWidth={260}>
      <button ref={ref} type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={copy.devnet} data-focus-ring="" style={{ display: "inline-flex", minHeight: 44, alignItems: "center" }}>
        <Tag variant="devnet">
          <span className="devnet-long">{copy.devnet}</span>
          <span className="devnet-short" aria-hidden="true">
            Devnet · test funds
          </span>
        </Tag>
      </button>
    </Tooltip>
  );
  if (placement === "inline") return <span className="devnet-tag devnet-tag--inline">{tag}</span>;
  return (
    <div className={`devnet-tag devnet-tag--${placement}`} style={{ position: "fixed", zIndex: "var(--z-toast)" as unknown as number }}>
      {tag}
    </div>
  );
}

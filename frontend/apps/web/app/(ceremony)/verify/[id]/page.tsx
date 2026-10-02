"use client";
/**
 * A shared Diary page (flow 9), for the reader it was made for. Shows exactly the claim, whether
 * the proof checks out, and whether it's still current (the note behind it is unspent). The
 * reader can re-check the proof in their own browser; nothing about the member is shown.
 */
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { formatMoney } from "@kitty/sdk";
import { Button } from "@kitty/ui/components/Button";
import { Stamp } from "@kitty/ui/components/Stamp";
import { stamp } from "@kitty/ui/motion/primitives/physical";
import { prefersReducedMotion } from "@kitty/ui/motion/reduced";
import { DiaryPage } from "@/components/stage/Booklet";
import { useIrisEntry } from "@/components/chrome/Transition";
import { API } from "@/data/api";

interface PageData {
  id: string;
  claim: { minCompleted: string; minPaid: string; maxLate: string };
  scopeLabel: string;
  createdAt: string;
  proof: unknown;
  publicSignals: string[];
  check: { ok: boolean; reason?: string; unspent?: boolean; rootKnown?: boolean; provenAt?: string };
}

function statement(c: PageData["claim"]): string {
  const parts: string[] = [];
  const k = Number(c.minCompleted);
  if (k > 0) parts.push(`finished at least ${k} ${k === 1 ? "party" : "parties"}`);
  if (Number(c.maxLate) === 0) parts.push("never late");
  if (BigInt(c.minPaid) > 0n) parts.push(`chipped in at least ${formatMoney(Number(c.minPaid))}`);
  const s = parts.join(" · ") || "in good standing";
  return `${s[0].toUpperCase()}${s.slice(1)}.`;
}

export default function VerifyPage() {
  const { id } = useParams<{ id: string }>();
  const root = useRef<HTMLElement>(null);
  const [data, setData] = useState<PageData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [local, setLocal] = useState<"idle" | "busy" | "ok" | "bad">("idle");
  useIrisEntry(root);

  useEffect(() => {
    if (!API) {
      setErr("Verification needs the Kitty API (devnet).");
      return;
    }
    fetch(`${API}/v1/pages/${id}`)
      .then(async (r) => (r.ok ? setData(await r.json()) : setErr("We can't find this page. Check the link.")))
      .catch(() => setErr("We couldn't reach Kitty just now. Try again in a minute."));
  }, [id]);

  const good = !!data?.check.ok && data.check.unspent !== false && data.check.rootKnown !== false;
  useEffect(() => {
    const s = root.current?.querySelector(".verify-stamp");
    if (!data || !s || prefersReducedMotion()) return;
    stamp(s, { theta: -8, delay: 0.4 });
  }, [data]);

  const checkHere = async () => {
    if (!data) return;
    setLocal("busy");
    try {
      const [snarkjs, vk] = await Promise.all([import("snarkjs"), fetch("/zk/kitty_action_vk.json").then((r) => r.json())]);
      setLocal((await snarkjs.groth16.verify(vk, data.publicSignals, data.proof as never)) ? "ok" : "bad");
    } catch {
      setLocal("bad");
    }
  };

  return (
    <main ref={root} className="pass-page" aria-labelledby="verify-title" style={{ display: "grid", placeItems: "center", minHeight: "100svh", padding: "96px 16px" }}>
      <div style={{ width: "min(520px, 100%)", display: "flex", flexDirection: "column", gap: 20 }}>
        <h1 id="verify-title" className="type-h2">
          A page from a Party Diary
        </h1>
        {err && (
          <p className="type-body" role="alert">
            {err}
          </p>
        )}
        {!data && !err && <div className="fold-lines" style={{ height: 420 }} aria-busy="true" />}
        {data && (
          <>
            <div style={{ position: "relative" }}>
              <DiaryPage perforated="left" style={{ minHeight: 380 }}>
                <p className="type-label" style={{ color: "var(--ink-soft)" }}>
                  Party Diary · one page
                </p>
                <p className="type-word" style={{ fontSize: 36, lineHeight: 1.1, marginTop: 24 }}>
                  {statement(data.claim)}
                </p>
                <p className="type-small" style={{ color: "var(--ink-soft)", marginTop: "auto" }}>
                  For {data.scopeLabel} · proven {new Date(data.check.provenAt ?? data.createdAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </p>
                <Stamp className="verify-stamp" label={good ? "Verified by proof" : data.check.ok ? "Out of date" : "Doesn't check out"} ink={good ? "teal" : "plum"} style={{ position: "absolute", right: 20, bottom: 70 }} />
              </DiaryPage>
            </div>
            <ul className="type-body" style={{ display: "flex", flexDirection: "column", gap: 6, paddingLeft: 18 }}>
              <li>{data.check.ok ? "The proof checks out against Kitty's verifying key." : `The proof doesn't check out (${data.check.reason}).`}</li>
              {data.check.ok && <li>{data.check.unspent ? "It's current: the Diary behind it hasn't changed since." : "The Diary behind it has changed since. Ask for a fresh page."}</li>}
              {data.check.ok && <li>{data.check.rootKnown ? "It was made against a recent Kitty tree." : "It was made against an old Kitty tree. Ask for a fresh page."}</li>}
              <li>It shows only this claim: no name, no ID, no other parties.</li>
            </ul>
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <Button variant="ghost" busy={local === "busy"} onClick={checkHere} disabled={local === "ok"}>
                {local === "ok" ? "Checked in your browser" : local === "bad" ? "Didn't check out in your browser" : "Check it in your browser"}
              </Button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

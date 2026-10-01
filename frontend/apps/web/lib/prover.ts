"use client";
/**
 * Prover bridge (architecture 8.2 `zk`). The real prover is a Web Worker in packages/zk
 * (snarkjs / @anon-aadhaar/core) reporting progress; until it lands this devnet mock
 * emits the same events with measured-looking timings, so the UI and its states are
 * final. Swap `runMock` for the worker call — nothing else changes.
 */

export type ProofStep = "keys" | "proof" | "send";

export interface ProofEvent {
  step: ProofStep;
  /** 0–1, or null when the step can't report progress (proving). */
  progress: number | null;
  detail?: string;
}

export class ProofError extends Error {
  constructor(
    public kind: "interrupted" | "registered" | "unreadable",
    message = kind,
  ) {
    super(message);
  }
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((res, rej) => {
    const t = setTimeout(res, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      rej(new ProofError("interrupted"));
    });
  });

function demo(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("demo");
}

/** Read the test QR image: only checks that it's an image we can decode. */
export async function readTestQr(file: File): Promise<void> {
  if (!file.type.startsWith("image/")) throw new ProofError("unreadable");
  const url = URL.createObjectURL(file);
  try {
    await new Promise<void>((res, rej) => {
      const img = new Image();
      img.onload = () => (img.width < 80 ? rej(new ProofError("unreadable")) : res());
      img.onerror = () => rej(new ProofError("unreadable"));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Guest Pass registration: fetch keys (600 MB, once) → build proof → send. */
export async function proveRegistration(onEvent: (e: ProofEvent) => void, signal?: AbortSignal): Promise<{ signature: string }> {
  const d = demo();
  // Keys: chunked download with real byte counts.
  const total = 600;
  const cached = (() => {
    try {
      return localStorage.getItem("kitty:keys") === "1";
    } catch {
      return false;
    }
  })();
  for (let mb = cached ? total : 0; mb <= total; mb += 24) {
    onEvent({ step: "keys", progress: mb / total, detail: `Downloading keys · ${Math.min(mb, total)} / ${total} MB · once only` });
    await sleep(110, signal);
  }
  try {
    localStorage.setItem("kitty:keys", "1");
  } catch {
    /* next visit downloads again */
  }
  onEvent({ step: "keys", progress: 1 });
  // Proof: the circuit can't report progress; the UI shows elapsed time instead.
  onEvent({ step: "proof", progress: null });
  await sleep(5200, signal);
  if (d === "prooffail") throw new ProofError("interrupted");
  onEvent({ step: "proof", progress: 1 });
  onEvent({ step: "send", progress: null });
  await sleep(1300, signal);
  if (d === "registered") throw new ProofError("registered");
  onEvent({ step: "send", progress: 1 });
  return { signature: "2o7JuNnX6FvvinwdqaetPtxDvn6dFqgr1Hz74zi2RyLjsxWtMY31YZU9B4f9e61vLWiq52MQvi88AjHbKpapyqQA" };
}

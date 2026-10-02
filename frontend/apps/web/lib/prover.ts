"use client";
/**
 * Prover bridge (architecture 8.2 `zk`). Live: the Anon Aadhaar proof runs in the prover Web
 * Worker (packages/zk) and the pass is registered through the fee relay. Sample mode (no API)
 * keeps the original timed mock so the experience can be reviewed without a backend.
 */
import { API } from "@/lib/kitty/api";

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
    message: string = kind,
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

/** Read the test QR image and return its data (a long decimal number). */
export async function readTestQr(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new ProofError("unreadable");
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new ProofError("unreadable");
  });
  if (bitmap.width < 80) throw new ProofError("unreadable");
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0);
  const img = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
  const { default: jsQR } = await import("jsqr");
  const code = jsQR(img.data, img.width, img.height);
  if (!API) return code?.data ?? "sample";
  if (!code || !/^\d{100,}$/.test(code.data.trim())) throw new ProofError("unreadable");
  return code.data.trim();
}

/** Make a fresh test QR on this device (Anon Aadhaar's public test key; devnet only). */
export async function makeTestQr(): Promise<string> {
  const { makeTestQr } = await import("@/lib/kitty/actions");
  return makeTestQr();
}

/** Guest Pass registration: fetch keys (once) → build proof → send. */
export async function proveRegistration(qrData: string, onEvent: (e: ProofEvent) => void, signal?: AbortSignal): Promise<{ signature: string }> {
  if (API) {
    const { register } = await import("@/lib/kitty/actions");
    const { TxError } = await import("@/lib/kitty/tx");
    try {
      return await register(qrData, (step, progress, detail) => {
        if (signal?.aborted) throw new ProofError("interrupted");
        onEvent({ step, progress, detail });
      });
    } catch (e) {
      console.error("[kitty] Guest Pass failed:", e);
      if (e instanceof ProofError) throw e;
      if (e instanceof TxError && (e.code === "AlreadyInUse" || /already in use/i.test(e.message))) throw new ProofError("registered");
      if (/unreadable/.test((e as Error).message)) throw new ProofError("unreadable");
      throw new ProofError("interrupted", (e as Error).message);
    }
  }
  return mockRegistration(onEvent, signal);
}

async function mockRegistration(onEvent: (e: ProofEvent) => void, signal?: AbortSignal): Promise<{ signature: string }> {
  const d = demo();
  const total = 282;
  const cached = (() => {
    try {
      return localStorage.getItem("kitty:keys") === "1";
    } catch {
      return false;
    }
  })();
  for (let mb = cached ? total : 0; mb <= total; mb += 12) {
    onEvent({ step: "keys", progress: mb / total, detail: `Downloading keys · ${Math.min(mb, total)} / ${total} MB · once only` });
    await sleep(110, signal);
  }
  try {
    localStorage.setItem("kitty:keys", "1");
  } catch {
    /* next visit downloads again */
  }
  onEvent({ step: "keys", progress: 1 });
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

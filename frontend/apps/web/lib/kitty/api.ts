/** The backend API (architecture 7.2): public reads, the fee relay, faucet, backups, pages. */
export const API = process.env.NEXT_PUBLIC_KITTY_API ?? "";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public logs?: string[],
  ) {
    super(message);
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: { accept: "application/json" } });
  if (!res.ok) throw new ApiError(res.status, (await res.json().catch(() => ({}))).error ?? `api ${res.status}`);
  if (res.status === 204) return null as T;
  return (await res.json()) as T;
}

export async function apiSend<T>(path: string, body: unknown, method: "POST" | "PUT" = "POST"): Promise<T> {
  const res = await fetch(`${API}${path}`, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, json.error ?? `api ${res.status}`, json.logs);
  return json as T;
}

export interface ChainConfig {
  programId: string;
  rpc: string;
  mint: string;
  relay: string | null;
  fees: { protocolBps: number; coverBps: number; lateBps: number; maxHostBps: number };
  minGraceSecs: string;
  collectWindowSecs: string;
  nowToleranceSecs: string;
  allowance: string;
  nextPartyId: string;
  devRegister: boolean;
  artifacts: { base: string; wasm: { file: string; sha256: string; bytes: number }; zkey: { file: string; sha256: string; bytes: number } } | null;
}

let cfg: Promise<ChainConfig> | null = null;
export function chainConfig(fresh = false): Promise<ChainConfig> {
  if (!cfg || fresh) cfg = apiGet<ChainConfig>("/v1/config").catch((e) => {
    cfg = null;
    throw e;
  });
  return cfg;
}

/** Where the Kitty action circuit's wasm and zkey live (served with the app by default). */
export async function actionArtifacts() {
  const c = await chainConfig();
  const a = c.artifacts;
  if (!a) throw new Error("proving keys are not configured");
  const base = a.base.startsWith("http") ? a.base : `${typeof window === "undefined" ? "" : window.location.origin}${a.base}`;
  return {
    wasm: { url: `${base}/${a.wasm.file}`, sha256: a.wasm.sha256, bytes: a.wasm.bytes },
    zkey: { url: `${base}/${a.zkey.file}`, sha256: a.zkey.sha256, bytes: a.zkey.bytes },
  };
}

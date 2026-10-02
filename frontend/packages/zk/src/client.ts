/** Main-thread handle on the prover worker (one per tab). */
import * as Comlink from "comlink";
import type { ProverApi } from "./worker";

let remote: Comlink.Remote<ProverApi> | null = null;

export function prover(): Comlink.Remote<ProverApi> {
  if (!remote) {
    const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module", name: "kitty-prover" });
    remote = Comlink.wrap<ProverApi>(worker);
  }
  return remote;
}

export { Comlink };
export type { ProverApi, ActionRequest, Artifacts, NoteJson, ProofResult } from "./worker";

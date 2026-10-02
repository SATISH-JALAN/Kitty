/**
 * Tree sync (architecture 7.3): the device downloads every leaf (never a single path), rebuilds
 * the depth-26 tree in the prover worker and computes its own paths offline.
 */
import { prover } from "@kitty/zk/client";
import { apiGet } from "./api";

let syncing: Promise<number> | null = null;

export function syncTree(): Promise<number> {
  syncing ??= (async () => {
    const p = prover();
    let size = await p.treeSize();
    for (;;) {
      const page = await apiGet<{ from: number; leaves: string[]; total: number }>(`/v1/tree/leaves?from=${size}&limit=5000`);
      if (!page.leaves.length) break;
      ({ size } = await p.appendLeaves(page.from, page.leaves));
      if (size >= page.total) break;
    }
    return size;
  })().finally(() => {
    syncing = null;
  });
  return syncing;
}

/** Wait until the indexer has served a leaf we know was appended (after our own transaction). */
export async function waitForLeaf(value: string, tries = 40): Promise<void> {
  const p = prover();
  for (let i = 0; i < tries; i++) {
    await syncTree();
    if (await p.hasLeaf(value)) return;
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error("The indexer hasn't caught up yet. Try again in a moment.");
}

/**
 * The Butler (architecture 7.1, 7.4): every tick, read every party and send whatever cranks are
 * due. Failures are expected (a pull with no funds, a race with another Butler) and only logged.
 */
import { type Address, type KeyPairSigner } from "@solana/kit";
import { findAssociatedTokenPda, getCreateAssociatedTokenIdempotentInstruction, TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import * as C from "@kitty/chain";
import { chainClock, fetchConfig, fetchParties, sendInstructions, sleep } from "../chain";
import { log } from "../log";
import { type Crank, plan } from "./plan";
import { randomnessState, requestRandomnessIx } from "./orao";

/** The program's own reason from a failed simulation (its AnchorError log line), if any. */
function programError(e: unknown): string | undefined {
  const logs = (e as { context?: { logs?: string[] } }).context?.logs ?? [];
  return logs.find((l) => l.includes("Error Code:"))?.replace(/^Program log: /, "") ?? logs.at(-1);
}

export class Butler {
  /** Don't hammer a crank that keeps failing (e.g. an empty wallet): retry after a backoff. */
  private backoff = new Map<string, { until: number; fails: number }>();
  constructor(private signer: KeyPairSigner, private mint: Address) {}

  private async ata(owner: Address) {
    const [a] = await findAssociatedTokenPda({ owner, mint: this.mint, tokenProgram: TOKEN_PROGRAM_ADDRESS });
    return a;
  }

  private async ixFor(party: Address, p: C.Party, c: Crank) {
    const vault = await C.vaultPda(party);
    const member = (i: number) => p.members[i];
    switch (c.kind) {
      case "cancel":
        return [C.getCancelPartyInstruction({ party })];
      case "collect":
        return [
          await C.getCollectInstructionAsync({
            signer: this.signer, party, vault, memberToken: await this.ata(member(c.member).wallet),
            treasury: (await fetchConfig())!.treasury, memberIdx: c.member,
          }),
        ];
      case "requestDraw":
        return [C.getRequestDrawInstruction({ party })];
      case "resolveDraw": {
        const state = await randomnessState(c.seed);
        if (state === "missing") return [await requestRandomnessIx(this.signer, c.seed)];
        if (state === "pending") return [];
        return [C.getResolveDrawInstruction({ party, randomness: await C.oraoRandomnessPda(c.seed) })];
      }
      case "settle": {
        const winner = member(c.winner);
        const host = p.members.slice(0, p.joined).find((m) => m.wallet === p.hostWallet);
        const winnerToken = await this.ata(winner.wallet);
        const hostToken = await this.ata(host?.wallet ?? p.hostWallet);
        return [
          getCreateAssociatedTokenIdempotentInstruction({ payer: this.signer, ata: hostToken, owner: host?.wallet ?? p.hostWallet, mint: this.mint }),
          await C.getSettleRoundInstructionAsync({ party, vault, winnerToken, hostToken }),
        ];
      }
      case "markDefault":
        return [await C.getMarkDefaultInstructionAsync({ party, vault, memberIdx: c.member })];
      case "farewell":
        return [await C.getFarewellInstructionAsync({ party, vault, memberToken: await this.ata(member(c.member).wallet), memberIdx: c.member })];
    }
  }

  async tick(now = Math.floor(Date.now() / 1000)): Promise<number> {
    const cfg = await fetchConfig();
    if (!cfg) return 0;
    let sent = 0;
    for (const { address, data } of await fetchParties()) {
      for (const crank of plan(data, now, { collectWindowSecs: Number(cfg.collectWindowSecs) })) {
        const key = `${address}:${crank.kind}:${"member" in crank ? crank.member : ""}:${"round" in crank ? crank.round : ""}`;
        const b = this.backoff.get(key);
        if (b && Date.now() < b.until) continue;
        try {
          const ixs = await this.ixFor(address, data, crank);
          if (!ixs.length) continue;
          const sig = await sendInstructions(this.signer, ixs);
          this.backoff.delete(key);
          sent++;
          log.info({ party: data.id.toString(), crank: crank.kind, sig }, "butler: crank");
        } catch (e) {
          const fails = (b?.fails ?? 0) + 1;
          this.backoff.set(key, { fails, until: Date.now() + Math.min(5 * 60_000, 4000 * 2 ** fails) });
          log.warn({ party: data.id.toString(), crank: crank.kind, fails, err: (e as Error).message.slice(0, 300), why: programError(e) }, "butler: crank failed");
        }
      }
    }
    return sent;
  }

  async run(tickMs: number, stop: { stopped: boolean } = { stopped: false }) {
    log.info({ butler: this.signer.address }, "butler: on duty");
    while (!stop.stopped) {
      try {
        // Deadlines are the chain's, so plan on its clock (the server's can drift from it).
        await this.tick(await chainClock().catch(() => Math.floor(Date.now() / 1000)));
      } catch (e) {
        log.warn({ err: (e as Error).message }, "butler: tick failed");
      }
      await sleep(tickMs);
    }
  }
}

/**
 * The fee relay (replaces Kora; architecture 6.4 policy). A member's device builds a transaction
 * with the relay as fee payer, signs it with its party wallet, and posts it here. The relay checks
 * the policy, adds its signature and sends it. Members never hold SOL.
 */
import {
  type Address,
  type KeyPairSigner,
  type Transaction,
  getBase64EncodedWireTransaction,
  getCompiledTransactionMessageDecoder,
  getSignatureFromTransaction,
  getTransactionDecoder,
  partiallySignTransaction,
} from "@solana/kit";
import * as C from "@kitty/chain";

const SPL_TOKEN = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const ATA = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
const COMPUTE_BUDGET = "ComputeBudget111111111111111111111111111111";
const ED25519 = "Ed25519SigVerify111111111111111111111111111";

/** SPL Token instruction tags the relay will pay for: Approve (4), Revoke (5). */
const TOKEN_OK = new Set([4, 5]);
/** ATA program: Create (0) and CreateIdempotent (1). */
const ATA_OK = new Set([0, 1]);
/** Kitty instructions a member's device sends through the relay. */
const KITTY_OK = new Set(["register", "createParty", "rsvp", "payManual", "settleUp", "updateNote", "verifyHistory", "vouch", "unvouch"]);

export interface Decoded {
  tx: Transaction;
  feePayer: Address;
  instructions: { program: Address; accounts: Address[]; data: Uint8Array }[];
}

export function decodeWire(base64: string): Decoded {
  const bytes = Uint8Array.from(Buffer.from(base64, "base64"));
  if (bytes.length > 1232) throw new PolicyError("transaction is larger than 1232 bytes");
  const tx = getTransactionDecoder().decode(bytes);
  const decoded = getCompiledTransactionMessageDecoder().decode(tx.messageBytes);
  if (!("instructions" in decoded)) throw new PolicyError("only legacy and v0 transactions are accepted");
  const msg = decoded as typeof decoded & { instructions: { programAddressIndex: number; accountIndices?: number[]; data?: Uint8Array }[] };
  if ("addressTableLookups" in msg && ((msg.addressTableLookups as unknown[] | undefined)?.length ?? 0) > 0) throw new PolicyError("lookup tables are not accepted");
  const keys = msg.staticAccounts;
  return {
    tx,
    feePayer: keys[0],
    instructions: msg.instructions.map((ix) => ({
      program: keys[ix.programAddressIndex],
      accounts: (ix.accountIndices ?? []).map((i) => keys[i]),
      data: Uint8Array.from(ix.data ?? new Uint8Array()),
    })),
  };
}

export class PolicyError extends Error {}

/** Identify a Kitty instruction by its 8-byte discriminator. */
function kittyName(data: Uint8Array): string | null {
  const head = data.subarray(0, 8);
  for (const [k, v] of Object.entries(C)) {
    if (k.endsWith("_DISCRIMINATOR") && !k.endsWith("_EVENT_DISCRIMINATOR") && v instanceof Uint8Array && v.length === 8 && v.every((b, i) => b === head[i])) {
      return k.replace(/_DISCRIMINATOR$/, "").toLowerCase().replace(/_(\w)/g, (_, c: string) => c.toUpperCase());
    }
  }
  return null;
}

/**
 * The policy: the relay is the fee payer; every instruction is Kitty (member actions only),
 * an SPL approve/revoke, an associated-token-account create, compute budget or Ed25519; and the
 * relay's key appears nowhere except as fee payer or as the rent payer of a Kitty/ATA instruction.
 */
export function checkPolicy(d: Decoded, relay: Address, program: Address = C.KITTY_PROGRAM_ADDRESS): string[] {
  if (d.feePayer !== relay) throw new PolicyError("the relay must be the fee payer");
  if (d.instructions.length === 0 || d.instructions.length > 6) throw new PolicyError("unexpected instruction count");
  const names: string[] = [];
  let kitty = 0;
  for (const ix of d.instructions) {
    const p = ix.program as string;
    if (p === program) {
      const name = kittyName(ix.data);
      if (!name || !KITTY_OK.has(name)) throw new PolicyError(`Kitty instruction not allowed through the relay: ${name ?? "unknown"}`);
      names.push(name);
      kitty++;
      continue;
    }
    const usesRelay = ix.accounts.includes(relay);
    if (p === COMPUTE_BUDGET || p === ED25519) {
      names.push(p === ED25519 ? "ed25519" : "computeBudget");
    } else if (p === SPL_TOKEN) {
      if (!TOKEN_OK.has(ix.data[0])) throw new PolicyError("only token approve/revoke are paid for");
      if (usesRelay) throw new PolicyError("the relay can't be a token authority");
      names.push("tokenApprove");
    } else if (p === ATA) {
      if (ix.data.length > 0 && !ATA_OK.has(ix.data[0])) throw new PolicyError("only token account creation is paid for");
      names.push("createTokenAccount");
    } else {
      throw new PolicyError(`program not allowed: ${p}`);
    }
  }
  if (kitty === 0 && !names.includes("tokenApprove")) throw new PolicyError("no Kitty instruction");
  return names;
}

export async function relayTransaction(base64: string, relay: KeyPairSigner, send: (wire: string) => Promise<void>): Promise<{ signature: string; instructions: string[] }> {
  const d = decodeWire(base64);
  const names = checkPolicy(d, relay.address);
  const signed = await partiallySignTransaction([relay.keyPair], d.tx);
  const missing = Object.entries(signed.signatures).filter(([, s]) => !s).map(([k]) => k);
  if (missing.length) throw new PolicyError(`missing signatures: ${missing.join(", ")}`);
  await send(getBase64EncodedWireTransaction(signed));
  return { signature: getSignatureFromTransaction(signed), instructions: names };
}

/** Fixed-window rate limiter (per IP / per wallet). */
export class RateLimiter {
  private hits = new Map<string, { n: number; at: number }>();
  constructor(private max: number, private windowMs: number) {}
  take(key: string): boolean {
    const now = Date.now();
    const h = this.hits.get(key);
    if (!h || now - h.at > this.windowMs) {
      this.hits.set(key, { n: 1, at: now });
      return true;
    }
    h.n++;
    return h.n <= this.max;
  }
}

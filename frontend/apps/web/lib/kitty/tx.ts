/**
 * Transactions (architecture 8.2 `tx`): build a v0 transaction with the relay as fee payer, sign
 * it with the member's party wallet on this device, and hand it to the relay, which adds its
 * signature and sends it. Then wait for confirmation on the public RPC.
 */
import {
  type Instruction,
  type Signature,
  appendTransactionMessageInstructions,
  address,
  createNoopSigner,
  createSolanaRpc,
  createTransactionMessage,
  getBase64EncodedWireTransaction,
  partiallySignTransactionMessageWithSigners,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  type Blockhash,
} from "@solana/kit";
import { getSetComputeUnitLimitInstruction } from "@solana-program/compute-budget";
import { ApiError, apiGet, apiSend, chainConfig } from "./api";

let rpcClient: ReturnType<typeof createSolanaRpc> | null = null;
export async function rpc() {
  if (!rpcClient) rpcClient = createSolanaRpc((await chainConfig()).rpc);
  return rpcClient;
}

export class TxError extends Error {
  constructor(
    message: string,
    public logs: string[] = [],
  ) {
    super(message);
  }
  /** The program's error name, if the logs carry one (e.g. "AlreadyJoined"). */
  get code(): string | null {
    for (const l of this.logs) {
      const m = l.match(/Error Code: (\w+)/);
      if (m) return m[1];
    }
    if (this.logs.some((l) => /already in use/.test(l))) return "AlreadyInUse";
    return null;
  }
}

export async function confirm(sig: Signature, timeoutMs = 75_000) {
  const r = await rpc();
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    const { value } = await r.getSignatureStatuses([sig]).send();
    const st = value[0];
    if (st?.err) throw new TxError("The transaction failed on-chain");
    if (st && (st.confirmationStatus === "confirmed" || st.confirmationStatus === "finalized")) return;
    await new Promise((res) => setTimeout(res, 900));
  }
  throw new TxError("Devnet is slow to confirm. Check again in a minute.");
}

/** Send instructions through the fee relay. Signers ride on the instructions' account metas. */
export async function relay(instructions: Instruction[], cuLimit = 300_000): Promise<Signature> {
  const cfg = await chainConfig();
  if (!cfg.relay) throw new TxError("The fee relay is offline");
  const bh = await apiGet<{ blockhash: string; lastValidBlockHeight: string }>("/v1/blockhash");
  const msg = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(createNoopSigner(address(cfg.relay!)), m),
    (m) => setTransactionMessageLifetimeUsingBlockhash({ blockhash: bh.blockhash as Blockhash, lastValidBlockHeight: BigInt(bh.lastValidBlockHeight) }, m),
    (m) => appendTransactionMessageInstructions([getSetComputeUnitLimitInstruction({ units: cuLimit }), ...instructions], m),
  );
  const tx = await partiallySignTransactionMessageWithSigners(msg);
  try {
    const { signature } = await apiSend<{ signature: string }>("/v1/relay", { transaction: getBase64EncodedWireTransaction(tx) });
    await confirm(signature as Signature);
    return signature as Signature;
  } catch (e) {
    if (e instanceof ApiError) throw new TxError(e.message, e.logs ?? []);
    throw e;
  }
}

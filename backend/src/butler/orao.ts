/**
 * ORAO VRF without the SDK: `request_v2(seed)` built by hand (orao-solana-vrf 0.7, RequestV2).
 * The program later reads the fulfilled `RandomnessV2` account for the same seed.
 */
import { createHash } from "node:crypto";
import { type Address, type Instruction, type TransactionSigner, AccountRole, getProgramDerivedAddress } from "@solana/kit";
import * as C from "@kitty/chain";
import { fetchAccountData } from "../chain";

const SYSTEM = "11111111111111111111111111111111" as Address;
const te = new TextEncoder();
const disc = (name: string) => createHash("sha256").update(`global:${name}`).digest().subarray(0, 8);

export async function networkState(): Promise<Address> {
  const [a] = await getProgramDerivedAddress({ programAddress: C.ORAO_VRF_ADDRESS, seeds: [te.encode("orao-vrf-network-configuration")] });
  return a;
}

/** The treasury lives at offset 8 (discriminator) + 32 (authority) of the network state. */
export async function oraoTreasury(): Promise<Address> {
  const d = await fetchAccountData(await networkState());
  if (!d) throw new Error("ORAO network state not found");
  const { getAddressDecoder } = await import("@solana/kit");
  return getAddressDecoder().decode(d.subarray(40, 72));
}

export async function requestRandomnessIx(payer: TransactionSigner, seed: Uint8Array): Promise<Instruction> {
  const data = new Uint8Array(8 + 32);
  data.set(disc("request_v2"), 0);
  data.set(seed, 8);
  return {
    programAddress: C.ORAO_VRF_ADDRESS,
    accounts: [
      { address: payer.address, role: AccountRole.WRITABLE_SIGNER, signer: payer } as never,
      { address: await networkState(), role: AccountRole.WRITABLE },
      { address: await oraoTreasury(), role: AccountRole.WRITABLE },
      { address: await C.oraoRandomnessPda(seed), role: AccountRole.WRITABLE },
      { address: SYSTEM, role: AccountRole.READONLY },
    ],
    data,
  };
}

/** "missing" | "pending" | "fulfilled" */
export async function randomnessState(seed: Uint8Array): Promise<"missing" | "pending" | "fulfilled"> {
  const d = await fetchAccountData(await C.oraoRandomnessPda(seed));
  if (!d) return "missing";
  return d[8] === 1 ? "fulfilled" : "pending";
}

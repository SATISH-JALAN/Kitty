/** Program-derived addresses (seeds in contracts/programs/kitty/src/constants.rs). */
import { type Address, getAddressEncoder, getProgramDerivedAddress, getU64Encoder } from "@solana/kit";
import { KITTY_PROGRAM_ADDRESS, ORAO_VRF_ADDRESS } from "./constants";

const te = new TextEncoder();
const addr = getAddressEncoder();
const u64 = getU64Encoder();

async function pda(seeds: (string | Uint8Array)[], program: Address = KITTY_PROGRAM_ADDRESS): Promise<Address> {
  const [a] = await getProgramDerivedAddress({ programAddress: program, seeds: seeds.map((s) => (typeof s === "string" ? te.encode(s) : s)) });
  return a;
}

export const configPda = () => pda(["config"]);
export const treePda = () => pda(["tree"]);
export const housePda = () => pda(["house"]);
export const houseVaultPda = () => pda(["house_vault"]);
export const partyPda = (id: bigint | number) => pda(["party", new Uint8Array(u64.encode(BigInt(id)))]);
export const vaultPda = (party: Address) => pda(["vault", new Uint8Array(addr.encode(party))]);
export const registrationPda = (nullifier: Uint8Array) => pda(["reg", nullifier]);
export const nullifierPda = (nullifier: Uint8Array) => pda(["nf", nullifier]);
export const vouchPda = (party: Address, memberIdx: number, voucher: Address) =>
  pda(["vouch", new Uint8Array(addr.encode(party)), Uint8Array.of(memberIdx), new Uint8Array(addr.encode(voucher))]);
export const sharePda = (owner: Address) => pda(["lp", new Uint8Array(addr.encode(owner))]);
/** ORAO's randomness account for a Draw seed. */
export const oraoRandomnessPda = (seed: Uint8Array) => pda(["orao-vrf-randomness-request", seed], ORAO_VRF_ADDRESS);

import { address } from "@solana/kit";
export { KITTY_PROGRAM_ADDRESS } from "./generated";

/** Same as contracts/programs/kitty/src/constants.rs. */
export const DEPTH = 26;
export const MAX_GUESTS = 20;
export const NO_WINNER = 255;

export const ORDER = { DRAW: 0, SEATING: 1 } as const;
export const PARTY_STATUS = { FORMING: 0, ACTIVE: 1, FINISHED: 2, CANCELLED: 3 } as const;
export const MEMBER_STATUS = { ACTIVE: 0, GRACE: 1, DEFAULTED: 2, REMOVED: 3, SETTLED: 4 } as const;
export const LEAF_KIND = { NOTE: 1, RECEIPT: 2, COMPLETION: 3 } as const;
export const HOUSE_FLOW = { FEE_IN: 0, COVER_OUT: 1, SETTLE_IN: 2, LATE_FEE: 3, DEPOSIT: 4, WITHDRAW: 5, SEAT_PAYOUT: 6, REIMBURSED: 7 } as const;

export const ORAO_VRF_ADDRESS = address("VRFzZoJdhFWL8rkvu87LpKM3RbcVezpMEc6X5GVDr7y");
export const ED25519_PROGRAM_ADDRESS = address("Ed25519SigVerify111111111111111111111111111");
export const INSTRUCTIONS_SYSVAR_ADDRESS = address("Sysvar1nstructions1111111111111111111111111");
export const TOKEN_PROGRAM_ADDRESS = address("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

/** Anon Aadhaar v2 test-key hash (devnet) and Kitty's nullifier seed ("kitty" as ASCII). */
export const AADHAAR_TEST_PUBKEY_HASH = 15134874015316324267425466444584014077184337590635665158241104437045239495873n;
export const KITTY_NULLIFIER_SEED = 0x6b69747479n;

/// <reference path="./shims.d.ts" />
/**
 * snarkjs Groth16 → the byte layout the program's verifier (groth16-solana) expects:
 * G1 = x‖y (32-byte big-endian), G2 = x.c1‖x.c0‖y.c1‖y.c0, and proof A negated.
 */
import type { Groth16Proof } from "snarkjs";
import { bigToBytes32 } from "./bytes";

const P = 21888242871839275222246405745257275088696311157297823662689037894645226208583n;
const cat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
};
const g1 = (p: string[]) => cat(bigToBytes32(p[0]), bigToBytes32(p[1]));
const g1neg = (p: string[]) => cat(bigToBytes32(p[0]), bigToBytes32((P - BigInt(p[1])) % P));
const g2 = (p: string[][]) => cat(bigToBytes32(p[0][1]), bigToBytes32(p[0][0]), bigToBytes32(p[1][1]), bigToBytes32(p[1][0]));

export interface SolanaProof {
  a: Uint8Array;
  b: Uint8Array;
  c: Uint8Array;
}

export function proofToSolana(proof: Groth16Proof): SolanaProof {
  return { a: g1neg(proof.pi_a), b: g2(proof.pi_b), c: g1(proof.pi_c) };
}

/** Action circuit public signals, decoded. */
export interface ActionSignals {
  nullifier: Uint8Array;
  outCommitment: Uint8Array;
  outTag: Uint8Array;
  outClaim: bigint;
  root: Uint8Array;
  now: bigint;
  paramsHash: Uint8Array;
  mode: number;
}

export function actionSignals(publicSignals: string[]): ActionSignals {
  const [nullifier, outCommitment, outTag, outClaim, root, now, paramsHash, mode] = publicSignals;
  return {
    nullifier: bigToBytes32(nullifier),
    outCommitment: bigToBytes32(outCommitment),
    outTag: bigToBytes32(outTag),
    outClaim: BigInt(outClaim),
    root: bigToBytes32(root),
    now: BigInt(now),
    paramsHash: bigToBytes32(paramsHash),
    mode: Number(mode),
  };
}

/** Anon Aadhaar v2 public signals the program needs. */
export interface AadhaarSignals {
  pubkeyHash: bigint;
  nullifier: Uint8Array;
  timestamp: bigint;
  signalHash: bigint;
}
export function aadhaarSignals(publicSignals: string[]): AadhaarSignals {
  return {
    pubkeyHash: BigInt(publicSignals[0]),
    nullifier: bigToBytes32(publicSignals[1]),
    timestamp: BigInt(publicSignals[2]),
    signalHash: BigInt(publicSignals[8]),
  };
}

// Witness tests for kitty_action.circom: one valid case per mode, and each invalid case must
// fail inside the circuit. Run `npm run compile` first.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import * as K from "../lib/kitty.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const builder = require(join(root, "build/kitty_action_js/witness_calculator.js"));
const wc = await builder(readFileSync(join(root, "build/kitty_action_js/kitty_action.wasm")));
await K.init();
const H = K.H;

/** Returns the public outputs [nullifier, outCommitment, outTag, outClaim], or throws. */
async function run(input) {
  const w = await wc.calculateWitness(input, true);
  return w.slice(1, 5).map(BigInt);
}

let passed = 0;
async function ok(name, input, check) {
  const out = await run(input);
  if (check) check(out);
  passed++;
  console.log(`  ok   ${name}`);
}
async function fails(name, input) {
  await assert.rejects(() => run(input), undefined, `${name} should fail`);
  passed++;
  console.log(`  ok   ${name} (rejected)`);
}

// ---------------------------------------------------------------- a world

const MIN = 60n;
const now = 1_790_000_000n;
const s = 123456789123456789n;
const wallet = K.walletSplit(Buffer.alloc(32, 7));
const other = K.walletSplit(Buffer.alloc(32, 9));
const c = 100_000_000n; // $100
const N = 10n;

function world({ completed = 3n, paid = 2000_000_000n, paidA = 4n, paidB = 2n } = {}) {
  const tree = new K.Tree();
  for (let i = 0; i < 7; i++) tree.append(H(99n, BigInt(i))); // other people's leaves
  const A = { party: 1001n, dueStart: now - 3n * 30n * MIN - 100n, period: 30n * MIN, rounds: 10n, active: 1n, unlocked: 300_000_000n };
  const B = { party: 1002n, dueStart: now - 1n * 7n * MIN - 10n, period: 7n * MIN, rounds: 6n, active: 1n, unlocked: 0n };
  const note = { s, completed, late: 0n, paid, slots: [A, B, K.emptySlot(), K.emptySlot()], nonce: K.nonceFor(s, 4n), k: 4n };
  tree.append(K.noteCommitment(note));
  const ra = tree.append(K.receiptLeaf(K.tagOf(s, 1001n), 1001n, paidA));
  const rb = tree.append(K.receiptLeaf(K.tagOf(s, 1002n), 1002n, paidB));
  return { tree, note, receipts: { 0: { paidThrough: paidA, index: ra }, 1: { paidThrough: paidB, index: rb } } };
}

const joinParams = (over = {}) => ({
  party: 2001n, grace: 2n * MIN, start: now + 3600n, period: 3n * MIN, rounds: N,
  unlockedByTier: K.unlockedByTier(c, N), minTier: 0n, allowance: 150_000_000n,
  wHi: wallet.hi, wLo: wallet.lo, ...over,
});

console.log("JOIN");
{
  const w = world();
  const params = joinParams();
  const o = { mode: K.MODE.JOIN, note: w.note, tree: w.tree, now, receipts: w.receipts, sel: [0, 0, 1, 0], params, newNonce: K.nonceFor(s, 5n) };
  await ok("valid join (tier 2, two active parties)", K.buildInput(o), ([nf, cm, tag, claim]) => {
    assert.equal(nf, K.nullifier(s, w.note.nonce));
    assert.equal(cm, K.noteCommitment(K.nextNote(o)));
    assert.equal(tag, K.tagOf(s, 2001n));
    assert.equal(claim, 2n);
  });

  // the first RSVP after registration: a fresh note, no receipts
  const t = new K.Tree();
  const fresh = K.freshNote(s);
  t.append(K.noteCommitment(fresh));
  const o2 = { mode: K.MODE.JOIN, note: fresh, tree: t, now, sel: [1, 0, 0, 0], params: joinParams({ allowance: 150_000_000n }), newNonce: K.nonceFor(s, 1n) };
  await ok("valid join from a fresh Guest Pass (tier 0)", K.buildInput(o2), ([, , , claim]) => assert.equal(claim, 0n));

  const mr = world({ paidA: 3n });
  await fails("missing receipt", K.buildInput({ ...o, note: mr.note, tree: mr.tree, receipts: mr.receipts }));

  const lt = world({ completed: 1n });
  await fails("tier too low for the gate", K.buildInput({ ...o, note: lt.note, tree: lt.tree, receipts: lt.receipts, params: joinParams({ minTier: 2n }) }));

  const ol = world({ paid: 0n });
  await fails("over the kitty limit", K.buildInput({ ...o, note: ol.note, tree: ol.tree, receipts: ol.receipts, params: joinParams({ allowance: 10_000_000n }) }));

  await fails("already in the party", K.buildInput({ ...o, params: joinParams({ party: 1001n }) }));
  await fails("selects an occupied slot", K.buildInput({ ...o, sel: [1, 0, 0, 0] }));
  await fails("wrong mode", { ...K.buildInput(o), mode: "3" });
  await fails("params hash for another wallet (front-run replay)", K.buildInput({ ...o, paramsHashOverride: K.paramsJoin(joinParams({ wHi: other.hi, wLo: other.lo })) }));
  await fails("params hash mismatch (different chip-in schedule)", K.buildInput({ ...o, paramsHashOverride: K.paramsJoin(joinParams({ period: 4n * MIN })) }));
  await fails("note not in this root", { ...K.buildInput(o), root: "12345" });
}

console.log("COMPLETE");
{
  const tree = new K.Tree();
  const P = 3001n;
  const slot = { party: P, dueStart: now - 40n * MIN, period: 3n * MIN, rounds: 10n, active: 1n, unlocked: 100_000_000n };
  const note = { s, completed: 0n, late: 0n, paid: 0n, slots: [K.emptySlot(), slot, K.emptySlot(), K.emptySlot()], nonce: K.nonceFor(s, 2n), k: 2n };
  tree.append(K.noteCommitment(note));
  const ci = tree.append(K.completionLeaf(K.tagOf(s, P), P, 10n, 1n, c));
  const params = { party: P, chipIn: c, rounds: 10n, wHi: wallet.hi, wLo: wallet.lo };
  const o = { mode: K.MODE.COMPLETE, note, tree, now, sel: [0, 1, 0, 0], params, completion: { paidRounds: 10n, lateCount: 1n, index: ci }, newNonce: K.nonceFor(s, 3n) };
  await ok("valid farewell (10/10 paid, one late)", K.buildInput(o), ([nf, cm, tag, claim]) => {
    const next = K.nextNote(o);
    assert.equal(next.completed, 1n);
    assert.equal(next.paid, 1000_000_000n);
    assert.equal(cm, K.noteCommitment(next));
    assert.equal(nf, K.nullifier(s, note.nonce));
    assert.equal(tag, K.tagOf(s, P));
    assert.equal(claim, 0n);
  });

  // a removed guest's release: 6/10 paid, frees the slot without raising the count
  const ri = tree.append(K.completionLeaf(K.tagOf(s, P), P, 6n, 0n, c));
  const o2 = { ...o, tree, completion: { paidRounds: 6n, lateCount: 0n, index: ri } };
  await ok("release (6/10) frees the slot, completed unchanged", K.buildInput(o2), ([, cm]) => {
    assert.equal(K.nextNote(o2).completed, 0n);
    assert.equal(cm, K.noteCommitment(K.nextNote(o2)));
  });

  await fails("completion leaf for another party", K.buildInput({ ...o, params: { ...params, party: 3002n } }));
  await fails("claims more rounds than the leaf", K.buildInput({ ...o, completion: { paidRounds: 9n, lateCount: 1n, index: ci } }));
  await fails("selects an empty slot", K.buildInput({ ...o, sel: [1, 0, 0, 0] }));
}

console.log("HISTORY");
{
  const w = world({ completed: 3n, paid: 1500_000_000n });
  const params = { minCompleted: 3n, minPaid: 1000_000_000n, maxLate: 0n, scope: 4242n, challenge: 777n };
  const o = { mode: K.MODE.HISTORY, note: w.note, tree: w.tree, now, receipts: w.receipts, params };
  await ok("valid page: â‰¥3 parties, â‰¥$1,000, never late", K.buildInput(o), ([nf, cm, tag, claim]) => {
    assert.equal(nf, K.nullifier(s, w.note.nonce));
    assert.equal(cm, 0n);
    assert.equal(tag, K.pseudonym(s, 4242n));
    assert.equal(claim, 1n);
  });
  await fails("claims more parties than completed", K.buildInput({ ...o, params: { ...params, minCompleted: 4n } }));
  const mr = world({ paidA: 3n });
  await fails("not in good standing (missing receipt)", K.buildInput({ ...o, note: mr.note, tree: mr.tree, receipts: mr.receipts }));
  await fails("selects a slot", K.buildInput({ ...o, sel: [0, 0, 1, 0] }));
}

console.log(`\n${passed} witness checks passed`);

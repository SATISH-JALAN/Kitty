pragma circom 2.1.9;

// Kitty action circuit (architecture 5.2). One circuit, three modes, one verifying key.
//
//   mode 0 JOIN     (RSVP)        spend the note, prove good standing + tier gate + kitty limit,
//                                 add the party to a free slot
//   mode 1 COMPLETE (Farewell)    spend the note, prove a completion leaf for one of its parties,
//                                 free that slot and add the party to the history counters
//   mode 2 HISTORY  (Show a page) prove the current note is in good standing and meets a claim;
//                                 the nullifier is shown (checked unspent) but not consumed
//
// Public signals, in order: [nullifier, outCommitment, outTag, outClaim, root, now, paramsHash, mode].
// Every party-specific value is private and bound by paramsHash, which the program (or a verifier)
// recomputes from the party's real parameters, so a proof is only valid for that party, that
// wallet, or that verifier's challenge.
//
// Leaf formats (H = Poseidon, circomlib parameters):
//   slot       = H(party, dueStart, period, rounds, active, unlocked)   dueStart = start + grace
//   note       = H(1, s, H(completed, late, paid, slot_1..slot_4), nonce)
//   receipt    = H(2, tag, party, paidThrough)
//   completion = H(3, tag, party, H(paidRounds, lateCount, c))
//   nullifier  = H(s, nonce)        tag = H(s, party)        pseudonym = H(s, scope)

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/comparators.circom";

template MerkleRoot(D) {
    signal input leaf;
    signal input pathElements[D];
    signal input pathIndices[D];
    signal output root;

    signal cur[D + 1];
    signal left[D];
    signal right[D];
    component h[D];
    cur[0] <== leaf;
    for (var i = 0; i < D; i++) {
        pathIndices[i] * (1 - pathIndices[i]) === 0;
        left[i] <== cur[i] + pathIndices[i] * (pathElements[i] - cur[i]);
        right[i] <== pathElements[i] + pathIndices[i] * (cur[i] - pathElements[i]);
        h[i] = Poseidon(2);
        h[i].inputs[0] <== left[i];
        h[i].inputs[1] <== right[i];
        cur[i + 1] <== h[i].out;
    }
    root <== cur[D];
}

// Rounds that must already be paid for one active party at time `now`.
// Round r (1-based) is due at start + (r - 1) * period and must be paid by dueStart + (r - 1) * period.
template DueRounds() {
    signal input now;
    signal input dueStart;
    signal input period;   // > 0 (empty slots are given period 1)
    signal input rounds;
    signal output due;

    component past = GreaterEqThan(64);
    past.in[0] <== now;
    past.in[1] <== dueStart;

    signal elapsed;
    elapsed <== past.out * (now - dueStart);

    signal q;
    q <-- elapsed \ period;
    component lo = LessEqThan(64);
    lo.in[0] <== q * period;
    lo.in[1] <== elapsed;
    lo.out === 1;
    component hi = LessThan(64);
    hi.in[0] <== elapsed;
    hi.in[1] <== (q + 1) * period;
    hi.out === 1;

    // min(q + 1, rounds)
    component lt = LessThan(64);
    lt.in[0] <== q + 1;
    lt.in[1] <== rounds + 1;
    signal capped;
    capped <== lt.out * (q + 1 - rounds) + rounds;
    due <== past.out * capped;
}

template KittyAction(D, K) {
    var NOTE_DOMAIN = 1;
    var RECEIPT_DOMAIN = 2;
    var COMPLETION_DOMAIN = 3;

    // ---------- public inputs ----------
    signal input root;
    signal input now;
    signal input paramsHash;
    signal input mode;

    // ---------- public outputs ----------
    signal output nullifier;
    signal output outCommitment;
    signal output outTag;
    signal output outClaim;

    // ---------- private: the note ----------
    signal input s;
    signal input completed;
    signal input late;
    signal input lifetimePaid;
    signal input oldNonce;
    signal input newNonce;
    signal input slotParty[K];
    signal input slotDueStart[K];
    signal input slotPeriod[K];
    signal input slotRounds[K];
    signal input slotActive[K];
    signal input slotUnlocked[K];
    signal input notePath[D];
    signal input noteIdx[D];
    signal input rcptPaid[K];
    signal input rcptPath[K][D];
    signal input rcptIdx[K][D];
    signal input sel[K];

    // ---------- private: action parameters (bound by paramsHash) ----------
    signal input party;          // JOIN, COMPLETE
    signal input wHi;            // JOIN, COMPLETE: signing party wallet, high 16 bytes
    signal input wLo;            //                 low 16 bytes
    signal input grace;          // JOIN
    signal input start;          // JOIN
    signal input period;         // JOIN
    signal input rounds;         // JOIN, COMPLETE
    signal input unlockedByTier[3]; // JOIN: worst-case unlocked obligation if seated at the tier's earliest seat
    signal input minTier;        // JOIN
    signal input allowance;      // JOIN: starter kitty limit
    signal input chipIn;         // COMPLETE
    signal input paidRounds;     // COMPLETE (from the completion leaf)
    signal input lateCount;      // COMPLETE (from the completion leaf)
    signal input compPath[D];    // COMPLETE
    signal input compIdx[D];     // COMPLETE
    signal input minCompleted;   // HISTORY: k
    signal input minPaid;        // HISTORY: X
    signal input maxLate;        // HISTORY
    signal input scope;          // HISTORY
    signal input challenge;      // HISTORY

    // ---------- mode ----------
    component isJ = IsZero();
    isJ.in <== mode;
    component isC = IsEqual();
    isC.in[0] <== mode;
    isC.in[1] <== 1;
    component isH = IsEqual();
    isH.in[0] <== mode;
    isH.in[1] <== 2;
    signal isJoin <== isJ.out;
    signal isComplete <== isC.out;
    signal isHistory <== isH.out;
    isJoin + isComplete + isHistory === 1;

    // ---------- params hash ----------
    component hJ = Poseidon(12);
    hJ.inputs[0] <== grace;
    hJ.inputs[1] <== party;
    hJ.inputs[2] <== start;
    hJ.inputs[3] <== period;
    hJ.inputs[4] <== rounds;
    hJ.inputs[5] <== unlockedByTier[0];
    hJ.inputs[6] <== unlockedByTier[1];
    hJ.inputs[7] <== unlockedByTier[2];
    hJ.inputs[8] <== minTier;
    hJ.inputs[9] <== allowance;
    hJ.inputs[10] <== wHi;
    hJ.inputs[11] <== wLo;
    component hC = Poseidon(5);
    hC.inputs[0] <== party;
    hC.inputs[1] <== chipIn;
    hC.inputs[2] <== rounds;
    hC.inputs[3] <== wHi;
    hC.inputs[4] <== wLo;
    component hH = Poseidon(5);
    hH.inputs[0] <== minCompleted;
    hH.inputs[1] <== minPaid;
    hH.inputs[2] <== maxLate;
    hH.inputs[3] <== scope;
    hH.inputs[4] <== challenge;
    signal pJ <== isJoin * hJ.out;
    signal pC <== isComplete * hC.out;
    signal pH <== isHistory * hH.out;
    paramsHash === pJ + pC + pH;

    // ---------- old note ----------
    component slotHash[K];
    for (var k = 0; k < K; k++) {
        slotActive[k] * (1 - slotActive[k]) === 0;
        (1 - slotActive[k]) * slotPeriod[k] === 0;   // empty slots are all-zero
        slotHash[k] = Poseidon(6);
        slotHash[k].inputs[0] <== slotParty[k];
        slotHash[k].inputs[1] <== slotDueStart[k];
        slotHash[k].inputs[2] <== slotPeriod[k];
        slotHash[k].inputs[3] <== slotRounds[k];
        slotHash[k].inputs[4] <== slotActive[k];
        slotHash[k].inputs[5] <== slotUnlocked[k];
    }
    component state = Poseidon(3 + K);
    state.inputs[0] <== completed;
    state.inputs[1] <== late;
    state.inputs[2] <== lifetimePaid;
    for (var k = 0; k < K; k++) state.inputs[3 + k] <== slotHash[k].out;

    component oldCm = Poseidon(4);
    oldCm.inputs[0] <== NOTE_DOMAIN;
    oldCm.inputs[1] <== s;
    oldCm.inputs[2] <== state.out;
    oldCm.inputs[3] <== oldNonce;

    component noteRoot = MerkleRoot(D);
    noteRoot.leaf <== oldCm.out;
    for (var i = 0; i < D; i++) {
        noteRoot.pathElements[i] <== notePath[i];
        noteRoot.pathIndices[i] <== noteIdx[i];
    }
    noteRoot.root === root;

    component nf = Poseidon(2);
    nf.inputs[0] <== s;
    nf.inputs[1] <== oldNonce;
    nullifier <== nf.out;

    // ---------- good standing (JOIN, HISTORY): a receipt for every due round of every active party ----------
    signal needStanding <== 1 - isComplete;
    component tag[K];
    component leaf[K];
    component rRoot[K];
    component due[K];
    component paidEnough[K];
    component sameParty[K];
    signal periodEff[K];
    signal checkK[K];
    signal joinActive[K];
    signal unlockedActive[K];
    for (var k = 0; k < K; k++) {
        tag[k] = Poseidon(2);
        tag[k].inputs[0] <== s;
        tag[k].inputs[1] <== slotParty[k];

        leaf[k] = Poseidon(4);
        leaf[k].inputs[0] <== RECEIPT_DOMAIN;
        leaf[k].inputs[1] <== tag[k].out;
        leaf[k].inputs[2] <== slotParty[k];
        leaf[k].inputs[3] <== rcptPaid[k];

        rRoot[k] = MerkleRoot(D);
        rRoot[k].leaf <== leaf[k].out;
        for (var i = 0; i < D; i++) {
            rRoot[k].pathElements[i] <== rcptPath[k][i];
            rRoot[k].pathIndices[i] <== rcptIdx[k][i];
        }
        checkK[k] <== needStanding * slotActive[k];
        checkK[k] * (rRoot[k].root - root) === 0;

        periodEff[k] <== slotPeriod[k] + 1 - slotActive[k];
        due[k] = DueRounds();
        due[k].now <== now;
        due[k].dueStart <== slotDueStart[k];
        due[k].period <== periodEff[k];
        due[k].rounds <== slotRounds[k];

        paidEnough[k] = GreaterEqThan(32);
        paidEnough[k].in[0] <== rcptPaid[k];
        paidEnough[k].in[1] <== due[k].due;
        checkK[k] * (1 - paidEnough[k].out) === 0;

        // JOIN: cannot join a party you are already in
        sameParty[k] = IsEqual();
        sameParty[k].in[0] <== slotParty[k];
        sameParty[k].in[1] <== party;
        joinActive[k] <== isJoin * slotActive[k];
        joinActive[k] * sameParty[k].out === 0;

        unlockedActive[k] <== slotActive[k] * slotUnlocked[k];
    }

    // ---------- tier ----------
    component ge1 = GreaterEqThan(32);
    ge1.in[0] <== completed;
    ge1.in[1] <== 1;
    component ge3 = GreaterEqThan(32);
    ge3.in[0] <== completed;
    ge3.in[1] <== 3;
    signal tier <== ge1.out + ge3.out;

    // JOIN: tier gate
    component tierOk = GreaterEqThan(8);
    tierOk.in[0] <== tier;
    tierOk.in[1] <== minTier;
    isJoin * (1 - tierOk.out) === 0;

    // JOIN: kitty limit (exposure cap): 2 * unlocked <= lifetimePaid + 2 * allowance
    signal u0 <== unlockedByTier[0] * (1 - ge1.out);
    signal u1 <== unlockedByTier[1] * (ge1.out - ge3.out);
    signal u2 <== unlockedByTier[2] * ge3.out;
    signal joinUnlocked <== u0 + u1 + u2;
    signal sumUnlocked[K + 1];
    sumUnlocked[0] <== joinUnlocked;
    for (var k = 0; k < K; k++) sumUnlocked[k + 1] <== sumUnlocked[k] + unlockedActive[k];
    component capOk = LessEqThan(64);
    capOk.in[0] <== 2 * sumUnlocked[K];
    capOk.in[1] <== lifetimePaid + 2 * allowance;
    isJoin * (1 - capOk.out) === 0;

    // ---------- COMPLETE: the completion leaf ----------
    component ctag = Poseidon(2);
    ctag.inputs[0] <== s;
    ctag.inputs[1] <== party;
    component cSummary = Poseidon(3);
    cSummary.inputs[0] <== paidRounds;
    cSummary.inputs[1] <== lateCount;
    cSummary.inputs[2] <== chipIn;
    component cLeaf = Poseidon(4);
    cLeaf.inputs[0] <== COMPLETION_DOMAIN;
    cLeaf.inputs[1] <== ctag.out;
    cLeaf.inputs[2] <== party;
    cLeaf.inputs[3] <== cSummary.out;
    component cRoot = MerkleRoot(D);
    cRoot.leaf <== cLeaf.out;
    for (var i = 0; i < D; i++) {
        cRoot.pathElements[i] <== compPath[i];
        cRoot.pathIndices[i] <== compIdx[i];
    }
    isComplete * (cRoot.root - root) === 0;

    // A party counts as completed when every round was paid with at most one late chip-in.
    component allPaid = IsEqual();
    allPaid.in[0] <== paidRounds;
    allPaid.in[1] <== rounds;
    component fewLate = LessEqThan(32);
    fewLate.in[0] <== lateCount;
    fewLate.in[1] <== 1;
    signal full <== allPaid.out * fewLate.out;

    // ---------- slot selection ----------
    // JOIN picks one empty slot; COMPLETE picks the active slot holding `party`; HISTORY picks none.
    signal selSum[K + 1];
    signal selC[K];
    selSum[0] <== 0;
    for (var k = 0; k < K; k++) {
        sel[k] * (1 - sel[k]) === 0;
        sel[k] * (slotActive[k] - isComplete) === 0;
        selC[k] <== sel[k] * isComplete;
        selC[k] * (slotParty[k] - party) === 0;
        selSum[k + 1] <== selSum[k] + sel[k];
    }
    selSum[K] === isJoin + isComplete;

    // ---------- new note ----------
    // JOIN writes the party into the selected slot; COMPLETE clears it.
    signal tParty <== isJoin * party;
    signal tDueStart <== isJoin * (start + grace);
    signal tPeriod <== isJoin * period;
    signal tRounds <== isJoin * rounds;
    signal tUnlocked <== isJoin * joinUnlocked;
    signal nParty[K];
    signal nDueStart[K];
    signal nPeriod[K];
    signal nRounds[K];
    signal nActive[K];
    signal nUnlocked[K];
    component newSlotHash[K];
    for (var k = 0; k < K; k++) {
        nParty[k] <== slotParty[k] + sel[k] * (tParty - slotParty[k]);
        nDueStart[k] <== slotDueStart[k] + sel[k] * (tDueStart - slotDueStart[k]);
        nPeriod[k] <== slotPeriod[k] + sel[k] * (tPeriod - slotPeriod[k]);
        nRounds[k] <== slotRounds[k] + sel[k] * (tRounds - slotRounds[k]);
        nActive[k] <== slotActive[k] + sel[k] * (isJoin - slotActive[k]);
        nUnlocked[k] <== slotUnlocked[k] + sel[k] * (tUnlocked - slotUnlocked[k]);
        newSlotHash[k] = Poseidon(6);
        newSlotHash[k].inputs[0] <== nParty[k];
        newSlotHash[k].inputs[1] <== nDueStart[k];
        newSlotHash[k].inputs[2] <== nPeriod[k];
        newSlotHash[k].inputs[3] <== nRounds[k];
        newSlotHash[k].inputs[4] <== nActive[k];
        newSlotHash[k].inputs[5] <== nUnlocked[k];
    }

    signal incCompleted <== isComplete * full;
    signal incLate <== isComplete * lateCount;
    signal paidSum <== paidRounds * chipIn;
    signal incPaid <== isComplete * paidSum;

    component newState = Poseidon(3 + K);
    newState.inputs[0] <== completed + incCompleted;
    newState.inputs[1] <== late + incLate;
    newState.inputs[2] <== lifetimePaid + incPaid;
    for (var k = 0; k < K; k++) newState.inputs[3 + k] <== newSlotHash[k].out;

    component newCm = Poseidon(4);
    newCm.inputs[0] <== NOTE_DOMAIN;
    newCm.inputs[1] <== s;
    newCm.inputs[2] <== newState.out;
    newCm.inputs[3] <== newNonce;
    outCommitment <== (1 - isHistory) * newCm.out;

    // ---------- HISTORY: the claim ----------
    component hasCompleted = GreaterEqThan(32);
    hasCompleted.in[0] <== completed;
    hasCompleted.in[1] <== minCompleted;
    isHistory * (1 - hasCompleted.out) === 0;
    component hasPaid = GreaterEqThan(64);
    hasPaid.in[0] <== lifetimePaid;
    hasPaid.in[1] <== minPaid;
    isHistory * (1 - hasPaid.out) === 0;
    component lateOk = LessEqThan(32);
    lateOk.in[0] <== late;
    lateOk.in[1] <== maxLate;
    isHistory * (1 - lateOk.out) === 0;

    // ---------- outputs ----------
    // outTag: the party tag (JOIN, COMPLETE) or the verifier-scoped pseudonym (HISTORY).
    component outT = Poseidon(2);
    outT.inputs[0] <== s;
    outT.inputs[1] <== party + isHistory * (scope - party);
    outTag <== outT.out;
    // outClaim: the tier (JOIN), 0 (COMPLETE), 1 = claim holds (HISTORY).
    signal claimJ <== isJoin * tier;
    outClaim <== claimJ + isHistory;
}

component main { public [root, now, paramsHash, mode] } = KittyAction(26, 4);

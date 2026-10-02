//! Hash parity with the circuit and the app: circuits/vectors/parity.json.
use crate::{math, zk};
use anchor_lang::prelude::Pubkey;
use serde_json::Value;

fn vectors() -> Value {
    serde_json::from_str(include_str!("../../../../circuits/vectors/parity.json")).unwrap()
}
fn h32(v: &Value) -> [u8; 32] {
    let s = v.as_str().unwrap();
    let mut out = [0u8; 32];
    for i in 0..32 {
        out[i] = u8::from_str_radix(&s[2 * i..2 * i + 2], 16).unwrap();
    }
    out
}
fn u(v: &Value) -> u64 {
    v.as_str().unwrap().parse().unwrap()
}

#[test]
fn poseidon_and_leaves() {
    let v = vectors();
    assert_eq!(zk::poseidon(&[&zk::fe(1), &zk::fe(2)]).unwrap(), h32(&v["poseidon2"]["out"]));
    let tag = h32(&v["receipt"]["tag"]);
    assert_eq!(zk::receipt_leaf(&tag, 7, 4).unwrap(), h32(&v["receipt"]["leaf"]));
    assert_eq!(zk::completion_leaf(&tag, 7, 10, 1, 100_000_000).unwrap(), h32(&v["completion"]["leaf"]));
}

#[test]
fn params_hashes() {
    let v = vectors();
    let mut b = [0u8; 32];
    for (i, x) in b.iter_mut().enumerate() {
        *x = i as u8 + 1;
    }
    let wallet = Pubkey::new_from_array(b);
    let (hi, lo) = zk::wallet_split(&wallet);
    assert_eq!(hi, h32(&v["wallet"]["hi"]));
    assert_eq!(lo, h32(&v["wallet"]["lo"]));
    let j = &v["paramsJoin"];
    let ub = math::unlocked_by_tier(100_000_000, 10);
    assert_eq!(ub.to_vec(), j["unlockedByTier"].as_array().unwrap().iter().map(u).collect::<Vec<_>>());
    let p = zk::JoinParams {
        grace: u(&j["grace"]),
        party: u(&j["party"]),
        start: u(&j["start"]),
        period: u(&j["period"]),
        rounds: u(&j["rounds"]),
        unlocked_by_tier: ub,
        min_tier: u(&j["minTier"]),
        allowance: u(&j["allowance"]),
    };
    assert_eq!(zk::params_join(&p, &wallet).unwrap(), h32(&j["hash"]));
    assert_eq!(zk::params_complete(7, 100_000_000, 10, &wallet).unwrap(), h32(&v["paramsComplete"]["hash"]));
    assert_eq!(
        zk::params_history(3, 1_000_000_000, 0, &zk::fe(4242), &zk::fe(777)).unwrap(),
        h32(&v["paramsHistory"]["hash"])
    );
}

#[test]
fn tree_roots() {
    let v = vectors();
    let mut t: crate::state::KittyTree = bytemuck::Zeroable::zeroed();
    t.init().unwrap();
    for (i, z) in v["zeros"].as_array().unwrap().iter().enumerate() {
        assert_eq!(t.zeros[i], h32(z), "zero {i}");
    }
    let leaves = v["tree"]["leaves"].as_array().unwrap();
    let roots = v["tree"]["roots"].as_array().unwrap();
    for (l, r) in leaves.iter().zip(roots) {
        t.append(h32(l), 1).unwrap();
        assert_eq!(t.roots[t.root_index as usize], h32(r));
        assert!(t.is_known_root(&h32(r)));
    }
}

#[test]
fn aadhaar_signal() {
    // anon-aadhaar `hash(987654321)` from the T3 run (public signal 8).
    let cm = zk::fe(987_654_321);
    let expected = "3787716705958194154358915451111987254072699763198788328076378568661496983999";
    let got = zk::aadhaar_signal_hash(&cm);
    assert_eq!(dec(&got), expected);
}

fn dec(b: &[u8; 32]) -> String {
    // big-endian bytes → decimal string
    let mut digits = vec![0u8];
    for &byte in b {
        let mut carry = byte as u32;
        for d in digits.iter_mut() {
            let x = *d as u32 * 256 + carry;
            *d = (x % 10) as u8;
            carry = x / 10;
        }
        while carry > 0 {
            digits.push((carry % 10) as u8);
            carry /= 10;
        }
    }
    digits.iter().rev().map(|d| (b'0' + d) as char).collect()
}

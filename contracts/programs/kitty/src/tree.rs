//! The Kitty tree: incremental Poseidon Merkle tree, empty leaf 0 (same as circuits/lib/kitty.mjs).
use crate::{constants::*, error::KittyError, events::LeafAppended, state::KittyTree, zk::poseidon};
use anchor_lang::prelude::*;

impl KittyTree {
    pub fn init(&mut self) -> Result<()> {
        self.zeros[0] = [0u8; 32];
        for i in 0..DEPTH {
            self.zeros[i + 1] = poseidon(&[&self.zeros[i], &self.zeros[i]])?;
            self.filled[i] = self.zeros[i];
        }
        self.roots[0] = self.zeros[DEPTH];
        self.next_index = 0;
        self.root_index = 0;
        Ok(())
    }

    pub fn is_known_root(&self, root: &[u8; 32]) -> bool {
        root != &[0u8; 32] && self.roots.iter().any(|r| r == root)
    }

    /// Append a leaf, record the new root, and emit `LeafAppended`.
    pub fn append(&mut self, leaf: [u8; 32], kind: u8) -> Result<u64> {
        let index = self.next_index;
        require!(index < (1u64 << DEPTH), KittyError::TreeFull);
        let mut cur = leaf;
        let mut idx = index;
        for i in 0..DEPTH {
            if idx & 1 == 0 {
                self.filled[i] = cur;
                cur = poseidon(&[&cur, &self.zeros[i]])?;
            } else {
                cur = poseidon(&[&self.filled[i], &cur])?;
            }
            idx >>= 1;
        }
        self.root_index = (self.root_index + 1) % ROOT_RING as u64;
        self.roots[self.root_index as usize] = cur;
        self.next_index = index + 1;
        emit!(LeafAppended { index, leaf, kind, root: cur });
        Ok(index)
    }
}

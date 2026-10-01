/**
 * Party names: the party-scoped tag rendered for humans (product doc 17.3, brief 6.2).
 * colour = tag[0..3] mod 16, animal = tag[4..7] mod 12. A clash inside one party
 * re-rolls deterministically with salt +1.
 */
import { fnv1a } from "./rng";

export const MASK_COLOURS = [
  { name: "Marigold", hex: "#F4A300" },
  { name: "Saffron", hex: "#E4572E" },
  { name: "Indigo", hex: "#2E3A7A" },
  { name: "Plum", hex: "#4E2152" },
  { name: "Moss", hex: "#5E7A3A" },
  { name: "Rose", hex: "#C75B7A" },
  { name: "Teal", hex: "#1F8A80" },
  { name: "Ochre", hex: "#C28A2C" },
  { name: "Clay", hex: "#B5553C" },
  { name: "Ivory", hex: "#EFE3C8" },
  { name: "Jade", hex: "#3E8E6E" },
  { name: "Dusk", hex: "#6A4C8C" },
  { name: "Cobalt", hex: "#2F5DA8" },
  { name: "Ember", hex: "#C2452D" },
  { name: "Sand", hex: "#D9B98A" },
  { name: "Midnight", hex: "#1E2440" },
] as const;

export const MASK_ANIMALS = [
  "Parrot",
  "Heron",
  "Owl",
  "Fox",
  "Tiger",
  "Peacock",
  "Hare",
  "Crane",
  "Lynx",
  "Moth",
  "Stag",
  "Koi",
] as const;

export type MaskAnimal = (typeof MASK_ANIMALS)[number];

export interface MaskIdentity {
  colour: number;
  animal: number;
  name: string;
  hex: string;
}

function u32(bytes: Uint8Array, at: number): number {
  return ((bytes[at] << 24) | (bytes[at + 1] << 16) | (bytes[at + 2] << 8) | bytes[at + 3]) >>> 0;
}

export function identityFromIndices(colour: number, animal: number): MaskIdentity {
  const c = MASK_COLOURS[colour % 16];
  return { colour: colour % 16, animal: animal % 12, name: `${c.name} ${MASK_ANIMALS[animal % 12]}`, hex: c.hex };
}

/** Deterministic mask identity for a tag, avoiding names already taken in the same party. */
export function partyName(tag: Uint8Array, taken: ReadonlySet<string> = new Set()): MaskIdentity {
  let colour = u32(tag, 0) % 16;
  let animal = u32(tag, 4) % 12;
  let id = identityFromIndices(colour, animal);
  for (let salt = 1; taken.has(id.name) && salt < 256; salt++) {
    const h = fnv1a(tag, 0x811c9dc5 ^ salt);
    colour = h % 16;
    animal = (h >>> 8) % 12;
    id = identityFromIndices(colour, animal);
  }
  return id;
}

/** Look up a scripted name such as "Marigold Parrot" (landing scenes use fixed guests). */
export function identityFromName(name: string): MaskIdentity {
  const [cName, aName] = name.split(" ");
  const colour = MASK_COLOURS.findIndex((c) => c.name === cName);
  const animal = MASK_ANIMALS.findIndex((a) => a === aName);
  if (colour < 0 || animal < 0) throw new Error(`Unknown party name: ${name}`);
  return identityFromIndices(colour, animal);
}

/** Party emblem colour from the party id (brief 6.3). */
export function emblemColour(partyId: string | number): (typeof MASK_COLOURS)[number] {
  const h = fnv1a(new TextEncoder().encode(String(partyId)), 0x2545f491);
  return MASK_COLOURS[h % 16];
}

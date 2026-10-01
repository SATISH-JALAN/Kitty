/** The seven traditions of the Paper Masquerade (brief 2.2, product doc 2 and 17.3). */

export const TRADITIONS = [
  { key: "kitty", word: "kitty party", alt: "committee", city: "Delhi", region: "India · Pakistan", place: "DELHI, INDIA", accent: "saffron" },
  { key: "tanda", word: "tanda", city: "Mexico City", region: "Mexico · Latin America", place: "MEXICO CITY, MEXICO", accent: "marigold" },
  { key: "susu", word: "susu", city: "Accra", region: "Ghana · West Africa", place: "ACCRA, GHANA", accent: "marigold" },
  { key: "paluwagan", word: "paluwagan", city: "Manila", region: "Philippines", place: "MANILA, PHILIPPINES", accent: "teal-night" },
  { key: "arisan", word: "arisan", city: "Jakarta", region: "Indonesia", place: "JAKARTA, INDONESIA", accent: "saffron" },
  { key: "chama", word: "chama", city: "Nairobi", region: "Kenya", place: "NAIROBI, KENYA", accent: "marigold" },
  { key: "ajo", word: "ajo", alt: "esusu", city: "Lagos", region: "Nigeria", place: "LAGOS, NIGERIA", accent: "plum" },
] as const;

export type TraditionKey = (typeof TRADITIONS)[number]["key"];

export const TRADITION_KEYS = TRADITIONS.map((t) => t.key) as TraditionKey[];

export function tradition(key: TraditionKey) {
  return TRADITIONS.find((t) => t.key === key)!;
}

/** Words a host can pick in the wizard (product doc 17.3); "committee" maps to the kitty pattern. */
export const HOST_WORDS: { word: string; pattern: TraditionKey }[] = [
  { word: "kitty party", pattern: "kitty" },
  { word: "committee", pattern: "kitty" },
  { word: "tanda", pattern: "tanda" },
  { word: "susu", pattern: "susu" },
  { word: "paluwagan", pattern: "paluwagan" },
  { word: "arisan", pattern: "arisan" },
  { word: "chama", pattern: "chama" },
  { word: "ajo", pattern: "ajo" },
];

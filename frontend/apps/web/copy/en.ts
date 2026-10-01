/**
 * Every user-facing string (brief 14). Party words in the festive layer, plain words
 * at money (1.2). Never: guaranteed, insured, interest, returns, yield, jackpot, lucky,
 * win/winner/won, chit fund, investment, deposit, APY, earn (0.4) — checked by
 * scripts/copy-lint.mjs.
 */

/** Interpolate `{name}` placeholders. */
export function t(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}

export const copy = {
  cta: {
    pass: "Get your Guest Pass",
    howItWorks: "See how a party works",
    chipIn: "Chip in now",
    rsvp: "RSVP & chip in {amount}",
    settleUp: "Settle up {amount}",
    startParty: "Start a party",
    watchDraw: "Watch the Draw",
    showPage: "Make this page",
    readDocs: "Read how Kitty works",
    openInvite: "Open an invite",
    goTonight: "Go to Tonight",
    goParty: "Go to the party",
    backToParty: "Back to the party",
    retry: "Try again",
    copyInvite: "Copy invite",
    createParty: "Create party",
    continue: "Continue",
  },
  status: {
    paid: "Paid · {time}",
    grace: "{n} grace hours left",
    onHold: "Your Diary is on hold until you settle up.",
    forming: "Waiting for {n} more RSVPs · starts when full, by {day}",
  },
  nudge: { due: "Night {n} chip-in is due. You have 72 grace hours." },
  toast: { stamped: "Stamped. Night {n} chip-in recorded.", copied: "Copied.", cardSaved: "Invite card saved as an image." },
  share: {
    card: "Share card as image",
    cardBusy: "Making the card",
    cardNote: "The card has no link on it, so it's safe to post anywhere. Send the invite link separately.",
    cardFailed: "Couldn't make the image. Copy the link instead.",
  },
  draw: {
    waiting: "Waiting for randomness · usually a few seconds",
    result: "{partyName} takes Night {n}'s kitty.",
  },
  pass: {
    never: "Your ID never leaves your phone.",
    keeps: "Kitty keeps one mark that says “this person has a pass”. Nothing else.",
  },
  house: { line: "The House Fund makes sure every guest is paid." },
  empty: {
    tonight: "Nothing due tonight.",
    parties: "No parties yet. Start one, or open an invite card from a friend.",
  },
  error: {
    network: "We couldn't reach Kitty just now. Your money is safe on-chain; try again in a moment.",
    proof: "Something interrupted the proof. Your data stayed on your device.",
  },
  devnet: "Devnet · test funds only",
  devnetExplain:
    "Kitty runs on Solana devnet. Every amount is a test token (test kUSD) and every ID is a test identity. No real money moves.",
  brand: {
    name: "Kitty",
    descriptor: "savings parties",
    line: "The world's oldest savings club ran on paper and trust. Kitty keeps the paper.",
  },

  nav: {
    howItWorks: "How it works",
    diary: "The Diary",
    house: "House Fund",
    tonight: "Tonight",
    parties: "Parties",
    diaryShort: "Diary",
    houseShort: "House",
    menu: "Menu",
    close: "Close",
    skip: "Skip to Get your Guest Pass",
  },

  preloader: { counter: "Setting the table" },

  hero: {
    lines: ["Chip in.", "Take the kitty.", "Keep your"],
    secret: "secrets",
    sub: "The world's oldest savings club, as a private savings party on Solana. No one can run off with the money, the party still finishes when someone stops paying, and every party you finish becomes history only you can read.",
    cue: "Open it",
    caption: "Everyone chips in. One guest takes it home.",
  },

  act2: {
    intro: ["It has a different name", "in every city."],
    stat: "About 1,000,000,000 people save this way.",
    statPeople: "1,000,000,000",
    flows: "Roughly $300B a year moves through circles.",
    footnote: "Rough estimates; no official census exists.",
  },

  act3: {
    fixLabel: "Kitty's fix",
    scenes: [
      {
        title: "The guest who takes the kitty early, then stops paying.",
        stamp: "Early takers default ~3.5× as often",
        stampNote: "2.04% vs 0.59% in one Chennai study",
        fix: "Part of an early payout stays in a keepsafe until they finish paying.",
      },
      {
        title: "The host who disappears with the money.",
        fix: "The money sits in a Solana program. The host sets up the party but never holds it.",
      },
      {
        title: "Years of paying on time count for nothing.",
        stamp: "+168 points",
        stampNote: "when circle payments were reported to credit bureaus",
        fix: "Every party you finish becomes a private page in your Diary, and you can prove it.",
      },
    ],
  },

  act4: {
    title: "How Kitty throws a party",
    chapters: {
      chipIn: { title: "Everyone chips in.", body: "Ten guests, $100 each, stamped as it lands." },
      draw: { title: "The Draw.", body: "Picked with verifiable randomness, on-chain." },
      takes: { title: "{name} takes the kitty.", body: "Paid straight to their party wallet." },
      keepsafe: { title: "$300 goes in a keepsafe.", body: "It comes back as they keep chipping in." },
      missed: { title: "Then {name} misses a night.", body: "No shame, just a kind nudge and 72 grace hours." },
      waterfall: { title: "The party still finishes.", body: "The keepsafe covers first, then the House Fund." },
      farewell: { title: "Farewell night.", body: "Everyone who paid in full gets a Farewell page." },
    },
    inset: { label: "Only {name} sees this" },
  },

  act5: {
    beats: [
      { title: "Checked at the door. Never kept.", body: "Your Guest Pass proves you're one real person. Your ID never leaves your phone." },
      { title: "A different mask at every party.", body: "Your parties can't be linked to each other on-chain. Each party only ever sees that mask." },
      { title: "One pass per person.", body: "A new wallet doesn't make a new person." },
    ],
    stamp: "Already has a Guest Pass.",
    caption: "Built on zero-knowledge proofs, made on your device.",
    newWallet: "new wallet",
  },

  act6: {
    title: "Your Party Diary",
    sub: "Only you can read it.",
    captions: [
      "Every chip-in stamps a page.",
      "Finish parties, move closer to the head of the table.",
      "Show one page. Nothing else.",
    ],
    page: "3 parties · never late.",
  },

  act7: {
    title: "The House Fund",
    body: "Everyone chips in a small House fee. When a guest misses, the House Fund covers the gap, and the guest settles up later.",
    sample: "Devnet sample data",
  },

  finale: {
    invited: "You're invited",
    to: "to a savings party",
    fees: ["Chip-in $100 · monthly · 10 guests", "Kitty\u00a0fee\u00a00.5% · House\u00a0fee\u00a00.5% · Host\u00a0fee\u00a01%"],
  },

  footer: {
    party: "Party",
    build: "Build",
    colophon: "Colophon",
    notes: "Notes",
    github: "GitHub",
    docs: "Docs",
    programId: "Program ID",
    builtFor: "Built for Colosseum's Crypto World's Fair",
    devnetLine: "Devnet · test funds · test identities",
  },
} as const;

/** Sources behind every statistic on the landing page (brief 11: footnotes cite docs/product.md). */
export const footnotes = [
  {
    n: 1,
    text: "Klonner & Rai, adverse selection in South Indian bidding ROSCAs: default among early takers 2.04% vs 0.59% for late takers.",
    href: "https://web.williams.edu/Economics/rai/adverse-klonner-rai.pdf",
  },
  {
    n: 2,
    text: "SF State evaluation of Mission Asset Fund (2013): members' scores rose 168 points on average.",
    href: "https://missionassetfund.org/wp-content/uploads/2019/06/Eval-short-web-FINAL.pdf",
  },
  {
    n: 3,
    text: "About 1 billion people (myDuti, citing the World Bank); about $300B a year (Observers). Rough estimates; no official census exists.",
    href: "https://www.myduti.com/blog/what-is-a-rosca",
  },
] as const;

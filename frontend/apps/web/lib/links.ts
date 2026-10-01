/** External links, from env so nothing dead ships (set in the deploy environment). */
export const LINKS = {
  github: process.env.NEXT_PUBLIC_GITHUB_URL ?? "",
  docs: process.env.NEXT_PUBLIC_DOCS_URL ?? "#act-4",
  programId: process.env.NEXT_PUBLIC_KITTY_PROGRAM_ID ?? "",
  explorer: (sig: string) => `https://explorer.solana.com/tx/${sig}?cluster=devnet`,
  account: (addr: string) => `https://explorer.solana.com/address/${addr}?cluster=devnet`,
};

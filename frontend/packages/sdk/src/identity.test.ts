import { describe, expect, it } from "vitest";
import { demoTag, identityFromName, partyName } from "./index";

describe("party names", () => {
  it("is deterministic per tag", () => {
    expect(partyName(demoTag("a")).name).toBe(partyName(demoTag("a")).name);
  });
  it("re-rolls on a clash inside one party", () => {
    const first = partyName(demoTag("a"));
    const second = partyName(demoTag("a"), new Set([first.name]));
    expect(second.name).not.toBe(first.name);
  });
  it("resolves scripted names", () => {
    expect(identityFromName("Marigold Parrot")).toMatchObject({ colour: 0, animal: 0 });
  });
});

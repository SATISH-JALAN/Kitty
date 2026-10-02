import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createPublicKey, verify } from "node:crypto";
import { describe, expect, it } from "vitest";
import { aadhaarInput, makeTestQr, parseQr } from "../src/aadhaar";
import TEST from "../src/aadhaar-test.json";

const here = dirname(fileURLToPath(import.meta.url));

describe("Anon Aadhaar port", () => {
  it("builds exactly the circuit input @anon-aadhaar/core builds", async () => {
    const ref = JSON.parse(readFileSync(join(here, "fixtures/aadhaar_args.json"), "utf8"));
    const mine = await aadhaarInput(TEST.testQRData, 5489n, 987654321n);
    expect(mine).toEqual(ref);
  });

  it("makes fresh test QRs, validly signed by the test key, each with its own photo", async () => {
    const a = await parseQr(await makeTestQr());
    const b = await parseQr(await makeTestQr());
    const pub = createPublicKey({ key: { kty: "RSA", n: Buffer.from(TEST.testModulusHex, "hex").toString("base64url"), e: "AQAB" }, format: "jwk" });
    expect(verify("sha256", a.signedData, pub, a.signature)).toBe(true);
    expect(Buffer.from(a.signedData.subarray(0, 3)).toString("latin1")).toBe("V2\xff");
    expect(Buffer.from(a.signedData).equals(Buffer.from(b.signedData))).toBe(false);
    // the circuit input still builds
    expect((await aadhaarInput(await makeTestQr(), 1n, 2n)).delimiterIndices).toHaveLength(18);
  });
});

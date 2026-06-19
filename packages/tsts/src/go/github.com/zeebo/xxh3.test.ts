import { test } from "node:test";
import assert from "node:assert/strict";
import { HashString128, New } from "./xxh3.js";

test("HashString128 preserves TSTS cache-key hash vectors", () => {
  const cases: Array<[string, string, string]> = [
    ["", "55c5e55dfb685f30cbf29ce484222325", "85,197,229,93,251,104,95,48,203,242,156,228,132,34,35,37"],
    ["?", "af63fc4c860222ecaf63b24c8601a52e", "175,99,252,76,134,2,34,236,175,99,178,76,134,1,165,46"],
    ["abc", "3d7024c0a57f8765e71fa2190541574b", "61,112,36,192,165,127,135,101,231,31,162,25,5,65,87,75"],
    ["TypeScript", "1bac6366e963766389758ae8b9a73e02", "27,172,99,102,233,99,118,99,137,117,138,232,185,167,62,2"],
    ["é", "1b3142f697e3b0b20ac21707b7181e01", "27,49,66,246,151,227,176,178,10,194,23,7,183,24,30,1"],
    ["𝄞", "281a3e416018556b0cf987387bfa4bb8", "40,26,62,65,96,24,85,107,12,249,135,56,123,250,75,184"],
    ["a".repeat(64), "038364c144dc06b0db007849f35ebbe5", "3,131,100,193,68,220,6,176,219,0,120,73,243,94,187,229"],
    ["🚀".repeat(8), "31bd4dcf4ae9d5608126e826076341f5", "49,189,77,207,74,233,213,96,129,38,232,38,7,99,65,245"],
  ];

  for (const [input, hex, bytes] of cases) {
    const hash = HashString128(input);
    assert.equal(hash.String(), hex);
    assert.equal(hash.Bytes().join(","), bytes);
  }
});

test("Hasher.Write preserves byte-vector hash output", () => {
  const hash = New();
  hash.Write([0, 1, 2, 3, 255]);
  assert.equal(hash.Sum128().String(), "36e8a8ffe5d486503379bcd0c530506a");
  assert.equal(hash.Sum128().Bytes().join(","), "54,232,168,255,229,212,134,80,51,121,188,208,197,48,80,106");
});

import { test } from "node:test";
import assert from "node:assert/strict";
import type { byte } from "@tsonic/core/types.js";
import { Parse } from "./packagejson.js";
import { Expected_GetValue } from "./expected.js";

const textEncoder = new TextEncoder();

function bytes(text: string): byte[] {
  return Array.from(textEncoder.encode(text)) as byte[];
}

test("Parse mirrors upstream duplicate-name package.json behavior", () => {
  const [fields, error] = Parse(bytes(`{
    "name": "test-package",
    "name": "test-package",
    "version": "1.0.0"
  }`));

  assert.equal(error, undefined);
  assert.equal(fields.__tsgoEmbedded0!.Name.Valid, true);
  assert.equal(fields.__tsgoEmbedded0!.Name.Value, "test-package");
  assert.equal(fields.__tsgoEmbedded0!.Version.Valid, true);
  assert.equal(fields.__tsgoEmbedded0!.Version.Value, "1.0.0");

  const [name, nameOk] = Expected_GetValue(fields.__tsgoEmbedded0!.Name);
  assert.equal(nameOk, true);
  assert.equal(name, "test-package");
});

import { test } from "node:test";
import assert from "node:assert/strict";
import type { byte } from "../../go/scalars.js";
import { Expected_UnmarshalJSON } from "./expected.js";
import type { Expected } from "./expected.js";

const textEncoder = new TextEncoder();

function bytes(text: string): byte[] {
  return Array.from(textEncoder.encode(text)) as byte[];
}

function missingExpected<T>(value: T): Expected<T> {
  return { actualJSONType: "", Null: false, Valid: false, Value: value };
}

test("Expected.UnmarshalJSON mirrors upstream valid/null/invalid type behavior", () => {
  const name = missingExpected("");
  const version = missingExpected("");
  const exportsField = missingExpected<unknown>(undefined);
  const main = missingExpected("");

  assert.equal(Expected_UnmarshalJSON(name, bytes(`"test"`)), undefined);
  assert.equal(Expected_UnmarshalJSON(version, bytes(`2`)), undefined);
  assert.equal(Expected_UnmarshalJSON(exportsField, bytes(`null`)), undefined);

  assert.equal(name.Valid, true);
  assert.equal(name.Value, "test");
  assert.equal(name.Null, false);

  assert.equal(version.Valid, false);
  assert.equal(version.Value, "");
  assert.equal(version.actualJSONType, "number");

  assert.equal(exportsField.Null, true);
  assert.equal(exportsField.Valid, false);
  assert.equal(exportsField.actualJSONType, "null");

  assert.equal(main.Valid, false);
  assert.equal(main.Null, false);
  assert.equal(main.Value, "");
  assert.equal(main.actualJSONType, "");
});

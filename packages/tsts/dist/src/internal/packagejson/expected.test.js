import { test } from "node:test";
import assert from "node:assert/strict";
import { Expected_UnmarshalJSON } from "./expected.js";
const textEncoder = new TextEncoder();
function bytes(text) {
    return Array.from(textEncoder.encode(text));
}
function missingExpected(value) {
    return { actualJSONType: "", Null: false, Valid: false, Value: value };
}
test("Expected.UnmarshalJSON mirrors upstream valid/null/invalid type behavior", () => {
    const name = missingExpected("");
    const version = missingExpected("");
    const exportsField = missingExpected(undefined);
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
//# sourceMappingURL=expected.test.js.map
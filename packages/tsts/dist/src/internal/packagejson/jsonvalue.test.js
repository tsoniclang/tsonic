import { test } from "node:test";
import assert from "node:assert/strict";
import { NewDecoder } from "../../go/github.com/go-json-experiment/json/jsontext.js";
import { OrderedMap_GetOrZero, OrderedMap_Size } from "../collections/ordered_map.js";
import { JSONValue_AsArray, JSONValue_AsObject, JSONValue_UnmarshalJSONFrom, JSONValueTypeArray, JSONValueTypeBoolean, JSONValueTypeNotPresent, JSONValueTypeNull, JSONValueTypeNumber, JSONValueTypeObject, JSONValueTypeString, } from "./jsonvalue.js";
const textEncoder = new TextEncoder();
function bytes(text) {
    return Array.from(textEncoder.encode(text));
}
function parseJSONValue(text) {
    const value = { Type: JSONValueTypeNotPresent, Value: undefined };
    const error = JSONValue_UnmarshalJSONFrom(value, NewDecoder(bytes(text)));
    assert.equal(error, undefined);
    return value;
}
test("JSONValue.UnmarshalJSONFrom mirrors upstream primitive/object/array/null decoding", () => {
    const value = parseJSONValue(`{
    "private": true,
    "false": false,
    "name": "test",
    "version": 2,
    "exports": {
      ".": {
        "import": "./test.ts",
        "default": "./test.ts"
      },
      "./test": [
        "./test1.ts",
        "./test2.ts",
        null
      ],
      "./null": null
    },
    "imports": null
  }`);
    assert.equal(value.Type, JSONValueTypeObject);
    const root = JSONValue_AsObject(value);
    const privateValue = OrderedMap_GetOrZero(root, "private");
    assert.equal(privateValue.Type, JSONValueTypeBoolean);
    assert.equal(privateValue.Value, true);
    const falseValue = OrderedMap_GetOrZero(root, "false");
    assert.equal(falseValue.Type, JSONValueTypeBoolean);
    assert.equal(falseValue.Value, false);
    const nameValue = OrderedMap_GetOrZero(root, "name");
    assert.equal(nameValue.Type, JSONValueTypeString);
    assert.equal(nameValue.Value, "test");
    const versionValue = OrderedMap_GetOrZero(root, "version");
    assert.equal(versionValue.Type, JSONValueTypeNumber);
    assert.equal(versionValue.Value, 2);
    const exportsValue = OrderedMap_GetOrZero(root, "exports");
    assert.equal(exportsValue.Type, JSONValueTypeObject);
    const exportsObject = JSONValue_AsObject(exportsValue);
    assert.equal(OrderedMap_Size(exportsObject), 3);
    const dot = OrderedMap_GetOrZero(exportsObject, ".");
    assert.equal(dot.Type, JSONValueTypeObject);
    assert.equal(OrderedMap_GetOrZero(JSONValue_AsObject(dot), "import").Value, "./test.ts");
    const testArray = OrderedMap_GetOrZero(exportsObject, "./test");
    assert.equal(testArray.Type, JSONValueTypeArray);
    const testItems = JSONValue_AsArray(testArray);
    assert.equal(testItems.length, 3);
    assert.equal(testItems[0].Value, "./test1.ts");
    assert.equal(testItems[1].Value, "./test2.ts");
    assert.equal(testItems[2].Type, JSONValueTypeNull);
    assert.equal(OrderedMap_GetOrZero(exportsObject, "./null").Type, JSONValueTypeNull);
    const importsValue = OrderedMap_GetOrZero(root, "imports");
    assert.equal(importsValue.Type, JSONValueTypeNull);
    assert.equal(importsValue.Value, undefined);
});
test("JSONValue zero value mirrors upstream not-present state", () => {
    const notPresent = { Type: JSONValueTypeNotPresent, Value: undefined };
    assert.equal(notPresent.Type, JSONValueTypeNotPresent);
    assert.equal(notPresent.Value, undefined);
});
//# sourceMappingURL=jsonvalue.test.js.map
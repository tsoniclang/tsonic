import { test } from "node:test";
import assert from "node:assert/strict";
import type { byte } from "../../go/scalars.js";
import { NewDecoder } from "../../go/github.com/go-json-experiment/json/jsontext.js";
import { OrderedMap_GetOrZero, OrderedMap_Size } from "../collections/ordered_map.js";
import {
  ExportsOrImports_AsArray,
  ExportsOrImports_AsObject,
  ExportsOrImports_IsConditions,
  ExportsOrImports_IsImports,
  ExportsOrImports_IsSubpaths,
  ExportsOrImports_UnmarshalJSONFrom,
  objectKindUnknown,
} from "./exportsorimports.js";
import type { ExportsOrImports } from "./exportsorimports.js";
import { JSONValueTypeNotPresent, JSONValueTypeNull, JSONValueTypeString } from "./jsonvalue.js";

const textEncoder = new TextEncoder();

function bytes(text: string): byte[] {
  return Array.from(textEncoder.encode(text)) as byte[];
}

function parseExportsOrImports(text: string): ExportsOrImports {
  const value: ExportsOrImports = {
    __tsgoEmbedded0: { Type: JSONValueTypeNotPresent, Value: undefined },
    objectKind: objectKindUnknown,
  };
  const error = ExportsOrImports_UnmarshalJSONFrom(value, NewDecoder(bytes(text)));
  assert.equal(error, undefined);
  return value;
}

test("ExportsOrImports.UnmarshalJSONFrom mirrors upstream subpaths/imports/conditions decoding", () => {
  const importsValue = parseExportsOrImports(`{
    "#foo": {
      "import": "./foo.ts"
    }
  }`);
  const exportsValue = parseExportsOrImports(`{
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
  }`);

  assert.equal(ExportsOrImports_IsSubpaths(exportsValue), true);
  const exportsObject = ExportsOrImports_AsObject(exportsValue);
  assert.equal(OrderedMap_Size(exportsObject), 3);

  const dot = OrderedMap_GetOrZero<string, ExportsOrImports>(exportsObject, ".");
  assert.equal(ExportsOrImports_IsConditions(dot), true);
  assert.equal(
    OrderedMap_GetOrZero<string, ExportsOrImports>(ExportsOrImports_AsObject(dot), "import").__tsgoEmbedded0!.Type,
    JSONValueTypeString,
  );

  const testArray = OrderedMap_GetOrZero<string, ExportsOrImports>(exportsObject, "./test");
  assert.equal(ExportsOrImports_AsArray(testArray)[2]!.__tsgoEmbedded0!.Type, JSONValueTypeNull);
  assert.equal(OrderedMap_GetOrZero<string, ExportsOrImports>(exportsObject, "./null").__tsgoEmbedded0!.Type, JSONValueTypeNull);

  assert.equal(ExportsOrImports_IsImports(importsValue), true);
  const importsObject = ExportsOrImports_AsObject(importsValue);
  assert.equal(OrderedMap_Size(importsObject), 1);
  const hashFoo = OrderedMap_GetOrZero<string, ExportsOrImports>(importsObject, "#foo");
  assert.equal(ExportsOrImports_IsConditions(hashFoo), true);
  assert.equal(
    OrderedMap_GetOrZero<string, ExportsOrImports>(ExportsOrImports_AsObject(hashFoo), "import").__tsgoEmbedded0!.Type,
    JSONValueTypeString,
  );
});

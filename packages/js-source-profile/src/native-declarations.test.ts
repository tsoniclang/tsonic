import assert from "node:assert/strict";
import test from "node:test";
import { tsonicCoreSourceSemanticsModules } from "@tsonic/source-core";
import { jsSurfaceSourceProfileDeclarations } from "./declarations/globals.js";
import { sourcePrimitiveProfileDeclarations } from "./declarations/primitives.js";
import { jsTypedArrayElementKinds } from "./declarations/typed-arrays.js";
import { sourceErrorDeclarations } from "./declarations/errors.js";

test("the global primitive vocabulary refers to every existing source-core primitive identity exactly once", () => {
  let count = 0;
  for (const module of tsonicCoreSourceSemanticsModules()) for (const declaration of module.exports) {
    if (declaration.kind !== "source-primitive") continue;
    const expected = `type ${declaration.exportName} = import(${JSON.stringify(module.moduleSpecifier)}).${declaration.exportName};`;
    assert.equal(sourcePrimitiveProfileDeclarations.split(expected).length - 1, 1, declaration.exportName);
    count += 1;
  }
  assert.equal(count, 18);
  assert.equal(jsSurfaceSourceProfileDeclarations.includes(sourcePrimitiveProfileDeclarations), true);
});

test("the shared JS inventory retains the union of target-supported names and the broader JSON contract", () => {
  for (const signature of [
    "interface SharedArrayBuffer", "interface Atomics", "getBigUint64(",
    "setBigUint64(", "new (): Uint8Array", "from(arrayLike: string): string[]",
    "lastIndexOf(searchElement: T, fromIndex?: int32): int32",
    "stringify(value: unknown", "interface ArrayEntriesIterator<T>",
    'type UnicodeNormalizationForm = "NFC" | "NFD" | "NFKC" | "NFKD";',
  ]) assert.equal(jsSurfaceSourceProfileDeclarations.includes(signature), true, signature);
  assert.equal(jsSurfaceSourceProfileDeclarations.includes("IterableIterator<[int32, T]"), true);
  for (const [name, element] of Object.entries(jsTypedArrayElementKinds)) {
    assert.equal(jsSurfaceSourceProfileDeclarations.includes(`interface ${name} extends TypedArray<${name}, ${element}>`), true, name);
  }
});

test("global Error readonly fields retain native nullable reads rather than optional mutable properties", () => {
  for (const signature of [
    "readonly name: string;", "readonly message: string;",
    "readonly stack: string | undefined;", "readonly cause: Error | undefined;",
  ]) assert.equal(sourceErrorDeclarations.includes(signature), true, signature);
  assert.equal(sourceErrorDeclarations.includes("stack?:"), false);
  assert.equal(sourceErrorDeclarations.includes("cause?: Error; }"), true, "the independent ErrorOptions remains optional");
});

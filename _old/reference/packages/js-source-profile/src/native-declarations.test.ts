import assert from "node:assert/strict";
import test from "node:test";
import { tsonicCoreSourceSemanticsModules } from "@tsonic/source-core";
import { jsSurfaceSourceProfileDeclarations } from "./declarations/globals.js";
import { sourcePrimitiveProfileDeclarations } from "./declarations/primitives.js";
import { jsTypedArrayElementKinds } from "./declarations/typed-arrays.js";
import { sourceErrorDeclarations } from "./declarations/errors.js";
import { sourceNoLibBaseDeclarations } from "./declarations/base.js";

test("one shared no-lib base retains the full iterator, Promise, Error and naming inventory", () => {
  assert.equal(jsSurfaceSourceProfileDeclarations.split(sourceNoLibBaseDeclarations).length - 1, 1);
  for (const signature of [
    "interface Object {}", "interface CallableFunction extends Function {}",
    "interface IArguments {\n  [index: int32]: unknown;\n}",
    "done?: false;", "all<T>(values: readonly Promise<T>[]): Promise<T[]>;",
    "all<T extends readonly unknown[]>(values: T)",
    "[Symbol.iterator](): IterableIterator<T, TReturn, TNext>;",
    "[Symbol.asyncIterator](): AsyncIterableIterator<T, TReturn, TNext>;",
    'type UnicodeNormalizationForm = "NFC" | "NFD" | "NFKC" | "NFKD";',
  ]) assert.equal(sourceNoLibBaseDeclarations.includes(signature), true, signature);
  assert.equal(sourceNoLibBaseDeclarations.split(sourceErrorDeclarations).length - 1, 1);
  assert.equal(sourceNoLibBaseDeclarations.includes("readonly length:"), false);
  assert.equal(sourceNoLibBaseDeclarations.includes("readonly Length:"), false);
});

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

test("native split counts, timer handles and BigInt widths are declared once at their exact integer slots", () => {
  for (const signature of [
    "split(separator: string, limit?: int32): string[];",
    "split(separator: RegExp, limit?: int32): (string | undefined)[];",
    "asIntN(bits: int32, value: bigint): bigint;",
    "asUintN(bits: int32, value: bigint): bigint;",
    "declare function clearTimeout(id?: int32): void;",
    "declare function clearInterval(id?: int32): void;",
  ]) assert.equal(jsSurfaceSourceProfileDeclarations.split(signature).length - 1, 1, signature);
  assert.equal(jsSurfaceSourceProfileDeclarations.includes("limit?: number"), false);
  assert.equal(jsSurfaceSourceProfileDeclarations.includes("asIntN(bits: number"), false);
  assert.equal(jsSurfaceSourceProfileDeclarations.includes("sort<TResult extends number | bigint = number>(compareFn?: (a: T, b: T) => TResult)"), true, "Q15 infers the actual native numeric result without a fixed floating ABI");
});

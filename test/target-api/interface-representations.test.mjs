import assert from "node:assert/strict";
import test from "node:test";
import { formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram, sourceInterfaceRepresentationBase } from "../../packages/target-api/dist/public/source.js";
import { checkedSource, namedDeclaration, projectSourceFile } from "../fixtures/source-navigation.mjs";

test("interface representation aliases require exact single-base checker evidence across merged declarations", async () => {
  const checked = await checkedSource("interface-representation-contract", {
    "globals.d.ts": `
interface Object {} interface Function {} interface CallableFunction extends Function {}
interface NewableFunction extends Function {} interface IArguments {} interface Boolean {}
interface Number {} interface String {} interface RegExp {}
interface Array<T> { [index: number]: T; length: number; }
interface ReadonlyArray<T> { readonly [index: number]: T; readonly length: number; }
`,
    "src/base.ts": "export interface Values<T> extends ReadonlyArray<T> {}",
    "src/index.ts": `
import type { Values } from "./base.js";
interface Tokens extends Values<object> {}
interface Redirect<Unused> extends ReadonlyArray<object> {}
interface Merged extends ReadonlyArray<number> {} interface Merged {}
interface Added extends ReadonlyArray<number> { tag: string; }
interface Changed extends ReadonlyArray<number> {} interface Changed { tag: string; }
interface Multiple extends ReadonlyArray<number>, Values<number> {}
interface Empty {}
class Nominal {}
`,
  });
  assert.equal(checked.diagnostics.length, 0, formatDiagnostics(checked.diagnostics));
  const source = createTargetSourceProgram(checked);
  const file = projectSourceFile(source, "src/index.ts");
  for (const name of ["Tokens", "Redirect", "Merged", "Added", "Changed", "Multiple", "Empty", "Nominal"]) {
    const declaration = namedDeclaration(source.ast, file, name);
    const semantics = source.semantics.forNode(declaration);
    const edge = sourceInterfaceRepresentationBase(declaration, source.ast, source.navigation, semantics);
    const accepted = ["Tokens", "Redirect", "Merged"].includes(name);
    assert.equal(edge !== undefined, accepted, `${name}: exact representation contract`);
    if (!accepted) continue;
    assert.equal(edge.kind, "extends");
    assert.equal(semantics.types.isArrayLike(edge.selectedType), true, `${name}: selected checked array`);
    assert.equal(sourceInterfaceRepresentationBase(declaration, source.ast, source.navigation,
      { ...semantics, types: { ...semantics.types, isIdentical: () => false } }) === undefined, true,
      `${name}: absent identity evidence cannot erase the declaration`);
    assert.equal(sourceInterfaceRepresentationBase(declaration, source.ast,
      { ...source.navigation, declaredHeritage: () => ({ kind: "unresolved" }) }, semantics) === undefined, true,
      `${name}: unresolved heritage cannot establish an alias`);
  }
});

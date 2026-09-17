import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import { sourceTypeSyntaxIsCompositional } from "./type-syntax.js";

test("typed object and callback syntax composes without erasing generic member evidence", () => {
  const checked = createCompilerSessionFromFiles({
    currentDirectory: "/src",
    files: { "/src/index.ts": `
      declare const key: unique symbol;
      type Value<T> = { readonly value: T; values?: T[] };
      type Callback<T> = { readonly at: (index: number, suffix?: string) => T };
      type Region<T> = Value<T> | Callback<T>;
      type TupleCallback<T> = (...values: [T, T]) => T;
      type Conditional<T> = T extends string ? number : T;
      type Mapped<T> = { [K in keyof T]: T[K] };
      type Indexed<T> = T[keyof T];
      type Shadow<T> = { at: <T>(value: T) => T };
      type Computed<T> = { [key]: T };
      type Nested<T> = { value: Conditional<T>; nested: T[keyof T] };
    ` },
    compilerOptions: { strict: true, target: "es2022", module: "esnext" },
  }).checkSource();
  assert.deepEqual(checked.extensionDiagnostics, []);
  assert.equal(checked.diagnostics.length, 0, formatDiagnostics(checked.diagnostics.filter(value => value !== undefined), "/src"));
  const file = checked.getSourceFile("/src/index.ts");
  assert.ok(file);
  const classifications = checked.ast.statements(file).flatMap(node => {
    if (node === undefined || !checked.ast.is.IsTypeAliasDeclaration(node)) return [];
    const name = checked.ast.name(node);
    assert.ok(name);
    return [[checked.ast.text(name), sourceTypeSyntaxIsCompositional(checked.ast, checked.ast.typeNode(node))]];
  });
  assert.deepEqual(classifications, [
    ["Value", true], ["Callback", true], ["Region", true], ["TupleCallback", true],
    ["Conditional", false], ["Mapped", false], ["Indexed", false], ["Shadow", false],
    ["Computed", false], ["Nested", false],
  ]);
});

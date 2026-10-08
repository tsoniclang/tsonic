import assert from "node:assert/strict";
import test from "node:test";
import { createTargetSourceProgram } from "../../packages/target-api/dist/public/source.js";
import { createSourceStorageQuery, defaultSourceStorageLimits } from "../../packages/target-api/dist/public/analysis.js";
import { checkedSource } from "../fixtures/source-navigation.mjs";
import { recursiveSourceUnionFiles } from "../fixtures/recursive-source-unions.mjs";

test("recursive callable record publications preserve exact finite source storage domains", async () => {
  const checked = await checkedSource("recursive-callable-union-storage", {
    "globals.d.ts": `
interface Object {} interface Function {} interface CallableFunction extends Function {}
interface NewableFunction extends Function {} interface IArguments {} interface Boolean {}
interface Number {} interface String {} interface RegExp {}
interface Array<T> { [index: number]: T; length: number; }
interface ReadonlyArray<T> { readonly [index: number]: T; readonly length: number; }
`,
    ...Object.fromEntries(Object.entries(recursiveSourceUnionFiles).map(([name, body]) => [`src/${name}`, body])),
  });
  assert.equal(checked.diagnostics.length, 0, "unchanged recursive source checks");
  const source = createTargetSourceProgram(checked);
  const storage = createSourceStorageQuery(source, source.navigation.sourceFiles, {
    ...defaultSourceStorageLimits, maximumTransportRows: 4096, maximumSteps: 32768,
  });
  const declarations = [];
  const visit = node => {
    if (source.ast.is.IsPropertySignatureDeclaration(node) &&
      source.ast.kindName(source.ast.typeNode(node)) === "KindFunctionType") declarations.push(node);
    source.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  for (const file of source.navigation.sourceFiles) visit(file);
  assert.equal(declarations.length, 3, "exact authored next/resume properties");
  for (const declaration of declarations) {
    const subject = storage.subject(declaration);
    assert.equal(subject.kind === "resolved", true, "selected declaration has a graph-owned subject");
    const selected = storage.storageProducersFor(subject.subject);
    assert.equal(selected.kind !== "unresolved", true, "recursive callable publication converges without poisoning the graph");
    assert.equal(selected.producers.length > 0, true, "publication retains actual checked producers");
  }
  assert.equal(storage.failureReason(), undefined, "finite source storage keeps all budget guards intact");
});

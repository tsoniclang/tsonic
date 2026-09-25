import assert from "node:assert/strict";
import test from "node:test";
import { argumentPassingFactKey, formatDiagnostics } from "@tsonic/tsts";
import { createSourceProgramNavigation, createTargetSourceProgram, sourceIntegerInduction } from "../../packages/target-api/dist/public/source.js";
import { checkedSource, projectSourceFile } from "../fixtures/source-navigation.mjs";

const profile = `
interface Object {}
interface Function {}
interface CallableFunction extends Function {}
interface NewableFunction extends Function {}
interface IArguments {}
interface Boolean {}
interface Number {}
interface String {}
interface RegExp {}
interface Array<T> { length: number; [index: number]: T; }
interface Iterator<T> { next(): { value: T; done?: boolean }; }
interface SymbolConstructor { readonly iterator: unique symbol; }
declare var Symbol: SymbolConstructor;
`;

test("bounded induction proves only unchanged zero-based counters with representation-independent uses", async () => {
  const source = await checkedSource("integer-induction", { "profile.d.ts": profile, "src/index.ts": `
    declare function consume(value: number): void;
    function loops(values: { length: number; [index: number]: number }) {
      for (let index = 0; index < values.length; index++) consume(values[index]);
      for (let index = 0; index < values.length; index++) { consume(values[index]); values.length++; }
      for (let index: number = 0; index < values.length; index++) consume(values[index]);
      for (let index = 0; index <= values.length; index++) consume(values[index]);
      for (let index = 0.5; index < values.length; index++) consume(values[index]);
      for (let index = 0; index < values.length; index++) { index += 0.5; consume(values[index]); }
      for (let index = 0; index < values.length; index++) consume(index / 2);
      for (let index = 0; index < values.length; index++) { const alias = index; consume(alias / 2); }
      for (let index = 0; index < values.length; index++) { const captured = () => index; consume(captured()); }
      for (let index = 0; index < values.length; index++) consume(index);
    }
  ` });
  assert.equal(formatDiagnostics(source.diagnostics.filter(value => value !== undefined)), "");
  const navigation = createSourceProgramNavigation(source);
  const program = createTargetSourceProgram(source);
  const evidence = { sourceFacts: source.sourceFacts, semanticsFor: node => program.semantics.forFile(source.ast.getSourceFile(node)) };
  const file = projectSourceFile(source, "src/index.ts");
  const declarations = [];
  const visit = node => {
    if (source.ast.is.IsVariableDeclaration(node) && source.ast.text(source.ast.name(node)) === "index") declarations.push(node);
    source.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  visit(file);
  assert.deepEqual(declarations.map(declaration => sourceIntegerInduction(declaration, source.ast, navigation, evidence) !== undefined),
    [true, true, false, false, false, false, false, false, false, false]);
});

test("integer call uses require exact project parameter and by-value evidence", async () => {
  const checked = await checkedSource("integer-induction-calls", { "profile.d.ts": profile, "src/index.ts": `
    import type { int32 } from "@tsonic/core/types.js";
    import { addressOf } from "@tsonic/core/lang.js";
    function copy(value: int32): int32 { value++; return value; }
    function floating(value: number): number { return value; }
    declare function external(value: int32): void;
    export function loops(bound: int32): void {
      for (let index = 0; index < bound; index++) copy(index);
      for (let index = 0; index < bound; index++) floating(index);
      for (let index = 0; index < bound; index++) external(index);
      for (let index = 0; index < bound; index++) addressOf(index);
    }
  ` }, { sourceCore: true });
  assert.equal(formatDiagnostics(checked.diagnostics.filter(value => value !== undefined)), "");
  assert.deepEqual(checked.extensionDiagnostics, []);
  const source = createTargetSourceProgram(checked);
  const declarations = [];
  const visit = node => {
    if (source.ast.is.IsVariableDeclaration(node) && source.ast.text(source.ast.name(node)) === "index") declarations.push(node);
    source.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  visit(projectSourceFile(source, "src/index.ts"));
  const evidence = { sourceFacts: source.sourceFacts, semanticsFor: node => source.semantics.forNode(node) };
  assert.deepEqual(declarations.map(declaration => sourceIntegerInduction(declaration, source.ast, source.navigation, evidence) !== undefined),
    [true, false, false, false]);
  assert.equal(sourceIntegerInduction(declarations[0], source.ast, source.navigation, { ...evidence, sourceFacts: undefined }), undefined);
  const referencePassing = { ...evidence, sourceFacts: { ...source.sourceFacts,
    getFact: (subject, key) => key === argumentPassingFactKey
      ? { mode: "byref-readwrite", storageExpression: subject }
      : source.sourceFacts.getFact(subject, key),
  } };
  assert.equal(sourceIntegerInduction(declarations[0], source.ast, source.navigation, referencePassing), undefined);
});

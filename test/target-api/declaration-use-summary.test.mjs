import assert from "node:assert/strict";
import test from "node:test";
import { createTargetSourceProgram, sourceDeclarationHasOnlyTypeUses } from "../../packages/target-api/dist/public/source.js";
import { checkedSource, namedDeclaration, namedVariable, projectSourceFile } from "../fixtures/source-navigation.mjs";

test("declaration use classification owns erased contracts without inventing initializer purity", async () => {
  const checked = await checkedSource("metadata-only-use-kinds", { "src/index.ts": `
const interfaceKey = "interface";
interface InterfaceShape { [interfaceKey]: number; }
const literalKey = "literal";
type LiteralShape = { [literalKey]: number };
const methodKey = "method";
interface MethodShape { [methodKey](): number; }
const queryValue = 7;
type Query = typeof queryValue;
const ambientKey = "ambient";
class Ambient { declare [ambientKey]: number; }
function create(): "effect" { return "effect"; }
const effectKey = create();
interface EffectShape { [effectKey]: number; }
class Source { get key(): "getter" { return "getter"; } }
const getterKey = new Source().key;
interface GetterShape { [getterKey]: number; }
export {};
` });
  const source = createTargetSourceProgram(checked);
  const file = projectSourceFile(source, "src/index.ts");
  for (const name of ["interfaceKey", "literalKey", "methodKey", "queryValue", "ambientKey", "effectKey", "getterKey"]) {
    const declaration = namedVariable(source.ast, file, name);
    const summary = source.navigation.declarationUseSummary(declaration);
    assert.equal(sourceDeclarationHasOnlyTypeUses(summary), true, `${name}: actual erased declaration/signature reference`);
    assert.equal(summary.uses.length > 0, true, `${name}: no vacuous unused-declaration optimization`);
    assert.equal(summary.uses.every(use => use.kind === "type-only" && use.role === "type-only"), true, `${name}: one shared kind and role`);
    assert.equal(source.navigation.declarationUseSummary(declaration) === summary, true, `${name}: stable checked summary identity`);
    assert.equal(Object.isFrozen(summary) && Object.isFrozen(summary.uses), true, `${name}: readonly use evidence`);
  }
  for (const name of ["effectKey", "getterKey"]) {
    const declaration = namedVariable(source.ast, file, name);
    const initializer = source.ast.as.AsVariableDeclaration(declaration)?.Initializer;
    assert.equal(initializer !== undefined, true, `${name}: the actual initializer is retained`);
    const effects = source.navigation.expressionEffects(initializer);
    assert.equal(effects.invokes && effects.mayThrow, true, `${name}: type-only use never supplies a purity proof`);
  }
});

test("runtime, linkage, mutation, captures and checked shadow identities are not type-only uses", async () => {
  const checked = await checkedSource("metadata-only-use-inverses", { "src/index.ts": `
const classKey = "class";
class Runtime { [classKey]: number = 1; }
const objectKey = "object";
const object = { [objectKey]: 1 };
const elementKey = "element";
function read(value: { element: number }): number { return value[elementKey]; }
const bodyKey = "body";
class Body { read(): string { return bodyKey; } }
export const exported = "exported";
interface Exported { [exported]: number; }
const linkage = "linkage";
export { linkage };
let written = 1;
type Written = typeof written;
written = 2;
const captured = 7;
function capture(): () => number { return () => captured; }
const unused = "unused";
const shadow = "outer";
interface Shadow { [shadow]: number; }
function inner(): string { const shadow = "inner"; return shadow; }
` });
  const source = createTargetSourceProgram(checked);
  const file = projectSourceFile(source, "src/index.ts");
  for (const name of ["classKey", "objectKey", "elementKey", "bodyKey", "exported", "linkage", "written", "captured", "unused"]) {
    const declaration = namedVariable(source.ast, file, name);
    assert.equal(sourceDeclarationHasOnlyTypeUses(source.navigation.declarationUseSummary(declaration)), false,
      `${name}: actual runtime/export/write/escape or absent-use premise`);
  }
  const outer = namedVariable(source.ast, file, "shadow");
  const inner = namedVariable(source.ast, namedDeclaration(source.ast, file, "inner"), "shadow");
  assert.equal(outer === inner, false, "identically spelled bindings have different checked identities");
  assert.equal(sourceDeclarationHasOnlyTypeUses(source.navigation.declarationUseSummary(outer)), true, "outer binding is used only by its erased interface");
  assert.equal(sourceDeclarationHasOnlyTypeUses(source.navigation.declarationUseSummary(inner)), false, "inner runtime read does not contaminate or reuse outer evidence");
});

test("import/export linkage preserves the actual originating declaration identity", async () => {
  const checked = await checkedSource("metadata-only-linkage", {
    "src/index.ts": 'import { key as imported } from "./other.js"; interface Shape { [imported]: number; } export {};',
    "src/other.ts": 'export const key = "value"; interface Own { [key]: number; }',
  });
  const source = createTargetSourceProgram(checked);
  const declaration = namedVariable(source.ast, projectSourceFile(source, "src/other.ts"), "key");
  const summary = source.navigation.declarationUseSummary(declaration);
  assert.equal(summary.exported, true, "the real exported declaration remains an ABI/runtime obligation");
  assert.equal(sourceDeclarationHasOnlyTypeUses(summary), false, "an imported erased reference cannot erase the exported value");
});

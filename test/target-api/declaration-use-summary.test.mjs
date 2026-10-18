import assert from "node:assert/strict";
import test from "node:test";
import { createTargetSourceProgram, sourceDeclarationHasOnlyTypeUses, sourceDeclarationIsModuleScoped } from "../../packages/target-api/dist/public/source.js";
import { checkedSource, namedDeclaration, namedVariable, projectSourceFile, requiredNode } from "../fixtures/source-navigation.mjs";
import { minimalSourceGlobals } from "../fixtures/minimal-source-globals.mjs";

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
  const outer = requiredNode(source.ast, file, node => source.ast.is.IsVariableDeclaration(node) &&
    source.ast.is.IsIdentifier(source.ast.name(node)) && source.ast.text(source.ast.name(node)) === "shadow" &&
    sourceDeclarationIsModuleScoped(node, source.ast));
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

test("runtime heritage retains only its actual base result as source storage", async () => {
  const checked = await checkedSource("runtime-heritage-storage", {
    "globals.d.ts": minimalSourceGlobals,
    "src/base.ts": "export class ImportedBase {}",
    "src/index.ts": `
import { ImportedBase } from "./base.js";
class Base {}
class Other {}
declare const flag: boolean;
class Direct extends Base {}
class Parenthesized extends (Base) {}
class Conditional extends (flag ? Base : Other) {}
const Expression = class extends Base {};
namespace Library { export class Member {} }
class Qualified extends Library.Member {}
class Imported extends ImportedBase {}
function choose(value: typeof Base): typeof Base { return value; }
declare function opaque(value: typeof Base): typeof Base;
class FromFactory extends choose(Base) {}
class FromOpaque extends opaque(Base) {}
export {};
`,
  });
  assert.equal(checked.diagnostics.length, 0, "Every actual constructor, alias and opaque argument is checked source.");
  const source = createTargetSourceProgram(checked);
  const file = projectSourceFile(source, "src/index.ts");
  const base = namedDeclaration(source.ast, file, "Base");
  const baseSummary = source.navigation.declarationUseSummary(base);
  const usesWithin = (summary, owner) => summary.uses.filter(use => {
    let current = use.reference;
    while (current !== undefined && current !== owner) current = source.ast.parent(current);
    return current === owner;
  });
  for (const name of ["Direct", "Parenthesized", "Conditional", "Expression"]) {
    const owner = name === "Expression"
      ? source.ast.as.AsVariableDeclaration(namedVariable(source.ast, file, name)).Initializer
      : namedDeclaration(source.ast, file, name);
    const uses = usesWithin(baseSummary, owner);
    assert.equal(uses.length === 1 && uses[0].kind === "first-class" && uses[0].role === "storage", true,
      `${name}: only the actual retained constructor value is stored.`);
  }
  for (const name of ["FromFactory", "FromOpaque"]) {
    const owner = namedDeclaration(source.ast, file, name);
    const uses = usesWithin(baseSummary, owner);
    assert.equal(uses.length === 1 && uses[0].role === "argument", true,
      `${name}: an actual input to a factory has no invented identity or no-invocation guarantee.`);
    const heritage = source.ast.extendsHeritageElements(owner)[0];
    const expression = source.ast.as.AsExpressionWithTypeArguments(heritage).Expression;
    const flow = source.navigation.expressionValueFlow(expression);
    assert.equal(flow.storedOutsideBinding && flow.escapes && !flow.hasUnclassifiedUse, true,
      `${name}: the actual returned base is retained, independently of its argument provenance.`);
  }
  for (const [name, declaration] of [
    ["Qualified", namedDeclaration(source.ast, file, "Member")],
    ["Imported", namedDeclaration(source.ast, projectSourceFile(source, "src/base.ts"), "ImportedBase")],
  ]) {
    const uses = usesWithin(source.navigation.declarationUseSummary(declaration), namedDeclaration(source.ast, file, name));
    assert.equal(uses.length === 1 && uses[0].role === "storage", true,
      `${name}: checked member/import identity reaches the actual retained base.`);
  }
  const other = source.navigation.declarationUseSummary(namedDeclaration(source.ast, file, "Other"));
  assert.equal(other.uses.length === 1 && other.uses[0].role === "storage", true,
    "Both conditional result alternatives retain their own constructor identities.");
  assert.equal(baseSummary.hasUnclassifiedValueUse, false, "A local runtime extends result is not an unknown external publication.");
  assert.equal(baseSummary.aliasedOrStored && baseSummary.escapeKinds.includes("storage"), true,
    "Class heritage still retains source storage and cannot erase constructor captures.");
  assert.equal(sourceDeclarationHasOnlyTypeUses(baseSummary), false, "Runtime class bases remain real runtime declarations.");
});

test("heritage type meaning reuses the canonical qualified declaration selection", async () => {
  const checked = await checkedSource("heritage-canonical-type-meaning", { "globals.d.ts": minimalSourceGlobals, "src/index.ts": `
interface Contract { value: number; }
interface Extended extends Contract {}
class Direct implements Contract { value = 1; }
namespace Library { export interface Shape { value: number; } }
class Qualified implements Library.Shape { value = 2; }
interface Argument { readonly value: number; }
class GenericBase<Value> { value!: Value; }
class GenericDerived extends GenericBase<Argument> {}
export {};
` });
  assert.equal(checked.diagnostics.length, 0, "The namespace-qualified and ordinary erased heritage forms are checked.");
  const source = createTargetSourceProgram(checked);
  const file = projectSourceFile(source, "src/index.ts");
  const library = requiredNode(source.ast, file, node => source.ast.is.IsModuleDeclaration(node) &&
    source.ast.text(source.ast.name(node)) === "Library");
  for (const [name, declaration] of [
    ["Contract", namedDeclaration(source.ast, file, "Contract")],
    ["Library", library],
    ["Shape", namedDeclaration(source.ast, file, "Shape")],
    ["Argument", namedDeclaration(source.ast, file, "Argument")],
  ]) {
    const summary = source.navigation.declarationUseSummary(declaration);
    assert.equal(summary.uses.length > 0 && summary.uses.every(use => use.kind === "type-only" && use.role === "type-only"), true,
      `${name}: both namespace and selected declaration keep canonical type meaning.`);
    assert.equal(summary.hasUnclassifiedValueUse || summary.escapeKinds.includes("storage"), false,
      `${name}: erased heritage never publishes a runtime constructor.`);
  }
  const generic = source.navigation.declarationUseSummary(namedDeclaration(source.ast, file, "GenericBase"));
  assert.equal(generic.uses.length === 1 && generic.uses[0].role === "storage", true,
    "The generic constructor is retained while its actual type argument stays erased.");
});

test("real export, return and opaque class arguments retain their independent escape obligations", async () => {
  const checked = await checkedSource("heritage-real-exposure", { "globals.d.ts": minimalSourceGlobals, "src/index.ts": `
export class PublishedBase { readonly value = 1; }
export class PublishedDerived extends PublishedBase {}
declare function opaque(value: typeof PublishedBase): void;
opaque(PublishedBase); opaque(PublishedDerived);
function create() {
  class CapturedBase { readonly value = 2; }
  class ReturnedDerived extends CapturedBase {}
  return ReturnedDerived;
}
export {};
` });
  assert.equal(checked.diagnostics.length, 0, "The actual external class values and inherited result are retained source.");
  const source = createTargetSourceProgram(checked);
  const file = projectSourceFile(source, "src/index.ts");
  for (const name of ["PublishedBase", "PublishedDerived"]) {
    const summary = source.navigation.declarationUseSummary(namedDeclaration(source.ast, file, name));
    assert.equal(summary.exported && summary.escapeKinds.includes("export") && summary.escapeKinds.includes("argument"), true,
      `${name}: export and opaque argument publication do not depend on unclassified heritage.`);
    assert.equal(sourceDeclarationHasOnlyTypeUses(summary), false, `${name}: external constructor values cannot be metadata-only.`);
  }
  const captured = source.navigation.declarationUseSummary(namedDeclaration(source.ast, file, "CapturedBase"));
  assert.equal(captured.aliasedOrStored && captured.escapeKinds.includes("storage"), true,
    "The returned Derived still retains its own actual base constructor.");
  const returned = source.navigation.declarationUseSummary(namedDeclaration(source.ast, file, "ReturnedDerived"));
  assert.equal(returned.escapeKinds.includes("return"), true, "Returning Derived remains a genuine value escape.");
  assert.equal(sourceDeclarationHasOnlyTypeUses(captured) || sourceDeclarationHasOnlyTypeUses(returned), false,
    "Neither retained constructor can be reclassified as erased metadata.");
});

test("native constructor comparisons remain runtime uses without inventing an external constructor publication", async () => {
  const checked = await checkedSource("constructor-comparison-use-roles", {
    "globals.d.ts": minimalSourceGlobals,
    "src/index.ts": `
      class Compared {}
      class Foreign {}
      declare function opaque(value: typeof Foreign): void;
      function inspect(value: object): boolean { return value instanceof Compared; }
      const created = new Compared();
      const matched = created instanceof Compared;
      opaque(Foreign);
      void Foreign;
      export {};
    `,
  });
  assert.equal(checked.diagnostics.length, 0, "the original native class identity checks and opaque constructor input are admitted source");
  const source = createTargetSourceProgram(checked);
  const file = projectSourceFile(source, "src/index.ts");
  const compared = source.navigation.declarationUseSummary(namedDeclaration(source.ast, file, "Compared"));
  assert.equal(compared.uses.filter(use => use.role === "comparison").length, 2,
    "both checked instanceof operands retain their real comparison occurrences");
  assert.equal(compared.uses.every(use => use.role === "comparison" || use.role === "call-target"), true,
    "constructor testing is neither an unclassified value escape nor erased type-only syntax");
  assert.equal(compared.identityCompared && !compared.hasUnclassifiedValueUse && compared.escapeKinds.length === 0, true,
    "comparison does not grant an external observer authority to mutate constructor inputs or instance fields");
  assert.equal(sourceDeclarationHasOnlyTypeUses(compared), false, "native runtime class identity remains retained");
  const foreign = source.navigation.declarationUseSummary(namedDeclaration(source.ast, file, "Foreign"));
  assert.equal(foreign.escapeKinds.includes("argument") && foreign.hasUnclassifiedValueUse, true,
    "an actual opaque argument and an independently unclassified value still retain both obligations");
});

test("checked spread operands retain their actual call or storage use without a purity promise", async () => {
  const checked = await checkedSource("checked-spread-use-roles", {
    "globals.d.ts": minimalSourceGlobals,
    "src/index.ts": `
      declare function opaque(value: number): void;
      function deliver(value: number): number { return value; }
      class Box { constructor(value: number) { void value; } }
      const callValues: [number] = [7]; const called = deliver(...callValues);
      const newValues: [number] = [8]; const created = new Box(...newValues);
      const arrayValues: number[] = [9]; const arrayCopy = [...arrayValues];
      const objectValues = { value: 10 }; const objectCopy = { ...objectValues };
      const opaqueValues: [number] = [11]; opaque(...opaqueValues);
      function callback(): number { return 12; }
      const uncalled = callback;
      export {};
    `,
  });
  assert.equal(checked.diagnostics.length, 0, "all actual finite spread sites are checked");
  const source = createTargetSourceProgram(checked);
  const file = projectSourceFile(source, "src/index.ts");
  for (const [name, role] of [["callValues", "argument"], ["newValues", "argument"],
    ["arrayValues", "storage"], ["objectValues", "storage"], ["opaqueValues", "argument"]]) {
    const summary = source.navigation.declarationUseSummary(namedVariable(source.ast, file, name));
    assert.equal(summary.uses.length === 1 && summary.uses[0].role === role, true,
      `${name}: the real owning checked operation supplies the use role`);
    assert.equal(summary.escapeKinds.includes(role), true, `${name}: spread traversal never suppresses its original escape`);
  }
  const callback = source.navigation.declarationUseSummary(namedDeclaration(source.ast, file, "callback"));
  assert.equal(callback.uses.length === 1 && callback.uses[0].kind === "first-class" && callback.uses[0].role === "storage", true,
    "a stored uncalled callback is not an executed source invocation");
  const opaque = source.navigation.declarationUseSummary(namedVariable(source.ast, file, "opaqueValues"));
  assert.equal(opaque.escapeKinds.includes("argument"), true, "an opaque argument gains no identity or no-invocation contract");
});

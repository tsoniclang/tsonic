import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createCompilerSessionFromFiles, createSourceSemanticsExtension, formatDiagnostics, sourcePrimitive, type Node } from "@tsonic/tsts";
import { Node_Expression } from "../../source-model/ast.js";
import { createSourceTypeFlowTestProgram } from "./type-flow-test-program.js";
import { sourceTypeDescriptorsEqual, sourceTypeDescriptorStructure } from "./terms.js";
import { sourceTypeFlowIsBroadSlot } from "./uses.js";
import type { SourceTypeDescriptor } from "./types.js";

// Host fact tests for the value-model share of SourceProgramFacts (nextgen plan §2, CONTRACT.md). Each test is a real
// TypeScript program; the assertions are on published Host facts only.
// `checkerDiagnostics`: the TypeScript diagnostic codes the program is expected to carry (a Host guard that TypeScript
// also rejects); empty for every ordinary fixture.
function fixture(text: string, checkerDiagnostics: readonly number[] = []) {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/node_modules/@test/words/package.json": JSON.stringify({ name: "@test/words", version: "1.0.0", type: "module", exports: { ".": "./index.d.ts" } }),
    "/src/node_modules/@test/words/index.d.ts": "export type int32 = number; export type int64 = bigint;",
    "/src/index.ts": `import type { int32, int64 } from "@test/words"; ${text}`,
  }, compilerOptions: { strict: true, target: "es2022", module: "esnext", moduleResolution: "bundler" },
  extensionHostOptions: { extensions: [createSourceSemanticsExtension({ modules: [{ moduleSpecifier: "@test/words", packageName: "@test/words",
    exports: [sourcePrimitive("int32", "int32", "number", true, 32), sourcePrimitive("int64", "int64", "bigint", true, 64)] }] })] } }).checkSource();
  assert.deepEqual(checked.diagnostics.map(issue => issue?.code), checkerDiagnostics,
    formatDiagnostics(checked.diagnostics.filter(issue => issue !== undefined)).slice(0, 2048));
  const source = createSourceTypeFlowTestProgram(checked);
  const facts = source.valueFacts;
  const file = checked.getSourceFile("/src/index.ts");
  if (file === undefined) throw new Error("The original source file is required.");
  const nodes: Node[] = [];
  const pending: Node[] = [file];
  while (pending.length > 0) {
    const node = pending.pop()!;
    nodes.push(node);
    const children = source.ast.children(node);
    for (let index = children.length - 1; index >= 0; index -= 1) if (children[index] !== undefined) pending.push(children[index]!);
  }
  const { ast } = source;
  const find = (predicate: (node: Node) => boolean, label: string): Node => {
    const found = nodes.find(predicate);
    if (found === undefined) throw new Error(`The original ${label} is required.`);
    return found;
  };
  const initializer = (name: string): Node => {
    const declaration = find(node => ast.is.IsVariableDeclaration(node) && ast.text(ast.name(node)!) === name, name);
    return ast.as.AsVariableDeclaration(declaration)!.Initializer!;
  };
  const resolved = (node: Node): SourceTypeDescriptor => {
    const outcome = facts.values.type(node);
    if (outcome.kind === "refused") throw new Error(`Resolved ${ast.kindName(node)} required: ${outcome.reason}`);
    return outcome.type;
  };
  // Identifier reads of a name (declaration names excluded).
  const reads = (name: string): readonly Node[] => nodes.filter(node => ast.is.IsIdentifier(node) && ast.text(node) === name &&
    ast.name(ast.parent(node)!) !== node);
  return { ast, facts, nodes, find, initializer, resolved, reads, source };
}

test("every value node of the program has a Host type outcome (I4)", () => {
  const { ast, facts, nodes } = fixture("const a: int32 = 1; const b = a + 2; function f(x: string): number { return x.length; } f(\"q\");");
  for (const node of nodes) {
    if (!ast.is.IsBinaryExpression(node) && !ast.is.IsCallExpression(node) && !ast.is.IsPropertyAccessExpression(node)) continue;
    const outcome = facts.values.type(node);
    assert.ok(outcome.kind === "resolved" || outcome.kind === "default" || outcome.kind === "refused");
  }
  assert.equal(Object.isFrozen(facts.refusals()), true);
});

test("an object literal written into a discriminated sum selects the arm whose literal discriminant matches (C-2479)", () => {
  const { facts, initializer } = fixture(`type Shape = { kind: "circle"; radius: int32 } | { kind: "square"; side: int32 };
    const s: Shape = { kind: "square", side: 2 };`);
  const literal = initializer("s");
  const relation = facts.relations.at(literal);
  assert.equal(relation?.kind, "select-arm");
  if (relation?.kind !== "select-arm") return;
  assert.equal(relation.arm, 1, "authored-first arm order: circle = 0, square = 1");
  assert.equal(relation.discriminant?.property, "kind");
  assert.equal(relation.discriminant?.value.text, "square");
  const sum = facts.sums.sum(relation.sum);
  assert.equal(sum.arms.length, 2);
});

test("typeof tests select the arms of the operand's sum that the test admits", () => {
  const { ast, facts, find } = fixture(`function f(v: string | int32): int32 { if (typeof v === "string") return 0; return v; }`);
  const comparison = find(node => ast.is.IsBinaryExpression(node) && ast.operatorKindName(node) === "KindEqualsEqualsEqualsToken", "typeof test");
  const relation = facts.relations.at(comparison);
  assert.equal(relation?.kind, "test");
  if (relation?.kind !== "test") return;
  assert.deepEqual([...relation.whenTrue], [0]);
  assert.equal(relation.outcome, "undecided");
});

test("an operator record carries its operands, its result and the primitive decision", () => {
  const { facts, initializer } = fixture("const a: int32 = 1; const b: int32 = 2; const c = a + b;");
  const record = facts.values.operator(initializer("c"));
  if ("kind" in record) throw new Error(record.message);
  assert.equal(record.operator, "+");
  assert.equal(record.operands.length, 2);
  assert.deepEqual(record.primitive, { result: "int32", operands: ["int32", "int32"] });
  assert.equal(record.admission, "admitted");
});

test("an element access record selects the array element and the access mode", () => {
  const { facts, initializer } = fixture("const xs: int32[] = [1, 2]; const y = xs[0];");
  const record = facts.values.elementAccess(initializer("y"));
  assert.deepEqual(record.selected, { kind: "element" });
  assert.equal(record.access, "read");
  assert.deepEqual(record.result, { kind: "primitive", primitive: "int32" });
});

test("typeof category follows the declared Source type and the authored nullish members (N3')", () => {
  const { ast, facts, find } = fixture("function g(v: string | null): string { return typeof v; }");
  const operation = find(node => ast.is.IsTypeOfExpression(node), "typeof");
  const operand = find(node => ast.is.IsIdentifier(node) && ast.text(node) === "v" && ast.is.IsTypeOfExpression(ast.parent(node)!), "operand");
  const admission = facts.values.typeofCategory(operation, operand);
  if (admission.kind === "refused") throw new Error(admission.message);
  assert.equal(admission.admission, "null-only");
  assert.equal(admission.category, "string");
  assert.equal(admission.sum, undefined);
});

test("a class constructor is a function for typeof even with static members; an instance is an object (K-2669)", () => {
  const { ast, facts, find } = fixture(
    "class C { static tag = 1; } class D {} function f(): boolean { return typeof C === \"function\"; } " +
    "function g(): boolean { return typeof D === \"function\"; } function h(): boolean { return typeof new C() === \"object\"; }");
  const typeofOf = (operandText: string) => {
    const operation = find(node => ast.is.IsTypeOfExpression(node) && ast.text(Node_Expression(ast, node)!) === operandText,
      `typeof ${operandText}`);
    const operand = Node_Expression(ast, operation)!;
    const admission = facts.values.typeofCategory(operation, operand);
    if (admission.kind === "refused") throw new Error(admission.message);
    return admission.category;
  };
  assert.equal(typeofOf("C"), "function", "a construct-only shape (class with a static member) is a function");
  assert.equal(typeofOf("D"), "function", "a class without members stays a function");
  assert.equal(typeofOf("new C()"), "object", "an instance is an object");
});

test("the awaited payload comes from the thenable declaration's payload binder, not from a checked awaited type", () => {
  const { ast, facts, find } = fixture("async function h(): Promise<int32> { return 1; } async function k(): Promise<void> { const r = await h(); }");
  const awaited = find(node => ast.is.IsAwaitExpression(node), "await");
  const outcome = facts.values.awaited(awaited);
  assert.equal(outcome.kind === "refused" ? undefined : outcome.type.kind === "primitive" ? outcome.type.primitive : outcome.type.kind, "int32");
});

test("sums.sumOf answers the closed sum of a published union descriptor in authored-first order (C-2459)", () => {
  const { facts, initializer, resolved } = fixture("const u: string | int32 = 1; const w = u;");
  const sum = facts.sums.sumOf(resolved(initializer("w")));
  assert.notEqual(sum, undefined);
  assert.deepEqual(sum!.arms.map(arm => arm.type.kind), ["string", "primitive"]);
  assert.equal(facts.sums.sumOf({ kind: "string" }), undefined);
});

// ---- I3: no checker reads in local-type-flow production ------------------------------------------------------------

const here = path.dirname(fileURLToPath(import.meta.url));
const flowRoot = here.includes(`${path.sep}dist${path.sep}`)
  ? path.join(here, "..", "..", "..", "src", "source-semantics", "local-type-flow") : here;

test("I3: local-type-flow production files read no checker type, signature, symbol or query", () => {
  const files = fs.readdirSync(flowRoot).filter(name => name.endsWith(".ts") && !name.endsWith(".test.ts") &&
    name !== "type-flow-test-program.ts").map(name => path.join(flowRoot, name));
  assert.equal(files.length > 15, true, "the scan sees the type-flow sources");
  const checkerNames = /^(Type|Signature|Symbol|TypeCheckerQueries|TypeShapeQueries|SourceFileQueries|Resolved\w+|Type\w*Info)$/u;
  const forbidden: readonly RegExp[] = [
    /\bsemantics\b/u, /\bSourceFileSemantics\b/u, /\bSourceTypeComponentEvidence\b/u, /\bexpressionType\b/u,
    /\b(?:queries|query|caller|formalQuery)\.(?:types|declarations|operations|facts|propertyNames)\b/u, /\bgetSourceFileQueries\b/u, /\.checker\b/u,
    /from "\.\.\/(types|type-arguments|array-types|selected-property-declarations|object-literal-correspondence|call-result-selection)\.js"/u,
    // R3 provenance (REVIEW-R1 #24): checker-inferred awaited, read and write types and the checker absence/result
    // helpers never cross into the value model; awaited payloads, access components and absence are Host rules.
    /\bawaitedType\b/u, /\bsourceReadType\b/u, /\bsourceWriteType\b/u, /\bcallResultType\b/u, /\bisPresent\(/u, /\badmitsAbsence\(/u,
  ];
  const violations: string[] = [];
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    for (const match of text.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+"@tsonic\/tsts"/gu)) {
      for (const entry of match[1]!.split(",")) {
        const name = entry.trim().replace(/^type\s+/u, "").split(/\s+as\s+/u)[0]!.trim();
        if (name.length > 0 && checkerNames.test(name)) violations.push(`${path.basename(file)}: imports ${name}`);
      }
    }
    for (const line of text.split("\n")) {
      if (line.trimStart().startsWith("//") || line.trimStart().startsWith("*")) continue;
      for (const pattern of forbidden) if (pattern.test(line)) violations.push(`${path.basename(file)}: ${line.trim()}`);
    }
  }
  assert.deepEqual(violations, []);
});

// ---- values: domain, authored type nodes, contextual destinations -------------------------------------------------

test("values.has covers value nodes, declarations and authored type nodes; type() describes an authored type node", () => {
  const { ast, facts, find } = fixture("const a: int32 = 1;");
  const declaration = find(node => ast.is.IsVariableDeclaration(node), "declaration");
  const annotation = ast.typeNode(declaration)!;
  assert.equal(facts.values.has(declaration), true);
  assert.equal(facts.values.has(annotation), true);
  const outcome = facts.values.type(annotation);
  assert.equal(outcome.kind !== "refused" && outcome.type.kind === "primitive" && outcome.type.primitive === "int32", true);
  assert.equal(facts.values.has(find(node => ast.is.IsSourceFile(node), "file")), false);
});

test("an authored constraint is described from its syntax", () => {
  const { ast, facts, find } = fixture("function f<T extends string>(x: T): T { return x; }");
  const parameter = find(node => ast.is.IsTypeParameterDeclaration(node), "type parameter");
  const constraint = ast.as.AsTypeParameterDeclaration(parameter)!.Constraint!;
  const outcome = facts.values.type(constraint);
  assert.equal(outcome.kind !== "refused" && outcome.type.kind, "string");
});

test("values.contextual is the Host slot a value flows into (declared variable, parameter)", () => {
  const { ast, facts, initializer, find } = fixture("const a: int32 = 1; function f(x: int64): void {} f(2n);");
  const declared = facts.values.contextual(initializer("a"));
  assert.equal(declared !== undefined && declared.kind !== "refused" && declared.type.kind === "primitive" &&
    declared.type.primitive === "int32", true);
  const argument = find(node => ast.is.IsBigIntLiteral(node), "argument");
  const parameter = facts.values.contextual(argument);
  assert.equal(parameter !== undefined && parameter.kind !== "refused" && parameter.type.kind === "primitive" &&
    parameter.type.primitive === "int64", true);
});

// ---- one destination domain for contextual and admission (WP0 A3, K-2678, D4) ---------------------------------------
// Basis: N3′ (PLAN §10), WP0 A3. Every use the Host admits into a broad slot has that slot as its `values.contextual`
// destination, as the identical descriptor of `admission.destination` and `slot(admission.slot).type`; a use outside
// the domain has no admission, and asking for one is an invariant failure, never a silent "none".

const erasureUseForms = `declare function take(value: unknown): void;
  declare function many(...values: unknown[]): void;
  declare function generic<T>(value: T): void;
  function run(): unknown {
    const original = 1152921504606846976;
    const declared: unknown = original;
    take(original);
    many(original, original);
    generic<unknown>(original);
    const array: unknown[] = [original];
    const object: { field: unknown } = { field: original };
    let assigned: unknown;
    assigned = original;
    void declared; void array; void object; void assigned;
    return original;
  }`;

test("D4: every admitted use (declared, argument, rest, generic, array element, property, write, return) has its slot as the one destination", () => {
  const { ast, facts, reads, source } = fixture(erasureUseForms);
  const uses = reads("original");
  // declared, take, many ×2, generic, array element, property, assignment, return.
  assert.equal(uses.length, 9);
  const forms = uses.map(use => ast.kindName(ast.parent(use)!));
  for (const [index, use] of uses.entries()) {
    const form = `${forms[index]} at ${ast.pos(use)}`;
    const admission = facts.values.admission(use);
    assert.equal(admission.kind, "admitted", `${form}: the broad use is admitted`);
    if (admission.kind !== "admitted") continue;
    assert.equal(admission.use, use, `${form}: the admission belongs to this occurrence`);
    assert.equal(admission.conversion.kind, "exact-number-erasure", `${form}: an exact Q1 int64 erases at every broad use form`);
    const contextual = facts.values.contextual(use);
    const slot = facts.values.slot(admission.slot);
    assert.equal(contextual !== undefined && contextual.kind !== "refused" && contextual.type === admission.destination, true,
      `${form}: values.contextual is the admission's destination (the identical descriptor)`);
    assert.equal(slot.kind === "slot" && slot.slot === admission.slot && slot.broad && slot.type === admission.destination, true,
      `${form}: the destination is the admission slot's published broad descriptor`);
    assert.equal(facts.values.contextual(use), contextual, `${form}: the destination is published once`);
    assert.equal(Object.isFrozen(contextual), true);
    // A use the declared-slots reader does not name (association component only) is answered from its admission; one
    // it names carries the same descriptor.
    const declaredSlot = source.effectiveTypes.contextual(use);
    assert.equal(declaredSlot === undefined || declaredSlot.kind !== "refused" &&
      sourceTypeDescriptorsEqual(declaredSlot.type, admission.destination), true, `${form}: the two Host readers agree`);
  }
  assert.equal(facts.refusals().length, 0);
});

test("D4: a use outside the domain has no admission (operand, non-broad destination); asking for one is an invariant", () => {
  const { ast, facts, nodes } = fixture(`declare function identity<T>(value: T): T;
  function run(): boolean {
    const original = 1152921504606846976;
    return identity(original) === original;
  }`);
  const reads = nodes.filter(node => ast.is.IsIdentifier(node) && ast.text(node) === "original" && ast.name(ast.parent(node)!) !== node);
  assert.equal(reads.length, 2);
  const [argument, operand] = reads as [Node, Node];
  // The argument's Host destination is the instantiated binder (int64), not a broad slot.
  const narrow = facts.values.contextual(argument);
  assert.equal(narrow === undefined || narrow.kind !== "refused" && !sourceTypeFlowIsBroadSlot(narrow.type), true,
    "a non-broad Host destination is outside the admission domain");
  assert.throws(() => facts.values.admission(argument), /no Host slot admission at this use: it flows into no broad Host slot/u);
  assert.equal(facts.values.contextual(operand), undefined, "an operation operand flows into no Host slot");
  assert.throws(() => facts.values.admission(operand), /no Host slot admission at this use: it flows into no broad Host slot/u);
});

test("D4: a refused admission keeps its destination in the domain; the refusal is collected upfront", () => {
  const { ast, facts, initializer } = fixture(`function run(): void {
    const original = 9007199254740993;
    const erased: unknown = original;
    void erased;
  }`);
  const use = initializer("erased");
  const admission = facts.values.admission(use);
  assert.equal(admission.kind === "refused" && admission.refusal.code === "TSONIC_LOCAL_TYPE_NUMBER_ERASURE_INEXACT", true);
  const contextual = facts.values.contextual(use);
  const slot = facts.values.slot(admission.slot);
  assert.equal(contextual !== undefined && contextual.kind !== "refused" && slot.kind === "slot" && slot.broad &&
    contextual.type === slot.type, true, "the refused use still names its broad Host destination");
  assert.equal(facts.refusals().some(issue => issue.code === "TSONIC_LOCAL_TYPE_NUMBER_ERASURE_INEXACT" && issue.site === use), true,
    `refusals() carries the refusal before any target reads the use (${ast.kindName(use)})`);
});

// ---- relations -----------------------------------------------------------------------------------------------------

test("a typeof-narrowed read of a declared sum extracts the selected arm (narrowed-arms witness over Host arms)", () => {
  const { ast, facts, reads } = fixture("function f(v: string | int32): int32 { if (typeof v === \"string\") { return 0; } return v; }");
  const narrowed = reads("v").find(node => ast.is.IsReturnStatement(ast.parent(node)!));
  assert.notEqual(narrowed, undefined);
  const outcome = facts.values.type(narrowed!);
  assert.equal(outcome.kind !== "refused" && outcome.type.kind === "primitive" && outcome.type.primitive === "int32", true);
  const relation = facts.relations.at(narrowed!);
  assert.equal(relation?.kind, "extract-arm");
  if (relation?.kind === "extract-arm") assert.equal(relation.arm, 1, "authored-first: string = 0, int32 = 1");
});

test("an unannotated destructuring reads its bindings from the initializer's Host descriptor", () => {
  const { ast, facts, find } = fixture("function f(): void { const pair: [int32, string] = [1, \"a\"]; const [n, t] = pair; }");
  const binding = (name: string) => find(node => ast.is.IsBindingElement(node) && ast.text(ast.name(node)!) === name, name);
  const first = facts.values.type(binding("n"));
  const second = facts.values.type(binding("t"));
  assert.equal(first.kind !== "refused" && first.type.kind === "primitive" && first.type.primitive === "int32", true);
  assert.equal(second.kind !== "refused" && second.type.kind, "string");
});

// ---- sums ----------------------------------------------------------------------------------------------------------

test("sums.sumOf answers an optional union read with its registered sum (A11)", () => {
  const { facts, initializer, resolved } = fixture("function f(v?: string | int32): void { const w = v; }");
  const type = resolved(initializer("w"));
  assert.equal(type.kind === "optional" || type.kind === "union", true);
  const sum = facts.sums.sumOf(type);
  assert.notEqual(sum, undefined);
  assert.equal(sum!.arms.length >= 2, true);
  assert.equal(facts.sums.sumOf({ kind: "optional", value: { kind: "string" } }), undefined, "an option is not a sum");
});

// ---- instantiations ------------------------------------------------------------------------------------------------

test("a call with explicit type arguments publishes its instantiation", () => {
  const { ast, facts, find } = fixture("function id<T>(x: T): T { return x; } const n = id<int32>(1);");
  const call = find(node => ast.is.IsCallExpression(node), "call");
  const instantiation = facts.instantiations.at(call);
  assert.equal(instantiation?.kind, "call");
  if (instantiation?.kind !== "call") return;
  assert.deepEqual(instantiation.method.map(argument => argument.type), [{ kind: "primitive", primitive: "int32" }]);
  assert.deepEqual(instantiation.result, { kind: "primitive", primitive: "int32" });
});

test("a generic function value is instantiated against its destination's call signature", () => {
  const { ast, facts, reads } = fixture("function id<T>(x: T): T { return x; } const f: (x: int32) => int32 = id;");
  const value = reads("id").find(node => !ast.is.IsCallExpression(ast.parent(node)!));
  assert.notEqual(value, undefined);
  const instantiation = facts.instantiations.at(value!);
  assert.equal(instantiation?.kind, "function-value");
  if (instantiation?.kind !== "function-value") return;
  assert.equal(ast.is.IsFunctionDeclaration(instantiation.signature), true);
  assert.deepEqual(instantiation.method.map(argument => argument.type), [{ kind: "primitive", primitive: "int32" }]);
  assert.deepEqual(instantiation.parameters, [{ kind: "primitive", primitive: "int32" }]);
  assert.deepEqual(instantiation.result, { kind: "primitive", primitive: "int32" });
});

test("a generic function value without a determining destination is refused at its use", () => {
  const { ast, facts, reads } = fixture("function id<T>(x: T): T { return x; } const g = id;");
  const value = reads("id").find(node => !ast.is.IsCallExpression(ast.parent(node)!));
  const instantiation = facts.instantiations.at(value!);
  assert.equal(instantiation?.kind, "refused");
  if (instantiation?.kind === "refused") assert.equal(instantiation.code, "TSONIC_LOCAL_TYPE_GENERIC");
});

// ---- refusals and obligations --------------------------------------------------------------------------------------

test("refusals() is one frozen, duplicate-free collection; obligations are checker-free frozen records", () => {
  const { facts } = fixture("const o: { a: int32 } = { a: 1 }; function f(x: int32): int32 { return x; } f(o.a);");
  const refusals = facts.refusals();
  assert.equal(Object.isFrozen(refusals), true);
  assert.equal(new Set(refusals).size, refusals.length);
  const allowed = new Set(["kind", "site", "type", "required", "requiredType", "value", "valueType", "authority", "call",
    "parameter", "argument", "valueVariable"]);
  for (const obligation of facts.obligations()) {
    assert.equal(Object.isFrozen(obligation), true);
    for (const key of Object.keys(obligation)) assert.equal(allowed.has(key), true, `unexpected obligation field ${key}`);
  }
});

// ---- A4: decided guard tests (supervisor item; C# folds only a decided outcome) ------------------------------------

const testAt = (facts: ReturnType<typeof fixture>["facts"], node: Node) => {
  const relation = facts.relations.at(node);
  if (relation?.kind !== "test") throw new Error(`A test relation is required, got ${relation?.kind ?? "none"}.`);
  return relation;
};
const binaries = (ast: ReturnType<typeof fixture>["ast"], nodes: readonly Node[]) =>
  nodes.filter(node => ast.is.IsBinaryExpression(node) && ast.operatorKindName(node) !== "KindEqualsToken");

test("typeof tests on non-sum operands are decided by the N3' category: Q1 number vs explicit int64", () => {
  const { ast, facts, nodes } = fixture(`function f(w: int64): void {
    const a = 1; const s = "x";
    if (typeof a === "number") {} if (typeof a === "bigint") {} if (typeof w === "bigint") {} if (typeof w === "number") {}
    if (typeof s === "string") {} if (typeof s !== "string") {} }`);
  const outcomes = binaries(ast, nodes).map(node => testAt(facts, node).outcome);
  assert.deepEqual(outcomes, ["always-true", "always-false", "always-true", "always-false", "always-true", "always-false"]);
  const first = testAt(facts, binaries(ast, nodes)[0]!);
  assert.equal(first.sum, undefined);
  assert.deepEqual([...first.whenTrue], []);
});

test("typeof on unknown, any and a union admitting both outcomes stays undecided", () => {
  const { ast, facts, nodes } = fixture(`function f(u: unknown, v: string | int32): void {
    if (typeof u === "string") {} if (typeof v === "string") {} }`);
  assert.deepEqual(binaries(ast, nodes).map(node => testAt(facts, node).outcome), ["undecided", "undecided"]);
});

test("partial sums: a test is decided when all or none of the arms match", () => {
  const { ast, facts, nodes } = fixture(`function f(v: string | int32, w: boolean | string): void {
    if (typeof v === "boolean") {} if (typeof w === "string") {} if (typeof v !== "symbol") {} }`);
  const relations = binaries(ast, nodes).map(node => testAt(facts, node));
  assert.deepEqual(relations.map(relation => relation.outcome), ["always-false", "undecided", "always-true"]);
  assert.deepEqual([...relations[1]!.whenTrue], [1]);
  assert.notEqual(relations[1]!.sum, undefined);
});

test("instanceof is decided only from a proven class relation", () => {
  const { ast, facts, nodes } = fixture(`class Base {} class Child extends Base {} class Other {}
    function f(c: Child, b: Base, o: Other): void { if (c instanceof Base) {} if (b instanceof Child) {} if (o instanceof Base) {} }`);
  const outcomes = binaries(ast, nodes).filter(node => ast.operatorKindName(node) === "KindInstanceOfKeyword")
    .map(node => testAt(facts, node).outcome);
  assert.deepEqual(outcomes, ["always-true", "undecided", "always-false"]);
});

test("a nullish test on a never-absent operand is always false; an option stays undecided", () => {
  const { ast, facts, nodes } = fixture(`function f(s: string, o?: string): void { if (s === null) {} if (o === undefined) {} }`);
  assert.deepEqual(binaries(ast, nodes).map(node => testAt(facts, node).outcome), ["always-false", "undecided"]);
});

// ---- A4: per-arm members, spread writes, discriminant spreads -------------------------------------------------------

test("a per-arm member read resolves a type-parameter arm (no definition) through its declared constraint", () => {
  const { ast, facts, find } = fixture(`function f<T extends { size: int32 }>(v: T | string[]): int32 { return v.length === 0 ? 0 : 1; }
    function g<T extends { size: int32 }>(v: T | { size: int32 }): int32 { return v.size; }`);
  const access = find(node => ast.is.IsPropertyAccessExpression(node) && ast.text(ast.name(node)!) === "size" &&
    ast.is.IsReturnStatement(ast.parent(node)!), "v.size");
  const relation = facts.relations.at(access);
  assert.equal(relation?.kind, "per-arm");
  if (relation?.kind !== "per-arm") return;
  assert.equal(relation.arms.length, 2);
  for (const arm of relation.arms) {
    assert.notEqual(arm.member, undefined, "every arm names its member declaration");
    assert.equal(ast.is.IsPropertySignatureDeclaration(arm.member!), true);
  }
});

test("a spread of an array into a union element slot writes every element into one selected arm", () => {
  const { ast, facts, find } = fixture(`const xs: int32[] = [1]; const ys: (string | int32)[] = [...xs];`);
  const spread = find(node => ast.is.IsSpreadElement(node), "spread");
  const relation = facts.relations.at(spread);
  assert.equal(relation?.kind, "select-arm");
  if (relation?.kind === "select-arm") assert.equal(relation.arm, 1, "authored-first: string = 0, int32 = 1");
});

test("a spread whose elements select different union arms is refused", () => {
  const { ast, facts, find } = fixture(`const pair: [int32, string] = [1, "a"]; const ys: (string | int32)[] = [...pair];`);
  const relation = facts.relations.at(find(node => ast.is.IsSpreadElement(node), "spread"));
  assert.equal(relation?.kind, "refused");
  if (relation?.kind === "refused") assert.equal(relation.code, "TSONIC_LOCAL_TYPE_UNION");
});

test("D-8: a later own discriminant decides over an earlier spread; a later spread that may override refuses", () => {
  const { facts, initializer } = fixture(`type U = { kind: "a"; x: int32 } | { kind: "b"; x: int32 };
    const base: { x: int32 } = { x: 1 }; const other: { kind: string; x: int32 } = { kind: "a", x: 1 };
    const s: U = { ...base, kind: "b" }; const t: U = { kind: "a", ...other };`);
  const selected = facts.relations.at(initializer("s"));
  assert.equal(selected?.kind, "select-arm");
  if (selected?.kind === "select-arm") assert.equal(selected.arm, 1);
  assert.equal(facts.relations.at(initializer("t"))?.kind, "refused");
});

// ---- A4: element access records ------------------------------------------------------------------------------------

test("element access selects index signatures by original identity, members by name and refuses mixed union receivers", () => {
  const { facts, initializer } = fixture(`const r: { [key: string]: int32 } = {}; const a = r["k"];
    const xs: int32[] = [1]; const n = xs["length"];
    function f(u: int32[] | [string, string]): void { const e = u[0]; }`);
  const index = facts.values.elementAccess(initializer("a"));
  assert.equal(index.selected.kind, "index-signature");
  const length = facts.values.elementAccess(initializer("n"));
  assert.equal(length.selected.kind, "member");
  const mixed = facts.values.type(initializer("e"));
  assert.equal(mixed.kind, "refused");
  if (mixed.kind === "refused") assert.equal(mixed.code, "TSONIC_LOCAL_TYPE_UNION");
  assert.equal(facts.refusals().some(refusal => refusal.site === initializer("e")), true);
});

// ---- A4: super-call instantiation (R-F5-2) -------------------------------------------------------------------------

test("super(...) binds the base class binders from the authored extends type arguments", () => {
  const { ast, facts, find } = fixture(`class Box<T> { constructor(public value: T) {} }
    class IntBox extends Box<int32> { constructor() { super(1); } }`);
  const call = find(node => ast.is.IsCallExpression(node) && ast.kindName(ast.as.AsCallExpression(node)!.Expression) === "KindSuperKeyword", "super");
  const instantiation = facts.instantiations.at(call);
  assert.equal(instantiation?.kind, "call");
  if (instantiation?.kind !== "call") return;
  assert.deepEqual(instantiation.receiver.map(argument => argument.type), [{ kind: "primitive", primitive: "int32" }]);
  assert.deepEqual(instantiation.parameters, [{ kind: "primitive", primitive: "int32" }]);
});

// ---- K-2657: typeof sites with per-arm categories -------------------------------------------------------------------

const site = (facts: ReturnType<typeof fixture>["facts"], ast: ReturnType<typeof fixture>["ast"], node: Node) => {
  const operand = Node_Expression(ast, node)!;
  return facts.values.typeofCategory(node, operand);
};
const typeofs = (ast: ReturnType<typeof fixture>["ast"], nodes: readonly Node[]) => nodes.filter(node => ast.is.IsTypeOfExpression(node));

test("typeof site: a Q1 number and an explicit int64 have different categories, transported through locals, calls and generics", () => {
  const { ast, facts, nodes } = fixture(`function one() { return 1; } function id<T>(x: T): T { return x; }
    function f(w: int64): void { const a = 1; const c = a; const d = one(); const e = id(1);
      const r1 = typeof a; const r2 = typeof w; const r3 = typeof c; const r4 = typeof d; const r5 = typeof e; }`);
  const categories = typeofs(ast, nodes).map(node => {
    const record = site(facts, ast, node);
    return record.kind === "refused" ? record.code : record.category;
  });
  assert.deepEqual(categories, ["number", "bigint", "number", "number", "number"]);
});

test("typeof site: a narrowed read keeps the extracted arm's own category", () => {
  const { ast, facts, nodes } = fixture(`function f(u: string | int64): string { if (typeof u !== "string") { return typeof u; } return ""; }`);
  const record = site(facts, ast, typeofs(ast, nodes)[1]!);
  assert.equal(record.kind === "refused" ? record.code : record.category, "bigint");
});

test("typeof site: a sum operand publishes every role and every closed arm with its own category (A7)", () => {
  const { ast, facts, nodes } = fixture(`type Expanded<T> = boolean | T;
    function f(x: Expanded<string | int32>): string { return typeof x; }`);
  const record = site(facts, ast, typeofs(ast, nodes)[0]!);
  if (record.kind === "refused") throw new Error(record.message);
  assert.equal(record.category, undefined);
  assert.notEqual(record.sum, undefined);
  const expanded = record.sum!.roles.find(role => role.arms.length === 2);
  assert.notEqual(expanded, undefined, "the binder role expands to two closed arms");
  assert.deepEqual(expanded!.arms.map(arm => arm.category), ["string", "number"]);
  assert.deepEqual([...expanded!.categories], ["string", "number"]);
});

test("typeof site: a value joined from a number and an explicit int64 into one arm is refused", () => {
  const { ast, facts, nodes } = fixture(`function f(c: boolean, w: int64): string { const m = c ? 1 : w; return typeof m; }`);
  const record = site(facts, ast, typeofs(ast, nodes)[0]!);
  assert.equal(record.kind, "refused");
  if (record.kind === "refused") assert.equal(record.code, "TSONIC_LOCAL_TYPE_UNION");
});

// ---- K-2665: N7 is scoped to the undefined comparison on a proven both-nullish operand (PLAN.md §10 N7) --------------

const typeofComparisons = (ast: ReturnType<typeof fixture>["ast"], nodes: readonly Node[]) =>
  typeofs(ast, nodes).map(node => ({ site: node, comparison: ast.parent(node)! }));

test("typeof comparisons other than 'undefined' stay admitted on unknown, both-nullish, aliased and narrowed operands", () => {
  const { ast, facts, nodes } = fixture(`type MaybeText = string | null | undefined;
    function a(v: unknown): void { if (typeof v === "string") {} }
    function b(v: string | null | undefined): void { if (typeof v === "string") {} }
    function c(v: MaybeText): void { if (typeof v === "string") {} }
    function d(v: string | null | undefined): void { if (v != null) { if (typeof v === "string") {} } }
    function e(v: string | null | undefined): void { if (typeof v === "object") {} if (typeof v !== "number") {} }`);
  const uses = typeofComparisons(ast, nodes);
  assert.equal(uses.length, 6);
  const comparisons = uses.map(use => use.comparison);
  assert.deepEqual(comparisons.map(node => facts.relations.at(node)?.kind), ["test", "test", "test", "test", "test", "test"]);
  assert.deepEqual(facts.refusals().filter(refusal => comparisons.includes(refusal.site)), [], "no refusal at an admitted comparison");
  // The Host record says the category or admission is unproven; it never refuses for the admission.
  const records = uses.map(use => site(facts, ast, use.site));
  for (const record of records) assert.equal(record.kind, "typeof-site");
  const admitted = records.filter((_, index) => index !== 3)
    .map(record => record.kind === "refused" ? record.code : [record.admission, record.category]);
  assert.deepEqual(admitted, [["unavailable", undefined], ["both", "string"], ["both", "string"], ["both", "string"], ["both", "string"]]);
  const outcomes = comparisons.filter((_, index) => index !== 3).map(node => testAt(facts, node).outcome);
  assert.deepEqual(outcomes, ["undecided", "undecided", "undecided", "undecided", "always-true"]);
});

test("typeof 'undefined' comparisons are decided on undefined-only and null-only operands", () => {
  const { ast, facts, nodes } = fixture(`function u(v: string | undefined): void { if (typeof v === "undefined") {} }
    function o(v?: string): void { if (typeof v !== "undefined") {} }
    function n(v: string | null): void { if (typeof v === "undefined") {} if (typeof v === "object") {} }`);
  const uses = typeofComparisons(ast, nodes);
  const comparisons = uses.map(use => use.comparison);
  assert.deepEqual(uses.map(use => {
    const record = site(facts, ast, use.site);
    return record.kind === "refused" ? record.code : record.admission;
  }), ["undefined-only", "undefined-only", "null-only", "null-only"]);
  assert.deepEqual(comparisons.map(node => testAt(facts, node).outcome), ["undecided", "undecided", "always-false", "undecided"]);
  assert.deepEqual(facts.refusals().filter(refusal => comparisons.includes(refusal.site)), []);
});

test("N7: a typeof 'undefined' comparison on an operand admitting both null and undefined is the one Source refusal", () => {
  const { ast, facts, nodes } = fixture(`type MaybeText = string | null | undefined;
    function b(v: string | null | undefined): void { if (typeof v === "undefined") {} }
    function c(v: MaybeText): void { if (typeof v !== "undefined") {} }
    function r(v: string | null | undefined): void { if ("undefined" == typeof v) {} }`);
  const uses = typeofComparisons(ast, nodes);
  assert.equal(uses.length, 3);
  for (const use of uses) {
    const relation = facts.relations.at(use.comparison);
    assert.equal(relation?.kind, "refused");
    if (relation?.kind !== "refused") continue;
    assert.equal(relation.code, "TSONIC_LOCAL_TYPE_UNION");
    assert.equal(relation.site, use.comparison, "the refusal names the comparison, not the declaration");
    assert.match(relation.message, /cannot separate null from undefined/u);
    assert.equal(facts.refusals().filter(refusal => refusal.site === use.comparison && refusal.code === relation.code).length, 1);
    // The typeof record of the same site stays a fact: admission "both", category of the present value.
    const record = site(facts, ast, use.site);
    assert.equal(record.kind === "refused" ? record.code : record.admission, "both");
  }
});

// ---- K-2676: the nullish admission applies actual type arguments; an unproven constituent is "unavailable" ----------
// The admission comes from the intrinsic null / undefined constituents of the value read at the operand (host-input
// nullish-components, before the one-absence erasure), never from an alias body walked without its arguments.

const admissionsOf = (fixed: ReturnType<typeof fixture>) => typeofComparisons(fixed.ast, fixed.nodes).map(use => {
  const record = site(fixed.facts, fixed.ast, use.site);
  return record.kind === "refused" ? record.code : record.admission;
});
// N7: the comparison is the one refusal (TSONIC_LOCAL_TYPE_UNION at the comparison), the typeof record stays "both".
const assertBothRefused = (fixed: ReturnType<typeof fixture>, comparison: Node, label: string) => {
  const relation = fixed.facts.relations.at(comparison);
  assert.equal(relation?.kind, "refused", label);
  if (relation?.kind !== "refused") return;
  assert.equal(relation.code, "TSONIC_LOCAL_TYPE_UNION", label);
  assert.equal(relation.site, comparison, label);
  assert.match(relation.message, /cannot separate null from undefined/u, label);
  assert.equal(fixed.facts.refusals().filter(refusal => refusal.site === comparison && refusal.code === relation.code).length, 1, label);
};

test("K-2676: a generic alias applies its actual type argument in both directions (T | null with undefined, T | undefined with null)", () => {
  const fixed = fixture(`type Maybe<T> = T | null;
    type Opt<T> = T | undefined;
    type Wrap<U> = Maybe<U>;
    function a(value: Maybe<undefined>): boolean { return typeof value === "undefined"; }
    function b(value: Opt<null>): boolean { return typeof value === "undefined"; }
    function c(value: Maybe<string | undefined>): boolean { return typeof value === "undefined"; }
    function d(value: Opt<string | null>): boolean { return typeof value !== "undefined"; }
    function e(value: Wrap<string | undefined>): boolean { return typeof value === "undefined"; }
    function f(value: Maybe<string>): boolean { return typeof value === "undefined"; }
    function g(value: Opt<string>): boolean { return typeof value === "undefined"; }`);
  const uses = typeofComparisons(fixed.ast, fixed.nodes);
  assert.equal(uses.length, 7);
  assert.deepEqual(admissionsOf(fixed), ["both", "both", "both", "both", "both", "null-only", "undefined-only"],
    "the binder's actual argument contributes its intrinsics; the alias body alone is not the answer");
  for (const [index, label] of ["Maybe<undefined>", "Opt<null>", "Maybe<string | undefined>", "Opt<string | null>",
    "Wrap<string | undefined> (argument passed through a second alias)"].entries()) {
    assertBothRefused(fixed, uses[index]!.comparison, label);
  }
  // Opposites: the same aliases closed with a present value keep the one intrinsic of the body.
  assert.deepEqual(uses.slice(5).map(use => testAt(fixed.facts, use.comparison).outcome), ["always-false", "undecided"]);
  assert.deepEqual(fixed.facts.refusals().filter(refusal => uses.slice(5).some(use => use.comparison === refusal.site)), []);
});

test("K-2676: generic member and call-result annotations apply the receiver's and the call's type arguments", () => {
  const fixed = fixture(`interface Box<T> { value: T | null; read(): T | undefined; }
    function make<T>(value: T): T | null { return value; }
    function m(box: Box<string | undefined>): boolean { return typeof box.value === "undefined"; }
    function n(box: Box<string | null>): boolean { return typeof box.read() === "undefined"; }
    function r(text: string | undefined): boolean { return typeof make(text) === "undefined"; }
    function p(box: Box<string>): boolean { return typeof box.value === "undefined"; }
    function q(box: Box<string>): boolean { return typeof box.read() === "undefined"; }
    function s(text: string): boolean { return typeof make(text) === "undefined"; }`);
  const uses = typeofComparisons(fixed.ast, fixed.nodes);
  assert.equal(uses.length, 6);
  assert.deepEqual(admissionsOf(fixed), ["both", "both", "both", "null-only", "undefined-only", "null-only"]);
  for (const [index, label] of ["member T | null with T = string | undefined", "method result T | undefined with T = string | null",
    "call result T | null with T inferred string | undefined"].entries()) {
    assertBothRefused(fixed, uses[index]!.comparison, label);
  }
  assert.deepEqual(uses.slice(3).map(use => testAt(fixed.facts, use.comparison).outcome), ["always-false", "undecided", "always-false"]);
});

test("K-2676: direct, null-only and undefined-only operands through declarations, optional members, unannotated ?? and conditional locals", () => {
  const fixed = fixture(`interface Shape { label?: string; note: string | null; }
    function direct(v: string | null | undefined): boolean { return typeof v === "string"; }
    function nulls(v: string | null): boolean { return typeof v === "string"; }
    function missing(v: string | undefined): boolean { return typeof v === "string"; }
    function optional(shape: Shape): boolean { return typeof shape.label === "string"; }
    function chain(shape: Shape | undefined): boolean { return typeof shape?.note === "string"; }
    function local(shape: Shape): boolean { const note = shape.note; return typeof note === "string"; }
    function coalesce(a: string | undefined, b: string | null): boolean { const joined = a ?? b; return typeof joined === "string"; }
    function choose(c: boolean, a: string | undefined, b: string | null): boolean { const chosen = c ? a : b; return typeof chosen === "string"; }`);
  assert.deepEqual(admissionsOf(fixed),
    ["both", "null-only", "undefined-only", "undefined-only", "both", "null-only", "null-only", "both"]);
  const comparisons = typeofComparisons(fixed.ast, fixed.nodes).map(use => use.comparison);
  assert.deepEqual(fixed.facts.refusals().filter(refusal => comparisons.includes(refusal.site)), [],
    "a typeof comparison other than 'undefined' is admitted on every admission");
});

test("K-2676: a narrowed read keeps only the intrinsics that remain at the read", () => {
  const fixed = fixture(`function f(v: string | null | undefined): void { if (v !== null) { if (typeof v === "undefined") {} } }
    function g(v: string | null | undefined): void { if (v !== undefined) { if (typeof v === "object") {} } }
    function h(v: string | null | undefined): void { if (typeof v === "undefined") {} }`);
  const uses = typeofComparisons(fixed.ast, fixed.nodes);
  assert.deepEqual(admissionsOf(fixed), ["undefined-only", "null-only", "both"]);
  assert.deepEqual(uses.slice(0, 2).map(use => testAt(fixed.facts, use.comparison).outcome), ["undecided", "undecided"]);
  assert.deepEqual(fixed.facts.refusals().filter(refusal => uses.slice(0, 2).some(use => use.comparison === refusal.site)), [],
    "after a guard removes null the undefined comparison is decided, not refused");
  assertBothRefused(fixed, uses[2]!.comparison, "the same declaration read before narrowing");
});

test("K-2676: an opaque constituent gives 'unavailable'; a found pair stays 'both'; alias depth is never a cut", () => {
  const fixed = fixture(`type Maybe<T> = T | null;
    type L0<T> = T | null; type L1<T> = L0<T>; type L2<T> = L1<T>; type L3<T> = L2<T>; type L4<T> = L3<T>;
    type L5<T> = L4<T>; type L6<T> = L5<T>; type L7<T> = L6<T>; type L8<T> = L7<T>; type L9<T> = L8<T>;
    type L10<T> = L9<T>; type L11<T> = L10<T>;
    function o<T>(value: Maybe<T>): boolean { return typeof value === "undefined"; }
    function u(value: unknown): boolean { return typeof value === "undefined"; }
    function k<T extends string>(value: Maybe<T>): boolean { return typeof value === "undefined"; }
    function w<T>(value: T | null | undefined): boolean { return typeof value === "undefined"; }
    function deep(value: L11<string | undefined>): boolean { return typeof value === "undefined"; }
    function shallow(value: L11<string>): boolean { return typeof value === "undefined"; }`);
  const uses = typeofComparisons(fixed.ast, fixed.nodes);
  assert.equal(uses.length, 6);
  assert.deepEqual(admissionsOf(fixed), ["unavailable", "unavailable", "null-only", "both", "both", "null-only"],
    "unconstrained T and unknown prove neither intrinsic absent; a constraint without nullish members does");
  // "unavailable" is not evidence of absence: the comparison stays undecided and is not refused (A4-D1).
  assert.equal(testAt(fixed.facts, uses[0]!.comparison).outcome, "undecided");
  assert.deepEqual(fixed.facts.refusals().filter(refusal => refusal.site === uses[0]!.comparison || refusal.site === uses[1]!.comparison), []);
  assert.equal(testAt(fixed.facts, uses[2]!.comparison).outcome, "undecided", "T extends string: null-only; the T arm has no proven category");
  assertBothRefused(fixed, uses[3]!.comparison, "explicit null and undefined beside an opaque binder");
  assertBothRefused(fixed, uses[4]!.comparison, "twelve alias levels with the argument applied");
  assert.equal(testAt(fixed.facts, uses[5]!.comparison).outcome, "always-false", "twelve alias levels closed with string");
});

// ---- K-2659: canonical method value uses (WP0 A8)-------------------------------------------------------------------

test("values.methodValueUse publishes the A8 record with the original method identity (BF05/BF06) and its alias", () => {
  const { ast, facts, initializer, reads, find } = fixture(`class Counter { count: int32 = 0; increment(): int32 { return this.count; } }
    function take(f: () => int32): int32 { return f(); }
    const c = new Counter(); const g = c.increment; const n = g(); const t = take(c.increment);`);
  const method = find(node => ast.is.IsMethodDeclaration(node), "increment");
  const read = initializer("g");
  const direct = facts.values.methodValueUse(read);
  assert.notEqual(direct, undefined);
  assert.equal(direct!.declaration, method);
  assert.equal(direct!.read, read);
  assert.equal(ast.text(direct!.receiver), "c");
  assert.equal(direct!.alias, undefined);
  const aliasRead = reads("g").find(node => ast.is.IsCallExpression(ast.parent(node)!))!;
  const alias = facts.values.methodValueUse(aliasRead);
  assert.notEqual(alias, undefined);
  assert.equal(alias!.declaration, method);
  assert.equal(alias!.read, read, "the alias resolves to its initializer read");
  assert.equal(ast.text(ast.name(alias!.alias!.principal)!), "g");
  const argument = ast.arguments(initializer("t"))[0]!;
  assert.equal(facts.values.methodValueUse(argument)?.declaration, method, "a method passed as a value keeps its identity");
});

test("values.methodValueUse is undefined for a direct call, a slot, a written or annotated alias, an index, a getter and a foreign callable", () => {
  const { ast, facts, initializer, reads, find } = fixture(`class Counter { count: int32 = 0; increment(): int32 { return this.count; }
      get value(): int32 { return this.count; } }
    interface Holder { fn: () => int32 }
    function take(f: () => int32): int32 { return f(); }
    function run(c: Counter, h: Holder, fns: (() => int32)[]): void {
      const called = c.increment();
      let written = c.increment; written = c.increment; const w = written;
      const annotated: () => int32 = c.increment;
      const indexed = fns[0];
      const got = c.value;
      const foreign = h.fn;
    }`);
  const callee = find(node => ast.is.IsPropertyAccessExpression(node) && ast.is.IsCallExpression(ast.parent(node)!), "callee");
  assert.equal(facts.values.methodValueUse(callee), undefined, "direct call");
  const slot = reads("f").find(node => ast.is.IsCallExpression(ast.parent(node)!))!;
  assert.equal(facts.values.methodValueUse(slot), undefined, "a callable slot is not a method read");
  assert.equal(facts.values.methodValueUse(initializer("w")), undefined, "written alias");
  const annotated = find(node => ast.is.IsVariableDeclaration(node) && ast.text(ast.name(node)!) === "annotated", "annotated");
  assert.equal(facts.values.methodValueUse(annotated), undefined, "annotated alias");
  assert.equal(facts.values.methodValueUse(initializer("indexed")), undefined, "index");
  assert.equal(facts.values.methodValueUse(initializer("got")), undefined, "getter");
  assert.equal(facts.values.methodValueUse(initializer("foreign")), undefined, "a callable property is not a method");
});

// ---- A5: discriminant arms survive canonical dedup (K-2663; 05 §2a D-2..D-12; R6) -------------------------------------
// The literal of each discriminator member is carried on the arm descriptor (`member.literals`) and is part of the shape's
// equality and identity, so arms that differ only in a literal stay two arms; the D-2 selection reads the arm descriptor.

type Fixture = ReturnType<typeof fixture>;

const kindLiterals = (arm: SourceTypeDescriptor, name = "kind"): readonly unknown[] | undefined => {
  const structure = sourceTypeDescriptorStructure(arm);
  return structure.kind === "shape" ? structure.members.find(member => member.name === name)?.literals?.map(literal => literal.value)
    : undefined;
};

const selectedArm = (facts: Fixture["facts"], use: Node) => {
  const relation = facts.relations.at(use);
  if (relation?.kind !== "select-arm") throw new Error(`select-arm required, got ${relation?.kind ?? "no relation"}`);
  return { relation, sum: facts.sums.sum(relation.sum) };
};

test("K-2663: otherwise-equal anonymous arms that differ only in their literal discriminant stay two arms; the literal selects 'right'", () => {
  const { facts, initializer } = fixture(`type Choice = { kind: "left"; v: number } | { kind: "right"; v: number };
    const c: Choice = { kind: "right", v: 1 };`);
  const { relation, sum } = selectedArm(facts, initializer("c"));
  assert.equal(sum.arms.length, 2, "the two authored arms are not deduplicated");
  assert.deepEqual(sum.arms.map(arm => kindLiterals(arm.type)), [["left"], ["right"]], "authored-first arms with their literals");
  assert.equal(relation.arm, 1);
  assert.equal(relation.discriminant?.property, "kind");
  assert.equal(relation.discriminant?.value.text, "right");
});

test("genuinely duplicate authored arms still deduplicate, including equal literal sets written in another order", () => {
  const { facts, initializer, resolved } = fixture(`type Same = { kind: "a"; v: int32 } | { kind: "a"; v: int32 };
    type Sets = { kind: "a" | "b"; v: int32 } | { kind: "b" | "a"; v: int32 };
    const s: Same = { kind: "a", v: 1 }; const t: Sets = { kind: "b", v: 1 };`);
  for (const name of ["s", "t"]) {
    const structure = sourceTypeDescriptorStructure(resolved(initializer(name)));
    assert.equal(structure.kind, "shape", `${name}: one arm, so the destination is the shape itself, not a sum`);
    assert.equal(facts.relations.at(initializer(name)), undefined, `${name}: no union relation for a single arm`);
  }
  assert.deepEqual(kindLiterals(resolved(initializer("t"))), ["a", "b"], "one literal set, sorted by value");
});

test("distinct-shape arms (the opposite) stay two arms and the discriminant selects the left arm", () => {
  const { facts, initializer } = fixture(`type Pair = { kind: "left"; l: int32 } | { kind: "right"; r: string };
    const p: Pair = { kind: "left", l: 1 };`);
  const { relation, sum } = selectedArm(facts, initializer("p"));
  assert.equal(sum.arms.length, 2);
  assert.equal(relation.arm, 0);
});

test("D-10: a generic family's literal discriminators select before application (V unbound) and after application", () => {
  const { ast, facts, find, initializer } = fixture(`type Step<V> = { kind: "done"; value: V } | { kind: "more"; value: V };
    function make<V>(value: V): Step<V> { return { kind: "more", value }; }
    const s: Step<int32> = { kind: "done", value: 1 };`);
  const returned = find(node => ast.is.IsObjectLiteralExpression(node) && ast.is.IsReturnStatement(ast.parent(node)!), "returned literal");
  const before = selectedArm(facts, returned);
  assert.equal(before.sum.arms.length, 2, "before application the two arms differ only in their literal");
  assert.equal(before.relation.arm, 1);
  const after = selectedArm(facts, initializer("s"));
  assert.equal(after.sum.arms.length, 2, "the literals survive the application's substitution");
  assert.deepEqual(after.sum.arms.map(arm => kindLiterals(arm.type)), [["done"], ["more"]]);
  assert.equal(after.relation.arm, 0);
  const value = sourceTypeDescriptorStructure(after.sum.arms[0]!.type);
  const member = value.kind === "shape" ? value.members.find(selected => selected.name === "value") : undefined;
  assert.equal(member?.type.kind === "primitive" && member.type.primitive === "int32", true, "the binder is applied");
  assert.equal(member?.literals, undefined, "a binder-typed member is not literal");
});

test("D-11/D-12: nested unions flatten, aliased arms and an alias of the sum select by literal, recursive arms stay apart", () => {
  const { facts, initializer } = fixture(`type Inner = { kind: "a"; v: int32 } | { kind: "b"; v: int32 };
    type Outer = Inner | { kind: "c"; v: int32 };
    type L = { kind: "left"; v: int32 }; type R = { kind: "right"; v: int32 }; type Choice = L | R; type Again = Choice;
    type List = { kind: "nil"; next?: List } | { kind: "cons"; next?: List };
    const o: Outer = { kind: "b", v: 1 }; const c: Again = { kind: "right", v: 1 }; const l: List = { kind: "cons" };`);
  const nested = selectedArm(facts, initializer("o"));
  assert.deepEqual(nested.sum.arms.map(arm => kindLiterals(arm.type)), [["a"], ["b"], ["c"]], "one flattened closed sum");
  assert.equal(nested.relation.arm, 1);
  const aliased = selectedArm(facts, initializer("c"));
  assert.equal(aliased.sum.arms.length, 2);
  assert.equal(aliased.relation.arm, 1);
  const recursive = selectedArm(facts, initializer("l"));
  assert.equal(recursive.sum.arms.length, 2, "recursive arms that differ only in their literal are two arms");
  assert.equal(recursive.relation.arm, 1);
});

test("D-5: several matching arms are refused (equal literals, a wider literal union); the narrower value still selects", () => {
  const { facts, initializer } = fixture(`type S = { kind: "a"; x: int32 } | { kind: "a"; y: string };
    type W = { kind: "a" | "b"; x: int32 } | { kind: "a"; x: int32 };
    const s: S = { kind: "a", x: 1 }; const w: W = { kind: "a", x: 1 }; const b: W = { kind: "b", x: 1 };`);
  for (const name of ["s", "w"]) {
    const relation = facts.relations.at(initializer(name));
    assert.equal(relation?.kind, "refused", name);
    if (relation?.kind === "refused") {
      assert.equal(relation.code, "TSONIC_LOCAL_TYPE_UNION");
      assert.match(relation.message, /several union arms/);
    }
  }
  const { relation, sum } = selectedArm(facts, initializer("b"));
  assert.equal(sum.arms.length, 2, "arms with different literal sets are two arms");
  assert.equal(relation.arm, 0);
});

test("D-4: a literal discriminant that matches no arm is refused by the Host (TypeScript also rejects it: TS2322)", () => {
  const { facts, initializer } = fixture(`type U = { kind: "a"; v: int32 } | { kind: "b"; v: int32 };
    const z: U = { kind: "c", v: 1 };`, [2322]);
  const relation = facts.relations.at(initializer("z"));
  assert.equal(relation?.kind, "refused");
  if (relation?.kind === "refused") {
    assert.equal(relation.code, "TSONIC_LOCAL_TYPE_UNION");
    assert.match(relation.message, /matches no union arm/);
  }
});

// ---- F1 first-run Host coverage (nextgen first full run, AGENT-F1-NOTES.md) -----------------------------------------

test("Q69: values.destination names the slot, the contextual descriptor and the Host broadness (broad, non-broad, none)", () => {
  const { ast, facts, reads, initializer } = fixture(`declare function take(value: unknown): void;
  declare function narrow(value: string): void;
  function run(): boolean {
    const original = "text";
    take(original);
    narrow(original);
    const local: unknown = original;
    void local;
    return original === "text";
  }`);
  const [broadUse, narrowUse, , operand] = reads("original") as [Node, Node, Node, Node];
  const broad = facts.values.destination(broadUse);
  assert.equal(broad !== undefined && broad.kind === "slot" && broad.broad, true, "an argument into `unknown` has a broad destination");
  if (broad === undefined || broad.kind !== "slot") return;
  const contextual = facts.values.contextual(broadUse);
  assert.equal(contextual !== undefined && contextual.kind !== "refused" && contextual.type === broad.type, true,
    "destination.type is the identical contextual descriptor");
  const admission = facts.values.admission(broadUse);
  assert.equal(admission.slot, broad.slot, "an admitted use names its admission slot");
  assert.equal(facts.values.destination(broadUse), broad, "memoized");
  assert.equal(Object.isFrozen(broad), true);
  const nonBroad = facts.values.destination(narrowUse);
  assert.equal(nonBroad !== undefined && nonBroad.kind === "slot" && !nonBroad.broad && ast.is.IsParameterDeclaration(nonBroad.slot), true,
    "an argument into `string` has a non-broad destination at the parameter slot");
  const declared = facts.values.destination(initializer("local"));
  assert.equal(declared !== undefined && declared.kind === "slot" && declared.broad, true, "a declared `unknown` local is a broad slot");
  assert.equal(facts.values.destination(operand), undefined, "an operator operand flows into no Host slot");
});

test("Q55/Q68: a generic parameter instantiated as unknown (`g<unknown>(v)` into `x: T`) is admitted at the use", () => {
  const { facts, reads } = fixture(`declare function generic<T>(value: T): void;
  function run(): void {
    const original = "text";
    generic<unknown>(original);
  }`);
  const [use] = reads("original") as [Node];
  const admission = facts.values.admission(use);
  assert.equal(admission.kind, "admitted");
  const destination = facts.values.destination(use);
  assert.equal(destination !== undefined && destination.kind === "slot" && destination.broad && destination.slot === admission.slot, true);
  const slot = facts.values.slot(admission.slot);
  assert.equal(slot.kind === "slot" && slot.broad, true, "the instantiated slot is broad, not the binder slot T");
});

test("an arrow and a function expression publish their own one-signature callable inventory (no checked expression type)", () => {
  const { initializer, resolved } = fixture(`const twice = (value: int32): int32 => value * 2;
  const halve = function (value: int32): int32 { return value / 2 as int32; };
  export const results = [twice(1), halve(4)];`);
  for (const name of ["twice", "halve"]) {
    const type = sourceTypeDescriptorStructure(resolved(initializer(name)));
    assert.equal(type.kind === "callable" && type.calls.length === 1 && type.constructs.length === 0, true, `${name}: one call signature`);
    assert.equal(type.kind === "callable" && type.calls[0]!.declaration === initializer(name), true, `${name}: the signature is its own declaration`);
  }
});

test("`this` reads describe the class instance (members), the constructor value (static) and an explicit this parameter", () => {
  const { ast, nodes, resolved, find } = fixture(`class Counter {
    count: int32 = 0;
    next(): int32 { return this.count; }
    static make(): Counter { return new this(); }
  }
  function described(this: Counter): int32 { return this.count; }
  export const value = new Counter().next();
  export const unbound = described;`);
  const counter = find(node => ast.is.IsClassDeclaration(node), "class");
  const reads = nodes.filter(node => ast.kindName(node) === "KindThisKeyword");
  assert.equal(reads.length, 3);
  const [member, staticRead, explicit] = reads as [Node, Node, Node];
  const instance = resolved(member);
  assert.equal(instance.kind === "declared" && instance.declaration === counter, true, "a member's this is the class instance type");
  const constructorValue = sourceTypeDescriptorStructure(resolved(staticRead));
  assert.equal((constructorValue.kind === "shape" || constructorValue.kind === "callable") && constructorValue.constructs.length > 0, true,
    "a static member's this is the constructor value (it has the construct signature)");
  const parameter = resolved(explicit);
  assert.equal(parameter.kind === "declared" && parameter.declaration === counter, true, "an explicit this parameter's annotation");
});

test("a member read on an array receiver reads the member declaration under the element binding", () => {
  const { ast, facts, find } = fixture(`const values: int32[] = [1, 2];
  export const mapped = values.map(value => value + 1);`);
  const access = find(node => ast.is.IsPropertyAccessExpression(node) && ast.text(ast.name(node)!) === "map", "values.map");
  const outcome = facts.values.type(access);
  assert.equal(outcome.kind, "resolved", "the method read has a Host description");
});

test("object-literal members and declaration names are in the values.type domain", () => {
  const { ast, facts, find } = fixture(`const point = { x: 1 as int32, label: "p" };
  function named(): int32 { return point.x; }
  export const read = named();`);
  const property = find(node => ast.is.IsPropertyAssignment(node) && ast.text(ast.name(node)!) === "x", "x member");
  assert.equal(facts.values.has(property), true);
  const member = facts.values.type(property);
  assert.equal(member.kind === "resolved" && member.type.kind === "primitive" && member.type.primitive === "int32", true,
    "the member value is the literal's own int32 member");
  const declaration = find(node => ast.is.IsFunctionDeclaration(node), "named");
  const name = ast.name(declaration)!;
  assert.equal(facts.values.has(name), true);
  const outcome = facts.values.type(name);
  const declared = facts.values.type(declaration);
  assert.equal(outcome.kind === "resolved" && declared.kind === "resolved" && outcome.type === declared.type, true,
    "a declaration's name denotes the declaration's value");
});

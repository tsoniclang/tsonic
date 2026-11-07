import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createCompilerSessionFromFiles, createSourceSemanticsExtension, formatDiagnostics, sourcePrimitive, type Node } from "@tsonic/tsts";
import { Node_Expression } from "../../source-navigation/ast.js";
import { createSourceTypeFlowTestProgram } from "./type-flow-test-program.js";
import type { SourceTypeDescriptor } from "./types.js";

// Host fact tests for the value-model share of SourceProgramFacts (nextgen plan §2, CONTRACT.md). Each test is a real
// TypeScript program; the assertions are on published Host facts only.
function fixture(text: string) {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/node_modules/@test/words/package.json": JSON.stringify({ name: "@test/words", version: "1.0.0", type: "module", exports: { ".": "./index.d.ts" } }),
    "/src/node_modules/@test/words/index.d.ts": "export type int32 = number; export type int64 = bigint;",
    "/src/index.ts": `import type { int32, int64 } from "@test/words"; ${text}`,
  }, compilerOptions: { strict: true, target: "es2022", module: "esnext", moduleResolution: "bundler" },
  extensionHostOptions: { extensions: [createSourceSemanticsExtension({ modules: [{ moduleSpecifier: "@test/words", packageName: "@test/words",
    exports: [sourcePrimitive("int32", "int32", "number", true, 32), sourcePrimitive("int64", "int64", "bigint", true, 64)] }] })] } }).checkSource();
  assert.equal(checked.diagnostics.length, 0, formatDiagnostics(checked.diagnostics.filter(issue => issue !== undefined)).slice(0, 2048));
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

// ---- K-2659: canonical method value uses (WP0 A8) -------------------------------------------------------------------

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

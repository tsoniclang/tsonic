import assert from "node:assert/strict";
import test from "node:test";
import { isDeepStrictEqual } from "node:util";
import { createCompilerSessionFromFiles, createSourceSemanticsExtension, formatDiagnostics, sourcePrimitive, type Node } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../target-source-program.js";
import { analyzeSourceEffectiveTypes } from "./solver.js";
import type { SourceEffectiveTypeOutcome, SourceTypeDescriptor } from "./types.js";

function fixture(text: string) {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/node_modules/@test/words/package.json": JSON.stringify({ name: "@test/words", version: "1.0.0", type: "module", exports: { ".": "./index.d.ts" } }),
    "/src/node_modules/@test/words/index.d.ts": "export type int32 = number; export type int64 = bigint; export type float32 = number;",
    "/src/index.ts": `import type { int32, int64, float32 } from "@test/words"; ${text}`,
  }, compilerOptions: { strict: true, target: "es2022", module: "esnext", moduleResolution: "bundler" },
  extensionHostOptions: { extensions: [createSourceSemanticsExtension({ modules: [{ moduleSpecifier: "@test/words", packageName: "@test/words",
    exports: [sourcePrimitive("int32", "int32", "number", true, 32), sourcePrimitive("int64", "int64", "bigint", true, 64),
      sourcePrimitive("float32", "float32", "number", true, 32)] }] })] } }).checkSource();
  assert.equal(checked.diagnostics.length, 0, formatDiagnostics(checked.diagnostics.filter(issue => issue !== undefined)).slice(0, 2048));
  assert.equal(checked.extensionDiagnostics.length, 0);
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  if (file === undefined) throw new Error("The original source file is required.");
  const nodes: Node[] = [];
  const pending: Node[] = [file];
  while (pending.length > 0) {
    const node = pending.pop()!; nodes.push(node);
    const children = source.ast.children(node);
    for (let index = children.length - 1; index >= 0; index -= 1) if (children[index] !== undefined) pending.push(children[index]!);
  }
  const declaration = (name: string): Node => {
    const found = nodes.find(node => source.ast.is.IsVariableDeclaration(node) && source.ast.text(source.ast.name(node)) === name);
    if (found === undefined) throw new Error(`The original declaration ${name} is required.`);
    return found;
  };
  const type = (name: string): SourceTypeDescriptor => {
    const outcome = source.effectiveTypes.get(declaration(name));
    assert.equal(outcome !== undefined && outcome.kind !== "refused", true, `resolved ${name}`);
    if (outcome === undefined || outcome.kind === "refused") throw new Error(`The resolved ${name} is required.`);
    return outcome.type;
  };
  return { source, nodes, declaration, type };
}

test("one eager publication fills numeric locals from the first exact demand", () => {
  const current = fixture("declare function take(value: number): void; function run(): void { const value = 1; take(value); }");
  assertSameValue(current.type("value"), { kind: "primitive", primitive: "float64" });
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
  assert.equal(Object.isFrozen(current.source.effectiveTypes), true);
  assert.equal(Object.isFrozen(current.type("value")), true);
});

test("a later conflicting exact demand retains its original checked site", () => {
  const current = fixture("declare function narrow(value: int32): void; declare function broad(value: number): void; function run(): void { const value = 1; narrow(value); broad(value); }");
  const failure = current.source.effectiveTypes.refusals().find(issue => issue.code === "TSONIC_LOCAL_TYPE_CONFLICT");
  const later = current.nodes.find(node => current.source.ast.is.IsCallExpression(node) &&
    current.source.ast.text(current.source.ast.as.AsCallExpression(node)?.Expression) === "broad");
  const earlier = current.nodes.find(node => current.source.ast.is.IsCallExpression(node) &&
    current.source.ast.text(current.source.ast.as.AsCallExpression(node)?.Expression) === "narrow");
  assert.equal(failure !== undefined, true);
  assert.equal(later !== undefined && failure?.site === current.source.ast.arguments(later)[0], true);
  assert.equal(earlier !== undefined && failure?.related === current.source.ast.arguments(earlier)[0], true);
});

test("signature closure defaults leaves before exact use demands", () => {
  const current = fixture("declare function broad(value: number): void; function run() { const value = 1; broad(value); return value + 1; }");
  assert.equal(current.source.effectiveTypes.refusals().some(issue => issue.code === "TSONIC_LOCAL_TYPE_SIGNATURE"), true);
});

test("declared returns are ordinary exact demands rather than signature defaults", () => {
  const current = fixture("function run(): number { const value = 1; return value; }");
  assertSameValue(current.type("value"), { kind: "primitive", primitive: "float64" });
});

test("array and nested data-member fills decompose before defaults", () => {
  const current = fixture("declare function arrays(value: number[]): void; declare function fields(value: { n: number }): void; function run(): void { const values = [1, 2]; const data = { n: 1 }; arrays(values); fields(data); }");
  assertSameValue(current.type("values"), { kind: "array", readonly: false, element: { kind: "primitive", primitive: "float64" } });
  const data = current.type("data");
  assert.equal(data.kind === "shape" && data.members[0]?.type.kind === "primitive" && data.members[0].type.primitive === "float64", true);
});

test("an alias and its projected read retain the same solved array element", () => {
  const current = fixture("declare function take(value: number): void; function run(): void { const values = [1]; const alias = values; take(alias[0]!); }");
  const values = current.type("values"); const alias = current.type("alias");
  assertSameValue(values, alias);
  assert.equal(values.kind === "array" && values.element.kind === "primitive" && values.element.primitive === "float64", true);
});

test("writes and literal compound assignments leave the default unchanged", () => {
  const current = fixture("function run(): void { let value = 1; value += 0.5; const values = [1]; values[0] = 0.5; }");
  assertSameValue(current.type("value"), { kind: "primitive", primitive: "int32" });
  assert.equal(current.source.effectiveTypes.obligations().filter(row => row.kind === "write-fit").length >= 2, true);
});

test("a declared compound-assignment right side fills the local", () => {
  const current = fixture("function run(input: number): void { let value = 1; value += input; }");
  assertSameValue(current.type("value"), { kind: "primitive", primitive: "float64" });
});

test("derived-local demands never flow back into arithmetic operands", () => {
  const current = fixture("declare function broad(value: number): void; function run(): void { const value = 1; const derived = value * 2; broad(derived); }");
  assertSameValue(current.type("value"), { kind: "primitive", primitive: "int32" });
  assert.equal(current.source.effectiveTypes.refusals().some(issue => issue.code === "TSONIC_LOCAL_TYPE_CONFLICT"), true);
});

test("derived arithmetic is typed once in dependency order", () => {
  const current = fixture("function run(): void { const first = 1; const second = first * 2; const third = second + 0.5; }");
  assertSameValue(current.type("second"), { kind: "primitive", primitive: "int32" });
  assertSameValue(current.type("third"), { kind: "primitive", primitive: "float64" });
});

test("declared numeric widths cross a generic call without checker erasure", () => {
  const current = fixture("function first<T>(values: T[]): T { return values[0]!; } function run(values: int32[]): void { const value = first(values); }");
  assertSameValue(current.type("value"), { kind: "primitive", primitive: "int32" });
  const call = current.nodes.find(node => current.source.ast.is.IsCallExpression(node));
  assert.equal(call !== undefined, true);
  const instance = call === undefined ? undefined : current.source.effectiveTypes.callInstantiation(call);
  assert.equal(instance?.method[0]?.type.kind === "primitive" && instance.method[0].type.primitive === "int32", true);
});

test("an empty array gets no type from a receiver-binder insertion", () => {
  const current = fixture("function run(): void { const values = []; values.push(1); }");
  assert.equal(current.source.effectiveTypes.refusals().some(issue => issue.code === "TSONIC_UNTYPED_ARRAY_LITERAL"), true);
});

test("uncontextualized empty object and array declarations are Host refusals", () => {
  const current = fixture("function run(): void { const data = {}; const values = []; }");
  const codes = current.source.effectiveTypes.refusals().map(issue => issue.code);
  assert.equal(codes.includes("TSONIC_UNTYPED_OBJECT_LITERAL"), true);
  assert.equal(codes.includes("TSONIC_UNTYPED_ARRAY_LITERAL"), true);
});

test("Host-fixed counters and every checked read carry the same B8 authority", () => {
  const current = fixture("export const moduleValue = 1; function run(): void { for (let index = 8; index >= 0; index -= 2) { const copy: number = index; } }");
  assertSameValue(current.type("index"), { kind: "primitive", primitive: "int64" });
  assertSameValue(current.type("moduleValue"), { kind: "primitive", primitive: "int32" });
  const declaration = current.declaration("index");
  for (const use of current.source.navigation.declarationUses(declaration)) {
    if (use.kind === "type-only" || use.kind === "source-linkage") continue;
    const outcome = current.source.effectiveTypes.get(use.reference);
    assert.equal(outcome !== undefined && outcome.kind !== "refused" && outcome.provenance.fixedRule?.kind === "loop-counter", true);
    assert.equal(outcome !== undefined && outcome.kind !== "refused" && outcome.provenance.fixedRule?.declaration === declaration, true);
  }
});

test("published facts are deterministic and keep exact occurrences", () => {
  const current = fixture("function run(): void { const values = [1, 2]; const alias = values; }");
  const second = analyzeSourceEffectiveTypes(current.source);
  for (const name of ["values", "alias"]) {
    const node = current.declaration(name);
    const first = current.source.effectiveTypes.get(node); const other = second.get(node);
    assert.equal(first !== undefined && other !== undefined && first.kind !== "refused" && other.kind !== "refused", true);
    if (first === undefined || other === undefined || first.kind === "refused" || other.kind === "refused") continue;
    assertSameValue(first.type, other.type);
    assert.equal(first.provenance.occurrence === node && other.provenance.occurrence === node, true);
    assert.equal(Object.isFrozen(first.provenance), true);
  }
  assert.equal(Object.isFrozen(second.obligations()) && Object.isFrozen(second.refusals()), true);
});

test("raw declaration-only syntax stays outside the effective-value domain", () => {
  const current = fixture("interface Marker { readonly name: string } function run(): void { const value = 1; }");
  const declaration = current.nodes.find(node => current.source.ast.is.IsInterfaceDeclaration(node));
  assert.equal(declaration !== undefined, true);
  assert.equal(declaration === undefined || current.source.effectiveTypes.get(declaration) === undefined, true);
});

function outcomeCode(outcome: SourceEffectiveTypeOutcome | undefined): string | undefined {
  return outcome?.kind === "refused" ? outcome.code : undefined;
}

test("a different pair of fixed element types refuses at its original array", () => {
  const current = fixture("function run(narrow: float32, signed: int32): void { const values = [narrow, signed]; }");
  assert.equal(current.source.effectiveTypes.refusals().some(issue => issue.code === "TSONIC_LOCAL_TYPE_MIXED_ELEMENTS"), true);
  assert.equal(outcomeCode(current.source.effectiveTypes.get(current.declaration("values"))), "TSONIC_LOCAL_TYPE_MIXED_ELEMENTS");
});

test("a seeded accumulator is checked once against its non-cyclic type", () => {
  const current = fixture("function run(): void { const values = [1, 2]; const total = values.reduce((sum, value) => sum + value, 0); }");
  assertSameValue(current.type("total"), { kind: "primitive", primitive: "int32" });
  assert.equal(current.source.effectiveTypes.refusals().some(issue => issue.code === "TSONIC_LOCAL_TYPE_ACCUMULATOR"), false);
});

test("a fractional accumulator return cannot retype an integer seed", () => {
  const current = fixture("function run(): void { const values = [1, 2]; const total = values.reduce((sum, value) => sum + 0.5, 0); }");
  assert.equal(current.source.effectiveTypes.refusals().some(issue => issue.code === "TSONIC_LOCAL_TYPE_ACCUMULATOR"), true);
});

test("declared optional aliases preserve the leaf width and checker narrowing", () => {
  const current = fixture("declare let input: int32 | undefined; function run(): void { if (input !== undefined) { const narrowed = input; } }");
  assertSameValue(current.type("input"), { kind: "optional", value: { kind: "primitive", primitive: "int32" } });
  assertSameValue(current.type("narrowed"), { kind: "primitive", primitive: "int32" });
});

test("two generic occurrences keep separate binder instantiations", () => {
  const current = fixture("function identity<T>(value: T): T { return value; } function run(): void { const integer = identity(1); const fractional = identity(0.5); }");
  assertSameValue(current.type("integer"), { kind: "primitive", primitive: "int32" });
  assertSameValue(current.type("fractional"), { kind: "primitive", primitive: "float64" });
  const calls = current.nodes.filter(node => current.source.ast.is.IsCallExpression(node));
  const first = calls[0] === undefined ? undefined : current.source.effectiveTypes.callInstantiation(calls[0]);
  const second = calls[1] === undefined ? undefined : current.source.effectiveTypes.callInstantiation(calls[1]);
  assert.equal(first !== undefined && second !== undefined && first.call !== second.call, true);
});

test("the use bound is a Host refusal rather than a partial use prefix", () => {
  const uses = Array.from({ length: 1025 }, () => "take(value);").join(" ");
  const current = fixture(`declare function take(value: number): void; function run(): void { const value = 1; ${uses} }`);
  assert.equal(current.source.effectiveTypes.refusals().some(issue => issue.code === "TSONIC_LOCAL_TYPE_LIMIT"), true);
});

test("a depth-five open literal refuses instead of publishing a shallow descriptor", () => {
  const current = fixture("function run(): void { const value = [[[[[1]]]]]; }");
  assert.equal(current.source.effectiveTypes.refusals().some(issue => issue.code === "TSONIC_LOCAL_TYPE_LIMIT"), true);
});

test("a fractional bitwise derived local never publishes a floating bitwise carrier", () => {
  const current = fixture("function run(): void { const value = 0.5; const derived = ~value; }");
  assert.equal(current.source.effectiveTypes.refusals().some(issue => issue.code === "TSONIC_LOCAL_TYPE_UNSUPPORTED"), true);
});

function assertSameValue(actual: unknown, expected: unknown): void {
  assert.equal(isDeepStrictEqual(actual, expected), true, "exact source descriptor equality");
}

import assert from "node:assert/strict";
import test from "node:test";
import { isDeepStrictEqual } from "node:util";
import { createCompilerSessionFromFiles, createSourceSemanticsExtension, formatDiagnostics, sourcePrimitive, type Node } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../target-source-program.js";
import { createSourceTypeFlowAnalysisContext } from "./defaults.js";
import { collectSourceTypeFlowEdges } from "./edges.js";
import { analyzeSourceEffectiveTypes } from "./solver.js";
import type { SourceEffectiveTypeOutcome, SourceTypeDescriptor } from "./types.js";
import { sourceTypeDescriptorsEqual } from "./terms.js";

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

for (const [expression, code, reason] of [
  ["{}", "TSONIC_UNTYPED_OBJECT_LITERAL", "This object literal has no target type. Declare one, e.g. 'function baseOptions(): MakeDirectoryOptions'."],
  ["[]", "TSONIC_UNTYPED_ARRAY_LITERAL", "This empty array has no element type. Declare one, e.g. 'function emptyBuffer(): number[]'."],
] as const) {
  test(`C32 unbound ${expression} return keeps its original annotation refusal`, () => {
    const current = fixture(`function make() { return ${expression}; }`);
    const literal = current.nodes.find(node => expression === "{}"
      ? current.source.ast.is.IsObjectLiteralExpression(node) : current.source.ast.is.IsArrayLiteralExpression(node));
    const refusal = current.source.effectiveTypes.refusals().find(issue => issue.site === literal);
    assert.equal(literal !== undefined && refusal?.code === code && refusal.reason === reason, true,
      "the canonical Terms group owns the unchanged original code, message and construction occurrence");
    assert.equal(literal !== undefined && current.source.effectiveTypes.get(literal)?.kind === "refused", true);
  });
}

test("C32 unbound constructions retain ordinary exact call fills and C24 signature closure", () => {
  const current = fixture(`declare function arrays(value: number[]): void;
    declare function fields(value: { count: number }): void;
    function run(): void { arrays([]); fields({ count: 1 }); }
    function make() { return [1, 2]; }`);
  const outcomes = current.nodes.filter(node => current.source.ast.is.IsArrayLiteralExpression(node) ||
    current.source.ast.is.IsObjectLiteralExpression(node)).map(node => current.source.effectiveTypes.get(node));
  assert.equal(outcomes.length, 3);
  assert.equal(outcomes[0]?.kind !== "refused" && outcomes[0]?.type.kind === "array" &&
    outcomes[0].type.element.kind === "primitive" && outcomes[0].type.element.primitive === "float64", true);
  assert.equal(outcomes[1]?.kind !== "refused" && outcomes[1]?.type.kind === "shape" &&
    outcomes[1].type.members[0]?.type.kind === "primitive" && outcomes[1].type.members[0].type.primitive === "float64", true);
  assert.equal(outcomes[2]?.kind !== "refused" && outcomes[2]?.type.kind === "array" &&
    outcomes[2].type.element.kind === "primitive" && outcomes[2].type.element.primitive === "int32", true);
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
});

test("C32 never opens an annotated or module construction or a scalar literal", () => {
  const current = fixture(`export const moduleValue: {} = {};
    function run(): number[] { const declared: {} = {}; return []; }
    function scalar(): number { return 1; }`);
  const constructions = current.nodes.filter(node => current.source.ast.is.IsArrayLiteralExpression(node) ||
    current.source.ast.is.IsObjectLiteralExpression(node));
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
  assert.equal(constructions.every(node => current.source.effectiveTypes.get(node)?.kind !== "refused"), true);
  const admissions = current.source.effectiveTypes.obligations().filter(row => row.kind === "literal-admission");
  const scalar = current.nodes.find(node => current.source.ast.is.IsNumericLiteral(node));
  assert.equal(constructions.every(node => {
    const matching = admissions.filter(row => row.site === node);
    const published = current.source.effectiveTypes.get(node);
    return matching.length === 1 && matching[0]?.kind === "literal-admission" && matching[0].authority === "declared" &&
      published !== undefined && published.kind !== "refused" && sourceTypeDescriptorsEqual(matching[0].type, published.type);
  }) && scalar !== undefined && !admissions.some(row => row.site === scalar), true,
  "declared constructions carry one canonical D2 admission obligation; admission stays target-owned");
});

test("declared readonly array returns and their conditional branches retain the same floating element", () => {
  const current = fixture("function direct(): readonly number[] { return [1, 2]; } function choose(flag: boolean): readonly number[] { return flag ? [1] : [2, 3]; }");
  const arrays = current.nodes.filter(node => current.source.ast.is.IsArrayLiteralExpression(node));
  assert.equal(arrays.length, 3);
  for (const node of arrays) {
    const outcome = current.source.effectiveTypes.get(node);
    assert.equal(outcome !== undefined && outcome.kind !== "refused" && outcome.type.kind === "array" &&
      outcome.type.element.kind === "primitive" && outcome.type.element.primitive === "float64", true,
      "actual declared slots or ordinary C32 return demand select the same element without an array-copy conversion");
  }
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
});

test("an empty inferred literal consumed through a generic call keeps only its real construction refusal", () => {
  const current = fixture("declare function identity<T>(value: T): T; function run(): void { const value = {}; void identity(value); }");
  const literal = current.nodes.find(node => current.source.ast.is.IsObjectLiteralExpression(node));
  const issues = current.source.effectiveTypes.refusals();
  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.code === "TSONIC_UNTYPED_OBJECT_LITERAL" && issues[0].site === literal, true,
    "synthetic result and binder shape terms do not fabricate additional object-construction sites");
});

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

for (const statement of ["values[0] = value;", "target = value;"]) {
  test(`write-fit retains the already-solved right side of ${statement}`, () => {
    const current = fixture(`declare function broad(value: number): void; function run(): void { const values = [1]; let target = 1; let value = 1; broad(value); ${statement} }`);
    assertSameValue(current.type("value"), { kind: "primitive", primitive: "float64" });
    const write = current.source.effectiveTypes.obligations().find(row => row.kind === "write-fit" &&
      current.source.ast.is.IsBinaryExpression(row.site) && current.source.ast.text(current.source.ast.as.AsBinaryExpression(row.site)?.Right) === "value");
    assert.equal(write !== undefined, true);
    assertSameValue(write?.type, { kind: "primitive", primitive: "int32" });
    assertSameValue(write?.valueType, { kind: "primitive", primitive: "float64" });
    assert.equal(write?.valueVariable?.node === write?.value && write?.valueVariable?.path.length === 0, true);
  });
}

test("ordinary fixed API write values publish their declared read type and a write-fit obligation", () => {
  const current = fixture("function run(input: number[]): void { const values = [1]; values[0] = input.length; }");
  const access = current.nodes.find(node => current.source.ast.is.IsPropertyAccessExpression(node));
  const write = current.source.effectiveTypes.obligations().find(row => row.kind === "write-fit" && row.value === access);
  assert.equal(access !== undefined && write !== undefined, true);
  const selected = access === undefined ? undefined : current.source.semantics.forNode(access).operations.propertyAccess(access);
  const declaration = selected?.selectedReadDeclaration ?? selected?.selectedDeclaration;
  assert.equal(declaration !== undefined, true);
  const described = declaration === undefined ? undefined : createSourceTypeFlowAnalysisContext(current.source).context.describe(declaration);
  const outcome = access === undefined ? undefined : current.source.effectiveTypes.get(access);
  assert.equal(described !== undefined && outcome !== undefined && outcome.kind !== "refused", true);
  if (outcome === undefined || outcome.kind === "refused") throw new Error("The declared read type must be published.");
  assertSameValue(outcome.type, described);
  assertSameValue(write?.valueType, described);
  assert.equal(write?.valueVariable === undefined, true);
  assertSameValue(current.type("values"), { kind: "array", readonly: false, element: { kind: "primitive", primitive: "int32" } });
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
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
});

test("inline callable construction publishes one callable type consistent with its chosen parameter and result", () => {
  const current = fixture("function run(): void { const values = [1, 2]; const mapped = values.map(value => value * 2); }");
  assertSameValue(current.type("mapped"), { kind: "array", readonly: false, element: { kind: "primitive", primitive: "int32" } });
  const arrow = current.nodes.find(node => current.source.ast.is.IsArrowFunction(node));
  const parameter = arrow === undefined ? undefined : current.source.ast.parameters(arrow)[0];
  const body = arrow === undefined ? undefined : current.source.ast.body(arrow);
  assert.equal(arrow !== undefined && parameter !== undefined && body !== undefined, true);
  const arrowType = arrow === undefined ? undefined : current.source.effectiveTypes.get(arrow);
  assert.equal(arrowType !== undefined && arrowType.kind !== "refused", true);
  if (arrowType === undefined || arrowType.kind === "refused") throw new Error("The inline callable type must be published.");
  assertSameValue(arrowType.type, { kind: "callable", calls: [{ declaration: arrow, typeParameters: [],
    parameters: [{ declaration: parameter, kind: "required", type: { kind: "primitive", primitive: "int32" } }],
    result: { kind: "primitive", primitive: "int32" } }], constructs: [] });
  for (const node of [parameter, body]) {
    const outcome = node === undefined ? undefined : current.source.effectiveTypes.get(node);
    assert.equal(outcome !== undefined && outcome.kind !== "refused", true);
    if (outcome !== undefined && outcome.kind !== "refused") assertSameValue(outcome.type, { kind: "primitive", primitive: "int32" });
  }
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
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

test("C29 module declarations keep their own type without signature refusals", () => {
  const current = fixture('const foo = "bar"; export const record: Record<string, string> = { foo }; export const plain = 7 / 2; export const typed: int32 = 7 / 2;');
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
  const defaults = createSourceTypeFlowAnalysisContext(current.source);
  assertSameValue(current.type("plain"), defaults.context.describe(current.declaration("plain")));
  assertSameValue(current.type("typed"), { kind: "primitive", primitive: "int32" });
  const record = current.source.effectiveTypes.get(current.declaration("record"));
  assert.equal(record !== undefined && record.kind !== "refused" && record.type.kind === "declared" &&
    current.source.ast.is.IsTypeAliasDeclaration(record.type.declaration) &&
    current.source.semantics.forNode(current.declaration("record")).declarations.isDefaultLibraryDeclaration(record.type.declaration) &&
    current.source.ast.text(current.source.ast.name(record.type.declaration)) === "Record", true);
  assert.equal(record !== undefined && record.kind !== "refused" && record.type.kind === "declared" &&
    record.type.typeArguments.length === 2 && record.type.typeArguments.every(type => type.kind === "string"), true);
});

test("declared recursive unions publish their declared reference without expansion or refusal", () => {
  const current = fixture("type Tree = number | readonly Tree[]; declare const input: Tree; function run(value: Tree): Tree { const retained: Tree = value; return retained; }");
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
  const declaration = current.nodes.find(node => current.source.ast.is.IsTypeAliasDeclaration(node) &&
    current.source.ast.text(current.source.ast.name(node)) === "Tree");
  for (const name of ["input", "retained"]) {
    const outcome = current.source.effectiveTypes.get(current.declaration(name));
    assert.equal(declaration !== undefined && outcome !== undefined && outcome.kind !== "refused" &&
      outcome.type.kind === "declared" && outcome.type.declaration === declaration && outcome.type.typeArguments.length === 0, true, name);
  }
});

test("C29 a fixed read keeps its own carrier when an open sibling conflicts", () => {
  const current = fixture("declare function take(values: number[]): void; function run(value: int32): void { const values = [value, 1]; take(values); }");
  assert.equal(current.source.effectiveTypes.refusals().some(issue => issue.code === "TSONIC_LOCAL_TYPE_CONFLICT"), true);
  const parameter = current.nodes.find(node => current.source.ast.is.IsParameterDeclaration(node) && current.source.ast.text(current.source.ast.name(node)) === "value");
  if (parameter === undefined) throw new Error("The exact declared parameter is required.");
  for (const use of current.source.navigation.declarationUses(parameter)) {
    if (use.kind === "type-only" || use.kind === "source-linkage") continue;
    const outcome = current.source.effectiveTypes.get(use.reference);
    assert.equal(outcome !== undefined && outcome.kind !== "refused", true);
    if (outcome === undefined || outcome.kind === "refused") throw new Error("The fixed read is not an inference refusal.");
    assertSameValue(outcome.type, { kind: "primitive", primitive: "int32" });
  }
});

test("C29 annotated aggregate construction does not retype its fixed children", () => {
  const current = fixture("function run(narrow: float32, signed: int32): void { const values: float32[] = [narrow, signed]; }");
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
  assertSameValue(current.type("values"), { kind: "array", readonly: false, element: { kind: "primitive", primitive: "float32" } });
  const signed = current.nodes.find(node => current.source.ast.is.IsParameterDeclaration(node) && current.source.ast.text(current.source.ast.name(node)) === "signed");
  if (signed === undefined) throw new Error("The exact signed source parameter is required.");
  for (const use of current.source.navigation.declarationUses(signed)) {
    const outcome = current.source.effectiveTypes.get(use.reference);
    assert.equal(outcome !== undefined && outcome.kind !== "refused", true);
    if (outcome === undefined || outcome.kind === "refused") throw new Error("The original fixed source read is required.");
    assertSameValue(outcome.type, { kind: "primitive", primitive: "int32" });
  }
});

for (const [name, body] of [
  ["annotated alias initializer", "type Values = float32[]; function run(narrow: float32, signed: int32): void { const values: Values = [narrow, signed]; }"],
  ["declared return", "function run(narrow: float32, signed: int32): float32[] { return [narrow, signed]; }"],
  ["declared concise body", "function run(narrow: float32, signed: int32): void { const make = (): float32[] => [narrow, signed]; }"],
  ["declared async return", "async function run(narrow: float32, signed: int32): Promise<float32[]> { return [narrow, signed]; }"],
  ["concrete as position", "function run(narrow: float32, signed: int32): void { const values = ([narrow, signed] as float32[]); }"],
  ["concrete satisfies position", "function run(narrow: float32, signed: int32): void { const values = ([narrow, signed] satisfies float32[]); }"],
] as const) {
  test(`C30 ${name} owns the construction type without joining fixed element carriers`, () => {
    const current = fixture(body);
    assert.equal(current.source.effectiveTypes.refusals().length, 0);
    const literal = current.nodes.find(node => current.source.ast.is.IsArrayLiteralExpression(node));
    if (literal === undefined) throw new Error("The original declared array literal is required.");
    const outcome = current.source.effectiveTypes.get(literal);
    assert.equal(outcome !== undefined && outcome.kind !== "refused", true, name);
    if (outcome === undefined || outcome.kind === "refused") throw new Error("The declared construction type is required.");
    assertSameValue(outcome.type, { kind: "array", readonly: false, element: { kind: "primitive", primitive: "float32" } });
    assert.equal(outcome.provenance.component?.authoredTypeNode !== undefined, true);
    for (const [parameterName, primitive] of [["narrow", "float32"], ["signed", "int32"]] as const) {
      const parameter = current.nodes.find(node => current.source.ast.is.IsParameterDeclaration(node) &&
        current.source.ast.text(current.source.ast.name(node)) === parameterName);
      if (parameter === undefined) throw new Error("The exact fixed source parameter is required.");
      for (const use of current.source.navigation.declarationUses(parameter)) {
        if (use.kind === "type-only" || use.kind === "source-linkage") continue;
        const value = current.source.effectiveTypes.get(use.reference);
        assert.equal(value !== undefined && value.kind !== "refused", true, parameterName);
        if (value === undefined || value.kind === "refused") throw new Error("The original fixed operand is required.");
        assertSameValue(value.type, { kind: "primitive", primitive });
      }
    }
    assert.equal(current.source.effectiveTypes.obligations().some(obligation => obligation.kind === "literal-admission" &&
      obligation.site === literal && isDeepStrictEqual(obligation.type, outcome.type)), false);
  });
}

test("C30 a declared construction never retypes an independently filled open operand", () => {
  const current = fixture("declare function broad(value: number): void; function run(signed: int32): void { const value = 1; broad(value); const values: float32[] = [value, signed]; }");
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
  assertSameValue(current.type("value"), { kind: "primitive", primitive: "float64" });
  assertSameValue(current.type("values"), { kind: "array", readonly: false, element: { kind: "primitive", primitive: "float32" } });
  const literal = current.nodes.find(node => current.source.ast.is.IsArrayLiteralExpression(node));
  const outcome = literal === undefined ? undefined : current.source.effectiveTypes.get(literal);
  assert.equal(outcome !== undefined && outcome.kind !== "refused", true);
});

test("C30 data-member construction keeps its declared shape and the original operands", () => {
  const current = fixture("declare function broad(value: number): void; function run(signed: int32): void { const value = 1; broad(value); const data: { first: float32; second: number } = { first: value, second: signed }; }");
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
  assertSameValue(current.type("value"), { kind: "primitive", primitive: "float64" });
  const literal = current.nodes.find(node => current.source.ast.is.IsObjectLiteralExpression(node));
  const outcome = literal === undefined ? undefined : current.source.effectiveTypes.get(literal);
  assert.equal(outcome !== undefined && outcome.kind !== "refused" && outcome.type.kind === "shape", true);
  if (outcome === undefined || outcome.kind === "refused" || outcome.type.kind !== "shape") {
    throw new Error("The exact declared data-member construction is required.");
  }
  for (const [name, primitive] of [["first", "float32"], ["second", "float64"]] as const) {
    assert.equal(outcome.type.members.some(member => member.name === name && member.type.kind === "primitive" &&
      member.type.primitive === primitive), true, name);
  }
});

test("an index-signature declared construction publishes its declared reference without an initializer retry", () => {
  const current = fixture("type Indexed = { [name: string]: number }; function run(): void { const data: Indexed = { value: 1 }; }");
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
  const literal = current.nodes.find(node => current.source.ast.is.IsObjectLiteralExpression(node));
  assert.equal(literal !== undefined, true);
  const declaration = current.nodes.find(node => current.source.ast.is.IsTypeAliasDeclaration(node) &&
    current.source.ast.text(current.source.ast.name(node)) === "Indexed");
  for (const node of [current.declaration("data"), literal]) {
    const outcome = node === undefined ? undefined : current.source.effectiveTypes.get(node);
    assert.equal(declaration !== undefined && outcome !== undefined && outcome.kind !== "refused" &&
      outcome.type.kind === "declared" && outcome.type.declaration === declaration, true);
  }
  assert.equal(current.nodes.some(node => {
    const outcome = current.source.effectiveTypes.get(node);
    return outcome !== undefined && outcome.kind !== "refused" && outcome.type.kind === "shape" &&
      outcome.type.members.some(member => member.name === "value");
  }), false, "the initializer is never inferred into an unrelated structural carrier");
  const admissions = current.source.effectiveTypes.obligations().filter(obligation =>
    obligation.kind === "literal-admission" && obligation.site === literal);
  assert.equal(admissions.length, 1);
});

test("C29 open union demands still produce the original Host refusal", () => {
  const current = fixture("declare function take(value: number | string): void; function run(): void { const value = 1; take(value); }");
  assert.equal(current.source.effectiveTypes.refusals().some(issue => issue.code === "TSONIC_LOCAL_TYPE_UNION"), true);
  assert.equal(outcomeCode(current.source.effectiveTypes.get(current.declaration("value"))), "TSONIC_LOCAL_TYPE_UNION");
});

test("synthetic call result terms never request literal construction admission", () => {
  const current = fixture("function run(values: int32[]): void { const mapped = values.map(value => value); const filtered = values.filter(value => value > 0); const actual = [1, 2]; }");
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
  const admissions = current.source.effectiveTypes.obligations().filter(obligation => obligation.kind === "literal-admission");
  const aggregate = admissions.filter(obligation => obligation.type.kind === "array" || obligation.type.kind === "shape");
  assert.equal(aggregate.length > 0, true);
  assert.equal(aggregate.every(obligation => current.source.ast.is.IsArrayLiteralExpression(obligation.site) ||
    current.source.ast.is.IsObjectLiteralExpression(obligation.site)), true);
  assert.equal(admissions.every(obligation => !current.source.ast.is.IsCallExpression(obligation.site)), true);
  assert.equal(admissions.some(obligation => current.source.ast.is.IsNumericLiteral(obligation.site)), true);
});

test("C2224 an array construction owns the mixed-fixed refusal through an asserted numeric peer", () => {
  const current = fixture("function run(narrow: float32): void { const values = [narrow, 0.5 as number]; void values; }");
  const literal = current.nodes.find(node => current.source.ast.is.IsArrayLiteralExpression(node));
  const issues = current.source.effectiveTypes.refusals();
  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.code === "TSONIC_LOCAL_TYPE_MIXED_ELEMENTS" && issues[0].site === literal, true,
    "the construction, not an alias or later scalar demand, owns the C19 cause");
});

test("C2224 a non-fitting literal retains its fixed peer and exact D2 obligation", () => {
  for (const elements of ["signed, 9007199254740993", "9007199254740993, signed", "signed, -9007199254740993"]) {
    const current = fixture(`function run(signed: int32): void { const values = [${elements}]; void values; }`);
    assert.equal(current.source.effectiveTypes.refusals().length, 0, elements);
    const selected = current.type("values");
    assert.equal(selected.kind === "array" && selected.element.kind === "primitive" &&
      selected.element.primitive === "int32", true, elements);
    const original = current.nodes.find(node => current.source.ast.text(node) === elements.split(", ").find(part => part !== "signed") &&
      (current.source.ast.is.IsNumericLiteral(node) || current.source.ast.is.IsPrefixUnaryExpression(node)));
    assert.equal(original !== undefined && current.source.effectiveTypes.obligations().some(obligation =>
      obligation.kind === "literal-admission" && obligation.site === original &&
      obligation.type.kind === "primitive" && obligation.type.primitive === "int32"), true,
    "the original retained token reaches Native range admission without a Host fit refusal");
  }
});

test("C2224 a refused empty construction suppresses its dependent projection refusal", () => {
  const current = fixture("function run(): boolean { const values = []; values[0] = 1; return values !== undefined; }");
  const issues = current.source.effectiveTypes.refusals();
  assert.equal(issues.length, 1);
  const literal = current.nodes.find(node => current.source.ast.is.IsArrayLiteralExpression(node));
  assert.equal(issues[0]?.code === "TSONIC_UNTYPED_ARRAY_LITERAL" && issues[0].site === literal, true);
  const access = current.nodes.find(node => current.source.ast.is.IsElementAccessExpression(node));
  assert.equal(access !== undefined && current.source.effectiveTypes.get(access) === issues[0], true,
    "the projection carries the same construction cause, not a textual duplicate");
});

test("C2224 independent empty constructions retain independent causes", () => {
  const current = fixture("function run(): void { const first = {}; const second = {}; void first; void second; }");
  const issues = current.source.effectiveTypes.refusals();
  assert.equal(issues.length, 2);
  assert.equal(issues.every(issue => issue.code === "TSONIC_UNTYPED_OBJECT_LITERAL"), true);
  assert.equal(issues[0] !== issues[1] && issues[0]?.site !== issues[1]?.site, true);
});

test("C30 uses the unique kind-matching declared parameter arm and retains its member declaration", () => {
  const current = fixture(`declare function take(value: { count: int32 } | readonly number[]): void;
    function run(): void { take({ count: 1 }); take([1, 2]); }`);
  const literal = current.nodes.find(node => current.source.ast.is.IsObjectLiteralExpression(node));
  const array = current.nodes.find(node => current.source.ast.is.IsArrayLiteralExpression(node));
  const member = current.nodes.find(node => current.source.ast.is.IsPropertySignatureDeclaration(node));
  const objectType = literal === undefined ? undefined : current.source.effectiveTypes.get(literal);
  const arrayType = array === undefined ? undefined : current.source.effectiveTypes.get(array);
  assert.equal(objectType !== undefined && objectType.kind !== "refused" && objectType.type.kind === "shape", true);
  if (objectType === undefined || objectType.kind === "refused" || objectType.type.kind !== "shape") throw new Error("The chosen object arm is required.");
  assert.equal(member !== undefined && objectType.type.members[0]?.declaration === member, true);
  assertSameValue(objectType.type.members[0]?.type, { kind: "primitive", primitive: "int32" });
  assert.equal(arrayType !== undefined && arrayType.kind !== "refused", true);
  if (arrayType === undefined || arrayType.kind === "refused") throw new Error("The chosen array arm is required.");
  assertSameValue(arrayType.type, { kind: "array", readonly: true, element: { kind: "primitive", primitive: "float64" } });
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
});

test("C30 ambiguous declared object arms retain their own structural refusal origin", () => {
  const current = fixture(`declare function take(value: { count: int32 } | { count: float32 }): void;
    function run(): void { take({ count: 1 }); }`);
  const literal = current.nodes.find(node => current.source.ast.is.IsObjectLiteralExpression(node));
  const graph = collectSourceTypeFlowEdges(createSourceTypeFlowAnalysisContext(current.source).context);
  const record = graph.nodes.find(node => node.node === literal && node.variable.path.length === 0);
  assert.equal(record?.declaredSlotRefusal !== undefined && graph.refusals.includes(record.declaredSlotRefusal), true);
  const issues = current.source.effectiveTypes.refusals();
  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.code === "TSONIC_LOCAL_TYPE_UNION" && issues[0].site === literal, true);
  assert.equal(literal !== undefined && current.source.effectiveTypes.get(literal)?.kind === "refused", true);
});

test("C30 carries declared nested element slots through both coalescing return branches", () => {
  const current = fixture(`declare const input: { rows: readonly number[][] } | undefined;
    function run(): { rows: readonly number[][] } { return input ?? { rows: [[1, 2]] }; }`);
  const arrays = current.nodes.filter(node => current.source.ast.is.IsArrayLiteralExpression(node));
  assert.equal(arrays.length, 2);
  const selected = arrays.map(node => current.source.effectiveTypes.get(node));
  assert.equal(selected.every(type => type !== undefined && type.kind !== "refused"), true);
  if (selected[0] === undefined || selected[0].kind === "refused" || selected[1] === undefined || selected[1].kind === "refused") {
    throw new Error("Both declared array construction slots are required.");
  }
  assertSameValue(selected[0].type, { kind: "array", readonly: true, element: {
    kind: "array", readonly: false, element: { kind: "primitive", primitive: "float64" } } });
  assertSameValue(selected[1].type, { kind: "array", readonly: false, element: { kind: "primitive", primitive: "float64" } });
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
});

for (const returned of ["Value", "Locked<Value>"]) {
  test(`B2 fills a generic ${returned} result and its original unbound construction structurally`, () => {
    const current = fixture(`type Locked<Value> = { readonly [Key in keyof Value]: Value[Key] };
      declare function retain<Value>(value: Value): ${returned};
      function run(): void { const selected: object = retain({}); }`);
    const literal = current.nodes.find(node => current.source.ast.is.IsObjectLiteralExpression(node));
    const call = current.nodes.find(node => current.source.ast.is.IsCallExpression(node));
    const selected = literal === undefined ? undefined : current.source.effectiveTypes.get(literal);
    assert.equal(selected !== undefined && selected.kind !== "refused", true);
    if (selected === undefined || selected.kind === "refused") throw new Error("The filled construction is required.");
    assertSameValue(selected.type, { kind: "intrinsic", intrinsic: "object" });
    assertSameValue(current.type("selected"), { kind: "intrinsic", intrinsic: "object" });
    const instance = call === undefined ? undefined : current.source.effectiveTypes.callInstantiation(call);
    assert.equal(instance?.method.length, 1);
    assertSameValue(instance?.method[0]?.type, { kind: "intrinsic", intrinsic: "object" });
    assert.equal(current.source.effectiveTypes.refusals().length, 0);
  });
}

test("a merged Map constructor retains the actual type declaration and both source arguments", () => {
  const current = fixture(`function run(): void { const selected = new Map<int32, string>(); }`);
  const selected = current.type("selected");
  assert.equal(selected.kind === "declared", true);
  if (selected.kind !== "declared") throw new Error("The actual Map type declaration is required.");
  assert.equal(current.source.ast.is.IsInterfaceDeclaration(selected.declaration), true);
  assert.equal(current.source.ast.typeParameters(selected.declaration).length, 2);
  assertSameValue(selected.typeArguments, [{ kind: "primitive", primitive: "int32" }, { kind: "string" }]);
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
});

test("inherited receiver and method binders retain their distinct declarations and chosen widths", () => {
  const current = fixture(`interface Root<Outer> { read<Value extends Outer>(value: Value): Outer; }
    interface View<Body> extends Root<Body> {}
    function run(view: View<int32>, value: int32): void { const selected = view.read(value); }`);
  const call = current.nodes.find(node => current.source.ast.is.IsCallExpression(node));
  const instance = call === undefined ? undefined : current.source.effectiveTypes.callInstantiation(call);
  const outer = current.nodes.find(node => current.source.ast.is.IsTypeParameterDeclaration(node) && current.source.ast.text(current.source.ast.name(node)) === "Outer");
  const method = current.nodes.find(node => current.source.ast.is.IsTypeParameterDeclaration(node) && current.source.ast.text(current.source.ast.name(node)) === "Value");
  assert.equal(instance?.receiver.length === 1 && instance.receiver[0]?.declaration === outer, true);
  assert.equal(instance?.method.length === 1 && instance.method[0]?.declaration === method && outer !== method, true);
  assertSameValue(instance?.receiver[0]?.type, { kind: "primitive", primitive: "int32" });
  assertSameValue(instance?.method[0]?.type, { kind: "primitive", primitive: "int32" });
  assertSameValue(current.type("selected"), { kind: "primitive", primitive: "int32" });
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
});

test("a declared generic binding leaf retains the substituted property and callable member identities", () => {
  const current = fixture(`interface Box<Value> { value: Value; read(): Value; }
    function run(box: Box<int32>): void { const { value, read } = box; }`);
  const leaves = current.nodes.filter(node => current.source.ast.is.IsBindingElement(node));
  const value = leaves.find(node => current.source.ast.text(current.source.ast.name(node)) === "value");
  const read = leaves.find(node => current.source.ast.text(current.source.ast.name(node)) === "read");
  const valueType = value === undefined ? undefined : current.source.effectiveTypes.get(value);
  const readType = read === undefined ? undefined : current.source.effectiveTypes.get(read);
  assert.equal(valueType !== undefined && valueType.kind !== "refused" && readType !== undefined && readType.kind !== "refused", true);
  if (valueType === undefined || valueType.kind === "refused" || readType === undefined || readType.kind === "refused") throw new Error("The declared binding leaves are required.");
  assertSameValue(valueType.type, { kind: "primitive", primitive: "int32" });
  assert.equal(readType.type.kind === "callable", true);
  if (readType.type.kind !== "callable") throw new Error("A selected method value is callable, not its return type.");
  const declaredMethod = current.nodes.find(node => current.source.ast.is.IsMethodSignatureDeclaration(node));
  assert.equal(readType.type.calls[0]?.declaration === declaredMethod, true);
  assertSameValue(readType.type.calls[0]?.result, { kind: "primitive", primitive: "int32" });
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
});

test("never-open field arrays publish one int32 default at their declaration, initializer and reads", () => {
  const current = fixture(`class Counter { values = [1, 2]; read() { return this.values; } }`);
  const declaration = current.nodes.find(node => current.source.ast.is.IsPropertyDeclaration(node));
  const literal = current.nodes.find(node => current.source.ast.is.IsArrayLiteralExpression(node));
  const access = current.nodes.find(node => current.source.ast.is.IsPropertyAccessExpression(node));
  for (const node of [declaration, literal, access]) {
    const selected = node === undefined ? undefined : current.source.effectiveTypes.get(node);
    assert.equal(selected !== undefined && selected.kind !== "refused", true);
    if (selected === undefined || selected.kind === "refused") throw new Error("Every field value occurrence is required.");
    assertSameValue(selected.type, { kind: "array", readonly: false, element: { kind: "primitive", primitive: "int32" } });
  }
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
});

test("one callable return publication retains zero-argument declared results and full inferred async carriers", () => {
  const current = fixture(`const exact = (): int32 => 1; const first = exact();
    async function deferred() { return exact(); }`);
  assertSameValue(current.type("first"), { kind: "primitive", primitive: "int32" });
  const arrow = current.nodes.find(node => current.source.ast.is.IsArrowFunction(node));
  const asynchronous = current.nodes.find(node => current.source.ast.is.IsFunctionDeclaration(node));
  const exact = arrow === undefined ? undefined : current.source.effectiveTypes.callableReturn(arrow);
  const deferred = asynchronous === undefined ? undefined : current.source.effectiveTypes.callableReturn(asynchronous);
  assert.equal(exact !== undefined && exact.kind !== "refused" && deferred !== undefined && deferred.kind !== "refused", true);
  if (exact === undefined || exact.kind === "refused" || deferred === undefined || deferred.kind === "refused") throw new Error("Both complete callable returns are required.");
  assert.equal(exact.provenance.occurrence === arrow && deferred.provenance.occurrence === asynchronous, true);
  assertSameValue(exact.type, { kind: "primitive", primitive: "int32" });
  assert.equal(deferred.type.kind === "declared", true);
  if (deferred.type.kind !== "declared") throw new Error("An async return is the full carrier, not its payload.");
  assertSameValue(deferred.type.typeArguments, [{ kind: "primitive", primitive: "int32" }]);
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
});

test("an intrinsic object slot preserves separately published physical values, methods and getter returns", () => {
  const current = fixture(`function run(): void { const selected: object = {
    count: 7, read(): int32 { return 1; }, get total(): int32 { return 2; }
  }; }`);
  const literal = current.nodes.find(node => current.source.ast.is.IsObjectLiteralExpression(node));
  const property = current.nodes.find(node => current.source.ast.is.IsPropertyAssignment(node));
  const child = property === undefined ? undefined : current.source.ast.as.AsPropertyAssignment(property)?.Initializer;
  const method = current.nodes.find(node => current.source.ast.is.IsMethodDeclaration(node));
  const getter = current.nodes.find(node => current.source.ast.is.IsGetAccessorDeclaration(node));
  const object = literal === undefined ? undefined : current.source.effectiveTypes.get(literal);
  const count = child === undefined ? undefined : current.source.effectiveTypes.get(child);
  const callable = method === undefined ? undefined : current.source.effectiveTypes.get(method);
  const returned = getter === undefined ? undefined : current.source.effectiveTypes.callableReturn(getter);
  assert.equal(object !== undefined && object.kind !== "refused" && count !== undefined && count.kind !== "refused", true);
  if (object === undefined || object.kind === "refused" || count === undefined || count.kind === "refused") throw new Error("The slot and its original child publication are required.");
  assertSameValue(object.type, { kind: "intrinsic", intrinsic: "object" });
  assertSameValue(count.type, { kind: "primitive", primitive: "int32" });
  assert.equal(callable !== undefined && callable.kind !== "refused" && callable.type.kind === "callable", true);
  if (callable === undefined || callable.kind === "refused" || callable.type.kind !== "callable") throw new Error("The real method publication is required.");
  assert.equal(callable.type.calls[0]?.declaration === method, true);
  assertSameValue(callable.type.calls[0]?.result, { kind: "primitive", primitive: "int32" });
  assert.equal(returned !== undefined && returned.kind !== "refused" && returned.provenance.occurrence === getter, true);
  if (returned === undefined || returned.kind === "refused") throw new Error("The getter's actual value return is required.");
  assertSameValue(returned.type, { kind: "primitive", primitive: "int32" });
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
});

test("a C8 fixed heterogeneous construction keeps its scalar child at the complete closed source element type", () => {
  const current = fixture(`function run(): void { const values = ["text", 9007199254740993]; }`);
  const number = current.nodes.find(node => current.source.ast.is.IsNumericLiteral(node));
  const selected = number === undefined ? undefined : current.source.effectiveTypes.get(number);
  assert.equal(selected !== undefined && selected.kind !== "refused", true);
  if (selected === undefined || selected.kind === "refused") throw new Error("The original numeric value publication is required.");
  assert.equal(sourceTypeDescriptorsEqual(selected.type, { kind: "union", types: [{ kind: "string" }, { kind: "primitive", primitive: "float64" }] }), true);
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
});

test("C2232 scalar tokens retain the entire declared union instead of selecting a physical arm", () => {
  const current = fixture(`declare function take(value: string | int32): void;
    function run(narrow: float32, signed: int32): void {
      take(1); const values: (float32 | int32 | number)[] = [narrow, signed, 9007199254740992];
    }`);
  const tokens = current.nodes.filter(node => current.source.ast.is.IsNumericLiteral(node));
  assert.equal(tokens.length, 2);
  const first = tokens[0] === undefined ? undefined : current.source.effectiveTypes.get(tokens[0]);
  const second = tokens[1] === undefined ? undefined : current.source.effectiveTypes.get(tokens[1]);
  assert.equal(first !== undefined && first.kind !== "refused" && second !== undefined && second.kind !== "refused", true);
  if (first === undefined || first.kind === "refused" || second === undefined || second.kind === "refused") throw new Error("Both complete scalar slots are required.");
  assert.equal(sourceTypeDescriptorsEqual(first.type, { kind: "union", types: [{ kind: "string" }, { kind: "primitive", primitive: "int32" }] }), true);
  assert.equal(sourceTypeDescriptorsEqual(second.type, { kind: "union", types: [
    { kind: "primitive", primitive: "float32" }, { kind: "primitive", primitive: "int32" }, { kind: "primitive", primitive: "float64" },
  ] }), true);
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
});

test("negative zero publishes the floating default for an open and an exported binding", () => {
  const current = fixture("function run(): void { const local = -0; const derived = local + 1; } export const exported = -0;");
  for (const name of ["local", "derived", "exported"]) assertSameValue(current.type(name), { kind: "primitive", primitive: "float64" });
});

test("C30 signed literal children retain the same declared scalar and union slot", () => {
  const current = fixture(`function direct(): number { return -2147483649; }
    function values(): (string | number)[] { return ["text", 9007199254740993, -9007199254740993, 1e100]; }
    const signed: number = -2147483649;
    const minimum: int32 = -2147483648;`);
  const { ast } = current.source;
  const negative = current.nodes.filter(node => ast.is.IsPrefixUnaryExpression(node) && ast.operatorKindName(node) === "KindMinusToken");
  assert.equal(negative.length, 4);
  for (const node of negative) {
    const operand = ast.as.AsPrefixUnaryExpression(node)?.Operand;
    const whole = current.source.effectiveTypes.get(node);
    const child = operand === undefined ? undefined : current.source.effectiveTypes.get(operand);
    assert.equal(whole !== undefined && whole.kind !== "refused" && child !== undefined && child.kind !== "refused", true,
      "the original signed construction and spelling child both have an exact publication");
    if (whole === undefined || whole.kind === "refused" || child === undefined || child.kind === "refused") throw new Error("Both original signed-literal outcomes are required.");
    assert.equal(sourceTypeDescriptorsEqual(whole.type, child.type), true,
      "the spelling child does not acquire an independent int32 default under a declared floating slot");
  }
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
});

test("B8 counters keep their int64 rule through checked declaration components and every read", () => {
  const current = fixture(`function run(values: int32[]): int32 {
    let total: int32 = 0;
    for (let index = 0; index < values.length; index++) total += values[index];
    return total;
  }`);
  const { ast } = current.source;
  const declaration = current.declaration("index");
  const occurrences = current.nodes.filter(node => node === declaration || ast.is.IsIdentifier(node) && ast.text(node) === "index" &&
    ast.name(ast.parent(node)) !== node);
  assert.equal(occurrences.length >= 4, true);
  for (const node of occurrences) {
    const result = current.source.effectiveTypes.get(node);
    assert.equal(result !== undefined && result.kind !== "refused" && result.type.kind === "primitive" &&
      result.type.primitive === "int64" && result.provenance.fixedRule?.kind === "loop-counter" &&
      result.provenance.fixedRule.declaration === declaration, true, "one original counter rule owns the declaration and its reads");
  }
});

test("project class and interface declarations publish their own member identities without a value read", () => {
  const current = fixture(`interface View<T> { value: T; accept?(next: T): T; }
    class Box<T> { value: T; constructor(value: T) { this.value = value; } read(): T { return this.value; } }`);
  const { ast } = current.source;
  const owners = current.nodes.filter(node => ast.is.IsInterfaceDeclaration(node) || ast.is.IsClassDeclaration(node));
  assert.equal(owners.length, 2);
  for (const node of owners) {
    const result = current.source.effectiveTypes.get(node);
    assert.equal(result !== undefined && result.kind !== "refused" && result.type.kind === "declared" && result.type.declaration === node &&
      result.provenance.occurrence === node, true, "the exact declaration has its instance descriptor, not a constructor-value or an absent outcome");
    if (result === undefined || result.kind === "refused" || result.type.kind !== "declared") throw new Error("The project declaration descriptor is required.");
    const members = result.type.members;
    assert.equal(members !== undefined && members.length === 2, true);
    for (const member of members ?? []) assert.equal(member.declaration !== undefined && ast.parent(member.declaration) === node, true,
      "each published member keeps its actual owning source declaration");
    if (ast.is.IsInterfaceDeclaration(node)) assert.equal(members?.find(member => member.name === "accept")?.optional, true);
  }
});

test("class-expression values retain their constructor contract independently of declaration instance shapes", () => {
  const current = fixture("const Make = class { value = 1; }; const item = new Make();");
  const expression = current.nodes.find(node => current.source.ast.is.IsClassExpression(node));
  const chosen = expression === undefined ? undefined : current.source.effectiveTypes.get(expression);
  assert.equal(chosen !== undefined && chosen.kind !== "refused" && chosen.type.kind === "callable" &&
    chosen.type.constructs.length === 1, true, "a runtime class expression keeps its real constructor value descriptor");
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
});

test("unused real signature parameters publish the same chosen descriptor as their callable", () => {
  const current = fixture(`export function run(price: number, replacement: int32[], wide: int64): boolean {
    const items = [1, 2]; return items[0] === 1;
  }`);
  const declaration = current.nodes.find(node => current.source.ast.is.IsFunctionDeclaration(node));
  const callable = declaration === undefined ? undefined : current.source.effectiveTypes.get(declaration);
  assert.equal(callable !== undefined && callable.kind !== "refused" && callable.type.kind === "callable", true);
  if (callable === undefined || callable.kind === "refused" || callable.type.kind !== "callable") throw new Error("The actual callable is required.");
  const parameters = callable.type.calls[0]?.parameters ?? [];
  assert.equal(parameters.length, 3);
  for (const parameter of parameters) {
    const outcome = parameter.declaration === undefined ? undefined : current.source.effectiveTypes.get(parameter.declaration);
    assert.equal(outcome !== undefined && outcome.kind !== "refused", true, "an unused parameter is still a real value declaration");
    if (outcome === undefined || outcome.kind === "refused") throw new Error("The actual parameter outcome is required.");
    assert.equal(sourceTypeDescriptorsEqual(outcome.type, parameter.type), true);
    assert.equal(outcome.provenance.occurrence === parameter.declaration, true);
  }
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
});


for (const initializer of ["value => value", "function(value) { const copied = value; return copied; }"]) {
  test(`a declared callable slot owns its actual parameters and return before body solving: ${initializer}`, () => {
    const current = fixture(`export const callback: (value: int32) => int32 = ${initializer};`);
    const { ast } = current.source;
    const callable = ast.as.AsVariableDeclaration(current.declaration("callback"))?.Initializer;
    if (callable === undefined) throw new Error("The actual checked callable is required.");
    const parameter = ast.parameters(callable)[0];
    if (parameter === undefined) throw new Error("The actual checked parameter is required.");
    const isInt32 = (outcome: SourceEffectiveTypeOutcome | undefined): boolean => outcome !== undefined &&
      outcome.kind !== "refused" && outcome.type.kind === "primitive" && outcome.type.primitive === "int32";
    assert.equal(isInt32(current.source.effectiveTypes.get(parameter)), true, "the real parameter inherits its authored slot width");
    const reads = current.nodes.filter(node => ast.is.IsIdentifier(node) && ast.name(parameter) !== node &&
      current.source.navigation.sourceReferenceFor(node)?.declaration === parameter);
    assert.equal(reads.length > 0, true, "the checked body reads the real parameter");
    assert.equal(reads.every(node => isInt32(current.source.effectiveTypes.get(node))), true,
      "the body graph uses the chosen parameter width, not a late callable-only repair");
    const returned = current.source.effectiveTypes.callableReturn(callable);
    assert.equal(isInt32(returned) && returned?.kind !== "refused" && returned?.provenance.occurrence === callable, true);
    const value = current.source.effectiveTypes.get(callable);
    assert.equal(value !== undefined && value.kind !== "refused" && value.type.kind === "callable" &&
      value.type.calls[0]?.declaration === callable && value.type.calls[0].parameters[0]?.declaration === parameter &&
      value.type.calls[0].parameters[0].type.kind === "primitive" && value.type.calls[0].parameters[0].type.primitive === "int32" &&
      value.type.calls[0].result.kind === "primitive" && value.type.calls[0].result.primitive === "int32", true);
    const admissions = current.source.effectiveTypes.obligations().filter(row => row.kind === "write-fit" && row.required === callable);
    assert.equal(admissions.length, 1, "the actual return expression has one native admission against the declared result");
    assert.equal(admissions[0]?.type.kind === "primitive" && admissions[0].type.primitive === "int32" &&
      admissions[0].valueType?.kind === "primitive" && admissions[0].valueType.primitive === "int32", true);
    assert.equal(current.source.effectiveTypes.refusals().length, 0);
  });
}

test("nested declared callables retain authored union order and async returns retain their full Promise", () => {
  const current = fixture(`const nested: () => () => string | int32 = () => () => 1 as int32;
    const asynchronous: (value: int32) => Promise<int32> = async value => value;`);
  const { ast } = current.source;
  const outer = ast.as.AsVariableDeclaration(current.declaration("nested"))?.Initializer;
  const inner = outer === undefined ? undefined : ast.body(outer);
  const asynchronous = ast.as.AsVariableDeclaration(current.declaration("asynchronous"))?.Initializer;
  if (inner === undefined || asynchronous === undefined) throw new Error("The actual checked callable occurrences are required.");
  const returned = current.source.effectiveTypes.callableReturn(inner);
  assert.equal(returned !== undefined && returned.kind !== "refused" && returned.type.kind === "union" &&
    returned.type.types.length === 2 && returned.type.types[0]?.kind === "string" &&
    returned.type.types[1]?.kind === "primitive" && returned.type.types[1].primitive === "int32", true,
    "declared union order comes from the authored result, never the order of inferred returns");
  const deferred = current.source.effectiveTypes.callableReturn(asynchronous);
  assert.equal(deferred !== undefined && deferred.kind !== "refused" && deferred.provenance.occurrence === asynchronous &&
    deferred.type.kind === "declared" && deferred.type.typeArguments.length === 1 &&
    deferred.type.typeArguments[0]?.kind === "primitive" && deferred.type.typeArguments[0].primitive === "int32", true,
    "the canonical callable return contains the complete Promise, not a target-wrapped payload");
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
});

test("fixed heterogeneous parents retain inferred admission authority without admissions on reads or assignment patterns", () => {
  const current = fixture(`function run(): void {
    const values = ["text", 9007199254740993]; const alias = values; void alias;
    let first: number = 0; const declared: number[] = [1]; [first] = declared;
  }`);
  const { ast } = current.source;
  const literal = ast.as.AsVariableDeclaration(current.declaration("values"))?.Initializer;
  if (literal === undefined) throw new Error("The actual heterogeneous construction is required.");
  const admissions = current.source.effectiveTypes.obligations().filter(row => row.kind === "literal-admission");
  const matching = admissions.filter(row => row.site === literal);
  const outcome = current.source.effectiveTypes.get(literal);
  assert.equal(matching.length, 1);
  assert.equal(matching[0]?.kind === "literal-admission" && matching[0].authority === "inferred" &&
    outcome !== undefined && outcome.kind !== "refused" && sourceTypeDescriptorsEqual(matching[0].type, outcome.type), true,
    "a fixed C8 parent carries its published type and actual inferred origin, never a fabricated declared origin");
  assert.equal(admissions.length, 2, "only the two real aggregate constructions request D2 admission");
  assert.equal(admissions.every(row => ast.is.IsArrayLiteralExpression(row.site)), true);
});

test("literal admission retains its actual inferred or declared Source authority", () => {
  const current = fixture(`type Indexed = { readonly [key: string]: number };
    function run(): void { const inferred = [1, 2]; const declared: Indexed = { value: 1 }; }`);
  const { ast } = current.source;
  const inferred = ast.as.AsVariableDeclaration(current.declaration("inferred"))?.Initializer;
  const declared = ast.as.AsVariableDeclaration(current.declaration("declared"))?.Initializer;
  for (const [literal, authority] of [[inferred, "inferred"], [declared, "declared"]] as const) {
    assert.equal(literal !== undefined, true, "the actual construction exists in the checked source");
    const admissions = current.source.effectiveTypes.obligations().filter(row => row.kind === "literal-admission" && row.site === literal);
    assert.equal(admissions.length, 1, "one canonical construction admission owns the Source authority");
    assert.equal(admissions[0]?.kind === "literal-admission" && admissions[0].authority === authority, true);
  }
  assert.equal(current.source.effectiveTypes.refusals().length, 0);
});

function assertSameValue(actual: unknown, expected: unknown): void {
  assert.equal(isDeepStrictEqual(actual, expected), true, "exact source descriptor equality");
}

import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, type Node } from "@tsonic/tsts";
import { createSourceTypeFlowTerms, freezeSourceTypeDescriptor, sourceTypeDescriptorDepth, sourceTypeDescriptorsEqual } from "./terms.js";
import type { SourceTypeDescriptor, SourceTypeFlowGraph, SourceTypeFlowNode, SourceTypeFlowTerm, SourceTypeFlowVariable } from "./types.js";

function fixture() {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/index.ts": "function run() { const first = 1; const second = 2; const third = 3; } class Left { value = 1; } class Right {}",
  }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length, 0);
  const file = checked.getSourceFile("/src/index.ts");
  if (file === undefined) throw new Error("The original checked file is required.");
  const nodes: Node[] = [];
  const visit = (node: Node): void => {
    if (checked.ast.is.IsVariableDeclaration(node) || checked.ast.is.IsClassDeclaration(node)) nodes.push(node);
    checked.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  visit(file);
  const variable = (index: number): SourceTypeFlowVariable => ({ node: nodes[index]!, path: [] });
  const entry = (value: SourceTypeFlowVariable, term?: SourceTypeFlowTerm): SourceTypeFlowNode => ({
    node: value.node, root: file, variable: value, kind: "value", publish: true, ...(term === undefined ? {} : { term }),
  });
  const graph = (values: readonly SourceTypeFlowNode[], links: SourceTypeFlowGraph["links"] = []): SourceTypeFlowGraph => ({
    roots: [file], nodes: values, links, derived: [], calls: [], refusals: [],
  });
  return { ast: checked.ast, nodes, variable, entry, graph };
}

test("canonical variable paths use original nodes and structural positions", () => {
  const current = fixture();
  const first = { node: current.nodes[0]!, path: [{ kind: "member", name: "value" }] as const };
  const same = { node: current.nodes[0]!, path: [{ kind: "member", name: "value" }] as const };
  const other = { node: current.nodes[1]!, path: [{ kind: "member", name: "value" }] as const };
  const terms = createSourceTypeFlowTerms(current.ast, current.graph([current.entry(first), current.entry(other)]));
  assert.equal(terms.group(first).variable === terms.group(same).variable, true);
  assert.equal(terms.group(first).variable === terms.group(other).variable, false);
});

test("array aliases unify their exact element positions", () => {
  const current = fixture(); const first = current.variable(0); const second = current.variable(1);
  const firstElement: SourceTypeFlowVariable = { node: first.node, path: [{ kind: "element" }] };
  const secondElement: SourceTypeFlowVariable = { node: second.node, path: [{ kind: "element" }] };
  const terms = createSourceTypeFlowTerms(current.ast, current.graph([
    current.entry(first, { kind: "array", site: first.node, readonly: false, element: firstElement }),
    current.entry(second, { kind: "array", site: second.node, readonly: false, element: secondElement }),
  ], [{ source: first, target: second, site: second.node }]));
  assert.equal(terms.group(firstElement).variable === terms.group(secondElement).variable, true);
  assert.equal(terms.group(first).refusals.length, 0);
});

test("occurs checks refuse self-containment without a second type answer", () => {
  const current = fixture(); const first = current.variable(0); const second = current.variable(1);
  const terms = createSourceTypeFlowTerms(current.ast, current.graph([
    current.entry(first, { kind: "array", site: first.node, readonly: false, element: second }), current.entry(second),
  ], [{ source: first, target: second, site: second.node }]));
  assert.equal(terms.group(first).refusals[0]?.code, "TSONIC_LOCAL_TYPE_SELF_REFERENCE");
  assert.equal(terms.group(first).variable === terms.group(second).variable, false);
});

test("incompatible structures refuse at the actual later link", () => {
  const current = fixture(); const first = current.variable(0); const second = current.variable(1); const element = current.variable(2);
  const terms = createSourceTypeFlowTerms(current.ast, current.graph([
    current.entry(first, { kind: "array", site: first.node, readonly: false, element }),
    current.entry(second, { kind: "shape", site: second.node, members: [] }),
  ], [{ source: first, target: second, site: second.node }]));
  assert.equal(terms.group(first).refusals[0]?.code, "TSONIC_LOCAL_TYPE_CONFLICT");
  assert.equal(terms.group(first).refusals[0]?.site === second.node, true);
});

test("two tuple positions never collapse to a single array element", () => {
  const current = fixture(); const first = current.variable(0);
  const left: SourceTypeFlowVariable = { node: first.node, path: [{ kind: "tuple", index: 0 }] };
  const right: SourceTypeFlowVariable = { node: first.node, path: [{ kind: "tuple", index: 1 }] };
  const terms = createSourceTypeFlowTerms(current.ast, current.graph([
    current.entry(first, { kind: "tuple", site: first.node, readonly: true,
      elements: [{ kind: "required", variable: left }, { kind: "required", variable: right }] }),
  ]));
  assert.equal(terms.group(left).variable === terms.group(right).variable, false);
});

test("nominal identity includes the original declaration and ordered arguments", () => {
  const current = fixture();
  const integer: SourceTypeDescriptor = { kind: "primitive", primitive: "int32" };
  const floating: SourceTypeDescriptor = { kind: "primitive", primitive: "float64" };
  const first: SourceTypeDescriptor = { kind: "declared", declaration: current.nodes[3]!, typeArguments: [integer, floating] };
  assert.equal(sourceTypeDescriptorsEqual(first, { ...first, declaration: current.nodes[4]! }), false);
  assert.equal(sourceTypeDescriptorsEqual(first, { ...first, typeArguments: [floating, integer] }), false);
  assert.equal(sourceTypeDescriptorsEqual(first, { ...first, typeArguments: [integer, floating] }), true);
});

test("descriptor freezing owns vectors but never freezes checked source nodes", () => {
  const current = fixture(); const declaration = current.nodes[3]!;
  const source: SourceTypeDescriptor = { kind: "declared", declaration, typeArguments: [{ kind: "primitive", primitive: "int32" }] };
  const frozen = freezeSourceTypeDescriptor(source);
  assert.equal(Object.isFrozen(frozen), true);
  assert.equal(frozen.kind === "declared" && Object.isFrozen(frozen.typeArguments), true);
  assert.equal(frozen.kind === "declared" && frozen.declaration === declaration, true);
  assert.equal(Object.isFrozen(source), false);
});

test("member presence survives freezing and is not inferred from its optional value type", () => {
  const current = fixture();
  const declaration = current.ast.members(current.nodes[3]!)[0]!;
  const value: SourceTypeDescriptor = { kind: "optional", value: { kind: "primitive", primitive: "int32" } };
  const required: SourceTypeDescriptor = { kind: "shape", members: [{ name: "value", optional: false, type: value,
    origin: { kind: "declared", declaration } }], indexes: [], calls: [], constructs: [] };
  const optional: SourceTypeDescriptor = { kind: "shape", members: [{ name: "value", optional: true, type: value,
    origin: { kind: "declared", declaration } }], indexes: [], calls: [], constructs: [] };
  assert.equal(sourceTypeDescriptorsEqual(required, optional), false);
  const frozen = freezeSourceTypeDescriptor(required);
  assert.equal(sourceTypeDescriptorsEqual(required, frozen), true);
  assert.equal(frozen.kind === "shape" && frozen.members[0]?.optional === false &&
    frozen.members[0].type.kind === "optional" && Object.isFrozen(frozen.members[0]), true);
});

test("term depth and declared optional descriptors use the same bounded algebra", () => {
  let type: SourceTypeDescriptor = { kind: "primitive", primitive: "int32" };
  for (let depth = 0; depth < 4; depth += 1) type = { kind: "array", readonly: false, element: type };
  assert.equal(sourceTypeDescriptorDepth(type), 4);
  assert.equal(sourceTypeDescriptorDepth({ kind: "optional", value: type }), 5);
  assert.equal(sourceTypeDescriptorsEqual({ kind: "optional", value: type }, type), false);
});

test("C29 eligibility follows canonical aliases and containment but not syntax alone", () => {
  const current = fixture();
  const container = current.variable(0), alias = current.variable(1), unrelated = current.variable(2);
  const element: SourceTypeFlowVariable = { node: container.node, path: [{ kind: "element" }] };
  const graph = current.graph([
    { ...current.entry(container, { kind: "array", site: container.node, readonly: false, element }), kind: "open-local" },
    current.entry(alias), current.entry(unrelated),
  ], [{ source: container, target: alias, site: alias.node }]);
  const terms = createSourceTypeFlowTerms(current.ast, graph);
  assert.equal(terms.isInference(container), true);
  assert.equal(terms.isInference(alias), true);
  assert.equal(terms.isInference(element), true);
  assert.equal(terms.isInference(unrelated), false);
});

test("C29 derived eligibility is directional and does not open fixed operands", () => {
  const current = fixture();
  const operand = current.variable(0), result = current.variable(1), fixed = current.variable(2);
  const graph = current.graph([
    { ...current.entry(result), kind: "derived-local" }, current.entry(operand), current.entry(fixed),
  ]);
  const terms = createSourceTypeFlowTerms(current.ast, { ...graph,
    derived: [{ node: result.node, result, operator: "add", operands: [operand, fixed], required: true }] });
  assert.equal(terms.isInference(result), true);
  assert.equal(terms.isInference(operand), false);
  assert.equal(terms.isInference(fixed), false);
  const downstream = createSourceTypeFlowTerms(current.ast, { ...graph,
    nodes: [{ ...current.entry(operand), kind: "open-local" }, current.entry(result), current.entry(fixed)],
    derived: [{ node: result.node, result, operator: "add", operands: [operand, fixed], required: true }] });
  assert.equal(downstream.isInference(operand), true);
  assert.equal(downstream.isInference(result), true);
  assert.equal(downstream.isInference(fixed), false);
});

for (const kind of ["array", "shape"] as const) {
  test(`C30 declared ${kind} construction positions do not unite or inherit operand inference`, () => {
    const current = fixture();
    const container = current.variable(0), first = current.variable(1), second = current.variable(2);
    const firstPosition: SourceTypeFlowVariable = { node: container.node, path: kind === "array"
      ? [{ kind: "element" }] : [{ kind: "member", name: "first" }] };
    const secondPosition: SourceTypeFlowVariable = kind === "array" ? firstPosition
      : { node: container.node, path: [{ kind: "member", name: "second" }] };
    const term: SourceTypeFlowTerm = kind === "array"
      ? { kind, site: container.node, readonly: false, element: firstPosition }
      : { kind, site: container.node, members: [
        { name: "first", optional: false, variable: firstPosition }, { name: "second", optional: false, variable: secondPosition },
      ] };
    const entries: SourceTypeFlowNode[] = [
      { ...current.entry(container, term), kind: "fixed" },
      { ...current.entry(first, { kind: "fixed", site: first.node, type: { kind: "primitive", primitive: "float32" } }), kind: "open-local" },
      { ...current.entry(second, { kind: "fixed", site: second.node, type: { kind: "primitive", primitive: "int32" } }), kind: "fixed" },
    ];
    const links = [
      { source: first, target: firstPosition, site: first.node },
      { source: second, target: secondPosition, site: second.node },
    ];
    const terms = createSourceTypeFlowTerms(current.ast, current.graph(entries, links));
    assert.equal(terms.group(first).variable === terms.group(firstPosition).variable, false);
    assert.equal(terms.group(second).variable === terms.group(secondPosition).variable, false);
    assert.equal(terms.group(first).variable === terms.group(second).variable, false);
    assert.equal(terms.isInference(first), true);
    for (const variable of [container, firstPosition, secondPosition, second]) {
      assert.equal(terms.isInference(variable), false);
    }
    assert.equal(terms.group(container).terms[0] === term, true);
    const open = createSourceTypeFlowTerms(current.ast, current.graph([
      { ...entries[0]!, kind: "open-local" }, ...entries.slice(1),
    ], links));
    assert.equal(open.group(first).variable === open.group(firstPosition).variable, true);
    assert.equal(open.group(second).variable === open.group(secondPosition).variable, true);
    assert.equal(open.isInference(container), true);
  });
}

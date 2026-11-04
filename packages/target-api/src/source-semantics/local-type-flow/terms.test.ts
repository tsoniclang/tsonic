import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, type Node } from "@tsonic/tsts";
import { createSourceTypeFlowTerms, freezeSourceTypeDescriptor, sourceTypeDescriptorDepth, sourceTypeDescriptorsEqual } from "./terms.js";
import type { SourceTypeDescriptor, SourceTypeFlowGraph, SourceTypeFlowNode, SourceTypeFlowTerm, SourceTypeFlowVariable } from "./types.js";

function fixture() {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/index.ts": "function run() { const first = 1; const second = 2; const third = 3; } class Left {} class Right {}",
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
  return { nodes, variable, entry, graph };
}

test("canonical variable paths use original nodes and structural positions", () => {
  const current = fixture();
  const first = { node: current.nodes[0]!, path: [{ kind: "member", name: "value" }] as const };
  const same = { node: current.nodes[0]!, path: [{ kind: "member", name: "value" }] as const };
  const other = { node: current.nodes[1]!, path: [{ kind: "member", name: "value" }] as const };
  const terms = createSourceTypeFlowTerms(current.graph([current.entry(first), current.entry(other)]));
  assert.equal(terms.group(first).variable === terms.group(same).variable, true);
  assert.equal(terms.group(first).variable === terms.group(other).variable, false);
});

test("array aliases unify their exact element positions", () => {
  const current = fixture(); const first = current.variable(0); const second = current.variable(1);
  const firstElement: SourceTypeFlowVariable = { node: first.node, path: [{ kind: "element" }] };
  const secondElement: SourceTypeFlowVariable = { node: second.node, path: [{ kind: "element" }] };
  const terms = createSourceTypeFlowTerms(current.graph([
    current.entry(first, { kind: "array", site: first.node, readonly: false, element: firstElement }),
    current.entry(second, { kind: "array", site: second.node, readonly: false, element: secondElement }),
  ], [{ source: first, target: second, site: second.node }]));
  assert.equal(terms.group(firstElement).variable === terms.group(secondElement).variable, true);
  assert.equal(terms.group(first).refusals.length, 0);
});

test("occurs checks refuse self-containment without a second type answer", () => {
  const current = fixture(); const first = current.variable(0); const second = current.variable(1);
  const terms = createSourceTypeFlowTerms(current.graph([
    current.entry(first, { kind: "array", site: first.node, readonly: false, element: second }), current.entry(second),
  ], [{ source: first, target: second, site: second.node }]));
  assert.equal(terms.group(first).refusals[0]?.code, "TSONIC_LOCAL_TYPE_SELF_REFERENCE");
  assert.equal(terms.group(first).variable === terms.group(second).variable, false);
});

test("incompatible structures refuse at the actual later link", () => {
  const current = fixture(); const first = current.variable(0); const second = current.variable(1); const element = current.variable(2);
  const terms = createSourceTypeFlowTerms(current.graph([
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
  const terms = createSourceTypeFlowTerms(current.graph([
    current.entry(first, { kind: "tuple", site: first.node, readonly: true, elements: [left, right] }),
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

test("term depth and declared optional descriptors use the same bounded algebra", () => {
  let type: SourceTypeDescriptor = { kind: "primitive", primitive: "int32" };
  for (let depth = 0; depth < 4; depth += 1) type = { kind: "array", readonly: false, element: type };
  assert.equal(sourceTypeDescriptorDepth(type), 4);
  assert.equal(sourceTypeDescriptorDepth({ kind: "optional", value: type }), 5);
  assert.equal(sourceTypeDescriptorsEqual({ kind: "optional", value: type }, type), false);
});

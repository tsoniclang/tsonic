import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, type Node } from "@tsonic/tsts";
import { createSourceTypeFlowTerms } from "./term-groups.js";
import type { SourceTypeFlowGraph, SourceTypeFlowNode, SourceTypeFlowTerm, SourceTypeFlowVariable } from "./types.js";

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
    roots: [file], nodes: values, links, producerInputs: [], derived: [], calls: [], refusals: [],
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

test("G4 original producer dependencies activate only their consumers without copying terms or uniting owners", () => {
  const current = fixture();
  const producer = current.variable(0), consumer = current.variable(1), unrelated = current.variable(2);
  const original: SourceTypeFlowTerm = { kind: "numeric", site: producer.node, form: "integer",
    literal: { form: "numeric", integer: 1n, numeric: { kind: "checked-float64", value: 1 } } };
  const graph = current.graph([
    { ...current.entry(producer, original), kind: "open-local" }, current.entry(consumer), current.entry(unrelated),
  ]);
  const terms = createSourceTypeFlowTerms(current.ast, { ...graph,
    producerInputs: [{ purpose: "inference", source: producer, target: consumer, site: consumer.node }],
  });
  assert.equal(terms.group(producer).variable === terms.group(consumer).variable, false);
  assert.equal(terms.group(producer).terms.length, 1);
  assert.equal(terms.group(producer).terms[0] === original, true);
  assert.equal(terms.group(consumer).terms.length, 0);
  assert.equal(terms.isInference(producer), true);
  assert.equal(terms.isInference(consumer), true);
  assert.equal(terms.isInference(unrelated), false);
  const opposite = createSourceTypeFlowTerms(current.ast, { ...graph,
    nodes: [current.entry(producer, original), { ...current.entry(consumer), kind: "open-local" }, current.entry(unrelated)],
    producerInputs: [{ purpose: "inference", source: producer, target: consumer, site: consumer.node }],
  });
  assert.equal(opposite.isInference(consumer), true);
  assert.equal(opposite.isInference(producer), false);
});

test("conditional control dependencies do not open either value branch or merge their principals", () => {
  const current = fixture();
  const control = current.variable(0), value = current.variable(1), result = current.variable(2);
  const graph = current.graph([
    { ...current.entry(control), kind: "open-local" }, current.entry(value), current.entry(result),
  ]);
  const terms = createSourceTypeFlowTerms(current.ast, { ...graph,
    derived: [{ node: result.node, result, operator: "conditional", control, operands: [value, value], required: true }],
  });
  assert.equal(terms.isInference(control), true);
  assert.equal(terms.isInference(value), false);
  assert.equal(terms.isInference(result), false);
  assert.equal(terms.group(control).variable === terms.group(result).variable, false);
});

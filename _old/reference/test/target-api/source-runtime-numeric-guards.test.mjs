import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles } from "@tsonic/tsts";
import { sourceFlowOwnerFixture } from "../host/fixtures/source-flow-owner.mjs";
import { produceSourceGuardPredicate } from "../../packages/target-api/dist/source-semantics/local-type-flow/guard-predicates.js";
import { produceSourceComponentLiteralDomain } from "../../packages/target-api/dist/source-semantics/local-type-flow/literal-domains.js";
import { sourceLiteralUnitsEqual } from "../../packages/target-api/dist/source-model/literals/domain.js";

test("runtime numeric guards do not use distinct exact authored rationals as a float inequality proof", () => {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/index.ts": "const first: number = 0.10000000000000001; const second: number = 0.1; const exact: number = 0.5; const other: number = 0.25;",
  }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length, 0);
  const { flow } = sourceFlowOwnerFixture({ checked, apiFacts: undefined, profileFiles: [], safetyProviders: [] });
  const { context } = flow, { ast, input, descriptorBuilder: builder } = context.source;
  const declarations = context.nodes.filter(node => ast.is.IsVariableDeclaration(node));
  assert.equal(declarations.length === 4 && declarations.every((node, index) =>
    ast.text(ast.name(node)) === ["first", "second", "exact", "other"][index]), true,
  "the complete original scalar domain and declaration order precede every assertion");
  const operands = declarations.map(node => ast.as.AsVariableDeclaration(node).Initializer);
  assert.equal(operands.every(node => node !== undefined), true);
  const values = operands.map(node => context.value(node, []));
  assert.equal(values.every(value => value.kind === "resolved" && value.value.type.kind === "primitive" &&
    value.value.type.primitive === "float64"), true);
  const domains = values.map(value => builder.domain(value.value));
  assert.equal(domains.every(domain => domain.kind === "finite" && domain.values.length === 1), true);
  assert.equal(sourceLiteralUnitsEqual(domains[0].values[0], domains[1].values[0]), false,
    "original rational identity remains exact for key/domain provenance");
  const owner = { builder, syntaxDomain: node => produceSourceComponentLiteralDomain({ ast, input, builder,
    value: context.value, component: context.place }, input.syntax(node), []) };
  const compare = (left, right, negated = false) => produceSourceGuardPredicate(owner, values[left].value,
    { kind: "literal", sourceOperand: operands[left], literal: operands[right], category: "number", negated });
  const rounded = compare(0, 1), opposite = compare(0, 1, true);
  assert.equal(rounded.kind === "resolved" && rounded.value === undefined &&
    opposite.kind === "resolved" && opposite.value === undefined, true,
  "without an exact selected-runtime-value proof neither equality direction prunes a rounded value");
  const same = compare(2, 2), different = compare(2, 3);
  assert.equal(same.kind === "resolved" && same.value === true && different.kind === "resolved" && different.value === false, true,
    "exactly represented binary values retain their runtime equality proof");
});

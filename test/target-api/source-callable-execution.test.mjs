import assert from "node:assert/strict";
import test from "node:test";
import { sourceTypeFlowFixture } from "./fixtures/source-type-flow-fixture.mjs";

function resolved(result, label) {
  assert.equal(result.kind, "resolved", result.kind === "refused" ? `${label}: ${result.message}` : label);
  return result.value;
}

function functionDomain(current, name) {
  const { source, nodes } = current;
  return nodes.filter(node => source.ast.is.IsFunctionDeclaration(node) && source.ast.text(source.ast.name(node)) === name);
}

test("callable execution retains the full advertised vector and the distinct original API body boundary", () => {
  const current = sourceTypeFlowFixture(`
    function run(value: int32): int32;
    function run(value: string): string;
    function run(value: any): any { return value; }
    const input: int32 = 1;
    const integerResult = run(input);
    const stringResult = run("word");
  `);
  const { source, nodes } = current;
  const declarations = functionDomain(current, "run");
  assert.equal(declarations.length === 3 && declarations.every((node, index) =>
    (source.ast.body(node) !== undefined) === (index === 2)), true,
  "the complete two-contract and one-body original domain precedes every assertion");
  const calls = nodes.filter(node => source.ast.is.IsCallExpression(node));
  assert.equal(calls.length, 2);
  for (const [index, call] of calls.entries()) {
    const application = resolved(source.facts.applications.application(call), "original overload application");
    assert.equal(application.identity.invocation === call && application.identity.signature.declaration === declarations[index], true);
    assert.equal(application.execution.kind, "present");
    const execution = application.execution.value;
    assert.equal(execution.contracts.length === 2 && execution.contracts.every((contract, position) =>
      contract.advertised.signature.declaration === declarations[position]), true,
    "the complete advertised overload vector is retained, never the first or selected overload alone");
    assert.equal(execution.results.length === 1 && execution.results[0].signature === application.identity.signature, true);
    assert.equal(execution.results[0].embedding.destination === application.result, true);
    for (const contract of execution.contracts) {
      assert.equal(contract.implementation.kind, "present");
      const implementation = contract.implementation.value;
      assert.equal(implementation.body.declaration === declarations[2] &&
        implementation.body.body === source.ast.body(declarations[2]) &&
        implementation.applied.signature.declaration === declarations[2] &&
        implementation.applied.signature !== contract.advertised.signature, true);
      assert.equal(implementation.body.parameters.length === 1 && implementation.parameters.length === 1, true);
      const bodyResult = resolved(source.facts.descriptors.component(implementation.applied.head,
        { kind: "result", signature: implementation.applied.signature }), "registered original body result");
      assert.equal(bodyResult.type.kind === "intrinsic" && bodyResult.type.intrinsic === "any", true,
        "the implementation's any result is not specialized to an advertised endpoint");
      assert.equal(implementation.result.kind === "declared-overload" &&
        implementation.result.contractDeclaration === contract.advertised.signature.declaration &&
        implementation.result.bodyDeclaration === declarations[2] && implementation.result.source === bodyResult, true);
      const advertisedResult = resolved(source.facts.descriptors.component(contract.advertised.head,
        { kind: "result", signature: contract.advertised.signature }), "registered advertised result");
      assert.equal(implementation.result.destination === advertisedResult && advertisedResult !== bodyResult, true);
    }
  }
});

test("API body result-only binders are solved from original contract equations, not advertised binder ordinals", () => {
  const current = sourceTypeFlowFixture(`
    function run(value: int32): int32;
    function run(value: string): string;
    function run<Output>(value: any): Output { return value; }
    const input: int32 = 1;
    const integerResult = run(input);
    const stringResult = run("word");
  `);
  const { source, nodes } = current;
  const declarations = functionDomain(current, "run");
  assert.equal(declarations.length, 3);
  const binders = source.ast.typeParameters(declarations[2]);
  assert.equal(binders.length === 1 && source.ast.text(source.ast.name(binders[0])) === "Output", true);
  const calls = nodes.filter(node => source.ast.is.IsCallExpression(node));
  assert.equal(calls.length, 2);
  for (const call of calls) {
    const application = resolved(source.facts.applications.application(call), "result-only binder application");
    assert.equal(application.execution.kind === "present" && application.execution.value.contracts.length === 2, true);
    for (const contract of application.execution.value.contracts) {
      assert.equal(contract.advertised.signatureBindings.length, 0,
        "neither original advertised signature has a generic binder to copy by ordinal");
      assert.equal(contract.implementation.kind, "present");
      const implementation = contract.implementation.value;
      assert.equal(implementation.applied.signatureBindings.length === 1 &&
        implementation.applied.signatureBindings[0].declaration === binders[0], true);
      const advertisedResult = resolved(source.facts.descriptors.component(contract.advertised.head,
        { kind: "result", signature: contract.advertised.signature }), "original result constraint");
      const appliedResult = resolved(source.facts.descriptors.component(implementation.applied.head,
        { kind: "result", signature: implementation.applied.signature }), "substituted API result");
      assert.equal(implementation.applied.signatureBindings[0].value.type === advertisedResult.type &&
        appliedResult.type === advertisedResult.type, true);
      assert.equal(Object.isFrozen(implementation.applied.signatureBindings) &&
        implementation.applied.signatureBindings.every(Object.isFrozen), true);
    }
  }
});

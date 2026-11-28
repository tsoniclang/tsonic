import assert from "node:assert/strict";
import { checkReachedProofCuts } from "./dataflow-cuts.mjs";

export async function checkLiteralFieldCall() {
  const { loadFrontFixture } = await import("./front/checked-module.mjs");
  const { analysisInput } = await import("./front/analysis-input.mjs");
  const { captureSourceBarrier } = await import("../../../packages/host/dist/pipeline/source-barrier.js");
  const { analyzeHostProgram } = await import("../../../packages/host/dist/pipeline/index.js");
  const { checkedReferenceArgumentViewOf } = await import("../../../packages/host/dist/ir-hir/index.js");
  const { readSignature, readType } = await import("../../../packages/host/dist/ir-types/index.js");
  const { accountFailure, chargeResultEntries, chargeWork, createAccount } = await import("../../../packages/host/dist/dataflow/index.js");
  const { InvocationAccount } = await import("../../../packages/host/dist/dataflow/account.js");
  const input = analysisInput(await loadFrontFixture(), "sdk-minimal", `
    function choose(input: { "literal-field": boolean; sibling: boolean }): boolean {
      const { "literal\\u002dfield": selected } = input;
      return !selected;
    }
    export function read(actual: { sibling: boolean; "literal-field": boolean }): boolean {
      return choose(actual);
    }
  `);
  const checked = captureSourceBarrier(input);
  assert.equal(checked.kind, "ok", JSON.stringify(checked.diagnostics));
  const module = checked.value.modules.find(row => row.module.module === input.snapshot.entryPoint).module;
  const [formal, caller] = module.tree.statements.nodes;
  const fieldOf = (callable, name) => callable.parameters.nodes[0].type.members.nodes
    .find(member => member.name.text === name).name.tsonic.declaration.definition;
  const calleeField = fieldOf(formal, "literal-field");
  const callerField = fieldOf(caller, "literal-field");
  assert.notEqual(calleeField, callerField);
  const fields = [[callerField, calleeField, null], [fieldOf(caller, "sibling"), fieldOf(formal, "sibling"), null]];
  const { checked: source, types } = checked.value;
  const body = source.bodies.get(caller.tsonic.body);
  const argumentNode = body.root.statements.nodes[0].expression.arguments.nodes[0];
  const endpoint = formal.tsonic.signatures.find(row => row.role === "api-body");
  const site = { body, argument: { body: body.body, node: argumentNode.id }, caller: argumentNode.tsonic.value.views.read.value,
    endpoint, ordinal: 0, formal: readSignature(types, endpoint.signature).parameters[0] };
  const qualify = (account, crossed = false) => {
    const result = checkedReferenceArgumentViewOf(site, {
      bodyOf: id => source.bodies.get(id) ?? null, nodeOf: source.nodeOf,
      itemOf: id => {
        const reference = source.declarationSourceOf(crossed && id === callerField ? calleeField : id);
        return reference === null ? null : source.nodeOf(reference);
      },
      typeOf: type => readType(types, type),
      admit: (work, entries) => (chargeWork(account, work) ?? chargeResultEntries(account, entries)) === null,
    });
    return accountFailure(account) ?? { kind: "complete", value: result?.fields.map(field => [field.caller, field.formal, field.parent]) ?? null };
  };
  checkReachedProofCuts(InvocationAccount.stateOf, qualify, fields, "literal field call correspondence");
  assert.deepEqual(qualify(createAccount(input.limits.dataflow), true), { kind: "complete", value: null });

  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const chapter = result.value.modules.find(row => row.module === input.snapshot.entryPoint);
  const selected = chapter.bodies.find(row => row.kind === "selected" && row.instance.body === caller.tsonic.body);
  const call = selected.mir.blocks.find(row => row.terminator.kind === "call").terminator;
  const binding = call.callee.resolution.decision.parameters[0];
  assert.equal(binding.kind, "reference-argument");
  assert.equal(binding.passing, "by-value");
  assert.deepEqual(binding.view.fields.map(field => [field.caller, field.formal, field.parent]), fields);
  assert.equal(call.arguments[0].operand.kind, "place");

  const [facts] = selected.facts;
  const invoke = facts.origins.invocations.find(row => row.node === call.tir.node);
  const [argument] = invoke.alternatives[0].arguments;
  assert.deepEqual([argument.authoredIndex, argument.parameterIndex, argument.passing, argument.projection], [0, 0, "by-value", null]);
  const callerSummary = result.value.index.summaries.find(row => row.key.kind === "body" && row.key.execution.instance.body === caller.tsonic.body);
  const reads = callerSummary.parameters[0].reads;
  assert.equal(reads.kind, "complete");
  assert.deepEqual(reads.paths.map(path => callerSummary.arena.projections[path].projection.member.decision.primary), [callerField]);
}

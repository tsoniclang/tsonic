import assert from "node:assert/strict";
import { checkReachedProofCuts } from "./dataflow-cuts.mjs";

export async function checkActualBodyRoundCuts(produce, selected) {
  const { pipelineWiring } = await import("../../../packages/host/dist/pipeline/wiring.js");
  const { printFacts, printSummary } = await import("../../../packages/host/dist/ir-facts/index.js");
  const { InvocationAccount } = await import("../../../packages/host/dist/dataflow/account.js");
  const { executionKey } = await import("../../../packages/host/dist/ir-types/index.js");
  const analyze = pipelineWiring.bodyAnalysis.analyzeBodyRound;
  const actual = new Map();
  try {
    pipelineWiring.bodyAnalysis.analyzeBodyRound = (deps, input) => {
      const result = analyze(deps, input);
      if (selected(input) && result.kind === "complete" && result.value.kind === "ok" && "facts" in result.value.value) {
        actual.set(executionKey(input.execution), { deps, input, pair: result.value.value });
      }
      return result;
    };
    await produce();
  } finally {
    pipelineWiring.bodyAnalysis.analyzeBodyRound = analyze;
  }
  assert.ok(actual.size > 0);
  for (const [key, { deps, input, pair }] of actual) {
    const facts = printFacts(pair.facts);
    const summary = printSummary(pair.summary);
    const run = account => {
      const result = analyze({ ...deps, account }, input);
      if (result.kind !== "complete") return result;
      assert.equal(result.value.kind === "ok" && "facts" in result.value.value, true, key);
      const replayed = result.value.value;
      return { kind: "complete", value: printFacts(replayed.facts) === facts && printSummary(replayed.summary) === summary };
    };
    checkReachedProofCuts(InvocationAccount.stateOf, run, true, key);
  }
  return [...actual.values()].map(({ input }) => [input.tir.root.kind, input.execution.provided]);
}

import assert from "node:assert/strict";
import test from "node:test";
import {
  failTargetAnalysisInvariant,
  failTargetPlannerInvariant,
  resolvedTargetStage,
  runTargetCompilationStages,
} from "@tsonic/target-api/artifacts";

export function registerTargetPlannerInvariantContractTests(target, failInvariant) {
  test("the local invariant helper preserves the shared failure and exact optional source identity", () => {
    const sourceNode = Object.freeze({ identity: "checked-source-node" });
    for (const node of [undefined, sourceNode]) {
      const message = "The selected planner state is incomplete: π.";
      const actual = captureFailure(() => failInvariant(message, node));
      const shared = captureFailure(() => failTargetPlannerInvariant(target, message, node));
      assert.equal(actual instanceof Error, true);
      assert.equal(actual.constructor === shared.constructor, true, "one shared failure transport is retained");
      assert.equal(actual.phase, "planning");
      assert.equal(actual.message, message);
      assert.equal(actual.diagnostic.code, "TSONIC_INTERNAL_PLANNER_INVARIANT");
      assert.equal(actual.diagnostic.category, "error");
      assert.equal(actual.diagnostic.source, target);
      assert.equal(actual.diagnostic.message, message);
      assert.equal(actual.diagnostic.sourceNode === node, true, "the original optional source node is retained");
      assert.equal(Object.isFrozen(actual.diagnostic), true);
    }
  });

  test("the shared planning boundary catches the local invariant and preserves preceding warnings", () => {
    const program = Object.freeze({ identity: "analyzed-program" });
    const node = Object.freeze({ identity: "checked-source-node" });
    const warning = Object.freeze({ code: "ANALYSIS_WARNING", category: "warning", message: "An earlier warning." });
    const events = [];
    let materializations = 0;
    const result = runTargetCompilationStages({
      analyze() {
        events.push("analysis");
        return resolvedTargetStage(program, [warning]);
      },
      plan(received) {
        events.push("planning");
        assert.equal(received === program, true);
        return failInvariant("A completed selection is absent.", node);
      },
      materialize() {
        materializations++;
        assert.fail("A planner invariant must not materialize artifacts.");
      },
    }, {
      analyzed(received) {
        events.push("observed-analysis");
        assert.equal(received === program, true);
      },
      planned() {
        assert.fail("A failed plan must not be observed as complete.");
      },
    });
    assert.equal(result.kind, "rejected");
    assert.equal(Object.hasOwn(result, "value"), false);
    assert.deepEqual(events, ["analysis", "observed-analysis", "planning"]);
    assert.equal(materializations, 0);
    assert.equal(result.diagnostics.length, 2);
    assert.equal(result.diagnostics[0] === warning, true);
    assert.equal(result.diagnostics[1].code, "TSONIC_INTERNAL_PLANNER_INVARIANT");
    assert.equal(result.diagnostics[1].source, target);
    assert.equal(result.diagnostics[1].sourceNode === node, true);
  });

  test("unknown failures and wrong-phase invariants are never relabelled as planner failures", () => {
    const failures = [
      { at: "planning", error: new Error("Unknown planning failure.") },
      { at: "planning", error: captureFailure(() => failTargetAnalysisInvariant(target, "Analysis-only failure.")) },
      { at: "analysis", error: captureFailure(() => failInvariant("Planning-only failure.")) },
    ];
    for (const current of failures) {
      let materializations = 0;
      assert.throws(() => runTargetCompilationStages({
        analyze() {
          if (current.at === "analysis") throw current.error;
          return resolvedTargetStage(Object.freeze({ identity: "program" }));
        },
        plan() {
          throw current.error;
        },
        materialize() {
          materializations++;
          assert.fail("An escaping exception must not materialize artifacts.");
        },
      }), error => error === current.error);
      assert.equal(materializations, 0);
    }
  });

}

function captureFailure(operation) {
  try {
    operation();
  } catch (failure) {
    return failure;
  }
  assert.fail("The invariant helper must throw.");
}

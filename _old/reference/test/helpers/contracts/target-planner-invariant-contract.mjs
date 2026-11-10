import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  failTargetAnalysisInvariant,
  failTargetPlannerInvariant,
  resolvedTargetStage,
  runTargetCompilationStages,
} from "@tsonic/target-api/artifacts";

export function registerTargetPlannerInvariantContractTests(target, failInvariant, backendDirectory) {
  test("the local invariant helper preserves the shared failure and exact optional source identity", () => {
    const sourceNode = Object.freeze({ identity: "checked-source-node" });
    for (const node of [undefined, sourceNode]) {
      const message = "The selected planner state is incomplete: π.";
      const actual = captureFailure(() => failInvariant(message, node));
      const shared = captureFailure(() => failTargetPlannerInvariant(target, message, node));
      assert.equal(actual instanceof Error, true, "the local failure is an Error");
      assert.equal(actual.constructor === shared.constructor, true, "one shared failure transport is retained");
      assert.equal(actual.phase, "planning");
      assert.equal(actual.message, message);
      assert.equal(actual.diagnostic.code, "TSONIC_INTERNAL_PLANNER_INVARIANT");
      assert.equal(actual.diagnostic.category, "error");
      assert.equal(actual.diagnostic.source, target);
      assert.equal(actual.diagnostic.message, message);
      assert.equal(actual.diagnostic.sourceNode === node, true, "the original optional source node is retained");
      assert.equal(Object.isFrozen(actual.diagnostic), true, "the shared diagnostic is immutable");
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
        assert.equal(received === program, true, "planning receives the identical analyzed program");
        return failInvariant("A completed selection is absent.", node);
      },
      materialize() {
        materializations++;
        assert.fail("A planner invariant must not materialize artifacts.");
      },
    }, {
      analyzed(received) {
        events.push("observed-analysis");
        assert.equal(received === program, true, "the observer receives the identical analyzed program");
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
    assert.equal(result.diagnostics[0] === warning, true, "the preceding warning retains its identity");
    assert.equal(result.diagnostics[1].code, "TSONIC_INTERNAL_PLANNER_INVARIANT");
    assert.equal(result.diagnostics[1].source, target);
    assert.equal(result.diagnostics[1].sourceNode === node, true, "the failure retains its exact source identity");
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

  const root = fileURLToPath(backendDirectory);
  const files = readdirSync(root, { recursive: true }).filter(path => path.endsWith(".ts"))
    .map(path => ({ path: path.replaceAll("\\", "/"), text: readFileSync(join(root, path), "utf8") }));
  test(`${target} backend routes shared planner failures only through its canonical local owner`, () => {
    assert.equal(files.length > 0, true, "the guard scans actual backend files");
    const owner = files.find(file => file.path === "planner/diagnostics.ts");
    assert.equal(owner !== undefined && /\bfailTargetPlannerInvariant\s*\(/u.test(owner.text), true,
      "the canonical local owner delegates to the shared transport");
    assertCanonicalInvariantRouting(files);
  });

  test(`${target} owner gate rejects a direct shared-helper call outside the local owner`, () => {
    const consumer = files.find(file => file.path !== "planner/diagnostics.ts");
    assert.equal(consumer !== undefined, true, "the negative control uses a real backend consumer");
    const changed = files.map(file => file !== consumer ? file : { ...file,
      text: file.text + `\nfailTargetPlannerInvariant(${JSON.stringify(target)}, "bypassed local owner");\n`,
    });
    assert.throws(() => assertCanonicalInvariantRouting(changed), error => error instanceof assert.AssertionError,
      "the same gate fails for the injected direct call");
  });
}

function assertCanonicalInvariantRouting(files) {
  const directConsumers = files.filter(file => file.path !== "planner/diagnostics.ts" &&
    /\bfailTargetPlannerInvariant\b/u.test(file.text)).map(file => file.path);
  assert.deepEqual(directConsumers, [], "only the canonical local backend owner may use the shared planner helper");
}

function captureFailure(operation) {
  try {
    operation();
  } catch (failure) {
    return failure;
  }
  assert.fail("The invariant helper must throw.");
}

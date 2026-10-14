import assert from "node:assert/strict";
import test from "node:test";
import {
  failTargetPlannerInvariant,
  rejectedTargetStage,
  resolvedTargetStage,
  runTargetCompilationStages,
} from "../../packages/target-api/dist/public/artifacts.js";
import { checkedSource, projectSourceFile } from "../fixtures/source-navigation.mjs";

const warning = Object.freeze({
  code: "TARGET_WARNING",
  category: "warning",
  message: "analysis retained a non-error diagnostic",
});
const error = Object.freeze({
  code: "TARGET_ERROR",
  category: "error",
  message: "planning rejected the program",
});

test("target stages preserve ordered diagnostics and materialize only a complete plan", () => {
  const events = [];
  const result = runTargetCompilationStages({
    analyze() {
      events.push("analyze");
      return resolvedTargetStage({ program: true }, [warning]);
    },
    plan(program) {
      events.push(`plan:${String(program.program)}`);
      return resolvedTargetStage({ plan: true });
    },
    materialize(plan) {
      events.push(`materialize:${String(plan.plan)}`);
      return {
        artifacts: [{ kind: "source", path: "src/main.rs", text: "fn main() {}\n" }],
      };
    },
  });

  assert.equal(result.kind, "resolved");
  assert.deepEqual(result.diagnostics, [warning]);
  assert.deepEqual(result.value.artifacts.map((artifact) => artifact.path), ["src/main.rs"]);
  assert.deepEqual(events, ["analyze", "plan:true", "materialize:true"]);
});

test("target stages short-circuit rejected analysis and planning without partial output", () => {
  const analysisEvents = [];
  const analysis = runTargetCompilationStages({
    analyze() {
      analysisEvents.push("analyze");
      return rejectedTargetStage([error]);
    },
    plan() {
      analysisEvents.push("plan");
      return resolvedTargetStage({});
    },
    materialize() {
      analysisEvents.push("materialize");
      return { artifacts: [] };
    },
  });
  assert.equal(analysis.kind, "rejected");
  assert.deepEqual(analysisEvents, ["analyze"]);

  const planningEvents = [];
  const planning = runTargetCompilationStages({
    analyze() {
      planningEvents.push("analyze");
      return resolvedTargetStage({}, [warning]);
    },
    plan() {
      planningEvents.push("plan");
      return rejectedTargetStage([error]);
    },
    materialize() {
      planningEvents.push("materialize");
      return { artifacts: [] };
    },
  });
  assert.equal(planning.kind, "rejected");
  assert.deepEqual(planning.diagnostics, [warning, error]);
  assert.deepEqual(planningEvents, ["analyze", "plan"]);
});

test("target stage constructors reject contradictory diagnostic categories", () => {
  assert.throws(
    () => resolvedTargetStage({}, [error]),
    /resolved target stage cannot contain an error diagnostic/u,
  );
  assert.throws(
    () => rejectedTargetStage([warning]),
    /rejected target stage must contain at least one error diagnostic/u,
  );
});

for (const source of ["tsonic-csharp", "tsonic-rust"]) {
  test(`${source} planner invariants retain exact source identity and reject without materializing`, async () => {
    const checked = await checkedSource(`planner-invariant-${source}`, {
      "src/index.ts": "export const value = 1;",
    });
    const selectedNode = projectSourceFile(checked, "src/index.ts");
    const message = "A sealed selection has no exact native reconstruction.";
    for (const sourceNode of [undefined, selectedNode]) {
      const events = [];
      const result = runTargetCompilationStages({
        analyze() {
          events.push("analyze");
          return resolvedTargetStage({ selected: true }, [warning]);
        },
        plan(program) {
          events.push("plan");
          assert.equal(program.selected, true);
          failTargetPlannerInvariant(source, message, sourceNode);
        },
        materialize() {
          assert.fail("An incomplete plan must not be materialized.");
        },
      });
      assert.equal(result.kind, "rejected");
      assert.equal(Object.hasOwn(result, "value"), false);
      assert.equal(Object.hasOwn(result, "artifacts"), false);
      assert.equal(result.diagnostics.length, 2);
      assert.equal(result.diagnostics[0] === warning, true);
      const diagnostic = result.diagnostics[1];
      assert.equal(diagnostic.code, "TSONIC_INTERNAL_PLANNER_INVARIANT");
      assert.equal(diagnostic.category, "error");
      assert.equal(diagnostic.source, source);
      assert.equal(diagnostic.message, message);
      assert.equal(diagnostic.sourceNode === sourceNode, true, "the exact optional AST node is retained");
      assert.equal(Object.isFrozen(result), true);
      assert.equal(Object.isFrozen(result.diagnostics), true);
      assert.equal(Object.isFrozen(diagnostic), true);
      assert.throws(() => { diagnostic.code = "SOURCE_REJECTION"; }, TypeError);
      assert.throws(() => { diagnostic.message = "changed"; }, TypeError);
      assert.deepEqual(events, ["analyze", "plan"]);
    }
  });

  for (const phase of ["analyze", "materialize"]) {
    test(`${source} planner invariant failures outside planning propagate unchanged from ${phase}`, () => {
      let failure;
      try {
        failTargetPlannerInvariant(source, "An invariant was raised in the wrong phase.");
      } catch (caught) {
        failure = caught;
      }
      assert.equal(failure instanceof Error, true);
      const events = [];
      assert.throws(() => runTargetCompilationStages({
        analyze() {
          events.push("analyze");
          if (phase === "analyze") throw failure;
          return resolvedTargetStage({});
        },
        plan() {
          events.push("plan");
          return resolvedTargetStage({});
        },
        materialize() {
          events.push("materialize");
          throw failure;
        },
      }), caught => caught === failure);
      assert.deepEqual(events, phase === "analyze" ? ["analyze"] : ["analyze", "plan", "materialize"]);
    });
  }
}

for (const phase of ["analyze", "plan", "materialize"]) {
  test(`target stages do not disguise ordinary or lookalike failures from ${phase}`, () => {
    const diagnostic = Object.freeze({ code: "TSONIC_INTERNAL_PLANNER_INVARIANT", category: "error",
      source: "another-owner", message: "A structural lookalike is not the private failure type." });
    const failures = [new Error("ordinary failure"), "a non-error failure",
      Object.assign(new Error(diagnostic.message), { name: "TargetPlannerInvariantFailure", diagnostic }),
      Object.freeze({ diagnostic })];
    for (const failure of failures) {
      const events = [];
      assert.throws(() => runTargetCompilationStages({
        analyze() {
          events.push("analyze");
          if (phase === "analyze") throw failure;
          return resolvedTargetStage({});
        },
        plan() {
          events.push("plan");
          if (phase === "plan") throw failure;
          return resolvedTargetStage({});
        },
        materialize() {
          events.push("materialize");
          throw failure;
        },
      }), caught => caught === failure);
      assert.deepEqual(events, phase === "analyze" ? ["analyze"]
        : phase === "plan" ? ["analyze", "plan"] : ["analyze", "plan", "materialize"]);
    }
  });
}

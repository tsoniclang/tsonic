import assert from "node:assert/strict";
import test from "node:test";
import {
  rejectedTargetStage,
  resolvedTargetStage,
  runTargetCompilationStages,
} from "../../packages/target-api/dist/public/artifacts.js";

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

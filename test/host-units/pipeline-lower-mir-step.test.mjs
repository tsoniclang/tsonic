// Cases of Pipeline's lower-mir step (packages/host/src/pipeline/lower-mir-step.ts): the deps of `lowerToMir` and the
// context of the MIR verifier, built from the run's data (COMPONENTS §7 part 1; §12 part 1.5, the lowered-body
// barrier). The inputs are written by hand against the contracts; the composed case, with the typed body of `add` as
// Elaborate publishes it, waits for that output (W4-3 section 8.1).
import assert from "node:assert/strict";
import { readFileSync, realpathSync } from "node:fs";
import { Session } from "node:inspector";
import { basename, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { after, before, test } from "node:test";
import { checkCoverage } from "../architecture/host/coverage.mjs";
import { parseSources } from "../architecture/host/import-graph.mjs";
import { T, TABLE, verificationContext } from "./fixtures/lower-mir/typed.mjs";
import { EXECUTIONS, add, plus } from "./fixtures/lower-mir/programs/first.mjs";

const repository = fileURLToPath(new URL("../../", import.meta.url));
const runtimeFile = resolve(repository, "packages/host/dist/pipeline/lower-mir-step.js");
const session = new Session();
const post = (method, parameters = {}) => new Promise((done, reject) => {
  session.post(method, parameters, (error, result) => error === null ? done(result) : reject(error));
});
let step;
let wiring;
let verifyMir;
let types;

before(async () => {
  assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined, true, "pipeline step cases require a guarded admission");
  session.connect();
  await post("Debugger.enable");
  await post("Profiler.enable");
  await post("Profiler.startPreciseCoverage", { callCount: true, detailed: true });
  step = await import("../../packages/host/dist/pipeline/lower-mir-step.js");
  ({ pipelineWiring: wiring } = await import("../../packages/host/dist/pipeline/wiring.js"));
  ({ verifyMir } = await import("../../packages/host/dist/ir-mir/index.js"));
  types = await import("../../packages/host/dist/ir-types/index.js");
});

after(async () => {
  try {
    const capture = await post("Profiler.takePreciseCoverage");
    const url = pathToFileURL(runtimeFile).href;
    const result = capture.result.filter(script => script.url === url);
    const sources = [];
    for (const script of result) {
      const actual = await post("Debugger.getScriptSource", { scriptId: script.scriptId });
      sources.push({ scriptId: script.scriptId, url: script.url, text: actual.scriptSource });
    }
    await post("Profiler.stopPreciseCoverage");
    const report = checkCoverage({ canonical: realpathSync, readText: path => readFileSync(path, "utf8"), parse: parseSources,
      project: (scriptUrl, text) => ({ path: fileURLToPath(scriptUrl), text }) }, [runtimeFile], [{ ...capture, result, sources }]);
    assert.equal(result.length, 1, "the step has source-identified coverage evidence");
    assert.equal(report.status, "passed", JSON.stringify(report.findings).slice(0, 6000));
    for (const file of report.files) {
      assert.equal(file.lines, 100, basename(file.path));
      assert.equal(file.branches, 100, basename(file.path));
      assert.equal(file.functions, 100, basename(file.path));
    }
  } finally { session.disconnect(); }
});

/** A run as Pipeline holds it at the typed-body barrier, for the hand-built table of the lowering fixtures. */
const runFor = program => {
  const interner = types.seedTypeInterner(TABLE);
  const declared = verificationContext(program);
  return { interner, table: TABLE, defs: { completionSelector: T.int32, exceptionStorage: T.unknown }, lowering: { maximumRecords: 1000 },
    verification: { maximumWork: 100000 }, declarationOf: declared.declarationOf, bodyOwner: declared.bodyOwner };
};

test("the deps of lowerToMir are the run's type and signature views, its canonical types and its size limit", () => {
  const program = add("step.add.deps", T.float64, plus("float64", T.float64));
  const run = runFor(program);
  const deps = step.lowerMirDeps(run);
  assert.equal(deps.defs, run.defs);
  assert.equal(deps.limits, run.lowering);
  assert.deepEqual(deps.typeOf(T.float64), types.readType(run.interner, T.float64));
  assert.deepEqual(deps.signatureOf(program.tir.signature), types.readSignature(run.interner, program.tir.signature));
  assert.deepEqual(deps.signatureOf(program.tir.signature).parameters.map(parameter => [parameter.kind, parameter.passing, parameter.type]),
    [["required", "by-value", T.float64], ["required", "by-value", T.float64]]);
});

test("the verifier's context is the run's limit, the typed body, the run's table and its declarations", () => {
  const program = add("step.add.context", T.float64, plus("float64", T.float64));
  const run = runFor(program);
  const context = step.mirVerificationContext(run, program.tir);
  assert.deepEqual(Object.keys(context).sort(), ["bodyOwner", "declarationOf", "limits", "source", "types"]);
  assert.equal(context.limits, run.verification);
  assert.equal(context.source, program.tir);
  assert.equal(context.types, run.table);
  assert.equal(context.declarationOf, run.declarationOf);
  assert.equal(context.bodyOwner, run.bodyOwner);
});

test("through the wiring: the typed body of add is lowered with the step's deps and its graph is verified in the step's context", () => {
  for (const execution of ["pure", "unwinds"]) {
    const program = add(`step.add.${execution}`, T.float64, plus("float64", T.float64, EXECUTIONS[execution]));
    const run = runFor(program);
    const lowered = wiring.lowerMir.lowerToMir(step.lowerMirDeps(run), program.tir, []);
    assert.equal(lowered.kind, "ok");
    assert.deepEqual(lowered.diagnostics, []);
    assert.deepEqual(verifyMir(lowered.value, step.mirVerificationContext(run, program.tir)), { kind: "complete", violations: [] });
    // The size limit is the run's: below the graph's nine records the step's deps refuse it.
    assert.equal(wiring.lowerMir.lowerToMir(step.lowerMirDeps({ ...run, lowering: { maximumRecords: 8 } }), program.tir, []).kind, "refused");
    // The verification limit is the run's: under a limit of zero the graph is refused for resources, not judged.
    assert.equal(verifyMir(lowered.value, step.mirVerificationContext({ ...run, verification: { maximumWork: 0 } }, program.tir)).kind, "resource-limit");
  }
});

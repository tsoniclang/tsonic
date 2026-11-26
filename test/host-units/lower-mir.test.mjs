// Unit bank of lower-mir. Every expectation is taken from the signed specification
// (/shared/tsonic-stage3/spec: low/COMPONENTS.md section 7, low/COMMON-DATA.md, inputs/WALKTHROUGH-PROGRAMS.md)
// and from the program text, and is stated beside the assertion. Inputs are complete typed bodies
// written by hand in fixtures/lower-mir/programs; no expectation is derived from an implementation.
import { admitFixtureTable } from "./fixtures/types-construction.mjs";
import assert from "node:assert/strict";
import { readFileSync, realpathSync } from "node:fs";
import { Session } from "node:inspector";
import { basename, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { after, before, test as declare } from "node:test";
import { checkCoverage } from "../architecture/host/coverage.mjs";
import { parseSources } from "../architecture/host/import-graph.mjs";
import { ARRAY_STEP, EMPTY_BINDINGS, MODULE, PARAMETRIC, SELECTED_BINDINGS, SIG, T, TABLE, bodyId, builders, callee, declareType, def, defaultMapping, direct, mapped, native, nativeIndex, omittedMapping, seal, selected, selection, signature, typedBody, typedOperation, value, verificationContext } from "./fixtures/lower-mir/typed.mjs";
import {
  argumentConstantOf, argumentKindsOf, at, blocksWithStatementAt, calleeNameOf, capturedLocalsOf, capturedRootsOf, checkedPlace, checks,
  controlPoints, createsClosure, destinationBaseOf, destinationChainOf, destinationFieldOf, destinationRootOf, edgesOf, effects,
  effectsOn, entriesInto, fieldKeyOf, internalCallsOn, invert, isCall, isCompletionBranch, isInternalCall, markersOf, namesStep, nodesOn,
  operandPlacesOf, operationKindOf, operationName, providedCountsOf, readsField, readsLocal, readsPlace, receiverRootOf, recordsOf, rootLocalOf,
  storedChainLengthOf, storedRootOf, storesField, storesPlace, valueKindOf, walk, withoutFailureKinds, writesOf,
} from "./fixtures/lower-mir/observe.mjs";
import { ACTIVATION, GENERATOR_STEP, activationOf, deep, excluded, firstZero, handles, quotients, scaled } from "./fixtures/lower-mir/programs/added.mjs";
import { EXECUTIONS, add, nested, plus, shaped } from "./fixtures/lower-mir/programs/first.mjs";
import { wt1 } from "./fixtures/lower-mir/programs/wt1.mjs";
import { wt4 } from "./fixtures/lower-mir/programs/wt4.mjs";
import { wt6 } from "./fixtures/lower-mir/programs/wt6.mjs";
import { s7 } from "./fixtures/lower-mir/programs/s7.mjs";
import { s2, s3, s6 } from "./fixtures/lower-mir/programs/cleanup.mjs";
import { s1, wt5, wt8, wt9, wt10, wt11 } from "./fixtures/lower-mir/programs/more.mjs";
import { loadFrontFixture } from "./fixtures/front/checked-module.mjs";
import { analysisInput } from "./fixtures/front/analysis-input.mjs";
import { checkCompoundStaticAssignment, checkStaticUpdates, checkQualifiedStaticRead } from "./fixtures/typed-static-witnesses.mjs";
import { checkCommaSequence, checkCoalescingAssignment, checkOptionalEmbedding, checkLabelledTransfers, checkVoidOperand } from "./fixtures/typed-occurrence-witnesses.mjs";

// The producer does not lower every construct yet. A construct it does not lower is refused by its one frontier
// check, a compiler defect whose message starts with FRONTIER. A case that meets it is not a passing case and not a
// wrong graph: it is reported as `todo` with what it met, and fails as written until the construct is lowered.
// Every other failure is a failure. `produced` is the operation itself, for the cases that assert the frontier.
const FRONTIER = "not lowered yet: ";
const CALLER_DEFECT = "caller defect: ";
let current = null;
const literalTrue = declareType("lowerLiteralTrue", { kind: "literal", value: { kind: "boolean", value: true }, base: T.bool });
const literalFalse = declareType("lowerLiteralFalse", { kind: "literal", value: { kind: "boolean", value: false }, base: T.bool });
const optionalBool = declareType("lowerOptionalBool", { kind: "optional", value: T.bool });
const indirectSignature = signature("lower.indirect.target", [["x", T.int32]], T.int32);
const indirectType = declareType("lowerIndirectCallable", { kind: "callable", calls: [indirectSignature], constructs: [] });
const field = def("directField.Box.flag");
const fieldOrigin = { kind: "declared", declaration: field };
const directField = selection("flag", T.bool, T.bool, direct("in-place"));
directField.decision.decision.origins = [fieldOrigin];
directField.decision.decision.selectedDeclarations = [field];
directField.decision.decision.primary = field;
const withFieldLocation = location => ({ kind: "decided", decision: {
  ...directField.decision, decision: { ...directField.decision.decision, location },
} });
const referenceField = withFieldLocation(direct("by-reference"));
const directBox = declareType("directFieldBox", { kind: "shape", members: [{ key: directField.decision.decision.key,
  origins: [fieldOrigin], readOrigins: [fieldOrigin], writeOrigins: [fieldOrigin], kind: "property",
  read: T.bool, write: T.bool, optional: false, readonly: false }], indexes: [], calls: [], constructs: [] });
const optionalFlagField = { ...directField, decision: { ...directField.decision,
  decision: { ...directField.decision.decision, read: optionalBool, write: optionalBool } } };
const optionalFlagBox = declareType("directOptionalFlagBox", { kind: "shape", members: [{ key: { kind: "text", value: "flag" },
  origins: [fieldOrigin], readOrigins: [fieldOrigin], writeOrigins: [fieldOrigin], kind: "property",
  read: optionalBool, write: optionalBool, optional: false, readonly: false }], indexes: [], calls: [], constructs: [] });
const nestedFieldOrigin = { kind: "declared", declaration: def("NestedBox.inner") };
const nestedField = selection("inner", directBox, directBox, direct("in-place"));
nestedField.decision.decision.origins = [nestedFieldOrigin];
nestedField.decision.decision.selectedDeclarations = [nestedFieldOrigin.declaration];
nestedField.decision.decision.primary = nestedFieldOrigin.declaration;
const nestedBox = declareType("nestedStaticFieldBox", { kind: "shape", members: [{ key: { kind: "text", value: "inner" },
  origins: [nestedFieldOrigin], readOrigins: [nestedFieldOrigin], writeOrigins: [nestedFieldOrigin], kind: "property",
  read: directBox, write: directBox, optional: false, readonly: false }], indexes: [], calls: [], constructs: [] });
const test = (name, ...rest) => {
  const run = rest.pop();
  return declare(name, ...rest, context => { current = context; return run(context); });
};
let produced;
let lowerToMir;
let lowerRequired;
/** The query unit a hand-run lowering reports against: the result of a request of the `mirBody` row. */
const UNIT = { request: { query: "mirBody", key: ["unit"] }, position: { kind: "result" } };

// The coverage gate: every runtime file of lower-mir at 100% of lines, branches and functions over this bank and the
// case modules it loads; the type-only contract is not applicable.
const repository = fileURLToPath(new URL("../../", import.meta.url));
const runtimeFiles = ["index", "lower", "state", "model", "operands", "control", "calls", "bindings"].map(name => resolve(repository, `packages/host/dist/lower-mir/${name}.js`));
const session = new Session();
const post = (method, parameters = {}) => new Promise((done, reject) => {
  session.post(method, parameters, (error, result) => error === null ? done(result) : reject(error));
});
let verifyMir;
let instanceKey;
let deps;

before(async () => {
  assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined, true, "lower-mir cases require a guarded admission");
  session.connect();
  await post("Debugger.enable");
  await post("Profiler.enable");
  await post("Profiler.startPreciseCoverage", { callCount: true, detailed: true });
  ({ lowerToMir: lowerRequired } = await import("../../packages/host/dist/lower-mir/index.js"));
  const { offeredEntries } = await import("./fixtures/lower-mir/typed.mjs");
  produced = (deps, body, internal) => lowerRequired(deps, body, internal, offeredEntries(deps.signatureOf(body.signature)));
  lowerToMir = (...given) => {
    try {
      return produced(...given);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith(FRONTIER)) current.todo(error.message);
      throw error;
    }
  };
  ({ verifyMir } = await import("../../packages/host/dist/ir-mir/index.js"));
  const types = await import("../../packages/host/dist/ir-types/index.js");
  instanceKey = types.instanceKey;
  const interner = admitFixtureTable(types, TABLE);
  deps = {
    defs: { completionSelector: T.int32, exceptionStorage: T.unknown },
    typeOf: type => types.readType(interner, type),
    signatureOf: id => {
      const signature = TABLE.signatures[id];
      assert.equal(signature !== undefined, true, "selected signature belongs to the actual fixture table");
      return signature;
    },
    limits: { maximumRecords: 100000 },
    unit: UNIT,
  };
});

// The cases of the lowering state, loaded after the hook above so that they run under the coverage it records.
await import("./lower-mir-state.cases.mjs");

after(async () => {
  try {
    const capture = await post("Profiler.takePreciseCoverage");
    const urls = new Set(runtimeFiles.map(path => pathToFileURL(path).href));
    const result = capture.result.filter(script => urls.has(script.url));
    const sources = [];
    for (const script of result) {
      const actual = await post("Debugger.getScriptSource", { scriptId: script.scriptId });
      sources.push({ scriptId: script.scriptId, url: script.url, text: actual.scriptSource });
    }
    await post("Profiler.stopPreciseCoverage");
    const report = checkCoverage({ canonical: realpathSync, readText: path => readFileSync(path, "utf8"), parse: parseSources,
      project: (url, text) => ({ path: fileURLToPath(url), text }) },
    [...runtimeFiles, resolve(repository, "packages/host/src/lower-mir/contract.ts")], [{ ...capture, result, sources }]);
    assert.equal(result.length, runtimeFiles.length, "each runtime file of lower-mir has source-identified coverage evidence");
    assert.equal(report.status, "passed", JSON.stringify(report.findings).slice(0, 6000));
    assert.equal(report.files.filter(file => file.status === "not-applicable").length, 1, "only the type-only contract is not applicable");
    for (const file of report.files.filter(file => file.status === "covered")) {
      assert.equal(file.lines, 100, basename(file.path));
      assert.equal(file.branches, 100, basename(file.path));
      assert.equal(file.functions, 100, basename(file.path));
    }
    assert.equal(report.files.filter(file => file.status === "covered").length, runtimeFiles.length);
  } finally { session.disconnect(); }
});

test("authored MIR: compound static assignment reads before the same-cell RHS store", checkCompoundStaticAssignment);
test("authored MIR: static prefix and postfix updates keep their selected result and storage", checkStaticUpdates);
test("authored MIR: local and imported static reads retain the actual storage identity", checkQualifiedStaticRead);
test("authored MIR: comma sequences execute in order and return the final value", checkCommaSequence);
test("authored MIR: coalescing assignment evaluates the RHS only for absent storage", checkCoalescingAssignment);
test("authored MIR: optional embeddings preserve the selected payload or native absence", checkOptionalEmbedding);
test("authored MIR: labelled transfers keep the selected loop or block destination", checkLabelledTransfers);
test("authored MIR: void evaluates its operand exactly once", checkVoidOperand);

test("authored MIR: array destinations check at the selected time and reuse the evaluated location", async () => {
  const fixture = await loadFrontFixture();
  const { createAccount } = await import("../../packages/host/dist/dataflow/index.js");
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../packages/host/dist/pipeline/typed-barrier.js");
  const { lowerMirDeps, mirVerificationContext } = await import("../../packages/host/dist/pipeline/lower-mir-step.js");
  const { internType, viewTypes } = await import("../../packages/host/dist/ir-types/index.js");
  const { parseTir, printTir, verifyTir } = await import("../../packages/host/dist/ir-tir/index.js");
  const { tirReadyReadAdmission } = await import("../../packages/host/dist/ir-program/index.js");
  const input = analysisInput(fixture, "es2024", `
    function key() { return 0; }
    function next(flag: boolean): boolean { return !flag; }
    function amount(value: number): number { return value; }
    export function write(values: boolean[], flag: boolean): void { values[key()] = next(flag); }
    export function compound(values: number[], value: number): void { values[key()] += amount(value); }
    export function unchanged(values: number[], value: number): void { values[key()] += value; }
    export function read(values: readonly boolean[]): boolean { return values[key()]; }
  `);
  const checked = captureSourceBarrier(input);
  assert.equal(checked.kind, "ok", JSON.stringify(checked.diagnostics));
  for (const [destinationCheck, arrayIndexFailure, holding] of [
    ["before-value", "abort", "by-reference"], ["after-value", "unwind", "by-reference"],
    ["before-value", "abort", "in-place"], ["after-value", "unwind", "in-place"],
  ]) {
    const carrierHolding = input.snapshot.nativeFacts.carrierHolding.map(row => row.carrier === "array" ? { ...row, holding } : row);
    const selectedNativeFacts = { ...input.snapshot.nativeFacts, destinationCheck, arrayIndexFailure, carrierHolding };
    const active = { ...input, snapshot: { ...input.snapshot, nativeFacts: selectedNativeFacts } };
    const typed = typeSourceBarrier(active, checked.value, createAccount(active.limits.dataflow));
    assert.equal(typed.kind, "ok", JSON.stringify(typed.diagnostics));
    const ready = typed.value;
    const table = viewTypes(checked.value.types);
    const run = { selectedNativeFacts, interner: checked.value.types, table,
      defs: { completionSelector: internType(checked.value.types, { kind: "primitive", primitive: "int32" }),
        exceptionStorage: internType(checked.value.types, { kind: "intrinsic", intrinsic: "unknown" }) },
      lowering: active.limits.lowering, verification: active.limits.mirVerification, declarationOf: ready.declarationOf,
      bodyOwner: identity => fixture.ids.decodeBodyId(identity).value.owner,
      bodyOf: instance => ready.bodies.get(instanceKey(instance)) ?? null };
    const source = checked.value.modules.find(row => row.module.module === input.snapshot.entryPoint).module;
    for (const declaration of source.tree.statements.nodes.slice(3)) {
      const name = declaration.name.text;
      const body = [...ready.bodies.values()].find(row => row.bindings.kind === "instantiated" && row.body === declaration.tsonic.body);
      assert.ok(body, name);
      const identity = instanceKey({ body: body.body, bindings: body.bindings });
      const entries = ready.required.provided.get(identity);
      assert.ok(entries, name);
      const unit = { request: { query: "mirBody", key: identity }, position: { kind: "result" } };
      const deps = lowerMirDeps(run, unit);
      const lowered = lowerRequired(deps, body, [], entries);
      assert.equal(lowered.kind, "ok", `${name} ${JSON.stringify(lowered.diagnostics)}`);
      const mir = lowered.value;
      const verification = mirVerificationContext(run, body, entries);
      const verified = verifyMir(mir, verification);
      assert.deepEqual(verified, { kind: "complete", violations: [] }, name);
      const { expression } = body.root.statements.nodes[0];
      const index = name === "read" ? expression : expression.left;
      assert.equal(index.tsonic.index.holding, holding, name);
      if (name === "read") {
        const text = printTir(body);
        const parsed = parseTir(text);
        assert.equal(parsed.kind, "parsed");
        assert.equal(parsed.value.root.statements.nodes[0].expression.tsonic.index.holding, holding);
        const missingHolding = text.replace(`, holding="${holding}"`, "");
        assert.notEqual(missingHolding, text);
        assert.notEqual(parseTir(missingHolding).kind, "parsed");
      }
      const sourceProof = ready.verifierOf(body.root.origin.module);
      assert.ok(sourceProof, name);
      const crossed = carrierHolding.map(row => row.carrier === "array"
        ? { ...row, holding: holding === "by-reference" ? "in-place" : "by-reference" } : row);
      const rejected = verifyTir({ ...sourceProof, selectedNativeFacts: { ...selectedNativeFacts, carrierHolding: crossed } },
        tirReadyReadAdmission(createAccount(active.limits.dataflow)))(body);
      assert.equal(rejected.kind, "complete");
      assert.equal(rejected.violations.some(issue => issue.rule === "access-location"), true, name);
      const chain = [];
      let block = mir.blocks[mir.entries[0].block];
      while (block !== undefined) {
        assert.ok(chain.length < mir.blocks.length, name);
        chain.push(block);
        const end = block.terminator;
        block = end.kind === "return" ? undefined : mir.blocks[end.next];
      }
      const calls = chain.flatMap(row => row.terminator.kind === "call" ? [row.terminator] : []);
      assert.equal(calls.filter(call => call.tir.node === index.argumentExpression.id).length, 1, name);
      const checkedBlocks = chain.filter(row => row.terminator.kind === "check");
      assert.equal(checkedBlocks.length, name === "compound" || name === "write" && destinationCheck === "before-value" ? 2 : 1, name);
      const place = mir.places.find(row => row.base.kind === "checked" && row.base.tir.node === index.id);
      assert.ok(place, name);
      assert.equal(rootLocalOf(mir, place.base.place) === sourceLocal(mir, 0), holding === "in-place", name);
      assert.deepEqual(place.base.projection, { kind: "index", operand: { kind: "place", place: calls[0].destination } });
      for (const current of checkedBlocks) {
        assert.equal(current.terminator.place, place.id);
        assert.deepEqual(current.terminator.unwind, { kind: arrayIndexFailure === "abort" ? "abort" : "escape" });
        assert.equal(current.terminator.tir.node, index.id);
      }
      const wrongFailure = { ...mir, blocks: mir.blocks.map(row => row !== checkedBlocks[0] ? row : { ...row,
        terminator: { ...row.terminator, unwind: { kind: arrayIndexFailure === "abort" ? "escape" : "abort" } } }) };
      const wrongKind = verifyMir(wrongFailure, verification);
      assert.equal(wrongKind.kind, "complete");
      assert.equal(wrongKind.violations.some(issue => issue.rule === "failure-kind-exact"), true);
      const stores = mir.blocks.flatMap(row => row.statements.filter(statement => statement.kind === "assign" && statement.place === place.id));
      assert.equal(stores.length, name === "read" ? 0 : 1, name);
      if (name !== "read") {
        assert.ok(chain.indexOf(checkedBlocks.at(-1)) < chain.findIndex(row => row.statements.includes(stores[0])), name);
        const reads = chain.flatMap(row => row.statements.filter(statement => statement.kind === "assign"
          && statement.value.kind === "use" && statement.value.operand.kind === "place" && statement.value.operand.place === place.id));
        assert.equal(reads.length, name === "write" ? 0 : 1, name);
        if (name !== "unchanged") {
          const rhs = chain.findIndex(row => row.terminator.tir?.node === expression.right.id);
          assert.ok(rhs >= 0, name);
          assert.equal(chain.indexOf(checkedBlocks[0]) < rhs, name === "compound" || destinationCheck === "before-value", name);
          if (checkedBlocks.length === 2) assert.ok(rhs < chain.indexOf(checkedBlocks[1]), name);
          if (name === "compound") assert.ok(chain.findIndex(row => row.statements.includes(reads[0])) <= rhs, name);
        }
      }
      const exact = mir.locals.length + mir.places.length + mir.constants.length + mir.blocks.length
        + mir.blocks.reduce((count, row) => count + row.statements.length, 0);
      for (let maximumRecords = 0; maximumRecords < exact; maximumRecords += 1) {
        const short = lowerRequired({ ...deps, limits: { maximumRecords } }, body, [], entries);
        assert.equal(short.kind, "refused", `${name} at ${maximumRecords}`);
      }
      assert.deepEqual(lowerRequired({ ...deps, limits: { maximumRecords: exact } }, body, [], entries), lowered);
    }
  }
});

test("authored MIR: switch evaluates selected labels in order and reads the subject once", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { printModuleBodies, parseModuleBodies } = await import("../../packages/host/dist/ir-program/index.js");
  const { evaluate, resumeEvaluate } = await import("../../packages/host/dist/evaluate/index.js");
  const { resourceLimitDiagnostic } = await import("../../packages/host/dist/diag/index.js");
  const product = await import("../../packages/host/dist/ir-types/index.js");
  for (const [name, source, records] of [
    ["numeric literal", `export function run(subject: number): boolean {
      switch (subject) { case 1.25: return true; default: return false; }
    }`, [5, 5, 4, 3, 8]],
    ["numeric values", `export function run(subject: number, label: number): boolean {
      switch (subject) { case label: return true; default: return false; }
    }`, [6, 6, 3, 3, 8]],
    ["constant subject", `export function run(label: boolean): boolean {
      switch (true) { case label: return true; default: return false; }
    }`, [4, 4, 3, 3, 6]],
    ["call subject", `function retain(flag: boolean): boolean { return flag; }
    export function run(flag: boolean, label: boolean): boolean {
      switch (retain(flag)) { case label: return true; default: return false; }
    }`, [6, 6, 3, 4, 7]],
    ["label mutation", `export function run(subject: boolean): boolean {
      switch (subject) { case (subject = false): return false; case true: return true; default: return false; }
    }`, [8, 8, 3, 5, 15]],
    ["effectful label", `function effect(flag: boolean, message: string): boolean { if (flag) return flag; throw message; }
    export function run(subject: boolean, flag: boolean, message: string): boolean {
      switch (subject) { case false: return true; default: return false; case effect(flag, message): return true; }
    }`, [10, 10, 3, 6, 13]],
    ["fast duplicate", `export function run(subject: boolean, entered: boolean): boolean {
      switch (subject) { case false: entered = true; case false: return entered; default: return false; }
    }`, [4, 4, 3, 4, 5]],
  ]) {
    const input = analysisInput(fixture, "sdk-minimal", source);
    const output = analyzeHostProgram(input);
    assert.equal(output.kind, "ok", JSON.stringify(output.diagnostics));
    const { index, modules } = output.value;
    const { types } = index;
    const module = modules.find(row => row.module === input.snapshot.entryPoint);
    const text = printModuleBodies(index, module);
    const parsed = parseModuleBodies(index, text);
    assert.equal(parsed.kind, "parsed", name);
    assert.equal(printModuleBodies(index, parsed.value), text, name);
    assert.equal(module.tree.kind, "ready-root", name);
    const declarations = module.tree.root.statements.nodes;
    const bodyOf = declaration => {
      assert.equal(declaration.kind, "ready-callable");
      return module.bodies.find(row => row.kind === "selected" && row.instance.body === declaration.node.tsonic.signatures[0].body);
    };
    const body = bodyOf(declarations.at(-1));
    const { tir, mir, instance } = body;
    const [statement] = tir.root.statements.nodes;
    const [first] = statement.caseBlock.clauses.nodes;
    const comparisons = mir.blocks.flatMap(block => block.statements.filter(row => row.kind === "assign" && row.value.kind === "binary"));
    assert.deepEqual([mir.locals.length, mir.places.length, mir.constants.length, mir.blocks.length,
      mir.blocks.reduce((count, block) => count + block.statements.length, 0)], records, name);
    if (name === "fast duplicate") {
      const entry = mir.blocks[mir.entries[0].block];
      assert.deepEqual(entry.statements, []);
      assert.deepEqual(entry.terminator.operand, { kind: "place", place: 0 });
      assert.deepEqual(mir.places[0].base, { kind: "local", local: mir.locals[0].id });
      assert.equal(mir.blocks.filter(block => block.terminator.kind === "switch").length, 1);
      assert.deepEqual(comparisons, []);
    } else {
      for (const [index, clause] of statement.caseBlock.clauses.nodes.filter(clause => clause.kind === "CaseClause").entries()) {
        assert.equal(comparisons[index].tir.node, clause.id);
        assert.deepEqual(comparisons[index].value.operation, clause.tsonic.operation.decision);
      }
    }
    if (name === "numeric literal") {
      const label = types.terms[first.expression.tsonic.convertedType];
      assert.equal(label.kind, "literal");
      assert.equal(label.base, statement.expression.tsonic.convertedType);
      assert.deepEqual(first.tsonic.operation.decision.decision.operation, { kind: "native-operator", operator: "===", carrier: "float64" });
    }
    if (name === "constant subject") {
      const left = comparisons[0].value.left;
      assert.equal(left.kind, "constant");
      const subject = mir.constants[left.constant];
      assert.equal(subject.type, statement.expression.tsonic.convertedType);
      assert.deepEqual(subject.value, { kind: "literal", value: { kind: "boolean", value: true } });
    }
    if (name === "call subject") {
      const calls = mir.blocks.map(block => block.terminator).filter(terminator => terminator.kind === "call");
      assert.equal(calls.length, 1);
      assert.notEqual(calls[0].destination, null);
      assert.deepEqual(comparisons[0].value.left, { kind: "place", place: calls[0].destination });
    }
    const interner = admitFixtureTable(product, types);
    const unit = { request: { query: "mirBody", key: instanceKey(instance) }, position: { kind: "result" } };
    const ready = { defs: { completionSelector: product.internType(interner, { kind: "primitive", primitive: "int32" }),
      exceptionStorage: product.internType(interner, { kind: "intrinsic", intrinsic: "unknown" }) },
      typeOf: type => product.readType(interner, type), signatureOf: id => product.readSignature(interner, id) };
    const lowerAt = maximum => produced({ ...ready, limits: { maximumRecords: maximum }, unit }, tir, []);
    const exact = records.reduce((total, count) => total + count, 0);
    for (let maximum = 0; maximum < exact; maximum += 1) {
      const diagnostic = resourceLimitDiagnostic({ owner: "lower-mir", limit: "lower-mir.maximumRecords", maximum,
        site: { kind: "source", origin: tir.root.origin }, unit });
      assert.deepEqual(lowerAt(maximum), { kind: "refused", diagnostics: [diagnostic] }, `${name} at ${maximum}`);
    }
    assert.deepEqual(lowerAt(exact), { kind: "ok", value: mir, diagnostics: [] }, name);
    const evaluation = { types, typeOf: type => types.terms[type], signatureOf: id => types.signatures[id],
      selectedNativeFacts: input.snapshot.nativeFacts, limits: input.limits.evaluation };
    const run = operands => evaluate(evaluation, instance, mir, operands, "compile-time", { query: "constValue", key: [instance, "compile-time"] });
    const bool = value => ({ kind: "boolean", type: tir.completion, value });
    const returns = (result, value) => {
      assert.equal(result.kind, "done", name);
      assert.equal(result.value.kind, "ok", name);
      assert.deepEqual(result.value.value, { kind: "value", value: bool(value) }, name);
      assert.deepEqual(result.value.diagnostics, [], name);
    };
    if (name === "numeric literal") {
      const floating = bits => ({ kind: "floating", type: tir.params[0].tsonic.storage, bits });
      for (const [bits, match] of [[0x3ff4000000000000n, true], [0n, false], [0x7ff8000000000001n, false]])
        returns(run([floating(bits)]), match);
    } else if (name === "numeric values") {
      const floating = bits => ({ kind: "floating", type: tir.params[0].tsonic.storage, bits });
      for (const [bits, match] of [[0n, true], [0x8000000000000000n, true], [0x7ff8000000000001n, false]])
        returns(run([floating(bits), floating(0n)]), match);
    } else if (name === "constant subject") {
      for (const label of [false, true]) returns(run([bool(label)]), label);
    } else if (name === "call subject") {
      const callee = bodyOf(declarations[0]);
      for (const flag of [false, true]) for (const label of [false, true]) {
        const paused = run([bool(flag), bool(label)]);
        assert.equal(paused.kind, "paused");
        assert.deepEqual(paused.requests, [{ kind: "mir-body", instance: callee.instance }]);
        returns(resumeEvaluate(evaluation, paused.paused, [{ kind: "mir-body", body: callee.mir }]), flag === label);
      }
    } else if (name === "label mutation") {
      for (const value of [true, false]) returns(run([bool(value)]), value);
    } else if (name === "fast duplicate") {
      for (const value of [true, false]) returns(run([bool(value), bool(false)]), !value);
    } else if (name === "effectful label") {
      const callee = bodyOf(declarations[0]);
      const message = { kind: "string", type: tir.params[2].tsonic.storage, value: "original label failure" };
      returns(run([bool(false), bool(false), message]), true);
      for (const value of [true, false]) {
        const paused = run([bool(true), bool(value), message]);
        assert.equal(paused.kind, "paused");
        assert.deepEqual(paused.requests, [{ kind: "mir-body", instance: callee.instance }]);
        const resumed = resumeEvaluate(evaluation, paused.paused, [{ kind: "mir-body", body: callee.mir }]);
        if (value) returns(resumed, true);
        else {
          assert.equal(resumed.kind, "done");
          assert.equal(resumed.value.kind, "ok");
          assert.deepEqual(resumed.value.value, { kind: "value", value: { kind: "error", type: tir.completion } });
          assert.deepEqual(resumed.value.diagnostics.map(row => row.site.origin), [callee.tir.root.statements.nodes[1].origin]);
        }
      }
    }
  }
});

test("authored MIR: an effect-only void operand pays only for a consumed absence", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const product = await import("../../packages/host/dist/ir-types/index.js");
  const { internType, readSignature, readType } = product;
  const { resourceLimitDiagnostic } = await import("../../packages/host/dist/diag/index.js");
  const input = analysisInput(fixture, "sdk-minimal", `
    function effect(): void { return; }
    export function discard(): void { void effect(); }
    export function use(): undefined { return void effect(); }
    export function direct(): void { effect(); return; }
    export function forwarded(): void { return effect(); }`);
  const output = analyzeHostProgram(input);
  assert.equal(output.kind, "ok", JSON.stringify(output.diagnostics));
  const module = output.value.modules.find(row => row.module === input.snapshot.entryPoint);
  const interner = admitFixtureTable(product, output.value.index.types);
  const ready = {
    defs: { completionSelector: internType(interner, { kind: "primitive", primitive: "int32" }),
      exceptionStorage: internType(interner, { kind: "intrinsic", intrinsic: "unknown" }) },
    typeOf: type => readType(interner, type),
    signatureOf: signature => readSignature(interner, signature),
  };
  assert.equal(module.tree.kind, "ready-root");
  const [effect, discard, use, direct, forwarded] = module.tree.root.statements.nodes.map(declaration => {
    assert.equal(declaration.kind, "ready-callable");
    return module.bodies.find(row => row.kind === "selected" && row.instance.body === declaration.node.tsonic.signatures[0].body);
  });
  for (const [body, expected] of [[discard, 2], [use, 3], [direct, 2], [forwarded, 2]]) {
    const [entry, continuation] = body.mir.blocks;
    assert.deepEqual([body.mir.blocks.length, body.mir.locals.length, body.mir.places.length, body.mir.constants.length,
      entry.statements.length, continuation.statements.length], [2, 0, 0, body === use ? 1 : 0, 0, 0]);
    assert.deepEqual([entry.terminator.kind, entry.terminator.callee.kind, entry.terminator.destination, entry.terminator.next,
      entry.terminator.unwind, continuation.terminator.kind, continuation.terminator.value],
    ["call", "direct", null, continuation.id, { kind: "escape" }, "return",
      body === use ? { kind: "constant", constant: body.mir.constants[0].id } : null]);
    const unit = { request: { query: "mirBody", key: instanceKey(body.instance) }, position: { kind: "result" } };
    const attempt = maximum => {
      const reads = [];
      const lowered = lowerToMir({ ...ready, limits: { maximumRecords: maximum }, unit, typeOf: type => {
        reads.push(type);
        return ready.typeOf(type);
      } }, body.tir, []);
      assert.deepEqual(reads, maximum === 0 ? [] : body === discard && maximum === expected
        ? [effect.tir.completion, discard.tir.completion] : [effect.tir.completion]);
      return lowered;
    };
    for (let maximum = 0; maximum < expected; maximum += 1) {
      const diagnostic = resourceLimitDiagnostic({ owner: "lower-mir", limit: "lower-mir.maximumRecords", maximum,
        site: { kind: "source", origin: body.tir.root.origin }, unit });
      assert.deepEqual(attempt(maximum), { kind: "refused", diagnostics: [diagnostic] }, `${body.tir.body} at ${maximum}`);
    }
    const exact = attempt(expected);
    assert.equal(exact.kind, "ok");
    assert.deepEqual([exact.value, exact.diagnostics], [body.mir, []]);
  }
  for (const invalid of ["operation", "execution"]) {
    const crossed = structuredClone(use.tir);
    const expression = crossed.root.statements.nodes[0].expression;
    const selected = expression.tsonic.operation.decision.decision;
    if (invalid === "operation") selected.operation = { kind: "type-query" };
    else selected.execution = { kind: "invocation", writesStorage: false, failure: "unwind" };
    const unit = { request: { query: "mirBody", key: instanceKey(use.instance) }, position: { kind: "result" } };
    assert.throws(() => lowerToMir({ ...ready, limits: { maximumRecords: 3 }, unit, typeOf: () => {
      assert.fail("a malformed void decision must stop before reading the call result type");
    } }, crossed, []), error => error.cause?.owner === "lower-mir" && error.message === "caller defect: void without its selected discard operation", invalid);
  }
});

test("authored MIR: static and absence reads preserve their record budget and native carrier", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const product = await import("../../packages/host/dist/ir-types/index.js");
  const { internType, readSignature, readType } = product;
  const { resourceLimitDiagnostic } = await import("../../packages/host/dist/diag/index.js");
  const input = analysisInput(fixture, "sdk-minimal", `
    export const state: boolean = true;
    export function read(): boolean { return state; }
    export function absent(): undefined { return undefined; }`);
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const table = result.value.index.types;
  const interner = admitFixtureTable(product, table);
  const ready = {
    defs: { completionSelector: internType(interner, { kind: "primitive", primitive: "int32" }),
      exceptionStorage: internType(interner, { kind: "intrinsic", intrinsic: "unknown" }) },
    typeOf: type => readType(interner, type),
    signatureOf: signature => readSignature(interner, signature),
  };
  const { bodies } = result.value.modules.find(module => module.module === input.snapshot.entryPoint);
  const read = bodies.find(body => body.kind === "selected" && body.tir.root.kind === "Block"
    && body.tir.root.statements.nodes[0]?.expression?.tsonic.resolution?.kind === "static");
  assert.ok(read);
  assert.equal(read.tir.nestedBodies.length, 0);
  const unit = { request: { query: "mirBody", key: instanceKey(read.instance) }, position: { kind: "result" } };
  const attempt = maximumRecords => lowerToMir({ ...ready, limits: { maximumRecords }, unit }, read.tir, []);
  const [block] = read.mir.blocks;
  assert.deepEqual([read.mir.blocks.length, read.mir.locals.length, read.mir.places.length, read.mir.constants.length,
    block.statements.length], [1, 1, 2, 0, 2]);
  assert.deepEqual(block.statements.map(statement => statement.kind), ["storage-live", "assign"]);
  assert.equal(block.terminator.kind, "return");
  for (let maximum = 0; maximum < 6; maximum += 1) {
    const diagnostic = resourceLimitDiagnostic({ owner: "lower-mir", limit: "lower-mir.maximumRecords", maximum,
      site: { kind: "source", origin: read.tir.root.origin }, unit });
    assert.deepEqual(attempt(maximum), { kind: "refused", diagnostics: [diagnostic] }, `limit ${maximum}`);
  }
  const exact = attempt(6);
  assert.equal(exact.kind, "ok");
  assert.deepEqual([exact.value, exact.diagnostics], [read.mir, []]);

  const absent = bodies.find(body => body.kind === "selected" && body.tir.root.kind === "Block"
    && body.tir.root.statements.nodes[0]?.expression?.tsonic.resolution?.kind === "intrinsic-value");
  assert.ok(absent);
  const [completion] = absent.tir.root.statements.nodes;
  const expression = completion.expression;
  assert.equal(expression.tsonic.conversion.kind, "identity");
  const absenceUnit = { request: { query: "mirBody", key: instanceKey(absent.instance) }, position: { kind: "result" } };
  const absenceDeps = { ...ready, limits: { maximumRecords: 2 }, unit: absenceUnit };
  for (const maximumRecords of [0, 1]) {
    const reads = [];
    const refused = lowerToMir({ ...absenceDeps, limits: { maximumRecords }, typeOf: type => {
      reads.push(type);
      return ready.typeOf(type);
    } }, absent.tir, []);
    assert.equal(refused.kind, "refused");
    assert.equal(refused.diagnostics.length, 1);
    assert.equal("value" in refused, false);
    assert.deepEqual(reads, maximumRecords === 0 ? [] : [expression.tsonic.type]);
  }
  const original = lowerToMir(absenceDeps, absent.tir, []);
  assert.equal(original.kind, "ok");
  assert.deepEqual(original.value, absent.mir);
  const presentType = read.tir.root.statements.nodes[0].expression.tsonic.type;
  assert.deepEqual(readType(interner, presentType), { kind: "primitive", primitive: "bool" });
  const crossed = { ...completion, expression: { ...expression, tsonic: { ...expression.tsonic, type: presentType } } };
  const invalid = { ...absent.tir, root: { ...absent.tir.root, statements: { ...absent.tir.root.statements, nodes: [crossed] } } };
  assert.throws(() => lowerToMir(absenceDeps, invalid, []), error => defectOfLowerMir(error)
    && error.message === "caller defect: an intrinsic undefined read must retain its native absence type" && error.cause.origin === expression.origin);
});

/** The findings of the complete MIR verifier for a lowered graph. A refusal for resources is not a list of findings and fails the case. */
const verified = (mir, program) => {
  const outcome = verifyMir(mir, verificationContext(program));
  assert.equal(outcome.kind, "complete");
  return outcome.violations;
};
/**
 * Lowers one typed body and requires an accepted result with no diagnostic (section 7 part 7: the box originates one
 * diagnostic, the size limit). Section 7 part 2 has the verifier run at the handoff from lowering: every graph this
 * bank accepts is also a graph the complete MIR verifier accepts (R1 E-5).
 */
const lower = (program, internal = [], limits = null) => {
  const result = lowerToMir(limits === null ? deps : { ...deps, limits }, program.tir, internal);
  assert.equal(result.kind, "ok");
  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(verified(result.value, program).map(violation => `${violation.rule} at ${JSON.stringify(violation.site)}`), []);
  return result.value;
};
/** The predicate of a defect raised by lower-mir through Diag: an Error whose cause names the owner (R1 section 4). */
const defectOfLowerMir = error => error instanceof Error && error.cause !== undefined && error.cause !== null && error.cause.owner === "lower-mir"
  && error.message.startsWith(CALLER_DEFECT);
/** The frontier refusal that names `what`: a compiler defect of lower-mir, not a diagnostic and not a caller defect. */
const notLoweredYet = what => error => error instanceof Error && error.cause !== undefined && error.cause !== null && error.cause.owner === "lower-mir"
  && error.message === `${FRONTIER}${what}`;
const convertingNode = (b, name, node, fromType, toType, execution, backing) => ({ ...node, $: "converted", tsonic: at => {
  const original = typeof node.tsonic === "function" ? node.tsonic(at) : node.tsonic;
  const from = { root: { kind: "body", value: b.nodeRef(at("converted")) }, path: [] };
  const to = { root: { kind: "body", value: b.nodeRef(0) }, path: [{ kind: "result", signature: SIG[name] }] };
  const embedding = { kind: "conversion", conversion: "numeric", proof: { steps: [{ from, to, rule: "numeric", premises: [] }], conclusion: 0 }, check: { kind: "none" } };
  const identity = backing === "native" ? { kind: "conversion", from: fromType, to: toType, embedding }
    : { kind: backing, declaration: def(`conversion.${backing}.int32-to-int64`), bindings: EMPTY_BINDINGS };
  const conversion = typedOperation(selected(identity, [fromType], toType, execution));
  return { ...original, convertedType: toType, conversion: backing === "native"
    ? { kind: "convert", role: "return", operation: conversion } : { kind: "backed-convert", role: "return", operation: conversion, embedding } };
} });
const narrowingNode = (b, name, node, source, result, failure) => ({ ...node, $: "narrowed", tsonic: at => {
  const original = typeof node.tsonic === "function" ? node.tsonic(at) : node.tsonic;
  const root = { kind: "body", value: b.nodeRef(0) };
  const parameter = { kind: "parameter", signature: SIG[name], index: 0 };
  const from = { root, path: [parameter] };
  const to = { root, path: [parameter, { kind: "optional-value" }] };
  const proof = { steps: [{ from, to, rule: "absence", premises: [] }], conclusion: 0 };
  return { ...original, narrowing: { kind: "narrowed", source, result, failure, proof } };
} });
const labelledBlock = (b, label, statement, target = label) => ({ $: label, kind: "LabeledStatement", label: b.label(label, target), statement,
  tsonic: at => ({ target: b.nodeRef(at(target)) }) });
const selectedBreak = (b, target) => ({ kind: "BreakStatement", label: b.label(target, target), tsonic: at => ({ target: b.nodeRef(at(target)) }) });
const selectedContinue = (b, target, labelled) => ({ kind: "ContinueStatement", label: labelled ? b.label(target, target) : null,
  tsonic: at => ({ target: b.nodeRef(at(target)) }) });
const unconditionalFor = (tag, statement, initializer = null) => ({ $: tag, kind: "ForStatement", initializer, condition: null, incrementor: null, statement, tsonic: null });
const labelled = (program, nodes) => { const names = invert(program.labels); return nodes.map(node => names.get(node) ?? node); };
const sourceLocal = (mir, local) => mir.locals.find(candidate => candidate.source !== null && candidate.source.local === local).id;
const statementsOn = path => path.events.filter(item => item.statement !== null);
const indexOfEvent = (path, predicate) => path.events.findIndex(predicate);
// The two policy values are two facts (the bounds failure and the absent-access failure); every combination runs,
// and each expectation is computed from the decision it belongs to (R1 E-3).
const POLICIES = [{ bounds: "unwind", absent: "unwind" }, { bounds: "abort", absent: "abort" },
  { bounds: "unwind", absent: "abort" }, { bounds: "abort", absent: "unwind" }];

// ---- the first producer: parameters, binary operations placed by their decision, return --------------------------

const originOf = node => ({ module: MODULE, start: node, length: 1, derived: [] });

/**
 * The graph of `function add(a, b) { return a + b; }`, written from the lowering rules and not from the producer
 * (package W4-3, section 3): R7 one entry at the full count; the parameters' locals name their rows and carry no begin
 * marker (R10); the sum is a statement when the decision of `+` is pure and a control point with the decision's
 * failure arm otherwise (R1, R2); the operation record is the node's decision (R12); a block names the node whose
 * evaluation it starts and a marker the node whose value its slot holds. `unwind` is null for the statement form.
 */
function expectedAdd(program, type, unwind) {
  const body = program.tir.body;
  const site = node => ({ origin: originOf(node), tir: { body, node } });
  const root = site(0);
  const sum = site(program.at("a+b"));
  const returned = site(program.at("return"));
  const locals = [
    { id: 0, storage: type, role: { kind: "parameter", index: 0 }, mode: program.tir.params[0].tsonic.passing, source: { body, local: 0 }, origin: program.tir.params[0].origin },
    { id: 1, storage: type, role: { kind: "parameter", index: 1 }, mode: program.tir.params[1].tsonic.passing, source: { body, local: 1 }, origin: program.tir.params[1].origin },
    { id: 2, storage: type, role: { kind: "temporary" }, mode: "local", source: null, origin: sum.origin },
  ];
  const places = locals.map(local => ({ id: local.id, base: { kind: "local", local: local.id }, storage: type, origin: local.origin }));
  const [a, b, result] = [0, 1, 2].map(place => ({ kind: "place", place }));
  const begun = { ...sum, kind: "storage-live", local: 2 };
  const blocks = unwind === null
    ? [{ ...root, id: 0, statements: [begun,
      { ...sum, kind: "assign", place: 2, value: { kind: "binary", operation: program.decision, left: a, right: b }, step: null }],
    terminator: { ...returned, kind: "return", value: result } }]
    : [{ ...root, id: 0, statements: [begun], terminator: { ...sum, kind: "invoke", operation: program.decision, operands: [a, b],
      destination: 2, next: 1, unwind: { kind: unwind }, step: null } },
    { ...returned, id: 1, statements: [], terminator: { ...returned, kind: "return", value: result } }];
  return { body, bindings: SELECTED_BINDINGS, entries: [{ provided: 2, block: 0 }], locals, constants: [], places, blocks, result: type };
}

// The checkpoint program is over `number`, which is float64 (K-3291); the unit program of WT-1 is over int32. Lowering
// reads the carrier from the decision and nothing from the type, so both have the same graph; both are compared.
for (const typeName of ["float64", "int32"])
  for (const [execution, unwind] of [["pure", null], ["cannotFail", "none"], ["unwinds", "escape"], ["endsProcess", "abort"]])
    test(`first producer: add over ${typeName}, + ${execution}: the graph written from the rules`, () => {
      const type = T[typeName];
      const program = add(`first.add.${typeName}.${execution}`, type, plus(typeName, type, EXECUTIONS[execution]));
      assert.deepEqual(lower(program), expectedAdd(program, type, unwind));
    });

test("first producer: operands are evaluated left to right, each once; an inner operation is emitted before the one that uses it", () => {
  const P = plus("float64", T.float64);
  // (a + b) + a
  const left = nested("first.left", T.float64, ({ leaf, sum, group }) => sum("outer", group(sum("inner", leaf("a"), leaf("b"), P)), leaf("a"), P));
  let mir = lower(left);
  let sums = mir.blocks[0].statements.filter(record => record.kind === "assign");
  assert.deepEqual(sums.map(record => record.tir.node), [left.at("inner"), left.at("outer")]);
  assert.deepEqual(sums.map(record => [record.value.left.place, record.value.right.place, record.place]), [[0, 1, 2], [2, 0, 3]]);
  // a + (b + a): the left operand `a` is evaluated first and read in place; nothing between writes it.
  const right = nested("first.right", T.float64, ({ leaf, sum, group }) => sum("outer", leaf("a"), group(sum("inner", leaf("b"), leaf("a"), P)), P));
  mir = lower(right);
  sums = mir.blocks[0].statements.filter(record => record.kind === "assign");
  assert.deepEqual(sums.map(record => record.tir.node), [right.at("inner"), right.at("outer")]);
  assert.deepEqual(sums.map(record => [record.value.left.place, record.value.right.place, record.place]), [[1, 0, 2], [0, 2, 3]]);
  // One block, no control point but the return, and each temporary begun once before its one write.
  assert.equal(mir.blocks.length, 1);
  assert.deepEqual(mir.blocks[0].statements.map(record => record.kind), ["storage-live", "assign", "storage-live", "assign"]);
  assert.deepEqual(mir.locals.map(local => local.role.kind), ["parameter", "parameter", "temporary", "temporary"]);
});

test("first producer: an operand read from the caller's storage is saved before a control point that writes existing storage", () => {
  // function f(a, b) { return a + (b (+) b); } where (+) is an invocation. `a` is evaluated before (+) runs.
  const build = execution => ({ leaf, sum, group }) =>
    sum("outer", leaf("a"), group(sum("inner", leaf("b"), leaf("b"), plus("int32", T.int32, execution))), plus("int32", T.int32));
  const kinds = mir => mir.blocks.map(block => [...block.statements.map(record => record.kind), block.terminator.kind]);
  // `a` is passed by reference: its local is the caller's storage, which (+) may write. Its value is saved first.
  const byReference = nested("first.saved", T.int32, build(EXECUTIONS.writes), { passing: ["byref-readwrite", "by-value"] });
  let mir = lower(byReference);
  assert.deepEqual(kinds(mir), [["storage-live", "assign", "storage-live", "invoke"], ["storage-live", "assign", "return"]]);
  const saved = mir.blocks[0].statements[1];
  assert.deepEqual([saved.value, saved.tir.node], [{ kind: "use", operand: { kind: "place", place: 0 } }, byReference.at("a#1")]);
  const outer = mir.blocks[1].statements[1];
  assert.equal(outer.tir.node, byReference.at("outer"));
  assert.deepEqual(outer.value.left, { kind: "place", place: saved.place }, "the sum reads the saved value, not the caller's storage again");
  // Passed by value, `a` is the body's own cell: nothing but a record that names it writes it, and it is read in place.
  mir = lower(nested("first.private", T.int32, build(EXECUTIONS.writes)));
  assert.deepEqual(kinds(mir), [["storage-live", "invoke"], ["storage-live", "assign", "return"]]);
  assert.deepEqual(mir.blocks[1].statements[1].value.left, { kind: "place", place: 0 });
  // An invocation whose decision says it writes no existing storage: nothing is saved, by reference or not.
  mir = lower(nested("first.reading", T.int32, build(EXECUTIONS.unwinds), { passing: ["byref-readwrite", "by-value"] }));
  assert.deepEqual(kinds(mir), [["storage-live", "invoke"], ["storage-live", "assign", "return"]]);
});

test("production lowering rejects template identity even when the checked binding scope is empty", () => {
  const program = shaped("selected.empty.scope", [], T.void, b => b.block());
  assert.throws(() => produced(deps, { ...program.tir, bindings: PARAMETRIC }, []), /selected complete body instance/u);
  assert.equal(produced(deps, program.tir, []).kind, "ok");
});

test("an already selected direct field read projects its actual in-place storage without copying the receiver", () => {
  const program = shaped("directField.read", [["box", "required", directBox]], T.bool,
    b => b.block(b.returns({ $: "read", ...b.property(b.id("box", 0, directBox), "flag", b.read(T.bool, directField)) })));
  const result = produced(deps, program.tir, []);
  assert.equal(result.kind, "ok");
  assert.deepEqual(verified(result.value, program), []);
  const mir = result.value;
  assert.equal(mir.locals.length, 1);
  assert.equal(mir.places.length, 2);
  assert.deepEqual(mir.blocks[0].statements, []);
  assert.deepEqual(mir.places[1].base, { kind: "place", place: 0, tir: { body: mir.body, node: program.at("read") },
    projection: { kind: "field", member: directField.decision } });
  assert.equal(mir.places[1].storage, T.bool);
  assert.deepEqual(mir.blocks[0].terminator.value, { kind: "place", place: 1 });
  for (let maximumRecords = 0; maximumRecords < 4; maximumRecords += 1)
    assert.equal(produced({ ...deps, limits: { maximumRecords } }, program.tir, []).kind, "refused");
  assert.equal(produced({ ...deps, limits: { maximumRecords: 4 } }, program.tir, []).kind, "ok");
});

test("an in-place field read snapshots only the field before a subsequent write to the same receiver", () => {
  const program = shaped("directField.ordered", [["box", "required", directBox], ["replacement", "required", directBox]],
    T.bool, b => b.block(b.returns(b.comparison(
      { $: "read", ...b.property(b.id("box", 0, directBox), "flag", b.read(T.bool, directField)) },
      "EqualsEqualsEqualsToken",
      b.sequence({ $: "overwrite", ...b.assign(b.target("box", 0, directBox), "EqualsToken",
        b.id("replacement", 1, directBox), directBox, directBox) }, b.keyword("TrueKeyword", T.bool), T.bool),
      native("===", "bool", [T.bool, T.bool], T.bool)))));
  const mir = lower(program);
  const statements = mir.blocks[0].statements;
  const snapshot = statements[1];
  assert.deepEqual(statements.map(statement => statement.kind === "assign" ? statement.value.kind : statement.kind),
    ["storage-live", "use", "use", "storage-live", "binary"]);
  assert.equal(snapshot.tir.node, program.at("read"));
  assert.equal(statements[2].tir.node, program.at("overwrite"));
  assert.equal(mir.places[snapshot.place].storage, T.bool);
  assert.equal(mir.places[snapshot.value.operand.place].base.projection.kind, "field");
  assert.deepEqual(statements[4].value.left, { kind: "place", place: snapshot.place });
});

test("a pending field read remains direct across a sibling write, but not across a possibly aliased caller write", () => {
  for (const mode of ["by-value", "byref-readwrite"]) {
    const program = shaped(`directField.sibling.${mode}`,
      [["box", "required", directBox, "byref-readwrite"], ["other", "required", directBox, mode],
        ["replacement", "required", directBox]], T.bool, b => b.block(b.returns(b.comparison(
        { $: "read", ...b.property(b.id("box", 0, directBox), "flag", b.read(T.bool, directField)) },
        "EqualsEqualsEqualsToken", b.sequence({ $: "write", ...b.assign(b.target("other", 1, directBox), "EqualsToken",
          b.id("replacement", 2, directBox), directBox, directBox) }, b.keyword("TrueKeyword", T.bool), T.bool),
        native("===", "bool", [T.bool, T.bool], T.bool)))));
    const mir = lower(program);
    const statements = mir.blocks[0].statements;
    const use = statements.find(statement => statement.kind === "assign" && statement.value.kind === "binary");
    const write = statements.findIndex(statement => statement.kind === "assign" && statement.tir.node === program.at("write"));
    const projection = mir.places.find(place => place.base.kind === "place" && place.base.projection.kind === "field");
    const reads = statements.filter(statement => statement.kind === "assign" && statement.tir.node === program.at("read"));
    if (mode === "by-value") {
      assert.deepEqual(reads, []);
      assert.deepEqual(use.value.left, { kind: "place", place: projection.id });
    } else {
      assert.equal(reads.length, 1);
      assert.equal(statements.indexOf(reads[0]) < write, true);
      assert.deepEqual(reads[0].value.operand, { kind: "place", place: projection.id });
      assert.deepEqual(use.value.left, { kind: "place", place: reads[0].place });
    }
  }
});

test("a read preceding a selected call saves the field exactly once only if the call may write its receiver", () => {
  for (const mode of ["byref-readonly", "byref-readwrite"]) {
    const name = `directField.effect.${mode}`;
    const target = `${name}.callee`;
    const sig = signature(target, [["box", directBox, "required", null, mode]], T.bool);
    const program = shaped(name, [["box", "required", directBox]], T.bool, b => b.block(b.returns(b.comparison(
      { $: "read", ...b.property(b.id("box", 0, directBox), "flag", b.read(T.bool, directField)) }, "EqualsEqualsEqualsToken",
      { $: "call", ...b.call(b.global(target, target, T.unknown), [{ $: "receiver", ...b.id("box", 0, directBox) }], T.bool,
        at => ({ callee: callee(target, sig, [mapped(0, 0, mode)], T.bool), receiver: null,
          arguments: [{ kind: "provided", parameter: 0, expression: at("receiver") }] })) },
      native("===", "bool", [T.bool, T.bool], T.bool)))));
    program.tir.locals[0].mutable = true;
    const mir = lower(program);
    const first = mir.blocks[0];
    assert.equal(first.terminator.kind, "call");
    assert.equal(first.terminator.tir.node, program.at("call"));
    const use = mir.blocks[first.terminator.next].statements.find(statement => statement.kind === "assign" && statement.value.kind === "binary");
    const projection = mir.places.find(place => place.base.kind === "place" && place.base.projection.kind === "field");
    const saved = first.statements.filter(statement => statement.kind === "assign" && statement.tir.node === program.at("read"));
    if (mode === "byref-readonly") {
      assert.deepEqual(saved, []);
      assert.deepEqual(use.value.left, { kind: "place", place: projection.id });
    } else {
      assert.equal(saved.length, 1);
      assert.deepEqual(saved[0].value.operand, { kind: "place", place: projection.id });
      assert.equal(mir.places[saved[0].place].storage, T.bool);
      assert.deepEqual(use.value.left, { kind: "place", place: saved[0].place });
    }
    const records = mir.locals.length + mir.places.length + mir.constants.length + mir.blocks.length
      + mir.blocks.reduce((total, block) => total + block.statements.length, 0);
    for (let maximumRecords = 0; maximumRecords < records; maximumRecords += 1) {
      const refused = produced({ ...deps, limits: { maximumRecords } }, program.tir, []);
      assert.equal(refused.kind, "refused");
      assert.equal(refused.diagnostics.length, 1);
    }
    assert.equal(produced({ ...deps, limits: { maximumRecords: records } }, program.tir, []).kind, "ok");
  }
});

test("direct field lowering does not replace a check or accessor selection", () => {
  const make = (name, build) => shaped(`directField.opposite.${name}`, [["box", "required", directBox]], T.bool,
    b => b.block(b.returns(build(b))));
  for (const [name, selected, message] of [
    ["checked", withFieldLocation({ kind: "data", check: { kind: "required", failure: "unwind" }, receiver: "in-place" }), /selected checked field read/],
    ["checked-reference", withFieldLocation({ kind: "data", check: { kind: "required", failure: "abort" }, receiver: "by-reference" }), /selected checked field read/],
    ["accessor", withFieldLocation({ kind: "accessor" }), /selected accessor invocation/],
    ["deferred", { kind: "deferred", deferred: null }, /deferred member read/],
  ]) {
    const program = make(name, b => b.property(b.id("box", 0, directBox), "flag", b.read(T.bool, selected)));
    assert.throws(() => produced(deps, program.tir, []), message);
  }
  const target = make("target", b => b.property(b.id("box", 0, directBox), "flag", b.write(directField, T.bool)));
  assert.throws(() => produced(deps, target.tir, []), /property access of role assignment-target/);
  const optional = make("optional", b => ({ ...b.property(b.id("box", 0, directBox), "flag", b.read(T.bool, directField)),
    questionDotToken: { kind: "QuestionDotToken", tsonic: null } }));
  assert.throws(() => produced(deps, optional.tir, []), /selected optional field read/);
  const crossed = make("crossed", b => b.property(b.id("box", 0, directBox), "flag", b.read(T.int32, directField)));
  assert.throws(() => produced(deps, crossed.tir, []), /field read inconsistent with its selected storage/);
  const noPlace = make("constant", b => b.property(b.keyword("TrueKeyword", T.bool), "flag", b.read(T.bool, directField)));
  assert.throws(() => produced(deps, noPlace.tir, []), /in-place field read requires an evaluated storage place/);
});

const staticResolution = name => ({ kind: "static", declaration: { owner: def(name), node: 0 }, aliases: [] });
const staticIdentifier = (name, storage, extra = {}) => ({ kind: "Identifier", text: name,
  tsonic: { ...value(storage), role: "value", resolution: staticResolution(name), ...extra } });
const selectedStaticField = (builder, receiver = staticIdentifier("Box", directBox), label = "field") =>
  ({ $: label, ...builder.property(receiver, "flag", builder.read(T.bool, directField)) });
const staticWrite = (builder, name, type, right, label) => ({ $: label, ...builder.assign({
  kind: "Identifier", text: name, tsonic: { role: "assignment-target", resolution: staticResolution(name), access: { kind: "write", storage: type } },
}, "EqualsToken", right, type, type) });
const compareBool = (builder, left, right) => builder.comparison(left, "EqualsEqualsEqualsToken", right,
  native("===", "bool", [T.bool, T.bool], T.bool));
const staticProjection = (mir, program, label = "field") => {
  const projection = mir.places.find(place => place.base.kind === "place" && place.base.tir.node === program.at(label));
  assert.equal(projection?.base.projection.kind, "field");
  assert.deepEqual(mir.places[projection.base.place].base, { kind: "static", definition: def("Box") });
  return projection.id;
};
const savedStaticField = (mir, program, block, label = "field") => {
  const saved = block.statements.filter(row => row.kind === "assign" && row.tir.node === program.at(label));
  assert.equal(saved.length, 1);
  assert.equal(mir.places[saved[0].place].storage, T.bool);
  assert.deepEqual(saved[0].value, { kind: "use", operand: { kind: "place", place: staticProjection(mir, program, label) } });
  return saved[0];
};
const lowerAtBounds = (program, records) => {
  const mir = lower(program);
  assert.equal(mir.locals.length + mir.places.length + mir.constants.length + mir.blocks.length
    + mir.blocks.reduce((total, block) => total + block.statements.length, 0), records);
  for (let maximumRecords = 0; maximumRecords < records; maximumRecords += 1) {
    const result = produced({ ...deps, limits: { maximumRecords } }, program.tir, []);
    assert.deepEqual([result.kind, "value" in result, result.diagnostics.map(row => row.code.name)],
      ["refused", false, ["TSONIC_COMPILER_RESOURCE_LIMIT"]], `maximumRecords=${maximumRecords}`);
  }
  assert.deepEqual(produced({ ...deps, limits: { maximumRecords: records } }, program.tir, []).value, mir);
  return mir;
};

test("a selected reference field keeps exactly one owned receiver value and its real field", () => {
  for (const [kind, rows, reads, receiver] of [
    ["local", [["box", "required", directBox, "byref-readwrite"]], 8, builder => builder.id("box", 0, directBox)],
    ["held", [], 7, () => staticIdentifier("Box", directBox)],
  ]) {
    const program = shaped(`referenceField.${kind}`, rows, T.bool, builder => builder.block(builder.returns(
      builder.property({ $: "receiver", ...receiver(builder) }, "flag", builder.read(T.bool, referenceField)))));
    const mir = lowerAtBounds(program, reads);
    const [entry] = mir.blocks;
    const [live, save] = entry.statements;
    assert.deepEqual(entry.statements.map(row => row.kind), ["storage-live", "assign"], kind);
    assert.equal(save.tir.node, program.at("receiver"), kind);
    assert.equal(live.tir.node, save.tir.node, kind);
    assert.deepEqual(mir.places[save.place].base, { kind: "local", local: live.local }, kind);
    assert.equal(mir.locals[live.local].role.kind, "temporary", kind);
    assert.equal(mir.places[save.place].storage, directBox, kind);
    assert.equal(mir.places[save.value.operand.place].base.kind, kind === "local" ? "local" : "static", kind);
    const projected = mir.places[entry.terminator.value.place];
    assert.equal(projected.base.place, save.place, kind);
    assert.equal(projected.base.projection.kind, "field", kind);
    assert.equal(projected.base.projection.member.decision.location.receiver, "by-reference", kind);
  }
});

test("a selected reference field reads before an intervening call despite a stable receiver slot", () => {
  const target = "referenceField.writer";
  const sig = signature(target, [["box", directBox, "required", null, "byref-readwrite"]], T.bool);
  const program = shaped("referenceField.call", [["box", "required", directBox, "byref-readwrite"]], T.bool,
    builder => builder.block(builder.returns(compareBool(builder,
      { $: "field", ...builder.property({ $: "receiver", ...builder.id("box", 0, directBox) }, "flag", builder.read(T.bool, referenceField)) },
      { $: "call", ...builder.call(builder.global(target, target, T.unknown),
        [{ $: "argument", ...builder.id("box", 0, directBox) }], T.bool,
        at => ({ callee: callee(target, sig, [mapped(0, 0, "byref-readwrite")], T.bool), receiver: null,
          arguments: [{ kind: "provided", parameter: 0, expression: at("argument") }] })) }))));
  program.tir.locals[0].mutable = true;
  const mir = lower(program);
  const [entry] = mir.blocks;
  const saves = entry.statements.filter(row => row.kind === "assign");
  assert.deepEqual(saves.map(save => save.tir.node), [program.at("receiver"), program.at("field")]);
  const [receiver, field] = saves;
  assert.equal(mir.places[field.value.operand.place].base.place, receiver.place);
  assert.equal(entry.terminator.kind, "call");
  assert.equal(entry.terminator.tir.node, program.at("call"));
  const comparison = mir.blocks[entry.terminator.next].statements.find(row => row.value?.kind === "binary");
  assert.deepEqual(comparison.value.left, { kind: "place", place: field.place });
});

test("selected static field: direct return and exact root writes preserve the authored value", () => {
  const read = shaped("staticField.return", [], T.bool, b => b.block(b.returns(selectedStaticField(b))));
  const directMir = lowerAtBounds(read, 3);
  const returned = staticProjection(directMir, read);
  assert.deepEqual(directMir.blocks[0].terminator.value, { kind: "place", place: returned });
  for (const [target, records] of [["Box", 16], ["Other", 13]]) {
    const program = shaped(`staticField.write.${target}`, [["replacement", "required", directBox], ["expected", "required", T.bool]],
      T.bool, b => b.block(b.returns(compareBool(b, selectedStaticField(b), b.sequence(
        staticWrite(b, target, directBox, b.id("replacement", 0, directBox), "write"), b.id("expected", 1, T.bool), T.bool)))));
    const mir = lowerAtBounds(program, records);
    const [entry] = mir.blocks;
    const fieldPlace = staticProjection(mir, program);
    const write = entry.statements.findIndex(row => row.tir.node === program.at("write") && row.kind === "assign");
    const comparison = entry.statements.find(row => row.value?.kind === "binary");
    assert.deepEqual(mir.places[entry.statements[write].place].base, { kind: "static", definition: def(target) });
    let expected = fieldPlace;
    if (target === "Box") {
      const saved = savedStaticField(mir, program, entry);
      assert.ok(entry.statements.indexOf(saved) < write);
      expected = saved.place;
    } else assert.equal(entry.statements.some(row => row.tir.node === program.at("field")), false);
    assert.deepEqual(comparison.value.left, { kind: "place", place: expected });
    assert.equal(mir.locals.some(row => row.role.kind === "temporary" && row.storage === directBox), false);
  }
  const later = shaped("staticField.laterRead", [["replacement", "required", directBox]], T.bool, b =>
    b.block(b.returns(compareBool(b, selectedStaticField(b), b.sequence(
      staticWrite(b, "Box", directBox, b.id("replacement", 0, directBox), "write"),
      selectedStaticField(b, staticIdentifier("Box", directBox), "later"), T.bool)))));
  const mir = lowerAtBounds(later, 15);
  const [entry] = mir.blocks;
  const earlier = savedStaticField(mir, later, entry);
  const laterPlace = staticProjection(mir, later, "later");
  const comparison = entry.statements.find(row => row.value?.kind === "binary");
  assert.notEqual(laterPlace, staticProjection(mir, later));
  assert.deepEqual([comparison.value.left, comparison.value.right],
    [{ kind: "place", place: earlier.place }, { kind: "place", place: laterPlace }]);
  assert.equal(entry.statements.some(row => row.tir.node === later.at("later")), false);
});

test("selected static field: no-write failure preserves the earlier read, not the check's own operand twice", () => {
  for (const [failure, unwind] of [["abort", "abort"], ["unwind", "escape"]]) {
    const name = `staticField.check.${failure}`;
    const program = shaped(name, [["optional", "required", optionalBool], ["expected", "required", T.bool]], T.bool,
      b => b.block(b.returns(compareBool(b, selectedStaticField(b), b.sequence(
        narrowingNode(b, name, b.nonNull(b.id("optional", 0, optionalBool), T.bool, null), optionalBool, T.bool, failure),
        b.id("expected", 1, T.bool), T.bool)))));
    const mir = lowerAtBounds(program, 17);
    const [entry, continuation] = mir.blocks;
    const saved = savedStaticField(mir, program, entry);
    assert.deepEqual([entry.terminator.kind, entry.terminator.tir.node, entry.terminator.unwind.kind, entry.terminator.next],
      ["check", program.at("narrowed"), unwind, continuation.id]);
    const checked = mir.places[entry.terminator.place];
    assert.deepEqual(mir.places[checked.base.place].base, { kind: "local", local: 0 });
    assert.deepEqual(entry.statements.filter(row => row.kind === "assign"), [saved]);
    assert.deepEqual(continuation.statements.find(row => row.value?.kind === "binary").value.left, { kind: "place", place: saved.place });
  }
});

test("selected static field: assignment store and yielded value share one read; discard keeps one direct use", () => {
  for (const [form, records] of [["return", 9], ["chained", 11], ["composed", 18], ["discard", 7]]) {
    const rows = form === "composed" ? [["replacement", "required", directBox], ["expected", "required", T.bool]]
      : form === "discard" ? [["expected", "required", T.bool]] : [];
    const program = shaped(`staticField.assigned.${form}`, rows, T.bool, b => {
      const store = staticWrite(b, "Slot", T.bool, selectedStaticField(b), "store");
      if (form === "return") return b.block(b.returns(store));
      if (form === "chained") return b.block(b.returns(staticWrite(b, "Second", T.bool, store, "outer")));
      if (form === "discard") return b.block(b.returns(b.sequence(store, b.id("expected", 0, T.bool), T.bool)));
      return b.block(b.returns(compareBool(b, store, b.sequence(staticWrite(b, "Box", directBox, b.id("replacement", 0, directBox), "replace"),
        b.id("expected", 1, T.bool), T.bool))));
    });
    const mir = lowerAtBounds(program, records);
    const [entry] = mir.blocks;
    const store = entry.statements.find(row => row.kind === "assign" && row.tir.node === program.at("store"));
    assert.deepEqual(mir.places[store.place].base, { kind: "static", definition: def("Slot") });
    if (form === "discard") {
      assert.deepEqual(store.value.operand, { kind: "place", place: staticProjection(mir, program) });
      assert.deepEqual(entry.statements.filter(row => row.kind === "assign"), [store]);
      continue;
    }
    const saved = savedStaticField(mir, program, entry);
    const operand = { kind: "place", place: saved.place };
    assert.ok(entry.statements.indexOf(saved) < entry.statements.indexOf(store));
    assert.deepEqual(store.value.operand, operand);
    if (form === "composed") {
      const replacement = entry.statements.findIndex(row => row.kind === "assign" && row.tir.node === program.at("replace"));
      const comparison = entry.statements.find(row => row.value?.kind === "binary");
      assert.ok(replacement > entry.statements.indexOf(store) && entry.statements.indexOf(comparison) > replacement);
      assert.deepEqual(comparison.value.left, operand);
    } else {
      assert.deepEqual(entry.terminator.value, operand);
      if (form === "chained") {
        const outer = entry.statements.find(row => row.kind === "assign" && row.tir.node === program.at("outer"));
        assert.ok(entry.statements.indexOf(outer) > entry.statements.indexOf(store));
        assert.deepEqual(outer.value.operand, operand);
      }
    }
  }
});

test("selected static field: a check consumes its own option once, with a save only if the checked value is needed again", () => {
  for (const [form, records] of [["return", 9], ["discard", 7]]) {
    const name = `staticField.checkOwn.${form}`;
    const program = shaped(name, form === "discard" ? [["expected", "required", T.bool]] : [], T.bool, b => {
      const source = { $: "field", ...b.property(staticIdentifier("Box", optionalFlagBox), "flag", b.read(optionalBool, optionalFlagField)) };
      const expression = b.nonNull(source, T.bool, null);
      const root = { kind: "item", value: { owner: def("Box"), node: 0 } };
      const path = [{ kind: "member", origin: fieldOrigin }];
      const proof = { steps: [{ from: { root, path }, to: { root, path: [...path, { kind: "optional-value" }] },
        rule: "absence", premises: [] }], conclusion: 0 };
      expression.tsonic.narrowing = { kind: "narrowed", source: optionalBool, result: T.bool, failure: "abort", proof };
      return b.block(b.returns(form === "return" ? expression : b.sequence(expression, b.id("expected", 0, T.bool), T.bool)));
    });
    const mir = lowerAtBounds(program, records);
    const [entry, continuation] = mir.blocks;
    const fieldPlace = staticProjection(mir, program);
    const check = entry.terminator;
    assert.equal(check.kind, "check");
    if (form === "discard") {
      assert.deepEqual(entry.statements, []);
      assert.equal(mir.places[check.place].base.place, fieldPlace);
    } else {
      const saved = entry.statements.find(row => row.kind === "assign");
      assert.equal(saved.tir.node, program.at("field"));
      assert.equal(mir.places[saved.place].storage, optionalBool);
      assert.deepEqual(saved.value.operand, { kind: "place", place: fieldPlace });
      assert.equal(mir.places[check.place].base.place, saved.place);
      assert.deepEqual(continuation.terminator.value, { kind: "place", place: check.place });
    }
  }
});

test("selected static field: unknown application preserves outer observation, not its own field argument twice", () => {
  const target = "staticField.call.target";
  const sig = signature(target, [["flag", T.bool]], T.bool);
  const program = shaped("staticField.call", [], T.bool, b => b.block(b.returns(compareBool(b, selectedStaticField(b),
    b.call(b.global(target, target, T.unknown), [selectedStaticField(b, staticIdentifier("Box", directBox), "argument")],
      T.bool, at => ({ callee: callee(target, sig, [mapped(0, 0)], T.bool), receiver: null,
        arguments: [{ kind: "provided", parameter: 0, expression: at("argument") }] }))))));
  const mir = lowerAtBounds(program, 16);
  const [entry, continuation] = mir.blocks;
  const saved = savedStaticField(mir, program, entry);
  assert.deepEqual([entry.terminator.kind, entry.terminator.unwind.kind], ["call", "escape"]);
  assert.deepEqual(entry.terminator.arguments, [{ kind: "value", passing: "by-value",
    operand: { kind: "place", place: staticProjection(mir, program, "argument") } }]);
  assert.deepEqual(entry.statements.filter(row => row.kind === "assign"), [saved]);
  assert.deepEqual(continuation.statements.find(row => row.value?.kind === "binary").value.left, { kind: "place", place: saved.place });
});

test("selected static field: readonly normal-only invocation is not an observation barrier", () => {
  for (const [execution, save] of [[EXECUTIONS.cannotFail, false], [EXECUTIONS.unwinds, true], [EXECUTIONS.endsProcess, true]]) {
    const program = shaped(`staticField.invoke.${execution.failure}`,
      [["number", "required", T.int32], ["expected", "required", T.bool]], T.bool, b => b.block(b.returns(compareBool(b,
        selectedStaticField(b), b.sequence(b.arithmetic(b.id("number", 0, T.int32), "PlusToken", b.num("1", T.int32), T.int32,
          plus("int32", T.int32, execution)), b.id("expected", 1, T.bool), T.bool)))));
    const mir = lowerAtBounds(program, save ? 20 : 16);
    const [entry, continuation] = mir.blocks;
    assert.equal(entry.terminator.kind, "invoke");
    assert.equal(entry.terminator.operation.decision.execution.writesStorage, false);
    const place = save ? savedStaticField(mir, program, entry).place : staticProjection(mir, program);
    if (!save) assert.equal(entry.statements.some(row => row.kind === "assign"), false);
    assert.deepEqual(continuation.statements.find(row => row.value?.kind === "binary").value.left, { kind: "place", place });
  }
});

test("selected static field: ordinary receiver evaluation remains for aliases, wrappers and narrowing", () => {
  const aliases = [{ kind: "item", value: { owner: def("importedBox"), node: 0 } }];
  for (const [name, receiver] of [
    ["alias", () => staticIdentifier("Box", directBox, { resolution: { ...staticResolution("Box"), aliases } })],
    ["wrapper", b => b.paren(staticIdentifier("Box", directBox), directBox)],
    ["narrowing", () => staticIdentifier("Box", directBox, { narrowing: { kind: "identity", type: directBox } })],
  ]) {
    const program = shaped(`staticField.receiver.${name}`, [], T.bool,
      b => b.block(b.returns(selectedStaticField(b, receiver(b)))));
    const mir = lowerAtBounds(program, 7);
    const fieldPlace = mir.places.find(place => place.base.projection?.kind === "field");
    const copy = mir.blocks[0].statements.find(row => row.kind === "assign");
    assert.equal(fieldPlace.base.place, copy.place);
    assert.equal(mir.places[copy.place].storage, directBox);
    assert.deepEqual(mir.places[copy.value.operand.place].base, { kind: "static", definition: def("Box") });
  }
  const rejected = (name, change) => shaped(`staticField.rejected.${name}`, [], T.bool, b => {
    const field = selectedStaticField(b);
    change(field);
    return b.block(b.returns(field));
  });
  assert.throws(() => produced(deps, rejected("optional", field => {
    field.questionDotToken = { kind: "QuestionDotToken", tsonic: null };
  }).tir, []), /selected optional field read/u);
  assert.throws(() => produced(deps, rejected("checked", field => {
    const { decision } = directField.decision;
    field.tsonic.selection = { kind: "decided", decision: { ...directField.decision,
      decision: { ...decision, location: { kind: "data", receiver: "in-place", check: { kind: "required", failure: "abort" } } } } };
  }).tir, []), /selected checked field read/u);
  assert.throws(() => produced(deps, rejected("selection", field => {
    field.expression.tsonic.demand = { kind: "never" };
  }).tir, []), /value demanded under a selection/u);
  assert.throws(() => produced(deps, rejected("conversion", field => {
    field.expression.tsonic.conversion = { kind: "deferred" };
  }).tir, []), /deferred conversion/u);
});

test("selected static field: a further projection consumes the selected inner value at its own read anchor", () => {
  const program = shaped("staticField.nested", [], T.bool, builder => {
    const inner = { $: "inner", ...builder.property(staticIdentifier("NestedBox", nestedBox), "inner", builder.read(directBox, nestedField)) };
    return builder.block(builder.returns(selectedStaticField(builder, inner)));
  });
  const mir = lowerAtBounds(program, 8);
  const [entry] = mir.blocks;
  const [saved] = entry.statements.filter(row => row.kind === "assign");
  assert.equal(saved.tir.node, program.at("inner"));
  const inner = mir.places[saved.value.operand.place];
  assert.equal(inner.base.tir.node, program.at("inner"));
  assert.deepEqual(mir.places[inner.base.place].base, { kind: "static", definition: def("NestedBox") });
  assert.equal(mir.places[saved.place].storage, directBox);
  const flagPlace = mir.places[entry.terminator.value.place];
  assert.equal(flagPlace.base.tir.node, program.at("field"));
  assert.equal(flagPlace.base.place, saved.place);
  assert.equal(mir.locals.some(local => local.storage === nestedBox), false);
});

test("first producer: the receiver's row and a body that completes with no value", () => {
  // The row of role `this` is the local of role `receiver`; the other rows are counted without it (parameter-source-exact).
  const method = shaped("first.method", [["self", "this", T.counter], ["a", "required", T.int32]], T.int32,
    b => b.block(b.returns(b.id("a", 1, T.int32))), { receiver: T.counter });
  let mir = lower(method);
  assert.deepEqual(mir.locals.map(local => [local.role, local.source.local]), [[{ kind: "receiver" }, 0], [{ kind: "parameter", index: 0 }, 1]]);
  assert.deepEqual(mir.entries, [{ provided: 1, block: 0 }]);
  assert.deepEqual(mir.blocks[0].terminator.value, { kind: "place", place: 0 });
  // The end of a body that completes with no value is a return with no value, at the body's node.
  const empty = shaped("first.empty", [["a", "required", T.int32]], T.void, b => b.block());
  mir = lower(empty);
  assert.deepEqual(mir.blocks.map(block => [block.statements, block.terminator.kind, block.terminator.value, block.terminator.tir.node]), [[[], "return", null, 0]]);
  const bare = shaped("first.bare", [], T.void, b => b.block({ $: "return", ...b.returns(null) }));
  mir = lower(bare);
  assert.deepEqual([mir.blocks[0].terminator.value, mir.blocks[0].terminator.tir.node, mir.entries], [null, bare.at("return"), [{ provided: 0, block: 0 }]]);
  // What follows a return in its statement list is on no path: it is not lowered and makes no record.
  const twice = nested("first.twice", T.int32, ({ leaf }) => leaf("a"), { statements: ({ b, leaf }, tree) => [b.returns(tree), b.returns(leaf("b"))] });
  mir = lower(twice);
  assert.deepEqual([mir.blocks.length, mir.places.length, mir.blocks[0].terminator.value], [1, 1, { kind: "place", place: 0 }]);
});

test("first producer: below the size of its graph a body is refused with one diagnostic at its origin; at that size it is lowered", () => {
  // `add`: 3 locals and 3 places in both forms; 2 statements and 1 block as a statement, 1 statement and 2 blocks as a
  // control point: 9 records.
  for (const execution of ["pure", "unwinds"]) {
    const program = add(`first.add.float64.${execution}`, T.float64, plus("float64", T.float64, EXECUTIONS[execution]));
    const attempt = maximumRecords => produced({ ...deps, limits: { maximumRecords } }, program.tir, []);
    for (let maximumRecords = 0; maximumRecords < 9; maximumRecords += 1) {
      const refused = attempt(maximumRecords);
      assert.equal(refused.kind, "refused", `limit ${maximumRecords}`);
      assert.equal("value" in refused, false);
      assert.deepEqual(refused.diagnostics.map(diagnostic => [diagnostic.code.rendered, diagnostic.severity, diagnostic.site, diagnostic.source, diagnostic.arguments]),
        [["TSONIC_COMPILER_RESOURCE_LIMIT", "error", { kind: "source", origin: originOf(0) }, "lower-mir",
          [{ kind: "text", value: "lower-mir.maximumRecords" }, { kind: "number", value: maximumRecords }]]]);
      assert.deepEqual(refused.diagnostics[0].evidence.slice(0, 2), ["lower-mir.maximumRecords", "mirBody"]);
    }
    const lowered = attempt(9);
    assert.equal(lowered.kind, "ok");
    assert.deepEqual(lowered.value, lower(program));
  }
  // Every other shape: the count of records of its graph is the smallest limit that admits it, and every smaller
  // limit refuses, whichever record the limit falls on (a saved operand, a temporary, a control point's next block).
  const size = mir => mir.locals.length + mir.places.length + mir.constants.length + mir.blocks.length
    + mir.blocks.reduce((total, block) => total + block.statements.length, 0);
  const writes = execution => ({ leaf, sum, group }) =>
    sum("outer", leaf("a"), group(sum("inner", leaf("b"), leaf("b"), plus("int32", T.int32, execution))), plus("int32", T.int32));
  for (const program of [nested("first.saved", T.int32, writes(EXECUTIONS.writes), { passing: ["byref-readwrite", "by-value"] }), waitingTemporary(),
    nested("first.private", T.int32, writes(EXECUTIONS.writes)),
    shaped("first.method", [["self", "this", T.counter], ["a", "required", T.int32]], T.int32, b => b.block(b.returns(b.id("a", 1, T.int32))), { receiver: T.counter })]) {
    const records = size(lower(program));
    for (let maximumRecords = 0; maximumRecords < records; maximumRecords += 1)
      assert.equal(produced({ ...deps, limits: { maximumRecords } }, program.tir, []).kind, "refused", `${program.tir.body} under ${maximumRecords}`);
    assert.equal(produced({ ...deps, limits: { maximumRecords: records } }, program.tir, []).kind, "ok");
  }
});

/** (a + b) + (b (+) b) with `a` by reference and (+) writing existing storage: the operand waiting at (+) is a temporary. */
const waitingTemporary = () => nested("first.waiting", T.int32, ({ leaf, sum, group }) => sum("outer", group(sum("first", leaf("a"), leaf("b"), plus("int32", T.int32))),
  group(sum("second", leaf("b"), leaf("b"), plus("int32", T.int32, EXECUTIONS.writes))), plus("int32", T.int32)), { passing: ["byref-readwrite", "by-value"] });

test("first producer: what a control point that writes cannot change is not saved: a temporary, and a parameter that is moved", () => {
  // The waiting operand is the temporary of (a + b): it is written by its one record and is not saved.
  let mir = lower(waitingTemporary());
  assert.deepEqual(mir.blocks.map(block => [...block.statements.map(record => record.kind), block.terminator.kind]),
    [["storage-live", "assign", "storage-live", "invoke"], ["storage-live", "assign", "return"]]);
  assert.deepEqual(mir.blocks[1].statements[1].value.left, { kind: "place", place: 2 });
  // A parameter that is moved is the body's own cell, as one passed by value.
  mir = lower(nested("first.moved", T.int32, ({ leaf, sum, group }) => sum("outer", leaf("a"), group(sum("inner", leaf("b"), leaf("b"),
    plus("int32", T.int32, EXECUTIONS.writes))), plus("int32", T.int32)), { passing: ["move", "by-value"] }));
  assert.deepEqual(mir.blocks[0].statements.map(record => record.kind), ["storage-live"]);
  assert.deepEqual(mir.blocks[1].statements[1].value.left, { kind: "place", place: 0 });
});

test("first producer: each exposed read is saved once, distinct reads of one local each, and a saved read never again (K-3352)", () => {
  const W = plus("int32", T.int32, EXECUTIONS.writes);
  const P = plus("int32", T.int32);
  const byReference = { passing: ["byref-readwrite", "by-value"] };
  const saves = mir => mir.blocks.flatMap(block => block.statements).filter(record => record.kind === "assign" && record.value.kind === "use");
  // a + ((b (+w) b) (+w) b): a is saved at the first writing control point and is not saved again at the second.
  let mir = lower(nested("k3352.once", T.int32, ({ leaf, sum, group }) =>
    sum("outer", leaf("a"), group(sum("second", group(sum("first", leaf("b"), leaf("b"), W)), leaf("b"), W)), P), byReference));
  assert.deepEqual(saves(mir).map(record => record.value.operand), [{ kind: "place", place: 0 }]);
  // a + (a + (b (+w) b)): two reads of a wait; each is saved, as its own value.
  mir = lower(nested("k3352.distinct", T.int32, ({ leaf, sum, group }) =>
    sum("outer", leaf("a"), group(sum("middle", leaf("a"), group(sum("inner", leaf("b"), leaf("b"), W)), P)), P), byReference));
  const distinct = saves(mir);
  assert.deepEqual(distinct.map(record => record.value.operand), [{ kind: "place", place: 0 }, { kind: "place", place: 0 }]);
  assert.notEqual(distinct[0].place, distinct[1].place);
  // b + (a + (b (+w) b)), a by reference and b by value: only the read of a is saved (mixed).
  mir = lower(nested("k3352.mixed", T.int32, ({ leaf, sum, group }) =>
    sum("outer", leaf("b"), group(sum("middle", leaf("a"), group(sum("inner", leaf("b"), leaf("b"), W)), P)), P), byReference));
  assert.deepEqual(saves(mir).map(record => record.value.operand), [{ kind: "place", place: 1 }]);
  // A read of a consumed before the writing control point is not exposed any more: (a + b) + (b (+w) b) saves nothing.
  mir = lower(nested("k3352.consumed", T.int32, ({ leaf, sum, group }) =>
    sum("outer", group(sum("first", leaf("a"), leaf("b"), P)), group(sum("second", leaf("b"), leaf("b"), W)), P), byReference));
  assert.deepEqual(saves(mir), []);
});

const conditional = (condition, whenTrue, whenFalse, type, disposition = "dynamic", tag = "choice") => {
  const arm = (node, when, label) => ({ ...node, $: `${tag}.${label}`, tsonic: at => ({
    ...(typeof node.tsonic === "function" ? node.tsonic(at) : node.tsonic),
    demand: disposition === "dynamic" ? { kind: "selected", control: at(`${tag}.control`), when }
      : disposition === when ? { kind: "always" } : { kind: "never", control: at(`${tag}.control`) },
  }) });
  return { $: tag, kind: "ConditionalExpression", condition: { ...condition, $: `${tag}.control` },
    questionToken: { kind: "QuestionToken", tsonic: null }, whenTrue: arm(whenTrue, "true", "yes"),
    colonToken: { kind: "ColonToken", tsonic: null }, whenFalse: arm(whenFalse, "false", "no"),
    tsonic: at => ({ ...value(type), selection: { kind: "conditional", control: at(`${tag}.control`),
      whenTrue: at(`${tag}.yes`), whenFalse: at(`${tag}.no`), disposition } }) };
};

const exactLowerBudget = (program, mir) => {
  const required = mir.locals.length + mir.places.length + mir.constants.length + mir.blocks.length
    + mir.blocks.reduce((total, block) => total + block.statements.length, 0);
  for (let maximumRecords = 0; maximumRecords < required; maximumRecords += 1)
    assert.equal(produced({ ...deps, limits: { maximumRecords } }, program.tir, []).kind, "refused", `under ${maximumRecords}/${required}`);
  assert.deepEqual(produced({ ...deps, limits: { maximumRecords: required } }, program.tir, []).value, mir);
};

test("selected static field: a possible failure in a later arm saves an earlier read at the branch dominator", () => {
  const name = "staticField.checkInArm";
  const program = shaped(name, [["maybe", "required", optionalBool], ["flag", "required", T.bool], ["expected", "required", T.bool]],
    T.bool, b => b.block(b.returns(compareBool(b, selectedStaticField(b), conditional(b.id("flag", 1, T.bool),
      b.sequence(narrowingNode(b, name, b.nonNull(b.id("maybe", 0, optionalBool), T.bool, null), optionalBool, T.bool, "unwind"),
        b.id("expected", 2, T.bool), T.bool), b.id("expected", 2, T.bool), T.bool)))));
  const mir = lower(program);
  exactLowerBudget(program, mir);
  const [head] = mir.blocks;
  const saved = savedStaticField(mir, program, head);
  assert.equal(head.terminator.kind, "switch");
  const checking = mir.blocks[head.terminator.targets[0].target];
  assert.equal(checking.terminator.kind, "check");
  assert.deepEqual(checking.terminator.unwind, { kind: "escape" });
  assert.equal(mir.blocks[head.terminator.otherwise].terminator.kind, "goto");
  assert.equal(mir.blocks.slice(1).some(block => block.statements.some(row => row.tir.node === program.at("field"))), false);
  const compare = mir.blocks.flatMap(block => block.statements).find(row => row.value?.kind === "binary");
  assert.deepEqual(compare.value.left, { kind: "place", place: saved.place });
});

test("a local update reads one direct place, stores on the normal edge and returns its authored old or new value", () => {
  const type = T.int32;
  for (const postfix of [false, true]) for (const failure of [false, true]) for (const wrapped of [false, true]) {
    const operation = selected({ kind: "native-operator", operator: postfix ? "--" : "++", carrier: "int32" }, [type], type,
      failure ? { kind: "invocation", writesStorage: false, failure: "abort" } : { kind: "pure" });
    const program = shaped(`update.local.${postfix}.${failure}.${wrapped}`, [["value", "required", type]], type, builder => {
      const leaf = { $: "leaf", ...builder.target("value", 0, type,
        { kind: "read-write", storage: type, read: type, narrowing: null, evidenceIndex: null }) };
      const target = wrapped ? { $: "outer", ...builder.paren({ $: "inner", ...builder.paren(leaf, type) }, type) } : leaf;
      const update = builder.prefix(target, postfix ? "MinusMinusToken" : "PlusPlusToken", type, operation);
      return { ...update, kind: postfix ? "PostfixUnaryExpression" : update.kind,
        tsonic: postfix ? { ...value(type), operation: update.tsonic.operation, storage: type }
          : { ...update.tsonic, role: "update", storage: type } };
    });
    const graph = lower(program);
    const entry = graph.blocks[0];
    const local = graph.places.find(place => place.base.kind === "local" && place.base.local === sourceLocal(graph, 0)).id;
    const old = entry.statements.find(row => row.kind === "assign" && row.value.kind === "use");
    const unary = failure ? entry.terminator : entry.statements.find(row => row.kind === "assign" && row.value.kind === "unary");
    const read = failure ? unary.operands[0] : unary.value.operand;
    const result = failure ? unary.destination : unary.place;
    const successor = failure ? graph.blocks[unary.next] : entry;
    if (failure) assert.deepEqual(entry.terminator.unwind, { kind: "abort" });
    if (postfix) assert.deepEqual(old.value.operand, { kind: "place", place: local });
    assert.deepEqual(read, { kind: "place", place: postfix ? old.place : local });
    const stores = graph.blocks.flatMap(row => row.statements.filter(statement => statement.kind === "assign" && statement.place === local));
    assert.equal(stores.length, 1);
    assert.equal(successor.statements.includes(stores[0]), true);
    assert.deepEqual(stores[0].value.operand, { kind: "place", place: result });
    assert.deepEqual(successor.terminator.value, { kind: "place", place: postfix ? old.place : result });
    if (wrapped) {
      const effects = graph.blocks.flatMap(block => [...block.statements, block.terminator]);
      assert.equal(effects.some(record => record.tir.node === program.at("outer") || record.tir.node === program.at("inner")), false);
      if (postfix) assert.equal(old.tir.node, program.at("leaf"));
      for (const alteration of ["conversion", "narrowing"]) {
        const invalid = structuredClone(program.tir);
        const inner = invalid.root.operand.expression;
        if (alteration === "conversion") inner.tsonic.conversion = { kind: "deferred", deferred: null };
        else inner.tsonic.narrowing = { kind: "narrowed", source: type, result: type, failure: "abort", proof: { steps: [], conclusion: 0 } };
        assert.throws(() => produced(deps, invalid, []), error => defectOfLowerMir(error)
          && error.message === `${CALLER_DEFECT}an assignment target has a value conversion or narrowing`);
      }
    }
    exactLowerBudget(program, graph);
    const leafOf = update => wrapped ? update.operand.expression.expression : update.operand;
    const forged = structuredClone(program.tir);
    leafOf(forged.root).tsonic.access = { kind: "write", storage: type };
    assert.throws(() => produced(deps, forged, []), error => defectOfLowerMir(error)
      && error.message === `${CALLER_DEFECT}an update without a selected direct read-write root`);
    const foreign = structuredClone(program.tir);
    leafOf(foreign.root).tsonic.resolution.local = { body: bodyId("update.foreign"), local: 0 };
    assert.throws(() => produced(deps, foreign, []), /update local not placed/u);
  }
});

const shortCircuit = (b, kind, left, right, type, disposition = "dynamic", tag = "logical") => b.binary(
  { ...left, $: `${tag}.control` }, kind === "and" ? "AmpersandAmpersandToken" : kind === "or" ? "BarBarToken" : "QuestionQuestionToken",
  { ...right, $: `${tag}.right`, tsonic: at => ({ ...(typeof right.tsonic === "function" ? right.tsonic(at) : right.tsonic),
    demand: disposition === "left" ? { kind: "never", control: at(`${tag}.control`) }
      : disposition === "right" ? { kind: "always" } : { kind: "selected", control: at(`${tag}.control`),
        when: kind === "and" ? "true" : kind === "or" ? "false" : "absent" },
  }) }, at => ({ ...value(type), role: "short-circuit", selection: { kind, control: at(`${tag}.control`),
    right: at(`${tag}.right`), disposition } }));

test("native boolean and/or and optional absence select exactly their authored short-circuit path", () => {
  for (const kind of ["and", "or", "coalesce"]) {
    const storage = kind === "coalesce" ? optionalBool : T.bool;
    const program = shaped(`logical.dynamic.${kind}`, [["left", "required", storage], ["right", "required", storage]], storage,
      b => shortCircuit(b, kind, b.id("left", 0, storage), b.id("right", 1, storage), storage));
    const mir = lower(program);
    assert.deepEqual(mir.blocks.map(block => block.terminator.kind), ["switch", "goto", "return"]);
    assert.equal(mir.locals.filter(local => local.role.kind === "temporary").length, 1);
    for (const input of kind === "coalesce" ? [null, true] : [true, false]) {
      const readsRight = kind === "and" ? input : kind === "or" ? !input : input === null;
      const path = walk(mir, { decide: () => input });
      const assignments = path.events.filter(event => event.record.kind === "assign");
      assert.equal(assignments.length, readsRight ? 2 : 1);
      assert.equal(rootLocalOf(mir, assignments[0].record.value.operand.place), sourceLocal(mir, 0));
      assert.equal(assignments[0].node, program.at("logical.control"));
      assert.deepEqual(mir.blocks[0].terminator.operand, { kind: "place", place: assignments[0].record.place });
      if (readsRight) assert.equal(rootLocalOf(mir, assignments[1].record.value.operand.place), sourceLocal(mir, 1));
      assert.equal(assignments.every(event => event.record.place === mir.blocks.at(-1).terminator.value.place), true);
      const rightBlock = mir.blocks.find(block => block.tir.node === program.at("logical.right"));
      assert.equal(path.events.some(event => event.block === rightBlock.id), readsRight);
    }
    exactLowerBudget(program, mir);
  }
});

test("discarded short-circuit values preserve only the guard, demanded reads, and stores", () => {
  for (const kind of ["and", "or", "coalesce"]) for (const effect of ["read", "write", "conditional-write"]) {
    const storage = kind === "coalesce" ? optionalBool : T.bool;
    const writesConditionally = effect === "conditional-write";
    const program = shaped(`logical.discard.${kind}.${effect}`, [["left", "required", storage], ["right", "required", storage]], storage, b => {
      const access = { kind: "read-write", storage, read: storage, evidenceIndex: null, narrowing: null };
      const right = b.id("right", 1, storage);
      const left = writesConditionally ? b.target("left", 0, storage, access) : b.id("left", 0, storage);
      const selected = shortCircuit(b, kind, left, effect === "write"
        ? b.assign(b.target("left", 0, storage), "EqualsToken", right, storage, storage) : right, storage);
      const expression = !writesConditionally ? selected : { ...selected, operatorToken: { ...selected.operatorToken,
        kind: kind === "and" ? "AmpersandAmpersandEqualsToken" : kind === "or" ? "BarBarEqualsToken" : "QuestionQuestionEqualsToken" },
        tsonic: at => ({ ...selected.tsonic(at), role: "assignment", storage, calculation: null }) };
      return b.block(b.expressionStatement(expression), b.returns(b.id("left", 0, storage)));
    });
    const mir = lower(program);
    assert.deepEqual(mir.blocks.map(block => block.terminator.kind), ["switch", "goto", "return"]);
    assert.equal(mir.locals.filter(local => local.role.kind === "temporary").length, effect === "write" ? 0 : 1);
    assert.equal(mir.blocks[0].terminator.tir.node === program.at("logical.control"), !writesConditionally);
    for (const input of kind === "coalesce" ? [null, true] : [true, false]) {
      const taken = kind === "and" ? input : kind === "or" ? !input : input === null;
      const events = walk(mir, { decide: () => input }).events;
      const assigns = events.filter(event => event.record.kind === "assign");
      const writes = assigns.filter(event => rootLocalOf(mir, event.record.place) === sourceLocal(mir, 0));
      assert.equal(assigns.length, Number(taken) + Number(writesConditionally));
      assert.equal(writes.length, taken && effect !== "read" ? 1 : 0);
      if (effect === "read" && taken) assert.equal(assigns[0].node, program.at("logical.right"));
    }
    exactLowerBudget(program, mir);
  }
});

test("static short-circuit disposition and actual literal boolean/absence evidence do not visit a dead right arm", () => {
  for (const kind of ["and", "or", "coalesce"]) {
    for (const disposition of ["left", "right", "dynamic"]) {
      for (const known of [true, false]) {
        if (kind === "coalesce" && (disposition === "dynamic" ? !known : false)) continue;
        const readRight = disposition === "right" || disposition === "dynamic" && (kind === "coalesce" || known === (kind === "and"));
        const result = disposition === "dynamic" && !readRight ? known ? literalTrue : literalFalse : T.bool;
        const program = shaped(`logical.static.${kind}.${disposition}.${known}`, [], result, b => shortCircuit(b, kind,
          kind === "coalesce" && readRight ? b.keyword("NullKeyword", T.absence)
            : b.keyword(known ? "TrueKeyword" : "FalseKeyword", disposition === "dynamic" ? known ? literalTrue : literalFalse : T.bool),
          b.keyword(result === literalFalse ? "FalseKeyword" : "TrueKeyword", result), result, disposition));
        const right = program.tir.root.right;
        const descriptor = Object.getOwnPropertyDescriptor(right, "tsonic");
        if (!readRight) Object.defineProperty(right, "tsonic", { configurable: true, get() { throw new Error("dead logical arm read"); } });
        const output = produced(deps, program.tir, []);
        if (!readRight) Object.defineProperty(right, "tsonic", descriptor);
        assert.equal(output.kind, "ok");
        assert.deepEqual(verified(output.value, program), []);
        assert.equal(output.value.blocks.length, 1);
        assert.equal(output.value.locals.length, 0);
        exactLowerBudget(program, output.value);
      }
    }
  }
});

test("selected short-circuit effects preserve pre-split pending reads once and never run on the retained-left path", () => {
  for (const kind of ["and", "or"]) {
    const program = shaped(`logical.snapshot.${kind}`, [["left", "required", T.bool], ["x", "required", T.bool]], T.bool, b =>
      b.comparison({ $: "original", ...b.id("x", 1, T.bool) }, "EqualsEqualsEqualsToken", shortCircuit(b, kind,
        b.id("left", 0, T.bool), b.assign(b.target("x", 1, T.bool), "EqualsToken", b.keyword("FalseKeyword", T.bool), T.bool, T.bool), T.bool),
      native("===", "bool", [T.bool, T.bool], T.bool)));
    const mir = lower(program);
    const copies = mir.blocks[0].statements.filter(record => record.kind === "assign" && record.tir.node === program.at("original"));
    assert.equal(copies.length, 1);
    for (const flag of [true, false]) {
      const path = walk(mir, { decide: () => flag });
      const writes = path.events.filter(event => event.record.kind === "assign"
        && event.record.place === mir.places.find(place => place.base.kind === "local" && place.base.local === sourceLocal(mir, 1)).id);
      assert.equal(writes.length, flag === (kind === "and") ? 1 : 0);
    }
    exactLowerBudget(program, mir);
  }
});

test("conditional assignment schedules the actual store only on the selected RHS path and uses the same graph budget", () => {
  for (const kind of ["and", "or"]) for (const disposition of ["dynamic", "left", "right"]) {
    const program = shaped(`logical.write.${kind}.${disposition}`, [["left", "required", T.bool], ["right", "required", T.bool]], T.bool, builder => {
      const access = { kind: "read-write", storage: T.bool, read: T.bool, evidenceIndex: null, narrowing: null };
      const node = shortCircuit(builder, kind, builder.target("left", 0, T.bool, access), builder.id("right", 1, T.bool), T.bool, disposition);
      return { ...node, operatorToken: { ...node.operatorToken, kind: kind === "and" ? "AmpersandAmpersandEqualsToken" : "BarBarEqualsToken" },
        tsonic: at => ({ ...node.tsonic(at), role: "assignment", storage: T.bool, calculation: null }) };
    });
    const graph = lower(program);
    for (const control of [true, false]) {
      const taken = disposition === "right" || disposition === "dynamic" && control === (kind === "and");
      const path = walk(graph, { decide: () => control });
      const assignments = path.events.filter(event => event.record.kind === "assign");
      const target = sourceLocal(graph, 0);
      assert.equal(assignments.filter(event => rootLocalOf(graph, event.record.place) === target).length, taken ? 1 : 0);
      const controlCopies = assignments.filter(event => event.node === program.at("logical.control") && event.record.value.kind === "use");
      assert.equal(controlCopies.filter(event => event.record.value.operand.kind === "place"
        && rootLocalOf(graph, event.record.value.operand.place) === target).length, 1, "the original control storage is read once");
      assert.equal(controlCopies.length, 1, "the already evaluated control generates no second source read");
      const forwards = assignments.filter(event => event.node === program.tir.root.id && event.record.value.kind === "use"
        && event.record.value.operand.kind === "place" && event.record.value.operand.place === controlCopies[0].record.place);
      assert.equal(forwards.length, disposition === "dynamic" && !taken ? 1 : 0,
        "only the retained-left edge forwards the saved control as the selected result");
    }
    exactLowerBudget(program, graph);
    const missing = structuredClone(program.tir);
    missing.root.tsonic.selection = null;
    assert.throws(() => produced(deps, missing, []), error => defectOfLowerMir(error)
      && error.message === `${CALLER_DEFECT}a conditional assignment differs from its actual selected control`);
  }
});

test("short-circuit inputs keep actual selected endpoints, boolean/absence carrier and result-view frontiers", () => {
  const make = (tag, kind = "and") => shaped(`logical.invalid.${tag}`, [["x", "required", T.bool], ["y", "required", T.bool]], T.bool,
    b => shortCircuit(b, kind, b.id("x", 0, T.bool), b.id("y", 1, T.bool), T.bool));
  for (const field of ["kind", "control", "right"]) {
    const program = make(field);
    program.tir.root.tsonic.selection[field] = field === "kind" ? "conditional" : -1;
    assert.throws(() => produced(deps, program.tir, []), error => defectOfLowerMir(error) && error.message.includes("actual operands"));
  }
  const unknownToken = make("token");
  unknownToken.tir.root.operatorToken.kind = "PlusToken";
  assert.throws(() => produced(deps, unknownToken.tir, []), error => defectOfLowerMir(error) && error.message.includes("actual operands"));
  const nonbool = make("nonbool");
  nonbool.tir.root.left.tsonic.type = T.string;
  assert.throws(() => produced(deps, nonbool.tir, []), notLoweredYet("a condition without a selected boolean conversion"));
  const unknownAbsence = make("absence", "coalesce");
  assert.throws(() => produced(deps, unknownAbsence.tir, []), notLoweredYet("a coalescing selector without its selected absence carrier"));
  for (const disposition of ["left", "dynamic"]) {
    const changed = make(`result.${disposition}`);
    changed.tir.root.tsonic.type = T.uint32;
    changed.tir.root.tsonic.selection.disposition = disposition;
    assert.throws(() => produced(deps, changed.tir, []), notLoweredYet("a selected result storage embedding"));
  }
  const wrongRight = make("right-storage");
  wrongRight.tir.root.right.tsonic.type = T.uint32;
  assert.throws(() => produced(deps, wrongRight.tir, []), error => defectOfLowerMir(error) && error.message.includes("result storage"));
});

test("selected conditional arms execute once on their actual edge and share one written result", () => {
  const program = shaped("conditional.dynamic", [["c", "required", T.bool], ["x", "required", T.int32], ["y", "required", T.int32]], T.int32,
    b => conditional(b.id("c", 0, T.bool), b.id("x", 1, T.int32), b.id("y", 2, T.int32), T.int32));
  const node = program.tir.root;
  for (const [arm, when] of [[node.whenTrue, "true"], [node.whenFalse, "false"]])
    arm.tsonic.demand = { kind: "selected", control: node.condition.id, when };
  const mir = lower(program);
  assert.deepEqual(mir.blocks.map(block => block.terminator.kind), ["switch", "goto", "goto", "return"]);
  assert.equal(mir.locals.filter(local => local.role.kind === "temporary").length, 1);
  for (const [chosen, source] of [[true, 1], [false, 2]]) {
    const result = walk(mir, { decide: () => chosen });
    const assignments = result.events.filter(item => item.record.kind === "assign");
    assert.equal(assignments.length, 1);
    assert.equal(rootLocalOf(mir, assignments[0].record.value.operand.place), sourceLocal(mir, source));
    assert.equal(assignments[0].record.place, mir.blocks.at(-1).terminator.value.place);
  }
  exactLowerBudget(program, mir);
});

test("discarded ternaries share one admitted read slot across nested arms and need none for discarded literals", () => {
  for (const shape of ["nested", "literal", "known"]) {
    const program = shaped(`conditional.discard.${shape}`, [["flag", "required", T.bool], ["nested", "required", T.bool],
      ["first", "required", T.int32], ["second", "required", T.int32], ["third", "required", T.int32]], T.int32, b => {
      const condition = shape === "known" ? b.keyword("TrueKeyword", literalTrue) : b.id("flag", 0, T.bool);
      const whenTrue = shape === "nested" ? conditional(b.id("nested", 1, T.bool), b.id("first", 2, T.int32),
        b.id("second", 3, T.int32), T.int32, "dynamic", "inner") : shape === "literal" ? b.num("3", T.int32) : b.id("first", 2, T.int32);
      const whenFalse = shape === "literal" ? b.num("4", T.int32) : b.id("third", 4, T.int32);
      return b.block(b.expressionStatement(conditional(condition, whenTrue, whenFalse, T.int32)), b.returns(b.id("third", 4, T.int32)));
    });
    const mir = lower(program);
    const reads = mir.blocks.flatMap(block => block.statements).filter(row => row.kind === "assign");
    const expected = shape === "nested" ? [program.at("inner.yes"), program.at("inner.no"), program.at("choice.no")]
      : shape === "known" ? [program.at("choice.yes")] : [];
    assert.deepEqual(new Set(reads.map(row => row.tir.node)), new Set(expected));
    assert.equal(reads.length, expected.length);
    assert.equal(new Set(reads.map(row => row.place)).size, shape === "literal" ? 0 : 1);
    const slots = mir.blocks.flatMap(block => block.statements).filter(row => row.kind === "storage-live");
    assert.equal(slots.length, shape === "literal" ? 0 : 1);
    assert.equal(mir.constants.length, 1, "only the guard constant is materialized");
    if (shape === "nested") {
      assert.equal(mir.blocks[0].statements.includes(slots[0]), true);
      for (const [outer, inner, tag] of [[false, false, "choice.no"], [true, true, "inner.yes"], [true, false, "inner.no"]]) {
        const path = walk(mir, { decide: point => point.node === program.at("choice.control") ? outer : inner });
        assert.deepEqual(path.events.filter(event => event.record.kind === "assign").map(event => event.node), [program.at(tag)]);
      }
    }
    exactLowerBudget(program, mir);
  }
});

test("a nested known guard cannot borrow an effect-only read slot with a different carrier", () => {
  const program = shaped("conditional.discard.known-guard", [["flag", "required", T.bool], ["known", "required", literalTrue],
    ["first", "required", T.int32], ["second", "required", T.int32]], T.int32, b =>
    b.block(b.expressionStatement(conditional(b.id("flag", 0, T.bool), conditional(b.id("known", 1, literalTrue),
      b.id("first", 2, T.int32), b.id("second", 3, T.int32), T.int32, "dynamic", "inner"),
    b.id("second", 3, T.int32), T.int32)), b.returns(b.id("second", 3, T.int32))));
  const mir = lower(program);
  assert.equal(mir.blocks.filter(block => block.terminator.kind === "switch").length, 1);
  const reads = flag => walk(mir, { decide: () => flag }).events.filter(event => event.record.kind === "assign");
  const selected = reads(true);
  const skipped = reads(false);
  assert.deepEqual(selected.map(event => event.node), [program.at("inner.control"), program.at("inner.yes")]);
  assert.deepEqual(skipped.map(event => event.node), [program.at("choice.no")]);
  assert.notEqual(selected[0].record.place, selected[1].record.place);
  assert.equal(mir.places[selected[0].record.place].storage, literalTrue);
  assert.equal(selected[1].record.place, skipped[0].record.place);
  assert.equal(mir.places[selected[1].record.place].storage, T.int32);
  exactLowerBudget(program, mir);
});

test("static conditional evidence visits only its selected arm and retains selected-demand qualification", () => {
  for (const disposition of ["true", "false", "dynamic"]) {
    for (const known of [true, false]) {
      if (disposition !== "dynamic" && known !== (disposition === "true")) continue;
      const taken = disposition === "dynamic" ? known : disposition === "true";
      const program = shaped(`conditional.static.${disposition}.${known}`, [["x", "required", T.int32]], T.int32,
        b => conditional(b.keyword(known ? "TrueKeyword" : "FalseKeyword", known ? literalTrue : literalFalse),
          taken ? b.id("x", 0, T.int32) : b.keyword("NullKeyword", T.absence),
          taken ? b.keyword("NullKeyword", T.absence) : b.id("x", 0, T.int32), T.int32, disposition));
      const node = program.tir.root;
      const arm = taken ? node.whenTrue : node.whenFalse;
      arm.tsonic.demand = { kind: "selected", control: node.condition.id, when: taken ? "true" : "false" };
      const dead = taken ? node.whenFalse : node.whenTrue;
      const descriptor = Object.getOwnPropertyDescriptor(dead, "tsonic");
      Object.defineProperty(dead, "tsonic", { configurable: true, get() { throw new Error("unselected arm was read"); } });
      const output = produced(deps, program.tir, []);
      assert.equal(output.kind, "ok");
      Object.defineProperty(dead, "tsonic", descriptor);
      const mir = output.value;
      assert.deepEqual(verified(mir, program), []);
      assert.equal(mir.blocks.length, 1);
      assert.equal(mir.locals.length, 1);
      assert.equal(mir.blocks[0].terminator.value.kind, "place");
      exactLowerBudget(program, mir);
    }
  }
});

test("nested conditional writes select only the real dominating operand prefix without copying either stack", () => {
  const program = shaped("conditional.nested", [["c", "required", T.bool], ["d", "required", T.bool],
    ["x", "required", T.int32], ["y", "required", T.int32]], T.int32, b => {
    const add = (left, right) => b.arithmetic(left, "PlusToken", right, T.int32, native("+", "int32", [T.int32, T.int32], T.int32));
    const write = (name, local, number) => b.assign(b.target(name, local, T.int32), "EqualsToken", b.num(number, T.int32), T.int32, T.int32);
    return add({ $: "outer-read", ...b.id("x", 2, T.int32) }, conditional(b.id("c", 0, T.bool),
      add({ $: "inner-read", ...b.id("y", 3, T.int32) }, conditional(b.id("d", 1, T.bool),
        b.sequence(write("x", 2, "2"), write("y", 3, "3"), T.int32), b.num("4", T.int32), T.int32, "dynamic", "inner")),
      b.num("5", T.int32), T.int32));
  });
  const mir = lower(program);
  const splits = mir.blocks.filter(block => block.terminator.kind === "switch");
  assert.equal(splits.length, 2);
  for (const [position, tag] of [[0, "outer-read"], [1, "inner-read"]]) {
    const snapshots = splits[position].statements.filter(record => record.kind === "assign" && record.tir.node === program.at(tag));
    assert.equal(snapshots.length, 1);
    assert.equal(mir.blocks.flatMap(block => block.statements).filter(record => record.kind === "assign" && record.tir.node === program.at(tag)).length, 1);
  }
  exactLowerBudget(program, mir);
});

test("a branch-local write snapshots earlier pending reads at the actual dominating split, never only on one arm", () => {
  for (const writing of ["true", "false", "both", "neither"]) {
    const program = shaped(`conditional.snapshot.${writing}`, [["c", "required", T.bool], ["x", "required", T.int32]], T.int32, b => {
      const store = number => b.assign(b.target("x", 1, T.int32), "EqualsToken",
        b.num(String(number), T.int32), T.int32, T.int32);
      return b.arithmetic({ $: "original", ...b.id("x", 1, T.int32) }, "PlusToken",
        conditional(b.id("c", 0, T.bool), writing === "true" || writing === "both" ? store(2) : b.num("4", T.int32),
          writing === "false" || writing === "both" ? store(3) : b.num("5", T.int32), T.int32),
        T.int32, native("+", "int32", [T.int32, T.int32], T.int32));
    });
    const mir = lower(program);
    const snapshots = mir.blocks[0].statements.filter(record => record.kind === "assign" && record.tir.node === program.at("original"));
    assert.equal(snapshots.length, writing === "neither" ? 0 : 1);
    for (const block of mir.blocks.slice(1))
      assert.equal(block.statements.some(record => record.tir.node === program.at("original")), false);
    if (writing !== "neither") {
      const final = mir.blocks.at(-1).statements.find(record => record.kind === "assign" && record.value.kind === "binary");
      assert.equal(final.value.left.place, snapshots[0].place);
      assert.equal(snapshots[0].value.operand.place, mir.places.find(place => place.base.kind === "local" && place.base.local === sourceLocal(mir, 1)).id);
    }
    exactLowerBudget(program, mir);
  }
});

test("reverse invalidation fills each original read position once without charging empty positions", () => {
  for (const count of [4, 16, 64]) for (const writing of [false, true]) {
    const cells = Array.from({ length: count }, (_, position) => `slot${position}`);
    const parameters = ["gate", "next", ...cells].map(name => [name, "required", T.bool]);
    const program = shaped(`read.position.${count}.${writing}`, parameters, T.bool, builder => {
      const next = () => builder.id("next", 1, T.bool);
      let replacement = next();
      if (writing) for (const [position, name] of cells.entries()) {
        const write = builder.assign(builder.target(name, position + 2, T.bool), "EqualsToken", next(), T.bool, T.bool);
        replacement = builder.sequence(write, replacement, T.bool);
      }
      let value = conditional(builder.id("gate", 0, T.bool), replacement, builder.keyword("FalseKeyword", T.bool), T.bool);
      for (let position = count - 1; position >= 0; position -= 1) {
        const name = cells[position];
        value = builder.comparison({ $: `read-${name}`, ...builder.id(name, position + 2, T.bool) }, "EqualsEqualsEqualsToken", value,
          native("===", "bool", [T.bool, T.bool], T.bool));
      }
      return value;
    });
    const mir = lower(program);
    const saved = mir.blocks[0].statements.filter(record => record.kind === "assign" && record.value.kind === "use");
    assert.deepEqual(saved.map(record => record.tir.node), writing ? cells.map(name => program.at(`read-${name}`)) : []);
    const consumed = mir.blocks.at(-1).statements.filter(record => record.kind === "assign" && record.value.kind === "binary");
    assert.deepEqual(consumed.map(record => record.value.left.place).reverse(),
      writing ? saved.map(record => record.place) : cells.map((_, position) => mir.places.find(place =>
        place.base.kind === "local" && place.base.local === sourceLocal(mir, position + 2)).id));
    assert.deepEqual(verified(mir, program), []);
    exactLowerBudget(program, mir);
  }
});

test("conditional inputs reject mismatched selected operands, arm storage and unavailable boolean conversion", () => {
  const make = name => shaped(`conditional.invalid.${name}`, [["c", "required", T.bool]], T.int32,
    b => conditional(b.id("c", 0, T.bool), b.num("1", T.int32), b.num("2", T.int32), T.int32));
  for (const field of ["kind", "control", "whenTrue", "whenFalse"]) {
    const program = make(field);
    program.tir.root.tsonic.selection[field] = field === "kind" ? "and" : -1;
    assert.throws(() => produced(deps, program.tir, []), error => defectOfLowerMir(error) && error.message.includes("actual operands"));
  }
  for (const arm of ["whenTrue", "whenFalse"]) {
    const program = make(arm);
    program.tir.root[arm].tsonic.type = T.uint32;
    assert.throws(() => produced(deps, program.tir, []), error => defectOfLowerMir(error) && error.message.includes("result storage"));
  }
  const staticMismatch = make("static-storage");
  staticMismatch.tir.root.tsonic.selection.disposition = "true";
  staticMismatch.tir.root.whenTrue.tsonic.type = T.uint32;
  assert.throws(() => produced(deps, staticMismatch.tir, []), error => defectOfLowerMir(error) && error.message.includes("result storage"));
  const unknown = make("condition");
  unknown.tir.root.condition.tsonic.type = T.string;
  assert.throws(() => produced(deps, unknown.tir, []), error => error.message.includes("without a selected boolean conversion"));
});

test("growing pending read and statement lists preserve every individual read and exact record refusal", () => {
  for (const count of [4, 16, 64]) {
    const program = nested(`exposed.growth.${count}`, T.int32, ({ leaf, sum, group }) => {
      let expression = sum("write", leaf("b"), leaf("b"), plus("int32", T.int32, EXECUTIONS.writes));
      for (let index = 0; index < count; index += 1)
        expression = sum(`pending${index}`, leaf("a"), group(expression), plus("int32", T.int32));
      return expression;
    }, { passing: ["byref-readwrite", "by-value"] });
    const mir = lower(program);
    const saves = mir.blocks.flatMap(block => block.statements).filter(record => record.kind === "assign" && record.value.kind === "use");
    assert.equal(saves.length, count);
    assert.equal(new Set(saves.map(record => record.place)).size, count);
    for (const record of saves) assert.deepEqual(record.value.operand, { kind: "place", place: 0 });
    const records = mir.locals.length + mir.places.length + mir.constants.length + mir.blocks.length
      + mir.blocks.reduce((total, block) => total + block.statements.length, 0);
    for (const maximumRecords of [0, records - 1]) {
      const refused = produced({ ...deps, limits: { maximumRecords } }, program.tir, []);
      assert.equal(refused.kind, "refused");
      assert.equal("value" in refused, false);
    }
    assert.deepEqual(lower(program, [], { maximumRecords: records }), mir);
    const statements = shaped(`statements.growth.${count}`, [], T.bool, b => b.block(
      ...Array.from({ length: count }, () => ({ kind: "EmptyStatement", tsonic: null })), b.returns(b.keyword("TrueKeyword", T.bool))));
    assert.equal(lower(statements).blocks[0].terminator.kind, "return");
  }
});

test("first producer: a comparison is placed by its decision like any binary operation", () => {
  const less = native("<", "int32", [T.int32, T.int32], T.bool);
  const program = shaped("first.less", [["a", "required", T.int32], ["b", "required", T.int32]], T.bool,
    b => b.block(b.returns({ $: "a<b", ...b.comparison(b.id("a", 0, T.int32), "LessThanToken", b.id("b", 1, T.int32), less) })));
  const mir = lower(program);
  assert.deepEqual(mir.blocks[0].statements.map(record => [record.kind, record.tir.node]), [["storage-live", program.at("a<b")], ["assign", program.at("a<b")]]);
  assert.deepEqual(mir.blocks[0].statements[1].value, { kind: "binary", operation: typedOperation(less), left: { kind: "place", place: 0 }, right: { kind: "place", place: 1 } });
  assert.equal(mir.locals[2].storage, T.bool);
});

test("selected scalar literals use one constant and no temporary or check, with exact graph-size refusal", () => {
  const cases = [
    ["true", T.bool, b => b.keyword("TrueKeyword", T.bool), { kind: "boolean", value: true }],
    ["false", T.bool, b => b.keyword("FalseKeyword", T.bool), { kind: "boolean", value: false }],
    ["absence", T.absence, b => b.keyword("NullKeyword", T.absence), { kind: "absence" }],
  ];
  for (const [name, type, token, number] of [
    ["zero", T.int32, "0", { numerator: 0n, denominator: 1n, negativeZero: false }],
    ["fraction", T.float64, "1.5", { numerator: 3n, denominator: 2n, negativeZero: false }],
    ["inexact-fraction", T.float64, "0.1", { numerator: 1n, denominator: 10n, negativeZero: false }],
    ["native64", T.literalInt64, "9007199254740993", { numerator: 9007199254740993n, denominator: 1n, negativeZero: false }],
    ["hex64", T.literalInt64, "0x20000000000001", { numerator: 9007199254740993n, denominator: 1n, negativeZero: false }],
  ]) cases.push([name, type, () => ({ kind: "NumericLiteral", text: token, tokenFlags: [],
    tsonic: { ...value(type), role: "value", value: number } }), { kind: "number", token, value: number }]);
  const big = 12345678901234567890123456789012345678901234567890n;
  cases.push(["bigint", T.literalBigint, () => ({ kind: "BigIntLiteral", text: `${big}n`, tokenFlags: [],
    tsonic: { ...value(T.literalBigint), role: "value", value: big } }), { kind: "bigint", token: `${big}n`, value: big }]);
  for (const kind of ["StringLiteral", "NoSubstitutionTemplateLiteral"]) {
    for (const [name, text, rawText] of [["empty", "", ""], ["escaped", "\n\u0000\u{1f340}", "\\n\\0\\u{1f340}"]]) {
      cases.push([`${kind}.${name}`, T.string, () => ({ kind, text, tokenFlags: [],
        ...(kind === "NoSubstitutionTemplateLiteral" ? { rawText, templateFlags: [] } : {}),
        tsonic: { ...value(T.string), role: "value", value: text } }), { kind: "string", value: text }]);
    }
  }
  for (const [name, type, build, expected] of cases) {
    const program = shaped(`literal.${name}`, [], type, b => b.block(b.returns(build(b))));
    const outcome = produced(deps, program.tir, []);
    assert.equal(outcome.kind, "ok");
    const mir = outcome.value;
    if (name === "inexact-fraction") assert.throws(() => verified(mir, program), /missing selected literal literal-conversion evidence/u);
    else assert.deepEqual(verified(mir, program), []);
    assert.deepEqual(mir.constants, [{ id: 0, type, value: { kind: "literal", value: expected } }]);
    assert.deepEqual([mir.locals, mir.places, mir.blocks.length, mir.blocks[0].statements], [[], [], 1, []]);
    assert.deepEqual(mir.blocks[0].terminator.value, { kind: "constant", constant: 0 });
    for (const maximumRecords of [0, 1]) {
      const outcome = produced({ ...deps, limits: { maximumRecords } }, program.tir, []);
      assert.equal(outcome.kind, "refused", `${name} under ${maximumRecords}`);
      assert.equal("value" in outcome, false);
      assert.deepEqual(outcome.diagnostics.map(diagnostic => diagnostic.code.rendered), ["TSONIC_COMPILER_RESOURCE_LIMIT"]);
    }
    assert.deepEqual(produced({ ...deps, limits: { maximumRecords: 2 } }, program.tir, []).value, mir);
  }
});

test("literal operands share the canonical constant owner and retain evaluation-side references after ordering", () => {
  const equal = selected({ kind: "boolean-operator", operator: "===" }, [T.bool, T.bool], T.bool);
  for (const right of ["TrueKeyword", "FalseKeyword"]) {
    const program = shaped(`literal.same.${right}`, [], T.bool, b => b.block(b.returns(
      b.comparison(b.keyword("TrueKeyword", T.bool), "EqualsEqualsEqualsToken", b.keyword(right, T.bool), equal))));
    const mir = lower(program);
    const comparison = mir.blocks[0].statements.find(record => record.kind === "assign").value;
    assert.equal(mir.constants.length, right === "TrueKeyword" ? 1 : 2);
    assert.deepEqual([comparison.left.kind, comparison.right.kind], ["constant", "constant"]);
    assert.deepEqual(mir.constants[comparison.left.constant].value, { kind: "literal", value: { kind: "boolean", value: true } });
    assert.deepEqual(mir.constants[comparison.right.constant].value, { kind: "literal", value: { kind: "boolean", value: right === "TrueKeyword" } });
    const records = right === "TrueKeyword" ? 6 : 7;
    for (let maximumRecords = 0; maximumRecords < records; maximumRecords += 1)
      assert.equal(produced({ ...deps, limits: { maximumRecords } }, program.tir, []).kind, "refused", `${right} under ${maximumRecords}`);
    assert.deepEqual(produced({ ...deps, limits: { maximumRecords: records } }, program.tir, []).value, mir);
  }
});

test("selected unary values use the same operation placement and exact record account for pure and invocation decisions", () => {
  for (const [name, execution] of Object.entries(EXECUTIONS)) {
    const decision = native("-", "int32", [T.int32], T.int32, execution);
    const program = shaped(`unary.${name}`, [["a", "required", T.int32]], T.int32,
      b => b.block(b.returns({ $: "negated", ...b.prefix(b.id("a", 0, T.int32), "MinusToken", T.int32, decision) })));
    const mir = lower(program);
    const site = program.at("negated");
    if (execution.kind === "pure") {
      assert.deepEqual(mir.blocks[0].statements.map(record => record.kind), ["storage-live", "assign"]);
      assert.deepEqual(mir.blocks[0].statements[1].value,
        { kind: "unary", operation: typedOperation(decision), operand: { kind: "place", place: 0 } });
      assert.equal(mir.blocks.length, 1);
    } else {
      const invoked = mir.blocks[0].terminator;
      assert.deepEqual(mir.blocks[0].statements.map(record => record.kind), ["storage-live"]);
      assert.deepEqual([invoked.kind, invoked.operation, invoked.operands, invoked.destination, invoked.tir.node],
        ["invoke", typedOperation(decision), [{ kind: "place", place: 0 }], 1, site]);
      assert.deepEqual(invoked.unwind, { kind: execution.failure === "unwind" ? "escape" : execution.failure });
      assert.equal(mir.blocks.length, 2);
    }
    assert.deepEqual(mir.blocks.at(-1).terminator.value, { kind: "place", place: 1 });
    for (let maximumRecords = 0; maximumRecords < 7; maximumRecords += 1) {
      const refused = produced({ ...deps, limits: { maximumRecords } }, program.tir, []);
      assert.equal(refused.kind, "refused", `${name} under ${maximumRecords}`);
      assert.equal("value" in refused, false);
    }
    assert.deepEqual(produced({ ...deps, limits: { maximumRecords: 7 } }, program.tir, []).value, mir);
  }
  const not = selected({ kind: "boolean-operator", operator: "!" }, [T.bool], T.bool);
  const program = shaped("unary.boolean", [["a", "required", T.bool]], T.bool,
    b => b.block(b.returns(b.prefix(b.id("a", 0, T.bool), "ExclamationToken", T.bool, not))));
  assert.deepEqual(lower(program).blocks[0].statements[1].value,
    { kind: "unary", operation: typedOperation(not), operand: { kind: "place", place: 0 } });
});

test("typeof applies its selected operation and void observes its operand before normal absence", () => {
  for (const [kind, identity, result] of [["TypeOfExpression", "type-query", T.string], ["VoidExpression", "discard", T.absence]]) {
    const discards = kind === "VoidExpression";
    for (const [name, execution] of Object.entries(EXECUTIONS)) {
      const decision = selected({ kind: identity }, [T.int32], result, execution);
      const program = shaped(`unary.${kind}.${name}`, [["x", "required", T.int32]], result, b => b.block(b.returns({
        $: "selected", kind, expression: { $: "operand", ...b.id("x", 0, T.int32) },
        tsonic: value(result, { operation: { kind: "decided", decision: typedOperation(decision) } }),
      })));
      if (discards && execution.kind !== "pure") {
        assert.throws(() => produced(deps, program.tir, []), error => defectOfLowerMir(error)
          && error.message === "caller defect: void without its selected discard operation", name);
        continue;
      }
      const mir = lower(program);
      if (discards) {
        const [block] = mir.blocks;
        assert.equal(mir.blocks.length, 1);
        assert.deepEqual(block.statements.map(row => row.kind), ["storage-live", "assign"]);
        assert.deepEqual([block.statements[1].tir.node, block.statements[1].value],
          [program.at("operand"), { kind: "use", operand: { kind: "place", place: 0 } }]);
        assert.equal(mir.locals[block.statements[0].local].storage, T.int32);
        assert.equal(mir.constants.length, 1);
        assert.deepEqual([mir.constants[0].type, mir.constants[0].value, block.terminator.value],
          [T.absence, { kind: "literal", value: { kind: "absence" } }, { kind: "constant", constant: mir.constants[0].id }]);
      } else if (execution.kind === "pure") assert.deepEqual(mir.blocks[0].statements[1].value,
        { kind: "unary", operation: typedOperation(decision), operand: { kind: "place", place: 0 } });
      else {
        assert.deepEqual(mir.blocks[0].terminator.operands, [{ kind: "place", place: 0 }]);
        assert.deepEqual(mir.blocks[0].terminator.operation, typedOperation(decision));
        assert.equal(mir.blocks[0].terminator.unwind.kind, execution.failure === "unwind" ? "escape" : execution.failure);
      }
      if (!discards) assert.deepEqual(mir.blocks.at(-1).terminator.value, { kind: "place", place: 1 });
      const records = discards ? 8 : 7;
      for (let maximumRecords = 0; maximumRecords < records; maximumRecords += 1)
        assert.equal(produced({ ...deps, limits: { maximumRecords } }, program.tir, []).kind, "refused", `${kind}/${name} under ${maximumRecords}`);
      assert.deepEqual(produced({ ...deps, limits: { maximumRecords: records } }, program.tir, []).value, mir);

      const operandEffect = native("-", "int32", [T.int32], T.int32, EXECUTIONS.writes);
      const effectful = shaped(`unary.${kind}.${name}.operand-effect`, [["x", "required", T.int32]], result, b => b.block(b.returns({
        kind, expression: { $: "effect", ...b.prefix(b.id("x", 0, T.int32), "MinusToken", T.int32, operandEffect) },
        tsonic: value(result, { operation: { kind: "decided", decision: typedOperation(decision) } }),
      })));
      const graph = lower(effectful);
      assert.equal(graph.blocks[0].terminator.tir.node, effectful.at("effect"));
      assert.deepEqual(graph.blocks[0].terminator.operation, typedOperation(operandEffect));
      const query = graph.blocks[1];
      if (discards) {
        assert.equal(graph.blocks.length, 2);
        assert.deepEqual([graph.blocks[0].terminator.next, graph.blocks[0].terminator.unwind], [query.id, { kind: "escape" }]);
        assert.deepEqual(query.statements, []);
        assert.deepEqual(query.terminator.value, { kind: "constant", constant: graph.constants[0].id });
      } else if (execution.kind === "pure") assert.deepEqual(query.statements[1].value.operand, { kind: "place", place: 1 });
      else assert.deepEqual(query.terminator.operands, [{ kind: "place", place: 1 }]);
      const effectRecords = discards ? 8 : 11;
      for (let maximumRecords = 0; maximumRecords < effectRecords; maximumRecords += 1)
        assert.equal(produced({ ...deps, limits: { maximumRecords } }, effectful.tir, []).kind, "refused", `${kind}/${name} operand effect under ${maximumRecords}`);
      assert.deepEqual(produced({ ...deps, limits: { maximumRecords: effectRecords } }, effectful.tir, []).value, graph);
    }
    const deferred = shaped(`unary.${kind}.deferred`, [["x", "required", T.int32]], result, b => b.block(b.returns({
      kind, expression: b.id("x", 0, T.int32), tsonic: value(result, { operation: { kind: "deferred", deferred: null } }),
    })));
    assert.throws(() => produced(deps, deferred.tir, []), error => defectOfLowerMir(error) && error.message.includes("deferred operation"));
  }
});

test("discarded void observes its original operand without producing an absence value", () => {
  const operation = selected({ kind: "discard" }, [T.int32], T.absence);
  const program = shaped("unary.void.discard", [["input", "required", T.int32]], T.int32, b => b.block(
    b.expressionStatement({ kind: "VoidExpression", expression: { $: "read", ...b.id("input", 0, T.int32) },
      tsonic: value(T.absence, { operation: { kind: "decided", decision: typedOperation(operation) } }) }),
    b.returns(b.id("input", 0, T.int32))));
  const mir = lower(program);
  const [started, read] = mir.blocks[0].statements;
  assert.deepEqual(mir.blocks[0].statements.map(row => row.kind), ["storage-live", "assign"]);
  assert.equal(read.tir.node, program.at("read"));
  assert.deepEqual(read.value, { kind: "use", operand: { kind: "place", place: 0 } });
  assert.equal(mir.locals[started.local].storage, T.int32);
  assert.deepEqual(mir.constants, []);
  exactLowerBudget(program, mir);
});

test("nested unary values run inside out; a writing unary saves only earlier pending exposed reads", () => {
  const minus = native("-", "int32", [T.int32], T.int32);
  const program = shaped("unary.nested", [["a", "required", T.int32]], T.int32, b => b.block(b.returns(
    { $: "outer", ...b.prefix({ $: "inner", ...b.prefix(b.id("a", 0, T.int32), "MinusToken", T.int32, minus) }, "MinusToken", T.int32, minus) })));
  const nestedMir = lower(program);
  const operations = nestedMir.blocks[0].statements.filter(record => record.kind === "assign");
  assert.deepEqual(operations.map(record => record.tir.node), [program.at("inner"), program.at("outer")]);
  assert.deepEqual(operations.map(record => record.value.operand), [{ kind: "place", place: 0 }, { kind: "place", place: 1 }]);

  for (const passing of ["by-value", "byref-readwrite"]) {
    const writes = native("-", "int32", [T.int32], T.int32, EXECUTIONS.writes);
    const waiting = shaped(`unary.waiting.${passing}`, [["a", "required", T.int32, passing]], T.int32, b => b.block(b.returns(
      b.arithmetic(b.id("a", 0, T.int32), "PlusToken", b.prefix(b.id("a", 0, T.int32), "MinusToken", T.int32, writes),
        T.int32, plus("int32", T.int32)))));
    const mir = lower(waiting);
    const saved = mir.blocks[0].statements.filter(record => record.kind === "assign");
    const exposed = passing === "byref-readwrite";
    assert.equal(saved.length, exposed ? 1 : 0);
    if (exposed) assert.deepEqual(saved[0].value, { kind: "use", operand: { kind: "place", place: 0 } });
    assert.deepEqual(mir.blocks[0].terminator.operands, [{ kind: "place", place: 0 }]);
    assert.deepEqual(mir.blocks[1].statements[1].value.left, { kind: "place", place: exposed ? 1 : 0 });
    const records = exposed ? 15 : 11;
    for (let maximumRecords = 0; maximumRecords < records; maximumRecords += 1)
      assert.equal(produced({ ...deps, limits: { maximumRecords } }, waiting.tir, []).kind, "refused", `${passing} under ${maximumRecords}`);
    assert.deepEqual(produced({ ...deps, limits: { maximumRecords: records } }, waiting.tir, []).value, mir);
  }
});

test("empty statements have no records and expression statements retain effects while discarding their value", () => {
  const empty = shaped("discard.empty", [], T.void, b => b.block({ kind: "EmptyStatement", tsonic: null }));
  const bare = lower(empty);
  assert.deepEqual([bare.locals, bare.places, bare.constants, bare.blocks.length, bare.blocks[0].statements], [[], [], [], 1, []]);
  assert.equal(produced({ ...deps, limits: { maximumRecords: 0 } }, empty.tir, []).kind, "refused");
  assert.deepEqual(produced({ ...deps, limits: { maximumRecords: 1 } }, empty.tir, []).value, bare);
  const unused = shaped("discard.unused-literal", [], T.void,
    builder => builder.block(builder.expressionStatement(builder.num("2", T.int32))));
  const noValue = lower(unused);
  assert.deepEqual([noValue.locals, noValue.places, noValue.constants, noValue.blocks.length, noValue.blocks[0].statements], [[], [], [], 1, []]);
  assert.equal(produced({ ...deps, limits: { maximumRecords: 0 } }, unused.tir, []).kind, "refused");
  assert.deepEqual(produced({ ...deps, limits: { maximumRecords: 1 } }, unused.tir, []).value, noValue);
  const decision = native("-", "int32", [T.int32], T.int32, EXECUTIONS.writes);
  const program = shaped("discard.effect", [["a", "required", T.int32, "byref-readwrite"]], T.void,
    b => b.block(b.expressionStatement(b.prefix(b.id("a", 0, T.int32), "MinusToken", T.int32, decision)),
      b.expressionStatement(b.id("a", 0, T.int32)), b.returns(null), b.expressionStatement(b.num("2", T.int32))));
  const mir = lower(program);
  assert.deepEqual(mir.blocks.map(block => block.statements.map(record => record.kind)), [["storage-live"], ["storage-live", "assign"]]);
  assert.deepEqual(mir.blocks[1].statements[1].value, { kind: "use", operand: { kind: "place", place: 0 } });
  assert.deepEqual(mir.blocks[0].terminator.operands, [{ kind: "place", place: 0 }]);
  assert.deepEqual([mir.blocks[1].terminator.kind, mir.blocks[1].terminator.value, mir.constants], ["return", null, []]);
  for (let maximumRecords = 0; maximumRecords < 11; maximumRecords += 1)
    assert.equal(produced({ ...deps, limits: { maximumRecords } }, program.tir, []).kind, "refused", `discard under ${maximumRecords}`);
  assert.deepEqual(produced({ ...deps, limits: { maximumRecords: 11 } }, program.tir, []).value, mir);
});

test("comma sequences execute each operand once in source order and keep only the right result", () => {
  const decision = native("-", "int32", [T.int32], T.int32, EXECUTIONS.writes);
  const program = shaped("sequence.effects", [["a", "required", T.int32, "byref-readwrite"]], T.int32,
    b => b.block(b.returns(b.sequence(
      { $: "left", ...b.prefix(b.id("a", 0, T.int32), "MinusToken", T.int32, decision) },
      { $: "right", ...b.prefix(b.id("a", 0, T.int32), "MinusToken", T.int32, decision) }, T.int32))));
  const mir = lower(program);
  assert.deepEqual(mir.blocks.slice(0, 2).map(block => [block.terminator.kind, block.terminator.tir.node, block.terminator.operands]),
    [["invoke", program.at("left"), [{ kind: "place", place: 0 }]], ["invoke", program.at("right"), [{ kind: "place", place: 0 }]]]);
  assert.deepEqual(mir.blocks.flatMap(block => block.statements).map(record => record.kind), ["storage-live", "storage-live"]);
  assert.deepEqual(mir.blocks[2].terminator.value, { kind: "place", place: 2 });
  for (let maximumRecords = 0; maximumRecords < 11; maximumRecords += 1)
    assert.equal(produced({ ...deps, limits: { maximumRecords } }, program.tir, []).kind, "refused", `sequence under ${maximumRecords}`);
  assert.deepEqual(produced({ ...deps, limits: { maximumRecords: 11 } }, program.tir, []).value, mir);
});

test("discard removes only its own exposure while an outer pending read remains protected from a later effect", () => {
  const decision = native("-", "int32", [T.int32], T.int32, EXECUTIONS.writes);
  const program = shaped("sequence.outer", [["a", "required", T.int32, "byref-readwrite"], ["b", "required", T.int32, "byref-readwrite"]], T.int32,
    b => b.block(b.returns(b.arithmetic(b.id("a", 0, T.int32), "PlusToken", b.sequence(b.id("b", 1, T.int32),
      b.prefix(b.id("b", 1, T.int32), "MinusToken", T.int32, decision), T.int32), T.int32, plus("int32", T.int32)))));
  const mir = lower(program);
  const saved = mir.blocks[0].statements.filter(record => record.kind === "assign");
  assert.deepEqual(saved.map(record => record.value), [
    { kind: "use", operand: { kind: "place", place: 0 } }, { kind: "use", operand: { kind: "place", place: 1 } },
  ]);
  assert.deepEqual(mir.blocks[0].terminator.operands, [{ kind: "place", place: 1 }]);
  assert.deepEqual(mir.blocks[1].statements[1].value.left, { kind: "place", place: saved[0].place });
  for (let maximumRecords = 0; maximumRecords < 21; maximumRecords += 1)
    assert.equal(produced({ ...deps, limits: { maximumRecords } }, program.tir, []).kind, "refused", `waiting under ${maximumRecords}`);
  assert.deepEqual(produced({ ...deps, limits: { maximumRecords: 21 } }, program.tir, []).value, mir);
});

test("an escaping throw evaluates its selected operand once, names the actual throw and omits unreachable statements", () => {
  const decision = native("-", "int32", [T.int32], T.int32, EXECUTIONS.unwinds);
  const cases = [
    ["constant", [], b => b.keyword("TrueKeyword", T.bool), 2],
    ["parameter", [["a", "required", T.int32]], b => b.id("a", 0, T.int32), 3],
    ["invoke", [["a", "required", T.int32]], b => b.prefix(b.id("a", 0, T.int32), "MinusToken", T.int32, decision), 7],
  ];
  for (const [name, rows, expression, records] of cases) {
    const program = shaped(`throw.${name}`, rows, T.void, b => b.block({ $: "throw", ...b.throws(expression(b)) },
      b.expressionStatement(b.num("9", T.int32)), b.returns(null)));
    const mir = lower(program);
    const thrown = mir.blocks.at(-1).terminator;
    assert.deepEqual([thrown.kind, thrown.tir.node, thrown.unwind], ["throw", program.at("throw"), { kind: "escape" }]);
    assert.deepEqual(thrown.operand, name === "constant" ? { kind: "constant", constant: 0 }
      : { kind: "place", place: name === "invoke" ? 1 : 0 });
    assert.equal(mir.constants.length, name === "constant" ? 1 : 0);
    assert.equal(mir.blocks.length, name === "invoke" ? 2 : 1);
    if (name === "invoke") {
      assert.deepEqual(mir.blocks[0].terminator.operation, typedOperation(decision));
      assert.deepEqual(mir.blocks[0].terminator.unwind, { kind: "escape" });
      assert.deepEqual(mir.blocks[0].terminator.operands, [{ kind: "place", place: 0 }]);
    }
    for (let maximumRecords = 0; maximumRecords < records; maximumRecords += 1)
      assert.equal(produced({ ...deps, limits: { maximumRecords } }, program.tir, []).kind, "refused", `${name} under ${maximumRecords}`);
    assert.deepEqual(produced({ ...deps, limits: { maximumRecords: records } }, program.tir, []).value, mir);
  }
});

test("selected local assignment writes once and returns the evaluated right operand", () => {
  const program = shaped("assignment.simple", [["a", "required", T.int32], ["b", "required", T.int32]], T.int32,
    b => b.block(b.returns({ $: "store", ...b.assign(b.target("a", 0, T.int32), "EqualsToken", b.id("b", 1, T.int32), T.int32, T.int32) })));
  const mir = lower(program);
  assert.deepEqual(mir.blocks.map(block => block.statements.map(record => [record.kind, record.value?.kind])), [[["assign", "use"]]]);
  const stored = mir.blocks[0].statements[0];
  assert.equal(stored.tir.node, program.at("store"));
  assert.equal(rootLocalOf(mir, stored.place), sourceLocal(mir, 0));
  assert.equal(rootLocalOf(mir, stored.value.operand.place), sourceLocal(mir, 1));
  assert.deepEqual(mir.blocks[0].terminator.value, stored.value.operand);
  const size = mir.locals.length + mir.places.length + mir.constants.length + mir.blocks.length + 1;
  for (let maximumRecords = 0; maximumRecords < size; maximumRecords += 1)
    assert.equal(produced({ ...deps, limits: { maximumRecords } }, program.tir, []).kind, "refused", `simple assignment under ${maximumRecords}`);
  assert.equal(produced({ ...deps, limits: { maximumRecords: size } }, program.tir, []).kind, "ok");
});

test("parenthesized assignment destinations preserve the actual selected local without evaluating a value wrapper", () => {
  for (const calculation of [false, true]) {
    const program = shaped(`assignment.parenthesized.${calculation}`, [["a", "required", T.int32], ["b", "required", T.int32]], T.int32,
      b => b.block(b.returns({ $: "store", ...b.assign(b.paren(b.paren(b.target("a", 0, T.int32, calculation
        ? { kind: "read-write", storage: T.int32, read: T.int32, narrowing: null, evidenceIndex: null }
        : { kind: "write", storage: T.int32 }), T.int32), T.int32), calculation ? "PlusEqualsToken" : "EqualsToken",
        b.id("b", 1, T.int32), T.int32, T.int32, calculation ? plus("int32", T.int32) : null) })));
    const mir = lower(program);
    const writes = mir.blocks[0].statements.filter(record => record.kind === "assign");
    assert.deepEqual(writes.map(record => record.value.kind), calculation ? ["use", "binary", "use"] : ["use"]);
    if (calculation) {
      assert.equal(rootLocalOf(mir, writes[0].value.operand.place), sourceLocal(mir, 0));
      assert.deepEqual(writes[1].value.left, { kind: "place", place: writes[0].place });
    }
    assert.equal(rootLocalOf(mir, writes.at(-1).place), sourceLocal(mir, 0));
    assert.equal(writes.at(-1).tir.node, program.at("store"));
    assert.deepEqual(mir.blocks[0].terminator.value, writes.at(-1).value.operand);
    const size = mir.locals.length + mir.places.length + mir.constants.length + mir.blocks.length + mir.blocks[0].statements.length;
    for (let maximumRecords = 0; maximumRecords < size; maximumRecords += 1)
      assert.equal(produced({ ...deps, limits: { maximumRecords } }, program.tir, []).kind, "refused", `parenthesized ${calculation} under ${maximumRecords}`);
    assert.equal(produced({ ...deps, limits: { maximumRecords: size } }, program.tir, []).kind, "ok");
    for (const alteration of ["conversion", "narrowing"]) {
      const wrapper = program.tir.root.statements.nodes[0].expression.left;
      const saved = wrapper.tsonic;
      wrapper.tsonic = { ...saved, ...(alteration === "conversion" ? { conversion: { kind: "deferred", deferred: null } }
        : { narrowing: { kind: "narrowed", source: T.int32, result: T.int32, failure: "abort", proof: { steps: [], conclusion: 0 } } }) };
      assert.throws(() => produced(deps, program.tir, []), error => defectOfLowerMir(error)
        && error.message === `${CALLER_DEFECT}an assignment target has a value conversion or narrowing`);
      wrapper.tsonic = saved;
    }
  }
});

test("a named local write preserves every earlier evaluated read independently, even in private body storage", () => {
  for (const passing of ["by-value", "byref-readwrite"]) {
    const program = shaped(`assignment.saved.${passing}`, [["a", "required", T.int32, passing], ["b", "required", T.int32]], T.int32,
      b => b.block(b.returns(b.arithmetic({ $: "first", ...b.id("a", 0, T.int32) }, "PlusToken",
        b.arithmetic({ $: "second", ...b.id("a", 0, T.int32) }, "PlusToken",
          { $: "store", ...b.assign(b.target("a", 0, T.int32), "EqualsToken", b.id("b", 1, T.int32), T.int32, T.int32) },
          T.int32, plus("int32", T.int32)), T.int32, plus("int32", T.int32)))));
    const mir = lower(program);
    const writes = mir.blocks[0].statements.filter(record => record.kind === "assign");
    assert.deepEqual(writes.map(record => record.value.kind), ["use", "use", "use", "binary", "binary"]);
    assert.deepEqual(writes.slice(0, 2).map(record => record.tir.node), [program.at("first"), program.at("second")]);
    assert.notEqual(writes[0].place, writes[1].place, "two source reads are not deduplicated by LocalId");
    assert.deepEqual(writes[3].value.left, { kind: "place", place: writes[1].place });
    assert.deepEqual(writes[4].value.left, { kind: "place", place: writes[0].place });
    assert.equal(writes[2].tir.node, program.at("store"));
    const size = mir.locals.length + mir.places.length + mir.constants.length + mir.blocks.length
      + mir.blocks.reduce((count, block) => count + block.statements.length, 0);
    for (let maximumRecords = 0; maximumRecords < size; maximumRecords += 1)
      assert.equal(produced({ ...deps, limits: { maximumRecords } }, program.tir, []).kind, "refused", `saved assignment ${passing} under ${maximumRecords}`);
    assert.equal(produced({ ...deps, limits: { maximumRecords: size } }, program.tir, []).kind, "ok");
  }
});

test("calculated local assignment reads before its right side and stores only after the selected operation completes", () => {
  for (const [kind, execution] of Object.entries(EXECUTIONS)) {
    const program = shaped(`assignment.calculated.${kind}`, [["a", "required", T.int32, "byref-readwrite"], ["b", "required", T.int32]], T.int32,
      b => b.block(b.returns({ $: "outer", ...b.assign(b.target("a", 0, T.int32, { kind: "read-write", storage: T.int32,
        read: T.int32, narrowing: null, evidenceIndex: null }), "PlusEqualsToken",
        { $: "inner", ...b.assign(b.target("a", 0, T.int32), "EqualsToken", b.id("b", 1, T.int32), T.int32, T.int32) },
        T.int32, T.int32, plus("int32", T.int32, execution)) })));
    const mir = lower(program);
    const path = walk(mir);
    const userWrites = path.events.filter(item => item.statement !== null && item.kind === "assign"
      && rootLocalOf(mir, item.record.place) === sourceLocal(mir, 0));
    assert.deepEqual(userWrites.map(item => item.node), [program.at("inner"), program.at("outer")]);
    const saved = mir.blocks[0].statements.find(record => record.kind === "assign" && record.value.kind === "use"
      && rootLocalOf(mir, record.place) !== sourceLocal(mir, 0));
    assert.equal(saved !== undefined, true, "the calculated left value precedes the nested write");
    const operation = execution.kind === "pure" ? mir.blocks[0].statements.find(record => record.kind === "assign" && record.value.kind === "binary").value
      : mir.blocks[0].terminator;
    assert.deepEqual(execution.kind === "pure" ? operation.left : operation.operands[0], { kind: "place", place: saved.place });
    if (execution.kind !== "pure" && execution.failure !== "none") {
      const failed = walk(mir, { decide: () => "unwind" });
      assert.equal(failed.events.some(item => item.statement !== null && item.kind === "assign" && item.node === program.at("outer")
        && rootLocalOf(mir, item.record.place) === sourceLocal(mir, 0)), false,
        "failure does not execute the normal store");
    }
  }
});

test("compound assignment has already read its left local when a read-only right-side operation can abort", () => {
  const type = T.int32;
  const program = shaped("assignment.calculated.right-aborts", [["a", "required", type], ["b", "required", type]], type,
    builder => builder.block(builder.returns({ $: "compound", ...builder.assign(
      { $: "left", ...builder.target("a", 0, type, { kind: "read-write", storage: type, read: type, narrowing: null, evidenceIndex: null }) },
      "PlusEqualsToken",
      { $: "right", ...builder.arithmetic(builder.id("b", 1, type), "PlusToken", builder.num("1", type), type,
        plus("int32", type, { kind: "invocation", writesStorage: false, failure: "abort" })) },
      type, type, plus("int32", type)) })));
  const graph = lower(program);
  const entry = graph.blocks[0];
  const saved = entry.statements.find(row => row.kind === "assign" && row.tir.node === program.at("left"));
  assert.equal(saved.value.kind, "use");
  assert.equal(rootLocalOf(graph, saved.value.operand.place), sourceLocal(graph, 0));
  assert.equal(entry.terminator.kind, "invoke");
  assert.equal(entry.terminator.tir.node, program.at("right"));
  assert.deepEqual(entry.terminator.unwind, { kind: "abort" });
  const next = graph.blocks[entry.terminator.next];
  const calculation = next.statements.find(row => row.kind === "assign" && row.value.kind === "binary");
  assert.deepEqual(calculation.value.left, { kind: "place", place: saved.place });
  const writes = graph.blocks.flatMap(block => block.statements.filter(row => row.kind === "assign" && rootLocalOf(graph, row.place) === sourceLocal(graph, 0)));
  assert.equal(writes.length, 1);
  assert.equal(next.statements.includes(writes[0]), true);
  assert.equal(writes[0].tir.node, program.at("compound"));
  exactLowerBudget(program, graph);
});

test("a write to caller storage preserves all possibly aliased exposed reads, not only its named LocalId", () => {
  for (const passing of ["byref-readwrite", "by-value"]) {
    const program = shaped(`assignment.alias.${passing}`, [["a", "required", T.int32, "byref-readwrite"], ["b", "required", T.int32, passing]], T.int32,
      b => b.block(b.returns(b.arithmetic({ $: "read", ...b.id("a", 0, T.int32) }, "PlusToken",
        { $: "store", ...b.assign(b.target("b", 1, T.int32), "EqualsToken", b.num("9", T.int32), T.int32, T.int32) },
        T.int32, plus("int32", T.int32)))));
    const mir = lower(program);
    const writes = mir.blocks[0].statements.filter(record => record.kind === "assign");
    const saved = passing === "byref-readwrite";
    assert.deepEqual(writes.map(record => record.value.kind), saved ? ["use", "use", "binary"] : ["use", "binary"]);
    if (saved) {
      assert.equal(writes[0].tir.node, program.at("read"));
      assert.deepEqual(writes[2].value.left, { kind: "place", place: writes[0].place }, "caller may pass the same cell through two different formals");
    } else assert.equal(rootLocalOf(mir, writes[1].value.left.place), sourceLocal(mir, 0), "a body-owned destination cannot overwrite that caller cell");
    const size = mir.locals.length + mir.places.length + mir.constants.length + mir.blocks.length
      + mir.blocks.reduce((count, block) => count + block.statements.length, 0);
    for (let maximumRecords = 0; maximumRecords < size; maximumRecords += 1)
      assert.equal(produced({ ...deps, limits: { maximumRecords } }, program.tir, []).kind, "refused", `alias opposite ${passing} under ${maximumRecords}`);
    assert.equal(produced({ ...deps, limits: { maximumRecords: size } }, program.tir, []).kind, "ok");
  }
});

test("assignment rejects unavailable selected inputs rather than inventing a target or operation", () => {
  const make = name => shaped(`assignment.invalid.${name}`, [["a", "required", T.int32]], T.int32,
    b => b.block(b.returns(b.assign(b.target("a", 0, T.int32), "EqualsToken", b.id("a", 0, T.int32), T.int32, T.int32))));
  const cases = [
    ["selection", node => { node.tsonic.selection = { kind: "and", control: node.left.id, right: node.right.id, disposition: "dynamic" }; }, true,
      "a conditional assignment differs from its actual selected control"],
    ["target-kind", node => { node.left.kind = "PropertyAccessExpression"; }, true, "a field assignment requires its actual selected member"],
    ["role", node => { node.left.tsonic.role = "value"; }, true, "an assignment without a selected target"],
    ["error", node => { node.left.tsonic.resolution = { kind: "error", diagnostic: 0 }; }, true, "an error resolution"],
    ["definition", node => { node.left.tsonic.resolution = { kind: "definition", definition: def("assignment.global"), aliases: [] }; }, false, "an assignment resolved to a definition"],
    ["other-body", node => { node.left.tsonic.resolution.local.body = bodyId("assignment.other"); }, false, "an assignment to a local not placed in the body"],
    ["unplaced", node => { node.left.tsonic.resolution.local.local = 9; }, false, "an assignment to a local not placed in the body"],
    ["storage", node => { node.tsonic.storage = T.bool; }, true, "an assignment with inconsistent selected storage"],
    ["deferred", node => { node.tsonic.calculation = { kind: "deferred", deferred: null }; }, true, "a deferred assignment operation"],
    ["read", node => { node.tsonic.calculation = { kind: "decided", decision: typedOperation(plus("int32", T.int32)) }; }, true, "a calculated assignment without a selected read"],
    ["narrow", node => { node.left.tsonic.access = { kind: "read-write", storage: T.int32, read: T.int32, evidenceIndex: null,
      narrowing: { kind: "narrowed", source: T.int32, result: T.int32, failure: "abort", proof: { steps: [], conclusion: 0 } } }; }, false, "a narrowed assignment read"],
  ];
  for (const [name, amend, caller, message] of cases) {
    const program = make(name);
    amend(program.tir.root.statements.nodes[0].expression);
    assert.throws(() => produced(deps, program.tir, []), error => caller
      ? defectOfLowerMir(error) && error.message === `${CALLER_DEFECT}${message}` : notLoweredYet(message)(error), name);
  }
});

test("selected constructor applications use the actual construct endpoint, arguments and original failure continuation", () => {
  for (const count of [0, 2]) {
    for (const absentSyntax of [false, true]) {
      if (count !== 0 && absentSyntax) continue;
      const name = `construct.direct.${count}.${absentSyntax}`;
      const target = `${name}.target`;
      const signatureId = signature(target, Array.from({ length: count }, (_, index) => [`p${index}`, T.int32]), T.counter, null, "construct");
      const program = shaped(name, [["x", "required", T.int32]], T.counter, builder => {
        const args = count === 0 ? [] : [
          { ...directApplication(builder, `${name}.first`, [builder.id("x", 0, T.int32)]), $: "first" },
          { ...directApplication(builder, `${name}.second`, [builder.id("x", 0, T.int32)]), $: "second" },
        ];
        const created = { $: "construct", ...builder.construct(builder.global(target, target, T.unknown), args, T.counter, at => ({
          callee: callee(target, signatureId, args.map((_, index) => mapped(index, index)), T.counter), receiver: null,
          arguments: args.map((arg, parameter) => ({ kind: "provided", parameter, expression: at(arg.$) })),
        })) };
        if (absentSyntax) created.arguments = null;
        return builder.block(builder.returns(created));
      });
      const mir = lower(program);
      const calls = controlPoints(mir).filter(point => point.kind === "call");
      const construction = calls.at(-1);
      assert.equal(construction.record.callee.resolution.decision.api.signature, signatureId);
      assert.equal(construction.record.arguments.length, count);
      assert.equal(construction.node, program.at("construct"));
      assert.deepEqual(construction.record.unwind, { kind: "escape" });
      if (count === 2) assert.deepEqual(calls.map(point => point.node), [program.at("first"), program.at("second"), program.at("construct")]);
      const size = mir.locals.length + mir.places.length + mir.constants.length + mir.blocks.length
        + mir.blocks.reduce((count, block) => count + block.statements.length, 0);
      for (let maximumRecords = 0; maximumRecords < size; maximumRecords += 1)
        assert.equal(produced({ ...deps, limits: { maximumRecords } }, program.tir, []).kind, "refused");
      assert.equal(produced({ ...deps, limits: { maximumRecords: size } }, program.tir, []).kind, "ok");
      const original = TABLE.signatures[signatureId].kind;
      TABLE.signatures[signatureId].kind = "call";
      assert.throws(() => produced(deps, program.tir, []), /another selected invocation kind/u);
      TABLE.signatures[signatureId].kind = original;
    }
  }
});

function directApplication(builder, name, expressions, result = T.int32, passing = "by-value") {
  const target = `direct.target.${name}`;
  const signatureId = signature(target, expressions.map((_, index) => [`p${index}`, T.int32, "required", null, passing]), result);
  const arguments_ = expressions.map((expression, index) => ({ ...expression, $: expression.$ ?? `${name}.argument.${index}` }));
  return { $: name, ...builder.call(builder.global(target, target, T.unknown), arguments_, result, at => ({
    callee: callee(target, signatureId, arguments_.map((_, index) => mapped(index, index, passing)), result), receiver: null,
    arguments: arguments_.map((expression, index) => ({ kind: "provided", parameter: index, expression: at(expression.$) })),
  })) };
}

test("selected direct calls retain argument order, passing and original unwinding with no dummy void slot", () => {
  for (const count of [0, 1, 3]) for (const result of [T.int32, T.void]) for (const passing of ["by-value", "move"]) {
    const name = `call.direct.${count}.${result}.${passing}`;
    const program = shaped(name, [], result, b => directApplication(b, name,
      Array.from({ length: count }, (_, index) => b.num(String(index + 1), T.int32)), result, passing));
    const mir = lower(program);
    const call = mir.blocks[0].terminator;
    assert.equal(call.kind, "call");
    assert.equal(call.callee.kind, "direct");
    assert.equal(call.receiver, null);
    assert.deepEqual(call.unwind, { kind: "escape" });
    assert.deepEqual(call.arguments.map(argument => [argument.kind, argument.passing]), Array.from({ length: count }, () => ["value", passing]));
    assert.deepEqual(call.arguments.map(argument => mir.constants[argument.operand.constant].value.value.value.numerator),
      Array.from({ length: count }, (_, index) => BigInt(index + 1)));
    assert.equal(call.destination === null, result === T.void);
    assert.equal(mir.constants.length, count);
    if (result === T.void) {
      const returned = mir.blocks[call.next].terminator;
      assert.equal(returned.kind, "return");
      assert.equal(returned.value, null);
    }
    assert.equal(walk(mir).events.at(-1).node, program.at(name));
    assert.equal(walk(mir, { decide: () => "unwind" }).end, "unwind");
    const size = mir.locals.length + mir.places.length + mir.constants.length + mir.blocks.length
      + mir.blocks.reduce((total, block) => total + block.statements.length, 0);
    for (let maximumRecords = 0; maximumRecords < size; maximumRecords += 1)
      assert.equal(produced({ ...deps, limits: { maximumRecords } }, program.tir, []).kind, "refused", `${name} under ${maximumRecords}`);
    assert.equal(produced({ ...deps, limits: { maximumRecords: size } }, program.tir, []).kind, "ok");
  }
});

test("a selected void call cannot itself supply a demanded absence value", () => {
  const location = "call.void.value";
  const program = shaped("call.void.value-consumer", [], T.absence, builder =>
    builder.block(builder.returns(directApplication(builder, location, [], T.void))));
  const origin = program.tir.root.statements.nodes[0].expression.origin;
  const reads = [];
  const attempt = maximumRecords => produced({ ...deps, limits: { maximumRecords }, typeOf: type => {
    reads.push(type);
    return deps.typeOf(type);
  } }, program.tir, []);
  const stopped = attempt(0);
  assert.deepEqual([stopped.kind, "value" in stopped, stopped.diagnostics.map(row => row.code.name)],
    ["refused", false, ["TSONIC_COMPILER_RESOURCE_LIMIT"]]);
  assert.deepEqual(reads, []);
  assert.throws(() => attempt(1),
    error => notLoweredYet("a void call with a value consumer")(error) && error.cause.origin === origin);
  assert.deepEqual(reads, [T.void]);
});

test("discarded direct calls charge their arguments and control, not a result slot", () => {
  const program = shaped("call.discarded.result", [], T.void, builder => builder.block(builder.expressionStatement(
    directApplication(builder, "discarded.call", [builder.num("1", T.int32)], T.int32))));
  const mir = lower(program);
  assert.equal(mir.blocks.length, 2);
  assert.deepEqual(mir.locals, []);
  assert.deepEqual(mir.places, []);
  assert.equal(mir.constants.length, 1);
  assert.ok(mir.blocks.every(block => block.statements.length === 0));
  const call = mir.blocks[0].terminator;
  assert.equal(call.kind, "call");
  assert.equal(call.tir.node, program.at("discarded.call"));
  assert.equal(call.destination, null);
  assert.deepEqual(call.unwind, { kind: "escape" });
  assert.equal(mir.blocks[call.next].terminator.kind, "return");
  for (let maximumRecords = 0; maximumRecords < 3; maximumRecords += 1)
    assert.equal(produced({ ...deps, limits: { maximumRecords } }, program.tir, []).kind, "refused");
  assert.deepEqual(produced({ ...deps, limits: { maximumRecords: 3 } }, program.tir, []).value, mir);
});

test("omitted fixed arguments stay omitted while a supplied native absence remains a value", () => {
  for (const kind of ["required", "optional", "default"]) for (const count of [0, 1, 2]) {
    const defaults = kind === "default";
    const name = `call.omitted.${kind}.${count}`;
    const target = `${name}.target`;
    const initializers = [bodyId(`${target}.p0`, "default"), bodyId(`${target}.p1`, "default")];
    const sig = signature(target, [0, 1].map(index => [`p${index}`, T.absence, kind, defaults ? initializers[index] : null, "by-value", true]), T.int32);
    const program = shaped(name, [], T.int32, b => ({ $: "call", ...b.call(b.global(target, target, T.unknown),
      Array.from({ length: count }, (_, index) => ({ $: `argument${index}`, ...b.keyword("NullKeyword", T.absence) })), T.int32,
      at => ({ callee: callee(target, sig, [0, 1].map(index => index < count ? mapped(index, index)
        : defaults ? defaultMapping(index, `${target}.p${index}`) : omittedMapping(index, T.absence)), T.int32), receiver: null,
      arguments: [0, 1].map(parameter => parameter < count ? { kind: "provided", parameter, expression: at(`argument${parameter}`) }
        : { kind: "omitted", parameter, value: defaults ? { kind: "initializer", instance: { body: initializers[parameter], bindings: SELECTED_BINDINGS } } : { kind: "absence" } }) })) }));
    const mir = lower(program);
    const call = mir.blocks[0].terminator;
    assert.equal(call.kind, "call");
    assert.deepEqual(call.arguments.map(argument => argument.kind), [0, 1].map(index => index < count ? "value" : "omitted"));
    for (const argument of call.arguments) if (argument.kind === "value")
      assert.deepEqual(mir.constants[argument.operand.constant].value, { kind: "literal", value: { kind: "absence" } });
    const size = mir.locals.length + mir.places.length + mir.constants.length + mir.blocks.length
      + mir.blocks.reduce((total, block) => total + block.statements.length, 0);
    for (let maximumRecords = 0; maximumRecords < size; maximumRecords += 1)
      assert.equal(produced({ ...deps, limits: { maximumRecords } }, program.tir, []).kind, "refused", `${name} under ${maximumRecords}`);
    assert.equal(produced({ ...deps, limits: { maximumRecords: size } }, program.tir, []).kind, "ok");
  }
});

test("required absence-capable parameters still need genuine selected omission evidence and parameter occurrences", () => {
  for (const present of [false, true]) {
    const name = `call.omitted.denied.${present}`;
    const target = `${name}.target`;
    const sig = signature(target, present ? [["p", T.absence, "required", null, "by-value", false]] : [], T.int32);
    const program = shaped(name, [], T.int32, b => b.call(b.global(target, target, T.unknown), [], T.int32,
      () => ({ callee: callee(target, sig, [omittedMapping(0, T.absence)], T.int32), receiver: null,
        arguments: [{ kind: "omitted", parameter: 0, value: { kind: "absence" } }] })));
    assert.throws(() => produced(deps, program.tir, []), error => defectOfLowerMir(error)
      && error.message === `${CALLER_DEFECT}an omitted call argument lacks its selected omission capability`);
  }
  const program = shaped("entry.required-absence", [["x", "required", T.absence]], T.absence, b => b.id("x", 0, T.absence));
  TABLE.signatures[program.tir.signature].parameters[0].acceptsOmission = true;
  const mir = lower(program);
  assert.deepEqual(providedCountsOf(mir), [1, 0]);
  assert.equal(walk(mir, { entry: 0 }).events.some(item => item.kind === "assign"), false);
  const omitted = walk(mir, { entry: 1 }).events.filter(item => item.kind === "assign");
  assert.equal(omitted.length, 1);
  assert.equal(omitted[0].node, program.tir.params[0].id);
  assert.equal(rootLocalOf(mir, omitted[0].record.place), sourceLocal(mir, 0));
  assert.deepEqual(mir.constants[omitted[0].record.value.operand.constant].value, { kind: "literal", value: { kind: "absence" } });
  const size = mir.locals.length + mir.places.length + mir.constants.length + mir.blocks.length
    + mir.blocks.reduce((count, block) => count + block.statements.length, 0);
  for (let maximumRecords = 0; maximumRecords < size; maximumRecords += 1)
    assert.equal(produced({ ...deps, limits: { maximumRecords } }, program.tir, []).kind, "refused", `omitted actual parameter under ${maximumRecords}`);
  assert.equal(produced({ ...deps, limits: { maximumRecords: size } }, program.tir, []).kind, "ok");
});

test("optional suffix entries initialize only missing slots in parameter order with the same record allowance", () => {
  for (const receiver of [false, true]) {
    const rows = [...(receiver ? [["self", "this", T.counter]] : []), ["x", "optional", T.absence], ["y", "optional", T.absence]];
    const program = shaped(`entry.optional.${receiver}`, rows, T.void, b => b.block(b.returns(null)),
      { receiver: receiver ? T.counter : null });
    const mir = lower(program);
    assert.deepEqual(providedCountsOf(mir), [2, 1, 0]);
    const headers = program.tir.params.filter(header => header.tsonic.role !== "this");
    for (const provided of [2, 1, 0]) {
      const assigned = walk(mir, { entry: 2 - provided }).events.filter(item => item.kind === "assign");
      assert.deepEqual(assigned.map(item => item.node), headers.slice(provided).map(header => header.id));
      assert.deepEqual(assigned.map(item => rootLocalOf(mir, item.record.place)), headers.slice(provided)
        .map(header => sourceLocal(mir, header.tsonic.local.local)));
    }
    const size = mir.locals.length + mir.places.length + mir.constants.length + mir.blocks.length
      + mir.blocks.reduce((count, block) => count + block.statements.length, 0);
    for (let maximumRecords = 0; maximumRecords < size; maximumRecords += 1)
      assert.equal(produced({ ...deps, limits: { maximumRecords } }, program.tir, []).kind, "refused", `optional suffix under ${maximumRecords}`);
    assert.equal(produced({ ...deps, limits: { maximumRecords: size } }, program.tir, []).kind, "ok");
  }
});

test("actual selected parameter headers place a separate default execution only in omitted entries", () => {
  for (const kind of ["boolean", "string"]) {
    const name = `entry.default.${kind}`;
    const parameterName = `${name}.p`;
    const type = kind === "boolean" ? T.bool : T.string;
    const initializer = bodyId(parameterName, "default");
    const b = builders(name);
    const program = typedBody(name, { signature: signature(name, [["p", type, "default", initializer]], type), completion: type,
      locals: [["p", "parameter", type]], params: [[0, "default", type, initializer]], nestedBodies: [initializer],
      root: b.id("p", 0, type) });
    const defaultBuilder = builders(parameterName, "default");
    const syntax = kind === "boolean" ? defaultBuilder.keyword("FalseKeyword", type)
      : { kind: "StringLiteral", text: "λ", tokenFlags: [], tsonic: { ...value(type), role: "value", value: "λ" } };
    const child = typedBody(parameterName, { role: "default", signature: signature(parameterName, [], type), completion: type, root: syntax });
    const header = program.tir.params[0];
    child.tir.root = seal(parameterName, syntax, "default", program.nodeCount).root;
    child.tir.root.parent = header.id;
    header.initializer = { kind: "ready-default", root: child.tir.root };
    const input = { instance: { body: initializer, bindings: SELECTED_BINDINGS }, captures: [], signature: child.tir.signature };
    program.bodyOf = instance => instanceKey(instance) === instanceKey(input.instance) ? child.tir : null;
    lower(child);
    const mir = lower(program, [input]);
    assert.deepEqual(providedCountsOf(mir), [1, 0]);
    assert.deepEqual(internalCallsOn(walk(mir, { entry: 0 })), []);
    const omitted = internalCallsOn(walk(mir, { entry: 1 }));
    assert.equal(omitted.length, 1);
    assert.equal(omitted[0].node, header.id, "the actual selected Parameter is the call occurrence");
    assert.equal(destinationRootOf(mir, omitted[0]), sourceLocal(mir, 0));
    assert.equal(omitted[0].record.callee.instance, input.instance);
    assert.equal(walk(mir, { entry: 1, decide: () => "unwind" }).end, "unwind");
    const size = mir.locals.length + mir.places.length + mir.constants.length + mir.blocks.length
      + mir.blocks.reduce((count, block) => count + block.statements.length, 0);
    for (let maximumRecords = 0; maximumRecords < size; maximumRecords += 1)
      assert.equal(produced({ ...deps, limits: { maximumRecords } }, program.tir, [input]).kind, "refused", `${kind} default under ${maximumRecords}`);
    assert.equal(produced({ ...deps, limits: { maximumRecords: size } }, program.tir, [input]).kind, "ok");
    assert.throws(() => produced(deps, program.tir, []), error => defectOfLowerMir(error)
      && error.message === `${CALLER_DEFECT}a placed initializer has no supplied execution data`);
    const placed = header.tsonic.initializer;
    header.tsonic.initializer = null;
    assert.throws(() => produced(deps, program.tir, [input]), notLoweredYet("a parameter initializer without its placed execution"));
    header.tsonic.initializer = placed;
  }
});

test("ordered default entries execute real child MIR and capture the actual earlier parameter", async () => {
  const evaluator = await import("../../packages/host/dist/evaluate/index.js");
  const types = await import("../../packages/host/dist/ir-types/index.js");
  const name = "entry.default.actual-capture";
  const names = [`${name}.x`, `${name}.y`];
  const initializers = names.map(parameter => bodyId(parameter, "default"));
  const b = builders(name);
  const program = typedBody(name, { signature: signature(name, [["x", T.bool, "default", initializers[0]],
    ["y", T.bool, "default", initializers[1]]], T.bool), completion: T.bool,
    locals: [["x", "parameter", T.bool, true], ["y", "parameter", T.bool]],
    params: [[0, "default", T.bool, initializers[0]], [1, "default", T.bool, initializers[1]]], nestedBodies: initializers,
    root: b.id("y", 1, T.bool) });
  const bindings = { kind: "instantiated", bindings: EMPTY_BINDINGS };
  program.tir.bindings = bindings;
  const source = { body: program.tir.body, local: 0 };
  const capture = { local: source, capture: "captured-location" };
  let nextNode = program.nodeCount;
  const children = names.map((parameter, index) => {
    const childBuilder = builders(parameter, "default");
    const root = index === 0 ? childBuilder.keyword("FalseKeyword", T.bool) : childBuilder.id("x", 0, T.bool);
    const child = typedBody(parameter, { role: "default", signature: signature(parameter, [], T.bool), completion: T.bool,
      locals: index === 0 ? [] : [["x", "capture", T.bool, true, source]], captures: index === 0 ? [] : [capture], root });
    const syntax = seal(parameter, root, "default", nextNode);
    nextNode = syntax.count;
    child.tir.root = syntax.root;
    child.tir.bindings = bindings;
    child.tir.root.parent = program.tir.params[index].id;
    program.tir.params[index].initializer = { kind: "ready-default", root: child.tir.root };
    return child;
  });
  const inputs = children.map(child => ({ instance: { body: child.tir.body, bindings },
    captures: child.tir.captures, signature: child.tir.signature }));
  const sources = new Map(children.map(child => [instanceKey({ body: child.tir.body, bindings }), child.tir]));
  program.bodyOf = instance => sources.get(instanceKey(instance)) ?? null;
  const graphs = new Map(children.map(child => [instanceKey({ body: child.tir.body, bindings }), lower(child)]));
  const mir = lower(program, inputs);
  assert.deepEqual(providedCountsOf(mir), [2, 1, 0]);
  const interner = admitFixtureTable(types, TABLE);
  const views = { types: types.viewTypes(interner), typeOf: type => types.readType(interner, type),
    signatureOf: selected => types.readSignature(interner, selected), selectedNativeFacts: verificationContext(program).selectedNativeFacts,
    limits: { maximumSteps: 100, maximumIntermediateBits: 16, maximumResultBits: 16, maximumArithmeticWork: 100 } };
  for (const [arguments_, expected, calls] of [[[], false, initializers], [[true], true, initializers.slice(1)],
    [[false, true], true, []], [[true, false], false, []]]) {
    const requested = [];
    let result = evaluator.evaluate(views, { body: mir.body, bindings }, mir,
      arguments_.map(value => ({ kind: "boolean", type: T.bool, value })), "compile-time", { query: "constValue", key: [name, arguments_.length] });
    while (result.kind === "paused") {
      assert.equal(result.requests.length, 1);
      const request = result.requests[0];
      assert.equal(request.kind, "mir-body");
      requested.push(request.instance.body);
      assert.equal(requested.length <= 2, true, "each omitted default executes once");
      const graph = graphs.get(instanceKey(request.instance));
      assert.equal(graph !== undefined, true, "the exact complete selected child instance is ready");
      result = evaluator.resumeEvaluate(views, result.paused, [{ kind: "mir-body", body: graph }]);
    }
    assert.deepEqual(requested, calls);
    assert.equal(result.value.kind, "ok");
    assert.deepEqual(result.value.value, { kind: "value", value: { kind: "boolean", type: T.bool, value: expected } });
    assert.deepEqual(result.value.diagnostics, []);
  }
});

test("nested call arguments execute in authored order and protect only genuinely exposed earlier values", () => {
  for (const passing of ["by-value", "byref-readwrite"]) {
    const name = `call.nested.${passing}`;
    const program = shaped(name, [["x", "required", T.int32, passing]], T.int32, b => b.block(b.returns(b.arithmetic(
      { $: "earlier", ...b.id("x", 0, T.int32) }, "PlusToken", directApplication(b, name, [
        directApplication(b, `${name}.left`, [b.num("1", T.int32)]), directApplication(b, `${name}.right`, [b.num("2", T.int32)]),
      ]), T.int32, plus("int32", T.int32)))));
    const mir = lower(program);
    const path = walk(mir);
    assert.deepEqual(path.events.filter(item => item.kind === "call").map(item => item.node),
      [`${name}.left`, `${name}.right`, name].map(label => program.at(label)));
    const copies = mir.blocks.flatMap(block => block.statements).filter(statement => statement.kind === "assign" && statement.tir.node === program.at("earlier"));
    assert.equal(copies.length, passing === "by-value" ? 0 : 1);
    if (copies.length !== 0) assert.deepEqual(copies[0].value, { kind: "use", operand: { kind: "place", place: 0 } });
    const size = mir.locals.length + mir.places.length + mir.constants.length + mir.blocks.length
      + mir.blocks.reduce((total, block) => total + block.statements.length, 0);
    for (let maximumRecords = 0; maximumRecords < size; maximumRecords += 1)
      assert.equal(produced({ ...deps, limits: { maximumRecords } }, program.tir, []).kind, "refused", `nested call ${passing} under ${maximumRecords}`);
    assert.equal(produced({ ...deps, limits: { maximumRecords: size } }, program.tir, []).kind, "ok");
  }
});

test("selected indirect targets execute before arguments and preserve exposed target reads exactly once", () => {
  for (const targetKind of ["local", "parenthesized", "factory"]) for (const passing of ["by-value", "byref-readwrite"]) {
    const name = `call.indirect.${targetKind}.${passing}`;
    const program = shaped(name, [["f", "required", indirectType, passing]], T.int32, b => {
      const read = { $: "target-read", ...b.id("f", 0, indirectType) };
      const target = targetKind === "factory" ? directApplication(b, `${name}.factory`, [], indirectType)
        : targetKind === "parenthesized" ? b.paren(read, indirectType) : read;
      const argument = directApplication(b, `${name}.argument`, [b.num("1", T.int32)]);
      return { $: "indirect-call", ...b.call(target, [argument], T.int32, at => ({
        callee: { ...callee("lower.indirect.target", indirectSignature, [mapped(0, 0)], T.int32), activation: null },
        receiver: null, arguments: [{ kind: "provided", parameter: 0, expression: at(argument.$) }],
      })) };
    });
    const mir = lower(program);
    const calls = walk(mir).events.filter(item => item.kind === "call");
    assert.deepEqual(calls.map(item => item.node),
      [...(targetKind === "factory" ? [`${name}.factory`] : []), `${name}.argument`, "indirect-call"].map(label => program.at(label)));
    const outer = mir.blocks.find(block => block.terminator.tir.node === program.at("indirect-call")).terminator;
    assert.equal(outer.callee.kind, "indirect");
    assert.deepEqual(outer.callee.resolution, program.tir.root.tsonic.application.decision.callee);
    const copies = targetKind === "factory" ? [] : mir.blocks.flatMap(block => block.statements)
      .filter(statement => statement.kind === "assign" && statement.tir.node === program.at("target-read"));
    assert.equal(copies.length, targetKind !== "factory" && passing !== "by-value" ? 1 : 0);
    if (copies.length !== 0) assert.deepEqual(outer.callee.operand, { kind: "place", place: copies[0].place });
    else if (targetKind === "factory") {
      const factory = mir.blocks.find(block => block.terminator.tir.node === program.at(`${name}.factory`)).terminator;
      assert.deepEqual(outer.callee.operand, { kind: "place", place: factory.destination });
    } else assert.equal(rootLocalOf(mir, outer.callee.operand.place), 0);
    const size = mir.locals.length + mir.places.length + mir.constants.length + mir.blocks.length
      + mir.blocks.reduce((total, block) => total + block.statements.length, 0);
    for (let maximumRecords = 0; maximumRecords < size; maximumRecords += 1)
      assert.equal(produced({ ...deps, limits: { maximumRecords } }, program.tir, []).kind, "refused", `${name} under ${maximumRecords}`);
    assert.equal(produced({ ...deps, limits: { maximumRecords: size } }, program.tir, []).kind, "ok");
  }
});

test("selected local place arguments preserve the location, passing and actual pending read without a value copy", () => {
  for (const mode of ["byref-readonly", "byref-readwrite", "byref-writeonly-must-init", "borrow-shared", "borrow-mut"])
    for (const incoming of ["by-value", "byref-readwrite"]) for (const wrapped of [false, true]) {
      const name = `call.place.${mode}.${incoming}.${wrapped}`;
      const target = `${name}.target`;
      const sig = signature(target, [["cell", T.int32, "required", null, mode], ["value", T.int32]], T.int32);
      const program = shaped(name, [["x", "required", T.int32, incoming]], T.int32, b => {
        const read = { $: "place-read", ...b.id("x", 0, T.int32) };
        const place = { ...(wrapped ? b.paren(read, T.int32) : read), $: "place-argument" };
        const effect = directApplication(b, `${name}.effect`, []);
        const call = { $: "place-call", ...b.call(b.global(target, target, T.unknown), [place, effect], T.int32, at => ({
          callee: callee(target, sig, [mapped(0, 0, mode), mapped(1, 1)], T.int32), receiver: null,
          arguments: [{ kind: "provided", parameter: 0, expression: at("place-argument") }, { kind: "provided", parameter: 1, expression: at(effect.$) }],
        })) };
        return b.arithmetic({ $: "earlier", ...b.id("x", 0, T.int32) }, "PlusToken", call, T.int32, plus("int32", T.int32));
      });
      program.tir.locals[0].mutable = true;
      const mir = lower(program);
      const outerBlock = mir.blocks.find(block => block.terminator.tir.node === program.at("place-call"));
      const argument = outerBlock.terminator.arguments[0];
      assert.equal(argument.kind, "place");
      assert.equal(argument.passing, mode);
      assert.equal(rootLocalOf(mir, argument.place), 0);
      const copies = mir.blocks.flatMap(block => block.statements)
        .filter(statement => statement.kind === "assign" && statement.tir.node === program.at("earlier"));
      const writable = mode !== "byref-readonly" && mode !== "borrow-shared";
      assert.equal(copies.length, incoming !== "by-value" || writable ? 1 : 0);
      if (copies.length !== 0) {
        const beforeEffect = mir.blocks.find(block => block.terminator.tir.node === program.at(`${name}.effect`));
        assert.equal(beforeEffect.statements.includes(copies[0]), true);
        assert.equal(outerBlock.statements.includes(copies[0]), false);
        assert.deepEqual(copies[0].value, { kind: "use", operand: { kind: "place", place: argument.place } });
      }
      assert.equal(mir.blocks.flatMap(block => block.statements).some(statement => statement.kind === "assign"
        && statement.tir.node === program.at("place-argument")), false, "passing a local location does not load its value");
      const size = mir.locals.length + mir.places.length + mir.constants.length + mir.blocks.length
        + mir.blocks.reduce((total, block) => total + block.statements.length, 0);
      for (let maximumRecords = 0; maximumRecords < size; maximumRecords += 1)
        assert.equal(produced({ ...deps, limits: { maximumRecords } }, program.tir, []).kind, "refused", `${name} under ${maximumRecords}`);
      assert.equal(produced({ ...deps, limits: { maximumRecords: size } }, program.tir, []).kind, "ok");
    }
});

test("a selected receiver passed by place denotes its actual incoming slot and preserves only necessary pending reads", () => {
  for (const incoming of ["by-value", "byref-readwrite"]) for (const passing of ["borrow-shared", "borrow-mut"])
    for (const wrapped of [false, true]) {
      const name = `call.place.receiver.${incoming}.${passing}.${wrapped}`;
      const program = shaped(name, [["self", "this", T.int32, incoming]], T.int32, b => {
        const receiver = label => ({ $: label, ...b.keyword("ThisKeyword", T.int32, "receiver"),
          tsonic: { ...value(T.int32), role: "receiver", owner: def(`${name}.class`) } });
        const actual = receiver("argument");
        const argument = wrapped ? { $: "wrapped", ...b.paren(actual, T.int32) } : actual;
        return b.arithmetic(receiver("earlier"), "PlusToken", directApplication(b, `${name}.call`, [argument], T.int32, passing),
          T.int32, plus("int32", T.int32));
      }, { receiver: T.int32 });
      const mir = lower(program);
      const call = mir.blocks[0].terminator;
      assert.equal(call.kind, "call");
      assert.equal(call.arguments[0].kind, "place");
      assert.equal(call.arguments[0].passing, passing);
      assert.equal(rootLocalOf(mir, call.arguments[0].place), 0);
      assert.equal(mir.locals[0].role.kind, "receiver");
      assert.equal(mir.locals[0].mode, incoming);
      const copies = mir.blocks.flatMap(block => block.statements)
        .filter(statement => statement.kind === "assign" && statement.tir.node === program.at("earlier"));
      assert.equal(copies.length, incoming === "byref-readwrite" || passing === "borrow-mut" ? 1 : 0);
      assert.equal(mir.blocks.flatMap(block => block.statements).some(statement => statement.kind === "assign"
        && statement.tir.node === program.at("argument")), false);
      const size = mir.locals.length + mir.places.length + mir.constants.length + mir.blocks.length
        + mir.blocks.reduce((total, block) => total + block.statements.length, 0);
      for (let maximumRecords = 0; maximumRecords < size; maximumRecords += 1)
        assert.equal(produced({ ...deps, limits: { maximumRecords } }, program.tir, []).kind, "refused", `${name} under ${maximumRecords}`);
      assert.equal(produced({ ...deps, limits: { maximumRecords: size } }, program.tir, []).kind, "ok");
      const callNode = program.tir.root.right;
      const selected = wrapped ? callNode.arguments.nodes[0].expression : callNode.arguments.nodes[0];
      const saved = selected.tsonic;
      selected.tsonic = { ...saved, role: "value" };
      assert.throws(() => produced(deps, program.tir, []), error => defectOfLowerMir(error)
        && error.message === `${CALLER_DEFECT}a place argument without its selected receiver`);
      selected.tsonic = saved;
      program.tir.params = [];
      const earlier = program.tir.root.left;
      earlier.kind = "NumericLiteral";
      earlier.text = "0";
      earlier.tokenFlags = [];
      earlier.tsonic = { ...value(T.int32), role: "value", value: { numerator: 0n, denominator: 1n, negativeZero: false } };
      assert.throws(() => produced(deps, program.tir, []), error => defectOfLowerMir(error)
        && error.message === `${CALLER_DEFECT}a place argument has no local storage in the body`);
    }
});

test("a local actually handed to a writable call remains exposed for later calls, unlike a readonly borrow", () => {
  for (const mode of ["byref-readwrite", "borrow-shared"]) {
    const name = `call.place.later.${mode}`;
    const target = `${name}.target`;
    const sig = signature(target, [["cell", T.int32, "required", null, mode]], T.int32);
    const program = shaped(name, [["x", "required", T.int32]], T.int32, b => {
      const call = b.call(b.global(target, target, T.unknown), [{ $: "place", ...b.id("x", 0, T.int32) }], T.int32, at => ({
        callee: callee(target, sig, [mapped(0, 0, mode)], T.int32), receiver: null,
        arguments: [{ kind: "provided", parameter: 0, expression: at("place") }],
      }));
      return b.sequence(call, b.arithmetic({ $: "later-read", ...b.id("x", 0, T.int32) }, "PlusToken",
        directApplication(b, `${name}.later`, []), T.int32, plus("int32", T.int32)), T.int32);
    });
    program.tir.locals[0].mutable = true;
    const mir = lower(program);
    const copies = mir.blocks.flatMap(block => block.statements)
      .filter(statement => statement.kind === "assign" && statement.tir.node === program.at("later-read"));
    assert.equal(copies.length, mode === "byref-readwrite" ? 1 : 0);
  }
});

test("newly exposed earlier reads and an already exposed later read are each saved once before the same call", () => {
  for (const mode of ["byref-readwrite", "borrow-mut", "byref-readonly", "by-value"]) {
    const name = `call.place.mixed.${mode}`;
    const target = `${name}.target`;
    const sig = signature(target, [["left", T.int32, "required", null, mode], ["right", T.int32, "required", null, mode]], T.int32);
    const program = shaped(name, [["x", "required", T.int32], ["y", "required", T.int32], ["external", "required", T.int32, "byref-readwrite"]], T.int32, b => {
      const call = { $: "mutate", ...b.call(b.global(target, target, T.unknown),
        ["x", "y"].map((text, index) => ({ $: `argument${index}`, ...b.id(text, index, T.int32) })), T.int32, at => ({
          callee: callee(target, sig, [mapped(0, 0, mode), mapped(1, 1, mode)], T.int32), receiver: null,
          arguments: [0, 1].map(parameter => ({ kind: "provided", parameter, expression: at(`argument${parameter}`) })),
        })) };
      const sum = (label, left, right) => ({ $: label, ...b.arithmetic(left, "PlusToken", right, T.int32, plus("int32", T.int32)) });
      return sum("sum-x", { $: "read-x", ...b.id("x", 0, T.int32) }, sum("sum-y", { $: "read-y", ...b.id("y", 1, T.int32) },
        sum("sum-external", { $: "read-external", ...b.id("external", 2, T.int32) }, call)));
    });
    program.tir.locals[0].mutable = true;
    program.tir.locals[1].mutable = true;
    const mir = lower(program);
    const before = mir.blocks.find(block => block.terminator.tir.node === program.at("mutate"));
    const copies = before.statements.filter(statement => statement.kind === "assign");
    const writable = mode === "byref-readwrite" || mode === "borrow-mut";
    assert.deepEqual(copies.map(copy => copy.tir.node).sort((left, right) => left - right),
      (writable ? ["read-x", "read-y", "read-external"] : ["read-external"]).map(program.at).sort((left, right) => left - right));
    for (const [label, local] of [["x", 0], ["y", 1], ["external", 2]]) {
      const copy = copies.find(statement => statement.tir.node === program.at(`read-${label}`));
      const sum = mir.blocks.flatMap(block => block.statements).find(statement => statement.kind === "assign" && statement.tir.node === program.at(`sum-${label}`));
      assert.equal(sum.value.kind, "binary");
      if (copy === undefined) assert.equal(rootLocalOf(mir, sum.value.left.place), local);
      else {
        assert.equal(copy.value.kind, "use");
        assert.equal(rootLocalOf(mir, copy.value.operand.place), local);
        assert.deepEqual(sum.value.left, { kind: "place", place: copy.place });
      }
    }
    assert.equal(walk(mir).events.filter(event => event.kind === "call").length, 1);
    const size = mir.locals.length + mir.places.length + mir.constants.length + mir.blocks.length
      + mir.blocks.reduce((total, block) => total + block.statements.length, 0);
    for (let maximumRecords = 0; maximumRecords < size; maximumRecords += 1) {
      const refused = produced({ ...deps, limits: { maximumRecords } }, program.tir, []);
      assert.equal(refused.kind, "refused", `${name} under ${maximumRecords}`);
      assert.equal(refused.diagnostics.length, 1);
    }
    assert.equal(produced({ ...deps, limits: { maximumRecords: size } }, program.tir, []).kind, "ok");
  }
});

test("repeated place arguments share their actual local location and refuse before its first allocation", () => {
  const name = "call.place.repeated";
  const target = `${name}.target`;
  const sig = signature(target, [["left", T.int32, "required", null, "borrow-mut"], ["right", T.int32, "required", null, "borrow-mut"]], T.int32);
  const program = shaped(name, [["x", "required", T.int32]], T.int32, b => b.call(b.global(target, target, T.unknown),
    [0, 1].map(index => ({ $: `place${index}`, ...b.id("x", 0, T.int32) })), T.int32, at => ({
      callee: callee(target, sig, [mapped(0, 0, "borrow-mut"), mapped(1, 1, "borrow-mut")], T.int32), receiver: null,
      arguments: [0, 1].map(parameter => ({ kind: "provided", parameter, expression: at(`place${parameter}`) })),
    })));
  program.tir.locals[0].mutable = true;
  const mir = lower(program);
  const arguments_ = mir.blocks[0].terminator.arguments;
  assert.deepEqual(arguments_[0], arguments_[1]);
  assert.equal(rootLocalOf(mir, arguments_[0].place), 0);
  const size = mir.locals.length + mir.places.length + mir.constants.length + mir.blocks.length
    + mir.blocks.reduce((total, block) => total + block.statements.length, 0);
  for (let maximumRecords = 0; maximumRecords < size; maximumRecords += 1)
    assert.equal(produced({ ...deps, limits: { maximumRecords } }, program.tir, []).kind, "refused", `repeated places under ${maximumRecords}`);
  assert.equal(produced({ ...deps, limits: { maximumRecords: size } }, program.tir, []).kind, "ok");
});

test("place argument input defects do not select a value conversion, missing local or different cell", () => {
  const cases = [
    ["role", node => { node.tsonic.role = "declaration-name"; }, "a place argument without its selected value"],
    ["conversion", node => { node.tsonic.conversion = { kind: "deferred" }; }, "a place argument has a value conversion or narrowing"],
    ["narrowing", node => { node.tsonic.narrowing = { kind: "narrowed" }; }, "a place argument has a value conversion or narrowing"],
    ["wrapper-conversion", node => { node.kind = "ParenthesizedExpression"; node.expression = { ...node };
      node.expression.kind = "Identifier"; node.tsonic = { ...value(T.int32), conversion: { kind: "deferred" } }; }, "a place argument has a value conversion or narrowing"],
    ["wrapper-narrowing", node => { node.kind = "ParenthesizedExpression"; node.expression = { ...node };
      node.expression.kind = "Identifier"; node.tsonic = { ...value(T.int32), narrowing: { kind: "narrowed" } }; }, "a place argument has a value conversion or narrowing"],
    ["wrapper-declaration-name", node => { node.kind = "ParenthesizedExpression"; node.expression = { ...node };
      node.expression.kind = "Identifier"; node.tsonic = { role: "declaration-name-expression" }; }, "a nonexecuting declaration name in an executable value"],
    ["missing-local", node => { node.tsonic.resolution.local.local = 42; }, "a place argument has no local storage in the body"],
    ["foreign-local", node => { node.tsonic.resolution.local.body = bodyId("place.foreign"); }, "a place argument has no local storage in the body"],
  ];
  for (const [name, amend, message] of cases) {
    const target = `call.place.invalid.${name}`;
    const sig = signature(target, [["cell", T.int32, "required", null, "borrow-mut"]], T.int32);
    const program = shaped(`${target}.caller`, [["x", "required", T.int32]], T.int32, b => b.call(b.global(target, target, T.unknown),
      [{ $: "place", ...b.id("x", 0, T.int32) }], T.int32, at => ({
        callee: callee(target, sig, [mapped(0, 0, "borrow-mut")], T.int32), receiver: null,
        arguments: [{ kind: "provided", parameter: 0, expression: at("place") }],
      })));
    amend(program.tir.root.arguments.nodes[0]);
    assert.throws(() => produced(deps, program.tir, []), error => defectOfLowerMir(error) && error.message === `${CALLER_DEFECT}${message}`, name);
  }
  const name = "call.place.definition";
  const program = shaped(name, [], T.int32, b => directApplication(b, name, [b.global("x", "place.external", T.int32)], T.int32, "borrow-mut"));
  assert.throws(() => produced(deps, program.tir, []), notLoweredYet("a place argument resolved to a definition"));
});

test("call frontiers and mismatched selected inputs never invent a callee, receiver or parameter", () => {
  const cases = [
    ["nonexecuting", node => { node.tsonic = { role: "declaration-name-expression" }; }, true, "a nonexecuting declaration name in an executable call"],
    ["operation", node => { node.tsonic.operation = { kind: "decided", decision: typedOperation(plus("int32", T.int32)) }; }, false, "a call with a selected operation"],
    ["deferred", node => { node.tsonic.application = { kind: "deferred", deferred: { invocation: { rule: "embed", input: null }, result: T.int32 } }; }, true, "a deferred call application"],
    ["receiver", node => { node.tsonic.application.decision.receiver = node.expression.id; }, false, "a call with a receiver"],
    ["foreign-local", node => { node.expression.tsonic.resolution = { kind: "local", local: { body: bodyId("direct.local"), local: 0 } }; }, false, "a local that is not a parameter of the body"],
    ["other-declaration", node => { node.expression.tsonic.resolution.definition = def("direct.other"); }, true, "a direct call target differs from its selected declaration"],
    ["spread", node => { const argument = node.arguments.nodes[0]; node.arguments.nodes[0] = { ...argument, kind: "SpreadElement", expression: argument }; }, false, "a spread call argument"],
    ["missing-argument", node => { node.tsonic.application.decision.arguments = []; }, false, "a call with unmatched argument and parameter inventories"],
    ["missing-parameter", node => { node.tsonic.application.decision.callee.decision.parameters = []; }, false, "a call with unmatched argument and parameter inventories"],
    ["omitted", node => { node.tsonic.application.decision.arguments[0] = { kind: "omitted", parameter: 0, value: { kind: "absence" } }; }, true, "an omitted call argument differs from its selected default"],
    ["omitted-source", node => { node.tsonic.application.decision.arguments[0] = { kind: "omitted", parameter: 0, value: { kind: "absence" } };
      node.tsonic.application.decision.callee.decision.parameters[0] = omittedMapping(0, T.int32);
      TABLE.signatures[node.tsonic.application.decision.callee.decision.api.signature].parameters[0].acceptsOmission = true;
    }, true, "a call has source arguments absent from its selection"],
    ["omitted-rest", node => { node.tsonic.application.decision.arguments[0] = { kind: "omitted", parameter: 0, value: { kind: "empty-rest" } }; }, false, "a rest call argument"],
    ["rest-mapping", node => { node.tsonic.application.decision.arguments[0] = { kind: "omitted", parameter: 0, value: { kind: "absence" } };
      node.tsonic.application.decision.callee.decision.parameters[0] = { kind: "rest", parameter: 0, arguments: [], passing: "by-value" }; }, false, "a rest call argument"],
    ["initializer-mismatch", node => { node.tsonic.application.decision.arguments[0] = { kind: "omitted", parameter: 0,
      value: { kind: "initializer", instance: { body: bodyId("direct.other-default", "default"), bindings: SELECTED_BINDINGS } } };
      node.tsonic.application.decision.callee.decision.parameters[0] = defaultMapping(0, "direct.expected-default"); }, true, "an omitted call argument names another initializer"],
    ["interior-omitted", node => { const application = node.tsonic.application.decision;
      application.arguments = [{ kind: "omitted", parameter: 0, value: { kind: "absence" } }, { ...application.arguments[0], parameter: 1 }];
      application.callee.decision.parameters = [omittedMapping(0, T.int32), mapped(1, 0)]; }, true, "an omitted call argument precedes a supplied parameter"],
    ["default", node => { node.tsonic.application.decision.callee.decision.parameters[0] = { kind: "default", parameter: 0, initializer: bodyId("direct.default", "default") }; }, false, "a call with omitted, rest or expanded arguments"],
    ["component", node => { node.tsonic.application.decision.callee.decision.parameters[0].component = 0; }, false, "a call with omitted, rest or expanded arguments"],
    ["argument-position", node => { node.tsonic.application.decision.arguments[0].parameter = 1; }, true, "a call argument differs from its actual selected mapping"],
    ["argument-source", node => { node.tsonic.application.decision.arguments[0].expression = node.id; }, true, "a call argument differs from its actual selected mapping"],
    ["parameter-position", node => { node.tsonic.application.decision.callee.decision.parameters[0].parameter = 1; }, true, "a call argument differs from its actual selected mapping"],
    ["parameter-source", node => { node.tsonic.application.decision.callee.decision.parameters[0].argument = 1; }, true, "a call argument differs from its actual selected mapping"],
    ["place-passed", node => { node.tsonic.application.decision.callee.decision.parameters[0].passing = "borrow-shared"; }, false, "a place argument of kind NumericLiteral"],
  ];
  for (const [name, change, caller, message] of cases) {
    const program = shaped(`direct.invalid.${name}`, [], T.int32, b => directApplication(b, `direct.invalid.${name}`, [b.num("1", T.int32)]));
    change(program.tir.root);
    assert.throws(() => produced(deps, program.tir, []), error => caller ? defectOfLowerMir(error) && error.message === `${CALLER_DEFECT}${message}`
      : notLoweredYet(message)(error), name);
  }
});

test("a selected receiver read is the actual receiver slot, not a supplied argument, copied object or owner-name guess", () => {
  for (const passing of ["by-value", "move", "byref-readonly", "byref-readwrite", "borrow-shared", "borrow-mut"]) {
    const name = `receiver.actual.${passing}`;
    const program = shaped(name, [["self", "this", T.int32, passing], ["x", "required", T.int32]], T.int32,
      b => b.arithmetic({ $: "receiver", ...b.keyword("ThisKeyword", T.int32, "receiver"),
        tsonic: { ...value(T.int32), role: "receiver", owner: def(`${name}.class`) } }, "PlusToken",
      directApplication(b, `${name}.effect`, []), T.int32, plus("int32", T.int32)), { receiver: T.int32 });
    const mir = lower(program);
    assert.deepEqual(mir.entries.map(entry => entry.provided), [1]);
    assert.deepEqual(mir.locals[0].role, { kind: "receiver" });
    assert.equal(mir.locals[0].mode, passing);
    assert.deepEqual(mir.locals[0].source, { body: program.tir.body, local: 0 });
    const copies = mir.blocks.flatMap(block => block.statements)
      .filter(statement => statement.kind === "assign" && statement.tir.node === program.at("receiver"));
    assert.equal(copies.length, passing === "by-value" || passing === "move" ? 0 : 1);
    if (copies.length !== 0) assert.equal(rootLocalOf(mir, copies[0].value.operand.place), 0);
    const size = mir.locals.length + mir.places.length + mir.constants.length + mir.blocks.length
      + mir.blocks.reduce((total, block) => total + block.statements.length, 0);
    for (let maximumRecords = 0; maximumRecords < size; maximumRecords += 1)
      assert.equal(produced({ ...deps, limits: { maximumRecords } }, program.tir, []).kind, "refused", `${name} under ${maximumRecords}`);
    assert.equal(produced({ ...deps, limits: { maximumRecords: size } }, program.tir, []).kind, "ok");
  }
});

test("receiver lowering does not guess lexical captures, accept two receiver rows or invent a missing selected value", () => {
  const make = name => shaped(name, [["self", "this", T.int32]], T.int32,
    b => ({ ...b.keyword("ThisKeyword", T.int32, "receiver"), tsonic: { ...value(T.int32), role: "receiver", owner: def(`${name}.class`) } }), { receiver: T.int32 });
  const missing = make("receiver.missing");
  missing.tir.params = [];
  assert.throws(() => produced(deps, missing.tir, []), notLoweredYet("a receiver without its selected receiver row"));
  const role = make("receiver.role");
  role.tir.root.tsonic.role = "value";
  assert.throws(() => produced(deps, role.tir, []), error => defectOfLowerMir(error)
    && error.message === `${CALLER_DEFECT}a receiver expression without its selected receiver`);
  const duplicate = make("receiver.duplicate");
  duplicate.tir.params.push(duplicate.tir.params[0]);
  assert.throws(() => produced(deps, duplicate.tir, []), error => defectOfLowerMir(error)
    && error.message === `${CALLER_DEFECT}two selected receiver parameter rows`);
  for (const field of ["foreign", "local", "passing"]) {
    const invalid = make(`receiver.parameter.${field}`);
    if (field === "foreign") invalid.tir.params[0].tsonic.local.body = bodyId("receiver.another-body");
    else invalid.tir.params[0].tsonic[field] = null;
    assert.throws(() => produced(deps, invalid.tir, []), error => defectOfLowerMir(error)
      && error.message === `${CALLER_DEFECT}a parameter requires its actual executing body local and passing`);
  }
});

function initializedBinding(name, keyword = "let", mode = "captured-value", outer = false, repeat = false, rootOf = null) {
  const b = builders(name);
  const initializerName = `${name}.slot`;
  const initializer = bodyId(initializerName, "initializer");
  const source = { body: outer ? bodyId(`${name}.outer`) : b.body, local: outer ? 7 : 0 };
  const capture = { local: source, capture: mode };
  const childBuilder = builders(initializerName, "initializer");
  const child = typedBody(initializerName, { role: "initializer", signature: signature(initializerName, [], T.int32), completion: T.int32,
    locals: [["input", "capture", T.int32, false, source]], captures: [capture],
    root: childBuilder.id("input", 0, T.int32) });
  const statements = Array.from({ length: repeat ? 2 : 1 }, (_, index) => {
    const declaration = { $: index === 0 ? "declaration" : "declaration-again", ...b.variable(b.declName("slot", 1), 1, T.int32, b.num("7", T.int32), initializer) };
    const statement = b.declare([declaration]);
    statement.declarationList.flags = keyword === "var" ? [] : [keyword === "let" ? "Let" : "Const"];
    return statement;
  });
  const program = typedBody(name, { signature: signature(name, outer ? [] : [["input", T.int32]], T.int32), completion: T.int32,
    locals: [["input", outer ? "capture" : "parameter", T.int32, false, outer ? source : null], ["slot", "binding", T.int32, true]],
    params: outer ? [] : [[0, "required", T.int32]], captures: outer ? [capture] : [], nestedBodies: [initializer],
    root: rootOf === null ? b.block(...statements, b.returns(b.id("slot", 1, T.int32))) : rootOf(b, statements) });
  program.tir.locals[1].declaration = { kind: "body", value: program.nodeRef("declaration") };
  const input = { instance: { body: initializer, bindings: SELECTED_BINDINGS }, captures: [capture], signature: child.tir.signature };
  program.bodyOf = instance => instanceKey(instance) === instanceKey(input.instance) ? child.tir : null;
  return { program, input, child };
}

function initializedModule(name, count = 2) {
  const builder = builders(name, "module");
  const children = Array.from({ length: count }, (_, index) => {
    const childName = `${name}.value${index}`;
    const childBuilder = builders(childName, "initializer");
    return typedBody(childName, { role: "initializer", signature: signature(childName, [], T.bool), completion: T.bool,
      root: childBuilder.keyword(index % 2 === 0 ? "TrueKeyword" : "FalseKeyword", T.bool) });
  });
  const declarations = children.map((child, index) => {
    const declaration = builder.variable(builder.declName(`value${index}`, index), index, T.bool,
      builder.keyword(index % 2 === 0 ? "TrueKeyword" : "FalseKeyword", T.bool), child.tir.body);
    declaration.$ = `value${index}`;
    declaration.tsonic.declaration = { kind: "definition", definition: def(`${name}.value${index}`) };
    declaration.name.tsonic.declaration = declaration.tsonic.declaration;
    const statement = builder.declare([declaration]);
    statement.declarationList.flags = [index % 2 === 0 ? "Const" : "Let"];
    return statement;
  });
  const program = typedBody(name, { role: "module", signature: signature(name, [], T.void), completion: T.void,
    nestedBodies: children.map(child => child.tir.body),
    root: { kind: "SourceFile", statements: { $list: true, nodes: declarations },
      endOfFileToken: { kind: "EndOfFile", tsonic: null }, languageVariant: "Standard", scriptKind: "TS",
      commentDirectives: [], pragmas: [], checkJsDirective: null, tsonic: { module: MODULE, template: null } } });
  const statements = program.tir.root.statements.nodes;
  program.tir.root.statements.nodes = statements.map(node => ({ kind: "ready-statement", node }));
  for (const [index, child] of children.entries()) child.tir.root = statements[index].declarationList.declarations.nodes[0].initializer;
  const inputs = children.map(child => ({ instance: { body: child.tir.body, bindings: child.tir.bindings }, captures: [], signature: child.tir.signature }));
  program.bodyOf = instance => children.find(child => instanceKey(instance) === instanceKey({ body: child.tir.body, bindings: child.tir.bindings }))?.tir ?? null;
  return { program, children, inputs };
}

test("selected module variables execute separate initializers once in authored order into actual static definitions", () => {
  for (const count of [0, 1, 3]) {
    const { program, children, inputs } = initializedModule(`module.variables.${count}`, count);
    for (const child of children) lower(child);
    const mir = lower(program, inputs);
    assert.deepEqual(mir.entries, [{ provided: 0, block: 0 }]);
    assert.equal(mir.locals.length, 0);
    assert.equal(mir.constants.length, 0, "the module never reexecutes separate initializer syntax");
    const calls = mir.blocks.filter(block => block.terminator.kind === "call").map(block => block.terminator);
    assert.deepEqual(calls.map(call => call.callee.instance), inputs.map(input => input.instance));
    for (const [index, call] of calls.entries()) {
      assert.equal(call.tir.node, program.at(`value${index}`));
      assert.deepEqual(mir.places[call.destination].base, { kind: "static", definition: def(`module.variables.${count}.value${index}`) });
      assert.equal(mir.places[call.destination].storage, T.bool);
      assert.deepEqual([call.arguments, call.callee.captures, call.unwind], [[], [], { kind: "escape" }]);
    }
    assert.deepEqual(mir.blocks.at(-1).terminator.value, null);
    const size = mir.locals.length + mir.places.length + mir.constants.length + mir.blocks.length
      + mir.blocks.reduce((total, block) => total + block.statements.length, 0);
    for (let maximumRecords = 0; maximumRecords < size; maximumRecords += 1)
      assert.equal(produced({ ...deps, limits: { maximumRecords } }, program.tir, inputs).kind, "refused");
    assert.equal(produced({ ...deps, limits: { maximumRecords: size } }, program.tir, inputs).kind, "ok");
  }
});

test("module declarations without initializers have no fabricated value, local lifetime or child execution", () => {
  const { program, inputs } = initializedModule("module.uninitialized", 1);
  const list = program.tir.root.statements.nodes[0].node.declarationList;
  list.flags = ["Let"];
  const declaration = list.declarations.nodes[0];
  declaration.initializer = null;
  declaration.tsonic.initializer = null;
  program.tir.nestedBodies = [];
  const mir = lower(program);
  assert.deepEqual([mir.locals, mir.constants, mir.blocks[0].statements], [[], [], []]);
  assert.deepEqual(mir.places, [{ id: 0, origin: declaration.origin, storage: T.bool,
    base: { kind: "static", definition: declaration.tsonic.declaration.definition } }]);
  assert.equal(mir.blocks.length, 1);
  assert.deepEqual(mir.blocks[0].terminator.value, null);
  assert.equal(produced({ ...deps, limits: { maximumRecords: 1 } }, program.tir, []).kind, "refused");
  assert.deepEqual(produced({ ...deps, limits: { maximumRecords: 2 } }, program.tir, []).value, mir);
  declaration.initializer = { kind: "FalseKeyword", tsonic: value(T.bool) };
  assert.throws(() => produced(deps, program.tir, inputs), notLoweredYet("a variable initializer without its placed execution"));
});

test("uninitialized static absence uses exactly the actual selected carrier and no child", () => {
  for (const storage of [optionalBool, T.absence]) {
    const { program } = initializedModule(`triage.module.absence.${storage}`, 1);
    const list = program.tir.root.statements.nodes[0].node.declarationList;
    const declaration = list.declarations.nodes[0];
    list.flags = ["Let"];
    declaration.initializer = null;
    declaration.tsonic.initializer = null;
    declaration.tsonic.storage = storage;
    declaration.name.tsonic.storage = storage;
    program.tir.nestedBodies = [];
    const mir = lowerAtBounds(program, 4);
    assert.deepEqual([mir.locals, mir.places.map(place => place.storage), mir.constants.map(constant => [constant.type, constant.value])],
      [[], [storage], [[storage, { kind: "literal", value: { kind: "absence" } }]]]);
    assert.equal(mir.blocks[0].statements[0].tir.node, declaration.id);
    assert.equal(mir.blocks[0].terminator.kind, "return");
  }
});

test("module callable-header and sparse statement inputs are actual caller defects", () => {
  const { program } = initializedModule("module.invalid", 0);
  program.tir.params = [{}];
  assert.throws(() => produced(deps, program.tir, []), error => defectOfLowerMir(error) && error.message.includes("module initializer has callable parameters"));
  program.tir.params = [];
  program.tir.root.statements.nodes.length = 1;
  assert.throws(() => produced(deps, program.tir, []), /module statement list has a hole/);
});

test("module declaration streaming stops before later statement or declaration reads on the original record refusal", () => {
  for (const vector of ["statements", "declarations"]) {
    const { program, inputs } = initializedModule(`module.stream.${vector}`, 1);
    const statement = program.tir.root.statements.nodes[0].node;
    const nodes = vector === "statements" ? program.tir.root.statements.nodes : statement.declarationList.declarations.nodes;
    nodes.length = 10000;
    Object.defineProperty(nodes, 1, { configurable: true, get() { throw new Error("later module input read after refusal"); } });
    const result = produced({ ...deps, limits: { maximumRecords: 1 } }, program.tir, inputs);
    assert.equal(result.kind, "refused");
    assert.equal(result.diagnostics.length, 1);
  }
  const { program, inputs } = initializedModule("module.destructured", 1);
  program.tir.root.statements.nodes[0].node.declarationList.declarations.nodes[0].name = { kind: "ObjectBindingPattern", elements: { nodes: [] }, tsonic: null };
  assert.throws(() => produced(deps, program.tir, inputs), notLoweredYet("a destructuring variable declaration"));
});

test("module callable and binding declarations do not execute nested bodies or invent import and export work", () => {
  const { program } = initializedModule("module.declarations", 0);
  const builder = builders("module.declarations", "module");
  const statement = { kind: "FunctionDeclaration", modifiers: null, typeParameters: null,
    parameters: { $list: true, nodes: [] }, type: null, fullSignature: null, asteriskToken: null,
    name: null, body: builder.block(builder.throws(builder.num("7", T.int32))),
    tsonic: { definition: def("module.declarations.function"), parameters: [], signatures: [], template: null, attributes: [] } };
  const target = { target: "project", module: MODULE };
  const specifier = () => ({ kind: "StringLiteral", text: "module", singleQuote: false, hasExtendedUnicodeEscape: false,
    tsonic: { role: "module-specifier", target } });
  const aliasDefinition = def("module.declarations.alias");
  const interfaceDefinition = def("module.declarations.interface");
  const name = (text, definition) => ({ kind: "Identifier", text,
    tsonic: { role: "declaration-name", declaration: definition, storage: null } });
  const interfaceType = declareType({ kind: "declared", definition: interfaceDefinition, facet: "instance", extent: null, arguments: [] });
  const statements = [statement,
    { kind: "TypeAliasDeclaration", modifiers: null, typeParameters: null, name: name("Alias", aliasDefinition),
      type: { kind: "BooleanKeyword", tsonic: { type: T.bool, declarations: [] } },
      tsonic: { definition: aliasDefinition, parameters: [], type: T.bool } },
    { kind: "InterfaceDeclaration", modifiers: null, typeParameters: null, name: name("Fields", interfaceDefinition),
      heritageClauses: null, members: { $list: true, nodes: [] },
      tsonic: { definition: interfaceDefinition, parameters: [], type: interfaceType, members: [] } },
    { kind: "ImportDeclaration", modifiers: null, importClause: null, moduleSpecifier: specifier(), attributes: null,
      tsonic: { definition: def("module.declarations.import"), target } },
    { kind: "ExportDeclaration", modifiers: null, isTypeOnly: false, exportClause: null, moduleSpecifier: specifier(), attributes: null,
      tsonic: { definition: def("module.declarations.export"), target } }];
  const sealed = seal("module.declarations", { ...program.tir.root, statements: { $list: true, nodes: statements },
    endOfFileToken: { kind: "EndOfFile", tsonic: null } }, "module");
  sealed.root.statements.nodes = sealed.root.statements.nodes.map(node =>
    ({ kind: node.kind === "FunctionDeclaration" ? "ready-callable" : "ready-statement", node }));
  program.tir.root = sealed.root;
  const mir = lower(program);
  assert.deepEqual([mir.locals, mir.places, mir.constants, mir.blocks[0].statements], [[], [], [], []]);
  assert.equal(mir.blocks[0].terminator.kind, "return");
});

test("a named initializer executes once at its actual Identifier declaration into the selected owned slot", () => {
  for (const keyword of ["var", "let", "const"]) for (const mode of ["captured-value", "captured-location"]) for (const outer of [false, true]) {
    const name = `binding.initializer.${keyword}.${mode}.${outer}`;
    const { program, input, child } = initializedBinding(name, keyword, mode, outer);
    lower(child);
    const mir = lower(program, [input]);
    const path = walk(mir);
    const calls = internalCallsOn(path);
    assert.equal(calls.length, 1);
    const call = mir.blocks.find(block => block.terminator.kind === "call").terminator;
    assert.equal(call.tir.node, program.at("declaration"));
    assert.deepEqual(call.callee.instance, input.instance);
    assert.deepEqual(call.callee.captures.map(capture => [capture.local, capture.capture]), input.captures.map(capture => [capture.local, capture.capture]));
    assert.equal(rootLocalOf(mir, call.callee.captures[0].place), 0);
    const slot = mir.locals.find(local => local.source?.body === program.tir.body && local.source.local === 1);
    assert.equal(slot.role.kind, "user");
    assert.equal(slot.mode, "local");
    assert.equal(rootLocalOf(mir, call.destination), slot.id);
    assert.deepEqual(call.arguments, []);
    assert.deepEqual(call.unwind, { kind: "escape" });
    assert.equal(mir.constants.length, 0, "parent does not execute the initializer syntax a second time");
    assert.equal(mir.blocks.flatMap(block => block.statements).filter(statement => statement.kind === "storage-live" && statement.local === slot.id).length, 1);
    assert.equal(mir.blocks.at(-1).terminator.value.place, call.destination);
    const size = mir.locals.length + mir.places.length + mir.constants.length + mir.blocks.length
      + mir.blocks.reduce((total, block) => total + block.statements.length, 0);
    for (let maximumRecords = 0; maximumRecords < size; maximumRecords += 1)
      assert.equal(produced({ ...deps, limits: { maximumRecords } }, program.tir, [input]).kind, "refused", `${name} under ${maximumRecords}`);
    assert.equal(produced({ ...deps, limits: { maximumRecords: size } }, program.tir, [input]).kind, "ok");
  }
});

test("lexical slot lifetimes end at actual normal and break exits while function-scoped var is not reset at its statement", () => {
  for (const transfer of ["normal", "break", "continue"]) {
    const name = `binding.scope.${transfer}`;
    const b = builders(name);
    const declaration = { $: "declaration", ...b.variable(b.declName("slot", 1), 1, T.int32) };
    const variables = b.declare([declaration]);
    variables.declarationList.flags = ["Let"];
    const write = { $: "write", ...b.expressionStatement(b.assign(b.target("slot", 1, T.int32), "EqualsToken", b.num("1", T.int32), T.int32, T.int32)) };
    const body = b.block(variables, write, ...(transfer === "normal" ? [] : [transfer === "break" ? selectedBreak(b, "loop") : selectedContinue(b, "loop", false)]));
    const program = typedBody(name, { signature: signature(name, [["flag", T.bool]], T.void), completion: T.void,
      locals: [["flag", "parameter", T.bool], ["slot", "binding", T.int32, true]], params: [[0, "required", T.bool]],
      root: b.block({ $: "loop", ...b.whileLoop(b.id("flag", 0, T.bool), body) }) });
    const mir = lower(program);
    let switches = 0;
    const path = walk(mir, { decide: point => point.kind === "switch" ? switches++ === 0 : "normal" });
    const slot = mir.locals.find(local => local.role.kind === "user");
    const markers = statementsOn(path).filter(event => (event.kind === "storage-live" || event.kind === "storage-dead") && event.record.local === slot.id);
    assert.deepEqual(markers.map(event => event.kind), ["storage-live", "storage-dead"]);
    assert.equal(path.end, "return");
    const size = mir.locals.length + mir.places.length + mir.constants.length + mir.blocks.length
      + mir.blocks.reduce((total, block) => total + block.statements.length, 0);
    for (let maximumRecords = 0; maximumRecords < size; maximumRecords += 1)
      assert.equal(produced({ ...deps, limits: { maximumRecords } }, program.tir, []).kind, "refused", `${name} under ${maximumRecords}`);
  }
  const { program, input } = initializedBinding("binding.var.repeated", "var", "captured-value", false, true);
  const mir = lower(program, [input]);
  const slot = mir.locals.find(local => local.role.kind === "user");
  assert.equal(mir.blocks.flatMap(block => block.statements).filter(statement => statement.kind === "storage-live" && statement.local === slot.id).length, 1);
  assert.equal(mir.blocks.filter(block => block.terminator.kind === "call").length, 2);
});

test("for declaration initialization executes once and ends only the lexical header at its loop exit", () => {
  for (const keyword of ["var", "let", "const"]) for (const transfer of ["normal", "break", "continue"]) {
    const name = `binding.for.${keyword}.${transfer}`;
    const { program, input } = initializedBinding(name, keyword, "captured-value", false, false, (b, statements) =>
      b.block({ $: "loop", ...b.forLoop(statements[0].declarationList,
        b.keyword(transfer === "normal" ? "FalseKeyword" : "TrueKeyword", transfer === "normal" ? literalFalse : literalTrue), null,
        transfer === "normal" ? b.block() : b.block(transfer === "break" ? selectedBreak(b, "loop") : selectedContinue(b, "loop", false))) },
      b.returns(keyword === "var" ? b.id("slot", 1, T.int32) : b.id("input", 0, T.int32))));
    const mir = lower(program, [input]);
    const call = mir.blocks[0].terminator;
    assert.equal(call.kind, "call");
    assert.deepEqual(call.callee.instance, input.instance);
    assert.equal(mir.blocks.filter(block => block.terminator.kind === "call").length, 1);
    const slot = mir.locals.find(local => local.role.kind === "user");
    const markers = mir.blocks.flatMap(block => block.statements).filter(statement => statement.local === slot.id
      && (statement.kind === "storage-live" || statement.kind === "storage-dead"));
    assert.deepEqual(markers.map(marker => marker.kind), keyword === "var" || transfer === "continue"
      ? ["storage-live"] : ["storage-live", "storage-dead"], name);
    assert.equal(mir.blocks[0].statements[0].kind, "storage-live");
    const size = mir.locals.length + mir.places.length + mir.constants.length + mir.blocks.length
      + mir.blocks.reduce((total, block) => total + block.statements.length, 0);
    for (let maximumRecords = 0; maximumRecords < size; maximumRecords += 1)
      assert.equal(produced({ ...deps, limits: { maximumRecords } }, program.tir, [input]).kind, "refused", `${name} under ${maximumRecords}`);
    assert.equal(produced({ ...deps, limits: { maximumRecords: size } }, program.tir, [input]).kind, "ok");
  }
});

test("declarations keep actual missing initializer, destination and qualified capture inputs as defects, not inline defaults", () => {
  const cases = [
    ["missing-input", () => {}, () => [], "a placed initializer has no supplied execution data"],
    ["duplicate-input", () => {}, input => [input, input], "ambiguous supplied initializer executions"],
    ["signature", (program, input) => { input.signature = program.tir.signature; }, input => [input], "an initializer signature differs from its selected destination"],
    ["capture", (_program, input) => { input.captures = [{ local: { body: bodyId("binding.unknown"), local: 9 }, capture: "captured-location" }]; }, input => [input], "an initializer capture has no selected caller storage"],
    ["storage", program => { program.tir.locals[1].storage = T.bool; }, input => [input], "a variable declaration differs from its selected local storage"],
    ["foreign", program => { program.tir.root.statements.nodes[0].declarationList.declarations.nodes[0].tsonic.declaration.local.body = bodyId("binding.other"); }, input => [input], "a variable declaration differs from its selected local storage"],
    ["duplicate-local", program => { program.tir.root.statements.nodes.splice(1, 0, program.tir.root.statements.nodes[0]); }, input => [input], "a local storage slot is declared twice"],
  ];
  for (const [name, amend, inputs, message] of cases) {
    const { program, input } = initializedBinding(`binding.invalid.${name}`);
    amend(program, input);
    assert.throws(() => produced(deps, program.tir, inputs(input)), error => defectOfLowerMir(error) && error.message === `${CALLER_DEFECT}${message}`, name);
  }
  const { program, input } = initializedBinding("binding.missing.placement");
  program.tir.root.statements.nodes[0].declarationList.declarations.nodes[0].tsonic.initializer = null;
  assert.throws(() => produced(deps, program.tir, [input]), notLoweredYet("a variable initializer without its placed execution"));
});

test("variable lists require actual declarations and local storage selections", () => {
  for (const keyword of ["var", "let"]) for (const missing of [false, true]) {
    const { program, input } = initializedBinding(`binding.list.${keyword}.${missing}`, keyword);
    const list = program.tir.root.statements.nodes[0].declarationList;
    list.declarations.nodes = missing ? [{ kind: "MissingDeclaration", origin: list.origin }] : [];
    const message = missing ? "a missing variable declaration" : "an empty variable declaration list";
    assert.throws(() => produced(deps, program.tir, [input]), error => defectOfLowerMir(error)
      && error.message === `${CALLER_DEFECT}${message}`);
  }
  const { program, input } = initializedBinding("binding.definition");
  program.tir.root.statements.nodes[0].declarationList.declarations.nodes[0].tsonic.declaration = { kind: "definition" };
  assert.throws(() => produced(deps, program.tir, [input]), notLoweredYet("a variable declaration of kind definition"));
});

test("an actual selected expression body returns its value at that occurrence without a fabricated statement", () => {
  for (const [name, execution] of Object.entries(EXECUTIONS)) {
    const program = shaped(`expression.root.${name}`, [["x", "required", T.int32]], T.int32,
      b => ({ $: "root", ...b.prefix(b.id("x", 0, T.int32), "MinusToken", T.int32, native("-", "int32", [T.int32], T.int32, execution)) }));
    const mir = lower(program);
    const path = walk(mir);
    assert.equal(path.events.at(-1).kind, "return");
    assert.equal(path.events.at(-1).node, program.at("root"));
    assert.equal(mir.blocks[0].tir.node, program.at("root"));
    const size = mir.locals.length + mir.places.length + mir.constants.length + mir.blocks.length
      + mir.blocks.reduce((count, block) => count + block.statements.length, 0);
    for (let maximumRecords = 0; maximumRecords < size; maximumRecords += 1)
      assert.equal(produced({ ...deps, limits: { maximumRecords } }, program.tir, []).kind, "refused", `expression root ${name} under ${maximumRecords}`);
    assert.equal(produced({ ...deps, limits: { maximumRecords: size } }, program.tir, []).kind, "ok");
  }
  const scalar = shaped("expression.root.literal", [], T.int32, b => b.num("17", T.int32));
  const mir = lower(scalar);
  assert.deepEqual(mir.blocks[0].terminator.value, { kind: "constant", constant: 0 });
  assert.equal(mir.blocks[0].terminator.tir.node, scalar.tir.root.id);
  const identity = shaped("expression.root.identity", [["x", "required", T.int32]], T.int32, b => b.id("x", 0, T.int32));
  assert.deepEqual(lower(identity).blocks[0].terminator.value, { kind: "place", place: 0 });
});

test("incoming capture slots retain actual value and location modes before writing operations", () => {
  for (const mode of ["captured-value", "captured-location"]) {
    const outer = { body: bodyId(`capture.outer.${mode}`), local: 0 };
    const program = shaped(`capture.incoming.${mode}`, [["x", "required", T.int32]], T.int32, b => b.block(b.returns(
      b.arithmetic({ $: "capture-read", ...b.id("saved", 1, T.int32) }, "PlusToken",
        b.prefix(b.id("x", 0, T.int32), "MinusToken", T.int32, native("-", "int32", [T.int32], T.int32, EXECUTIONS.writes)), T.int32, plus("int32", T.int32)))));
    program.tir.locals.push({ id: 1, declaration: { kind: "body", value: program.nodeRef("capture-read") }, name: "saved", role: "capture",
      capturedFrom: outer, mutable: true, storage: T.int32 });
    program.tir.captures = [{ local: outer, capture: mode }];
    const mir = lower(program);
    assert.deepEqual(mir.locals[1], { id: 1, storage: T.int32, role: { kind: "capture", index: 0 }, mode,
      source: outer, origin: program.tir.root.origin });
    assert.equal(mir.blocks.flatMap(block => block.statements).some(statement => statement.kind === "storage-live" && statement.local === 1), false);
    const copies = mir.blocks[0].statements.filter(statement => statement.kind === "assign" && statement.tir.node === program.at("capture-read"));
    assert.equal(copies.length, mode === "captured-value" ? 0 : 1);
    if (copies.length !== 0) {
      assert.deepEqual(copies[0].value, { kind: "use", operand: { kind: "place", place: 0 } });
      assert.equal(rootLocalOf(mir, copies[0].value.operand.place), 1);
    }
    const size = mir.locals.length + mir.places.length + mir.constants.length + mir.blocks.length
      + mir.blocks.reduce((count, block) => count + block.statements.length, 0);
    for (let maximumRecords = 0; maximumRecords < size; maximumRecords += 1)
      assert.equal(produced({ ...deps, limits: { maximumRecords } }, program.tir, []).kind, "refused", `incoming capture ${mode} under ${maximumRecords}`);
    assert.equal(produced({ ...deps, limits: { maximumRecords: size } }, program.tir, []).kind, "ok");
  }
});

test("qualified capture-row order joins actual local slots rather than names, local numbers or inventory position", () => {
  const first = { body: bodyId("capture.join.first"), local: 0 };
  const second = { body: first.body, local: 1 };
  const third = { body: bodyId("capture.join.third"), local: 0 };
  const program = shaped("capture.join", [], T.int32, b => b.block(b.returns({ $: "read", ...b.id("same", 1, T.int32) })));
  program.tir.captures = [{ local: third, capture: "captured-value" }, { local: first, capture: "captured-location" }, { local: second, capture: "captured-value" }];
  program.tir.locals = [first, second, third].map((from, id) => ({ id, declaration: { kind: "body", value: program.nodeRef("read") },
    name: "same", role: "capture", capturedFrom: from, mutable: true, storage: T.int32 }));
  const mir = lower(program);
  assert.deepEqual(mir.locals.map(local => [local.role, local.source, local.mode]), program.tir.captures.map((capture, index) =>
    [{ kind: "capture", index }, capture.local, capture.capture]));
  assert.deepEqual(mir.blocks[0].terminator.value, { kind: "place", place: 0 });
  assert.equal(rootLocalOf(mir, mir.blocks[0].terminator.value.place), 2);
  const size = mir.locals.length + mir.places.length + mir.blocks.length;
  for (let maximumRecords = 0; maximumRecords < size; maximumRecords += 1)
    assert.equal(produced({ ...deps, limits: { maximumRecords } }, program.tir, []).kind, "refused", `qualified capture under ${maximumRecords}`);
  assert.equal(produced({ ...deps, limits: { maximumRecords: size } }, program.tir, []).kind, "ok");
});

test("actual outer-qualified reads select the retained capture instead of a same-number own or foreign local", () => {
  for (const mode of ["captured-value", "captured-location"]) {
    const name = `capture.lookup.${mode}`;
    const first = { body: bodyId(`${name}.first`), local: 0 };
    const second = { body: bodyId(`${name}.second`), local: 0 };
    const program = shaped(name, [["same", "required", T.int32]], T.int32, builder => builder.block(builder.returns(
      builder.arithmetic(builder.id("same", 0, T.int32), "PlusToken", { $: "capture-source", ...builder.id("same", 1, T.int32,
        { payload: { resolution: { kind: "local", local: first } } }) }, T.int32, plus("int32", T.int32)))));
    program.tir.locals.push(...[first, second].map((source, index) => ({ id: index + 1,
      declaration: { kind: "body", value: program.nodeRef("capture-source") }, name: "same", role: "capture",
      capturedFrom: source, mutable: true, storage: T.int32 })));
    program.tir.captures = [{ local: second, capture: mode }, { local: first, capture: mode }];
    const expression = program.tir.root.statements.nodes[0].expression;
    for (const [source, capture] of [[first, 1], [second, 0]]) {
      expression.right.tsonic.resolution.local = source;
      const mir = lower(program);
      const calculation = mir.blocks.flatMap(block => block.statements).find(row => row.kind === "assign" && row.value.kind === "binary");
      assert.equal(rootLocalOf(mir, calculation.value.left.place), 0);
      const selected = mir.locals[rootLocalOf(mir, calculation.value.right.place)];
      assert.deepEqual(selected.role, { kind: "capture", index: capture });
      assert.deepEqual(selected.source, source);
      assert.equal(selected.mode, mode);
      const size = mir.locals.length + mir.places.length + mir.constants.length + mir.blocks.length
        + mir.blocks.reduce((total, block) => total + block.statements.length, 0);
      for (let maximumRecords = 0; maximumRecords <= size; maximumRecords += 1)
        assert.equal(produced({ ...deps, limits: { maximumRecords } }, program.tir, []).kind,
          maximumRecords === size ? "ok" : "refused");
    }
    for (const source of [{ body: program.tir.body, local: 99 }, { body: first.body, local: 99 },
      { body: bodyId(`${name}.unselected`), local: 0 }]) {
      expression.right.tsonic.resolution.local = source;
      assert.throws(() => produced(deps, program.tir, []), notLoweredYet("a local that is not a parameter of the body"));
    }
  }
});

test("outer-qualified assignment and by-place arguments use the same actual capture lookup", () => {
  for (const mode of ["captured-value", "captured-location"]) for (const form of ["assignment", "argument"]) {
    const name = `capture.lookup.${mode}.${form}`;
    const source = { body: bodyId(`${name}.outer`), local: 0 };
    const targetName = `${name}.target`;
    const target = signature(targetName, [["value", T.int32, "required", null, "byref-readwrite"]], T.int32);
    const program = shaped(name, [["own", "required", T.int32]], T.int32, builder => {
      const reference = { kind: "local", local: source };
      const destination = { $: "capture-target", ...builder.target("saved", 1, T.int32) };
      destination.tsonic.resolution = reference;
      return builder.block(builder.returns(form === "assignment"
        ? builder.assign(destination, "EqualsToken", builder.id("own", 0, T.int32), T.int32, T.int32)
        : builder.call(builder.global("target", targetName, T.unknown), [{ $: "actual-capture", ...builder.id("saved", 1, T.int32,
          { payload: { resolution: reference } }) }], T.int32,
        at => ({ callee: callee(targetName, target, [mapped(0, 0, "byref-readwrite")], T.int32), receiver: null,
          arguments: [{ kind: "provided", parameter: 0, expression: at("actual-capture") }] }))));
    });
    program.tir.locals.push({ id: 1, declaration: { kind: "body", value: program.nodeRef(form === "assignment" ? "capture-target" : "actual-capture") }, name: "saved", role: "capture",
      capturedFrom: source, mutable: true, storage: T.int32 });
    program.tir.captures = [{ local: source, capture: mode }];
    const mir = lower(program);
    const place = form === "assignment"
      ? mir.blocks.flatMap(block => block.statements).find(row => row.kind === "assign").place
      : mir.blocks.find(block => block.terminator.kind === "call").terminator.arguments[0].place;
    const selected = mir.locals[rootLocalOf(mir, place)];
    assert.deepEqual(selected.role, { kind: "capture", index: 0 });
    assert.deepEqual(selected.source, source);
    assert.equal(selected.mode, mode);
  }
});

test("capture index setup refuses a known impossible local count before reading any capture row", () => {
  const count = 10000;
  let rowsRead = 0;
  const program = shaped("capture.count.before-index", [], T.void, b => b.block());
  program.tir.captures = Array.from({ length: count }, (_, local) => ({ capture: "captured-value", get local() {
    rowsRead += 1;
    return { body: bodyId("capture.count.outer"), local };
  } }));
  for (const maximumRecords of [0, 1, count - 1]) {
    const result = produced({ ...deps, limits: { maximumRecords } }, program.tir, []);
    assert.equal(result.kind, "refused");
    assert.equal(rowsRead, 0);
  }
});

test("a malformed incoming capture relation is a caller defect, never a guessed mode or storage slot", () => {
  const cases = [
    ["self", program => { program.tir.captures[0].local = { body: program.tir.body, local: 0 }; }, "a capture names its own body"],
    ["undecided", program => { program.tir.captures[0].capture = null; }, "an undecided capture in a selected body"],
    ["duplicate", program => { program.tir.captures.push(program.tir.captures[0]); }, "a duplicate qualified capture"],
    ["no-source", program => { program.tir.locals[0].capturedFrom = null; }, "a captured local without its qualified source"],
    ["no-row", program => { program.tir.locals[0].capturedFrom = { body: bodyId("capture.unlisted"), local: 0 }; }, "a captured local absent from the capture rows"],
    ["no-local-number", program => { program.tir.locals[0].capturedFrom = { ...program.tir.locals[0].capturedFrom, local: 7 }; }, "a captured local absent from the capture rows"],
    ["duplicate-slot", program => { program.tir.locals.push({ ...program.tir.locals[0], id: 1 }); }, "two local slots for one capture"],
    ["missing-slot", program => { program.tir.locals = []; }, "a capture without its actual local slot"],
    ["concrete-undecided", program => { program.tir.captures[0].capture = null; program.tir.dependence = "binding-dependent";
      program.tir.bindings = { kind: "instantiated", bindings: EMPTY_BINDINGS }; }, "an undecided capture in a selected body"],
  ];
  for (const [name, change, message] of cases) {
    const source = { body: bodyId(`capture.malformed.outer.${name}`), local: 0 };
    const program = shaped(`capture.malformed.${name}`, [], T.void, b => b.block());
    program.tir.captures = [{ local: source, capture: "captured-value" }];
    program.tir.locals = [{ id: 0, declaration: { kind: "body", value: { body: program.tir.body, node: 0 } }, name: "same", role: "capture",
      capturedFrom: source, mutable: false, storage: T.int32 }];
    change(program);
    assert.throws(() => produced(deps, program.tir, []), error => defectOfLowerMir(error) && error.message === `${CALLER_DEFECT}${message}`, name);
  }
});

test("boolean if conditions select exact branches and join only paths that continue", () => {
  const rows = [["flag", "required", T.bool], ["a", "required", T.int32], ["b", "required", T.int32]];
  for (const thenReturns of [false, true]) for (const elseKind of ["none", "empty", "return"]) {
    const program = shaped(`if.${thenReturns}.${elseKind}`, rows, T.int32, b => b.block(
      { $: "if", ...b.ifElse({ $: "condition", ...b.id("flag", 0, T.bool) },
        thenReturns ? { $: "then", ...b.returns(b.id("a", 1, T.int32)) } : b.block(),
        elseKind === "none" ? null : elseKind === "return" ? { $: "else", ...b.returns(b.id("b", 2, T.int32)) } : b.block()) },
      { $: "after", ...b.returns(b.id("b", 2, T.int32)) }));
    const mir = lower(program);
    const condition = mir.blocks[0].terminator;
    assert.equal(condition.kind, "switch");
    assert.equal(condition.tir.node, program.at("if"));
    for (const choice of [false, true]) {
      const path = walk(mir, { decide: () => choice });
      const returned = path.events.at(-1);
      const expected = choice && thenReturns ? "then" : !choice && elseKind === "return" ? "else" : "after";
      assert.equal(returned.node, program.at(expected), `${thenReturns}/${elseKind}/${choice}`);
      assert.equal(returned.kind, "return");
      assert.equal(path.events.filter(item => item.kind === "switch").length, 1, "condition is evaluated at one control point");
    }
    if (thenReturns && elseKind === "return") assert.equal(recordsOf(mir).some(item => item.node === program.at("after")), false,
      "two returning branches do not manufacture a reachable join");
    const size = mir.locals.length + mir.places.length + mir.constants.length + mir.blocks.length
      + mir.blocks.reduce((count, block) => count + block.statements.length, 0);
    for (let maximumRecords = 0; maximumRecords < size; maximumRecords += 1)
      assert.equal(produced({ ...deps, limits: { maximumRecords } }, program.tir, []).kind, "refused", `if ${thenReturns}/${elseKind} under ${maximumRecords}`);
    assert.equal(produced({ ...deps, limits: { maximumRecords: size } }, program.tir, []).kind, "ok");
  }
});

test("if literal case constants retain actual boolean literal carriers without inventing a different type", () => {
  for (const [kind, type, choice] of [["TrueKeyword", literalTrue, true], ["FalseKeyword", literalFalse, false]]) {
    const program = shaped(`if.literal.${choice}`, [], T.int32, b => b.block(b.ifElse(b.keyword(kind, type),
      { $: "then", ...b.returns(b.num("1", T.int32)) }, { $: "else", ...b.returns(b.num("2", T.int32)) })));
    const mir = lower(program);
    const selected = mir.constants.find(constant => constant.type === type);
    assert.equal(selected.type, type);
    assert.deepEqual(selected.value, { kind: "literal", value: { kind: "boolean", value: choice } });
    assert.equal(walk(mir, { decide: () => choice }).events.at(-1).node, program.at(choice ? "then" : "else"));
    assert.equal(recordsOf(mir).some(item => item.kind === "switch"), false, "the actual literal type leaves no runtime uncertainty");
  }
  const program = shaped("if.no-selected-truth", [["value", "required", T.int32]], T.void,
    b => b.block(b.ifElse(b.id("value", 0, T.int32), b.block())));
  assert.throws(() => produced(deps, program.tir, []), notLoweredYet("a condition without a selected boolean conversion"));
  const string = shaped("if.no-string-truth", [["value", "required", T.string]], T.void,
    b => b.block(b.ifElse(b.id("value", 0, T.string), b.block())));
  assert.throws(() => produced(deps, string.tir, []), notLoweredYet("a condition without a selected boolean conversion"));
  for (const [type, choice] of [[literalTrue, true], [literalFalse, false], [T.bool, true]]) {
    const literal = shaped(`if.known.${type}.${choice}`, [], choice ? T.int32 : T.void,
      b => b.block(b.ifElse(b.keyword(choice ? "TrueKeyword" : "FalseKeyword", type), choice ? b.returns(b.num("1", T.int32)) : b.block())));
    assert.equal(lower(literal).blocks[0].terminator.kind, "return", "a known true returning arm creates no fake fallthrough");
  }
});

test("known if and while observe the actual local before folding or refusing", () => {
  for (const [form, expected] of [["if", 7], ["while", 8]]) {
    const program = shaped(`triage.control.${form}`, [["flag", "required", literalFalse]], T.void, builder => {
      const condition = { $: "condition", ...builder.id("flag", 0, literalFalse) };
      const then = { $: "unread", ...builder.returns(null) };
      return builder.block(form === "if" ? builder.ifElse(condition, then) : builder.whileLoop(condition, then),
        { $: "after", ...builder.returns(null) });
    });
    const mir = lowerAtBounds(program, expected);
    const writes = mir.blocks.flatMap(block => block.statements).filter(row => row.kind === "assign");
    assert.equal(writes.length, 1);
    assert.equal(writes[0].tir.node, program.at("condition"));
    assert.deepEqual(mir.places[writes[0].value.operand.place].base, { kind: "local", local: 0 });
    assert.equal(mir.blocks.at(-1).terminator.tir.node, program.at("after"));
    assert.equal(mir.blocks.some(block => block.terminator.kind === "switch" || block.terminator.tir.node === program.at("unread")), false);
  }
});

test("a discarded known short-circuit retains its one real left observation", () => {
  const program = shaped("triage.logical.discard", [["flag", "required", literalTrue]], T.void, builder =>
    builder.block(builder.expressionStatement(shortCircuit(builder, "and", builder.id("flag", 0, literalTrue),
      builder.keyword("FalseKeyword", T.bool), T.bool, "right"))));
  const mir = lowerAtBounds(program, 7);
  assert.equal(mir.constants.length, 0);
  const writes = mir.blocks[0].statements.filter(row => row.kind === "assign");
  assert.equal(writes.length, 1);
  assert.equal(writes[0].tir.node, program.at("logical.control"));
  assert.deepEqual(mir.places[writes[0].value.operand.place].base, { kind: "local", local: 0 });
});

const booleanCaseEquality = (subject, label) => selected({ kind: "boolean-operator", operator: "===" }, [subject, label], T.bool);

test("false-only dispatch uses its actual default and pays a fallthrough block, not a lexical var slot", () => {
  const name = "triage.switch.false.fallthrough";
  const builder = builders(name);
  const declaration = { $: "variable", ...builder.variable(builder.declName("slot", 1), 1, T.bool) };
  const program = typedBody(name, { signature: signature(name, [["flag", T.bool]], T.void), completion: T.void,
    locals: [["flag", "parameter", T.bool], ["slot", "binding", T.bool, true]], params: [[0, "required", T.bool]],
    root: builder.block(builder.switchStatement(builder.id("flag", 0, T.bool), [
      builder.caseClause(builder.keyword("FalseKeyword", literalFalse), booleanCaseEquality(T.bool, literalFalse), builder.declare([declaration])),
      builder.caseClause(builder.keyword("FalseKeyword", literalFalse), booleanCaseEquality(T.bool, literalFalse), { $: "false", ...builder.returns(null) }),
      builder.defaultClause({ $: "true", ...builder.returns(null) }),
    ])) });
  program.tir.locals[1].declaration = { kind: "body", value: program.nodeRef("variable") };
  const mir = lowerAtBounds(program, 9);
  const [entry] = mir.blocks;
  assert.equal(entry.statements.filter(row => row.kind === "storage-live" && row.local === 1).length, 1);
  assert.equal(mir.blocks.slice(1).some(block => block.statements.some(row => row.local === 1)), false);
  const dispatch = entry.terminator;
  const first = mir.blocks[dispatch.otherwise].terminator;
  assert.equal(first.kind, "goto");
  assert.equal(mir.blocks[first.target].terminator.tir.node, program.at("false"));
  assert.equal(mir.blocks[dispatch.targets[0].target].terminator.tir.node, program.at("true"));
});

test("switch rejects duplicate default and retains an actual case-wrapper conversion", () => {
  for (const variant of ["duplicate", "convert"]) {
    const program = shaped(`triage.switch.${variant}`, [["flag", "required", T.bool]], T.void, builder => {
      const wrapped = { ...builder.paren({ $: "literal", ...builder.keyword("TrueKeyword", literalTrue) }, literalTrue), $: "wrapper",
        tsonic: at => {
          const from = { root: { kind: "body", value: builder.nodeRef(at("literal")) }, path: [] };
          const to = { root: { kind: "body", value: builder.nodeRef(at("wrapper")) }, path: [] };
          const embedding = { kind: "conversion", conversion: "literal-fit", check: { kind: "none" },
            proof: { steps: [{ from, to, rule: "literal-fit", premises: [] }], conclusion: 0 } };
          return { ...value(literalTrue), convertedType: T.bool, conversion: { kind: "convert", role: "return",
            operation: typedOperation(selected({ kind: "conversion", from: literalTrue, to: T.bool, embedding }, [literalTrue], T.bool)) } };
        } };
      return builder.block(builder.switchStatement(builder.id("flag", 0, T.bool), variant === "duplicate"
        ? [builder.defaultClause(), builder.defaultClause()]
        : [builder.caseClause(wrapped, booleanCaseEquality(T.bool, T.bool), builder.returns(null))]));
    });
    for (const maximumRecords of [0, 1, 2])
      assert.equal(produced({ ...deps, limits: { maximumRecords } }, program.tir, []).kind, "refused");
    if (variant === "duplicate") {
      assert.throws(() => produced({ ...deps, limits: { maximumRecords: 3 } }, program.tir, []), /a switch has more than one default clause/u);
    } else {
      const mir = lowerAtBounds(program, 19);
      const records = mir.blocks.flatMap(block => block.statements);
      const conversion = records.find(row => row.tir.node === program.at("wrapper") && row.kind === "assign" && row.value.kind === "convert");
      const comparison = records.find(row => row.kind === "assign" && row.value.kind === "binary");
      assert.equal(conversion !== undefined && comparison !== undefined, true);
      assert.deepEqual(comparison.value.right, { kind: "place", place: conversion.place });
    }
  }
});

test("switch rejects selected equality from a crossed subject before building case blocks", () => {
  const program = shaped("switch.case.crossed-subject", [["flag", "required", T.bool]], T.void, builder =>
    builder.block(builder.switchStatement(builder.id("flag", 0, T.bool), [
      builder.caseClause(builder.keyword("TrueKeyword", literalTrue), booleanCaseEquality(literalTrue, literalTrue), builder.returns(null)),
    ])));
  for (const maximumRecords of [0, 1, 2])
    assert.equal(produced({ ...deps, limits: { maximumRecords } }, program.tir, []).kind, "refused");
  assert.throws(() => produced({ ...deps, limits: { maximumRecords: 3 } }, program.tir, []),
    /a case has no selected equality of its actual subject/u);
});

test("an ordered switch observes a projected call result once before the case comparison", () => {
  const target = "switch.subject.field.call";
  const selectedTarget = callee(target, signature(target, [], directBox), [], directBox);
  const program = shaped("switch.subject.field", [["label", "required", T.bool]], T.void, builder => {
    const receiver = { $: "receiver", ...builder.call(builder.global(target, target, T.unknown), [], directBox,
      () => ({ callee: selectedTarget, receiver: null, arguments: [] })) };
    const subject = { $: "subject", ...builder.property(receiver, "flag", builder.read(T.bool, directField)) };
    const clause = { $: "case", ...builder.caseClause(builder.id("label", 0, T.bool), booleanCaseEquality(T.bool, T.bool),
      builder.returns(null)) };
    return builder.block(builder.switchStatement(subject, [clause, builder.defaultClause(builder.returns(null))]));
  });
  const mir = lowerAtBounds(program, 19);
  const call = mir.blocks[0].terminator;
  assert.equal(call.kind, "call");
  assert.equal(call.tir.node, program.at("receiver"));
  const projection = mir.places.find(place => place.base.kind === "place" && place.base.projection.kind === "field");
  assert.equal(projection.base.place, call.destination);
  assert.deepEqual(projection.base.projection.member, directField.decision);
  const tests = mir.blocks[call.next].statements.filter(statement => statement.kind === "assign");
  assert.deepEqual(tests.map(statement => [statement.tir.node, statement.value.kind]),
    [[program.at("subject"), "use"], [program.at("case"), "binary"]]);
  const [save, comparison] = tests;
  assert.deepEqual(save.value.operand, { kind: "place", place: projection.id });
  assert.deepEqual(comparison.value.left, { kind: "place", place: save.place });
});

test("switch clause and statement holes are rejected at entry before dispatch", () => {
  const program = shaped("switch.sparse-entry", [["flag", "required", T.bool]], T.void, builder =>
    builder.block(builder.switchStatement(builder.id("flag", 0, T.bool), [
      builder.caseClause(builder.keyword("TrueKeyword", literalTrue), booleanCaseEquality(T.bool, literalTrue), builder.returns(null)),
      builder.defaultClause(builder.returns(null)),
    ])));
  for (const [kind, message] of [["clause", "a switch clause list has a hole"], ["statement", "a statement list has a hole"]]) {
    const tree = structuredClone(program.tir);
    const caseBlock = tree.root.statements.nodes[0].caseBlock;
    const clauses = caseBlock.clauses.nodes;
    const origin = kind === "clause" ? caseBlock.origin : clauses[1].origin;
    if (kind === "clause") delete clauses[1];
    else delete clauses[1].statements.nodes[0];
    for (const maximumRecords of [0, 1])
      assert.equal(produced({ ...deps, limits: { maximumRecords } }, tree, []).kind, "refused");
    assert.throws(() => produced({ ...deps, limits: { maximumRecords: 2 },
      typeOf: () => assert.fail("sparse entry must stop before selecting a case carrier") }, tree, []),
    error => error instanceof Error && error.cause?.owner === "lower-mir" && error.cause.origin === origin && error.message === message);
  }
});

test("module switch reports a hole at its first reached clause or statement pull", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { resourceLimitDiagnostic } = await import("../../packages/host/dist/diag/index.js");
  const product = await import("../../packages/host/dist/ir-types/index.js");
  const input = analysisInput(fixture, "sdk-minimal", `switch (true) { case true: break; default: ; }`);
  const output = analyzeHostProgram(input);
  assert.equal(output.kind, "ok", JSON.stringify(output.diagnostics));
  const module = output.value.modules.find(row => row.module === input.snapshot.entryPoint);
  const { instance, tir, mir } = module.bodies.find(row => row.kind === "selected" && row.tir.root.kind === "SourceFile");
  const table = admitFixtureTable(product, output.value.index.types);
  const unit = { request: { query: "mirBody", key: instanceKey(instance) }, position: { kind: "result" } };
  const defs = { completionSelector: product.internType(table, { kind: "primitive", primitive: "int32" }),
    exceptionStorage: product.internType(table, { kind: "intrinsic", intrinsic: "unknown" }) };
  const reads = [];
  const lower = (body, maximumRecords) => produced({ defs, unit, limits: { maximumRecords },
    typeOf: id => { reads.push(id); return product.readType(table, id); },
    signatureOf: id => product.readSignature(table, id) }, body, []);
  const records = mir.locals.length + mir.places.length + mir.constants.length + mir.blocks.length
    + mir.blocks.reduce((total, block) => total + block.statements.length, 0);
  assert.deepEqual(lower(tir, records), { kind: "ok", value: mir, diagnostics: [] });
  for (const [kind, message] of [["clause", "a switch clause list has a hole"], ["statement", "a switch clause statement list has a hole"]]) {
    const tree = structuredClone(tir);
    assert.equal(tree.root.statements.nodes[0].kind, "ready-statement");
    const statement = tree.root.statements.nodes[0].node;
    const clauses = statement.caseBlock.clauses.nodes;
    const origin = kind === "clause" ? statement.origin : clauses[1].origin;
    const label = clauses[0].expression.tsonic.type;
    const carrier = product.readType(table, label);
    assert.equal(carrier.kind, "literal");
    const expected = kind === "clause" ? [label, carrier.base] : [label, carrier.base, statement.expression.tsonic.convertedType];
    if (kind === "clause") delete clauses[1];
    else delete clauses[1].statements.nodes[0];
    reads.length = 0;
    for (const maximum of [0, 1]) {
      const diagnostic = resourceLimitDiagnostic({ owner: "lower-mir", limit: "lower-mir.maximumRecords", maximum,
        site: { kind: "source", origin: tree.root.origin }, unit });
      assert.deepEqual(lower(tree, maximum), { kind: "refused", diagnostics: [diagnostic] });
      assert.deepEqual(reads, []);
    }
    assert.throws(() => lower(tree, 2),
      error => defectOfLowerMir(error) && error.cause.origin === origin
        && error.cause.query === null && error.message === `${CALLER_DEFECT}${message}`);
    assert.deepEqual(reads, expected);
  }
});

test("a conditional assignment without its retained read stops before the target or RHS", () => {
  const program = shaped("triage.conditional.missing-read", [["flag", "required", T.bool]], T.void, builder => {
    const expression = shortCircuit(builder, "and", builder.target("flag", 0, T.bool),
      builder.keyword("FalseKeyword", T.bool), T.bool);
    return builder.block(builder.expressionStatement({ ...expression, operatorToken: { ...expression.operatorToken, kind: "AmpersandAmpersandEqualsToken" },
      tsonic: at => ({ ...expression.tsonic(at), role: "assignment", storage: T.bool, calculation: null }) }));
  });
  for (const maximumRecords of [0, 1])
    assert.equal(produced({ ...deps, limits: { maximumRecords } }, program.tir, []).kind, "refused");
  assert.throws(() => produced({ ...deps, limits: { maximumRecords: 2 } }, program.tir, []),
    /a conditional assignment without a selected read/u);
});

test("nested returning if branches preserve the outer pending statement boundary", () => {
  const program = shaped("if.nested", [["outer", "required", T.bool], ["inner", "required", T.bool]], T.int32, b => b.block(
    { $: "outer", ...b.ifElse(b.id("outer", 0, T.bool), b.block(
      { $: "inner", ...b.ifElse(b.id("inner", 1, T.bool), { $: "one", ...b.returns(b.num("1", T.int32)) },
        { $: "two", ...b.returns(b.num("2", T.int32)) }) }), { $: "three", ...b.returns(b.num("3", T.int32)) }) }));
  const mir = lower(program);
  for (const outer of [false, true]) for (const inner of [false, true]) {
    const path = walk(mir, { decide: event => event.node === program.at("outer") ? outer : inner });
    assert.equal(path.events.at(-1).node, program.at(outer ? inner ? "one" : "two" : "three"));
    assert.equal(path.events.filter(item => item.kind === "switch").length, outer ? 2 : 1);
  }
});

test("while conditions repeat at their actual head and selected continues return to that head", () => {
  for (const labelled of [false, true]) {
    const program = shaped(`while.dynamic.${labelled}`, [["flag", "required", T.bool]], T.void, b => {
      const loop = { $: "while", ...b.whileLoop({ $: "condition", ...b.id("flag", 0, T.bool) },
        labelled ? selectedContinue(b, "label", true) : b.block(b.expressionStatement(
          { $: "store", ...b.assign(b.target("flag", 0, T.bool), "EqualsToken", b.keyword("FalseKeyword", T.bool), T.bool, T.bool) }))) };
      return b.block(labelled ? labelledBlock(b, "label", loop) : loop, { $: "after", ...b.returns(null) });
    });
    const mir = lower(program);
    let decisions = 0;
    const path = walk(mir, { decide: point => point.kind === "switch" ? decisions++ === 0 : "normal" });
    assert.equal(path.events.filter(item => item.kind === "switch").length, 2, "the backedge evaluates the condition again");
    assert.equal(path.events.at(-1).node, program.at("after"));
    if (!labelled) assert.equal(path.events.filter(item => item.kind === "assign" && item.node === program.at("store")).length, 1);
    const size = mir.locals.length + mir.places.length + mir.constants.length + mir.blocks.length
      + mir.blocks.reduce((count, block) => count + block.statements.length, 0);
    for (let maximumRecords = 0; maximumRecords < size; maximumRecords += 1)
      assert.equal(produced({ ...deps, limits: { maximumRecords } }, program.tir, []).kind, "refused", `while ${labelled} under ${maximumRecords}`);
    assert.equal(produced({ ...deps, limits: { maximumRecords: size } }, program.tir, []).kind, "ok");
  }
});

test("known boolean while loops retain only genuine exits and do not invent fallthrough after a returning body", () => {
  const cases = [
    shaped("while.returns", [], T.int32, b => b.block(b.whileLoop(b.keyword("TrueKeyword", T.bool),
      { $: "return", ...b.returns(b.num("1", T.int32)) }))),
    shaped("while.false", [], T.void, b => b.block(b.whileLoop(b.keyword("FalseKeyword", literalFalse),
      { $: "unreached", ...b.block() }), { $: "return", ...b.returns(null) })),
    shaped("while.break", [], T.void, b => b.block({ $: "while", ...b.whileLoop(b.keyword("TrueKeyword", literalTrue),
      selectedBreak(b, "while")) }, { $: "return", ...b.returns(null) })),
  ];
  for (const program of cases) {
    const mir = lower(program);
    assert.equal(recordsOf(mir).some(item => item.kind === "switch"), false, "the actual selected boolean value leaves no uncertain edge");
    assert.equal(walk(mir).events.at(-1).node, program.at("return"));
    const size = mir.locals.length + mir.places.length + mir.constants.length + mir.blocks.length
      + mir.blocks.reduce((count, block) => count + block.statements.length, 0);
    for (let maximumRecords = 0; maximumRecords < size; maximumRecords += 1)
      assert.equal(produced({ ...deps, limits: { maximumRecords } }, program.tir, []).kind, "refused", `known while under ${maximumRecords}`);
    assert.equal(produced({ ...deps, limits: { maximumRecords: size } }, program.tir, []).kind, "ok");
  }
});

test("literal Boolean switches retain actual reachable clauses and exact record limits", () => {
  const layouts = {
    fallthrough: (builder, subject) => [builder.defaultClause(), builder.caseClause(builder.keyword("TrueKeyword", literalTrue), booleanCaseEquality(subject, literalTrue), selectedBreak(builder, "dispatch"))],
    primitive: (builder, subject) => [builder.defaultClause(), builder.caseClause(builder.keyword("TrueKeyword", T.bool), booleanCaseEquality(subject, T.bool), selectedBreak(builder, "dispatch"))],
    wrapped: (builder, subject) => [builder.defaultClause(), builder.caseClause({
      kind: "ParenthesizedExpression", expression: builder.keyword("TrueKeyword", literalTrue), tsonic: value(literalTrue),
    }, booleanCaseEquality(subject, literalTrue), selectedBreak(builder, "dispatch"))],
    first: (builder, subject) => [builder.caseClause(builder.keyword("TrueKeyword", literalTrue), booleanCaseEquality(subject, literalTrue), { $: "taken", ...builder.returns(null) }),
      builder.caseClause(builder.keyword("TrueKeyword", literalTrue), booleanCaseEquality(subject, literalTrue), { $: "skipped", ...builder.returns(null) })],
    fallback: builder => [builder.defaultClause()],
    empty: () => [],
  };
  for (const [name, clauses] of Object.entries(layouts)) for (const known of [false, true]) {
    const program = shaped(`switch.${name}.${known}`, [["flag", "required", T.bool]], T.void, builder => builder.block(
      { $: "dispatch", ...builder.switchStatement(known ? builder.keyword("TrueKeyword", literalTrue) : builder.id("flag", 0, T.bool), clauses(builder, known ? literalTrue : T.bool)) },
      { $: "after", ...builder.returns(null) }));
    const mir = lower(program);
    const switches = mir.blocks.filter(block => block.terminator.kind === "switch");
    assert.equal(switches.length, 1);
    const dispatch = switches[0].terminator;
    if ((name === "fallthrough" || name === "wrapped" || name === "primitive") && !known) {
      const fallback = mir.blocks[dispatch.otherwise].terminator;
      assert.equal(fallback.kind, "goto");
      assert.equal(fallback.target, dispatch.targets[0].target);
    } else if (name === "first") {
      assert.equal(mir.blocks.some(block => block.terminator.tir.node === program.at("skipped")), false);
      const entry = dispatch.targets[0]?.target ?? dispatch.otherwise;
      assert.equal(mir.blocks[entry].terminator.tir.node, program.at("taken"));
    } else assert.deepEqual(dispatch.targets, []);
    const size = mir.locals.length + mir.places.length + mir.constants.length + mir.blocks.length
      + mir.blocks.reduce((count, block) => count + block.statements.length, 0);
    for (let maximumRecords = 0; maximumRecords < size; maximumRecords += 1)
      assert.equal(produced({ ...deps, limits: { maximumRecords } }, program.tir, []).kind, "refused", `${name} switch under ${maximumRecords}`);
    assert.equal(produced({ ...deps, limits: { maximumRecords: size } }, program.tir, []).kind, "ok");
  }
});

test("Boolean dispatch cannot erase a selected case conversion or trust crossed typed literal evidence", () => {
  for (const form of ["direct", "wrapped"]) {
    const kinds = ["conversion", "narrowing", "demand", "crossed-literal", "crossed-carrier", "non-boolean", "role", "identity"];
    if (form === "wrapped") kinds.push("crossed-wrapper", "crossed-inner-wrapper");
    for (const kind of kinds) {
      const name = `switch.case.${form}.${kind}`;
      const program = shaped(name, [["flag", "required", T.bool]], T.void, builder => {
        const original = builder.keyword("TrueKeyword", literalTrue);
        const leaf = kind === "conversion" ? convertingNode(builder, name, original, literalTrue, T.bool, EXECUTIONS.unwinds, "native")
          : kind === "narrowing" ? narrowingNode(builder, name, original, literalTrue, T.bool, "abort")
          : { ...original, tsonic: { ...original.tsonic,
            ...(kind === "demand" ? { demand: { kind: "never", control: null } } : {}),
            ...(kind === "crossed-literal" || kind === "crossed-carrier" ? value(literalFalse) : {}),
            ...(kind === "non-boolean" ? value(T.int32) : {}),
            ...(kind === "role" ? { role: "property-name", key: { kind: "text", value: "true" } } : {}),
            ...(kind === "identity" ? { convertedType: T.bool } : {}) } };
        const inner = kind === "crossed-inner-wrapper" ? builder.paren(leaf, literalFalse) : leaf;
        const label = kind === "conversion" || kind === "narrowing" || kind === "identity" ? T.bool
          : kind === "crossed-carrier" ? literalFalse : literalTrue;
        const condition = form === "wrapped" ? builder.paren(inner, kind === "crossed-wrapper" ? T.int32 : label) : leaf;
        return builder.block(builder.switchStatement(builder.id("flag", 0, T.bool), [
          builder.caseClause(condition, booleanCaseEquality(T.bool, label), builder.returns(null)), builder.defaultClause(builder.returns(null)),
        ]));
      });
      if (kind === "conversion" || kind === "narrowing") {
        const outcome = produced(deps, program.tir, []);
        assert.equal(outcome.kind, "ok", name);
        const source = program.at(kind === "conversion" ? "converted" : "narrowed");
        const effect = outcome.value.blocks.find(block => block.terminator.tir.node === source)?.terminator;
        assert.equal(effect?.kind, kind === "conversion" ? "invoke" : "check", name);
        assert.equal(effect.unwind.kind, kind === "conversion" ? "escape" : "abort", name);
      } else if (kind === "identity") {
        const outcome = produced(deps, program.tir, []);
        assert.equal(outcome.kind, "ok", name);
        assert.equal(verified(outcome.value, program).some(violation => violation.rule === "operation-selected"), true, name);
      } else {
        assert.throws(() => produced(deps, program.tir, []), kind === "demand"
          ? /a value demanded under a selection/u : /a Boolean switch case without matching selected literal evidence/u, name);
      }
    }
  }
});

test("one shared case slot starts empty and ends on fallthrough, bypass, break and outer continue", () => {
  for (const exit of ["fallthrough", "break", "continue"]) {
    const name = `switch.lexical.${exit}`;
    const builder = builders(name);
    const declaration = { $: "declaration", ...builder.variable(builder.declName("slot", 1), 1, T.int32) };
    const variables = builder.declare([declaration]);
    variables.declarationList.flags = ["Let"];
    const write = builder.expressionStatement({ $: "write", ...builder.assign(builder.target("slot", 1, T.int32), "EqualsToken",
      builder.num("1", T.int32), T.int32, T.int32) });
    const tail = exit === "break" ? [selectedBreak(builder, "dispatch")] : exit === "continue" ? [selectedContinue(builder, "loop", false)] : [];
    const dispatch = { $: "dispatch", ...builder.switchStatement(builder.id("flag", 0, T.bool),
      [builder.caseClause(builder.keyword("TrueKeyword", literalTrue), booleanCaseEquality(T.bool, literalTrue), variables, write, ...tail)]) };
    const loop = { $: "loop", ...builder.whileLoop(builder.keyword("FalseKeyword", literalFalse), builder.block(dispatch)), kind: "DoStatement" };
    const program = typedBody(name, { signature: signature(name, [["flag", T.bool]], T.void), completion: T.void,
      locals: [["flag", "parameter", T.bool], ["slot", "binding", T.int32, true]], params: [[0, "required", T.bool]],
      root: builder.block(exit === "continue" ? loop : dispatch, { $: "after", ...builder.returns(null) }) });
    const mir = lower(program);
    const slot = mir.locals.find(local => local.source?.body === program.tir.body && local.source.local === 1);
    assert.equal(markersOf(mir, slot.id).filter(event => event.kind === "storage-dead").length,
      exit === "continue" ? 2 : 1, "the switch's own exits share one end marker; outer transfers have a separate successor");
    for (const take of [false, true]) {
      const path = walk(mir, { decide: point => point.kind === "switch" ? take : "normal" });
      const events = statementsOn(path);
      assert.deepEqual(events.filter(event => event.record.local === slot.id).map(event => event.kind), ["storage-live", "storage-dead"], `${exit}/${take}`);
      assert.equal(events.some(event => event.kind === "assign" && event.node === program.at("write")), take, `${exit}/${take}`);
      assert.equal(path.events.at(-1).node, program.at("after"));
    }
    const size = mir.locals.length + mir.places.length + mir.constants.length + mir.blocks.length
      + mir.blocks.reduce((count, block) => count + block.statements.length, 0);
    for (let maximumRecords = 0; maximumRecords < size; maximumRecords += 1)
      assert.equal(produced({ ...deps, limits: { maximumRecords } }, program.tir, []).kind, "refused", `${exit} under ${maximumRecords}`);
    assert.deepEqual(produced({ ...deps, limits: { maximumRecords: size } }, program.tir, []).value, mir);
  }
});

test("do loops execute before testing and selected continues reach the condition rather than the body", () => {
  for (const control of ["normal", "continue", "labelled", "break", "return"]) {
    const program = shaped(`do.boolean.${control}`, [["flag", "required", T.bool], ["x", "required", T.int32]], T.void, b => {
      const stop = control === "normal" ? b.block() : control === "break" ? selectedBreak(b, "loop")
        : control === "return" ? { $: "return", ...b.returns(null) } : selectedContinue(b, control === "labelled" ? "label" : "loop", control === "labelled");
      const statement = b.block(b.expressionStatement({ $: "body", ...b.prefix(b.id("x", 1, T.int32), "MinusToken", T.int32,
        native("-", "int32", [T.int32], T.int32)) }), stop);
      const loop = { $: "loop", ...b.whileLoop(b.id("flag", 0, T.bool), statement), kind: "DoStatement" };
      return b.block(control === "labelled" ? labelledBlock(b, "label", loop) : loop, { $: "after", ...b.returns(null) });
    });
    const mir = lower(program);
    const stops = control === "break" || control === "return";
    for (const repeat of [false, true]) {
      let conditions = 0;
      const path = walk(mir, { decide: point => point.kind === "switch" ? repeat && conditions++ === 0 : "normal" });
      assert.equal(path.events.filter(item => item.kind === "switch").length, stops ? 0 : repeat ? 2 : 1);
      assert.equal(path.events.filter(item => item.kind === "assign" && item.node === program.at("body")).length, !stops && repeat ? 2 : 1);
      assert.equal(path.events.at(-1).node, program.at(control === "return" ? "return" : "after"));
    }
    const size = mir.locals.length + mir.places.length + mir.constants.length + mir.blocks.length
      + mir.blocks.reduce((count, block) => count + block.statements.length, 0);
    for (let maximumRecords = 0; maximumRecords < size; maximumRecords += 1)
      assert.equal(produced({ ...deps, limits: { maximumRecords } }, program.tir, []).kind, "refused", `do ${control} under ${maximumRecords}`);
    assert.equal(produced({ ...deps, limits: { maximumRecords: size } }, program.tir, []).kind, "ok");
  }
});

test("known do conditions share actual break exits and never evaluate an unreachable condition", () => {
  for (const choice of [false, true, "dynamic"]) {
    const program = shaped(`do.known.${choice}`, [["flag", "required", T.bool]], T.void, b => b.block({ $: "loop",
      kind: "DoStatement", tsonic: null,
      expression: choice === "dynamic" ? b.id("flag", 0, T.bool) : b.keyword(choice ? "TrueKeyword" : "FalseKeyword", choice ? literalTrue : literalFalse),
      statement: b.block(b.ifElse(b.id("flag", 0, T.bool), selectedBreak(b, "loop"))) }, { $: "after", ...b.returns(null) }));
    const mir = lower(program);
    for (const breakFirst of [false, true]) {
      let bodyTests = 0;
      const path = walk(mir, { decide: point => point.kind !== "switch" ? "normal"
        : point.node === program.at("loop") ? false : breakFirst || bodyTests++ > 0 });
      assert.equal(path.events.at(-1).node, program.at("after"));
      assert.equal(path.events.filter(item => item.kind === "switch").length, breakFirst || choice === false ? 1 : 2);
    }
    const size = mir.locals.length + mir.places.length + mir.constants.length + mir.blocks.length
      + mir.blocks.reduce((count, block) => count + block.statements.length, 0);
    for (let maximumRecords = 0; maximumRecords < size; maximumRecords += 1)
      assert.equal(produced({ ...deps, limits: { maximumRecords } }, program.tir, []).kind, "refused", `do existing exit ${choice} under ${maximumRecords}`);
    assert.equal(produced({ ...deps, limits: { maximumRecords: size } }, program.tir, []).kind, "ok");
  }
  const forever = shaped("do.known.infinite", [], T.void, b => b.block({ ...b.whileLoop(b.keyword("TrueKeyword", literalTrue), b.block()), kind: "DoStatement" }));
  const mir = lower(forever);
  assert.equal(mir.blocks.some(block => block.terminator.kind === "return"), false);
  const once = shaped("do.known.once", [], T.void, b => b.block({ ...b.whileLoop(b.keyword("FalseKeyword", literalFalse), b.block()), kind: "DoStatement" }, b.returns(null)));
  assert.equal(walk(lower(once)).end, "return");
});

test("a conditional labelled break and its normal fallthrough share one properly terminated label exit", () => {
  const program = shaped("if.labelled-break", [["flag", "required", T.bool], ["a", "required", T.int32]], T.int32,
    b => b.block(labelledBlock(b, "label", b.block(b.ifElse(b.id("flag", 0, T.bool), selectedBreak(b, "label")),
      b.expressionStatement({ $: "store", ...b.assign(b.target("a", 1, T.int32), "EqualsToken", b.num("2", T.int32), T.int32, T.int32) }))),
      { $: "return", ...b.returns(b.id("a", 1, T.int32)) }));
  const mir = lower(program);
  for (const choice of [false, true]) {
    const path = walk(mir, { decide: () => choice });
    assert.equal(path.events.filter(item => item.kind === "assign" && item.node === program.at("store")).length, choice ? 0 : 1);
    assert.equal(path.events.at(-1).node, program.at("return"));
  }
});

test("selected native and backed conversions retain raw carriers and exact source decisions under every execution decision", () => {
  const sources = [
    ["parameter", b => b.id("a", 0, T.int32), 7, { kind: "place", place: 0 }],
    ["literal", b => b.num("1", T.int32), 6, { kind: "constant", constant: 0 }],
    ["parenthesized", b => b.paren(b.id("a", 0, T.int32), T.int32), 7, { kind: "place", place: 0 }],
    ["binary", b => b.arithmetic(b.id("a", 0, T.int32), "PlusToken", b.id("a", 0, T.int32), T.int32, plus("int32", T.int32)), 11, { kind: "place", place: 1 }],
    ["unary", b => b.prefix(b.id("a", 0, T.int32), "MinusToken", T.int32, native("-", "int32", [T.int32], T.int32)), 11, { kind: "place", place: 1 }],
  ];
  for (const backing of ["native", "core", "library"]) for (const [executionName, execution] of Object.entries(EXECUTIONS)) for (const [sourceName, source, records, operand] of sources) {
    const name = `conversion.${backing}.${executionName}.${sourceName}`;
    const program = shaped(name, sourceName === "literal" ? [] : [["a", "required", T.int32]], T.literalInt64,
      b => b.block(b.returns(convertingNode(b, name, source(b), T.int32, T.literalInt64, execution, backing))));
    const conversion = program.tir.root.statements.nodes[0].expression.tsonic.conversion.operation;
    const mir = lower(program);
    const convertedPlace = sourceName === "literal" ? 0 : sourceName === "binary" || sourceName === "unary" ? 2 : 1;
    if (execution.kind === "pure") {
      const stored = mir.blocks[0].statements.at(-1);
      assert.deepEqual(stored.value, { kind: "convert", operation: conversion, operand, to: T.literalInt64 });
      assert.equal(stored.place, convertedPlace);
    } else {
      assert.deepEqual([mir.blocks[0].terminator.operation, mir.blocks[0].terminator.operands, mir.blocks[0].terminator.destination],
        [conversion, [operand], convertedPlace]);
      assert.deepEqual(mir.blocks[0].terminator.unwind, { kind: execution.failure === "unwind" ? "escape" : execution.failure });
    }
    assert.equal(mir.locals.at(-1).storage, T.literalInt64);
    assert.deepEqual(mir.blocks.at(-1).terminator.value, { kind: "place", place: convertedPlace });
    if (sourceName === "binary" || sourceName === "unary") {
      assert.equal(mir.blocks[0].statements[1].value.kind, sourceName);
      assert.equal(mir.locals[1].storage, T.int32);
      assert.equal(mir.blocks[0].statements[1].tir.node, program.at("converted"));
    }
    for (let maximumRecords = 0; maximumRecords < records; maximumRecords += 1)
      assert.equal(produced({ ...deps, limits: { maximumRecords } }, program.tir, []).kind, "refused", `${name} under ${maximumRecords}`);
    assert.deepEqual(produced({ ...deps, limits: { maximumRecords: records } }, program.tir, []).value, mir);
  }
});

test("a selected writing conversion consumes its source then protects only an earlier exposed operand", () => {
  const name = "conversion.waiting";
  const program = shaped(name, [["a", "required", T.literalInt64, "byref-readwrite"], ["b", "required", T.int32, "byref-readwrite"]], T.literalInt64,
    b => b.block(b.returns(b.arithmetic(b.id("a", 0, T.literalInt64), "PlusToken",
      convertingNode(b, name, b.id("b", 1, T.int32), T.int32, T.literalInt64, EXECUTIONS.writes, "native"),
      T.literalInt64, plus("int64", T.literalInt64)))));
  const mir = lower(program);
  assert.deepEqual(mir.blocks[0].statements.filter(record => record.kind === "assign").map(record => record.value),
    [{ kind: "use", operand: { kind: "place", place: 0 } }]);
  assert.deepEqual(mir.blocks[0].terminator.operands, [{ kind: "place", place: 1 }]);
  assert.deepEqual(mir.blocks[1].statements[1].value.left, { kind: "place", place: 2 });
  for (let maximumRecords = 0; maximumRecords < 17; maximumRecords += 1)
    assert.equal(produced({ ...deps, limits: { maximumRecords } }, program.tir, []).kind, "refused", `conversion waiting under ${maximumRecords}`);
  assert.deepEqual(produced({ ...deps, limits: { maximumRecords: 17 } }, program.tir, []).value, mir);
});

test("selected narrowed values check their actual place once with the supplied failure and exact record refusal", () => {
  for (const failure of ["unwind", "abort"]) for (const form of ["identifier", "wrapper", "constant"]) {
    const name = `narrow.${failure}.${form}`;
    const program = shaped(name, [["x", "required", T.optInt32]], T.int32, b => {
      const node = form === "identifier" ? b.id("x", 0, T.int32)
        : b.nonNull(form === "constant" ? b.num("1", T.optInt32) : b.id("x", 0, T.optInt32), T.int32, null);
      return b.block(b.returns(narrowingNode(b, name, node, T.optInt32, T.int32, failure)));
    });
    const mir = lower(program);
    const checked = mir.places.at(-1);
    assert.deepEqual([checked.storage, checked.base.kind, checked.base.projection, checked.base.tir],
      [T.int32, "checked", { kind: "refined" }, program.nodeRef("narrowed")]);
    assert.deepEqual([mir.blocks[0].terminator.kind, mir.blocks[0].terminator.place, mir.blocks[0].terminator.unwind],
      ["check", checked.id, { kind: failure === "abort" ? "abort" : "escape" }]);
    assert.deepEqual(mir.blocks[1].terminator.value, { kind: "place", place: checked.id });
    if (form === "constant") {
      assert.equal(mir.constants[0].type, T.optInt32);
      assert.deepEqual(mir.blocks[0].statements[1].value, { kind: "use", operand: { kind: "constant", constant: 0 } });
    } else assert.deepEqual(mir.blocks[0].statements, []);
    const records = form === "constant" ? 9 : 5;
    for (let maximumRecords = 0; maximumRecords < records; maximumRecords += 1) {
      const outcome = produced({ ...deps, limits: { maximumRecords } }, program.tir, []);
      assert.equal(outcome.kind, "refused", `${name} under ${maximumRecords}`);
      assert.equal("value" in outcome, false);
    }
    assert.deepEqual(produced({ ...deps, limits: { maximumRecords: records } }, program.tir, []).value, mir);
  }
});

test("a selected narrowing precedes its conversion and an exposed refined read is saved before a later write", () => {
  const convertedName = "narrow.converted";
  const converted = shaped(convertedName, [["x", "required", T.optInt32]], T.literalInt64, b => b.block(b.returns(
    convertingNode(b, convertedName, narrowingNode(b, convertedName, b.id("x", 0, T.int32), T.optInt32, T.int32, "abort"),
      T.int32, T.literalInt64, EXECUTIONS.unwinds, "native"))));
  const convertedMir = lower(converted);
  assert.deepEqual(convertedMir.blocks.map(block => block.terminator.kind), ["check", "invoke", "return"]);
  assert.deepEqual(convertedMir.blocks[1].terminator.operands, [{ kind: "place", place: 1 }]);
  assert.equal(convertedMir.locals.at(-1).storage, T.literalInt64);
  for (let maximumRecords = 0; maximumRecords < 9; maximumRecords += 1)
    assert.equal(produced({ ...deps, limits: { maximumRecords } }, converted.tir, []).kind, "refused", `narrow-convert under ${maximumRecords}`);
  assert.deepEqual(produced({ ...deps, limits: { maximumRecords: 9 } }, converted.tir, []).value, convertedMir);

  const name = "narrow.waiting";
  const decision = native("-", "int32", [T.int32], T.int32, EXECUTIONS.writes);
  const waiting = shaped(name, [["x", "required", T.optInt32, "byref-readwrite"], ["b", "required", T.int32]], T.int32,
    b => b.block(b.returns(b.arithmetic(narrowingNode(b, name, b.id("x", 0, T.int32), T.optInt32, T.int32, "unwind"), "PlusToken",
      b.prefix(b.id("b", 1, T.int32), "MinusToken", T.int32, decision), T.int32, plus("int32", T.int32)))));
  const mir = lower(waiting);
  assert.deepEqual(mir.blocks.map(block => block.terminator.kind), ["check", "invoke", "return"]);
  assert.deepEqual(mir.blocks[1].statements.filter(record => record.kind === "assign").map(record => record.value),
    [{ kind: "use", operand: { kind: "place", place: 1 } }]);
  assert.deepEqual(mir.blocks[1].terminator.operands, [{ kind: "place", place: 2 }]);
  assert.deepEqual(mir.blocks[2].statements[1].value.left, { kind: "place", place: 3 });
  for (let maximumRecords = 0; maximumRecords < 19; maximumRecords += 1)
    assert.equal(produced({ ...deps, limits: { maximumRecords } }, waiting.tir, []).kind, "refused", `refined waiting under ${maximumRecords}`);
  assert.deepEqual(produced({ ...deps, limits: { maximumRecords: 19 } }, waiting.tir, []).value, mir);
});

test("typed expression wrappers evaluate their operand only and retain actual contextual conversions at the wrapper", () => {
  for (const kind of ["AsExpression", "SatisfiesExpression", "TypeAssertionExpression"]) {
    const name = `wrapper.identity.${kind}`;
    const identity = shaped(name, [["x", "required", T.float64]], T.float64,
      b => b.block(b.returns({ kind, expression: b.id("x", 0, T.float64),
        type: { kind: "NumberKeyword", tsonic: { type: T.float64, declarations: [] } }, tsonic: value(T.float64) })));
    const plain = lower(identity);
    assert.deepEqual([plain.constants, plain.locals.length, plain.places.length, plain.blocks.length, plain.blocks[0].statements], [[], 1, 1, 1, []]);
    assert.deepEqual(plain.blocks[0].terminator.value, { kind: "place", place: 0 });
    for (let maximumRecords = 0; maximumRecords < 3; maximumRecords += 1)
      assert.equal(produced({ ...deps, limits: { maximumRecords } }, identity.tir, []).kind, "refused", `${kind} identity under ${maximumRecords}`);
    assert.deepEqual(produced({ ...deps, limits: { maximumRecords: 3 } }, identity.tir, []).value, plain);

    const conversionName = `wrapper.converted.${kind}`;
    const converted = shaped(conversionName, [["x", "required", T.int32]], T.float64,
      b => b.block(b.returns(convertingNode(b, conversionName, { kind, expression: b.id("x", 0, T.int32),
        type: { kind: "NumberKeyword", tsonic: { type: T.float64, declarations: [] } }, tsonic: value(T.int32) },
      T.int32, T.float64, EXECUTIONS.pure, "native"))));
    const mir = lower(converted);
    assert.deepEqual([mir.locals.map(local => local.storage), mir.places.map(place => place.storage)], [[T.int32, T.float64], [T.int32, T.float64]]);
    assert.deepEqual([mir.blocks[0].statements[1].value.kind, mir.blocks[0].statements[1].value.operand, mir.blocks[0].statements[1].tir],
      ["convert", { kind: "place", place: 0 }, converted.nodeRef("converted")]);
    for (let maximumRecords = 0; maximumRecords < 7; maximumRecords += 1)
      assert.equal(produced({ ...deps, limits: { maximumRecords } }, converted.tir, []).kind, "refused", `${kind} converted under ${maximumRecords}`);
    assert.deepEqual(produced({ ...deps, limits: { maximumRecords: 7 } }, converted.tir, []).value, mir);
  }
});

test("selected labelled exits skip the correct remainders and otherwise add no block", () => {
  const plain = shaped("label.plain", [["x", "required", T.int32]], T.int32, b => b.block(
    labelledBlock(b, "scope", b.block(b.expressionStatement(b.id("x", 0, T.int32)))), b.returns(b.id("x", 0, T.int32))));
  const returned = shaped("label.returned", [["x", "required", T.int32]], T.int32, b => b.block(
    labelledBlock(b, "scope", b.block(b.returns(b.id("x", 0, T.int32)))), b.throws(b.keyword("TrueKeyword", T.bool))));
  const broken = shaped("label.broken", [["x", "required", T.int32]], T.int32, b => b.block(
    labelledBlock(b, "scope", b.block(selectedBreak(b, "scope"), b.throws(b.keyword("TrueKeyword", T.bool)))), b.returns(b.id("x", 0, T.int32))));
  const outer = shaped("label.outer", [["x", "required", T.int32]], T.int32, b => b.block(
    labelledBlock(b, "out", b.block(labelledBlock(b, "inside", b.block(selectedBreak(b, "out"), b.throws(b.keyword("FalseKeyword", T.bool)))),
      b.throws(b.keyword("TrueKeyword", T.bool)))), b.returns(b.id("x", 0, T.int32))));
  const alias = shaped("label.alias", [["x", "required", T.int32]], T.int32, b => b.block(
    labelledBlock(b, "out", labelledBlock(b, "alias", b.block(selectedBreak(b, "out")), "out")), b.returns(b.id("x", 0, T.int32))));
  for (const [program, records, blocks] of [[plain, 7, 1], [returned, 3, 1], [broken, 4, 2], [outer, 4, 2], [alias, 4, 2]]) {
    const mir = lower(program);
    const locals = program === plain ? 2 : 1;
    assert.deepEqual([mir.blocks.length, mir.locals.length, mir.places.length, mir.constants.length], [blocks, locals, locals, 0]);
    if (program === plain) assert.deepEqual(mir.blocks[0].statements[1].value, { kind: "use", operand: { kind: "place", place: 0 } });
    if (blocks === 2) assert.deepEqual([mir.blocks[0].terminator.kind, mir.blocks[0].terminator.target], ["goto", 1]);
    assert.deepEqual(mir.blocks.at(-1).terminator.value, { kind: "place", place: 0 });
    for (let maximumRecords = 0; maximumRecords < records; maximumRecords += 1)
      assert.equal(produced({ ...deps, limits: { maximumRecords } }, program.tir, []).kind, "refused", `${program.tir.body} under ${maximumRecords}`);
    assert.deepEqual(produced({ ...deps, limits: { maximumRecords: records } }, program.tir, []).value, mir);
  }
});

test("an inner selected break resumes its own remainder before an outer break exits its scope", () => {
  const decision = native("-", "int32", [T.int32], T.int32, EXECUTIONS.writes);
  const program = shaped("label.inner", [["x", "required", T.int32]], T.int32, b => b.block(
    labelledBlock(b, "out", b.block(labelledBlock(b, "inside", b.block(selectedBreak(b, "inside"))),
      b.expressionStatement(b.prefix(b.id("x", 0, T.int32), "MinusToken", T.int32, decision)), selectedBreak(b, "out"),
      b.throws(b.keyword("TrueKeyword", T.bool)))), b.returns(b.id("x", 0, T.int32))));
  const mir = lower(program);
  assert.deepEqual(mir.blocks.map(block => block.terminator.kind), ["goto", "invoke", "goto", "return"]);
  assert.deepEqual(mir.blocks.map(block => block.statements.map(record => record.kind)), [[], ["storage-live"], [], []]);
  assert.deepEqual([mir.blocks[0].terminator.target, mir.blocks[1].terminator.next, mir.blocks[2].terminator.target], [1, 2, 3]);
  assert.deepEqual(mir.blocks[1].terminator.operation, typedOperation(decision));
  assert.deepEqual(mir.blocks[3].terminator.value, { kind: "place", place: 0 });
  for (let maximumRecords = 0; maximumRecords < 9; maximumRecords += 1)
    assert.equal(produced({ ...deps, limits: { maximumRecords } }, program.tir, []).kind, "refused", `inner break under ${maximumRecords}`);
  assert.deepEqual(produced({ ...deps, limits: { maximumRecords: 9 } }, program.tir, []).value, mir);
});

test("invalid qualified selected break and label targets are caller defects, never guessed from label spelling", () => {
  const unknown = shaped("label.unknown", [], T.void, b => b.block({ kind: "BreakStatement", label: null,
    tsonic: { target: b.nodeRef(0) } }));
  assert.throws(() => produced(deps, unknown.tir, []), error => defectOfLowerMir(error) && error.message.includes("no active selected target"));
  const foreign = shaped("label.foreign", [], T.void, b => b.block({ kind: "BreakStatement", label: null,
    tsonic: { target: { body: bodyId("label.other"), node: 0 } } }));
  assert.throws(() => produced(deps, foreign.tir, []), error => defectOfLowerMir(error) && error.message.includes("break targets another body"));
  const foreignLabel = shaped("label.foreign-label", [], T.void, b => b.block({ kind: "LabeledStatement", label: b.label("x", "scope"),
    statement: { $: "scope", ...b.block() }, tsonic: { target: { body: bodyId("label.other"), node: 0 } } }));
  assert.throws(() => produced(deps, foreignLabel.tir, []), error => defectOfLowerMir(error) && error.message.includes("label targets another body"));
});

test("unconditional for loops have a real back edge, selected break/continue and no fabricated normal return", () => {
  const empty = shaped("for.empty", [], T.void, b => b.block(unconditionalFor("loop", b.block()), b.throws(b.keyword("TrueKeyword", T.bool))));
  const continuing = shaped("for.continue", [], T.void, b => b.block(unconditionalFor("loop", b.block(selectedContinue(b, "loop", false),
    b.throws(b.keyword("TrueKeyword", T.bool)))), b.returns(null)));
  const returned = shaped("for.returned", [["x", "required", T.int32]], T.int32,
    b => b.block(unconditionalFor("loop", b.block(b.returns(b.id("x", 0, T.int32)))), b.throws(b.keyword("TrueKeyword", T.bool))));
  const broken = shaped("for.broken", [["x", "required", T.int32]], T.int32,
    b => b.block(unconditionalFor("loop", b.block({ ...selectedBreak(b, "loop"), label: null })), b.returns(b.id("x", 0, T.int32))));
  const alias = shaped("for.alias", [["x", "required", T.int32]], T.int32,
    b => b.block(labelledBlock(b, "scope", unconditionalFor("loop", b.block({ ...selectedBreak(b, "loop"), label: null })), "loop"), b.returns(b.id("x", 0, T.int32))));
  for (const [program, records, endings] of [[empty, 2, ["goto", "goto"]], [continuing, 2, ["goto", "goto"]],
    [returned, 4, ["goto", "return"]], [broken, 5, ["goto", "goto", "return"]], [alias, 5, ["goto", "goto", "return"]]]) {
    const mir = lower(program);
    assert.deepEqual(mir.blocks.map(block => block.terminator.kind), endings);
    assert.deepEqual(mir.constants, []);
    assert.equal(mir.blocks[0].terminator.target, 1);
    if (records === 2) assert.equal(mir.blocks[1].terminator.target, 1);
    else assert.deepEqual(mir.blocks.at(-1).terminator.value, { kind: "place", place: 0 });
    for (let maximumRecords = 0; maximumRecords < records; maximumRecords += 1)
      assert.equal(produced({ ...deps, limits: { maximumRecords } }, program.tir, []).kind, "refused", `${program.tir.body} under ${maximumRecords}`);
    assert.deepEqual(produced({ ...deps, limits: { maximumRecords: records } }, program.tir, []).value, mir);
  }
});

test("for expression initialization runs once before its head and nested selected loop targets stay distinct", () => {
  const decision = native("-", "int32", [T.int32], T.int32, EXECUTIONS.writes);
  const initialized = shaped("for.initialized", [["x", "required", T.int32]], T.int32,
    b => b.block(unconditionalFor("loop", b.block(b.returns(b.id("x", 0, T.int32))),
      b.prefix(b.id("x", 0, T.int32), "MinusToken", T.int32, decision))));
  const mir = lower(initialized);
  assert.deepEqual(mir.blocks.map(block => block.terminator.kind), ["invoke", "goto", "return"]);
  assert.deepEqual(mir.blocks.flatMap(block => block.statements).map(record => record.kind), ["storage-live"]);
  assert.deepEqual(mir.blocks[0].terminator.operation, typedOperation(decision));
  assert.equal(mir.blocks[1].terminator.target, 2);
  assert.deepEqual(mir.blocks[2].terminator.value, { kind: "place", place: 0 });
  for (let maximumRecords = 0; maximumRecords < 8; maximumRecords += 1)
    assert.equal(produced({ ...deps, limits: { maximumRecords } }, initialized.tir, []).kind, "refused", `for initializer under ${maximumRecords}`);
  assert.deepEqual(produced({ ...deps, limits: { maximumRecords: 8 } }, initialized.tir, []).value, mir);

  const nested = shaped("for.nested", [], T.void, b => b.block(labelledBlock(b, "outer", unconditionalFor("out-loop", b.block(
    unconditionalFor("inside", b.block({ ...selectedBreak(b, "inside"), label: null })), selectedContinue(b, "outer", true),
    b.throws(b.keyword("TrueKeyword", T.bool))))), b.returns(null)));
  const graph = lower(nested);
  assert.deepEqual(graph.blocks.map(block => [block.terminator.kind, block.terminator.target]), [["goto", 1], ["goto", 2], ["goto", 3], ["goto", 1]]);
  assert.deepEqual([graph.constants, graph.locals, graph.places], [[], [], []]);
  for (let maximumRecords = 0; maximumRecords < 4; maximumRecords += 1)
    assert.equal(produced({ ...deps, limits: { maximumRecords } }, nested.tir, []).kind, "refused", `nested for under ${maximumRecords}`);
  assert.deepEqual(produced({ ...deps, limits: { maximumRecords: 4 } }, nested.tir, []).value, graph);
});

test("for incrementors run after normal completion or selected continues through one actual tail", () => {
  for (const [name, execution] of Object.entries({ pure: { kind: "pure" }, ...EXECUTIONS })) {
    const decision = native("-", "int32", [T.int32], T.int32, execution);
    for (const control of ["normal", "continue", "labelled", "nested", "alias"]) {
      const program = shaped(`for.incrementor.${name}.${control}`, [["x", "required", T.int32]], T.void, b => {
        const incrementor = b.prefix(b.id("x", 0, T.int32), "MinusToken", T.int32, decision);
        const body = control === "normal" ? b.block() : control === "nested" ? b.block(
          unconditionalFor("inside", b.block({ ...selectedBreak(b, "inside"), label: null })), selectedContinue(b, "scope", true))
          : b.block(selectedContinue(b, control === "labelled" ? "scope" : "loop", control !== "continue"));
        const loop = { ...unconditionalFor("loop", body), incrementor };
        return b.block(control === "labelled" || control === "nested" || control === "alias"
          ? labelledBlock(b, "scope", loop, control === "alias" ? "loop" : "scope") : loop);
      });
      const mir = lower(program);
      const records = control === "nested" ? 11 : 9;
      const tail = mir.blocks.find(block => block.statements.some(record => record.kind === "storage-live"));
      assert.equal(tail !== undefined, true);
      assert.equal(mir.blocks[0].terminator.target, 1);
      assert.equal(mir.blocks[control === "nested" ? 3 : 1].terminator.target, tail.id);
      assert.equal(mir.blocks.at(-1).terminator.kind, "goto");
      assert.equal(mir.blocks.at(-1).terminator.target, 1);
      assert.deepEqual(mir.blocks.flatMap(block => block.statements).filter(record => record.kind === "storage-live").length, 1);
      assert.deepEqual(execution.kind === "pure" ? tail.statements[1].value.operation : tail.terminator.operation, typedOperation(decision));
      if (execution.kind !== "pure") assert.equal(tail.terminator.unwind.kind, execution.failure === "unwind" ? "escape" : execution.failure);
      for (let maximumRecords = 0; maximumRecords < records; maximumRecords += 1)
        assert.equal(produced({ ...deps, limits: { maximumRecords } }, program.tir, []).kind, "refused", `${control}/${name} incrementor under ${maximumRecords}`);
      assert.deepEqual(produced({ ...deps, limits: { maximumRecords: records } }, program.tir, []).value, mir);
    }
  }
});

test("for incrementors are skipped after break/return and initialization remains before the loop tail", () => {
  const decision = native("-", "int32", [T.int32], T.int32, EXECUTIONS.writes);
  for (const control of ["return", "break"]) {
    const program = shaped(`for.incrementor.skipped.${control}`, [["x", "required", T.int32]], T.int32, b => b.block({
      ...unconditionalFor("loop", b.block(control === "return" ? b.returns(b.id("x", 0, T.int32)) : { ...selectedBreak(b, "loop"), label: null })),
      incrementor: b.prefix(b.id("x", 0, T.int32), "MinusToken", T.int32, decision),
    }, b.returns(b.id("x", 0, T.int32))));
    const mir = lower(program);
    assert.equal(mir.blocks.some(block => block.terminator.kind === "invoke"), false);
    assert.deepEqual(mir.blocks.flatMap(block => block.statements), []);
    const records = control === "return" ? 4 : 5;
    for (let maximumRecords = 0; maximumRecords < records; maximumRecords += 1)
      assert.equal(produced({ ...deps, limits: { maximumRecords } }, program.tir, []).kind, "refused", `skipped ${control} under ${maximumRecords}`);
    assert.deepEqual(produced({ ...deps, limits: { maximumRecords: records } }, program.tir, []).value, mir);
  }
  const initialized = shaped("for.incrementor.initialized", [["x", "required", T.int32]], T.void, b => b.block({
    ...unconditionalFor("loop", b.block(), b.prefix(b.id("x", 0, T.int32), "MinusToken", T.int32, decision)),
    incrementor: b.prefix(b.id("x", 0, T.int32), "MinusToken", T.int32, decision),
  }));
  const mir = lower(initialized);
  assert.deepEqual(mir.blocks.map(block => block.terminator.kind), ["invoke", "goto", "goto", "invoke", "goto"]);
  assert.deepEqual(mir.blocks.map(block => block.terminator.target ?? null), [null, 2, 3, null, 2]);
  assert.equal(mir.blocks[0].terminator.next, 1);
  assert.equal(mir.blocks[3].terminator.next, 4);
  for (let maximumRecords = 0; maximumRecords < 13; maximumRecords += 1)
    assert.equal(produced({ ...deps, limits: { maximumRecords } }, initialized.tir, []).kind, "refused", `initialized incrementor under ${maximumRecords}`);
  assert.deepEqual(produced({ ...deps, limits: { maximumRecords: 13 } }, initialized.tir, []).value, mir);
});

test("selected boolean for conditions repeat after the actual update and skip it after break or return", () => {
  for (const control of ["normal", "continue", "labelled", "break", "return"]) {
    const program = shaped(`for.boolean.${control}`, [["flag", "required", T.bool], ["x", "required", T.int32]], T.void, b => {
      const selected = control === "normal" ? b.block() : control === "break" ? selectedBreak(b, "loop")
        : control === "return" ? { $: "return", ...b.returns(null) } : selectedContinue(b, control === "labelled" ? "label" : "loop", control === "labelled");
      const effect = name => ({ $: name, ...b.prefix(b.id("x", 1, T.int32), "MinusToken", T.int32,
        native("-", "int32", [T.int32], T.int32, EXECUTIONS.writes)) });
      const loop = { ...unconditionalFor("loop", selected, effect("initialize")), condition: b.id("flag", 0, T.bool), incrementor: effect("update") };
      return b.block(control === "labelled" ? labelledBlock(b, "label", loop) : loop, { $: "after", ...b.returns(null) });
    });
    const mir = lower(program);
    for (const initiallyTrue of [false, true]) {
      let conditions = 0;
      const path = walk(mir, { decide: point => point.kind === "switch" ? initiallyTrue && conditions++ === 0 : "normal" });
      const completesBody = initiallyTrue && (control === "return" || control === "break");
      assert.equal(path.events.filter(item => item.kind === "switch").length, initiallyTrue && !completesBody ? 2 : 1);
      assert.equal(path.events.filter(item => item.kind === "invoke" && item.node === program.at("initialize")).length, 1);
      assert.equal(path.events.filter(item => item.kind === "invoke" && item.node === program.at("update")).length, initiallyTrue && !completesBody ? 1 : 0);
      assert.equal(path.events.at(-1).node, program.at(initiallyTrue && control === "return" ? "return" : "after"));
    }
    const size = mir.locals.length + mir.places.length + mir.constants.length + mir.blocks.length
      + mir.blocks.reduce((count, block) => count + block.statements.length, 0);
    for (let maximumRecords = 0; maximumRecords < size; maximumRecords += 1)
      assert.equal(produced({ ...deps, limits: { maximumRecords } }, program.tir, []).kind, "refused", `boolean for ${control} under ${maximumRecords}`);
    assert.equal(produced({ ...deps, limits: { maximumRecords: size } }, program.tir, []).kind, "ok");
  }
  for (const choice of [false, true]) {
    const program = shaped(`for.boolean.literal.${choice}`, [], T.void, b => b.block({ ...unconditionalFor("loop",
      { $: "inside", ...b.returns(null) }), condition: b.keyword(choice ? "TrueKeyword" : "FalseKeyword", choice ? literalTrue : literalFalse) },
      { $: "after", ...b.returns(null) }));
    const mir = lower(program);
    assert.equal(recordsOf(mir).some(item => item.kind === "switch"), false);
    assert.equal(walk(mir).events.at(-1).node, program.at(choice ? "inside" : "after"));
  }
});

test("malformed for declarations and invalid selected continue owners remain explicit", () => {
  for (const flags of [[], ["Let"], ["Const"]]) {
    const empty = shaped(`for.empty.declaration.${flags[0] ?? "var"}`, [], T.void,
      b => b.block(unconditionalFor("loop", b.block(), { ...b.declarationList([]), flags })));
    assert.throws(() => produced(deps, empty.tir, []), error => defectOfLowerMir(error)
      && error.message === `${CALLER_DEFECT}an empty variable declaration list`);
  }
  const missing = shaped("for.missing-initializer", [], T.void,
    b => b.block(unconditionalFor("loop", b.block(), { kind: "MissingDeclaration", modifiers: null, tsonic: null })));
  assert.throws(() => produced(deps, missing.tir, []), error => defectOfLowerMir(error) && error.message.includes("missing declaration in for initialization"));
  const foreign = shaped("for.foreign", [], T.void, b => b.block({ kind: "ContinueStatement", label: null,
    tsonic: { target: { body: bodyId("for.other"), node: 0 } } }));
  assert.throws(() => produced(deps, foreign.tir, []), error => defectOfLowerMir(error) && error.message.includes("continue targets another body"));
  const unknown = shaped("for.unknown", [], T.void, b => b.block({ kind: "ContinueStatement", label: null, tsonic: { target: b.nodeRef(0) } }));
  assert.throws(() => produced(deps, unknown.tir, []), error => defectOfLowerMir(error) && error.message.includes("no active loop target"));
  const block = shaped("for.non-loop", [], T.void, b => b.block(labelledBlock(b, "scope", b.block(selectedContinue(b, "scope", true)))));
  assert.throws(() => produced(deps, block.tir, []), error => defectOfLowerMir(error) && error.message.includes("no active loop target"));
});

test("first producer: a record limit that is not a count is the caller's defect, raised before any record is made (K-3338)", () => {
  const program = add("first.add.limit", T.float64, plus("float64", T.float64));
  const unread = { get root() { assert.fail("malformed counts must be rejected before the body is read"); },
    get signature() { assert.fail("malformed counts must be rejected before the signature is read"); } };
  for (const maximumRecords of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -0, -1, 1.5, 8.999,
    Number.MAX_SAFE_INTEGER + 1, undefined, "1", 1n])
    assert.throws(() => lowerRequired({ ...deps, limits: { maximumRecords } }, unread, [], [2]),
      error => error instanceof TypeError && error.message === "lower-mir: maximumRecords must be a safe nonnegative count", String(maximumRecords));
  // Zero is a count: the body is refused with the size-limit diagnostic, not raised. The exact need is admitted.
  const zero = produced({ ...deps, limits: { maximumRecords: 0 } }, program.tir, []);
  assert.deepEqual([zero.kind, zero.diagnostics.map(diagnostic => diagnostic.code.rendered)], ["refused", ["TSONIC_COMPILER_RESOURCE_LIMIT"]]);
  assert.equal(produced({ ...deps, limits: { maximumRecords: 9 } }, program.tir, []).kind, "ok");
  assert.deepEqual(produced({ ...deps, limits: { maximumRecords: Number.MAX_SAFE_INTEGER } }, program.tir, []),
    produced({ ...deps, limits: { maximumRecords: 9 } }, program.tir, []));
  // The check comes first: a body past the frontier with an invalid limit is still the limit's defect.
  const generator = shaped("first.limit.generator", [["a", "required", T.int32]], T.int32, b => b.block(b.returns(b.id("a", 0, T.int32))), { extra: { generator: true } });
  assert.throws(() => produced({ ...deps, limits: { maximumRecords: -1 } }, generator.tir, []), TypeError);
});

test("first producer: an identity refinement is no check, and a parenthesized operand is its inner value", () => {
  const identity = { kind: "identity", type: T.int32 };
  const program = shaped("first.identity", [["a", "required", T.int32]], T.int32,
    b => b.block(b.returns(b.paren(b.id("a", 0, T.int32, { value: { narrowing: identity } }), T.int32))));
  const mir = lower(program);
  assert.deepEqual([mir.blocks.length, mir.blocks[0].statements, mir.blocks[0].terminator.value], [1, [], { kind: "place", place: 0 }]);
});

test("first producer: the frontier is one check that names what it met", () => {
  const refused = (program, what) => assert.throws(() => produced(deps, program.tir, []), notLoweredYet(what), what);
  const returning = (name, makeExpression, rows = [["a", "required", T.int32]], completion = T.int32, options = {}) =>
    shaped(name, rows, completion, b => b.block(b.returns(makeExpression(b))), options);
  const a = b => b.id("a", 0, T.int32);
  const P = plus("int32", T.int32);
  // Bodies and parameter rows.
  refused(returning("frontier.async", a, undefined, undefined, { extra: { asynchronous: true } }), "an asynchronous body or a generator");
  refused(returning("frontier.generator", a, undefined, undefined, { extra: { generator: true } }), "an asynchronous body or a generator");
  refused(returning("frontier.rest", a, [["a", "rest", T.int32]]), "a parameter of role rest");
  // Statements and expressions.
  refused(shaped("frontier.statement", [["a", "required", T.int32]], T.int32,
    b => b.block(b.declare([], { role: "using", asynchronous: false, protocols: [] }), b.returns(a(b)))), "a using declaration");
  refused(returning("frontier.numeric-role", b => ({ ...b.num("1", T.int32), tsonic: { role: "type-literal", type: T.int32 } })),
    "a numeric literal of role type-literal");
  refused(returning("frontier.bigint-role", () => ({ kind: "BigIntLiteral", text: "1n", tokenFlags: [],
    tsonic: { role: "type-literal", type: T.literalBigint } }), [], T.literalBigint), "a bigint literal of role type-literal");
  refused(returning("frontier.prefix-role", b => ({ ...b.prefix(a(b), "MinusToken", T.int32, P),
    tsonic: { role: "type-literal", type: T.int32 } })), "a prefix expression of role type-literal");
  refused(returning("frontier.keyword-role", b => ({ ...b.keyword("TrueKeyword", T.bool), tsonic: { role: "type-literal", type: T.bool } }), [], T.bool),
    "a keyword literal of role type-literal");
  refused(returning("frontier.string-role", () => ({ kind: "StringLiteral", text: "x", tokenFlags: [],
    tsonic: { role: "type-literal", type: T.string } }), [], T.string), "a string literal of role type-literal");
  assert.throws(() => produced(deps, returning("frontier.short-circuit", b => b.binary(a(b), "AmpersandAmpersandToken", a(b), {
    ...value(T.int32), role: "short-circuit", selection: { kind: "and", control: 0, right: 0, disposition: "dynamic" },
  })).tir, []), error => defectOfLowerMir(error) && error.message.includes("actual operands"));
  refused(returning("frontier.target", b => b.target("a", 0, T.int32)), "an identifier of role assignment-target");
  refused(returning("frontier.global", b => b.global("g", "frontier.g", T.int32)), "a name resolved to a definition");
  refused(shaped("frontier.outerLocal", [["a", "required", T.int32]], T.int32,
    b => b.block(b.returns({ kind: "Identifier", text: "x", tsonic: { ...b.id("x", 0, T.int32).tsonic, resolution: { kind: "local", local: { body: bodyId("frontier.outer"), local: 0 } } } }))),
    "a local that is not a parameter of the body");
  refused(shaped("frontier.bodyLocal", [["a", "required", T.int32]], T.int32, b => b.block(b.returns(b.id("x", 1, T.int32))),
    { extra: { extra: { locals: [{ id: 0, declaration: { kind: "body", value: { body: bodyId("frontier.bodyLocal"), node: 0 } }, name: "a", role: "parameter", capturedFrom: null, mutable: false, storage: T.int32 },
      { id: 1, declaration: { kind: "body", value: { body: bodyId("frontier.bodyLocal"), node: 0 } }, name: "x", role: "binding", capturedFrom: null, mutable: false, storage: T.int32 }] } } }),
  "a local that is not a parameter of the body");
  // Values: the arms of the conversion decision that are not the identity, a narrowed use, a selected demand. None
  // is reached by a checkpoint program yet; each is refused, so none looks lowered.
  const valued = (name, extra) => returning(name, b => b.id("a", 0, T.int32, { value: extra }));
  refused(valued("frontier.demand", { demand: { kind: "never", control: 0 } }), "a value demanded under a selection");
  refused(returning("frontier.parenthesized", b => ({ ...b.paren(a(b), T.int32), tsonic: { ...b.paren(a(b), T.int32).tsonic, demand: { kind: "never", control: 0 } } })),
    "a value demanded under a selection");
});

test("first producer: a body that must not be offered is a caller defect, told from the frontier", () => {
  const defect = (program, what) => assert.throws(() => produced(deps, program.tir, []),
    error => defectOfLowerMir(error) && error.message === `${CALLER_DEFECT}${what}`, what);
  const returning = (name, makeExpression, completion = T.int32) =>
    shaped(name, [["a", "required", T.int32]], completion, b => b.block(b.returns(makeExpression(b))));
  const deferred = { invocation: { rule: "embed", input: null }, result: T.int32 };
  defect(returning("defect.prefix", b => ({ ...b.prefix(b.id("a", 0, T.int32), "MinusToken", T.int32, plus("int32", T.int32)),
    tsonic: { ...value(T.int32), role: "value", operation: { kind: "deferred", deferred } } })), "a deferred operation");
  defect(returning("defect.conversion", b => b.id("a", 0, T.int32, { value: { conversion: { kind: "deferred", deferred } } })), "a deferred conversion");
  defect(returning("defect.operation", b => ({ ...b.arithmetic(b.id("a", 0, T.int32), "PlusToken", b.id("a", 0, T.int32), T.int32, plus("int32", T.int32)),
    tsonic: { ...b.arithmetic(b.id("a", 0, T.int32), "PlusToken", b.id("a", 0, T.int32), T.int32, plus("int32", T.int32)).tsonic, operation: { kind: "deferred", deferred } } })),
  "a deferred operation");
  defect(returning("defect.resolution", () => ({ kind: "Identifier", text: "missing", tsonic: { type: T.int32, convertedType: T.int32, conversion: { kind: "identity" },
    narrowing: null, evidenceIndex: null, demand: { kind: "always" }, role: "value", resolution: { kind: "error", diagnostic: 0 } } })), "an error resolution");
  defect(shaped("defect.end", [["a", "required", T.int32]], T.int32, b => b.block()), "the end of a body that completes with a value is reached");
  // Initializer data supplied with the body: the body places an initializer execution, which is past the frontier.
  const program = add("defect.internal", T.int32, plus("int32", T.int32));
  assert.deepEqual(produced(deps, program.tir, [{ instance: { body: bodyId("defect.internal", "default"), bindings: SELECTED_BINDINGS }, captures: [], signature: 0 }]),
    produced(deps, program.tir, []), "unused supplied data never fabricates an initializer execution");
  // A statement list with a hole is a defect of the tree, reported by name (R5 C-a).
  const holed = shaped("defect.hole", [["a", "required", T.int32]], T.int32, b => ({ ...b.block(), statements: { $list: true, nodes: [, b.returns(b.id("a", 0, T.int32))] } }));
  assert.throws(() => produced(deps, holed.tir, []), error => error instanceof Error && error.cause !== undefined && error.cause.owner === "lower-mir"
    && error.message === "a statement list has a hole");
  defect(shaped("defect.endUnknown", [["a", "required", T.int32]], T.unknown, b => b.block()), "the end of a body that completes with a value is reached");
});

// ---- WT-1 -----------------------------------------------------------------------------------

test("WT-1 add: a pure operation is a statement and the body has one entry", () => {
  const program = wt1().add;
  const mir = lower(program);
  // Section 7 part 8, WT-1: "`add` is a statement". R2: a pure decision is a statement between control points.
  const path = walk(mir);
  assert.deepEqual(effectsOn(path), []);
  const sum = statementsOn(path).filter(item => valueKindOf(item) === "binary");
  assert.equal(sum.length, 1);
  assert.equal(sum[0].node, program.at("left+right"));
  assert.equal(path.end, "return");
  // Section 7 part 8, WT-1: "one entry each". R7: both fixed arguments are required, so only the full count is admissible.
  assert.deepEqual(providedCountsOf(mir), [2]);
});

test("WT-1 total: the call is one control point with two supplied arguments", () => {
  const program = wt1().total;
  const mir = lower(program);
  // Section 7 part 8, WT-1: "the call a control point". R5: the effect appears once and names its source occurrence.
  const calls = effects(mir).filter(point => point.kind === "call");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].node, program.at("add(20,22)"));
  assert.deepEqual(argumentKindsOf(calls[0]), ["value", "value"]);
  assert.deepEqual(checks(mir), []);
  assert.deepEqual(providedCountsOf(mir), [0]);
});

test("WT-1 count: the loop body runs once per true condition and the body returns after a false one", () => {
  const { count: program, countInitializer } = wt1();
  const initializer = { instance: { body: countInitializer.tir.body, bindings: countInitializer.tir.bindings },
    captures: countInitializer.tir.captures, signature: countInitializer.tir.signature };
  const childKey = instanceKey(initializer.instance);
  program.bodyOf = instance => instanceKey(instance) === childKey ? countInitializer.tir : null;
  const child = lower(countInitializer);
  const [completion] = child.blocks.filter(block => block.terminator.kind === "return");
  assert.deepEqual(child.constants[completion.terminator.value.constant].value,
    { kind: "literal", value: { kind: "number", token: "0", value: { numerator: 0n, denominator: 1n, negativeZero: false } } });
  assert.equal(effects(child).length, 0);
  const mir = lower(program, [initializer]);
  const [call] = effects(mir);
  assert.equal(effects(mir).length, 1);
  assert.equal(call.kind, "call");
  assert.equal(call.node, program.at("current"));
  assert.deepEqual(call.record.callee, { kind: "body", instance: initializer.instance, captures: [] });
  assert.equal(mir.locals[rootLocalOf(mir, call.record.destination)].source.local, 1);
  for (const iterations of [0, 1, 2]) {
    let remaining = iterations;
    const path = walk(mir, { decide: point => point.kind === "switch" ? remaining-- > 0 : "normal" });
    const increments = statementsOn(path).filter(item => item.kind === "assign" && item.node === program.at("current+1"));
    assert.equal(increments.length, iterations);
    assert.deepEqual(effectsOn(path), [call]);
    assert.equal(path.end, "return");
  }
});

// ---- WT-6 -----------------------------------------------------------------------------------

test("WT-6 indexed fixed static storage is read and written without an aggregate copy", () => {
  const owner = def("fixedSlots");
  const name = "fixedSlotsAccess";
  const b = builders(name);
  const selected = () => ({ kind: "Identifier", text: "fixedSlots", tsonic: { ...value(T.int32Fixed4), role: "value",
    resolution: { kind: "static", declaration: { owner, node: 0 }, aliases: [] } } });
  const indexed = access => b.element(b.paren(selected(), T.int32Fixed4), b.num("0", T.int32), nativeIndex(T.int32Fixed4, T.int32, access, "unwind"));
  const program = typedBody(name, { signature: signature(name, [], T.int32), completion: T.int32,
    root: b.block(b.expressionStatement(b.assign(indexed("write"), "EqualsToken", b.num("1", T.int32), T.int32, T.int32)),
      b.returns(indexed("read"))) });
  const mir = lower(program);
  assert.equal(mir.locals.length, 0);
  assert.deepEqual(checks(mir).map(point => mir.places[mir.places[point.record.place].base.place].base),
    [{ kind: "static", definition: owner }, { kind: "static", definition: owner }]);
  const stores = mir.blocks.flatMap(block => block.statements.filter(row => row.kind === "assign"));
  assert.equal(stores.length, 1);
  assert.equal(stores[0].place, checks(mir)[0].record.place);
  assert.equal(walk(mir, { decide: point => point.kind === "check" ? "unwind" : "normal" }).events.some(row => row.kind === "assign"), false);
});

for (const policy of POLICIES) {
  const failing = policy.bounds === "abort" ? "abort" : "escape";
  const failingAbsent = policy.absent === "abort" ? "abort" : "escape";

  test(`WT-6 order (${policy.bounds}/${policy.absent}): effects and checks execute once, in authored order`, () => {
    const program = wt6(policy).order;
    const mir = lower(program);
    // Section 7 part 8, WT-6: "`i()` before `f()`; the index check of `a[i()] += f()` at the read and, because a call
    // stands between that read and the store into a carrier whose extent can change, a second control point at the
    // store"; "`opt` is read and tested once, before the right-hand side"; "`return` through `finally`".
    const path = walk(mir);
    assert.deepEqual(labelled(program, nodesOn(path)),
      ["i()", "@target", "f()#1", "@target", "f()#2", "@bang", "a[0]#read", "a[0]#write"]);
    assert.equal(path.end, "return");
    // R5: no effect occurrence is emitted twice (graph law 9). The two records at @target are the checks of the
    // read and of the store.
    for (const label of ["i()", "f()#1", "f()#2"]) assert.equal(at(mir, program.at(label), "call").length, 1);
    assert.equal(checks(mir, program.at("@target")).length, 2);
    assert.equal(checks(mir, program.at("@bang")).length, 1);
  });

  test(`WT-6 order (${policy.bounds}/${policy.absent}): both checks of a[i()] use the array and index evaluated once`, () => {
    const program = wt6(policy).order;
    const mir = lower(program);
    // Section 7 part 8, WT-6: "a second control point at the store over the same evaluated array and index". R11:
    // "receiver and index are evaluated once; a reference receiver is captured where it is authored". Graph law 4.
    const [first, second] = checks(mir, program.at("@target")).map(point => checkedPlace(mir, point));
    assert.equal(first.projection, "index");
    assert.equal(second.parentRoot, first.parentRoot);
    assert.deepEqual(second.index, first.index);
    assert.equal(first.index.kind, "place");
    assert.equal(writesOf(mir, rootLocalOf(mir, first.index.place)), 1);
    assert.ok(writesOf(mir, first.parentRoot) <= 1);
  });

  test(`WT-6 order (${policy.bounds}/${policy.absent}): each check carries the selected failure kind`, () => {
    const program = wt6(policy).order;
    const mir = lower(program);
    // R1: a check is a control point "with its failure kind: unwinds to a named handler or out of the body, or ends the
    // process". WT-6: "the MIR differs only in the failure edge of the same test". The read of a[0] stands inside
    // `try … finally`, so an unwinding failure there enters the cleanup; the other checks stand outside any handler.
    const kinds = Object.fromEntries(["@target", "@bang", "a[0]#read", "a[0]#write"].map(label =>
      [label, checks(mir, program.at(label)).map(point => point.failure)]));
    assert.deepEqual(kinds, {
      "@target": [failing, failing], "@bang": [failingAbsent],
      "a[0]#read": [policy.bounds === "abort" ? "abort" : "carry"], "a[0]#write": [policy.bounds === "abort" ? "abort" : "carry"],
    });
  });

  test(`WT-6 order (${policy.bounds}/${policy.absent}): each read and each store stands where the source evaluates it`, () => {
    const program = wt6(policy).order;
    const mir = lower(program);
    const path = walk(mir);
    const position = predicate => indexOfEvent(path, predicate);
    const terminatorOf = point => position(item => item.statement === null && item.block === point.block);
    // a[i()] += f(). Section 7 part 8, WT-6: "the index check … at the read". The element is read between its first
    // check and f(), and stored after the second check through the place that check resolved (graph law 3).
    const [firstCheck, secondCheck] = checks(mir, program.at("@target")).sort((one, other) => terminatorOf(one) - terminatorOf(other));
    const read = position(item => item.statement !== null && readsPlace(mir, item, firstCheck.record.place));
    const stored = path.events.findLastIndex(item => storesPlace(mir, item, secondCheck.record.place));
    const callF = position(item => item.statement === null && item.node === program.at("f()#1"));
    assert.ok(terminatorOf(firstCheck) < read && read < callF, "the element is read after its check and before f()");
    assert.ok(callF < terminatorOf(secondCheck) && terminatorOf(secondCheck) < stored, "the element is stored after the second check");
    // opt!.count += (opt = undefined, 1): `count` is read before the right-hand side is evaluated.
    const readCount = position(item => item.statement !== null && operandPlacesOf(item).some(place => fieldKeyOf(mir, place) === "count"));
    const assigned = position(item => item.statement !== null && item.kind === "assign" && item.node === program.at("opt=undefined"));
    assert.ok(readCount !== -1 && readCount < assigned, "count is read before opt is assigned");
    // try { return a[0]; } finally { a[0] = 0; }: the result is read before the cleanup stores, and what is returned
    // is the value read, not the element after the store.
    const readCheck = checks(mir, program.at("a[0]#read"))[0];
    const writeCheck = checks(mir, program.at("a[0]#write"))[0];
    const readFirst = position(item => item.statement !== null && readsPlace(mir, item, readCheck.record.place));
    const storeFirst = position(item => storesPlace(mir, item, writeCheck.record.place));
    assert.ok(readFirst !== -1 && readFirst < storeFirst, "a[0] is read before the cleanup stores into it");
    const returned = path.events.at(-1);
    assert.equal(returned.kind, "return");
    assert.equal(readsPlace(mir, returned, readCheck.record.place) || readsPlace(mir, returned, writeCheck.record.place), false);
  });

  test(`WT-6 order (${policy.bounds}/${policy.absent}): o.inner is read before f() and the store goes into that object`, () => {
    const program = wt6(policy).order;
    const mir = lower(program);
    // Section 7 part 8, WT-6: "`o.inner` read before `f()` and the store into that object". R11: a reference receiver
    // is captured where it is authored.
    const path = walk(mir);
    const readInner = indexOfEvent(path, item => readsField(mir, item, "inner"));
    const callF = indexOfEvent(path, item => item.statement === null && item.node === program.at("f()#2"));
    const storeX = indexOfEvent(path, item => storesField(mir, item, "x"));
    assert.ok(readInner !== -1 && readInner < callF && callF < storeX);
    const captured = storedRootOf(mir, path.events[readInner]);
    assert.equal(storedRootOf(mir, path.events[storeX]), captured);
    assert.equal(writesOf(mir, captured), 1);
    assert.equal(storedChainLengthOf(mir, path.events[storeX]), 2);
  });

  test(`WT-6 order (${policy.bounds}/${policy.absent}): opt is tested once before the right-hand side and is not read again`, () => {
    const program = wt6(policy).order;
    const mir = lower(program);
    // Section 7 part 8, WT-6: "`opt` is read and tested once, before the right-hand side. Its type is held by reference,
    // so the receiver is that object: the store after the assignment goes into it, there is no second absence test …
    // The variable `opt` is not read again to stand for the captured object."
    const path = walk(mir);
    const optLocal = sourceLocal(mir, 3);
    const test = indexOfEvent(path, item => item.statement === null && item.node === program.at("@bang"));
    const assignment = indexOfEvent(path, item => item.statement !== null && item.kind === "assign" && item.node === program.at("opt=undefined"));
    const store = path.events.findLastIndex(item => storesField(mir, item, "count"));
    assert.ok(test !== -1 && test < assignment && assignment < store);
    assert.equal(storedRootOf(mir, path.events[assignment]), optLocal);
    assert.notEqual(storedRootOf(mir, path.events[store]), optLocal);
    assert.equal(writesOf(mir, storedRootOf(mir, path.events[store])), 1);
  });

  test(`WT-6 order (${policy.bounds}/${policy.absent}): a failing read inside try runs finally only when the failure unwinds`, () => {
    const program = wt6(policy).order;
    const mir = lower(program);
    // R6: every abnormal exit passes through each enclosing cleanup once. R1 and COMMON-DATA §10: a failure that ends
    // the process has no edge; no handler or cleanup runs after it.
    const path = walk(mir, { decide: point => point.node === program.at("a[0]#read") && point.kind === "check" ? "unwind" : "normal" });
    const tested = labelled(program, nodesOn(path, new Set(["check"]))).slice(-2);
    if (policy.bounds === "abort") { assert.equal(path.end, "abort"); assert.equal(tested.at(-1), "a[0]#read"); }
    else { assert.equal(path.end, "unwind"); assert.deepEqual(tested, ["a[0]#read", "a[0]#write"]); }
  });

  test(`WT-6 orderGrow (${policy.bounds}/${policy.absent}): a call between the read and the store over a growable carrier: a second control point`, () => {
    const program = wt6(policy).orderGrow;
    const mir = lower(program);
    assert.deepEqual(labelled(program, nodesOn(walk(mir))), ["i()", "@target", "grow(a)", "@target", "a[0]"]);
  });

  test(`WT-6 orderFixed (${policy.bounds}/${policy.absent}): a fixed extent held in place: no second control point`, () => {
    const program = wt6(policy).orderFixed;
    const mir = lower(program);
    assert.deepEqual(labelled(program, nodesOn(walk(mir))), ["i()", "@target", "f()", "a[0]"]);
    assert.equal(checks(mir, program.at("@target")).length, 1);
    // R11: "value storage is addressed in place and never copied to stand for the destination". The fixed array is the
    // parameter's own storage: the checked place is rooted at that local.
    assert.equal(checkedPlace(mir, checks(mir)[0]).parentRoot, sourceLocal(mir, 0));
  });

  test(`WT-6 orderInPlace (${policy.bounds}/${policy.absent}): a narrowed type held in place is tested again after the right-hand side`, () => {
    const program = wt6(policy).orderInPlace;
    const mir = lower(program);
    // Section 7 part 8, the WT-6 row, for a type held in place: the place is "resolved again after the right-hand
    // side and tested against what the variable then holds". The store goes into the variable's own storage.
    const path = walk(mir);
    assert.deepEqual(labelled(program, nodesOn(path)), ["@bang", "@bang"]);
    assert.deepEqual(checks(mir, program.at("@bang")).map(point => point.failure), [failingAbsent, failingAbsent]);
    const tests = path.events.map((item, index) => item.statement === null && item.kind === "check" ? index : -1).filter(index => index !== -1);
    const assignment = indexOfEvent(path, item => item.statement !== null && item.kind === "assign" && item.node === program.at("opt=undefined"));
    const store = path.events.findLastIndex(item => storesField(mir, item, "count"));
    assert.ok(tests[0] < assignment && assignment < tests[1] && tests[1] < store);
    assert.equal(storedRootOf(mir, path.events[store]), sourceLocal(mir, 0));
    const [first, final] = checks(mir, program.at("@bang"));
    assert.equal(first.record.place, final.record.place);
    const failurePath = walk(mir, { decide: event => event.record === final.record ? "unwind" : "normal" });
    assert.equal(failurePath.end, policy.absent === "abort" ? "abort" : "unwind");
    assert.equal(failurePath.events.some(event => storesField(mir, event, "count")), false);
  });

  test(`WT-6 orderFixedByReference (${policy.bounds}/${policy.absent}): a formal can lend inline storage without changing its holding`, () => {
    const program = wt6(policy).orderFixedByReference;
    const mir = lower(program);
    assert.deepEqual(labelled(program, nodesOn(walk(mir))), ["i()", "@target", "f()", "a[0]"]);
    assert.equal(checks(mir, program.at("@target")).length, 1);
    assert.equal(checkedPlace(mir, checks(mir)[0]).parentRoot, sourceLocal(mir, 0));
  });

  test(`WT-6 carrier holding (${policy.bounds}/${policy.absent}): a fixed reference is captured; growable inline storage is not`, () => {
    const { orderFixedReplace: fixed, orderGrow: growable } = wt6(policy, { fixedArrayHolding: "by-reference", arrayHolding: "in-place" });
    const fixedMir = lower(fixed);
    const fixedPath = walk(fixedMir);
    assert.deepEqual(labelled(fixed, nodesOn(fixedPath)), ["i()", "@target", "a[0]"]);
    const [target, laterRead] = checks(fixedMir);
    const savedReceiver = checkedPlace(fixedMir, target).parentRoot;
    assert.notEqual(savedReceiver, sourceLocal(fixedMir, 0));
    assert.notEqual(checkedPlace(fixedMir, laterRead).parentRoot, savedReceiver);
    const save = indexOfEvent(fixedPath, event => event.kind === "assign" && storedRootOf(fixedMir, event) === savedReceiver);
    const index = indexOfEvent(fixedPath, event => event.node === fixed.at("i()"));
    const replace = indexOfEvent(fixedPath, event => event.kind === "assign" && event.node === fixed.at("replaced"));
    assert.ok(save !== -1 && save < index && index < replace);
    const grown = lower(growable);
    const first = checks(grown, growable.at("@target"));
    assert.deepEqual(labelled(growable, nodesOn(walk(grown))), ["i()", "@target", "grow(a)", "@target", "a[0]"]);
    assert.equal(first.length, 2);
    assert.equal(first[0].record.place, first[1].record.place);
    assert.equal(checkedPlace(grown, first[0]).parentRoot, sourceLocal(grown, 0));
  });

  test(`WT-6 orderFixedAliased (${policy.bounds}/${policy.absent}): handing out the same fixed location does not resize it`, () => {
    const program = wt6(policy).orderFixedAliased;
    const mir = lower(program);
    assert.deepEqual(labelled(program, nodesOn(walk(mir))), ["i()", "@target", "mutateFixed(a)", "a[0]"]);
    const [checked] = checks(mir, program.at("@target"));
    const [call] = at(mir, program.at("mutateFixed(a)"), "call");
    assert.deepEqual(call.record.arguments, [{ kind: "place", passing: "byref-readwrite", place: mir.places[checked.record.place].base.place }]);
    assert.equal(checkedPlace(mir, checked).parentRoot, sourceLocal(mir, 0));
  });

  test(`WT-6 orderFixedReplace (${policy.bounds}/${policy.absent}): an explicit receiver write ends the prior check`, () => {
    const program = wt6(policy).orderFixedReplace;
    const mir = lower(program);
    const path = walk(mir);
    assert.deepEqual(labelled(program, nodesOn(path)), ["i()", "@target", "@target", "a[0]"]);
    const [first, repeated] = checks(mir, program.at("@target"));
    assert.equal(first.record.place, repeated.record.place);
    const replacement = path.events.findIndex(event => event.kind === "assign" && event.node === program.at("replaced"));
    assert.ok(path.events.findIndex(event => event.record === first.record) < replacement);
    assert.ok(replacement < path.events.findIndex(event => event.record === repeated.record));
    const withoutRecheck = { ...mir, blocks: mir.blocks.map(block => block.id === repeated.block ? { ...block,
      terminator: { kind: "goto", target: repeated.record.next, origin: repeated.record.origin, tir: repeated.record.tir } } : block) };
    assert.ok(verified(withoutRecheck, program).some(violation => violation.rule === "checked-place-available"));
  });
}

test("WT-6: the failure policies give the same graph except for the failure kind of the same checks", () => {
  // WALKTHROUGH-PROGRAMS WT-6: "the MIR differs only in the failure edge of the same test (K-3212 point 3)".
  const [reference, ...others] = POLICIES.map(policy => wt6(policy));
  const normalPath = programs => walk(lower(programs.order)).events.map(item => [item.kind, item.node]);
  for (const programs of others) {
    for (const name of ["orderGrow", "orderFixed", "orderFixedByReference", "orderFixedAliased", "orderFixedReplace", "orderInPlace"])
      assert.deepEqual(withoutFailureKinds(lower(programs[name])), withoutFailureKinds(lower(reference[name])));
    // `order` has a cleanup that an unwinding failure enters and a process-ending failure does not; the path that
    // completes normally is the same under every policy.
    assert.deepEqual(normalPath(programs), normalPath(reference));
  }
});

// ---- WT-4 -----------------------------------------------------------------------------------

const internalCalls = internalCallsOn;

test("WT-4 f: three entries by supplied count; a default runs only in the entry that omits its parameter", () => {
  const programs = wt4();
  const mir = lower(programs.f, programs.internal);
  // R7 and section 7 part 8, WT-4: "`f` has three entries", one per admissible count of supplied fixed arguments.
  // Graph law 7 says they are ordered by supplied count; the cases below find each entry by its count, not by its
  // position or block.
  // Graph law 7 as the foundation enforces it: the full count first, each next count one less.
  assert.deepEqual(providedCountsOf(mir), [2, 1, 0]);
  const entryOf = provided => providedCountsOf(mir).indexOf(provided);
  const defaults = provided => internalCalls(walk(mir, { entry: entryOf(provided) })).map(calleeNameOf);
  // WT-4: "the default body runs only for an omitted argument"; "a default that reads an earlier parameter": x's
  // default runs before y's.
  assert.deepEqual(defaults(2), []);
  assert.deepEqual(defaults(1), [programs.Y_DEFAULT]);
  assert.deepEqual(defaults(0), [programs.X_DEFAULT, programs.Y_DEFAULT]);
  // R8: an initializer body executes "as an explicit execution of that body instance", into the parameter it initializes.
  const [xDefault, yDefault] = internalCalls(walk(mir, { entry: entryOf(0) }));
  assert.equal(destinationRootOf(mir, xDefault), sourceLocal(mir, 0));
  assert.equal(destinationRootOf(mir, yDefault), sourceLocal(mir, 1));
  // WT-4: "the default body as a callee with captures": y's default reads the already-bound x.
  assert.deepEqual(capturedLocalsOf(yDefault), [{ body: bodyId("f"), local: 0 }]);
  assert.deepEqual(capturedRootsOf(mir, yDefault), [sourceLocal(mir, 0)]);
  // Every path ends in the one shared body: each entry returns.
  for (const provided of [0, 1, 2]) assert.equal(walk(mir, { entry: entryOf(provided) }).end, "return");
});

test("WT-4 x default: next() is one call in the default body, and f's own graph does not call it", () => {
  const programs = wt4();
  // WT-4: "`next()` executes only in the entry that omits `x`": the call belongs to the default body, which only
  // that entry executes.
  const inDefault = effects(lower(programs.xDefault)).filter(point => point.kind === "call");
  assert.equal(inDefault.length, 1);
  assert.equal(inDefault[0].node, programs.xDefault.at("next()"));
  const inF = effects(lower(programs.f, programs.internal)).filter(point => isCall(point) && !isInternalCall(point));
  assert.deepEqual(inF, []);
});

test("WT-4 calls: an omitted argument is represented as omitted; a supplied absence is a value", () => {
  const programs = wt4();
  const mir = lower(programs.calls);
  // R7: "an omitted argument is represented as omitted at the call; a default runs in the callee's entry". Section 7
  // part 8: "`f()` passes two omitted arguments, `f(null)` and `f(undefined)` a supplied absence and one omitted".
  const shape = label => at(mir, programs.calls.at(label), "call").map(argumentKindsOf);
  assert.deepEqual(shape("f()"), [["omitted", "omitted"]]);
  assert.deepEqual(shape("f(null)"), [["value", "omitted"]]);
  assert.deepEqual(shape("f(undefined)"), [["value", "omitted"]]);
  assert.deepEqual(shape("f(1)"), [["value", "omitted"]]);
  assert.deepEqual(shape("f(1,2)"), [["value", "value"]]);
  // The supplied absence is the absence constant; a supplied 1 is the number (R1 section 4).
  const firstArgument = label => argumentConstantOf(mir, at(mir, programs.calls.at(label), "call")[0], 0);
  assert.equal(firstArgument("f(null)"), null);
  assert.equal(firstArgument("f(undefined)"), null);
  assert.equal(firstArgument("f(1)"), 1n);
  // No default executes at a call site.
  assert.deepEqual(internalCalls(walk(mir)), []);
  // R5: the five calls execute in authored order.
  assert.deepEqual(labelled(programs.calls, nodesOn(walk(mir))), ["f()", "f(null)", "f(undefined)", "f(1)", "f(1,2)"]);
});

// ---- S-7 ------------------------------------------------------------------------------------

for (const order of ["fields-first", "base-first"]) {
  // Held (R2 K-4): where the plan of a class without an authored constructor is executed is with Codex (C-3187). This
  // input expands the plan in the body that holds `new Derived()`; the case states the order law and waits for the route.
  test(`S-7 (${order}): construction runs in the order of the ConstructionPlan, on one object`,
    { todo: "waits for C-3187: the body that executes a class-owned ConstructionPlan" }, () => {
    const programs = s7(order);
    const mir = lower(programs.program, programs.internal);
    // R9: "the object exists, then base construction, field initializers and constructor code run in the order the
    // typed body's ConstructionPlan gives (MR-16)". S-7 has one oracle per value of the selected order (MR-15).
    const steps = walk(mir).events.filter(isCall);
    const names = steps.map(calleeNameOf);
    const baseConstructor = def("Base.constructor");
    assert.deepEqual(names, order === "fields-first" ? [programs.V_INIT, programs.SEEN_INIT, baseConstructor]
      : [baseConstructor, programs.V_INIT, programs.SEEN_INIT]);
    // One object: each field initializer writes a field of the object the base constructor receives.
    const base = steps.find(item => !isInternalCall(item));
    const object = receiverRootOf(mir, base);
    assert.notEqual(object, null);
    for (const item of steps.filter(isInternalCall)) {
      assert.equal(destinationRootOf(mir, item), object);
      assert.equal(destinationChainOf(mir, item).length, 2);
    }
    assert.deepEqual(steps.filter(isInternalCall).map(item => destinationFieldOf(mir, item)), ["v", "seen"]);
  });
}

test("S-7: static initializer and static block run at the class declaration in member order", () => {
  const programs = s7("fields-first");
  const mir = lower(programs.moduleBody, programs.moduleInternal);
  // R8 and section 5 part 1 rows 5 and 6: static field initializers and static blocks run "at the class declaration's
  // occurrence in its enclosing body, in member order". S-7: "The static initializer and the static block run in
  // authored order".
  const steps = internalCalls(walk(mir));
  assert.deepEqual(steps.map(calleeNameOf), [programs.COUNT_INIT, programs.STATIC_BLOCK]);
  assert.deepEqual(destinationBaseOf(mir, steps[0]), { kind: "static", definition: def("Derived.count") });
  assert.equal(destinationBaseOf(mir, steps[1]), null);
});

// ---- S-2 ------------------------------------------------------------------------------------

const squash = items => items.filter((item, index) => index === 0 || item !== items[index - 1]);

test("S-2 switch: clauses run in source order with fallthrough; default only when no case matches", () => {
  const program = s2().program;
  const mir = lower(program);
  // S-2 oracle: `s2(1, …)` takes 3 from the switch (case 1 falls through into case 2, then `break`); `s2(2, [])` is 2;
  // `s2(3, [])` is 9. Section 17: S-2 covers "`switch` and labels" for LowerMir ("fallthrough edges").
  const clauses = new Set(["r+=1", "r+=2", "r=9"].map(label => program.at(label)));
  // Each case clause carries the selected equality of its test (NEEDS-W4 G1); the walk answers the test of each clause
  // at the clause's own occurrence, in authored order. Lowering chooses neither the comparison nor the order.
  const run = k => {
    const path = walk(mir, { decide: point => point.kind !== "switch" ? "normal" : isCompletionBranch(point) ? true
      : point.node === program.at("case 1") ? k === 1 : point.node === program.at("case 2") ? k === 2 : "otherwise" });
    assert.equal(path.end, "return");
    return squash(labelled(program, statementsOn(path).filter(item => clauses.has(item.node)).map(item => item.node)));
  };
  assert.deepEqual(run(1), ["r+=1", "r+=2"]);
  assert.deepEqual(run(2), ["r+=2"]);
  assert.deepEqual(run(3), ["r=9"]);
  // The tests run in authored order, each once: with no match, case 1 is tested before case 2.
  const unmatched = walk(mir, { decide: point => point.kind !== "switch" ? "normal" : isCompletionBranch(point) ? true : false });
  const tests = unmatched.events.filter(item => item.statement === null && item.kind === "switch" &&
    (item.node === program.at("case 1") || item.node === program.at("case 2"))).map(item => item.node);
  assert.deepEqual(labelled(program, tests), ["case 1", "case 2"]);
});

test("S-2 labels: continue outer and break outer leave through each iteration cleanup they cross, once", () => {
  const program = s2().program;
  const mir = lower(program);
  // S-2 oracle input `s2(1, [[1, -1, 5], [2, 0, 7]])`: v = 1 is added; v = -1 continues the outer loop; v = 2 is added;
  // v = 0 breaks the outer loop. R6: "every … transfer passes through each enclosing cleanup once, in order": continue
  // outer leaves the inner iteration only; break outer leaves the inner and then the outer iteration.
  const answers = [false, false, false, false, false, true, false, false, false, false, false, false, true];
  const path = walk(mir, { decide: point => {
    if (point.kind !== "switch") return "normal";
    if (point.node === program.at("case 1")) return true;
    if (point.node === program.at("case 2")) return false;
    return answers.shift();
  } });
  assert.equal(path.end, "return");
  assert.deepEqual(answers, []);
  const trace = path.events.map(item => item.statement === null && namesStep(item, ARRAY_STEP.next) ? "next"
    : item.statement === null && namesStep(item, ARRAY_STEP.finish) ? "finish"
    : item.statement !== null && item.node === program.at("r+=v") ? "add" : null).filter(item => item !== null);
  // One addition may be several statements of the same occurrence; they count once.
  assert.deepEqual(trace.filter((item, index) => !(item === "add" && trace[index - 1] === "add")),
    ["next", "next", "add", "next", "finish", "next", "next", "add", "next", "finish", "finish"]);
  // R6 "in order": `continue outer` closes the inner iteration; `break outer` closes the inner one, then the outer one.
  const closed = path.events.filter(item => item.statement === null && namesStep(item, ARRAY_STEP.finish)).map(item => item.node);
  assert.deepEqual(labelled(program, closed), ["for v", "for v", "for row"]);
  // R10: a binding of an iteration is begun again by each iteration: `row` twice, `v` four times on this path.
  const begun = local => path.events.filter(item => item.statement !== null && item.kind === "storage-live" && item.record.local === sourceLocal(mir, local)).length;
  assert.equal(begun(3), 2);
  assert.equal(begun(4), 4);
  // Graph law 8: a parameter is present on entry and carries no marker.
  assert.deepEqual([0, 1].flatMap(parameter => markersOf(mir, sourceLocal(mir, parameter))), []);
});

test("S-2 steps: every record of an iteration names its step; each loop has one completion branch", () => {
  const program = s2().program;
  const mir = lower(program);
  for (const label of ["for row", "for v"]) {
    // R4: a protocol step "says which step of which protocol it is; the edge on which an iteration is complete is
    // identifiable from the record". Graph laws 6 and 9: each step is one record.
    const records = controlPoints(mir).filter(point => point.node === program.at(label) && point.kind === "invoke");
    for (const [role, index] of Object.entries(ARRAY_STEP)) {
      const named = records.filter(point => namesStep(point, index));
      assert.equal(named.length, 1, `${label} ${role}`);
      // The record executes the operation of the step it names: the decision's, not one lowering chose (R12).
      assert.equal(operationName(named[0].record), def(`iterate.${role}`));
    }
    assert.equal(records.every(point => point.step !== null), true);
    const branches = controlPoints(mir).filter(point => point.node === program.at(label) && isCompletionBranch(point));
    assert.equal(branches.length, 1);
    assert.equal(namesStep(branches[0], ARRAY_STEP.done), true);
  }
});

// ---- S-3 ------------------------------------------------------------------------------------

for (const variant of ["unwind", "abort"]) {
  test(`S-3 (${variant}): the call unwinds to the handler; the narrowed use is checked; the rethrow leaves the body`, () => {
    const programs = s3(variant);
    const program = programs.program;
    const mir = lower(program);
    // S-3, LowerMir: "the unwind edge from the call to the handler; the rethrow". R1: the failure kind of a call inside
    // `try … catch` is "unwinds to a named handler".
    const call = at(mir, program.at("risky(n)"), "call");
    assert.equal(call.length, 1);
    assert.equal(call[0].failure, "handler");
    // The handler edge delivers the thrown value into the storage of `e`, and `throw e` reads it (-102 depends on it).
    assert.equal(rootLocalOf(mir, call[0].record.unwind.exception), sourceLocal(mir, 1));
    assert.equal(readsLocal(mir, at(mir, program.at("throw e"), "throw")[0], sourceLocal(mir, 1)), true);
    // `s3(4)` is 4: the normal path executes the call and returns.
    const normal = walk(mir);
    assert.deepEqual(labelled(program, nodesOn(normal)), ["risky(n)"]);
    assert.equal(normal.end, "return");
    // `s3(-2)` is -102: the call unwinds, `e instanceof Failure` is true, `e.code` is read through the narrowed `e`.
    // R1: "every narrowed use carries its check" (WT-10), with the selected failure kind; it stands in the catch block,
    // outside the protected region.
    const caught = walk(mir, { decide: point => point.node === program.at("risky(n)") ? "unwind" : point.kind === "switch" ? true : "normal" });
    assert.equal(caught.end, "return");
    const narrowedUse = checks(mir, program.at("e#narrowed"));
    assert.equal(narrowedUse.length, 1);
    assert.equal(narrowedUse[0].failure, variant === "abort" ? "abort" : "escape");
    assert.deepEqual(labelled(program, nodesOn(caught)), ["risky(n)", "e#narrowed"]);
    // A caught value that is not a Failure is thrown again and leaves the body.
    const rethrown = walk(mir, { decide: point => point.node === program.at("risky(n)") ? "unwind" : point.kind === "switch" ? false : "normal" });
    assert.equal(rethrown.end, "unwind");
    assert.deepEqual(labelled(program, nodesOn(rethrown)), ["risky(n)", "throw e"]);
    assert.equal(at(mir, program.at("throw e"), "throw")[0].failure, "escape");
  });
}

test("S-3 risky: the thrown value is constructed, then thrown out of the body", () => {
  const program = s3("unwind").risky;
  const mir = lower(program);
  // Program text: `if (n < 0) throw new Failure(n); return n;`. R5: authored order.
  const thrown = walk(mir, { decide: point => point.kind === "switch" ? true : "normal" });
  assert.deepEqual(labelled(program, nodesOn(thrown)), ["new Failure(n)", "throw"]);
  assert.equal(thrown.end, "unwind");
  const returned = walk(mir, { decide: point => point.kind === "switch" ? false : "normal" });
  assert.deepEqual(nodesOn(returned), []);
  assert.equal(returned.end, "return");
});

// ---- S-6 ------------------------------------------------------------------------------------

test("S-6 using: disposal runs once on every exit, after the result is read and before the handler", () => {
  const { program, disposeDeclaration } = s6();
  const mir = lower(program);
  const isDispose = item => isCall(item) && !isInternalCall(item) && calleeNameOf(item) === disposeDeclaration;
  const readsLength = item => readsField(mir, item, "length");
  // R5 and graph law 9: the dispose step is emitted once; R6: every exit of the scope passes through it once.
  assert.equal(controlPoints(mir).filter(isDispose).length, 1);
  // R4: the disposal names its step of the declaration's dispose protocol.
  assert.equal(namesStep(controlPoints(mir).filter(isDispose)[0], 0), true);
  // S-6 oracle: `s6([], false)` is 0 "with the log holding one entry afterwards (the result is read before disposal)".
  const returned = walk(mir, { decide: point => point.kind === "switch" ? false : "normal" });
  assert.equal(returned.end, "return");
  assert.equal(returned.events.filter(isDispose).length, 1);
  assert.ok(indexOfEvent(returned, readsLength) !== -1 && indexOfEvent(returned, readsLength) < indexOfEvent(returned, isDispose));
  assert.equal(labelled(program, nodesOn(returned))[0], "new Res(log)");
  // S-6 oracle: `s6([], true)` is 1 "(disposal runs on the unwinding exit before the handler)".
  const thrown = walk(mir, { decide: point => point.kind === "switch" ? true : "normal" });
  assert.equal(thrown.end, "return");
  assert.equal(thrown.events.filter(isDispose).length, 1);
  assert.ok(indexOfEvent(thrown, isDispose) < indexOfEvent(thrown, readsLength));
  assert.deepEqual(labelled(program, nodesOn(thrown)).slice(0, 3), ["new Res(log)", "new Failure(0)", "throw"]);
  // A failure of the construction itself happens before the resource exists: no disposal on that path.
  const unbuilt = walk(mir, { decide: point => point.node === program.at("new Res(log)") ? "unwind" : "normal" });
  assert.equal(unbuilt.events.filter(isDispose).length, 0);
  // The construction stands inside `try`: its failure goes to the handler, and that path returns from the catch block.
  assert.equal(at(mir, program.at("new Res(log)"), "call")[0].failure, "handler");
  assert.equal(unbuilt.end, "return");
  // R10: the slot of `r` outlives the cleanup that reads it: no end marker of `r` precedes the disposal.
  const ended = indexOfEvent(returned, item => item.statement !== null && item.kind === "storage-dead" && item.record.local === sourceLocal(mir, 2));
  assert.ok(ended === -1 || indexOfEvent(returned, isDispose) < ended);
});

// ---- WT-9 -----------------------------------------------------------------------------------

test("WT-9 all: handle creation and suspension are separate control points; finally runs once on resume and on unwind", () => {
  const program = wt9().all;
  const mir = lower(program);
  // R3: "creation of a handle, … suspension, resumption, each finite exit … " are each explicit. WT-9: "handle creation
  // distinct from completion". Program text: `out += await load(id)` inside `try … finally { out += "."; }`.
  const call = at(mir, program.at("load(id)"), "call");
  const suspension = at(mir, program.at("await"), "await");
  assert.equal(call.length, 1);
  assert.equal(suspension.length, 1);
  assert.deepEqual(edgesOf(suspension[0].record).map(edge => edge.edge), ["resume", "unwind"]);
  // R4: the suspension names the await step of its node's protocol.
  assert.equal(namesStep(suspension[0], 0), true);
  // Graph law 9: the cleanup's code is emitted in one block, not once per exit.
  assert.equal(blocksWithStatementAt(mir, program.at("out+=.")).length, 1);
  const cleanup = blocksWithStatementAt(mir, program.at("out+=."))[0].id;
  // One element, then the iteration is complete.
  let asked = 0;
  const once = point => point.kind === "switch" && isCompletionBranch(point) ? (asked++ > 0) : "normal";
  const resumed = walk(mir, { decide: once });
  assert.equal(resumed.end, "return");
  assert.ok(indexOfEvent(resumed, item => item.statement === null && item.node === program.at("load(id)")) <
    indexOfEvent(resumed, item => item.statement === null && item.kind === "await"));
  assert.equal(entriesInto(resumed, cleanup), 1);
  // R6: an unwinding exit at the suspension passes through the enclosing cleanup once and leaves the body.
  asked = 0;
  const failed = walk(mir, { decide: point => point.kind === "await" ? "unwind" : once(point) });
  assert.equal(failed.end, "unwind");
  assert.equal(entriesInto(failed, cleanup), 1);
});

test("WT-9 take: a yield has the three exits resume, consumer finish and unwind", () => {
  const program = wt9().take;
  const mir = lower(program);
  // COMMON-DATA §4: suspension; resumption; "finite exit … by the consumer finishing it". R3.
  const suspension = at(mir, program.at("yield i"), "yield");
  assert.equal(suspension.length, 1);
  assert.equal(namesStep(suspension[0], 0), true);
  // No handler encloses the yield: a failure sent in leaves the body.
  assert.equal(suspension[0].failure, "escape");
  const incremented = path => path.events.filter(item => item.statement !== null && item.node === program.at("i++")).length;
  const exit = choice => { let asked = 0; return walk(mir, { decide: point => point.kind === "switch" ? asked++ === 0 : point.kind === "yield" ? choice : "normal" }); };
  // Resumption continues the loop: the increment runs, the condition is asked again, the body returns.
  const resumed = exit("resume");
  assert.equal(resumed.end, "return");
  assert.ok(incremented(resumed) >= 1);
  // The consumer finishing leaves at once: nothing of the loop runs after the yield.
  const finished = exit("return");
  assert.equal(finished.end, "return");
  assert.equal(incremented(finished), 0);
  assert.deepEqual(labelled(program, nodesOn(finished)), ["yield i"]);
  assert.equal(exit("unwind").end, "unwind");
});

test("WT-9 guarded: every exit of a suspension passes through the enclosing cleanup once", () => {
  const program = wt9().guarded;
  const mir = lower(program);
  // Section 7 part 8, WT-9: "consumer-finish through enclosing cleanups". R6.
  assert.equal(at(mir, program.at("done()"), "call").length, 1);
  for (const [choice, end] of [["resume", "return"], ["return", "return"], ["unwind", "unwind"]]) {
    const path = walk(mir, { decide: point => point.kind === "yield" ? choice : "normal" });
    assert.deepEqual(labelled(program, nodesOn(path)), ["yield 1", "done()"]);
    assert.equal(path.end, end);
  }
});

// ---- WT-10 ----------------------------------------------------------------------------------

for (const policy of POLICIES) {
  test(`WT-10 read (${policy.bounds}/${policy.absent}): every narrowed use and every index carries its check`, () => {
    const program = wt10(policy).program;
    const mir = lower(program);
    // Section 7 part 8, WT-10: "every narrowed use carries its check whether or not it will be proved". R1: "no check
    // is absent because it might be proved". The proof is Refinements' fact; lowering reads none.
    const failing = policy.absent === "abort" ? "abort" : "escape";
    for (const label of ["a[i]", "o.x#1", "o.x#2"]) {
      const found = checks(mir, program.at(label));
      assert.equal(found.length, 1, label);
      assert.equal(found[0].failure, failing, label);
    }
    // One loop iteration, both guards true: authored order of the calls and checks.
    let loop = 0;
    const path = walk(mir, { decide: point => point.kind !== "switch" ? "normal" : point.node === program.at("for") || point.node === program.at("i<a.length") ? (loop++ === 0) : true });
    assert.deepEqual(labelled(program, nodesOn(path)), ["a[i]", "pure()", "o.x#1", "clear(o)", "o.x#2"]);
    assert.equal(path.end, "return");
  });
}

// ---- WT-11 ----------------------------------------------------------------------------------

test("WT-11 write: pointer operations are the selected operations at their positions; no check is made up for a raw access", () => {
  const program = wt11({ absent: "unwind" }).program;
  const mir = lower(program);
  // Section 7 part 8, WT-11. R2: only an operation that can fail or write existing storage is a control point; R12:
  // nothing in the graph is selected by lowering.
  const store = at(mir, program.at("storeptr(pointer,7)"));
  assert.deepEqual(store.map(point => [point.kind, point.failure]), [["invoke", "none"]]);
  assert.equal(operationKindOf(store[0]), "pointer-write");
  for (const label of ["unsafecontext()", "addressof", "torawptr", "reinterpretrawptr"]) assert.deepEqual(at(mir, program.at(label)), [], label);
  // The only check in the body is the one the narrowed use of `pointer` requires.
  assert.deepEqual(labelled(program, checks(mir).map(point => point.node)), ["pointer#narrowed"]);
  const stored = walk(mir, { decide: point => point.kind === "switch" ? true : "normal" });
  assert.deepEqual(labelled(program, nodesOn(stored)), ["pointer#narrowed", "storeptr(pointer,7)"]);
  const skipped = walk(mir, { decide: point => point.kind === "switch" ? false : "normal" });
  assert.deepEqual(nodesOn(skipped), []);
});

// ---- WT-8 -----------------------------------------------------------------------------------

test("WT-8 runEither: the two closures are created once each, in authored order, before the call", () => {
  const program = wt8().program;
  const mir = lower(program);
  // Section 7 part 8, WT-8: "each … callback registration an explicit execution at its declared position". R5.
  const path = walk(mir);
  const first = label => indexOfEvent(path, item => item.node === program.at(label));
  assert.ok(first("a-closure") !== -1 && first("a-closure") < first("b-closure"));
  assert.ok(first("b-closure") < indexOfEvent(path, isCall));
  const created = label => path.events.filter(item => item.node === program.at(label) && createsClosure(item)).length;
  assert.equal(created("a-closure"), 1);
  assert.equal(created("b-closure"), 1);
});

// ---- WT-5 -----------------------------------------------------------------------------------

test("WT-5: an erroneous or still-deferred body is a caller defect; an independent body lowers", () => {
  const programs = wt5();
  // Section 7 part 7: "a body with a deferred decision, a deferred conversion or an error resolution … Thrown as
  // defects, never diagnostics". Part 8, WT-5: "graphs of the others are unaffected".
  assert.throws(() => lowerToMir(deps, programs.broken.tir, []), defectOfLowerMir);
  assert.throws(() => lowerToMir(deps, programs.deferred.tir, []), defectOfLowerMir);
  // Part 7, the other caller defects: "an initializer execution with no supplied body data" (WT-4 `f` without the
  // data of its two defaults) and "a node kind the admitted vocabulary excludes".
  assert.throws(() => lowerToMir(deps, wt4().f.tir, []), defectOfLowerMir);
  assert.throws(() => lowerToMir(deps, excluded().program.tir, []), defectOfLowerMir);
  const mir = lower(programs.independent);
  assert.deepEqual(effects(mir), []);
  assert.equal(walk(mir).end, "return");
});

// ---- S-1 ------------------------------------------------------------------------------------

test("S-1: the source of a destructuring is evaluated once", () => {
  const program = s1().program;
  const mir = lower(program);
  // S-1 oracle: "`pair` runs once". 8.4 of the parked chapter is not authority; the clause is R5.
  assert.equal(at(mir, program.at("pair()"), "call").length, 1);
  assert.equal(labelled(program, nodesOn(walk(mir)))[0], "pair()");
  // Whether a position of the pattern needs a check is the selected access of that binding element, which the typed
  // body does not carry yet (NEEDS-W4 G2); nothing is asserted about checks here.
});

// ---- clauses that had no case (R1 section 5) and the activation ruling ---------------------------

test("an operation that can fail is a control point with the selected failure kind; a pure one is a statement", () => {
  // R1, R2, R12; COMMON-DATA §3 Operation. `try { return a / b; } catch { return 0; }` with `/` selected three ways.
  const { unwinding, aborting, pure } = quotients();
  const failing = { decide: point => point.kind === "invoke" ? "unwind" : "normal" };
  let mir = lower(unwinding);
  assert.deepEqual(at(mir, unwinding.at("a/b")).map(point => [point.kind, point.failure]), [["invoke", "handler"]]);
  assert.equal(walk(mir, failing).end, "return");
  mir = lower(aborting);
  assert.deepEqual(at(mir, aborting.at("a/b")).map(point => [point.kind, point.failure]), [["invoke", "abort"]]);
  assert.equal(walk(mir, failing).end, "abort");
  mir = lower(pure);
  assert.deepEqual(at(mir, pure.at("a/b")), []);
  assert.equal(statementsOn(walk(mir)).filter(item => valueKindOf(item) === "binary" && item.node === pure.at("a/b")).length, 1);
});

test("a required parameter before a default: entries for the counts 2 and 1, none for 0", () => {
  const { program, internal, B_DEFAULT, child } = scaled();
  lower(child);
  const mir = lower(program, internal);
  // R7: one entry per admissible count of supplied fixed arguments. `scaled(a, b = 2)` cannot be called with none.
  assert.deepEqual(providedCountsOf(mir), [2, 1]);
  const defaults = provided => internalCallsOn(walk(mir, { entry: providedCountsOf(mir).indexOf(provided) })).map(calleeNameOf);
  assert.deepEqual(defaults(2), []);
  assert.deepEqual(defaults(1), [B_DEFAULT]);
});

test("a return out of an iteration passes through its finish step once", () => {
  const { program } = firstZero();
  const mir = lower(program);
  // R6: every transfer out of a scope passes through each enclosing cleanup once. One element, equal to 0.
  const path = walk(mir, { decide: point => point.kind !== "switch" ? "normal" : isCompletionBranch(point) ? false : true });
  assert.equal(path.end, "return");
  const steps = path.events.filter(item => item.statement === null && item.node === program.at("for") && item.step !== null && item.kind === "invoke");
  assert.equal(steps.filter(item => namesStep(item, ARRAY_STEP.next)).length, 1);
  assert.equal(steps.filter(item => namesStep(item, ARRAY_STEP.finish)).length, 1);
  assert.equal(namesStep(steps.at(-1), ARRAY_STEP.finish), true);
});

test("deep nesting lowers without native recursion in proportion to it", () => {
  // Section 7 part 7. 20000 nested parentheses around a literal.
  const mir = lower(deep(20000).program);
  assert.equal(walk(mir).end, "return");
  assert.deepEqual(effects(mir), []);
});

test("activation: the caller records creation, mode and drive; nothing in its graph stands for the callee's activation", () => {
  const { program } = handles();
  const mir = lower(program);
  // K-3239 item 4: one canonical event, the first entry of the callee's execution, per actual handle activation. The
  // caller records the selected mode and the connection, and never a second activation event.
  const creation = label => at(mir, program.at(label), "call");
  const loop = program.at("for v");
  // Two outer iterations, each driving its handle to one value and then to completion.
  const outer = [true, true, false];
  const inner = [false, true, false, true];
  const path = walk(mir, { decide: point => point.kind !== "switch" ? "normal" : isCompletionBranch(point) ? inner.shift() : outer.shift() });
  assert.equal(path.end, "return");
  // Distinct handles from the same creation site: one record, executed once per handle.
  assert.equal(creation("gen()#loop").length, 1);
  assert.equal(path.events.filter(item => item.statement === null && item.kind === "call" && item.node === program.at("gen()#loop")).length, 2);
  assert.equal(activationOf(creation("gen()#loop")[0]), ACTIVATION.whenFirstDriven);
  // First drive, repeated drive: one `next` record, a call of the handle's member, run once per drive (two per handle).
  const drives = path.events.filter(item => item.statement === null && item.node === loop && namesStep(item, GENERATOR_STEP.next));
  assert.equal(drives.length, 4);
  assert.equal(new Set(drives.map(item => item.block)).size, 1);
  assert.equal(drives[0].kind, "call");
  // An entry that throws under the deferred mode surfaces at the drive, which is not inside the `try`.
  assert.equal(drives[0].failure, "escape");
  // A handle never driven: its creation is one record and nothing reads the handle.
  assert.equal(creation("gen()#idle").length, 1);
  assert.deepEqual(recordsOf(mir).filter(item => readsLocal(mir, item, sourceLocal(mir, 4))), []);
  // Immediate mode: one creating call that carries the mode; an entry that throws unwinds it into the handler.
  assert.equal(creation("fetched(1)").length, 1);
  assert.equal(activationOf(creation("fetched(1)")[0]), ACTIVATION.atCreation);
  assert.equal(creation("fetched(1)")[0].failure, "handler");
  // Nothing in this graph stands for an activation: no call of a body, no suspension, and no step outside the loop's node.
  assert.deepEqual(recordsOf(mir).filter(isInternalCall), []);
  assert.deepEqual(effects(mir).filter(point => point.kind === "await" || point.kind === "yield" || point.kind === "delegate"), []);
  assert.equal(recordsOf(mir).filter(item => item.step !== null).every(item => item.node === loop), true);
});

// ---- the limit ------------------------------------------------------------------------------

test("the MIR size limit refuses with one diagnostic and returns no graph", () => {
  const program = wt6(POLICIES[0]).order;
  // Section 7 part 7: "the size of one MIR graph (its count of control points and records), charged before
  // allocation"; "Diagnostic originated: one"; "Refusal: that limit only". The unit of the count is the contract's
  // (`LowerMirLimits.maximumRecords`); the case does not restate it: it finds the smallest admitted limit and requires
  // a refusal just below it.
  const attempt = maximumRecords => lowerToMir({ ...deps, limits: { maximumRecords } }, program.tir, []);
  assert.equal(attempt(0).kind, "refused");
  let low = 0;
  let high = deps.limits.maximumRecords;
  assert.equal(attempt(high).kind, "ok");
  while (high - low > 1) {
    const middle = low + Math.floor((high - low) / 2);
    if (attempt(middle).kind === "ok") high = middle; else low = middle;
  }
  // Below the boundary every limit refuses; at and above it every limit admits.
  const refused = attempt(low);
  assert.equal(refused.kind, "refused");
  assert.equal(refused.diagnostics.length, 1);
  assert.equal("value" in refused, false);
  assert.deepEqual(attempt(high).value, lower(program));
  assert.equal(attempt(high + 1).kind, "ok");
});

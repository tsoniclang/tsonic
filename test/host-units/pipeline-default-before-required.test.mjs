import assert from "node:assert/strict";
import { test } from "node:test";
import { OpenedProgram } from "../../packages/host/dist/front/handles.js";
import { loadFrontFixture } from "./fixtures/front/checked-module.mjs";
import { analyzeOptionalSource } from "./fixtures/optional-default.mjs";

const nullable = "boolean | undefined";
const source = (type, arguments_) => "export function select(flag: " + type + " = true, later: boolean): " + type + " { return flag; }\n"
  + "export function call(): " + type + " { return select(" + arguments_ + "); }";

function checkedCall(fixture, text) {
  const snapshot = fixture.projectSnapshot({ sourceFiles: { "main.ts": text },
    libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] });
  const { program } = fixture.openAndCapture(snapshot);
  const checked = OpenedProgram.checked(program);
  const { file } = OpenedProgram.file(program, snapshot.entryPoint);
  const { ast, checker } = checked.getSourceFileQueries(file);
  const returned = ast.statements(ast.body(ast.statements(file).at(-1)))[0];
  const call = ast.children(returned).find(node => ast.kindName(node) === "KindCallExpression");
  assert.ok(call);
  return { snapshot, module: snapshot.entryPoint, evidence: checker.getResolvedCallInfo(call),
    diagnostics: checked.diagnostics.filter(diagnostic => diagnostic.file === file), provided: ast.arguments(call).length };
}

test("a later required formal blocks omission, and supplied absence needs the real native domain", async () => {
  const fixture = await loadFrontFixture();
  for (const [type, arguments_, hasAbsence] of [[nullable, "undefined, false", true], ["boolean", "false, false", false]]) {
    const program = await analyzeOptionalSource(source(type, arguments_));
    assert.equal(program.kind, "ok");
    const { index, modules } = program.value;
    const active = modules.flatMap(module => module.bodies).filter(body => body.kind === "selected" && body.tir.root.kind === "Block");
    const callee = active.find(body => body.tir.params.length === 2);
    const caller = active.find(body => body.tir.params.length === 0);
    assert.ok(callee && caller);
    const [first, later] = index.types.signatures[callee.tir.signature].parameters;
    assert.equal(first.kind, "default");
    assert.equal(first.acceptsOmission, false);
    assert.notEqual(first.initializer, null);
    assert.equal(later.kind, "required");
    assert.equal(later.acceptsOmission, false);
    assert.equal(later.initializer, null);
    const initializer = modules.flatMap(module => module.bodies).find(body => body.instance.body === first.initializer);
    assert.equal(initializer?.tir.root.kind, "TrueKeyword");
    assert.deepEqual(callee.mir.entries.map(entry => entry.provided), [2]);
    assert.deepEqual(callee.facts.map(facts => facts.execution.provided), [2]);
    assert.ok(index.dependencyInventory);
    assert.equal(index.dependencyInventory.dependencies.some(edge => edge.reason === "initializer"), false);
    const facts = caller.facts[0];
    const [invocation] = facts.origins.invocations;
    const [alternative] = invocation.alternatives;
    assert.deepEqual(alternative.summary, { kind: "body", execution: { instance: callee.instance, provided: 2 } });
    assert.deepEqual(alternative.arguments.map(row => [row.kind, row.parameter, row.authoredIndex]),
      [["provided", first.declaration, 0], ["provided", later.declaration, 1]]);
    assert.deepEqual(facts.arena.contexts[alternative.context].arguments,
      alternative.arguments.map(row => ({ kind: "provided", origins: row.actual })));
    assert.deepEqual(alternative.arguments.map(row => facts.arena.origins[row.actual].includesAbsence), [hasAbsence, false]);
    assert.equal(facts.arena.origins[alternative.result].includesAbsence, hasAbsence);
  }

  const missingSource = source(nullable, "undefined");
  const missing = checkedCall(fixture, missingSource);
  assert.equal(missing.provided, 1);
  assert.equal(missing.evidence.kind, "conditional-candidates");
  assert.deepEqual(missing.evidence.candidates, []);
  assert.equal(missing.evidence.declarationOrder.kind, "available");
  assert.equal(missing.evidence.declarationOrder.signatures.length, 1);
  assert.deepEqual(missing.diagnostics.map(diagnostic => diagnostic.code), [2554]);
  const original = fixture.sdk.getDiagnosticRunMembers(missing.diagnostics[0]);
  assert.equal(missing.evidence.diagnostics.some(diagnostic => original.includes(diagnostic)), true);
  const { captured, deps, interner } = fixture.captureModulesOf(missing.snapshot);
  const raw = captured.find(row => row.module === missing.module).raw;
  const [rejected] = raw.calls;
  const originalRoot = { module: raw.module, index: 0 };
  assert.equal(rejected.kind, "conditional-candidates");
  assert.deepEqual(rejected.diagnostics, [originalRoot]);
  assert.equal(rejected.declarationOrder.kind, "available");
  assert.equal(rejected.declarationOrder.value.length, 1);
  assert.equal(raw.types.signatures[rejected.declarationOrder.value[0]].parameters.length, 2);
  assert.deepEqual(raw.types.candidates[rejected.candidates].candidates, []);
  const checked = fixture.front.lowerModule(deps, raw);
  assert.equal(checked.kind, "ok");
  const decoded = fixture.hir.parseHir(fixture.hir.printHir(checked.value));
  assert.equal(decoded.kind, "parsed");
  assert.deepEqual(fixture.verifyChecked(decoded.value, interner), []);
  const caller = decoded.value.tree.statements.nodes.find(node => node.kind === "FunctionDeclaration" && node.name.text === "call");
  const call = caller.body.statements.nodes[0].expression;
  assert.equal(call.id, rejected.invocation.node);
  assert.equal(call.arguments.nodes.length, 1);
  const application = call.tsonic.application;
  assert.equal(application.kind, "available");
  assert.deepEqual(application.value.arguments, [{ kind: "value", expression: call.arguments.nodes[0].id }]);
  assert.equal(application.value.candidates.kind, "available");
  const callerBody = decoded.value.bodies.find(body => body.body === caller.tsonic.body);
  assert.deepEqual(callerBody.candidateLists[application.value.candidates.value].candidates, []);
  assert.deepEqual(application.value.resolvedSignature, { kind: "unavailable", reason: "checker-error",
    causes: [{ kind: "diagnostic", diagnostic: { kind: "checker", diagnostic: originalRoot } }] });
  const refused = await analyzeOptionalSource(missingSource);
  assert.equal(refused.kind, "refused");
  assert.deepEqual(refused.diagnostics, raw.checkerDiagnostics);
  assert.deepEqual(refused.diagnostics.map(diagnostic => diagnostic.code), [{ kind: "checker", number: 2554, rendered: "TS2554" }]);

  const invalid = source("boolean", "undefined, false");
  const native = checkedCall(fixture, invalid);
  assert.equal(native.provided, 2);
  assert.equal(native.evidence.kind, "applicable");
  assert.deepEqual(native.diagnostics, []);
  const program = await analyzeOptionalSource(invalid);
  assert.equal(program.kind, "refused");
  assert.equal(program.diagnostics.length, 1);
  const [diagnostic] = program.diagnostics;
  assert.equal(diagnostic.code.rendered, "TSONIC_NO_APPLICABLE_NATIVE_CANDIDATE");
  assert.equal(diagnostic.source, "rules");
  assert.deepEqual(diagnostic.site, { kind: "source", origin: { module: native.module,
    start: invalid.indexOf("select(undefined, false)"), length: "select(undefined, false)".length, derived: [] } });
});

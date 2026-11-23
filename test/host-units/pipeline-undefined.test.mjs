import assert from "node:assert/strict";
import { tirFixtureBodyVerifier } from "./fixtures/typed-occurrence-witnesses.mjs";
import { test } from "node:test";
import { loadFrontFixture, navigationCapture, preparation } from "./fixtures/front/checked-module.mjs";
import { createAccount } from "../../packages/host/dist/dataflow/index.js";
import { resourceLimitDiagnostic } from "../../packages/host/dist/diag/index.js";
import { OpenedProgram } from "../../packages/host/dist/front/handles.js";
import { decodeBodyId } from "../../packages/host/dist/ids/index.js";
import { indexSyntaxTree, parseHir, printHir, verifyHir } from "../../packages/host/dist/ir-hir/index.js";
import { parseModuleBodies, printModuleBodies } from "../../packages/host/dist/ir-program/index.js";
import { parseTir, printTir, verifyTir as verifyTirOperation } from "../../packages/host/dist/ir-tir/index.js";
import { instanceKey, viewTypes } from "../../packages/host/dist/ir-types/index.js";
import { analyzeHostProgram } from "../../packages/host/dist/pipeline/index.js";
import { analyzeTypedSource } from "../../packages/host/dist/pipeline/analysis-barrier.js";
import { checkedSourceViews } from "../../packages/host/dist/pipeline/checked-inputs.js";
import { publishHostProgram } from "../../packages/host/dist/pipeline/publication.js";
import { captureSourceBarrier } from "../../packages/host/dist/pipeline/source-barrier.js";
import { typeSourceBarrier } from "../../packages/host/dist/pipeline/typed-barrier.js";

const verifyTir = await tirFixtureBodyVerifier(verifyTirOperation);

const limits = {
  navigationCapture, query: { maximumRecords: 100000 },
  inference: { maximumVariablesPerGroup: 128, maximumAtomicContributionsPerGroup: 256 },
  evaluation: { maximumSteps: 10000, maximumIntermediateBits: 4096, maximumResultBits: 4096, maximumArithmeticWork: 10000 },
  dataflow: { maximumWork: 100000, maximumResultEntries: 100000 },
  analyses: { maximumProjectionDepth: 64, maximumOriginAlternatives: 64, maximumConditionAlternatives: 64,
    maximumRelationalRecordsPerBody: 10000, maximumRelationalReferencesPerBody: 10000 },
  summaries: { maximumIterationsPerComponent: 100, maximumComponentSize: 128 },
  metadata: { maximumWork: 10000, maximumGeometryBits: 4096 },
  instantiation: { maximumWork: 100000, maximumCreatedRecords: 100000, maximumBindingVectorsPerArtifact: 128,
    typeExpansion: { maximumDepth: 64, maximumVisits: 10000, maximumUnionMembers: 128, maximumIntersectionMembers: 128 } },
  lowering: { maximumRecords: 10000 }, mirVerification: { maximumWork: 100000 },
};

const intrinsic = { kind: "intrinsic-value", intrinsic: "undefined" };

function checkLinkedOpposites(inputs, source, hir, supplied, shadow, authored, shadowed) {
  const forgedHir = structuredClone(hir);
  const nodes = indexSyntaxTree(forgedHir.tree);
  const target = nodes[authored.id];
  const value = target.tsonic;
  target.tsonic = { core: value.core, role: "assignment-target", resolution: value.resolution,
    views: value.value.views, place: value.value.place, access: "write" };
  const checked = source.modules.map(row => row.module === hir ? { module: forgedHir, nodes } : row);
  const views = checkedSourceViews(checked);
  const bindingScopeOf = definition => source.descriptions.get(definition)?.generics ?? null;
  const hirViolations = verifyHir(forgedHir, { types: viewTypes(source.types),
    moduleOf: identity => checked.find(row => row.module.module === identity)?.module ?? null,
    bodyPathOf: body => { const path = decodeBodyId(body); return path.kind === "decoded" ? path.value : null; },
    definitionPathOf: definition => source.definitionPaths.get(definition) ?? null,
    bindingScopeOf, bindingScopeAt: reference => {
      const owner = reference.kind === "item" ? reference.value.owner : views.bodies.get(reference.value.body)?.owner;
      return owner === undefined ? null : bindingScopeOf(owner);
    }, nominalOf: source.nominalOf, nodeOf: views.nodeOf, localExists: views.localExists });
  assert.deepEqual(hirViolations.filter(row => row.rule === "intrinsic-value-use").map(row => row.site),
    [{ kind: "node", node: { kind: "body", value: { body: supplied.body, node: authored.id } } }]);

  const account = createAccount(inputs.limits.dataflow);
  const typed = typeSourceBarrier(inputs, source, account);
  assert.equal(typed.kind, "ok");
  const input = typed.value.verifierOf(hir.module);
  assert.ok(input);
  const genuineShadow = typed.value.bodies.get(instanceKey(shadow));
  const genuineSupplied = typed.value.bodies.get(instanceKey(supplied));
  assert.ok(genuineShadow);
  assert.ok(genuineSupplied);
  function crossed(body, node, resolution) {
    const forged = structuredClone(body);
    const reference = forged.root.statements.nodes[0].expression.arguments.nodes[0];
    assert.equal(reference.id, node.id);
    reference.tsonic.resolution = resolution;
    const decoded = parseTir(printTir(forged));
    assert.equal(decoded.kind, "parsed");
    const violations = verifyTir(input, decoded.value);
    assert.deepEqual(violations.filter(row => row.rule === "intrinsic-value-use").map(row => row.site),
      [{ kind: "node", module: hir.module, node: node.id }]);
    return forged;
  }
  const forgedShadow = crossed(genuineShadow, shadowed, intrinsic);
  crossed(genuineSupplied, authored, shadowed.tsonic.resolution);
  const analysis = analyzeTypedSource(inputs, typed.value, account);
  assert.equal(analysis.kind, "ok");
  const modules = new Map(typed.value.modules);
  modules.set(hir.module, { ...input.module, bodies: input.module.bodies.map(body => body === genuineShadow ? forgedShadow : body) });
  const message = "The actual typed body has no final identity-domain image.";
  assert.throws(() => publishHostProgram(inputs, { ...typed.value, modules }, analysis.value, account), {
    message, cause: { owner: "pipeline", query: null, origin: null, message },
  });
}

function checkCall(index, caller, callee, provided) {
  const call = caller.tir.root.statements.nodes[0].expression;
  assert.equal(call.kind, "CallExpression");
  assert.equal(call.arguments.nodes.length, provided);
  assert.equal(call.tsonic.application.kind, "decided");
  const application = call.tsonic.application.decision;
  assert.deepEqual(application.callee.activation, callee.instance);
  const mir = caller.mir.blocks.find(block => block.terminator.kind === "call" && block.terminator.tir.node === call.id)?.terminator;
  assert.equal(mir?.callee.kind, "direct");
  assert.equal(mir.arguments.length, 1);
  const facts = caller.facts.find(row => row.execution.provided === caller.tir.params.length);
  assert.ok(facts);
  const invocation = facts.origins.invocations.find(row => row.node === call.id);
  assert.equal(invocation?.alternatives.length, 1);
  const alternative = invocation.alternatives[0];
  const target = { kind: "body", execution: { instance: callee.instance, provided } };
  assert.deepEqual(alternative.summary, target);
  assert.equal(alternative.arguments.length, 1);
  const transport = alternative.arguments[0];
  assert.equal(transport.parameter, callee.tir.params[0].tsonic.declaration);
  const slots = facts.arena.contexts[alternative.context].arguments;
  const edges = index.dependencyInventory.dependencies.filter(edge => edge.dependent.instance.body === caller.instance.body);
  assert.deepEqual(edges.filter(edge => edge.reason === "call").map(edge => edge.target), [target]);
  const initializer = callee.tir.params[0].tsonic.initializer;
  assert.notEqual(initializer, null);
  assert.equal(edges.some(edge => edge.reason === "initializer" && edge.target.kind === "body"
    && edge.target.execution.instance.body === initializer), provided === 0);
  if (provided === 0) {
    assert.deepEqual(mir.arguments, [{ kind: "omitted" }]);
    assert.deepEqual(slots, [{ kind: "omitted" }]);
    assert.equal(transport.kind, "omitted");
    assert.equal(Object.hasOwn(transport, "actual"), false);
    assert.deepEqual(application.callee.decision.parameters, [{ kind: "default", parameter: 0, initializer }]);
  } else {
    assert.equal(mir.arguments[0].kind, "value");
    assert.equal(transport.kind, "provided");
    assert.equal(transport.authoredIndex, 0);
    assert.deepEqual(slots, [{ kind: "provided", origins: transport.actual }]);
    assert.deepEqual(application.arguments, [{ kind: "provided", parameter: 0, expression: call.arguments.nodes[0].id }]);
  }
  return { argument: call.arguments.nodes[0], operand: mir.arguments[0].operand, facts, transport };
}

test("actual global undefined remains an Identifier and supplies native absence, unlike an omitted argument", async () => {
  const fixture = await loadFrontFixture();
  const snapshot = fixture.projectSnapshot({ sourceFiles: { "main.ts": `
export function choose(flag: undefined = undefined): undefined { return flag; }
export function supplied(): undefined { return choose(undefined); }
export function omitted(): undefined { return choose(); }
export function shadow(undefined: undefined): undefined { return choose(undefined); }` },
    libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] });
  const inputs = { snapshot, extensions: fixture.front.createCheckerExtensions([]), preparation, limits };
  const checked = captureSourceBarrier(inputs);
  assert.equal(checked.kind, "ok");
  const hir = checked.value.modules.find(row => row.module.module === snapshot.entryPoint)?.module;
  assert.ok(hir);
  const bodyOf = name => hir.tree.statements.nodes.find(node => node.kind === "FunctionDeclaration" && node.name.text === name).body;
  const readOf = name => bodyOf(name).statements.nodes[0].expression.arguments.nodes[0];
  const authored = readOf("supplied");
  const shadowed = readOf("shadow");
  assert.equal(authored.kind, "Identifier");
  assert.deepEqual(authored.tsonic.resolution, intrinsic);
  assert.equal(shadowed.kind, "Identifier");
  assert.equal(shadowed.tsonic.resolution.kind, "local");
  assert.deepEqual(shadowed.tsonic.value.views.read, authored.tsonic.value.views.read);
  const checkedText = printHir(hir);
  const decodedHir = parseHir(checkedText);
  assert.equal(decodedHir.kind, "parsed");
  assert.equal(printHir(decodedHir.value), checkedText);

  const program = analyzeHostProgram(inputs);
  assert.equal(program.kind, "ok", program.kind === "ok" ? undefined : JSON.stringify(program.diagnostics));
  const { index, modules } = program.value;
  const module = modules.find(row => row.module === snapshot.entryPoint);
  assert.ok(module);
  assert.ok(index.dependencyInventory);
  const published = root => module.bodies.find(body => body.kind === "selected" && body.tir.root.id === root.id);
  const callee = published(bodyOf("choose"));
  assert.ok(callee);
  const initializer = callee.tir.params[0].tsonic.initializer;
  const defaultBody = module.bodies.find(row => row.kind === "selected" && row.instance.body === initializer);
  assert.equal(defaultBody?.tir.root.kind, "Identifier");
  assert.deepEqual(defaultBody.tir.root.tsonic.resolution, intrinsic);
  for (const provided of [0, 1]) {
    const entry = callee.mir.entries.find(row => row.provided === provided);
    assert.ok(entry);
    const terminator = callee.mir.blocks[entry.block].terminator;
    assert.equal(terminator.kind === "call" && terminator.callee.kind === "body" && terminator.callee.instance.body === initializer,
      provided === 0);
  }
  const supplied = published(bodyOf("supplied"));
  assert.ok(supplied);
  const actual = checkCall(index, supplied, callee, 1);
  assert.equal(actual.argument.kind, "Identifier");
  assert.equal(actual.argument.text, "undefined");
  assert.deepEqual(actual.argument.tsonic.resolution, intrinsic);
  assert.equal(actual.operand.kind, "constant");
  const constant = supplied.mir.constants[actual.operand.constant];
  assert.deepEqual(constant, { id: actual.operand.constant, type: actual.argument.tsonic.type,
    value: { kind: "literal", value: { kind: "absence" } } });
  assert.deepEqual(index.types.terms[constant.type], { kind: "intrinsic", intrinsic: "absence" });
  assert.equal(actual.facts.arena.origins[actual.transport.actual].includesAbsence, true);

  const missing = published(bodyOf("omitted"));
  assert.ok(missing);
  checkCall(index, missing, callee, 0);
  const shadow = published(bodyOf("shadow"));
  assert.ok(shadow);
  const local = checkCall(index, shadow, callee, 1);
  assert.equal(local.argument.tsonic.type, constant.type);
  assert.deepEqual(local.argument.tsonic.resolution, { kind: "local", local: shadow.tir.params[0].tsonic.local });
  assert.equal(local.operand.kind, "place");
  const printed = printModuleBodies(index, module);
  const decoded = parseModuleBodies(index, printed);
  assert.equal(decoded.kind, "parsed");
  assert.equal(printModuleBodies(index, decoded.value), printed);
  checkLinkedOpposites(inputs, checked.value, hir, supplied.instance, shadow.instance, authored, shadowed);
});

test("capture only reads a paid incomplete reference and requires its exact SDK symbol", async () => {
  const fixture = await loadFrontFixture();
  const snapshot = fixture.projectSnapshot({ sourceFiles: { "main.ts": `
export function supplied(): undefined { return undefined; }
export function shadow(undefined: undefined): undefined { return undefined; }` },
    libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] });
  const opened = fixture.openAndCapture(snapshot);
  const module = snapshot.entryPoint;
  const checked = OpenedProgram.checked(opened.program);
  const entry = OpenedProgram.file(opened.program, module);
  const programWith = read => OpenedProgram.create({ ...checked, getSourceFileQueries(file) {
    const queries = checked.getSourceFileQueries(file);
    return file !== entry.file ? queries : { ...queries, checker: { ...queries.checker,
      getResolvedIntrinsicValueInfo: node => read(node, queries) } };
  } }, OpenedProgram.table(opened.program), OpenedProgram.modules(opened.program).modules.map(origin =>
    OpenedProgram.file(opened.program, origin.kind === "snapshot" ? origin.module : origin.document.module)),
  OpenedProgram.libraryData(opened.program), OpenedProgram.contributions(opened.program));
  const capture = (program, navigationCapture = opened.deps.navigationCapture) =>
    fixture.front.captureModule({ ...opened.deps, navigationCapture }, program, module);
  const stop = new Error("the actual intrinsic reference reader stopped");
  let reads = 0;
  const guarded = programWith(() => { reads += 1; throw stop; });
  for (const [limit, firstRead] of [["maximumCapturedEdgesPerModule", 1], ["maximumCapturedFactsPerModule", 12]]) {
    for (let maximum = 0; maximum < firstRead; maximum += 1) {
      reads = 0;
      assert.deepEqual(capture(guarded, { ...opened.deps.navigationCapture, [limit]: maximum }),
        { kind: "refused", diagnostics: [resourceLimitDiagnostic({ owner: "front", limit: `front.${limit}`, maximum,
          site: { kind: "file", path: "/project/src/main.ts" },
          unit: { request: { query: "captureModule", key: module }, position: { kind: "result" } } })] });
      assert.equal(reads, 0);
    }
    reads = 0;
    assert.throws(() => capture(guarded, { ...opened.deps.navigationCapture, [limit]: firstRead }), error => error === stop);
    assert.equal(reads, 1);
  }
  reads = 0;
  const absent = capture(programWith((node, { checker }) => {
    reads += 1;
    assert.equal(checker.getResolvedIntrinsicValueInfo(node)?.symbol === checker.getSymbolAtLocation(node), true);
    return undefined;
  }));
  assert.equal(absent.kind, "ok");
  assert.equal(reads, 1, "the genuine same-type local never asks for an intrinsic answer");
  assert.deepEqual(absent.value.references.map(row => row.target.kind === "available" ? row.target.value.kind : row.target.reason),
    ["incomplete-association", "declarations"]);
  const crossed = programWith((node, { ast, checker }) => {
    const actual = checker.getResolvedIntrinsicValueInfo(node);
    assert.equal(actual?.kind, "undefined");
    const shadow = ast.statements(entry.file).find(declaration => ast.text(ast.name(declaration)) === "shadow");
    const symbol = checker.getSymbolAtLocation(ast.name(ast.parameters(shadow)[0]));
    assert.equal(symbol !== undefined && symbol !== actual.symbol, true);
    return { kind: actual.kind, symbol };
  });
  assert.throws(() => capture(crossed), /same actual checked symbol/u);
});

import assert from "node:assert/strict";
import { capturedCauses } from "./fixtures/captured-causes.mjs";
import { createHash } from "node:crypto";
import { closeSync, mkdirSync, mkdtempSync, openSync, readFileSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import { Session } from "node:inspector";
import { basename, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { inspect, isDeepStrictEqual } from "node:util";
import { after, before, test } from "node:test";
import { runCase } from "../host-cases/case.mjs";
import { compareCaseValues } from "../host-cases/compare.mjs";
import { syntaxConstructorInputs } from "./fixtures/hir-syntax.mjs";
import { syntaxFieldMutations } from "./fixtures/syntax-field-mutations.mjs";
import { loadFrontFixture } from "./fixtures/front/checked-module.mjs";
import { analysisInput } from "./fixtures/front/analysis-input.mjs";
import { readyModuleRoot, readyModuleStatements } from "./fixtures/chapter-syntax.mjs";
import { typeParameterDeclaration } from "./fixtures/type-parameter-declarations.mjs";
import { checkCallShapedComputedDeclarationName } from "./fixtures/computed-declaration-name.mjs";
import {
  available, bodyId, bodyScopeReader, checkerViews, checkedValue, completeScopes, emptyBindings, emptyCore, emptyModuleBody,
  emptyScope, emptyVerificationInput, header, memberScenario, moduleId, nodeList, origin, ownerId, selectedOperation, typedValue,
} from "./fixtures/tir-member-scenario.mjs";
import { hostCatalogue } from "../architecture/host/catalogue.mjs";
import { checkCoverage } from "../architecture/host/coverage.mjs";
import { parseSources, readImportGraph } from "../architecture/host/import-graph.mjs";
import { compileIsolated, isolationDeps } from "../architecture/host/isolation.mjs";

const repository = fileURLToPath(new URL("../../", import.meta.url));
const tooling = process.env.TSONIC_HOST_TOOLING_ROOT ?? repository;
const productNames = ["index", "print", "parse", "text-layouts", "text-construction", "text-syntax-construction", "text-model", "text-body", "text-phase-values",
  "text-phase-declarations", "text-type-values", "text-rule-decisions", "text-rule-inputs", "text-causes", "text-captures", "text-memory",
  "text-syntax-values", "text-syntax-statements", "text-syntax-types", "text-syntax-jsx", "text-syntax-docs",
  "verify", "verify-occurrences", "verify-applications", "verify-instances", "verify-interface", "chapter-syntax", "selection-key", "syntax-compare", "syntax-compare-common",
  "syntax-compare-values", "syntax-compare-statements", "syntax-compare-types", "syntax-compare-jsx", "syntax-compare-docs"];
const sourceFiles = ["contract", ...productNames].map(name => `packages/host/src/ir-tir/${name}.ts`);
const runtimeFiles = productNames.map(name => resolve(repository, `packages/host/dist/ir-tir/${name}.js`));
const areas = JSON.parse(readFileSync(resolve(repository, "test/architecture/quarantine/areas.json"), "utf8"));
const roots = areas.areas.map(area => area.directory);
const functionDirectory = "test/host-cases/ir-tir/function";
const functionCases = readdirSync(resolve(repository, functionDirectory)).filter(name => name.endsWith(".case.json")).sort()
  .map(name => `${functionDirectory}/${name}`);
const verifierDirectory = "test/host-cases/ir-tir/verifier";
const verifierCases = readdirSync(resolve(repository, verifierDirectory)).filter(name => name.endsWith(".case.json")).sort()
  .map(name => `${verifierDirectory}/${name}`);
const profiler = new Session();
const post = (method, parameters = {}) => new Promise((accept, reject) => {
  profiler.post(method, parameters, (error, result) => error === null ? accept(result) : reject(error));
});
assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined, true, "the entire bank requires bounded aggregate admission");
profiler.connect();
await post("Debugger.enable");
await post("Profiler.enable");
await post("Profiler.startPreciseCoverage", { callCount: true, detailed: true });
const { checkCompoundStaticAssignment, checkStaticUpdates, checkQualifiedStaticRead } = await import("./fixtures/typed-static-witnesses.mjs");
const { checkCommaSequence, checkCoalescingAssignment, checkOptionalEmbedding, checkLabelledTransfers, checkVoidOperand,
  checkTirAdmissionCuts, checkTirBodyAdmissionCuts, checkTirVerifierAdmissionCuts, tirFixtureAdmission,
  tirFixtureBodyVerifier, tirFixtureVerifier } = await import("./fixtures/typed-occurrence-witnesses.mjs");
let product;
let verifyBody;
let verifyChapter;
let admitFixtureRead;
let sameSyntaxFields;
let structureOf;

const readyStatement = node => ({ kind: "ready-statement", node });
const readyChapter = root => ({ kind: "ready-root", root });

test("an identity assertion carries the actual contextual tuple product without a second conversion", async () => {
  const fixture = await loadFrontFixture();
  const { createAccount, chargeWork } = await import("../../packages/host/dist/dataflow/index.js");
  const { verifyTir } = await import("../../packages/host/dist/ir-tir/index.js");
  const { verifyTupleAssertionProduct } = await import("../../packages/host/dist/ir-tir/verify-occurrences.js");
  const { tirReadyReadAdmission } = await import("../../packages/host/dist/ir-program/index.js");
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../packages/host/dist/pipeline/typed-barrier.js");
  const input = analysisInput(fixture, "sdk-minimal", `
    function flip(flag: boolean): boolean { return !flag; }
    export function start(flag: boolean): readonly [boolean, true] { return <const>(([flip(flag), true])); }
  `);
  const native = input.snapshot.nativeFacts;
  const configured = { ...input, snapshot: { ...input.snapshot, nativeFacts: {
    ...native, carrierHolding: [...native.carrierHolding, { carrier: "tuple", holding: "in-place" }],
  } } };
  const checked = captureSourceBarrier(configured);
  assert.equal(checked.kind, "ok");
  const typed = typeSourceBarrier(configured, checked.value, createAccount(input.limits.dataflow));
  assert.equal(typed.kind, "ok");
  const reader = typed.value.verifierOf(input.snapshot.entryPoint);
  const start = reader.source.tree.statements.nodes[1];
  const body = reader.bodyOf({ body: start.tsonic.body, bindings: { kind: "parametric" } });
  assert.deepEqual(verifyTir(reader, tirReadyReadAdmission(createAccount(input.limits.dataflow)))(body), { kind: "complete", violations: [] });
  const node = body.root.statements.nodes[0].expression;
  const original = reader.nodeOf({ kind: "body", value: { body: body.body, node: node.id } });
  const source = original.type.tsonic.type.value;
  const product = original.tsonic.views.contextual.value;
  assert.notEqual(source, product);
  assert.equal(node.type.tsonic.type, source);
  for (const value of [node, node.expression, node.expression.expression, node.expression.expression.expression]) {
    assert.equal(value.tsonic.type, product);
    assert.deepEqual(value.tsonic.conversion, { kind: "identity" });
  }
  const wrongValue = { ...node, expression: { ...node.expression, expression: {
    ...node.expression.expression, tsonic: { ...node.expression.expression.tsonic, type: source, convertedType: source },
  } } };
  const wrongEndpoint = { ...node, tsonic: { ...node.tsonic, type: source, convertedType: source } };
  const wrongAnnotation = { ...node, type: { ...node.type, id: start.type.id } };
  const verify = (candidate, admission, authored = original) => {
    const violations = [];
    const stop = verifyTupleAssertionProduct(candidate, authored, reader.types, admission, (rule, at) => violations.push([rule, at.id]));
    return { stop, violations };
  };
  let reads = 0;
  assert.deepEqual(verify(node, () => { reads += 1; return null; }), { stop: null, violations: [] });
  for (const candidate of [wrongValue, wrongEndpoint, wrongAnnotation])
    assert.deepEqual(verify(candidate, tirReadyReadAdmission(createAccount(input.limits.dataflow))), {
      stop: null, violations: [["operation-type", node.id]],
    });
  for (let maximumWork = 0; maximumWork < reads; maximumWork += 1) {
    const account = createAccount({ maximumWork, maximumResultEntries: 0 });
    const actual = verify(node, tirReadyReadAdmission(account), maximumWork === 0
      ? { ...original, get tsonic() { assert.fail("checked assertion read before admission"); } } : original);
    assert.notEqual(actual.stop, null);
    assert.equal(actual.stop === chargeWork(account, 1), true);
    assert.deepEqual(actual.violations, []);
  }
});

test("an uncontextualized tuple spread literal verifies its actual checked product, not a same-width alternative", async () => {
  const fixture = await loadFrontFixture();
  const { createAccount, chargeWork } = await import("../../packages/host/dist/dataflow/index.js");
  const { verifyTir } = await import("../../packages/host/dist/ir-tir/index.js");
  const { verifyArrayConstruction } = await import("../../packages/host/dist/ir-tir/verify-occurrences.js");
  const { tirReadyReadAdmission } = await import("../../packages/host/dist/ir-program/index.js");
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../packages/host/dist/pipeline/typed-barrier.js");
  const input = analysisInput(fixture, "sdk-minimal", `
    export function other(pair: readonly [boolean, boolean]): boolean { return true; }
    function take(left: boolean, right: boolean): boolean { return left && right; }
    export function start(flag: boolean): boolean { return take(...[flag, false]); }
  `);
  const nativeFacts = input.snapshot.nativeFacts;
  const configured = { ...input, snapshot: { ...input.snapshot, nativeFacts: {
    ...nativeFacts, carrierHolding: [...nativeFacts.carrierHolding, { carrier: "tuple", holding: "in-place" }],
  } } };
  const checked = captureSourceBarrier(configured);
  assert.equal(checked.kind, "ok", JSON.stringify(checked.diagnostics));
  const typed = typeSourceBarrier(configured, checked.value, createAccount(input.limits.dataflow));
  assert.equal(typed.kind, "ok", JSON.stringify(typed.diagnostics));
  const reader = typed.value.verifierOf(input.snapshot.entryPoint);
  const [other, , start] = reader.source.tree.statements.nodes;
  const body = reader.bodyOf({ body: start.tsonic.body, bindings: { kind: "parametric" } });
  assert.deepEqual(verifyTir(reader, tirReadyReadAdmission(createAccount(input.limits.dataflow)))(body), { kind: "complete", violations: [] });
  const node = body.root.statements.nodes[0].expression.arguments.nodes[0].expression;
  assert.equal(node.kind, "ArrayLiteralExpression");
  const original = reader.nodeOf({ kind: "body", value: { body: body.body, node: node.id } });
  const views = original.tsonic.value.views;
  assert.deepEqual(views.contextual, { kind: "available", value: null });
  assert.deepEqual(views.read, { kind: "available", value: node.tsonic.type });
  const otherType = other.parameters.nodes[0].tsonic.declaredType.value;
  const actual = reader.types.terms[node.tsonic.type];
  const alternative = reader.types.terms[otherType];
  assert.equal(actual.kind, "tuple");
  assert.deepEqual(alternative, { ...actual, readonly: true });
  assert.equal(actual.readonly, false);
  const { decision } = node.tsonic.construction;
  const offered = { ...node, tsonic: { ...node.tsonic, type: otherType, construction: {
    kind: "decided", decision: { ...decision, decision: { ...decision.decision, result: otherType } },
  } } };
  const violations = [];
  const instance = { body: body.body, bindings: body.bindings };
  assert.equal(verifyArrayConstruction(offered, original, instance, reader.types, reader.selectedNativeFacts,
    tirReadyReadAdmission(createAccount(input.limits.dataflow)), (rule, at) => violations.push([rule, at.id])), null);
  assert.deepEqual(violations, [["operation-type", node.id]]);

  const unready = { ...original, get tsonic() { assert.fail("checked literal read after refusal"); } };
  const account = createAccount({ maximumWork: 0, maximumResultEntries: 1 });
  const stop = chargeWork(account, 1);
  assert.notEqual(stop, null);
  assert.equal(verifyArrayConstruction(node, unready, instance, reader.types, reader.selectedNativeFacts,
    tirReadyReadAdmission(account), () => assert.fail("reported after refusal")) === stop, true);
});

test("TIR verifies interface header type bindings independently of the candidate's valid type table", async () => {
  const fixture = await loadFrontFixture();
  const { createAccount, chargeWork } = await import("../../packages/host/dist/dataflow/index.js");
  const { verifyTir, verifyTirModule } = await import("../../packages/host/dist/ir-tir/index.js");
  const { verifyInterfaceInstance } = await import("../../packages/host/dist/ir-tir/verify-interface.js");
  const { tirReadyReadAdmission } = await import("../../packages/host/dist/ir-program/index.js");
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../packages/host/dist/pipeline/typed-barrier.js");
  const input = analysisInput(fixture, "sdk-minimal", `
    export interface Left<T> { first: T; }
    export interface Left<T> { second: T; }
    export interface Right<V> { one: V; }
    export interface Right<V> { two: V; }
    export interface Single<X> { only: X; }
    export type Concrete = Left<boolean>;
    export function outer<T, U>(value: T): T {
      interface Pair<A> { first: T; }
      interface Pair<A> { second: A; third: U; }
      return value;
    }
  `);
  const checked = captureSourceBarrier(input);
  assert.equal(checked.kind, "ok", JSON.stringify(checked.diagnostics));
  const account = createAccount(input.limits.dataflow);
  const typed = typeSourceBarrier(input, checked.value, account);
  assert.equal(typed.kind, "ok", JSON.stringify(typed.diagnostics));
  const module = input.snapshot.entryPoint;
  const chapter = typed.value.modules.get(module);
  const reader = typed.value.verifierOf(module);
  const [left, , right, , single, concrete] = readyModuleStatements(readyModuleRoot(chapter.tree));
  const verify = () => verifyTirModule(reader, chapter, tirReadyReadAdmission(account));
  const body = reader.bodyOf({ body: reader.source.tree.tsonic.body, bindings: { kind: "parametric" } });
  const verifyBody = verifyTir(reader, tirReadyReadAdmission(account));
  assert.deepEqual(verify(), { kind: "complete", violations: [] });
  assert.deepEqual(verifyBody(body), { kind: "complete", violations: [] });
  const expected = node => ({ rule: "interface-instance-exact", site: { kind: "node", module, node: node.id },
    detail: [{ kind: "text", value: "interface header must retain its actual checked nominal instance and rigid arguments" }] });
  for (const [node, offered] of [[left, right.tsonic.type], [left, concrete.tsonic.type], [single, left.tsonic.type]]) {
    const original = node.tsonic;
    node.tsonic = { ...original, type: offered };
    try {
      assert.deepEqual(verify(), { kind: "complete", violations: [expected(node)] });
      assert.deepEqual(verifyBody(body), { kind: "complete", violations: [expected(node)] });
    }
    finally { node.tsonic = original; }
  }
  const authored = reader.source.tree.statements.nodes[0];
  const originalStop = chargeWork(createAccount({ maximumWork: 0, maximumResultEntries: 10 }));
  assert.ok(originalStop);
  const denied = verifyInterfaceInstance({ ...reader, nominalOf: () => assert.fail("refused nominal authority is unread") },
    left, authored, request => request.kind === "source-declaration" ? originalStop : null,
    () => assert.fail("an original stop is not a type violation"));
  assert.equal(denied === originalStop, true);
  const outer = reader.source.bodies.find(candidate => candidate.root.kind === "Block");
  const nested = reader.bodyOf({ body: outer.body, bindings: { kind: "parametric" } });
  assert.deepEqual(verifyBody(nested), { kind: "complete", violations: [] });
  const originalPair = outer.root.statements.nodes[0];
  const firstPair = nested.root.statements.nodes[0];
  const pairNominal = reader.nominalOf(originalPair.tsonic.definition);
  assert.deepEqual(pairNominal.slots.map(slot => slot.scope), ["outer", "outer", "local"]);
  const pair = reader.types.terms[firstPair.tsonic.type];
  const captures = reader.declarationOf(originalPair.tsonic.definition).scope.capturedParameters;
  assert.deepEqual(pair.arguments.slice(0, 2).map(argument => reader.types.terms[argument]), captures.map(parameter => ({ kind: "param", parameter })));
  const violations = [];
  const otherScope = reader.declarationOf(single.tsonic.definition);
  assert.equal(verifyInterfaceInstance({ ...reader, declarationOf: () => otherScope }, firstPair, originalPair, () => null,
    (rule, node, detail) => violations.push([rule, node.id, detail])), null);
  assert.deepEqual(violations, [["interface-instance-exact", firstPair.id, expected(firstPair).detail[0].value]]);
  let reached = 0;
  const interrupted = verifyInterfaceInstance({ ...reader, declarationOf: () => assert.fail("refused captured scope is unread") },
    firstPair, originalPair, request => request.kind === "source-declaration" && ++reached === 2 ? originalStop : null,
    () => assert.fail("an original stop is not a type violation"));
  assert.equal(interrupted === originalStop && reached === 2, true);
});

function writeValueEvidence(path, root) {
  const output = openSync(path, "wx");
  const options = { depth: 0, maxArrayLength: null, maxStringLength: null, breakLength: Infinity,
    compact: true, colors: false, showHidden: true, customInspect: false, getters: false };
  let buffer = "";
  const append = text => {
    buffer += text;
    if (buffer.length >= 65536) { writeFileSync(output, buffer); buffer = ""; }
  };
  try {
    if (root === null || typeof root !== "object") append(`${inspect(root, options)}\n`);
    else {
      const values = [root];
      const identities = new Map([[root, 0]]);
      for (let position = 0; position < values.length; position++) {
        const value = values[position];
        append(`Object #${position} = ${inspect(value, options)}\n`);
        const properties = Object.getOwnPropertyDescriptors(value);
        for (const key of Reflect.ownKeys(properties)) {
          const property = properties[key];
          if (!Object.hasOwn(property, "value")) continue;
          const child = property.value;
          if (child === null || typeof child !== "object") continue;
          let target = identities.get(child);
          if (target === undefined) {
            target = values.length;
            identities.set(child, target);
            values.push(child);
          }
          append(`  #${position}[${inspect(key, options)}] -> Object #${target}\n`);
        }
      }
    }
    if (buffer.length !== 0) writeFileSync(output, buffer);
  } finally { closeSync(output); }
}

function assertCompleteValue(actual, expected, message = "complete value comparison", compare = isDeepStrictEqual) {
  if (compare(actual, expected) === true) return;
  const admission = JSON.parse(process.env.TSONIC_TEST_ADMISSION);
  const evidence = resolve(repository, ".temp/test-runs", admission.unit);
  mkdirSync(evidence, { recursive: true });
  const directory = mkdtempSync(resolve(evidence, "ir-tir-comparison-"));
  const actualPath = resolve(directory, "actual.txt");
  const expectedPath = resolve(directory, "expected.txt");
  writeValueEvidence(actualPath, actual);
  writeValueEvidence(expectedPath, expected);
  assert.fail(`${String(message).slice(0, 180)}; complete actual: ${actualPath}; complete expected: ${expectedPath}`);
}

const sameWire = (actual, expected) => actual === expected;

function assertInvalidText(text, offset, expected, found) {
  const lines = text.slice(0, offset).split("\n");
  assertCompleteValue(product.parseTir(text), { kind: "invalid-text", offset, line: lines.length,
    column: lines[lines.length - 1].length + 1, expected, found });
}

before(async () => {
  product = await import("../../packages/host/dist/ir-tir/index.js");
  verifyBody = await tirFixtureBodyVerifier(product.verifyTir);
  verifyChapter = await tirFixtureVerifier(product.verifyTirModule);
  admitFixtureRead = await tirFixtureAdmission();
  ({ sameSyntaxFields } = await import("../../packages/host/dist/ir-tir/syntax-compare.js"));
  const { inspectTirStructure } = await import("../../packages/host/dist/ir-tir/verify-occurrences.js");
  const { createTirLayouts } = await import("../../packages/host/dist/ir-tir/text-model.js");
  structureOf = body => inspectTirStructure(body, createTirLayouts(), new Set());
});

await import("./source-add-composed.test.mjs");
await import("./source-semantic-queries.test.mjs");
test("native compound static assignment reads the selected cell before a same-cell RHS store", checkCompoundStaticAssignment);
test("direct static updates return the old or new native value and store only on success", checkStaticUpdates);
test("authored comma sequences preserve ordered effects and forward only the right value", checkCommaSequence);
test("a selected callable reads the actual initialized module static through its source binding", checkQualifiedStaticRead);
test("native local coalescing assignment distinguishes absence from false and retains one optional carrier", checkCoalescingAssignment);
test("Evaluate consumes the selected optional embedding without changing a native payload", checkOptionalEmbedding);
test("labelled native transfers retain their actual lexical targets across nested controls", checkLabelledTransfers);
test("the authored void operator evaluates its operand once and returns native absence only when used", checkVoidOperand);
const codecBinding = { kind: "item", value: { owner: ownerId, node: 4 } };
const codecBindingWire = `item(value=ItemNodeRef(owner=def:"${ownerId}", node=n:4))`;
function typeEvidence(category) {
  return { type: 0, component: { kind: "body", value: { body: bodyId, node: 0 } }, category,
    numeric: null, sum: null, nominal: null, pointer: null };
}

const replaceScopeInventory = (input, scopes) => {
  const knownTarget = input.bindingScopesOf;
  input.bindingScopesOf = (...request) => {
    const actual = knownTarget(...request);
    return actual.kind !== "complete" || actual.scopes === null ? actual : completeScopes(scopes);
  };
};
const bodyScopes = (input, body) => {
  const result = input.bindingScopesOf({ kind: "body", instance: { body: body.body, bindings: body.bindings } }, body, null);
  assert.equal(result.kind, "complete");
  const scopes = result.scopes;
  assert.equal(Array.isArray(scopes), true, "the authored fixture has an actual scope inventory for this complete instance");
  return scopes;
};

function typeAliasModuleScenario(ready = false) {
  const definition = "D[M[P[p];m];Alias]";
  const declaration = { kind: "definition", definition };
  const name = { ...header(2, 1), kind: "Identifier", text: "Alias",
    tsonic: { role: "declaration-name", declaration, storage: null } };
  const keyword = { ...header(3, 1), kind: "StringKeyword", tsonic: { type: 0, declarations: [] } };
  const alias = { ...header(1, 0), kind: "TypeAliasDeclaration", modifiers: null, name, typeParameters: null, type: keyword,
    tsonic: { definition, parameters: [], type: 0 } };
  const end = { ...header(4, 0), kind: "EndOfFile", tsonic: null };
  const sourceName = { ...header(2, 1), kind: "Identifier", text: "Alias",
    tsonic: { core: emptyCore(), role: "declaration-name", declaration } };
  const sourceKeyword = { ...header(3, 1), kind: "StringKeyword",
    tsonic: { core: emptyCore(), type: available(0), referencedDefinitions: [] } };
  const sourceAlias = { ...header(1, 0), kind: "TypeAliasDeclaration", modifiers: null, name: sourceName,
    typeParameters: null, type: sourceKeyword, tsonic: { core: emptyCore(), parent: ownerId, attributes: [],
      memory: available(null), definition, parameters: [], type: available(0) } };
  const sourceEnd = { ...header(4, 0), kind: "EndOfFile", tsonic: null };
  const sourceTree = { ...header(0), kind: "SourceFile", statements: nodeList([sourceAlias]), endOfFileToken: sourceEnd,
    languageVariant: "Standard", scriptKind: "TS", commentDirectives: [], pragmas: [], checkJsDirective: null,
    tsonic: { core: emptyCore(), parent: null, attributes: [], memory: available(null), definition: ownerId, body: bodyId } };
  const body = emptyModuleBody();
  body.root.statements = nodeList([readyStatement(alias)]);
  body.root.endOfFileToken = end;
  const input = emptyVerificationInput(body, [sourceAlias, sourceName, sourceKeyword, sourceEnd]);
  input.source.tree = sourceTree;
  input.source.bodies[0].root = sourceTree;
  input.source.items.push({ definition, node: 1 });
  if (!ready) {
    input.module.tree = { kind: "checked-root", root: sourceTree };
    input.module.bodies.length = 0;
    input.bodyOf = () => null;
  }
  const nodes = new Map([sourceTree, sourceAlias, sourceName, sourceKeyword, sourceEnd].map(node => [node.id, node]));
  const queries = [];
  const scopes = [];
  const bodyScopesOf = input.bindingScopesOf;
  input.bindingScopesOf = (target, subject, visit) => {
    queries.push(structuredClone(target));
    return target.kind === "module" ? completeScopes(target.module === moduleId ? scopes : null) : bodyScopesOf(target, subject, visit);
  };
  input.declarationOf = selected => selected === definition || selected === ownerId
    ? { scope: emptyScope(), parameterCount: 0, endpoints: [] } : null;
  input.nodeOf = reference => (reference.kind === "body" ? reference.value.body === bodyId
    : reference.value.owner === definition || reference.value.owner === ownerId) ? nodes.get(reference.value.node) ?? null : null;
  return { input, module: input.module, body, alias, keyword, definition, queries, scopes };
}

const bodyViolation = (rule, detail, body = bodyId) => ({ rule, site: { kind: "body", body }, detail: [{ kind: "text", value: detail }] });
const nodeViolation = (rule, node, detail) => ({ rule, site: { kind: "node", module: moduleId, node },
  detail: [{ kind: "text", value: detail }] });
function evidenceText(category) {
  return `TypeEvidence(type=t:0, component=body(value=NodeRef(body=body:"${bodyId}", node=n:0)), category=${category}, numeric=null, sum=null, nominal=null, pointer=null)`;
}

// A decided closure with one row per captured local, each with the same logical capture.
function closureDecisionOf(carrier, locals, mode = "captured-location") {
  return { kind: "decided", decision: { carrier, captures: locals.map(local => ({ local, capture: mode })), execution: { kind: "pure" } } };
}

function captureRowWire(local, mode) {
  return `CaptureRow(local=LocalRef(body=body:${JSON.stringify(local.body)}, local=l:${local.local}), capture=${JSON.stringify(mode)})`;
}

function closureDecisionWire(locals, mode = "captured-location") {
  return `decided(decision=ClosureDecision(carrier=t:0, captures=[${locals.map(local => captureRowWire(local, mode)).join(", ")}], execution=pure()))`;
}

// The rows of a typed body: each captured local with its logical capture.
const bodyRows = (locals, mode = "captured-location") => locals.map(local => ({ local, capture: mode }));

function genericFunctionScenario(nodes = { callable: 2, typeParameter: 3, typeName: 4, parameter: 5,
  parameterName: 6, block: 7, return: 8, value: 9, end: 10 }) {
  const definition = "D[M[P[p];m];f]";
  const functionBody = `B[${definition};function;0]`;
  const typeDefinition = "D[M[P[p];m];f/T]";
  const valueDefinition = "D[M[P[p];m];f/v]";
  const parameter = { declaration: typeDefinition, constraint: null, default: null };
  const scope = { ...emptyScope(), methodParameters: [typeDefinition] };
  const rigid = () => ({ ...emptyBindings(), methodBindings: [{ kind: "rigid", parameter: typeDefinition }] });
  const bound = type => ({ ...emptyBindings(), methodBindings: [{ kind: "bound", parameter: typeDefinition, type }] });
  const local = { body: functionBody, local: 0 };
  const declaration = { kind: "local", local };
  const localSource = { kind: "item", value: { owner: valueDefinition, node: nodes.parameter } };
  const endpoint = { declaration: definition, role: "api-body", signature: 1, body: functionBody };
  const template = () => ({ body: functionBody, lexicalBindings: rigid(), dependence: "binding-dependent" });
  const typedFunction = storage => {
    const typeName = { ...header(nodes.typeName, nodes.typeParameter), kind: "Identifier", text: "T",
      tsonic: { role: "type-name", type: 1, declarations: [typeDefinition] } };
    const typeNode = { ...header(nodes.typeParameter, nodes.callable), kind: "TypeParameter", modifiers: null, name: typeName,
      constraint: null, expression: null, defaultType: null, tsonic: { parameter } };
    const valueName = { ...header(nodes.parameterName, nodes.parameter), kind: "Identifier", text: "v",
      tsonic: { role: "declaration-name", declaration, storage } };
    const valueParameter = { ...header(nodes.parameter, nodes.callable), kind: "Parameter", modifiers: null, dotDotDotToken: null,
      name: valueName, questionToken: null, type: null, initializer: { kind: "none" },
      tsonic: { declaration: valueDefinition, local, storage, passing: "by-value", initializer: null, role: "required" } };
    const value = { ...header(nodes.value, nodes.return), kind: "Identifier", text: "v",
      tsonic: { ...typedValue(storage), role: "value", resolution: { kind: "local", local } } };
    const statement = { ...header(nodes.return, nodes.block), kind: "ReturnStatement", expression: value, tsonic: null };
    const block = { ...header(nodes.block, nodes.callable), kind: "Block", statements: nodeList([statement]), multiLine: false, tsonic: null };
    return { ...header(nodes.callable, 1), kind: "FunctionExpression", modifiers: null, typeParameters: nodeList([typeNode]),
      parameters: nodeList([valueParameter]), type: null, fullSignature: null, asteriskToken: null, body: block,
      name: null, tsonic: { ...typedValue(4), callable: { definition, parameters: [parameter], signatures: [endpoint],
        template: template(), attributes: [] }, closure: closureDecisionOf(4, []) } };
  };
  const checkedTypeName = { ...header(nodes.typeName, nodes.typeParameter), kind: "Identifier", text: "T",
    tsonic: { core: emptyCore(), role: "type-name", resolution: { kind: "declarations", definitions: [typeDefinition] } } };
  const checkedType = { ...header(nodes.typeParameter, nodes.callable), kind: "TypeParameter", modifiers: null, name: checkedTypeName,
    constraint: null, expression: null, defaultType: null, tsonic: { core: emptyCore(), parent: definition,
      attributes: [], memory: available(null), definition: typeDefinition, parameter } };
  const checkedValueName = { ...header(nodes.parameterName, nodes.parameter), kind: "Identifier", text: "v",
    tsonic: { core: emptyCore(), role: "declaration-name", declaration } };
  const checkedParameter = { ...header(nodes.parameter, nodes.callable), kind: "Parameter", modifiers: null, dotDotDotToken: null,
    name: checkedValueName, questionToken: null, type: null, initializer: null,
    tsonic: { core: emptyCore(), parent: definition, attributes: [], memory: available(null), declaration,
      declaredType: available(1), inferredTypeBound: null, initializer: null } };
  const checkedValueNode = { ...header(nodes.value, nodes.return), kind: "Identifier", text: "v",
    tsonic: { core: emptyCore(), role: "value", value: checkedValue(1), resolution: { kind: "local", local } } };
  const checkedReturn = { ...header(nodes.return, nodes.block), kind: "ReturnStatement", expression: checkedValueNode, tsonic: null };
  const checkedBlock = { ...header(nodes.block, nodes.callable), kind: "Block", statements: nodeList([checkedReturn]), multiLine: false, tsonic: null };
  const checkedFunction = { ...header(nodes.callable, 1), kind: "FunctionExpression", modifiers: null,
    typeParameters: nodeList([checkedType]), parameters: nodeList([checkedParameter]), type: null, fullSignature: null,
    asteriskToken: null, body: checkedBlock, name: null,
    tsonic: { core: emptyCore(), ...checkedValue(4), body: functionBody, captures: [] } };
  const outer = emptyModuleBody();
  const functionTemplate = { ...emptyModuleBody(), body: functionBody, owner: definition, lexicalBindings: rigid(),
    dependence: "binding-dependent", signature: 1, completion: 1, root: typedFunction(1),
    params: [],
    locals: [{ id: 0, declaration: localSource, name: "v", role: "parameter", storage: 1, capturedFrom: null, mutable: true }] };
  functionTemplate.params = functionTemplate.root.parameters.nodes;
  const instances = [2, 3].map(storage => {
    const root = typedFunction(storage);
    return { ...functionTemplate, bindings: { kind: "instantiated", bindings: bound(storage) },
      lexicalBindings: bound(storage), signature: storage, completion: storage, root,
      params: root.parameters.nodes, locals: [{ ...functionTemplate.locals[0], storage }] };
  });
  outer.root.statements = nodeList([readyStatement({ ...header(1, 0), kind: "ExpressionStatement", expression: functionTemplate.root, tsonic: null })]);
  outer.root.endOfFileToken = { ...header(nodes.end, 0), kind: "EndOfFile", tsonic: null };
  outer.nestedBodies = [functionBody];
  const initial = emptyVerificationInput(outer);
  const checkedRoot = initial.source.tree;
  checkedRoot.statements = nodeList([{ ...header(1, 0), kind: "ExpressionStatement", expression: checkedFunction, tsonic: null }]);
  checkedRoot.endOfFileToken = { ...header(nodes.end, 0), kind: "EndOfFile", tsonic: null };
  const originalFunction = { body: functionBody, owner: definition,
    params: [{ local: 0, declaration: valueDefinition, role: "required", passing: "by-value", initializer: null }],
    locals: [{ id: 0, declaration: localSource, name: "v", role: "parameter", checkerSlot: available(1),
      capturedFrom: null, mutable: true }], root: checkedFunction, captures: [], scopes: [],
    asynchronous: false, generator: false, candidateLists: [], nestedBodies: [] };
  initial.source.bodies[0].nestedBodies = [functionBody];
  initial.source.bodies.push(originalFunction);
  initial.source.items.push({ definition, node: nodes.callable }, { definition: typeDefinition, node: nodes.typeParameter },
    { definition: valueDefinition, node: nodes.parameter });
  const module = { module: moduleId, tree: readyChapter(outer.root), bodies: [outer, functionTemplate, ...instances] };
  const signature = (id, type, typeParameters) => ({ id, declaration: definition,
    owner: { kind: "body", value: { body: functionBody, node: nodes.callable } }, composition: null, kind: "call", typeParameters,
    receiver: null, parameters: [{ declaration: valueDefinition, kind: "required", type, passing: "by-value", initializer: null, acceptsOmission: false }], result: type });
  const types = { terms: [{ kind: "intrinsic", intrinsic: "unknown" }, { kind: "param", parameter: typeDefinition },
    { kind: "string" }, { kind: "primitive", primitive: "int32" }, { kind: "callable", calls: [1], constructs: [] }],
  signatures: [initial.types.signatures[0], signature(1, 1, [parameter]), signature(2, 2, []), signature(3, 3, [])] };
  const declarations = new Map([[ownerId, { scope: emptyScope(), parameterCount: 0, endpoints: [] }],
    [definition, { scope, parameterCount: 1, endpoints: [endpoint] }],
    [typeDefinition, { scope, parameterCount: 0, endpoints: [] }], [valueDefinition, { scope, parameterCount: 0, endpoints: [] }]]);
  const functionNodes = new Map([checkedFunction, checkedType, checkedTypeName, checkedParameter,
    checkedValueName, checkedBlock, checkedReturn, checkedValueNode].map(node => [node.id, node]));
  const outerBodyNodes = new Map([[0, checkedRoot], [1, checkedRoot.statements.nodes[0]], [nodes.end, checkedRoot.endOfFileToken]]);
  const outerNodes = new Map([...outerBodyNodes, ...functionNodes]);
  const bodyNodes = new Map([[bodyId, outerBodyNodes], [functionBody, functionNodes]]);
  const itemNodes = new Map([[ownerId, outerBodyNodes],
    [definition, new Map([checkedFunction, checkedBlock, checkedReturn, checkedValueNode].map(node => [node.id, node]))],
    [typeDefinition, new Map([checkedType, checkedTypeName].map(node => [node.id, node]))],
    [valueDefinition, new Map([checkedParameter, checkedValueName].map(node => [node.id, node]))]]);
  const scopes = new Map([[outer, [emptyScope(), emptyScope()]], [functionTemplate, [scope, scope]],
    ...instances.map(body => [body, [scope, scope, scope]])]);
  const scopeReaders = new Map([...scopes].map(([body, inventory]) => [body, bodyScopeReader(body, inventory)]));
  const inputFor = selected => ({ source: initial.source, module, types, bindingScopesOf: scopeReaders.get(selected), layoutAliasOf: null, diagnostics: [],
    declarationOf: selectedDefinition => declarations.get(selectedDefinition) ?? null,
    declarationSourceOf: selectedDefinition => {
      const entry = initial.source.items.find(item => item.definition === selectedDefinition);
      return entry === undefined ? null : { kind: "item", value: { owner: entry.definition, node: entry.node } };
    },
    staticStorageOf: () => null,
    memberTableOf: () => { throw new Error("unexpected generic-function member lookup"); },
    bodyOf: instance => module.bodies.find(body => body.body === instance.body && compareCaseValues(body.bindings, instance.bindings)) ?? null,
    nominalOf: () => null,
    nodeOf: reference => reference.kind === "body" ? bodyNodes.get(reference.value.body)?.get(reference.value.node) ?? null
      : itemNodes.get(reference.value.owner)?.get(reference.value.node) ?? null,
    localExists: reference => reference.body === functionBody && reference.local === 0 });
  return { outer, functionTemplate, instances, inputFor, originalFunction, definition, functionBody, typeDefinition,
    valueDefinition, scope, types, declarations, checkedFunction, functionNodes, outerNodes, outerBodyNodes,
    itemNodes, module, nodes };
}

function bindingPatternScenario(includeHole) {
  const block = includeHole ? 10 : 9;
  const fixture = genericFunctionScenario({ callable: 2, typeParameter: 3, typeName: 4, parameter: 5,
    parameterName: 6, block, return: block + 1, value: block + 2, end: block + 3 });
  const body = fixture.functionTemplate;
  fixture.module.bodies = [fixture.outer, body];
  const bindingId = includeHole ? 8 : 7;
  const nameId = bindingId + 1;
  const local = { body: fixture.functionBody, local: 1 };
  const declaration = { kind: "local", local };
  const name = { ...header(nameId, bindingId), kind: "Identifier", text: "v",
    tsonic: { role: "declaration-name", declaration, storage: 1 } };
  const sourceName = { ...header(nameId, bindingId), kind: "Identifier", text: "v",
    tsonic: { core: emptyCore(), role: "declaration-name", declaration } };
  const binding = { ...header(bindingId, 6), kind: "BindingElement", dotDotDotToken: null, propertyName: null,
    name, initializer: null, tsonic: { declaration, storage: 1, initializer: null, role: "binding" } };
  const sourceBinding = { ...header(bindingId, 6), kind: "BindingElement", dotDotDotToken: null, propertyName: null,
    name: sourceName, initializer: null, tsonic: { core: emptyCore(), declaration, declaredType: available(1) } };
  const hole = { ...header(7, 6), kind: "BindingElement", dotDotDotToken: null, propertyName: null,
    name: null, initializer: null, tsonic: { role: "hole" } };
  const sourceHole = { ...header(7, 6), kind: "BindingElement", dotDotDotToken: null, propertyName: null,
    name: null, initializer: null, tsonic: { core: emptyCore(), declaration: null, declaredType: available(null) } };
  const pattern = { ...header(6, 5), kind: "ArrayBindingPattern", elements: nodeList(includeHole ? [hole, binding] : [binding]),
    tsonic: { storage: 5 } };
  const sourcePattern = { ...header(6, 5), kind: "ArrayBindingPattern",
    elements: nodeList(includeHole ? [sourceHole, sourceBinding] : [sourceBinding]),
    tsonic: { core: emptyCore(), declaration: null, declaredType: available(5) } };
  const parameter = body.root.parameters.nodes[0];
  const sourceParameter = fixture.checkedFunction.parameters.nodes[0];
  parameter.name = pattern;
  parameter.tsonic.storage = 5;
  sourceParameter.name = sourcePattern;
  sourceParameter.tsonic.declaredType = available(5);
  body.params[0].tsonic.storage = 5;
  body.locals[0].storage = 5;
  fixture.originalFunction.locals[0].checkerSlot = available(5);
  const occurrence = { kind: "body", value: { body: fixture.functionBody, node: nameId } };
  body.locals.push({ id: 1, declaration: occurrence, name: "v", role: "binding", storage: 1,
    capturedFrom: null, mutable: true });
  fixture.originalFunction.locals.push({ id: 1, declaration: occurrence, name: "v", role: "binding", checkerSlot: available(1),
    capturedFrom: null, mutable: true });
  body.root.body.statements.nodes[0].expression.tsonic.resolution = { kind: "local", local };
  fixture.checkedFunction.body.statements.nodes[0].expression.tsonic.resolution = { kind: "local", local };
  fixture.types.terms.push({ kind: "tuple", elements: Array.from({ length: includeHole ? 2 : 1 }, () =>
    ({ kind: "required", type: 1, declaration: null })), readonly: false });
  fixture.types.signatures[1].parameters[0].type = 5;
  const sourceNodes = includeHole ? [sourcePattern, sourceHole, sourceBinding, sourceName]
    : [sourcePattern, sourceBinding, sourceName];
  for (const node of sourceNodes) {
    fixture.functionNodes.set(node.id, node);
    fixture.itemNodes.get(fixture.valueDefinition).set(node.id, node);
  }
  const input = fixture.inputFor(body);
  input.localExists = reference => reference.body === fixture.functionBody && fixture.originalFunction.locals[reference.local] !== undefined;
  return { ...fixture, body, input, binding, hole: includeHole ? hole : null };
}

function nestedDeclarationScenario(bodyless) {
  const body = emptyModuleBody();
  const definition = "D[M[P[p];m];declared]";
  const parameterDefinition = "D[M[P[p];m];declared/input]";
  const nestedBody = "B[D[M[P[p];m];declared];function;0]";
  const local = index => ({ body: nestedBody, local: index });
  const endpoint = { declaration: definition, role: bodyless ? "advertised" : "api-body", signature: 1,
    body: bodyless ? null : nestedBody };
  const valueName = { ...header(6, 5), kind: "Identifier", text: "value",
    tsonic: { role: "declaration-name", declaration: { kind: "local", local: local(1) }, storage: 1 } };
  const element = { ...header(5, 4), kind: "BindingElement", dotDotDotToken: null, propertyName: null,
    name: valueName, initializer: null, tsonic: { role: "binding", declaration: { kind: "local", local: local(1) }, storage: 1, initializer: null } };
  const pattern = { ...header(4, 3), kind: "ArrayBindingPattern", elements: nodeList([element]), tsonic: { storage: 2 } };
  const parameter = { ...header(3, 1), kind: "Parameter", modifiers: null, dotDotDotToken: null, name: pattern,
    questionToken: null, type: null, initializer: { kind: "none" }, tsonic: { declaration: parameterDefinition, local: local(0),
      storage: 2, passing: "by-value", initializer: null, role: "required" } };
  const returned = { ...header(10, 9), kind: "Identifier", text: "value",
    tsonic: { ...typedValue(1), role: "value", resolution: { kind: "local", local: local(1) } } };
  const block = { ...header(8, 1), kind: "Block", statements: nodeList([
    { ...header(9, 8), kind: "ReturnStatement", expression: returned, tsonic: null }]), multiLine: false, tsonic: null };
  const named = { ...header(2, 1), kind: "Identifier", text: "declared",
    tsonic: { role: "declaration-name", declaration: { kind: "definition", definition }, storage: null } };
  const type = { ...header(bodyless ? 3 : 7, 1), kind: "NumberKeyword", tsonic: { type: 1, declarations: [] } };
  const declaration = { ...header(1, 0), kind: "FunctionDeclaration", modifiers: null, typeParameters: null,
    parameters: nodeList(bodyless ? [] : [parameter]), type, fullSignature: null, asteriskToken: null,
    body: bodyless ? null : block, name: named,
    tsonic: { definition, parameters: [], signatures: [endpoint], attributes: [],
      template: bodyless ? null : { body: nestedBody, lexicalBindings: emptyBindings(), dependence: "parametric" } } };
  const end = { ...header(bodyless ? 4 : 11, 0), kind: "EndOfFile", tsonic: null };
  body.root.statements = nodeList([bodyless ? readyStatement(declaration) : { kind: "ready-callable", node: declaration }]);
  body.root.endOfFileToken = end;
  body.nestedBodies = bodyless ? [] : [nestedBody];
  const input = emptyVerificationInput(body);
  const sourceDeclaration = structuredClone(declaration);
  sourceDeclaration.name.tsonic = { core: emptyCore(), role: "declaration-name", declaration: { kind: "definition", definition } };
  sourceDeclaration.type.tsonic = { core: emptyCore(), type: available(1), referencedDefinitions: [] };
  sourceDeclaration.tsonic = { core: emptyCore(), parent: ownerId, definition, parameters: [], signatures: [endpoint],
    attributes: [], memory: available(null), body: bodyless ? null : nestedBody };
  const originalNodes = new Map();
  const collect = node => {
    originalNodes.set(node.id, node);
    for (const child of hirChildren(node)) collect(child);
  };
  if (!bodyless) {
    const sourceParameter = sourceDeclaration.parameters.nodes[0];
    sourceParameter.initializer = null;
    sourceParameter.tsonic = { core: emptyCore(), parent: definition, attributes: [], memory: available(null),
      declaration: { kind: "local", local: local(0) }, declaredType: available(2), inferredTypeBound: null, initializer: null };
    sourceParameter.name.tsonic = { core: emptyCore(), declaration: null, declaredType: available(2) };
    const sourceElement = sourceParameter.name.elements.nodes[0];
    sourceElement.tsonic = { core: emptyCore(), declaration: { kind: "local", local: local(1) }, declaredType: available(1) };
    sourceElement.name.tsonic = { core: emptyCore(), role: "declaration-name", declaration: { kind: "local", local: local(1) } };
    sourceDeclaration.body.statements.nodes[0].expression.tsonic = { core: emptyCore(), ...checkedValue(1),
      role: "value", resolution: { kind: "local", local: local(1) } };
    const params = [parameter];
    const locals = [0, 1].map(index => ({ id: index, declaration: { kind: "item", value: { owner: parameterDefinition, node: index === 0 ? 3 : 6 } },
      name: index === 0 ? "input" : "value", role: index === 0 ? "parameter" : "binding", storage: index === 0 ? 2 : 1, capturedFrom: null, mutable: true }));
    const typed = { body: nestedBody, owner: definition, bindings: { kind: "parametric" }, lexicalBindings: emptyBindings(),
      dependence: "parametric", signature: 1, completion: 1, yielded: null, sent: null, params, locals, root: block,
      nestedBodies: [], captures: [], scopes: [], evidence: [], asynchronous: false, generator: false };
    input.module.bodies.push(typed);
    input.source.bodies.push({ ...typed, root: sourceDeclaration.body,
      params: [{ local: 0, declaration: parameterDefinition, role: "required", passing: "by-value", initializer: null }],
      locals: locals.map(({ storage, ...row }) => ({ ...row, checkerSlot: available(storage) })), candidateLists: [] });
  }
  input.source.tree.statements = nodeList([sourceDeclaration]);
  input.source.tree.endOfFileToken = { ...end };
  input.source.bodies[0].nestedBodies = body.nestedBodies;
  input.source.items.push({ definition, node: 1 });
  if (!bodyless) input.source.items.push({ definition: parameterDefinition, node: 3 });
  collect(input.source.tree);
  input.types.terms.push({ kind: "primitive", primitive: "float64" },
    { kind: "tuple", elements: [{ kind: "required", type: 1, declaration: null }], readonly: false });
  input.types.signatures.push({ id: 1, declaration: definition, owner: null, composition: null, kind: "call", typeParameters: [],
    receiver: null, parameters: bodyless ? [] : [{ declaration: parameterDefinition, kind: "required", type: 2, passing: "by-value", initializer: null , acceptsOmission: false }], result: 1 });
  const baseDeclaration = input.declarationOf;
  input.declarationOf = requested => requested === definition || requested === parameterDefinition
    ? { scope: emptyScope(), parameterCount: requested === definition ? bodyless ? 0 : 1 : null, endpoints: requested === definition ? [endpoint] : [] }
    : baseDeclaration(requested);
  input.localExists = reference => reference.body === nestedBody && !bodyless && (reference.local === 0 || reference.local === 1);
  input.nodeOf = reference => {
    const node = originalNodes.get(reference.value.node);
    if (reference.kind === "body") return reference.value.body === bodyId && (reference.value.node < 8 || bodyless || reference.value.node === 11)
      || reference.value.body === nestedBody && reference.value.node >= 8 && reference.value.node <= 10 ? node ?? null : null;
    return reference.value.owner === ownerId || reference.value.owner === definition && reference.value.node >= 1 && reference.value.node <= (bodyless ? 3 : 7)
      || reference.value.owner === parameterDefinition && reference.value.node >= 3 && reference.value.node <= 6 ? node ?? null : null;
  };
  replaceScopeInventory(input, Array.from({ length: bodyless ? 2 : 3 }, emptyScope));
  return { body, input, parameter, pattern };
}

let hirChildren;
before(async () => { ({ childrenOfSyntax: hirChildren } = await import("../../packages/host/dist/ir-hir/index.js")); });

test("a genuine bodyless callable has no invented execution parameter namespace", () => {
  const fixture = nestedDeclarationScenario(true);
  assertCompleteValue(verifyBody(fixture.input, fixture.body), []);
});

test("nested callable parameter patterns retain actual nested local storage, not the enclosing module's", () => {
  const fixture = nestedDeclarationScenario(false);
  assertCompleteValue(verifyBody(fixture.input, fixture.body), []);
  fixture.pattern.elements.nodes[0].name.tsonic.storage = 0;
  assert.equal(verifyBody(fixture.input, fixture.body).some(violation => violation.rule === "binding-storage"), true);
});

test("ready chapter callable and body share the actual pattern formal and reject crossed ownership", async () => {
  const { createAccount, accountFailure } = await import("../../packages/host/dist/dataflow/index.js");
  const { tirReadyReadAdmission } = await import("../../packages/host/dist/ir-program/verification-work.js");
  const fixture = nestedDeclarationScenario(false);
  const module = fixture.input.module;
  const nested = module.bodies[1];
  const [{ node: callable }] = fixture.body.root.statements.nodes;
  const formal = fixture.parameter;
  const bodyScopesOf = fixture.input.bindingScopesOf;
  fixture.input.bindingScopesOf = (target, subject, visit) => target.kind === "module" && target.module === module.module && module === subject
    ? completeScopes([]) : bodyScopesOf(target, subject, visit);
  const result = verifyChapter(fixture.input, module);
  assert.deepEqual(result.map(row => row.rule), []);
  assert.deepEqual(verifyBody(fixture.input, fixture.body).map(row => row.rule), []);
  assert.equal(callable.parameters.nodes[0] === nested.params[0], true);
  assert.equal(callable.body === nested.root, true);
  fixture.pattern.elements.nodes[0].name.tsonic.storage = 0;
  assert.equal(verifyBody(fixture.input, fixture.body).some(row => row.rule === "binding-storage" && row.site.node === 6), true);
  fixture.pattern.elements.nodes[0].name.tsonic.storage = 1;

  const crossed = { ...callable, parameters: { ...callable.parameters, nodes: [{ ...formal }] } };
  const crossedModule = { ...module, tree: { kind: "ready-root", root: {
    ...fixture.body.root, statements: nodeList([{ kind: "ready-callable", node: crossed }]),
  } } };
  const refused = verifyChapter(fixture.input, crossedModule);
  assert.equal(refused.some(row => row.rule === "nested-template-identity" && row.site.node === callable.id), true);

  const successfulReads = checkTirVerifierAdmissionCuts(admitFixtureRead, product.verifyTirModule, fixture.input, module);
  assert.equal(successfulReads.filter(read => read === "bodyOf").length, 2);
  for (const [maximumWork, maximumResultEntries] of [[0, 1000000], [1000000, 0]]) {
    const account = createAccount({ maximumWork, maximumResultEntries });
    const candidate = { ...module, bodies: [...module.bodies] };
    Object.defineProperty(candidate.bodies, "0", { get() { assert.fail("an unpaid candidate body row was read"); } });
    const result = product.verifyTirModule(fixture.input, candidate, tirReadyReadAdmission(account));
    assert.equal(result.kind === "resource-stop" && result.stop === accountFailure(account), true);
    assert.deepEqual(Object.keys(result), ["kind", "stop"]);
  }
});

test("one Typed formal initializer slot admits its tag and only the reached phase root", async () => {
  const { chapterSyntaxSlots, admitFormalInitializer } = await import("../../packages/host/dist/ir-tir/chapter-syntax.js");
  const { createInstantiationMeter, admitCheckedProjection, chargeInstantiationWork } = await import("../../packages/host/dist/ir-program/work.js");
  const { accountFailure } = await import("../../packages/host/dist/dataflow/index.js");
  const fixture = nestedDeclarationScenario(false);
  const formal = fixture.parameter;
  const typed = fixture.input.module.bodies[1].root.statements.nodes[0].expression;
  const checked = fixture.input.source.bodies[1].root.statements.nodes[0].expression;
  const limits = (maximumWork, maximumCreatedRecords) => ({ maximumWork, maximumCreatedRecords, maximumBindingVectorsPerArtifact: 1,
    typeExpansion: { maximumDepth: 10, maximumVisits: 1000, maximumUnionMembers: 100, maximumIntersectionMembers: 100 } });
  const reads = [];
  const invoke = (kind, root, maximumWork, maximumRecords) => {
    reads.length = 0;
    Object.defineProperty(formal, "initializer", { configurable: true, get() {
      reads.push("tag");
      if (kind === "none") return { kind, get root() { assert.fail("none has no child"); } };
      return { kind, get root() { reads.push("root"); return root; } };
    } });
    const slot = [...chapterSyntaxSlots({ kind: "formal", node: formal })].find(row => row.kind === "formal-initializer");
    assert.deepEqual(reads, []);
    const meter = createInstantiationMeter(limits(maximumWork, maximumRecords));
    const selected = admitFormalInitializer(slot, () => admitCheckedProjection(meter, 1, 1), () => chargeInstantiationWork(meter));
    return { selected, stop: meter.failure ?? accountFailure(meter.account) };
  };
  for (const [kind, root] of [["ready-default", typed], ["checked-default", checked]]) {
    for (const [work, records, prefix] of [[0, 0, []], [1, 0, []], [1, 1, ["tag"]]]) {
      const { selected, stop } = invoke(kind, root, work, records);
      assert.equal(selected.kind === "refused" && selected.stop === stop, true);
      assert.deepEqual(Object.keys(selected), ["kind", "stop"]);
      assert.deepEqual(reads, prefix);
    }
    const { selected } = invoke(kind, root, 2, 1);
    assert.equal(selected.kind, "complete");
    assert.equal(selected.value.kind, kind);
    assert.equal(selected.value.root === root, true);
    assert.deepEqual(reads, ["tag", "root"]);
  }
  const { selected } = invoke("none", null, 1, 1);
  assert.equal(selected.kind, "complete");
  assert.deepEqual(selected.value, { kind: "none" });
  assert.deepEqual(reads, ["tag"]);
});

test("the standalone TIR wire preserves actual unopened declarations and supplied defaults in its checked domain", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const root = "/project/node_modules/dependency";
  const module = fixture.moduleOf(fixture.packageOf(root), "index.ts");
  const source = 'import { choose } from "dependency"; '
    + "export function supplied(value:boolean):boolean { return choose(value, value); }";
  const input = analysisInput(fixture, "sdk-minimal", source);
  input.snapshot = fixture.projectSnapshot({ sourceFiles: { "main.ts": source },
    libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }],
    extraFiles: { [root + "/package.json"]: JSON.stringify({ name: "dependency", version: "1.0.0", types: "index.ts" }) },
    otherPackages: [{ root, name: "dependency", modules: { "index.ts": ["source",
      "export function choose<T>(value:T, fallback:T=value):T { return fallback; } "
      + "export function latent(value:boolean):boolean { return value; }", false] } }] });
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const chapter = result.value.modules.find(row => row.module === module);
  const initializer = chapter.bodies.find(row => row.tir.root.kind === "SourceFile");
  const selection = chapter.bodies.find(row => row.kind === "selected" && row.tir.params.length === 2);
  const unopened = initializer.tir.root.statements.nodes.find(slot => slot.node.name?.text === "latent");
  assert.equal(unopened.kind, "checked-declaration");
  assert.equal(selection.tir.params[1].initializer.kind, "checked-default");
  for (const { tir } of [initializer, selection]) {
    const text = product.printTir(tir);
    assert.equal(text.includes("CheckedDeclarations(\n"), true);
    const output = product.parseTir(text);
    assert.equal(output.kind, "parsed");
    assert.equal(product.printTir(output.value), text);
    const typedOffset = text.indexOf("=n:") + 1;
    const checkedOffset = text.indexOf("=c:") + 1;
    assert.ok(typedOffset > 0 && checkedOffset > 0);
    for (const [offset, prefix] of [[typedOffset, "c"], [checkedOffset, "n"]]) {
      const crossed = product.parseTir(text.slice(0, offset) + prefix + text.slice(offset + 1));
      assert.equal(crossed.kind, "invalid-text");
      assert.equal(crossed.offset, offset);
    }
    const checkedRef = /^c:\d+/u.exec(text.slice(checkedOffset))[0];
    const absentChecked = "c:1000000";
    const missing = text.slice(0, checkedOffset) + absentChecked + text.slice(checkedOffset + checkedRef.length);
    assertInvalidText(missing, checkedOffset, ["declared syntax node"], "c");
    if (output.value.root.kind === "SourceFile") {
      const slot = output.value.root.statements.nodes.find(row => row.node.name?.text === "latent");
      assert.equal(slot.kind, "checked-declaration");
      assert.equal(slot.node.id, unopened.node.id);
    } else {
      const formal = output.value.params[1];
      assert.equal(formal.initializer.kind, "checked-default");
      assert.equal(formal.initializer.root.id, tir.params[1].initializer.root.id);
    }
  }
});

function siblingIdentityScenario(sourceShared, typedShared) {
  const body = emptyModuleBody();
  const first = { ...header(1, 0), kind: "EmptyStatement", tsonic: null };
  const second = sourceShared ? first : { ...header(2, 0), kind: "EmptyStatement", tsonic: null };
  const firstTyped = { ...first };
  const secondTyped = typedShared ? firstTyped : { ...second };
  const end = { ...header(sourceShared ? 2 : 3, 0), kind: "EndOfFile", tsonic: null };
  body.root.statements = nodeList([readyStatement(firstTyped), readyStatement(secondTyped)]);
  body.root.endOfFileToken = { ...end };
  const input = emptyVerificationInput(body, [first, second, end]);
  input.source.tree.statements = nodeList([first, second]);
  input.source.tree.endOfFileToken = end;
  return { body, input, firstTyped, second };
}

function layeredSyntaxScenario(depth) {
  const body = emptyModuleBody();
  const source = [];
  const typed = [];
  for (let level = depth; level >= 1; level--) {
    const child = source[0];
    const typedChild = typed[0];
    source.unshift({ ...header(level, level - 1), kind: "Block", statements: nodeList(child === undefined ? [] : [child, child]),
      multiLine: false, tsonic: null });
    typed.unshift({ ...header(level, level - 1), kind: "Block", statements: nodeList(typedChild === undefined ? [] : [typedChild, typedChild]),
      multiLine: false, tsonic: null });
  }
  const end = { ...header(depth + 1, 0), kind: "EndOfFile", tsonic: null };
  body.root.statements = nodeList([readyStatement(typed[0])]);
  body.root.endOfFileToken = { ...end };
  const input = emptyVerificationInput(body, [...source, end]);
  input.source.tree.statements = nodeList([source[0]]);
  input.source.tree.endOfFileToken = end;
  return { body, input, source, typed };
}

function twoParameterScenario() {
  const fixture = genericFunctionScenario({ callable: 2, typeParameter: 3, typeName: 4, parameter: 5,
    parameterName: 6, block: 9, return: 10, value: 11, end: 12 });
  const definition = "D[M[P[p];m];f/w]";
  const local = { body: fixture.functionBody, local: 1 };
  const declaration = { kind: "local", local };
  const source = { kind: "item", value: { owner: definition, node: 7 } };
  const first = fixture.checkedFunction.parameters.nodes[0];
  const name = { ...first.name, id: 8, parent: 7, text: "w", tsonic: { ...first.name.tsonic, declaration } };
  const parameter = { ...first, id: 7, name, tsonic: { ...first.tsonic, declaration } };
  fixture.checkedFunction.parameters.nodes.push(parameter);
  fixture.originalFunction.params.push({ local: 1, declaration: definition, role: "required", passing: "by-value", initializer: null });
  fixture.originalFunction.locals.push({ id: 1, declaration: source, name: "w", role: "parameter", checkerSlot: available(1),
    capturedFrom: null, mutable: true });
  for (const body of [fixture.functionTemplate, ...fixture.instances]) {
    const first = body.root.parameters.nodes[0];
    const storage = first.tsonic.storage;
    const name = { ...first.name, id: 8, parent: 7, text: "w", tsonic: { ...first.name.tsonic, declaration } };
    body.root.parameters.nodes.push({ ...first, id: 7, name, tsonic: { ...first.tsonic, declaration: definition, local } });
    body.locals.push({ id: 1, declaration: source, name: "w", role: "parameter", storage, capturedFrom: null, mutable: true });
  }
  for (const signature of fixture.types.signatures.slice(1)) signature.parameters.push({ declaration: definition,
    kind: "required", type: signature.result, passing: "by-value", initializer: null, acceptsOmission: false });
  fixture.declarations.get(fixture.definition).parameterCount = 2;
  fixture.declarations.set(definition, { scope: fixture.scope, parameterCount: 0, endpoints: [] });
  for (const node of [parameter, name]) { fixture.functionNodes.set(node.id, node); fixture.outerNodes.set(node.id, node); }
  fixture.itemNodes.set(definition, new Map([[7, parameter], [8, name]]));
  fixture.inputFor(fixture.outer).source.items.push({ definition, node: 7 });
  const inputFor = body => {
    const input = fixture.inputFor(body);
    input.localExists = reference => reference.body === fixture.functionBody && fixture.originalFunction.locals[reference.local] !== undefined;
    return input;
  };
  return { ...fixture, inputFor };
}

function callScenario(mode = "sync") {
  const asynchronous = mode === "async" || mode === "async-generator";
  const generator = mode === "generator" || mode === "async-generator";
  const typeParameter = 4 + (asynchronous ? 1 : 0);
  const parameter = typeParameter + 2;
  const block = parameter + 2 + (generator ? 1 : 0);
  const returning = block + 1 + (generator ? 3 : 0);
  const argument = returning + 2;
  const fixture = genericFunctionScenario({ callable: 3, typeParameter, typeName: typeParameter + 1, parameter,
    parameterName: parameter + 1, block, return: returning, value: returning + 1, end: argument + 1 });
  const hasWrapper = asynchronous || generator;
  const target = fixture.instances[0];
  const input = fixture.inputFor(fixture.outer);
  const published = [fixture.functionTemplate, ...fixture.instances];
  const wrapperDefinition = generator ? "D[M[P[core];iteration];Generator]" : "D[M[P[core];async];Promise]";
  if (hasWrapper) {
    const wrapper = type => ({ kind: "declared", definition: wrapperDefinition,
      arguments: generator ? [3, type, 0] : [type], facet: "instance", extent: null });
    fixture.types.terms.push(wrapper(2), wrapper(1), wrapper(3));
    fixture.types.signatures[1].result = 6;
    fixture.types.signatures[2].result = 5;
    fixture.types.signatures[3].result = 7;
    input.nominalOf = definition => definition === wrapperDefinition ? { kind: "declared", facets: ["instance"] } : null;
  }
  fixture.originalFunction.asynchronous = asynchronous;
  fixture.originalFunction.generator = generator;
  for (const body of published) {
    body.asynchronous = asynchronous;
    body.generator = generator;
    body.yielded = generator ? 3 : null;
    body.sent = generator ? 0 : null;
    body.root.parent = 2;
    body.root.modifiers = asynchronous ? nodeList([{ ...header(4, 3), kind: "AsyncKeyword", tsonic: null }]) : null;
    body.root.asteriskToken = generator ? { ...header(block - 1, 3), kind: "AsteriskToken", tsonic: null } : null;
    if (generator) {
      const value = { ...header(block + 3, block + 2), kind: "NumericLiteral", text: "1", tokenFlags: [],
        tsonic: { ...typedValue(3), role: "value", value: { numerator: 1n, denominator: 1n, negativeZero: false } } };
      const yielded = { ...header(block + 2, block + 1), kind: "YieldExpression", asteriskToken: null, expression: value,
        tsonic: { ...typedValue(0), protocol: { kind: "decided", decision: { kind: "yield", asynchronous, steps: [],
          value: 3, completion: body.completion, sent: 0, thrown: 0 } } } };
      body.root.body.statements.nodes.unshift({ ...header(block + 1, block), kind: "ExpressionStatement", expression: yielded, tsonic: null });
    }
  }
  fixture.checkedFunction.parent = 2;
  fixture.checkedFunction.modifiers = asynchronous ? nodeList([{ ...header(4, 3), kind: "AsyncKeyword", tsonic: null }]) : null;
  fixture.checkedFunction.asteriskToken = generator ? { ...header(block - 1, 3), kind: "AsteriskToken", tsonic: null } : null;
  if (asynchronous) fixture.functionNodes.set(4, fixture.checkedFunction.modifiers.nodes[0]);
  if (generator) {
    fixture.functionNodes.set(block - 1, fixture.checkedFunction.asteriskToken);
    const value = { ...header(block + 3, block + 2), kind: "NumericLiteral", text: "1", tokenFlags: [],
      tsonic: { core: emptyCore(), role: "value", value: checkedValue(3),
        literal: { kind: "number", token: "1", value: { numerator: 1n, denominator: 1n, negativeZero: false } } } };
    const yielded = { ...header(block + 2, block + 1), kind: "YieldExpression", asteriskToken: null, expression: value,
      tsonic: { core: emptyCore(), ...checkedValue(0), protocol: available({ kind: "yield", subject: block + 3,
        yielded: 3, sent: 0, completion: 1 }) } };
    const statement = { ...header(block + 1, block), kind: "ExpressionStatement", expression: yielded, tsonic: null };
    fixture.checkedFunction.body.statements.nodes.unshift(statement);
    for (const node of [statement, yielded, value]) fixture.functionNodes.set(node.id, node);
  }
  for (const [identity, node] of fixture.functionNodes) {
    fixture.outerNodes.set(identity, node);
    if (identity === 4 && asynchronous || generator && identity >= block + 1 && identity <= block + 3 || identity === block - 1 && generator) {
      fixture.itemNodes.get(fixture.definition).set(identity, node);
    }
  }
  const result = hasWrapper ? 5 : 2;
  const advertised = { declaration: fixture.definition, role: "advertised", signature: 1, body: fixture.functionBody };
  const api = { declaration: fixture.definition, role: "api-body", signature: 2, body: fixture.functionBody };
  fixture.declarations.get(fixture.definition).endpoints.push(advertised, api);
  const bindings = { ...emptyBindings(), methodBindings: [{ kind: "bound", parameter: fixture.typeDefinition, type: 2 }] };
  const decision = { candidate: 0, advertised, api, bindings, implementationBindings: bindings,
    parameters: [{ kind: "argument", parameter: 0, argument: 0, component: null, passing: "by-value" }],
    completion: { signature: 2, completion: 2, yielded: generator ? 3 : null, sent: generator ? 0 : null }, result };
  const callee = { decision, activation: { body: fixture.functionBody, bindings: target.bindings } };
  const value = { ...header(argument, 2), kind: "StringLiteral", text: "s", tokenFlags: [],
    tsonic: { ...typedValue(2), role: "value", value: "s" } };
  const call = { ...header(2, 1), kind: "CallExpression", expression: fixture.functionTemplate.root,
    questionDotToken: null, typeArguments: null, arguments: nodeList([value]),
    tsonic: { ...typedValue(result), application: { kind: "decided", decision: { callee, receiver: null,
      arguments: [{ kind: "provided", parameter: 0, expression: argument }] } }, operation: null } };
  fixture.outer.root.statements.nodes[0].node.expression = call;
  const captured = { kind: "call", receiver: null, arguments: [{ kind: "value", expression: argument }], typeArguments: [],
    candidates: available(0), resolvedSignature: available(2) };
  const checkedArgument = { ...header(argument, 2), kind: "StringLiteral", text: "s", tokenFlags: [],
    tsonic: { core: emptyCore(), role: "value", value: checkedValue(2), literal: { kind: "string", value: "s" } } };
  const checkedCall = { ...header(2, 1), kind: "CallExpression", expression: fixture.checkedFunction,
    questionDotToken: null, typeArguments: null, arguments: nodeList([checkedArgument]),
    tsonic: { core: emptyCore(), ...checkedValue(result), application: available(captured) } };
  input.source.tree.statements.nodes[0].expression = checkedCall;
  input.source.bodies[0].candidateLists = [{ id: 0, candidates: [{ ordinal: 0, declaration: fixture.definition,
    appliedSignature: available(2), bindings: available(bindings), conditionalFailure: available(null), contributions: [] }] }];
  for (const node of [checkedCall, checkedArgument]) {
    fixture.outerNodes.set(node.id, node);
    fixture.outerBodyNodes.set(node.id, node);
  }
  replaceScopeInventory(input, [emptyScope(), fixture.scope, fixture.scope, fixture.scope, emptyScope()]);
  return { ...fixture, input, body: fixture.outer, call, callee, target, decision, captured, checkedCall, checkedArgument };
}

function deferredConversionScenario() {
  const fixture = genericFunctionScenario();
  const body = fixture.functionTemplate;
  const value = body.root.body.statements.nodes[0].expression;
  const component = { kind: "body", value: { body: body.body, node: value.id } };
  const evidence = { type: 1, component, category: { kind: "parameter", declaration: fixture.typeDefinition },
    numeric: null, sum: null, nominal: null, pointer: null };
  const context = { occurrence: { body: body.body, node: value.id }, origin: origin(), bindings: body.lexicalBindings };
  const deferred = { invocation: { rule: "embed", input: { context, from: evidence, to: evidence, role: "return" } }, result: 1 };
  value.tsonic.conversion = { kind: "deferred", deferred };
  const input = fixture.inputFor(body);
  replaceScopeInventory(input, [fixture.scope, fixture.scope, fixture.scope]);
  return { ...fixture, body, input, value, deferred, context };
}

function genericObjectScenario() {
  const fixture = genericFunctionScenario({ callable: 2, typeParameter: 3, typeName: 4, parameter: 5,
    parameterName: 6, block: 7, return: 8, value: 12, end: 13 });
  const key = { kind: "text", value: "x" };
  const provenance = { kind: "mapped", owner: { kind: "body", value: { body: fixture.functionBody, node: 10 } }, key };
  const member = type => ({ key, origins: [provenance], readOrigins: [provenance], writeOrigins: [provenance],
    kind: "property", read: type, write: type, optional: false, readonly: false });
  const members = [member(1), member(2), member(3)];
  fixture.types.terms.push(...members.map(actual => ({ kind: "shape", members: [actual], indexes: [], calls: [], constructs: [] })));
  const facts = [];
  const queries = [];
  const bodies = [fixture.functionTemplate, ...fixture.instances];
  for (const [position, body] of bodies.entries()) {
    const type = position + 1;
    const storage = position + 5;
    const value = body.root.body.statements.nodes[0].expression;
    value.parent = 10;
    const name = { ...header(11, 10), kind: "Identifier", text: "x", tsonic: { role: "property-name", key } };
    const decision = { key, origins: [provenance], selectedDeclarations: [], primary: null, read: type, write: type,
      getter: null, setter: null, bindings: body.lexicalBindings, location: { kind: "data", check: { kind: "none" }, receiver: "in-place" } };
    const property = { ...header(10, 9), kind: "PropertyAssignment", modifiers: null, name, postfixToken: null,
      type: null, initializer: value, tsonic: { key, member: { kind: "decided", decision: { decision, getter: null, setter: null } } } };
    const expression = { ...header(9, 8), kind: "ObjectLiteralExpression", properties: nodeList([property]), multiLine: false,
      tsonic: { ...typedValue(storage), role: "value", construction: selectedOperation({ kind: "object-construction", parts: [] }, storage) } };
    body.root.body.statements.nodes[0].expression = expression;
    body.completion = storage;
    fixture.types.signatures[position + 1].result = storage;
    facts.push({ instance: { body: fixture.functionBody, bindings: body.bindings },
      occurrence: { kind: "selection", node: 10, ordinal: 0 }, table: { receiver: storage, members: [members[position]],
        indexes: [], calls: [], constructs: [], accessors: [], constructors: [], completeness: { kind: "complete" } } });
  }
  const checkedValueNode = fixture.checkedFunction.body.statements.nodes[0].expression;
  checkedValueNode.parent = 10;
  const checkedName = { ...header(11, 10), kind: "Identifier", text: "x",
    tsonic: { core: emptyCore(), role: "property-name", key: available(key), origins: available([provenance]) } };
  const checkedProperty = { ...header(10, 9), kind: "PropertyAssignment", modifiers: null, name: checkedName,
    postfixToken: null, type: null, initializer: checkedValueNode,
    tsonic: { core: emptyCore(), key: available(key), origins: available([provenance]) } };
  const checkedExpression = { ...header(9, 8), kind: "ObjectLiteralExpression", properties: nodeList([checkedProperty]), multiLine: false,
    tsonic: { core: emptyCore(), role: "value", value: checkedValue(5) } };
  fixture.checkedFunction.body.statements.nodes[0].expression = checkedExpression;
  for (const node of [checkedExpression, checkedProperty, checkedName]) {
    fixture.functionNodes.set(node.id, node);
    fixture.outerNodes.set(node.id, node);
    fixture.itemNodes.get(fixture.definition).set(node.id, node);
  }
  const scopes = new Map([[fixture.outer, [emptyScope(), emptyScope()]],
    [fixture.functionTemplate, [fixture.scope, fixture.scope, fixture.scope]],
    ...fixture.instances.map(body => [body, [fixture.scope, fixture.scope, fixture.scope, fixture.scope]])]);
  const inputFor = body => {
    const input = fixture.inputFor(body);
    replaceScopeInventory(input, scopes.get(body));
    input.memberTableOf = (instance, occurrence) => {
      queries.push({ instance, occurrence });
      return facts.find(fact => isDeepStrictEqual(fact.instance, instance) && isDeepStrictEqual(fact.occurrence, occurrence))?.table ?? null;
    };
    return input;
  };
  return { ...fixture, inputFor, facts, queries };
}

function contextualLiteralScenario() {
  const fixture = memberScenario("property");
  const original = fixture.input.source.tree.statements.nodes[0].expression;
  const typed = fixture.body.root.statements.nodes[0].node.expression;
  const key = { kind: "text", value: "y" };
  const provenance = { kind: "mapped", owner: { kind: "body", value: { body: bodyId, node: 2 } }, key };
  const decision = { ...fixture.decision, key, origins: [provenance], bindings: emptyBindings() };
  const name = { ...header(7, 6), kind: "Identifier", text: "y", tsonic: { role: "property-name", key } };
  const value = { ...header(8, 6), kind: "StringLiteral", text: "second", tokenFlags: [],
    tsonic: { ...typedValue(), role: "value", value: "second" } };
  const property = { ...header(6, 2), kind: "PropertyAssignment", modifiers: null, name, postfixToken: null, type: null,
    initializer: value, tsonic: { key, member: { kind: "decided", decision: { decision, getter: null, setter: null } } } };
  const checkedName = { ...header(7, 6), kind: "Identifier", text: "y",
    tsonic: { core: emptyCore(), role: "property-name", key: available(key), origins: available([provenance]) } };
  const checkedValueNode = { ...header(8, 6), kind: "StringLiteral", text: "second", tokenFlags: [],
    tsonic: { core: emptyCore(), role: "value", value: checkedValue(), literal: { kind: "string", value: "second" } } };
  const checkedProperty = { ...header(6, 2), kind: "PropertyAssignment", modifiers: null, name: checkedName,
    postfixToken: null, type: null, initializer: checkedValueNode,
    tsonic: { core: emptyCore(), key: available(key), origins: available([provenance]) } };
  typed.properties.nodes.push(property);
  original.properties.nodes.push(checkedProperty);
  const actualMember = { ...fixture.table.members[0], key, origins: [provenance], readOrigins: [provenance], writeOrigins: [provenance] };
  const table = { ...fixture.table, receiver: 2, members: [actualMember] };
  fixture.input.types.terms.push({ kind: "shape", members: [actualMember], indexes: [], calls: [], constructs: [] });
  fixture.facts.push({ instance: { body: bodyId, bindings: { kind: "parametric" } },
    occurrence: { kind: "selection", node: 6, ordinal: 0 }, table });
  bodyScopes(fixture.input, fixture.body).push(emptyScope());
  const source = fixture.input.source.tree;
  source.endOfFileToken = { ...header(9, 0), kind: "EndOfFile", tsonic: null };
  fixture.body.root.endOfFileToken = { ...header(9, 0), kind: "EndOfFile", tsonic: null };
  const first = original.properties.nodes[0];
  const nodes = new Map([source, source.endOfFileToken, source.statements.nodes[0], original, first, first.name, first.initializer,
    checkedProperty, checkedName, checkedValueNode].map(node => [node.id, node]));
  fixture.input.nodeOf = reference => reference.kind === "body" ? reference.value.body === bodyId ? nodes.get(reference.value.node) ?? null : null
    : reference.value.owner === ownerId ? nodes.get(reference.value.node) ?? null : null;
  return fixture;
}

function argumentScenario(form = "whole", passing = "by-value") {
  const body = emptyModuleBody();
  const input = emptyVerificationInput(body);
  const definition = "D[M[P[api];collections];f]";
  const items = "D[M[P[api];collections];items]";
  const nextDefinition = "D[M[P[api];collections];Iterator/next]";
  const initializerOwner = "D[M[P[api];collections];f/default]";
  const initializerBody = `B[${initializerOwner};default-argument;0]`;
  const advertised = { declaration: definition, role: "advertised", signature: 1, body: null };
  const api = { declaration: definition, role: "api-signature", signature: 1, body: null };
  const omitted = form === "empty-rest" || form === "optional" || form === "default";
  const values = form === "values";
  const tuple = form === "unknown" ? null : form === "empty" || omitted ? [] : [2, 2];
  const formal = (name, kind, type, initializer = null) => ({ declaration: `D[M[P[api];collections];f/${name}]`,
    kind, type, passing, initializer, acceptsOmission: kind !== "required" });
  const parameters = form === "whole" ? [formal("head", "required", 2), formal("tail", "rest", 4)]
    : [formal("tail", form === "optional" ? "optional" : form === "default" ? "default" : "rest",
      omitted && form !== "empty-rest" ? 2 : 4, form === "default" ? initializerBody : null)];
  const mappings = form === "whole" ? [
    { kind: "argument", parameter: 0, argument: 0, component: 0, passing },
    { kind: "rest", parameter: 1, arguments: [0], passing },
  ] : form === "optional" ? [{ kind: "omitted", parameter: 0, type: 2 }]
    : form === "default" ? [{ kind: "default", parameter: 0, initializer: initializerBody }]
      : [{ kind: "rest", parameter: 0, arguments: omitted ? [] : values ? [0, 1, 2] : [0], passing }];
  const decision = { candidate: 0, advertised, api, bindings: emptyBindings(), implementationBindings: emptyBindings(),
    parameters: mappings, completion: { signature: 1, completion: 0, yielded: null, sent: null }, result: 0, activation: null };
  const callee = { decision, activation: null };
  const originals = [];
  const pair = (kind, identity, parent, fields, checkedPhase, typedPhase) => {
    const original = { ...header(identity, parent), kind, ...fields, tsonic: checkedPhase };
    const typed = { ...header(identity, parent), kind, ...fields, tsonic: typedPhase };
    originals.push(original);
    return { original, typed };
  };
  const target = pair("Identifier", 3, 2, { text: "f" },
    { core: emptyCore(), role: "value", value: checkedValue(1), resolution: { kind: "definition", definition, aliases: [] } },
    { ...typedValue(1), role: "value", resolution: { kind: "definition", definition, aliases: [] } });
  const expression = values ? 6 : 5;
  const sourceArguments = [];
  const typedArguments = [];
  const capturedArguments = [];
  const parts = [];
  const numeric = identity => pair("NumericLiteral", identity, 2, { text: "1", tokenFlags: [] },
    { core: emptyCore(), role: "value", value: checkedValue(2),
      literal: { kind: "number", token: "1", value: { numerator: 1n, denominator: 1n, negativeZero: false } } },
    { ...typedValue(2), role: "value", value: { numerator: 1n, denominator: 1n, negativeZero: false } });
  if (values) {
    const value = numeric(4);
    sourceArguments.push(value.original);
    typedArguments.push(value.typed);
    capturedArguments.push({ kind: "value", expression: 4 });
    parts.push({ kind: "value", expression: 4 });
  }
  if (!omitted) {
    const core = emptyCore();
    core.argumentPassing = available({ role: "argument", mode: passing,
      storageExpression: { kind: "body", value: { body: bodyId, node: expression } } });
    const operand = pair("Identifier", expression, expression - 1, { text: "items" },
      { core, role: "value", value: checkedValue(5), resolution: { kind: "declarations", definitions: [items] } },
      { ...typedValue(5), role: "value", resolution: { kind: "definition", definition: items, aliases: [] } });
    const protocol = { kind: "decided", decision: { kind: "spread", asynchronous: false, steps: [],
      value: 2, completion: 0, sent: 0, thrown: 0 } };
    const spread = { ...header(expression - 1, 2), kind: "SpreadElement", expression: operand.typed,
      tsonic: { ...typedValue(5), protocol } };
    const checkedSpread = { ...header(expression - 1, 2), kind: "SpreadElement", expression: operand.original,
      tsonic: { core: emptyCore(), ...checkedValue(5), protocol: available({ kind: "spread", asynchronous: false,
        subject: expression, iterator: 5, element: 2, completion: 0, sent: 0, next: 2, finish: null, fail: null }) } };
    originals.push(checkedSpread);
    sourceArguments.push(checkedSpread);
    typedArguments.push(spread);
    capturedArguments.push({ kind: "spread", expression, tuple: available(tuple) });
    parts.push({ kind: "spread", expression, tuple });
  }
  if (values) {
    const value = numeric(7);
    sourceArguments.push(value.original);
    typedArguments.push(value.typed);
    capturedArguments.push({ kind: "value", expression: 7 });
    parts.push({ kind: "value", expression: 7 });
  }
  const instance = { body: initializerBody, bindings: { kind: "parametric" } };
  const argumentsByParameter = form === "whole" ? [{ kind: "provided", parameter: 0, expression }, { kind: "rest", parameter: 1, parts }]
    : omitted ? [{ kind: "omitted", parameter: 0, value: form === "optional" ? { kind: "absence" }
      : form === "default" ? { kind: "initializer", instance } : { kind: "empty-rest" } }]
      : [{ kind: "rest", parameter: 0, parts }];
  const application = { callee, receiver: null, arguments: argumentsByParameter };
  const captured = { kind: "call", receiver: null, arguments: capturedArguments, typeArguments: [],
    candidates: available(0), resolvedSignature: available(1) };
  const call = { ...header(2, 1), kind: "CallExpression", expression: target.typed, questionDotToken: null,
    typeArguments: null, arguments: nodeList(typedArguments),
    tsonic: { ...typedValue(), application: { kind: "decided", decision: application }, operation: null } };
  const checkedCall = { ...header(2, 1), kind: "CallExpression", expression: target.original, questionDotToken: null,
    typeArguments: null, arguments: nodeList(sourceArguments),
    tsonic: { core: emptyCore(), ...checkedValue(), application: available(captured) } };
  const statement = { ...header(1, 0), kind: "ExpressionStatement", expression: call, tsonic: null };
  const checkedStatement = { ...header(1, 0), kind: "ExpressionStatement", expression: checkedCall, tsonic: null };
  const end = omitted ? 4 : values ? 8 : 6;
  body.root.statements = nodeList([readyStatement(statement)]);
  body.root.endOfFileToken = { ...header(end, 0), kind: "EndOfFile", tsonic: null };
  input.source.tree.statements = nodeList([checkedStatement]);
  input.source.tree.endOfFileToken = { ...header(end, 0), kind: "EndOfFile", tsonic: null };
  input.source.bodies[0].candidateLists = [{ id: 0, candidates: [{ ordinal: 0, declaration: definition,
    appliedSignature: available(1), bindings: available(emptyBindings()), conditionalFailure: available(null), contributions: [] }] }];
  input.types.terms.push({ kind: "callable", calls: [1], constructs: [] }, { kind: "primitive", primitive: "int32" },
    { kind: "string" }, { kind: "array", element: 2, readonly: false }, tuple === null
      ? { kind: "array", element: 2, readonly: false }
      : { kind: "tuple", elements: tuple.map(type => ({ kind: "required", type, declaration: null })), readonly: false });
  input.types.signatures.push({ id: 1, declaration: definition, owner: { kind: "item", value: { owner: definition, node: 0 } },
    composition: null, kind: "call", typeParameters: [], receiver: null, parameters, result: 0 });
  const foreignName = { ...header(0), origin: { module: "M[P[api];collections]", start: 0, length: 0, derived: [] },
    kind: "Identifier", text: "f",
    tsonic: { core: emptyCore(), role: "declaration-name", declaration: { kind: "definition", definition } } };
  const nextName = { ...header(0), origin: foreignName.origin, kind: "Identifier", text: "next",
    tsonic: { core: emptyCore(), role: "declaration-name", declaration: { kind: "definition", definition: nextDefinition } } };
  const foreignNodes = new Map([[definition, foreignName], [nextDefinition, nextName]]);
  if (!omitted) input.types.signatures.push({ id: 2, declaration: nextDefinition,
    owner: { kind: "item", value: { owner: nextDefinition, node: 0 } }, composition: null, kind: "call",
    typeParameters: [], receiver: 5, parameters: [], result: 0 });
  const nodes = new Map([input.source.tree, checkedStatement, checkedCall, ...originals, input.source.tree.endOfFileToken].map(node => [node.id, node]));
  input.nodeOf = reference => reference.kind === "body" ? reference.value.body === bodyId ? nodes.get(reference.value.node) ?? null : null
    : reference.value.owner === ownerId ? nodes.get(reference.value.node) ?? null
      : reference.value.node === 0 ? foreignNodes.get(reference.value.owner) ?? null : null;
  input.declarationOf = selected => selected === ownerId ? { scope: emptyScope(), parameterCount: 0, endpoints: [] }
    : selected === definition ? { scope: emptyScope(), parameterCount: parameters.length, endpoints: [advertised, api] }
      : selected === items ? { scope: emptyScope(), parameterCount: 0, endpoints: [] } : null;
  replaceScopeInventory(input, [emptyScope(), emptyScope(), emptyScope(), emptyScope()]);
  if (form === "default") {
    const initializer = { ...emptyModuleBody(), body: initializerBody, owner: initializerOwner, signature: 2, completion: 2,
      root: { ...header(0), origin: foreignName.origin, kind: "NumericLiteral", text: "1", tokenFlags: [],
        tsonic: { ...typedValue(2), role: "value", value: { numerator: 1n, denominator: 1n, negativeZero: false } } } };
    const original = { ...header(0), origin: foreignName.origin, kind: "NumericLiteral", text: "1", tokenFlags: [],
      tsonic: { core: emptyCore(), role: "value", value: checkedValue(2),
        literal: { kind: "number", token: "1", value: { numerator: 1n, denominator: 1n, negativeZero: false } } } };
    const nodeOf = input.nodeOf;
    input.nodeOf = reference => reference.kind === "body" && reference.value.body === initializerBody && reference.value.node === 0
      ? original : nodeOf(reference);
    input.types.signatures.push({ id: 2, declaration: initializerOwner,
      owner: { kind: "body", value: { body: initializerBody, node: 0 } }, composition: null, kind: "call",
      typeParameters: [], receiver: null, parameters: [], result: 2 });
    const publication = [body, initializer];
    input.bodyOf = selected => publication.find(actual => actual.body === selected.body &&
      compareCaseValues(actual.bindings, selected.bindings)) ?? null;
  }
  return { body, input, call, decision, application, captured, parts, parameters, definition };
}

function expressionScenario(checked, typed, children, end, terms) {
  const body = emptyModuleBody();
  const statement = { ...header(1, 0), kind: "ExpressionStatement", expression: typed, tsonic: null };
  const originalStatement = { ...header(1, 0), kind: "ExpressionStatement", expression: checked, tsonic: null };
  const originalEnd = { ...header(end, 0), kind: "EndOfFile", tsonic: null };
  body.root.statements = nodeList([readyStatement(statement)]);
  body.root.endOfFileToken = { ...header(end, 0), kind: "EndOfFile", tsonic: null };
  const input = emptyVerificationInput(body, [originalStatement, checked, ...children, originalEnd]);
  input.source.tree.statements = nodeList([originalStatement]);
  input.source.tree.endOfFileToken = originalEnd;
  input.types.terms.push(...terms);
  return { body, input, checked, typed };
}

function conditionalScenario(disposition = "dynamic") {
  const selected = (identity, value, when) => ({ ...header(identity, 2), kind: "StringLiteral", text: value, tokenFlags: [],
    tsonic: { ...typedValue(2), role: "value", value, demand: disposition === "dynamic" || disposition === when
      ? { kind: "selected", control: 3, when } : { kind: "never", control: 3 } } });
  const whenTrue = selected(5, "yes", "true");
  const whenFalse = selected(7, "no", "false");
  const condition = { ...header(3, 2), kind: "TrueKeyword", tsonic: { ...typedValue(1), role: "value" } };
  const typed = { ...header(2, 1), kind: "ConditionalExpression", condition,
    questionToken: { ...header(4, 2), kind: "QuestionToken", tsonic: null }, whenTrue,
    colonToken: { ...header(6, 2), kind: "ColonToken", tsonic: null }, whenFalse,
    tsonic: { ...typedValue(2), selection: { kind: "conditional", control: 3, whenTrue: 5, whenFalse: 7, disposition } } };
  const checkedCondition = { ...header(3, 2), kind: "TrueKeyword",
    tsonic: { core: emptyCore(), role: "value", value: checkedValue(1) } };
  const originalValue = (identity, value) => ({ ...header(identity, 2), kind: "StringLiteral", text: value, tokenFlags: [],
    tsonic: { core: emptyCore(), role: "value", value: checkedValue(2), literal: { kind: "string", value } } });
  const checkedTrue = originalValue(5, "yes");
  const checkedFalse = originalValue(7, "no");
  const question = { ...header(4, 2), kind: "QuestionToken", tsonic: null };
  const colon = { ...header(6, 2), kind: "ColonToken", tsonic: null };
  const checked = { ...header(2, 1), kind: "ConditionalExpression", condition: checkedCondition, questionToken: question,
    whenTrue: checkedTrue, colonToken: colon, whenFalse: checkedFalse, tsonic: { core: emptyCore(), ...checkedValue(2) } };
  return expressionScenario(checked, typed, [checkedCondition, question, checkedTrue, colon, checkedFalse], 8,
    [{ kind: "primitive", primitive: "bool" }, { kind: "string" }]);
}

function operationScenario() {
  const exact = { numerator: 1n, denominator: 1n, negativeZero: false };
  const operand = { ...header(3, 2), kind: "NumericLiteral", text: "1", tokenFlags: [],
    tsonic: { ...typedValue(1), role: "value", value: exact } };
  const operation = { permissionScope: 0, decision: { kind: "selected",
    operation: { kind: "native-operator", operator: "+", carrier: "int32" }, operands: [1], result: 1, execution: { kind: "pure" } } };
  const typed = { ...header(2, 1), kind: "PrefixUnaryExpression", operator: "PlusToken", operand,
    tsonic: { ...typedValue(1), role: "value", operation: { kind: "decided", decision: operation } } };
  const checkedOperand = { ...header(3, 2), kind: "NumericLiteral", text: "1", tokenFlags: [],
    tsonic: { core: emptyCore(), role: "value", value: checkedValue(1), literal: { kind: "number", token: "1", value: exact } } };
  const checked = { ...header(2, 1), kind: "PrefixUnaryExpression", operator: "PlusToken", operand: checkedOperand,
    tsonic: { core: emptyCore(), role: "value", value: checkedValue(1) } };
  const fixture = expressionScenario(checked, typed, [checkedOperand], 4, [{ kind: "primitive", primitive: "int32" }]);
  fixture.body.scopes = [{ node: 0, parent: null, attributes: [] }];
  fixture.input.source.bodies[0].scopes = [{ node: 0, parent: null, attributes: [] }];
  return { ...fixture, operation, operand };
}

function binaryScenario(role = "arithmetic", token = "PlusToken") {
  const exact = { numerator: 1n, denominator: 1n, negativeZero: false };
  const original = identity => ({ ...header(identity, 2), kind: "NumericLiteral", text: "1", tokenFlags: [],
    tsonic: { core: emptyCore(), role: "value", value: checkedValue(1), literal: { kind: "number", token: "1", value: exact } } });
  const value = identity => ({ ...header(identity, 2), kind: "NumericLiteral", text: "1", tokenFlags: [],
    tsonic: { ...typedValue(1), role: "value", value: exact } });
  const checkedLeft = original(3);
  const checkedRight = original(5);
  const operator = { ...header(4, 2), kind: token, tsonic: null };
  const phase = { ...typedValue(1), role };
  if (role === "arithmetic" || role === "comparison") phase.operation = { kind: "decided", decision: {
    permissionScope: null, decision: { kind: "selected", operation: { kind: "native-operator", operator: "+", carrier: "int32" },
      operands: [1, 1], result: 1, execution: { kind: "pure" } } } };
  if (role === "assignment") { phase.storage = 1; phase.calculation = null; phase.selection = null; }
  if (role === "short-circuit") phase.selection = { kind: "and", control: 3, right: 5, disposition: "right" };
  const typed = { ...header(2, 1), kind: "BinaryExpression", modifiers: null, left: value(3), type: null,
    operatorToken: operator, right: value(5), tsonic: phase };
  const checked = { ...header(2, 1), kind: "BinaryExpression", modifiers: null, left: checkedLeft, type: null,
    operatorToken: operator, right: checkedRight,
    tsonic: { core: emptyCore(), value: checkedValue(1), role,
      ...(role === "assignment" ? { target: { kind: "unavailable", reason: "not-provided", causes: [] } } : {}) } };
  return expressionScenario(checked, typed, [checkedLeft, operator, checkedRight], 6, [{ kind: "primitive", primitive: "int32" }]);
}

function nestedPartScenario(holder) {
  let fixture;
  let node;
  let install;
  if (holder === "calculation") {
    fixture = binaryScenario("assignment", "PlusEqualsToken");
    node = fixture.typed;
    install = operation => { node.tsonic.calculation = { kind: "decided", decision: operation }; };
  } else if (holder === "protocol") {
    fixture = argumentScenario("empty");
    node = fixture.body.root.statements.nodes[0].node.expression.arguments.nodes[0];
    install = operation => { node.tsonic.protocol.decision.steps = [{ role: "value", operation, callee: null }]; };
  } else {
    const body = emptyModuleBody();
    node = { ...header(2, 1), kind: "VariableDeclarationList", declarations: nodeList(),
      tsonic: { role: "using", asynchronous: false, protocols: [] } };
    const checked = { ...header(2, 1), kind: "VariableDeclarationList", declarations: nodeList(),
      tsonic: { core: emptyCore(), disposal: [available({ kind: "dispose", asynchronous: false, subject: 2, signature: 0 })] } };
    const typedStatement = { ...header(1, 0), kind: "VariableStatement", modifiers: null, declarationList: node, tsonic: null };
    const checkedStatement = { ...header(1, 0), kind: "VariableStatement", modifiers: null, declarationList: checked, tsonic: null };
    const end = { ...header(3, 0), kind: "EndOfFile", tsonic: null };
    body.root.statements = nodeList([readyStatement(typedStatement)]);
    body.root.endOfFileToken = end;
    const input = emptyVerificationInput(body, [checkedStatement, checked, end]);
    input.source.tree.statements = nodeList([checkedStatement]);
    input.source.tree.endOfFileToken = end;
    fixture = { body, input };
    install = operation => { node.tsonic.protocols = [{ kind: "decided", decision: { kind: "dispose", asynchronous: false,
      steps: [{ role: "dispose", operation, callee: null }], value: 0, completion: 0, sent: null, thrown: 0 } }]; };
  }
  const key = { kind: "text", value: "x" };
  const reference = { body: bodyId, node: node.id };
  const root = { kind: "body", value: reference };
  const provenance = { kind: "mapped", owner: root, key };
  const member = { key, origins: [provenance], readOrigins: [provenance], writeOrigins: [provenance], kind: "property",
    read: 0, write: 0, optional: false, readonly: false };
  const receiver = fixture.input.types.terms.length;
  fixture.input.types.terms.push({ kind: "shape", members: [member], indexes: [], calls: [], constructs: [] });
  const decision = { key, origins: [provenance], selectedDeclarations: [], primary: null, read: 0, write: 0,
    getter: null, setter: null, bindings: emptyBindings(), location: { kind: "data", check: { kind: "none" }, receiver: "in-place" } };
  const part = { part: 0, source: reference, destination: { root, path: [] }, member: decision, embedding: { kind: "identity" } };
  const operation = { permissionScope: null, decision: { kind: "selected",
    operation: { kind: "object-construction", parts: [part] }, operands: [], result: holder === "calculation" ? 1 : receiver, execution: { kind: "pure" } } };
  install(operation);
  const table = { receiver, members: [member], indexes: [], calls: [], constructs: [], accessors: [], constructors: [],
    completeness: { kind: "complete" } };
  const fact = { instance: { body: bodyId, bindings: { kind: "parametric" } }, occurrence: { kind: "construction-part",
    node: node.id, ordinal: 0, source: reference, destination: { root, path: [] }, part: 0 }, table };
  const queries = [];
  fixture.input.memberTableOf = (instance, occurrence) => {
    queries.push({ instance, occurrence });
    return isDeepStrictEqual(instance, fact.instance) && isDeepStrictEqual(occurrence, fact.occurrence) ? fact.table : null;
  };
  bodyScopes(fixture.input, fixture.body).push(emptyScope());
  return { ...fixture, node, fact, queries };
}

const valueFact = typedValue;
const valueWire = "type=t:0, convertedType=t:0, conversion=identity(), narrowing=null, evidenceIndex=null, demand=always()";
const headerWire = 'id=n:0, origin=Origin(module=mod:"M[P[p];m]", start=0, length=0, derived=[]), parent=null, flags=[], loc=TextRange(pos=0, end=0)';
const localWire = `LocalRef(body=body:"${bodyId}", local=l:0)`;
const syntaxHeaderWire = (identity, parent, flags = []) => `id=n:${identity}, origin=Origin(module=mod:"${moduleId}", start=0, length=0, derived=[]), ` +
  `parent=${parent === null ? "null" : `n:${parent}`}, flags=${JSON.stringify(flags)}, loc=TextRange(pos=0, end=0)`;
const fullCodecHeader = (identity, parent = null) => ({ ...header(identity, parent), flags: ["Ambient"] });
const fullCodecHeaderWire = (identity, parent) => syntaxHeaderWire(identity, parent, ["Ambient"]);
const fullCodecValue = (type = 0) => ({ ...typedValue(type), narrowing: { kind: "identity", type }, evidenceIndex: 0 });

function assertBodyRoundTrip(body, expected, name) {
  assertCompleteValue(product.printTir(body), expected, `${name} complete independently authored wire`, sameWire);
  const parsed = product.parseTir(expected);
  assert.equal(parsed.kind, "parsed");
  assertCompleteValue(parsed.value, body, `${name} complete independently authored value`, compareCaseValues);
}

function openTypedWire(bodyHeader) {
  return `${bodyHeader}\nCheckedDeclarations()\nTypedDeclarations(\n`;
}

function typedWire(bodyHeader, definitions) {
  return openTypedWire(bodyHeader) + definitions.join("\n") + "\n)\n";
}

function syntaxPayloadCase(payload, definitions) {
  const body = emptyModuleBody();
  const last = definitions.length + 4;
  const tagName = { ...header(3, 2), kind: "Identifier", text: "type",
    tsonic: { role: "property-name", key: { kind: "text", value: "type" } } };
  const tag = { ...header(2, 1), kind: "JSDocTypeTag", tagName, comment: null, typeExpression: payload, tsonic: null };
  const type = { ...header(1, 0), kind: "JSDocTypeLiteral", jsDocPropertyTags: [tag], isArrayType: false, tsonic: null };
  const expression = { ...header(last, 0), kind: "Identifier", text: "value",
    tsonic: { ...typedValue(), role: "value", resolution: { kind: "definition", definition: ownerId, aliases: [] } } };
  body.root = { ...header(0), kind: "TypeAssertionExpression", type, expression, tsonic: typedValue() };
  const expected = typedWire(readFileSync(resolve(repository, functionDirectory, "empty-module.input.tir"), "utf8").split("\n")[0], [
    `n:0=TypeAssertionExpression(${syntaxHeaderWire(0, null)}, type=n:1, expression=n:${last}, tsonic=TypedValue(${valueWire}))`,
    `n:1=JSDocTypeLiteral(${syntaxHeaderWire(1, 0)}, jsDocPropertyTags=[n:2], isArrayType=false, tsonic=null)`,
    `n:2=JSDocTypeTag(${syntaxHeaderWire(2, 1)}, tagName=n:3, comment=null, typeExpression=n:4, tsonic=null)`,
    `n:3=Identifier(${syntaxHeaderWire(3, 2)}, text="type", tsonic=TypedName(role="property-name", key=text(value="type")))`,
    ...definitions.map((definition, position) => `n:${position + 4}=${definition}`),
    `n:${last}=Identifier(${syntaxHeaderWire(last, 0)}, text="value", tsonic=TypedName(${valueWire}, role="value", ` +
      `resolution=definition(definition=def:"${ownerId}", aliases=[])))`,
  ]);
  return { body, expected };
}

function assertSyntaxPayload(payload, definitions, name) {
  const { body, expected } = syntaxPayloadCase(payload, definitions);
  assertBodyRoundTrip(body, expected, name);
}

function assertExpressionRoundTrip(kind, fields, fieldsWire, phase, phaseWire) {
  const body = emptyModuleBody();
  body.root = { ...header(0), kind, ...fields, tsonic: phase };
  const bodyHeader = readFileSync(resolve(repository, functionDirectory, "empty-module.input.tir"), "utf8").split("\n")[0];
  const expected = typedWire(bodyHeader, [`n:0=${kind}(${headerWire}${fieldsWire.length === 0 ? "" : `, ${fieldsWire}`}, tsonic=${phaseWire})`]);
  assertCompleteValue(product.printTir(body), expected, `${kind} complete independently authored spelling`, sameWire);
  const parsed = product.parseTir(expected);
  assert.equal(parsed.kind, "parsed");
  assertCompleteValue(parsed.value, body, `${kind} complete declared value, not only selected fields`, compareCaseValues);
}

for (const path of [...functionCases, ...verifierCases]) {
  test(`ir-tir authored case ${basename(path, ".case.json")}`, async () => {
    const result = await runCase({ modules: ["ir-tir"],
      evidenceDirectory: resolve(repository, ".temp/host-case-evidence"),
      canonical: path => relative(repository, realpathSync(resolve(repository, path))).split("\\").join("/"),
      readText: path => readFileSync(resolve(repository, path), "utf8"), list: path => readdirSync(resolve(repository, path)),
      decode: (text, format) => { assert.equal(format, "json"); return JSON.parse(text); },
      adapters: { function: input => {
        assert.equal(input.format, "tir");
        return { kind: "accepted", value: product.parseTir(input.text), diagnostics: [] };
      }, verifier: input => {
        assert.equal(input.format, "tir");
        const parsed = product.parseTir(input.text);
        assert.equal(parsed.kind, "parsed", "verifier input is independently authored and schema-valid");
        return { kind: "accepted", value: verifyBody(emptyVerificationInput(parsed.value), parsed.value), diagnostics: [] };
      } },
    }, path);
    assert.equal(result.status, "passed", JSON.stringify(result.status === "failed" ? result : { path }));
  });
}
test("exact annotated runtime ports include the owning operation projection and retire the second binding walk", () => {
  assertCompleteValue(Object.keys(product).sort(), ["admitFormalInitializer", "bodyOccurrenceSlots", "chapterStatementSyntax", "chapterSyntaxSlots", "chapterTransportSlots",
    "formalInitializerSlot", "formalInitializerSyntax", "indexChapterSyntax", "isLayoutOperandBody", "layoutArgumentSlots", "layoutBindingOf", "layoutObservationOf", "memberSelectionKey", "parseTir", "printTir", "rawValueTypeOf", "readChapterSyntaxSlot", "tirBodySyntaxOf",
    "tirOperationsOf", "verifyTir", "verifyTirModule"]);
});

test("operation projection retains the actual ready body domain", () => {
  const body = emptyModuleBody();
  const input = emptyVerificationInput(body);
  const instance = { body: body.body, bindings: body.bindings };
  assertCompleteValue(product.tirOperationsOf(input, instance), []);
  input.bodyOf = () => null;
  assert.throws(() => product.tirOperationsOf(input, instance), TypeError);
  const operation = operationScenario();
  const rows = product.tirOperationsOf(operation.input, { body: operation.body.body, bindings: operation.body.bindings });
  assert.equal(rows.length > 0, true);
  assert.equal(rows.every(row => row.node.body === operation.body.body && row.origin.module === moduleId), true);
});

test("the paid verification scope visitor stops before subsequent binding roles and never visits a foreign subject", () => {
  const body = emptyModuleBody();
  const foreign = { ...body };
  const original = { reason: "original scope refusal" };
  const run = (subject, maximum, consumerCut = false) => {
    const input = emptyVerificationInput(body);
    const supplied = input.bindingScopesOf;
    const roles = [];
    const rolePositions = [];
    let visited = 0;
    let active = false;
    input.bindingScopesOf = (target, candidate, visit) => {
      if (candidate !== body) return completeScopes(null);
      assert.notEqual(visit, null);
      active = true;
      const stop = visit(owner => {
        roles.push(owner);
        rolePositions.push(visited);
        return consumerCut ? original : null;
      });
      active = false;
      return stop === null ? supplied(target, candidate, visit) : { kind: "resource-stop", stop };
    };
    const result = product.verifyTir(input, request => {
      if (!active) return null;
      assert.equal(request.kind, "row");
      return ++visited > maximum ? original : null;
    })(subject);
    return { result, roles, rolePositions, visited };
  };
  const full = run(body, Infinity);
  assertCompleteValue(full.result, { kind: "complete", violations: [] });
  assert.equal(full.roles.length, 2);
  assert.equal(full.rolePositions[0] < full.rolePositions[1], true);
  const exact = run(body, full.visited);
  assertCompleteValue(exact, full);
  for (let maximum = 0; maximum < full.visited; maximum += 1) {
    const cut = run(body, maximum);
    assert.equal(cut.result.kind, "resource-stop");
    assert.equal(cut.result.stop === original, true);
    assert.equal(cut.visited, maximum + 1);
    assertCompleteValue(cut.rolePositions, full.rolePositions.filter(position => position <= maximum));
  }
  const consumer = run(body, Infinity, true);
  assert.equal(consumer.result.stop === original && consumer.visited === full.rolePositions[0], true);
  assertCompleteValue(consumer.roles, full.roles.slice(0, 1));
  const rejected = run(foreign, 0);
  assert.equal(rejected.visited, 0);
  assert.equal(rejected.result.violations.some(finding => finding.rule === "binding-vector-complete"), true);
});

test("body and chapter paid readers preserve the original refusal at every reached boundary", async () => {
  const fixture = await loadFrontFixture();
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../packages/host/dist/pipeline/typed-barrier.js");
  const { createAccount } = await import("../../packages/host/dist/dataflow/index.js");
  const input = analysisInput(fixture, "sdk-minimal", `
    function callee(value: boolean = true): boolean { return value; }
    export function supplied(value: boolean): boolean { return callee(value); }
    export function omitted(): boolean { return callee(); }
  `);
  const source = captureSourceBarrier(input);
  assert.equal(source.kind, "ok");
  const typed = typeSourceBarrier(input, source.value, createAccount(input.limits.dataflow));
  assert.equal(typed.kind, "ok");
  const empty = [...typed.value.modules.values()].find(module => module.tree.kind === "checked-root");
  assert.ok(empty);
  assert.equal(empty.bodies.length, 0);
  const independent = typed.value.verifierOf(empty.module);
  assert.ok(independent);
  assert.deepEqual(verifyChapter(independent, empty), []);
  assert.deepEqual(checkTirVerifierAdmissionCuts(admitFixtureRead, product.verifyTirModule, independent, empty), ["bodyOf", "bindingScopesOf"]);
  const ready = typed.value.modules.get(input.snapshot.entryPoint);
  const readyEvidence = typed.value.verifierOf(input.snapshot.entryPoint);
  assert.equal(ready.tree.kind, "ready-root");
  assert.ok(readyEvidence);
  for (const name of ["supplied", "omitted"]) {
    const callable = ready.tree.root.statements.nodes.find(slot =>
      slot.kind === "ready-callable" && slot.node.name.text === name).node;
    const actual = ready.bodies.find(body => body.body === callable.tsonic.signatures[0].body && body.bindings.kind === "instantiated");
    assert.ok(actual);
    assert.deepEqual(verifyBody(readyEvidence, actual), []);
    const reads = checkTirBodyAdmissionCuts(admitFixtureRead, product.verifyTir, readyEvidence, actual);
    assert.equal(reads.includes("bodyOf"), true);
  }
  const member = memberScenario("construction");
  assert.deepEqual(verifyBody(member.input, member.body), []);
  assert.equal(checkTirBodyAdmissionCuts(admitFixtureRead, product.verifyTir, member.input, member.body).includes("memberTableOf"), true);
});

test("normal TIR verification rejects a crossed throw parenthesis and selected application endpoint", async () => {
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../packages/host/dist/pipeline/typed-barrier.js");
  const { createAccount } = await import("../../packages/host/dist/dataflow/index.js");
  const fixture = await loadFrontFixture();
  const source = analysisInput(fixture, "sdk-minimal", `
    function effect(): void { return; }
    function value(): boolean { return true; }
    export function explicit(): void { throw (void effect()); }
    export function ordinary(): void { throw ((value())); }`);
  const checked = captureSourceBarrier(source);
  assert.equal(checked.kind, "ok");
  const typed = typeSourceBarrier(source, checked.value, createAccount(source.limits.dataflow));
  assert.equal(typed.kind, "ok");
  const input = typed.value.verifierOf(source.snapshot.entryPoint);
  const selected = input.module.bodies.filter(body => body.bindings.kind === "instantiated" && body.root.kind === "Block");
  const explicit = selected.find(body => body.root.statements.nodes[0]?.expression?.expression?.kind === "VoidExpression");
  const ordinary = selected.find(body => body.root.statements.nodes[0]?.expression?.expression?.kind === "ParenthesizedExpression");
  const voidCall = explicit.root.statements.nodes[0].expression.expression.expression;
  assert.deepEqual(verifyBody(input, explicit), []);
  assert.deepEqual(verifyBody(input, ordinary), []);
  checkTirBodyAdmissionCuts(admitFixtureRead, product.verifyTir, input, ordinary);
  for (const [crossing, detail] of [
    ["parenthesis", "a throw parenthesis does not retain its actual child value endpoint"],
    ["application", "a throw must retain its actual selected operand endpoint"],
    ["effect-only", "a throw operand cannot be an effect-only completion"],
  ]) {
    const forged = structuredClone(ordinary);
    const statement = forged.root.statements.nodes[0];
    const outer = statement.expression;
    const inner = outer.expression;
    const operand = inner.expression;
    if (crossing === "parenthesis") inner.tsonic.type = inner.tsonic.convertedType = voidCall.tsonic.type;
    else {
      operand.tsonic.application.decision.callee.decision.result = voidCall.tsonic.type;
      if (crossing === "effect-only") for (const occurrence of [outer, inner, operand])
        occurrence.tsonic.type = occurrence.tsonic.convertedType = voidCall.tsonic.type;
    }
    const violations = verifyBody(input, forged);
    assert.equal(violations.some(row => row.rule === "operation-type" && row.site.node === statement.id
      && row.detail[0]?.value === detail), true, crossing);
  }
});

test("actual wide typed modules admit one independent membership vector and exactly one key per checked body", async () => {
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../packages/host/dist/pipeline/typed-barrier.js");
  const { publicationMembership } = await import("../../packages/host/dist/ir-tir/verify-instances.js");
  const { tirReadyReadAdmission } = await import("../../packages/host/dist/ir-program/index.js");
  const { accountFailure, createAccount, refuseAccount } = await import("../../packages/host/dist/dataflow/index.js");
  const { InvocationAccount } = await import("../../packages/host/dist/dataflow/account.js");
  const fixture = await loadFrontFixture();
  for (const count of [4, 16, 64]) {
    const text = Array.from({ length: count }, (_, ordinal) =>
      `export function f${ordinal.toString().padStart(2, "0")}(value: boolean): boolean { return value; }`).join("\n");
    const source = analysisInput(fixture, "sdk-minimal", text);
    const checked = captureSourceBarrier(source);
    assert.equal(checked.kind, "ok");
    const typed = typeSourceBarrier(source, checked.value, createAccount(source.limits.dataflow));
    assert.equal(typed.kind, "ok", `width ${count}`);
    const input = typed.value.verifierOf(source.snapshot.entryPoint);
    const bodies = input.module.bodies;
    assert.equal(bodies.length, 2 * (count + 1));
    assert.equal(bodies.every(body => body.bindings.kind === "parametric" ||
      Object.values(body.bindings.bindings).every(family => family.length === 0)), true);
    assert.equal(new Set(bodies.map(body => body.body)).size, count + 1);
    const rowWork = body => 2 + body.body.length + (body.bindings.kind === "parametric" ? 0 : 1);
    const keyEntries = body => body.bindings.kind === "parametric" ? 1 : 6;
    const vectorWork = bodies.reduce((total, body) => total + rowWork(body), 0);
    const vectorEntries = bodies.reduce((total, body) => total + keyEntries(body), 0);
    const limits = { maximumWork: 2 * vectorWork, maximumResultEntries: 1 + bodies.length + 2 * vectorEntries };
    function run(allowance, subjects = bodies) {
      const reads = [];
      const findings = [];
      const inventory = new Proxy(bodies, { get(rows, property) {
        if (typeof property === "string" && /^\d+$/u.test(property)) reads.push(Number(property));
        return Reflect.get(rows, property);
      } });
      const account = createAccount(allowance);
      const observe = { ...input, module: { ...input.module, bodies: inventory } };
      const membership = publicationMembership(observe, tirReadyReadAdmission(account));
      assert.deepEqual(reads, []);
      let stop = null;
      for (const body of subjects) {
        stop = membership(body, rule => findings.push(rule));
        if (stop !== null) break;
      }
      const { work, entries } = InvocationAccount.stateOf(account);
      return { reads, stop, findings, work, entries, account };
    }
    const exact = run(limits);
    assert.equal(exact.stop, null);
    assert.deepEqual(exact.findings, []);
    assert.equal(exact.work, limits.maximumWork);
    assert.equal(exact.entries, limits.maximumResultEntries);
    assert.deepEqual(exact.reads, bodies.map((_, ordinal) => ordinal));
    let work = 0;
    let entries = 1;
    for (const [position, body] of bodies.entries()) {
      const beforeRow = run({ ...limits, maximumWork: work });
      assert.equal(beforeRow.stop === accountFailure(beforeRow.account), true);
      assert.notEqual(beforeRow.stop, null);
      assert.deepEqual(beforeRow.reads, exact.reads.slice(0, position));
      const beforeRetain = run({ ...limits, maximumResultEntries: entries + keyEntries(body) });
      assert.equal(beforeRetain.stop === accountFailure(beforeRetain.account), true);
      assert.notEqual(beforeRetain.stop, null);
      assert.deepEqual(beforeRetain.reads, exact.reads.slice(0, position + 1));
      work += rowWork(body);
      entries += keyEntries(body) + 1;
    }
    assert.deepEqual(run({ ...limits, maximumResultEntries: 0 }).reads, []);
    for (const field of ["maximumWork", "maximumResultEntries"]) {
      const missing = run({ ...limits, [field]: limits[field] - 1 });
      assert.equal(missing.stop === accountFailure(missing.account), true);
      assert.notEqual(missing.stop, null);
      assert.deepEqual(missing.reads, exact.reads);
    }
    const crossed = run(limits, [{ ...bodies[0] }]);
    assert.equal(crossed.stop, null);
    assert.deepEqual(crossed.findings, ["template-shared-once"]);
    const stopped = createAccount(limits);
    const original = refuseAccount(stopped, { kind: "refused", diagnostics: [] });
    const unread = new Proxy({}, { get() { assert.fail("No verification input is opened after the original stop."); } });
    const verify = product.verifyTir(unread, tirReadyReadAdmission(stopped));
    assert.equal(verify(unread).stop === original, true);
  }
});

test("nonexecuting declaration-name payloads have one exact syntax-only codec across expression slots", () => {
  const marker = { role: "declaration-name-expression" };
  const wire = 'DeclarationNameExpression(role="declaration-name-expression")';
  assertExpressionRoundTrip("Identifier", { text: "key" }, 'text="key"', marker, wire);
  assertExpressionRoundTrip("StringLiteral", { text: "key", tokenFlags: [] }, 'text="key", tokenFlags=[]', marker, wire);
  assertExpressionRoundTrip("NumericLiteral", { text: "1", tokenFlags: [] }, 'text="1", tokenFlags=[]', marker, wire);
  const body = emptyModuleBody();
  const expression = { ...header(1, 0), kind: "Identifier", text: "source", tsonic: marker };
  const name = { ...header(2, 0), kind: "Identifier", text: "key", tsonic: marker };
  body.root = { ...header(0), kind: "PropertyAccessExpression", expression, questionDotToken: null, name, tsonic: marker };
  const expected = typedWire(readFileSync(resolve(repository, functionDirectory, "empty-module.input.tir"), "utf8").split("\n")[0], [
    `n:0=PropertyAccessExpression(${headerWire}, expression=n:1, questionDotToken=null, name=n:2, tsonic=${wire})`,
    `n:1=Identifier(${syntaxHeaderWire(1, 0)}, text="source", tsonic=${wire})`,
    `n:2=Identifier(${syntaxHeaderWire(2, 0)}, text="key", tsonic=${wire})`,
  ]);
  assertBodyRoundTrip(body, expected, "one nonexecuting member-name payload");
  const wrapper = emptyModuleBody();
  wrapper.root = { ...header(0), kind: "ParenthesizedExpression", expression, tsonic: marker };
  const wrapperWire = typedWire(expected.split("\n")[0], [
    `n:0=ParenthesizedExpression(${headerWire}, expression=n:1, tsonic=${wire})`,
    `n:1=Identifier(${syntaxHeaderWire(1, 0)}, text="source", tsonic=${wire})`,
  ]);
  assertBodyRoundTrip(wrapper, wrapperWire, "parenthesized syntax retains the same nonexecuting marker");
});

test("a call-shaped declaration key carries syntax only and publishes no checked runtime call", checkCallShapedComputedDeclarationName);

test("the declaration-name owner compares the exact original key and cause relation without authorizing other contexts", async () => {
  const { verifyDeclarationNames } = await import("../../packages/host/dist/ir-tir/verify-instances.js");
  const fixture = key => {
    const expression = { ...header(2, 1), kind: "Identifier", text: "key", tsonic: { role: "declaration-name-expression" } };
    const name = { ...header(1, 0), kind: "ComputedPropertyName", expression, tsonic: { kind: "declaration", key } };
    const parent = { ...header(0), kind: "PropertySignature", modifiers: null, name, postfixToken: null, type: null,
      initializer: null, tsonic: { definition: ownerId, storage: 0, initializer: null, attributes: [] } };
    const checkedExpression = { ...expression, tsonic: { core: emptyCore(), role: "value", value: checkedValue(),
      resolution: { kind: "definition", definition: ownerId, aliases: [] } } };
    const checkedName = { ...name, expression: checkedExpression, tsonic: { core: emptyCore(), key } };
    const checkedParent = { ...parent, name: checkedName, tsonic: { core: emptyCore(), parent: null, attributes: [],
      memory: available(null), declaration: { kind: "definition", definition: ownerId }, declaredType: available(0), inferredTypeBound: null, initializer: null } };
    const nodes = [parent, name, expression];
    const originals = new Map([checkedParent, checkedName, checkedExpression].map(node => [node.id, node]));
    const findings = [];
    const verify = () => {
      findings.length = 0;
      verifyDeclarationNames(nodes, originals, (rule, node, detail) => findings.push({ rule, node: node.id, detail }));
      return findings;
    };
    return { parent, name, expression, checkedParent, checkedName, nodes, originals, verify };
  };
  const number = { kind: "number", value: { numerator: 0n, denominator: 1n, negativeZero: false } };
  const keys = [{ kind: "text", value: "" }, { kind: "symbol", declaration: ownerId }, number];
  for (const key of keys) {
    const current = fixture(available(key));
    assert.deepEqual(current.verify(), []);
    for (const other of keys.filter(candidate => candidate !== key)) {
      current.name.tsonic.key = available(other);
      assert.equal(current.verify().some(finding => finding.rule === "occurrence-role"), true);
    }
    current.name.tsonic.key = available(key.kind === "text" ? { ...key, value: "other" }
      : key.kind === "symbol" ? { ...key, declaration: "D[M[P[p];m];other]" }
        : { ...key, value: { ...key.value, negativeZero: true } });
    assert.equal(current.verify().some(finding => finding.rule === "occurrence-role"), true);
  }
  const causes = capturedCauses(moduleId, ownerId, bodyId);
  const original = { kind: "unavailable", reason: "checker-error", causes };
  const unavailable = fixture(original);
  assert.deepEqual(unavailable.verify(), []);
  for (const changed of [
    { ...original, reason: "not-provided" }, { ...original, causes: [] },
    { ...original, causes: [...causes].reverse() }, { ...original, causes: new Array(causes.length) }, available(keys[0]),
  ]) {
    unavailable.name.tsonic.key = changed;
    assert.equal(unavailable.verify().some(finding => finding.rule === "occurrence-role"), true);
  }
  for (const change of ["missing", "kind", "parent-null", "parent-missing", "parent-kind", "checked-name", "typed-name", "typed-parent", "id"]) {
    const current = fixture(available(keys[0]));
    if (change === "missing") current.originals.delete(current.name.id);
    if (change === "kind") current.checkedName.kind = "Identifier";
    if (change === "parent-null") current.checkedName.parent = null;
    if (change === "parent-missing") current.originals.delete(current.checkedParent.id);
    if (change === "parent-kind") current.checkedParent.kind = "PropertyDeclaration";
    if (change === "checked-name") current.checkedParent.name = current.expression;
    if (change === "typed-name") current.parent.name = current.expression;
    if (change === "typed-parent") current.name.parent = null;
    if (change === "id") current.checkedParent.id = 99;
    assert.equal(current.verify().some(finding => finding.rule === "occurrence-role"), true, change);
  }
  for (const payload of [null, { type: 0 }, typedValue()]) {
    const current = fixture(available(keys[0]));
    current.expression.tsonic = payload;
    assert.equal(current.verify().length !== 0, payload !== null);
  }
  const orphan = fixture(available(keys[0]));
  orphan.name.tsonic = { kind: "constant", key: keys[0] };
  assert.equal(orphan.verify().some(finding => finding.rule === "occurrence-role"), true);
  const repeated = fixture(available(keys[0]));
  const shared = { ...header(3, 2), kind: "Identifier", text: "key", tsonic: { role: "declaration-name-expression" } };
  Object.assign(repeated.expression, { kind: "PropertyAccessExpression", expression: shared, name: shared, questionDotToken: null });
  repeated.nodes.push(shared);
  assert.deepEqual(repeated.verify(), [], "the key-role relation visits shared syntax once; structural identity remains the structure verifier's obligation");
});

test("an executing parameter never borrows the bodyless absence of a local or passing decision", () => {
  for (const field of ["local", "passing"]) {
    const fixture = genericFunctionScenario();
    const body = fixture.functionTemplate;
    const input = fixture.inputFor(body);
    assertCompleteValue(verifyBody(input, body), []);
    body.params[0].tsonic[field] = null;
    assert.equal(verifyBody(input, body).some(finding => finding.rule === "parameter-order"), true, field);
  }
});

test("bodyless parameter verification retains the exact checked formal, selected endpoint and separate receiver", async () => {
  const { verifyBodylessParameters } = await import("../../packages/host/dist/ir-tir/verify-instances.js");
  const fixture = () => {
    const current = nestedDeclarationScenario(false);
    const parent = current.body.root.statements.nodes[0].node;
    const checked = current.input.source.tree.statements.nodes[0];
    const parameter = parent.parameters.nodes[0];
    const original = checked.parameters.nodes[0];
    parent.body = null;
    parent.tsonic.template = null;
    checked.body = null;
    checked.tsonic.body = null;
    checked.tsonic.signatures = checked.tsonic.signatures.map(endpoint => ({ ...endpoint, body: null }));
    parameter.tsonic.local = null;
    original.tsonic.declaration = { kind: "definition", definition: parameter.tsonic.declaration };
    const originals = new Map([[parent.id, checked], [parameter.id, original]]);
    const findings = [];
    const verify = () => {
      findings.length = 0;
      verifyBodylessParameters(current.input, [parent], originals, (rule, node, detail) => findings.push({ rule, node: node.id, detail }));
      return findings;
    };
    return { ...current, parent, checked, parameter, original, originals, signature: current.input.types.signatures[1], verify };
  };
  assert.deepEqual(fixture().verify(), []);
  for (const change of ["no-endpoint", "signature", "signature-owner", "formal-owner", "formal-type", "passing", "role", "formal-initializer",
    "missing-header", "foreign-header", "checked-owner", "checked-local", "checked-initializer", "initializer", "unavailable-type", "null-type", "local", "null-passing", "extra-formal"]) {
    const current = fixture();
    if (change === "no-endpoint") current.checked.tsonic.signatures = [];
    if (change === "signature") current.input.types.signatures[1] = undefined;
    if (change === "signature-owner") current.signature.declaration = ownerId;
    if (change === "formal-owner") current.signature.parameters[0].declaration = ownerId;
    if (change === "formal-type") current.signature.parameters[0].type = 0;
    if (change === "passing") current.signature.parameters[0].passing = "move";
    if (change === "role") current.signature.parameters[0].kind = "optional";
    if (change === "formal-initializer") current.signature.parameters[0].initializer = bodyId;
    if (change === "missing-header") current.checked.parameters.nodes = [];
    if (change === "foreign-header") current.parameter.id = 99;
    if (change === "checked-owner") current.original.tsonic.parent = ownerId;
    if (change === "checked-local") current.original.tsonic.declaration = { kind: "local", local: { body: bodyId, local: 0 } };
    if (change === "checked-initializer") current.original.tsonic.initializer = bodyId;
    if (change === "initializer") current.parameter.initializer = current.parameter.name;
    if (change === "unavailable-type") current.original.tsonic.declaredType = { kind: "unavailable", reason: "not-provided", causes: [] };
    if (change === "null-type") current.original.tsonic.declaredType = available(null);
    if (change === "local") current.parameter.tsonic.local = { body: bodyId, local: 0 };
    if (change === "null-passing") current.parameter.tsonic.passing = null;
    if (change === "extra-formal") current.signature.parameters.push(current.signature.parameters[0]);
    assert.equal(current.verify().some(finding => finding.rule === "parameter-order"), true, change);
  }
  const receiver = fixture();
  receiver.parameter.tsonic.role = "this";
  receiver.signature.receiver = receiver.parameter.tsonic.storage;
  receiver.signature.parameters = [];
  assert.deepEqual(receiver.verify(), []);
  receiver.signature.receiver = 0;
  assert.equal(receiver.verify().some(finding => finding.rule === "parameter-order"), true);
  const uncomputed = fixture();
  uncomputed.originals.delete(uncomputed.parent.id);
  assert.deepEqual(uncomputed.verify(), []);
});

test("the member selection key separates two selections that differ in any one field, and is total over lists with holes", () => {
  const owner = "D[M[P[p];m];owner]";
  const other = "D[M[P[p];m];other]";
  const body = "B[D[M[P[p];m];owner];function;0]";
  const endpoint = { declaration: owner, role: "advertised", signature: 0, body };
  const rigid = { kind: "rigid", parameter: typeParameterDeclaration(owner, 0) };
  const vector = changes => ({ classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [], ...changes });
  const callee = { decision: { candidate: 0, advertised: endpoint, api: { ...endpoint, role: "api-body" }, bindings: vector({}),
    implementationBindings: vector({}), parameters: [{ kind: "argument", parameter: 0, argument: 0, component: null, passing: "by-value" }],
    completion: { signature: 0, completion: 0, yielded: null, sent: null }, result: 0, activation: null },
  activation: null };
  const base = { decision: { key: { kind: "text", value: "x" }, origins: [{ kind: "declared", declaration: owner }],
    selectedDeclarations: [owner], primary: owner, read: 0, write: 0, getter: null, setter: null, bindings: vector({}),
    location: { kind: "data", check: { kind: "none" }, receiver: "in-place" } }, getter: callee, setter: null };
  const decisionChanges = [
    { key: { kind: "text", value: "y" } }, { key: { kind: "symbol", declaration: owner } },
    { key: { kind: "number", value: { numerator: 0n, denominator: 1n, negativeZero: false } } },
    { key: { kind: "number", value: { numerator: 0n, denominator: 1n, negativeZero: true } } },
    { origins: [] }, { origins: [{ kind: "declared", declaration: other }] }, { origins: [{ kind: "class-prototype", owner }] },
    { origins: [{ kind: "mapped", owner: { kind: "body", value: { body, node: 0 } }, key: { kind: "text", value: "x" } }] },
    { origins: [{ kind: "mapped", owner: { kind: "item", value: { owner, node: 0 } }, key: { kind: "text", value: "x" } }] },
    { selectedDeclarations: [] }, { selectedDeclarations: [other] }, { primary: null }, { read: null }, { read: 1 }, { write: null }, { write: 1 },
    { getter: endpoint }, { setter: endpoint }, { bindings: vector({ classBindings: [rigid] }) }, { bindings: vector({ methodBindings: [rigid] }) },
    { bindings: vector({ capturedBindings: [rigid] }) }, { bindings: vector({ selfBindings: [{ kind: "rigid", owner }] }) },
    { location: { kind: "accessor" } }, { location: { kind: "data", check: { kind: "none" }, receiver: "by-reference" } },
    { location: { kind: "data", check: { kind: "required", failure: "unwind" }, receiver: "in-place" } },
    { location: { kind: "data", check: { kind: "required", failure: "abort" }, receiver: "in-place" } },
  ];
  const calleeDecisionChanges = [
    { candidate: 1 }, { advertised: { ...endpoint, signature: 1 } }, { advertised: { ...endpoint, declaration: other } },
    { api: { ...endpoint, role: "api-signature" } }, { api: { ...endpoint, role: "api-body", body: null } },
    { bindings: vector({ classBindings: [rigid] }) }, { implementationBindings: vector({ classBindings: [rigid] }) }, { parameters: [] },
    { parameters: [{ kind: "argument", parameter: 0, argument: 0, component: 0, passing: "by-value" }] },
    { parameters: [{ kind: "argument", parameter: 0, argument: 0, component: null, passing: "move" }] },
    { parameters: [{ kind: "default", parameter: 0, initializer: body }] }, { parameters: [{ kind: "omitted", parameter: 0, type: 0 }] },
    { parameters: [{ kind: "rest", parameter: 0, arguments: [0], passing: "by-value" }] },
    { parameters: [{ kind: "rest", parameter: 0, arguments: [0, 1], passing: "by-value" }] },
    { completion: { signature: 1, completion: 0, yielded: null, sent: null } }, { completion: { signature: 0, completion: 1, yielded: null, sent: null } },
    { completion: { signature: 0, completion: 0, yielded: 0, sent: null } }, { completion: { signature: 0, completion: 0, yielded: null, sent: 0 } },
    { result: 1 }, { activation: "at-creation" }, { activation: "when-first-driven" },
  ];
  const calleeChanges = [
    { activation: { body, bindings: { kind: "parametric" } } }, { activation: { body, bindings: { kind: "instantiated", bindings: vector({}) } } },
    { activation: { body, bindings: { kind: "instantiated", bindings: vector({ classBindings: [rigid] }) } } },
  ];
  const variants = [
    ...decisionChanges.map(change => ({ ...base, decision: { ...base.decision, ...change } })),
    ...calleeDecisionChanges.map(change => ({ ...base, getter: { ...callee, decision: { ...callee.decision, ...change } } })),
    ...calleeChanges.map(change => ({ ...base, getter: { ...callee, ...change } })),
    { ...base, getter: null }, { ...base, setter: callee }, { ...base, getter: null, setter: callee },
  ];
  const keys = [base, ...variants].map(member => JSON.stringify(product.memberSelectionKey(member),
    (_name, value) => typeof value === "bigint" ? `${value}n` : value));
  assert.equal(new Set(keys).size, keys.length, "every one-field change gives a different key");
  assert.equal(keys.length, 1 + decisionChanges.length + calleeDecisionChanges.length + calleeChanges.length + 3);
  assertCompleteValue(product.memberSelectionKey(structuredClone(base)), product.memberSelectionKey(base));
  const holes = structuredClone(base);
  holes.decision.origins = new Array(2);
  holes.decision.selectedDeclarations = new Array(1);
  holes.getter.decision.parameters = [undefined, { kind: "rest", parameter: 0, arguments: new Array(1), passing: "by-value" }];
  holes.getter.decision.bindings = vector({ classBindings: new Array(1) });
  const holed = product.memberSelectionKey(holes);
  assertCompleteValue(holed[0][1], [null, null]);
  assertCompleteValue(holed[0][2], [null]);
  assertCompleteValue(holed[6][3], [[null], [], [], []]);
  assertCompleteValue(holed[6][5], [null, ["rest", 0, [null], "by-value"]]);
});

test("the binding vector key encodes each position of each family on its own, a hole included", () => {
  const owner = "D[M[P[p];m];owner]";
  const other = "D[M[P[p];m];other]";
  const empty = { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] };
  const typeBindings = () => [{ kind: "rigid", parameter: typeParameterDeclaration(owner, 0) },
    { kind: "rigid", parameter: typeParameterDeclaration(other, 3) },
    { kind: "bound", parameter: typeParameterDeclaration(owner, 0), type: 0 }];
  const members = {
    classBindings: typeBindings(), methodBindings: typeBindings(), capturedBindings: typeBindings(),
    selfBindings: [{ kind: "rigid", owner }, { kind: "rigid", owner: other }, { kind: "bound", owner, type: 0 }],
  };
  const selection = bindings => ({ decision: { key: { kind: "text", value: "x" }, origins: [], selectedDeclarations: [], primary: null, read: 0, write: 0,
    getter: null, setter: null, bindings, location: { kind: "data", check: { kind: "none" }, receiver: "in-place" } }, getter: null, setter: null });
  const key = bindings => JSON.stringify(product.memberSelectionKey(selection(bindings)), (_name, value) => typeof value === "bigint" ? `${value}n` : value);
  const holed = (...values) => { const list = new Array(values.length); values.forEach((value, index) => { if (value !== undefined) list[index] = value; }); return list; };
  for (const family of Object.keys(members)) {
    const [a, b] = members[family];
    const vector = list => ({ ...empty, [family]: list });
    assert.notEqual(key(vector(holed(undefined, a))), key(vector(holed(a, undefined))), `${family}: mixed holes at different positions`);
    assert.equal(key(vector(holed(undefined, a))), key(vector(holed(undefined, structuredClone(a)))), `${family}: the same holes and members`);
    assert.notEqual(key(vector(holed(undefined, a))), key(vector(holed(undefined, b))), `${family}: the same position with a different owner`);
    assert.notEqual(key(vector([a, b])), key(vector([b, a])), `${family}: the same members at different positions`);
    assert.equal(key(vector([a, b])), key(vector(structuredClone([a, b]))), `${family}: identical vectors give equal keys`);
    assert.notEqual(key(vector(holed(undefined))), key(empty), `${family}: a hole is not an empty list`);
  }
  assert.notEqual(key({ ...empty, classBindings: holed(undefined) }), key({ ...empty, methodBindings: holed(undefined) }), "a hole in class bindings against a hole in method bindings");
});

test("native syntax comparison checks every declared ordinary field without discovering object properties", () => {
  const makeSyntax = (kind, id, properties) => ({ ...header(id), kind, ...properties, tsonic: null });
  const makeRows = (count, absent, reverse) => syntaxConstructorInputs(makeSyntax, nodeList, count, absent, reverse);
  const canonical = new Map(makeRows(1, false, false).map(row => [row.node.kind, row.node]));
  const alternateNode = (node, kinds) => {
    const kind = kinds.find(candidate => candidate !== node.kind);
    const selected = canonical.get(kind);
    assert.equal(selected !== undefined, true, `complete independent constructor for ${kind}`);
    return selected;
  };
  const rows = [[0, true, false], [0, false, false], [1, false, false], [3, false, false], [3, false, true]]
    .flatMap(([count, absent, reverse]) => makeRows(count, absent, reverse));
  for (const node of canonical.values()) {
    const fields = syntaxFieldMutations.get(node.kind);
    if (fields.some(field => field.name.startsWith("tokenFlags."))) rows.push({ node: { ...node, tokenFlags: ["Scientific", "Unterminated"] } });
    if (fields.some(field => field.name.startsWith("templateFlags."))) rows.push({ node: { ...node, templateFlags: ["Scientific", "Unterminated"] } });
  }
  const source = canonical.get("SourceFile");
  rows.push({ node: { ...canonical.get("ImportClause"), phaseModifier: "TypeKeyword" } });
  rows.push({ node: { ...source, commentDirectives: [{ kind: "ExpectError", loc: { pos: 1, end: 2 } }],
    pragmas: [{ kind: "SingleLineCommentTrivia", pos: 3, end: 4, hasTrailingNewLine: false, name: "reference",
      args: [{ name: "first", value: { pos: 5, end: 6, name: "path", value: "one" } },
        { name: "second", value: { pos: 7, end: 8, name: "types", value: "two" } }] }],
    checkJsDirective: { enabled: true, range: { kind: "SingleLineCommentTrivia", pos: 9, end: 10, hasTrailingNewLine: true } } } });
  const kinds = [...canonical.keys()];
  assert.equal(kinds.length, syntaxFieldMutations.size, "the actual independent constructor and declared-field families agree completely");
  const exercised = new Set();
  const headerFields = (kind, fields) => kind !== "Parameter" ? fields : fields.filter(field => !field.name.startsWith("initializer."));
  for (const { node } of rows) {
    const fields = syntaxFieldMutations.get(node.kind);
    assert.equal(fields !== undefined, true, `${node.kind}: complete field relation`);
    assert.equal(sameSyntaxFields(node, { ...node }), true, `${node.kind}: complete equal ordinary payload`);
    assert.equal(sameSyntaxFields(node, { ...node, id: 900, parent: 800, loc: { pos: 1, end: 2 },
      origin: { module: "M[P[other];other]", start: 3, length: 4, derived: [] }, tsonic: null }), true,
    `${node.kind}: independently verified headers are not ordinary syntax fields`);
    assert.equal(sameSyntaxFields(node, canonical.get(kinds[(kinds.indexOf(node.kind) + 1) % kinds.length])), false,
      `${node.kind}: different actual syntax constructor`);
    for (const field of headerFields(node.kind, fields)) {
      if (!field.when(node)) continue;
      const changed = field.change(node, alternateNode);
      assert.equal(sameSyntaxFields(node, changed), false, `${node.kind}/${field.name}: genuine declared-field mismatch`);
      assert.equal(sameSyntaxFields(changed, node), false, `${node.kind}/${field.name}: complete opposite orientation`);
      exercised.add(`${node.kind}/${field.name}`);
    }
  }
  const required = [...syntaxFieldMutations].flatMap(([kind, fields]) => headerFields(kind, fields).map(field => `${kind}/${field.name}`)).sort();
  assertCompleteValue([...exercised].sort(), required, "every contract-derived field mutation has an actual complete fixture");
  const flagged = { ...source, flags: ["Let", "Const"] };
  assert.equal(sameSyntaxFields(source, flagged), false);
  assert.equal(sameSyntaxFields(flagged, { ...flagged, flags: ["Let", "Const"] }), true);
  assert.equal(sameSyntaxFields(flagged, { ...flagged, flags: ["Const", "Let"] }), false);
  const sparse = { ...flagged, flags: new Array(2) };
  assert.equal(sameSyntaxFields(sparse, flagged), false);
  assert.equal(sameSyntaxFields(flagged, sparse), false);
});

test("native named-entry comparison rejects missing or duplicate keys on either supplied side", () => {
  const body = emptyModuleBody();
  const entries = [
    { name: "first", value: { pos: 0, end: 1, name: "path", value: "one" } },
    { name: "second", value: { pos: 2, end: 3, name: "types", value: "two" } },
  ];
  const root = args => ({ ...body.root, pragmas: [{ kind: "SingleLineCommentTrivia", pos: 0, end: 4,
    hasTrailingNewLine: false, name: "reference", args }] });
  const valid = root(entries);
  assert.equal(sameSyntaxFields(valid, root([...entries].reverse())), true, "named entries have canonical key identity, not input insertion order");
  for (const invalid of [[entries[0], entries[0]], new Array(2)]) {
    assert.equal(sameSyntaxFields(valid, root(invalid)), false);
    assert.equal(sameSyntaxFields(root(invalid), valid), false);
  }
});

test("native number text preserves complete fractional mantissas and both explicit exponent signs", () => {
  const body = emptyModuleBody();
  body.root.loc = { pos: 1.125e+21, end: 1.25e-7 };
  const original = readFileSync(resolve(repository, functionDirectory, "empty-module.input.tir"), "utf8");
  const expected = original.replace("loc=TextRange(pos=0, end=0), statements=", "loc=TextRange(pos=1.125e+21, end=1.25e-7), statements=");
  assertBodyRoundTrip(body, expected, "complete declared numeric fields, not a semantic valid-range certificate");
});

test("actual source metadata preserves directives, dynamic pragma names, comment geometry and derivations", () => {
  const body = emptyModuleBody();
  body.root.origin.derived = [{ kind: "lowering", pass: "elaborate" }, { kind: "expansion", expansion: "expansion" }];
  body.root.commentDirectives = [{ loc: { pos: 1, end: 2 }, kind: "ExpectError" }, { loc: { pos: 3, end: 4 }, kind: "Ignore" }];
  body.root.pragmas = [{ pos: 5, end: 10, kind: "SingleLineCommentTrivia", hasTrailingNewLine: true, name: "reference",
    args: [{ name: "escaped-name", value: { pos: 8, end: 10, name: "escaped-name", value: "value" } },
      { name: "types", value: { pos: 6, end: 8, name: "types", value: "ambient" } }] }];
  body.root.checkJsDirective = { enabled: false, range: { pos: 11, end: 15, kind: "MultiLineCommentTrivia", hasTrailingNewLine: false } };
  const baseline = readFileSync(resolve(repository, functionDirectory, "empty-module.input.tir"), "utf8");
  const expected = baseline.replace(`n:0=TirModuleRoot(id=n:0, origin=Origin(module=mod:"${moduleId}", start=0, length=0, derived=[])`,
    `n:0=TirModuleRoot(id=n:0, origin=Origin(module=mod:"${moduleId}", start=0, length=0, ` +
      'derived=[lowering(pass="elaborate"), expansion(expansion=exp:"expansion")])')
    .replace("commentDirectives=[], pragmas=[], checkJsDirective=null", 'commentDirectives=[' +
      'CommentDirective(loc=TextRange(pos=1, end=2), kind="ExpectError"), CommentDirective(loc=TextRange(pos=3, end=4), kind="Ignore")], ' +
      'pragmas=[Pragma(pos=5, end=10, kind="SingleLineCommentTrivia", hasTrailingNewLine=true, name="reference", ' +
      'args=PragmaArguments("escaped-name"=PragmaArgument(pos=8, end=10, name="escaped-name", value="value"), ' +
      'types=PragmaArgument(pos=6, end=8, name="types", value="ambient")))], ' +
      'checkJsDirective=CheckJsDirective(enabled=false, range=CommentRange(pos=11, end=15, kind="MultiLineCommentTrivia", hasTrailingNewLine=false))');
  const parsed = product.parseTir(expected);
  assert.equal(parsed.kind, "parsed");
  assertCompleteValue(parsed.value, body, "entire independently authored source metadata", compareCaseValues);
  assertCompleteValue(product.printTir(parsed.value), expected, "entire source metadata wire without dynamic-name normalization", sameWire);
  const unquoted = product.parseTir(expected.replace('"escaped-name"=', "escaped-name="));
  assert.equal(unquoted.kind, "parsed");
  assertCompleteValue(unquoted.value, body, "grammar-admitted unquoted dynamic name retains the same entire value", compareCaseValues);
  assertCompleteValue(product.printTir(unquoted.value), expected, "canonical field quoting is independent of the admitted input spelling", sameWire);
});

for (const scriptKind of ["Unknown", "JS", "JSX", "TS", "TSX", "External", "JSON", "Deferred"]) {
  test(`the complete source-file ${scriptKind} kind retains its authored language variant`, () => {
    const body = emptyModuleBody();
    const languageVariant = scriptKind === "JSX" || scriptKind === "TSX" ? "JSX" : "Standard";
    body.root.scriptKind = scriptKind;
    body.root.languageVariant = languageVariant;
    const expected = readFileSync(resolve(repository, functionDirectory, "empty-module.input.tir"), "utf8")
      .replace('scriptKind="TS"', `scriptKind="${scriptKind}"`)
      .replace('languageVariant="Standard"', `languageVariant="${languageVariant}"`);
    assertBodyRoundTrip(body, expected, scriptKind);
  });
}

test("every saved syntax flag is retained in its supplied vector order, not reinterpreted as a scalar mask", () => {
  const flags = ["Let", "Const", "Using", "OptionalChain", "DisallowInContext", "YieldContext", "DecoratorContext", "AwaitContext",
    "DisallowConditionalTypesContext", "ThisNodeHasError", "JavaScriptFile", "ThisNodeOrAnySubNodesHasError", "HasJSDoc", "JSDoc", "Ambient",
    "InWithStatement", "JsonFile", "IdentifierHasExtendedUnicodeEscape", "IdentifierIsInJSDocNamespace", "NestedNamespace", "AwaitUsing"];
  for (const supplied of [flags, [...flags].reverse()]) {
    const body = emptyModuleBody();
    body.root.flags = supplied;
    const flagsWire = `[${supplied.map(flag => JSON.stringify(flag)).join(", ")}]`;
    const expected = readFileSync(resolve(repository, functionDirectory, "empty-module.input.tir"), "utf8")
      .replace("flags=[]", `flags=${flagsWire}`);
    assertBodyRoundTrip(body, expected, "all saved syntax flags");
  }
});

test("F4 every lexical string escape has a complete public document and exact failure position", () => {
  const body = emptyModuleBody();
  body.root = { ...header(0), kind: "StringLiteral", text: "/", tokenFlags: [],
    tsonic: { ...typedValue(), role: "value", value: "/" } };
  const bodyHeader = readFileSync(resolve(repository, functionDirectory, "empty-module.input.tir"), "utf8").split("\n")[0];
  const prefix = openTypedWire(bodyHeader) + `n:0=StringLiteral(${syntaxHeaderWire(0, null)}, text=`;
  const suffix = `, tokenFlags=[], tsonic=TypedString(${valueWire}, role="value", value="/"))\n)\n`;
  const canonical = prefix + '"/"' + suffix;
  const escaped = prefix + '"\\/"' + suffix;
  assertCompleteValue(product.parseTir(escaped), { kind: "parsed", value: body }, "complete escaped solidus", compareCaseValues);
  assertBodyRoundTrip(body, canonical, "canonical solidus");
  const character = "\u0001";
  const control = prefix + '"' + character + '"' + suffix;
  assertInvalidText(control, prefix.length + 1, ["JSON string character"], character);
  const escape = prefix + '"\\u';
  assertInvalidText(escape, escape.length, ["four hexadecimal digits"], null);
  const backslash = prefix + '"\\';
  assertInvalidText(backslash, backslash.length, ["JSON escape"], null);
  const validControl = prefix + '"\\u0001"' + suffix.replace('value="/"', 'value="\\u0001"');
  body.root.text = character;
  body.root.tsonic.value = character;
  assertCompleteValue(product.parseTir(validControl), { kind: "parsed", value: body }, "complete escaped control", compareCaseValues);
  assertCompleteValue(product.printTir(body), validControl, "entire canonical escaped control", sameWire);
});


test("every token flag retains its exact closed spelling and vector order", () => {
  const flags = ["PrecedingLineBreak", "PrecedingJSDocComment", "Unterminated", "ExtendedUnicodeEscape", "Scientific", "Octal", "HexSpecifier",
    "BinarySpecifier", "OctalSpecifier", "ContainsSeparator", "UnicodeEscape", "ContainsInvalidEscape", "HexEscape", "ContainsLeadingZero",
    "ContainsInvalidSeparator", "PrecedingJSDocLeadingAsterisks", "SingleQuote", "PrecedingJSDocWithDeprecated", "PrecedingJSDocWithSeeOrLink"];
  for (const supplied of [flags, [...flags].reverse()]) {
    const flagsWire = `[${supplied.map(flag => JSON.stringify(flag)).join(", ")}]`;
    assertExpressionRoundTrip("StringLiteral", { text: "literal", tokenFlags: supplied }, `text="literal", tokenFlags=${flagsWire}`,
      { ...typedValue(), role: "value", value: "literal" }, `TypedString(${valueWire}, role="value", value="literal")`);
  }
});

{
const header = fullCodecHeader;
const syntaxHeaderWire = fullCodecHeaderWire;
const typedValue = fullCodecValue;
const valueWire = "type=t:0, convertedType=t:0, conversion=identity(), narrowing=identity(type=t:0), evidenceIndex=0, demand=always()";
const plainTokenCases = [
  "Unknown", "EndOfFile", "SingleLineCommentTrivia", "MultiLineCommentTrivia", "NewLineTrivia", "WhitespaceTrivia",
  "ConflictMarkerTrivia", "NonTextFileMarkerTrivia", "JsxTextAllWhiteSpaces", "OpenBraceToken", "CloseBraceToken",
  "OpenParenToken", "CloseParenToken", "OpenBracketToken", "CloseBracketToken", "DotToken", "DotDotDotToken",
  "SemicolonToken", "CommaToken", "QuestionDotToken", "LessThanToken", "LessThanSlashToken", "GreaterThanToken",
  "LessThanEqualsToken", "GreaterThanEqualsToken", "EqualsEqualsToken", "ExclamationEqualsToken", "EqualsEqualsEqualsToken",
  "ExclamationEqualsEqualsToken", "EqualsGreaterThanToken", "PlusToken", "MinusToken", "AsteriskToken", "AsteriskAsteriskToken",
  "SlashToken", "PercentToken", "PlusPlusToken", "MinusMinusToken", "LessThanLessThanToken", "GreaterThanGreaterThanToken",
  "GreaterThanGreaterThanGreaterThanToken", "AmpersandToken", "BarToken", "CaretToken", "ExclamationToken", "TildeToken",
  "AmpersandAmpersandToken", "BarBarToken", "QuestionToken", "ColonToken", "AtToken", "QuestionQuestionToken", "BacktickToken",
  "HashToken", "EqualsToken", "PlusEqualsToken", "MinusEqualsToken", "AsteriskEqualsToken", "AsteriskAsteriskEqualsToken",
  "SlashEqualsToken", "PercentEqualsToken", "LessThanLessThanEqualsToken", "GreaterThanGreaterThanEqualsToken",
  "GreaterThanGreaterThanGreaterThanEqualsToken", "AmpersandEqualsToken", "BarEqualsToken", "BarBarEqualsToken",
  "AmpersandAmpersandEqualsToken", "QuestionQuestionEqualsToken", "CaretEqualsToken", "JSDocCommentTextToken",
  "BreakKeyword", "CaseKeyword", "CatchKeyword", "ClassKeyword", "ConstKeyword", "ContinueKeyword", "DebuggerKeyword",
  "DefaultKeyword", "DeleteKeyword", "DoKeyword", "ElseKeyword", "EnumKeyword", "ExportKeyword", "ExtendsKeyword",
  "FinallyKeyword", "ForKeyword", "FunctionKeyword", "IfKeyword", "InKeyword", "InstanceOfKeyword", "NewKeyword",
  "ReturnKeyword", "SwitchKeyword", "ThrowKeyword", "TryKeyword", "TypeOfKeyword", "VarKeyword", "WhileKeyword", "WithKeyword",
  "ImplementsKeyword", "InterfaceKeyword", "LetKeyword", "PackageKeyword", "PrivateKeyword", "ProtectedKeyword", "PublicKeyword",
  "StaticKeyword", "YieldKeyword", "AbstractKeyword", "AccessorKeyword", "AsKeyword", "AssertsKeyword", "AssertKeyword",
  "AsyncKeyword", "AwaitKeyword", "ConstructorKeyword", "DeclareKeyword", "GetKeyword", "ImmediateKeyword", "InferKeyword",
  "IsKeyword", "KeyOfKeyword", "ModuleKeyword", "NamespaceKeyword", "OutKeyword", "ReadonlyKeyword", "RequireKeyword",
  "SatisfiesKeyword", "SetKeyword", "TypeKeyword", "UniqueKeyword", "UsingKeyword", "FromKeyword", "GlobalKeyword",
  "OverrideKeyword", "OfKeyword", "DeferKeyword",
];
for (const kind of plainTokenCases) {
  test(`actual public SyntaxNode token family ${kind} retains its complete record`, () => {
    assertSyntaxPayload({ ...header(4, 2), kind, tsonic: null }, [`${kind}(${syntaxHeaderWire(4, 2)}, tsonic=null)`], kind);
  });
}

const codecName = (identity, parent) => ({ ...header(identity, parent), kind: "Identifier", text: "name",
  tsonic: { ...typedValue(), role: "value", resolution: { kind: "definition", definition: ownerId, aliases: [] } } });
const codecNameWire = (identity, parent) => `Identifier(${syntaxHeaderWire(identity, parent)}, text="name", ` +
  `tsonic=TypedName(${valueWire}, role="value", resolution=definition(definition=def:"${ownerId}", aliases=[])))`;
const codecText = (identity, parent) => ({ ...header(identity, parent), kind: "JsxText", text: "text", tokenFlags: [],
  containsOnlyTriviaWhiteSpaces: false, tsonic: null });
const codecTextWire = (identity, parent) => `JsxText(${syntaxHeaderWire(identity, parent)}, text="text", ` +
  'tokenFlags=[], containsOnlyTriviaWhiteSpaces=false, tsonic=null)';
const codecType = (identity, parent) => ({ ...header(identity, parent), kind: "AnyKeyword", tsonic: { type: 0, declarations: [] } });
const codecTypeWire = (identity, parent) => `AnyKeyword(${syntaxHeaderWire(identity, parent)}, tsonic=TypedType(type=t:0, declarations=[]))`;
const codecDocText = (identity, parent) => ({ ...header(identity, parent), kind: "JSDocText", text: ["comment", ""], tsonic: null });
const codecDocTextWire = (identity, parent) => `JSDocText(${syntaxHeaderWire(identity, parent)}, text=["comment", ""], tsonic=null)`;

for (const kind of ["AnyKeyword", "UnknownKeyword", "NumberKeyword", "BigIntKeyword", "ObjectKeyword", "BooleanKeyword",
  "StringKeyword", "SymbolKeyword", "VoidKeyword", "UndefinedKeyword", "NeverKeyword", "IntrinsicKeyword"]) {
  test(`the ${kind} type syntax retains its nonempty declaration vector`, () => {
    assertSyntaxPayload({ ...header(4, 2), kind, tsonic: { type: 0, declarations: [ownerId] } }, [
      `${kind}(${syntaxHeaderWire(4, 2)}, tsonic=TypedType(type=t:0, declarations=[def:"${ownerId}"]))`,
    ], kind);
  });
}

for (const [kind, field] of [["ArrayType", "elementType"], ["OptionalType", "type"], ["RestType", "type"],
  ["ParenthesizedType", "type"]]) {
  test(`the complete ${kind} type keeps its actual authored child`, () => {
    assertSyntaxPayload({ ...header(4, 2), kind, [field]: codecType(5, 4), tsonic: { type: 0, declarations: [] } }, [
      `${kind}(${syntaxHeaderWire(4, 2)}, ${field}=n:5, tsonic=TypedType(type=t:0, declarations=[]))`, codecTypeWire(5, 4),
    ], kind);
  });
}

for (const [kind, field] of [["UnionType", "types"], ["IntersectionType", "types"], ["TupleType", "elements"]]) {
  test(`the complete nonempty ${kind} vector has independent type syntax and framing`, () => {
    assertSyntaxPayload({ ...header(4, 2), kind, [field]: nodeList([codecType(5, 4)]), tsonic: { type: 0, declarations: [] } }, [
      `${kind}(${syntaxHeaderWire(4, 2)}, ${field}=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:5]), ` +
        'tsonic=TypedType(type=t:0, declarations=[]))', codecTypeWire(5, 4),
    ], kind);
  });
}

test("all four conditional-type syntax children remain distinct and declared-order complete", () => {
  assertSyntaxPayload({ ...header(4, 2), kind: "ConditionalType", checkType: codecType(5, 4), extendsType: codecType(6, 4),
    trueType: codecType(7, 4), falseType: codecType(8, 4), tsonic: { type: 0, declarations: [] } }, [
    `ConditionalType(${syntaxHeaderWire(4, 2)}, checkType=n:5, extendsType=n:6, trueType=n:7, falseType=n:8, ` +
      'tsonic=TypedType(type=t:0, declarations=[]))',
    codecTypeWire(5, 4), codecTypeWire(6, 4), codecTypeWire(7, 4), codecTypeWire(8, 4),
  ], "conditional type");
});

for (const operator of ["KeyOfKeyword", "UniqueKeyword", "ReadonlyKeyword"]) {
  test(`a ${operator} type operation preserves its exact closed token`, () => {
    assertSyntaxPayload({ ...header(4, 2), kind: "TypeOperator", operator, type: codecType(5, 4),
      tsonic: { type: 0, declarations: [] } }, [
      `TypeOperator(${syntaxHeaderWire(4, 2)}, operator="${operator}", type=n:5, tsonic=TypedType(type=t:0, declarations=[]))`,
      codecTypeWire(5, 4),
    ], `type ${operator}`);
  });
}

test("indexed-access type syntax retains separate object and index type references", () => {
  assertSyntaxPayload({ ...header(4, 2), kind: "IndexedAccessType", objectType: codecType(5, 4), indexType: codecType(6, 4),
    tsonic: { type: 0, declarations: [] } }, [
    `IndexedAccessType(${syntaxHeaderWire(4, 2)}, objectType=n:5, indexType=n:6, tsonic=TypedType(type=t:0, declarations=[]))`,
    codecTypeWire(5, 4), codecTypeWire(6, 4),
  ], "indexed-access type");
});

for (const [kind, name] of [["TypeReference", "typeName"], ["TypeQuery", "exprName"]]) {
  test(`the complete ${kind} includes actual type arguments and a qualified-name slot`, () => {
    assertSyntaxPayload({ ...header(4, 2), kind, typeArguments: nodeList([codecType(5, 4)]), [name]: codecName(6, 4),
      tsonic: { type: 0, declarations: [] } }, [
      `${kind}(${syntaxHeaderWire(4, 2)}, typeArguments=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:5]), ` +
        `${name}=n:6, tsonic=TypedType(type=t:0, declarations=[]))`, codecTypeWire(5, 4), codecNameWire(6, 4),
    ], kind);
  });
}

test("the literal and this-type syntax owners retain their exact phase family", () => {
  const literal = { ...header(5, 4), kind: "StringLiteral", text: "literal", tokenFlags: [],
    tsonic: { role: "type-literal", type: 0 } };
  assertSyntaxPayload({ ...header(4, 2), kind: "LiteralType", literal, tsonic: { type: 0, declarations: [] } }, [
    `LiteralType(${syntaxHeaderWire(4, 2)}, literal=n:5, tsonic=TypedType(type=t:0, declarations=[]))`,
    `StringLiteral(${syntaxHeaderWire(5, 4)}, text="literal", tokenFlags=[], tsonic=TypedString(role="type-literal", type=t:0))`,
  ], "literal type");
  assertSyntaxPayload({ ...header(4, 2), kind: "ThisType", tsonic: { type: 0, declarations: [] } }, [
    `ThisType(${syntaxHeaderWire(4, 2)}, tsonic=TypedType(type=t:0, declarations=[]))`,
  ], "this type");
});

test("named tuple members retain authored rest/name/optional/type children in declaration order", () => {
  assertSyntaxPayload({ ...header(4, 2), kind: "NamedTupleMember",
    dotDotDotToken: { ...header(5, 4), kind: "DotDotDotToken", tsonic: null }, name: codecName(6, 4),
    questionToken: { ...header(7, 4), kind: "QuestionToken", tsonic: null }, type: codecType(8, 4),
    tsonic: { type: 0, declarations: [] } }, [
    `NamedTupleMember(${syntaxHeaderWire(4, 2)}, dotDotDotToken=n:5, name=n:6, questionToken=n:7, type=n:8, ` +
      'tsonic=TypedType(type=t:0, declarations=[]))',
    `DotDotDotToken(${syntaxHeaderWire(5, 4)}, tsonic=null)`, codecNameWire(6, 4),
    `QuestionToken(${syntaxHeaderWire(7, 4)}, tsonic=null)`, codecTypeWire(8, 4),
  ], "named tuple member");
});

test("import-type syntax retains nullable attributes and nonempty actual type arguments", () => {
  assertSyntaxPayload({ ...header(4, 2), kind: "ImportType", typeArguments: nodeList([codecType(5, 4)]), isTypeOf: true,
    argument: codecType(6, 4), attributes: null, qualifier: codecName(7, 4), tsonic: { type: 0, declarations: [] } }, [
    `ImportType(${syntaxHeaderWire(4, 2)}, typeArguments=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:5]), ` +
      'isTypeOf=true, argument=n:6, attributes=null, qualifier=n:7, tsonic=TypedType(type=t:0, declarations=[]))',
    codecTypeWire(5, 4), codecTypeWire(6, 4), codecNameWire(7, 4),
  ], "import type");
});

for (const kind of ["JsxOpeningFragment", "JsxClosingFragment"]) {
  test(`complete ${kind} is admitted through the actual public syntax family`, () => {
    assertSyntaxPayload({ ...header(4, 2), kind, tsonic: null }, [`${kind}(${syntaxHeaderWire(4, 2)}, tsonic=null)`], kind);
  });
}

test("JSX text and empty attributes retain every declared field", () => {
  assertSyntaxPayload(codecText(4, 2), [codecTextWire(4, 2)], "JSX text");
  assertSyntaxPayload({ ...header(4, 2), kind: "JsxAttributes", properties: nodeList(), tsonic: null },
    [`JsxAttributes(${syntaxHeaderWire(4, 2)}, properties=NodeList(loc=TextRange(pos=0, end=0), nodes=[]), tsonic=null)`], "JSX attributes");
});

test("JSX namespace names preserve both actual child objects", () => {
  assertSyntaxPayload({ ...header(4, 2), kind: "JsxNamespacedName", namespace: codecName(5, 4), name: codecName(6, 4), tsonic: null },
    [`JsxNamespacedName(${syntaxHeaderWire(4, 2)}, namespace=n:5, name=n:6, tsonic=null)`,
      codecNameWire(5, 4), codecNameWire(6, 4)], "JSX namespace");
});

for (const present of [false, true]) {
  test(`JSX expression retains its ${present ? "present spread/value" : "null spread/value"} children`, () => {
    const token = { ...header(5, 4), kind: "DotDotDotToken", tsonic: null };
    const expression = codecName(6, 4);
    assertSyntaxPayload({ ...header(4, 2), kind: "JsxExpression", dotDotDotToken: present ? token : null,
      expression: present ? expression : null, tsonic: null },
    [`JsxExpression(${syntaxHeaderWire(4, 2)}, dotDotDotToken=${present ? "n:5" : "null"}, ` +
      `expression=${present ? "n:6" : "null"}, tsonic=null)`,
    ...(present ? [`DotDotDotToken(${syntaxHeaderWire(5, 4)}, tsonic=null)`, codecNameWire(6, 4)] : [])], "JSX expression");
  });
  test(`JSX attributes retain ${present ? "present" : "absent"} attribute values`, () => {
    const initializer = { ...header(6, 4), kind: "StringLiteral", text: "value", tokenFlags: [],
      tsonic: { role: "attribute-value", value: "value" } };
    assertSyntaxPayload({ ...header(4, 2), kind: "JsxAttribute", name: codecName(5, 4), initializer: present ? initializer : null, tsonic: null },
      [`JsxAttribute(${syntaxHeaderWire(4, 2)}, name=n:5, initializer=${present ? "n:6" : "null"}, tsonic=null)`, codecNameWire(5, 4),
        ...(present ? [`StringLiteral(${syntaxHeaderWire(6, 4)}, text="value", tokenFlags=[], ` +
          'tsonic=TypedString(role="attribute-value", value="value"))'] : [])], "JSX attribute");
  });
}

for (const kind of ["JsxSpreadAttribute", "JsxClosingElement"]) {
  test(`the complete ${kind} child is not replaced with a copied or inferred expression`, () => {
    assertSyntaxPayload({ ...header(4, 2), kind, ...(kind === "JsxSpreadAttribute" ? { expression: codecName(5, 4) }
      : { tagName: codecName(5, 4) }), tsonic: null },
    [`${kind}(${syntaxHeaderWire(4, 2)}, ${kind === "JsxSpreadAttribute" ? "expression" : "tagName"}=n:5, tsonic=null)`,
      codecNameWire(5, 4)], kind);
  });
}

for (const kind of ["JsxOpeningElement", "JsxSelfClosingElement"]) {
  test(`${kind} retains actual type arguments and attributes in declaration order`, () => {
    const type = { ...header(6, 4), kind: "AnyKeyword", tsonic: { type: 0, declarations: [] } };
    const attributes = { ...header(7, 4), kind: "JsxAttributes", properties: nodeList(), tsonic: null };
    assertSyntaxPayload({ ...header(4, 2), kind, tagName: codecName(5, 4), typeArguments: nodeList([type]), attributes, tsonic: null },
      [`${kind}(${syntaxHeaderWire(4, 2)}, tagName=n:5, typeArguments=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:6]), ` +
        'attributes=n:7, tsonic=null)', codecNameWire(5, 4),
      `AnyKeyword(${syntaxHeaderWire(6, 4)}, tsonic=TypedType(type=t:0, declarations=[]))`,
      `JsxAttributes(${syntaxHeaderWire(7, 4)}, properties=NodeList(loc=TextRange(pos=0, end=0), nodes=[]), tsonic=null)`], kind);
  });
}

test("a complete JSX element retains opening/children/closing arenas and exact syntax identities", () => {
  const attributes = { ...header(7, 5), kind: "JsxAttributes", properties: nodeList(), tsonic: null };
  const opening = { ...header(5, 4), kind: "JsxOpeningElement", tagName: codecName(6, 5), typeArguments: null, attributes, tsonic: null };
  const closing = { ...header(9, 4), kind: "JsxClosingElement", tagName: codecName(10, 9), tsonic: null };
  assertSyntaxPayload({ ...header(4, 2), kind: "JsxElement", openingElement: opening, children: nodeList([codecText(8, 4)]),
    closingElement: closing, tsonic: null }, [
    `JsxElement(${syntaxHeaderWire(4, 2)}, openingElement=n:5, children=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:8]), closingElement=n:9, tsonic=null)`,
    `JsxOpeningElement(${syntaxHeaderWire(5, 4)}, tagName=n:6, typeArguments=null, attributes=n:7, tsonic=null)`, codecNameWire(6, 5),
    `JsxAttributes(${syntaxHeaderWire(7, 5)}, properties=NodeList(loc=TextRange(pos=0, end=0), nodes=[]), tsonic=null)`, codecTextWire(8, 4),
    `JsxClosingElement(${syntaxHeaderWire(9, 4)}, tagName=n:10, tsonic=null)`, codecNameWire(10, 9),
  ], "complete JSX element");
});

test("a complete JSX fragment retains both fragment markers and its child record", () => {
  assertSyntaxPayload({ ...header(4, 2), kind: "JsxFragment",
    openingFragment: { ...header(5, 4), kind: "JsxOpeningFragment", tsonic: null }, children: nodeList([codecText(6, 4)]),
    closingFragment: { ...header(7, 4), kind: "JsxClosingFragment", tsonic: null }, tsonic: null }, [
    `JsxFragment(${syntaxHeaderWire(4, 2)}, openingFragment=n:5, children=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:6]), closingFragment=n:7, tsonic=null)`,
    `JsxOpeningFragment(${syntaxHeaderWire(5, 4)}, tsonic=null)`, codecTextWire(6, 4), `JsxClosingFragment(${syntaxHeaderWire(7, 4)}, tsonic=null)`,
  ], "complete JSX fragment");
});

for (const kind of ["JSDocTypeExpression", "JSDocNonNullableType", "JSDocNullableType", "JSDocVariadicType", "JSDocOptionalType"]) {
  test(`the complete ${kind} retains its actual type child and null phase`, () => {
    assertSyntaxPayload({ ...header(4, 2), kind, type: codecType(5, 4), tsonic: null },
      [`${kind}(${syntaxHeaderWire(4, 2)}, type=n:5, tsonic=null)`, codecTypeWire(5, 4)], kind);
  });
}

test("JSDoc all-type and plain text retain their complete closed records", () => {
  assertSyntaxPayload({ ...header(4, 2), kind: "JSDocAllType", tsonic: null },
    [`JSDocAllType(${syntaxHeaderWire(4, 2)}, tsonic=null)`], "JSDoc all-type");
  assertSyntaxPayload(codecDocText(4, 2), [codecDocTextWire(4, 2)], "JSDoc text");
});

for (const kind of ["JSDocLink", "JSDocLinkPlain", "JSDocLinkCode"]) {
  test(`${kind} retains the full text vector and actual referenced name`, () => {
    assertSyntaxPayload({ ...header(4, 2), kind, text: ["first", "second"], name: codecName(5, 4), tsonic: null },
      [`${kind}(${syntaxHeaderWire(4, 2)}, text=["first", "second"], name=n:5, tsonic=null)`, codecNameWire(5, 4)], kind);
  });
}

for (const kind of ["JSDocUnknownTag", "JSDocPublicTag", "JSDocPrivateTag", "JSDocProtectedTag", "JSDocReadonlyTag", "JSDocOverrideTag", "JSDocDeprecatedTag"]) {
  test(`${kind} retains its actual name, complete comment list and exact null phase`, () => {
    assertSyntaxPayload({ ...header(4, 2), kind, tagName: codecName(5, 4), comment: nodeList([codecDocText(6, 4)]), tsonic: null },
      [`${kind}(${syntaxHeaderWire(4, 2)}, tagName=n:5, comment=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:6]), tsonic=null)`,
        codecNameWire(5, 4), codecDocTextWire(6, 4)], kind);
  });
}

for (const [kind, field] of [["JSDocReturnTag", "typeExpression"], ["JSDocSeeTag", "nameExpression"],
  ["JSDocSatisfiesTag", "typeExpression"], ["JSDocThrowsTag", "typeExpression"], ["JSDocThisTag", "typeExpression"],
  ["JSDocOverloadTag", "typeExpression"]]) {
  test(`${kind} retains its real ${field} child rather than a guessed anonymous payload`, () => {
    assertSyntaxPayload({ ...header(4, 2), kind, tagName: codecName(5, 4), comment: nodeList([codecDocText(6, 4)]),
      [field]: codecType(7, 4), tsonic: null },
    [`${kind}(${syntaxHeaderWire(4, 2)}, tagName=n:5, comment=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:6]), ${field}=n:7, tsonic=null)`,
      codecNameWire(5, 4), codecDocTextWire(6, 4), codecTypeWire(7, 4)], kind);
  });
}

for (const kind of ["JSDocCallbackTag", "JSDocTypedefTag"]) {
  test(`${kind} retains both independently authored type and full-name children`, () => {
    assertSyntaxPayload({ ...header(4, 2), kind, tagName: codecName(5, 4), comment: nodeList([codecDocText(6, 4)]),
      typeExpression: codecType(7, 4), name: codecName(8, 4), tsonic: null },
    [`${kind}(${syntaxHeaderWire(4, 2)}, tagName=n:5, comment=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:6]), typeExpression=n:7, name=n:8, tsonic=null)`,
      codecNameWire(5, 4), codecDocTextWire(6, 4), codecTypeWire(7, 4), codecNameWire(8, 4)], kind);
  });
}

test("JSDoc names and signature fields keep their exact declaration order", () => {
  assertSyntaxPayload({ ...header(4, 2), kind: "JSDocNameReference", name: codecName(5, 4), tsonic: null },
    [`JSDocNameReference(${syntaxHeaderWire(4, 2)}, name=n:5, tsonic=null)`, codecNameWire(5, 4)], "JSDoc name reference");
  assertSyntaxPayload({ ...header(4, 2), kind: "JSDocSignature", typeParameters: nodeList(), parameters: nodeList(),
    type: codecType(5, 4), fullSignature: codecType(6, 4), tsonic: null }, [
    `JSDocSignature(${syntaxHeaderWire(4, 2)}, typeParameters=NodeList(loc=TextRange(pos=0, end=0), nodes=[]), ` +
      'parameters=NodeList(loc=TextRange(pos=0, end=0), nodes=[]), type=n:5, fullSignature=n:6, tsonic=null)',
    codecTypeWire(5, 4), codecTypeWire(6, 4),
  ], "JSDoc signature");
});

for (const kind of ["JSDocParameterTag", "JSDocPropertyTag"]) {
  test(`${kind} retains its full name/position/type flags without a shared-kind guess`, () => {
    assertSyntaxPayload({ ...header(4, 2), kind, tagName: codecName(5, 4), comment: nodeList([codecDocText(6, 4)]),
      name: codecName(7, 4), isBracketed: true, typeExpression: codecType(8, 4), isNameFirst: false, tsonic: null }, [
      `${kind}(${syntaxHeaderWire(4, 2)}, tagName=n:5, comment=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:6]), ` +
        'name=n:7, isBracketed=true, typeExpression=n:8, isNameFirst=false, tsonic=null)',
      codecNameWire(5, 4), codecDocTextWire(6, 4), codecNameWire(7, 4), codecTypeWire(8, 4),
    ], kind);
  });
}

test("the full JSDoc owner retains actual comments, tags and their shared closed families", () => {
  const tag = { ...header(6, 4), kind: "JSDocUnknownTag", tagName: codecName(7, 6), comment: nodeList([codecDocText(8, 6)]), tsonic: null };
  assertSyntaxPayload({ ...header(4, 2), kind: "JSDoc", comment: nodeList([codecDocText(5, 4)]), tags: nodeList([tag]), tsonic: null }, [
    `JSDoc(${syntaxHeaderWire(4, 2)}, comment=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:5]), ` +
      'tags=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:6]), tsonic=null)',
    codecDocTextWire(5, 4), `JSDocUnknownTag(${syntaxHeaderWire(6, 4)}, tagName=n:7, ` +
      'comment=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:8]), tsonic=null)', codecNameWire(7, 6), codecDocTextWire(8, 6),
  ], "complete JSDoc");
});

test("JSDoc type/template tags use the actual broad syntax slot, not an invented private input", () => {
  const child = { ...header(7, 4), kind: "SyntaxList", children: [codecType(8, 7)], tsonic: null };
  assertSyntaxPayload({ ...header(4, 2), kind: "JSDocTypeTag", tagName: codecName(5, 4),
    comment: nodeList([codecDocText(6, 4)]), typeExpression: child, tsonic: null }, [
    `JSDocTypeTag(${syntaxHeaderWire(4, 2)}, tagName=n:5, comment=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:6]), typeExpression=n:7, tsonic=null)`,
    codecNameWire(5, 4), codecDocTextWire(6, 4), `SyntaxList(${syntaxHeaderWire(7, 4)}, children=[n:8], tsonic=null)`, codecTypeWire(8, 7),
  ], "JSDoc type tag");
  assertSyntaxPayload({ ...header(4, 2), kind: "JSDocTemplateTag", tagName: codecName(5, 4),
    comment: nodeList([codecDocText(6, 4)]), constraint: codecType(7, 4), typeParameters: nodeList(), tsonic: null }, [
    `JSDocTemplateTag(${syntaxHeaderWire(4, 2)}, tagName=n:5, comment=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:6]), ` +
      'constraint=n:7, typeParameters=NodeList(loc=TextRange(pos=0, end=0), nodes=[]), tsonic=null)',
    codecNameWire(5, 4), codecDocTextWire(6, 4), codecTypeWire(7, 4),
  ], "JSDoc template tag");
});

test("a JSDoc type literal retains its explicit absent tag vector and array flag", () => {
  assertSyntaxPayload({ ...header(4, 2), kind: "JSDocTypeLiteral", jsDocPropertyTags: null, isArrayType: true, tsonic: null },
    [`JSDocTypeLiteral(${syntaxHeaderWire(4, 2)}, jsDocPropertyTags=null, isArrayType=true, tsonic=null)`], "JSDoc type literal");
});

test("nonempty JSX attribute lists retain every actual name and initializer record", () => {
  const attribute = { ...header(5, 4), kind: "JsxAttribute", name: codecName(6, 5),
    initializer: { ...header(7, 5), kind: "StringLiteral", text: "value", tokenFlags: ["SingleQuote"],
      tsonic: { role: "attribute-value", value: "value" } }, tsonic: null };
  assertSyntaxPayload({ ...header(4, 2), kind: "JsxAttributes", properties: nodeList([attribute]), tsonic: null }, [
    `JsxAttributes(${syntaxHeaderWire(4, 2)}, properties=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:5]), tsonic=null)`,
    `JsxAttribute(${syntaxHeaderWire(5, 4)}, name=n:6, initializer=n:7, tsonic=null)`, codecNameWire(6, 5),
    `StringLiteral(${syntaxHeaderWire(7, 5)}, text="value", tokenFlags=["SingleQuote"], tsonic=TypedString(role="attribute-value", value="value"))`,
  ], "nonempty JSX attributes");
});

const codecReference = { body: bodyId, node: 4 };
const codecReferenceWire = `NodeRef(body=body:"${bodyId}", node=n:4)`;
const codecSource = { kind: "body", value: codecReference };
const codecSourceWire = `body(value=${codecReferenceWire})`;
const codecBindingsWire = "BindingVector(classBindings=[], methodBindings=[], capturedBindings=[], selfBindings=[])";
const codecContext = { occurrence: codecReference, origin: origin(), bindings: emptyBindings() };
const codecContextWire = `RuleContext(occurrence=${codecReferenceWire}, origin=Origin(module=mod:"${moduleId}", ` +
  `start=0, length=0, derived=[]), bindings=${codecBindingsWire})`;
const codecEvidence = { ...typeEvidence({ kind: "dynamic" }), component: codecSource };
const codecEvidenceWire = `TypeEvidence(type=t:0, component=${codecSourceWire}, category=dynamic(), ` +
  "numeric=null, sum=null, nominal=null, pointer=null)";
const codecKey = { kind: "text", value: "field" };
const codecKeyWire = 'text(value="field")';
const codecMemberOrigin = { kind: "mapped", owner: codecSource, key: codecKey };
const codecMemberOriginWire = `mapped(owner=${codecSourceWire}, key=${codecKeyWire})`;
const codecEndpoint = { declaration: ownerId, role: "advertised", signature: 0, body: bodyId };
const codecEndpointWire = `HirCallableEndpoint(declaration=def:"${ownerId}", role="advertised", signature=sig:0, body=body:"${bodyId}")`;
const savedInvocationCases = [
  ["embed", { context: codecContext, from: codecEvidence, to: codecEvidence, role: "return" },
    `EmbedInput(context=${codecContextWire}, from=${codecEvidenceWire}, to=${codecEvidenceWire}, role="return")`],
  ["domain-fit", { context: codecContext, value: codecEvidence, domain: codecEvidence },
    `DomainFitInput(context=${codecContextWire}, value=${codecEvidenceWire}, domain=${codecEvidenceWire})`],
  ["memory-equivalent", { context: codecContext, left: codecEvidence, right: codecEvidence },
    `MemoryEquivalentInput(context=${codecContextWire}, left=${codecEvidenceWire}, right=${codecEvidenceWire})`],
  ["member", { context: codecContext, receiver: codecEvidence, key: codecKey, access: "read", origins: [codecMemberOrigin] },
    `MemberInput(context=${codecContextWire}, receiver=${codecEvidenceWire}, key=${codecKeyWire}, access="read", origins=[${codecMemberOriginWire}])`],
  ["index", { context: codecContext, receiver: codecEvidence, key: codecEvidence, access: "write", result: 0 },
    `IndexInput(context=${codecContextWire}, receiver=${codecEvidenceWire}, key=${codecEvidenceWire}, access="write", result=t:0)`],
  ["construct-literal", { context: codecContext, construction: "object", parts: [
    { kind: "element", occurrence: codecReference, value: codecEvidence },
    { kind: "property", occurrence: codecReference, key: codecKey, value: codecEvidence },
    { kind: "spread", occurrence: codecReference, value: codecEvidence },
  ], destination: codecEvidence, result: codecEvidence }, `LiteralConstructionInput(context=${codecContextWire}, construction="object", parts=[` +
    `element(occurrence=${codecReferenceWire}, value=${codecEvidenceWire}), ` +
    `property(occurrence=${codecReferenceWire}, key=${codecKeyWire}, value=${codecEvidenceWire}), ` +
    `spread(occurrence=${codecReferenceWire}, value=${codecEvidenceWire})], destination=${codecEvidenceWire}, result=${codecEvidenceWire})`],
  ["candidate", { context: codecContext, kind: "call", callee: codecEvidence, receiver: codecEvidence,
    typeArguments: [codecEvidence], arguments: [{ occurrence: codecReference, kind: "spread", value: codecEvidence,
      tuple: [codecEvidence] }], candidates: [{ ordinal: 0, declaration: ownerId, advertised: codecEndpoint, advertisedSignature: 0,
      api: { ...codecEndpoint, role: "api-body" }, apiSignature: 0, bindings: emptyBindings(), conditionalFailure: null }] },
    `CandidateInput(context=${codecContextWire}, kind="call", callee=${codecEvidenceWire}, receiver=${codecEvidenceWire}, ` +
    `typeArguments=[${codecEvidenceWire}], arguments=[CandidateArgument(occurrence=${codecReferenceWire}, kind="spread", ` +
    `value=${codecEvidenceWire}, tuple=[${codecEvidenceWire}])], candidates=[CandidateEndpoint(ordinal=0, declaration=def:"${ownerId}", ` +
    `advertised=${codecEndpointWire}, advertisedSignature=sig:0, api=HirCallableEndpoint(declaration=def:"${ownerId}", role="api-body", signature=sig:0, ` +
    `body=body:"${bodyId}"), apiSignature=sig:0, bindings=${codecBindingsWire}, conditionalFailure=null)])`],
  ["operator", { context: codecContext, operator: "+", operands: [codecEvidence], permissionScope: codecReference },
    `OperatorInput(context=${codecContextWire}, operator="+", operands=[${codecEvidenceWire}], permissionScope=${codecReferenceWire})`],
  ["literal-fit", { context: codecContext, literal: { kind: "bigint", token: "1208925819614629174706176n", value: 1208925819614629174706176n }, destination: codecEvidence },
    `LiteralFitInput(context=${codecContextWire}, literal=bigint(token="1208925819614629174706176n", value=1208925819614629174706176n), destination=${codecEvidenceWire})`],
  ["protocol", { context: codecContext, kind: "delegate", asynchronous: true, subject: codecEvidence,
    operands: [codecEvidence], completion: codecEvidence, yielded: codecEvidence, sent: codecEvidence, thrown: codecEvidence },
    `ProtocolInput(context=${codecContextWire}, kind="delegate", asynchronous=true, subject=${codecEvidenceWire}, ` +
    `operands=[${codecEvidenceWire}], completion=${codecEvidenceWire}, yielded=${codecEvidenceWire}, sent=${codecEvidenceWire}, thrown=${codecEvidenceWire})`],
  ["refinement", { context: codecContext, source: codecEvidence, checked: codecEvidence },
    `RefinementInput(context=${codecContextWire}, source=${codecEvidenceWire}, checked=${codecEvidenceWire})`],
  ["library", { context: codecContext, declaration: ownerId, receiver: codecEvidence, arguments: [codecEvidence], result: codecEvidence },
    `LibraryInput(context=${codecContextWire}, declaration=def:"${ownerId}", receiver=${codecEvidenceWire}, ` +
    `arguments=[${codecEvidenceWire}], result=${codecEvidenceWire})`],
  ["core", { context: codecContext, captured: emptyCore(), declaration: ownerId, operands: [codecEvidence],
    result: codecEvidence, permissionScope: codecReference },
    `CoreInput(context=${codecContextWire}, captured=HirCoreCapture(provider=available(value=null), ` +
    "markers=available(value=HirMarkersCapture(struct=null, field=null, defaultValue=null, jsString=false, application=available(value=null))), " +
    "pointerType=available(value=null), pointerOperation=available(value=null), fieldBinding=available(value=null), " +
    "recordBinding=available(value=null), attribute=available(value=null), " +
    "safety=available(value=null), argumentPassing=available(value=null), flowState=available(value=null)), " +
    `declaration=def:"${ownerId}", operands=[${codecEvidenceWire}], result=${codecEvidenceWire}, permissionScope=${codecReferenceWire})`],
];

for (const [rule, input, inputWire] of savedInvocationCases) {
  test(`the genuine saved ${rule} invocation retains its complete independent public text vector`, () => {
    const phase = { ...typedValue(), role: "value", operation: { kind: "deferred",
      deferred: { invocation: { rule, input }, result: 0 } } };
    const phaseWire = `TypedPrefix(${valueWire}, role="value", operation=deferred(deferred=DeferredDecision(` +
      `invocation=DeferredInvocation(rule="${rule}", input=${inputWire}), result=t:0)))`;
    assertSyntaxPayload({ ...header(4, 2), kind: "PrefixUnaryExpression", operator: "PlusToken",
      operand: codecName(5, 4), tsonic: phase }, [
      `PrefixUnaryExpression(${syntaxHeaderWire(4, 2)}, operator="PlusToken", operand=n:5, tsonic=${phaseWire})`,
      codecNameWire(5, 4),
    ], `saved ${rule}`);
  });
  test(`the structural verifier retains supplied ${rule} data without executing or replaying its semantic rule`, () => {
    const fixture = operationScenario();
    const context = { occurrence: { body: bodyId, node: 2 }, origin: origin(), bindings: emptyBindings() };
    fixture.typed.tsonic.operation = { kind: "deferred", deferred: { invocation: { rule, input: { ...input, context } }, result: 1 } };
    replaceScopeInventory(fixture.input, Array.from({ length: rule === "candidate" ? 4 : 3 }, emptyScope));
    assertCompleteValue(verifyBody(fixture.input, fixture.body), []);
  });
}

const codecParameterDefinition = typeParameterDeclaration(ownerId, 0);
const codecParameterWire = `def:"${codecParameterDefinition}"`;
const codecParameterType = { declaration: codecParameterDefinition, constraint: 0, default: 0 };
const codecParameterTypeWire = `TypeParameter(declaration=${codecParameterWire}, constraint=t:0, default=t:0)`;
const codecAttribute = { declaration: ownerId, occurrence: codecSource, arguments: [codecSource] };
const codecAttributeWire = `HirAttribute(declaration=def:"${ownerId}", occurrence=${codecSourceWire}, arguments=[${codecSourceWire}])`;
const codecCallable = { definition: ownerId, parameters: [codecParameterType], signatures: [codecEndpoint],
  template: { body: bodyId, lexicalBindings: emptyBindings(), dependence: "parametric" }, attributes: [codecAttribute] };
const codecCallableWire = `TypedCallable(definition=def:"${ownerId}", parameters=[${codecParameterTypeWire}], ` +
  `signatures=[${codecEndpointWire}], template=TypedBodyTemplate(body=body:"${bodyId}", ` +
  `lexicalBindings=${codecBindingsWire}, dependence="parametric"), attributes=[${codecAttributeWire}])`;

function codecTypeParameter(identity, parent) {
  return { ...header(identity, parent), kind: "TypeParameter", modifiers: nodeList(), name: codecName(identity + 1, identity),
    constraint: codecType(identity + 2, identity), expression: codecName(identity + 3, identity),
    defaultType: codecType(identity + 4, identity), tsonic: { parameter: codecParameterType } };
}

function codecTypeParameterDefinitions(identity, parent) {
  return [
    `TypeParameter(${syntaxHeaderWire(identity, parent)}, modifiers=ModifierList(loc=TextRange(pos=0, end=0), nodes=[]), name=n:${identity + 1}, constraint=n:${identity + 2}, ` +
      `expression=n:${identity + 3}, defaultType=n:${identity + 4}, tsonic=TypedTypeParameter(parameter=${codecParameterTypeWire}))`,
    codecNameWire(identity + 1, identity), codecTypeWire(identity + 2, identity), codecNameWire(identity + 3, identity),
    codecTypeWire(identity + 4, identity),
  ];
}

function codecParameter(identity, parent) {
  return { ...header(identity, parent), kind: "Parameter", modifiers: nodeList(),
    dotDotDotToken: { ...header(identity + 1, identity), kind: "DotDotDotToken", tsonic: null },
    name: codecName(identity + 2, identity), questionToken: { ...header(identity + 3, identity), kind: "QuestionToken", tsonic: null },
    type: codecType(identity + 4, identity), initializer: { kind: "ready-default", root: codecName(identity + 5, identity) },
    tsonic: { declaration: ownerId, local: { body: bodyId, local: 0 }, storage: 0, passing: "by-value", initializer: bodyId, role: "default" } };
}

function codecParameterDefinitions(identity, parent) {
  return [
    `TirFormal(${syntaxHeaderWire(identity, parent)}, modifiers=ModifierList(loc=TextRange(pos=0, end=0), nodes=[]), dotDotDotToken=n:${identity + 1}, name=n:${identity + 2}, ` +
      `questionToken=n:${identity + 3}, type=n:${identity + 4}, initializer=ready-default(root=n:${identity + 5}), ` +
      `tsonic=TypedParameter(declaration=def:"${ownerId}", local=${localWire}, storage=t:0, passing="by-value", initializer=body:"${bodyId}", role="default"))`,
    `DotDotDotToken(${syntaxHeaderWire(identity + 1, identity)}, tsonic=null)`, codecNameWire(identity + 2, identity),
    `QuestionToken(${syntaxHeaderWire(identity + 3, identity)}, tsonic=null)`, codecTypeWire(identity + 4, identity),
    codecNameWire(identity + 5, identity),
  ];
}

test("infer types retain the complete real type-parameter declaration", () => {
  assertSyntaxPayload({ ...header(4, 2), kind: "InferType", typeParameter: codecTypeParameter(5, 4),
    tsonic: { type: 0, declarations: [] } }, [
    `InferType(${syntaxHeaderWire(4, 2)}, typeParameter=n:5, tsonic=TypedType(type=t:0, declarations=[]))`,
    ...codecTypeParameterDefinitions(5, 4),
  ], "infer type");
});

test("mapped types retain both modifier tokens, declaration, remapping and member vector", () => {
  assertSyntaxPayload({ ...header(4, 2), kind: "MappedType",
    readonlyToken: { ...header(5, 4), kind: "PlusToken", tsonic: null }, typeParameter: codecTypeParameter(6, 4),
    nameType: codecType(11, 4), questionToken: { ...header(12, 4), kind: "MinusToken", tsonic: null },
    type: codecType(13, 4), members: nodeList(), tsonic: { type: 0, declarations: [] } }, [
    `MappedType(${syntaxHeaderWire(4, 2)}, readonlyToken=n:5, typeParameter=n:6, nameType=n:11, questionToken=n:12, ` +
      'type=n:13, members=NodeList(loc=TextRange(pos=0, end=0), nodes=[]), tsonic=TypedType(type=t:0, declarations=[]))',
    `PlusToken(${syntaxHeaderWire(5, 4)}, tsonic=null)`, ...codecTypeParameterDefinitions(6, 4), codecTypeWire(11, 4),
    `MinusToken(${syntaxHeaderWire(12, 4)}, tsonic=null)`, codecTypeWire(13, 4),
  ], "mapped type");
});

test("the TIR codec rejects the retired owner and index type-parameter identity", () => {
  const { expected } = syntaxPayloadCase(codecTypeParameter(4, 2), codecTypeParameterDefinitions(4, 2));
  assert.equal(product.parseTir(expected).kind, "parsed");
  const oldField = `identity=TypeParameterIdentity(owner=def:"${ownerId}", index=0)`;
  for (const wire of [
    expected.replace("TypeParameter(declaration=", `TypeParameter(${oldField}, declaration=`),
    expected.replace(`declaration=${codecParameterWire}`, oldField),
  ]) {
    assert.notEqual(wire, expected);
    assert.notEqual(product.parseTir(wire).kind, "parsed");
  }
});

for (const kind of ["FunctionType", "ConstructorType", "CallSignature", "ConstructSignature"]) {
  test(`the complete ${kind} retains every callable syntax and phase field`, () => {
    const typeKind = kind === "FunctionType" || kind === "ConstructorType";
    const fields = { typeParameters: nodeList([codecTypeParameter(5, 4)]), parameters: nodeList([codecParameter(10, 4)]),
      type: codecType(16, 4), fullSignature: codecType(17, 4) };
    if (typeKind) fields.modifiers = nodeList();
    assertSyntaxPayload({ ...header(4, 2), kind, ...fields, tsonic: typeKind ? { type: 0, declarations: [] } : codecCallable }, [
      `${kind}(${syntaxHeaderWire(4, 2)}, ${typeKind ? "modifiers=ModifierList(loc=TextRange(pos=0, end=0), nodes=[]), " : ""}` +
        'typeParameters=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:5]), ' +
        'parameters=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:10]), type=n:16, fullSignature=n:17, ' +
        `tsonic=${typeKind ? "TypedType(type=t:0, declarations=[])" : codecCallableWire})`,
      ...codecTypeParameterDefinitions(5, 4), ...codecParameterDefinitions(10, 4), codecTypeWire(16, 4), codecTypeWire(17, 4),
    ], kind);
  });
}

test("type predicates retain both asserts syntax and actual nullable narrowing fact", () => {
  assertSyntaxPayload({ ...header(4, 2), kind: "TypePredicate",
    assertsModifier: { ...header(5, 4), kind: "AssertsKeyword", tsonic: null }, parameterName: codecName(6, 4),
    type: codecType(7, 4), tsonic: { parameter: ownerId, narrowed: 0, asserts: true } }, [
    `TypePredicate(${syntaxHeaderWire(4, 2)}, assertsModifier=n:5, parameterName=n:6, type=n:7, ` +
      `tsonic=TypedPredicate(parameter=def:"${ownerId}", narrowed=t:0, asserts=true))`,
    `AssertsKeyword(${syntaxHeaderWire(5, 4)}, tsonic=null)`, codecNameWire(6, 4), codecTypeWire(7, 4),
  ], "type predicate");
});

function assertEvidenceRecord(value, wire, name) {
  const body = emptyModuleBody();
  body.evidence = [value];
  const baseline = readFileSync(resolve(repository, functionDirectory, "empty-module.input.tir"), "utf8");
  assertBodyRoundTrip(body, baseline.replace("evidence=[]", `evidence=[${wire}]`), name);
}

const evidenceSource = { kind: "body", value: { body: bodyId, node: 0 } };
const evidenceSourceWire = `body(value=NodeRef(body=body:"${bodyId}", node=n:0))`;
const evidenceFieldsWire = `type=t:0, component=${evidenceSourceWire}`;
for (const category of ["number", "bigint", "boolean", "string", "symbol", "absence", "object", "callable"]) {
  test(`a complete ${category} category evidence record retains the exact closed tag`, () => {
    assertEvidenceRecord({ ...typeEvidence({ kind: "known", category }) },
      `TypeEvidence(${evidenceFieldsWire}, category=known(category="${category}"), numeric=null, sum=null, nominal=null, pointer=null)`, category);
  });
}

test("parameter category evidence retains its real declaration ID", () => {
  assertEvidenceRecord(typeEvidence({ kind: "parameter", declaration: ownerId }),
    `TypeEvidence(${evidenceFieldsWire}, category=parameter(declaration=def:"${ownerId}"), numeric=null, sum=null, nominal=null, pointer=null)`,
    "parameter category");
});

for (const kind of ["literal", "declared", "operation", "application"]) {
  test(`complete ${kind} numeric evidence retains its producer/category and authored exact literal`, () => {
    const literal = { kind: "number", token: "1.25", value: { numerator: 5n, denominator: 4n, negativeZero: false } };
    const numeric = { producer: { body: bodyId, node: 0 }, kind, category: { kind: "known", category: "number" }, authored: literal };
    assertEvidenceRecord({ ...typeEvidence({ kind: "known", category: "number" }), numeric },
      `TypeEvidence(${evidenceFieldsWire}, category=known(category="number"), numeric=NumericEvidence(` +
      `producer=NodeRef(body=body:"${bodyId}", node=n:0), kind="${kind}", category=known(category="number"), ` +
      'authored=number(token="1.25", value=ExactRational(numerator=5n, denominator=4n, negativeZero=false))), ' +
      'sum=null, nominal=null, pointer=null)', `numeric ${kind}`);
  });
}

for (const kind of ["authored", "inferred"]) {
  test(`complete ${kind} sum evidence retains all actual arm and binding fields`, () => {
    const bindings = { classBindings: [{ kind: "bound", parameter: codecParameterDefinition, type: 0 }],
      methodBindings: [{ kind: "rigid", parameter: codecParameterDefinition }],
      capturedBindings: [{ kind: "bound", parameter: codecParameterDefinition, type: 0 }],
      selfBindings: [{ kind: "bound", owner: ownerId, type: 0 }, { kind: "rigid", owner: ownerId }] };
    const bindingsWire = `BindingVector(classBindings=[bound(parameter=${codecParameterWire}, type=t:0)], ` +
      `methodBindings=[rigid(parameter=${codecParameterWire})], capturedBindings=[bound(parameter=${codecParameterWire}, type=t:0)], ` +
      `selfBindings=[bound(owner=def:"${ownerId}", type=t:0), rigid(owner=def:"${ownerId}")])`;
    const sum = { kind, component: evidenceSource, bindings, arms: [{ authoredIndex: 0, component: evidenceSource, member: 0 }] };
    assertEvidenceRecord({ ...typeEvidence({ kind: "dynamic" }), sum },
      `TypeEvidence(${evidenceFieldsWire}, category=dynamic(), numeric=null, sum=SumEvidence(kind="${kind}", ` +
      `component=${evidenceSourceWire}, bindings=${bindingsWire}, arms=[SumArmRole(authoredIndex=0, ` +
      `component=${evidenceSourceWire}, member=t:0)]), nominal=null, pointer=null)`, `sum ${kind}`);
  });
}

const pointerEvidenceCases = [
  [{ kind: "raw-address" }, "raw-address()"],
  ...["readonly", "readwrite", "unspecified"].map(mutability => [{ kind: "typed-location", pointee: 0, mutability },
    `typed-location(pointee=t:0, mutability="${mutability}")`]),
  [{ kind: "native-pointer", declaration: ownerId }, `native-pointer(declaration=def:"${ownerId}")`],
  [{ kind: "function-pointer", declaration: ownerId, parameters: [0], result: 0, abi: ["C", "cdecl"] },
    `function-pointer(declaration=def:"${ownerId}", parameters=[t:0], result=t:0, abi=["C", "cdecl"])`],
];
for (const [pointer, wire] of pointerEvidenceCases) {
  test(`complete ${wire} pointer evidence retains actual carrier metadata`, () => {
    assertEvidenceRecord({ ...typeEvidence({ kind: "dynamic" }), nominal: ownerId, pointer },
      `TypeEvidence(${evidenceFieldsWire}, category=dynamic(), numeric=null, sum=null, nominal=def:"${ownerId}", pointer=${wire})`, wire);
  });
}

function assertCoreField(field, value, expectedField, name) {
  const fields = { provider: "available(value=null)",
    markers: "available(value=HirMarkersCapture(struct=null, field=null, defaultValue=null, jsString=false, application=available(value=null)))",
    pointerType: "available(value=null)", pointerOperation: "available(value=null)", fieldBinding: "available(value=null)",
    recordBinding: "available(value=null)", attribute: "available(value=null)",
    safety: "available(value=null)", argumentPassing: "available(value=null)", flowState: "available(value=null)", [field]: expectedField };
  const coreWire = `HirCoreCapture(provider=${fields.provider}, markers=${fields.markers}, pointerType=${fields.pointerType}, ` +
    `pointerOperation=${fields.pointerOperation}, fieldBinding=${fields.fieldBinding}, recordBinding=${fields.recordBinding}, ` +
    `attribute=${fields.attribute}, safety=${fields.safety}, ` +
    `argumentPassing=${fields.argumentPassing}, flowState=${fields.flowState})`;
  const input = { context: codecContext, captured: { ...emptyCore(), [field]: value }, declaration: ownerId,
    operands: [codecEvidence], result: codecEvidence, permissionScope: codecReference };
  const phase = { ...typedValue(), role: "value", operation: { kind: "deferred", deferred: { invocation: { rule: "core", input }, result: 0 } } };
  const phaseWire = `TypedPrefix(${valueWire}, role="value", operation=deferred(deferred=DeferredDecision(invocation=DeferredInvocation(rule="core", ` +
    `input=CoreInput(context=${codecContextWire}, captured=${coreWire}, declaration=def:"${ownerId}", ` +
    `operands=[${codecEvidenceWire}], result=${codecEvidenceWire}, permissionScope=${codecReferenceWire})), result=t:0)))`;
  assertSyntaxPayload({ ...header(4, 2), kind: "PrefixUnaryExpression", operator: "PlusToken", operand: codecName(5, 4), tsonic: phase }, [
    `PrefixUnaryExpression(${syntaxHeaderWire(4, 2)}, operator="PlusToken", operand=n:5, tsonic=${phaseWire})`, codecNameWire(5, 4),
  ], name);
}

test("TIR captured facts preserve all original cause positions without substituting or emitting a diagnostic", () => {
  const fixture = operationScenario();
  const causes = [...capturedCauses(fixture.body.root.origin.module, ownerId, bodyId), ...[
    { kind: "execution-result", execution: "opaque provided count 1" },
    { kind: "execution-source-node", execution: "opaque provided count 2", node: { body: bodyId, node: 0 } },
  ].map(position => ({ kind: "unit", unit: { request: { query: "bodyFactsOf", key: "first" }, position } }))];
  const captured = { ...emptyCore(), provider: { kind: "unavailable", reason: "checker-error", causes } };
  const input = { context: codecContext, captured, declaration: ownerId,
    operands: [codecEvidence], result: codecEvidence, permissionScope: codecReference };
  fixture.typed.tsonic.operation = { kind: "deferred", deferred: { invocation: { rule: "core", input }, result: 1 } };
  const text = product.printTir(fixture.body);
  const parsed = product.parseTir(text);
  assert.equal(parsed.kind, "parsed", parsed.kind === "parsed" ? undefined
    : JSON.stringify({ ...parsed, near: text.slice(Math.max(0, parsed.offset - 70), parsed.offset + 70) }));
  assert.deepEqual(parsed.value.root.statements.nodes[0].node.expression.tsonic.operation.deferred.invocation.input.captured.provider.causes, causes);
  assert.equal(product.parseTir(text.replace("causes=[diagnostic(", "removedCauses=[diagnostic(")).kind, "invalid-text");
  assert.equal(product.parseTir(text.replace("execution-source-node(execution=", "execution-source-node(removed=")).kind, "invalid-text");
  assert.equal(product.parseTir(text.replace('execution-source-node(execution="opaque provided count 2", node=NodeRef(',
    'execution-source-node(execution="opaque provided count 2", node=ItemNodeRef(')).kind, "invalid-text");
  const group = causes.find(cause => cause.kind === "unit" && cause.unit.position.kind === "inference-variable").unit.position.group;
  for (const malformed of ["7", "null", "true", JSON.stringify("not-a-group")])
    assert.equal(product.parseTir(text.replace(`group=${JSON.stringify(group)}`, `group=${malformed}`)).kind, "invalid-text");
});

for (const captureKind of ["core", "markers", "field-binding", "record-binding"]) {
  test(`TIR ${captureKind} unavailable facts retain each supplied original nonempty cause vector`, () => {
    const fixture = operationScenario();
    const causes = capturedCauses(fixture.body.root.origin.module, ownerId, bodyId);
    const unavailable = { kind: "unavailable", reason: "checker-error", causes };
    let captured = emptyCore();
    switch (captureKind) {
      case "core":
        captured = Object.fromEntries(Object.keys(captured).map(field => [field, unavailable]));
        break;
      case "markers":
        captured.markers = available({ struct: { valueType: false, fields: unavailable },
          field: { name: "field", typeNode: codecSource, type: unavailable, readonly: false },
          defaultValue: null, jsString: false, application: available(null) });
        break;
      case "field-binding":
        captured.fieldBinding = available({ occurrence: codecReference, bindings: unavailable,
          owner: unavailable, pointee: unavailable, fieldExpression: codecReference,
          field: unavailable, pointerExpression: codecReference });
        break;
      case "record-binding":
        captured.recordBinding = available({ occurrence: codecReference, bindings: unavailable,
          source: unavailable, layoutExpression: codecReference, layout: unavailable,
          fields: [{ expression: codecReference, binding: codecReference }] });
        break;
    }
    const input = { context: codecContext, captured, declaration: ownerId,
      operands: [codecEvidence], result: codecEvidence, permissionScope: codecReference };
    fixture.typed.tsonic.operation = { kind: "deferred", deferred: { invocation: { rule: "core", input }, result: 1 } };
    const parsed = product.parseTir(product.printTir(fixture.body));
    assert.equal(parsed.kind, "parsed");
    assert.deepEqual(parsed.value.root.statements.nodes[0].node.expression.tsonic.operation.deferred.invocation.input.captured, captured);
  });
}

for (const field of ["provider", "markers", "pointerType", "pointerOperation", "fieldBinding", "recordBinding", "attribute", "safety", "argumentPassing", "flowState"]) {
  test(`a real unavailable ${field} capture retains its reason instead of inventing data`, () => {
    assertCoreField(field, { kind: "unavailable", reason: "parameter-dependent", causes: [] }, 'unavailable(reason="parameter-dependent", causes=[])', field);
  });
}

// The reasons of missing evidence have their own arms in HIR's captured fact; TIR's text keeps each one.
for (const field of ["provider", "markers", "pointerType", "pointerOperation", "fieldBinding", "recordBinding", "attribute", "safety", "argumentPassing", "flowState"])
  for (const reason of ["missing-original-component", "incomplete-association", "unsupported-checked-structure"])
    test(`a real unavailable ${field} capture retains the reason ${reason}`, () => {
      assertCoreField(field, { kind: "unavailable", reason, causes: [] }, `unavailable(reason="${reason}", causes=[])`, `${field}/${reason}`);
    });

// Binding captures (SCHEMA-MIGRATION.md 5.2, TB1): the saved text of each record, with every inner fact available and unavailable.
const emptyBindingsWire = "BindingVector(classBindings=[], methodBindings=[], capturedBindings=[], selfBindings=[])";
const unavailableWire = reason => `unavailable(reason="${reason}", causes=[])`;
for (const [name, changes, wires] of [
  ["complete", {}, {}],
  ["bindings unavailable", { bindings: { kind: "unavailable", reason: "parameter-dependent", causes: [] } }, { bindings: unavailableWire("parameter-dependent") }],
  ["owner unavailable", { owner: { kind: "unavailable", reason: "checker-error", causes: [] } }, { owner: unavailableWire("checker-error") }],
  ["pointee unavailable", { pointee: { kind: "unavailable", reason: "not-provided", causes: [] } }, { pointee: unavailableWire("not-provided") }],
  ["field unavailable", { field: { kind: "unavailable", reason: "not-provided", causes: [] } }, { field: unavailableWire("not-provided") }],
  ...["missing-original-component", "incomplete-association", "unsupported-checked-structure"].map(reason => [
    `all inner facts unavailable/${reason}`,
    { bindings: { kind: "unavailable", reason, causes: [] }, owner: { kind: "unavailable", reason, causes: [] },
      pointee: { kind: "unavailable", reason, causes: [] }, field: { kind: "unavailable", reason, causes: [] } },
    { bindings: unavailableWire(reason), owner: unavailableWire(reason), pointee: unavailableWire(reason), field: unavailableWire(reason) },
  ]),
]) test(`a saved field binding capture retains its occurrence, types, binding vector and field descriptor: ${name}`, () => {
  const value = { occurrence: codecReference, bindings: available(emptyBindings()), owner: available(0), pointee: available(0),
    fieldExpression: codecReference, field: available(codecSource), pointerExpression: codecReference, ...changes };
  const wire = { bindings: `available(value=${emptyBindingsWire})`, owner: "available(value=t:0)", pointee: "available(value=t:0)",
    field: `available(value=${codecSourceWire})`, ...wires };
  assertCoreField("fieldBinding", available(value), `available(value=HirFieldBindingCapture(occurrence=${codecReferenceWire}, ` +
    `bindings=${wire.bindings}, owner=${wire.owner}, pointee=${wire.pointee}, fieldExpression=${codecReferenceWire}, ` +
    `field=${wire.field}, pointerExpression=${codecReferenceWire}))`, `field binding ${name}`);
});
for (const [name, changes, wires] of [
  ["complete", {}, {}],
  ["no field entries", { fields: [] }, { fields: "[]" }],
  ["bindings unavailable", { bindings: { kind: "unavailable", reason: "parameter-dependent", causes: [] } }, { bindings: unavailableWire("parameter-dependent") }],
  ["source unavailable", { source: { kind: "unavailable", reason: "checker-error", causes: [] } }, { source: unavailableWire("checker-error") }],
  ["layout unavailable", { layout: { kind: "unavailable", reason: "not-provided", causes: [] } }, { layout: unavailableWire("not-provided") }],
  ...["missing-original-component", "incomplete-association", "unsupported-checked-structure"].map(reason => [
    `all inner facts unavailable/${reason}`,
    { bindings: { kind: "unavailable", reason, causes: [] }, source: { kind: "unavailable", reason, causes: [] }, layout: { kind: "unavailable", reason, causes: [] } },
    { bindings: unavailableWire(reason), source: unavailableWire(reason), layout: unavailableWire(reason) },
  ]),
]) test(`a saved record binding capture retains its source, layout descriptor and field entries: ${name}`, () => {
  const value = { occurrence: codecReference, bindings: available(emptyBindings()), source: available(0), layoutExpression: codecReference,
    layout: available(codecSource), fields: [{ expression: codecReference, binding: codecReference }], ...changes };
  const wire = { bindings: `available(value=${emptyBindingsWire})`, source: "available(value=t:0)", layout: `available(value=${codecSourceWire})`,
    fields: `[HirRecordFieldBindingCapture(expression=${codecReferenceWire}, binding=${codecReferenceWire})]`, ...wires };
  assertCoreField("recordBinding", available(value), `available(value=HirRecordBindingCapture(occurrence=${codecReferenceWire}, ` +
    `bindings=${wire.bindings}, source=${wire.source}, layoutExpression=${codecReferenceWire}, layout=${wire.layout}, fields=${wire.fields}))`,
    `record binding ${name}`);
});

test("nonempty struct/field/default markers retain actual saved type and source records", () => {
  const field = { name: "field", typeNode: codecSource, type: available(0), readonly: true };
  const fieldWire = `HirFieldMarkerCapture(name="field", typeNode=${codecSourceWire}, type=available(value=t:0), readonly=true)`;
  const markers = { struct: { valueType: true, fields: available([field]) }, field,
    defaultValue: { typeNode: codecSource, type: available(0) }, jsString: true,
    application: available({ role: "field", occurrence: codecReference, declaration: ownerId }) };
  assertCoreField("markers", available(markers), `available(value=HirMarkersCapture(struct=Record(valueType=true, ` +
    `fields=available(value=[${fieldWire}])), field=${fieldWire}, defaultValue=Record(typeNode=${codecSourceWire}, ` +
    `type=available(value=t:0)), jsString=true, application=available(value=HirMarkerApplication(role="field", ` +
    `occurrence=${codecReferenceWire}, declaration=def:"${ownerId}"))))`, "complete markers");
});

test("unavailable marker fields and captured types remain distinct genuine capture arms", () => {
  const markers = { struct: { valueType: false, fields: { kind: "unavailable", reason: "checker-error", causes: [] } },
    field: { name: "field", typeNode: codecSource, type: { kind: "unavailable", reason: "not-provided", causes: [] }, readonly: false },
    defaultValue: null, jsString: false, application: { kind: "unavailable", reason: "incomplete-association", causes: [] } };
  assertCoreField("markers", available(markers), 'available(value=HirMarkersCapture(struct=Record(valueType=false, ' +
    'fields=unavailable(reason="checker-error", causes=[])), field=HirFieldMarkerCapture(name="field", ' +
    `typeNode=${codecSourceWire}, type=unavailable(reason="not-provided", causes=[]), readonly=false), defaultValue=null, jsString=false, ` +
    'application=unavailable(reason="incomplete-association", causes=[])))',
    "unavailable marker data");
});

const capturedType = { type: available(0), component: { root: codecSource, path: [] } };
const capturedTypeWire = `HirCapturedType(type=available(value=t:0), component=TypeComponent(root=${codecSourceWire}, path=[]))`;
for (const [value, wire] of [
  [{ kind: "raw-address" }, "raw-address()"],
  [{ kind: "typed-location", pointee: capturedType, mutability: "readwrite" }, `typed-location(pointee=${capturedTypeWire}, mutability="readwrite")`],
  [{ kind: "native-pointer", declaration: ownerId }, `native-pointer(declaration=def:"${ownerId}")`],
  [{ kind: "function-pointer", declaration: ownerId, parameters: [capturedType], result: capturedType, abi: ["C"] },
    `function-pointer(declaration=def:"${ownerId}", parameters=[${capturedTypeWire}], result=${capturedTypeWire}, abi=["C"])`],
]) {
  test(`saved pointer-type capture ${value.kind} has a full independent codec vector`, () => {
    assertCoreField("pointerType", available(value), `available(value=${wire})`, value.kind);
  });
}

for (const operation of ["address-of", "allocate", "load", "store", "equal-pointer", "hash-pointer", "bind-pointer", "project-pointer"]) {
  test(`saved typed-location ${operation} retains its authored arguments and actual selection state`, () => {
    const value = { family: "typed-location", operation, exportName: operation, arguments: [codecSource],
      typeArguments: [codecSource], selection: "conditional-candidates", pointee: "available" };
    assertCoreField("pointerOperation", available(value), 'available(value=HirPointerOperationCapture(family="typed-location", ' +
      `operation="${operation}", exportName="${operation}", arguments=[${codecSourceWire}], typeArguments=[${codecSourceWire}], ` +
      'selection="conditional-candidates", pointee="available"))', operation);
  });
}

const pointerOperationCases = [
  [{ family: "typed-location", operation: "view", pointer: codecSource, read: codecSource, write: codecSource, optional: true },
    `family="typed-location", operation="view", pointer=${codecSourceWire}, read=${codecSourceWire}, write=${codecSourceWire}, optional=true`],
  [{ family: "native-pointer", operation: "load", pointer: codecSource }, `family="native-pointer", operation="load", pointer=${codecSourceWire}`],
  [{ family: "native-pointer", operation: "store", pointer: codecSource, value: codecSource },
    `family="native-pointer", operation="store", pointer=${codecSourceWire}, value=${codecSourceWire}`],
  [{ family: "native-pointer", operation: "offset", pointer: codecSource, offset: codecSource },
    `family="native-pointer", operation="offset", pointer=${codecSourceWire}, offset=${codecSourceWire}`],
  [{ family: "raw-address", operation: "bind-raw-pointer", identity: codecSource }, `family="raw-address", operation="bind-raw-pointer", identity=${codecSourceWire}`],
  [{ family: "raw-address", operation: "equal-raw-pointer", left: codecSource, right: codecSource },
    `family="raw-address", operation="equal-raw-pointer", left=${codecSourceWire}, right=${codecSourceWire}`],
  [{ family: "raw-address", operation: "hash-raw-pointer", pointer: codecSource }, `family="raw-address", operation="hash-raw-pointer", pointer=${codecSourceWire}`],
  [{ family: "raw-memory", operation: "to-raw", pointer: codecSource, layout: codecSource },
    `family="raw-memory", operation="to-raw", pointer=${codecSourceWire}, layout=${codecSourceWire}`],
  [{ family: "raw-memory", operation: "reinterpret", raw: codecSource, layout: codecSource },
    `family="raw-memory", operation="reinterpret", raw=${codecSourceWire}, layout=${codecSourceWire}`],
  [{ family: "raw-memory", operation: "byte-offset", raw: codecSource, offset: codecSource,
    integer: { runtimeBase: "bigint", signedness: "signed", width: 128 }, dataLayout: codecSource },
    `family="raw-memory", operation="byte-offset", raw=${codecSourceWire}, offset=${codecSourceWire}, ` +
    `integer=HirIntegerOperandCapture(runtimeBase="bigint", signedness="signed", width=128), dataLayout=${codecSourceWire}`],
  [{ family: "keep-alive", operation: "keep-alive", value: codecSource }, `family="keep-alive", operation="keep-alive", value=${codecSourceWire}`],
];
for (const [selection, pointee] of [
  ["applicable", "available"], ["conditional-candidates", "unvisited"], ["untyped", "not-applicable"], ["unvisited", "missing"],
]) {
  test(`pointer capture selection ${selection} and pointee ${pointee} retain their actual saved states`, () => {
    const value = { family: "typed-location", operation: "load", exportName: "load", arguments: [], typeArguments: [], selection, pointee };
    assertCoreField("pointerOperation", available(value), 'available(value=HirPointerOperationCapture(family="typed-location", ' +
      `operation="load", exportName="load", arguments=[], typeArguments=[], selection="${selection}", pointee="${pointee}"))`,
    `${selection}/${pointee}`);
  });
}
for (const width of [8, 16, 32, 64, 128]) {
  test(`a saved raw-memory operand retains the exact admitted ${width}-bit literal width`, () => {
    const runtimeBase = width < 64 ? "number" : "bigint";
    const value = { family: "raw-memory", operation: "byte-offset", raw: codecSource, offset: codecSource,
      integer: { runtimeBase, signedness: "signed", width }, dataLayout: codecSource };
    assertCoreField("pointerOperation", available(value), 'available(value=HirPointerOperationCapture(family="raw-memory", ' +
      `operation="byte-offset", raw=${codecSourceWire}, offset=${codecSourceWire}, integer=HirIntegerOperandCapture(` +
      `runtimeBase="${runtimeBase}", signedness="signed", width=${width}), dataLayout=${codecSourceWire}))`, `${width}`);
  });
}
for (const width of [32, 64]) {
  const integer = { width, runtimeBase: width === 32 ? "number" : "bigint", signedness: "unsigned" };
  const integerWire = `HirAddressIntegerCapture(width=${width}, runtimeBase="${integer.runtimeBase}", signedness="unsigned")`;
  pointerOperationCases.push(
    [{ family: "raw-memory", operation: "raw-to-address-integer", raw: codecSource, integer, dataLayout: codecSource },
      `family="raw-memory", operation="raw-to-address-integer", raw=${codecSourceWire}, integer=${integerWire}, dataLayout=${codecSourceWire}`],
    [{ family: "raw-memory", operation: "address-integer-to-raw", address: codecSource, integer, dataLayout: codecSource },
      `family="raw-memory", operation="address-integer-to-raw", address=${codecSourceWire}, integer=${integerWire}, dataLayout=${codecSourceWire}`],
  );
}
for (const [value, fields] of pointerOperationCases) {
  test(`saved ${value.family}/${value.operation} retains every closed raw capture field`, () => {
    assertCoreField("pointerOperation", available(value), `available(value=HirPointerOperationCapture(${fields}))`, `${value.family}/${value.operation}`);
  });
}

for (const role of ["declaration", "argument"]) {
  test(`the ${role} argument-passing capture retains its true closed carrier`, () => {
    assertCoreField("argumentPassing", available({ role, mode: "borrow-mut", ...(role === "argument" ? { storageExpression: codecSource } : {}) }),
      `available(value=HirArgumentPassingCapture(role="${role}", mode="borrow-mut"` +
      `${role === "argument" ? `, storageExpression=${codecSourceWire}` : ""}))`, `passing ${role}`);
  });
}
for (const state of ["moved", "borrowed-shared", "borrowed-mut"]) {
  test(`a real ${state} flow capture preserves its exact state`, () => {
    assertCoreField("flowState", available(state), `available(value="${state}")`, state);
  });
}
test("an available provider capture retains its authentic declared identity", () => {
  assertCoreField("provider", available(ownerId), `available(value=def:"${ownerId}")`, "provider");
});

for (const kind of ["builder-state", "application"]) {
  test(`the saved ${kind} attribute capture retains every actual member/placement/target field`, () => {
    const value = { kind, occurrence: codecSource, applicationTarget: codecSource,
      selectedMember: { selectedDeclaration: codecSource, declarations: [codecSource] }, applicationMemberKind: "method",
      applicationPlacement: "constructor", applicationParameterName: "parameter", applicationTargetSpecifier: "specifier",
      ...(kind === "application" ? { invocation: codecSource } : {}) };
    const wire = `${kind}(occurrence=${codecSourceWire}, applicationTarget=${codecSourceWire}, ` +
      `selectedMember=Record(selectedDeclaration=${codecSourceWire}, declarations=[${codecSourceWire}]), ` +
      'applicationMemberKind="method", applicationPlacement="constructor", applicationParameterName="parameter", ' +
      `applicationTargetSpecifier="specifier"${kind === "application" ? `, invocation=${codecSourceWire}` : ""})`;
    assertCoreField("attribute", available(value), `available(value=${wire})`, kind);
  });
}

const safetyCases = [
  [{ family: "unsafe-context", operation: "expression", expression: codecSource },
    `family="unsafe-context", operation="expression", expression=${codecSourceWire}`],
  [{ family: "unsafe-context", operation: "remaining-block", firstDirectStatement: true },
    'family="unsafe-context", operation="remaining-block", firstDirectStatement=true'],
  [{ family: "safety", operation: "root", form: "type", target: codecSource },
    `family="safety", operation="root", form="type", target=${codecSourceWire}`],
  [{ family: "safety", operation: "root", form: "value", target: null },
    'family="safety", operation="root", form="value", target=null'],
  [{ family: "safety", operation: "select-member", predecessor: codecSource, memberKind: "indexer",
    selection: { kind: "selected", expression: codecSource, declaration: codecSource, declarations: [codecSource] } },
    `family="safety", operation="select-member", predecessor=${codecSourceWire}, memberKind="indexer", ` +
    `selection=selected(expression=${codecSourceWire}, declaration=${codecSourceWire}, declarations=[${codecSourceWire}])`],
  [{ family: "safety", operation: "select-member", predecessor: null, memberKind: "property",
    selection: { kind: "unavailable", reason: "member-evidence" } },
    'family="safety", operation="select-member", predecessor=null, memberKind="property", selection=unavailable(reason="member-evidence")'],
  [{ family: "safety", operation: "placement", predecessor: codecSource, placement: "getter" },
    `family="safety", operation="placement", predecessor=${codecSourceWire}, placement="getter"`],
  [{ family: "safety", operation: "apply", predecessor: codecSource, contract: "requires-unsafe" },
    `family="safety", operation="apply", predecessor=${codecSourceWire}, contract="requires-unsafe"`],
];
for (const [fields, wire] of safetyCases) {
  test(`actual saved safety ${wire} retains every closed capture field`, () => {
    assertCoreField("safety", available({ occurrence: codecSource, provider: ownerId, ...fields }),
      `available(value=HirSafetyCapture(occurrence=${codecSourceWire}, provider=def:"${ownerId}", ${wire}))`, fields.operation);
  });
}

const codecApplicationDecision = { candidate: 0, advertised: codecEndpoint, api: { ...codecEndpoint, role: "api-body" },
  bindings: emptyBindings(), implementationBindings: emptyBindings(), parameters: [
    { kind: "argument", parameter: 0, argument: 0, component: 0, passing: "by-value" },
    { kind: "default", parameter: 1, initializer: bodyId }, { kind: "omitted", parameter: 2, type: 0 },
    { kind: "rest", parameter: 3, arguments: [0, 1], passing: "move" },
  ], completion: { signature: 0, completion: 0, yielded: 0, sent: 0 }, result: 0, activation: null };
const codecApplicationDecisionWire = `ApplicationDecision(candidate=0, advertised=${codecEndpointWire}, ` +
  `api=HirCallableEndpoint(declaration=def:"${ownerId}", role="api-body", signature=sig:0, body=body:"${bodyId}"), ` +
  `bindings=${codecBindingsWire}, implementationBindings=${codecBindingsWire}, parameters=[` +
  'argument(parameter=0, argument=0, component=0, passing="by-value"), ' +
  `default(parameter=1, initializer=body:"${bodyId}"), omitted(parameter=2, type=t:0), ` +
  'rest(parameter=3, arguments=[0, 1], passing="move")], ' +
  'completion=CompletionEndpoint(signature=sig:0, completion=t:0, yielded=t:0, sent=t:0), result=t:0, activation=null)';
const codecMemberDecision = { key: codecKey, origins: [codecMemberOrigin, { kind: "declared", declaration: ownerId },
  { kind: "class-prototype", owner: ownerId }, { kind: "intrinsic", symbol: "global-this" },
  { kind: "intrinsic", symbol: "undefined" }, { kind: "source-member", occurrence: codecReference }], selectedDeclarations: [ownerId], primary: ownerId, read: 0, write: 0,
  getter: codecEndpoint, setter: codecEndpoint, bindings: emptyBindings(), location: { kind: "accessor" } };
const codecMemberDecisionWire = `MemberDecision(key=${codecKeyWire}, origins=[${codecMemberOriginWire}, ` +
  `declared(declaration=def:"${ownerId}"), class-prototype(owner=def:"${ownerId}"), intrinsic(symbol="global-this"), intrinsic(symbol="undefined"), source-member(occurrence=${codecReferenceWire})], selectedDeclarations=[def:"${ownerId}"], ` +
  `primary=def:"${ownerId}", read=t:0, write=t:0, getter=${codecEndpointWire}, setter=${codecEndpointWire}, bindings=${codecBindingsWire}, location=accessor())`;
const codecPart = { part: 0, source: codecReference, destination: { root: codecSource, path: [] }, member: codecMemberDecision,
  embedding: { kind: "identity" } };
const codecPartWire = `ConstructionPartDecision(part=0, source=${codecReferenceWire}, destination=TypeComponent(root=${codecSourceWire}, path=[]), ` +
  `member=${codecMemberDecisionWire}, embedding=identity())`;
const selectorCases = [
  ...["class-value", "optional-value", "array-element", "intersection-result", "projection-source", "awaited"]
    .map(kind => [{ kind }, `${kind}()`]),
  [{ kind: "construction-argument", definition: { occurrence: codecReference, captures: [{ body: bodyId, local: 0 }] }, index: 0 },
    `construction-argument(definition=ConstructionDefinition(occurrence=${codecReferenceWire}, captures=[${localWire}]), index=0)`],
  ...["tuple-element", "union-member", "argument-place", "parameter-place", "intersection-member"]
    .map(kind => [{ kind, index: 0 }, `${kind}(index=0)`]),
  ...["argument-tail", "parameter-tail"].map(kind => [{ kind, start: 1 }, `${kind}(start=1)`]),
  [{ kind: "member", origin: codecMemberOrigin }, `member(origin=${codecMemberOriginWire})`],
  ...["index-key", "index-value"].map(kind => [{ kind, origin: codecSource, key: 0 }, `${kind}(origin=${codecSourceWire}, key=t:0)`]),
  [{ kind: "parameter", signature: 0, index: 0 }, "parameter(signature=sig:0, index=0)"],
  [{ kind: "receiver", signature: 0 }, "receiver(signature=sig:0)"],
  [{ kind: "signature-tail", signature: 0, start: 1, readonly: true }, "signature-tail(signature=sig:0, start=1, readonly=true)"],
  [{ kind: "tuple-slice", start: 1, endCount: 2, readonly: false }, "tuple-slice(start=1, endCount=2, readonly=false)"],
  [{ kind: "result", signature: 0 }, "result(signature=sig:0)"],
  [{ kind: "type-argument", declaration: ownerId, index: 0 }, `type-argument(declaration=def:"${ownerId}", index=0)`],
  ...["authored", "inferred"].map(sumOrigin => [{ kind: "sum-arm", family: { origin: sumOrigin,
    component: { root: codecSource, path: [] }, parameters: [codecParameterDefinition],
    roles: [{ authoredIndex: 0, component: codecSource, member: 0 }] }, index: 0 },
  `sum-arm(family=SumFamily(origin="${sumOrigin}", component=TypeComponent(root=${codecSourceWire}, path=[]), ` +
    `parameters=[${codecParameterWire}], roles=[SumArmRole(authoredIndex=0, ` +
    `component=${codecSourceWire}, member=t:0)]), index=0)`]),
];
for (const [selector, selectorWire] of selectorCases) {
  test(`actual ${selectorWire} correspondence preserves the complete component and proof graph`, () => {
    const from = { root: codecSource, path: [selector] };
    const to = { root: codecSource, path: [] };
    const proof = { steps: [{ from, to, rule: "identity", premises: [] }, { from: to, to, rule: "readonly", premises: [0] }], conclusion: 1 };
    const fromWire = `TypeComponent(root=${codecSourceWire}, path=[${selectorWire}])`;
    const toWire = `TypeComponent(root=${codecSourceWire}, path=[])`;
    const proofWire = `EmbeddingProof(steps=[CorrespondenceStep(from=${fromWire}, to=${toWire}, rule="identity", premises=[]), ` +
      `CorrespondenceStep(from=${toWire}, to=${toWire}, rule="readonly", premises=[0])], conclusion=1)`;
    for (const failure of ["unwind", "abort"]) {
      const narrowing = { kind: "narrowed", source: 0, result: 0, proof, failure };
      const narrowedWire = `type=t:0, convertedType=t:0, conversion=identity(), narrowing=narrowed(source=t:0, result=t:0, ` +
        `proof=${proofWire}, failure="${failure}"), evidenceIndex=0, demand=always()`;
      assertSyntaxPayload({ ...header(4, 2), kind: "ParenthesizedExpression", expression: codecName(5, 4),
        tsonic: { ...typedValue(), narrowing } }, [
        `ParenthesizedExpression(${syntaxHeaderWire(4, 2)}, expression=n:5, tsonic=TypedValue(${narrowedWire}))`, codecNameWire(5, 4),
      ], `${selectorWire} ${failure}`);
    }
  });
}
const codecOriginWire = `Origin(module=mod:"${moduleId}", start=0, length=0, derived=[])`;
const diagnosticCases = [
  [{ kind: "host", name: "H_TEST", rendered: "TSONIC_H_TEST" }, 'host(name="H_TEST", rendered="TSONIC_H_TEST")',
    "error", { kind: "source", origin: origin() }, `source(origin=${codecOriginWire})`, true],
  [{ kind: "host", name: "", rendered: "" }, 'host(name="", rendered="")',
    "warning", { kind: "none" }, "none()", false],
  [{ kind: "checker", number: 2322, rendered: "TS2322" }, 'checker(number=2322, rendered="TS2322")',
    "warning", { kind: "file", path: "/project/module.ts" }, 'file(path="/project/module.ts")', false],
  [{ kind: "extension", number: 9910000, extensionCode: "E_TEST", rendered: "TSEXT9910000" },
    'extension(number=9910000, extensionCode="E_TEST", rendered="TSEXT9910000")', "suggestion", { kind: "none" }, "none()", true],
];
for (const [code, codeWire, severity, site, siteWire, detailed] of diagnosticCases) {
  test(`complete ${code.kind} diagnostic is published through the real text boundary without a branded-code cast`, () => {
    const related = detailed ? [
      { site: { kind: "file", path: "/project/other.ts" }, code: { kind: "checker", number: 1, rendered: "TS1" }, message: "related" },
      { site: { kind: "none" }, code: { kind: "extension", number: 2, extensionCode: "E_RELATED", rendered: "TSEXT2" }, message: "detail" },
    ] : [];
    const argumentsValue = detailed ? [{ kind: "text", value: "text" }, { kind: "integer", value: 1208925819614629174706176n },
      { kind: "number", value: -0 }, { kind: "origin", value: origin() }] : [];
    const diagnostic = { code, severity, site, source: detailed ? "source" : null, evidence: detailed ? ["evidence"] : [],
      message: "message", arguments: argumentsValue, related,
      fix: detailed ? { description: "replace", edits: [{ origin: origin(), replacement: "replacement" }] } : null };
    const diagnosticWire = `Diagnostic(code=${codeWire}, severity="${severity}", site=${siteWire}, ` +
      `source=${detailed ? '"source"' : "null"}, evidence=${detailed ? '["evidence"]' : "[]"}, message="message", ` +
      (detailed ? 'arguments=[text(value="text"), integer(value=1208925819614629174706176n), number(value=-0), ' +
        `origin(value=${codecOriginWire})], related=[RelatedDiagnostic(site=file(path="/project/other.ts"), ` +
        'code=checker(number=1, rendered="TS1"), message="related"), RelatedDiagnostic(site=none(), ' +
        'code=extension(number=2, extensionCode="E_RELATED", rendered="TSEXT2"), message="detail")], ' +
        `fix=DiagnosticFix(description="replace", edits=[TextEdit(origin=${codecOriginWire}, replacement="replacement")]))` :
        'arguments=[], related=[], fix=null)');
    const endpoint = { ordinal: 0, declaration: ownerId, advertised: codecEndpoint, advertisedSignature: 0, api: codecEndpoint, apiSignature: 0,
      bindings: emptyBindings(), conditionalFailure: diagnostic };
    const input = { context: codecContext, kind: "call", callee: codecEvidence, receiver: null, typeArguments: [], arguments: [], candidates: [endpoint] };
    const inputWire = `CandidateInput(context=${codecContextWire}, kind="call", callee=${codecEvidenceWire}, receiver=null, ` +
      `typeArguments=[], arguments=[], candidates=[CandidateEndpoint(ordinal=0, declaration=def:"${ownerId}", ` +
      `advertised=${codecEndpointWire}, advertisedSignature=sig:0, api=${codecEndpointWire}, apiSignature=sig:0, ` +
      `bindings=${codecBindingsWire}, conditionalFailure=${diagnosticWire})])`;
    const phase = { ...typedValue(), role: "value", operation: { kind: "deferred", deferred: { invocation: { rule: "candidate", input }, result: 0 } } };
    const phaseWire = `TypedPrefix(${valueWire}, role="value", operation=deferred(deferred=DeferredDecision(invocation=` +
      `DeferredInvocation(rule="candidate", input=${inputWire}), result=t:0)))`;
    const { body, expected } = syntaxPayloadCase({ ...header(4, 2), kind: "PrefixUnaryExpression", operator: "PlusToken",
      operand: codecName(5, 4), tsonic: phase }, [
      `PrefixUnaryExpression(${syntaxHeaderWire(4, 2)}, operator="PlusToken", operand=n:5, tsonic=${phaseWire})`, codecNameWire(5, 4),
    ]);
    const parsed = product.parseTir(expected);
    assert.equal(parsed.kind, "parsed");
    assertCompleteValue(parsed.value, body, "entire independently authored diagnostic value", compareCaseValues);
    assertCompleteValue(product.printTir(parsed.value), expected, "entire independently authored diagnostic wire", sameWire);
    if (code.kind === "host") {
      const invalidCode = expected.replace(`host(name=${JSON.stringify(code.name)}`, "host(name=null");
      const offset = invalidCode.indexOf("null", invalidCode.indexOf("host(name="));
      assertInvalidText(invalidCode, offset, ["string"], "null");
    }
  });
}
const selectedOperatorLiterals = ["+", "-", "!", "~", "typeof", "void", "delete", "*", "/", "%", "**", "&", "|", "^",
  "<<", ">>", ">>>", "<", "<=", ">", ">=", "==", "!=", "===", "!==", "in", "instanceof"];
const selectedProtocolSteps = [
  { role: "acquire", operation: { kind: "call", application: codecApplicationDecision }, operands: [0], result: 0 },
  ...["next", "done", "value", "finish", "fail", "await", "dispose"].map(role => ({ role,
    operation: { kind: "core", declaration: ownerId, bindings: emptyBindings() }, operands: [0], result: 0 })),
  { role: "completion", operation: { kind: "completion" }, operands: [0], result: 0 },
];
const selectedProtocolStepsWire = `ProtocolStepDecision(role="acquire", operation=call(application=${codecApplicationDecisionWire}), ` +
  'operands=[t:0], result=t:0), ' + ["next", "done", "value", "finish", "fail", "await", "dispose"].map(role =>
  `ProtocolStepDecision(role="${role}", operation=core(declaration=def:"${ownerId}", bindings=${codecBindingsWire}), ` +
  'operands=[t:0], result=t:0)').join(", ") + ', ProtocolStepDecision(role="completion", operation=completion(), operands=[t:0], result=t:0)';
const selectedIdentityCases = [
  ...["bool", "char", "int8", "uint8", "int16", "uint16", "int32", "uint32", "int64", "uint64", "int128", "uint128",
    "native-int", "native-uint", "float16", "float32", "float64", "decimal"].map(carrier => [
    { kind: "native-operator", operator: "+", carrier }, `native-operator(operator="+", carrier="${carrier}")`,
  ]),
  ...selectedOperatorLiterals.filter(operator => operator !== "+").map(operator => [
    { kind: "native-operator", operator, carrier: "int32" }, `native-operator(operator="${operator}", carrier="int32")`,
  ]),
  ...selectedOperatorLiterals.map(operator => [
    { kind: "bigint-operator", operator }, `bigint-operator(operator="${operator}")`,
  ]),
  ...["+", "==", "!=", "===", "!==", "<", "<=", ">", ">="].map(operator => [
    { kind: "string-operator", operator }, `string-operator(operator="${operator}")`,
  ]),
  ...["!", "&&", "||", "==", "!=", "===", "!=="].map(operator => [
    { kind: "boolean-operator", operator }, `boolean-operator(operator="${operator}")`,
  ]),
  ...[false, true].map(negated => [{ kind: "absence-test", negated }, `absence-test(negated=${negated})`]),
  [{ kind: "object-construction", parts: [codecPart] }, `object-construction(parts=[${codecPartWire}])`],
  [{ kind: "array-construction", parts: [codecPart] }, `array-construction(parts=[${codecPartWire}])`],
  [{ kind: "conversion", from: 0, to: 0, embedding: { kind: "identity" } }, "conversion(from=t:0, to=t:0, embedding=identity())"],
  [{ kind: "library", declaration: ownerId, bindings: emptyBindings() }, `library(declaration=def:"${ownerId}", bindings=${codecBindingsWire})`],
  [{ kind: "core", declaration: ownerId, bindings: emptyBindings() }, `core(declaration=def:"${ownerId}", bindings=${codecBindingsWire})`],
  ...["pointer-address", "pointer-read", "pointer-write", "pointer-offset", "type-query", "discard"].map(kind => [{ kind }, `${kind}()`]),
  ...["iterate", "await", "yield", "delegate", "dispose", "spread", "argument-passing", "pointer"].flatMap(protocol =>
    [false, true].map(asynchronous => [{ kind: "protocol", protocol, asynchronous, steps: selectedProtocolSteps,
      value: 0, completion: 0, yielded: 0, sent: 0, thrown: 0 },
    `protocol(protocol="${protocol}", asynchronous=${asynchronous}, steps=[${selectedProtocolStepsWire}], ` +
      'value=t:0, completion=t:0, yielded=t:0, sent=t:0, thrown=t:0)'])),
];

// One selected operation on a prefix unary expression: the carrier of the decision-field vectors and of their refusals.
const decisionFieldCase = (identity, identityWire, execution, executionWire) => {
  const operation = { permissionScope: 4, decision: { kind: "selected", operation: identity, operands: [0], result: 0, execution } };
  const operationWire = `TypedOperation(decision=selected(operation=${identityWire}, operands=[t:0], result=t:0, execution=${executionWire}), permissionScope=n:4)`;
  return syntaxPayloadCase({ ...header(4, 2), kind: "PrefixUnaryExpression", operator: "PlusToken", operand: codecName(5, 4),
    tsonic: { ...typedValue(), role: "value", operation: { kind: "decided", decision: operation } } }, [
    `PrefixUnaryExpression(${syntaxHeaderWire(4, 2)}, operator="PlusToken", operand=n:5, ` +
      `tsonic=TypedPrefix(${valueWire}, role="value", operation=decided(decision=${operationWire})))`, codecNameWire(5, 4),
  ]);
};

test("the text reader refuses an unknown value and a missing last field of the location, activation and execution fields at the field's own position", () => {
  // This codec names the schema of a value it cannot read and the field it misses; the position is the value's first character
  // and the place where the missing field's separator would stand.
  const refuse = (text, slot, unknown, schema, found) => {
    const start = text.indexOf(slot);
    assert.equal(start >= 0 && text.indexOf(slot, start + 1) === -1, true, `${slot} is stated once`);
    assert.equal(text.slice(start - 2, start) === ", " && text[start + slot.length] === ")", true, `${slot} is the last field of its record`);
    const value = start + slot.indexOf("=") + 1;
    assertInvalidText(text.slice(0, value) + unknown + text.slice(start + slot.length), value, [schema], found);
    assertInvalidText(text.slice(0, start - 2) + text.slice(start + slot.length), start - 2, [slot.slice(0, slot.indexOf("="))], ")");
  };
  refuse(decisionFieldCase({ kind: "discard" }, "discard()", { kind: "invocation", writesStorage: true, failure: "abort" },
    'invocation(writesStorage=true, failure="abort")').expected, 'execution=invocation(writesStorage=true, failure="abort")', "proved()", "OperationExecution", "proved");
  const location = 'location=data(check=required(failure="unwind"), receiver="by-reference")';
  const memberWire = codecMemberDecisionWire.replace(`getter=${codecEndpointWire}, setter=${codecEndpointWire}`, "getter=null, setter=null").replace("location=accessor()", location);
  refuse(decisionFieldCase({ kind: "array-construction", parts: [{ ...codecPart, member: { ...codecMemberDecision, getter: null, setter: null,
    location: { kind: "data", check: { kind: "required", failure: "unwind" }, receiver: "by-reference" } } }] },
  `array-construction(parts=[${codecPartWire.replace(codecMemberDecisionWire, memberWire)}])`, { kind: "pure" }, "pure()").expected, location, "proved()", "AccessLocation", "proved");
  const applicationWire = codecApplicationDecisionWire.replace("result=t:0, activation=null", 'result=t:0, activation="when-first-driven"');
  refuse(decisionFieldCase({ kind: "protocol", protocol: "iterate", asynchronous: false,
    steps: [{ role: "acquire", operation: { kind: "call", application: { ...codecApplicationDecision, activation: "when-first-driven" } }, operands: [0], result: 0 }],
    value: 0, completion: 0, yielded: 0, sent: 0, thrown: 0 },
  `protocol(protocol="iterate", asynchronous=false, steps=[ProtocolStepDecision(role="acquire", operation=call(application=${applicationWire}), ` +
    'operands=[t:0], result=t:0)], value=t:0, completion=t:0, yielded=t:0, sent=t:0, thrown=t:0)', { kind: "pure" }, "pure()").expected,
  'activation="when-first-driven"', '"proved"', "?HandleActivation", '"proved"');
});

test("check, location, execution and activation fields of the decisions have a complete public codec vector for every value", () => {
  const roundTrip = (identity, identityWire, execution, executionWire, label) => {
    const fixture = decisionFieldCase(identity, identityWire, execution, executionWire);
    assertBodyRoundTrip(fixture.body, fixture.expected, label);
  };
  for (const writesStorage of [false, true]) for (const failure of ["none", "unwind", "abort"])
    roundTrip({ kind: "discard" }, "discard()", { kind: "invocation", writesStorage, failure },
      `invocation(writesStorage=${writesStorage}, failure="${failure}")`, `invocation ${writesStorage} ${failure}`);
  for (const [check, checkWire] of [[{ kind: "none" }, "none()"], [{ kind: "required", failure: "unwind" }, 'required(failure="unwind")'],
    [{ kind: "required", failure: "abort" }, 'required(failure="abort")']]) for (const receiver of ["in-place", "by-reference"]) {
    const member = { ...codecMemberDecision, getter: null, setter: null, location: { kind: "data", check, receiver } };
    const memberWire = codecMemberDecisionWire.replace(`getter=${codecEndpointWire}, setter=${codecEndpointWire}`, "getter=null, setter=null")
      .replace("location=accessor()", `location=data(check=${checkWire}, receiver="${receiver}")`);
    assert.equal(memberWire.includes("getter=null, setter=null") && memberWire.includes("location=data("), true);
    roundTrip({ kind: "array-construction", parts: [{ ...codecPart, member }] },
      `array-construction(parts=[${codecPartWire.replace(codecMemberDecisionWire, memberWire)}])`, { kind: "pure" }, "pure()", `data location ${checkWire} ${receiver}`);
  }
  for (const activation of ["at-creation", "when-first-driven"]) {
    const application = { ...codecApplicationDecision, activation };
    const applicationWire = codecApplicationDecisionWire.replace("result=t:0, activation=null", `result=t:0, activation="${activation}"`);
    assert.equal(applicationWire.includes(`activation="${activation}"`), true);
    roundTrip({ kind: "protocol", protocol: "iterate", asynchronous: false,
      steps: [{ role: "acquire", operation: { kind: "call", application }, operands: [0], result: 0 }], value: 0, completion: 0, yielded: 0, sent: 0, thrown: 0 },
    `protocol(protocol="iterate", asynchronous=false, steps=[ProtocolStepDecision(role="acquire", operation=call(application=${applicationWire}), ` +
      'operands=[t:0], result=t:0)], value=t:0, completion=t:0, yielded=t:0, sent=t:0, thrown=t:0)', { kind: "pure" }, "pure()", `activation ${activation}`);
  }
});

for (const [identity, identityWire] of selectedIdentityCases) {
  const suffix = [identity.carrier, identity.operator, identity.protocol, identity.asynchronous, identity.negated]
    .filter(value => value !== undefined).join("/");
  test(`the complete selected ${identity.kind}/${suffix} operation has an independently authored public codec vector`, () => {
    // A pointer write is an invocation that writes storage; a library operation is an ordinary invocation. The other
    // executions in this vector are fixture values that no rule has decided.
    const [execution, executionWire] = identity.kind === "pointer-write"
      ? [{ kind: "invocation", writesStorage: true, failure: "none" }, 'invocation(writesStorage=true, failure="none")']
      : identity.kind === "library" ? [{ kind: "invocation", writesStorage: true, failure: "unwind" }, 'invocation(writesStorage=true, failure="unwind")']
        : [{ kind: "pure" }, "pure()"];
    const operation = { permissionScope: 4, decision: { kind: "selected", operation: identity, operands: [0], result: 0, execution } };
    const operationWire = `TypedOperation(decision=selected(operation=${identityWire}, operands=[t:0], result=t:0, execution=${executionWire}), permissionScope=n:4)`;
    const fixture = syntaxPayloadCase({ ...header(4, 2), kind: "PrefixUnaryExpression", operator: "PlusToken", operand: codecName(5, 4),
      tsonic: { ...typedValue(), role: "value", operation: { kind: "decided", decision: operation } } }, [
      `PrefixUnaryExpression(${syntaxHeaderWire(4, 2)}, operator="PlusToken", operand=n:5, ` +
        `tsonic=TypedPrefix(${valueWire}, role="value", operation=decided(decision=${operationWire})))`, codecNameWire(5, 4),
    ]);
    assertBodyRoundTrip(fixture.body, fixture.expected, identity.kind);
    if (identity.kind === "discard") {
      const removed = fixture.expected.replace("selected(operation=", 'OperationDecision(kind="selected", operation=');
      const offset = removed.indexOf('OperationDecision(kind="selected"');
      assertCompleteValue(product.parseTir(removed), invalidTextAt(removed, offset, ["OperationDecision"], "OperationDecision"),
        "the removed record spelling is rejected rather than accepted as a compatibility alias");
    }
  });
}

for (const [kind, phase, wire] of [
  ["TrueKeyword", { ...typedValue(), role: "value" }, `TypedKeyword(${valueWire}, role="value")`],
  ["FalseKeyword", { ...typedValue(), role: "value" }, `TypedKeyword(${valueWire}, role="value")`],
  ["NullKeyword", { role: "type-literal", type: 0 }, 'TypedKeyword(role="type-literal", type=t:0)'],
  ["ThisKeyword", { ...typedValue(), role: "receiver", owner: ownerId }, `TypedKeyword(${valueWire}, role="receiver", owner=def:"${ownerId}")`],
  ["SuperKeyword", { ...typedValue(), role: "super", owner: ownerId, base: 0 }, `TypedKeyword(${valueWire}, role="super", owner=def:"${ownerId}", base=t:0)`],
]) {
  test(`actual ${kind} syntax retains the complete ${phase.role} keyword arm`, () => {
    assertSyntaxPayload({ ...header(4, 2), kind, tsonic: phase }, [`${kind}(${syntaxHeaderWire(4, 2)}, tsonic=${wire})`], kind);
  });
}

test("actual prefix type-literal/update and postfix update roles use their own mapped phase families", () => {
  assertSyntaxPayload({ ...header(4, 2), kind: "PrefixUnaryExpression", operator: "MinusToken", operand: codecName(5, 4),
    tsonic: { role: "type-literal", type: 0 } }, [
    `PrefixUnaryExpression(${syntaxHeaderWire(4, 2)}, operator="MinusToken", operand=n:5, tsonic=TypedPrefix(role="type-literal", type=t:0))`,
    codecNameWire(5, 4),
  ], "prefix type literal");
  const operation = { permissionScope: null, decision: { kind: "selected", operation: { kind: "type-query" }, operands: [0], result: 0, execution: { kind: "pure" } } };
  const operationWire = 'decided(decision=TypedOperation(decision=selected(operation=type-query(), ' +
    'operands=[t:0], result=t:0, execution=pure()), permissionScope=null))';
  assertSyntaxPayload({ ...header(4, 2), kind: "PrefixUnaryExpression", operator: "PlusPlusToken", operand: codecName(5, 4),
    tsonic: { ...typedValue(), role: "update", storage: 0, operation: { kind: "decided", decision: operation } } }, [
    `PrefixUnaryExpression(${syntaxHeaderWire(4, 2)}, operator="PlusPlusToken", operand=n:5, ` +
      `tsonic=TypedPrefix(${valueWire}, role="update", storage=t:0, operation=${operationWire}))`, codecNameWire(5, 4),
  ], "prefix update");
  assertSyntaxPayload({ ...header(4, 2), kind: "PostfixUnaryExpression", operand: codecName(5, 4), operator: "MinusMinusToken",
    tsonic: { ...typedValue(), storage: 0, operation: { kind: "decided", decision: operation } } }, [
    `PostfixUnaryExpression(${syntaxHeaderWire(4, 2)}, operand=n:5, operator="MinusMinusToken", ` +
      `tsonic=TypedUpdate(${valueWire}, storage=t:0, operation=${operationWire}))`, codecNameWire(5, 4),
  ], "postfix update");
});

const codecCallee = { decision: codecApplicationDecision, activation: { body: bodyId, bindings: { kind: "instantiated", bindings: emptyBindings() } } };
const codecCalleeWire = `ResolvedCallee(decision=${codecApplicationDecisionWire}, activation=BodyInstance(body=body:"${bodyId}", ` +
  `bindings=instantiated(bindings=${codecBindingsWire})))`;
const codecTypedOperation = { decision: { kind: "selected", operation: { kind: "discard" }, operands: [0], result: 0, execution: { kind: "pure" } }, permissionScope: 4 };
const codecTypedOperationWire = 'TypedOperation(decision=selected(operation=discard(), operands=[t:0], result=t:0, execution=pure()), permissionScope=n:4)';
const codecProtocol = { kind: "delegate", asynchronous: true, steps: [
  { role: "acquire", operation: codecTypedOperation, callee: codecCallee },
  ...["next", "done", "value", "finish", "fail", "await", "dispose", "completion"]
    .map(role => ({ role, operation: codecTypedOperation, callee: null })),
], value: 0, completion: 0, sent: 0, thrown: 0 };
const codecProtocolWire = 'TirProtocol(kind="delegate", asynchronous=true, steps=[' +
  `TirProtocolStep(role="acquire", operation=${codecTypedOperationWire}, callee=${codecCalleeWire}), ` +
  ["next", "done", "value", "finish", "fail", "await", "dispose", "completion"]
    .map(role => `TirProtocolStep(role="${role}", operation=${codecTypedOperationWire}, callee=null)`).join(", ") +
  '], value=t:0, completion=t:0, sent=t:0, thrown=t:0)';
const codecTirApplication = { callee: codecCallee, receiver: 5, arguments: [
  { kind: "provided", parameter: 0, expression: 6 },
  { kind: "omitted", parameter: 1, value: { kind: "initializer", instance: { body: bodyId, bindings: { kind: "parametric" } } } },
  { kind: "omitted", parameter: 2, value: { kind: "absence" } },
  { kind: "omitted", parameter: 3, value: { kind: "empty-rest" } },
  { kind: "rest", parameter: 4, parts: [{ kind: "value", expression: 6 }, { kind: "spread", expression: 6, tuple: [0, 0] },
    { kind: "spread", expression: 6, tuple: null }] },
] };
const codecTirApplicationWire = `TirApplication(callee=${codecCalleeWire}, receiver=n:5, arguments=[provided(parameter=0, expression=n:6), ` +
  `omitted(parameter=1, value=initializer(instance=BodyInstance(body=body:"${bodyId}", bindings=parametric()))), ` +
  'omitted(parameter=2, value=absence()), omitted(parameter=3, value=empty-rest()), ' +
  'rest(parameter=4, parts=[value(expression=n:6), spread(expression=n:6, tuple=[t:0, t:0]), spread(expression=n:6, tuple=null)])])';
for (const kind of ["CallExpression", "NewExpression"]) {
  test(`actual ${kind} codec preserves every typed argument disposition and complete callee activation`, () => {
    assertSyntaxPayload({ ...header(4, 2), kind, expression: codecName(5, 4), ...(kind === "CallExpression" ? { questionDotToken: null } : {}),
      typeArguments: null, arguments: nodeList([codecName(6, 4)]),
      tsonic: { ...typedValue(), application: { kind: "decided", decision: codecTirApplication }, operation: { kind: "decided", decision: codecTypedOperation } } }, [
      `${kind}(${syntaxHeaderWire(4, 2)}, expression=n:5, ${kind === "CallExpression" ? "questionDotToken=null, " : ""}` +
        'typeArguments=null, arguments=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:6]), ' +
        `tsonic=TypedApplication(${valueWire}, application=decided(decision=${codecTirApplicationWire}), operation=decided(decision=${codecTypedOperationWire})))`,
      codecNameWire(5, 4), codecNameWire(6, 4),
    ], kind);
  });
}
for (const [kind, phaseType, field] of [["AwaitExpression", "TypedProtocolValue", "expression"], ["SpreadElement", "TypedSpread", "expression"]]) {
  test(`actual ${kind} retains all supplied structural protocol channels and steps without a guessed role law`, () => {
    assertSyntaxPayload({ ...header(4, 2), kind, [field]: codecName(5, 4), tsonic: { ...typedValue(), protocol: { kind: "decided", decision: codecProtocol } } }, [
      `${kind}(${syntaxHeaderWire(4, 2)}, ${field}=n:5, tsonic=${phaseType}(${valueWire}, protocol=decided(decision=${codecProtocolWire})))`,
      codecNameWire(5, 4),
    ], kind);
  });
}
for (const kind of ["ForInStatement", "ForOfStatement"]) {
  test(`actual ${kind} retains its authored iteration fields and supplied protocol data`, () => {
    const asynchronous = kind === "ForOfStatement";
    assertSyntaxPayload({ ...header(4, 2), kind, awaitModifier: asynchronous ? { ...header(5, 4), kind: "AwaitKeyword", tsonic: null } : null,
      initializer: codecName(asynchronous ? 6 : 5, 4), expression: codecName(asynchronous ? 7 : 6, 4),
      statement: codecEmptyStatement(asynchronous ? 8 : 7, 4), tsonic: { protocol: { kind: "decided", decision: codecProtocol } } }, [
      `${kind}(${syntaxHeaderWire(4, 2)}, awaitModifier=${asynchronous ? "n:5" : "null"}, initializer=n:${asynchronous ? 6 : 5}, ` +
        `expression=n:${asynchronous ? 7 : 6}, statement=n:${asynchronous ? 8 : 7}, tsonic=TypedIteration(protocol=decided(decision=${codecProtocolWire})))`,
      ...(asynchronous ? [`AwaitKeyword(${syntaxHeaderWire(5, 4)}, tsonic=null)`] : []), codecNameWire(asynchronous ? 6 : 5, 4),
      codecNameWire(asynchronous ? 7 : 6, 4), codecEmptyStatementWire(asynchronous ? 8 : 7, 4),
    ], kind);
  });
}
for (const kind of ["PropertyAccessExpression", "ElementAccessExpression"]) {
  test(`actual ${kind} retains non-null getter/setter activations and the complete assignment access record`, () => {
    const selection = { decision: codecMemberDecision, getter: codecCallee, setter: codecCallee };
    const selectionWire = `MemberSelection(decision=${codecMemberDecisionWire}, getter=${codecCalleeWire}, setter=${codecCalleeWire})`;
    const memberField = kind === "PropertyAccessExpression" ? "name" : "argumentExpression";
    const access = { kind: "read-write", storage: 0, read: 0, narrowing: { kind: "identity", type: 0 }, evidenceIndex: 0 };
    assertSyntaxPayload({ ...header(4, 2), kind, expression: codecName(5, 4), questionDotToken: { ...header(6, 4), kind: "QuestionDotToken", tsonic: null },
      [memberField]: codecName(7, 4), tsonic: { role: "assignment-target", selection: { kind: "decided", decision: selection }, access } }, [
      `${kind}(${syntaxHeaderWire(4, 2)}, expression=n:5, questionDotToken=n:6, ${memberField}=n:7, ` +
        `tsonic=TypedMember(role="assignment-target", selection=decided(decision=${selectionWire}), ` +
        'access=read-write(storage=t:0, read=t:0, narrowing=identity(type=t:0), evidenceIndex=0)))',
      codecNameWire(5, 4), `QuestionDotToken(${syntaxHeaderWire(6, 4)}, tsonic=null)`, codecNameWire(7, 4),
    ], kind);
  });
}
const codecTemplateToken = (kind, identity, parent) => ({ ...header(identity, parent), kind, text: "a", tokenFlags: ["UnicodeEscape"],
  rawText: "\\u0061", templateFlags: ["ContainsInvalidEscape"], tsonic: null });
const codecTemplateTokenWire = (kind, identity, parent) => `${kind}(${syntaxHeaderWire(identity, parent)}, text="a", ` +
  'tokenFlags=["UnicodeEscape"], rawText="\\\\u0061", templateFlags=["ContainsInvalidEscape"], tsonic=null)';
for (const typed of [false, true]) {
  test(`actual ${typed ? "type" : "value"} template retains head/middle/tail spelling and complete span records`, () => {
    const span = (identity, literalKind) => ({ ...header(identity, 4), kind: typed ? "TemplateLiteralTypeSpan" : "TemplateSpan",
      [typed ? "type" : "expression"]: typed ? codecType(identity + 1, identity) : codecName(identity + 1, identity),
      literal: codecTemplateToken(literalKind, identity + 2, identity), tsonic: typed ? { type: 0, declarations: [ownerId] } : null });
    const kind = typed ? "TemplateLiteralType" : "TemplateExpression";
    const phase = typed ? { type: 0, declarations: [ownerId] } : { ...typedValue(), operation: { kind: "decided", decision: codecTypedOperation } };
    const phaseWire = typed ? `TypedType(type=t:0, declarations=[def:"${ownerId}"])` :
      `TypedTemplate(${valueWire}, operation=decided(decision=${codecTypedOperationWire}))`;
    const spanKind = typed ? "TemplateLiteralTypeSpan" : "TemplateSpan";
    assertSyntaxPayload({ ...header(4, 2), kind, head: codecTemplateToken("TemplateHead", 5, 4),
      templateSpans: nodeList([span(6, "TemplateMiddle"), span(9, "TemplateTail")]), tsonic: phase }, [
      `${kind}(${syntaxHeaderWire(4, 2)}, head=n:5, templateSpans=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:6, n:9]), tsonic=${phaseWire})`,
      codecTemplateTokenWire("TemplateHead", 5, 4),
      `${spanKind}(${syntaxHeaderWire(6, 4)}, ${typed ? "type" : "expression"}=n:7, literal=n:8, ` +
        `tsonic=${typed ? `TypedType(type=t:0, declarations=[def:"${ownerId}"])` : "null"})`,
      typed ? codecTypeWire(7, 6) : codecNameWire(7, 6), codecTemplateTokenWire("TemplateMiddle", 8, 6),
      `${spanKind}(${syntaxHeaderWire(9, 4)}, ${typed ? "type" : "expression"}=n:10, literal=n:11, ` +
        `tsonic=${typed ? `TypedType(type=t:0, declarations=[def:"${ownerId}"])` : "null"})`,
      typed ? codecTypeWire(10, 9) : codecNameWire(10, 9), codecTemplateTokenWire("TemplateTail", 11, 9),
    ], kind);
  });
}
test("a tagged template and a no-substitution literal retain raw and decoded strings separately", () => {
  const literal = { ...codecTemplateToken("NoSubstitutionTemplateLiteral", 8, 4), tsonic: { ...typedValue(), role: "value", value: "a" } };
  assertSyntaxPayload({ ...header(4, 2), kind: "TaggedTemplateExpression", tag: codecName(5, 4),
    questionDotToken: { ...header(6, 4), kind: "QuestionDotToken", tsonic: null }, typeArguments: nodeList([codecType(7, 4)]), template: literal,
    tsonic: { ...typedValue(), application: { kind: "decided", decision: codecTirApplication }, operation: null } }, [
    `TaggedTemplateExpression(${syntaxHeaderWire(4, 2)}, tag=n:5, questionDotToken=n:6, ` +
      'typeArguments=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:7]), template=n:8, ' +
      `tsonic=TypedApplication(${valueWire}, application=decided(decision=${codecTirApplicationWire}), operation=null))`,
    codecNameWire(5, 4), `QuestionDotToken(${syntaxHeaderWire(6, 4)}, tsonic=null)`, codecTypeWire(7, 4),
    `NoSubstitutionTemplateLiteral(${syntaxHeaderWire(8, 4)}, text="a", tokenFlags=["UnicodeEscape"], rawText="\\\\u0061", ` +
      `templateFlags=["ContainsInvalidEscape"], tsonic=TypedString(${valueWire}, role="value", value="a"))`,
  ], "tagged template");
});
test("regular-expression literal text is preserved without host evaluation or pattern reinterpretation", () => {
  assertExpressionRoundTrip("RegularExpressionLiteral", { text: "/[a-z]+/giu", tokenFlags: ["Unterminated"] },
    'text="/[a-z]+/giu", tokenFlags=["Unterminated"]', typedValue(), `TypedValue(${valueWire})`);
});
for (const kind of ["AsExpression", "SatisfiesExpression"]) {
  test(`actual ${kind} retains its expression and type without semantic replay`, () => {
    assertSyntaxPayload({ ...header(4, 2), kind, expression: codecName(5, 4), type: codecType(6, 4), tsonic: typedValue() }, [
      `${kind}(${syntaxHeaderWire(4, 2)}, expression=n:5, type=n:6, tsonic=TypedValue(${valueWire}))`, codecNameWire(5, 4), codecTypeWire(6, 4),
    ], kind);
  });
}
for (const kind of ["NonNullExpression", "PartiallyEmittedExpression"]) {
  test(`actual ${kind} retains its own mapped value/null phase`, () => {
    assertSyntaxPayload({ ...header(4, 2), kind, expression: codecName(5, 4), tsonic: kind === "NonNullExpression" ? typedValue() : null }, [
      `${kind}(${syntaxHeaderWire(4, 2)}, expression=n:5, tsonic=${kind === "NonNullExpression" ? `TypedValue(${valueWire})` : "null"})`,
      codecNameWire(5, 4),
    ], kind);
  });
}
test("synthetic references retain both actual expression and thisArg children", () => {
  assertSyntaxPayload({ ...header(4, 2), kind: "SyntheticReferenceExpression", expression: codecName(5, 4), thisArg: codecName(6, 4), tsonic: null }, [
    `SyntheticReferenceExpression(${syntaxHeaderWire(4, 2)}, expression=n:5, thisArg=n:6, tsonic=null)`, codecNameWire(5, 4), codecNameWire(6, 4),
  ], "synthetic reference");
});
for (const keywordToken of ["ImportKeyword", "NewKeyword"]) {
  test(`actual ${keywordToken} meta-property retains the selected keyword and name`, () => {
    assertSyntaxPayload({ ...header(4, 2), kind: "MetaProperty", keywordToken, name: codecName(5, 4), tsonic: typedValue() }, [
      `MetaProperty(${syntaxHeaderWire(4, 2)}, keywordToken="${keywordToken}", name=n:5, tsonic=TypedValue(${valueWire}))`, codecNameWire(5, 4),
    ], keywordToken);
  });
}
for (const [key, keyWire] of [[{ kind: "constant", key: codecKey }, `constant(key=${codecKeyWire})`],
  [{ kind: "computed", type: 0 }, "computed(type=t:0)"]]) {
  test(`actual computed-name phase retains its ${key.kind} property-key arm`, () => {
    assertSyntaxPayload({ ...header(4, 2), kind: "ComputedPropertyName", expression: codecName(5, 4), tsonic: key }, [
      `ComputedPropertyName(${syntaxHeaderWire(4, 2)}, expression=n:5, tsonic=${keyWire})`, codecNameWire(5, 4),
    ], key.kind);
  });
}
test("qualified/private names and an omitted expression retain their distinct real phase records", () => {
  assertSyntaxPayload({ ...header(4, 2), kind: "QualifiedName", left: codecName(5, 4), right: codecName(6, 4),
    tsonic: { role: "type-name", type: 0, declarations: [ownerId] } }, [
    `QualifiedName(${syntaxHeaderWire(4, 2)}, left=n:5, right=n:6, tsonic=TypedName(role="type-name", type=t:0, declarations=[def:"${ownerId}"]))`,
    codecNameWire(5, 4), codecNameWire(6, 4),
  ], "qualified name");
  assertSyntaxPayload({ ...header(4, 2), kind: "PrivateIdentifier", text: "#field", tsonic: { role: "private-name", declaration: ownerId } }, [
    `PrivateIdentifier(${syntaxHeaderWire(4, 2)}, text="#field", tsonic=TypedName(role="private-name", declaration=def:"${ownerId}"))`,
  ], "private identifier");
  assertSyntaxPayload({ ...header(4, 2), kind: "OmittedExpression", tsonic: { storage: 0 } }, [
    `OmittedExpression(${syntaxHeaderWire(4, 2)}, tsonic=TypedOmission(storage=t:0))`,
  ], "omitted expression");
});
for (const kind of ["PropertyAssignment", "ShorthandPropertyAssignment"]) {
  test(`actual ${kind} retains nullable syntax fields and its independently supplied member association`, () => {
    const selection = { decision: codecMemberDecision, getter: codecCallee, setter: codecCallee };
    const phaseType = kind === "PropertyAssignment" ? "TypedProperty" : "TypedShorthand";
    const fields = kind === "PropertyAssignment" ? { initializer: codecName(8, 4) }
      : { equalsToken: { ...header(8, 4), kind: "EqualsToken", tsonic: null }, objectAssignmentInitializer: codecName(9, 4) };
    assertSyntaxPayload({ ...header(4, 2), kind, modifiers: nodeList(), name: codecName(5, 4),
      postfixToken: { ...header(6, 4), kind: "QuestionToken", tsonic: null }, type: codecType(7, 4), ...fields,
      tsonic: { key: codecKey, member: { kind: "decided", decision: selection } } }, [
      `${kind}(${syntaxHeaderWire(4, 2)}, modifiers=ModifierList(loc=TextRange(pos=0, end=0), nodes=[]), name=n:5, postfixToken=n:6, type=n:7, ` +
        `${kind === "PropertyAssignment" ? "initializer=n:8" : "equalsToken=n:8, objectAssignmentInitializer=n:9"}, ` +
        `tsonic=${phaseType}(key=${codecKeyWire}, member=decided(decision=MemberSelection(decision=${codecMemberDecisionWire}, ` +
        `getter=${codecCalleeWire}, setter=${codecCalleeWire}))))`,
      codecNameWire(5, 4), `QuestionToken(${syntaxHeaderWire(6, 4)}, tsonic=null)`, codecTypeWire(7, 4),
      ...(kind === "PropertyAssignment" ? [codecNameWire(8, 4)] : [`EqualsToken(${syntaxHeaderWire(8, 4)}, tsonic=null)`, codecNameWire(9, 4)]),
    ], kind);
  });
}
test("a complete type literal retains its nonempty actual member syntax rather than a placeholder type", () => {
  const member = { ...header(5, 4), kind: "PropertySignature", modifiers: nodeList(), name: codecName(6, 5),
    postfixToken: { ...header(7, 5), kind: "QuestionToken", tsonic: null }, type: codecType(8, 5), initializer: codecName(9, 5),
    tsonic: { definition: ownerId, storage: 0, initializer: bodyId, attributes: [codecAttribute] } };
  assertSyntaxPayload({ ...header(4, 2), kind: "TypeLiteral", members: nodeList([member]), tsonic: { type: 0, declarations: [ownerId] } }, [
    `TypeLiteral(${syntaxHeaderWire(4, 2)}, members=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:5]), ` +
      `tsonic=TypedType(type=t:0, declarations=[def:"${ownerId}"]))`,
    `PropertySignature(${syntaxHeaderWire(5, 4)}, modifiers=ModifierList(loc=TextRange(pos=0, end=0), nodes=[]), name=n:6, postfixToken=n:7, type=n:8, initializer=n:9, ` +
      `tsonic=TypedStorageDeclaration(definition=def:"${ownerId}", storage=t:0, initializer=body:"${bodyId}", attributes=[${codecAttributeWire}]))`,
    codecNameWire(6, 5), `QuestionToken(${syntaxHeaderWire(7, 5)}, tsonic=null)`, codecTypeWire(8, 5), codecNameWire(9, 5),
  ], "type literal");
});
for (const kind of ["and", "or", "coalesce"]) {
  const token = kind === "and" ? "AmpersandAmpersandToken" : kind === "or" ? "BarBarToken" : "QuestionQuestionToken";
  test(`the entire ${kind} short-circuit selection retains its authored endpoints and disposition`, () => {
    assertSyntaxPayload({ ...header(4, 2), kind: "BinaryExpression", modifiers: nodeList(), left: codecName(5, 4), type: codecType(6, 4),
      operatorToken: { ...header(7, 4), kind: token, tsonic: null }, right: codecName(8, 4),
      tsonic: { ...typedValue(), role: "short-circuit", selection: { kind, control: 5, right: 8, disposition: "dynamic" } } }, [
      `BinaryExpression(${syntaxHeaderWire(4, 2)}, modifiers=ModifierList(loc=TextRange(pos=0, end=0), nodes=[]), left=n:5, type=n:6, operatorToken=n:7, right=n:8, ` +
        `tsonic=TypedBinary(${valueWire}, role="short-circuit", selection=${kind}(control=n:5, right=n:8, disposition="dynamic")))`,
      codecNameWire(5, 4), codecTypeWire(6, 4), `${token}(${syntaxHeaderWire(7, 4)}, tsonic=null)`, codecNameWire(8, 4),
    ], kind);
  });
}
test("ordinary numeric and bigint values retain non-null narrowing and evidence fields in their own phase family", () => {
  assertExpressionRoundTrip("NumericLiteral", { text: "0", tokenFlags: ["ContainsSeparator"] }, 'text="0", tokenFlags=["ContainsSeparator"]',
    { ...typedValue(), role: "value", value: { numerator: 0n, denominator: 1n, negativeZero: false } },
    `TypedNumber(${valueWire}, role="value", value=ExactRational(numerator=0n, denominator=1n, negativeZero=false))`);
  assertExpressionRoundTrip("BigIntLiteral", { text: "0n", tokenFlags: ["ContainsSeparator"] }, 'text="0n", tokenFlags=["ContainsSeparator"]',
    { ...typedValue(), role: "value", value: 0n }, `TypedBigInt(${valueWire}, role="value", value=0n)`);
});
const codecClass = { definition: ownerId, parameters: [codecParameterType], type: 0, heritage: [0], members: [ownerId], attributes: [codecAttribute] };
const codecClassWire = `TypedClass(definition=def:"${ownerId}", parameters=[${codecParameterTypeWire}], type=t:0, ` +
  `heritage=[t:0], members=[def:"${ownerId}"], attributes=[${codecAttributeWire}])`;
const codecHeritageExpression = (identity, parent) => ({ ...header(identity, parent), kind: "ExpressionWithTypeArguments",
  expression: codecName(identity + 1, identity), typeArguments: nodeList([codecType(identity + 2, identity)]),
  tsonic: { role: "heritage", type: 0, bindings: emptyBindings(), declarations: [ownerId] } });
const codecHeritageDefinitions = (identity, parent) => [
  `ExpressionWithTypeArguments(${syntaxHeaderWire(identity, parent)}, expression=n:${identity + 1}, ` +
    `typeArguments=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:${identity + 2}]), ` +
    `tsonic=TypedInstantiation(role="heritage", type=t:0, bindings=${codecBindingsWire}, declarations=[def:"${ownerId}"]))`,
  codecNameWire(identity + 1, identity), codecTypeWire(identity + 2, identity),
];
for (const kind of ["ClassDeclaration", "ClassExpression"]) {
  test(`actual ${kind} has nonempty parameter/heritage/member/attribute vectors and its specific phase`, () => {
    const heritage = { ...header(11, 4), kind: "HeritageClause", token: "ExtendsKeyword",
      types: nodeList([codecHeritageExpression(12, 11)]), tsonic: { types: [0] } };
    const member = { ...header(15, 4), kind: "SemicolonClassElement", tsonic: null };
    assertSyntaxPayload({ ...header(4, 2), kind, modifiers: nodeList(), name: codecName(5, 4), typeParameters: nodeList([codecTypeParameter(6, 4)]),
      heritageClauses: nodeList([heritage]), members: nodeList([member]),
      tsonic: kind === "ClassDeclaration" ? codecClass : { ...typedValue(), declaration: codecClass } }, [
      `${kind}(${syntaxHeaderWire(4, 2)}, modifiers=ModifierList(loc=TextRange(pos=0, end=0), nodes=[]), name=n:5, typeParameters=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:6]), ` +
        'heritageClauses=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:11]), members=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:15]), ' +
        `tsonic=${kind === "ClassDeclaration" ? codecClassWire : `TypedClassValue(${valueWire}, declaration=${codecClassWire})`})`,
      codecNameWire(5, 4), ...codecTypeParameterDefinitions(6, 4),
      `HeritageClause(${syntaxHeaderWire(11, 4)}, token="ExtendsKeyword", types=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:12]), ` +
        'tsonic=TypedHeritage(types=[t:0]))', ...codecHeritageDefinitions(12, 11),
      `SemicolonClassElement(${syntaxHeaderWire(15, 4)}, tsonic=null)`,
    ], kind);
  });
}
for (const kind of ["TypeAliasDeclaration", "JSTypeAliasDeclaration"]) {
  test(`actual ${kind} retains its declared type, syntax parameters and parameter identities`, () => {
    assertSyntaxPayload({ ...header(4, 2), kind, modifiers: nodeList(), name: codecName(5, 4), typeParameters: nodeList([codecTypeParameter(6, 4)]),
      type: codecType(11, 4), tsonic: { definition: ownerId, parameters: [codecParameterType], type: 0 } }, [
      `${kind}(${syntaxHeaderWire(4, 2)}, modifiers=ModifierList(loc=TextRange(pos=0, end=0), nodes=[]), name=n:5, typeParameters=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:6]), ` +
        `type=n:11, tsonic=TypedAlias(definition=def:"${ownerId}", parameters=[${codecParameterTypeWire}], type=t:0))`,
      codecNameWire(5, 4), ...codecTypeParameterDefinitions(6, 4), codecTypeWire(11, 4),
    ], kind);
  });
}
test("actual interface type elements retain declared read/write capabilities", () => {
  const member = { ...header(11, 4), kind: "IndexSignature", modifiers: nodeList(), typeParameters: null,
    parameters: nodeList([codecParameter(12, 11)]), type: codecType(18, 11), fullSignature: codecType(19, 11),
    tsonic: { definition: ownerId, key: 0, read: 0, write: 0 } };
  assertSyntaxPayload({ ...header(4, 2), kind: "InterfaceDeclaration", modifiers: nodeList(), name: codecName(5, 4),
    typeParameters: nodeList([codecTypeParameter(6, 4)]), heritageClauses: nodeList(), members: nodeList([member]),
    tsonic: { definition: ownerId, parameters: [codecParameterType], type: 0, members: [ownerId] } }, [
    `InterfaceDeclaration(${syntaxHeaderWire(4, 2)}, modifiers=ModifierList(loc=TextRange(pos=0, end=0), nodes=[]), name=n:5, typeParameters=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:6]), ` +
      'heritageClauses=NodeList(loc=TextRange(pos=0, end=0), nodes=[]), members=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:11]), ' +
      `tsonic=TypedInterface(definition=def:"${ownerId}", parameters=[${codecParameterTypeWire}], type=t:0, members=[def:"${ownerId}"]))`,
    codecNameWire(5, 4), ...codecTypeParameterDefinitions(6, 4),
    `IndexSignature(${syntaxHeaderWire(11, 4)}, modifiers=ModifierList(loc=TextRange(pos=0, end=0), nodes=[]), typeParameters=null, parameters=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:12]), ` +
      `type=n:18, fullSignature=n:19, tsonic=TypedIndexDeclaration(definition=def:"${ownerId}", key=t:0, read=t:0, write=t:0))`,
    ...codecParameterDefinitions(12, 11), codecTypeWire(18, 11), codecTypeWire(19, 11),
  ], "interface");
});
test("actual enum members preserve initializer publication, attributes and syntax postfix tokens", () => {
  const member = { ...header(6, 4), kind: "EnumMember", modifiers: nodeList(), name: codecName(7, 6),
    postfixToken: { ...header(8, 6), kind: "ExclamationToken", tsonic: null }, initializer: codecName(9, 6),
    tsonic: { definition: ownerId, storage: 0, initializer: bodyId, attributes: [codecAttribute] } };
  assertSyntaxPayload({ ...header(4, 2), kind: "EnumDeclaration", modifiers: nodeList(), name: codecName(5, 4), members: nodeList([member]),
    tsonic: { definition: ownerId, type: 0, members: [ownerId] } }, [
    `EnumDeclaration(${syntaxHeaderWire(4, 2)}, modifiers=ModifierList(loc=TextRange(pos=0, end=0), nodes=[]), name=n:5, members=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:6]), ` +
      `tsonic=TypedEnum(definition=def:"${ownerId}", type=t:0, members=[def:"${ownerId}"]))`, codecNameWire(5, 4),
    `EnumMember(${syntaxHeaderWire(6, 4)}, modifiers=ModifierList(loc=TextRange(pos=0, end=0), nodes=[]), name=n:7, postfixToken=n:8, initializer=n:9, ` +
      `tsonic=TypedStorageDeclaration(definition=def:"${ownerId}", storage=t:0, initializer=body:"${bodyId}", attributes=[${codecAttributeWire}]))`,
    codecNameWire(7, 6), `ExclamationToken(${syntaxHeaderWire(8, 6)}, tsonic=null)`, codecNameWire(9, 6),
  ], "enum");
});
for (const kind of ["PropertySignature", "PropertyDeclaration"]) {
  test(`actual ${kind} retains its complete storage declaration and nullable fields`, () => {
    assertSyntaxPayload({ ...header(4, 2), kind, modifiers: nodeList(), name: codecName(5, 4),
      postfixToken: { ...header(6, 4), kind: "QuestionToken", tsonic: null }, type: codecType(7, 4),
      initializer: codecName(8, 4), tsonic: { definition: ownerId, storage: 0, initializer: bodyId, attributes: [codecAttribute] } }, [
      `${kind}(${syntaxHeaderWire(4, 2)}, modifiers=ModifierList(loc=TextRange(pos=0, end=0), nodes=[]), name=n:5, postfixToken=n:6, type=n:7, initializer=n:8, ` +
        `tsonic=TypedStorageDeclaration(definition=def:"${ownerId}", storage=t:0, initializer=body:"${bodyId}", attributes=[${codecAttributeWire}]))`,
      codecNameWire(5, 4), `QuestionToken(${syntaxHeaderWire(6, 4)}, tsonic=null)`, codecTypeWire(7, 4), codecNameWire(8, 4),
    ], kind);
  });
}
const codecProjectTarget = { target: "project", module: moduleId };
const codecProjectTargetWire = `ImportTarget(target="project", module=mod:"${moduleId}")`;
const codecImported = { binding: codecBinding };
const codecImportedWire = `TypedImportBinding(binding=${codecBindingWire})`;
const codecExported = { binding: codecBinding };
const codecExportedWire = `TypedExportBinding(binding=${codecBindingWire})`;
const codecNamespace = { definition: ownerId, binding: codecBinding };
const codecNamespaceWire = `TypedNamespaceExport(definition=def:"${ownerId}", binding=${codecBindingWire})`;
for (const packageName of [null, "library-package"]) {
  test(`actual external library module identity retains ${packageName === null ? "no" : "its"} package name`, () => {
    const target = { target: "library", module: { providerId: "provider", providerVersion: "1.0.0", packageName,
      moduleSpecifier: "library/module", providerModuleId: "module" } };
    const targetWire = 'ImportTarget(target="library", module=LibraryModuleIdentity(providerId="provider", providerVersion="1.0.0", ' +
      `packageName=${packageName === null ? "null" : '"library-package"'}, moduleSpecifier="library/module", providerModuleId="module"))`;
    assertSyntaxPayload({ ...header(4, 2), kind: "ExternalModuleReference", expression: codecName(5, 4), tsonic: { target } }, [
      `ExternalModuleReference(${syntaxHeaderWire(4, 2)}, expression=n:5, tsonic=TypedModuleReference(target=${targetWire}))`, codecNameWire(5, 4),
    ], "library identity");
  });
}
for (const kind of ["NamespaceImport", "NamespaceExport", "NamespaceExportDeclaration"]) {
  test(`actual ${kind} retains its specific module-binding port`, () => {
    const exported = kind !== "NamespaceImport";
    const extra = kind === "NamespaceExportDeclaration" ? { modifiers: nodeList() } : {};
    assertSyntaxPayload({ ...header(4, 2), kind, ...extra, name: codecName(5, 4), tsonic: kind === "NamespaceExport" ? codecNamespace : exported ? codecExported : codecImported }, [
      `${kind}(${syntaxHeaderWire(4, 2)}, ${kind === "NamespaceExportDeclaration" ? "modifiers=ModifierList(loc=TextRange(pos=0, end=0), nodes=[]), " : ""}` +
        `name=n:5, tsonic=${kind === "NamespaceExport" ? codecNamespaceWire : exported ? codecExportedWire : codecImportedWire})`, codecNameWire(5, 4),
    ], kind);
  });
}
for (const [kind, childKind, phase, phaseWire] of [
  ["NamedImports", "ImportSpecifier", codecImported, codecImportedWire], ["NamedExports", "ExportSpecifier", codecExported, codecExportedWire],
]) {
  for (const present of [false, true]) {
    test(`actual ${kind} retains a nonempty specifier list with ${present ? "an aliased" : "a direct"} name`, () => {
      const child = { ...header(5, 4), kind: childKind, isTypeOnly: true, propertyName: present ? codecName(6, 5) : null,
        name: codecName(present ? 7 : 6, 5), tsonic: phase };
      assertSyntaxPayload({ ...header(4, 2), kind, elements: nodeList([child]), tsonic: null }, [
        `${kind}(${syntaxHeaderWire(4, 2)}, elements=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:5]), tsonic=null)`,
        `${childKind}(${syntaxHeaderWire(5, 4)}, isTypeOnly=true, propertyName=${present ? "n:6" : "null"}, ` +
          `name=n:${present ? 7 : 6}, tsonic=${phaseWire})`, codecNameWire(6, 5), ...(present ? [codecNameWire(7, 5)] : []),
      ], kind);
    });
  }
}
for (const phaseModifier of [null, "TypeKeyword", "DeferKeyword"]) {
  test(`actual import clause retains its ${phaseModifier ?? "ordinary"} modifier and both binding children`, () => {
    const binding = { ...header(6, 4), kind: "NamespaceImport", name: codecName(7, 6), tsonic: codecImported };
    assertSyntaxPayload({ ...header(4, 2), kind: "ImportClause", phaseModifier, name: codecName(5, 4), namedBindings: binding,
      tsonic: codecImported }, [
      `ImportClause(${syntaxHeaderWire(4, 2)}, phaseModifier=${phaseModifier === null ? "null" : `"${phaseModifier}"`}, ` +
        `name=n:5, namedBindings=n:6, tsonic=${codecImportedWire})`, codecNameWire(5, 4),
      `NamespaceImport(${syntaxHeaderWire(6, 4)}, name=n:7, tsonic=${codecImportedWire})`, codecNameWire(7, 6),
    ], "import clause");
  });
}
for (const kind of ["ImportDeclaration", "JSImportDeclaration"]) {
  for (const present of [false, true]) {
    test(`actual ${kind} retains ${present ? "complete" : "absent"} clause/attribute metadata`, () => {
      const clause = present ? { ...header(5, 4), kind: "ImportClause", phaseModifier: null, name: null, namedBindings: null, tsonic: codecImported } : null;
      const specifier = present ? 6 : 5;
      const attribute = { ...header(8, 7), kind: "ImportAttribute", name: codecName(9, 8), value: codecName(10, 8), tsonic: null };
      const attributes = present ? { ...header(7, 4), kind: "ImportAttributes", token: "WithKeyword", attributes: nodeList([attribute]), multiLine: true, tsonic: null } : null;
      assertSyntaxPayload({ ...header(4, 2), kind, modifiers: nodeList(), importClause: clause, moduleSpecifier: codecName(specifier, 4), attributes,
        tsonic: { target: codecProjectTarget } }, [
        `${kind}(${syntaxHeaderWire(4, 2)}, modifiers=ModifierList(loc=TextRange(pos=0, end=0), nodes=[]), importClause=${present ? "n:5" : "null"}, moduleSpecifier=n:${specifier}, ` +
          `attributes=${present ? "n:7" : "null"}, tsonic=TypedImport(target=${codecProjectTargetWire}))`,
        ...(present ? [`ImportClause(${syntaxHeaderWire(5, 4)}, phaseModifier=null, name=null, namedBindings=null, tsonic=${codecImportedWire})`] : []),
        codecNameWire(specifier, 4), ...(present ? [
          `ImportAttributes(${syntaxHeaderWire(7, 4)}, token="WithKeyword", attributes=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:8]), multiLine=true, tsonic=null)`,
          `ImportAttribute(${syntaxHeaderWire(8, 7)}, name=n:9, value=n:10, tsonic=null)`, codecNameWire(9, 8), codecNameWire(10, 8),
        ] : []),
      ], kind);
    });
  }
}
test("actual import-equals retains its qualified module reference and binding declaration", () => {
  const reference = { ...header(6, 4), kind: "ExternalModuleReference", expression: codecName(7, 6), tsonic: { target: codecProjectTarget } };
  assertSyntaxPayload({ ...header(4, 2), kind: "ImportEqualsDeclaration", modifiers: nodeList(), isTypeOnly: true,
    name: codecName(5, 4), moduleReference: reference, tsonic: codecImported }, [
    `ImportEqualsDeclaration(${syntaxHeaderWire(4, 2)}, modifiers=ModifierList(loc=TextRange(pos=0, end=0), nodes=[]), isTypeOnly=true, name=n:5, moduleReference=n:6, tsonic=${codecImportedWire})`,
    codecNameWire(5, 4), `ExternalModuleReference(${syntaxHeaderWire(6, 4)}, expression=n:7, tsonic=TypedModuleReference(target=${codecProjectTargetWire}))`,
    codecNameWire(7, 6),
  ], "import equals");
});
for (const present of [false, true]) {
  test(`actual export declaration keeps ${present ? "its target and export clause" : "the absent target and clause"}`, () => {
    const exportClause = present ? { ...header(5, 4), kind: "NamespaceExport", name: codecName(6, 5), tsonic: codecNamespace } : null;
    assertSyntaxPayload({ ...header(4, 2), kind: "ExportDeclaration", modifiers: nodeList(), isTypeOnly: true, exportClause,
      moduleSpecifier: present ? codecName(7, 4) : null, attributes: null,
      tsonic: { target: present ? codecProjectTarget : null } }, [
      `ExportDeclaration(${syntaxHeaderWire(4, 2)}, modifiers=ModifierList(loc=TextRange(pos=0, end=0), nodes=[]), isTypeOnly=true, exportClause=${present ? "n:5" : "null"}, ` +
        `moduleSpecifier=${present ? "n:7" : "null"}, attributes=null, tsonic=TypedExport(` +
        `target=${present ? codecProjectTargetWire : "null"}))`,
      ...(present ? [`NamespaceExport(${syntaxHeaderWire(5, 4)}, name=n:6, tsonic=${codecNamespaceWire})`, codecNameWire(6, 5), codecNameWire(7, 4)] : []),
    ], "export declaration");
    assertSyntaxPayload({ ...header(4, 2), kind: "ExportAssignment", modifiers: nodeList(), isExportEquals: true,
      type: present ? codecType(5, 4) : null, expression: codecName(present ? 6 : 5, 4), tsonic: { definition: ownerId, type: 0 } }, [
      `ExportAssignment(${syntaxHeaderWire(4, 2)}, modifiers=ModifierList(loc=TextRange(pos=0, end=0), nodes=[]), isExportEquals=true, type=${present ? "n:5" : "null"}, ` +
        `expression=n:${present ? 6 : 5}, tsonic=TypedExportAssignment(definition=def:"${ownerId}", type=t:0))`,
      ...(present ? [codecTypeWire(5, 4)] : []), codecNameWire(present ? 6 : 5, 4),
    ], "export assignment");
  });
}
for (const kind of ["JSDocImplementsTag", "JSDocAugmentsTag"]) {
  test(`actual ${kind} retains its expression-with-type-arguments child and heritage phase`, () => {
    const className = { ...header(7, 4), kind: "ExpressionWithTypeArguments", expression: codecName(8, 7), typeArguments: nodeList([codecType(9, 7)]),
      tsonic: { role: "heritage", type: 0, bindings: emptyBindings(), declarations: [ownerId] } };
    assertSyntaxPayload({ ...header(4, 2), kind, tagName: codecName(5, 4), comment: nodeList([codecDocText(6, 4)]), className, tsonic: null }, [
      `${kind}(${syntaxHeaderWire(4, 2)}, tagName=n:5, comment=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:6]), className=n:7, tsonic=null)`,
      codecNameWire(5, 4), codecDocTextWire(6, 4),
      `ExpressionWithTypeArguments(${syntaxHeaderWire(7, 4)}, expression=n:8, typeArguments=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:9]), ` +
        `tsonic=TypedInstantiation(role="heritage", type=t:0, bindings=${codecBindingsWire}, declarations=[def:"${ownerId}"]))`,
      codecNameWire(8, 7), codecTypeWire(9, 7),
    ], kind);
  });
}
test("actual JSDoc import retains its independent clause/module/attributes fields", () => {
  const clause = { ...header(7, 4), kind: "ImportClause", phaseModifier: "TypeKeyword", name: null, namedBindings: null, tsonic: codecImported };
  const attributes = { ...header(9, 4), kind: "ImportAttributes", token: "AssertKeyword", attributes: nodeList(), multiLine: false, tsonic: null };
  assertSyntaxPayload({ ...header(4, 2), kind: "JSDocImportTag", tagName: codecName(5, 4), comment: nodeList([codecDocText(6, 4)]),
    importClause: clause, moduleSpecifier: codecName(8, 4), attributes, tsonic: null }, [
    `JSDocImportTag(${syntaxHeaderWire(4, 2)}, tagName=n:5, comment=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:6]), ` +
      'importClause=n:7, moduleSpecifier=n:8, attributes=n:9, tsonic=null)', codecNameWire(5, 4), codecDocTextWire(6, 4),
    `ImportClause(${syntaxHeaderWire(7, 4)}, phaseModifier="TypeKeyword", name=null, namedBindings=null, tsonic=${codecImportedWire})`, codecNameWire(8, 4),
    `ImportAttributes(${syntaxHeaderWire(9, 4)}, token="AssertKeyword", attributes=NodeList(loc=TextRange(pos=0, end=0), nodes=[]), multiLine=false, tsonic=null)`,
  ], "JSDoc import");
});
const codecEmptyStatement = (identity, parent) => ({ ...header(identity, parent), kind: "EmptyStatement", tsonic: null });
const codecEmptyStatementWire = (identity, parent) => `EmptyStatement(${syntaxHeaderWire(identity, parent)}, tsonic=null)`;
const codecBlock = (identity, parent) => ({ ...header(identity, parent), kind: "Block", statements: nodeList([]), multiLine: true, tsonic: null });
const codecBlockWire = (identity, parent) => `Block(${syntaxHeaderWire(identity, parent)}, statements=NodeList(loc=TextRange(pos=0, end=0), nodes=[]), multiLine=true, tsonic=null)`;
const codecVariable = (identity, parent) => ({ ...header(identity, parent), kind: "VariableDeclaration", name: codecName(identity + 1, identity),
  exclamationToken: { ...header(identity + 2, identity), kind: "ExclamationToken", tsonic: null },
  type: codecType(identity + 3, identity), initializer: codecName(identity + 4, identity),
  tsonic: { declaration: { kind: "local", local: { body: bodyId, local: 0 } }, storage: 0, initializer: bodyId } });
const codecVariableDefinitions = (identity, parent) => [
  `VariableDeclaration(${syntaxHeaderWire(identity, parent)}, name=n:${identity + 1}, exclamationToken=n:${identity + 2}, ` +
    `type=n:${identity + 3}, initializer=n:${identity + 4}, tsonic=TypedBinding(declaration=local(local=${localWire}), storage=t:0, initializer=body:"${bodyId}"))`,
  codecNameWire(identity + 1, identity), `ExclamationToken(${syntaxHeaderWire(identity + 2, identity)}, tsonic=null)`,
  codecTypeWire(identity + 3, identity), codecNameWire(identity + 4, identity),
];
for (const using of [false, true]) {
  test(`actual ${using ? "using" : "ordinary"} variables retain declaration/storage/initializer and protocol data`, () => {
    const phase = using ? { role: "using", asynchronous: true, protocols: [{ kind: "decided", decision: { ...codecProtocol, kind: "dispose" } }] }
      : { role: "ordinary" };
    const phaseWire = using ? `TypedVariableList(role="using", asynchronous=true, protocols=[decided(decision=${
      codecProtocolWire.replace('kind="delegate"', 'kind="dispose"')})])` : 'TypedVariableList(role="ordinary")';
    const declarations = { ...header(6, 4), kind: "VariableDeclarationList", declarations: nodeList([codecVariable(7, 6)]), tsonic: phase };
    assertSyntaxPayload({ ...header(4, 2), kind: "VariableStatement", modifiers: nodeList([{ ...header(5, 4), kind: "ExportKeyword", tsonic: null }]),
      declarationList: declarations, tsonic: null }, [
      `VariableStatement(${syntaxHeaderWire(4, 2)}, modifiers=ModifierList(loc=TextRange(pos=0, end=0), nodes=[n:5]), declarationList=n:6, tsonic=null)`,
      `ExportKeyword(${syntaxHeaderWire(5, 4)}, tsonic=null)`,
      `VariableDeclarationList(${syntaxHeaderWire(6, 4)}, declarations=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:7]), tsonic=${phaseWire})`,
      ...codecVariableDefinitions(7, 6),
    ], "variables");
  });
}
for (const kind of ["ObjectBindingPattern", "ArrayBindingPattern"]) {
  test(`actual ${kind} retains every real binding-element child and its storage declaration`, () => {
    const element = { ...header(5, 4), kind: "BindingElement", dotDotDotToken: { ...header(6, 5), kind: "DotDotDotToken", tsonic: null },
      propertyName: codecName(7, 5), name: codecName(8, 5), initializer: codecName(9, 5),
      tsonic: { declaration: { kind: "definition", definition: ownerId }, storage: 0, initializer: bodyId, role: "binding" } };
    assertSyntaxPayload({ ...header(4, 2), kind, elements: nodeList([element]), tsonic: { storage: 0 } }, [
      `${kind}(${syntaxHeaderWire(4, 2)}, elements=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:5]), tsonic=TypedBindingPattern(storage=t:0))`,
      `BindingElement(${syntaxHeaderWire(5, 4)}, dotDotDotToken=n:6, propertyName=n:7, name=n:8, initializer=n:9, ` +
        `tsonic=TypedBindingElement(declaration=definition(definition=def:"${ownerId}"), storage=t:0, initializer=body:"${bodyId}", role="binding"))`,
      `DotDotDotToken(${syntaxHeaderWire(6, 5)}, tsonic=null)`, codecNameWire(7, 5), codecNameWire(8, 5), codecNameWire(9, 5),
    ], kind);
  });
}
test("an actual binding-element hole has no invented declaration or storage in the complete text/value vector", () => {
  assertSyntaxPayload({ ...header(4, 2), kind: "BindingElement", dotDotDotToken: null, propertyName: null,
    name: null, initializer: null, tsonic: { role: "hole" } }, [
    `BindingElement(${syntaxHeaderWire(4, 2)}, dotDotDotToken=null, propertyName=null, name=null, initializer=null, ` +
      'tsonic=TypedBindingElement(role="hole"))',
  ], "binding hole");
});

test("the removed untagged binding-element phase is invalid text, not a compatibility arm", () => {
  const { body, expected } = syntaxPayloadCase({ ...header(4, 2), kind: "BindingElement", dotDotDotToken: null,
    propertyName: null, name: null, initializer: null, tsonic: { role: "hole" } }, [
    `BindingElement(${syntaxHeaderWire(4, 2)}, dotDotDotToken=null, propertyName=null, name=null, initializer=null, ` +
      'tsonic=TypedBindingElement(role="hole"))',
  ]);
  const old = `TypedBinding(declaration=definition(definition=def:"${ownerId}"), storage=t:0, initializer=null)`;
  const input = expected.replace('TypedBindingElement(role="hole")', old);
  const offset = input.indexOf(old);
  const lines = input.slice(0, offset).split("\n");
  assertCompleteValue(product.parseTir(input), { kind: "invalid-text", offset, line: lines.length,
    column: lines[lines.length - 1].length + 1, expected: ["TypedBindingElement"], found: "TypedBinding" });
  assertBodyRoundTrip(body, expected, "the complete current hole arm");
});

test("an empty binding-element phase cannot publish either required role arm", () => {
  const { expected } = syntaxPayloadCase({ ...header(4, 2), kind: "BindingElement", dotDotDotToken: null,
    propertyName: null, name: null, initializer: null, tsonic: { role: "hole" } }, [
    `BindingElement(${syntaxHeaderWire(4, 2)}, dotDotDotToken=null, propertyName=null, name=null, initializer=null, ` +
      'tsonic=TypedBindingElement(role="hole"))',
  ]);
  const input = expected.replace('TypedBindingElement(role="hole")', 'TypedBindingElement()');
  const offset = input.indexOf('TypedBindingElement()') + 'TypedBindingElement('.length;
  const lines = input.slice(0, offset).split("\n");
  assertCompleteValue(product.parseTir(input), { kind: "invalid-text", offset, line: lines.length,
    column: lines[lines.length - 1].length + 1, expected: ["declaration", "role"], found: ")" });
});
test("actual catch declarations retain their genuine body-local storage and all initializer syntax", () => {
  assertSyntaxPayload({ ...header(4, 2), kind: "CatchClause", variableDeclaration: codecVariable(5, 4), block: codecBlock(10, 4), tsonic: null }, [
    `CatchClause(${syntaxHeaderWire(4, 2)}, variableDeclaration=n:5, block=n:10, tsonic=null)`,
    ...codecVariableDefinitions(5, 4), codecBlockWire(10, 4),
  ], "catch binding");
});
for (const keyword of ["ModuleKeyword", "NamespaceKeyword"]) {
  test(`actual ${keyword} declaration retains body-before-name traversal and canonical template facts`, () => {
    const block = { ...header(6, 4), kind: "ModuleBlock", statements: nodeList([codecEmptyStatement(7, 6)]), tsonic: null };
    assertSyntaxPayload({ ...header(4, 2), kind: "ModuleDeclaration", modifiers: nodeList(),
      asteriskToken: { ...header(5, 4), kind: "AsteriskToken", tsonic: null }, body: block, keyword, name: codecName(8, 4),
      tsonic: { definition: ownerId, type: 0, template: codecCallable.template } }, [
      `ModuleDeclaration(${syntaxHeaderWire(4, 2)}, modifiers=ModifierList(loc=TextRange(pos=0, end=0), nodes=[]), ` +
        `asteriskToken=n:5, body=n:6, keyword="${keyword}", name=n:8, tsonic=TypedNamespace(definition=def:"${ownerId}", type=t:0, ` +
        `template=TypedBodyTemplate(body=body:"${bodyId}", lexicalBindings=${codecBindingsWire}, dependence="parametric")))`,
      `AsteriskToken(${syntaxHeaderWire(5, 4)}, tsonic=null)`,
      `ModuleBlock(${syntaxHeaderWire(6, 4)}, statements=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:7]), tsonic=null)`,
      codecEmptyStatementWire(7, 6), codecNameWire(8, 4),
    ], keyword);
  });
}
test("a real missing declaration retains its explicit empty modifier record", () => {
  assertSyntaxPayload({ ...header(4, 2), kind: "MissingDeclaration", modifiers: nodeList(), tsonic: null }, [
    `MissingDeclaration(${syntaxHeaderWire(4, 2)}, modifiers=ModifierList(loc=TextRange(pos=0, end=0), nodes=[]), tsonic=null)`,
  ], "missing declaration");
});
test("the actual Block multiLine field is required before its phase and never silently discarded", () => {
  const body = emptyModuleBody();
  body.root = { ...header(0), kind: "Block", statements: nodeList(), multiLine: true, tsonic: null };
  const bodyHeader = readFileSync(resolve(repository, functionDirectory, "empty-module.input.tir"), "utf8").split("\n")[0];
  const expected = typedWire(bodyHeader, [
    `n:0=Block(${syntaxHeaderWire(0, null)}, statements=NodeList(loc=TextRange(pos=0, end=0), nodes=[]), multiLine=true, tsonic=null)`,
  ]);
  assertBodyRoundTrip(body, expected, "Block complete multiLine field");
  const text = expected.replace(", multiLine=true", "");
  const offset = text.indexOf("tsonic=null", text.indexOf("n:0=Block("));
  assertInvalidText(text, offset, ["multiLine"], "tsonic");
});
for (const kind of ["FunctionDeclaration", "FunctionExpression", "Constructor"]) {
  test(`actual ${kind} retains its complete callable or closure record and all declaration children`, () => {
    const closure = kind === "FunctionExpression";
    const fields = { modifiers: nodeList(), typeParameters: nodeList([codecTypeParameter(5, 4)]), parameters: nodeList([codecParameter(10, 4)]),
      type: codecType(16, 4), fullSignature: codecType(17, 4), asteriskToken: { ...header(18, 4), kind: "AsteriskToken", tsonic: null },
      body: codecBlock(19, 4), ...(kind === "Constructor" ? {} : { name: codecName(20, 4) }) };
    const phase = closure ? { ...typedValue(), callable: codecCallable, closure: closureDecisionOf(0, [{ body: bodyId, local: 0 }]) } : codecCallable;
    const phaseWire = closure ? `TypedClosure(${valueWire}, callable=${codecCallableWire}, closure=${closureDecisionWire([{ body: bodyId, local: 0 }])})` : codecCallableWire;
    assertSyntaxPayload({ ...header(4, 2), kind, ...fields, tsonic: phase }, [
      `${kind}(${syntaxHeaderWire(4, 2)}, modifiers=ModifierList(loc=TextRange(pos=0, end=0), nodes=[]), typeParameters=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:5]), ` +
        'parameters=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:10]), type=n:16, fullSignature=n:17, asteriskToken=n:18, body=n:19, ' +
        `${kind === "Constructor" ? "" : "name=n:20, "}tsonic=${phaseWire})`,
      ...codecTypeParameterDefinitions(5, 4), ...codecParameterDefinitions(10, 4), codecTypeWire(16, 4), codecTypeWire(17, 4),
      `AsteriskToken(${syntaxHeaderWire(18, 4)}, tsonic=null)`, codecBlockWire(19, 4),
      ...(kind === "Constructor" ? [] : [codecNameWire(20, 4)]),
    ], kind);
  });
}
for (const kind of ["GetAccessor", "SetAccessor", "MethodSignature", "MethodDeclaration"]) {
  test(`actual ${kind} retains its named callable fields, not an implementation-name oracle`, () => {
    const implemented = kind !== "MethodSignature";
    const fields = { modifiers: nodeList(), name: codecName(5, 4), postfixToken: { ...header(6, 4), kind: "QuestionToken", tsonic: null },
      typeParameters: nodeList([codecTypeParameter(7, 4)]), parameters: nodeList([codecParameter(12, 4)]),
      type: codecType(18, 4), fullSignature: codecType(19, 4), ...(implemented ? {
        asteriskToken: { ...header(20, 4), kind: "AsteriskToken", tsonic: null }, body: codecBlock(21, 4),
      } : {}) };
    assertSyntaxPayload({ ...header(4, 2), kind, ...fields, tsonic: codecCallable }, [
      `${kind}(${syntaxHeaderWire(4, 2)}, modifiers=ModifierList(loc=TextRange(pos=0, end=0), nodes=[]), name=n:5, postfixToken=n:6, ` +
        'typeParameters=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:7]), parameters=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:12]), ' +
        `type=n:18, fullSignature=n:19, ${implemented ? "asteriskToken=n:20, body=n:21, " : ""}tsonic=${codecCallableWire})`,
      codecNameWire(5, 4), `QuestionToken(${syntaxHeaderWire(6, 4)}, tsonic=null)`, ...codecTypeParameterDefinitions(7, 4),
      ...codecParameterDefinitions(12, 4), codecTypeWire(18, 4), codecTypeWire(19, 4),
      ...(implemented ? [`AsteriskToken(${syntaxHeaderWire(20, 4)}, tsonic=null)`, codecBlockWire(21, 4)] : []),
    ], kind);
  });
}
test("actual arrow and static initializer syntax retain their body/token/template records", () => {
  assertSyntaxPayload({ ...header(4, 2), kind: "ArrowFunction", modifiers: nodeList(), typeParameters: null, parameters: nodeList([codecParameter(5, 4)]),
    type: codecType(11, 4), fullSignature: codecType(12, 4), asteriskToken: null, body: codecBlock(13, 4),
    equalsGreaterThanToken: { ...header(14, 4), kind: "EqualsGreaterThanToken", tsonic: null },
    tsonic: { ...typedValue(), callable: codecCallable, closure: closureDecisionOf(0, [{ body: bodyId, local: 0 }], "captured-value") } }, [
    `ArrowFunction(${syntaxHeaderWire(4, 2)}, modifiers=ModifierList(loc=TextRange(pos=0, end=0), nodes=[]), typeParameters=null, parameters=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:5]), ` +
      'type=n:11, fullSignature=n:12, asteriskToken=null, body=n:13, equalsGreaterThanToken=n:14, ' +
      `tsonic=TypedClosure(${valueWire}, callable=${codecCallableWire}, closure=${closureDecisionWire([{ body: bodyId, local: 0 }], "captured-value")}))`,
    ...codecParameterDefinitions(5, 4), codecTypeWire(11, 4), codecTypeWire(12, 4), codecBlockWire(13, 4),
    `EqualsGreaterThanToken(${syntaxHeaderWire(14, 4)}, tsonic=null)`,
  ], "arrow");
  assertSyntaxPayload({ ...header(4, 2), kind: "ClassStaticBlockDeclaration", modifiers: nodeList(), body: codecBlock(5, 4),
    tsonic: { template: codecCallable.template } }, [
    `ClassStaticBlockDeclaration(${syntaxHeaderWire(4, 2)}, modifiers=ModifierList(loc=TextRange(pos=0, end=0), nodes=[]), body=n:5, tsonic=TypedStaticBlock(template=` +
      `TypedBodyTemplate(body=body:"${bodyId}", lexicalBindings=${codecBindingsWire}, dependence="parametric")))`, codecBlockWire(5, 4),
  ], "static block");
});
for (const kind of ["EmptyStatement", "DebuggerStatement", "NotEmittedStatement", "NotEmittedTypeElement", "SemicolonClassElement"]) {
  test(`actual ${kind} has its entire header and null phase, not an invented empty schema`, () => {
    assertSyntaxPayload({ ...header(4, 2), kind, tsonic: null }, [`${kind}(${syntaxHeaderWire(4, 2)}, tsonic=null)`], kind);
  });
}
for (const present of [false, true]) {
  test(`actual if/for/return optional children are ${present ? "present" : "absent"} in declared traversal order`, () => {
    assertSyntaxPayload({ ...header(4, 2), kind: "IfStatement", expression: codecName(5, 4), thenStatement: codecEmptyStatement(6, 4),
      elseStatement: present ? codecEmptyStatement(7, 4) : null, tsonic: null }, [
      `IfStatement(${syntaxHeaderWire(4, 2)}, expression=n:5, thenStatement=n:6, elseStatement=${present ? "n:7" : "null"}, tsonic=null)`,
      codecNameWire(5, 4), codecEmptyStatementWire(6, 4), ...(present ? [codecEmptyStatementWire(7, 4)] : []),
    ], "if");
    assertSyntaxPayload({ ...header(4, 2), kind: "ForStatement", statement: codecEmptyStatement(5, 4),
      initializer: present ? codecName(6, 4) : null, condition: present ? codecName(7, 4) : null,
      incrementor: present ? codecName(8, 4) : null, tsonic: null }, [
      `ForStatement(${syntaxHeaderWire(4, 2)}, statement=n:5, initializer=${present ? "n:6" : "null"}, ` +
        `condition=${present ? "n:7" : "null"}, incrementor=${present ? "n:8" : "null"}, tsonic=null)`, codecEmptyStatementWire(5, 4),
      ...(present ? [codecNameWire(6, 4), codecNameWire(7, 4), codecNameWire(8, 4)] : []),
    ], "for");
    assertSyntaxPayload({ ...header(4, 2), kind: "ReturnStatement", expression: present ? codecName(5, 4) : null, tsonic: null }, [
      `ReturnStatement(${syntaxHeaderWire(4, 2)}, expression=${present ? "n:5" : "null"}, tsonic=null)`,
      ...(present ? [codecNameWire(5, 4)] : []),
    ], "return");
  });
}
for (const kind of ["DoStatement", "WhileStatement"]) {
  test(`actual ${kind} uses statement-before-expression traversal`, () => {
    assertSyntaxPayload({ ...header(4, 2), kind, statement: codecEmptyStatement(5, 4), expression: codecName(6, 4), tsonic: null }, [
      `${kind}(${syntaxHeaderWire(4, 2)}, statement=n:5, expression=n:6, tsonic=null)`, codecEmptyStatementWire(5, 4), codecNameWire(6, 4),
    ], kind);
  });
}
for (const kind of ["WithStatement", "ExpressionStatement", "ThrowStatement"]) {
  test(`actual ${kind} retains its expression and complete structural statement shape`, () => {
    const additional = kind === "WithStatement" ? { statement: codecEmptyStatement(6, 4) } : {};
    assertSyntaxPayload({ ...header(4, 2), kind, expression: codecName(5, 4), ...additional, tsonic: null }, [
      `${kind}(${syntaxHeaderWire(4, 2)}, expression=n:5, ${kind === "WithStatement" ? "statement=n:6, " : ""}tsonic=null)`,
      codecNameWire(5, 4), ...(kind === "WithStatement" ? [codecEmptyStatementWire(6, 4)] : []),
    ], kind);
  });
}
for (const kind of ["BreakStatement", "ContinueStatement"]) {
  for (const present of [false, true]) {
    test(`actual ${kind} retains its qualified target with ${present ? "named" : "unnamed"} transfer`, () => {
      const label = present ? { ...header(5, 4), kind: "Identifier", text: "target", tsonic: { role: "label", target: codecReference } } : null;
      assertSyntaxPayload({ ...header(4, 2), kind, label, tsonic: { target: codecReference } }, [
        `${kind}(${syntaxHeaderWire(4, 2)}, label=${present ? "n:5" : "null"}, tsonic=TypedControlTransfer(target=${codecReferenceWire}))`,
        ...(present ? [`Identifier(${syntaxHeaderWire(5, 4)}, text="target", tsonic=TypedName(role="label", target=${codecReferenceWire}))`] : []),
      ], kind);
    });
  }
}
test("a labelled statement preserves both the label's reference and the owner's target", () => {
  assertSyntaxPayload({ ...header(4, 2), kind: "LabeledStatement", label: { ...header(5, 4), kind: "Identifier", text: "target",
    tsonic: { role: "label", target: codecReference } }, statement: codecEmptyStatement(6, 4), tsonic: { target: codecReference } }, [
    `LabeledStatement(${syntaxHeaderWire(4, 2)}, label=n:5, statement=n:6, tsonic=TypedControlTransfer(target=${codecReferenceWire}))`,
    `Identifier(${syntaxHeaderWire(5, 4)}, text="target", tsonic=TypedName(role="label", target=${codecReferenceWire}))`, codecEmptyStatementWire(6, 4),
  ], "label");
});
test("actual case/default clauses keep their correlated expression domains and nonempty statement lists", () => {
  const operation = { kind: "native-operator", operator: "===", carrier: "float64" };
  const caseClause = { ...header(7, 6), kind: "CaseClause", expression: codecName(8, 7), statements: nodeList([codecEmptyStatement(9, 7)]),
    tsonic: { operation: { kind: "decided", decision: { permissionScope: null,
      decision: { kind: "selected", operation, operands: [0, 0], result: 1, execution: { kind: "pure" } } } } } };
  const defaultClause = { ...header(10, 6), kind: "DefaultClause", expression: null, statements: nodeList([codecEmptyStatement(11, 10)]), tsonic: null };
  assertSyntaxPayload({ ...header(4, 2), kind: "SwitchStatement", expression: codecName(5, 4), caseBlock: { ...header(6, 4),
    kind: "CaseBlock", clauses: nodeList([caseClause, defaultClause]), tsonic: null }, tsonic: null }, [
    `SwitchStatement(${syntaxHeaderWire(4, 2)}, expression=n:5, caseBlock=n:6, tsonic=null)`, codecNameWire(5, 4),
    `CaseBlock(${syntaxHeaderWire(6, 4)}, clauses=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:7, n:10]), tsonic=null)`,
    `CaseClause(${syntaxHeaderWire(7, 6)}, expression=n:8, statements=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:9]), ` +
      'tsonic=TypedCase(operation=decided(decision=TypedOperation(decision=selected(operation=native-operator(operator="===", carrier="float64"), operands=[t:0, t:0], result=t:1, execution=pure()), permissionScope=null))))',
    codecNameWire(8, 7), codecEmptyStatementWire(9, 7),
    `DefaultClause(${syntaxHeaderWire(10, 6)}, expression=null, statements=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:11]), tsonic=null)`,
    codecEmptyStatementWire(11, 10),
  ], "switch");
});
for (const present of [false, true]) {
  test(`actual try/catch/finally nullable branches are ${present ? "present" : "absent"}`, () => {
    const catchClause = present ? { ...header(6, 4), kind: "CatchClause", variableDeclaration: null, block: codecBlock(7, 6), tsonic: null } : null;
    assertSyntaxPayload({ ...header(4, 2), kind: "TryStatement", tryBlock: codecBlock(5, 4), catchClause,
      finallyBlock: present ? codecBlock(8, 4) : null, tsonic: null }, [
      `TryStatement(${syntaxHeaderWire(4, 2)}, tryBlock=n:5, catchClause=${present ? "n:6" : "null"}, ` +
        `finallyBlock=${present ? "n:8" : "null"}, tsonic=null)`, codecBlockWire(5, 4),
      ...(present ? [`CatchClause(${syntaxHeaderWire(6, 4)}, variableDeclaration=null, block=n:7, tsonic=null)`,
        codecBlockWire(7, 6), codecBlockWire(8, 4)] : []),
    ], "try");
  });
}
const codecDeferred = { invocation: { rule: "embed", input: {
  context: codecContext, from: codecEvidence, to: codecEvidence, role: "return",
} }, result: 0 };
const codecDeferredWire = `DeferredDecision(invocation=DeferredInvocation(rule="embed", input=EmbedInput(context=${codecContextWire}, ` +
  `from=${codecEvidenceWire}, to=${codecEvidenceWire}, role="return")), result=t:0)`;
const codecDeferredOutcome = { kind: "deferred", deferred: codecDeferred };
const codecDeferredOutcomeWire = `deferred(deferred=${codecDeferredWire})`;

test("a constructor with absent argument syntax is not normalized to an empty argument list", () => {
  assertSyntaxPayload({ ...header(4, 2), kind: "NewExpression", expression: codecName(5, 4), typeArguments: null, arguments: null,
    tsonic: { ...typedValue(), application: codecDeferredOutcome, operation: null } }, [
    `NewExpression(${syntaxHeaderWire(4, 2)}, expression=n:5, typeArguments=null, arguments=null, ` +
      `tsonic=TypedApplication(${valueWire}, application=${codecDeferredOutcomeWire}, operation=null))`, codecNameWire(5, 4),
  ], "constructor arguments absent");
});

test("an authored optional-call token remains distinct from absent optional-call syntax", () => {
  assertSyntaxPayload({ ...header(4, 2), kind: "CallExpression", expression: codecName(5, 4),
    questionDotToken: { ...header(6, 4), kind: "QuestionDotToken", tsonic: null }, typeArguments: null, arguments: nodeList(),
    tsonic: { ...typedValue(), application: codecDeferredOutcome, operation: null } }, [
    `CallExpression(${syntaxHeaderWire(4, 2)}, expression=n:5, questionDotToken=n:6, typeArguments=null, ` +
      `arguments=NodeList(loc=TextRange(pos=0, end=0), nodes=[]), tsonic=TypedApplication(${valueWire}, ` +
      `application=${codecDeferredOutcomeWire}, operation=null))`, codecNameWire(5, 4),
    `QuestionDotToken(${syntaxHeaderWire(6, 4)}, tsonic=null)`,
  ], "optional call");
});

test("deferred typed application and protocol outcomes retain their own generic publication arms", () => {
  assertSyntaxPayload({ ...header(4, 2), kind: "CallExpression", expression: codecName(5, 4), questionDotToken: null,
    typeArguments: null, arguments: nodeList(), tsonic: { ...typedValue(), application: codecDeferredOutcome, operation: null } }, [
    `CallExpression(${syntaxHeaderWire(4, 2)}, expression=n:5, questionDotToken=null, typeArguments=null, ` +
      `arguments=NodeList(loc=TextRange(pos=0, end=0), nodes=[]), tsonic=TypedApplication(${valueWire}, ` +
      `application=${codecDeferredOutcomeWire}, operation=null))`, codecNameWire(5, 4),
  ], "deferred application");
  assertSyntaxPayload({ ...header(4, 2), kind: "AwaitExpression", expression: codecName(5, 4),
    tsonic: { ...typedValue(), protocol: codecDeferredOutcome } }, [
    `AwaitExpression(${syntaxHeaderWire(4, 2)}, expression=n:5, tsonic=TypedProtocolValue(${valueWire}, ` +
      `protocol=${codecDeferredOutcomeWire}))`, codecNameWire(5, 4),
  ], "deferred protocol");
});

for (const [application, applicationWire] of [
  [null, "null"],
  [{ kind: "decided", decision: codecApplicationDecision }, `decided(decision=${codecApplicationDecisionWire})`],
  [codecDeferredOutcome, codecDeferredOutcomeWire],
]) {
  test(`value instantiation retains its complete ${application?.kind ?? "absent"} application`, () => {
    assertSyntaxPayload({ ...header(4, 2), kind: "ExpressionWithTypeArguments", expression: codecName(5, 4), typeArguments: null,
      tsonic: { ...typedValue(), role: "value", bindings: emptyBindings(), application } }, [
      `ExpressionWithTypeArguments(${syntaxHeaderWire(4, 2)}, expression=n:5, typeArguments=null, ` +
        `tsonic=TypedInstantiation(${valueWire}, role="value", bindings=${codecBindingsWire}, application=${applicationWire}))`,
      codecNameWire(5, 4),
    ], "value instantiation");
  });
}

for (const [outcome, outcomeWire] of [
  [{ kind: "decided", decision: codecTypedOperation }, `decided(decision=${codecTypedOperationWire})`],
  [codecDeferredOutcome, codecDeferredOutcomeWire],
]) {
  test(`actual object construction and object-spread retain their ${outcome.kind} phase families`, () => {
    assertSyntaxPayload({ ...header(4, 2), kind: "ObjectLiteralExpression", properties: nodeList(), multiLine: false,
      tsonic: { ...typedValue(), role: "value", construction: outcome } }, [
      `ObjectLiteralExpression(${syntaxHeaderWire(4, 2)}, properties=NodeList(loc=TextRange(pos=0, end=0), nodes=[]), ` +
        `multiLine=false, tsonic=TypedConstruction(${valueWire}, role="value", construction=${outcomeWire}))`,
    ], "object construction");
    assertSyntaxPayload({ ...header(4, 2), kind: "SpreadAssignment", expression: codecName(5, 4), tsonic: { construction: outcome } }, [
      `SpreadAssignment(${syntaxHeaderWire(4, 2)}, expression=n:5, tsonic=TypedObjectSpread(construction=${outcomeWire}))`,
      codecNameWire(5, 4),
    ], "object spread");
  });
}

for (const [application, applicationWire] of [
  [{ kind: "decided", decision: codecTirApplication }, `decided(decision=${codecTirApplicationWire})`],
  [codecDeferredOutcome, codecDeferredOutcomeWire],
]) {
  test(`actual decorator retains the complete ${application.kind} invocation rather than an inferred expression role`, () => {
    assertSyntaxPayload({ ...header(4, 2), kind: "Decorator", expression: codecName(5, 4), tsonic: { application } }, [
      `Decorator(${syntaxHeaderWire(4, 2)}, expression=n:5, tsonic=TypedDecorator(application=${applicationWire}))`, codecNameWire(5, 4),
    ], "decorator");
  });
}

for (const [literal, literalWire] of [
  [{ kind: "number", token: "-0", value: { numerator: 0n, denominator: 1n, negativeZero: true } },
    'number(token="-0", value=ExactRational(numerator=0n, denominator=1n, negativeZero=true))'],
  [{ kind: "bigint", token: "9007199254740993n", value: 9007199254740993n }, 'bigint(token="9007199254740993n", value=9007199254740993n)'],
  [{ kind: "string", value: "literal" }, 'string(value="literal")'],
  [{ kind: "boolean", value: true }, "boolean(value=true)"],
  [{ kind: "absence" }, "absence()"],
  [{ kind: "unique-symbol", declaration: ownerId }, `unique-symbol(declaration=def:"${ownerId}")`],
]) {
  test(`the saved ${literal.kind} literal value preserves its complete original value and token domain`, () => {
    const deferred = { invocation: { rule: "literal-fit", input: { context: codecContext, literal, destination: codecEvidence } }, result: 0 };
    const deferredWire = `DeferredDecision(invocation=DeferredInvocation(rule="literal-fit", input=LiteralFitInput(` +
      `context=${codecContextWire}, literal=${literalWire}, destination=${codecEvidenceWire})), result=t:0)`;
    assertSyntaxPayload({ ...header(4, 2), kind: "PrefixUnaryExpression", operator: "PlusToken", operand: codecName(5, 4),
      tsonic: { ...typedValue(), role: "value", operation: { kind: "deferred", deferred } } }, [
      `PrefixUnaryExpression(${syntaxHeaderWire(4, 2)}, operator="PlusToken", operand=n:5, ` +
        `tsonic=TypedPrefix(${valueWire}, role="value", operation=deferred(deferred=${deferredWire})))`, codecNameWire(5, 4),
    ], literal.kind);
  });
}

const codecProofComponent = { root: codecSource, path: [] };
const codecProof = { steps: [{ from: codecProofComponent, to: codecProofComponent, rule: "identity", premises: [] }], conclusion: 0 };
const codecProofWire = `EmbeddingProof(steps=[CorrespondenceStep(from=TypeComponent(root=${codecSourceWire}, path=[]), ` +
  `to=TypeComponent(root=${codecSourceWire}, path=[]), rule="identity", premises=[])], conclusion=0)`;
// A conversion's embedding is stated once: by the conversion identity of its operation, or beside a core or library operation.
const codecConversionOperation = (embedding, embeddingWire, execution = { kind: "pure" }, executionWire = "pure()") => [
  { decision: { kind: "selected", operation: { kind: "conversion", from: 0, to: 0, embedding }, operands: [0], result: 0, execution }, permissionScope: 4 },
  `TypedOperation(decision=selected(operation=conversion(from=t:0, to=t:0, embedding=${embeddingWire}), operands=[t:0], result=t:0, ` +
    `execution=${executionWire}), permissionScope=n:4)`];
const codecBackedOperation = (kind, execution = { kind: "invocation", writesStorage: false, failure: "unwind" },
  executionWire = 'invocation(writesStorage=false, failure="unwind")') => [
  { decision: { kind: "selected", operation: { kind, declaration: ownerId, bindings: emptyBindings() }, operands: [0], result: 0, execution }, permissionScope: 4 },
  `TypedOperation(decision=selected(operation=${kind}(declaration=def:"${ownerId}", bindings=${codecBindingsWire}), operands=[t:0], result=t:0, ` +
    `execution=${executionWire}), permissionScope=n:4)`];
for (const role of ["initialization", "assignment", "argument", "return", "receiver", "yield", "member-write"]) {
  test(`the actual ${role} conversion retains the complete flow-role record rather than a syntax-token proxy`, () => {
    const [operation, operationWire] = codecConversionOperation({ kind: "identity" }, "identity()");
    const conversion = { kind: "convert", role, operation };
    const phaseWire = `TypedValue(type=t:0, convertedType=t:0, conversion=convert(role="${role}", ` +
      `operation=${operationWire}), narrowing=identity(type=t:0), evidenceIndex=0, demand=always())`;
    assertSyntaxPayload({ ...header(4, 2), kind: "ParenthesizedExpression", expression: codecName(5, 4),
      tsonic: { ...typedValue(), conversion } }, [
      `ParenthesizedExpression(${syntaxHeaderWire(4, 2)}, expression=n:5, tsonic=${phaseWire})`, codecNameWire(5, 4),
    ], role);
    for (const backing of ["core", "library"]) {
      const [backed, backedWire] = codecBackedOperation(backing);
      const backedConversion = { kind: "backed-convert", role, embedding: { kind: "identity" }, operation: backed };
      const backedPhaseWire = `TypedValue(type=t:0, convertedType=t:0, conversion=backed-convert(role="${role}", embedding=identity(), ` +
        `operation=${backedWire}), narrowing=identity(type=t:0), evidenceIndex=0, demand=always())`;
      assertSyntaxPayload({ ...header(4, 2), kind: "ParenthesizedExpression", expression: codecName(5, 4),
        tsonic: { ...typedValue(), conversion: backedConversion } }, [
        `ParenthesizedExpression(${syntaxHeaderWire(4, 2)}, expression=n:5, tsonic=${backedPhaseWire})`, codecNameWire(5, 4),
      ], `${role} backed by ${backing}`);
    }
  });
}
for (const [embedding, embeddingWire] of [
  ...["numeric", "literal-fit", "absence", "union-injection", "shape", "callable", "readonly"].map(conversion => [
    { kind: "conversion", conversion, proof: codecProof, check: { kind: "none" } },
    `conversion(conversion="${conversion}", proof=${codecProofWire}, check=none())`,
  ]),
  ...["unwind", "abort"].map(failure => [
    { kind: "conversion", conversion: "numeric", proof: codecProof, check: { kind: "required", failure } },
    `conversion(conversion="numeric", proof=${codecProofWire}, check=required(failure="${failure}"))`,
  ]),
  ...["incompatible-domain", "lossy-numeric", "missing-correspondence", "passing-mode", "rigid-parameter"].map(reason => [
    { kind: "refused", reason }, `refused(reason="${reason}")`,
  ]),
]) {
  test(`a saved conversion preserves its exact ${embedding.conversion ?? embedding.reason} embedding decision`, () => {
    const [operation, operationWire] = codecConversionOperation(embedding, embeddingWire);
    const conversion = { kind: "convert", role: "return", operation };
    const phaseWire = `TypedValue(type=t:0, convertedType=t:0, conversion=convert(role="return", ` +
      `operation=${operationWire}), narrowing=identity(type=t:0), evidenceIndex=0, demand=always())`;
    assertSyntaxPayload({ ...header(4, 2), kind: "ParenthesizedExpression", expression: codecName(5, 4),
      tsonic: { ...typedValue(), conversion } }, [
      `ParenthesizedExpression(${syntaxHeaderWire(4, 2)}, expression=n:5, tsonic=${phaseWire})`, codecNameWire(5, 4),
    ], embeddingWire);
    const [backed, backedWire] = codecBackedOperation("core");
    const backedPhaseWire = `TypedValue(type=t:0, convertedType=t:0, conversion=backed-convert(role="return", embedding=${embeddingWire}, ` +
      `operation=${backedWire}), narrowing=identity(type=t:0), evidenceIndex=0, demand=always())`;
    assertSyntaxPayload({ ...header(4, 2), kind: "ParenthesizedExpression", expression: codecName(5, 4),
      tsonic: { ...typedValue(), conversion: { kind: "backed-convert", role: "return", embedding, operation: backed } } }, [
      `ParenthesizedExpression(${syntaxHeaderWire(4, 2)}, expression=n:5, tsonic=${backedPhaseWire})`, codecNameWire(5, 4),
    ], `${embeddingWire} beside a core operation`);
  });
}

test("the text of a conversion admits one statement of its embedding and only the operation of its arm", () => {
  const [operation, operationWire] = codecConversionOperation({ kind: "identity" }, "identity()");
  const [backed, backedWire] = codecBackedOperation("library");
  const text = conversionWire => syntaxPayloadCase({ ...header(4, 2), kind: "ParenthesizedExpression", expression: codecName(5, 4),
    tsonic: { ...typedValue(), conversion: { kind: "convert", role: "return", operation } } }, [
    `ParenthesizedExpression(${syntaxHeaderWire(4, 2)}, expression=n:5, tsonic=TypedValue(type=t:0, convertedType=t:0, conversion=${conversionWire}, ` +
      "narrowing=identity(type=t:0), evidenceIndex=0, demand=always()))", codecNameWire(5, 4),
  ]).expected;
  const valid = text(`convert(role="return", operation=${operationWire})`);
  assert.equal(product.parseTir(valid).kind, "parsed");
  // The earlier form: an embedding beside the identity conversion.
  const earlier = text(`convert(role="return", embedding=identity(), operation=${operationWire})`);
  assertInvalidText(earlier, earlier.indexOf("embedding=identity(), operation="), ["operation"], "embedding");
  // A conversion carried out by an operation that is not the conversion identity.
  for (const other of [codecTypedOperationWire, backedWire]) {
    const wrong = text(`convert(role="return", operation=${other})`);
    assertInvalidText(wrong, wrong.indexOf("selected(operation=") + "selected(operation=".length, ["OperationIdentity"], other === backedWire ? "library" : "discard");
  }
  // A backed conversion whose operation is not a core or library operation, and one without its embedding.
  for (const [other, found] of [[operationWire, "conversion"], [codecTypedOperationWire, "discard"]]) {
    const wrong = text(`backed-convert(role="return", embedding=identity(), operation=${other})`);
    assertInvalidText(wrong, wrong.indexOf("selected(operation=") + "selected(operation=".length, ["OperationIdentity"], found);
  }
  const bare = text(`backed-convert(role="return", operation=${backedWire})`);
  assertInvalidText(bare, bare.indexOf("operation=TypedOperation"), ["embedding"], "operation");
  assert.equal(product.parseTir(text(`backed-convert(role="return", embedding=identity(), operation=${backedWire})`)).kind, "parsed");
  assert.equal(backed.decision.operation.kind, "library");
});

test("an actual import-type retains the present attributes arm without guessing its qualifier", () => {
  assertSyntaxPayload({ ...header(4, 2), kind: "ImportType", typeArguments: null, isTypeOf: false, argument: codecType(5, 4),
    attributes: { ...header(6, 4), kind: "ImportAttributes", token: "WithKeyword", attributes: nodeList(), multiLine: true, tsonic: null },
    qualifier: null, tsonic: { type: 0, declarations: [] } }, [
    `ImportType(${syntaxHeaderWire(4, 2)}, typeArguments=null, isTypeOf=false, argument=n:5, attributes=n:6, ` +
      'qualifier=null, tsonic=TypedType(type=t:0, declarations=[]))', codecTypeWire(5, 4),
    `ImportAttributes(${syntaxHeaderWire(6, 4)}, token="WithKeyword", attributes=NodeList(loc=TextRange(pos=0, end=0), nodes=[]), multiLine=true, tsonic=null)`,
  ], "import-type attributes");
});

for (const [rule, input, inputWire] of savedInvocationCases.filter(([rule]) =>
  ["construct-literal", "candidate", "protocol", "library"].includes(rule))) {
  const fields = rule === "construct-literal" ? ["destination"] : rule === "protocol"
    ? ["subject", "completion", "yielded", "sent"] : ["receiver"];
  for (const field of fields) {
    test(`F4 complete saved ${rule} nullable ${field} public codec and actual input`, () => {
      const supplied = { ...input, [field]: null };
      const wire = inputWire.replace(`${field}=${codecEvidenceWire}`, `${field}=null`);
      const phase = { ...typedValue(), role: "value", operation: { kind: "deferred",
        deferred: { invocation: { rule, input: supplied }, result: 0 } } };
      const phaseWire = `TypedPrefix(${valueWire}, role="value", operation=deferred(deferred=DeferredDecision(` +
        `invocation=DeferredInvocation(rule="${rule}", input=${wire}), result=t:0)))`;
      assertSyntaxPayload({ ...header(4, 2), kind: "PrefixUnaryExpression", operator: "PlusToken", operand: codecName(5, 4), tsonic: phase }, [
        `PrefixUnaryExpression(${syntaxHeaderWire(4, 2)}, operator="PlusToken", operand=n:5, tsonic=${phaseWire})`, codecNameWire(5, 4),
      ], `${rule}/${field}/null`);
      const fixture = operationScenario();
      const context = { occurrence: { body: bodyId, node: 2 }, origin: origin(), bindings: emptyBindings() };
      fixture.typed.tsonic.operation = { kind: "deferred", deferred: {
        invocation: { rule, input: { ...supplied, context } }, result: 1 } };
      replaceScopeInventory(fixture.input, Array.from({ length: rule === "candidate" ? 4 : 3 }, emptyScope));
      assertCompleteValue(verifyBody(fixture.input, fixture.body), []);
    });
  }
}

test("F4 a saved candidate's ordinary argument has a genuine null tuple, not a guessed spread", () => {
  const [, input, inputWire] = savedInvocationCases.find(([rule]) => rule === "candidate");
  const supplied = { ...input, arguments: [{ ...input.arguments[0], kind: "value", tuple: null }] };
  const wire = inputWire.replace(`kind="spread", value=${codecEvidenceWire}, tuple=[${codecEvidenceWire}]`,
    `kind="value", value=${codecEvidenceWire}, tuple=null`);
  const phase = { ...typedValue(), role: "value", operation: { kind: "deferred", deferred: {
    invocation: { rule: "candidate", input: supplied }, result: 0 } } };
  const phaseWire = `TypedPrefix(${valueWire}, role="value", operation=deferred(deferred=DeferredDecision(` +
    `invocation=DeferredInvocation(rule="candidate", input=${wire}), result=t:0)))`;
  assertSyntaxPayload({ ...header(4, 2), kind: "PrefixUnaryExpression", operator: "PlusToken", operand: codecName(5, 4), tsonic: phase }, [
    `PrefixUnaryExpression(${syntaxHeaderWire(4, 2)}, operator="PlusToken", operand=n:5, tsonic=${phaseWire})`, codecNameWire(5, 4),
  ], "candidate ordinary null tuple");
  const fixture = operationScenario();
  fixture.typed.tsonic.operation = { kind: "deferred", deferred: { invocation: { rule: "candidate", input: { ...supplied,
    context: { occurrence: { body: bodyId, node: 2 }, origin: origin(), bindings: emptyBindings() } } }, result: 1 } };
  replaceScopeInventory(fixture.input, Array.from({ length: 4 }, emptyScope));
  assertCompleteValue(verifyBody(fixture.input, fixture.body), []);
});

test("F4 ImportKeyword is an actual complete keyword expression, not a meta-property scalar", () => {
  assertSyntaxPayload({ ...header(4, 2), kind: "ImportKeyword", tsonic: { ...typedValue(), role: "value" } }, [
    `ImportKeyword(${syntaxHeaderWire(4, 2)}, tsonic=TypedKeyword(${valueWire}, role="value"))`,
  ], "ImportKeyword value");
});

test("F4 a project import's literal discriminator preserves every actual admissible opposite", () => {
  const { body, expected } = syntaxPayloadCase({ ...header(4, 2), kind: "StringLiteral", text: "module", tokenFlags: [],
    tsonic: { role: "module-specifier", target: { target: "project", module: moduleId } } }, [
    `StringLiteral(${syntaxHeaderWire(4, 2)}, text="module", tokenFlags=[], tsonic=TypedString(role="module-specifier", ` +
      `target=ImportTarget(target="project", module=mod:"${moduleId}")))`,
  ]);
  assertBodyRoundTrip(body, expected, "actual project discriminator");
  const text = expected.replace('target="project"', "target=null");
  assertInvalidText(text, text.indexOf("target=null") + "target=".length, ['"project"', '"library"'], "null");
});

test("F4 deferred conversion retains its own invocation and result codec fields", () => {
  const phase = { ...typedValue(), conversion: { kind: "deferred", deferred: codecDeferred } };
  const phaseWire = valueWire.replace("conversion=identity()", `conversion=deferred(deferred=${codecDeferredWire})`);
  assertSyntaxPayload({ ...header(4, 2), kind: "ParenthesizedExpression", expression: codecName(5, 4), tsonic: phase }, [
    `ParenthesizedExpression(${syntaxHeaderWire(4, 2)}, expression=n:5, tsonic=TypedValue(${phaseWire}))`, codecNameWire(5, 4),
  ], "actual deferred conversion");
});

for (const [kind, fields, fieldsWire, phase, phaseWire, marker, expectedType] of [
  ["BigIntLiteral", { text: "1n", tokenFlags: [] }, 'text="1n", tokenFlags=[]',
    { ...typedValue(), role: "value", value: 1n }, `TypedBigInt(${valueWire}, role="value", value=1n)`, "value=1n", "bigint"],
  ["JsxText", { text: "text", tokenFlags: [], containsOnlyTriviaWhiteSpaces: false },
    'text="text", tokenFlags=[], containsOnlyTriviaWhiteSpaces=false', null, "null", "containsOnlyTriviaWhiteSpaces=false", "boolean"],
]) {
  test(`F4 actual ${expectedType} selector rejects null inside its complete public family`, () => {
    const payload = { ...header(4, 2), kind, ...fields, tsonic: phase };
    const { body, expected } = syntaxPayloadCase(payload, [
      `${kind}(${syntaxHeaderWire(4, 2)}, ${fieldsWire}, tsonic=${phaseWire})`,
    ]);
    assertBodyRoundTrip(body, expected, `actual ${expectedType} positive`);
    const field = marker.slice(0, marker.indexOf("=") + 1);
    const text = expected.replace(marker, field + "null");
    const offset = text.indexOf(field + "null") + field.length;
    assertInvalidText(text, offset, [expectedType], "null");
  });
}

test("F4 actual dynamic PragmaArguments has its own wrong-label result", () => {
  const body = emptyModuleBody();
  body.root.pragmas = [{ pos: 0, end: 0, kind: "SingleLineCommentTrivia", hasTrailingNewLine: false,
    name: "reference", args: [] }];
  const expected = readFileSync(resolve(repository, functionDirectory, "empty-module.input.tir"), "utf8")
    .replace("pragmas=[]", 'pragmas=[Pragma(pos=0, end=0, kind="SingleLineCommentTrivia", hasTrailingNewLine=false, name="reference", args=PragmaArguments())]');
  assertBodyRoundTrip(body, expected, "actual empty pragma dictionary");
  const text = expected.replace("PragmaArguments()", "OtherArguments()");
  assertInvalidText(text, text.indexOf("OtherArguments"), ["PragmaArguments"], "OtherArguments");
});

for (const count of [0, 1, 2]) {
  for (const multiLine of [false, true]) {
    for (const role of ["value", "assignment-pattern"]) {
      test(`F4 complete ArrayLiteral ${role}/${count}/multiLine=${multiLine}`, () => {
        const elements = Array.from({ length: count }, (_, position) => codecName(position + 5, 4));
        const phase = role === "value" ? { ...typedValue(), role, construction: { kind: "decided", decision: codecTypedOperation } }
          : { role, storage: 0, parts: [codecPart] };
        const phaseWire = role === "value" ? `TypedConstruction(${valueWire}, role="value", construction=decided(decision=${codecTypedOperationWire}))`
          : `TypedConstruction(role="assignment-pattern", storage=t:0, parts=[${codecPartWire}])`;
        assertSyntaxPayload({ ...header(4, 2), kind: "ArrayLiteralExpression", elements: nodeList(elements), multiLine, tsonic: phase }, [
          `ArrayLiteralExpression(${syntaxHeaderWire(4, 2)}, elements=NodeList(loc=TextRange(pos=0, end=0), ` +
            `nodes=[${elements.map(node => `n:${node.id}`).join(", ")}]), multiLine=${multiLine}, tsonic=${phaseWire})`,
          ...elements.map(node => codecNameWire(node.id, 4)),
        ], `array/${role}/${count}/${multiLine}`);
      });
    }
  }
}

test("a typed closure carries its decision: every capture mode, a creation that can fail, and the deferred closure rule with its input", () => {
  const arrow = closure => ({ ...header(4, 2), kind: "ArrowFunction", modifiers: null, typeParameters: null, parameters: nodeList(), type: null,
    fullSignature: null, asteriskToken: null, body: codecBlock(5, 4),
    equalsGreaterThanToken: { ...header(6, 4), kind: "EqualsGreaterThanToken", tsonic: null },
    tsonic: { ...typedValue(), callable: codecCallable, closure } });
  const arrowWire = closureWire => [
    `ArrowFunction(${syntaxHeaderWire(4, 2)}, modifiers=null, typeParameters=null, parameters=NodeList(loc=TextRange(pos=0, end=0), nodes=[]), ` +
      'type=null, fullSignature=null, asteriskToken=null, body=n:5, equalsGreaterThanToken=n:6, ' +
      `tsonic=TypedClosure(${valueWire}, callable=${codecCallableWire}, closure=${closureWire}))`,
    codecBlockWire(5, 4), `EqualsGreaterThanToken(${syntaxHeaderWire(6, 4)}, tsonic=null)`];
  const local0 = { body: bodyId, local: 0 };
  const local1 = { body: bodyId, local: 1 };
  assertSyntaxPayload(arrow({ kind: "decided", decision: { carrier: 0, captures: [{ local: local0, capture: "captured-value" }, { local: local1, capture: "captured-location" }],
    execution: { kind: "invocation", writesStorage: false, failure: "unwind" } } }),
  arrowWire(`decided(decision=ClosureDecision(carrier=t:0, captures=[${captureRowWire(local0, "captured-value")}, ${captureRowWire(local1, "captured-location")}], ` +
    'execution=invocation(writesStorage=false, failure="unwind")))'),
  "decided closure");
  const sources = [
    [{ kind: "binding" }, "binding()"],
    ...["by-value", "byref-readonly", "byref-readwrite", "byref-writeonly-must-init", "borrow-shared", "borrow-mut", "move"]
      .map(passing => [{ kind: "parameter", passing }, `parameter(passing="${passing}")`]),
    [{ kind: "capture", capture: "captured-value" }, 'capture(capture="captured-value")'],
    [{ kind: "capture", capture: "captured-location" }, 'capture(capture="captured-location")'],
  ];
  const savedCapture = ([incoming], position) => ({ local: { body: bodyId, local: position }, value: codecEvidence, reassignable: position % 2 === 0, incoming });
  const savedCaptureWire = ([, incomingWire], position) => `ClosureCaptureEvidence(local=LocalRef(body=body:"${bodyId}", local=l:${position}), ` +
    `value=${codecEvidenceWire}, reassignable=${position % 2 === 0}, incoming=${incomingWire})`;
  const deferredText = arrowWire(`deferred(deferred=DeferredDecision(invocation=DeferredInvocation(rule="closure", input=ClosureInput(context=${codecContextWire}, ` +
    `callable=${codecEvidenceWire}, captures=[${sources.map(savedCaptureWire).join(", ")}])), result=t:0))`);
  assertSyntaxPayload(arrow({ kind: "deferred", deferred: { invocation: { rule: "closure", input: { context: codecContext,
    callable: codecEvidence, captures: sources.map(savedCapture) } }, result: 0 } }), deferredText, "deferred closure with every incoming storage");
  // The earlier forms: a typed closure with its own list of captured locals, a decision of bare logical captures, a saved
  // evidence without its incoming storage, a resolved callee with a list of its own.
  const decided = syntaxPayloadCase(arrow(closureDecisionOf(0, [local0], "captured-value")),
    arrowWire(closureDecisionWire([local0], "captured-value"))).expected;
  const listAt = decided.indexOf(", closure=decided(");
  const withList = `${decided.slice(0, listAt)}, captures=[${localWire}]${decided.slice(listAt)}`;
  // the field name is read against the expected one character by character: the fault is at the first that differs
  assertInvalidText(withList, withList.indexOf(`captures=[${localWire}]`) + 1, ["closure"], "captures");
  const bare = decided.replace(captureRowWire(local0, "captured-value"), '"captured-value"');
  assertInvalidText(bare, bare.indexOf('captures=["captured-value"]') + 'captures=['.length, ["CaptureRow"], '"');
  const withoutIncoming = syntaxPayloadCase(arrow({ kind: "deferred", deferred: { invocation: { rule: "closure",
    input: { context: codecContext, callable: codecEvidence, captures: [savedCapture(sources[0], 0)] } }, result: 0 } }),
  arrowWire(`deferred(deferred=DeferredDecision(invocation=DeferredInvocation(rule="closure", input=ClosureInput(context=${codecContextWire}, ` +
    `callable=${codecEvidenceWire}, captures=[${savedCaptureWire(sources[0], 0)}])), result=t:0))`)).expected;
  const incomingAt = withoutIncoming.indexOf(", incoming=binding()");
  assertInvalidText(withoutIncoming.replace(", incoming=binding()", ""), incomingAt, ["incoming"], ")");
});

for (const asterisk of [false, true]) {
  test(`F4 complete ArrowFunction type parameters and asterisk=${asterisk}`, () => {
    const bodyId = asterisk ? 11 : 10;
    const arrowId = bodyId + 1;
    assertSyntaxPayload({ ...header(4, 2), kind: "ArrowFunction", modifiers: null,
      typeParameters: nodeList([codecTypeParameter(5, 4)]), parameters: nodeList(), type: null, fullSignature: null,
      asteriskToken: asterisk ? { ...header(10, 4), kind: "AsteriskToken", tsonic: null } : null,
      body: codecBlock(bodyId, 4), equalsGreaterThanToken: { ...header(arrowId, 4), kind: "EqualsGreaterThanToken", tsonic: null },
      tsonic: { ...typedValue(), callable: codecCallable, closure: closureDecisionOf(0, []) } }, [
      `ArrowFunction(${syntaxHeaderWire(4, 2)}, modifiers=null, typeParameters=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:5]), ` +
        `parameters=NodeList(loc=TextRange(pos=0, end=0), nodes=[]), type=null, fullSignature=null, asteriskToken=${asterisk ? "n:10" : "null"}, ` +
        `body=n:${bodyId}, equalsGreaterThanToken=n:${arrowId}, tsonic=TypedClosure(${valueWire}, callable=${codecCallableWire}, closure=${closureDecisionWire([])}))`,
      ...codecTypeParameterDefinitions(5, 4), ...(asterisk ? [`AsteriskToken(${syntaxHeaderWire(10, 4)}, tsonic=null)`] : []),
      codecBlockWire(bodyId, 4), `EqualsGreaterThanToken(${syntaxHeaderWire(arrowId, 4)}, tsonic=null)`,
    ], `arrow/${asterisk}`);
  });
}

for (const present of [false, true]) {
  for (const asterisk of [false, true]) {
    test(`F4 complete Yield expression=${present}/asterisk=${asterisk}`, () => {
      const expressionId = asterisk ? 6 : 5;
      const phase = { ...typedValue(), protocol: { kind: "decided", decision: codecProtocol } };
      assertSyntaxPayload({ ...header(4, 2), kind: "YieldExpression",
        asteriskToken: asterisk ? { ...header(5, 4), kind: "AsteriskToken", tsonic: null } : null,
        expression: present ? codecName(expressionId, 4) : null, tsonic: phase }, [
        `YieldExpression(${syntaxHeaderWire(4, 2)}, asteriskToken=${asterisk ? "n:5" : "null"}, ` +
          `expression=${present ? `n:${expressionId}` : "null"}, tsonic=TypedProtocolValue(${valueWire}, protocol=decided(decision=${codecProtocolWire})))`,
        ...(asterisk ? [`AsteriskToken(${syntaxHeaderWire(5, 4)}, tsonic=null)`] : []),
        ...(present ? [codecNameWire(expressionId, 4)] : []),
      ], `yield/${present}/${asterisk}`);
    });
  }
}

for (const kind of ["CallExpression", "NewExpression"]) {
  for (const count of [0, 1, 2]) {
    test(`F4 complete ${kind} with actual typeArguments count=${count}`, () => {
      const arguments_ = Array.from({ length: count }, (_, position) => codecType(position + 6, 4));
      const phase = { ...typedValue(), application: { kind: "decided", decision: codecTirApplication }, operation: null };
      assertSyntaxPayload({ ...header(4, 2), kind, expression: codecName(5, 4),
        ...(kind === "CallExpression" ? { questionDotToken: null } : {}), typeArguments: nodeList(arguments_),
        arguments: nodeList(), tsonic: phase }, [
        `${kind}(${syntaxHeaderWire(4, 2)}, expression=n:5, ${kind === "CallExpression" ? "questionDotToken=null, " : ""}` +
          `typeArguments=NodeList(loc=TextRange(pos=0, end=0), nodes=[${arguments_.map(node => `n:${node.id}`).join(", ")}]), ` +
          `arguments=NodeList(loc=TextRange(pos=0, end=0), nodes=[]), tsonic=TypedApplication(${valueWire}, ` +
          `application=decided(decision=${codecTirApplicationWire}), operation=null))`,
        codecNameWire(5, 4), ...arguments_.map(node => codecTypeWire(node.id, 4)),
      ], `${kind}/typeArguments/${count}`);
    });
  }
}

for (const tokenFlags of [["SingleQuote"], ["UnicodeEscape", "SingleQuote"], ["SingleQuote", "UnicodeEscape"]]) {
  test(`F4 genuine JSX text complete token flags ${tokenFlags.join("/")}`, () => {
    assertSyntaxPayload({ ...header(4, 2), kind: "JsxText", text: "text", tokenFlags,
      containsOnlyTriviaWhiteSpaces: false, tsonic: null }, [
      `JsxText(${syntaxHeaderWire(4, 2)}, text="text", tokenFlags=[${tokenFlags.map(flag => JSON.stringify(flag)).join(", ")}], ` +
        "containsOnlyTriviaWhiteSpaces=false, tsonic=null)",
    ], "JSX text flags");
  });
}

test("F4 complete shorthand-name narrowing and evidence have their own codec callbacks", () => {
  assertSyntaxPayload({ ...header(4, 2), kind: "Identifier", text: "field",
    tsonic: { ...typedValue(), role: "shorthand-value", key: codecKey,
      resolution: { kind: "definition", definition: ownerId, aliases: [] } } }, [
    `Identifier(${syntaxHeaderWire(4, 2)}, text="field", tsonic=TypedName(${valueWire}, role="shorthand-value", key=${codecKeyWire}, ` +
      `resolution=definition(definition=def:"${ownerId}", aliases=[])))`,
  ], "full shorthand name");
});

for (const [role, token] of [["arithmetic", "PlusToken"], ["comparison", "EqualsEqualsEqualsToken"],
  ["assignment", "PlusEqualsToken"], ["sequence", "CommaToken"]]) {
  for (const mode of ["decided", "deferred", "absent"]) {
    if (role === "sequence" && mode !== "decided" || (role === "arithmetic" || role === "comparison") && mode === "absent") continue;
    test(`F4 complete Binary ${role} calculation ${mode}`, () => {
      const deferred = mode === "deferred";
      const outcome = deferred ? codecDeferredOutcome : { kind: "decided", decision: codecTypedOperation };
      const outcomeWire = deferred ? codecDeferredOutcomeWire : `decided(decision=${codecTypedOperationWire})`;
      const selection = { kind: "or", control: 5, right: 7, disposition: "dynamic" };
      const phase = { ...typedValue(), role,
        ...(role === "arithmetic" || role === "comparison" ? { operation: outcome } :
          role === "assignment" ? { storage: 0, calculation: mode === "absent" ? null : outcome,
            selection: mode === "absent" ? null : selection } : {}) };
      const phaseWire = `TypedBinary(${valueWire}, role="${role}"` +
        (role === "arithmetic" || role === "comparison" ? `, operation=${outcomeWire}` : role === "assignment"
          ? `, storage=t:0, calculation=${mode === "absent" ? "null" : outcomeWire}, selection=${mode === "absent" ? "null" : 'or(control=n:5, right=n:7, disposition="dynamic")'}` : "") + ")";
      assertSyntaxPayload({ ...header(4, 2), kind: "BinaryExpression", modifiers: null, left: codecName(5, 4), type: null,
        operatorToken: { ...header(6, 4), kind: token, tsonic: null }, right: codecName(7, 4), tsonic: phase }, [
        `BinaryExpression(${syntaxHeaderWire(4, 2)}, modifiers=null, left=n:5, type=null, operatorToken=n:6, right=n:7, tsonic=${phaseWire})`,
        codecNameWire(5, 4), `${token}(${syntaxHeaderWire(6, 4)}, tsonic=null)`, codecNameWire(7, 4),
      ], `${role}/${deferred}`);
    });
  }
}

for (const disposition of ["true", "false", "dynamic"]) {
  test(`F4 complete Conditional ${disposition} carries each selected or never demand`, () => {
    const selected = when => disposition === "dynamic" || disposition === when ? { kind: "selected", control: 5, when }
      : { kind: "never", control: 5 };
    const demandWire = when => disposition === "dynamic" || disposition === when ? `selected(control=n:5, when="${when}")` : "never(control=n:5)";
    const branch = (identity, when) => ({ ...codecName(identity, 4), tsonic: { ...codecName(identity, 4).tsonic, demand: selected(when) } });
    const branchWire = (identity, when) => codecNameWire(identity, 4).replace("demand=always()", `demand=${demandWire(when)}`);
    const phase = { ...typedValue(), selection: { kind: "conditional", control: 5, whenTrue: 7, whenFalse: 9, disposition } };
    assertSyntaxPayload({ ...header(4, 2), kind: "ConditionalExpression", condition: codecName(5, 4),
      questionToken: { ...header(6, 4), kind: "QuestionToken", tsonic: null }, whenTrue: branch(7, "true"),
      colonToken: { ...header(8, 4), kind: "ColonToken", tsonic: null }, whenFalse: branch(9, "false"), tsonic: phase }, [
      `ConditionalExpression(${syntaxHeaderWire(4, 2)}, condition=n:5, questionToken=n:6, whenTrue=n:7, colonToken=n:8, ` +
        `whenFalse=n:9, tsonic=TypedConditional(${valueWire}, selection=conditional(control=n:5, whenTrue=n:7, whenFalse=n:9, disposition="${disposition}")))`,
      codecNameWire(5, 4), `QuestionToken(${syntaxHeaderWire(6, 4)}, tsonic=null)`, branchWire(7, "true"),
      `ColonToken(${syntaxHeaderWire(8, 4)}, tsonic=null)`, branchWire(9, "false"),
    ], `conditional/${disposition}`);
  });
}

for (const kind of ["PropertyAccessExpression", "ElementAccessExpression"]) {
  for (const mode of ["plain", "accessors", "deferred"]) {
    test(`F4 complete ${kind} value selection ${mode}`, () => {
      const selection = { decision: codecMemberDecision, getter: mode === "accessors" ? codecCallee : null,
        setter: mode === "accessors" ? codecCallee : null };
      const [, memberInput, memberInputWire] = savedInvocationCases.find(([rule]) => rule === "member");
      const outcome = mode === "deferred" ? { kind: "deferred", deferred: { invocation: { rule: "member", input: memberInput }, result: 0 } }
        : { kind: "decided", decision: selection };
      const selectionWire = mode === "deferred" ? `deferred(deferred=DeferredDecision(invocation=DeferredInvocation(rule="member", input=${memberInputWire}), result=t:0))`
        : `decided(decision=MemberSelection(decision=${codecMemberDecisionWire}, getter=${mode === "accessors" ? codecCalleeWire : "null"}, ` +
          `setter=${mode === "accessors" ? codecCalleeWire : "null"}))`;
      const field = kind === "PropertyAccessExpression" ? "name" : "argumentExpression";
      assertSyntaxPayload({ ...header(4, 2), kind, expression: codecName(5, 4), questionDotToken: null,
        [field]: codecName(6, 4), tsonic: { ...typedValue(), role: "value", selection: outcome } }, [
        `${kind}(${syntaxHeaderWire(4, 2)}, expression=n:5, questionDotToken=null, ${field}=n:6, ` +
          `tsonic=TypedMember(${valueWire}, role="value", selection=${selectionWire}))`, codecNameWire(5, 4), codecNameWire(6, 4),
      ], `${kind}/${mode}`);
    });
  }
}

test("F4 body capture and lexical scope records retain complete foreign identities and declaration order", () => {
  const body = emptyModuleBody();
  const foreignBody = "B[D[M[P[p];m];outer];function;0]";
  body.captures = [{ local: { body: foreignBody, local: 0 }, capture: "captured-location" }, { local: { body: foreignBody, local: 1 }, capture: "captured-value" }];
  body.scopes = [{ node: 0, parent: null, attributes: [codecAttribute] }, { node: 1, parent: 0, attributes: [codecAttribute, codecAttribute] }];
  const expected = readFileSync(resolve(repository, functionDirectory, "empty-module.input.tir"), "utf8")
    .replace("captures=[], scopes=[]", `captures=[${captureRowWire({ body: foreignBody, local: 0 }, "captured-location")}, ` +
      `${captureRowWire({ body: foreignBody, local: 1 }, "captured-value")}], scopes=[HirLexicalScope(node=n:0, parent=null, attributes=[${codecAttributeWire}]), ` +
      `HirLexicalScope(node=n:1, parent=n:0, attributes=[${codecAttributeWire}, ${codecAttributeWire}])]`);
  assertBodyRoundTrip(body, expected, "complete captures and scopes");
});

test("F4 a complete export retains its present ImportAttributes syntax", () => {
  assertSyntaxPayload({ ...header(4, 2), kind: "ExportDeclaration", modifiers: null, isTypeOnly: false,
    exportClause: null, moduleSpecifier: null, attributes: { ...header(5, 4), kind: "ImportAttributes", token: "WithKeyword",
      attributes: nodeList(), multiLine: false, tsonic: null }, tsonic: { target: null } }, [
    `ExportDeclaration(${syntaxHeaderWire(4, 2)}, modifiers=null, isTypeOnly=false, exportClause=null, moduleSpecifier=null, ` +
      `attributes=n:5, tsonic=TypedExport(target=null))`,
    `ImportAttributes(${syntaxHeaderWire(5, 4)}, token="WithKeyword", attributes=NodeList(loc=TextRange(pos=0, end=0), nodes=[]), multiLine=false, tsonic=null)`,
  ], "export attributes");
});

for (const count of [0, 1]) {
  test(`F4 complete IndexSignature actual type parameter count=${count}`, () => {
    const type = count === 0 ? 5 : 10;
    assertSyntaxPayload({ ...header(4, 2), kind: "IndexSignature", modifiers: null,
      typeParameters: nodeList(count === 0 ? [] : [codecTypeParameter(5, 4)]), parameters: nodeList(),
      type: codecType(type, 4), fullSignature: null, tsonic: { definition: ownerId, key: 0, read: 0, write: null } }, [
      `IndexSignature(${syntaxHeaderWire(4, 2)}, modifiers=null, typeParameters=NodeList(loc=TextRange(pos=0, end=0), ` +
        `nodes=[${count === 0 ? "" : "n:5"}]), parameters=NodeList(loc=TextRange(pos=0, end=0), nodes=[]), ` +
        `type=n:${type}, fullSignature=null, tsonic=TypedIndexDeclaration(definition=def:"${ownerId}", key=t:0, read=t:0, write=null))`,
      ...(count === 0 ? [] : codecTypeParameterDefinitions(5, 4)), codecTypeWire(type, 4),
    ], `IndexSignature/${count}`);
  });
}

for (const kind of ["DeleteExpression", "TypeOfExpression", "VoidExpression"]) {
  test(`actual ${kind} maps to the complete TypedUnary record, not a prefix role`, () => {
    const operation = { permissionScope: null, decision: { kind: "selected", operation: { kind: "discard" }, operands: [0], result: 0, execution: { kind: "pure" } } };
    assertSyntaxPayload({ ...header(4, 2), kind, expression: codecName(5, 4),
      tsonic: { ...typedValue(), operation: { kind: "decided", decision: operation } } }, [
      `${kind}(${syntaxHeaderWire(4, 2)}, expression=n:5, tsonic=TypedUnary(${valueWire}, operation=decided(decision=TypedOperation(` +
        'decision=selected(operation=discard(), operands=[t:0], result=t:0, execution=pure()), permissionScope=null))))',
      codecNameWire(5, 4),
    ], kind);
  });
}
}

test("the complete independently authored empty module prints exactly once in declaration order", () => {
  const expected = readFileSync(resolve(repository, functionDirectory, "empty-module.input.tir"), "utf8");
  const body = emptyModuleBody();
  assertCompleteValue(product.printTir(body), expected, "complete independently authored module wire", Object.is);
  const parsed = product.parseTir(expected);
  assert.equal(parsed.kind, "parsed");
  assertCompleteValue(parsed.value, JSON.parse(readFileSync(
    resolve(repository, functionDirectory, "empty-module.expected.json"), "utf8")).value.value,
  "complete expected fields are compared independently, not derived from actual print output", isDeepStrictEqual);
  assert.equal(parsed.value.root.endOfFileToken.parent, 0);
});

test("actual source/publication/table/scopes yield the complete valid verifier vector", () => {
  const body = emptyModuleBody();
  assertCompleteValue(verifyBody(emptyVerificationInput(body), body), []);
});

test("source preservation distinguishes an unlabelled switch break from its enclosing loop continue", async () => {
  const { verifySourcePreservation } = await import("../../packages/host/dist/ir-tir/verify.js");
  const body = emptyModuleBody();
  const target = node => ({ body: body.body, node });
  const transfer = (id, kind, node) => ({ ...header(id, 7), kind, label: null, tsonic: { target: target(node) } });
  const stop = transfer(8, "BreakStatement", 4);
  const next = transfer(9, "ContinueStatement", 1);
  const branch = { ...header(7, 6), kind: "DefaultClause", expression: null, statements: nodeList([stop, next]), tsonic: null };
  const choice = { ...header(4, 3), kind: "SwitchStatement", expression: { ...header(5, 4), kind: "TrueKeyword", tsonic: typedValue() },
    caseBlock: { ...header(6, 4), kind: "CaseBlock", clauses: nodeList([branch]), tsonic: null }, tsonic: null };
  const loop = { ...header(1, 0), kind: "WhileStatement", expression: { ...header(2, 1), kind: "TrueKeyword", tsonic: typedValue() },
    statement: { ...header(3, 1), kind: "Block", statements: nodeList([choice]), multiLine: false, tsonic: null }, tsonic: null };
  body.root.statements = nodeList([readyStatement(loop)]);
  body.root.endOfFileToken = { ...header(10, 0), kind: "EndOfFile", tsonic: null };
  const { source, module } = emptyVerificationInput(body);
  source.tree.statements = { ...body.root.statements, nodes: structuredClone(body.root.statements.nodes.map(slot => slot.node)) };
  source.tree.endOfFileToken = { ...body.root.endOfFileToken };
  const authored = source.tree.statements.nodes[0];
  authored.expression.tsonic = { core: emptyCore(), role: "value", value: checkedValue(0) };
  const authoredSwitch = authored.statement.statements.nodes[0];
  authoredSwitch.expression.tsonic = { core: emptyCore(), role: "value", value: checkedValue(0) };
  for (const control of authoredSwitch.caseBlock.clauses.nodes[0].statements.nodes) control.tsonic = null;
  const boundary = { original: source.bodies[0], nestedRoots: new Set(), headers: [] };
  const verify = () => {
    const findings = [];
    verifySourcePreservation(body, source, module, boundary, (rule, node) => findings.push([rule, node?.id]));
    return findings;
  };
  assert.deepEqual(verify(), []);
  stop.tsonic = { target: target(loop.id) };
  next.tsonic = { target: target(choice.id) };
  assert.deepEqual(verify(), [["node-reference", stop.id], ["node-reference", next.id]]);
});

test("source preservation checks a labelled break against the actual checked label occurrence", async () => {
  const { verifySourcePreservation } = await import("../../packages/host/dist/ir-tir/verify.js");
  const body = emptyModuleBody();
  const target = node => ({ body: body.body, node });
  const name = (id, parent, text, declaration) =>
    ({ ...header(id, parent), kind: "Identifier", text, tsonic: { role: "label", target: target(declaration) } });
  const stop = { ...header(7, 6), kind: "BreakStatement", label: name(8, 7, "outer", 1), tsonic: { target: target(1) } };
  const inner = { ...header(4, 3), kind: "LabeledStatement", label: name(5, 4, "inner", 4), tsonic: { target: target(4) },
    statement: { ...header(6, 4), kind: "Block", statements: nodeList([stop]), multiLine: false, tsonic: null } };
  const outer = { ...header(1, 0), kind: "LabeledStatement", label: name(2, 1, "outer", 1), tsonic: { target: target(1) },
    statement: { ...header(3, 1), kind: "Block", statements: nodeList([inner]), multiLine: false, tsonic: null } };
  body.root.statements = nodeList([readyStatement(outer)]);
  body.root.endOfFileToken = { ...header(9, 0), kind: "EndOfFile", tsonic: null };
  const { source, module } = emptyVerificationInput(body);
  source.tree.statements = { ...body.root.statements, nodes: structuredClone(body.root.statements.nodes.map(slot => slot.node)) };
  source.tree.endOfFileToken = { ...body.root.endOfFileToken };
  const checkedOuter = source.tree.statements.nodes[0];
  const checkedInner = checkedOuter.statement.statements.nodes[0];
  const checkedStop = checkedInner.statement.statements.nodes[0];
  for (const node of [checkedOuter, checkedInner, checkedStop]) {
    node.label.tsonic = { core: emptyCore(), ...node.label.tsonic };
    node.tsonic = null;
  }
  const verify = () => {
    const findings = [];
    verifySourcePreservation(body, source, module, { original: source.bodies[0], nestedRoots: new Set(), headers: [] },
      (rule, node) => findings.push([rule, node?.id]));
    return findings;
  };
  assert.deepEqual(verify(), []);
  const expected = stop.tsonic.target;
  for (const crossed of [target(inner.id), { ...expected, body: "crossed" }]) {
    stop.tsonic.target = crossed;
    stop.label.tsonic.target = crossed;
    assert.deepEqual(verify(), [["node-reference", stop.id]]);
  }
  stop.tsonic.target = expected;
  stop.label.tsonic.target = expected;
  checkedStop.label.tsonic.target = null;
  assert.deepEqual(verify(), [["node-reference", stop.id]]);
  checkedStop.label.tsonic.target = expected;
  assert.deepEqual(verify(), []);
});

for (const includeHole of [false, true]) {
  test(`the actual generic tuple-pattern parameter preserves its real whole-argument and named local slots: hole=${includeHole}`, () => {
    const fixture = bindingPatternScenario(includeHole);
    assertCompleteValue(verifyBody(fixture.input, fixture.body), []);
  });
}

test("a named element cannot discard its real binding phase in favour of the hole arm", () => {
  const fixture = bindingPatternScenario(false);
  const actual = fixture.binding.tsonic;
  fixture.binding.tsonic = { role: "hole" };
  assertCompleteValue(verifyBody(fixture.input, fixture.body), [nodeViolation("binding-element-role-exact", 7,
    "binding element role is hole exactly when its authored name is absent")]);
  fixture.binding.tsonic = actual;
  assertCompleteValue(verifyBody(fixture.input, fixture.body), []);
});

test("a hole cannot claim the adjacent genuine named element's binding record", () => {
  const fixture = bindingPatternScenario(true);
  fixture.hole.tsonic = fixture.binding.tsonic;
  assertCompleteValue(verifyBody(fixture.input, fixture.body), [nodeViolation("binding-element-role-exact", 7,
    "binding element role is hole exactly when its authored name is absent")]);
  fixture.hole.tsonic = { role: "hole" };
  assertCompleteValue(verifyBody(fixture.input, fixture.body), []);
});

test("a bodyless type-only module verifies its real tree without constructing a body", () => {
  const fixture = typeAliasModuleScenario();
  assertCompleteValue(verifyChapter(fixture.input, fixture.module), []);
  assertCompleteValue(fixture.queries, [{ kind: "module", module: moduleId }]);
});

for (const changed of ["publication-module", "source-module", "publication-tree"]) {
  test(`module identity independently rejects a different actual ${changed}`, async () => {
    const { encodeModuleId, encodePackageId } = await import("../../packages/host/dist/ids/index.js");
    const fixture = typeAliasModuleScenario();
    const otherModule = encodeModuleId({ package: encodePackageId("other"), path: "other" });
    const input = { ...fixture.input,
      module: changed === "publication-module" ? { ...fixture.module, module: otherModule }
        : changed === "publication-tree" ? { ...fixture.module, tree: structuredClone(fixture.module.tree) } : fixture.module,
      source: changed === "source-module" ? { ...fixture.input.source, module: otherModule } : fixture.input.source };
    assertCompleteValue(verifyChapter(input, fixture.module), [nodeViolation("module-node-identity", 0,
      "module tree does not retain its actual source and publication identity")]);
    assert.equal(fixture.module.module, moduleId);
    assert.equal(fixture.input.module === fixture.module, true);
    assertCompleteValue(verifyChapter(fixture.input, fixture.module), []);
  });
}

test("ready module scalar parent references resolve in the actual source arena", () => {
  const fixture = typeAliasModuleScenario(true);
  fixture.body.root.parent = 99;
  assertCompleteValue(verifyBody(fixture.input, fixture.body), [
    nodeViolation("parent-reference", 0, "typed node parent differs from the real authored parent"),
    nodeViolation("node-reference", 0, "node identity does not name an actual node in its module arena"),
  ]);
  fixture.body.root.parent = null;
  assertCompleteValue(verifyBody(fixture.input, fixture.body), []);
});

test("the closed typed source-file parser rejects an undeclared checker field", () => {
  const original = readFileSync(resolve(repository, functionDirectory, "empty-module.input.tir"), "utf8");
  const marker = 'dependence="parametric")))';
  const position = original.indexOf(marker) + 'dependence="parametric")'.length;
  assert.equal(position >= marker.length, true);
  const text = original.slice(0, position) + ", checker=null" + original.slice(position);
  assertInvalidText(text, position + 2, ["end of record"], "checker");
  assertBodyRoundTrip(emptyModuleBody(), original, "closed source-file phase keeps every declared field");
});

test("closed typed source-file fields reject arbitrary UTF16 names in either text order", () => {
  const original = readFileSync(resolve(repository, functionDirectory, "empty-module.input.tir"), "utf8");
  const marker = 'dependence="parametric")))';
  const position = original.indexOf(marker) + 'dependence="parametric")'.length;
  for (const names of [["\ue000", "\u{10000}", "aaa"], ["aaa", "\u{10000}", "\ue000"]]) {
    const text = original.slice(0, position) + names.map(name => `, ${JSON.stringify(name)}=null`).join("") + original.slice(position);
    assertInvalidText(text, position + 3, ["end of record"], names[0]);
  }
});

test("module repeated missing declarations share the actual nullable cache and singleton diagnostic", async () => {
  const { encodeDefId } = await import("../../packages/host/dist/ids/index.js");
  const fixture = typeAliasModuleScenario(true);
  const missing = encodeDefId({ module: moduleId, segments: [{ name: "missing", ordinal: 0 }] });
  const actual = fixture.input.declarationOf;
  const queries = [];
  fixture.input.declarationOf = definition => { queries.push(definition); return actual(definition); };
  fixture.keyword.tsonic.declarations = [missing, missing];
  assertCompleteValue(verifyBody(fixture.input, fixture.body), [nodeViolation("cross-owner-qualified", 3,
    "definition reference does not name an actual declaration")]);
  assertCompleteValue(queries, [ownerId, fixture.definition, missing]);
  queries.length = 0;
  fixture.keyword.tsonic.declarations = [fixture.definition, fixture.definition];
  assertCompleteValue(verifyBody(fixture.input, fixture.body), []);
  assertCompleteValue(queries, [ownerId, fixture.definition]);
  queries.length = 0;
  fixture.keyword.tsonic.declarations = [];
  assertCompleteValue(verifyBody(fixture.input, fixture.body), []);
  assertCompleteValue(queries, [ownerId, fixture.definition]);
});

test("the ready module's body verifier owns its invalid type payload", () => {
  const fixture = typeAliasModuleScenario(true);
  fixture.alias.tsonic.type = 9;
  assertCompleteValue(verifyChapter(fixture.input, fixture.module), []);
  assertCompleteValue(verifyBody(fixture.input, fixture.body), [nodeViolation("type-closed", 1,
    "typed reference does not reach a present closed type/signature graph")]);
  fixture.alias.tsonic.type = 0;
  assertCompleteValue(verifyBody(fixture.input, fixture.body), []);
});

test("module definition payloads resolve through the actual declaration reader", () => {
  const fixture = typeAliasModuleScenario(true);
  fixture.keyword.tsonic.declarations = ["D[M[P[foreign];types];missing]"];
  assertCompleteValue(verifyBody(fixture.input, fixture.body), [nodeViolation("cross-owner-qualified", 3,
    "definition reference does not name an actual declaration")]);
  fixture.keyword.tsonic.declarations = [fixture.definition];
  assertCompleteValue(verifyBody(fixture.input, fixture.body), []);
});

test("a module retains the actual qualified signature-owner finding and its complete corrected opposite", () => {
  const fixture = typeAliasModuleScenario();
  const signature = { id: 1, declaration: fixture.definition, owner: { kind: "item", value: { owner: fixture.definition, node: 99 } },
    composition: null, kind: "call", typeParameters: [], receiver: null, parameters: [], result: 0 };
  fixture.input.types.signatures.push(signature);
  assertCompleteValue(verifyChapter(fixture.input, fixture.module), [nodeViolation("cross-owner-qualified", 0,
    "type verifier: cross-owner-qualified")]);
  signature.owner.value.node = 1;
  assertCompleteValue(verifyChapter(fixture.input, fixture.module), []);
});

test("module verification stops before a genuine published body and leaves its reference failure to that body exactly once", () => {
  const body = emptyModuleBody();
  const input = emptyVerificationInput(body);
  body.completion = 9;
  const actualBodyScopes = input.bindingScopesOf;
  const queries = [];
  input.bindingScopesOf = (target, subject, visit) => {
    queries.push(structuredClone(target));
    return target.kind === "module" ? completeScopes(target.module === moduleId ? [] : null)
      : actualBodyScopes(target, subject, visit);
  };
  assertCompleteValue(verifyChapter(input, input.module), []);
  assertCompleteValue(verifyBody(input, body), [bodyViolation("type-closed",
    "typed reference does not reach a present closed type/signature graph")]);
  assertCompleteValue(queries, [{ kind: "module", module: moduleId },
    { kind: "body", instance: { body: bodyId, bindings: { kind: "parametric" } } }]);
});

test("unknown module binding context is not treated as the known empty occurrence vector", () => {
  const fixture = typeAliasModuleScenario();
  fixture.input.bindingScopesOf = () => completeScopes(null);
  assertCompleteValue(verifyChapter(fixture.input, fixture.module), [nodeViolation("binding-vector-complete", 0,
    "binding target has no actual supplied scope inventory")]);
  fixture.input.bindingScopesOf = target => completeScopes(target.kind === "module" && target.module === moduleId ? [] : null);
  assertCompleteValue(verifyChapter(fixture.input, fixture.module), []);
});

test("an extra module scope remains a complete node-site finding, not a guessed body scope", () => {
  const fixture = typeAliasModuleScenario();
  fixture.scopes.push(emptyScope());
  assertCompleteValue(verifyChapter(fixture.input, fixture.module), [nodeViolation("binding-vector-complete", 0,
    "supplied binding scope has no corresponding actual vector")]);
  fixture.scopes.pop();
  assertCompleteValue(verifyChapter(fixture.input, fixture.module), []);
});

test("a genuine sparse published-body vector is an exact module-path caller defect", () => {
  const fixture = typeAliasModuleScenario();
  fixture.module.bodies = Array(1);
  assert.throws(() => verifyChapter(fixture.input, fixture.module), { name: "TypeError",
    message: 'ir-tir: sparse vector at $module["bodies"][0]' });
});

test("a null body-scope answer preserves the complete real instance and reports unresolved context once", () => {
  const body = emptyModuleBody();
  const input = emptyVerificationInput(body);
  const queries = [];
  input.bindingScopesOf = target => { queries.push(structuredClone(target)); return completeScopes(null); };
  assertCompleteValue(verifyBody(input, body), [bodyViolation("binding-vector-complete",
    "binding target has no actual supplied scope inventory")]);
  assertCompleteValue(queries, [{ kind: "body", instance: { body: bodyId, bindings: { kind: "parametric" } } }]);
});

for (const selected of [0, 1]) {
  test(`scope lookup distinguishes the complete bound environment for instance ${selected}`, () => {
    const fixture = genericFunctionScenario();
    const body = fixture.instances[selected];
    const input = fixture.inputFor(body);
    const reader = input.bindingScopesOf;
    const queries = [];
    input.bindingScopesOf = (target, subject, visit) => { queries.push(structuredClone(target)); return reader(target, subject, visit); };
    assertCompleteValue(verifyBody(input, body), []);
    const expectedBindings = { kind: "instantiated", bindings: { classBindings: [],
      methodBindings: [{ kind: "bound", parameter: fixture.typeDefinition, type: selected + 2 }],
      capturedBindings: [], selfBindings: [] } };
    assertCompleteValue(queries, [{ kind: "body", instance: { body: fixture.functionBody, bindings: expectedBindings } }]);
    assert.equal(reader({ kind: "body", instance: { body: fixture.functionBody,
      bindings: fixture.instances[1 - selected].bindings } }, body, null).scopes, null);
  });
}

test("missing and extra actual vector scopes are not guessed from empty data or object sharing", () => {
  const body = emptyModuleBody();
  const missing = emptyVerificationInput(body);
  replaceScopeInventory(missing, [emptyScope()]);
  assertCompleteValue(verifyBody(missing, body), [
    { rule: "binding-vector-complete", site: { kind: "node", module: moduleId, node: 0 },
      detail: [{ kind: "text", value: "actual binding vector has no corresponding supplied scope" }] },
  ]);
  const extra = emptyVerificationInput(body);
  bodyScopes(extra, body).push(emptyScope());
  assertCompleteValue(verifyBody(extra, body), [bodyViolation("binding-vector-complete", "supplied binding scope has no corresponding actual vector")]);
  body.root.tsonic.template.lexicalBindings = body.lexicalBindings;
  assertCompleteValue(verifyBody(emptyVerificationInput(body), body), [], "two declared visits remain two actual scope positions");
});

test("actual table-only lower findings retain their complete type/signature order without occurrence fallbacks", () => {
  const body = emptyModuleBody();
  const input = emptyVerificationInput(body);
  input.types.terms.push({ kind: "array", element: 99, readonly: false });
  input.types.signatures.push({ id: 8, declaration: null,
    owner: { kind: "item", value: { owner: "D[M[P[p];m];foreign]", node: 0 } },
    composition: null, kind: "call", typeParameters: [], receiver: null, parameters: [], result: 99 });
  assertCompleteValue(verifyBody(input, body), [
    bodyViolation("type-closed", "type verifier: type-reference"),
    bodyViolation("type-closed", "type verifier: signature-order"),
    bodyViolation("cross-owner-qualified", "type verifier: cross-owner-qualified"),
    bodyViolation("type-closed", "type verifier: type-reference"),
  ]);
});

test("the indexed lower join preserves every original finding across repeated binding and evidence occurrences", () => {
  const body = emptyModuleBody();
  const repeated = { ...emptyBindings(), selfBindings: [
    { kind: "rigid", owner: ownerId }, { kind: "rigid", owner: ownerId },
  ] };
  body.lexicalBindings = repeated;
  body.root.tsonic.template.lexicalBindings = repeated;
  const component = { kind: "body", value: { body: bodyId, node: 0 } };
  const evidence = { ...typeEvidence({ kind: "dynamic" }), nominal: ownerId,
    sum: { kind: "authored", component, bindings: emptyBindings(), arms: [
      { authoredIndex: 1, component, member: 0 }, { authoredIndex: 0, component, member: 0 },
    ] } };
  body.evidence = [evidence, evidence];
  const input = emptyVerificationInput(body, [], 4);
  input.types.terms.push({ kind: "array", element: 99, readonly: false });
  assertCompleteValue(verifyBody(input, body), [
    bodyViolation("type-closed", "type verifier: type-reference"),
    bodyViolation("binding-vector-complete", "type verifier: binding-vector-complete"),
    bodyViolation("binding-vector-complete", "type verifier: self-owner"),
    bodyViolation("binding-vector-complete", "type verifier: self-owner"),
    nodeViolation("binding-vector-complete", 0, "type verifier: binding-vector-complete"),
    nodeViolation("binding-vector-complete", 0, "type verifier: self-owner"),
    nodeViolation("binding-vector-complete", 0, "type verifier: self-owner"),
    bodyViolation("evidence-reference", "type verifier: evidence-type"),
    bodyViolation("evidence-reference", "type verifier: sum-arm-order"),
    bodyViolation("evidence-reference", "type verifier: sum-arm-order"),
    bodyViolation("evidence-reference", "type verifier: evidence-type"),
    bodyViolation("evidence-reference", "type verifier: sum-arm-order"),
    bodyViolation("evidence-reference", "type verifier: sum-arm-order"),
  ]);
});

test("a deferred closure decision is a saved invocation of its own occurrence, verified with its context and evidence", () => {
  const fixture = genericFunctionScenario();
  const body = fixture.functionTemplate;
  const context = { occurrence: { body: body.body, node: 2 }, origin: origin(), bindings: body.root.tsonic.callable.template.lexicalBindings };
  const evidence = { type: 4, component: { kind: "body", value: context.occurrence },
    category: { kind: "known", category: "callable" }, numeric: null, sum: null, nominal: null, pointer: null };
  const decided = body.root.tsonic.closure;
  body.root.tsonic.closure = { kind: "deferred", deferred: { result: 4, invocation: { rule: "closure", input: { context, callable: evidence, captures: [] } } } };
  const input = fixture.inputFor(body);
  replaceScopeInventory(input, [fixture.scope, fixture.scope, fixture.scope]);
  assertCompleteValue(verifyBody(input, body), []);
  context.occurrence = { body: body.body, node: 3 };
  assertCompleteValue(verifyBody(input, body), [nodeViolation("deferred-parameters", 2,
    "saved invocation does not retain its occurrence and complete captured rigid-parameter support")]);
  context.occurrence = { body: body.body, node: 2 };
  body.root.tsonic.closure = decided;
  replaceScopeInventory(input, [fixture.scope, fixture.scope]);
  assertCompleteValue(verifyBody(input, body), []);
});

test("a closure's rows follow the storage of each captured binding, and the created body states the closure's outcome", () => {
  // function make(p: int32, in r: int32, <moved> m: Box) { let x = 0; let n = 0; const c = 5; const o = { count: 0 };
  //   return () => { x += 1; o.count += 1; return x + n + c + p + r + m.size + o.count; }; }
  // [name, HIR role, mutable, passing of the parameter or null, a captured location is required]
  const rows = [
    ["x, a let the closure reassigns", "binding", true, null, true],
    ["n, a let never reassigned", "binding", true, null, true],
    ["c, a const holding a primitive", "binding", false, null, false],
    ["o, a const holding an object reference whose contents are written", "binding", false, null, false],
    ["p, a by-value parameter", "parameter", true, "by-value", true],
    ["r, a byref-readwrite parameter that cannot be reassigned", "parameter", false, "byref-readwrite", true],
    ["m, a moved parameter that cannot be reassigned", "parameter", false, "move", false],
  ];
  const fixture = genericFunctionScenario();
  const body = fixture.functionTemplate;
  const outerLocals = rows.map(([name, role, mutable], id) => ({ id, declaration: { kind: "body", value: { body: bodyId, node: 0 } },
    name: name.slice(0, 1), role, checkerSlot: available(0), capturedFrom: null, mutable }));
  const outerParams = rows.flatMap(([, role, , passing], local) => role === "parameter"
    ? [{ local, declaration: ownerId, role: "required", passing, initializer: null }] : []);
  const captures = rows.map((_row, local) => ({ body: bodyId, local }));
  const logical = rows.map(([, , , , location]) => location ? "captured-location" : "captured-value");
  const decided = modes => ({ kind: "decided", decision: { carrier: 4, captures: captures.map((local, index) => ({ local, capture: modes[index] })), execution: { kind: "pure" } } });
  const stated = modes => captures.map((local, index) => ({ local, capture: modes[index] }));
  fixture.originalFunction.captures = captures;
  fixture.checkedFunction.tsonic.captures = captures;
  for (const published of [fixture.functionTemplate, ...fixture.instances]) {
    published.captures = stated(logical);
    published.root.tsonic.closure = decided(logical);
  }
  const input = fixture.inputFor(body);
  const outer = input.source.bodies.find(candidate => candidate.body === bodyId);
  outer.locals = outerLocals; outer.params = outerParams;
  const localExists = input.localExists;
  input.localExists = reference => reference.body === bodyId ? outerLocals[reference.local] !== undefined : localExists(reference);
  assertCompleteValue(verifyBody(input, body), []);
  // Storage another party can still write is a captured location: a binding that can be reassigned, a parameter passed by
  // reference. For the others the evidence forces neither value. A captured value of o is the reference o holds: the
  // object's contents stay shared through it.
  const binding = nodeViolation("closure-capture-binding", 2, "a binding whose storage another party can write is a captured location");
  for (const [position, [name, , , , location]] of rows.entries()) {
    const flipped = logical.map((capture, index) => index !== position ? capture
      : capture === "captured-location" ? "captured-value" : "captured-location");
    body.root.tsonic.closure = decided(flipped); body.captures = stated(flipped);
    assertCompleteValue(verifyBody(input, body), location ? [binding] : [], name);
  }
  body.root.tsonic.closure = decided(logical.map(() => "captured-location")); body.captures = stated(logical.map(() => "captured-location"));
  assertCompleteValue(verifyBody(input, body), []);
  // The created body states the decided rows: locals, order and logical capture.
  const agree = bodyViolation("capture-rows-agree", "body capture rows do not state the outcome of the closure that creates the body", fixture.functionBody);
  body.root.tsonic.closure = decided(logical); body.captures = stated(logical);
  const order = bodyViolation("stable-order", "capture and nested-body inventories do not retain actual source order", fixture.functionBody);
  for (const [label, changed, expected] of [
    ["a different logical capture", stated(logical.map((capture, index) => index !== 2 ? capture : "captured-location")), [agree]],
    ["the rows in another order", [stated(logical)[1], stated(logical)[0], ...stated(logical).slice(2)], [order, agree]],
    ["a row short", stated(logical).slice(1), [order, agree]],
    ["a row more", [...stated(logical), stated(logical)[0]], [order, agree]],
    ["a null row in a ready body", stated(logical.map((capture, index) => index === 0 ? null : capture)), [agree]],
  ]) {
    body.captures = changed;
    assertCompleteValue(verifyBody(input, body), expected, label);
  }
  body.captures = stated(logical);
  // A deferred closure rule: the parametric template states the saved locals with no capture yet, every row null; each
  // instance decides, and its created body states the decided rows.
  const context = { occurrence: { body: body.body, node: 2 }, origin: origin(), bindings: body.root.tsonic.callable.template.lexicalBindings };
  const evidence = (type, category) => ({ type, component: { kind: "body", value: context.occurrence },
    category: { kind: "known", category }, numeric: null, sum: null, nominal: null, pointer: null });
  const incoming = rows.map(([, role, , passing]) => role === "parameter" ? { kind: "parameter", passing } : { kind: "binding" });
  const saved = captures.map((local, position) => ({ local, value: evidence(3, "number"), reassignable: rows[position][2], incoming: incoming[position] }));
  const deferred = captured => ({ kind: "deferred", deferred: { result: 4, invocation: { rule: "closure", input: {
    context, callable: evidence(4, "callable"), captures: captured } } } });
  body.root.tsonic.closure = deferred(saved); body.captures = stated(rows.map(() => null));
  replaceScopeInventory(input, [fixture.scope, fixture.scope, fixture.scope]);
  assertCompleteValue(verifyBody(input, body), [], "a non-empty deferred template");
  for (const instance of fixture.instances) {
    assertCompleteValue(instance.root.tsonic.closure, decided(logical));
    assertCompleteValue(instance.captures, stated(logical));
    assertCompleteValue(verifyBody(fixture.inputFor(instance), instance).filter(violation => violation.rule === "capture-rows-agree"), [],
      "its instance states the decided rows");
  }
  body.captures = stated(rows.map((_row, index) => index === 0 ? logical[0] : null));
  assertCompleteValue(verifyBody(input, body), [agree], "mixed null and decided rows under a deferred closure");
  body.captures = stated(logical);
  assertCompleteValue(verifyBody(input, body), [agree], "decided rows under a deferred closure");
  body.captures = stated(rows.map(() => null));
  const savedBinding = nodeViolation("closure-capture-binding", 2, "saved capture evidence does not state the binding evidence of its captured locals");
  for (const [label, changed] of [
    ["the reassignment fact", saved.map((capture, index) => index === 3 ? { ...capture, reassignable: true } : capture)],
    ["the reassignment fact, the other way", saved.map((capture, index) => index === 0 ? { ...capture, reassignable: false } : capture)],
    ["the kind of the incoming storage", saved.map((capture, index) => index === 3 ? { ...capture, incoming: { kind: "parameter", passing: "by-value" } } : capture)],
    ["the passing mode", saved.map((capture, index) => index === 5 ? { ...capture, incoming: { kind: "parameter", passing: "move" } } : capture)],
    ["a parameter saved as a binding", saved.map((capture, index) => index === 4 ? { ...capture, incoming: { kind: "binding" } } : capture)],
  ]) {
    body.root.tsonic.closure = deferred(changed);
    assertCompleteValue(verifyBody(input, body), [savedBinding], label);
  }
  const sequence = nodeViolation("capture-qualified", 2, "closure captures do not retain the real authored outer-local sequence");
  body.root.tsonic.closure = deferred([saved[1], saved[0], ...saved.slice(2)]);
  body.captures = [stated(rows.map(() => null))[1], stated(rows.map(() => null))[0], ...stated(rows.map(() => null)).slice(2)];
  assertCompleteValue(verifyBody(input, body), [order, sequence], "the saved locals in another order");
  body.root.tsonic.closure = deferred(saved); body.captures = stated(rows.map(() => null));
  // A captured local with no row in its checked body, and a source body list with a hole: no evidence, so no finding from
  // the binding rule. The decided closure has no saved context, so the template's scope inventory is its own again.
  replaceScopeInventory(input, [fixture.scope, fixture.scope]);
  const rowless = { body: bodyId, local: rows.length };
  const withRowless = [...captures, rowless];
  fixture.originalFunction.captures = withRowless;
  fixture.checkedFunction.tsonic.captures = withRowless;
  input.localExists = reference => reference.body === bodyId ? reference.local <= rows.length : localExists(reference);
  body.root.tsonic.closure = { kind: "decided", decision: { carrier: 4, captures: [...stated(logical), { local: rowless, capture: "captured-value" }], execution: { kind: "pure" } } };
  body.captures = [...stated(logical), { local: rowless, capture: "captured-value" }];
  assertCompleteValue(verifyBody(input, body), [], "a captured local without a row");
  input.source.bodies.length += 1;
  assertCompleteValue(verifyBody(input, body), [], "a hole in the source body list");
  input.source.bodies.length -= 1;
  // A closure that saved another rule names no captured locals.
  body.root.tsonic.closure = { kind: "deferred", deferred: { result: 4, invocation: { rule: "refinement", input: {
    context, source: evidence(3, "number"), checked: evidence(3, "number") } } } };
  assertCompleteValue(verifyBody(input, body).filter(violation => violation.rule === "closure-capture-total"),
    [nodeViolation("closure-capture-total", 2, "a deferred closure does not save the closure rule's evidence of its captured locals")]);
});

test("a shared vector is authenticated against each occurrence's actual declaration, never an object-wide owner union", () => {
  const fixture = genericFunctionScenario();
  const body = fixture.functionTemplate;
  const context = { occurrence: { body: body.body, node: 2 }, origin: origin(), bindings: body.root.tsonic.callable.template.lexicalBindings };
  const evidence = { type: 4, component: { kind: "body", value: context.occurrence },
    category: { kind: "known", category: "callable" }, numeric: null, sum: null, nominal: null, pointer: null };
  const endpoint = { declaration: ownerId, role: "advertised", signature: 0, body: bodyId };
  const candidate = { ordinal: 0, declaration: ownerId, advertised: endpoint, advertisedSignature: 0,
    api: { ...endpoint, role: "api-body" }, apiSignature: 0,
    bindings: body.lexicalBindings, conditionalFailure: null };
  body.root.tsonic.conversion = { kind: "deferred", deferred: { result: 4, invocation: { rule: "candidate", input: {
    context, kind: "call", callee: evidence, receiver: null, typeArguments: [], arguments: [], candidates: [candidate] } } } };
  const input = fixture.inputFor(body);
  replaceScopeInventory(input, [fixture.scope, fixture.scope, emptyScope(), fixture.scope]);
  assert.equal(candidate.bindings === body.lexicalBindings, true);
  assertCompleteValue(verifyBody(input, body), [nodeViolation("binding-vector-complete", 2,
    "type verifier: binding-vector-complete")]);
  candidate.bindings = emptyBindings();
  assertCompleteValue(verifyBody(input, body), []);
  candidate.bindings = body.lexicalBindings;
  candidate.declaration = fixture.definition;
  candidate.advertised = { declaration: fixture.definition, role: "advertised", signature: 1, body: body.body };
  candidate.advertisedSignature = 1;
  candidate.api = { ...candidate.advertised, role: "api-body" };
  candidate.apiSignature = 1;
  bodyScopes(input, body)[2] = fixture.scope;
  assertCompleteValue(verifyBody(input, body), []);
});

for (const resolution of ["local", "definition", "known-aliases", "missing-definition", "missing-alias", "repeated-missing-aliases"]) {
  test(`body definition closure preserves the complete ${resolution} vector at Identifier9`, async () => {
    const { encodeDefId } = await import("../../packages/host/dist/ids/index.js");
    const fixture = genericFunctionScenario();
    const body = fixture.functionTemplate;
    const input = fixture.inputFor(body);
    const value = body.root.body.statements.nodes[0].expression;
    const original = value.tsonic.resolution;
    const missing = encodeDefId({ module: moduleId, segments: [{ name: "missing", ordinal: 0 }] });
    if (resolution !== "local") value.tsonic.resolution = { kind: "definition",
      definition: resolution === "missing-definition" ? missing : fixture.valueDefinition,
      aliases: resolution === "known-aliases" ? [{ kind: "body", value: { body: body.body, node: value.id } },
        { kind: "item", value: { owner: fixture.definition, node: value.id } }]
        : resolution === "missing-alias" ? [{ kind: "item", value: { owner: missing, node: value.id } }]
          : resolution === "repeated-missing-aliases" ? [0, 1].map(() => ({ kind: "item", value: { owner: missing, node: value.id } })) : [] };
    const expected = resolution === "missing-definition"
      ? [nodeViolation("cross-owner-qualified", 9, "definition reference does not name an actual declaration")]
      : resolution === "missing-alias" || resolution === "repeated-missing-aliases" ? [
        nodeViolation("cross-owner-qualified", 9, "source reference does not name an actual node in its declared owner"),
        nodeViolation("cross-owner-qualified", 9, "definition reference does not name an actual declaration"),
      ] : [];
    assertCompleteValue(verifyBody(input, body), expected);
    value.tsonic.resolution = original;
    assertCompleteValue(verifyBody(input, body), []);
  });
}

test("binding occurrence roles preserve exact qualification and genuine namespace identities", async () => {
  const { verifyOccurrenceRole } = await import("../../packages/host/dist/ir-tir/verify-occurrences.js");
  const occurrence = { kind: "item", value: { owner: ownerId, node: 4 } };
  const target = { ...header(4), kind: "Identifier", text: "binding", tsonic: { role: "binding-name", binding: occurrence } };
  const source = { ...target, tsonic: { core: emptyCore(), ...target.tsonic } };
  const check = (actual, checked) => {
    const findings = [];
    verifyOccurrenceRole(actual, checked, (rule, node, detail) => findings.push({ rule, node: node.id, detail }));
    return findings;
  };
  assert.deepStrictEqual(check(target, source), []);
  for (const checked of [undefined, { ...source, tsonic: null }]) assert.deepStrictEqual(check(target, checked), []);
  for (const [actual, checked] of [
    [{ ...target, tsonic: { role: "binding-name" } }, source],
    [target, { ...source, tsonic: { core: emptyCore(), role: "binding-name" } }],
    [{ ...target, tsonic: { ...target.tsonic, binding: { kind: "body", value: { body: bodyId, node: 4 } } } }, source],
  ]) assert.deepStrictEqual(check(actual, checked), [{ rule: "binding-capture-owner", node: 4,
    detail: "typed binding syntax must retain its actual checked qualified occurrence" }]);
  const namespace = { ...target, kind: "NamespaceExport", name: target,
    tsonic: { definition: ownerId, binding: occurrence } };
  const checkedNamespace = { ...namespace, tsonic: { ...namespace.tsonic, core: emptyCore() } };
  assert.deepStrictEqual(check(namespace, checkedNamespace), []);
  assert.deepStrictEqual(check(namespace, { ...checkedNamespace, tsonic: { ...checkedNamespace.tsonic, definition: "other" } }), [
    { rule: "binding-capture-owner", node: 4, detail: "a namespace export must retain its genuine same-node F1 declaration" },
  ]);
  const clause = { ...header(4), kind: "ImportClause", phaseModifier: null, name: null, namedBindings: null, tsonic: null };
  const checkedClause = { ...clause, tsonic: { core: emptyCore(), target: { kind: "available", value: { target: "project", module: moduleId } }, bindings: [occurrence] } };
  assert.deepStrictEqual(check(clause, checkedClause), []);
  assert.equal(check({ ...clause, tsonic: { binding: occurrence } }, checkedClause)[0].rule, "binding-capture-owner");
  assert.deepStrictEqual(check({ ...clause, name: target, tsonic: { binding: occurrence } }, checkedClause), []);
  for (const kind of ["ImportSpecifier", "NamespaceImport"]) {
    const imported = { ...target, kind, name: target, tsonic: { binding: occurrence } };
    const original = { ...imported, tsonic: { core: emptyCore(), target: checkedClause.tsonic.target, bindings: [occurrence] } };
    assert.deepStrictEqual(check(imported, original), []);
    for (const phase of [null, {}]) assert.equal(check({ ...imported, tsonic: phase }, original)[0].rule, "binding-capture-owner");
    for (const checked of [undefined, { ...original, kind: "ImportClause" },
      { ...original, tsonic: { ...original.tsonic, bindings: [] } },
      { ...original, tsonic: { ...original.tsonic, bindings: [{ kind: "body", value: { body: bodyId, node: 4 } }] } }])
      assert.equal(check(imported, checked)[0].rule, "binding-capture-owner");
    assert.equal(check({ ...imported, tsonic: { binding: { ...occurrence, value: { ...occurrence.value, node: 5 } } } }, original)[0].rule,
      "binding-capture-owner");
  }
  for (const [actual, checked] of [[{ ...clause, name: target }, checkedClause],
    [{ ...clause, name: target, tsonic: { binding: occurrence } }, { ...checkedClause, tsonic: { ...checkedClause.tsonic, bindings: [] } }],
    [{ ...clause, name: target, tsonic: { binding: { ...occurrence, value: { ...occurrence.value, node: 5 } } } }, checkedClause]])
    assert.equal(check(actual, checked)[0].rule, "binding-capture-owner");
});

test("body scalar definitions share the real nullable declaration cache only within one invocation", async () => {
  const { encodeDefId } = await import("../../packages/host/dist/ids/index.js");
  const fixture = genericFunctionScenario();
  const body = fixture.functionTemplate;
  const input = fixture.inputFor(body);
  const value = body.root.body.statements.nodes[0].expression;
  const missing = encodeDefId({ module: moduleId, segments: [{ name: "missing", ordinal: 0 }] });
  value.tsonic.resolution = { kind: "definition", definition: missing, aliases: [] };
  const actual = input.declarationOf;
  const queries = [];
  input.declarationOf = definition => { queries.push(definition); return actual(definition); };
  assertCompleteValue(verifyBody(input, body), [nodeViolation("cross-owner-qualified", 9,
    "definition reference does not name an actual declaration")]);
  assertCompleteValue(queries, [fixture.definition, fixture.typeDefinition, fixture.valueDefinition, missing]);
  queries.length = 0;
  fixture.declarations.set(missing, { scope: emptyScope(), parameterCount: 0, endpoints: [] });
  assertCompleteValue(verifyBody(input, body), []);
  assertCompleteValue(queries, [fixture.definition, fixture.typeDefinition, fixture.valueDefinition, missing]);
});

for (const variant of ["outer", "template", "string", "int32"]) {
  test(`authentic generic function ${variant} preserves its own template, formal storage and complete publication`, () => {
    const fixture = genericFunctionScenario();
    const selected = variant === "outer" ? fixture.outer : variant === "template" ? fixture.functionTemplate
      : fixture.instances[variant === "string" ? 0 : 1];
    assertCompleteValue(verifyBody(fixture.inputFor(selected), selected), []);
    assert.equal(fixture.outer.dependence, "parametric");
    assert.equal(fixture.functionTemplate.dependence, "binding-dependent");
    assert.equal(fixture.functionTemplate.root === fixture.module.tree.root.statements.nodes[0].node.expression, true);
    assert.equal(fixture.instances[0].root === fixture.instances[1].root, false);
    assert.equal(fixture.instances[0].root.id, fixture.instances[1].root.id);
    assert.equal(fixture.instances[0].root.body.statements.nodes[0].expression.tsonic.type, 2);
    assert.equal(fixture.instances[1].root.body.statements.nodes[0].expression.tsonic.type, 3);
  });
}

for (const selected of ["outer", "template", "string", "int32"]) {
  test(`several genuine ${selected} formals retain complete source, local and instance associations`, () => {
    const fixture = twoParameterScenario();
    const body = selected === "outer" ? fixture.outer : selected === "template" ? fixture.functionTemplate
      : fixture.instances[selected === "string" ? 0 : 1];
    assertCompleteValue(verifyBody(fixture.inputFor(body), body), []);
  });
}
test("several finalized formals cannot be reordered while their actual parameter nodes retain declared order", () => {
  const fixture = twoParameterScenario();
  const body = fixture.functionTemplate;
  body.params = [...body.params].reverse();
  assertCompleteValue(verifyBody(fixture.inputFor(body), body), [
    ...[5, 7].flatMap(node => [
      nodeViolation("authored-node-ids-preserved", node, "typed node identity differs from the actual authored node at this position"),
      nodeViolation("authored-node-ids-preserved", node + 1, "typed node identity differs from the actual authored node at this position"),
      nodeViolation("kind-children-shape", node + 1, "typed syntax does not retain the authored kind, fields and child presence"),
      nodeViolation("parent-reference", node + 1, "typed node parent differs from the real authored parent"),
    ]),
    bodyViolation("parameter-order", "parameter records do not retain the actual declared formal order", fixture.functionBody),
  ]);
});
test("omitting a second real formal preserves both inventory and actual occurrence findings", () => {
  const fixture = twoParameterScenario();
  const body = fixture.functionTemplate;
  body.params = body.params.slice(0, 1);
  assertCompleteValue(verifyBody(fixture.inputFor(body), body), [
    bodyViolation("parameter-order", "parameter records do not retain the actual declared formal order", fixture.functionBody),
    nodeViolation("parameter-order", 7, "parameter occurrence does not retain its actual declared formal and local association"),
  ]);
});

for (const mode of ["sync", "async", "generator", "async-generator"]) {
  test(`completion-endpoint uses the actual ${mode} body channels, not the API wrapper result`, () => {
    const fixture = callScenario(mode);
    const publication = fixture.input.bodyOf;
    const queries = [];
    fixture.input.bodyOf = instance => { queries.push(instance); return publication(instance); };
    assertCompleteValue(verifyBody(fixture.input, fixture.body), []);
    assertCompleteValue(queries, [{ body: fixture.functionBody, bindings: { kind: "instantiated", bindings: {
      classBindings: [], methodBindings: [{ kind: "bound", parameter: fixture.typeDefinition, type: 2 }], capturedBindings: [], selfBindings: [],
    } } }]);
    assert.equal(fixture.decision.completion.completion, 2);
    assert.equal(fixture.types.signatures[2].result, mode === "sync" ? 2 : 5);
    assert.equal(publication(fixture.callee.activation) === fixture.target, true);
  });
  test(`the actual ${mode} canonical body independently retains complete typed syntax and channels`, () => {
    const fixture = callScenario(mode);
    const input = fixture.inputFor(fixture.target);
    input.nominalOf = fixture.input.nominalOf;
    assertCompleteValue(verifyBody(input, fixture.target), []);
  });
  for (const channel of ["signature", "completion", "yielded", "sent"]) {
    test(`completion-endpoint detects the genuine ${mode}/${channel} canonical-body mismatch`, () => {
      const fixture = callScenario(mode);
      fixture.decision.completion[channel] = channel === "signature" || channel === "completion" ? 3
        : channel === "yielded" ? 2 : 3;
      const expected = [nodeViolation("completion-endpoint", 2,
        "selected completion does not retain the actual activated body's signature and channels")];
      assertCompleteValue(verifyBody(fixture.input, fixture.body), expected);
    });
  }
  test(`missing ${mode} actual publication remains only instance resolution, not invented completion channels`, () => {
    const fixture = callScenario(mode);
    fixture.module.bodies.splice(fixture.module.bodies.indexOf(fixture.target), 1);
    assertCompleteValue(verifyBody(fixture.input, fixture.body), [nodeViolation("nested-instance-key", 2,
      "instance does not select a real canonical body with the complete artifact environment")]);
  });
}

for (const field of ["candidate", "advertised"]) {
  test(`actual callable ${field} association is authenticated against independent canonical records`, () => {
    const fixture = callScenario();
    if (field === "candidate") fixture.decision.candidate = 99;
    else fixture.decision.advertised = { ...fixture.decision.advertised, body: bodyId };
    assertCompleteValue(verifyBody(fixture.input, fixture.body), [nodeViolation("call-endpoints", 2,
      "selected callable endpoints do not belong to their actual declarations and candidate")]);
  });
}
const callEndpoints = () => [nodeViolation("call-endpoints", 2,
  "selected callable endpoints do not belong to their actual declarations and candidate")];
test("an overloaded family's implementation endpoint cannot stand in for its advertised endpoint", () => {
  const fixture = callScenario();
  fixture.decision.advertised = fixture.decision.api;
  assertCompleteValue(verifyBody(fixture.input, fixture.body), callEndpoints());
});
test("a family without an advertised row selects one endpoint as both the advertised and the API endpoint", () => {
  const fixture = callScenario();
  const family = fixture.declarations.get(fixture.definition).endpoints;
  const advertised = fixture.decision.advertised;
  family.splice(family.indexOf(advertised), 1);
  fixture.decision.advertised = fixture.decision.api;
  assertCompleteValue(verifyBody(fixture.input, fixture.body), []);
  fixture.decision.advertised = advertised;
  assertCompleteValue(verifyBody(fixture.input, fixture.body), callEndpoints());
  fixture.decision.advertised = { ...fixture.decision.api, signature: 1 };
  assertCompleteValue(verifyBody(fixture.input, fixture.body), callEndpoints());
});
// A bodiless API signature declared by another definition, as in the inference case of a native binding: the callee is
// not activated, so no body's completion is involved and only endpoint membership is under test.
const foreignApi = fixture => {
  const other = "D[M[P[p];m];native]";
  const foreign = { declaration: other, role: "api-signature", signature: 4, body: null };
  fixture.types.signatures.push({ ...fixture.types.signatures[2], id: 4, declaration: other });
  fixture.declarations.set(other, { scope: fixture.scope, parameterCount: 1, endpoints: [foreign] });
  fixture.decision.api = foreign;
  fixture.decision.completion = { ...fixture.decision.completion, signature: 4 };
  fixture.callee.activation = null;
  bodyScopes(fixture.input, fixture.body).splice(3, 1);
  return foreign;
};
test("an advertised row is a family member by its signature as well as its owner, role and body", () => {
  const fixture = callScenario();
  const family = fixture.declarations.get(fixture.definition).endpoints;
  family.push({ ...fixture.decision.advertised, signature: 3 });
  assertCompleteValue(verifyBody(fixture.input, fixture.body), []);
  family.pop();
  fixture.decision.advertised = { ...fixture.decision.advertised, signature: 3 };
  assertCompleteValue(verifyBody(fixture.input, fixture.body), callEndpoints());
});
test("an API endpoint declared by another definition is selected only through the selected declaration's family", () => {
  const unrelated = callScenario();
  foreignApi(unrelated);
  assertCompleteValue(verifyBody(unrelated.input, unrelated.body), callEndpoints());
  const associated = callScenario();
  associated.declarations.get(associated.definition).endpoints.push(foreignApi(associated));
  assertCompleteValue(verifyBody(associated.input, associated.body), []);
  const completion = associated.decision.completion;
  associated.decision.completion = { ...completion, signature: associated.decision.advertised.signature };
  assertCompleteValue(verifyBody(associated.input, associated.body), [
    nodeViolation("completion-endpoint", 2, "selected completion does not retain its actual API signature"),
  ]);
  associated.decision.completion = completion;
  assertCompleteValue(verifyBody(associated.input, associated.body), []);
});
test("an enclosing capture's logical capture is read from the creating body's own typed row", () => {
  // function outer() { v is outer's capture of a local of f; return () => v; }: the closure (verified here, the root of its
  // body) captures v, a capture of the creating body; v's row in the creating body states whether it is a location.
  const fixture = genericFunctionScenario();
  const body = fixture.functionTemplate;
  // Two enclosing captures from the same creating body, so the creating artifact is found once and read twice.
  const foreign = { body: "B[D[M[P[foreign];source];f];function;0]", local: 0 };
  const foreignSecond = { ...foreign, local: 1 };
  const own = { body: bodyId, local: 0 };
  const ownSecond = { body: bodyId, local: 1 };
  const input = fixture.inputFor(body);
  const source = input.source.bodies.find(candidate => candidate.body === bodyId);
  source.locals = [{ id: 0, declaration: { kind: "body", value: { body: bodyId, node: 0 } }, name: "v", role: "capture",
    checkerSlot: available(0), capturedFrom: foreign, mutable: false },
  { id: 1, declaration: { kind: "body", value: { body: bodyId, node: 0 } }, name: "w", role: "capture",
    checkerSlot: available(0), capturedFrom: foreignSecond, mutable: false }];
  const localExists = input.localExists;
  input.localExists = reference => reference.body === foreign.body ? reference.local <= 1 : localExists(reference);
  fixture.originalFunction.captures = [ownSecond, own];
  fixture.checkedFunction.tsonic.captures = [ownSecond, own];
  const binding = nodeViolation("closure-capture-binding", 2, "a binding whose storage another party can write is a captured location");
  const judged = (enclosing, inner) => {
    fixture.outer.captures = enclosing === undefined ? [] : [{ local: foreignSecond, capture: "captured-value" }, { local: foreign, capture: enclosing }];
    body.captures = [{ local: ownSecond, capture: "captured-value" }, ...bodyRows([own], inner)];
    body.root.tsonic.closure = { kind: "decided", decision: { carrier: 4, captures: [{ local: ownSecond, capture: "captured-value" }, { local: own, capture: inner }],
      execution: { kind: "pure" } } };
    return verifyBody(input, body).filter(violation => violation.rule === "closure-capture-binding");
  };
  assertCompleteValue(judged("captured-location", "captured-value"), [binding], "an enclosing captured location is a captured location");
  assertCompleteValue(judged("captured-location", "captured-location"), []);
  assertCompleteValue(judged("captured-value", "captured-value"), [], "an enclosing captured value forces neither");
  assertCompleteValue(judged("captured-value", "captured-location"), []);
  assertCompleteValue(judged(null, "captured-value"), [], "a null row of the creating body states nothing yet");
  assertCompleteValue(judged(undefined, "captured-value"), [], "no row for the local it was captured from: no evidence");
  // An instance of the created body is created by an artifact of the creating body whose tree holds the instance's root as
  // a closure with the instance's lexical bindings. With no such artifact the context is missing and nothing is read: the
  // parametric creator is not substituted for it.
  const [first, second] = fixture.instances;
  for (const instance of [first, second]) {
    instance.captures = [{ local: ownSecond, capture: "captured-value" }, { local: own, capture: "captured-value" }];
    instance.root.tsonic.closure = { kind: "decided", decision: { carrier: 4,
      captures: [{ local: ownSecond, capture: "captured-value" }, { local: own, capture: "captured-value" }], execution: { kind: "pure" } } };
  }
  fixture.outer.captures = [{ local: foreignSecond, capture: "captured-value" }, { local: foreign, capture: "captured-location" }];
  const judgedInstance = instance => {
    const instanceInput = fixture.inputFor(instance);
    instanceInput.localExists = input.localExists;
    return verifyBody(instanceInput, instance).filter(violation => violation.rule === "closure-capture-binding");
  };
  assertCompleteValue(judgedInstance(first), [], "no artifact of the creating body creates this instance: missing context, no template guess");
  // Two artifacts of the same creating body, in different environments, each creating one instance, with different rows.
  const creatorFor = (instance, capture) => {
    const callable = instance.root.tsonic.callable;
    const closureNode = { ...instance.root, tsonic: { ...instance.root.tsonic, callable: { ...callable,
      template: { ...callable.template, lexicalBindings: instance.lexicalBindings } } } };
    return { ...fixture.outer, bindings: { kind: "instantiated", bindings: instance.lexicalBindings },
      captures: [{ local: foreignSecond, capture: "captured-value" }, { local: foreign, capture }],
      root: { ...fixture.outer.root, statements: nodeList([readyStatement({ ...fixture.outer.root.statements.nodes[0].node, expression: closureNode })]) } };
  };
  // Artifacts of the creating body that do not create the instance: no closure node for it, a closure with no template, a
  // template of another body. None of them is read.
  const withExpression = expression => ({ ...creatorFor(first, "captured-location"),
    root: { ...fixture.outer.root, statements: nodeList([readyStatement({ ...fixture.outer.root.statements.nodes[0].node, expression })]) } });
  const noClosure = { ...creatorFor(first, "captured-location"), root: { ...fixture.outer.root, statements: nodeList([]) } };
  const noTemplate = withExpression({ ...first.root, tsonic: { ...first.root.tsonic, callable: { ...first.root.tsonic.callable, template: null } } });
  const otherBody = withExpression({ ...first.root, tsonic: { ...first.root.tsonic, callable: { ...first.root.tsonic.callable,
    template: { ...first.root.tsonic.callable.template, body: bodyId, lexicalBindings: first.lexicalBindings } } } });
  const bodies = fixture.inputFor(first).module.bodies;
  const published = [...bodies];
  bodies.push(noClosure, noTemplate, otherBody);
  assertCompleteValue(judgedInstance(first), [], "artifacts that do not create the instance are not read");
  bodies.push(creatorFor(first, "captured-location"), creatorFor(second, "captured-value"));
  assertCompleteValue(judgedInstance(first), [binding], "the artifact that creates the first instance states a captured location");
  assertCompleteValue(judgedInstance(second), [], "the artifact that creates the second instance states a captured value");
  const firstInput = { ...fixture.inputFor(first), localExists: input.localExists };
  checkTirBodyAdmissionCuts(admitFixtureRead, product.verifyTir, firstInput, first);
  const decided = first.root.tsonic.closure;
  const occurrence = { body: first.body, node: first.root.id };
  first.root.tsonic.closure = { kind: "deferred", deferred: { result: 4, invocation: { rule: "closure",
    input: { context: { occurrence, origin: first.root.origin, bindings: first.lexicalBindings },
      callable: { type: 4, component: { kind: "body", value: occurrence }, category: { kind: "known", category: "callable" },
        numeric: null, sum: null, nominal: null, pointer: null },
      captures: decided.decision.captures.map(row => ({ local: row.local, reassignable: false, incoming: { kind: "capture", capture: row.capture },
        value: { type: 2, component: { kind: "body", value: occurrence }, category: { kind: "known", category: "string" },
          numeric: null, sum: null, nominal: null, pointer: null } })),
    } } } };
  checkTirBodyAdmissionCuts(admitFixtureRead, product.verifyTir, firstInput, first);
  first.root.tsonic.closure = decided;
  bodies.reverse();
  assertCompleteValue(judgedInstance(first), [binding], "publication order: the same artifact is read");
  assertCompleteValue(judgedInstance(second), [], "publication order: the same artifact is read for the second");
  bodies.push(creatorFor(first, "captured-value"));
  assertCompleteValue(judgedInstance(first), [], "two artifacts that both create the first instance: ambiguous, missing context");
  bodies.splice(0, bodies.length, ...published);
  // A capture-role local that names no captured-from local (refused by the HIR verifier) gives no evidence here.
  source.locals = [{ ...source.locals[0], capturedFrom: null }, source.locals[1]];
  assertCompleteValue(judged("captured-location", "captured-value"), [], "a capture without its captured-from local: no evidence");
});

test("a callee's activation names its API body", () => {
  const fixture = callScenario();
  assertCompleteValue(verifyBody(fixture.input, fixture.body), []);
  const original = fixture.callee.activation;
  fixture.callee.activation = { ...fixture.callee.activation, body: "B[D[M[P[p];m];other];function;0]" };
  assertCompleteValue(verifyBody(fixture.input, fixture.body).filter(violation => violation.rule === "call-endpoints"),
    [nodeViolation("call-endpoints", 2, "callee activation does not retain its actual API body")]);
  fixture.callee.activation = { ...original, bindings: fixture.instances[1].bindings };
  assertCompleteValue(verifyBody(fixture.input, fixture.body), [
    nodeViolation("call-endpoints", 2, "callee activation does not retain its actual implementation bindings"),
  ]);
  fixture.callee.activation = original;
  assertCompleteValue(verifyBody(fixture.input, fixture.body), []);
});

test("activation keys admit selected bindings before reading implementation bindings", async () => {
  const { verifyActivation } = await import("../../packages/host/dist/ir-tir/verify-applications.js");
  const { tirReadyReadAdmission } = await import("../../packages/host/dist/ir-program/index.js");
  const { accountFailure, createAccount, remainingWork } = await import("../../packages/host/dist/dataflow/index.js");
  const { callee, call } = callScenario();
  const selected = callee.activation.bindings.bindings;
  const implementation = callee.decision.implementationBindings;
  const bindingWork = 2 + selected.methodBindings[0].parameter.length;
  const work = 3 + 2 * bindingWork;
  const limits = { maximumWork: work, maximumResultEntries: 12 };
  function inspect(allowance, body = callee.activation.body) {
    const reads = [];
    const account = createAccount(allowance);
    const actual = { activation: { body, get bindings() {
      reads.push("artifact");
      return { kind: "instantiated", get bindings() { reads.push("selected"); return selected; } };
    } }, decision: { ...callee.decision, get implementationBindings() { reads.push("implementation"); return implementation; } } };
    const findings = [];
    const result = verifyActivation(actual, call, (rule, _node, detail) => findings.push([rule, detail]), tirReadyReadAdmission(account));
    return { result, reads, findings, account };
  }
  const exact = inspect(limits);
  assert.deepEqual(exact.result, { kind: "complete", valid: true });
  assert.equal(remainingWork(exact.account), 0);
  assert.deepEqual(exact.reads, ["artifact", "selected", "implementation"]);
  for (let maximumWork = 0; maximumWork < work; maximumWork += 1) {
    const cut = inspect({ ...limits, maximumWork });
    assert.equal(cut.result.kind, "resource-stop");
    assert.equal(cut.result.stop === accountFailure(cut.account), true);
    assert.deepEqual(cut.reads, exact.reads.filter((_label, index) => maximumWork >= [1, 2, bindingWork + 3][index]));
  }
  for (let maximumResultEntries = 0; maximumResultEntries < 12; maximumResultEntries += 1) {
    const cut = inspect({ ...limits, maximumResultEntries });
    assert.equal(cut.result.kind, "resource-stop");
    assert.equal(cut.result.stop === accountFailure(cut.account), true);
    assert.deepEqual(cut.reads, exact.reads.slice(0, maximumResultEntries < 6 ? 2 : 3));
  }
  const crossed = inspect({ maximumWork: 0, maximumResultEntries: 0 }, "B[D[M[P[p];m];other];function;0]");
  assert.deepEqual(crossed.result, { kind: "complete", valid: false });
  assert.deepEqual(crossed.reads, []);
  assert.deepEqual(crossed.findings, [["call-endpoints", "callee activation does not retain its actual API body"]]);
});

test("a nonactivated callee retains actual endpoints and states no captured locations", async () => {
  const { verifyActivation } = await import("../../packages/host/dist/ir-tir/verify-applications.js");
  const fixture = callScenario();
  fixture.callee.activation = null;
  bodyScopes(fixture.input, fixture.body).splice(3, 1);
  assertCompleteValue(verifyBody(fixture.input, fixture.body), []);
  assert.deepEqual(verifyActivation(fixture.callee, fixture.call, (_rule, _node, detail) => assert.fail(detail),
    admitFixtureRead()), { kind: "complete", valid: true });
  assert.equal(Object.hasOwn(fixture.callee, "captures"), false, "a resolved callee has no list of captured locals");
});

test("two contextual property components in one literal retain distinct authentic tables", () => {
  const fixture = contextualLiteralScenario();
  assertCompleteValue(verifyBody(fixture.input, fixture.body), []);
  assertCompleteValue(fixture.queries, fixture.facts.map(fact => ({ instance: fact.instance, occurrence: fact.occurrence })));
  assert.equal(fixture.facts[0].table.receiver, 1);
  assert.equal(fixture.facts[1].table.receiver, 2);
  assert.equal(fixture.body.root.statements.nodes[0].node.expression.tsonic.type, 0);
  assert.equal(fixture.body.root.statements.nodes[0].node.expression.tsonic.convertedType, 0);
});

test("swapping contextual property associations is not repaired from the enclosing literal type", () => {
  const fixture = contextualLiteralScenario();
  const first = fixture.facts[0].table;
  fixture.facts[0].table = fixture.facts[1].table;
  fixture.facts[1].table = first;
  assertCompleteValue(verifyBody(fixture.input, fixture.body), [
    nodeViolation("member-origin", 3, "member selection does not retain a real member key and its actual declared origins"),
    nodeViolation("member-origin", 6, "member selection does not retain a real member key and its actual declared origins"),
  ]);
});

for (const [name, position] of [["parametric", 0], ["bound-string", 1], ["bound-int32", 2]]) {
  test(`actual ${name} instance selects its own same-node property association and receiver context`, () => {
    const fixture = genericObjectScenario();
    const body = [fixture.functionTemplate, ...fixture.instances][position];
    assertCompleteValue(verifyBody(fixture.inputFor(body), body), []);
    assertCompleteValue(fixture.queries, [{ instance: fixture.facts[position].instance, occurrence: { kind: "selection", node: 10, ordinal: 0 } }]);
    assert.equal(fixture.facts[position].table.receiver, position + 5);
    assert.equal(fixture.facts[position].table.members[0].read, position + 1);
  });
}

test("same authored node and body under another bound environment do not satisfy memberTableOf", () => {
  const fixture = genericObjectScenario();
  const body = fixture.instances[0];
  fixture.facts[1].instance = { body: fixture.functionBody, bindings: fixture.instances[1].bindings };
  assertCompleteValue(verifyBody(fixture.inputFor(body), body), [nodeViolation("member-origin", 10,
    "member selection does not retain a real member key and its actual declared origins")]);
});

test("an owner change cannot authenticate itself through unchanged body and template keys", () => {
  const body = emptyModuleBody();
  const input = emptyVerificationInput(body);
  body.owner = "D[M[P[p];m];foreign]";
  assertCompleteValue(verifyBody(input, body), [
    bodyViolation("body-owner", "body identity and owner do not retain the actual original body"),
    bodyViolation("nested-template-identity", "published template is not the authentic body's canonical shared module subtree"),
    bodyViolation("cross-owner-qualified", "definition reference does not name an actual declaration"),
    bodyViolation("binding-vector-complete", "binding environment does not retain its genuine declaration scope"),
  ]);
});

test("the actual source module remains authoritative for typed publication identity", () => {
  const body = emptyModuleBody();
  const input = emptyVerificationInput(body);
  input.module.module = "M[P[p];other]";
  assertCompleteValue(verifyBody(input, body), [nodeViolation("module-node-identity", 0,
    "body does not retain its module identity and canonical parametric subtree")]);
});

test("an equal-looking copy is not the shared canonical parametric module subtree", () => {
  const body = emptyModuleBody();
  const input = emptyVerificationInput(body);
  body.root = structuredClone(body.root);
  assertCompleteValue(verifyBody(input, body), [
    nodeViolation("module-node-identity", 0, "body does not retain its module identity and canonical parametric subtree"),
    bodyViolation("nested-template-identity", "published template is not the authentic body's canonical shared module subtree"),
  ]);
});

test("a duplicate canonical publication is rejected even when both entries are the exact same object", () => {
  const body = emptyModuleBody();
  const input = emptyVerificationInput(body);
  input.module.bodies.push(body);
  assertCompleteValue(verifyBody(input, body), [
    bodyViolation("template-shared-once", "canonical publication contains a duplicate artifact key or does not contain the selected body exactly once"),
    bodyViolation("template-shared-once", "actual source body has more than one canonical parametric template"),
  ]);
});

test("an instantiated publication cannot replace its required authentic parametric template", () => {
  const body = emptyModuleBody();
  body.bindings = { kind: "instantiated", bindings: emptyBindings() };
  const input = emptyVerificationInput(body, [], 3);
  assertCompleteValue(verifyBody(input, body), [
    bodyViolation("template-shared-once", "actual source body has no canonical parametric template in the publication"),
    nodeViolation("nested-template-identity", 0, "typed template does not retain its real authored body and shared syntax identity"),
  ]);
});

test("canonical template order retains the actual source body's publication order", () => {
  const fixture = genericFunctionScenario();
  fixture.module.bodies = [fixture.functionTemplate, fixture.outer, ...fixture.instances];
  assertCompleteValue(verifyBody(fixture.inputFor(fixture.outer), fixture.outer), [bodyViolation("stable-order",
    "canonical template publication does not retain actual source body order")]);
});

test("the closed typed body graph cannot invent a missing completion type reference", () => {
  const body = emptyModuleBody();
  body.completion = 99;
  assertCompleteValue(verifyBody(emptyVerificationInput(body), body), [bodyViolation("type-closed",
    "typed reference does not reach a present closed type/signature graph")]);
});

test("a genuine recursive type reference graph is closed without an invented verifier depth budget", () => {
  const body = emptyModuleBody();
  body.completion = 1;
  const input = emptyVerificationInput(body);
  input.types.terms.push({ kind: "array", element: 1, readonly: false });
  assertCompleteValue(verifyBody(input, body), []);
});

for (const term of [
  { kind: "literal", value: { kind: "number", value: { numerator: 1n, denominator: 1n, negativeZero: false } }, base: 1 },
  { kind: "union", members: [0, 1] },
  { kind: "intersection", members: [0, 1] },
  { kind: "optional", value: 0 },
  { kind: "fixed-array", element: 1, extent: { length: 9007199254740993n, runtimeBase: "bigint" } },
  { kind: "tuple", elements: [
    { kind: "required", type: 1, declaration: null }, { kind: "optional", type: 1, declaration: null },
    { kind: "rest", type: 1, declaration: null },
  ], readonly: false },
  { kind: "shape", members: [{ key: { kind: "text", value: "value" },
    origins: [{ kind: "declared", declaration: ownerId }], readOrigins: [{ kind: "declared", declaration: ownerId }],
    writeOrigins: [{ kind: "declared", declaration: ownerId }], kind: "property", read: 1, write: 1, optional: false, readonly: false }],
  indexes: [{ origin: { kind: "item", value: { owner: ownerId, node: 0 } }, key: 0, read: 1, write: 1, readonly: false }], calls: [0], constructs: [1] },
  { kind: "callable", calls: [0], constructs: [1] },
  { kind: "declared", definition: "D[M[P[core];types];Container]", arguments: [1], facet: "instance", extent: null },
  { kind: "enum", definition: "D[M[P[core];types];Choice]" },
  { kind: "param", parameter: typeParameterDeclaration(ownerId, 0) },
  { kind: "self", owner: ownerId },
  { kind: "projection", source: 0, projection: { kind: "awaited" } },
]) {
  test(`the real closed table ${term.kind} arm retains every referenced type/signature edge`, () => {
    const body = emptyModuleBody();
    body.completion = 2;
    const input = emptyVerificationInput(body);
    input.types.terms.push({ kind: "primitive", primitive: "int32" }, term);
    input.types.signatures.push({ ...input.types.signatures[0], id: 1, kind: "construct" });
    const nominals = new Map([
      ["D[M[P[core];types];Container]", { kind: "declared", facets: ["instance", "value"] }],
      ["D[M[P[core];types];Choice]", { kind: "enum", facets: ["instance", "value"] }],
    ]);
    input.nominalOf = definition => nominals.get(definition) ?? null;
    assertCompleteValue(verifyBody(input, body), []);
  });
}

test("an actual construction-reference reaches its real array-pattern source without inventing an element node", () => {
  const fixture = memberScenario("construction");
  fixture.input.types.terms.push({ kind: "construction-reference", definition: { occurrence: { body: bodyId, node: 2 }, captures: [] }, arguments: [0] });
  fixture.body.completion = fixture.input.types.terms.length - 1;
  assertCompleteValue(verifyBody(fixture.input, fixture.body), []);
});

test("the closed signature graph includes its real receiver, parameter, constraint, default and composition edges", () => {
  const body = emptyModuleBody();
  body.signature = 1;
  const input = emptyVerificationInput(body);
  input.types.signatures.push({ id: 1, declaration: ownerId,
    owner: { kind: "body", value: { body: bodyId, node: 0 } }, composition: { kind: "intersection", signatures: [0] },
    kind: "call", typeParameters: [{ declaration: typeParameterDeclaration(ownerId, 0), constraint: 0, default: 0 }],
    receiver: 0, parameters: [{ declaration: ownerId, kind: "required", type: 0, passing: "by-value", initializer: null, acceptsOmission: false }], result: 0 });
  assertCompleteValue(verifyBody(input, body), []);
});

test("an actual open producer variable cannot become a closed TIR completion endpoint", () => {
  const body = emptyModuleBody();
  body.completion = 1;
  const input = emptyVerificationInput(body);
  input.types.terms.push({ kind: "open", group: `G[${bodyId}]`, variable: 0 });
  assertCompleteValue(verifyBody(input, body), [bodyViolation("type-closed",
    "typed reference does not reach a present closed type/signature graph")]);
});

test("a reachable actual error type requires the current matching source error diagnostic", () => {
  const body = emptyModuleBody();
  body.completion = 1;
  const input = emptyVerificationInput(body);
  input.types.terms.push({ kind: "error" });
  assertCompleteValue(verifyBody(input, body), [bodyViolation("error-diagnostic",
    "error type is not accompanied by an actual error diagnostic at its source origin")]);
  input.diagnostics.push({ code: { kind: "checker", number: 999, rendered: "TS999" }, severity: "error",
    site: { kind: "source", origin: origin() }, source: null, evidence: [], message: "actual source error",
    arguments: [], related: [], fix: null });
  assertCompleteValue(verifyBody(input, body), []);
});

test("a real outer capture retains its actual foreign-local existence boundary", () => {
  const body = emptyModuleBody();
  const input = emptyVerificationInput(body);
  const capture = { body: "B[D[M[P[foreign];source];f];function;0]", local: 0 };
  body.captures = [{ local: capture, capture: "captured-location" }];
  input.source.bodies[0].captures = [capture];
  assertCompleteValue(verifyBody(input, body), [bodyViolation("cross-owner-qualified",
    "local reference does not name an actual local in its declared body")]);
  input.localExists = reference => reference.body === capture.body && reference.local === 0;
  assertCompleteValue(verifyBody(input, body), []);
});

test("an enclosing body cannot claim the evidence occurrence of its genuine nested body", () => {
  const fixture = genericFunctionScenario();
  fixture.outer.evidence = [{ ...typeEvidence({ kind: "dynamic" }),
    component: { kind: "body", value: { body: bodyId, node: 9 } } }];
  assertCompleteValue(verifyBody(fixture.inputFor(fixture.outer), fixture.outer), [
    bodyViolation("cross-owner-qualified", "source reference does not name an actual node in its declared owner"),
    bodyViolation("node-reference", "qualified node does not name an actual node in its declared body"),
    bodyViolation("nested-boundary", "body evidence crosses an authentic nested-body root or leaves its own body subtree"),
    bodyViolation("evidence-reference", "type verifier: cross-owner-qualified"),
    bodyViolation("evidence-reference", "body evidence does not select an occurrence in its actual own-body boundary"),
  ]);
});

test("nullable authored callable-body presence is structural, not a missing-required-field fabrication", () => {
  const fixture = genericFunctionScenario();
  fixture.functionTemplate.root.body = null;
  assertCompleteValue(verifyBody(fixture.inputFor(fixture.functionTemplate), fixture.functionTemplate), [
    nodeViolation("kind-children-shape", 2, "typed syntax does not retain the authored kind, fields and child presence"),
  ]);
});

test("nonfinite or reversed actual source intervals are not retained as valid geometry", () => {
  const body = emptyModuleBody();
  const input = emptyVerificationInput(body);
  body.root.endOfFileToken.loc.end = -1;
  assertCompleteValue(verifyBody(input, body), [nodeViolation("origin-range", 1,
    "typed origin or lexical range does not retain the actual source interval")]);
});

test("a present but wrong parent is distinct from an absent node reference", () => {
  const body = emptyModuleBody();
  const input = emptyVerificationInput(body);
  body.root.endOfFileToken.parent = 1;
  assertCompleteValue(verifyBody(input, body), [nodeViolation("parent-reference", 1,
    "typed node parent differs from the real authored parent")]);
});

test("a missing parent retains both genuine parent-preservation and node-reference findings", () => {
  const body = emptyModuleBody();
  const input = emptyVerificationInput(body);
  body.root.endOfFileToken.parent = 99;
  assertCompleteValue(verifyBody(input, body), [
    nodeViolation("parent-reference", 1, "typed node parent differs from the real authored parent"),
    nodeViolation("node-reference", 1, "node identity does not name an actual node in its module arena"),
  ]);
});

test("internally consistent renumbering still retains every authored-identity and inserted-node finding", () => {
  const body = emptyModuleBody();
  const input = emptyVerificationInput(body);
  body.root.endOfFileToken.id = 2;
  assertCompleteValue(verifyBody(input, body), [
    nodeViolation("authored-node-ids-preserved", 2, "typed node identity differs from the actual authored node at this position"),
    nodeViolation("no-inserted-nodes", 2, "typed syntax includes a node not present in the actual source arena"),
    nodeViolation("node-in-body-range", 2, "typed syntax contains a real or invented node outside its actual original body subtree"),
    nodeViolation("node-reference", 2, "node identity does not name an actual node in its module arena"),
  ]);
});

for (const shared of [false, true]) {
  test(`the genuine ${shared ? "shared" : "distinct"} authored sibling identities preserve their exact arena association`, () => {
    const fixture = siblingIdentityScenario(shared, shared);
    assertCompleteValue(verifyBody(fixture.input, fixture.body), []);
  });
}
test("one typed arena node cannot collapse two different authentic authored sibling identities", () => {
  const fixture = siblingIdentityScenario(false, true);
  assertCompleteValue(verifyBody(fixture.input, fixture.body), [nodeViolation("authored-node-ids-preserved", 1,
    "typed node identity differs from the actual authored node at this position")]);
  fixture.body.root.statements.nodes[1] = readyStatement({ ...fixture.second });
  assertCompleteValue(verifyBody(fixture.input, fixture.body), []);
});
test("two typed arena objects cannot replace one actually shared authored sibling", () => {
  const fixture = siblingIdentityScenario(true, false);
  assertCompleteValue(verifyBody(fixture.input, fixture.body), [
    nodeViolation("module-node-identity", 1, "chapter has conflicting authored occurrences"),
    nodeViolation("no-inserted-nodes", 1, "typed syntax duplicates an actual authored arena node"),
  ]);
  fixture.body.root.statements.nodes[1] = readyStatement(fixture.firstTyped);
  assertCompleteValue(verifyBody(fixture.input, fixture.body), []);
});

test("closed nested phase records reject checker views at their text boundary", () => {
  const original = readFileSync(resolve(repository, functionDirectory, "empty-module.input.tir"), "utf8");
  const position = original.lastIndexOf("selfBindings=[]") + "selfBindings=[]".length;
  const text = original.slice(0, position) + ", views=null" + original.slice(position);
  assertInvalidText(text, position + 2, ["end of record"], "views");
  assertBodyRoundTrip(emptyModuleBody(), original, "closed nested binding record keeps every declared field");
});

test("closed nested phase records reject the first undeclared field without accepting later extras", () => {
  const original = readFileSync(resolve(repository, functionDirectory, "empty-module.input.tir"), "utf8");
  const position = original.lastIndexOf("selfBindings=[]") + "selfBindings=[]".length;
  for (const names of [["aaa", "zzz"], ["zzz", "aaa"]]) {
    const text = original.slice(0, position) + names.map(name => `, ${name}="extra"`).join("") + original.slice(position);
    assertInvalidText(text, position + 2, ["end of record"], names[0]);
  }
});

test("local dense identity and actual local-slot existence remain distinct full-vector checks", () => {
  const fixture = genericFunctionScenario();
  const body = fixture.functionTemplate;
  body.locals[0].id = 1;
  assertCompleteValue(verifyBody(fixture.inputFor(body), body), [
    bodyViolation("local-dense", "local records are not dense in their actual body order", fixture.functionBody),
    bodyViolation("local-storage", "local identity does not select a real local storage slot", fixture.functionBody),
  ]);
});

test("a formal's actual finalized storage cannot disagree with its genuine local slot", () => {
  const fixture = genericFunctionScenario();
  const body = fixture.functionTemplate;
  body.params[0].tsonic.storage = 2;
  assertCompleteValue(verifyBody(fixture.inputFor(body), body), [
    bodyViolation("local-storage", "parameter storage does not retain its real local slot", fixture.functionBody),
    nodeViolation("binding-storage", 5, "binding occurrence does not retain its actual qualified local storage slot"),
  ]);
});

test("the authored Parameter occurrence must retain the actual body-local storage association", () => {
  const fixture = genericFunctionScenario();
  const body = fixture.functionTemplate;
  body.root.parameters.nodes[0].tsonic.storage = 2;
  assertCompleteValue(verifyBody(fixture.inputFor(body), body), [
    bodyViolation("local-storage", "parameter storage does not retain its real local slot", fixture.functionBody),
    nodeViolation("binding-storage", 5, "binding occurrence does not retain its actual qualified local storage slot"),
  ]);
});

test("a type-correct formal role change does not retain the original parameter inventory", () => {
  const fixture = genericFunctionScenario();
  const body = fixture.functionTemplate;
  body.params[0].tsonic.role = "optional";
  assertCompleteValue(verifyBody(fixture.inputFor(body), body), [
    bodyViolation("parameter-order", "parameter records do not retain the actual declared formal order", fixture.functionBody),
    nodeViolation("parameter-order", 5, "parameter occurrence does not retain its actual declared formal and local association"),
  ]);
});

for (const defect of ["missing", "foreign-kind", "foreign-node", "foreign-owner", "foreign-parent", "missing-local"]) {
  test(`selected formal headers require the genuine checked item association: ${defect}`, () => {
    const fixture = genericFunctionScenario();
    const body = fixture.functionTemplate;
    const input = fixture.inputFor(body);
    const original = input.nodeOf;
    const source = fixture.originalFunction.locals[0].declaration;
    const checked = original(source);
    if (defect === "foreign-owner") source.value.owner = fixture.definition;
    else if (defect === "missing-local") fixture.originalFunction.locals = [];
    else input.nodeOf = reference => reference.kind === "item" && reference.value.owner === fixture.valueDefinition
      ? defect === "missing" ? null : defect === "foreign-kind" ? fixture.checkedFunction
        : defect === "foreign-node" ? { ...checked, id: checked.id + 100 }
          : { ...checked, tsonic: { ...checked.tsonic, parent: fixture.valueDefinition } }
      : original(reference);
    const findings = verifyBody(input, body);
    assert.equal(findings.some(value => value.rule === "parameter-order"), true, defect);
  });
}

test("a duplicate selected header has no invented second checked formal", () => {
  const fixture = genericFunctionScenario();
  const body = fixture.functionTemplate;
  body.params = [body.params[0], body.params[0]];
  assert.equal(verifyBody(fixture.inputFor(body), body).some(value => value.rule === "parameter-order"), true);
});

test("a parametric body reuses its exact canonical selected header rather than a detached equal copy", () => {
  const fixture = genericFunctionScenario();
  const body = fixture.functionTemplate;
  assertCompleteValue(verifyBody(fixture.inputFor(body), body), []);
  const canonical = body.params[0];
  body.params = [structuredClone(canonical)];
  assert.equal(verifyBody(fixture.inputFor(body), body).some(value => value.rule === "module-node-identity"), true);
  body.params = [canonical];
  assertCompleteValue(verifyBody(fixture.inputFor(body), body), []);
});

test("binding verification reads only the actual owning formal inventory, not unrelated checked bodies", async () => {
  const { loadFrontFixture } = await import("./fixtures/front/checked-module.mjs");
  const { verifyBindingSlots } = await import("../../packages/host/dist/ir-tir/verify-instances.js");
  const { walkSyntaxTree } = await import("../../packages/host/dist/ir-hir/index.js");
  const producer = await loadFrontFixture();
  const unrelated = producer.checkedModuleOf(Array.from({ length: 16 }, (_, index) =>
    `export function unrelated${index}(value: number): number { return value; }`).join("\n")).checked;
  const fixture = genericFunctionScenario();
  const body = fixture.functionTemplate;
  const input = fixture.inputFor(body);
  const sources = new Map(input.source.bodies.map(source => [source.body, source]));
  for (const source of unrelated.bodies) {
    sources.set(source.body, source);
    Object.defineProperty(source, "params", { get: () => assert.fail("an unrelated checked formal inventory was read") });
  }
  const actual = fixture.originalFunction.params;
  let reads = 0;
  Object.defineProperty(fixture.originalFunction, "params", { get: () => { reads++; return actual; } });
  const findings = [];
  const emit = (rule, node, detail) => findings.push({ rule, node: node?.id ?? null, detail });
  const structure = structureOf(body);
  verifyBindingSlots(body, structure, fixture.functionNodes, sources, input.module.bodies, input.bodyOf, input.nodeOf, emit, admitFixtureRead());
  assert.deepEqual(findings, []);
  assert.equal(reads, 1, "the same ready owning parameter row inventory is indexed once");
  sources.delete(body.body);
  verifyBindingSlots(body, structure, fixture.functionNodes, sources, input.module.bodies, input.bodyOf, input.nodeOf, emit, admitFixtureRead());
  assert.equal(findings.some(value => value.rule === "parameter-order"), true,
    "a missing owning inventory is not silently accepted as a parameter match");
});

test("capture binding verification indexes each demanded owner's formal local relation once", async () => {
  const { verifyBindingSlots } = await import("../../packages/host/dist/ir-tir/verify-instances.js");
  const { encodeDefId } = await import("../../packages/host/dist/ids/index.js");
  for (const count of [8, 64, 256]) {
    const fixture = genericFunctionScenario();
    const body = fixture.functionTemplate;
    const input = fixture.inputFor(body);
    const outer = input.source.bodies.find(source => source.body === bodyId);
    let localReads = 0;
    let inventoryReads = 0;
    const formals = Array.from({ length: count }, (_, index) => ({
      get local() { localReads++; return index; }, declaration: encodeDefId({ module: moduleId,
        segments: [{ name: `formal${index}`, ordinal: 0 }] }), role: "required",
      passing: index % 2 === 0 ? "borrow-mut" : "by-value", initializer: null,
    }));
    outer.locals = Array.from({ length: count + 2 }, (_, index) => ({ id: index,
      declaration: { kind: "body", value: { body: bodyId, node: 0 } }, name: `p${index}`,
      role: index === count + 1 ? "capture" : "parameter", checkerSlot: available(0), capturedFrom: null, mutable: false }));
    Object.defineProperty(outer, "params", { get: () => { inventoryReads++; return formals; } });
    const captures = outer.locals.map(local => ({ body: bodyId, local: local.id }));
    fixture.checkedFunction.tsonic.captures = captures;
    const evidence = { type: 3, component: { kind: "body", value: { body: body.body, node: body.root.id } },
      category: { kind: "known", category: "number" }, numeric: null, sum: null, nominal: null, pointer: null };
    const saved = captures.map((local, index) => ({ local, value: evidence, reassignable: false,
      incoming: index < count ? { kind: "parameter", passing: formals[index].passing }
        : index === count ? { kind: "binding" } : { kind: "parameter", passing: "move" } }));
    const deferred = captures => ({ kind: "deferred", deferred: { result: 4, invocation: { rule: "closure", input: {
      context: { occurrence: { body: body.body, node: body.root.id }, origin: origin(), bindings: body.lexicalBindings },
      callable: { ...evidence, type: 4, category: { kind: "known", category: "callable" } }, captures } } } });
    body.root.tsonic.closure = deferred(saved);
    const findings = [];
    const emit = (rule, node) => findings.push({ rule, node: node?.id ?? null });
    const sources = new Map(input.source.bodies.map(source => [source.body, source]));
    verifyBindingSlots(body, structureOf(body), fixture.functionNodes, sources, input.module.bodies, input.bodyOf, input.nodeOf, emit, admitFixtureRead());
    assert.deepEqual(findings, []);
    assert.equal(inventoryReads, 1, "all captured formals borrow the same actual demanded-owner inventory");
    assert.equal(localReads, count * 2, "one formal index read and one exact local match per captured formal");
    for (const index of [count - 1, count]) {
      findings.length = 0;
      body.root.tsonic.closure = deferred(saved.map((capture, position) => position === index
        ? { ...capture, incoming: position === count ? { kind: "parameter", passing: "by-value" } : { kind: "binding" } } : capture));
      verifyBindingSlots(body, structureOf(body), fixture.functionNodes, sources, input.module.bodies, input.bodyOf, input.nodeOf, emit, admitFixtureRead());
      assert.equal(findings.some(finding => finding.rule === "closure-capture-binding"), true,
        "a pattern-bound child remains its own binding and a real formal retains its exact passing evidence");
    }
    findings.length = 0;
    body.root.tsonic.closure = deferred(saved.map((capture, index) => index === 0
      ? { ...capture, local: { ...capture.local, local: -0 }, incoming: { kind: "parameter", passing: "move" } } : capture));
    verifyBindingSlots(body, structureOf(body), fixture.functionNodes, sources, input.module.bodies, input.bodyOf, input.nodeOf, emit, admitFixtureRead());
    assert.equal(findings.some(finding => finding.rule === "capture-qualified"), true);
    assert.equal(findings.some(finding => finding.rule === "closure-capture-binding"), false,
      "a nonidentical local index cannot borrow another formal's passing evidence");
  }
});

test("a genuine default initializer retains syntax but not callable-body semantic ownership", () => {
  const fixture = genericFunctionScenario({ callable: 2, typeParameter: 3, typeName: 4, parameter: 5,
    parameterName: 6, block: 8, return: 9, value: 10, end: 11 });
  const body = fixture.functionTemplate;
  const input = fixture.inputFor(body);
  const defaultBody = `B[${fixture.valueDefinition};default-argument;0]`;
  const storage = fixture.types.terms.length;
  fixture.types.terms.push({ kind: "primitive", primitive: "bool" });
  const checked = { ...header(7, 5), kind: "TrueKeyword",
    tsonic: { core: emptyCore(), role: "value", value: checkedValue(storage) } };
  const selected = { ...header(7, 5), kind: "TrueKeyword",
    tsonic: { ...typedValue(storage), role: "value" } };
  fixture.checkedFunction.parameters.nodes[0].initializer = checked;
  fixture.checkedFunction.parameters.nodes[0].tsonic.declaredType = available(storage);
  fixture.checkedFunction.parameters.nodes[0].tsonic.initializer = defaultBody;
  fixture.checkedFunction.body.statements.nodes[0].expression.tsonic.value = checkedValue(storage);
  fixture.originalFunction.params[0].role = "default";
  fixture.originalFunction.params[0].initializer = defaultBody;
  fixture.originalFunction.locals[0].checkerSlot = available(storage);
  fixture.itemNodes.get(fixture.valueDefinition).set(7, checked);
  for (const callable of [body, ...fixture.instances]) {
    const parameter = callable.params[0];
    parameter.initializer = { kind: "ready-default", root: callable === body ? selected : structuredClone(selected) };
    parameter.tsonic.role = "default";
    parameter.tsonic.initializer = defaultBody;
    parameter.tsonic.storage = storage;
    parameter.name.tsonic.storage = storage;
    callable.locals[0].storage = storage;
    callable.completion = storage;
    Object.assign(callable.root.body.statements.nodes[0].expression.tsonic, typedValue(storage));
  }
  for (const signature of fixture.types.signatures.slice(1)) {
    signature.parameters[0] = { ...signature.parameters[0], kind: "default", type: storage,
      initializer: defaultBody, acceptsOmission: true };
    signature.result = storage;
  }
  const signature = fixture.types.signatures.length;
  fixture.types.signatures.push({ id: signature, declaration: fixture.valueDefinition,
    owner: { kind: "item", value: { owner: fixture.valueDefinition, node: 5 } }, composition: null,
    kind: "call", typeParameters: [], receiver: null, parameters: [], result: storage });
  const sourceDefault = { ...fixture.originalFunction, body: defaultBody, owner: fixture.valueDefinition,
    params: [], locals: [], root: checked };
  const typedDefault = { ...body, body: defaultBody, owner: fixture.valueDefinition, params: [], locals: [],
    signature, root: selected };
  input.source.bodies.splice(1, 0, sourceDefault);
  input.module.bodies.splice(1, 0, typedDefault);
  const nodeOf = input.nodeOf;
  input.nodeOf = reference => reference.kind === "body" && reference.value.body === defaultBody
    ? reference.value.node === 7 ? checked : null : nodeOf(reference);
  assertCompleteValue(verifyBody(input, body), []);
  body.evidence.push({ type: storage, component: { kind: "body", value: { body: body.body, node: 7 } },
    category: { kind: "known", category: "boolean" }, numeric: null, sum: null, nominal: null, pointer: null });
  assert.equal(verifyBody(input, body).some(value => value.rule === "nested-boundary"), true,
    "the separately owned initializer occurrence cannot be claimed as callable execution evidence");
});

test("same-body capture invention retains both qualification and original-order failures", () => {
  const fixture = genericFunctionScenario();
  const body = fixture.functionTemplate;
  body.captures.push({ local: { body: fixture.functionBody, local: 0 }, capture: "captured-location" });
  assertCompleteValue(verifyBody(fixture.inputFor(body), body), [
    bodyViolation("capture-qualified", "capture inventory does not name a real qualified outer local", fixture.functionBody),
    bodyViolation("stable-order", "capture and nested-body inventories do not retain actual source order", fixture.functionBody),
    bodyViolation("capture-rows-agree", "body capture rows do not state the outcome of the closure that creates the body", fixture.functionBody),
  ]);
});

test("placed initializer modes use the actual authored creator and qualified incoming storage without a closure value", async () => {
  const { verifyBindingSlots } = await import("../../packages/host/dist/ir-tir/verify-instances.js");
  const fixture = genericFunctionScenario();
  const outer = fixture.originalFunction;
  const initializer = `B[${fixture.valueDefinition};default-argument;0]`;
  const creator = fixture.checkedFunction.parameters.nodes[0];
  const checked = { ...header(7, creator.id), kind: "TrueKeyword",
    tsonic: { core: emptyCore(), role: "value", value: checkedValue(0) } };
  creator.initializer = checked;
  creator.tsonic.initializer = initializer;
  const root = { ...header(7, creator.id), kind: "TrueKeyword", tsonic: { ...typedValue(0), role: "value" } };
  const captured = { body: outer.body, local: outer.locals[0].id };
  const body = { ...fixture.functionTemplate, body: initializer, owner: fixture.valueDefinition, root, params: [], locals: [],
    captures: [{ local: captured, capture: "captured-location" }] };
  const input = fixture.inputFor(fixture.functionTemplate);
  const nodeOf = input.nodeOf;
  const originals = new Map([[root.id, checked], [creator.id, creator]]);
  const sources = new Map([[outer.body, outer]]);
  const verify = () => {
    const findings = [];
    verifyBindingSlots(body, structureOf(body), originals, sources, input.module.bodies, input.bodyOf, input.nodeOf,
      (rule, node) => findings.push({ rule, node: node?.id ?? null }), admitFixtureRead());
    return findings;
  };
  assert.deepEqual(verify(), []);
  body.captures[0].capture = "captured-value";
  assert.equal(verify().some(row => row.rule === "closure-capture-binding"), true);
  outer.locals[0].mutable = false;
  assert.deepEqual(verify(), []);
  outer.params[0].passing = "byref-readwrite";
  assert.equal(verify().some(row => row.rule === "closure-capture-binding"), true);
  body.captures[0].capture = "captured-location";
  assert.deepEqual(verify(), []);
  const previous = outer.locals[0];
  outer.locals[0] = { ...previous, role: "capture", capturedFrom: { body: fixture.outer.body, local: 0 } };
  assert.deepEqual(checkTirAdmissionCuts(admitFixtureRead, (admit, read) =>
    verifyBindingSlots(body, structureOf(body), originals, sources, input.module.bodies, input.bodyOf,
      reference => { read("nodeOf"); return input.nodeOf(reference); },
      (_rule, _node, detail) => assert.fail(detail), admit)), ["nodeOf"]);
  outer.locals[0] = previous;
  input.nodeOf = () => null;
  assert.equal(verify().some(row => row.rule === "capture-qualified"), true);
  input.nodeOf = nodeOf;
  creator.tsonic.initializer = null;
  assert.equal(verify().some(row => row.rule === "capture-qualified"), true);
  creator.tsonic.initializer = initializer;
  creator.initializer = null;
  assert.equal(verify().some(row => row.rule === "capture-qualified"), true);
});

for (const form of ["whole", "empty", "unknown", "values", "empty-rest", "optional", "default"]) {
  test(`actual argument/formal transport retains the complete ${form} disposition`, () => {
    const fixture = argumentScenario(form);
    assertCompleteValue(verifyBody(fixture.input, fixture.body), []);
    if (form === "whole") {
      assertCompleteValue(fixture.parts, [{ kind: "spread", expression: 5, tuple: [2, 2] }]);
      assertCompleteValue(fixture.decision.parameters, [
        { kind: "argument", parameter: 0, argument: 0, component: 0, passing: "by-value" },
        { kind: "rest", parameter: 1, arguments: [0], passing: "by-value" },
      ]);
      assert.equal(fixture.call.arguments.nodes[0].expression.kind, "Identifier");
    }
    if (form === "empty") assertCompleteValue(fixture.parts, [{ kind: "spread", expression: 5, tuple: [] }]);
    if (form === "unknown") assertCompleteValue(fixture.parts, [{ kind: "spread", expression: 5, tuple: null }]);
  });
}

test("the actual omitted default initializer has one separate canonical publication query", () => {
  const fixture = argumentScenario("default");
  const publication = fixture.input.bodyOf;
  const queries = [];
  fixture.input.bodyOf = instance => { queries.push(instance); return publication(instance); };
  assertCompleteValue(verifyBody(fixture.input, fixture.body), []);
  assertCompleteValue(queries, [{ body: "B[D[M[P[api];collections];f/default];default-argument;0]", bindings: { kind: "parametric" } }]);
});
test("a real missing omitted-initializer publication is not replaced by the calling body's own record", () => {
  const fixture = argumentScenario("default");
  fixture.input.bodyOf = () => null;
  assertCompleteValue(verifyBody(fixture.input, fixture.body), [nodeViolation("nested-instance-key", 2,
    "instance does not select a real canonical body with the complete artifact environment")]);
});

test("overloaded zero-argument calls retain the actual optional, default and empty-rest API slot", () => {
  for (const form of ["optional", "default", "empty-rest"]) {
    const fixture = argumentScenario(form);
    const advertisedId = fixture.input.types.signatures.length;
    fixture.input.types.signatures.push({ ...fixture.input.types.signatures[1], id: advertisedId, parameters: [] });
    fixture.decision.advertised.signature = advertisedId;
    fixture.captured.resolvedSignature.value = advertisedId;
    fixture.input.source.bodies[0].candidateLists[0].candidates[0].appliedSignature.value = advertisedId;
    fixture.input.types.terms[1].calls = [advertisedId];
    assertCompleteValue(verifyBody(fixture.input, fixture.body), [], `${form}: implementation formals, not overload arity, own transport`);
    fixture.decision.parameters = [];
    assertCompleteValue(verifyBody(fixture.input, fixture.body), [
      nodeViolation("argument-total", 2, "application dispositions are not total over the real API formals and receiver"),
    ], `${form}: decision and transport report the same complete public finding once through the existing exact-key emitter`);
  }
});

function parameterCodecFixture(passing, role, initializer, localRecord) {
  const body = emptyModuleBody();
  const local = { body: bodyId, local: 0 };
  const name = role === "this" ? "this" : "formal";
  const value = { ...header(4, 2), kind: "NullKeyword", tsonic: { ...typedValue(), role: "value" } };
  body.params = [{ ...header(2, 99), kind: "Parameter", modifiers: null, dotDotDotToken: null,
    name: { ...header(3, 2), kind: "Identifier", text: name,
      tsonic: { role: "declaration-name", declaration: { kind: "local", local }, storage: 0 } },
    questionToken: null, type: null, initializer: initializer === null ? { kind: "none" } : { kind: "ready-default", root: value },
    tsonic: { local, declaration: ownerId, role, passing, initializer, storage: 0 } }];
  const shift = initializer === null ? 2 : 3;
  const [bodyHeader, , , rootDefinition, endDefinition] = readFileSync(resolve(repository, functionDirectory, "empty-module.input.tir"), "utf8").split("\n");
  let frame = bodyHeader.replace("params=[]", "params=[n:0]").replace("root=n:0", `root=n:${shift}`);
  const rootWire = rootDefinition.replace(/^n:0=/u, `n:${shift}=`).replace("endOfFileToken=n:1", `endOfFileToken=n:${shift + 1}`);
  const endWire = endDefinition.replace(/^n:1=/u, `n:${shift + 1}=`);
  if (localRecord) {
    body.locals = [{ id: 0, declaration: { kind: "item", value: { owner: ownerId, node: 2 } },
      name, role: "parameter", capturedFrom: null, mutable: true, storage: 0 }];
    frame = frame.replace("locals=[]", `locals=[TirLocal(id=l:0, declaration=item(value=ItemNodeRef(owner=def:"${ownerId}", node=n:2)), ` +
      `name="${name}", role="parameter", capturedFrom=null, mutable=true, storage=t:0)]`);
  }
  const definitions = [
    `n:0=TirFormal(${syntaxHeaderWire(2, 99)}, modifiers=null, dotDotDotToken=null, name=n:1, questionToken=null, type=null, ` +
      `initializer=${initializer === null ? "none()" : "ready-default(root=n:2)"}, tsonic=TypedParameter(declaration=def:"${ownerId}", local=${localWire}, storage=t:0, ` +
      `passing="${passing}", initializer=${initializer === null ? "null" : `body:"${initializer}"`}, role="${role}"))`,
    `n:1=Identifier(${syntaxHeaderWire(3, 2)}, text="${name}", tsonic=TypedName(role="declaration-name", declaration=local(local=${localWire}), storage=t:0))`,
  ];
  if (initializer !== null) definitions.push(`n:2=NullKeyword(${syntaxHeaderWire(4, 2)}, tsonic=TypedKeyword(${valueWire}, role="value"))`);
  return { body, expected: typedWire(frame, [...definitions, rootWire, endWire]) };
}

for (const passing of ["by-value", "byref-readonly", "byref-readwrite", "byref-writeonly-must-init", "borrow-shared", "borrow-mut", "move"]) {
  test(`closed API/formal/actual argument transport retains ${passing} without a passing-mode guess`, () => {
    const fixture = argumentScenario("unknown", passing);
    assertCompleteValue(verifyBody(fixture.input, fixture.body), []);
    assert.equal(fixture.decision.parameters[0].passing, passing);
    assert.equal(fixture.parameters[0].passing, passing);
  });
  test(`the complete formal/storage codec retains passing mode ${passing}`, () => {
    const { body, expected } = parameterCodecFixture(passing, "required", null, true);
    assertBodyRoundTrip(body, expected, passing);
  });
}

for (const role of ["required", "optional", "default", "rest", "this"]) {
  test(`every formal record role ${role} has an independently framed complete codec value`, () => {
    const initializer = role === "default" ? "B[D[M[P[p];m];formal];default-argument;0]" : null;
    const { body, expected } = parameterCodecFixture("by-value", role, initializer, false);
    assertBodyRoundTrip(body, expected, role);
  });
}

for (const role of ["parameter", "binding", "capture", "catch"]) {
  test(`every local ${role} record preserves capture ownership, mutability and finalized storage`, () => {
    const body = emptyModuleBody();
    const capturedFrom = role === "capture" ? { body: "B[D[M[P[p];m];outer];function;0]", local: 7 } : null;
    body.locals = [{ id: 0, declaration: { kind: "item", value: { owner: ownerId, node: 0 } },
      name: "local", role, capturedFrom, mutable: role !== "catch", storage: 0 }];
    const expected = readFileSync(resolve(repository, functionDirectory, "empty-module.input.tir"), "utf8")
      .replace("locals=[]", `locals=[TirLocal(id=l:0, declaration=item(value=ItemNodeRef(owner=def:"${ownerId}", node=n:0)), ` +
        `name="local", role="${role}", capturedFrom=${capturedFrom === null ? "null" :
          'LocalRef(body=body:"B[D[M[P[p];m];outer];function;0]", local=l:7)'}, mutable=${role !== "catch"}, storage=t:0)]`);
    assertBodyRoundTrip(body, expected, role);
  });
}

test("missing real parameter dispositions retain the full argument-total finding", () => {
  const fixture = argumentScenario();
  fixture.application.arguments = [];
  assertCompleteValue(verifyBody(fixture.input, fixture.body), [nodeViolation("argument-total", 2,
    "application dispositions are not total over the real API formals and receiver")]);
});

test("a provided disposition cannot silently select another actual formal ordinal", () => {
  const fixture = argumentScenario();
  fixture.application.arguments[0].parameter = 1;
  assertCompleteValue(verifyBody(fixture.input, fixture.body), [nodeViolation("argument-parameter-order", 2,
    "argument and mapping parameters do not retain formal order")]);
});

test("a mapping passing mismatch is not repaired from the actual captured argument mode", () => {
  const fixture = argumentScenario();
  fixture.decision.parameters[0].passing = "move";
  assertCompleteValue(verifyBody(fixture.input, fixture.body), [nodeViolation("argument-passing", 2,
    "argument mapping does not retain the formal passing mode")]);
});

test("optional absence is not an empty-rest disposition", () => {
  const fixture = argumentScenario("optional");
  fixture.application.arguments[0].value = { kind: "empty-rest" };
  assertCompleteValue(verifyBody(fixture.input, fixture.body), [nodeViolation("omission-valid", 2,
    "omission does not match the selected capability, default initializer or rest formal")]);
});

test("ordinary/rest/spread parts retain their actual authored evaluation order", () => {
  const fixture = argumentScenario("values");
  fixture.application.arguments[0].parts = [fixture.parts[2], fixture.parts[1], fixture.parts[0]];
  assertCompleteValue(verifyBody(fixture.input, fixture.body), [nodeViolation("authored-order-preserved", 2,
    "argument transport does not retain the original authored argument sequence")]);
});

test("a known empty authored spread cannot become an unknown tuple", () => {
  const fixture = argumentScenario("empty");
  fixture.parts[0].tuple = null;
  assertCompleteValue(verifyBody(fixture.input, fixture.body), [nodeViolation("empty-spread-preserved", 2,
    "authored empty spread is not retained in the whole spread tuple and rest source indices")]);
});

test("dropping an empty spread retains both actual transport and empty-source findings", () => {
  const fixture = argumentScenario("empty");
  fixture.application.arguments[0].parts = [];
  assertCompleteValue(verifyBody(fixture.input, fixture.body), [
    nodeViolation("authored-order-preserved", 2, "argument transport does not retain the original authored argument sequence"),
    nodeViolation("empty-spread-preserved", 2, "authored empty spread is not retained in the whole spread tuple and rest source indices"),
  ]);
});

test("several real tuple components join once to their retained whole rest spread", () => {
  const fixture = argumentScenario("whole");
  const call = fixture.body.root.statements.nodes[0].node.expression;
  const application = call.tsonic.application.decision;
  const decision = application.callee.decision;
  const signature = fixture.input.types.signatures[1];
  const rest = signature.parameters[1];
  signature.parameters = [signature.parameters[0], { ...signature.parameters[0], declaration: "D[M[P[api];collections];f/head2]" }, rest];
  decision.parameters = [decision.parameters[0], { kind: "argument", parameter: 1, argument: 0, component: 1, passing: "by-value" },
    { kind: "rest", parameter: 2, arguments: [0], passing: "by-value" }];
  application.arguments = [application.arguments[0], { kind: "provided", parameter: 1, expression: 5 },
    { ...application.arguments[1], parameter: 2 }];
  assertCompleteValue(verifyBody(fixture.input, fixture.body), []);
  decision.parameters[0].component = 1;
  decision.parameters[1].component = 0;
  assertCompleteValue(verifyBody(fixture.input, fixture.body), [nodeViolation("authored-order-preserved", 2,
    "argument transport does not retain the original authored argument sequence")]);
});

for (const disposition of ["true", "false", "dynamic"]) {
  test(`actual ${disposition} conditional branches retain their own selected/never demand contexts`, () => {
    const fixture = conditionalScenario(disposition);
    assertCompleteValue(verifyBody(fixture.input, fixture.body), []);
  });
}

test("a claimed control cannot replace the actual authored condition and silently repair its children", () => {
  const fixture = conditionalScenario("true");
  fixture.typed.tsonic.selection.control = 5;
  assertCompleteValue(verifyBody(fixture.input, fixture.body), [
    nodeViolation("controlled-demand", 2, "selection does not retain its authored control and branch endpoints"),
    nodeViolation("controlled-demand", 5, "demand does not retain its actual enclosing control, branch and condition"),
    nodeViolation("controlled-demand", 7, "demand does not retain its actual enclosing control, branch and condition"),
  ]);
});

test("a never-evaluated conditional branch is not an unconditional demand", () => {
  const fixture = conditionalScenario("true");
  fixture.typed.whenFalse.tsonic.demand = { kind: "always" };
  assertCompleteValue(verifyBody(fixture.input, fixture.body), [nodeViolation("controlled-demand", 7,
    "controlled branch does not retain its selected or never-evaluated demand")]);
});

test("a selected branch cannot substitute an unrelated actual control node", () => {
  const fixture = conditionalScenario();
  fixture.typed.whenTrue.tsonic.demand.control = 7;
  assertCompleteValue(verifyBody(fixture.input, fixture.body), [nodeViolation("controlled-demand", 5,
    "demand does not retain its actual enclosing control, branch and condition")]);
});

test("actual native operator endpoints retain their real lexical permission scope", () => {
  const fixture = operationScenario();
  assertCompleteValue(verifyBody(fixture.input, fixture.body), []);
});

test("missing lexical scopes retain the complete source-inventory and operation cofindings", () => {
  const fixture = operationScenario();
  const scopes = fixture.body.scopes;
  fixture.body.scopes = [];
  assertCompleteValue(verifyBody(fixture.input, fixture.body), [
    bodyViolation("permission-scope", "lexical scope inventory does not retain actual authored scope order and ownership"),
    nodeViolation("permission-scope", 2, "operation permission scope is not an actual enclosing lexical scope"),
  ]);
  fixture.body.scopes = scopes;
  assertCompleteValue(verifyBody(fixture.input, fixture.body), []);
});

test("a selected operation cannot invent a different actual occurrence result", () => {
  const fixture = operationScenario();
  fixture.operation.decision.result = 0;
  assertCompleteValue(verifyBody(fixture.input, fixture.body), [nodeViolation("operation-type", 2,
    "selected occurrence operation does not retain its value result endpoint")]);
});

test("a selected native operator retains its authored operand count and value endpoints", () => {
  const fixture = operationScenario();
  fixture.operation.decision.operands = [];
  assertCompleteValue(verifyBody(fixture.input, fixture.body), [nodeViolation("operation-type", 2,
    "selected operation does not retain the authored operand count and value endpoints")]);
});

test("an operation permission cannot select a present nonscope expression as its lexical owner", () => {
  const fixture = operationScenario();
  fixture.operation.permissionScope = 3;
  assertCompleteValue(verifyBody(fixture.input, fixture.body), [nodeViolation("permission-scope", 2,
    "operation permission scope is not an actual enclosing lexical scope")]);
});

test("a mismatched lexical permission inventory preserves both actual data and enclosing-scope failures", () => {
  const fixture = operationScenario();
  fixture.body.scopes[0].attributes.push({ declaration: ownerId, occurrence: { kind: "body", value: { body: bodyId, node: 0 } }, arguments: [] });
  assertCompleteValue(verifyBody(fixture.input, fixture.body), [
    bodyViolation("permission-scope", "lexical scope inventory does not retain actual authored scope order and ownership"),
    nodeViolation("permission-scope", 2, "operation permission scope is not an actual enclosing lexical scope"),
  ]);
});

for (const nodes of [[], [2], [2, 3], [3, 2]]) {
  test(`actual lexical attribute argument order [${nodes.join(",")}] retains the complete permission fact`, () => {
    const fixture = operationScenario();
    const attribute = () => ({ declaration: ownerId, occurrence: { kind: "body", value: { body: bodyId, node: 0 } },
      arguments: nodes.map(node => ({ kind: "body", value: { body: bodyId, node } })) });
    fixture.body.scopes[0].attributes = [attribute()];
    fixture.input.source.bodies[0].scopes[0].attributes = [attribute()];
    assertCompleteValue(verifyBody(fixture.input, fixture.body), []);
  });
}
for (const field of ["occurrence", "argument"]) {
  test(`a lexical attribute cannot substitute a different genuine ${field} from the same body`, () => {
    const fixture = operationScenario();
    const attribute = () => ({ declaration: ownerId, occurrence: { kind: "body", value: { body: bodyId, node: 0 } },
      arguments: [{ kind: "body", value: { body: bodyId, node: 2 } }] });
    fixture.body.scopes[0].attributes = [attribute()];
    fixture.input.source.bodies[0].scopes[0].attributes = [attribute()];
    if (field === "occurrence") fixture.body.scopes[0].attributes[0].occurrence.value.node = 2;
    else fixture.body.scopes[0].attributes[0].arguments[0].value.node = 3;
    assertCompleteValue(verifyBody(fixture.input, fixture.body), [bodyViolation("permission-scope",
      "lexical scope attributes do not retain actual authored permission data")]);
  });
}

// A conversion carried out by an operation embeds by a conversion (`conversion-carried`).
const carriedComponent = { root: { kind: "body", value: { body: bodyId, node: 2 } }, path: [] };
const carriedEmbedding = { kind: "conversion", conversion: "numeric", check: { kind: "none" },
  proof: { steps: [{ from: carriedComponent, to: carriedComponent, rule: "numeric", premises: [] }], conclusion: 0 } };

test("a conversion's structural source is checked without replaying the embedding rule", () => {
  const fixture = operationScenario();
  const operation = { permissionScope: null, decision: { kind: "selected", operation: { kind: "conversion", embedding: carriedEmbedding, from: 1, to: 1 },
    operands: [1], result: 1, execution: { kind: "pure" } } };
  fixture.typed.tsonic.conversion = { kind: "convert", role: "initialization", operation };
  assertCompleteValue(verifyBody(fixture.input, fixture.body), []);
  operation.decision.operands = [0];
  assertCompleteValue(verifyBody(fixture.input, fixture.body), [
    nodeViolation("conversion-source", 2, "conversion does not retain its value source endpoint"),
    nodeViolation("operation-type", 2, "conversion operation does not retain its explicit operand and result endpoints")]);
});

test("identity conversion preserves its actual source and destination without a relation solver", () => {
  const fixture = operationScenario();
  assertCompleteValue(verifyBody(fixture.input, fixture.body), []);
  fixture.typed.tsonic.convertedType = 0;
  assertCompleteValue(verifyBody(fixture.input, fixture.body), [nodeViolation("conversion-destination", 2,
    "conversion does not retain its destination endpoint")]);
  fixture.typed.tsonic.convertedType = 1;
  assertCompleteValue(verifyBody(fixture.input, fixture.body), []);
});

test("a conversion's structural destination is checked without guessing a receiver or relation", () => {
  const fixture = operationScenario();
  const operation = { permissionScope: null, decision: { kind: "selected", operation: { kind: "conversion", embedding: carriedEmbedding, from: 1, to: 1 },
    operands: [1], result: 1, execution: { kind: "pure" } } };
  fixture.typed.tsonic.conversion = { kind: "convert", role: "initialization", operation };
  fixture.typed.tsonic.convertedType = 0;
  assertCompleteValue(verifyBody(fixture.input, fixture.body), [nodeViolation("conversion-destination", 2,
    "conversion does not retain its destination endpoint")]);
});

test("a saved generic conversion retains its genuine rigid-parameter declaration and full captured environment", () => {
  const fixture = deferredConversionScenario();
  assertCompleteValue(verifyBody(fixture.input, fixture.body), []);
  assert.equal(fixture.context.bindings.methodBindings[0].kind, "rigid");
  assertCompleteValue(fixture.context.bindings.methodBindings[0].parameter, fixture.typeDefinition);
});

test("a saved conversion cannot substitute a different genuine occurrence as its own", () => {
  const fixture = deferredConversionScenario();
  fixture.context.occurrence.node = fixture.nodes.return;
  assertCompleteValue(verifyBody(fixture.input, fixture.body), [
    nodeViolation("conversion-deferred", 9, "deferred conversion does not retain its occurrence and result"),
    nodeViolation("deferred-parameters", 9,
      "saved invocation does not retain its occurrence and complete captured rigid-parameter support"),
  ]);
});

test("a saved conversion result is not silently repaired from its current value endpoint", () => {
  const fixture = deferredConversionScenario();
  fixture.deferred.result = 2;
  assertCompleteValue(verifyBody(fixture.input, fixture.body), [nodeViolation("conversion-deferred", 9,
    "deferred conversion does not retain its occurrence and result")]);
});

test("a saved invocation cannot omit the genuine rigid parameter required by its reachable input type", () => {
  const fixture = deferredConversionScenario();
  fixture.context.bindings = emptyBindings();
  assertCompleteValue(verifyBody(fixture.input, fixture.body), [
    nodeViolation("binding-vector-complete", 9, "type verifier: binding-vector-complete"),
    nodeViolation("deferred-parameters", 9,
      "saved invocation does not retain its occurrence and complete captured rigid-parameter support"),
  ]);
});

test("an actual refinement result retains the finalized value endpoint", () => {
  const fixture = operationScenario();
  fixture.typed.tsonic.narrowing = { kind: "identity", type: 1 };
  assertCompleteValue(verifyBody(fixture.input, fixture.body), []);
  fixture.typed.tsonic.narrowing.type = 0;
  assertCompleteValue(verifyBody(fixture.input, fixture.body), [nodeViolation("refinement-destination", 2,
    "refinement does not retain its value endpoint")]);
});

test("an error resolution needs the actual current source error diagnostic, not merely an integer", () => {
  const fixture = memberScenario("property-access");
  const receiver = fixture.body.root.statements.nodes[0].node.expression.expression;
  receiver.tsonic.resolution = { kind: "error", diagnostic: 0 };
  assertCompleteValue(verifyBody(fixture.input, fixture.body), [nodeViolation("error-diagnostic", 3,
    "error resolution does not select an actual error diagnostic at its source origin")]);
  fixture.input.diagnostics = [{ code: { kind: "checker", number: 1234, rendered: "TS1234" }, severity: "error",
    site: { kind: "source", origin: origin() }, source: "checker", evidence: [], message: "authored source error",
    arguments: [], related: [], fix: null }];
  assertCompleteValue(verifyBody(fixture.input, fixture.body), []);
});

for (const [role, token] of [["arithmetic", "PlusToken"], ["comparison", "EqualsEqualsEqualsToken"],
  ["short-circuit", "AmpersandAmpersandToken"], ["assignment", "EqualsToken"], ["sequence", "CommaToken"]]) {
  test(`the closed ${role} binary role retains its actual authored operator`, () => {
    const fixture = binaryScenario(role, token);
    assertCompleteValue(verifyBody(fixture.input, fixture.body), []);
  });
}

test("a genuine wrong binary role is rejected independently of phase-record constructibility", () => {
  const fixture = binaryScenario("sequence", "PlusToken");
  assertCompleteValue(verifyBody(fixture.input, fixture.body), [nodeViolation("binary-role-operator", 2,
    "binary role does not match its authored operator token")]);
});

test("a property-name cannot replace an actual authored value occurrence", () => {
  const fixture = memberScenario("property-access");
  fixture.body.root.statements.nodes[0].node.expression.expression.tsonic = { role: "property-name", key: { kind: "text", value: "x" } };
  assertCompleteValue(verifyBody(fixture.input, fixture.body), [
    nodeViolation("occurrence-role", 3, "typed occurrence does not retain its authored occurrence role"),
    nodeViolation("name-role-position", 3, "name role does not match its original syntactic position"),
    nodeViolation("typed-value-occurrence", 3, "authored value occurrence has no typed value endpoints"),
  ]);
});

test("a real value evidence index retains its exact qualified occurrence component", () => {
  const fixture = operationScenario();
  const component = { kind: "body", value: { body: bodyId, node: 3 } };
  const evidence = { ...typeEvidence({ kind: "known", category: "number" }), type: 1, component };
  fixture.body.evidence = [evidence];
  fixture.operand.tsonic.evidenceIndex = 0;
  assertCompleteValue(verifyBody(fixture.input, fixture.body), []);
  evidence.component = { kind: "body", value: { body: bodyId, node: 2 } };
  assertCompleteValue(verifyBody(fixture.input, fixture.body), [nodeViolation("evidence-reference", 3,
    "value evidence does not retain its actual occurrence component")]);
});

for (const index of [-1, -0, 0.5, 1, Infinity]) {
  test(`a genuine invalid value evidence coordinate is not repaired: ${Object.is(index, -0) ? "-0" : index}`, () => {
    const fixture = operationScenario();
    fixture.operand.tsonic.evidenceIndex = index;
    assertCompleteValue(verifyBody(fixture.input, fixture.body), [nodeViolation("evidence-reference", 3,
      "value evidence index and type do not select a present evidence record")]);
  });
}

test("body evidence ordering follows actual own-body occurrence order, not arbitrary type IDs", () => {
  const fixture = operationScenario();
  const at = node => ({ ...typeEvidence({ kind: "known", category: "number" }), type: 1,
    component: { kind: "body", value: { body: bodyId, node } } });
  fixture.body.evidence = [at(2), at(3)];
  assertCompleteValue(verifyBody(fixture.input, fixture.body), []);
  fixture.body.evidence.reverse();
  assertCompleteValue(verifyBody(fixture.input, fixture.body), [bodyViolation("evidence-order",
    "evidence vector does not retain actual own-body occurrence order")]);
});

for (const mismatch of ["kind", "asynchronous", "thrown"]) {
  test(`a real spread protocol retains its supplied structural ${mismatch} fact`, () => {
    const fixture = argumentScenario("empty");
    const spread = fixture.body.root.statements.nodes[0].node.expression.arguments.nodes[0];
    const protocol = spread.tsonic.protocol.decision;
    if (mismatch === "kind") protocol.kind = "iterate";
    if (mismatch === "asynchronous") protocol.asynchronous = true;
    if (mismatch === "thrown") protocol.thrown = 2;
    assertCompleteValue(verifyBody(fixture.input, fixture.body), [nodeViolation(
      mismatch === "thrown" ? "protocol-thrown-unknown" : "protocol-total", 4,
      mismatch === "thrown" ? "protocol thrown channel is not the canonical intrinsic unknown type"
        : "selected protocol does not retain its actual authored kind and asynchrony")]);
  });
}

test("a protocol step retains its genuine bodyless API result without inventing required roles", () => {
  const fixture = argumentScenario("empty");
  const spread = fixture.body.root.statements.nodes[0].node.expression.arguments.nodes[0];
  const callee = fixture.body.root.statements.nodes[0].node.expression.tsonic.application.decision.callee;
  const operation = { permissionScope: null, decision: { kind: "selected", operation: { kind: "library",
    declaration: callee.decision.api.declaration, bindings: emptyBindings() }, operands: [], result: 0,
    execution: { kind: "invocation", writesStorage: true, failure: "unwind" } } };
  spread.tsonic.protocol.decision.steps = [{ role: "next", operation, callee }];
  replaceScopeInventory(fixture.input, Array.from({ length: 7 }, emptyScope));
  assertCompleteValue(verifyBody(fixture.input, fixture.body), []);
  operation.decision.result = 2;
  assertCompleteValue(verifyBody(fixture.input, fixture.body), [nodeViolation("protocol-total", 4,
    "protocol step operation and callee do not retain the same selected endpoint and result")]);
});

test("the saved protocol operation checks its own closed step results and canonical unknown", () => {
  const fixture = argumentScenario("empty");
  const call = fixture.body.root.statements.nodes[0].node.expression;
  const application = call.tsonic.application.decision.callee.decision;
  const identity = { kind: "protocol", protocol: "spread", asynchronous: false,
    steps: [{ role: "next", operation: { kind: "call", application }, operands: [5], result: 0 }],
    value: 2, completion: 0, yielded: null, sent: null, thrown: 0 };
  call.tsonic.operation = { kind: "decided", decision: { permissionScope: null,
    decision: { kind: "selected", operation: identity, operands: [], result: 0, execution: { kind: "pure" } } } };
  replaceScopeInventory(fixture.input, Array.from({ length: 6 }, emptyScope));
  assertCompleteValue(verifyBody(fixture.input, fixture.body), []);
  identity.steps[0].result = 2;
  assertCompleteValue(verifyBody(fixture.input, fixture.body), [nodeViolation("protocol-total", 2,
    "protocol step operation and callee do not retain the same selected endpoint and result")]);
  identity.steps[0].result = 0;
  identity.thrown = 2;
  assertCompleteValue(verifyBody(fixture.input, fixture.body), [nodeViolation("protocol-thrown-unknown", 2,
    "protocol thrown channel is not the canonical intrinsic unknown type")]);
});

test("syntax wire bindings do not alias duplicate, negative-zero or nonfinite semantic NodeId payloads", () => {
  for (const identity of [0, -0, NaN, Infinity, -Infinity, 1.5, -3]) {
    const body = emptyModuleBody();
    body.root.id = identity;
    body.root.endOfFileToken.id = identity;
    body.root.endOfFileToken.parent = identity;
    const text = product.printTir(body);
    const spelling = Object.is(identity, -0) ? "-0" : Number.isNaN(identity) ? "NaN" :
      identity === Infinity ? "+Infinity" : identity === -Infinity ? "-Infinity" : String(identity);
    const authored = readFileSync(resolve(repository, functionDirectory, "empty-module.input.tir"), "utf8")
      .replace("TirModuleRoot(id=n:0", `TirModuleRoot(id=n:${spelling}`)
      .replace("EndOfFile(id=n:1", `EndOfFile(id=n:${spelling}`)
      .replace("parent=n:0", `parent=n:${spelling}`);
    assertCompleteValue(text, authored, `complete wire vector for semantic ID ${spelling}`, sameWire);
    const parsed = product.parseTir(authored);
    assert.equal(parsed.kind, "parsed");
    assert.equal(Object.is(parsed.value.root.id, identity), true);
    assert.equal(Object.is(parsed.value.root.endOfFileToken.id, identity), true);
    assert.equal(Object.is(parsed.value.root.endOfFileToken.parent, identity), true);
    assertCompleteValue(parsed.value, body, "the complete malformed-semantic-ID value is preserved", compareCaseValues);
    assert.equal(parsed.value.root === parsed.value.root.endOfFileToken, false, "two actual objects stay distinct");
  }
});

for (const [identity, spelling] of [[0, "0"], [-0, "-0"], [NaN, "NaN"], [Infinity, "+Infinity"],
  [-Infinity, "-Infinity"], [1.5, "1.5"], [-3, "-3"]]) {
  test(`owner-published local/type/signature identities retain the complete number domain: ${spelling}`, () => {
    const body = emptyModuleBody();
    body.signature = identity;
    body.completion = identity;
    body.yielded = identity;
    body.sent = identity;
    body.locals = [{ id: identity, declaration: { kind: "body", value: { body: bodyId, node: 0 } }, name: "value",
      role: "binding", capturedFrom: null, mutable: false, storage: identity }];
    const local = `TirLocal(id=l:${spelling}, declaration=body(value=NodeRef(body=body:"${bodyId}", node=n:0)), ` +
      `name="value", role="binding", capturedFrom=null, mutable=false, storage=t:${spelling})`;
    const expected = readFileSync(resolve(repository, functionDirectory, "empty-module.input.tir"), "utf8")
      .replace("signature=sig:0, completion=t:0, yielded=null, sent=null",
        `signature=sig:${spelling}, completion=t:${spelling}, yielded=t:${spelling}, sent=t:${spelling}`)
      .replace("locals=[]", `locals=[${local}]`);
    assertCompleteValue(product.printTir(body), expected, "complete wire, without identity-domain repair", sameWire);
    const parsed = product.parseTir(expected);
    assert.equal(parsed.kind, "parsed");
    assertCompleteValue(parsed.value, body, "entire owner-published local/type/signature payload", compareCaseValues);
  });
}

for (const expansion of ["", "plain", "\u0000\uD800"]) {
  test(`owner-published expansion identity retains its complete string domain: ${JSON.stringify(expansion)}`, () => {
    const body = emptyModuleBody();
    body.root.origin.derived = [{ kind: "expansion", expansion }];
    const expected = readFileSync(resolve(repository, functionDirectory, "empty-module.input.tir"), "utf8")
      .replace(`Origin(module=mod:"${moduleId}", start=0, length=0, derived=[])`,
        `Origin(module=mod:"${moduleId}", start=0, length=0, derived=[expansion(expansion=exp:${JSON.stringify(expansion)})])`);
    assertCompleteValue(product.printTir(body), expected, "complete independently authored expansion wire", sameWire);
    const parsed = product.parseTir(expected);
    assert.equal(parsed.kind, "parsed");
    assertCompleteValue(parsed.value, body, "entire expansion payload, no invented identity grammar", compareCaseValues);
  });
}

const completeEmptyWire = readFileSync(resolve(repository, functionDirectory, "empty-module.input.tir"), "utf8");
const invalidTextAt = (text, offset, expected, found) => {
  const prefix = text.slice(0, offset).split("\n");
  return { kind: "invalid-text", offset, line: prefix.length, column: prefix[prefix.length - 1].length + 1, expected, found };
};
const checkedSectionOffset = completeEmptyWire.indexOf("CheckedDeclarations(");
const typedSectionOffset = completeEmptyWire.indexOf("TypedDeclarations(");
const typedOpeningOffset = typedSectionOffset + "TypedDeclarations".length;
const typedClosingOffset = completeEmptyWire.lastIndexOf(")");
const typedOrdinalOffset = completeEmptyWire.indexOf("\nn:0=") + "\nn:".length;
const editWire = (offset, remove, insert) => completeEmptyWire.slice(0, offset) + insert + completeEmptyWire.slice(offset + remove);
for (const [name, text, offset, expected, found] of [
  ["newline before Checked", editWire(checkedSectionOffset - 1, 1, " "), checkedSectionOffset, ["newline"], "CheckedDeclarations"],
  ["Checked section name", editWire(checkedSectionOffset, "CheckedDeclarations".length, "X"), checkedSectionOffset,
    ["CheckedDeclarations"], "X"],
  ["newline before Typed", editWire(typedSectionOffset - 1, 1, " "), typedSectionOffset, ["newline"], "TypedDeclarations"],
  ["Typed section name", editWire(typedSectionOffset, "TypedDeclarations".length, "Other"), typedSectionOffset, ["TypedDeclarations"], "Other"],
  ["Typed opening", editWire(typedOpeningOffset, 1, "["), typedOpeningOffset, ["("], "["],
  ["Typed closing", completeEmptyWire.slice(0, typedClosingOffset), typedClosingOffset, [")"], null],
  ["invalid Typed ordinal", editWire(typedOrdinalOffset, 1, "@"), typedOrdinalOffset, ["record", "string", "number", "["], "@"],
  ["invalid text after Typed closing", editWire(typedClosingOffset + 1, 0, "@"), typedClosingOffset + 1,
    ["record", "string", "number", "["], "@"],
  ["extra value after Typed closing", editWire(typedClosingOffset + 1, 0, " n"), typedClosingOffset + 2, ["end of text"], "n"],
]) {
  test(`TIR phase framing rejects ${name} at the actual token`, () => {
    assertCompleteValue(product.parseTir(text), invalidTextAt(text, offset, expected, found));
  });
}
const blockDeclarationWire = (id, children) => `n:${id}=Block(${syntaxHeaderWire(id, id === 0 ? null : id - 1)}, ` +
  `statements=NodeList(loc=TextRange(pos=0, end=0), nodes=[${children.map(child => `n:${child}`).join(", ")}]), ` +
  "multiLine=false, tsonic=null)\n";
for (const root of [0, 9]) {
  test(`header stream error ends parsing without judging the pending root n:${root}`, () => {
    const text = completeEmptyWire.split("\n")[0].replace("root=n:0", `root=n:${root}`).replace("evidence=[]", "evidence=@");
    assertCompleteValue(product.parseTir(text), invalidTextAt(text, text.indexOf("@"), ["record", "string", "number", "["], "@"));
  });
}
for (const target of [0, 9]) {
  for (const fault of ["lexical", "shape"]) {
    test(`a declaration ${fault} error outranks pending ${target === 0 ? "backward wrong-family" : "forward dangling"} target`, () => {
      const selected = fault === "lexical" ? "@" : '"Wrong"';
      const text = completeEmptyWire.replace("endOfFileToken=n:1", `endOfFileToken=n:${target}`)
        .replace('scriptKind="TS"', `scriptKind=${selected}`);
      const offset = text.indexOf("scriptKind=") + "scriptKind=".length;
      assertCompleteValue(product.parseTir(text), invalidTextAt(text, offset,
        fault === "lexical" ? ["record", "string", "number", "["] : ["ScriptKind"], selected));
    });
  }
}
for (const target of [0, 9]) {
  test(`a late declaration stream fault outranks a pending ${target === 0 ? "backward cycle" : "forward dangling"} target`, () => {
    const text = openTypedWire(completeEmptyWire.split("\n")[0]) + blockDeclarationWire(0, [target]) + "n:1=@";
    assertCompleteValue(product.parseTir(text), invalidTextAt(text, text.indexOf("@"), ["record", "string", "number", "["], "@"));
  });
}
for (const children of [[0, 9], [9, 0]]) {
  test(`clean EOF chooses the first token among actual cycle/dangling references ${children.join("/")}`, () => {
    const text = openTypedWire(completeEmptyWire.split("\n")[0]) + blockDeclarationWire(0, children) + ")\n";
    const offset = text.indexOf("nodes=[") + "nodes=[".length;
    const first = children[0];
    assertCompleteValue(product.parseTir(text), invalidTextAt(text, offset,
      first === 0 ? ["acyclic syntax reference"] : ["declared syntax node"], `n:${first}`));
  });
}
for (const danglingFirst of [false, true]) {
  test(`clean EOF chooses the first token among wrong-family and dangling references, dangling first=${danglingFirst}`, () => {
    const child = danglingFirst ? 9 : 1;
    const end = danglingFirst ? 0 : 9;
    const text = completeEmptyWire.replace("nodes=[]", `nodes=[ready-statement(node=n:${child})]`).replace("endOfFileToken=n:1", `endOfFileToken=n:${end}`);
    const offset = text.indexOf("ready-statement(node=") + "ready-statement(node=".length;
    assertCompleteValue(product.parseTir(text), invalidTextAt(text, offset,
      danglingFirst ? ["declared syntax node"] : ["ReadyStatement"], `n:${child}`));
  });
}
test("wrong-family wins an actual same-token child-cycle tie", () => {
  const text = completeEmptyWire.replace("endOfFileToken=n:1", "endOfFileToken=n:0");
  const offset = text.indexOf("endOfFileToken=") + "endOfFileToken=".length;
  assertCompleteValue(product.parseTir(text), invalidTextAt(text, offset, ["EndOfFile"], "n:0"));
});
test("clean EOF reports the first text-prefix cycle closure, not the first DFS backedge", () => {
  const text = openTypedWire(completeEmptyWire.split("\n")[0]) + blockDeclarationWire(0, [1]) +
    blockDeclarationWire(1, [2, 0]) + blockDeclarationWire(2, [0]) + ")\n";
  const offset = text.indexOf("nodes=[n:2, n:0]") + "nodes=[n:2, ".length;
  assertCompleteValue(product.parseTir(text), invalidTextAt(text, offset, ["acyclic syntax reference"], "n:0"));
});
for (const [prefix, identity] of [["mod", moduleId], ["def", ownerId], ["body", bodyId]]) {
  test(`declaring-owner decoding rejects a malformed ${prefix} identity before typed publication`, () => {
    const original = `${prefix}:${JSON.stringify(identity)}`;
    const malformed = `${prefix}:"invalid"`;
    const input = completeEmptyWire.replace(original, malformed);
    const offset = completeEmptyWire.indexOf(original);
    const lines = input.slice(0, offset).split("\n");
    assertCompleteValue(product.parseTir(input), { kind: "invalid-text", offset, line: lines.length,
      column: lines[lines.length - 1].length + 1, expected: [prefix], found: malformed });
    const parsed = product.parseTir(completeEmptyWire);
    assert.equal(parsed.kind, "parsed");
    assertCompleteValue(parsed.value, emptyModuleBody(), "entire corrected owner-published body", compareCaseValues);
  });
}

for (const [name, suffix, relativeOffset, expected, found] of [
  ["wrong declaration prefix", "other", 0, ["n"], "other"],
  ["missing declaration colon", "n=", 1, [":"], "="],
  ["missing declaration equals", "n:2", 3, ["="], null],
  ["duplicate declaration", "n:0=", 2, ["unique wire binding"], "0"],
  ["incomplete non-dense declaration", "n:3=", 4, ["value"], null],
  ["negative-zero declaration", "n:-0=", 2, ["wire traversal position"], "-0"],
  ["nonfinite declaration", "n:NaN=", 2, ["wire traversal position"], "NaN"],
  ["wrong declaration value kind", "n:null=", 2, ["wire traversal position"], "null"],
  ["missing declaration ordinal", "n:", 2, ["wire traversal position"], null],
  ["unreachable declared node", `n:2=EndOfFile(${syntaxHeaderWire(2, null)}, tsonic=null)`, 2, ["referenced syntax declaration"], "2"],
]) {
  test(`complete wire-binding failure: ${name}`, () => {
    const prefix = completeEmptyWire.slice(0, -")\n".length);
    const text = prefix + suffix + (name === "unreachable declared node" ? "\n)\n" : "");
    assertInvalidText(text, prefix.length + relativeOffset, expected, found);
  });
}
test("Typed declaration order is independent of the dense wire identity set", () => {
  const lines = completeEmptyWire.trimEnd().split("\n");
  const root = lines.findIndex(line => line.startsWith("n:0="));
  assert.equal(lines[root + 1].startsWith("n:1="), true);
  [lines[root], lines[root + 1]] = [lines[root + 1], lines[root]];
  assertCompleteValue(product.parseTir(lines.join("\n")), { kind: "parsed", value: emptyModuleBody() });
  const sparse = completeEmptyWire.replace("endOfFileToken=n:1", "endOfFileToken=n:7").replace("n:1=EndOfFile", "n:7=EndOfFile");
  assertInvalidText(sparse, sparse.indexOf("n:7=EndOfFile") + 2, ["dense wire binding"], "7");
});
test("record separators require the actual newline even when every earlier wire reference is defined", () => {
  const prefix = completeEmptyWire.slice(0, -"\n)\n".length);
  assertInvalidText(prefix + "n:2=", prefix.length, ["newline"], "n");
});
for (const [name, selected, expected] of [
  ["unresolved root", "n:2", ["declared syntax node"]],
  ["wrong root family", "n:1", ["TirBodyRoot"]],
]) {
  test(`the actual earlier ${name} reference wins over later declaration positions`, () => {
    const frame = completeEmptyWire.slice(0, completeEmptyWire.indexOf("root=")) + "root=";
    const text = frame + selected + completeEmptyWire.slice(frame.length + 3);
    assertCompleteValue(product.parseTir(text), { kind: "invalid-text", offset: frame.length, line: 1,
      column: frame.length + 1, expected, found: selected });
  });
}
for (const [name, selected, expected] of [
  ["unresolved child", "n:9", ["declared syntax node"]],
  ["wrong child family", "n:0", ["EndOfFile"]],
]) {
  test(`the actual earlier ${name} retains its exact owning field coordinate`, () => {
    const position = completeEmptyWire.indexOf("endOfFileToken=") + "endOfFileToken=".length;
    const text = completeEmptyWire.slice(0, position) + selected + completeEmptyWire.slice(position + 3);
    assertInvalidText(text, position, expected, selected);
  });
}
test("declared syntax identity preserves legal shared children without inline-value expansion", () => {
    const body = emptyModuleBody();
    const root = { ...header(0), kind: "Block", statements: nodeList(), multiLine: false, tsonic: null };
    const child = { ...header(1, 0), kind: "Block", statements: nodeList(), multiLine: false, tsonic: null };
    root.statements.nodes.push(child, child);
    body.root = root;
    const expected = openTypedWire(completeEmptyWire.split("\n")[0]) +
      `n:0=Block(${headerWire}, statements=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:1, n:1]), multiLine=false, tsonic=null)\n` +
      `n:1=Block(${syntaxHeaderWire(1, 0)}, statements=NodeList(loc=TextRange(pos=0, end=0), nodes=[]), multiLine=false, tsonic=null)\n)\n`;
    assertCompleteValue(product.printTir(body), expected, "entire independently authored identity graph wire", sameWire);
    const parsed = product.parseTir(expected);
    assert.equal(parsed.kind, "parsed");
    assertCompleteValue(parsed.value, body, "entire declared graph, including every body/header field", isDeepStrictEqual);
    assert.equal(parsed.value.root.statements.nodes[0] === parsed.value.root.statements.nodes[1], true);
});

test("actual child cycles fail both typed ports at the child path and text at its prefix-closing reference", () => {
  const body = emptyModuleBody();
  const root = { ...header(0), kind: "Block", statements: nodeList(), multiLine: false, tsonic: null };
  root.statements.nodes.push(root);
  body.root = root;
  assert.throws(() => product.printTir(body), { name: "TypeError",
    message: 'ir-tir: syntax cycle at $syntax["statements"]["nodes"][0]' });
  assert.throws(() => verifyBody(emptyVerificationInput(body), body), { name: "TypeError",
    message: 'ir-tir: syntax cycle at $body["root"]["statements"]["nodes"][0]' });
  const text = openTypedWire(completeEmptyWire.split("\n")[0]) +
    `n:0=Block(${headerWire}, statements=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:0]), multiLine=false, tsonic=null)\n)\n`;
  const offset = text.indexOf("nodes=[n:0]") + "nodes=[".length;
  assertInvalidText(text, offset, ["acyclic syntax reference"], "n:0");
});

test("layered legal sharing has one complete arena declaration and verification visit per actual node", () => {
  const depth = 128;
  const fixture = layeredSyntaxScenario(depth);
  const lines = completeEmptyWire.trimEnd().split("\n");
  const expected = openTypedWire(lines[0]) + lines[3].replace("nodes=[]", "nodes=[ready-statement(node=n:1)]")
    .replace("endOfFileToken=n:1", `endOfFileToken=n:${depth + 1}`) + "\n" +
    Array.from({ length: depth }, (_, position) => {
      const id = position + 1;
      const children = id === depth ? "[]" : `[n:${id + 1}, n:${id + 1}]`;
      return `n:${id}=Block(${syntaxHeaderWire(id, id - 1)}, statements=NodeList(loc=TextRange(pos=0, end=0), ` +
        `nodes=${children}), multiLine=false, tsonic=null)\n`;
    }).join("") + `n:${depth + 1}=EndOfFile(${syntaxHeaderWire(depth + 1, 0)}, tsonic=null)\n)\n`;
  assertCompleteValue(product.printTir(fixture.body), expected, "complete source-sized128-node shared arena wire", sameWire);
  const parsed = product.parseTir(expected);
  assert.equal(parsed.kind, "parsed");
  for (let level = 0, node = parsed.value.root.statements.nodes[0].node; level < depth - 1; level++) {
    assert.equal(node.statements.nodes[0] === node.statements.nodes[1], true, `shared arena identity at${level}`);
    node = node.statements.nodes[0];
  }
  const normalizeRoot = root => ({ ...root, statements: { ...root.statements, nodes: root.statements.nodes.map(node => node.id) } });
  const normalizeModule = root => ({ ...root, statements: { ...root.statements,
    nodes: root.statements.nodes.map(slot => ({ kind: slot.kind, node: slot.node.id })) } });
  assertCompleteValue({ ...parsed.value, root: normalizeModule(parsed.value.root) },
    { ...fixture.body, root: normalizeModule(fixture.body.root) }, "complete body/root fields and root child identities", compareCaseValues);
  for (let level = 0, node = parsed.value.root.statements.nodes[0].node; level < depth; level++) {
    assertCompleteValue(normalizeRoot(node), normalizeRoot(fixture.typed[level]), `entire arena node${level}`, compareCaseValues);
    node = node.statements.nodes[0];
  }
  assertCompleteValue(verifyBody(fixture.input, fixture.body), []);
});

test("shared syntax uses first arena order for complete evidence vectors, never last incoming edge order", () => {
  const fixture = siblingIdentityScenario(false, false);
  fixture.body.root.statements.nodes.push(readyStatement(fixture.firstTyped));
  fixture.input.source.tree.statements.nodes.push(fixture.input.source.tree.statements.nodes[0]);
  const at = node => ({ ...typeEvidence({ kind: "dynamic" }), component: { kind: "body", value: { body: bodyId, node } } });
  fixture.body.evidence = [at(1), at(2)];
  assertCompleteValue(verifyBody(fixture.input, fixture.body), []);
  fixture.body.evidence.reverse();
  assertCompleteValue(verifyBody(fixture.input, fixture.body), [bodyViolation("evidence-order",
    "evidence vector does not retain actual own-body occurrence order")]);
});

const beforeSignature = `TirBody(body=body:"${bodyId}", owner=def:"${ownerId}", bindings=parametric(), ` +
  'lexicalBindings=BindingVector(classBindings=[], methodBindings=[], capturedBindings=[], selfBindings=[]), ' +
  'dependence="parametric", signature=sig:';
for (const [name, text, offset, expected, found] of [
  ["bare-minus", 'TirBody(body=body:"' + bodyId + '", owner=def:"' + ownerId + '", bindings=parametric(), ' +
    'lexicalBindings=BindingVector(classBindings=[], methodBindings=[], capturedBindings=[], selfBindings=[]), ' +
    'dependence="parametric", signature=sig:-)', beforeSignature.length, ["number"], "-"],
  ["numeric-identity-array", beforeSignature + "[]", beforeSignature.length, ["number"], "["],
  ["numeric-identity-eof", beforeSignature, beforeSignature.length, ["identity number"], null],
  ["string-identity-number", "TirBody(body=body:1)", 18, ["string"], "1"],
  ["string-identity-eof", "TirBody(body=body:", 18, ["identity string"], null],
  ["identity-colon", "TirBody(body=body=0)", 17, [":"], "="],
  ["opening-record", "TirBody[", 7, ["("], "["],
  ["first-token-fault", "?", 0, ["record", "string", "number", "["], "?"],
  ["field-name-eof", `TirBody(body=body:"${bodyId}",`, `TirBody(body=body:"${bodyId}",`.length, ["field name"], null],
  ["separator-eof", `TirBody(body=body:"${bodyId}"`, `TirBody(body=body:"${bodyId}"`.length, [",", ")"], null],
  ["zero-field-close-eof", `TirBody(body=body:"${bodyId}", owner=def:"${ownerId}", bindings=parametric(`,
    `TirBody(body=body:"${bodyId}", owner=def:"${ownerId}", bindings=parametric(`.length, [")"], null],
]) {
  test(`F4 exact complete lexical/framing result ${name}`, () => assertInvalidText(text, offset, expected, found));
}
const beforeParams = beforeSignature + '0, completion=t:0, yielded=null, sent=null, params=';
const completeParameter = "n:1";
const firstPositionCases = [
  ["empty", "", 0, ["value"], null],
  ["missing-first-field", "TirBody(", 8, ["body"], null],
  ["missing-value", "TirBody(body=", 13, ["value"], null],
  ["earlier-type-later-eof", "TirBody(body=null", 13, ["body"], "null"],
  ["earlier-type-later-comma", "TirBody(body=null,", 13, ["body"], "null"],
  ["earlier-type-later-bracket", "TirBody(body=[", 13, ["body"], "["],
  ["earlier-type-later-element", "TirBody(body=[null", 13, ["body"], "["],
  ["earlier-type-later-trailing-comma", "TirBody(body=[null,])", 13, ["body"], "["],
  ["missing-identity-string", "TirBody(body=body:)", 18, ["identity string"], ")"],
  ["wrong-root", "Other()", 0, ["TirBody"], "Other"],
  ["scalar-root", "null", 0, ["TirBody"], "null"],
  ["array-root", "[]", 0, ["TirBody"], "["],
  ["missing-body", "TirBody()", 8, ["body"], ")"],
  ["wrong-first-field", "TirBody(owner=null)", 8, ["body"], "owner"],
  ["wrong-field-before-escape", 'TirBody(owner="\\q")', 8, ["body"], "owner"],
  ["wrong-root-before-escape", 'Other(owner="\\q")', 0, ["TirBody"], "Other"],
  ["wrong-type-before-escape", 'TirBody(body="\\q")', 13, ["body"], '"'],
  ["escape-before-later-field", 'TirBody(body=body:"\\q", owner=null)', 20, ["JSON escape"], "q"],
  ["unicode-before-later-field", 'TirBody(body=body:"\\u0q00", owner=null)', 21, ["four hexadecimal digits"], "0q00"],
  ["string-eof", 'TirBody(body=body:"unterminated)', 32, ['"'], null],
  ["number-before-later-field", beforeSignature + '1.0, owner=null)', beforeSignature.length, ["canonical number"], "1.0"],
  ["number-overflow-before-eof", beforeSignature + '1e999', beforeSignature.length, ["canonical number"], "1e999"],
  ["bigint-negative-zero", beforeSignature + '-0n)', beforeSignature.length, ["canonical bigint"], "-0n"],
  ["invalid-character", "TirBody(body=@)", 13, ["record", "string", "number", "["], "@"],
  ["missing-equals", "TirBody(body)", 12, ["="], ")"],
  ["missing-field-name", "TirBody(=null)", 8, ["field name"], "="],
  ["earlier-type-later-missing-comma", "TirBody(body=null owner=null)", 13, ["body"], "null"],
  ["earlier-type-later-empty-field", "TirBody(body=null,)", 13, ["body"], "null"],
  ["array-eof", beforeParams + '[', beforeParams.length + 1, ["value", "]"], null],
  ["array-element-before-eof", beforeParams + '[null', beforeParams.length + 1, ["$TirFormal"], "null"],
  ["array-closed-record-before-eof", beforeParams + '[' + completeParameter, beforeParams.length + completeParameter.length + 1, [",", "]"], null],
  ["array-trailing-comma", beforeParams + '[' + completeParameter + ',])', beforeParams.length + completeParameter.length + 2, ["$TirFormal"], "]"],
];
for (const [name, text, offset, expected, found] of firstPositionCases) {
  test(`first actual lexical/frame/typed error: ${name}`, () => {
    assertCompleteValue(product.parseTir(text), { kind: "invalid-text", offset, line: 1, column: offset + 1, expected, found });
  });
}

test("the removed scalar TirParam record is not a selected parameter occurrence", () => {
  const retired = `TirParam(local=l:0, declaration=def:"${ownerId}", role="required", passing="by-value", initializer=null, storage=t:0)`;
  const text = completeEmptyWire.replace("params=[]", `params=[${retired}]`);
  const offset = text.indexOf("TirParam(");
  assertCompleteValue(product.parseTir(text), { kind: "invalid-text", offset, line: 1, column: offset + 1,
    expected: ["$TirFormal"], found: "TirParam" });
});

const beforeArtifact = `TirBody(body=body:"${bodyId}", owner=def:"${ownerId}", `;
const beforeVector = beforeArtifact + 'bindings=instantiated(bindings=BindingVector(classBindings=[], ';
const afterVectorFields = beforeVector + 'methodBindings=[], capturedBindings=[], selfBindings=[], ';
const beforeZeroFields = beforeArtifact + 'bindings=parametric(';
const fieldNameCases = [
  ["complete unquoted duplicate", beforeVector, "classBindings=[]", 0, ["unique record field"], "classBindings"],
  ["complete quoted duplicate", beforeVector, '"classBindings"=[]', 1, ["unique record field"], "classBindings"],
  ["unterminated duplicate prefix", beforeVector, '"cl', 1, ["methodBindings"], "c"],
  ["later duplicate-prefix lexical failure", beforeVector, '"cl\\q', 1, ["methodBindings"], "c"],
  ["escaped complete duplicate", beforeVector, '"\\u0063lassBindings"=[]', 1, ["unique record field"], "classBindings"],
  ["escaped unterminated duplicate prefix", beforeVector, '"\\u0063l', 1, ["methodBindings"], "c"],
  ["escaped duplicate prefix before later escape", beforeVector, '"\\u0063l\\q', 1, ["methodBindings"], "c"],
  ["unquoted nonduplicate prefix", beforeVector, "cl", 0, ["methodBindings"], "cl"],
  ["unquoted proper prefix", beforeVector, "meth", 4, ["methodBindings"], "meth"],
  ["quoted proper prefix", beforeVector, '"meth"', 5, ["methodBindings"], "meth"],
  ["empty next name", beforeVector, '""', 1, ["methodBindings"], ""],
  ["lexical failure before any deviation", beforeVector, '"\\q', 2, ["JSON escape"], "q"],
  ["matching prefix before lexical failure", beforeVector, '"me\\q', 4, ["JSON escape"], "q"],
  ["matching prefix before bad hexadecimal", beforeVector, '"me\\u0q00', 5, ["four hexadecimal digits"], "0q00"],
  ["matching prefix before missing quote", beforeVector, '"meth', 5, ['"'], null],
  ["common-prefix complete duplicate", beforeArtifact, "body=", 1, ["unique record field"], "body"],
  ["common-prefix quoted duplicate", beforeArtifact, '"body"=', 2, ["unique record field"], "body"],
  ["common-prefix escaped deviation", beforeArtifact, '"b\\u006fdy"=', 2, ["unique record field"], "body"],
  ["common-prefix incomplete deviation", beforeArtifact, '"bo', 2, ["bindings"], "o"],
  ["common-prefix deviation beats later escape", beforeArtifact, '"bo\\q', 2, ["bindings"], "o"],
  ["unquoted extra after all fields", afterVectorFields, "extra=0", 0, ["end of record"], "extra"],
  ["complete quoted extra after all fields", afterVectorFields, '"extra"=0', 1, ["end of record"], "extra"],
  ["unterminated quoted extra after all fields", afterVectorFields, '"extra', 1, ["end of record"], "e"],
  ["malformed quoted extra after all fields", afterVectorFields, '"extra\\q', 1, ["end of record"], "e"],
  ["escaped complete extra after all fields", afterVectorFields, '"\\u0065xtra"=0', 1, ["end of record"], "extra"],
  ["escaped unfinished extra after all fields", afterVectorFields, '"\\u0065xtra', 1, ["end of record"], "e"],
  ["complete duplicate after all fields", afterVectorFields, '"classBindings"=[]', 1, ["unique record field"], "classBindings"],
  ["unquoted duplicate after all fields", afterVectorFields, "classBindings=[]", 0, ["unique record field"], "classBindings"],
  ["empty quoted extra after all fields", afterVectorFields, '""=0', 1, ["end of record"], ""],
  ["zero-field record complete extra", beforeZeroFields, '"extra"=0', 1, ["end of record"], "extra"],
  ["zero-field record unfinished extra", beforeZeroFields, '"extra', 1, ["end of record"], "e"],
  ["zero-field record escaped extra", beforeZeroFields, '"\\u0065xtra', 1, ["end of record"], "e"],
  ["zero-field record empty extra", beforeZeroFields, '""', 1, ["end of record"], ""],
  ["implicit label is not an already given field", beforeZeroFields, "kind=", 0, ["end of record"], "kind"],
  ["unquoted exceptional number is still a name token", beforeVector, "NaN=", 0, ["methodBindings"], "NaN"],
];
for (const [name, prefix, suffix, relativeOffset, expected, found] of fieldNameCases) {
  test(`C2939/C2940 full field-position result: ${name}`, () => {
    const offset = prefix.length + relativeOffset;
    assertCompleteValue(product.parseTir(prefix + suffix), { kind: "invalid-text", offset, line: 1, column: offset + 1, expected, found });
  });
}

for (const name of ['"classBindings"', '"\\u0063lassBindings"']) {
  test(`well-formed decoded required name ${name} retains the complete declared body`, () => {
    const baseline = readFileSync(resolve(repository, functionDirectory, "empty-module.input.tir"), "utf8");
    const text = baseline.replace("classBindings=[]", `${name}=[]`);
    const parsed = product.parseTir(text);
    assert.equal(parsed.kind, "parsed");
    assertCompleteValue(parsed.value, emptyModuleBody(), undefined, compareCaseValues);
    assertCompleteValue(product.printTir(parsed.value), baseline, undefined, sameWire);
  });
}

test("first-position offsets use actual UTF16 line and column", () => {
  assertCompleteValue(product.parseTir("\n\tTirBody()"), { kind: "invalid-text", offset: 10, line: 2, column: 10,
    expected: ["body"], found: ")" });
});

for (const [name, value, quoted] of [
  ["escapes", '"\\/\b\f\n\r\t', '"\\\"\\\\/\\b\\f\\n\\r\\t"'],
  ["lone-surrogates", '\ud800x\udc00', '"\\ud800x\\udc00"'],
  ["surrogate-pair", '😀', '"😀"'],
]) {
  test(`the complete UTF16 ${name} value has its independently authored wire spelling`, () => {
    const body = emptyModuleBody();
    body.locals = [{ id: 0, declaration: { kind: "body", value: { body: bodyId, node: 0 } }, name: value,
      role: "binding", capturedFrom: null, mutable: false, storage: 0 }];
    const local = `TirLocal(id=l:0, declaration=body(value=NodeRef(body=body:"${bodyId}", node=n:0)), ` +
      `name=${quoted}, role="binding", capturedFrom=null, mutable=false, storage=t:0)`;
    const expected = readFileSync(resolve(repository, functionDirectory, "empty-module.input.tir"), "utf8")
      .replace("locals=[]", `locals=[${local}]`);
    assertCompleteValue(product.printTir(body), expected, name, sameWire);
    const parsed = product.parseTir(expected);
    assert.equal(parsed.kind, "parsed");
    assertCompleteValue(parsed.value, body, "entire decoded value, not one escaped character", compareCaseValues);
  });
}

for (const kind of ["SingleLineCommentTrivia", "MultiLineCommentTrivia"]) {
  test(`ordinary named Pragma keeps its declared kind field and all dynamic keys: ${kind}`, () => {
    const body = emptyModuleBody();
    const keys = ["plain", "with-hyphen", "true", "false", "null", "NaN", "contains space", "__proto__"];
    const argument = { pos: 0, end: 0, name: "input", value: "v" };
    body.root.pragmas = [{ pos: 0, end: 0, kind, hasTrailingNewLine: false, name: "sample",
      args: keys.toSorted().map(name => ({ name, value: argument })) }];
    const argumentWire = 'PragmaArgument(pos=0, end=0, name="input", value="v")';
    const names = ['NaN', '__proto__', '"contains space"', 'false', 'null', 'plain', 'true', '"with-hyphen"'];
    const pragmaWire = `Pragma(pos=0, end=0, kind="${kind}", hasTrailingNewLine=false, name="sample", ` +
      `args=PragmaArguments(${names.map(name => `${name}=${argumentWire}`).join(", ")}))`;
    const expected = readFileSync(resolve(repository, functionDirectory, "empty-module.input.tir"), "utf8")
      .replace("pragmas=[]", `pragmas=[${pragmaWire}]`);
    assertCompleteValue(product.printTir(body), expected, "the full named-record kind and dictionary vector are authored before execution", sameWire);
    const parsed = product.parseTir(expected);
    assert.equal(parsed.kind, "parsed");
    assertCompleteValue(parsed.value, body, undefined, compareCaseValues);
  });
}

for (const reversed of [false, true]) {
  test(`pragma dictionary canonical UTF-16 order ignores insertion order: reversed=${reversed}`, () => {
    const body = emptyModuleBody();
    const keys = ["\uE000", "\u{10000}", "b", "aa", "a", ""];
    const argument = { pos: 0, end: 0, name: "input", value: "v" };
    body.root.pragmas = [{ pos: 0, end: 0, kind: "SingleLineCommentTrivia", hasTrailingNewLine: false, name: "sample",
      args: (reversed ? keys.slice().reverse() : keys).map(name => ({ name, value: argument })) }];
    const argumentWire = 'PragmaArgument(pos=0, end=0, name="input", value="v")';
    const names = ['""', 'a', 'aa', 'b', '"\u{10000}"', '"\uE000"'];
    const pragma = 'Pragma(pos=0, end=0, kind="SingleLineCommentTrivia", hasTrailingNewLine=false, name="sample", ' +
      `args=PragmaArguments(${names.map(name => `${name}=${argumentWire}`).join(", ")}))`;
    const expected = readFileSync(resolve(repository, functionDirectory, "empty-module.input.tir"), "utf8")
      .replace("pragmas=[]", `pragmas=[${pragma}]`);
    assertCompleteValue(product.printTir(body), expected, "entire independently authored UTF-16 dictionary order", sameWire);
    body.root.pragmas[0].args = keys.toSorted().map(name => ({ name, value: argument }));
    const parsed = product.parseTir(expected);
    assert.equal(parsed.kind, "parsed");
    assertCompleteValue(parsed.value, body, "entire dictionary including the empty key and surrogate pair", compareCaseValues);
  });
}

for (const [key, decoded, first, previous = "b"] of [['a', 'a', 0], ['"a"', 'a', 1],
  ['"\\u0061"', 'a', 1], ['""', '', 1], ['"a"', 'a', 1, 'aa']]) {
  for (const laterLexicalError of [false, true]) {
    test(`pragma dictionary rejects key ${key} after ${previous}, later lexical error=${laterLexicalError}`, () => {
      const argument = { pos: 0, end: 0, name: "input", value: "v" };
      const argumentWire = 'PragmaArgument(pos=0, end=0, name="input", value="v")';
      const before = 'Pragma(pos=0, end=0, kind="SingleLineCommentTrivia", hasTrailingNewLine=false, name="sample", ' +
        `args=PragmaArguments(${previous}=${argumentWire}, `;
      const pragma = before + key + '=' + (laterLexicalError ? '@' : argumentWire) + '))';
      const input = readFileSync(resolve(repository, functionDirectory, "empty-module.input.tir"), "utf8")
        .replace("pragmas=[]", `pragmas=[${pragma}]`);
      const offset = input.indexOf(before) + before.length + first;
      const lines = input.slice(0, offset).split("\n");
      assertCompleteValue(product.parseTir(input), { kind: "invalid-text", offset, line: lines.length,
        column: lines[lines.length - 1].length + 1, expected: ["UTF-16 ordered dictionary key"], found: decoded });
      const body = emptyModuleBody();
      body.root.pragmas = [{ pos: 0, end: 0, kind: "SingleLineCommentTrivia", hasTrailingNewLine: false, name: "sample",
        args: [decoded, previous].toSorted().map(name => ({ name, value: argument })) }];
      const names = decoded === "" ? ['""', previous] : ['a', previous];
      const corrected = readFileSync(resolve(repository, functionDirectory, "empty-module.input.tir"), "utf8")
        .replace("pragmas=[]", 'pragmas=[Pragma(pos=0, end=0, kind="SingleLineCommentTrivia", hasTrailingNewLine=false, name="sample", ' +
          `args=PragmaArguments(${names.map(name => `${name}=${argumentWire}`).join(", ")}))]`);
      const parsed = product.parseTir(corrected);
      assert.equal(parsed.kind, "parsed");
      assertCompleteValue(parsed.value, body, "complete corrected dictionary, not one key", compareCaseValues);
      assertCompleteValue(product.printTir(parsed.value), corrected, "complete corrected canonical text", sameWire);
    });
  }
}

for (const key of ['"a\\q"', '"\\u0061\\q"']) {
  test(`an already out-of-order pragma key precedes its own later lexical failure: ${key}`, () => {
    const argument = 'PragmaArgument(pos=0, end=0, name="input", value="v")';
    const before = 'Pragma(pos=0, end=0, kind="SingleLineCommentTrivia", hasTrailingNewLine=false, name="sample", ' +
      `args=PragmaArguments(b=${argument}, `;
    const input = readFileSync(resolve(repository, functionDirectory, "empty-module.input.tir"), "utf8")
      .replace("pragmas=[]", `pragmas=[${before}${key}=${argument}))]`);
    const offset = input.indexOf(before) + before.length + 1;
    const lines = input.slice(0, offset).split("\n");
    assertCompleteValue(product.parseTir(input), { kind: "invalid-text", offset, line: lines.length,
      column: lines[lines.length - 1].length + 1, expected: ["UTF-16 ordered dictionary key"], found: "a" });
  });
}

for (const name of ["params", "evidence", "syntax"]) {
  test(`a genuine sparse ${name} vector is an exact-path caller defect in both public ports`, () => {
    const body = emptyModuleBody();
    if (name === "syntax") body.root.statements.nodes = Array(1);
    else body[name] = Array(1);
    const printPath = name === "syntax" ? '$syntax["statements"]["nodes"][0]' : `$body["${name}"][0]`;
    const verifyPath = name === "syntax" ? '$body["root"]["statements"]["nodes"][0]' : `$body["${name}"][0]`;
    assert.throws(() => product.printTir(body), { name: "TypeError", message: `ir-tir: sparse vector at ${printPath}` });
    assert.throws(() => verifyBody(emptyVerificationInput(body), body),
      { name: "TypeError", message: `ir-tir: sparse vector at ${verifyPath}` });
  });
}

test("100000 actual inline CategoryEvidence layers print and parse without host-stack recursion or textual refusal", () => {
  const body = emptyModuleBody();
  let category = { kind: "dynamic" };
  for (let depth = 0; depth < 100000; depth++) category = { kind: "choice", alternatives: [category] };
  body.evidence = [typeEvidence(category)];
  const categoryWire = `${"choice(alternatives=[".repeat(100000)}dynamic()${"])".repeat(100000)}`;
  const expected = readFileSync(resolve(repository, functionDirectory, "empty-module.input.tir"), "utf8")
    .replace("evidence=[]", `evidence=[${evidenceText(categoryWire)}]`);
  assertCompleteValue(product.printTir(body), expected, "the entire deep wire has an independently authored frame at every level", sameWire);
  const parsed = product.parseTir(expected);
  assert.equal(parsed.kind, "parsed");
  assertCompleteValue(parsed.value, body, "the entire 100000-layer typed value is retained", compareCaseValues);
  assertCompleteValue(verifyBody(emptyVerificationInput(body), body), [], "the same complete 100000-layer value is verified without recursion or refusal");
});

test("C2931 actual inline cycles throw with their exact path while inline aliases are encoded by value", () => {
  const alternatives = [];
  const cycle = { kind: "choice", alternatives };
  alternatives.push(cycle);
  const cyclicBody = emptyModuleBody();
  cyclicBody.evidence = [typeEvidence(cycle)];
  assert.throws(() => product.printTir(cyclicBody), { name: "TypeError",
    message: 'ir-tir: inline cycle at $body["evidence"][0]["category"]["alternatives"][0]' });
  assert.throws(() => verifyBody(emptyVerificationInput(cyclicBody), cyclicBody), { name: "TypeError",
    message: 'ir-tir: inline cycle at $body["evidence"][0]["category"]["alternatives"][0]' });
  const shared = { kind: "choice", alternatives: [{ kind: "dynamic" }] };
  const body = emptyModuleBody();
  body.evidence = [typeEvidence(shared), typeEvidence(shared)];
  const inline = evidenceText("choice(alternatives=[dynamic()])");
  const expected = readFileSync(resolve(repository, functionDirectory, "empty-module.input.tir"), "utf8")
    .replace("evidence=[]", `evidence=[${inline}, ${inline}]`);
  assertCompleteValue(product.printTir(body), expected, "shared inline records are each encoded by value", sameWire);
  const parsed = product.parseTir(expected);
  assert.equal(parsed.kind, "parsed");
  assertCompleteValue(parsed.value, body, "complete inline values agree independently of allocation", compareCaseValues);
  assert.equal(parsed.value.evidence[0].category === parsed.value.evidence[1].category, false,
    "inline identity is not an arena identity or hidden second wire reference");
  assertCompleteValue(verifyBody(emptyVerificationInput(body), body), [], "shared inline values are each visited without being mistaken for a cycle");
});

test("every TypedString role retains the full closed record and exact UTF16/lone-surrogate payload", () => {
  const text = 'x\ud800\udfff😀\u0000\n"\\';
  const fields = { text, tokenFlags: ["SingleQuote", "UnicodeEscape"] };
  const fieldsWire = `text=${JSON.stringify(text)}, tokenFlags=["SingleQuote", "UnicodeEscape"]`;
  for (const [phase, wire] of [
    [{ ...valueFact(), role: "value", value: text }, `TypedString(${valueWire}, role="value", value=${JSON.stringify(text)})`],
    [{ role: "property-name", key: { kind: "text", value: text } }, `TypedString(role="property-name", key=text(value=${JSON.stringify(text)}))`],
    [{ role: "declaration-name", declaration: { kind: "definition", definition: ownerId } },
      `TypedString(role="declaration-name", declaration=definition(definition=def:"${ownerId}"))`],
    [{ role: "type-literal", type: 0 }, 'TypedString(role="type-literal", type=t:0)'],
    [{ role: "module-specifier", target: { target: "project", module: moduleId } },
      `TypedString(role="module-specifier", target=ImportTarget(target="project", module=mod:"${moduleId}"))`],
    [{ role: "export-name", binding: codecBinding }, `TypedString(role="export-name", binding=${codecBindingWire})`],
    [{ role: "attribute-value", value: text }, `TypedString(role="attribute-value", value=${JSON.stringify(text)})`],
  ]) assertExpressionRoundTrip("StringLiteral", fields, fieldsWire, phase, wire);
});

test("every TypedName arm and every resolution discriminant is distinct and fully framed", () => {
  const fields = { text: "name" };
  for (const [resolution, wire] of [
    [{ kind: "local", local: { body: bodyId, local: 0 } }, `local(local=${localWire})`],
    [{ kind: "definition", definition: ownerId, aliases: [codecBinding] }, `definition(definition=def:"${ownerId}", aliases=[${codecBindingWire}])`],
    [{ kind: "module", target: { target: "project", module: moduleId } }, `module(target=ImportTarget(target="project", module=mod:"${moduleId}"))`],
    [{ kind: "error", diagnostic: 0 }, "error(diagnostic=0)"],
  ]) assertExpressionRoundTrip("Identifier", fields, 'text="name"', { ...valueFact(), role: "value", resolution },
    `TypedName(${valueWire}, role="value", resolution=${wire})`);
  for (const [phase, wire] of [
    [{ ...valueFact(), role: "shorthand-value", key: { kind: "text", value: "name" }, resolution: { kind: "local", local: { body: bodyId, local: 0 } } },
      `TypedName(${valueWire}, role="shorthand-value", key=text(value="name"), resolution=local(local=${localWire}))`],
    [{ role: "assignment-target", resolution: { kind: "local", local: { body: bodyId, local: 0 } }, access: { kind: "write", storage: 0 } },
      `TypedName(role="assignment-target", resolution=local(local=${localWire}), access=write(storage=t:0))`],
    [{ role: "assignment-target", resolution: { kind: "local", local: { body: bodyId, local: 0 } },
      access: { kind: "read-write", storage: 0, read: 0, narrowing: null, evidenceIndex: null } },
      `TypedName(role="assignment-target", resolution=local(local=${localWire}), access=read-write(storage=t:0, read=t:0, narrowing=null, evidenceIndex=null))`],
    [{ role: "declaration-name", declaration: { kind: "definition", definition: ownerId }, storage: null },
      `TypedName(role="declaration-name", declaration=definition(definition=def:"${ownerId}"), storage=null)`],
    [{ role: "property-name", key: { kind: "symbol", declaration: ownerId } },
      `TypedName(role="property-name", key=symbol(declaration=def:"${ownerId}"))`],
    [{ role: "type-name", type: 0, declarations: [ownerId] }, `TypedName(role="type-name", type=t:0, declarations=[def:"${ownerId}"])`],
    [{ role: "label", target: { body: bodyId, node: 0 } }, `TypedName(role="label", target=NodeRef(body=body:"${bodyId}", node=n:0))`],
    [{ role: "private-name", declaration: ownerId }, `TypedName(role="private-name", declaration=def:"${ownerId}")`],
    [{ role: "binding-name", binding: codecBinding }, `TypedName(role="binding-name", binding=${codecBindingWire})`],
  ]) assertExpressionRoundTrip("Identifier", fields, 'text="name"', phase, wire);
});

test("all numeric and bigint roles preserve exact rationals and integers beyond host floating precision", () => {
  const rational = { numerator: 9007199254740993n, denominator: 11n, negativeZero: false };
  const exact = "ExactRational(numerator=9007199254740993n, denominator=11n, negativeZero=false)";
  for (const [phase, wire] of [
    [{ ...valueFact(), role: "value", value: rational }, `TypedNumber(${valueWire}, role="value", value=${exact})`],
    [{ role: "property-name", key: { kind: "number", value: rational } }, `TypedNumber(role="property-name", key=number(value=${exact}))`],
    [{ role: "declaration-name", declaration: { kind: "local", local: { body: bodyId, local: 0 } } },
      `TypedNumber(role="declaration-name", declaration=local(local=${localWire}))`],
    [{ role: "type-literal", type: 0 }, 'TypedNumber(role="type-literal", type=t:0)'],
  ]) assertExpressionRoundTrip("NumericLiteral", { text: "9007199254740993", tokenFlags: ["ContainsSeparator"] },
    'text="9007199254740993", tokenFlags=["ContainsSeparator"]', phase, wire);
  for (const [phase, wire] of [
    [{ ...valueFact(), role: "value", value: -9007199254740993n }, `TypedBigInt(${valueWire}, role="value", value=-9007199254740993n)`],
    [{ role: "property-name", key: { kind: "number", value: rational } }, `TypedBigInt(role="property-name", key=number(value=${exact}))`],
    [{ role: "declaration-name", declaration: { kind: "definition", definition: ownerId } },
      `TypedBigInt(role="declaration-name", declaration=definition(definition=def:"${ownerId}"))`],
    [{ role: "type-literal", type: 0 }, 'TypedBigInt(role="type-literal", type=t:0)'],
  ]) assertExpressionRoundTrip("BigIntLiteral", { text: "-9007199254740993n", tokenFlags: [] },
    'text="-9007199254740993n", tokenFlags=[]', phase, wire);
});

for (const holder of ["property-access", "element-access", "property", "shorthand"]) {
  test(`deferred ${holder} makes no selected-member query`, () => {
    const fixture = memberScenario(holder);
    const root = fixture.body.root.statements.nodes[0].node.expression;
    const actual = holder === "property" || holder === "shorthand" ? root.properties.nodes[0].tsonic : root.tsonic;
    const deferred = { kind: "deferred", deferred: { result: 0, invocation: { rule: "member", input: {
      context: { occurrence: { body: bodyId, node: fixture.memberNode }, origin: origin(), bindings: emptyBindings() },
      receiver: { ...typeEvidence({ kind: "dynamic" }), type: 1,
        component: { kind: "body", value: { body: bodyId, node: 3 } } },
      key: { kind: "text", value: "x" }, access: "read", origins: [],
    } } } };
    if (holder === "property" || holder === "shorthand") actual.member = deferred;
    else actual.selection = deferred;
    fixture.input.memberTableOf = () => { throw new Error("a deferred request has no selected member occurrence"); };
    assertCompleteValue(verifyBody(fixture.input, fixture.body), []);
    assertCompleteValue(fixture.queries, []);
    deferred.deferred.invocation.input.context.occurrence.node = 0;
    assertCompleteValue(verifyBody(fixture.input, fixture.body), [nodeViolation("deferred-parameters", fixture.memberNode,
      "saved invocation does not retain its occurrence and complete captured rigid-parameter support")]);
  });
}

function attachActualGetter(fixture) {
  const definition = "D[M[P[api];surface];x-get]";
  const advertised = { declaration: definition, role: "advertised", signature: 1, body: null };
  const api = { declaration: definition, role: "api-signature", signature: 1, body: null };
  const foreignName = { ...header(0), origin: { module: "M[P[api];surface]", start: 0, length: 0, derived: [] },
    kind: "Identifier", text: "x-get",
    tsonic: { core: emptyCore(), role: "declaration-name", declaration: { kind: "definition", definition } } };
  fixture.input.types.signatures.push({ id: 1, declaration: definition,
    owner: { kind: "item", value: { owner: definition, node: 0 } }, composition: null, kind: "call",
    typeParameters: [], receiver: 1, parameters: [], result: 0 });
  const originalNodeOf = fixture.input.nodeOf;
  fixture.input.nodeOf = reference => reference.kind === "item" && reference.value.owner === definition && reference.value.node === 0
    ? foreignName : originalNodeOf(reference);
  const originalDeclarationOf = fixture.input.declarationOf;
  fixture.input.declarationOf = actual => actual === definition ? { scope: emptyScope(), parameterCount: 0,
    endpoints: [advertised, api] } : originalDeclarationOf(actual);
  fixture.decision.getter = api;
  fixture.decision.location = { kind: "accessor" };
  fixture.selection.getter = { activation: null, captures: [], decision: { candidate: 0, advertised, api,
    bindings: emptyBindings(), implementationBindings: emptyBindings(), parameters: [],
    completion: { signature: 1, completion: 0, yielded: null, sent: null }, result: 0, activation: null } };
  fixture.table.accessors = [{ origin: fixture.decision.origins[0], getter: definition, setter: null }];
  bodyScopes(fixture.input, fixture.body).push(emptyScope(), emptyScope());
  const source = fixture.input.source.tree.statements.nodes[0].expression.tsonic;
  if ("accessor" in source) source.accessor = available({ kind: "accessor-get", receiver: 3, arguments: [], typeArguments: [],
    candidates: { kind: "unavailable", reason: "not-provided", causes: [] }, resolvedSignature: available(1) });
}

function assignmentMemberScenario(access) {
  const fixture = memberScenario("property-access");
  const member = fixture.body.root.statements.nodes[0].node.expression;
  const sourceMember = fixture.input.source.tree.statements.nodes[0].expression;
  member.parent = 10;
  sourceMember.parent = 10;
  member.tsonic = { role: "assignment-target", selection: { kind: "decided", decision: fixture.selection },
    access: access === "write" ? { kind: "write", storage: 0 } : { kind: "read-write", storage: 0,
      read: 0, narrowing: null, evidenceIndex: null } };
  sourceMember.tsonic = { core: emptyCore(), role: "assignment-target", views: checkerViews(0),
    place: { kind: "unavailable", reason: "not-provided", causes: [] }, access, origins: sourceMember.tsonic.origins, accessor: available(null) };
  const value = { ...header(12, 10), kind: "StringLiteral", text: "assigned", tokenFlags: [],
    tsonic: { ...typedValue(), role: "value", value: "assigned" } };
  const sourceValue = { ...header(12, 10), kind: "StringLiteral", text: "assigned", tokenFlags: [],
    tsonic: { core: emptyCore(), role: "value", value: checkedValue(), literal: { kind: "string", value: "assigned" } } };
  const operatorKind = access === "write" ? "EqualsToken" : "PlusEqualsToken";
  const operator = { ...header(11, 10), kind: operatorKind, tsonic: null };
  const sourceOperator = { ...header(11, 10), kind: operatorKind, tsonic: null };
  const calculation = access === "write" ? null : { kind: "decided", decision: { permissionScope: null,
    decision: { kind: "selected", operation: { kind: "string-operator", operator: "+" }, operands: [0, 0],
      result: 0, execution: { kind: "pure" } } } };
  const typed = { ...header(10, 1), kind: "BinaryExpression", modifiers: null, left: member, type: null,
    operatorToken: operator, right: value, tsonic: { ...typedValue(), role: "assignment", storage: 0, calculation, selection: null } };
  const original = { ...header(10, 1), kind: "BinaryExpression", modifiers: null, left: sourceMember, type: null,
    operatorToken: sourceOperator, right: sourceValue, tsonic: { core: emptyCore(), role: "assignment", value: checkedValue(),
      target: { kind: "unavailable", reason: "not-provided", causes: [] } } };
  fixture.body.root.statements.nodes[0].node.expression = typed;
  fixture.input.source.tree.statements.nodes[0].expression = original;
  const nodeOf = fixture.input.nodeOf;
  const nodes = new Map([[10, original], [11, sourceOperator], [12, sourceValue]]);
  fixture.input.nodeOf = reference => reference.kind === "body" && reference.value.body === bodyId ||
    reference.kind === "item" && reference.value.owner === ownerId ? nodes.get(reference.value.node) ?? nodeOf(reference) : nodeOf(reference);
  return { ...fixture, member, sourceMember };
}

function attachActualSetter(fixture) {
  const definition = "D[M[P[api];surface];x-set]";
  const parameter = "D[M[P[api];surface];x-set/value]";
  const signature = fixture.input.types.signatures.length;
  const advertised = { declaration: definition, role: "advertised", signature, body: null };
  const api = { declaration: definition, role: "api-signature", signature, body: null };
  const name = { ...header(1), origin: { module: "M[P[api];surface]", start: 0, length: 0, derived: [] }, kind: "Identifier",
    text: "x-set", tsonic: { core: emptyCore(), role: "declaration-name", declaration: { kind: "definition", definition } } };
  const parameterName = { ...header(2), origin: name.origin, kind: "Identifier", text: "value",
    tsonic: { core: emptyCore(), role: "declaration-name", declaration: { kind: "definition", definition: parameter } } };
  fixture.input.types.signatures.push({ id: signature, declaration: definition,
    owner: { kind: "item", value: { owner: definition, node: 1 } }, composition: null, kind: "call", typeParameters: [],
    receiver: 1, parameters: [{ declaration: parameter, kind: "required", type: 0, passing: "by-value", initializer: null, acceptsOmission: false }], result: 0 });
  const nodeOf = fixture.input.nodeOf;
  fixture.input.nodeOf = reference => reference.kind === "item" && reference.value.node === 1 && reference.value.owner === definition
    ? name : reference.kind === "item" && reference.value.node === 2 && reference.value.owner === parameter ? parameterName : nodeOf(reference);
  const declarationOf = fixture.input.declarationOf;
  fixture.input.declarationOf = selected => selected === definition ? { scope: emptyScope(), parameterCount: 1, endpoints: [advertised, api] }
    : selected === parameter ? { scope: emptyScope(), parameterCount: 0, endpoints: [] } : declarationOf(selected);
  fixture.decision.setter = api;
  fixture.decision.location = { kind: "accessor" };
  fixture.selection.setter = { activation: null, captures: [], decision: { candidate: 0, advertised, api,
    bindings: emptyBindings(), implementationBindings: emptyBindings(), parameters: [
      { kind: "argument", parameter: 0, argument: 0, component: null, passing: "by-value" }],
    completion: { signature, completion: 0, yielded: null, sent: null }, result: 0, activation: null } };
  fixture.table.accessors = [{ origin: fixture.decision.origins[0], getter: fixture.decision.getter?.declaration ?? null, setter: definition }];
  fixture.sourceMember.tsonic.accessor = available({ kind: "accessor-set", receiver: 3,
    arguments: [{ kind: "value", expression: 12 }], typeArguments: [],
    candidates: { kind: "unavailable", reason: "not-provided", causes: [] }, resolvedSignature: available(signature) });
  bodyScopes(fixture.input, fixture.body).push(emptyScope(), emptyScope());
}

for (const holder of ["property-access", "element-access", "property", "shorthand"]) {
  test(`actual bodyless accessor endpoints are retained for ${holder}`, () => {
    const fixture = memberScenario(holder);
    attachActualGetter(fixture);
    assertCompleteValue(verifyBody(fixture.input, fixture.body), []);
    fixture.selection.getter = null;
    bodyScopes(fixture.input, fixture.body).splice(-2);
    assertCompleteValue(verifyBody(fixture.input, fixture.body), [nodeViolation("accessor-activation", fixture.memberNode,
      "selected accessor activation does not retain the actual member endpoint and access role")]);
  });
}

for (const holder of ["property-access", "element-access", "property", "shorthand", "pattern", "construction"]) {
  test(`authentic per-instance member occurrence: ${holder}`, () => {
    const fixture = memberScenario(holder);
    const expectedQueries = fixture.facts.map(fact => ({ instance: fact.instance, occurrence: fact.occurrence }));
    assertCompleteValue(verifyBody(fixture.input, fixture.body), []);
    assertCompleteValue(fixture.queries, expectedQueries);
  });
  for (const mismatch of ["instance", "ordinal", "absent", "empty-table"]) {
    test(`missing authentic member association: ${holder}/${mismatch}`, () => {
      const fixture = memberScenario(holder);
      if (mismatch === "instance") fixture.facts[0].instance.bindings = { kind: "instantiated", bindings: emptyBindings() };
      if (mismatch === "ordinal") fixture.facts[0].occurrence.ordinal = 1;
      if (mismatch === "absent") fixture.facts.length = 0;
      if (mismatch === "empty-table") {
        fixture.input.types.terms.push({ kind: "intrinsic", intrinsic: "object" });
        fixture.table.receiver = 2;
        fixture.table.members = [];
        if (holder === "property-access" || holder === "element-access") {
          const actualReceiver = fixture.body.root.statements.nodes[0].node.expression.expression;
          actualReceiver.tsonic.type = 2;
          actualReceiver.tsonic.convertedType = 2;
          fixture.input.source.tree.statements.nodes[0].expression.expression.tsonic.value.views.read = available(2);
        }
      }
      assertCompleteValue(verifyBody(fixture.input, fixture.body), [nodeViolation("member-origin", fixture.memberNode,
        "member selection does not retain a real member key and its actual declared origins")]);
      assert.equal(fixture.queries.length, 1);
    });
  }
}

test("a conversion that carries a construction is refused, and its part and the node's own remain two distinct occurrences", () => {
  const fixture = memberScenario("construction", true);
  const expected = [0, 1].map(ordinal => ({ instance: { body: bodyId, bindings: { kind: "parametric" } },
    occurrence: { kind: "construction-part", node: 2, ordinal, source: { body: bodyId, node: 2 },
      destination: { root: { kind: "body", value: { body: bodyId, node: 2 } }, path: [] }, part: 0 } }));
  assertCompleteValue(verifyBody(fixture.input, fixture.body), [nodeViolation("conversion-operation", 2,
    "a conversion is carried out by the conversion identity, and a backed conversion by a core or library operation")]);
  assertCompleteValue(fixture.queries, expected);
});

for (const holder of ["calculation", "protocol", "disposal"]) {
  test(`actual ${holder} construction-part holders use the same canonical per-instance occurrence reader`, () => {
    const fixture = nestedPartScenario(holder);
    const expected = [{ instance: fixture.fact.instance, occurrence: fixture.fact.occurrence }];
    assertCompleteValue(verifyBody(fixture.input, fixture.body), []);
    assertCompleteValue(fixture.queries, expected);
  });
  test(`actual ${holder} construction-part holders cannot reuse another operation's ordinal`, () => {
    const fixture = nestedPartScenario(holder);
    fixture.fact.occurrence.ordinal = 1;
    assertCompleteValue(verifyBody(fixture.input, fixture.body), [nodeViolation("member-origin", fixture.node.id,
      "member selection does not retain a real member key and its actual declared origins")]);
    assert.equal(fixture.queries.length, 1);
  });
}

for (const coordinate of ["source", "destination", "part"]) {
  test(`a construction member needs its complete authentic part association: ${coordinate}`, () => {
    const fixture = memberScenario("construction");
    if (coordinate === "source") fixture.facts[0].occurrence.source = { body: bodyId, node: 1 };
    if (coordinate === "destination") fixture.facts[0].occurrence.destination = {
      root: { kind: "body", value: { body: bodyId, node: 1 } }, path: [] };
    if (coordinate === "part") fixture.facts[0].occurrence.part = 1;
    assertCompleteValue(verifyBody(fixture.input, fixture.body), [nodeViolation("member-origin", 2,
      "member selection does not retain a real member key and its actual declared origins")]);
  });
}

for (const flags of [[], ["Ambient"]]) {
  for (const multiLine of [false, true]) {
    test(`F1 complete Block flags=${flags.join("/")} multiLine=${multiLine}`, () => {
      const body = emptyModuleBody();
      body.root = { ...header(0), flags, kind: "Block", statements: nodeList(), multiLine, tsonic: null };
      const bodyHeader = readFileSync(resolve(repository, functionDirectory, "empty-module.input.tir"), "utf8").split("\n")[0];
      const expected = typedWire(bodyHeader, [
        `n:0=Block(${syntaxHeaderWire(0, null, flags)}, statements=NodeList(loc=TextRange(pos=0, end=0), nodes=[]), multiLine=${multiLine}, tsonic=null)`,
      ]);
      assertBodyRoundTrip(body, expected, "F1 entire declared Block");
      const text = expected.replace(`, multiLine=${multiLine}`, "");
      const offset = text.indexOf("tsonic=null", text.indexOf("n:0=Block("));
      assertInvalidText(text, offset, ["multiLine"], "tsonic");
    });
  }
}

test("C2996 module node sites belong to the subject tree, not its conflicting publication label", () => {
  const fixture = typeAliasModuleScenario();
  fixture.module.module = "M[P[p];other]";
  fixture.input.bindingScopesOf = target => completeScopes(target.kind === "module" && target.module === "M[P[p];other]" ? [] : null);
  assertCompleteValue(verifyChapter(fixture.input, fixture.module), [nodeViolation("module-node-identity", 0,
    "module tree does not retain its actual source and publication identity")]);
  fixture.module.module = moduleId;
  fixture.input.bindingScopesOf = target => completeScopes(target.kind === "module" && target.module === moduleId ? [] : null);
  assertCompleteValue(verifyChapter(fixture.input, fixture.module), []);
});

test("C2996 another genuine module qualifies its own body subject and restored identity", () => {
  const module = "M[P[p];second]";
  const owner = "D[M[P[p];second]]";
  const identity = "B[D[M[P[p];second]];module;0]";
  const body = emptyModuleBody();
  body.body = identity;
  body.owner = owner;
  body.root.origin = { module, start: 0, length: 0, derived: [] };
  body.root.endOfFileToken.origin = { module, start: 0, length: 0, derived: [] };
  body.root.tsonic.module = module;
  body.root.tsonic.template.body = identity;
  const input = emptyVerificationInput(body);
  input.module.module = module;
  input.source.module = module;
  input.source.tree.origin = { module, start: 0, length: 0, derived: [] };
  input.source.tree.endOfFileToken.origin = { module, start: 0, length: 0, derived: [] };
  input.source.tree.tsonic.definition = owner;
  input.source.tree.tsonic.body = identity;
  input.source.items = [{ definition: owner, node: 0 }];
  input.source.bodies[0].body = identity;
  input.source.bodies[0].owner = owner;
  input.types.signatures[0].declaration = owner;
  input.types.signatures[0].owner = { kind: "body", value: { body: identity, node: 0 } };
  input.declarationOf = selected => selected === owner ? { scope: emptyScope(), parameterCount: 0, endpoints: [] } : null;
  input.nodeOf = reference => reference.kind === "body" && reference.value.body === identity ||
    reference.kind === "item" && reference.value.owner === owner ? reference.value.node === 0 ? input.source.tree :
      reference.value.node === 1 ? input.source.tree.endOfFileToken : null : null;
  assertCompleteValue(verifyBody(input, body), []);
  input.module.module = moduleId;
  assertCompleteValue(verifyBody(input, body), [{ rule: "module-node-identity",
    site: { kind: "node", module, node: 0 }, detail: [{ kind: "text",
      value: "body does not retain its module identity and canonical parametric subtree" }] }]);
  input.module.module = module;
  assertCompleteValue(verifyBody(input, body), []);
});

for (const shape of ["ordinary-field", "flags", "sparse-flags", "directive", "inline-field"]) {
  test(`F4 complete supplied syntax shape ${shape}`, () => {
    const body = emptyModuleBody();
    const input = emptyVerificationInput(body);
    if (shape === "ordinary-field") body.root.languageVariant = "JSX";
    if (shape === "flags" || shape === "sparse-flags") body.root.flags = ["Ambient"];
    if (shape === "sparse-flags") input.source.tree.flags = Array(1);
    if (shape === "directive") body.root.checkJsDirective = { enabled: true, range: { pos: 0, end: 0,
      kind: "SingleLineCommentTrivia", hasTrailingNewLine: false } };
    if (shape === "inline-field") body.root.statements = { ...body.root.statements, loc: { pos: 1, end: 0 } };
    assertCompleteValue(verifyBody(input, body), [nodeViolation("kind-children-shape", 0,
      "typed syntax does not retain the authored kind, fields and child presence")]);
    if (shape === "ordinary-field") body.root.languageVariant = "Standard";
    if (shape === "flags" || shape === "sparse-flags") body.root.flags = [];
    if (shape === "sparse-flags") input.source.tree.flags = [];
    if (shape === "directive") body.root.checkJsDirective = null;
    if (shape === "inline-field") body.root.statements = { ...body.root.statements, loc: { pos: 0, end: 0 } };
    assertCompleteValue(verifyBody(input, body), []);
  });
}

for (const record of ["SourceFile", "NodeList"]) test(`closed ${record} text rejects unknown fields at its actual declared boundary`, () => {
  const text = readFileSync(resolve(repository, functionDirectory, "empty-module.input.tir"), "utf8");
  const position = record === "SourceFile" ? text.indexOf("\nn:1=") - 1 : text.indexOf("nodes=[]") + "nodes=[]".length;
  const invalid = text.slice(0, position) + ", extra=1" + text.slice(position);
  assertInvalidText(invalid, position + 2, ["end of record"], "extra");
  assertBodyRoundTrip(emptyModuleBody(), text, `${record}: complete closed record positive`);
});

test("F4 absent authentic source body retains every complete publication cofinding", () => {
  const body = emptyModuleBody();
  const input = emptyVerificationInput(body);
  const original = input.source.bodies[0];
  input.source.bodies = [];
  assertCompleteValue(verifyBody(input, body), [
    bodyViolation("body-owner", "body identity and owner do not retain the actual original body"),
    bodyViolation("stable-order", "canonical template publication does not retain actual source body order"),
    bodyViolation("nested-template-identity", "published template is not the authentic body's canonical shared module subtree"),
    nodeViolation("nested-template-identity", 0, "typed template does not retain its real authored body and shared syntax identity"),
  ]);
  input.source.bodies = [original];
  assertCompleteValue(verifyBody(input, body), []);
});

for (const derived of [[{ kind: "expansion", expansion: "one" }], [{ kind: "lowering", pass: "elaborate" }]]) {
  test(`F4 equal-length ${derived[0].kind} identity retains the whole origin finding`, () => {
    const body = emptyModuleBody();
    const input = emptyVerificationInput(body);
    input.source.tree.origin.derived = derived;
    body.root.origin.derived = derived[0].kind === "expansion" ? [{ kind: "expansion", expansion: "two" }]
      : [{ kind: "lowering", pass: "front" }];
    assertCompleteValue(verifyBody(input, body), [nodeViolation("origin-range", 0,
      "typed origin or lexical range does not retain the actual source interval")]);
    body.root.origin.derived = structuredClone(derived);
    assertCompleteValue(verifyBody(input, body), []);
  });
}

for (const family of ["terms", "signatures"]) {
  test(`F4 borrowed unused ${family} hole remains a genuine complete lower-table finding`, () => {
    const body = emptyModuleBody();
    const input = emptyVerificationInput(body);
    input.types[family].length = 2;
    assertCompleteValue(verifyBody(input, body), [bodyViolation("type-closed",
      `type verifier: ${family === "terms" ? "type-reference" : "signature-reference"}`)]);
    input.types[family].length = 1;
    assertCompleteValue(verifyBody(input, body), []);
  });
}

test("F4 ITEM-qualified evidence keeps its actual source and complete BODY opposite", () => {
  const body = emptyModuleBody();
  body.evidence = [{ ...typeEvidence({ kind: "dynamic" }), component: { kind: "item", value: { owner: ownerId, node: 0 } } }];
  const input = emptyVerificationInput(body);
  assertCompleteValue(verifyBody(input, body), []);
  body.evidence[0].component = { kind: "body", value: { body: bodyId, node: 0 } };
  assertCompleteValue(verifyBody(input, body), []);
});

for (const shared of [false, true]) {
  test(`F4 shared evidence invalid occurrences retain ${shared ? "three" : "two"} complete findings`, () => {
    const fixture = deferredConversionScenario();
    const old = fixture.deferred.invocation.input.from;
    if (shared) old.type = 99;
    else fixture.deferred.invocation.input.from = { ...old, type: 99 };
    assertCompleteValue(verifyBody(fixture.input, fixture.body), [
      nodeViolation("type-closed", 9, "typed reference does not reach a present closed type/signature graph"),
      nodeViolation("evidence-reference", 9, "type verifier: type-reference"),
      ...(shared ? [nodeViolation("evidence-reference", 9, "type verifier: type-reference")] : []),
    ]);
    old.type = 1;
    fixture.deferred.invocation.input.from = old;
    assertCompleteValue(verifyBody(fixture.input, fixture.body), []);
  });
}

for (const endpoint of ["advertised", "api"]) {
  test(`F4 actual ${endpoint} signature declaration is independently qualified`, () => {
    const fixture = callScenario();
    const signature = fixture.types.signatures[fixture.decision[endpoint].signature];
    const completion = endpoint === "api" ? [nodeViolation("completion-endpoint", 2,
      "selected completion does not retain the actual activated body's signature and channels")] : [];
    signature.declaration = ownerId;
    assertCompleteValue(verifyBody(fixture.input, fixture.body), [nodeViolation("call-endpoints", 2,
      "selected callable endpoints do not belong to their actual declarations and candidate"), ...completion]);
    signature.declaration = fixture.definition;
    assertCompleteValue(verifyBody(fixture.input, fixture.body), []);
    signature.declaration = null;
    assertCompleteValue(verifyBody(fixture.input, fixture.body), completion);
  });
}

for (const malformed of ["member-hole", "member-repeat", "accessor-hole", "accessor-repeat"]) {
  for (const receiverMismatch of [false, true]) {
    test(`F4 genuine borrowed ${malformed}, receiverMismatch=${receiverMismatch}`, () => {
      const fixture = memberScenario("property-access");
      const members = fixture.table.members;
      if (malformed === "member-hole") fixture.table.members = [, members[0]];
      if (malformed === "member-repeat") fixture.table.members = [members[0], members[0]];
      if (malformed === "accessor-hole") fixture.table.accessors = Array(1);
      if (malformed === "accessor-repeat") {
        const accessor = { origin: fixture.decision.origins[0], getter: null, setter: null };
        fixture.table.accessors = [accessor, accessor];
      }
      if (receiverMismatch) fixture.table.receiver = 0;
      assertCompleteValue(verifyBody(fixture.input, fixture.body), [
        ...(receiverMismatch ? [nodeViolation("member-origin", 2, "member inventory does not retain the actual receiver type")] : []),
        nodeViolation("member-origin", 2, "member selection does not retain a real member key and its actual declared origins"),
      ]);
      fixture.table.members = members;
      fixture.table.accessors = [];
      fixture.table.receiver = 1;
      assertCompleteValue(verifyBody(fixture.input, fixture.body), []);
    });
  }
}

test("F4 a selected getter's genuine endpoint cannot become a null decision endpoint", () => {
  const fixture = memberScenario("property-access");
  attachActualGetter(fixture);
  const actual = fixture.decision.getter;
  fixture.decision.getter = null;
  assertCompleteValue(verifyBody(fixture.input, fixture.body), [
    nodeViolation("access-location", 2, "member location is an accessor exactly when a getter or setter is selected"),
    nodeViolation("accessor-activation", 2, "selected accessor activation does not retain the actual member endpoint and access role")]);
  fixture.decision.getter = actual;
  assertCompleteValue(verifyBody(fixture.input, fixture.body), []);
});

test("a member location is an accessor exactly when the decision selects a getter or a setter", () => {
  const data = { kind: "data", check: { kind: "required", failure: "abort" }, receiver: "by-reference" };
  const finding = nodeViolation("access-location", 2, "member location is an accessor exactly when a getter or setter is selected");
  const field = memberScenario("property-access");
  field.decision.location = data;
  assertCompleteValue(verifyBody(field.input, field.body), []);
  field.decision.location = { kind: "accessor" };
  assertCompleteValue(verifyBody(field.input, field.body), [finding]);
  const accessor = memberScenario("property-access");
  attachActualGetter(accessor);
  assertCompleteValue(verifyBody(accessor.input, accessor.body), []);
  accessor.decision.location = data;
  assertCompleteValue(verifyBody(accessor.input, accessor.body), [finding]);
});

for (const family of ["classBindings", "methodBindings", "capturedBindings", "selfBindings"]) {
  test(`F4 selected and unselected sparse ${family} have different complete public outcomes`, () => {
    const body = emptyModuleBody();
    const input = emptyVerificationInput(body);
    const bindings = emptyBindings();
    bindings[family] = Array(1);
    const other = { ...body, bindings: { kind: "instantiated", bindings } };
    input.module.bodies.push(other);
    assertCompleteValue(verifyBody(input, body), []);
    assert.throws(() => verifyBody(input, other), { name: "TypeError",
      message: `ir-tir: sparse vector at $body["bindings"]["bindings"]["${family}"][0]` });
    input.module.bodies = [body, body];
    assertCompleteValue(verifyBody(input, body), [
      bodyViolation("template-shared-once", "canonical publication contains a duplicate artifact key or does not contain the selected body exactly once"),
      bodyViolation("template-shared-once", "actual source body has more than one canonical parametric template"),
    ]);
    input.module.bodies = [body];
    assertCompleteValue(verifyBody(input, body), []);
  });
}

test("F4 a publication vector hole is DATA at the body port and a caller defect at the module port", () => {
  const body = emptyModuleBody();
  const input = emptyVerificationInput(body);
  input.module.bodies.length = 2;
  assertCompleteValue(verifyBody(input, body), [bodyViolation("template-shared-once",
    "canonical publication contains a duplicate artifact key or does not contain the selected body exactly once")]);
  assert.throws(() => verifyChapter(input, input.module), { name: "TypeError",
    message: 'ir-tir: sparse vector at $module["bodies"][1]' });
  input.module.bodies.length = 1;
  const actual = input.bindingScopesOf;
  input.bindingScopesOf = (target, subject, visit) => target.kind === "module" && target.module === moduleId
    ? completeScopes([]) : actual(target, subject, visit);
  assertCompleteValue(verifyBody(input, body), []);
  assertCompleteValue(verifyChapter(input, input.module), []);
});

const argumentFindings = {
  total: ["argument-total", "application dispositions are not total over the real API formals and receiver"],
  order: ["argument-parameter-order", "argument and mapping parameters do not retain formal order"],
  authored: ["authored-order-preserved", "argument transport does not retain the original authored argument sequence"],
  omission: ["omission-valid", "omission does not match the selected capability, default initializer or rest formal"],
};
for (const [name, form, mutate, expected] of [
  ["missing-final-mapping", "whole", fixture => fixture.decision.parameters.pop(), ["total"]],
  ["duplicate-formal", "whole", fixture => { fixture.decision.parameters[0].parameter = 1; }, ["total", "order"]],
  ["negative-argument", "whole", fixture => { fixture.decision.parameters[0].argument = -1; }, ["authored", "order"]],
  ["negative-zero-argument", "whole", fixture => { fixture.decision.parameters[0].argument = -0; }, ["authored", "order"]],
  ["negative-component", "whole", fixture => { fixture.decision.parameters[0].component = -1; }, ["authored", "order"]],
  ["repeated-rest-index", "values", fixture => { fixture.decision.parameters[0].arguments = [0, 0, 2]; }, ["authored", "order"]],
  ["component-past-tuple", "whole", fixture => { fixture.decision.parameters[0].component = 2; }, ["authored"]],
  ["provided-other-real-expression", "whole", fixture => { fixture.application.arguments[0].expression = 3; }, ["authored"]],
  ["rest-other-real-expression", "whole", fixture => { fixture.parts[0].expression = 3; }, ["authored"]],
  ["rest-captured-kind", "whole", fixture => { fixture.parts[0] = { kind: "value", expression: 5 }; }, ["authored"]],
  ["rest-mapping-other-source", "whole", fixture => { fixture.decision.parameters[1].arguments = [1]; }, ["authored"]],
  ["rest-repeated-whole-part", "whole", fixture => { fixture.parts.push(fixture.parts[0]); }, ["authored"]],
  ["required-mapped-omitted", "whole", fixture => {
    fixture.decision.parameters[0] = { kind: "omitted", parameter: 0, type: 2 };
  }, ["total", "omission"]],
  ["rest-mapped-omitted", "whole", fixture => {
    fixture.decision.parameters[1] = { kind: "omitted", parameter: 1, type: 4 };
  }, ["total", "omission"]],
  ["optional-mapped-rest", "optional", fixture => {
    fixture.decision.parameters[0] = { kind: "rest", parameter: 0, arguments: [], passing: "by-value" };
  }, ["omission"]],
  ["actual-receiver-unretained", "whole", fixture => { fixture.input.types.signatures[1].receiver = 0; }, ["total"]],
  ["default-formal-now-required", "default", fixture => {
    fixture.parameters[0].kind = "required";
    fixture.parameters[0].initializer = null;
  }, ["omission"]],
  ["default-other-real-body", "default", fixture => { fixture.decision.parameters[0].initializer = bodyId; }, ["omission"]],
]) {
  test(`F4 entire transport/formal vector ${name}`, () => {
    const fixture = argumentScenario(form);
    mutate(fixture);
    assertCompleteValue(verifyBody(fixture.input, fixture.body), expected.map(key =>
      nodeViolation(argumentFindings[key][0], 2, argumentFindings[key][1])));
    const valid = argumentScenario(form);
    assertCompleteValue(verifyBody(valid.input, valid.body), []);
  });
}

test("F4 required void omission consumes the actual selected capability without changing syntax or inventing an argument", () => {
  const fixture = argumentScenario("optional");
  const type = fixture.input.types.terms.length;
  fixture.input.types.terms.push({ kind: "intrinsic", intrinsic: "void" });
  fixture.parameters[0].kind = "required";
  fixture.parameters[0].type = type;
  fixture.decision.parameters[0].type = type;
  assertCompleteValue(verifyBody(fixture.input, fixture.body), []);
  fixture.parameters[0].acceptsOmission = false;
  assertCompleteValue(verifyBody(fixture.input, fixture.body),
    [nodeViolation(argumentFindings.omission[0], 2, argumentFindings.omission[1])]);
});

for (const form of ["optional", "default"]) {
  test(`F4 ${form} omission retains the actual selected capability in both mapping and value transport`, () => {
    const fixture = argumentScenario(form);
    assertCompleteValue(verifyBody(fixture.input, fixture.body), []);
    fixture.parameters[0].acceptsOmission = false;
    assertCompleteValue(verifyBody(fixture.input, fixture.body),
      [nodeViolation(argumentFindings.omission[0], 2, argumentFindings.omission[1])]);
    fixture.parameters[0].acceptsOmission = true;
    assertCompleteValue(verifyBody(fixture.input, fixture.body), []);
  });
}

for (const [position, role] of [[1, "this"], [0, "rest"]]) {
  test(`F4 actual two-formal ${role} cannot occupy position ${position}`, () => {
    const fixture = twoParameterScenario();
    const body = fixture.functionTemplate;
    const input = fixture.inputFor(body);
    body.params[position].tsonic.role = role;
    assertCompleteValue(verifyBody(input, body), [
      bodyViolation("parameter-order", "parameter records do not retain the actual declared formal order", fixture.functionBody),
      nodeViolation("parameter-order", body.params[position].id, "parameter occurrence does not retain its actual declared formal and local association"),
    ]);
    body.params[position].tsonic.role = "required";
    assertCompleteValue(verifyBody(input, body), []);
  });
}

for (const field of ["name", "capturedFrom", "capture-role"]) {
  test(`F4 actual local metadata ${field} keeps its entire independent vector`, () => {
    const fixture = genericFunctionScenario();
    const body = fixture.functionTemplate;
    const input = fixture.inputFor(body);
    if (field === "name") body.locals[0].name = "other";
    if (field === "capturedFrom") body.locals[0].capturedFrom = { body: fixture.functionBody, local: 0 };
    if (field === "capture-role") body.locals[0].role = "capture";
    const binding = bodyViolation("binding-storage", "local storage is not associated with its real original binding", fixture.functionBody);
    const capture = bodyViolation("capture-qualified", "captured local does not retain its actual qualified outer binding", fixture.functionBody);
    assertCompleteValue(verifyBody(input, body), field === "name" ? [binding] : field === "capturedFrom" ? [capture] :
      [binding, capture, bodyViolation("local-storage", "parameter storage does not retain its real local slot", fixture.functionBody)]);
    body.locals[0].name = "v";
    body.locals[0].capturedFrom = null;
    body.locals[0].role = "parameter";
    assertCompleteValue(verifyBody(input, body), []);
  });
}

test("F4 a genuine additional local is not an authored binding inventory", () => {
  const body = emptyModuleBody();
  const input = emptyVerificationInput(body);
  body.locals = [{ id: 0, declaration: { kind: "body", value: { body: bodyId, node: 0 } }, name: "v", role: "binding",
    storage: 0, capturedFrom: null, mutable: true }];
  assertCompleteValue(verifyBody(input, body), [bodyViolation("binding-storage",
    "local inventory does not retain the actual source binding inventory")]);
  body.locals = [];
  assertCompleteValue(verifyBody(input, body), []);
});

test("F4 nested inventory multiplicity retains genuine source order", () => {
  const fixture = genericFunctionScenario();
  fixture.outer.nestedBodies.push(fixture.functionBody);
  assertCompleteValue(verifyBody(fixture.inputFor(fixture.outer), fixture.outer), [bodyViolation("stable-order",
    "capture and nested-body inventories do not retain actual source order")]);
  fixture.outer.nestedBodies.pop();
  assertCompleteValue(verifyBody(fixture.inputFor(fixture.outer), fixture.outer), []);
});

test("a conversion states its embedding once; whether it requires a check and how its operation executes are separate events", () => {
  const component = { root: { kind: "body", value: { body: bodyId, node: 2 } }, path: [] };
  const proof = { steps: [{ from: component, to: component, rule: "numeric", premises: [] }], conclusion: 0 };
  const embedding = check => ({ kind: "conversion", conversion: "numeric", proof, check });
  const none = { kind: "none" };
  const unwinding = { kind: "required", failure: "unwind" };
  const pure = { kind: "pure" };
  const failing = failure => ({ kind: "invocation", writesStorage: false, failure });
  const identityConversion = (stated, execution) => ({ permissionScope: null, decision: { kind: "selected",
    operation: { kind: "conversion", embedding: stated, from: 1, to: 1 }, operands: [1], result: 1, execution } });
  const backing = (kind, execution) => ({ permissionScope: null, decision: { kind: "selected",
    operation: { kind, declaration: ownerId, bindings: emptyBindings() }, operands: [1], result: 1, execution } });
  const verified = (conversion, expected, label, scopes = 0) => {
    const fixture = operationScenario();
    fixture.typed.tsonic.conversion = conversion;
    for (let added = 0; added < scopes; added += 1) bodyScopes(fixture.input, fixture.body).push(emptyScope());
    assertCompleteValue(verifyBody(fixture.input, fixture.body), expected, label);
  };
  const convert = (check, execution) => ({ kind: "convert", role: "return", operation: identityConversion(embedding(check), execution) });
  // const narrow: int8 = wide          under a recoverable overflow fact: the range test, then a pure truncation
  verified(convert(unwinding, pure), [], "an explicit precheck followed by a pure continuation");
  // const boxed: int32 | string = n    with an allocating carrier: no test; the injection is one invocation that can end the process
  verified(convert(none, failing("abort")), [], "one failing invocation with no check");
  // const boxed: int8 | string = wide  both: the range test unwinds, then the allocating injection can end the process
  verified(convert(unwinding, failing("abort")), [], "a precheck followed by a failing invocation");
  verified(convert(unwinding, failing("unwind")), [], "a precheck and an invocation that fail the same way are still two events");
  verified(convert({ kind: "required", failure: "abort" }, failing("none")), [], "a precheck followed by an invocation that cannot fail");
  verified(convert(none, pure), [], "an unchecked pure conversion");
  // A conversion carried out by a core or library operation: the embedding stands beside the operation, once.
  for (const kind of ["core", "library"]) for (const check of [none, unwinding]) for (const execution of [pure, failing("unwind"), failing("abort")])
    verified({ kind: "backed-convert", role: "return", embedding: embedding(check), operation: backing(kind, execution) }, [],
      `a ${kind}-backed conversion, check ${check.kind}, execution ${execution.kind}`, 1);
  // The arm decides which operation may carry the conversion out.
  const refused = nodeViolation("conversion-operation", 2,
    "a conversion is carried out by the conversion identity, and a backed conversion by a core or library operation");
  verified({ kind: "convert", role: "return", operation: backing("core", pure) }, [refused], "a convert arm with a core operation", 1);
  verified({ kind: "convert", role: "return", operation: backing("library", pure) }, [refused], "a convert arm with a library operation", 1);
  verified({ kind: "backed-convert", role: "return", embedding: embedding(none), operation: identityConversion(embedding(none), pure) }, [refused],
    "a backed arm whose operation is the conversion identity states the embedding twice");
  const discarding = { permissionScope: null, decision: { kind: "selected", operation: { kind: "discard" }, operands: [1], result: 1, execution: pure } };
  verified({ kind: "convert", role: "return", operation: discarding }, [refused], "a convert arm with an operation that converts nothing");
  // A carried-out conversion embeds by a conversion: an identity embedding needs no operation, a refused one is not carried
  // out (R1 O-1, the structural part; whether the conversion is the right one is Validate's embedding-replay).
  const carried = nodeViolation("conversion-carried", 2, "a carried-out conversion states a conversion embedding");
  const refusedEmbedding = { kind: "refused", reason: "lossy-numeric" };
  for (const [stated, label] of [[{ kind: "identity" }, "identity"], [refusedEmbedding, "refused"]]) {
    verified({ kind: "convert", role: "return", operation: identityConversion(stated, pure) }, [carried], `a convert arm whose embedding is ${label}`);
    for (const kind of ["core", "library"])
      verified({ kind: "backed-convert", role: "return", embedding: stated, operation: backing(kind, pure) }, [carried],
        `a ${kind}-backed arm whose embedding is ${label}`, 1);
  }
  verified({ kind: "backed-convert", role: "return", embedding: embedding(none), operation: discarding }, [refused],
    "a backed arm with an operation that is neither core nor library");
});

for (const endpoint of ["from", "to"]) {
  test(`F4 explicit conversion ${endpoint} retains both endpoint and operation cofindings`, () => {
    const fixture = operationScenario();
    const operation = { permissionScope: null, decision: { kind: "selected", operation: {
      kind: "conversion", embedding: carriedEmbedding, from: 1, to: 1 }, operands: [1], result: 1, execution: { kind: "pure" } } };
    fixture.typed.tsonic.conversion = { kind: "convert", role: "return", operation };
    assertCompleteValue(verifyBody(fixture.input, fixture.body), []);
    operation.decision.operation[endpoint] = 0;
    assertCompleteValue(verifyBody(fixture.input, fixture.body), [
      nodeViolation(endpoint === "from" ? "conversion-source" : "conversion-destination", 2,
        endpoint === "from" ? "conversion does not retain its value source endpoint" : "conversion does not retain its destination endpoint"),
      nodeViolation("operation-type", 2, "conversion operation does not retain its explicit operand and result endpoints"),
    ]);
    operation.decision.operation[endpoint] = 1;
    assertCompleteValue(verifyBody(fixture.input, fixture.body), []);
  });
}

for (const kind of ["DeleteExpression", "TypeOfExpression", "VoidExpression"]) {
  test(`F4 actual ${kind} operand transport has its complete null/opposite vector`, () => {
    const fixture = operationScenario();
    fixture.typed.kind = kind;
    fixture.typed.expression = fixture.operand;
    delete fixture.typed.operator;
    delete fixture.typed.operand;
    delete fixture.typed.tsonic.role;
    fixture.checked.kind = kind;
    fixture.checked.expression = fixture.checked.operand;
    delete fixture.checked.operator;
    delete fixture.checked.operand;
    delete fixture.checked.tsonic.role;
    if (kind === "VoidExpression") {
      const absence = fixture.input.types.terms.length;
      fixture.input.types.terms.push({ kind: "intrinsic", intrinsic: "absence" });
      fixture.typed.tsonic.type = fixture.typed.tsonic.convertedType = absence;
      fixture.checked.tsonic = { core: emptyCore(), ...checkedValue(absence) };
      fixture.operation.decision.operation = { kind: "discard" };
      fixture.operation.decision.result = absence;
    }
    assertCompleteValue(verifyBody(fixture.input, fixture.body), []);
    fixture.operation.decision.operands = [];
    assertCompleteValue(verifyBody(fixture.input, fixture.body), [nodeViolation("operation-type", 2,
      "selected operation does not retain the authored operand count and value endpoints")]);
    fixture.operation.decision.operands = [1];
    assertCompleteValue(verifyBody(fixture.input, fixture.body), []);
  });
}

for (const [token, kind] of [["BarBarToken", "or"], ["QuestionQuestionToken", "coalesce"],
  ["BarBarEqualsToken", "or"], ["QuestionQuestionEqualsToken", "coalesce"]]) {
  for (const disposition of ["left", "right", "dynamic"]) {
    test(`F4 actual ${token}/${disposition} demand endpoints retain complete outcomes`, () => {
      const fixture = binaryScenario(token.endsWith("EqualsToken") ? "assignment" : "short-circuit", token);
      const selection = { kind, control: 3, right: 5, disposition };
      fixture.typed.tsonic.selection = selection;
      const when = kind === "or" ? "false" : "absent";
      fixture.typed.right.tsonic.demand = disposition === "right" ? { kind: "always" } : disposition === "left"
        ? { kind: "never", control: 3 } : { kind: "selected", control: 3, when };
      assertCompleteValue(verifyBody(fixture.input, fixture.body), []);
      fixture.typed.right.tsonic.demand = { kind: "always" };
      if (disposition !== "right") assertCompleteValue(verifyBody(fixture.input, fixture.body), [nodeViolation("controlled-demand", 5,
        "controlled branch does not retain its selected or never-evaluated demand")]);
      selection.control = 5;
      assertCompleteValue(verifyBody(fixture.input, fixture.body), [nodeViolation("controlled-demand", 2,
        "selection does not retain its authored control and branch endpoints")]);
    });
  }
}

for (const family of ["classBindings", "methodBindings", "capturedBindings"]) {
  for (const mode of ["rigid", "bound"]) {
    test(`F4 unselected canonical publication key includes ${family}/${mode}`, () => {
      const body = emptyModuleBody();
      const input = emptyVerificationInput(body);
      const bindings = emptyBindings();
      bindings[family] = [{ kind: mode, parameter: typeParameterDeclaration(ownerId, 0), ...(mode === "bound" ? { type: 0 } : {}) }];
      const other = { ...body, bindings: { kind: "instantiated", bindings } };
      input.module.bodies.push(other);
      assertCompleteValue(verifyBody(input, body), []);
      input.module.bodies.push(other);
      assertCompleteValue(verifyBody(input, body), [bodyViolation("template-shared-once",
        "canonical publication contains a duplicate artifact key or does not contain the selected body exactly once")]);
      input.module.bodies.pop();
      const different = emptyBindings();
      different[family] = [{ kind: mode === "rigid" ? "bound" : "rigid", parameter: typeParameterDeclaration(ownerId, 0),
        ...(mode === "rigid" ? { type: 0 } : {}) }];
      input.module.bodies.push({ ...body, bindings: { kind: "instantiated", bindings: different } });
      assertCompleteValue(verifyBody(input, body), []);
    });
  }
}

test("F4 self rigid and bound publication keys stay distinct and duplicates remain complete", () => {
  const body = emptyModuleBody();
  const input = emptyVerificationInput(body);
  const rigid = { ...body, bindings: { kind: "instantiated", bindings: { ...emptyBindings(),
    selfBindings: [{ kind: "rigid", owner: ownerId }] } } };
  const bound = { ...body, bindings: { kind: "instantiated", bindings: { ...emptyBindings(),
    selfBindings: [{ kind: "bound", owner: ownerId, type: 0 }] } } };
  input.module.bodies.push(rigid, bound);
  assertCompleteValue(verifyBody(input, body), []);
  for (const duplicate of [rigid, bound]) {
    input.module.bodies.push(duplicate);
    assertCompleteValue(verifyBody(input, body), [bodyViolation("template-shared-once",
      "canonical publication contains a duplicate artifact key or does not contain the selected body exactly once")]);
    input.module.bodies.pop();
  }
});

test("F4 protocol core and genuine callee retain the same real declaration endpoint", () => {
  const fixture = argumentScenario("empty");
  const spread = fixture.call.arguments.nodes[0];
  const callee = fixture.application.callee;
  const operation = { permissionScope: null, decision: { kind: "selected", operation: {
    kind: "core", declaration: fixture.definition, bindings: emptyBindings() }, operands: [], result: 0, execution: { kind: "pure" } } };
  spread.tsonic.protocol.decision.steps = [{ role: "next", operation, callee }];
  replaceScopeInventory(fixture.input, Array.from({ length: 7 }, emptyScope));
  assertCompleteValue(verifyBody(fixture.input, fixture.body), []);
  operation.decision.operation.declaration = ownerId;
  assertCompleteValue(verifyBody(fixture.input, fixture.body), [nodeViolation("protocol-total", 4,
    "protocol step operation and callee do not retain the same selected endpoint and result")]);
  operation.decision.operation.declaration = fixture.definition;
  assertCompleteValue(verifyBody(fixture.input, fixture.body), []);
});

test("F4 different actual child kinds retain both parent and child shape findings", () => {
  const checked = { ...header(2, 1), kind: "NumericLiteral", text: "1", tokenFlags: [],
    tsonic: { core: emptyCore(), role: "value", value: checkedValue(),
      literal: { kind: "number", token: "1", value: { numerator: 1n, denominator: 1n, negativeZero: false } } } };
  const typed = { ...header(2, 1), kind: "StringLiteral", text: "one", tokenFlags: [],
    tsonic: { ...typedValue(), role: "value", value: "one" } };
  const fixture = expressionScenario(checked, typed, [], 3, []);
  assertCompleteValue(verifyBody(fixture.input, fixture.body), [
    nodeViolation("kind-children-shape", 1, "typed syntax does not retain the authored kind, fields and child presence"),
    nodeViolation("kind-children-shape", 2, "typed syntax does not retain the authored kind, fields and child presence"),
  ]);
  const matching = { ...header(2, 1), kind: "NumericLiteral", text: "1", tokenFlags: [],
    tsonic: { ...typedValue(), role: "value", value: { numerator: 1n, denominator: 1n, negativeZero: false } } };
  const opposite = expressionScenario(checked, matching, [], 3, []);
  assertCompleteValue(verifyBody(opposite.input, opposite.body), []);
});

test("F4 a genuinely inserted authored child retains the displaced EOF and all source cofindings", () => {
  const body = emptyModuleBody();
  const input = emptyVerificationInput(body);
  body.root.statements.nodes.push(readyStatement({ ...header(2, 0), kind: "EmptyStatement", tsonic: null }));
  assertCompleteValue(verifyBody(input, body), [
    nodeViolation("kind-children-shape", 0, "typed syntax does not retain the authored kind, fields and child presence"),
    nodeViolation("no-inserted-nodes", 1, "typed syntax adds an authored child position"),
    nodeViolation("authored-node-ids-preserved", 2, "typed node identity differs from the actual authored node at this position"),
    nodeViolation("no-inserted-nodes", 2, "typed syntax includes a node not present in the actual source arena"),
    nodeViolation("kind-children-shape", 2, "typed syntax does not retain the authored kind, fields and child presence"),
    nodeViolation("node-in-body-range", 2, "typed syntax contains a real or invented node outside its actual original body subtree"),
    nodeViolation("node-reference", 2, "node identity does not name an actual node in its module arena"),
  ]);
  body.root.statements.nodes = [];
  assertCompleteValue(verifyBody(input, body), []);
});

test("F4 changing only the supplied root identity retains every root and subtree cofinding", () => {
  const body = emptyModuleBody();
  const input = emptyVerificationInput(body);
  body.root.id = 5;
  assertCompleteValue(verifyBody(input, body), [
    nodeViolation("authored-node-ids-preserved", 5, "typed node identity differs from the actual authored node at this position"),
    nodeViolation("no-inserted-nodes", 5, "typed syntax includes a node not present in the actual source arena"),
    nodeViolation("node-in-body-range", 5, "typed body root does not retain the actual original body subtree"),
    nodeViolation("node-in-body-range", 5, "typed syntax contains a real or invented node outside its actual original body subtree"),
    bodyViolation("nested-template-identity", "published template is not the authentic body's canonical shared module subtree"),
    nodeViolation("nested-template-identity", 5, "typed template does not retain its real authored body and shared syntax identity"),
    nodeViolation("node-reference", 5, "node identity does not name an actual node in its module arena"),
  ]);
  body.root.id = 0;
  assertCompleteValue(verifyBody(input, body), []);
});

test("F4 ITEM-qualified binding declarations compare actual owner and node coordinates", () => {
  const fixture = genericFunctionScenario();
  const body = fixture.functionTemplate;
  const input = fixture.inputFor(body);
  const actual = { kind: "item", value: { owner: fixture.valueDefinition, node: fixture.nodes.parameter } };
  body.locals[0].declaration = actual;
  fixture.originalFunction.locals[0].declaration = actual;
  assertCompleteValue(verifyBody(input, body), []);
  body.locals[0].declaration = { kind: "item", value: { owner: fixture.valueDefinition, node: fixture.nodes.parameterName } };
  assertCompleteValue(verifyBody(input, body), [bodyViolation("binding-storage",
    "local storage is not associated with its real original binding", fixture.functionBody)]);
  body.locals[0].declaration = actual;
  assertCompleteValue(verifyBody(input, body), []);
});

for (const family of ["classParameters", "methodParameters", "capturedParameters", "selfOwners"]) {
  test(`F4 complete genuine declaration scope mismatch in ${family}`, () => {
    const fixture = genericFunctionScenario();
    const body = fixture.functionTemplate;
    const input = fixture.inputFor(body);
    const scopes = [...bodyScopes(input, body)];
    const actual = { ...fixture.scope, [family]: family === "selfOwners" ? [ownerId]
      : [family === "methodParameters" ? typeParameterDeclaration(fixture.definition, 1) : fixture.typeDefinition] };
    replaceScopeInventory(input, [actual, ...scopes.slice(1)]);
    assertCompleteValue(verifyBody(input, body), [
      bodyViolation("binding-vector-complete", "binding environment does not retain its genuine declaration scope", fixture.functionBody),
      bodyViolation("binding-vector-complete", "type verifier: binding-vector-complete", fixture.functionBody),
    ]);
    replaceScopeInventory(input, scopes);
    assertCompleteValue(verifyBody(input, body), []);
  });
}

test("F4 distinct real self owners retain all metadata and lower-order cofindings", () => {
  const fixture = genericFunctionScenario();
  const body = fixture.functionTemplate;
  fixture.scope.selfOwners.push(ownerId);
  body.lexicalBindings.selfBindings.push({ kind: "rigid", owner: ownerId });
  body.root.tsonic.callable.template.lexicalBindings.selfBindings.push({ kind: "rigid", owner: ownerId });
  const input = fixture.inputFor(body);
  const scopes = [...bodyScopes(input, body)];
  assertCompleteValue(verifyBody(input, body), []);
  replaceScopeInventory(input, [{ ...fixture.scope, selfOwners: [fixture.definition] }, ...scopes.slice(1)]);
  assertCompleteValue(verifyBody(input, body), [
    bodyViolation("binding-vector-complete", "binding environment does not retain its genuine declaration scope", fixture.functionBody),
    bodyViolation("binding-vector-complete", "type verifier: self-owner", fixture.functionBody),
    bodyViolation("binding-vector-complete", "type verifier: self-binding-order", fixture.functionBody),
  ]);
  replaceScopeInventory(input, scopes);
  assertCompleteValue(verifyBody(input, body), []);
});

test("F4 a present actual candidate list cannot disappear from its source inventory", () => {
  const fixture = callScenario();
  const candidates = fixture.input.source.bodies[0].candidateLists;
  fixture.input.source.bodies[0].candidateLists = [];
  assertCompleteValue(verifyBody(fixture.input, fixture.body), [nodeViolation("call-endpoints", 2,
    "selected application names a missing actual candidate inventory")]);
  fixture.input.source.bodies[0].candidateLists = candidates;
  assertCompleteValue(verifyBody(fixture.input, fixture.body), []);
});

test("F4 a real outside-body source node provides no disposal capture for this using occurrence", () => {
  const fixture = genericFunctionScenario();
  const body = fixture.functionTemplate;
  const definition = "D[M[P[p];m];Outside]";
  const sourceType = { ...header(202, 200), kind: "StringKeyword", tsonic: { core: emptyCore(), type: available(2), referencedDefinitions: [] } };
  const sourceName = { ...header(201, 200), kind: "Identifier", text: "Outside", tsonic: { core: emptyCore(),
    role: "declaration-name", declaration: { kind: "definition", definition } } };
  const sourceAlias = { ...header(200, 0), kind: "TypeAliasDeclaration", modifiers: null, name: sourceName,
    typeParameters: null, type: sourceType, tsonic: { core: emptyCore(), parent: ownerId, attributes: [],
      memory: available(null), definition, parameters: [], type: available(2) } };
  const sourceList = { ...header(101, 100), kind: "VariableDeclarationList", declarations: nodeList(),
    tsonic: { core: emptyCore(), disposal: [] } };
  const list = { ...header(101, 100), kind: "VariableDeclarationList", declarations: nodeList(),
    tsonic: { role: "using", asynchronous: false, protocols: [{ kind: "decided", decision: { kind: "dispose",
      asynchronous: false, steps: [], value: 0, completion: 0, sent: 0, thrown: 0 } }] } };
  const sourceStatement = { ...header(100, fixture.nodes.block), kind: "VariableStatement", modifiers: null,
    declarationList: sourceList, tsonic: null };
  const statement = { ...header(100, fixture.nodes.block), kind: "VariableStatement", modifiers: null,
    declarationList: list, tsonic: null };
  body.root.body.statements.nodes.unshift(statement);
  fixture.checkedFunction.body.statements.nodes.unshift(sourceStatement);
  const input = fixture.inputFor(body);
  input.source.tree.statements.nodes.push(sourceAlias);
  input.source.items.push({ definition, node: 200 });
  fixture.declarations.set(definition, { scope: emptyScope(), parameterCount: 0, endpoints: [] });
  for (const node of [sourceStatement, sourceList]) fixture.functionNodes.set(node.id, node);
  for (const node of [sourceAlias, sourceName, sourceType]) fixture.outerNodes.set(node.id, node);
  list.id = 200;
  assertCompleteValue(verifyBody(input, body), [
    nodeViolation("authored-node-ids-preserved", 200, "typed node identity differs from the actual authored node at this position"),
    nodeViolation("node-in-body-range", 200, "typed syntax contains a real or invented node outside its actual original body subtree"),
  ]);
  list.id = 101;
  assertCompleteValue(verifyBody(input, body), []);
  list.id = 999;
  assertCompleteValue(verifyBody(input, body), [
    nodeViolation("authored-node-ids-preserved", 999, "typed node identity differs from the actual authored node at this position"),
    nodeViolation("no-inserted-nodes", 999, "typed syntax includes a node not present in the actual source arena"),
    nodeViolation("node-in-body-range", 999, "typed syntax contains a real or invented node outside its actual original body subtree"),
    nodeViolation("node-reference", 999, "node identity does not name an actual node in its module arena"),
  ]);
  list.id = fixture.nodes.end;
  assertCompleteValue(verifyBody(input, body), [
    nodeViolation("module-node-identity", fixture.nodes.end, "chapter has conflicting authored occurrences"),
    nodeViolation("authored-node-ids-preserved", fixture.nodes.end, "typed node identity differs from the actual authored node at this position"),
    nodeViolation("node-in-body-range", fixture.nodes.end, "typed syntax contains a real or invented node outside its actual original body subtree"),
  ]);
  list.id = 101;
  assertCompleteValue(verifyBody(input, body), []);
});

for (const access of ["write", "read-write"]) {
  for (const mismatch of ["decision-endpoint", "missing-setter", "table-endpoint", "getter-role"]) {
    test(`F4 authentic ${access} accessor ${mismatch} retains its complete activation vector`, () => {
      const fixture = assignmentMemberScenario(access);
      const sourceStatement = fixture.input.source.tree.statements.nodes[0];
      const assignment = sourceStatement.expression;
      sourceStatement.expression = fixture.sourceMember;
      attachActualGetter(fixture);
      sourceStatement.expression = assignment;
      const actualGetter = fixture.selection.getter;
      if (access === "write") {
        fixture.selection.getter = null;
        fixture.decision.getter = null;
        replaceScopeInventory(fixture.input, Array.from({ length: 3 }, emptyScope));
      }
      attachActualSetter(fixture);
      assertCompleteValue(verifyBody(fixture.input, fixture.body), []);
      const setter = fixture.selection.setter;
      const getter = fixture.selection.getter;
      const endpoint = fixture.decision.setter;
      const tableSetter = fixture.table.accessors[0].setter;
      if (mismatch === "decision-endpoint") fixture.decision.setter = { ...endpoint, signature: 0 };
      if (mismatch === "missing-setter") fixture.selection.setter = null;
      if (mismatch === "table-endpoint") fixture.table.accessors[0].setter = ownerId;
      if (mismatch === "getter-role") {
        if (access === "read-write") fixture.selection.getter = null;
        else {
          fixture.selection.getter = actualGetter;
          fixture.decision.getter = actualGetter.decision.api;
          fixture.table.accessors[0].getter = actualGetter.decision.api.declaration;
        }
      }
      replaceScopeInventory(fixture.input, Array.from({ length: 3 + (fixture.selection.getter === null ? 0 : 2) +
        (fixture.selection.setter === null ? 0 : 2) }, emptyScope));
      assertCompleteValue(verifyBody(fixture.input, fixture.body), [nodeViolation("accessor-activation", 2,
        "selected accessor activation does not retain the actual member endpoint and access role")]);
      fixture.selection.setter = setter;
      fixture.selection.getter = getter;
      fixture.decision.setter = endpoint;
      if (access === "write") fixture.decision.getter = null;
      fixture.table.accessors[0].setter = tableSetter;
      replaceScopeInventory(fixture.input, Array.from({ length: access === "write" ? 5 : 7 }, emptyScope));
      assertCompleteValue(verifyBody(fixture.input, fixture.body), []);
    });
  }
}

test("F4 a genuine namespace definition owns its authentic nested Block template", () => {
  const body = emptyModuleBody();
  const definition = "D[M[P[p];m];space]";
  const nestedId = "B[D[M[P[p];m];space];module;0]";
  const block = { ...header(3, 2), kind: "Block", statements: nodeList(), multiLine: false, tsonic: null };
  const sourceBlock = { ...header(3, 2), kind: "Block", statements: nodeList(), multiLine: false, tsonic: null };
  const moduleBlock = { ...header(2, 1), kind: "ModuleBlock", statements: nodeList([block]), tsonic: null };
  const sourceModuleBlock = { ...header(2, 1), kind: "ModuleBlock", statements: nodeList([sourceBlock]), tsonic: null };
  const name = { ...header(4, 1), kind: "Identifier", text: "space", tsonic: { role: "declaration-name",
    declaration: { kind: "definition", definition }, storage: null } };
  const sourceName = { ...header(4, 1), kind: "Identifier", text: "space", tsonic: { core: emptyCore(), role: "declaration-name",
    declaration: { kind: "definition", definition } } };
  const template = { body: nestedId, lexicalBindings: emptyBindings(), dependence: "parametric" };
  const namespace = { ...header(1, 0), kind: "ModuleDeclaration", modifiers: null, asteriskToken: null, body: moduleBlock,
    keyword: "NamespaceKeyword", name, tsonic: { definition, type: 0, template } };
  const sourceNamespace = { ...header(1, 0), kind: "ModuleDeclaration", modifiers: null, asteriskToken: null, body: sourceModuleBlock,
    keyword: "NamespaceKeyword", name: sourceName, tsonic: { core: emptyCore(), parent: ownerId, attributes: [],
      memory: available(null), definition, members: [] } };
  const end = { ...header(5, 0), kind: "EndOfFile", tsonic: null };
  const sourceEnd = { ...header(5, 0), kind: "EndOfFile", tsonic: null };
  body.root.statements = nodeList([readyStatement(namespace)]);
  body.root.endOfFileToken = end;
  body.nestedBodies = [nestedId];
  const nested = { ...emptyModuleBody(), body: nestedId, owner: definition, root: block, signature: 1 };
  const input = emptyVerificationInput(body, [], 3);
  input.source.tree.statements = nodeList([sourceNamespace]);
  input.source.tree.endOfFileToken = sourceEnd;
  input.source.items.push({ definition, node: 1 });
  input.source.bodies[0].nestedBodies = [nestedId];
  input.source.bodies.push({ body: nestedId, owner: definition, root: sourceBlock, params: [], locals: [], captures: [], scopes: [],
    asynchronous: false, generator: false, candidateLists: [], nestedBodies: [] });
  input.module.bodies.push(nested);
  input.types.signatures.push({ id: 1, declaration: definition, owner: { kind: "body", value: { body: nestedId, node: 3 } },
    composition: null, kind: "call", typeParameters: [], receiver: null, parameters: [], result: 0 });
  const declarationOf = input.declarationOf;
  input.declarationOf = selected => selected === definition ? { scope: emptyScope(), parameterCount: 0, endpoints: [] } : declarationOf(selected);
  const nodes = new Map([input.source.tree, sourceNamespace, sourceModuleBlock, sourceBlock, sourceName, sourceEnd].map(node => [node.id, node]));
  input.nodeOf = reference => reference.kind === "body" ? reference.value.body === bodyId ? nodes.get(reference.value.node) ?? null
    : reference.value.body === nestedId && reference.value.node === 3 ? sourceBlock : null
    : reference.value.owner === ownerId || reference.value.owner === definition ? nodes.get(reference.value.node) ?? null : null;
  assertCompleteValue(verifyBody(input, body), []);
  template.body = bodyId;
  assertCompleteValue(verifyBody(input, body), [nodeViolation("nested-template-identity", 1,
    "typed template does not retain its real authored body and shared syntax identity")]);
  template.body = nestedId;
  assertCompleteValue(verifyBody(input, body), []);
});

for (const kind of ["FunctionExpression", "ArrowFunction"]) {
  for (const count of [0, 1, 2]) {
    test(`F4 genuine ${kind} own-template captures count=${count} retain the full ordered opposite`, () => {
      const fixture = genericFunctionScenario();
      const body = fixture.functionTemplate;
      const foreignBody = "B[D[M[P[foreign];source];outer];function;0]";
      const foreignLocals = Array.from({ length: 2 }, (_, id) => ({ id, declaration: { kind: "body", value: { body: foreignBody, node: id } },
        name: `outer${id}`, role: "binding", storage: 0, capturedFrom: null, mutable: true }));
      const captures = foreignLocals.slice(0, count).map(local => ({ body: foreignBody, local: local.id }));
      fixture.originalFunction.captures = captures;
      fixture.checkedFunction.tsonic.captures = captures;
      for (const published of [fixture.functionTemplate, ...fixture.instances]) {
        published.captures = bodyRows(captures);
        published.root.tsonic.closure = closureDecisionOf(4, captures);
        if (kind === "ArrowFunction") {
          published.root.kind = kind;
          delete published.root.name;
          published.root.equalsGreaterThanToken = { ...header(11, 2), kind: "EqualsGreaterThanToken", tsonic: null };
        }
      }
      if (kind === "ArrowFunction") {
        fixture.checkedFunction.kind = kind;
        delete fixture.checkedFunction.name;
        fixture.checkedFunction.equalsGreaterThanToken = { ...header(11, 2), kind: "EqualsGreaterThanToken", tsonic: null };
        fixture.functionNodes.set(11, fixture.checkedFunction.equalsGreaterThanToken);
      }
      const input = fixture.inputFor(body);
      const localExists = input.localExists;
      input.localExists = reference => reference.body === foreignBody ? foreignLocals[reference.local] !== undefined : localExists(reference);
      assertCompleteValue(verifyBody(input, body), []);
      // The decision's rows name the captured locals; the body states the same rows. Change both together to judge the
      // locals alone, and one of them to judge their agreement.
      const own = [{ body: fixture.functionBody, local: 0 }];
      const sequence = nodeViolation("capture-qualified", 2, "closure captures do not retain the real authored outer-local sequence");
      const agree = bodyViolation("capture-rows-agree", "body capture rows do not state the outcome of the closure that creates the body", fixture.functionBody);
      body.root.tsonic.closure = closureDecisionOf(4, own); body.captures = bodyRows(own);
      assertCompleteValue(verifyBody(input, body), [
        bodyViolation("capture-qualified", "capture inventory does not name a real qualified outer local", fixture.functionBody),
        bodyViolation("stable-order", "capture and nested-body inventories do not retain actual source order", fixture.functionBody),
        nodeViolation("capture-qualified", 2, "closure captures contain a local from the closure's own body"), sequence]);
      if (count === 2) {
        const reversed = [...captures].reverse();
        body.root.tsonic.closure = closureDecisionOf(4, reversed); body.captures = bodyRows(reversed);
        assertCompleteValue(verifyBody(input, body), [
          bodyViolation("stable-order", "capture and nested-body inventories do not retain actual source order", fixture.functionBody), sequence]);
      }
      body.root.tsonic.closure = closureDecisionOf(4, captures); body.captures = bodyRows(captures);
      assertCompleteValue(verifyBody(input, body), []);
      const missing = nodeViolation("cross-owner-qualified", 2, "local reference does not name an actual local in its declared body");
      for (const wrong of [[...captures, { body: foreignBody, local: count }], ...(count === 0 ? [] : [captures.slice(1)])]) {
        body.root.tsonic.closure = closureDecisionOf(4, wrong);
        // the foreign body has two locals: a row naming the third is a reference to no local
        assertCompleteValue(verifyBody(input, body), [agree, ...(wrong.some(local => local.local >= 2) ? [missing] : []), sequence]);
      }
      body.root.tsonic.closure = closureDecisionOf(4, captures, "captured-value");
      assertCompleteValue(verifyBody(input, body), count === 0 ? [] : [agree]);
      body.captures = bodyRows(captures, "captured-value");
      assertCompleteValue(verifyBody(input, body), []);
      body.root.tsonic.closure = closureDecisionOf(4, captures); body.captures = bodyRows(captures);
      assertCompleteValue(verifyBody(input, body), []);
    });
  }
}

test("F4 an ordinary actual argument cannot claim a tuple component", () => {
  const fixture = callScenario();
  fixture.decision.parameters[0].component = 0;
  assertCompleteValue(verifyBody(fixture.input, fixture.body), [nodeViolation("authored-order-preserved", 2,
    "argument transport does not retain the original authored argument sequence")]);
  fixture.decision.parameters[0].component = null;
  assertCompleteValue(verifyBody(fixture.input, fixture.body), []);
});

test("F4 complete array separator failure retains the second quoted token's own coordinate", () => {
  const body = emptyModuleBody();
  body.root.flags = ["Ambient", "Const"];
  const expected = readFileSync(resolve(repository, functionDirectory, "empty-module.input.tir"), "utf8")
    .replace("flags=[]", 'flags=["Ambient", "Const"]');
  assertBodyRoundTrip(body, expected, "actual two flags");
  const text = expected.replace('["Ambient", "Const"]', '["Ambient" "Const"]');
  assertInvalidText(text, text.indexOf('"Const"'), [",", "]"], '"Const"');
  const malformed = expected.replace('["Ambient", "Const"]', '["Ambient" "Const\\q"]');
  assertInvalidText(malformed, malformed.indexOf('"Const'), [",", "]"], '"');
});

for (const [field, prefix] of [["root", "n"], ["signature", "sig"], ["completion", "t"]]) {
  test(`a numeric ${field} identity retains a complete nonnumeric-token failure`, () => {
    const text = completeEmptyWire.replace(`${field}=${prefix}:0`, `${field}=${prefix}:true`);
    assertInvalidText(text, text.indexOf(`${field}=${prefix}:true`) + field.length + prefix.length + 2,
      ["identity number"], "true");
  });
}

test("F4 complete header precedes the actual declaration lexical and scalar failures", () => {
  const expected = readFileSync(resolve(repository, functionDirectory, "empty-module.input.tir"), "utf8");
  const header = expected.split("\n")[0];
  const negative = expected.replace("root=n:0", "root=n:-1");
  assertInvalidText(negative, negative.indexOf("root=n:") + 5, ["$TirBodyRoot"], "n:-1");
  const number = openTypedWire(header) + "n:-";
  assertInvalidText(number, number.length - 1, ["number"], "-");
  const scalar = openTypedWire(header) + "n:0=0";
  assertInvalidText(scalar, scalar.length - 1, ["$SyntaxNode"], "0");
  assertBodyRoundTrip(emptyModuleBody(), expected, "complete declaration positive");
});

test("F4 a genuine zero-argument bodyless call has no invented optional or rest formal", () => {
  const fixture = argumentScenario("optional");
  fixture.parameters.length = 0;
  fixture.decision.parameters = [];
  fixture.application.arguments = [];
  assertCompleteValue(verifyBody(fixture.input, fixture.body), []);
});

for (const kind of ["ThisKeyword", "SuperKeyword"]) {
  test(`F4 actual ${kind} retains its explicit receiver role and value endpoints`, () => {
    const checked = { ...header(2, 1), kind, tsonic: { core: emptyCore(), role: "value", value: checkedValue() } };
    const typed = { ...header(2, 1), kind, tsonic: { ...typedValue(), role: kind === "ThisKeyword" ? "receiver" : "super",
      owner: ownerId, ...(kind === "SuperKeyword" ? { base: 0 } : {}) } };
    const fixture = expressionScenario(checked, typed, [], 3, []);
    assertCompleteValue(verifyBody(fixture.input, fixture.body), []);
    typed.tsonic = { role: "type-literal", type: 0 };
    assertCompleteValue(verifyBody(fixture.input, fixture.body), [
      nodeViolation("occurrence-role", 2, "typed occurrence does not retain its authored occurrence role"),
      nodeViolation("typed-value-occurrence", 2, "authored value occurrence has no typed value endpoints"),
    ]);
  });
}

for (const kind of ["PrivateIdentifier"]) {
  test(`F4 actual ${kind} loses neither name-position nor value cofindings`, () => {
    const sourceName = (identity, text, parent) => ({ ...header(identity, parent), kind: "Identifier", text,
      tsonic: { core: emptyCore(), role: "type-name", resolution: { kind: "declarations", definitions: [ownerId] } } });
    const typedName = (identity, text, parent) => ({ ...header(identity, parent), kind: "Identifier", text,
      tsonic: { role: "type-name", type: 0, declarations: [ownerId] } });
    const checked = { ...header(2, 1), kind, ...(kind === "PrivateIdentifier" ? { text: "name" } :
      { left: sourceName(3, "Left", 2), right: sourceName(4, "Right", 2) }),
      tsonic: { core: emptyCore(), role: "type-name", resolution: { kind: "declarations", definitions: [ownerId] } } };
    const typed = { ...header(2, 1), kind, ...(kind === "PrivateIdentifier" ? { text: "name" } :
      { left: typedName(3, "Left", 2), right: typedName(4, "Right", 2) }),
      tsonic: { role: "declaration-name", declaration: { kind: "definition", definition: ownerId }, storage: null } };
    const fixture = expressionScenario(checked, typed, kind === "PrivateIdentifier" ? [] : [checked.left, checked.right], kind === "PrivateIdentifier" ? 3 : 5, []);
    assertCompleteValue(verifyBody(fixture.input, fixture.body), [
      nodeViolation("occurrence-role", 2, "typed occurrence does not retain its authored occurrence role"),
      nodeViolation("name-role-position", 2, "name role does not match its original syntactic position"),
    ]);
    typed.tsonic = { role: "type-name", type: 0, declarations: [ownerId] };
    assertCompleteValue(verifyBody(fixture.input, fixture.body), []);
  });
}

test("F4 QualifiedName uses its genuine EntityName slot and complete body role vector", () => {
  const fixture = typeAliasModuleScenario(true);
  const sourceAlias = fixture.input.source.tree.statements.nodes[0];
  const sourceName = (id, text) => ({ ...header(id, 4), kind: "Identifier", text, tsonic: { core: emptyCore(), role: "type-name",
    resolution: { kind: "definition", definition: fixture.definition, aliases: [] } } });
  const name = (id, text) => ({ ...header(id, 4), kind: "Identifier", text,
    tsonic: { role: "type-name", type: 0, declarations: [fixture.definition] } });
  const source = { ...header(4, 3), kind: "QualifiedName", left: sourceName(5, "Left"), right: sourceName(6, "Right"),
    tsonic: { core: emptyCore(), role: "type-name", resolution: { kind: "declarations", definitions: [fixture.definition] } } };
  const typed = { ...header(4, 3), kind: "QualifiedName", left: name(5, "Left"), right: name(6, "Right"),
    tsonic: { role: "declaration-name", declaration: { kind: "definition", definition: fixture.definition }, storage: null } };
  sourceAlias.type = { ...header(3, 1), kind: "TypeReference", typeArguments: null, typeName: source,
    tsonic: { core: emptyCore(), type: available(0), referencedDefinitions: [fixture.definition] } };
  fixture.alias.type = { ...header(3, 1), kind: "TypeReference", typeArguments: null, typeName: typed,
    tsonic: { type: 0, declarations: [fixture.definition] } };
  fixture.input.source.tree.endOfFileToken = { ...header(7, 0), kind: "EndOfFile", tsonic: null };
  fixture.body.root.endOfFileToken = { ...header(7, 0), kind: "EndOfFile", tsonic: null };
  const nodes = new Map([sourceAlias.type, source, source.left, source.right, fixture.input.source.tree.endOfFileToken].map(node => [node.id, node]));
  const nodeOf = fixture.input.nodeOf;
  fixture.input.nodeOf = reference => reference.kind === "item" && reference.value.owner === fixture.definition
    ? nodes.get(reference.value.node) ?? nodeOf(reference) : nodeOf(reference);
  assertCompleteValue(verifyBody(fixture.input, fixture.body), [
    nodeViolation("occurrence-role", 4, "typed occurrence does not retain its authored occurrence role"),
    nodeViolation("name-role-position", 4, "name role does not match its original syntactic position"),
  ]);
  typed.tsonic = { role: "type-name", type: 0, declarations: [fixture.definition] };
  assertCompleteValue(verifyBody(fixture.input, fixture.body), []);
});

function foreignMemberScenario(kind) {
  const fixture = memberScenario("element-access");
  const classDefinition = "D[M[P[api];surface];Container]";
  const fieldDefinition = "D[M[P[api];surface];Container/x]";
  const mappedDefinition = "D[M[P[api];mapped];Alias]";
  const parameterDefinition = "D[M[P[api];mapped];Alias/K]";
  const classOrigin = { module: "M[P[api];surface]", start: 0, length: 0, derived: [] };
  const mappedOrigin = { module: "M[P[api];mapped]", start: 0, length: 0, derived: [] };
  const fieldName = { ...header(2, 1), origin: classOrigin, kind: "Identifier", text: "x", tsonic: { core: emptyCore(),
    role: "property-name", key: available({ kind: "text", value: "x" }), origins: available([{ kind: "declared", declaration: fieldDefinition }]) } };
  const field = { ...header(1, 0), origin: classOrigin, kind: "PropertyDeclaration", modifiers: null, name: fieldName,
    postfixToken: null, type: null, initializer: null, tsonic: { core: emptyCore(), parent: classDefinition, attributes: [],
      memory: available(null), declaration: { kind: "definition", definition: fieldDefinition }, declaredType: available(0), inferredTypeBound: null, initializer: null } };
  const className = { ...header(3, 0), origin: classOrigin, kind: "Identifier", text: "Container", tsonic: { core: emptyCore(),
    role: "declaration-name", declaration: { kind: "definition", definition: classDefinition } } };
  const declaration = { ...header(0), origin: classOrigin, kind: "ClassDeclaration", modifiers: null, name: className,
    typeParameters: null, heritageClauses: null, members: nodeList([field]), tsonic: { core: emptyCore(), parent: null,
      attributes: [], memory: available(null), definition: classDefinition, parameters: [], heritage: [], members: [fieldDefinition] } };
  const parameterName = { ...header(3, 2), origin: mappedOrigin, kind: "Identifier", text: "K", tsonic: { core: emptyCore(),
    role: "type-name", resolution: { kind: "definition", definition: parameterDefinition, aliases: [] } } };
  const constraint = { ...header(4, 2), origin: mappedOrigin, kind: "StringKeyword", tsonic: { core: emptyCore(), type: available(0), referencedDefinitions: [] } };
  const parameter = { ...header(2, 1), origin: mappedOrigin, kind: "TypeParameter", modifiers: null, name: parameterName,
    constraint, expression: null, defaultType: null, tsonic: { core: emptyCore(), parent: mappedDefinition, attributes: [],
      memory: available(null), definition: parameterDefinition, parameter: { declaration: parameterDefinition, constraint: 0, default: null } } };
  const type = { ...header(5, 1), origin: mappedOrigin, kind: "StringKeyword", tsonic: { core: emptyCore(), type: available(0), referencedDefinitions: [] } };
  const mapped = { ...header(1, 0), origin: mappedOrigin, kind: "MappedType", readonlyToken: null, typeParameter: parameter,
    nameType: null, questionToken: null, type, members: null,
    tsonic: { core: emptyCore(), type: available(1), referencedDefinitions: [] } };
  const aliasName = { ...header(6, 0), origin: mappedOrigin, kind: "Identifier", text: "Alias", tsonic: { core: emptyCore(),
    role: "declaration-name", declaration: { kind: "definition", definition: mappedDefinition } } };
  const alias = { ...header(0), origin: mappedOrigin, kind: "TypeAliasDeclaration", modifiers: null, name: aliasName,
    typeParameters: null, type: mapped, tsonic: { core: emptyCore(), parent: null, attributes: [], memory: available(null),
      definition: mappedDefinition, parameters: [], type: available(1) } };
  const classNodes = new Map([declaration, field, fieldName, className].map(node => [node.id, node]));
  const fieldNodes = new Map([field, fieldName].map(node => [node.id, node]));
  const mappedNodes = new Map([alias, mapped, parameter, parameterName, constraint, type, aliasName].map(node => [node.id, node]));
  const parameterNodes = new Map([parameter, parameterName, constraint].map(node => [node.id, node]));
  const nodeOf = fixture.input.nodeOf;
  fixture.input.nodeOf = reference => reference.kind === "item" ? reference.value.owner === classDefinition
    ? classNodes.get(reference.value.node) ?? null : reference.value.owner === fieldDefinition ? fieldNodes.get(reference.value.node) ?? null
      : reference.value.owner === mappedDefinition ? mappedNodes.get(reference.value.node) ?? null : reference.value.owner === parameterDefinition
        ? parameterNodes.get(reference.value.node) ?? null : nodeOf(reference) : nodeOf(reference);
  const declarationOf = fixture.input.declarationOf;
  const declarations = new Map([classDefinition, fieldDefinition, mappedDefinition, parameterDefinition].map(definition =>
    [definition, { scope: emptyScope(), parameterCount: 0, endpoints: [] }]));
  fixture.input.declarationOf = selected => declarations.get(selected) ?? declarationOf(selected);
  const provenance = kind === "declared" ? { kind, declaration: fieldDefinition } : kind === "class-prototype"
    ? { kind, owner: classDefinition } : { kind: "mapped", owner: { kind: "item", value: { owner: mappedDefinition, node: 1 } }, key: fixture.decision.key };
  const member = fixture.table.members[0];
  member.origins = [provenance];
  member.readOrigins = [provenance];
  member.writeOrigins = [provenance];
  fixture.decision.origins = [provenance];
  if (kind === "declared") { fixture.decision.selectedDeclarations = [fieldDefinition]; fixture.decision.primary = fieldDefinition; }
  fixture.input.source.tree.statements.nodes[0].expression.tsonic.origins = available([provenance]);
  return { ...fixture, classDefinition, fieldDefinition, mappedDefinition, provenance };
}

for (const kind of ["declared", "class-prototype", "mapped"]) {
  test(`F4 real ${kind} member provenance retains its complete declared association`, () => {
    const fixture = foreignMemberScenario(kind);
    assertCompleteValue(verifyBody(fixture.input, fixture.body), []);
    fixture.decision.origins = [{ kind: "declared", declaration: ownerId }];
    assertCompleteValue(verifyBody(fixture.input, fixture.body), [nodeViolation("member-origin", 2,
      "member selection does not retain a real member key and its actual declared origins")]);
    fixture.decision.origins = [fixture.provenance];
    assertCompleteValue(verifyBody(fixture.input, fixture.body), []);
  });
}

test("actual typed numeric binding qualification preserves its own key and original width stop", async () => {
  const { analysisInput } = await import("./fixtures/front/analysis-input.mjs");
  const { loadFrontFixture } = await import("./fixtures/front/checked-module.mjs");
  const { accountFailure, createAccount } = await import("../../packages/host/dist/dataflow/index.js");
  const { InvocationAccount } = await import("../../packages/host/dist/dataflow/account.js");
  const { tirReadyReadAdmission } = await import("../../packages/host/dist/ir-program/index.js");
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../packages/host/dist/pipeline/typed-barrier.js");
  const { verifyTir } = await import("../../packages/host/dist/ir-tir/index.js");
  const input = analysisInput(await loadFrontFixture(), "sdk-minimal", `
    export function read(source: { 16: boolean; 17: boolean }): boolean {
      const {0x10: value} = source;
      return !value;
    }
  `);
  const source = captureSourceBarrier(input);
  assert.equal(source.kind, "ok");
  const typed = typeSourceBarrier(input, source.value, createAccount(input.limits.dataflow));
  assert.equal(typed.kind, "ok");
  const proof = typed.value.verifierOf(input.snapshot.entryPoint);
  const body = proof.module.bodies.find(row => row.root.kind === "Block" && row.bindings.kind === "instantiated");
  const element = body.root.statements.nodes[0].declarationList.declarations.nodes[0].name.elements.nodes[0];
  const original = element.propertyName.tsonic.key;
  const instance = { body: body.body, bindings: body.bindings };
  const table = proof.memberTableOf(instance, { kind: "selection", node: element.id, ordinal: 0 });
  const sibling = table.members.find(row => row.key.kind === "number" && row.key.value.numerator === 17n);
  const verifyAt = (maximumWork, unreadSibling = false) => {
    const account = createAccount({ ...input.limits.dataflow, maximumWork });
    const pay = tirReadyReadAdmission(account);
    const requests = [];
    const owner = unreadSibling ? { ...proof, memberTableOf: (body, occurrence) => {
      const offered = proof.memberTableOf(body, occurrence);
      return offered !== table ? offered : { ...table, members: table.members.map(row => row !== sibling ? row : {
        ...row, get key() { return assert.fail("later numeric inventory key after the first width refusal"); },
      }) };
    } } : proof;
    const result = verifyTir(owner, request => {
      requests.push([request.kind, InvocationAccount.stateOf(account).work]);
      return pay(request);
    })(body);
    return { result, requests, stop: accountFailure(account), pay };
  };
  const limits = input.limits.dataflow;
  const complete = verifyAt(limits.maximumWork);
  assert.deepEqual(complete.result, { kind: "complete", violations: [] });
  const firstWidth = complete.requests.findIndex(([kind]) => kind === "member") + 1;
  assert.ok(firstWidth > 0);
  assert.equal(complete.requests[firstWidth][0], "source-field-proof");
  const cut = verifyAt(complete.requests[firstWidth][1], true);
  assert.equal(cut.result.kind === "resource-stop" && cut.result.stop === cut.stop, true);
  assert.equal(cut.pay({ kind: "prior" }) === cut.stop, true);
  assert.deepEqual(cut.requests, complete.requests.slice(0, firstWidth + 1));
  try {
    element.propertyName.tsonic.key = sibling.key;
    const crossed = verifyAt(limits.maximumWork).result;
    assert.equal(crossed.kind, "complete");
    assert.deepEqual(crossed.violations.map(row => [row.rule, row.site.node]), [["member-origin", element.id]]);
  } finally {
    element.propertyName.tsonic.key = original;
  }
});

test("F-3 source-only member selection cannot borrow a declaration identity", () => {
  const fixture = foreignMemberScenario("declared");
  const origin = { kind: "source-member", occurrence: { body: bodyId, node: 3 } };
  const member = fixture.table.members[0];
  member.origins = [origin];
  member.readOrigins = [origin];
  member.writeOrigins = [origin];
  fixture.decision.origins = [origin];
  fixture.input.source.tree.statements.nodes[0].expression.tsonic.origins = available([origin]);
  const mismatched = nodeViolation("member-origin", 2, "member selection does not retain a real member key and its actual declared origins");
  assertCompleteValue(verifyBody(fixture.input, fixture.body), [mismatched]);
  fixture.decision.primary = null;
  fixture.decision.selectedDeclarations = [];
  assertCompleteValue(verifyBody(fixture.input, fixture.body), []);
  fixture.decision.origins = [{ kind: "source-member", occurrence: { ...origin.occurrence, node: 4 } }];
  assertCompleteValue(verifyBody(fixture.input, fixture.body), [mismatched]);
});

test("intrinsic member inventory matches the exact retained symbol, not another intrinsic origin", () => {
  const fixture = foreignMemberScenario("declared");
  const origin = { kind: "intrinsic", symbol: "undefined" };
  const member = fixture.table.members[0];
  member.origins = [origin];
  member.readOrigins = [origin];
  member.writeOrigins = [origin];
  fixture.decision.origins = [origin];
  fixture.decision.primary = null;
  fixture.decision.selectedDeclarations = [];
  fixture.input.source.tree.statements.nodes[0].expression.tsonic.origins = available([origin]);
  assertCompleteValue(verifyBody(fixture.input, fixture.body), []);
  fixture.decision.origins = [{ kind: "intrinsic", symbol: "global-this" }];
  assertCompleteValue(verifyBody(fixture.input, fixture.body), [
    nodeViolation("member-origin", 2, "member selection does not retain a real member key and its actual declared origins"),
  ]);
});

for (const negative of ["primary-not-selected", "empty-selected", "other-selected"]) {
  test(`F4 primary/selected declaration association ${negative} uses real endpoints`, () => {
    const fixture = foreignMemberScenario("declared");
    if (negative === "primary-not-selected") fixture.decision.primary = fixture.classDefinition;
    if (negative === "empty-selected") fixture.decision.selectedDeclarations = [];
    if (negative === "other-selected") { fixture.decision.selectedDeclarations = [fixture.classDefinition]; fixture.decision.primary = null; }
    assertCompleteValue(verifyBody(fixture.input, fixture.body), [nodeViolation("member-origin", 2,
      "member selection does not retain a real member key and its actual declared origins")]);
    fixture.decision.primary = fixture.fieldDefinition;
    fixture.decision.selectedDeclarations = [fixture.fieldDefinition];
    assertCompleteValue(verifyBody(fixture.input, fixture.body), []);
  });
}

for (const [numerator, negativeZero] of [[1n, false], [0n, false], [0n, true]]) {
  test(`F4 actual numeric member key ${numerator}/${negativeZero} keeps the real literal`, () => {
    const fixture = memberScenario("element-access");
    const exact = { numerator, denominator: 1n, negativeZero };
    const text = negativeZero ? "-0" : String(numerator);
    const member = fixture.body.root.statements.nodes[0].node.expression;
    const sourceMember = fixture.input.source.tree.statements.nodes[0].expression;
    Object.assign(member.argumentExpression, { kind: "NumericLiteral", text,
      tsonic: { ...typedValue(), role: "value", value: exact } });
    Object.assign(sourceMember.argumentExpression, { kind: "NumericLiteral", text, tsonic: { core: emptyCore(), role: "value", value: checkedValue(),
      literal: { kind: "number", token: text, value: exact } } });
    const key = { kind: "number", value: exact };
    fixture.decision.key = key;
    fixture.table.members[0].key = key;
    fixture.decision.origins[0].key = key;
    assertCompleteValue(verifyBody(fixture.input, fixture.body), []);
    fixture.decision.key = { kind: "number", value: { numerator: 2n, denominator: 1n, negativeZero: false } };
    assertCompleteValue(verifyBody(fixture.input, fixture.body), [nodeViolation("member-origin", 2,
      "member selection does not retain a real member key and its actual declared origins")]);
    fixture.decision.key = key;
    assertCompleteValue(verifyBody(fixture.input, fixture.body), []);
  });
}

test("F4 an actual named value without its real local slot keeps every storage cofinding", () => {
  const body = emptyModuleBody();
  const local = { body: bodyId, local: 0 };
  const declaration = { kind: "local", local };
  const name = { ...header(4, 3), kind: "Identifier", text: "v", tsonic: { role: "declaration-name", declaration, storage: 0 } };
  const sourceName = { ...header(4, 3), kind: "Identifier", text: "v", tsonic: { core: emptyCore(), role: "declaration-name", declaration } };
  const variable = { ...header(3, 2), kind: "VariableDeclaration", name, exclamationToken: null, type: null, initializer: null,
    tsonic: { declaration, storage: 0, initializer: null } };
  const sourceVariable = { ...header(3, 2), kind: "VariableDeclaration", name: sourceName, exclamationToken: null, type: null, initializer: null,
    tsonic: { core: emptyCore(), parent: ownerId, attributes: [], memory: available(null), declaration, declaredType: available(0), inferredTypeBound: null, initializer: null } };
  const list = { ...header(2, 1), kind: "VariableDeclarationList", declarations: nodeList([variable]), tsonic: { role: "ordinary" } };
  const sourceList = { ...header(2, 1), kind: "VariableDeclarationList", declarations: nodeList([sourceVariable]), tsonic: { core: emptyCore(), disposal: [] } };
  const statement = { ...header(1, 0), kind: "VariableStatement", modifiers: null, declarationList: list, tsonic: null };
  const sourceStatement = { ...header(1, 0), kind: "VariableStatement", modifiers: null, declarationList: sourceList, tsonic: null };
  const end = { ...header(5, 0), kind: "EndOfFile", tsonic: null };
  body.root.statements = nodeList([readyStatement(statement)]);
  body.root.endOfFileToken = { ...end };
  const input = emptyVerificationInput(body, [sourceStatement, sourceList, sourceVariable, sourceName, end]);
  input.source.tree.statements = nodeList([sourceStatement]);
  input.source.tree.endOfFileToken = end;
  const declarationRef = { kind: "body", value: { body: bodyId, node: 3 } };
  input.source.bodies[0].locals = [{ id: 0, declaration: declarationRef, name: "v", role: "binding", checkerSlot: available(0), capturedFrom: null, mutable: true }];
  assertCompleteValue(verifyBody(input, body), [
    bodyViolation("binding-storage", "local inventory does not retain the actual source binding inventory"),
    nodeViolation("local-storage", 4, "same-body local reference does not select a real local storage slot"),
    nodeViolation("local-storage", 3, "same-body local reference does not select a real local storage slot"),
    nodeViolation("binding-storage", 3, "binding occurrence does not retain its actual qualified local storage slot"),
    nodeViolation("binding-storage", 4, "binding occurrence does not retain its actual qualified local storage slot"),
  ]);
  body.locals = [{ id: 0, declaration: declarationRef, name: "v", role: "binding", storage: 0, capturedFrom: null, mutable: true }];
  assertCompleteValue(verifyBody(input, body), []);
  variable.tsonic.storage = 1;
  input.types.terms.push({ kind: "string" });
  assertCompleteValue(verifyBody(input, body), [nodeViolation("binding-storage", 3,
    "binding occurrence does not retain its actual qualified local storage slot")]);
});

test("F4 an actual symbol member key uses its real declaration and authored identifier", () => {
  const fixture = foreignMemberScenario("declared");
  const member = fixture.body.root.statements.nodes[0].node.expression;
  const sourceMember = fixture.input.source.tree.statements.nodes[0].expression;
  const key = { kind: "symbol", declaration: fixture.fieldDefinition };
  const symbolType = fixture.input.types.terms.length;
  fixture.input.types.terms.push({ kind: "literal", value: { kind: "unique-symbol", declaration: fixture.fieldDefinition }, base: 0 });
  fixture.input.nodeOf({ kind: "item", value: { owner: fixture.fieldDefinition, node: 1 } }).tsonic.declaredType = available(symbolType);
  Object.assign(member.argumentExpression, { kind: "Identifier", text: "key", tsonic: {
    ...typedValue(symbolType), role: "value", resolution: { kind: "definition", definition: fixture.fieldDefinition, aliases: [] } } });
  delete member.argumentExpression.tokenFlags;
  Object.assign(sourceMember.argumentExpression, { kind: "Identifier", text: "key", tsonic: { core: emptyCore(),
    role: "value", value: checkedValue(symbolType), resolution: { kind: "declarations", definitions: [fixture.fieldDefinition] } } });
  delete sourceMember.argumentExpression.tokenFlags;
  fixture.decision.key = key;
  fixture.table.members[0].key = key;
  assertCompleteValue(verifyBody(fixture.input, fixture.body), []);
  fixture.decision.key = { kind: "symbol", declaration: fixture.classDefinition };
  assertCompleteValue(verifyBody(fixture.input, fixture.body), [nodeViolation("member-origin", 2,
    "member selection does not retain a real member key and its actual declared origins")]);
  fixture.decision.key = key;
  assertCompleteValue(verifyBody(fixture.input, fixture.body), []);
});

for (const childFirst of [false, true]) {
  for (const kind of ["open", "error"]) {
    test(`F4 actual ${kind} propagation childFirst=${childFirst} keeps the entire body finding`, () => {
      const body = emptyModuleBody();
      body.completion = childFirst ? 2 : 1;
      const input = emptyVerificationInput(body);
      const leaf = kind === "error" ? { kind } : { kind, group: `G[${bodyId}]`, variable: 0 };
      input.types.terms.push(...(childFirst ? [leaf, { kind: "optional", value: 1 }] : [{ kind: "optional", value: 2 }, leaf]));
      assertCompleteValue(verifyBody(input, body), [bodyViolation(kind === "error" ? "error-diagnostic" : "type-closed",
        kind === "error" ? "error type is not accompanied by an actual error diagnostic at its source origin"
          : "typed reference does not reach a present closed type/signature graph")]);
      if (kind === "error") {
        input.diagnostics = [{ code: { kind: "checker", number: 999, rendered: "TS999" }, severity: "error",
          site: { kind: "source", origin: origin() }, source: null, evidence: [], message: "actual source error",
          arguments: [], related: [], fix: null }];
        assertCompleteValue(verifyBody(input, body), []);
      }
      input.types.terms[1] = { kind: "optional", value: 2 };
      input.types.terms[2] = { kind: "array", element: 1, readonly: false };
      input.diagnostics = [];
      assertCompleteValue(verifyBody(input, body), []);
    });
  }
}

test("F4 genuine error recovery retains both complete node findings until its exact diagnostic arrives", () => {
  const source = { ...header(2, 1), origin: origin(10, 1), kind: "Identifier", text: "missing",
    tsonic: { core: emptyCore(), role: "value", value: checkedValue(1), resolution: { kind: "unresolved", checkerDiagnostic: null } } };
  const typed = { ...header(2, 1), origin: origin(10, 1), kind: "Identifier", text: "missing",
    tsonic: { ...typedValue(1), role: "value", resolution: { kind: "error", diagnostic: 0 } } };
  const fixture = expressionScenario(source, typed, [], 3, [{ kind: "error" }]);
  const expected = [nodeViolation("error-diagnostic", 2, "error type is not accompanied by an actual error diagnostic at its source origin"),
    nodeViolation("error-diagnostic", 2, "error resolution does not select an actual error diagnostic at its source origin")];
  assertCompleteValue(verifyBody(fixture.input, fixture.body), expected);
  fixture.input.diagnostics = [{ code: { kind: "checker", number: 2304, rendered: "TS2304" }, severity: "error",
    site: { kind: "source", origin: origin() }, source: null, evidence: [], message: "missing name", arguments: [], related: [], fix: null }];
  assertCompleteValue(verifyBody(fixture.input, fixture.body), expected);
  fixture.input.diagnostics[0].site.origin = origin(10, 1);
  assertCompleteValue(verifyBody(fixture.input, fixture.body), []);
});

test("F4 a genuine captured local cannot substitute another existing foreign local", () => {
  const fixture = genericFunctionScenario();
  const body = fixture.functionTemplate;
  const outerDefinition = "D[M[P[foreign];source];outer]";
  const outerBody = "B[D[M[P[foreign];source];outer];function;0]";
  const definitions = ["D[M[P[foreign];source];outer/first]", "D[M[P[foreign];source];outer/second]"];
  const outerOrigin = { module: "M[P[foreign];source]", start: 0, length: 0, derived: [] };
  const parameters = definitions.map((definition, position) => ({ ...header(position, 10), origin: outerOrigin, kind: "Parameter",
    modifiers: null, dotDotDotToken: null, name: { ...header(position + 2, position), origin: outerOrigin, kind: "Identifier",
      text: position === 0 ? "first" : "second", tsonic: { core: emptyCore(), role: "declaration-name",
        declaration: { kind: "local", local: { body: outerBody, local: position } } } }, questionToken: null, type: null, initializer: null,
    tsonic: { core: emptyCore(), parent: outerDefinition, attributes: [], memory: available(null),
      declaration: { kind: "local", local: { body: outerBody, local: position } }, declaredType: available(0), inferredTypeBound: null, initializer: null } }));
  const locals = parameters.map((parameter, position) => ({ id: position, declaration: { kind: "item",
    value: { owner: definitions[position], node: parameter.id } }, name: parameter.name.text, role: "parameter",
    checkerSlot: available(0), capturedFrom: null, mutable: true }));
  const foreign = { body: outerBody, owner: outerDefinition, root: { ...header(10), origin: outerOrigin, kind: "FunctionExpression",
    modifiers: null, typeParameters: null, parameters: nodeList(parameters), type: null, fullSignature: null, asteriskToken: null,
    body: { ...header(11, 10), origin: outerOrigin, kind: "Block", statements: nodeList(), multiLine: false, tsonic: null }, name: null,
    tsonic: { core: emptyCore(), ...checkedValue(), body: outerBody, captures: [] } },
    params: definitions.map((declaration, local) => ({ local, declaration, role: "required", passing: "by-value", initializer: null })),
    locals, captures: [], scopes: [], asynchronous: false, generator: false, candidateLists: [], nestedBodies: [] };
  const first = { body: outerBody, local: 0 };
  const declaration = { kind: "item", value: { owner: definitions[0], node: 0 } };
  body.params = [];
  body.root.parameters = nodeList();
  body.completion = 0;
  body.locals = [{ id: 0, declaration, name: "first", role: "capture", storage: 0, capturedFrom: first, mutable: true }];
  body.captures = bodyRows([first]);
  body.root.tsonic.closure = closureDecisionOf(4, [first]);
  fixture.checkedFunction.parameters = nodeList();
  fixture.checkedFunction.tsonic.captures = [first];
  fixture.originalFunction.params = [];
  fixture.originalFunction.locals = [{ id: 0, declaration, name: "first", role: "capture", checkerSlot: available(0), capturedFrom: first, mutable: true }];
  fixture.originalFunction.captures = [first];
  const value = body.root.body.statements.nodes[0].expression;
  const sourceValue = fixture.checkedFunction.body.statements.nodes[0].expression;
  value.text = "first";
  value.tsonic = { ...typedValue(), role: "value", resolution: { kind: "local", local: { body: fixture.functionBody, local: 0 } } };
  sourceValue.text = "first";
  sourceValue.tsonic = { core: emptyCore(), role: "value", value: checkedValue(), resolution: value.tsonic.resolution };
  for (const signature of fixture.types.signatures.slice(1)) { signature.parameters = []; signature.result = 0; }
  fixture.declarations.get(fixture.definition).parameterCount = 0;
  fixture.declarations.delete(fixture.valueDefinition);
  fixture.itemNodes.delete(fixture.valueDefinition);
  fixture.functionNodes.delete(5);
  fixture.functionNodes.delete(6);
  fixture.outerNodes.delete(5);
  fixture.outerNodes.delete(6);
  fixture.module.bodies = [fixture.outer, body];
  const input = fixture.inputFor(body);
  input.source.items = input.source.items.filter(item => item.definition !== fixture.valueDefinition);
  input.localExists = reference => reference.body === outerBody ? foreign.locals[reference.local] !== undefined
    : reference.body === fixture.functionBody && fixture.originalFunction.locals[reference.local] !== undefined;
  const nodeOf = input.nodeOf;
  const foreignNodes = new Map([foreign.root, foreign.root.body, ...parameters, ...parameters.map(parameter => parameter.name)].map(node => [node.id, node]));
  const parameterNodes = parameters.map(parameter => new Map([[parameter.id, parameter], [parameter.name.id, parameter.name]]));
  input.nodeOf = reference => reference.kind === "body" && reference.value.body === outerBody
    ? foreignNodes.get(reference.value.node) ?? null : reference.kind === "item" && reference.value.owner === definitions[0]
      ? parameterNodes[0].get(reference.value.node) ?? null : reference.kind === "item" && reference.value.owner === definitions[1]
        ? parameterNodes[1].get(reference.value.node) ?? null : nodeOf(reference);
  const declarationOf = input.declarationOf;
  input.declarationOf = selected => definitions.includes(selected) || selected === outerDefinition
    ? { scope: emptyScope(), parameterCount: selected === outerDefinition ? 2 : 0, endpoints: [] } : declarationOf(selected);
  assertCompleteValue(verifyBody(input, body), []);
  body.locals[0].declaration = { kind: "item", value: { owner: definitions[1], node: 1 } };
  assertCompleteValue(verifyBody(input, body), [bodyViolation("binding-storage",
    "local storage is not associated with its real original binding", fixture.functionBody)]);
  body.locals[0].declaration = declaration;
  body.locals[0].capturedFrom = { body: outerBody, local: 1 };
  assertCompleteValue(verifyBody(input, body), [bodyViolation("capture-qualified",
    "captured local does not retain its actual qualified outer binding", fixture.functionBody)]);
  body.locals[0].capturedFrom = first;
  assertCompleteValue(verifyBody(input, body), []);
});

for (const kind of ["CallExpression", "NewExpression"]) {
  test(`F4 actual ${kind} deferred application retains its whole captured candidate input`, () => {
    const fixture = argumentScenario("whole");
    if (kind === "NewExpression") {
      fixture.call.kind = kind;
      delete fixture.call.questionDotToken;
      const source = fixture.input.source.tree.statements.nodes[0].expression;
      source.kind = kind;
      delete source.questionDotToken;
      fixture.captured.kind = "construct";
      fixture.input.types.signatures[1].kind = "construct";
      fixture.input.types.terms[1] = { kind: "callable", calls: [], constructs: [1] };
    }
    const evidence = (node, type) => ({ type, component: { kind: "body", value: { body: bodyId, node } },
      category: { kind: "dynamic" }, numeric: null, sum: null, nominal: null, pointer: null });
    const context = { occurrence: { body: bodyId, node: 2 }, origin: origin(), bindings: emptyBindings() };
    const input = { context, kind: kind === "CallExpression" ? "call" : "construct", callee: evidence(3, 1), receiver: null,
      typeArguments: [], arguments: [{ occurrence: { body: bodyId, node: 5 }, kind: "spread", value: evidence(5, 5), tuple: [evidence(5, 2), evidence(5, 2)] }],
      candidates: [{ ordinal: 0, declaration: fixture.definition, advertised: fixture.decision.advertised,
        advertisedSignature: fixture.decision.advertised.signature, api: fixture.decision.api, apiSignature: fixture.decision.api.signature,
        bindings: emptyBindings(), conditionalFailure: null }] };
    fixture.call.tsonic.application = { kind: "deferred", deferred: { invocation: { rule: "candidate", input }, result: 0 } };
    replaceScopeInventory(fixture.input, Array.from({ length: 4 }, emptyScope));
    assertCompleteValue(verifyBody(fixture.input, fixture.body), []);
    context.occurrence.node = 3;
    assertCompleteValue(verifyBody(fixture.input, fixture.body), [nodeViolation("deferred-parameters", 2,
      "saved invocation does not retain its occurrence and complete captured rigid-parameter support")]);
    context.occurrence.node = 2;
    assertCompleteValue(verifyBody(fixture.input, fixture.body), []);
  });
}

for (const mode of ["absent", "decided", "deferred"]) {
  test(`F4 actual value instantiation application ${mode} retains its full public outcome`, () => {
    const fixture = argumentScenario("optional");
    fixture.parameters.length = 0;
    fixture.decision.parameters = [];
    const source = fixture.input.source.tree.statements.nodes[0].expression;
    source.kind = "ExpressionWithTypeArguments";
    delete source.questionDotToken;
    delete source.arguments;
    source.tsonic = { core: emptyCore(), role: "value", value: checkedValue() };
    fixture.call.kind = "ExpressionWithTypeArguments";
    delete fixture.call.questionDotToken;
    delete fixture.call.arguments;
    const evidence = { type: 1, component: { kind: "body", value: { body: bodyId, node: 3 } }, category: { kind: "dynamic" },
      numeric: null, sum: null, nominal: null, pointer: null };
    const application = mode === "absent" ? null : mode === "decided" ? { kind: "decided", decision: fixture.decision } :
      { kind: "deferred", deferred: { invocation: { rule: "candidate", input: { context: { occurrence: { body: bodyId, node: 2 },
        origin: origin(), bindings: emptyBindings() }, kind: "call", callee: evidence, receiver: null, typeArguments: [], arguments: [],
        candidates: [{ ordinal: 0, declaration: fixture.definition, advertised: fixture.decision.advertised,
          advertisedSignature: fixture.decision.advertised.signature, api: fixture.decision.api,
          apiSignature: fixture.decision.api.signature, bindings: emptyBindings(), conditionalFailure: null }] } }, result: 0 } };
    fixture.call.tsonic = { ...typedValue(), role: "value", bindings: emptyBindings(), application };
    replaceScopeInventory(fixture.input, Array.from({ length: mode === "absent" ? 3 : 5 }, emptyScope));
    assertCompleteValue(verifyBody(fixture.input, fixture.body), []);
    if (mode === "decided") {
      fixture.input.types.signatures[1].declaration = ownerId;
      assertCompleteValue(verifyBody(fixture.input, fixture.body), [nodeViolation("call-endpoints", 2,
        "selected callable endpoints do not belong to their actual declarations and candidate")]);
      fixture.input.types.signatures[1].declaration = fixture.definition;
      assertCompleteValue(verifyBody(fixture.input, fixture.body), []);
    }
  });
}

test("F4 a saved self-type conversion requires the genuine captured self owner", () => {
  const fixture = deferredConversionScenario();
  const selfType = fixture.types.terms.length;
  fixture.types.terms.push({ kind: "self", owner: fixture.definition });
  fixture.scope.selfOwners.push(fixture.definition);
  fixture.body.lexicalBindings.selfBindings.push({ kind: "rigid", owner: fixture.definition });
  fixture.body.root.tsonic.callable.template.lexicalBindings.selfBindings.push({ kind: "rigid", owner: fixture.definition });
  fixture.body.completion = selfType;
  fixture.types.signatures[1].result = selfType;
  const source = fixture.checkedFunction.body.statements.nodes[0].expression;
  source.kind = "ThisKeyword";
  delete source.text;
  source.tsonic = { core: emptyCore(), role: "value", value: checkedValue(selfType) };
  fixture.value.kind = "ThisKeyword";
  delete fixture.value.text;
  fixture.deferred.result = selfType;
  const evidence = { ...fixture.deferred.invocation.input.from, type: selfType, category: { kind: "dynamic" } };
  fixture.deferred.invocation.input.from = evidence;
  fixture.deferred.invocation.input.to = evidence;
  fixture.value.tsonic = { ...typedValue(selfType), role: "receiver", owner: fixture.definition,
    conversion: { kind: "deferred", deferred: fixture.deferred } };
  assertCompleteValue(verifyBody(fixture.input, fixture.body), []);
  const scopes = [...bodyScopes(fixture.input, fixture.body)];
  fixture.context.bindings = { ...fixture.body.lexicalBindings, selfBindings: [] };
  replaceScopeInventory(fixture.input, [scopes[0], { ...fixture.scope, selfOwners: [] }, scopes[2]]);
  assertCompleteValue(verifyBody(fixture.input, fixture.body), [nodeViolation("deferred-parameters", 9,
    "saved invocation does not retain its occurrence and complete captured rigid-parameter support")]);
  fixture.context.bindings = fixture.body.lexicalBindings;
  replaceScopeInventory(fixture.input, scopes);
  assertCompleteValue(verifyBody(fixture.input, fixture.body), []);
});

test("a typed protocol cannot replace a genuine authored nonprotocol expression", () => {
  const exact = { numerator: 1n, denominator: 1n, negativeZero: false };
  const operand = { ...header(3, 2), kind: "NumericLiteral", text: "1", tokenFlags: [],
    tsonic: { ...typedValue(1), role: "value", value: exact } };
  const checkedOperand = { ...header(3, 2), kind: "NumericLiteral", text: "1", tokenFlags: [],
    tsonic: { core: emptyCore(), role: "value", value: checkedValue(1),
      literal: { kind: "number", token: "1", value: exact } } };
  const typed = { ...header(2, 1), kind: "AwaitExpression", expression: operand,
    tsonic: { ...typedValue(), protocol: { kind: "decided", decision: { kind: "await",
      asynchronous: true, steps: [], value: 0, completion: 0, sent: null, thrown: 2 } } } };
  const checked = { ...header(2, 1), kind: "VoidExpression", expression: checkedOperand,
    tsonic: { core: emptyCore(), ...checkedValue() } };
  const fixture = expressionScenario(checked, typed, [checkedOperand], 4,
    [{ kind: "primitive", primitive: "int32" }, { kind: "intrinsic", intrinsic: "unknown" }]);
  fixture.body.asynchronous = true;
  fixture.input.source.bodies[0].asynchronous = true;
  assertCompleteValue(verifyBody(fixture.input, fixture.body), [
    nodeViolation("kind-children-shape", 1, "typed syntax does not retain the authored kind, fields and child presence"),
    nodeViolation("kind-children-shape", 2, "typed syntax does not retain the authored kind, fields and child presence"),
  ]);
  checked.kind = "AwaitExpression";
  checked.tsonic = { core: emptyCore(), ...checkedValue(),
    protocol: available({ kind: "await", subject: 3, completion: 0 }) };
  assertCompleteValue(verifyBody(fixture.input, fixture.body), []);
});

test("F4 a real spread protocol's saved input retains the actual nullable channels", () => {
  const fixture = argumentScenario("whole");
  const spread = fixture.call.arguments.nodes[0];
  const evidence = type => ({ type, component: { kind: "body", value: { body: bodyId, node: 5 } },
    category: { kind: "dynamic" }, numeric: null, sum: null, nominal: null, pointer: null });
  const context = { occurrence: { body: bodyId, node: 4 }, origin: origin(), bindings: emptyBindings() };
  const input = { context, kind: "spread", asynchronous: false, subject: evidence(5), operands: [],
    completion: evidence(0), yielded: null, sent: evidence(0), thrown: evidence(0) };
  spread.tsonic.protocol = { kind: "deferred", deferred: { invocation: { rule: "protocol", input }, result: 5 } };
  replaceScopeInventory(fixture.input, Array.from({ length: 5 }, emptyScope));
  assertCompleteValue(verifyBody(fixture.input, fixture.body), []);
  context.occurrence.node = 2;
  assertCompleteValue(verifyBody(fixture.input, fixture.body), [nodeViolation("deferred-parameters", 4,
    "saved invocation does not retain its occurrence and complete captured rigid-parameter support")]);
  context.occurrence.node = 4;
  assertCompleteValue(verifyBody(fixture.input, fixture.body), []);
});

test("F4 a genuine nonidentity refinement arm retains its explicit result endpoint", () => {
  const fixture = operationScenario();
  const component = { root: { kind: "body", value: { body: bodyId, node: 2 } }, path: [] };
  const narrowing = { kind: "narrowed", source: 1, result: 1,
    proof: { steps: [{ from: component, to: component, rule: "identity", premises: [] }], conclusion: 0 }, failure: "unwind" };
  fixture.typed.tsonic.narrowing = narrowing;
  assertCompleteValue(verifyBody(fixture.input, fixture.body), []);
  narrowing.result = 0;
  assertCompleteValue(verifyBody(fixture.input, fixture.body), [nodeViolation("refinement-destination", 2,
    "refinement does not retain its value endpoint")]);
  narrowing.result = 1;
  assertCompleteValue(verifyBody(fixture.input, fixture.body), []);
});

test("an unrefined non-null occurrence retains the same already-present typed operand", async () => {
  const { verifyOccurrenceOperation } = await import("../../packages/host/dist/ir-tir/verify-occurrences.js");
  const table = { terms: [
    { kind: "primitive", primitive: "bool" },
    { kind: "string" },
    { kind: "literal", value: { kind: "boolean", value: false }, base: 0 },
    { kind: "intrinsic", intrinsic: "absence" },
    { kind: "literal", value: { kind: "absence" }, base: 3 },
    { kind: "optional", value: 0 },
  ], signatures: [] };
  for (const [type, operand, expected] of [
    [0, 0, []], [1, 1, []], [2, 2, []], [0, 1, ["operation-type"]],
    [3, 3, ["operation-type"]], [4, 4, ["operation-type"]], [5, 5, ["operation-type"]], [6, 6, ["operation-type"]],
  ]) {
    const expression = { ...header(5, 4), kind: "Identifier", text: "value",
      tsonic: { ...typedValue(operand), role: "value", resolution: { kind: "definition", definition: ownerId, aliases: [] } } };
    for (const narrowing of [null, { kind: "identity", type }]) {
      const tsonic = { ...typedValue(type), narrowing, evidenceIndex: null };
      const findings = [];
      verifyOccurrenceOperation({ ...header(4, 2), kind: "NonNullExpression", expression, tsonic }, table, null,
        rule => findings.push(rule));
      assert.deepEqual(findings, expected, `type ${type}, operand ${operand}, refinement ${narrowing?.kind ?? "none"}`);
    }
  }
});

test("F4 an otherwise correct actual member table cannot replace its real receiver", () => {
  const fixture = memberScenario("property-access");
  fixture.table.receiver = 0;
  assertCompleteValue(verifyBody(fixture.input, fixture.body), [nodeViolation("member-origin", 2,
    "member inventory does not retain the actual receiver type")]);
  fixture.table.receiver = 1;
  assertCompleteValue(verifyBody(fixture.input, fixture.body), []);
});

test("fresh strict whole-owner isolation includes every current executable TIR module", async () => {
  const module = hostCatalogue.find(item => item.name === "ir-tir");
  const candidates = [...sourceFiles];
  for (const name of ["ids", "diag", "ir-types", "ir-hir", "ir-infer", "step"]) {
    for (const file of readdirSync(resolve(repository, `packages/host/src/${name}`)).filter(path => path.endsWith(".ts"))) {
      candidates.push(`packages/host/src/${name}/${file}`);
    }
  }
  const files = new Map(candidates.map(path => [path, readFileSync(resolve(repository, path), "utf8")]));
  const graph = readImportGraph(parseSources(files), files);
  const interfaceSources = [...new Set(graph.filter(edge => sourceFiles.includes(edge.source) && edge.target !== null &&
    !sourceFiles.includes(edge.target)).map(edge => edge.target))];
  const closure = new Set(interfaceSources);
  for (const path of closure) for (const edge of graph) {
    if (edge.source === path && edge.target !== null) closure.add(edge.target);
  }
  const report = await compileIsolated(isolationDeps(tooling, roots), module, { root: repository, sourceFiles,
    interfaceSources, declarationSources: [...closure].sort(), outputDirectory: ".temp/ir-tir-isolation" });
  writeFileSync(resolve(repository, ".temp/ir-tir-isolation-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  assert.equal(report.status, "passed", JSON.stringify(report.findings).slice(0, 5000));
  assert.equal(report.sourceInventory.filter(item => item.path.includes("/src/ir-tir/")).length, sourceFiles.length);
  assert.equal(report.provenance.length > 0, true, "real dependency declarations were freshly produced from their actual source closure");
  assert.equal(report.loadedInventory.every(path => report.expectedInventory.includes(path)), true);
});

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
    const raw = [{ ...capture, result, sources }];
    const report = checkCoverage({ canonical: realpathSync, readText: path => readFileSync(path, "utf8"), parse: parseSources,
      project: (url, text) => ({ path: fileURLToPath(url), text }) },
    [...runtimeFiles, resolve(repository, "packages/host/src/ir-tir/contract.ts")], raw);
    const directory = resolve(repository, ".temp/ir-tir-coverage");
    mkdirSync(directory, { recursive: true });
    writeFileSync(resolve(directory, "raw-v8.json"), `${JSON.stringify(raw)}\n`);
    writeFileSync(resolve(directory, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
    writeFileSync(resolve(directory, "source-inputs.json"), `${JSON.stringify(sourceFiles.map(path => ({ path,
      hash: createHash("sha256").update(readFileSync(resolve(repository, path))).digest("hex") })), null, 2)}\n`);
    assert.deepEqual(result.map(script => script.url).sort(), [...urls].sort(),
      "all current actual runtime owners need distinct source-identified raw V8 evidence");
    assert.equal(report.status, "passed", JSON.stringify(report.findings).slice(0, 6000));
    assert.equal(report.files.filter(file => file.status === "covered").length, productNames.length);
    assert.equal(report.files.filter(file => file.status === "not-applicable").length, 1);
    for (const file of report.files.filter(file => file.status === "covered")) {
      assert.equal(file.lines, 100, basename(file.path));
      assert.equal(file.branches, 100, basename(file.path));
      assert.equal(file.functions, 100, basename(file.path));
    }
  } finally { profiler.disconnect(); }
});
test("header binding verification reads only its actual owning checked and published parameter inventories", async () => {
  const { verifyBindingSlots } = await import("../../packages/host/dist/ir-tir/verify-instances.js");
  const { walkSyntaxTree } = await import("../../packages/host/dist/ir-hir/index.js");
  const fixture = genericFunctionScenario();
  const body = fixture.functionTemplate;
  const input = fixture.inputFor(body);
  const sources = new Map(input.source.bodies.map(source => [source.body, source]));
  for (const source of sources.values()) if (source !== fixture.originalFunction)
    Object.defineProperty(source, "params", { get: () => assert.fail("an unrelated checked formal inventory was read") });
  for (const published of input.module.bodies) if (published !== body)
    Object.defineProperty(published, "params", { get: () => assert.fail("an unrelated published header inventory was read") });
  const actual = fixture.originalFunction.params;
  let reads = 0;
  Object.defineProperty(fixture.originalFunction, "params", { get: () => { reads++; return actual; } });
  const findings = [];
  const emit = (rule, node, detail) => findings.push({ rule, node: node?.id ?? null, detail });
  const structure = structureOf(body);
  verifyBindingSlots(body, structure, fixture.functionNodes, sources, input.module.bodies, input.bodyOf, input.nodeOf, emit, admitFixtureRead());
  assert.deepEqual(findings, []);
  assert.equal(reads, 1, "the actual owning formal inventory is indexed once");
  sources.delete(body.body);
  verifyBindingSlots(body, structure, fixture.functionNodes, sources, input.module.bodies, input.bodyOf, input.nodeOf, emit, admitFixtureRead());
  assert.equal(findings.some(value => value.rule === "parameter-order"), true,
    "a missing owning inventory is not silently accepted");
});

test("nested header ownership reads only the exact parametric callable publication", async () => {
  const { verifyBindingSlots } = await import("../../packages/host/dist/ir-tir/verify-instances.js");
  const { walkSyntaxTree } = await import("../../packages/host/dist/ir-hir/index.js");
  for (const kind of ["FunctionExpression", "FunctionDeclaration"]) {
    const fixture = genericFunctionScenario();
    const body = fixture.outer;
    const nested = fixture.functionTemplate;
    const input = fixture.inputFor(body);
    const callable = kind === "FunctionExpression" ? nested.root
      : { ...nested.root, kind, tsonic: nested.root.tsonic.callable };
    body.root.statements.nodes[0] = kind === "FunctionDeclaration" ? { kind: "ready-callable", node: callable }
      : readyStatement({ ...body.root.statements.nodes[0].node, expression: callable });
    const structure = structureOf(body);
    const sources = new Map(input.source.bodies.map(source => [source.body, source]));
    const findings = [];
    const emit = (rule, node) => findings.push({ rule, node: node?.id ?? null });
    const queries = [];
    let publication = nested;
    const bodyOf = instance => { queries.push(instance); return publication; };
    const verify = () => verifyBindingSlots(body, structure, fixture.functionNodes, sources, input.module.bodies, bodyOf, input.nodeOf, emit, admitFixtureRead());
    verify();
    assert.deepEqual(findings, [], kind);
    assert.deepEqual(queries, [{ body: nested.body, bindings: { kind: "parametric" } }]);
    assert.deepEqual(checkTirAdmissionCuts(admitFixtureRead, (admit, read) =>
      verifyBindingSlots(body, structure, fixture.functionNodes, sources, input.module.bodies, instance => {
        read("bodyOf");
        return bodyOf(instance);
      }, input.nodeOf, emit, admit)), ["bodyOf"]);
    for (const wrong of [null, { ...nested, body: body.body }, { ...nested, owner: body.owner }, fixture.instances[0]]) {
      publication = wrong;
      findings.length = 0;
      verify();
      assert.equal(findings.some(value => value.rule === "parameter-order"), true,
        `${kind}: an absent, foreign or instantiated row cannot own this parametric header`);
      assert.equal(findings.some(value => value.rule === "binding-storage"), true,
        `${kind}: nested header names cannot borrow the enclosing callable's locals`);
    }
    const selected = kind === "FunctionExpression" ? callable.tsonic.callable : callable.tsonic;
    const template = selected.template;
    selected.template = null;
    queries.length = 0;
    verify();
    assert.equal(queries.length, 0, "a genuinely bodyless callable demands no publication");
    selected.template = { ...template, body: body.body };
    publication = nested;
    verify();
    assert.deepEqual(queries, [{ body: body.body, bindings: { kind: "parametric" } }],
      "a foreign occurrence cannot become the current root merely by claiming its body key");
  }
});

test("capture binding verification indexes each demanded owner's formal local relation once", async () => {
  const { verifyBindingSlots } = await import("../../packages/host/dist/ir-tir/verify-instances.js");
  const { encodeDefId } = await import("../../packages/host/dist/ids/index.js");
  for (const count of [8, 64, 256]) {
    const fixture = genericFunctionScenario();
    const body = fixture.functionTemplate;
    const input = fixture.inputFor(body);
    const outer = input.source.bodies.find(source => source.body === bodyId);
    let localReads = 0;
    let inventoryReads = 0;
    const formals = Array.from({ length: count }, (_, index) => ({
      get local() { localReads++; return index; }, declaration: encodeDefId({ module: moduleId,
        segments: [{ name: `formal${index}`, ordinal: 0 }] }), role: "required",
      passing: index % 2 === 0 ? "borrow-mut" : "by-value", initializer: null,
    }));
    outer.locals = Array.from({ length: count + 2 }, (_, index) => ({ id: index,
      declaration: { kind: "body", value: { body: bodyId, node: 0 } }, name: `p${index}`,
      role: index === count + 1 ? "capture" : "parameter", checkerSlot: available(0), capturedFrom: null, mutable: false }));
    Object.defineProperty(outer, "params", { get: () => { inventoryReads++; return formals; } });
    const captures = outer.locals.map(local => ({ body: bodyId, local: local.id }));
    fixture.checkedFunction.tsonic.captures = captures;
    const evidence = { type: 3, component: { kind: "body", value: { body: body.body, node: body.root.id } },
      category: { kind: "known", category: "number" }, numeric: null, sum: null, nominal: null, pointer: null };
    const saved = captures.map((local, index) => ({ local, value: evidence, reassignable: false,
      incoming: index < count ? { kind: "parameter", passing: formals[index].passing }
        : index === count ? { kind: "binding" } : { kind: "parameter", passing: "move" } }));
    const deferred = captures => ({ kind: "deferred", deferred: { result: 4, invocation: { rule: "closure", input: {
      context: { occurrence: { body: body.body, node: body.root.id }, origin: origin(), bindings: body.lexicalBindings },
      callable: { ...evidence, type: 4, category: { kind: "known", category: "callable" } }, captures } } } });
    body.root.tsonic.closure = deferred(saved);
    const findings = [];
    const emit = (rule, node) => findings.push({ rule, node: node?.id ?? null });
    const sources = new Map(input.source.bodies.map(source => [source.body, source]));
    const verify = () => verifyBindingSlots(body, structureOf(body), fixture.functionNodes, sources, input.module.bodies, input.bodyOf, input.nodeOf, emit, admitFixtureRead());
    verify();
    assert.deepEqual(findings, []);
    assert.equal(inventoryReads, 1, "all captured formals borrow the same actual demanded-owner inventory");
    assert.equal(localReads, count * 2, "one formal index read and one exact local match per captured formal");
    for (const index of [count - 1, count]) {
      findings.length = 0;
      body.root.tsonic.closure = deferred(saved.map((capture, position) => position === index
        ? { ...capture, incoming: position === count ? { kind: "parameter", passing: "by-value" } : { kind: "binding" } } : capture));
      verify();
      assert.equal(findings.some(finding => finding.rule === "closure-capture-binding"), true,
        "a pattern-bound child remains its own binding and a real formal retains its exact passing evidence");
    }
    findings.length = 0;
    body.root.tsonic.closure = deferred(saved.map((capture, index) => index === 0
      ? { ...capture, local: { ...capture.local, local: -0 }, incoming: { kind: "parameter", passing: "move" } } : capture));
    verify();
    assert.equal(findings.some(finding => finding.rule === "capture-qualified"), true);
    assert.equal(findings.some(finding => finding.rule === "closure-capture-binding"), false,
      "a nonidentical local index cannot borrow another formal's passing evidence");
  }
});

test("a parametric body reuses its exact canonical selected header rather than a detached equal copy", () => {
  const fixture = genericFunctionScenario();
  const body = fixture.functionTemplate;
  assertCompleteValue(verifyBody(fixture.inputFor(body), body), []);
  const canonical = body.params[0];
  body.params = [structuredClone(canonical)];
  assert.equal(verifyBody(fixture.inputFor(body), body).some(value => value.rule === "module-node-identity"), true);
  body.params = [canonical];
  assertCompleteValue(verifyBody(fixture.inputFor(body), body), []);
});

test("the removed scalar TirParam record is not a selected parameter occurrence", () => {
  const retired = `TirParam(local=l:0, declaration=def:"${ownerId}", role="required", passing="by-value", initializer=null, storage=t:0)`;
  const text = completeEmptyWire.replace("params=[]", `params=[${retired}]`);
  const offset = text.indexOf("TirParam(");
  assertCompleteValue(product.parseTir(text), { kind: "invalid-text", offset, line: 1, column: offset + 1,
    expected: ["$TirFormal"], found: "TirParam" });
});

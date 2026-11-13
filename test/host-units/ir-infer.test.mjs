import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import { basename, relative, resolve, sep } from "node:path";
import { Session } from "node:inspector";
import { fileURLToPath, pathToFileURL } from "node:url";
import test, { after, before } from "node:test";
import { hostCatalogue } from "../architecture/host/catalogue.mjs";
import { checkCoverage } from "../architecture/host/coverage.mjs";
import { parseSources } from "../architecture/host/import-graph.mjs";
import { compileIsolated, isolationDeps } from "../architecture/host/isolation.mjs";
import { runCase } from "../host-cases/case.mjs";
import { compareCaseValues } from "../host-cases/compare.mjs";

const repository = fileURLToPath(new URL("../../", import.meta.url));
const tooling = process.env.TSONIC_HOST_TOOLING_ROOT ?? repository;
const owner = "packages/host/src/ir-infer";
const emitted = resolve(repository, "packages/host/dist/ir-infer");
const runtimeNames = ["index", "print", "parse", "text-data", "text-decisions", "text-evidence", "text-capture-values", "text-pointers",
  "text-captures", "text-constraints", "text-contributions", "text-decision-values", "text-rule-inputs", "text-invocations", "text-operations",
  "verify", "verify-contributions", "verify-solution"];
const runtimeFiles = runtimeNames.map(name => resolve(emitted, `${name}.js`));
const ownedSources = ["contract", ...runtimeNames].map(name => `${owner}/${name}.ts`).sort();
const dependencies = ["ids", "diag", "ir-types", "ir-hir"];
const coverageSession = new Session();
const packageIdentity = "P[project]";
const moduleIdentity = `M[${packageIdentity};source.ts]`;
const definition = `D[${moduleIdentity};run]`;
const body = `B[${definition};function;0]`;
const group = `G[${body}]`;
const occurrence = { body, node: 0 };
const source = { kind: "body", value: occurrence };
const emptyBindings = { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] };
let product;
let evidenceDirectory;
let comparisonFailureCount = 0;

const post = (method, parameters = {}) => new Promise((done, reject) => {
  coverageSession.post(method, parameters, (error, value) => error === null ? done(value) : reject(error));
});

before(async () => {
  assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined && process.env.TSONIC_TEST_ADMISSION_OWNER !== undefined,
    true, "all owner tests and compiler children require the admitted aggregate process-group guard");
  mkdirSync(resolve(repository, ".temp/host-f-ir-infer"), { recursive: true });
  evidenceDirectory = mkdtempSync(resolve(repository, ".temp/host-f-ir-infer/proof-"));
  coverageSession.connect();
  await post("Debugger.enable");
  await post("Profiler.enable");
  await post("Profiler.startPreciseCoverage", { callCount: true, detailed: true });
  product = await import(pathToFileURL(resolve(emitted, "index.js")).href);
});

after(async () => {
  try {
    const captured = await post("Profiler.takePreciseCoverage");
    const urls = new Set(runtimeFiles.map(path => pathToFileURL(path).href));
    const result = captured.result.filter(script => urls.has(script.url));
    const sources = [];
    for (const script of result) {
      const response = await post("Debugger.getScriptSource", { scriptId: script.scriptId });
      sources.push({ scriptId: script.scriptId, url: script.url, text: response.scriptSource });
    }
    await post("Profiler.stopPreciseCoverage");
    const report = checkCoverage({ canonical: realpathSync, readText: path => readFileSync(path, "utf8"), parse: parseSources,
      project: (url, text) => url.startsWith("file:") ? { path: fileURLToPath(url), text } : null,
    }, runtimeFiles, [{ result, sources }]);
    const inputs = [...ownedSources.map(path => resolve(repository, path)), ...runtimeFiles].map(path => ({
      path, sha256: createHash("sha256").update(readFileSync(path)).digest("hex"),
    }));
    writeFileSync(resolve(evidenceDirectory, "coverage.json"), `${JSON.stringify(report, null, 2)}\n`);
    writeFileSync(resolve(evidenceDirectory, "source-inputs.json"), `${JSON.stringify(inputs, null, 2)}\n`);
    console.log(`F.ir-infer actual product coverage: ${evidenceDirectory}`);
    assert.equal(result.length, 18, "all eighteen actual runtime owners have nonempty source-identified raw V8 evidence");
    assert.equal(report.status, "passed", JSON.stringify(report.findings));
    deepEqual(report.findings, []);
    assert.equal(report.files.length, 18);
    for (const file of report.files) {
      assert.equal(file.status, "covered", file.path);
      assert.equal(file.lines, 100, file.path);
      assert.equal(file.branches, 100, file.path);
      assert.equal(file.functions, 100, file.path);
    }
  } finally { coverageSession.disconnect(); }
});

function evidence(type = 0) {
  return { type, component: source, category: { kind: "known", category: "number" }, numeric: null,
    sum: null, nominal: null, pointer: null };
}

function constraintSet(constraints = [], variables = []) {
  return { group, body, variables, candidates: [], evidence: [], constraints };
}

const emptyScope = { classParameters: [], methodParameters: [], capturedParameters: [], selfOwners: [] };
const signature = { id: 0, declaration: definition, owner: source, composition: null, kind: "call",
  typeParameters: [], receiver: null, parameters: [], result: 0 };
const bodyTyping = { body, signature: 0, completion: 0, yielded: null, sent: null };
const declarationFacts = { scope: emptyScope, parameterCount: 0, endpoints: [
  { declaration: definition, role: "advertised", signature: 0, body: null },
  { declaration: definition, role: "api-body", signature: 0, body },
  { declaration: definition, role: "api-signature", signature: 0, body: null },
] };

function verificationInput(records = {}) {
  const { declarations = [[definition, declarationFacts]], nominals = [],
    nodes = [{ owner: source, ids: [0] }, { owner: { kind: "item", value: { owner: definition, node: 0 } }, ids: [0] }],
    locals = [{ body, ids: [0] }], ...input } = records;
  const declarationMap = new Map(declarations);
  const nominalMap = new Map(nominals);
  const nodeMap = new Map(nodes.map(row => [row.owner.kind === "body" ? `body:${row.owner.value.body}` : `item:${row.owner.value.owner}`, new Set(row.ids)]));
  const localMap = new Map(locals.map(row => [row.body, new Set(row.ids)]));
  return { group: { id: group, bodies: [body], signatures: [] }, constraints: [constraintSet()], contributions: [], solution: null,
    types: { terms: [{ kind: "primitive", primitive: "int32" }], signatures: [signature] }, bindingScopes: [], ...input,
    declarationOf: value => declarationMap.get(value) ?? null, nominalOf: value => nominalMap.get(value) ?? null,
    nodeExists: value => !Object.is(value.value.node, -0) &&
      nodeMap.get(value.kind === "body" ? `body:${value.value.body}` : `item:${value.value.owner}`)?.has(value.value.node) === true,
    localExists: value => !Object.is(value.local, -0) && localMap.get(value.body)?.has(value.local) === true };
}

function violation(rule, site, field) {
  return { rule, site, detail: [{ kind: "text", value: field }] };
}

const groupSite = { kind: "group", group };
const bodySite = { kind: "body", body };
const variableSite = variable => ({ kind: "variable", group, variable });
const constraintSite = index => ({ kind: "constraint", constraint: { body, index } });
const localVariable = id => ({ kind: "local", id, occurrence, local: null });
const completeSolution = () => ({ group, variables: [], constraints: [], checks: [], bodies: [bodyTyping] });
const checkedRules = new Set();
const exercisedPorts = new Set();
const inputArms = { constraints: new Set(), variables: new Set(), contributions: new Set() };
const resultArms = { decisions: new Set(), operations: new Set(), deferred: new Set(), public: new Set() };
const nestedArms = { stringOperators: new Set(), booleanOperators: new Set(), nativeOperators: new Set(), bigintOperators: new Set(),
  nativeCarriers: new Set(), memberKeys: new Set(), knownCategories: new Set() };

function ruleCase(rule, valid, invalid, expected, label = rule) {
  fullEqual(product.verifyInference(verificationInput(valid)), [], `${label}: independently complete valid opposite`);
  fullEqual(product.verifyInference(verificationInput(invalid)), expected, `${label}: complete minimal invalid vector`);
  checkedRules.add(rule);
  exercisedPorts.add("verifyInference");
  resultArms.public.add("verifyInference:empty"); resultArms.public.add("verifyInference:nonempty");
}

test("group ownership, stable variable namespaces and final record totality have complete minimal opposites", () => {
  ruleCase("group-order", {}, { group: { id: group, bodies: [], signatures: [] }, constraints: [] },
    [violation("group-order", groupSite, "bodies")]);
  ruleCase("group-ownership", {}, { constraints: [] }, [violation("group-ownership", groupSite, "bodies")]);
  const part = { definition, part: { kind: "parameter-initializer", index: 0 } };
  const parameterDeclaration = `D[${moduleIdentity};run/argument]`;
  const partInput = { group: { id: group, bodies: [body], signatures: [part] },
    declarations: [[definition, { ...declarationFacts, parameterCount: 1 }]],
    types: { terms: [{ kind: "primitive", primitive: "int32" }], signatures: [{ ...signature, parameters: [
      { declaration: parameterDeclaration, kind: "default", type: 0, passing: "by-value", initializer: `B[${parameterDeclaration};default-argument;0]` },
    ] }] } };
  ruleCase("inferred-part-identity", partInput, { ...partInput, group: { ...partInput.group,
    signatures: [{ ...part, part: { kind: "parameter-initializer", index: 1 } }] } },
  [violation("inferred-part-identity", groupSite, "declaration")]);
  ruleCase("variable-id-dense", { constraints: [constraintSet([], [localVariable(0)])] },
    { constraints: [constraintSet([], [localVariable(1)])] }, [violation("variable-id-dense", variableSite(0), "id")]);
  ruleCase("variable-order", { constraints: [constraintSet([], [localVariable(0), localVariable(1)])] },
    { constraints: [constraintSet([], [localVariable(1), localVariable(0)])] },
    [violation("variable-order", variableSite(0), "variables"), violation("variable-order", variableSite(0), "groupVariables")]);
  const variable = localVariable(0);
  const final = { variable: 0, value: evidence() };
  const completed = { ...completeSolution(), variables: [final] };
  ruleCase("one-publication-per-variable", { constraints: [constraintSet([], [variable])], solution: completed },
    { constraints: [constraintSet([], [variable])], solution: { ...completed, variables: [final, final] } },
    [violation("one-publication-per-variable", variableSite(0), "variables"), violation("solution-order", variableSite(0), "variables")]);
  ruleCase("solution-total", { constraints: [constraintSet([], [variable])], solution: completed },
    { constraints: [constraintSet([], [variable])], solution: completeSolution() }, [violation("solution-total", variableSite(0), "variables")]);
  ruleCase("solution-order", { constraints: [constraintSet([], [localVariable(0), localVariable(1)])],
    solution: { ...completeSolution(), variables: [final, { variable: 1, value: evidence() }] } },
  { constraints: [constraintSet([], [localVariable(0), localVariable(1)])],
    solution: { ...completeSolution(), variables: [{ variable: 1, value: evidence() }, final] } },
  [violation("solution-order", variableSite(0), "variables")]);
});

test("duplicate inventories and each stable group ordering retain their complete positional findings", () => {
  const equality = { kind: "eq", occurrence, left: 0, right: 0 };
  const candidate = { ordinal: 0, declaration: definition, appliedSignature: { kind: "available", value: 0 },
    bindings: { kind: "unavailable", reason: "not-provided" }, conditionalFailure: { kind: "available", value: null }, contributions: [] };
  const set = { ...constraintSet([equality], [localVariable(0)]), candidates: [{ id: 0, candidates: [candidate] }] };
  ruleCase("group-ownership", { constraints: [set] }, { constraints: [set, set] }, [
    violation("group-ownership", bodySite, "constraints"),
    violation("variable-id-dense", variableSite(0), "id"),
    violation("variable-id-dense", variableSite(1), "id"),
    violation("variable-order", variableSite(0), "groupVariables"),
  ], "duplicate occurrences retain first inventory ownership without hiding duplicate records");
  const otherDefinition = `D[${moduleIdentity};z]`;
  const otherBody = `B[${otherDefinition};function;0]`;
  const otherGroup = `G[${otherBody}]`;
  ruleCase("group-order", {}, { group: { id: otherGroup, bodies: [body], signatures: [] },
    constraints: [{ ...constraintSet(), group: otherGroup }] },
  [violation("group-order", { kind: "group", group: otherGroup }, "id")], "identity is the actual minimum body, not a supplied label");
  const paired = { group: { id: group, bodies: [body, otherBody], signatures: [] },
    constraints: [constraintSet(), { ...constraintSet(), body: otherBody }] };
  ruleCase("group-order", paired, { ...paired, group: { ...paired.group, bodies: [otherBody, body] } },
    [violation("group-order", groupSite, "bodies")], "body order is independent of the minimum-member identity");
  ruleCase("group-order", {}, { group: { id: group, bodies: [body, body], signatures: [] } },
    [violation("group-order", groupSite, "bodies")], "repeated group bodies are not deduplicated into success");
  const returned = { definition, part: { kind: "return" } };
  const yielded = { definition, part: { kind: "yield" } };
  for (const parts of [[returned, returned], [yielded, returned]]) {
    ruleCase("inferred-part-identity", { group: { id: group, bodies: [body], signatures: [returned, yielded] } },
      { group: { id: group, bodies: [body], signatures: parts } },
      [violation("inferred-part-identity", groupSite, "signatures")], "duplicate and reversed part identities remain separate invalid inputs");
  }
  const literal = { kind: "literal", id: 1, occurrence, value: { kind: "absence" } };
  ruleCase("variable-order", { constraints: [constraintSet([], [localVariable(0), literal])] },
    { constraints: [constraintSet([], [{ ...literal, id: 0 }, localVariable(1)])] },
    [violation("variable-order", variableSite(1), "variables")], "kind order within one authored occurrence");
  const nodeOrdered = { constraints: [constraintSet([], [localVariable(0), { ...localVariable(1), occurrence: { body, node: 1 } }])],
    nodes: [{ owner: source, ids: [0, 1] }] };
  ruleCase("variable-order", nodeOrdered, { ...nodeOrdered, constraints: [constraintSet([], [
    { ...localVariable(0), occurrence: { body, node: 1 } }, localVariable(1),
  ])] }, [violation("variable-order", variableSite(1), "variables")], "node order is independent of dense variable IDs");
  ruleCase("variable-id-dense", { constraints: [constraintSet([], [localVariable(0)])] },
    { constraints: [constraintSet([], [localVariable(-0)])] },
    [violation("variable-id-dense", variableSite(-0), "id")], "negative zero is not a valid variable publication identity");
  const unused = { ...constraintSet(), candidates: [{ id: 0, candidates: [candidate] }] };
  for (const [candidates, field] of [
    [[{ id: 0, candidates: [{ ...candidate, ordinal: -0 }] }], "ordinal"],
    [[{ id: -0, candidates: [candidate] }], "candidates"],
    [[unused.candidates[0], unused.candidates[0]], "candidates"],
  ]) ruleCase("candidate-order", { constraints: [unused] }, { constraints: [{ ...unused, candidates }] },
    [violation("candidate-order", bodySite, field)], "unused candidate inventories still retain their own order and numeric domain");
  const foreignOccurrence = { body: otherBody, node: 0 };
  const foreignNodes = [{ owner: source, ids: [0] }, { owner: { kind: "body", value: foreignOccurrence }, ids: [0] }];
  ruleCase("group-ownership", { constraints: [constraintSet([equality])], nodes: foreignNodes },
    { constraints: [constraintSet([{ ...equality, occurrence: foreignOccurrence }])], nodes: foreignNodes },
    [violation("group-ownership", constraintSite(0), "occurrence")], "an existing foreign node is not owned by this constraint set");
  ruleCase("group-ownership", { constraints: [constraintSet([], [localVariable(0)])], nodes: foreignNodes },
    { constraints: [constraintSet([], [{ ...localVariable(0), occurrence: foreignOccurrence }])], nodes: foreignNodes },
    [violation("group-ownership", variableSite(0), "occurrence")], "an existing foreign variable node retains its actual owner");
});

test("constraint, candidate and contribution references are qualified complete records", () => {
  const equality = { kind: "eq", occurrence, left: 0, right: 0 };
  const key = { node: occurrence, candidate: null, role: { kind: "equality", direction: "left-to-right" } };
  const contribution = { key, reads: [], bounds: [], constraint: { body, index: 0 } };
  const original = { constraints: [constraintSet([equality])], contributions: [contribution] };
  ruleCase("constraint-reference", original, { ...original, contributions: [{ ...contribution, constraint: { body, index: 1 } }] },
    [violation("constraint-reference", { kind: "contribution", key }, "constraint")]);
  ruleCase("contribution-key-unique", original, { ...original, contributions: [contribution, contribution] },
    [violation("contribution-key-unique", { kind: "contribution", key }, "key"), violation("contribution-order", { kind: "contribution", key }, "key")]);
  const secondKey = { ...key, role: { kind: "equality", direction: "right-to-left" } };
  const second = { ...contribution, key: secondKey };
  ruleCase("contribution-order", { ...original, contributions: [contribution, second] },
    { ...original, contributions: [second, contribution] }, [violation("contribution-order", { kind: "contribution", key }, "key")]);
  const wrongKey = { ...key, role: { kind: "flow" } };
  ruleCase("contribution-role", original, { ...original, contributions: [{ ...contribution, key: wrongKey }] },
    [violation("contribution-role", { kind: "contribution", key: wrongKey }, "role")]);
  ruleCase("contribution-reads-bounds-declared", original, { ...original, contributions: [{ ...contribution, reads: [0] }] },
    [violation("contribution-reads-bounds-declared", { kind: "contribution", key }, "reads")]);
  const candidate = { ordinal: 0, declaration: definition, appliedSignature: { kind: "available", value: 0 },
    bindings: { kind: "unavailable", reason: "not-provided" }, conditionalFailure: { kind: "available", value: null }, contributions: [] };
  const application = { captured: captureGolden.value, permissionScope: null, callee: 0, receiver: null, typeArguments: [], arguments: [], candidates: 0, result: 0 };
  const set = { ...constraintSet([{ kind: "call", occurrence, application }]), candidates: [{ id: 0, candidates: [candidate] }] };
  ruleCase("candidate-reference", { constraints: [set] }, { constraints: [{ ...set, candidates: [] }] },
    [violation("candidate-reference", constraintSite(0), "candidates")]);
  ruleCase("candidate-order", { constraints: [set] }, { constraints: [{ ...set, candidates: [{ id: 0, candidates: [{ ...candidate, ordinal: -1 }] }] }] },
    [violation("candidate-order", bodySite, "ordinal")]);
});

test("candidate inventories retain HIR original ordinals instead of dense list positions", () => {
  const candidate = { declaration: definition, appliedSignature: { kind: "available", value: 0 },
    bindings: { kind: "unavailable", reason: "not-provided" }, conditionalFailure: { kind: "available", value: null }, contributions: [] };
  const input = ordinals => verificationInput({ constraints: [{ ...constraintSet(),
    candidates: [{ id: 0, candidates: ordinals.map(ordinal => ({ ...candidate, ordinal })) }] }] });
  for (const ordinals of [[1], [2, 4], [0, 3, 6, 9]])
    fullEqual(product.verifyInference(input(ordinals)), [], `original candidate ordinals ${ordinals.join(",")}`);
  for (const ordinals of [[-1], [-0], [0.5], [NaN], [Infinity], [-Infinity], [2, 2], [4, 2]])
    fullEqual(product.verifyInference(input(ordinals)), [violation("candidate-order", bodySite, "ordinal")],
      `invalid original candidate ordinals ${ordinals.map(value => Object.is(value, -0) ? "-0" : String(value)).join(",")}`);
});

test("open terms are resolved and owned transitively but never published as final solution types", () => {
  const equality = { kind: "eq", occurrence, left: 1, right: 0 };
  const closed = { terms: [{ kind: "primitive", primitive: "int32" }, { kind: "string" }], signatures: [signature] };
  const variable = localVariable(0);
  ruleCase("open-term-resolves", { constraints: [constraintSet([equality], [variable])], types: closed },
    { constraints: [constraintSet([equality], [variable])], types: { ...closed, terms: [closed.terms[0], { kind: "open", group, variable: 1 }] } },
    [violation("open-term-resolves", constraintSite(0), "types")]);
  const foreignBody = `B[${definition};function;1]`;
  const foreignGroup = `G[${foreignBody}]`;
  ruleCase("open-term-owner", { constraints: [constraintSet([equality], [variable])], types: closed },
    { constraints: [constraintSet([equality], [variable])], types: { ...closed, terms: [closed.terms[0], { kind: "open", group: foreignGroup, variable: 0 }] } },
    [violation("open-term-owner", constraintSite(0), "types")]);
  const completed = { ...completeSolution(), variables: [{ variable: 0, value: evidence(1) }] };
  ruleCase("no-open-in-solution", { constraints: [constraintSet([], [variable])], types: closed, solution: completed },
    { constraints: [constraintSet([], [variable])], types: { ...closed, terms: [closed.terms[0], { kind: "open", group, variable: 0 }] }, solution: completed },
    [violation("no-open-in-solution", variableSite(0), "types")]);
  ruleCase("qualified-reference", { constraints: [constraintSet([{ ...equality, left: 0 }])] },
    { constraints: [constraintSet([{ ...equality, left: 0, occurrence: { body, node: 1 } }])] },
    [violation("qualified-reference", constraintSite(0), "nodes")]);
});

test("ordinary peer arena holes retain missing rows through the one canonical verdict", () => {
  const primitive = { kind: "primitive", primitive: "int32" };
  const missingType = violation("qualified-reference", groupSite, "type-reference");
  const missingSignature = violation("qualified-reference", groupSite, "signature-reference");
  const missingRoot = violation("qualified-reference", constraintSite(0), "types");
  const equality = { kind: "eq", occurrence, left: 0, right: 0 };
  const check = (types, expected, constraints = [constraintSet()]) =>
    fullEqual(product.verifyInference(verificationInput({ types, constraints })), expected,
      "complete ordinary arena/reference vector, including the canonical missing-row result");
  check({ terms: [], signatures: [] }, []);
  check({ terms: new Array(1), signatures: [] }, [missingType]);
  check({ terms: [], signatures: new Array(1) }, [missingSignature]);
  check({ terms: new Array(1), signatures: new Array(1) }, [missingType, missingSignature]);
  check({ terms: [primitive], signatures: [] }, [], [constraintSet([equality])]);
  check({ terms: new Array(1), signatures: [] }, [missingRoot, missingType], [constraintSet([equality])]);
  const missingLaterType = new Array(2);
  missingLaterType[0] = primitive;
  check({ terms: [primitive, { kind: "string" }], signatures: [] }, [], [constraintSet([{ ...equality, left: 1 }])]);
  check({ terms: missingLaterType, signatures: [] }, [missingRoot, missingType],
    [constraintSet([{ ...equality, left: 1 }])]);
  const presentAfterTypeHole = new Array(2);
  presentAfterTypeHole[1] = { kind: "string" };
  check({ terms: [primitive, { kind: "string" }], signatures: [] }, [], [constraintSet([{ ...equality, left: 1, right: 1 }])]);
  check({ terms: presentAfterTypeHole, signatures: [] }, [missingType], [constraintSet([{ ...equality, left: 1, right: 1 }])]);
  const array = { kind: "array", element: 0, readonly: false };
  const indirectType = new Array(2);
  indirectType[1] = array;
  check({ terms: [primitive, array], signatures: [] }, [], [constraintSet([{ ...equality, left: 1, right: 1 }])]);
  check({ terms: indirectType, signatures: [] }, [missingRoot, missingType], [constraintSet([{ ...equality, left: 1, right: 1 }])]);
  const candidate = { ordinal: 0, declaration: definition, appliedSignature: { kind: "available", value: 0 },
    bindings: { kind: "unavailable", reason: "not-provided" }, conditionalFailure: { kind: "available", value: null }, contributions: [] };
  const candidateSet = { ...constraintSet(), candidates: [{ id: 0, candidates: [candidate] }] };
  check({ terms: [primitive], signatures: [signature] }, [], [candidateSet]);
  check({ terms: [primitive], signatures: new Array(1) },
    [violation("qualified-reference", bodySite, "types"), missingSignature], [candidateSet]);
  const presentAfterSignatureHole = new Array(2);
  presentAfterSignatureHole[1] = { ...signature, id: 1 };
  const secondCandidateSet = { ...candidateSet, candidates: [{ id: 0,
    candidates: [{ ...candidate, appliedSignature: { kind: "available", value: 1 } }] }] };
  check({ terms: [primitive], signatures: [signature, { ...signature, id: 1 }] }, [], [secondCandidateSet]);
  check({ terms: [primitive], signatures: presentAfterSignatureHole }, [missingSignature], [secondCandidateSet]);
  const callable = { kind: "callable", calls: [0], constructs: [] };
  check({ terms: [primitive, callable], signatures: [signature] }, [], [constraintSet([{ ...equality, left: 1 }])]);
  check({ terms: [primitive, callable], signatures: new Array(1) }, [missingRoot, missingSignature],
    [constraintSet([{ ...equality, left: 1 }])]);
  const missingLaterSignature = new Array(2);
  missingLaterSignature[0] = signature;
  check({ terms: [primitive, { ...callable, calls: [1] }], signatures: [signature, { ...signature, id: 1 }] }, [],
    [constraintSet([{ ...equality, left: 1 }])]);
  check({ terms: [primitive, { ...callable, calls: [1] }], signatures: missingLaterSignature }, [missingRoot, missingSignature],
    [constraintSet([{ ...equality, left: 1 }])]);
  const bothTerms = new Array(2);
  const bothSignatures = new Array(2);
  const secondCallable = { ...callable, calls: [1] };
  const secondSignature = { ...signature, id: 1 };
  bothTerms[1] = secondCallable;
  bothSignatures[1] = secondSignature;
  check({ terms: [primitive, secondCallable], signatures: [signature, secondSignature] }, [],
    [constraintSet([{ ...equality, left: 1, right: 1 }])]);
  check({ terms: bothTerms, signatures: bothSignatures }, [missingRoot, missingType, missingSignature],
    [constraintSet([{ ...equality, left: 1, right: 1 }])]);
  check({ terms: new Array(1), signatures: new Array(1) }, [missingRoot,
    violation("qualified-reference", constraintSite(0), "nodes"), missingType, missingSignature],
    [constraintSet([{ ...equality, occurrence: { body, node: 1 } }])]);
  const openHole = new Array(4);
  openHole[0] = primitive;
  openHole[1] = { kind: "open", group, variable: 0 };
  openHole[3] = { kind: "union", members: [1, 2] };
  const key = { node: occurrence, candidate: null, role: { kind: "equality", direction: "left-to-right" } };
  const constraints = [constraintSet([{ ...equality, left: 3 }], [localVariable(0)])];
  for (const [bounds, expected] of [
    [[0], [missingRoot, missingType]],
    [[], [violation("contribution-footprint-complete", { kind: "contribution", key }, "bounds"), missingRoot, missingType]],
  ]) fullEqual(product.verifyInference(verificationInput({ types: { terms: openHole, signatures: [] }, constraints,
    contributions: [{ key, reads: [], bounds, constraint: { body, index: 0 } }] })), expected,
  "a missing peer row never throws away the independent footprint or canonical verdict");
});

test("open variable references keep their numeric domain through actual type and signature closure", () => {
  const primitive = { kind: "primitive", primitive: "int32" };
  const variable = localVariable(0);
  const equality = root => ({ kind: "eq", occurrence, left: root, right: 0 });
  const candidate = { ordinal: 0, declaration: definition, appliedSignature: { kind: "available", value: 0 },
    bindings: { kind: "unavailable", reason: "not-provided" }, conditionalFailure: { kind: "available", value: null }, contributions: [] };
  const rows = value => {
    const open = { kind: "open", group, variable: value };
    const terms = [primitive, open];
    const callable = { kind: "callable", calls: [0], constructs: [] };
    return [
      { label: "direct type", types: { terms, signatures: [] }, constraints: [constraintSet([equality(1)], [variable])], site: constraintSite(0) },
      { label: "array edge", types: { terms: [...terms, { kind: "array", element: 1, readonly: false }], signatures: [] },
        constraints: [constraintSet([equality(2)], [variable])], site: constraintSite(0) },
      { label: "signature result", types: { terms: [...terms, callable], signatures: [{ ...signature, result: 1 }] },
        constraints: [constraintSet([equality(2)], [variable])], site: constraintSite(0) },
      { label: "signature composition", types: { terms: [...terms, { ...callable, calls: [1] }],
        signatures: [{ ...signature, result: 1 }, { ...signature, id: 1, declaration: null, owner: null,
          composition: { kind: "union", signatures: [0] } }] },
        constraints: [constraintSet([equality(2)], [variable])], site: constraintSite(0) },
      { label: "direct signature", types: { terms, signatures: [{ ...signature, result: 1 }] },
        constraints: [{ ...constraintSet([], [variable]), candidates: [{ id: 0, candidates: [candidate] }] }], site: bodySite },
    ];
  };
  for (const input of rows(0))
    fullEqual(product.verifyInference(verificationInput({ types: input.types, constraints: input.constraints })), [],
      `${input.label}: declared positive zero resolves without publication`);
  for (const value of [-0, -1, 0.5, NaN, Infinity, -Infinity, 9007199254740992, 1]) {
    for (const { label, site, ...input } of rows(value)) {
      if (Object.is(value, -0)) assert.equal(Object.is(input.types.terms[1].variable, -0), true, "actual negative-zero input is retained");
      fullEqual(product.verifyInference(verificationInput(input)), [violation("open-term-resolves", site, "types")],
        `${label}: complete bad open-variable verdict for ${Object.is(value, -0) ? "-0" : String(value)}`);
      if (Object.is(value, -0)) assert.equal(Object.is(input.types.terms[1].variable, -0), true, "verification never normalizes the input reference");
    }
  }
  const foreignGroup = `G[B[${definition};function;1]]`;
  for (const value of [0, -0]) {
    const input = rows(value)[2];
    const terms = [primitive, { kind: "open", group: foreignGroup, variable: value }, input.types.terms[2]];
    fullEqual(product.verifyInference(verificationInput({ constraints: input.constraints, types: { ...input.types, terms } })),
      [...Object.is(value, -0) ? [violation("open-term-resolves", constraintSite(0), "types")] : [],
        violation("open-term-owner", constraintSite(0), "types")],
      "bad ordinal and genuine foreign ownership remain independent transitive failures");
  }
});

test("all actual declaration occurrences use the same genuine reference reader even before selection", () => {
  const missing = `D[${moduleIdentity};absent]`;
  const candidate = { ordinal: 0, declaration: definition, appliedSignature: { kind: "available", value: 0 },
    bindings: { kind: "unavailable", reason: "not-provided" }, conditionalFailure: { kind: "available", value: null }, contributions: [] };
  const set = { ...constraintSet(), candidates: [{ id: 0, candidates: [candidate] }] };
  ruleCase("qualified-reference", { constraints: [set] }, { constraints: [{ ...set,
    candidates: [{ id: 0, candidates: [{ ...candidate, declaration: missing }] }] }] },
  [violation("qualified-reference", bodySite, "declarations")], "unused original candidate declaration still exists");
  const member = { kind: "member", occurrence, receiver: 0, key: { kind: "text", value: "member" },
    access: "read", result: 0, origins: [{ kind: "declared", declaration: definition }], bindings: emptyBindings };
  ruleCase("qualified-reference", { constraints: [constraintSet([member])], bindingScopes: [emptyScope] },
    { constraints: [constraintSet([{ ...member, origins: [{ kind: "declared", declaration: missing }] }])], bindingScopes: [emptyScope] },
    [violation("qualified-reference", constraintSite(0), "declarations")], "member origin is actual declaration data, not an inferred name");
});

test("qualified item, local and signature occurrences use their actual reader and numeric domains", () => {
  const item = { kind: "item", value: { owner: definition, node: 0 } };
  const valid = { constraints: [{ ...constraintSet(), evidence: [{ ...evidence(), component: item }] }] };
  for (const node of [-0, 1]) ruleCase("qualified-reference", valid,
    { constraints: [{ ...constraintSet(), evidence: [{ ...evidence(), component: { ...item, value: { owner: definition, node } } }] }] }, [
      violation("qualified-reference", bodySite, "nodes"),
      violation("qualified-reference", bodySite, "cross-owner-qualified"),
    ], "item references retain both their owning occurrence and canonical evidence reader result");
  const variable = { ...localVariable(0), local: { body, local: 0 } };
  for (const local of [-0, 1]) ruleCase("qualified-reference", { constraints: [constraintSet([], [variable])] },
    { constraints: [constraintSet([], [{ ...variable, local: { body, local } }])] },
    [violation("qualified-reference", variableSite(0), "locals")], "a present local arena is distinct from a missing or invalid local slot");
  ruleCase("body-completion-endpoints", { solution: completeSolution() },
    { solution: { ...completeSolution(), bodies: [{ ...bodyTyping, signature: -0 }] } }, [
      violation("body-completion-endpoints", bodySite, "signature"), violation("qualified-reference", bodySite, "types"),
    ], "signature negative zero is retained until the actual endpoint/reference verifier");
});

test("the seven final-record footprint kinds require bounds independently of declared reads", () => {
  const types = { terms: [{ kind: "primitive", primitive: "int32" }, { kind: "open", group, variable: 0 },
    { kind: "open", group, variable: 1 }, { kind: "array", element: 1, readonly: false },
    { kind: "callable", calls: [1], constructs: [] }],
  signatures: [signature, { ...signature, id: 1, declaration: null, owner: null, receiver: 3, result: 2 }] };
  const variables = [localVariable(0), localVariable(1)];
  const rows = [
    [{ kind: "eq", occurrence, left: 3, right: 4 }, { kind: "equality", direction: "left-to-right" }, [0, 1]],
    [{ kind: "eq", occurrence, left: 4, right: 3 }, { kind: "equality", direction: "right-to-left" }, [0, 1]],
    [{ kind: "flow", occurrence, from: 1, to: 2, role: "assignment", bindings: emptyBindings }, { kind: "flow" }, [0, 1]],
    [{ kind: "literal", occurrence, value: { kind: "string", value: "value" }, destination: 3 }, { kind: "literal" }, [0]],
    [{ kind: "op", occurrence, operator: "+", operands: [3, 0], result: 2, permissionScope: null }, { kind: "operator" }, [0, 1]],
    [{ kind: "default", occurrence, variable: 1, rule: "local-producers", type: 3 }, { kind: "default" }, [0, 1]],
    [{ kind: "refine", occurrence, source: 3, checked: 0, result: 2 }, { kind: "refinement" }, [0, 1]],
  ];
  for (const [constraint, role, bounds] of rows) {
    const key = { node: occurrence, candidate: null, role };
    const contribution = { key, reads: [], bounds, constraint: { body, index: 0 } };
    const input = { constraints: [constraintSet([constraint], variables)], contributions: [contribution], types,
      bindingScopes: constraint.kind === "flow" ? [emptyScope] : [] };
    ruleCase("contribution-footprint-complete", input, { ...input, contributions: [{ ...contribution,
      reads: [bounds.at(-1)], bounds: bounds.slice(0, -1) }] },
    [violation("contribution-footprint-complete", { kind: "contribution", key }, "bounds")], `${constraint.kind} declared-type footprint`);
  }
  const flow = { kind: "flow", occurrence, from: 3, to: 4, role: "initialization", bindings: emptyBindings };
  const discharge = { kind: "discharge", occurrence, checkerDiagnostic: 0, obligations: [{ body, index: 1 }, { body, index: 0 }] };
  const key = { node: occurrence, candidate: null, role: { kind: "discharge" } };
  const contribution = { key, reads: [], bounds: [0, 1], constraint: { body, index: 1 } };
  const input = { constraints: [constraintSet([flow, discharge], variables)], contributions: [contribution], types, bindingScopes: [emptyScope] };
  ruleCase("contribution-footprint-complete", input, { ...input,
    contributions: [{ ...contribution, reads: [1], bounds: [0] }] },
  [violation("contribution-footprint-complete", { kind: "contribution", key }, "bounds")], "transitive discharge with a real reference cycle");
  const cyclicTypes = { terms: [{ kind: "primitive", primitive: "int32" }, { kind: "array", element: 1, readonly: false }], signatures: [signature] };
  const closed = { kind: "eq", occurrence, left: 1, right: 0 };
  fullEqual(product.verifyInference(verificationInput({ constraints: [constraintSet([closed])], types: cyclicTypes,
    contributions: [{ key: { node: occurrence, candidate: null, role: { kind: "equality", direction: "left-to-right" } },
      reads: [], bounds: [], constraint: { body, index: 0 } }] })), [], "cyclic type closure is iterative and does not invent an open variable");
});

test("typed bad numeric references reach their actual verifier without text normalization", () => {
  const equality = { kind: "eq", occurrence, left: 0, right: 0 };
  const key = { node: occurrence, candidate: null, role: { kind: "equality", direction: "left-to-right" } };
  const contribution = { key, reads: [], bounds: [], constraint: { body, index: 0 } };
  for (const invalid of [-0, -1, 0.5, NaN, Infinity, -Infinity, 9007199254740992]) {
    const label = Object.is(invalid, -0) ? "negative zero" : String(invalid);
    fullEqual(product.verifyInference(verificationInput({ constraints: [constraintSet([
      { ...equality, occurrence: { body, node: invalid } },
    ])] })), [violation("qualified-reference", constraintSite(0), "nodes")], `exact node domain: ${label}`);
    fullEqual(product.verifyInference(verificationInput({ constraints: [constraintSet([
      { ...equality, left: invalid },
    ])] })), [violation("qualified-reference", constraintSite(0), "types")], `exact type-reference domain: ${label}`);
    fullEqual(product.verifyInference(verificationInput({ constraints: [constraintSet([
      { ...equality, left: invalid },
    ])], contributions: [contribution] })), [violation("qualified-reference", constraintSite(0), "types")],
    `an absent type has no invented contribution footprint: ${label}`);
    fullEqual(product.verifyInference(verificationInput({ constraints: [constraintSet([equality])],
      contributions: [{ ...contribution, reads: [invalid] }] })),
    [violation("contribution-reads-bounds-declared", { kind: "contribution", key }, "reads")], `exact read domain: ${label}`);
    fullEqual(product.verifyInference(verificationInput({ constraints: [constraintSet([equality])],
      contributions: [{ ...contribution, constraint: { body, index: invalid } }] })),
    [violation("constraint-reference", { kind: "contribution", key }, "constraint")], `exact constraint-index domain: ${label}`);
  }
  for (const reads of [[0, 0], [1, 0]]) {
    fullEqual(product.verifyInference(verificationInput({ constraints: [constraintSet([equality], [localVariable(0), localVariable(1)])],
      contributions: [{ ...contribution, reads }] })),
    [violation("contribution-reads-bounds-declared", { kind: "contribution", key }, "reads")], "declared read identities remain unique and ordered");
  }
  ruleCase("open-term-resolves", { constraints: [constraintSet([
    { kind: "default", occurrence, variable: 0, rule: "local-producers", type: 0 },
  ], [localVariable(0)])] }, { constraints: [constraintSet([
    { kind: "default", occurrence, variable: -0, rule: "local-producers", type: 0 },
  ], [localVariable(0)])] }, [violation("open-term-resolves", constraintSite(0), "variable")], "default variable reference preserves negative zero until verification");
});

test("repeated footprint queries are keyed by their actual root and complete bound vector", () => {
  const equality = { kind: "eq", occurrence, left: 1, right: 2 };
  const types = { terms: [{ kind: "primitive", primitive: "int32" }, { kind: "open", group, variable: 0 },
    { kind: "array", element: 3, readonly: false }, { kind: "open", group, variable: 1 }], signatures: [signature] };
  const keys = ["left-to-right", "right-to-left"].map(direction => ({ node: occurrence, candidate: null, role: { kind: "equality", direction } }));
  const contribution = (key, bounds) => ({ key, reads: [], bounds, constraint: { body, index: 0 } });
  const input = { constraints: [constraintSet([equality], [localVariable(0), localVariable(1)])], types };
  for (const [first, second, expected] of [
    [[0, 1], [0, 1], []],
    [[0], [0, 1], [violation("contribution-footprint-complete", { kind: "contribution", key: keys[0] }, "bounds")]],
    [[0, 1], [0], [violation("contribution-footprint-complete", { kind: "contribution", key: keys[1] }, "bounds")]],
    [[0], [0], keys.map(key => violation("contribution-footprint-complete", { kind: "contribution", key }, "bounds"))],
  ]) fullEqual(product.verifyInference(verificationInput({ ...input,
    contributions: [contribution(keys[0], first), contribution(keys[1], second)] })), expected,
  "a complete memoized answer is reused only for the same actual root and bound environment");
});

test("discharge reaching any selected relationship is a direct component law, not a guessed whole-receiver footprint", () => {
  const variables = [localVariable(0), localVariable(1)];
  const types = { terms: [{ kind: "primitive", primitive: "int32" }, { kind: "open", group, variable: 0 },
    { kind: "open", group, variable: 1 }], signatures: [signature] };
  const application = { captured: captureGolden.value, permissionScope: null, callee: 1, receiver: null,
    typeArguments: [], arguments: [], candidates: 0, result: 2 };
  const selected = [
    { kind: "member", occurrence, receiver: 1, key: { kind: "text", value: "closed" }, access: "read", result: 2, origins: [], bindings: emptyBindings },
    { kind: "index", occurrence, receiver: 1, key: 0, access: "read", result: 2, bindings: emptyBindings },
    { kind: "construct-literal", occurrence, construction: "object", parts: [], destination: 1, result: 2 },
    { kind: "call", occurrence, application }, { kind: "construct", occurrence, application },
    { kind: "protocol", occurrence, protocol: "iterate", asynchronous: false, subject: 1, operands: [], result: 2, bindings: emptyBindings },
  ];
  for (const constraint of selected) {
    const discharge = { kind: "discharge", occurrence, checkerDiagnostic: 0, obligations: [{ body, index: 0 }] };
    const set = { ...constraintSet([constraint, discharge], variables),
      candidates: constraint.kind === "call" || constraint.kind === "construct" ? [{ id: 0, candidates: [] }] : [] };
    const contribution = { key: { node: occurrence, candidate: null, role: { kind: "discharge" } },
      reads: [], bounds: [], constraint: { body, index: 1 } };
    fullEqual(product.verifyInference(verificationInput({ constraints: [set], contributions: [contribution], types,
      bindingScopes: ["member", "index", "protocol"].includes(constraint.kind) ? [emptyScope] : [] })), [],
    `selected ${constraint.kind} completeness is not approximated from raw operand variables`);
  }
});

test("type and signature closure follows every actual arena edge without traversing IDs as inline records", () => {
  const nominal = `D[${moduleIdentity};Model]`;
  const enumeration = `D[${moduleIdentity};Choice]`;
  const parameter = { owner: nominal, index: 0 };
  const parameterDeclaration = `D[${moduleIdentity};Model/T]`;
  const memberOrigins = [{ kind: "declared", declaration: `D[${moduleIdentity};Model/field]` }];
  const member = { key: { kind: "text", value: "field" }, origins: memberOrigins, readOrigins: memberOrigins, writeOrigins: memberOrigins,
    kind: "property", read: 0, write: 0, optional: false, readonly: false };
  const terms = [
    { kind: "primitive", primitive: "int32" }, { kind: "string" }, { kind: "intrinsic", intrinsic: "bigint" },
    { kind: "literal", value: { kind: "number", token: "1", value: { numerator: 1n, denominator: 1n, negativeZero: false } }, base: 0 },
    { kind: "union", members: [0, 1] }, { kind: "intersection", members: [0, 1] },
    { kind: "optional", value: 0 }, { kind: "array", element: 0, readonly: true },
    { kind: "tuple", elements: [{ kind: "required", type: 0, declaration: parameterDeclaration },
      { kind: "optional", type: 1, declaration: null }, { kind: "rest", type: 0, declaration: null }], readonly: false },
    { kind: "fixed-array", element: 0, extent: { length: 9007199254740993n, runtimeBase: "bigint" } },
    { kind: "shape", members: [member], indexes: [{ declaration: `D[${moduleIdentity};Model/index]`, key: 1, read: 0, write: 0, readonly: false }],
      calls: [0], constructs: [1] },
    { kind: "callable", calls: [0], constructs: [1] },
    { kind: "declared", definition: nominal, arguments: [0], facet: "instance", extent: null },
    { kind: "construction-reference", definition: { occurrence, captures: [{ body, local: 0 }] }, arguments: [0] },
    { kind: "enum", definition: enumeration }, { kind: "param", parameter }, { kind: "self", owner: nominal },
    { kind: "projection", source: 0, projection: { kind: "awaited" } },
    { kind: "projection", source: 0, projection: { kind: "component", component: { root: source,
      path: [{ kind: "parameter", signature: 1, index: 0 }] } } },
    { kind: "open", group, variable: 0 }, { kind: "error" },
  ];
  const extra = { ...signature, id: 1, declaration: null, owner: null, kind: "construct",
    typeParameters: [{ identity: parameter, declaration: parameterDeclaration, constraint: 0, default: 1 }],
    receiver: 0, parameters: [{ declaration: parameterDeclaration, kind: "required", type: 0, passing: "by-value", initializer: null }],
    result: 19 };
  const constraints = terms.map((term, index) => ({ kind: "eq", occurrence: { body, node: index }, left: index, right: 0 }));
  const contributions = constraints.map((constraint, index) => ({ key: { node: constraint.occurrence, candidate: null,
    role: { kind: "equality", direction: "left-to-right" } }, reads: [], bounds: [0], constraint: { body, index } }));
  const input = { constraints: [constraintSet(constraints, [localVariable(0)])], contributions,
    types: { terms, signatures: [signature, extra] }, nodes: [{ owner: source, ids: terms.map((term, index) => index) }],
    nominals: [[nominal, { kind: "declared", facets: ["instance", "value"] }], [enumeration, { kind: "enum", facets: ["value"] }]] };
  fullEqual(product.verifyInference(verificationInput(input)), [], "all type and signature records are actual data, not a TypeOf shadow table");
  const bad = { ...input, contributions: contributions.map((contribution, index) => index === 10 ? { ...contribution, bounds: [] } : contribution) };
  ruleCase("contribution-footprint-complete", input, bad,
    [violation("contribution-footprint-complete", { kind: "contribution", key: contributions[10].key }, "bounds")],
    "open result reached through a shape's construct signature");
  for (const [read, write] of [[null, 0], [0, null]]) {
    const shape = { ...terms[10], members: [{ ...member, read, write, readonly: write === null }],
      indexes: [{ ...terms[10].indexes[0], write: null, readonly: true }] };
    fullEqual(product.verifyInference(verificationInput({ ...input,
      types: { ...input.types, terms: terms.map((term, index) => index === 10 ? shape : term) } })), [],
    "genuine read-only and write-only member capabilities retain the complete type closure");
  }
});

test("genuine sum-family type and composed-signature edges participate in the same footprint closure", () => {
  const component = { root: source, path: [{ kind: "sum-arm", index: 0, family: { origin: "authored",
    component: { root: source, path: [] }, parameters: [], roles: [{ authoredIndex: 0, component: source, member: 1 }] } }] };
  const terms = [{ kind: "primitive", primitive: "int32" }, { kind: "open", group, variable: 0 },
    { kind: "projection", source: 0, projection: { kind: "component", component } },
    { kind: "callable", calls: [1], constructs: [] }];
  const types = { terms, signatures: [{ ...signature, result: 1 }, { ...signature, id: 1, declaration: null, owner: null,
    composition: { kind: "union", signatures: [0] } }] };
  for (const root of [2, 3]) {
    const equality = { kind: "eq", occurrence, left: root, right: 0 };
    const key = { node: occurrence, candidate: null, role: { kind: "equality", direction: "left-to-right" } };
    const contribution = { key, reads: [], bounds: [0], constraint: { body, index: 0 } };
    const valid = { constraints: [constraintSet([equality], [localVariable(0)])], contributions: [contribution], types };
    ruleCase("contribution-footprint-complete", valid, { ...valid, contributions: [{ ...contribution, bounds: [] }] },
      [violation("contribution-footprint-complete", { kind: "contribution", key }, "bounds")],
      root === 2 ? "the actual SumFamily role contains a type edge" : "signature composition contains a separate signature edge");
  }
  const cyclic = { terms, signatures: [{ ...signature, result: 1, composition: { kind: "intersection", signatures: [1] } },
    { ...signature, id: 1, declaration: null, owner: null, composition: { kind: "union", signatures: [0] } }] };
  const equality = { kind: "eq", occurrence, left: 3, right: 0 };
  const key = { node: occurrence, candidate: null, role: { kind: "equality", direction: "left-to-right" } };
  const contribution = { key, reads: [], bounds: [0], constraint: { body, index: 0 } };
  const cyclicInput = { constraints: [constraintSet([equality], [localVariable(0)])], contributions: [contribution], types: cyclic };
  ruleCase("contribution-footprint-complete", cyclicInput, { ...cyclicInput, contributions: [{ ...contribution, bounds: [] }] },
    [violation("contribution-footprint-complete", { kind: "contribution", key }, "bounds")],
    "signature arena cycles terminate by reference identity while retaining their genuine open result");
});

test("open and invalid arena edges coexist without inventing a footprint refusal or dropping the reference finding", () => {
  const key = { node: occurrence, candidate: null, role: { kind: "equality", direction: "left-to-right" } };
  const contribution = { key, reads: [], bounds: [0], constraint: { body, index: 0 } };
  const base = { constraints: [constraintSet([{ kind: "eq", occurrence, left: 2, right: 0 }], [localVariable(0)])],
    contributions: [contribution] };
  const leaves = [{ kind: "primitive", primitive: "int32" }, { kind: "open", group, variable: 0 }];
  const union = { ...base, types: { terms: [...leaves, { kind: "union", members: [0, 1] }], signatures: [signature] } };
  ruleCase("qualified-reference", union, { ...base,
    types: { terms: [...leaves, { kind: "union", members: [1, 9] }], signatures: [signature] } }, [
    violation("qualified-reference", constraintSite(0), "types"),
    violation("qualified-reference", groupSite, "type-reference"),
  ], "missing but ordinal type reference is reported by the canonical type owner");
  ruleCase("qualified-reference", union, { ...base,
    types: { terms: [...leaves, { kind: "union", members: [-1, 1] }], signatures: [signature] } }, [
    violation("qualified-reference", constraintSite(0), "types"),
    violation("qualified-reference", groupSite, "type-reference"),
    violation("qualified-reference", groupSite, "union-order"),
  ], "nonordinal arena edges retain both independent reference and ordering findings");
  const callable = { ...base, types: { terms: [...leaves, { kind: "callable", calls: [0], constructs: [] }],
    signatures: [{ ...signature, result: 1 }] } };
  ruleCase("qualified-reference", callable, { ...base, types: { terms: [...leaves,
    { kind: "callable", calls: [0, 3], constructs: [] }], signatures: [{ ...signature, result: 1 }] } }, [
    violation("qualified-reference", constraintSite(0), "types"),
    violation("qualified-reference", groupSite, "signature-reference"),
  ], "missing signature edge and genuine open result use separate arenas");
  ruleCase("qualified-reference", callable, { ...base, types: { terms: [...leaves,
    { kind: "callable", calls: [0, -1], constructs: [] }], signatures: [{ ...signature, result: 1 }] } }, [
    violation("qualified-reference", constraintSite(0), "types"),
    violation("qualified-reference", groupSite, "signature-reference"),
    violation("qualified-reference", groupSite, "signature-order"),
  ], "a nonordinal signature edge retains its separate reference and ordering findings");
});

test("positional scopes are authentic complete environments, never inferred from vectors", () => {
  const flow = { kind: "flow", occurrence, from: 0, to: 0, role: "assignment", bindings: emptyBindings };
  ruleCase("binding-vector-complete", { constraints: [constraintSet([flow])], bindingScopes: [emptyScope] },
    { constraints: [constraintSet([flow])] }, [violation("binding-vector-complete", constraintSite(0), "bindingScopes[0]")], "missing occurrence scope");
  ruleCase("binding-vector-complete", {}, { bindingScopes: [emptyScope] },
    [violation("binding-vector-complete", groupSite, "bindingScopes[0]")], "extra occurrence scope");
  const parameter = { owner: definition, index: 0 };
  const genericScope = { ...emptyScope, capturedParameters: [parameter] };
  const genericFlow = { ...flow, bindings: { ...emptyBindings, capturedBindings: [{ kind: "rigid", parameter }] } };
  ruleCase("binding-vector-complete", { constraints: [constraintSet([genericFlow])], bindingScopes: [genericScope] },
    { constraints: [constraintSet([flow])], bindingScopes: [genericScope] },
    [violation("binding-vector-complete", constraintSite(0), "binding-vector-complete")], "real captured generic tail versus nongeneric empty tail");
  const shared = flow.bindings;
  fullEqual(product.verifyInference(verificationInput({ constraints: [constraintSet([flow, { ...flow, bindings: shared }])],
    bindingScopes: [emptyScope, emptyScope] })), [], "repeated identical objects count by position, never identity deduplication");
  const sparseScopes = [];
  sparseScopes.length = 2;
  sparseScopes[1] = genericScope;
  ruleCase("binding-vector-complete", { constraints: [constraintSet([flow, genericFlow])], bindingScopes: [emptyScope, genericScope] },
    { constraints: [constraintSet([flow, flow])], bindingScopes: sparseScopes }, [
      violation("binding-vector-complete", constraintSite(0), "bindingScopes[0]"),
      violation("binding-vector-complete", constraintSite(1), "binding-vector-complete"),
    ], "skipping an absent scope cannot shift a later canonical failure onto the missing occurrence");
});

test("canonical type findings retain their original order and every actual binding and evidence occurrence", () => {
  const parameter = { owner: definition, index: 0 };
  const classOwner = `D[${moduleIdentity};Container]`;
  const capturedOwner = `D[${moduleIdentity};outer]`;
  const classParameter = { owner: classOwner, index: 0 };
  const capturedParameter = { owner: capturedOwner, index: 0 };
  const flow = node => ({ kind: "flow", occurrence: { body, node }, from: 0, to: 0, role: "assignment", bindings: emptyBindings });
  const scope = { ...emptyScope, classParameters: [classParameter], methodParameters: [parameter], capturedParameters: [capturedParameter] };
  const first = { ...flow(0), bindings: { ...emptyBindings,
    classBindings: [{ kind: "rigid", parameter: classParameter }], methodBindings: [{ kind: "rigid", parameter }],
    capturedBindings: [{ kind: "rigid", parameter: capturedParameter }] } };
  const second = { ...first, occurrence: { body, node: 1 } };
  const third = { ...first, occurrence: { body, node: 2 } };
  const set = { ...constraintSet([first, second, third]), evidence: [evidence(), evidence()] };
  const valid = { constraints: [set], bindingScopes: [scope, scope, scope], nodes: [{ owner: source, ids: [0, 1, 2] }], declarations: [
    [definition, { ...declarationFacts, scope }],
    [classOwner, { scope: { ...emptyScope, classParameters: [classParameter] }, parameterCount: null, endpoints: [] }],
    [capturedOwner, { scope: { ...emptyScope, methodParameters: [capturedParameter] }, parameterCount: 0, endpoints: [] }],
  ], types: { terms: [{ kind: "primitive", primitive: "int32" }], signatures: [{ ...signature, typeParameters: [{ identity: parameter,
    declaration: `D[${moduleIdentity};run/T]`, constraint: null, default: null }] }] } };
  const invalid = { ...valid, constraints: [{ ...set, constraints: [{ ...flow(0), bindings: { ...emptyBindings,
    capturedBindings: [{ kind: "rigid", parameter: capturedParameter }] } }, { ...second, bindings: { ...first.bindings,
    capturedBindings: [{ kind: "rigid", parameter: { owner: capturedOwner, index: 1 } }] } }, third], evidence: [evidence(9), evidence()] }],
  types: { terms: [{ kind: "primitive", primitive: "int32" }], signatures: [{ ...valid.types.signatures[0], result: 9 }] } };
  ruleCase("binding-vector-complete", valid, invalid, [
    violation("qualified-reference", bodySite, "types"),
    violation("qualified-reference", groupSite, "type-reference"),
    violation("binding-vector-complete", constraintSite(0), "binding-vector-complete"),
    violation("binding-vector-complete", constraintSite(0), "binding-vector-complete"),
    violation("binding-vector-complete", constraintSite(1), "binding-vector-complete"),
    violation("qualified-reference", bodySite, "type-reference"),
  ], "table then binding families then evidence preserve canonical output order without owner fallback");
  const otherDefinition = `D[${moduleIdentity};z]`;
  const otherBody = `B[${otherDefinition};function;0]`;
  const secondOccurrence = { body: otherBody, node: 0 };
  const paired = { group: { id: group, bodies: [body, otherBody], signatures: [] }, constraints: [
    { ...constraintSet(), evidence: [evidence()] },
    { ...constraintSet(), body: otherBody, evidence: [{ ...evidence(), component: { kind: "body", value: secondOccurrence } }] },
  ], nodes: [{ owner: source, ids: [0] }, { owner: { kind: "body", value: secondOccurrence }, ids: [0] }] };
  ruleCase("qualified-reference", paired, { ...paired, constraints: paired.constraints.map(set => ({ ...set,
    evidence: set.evidence.map(value => ({ ...value, type: 9 })) })) }, [
    violation("qualified-reference", bodySite, "types"),
    violation("qualified-reference", { kind: "body", body: otherBody }, "types"),
    violation("qualified-reference", bodySite, "type-reference"),
    violation("qualified-reference", { kind: "body", body: otherBody }, "type-reference"),
  ], "repeated evidence values at distinct owners are routed by actual occurrence, not object identity");
});

test("decision/proof/construction/protocol checks compare full structural final records without replay", () => {
  const flow = { kind: "flow", occurrence, from: 0, to: 0, role: "initialization", bindings: emptyBindings };
  const proof = { steps: [{ from: componentGolden.value, to: componentGolden.value, rule: "identity", premises: [] }], conclusion: 0 };
  const solutionWith = decision => ({ ...completeSolution(), constraints: [{ constraint: { body, index: 0 }, decision }] });
  const conversion = proofValue => ({ kind: "flow", embedding: { kind: "conversion", conversion: "shape", proof: proofValue } });
  const flowInput = { constraints: [constraintSet([flow])], bindingScopes: [emptyScope], solution: solutionWith(conversion(proof)) };
  ruleCase("proof-reference", flowInput, { ...flowInput, solution: solutionWith(conversion({ ...proof, conclusion: 1 })) },
    [violation("proof-reference", { kind: "proof", constraint: { body, index: 0 }, step: 1 }, "conclusion")]);
  ruleCase("proof-order", flowInput, { ...flowInput, solution: solutionWith(conversion({ ...proof,
    steps: [{ ...proof.steps[0], premises: [0] }] })) },
  [violation("proof-order", { kind: "proof", constraint: { body, index: 0 }, step: 0 }, "premises")]);
  ruleCase("decision-kind", flowInput, { ...flowInput, solution: solutionWith({ kind: "eq", equivalent: true }) },
    [violation("decision-kind", constraintSite(0), "decision")]);
  const construction = { kind: "construct-literal", occurrence, construction: "object", parts: [{ kind: "element", occurrence, type: 0 }], destination: null, result: 0 };
  const part = { part: 0, source: occurrence, destination: componentGolden.value, member: null, embedding: { kind: "identity" } };
  const constructDecision = parts => ({ kind: "construct-literal", operation: { kind: "selected", operation: { kind: "object-construction", parts }, operands: [0], result: 0 } });
  ruleCase("construction-part-total", { constraints: [constraintSet([construction])], solution: solutionWith(constructDecision([part])) },
    { constraints: [constraintSet([construction])], solution: solutionWith(constructDecision([])) },
    [violation("construction-part-total", constraintSite(0), "parts")]);
  const protocol = { kind: "protocol", occurrence, protocol: "iterate", asynchronous: false, subject: 0, operands: [], result: 0, bindings: emptyBindings };
  const operation = { kind: "protocol", protocol: "iterate", asynchronous: false, steps: [
    { role: "completion", operation: { kind: "completion" }, operands: [], result: 0 },
  ], value: 0, completion: 0, yielded: null, sent: null, thrown: 0 };
  const protocolDecision = value => ({ kind: "protocol", operation: { kind: "selected", operation: value, operands: [], result: 0 } });
  ruleCase("protocol-channels", { constraints: [constraintSet([protocol])], bindingScopes: [emptyScope], solution: solutionWith(protocolDecision(operation)) },
    { constraints: [constraintSet([protocol])], bindingScopes: [emptyScope], solution: solutionWith(protocolDecision({ ...operation, asynchronous: true })) },
    [violation("protocol-channels", constraintSite(0), "protocol")]);
  ruleCase("body-completion-endpoints", { solution: completeSolution() },
    { solution: { ...completeSolution(), bodies: [] } }, [violation("body-completion-endpoints", bodySite, "body")]);
});

test("selected operation and narrowed-proof traversal verifies every actual closed structural family", () => {
  const member = { key: { kind: "text", value: "field" }, origins: [], selectedDeclarations: [], primary: null,
    read: 0, write: null, getter: null, setter: null, bindings: emptyBindings };
  const part = { part: 0, source: occurrence, destination: componentGolden.value, member, embedding: { kind: "identity" } };
  const application = applicationGolden().value;
  const protocol = { kind: "protocol", protocol: "iterate", asynchronous: false, steps: [
    { role: "acquire", operation: { kind: "call", application }, operands: [], result: 0 },
    { role: "value", operation: { kind: "completion" }, operands: [], result: 0 },
    { role: "completion", operation: { kind: "core", declaration: definition, bindings: emptyBindings }, operands: [], result: 0 },
  ], value: 0, completion: 0, yielded: null, sent: null, thrown: 0 };
  const rows = [
    [{ kind: "native-operator", operator: "+", carrier: "int32" }, []],
    [{ kind: "bigint-operator", operator: "*" }, []],
    [{ kind: "string-operator", operator: "+" }, []],
    [{ kind: "boolean-operator", operator: "&&" }, []],
    [{ kind: "absence-test", negated: false }, []],
    [{ kind: "object-construction", parts: [part] }, [emptyScope]],
    [{ kind: "array-construction", parts: [part] }, [emptyScope]],
    [protocol, [emptyScope, emptyScope, emptyScope]],
    [{ kind: "conversion", from: 0, to: 0, embedding: { kind: "identity" } }, []],
    [{ kind: "library", declaration: definition, bindings: emptyBindings }, [emptyScope]],
    [{ kind: "core", declaration: definition, bindings: emptyBindings }, [emptyScope]],
    ...["pointer-address", "pointer-read", "pointer-write", "pointer-offset", "type-query", "discard"].map(kind => [{ kind }, []]),
  ];
  const raw = { kind: "op", occurrence, operator: "+", operands: [0], result: 0, permissionScope: null };
  const solved = operation => ({ ...completeSolution(), constraints: [{ constraint: { body, index: 0 }, decision: { kind: "op",
    operation: { kind: "selected", operation, operands: [0], result: 0 } } }] });
  for (const [operation, bindingScopes] of rows)
    fullEqual(product.verifyInference(verificationInput({ constraints: [constraintSet([raw])], bindingScopes, solution: solved(operation) })), [],
      `complete selected ${operation.kind} final record, without replaying semantic selection`);
  assert.equal(rows.length, 17);
  const types = { terms: [{ kind: "primitive", primitive: "int32" }, { kind: "string" }], signatures: [signature] };
  const base = { constraints: [constraintSet([raw])], bindingScopes: [emptyScope, emptyScope, emptyScope], types, solution: solved(protocol) };
  for (const [index, expected] of [
    [0, [violation("protocol-channels", constraintSite(0), "result")]],
    [1, [violation("protocol-channels", constraintSite(0), "value")]],
    [2, [violation("protocol-channels", constraintSite(0), "completion")]],
  ]) ruleCase("protocol-channels", base, { ...base, solution: solved({ ...protocol,
    steps: protocol.steps.map((step, position) => position === index ? { ...step, result: 1 } : step) }) }, expected,
  "actual nested result, value and completion channels are distinct correlations");
  const refinement = { kind: "refine", occurrence, source: 0, checked: 0, result: 0 };
  const proof = { steps: [{ from: componentGolden.value, to: componentGolden.value, rule: "identity", premises: [] }], conclusion: 0 };
  const narrowed = proof => ({ ...completeSolution(), constraints: [{ constraint: { body, index: 0 },
    decision: { kind: "refine", refinement: { kind: "narrowed", source: 0, result: 0, proof } } }] });
  ruleCase("proof-reference", { constraints: [constraintSet([refinement])], solution: narrowed(proof) },
    { constraints: [constraintSet([refinement])], solution: narrowed({ ...proof, steps: [{ ...proof.steps[0], premises: [2] }] }) },
    [violation("proof-reference", { kind: "proof", constraint: { body, index: 0 }, step: 0 }, "premises")],
    "narrowed proof follows the same genuine reference verifier");
  const construction = { kind: "construct-literal", occurrence, construction: "object", parts: [{ kind: "element", occurrence, type: 0 }],
    destination: null, result: 0 };
  const constructed = parts => ({ ...completeSolution(), constraints: [{ constraint: { body, index: 0 }, decision: { kind: "construct-literal",
    operation: { kind: "selected", operation: { kind: "object-construction", parts }, operands: [], result: 0 } } }] });
  const complete = { constraints: [constraintSet([construction])], bindingScopes: [emptyScope], solution: constructed([part]),
    nodes: [{ owner: source, ids: [0, 1] }] };
  for (const changed of [{ ...part, part: -0 }, { ...part, source: { body, node: 1 } }])
    ruleCase("construction-part-total", complete, { ...complete, solution: constructed([changed]) },
      [violation("construction-part-total", constraintSite(0), "parts")], "actual construction part identity and source, not a positional guess");
});

test("final publications, solved constraints and body inventories retain complete duplicate and missing-record findings", () => {
  const equality = { kind: "eq", occurrence, left: 0, right: 0 };
  const solved = { constraint: { body, index: 0 }, decision: { kind: "eq", equivalent: true } };
  const solution = { ...completeSolution(), constraints: [solved] };
  const input = { constraints: [constraintSet([equality])], solution };
  ruleCase("solution-total", input, { ...input, solution: { ...solution, constraints: [] } },
    [violation("solution-total", constraintSite(0), "constraints")], "every actual input constraint has one final record");
  ruleCase("solution-order", input, { ...input, solution: { ...solution, constraints: [solved, solved] } },
    [violation("solution-order", constraintSite(0), "constraints")], "duplicate solved records do not erase their original constraint");
  ruleCase("constraint-reference", input, { ...input, solution: { ...solution, constraints: [solved,
    { ...solved, constraint: { body, index: 1 } }] } },
    [violation("constraint-reference", constraintSite(1), "constraint")], "extra solved record cannot create an input constraint");
  ruleCase("solution-order", input, { ...input, solution: { ...solution, bodies: [bodyTyping, bodyTyping] } },
    [violation("solution-order", bodySite, "bodies")], "duplicate body publication retains the actual endpoint");
  ruleCase("solution-total", {}, { solution: { ...completeSolution(), variables: [{ variable: 0, value: evidence() }] } },
    [violation("solution-total", variableSite(0), "variables")], "an undeclared variable cannot be published");
  ruleCase("group-ownership", {}, { solution: { ...completeSolution(), group: `G[B[D[${moduleIdentity};z];function;0]]` } },
    [violation("group-ownership", groupSite, "solution")], "a complete solution still names its actual group");
  ruleCase("body-completion-endpoints", {}, { solution: { ...completeSolution(), bodies: [{ ...bodyTyping, signature: 1 }] } }, [
    violation("body-completion-endpoints", bodySite, "signature"), violation("qualified-reference", bodySite, "types"),
  ], "a missing signature remains both a body endpoint and qualified arena reference");
});

test("recorded checks correlate actual final variables and bound keys, not unknowable event history", () => {
  const constraint = { kind: "default", occurrence, variable: 0, rule: "local-producers", type: 0 };
  const key = { node: occurrence, candidate: null, role: { kind: "default" } };
  const contribution = { key, reads: [], bounds: [0], constraint: { body, index: 0 } };
  const check = { variable: 0, contribution: key, bound: { contribution: key, variable: 0, kind: "producer", value: evidence() },
    outcome: { kind: "satisfied", embedding: { kind: "identity" } } };
  const solution = { ...completeSolution(), variables: [{ variable: 0, value: evidence() }],
    constraints: [{ constraint: { body, index: 0 }, decision: { kind: "default", type: 0 } }], checks: [check] };
  const input = { constraints: [constraintSet([constraint], [localVariable(0)])], contributions: [contribution], solution };
  ruleCase("check-recorded", input, { ...input, solution: { ...solution, checks: [{ ...check, variable: 1 }] } },
    [violation("check-recorded", { kind: "check", index: 0 }, "bound")]);
  for (const reason of ["signature-use-demand", "conflicting-destinations", "accumulator-widening", "binder-constraint", "literal-inexact"])
    fullEqual(product.verifyInference(verificationInput({ ...input, solution: { ...solution, checks: [{ ...check, outcome: { kind: "refused", reason } }] } })), [],
      `refused ${reason} is retained final data, not a fabricated successful check`);
  for (const changed of [{ ...check, variable: -0 }, { ...check, bound: { ...check.bound, variable: -0 } }])
    ruleCase("check-recorded", input, { ...input, solution: { ...solution, checks: [changed] } },
      [violation("check-recorded", { kind: "check", index: 0 }, "bound")], "recorded variable references reject negative zero without normalization");
  const step = { from: componentGolden.value, to: componentGolden.value, rule: "identity", premises: [] };
  const converted = proof => ({ ...solution, checks: [{ ...check,
    outcome: { kind: "satisfied", embedding: { kind: "conversion", conversion: "numeric", proof } } }] });
  ruleCase("proof-reference", { ...input, solution: converted({ steps: [step], conclusion: 0 }) },
    { ...input, solution: converted({ steps: [{ ...step, premises: [2] }], conclusion: 0 }) },
    [violation("proof-reference", { kind: "proof", constraint: { body, index: 0 }, step: 0 }, "premises")],
    "a recorded conversion check retains the entire actual proof vector");
});

function failureValueText(root, label) {
  const references = new Map();
  const pending = [];
  const token = value => {
    if (value === null) return ["null"];
    if (typeof value === "object") {
      let reference = references.get(value);
      if (reference === undefined) {
        reference = pending.length;
        references.set(value, reference);
        pending.push(value);
      }
      return ["reference", reference];
    }
    if (typeof value === "number") return ["number", Object.is(value, -0) ? "-0" : String(value)];
    if (typeof value === "bigint") return ["bigint", String(value)];
    if (value === undefined) return ["undefined"];
    return [typeof value, value];
  };
  const lines = [JSON.stringify({ format: "ir-infer-comparison-value", label, root: token(root) })];
  for (const [reference, value] of pending.entries()) {
    const properties = Object.getOwnPropertyNames(value).map(name => {
      const descriptor = Object.getOwnPropertyDescriptor(value, name);
      return { name, enumerable: descriptor.enumerable, configurable: descriptor.configurable,
        writable: descriptor.writable, value: token(descriptor.value) };
    });
    lines.push(JSON.stringify({ reference, kind: Array.isArray(value) ? "array" : "record",
      nullPrototype: Object.getPrototypeOf(value) === null, properties }));
  }
  return `${lines.join("\n")}\n`;
}

function comparisonFailure(actual, expected, label) {
  comparisonFailureCount += 1;
  const stem = resolve(evidenceDirectory, `comparison-${comparisonFailureCount}`);
  const actualPath = `${stem}.actual.jsonl`;
  const expectedPath = `${stem}.expected.jsonl`;
  writeFileSync(actualPath, failureValueText(actual, label), { flag: "wx" });
  writeFileSync(expectedPath, failureValueText(expected, label), { flag: "wx" });
  return `Complete comparison failed; actual: ${actualPath}; expected: ${expectedPath}`;
}

function fullEqual(actual, expected, label) {
  const equal = compareCaseValues(actual, expected);
  assert.equal(equal, true, equal ? label : comparisonFailure(actual, expected, label));
}

function deepEqual(actual, expected, label) {
  try {
    assert.deepEqual(actual, expected, label);
  } catch (error) {
    if (!(error instanceof assert.AssertionError)) throw error;
    assert.fail(comparisonFailure(actual, expected, label));
  }
}

test("discharge obligation references preserve every original missing or nonordinal position", () => {
  const equality = { kind: "eq", occurrence, left: 0, right: 0 };
  const valid = { constraints: [constraintSet([equality, { kind: "discharge", occurrence, obligations: [{ body, index: 0 }] }])] };
  for (const obligations of [[{ body, index: -1 }], [{ body, index: 9 }], [{ body, index: 0 }, { body, index: 9 }, { body, index: -1 }]]) {
    ruleCase("constraint-reference", valid, { constraints: [constraintSet([equality, { kind: "discharge", occurrence, obligations }])] },
      obligations.filter(reference => reference.index !== 0).map(() => violation("constraint-reference", constraintSite(1), "obligations")),
      "only real published obligations resolve; missing entries are neither compacted nor replaced");
  }
});

test("actual formal tables and canonical endpoint associations are independent of endpoint spelling", () => {
  const candidate = { ordinal: 0, declaration: definition, appliedSignature: { kind: "available", value: 0 },
    bindings: { kind: "unavailable", reason: "not-provided" }, conditionalFailure: { kind: "available", value: null }, contributions: [] };
  const argument = { occurrence: { body, node: 1 }, kind: "value", type: 0, tuple: null, closure: null };
  const application = { captured: captureGolden.value, permissionScope: null, callee: 0, receiver: null, typeArguments: [], arguments: [argument], candidates: 0, result: 0 };
  const set = { ...constraintSet([{ kind: "call", occurrence, application }]), candidates: [{ id: 0, candidates: [candidate] }] };
  const parameter = { declaration: `D[${moduleIdentity};run/argument]`, kind: "required", type: 0, passing: "by-value", initializer: null };
  const signatureValue = { ...signature, parameters: [parameter] };
  const selected = { ...applicationGolden().value, parameters: [{ kind: "argument", parameter: 0, argument: 0, component: null, passing: "by-value" }] };
  const solved = value => ({ ...completeSolution(), constraints: [{ constraint: { body, index: 0 }, decision: { kind: "call", application: value, operation: null } }] });
  const input = { constraints: [set], bindingScopes: [emptyScope, emptyScope], solution: solved(selected),
    declarations: [[definition, { ...declarationFacts, parameterCount: 1 }]],
    nodes: [{ owner: source, ids: [0, 1] }], types: { terms: [{ kind: "primitive", primitive: "int32" }], signatures: [signatureValue] } };
  ruleCase("parameter-mapping-total", input, { ...input, solution: solved({ ...selected, parameters: [] }) },
    [violation("parameter-mapping-total", constraintSite(0), "parameters")]);
  const unboundSignature = { ...signatureValue, id: 1, declaration: null, owner: null, result: 1 };
  const withExtraSignature = { ...input, types: { terms: [...input.types.terms, { kind: "string" }], signatures: [signatureValue, unboundSignature] } };
  ruleCase("endpoint-agreement", withExtraSignature, { ...withExtraSignature,
    solution: solved({ ...selected, advertised: { ...selected.advertised, signature: 1 } }) },
  [violation("endpoint-agreement", constraintSite(0), "endpoints")]);
  ruleCase("api-endpoint-role", input, { ...input, solution: solved({ ...selected, advertised: selected.api }) },
    [violation("api-endpoint-role", constraintSite(0), "advertised")], "real API endpoint cannot replace the advertised role");
  for (const api of [{ ...selected.api, role: "advertised" }, { ...selected.api, body: null },
    { ...selected.api, role: "api-signature" }])
    ruleCase("api-endpoint-role", input, { ...input, solution: solved({ ...selected, api }) }, [
      violation("endpoint-agreement", constraintSite(0), "endpoints"),
      violation("api-endpoint-role", constraintSite(0), "api"),
    ], "actual endpoint role and activation shape are independent requirements");
  ruleCase("endpoint-agreement", withExtraSignature, { ...withExtraSignature,
    solution: solved({ ...selected, completion: { ...selected.completion, signature: 1 } }) }, [
    violation("endpoint-agreement", constraintSite(0), "completion"),
    violation("body-completion-endpoints", constraintSite(0), "completion"),
  ], "a real but different completion signature retains both structural cofindings");
  ruleCase("body-completion-endpoints", withExtraSignature, { ...withExtraSignature,
    solution: solved({ ...selected, completion: { ...selected.completion, completion: 1 } }) },
  [violation("body-completion-endpoints", constraintSite(0), "completion")], "the actual activated body owns its completion channels");
  for (const kind of ["call", "construct"]) {
    const selectedOperation = { kind: "decided", decision: { kind: "selected", operation: { kind: "discard" }, operands: [], result: 0 } };
    const deferredOperation = { kind: "deferred", deferred: { invocation: { rule: "core", input: {
      context: contextGolden.value, captured: captureGolden.value, declaration: definition, operands: [],
      result: evidence(), permissionScope: null,
    } }, result: 0 } };
    for (const operation of [selectedOperation, deferredOperation]) {
      const solution = { ...completeSolution(), constraints: [{ constraint: { body, index: 0 },
        decision: { kind, application: selected, operation } }] };
      fullEqual(product.verifyInference(verificationInput({ ...input,
        constraints: [{ ...set, constraints: [{ kind, occurrence, application }] }], solution,
        bindingScopes: operation.kind === "deferred" ? [emptyScope, emptyScope, emptyScope] : input.bindingScopes })), [],
      `${kind} retains its genuine selected or saved deferred operation as well as its application`);
    }
  }
  for (const original of [2, 4]) for (const kind of ["call", "construct"]) {
    const originalSet = { ...set, candidates: [{ id: 0, candidates: [{ ...candidate, ordinal: original }] }],
      constraints: [{ kind, occurrence, application }] };
    const originalSolution = candidateOrdinal => ({ ...completeSolution(), constraints: [{ constraint: { body, index: 0 },
      decision: { kind, application: { ...selected, candidate: candidateOrdinal }, operation: null } }] });
    const originalInput = { ...input, constraints: [originalSet], solution: originalSolution(original) };
    ruleCase("candidate-reference", originalInput, { ...originalInput, solution: originalSolution(0) },
      [violation("candidate-reference", constraintSite(0), "candidate")], `${kind} selects original ordinal ${original}, not dense position zero`);
    ruleCase("candidate-reference", originalInput, { ...originalInput, solution: originalSolution(-0) },
      [violation("candidate-reference", constraintSite(0), "candidate")], "negative zero cannot alias original candidate zero");
  }
  ruleCase("decision-kind", input, { ...input,
    constraints: [constraintSet([{ kind: "eq", occurrence, left: 0, right: 0 }])] },
    [violation("decision-kind", constraintSite(0), "decision")], "a final call cannot stand in for an equality constraint");
  ruleCase("parameter-mapping-total", input, { ...input,
    solution: solved({ ...selected, api: { ...selected.api, signature: -0 } }) }, [
    violation("endpoint-agreement", constraintSite(0), "endpoints"),
    violation("parameter-mapping-total", constraintSite(0), "parameters"),
    violation("parameter-mapping-total", constraintSite(0), "formal"),
    violation("qualified-reference", constraintSite(0), "types"),
  ], "negative-zero API signature data retains every independent formal and reference finding");
  const otherDefinition = `D[${moduleIdentity};otherCandidate]`;
  ruleCase("endpoint-agreement", input, { ...input,
    declarations: [[definition, { ...declarationFacts, parameterCount: 1 }],
      [otherDefinition, { scope: emptyScope, parameterCount: null, endpoints: [] }]],
    solution: solved({ ...selected, advertised: { ...selected.advertised, declaration: otherDefinition } }) }, [
    violation("endpoint-agreement", constraintSite(0), "candidate"),
    violation("endpoint-agreement", constraintSite(0), "endpoints"),
  ], "a genuinely different declaration cannot replace the selected original candidate");
});

test("overloads map optional, default and rest implementation formals rather than the advertised empty signature", () => {
  const initializer = `B[D[${moduleIdentity};run/defaulted];default-argument;0]`;
  const candidate = { ordinal: 0, declaration: definition, appliedSignature: { kind: "available", value: 0 },
    bindings: { kind: "unavailable", reason: "not-provided" }, conditionalFailure: { kind: "available", value: null }, contributions: [] };
  const application = { captured: captureGolden.value, permissionScope: null, callee: 0, receiver: null,
    typeArguments: [], arguments: [], candidates: 0, result: 0 };
  const constraints = [{ ...constraintSet([{ kind: "call", occurrence, application }]), candidates: [{ id: 0, candidates: [candidate] }] }];
  for (const [kind, mapping, wrong] of [
    ["optional", { kind: "omitted", parameter: 0, type: 0 }, { kind: "omitted", parameter: 0, type: 1 }],
    ["default", { kind: "default", parameter: 0, initializer }, { kind: "default", parameter: 0, initializer: body }],
    ["rest", { kind: "rest", parameter: 0, arguments: [], passing: "by-value" },
      { kind: "rest", parameter: 0, arguments: [], passing: "byref-readwrite" }],
  ]) for (const role of ["api-body", "api-signature"]) {
    const api = { declaration: definition, role, signature: 1, body: role === "api-body" ? body : null };
    const selected = { ...applicationGolden().value, api, parameters: [mapping],
      completion: { ...applicationGolden().value.completion, signature: 1 } };
    const solved = parameters => ({ ...completeSolution(), bodies: [{ ...bodyTyping, signature: 1 }],
      constraints: [{ constraint: { body, index: 0 }, decision: { kind: "call", application: { ...selected, parameters }, operation: null } }] });
    const implementation = { ...signature, id: 1, parameters: [{ declaration: `D[${moduleIdentity};run/implementation]`,
      kind, type: 0, passing: "by-value", initializer: kind === "default" ? initializer : null }] };
    const input = { constraints, solution: solved([mapping]), bindingScopes: [emptyScope, emptyScope],
      declarations: [[definition, { ...declarationFacts, parameterCount: 1, endpoints: [selected.advertised, api,
        ...(role === "api-signature" ? [{ ...api, role: "api-body", body }] : [])] }]],
      types: { terms: [{ kind: "primitive", primitive: "int32" }, { kind: "string" }], signatures: [signature, implementation] } };
    ruleCase("parameter-mapping-total", input, { ...input, solution: solved([]) },
      [violation("parameter-mapping-total", constraintSite(0), "parameters")], `${role}/${kind}: the real implementation slot cannot disappear`);
    ruleCase("parameter-mapping-total", input, { ...input, solution: solved([wrong]) },
      [violation("parameter-mapping-total", constraintSite(0), "formal")], `${role}/${kind}: complete API formal details remain exact`);
  }
});

test("every binder family is checked against the genuine original candidate declaration scope", () => {
  const candidate = { ordinal: 0, declaration: definition, appliedSignature: { kind: "available", value: 0 },
    bindings: { kind: "unavailable", reason: "not-provided" }, conditionalFailure: { kind: "available", value: null }, contributions: [] };
  const application = { captured: captureGolden.value, permissionScope: null, callee: 0, receiver: null,
    typeArguments: [], arguments: [], candidates: 0, result: 0 };
  const constraint = { kind: "call", occurrence, application };
  const parameter = { owner: definition, index: 0 };
  for (const original of [0, 2, 4]) for (const [family, field] of [
    ["class", "classParameters"], ["method", "methodParameters"], ["captured", "capturedParameters"],
  ]) {
    const variable = { kind: "binder", id: 0, occurrence, application: occurrence, candidate: original, family, parameter };
    const set = { ...constraintSet([constraint], [variable]), candidates: [{ id: 0, candidates: [{ ...candidate, ordinal: original }] }] };
    const input = { constraints: [set], declarations: [[definition, { ...declarationFacts,
      scope: { ...emptyScope, [field]: [parameter] } }]] };
    ruleCase("binding-vector-complete", input, { ...input, constraints: [{ ...set,
      variables: [{ ...variable, parameter: { ...parameter, index: 1 } }] }] },
    [violation("binding-vector-complete", variableSite(0), "parameter")], `actual ${family} binder identity`);
    ruleCase("candidate-reference", input, { ...input, constraints: [{ ...set,
      variables: [{ ...variable, application: { body, node: 1 } }] }], nodes: [{ owner: source, ids: [0, 1] }] },
    [violation("candidate-reference", variableSite(0), "application")], `actual ${family} application`);
    ruleCase("binding-vector-complete", input, { ...input, constraints: [{ ...set,
      variables: [{ ...variable, parameter: { ...parameter, index: -0 } }] }] },
    [violation("binding-vector-complete", variableSite(0), "parameter")], `actual ${family} parameter excludes negative zero`);
    for (const selected of [-0, 1]) ruleCase("candidate-reference", input, { ...input, constraints: [{ ...set,
      variables: [{ ...variable, candidate: selected }] }] },
    [violation("candidate-reference", variableSite(0), "candidate")], `actual ${family} original candidate domain`);
    ruleCase("candidate-reference", input, { ...input, constraints: [{ ...set, constraints: [constraint, constraint] }] },
      [violation("candidate-reference", variableSite(0), "application")], `ambiguous ${family} application is not guessed from the first occurrence`);
    ruleCase("candidate-reference", input, { ...input, constraints: [{ ...set,
      candidates: [{ id: 0, candidates: [{ ...candidate, ordinal: original }, { ...candidate, ordinal: original }] }] }] }, [
      violation("candidate-order", bodySite, "ordinal"), violation("candidate-reference", variableSite(0), "candidate"),
    ], "two entries with the same original ordinal never select an arbitrary candidate");
    const absent = `D[${moduleIdentity};missingCandidateDeclaration]`;
    ruleCase("candidate-reference", input, { ...input, constraints: [{ ...set,
      candidates: [{ id: 0, candidates: [{ ...candidate, ordinal: original, declaration: absent }] }] }] }, [
      violation("candidate-reference", variableSite(0), "candidate"),
      violation("qualified-reference", bodySite, "declarations"),
    ], "a missing actual candidate declaration has no invented binder scope");
  }
});

test("bodyless APIs retain their own complete generic environment independently of advertised bindings", () => {
  const apiDefinition = `D[${moduleIdentity};nativeRun]`;
  const advertisedParameter = { owner: definition, index: 0 };
  const apiParameter = { owner: apiDefinition, index: 0 };
  const advertisedScope = { ...emptyScope, methodParameters: [advertisedParameter] };
  const apiScope = { ...emptyScope, methodParameters: [apiParameter] };
  const advertisedBindings = { ...emptyBindings, methodBindings: [{ kind: "rigid", parameter: advertisedParameter }] };
  const apiBindings = { ...emptyBindings, methodBindings: [{ kind: "rigid", parameter: apiParameter }] };
  const advertised = { declaration: definition, role: "advertised", signature: 0, body: null };
  const api = { declaration: apiDefinition, role: "api-signature", signature: 1, body: null };
  const candidate = { ordinal: 0, declaration: definition, appliedSignature: { kind: "available", value: 0 },
    bindings: { kind: "unavailable", reason: "not-provided" }, conditionalFailure: { kind: "available", value: null }, contributions: [] };
  const raw = { captured: captureGolden.value, permissionScope: null, callee: 0, receiver: null,
    typeArguments: [], arguments: [], candidates: 0, result: 0 };
  const set = { ...constraintSet([{ kind: "call", occurrence, application: raw }]), candidates: [{ id: 0, candidates: [candidate] }] };
  const application = { candidate: 0, advertised, api, bindings: advertisedBindings, implementationBindings: apiBindings,
    parameters: [], completion: { signature: 1, completion: 0, yielded: null, sent: null }, result: 0 };
  const solution = { ...completeSolution(), constraints: [{ constraint: { body, index: 0 },
    decision: { kind: "call", application, operation: null } }] };
  const parameter = identity => ({ identity, declaration: `D[${moduleIdentity};${identity.owner === definition ? "run" : "nativeRun"}/T]`,
    constraint: null, default: null });
  const input = { constraints: [set], solution, bindingScopes: [advertisedScope, apiScope], declarations: [
    [definition, { ...declarationFacts, scope: advertisedScope, endpoints: [...declarationFacts.endpoints, api] }],
    [apiDefinition, { scope: apiScope, parameterCount: 0, endpoints: [api] }],
  ], types: { terms: [{ kind: "primitive", primitive: "int32" }], signatures: [
    { ...signature, typeParameters: [parameter(advertisedParameter)] },
    { ...signature, id: 1, declaration: apiDefinition, owner: { kind: "item", value: { owner: apiDefinition, node: 0 } },
      typeParameters: [parameter(apiParameter)] },
  ] }, nodes: [{ owner: source, ids: [0] }, { owner: { kind: "item", value: { owner: apiDefinition, node: 0 } }, ids: [0] }] };
  ruleCase("binding-vector-complete", input, { ...input, solution: { ...solution, constraints: [{ constraint: { body, index: 0 },
    decision: { kind: "call", application: { ...application, implementationBindings: emptyBindings }, operation: null } }] } },
  [violation("binding-vector-complete", constraintSite(0), "binding-vector-complete")], "missing actual bodyless API generic tail");
  const nongeneric = { ...input, bindingScopes: [emptyScope, emptyScope], declarations: [
    [definition, { ...declarationFacts, endpoints: [...declarationFacts.endpoints, api] }],
    [apiDefinition, { scope: emptyScope, parameterCount: 0, endpoints: [api] }],
  ], types: { ...input.types, signatures: input.types.signatures.map(value => ({ ...value, typeParameters: [] })) },
  solution: { ...solution, constraints: [{ constraint: { body, index: 0 }, decision: { kind: "call",
    application: { ...application, bindings: emptyBindings, implementationBindings: emptyBindings }, operation: null } }] } };
  fullEqual(product.verifyInference(verificationInput(nongeneric)), [], "nongeneric API has a genuine complete empty vector, never null");
  const apiDefinitionGolden = scalarGolden(apiDefinition, "def");
  const parameterGolden = recordGolden("TypeParameterIdentity", { owner: apiDefinitionGolden, index: scalarGolden(0) });
  const advertisedParameterGolden = recordGolden("TypeParameterIdentity", { owner: definitionGolden, index: scalarGolden(0) });
  const bindings = value => recordGolden("BindingVector", { classBindings: emptyGolden,
    methodBindings: arrayGolden([recordGolden("rigid", { parameter: value }, "rigid")]), capturedBindings: emptyGolden, selfBindings: emptyGolden });
  const bodyless = recordGolden("ApplicationDecision", { candidate: scalarGolden(0), advertised: endpointGolden(),
    api: recordGolden("HirCallableEndpoint", { declaration: apiDefinitionGolden, role: scalarGolden("api-signature"),
      signature: scalarGolden(1, "sig"), body: nullGolden }), bindings: bindings(advertisedParameterGolden),
    implementationBindings: bindings(parameterGolden), parameters: emptyGolden,
    completion: recordGolden("CompletionEndpoint", { signature: scalarGolden(1, "sig"), completion: typeGolden,
      yielded: nullGolden, sent: nullGolden }), result: typeGolden });
  fullEqual(bodyless.value, application, "independent complete wire fixture names both actual environments");
  const golden = solutionGolden([recordGolden("call", { application: bodyless, operation: nullGolden }, "call")]);
  assertRoundTrip("Solution", golden.value, golden.text, "bodyless generic API environment is preserved, not erased by activation");
});

test("all four formal mapping dispositions use the real signature and authored argument domain", () => {
  const initializer = `B[D[${moduleIdentity};run/defaulted];default-argument;0]`;
  const formal = (name, kind, passing = "by-value") => ({ declaration: `D[${moduleIdentity};run/${name}]`,
    kind, type: 0, passing, initializer: kind === "default" ? initializer : null });
  const signatureValue = { ...signature, parameters: [formal("required", "required"), formal("defaulted", "default"),
    formal("optional", "optional"), formal("remaining", "rest", "byref-readwrite")] };
  const arguments_ = [
    { occurrence: { body, node: 1 }, kind: "spread", type: 0, tuple: [0, 0], closure: null },
    { occurrence: { body, node: 2 }, kind: "value", type: 0, tuple: null, closure: null },
    { occurrence: { body, node: 3 }, kind: "spread", type: 0, tuple: [0], closure: null },
  ];
  const candidate = { ordinal: 0, declaration: definition, appliedSignature: { kind: "available", value: 0 },
    bindings: { kind: "unavailable", reason: "not-provided" }, conditionalFailure: { kind: "available", value: null }, contributions: [] };
  const raw = { captured: captureGolden.value, permissionScope: null, callee: 0, receiver: null,
    typeArguments: [], arguments: arguments_, candidates: 0, result: 0 };
  const set = { ...constraintSet([{ kind: "call", occurrence, application: raw }]), candidates: [{ id: 0, candidates: [candidate] }] };
  const parameters = [{ kind: "argument", parameter: 0, argument: 0, component: 0, passing: "by-value" },
    { kind: "default", parameter: 1, initializer }, { kind: "omitted", parameter: 2, type: 0 },
    { kind: "rest", parameter: 3, arguments: [1, 2], passing: "byref-readwrite" }];
  const solved = values => ({ ...completeSolution(), constraints: [{ constraint: { body, index: 0 }, decision: {
    kind: "call", application: { ...applicationGolden().value, parameters: values }, operation: null,
  } }] });
  const input = { constraints: [set], solution: solved(parameters), bindingScopes: [emptyScope, emptyScope],
    declarations: [[definition, { ...declarationFacts, parameterCount: 4 }]], nodes: [{ owner: source, ids: [0, 1, 2, 3] }],
    types: { terms: [{ kind: "primitive", primitive: "int32" }], signatures: [signatureValue] } };
  const opposites = [
    [0, { ...parameters[0], component: 2 }, "arguments"],
    [0, { ...parameters[0], component: -0 }, "arguments"],
    [0, { ...parameters[0], argument: 3 }, "arguments"],
    [0, { ...parameters[0], passing: "byref-readwrite" }, "formal"],
    [1, { ...parameters[1], initializer: body }, "formal"],
    [2, { kind: "default", parameter: 2, initializer }, "formal"],
    [3, { ...parameters[3], passing: "by-value" }, "formal"],
    [3, { ...parameters[3], arguments: [2, 1] }, "arguments"],
    [3, { ...parameters[3], arguments: [3] }, "arguments"],
  ];
  for (const [index, value, field] of opposites) {
    const changed = parameters.map((parameter, ordinal) => ordinal === index ? value : parameter);
    ruleCase("parameter-mapping-total", input, { ...input, solution: solved(changed) },
      [violation("parameter-mapping-total", constraintSite(0), field)], `${value.kind} exact ${field} opposite`);
  }
  for (const [first, fields] of [
    [NaN, ["parameters", "formal", "parameters"]],
    [-0, ["parameters"]],
    [0, []],
  ]) {
    const changed = [{ ...parameters[0], parameter: first }, ...parameters.slice(1)];
    fullEqual(product.verifyInference(verificationInput({ ...input, solution: solved(changed) })),
      fields.map(field => violation("parameter-mapping-total", constraintSite(0), field)),
      "a malformed formal predecessor preserves the entire four-formal outcome");
  }
  for (const [indexes, fields] of [
    [[0, NaN, 2, 3], ["parameters", "formal", "parameters"]],
    [[0, 1, 2, NaN], ["parameters", "formal"]],
    [[NaN, NaN, 2, 3], ["parameters", "formal", "parameters", "formal", "parameters"]],
    [[-0, 0, 2, 3], ["parameters", "formal"]],
    [[0, -0, 2, 3], ["parameters", "formal"]],
    [[0, 0, 2, 3], ["parameters", "formal"]],
  ]) {
    const changed = parameters.map((parameter, index) => ({ ...parameter, parameter: indexes[index] }));
    fullEqual(product.verifyInference(verificationInput({ ...input, solution: solved(changed) })),
      fields.map(field => violation("parameter-mapping-total", constraintSite(0), field)),
      "formal order remains total through middle, terminal and equal NaN keys");
  }
  for (const [arguments_, errors] of [
    [[NaN, 2], 2], [[2, NaN], 1], [[NaN, NaN], 2],
    [[-0, 0], 1], [[0, -0], 1], [[0, 0], 1], [[1, 2], 0], [[2, 1], 1],
  ]) {
    const changed = [...parameters.slice(0, 3), { ...parameters[3], arguments: arguments_ }];
    fullEqual(product.verifyInference(verificationInput({ ...input, solution: solved(changed) })),
      Array.from({ length: errors }, () => violation("parameter-mapping-total", constraintSite(0), "arguments")),
      "rest order retains every independent invalid ordinal and successor finding");
  }
});

test("inferred signature parts preserve every actual owner and indexed initializer slot", () => {
  const parts = ["return", "yield", "variable", "field"].map(kind => ({ definition, part: { kind } }));
  parts.push({ definition, part: { kind: "parameter-initializer", index: 0 } },
    { definition, part: { kind: "parameter-initializer", index: 1 } });
  const variables = parts.map((part, id) => ({ kind: "signature", id, occurrence, signature: part }));
  const parameters = [0, 1].map(index => {
    const declaration = `D[${moduleIdentity};run/argument${index}]`;
    return { declaration, kind: "default", type: 0, passing: "by-value", initializer: `B[${declaration};default-argument;0]` };
  });
  const input = { group: { id: group, bodies: [body], signatures: parts }, constraints: [constraintSet([], variables)],
    declarations: [[definition, { ...declarationFacts, parameterCount: 2 }]],
    types: { terms: [{ kind: "primitive", primitive: "int32" }], signatures: [{ ...signature, parameters }] } };
  fullEqual(product.verifyInference(verificationInput(input)), [], "all distinct parts retain their actual declaration slots");
  const missing = { definition, part: { kind: "parameter-initializer", index: 2 } };
  ruleCase("inferred-part-identity", input, { ...input, group: { ...input.group, signatures: [...parts.slice(0, -1), missing] },
    constraints: [constraintSet([], [...variables.slice(0, -1), { ...variables.at(-1), signature: missing }])] },
  [violation("inferred-part-identity", groupSite, "declaration")], "a third initializer is outside the actual two-parameter declaration");
  const returned = { definition, part: { kind: "return" } };
  ruleCase("inferred-part-identity", { group: { id: group, bodies: [body], signatures: [returned] },
    constraints: [constraintSet([], [{ kind: "signature", id: 0, occurrence, signature: returned }])] },
  { constraints: [constraintSet([], [{ kind: "signature", id: 0, occurrence, signature: returned }])] },
  [violation("inferred-part-identity", variableSite(0), "signature")], "the actual inferred part inventory is required independently of declaration existence");
});

test("saved deferred inputs correlate with their actual originating constraint, not an impossible union-shape mismatch", () => {
  const flow = { kind: "flow", occurrence, from: 0, to: 0, role: "initialization", bindings: emptyBindings };
  const invocation = { rule: "embed", input: { context: contextGolden.value, from: evidence(), to: evidence(), role: "initialization" } };
  const solved = value => ({ ...completeSolution(), constraints: [{ constraint: { body, index: 0 },
    decision: { kind: "deferred", deferred: { invocation: value, result: 0 } } }] });
  const input = { constraints: [constraintSet([flow])], bindingScopes: [emptyScope, emptyScope], solution: solved(invocation) };
  ruleCase("deferred-invocation", input, { ...input, solution: solved({ ...invocation, input: { ...invocation.input, role: "assignment" } }) },
    [violation("deferred-invocation", constraintSite(0), "input")]);
  ruleCase("constraint-reference", input, { ...input, bindingScopes: [emptyScope, emptyScope, emptyScope],
    solution: { ...solved(invocation), constraints: [...solved(invocation).constraints,
      { ...solved(invocation).constraints[0], constraint: { body, index: 1 } }] } },
    [violation("constraint-reference", constraintSite(1), "constraint")],
    "an extra saved deferred record cannot manufacture a missing originating constraint");
});

test("raw-to-final type instantiation is not approximated by saved ID equality", () => {
  const types = { terms: [{ kind: "primitive", primitive: "int32" }, { kind: "open", group, variable: 0 },
    { kind: "array", element: 1, readonly: false }, { kind: "array", element: 0, readonly: false },
    { kind: "union", members: [0, 1] }], signatures: [signature] };
  for (const [raw, saved, category] of [[2, 3, "object"], [4, 0, "number"]]) {
    const flow = { kind: "flow", occurrence, from: raw, to: saved, role: "initialization", bindings: emptyBindings };
    const value = { ...evidence(saved), category: { kind: "known", category } };
    const invocation = { rule: "embed", input: { context: contextGolden.value, from: value, to: value, role: "initialization" } };
    const solution = { ...completeSolution(), variables: [{ variable: 0, value: evidence() }], constraints: [
      { constraint: { body, index: 0 }, decision: { kind: "deferred", deferred: { invocation, result: saved } } },
    ] };
    const input = { constraints: [constraintSet([flow], [localVariable(0)])], types,
      bindingScopes: [emptyScope, emptyScope], solution };
    fullEqual(product.verifyInference(verificationInput(input)), [], "structural verifier does not substitute, canonicalize or reject a normalized saved type");
    const changed = { ...solution, constraints: [{ ...solution.constraints[0], decision: { kind: "deferred", deferred: {
      invocation: { ...invocation, input: { ...invocation.input, context: { ...invocation.input.context, occurrence: { body, node: 1 } } } }, result: saved,
    } } }] };
    ruleCase("deferred-invocation", input, { ...input, solution: changed, nodes: [{ owner: source, ids: [0, 1] }] },
      [violation("deferred-invocation", constraintSite(0), "occurrence")], "actual saved origin remains independently checked");
  }
  const protocol = { kind: "protocol", occurrence, protocol: "iterate", asynchronous: false,
    subject: 2, operands: [], result: 1, bindings: emptyBindings };
  const operation = { kind: "selected", operation: { kind: "protocol", protocol: "iterate", asynchronous: false,
    steps: [], value: 0, completion: 0, yielded: null, sent: null, thrown: 0 }, operands: [], result: 0 };
  fullEqual(product.verifyInference(verificationInput({ constraints: [constraintSet([protocol], [localVariable(0)])], types,
    bindingScopes: [emptyScope], solution: { ...completeSolution(), variables: [{ variable: 0, value: evidence() }],
      constraints: [{ constraint: { body, index: 0 }, decision: { kind: "protocol", operation } }] } })), [],
  "protocol channel structure does not compare a raw open result ID with the saved finalized type ID");
});

test("all thirteen deferred rule families retain their independently observable structural correlations", () => {
  const context = contextGolden.value;
  const value = evidence();
  const key = { kind: "text", value: "member" };
  const equality = { kind: "eq", occurrence, left: 0, right: 0 };
  const flow = { kind: "flow", occurrence, from: 0, to: 0, role: "initialization", bindings: emptyBindings };
  const member = { kind: "member", occurrence, receiver: 0, key, access: "read", result: 0, origins: [], bindings: emptyBindings };
  const index = { kind: "index", occurrence, receiver: 0, key: 0, access: "read", result: 0, bindings: emptyBindings };
  const construction = { kind: "construct-literal", occurrence, construction: "object",
    parts: [{ kind: "property", occurrence: { body, node: 1 }, key, type: 0 }], destination: null, result: 0 };
  const candidate = { ordinal: 0, declaration: definition, appliedSignature: { kind: "available", value: 0 },
    bindings: { kind: "unavailable", reason: "not-provided" }, conditionalFailure: { kind: "available", value: null }, contributions: [] };
  const application = { captured: captureGolden.value, permissionScope: occurrence, callee: 0, receiver: null,
    typeArguments: [], arguments: [], candidates: 0, result: 0 };
  const call = { kind: "call", occurrence, application };
  const endpoint = { ordinal: 0, declaration: definition, advertised: declarationFacts.endpoints[0],
    api: declarationFacts.endpoints[1], bindings: emptyBindings, conditionalFailure: null };
  const actualArguments = [
    { kind: "value", occurrence, type: 0, tuple: null, closure: null },
    { kind: "spread", occurrence: { body, node: 1 }, type: 0, tuple: [0, 0], closure: null },
  ];
  const candidateCall = { ...call, application: { ...application, typeArguments: [0, 0], arguments: actualArguments } };
  const candidateInput = { kind: "call", context, callee: value, receiver: null, typeArguments: [value, value],
    arguments: actualArguments.map(argument => ({ kind: argument.kind, occurrence: argument.occurrence,
      value, tuple: argument.tuple === null ? null : [value, value] })), candidates: [endpoint] };
  const operator = { kind: "op", occurrence, operator: "+", operands: [0, 0], result: 0, permissionScope: occurrence };
  const literalValue = { kind: "number", token: "1", value: { numerator: 1n, denominator: 1n, negativeZero: false } };
  const literal = { kind: "literal", occurrence, value: literalValue, destination: 0 };
  const protocol = { kind: "protocol", occurrence, protocol: "iterate", asynchronous: false, subject: 0,
    operands: [0], result: 0, bindings: emptyBindings };
  const refinement = { kind: "refine", occurrence, source: 0, checked: 0, result: 0 };
  const changedContext = { ...context, occurrence: { body, node: 1 } };
  const rows = [
    [flow, { rule: "embed", input: { context, from: value, to: value, role: "initialization" } },
      { context, from: value, to: value, role: "assignment" }, [emptyScope, emptyScope]],
    [flow, { rule: "domain-fit", input: { context, value, domain: value } },
      { context: changedContext, value, domain: value }, [emptyScope, emptyScope]],
    [equality, { rule: "memory-equivalent", input: { context, left: value, right: value } },
      { context: changedContext, left: value, right: value }, [emptyScope]],
    [member, { rule: "member", input: { context, receiver: value, key, access: "read", origins: [] } },
      { context, receiver: value, key, access: "write", origins: [] }, [emptyScope, emptyScope]],
    [index, { rule: "index", input: { context, receiver: value, key: value, access: "read" } },
      { context, receiver: value, key: value, access: "write" }, [emptyScope, emptyScope]],
    [construction, { rule: "construct-literal", input: { context, construction: "object", destination: null,
      parts: [{ kind: "property", occurrence: { body, node: 1 }, key, value }] } },
    { context, construction: "object", destination: null, parts: [] }, [emptyScope]],
    [candidateCall, { rule: "candidate", input: candidateInput }, { ...candidateInput, candidates: [] }, [emptyScope, emptyScope]],
    [operator, { rule: "operator", input: { context, operator: "+", operands: [value, value], permissionScope: occurrence } },
      { context, operator: "+", operands: [value], permissionScope: occurrence }, [emptyScope]],
    [literal, { rule: "literal-fit", input: { context, literal: literalValue, destination: value } },
      { context, literal: { ...literalValue, token: "2", value: { ...literalValue.value, numerator: 2n } }, destination: value }, [emptyScope]],
    [protocol, { rule: "protocol", input: { kind: "iterate", context, asynchronous: false, subject: value,
      operands: [value], completion: null, yielded: null, sent: null, thrown: value } },
    { kind: "iterate", context, asynchronous: true, subject: value, operands: [value], completion: null, yielded: null, sent: null, thrown: value },
    [emptyScope, emptyScope]],
    [refinement, { rule: "refinement", input: { context, source: value, checked: value } },
      { context: changedContext, source: value, checked: value }, [emptyScope]],
    [call, { rule: "library", input: { context, declaration: definition, receiver: null, arguments: [], result: value } },
      { context: changedContext, declaration: definition, receiver: null, arguments: [], result: value }, [emptyScope]],
    [call, { rule: "core", input: { context, captured: captureGolden.value, declaration: definition, operands: [], result: value, permissionScope: occurrence } },
      { context, captured: captureGolden.value, declaration: definition, operands: [], result: value, permissionScope: { body, node: 1 } }, [emptyScope]],
  ];
  const observed = new Set();
  const expectedFields = ["input", "occurrence", "occurrence", "input", "input", "input", "input", "input", "input", "input", "occurrence", "occurrence", "input"];
  for (const [row, [constraint, invocation, opposite, bindingScopes]] of rows.entries()) {
    const set = { ...constraintSet([constraint]), candidates: constraint.kind === "call" ? [{ id: 0, candidates: [candidate] }] : [] };
    const solved = saved => ({ ...completeSolution(), constraints: [{ constraint: { body, index: 0 }, decision: {
      kind: "deferred", deferred: { invocation: saved, result: 0 },
    } }] });
    const input = { constraints: [set], bindingScopes, solution: solved(invocation), nodes: [{ owner: source, ids: [0, 1] }] };
    const changed = { ...invocation, input: opposite };
    const invalidScopes = invocation.rule === "candidate" ? [emptyScope] : bindingScopes;
    ruleCase("deferred-invocation", input, { ...input, bindingScopes: invalidScopes, solution: solved(changed) },
      [violation("deferred-invocation", constraintSite(0), expectedFields[row])], `structural ${invocation.rule}`);
    if (invocation.rule === "domain-fit")
      fullEqual(product.verifyInference(verificationInput({ ...input,
        constraints: [constraintSet([equality])], bindingScopes: [emptyScope] })), [],
        "a saved domain-fit relation also belongs to a genuine equality constraint");
    if (invocation.rule === "candidate") {
      ruleCase("deferred-invocation", input, { ...input,
        constraints: [{ ...set, constraints: [member] }], bindingScopes: [emptyScope, emptyScope, emptyScope] },
      [violation("deferred-invocation", constraintSite(0), "input")],
      "a nonaccessor saved call candidate cannot replace the actual member-constraint dispatch");
      fullEqual(product.verifyInference(verificationInput({ ...input,
        constraints: [{ ...set, constraints: [{ ...constraint, kind: "construct" }] }],
        solution: solved({ ...invocation, input: { ...invocation.input, kind: "construct" } }) })), [],
      "the same complete candidate associations retain a genuine construct dispatch");
    }
    observed.add(invocation.rule);
  }
  assert.equal(observed.size, 13);
});

test("saved accessor and helper inputs use genuine endpoint and declaration facts without inventing raw dispatch", () => {
  const member = { kind: "member", occurrence, receiver: 0, key: { kind: "text", value: "field" },
    access: "read", result: 0, origins: [], bindings: emptyBindings };
  const endpoint = { ordinal: 0, declaration: definition, advertised: declarationFacts.endpoints[0],
    api: declarationFacts.endpoints[1], bindings: emptyBindings, conditionalFailure: null };
  const solved = invocation => ({ ...completeSolution(), constraints: [{ constraint: { body, index: 0 },
    decision: { kind: "deferred", deferred: { invocation, result: 0 } } }] });
  for (const kind of ["accessor-get", "accessor-set"]) {
    const invocation = { rule: "candidate", input: { kind, context: contextGolden.value, callee: evidence(),
      receiver: evidence(), typeArguments: [], arguments: kind === "accessor-get" ? [] : [
        { occurrence, kind: "value", value: evidence(), tuple: null },
      ], candidates: [endpoint] } };
    const input = { constraints: [constraintSet([member])], solution: solved(invocation), bindingScopes: [emptyScope, emptyScope, emptyScope] };
    const invalid = { ...invocation, input: { ...invocation.input, candidates: [{ ...endpoint, api: { ...endpoint.api, signature: 1 } }] } };
    const types = { terms: [{ kind: "primitive", primitive: "int32" }], signatures: [signature,
      { ...signature, id: 1, declaration: null, owner: null }] };
    ruleCase("deferred-invocation", { ...input, types }, { ...input, types, solution: solved(invalid) },
      [violation("deferred-invocation", constraintSite(0), "input")], `${kind} actual endpoint association`);
  }
  const helper = `D[${moduleIdentity};nativeHelper]`;
  const helperSignature = { ...signature, id: 1, declaration: helper, owner: null, parameters: [0, 1].map(index => ({
    declaration: `D[${moduleIdentity};nativeHelper/argument${index}]`, kind: "required", type: 0, passing: "by-value", initializer: null,
  })) };
  const helperFacts = { scope: emptyScope, parameterCount: 2, endpoints: [
    { declaration: helper, role: "advertised", signature: 1, body: null },
    { declaration: helper, role: "api-signature", signature: 1, body: null },
  ] };
  for (const rule of ["library", "core"]) {
    const invocation = { rule, input: rule === "library" ? { context: contextGolden.value, declaration: helper,
      receiver: evidence(), arguments: [evidence(), evidence()], result: evidence() }
      : { context: contextGolden.value, captured: captureGolden.value, declaration: helper,
        operands: [evidence(), evidence()], result: evidence(), permissionScope: null } };
    const input = { constraints: [constraintSet([member])], solution: solved(invocation), bindingScopes: [emptyScope, emptyScope],
      declarations: [[definition, declarationFacts], [helper, helperFacts]],
      types: { terms: [{ kind: "primitive", primitive: "int32" }], signatures: [signature, helperSignature] } };
    const invalid = { ...invocation, input: { ...invocation.input, declaration: `D[${moduleIdentity};missingHelper]` } };
    ruleCase("qualified-reference", input, { ...input, solution: solved(invalid) },
      [violation("qualified-reference", constraintSite(0), "declarations")],
    `${rule} genuine helper identity, not authored parent arity`);
  }
});

test("discharge obligations retain the complete original diagnostic and positional proof association", () => {
  const equality = { kind: "eq", occurrence, left: 0, right: 0 };
  const discharge = { kind: "discharge", occurrence, checkerDiagnostic: 4, obligations: [{ body, index: 0 }] };
  const proof = { steps: [{ from: componentGolden.value, to: componentGolden.value, rule: "identity", premises: [] }], conclusion: 0 };
  const obligation = { ordinal: 0, rule: "memory-equivalent", evidence: proof };
  const solved = value => ({ ...completeSolution(), constraints: [
    { constraint: { body, index: 0 }, decision: { kind: "eq", equivalent: true } },
    { constraint: { body, index: 1 }, decision: { kind: "discharge", proof: value } },
  ] });
  const complete = { checkerDiagnostic: 4, obligations: [obligation] };
  const input = { constraints: [constraintSet([equality, discharge])], solution: solved(complete) };
  for (const changed of [{ ...complete, checkerDiagnostic: 5 }, { ...complete, obligations: [] }])
    ruleCase("proof-reference", input, { ...input, solution: solved(changed) },
      [violation("proof-reference", constraintSite(1), "obligations")], "complete discharge references");
  ruleCase("proof-reference", input, { ...input, solution: solved({ ...complete, obligations: [{ ...obligation, ordinal: 1 }] }) },
    [violation("proof-reference", constraintSite(1), "ordinal")], "positional discharge obligation");
});

test("member declarations and accessor endpoints use actual independent declaration facts", () => {
  const constraint = { kind: "member", occurrence, receiver: 0, key: { kind: "text", value: "member" },
    access: "read", result: 0, origins: [], bindings: emptyBindings };
  const member = { key: constraint.key, origins: [], selectedDeclarations: [definition], primary: definition,
    read: 0, write: null, getter: declarationFacts.endpoints[1], setter: null, bindings: emptyBindings };
  const solved = value => ({ ...completeSolution(), constraints: [{ constraint: { body, index: 0 },
    decision: { kind: "member", member: value } }] });
  const input = { constraints: [constraintSet([constraint])], bindingScopes: [emptyScope, emptyScope], solution: solved(member) };
  const foreign = `D[${moduleIdentity};foreign]`;
  ruleCase("endpoint-agreement", input, { ...input, solution: solved({ ...member, primary: foreign }) },
    [violation("endpoint-agreement", constraintSite(0), "primary"), violation("qualified-reference", constraintSite(0), "declarations")], "actual selected primary");
  ruleCase("qualified-reference", input, { ...input, solution: solved({ ...member, selectedDeclarations: [definition, foreign] }) },
    [violation("qualified-reference", constraintSite(0), "declarations")], "unknown selected declaration");
  for (const field of ["getter", "setter"]) ruleCase("endpoint-agreement", input, { ...input,
    solution: solved({ ...member, [field]: { ...declarationFacts.endpoints[1], body: null } }) },
  [violation("endpoint-agreement", constraintSite(0), field)], `actual ${field} endpoint`);
  ruleCase("endpoint-agreement", input, { ...input,
    solution: solved({ ...member, getter: { ...member.getter, declaration: foreign } }) }, [
    violation("endpoint-agreement", constraintSite(0), "getter"),
    violation("qualified-reference", constraintSite(0), "declarations"),
  ], "an absent actual accessor declaration is not an empty successful endpoint association");
});

function assertRoundTrip(family, value, text, label) {
  const printed = product[`print${family}`](value);
  const equal = printed === text;
  const message = `${label}: complete independently authored text`;
  assert.equal(equal, true, equal ? message : comparisonFailure(printed, text, message));
  const parsed = product[`parse${family}`](text);
  fullEqual(parsed, { kind: "parsed", value }, `${label}: complete parsed value`);
  exercisedPorts.add(`print${family}`); exercisedPorts.add(`parse${family}`);
  resultArms.public.add(`parse${family}:parsed`);
  const records = [value];
  for (let record = records.pop(); record !== undefined; record = records.pop()) {
    if (record === null || typeof record !== "object") continue;
    if (record.kind === "string-operator") nestedArms.stringOperators.add(record.operator);
    if (record.kind === "boolean-operator") nestedArms.booleanOperators.add(record.operator);
    if (record.kind === "native-operator") { nestedArms.nativeOperators.add(record.operator); nestedArms.nativeCarriers.add(record.carrier); }
    if (record.kind === "bigint-operator") nestedArms.bigintOperators.add(record.operator);
    if (record.kind === "known") nestedArms.knownCategories.add(record.category);
    if (["text", "number", "symbol"].includes(record.key?.kind)) nestedArms.memberKeys.add(record.key.kind);
    for (const child of Array.isArray(record) ? record : Object.values(record)) records.push(child);
  }
  if (family === "Constraints") {
    for (const constraint of value.constraints) inputArms.constraints.add(constraint.kind);
    for (const variable of value.variables) inputArms.variables.add(variable.kind);
  } else if (family === "Contributions") {
    for (const contribution of value) inputArms.contributions.add(contribution.key.role.kind);
  } else if (family === "Solution") {
    for (const constraint of value.constraints) resultArms.decisions.add(constraint.decision.kind);
    const pending = [value];
    for (let current = pending.pop(); current !== undefined; current = pending.pop()) {
      if (current === null || typeof current !== "object") continue;
      if (current.kind === "selected" && current.operation !== undefined) resultArms.operations.add(current.operation.kind);
      if (typeof current.invocation?.rule === "string") resultArms.deferred.add(current.invocation.rule);
      for (const child of Array.isArray(current) ? current : Object.values(current)) pending.push(child);
    }
  }
}

function scalarGolden(value, prefix = "") {
  const literal = typeof value === "bigint" ? `${value}n` : Object.is(value, -0) ? "-0"
    : Number.isNaN(value) ? "NaN" : value === Infinity ? "+Infinity" : value === -Infinity ? "-Infinity" : JSON.stringify(value);
  return { value, text: `${prefix === "" ? "" : `${prefix}:`}${literal}` };
}

function arrayGolden(values) {
  return { value: values.map(value => value.value), text: `[${values.map(value => value.text).join(", ")}]` };
}

function recordGolden(label, fields, kind = null) {
  return { value: Object.fromEntries([...(kind === null ? [] : [["kind", kind]]), ...Object.entries(fields).map(([name, item]) => [name, item.value])]),
    text: `${label}(${Object.entries(fields).map(([name, item]) => `${name}=${item.text}`).join(", ")})` };
}

const nullGolden = scalarGolden(null);
const emptyGolden = arrayGolden([]);
const bodyGolden = scalarGolden(body, "body");
const definitionGolden = scalarGolden(definition, "def");
const groupGolden = scalarGolden(group, "group");
const typeGolden = scalarGolden(0, "t");
const signatureGolden = scalarGolden(0, "sig");
const nodeGolden = recordGolden("NodeRef", { body: bodyGolden, node: scalarGolden(0, "n") });
const sourceGolden = recordGolden("body", { value: nodeGolden }, "body");
const bindingGolden = recordGolden("BindingVector", { classBindings: emptyGolden, methodBindings: emptyGolden,
  capturedBindings: emptyGolden, selfBindings: emptyGolden });
const componentGolden = recordGolden("TypeComponent", { root: sourceGolden, path: emptyGolden });
const categoryGolden = recordGolden("known", { category: scalarGolden("number") }, "known");
const evidenceGolden = recordGolden("TypeEvidence", { type: typeGolden, component: sourceGolden, category: categoryGolden,
  numeric: nullGolden, sum: nullGolden, nominal: nullGolden, pointer: nullGolden });
const originGolden = recordGolden("Origin", { module: scalarGolden(moduleIdentity, "mod"), start: scalarGolden(0),
  length: scalarGolden(1), derived: emptyGolden });
const contextGolden = recordGolden("RuleContext", { occurrence: nodeGolden, origin: originGolden, bindings: bindingGolden });
const unavailableGolden = recordGolden("unavailable", { reason: scalarGolden("not-provided") }, "unavailable");
const captureGolden = recordGolden("HirCoreCapture", { provider: unavailableGolden, markers: unavailableGolden,
  pointerType: unavailableGolden, pointerOperation: unavailableGolden, fieldBinding: unavailableGolden, recordBinding: unavailableGolden, attribute: unavailableGolden,
  safety: unavailableGolden, argumentPassing: unavailableGolden, flowState: unavailableGolden });
const textKeyGolden = recordGolden("text", { value: scalarGolden("item") }, "text");
const referenceGolden = recordGolden("ConstraintRef", { body: bodyGolden, index: scalarGolden(0) });
const literalGolden = recordGolden("string", { value: scalarGolden("literal") }, "string");
const identityGolden = recordGolden("identity", {}, "identity");
const proofGolden = recordGolden("EmbeddingProof", { steps: arrayGolden([
  recordGolden("CorrespondenceStep", { from: componentGolden, to: componentGolden, rule: scalarGolden("identity"), premises: emptyGolden }),
  recordGolden("CorrespondenceStep", { from: componentGolden, to: componentGolden, rule: scalarGolden("shape"), premises: arrayGolden([scalarGolden(0)]) }),
]), conclusion: scalarGolden(1) });

function endpointGolden(role = "advertised", endpointBody = nullGolden) {
  return recordGolden("HirCallableEndpoint", { declaration: definitionGolden, role: scalarGolden(role),
    signature: signatureGolden, body: endpointBody });
}

function constraintsGolden(constraints, variables = [], candidates = [], evidenceValues = []) {
  return recordGolden("ConstraintSet", { group: groupGolden, body: bodyGolden, variables: arrayGolden(variables),
    candidates: arrayGolden(candidates), evidence: arrayGolden(evidenceValues), constraints: arrayGolden(constraints) });
}

function solutionGolden(decisions, variables = [], checks = [], bodies = []) {
  return recordGolden("Solution", { group: groupGolden, variables: arrayGolden(variables), constraints: arrayGolden(decisions.map((decision, index) =>
    recordGolden("SolvedConstraint", { constraint: recordGolden("ConstraintRef", { body: bodyGolden, index: scalarGolden(index) }), decision }))),
  checks: arrayGolden(checks), bodies: arrayGolden(bodies) });
}

function applicationGolden(parameters = []) {
  return recordGolden("ApplicationDecision", { candidate: scalarGolden(0), advertised: endpointGolden(),
    api: endpointGolden("api-body", bodyGolden), bindings: bindingGolden, implementationBindings: bindingGolden,
    parameters: arrayGolden(parameters), completion: recordGolden("CompletionEndpoint", { signature: signatureGolden,
      completion: typeGolden, yielded: nullGolden, sent: nullGolden }), result: typeGolden });
}

function operationGolden(operation) {
  return recordGolden("selected", { operation, operands: arrayGolden([typeGolden]), result: typeGolden }, "selected");
}

function deferredGolden(rule, input) {
  return recordGolden("DeferredDecision", { invocation: recordGolden("DeferredInvocation", { rule: scalarGolden(rule), input }), result: typeGolden });
}

test("final values, both bound directions, all check outcomes and body channels have complete codec vectors", () => {
  const contribution = recordGolden("ContributionKey", { node: nodeGolden, candidate: nullGolden,
    role: recordGolden("flow", {}, "flow") });
  const checks = [];
  const outcomes = [
    recordGolden("satisfied", { embedding: identityGolden }, "satisfied"),
    ...["binder-constraint", "literal-inexact", "conflicting-destinations", "accumulator-widening", "signature-use-demand"]
      .map(reason => recordGolden("refused", { reason: scalarGolden(reason) }, "refused")),
  ];
  for (const direction of ["producer", "demand"])
    for (const outcome of outcomes) checks.push(recordGolden("RecordedCheck", {
      variable: scalarGolden(0), contribution,
      bound: recordGolden(direction, { contribution, variable: scalarGolden(0), value: evidenceGolden }, direction),
      outcome,
    }));
  const bodies = [nullGolden, typeGolden].map(channel => recordGolden("BodyTyping", {
    body: bodyGolden, signature: signatureGolden, completion: typeGolden, yielded: channel, sent: channel,
  }));
  const golden = solutionGolden([], [recordGolden("FinalVariable", { variable: scalarGolden(0), value: evidenceGolden })],
    checks, bodies);
  assertRoundTrip("Solution", golden.value, golden.text, "complete final variable/check/body records");
});

test("every original signature part retains its complete group codec value", () => {
  const parts = ["return", "yield", "variable", "field"].map(kind => recordGolden(kind, {}, kind));
  parts.push(recordGolden("parameter-initializer", { index: scalarGolden(2) }, "parameter-initializer"));
  const golden = recordGolden("InferenceGroup", { id: groupGolden, bodies: arrayGolden([bodyGolden]),
    signatures: arrayGolden(parts.map(part => recordGolden("InferredSignaturePart", { definition: definitionGolden, part }))) });
  assertRoundTrip("InferenceGroup", golden.value, golden.text, "all signature part constructors");
});

test("every closed constraint and variable arm has an independently authored complete wire value", () => {
  const application = recordGolden("ApplicationConstraintData", { captured: captureGolden, permissionScope: nodeGolden,
    callee: typeGolden, receiver: typeGolden, typeArguments: arrayGolden([typeGolden]), arguments: arrayGolden([
      recordGolden("value", { occurrence: nodeGolden, type: typeGolden, tuple: nullGolden, closure: nullGolden }, "value"),
      recordGolden("spread", { occurrence: nodeGolden, type: typeGolden, tuple: arrayGolden([typeGolden, typeGolden]), closure: bodyGolden }, "spread"),
    ]), candidates: scalarGolden(0, "cand"), result: typeGolden });
  const constraints = [
    recordGolden("eq", { occurrence: nodeGolden, left: typeGolden, right: typeGolden }, "eq"),
    recordGolden("flow", { occurrence: nodeGolden, from: typeGolden, to: typeGolden, role: scalarGolden("initialization"), bindings: bindingGolden }, "flow"),
    recordGolden("literal", { occurrence: nodeGolden, value: literalGolden, destination: typeGolden }, "literal"),
    recordGolden("op", { occurrence: nodeGolden, operator: scalarGolden("+"), operands: arrayGolden([typeGolden, typeGolden]), result: typeGolden, permissionScope: nullGolden }, "op"),
    recordGolden("member", { occurrence: nodeGolden, receiver: typeGolden, key: textKeyGolden, access: scalarGolden("read"), result: typeGolden, origins: emptyGolden, bindings: bindingGolden }, "member"),
    recordGolden("index", { occurrence: nodeGolden, receiver: typeGolden, key: typeGolden, access: scalarGolden("write"), result: typeGolden, bindings: bindingGolden }, "index"),
    recordGolden("call", { occurrence: nodeGolden, application }, "call"), recordGolden("construct", { occurrence: nodeGolden, application }, "construct"),
    recordGolden("construct-literal", { occurrence: nodeGolden, construction: scalarGolden("object"), parts: arrayGolden([
      recordGolden("element", { occurrence: nodeGolden, type: typeGolden }, "element"),
      recordGolden("property", { occurrence: nodeGolden, key: textKeyGolden, type: typeGolden }, "property"),
      recordGolden("spread", { occurrence: nodeGolden, type: typeGolden }, "spread"),
    ]), destination: nullGolden, result: typeGolden }, "construct-literal"),
    recordGolden("protocol", { occurrence: nodeGolden, protocol: scalarGolden("iterate"), asynchronous: scalarGolden(false), subject: typeGolden, operands: emptyGolden, result: typeGolden, bindings: bindingGolden }, "protocol"),
    recordGolden("refine", { occurrence: nodeGolden, source: typeGolden, checked: typeGolden, result: typeGolden }, "refine"),
    recordGolden("discharge", { occurrence: nodeGolden, checkerDiagnostic: scalarGolden(9910000), obligations: arrayGolden([referenceGolden]) }, "discharge"),
    recordGolden("default", { occurrence: nodeGolden, variable: scalarGolden(0), rule: scalarGolden("local-producers"), type: nullGolden }, "default"),
  ];
  const parameter = recordGolden("TypeParameterIdentity", { owner: definitionGolden, index: scalarGolden(0) });
  const variables = [
    recordGolden("signature", { id: scalarGolden(0), occurrence: nodeGolden, signature: recordGolden("InferredSignaturePart", {
      definition: definitionGolden, part: recordGolden("return", {}, "return") }) }, "signature"),
    recordGolden("local", { id: scalarGolden(1), occurrence: nodeGolden, local: recordGolden("LocalRef", { body: bodyGolden, local: scalarGolden(0, "l") }) }, "local"),
    ...["class", "method", "captured"].map((family, index) => recordGolden("binder", { id: scalarGolden(index + 2), occurrence: nodeGolden,
      application: nodeGolden, candidate: scalarGolden(0), family: scalarGolden(family), parameter }, "binder")),
    recordGolden("literal", { id: scalarGolden(5), occurrence: nodeGolden, value: literalGolden }, "literal"),
  ];
  const golden = constraintsGolden(constraints, variables);
  assertRoundTrip("Constraints", golden.value, golden.text, "13 constraint arms and 4 variable arms with three distinct binder families");
  const reversed = constraintsGolden([...constraints].reverse(), [...variables].reverse());
  assertRoundTrip("Constraints", reversed.value, reversed.text, "element ordering is data, not parser normalization");
});

test("all seventeen contribution roles preserve complete key payloads and both equality directions", () => {
  const roles = [recordGolden("equality", { direction: scalarGolden("left-to-right") }, "equality"),
    recordGolden("equality", { direction: scalarGolden("right-to-left") }, "equality"),
    ...["flow", "selection", "receiver-flow", "application-result", "member", "index", "operator", "literal", "protocol", "refinement", "discharge", "default"].map(kind => recordGolden(kind, {}, kind)),
    recordGolden("argument-flow", { argument: scalarGolden(1), component: scalarGolden(2) }, "argument-flow"),
    recordGolden("context-flow", { argument: scalarGolden(1), parameter: scalarGolden(2) }, "context-flow"),
    recordGolden("closure-result-flow", { argument: scalarGolden(1), result: scalarGolden(2) }, "closure-result-flow"),
    recordGolden("construction-part", { part: scalarGolden(3) }, "construction-part")];
  const contributions = roles.map((role, index) => recordGolden("AtomicContribution", {
    key: recordGolden("ContributionKey", { node: nodeGolden, candidate: index % 2 === 0 ? nullGolden : scalarGolden(1), role }),
    reads: arrayGolden([scalarGolden(0), scalarGolden(2)]), bounds: arrayGolden([scalarGolden(1)]), constraint: referenceGolden }));
  for (const order of [contributions, [...contributions].reverse()]) assertRoundTrip("Contributions", order.map(value => value.value),
    order.map(value => value.text).join("\n"), "complete role and candidate-sensitive document");
});

test("all contribution role ranks and numeric payload columns have complete adjacent-order opposites", () => {
  const application = { captured: captureGolden.value, permissionScope: null, callee: 0, receiver: 0,
    typeArguments: [], arguments: [
      { kind: "value", occurrence, type: 0, tuple: [0, 0], closure: body },
      { kind: "spread", occurrence, type: 0, tuple: null, closure: body },
    ], candidates: 0, result: 0 };
  const candidate = { ordinal: 0, declaration: definition, appliedSignature: { kind: "available", value: 0 },
    bindings: { kind: "unavailable", reason: "not-provided" }, conditionalFailure: { kind: "available", value: null }, contributions: [] };
  const constraints = [
    { kind: "eq", occurrence, left: 0, right: 0 },
    { kind: "flow", occurrence, from: 0, to: 0, role: "assignment", bindings: emptyBindings },
    { kind: "call", occurrence, application },
    { kind: "member", occurrence, receiver: 0, key: { kind: "text", value: "item" }, access: "read", result: 0, origins: [], bindings: emptyBindings },
    { kind: "index", occurrence, receiver: 0, key: 0, access: "read", result: 0, bindings: emptyBindings },
    { kind: "op", occurrence, operator: "+", operands: [0, 0], result: 0, permissionScope: null },
    { kind: "literal", occurrence, value: { kind: "number", token: "1", value: { numerator: 1n, denominator: 1n, negativeZero: false } }, destination: 0 },
    { kind: "protocol", occurrence, protocol: "iterate", asynchronous: false, subject: 0, operands: [], result: 0, bindings: emptyBindings },
    { kind: "refine", occurrence, source: 0, checked: 0, result: 0 },
    { kind: "discharge", occurrence, checkerDiagnostic: 9910000, obligations: [] },
    { kind: "default", occurrence, variable: 0, rule: "local-producers", type: 0 },
    { kind: "construct-literal", occurrence, construction: "array", parts: [
      { kind: "element", occurrence, type: 0 }, { kind: "spread", occurrence, type: 0 },
    ], destination: null, result: 0 },
  ];
  const entry = (index, role, selected = null) => ({ key: { node: occurrence, candidate: selected, role },
    reads: [], bounds: index === 10 ? [0] : [], constraint: { body, index } });
  const contributions = [
    entry(0, { kind: "equality", direction: "left-to-right" }),
    entry(0, { kind: "equality", direction: "right-to-left" }),
    entry(1, { kind: "flow" }), entry(2, { kind: "selection" }),
    entry(3, { kind: "member" }), entry(4, { kind: "index" }), entry(5, { kind: "operator" }),
    entry(6, { kind: "literal" }), entry(7, { kind: "protocol" }), entry(8, { kind: "refinement" }),
    entry(9, { kind: "discharge" }), entry(10, { kind: "default" }),
    entry(11, { kind: "construction-part", part: 0 }), entry(11, { kind: "construction-part", part: 1 }),
    entry(2, { kind: "argument-flow", argument: 0, component: 0 }, 0),
    entry(2, { kind: "argument-flow", argument: 0, component: 1 }, 0),
    entry(2, { kind: "argument-flow", argument: 1, component: 0 }, 0),
    entry(2, { kind: "receiver-flow" }, 0),
    entry(2, { kind: "context-flow", argument: 0, parameter: 0 }, 0),
    entry(2, { kind: "context-flow", argument: 0, parameter: 1 }, 0),
    entry(2, { kind: "context-flow", argument: 1, parameter: 0 }, 0),
    entry(2, { kind: "closure-result-flow", argument: 0, result: 0 }, 0),
    entry(2, { kind: "closure-result-flow", argument: 0, result: 1 }, 0),
    entry(2, { kind: "closure-result-flow", argument: 1, result: 0 }, 0),
    entry(2, { kind: "application-result" }, 0),
    entry(2, { kind: "argument-flow", argument: 0, component: 0 }, 1),
  ];
  const set = { ...constraintSet(constraints, [localVariable(0)]), candidates: [{ id: 0, candidates: [candidate, { ...candidate, ordinal: 1 }] }] };
  const input = { constraints: [set], contributions, bindingScopes: [emptyScope, emptyScope, emptyScope, emptyScope] };
  fullEqual(product.verifyInference(verificationInput(input)), [], "all independent role and payload ranks are valid");
  for (let index = 0; index + 1 < contributions.length; index += 1) {
    const reversed = [...contributions];
    [reversed[index], reversed[index + 1]] = [reversed[index + 1], reversed[index]];
    fullEqual(product.verifyInference(verificationInput({ ...input, contributions: reversed })),
      [violation("contribution-order", { kind: "contribution", key: contributions[index].key }, "key")],
      `adjacent canonical keys ${index}/${index + 1}: complete one-error opposite`);
  }
  fullEqual(product.verifyInference(verificationInput({ ...input, constraints: [{ ...set, constraints: constraints.map((value, index) =>
    index === 2 ? { ...value, kind: "construct" } : value) }] })), [], "construct applications own the same complete role domains");
});

test("application contribution roles retain actual arguments, closures, receivers and original candidates", () => {
  const candidate = { ordinal: 0, declaration: definition, appliedSignature: { kind: "available", value: 0 },
    bindings: { kind: "unavailable", reason: "not-provided" }, conditionalFailure: { kind: "available", value: null }, contributions: [] };
  const application = { captured: captureGolden.value, permissionScope: null, callee: 0, receiver: 0, typeArguments: [], arguments: [
    { kind: "value", occurrence, type: 0, tuple: null, closure: null },
    { kind: "spread", occurrence, type: 0, tuple: [0, 0], closure: body },
  ], candidates: 0, result: 0 };
  const set = { ...constraintSet([{ kind: "call", occurrence, application }]), candidates: [{ id: 0, candidates: [candidate] }] };
  const contribution = (role, selected = 0, node = occurrence) => ({ key: { node, candidate: selected, role },
    reads: [], bounds: [], constraint: { body, index: 0 } });
  const roleCases = [
    [{ kind: "argument-flow", argument: 0, component: 0 }, [
      { kind: "argument-flow", argument: -0, component: 0 }, { kind: "argument-flow", argument: 5, component: 0 },
      { kind: "argument-flow", argument: 0, component: -0 }, { kind: "argument-flow", argument: 0, component: 1 },
      { kind: "argument-flow", argument: 1, component: 2 },
    ]],
    [{ kind: "context-flow", argument: 1, parameter: 0 }, [
      { kind: "context-flow", argument: 0, parameter: 0 }, { kind: "context-flow", argument: 5, parameter: 0 },
      { kind: "context-flow", argument: -0, parameter: 0 }, { kind: "context-flow", argument: 1, parameter: -0 },
    ]],
    [{ kind: "closure-result-flow", argument: 1, result: 0 }, [
      { kind: "closure-result-flow", argument: 0, result: 0 }, { kind: "closure-result-flow", argument: 5, result: 0 },
      { kind: "closure-result-flow", argument: -0, result: 0 }, { kind: "closure-result-flow", argument: 1, result: -0 },
    ]],
  ];
  for (const [validRole, invalidRoles] of roleCases) for (const role of invalidRoles) {
    const invalid = contribution(role);
    ruleCase("contribution-role", { constraints: [set], contributions: [contribution(validRole)] },
      { constraints: [set], contributions: [invalid] },
      [violation("contribution-role", { kind: "contribution", key: invalid.key }, "role")], "complete actual authored argument role domain");
  }
  const receiver = contribution({ kind: "receiver-flow" });
  ruleCase("contribution-role", { constraints: [set], contributions: [receiver] }, { constraints: [{ ...set,
    constraints: [{ kind: "call", occurrence, application: { ...application, receiver: null } }] }], contributions: [receiver] },
  [violation("contribution-role", { kind: "contribution", key: receiver.key }, "role")], "receiver flow requires the actual receiver");
  for (const original of [2, 4]) {
    const originalSet = { ...set, candidates: [{ id: 0, candidates: [{ ...candidate, ordinal: original }] }] };
    const valid = contribution({ kind: "application-result" }, original);
    const invalid = contribution({ kind: "application-result" }, 0);
    ruleCase("candidate-reference", { constraints: [originalSet], contributions: [valid] },
      { constraints: [originalSet], contributions: [invalid] },
      [violation("candidate-reference", { kind: "contribution", key: invalid.key }, "candidate")],
      "contributions use the same original-candidate inventory as binders and solved calls");
  }
  for (const [valid, invalid, expectedRules] of [
    [contribution({ kind: "selection" }, null), contribution({ kind: "selection" }), ["contribution-role"]],
    [contribution({ kind: "application-result" }), contribution({ kind: "application-result" }, null), ["contribution-role"]],
    [contribution({ kind: "application-result" }), contribution({ kind: "application-result" }, -0), ["contribution-role", "candidate-reference"]],
    [contribution({ kind: "application-result" }), contribution({ kind: "application-result" }, 1), ["candidate-reference"]],
    [contribution({ kind: "application-result" }), contribution({ kind: "equality", direction: "left-to-right" }), ["contribution-role"]],
    [contribution({ kind: "application-result" }), contribution({ kind: "application-result" }, 0, { body, node: 1 }), ["contribution-role"]],
  ]) ruleCase(expectedRules[0], { constraints: [set], contributions: [valid], nodes: [{ owner: source, ids: [0, 1] }] },
    { constraints: [set], contributions: [invalid], nodes: [{ owner: source, ids: [0, 1] }] },
    expectedRules.map(rule => violation(rule, { kind: "contribution", key: invalid.key }, rule === "candidate-reference" ? "candidate" : "role")),
    "selection, original candidate and node ownership are independent conditions");
  const construction = { kind: "construct-literal", occurrence, construction: "array", parts: [{ kind: "element", occurrence, type: 0 }],
    destination: null, result: 0 };
  for (const part of [-0, 1]) {
    const invalid = contribution({ kind: "construction-part", part }, null);
    ruleCase("contribution-role", { constraints: [constraintSet([construction])], contributions: [contribution({ kind: "construction-part", part: 0 }, null)] },
      { constraints: [constraintSet([construction])], contributions: [invalid] },
      [violation("contribution-role", { kind: "contribution", key: invalid.key }, "role")], "construction part is an actual dense ordinal");
  }
  const equality = { kind: "eq", occurrence, left: 0, right: 0 };
  const directed = { kind: "equality", direction: "left-to-right" };
  const foreignCandidate = contribution(directed);
  ruleCase("contribution-role", { constraints: [constraintSet([equality])], contributions: [contribution(directed, null)] },
    { constraints: [constraintSet([equality])], contributions: [foreignCandidate] },
    [violation("contribution-role", { kind: "contribution", key: foreignCandidate.key }, "role")], "nonapplication contributions have no candidate namespace");
});

test("closed operator, flow, default, access and native-carrier spellings each retain their complete data", () => {
  const operators = ["+", "-", "!", "~", "typeof", "void", "delete", "*", "/", "%", "**", "&", "|", "^",
    "<<", ">>", ">>>", "<", "<=", ">", ">=", "==", "!=", "===", "!==", "in", "instanceof"];
  const flows = ["initialization", "assignment", "argument", "return", "receiver", "yield", "member-write"];
  const defaults = ["signature-producers", "local-producers", "binder-declared-default", "literal-native-default", "refuse-unseeded"];
  const constraints = [
    ...operators.map(operator => recordGolden("op", { occurrence: nodeGolden, operator: scalarGolden(operator),
      operands: arrayGolden([typeGolden, typeGolden]), result: typeGolden, permissionScope: nullGolden }, "op")),
    ...flows.map(role => recordGolden("flow", { occurrence: nodeGolden, from: typeGolden, to: typeGolden,
      role: scalarGolden(role), bindings: bindingGolden }, "flow")),
    ...defaults.map(rule => recordGolden("default", { occurrence: nodeGolden, variable: scalarGolden(0),
      rule: scalarGolden(rule), type: typeGolden }, "default")),
    ...["read", "write", "call"].map(access => recordGolden("member", { occurrence: nodeGolden, receiver: typeGolden,
      key: textKeyGolden, access: scalarGolden(access), result: typeGolden, origins: emptyGolden, bindings: bindingGolden }, "member")),
  ];
  const golden = constraintsGolden(constraints);
  assertRoundTrip("Constraints", golden.value, golden.text, "closed scalar union members are preserved without interpreting language rules");
  const primitives = ["bool", "char", "int8", "uint8", "int16", "uint16", "int32", "uint32", "int64", "uint64",
    "int128", "uint128", "native-int", "native-uint", "float16", "float32", "float64", "decimal"];
  const decisions = primitives.map(carrier => recordGolden("op", { operation: operationGolden(recordGolden("native-operator", {
    operator: scalarGolden("+"), carrier: scalarGolden(carrier) }, "native-operator")) }, "op"));
  for (const kind of ["native-operator", "bigint-operator"]) {
    const complete = operators.map(operator => recordGolden("op", { operation: operationGolden(recordGolden(kind, {
      operator: scalarGolden(operator), ...(kind === "native-operator" ? { carrier: scalarGolden("int64") } : {}) }, kind)) }, "op"));
    for (const ordered of [complete, [...complete].reverse()]) {
      const document = solutionGolden(ordered);
      assertRoundTrip("Solution", document.value, document.text, `every nested ${kind} operator and both complete orders`);
    }
    const document = solutionGolden([complete[0]]);
    const offset = document.text.indexOf('operator="') + "operator=".length;
    fieldParseCase("Solution", document.text.slice(0, offset) + '"not-an-operator")', offset,
      operators.map(operator => JSON.stringify(operator)), '"not-an-operator"');
  }
  const solution = solutionGolden(decisions);
  assertRoundTrip("Solution", solution.value, solution.text, "every native carrier is exact representation data, not a JS number cap");
});

test("complete captured Core families survive without provider interpretation or missing closed arms", () => {
  const available = value => recordGolden("available", { value }, "available");
  const fieldBindingGolden = (changes = {}) => recordGolden("HirFieldBindingCapture", { occurrence: nodeGolden, bindings: available(bindingGolden),
    owner: available(typeGolden), pointee: available(typeGolden), fieldExpression: nodeGolden, field: available(sourceGolden),
    pointerExpression: nodeGolden, ...changes });
  const recordBindingGolden = (changes = {}) => recordGolden("HirRecordBindingCapture", { occurrence: nodeGolden, bindings: available(bindingGolden),
    source: available(typeGolden), layoutExpression: nodeGolden, layout: available(sourceGolden),
    fields: arrayGolden([recordGolden("HirRecordFieldBindingCapture", { expression: nodeGolden, binding: nodeGolden })]), ...changes });
  const capturedType = recordGolden("HirCapturedType", { type: available(typeGolden), component: componentGolden });
  const field = recordGolden("HirFieldMarkerCapture", { name: scalarGolden("field"), typeNode: sourceGolden,
    type: available(typeGolden), readonly: scalarGolden(true) });
  const markers = [
    recordGolden("HirMarkersCapture", { struct: nullGolden, field: nullGolden, defaultValue: nullGolden, jsString: scalarGolden(false) }),
    recordGolden("HirMarkersCapture", { struct: recordGolden("Record", { valueType: scalarGolden(true), fields: available(arrayGolden([field])) }),
      field, defaultValue: recordGolden("Record", { typeNode: sourceGolden, type: available(typeGolden) }), jsString: scalarGolden(true) }),
    recordGolden("HirMarkersCapture", { struct: recordGolden("Record", { valueType: scalarGolden(false), fields: unavailableGolden }),
      field: nullGolden, defaultValue: nullGolden, jsString: scalarGolden(false) }),
  ];
  const pointers = [recordGolden("raw-address", {}, "raw-address"),
    ...["readonly", "readwrite", "unspecified"].map(mutability => recordGolden("typed-location", {
      pointee: capturedType, mutability: scalarGolden(mutability) }, "typed-location")),
    recordGolden("native-pointer", { declaration: definitionGolden }, "native-pointer"),
    recordGolden("function-pointer", { declaration: definitionGolden, parameters: arrayGolden([capturedType]),
      result: capturedType, abi: arrayGolden([scalarGolden("native"), scalarGolden("C")]) }, "function-pointer")];
  const integer = recordGolden("HirIntegerOperandCapture", { runtimeBase: scalarGolden("bigint"),
    signedness: scalarGolden("signed"), width: scalarGolden(128) });
  const operations = [
    ...["address-of", "allocate", "load", "store", "equal-pointer", "hash-pointer", "bind-pointer", "project-pointer"].map((operation, index) =>
      recordGolden("HirPointerOperationCapture", { family: scalarGolden("typed-location"), operation: scalarGolden(operation),
        exportName: scalarGolden(`native_${operation}`), arguments: arrayGolden([sourceGolden]), typeArguments: arrayGolden([sourceGolden]),
        selection: scalarGolden(["applicable", "conditional-candidates", "untyped", "unvisited"][index % 4]),
        pointee: scalarGolden(["available", "unvisited", "not-applicable", "missing"][index % 4]) })),
    recordGolden("HirPointerOperationCapture", { family: scalarGolden("typed-location"), operation: scalarGolden("view"),
      pointer: sourceGolden, read: sourceGolden, write: sourceGolden, optional: scalarGolden(true) }),
    recordGolden("HirPointerOperationCapture", { family: scalarGolden("native-pointer"), operation: scalarGolden("load"), pointer: sourceGolden }),
    recordGolden("HirPointerOperationCapture", { family: scalarGolden("native-pointer"), operation: scalarGolden("store"), pointer: sourceGolden, value: sourceGolden }),
    recordGolden("HirPointerOperationCapture", { family: scalarGolden("native-pointer"), operation: scalarGolden("offset"), pointer: sourceGolden, offset: sourceGolden }),
    recordGolden("HirPointerOperationCapture", { family: scalarGolden("raw-address"), operation: scalarGolden("bind-raw-pointer"), identity: sourceGolden }),
    recordGolden("HirPointerOperationCapture", { family: scalarGolden("raw-address"), operation: scalarGolden("equal-raw-pointer"), left: sourceGolden, right: sourceGolden }),
    recordGolden("HirPointerOperationCapture", { family: scalarGolden("raw-address"), operation: scalarGolden("hash-raw-pointer"), pointer: sourceGolden }),
    recordGolden("HirPointerOperationCapture", { family: scalarGolden("raw-memory"), operation: scalarGolden("to-raw"), pointer: sourceGolden, layout: sourceGolden }),
    recordGolden("HirPointerOperationCapture", { family: scalarGolden("raw-memory"), operation: scalarGolden("reinterpret"), raw: sourceGolden, layout: sourceGolden }),
    recordGolden("HirPointerOperationCapture", { family: scalarGolden("raw-memory"), operation: scalarGolden("byte-offset"), raw: sourceGolden,
      offset: sourceGolden, integer, dataLayout: sourceGolden }),
    ...[8, 16, 32, 64, 128].map(width => recordGolden("HirPointerOperationCapture", { family: scalarGolden("raw-memory"),
      operation: scalarGolden("byte-offset"), raw: sourceGolden, offset: sourceGolden,
      integer: recordGolden("HirIntegerOperandCapture", { runtimeBase: scalarGolden(width < 64 ? "number" : "bigint"),
        signedness: scalarGolden("unsigned"), width: scalarGolden(width) }), dataLayout: sourceGolden })),
    ...[32, 64].flatMap(width => {
      const address = recordGolden("HirAddressIntegerCapture", { width: scalarGolden(width),
        runtimeBase: scalarGolden(width === 32 ? "number" : "bigint"), signedness: scalarGolden("unsigned") });
      return [recordGolden("HirPointerOperationCapture", { family: scalarGolden("raw-memory"), operation: scalarGolden("raw-to-address-integer"),
        raw: sourceGolden, integer: address, dataLayout: sourceGolden }),
      recordGolden("HirPointerOperationCapture", { family: scalarGolden("raw-memory"), operation: scalarGolden("address-integer-to-raw"),
        address: sourceGolden, integer: address, dataLayout: sourceGolden })];
    }),
    recordGolden("HirPointerOperationCapture", { family: scalarGolden("keep-alive"), operation: scalarGolden("keep-alive"), value: sourceGolden }),
  ];
  const attributes = [recordGolden("builder-state", { occurrence: sourceGolden, applicationTarget: sourceGolden,
    selectedMember: nullGolden, applicationMemberKind: nullGolden, applicationPlacement: nullGolden,
    applicationParameterName: nullGolden, applicationTargetSpecifier: nullGolden }, "builder-state"),
  ...["declaration", "constructor"].map((placement, index) => recordGolden("application", {
    occurrence: sourceGolden, applicationTarget: sourceGolden, selectedMember: recordGolden("Record", {
      selectedDeclaration: sourceGolden, declarations: arrayGolden([sourceGolden]) }),
    applicationMemberKind: scalarGolden(index === 0 ? "property" : "method"), applicationPlacement: scalarGolden(placement),
    applicationParameterName: scalarGolden("argument"), applicationTargetSpecifier: scalarGolden("return"), invocation: sourceGolden }, "application"))];
  const selected = recordGolden("selected", { expression: sourceGolden, declaration: sourceGolden,
    declarations: arrayGolden([sourceGolden]) }, "selected");
  const safety = [recordGolden("HirSafetyCapture", { occurrence: sourceGolden, provider: definitionGolden,
    family: scalarGolden("unsafe-context"), operation: scalarGolden("expression"), expression: sourceGolden }),
  recordGolden("HirSafetyCapture", { occurrence: sourceGolden, provider: definitionGolden,
    family: scalarGolden("unsafe-context"), operation: scalarGolden("remaining-block"), firstDirectStatement: scalarGolden(true) }),
  ...["type", "value"].map(form => recordGolden("HirSafetyCapture", { occurrence: sourceGolden, provider: definitionGolden,
    family: scalarGolden("safety"), operation: scalarGolden("root"), form: scalarGolden(form), target: form === "type" ? sourceGolden : nullGolden })),
  ...[selected, ...["function-shape", "receiver", "member-evidence"].map(reason => recordGolden("unavailable", {
    reason: scalarGolden(reason) }, "unavailable"))].map((selection, index) => recordGolden("HirSafetyCapture", {
    occurrence: sourceGolden, provider: definitionGolden, family: scalarGolden("safety"), operation: scalarGolden("select-member"),
    predecessor: index === 0 ? nullGolden : sourceGolden, memberKind: scalarGolden(["indexer", "method", "property"][index % 3]), selection })),
  ...["declaration", "constructor", "getter", "setter"].map(placement => recordGolden("HirSafetyCapture", {
    occurrence: sourceGolden, provider: definitionGolden, family: scalarGolden("safety"), operation: scalarGolden("placement"),
    predecessor: sourceGolden, placement: scalarGolden(placement) })),
  ...["requires-unsafe", "safe"].map(contract => recordGolden("HirSafetyCapture", { occurrence: sourceGolden, provider: definitionGolden,
    family: scalarGolden("safety"), operation: scalarGolden("apply"), predecessor: sourceGolden, contract: scalarGolden(contract) }))];
  const modes = ["by-value", "byref-readonly", "byref-readwrite", "byref-writeonly-must-init", "borrow-shared", "borrow-mut", "move"];
  const captures = [
    ...[nullGolden, definitionGolden].map(provider => ({ provider: available(provider) })),
    ...markers.map(value => ({ markers: available(value) })),
    ...[nullGolden, ...pointers].map(value => ({ pointerType: available(value) })),
    ...[nullGolden, ...operations].map(value => ({ pointerOperation: available(value) })),
    // Binding captures (SCHEMA-MIGRATION.md 5.2, IB1): absent, complete, and each inner fact unavailable.
    ...[nullGolden, fieldBindingGolden(), ...["bindings", "owner", "pointee", "field"].map(name => fieldBindingGolden({ [name]: unavailableGolden }))]
      .map(value => ({ fieldBinding: available(value) })),
    ...[nullGolden, recordBindingGolden(), recordBindingGolden({ fields: emptyGolden }),
      ...["bindings", "source", "layout"].map(name => recordBindingGolden({ [name]: unavailableGolden }))]
      .map(value => ({ recordBinding: available(value) })),
    ...[nullGolden, ...attributes].map(value => ({ attribute: available(value) })),
    ...[nullGolden, ...safety].map(value => ({ safety: available(value) })),
    ...modes.flatMap(mode => [
      { argumentPassing: available(recordGolden("HirArgumentPassingCapture", { role: scalarGolden("declaration"), mode: scalarGolden(mode) })) },
      { argumentPassing: available(recordGolden("HirArgumentPassingCapture", { role: scalarGolden("argument"), mode: scalarGolden(mode), storageExpression: sourceGolden })) },
    ]),
    { argumentPassing: available(nullGolden) },
    ...[null, "moved", "borrowed-shared", "borrowed-mut"].map(value => ({ flowState: available(scalarGolden(value)) })),
  ];
  for (const fields of captures) {
    const captured = recordGolden("HirCoreCapture", { provider: unavailableGolden, markers: unavailableGolden,
      pointerType: unavailableGolden, pointerOperation: unavailableGolden, fieldBinding: unavailableGolden, recordBinding: unavailableGolden, attribute: unavailableGolden,
      safety: unavailableGolden, argumentPassing: unavailableGolden, flowState: unavailableGolden, ...fields });
    const application = recordGolden("ApplicationConstraintData", { captured, permissionScope: nullGolden,
      callee: typeGolden, receiver: nullGolden, typeArguments: emptyGolden, arguments: emptyGolden, candidates: scalarGolden(0, "cand"), result: typeGolden });
    const golden = constraintsGolden([recordGolden("call", { occurrence: nodeGolden, application }, "call")]);
    assertRoundTrip("Constraints", golden.value, golden.text, `captured ${Object.keys(fields).join(",")}`);
  }
});

test("all decision, mapping, embedding, operation and protocol-step arms retain complete independent outputs", () => {
  const member = recordGolden("MemberDecision", { key: textKeyGolden, origins: arrayGolden([
    recordGolden("declared", { declaration: definitionGolden }, "declared"),
    recordGolden("class-prototype", { owner: definitionGolden }, "class-prototype"),
    recordGolden("mapped", { owner: sourceGolden, key: textKeyGolden }, "mapped"),
  ]), selectedDeclarations: arrayGolden([definitionGolden]), primary: definitionGolden, read: typeGolden, write: typeGolden,
  getter: endpointGolden("api-signature"), setter: endpointGolden("api-body", bodyGolden), bindings: bindingGolden });
  const mappings = [
    recordGolden("argument", { parameter: scalarGolden(0), argument: scalarGolden(0), component: nullGolden, passing: scalarGolden("by-value") }, "argument"),
    recordGolden("argument", { parameter: scalarGolden(1), argument: scalarGolden(1), component: scalarGolden(0), passing: scalarGolden("borrow-shared") }, "argument"),
    recordGolden("default", { parameter: scalarGolden(2), initializer: bodyGolden }, "default"),
    recordGolden("omitted", { parameter: scalarGolden(3), type: typeGolden }, "omitted"),
    recordGolden("rest", { parameter: scalarGolden(4), arguments: arrayGolden([scalarGolden(2), scalarGolden(3)]), passing: scalarGolden("move") }, "rest"),
  ];
  const application = applicationGolden(mappings);
  const embeddings = [identityGolden,
    ...["numeric", "literal-fit", "absence", "union-injection", "shape", "callable", "readonly"].map(conversion =>
      recordGolden("conversion", { conversion: scalarGolden(conversion), proof: proofGolden }, "conversion")),
    ...["incompatible-domain", "lossy-numeric", "missing-correspondence", "passing-mode", "rigid-parameter"].map(reason =>
      recordGolden("refused", { reason: scalarGolden(reason) }, "refused"))];
  const part = recordGolden("ConstructionPartDecision", { part: scalarGolden(0), source: nodeGolden,
    destination: componentGolden, member, embedding: embeddings[1] });
  const steps = ["acquire", "next", "done", "value", "finish", "fail", "await", "dispose", "completion"].map((role, index) =>
    recordGolden("ProtocolStepDecision", { role: scalarGolden(role), operation: index % 3 === 0
      ? recordGolden("call", { application }, "call") : index % 3 === 1
        ? recordGolden("core", { declaration: definitionGolden, bindings: bindingGolden }, "core") : recordGolden("completion", {}, "completion"),
    operands: arrayGolden([typeGolden]), result: typeGolden }));
  const operations = [
    recordGolden("native-operator", { operator: scalarGolden("+"), carrier: scalarGolden("int64") }, "native-operator"),
    recordGolden("bigint-operator", { operator: scalarGolden("*") }, "bigint-operator"),
    recordGolden("string-operator", { operator: scalarGolden("+") }, "string-operator"),
    recordGolden("boolean-operator", { operator: scalarGolden("&&") }, "boolean-operator"),
    recordGolden("absence-test", { negated: scalarGolden(true) }, "absence-test"),
    ...["object-construction", "array-construction"].map(kind => recordGolden(kind, { parts: arrayGolden([part]) }, kind)),
    ...["iterate", "await", "yield", "delegate", "dispose", "spread", "argument-passing", "pointer"].map(protocol => recordGolden("protocol", {
      protocol: scalarGolden(protocol), asynchronous: scalarGolden(protocol === "await"), steps: arrayGolden(steps),
      value: typeGolden, completion: typeGolden, yielded: typeGolden, sent: typeGolden, thrown: typeGolden }, "protocol")),
    recordGolden("conversion", { from: typeGolden, to: typeGolden, embedding: identityGolden }, "conversion"),
    ...["library", "core"].map(kind => recordGolden(kind, { declaration: definitionGolden, bindings: bindingGolden }, kind)),
    ...["pointer-address", "pointer-read", "pointer-write", "pointer-offset", "type-query", "discard"].map(kind => recordGolden(kind, {}, kind)),
  ];
  const decisions = [recordGolden("eq", { equivalent: scalarGolden(false) }, "eq"),
    ...embeddings.flatMap(embedding => [recordGolden("flow", { embedding }, "flow"), recordGolden("literal", { embedding }, "literal")]),
    recordGolden("member", { member }, "member"), recordGolden("index", { member }, "index"),
    recordGolden("call", { application, operation: nullGolden }, "call"),
    recordGolden("construct", { application, operation: recordGolden("decided", { decision: operationGolden(operations[0]) }, "decided") }, "construct"),
    ...operations.map(operation => recordGolden("op", { operation: operationGolden(operation) }, "op")),
    recordGolden("construct-literal", { operation: operationGolden(operations[5]) }, "construct-literal"),
    recordGolden("protocol", { operation: operationGolden(operations[7]) }, "protocol"),
    recordGolden("refine", { refinement: recordGolden("identity", { type: typeGolden }, "identity") }, "refine"),
    recordGolden("refine", { refinement: recordGolden("narrowed", { source: typeGolden, result: typeGolden, proof: proofGolden }, "narrowed") }, "refine"),
    recordGolden("discharge", { proof: recordGolden("DischargeProof", { checkerDiagnostic: scalarGolden(2322), obligations: arrayGolden([
      recordGolden("DischargeObligationProof", { ordinal: scalarGolden(0), rule: scalarGolden("embed"), evidence: proofGolden }),
    ]) }) }, "discharge"), recordGolden("default", { type: typeGolden }, "default")];
  const golden = solutionGolden(decisions);
  assertRoundTrip("Solution", golden.value, golden.text, "all decision outputs, exact default/rest/receiver completion channels");
});

test("every saved rule invocation retains its actual closed input rather than only its rule name", () => {
  const constructionParts = [recordGolden("element", { occurrence: nodeGolden, value: evidenceGolden }, "element"),
    recordGolden("property", { occurrence: nodeGolden, key: textKeyGolden, value: evidenceGolden }, "property"),
    recordGolden("spread", { occurrence: nodeGolden, value: evidenceGolden }, "spread")];
  const candidateArguments = [recordGolden("value", { occurrence: nodeGolden, value: evidenceGolden, tuple: nullGolden }, "value"),
    recordGolden("spread", { occurrence: nodeGolden, value: evidenceGolden, tuple: arrayGolden([evidenceGolden]) }, "spread")];
  const candidate = recordGolden("CandidateEndpoint", { ordinal: scalarGolden(0), declaration: definitionGolden,
    advertised: endpointGolden(), api: endpointGolden("api-signature"), bindings: bindingGolden, conditionalFailure: nullGolden });
  const invocations = [
    deferredGolden("embed", recordGolden("EmbedInput", { context: contextGolden, from: evidenceGolden, to: evidenceGolden, role: scalarGolden("return") })),
    deferredGolden("domain-fit", recordGolden("DomainFitInput", { context: contextGolden, value: evidenceGolden, domain: evidenceGolden })),
    deferredGolden("memory-equivalent", recordGolden("MemoryEquivalentInput", { context: contextGolden, left: evidenceGolden, right: evidenceGolden })),
    deferredGolden("member", recordGolden("MemberInput", { context: contextGolden, receiver: evidenceGolden, key: textKeyGolden, access: scalarGolden("call"), origins: emptyGolden })),
    deferredGolden("index", recordGolden("IndexInput", { context: contextGolden, receiver: evidenceGolden, key: evidenceGolden, access: scalarGolden("read") })),
    deferredGolden("construct-literal", recordGolden("LiteralConstructionInput", { context: contextGolden,
      construction: scalarGolden("array"), parts: arrayGolden(constructionParts), destination: evidenceGolden })),
    ...["call", "construct", "accessor-get", "accessor-set"].map(kind => deferredGolden("candidate", recordGolden(kind, {
      context: contextGolden, callee: evidenceGolden, receiver: evidenceGolden, typeArguments: arrayGolden([evidenceGolden]),
      arguments: arrayGolden(candidateArguments), candidates: arrayGolden([candidate]) }, kind))),
    deferredGolden("operator", recordGolden("OperatorInput", { context: contextGolden, operator: scalarGolden("*"),
      operands: arrayGolden([evidenceGolden, evidenceGolden]), permissionScope: nodeGolden })),
    deferredGolden("literal-fit", recordGolden("LiteralFitInput", { context: contextGolden, literal: literalGolden, destination: evidenceGolden })),
    ...["iterate", "await", "yield", "delegate", "dispose", "spread", "argument-passing", "pointer"].map(kind => deferredGolden("protocol", recordGolden(kind, {
      context: contextGolden, asynchronous: scalarGolden(kind === "await"), subject: evidenceGolden, operands: arrayGolden([evidenceGolden]),
      completion: evidenceGolden, yielded: evidenceGolden, sent: evidenceGolden, thrown: evidenceGolden }, kind))),
    deferredGolden("refinement", recordGolden("RefinementInput", { context: contextGolden, source: evidenceGolden, checked: evidenceGolden })),
    deferredGolden("library", recordGolden("LibraryInput", { context: contextGolden, declaration: definitionGolden, receiver: evidenceGolden,
      arguments: arrayGolden([evidenceGolden]), result: evidenceGolden })),
    deferredGolden("core", recordGolden("CoreInput", { context: contextGolden, captured: captureGolden, declaration: definitionGolden,
      operands: arrayGolden([evidenceGolden]), result: evidenceGolden, permissionScope: nodeGolden })),
  ];
  const golden = solutionGolden(invocations.map(deferred => recordGolden("deferred", { deferred }, "deferred")));
  assertRoundTrip("Solution", golden.value, golden.text, "all thirteen rule input families and candidate/protocol subarms");
  const call = solutionGolden([recordGolden("call", { application: applicationGolden(),
    operation: recordGolden("deferred", { deferred: invocations[0] }, "deferred") }, "call")]);
  assertRoundTrip("Solution", call.value, call.text, "deferred operation inside an otherwise selected application");
});

test("all host numbers and exact literals survive text before semantic validation", () => {
  for (const number of [-0, 0, -1, 0.5, 1e21, NaN, Infinity, -Infinity]) {
    const golden = recordGolden("InferenceGroup", { id: groupGolden, bodies: arrayGolden([bodyGolden]), signatures: arrayGolden([
      recordGolden("InferredSignaturePart", { definition: definitionGolden,
        part: recordGolden("parameter-initializer", { index: scalarGolden(number) }, "parameter-initializer") }),
    ]) });
    assertRoundTrip("InferenceGroup", golden.value, golden.text, `total number ${String(number)}`);
    const constraints = constraintsGolden([recordGolden("eq", { occurrence: recordGolden("NodeRef", { body: bodyGolden, node: scalarGolden(number, "n") }),
      left: scalarGolden(number, "t"), right: scalarGolden(number, "t") }, "eq")]);
    assertRoundTrip("Constraints", constraints.value, constraints.text, "all numeric ID slots transport data without range repair");
  }
  const rational = recordGolden("ExactRational", { numerator: scalarGolden(-9223372036854775809n), denominator: scalarGolden(3n), negativeZero: scalarGolden(true) });
  const literals = [recordGolden("number", { token: scalarGolden("-9223372036854775809/3"), value: rational }, "number"),
    recordGolden("bigint", { token: scalarGolden("900719925474099300000000000000000000001n"), value: scalarGolden(900719925474099300000000000000000000001n) }, "bigint"),
    recordGolden("string", { value: scalarGolden("\u0000\b\f\n\r\t\"\\/\ud800\udfff\u2028😀") }, "string"),
    recordGolden("boolean", { value: scalarGolden(false) }, "boolean"), recordGolden("absence", {}, "absence"),
    recordGolden("unique-symbol", { declaration: definitionGolden }, "unique-symbol")];
  const golden = constraintsGolden(literals.map(value => recordGolden("literal", { occurrence: nodeGolden, value, destination: typeGolden }, "literal")));
  assertRoundTrip("Constraints", golden.value, golden.text, "exact bigint/rational/token/code-unit payloads, not floating approximations");
});

test("binding families, sum components, nominal identity and pointer evidence remain separate complete data", () => {
  const parameter = recordGolden("TypeParameterIdentity", { owner: definitionGolden, index: scalarGolden(0) });
  const bound = recordGolden("bound", { parameter, type: typeGolden }, "bound");
  const rigid = recordGolden("rigid", { parameter }, "rigid");
  const bindings = recordGolden("BindingVector", { classBindings: arrayGolden([bound]), methodBindings: arrayGolden([rigid]),
    capturedBindings: arrayGolden([bound, rigid]), selfBindings: arrayGolden([
      recordGolden("bound", { owner: definitionGolden, type: typeGolden }, "bound"),
      recordGolden("rigid", { owner: definitionGolden }, "rigid"),
    ]) });
  const arm = recordGolden("SumArmRole", { authoredIndex: scalarGolden(0), component: sourceGolden, member: typeGolden });
  const construction = recordGolden("ConstructionDefinition", { occurrence: nodeGolden,
    captures: arrayGolden([recordGolden("LocalRef", { body: bodyGolden, local: scalarGolden(0, "l") })]) });
  const family = recordGolden("SumFamily", { origin: scalarGolden("authored"), component: componentGolden,
    parameters: arrayGolden([parameter]), roles: arrayGolden([arm]) });
  const selectors = [
    ...["class-value", "optional-value", "array-element", "intersection-result", "projection-source", "awaited"].map(kind => recordGolden(kind, {}, kind)),
    recordGolden("construction-argument", { definition: construction, index: scalarGolden(0) }, "construction-argument"),
    ...["tuple-element", "union-member", "argument-place", "parameter-place", "intersection-member"].map(kind => recordGolden(kind, { index: scalarGolden(0) }, kind)),
    ...["argument-tail", "parameter-tail"].map(kind => recordGolden(kind, { start: scalarGolden(0) }, kind)),
    recordGolden("member", { origin: recordGolden("declared", { declaration: definitionGolden }, "declared") }, "member"),
    ...["index-key", "index-value"].map(kind => recordGolden(kind, { declaration: definitionGolden }, kind)),
    recordGolden("parameter", { signature: signatureGolden, index: scalarGolden(0) }, "parameter"),
    recordGolden("receiver", { signature: signatureGolden }, "receiver"),
    recordGolden("signature-tail", { signature: signatureGolden, start: scalarGolden(0), readonly: scalarGolden(true) }, "signature-tail"),
    recordGolden("tuple-slice", { start: scalarGolden(0), endCount: scalarGolden(1), readonly: scalarGolden(false) }, "tuple-slice"),
    recordGolden("result", { signature: signatureGolden }, "result"),
    recordGolden("type-argument", { declaration: definitionGolden, index: scalarGolden(0) }, "type-argument"),
    recordGolden("sum-arm", { family, index: scalarGolden(0) }, "sum-arm"),
  ];
  const component = recordGolden("TypeComponent", { root: sourceGolden, path: arrayGolden(selectors) });
  const proof = recordGolden("EmbeddingProof", { steps: arrayGolden([recordGolden("CorrespondenceStep", {
    from: component, to: componentGolden, rule: scalarGolden("identity"), premises: emptyGolden })]), conclusion: scalarGolden(0) });
  const converted = solutionGolden([recordGolden("flow", { embedding: recordGolden("conversion", {
    conversion: scalarGolden("callable"), proof }, "conversion") }, "flow")]);
  assertRoundTrip("Solution", converted.value, converted.text, "every component selector including nested sum families");
  const pointers = [recordGolden("raw-address", {}, "raw-address"),
    recordGolden("typed-location", { pointee: typeGolden, mutability: scalarGolden("readonly") }, "typed-location"),
    recordGolden("native-pointer", { declaration: definitionGolden }, "native-pointer"),
    recordGolden("function-pointer", { declaration: definitionGolden, parameters: arrayGolden([typeGolden]), result: typeGolden,
      abi: arrayGolden([scalarGolden("native"), scalarGolden("cdecl")]) }, "function-pointer")];
  const values = pointers.map((pointer, index) => recordGolden("TypeEvidence", { type: typeGolden,
    component: recordGolden("item", { value: recordGolden("ItemNodeRef", { owner: definitionGolden, node: scalarGolden(0, "n") }) }, "item"),
    category: recordGolden("choice", { alternatives: arrayGolden([recordGolden("dynamic", {}, "dynamic"),
      recordGolden("parameter", { declaration: definitionGolden }, "parameter"), categoryGolden]) }, "choice"),
    numeric: recordGolden(["literal", "declared", "operation", "application"][index], { producer: nodeGolden, category: categoryGolden,
      authored: literalGolden }, ["literal", "declared", "operation", "application"][index]),
    sum: recordGolden(index % 2 === 0 ? "authored" : "inferred", { component: sourceGolden, bindings, arms: arrayGolden([arm]) }, index % 2 === 0 ? "authored" : "inferred"),
    nominal: definitionGolden, pointer }));
  const golden = constraintsGolden([], [], [], values);
  assertRoundTrip("Constraints", golden.value, golden.text, "no binder family, source category, numeric producer or pointer domain is dropped");
});

test("original candidate order, captured availability and complete diagnostic payloads are serialized without choosing candidates", () => {
  const diagnostic = recordGolden("Diagnostic", { code: recordGolden("extension", { number: scalarGolden(9901180),
    extensionCode: scalarGolden("SOURCE_CORE_MEMORY_DIMENSIONS"), rendered: scalarGolden("TSEXT9901180") }, "extension"),
  severity: scalarGolden("error"), site: recordGolden("source", { origin: originGolden }, "source"), source: scalarGolden("core"),
  evidence: arrayGolden([scalarGolden("exact evidence")]), message: scalarGolden("message"), arguments: arrayGolden([
    recordGolden("text", { value: scalarGolden("text") }, "text"), recordGolden("integer", { value: scalarGolden(9007199254740993n) }, "integer"),
    recordGolden("number", { value: scalarGolden(-0) }, "number"), recordGolden("origin", { value: originGolden }, "origin"),
  ]), related: arrayGolden([recordGolden("RelatedDiagnostic", { site: recordGolden("file", { path: scalarGolden("other.ts") }, "file"),
    code: recordGolden("checker", { number: scalarGolden(2322), rendered: scalarGolden("TS2322") }, "checker"), message: scalarGolden("related") })]),
  fix: recordGolden("DiagnosticFix", { description: scalarGolden("fix"), edits: arrayGolden([
    recordGolden("TextEdit", { origin: originGolden, replacement: scalarGolden("replacement") }),
  ]) }) });
  const captured = value => recordGolden("available", { value }, "available");
  const parameter = recordGolden("TypeParameterIdentity", { owner: definitionGolden, index: scalarGolden(0) });
  const contribution = (role, type = captured(typeGolden)) => recordGolden("HirInferenceContribution", { parameter, role: scalarGolden(role), source: sourceGolden,
    component: componentGolden, type });
  const candidates = [recordGolden("HirCandidate", { ordinal: scalarGolden(0), declaration: definitionGolden,
    appliedSignature: captured(signatureGolden), bindings: captured(bindingGolden), conditionalFailure: captured(diagnostic),
    contributions: arrayGolden(["argument", "receiver", "context", "result", "type-argument"].map(role => contribution(role))) }),
  ...["checker-error", "parameter-dependent", "not-provided"].map((reason, index) => {
    const unavailable = recordGolden("unavailable", { reason: scalarGolden(reason) }, "unavailable");
    return recordGolden("HirCandidate", { ordinal: scalarGolden(index + 1), declaration: definitionGolden,
      appliedSignature: unavailable, bindings: unavailable, conditionalFailure: unavailable,
      contributions: arrayGolden([contribution("argument", unavailable)]) });
  })];
  const golden = constraintsGolden([], [], [recordGolden("HirCandidateList", { id: scalarGolden(0, "cand"), candidates: arrayGolden(candidates) })]);
  assertRoundTrip("Constraints", golden.value, golden.text, "every captured fact state is retained, including a conditional failure on an earlier candidate");
  const passes = ["front", "decls", "infer", "elaborate", "validate", "lower-mir", "evaluate", "metadata", "liveness", "initialization",
    "refinements", "origins", "suspension", "errorStorage", "pointerBacking", "summaries", "pipeline"];
  const derived = recordGolden("Origin", { module: scalarGolden(moduleIdentity, "mod"), start: scalarGolden(0), length: scalarGolden(1),
    derived: arrayGolden(passes.map(pass => recordGolden("lowering", { pass: scalarGolden(pass) }, "lowering"))) });
  const complete = [diagnostic, recordGolden("Diagnostic", { code: recordGolden("host", { name: scalarGolden("HOST_INPUT"),
    rendered: scalarGolden("HOST_INPUT") }, "host"), severity: scalarGolden("warning"), site: recordGolden("none", {}, "none"),
    source: nullGolden, evidence: emptyGolden, message: scalarGolden("authored host data"), arguments: emptyGolden, related: emptyGolden, fix: nullGolden }),
  recordGolden("Diagnostic", { code: recordGolden("checker", { number: scalarGolden(2322), rendered: scalarGolden("TS2322") }, "checker"),
    severity: scalarGolden("suggestion"), site: recordGolden("source", { origin: derived }, "source"), source: nullGolden,
    evidence: emptyGolden, message: scalarGolden("authored derivation data"), arguments: emptyGolden, related: emptyGolden, fix: nullGolden })];
  for (const conditional of [nullGolden, ...complete]) {
    const entry = recordGolden("HirCandidate", { ordinal: scalarGolden(0), declaration: definitionGolden,
      appliedSignature: unavailableGolden, bindings: unavailableGolden, conditionalFailure: captured(conditional), contributions: emptyGolden });
    const value = constraintsGolden([], [], [recordGolden("HirCandidateList", { id: scalarGolden(0, "cand"), candidates: arrayGolden([entry]) })]);
    assertRoundTrip("Constraints", value.value, value.text, "complete host/checker/extension, source/file/none, nullable and lowering data");
    if (conditional.value?.code.kind === "host") {
      const text = value.text.replace('name="HOST_INPUT"', "name=false");
      const offset = text.indexOf("name=false") + "name=".length;
      fullEqual(product.parseConstraints(text), { kind: "invalid-text", offset, line: 1, column: offset + 1,
        expected: ["string"], found: "false" }, "host diagnostic names reject non-string data through the public text boundary");
    }
  }
});

test("invalid text reports its complete independent lexical item and exact UTF-16 site", () => {
  const id = `group:${JSON.stringify(group)}`;
  const valid = `InferenceGroup(id=${id}, bodies=[], signatures=[])`;
  const failures = [
    ["", 0, ["InferenceGroup"], null],
    ["Unknown()", 0, ["InferenceGroup"], "Unknown"],
    ["true", 0, ["InferenceGroup"], "true"],
    ["[]", 0, ["InferenceGroup"], "["],
    ["@", 0, ["value", "record"], "@"],
    ["InferenceGroup(", 15, ["id"], null],
    [`InferenceGroup(id=${id})`, `InferenceGroup(id=${id}`.length, ["bodies"], ")"],
    [`InferenceGroup(id=${id}, signatures=[], bodies=[])`, `InferenceGroup(id=${id}, `.length, ["bodies"], "signatures"],
    [`InferenceGroup(id=${id}, bodies=[], signatures=[], extra=null)`, `InferenceGroup(id=${id}, bodies=[], signatures=[], `.length, ["end of record"], "extra"],
    [`InferenceGroup(id=${id}, bodies=null, signatures=[])`, `InferenceGroup(id=${id}, bodies=`.length, ["["], "null"],
    ["InferenceGroup(id=false, bodies=[], signatures=[])", 18, ["group"], "false"],
    ["InferenceGroup(id=group:0, bodies=[], signatures=[])", 18, ["group"], "group:0"],
    ["InferenceGroup(id=group:[], bodies=[], signatures=[])", 24, ["identity value"], "["],
    ["InferenceGroup(id=group:\"broken\", bodies=[], signatures=[])", 18, ["group"], "group:\"broken\""],
    [`InferenceGroup(id=${id}, bodies=[], signatures=[],)`, `InferenceGroup(id=${id}, bodies=[], signatures=[],`.length, ["field", "="], ")"],
    [`InferenceGroup(id=${id}, bodies=[body:${JSON.stringify(body)},], signatures=[])`,
      `InferenceGroup(id=${id}, bodies=[body:${JSON.stringify(body)},`.length, ["body"], "]"],
    [`${valid}\n${valid}`, valid.length + 1, ["end of document"], "InferenceGroup"],
    [`${valid} ${valid}`, valid.length + 1, ["end of document"], "InferenceGroup"],
    [`InferenceGroup(id=${id} bodies=[], signatures=[])`, `InferenceGroup(id=${id} `.length, [",", ")"], "bodies"],
    ["InferenceGroup(id=group:\"bad\\q\", bodies=[], signatures=[])", 29, ["JSON escape"], "q"],
    ["InferenceGroup(id=group:\"bad\\u00XZ\", bodies=[], signatures=[])", 30, ["four hexadecimal digits"], "00XZ"],
    ["InferenceGroup(id=group:\"bad\n\", bodies=[], signatures=[])", 'InferenceGroup(id=group:"bad'.length, ["string character"], "\n"],
    ["InferenceGroup(id=group:\"unterminated", 'InferenceGroup(id=group:"unterminated'.length, ['"'], null],
    ["InferenceGroup(id=group:01, bodies=[], signatures=[])", 24, ["canonical number"], "01"],
    ["InferenceGroup(id=group:1.0, bodies=[], signatures=[])", 24, ["canonical number"], "1.0"],
    ["InferenceGroup(id=group:-0n, bodies=[], signatures=[])", 24, ["canonical bigint"], "-0n"],
  ];
  for (const [text, offset, expected, found] of failures) {
    const lines = text.slice(0, offset).split("\n");
    fullEqual(product.parseInferenceGroup(text), { kind: "invalid-text", offset, line: lines.length,
      column: lines.at(-1).length + 1, expected, found }, `complete invalid group: ${JSON.stringify(text)}`);
  }
  const badKind = constraintsGolden([recordGolden("flow", { occurrence: nodeGolden, from: typeGolden, to: typeGolden,
    role: scalarGolden("unknown"), bindings: bindingGolden }, "flow")]).text;
  const roleOffset = badKind.indexOf('"unknown"');
  fullEqual(product.parseConstraints(badKind), { kind: "invalid-text", offset: roleOffset, line: 1, column: roleOffset + 1,
    expected: ['"initialization"', '"assignment"', '"argument"', '"return"', '"receiver"', '"yield"', '"member-write"'], found: '"unknown"' },
  "an unknown closed arm is a parser error, not a fabricated verifier opposite");
  const proto = `InferenceGroup(id=${id}, bodies=[], signatures=[], "__proto__"=Unknown())`;
  const protoOffset = proto.indexOf('"__proto__"') + 1;
  fullEqual(product.parseInferenceGroup(proto), { kind: "invalid-text", offset: protoOffset, line: 1, column: protoOffset + 1,
    expected: ["end of record"], found: "__proto__" }, "extra field cannot mutate materialized record prototypes");
});

test("unknown text retains every scalar prefix boundary and exact malformed lexical position", () => {
  const variable = recordGolden("local", { id: scalarGolden(0), occurrence: nodeGolden,
    local: recordGolden("LocalRef", { body: bodyGolden, local: scalarGolden(0, "l") }) }, "local");
  const candidate = recordGolden("HirCandidate", { ordinal: scalarGolden(0), declaration: definitionGolden,
    appliedSignature: recordGolden("available", { value: signatureGolden }, "available"), bindings: unavailableGolden,
    conditionalFailure: unavailableGolden, contributions: emptyGolden });
  const literal = recordGolden("number", { token: scalarGolden("1"), value: recordGolden("ExactRational", {
    numerator: scalarGolden(1n), denominator: scalarGolden(1n), negativeZero: scalarGolden(false) }) }, "number");
  const flow = recordGolden("flow", { occurrence: nodeGolden, from: typeGolden, to: typeGolden,
    role: scalarGolden("assignment"), bindings: bindingGolden }, "flow");
  const constraints = constraintsGolden([
    recordGolden("eq", { occurrence: nodeGolden, left: typeGolden, right: typeGolden }, "eq"), flow,
    recordGolden("literal", { occurrence: nodeGolden, value: literal, destination: typeGolden }, "literal"),
    recordGolden("protocol", { occurrence: nodeGolden, protocol: scalarGolden("iterate"), asynchronous: scalarGolden(false),
      subject: typeGolden, operands: emptyGolden, result: typeGolden, bindings: bindingGolden }, "protocol"),
  ], [variable], [recordGolden("HirCandidateList", { id: scalarGolden(0, "cand"), candidates: arrayGolden([candidate]) })]);
  const derivedOrigin = recordGolden("Origin", { module: scalarGolden(moduleIdentity, "mod"), start: scalarGolden(0), length: scalarGolden(1),
    derived: arrayGolden([recordGolden("expansion", { expansion: scalarGolden("issued-expansion", "exp") }, "expansion")]) });
  const context = recordGolden("RuleContext", { occurrence: nodeGolden, origin: derivedOrigin, bindings: bindingGolden });
  const solution = solutionGolden([recordGolden("deferred", { deferred: deferredGolden("embed", recordGolden("EmbedInput", {
    context, from: evidenceGolden, to: evidenceGolden, role: scalarGolden("return") })) }, "deferred")]);
  assertRoundTrip("Constraints", constraints.value, constraints.text, "independent complete scalar-boundary baseline");
  assertRoundTrip("Solution", solution.value, solution.text, "actual module and opaque expansion data baseline");
  const flowRoles = ['"initialization"', '"assignment"', '"argument"', '"return"', '"receiver"', '"yield"', '"member-write"'];
  const bareRoleOffset = constraints.text.indexOf('role="assignment"') + "role=".length;
  const bareRole = constraints.text.slice(0, bareRoleOffset) + "Unknown";
  fullEqual(product.parseConstraints(bareRole), { kind: "invalid-text", offset: bareRoleOffset, line: 1,
    column: bareRoleOffset + 1, expected: flowRoles, found: "Unknown" },
  "an unfinished bare name cannot inhabit any actual closed flow-role arm");
  const rows = [
    ["Constraints", constraints, `group=${groupGolden.text}`, "[]", ["group"], "["],
    ["Constraints", constraints, `body=${bodyGolden.text}`, 'body:"broken"', ["body"], 'body:"broken"'],
    ["Constraints", constraints, `body=${bodyGolden.text}`, "body:0", ["body"], "body:0"],
    ["Constraints", constraints, "id=0", "true", ["number"], "true"],
    ["Constraints", constraints, "node=n:0", 'n:"zero"', ["n"], 'n:"zero"'],
    ["Constraints", constraints, "local=l:0", 'l:"zero"', ["l"], 'l:"zero"'],
    ["Constraints", constraints, "left=t:0", 't:"zero"', ["t"], 't:"zero"'],
    ["Constraints", constraints, "id=cand:0", 'cand:"zero"', ["cand"], 'cand:"zero"'],
    ["Constraints", constraints, "value=sig:0", 'sig:"zero"', ["sig"], 'sig:"zero"'],
    ["Constraints", constraints, `declaration=${definitionGolden.text}`, 'def:"broken"', ["def"], 'def:"broken"'],
    ["Constraints", constraints, `declaration=${definitionGolden.text}`, "def:0", ["def"], "def:0"],
    ["Constraints", constraints, 'token="1"', "false", ["string"], "false"],
    ["Constraints", constraints, "numerator=1n", "1", ["bigint"], "1"],
    ["Constraints", constraints, "asynchronous=false", "0", ["boolean"], "0"],
    ["Constraints", constraints, 'role="assignment"', "[]", flowRoles, "["],
    ["Constraints", constraints, 'role="assignment"', "Unknown()", flowRoles, "Unknown"],
    ["Constraints", constraints, 'role="assignment"', 't:"assignment"', flowRoles, 't:"assignment"'],
    ["Solution", solution, `module=mod:${JSON.stringify(moduleIdentity)}`, 'mod:"broken"', ["mod"], 'mod:"broken"'],
    ["Solution", solution, `module=mod:${JSON.stringify(moduleIdentity)}`, "mod:0", ["mod"], "mod:0"],
    ["Solution", solution, 'expansion=exp:"issued-expansion"', "exp:0", ["exp"], "exp:0"],
  ];
  for (const [family, golden, slot, replacement, expected, found] of rows) {
    const start = golden.text.indexOf(slot);
    assert.equal(start >= 0, true, "each authored field slot actually exists in the independent document");
    const offset = start + slot.indexOf("=") + 1;
    const text = golden.text.slice(0, offset) + replacement + golden.text.slice(start + slot.length);
    fullEqual(product[`parse${family}`](text), { kind: "invalid-text", offset, line: 1, column: offset + 1, expected, found },
      `complete unknown-text boundary for ${slot}`);
  }
  for (const [text, offset, expected, found] of [
    ['"\\', 0, ["InferenceGroup"], '"'],
    ['"\\u', 0, ["InferenceGroup"], '"'],
    ["+01n", 0, ["canonical bigint"], "+01n"],
    ["1.5n", 0, ["canonical bigint"], "1.5n"],
    ["+1", 0, ["canonical number"], "+1"],
    ["1.25", 0, ["InferenceGroup"], "1.25"],
    ["1e+21", 0, ["InferenceGroup"], "1e+21"],
    ["1e-7", 0, ["InferenceGroup"], "1e-7"],
    ["\n\n@", 2, ["value", "record"], "@"],
    ["InferenceGroup(id=", 18, ["group"], null],
    ["InferenceGroup(id=group:", 24, ["identity value"], null],
    ["[", 0, ["InferenceGroup"], "["],
    ["[0", 0, ["InferenceGroup"], "["],
  ]) {
    const lines = text.slice(0, offset).split("\n");
    fullEqual(product.parseInferenceGroup(text), { kind: "invalid-text", offset, line: lines.length,
      column: lines.at(-1).length + 1, expected, found }, "complete lexical and unterminated-frame boundary");
  }
  const quotedFields = `InferenceGroup("id"=${groupGolden.text}, "bodies"=[], "signatures"=[])`;
  fullEqual(product.parseInferenceGroup(quotedFields), { kind: "parsed", value: { id: group, bodies: [], signatures: [] } },
    "quoted fields share the one genuine string token path");
});

test("the earliest real text position wins across lexical, framing, field, value and root failures", () => {
  const id = `group:${JSON.stringify(group)}`;
  const valid = `InferenceGroup(id=${id}, bodies=[], signatures=[])`;
  const rows = [
    ["Wrong(@)", 0, ["InferenceGroup"], "Wrong"],
    ["Wrong", 0, ["InferenceGroup"], "Wrong"],
    ['"unterminated', 0, ["InferenceGroup"], '"'],
    ['InferenceGroup(id="unterminated', 18, ["group"], '"'],
    [`InferenceGroup(id=${id}, bodies="unterminated`, `InferenceGroup(id=${id}, bodies=`.length, ["["], '"'],
    ["Wrong()\n" + valid, 0, ["InferenceGroup"], "Wrong"],
    ["InferenceGroup(wrong=@)", 15, ["id"], "wrong"],
    ["InferenceGroup(id=false, wrong=@)", 18, ["group"], "false"],
    ["InferenceGroup(id=false, bodies=[])", 18, ["group"], "false"],
    ["InferenceGroup(id=false, bodies=[], signatures=[], extra=@)", 18, ["group"], "false"],
    [`InferenceGroup(id=${id}, bodies=false, signatures=[], extra=@)`, `InferenceGroup(id=${id}, bodies=`.length, ["["], "false"],
    [`InferenceGroup(id=${id}, bodies=[body:"broken"], signatures=[], extra=@)`,
      `InferenceGroup(id=${id}, bodies=[`.length, ["body"], 'body:"broken"'],
    [valid + "\nWrong(@)", valid.length + 1, ["end of document"], "Wrong"],
    [valid + " Wrong(@)", valid.length + 1, ["end of document"], "Wrong"],
    ["InferenceGroup(id=def:", 18, ["group"], "def"],
    ["InferenceGroup(id=group:", 24, ["identity value"], null],
    ["InferenceGroup(id=group X)", 24, [":"], "X"],
    ["InferenceGroup(id=group", 23, [":"], null],
    ["InferenceGroup(id=Wrong", 18, ["group"], "Wrong"],
    [`InferenceGroup(id=${id}, bodies=Wrong`, `InferenceGroup(id=${id}, bodies=`.length, ["["], "Wrong"],
    [`InferenceGroup(id=${id}, bodies=[Wrong`, `InferenceGroup(id=${id}, bodies=[`.length, ["body"], "Wrong"],
    ["InferenceGroup", 14, ["("], null],
    ["InferenceGroup:", 14, ["("], ":"],
    ["InferenceGroup:0", 14, ["("], ":"],
    [`InferenceGroup(id=${id}, bodies=[0 X], signatures=[])`, `InferenceGroup(id=${id}, bodies=[`.length, ["body"], "0"],
    [`InferenceGroup(id=${id}, bodies=[`, `InferenceGroup(id=${id}, bodies=[`.length, ["body"], null],
    [`InferenceGroup(id=${id}, @)`, `InferenceGroup(id=${id}, `.length, ["value", "record"], "@"],
    ['InferenceGroup(id=group:"bad\\q", wrong=[])', 'InferenceGroup(id=group:"bad\\'.length, ["JSON escape"], "q"],
  ];
  for (const [text, offset, expected, found] of rows) {
    const lines = text.slice(0, offset).split("\n");
    fullEqual(product.parseInferenceGroup(text), { kind: "invalid-text", offset, line: lines.length,
      column: lines.at(-1).length + 1, expected, found }, `first actual offending item: ${JSON.stringify(text)}`);
  }
  for (const [family, name] of [["Constraints", "ConstraintSet"], ["Contributions", "AtomicContribution"], ["Solution", "Solution"]])
    fullEqual(product[`parse${family}`]("Wrong(@)"), { kind: "invalid-text", offset: 0, line: 1, column: 1,
      expected: [name], found: "Wrong" }, "all owning parser ports apply the same first-position law");
  const captured = field => recordGolden("HirCoreCapture", { provider: unavailableGolden, markers: unavailableGolden,
    pointerType: unavailableGolden, pointerOperation: unavailableGolden, fieldBinding: unavailableGolden, recordBinding: unavailableGolden, attribute: unavailableGolden,
    safety: unavailableGolden, argumentPassing: unavailableGolden, flowState: unavailableGolden, ...field });
  const document = captured => constraintsGolden([recordGolden("call", { occurrence: nodeGolden,
    application: recordGolden("ApplicationConstraintData", { captured, permissionScope: nullGolden, callee: typeGolden,
      receiver: nullGolden, typeArguments: emptyGolden, arguments: emptyGolden, candidates: scalarGolden(0, "cand"), result: typeGolden }) }, "call")]);
  const safety = recordGolden("HirSafetyCapture", { occurrence: sourceGolden, provider: definitionGolden, family: scalarGolden("safety"),
    operation: scalarGolden("root"), form: scalarGolden("type"), target: sourceGolden });
  const safetyDocument = document(captured({ safety: recordGolden("available", { value: safety }, "available") }));
  assertRoundTrip("Constraints", safetyDocument.value, safetyDocument.text, "actual shared-label capture discriminants remain valid");
  const wrongOperation = safetyDocument.text.replace('operation="root"', 'operation="broken"');
  const operationOffset = wrongOperation.indexOf('"broken"');
  fullEqual(product.parseConstraints(wrongOperation), { kind: "invalid-text", offset: operationOffset, line: 1, column: operationOffset + 1,
    expected: ['"root"', '"select-member"', '"placement"', '"apply"'], found: '"broken"' },
    "a valid safety family is not replaced by the first unsafe-family alternative");
  const integer = recordGolden("HirAddressIntegerCapture", { width: scalarGolden(64), runtimeBase: scalarGolden("bigint"), signedness: scalarGolden("unsigned") });
  const operation = recordGolden("HirPointerOperationCapture", { family: scalarGolden("raw-memory"), operation: scalarGolden("raw-to-address-integer"),
    raw: sourceGolden, integer, dataLayout: sourceGolden });
  const widthDocument = document(captured({ pointerOperation: recordGolden("available", { value: operation }, "available") }));
  assertRoundTrip("Constraints", widthDocument.value, widthDocument.text, "both native address-width variants belong to the actual closed input");
  const wrongWidth = widthDocument.text.replace("width=64", "width=16");
  const widthOffset = wrongWidth.indexOf("width=16") + "width=".length;
  fullEqual(product.parseConstraints(wrongWidth), { kind: "invalid-text", offset: widthOffset, line: 1, column: widthOffset + 1,
    expected: ["32", "64"], found: "16" }, "wrong native address width retains all actual remaining expected items");
  const partialWidth = widthDocument.text.slice(0, widthDocument.text.indexOf("width=64") + "width=".length) + '"unterminated';
  const partialWidthOffset = partialWidth.indexOf('"unterminated');
  fullEqual(product.parseConstraints(partialWidth), { kind: "invalid-text", offset: partialWidthOffset, line: 1, column: partialWidthOffset + 1,
    expected: ["32", "64"], found: '"' }, "a string opener cannot inhabit either numeric-only width arm");
  const stringLiteral = constraintsGolden([recordGolden("literal", { occurrence: nodeGolden, value: literalGolden, destination: typeGolden }, "literal")]);
  const partialString = stringLiteral.text.replace('value="literal"', 'value="unterminated');
  fullEqual(product.parseConstraints(partialString), { kind: "invalid-text", offset: partialString.length, line: 1, column: partialString.length + 1,
    expected: ['"'], found: null }, "a permitted plain string retains its genuine later lexical failure");
  const slashLiteral = constraintsGolden([recordGolden("literal", { occurrence: nodeGolden,
    value: recordGolden("string", { value: scalarGolden("folder/literal") }, "string"), destination: typeGolden }, "literal")]);
  fullEqual(product.parseConstraints(slashLiteral.text.replaceAll("/", "\\/")), { kind: "parsed", value: slashLiteral.value },
    "JSON escaped slashes retain every character in an ordinary string literal");
  const deferred = solutionGolden([recordGolden("deferred", { deferred: deferredGolden("embed", recordGolden("EmbedInput", {
    context: contextGolden, from: evidenceGolden, to: evidenceGolden, role: scalarGolden("return") })) }, "deferred")]);
  const wrongRule = deferred.text.replace('rule="embed"', 'rule="unknown"');
  const ruleOffset = wrongRule.indexOf('"unknown"');
  fullEqual(product.parseSolution(wrongRule), { kind: "invalid-text", offset: ruleOffset, line: 1, column: ruleOffset + 1,
    expected: ['"embed"', '"domain-fit"', '"memory-equivalent"', '"member"', '"index"', '"construct-literal"', '"candidate"',
      '"operator"', '"literal-fit"', '"protocol"', '"refinement"', '"library"', '"core"'], found: '"unknown"' },
    "the complete saved-rule prefix is checked before any rule-specific input layout");
});

function fieldDocuments() {
  const contribution = recordGolden("AtomicContribution", {
    key: recordGolden("ContributionKey", { node: nodeGolden, candidate: nullGolden,
      role: recordGolden("equality", { direction: scalarGolden("left-to-right") }, "equality") }),
    reads: emptyGolden, bounds: emptyGolden, constraint: referenceGolden });
  return [
    ["InferenceGroup", recordGolden("InferenceGroup", { id: groupGolden, bodies: emptyGolden, signatures: emptyGolden }), "id", "\\u0069", "bodies"],
    ["Constraints", constraintsGolden([]), "group", "\\u0067", "body"],
    ["Contributions", contribution, "key", "\\u006b", "reads"],
    ["Solution", solutionGolden([]), "group", "\\u0067", "variables"],
  ];
}

function fieldParseCase(family, text, offset, expected, found) {
  const lines = text.slice(0, offset).split("\n");
  fullEqual(product[`parse${family}`](text), { kind: "invalid-text", offset, line: lines.length,
    column: lines.at(-1).length + 1, expected, found }, `${family} decoded field position: ${JSON.stringify(text)}`);
}

test("the three corrected equality helpers retain full later-field vectors and reject the metadata name", () => {
  const contribution = fieldDocuments()[2][1];
  fullEqual(product.parseContributions(contribution.text), { kind: "parsed", value: [contribution.value] },
    "the whole genuine equality document is valid before testing any later field");
  const wrong = contribution.text.replace("role=equality(", "role=EqualityRole(");
  const offset = wrong.indexOf("EqualityRole");
  fieldParseCase("Contributions", wrong, offset, ["equality", "flow", "selection", "argument-flow", "receiver-flow", "context-flow",
    "closure-result-flow", "application-result", "member", "index", "operator", "literal", "protocol", "refinement", "discharge", "default",
    "construction-part"], "EqualityRole");
  const prefix = contribution.text.slice(0, contribution.text.indexOf("reads="));
  fieldParseCase("Contributions", prefix + "reads=false)", prefix.length + "reads=".length, ["["], "false");
  const bounds = contribution.text.slice(0, contribution.text.indexOf("bounds="));
  fieldParseCase("Contributions", bounds + "bounds=[false])", bounds.length + "bounds=[".length, ["number"], "false");
});

test("typed construction waits for whole valid text even at compatible nested pending fields", () => {
  const inferred = recordGolden("InferenceGroup", { id: groupGolden, bodies: emptyGolden,
    signatures: arrayGolden([recordGolden("InferredSignaturePart", { definition: definitionGolden,
      part: recordGolden("return", {}, "return") })]) });
  const flow = constraintsGolden([recordGolden("flow", { occurrence: nodeGolden, from: typeGolden, to: typeGolden,
    role: scalarGolden("argument"), bindings: bindingGolden }, "flow")]);
  const contribution = fieldDocuments()[2][1];
  const solved = solutionGolden([recordGolden("op", { operation: operationGolden(recordGolden("boolean-operator", {
    operator: scalarGolden("&&") }, "boolean-operator")) }, "op")]);
  for (const [family, document, marker, field] of [["InferenceGroup", inferred, "part=return()", "pa"],
    ["Constraints", flow, "role=", "ro"], ["Contributions", contribution, "node=n:0", "no"],
    ["Solution", solved, 'operator="&&"', "op"]]) {
    const prefix = document.text.slice(0, document.text.indexOf(marker));
    const text = prefix + `"${field}\\q`;
    fieldParseCase(family, text, text.length - 1, ["JSON escape"], "q");
    const unfinished = prefix + `"${field}`;
    fieldParseCase(family, unfinished, unfinished.length, ['"'], null);
  }
});

test("all four parsers retain decoded pending field names before later escape and EOF failures", () => {
  for (const [family, document, firstField, escapedFirst] of fieldDocuments()) {
    const opening = document.text.slice(0, document.text.indexOf("(") + 1);
    const firstOffset = opening.length;
    const fullPrefix = document.text.slice(0, -1) + ", ";
    const early = document.text.replace(`${firstField}=`, '"wrong"=');
    const rows = [
      [opening + '"wrong\\q"=Unknown())', firstOffset + 1, [firstField], "wrong"],
      [opening + '"wrong', firstOffset + 1, [firstField], "wrong"],
      [opening + '"\\u0077rong\\q', firstOffset + 1, [firstField], "wrong"],
      [opening + '"wrong"\\q', firstOffset + 1, [firstField], "wrong"],
      [opening + '"wrong\\uQQQQ', firstOffset + 1, [firstField], "wrong"],
      [opening + '"wrong\\', firstOffset + 1, [firstField], "wrong"],
      [opening + '"wrong\n', firstOffset + 1, [firstField], "wrong"],
      [fullPrefix + '"extra\\q', fullPrefix.length + 1, ["end of record"], "extra"],
      [fullPrefix + '"extra', fullPrefix.length + 1, ["end of record"], "extra"],
      [fullPrefix + '"', fullPrefix.length + 1, ['"'], null],
      [fullPrefix + '"extra"\\q', fullPrefix.length + 1, ["end of record"], "extra"],
      [fullPrefix + '"extra"="value\\q', fullPrefix.length + 1, ["end of record"], "extra"],
      [early.slice(0, -1) + ', "extra\\q', firstOffset + 1, [firstField], "wrong"],
      ['Wrong("wrong\\q', 0, [family === "Constraints" ? "ConstraintSet" : family === "Contributions" ? "AtomicContribution" : family], "Wrong"],
    ];
    for (const prefix of ["", firstField.slice(0, 1), firstField, escapedFirst]) {
      const malformed = opening + `"${prefix}\\q", wrong=@)`;
      rows.push([malformed, opening.length + prefix.length + 2, ["JSON escape"], "q"]);
      const unfinished = opening + `"${prefix}`;
      rows.push([unfinished, unfinished.length, ['"'], null]);
    }
    const missingEquals = opening + JSON.stringify(firstField);
    rows.push([missingEquals, missingEquals.length, ["="], null]);
    rows.push([missingEquals + " false", missingEquals.length + 1, ["="], "false"]);
    const malformedUnicode = opening + `"${firstField}\\uQQQQ`;
    rows.push([malformedUnicode, opening.length + firstField.length + 3, ["four hexadecimal digits"], "QQQQ"]);
    const danglingEscape = opening + `"${firstField}\\`;
    rows.push([danglingEscape, danglingEscape.length, ["JSON escape"], null]);
    const control = opening + `"${firstField}\n`;
    rows.push([control, control.length - 1, ["string character"], "\n"]);
    for (const [text, offset, expected, found] of rows) {
      const lines = text.slice(0, offset).split("\n");
      fullEqual(product[`parse${family}`](text), { kind: "invalid-text", offset, line: lines.length,
        column: lines.at(-1).length + 1, expected, found }, `${family} pending actual field: ${JSON.stringify(text)}`);
    }
    const quoted = document.text.replace(`${firstField}=`, `${JSON.stringify(firstField)}=`);
    fullEqual(product[`parse${family}`](quoted), { kind: "parsed", value: family === "Contributions" ? [document.value] : document.value },
      `${family} complete quoted field remains valid`);
  }
});

test("known next fields use decoded deviations before complete duplicate or lexical read-ahead disposition", () => {
  for (const [family, document, firstField, escapedFirst, nextField] of fieldDocuments()) {
    const opening = document.text.slice(0, document.text.indexOf("(") + 1);
    const start = opening.length;
    const short = firstField[0];
    const changed = `${short}X${firstField.slice(2)}`;
    const rows = [
      [opening + `${changed}=Unknown())`, start + 1, [firstField], changed],
      [opening + `"${changed}"=Unknown())`, start + 2, [firstField], changed],
      [opening + `"${escapedFirst}X${firstField.slice(2)}"=Unknown())`, start + 7, [firstField], changed],
      [opening + `"${short}\\u0058${firstField.slice(2)}"=Unknown())`, start + 2, [firstField], changed],
      [opening + `"\\u0058${firstField.slice(1)}"=Unknown())`, start + 1, [firstField], `X${firstField.slice(1)}`],
      [opening + `${firstField}x=Unknown())`, start + firstField.length, [firstField], `${firstField}x`],
      [opening + `"${firstField}x"=Unknown())`, start + firstField.length + 1, [firstField], `${firstField}x`],
      [opening + `${short}=Unknown())`, start + 1, [firstField], short],
      [opening + short, start + 1, [firstField], short],
      [opening + `"${short}"=Unknown())`, start + 2, [firstField], short],
      [opening + `"${escapedFirst}"=Unknown())`, start + 7, [firstField], short],
      [opening + '""=Unknown())', start + 1, [firstField], ""],
      [opening + `"${changed}\\q`, start + 2, [firstField], changed],
      [opening + `"${escapedFirst}X\\q`, start + 7, [firstField], `${short}X`],
      [opening + `"${short}\\u0058\\q`, start + 2, [firstField], `${short}X`],
      [opening + `"${short}\\q`, start + 3, ["JSON escape"], "q"],
      [opening + '"\\q', start + 2, ["JSON escape"], "q"],
      [opening + '"\\uQQQQ', start + 3, ["four hexadecimal digits"], "QQQQ"],
      [opening + `"${short}`, start + 2, ['"'], null],
      [opening + `${short}@`, start + 1, ["value", "record"], "@"],
      [opening + '"\\n"=Unknown())', start + 1, [firstField], "\n"],
      [opening + '"\\uD800"=Unknown())', start + 1, [firstField], "\ud800"],
    ];
    for (const [text, offset, expected, found] of rows) fieldParseCase(family, text, offset, expected, found);
    const nextSlot = document.text.indexOf(`, ${nextField}=`);
    assert.equal(nextSlot >= 0, true, "the independent root has its actual next field");
    const afterFirst = document.text.slice(0, nextSlot + 2);
    const duplicateRows = [
      [`${firstField}=Unknown())`, 0, ["unique record field"], firstField],
      [`"${firstField}"=Unknown())`, 1, ["unique record field"], firstField],
      [`"${escapedFirst}${firstField.slice(1)}"=Unknown())`, 1, ["unique record field"], firstField],
      [`"${firstField}"\\q`, 1, ["unique record field"], firstField],
      [`${firstField}\\q`, 0, ["unique record field"], firstField],
      [`${short}=Unknown())`, 0, [nextField], short],
      [short, 0, [nextField], short],
      [`${short}\\q`, 0, [nextField], short],
      [`"${short}`, 1, [nextField], short],
      [`"${short}\\q`, 1, [nextField], short],
      [`"${firstField}\\q`, 1, [nextField], firstField],
      [`"${escapedFirst}`, 1, [nextField], short],
      [`"${escapedFirst}\\q`, 1, [nextField], short],
      ['"\\q', 2, ["JSON escape"], "q"],
    ];
    for (const [tail, relative, expected, found] of duplicateRows)
      fieldParseCase(family, afterFirst + tail, afterFirst.length + relative, expected, found);
    const escaped = document.text.replace(`${firstField}=`, `"${escapedFirst}${firstField.slice(1)}"=`);
    fullEqual(product[`parse${family}`](escaped), { kind: "parsed", value: family === "Contributions" ? [document.value] : document.value },
      "the same decoded spelling remains a valid actual field");
    fieldParseCase(family, "\n  " + afterFirst + `"${firstField}"=Unknown())`, afterFirst.length + 4,
      ["unique record field"], firstField);
  }
});

test("no next field uses the empty required name for zero one and several prior fields", () => {
  for (const [family, document, firstField, escapedFirst] of fieldDocuments()) {
    const prefix = document.text.slice(0, -1) + ", ";
    for (const [tail, relative, expected, found] of [
      ['extra=0)', 0, ["end of record"], "extra"],
      ['"extra"=0)', 1, ["end of record"], "extra"],
      ['"\\u0065xtra"=0)', 1, ["end of record"], "extra"],
      ['"extra', 1, ["end of record"], "extra"],
      ['"ex\\q', 1, ["end of record"], "ex"],
      ['"\\u0065x\\q', 1, ["end of record"], "ex"],
      ['""=0)', 1, ["end of record"], ""],
      ['""\\q', 1, ["end of record"], ""],
      [`"${firstField}"=Unknown())`, 1, ["unique record field"], firstField],
      [`"${escapedFirst}${firstField.slice(1)}"=Unknown())`, 1, ["unique record field"], firstField],
      [`${firstField}=Unknown())`, 0, ["unique record field"], firstField],
      [`"${firstField}\\q`, 1, ["end of record"], firstField],
      [`"${firstField[0]}`, 1, ["end of record"], firstField[0]],
      ['"\\q', 2, ["JSON escape"], "q"],
      ['"\\uQQQQ', 3, ["four hexadecimal digits"], "QQQQ"],
      ['"', 1, ['"'], null],
      ['"\\', 2, ["JSON escape"], null],
      ['"\\n\\q', 1, ["end of record"], "\n"],
      ['"\n', 1, ["string character"], "\n"],
    ]) fieldParseCase(family, prefix + tail, prefix.length + relative, expected, found);
  }
  const inferred = recordGolden("InferenceGroup", { id: groupGolden, bodies: emptyGolden,
    signatures: arrayGolden([recordGolden("InferredSignaturePart", { definition: definitionGolden,
      part: recordGolden("return", {}, "return") })]) });
  fullEqual(product.parseInferenceGroup(inferred.text), { kind: "parsed", value: inferred.value },
    "the genuine zero-field inferred part is a complete valid opposite");
  const emptyAt = inferred.text.indexOf("return()") + "return(".length;
  assert.equal(emptyAt >= "return(".length, true, "the actual zero-field inferred part is present");
  for (const [tail, relative, expected, found] of [
    ['extra=0', 0, ["end of record"], "extra"],
    ['"extra"=0', 1, ["end of record"], "extra"],
    ['"\\u0065xtra', 1, ["end of record"], "extra"],
    ['""=0', 1, ["end of record"], ""],
    ['"\\q', 2, ["JSON escape"], "q"],
  ]) fieldParseCase("InferenceGroup", inferred.text.slice(0, emptyAt) + tail, emptyAt + relative, expected, found);
  const contribution = fieldDocuments()[2][1];
  fullEqual(product.parseContributions(contribution.text), { kind: "parsed", value: [contribution.value] },
    "the genuine one-field role is a complete valid opposite");
  const directionAt = contribution.text.indexOf('direction="left-to-right"');
  assert.equal(directionAt >= 0, true, "the real one-field role is present");
  const oneFieldEnd = directionAt + 'direction="left-to-right"'.length;
  for (const [tail, relative, expected, found] of [
    ['extra=0', 0, ["end of record"], "extra"],
    ['"direction"=0', 1, ["unique record field"], "direction"],
    ['"direc\\q', 1, ["end of record"], "direc"],
    ['""=0', 1, ["end of record"], ""],
  ]) {
    const prefix = contribution.text.slice(0, oneFieldEnd) + ", ";
    fieldParseCase("Contributions", prefix + tail, prefix.length + relative, expected, found);
    fieldParseCase("Contributions", contribution.text + "\n" + prefix + tail,
      contribution.text.length + 1 + prefix.length + relative, expected, found);
  }
});

test("closed enum prefixes use actual decoded literals rather than blanket lexical deferral", () => {
  const flow = recordGolden("flow", { occurrence: nodeGolden, from: typeGolden, to: typeGolden,
    role: scalarGolden("argument"), bindings: bindingGolden }, "flow");
  const contribution = recordGolden("AtomicContribution", {
    key: recordGolden("ContributionKey", { node: nodeGolden, candidate: nullGolden,
      role: recordGolden("equality", { direction: scalarGolden("left-to-right") }, "equality") }),
    reads: emptyGolden, bounds: emptyGolden, constraint: referenceGolden });
  const deferred = solutionGolden([recordGolden("deferred", { deferred: deferredGolden("embed", recordGolden("EmbedInput", {
    context: contextGolden, from: evidenceGolden, to: evidenceGolden, role: scalarGolden("argument") })) }, "deferred")]);
  const flowItems = ['"initialization"', '"assignment"', '"argument"', '"return"', '"receiver"', '"yield"', '"member-write"'];
  const documents = [
    ["Constraints", constraintsGolden([flow]), 'role="argument"', flowItems, "arg", "\\u0061rg"],
    ["Contributions", contribution, 'direction="left-to-right"', ['"left-to-right"', '"right-to-left"'], "left", "\\u006ceft"],
    ["Solution", deferred, 'role="argument"', flowItems, "arg", "\\u0061rg"],
  ];
  for (const [family, document, field, expected, compatible, escapedCompatible] of documents) {
    const prefix = document.text.slice(0, document.text.indexOf(field) + field.indexOf("=") + 1);
    const start = prefix.length;
    const rows = [
      ['"broken\\q', start, expected, '"broken'],
      ['"broken', start, expected, '"broken'],
      ['"\\u0062roken\\q', start, expected, '"\\u0062roken'],
      ['"broken\\uQQQQ', start, expected, '"broken'],
      ['"broken\\', start, expected, '"broken'],
      ['"broken\n', start, expected, '"broken'],
      ['"broken", "extra\\q', start, expected, '"broken"'],
      [`"${compatible}\\q", wrong=@)`, start + compatible.length + 2, ["JSON escape"], "q"],
      [`"${escapedCompatible}\\q`, start + escapedCompatible.length + 2, ["JSON escape"], "q"],
      [`"${compatible}`, start + compatible.length + 1, ['"'], null],
      [`"${escapedCompatible}`, start + escapedCompatible.length + 1, ['"'], null],
      [`"${compatible}\\uQQQQ`, start + compatible.length + 3, ["four hexadecimal digits"], "QQQQ"],
      [`"${compatible}\\`, start + compatible.length + 2, ["JSON escape"], null],
      [`"${compatible}\n`, start + compatible.length + 1, ["string character"], "\n"],
    ];
    const complete = field.slice(field.indexOf("=") + 2, -1);
    rows.push([`"${complete}\\q`, start + complete.length + 2, ["JSON escape"], "q"]);
    rows.push([`"${complete}`, start + complete.length + 1, ['"'], null]);
    for (const [tail, offset, items, found] of rows) {
      const text = prefix + tail;
      const lines = text.slice(0, offset).split("\n");
      fullEqual(product[`parse${family}`](text), { kind: "invalid-text", offset, line: lines.length,
        column: lines.at(-1).length + 1, expected: items, found }, `${family} decoded enum prefix: ${JSON.stringify(text)}`);
    }
    fullEqual(product[`parse${family}`](document.text), { kind: "parsed", value: family === "Contributions" ? [document.value] : document.value },
      `${family} complete closed literal remains valid`);
  }
});

test("real plain-string fields keep their later lexical failure for every decoded prefix", () => {
  const literal = constraintsGolden([recordGolden("literal", { occurrence: nodeGolden, value: literalGolden, destination: typeGolden }, "literal")]);
  const saved = solutionGolden([recordGolden("deferred", { deferred: deferredGolden("literal-fit", recordGolden("LiteralFitInput", {
    context: contextGolden, literal: literalGolden, destination: evidenceGolden })) }, "deferred")]);
  for (const [family, document] of [["Constraints", literal], ["Solution", saved]]) {
    const prefix = document.text.slice(0, document.text.indexOf('value="literal"') + "value=".length);
    for (const value of ["", "broken", "argument", "\\u0062roken"]) {
      const malformed = prefix + `"${value}\\q", wrong=@)`;
      const offset = prefix.length + value.length + 2;
      fullEqual(product[`parse${family}`](malformed), { kind: "invalid-text", offset, line: 1, column: offset + 1,
        expected: ["JSON escape"], found: "q" }, `${family} genuine plain string keeps escape failure`);
      const unfinished = prefix + `"${value}`;
      fullEqual(product[`parse${family}`](unfinished), { kind: "invalid-text", offset: unfinished.length, line: 1,
        column: unfinished.length + 1, expected: ['"'], found: null }, `${family} genuine plain string keeps missing quote`);
    }
  }
});

test("unfinished quoted payloads retain actual scalar and numeric identity kind errors", () => {
  const inferred = recordGolden("InferenceGroup", { id: groupGolden, bodies: emptyGolden,
    signatures: arrayGolden([recordGolden("InferredSignaturePart", { definition: definitionGolden,
      part: recordGolden("parameter-initializer", { index: scalarGolden(0) }, "parameter-initializer") })]) });
  const flow = constraintsGolden([recordGolden("flow", { occurrence: nodeGolden, from: typeGolden, to: typeGolden,
    role: scalarGolden("argument"), bindings: bindingGolden }, "flow")]);
  const contribution = recordGolden("AtomicContribution", {
    key: recordGolden("ContributionKey", { node: nodeGolden, candidate: nullGolden,
      role: recordGolden("equality", { direction: scalarGolden("left-to-right") }, "equality") }),
    reads: emptyGolden, bounds: emptyGolden, constraint: referenceGolden });
  const saved = solutionGolden([recordGolden("deferred", { deferred: deferredGolden("embed", recordGolden("EmbedInput", {
    context: contextGolden, from: evidenceGolden, to: evidenceGolden, role: scalarGolden("argument") })) }, "deferred")]);
  const local = constraintsGolden([], [recordGolden("local", { id: scalarGolden(0), occurrence: nodeGolden,
    local: recordGolden("LocalRef", { body: bodyGolden, local: scalarGolden(0, "l") }) }, "local")]);
  const call = constraintsGolden([recordGolden("call", { occurrence: nodeGolden,
    application: recordGolden("ApplicationConstraintData", { captured: captureGolden, permissionScope: nullGolden, callee: typeGolden,
      receiver: nullGolden, typeArguments: emptyGolden, arguments: emptyGolden, candidates: scalarGolden(0, "cand"), result: typeGolden }) }, "call")]);
  const selected = solutionGolden([recordGolden("call", { application: applicationGolden(), operation: nullGolden }, "call")]);
  const protocol = constraintsGolden([recordGolden("protocol", { occurrence: nodeGolden, protocol: scalarGolden("iterate"),
    asynchronous: scalarGolden(false), subject: typeGolden, operands: emptyGolden, result: typeGolden, bindings: bindingGolden }, "protocol")]);
  const stringValue = constraintsGolden([recordGolden("literal", { occurrence: nodeGolden, value: literalGolden, destination: typeGolden }, "literal")]);
  const bigintValue = constraintsGolden([recordGolden("literal", { occurrence: nodeGolden,
    value: recordGolden("bigint", { token: scalarGolden("1n"), value: scalarGolden(1n) }, "bigint"), destination: typeGolden }, "literal")]);
  for (const [family, document, field, replacement, expected, found] of [
    ["InferenceGroup", inferred, "index=0", 'number:"broken\\q', ["number"], "number"],
    ["Constraints", flow, "from=t:0", 't:"broken\\q', ["t"], 't:"broken'],
    ["Contributions", contribution, "node=n:0", 'n:"broken\\q', ["n"], 'n:"broken'],
    ["Solution", saved, "type=t:0", 't:"broken\\q', ["t"], 't:"broken'],
    ["Constraints", local, "local=l:0", 'l:"broken\\q', ["l"], 'l:"broken'],
    ["Constraints", call, "candidates=cand:0", 'cand:"broken\\q', ["cand"], 'cand:"broken'],
    ["Solution", selected, "signature=sig:0", 'sig:"broken\\q', ["sig"], 'sig:"broken'],
    ["Constraints", protocol, "asynchronous=false", 'boolean:"broken\\q', ["boolean"], "boolean"],
    ["Constraints", stringValue, 'value="literal"', 'string:"broken\\q', ["string"], "string"],
    ["Constraints", bigintValue, "value=1n", 'bigint:"broken\\q', ["bigint"], "bigint"],
  ]) {
    const prefix = document.text.slice(0, document.text.indexOf(field) + field.indexOf("=") + 1);
    for (const tail of [replacement, replacement.slice(0, -2)]) {
      const text = prefix + tail;
      fullEqual(product[`parse${family}`](text), { kind: "invalid-text", offset: prefix.length, line: 1,
        column: prefix.length + 1, expected, found }, `${family} earlier actual typed kind before escape or EOF`);
    }
  }
});

test("each parser port returns its own exact invalid-text arm rather than a refusal or guessed empty value", () => {
  for (const [family, expected] of [["Constraints", "ConstraintSet"], ["Contributions", "AtomicContribution"],
    ["InferenceGroup", "InferenceGroup"], ["Solution", "Solution"]]) {
    fullEqual(product[`parse${family}`]("Unknown()"), { kind: "invalid-text", offset: 0, line: 1, column: 1,
      expected: [expected], found: "Unknown" }, `actual parse${family} invalid outcome`);
    resultArms.public.add(`parse${family}:invalid-text`);
  }
});

test("the removed nullable API environment is rejected at its exact text field", () => {
  const value = applicationGolden();
  const removed = value.text.replace(`implementationBindings=${bindingGolden.text}`, "implementationBindings=null");
  const prefix = `Solution(group=group:${JSON.stringify(group)}, variables=[], constraints=[SolvedConstraint(constraint=${referenceGolden.text}, decision=call(application=`;
  const text = `${prefix}${removed}, operation=null))], checks=[], bodies=[])`;
  const offset = text.indexOf("null", text.indexOf("implementationBindings="));
  fullEqual(product.parseSolution(text), { kind: "invalid-text", offset, line: 1, column: offset + 1,
    expected: ["BindingVector"], found: "null" }, "old null spelling is not a compatibility form");
});

test("schema-valid nesting of one hundred thousand levels prints, parses and verifies iteratively", () => {
  const depth = 100000;
  let category = { kind: "dynamic" };
  for (let index = 0; index < depth; index += 1) category = { kind: "choice", alternatives: [category] };
  const value = { ...evidence(), category };
  const constraints = { ...constraintSet(), evidence: [value] };
  const categoryText = `${"choice(alternatives=[".repeat(depth)}dynamic()${"])".repeat(depth)}`;
  const text = `ConstraintSet(group=group:${JSON.stringify(group)}, body=body:${JSON.stringify(body)}, variables=[], candidates=[], evidence=[TypeEvidence(type=t:0, component=${sourceGolden.text}, category=${categoryText}, numeric=null, sum=null, nominal=null, pointer=null)], constraints=[])`;
  assertRoundTrip("Constraints", constraints, text, "actual recursive CategoryEvidence, not invented syntax nesting");
  fullEqual(product.verifyInference(verificationInput({ constraints: [constraints] })), [], "deep actual verifier input remains valid");
});

test("typed sparse arrays and array-to-record cycles report the exact caller-defect path", () => {
  const contributions = [];
  contributions.length = 1;
  assert.throws(() => product.printContributions(contributions), {
    name: "TypeError", message: "Missing inline value at $[0].",
  });
  const reads = [];
  reads.length = 1;
  const contribution = { key: { node: occurrence, candidate: null, role: { kind: "equality", direction: "left-to-right" } },
    reads: [], bounds: [], constraint: { body, index: 0 } };
  assert.throws(() => product.printContributions([contribution, { ...contribution, reads }]), {
    name: "TypeError", message: "Missing inline value at $[1].reads[0].",
  });
  const alternatives = [];
  alternatives.length = 1;
  const constraints = { ...constraintSet(), evidence: [{ ...evidence(), category: { kind: "choice", alternatives } }] };
  assert.throws(() => product.printConstraints(constraints), {
    name: "TypeError", message: "Missing inline value at $.evidence[0].category.alternatives[0].",
  });
  assert.throws(() => product.verifyInference(verificationInput({ constraints: [constraints] })), {
    name: "TypeError", message: "Missing inline value at $.constraints[0].evidence[0].category.alternatives[0].",
  });
  const recursive = [];
  const category = { kind: "choice", alternatives: recursive };
  recursive.push({ kind: "choice", alternatives: recursive });
  const cycle = { ...constraintSet(), evidence: [{ ...evidence(), category }] };
  assert.throws(() => product.printConstraints(cycle), {
    name: "TypeError", message: "Inline cycle at $.evidence[0].category.alternatives[0].alternatives.",
  });
  assert.throws(() => product.verifyInference(verificationInput({ constraints: [cycle] })), {
    name: "TypeError", message: "Inline cycle at $.constraints[0].evidence[0].category.alternatives[0].alternatives.",
  });
});

test("saved member origins compare their complete declared, prototype and mapped data through the public verifier", () => {
  const key = { kind: "text", value: "member" };
  const origins = [{ kind: "declared", declaration: definition }, { kind: "class-prototype", owner: definition },
    { kind: "mapped", owner: source, key: { kind: "number", value: { numerator: 1n, denominator: 1n, negativeZero: false } } }];
  const constraint = { kind: "member", occurrence, receiver: 0, key, access: "read", result: 0, origins, bindings: emptyBindings };
  const input = { context: { occurrence, origin: originGolden.value, bindings: emptyBindings }, receiver: evidence(), key, access: "read", origins };
  const decision = { kind: "deferred", deferred: { invocation: { rule: "member", input }, result: 0 } };
  const original = { constraints: [constraintSet([constraint])], bindingScopes: [emptyScope, emptyScope],
    solution: { ...completeSolution(), constraints: [{ constraint: { body, index: 0 }, decision }] } };
  fullEqual(product.verifyInference(verificationInput(original)), [], "all three actual origin families agree by value");
  const changed = { ...decision, deferred: { ...decision.deferred, invocation: { rule: "member",
    input: { ...input, origins: [...origins].reverse() } } } };
  fullEqual(product.verifyInference(verificationInput({ ...original, solution: { ...original.solution,
    constraints: [{ constraint: { body, index: 0 }, decision: changed }] } })),
  [violation("deferred-invocation", constraintSite(0), "input")], "a complete independently valid but differently ordered origin vector is not echoed as success");
});

test("actual inline cycles are caller defects while a shared inline subtree is encoded twice by value", () => {
  const alternatives = [];
  const category = { kind: "choice", alternatives };
  alternatives.push(category);
  const constraints = { ...constraintSet(), evidence: [{ ...evidence(), category }] };
  assert.throws(() => product.printConstraints(constraints), {
    name: "TypeError", message: "Inline cycle at $.evidence[0].category.alternatives[0].",
  });
  assert.throws(() => product.verifyInference(verificationInput({ constraints: [constraints] })), {
    name: "TypeError", message: "Inline cycle at $.constraints[0].evidence[0].category.alternatives[0].",
  });
  const shared = recordGolden("choice", { alternatives: arrayGolden([categoryGolden, categoryGolden]) }, "choice");
  assert.equal(shared.value.alternatives[0] === shared.value.alternatives[1], true, "the authored input genuinely shares an object");
  const value = recordGolden("TypeEvidence", { type: typeGolden, component: sourceGolden, category: shared,
    numeric: nullGolden, sum: nullGolden, nominal: nullGolden, pointer: nullGolden });
  const golden = constraintsGolden([], [], [], [value]);
  assertRoundTrip("Constraints", golden.value, golden.text, "the shared finite subtree is emitted twice, not rejected or arena-interned");
  const parsed = product.parseConstraints(golden.text);
  assert.equal(parsed.kind, "parsed");
  assert.equal(parsed.value.evidence[0].category.alternatives[0] === parsed.value.evidence[0].category.alternatives[1], false,
    "inline object identity is not part of the value");
  fullEqual(product.verifyInference(verificationInput({ constraints: [golden.value] })), [], "sharing is not an inline cycle");
});

test("the complete actual producer is strict-isolated against genuine allowed public declarations", async () => {
  const areas = JSON.parse(readFileSync(resolve(repository, "test/architecture/quarantine/areas.json"), "utf8"));
  const deps = isolationDeps(tooling, areas.areas.map(area => area.directory));
  const interfaceSources = dependencies.map(name => `packages/host/src/${name}/contract.ts`)
    .concat(["packages/host/src/ids/index.ts", "packages/host/src/diag/index.ts", "packages/host/src/ir-types/index.ts"]);
  const inventory = dependencies.flatMap(name => deps.enumerate(resolve(repository, `packages/host/src/${name}`)))
    .filter(path => path.endsWith(".ts")).map(path => relative(repository, path).split(sep).join("/"));
  const graph = deps.graph(new Map(inventory.map(path => [path, readFileSync(resolve(repository, path), "utf8")])));
  const edges = new Map();
  for (const edge of graph) if (edge.target !== null) {
    const targets = edges.get(edge.source) ?? [];
    targets.push(edge.target); edges.set(edge.source, targets);
  }
  const closure = new Set(interfaceSources);
  for (const path of closure) for (const target of edges.get(path) ?? []) closure.add(target);
  assert.equal([...closure].every(path => inventory.includes(path)), true, "no source outside the actual four admitted dependency owners");
  const report = await compileIsolated(deps, hostCatalogue.find(module => module.name === "ir-infer"), {
    root: repository, sourceFiles: ownedSources, interfaceSources, declarationSources: [...closure].sort(),
    outputDirectory: ".temp/host-f-ir-infer/isolation",
  });
  writeFileSync(resolve(evidenceDirectory, "isolation.json"), `${JSON.stringify(report, null, 2)}\n`);
  assert.equal(report.status, "passed", `${JSON.stringify(report.findings)}\n${report.diagnostics.join("\n")}`);
  deepEqual(report.findings, []);
  assert.equal(report.diagnostics.length, 2);
  assert.equal(report.sourceInventory.length, ownedSources.length + closure.size);
  assert.equal(report.loadedInventory.every(path => report.expectedInventory.includes(path)), true);
  assert.equal(report.provenance.length >= interfaceSources.length, true, "public declaration closure has actual complete producer provenance");
  assert.equal(report.loadedInventory.some(path => path.endsWith("/isolated/packages/host/src/ids/contract.ts")), false);
  assert.equal(report.loadedInventory.some(path => path.endsWith("/isolated/packages/host/src/ir-types/contract.d.ts")), true);
});

test("fresh emitted declarations admit all nine ports and reject exact readonly, shape and removed-form opposites", () => {
  const stage = mkdtempSync(resolve(evidenceDirectory, "consumer-"));
  for (const module of ["ir-infer", ...dependencies]) {
    mkdirSync(resolve(stage, module));
    for (const name of module === "ir-infer" ? ["contract.d.ts", "index.d.ts"]
      : module === "ir-types" ? ["contract.d.ts", "arena.d.ts", "data.d.ts"] : ["contract.d.ts"])
      writeFileSync(resolve(stage, module, name), readFileSync(resolve(repository, `packages/host/dist/${module}/${name}`)));
  }
  writeFileSync(resolve(stage, "package.json"), JSON.stringify({ type: "module", private: true }));
  const positive = `import { printConstraints, parseConstraints, printContributions, parseContributions, printInferenceGroup, parseInferenceGroup, printSolution, parseSolution, verifyInference } from "./ir-infer/index.js";
import type { AtomicContribution, ConstraintSet, InferenceGroup, InferVerificationInput, Solution, PrintConstraints, ParseConstraints, PrintContributions, ParseContributions, PrintInferenceGroup, ParseInferenceGroup, PrintSolution, ParseSolution, VerifyInference } from "./ir-infer/contract.js";
import type { BindingScope, CategoryEvidence, TypeEvidence, TypeParameterIdentity, TypeTable, TypeTerm, Signature } from "./ir-types/contract.js";
import type { DefId } from "./ids/contract.js";
export const callerScopeHoles: readonly BindingScope[] = [
  { classParameters: new Array<TypeParameterIdentity>(2), methodParameters: [], capturedParameters: [], selfOwners: [] },
  { classParameters: [], methodParameters: new Array<TypeParameterIdentity>(2), capturedParameters: [], selfOwners: [] },
  { classParameters: [], methodParameters: [], capturedParameters: new Array<TypeParameterIdentity>(2), selfOwners: [] },
  { classParameters: [], methodParameters: [], capturedParameters: [], selfOwners: new Array<DefId>(2) },
];
export const peerTermHoles: TypeTable = { terms: new Array<TypeTerm>(1), signatures: [] };
export const peerSignatureHoles: TypeTable = { terms: [], signatures: new Array<Signature>(1) };
export function inlineCycle(value: TypeEvidence): TypeEvidence {
  const alternatives: CategoryEvidence[] = [];
  const category: CategoryEvidence = { kind: "choice", alternatives };
  alternatives.push(category);
  return { ...value, category };
}
export function consume(input: InferVerificationInput, constraints: ConstraintSet, contributions: readonly AtomicContribution[], group: InferenceGroup, solution: Solution) {
  const printC: PrintConstraints = printConstraints; const parseC: ParseConstraints = parseConstraints;
  const printA: PrintContributions = printContributions; const parseA: ParseContributions = parseContributions;
  const printG: PrintInferenceGroup = printInferenceGroup; const parseG: ParseInferenceGroup = parseInferenceGroup;
  const printS: PrintSolution = printSolution; const parseS: ParseSolution = parseSolution;
  const verify: VerifyInference = verifyInference;
  return { constraints: parseC(printC(constraints)), contributions: parseA(printA(contributions)), group: parseG(printG(group)), solution: parseS(printS(solution)), violations: verify(input) };
}
`;
  writeFileSync(resolve(stage, "consumer.ts"), positive);
  const run = (name, files) => {
    writeFileSync(resolve(stage, name), JSON.stringify({ compilerOptions: {
      strict: true, noUncheckedIndexedAccess: true, exactOptionalPropertyTypes: true, noUnusedLocals: true,
      noUnusedParameters: true, noImplicitReturns: true, noFallthroughCasesInSwitch: true, skipLibCheck: false,
      noEmit: true, target: "ES2022", lib: ["ES2022"], types: [], module: "NodeNext", moduleResolution: "NodeNext", verbatimModuleSyntax: true,
    }, files }));
    const result = spawnSync(process.execPath, [resolve(tooling, "node_modules/@typescript/native-preview/bin/tsgo.js"),
      "--project", resolve(stage, name), "--pretty", "false", "--listFiles"], {
      cwd: stage, encoding: "utf8", maxBuffer: 1_048_576, timeout: 90_000,
    });
    assert.equal(result.error === undefined, true, "strict consumer compiler completes without application error");
    assert.equal(result.signal, null);
    const text = `${result.stdout}${result.stderr}`;
    writeFileSync(resolve(stage, `${name}.log`), text);
    return { status: result.status, text };
  };
  const accepted = run("positive.json", ["consumer.ts"]);
  assert.equal(accepted.status, 0, accepted.text);
  deepEqual(accepted.text.split(/\r?\n/u).filter(path => path.startsWith(stage)).map(path => relative(stage, path).split(sep).join("/")).sort(),
    ["consumer.ts", "diag/contract.d.ts", "ids/contract.d.ts", "ir-hir/contract.d.ts", "ir-infer/contract.d.ts", "ir-infer/index.d.ts",
      "ir-types/contract.d.ts", "ir-types/arena.d.ts", "ir-types/data.d.ts"].sort());
  const negatives = [
    ["readonly-bodies.ts", 'import type { InferenceGroup } from "./ir-infer/contract.js"; export function change(value: InferenceGroup) { value.bodies.push(); }', 2339],
    ["readonly-owner.ts", 'import type { ConstraintSet } from "./ir-infer/contract.js"; export function change(value: ConstraintSet) { value.body = value.body; }', 2540],
    ["wrong-text.ts", 'import { parseConstraints } from "./ir-infer/index.js"; parseConstraints(1);', 2345],
    ["removed-form.ts", 'import { verifyInference } from "./ir-infer/index.js"; import type { InferVerificationInput } from "./ir-infer/contract.js"; export function change(value: InferVerificationInput) { verifyInference(value, value); }', 2554],
    ["private-helper.ts", 'import { printDocument } from "./ir-infer/index.js"; export const helper = printDocument;', 2305],
    ["wrong-role.ts", 'import type { ContributionRole } from "./ir-infer/contract.js"; export const role: ContributionRole = { kind: "unknown" };', 2322],
    ["mutable-verdict.ts", 'import { verifyInference } from "./ir-infer/index.js"; import type { InferVerificationInput, InferRule, InferSite } from "./ir-infer/contract.js"; import type { Violation } from "./diag/contract.js"; export const changed: (value: InferVerificationInput) => Violation<InferRule, InferSite>[] = verifyInference;', 2322],
    ["readonly-parsed.ts", 'import { parseConstraints } from "./ir-infer/index.js"; const value = parseConstraints(""); if (value.kind === "parsed") value.value.constraints.push();', 2339],
    ["removed-api-null.ts", 'import type { ApplicationDecision } from "./ir-infer/contract.js"; export function change(value: ApplicationDecision): ApplicationDecision { return { ...value, implementationBindings: null }; }', 2322],
    ["wrong-numeric-owner.ts", 'import type { NodeId, TyId } from "./ids/contract.js"; export function change(value: TyId): NodeId { return value; }', 2322],
    ["wrong-text-owner.ts", 'import type { BodyId, DefId } from "./ids/contract.js"; export function change(value: DefId): BodyId { return value; }', 2322],
    ["raw-node-id.ts", 'import type { NodeId } from "./ids/contract.js"; export const value: NodeId = 0;', 2322],
    ["raw-host-code.ts", 'import type { HostDiagnosticCode } from "./diag/contract.js"; export const value: HostDiagnosticCode = "E_HOST";', 2322],
  ];
  for (const [name, text] of negatives) writeFileSync(resolve(stage, name), text);
  const refused = run("negative.json", negatives.map(([name]) => name));
  assert.equal(refused.status, 1, "the pinned compiler reports diagnostics without output as status1");
  const actual = [...refused.text.matchAll(/^(.+)\(\d+,\d+\): error TS(\d+):/gmu)]
    .map(match => [basename(match[1]), Number(match[2])]).sort(([left], [right]) => left.localeCompare(right));
  assert.equal([...refused.text.matchAll(/\berror TS\d+:/gu)].length, actual.length,
    "the complete compiler outcome contains no discarded unlocated diagnostic");
  deepEqual(actual, negatives.map(([name, , code]) => [name, code]).sort(([left], [right]) => left.localeCompare(right)), refused.text);
});

test("the public runtime index contains exactly the nine approved own-contract ports", () => {
  deepEqual(Object.keys(product).sort(), ["parseConstraints", "parseContributions", "parseInferenceGroup", "parseSolution",
    "printConstraints", "printContributions", "printInferenceGroup", "printSolution", "verifyInference"].sort());
  deepEqual(readdirSync(resolve(repository, owner)).filter(name => name.endsWith(".ts")).sort(),
    ["contract.ts", ...runtimeNames.map(name => `${name}.ts`)].sort());
});

test("all four document families retain their complete empty collections and canonical identity framing", () => {
  assertRoundTrip("Constraints", constraintSet(), `ConstraintSet(group=group:${JSON.stringify(group)}, body=body:${JSON.stringify(body)}, variables=[], candidates=[], evidence=[], constraints=[])`, "empty constraints");
  assertRoundTrip("Contributions", [], "", "empty contributions");
  assertRoundTrip("InferenceGroup", { id: group, bodies: [], signatures: [] },
    `InferenceGroup(id=group:${JSON.stringify(group)}, bodies=[], signatures=[])`, "empty group collections parse before verification");
  assertRoundTrip("Solution", { group, variables: [], constraints: [], checks: [], bodies: [] },
    `Solution(group=group:${JSON.stringify(group)}, variables=[], constraints=[], checks=[], bodies=[])`, "empty solution collections");
  fullEqual(product.verifyInference(verificationInput({ types: { terms: [], signatures: [] } })), [],
    "an uncompleted empty constraint set need not invent a type or signature table row");
});

test("authored triples use the existing case runner and compare complete outcomes", async () => {
  for (const level of ["function", "verifier"]) {
    const directory = `test/host-cases/ir-infer/${level}`;
    for (const file of readdirSync(resolve(repository, directory)).filter(name => name.endsWith(".case.json")).sort()) {
      const report = await runCase({ modules: ["ir-infer"],
        evidenceDirectory: resolve(repository, ".temp/host-case-evidence"),
        readText: path => readFileSync(resolve(repository, path), "utf8"),
        canonical: path => relative(repository, realpathSync(resolve(repository, path))).split(sep).join("/"),
        list: path => readdirSync(resolve(repository, path)), decode: text => JSON.parse(text),
        adapters: {
          function: input => {
            assert.equal(input.format, "json");
            const value = JSON.parse(input.text);
            const result = value.operation === "parse" ? product[`parse${value.family}`](value.text)
              : product[`print${value.family}`](value.value);
            return { kind: "accepted", value: result, diagnostics: [] };
          },
          verifier: input => {
            const value = JSON.parse(input.text);
            return { kind: "accepted", value: product.verifyInference(verificationInput(value)), diagnostics: [] };
          },
        },
      }, `${directory}/${file}`);
      assert.equal(report.status, "passed", JSON.stringify(report));
    }
  }
});

test("shared genuine declaration scopes and final bounds retain complete membership opposites", () => {
  const count = 4096;
  const parameters = Array.from({ length: count }, (_, index) => ({ owner: definition, index }));
  const candidate = { ordinal: 0, declaration: definition, appliedSignature: { kind: "available", value: 0 },
    bindings: { kind: "unavailable", reason: "not-provided" }, conditionalFailure: { kind: "available", value: null }, contributions: [] };
  const application = { captured: captureGolden.value, permissionScope: null, callee: 0, receiver: null,
    typeArguments: [], arguments: [], candidates: 0, result: 0 };
  for (const [family, field] of [["class", "classParameters"], ["method", "methodParameters"], ["captured", "capturedParameters"]]) {
    const variables = parameters.map((_, id) => ({ kind: "binder", id, occurrence, application: occurrence, candidate: 0,
      family, parameter: parameters.at(-1) }));
    const set = { ...constraintSet([{ kind: "call", occurrence, application }], variables), candidates: [{ id: 0, candidates: [candidate] }] };
    const input = { constraints: [set], declarations: [[definition, { ...declarationFacts, scope: { ...emptyScope, [field]: parameters } }]] };
    ruleCase("binding-vector-complete", input, { ...input, constraints: [{ ...set, variables: [...variables.slice(0, -1),
      { ...variables.at(-1), parameter: { owner: definition, index: count } }] }] },
    [violation("binding-vector-complete", variableSite(count - 1), "parameter")], `shared ${family} scope is genuine data, not per-variable copying`);
    const freshParameters = parameters.slice(0, 32);
    const independent = verificationInput({ ...input, constraints: [{ ...set, variables: variables.slice(0, 32).map(variable =>
      ({ ...variable, parameter: freshParameters.at(-1) })) }], declarations: [[definition,
      { ...declarationFacts, scope: { ...emptyScope, [field]: freshParameters } }]] });
    const original = independent.declarationOf;
    independent.declarationOf = owner => {
      const value = original(owner);
      return value === null ? null : { ...value, scope: { ...value.scope,
        [field]: value.scope[field].map(parameter => ({ ...parameter })) } };
    };
    fullEqual(product.verifyInference(independent), [], `${family} equal fresh scope values do not require object identity`);
  }
  const constraint = { kind: "default", occurrence, variable: 0, rule: "local-producers", type: 0 };
  const key = { node: occurrence, candidate: null, role: { kind: "default" } };
  const contribution = { key, reads: [], bounds: parameters.map(parameter => parameter.index), constraint: { body, index: 0 } };
  const checks = parameters.map(parameter => ({ variable: parameter.index, contribution: key,
    bound: { contribution: key, variable: parameter.index, kind: "producer", value: evidence() },
    outcome: { kind: "satisfied", embedding: { kind: "identity" } } }));
  const solution = { ...completeSolution(), variables: parameters.map(parameter => ({ variable: parameter.index, value: evidence() })),
    constraints: [{ constraint: { body, index: 0 }, decision: { kind: "default", type: 0 } }], checks };
  const input = { constraints: [constraintSet([constraint], parameters.map(parameter => localVariable(parameter.index)))], contributions: [contribution], solution };
  ruleCase("check-recorded", input, { ...input, contributions: [{ ...contribution, bounds: contribution.bounds.slice(0, -1) }] },
    [violation("check-recorded", { kind: "check", index: count - 1 }, "bound")], "one actual published bounds inventory serves every check");
  const small = { constraints: [constraintSet([constraint], [localVariable(0)])],
    solution: { ...solution, variables: solution.variables.slice(0, 1), checks: checks.slice(0, 1) } };
  const bounded = { ...contribution, bounds: [0] };
  const unbounded = { ...contribution, bounds: [] };
  const site = { kind: "contribution", key };
  fullEqual(product.verifyInference(verificationInput({ ...small, contributions: [{ ...bounded, bounds: [0, 0] }] })),
    [violation("contribution-reads-bounds-declared", site, "bounds")], "a membership index does not erase duplicate-bound diagnostics");
  fullEqual(product.verifyInference(verificationInput({ ...small, contributions: [bounded, unbounded] })), [
    violation("contribution-key-unique", site, "key"), violation("contribution-order", site, "key"),
    violation("contribution-footprint-complete", site, "bounds"),
  ], "duplicate complete keys preserve the first actual published bounds");
  fullEqual(product.verifyInference(verificationInput({ ...small, contributions: [unbounded, bounded] })), [
    violation("contribution-footprint-complete", site, "bounds"), violation("contribution-key-unique", site, "key"),
    violation("contribution-order", site, "key"), violation("check-recorded", { kind: "check", index: 0 }, "bound"),
  ], "reversing duplicate publishers cannot replace the first bounds inventory");
});

test("canonical declaration scope equality charges actual occurrence rows in every family", () => {
  const count = 4096;
  const parameters = Array.from({ length: count }, (_, index) => ({ owner: definition, index }));
  const selfOwners = parameters.map((_, index) => `D[${moduleIdentity};scope${index}]`);
  const owners = selfOwners.map(owner => [owner, { scope: emptyScope, parameterCount: null, endpoints: [] }]);
  const candidate = ordinal => ({ ordinal, declaration: definition,
    appliedSignature: { kind: "unavailable", reason: "not-provided" },
    bindings: { kind: "available", value: emptyBindings },
    conditionalFailure: { kind: "available", value: null }, contributions: [] });
  for (const [field, rows] of [["classParameters", parameters], ["methodParameters", parameters],
    ["capturedParameters", parameters], ["selfOwners", selfOwners]]) {
    for (const length of [1, 2, count]) for (const oneList of [true, false]) {
      const candidates = oneList ? [{ id: 0, candidates: Array.from({ length }, (_, index) => candidate(index)) }]
        : Array.from({ length }, (_, id) => ({ id, candidates: [candidate(0)] }));
      const input = { constraints: [{ ...constraintSet(), candidates }],
        types: { terms: [], signatures: [] }, bindingScopes: Array.from({ length }, () => ({ ...emptyScope })) };
      fullEqual(product.verifyInference(verificationInput({ ...input, declarations: [[definition,
        { scope: { ...emptyScope, [field]: rows }, parameterCount: null, endpoints: [] }], ...owners] })),
      Array.from({ length }, () => violation("binding-vector-complete", bodySite, "declarationScope")),
      `${field}: every available-empty occurrence retains its complete mismatch`);
      fullEqual(product.verifyInference(verificationInput({ ...input, declarations: [[definition,
        { scope: emptyScope, parameterCount: null, endpoints: [] }], ...owners] })), [],
      `${field}: canonical empty scope is the genuine complete valid opposite`);
    }
    const bindingField = field === "classParameters" ? "classBindings" : field === "methodParameters" ? "methodBindings"
      : field === "capturedParameters" ? "capturedBindings" : "selfBindings";
    const first = rows[0];
    const second = rows[1];
    for (const selected of [first, second]) {
      const supplied = { ...emptyScope, [field]: [selected] };
      const bindings = { ...emptyBindings, [bindingField]: [field === "selfOwners"
        ? { kind: "rigid", owner: selected } : { kind: "rigid", parameter: selected }] };
      const input = { constraints: [{ ...constraintSet(), candidates: [{ id: 0, candidates: [
        { ...candidate(0), bindings: { kind: "available", value: bindings } },
      ] }] }], types: { terms: [], signatures: [] }, bindingScopes: [supplied],
      declarations: [[definition, { scope: { ...emptyScope, [field]: [first] }, parameterCount: null, endpoints: [] }], ...owners] };
      fullEqual(product.verifyInference(verificationInput(input)), selected === first ? [] : [
        violation("binding-vector-complete", bodySite, "declarationScope"),
      ], `${field}: equal-length comparison retains genuine identity equality and mismatch`);
    }
  }
  const missing = { constraints: [{ ...constraintSet(), candidates: [{ id: 0, candidates: [candidate(0)] }] }],
    types: { terms: [], signatures: [] }, bindingScopes: [emptyScope], declarations: [] };
  fullEqual(product.verifyInference(verificationInput(missing)), [
    violation("qualified-reference", bodySite, "declarations"),
    violation("binding-vector-complete", bodySite, "declarationScope"),
  ], "missing canonical declaration retains both independent findings");
});

test("canonical scope equality never copies a borrowed long owner per short occurrence", async () => {
  const ids = await import(pathToFileURL(resolve(repository, "packages/host/dist/ids/index.js")).href);
  const module = ids.encodeModuleId({ package: ids.encodePackageId("project"), path: "source.ts" });
  const owner = name => ids.encodeDefId({ module, segments: [{ name, ordinal: 0 }] });
  const longOwner = owner("X".repeat(4096));
  const shortOwner = owner("S");
  const sameLengthOwner = owner("Y".repeat(4096));
  const parameter = (owner, index = 0) => ({ owner, index });
  const facts = { scope: emptyScope, parameterCount: null, endpoints: [] };
  const candidatesFor = (length, oneList, bindings) => {
    const candidate = ordinal => ({ ordinal, declaration: definition,
      appliedSignature: { kind: "unavailable", reason: "not-provided" },
      bindings: { kind: "available", value: bindings }, conditionalFailure: { kind: "available", value: null }, contributions: [] });
    return oneList ? [{ id: 0, candidates: Array.from({ length }, (_, index) => candidate(index)) }]
      : Array.from({ length }, (_, id) => ({ id, candidates: [candidate(0)] }));
  };
  const inputFor = (field, bindingField, canonicalRows, actualRows, length, oneList) => {
    const scope = { ...emptyScope, [field]: actualRows };
    const bindings = { ...emptyBindings, [bindingField]: actualRows.map(value => field === "selfOwners"
      ? { kind: "rigid", owner: value } : { kind: "rigid", parameter: value }) };
    return verificationInput({ constraints: [{ ...constraintSet(), candidates: candidatesFor(length, oneList, bindings) }],
      types: { terms: [], signatures: [] }, bindingScopes: Array.from({ length }, () => scope),
      declarations: [[definition, { ...facts, scope: { ...emptyScope, [field]: canonicalRows } }],
        [longOwner, facts], [shortOwner, facts], [sameLengthOwner, facts]] });
  };
  for (const [field, bindingField] of [["classParameters", "classBindings"], ["methodParameters", "methodBindings"],
    ["capturedParameters", "capturedBindings"], ["selfOwners", "selfBindings"]]) {
    const rowsFor = owner => [field === "selfOwners" ? owner : parameter(owner)];
    for (const length of [1, 2, 4096]) for (const oneList of [false, true]) {
      fullEqual(product.verifyInference(inputFor(field, bindingField, rowsFor(longOwner), rowsFor(shortOwner), length, oneList)),
        Array.from({ length }, () => violation("binding-vector-complete", bodySite, "declarationScope")),
        `${field}: P4096 canonical bytes and N${length} short occurrences preserve the ENTIRE mismatch vector`);
      fullEqual(product.verifyInference(inputFor(field, bindingField, rowsFor(shortOwner), rowsFor(shortOwner), length, oneList)), [],
        `${field}: changing only canonical owner to the actual short owner is the full valid opposite`);
    }
    fullEqual(product.verifyInference(inputFor(field, bindingField, rowsFor(longOwner), rowsFor(longOwner), 2, true)), [],
      `${field}: actual long occurrence bytes are legitimate value equality, not pointer identity`);
    fullEqual(product.verifyInference(inputFor(field, bindingField, rowsFor(longOwner), rowsFor(sameLengthOwner), 2, false)),
      Array.from({ length: 2 }, () => violation("binding-vector-complete", bodySite, "declarationScope")),
      `${field}: equal owner lengths do not replace exact owner value equality`);
    const canonicalRows = field === "selfOwners" ? [longOwner, shortOwner] : [parameter(longOwner), parameter(shortOwner)];
    fullEqual(product.verifyInference(inputFor(field, bindingField, canonicalRows, [...canonicalRows].reverse(), 2, true)),
      Array.from({ length: 2 }, () => violation("binding-vector-complete", bodySite, "declarationScope")),
      `${field}: exact declared row order is preserved`);
    fullEqual(product.verifyInference(inputFor(field, bindingField, canonicalRows, [...canonicalRows], 2, false)), [],
      `${field}: complete paired row sequences retain the valid opposite`);
    const changedTail = field === "selfOwners" ? [longOwner, sameLengthOwner]
      : [parameter(longOwner), parameter(sameLengthOwner)];
    fullEqual(product.verifyInference(inputFor(field, bindingField, canonicalRows, changedTail, 2, true)),
      Array.from({ length: 2 }, () => violation("binding-vector-complete", bodySite, "declarationScope")),
      `${field}: a later row mismatch cannot be hidden by an equal first row`);
    if (field === "selfOwners") continue;
    for (const [expected, actual, equal] of [[NaN, NaN, true], [-0, -0, true], [0, 0, true],
      [-0, 0, false], [0, -0, false], [NaN, 0, false], [0, NaN, false]]) {
      fullEqual(product.verifyInference(inputFor(field, bindingField, [parameter(shortOwner, expected)],
        [parameter(shortOwner, actual)], 2, false)), equal ? [] :
        Array.from({ length: 2 }, () => violation("binding-vector-complete", bodySite, "declarationScope")),
      `${field}: numeric parameter identity preserves NaN and both zero spellings exactly`);
    }
  }
});

test("paired caller scope holes retain their exact canonical and lower-owner findings", () => {
  const other = `D[${moduleIdentity};scopeOther]`;
  for (const [field, bindingField] of [["classParameters", "classBindings"], ["methodParameters", "methodBindings"],
    ["capturedParameters", "capturedBindings"], ["selfOwners", "selfBindings"]]) {
    const rows = field === "selfOwners" ? [definition, other]
      : [{ owner: definition, index: 0 }, { owner: definition, index: 1 }];
    const bindings = { ...emptyBindings, [bindingField]: rows.map(value => field === "selfOwners"
      ? { kind: "rigid", owner: value } : { kind: "rigid", parameter: value }) };
    for (const length of [1, 2]) for (const holes of length === 1 ? [[0]] : [[0], [1], [0, 1]]) {
      const denseRows = rows.slice(0, length);
      const sparseRows = new Array(length);
      for (const [index, value] of denseRows.entries()) if (!holes.includes(index)) sparseRows[index] = value;
      const denseBindings = { ...bindings, [bindingField]: bindings[bindingField].slice(0, length) };
      const candidate = ordinal => ({ ordinal, declaration: definition,
        appliedSignature: { kind: "unavailable", reason: "not-provided" },
        bindings: { kind: "available", value: denseBindings }, conditionalFailure: { kind: "available", value: null }, contributions: [] });
      for (const count of [1, 2]) {
        const input = (canonical, supplied) => verificationInput({
          constraints: [{ ...constraintSet(), candidates: [{ id: 0, candidates: Array.from({ length: count }, (_, index) => candidate(index)) }] }],
          types: { terms: [], signatures: [] }, bindingScopes: Array.from({ length: count }, () => ({ ...emptyScope, [field]: supplied })),
          declarations: [[definition, { scope: { ...emptyScope, [field]: canonical }, parameterCount: null, endpoints: [] }],
            [other, { scope: emptyScope, parameterCount: null, endpoints: [] }]],
        });
        const declarationFindings = Array.from({ length: count }, () => violation("binding-vector-complete", bodySite, "declarationScope"));
        const lowerFindings = Array.from({ length: count * holes.length }, () => violation("binding-vector-complete", bodySite,
          field === "selfOwners" ? "self-owner" : "binding-vector-complete"));
        fullEqual(product.verifyInference(input(denseRows, denseRows)), [], `${field}: dense paired scope valid opposite`);
        fullEqual(product.verifyInference(input(sparseRows, denseRows)), declarationFindings,
          `${field}: canonical-only holes${holes} preserve every declarationScope finding`);
        fullEqual(product.verifyInference(input(denseRows, sparseRows)), [...declarationFindings, ...lowerFindings],
          `${field}: supplied holes${holes} forward the real complete lower-owner vector`);
        fullEqual(product.verifyInference(input(sparseRows, sparseRows)), [...declarationFindings, ...lowerFindings],
          `${field}: holes on both sides remain inequality, not an internal invariant or equal absence`);
      }
    }
  }
});

test("occurrence predecessors and equal-number kind ties preserve complete refusal vectors", () => {
  const pairs = [
    [[-Infinity, -1], false], [[-1, -Infinity], true], [[-1, -0], false], [[-0, -1], true],
    [[-0, 0], false], [[0, -0], true], [[0, 0.5], false], [[0.5, 0], true],
    [[0.5, 1], false], [[1, 0.5], true], [[1, Infinity], false], [[Infinity, 1], true],
    [[Infinity, NaN], false], [[NaN, Infinity], true], [[0, NaN], false], [[NaN, 0], true],
    [[NaN, NaN], false], [[0, 0], false], [[0, 1], false], [[1, 0], true],
  ];
  for (const [values, descending] of pairs) {
    const variables = values.map((node, id) => ({ ...localVariable(id), occurrence: { body, node } }));
    const expected = descending ? [violation("variable-order", variableSite(1), "variables")] : [];
    for (const [id, node] of values.entries())
      if (Object.is(node, -0) || !Number.isSafeInteger(node) || node < 0)
        expected.push(violation("qualified-reference", variableSite(id), "nodes"));
    fullEqual(product.verifyInference(verificationInput({ constraints: [constraintSet([], variables)],
      nodes: [{ owner: source, ids: [0, 1] }] })), expected,
    "all transported occurrence keys use total order without admitting invalid node ids");
  }
  for (const [node, invalid] of [[NaN, true], [-0, true], [0, false]]) {
    for (const reverse of [false, true]) {
      const variables = reverse ? [
        { kind: "literal", id: 0, occurrence: { body, node }, value: { kind: "absence" } },
        { ...localVariable(1), occurrence: { body, node } },
      ] : [
        { ...localVariable(0), occurrence: { body, node } },
        { kind: "literal", id: 1, occurrence: { body, node }, value: { kind: "absence" } },
      ];
      fullEqual(product.verifyInference(verificationInput({ constraints: [constraintSet([], variables)] })), [
        ...(reverse ? [violation("variable-order", variableSite(1), "variables")] : []),
        ...(invalid ? [violation("qualified-reference", variableSite(0), "nodes"),
          violation("qualified-reference", variableSite(1), "nodes")] : []),
      ], "Object.is-equal numeric keys reach the existing local-before-literal kind tie");
    }
  }
});

test("variable and candidate ids retain total predecessor order and independent domain findings", () => {
  const variableCases = [
    [[], []], [[0], []],
    [[-1], [["variable-id-dense", -1, "id"], ["variable-id-dense", 0, "id"]]],
    [[NaN], [["variable-id-dense", NaN, "id"], ["variable-id-dense", 0, "id"]]],
    [[-0], [["variable-id-dense", -0, "id"]]],
    [[NaN, 0], [["variable-id-dense", NaN, "id"], ["variable-order", 0, "variables"],
      ["variable-id-dense", 1, "id"], ["variable-order", 0, "groupVariables"]]],
    [[0, NaN], [["variable-id-dense", NaN, "id"], ["variable-id-dense", 1, "id"]]],
    [[NaN, NaN], [["variable-id-dense", NaN, "id"], ["variable-id-dense", NaN, "id"],
      ["variable-order", NaN, "variables"], ["variable-id-dense", 0, "id"],
      ["variable-id-dense", 1, "id"], ["variable-order", NaN, "groupVariables"]]],
    [[-0, 0], [["variable-id-dense", -0, "id"], ["variable-id-dense", 0, "id"], ["variable-id-dense", 1, "id"]]],
    [[0, -0], [["variable-id-dense", -0, "id"], ["variable-order", -0, "variables"],
      ["variable-id-dense", 1, "id"], ["variable-order", -0, "groupVariables"]]],
    [[0, 1], []],
    [[1, 0], [["variable-order", 0, "variables"], ["variable-order", 0, "groupVariables"]]],
  ];
  for (const [ids, rows] of variableCases) fullEqual(product.verifyInference(verificationInput({
    constraints: [constraintSet([], ids.map(localVariable))],
  })), rows.map(([rule, id, field]) => violation(rule, variableSite(id), field)),
  "variable ids keep all dense-id, per-body and group-wide findings in pass order");
  for (const [ids, errors] of [
    [[], 0], [[0], 0], [[-1], 1], [[NaN], 1], [[-0], 1],
    [[NaN, 0], 2], [[0, NaN], 1], [[NaN, NaN], 2],
    [[-0, 0], 2], [[0, -0], 1], [[0, 0], 1], [[0, 1], 0], [[1, 0], 1],
  ]) fullEqual(product.verifyInference(verificationInput({ constraints: [{ ...constraintSet(),
    candidates: ids.map(id => ({ id, candidates: [] })),
  }] })), Array.from({ length: errors }, () => violation("candidate-order", bodySite, "candidates")),
  "candidate lists retain malformed, duplicate and successor findings without NaN poisoning");
});

test("final publication predecessors preserve total order without suppressing invalid domains", () => {
  const cases = [
    [[-1, 0], [["solution-total", -1]]],
    [[-Infinity, 0], [["solution-total", -Infinity]]],
    [[NaN, 0], [["solution-total", NaN], ["solution-order", 0]]],
    [[0, NaN], [["solution-total", NaN]]],
    [[NaN, NaN, 0], [["solution-total", NaN], ["one-publication-per-variable", NaN],
      ["solution-total", NaN], ["solution-order", NaN], ["solution-order", 0]]],
    [[-0, 0], [["solution-total", -0], ["one-publication-per-variable", 0]]],
    [[0, -0], [["one-publication-per-variable", -0], ["solution-total", -0], ["solution-order", -0]]],
    [[0, 0], [["one-publication-per-variable", 0], ["solution-order", 0]]],
    [[0], []],
  ];
  for (const [ids, rows] of cases) fullEqual(product.verifyInference(verificationInput({
    constraints: [constraintSet([], [localVariable(0)])],
    solution: { ...completeSolution(), variables: ids.map(variable => ({ variable, value: evidence() })) },
  })), rows.map(([rule, id]) => violation(rule, variableSite(id), "variables")),
  "publication id refusals, duplicate publications and total ordering are independent complete outcomes");
});

test("transported numbers have exact total public key ordering before domain refusals", () => {
  const numbers = [-Infinity, -1, -0, 0, 0.5, 1, Infinity, NaN];
  const keyFor = (field, value) => ({ node: { body, node: field === "node" ? value : 0 },
    candidate: field === "candidate" ? value : null,
    role: field === "argument" ? { kind: "argument-flow", argument: value, component: 0 }
      : field === "component" ? { kind: "argument-flow", argument: 0, component: value }
        : field === "parameter" ? { kind: "context-flow", argument: 0, parameter: value }
          : field === "result" ? { kind: "closure-result-flow", argument: 0, result: value }
            : field === "part" ? { kind: "construction-part", part: value } : { kind: "flow" } });
  for (const field of ["node", "candidate", "argument", "component", "parameter", "result", "part"]) {
    for (let index = 0; index + 1 < numbers.length; index += 1) {
      const lower = keyFor(field, numbers[index]);
      const upper = keyFor(field, numbers[index + 1]);
      for (const [keys, reverse] of [[[lower, upper], false], [[upper, lower], true], [[lower, lower], true]]) {
        const contributions = keys.map(key => ({ key, reads: [], bounds: [], constraint: { body, index: 99 } }));
        const expected = [];
        for (const [position, contribution] of contributions.entries()) {
          const site = { kind: "contribution", key: contribution.key };
          if (position === 1 && Object.is(keys[0].node.node, keys[1].node.node) &&
            compareCaseValues(keys[0], keys[1])) expected.push(violation("contribution-key-unique", site, "key"));
          if (position === 1 && reverse) expected.push(violation("contribution-order", site, "key"));
          expected.push(violation("constraint-reference", site, "constraint"));
        }
        if (field === "node") for (const key of keys)
          if (!Number.isSafeInteger(key.node.node) || key.node.node < 0 || Object.is(key.node.node, -0) || key.node.node !== 0)
            expected.push(violation("qualified-reference", { kind: "contribution", key }, "nodes"));
        fullEqual(product.verifyInference(verificationInput({ contributions })), expected,
          `${field} complete ${index} ${reverse ? "reverse/duplicate" : "ascending"} vector; domain faults remain`);
      }
    }
  }
  const candidate = { ordinal: 0, declaration: definition, appliedSignature: { kind: "available", value: 0 },
    bindings: { kind: "unavailable", reason: "not-provided" }, conditionalFailure: { kind: "available", value: null }, contributions: [] };
  const application = { captured: captureGolden.value, permissionScope: null, callee: 0, receiver: null,
    typeArguments: [], arguments: [], candidates: 0, result: 0 };
  const set = { ...constraintSet([{ kind: "call", occurrence, application }]), candidates: [{ id: 0,
    candidates: [candidate, { ...candidate, ordinal: 1 }] }] };
  const contribution = selected => ({ key: { node: occurrence, candidate: selected, role: { kind: "application-result" } },
    reads: [], bounds: [], constraint: { body, index: 0 } });
  fullEqual(product.verifyInference(verificationInput({ constraints: [set], contributions: [contribution(0), contribution(1)] })), [],
    "the two real original candidates remain a full valid opposite");
  for (const pair of [[-Infinity, 0], [-1, 0], [-0, 0], [0, 0.5], [0, Infinity], [0, NaN]]) {
    for (const [values, reversed] of [[pair, false], [[...pair].reverse(), true]]) {
      const contributions = values.map(contribution);
      const expected = [];
      for (const [position, item] of contributions.entries()) {
        const site = { kind: "contribution", key: item.key };
        if (position === 1 && reversed) expected.push(violation("contribution-order", site, "key"));
        if (!Object.is(item.key.candidate, 0)) expected.push(violation("contribution-role", site, "role"),
          violation("candidate-reference", site, "candidate"));
      }
      fullEqual(product.verifyInference(verificationInput({ constraints: [set], contributions })), expected,
        "total ordering never validates or normalizes an invalid original candidate reference");
    }
  }
});

test("nested string Boolean symbol-key and known category arms have complete independent wire values", () => {
  for (const [kind, operators] of [["string-operator", ["+", "==", "!=", "===", "!==", "<", "<=", ">", ">="]],
    ["boolean-operator", ["!", "&&", "||", "==", "!=", "===", "!=="]]]) {
    const decisions = operators.map(operator => recordGolden("op", {
      operation: operationGolden(recordGolden(kind, { operator: scalarGolden(operator) }, kind)) }, "op"));
    for (const ordered of [decisions, [...decisions].reverse()]) {
      const document = solutionGolden(ordered);
      assertRoundTrip("Solution", document.value, document.text, `${kind} complete nested operators and both orders`);
    }
    const document = solutionGolden([decisions[0]]);
    const start = document.text.indexOf('operator="') + "operator=".length;
    fieldParseCase("Solution", document.text.slice(0, start) + '"invalid")', start,
      operators.map(value => JSON.stringify(value)), '"invalid"');
  }
  const symbol = recordGolden("symbol", { declaration: definitionGolden }, "symbol");
  const member = recordGolden("member", { occurrence: nodeGolden, receiver: typeGolden, key: symbol,
    access: scalarGolden("read"), result: typeGolden, origins: emptyGolden, bindings: bindingGolden }, "member");
  const memberDocument = constraintsGolden([member]);
  assertRoundTrip("Constraints", memberDocument.value, memberDocument.text, "MemberKey.symbol is not LiteralValue.unique-symbol");
  const rational = recordGolden("ExactRational", { numerator: scalarGolden(3n), denominator: scalarGolden(2n), negativeZero: scalarGolden(false) });
  const numberKey = recordGolden("number", { value: rational }, "number");
  const numericMember = recordGolden("member", { occurrence: nodeGolden, receiver: typeGolden, key: numberKey,
    access: scalarGolden("write"), result: typeGolden, origins: emptyGolden, bindings: bindingGolden }, "member");
  const numericDocument = constraintsGolden([numericMember]);
  assertRoundTrip("Constraints", numericDocument.value, numericDocument.text, "MemberKey.number retains a full exact rational, not numeric diagnostic data");
  const numerator = numericDocument.text.indexOf("numerator=") + "numerator=".length;
  fieldParseCase("Constraints", numericDocument.text.slice(0, numerator) + '"bad")', numerator, ["bigint"], '"bad"');
  ruleCase("qualified-reference", { constraints: [memberDocument.value], bindingScopes: [emptyScope] },
    { constraints: [{ ...memberDocument.value, constraints: [{ ...member.value,
      key: { kind: "symbol", declaration: `D[${moduleIdentity};absentSymbol]` } }] }], bindingScopes: [emptyScope] },
    [violation("qualified-reference", constraintSite(0), "declarations")], "symbol keys retain their real declaration authority");
  const field = 'declaration=def:';
  const start = memberDocument.text.indexOf(field) + "declaration=".length;
  fieldParseCase("Constraints", memberDocument.text.slice(0, start) + 'def:"wrong")', start, ["def"], 'def:"wrong"');
  for (const category of ["number", "bigint", "boolean", "string", "symbol", "absence", "object", "callable"]) {
    const categoryValue = recordGolden("known", { category: scalarGolden(category) }, "known");
    const value = recordGolden("TypeEvidence", { type: typeGolden, component: sourceGolden, category: categoryValue,
      numeric: nullGolden, sum: nullGolden, nominal: nullGolden, pointer: nullGolden });
    const document = recordGolden("ConstraintSet", { group: groupGolden, body: bodyGolden, variables: emptyGolden,
      candidates: emptyGolden, evidence: arrayGolden([value]), constraints: emptyGolden });
    assertRoundTrip("Constraints", document.value, document.text, `known ${category} complete evidence`);
    const categoryStart = document.text.indexOf(`category="${category}"`) + "category=".length;
    fieldParseCase("Constraints", document.text.slice(0, categoryStart) + '"not-a-category")', categoryStart,
      ["number", "bigint", "boolean", "string", "symbol", "absence", "object", "callable"].map(value => JSON.stringify(value)), '"not-a-category"');
  }
});

test("the shared number order reaches inferred parts and final constraint and check receivers", () => {
  for (const [values, reversed] of [[[0, NaN], false], [[NaN, 0], true], [[0, 0], true], [[-0, 0], false], [[0, -0], true]]) {
    const signatures = values.map(index => ({ definition, part: { kind: "parameter-initializer", index } }));
    const partExpected = [];
    for (const [position, index] of values.entries()) {
      if (Object.is(index, -0) || Number.isNaN(index) || position === 1 && reversed)
        partExpected.push(violation("inferred-part-identity", groupSite, "signatures"));
    }
    fullEqual(product.verifyInference(verificationInput({ group: { id: group, bodies: [body], signatures },
      declarations: [[definition, { ...declarationFacts, parameterCount: 2 }]] })), partExpected,
      "inferred part indexes keep exact invalid domains and total order");
    const solved = values.map(index => ({ constraint: { body, index }, decision: { kind: "eq", equivalent: true } }));
    const solvedExpected = solved.flatMap((record, position) => [violation("constraint-reference", { kind: "constraint", constraint: record.constraint }, "constraint"),
      ...(position === 1 && reversed ? [violation("solution-order", { kind: "constraint", constraint: record.constraint }, "constraints")] : [])]);
    fullEqual(product.verifyInference(verificationInput({ solution: { ...completeSolution(), constraints: solved } })), solvedExpected,
      "final constraint indexes retain complete reference and exact-order results");
    const key = { node: occurrence, candidate: null, role: { kind: "default" } };
    const checks = values.map(variable => ({ variable, contribution: key,
      bound: { contribution: key, variable, kind: "producer", value: evidence() },
      outcome: { kind: "satisfied", embedding: { kind: "identity" } } }));
    const checkExpected = checks.flatMap((_, position) => [violation("check-recorded", { kind: "check", index: position }, "bound"),
      ...(position === 1 && reversed ? [violation("solution-order", { kind: "check", index: position }, "checks")] : [])]);
    fullEqual(product.verifyInference(verificationInput({ solution: { ...completeSolution(), checks } })), checkExpected,
      "final checks do not collapse invalid numeric identities before their domain refusal");
  }
});

test("complete two-body solutions retain order, originating sets and independent endpoint inventories", async () => {
  const ids = await import(pathToFileURL(resolve(repository, "packages/host/dist/ids/index.js")).href);
  const otherDefinition = `D[${moduleIdentity};zrun]`;
  const otherBody = `B[${otherDefinition};function;0]`;
  const actualGroup = ids.encodeGroupId([body, otherBody]);
  const otherSource = { kind: "body", value: { body: otherBody, node: 0 } };
  const otherTyping = { ...bodyTyping, body: otherBody, signature: 1 };
  const otherFacts = { ...declarationFacts, endpoints: [{ declaration: otherDefinition,
    role: "api-body", signature: 1, body: otherBody }] };
  const sets = [{ ...constraintSet(), group: actualGroup }, { ...constraintSet(), group: actualGroup, body: otherBody }];
  const solution = { ...completeSolution(), group: actualGroup, bodies: [bodyTyping, otherTyping] };
  const input = { group: { id: actualGroup, bodies: [body, otherBody], signatures: [] }, constraints: sets, solution,
    declarations: [[definition, declarationFacts], [otherDefinition, otherFacts]],
    types: { terms: [{ kind: "primitive", primitive: "int32" }],
      signatures: [signature, { ...signature, id: 1, declaration: otherDefinition, owner: otherSource }] },
    nodes: [{ owner: source, ids: [0] }, { owner: otherSource, ids: [0] }] };
  ruleCase("solution-order", input, { ...input, solution: { ...solution, bodies: [otherTyping, bodyTyping] } },
    [violation("solution-order", bodySite, "bodies")], "different real bodies are ordered independently of duplicate detection");
  ruleCase("body-completion-endpoints", input, { ...input, constraints: [sets[0]] }, [
    violation("group-ownership", { kind: "group", group: actualGroup }, "bodies"),
    violation("body-completion-endpoints", { kind: "body", body: otherBody }, "body"),
  ], "a published body cannot manufacture an absent originating constraint set");
  ruleCase("body-completion-endpoints", input, { ...input,
    declarations: [[definition, declarationFacts], [otherDefinition, { ...otherFacts, endpoints: [] }]] },
    [violation("body-completion-endpoints", { kind: "body", body: otherBody }, "endpoint")],
    "the second actual callable's body endpoint is checked from its own declaration facts");
});

test("sum evidence retains its own complete binding occurrence in the public verifier", () => {
  const sum = { ...evidence(), sum: { kind: "authored", component: source, bindings: emptyBindings,
    arms: [{ authoredIndex: 0, component: source, member: 0 }] } };
  const input = { constraints: [{ ...constraintSet(), evidence: [sum] }], bindingScopes: [emptyScope] };
  ruleCase("binding-vector-complete", input, { ...input, bindingScopes: [] },
    [violation("binding-vector-complete", bodySite, "bindingScopes[0]")],
    "the nested sum's binding is paired once rather than erased or inferred from its own contents");
});

test("the independent logic inventory includes every approved port and every named final-record rule", () => {
  assert.equal(exercisedPorts.size, 9);
  deepEqual([...inputArms.constraints].sort(), ["eq", "flow", "literal", "op", "member", "index", "call", "construct",
    "construct-literal", "protocol", "refine", "discharge", "default"].sort());
  deepEqual([...inputArms.variables].sort(), ["signature", "local", "binder", "literal"].sort());
  deepEqual([...inputArms.contributions].sort(), ["equality", "flow", "selection", "argument-flow", "receiver-flow", "context-flow",
    "closure-result-flow", "application-result", "member", "index", "operator", "literal", "protocol", "refinement", "discharge", "default", "construction-part"].sort());
  deepEqual([...resultArms.decisions].sort(), ["eq", "flow", "literal", "member", "index", "call", "construct", "op", "construct-literal",
    "protocol", "refine", "discharge", "default", "deferred"].sort());
  assert.equal(resultArms.operations.size, 17);
  assert.equal(resultArms.deferred.size, 13);
  assert.equal(resultArms.public.size, 10);
  deepEqual([...nestedArms.stringOperators].sort(), ["+", "==", "!=", "===", "!==", "<", "<=", ">", ">="].sort());
  deepEqual([...nestedArms.booleanOperators].sort(), ["!", "&&", "||", "==", "!=", "===", "!=="].sort());
  const operators = ["+", "-", "!", "~", "typeof", "void", "delete", "*", "/", "%", "**", "&", "|", "^", "<<", ">>", ">>>",
    "<", "<=", ">", ">=", "==", "!=", "===", "!==", "in", "instanceof"];
  deepEqual([...nestedArms.nativeOperators].sort(), [...operators].sort());
  deepEqual([...nestedArms.bigintOperators].sort(), [...operators].sort());
  assert.equal(nestedArms.nativeCarriers.size, 18);
  deepEqual([...nestedArms.memberKeys].sort(), ["text", "number", "symbol"].sort());
  deepEqual([...nestedArms.knownCategories].sort(), ["number", "bigint", "boolean", "string", "symbol", "absence", "object", "callable"].sort());
  deepEqual([...checkedRules].sort(), ["group-order", "group-ownership", "inferred-part-identity", "variable-id-dense", "variable-order",
    "constraint-reference", "candidate-reference", "candidate-order", "open-term-resolves", "open-term-owner", "contribution-key-unique", "contribution-order",
    "contribution-role", "contribution-reads-bounds-declared", "contribution-footprint-complete", "one-publication-per-variable", "solution-total", "solution-order",
    "no-open-in-solution", "check-recorded", "decision-kind", "binding-vector-complete", "parameter-mapping-total", "endpoint-agreement", "proof-reference",
    "proof-order", "qualified-reference", "body-completion-endpoints", "construction-part-total", "protocol-channels", "api-endpoint-role", "deferred-invocation"].sort());
  console.log("F.ir-infer logic ports9/9 input-outer-arms34/34 result-outer-arms54/54 rules32/32 limits0/0 nested-string9/9 boolean7/7 native27/27 bigint27/27 carriers18/18 member-key3/3 known-category8/8 (no runtime certificate from authored inventory)");
});

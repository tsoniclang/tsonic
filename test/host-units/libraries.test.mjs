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
import { parseSources, readImportGraph } from "../architecture/host/import-graph.mjs";
import { compileIsolated, isolationDeps } from "../architecture/host/isolation.mjs";
import { runCase } from "../host-cases/case.mjs";
import { encodeBodyId, encodeDefId, encodeKey, encodeModuleId, encodePackageId, localId, nodeId, sigId, tyId } from "../../packages/host/dist/ids/index.js";
import { signatureRequestKey } from "../../packages/host/dist/ir-types/index.js";

const repository = fileURLToPath(new URL("../../", import.meta.url));
const tooling = process.env.TSONIC_HOST_TOOLING_ROOT ?? repository;
const sourceDirectory = "packages/host/src/libraries";
const emittedDirectory = resolve(repository, "packages/host/dist/libraries");
const runtimeNames = ["index", "verify-catalogue", "roles", "admit-guarantees", "verify-summaries", "verify-bound"];
const ownedSources = ["contract", ...runtimeNames].map(name => `${sourceDirectory}/${name}.ts`);
const runtimeFiles = runtimeNames.map(name => resolve(emittedDirectory, `${name}.js`));
const coverageSession = new Session();
let product;
let evidenceDirectory;

const post = (method, parameters = {}) => new Promise((done, reject) => {
  coverageSession.post(method, parameters, (error, result) => error === null ? done(result) : reject(error));
});

before(async () => {
  assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined && process.env.TSONIC_TEST_ADMISSION_OWNER !== undefined,
    true, "every owner case and compiler child requires admitted aggregate process-group protection");
  const parent = resolve(repository, ".temp/host-f-libraries");
  mkdirSync(parent, { recursive: true });
  evidenceDirectory = mkdtempSync(resolve(parent, "proof-"));
  coverageSession.connect();
  await post("Debugger.enable");
  await post("Profiler.enable");
  await post("Profiler.startPreciseCoverage", { callCount: true, detailed: true });
  product = await import(pathToFileURL(resolve(emittedDirectory, "index.js")).href);
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
    const raw = { result, sources };
    const report = checkCoverage({
      canonical: realpathSync,
      readText: path => readFileSync(path, "utf8"),
      parse: parseSources,
      project: (url, text) => url.startsWith("file:") ? { path: fileURLToPath(url), text } : null,
    }, runtimeFiles, [raw]);
    const inputs = [...ownedSources.map(path => resolve(repository, path)), ...runtimeFiles].map(path => ({
      path, sha256: createHash("sha256").update(readFileSync(path)).digest("hex"),
    }));
    writeFileSync(resolve(evidenceDirectory, "coverage-raw.json"), `${JSON.stringify(raw)}\n`);
    writeFileSync(resolve(evidenceDirectory, "coverage.json"), `${JSON.stringify(report, null, 2)}\n`);
    writeFileSync(resolve(evidenceDirectory, "source-inputs.json"), `${JSON.stringify(inputs, null, 2)}\n`);
    console.log(`F.libraries actual product coverage: ${evidenceDirectory}`);
    assert.equal(result.length, runtimeNames.length, "all six current executable product owners have nonempty raw rows");
    assert.equal(report.status, "passed", JSON.stringify(report.findings));
    assert.deepEqual(report.findings, []);
    assert.equal(report.files.length, runtimeNames.length);
    for (const file of report.files) {
      assert.equal(file.status, "covered", file.path);
      assert.equal(file.lines, 100, file.path);
      assert.equal(file.branches, 100, file.path);
      assert.equal(file.functions, 100, file.path);
    }
  } finally {
    coverageSession.disconnect();
  }
});

function identity(changes = {}) {
  return { providerId: "provider", providerVersion: "1", packageName: null,
    moduleSpecifier: "library", providerModuleId: "module", ...changes };
}

function exportIdentity(module, exportId = "export", memberId = null, signatureId = null) {
  return { module, exportId, memberId, signatureId };
}

function signature(changes = {}) {
  return { id: "signature", name: null, accessibility: "public", parameters: [], returnType: null,
    typeParameters: [], documentation: null, ...changes };
}

function declaration(changes = {}) {
  return { id: "export", name: "export", exportName: "export", exportKind: "named", kind: "function",
    typeFamily: null, type: null, typeParameters: [], heritage: [], members: [], signatures: [],
    documentation: null, ...changes };
}

function member(changes = {}) {
  return { id: "member", name: { kind: "identifier", text: "member" }, kind: "method", static: false,
    readonly: false, optional: false, type: null, signatures: [], documentation: null, ...changes };
}

function moduleValue(changes = {}) {
  return { identity: identity(), types: [], imports: [], exports: [], roles: [], ...changes };
}

function catalogue(modules = [], declarations = []) {
  return { sources: [{ id: "source", modules, declarations }] };
}

function finding(rule, site, ...detail) {
  return { rule, site, detail: detail.map(value => ({ kind: "text", value })) };
}

function definitionId(name) {
  return encodeDefId({ module: encodeModuleId({ package: encodePackageId("test"), path: "input.ts" }),
    segments: [{ name, ordinal: 0 }] });
}

function identityKey(identity) {
  const module = identity.module;
  return encodeKey([[module.providerId, module.providerVersion, module.packageName,
    module.moduleSpecifier, module.providerModuleId], identity.exportId, identity.memberId, identity.signatureId]);
}

function onlyLookup(identity, value) {
  const key = identityKey(identity);
  return actual => {
    assert.equal(identityKey(actual), key, "only the explicit canonical export projection is admitted");
    return value;
  };
}

function roleError(identity) {
  return { code: { kind: "host", name: "TSONIC_LIBRARY_ROLE_BINDING_INVALID", rendered: "TSONIC_LIBRARY_ROLE_BINDING_INVALID" },
    severity: "error", site: { kind: "none" }, source: "libraries", evidence: [identityKey(identity)],
    message: "Library role binding does not resolve the declared export identity.", arguments: [], related: [], fix: null };
}

function summaryError(identity) {
  return { code: { kind: "host", name: "TSONIC_LIBRARY_SUMMARY_BINDING_INVALID", rendered: "TSONIC_LIBRARY_SUMMARY_BINDING_INVALID" },
    severity: "error", site: { kind: "none" }, source: "libraries", evidence: [identityKey(identity)],
    message: "Library summary binding does not match its declared signature and member.", arguments: [], related: [], fix: null };
}

function lateSummaryError(request) {
  return { code: { kind: "host", name: "TSONIC_LIBRARY_SUMMARY_BINDING_INVALID", rendered: "TSONIC_LIBRARY_SUMMARY_BINDING_INVALID" },
    severity: "error", site: { kind: "none" }, source: "summaries", evidence: [signatureRequestKey(request)],
    message: "The admitted native guarantee has no exact selected declaration, endpoint and signature association.",
    arguments: [], related: [], fix: null };
}

function emptyBindings(changes = {}) {
  return { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [], ...changes };
}

function declaredSignature(definition, changes = {}) {
  return { id: sigId(0), declaration: definition, owner: null, composition: null, kind: "call",
    typeParameters: [], receiver: null, parameters: [], result: tyId(0), ...changes };
}

function exportBinding(definition, changes = {}) {
  const bindings = changes.bindings ?? emptyBindings();
  const signature = changes.signature === undefined ? declaredSignature(definition) : changes.signature;
  const member = changes.member ?? null;
  if (signature === null) return { kind: "noncallable", declaration: definition, bindings, member };
  return { kind: "callable", request: { definition, endpoint: "api-signature", ordinal: 2,
    bindings: { kind: "instantiated", bindings } }, signature, member,
    scope: { classParameters: bindings.classBindings.map(value => value.parameter),
      methodParameters: bindings.methodBindings.map(value => value.parameter),
      capturedParameters: bindings.capturedBindings.map(value => value.parameter),
      selfOwners: bindings.selfBindings.map(value => value.owner) } };
}

const readyAssociation = (identity, selected, guarantee = identity) => selected.kind === "callable"
  ? { ...selected, identity, guarantee } : { ...selected, identity };
const summaryExecutionKey = selected => ({ kind: "declared", execution: { request: selected.request,
  provided: selected.signature.parameters.filter(parameter => parameter.kind !== "rest").length } });

async function bindNativeBatch(bound, declared, associations) {
  const admitted = product.admitGuarantees(bound, declared, associations);
  if (admitted.kind === "refused") return admitted;
  const { bindDeclaredSummary } = await import("../../packages/host/dist/summaries/index.js");
  const summaries = [];
  const diagnostics = [];
  for (const guarantee of admitted.value.guarantees) {
    const selected = associations.find(association => identityKey(association.identity) === identityKey(guarantee.statement.identity));
    assert.equal(selected?.kind, "callable", "a successfully admitted native guarantee has its actual selected callable association");
    const execution = summaryExecutionKey(selected).execution;
    const parameters = selected.signature.parameters.map((parameter, index) => parameter.kind === "rest"
      ? { kind: "rest", parameter: index, arguments: [], passing: parameter.passing }
      : { kind: "argument", parameter: index, argument: index, component: null, passing: parameter.passing });
    const result = bindDeclaredSummary({ signature: selected.signature, parameters,
      source: { kind: "item", value: { owner: selected.request.definition, node: nodeId(0) } } },
      { kind: "native", guarantee, associations, execution });
    if (result.kind === "refused") diagnostics.push(...result.diagnostics);
    else summaries.push(result.value);
  }
  return diagnostics.length === 0 ? { kind: "ok", value: summaries, diagnostics: [] } : { kind: "refused", diagnostics };
}

function selectedMember(changes = {}) {
  return { decision: { key: { kind: "text", value: "not-an-identity-or-name-oracle" }, origins: [],
    selectedDeclarations: [], primary: null, read: null, write: null, getter: null, setter: null,
    bindings: emptyBindings(), location: { kind: "data", check: { kind: "none" }, receiver: "in-place" } }, getter: null, setter: null, ...changes };
}

function emptySummary(binding, changes = {}) {
  return { key: summaryExecutionKey(binding),
    signature: binding.signature.id, arena: { projections: [], producers: [],
      contexts: [{ id: 0, receiver: null, arguments: [], captures: [] }], boundProducers: [],
      origins: [{ id: 0, kind: "complete", producers: [], includesAbsence: false }], boundaries: [] },
    parameters: [], captures: [], result: 0, thrown: 0, writes: [], retention: [], callbacks: [],
    invocationOnlyParameters: [], suspends: false, bindingDependent: false, ...changes };
}

function authoredSummary(identity, changes = {}) {
  return { identity, projections: [], producers: [],
    origins: [{ id: 0, kind: "complete", producers: [], includesAbsence: false }], boundaries: [],
    parameters: [], captures: [], result: 0, thrown: 0, writes: [], retention: [], callbacks: [],
    invocationOnlyParameters: [], suspends: false, bindingDependent: false, ...changes };
}

function summaryInput(parameterCount = 0) {
  const module = identity();
  const parameters = Array.from({ length: parameterCount }, (_, index) => ({ name: `p${index}`, type: 0,
    passingMode: "by-value", optional: false, rest: false, defaultType: null }));
  const input = catalogue([moduleValue({ identity: module, types: [{ id: 0, kind: "unknown" }],
    exports: [declaration({ signatures: [signature({ parameters })] })] })]);
  return { input, summary: authoredSummary(exportIdentity(module, "export", null, "signature")) };
}

function summarySite(identity, table, index) {
  return { kind: "authored-summary", identity, table, index };
}

function expectedSummaryOrder(values) {
  const key = value => {
    const site = value.site;
    const identity = site.identity;
    const module = identity.module;
    assert.equal(site.kind, "authored-summary");
    return encodeKey([["authored-summary", [[module.providerId, module.providerVersion, module.packageName,
      module.moduleSpecifier, module.providerModuleId], identity.exportId, identity.memberId, identity.signatureId],
    site.table, site.index], value.rule, value.detail.map(argument => ["text", argument.value])]);
  };
  return values.map(value => ({ value, key: key(value) })).sort((left, right) => left.key < right.key ? -1 : left.key > right.key ? 1 : 0)
    .map(entry => entry.value);
}

function isolationInputs(deps) {
  const owner = hostCatalogue.find(module => module.name === "libraries");
  const names = new Set(owner.imports);
  for (const name of names) {
    const dependency = hostCatalogue.find(module => module.name === name);
    for (const imported of dependency.imports) names.add(imported);
  }
  const candidates = new Map();
  for (const name of names) {
    const dependency = hostCatalogue.find(module => module.name === name);
    for (const path of deps.enumerate(resolve(repository, dependency.directory))) {
      if (!path.endsWith(".ts") || path.endsWith(".d.ts")) continue;
      const local = relative(repository, path).split(sep).join("/");
      candidates.set(local, readFileSync(path, "utf8"));
    }
  }
  const interfaces = ["ids/contract", "ids/index", "diag/contract", "diag/index", "ir-types/contract", "ir-types/index",
    "ir-tir/contract", "ir-tir/index", "ir-facts/contract", "snapshot/contract"].map(path => `packages/host/src/${path}.ts`);
  for (const path of interfaces) assert.equal(candidates.has(path), true, `actual prerequisite source exists: ${path}`);
  const graph = readImportGraph(parseSources(candidates), candidates);
  const production = new Set(interfaces);
  for (const path of production) {
    for (const edge of graph) if (edge.source === path && edge.target !== null) production.add(edge.target);
  }
  return { owner, interfaces, production: [...production].sort() };
}

test("the public index has exactly the nine approved typed value ports and exact source owners", () => {
  assert.deepEqual(Object.keys(product).sort(), ["admitGuarantees", "bindRoles", "libraryExportKey", "libraryRoleOf", "libraryRolesOf",
    "verifyAuthoredSummaries", "verifyBoundLibraries", "verifyLibraries", "verifyLibraryCatalogue"]);
  assert.deepEqual(readdirSync(resolve(repository, sourceDirectory)).filter(name => name.endsWith(".ts")).sort(),
    ownedSources.map(path => basename(path)).sort());
});

for (const [level, name] of [["verifier", "empty-catalogue"], ["verifier", "duplicate-source"], ["function", "empty-role-binding"]]) {
  test(`independently authored complete JSON outcome ${level}/${name}`, async () => {
    const report = await runCase({
      modules: ["libraries"],
      evidenceDirectory: resolve(repository, ".temp/host-case-evidence"),
      readText: path => readFileSync(resolve(repository, path), "utf8"),
      canonical: path => relative(repository, realpathSync(resolve(repository, path))).split(sep).join("/"),
      list: path => readdirSync(resolve(repository, path)),
      decode: text => JSON.parse(text),
      adapters: {
        verifier: input => ({ kind: "accepted", value: product.verifyLibraryCatalogue((JSON.parse(input.text))), diagnostics: [] }),
        function: input => ({ kind: "accepted", value: product.bindRoles((JSON.parse(input.text)), () => {
          throw new Error("No lookup is admitted for an empty role inventory.");
        }), diagnostics: [] }),
      },
    }, `test/host-cases/libraries/${level}/${name}.case.json`);
    assert.equal(report.status, "passed", JSON.stringify(report));
  });
}

test("catalogue empty, one and several sources/modules/documents are complete and immutable", () => {
  const first = moduleValue({ identity: identity({ providerId: "a" }) });
  const second = moduleValue({ identity: identity({ providerId: "z", packageName: "package" }) });
  const inputs = [{ sources: [] }, catalogue(), catalogue([first]), catalogue([first, second], [
    { fileName: "global.d.ts", sourceText: "", module: null },
    { fileName: "module.d.ts", sourceText: "actual authored text", module: first.identity },
  ]), { sources: [{ id: "a", modules: [first], declarations: [] }, { id: "z", modules: [second], declarations: [] }] }];
  for (const input of inputs) assert.deepEqual(product.verifyLibraryCatalogue((input)), []);
});

test("every factual type arm/native primitive/passing mode/property/visibility arm is accepted without name heuristics", () => {
  const native = ["bool", "char", "int8", "uint8", "int16", "uint16", "int32", "uint32", "int64", "uint64",
    "int128", "uint128", "native-int", "native-uint", "float16", "float32", "float64", "decimal"];
  const passing = ["by-value", "byref-readonly", "byref-readwrite", "byref-writeonly-must-init", "borrow-shared", "borrow-mut", "move"];
  const symbols = ["asyncDispose", "asyncIterator", "dispose", "hasInstance", "isConcatSpreadable", "iterator",
    "match", "matchAll", "replace", "search", "species", "split", "toPrimitive", "toStringTag", "unscopables"];
  const literalValues = [
    { kind: "number", value: { numerator: 0n, denominator: 1n, negativeZero: true } },
    { kind: "number", value: { numerator: -7n, denominator: 11n, negativeZero: false } },
    { kind: "bigint", value: 9007199254740993n }, { kind: "string", value: "\uD800" },
    { kind: "boolean", value: true }, { kind: "boolean", value: false }, { kind: "absence" },
    { kind: "unique-symbol", declaration: definitionId("symbol") },
  ];
  const parameters = passing.map((passingMode, index) => ({ name: `parameter${index}`, type: 0,
    passingMode, optional: index % 2 === 0, rest: false, defaultType: index % 2 === 0 ? 0 : null }));
  const binder = { name: "T", constraints: [0], defaultType: 0, variance: "invariant" };
  const shapes = [
    ...["any", "unknown", "void", "never", "absence", "boolean", "string", "number", "bigint", "object"].map(kind => ({ kind })),
    ...native.map(name => ({ kind: "source-primitive", name })),
    { kind: "source-global", name: "not a known spelling", typeArguments: [0, 1] },
    { kind: "type-parameter", name: "T" }, { kind: "array", elementType: 0 },
    { kind: "tuple", elementTypes: [0, 1] }, { kind: "union", types: [0, 1] },
    { kind: "intersection", types: [0, 1] },
    { kind: "function", signature: signature({ parameters, returnType: 0, typeParameters: [binder] }) },
    ...literalValues.map(value => ({ kind: "literal", value })),
    { kind: "provider-ref", moduleSpecifier: "elsewhere", exportName: "export", localName: "authoredAlias",
      namespaceImport: null, typeArguments: [0] },
    { kind: "provider-ref", moduleSpecifier: "elsewhere", exportName: "export", localName: null,
      namespaceImport: "namespace", typeArguments: [] },
  ];
  const types = shapes.map((shape, id) => ({ id, ...shape }));
  const members = [
    member({ id: "identifier", name: { kind: "identifier", text: "same" } }),
    member({ id: "string", name: { kind: "string-literal", text: "same" }, readonly: true, optional: true }),
    member({ id: "number", name: { kind: "number-literal", value: { numerator: 3n, denominator: 2n, negativeZero: false } } }),
    ...symbols.map(name => member({ id: name, name: { kind: "well-known-symbol", name } })),
    ...["method", "constructor", "property", "field", "indexer"].map(kind => member({ id: kind, kind, static: true,
      type: 0, signatures: [signature({ accessibility: "protected", returnType: 0 })] })),
  ];
  const declarations = ["type", "value", "namespace", "function", "class", "interface", "enum"].map((kind, index) =>
    declaration({ id: kind, name: kind, exportName: kind, kind, exportKind: index === 0 ? "default" : "named",
      type: 0, typeParameters: [{ ...binder, variance: index % 2 === 0 ? "in" : "out" }],
      heritage: [{ kind: "extends", type: 0 }, { kind: "implements", type: 1 }], members,
      signatures: [signature({ parameters, returnType: 0, accessibility: "protected-internal" })], documentation: "retained" }));
  declarations.push(declaration({ id: "all-types", exportName: "all-types", typeParameters: [binder],
    type: types.length, members: [], signatures: [] }));
  types.push({ id: types.length, kind: "tuple", elementTypes: types.map(type => type.id) });
  const input = catalogue([moduleValue({ types, exports: declarations, imports: [
    { moduleSpecifier: "first", defaultImport: null, namespaceImport: null, typeOnly: true, namedImports: [] },
    { moduleSpecifier: "second", defaultImport: "default", namespaceImport: "namespace", typeOnly: false,
      namedImports: ["type", "value", "namespace"].map(kind => ({ exportedName: kind, kind })) },
  ] })]);
  assert.deepEqual(product.verifyLibraryCatalogue((input)), []);
});

test("source IDs, complete module identities and associated text each have their minimal full opposite", () => {
  const firstIdentity = identity({ providerId: "a" });
  const secondIdentity = identity({ providerId: "z" });
  const first = moduleValue({ identity: firstIdentity });
  const second = moduleValue({ identity: secondIdentity });
  assert.deepEqual(product.verifyLibraryCatalogue((catalogue([second, first]))),
    [finding("module-identities-order", { kind: "module", module: firstIdentity })]);
  assert.deepEqual(product.verifyLibraryCatalogue((catalogue([first, { ...first, identity: { ...firstIdentity } }]))),
    [finding("module-identities-unique", { kind: "module", module: firstIdentity })]);
  assert.deepEqual(product.verifyLibraryCatalogue((catalogue([first], [
    { fileName: "missing.d.ts", sourceText: "unchanged", module: secondIdentity },
  ]))), [finding("text-module-resolves", { kind: "text", fileName: "missing.d.ts" })]);
  const variants = [
    firstIdentity, { ...firstIdentity, providerVersion: "2" }, { ...firstIdentity, packageName: "null" },
    { ...firstIdentity, moduleSpecifier: "other" }, { ...firstIdentity, providerModuleId: "other" },
  ];
  for (const changed of variants.slice(1)) {
    const input = { sources: [{ id: "first", modules: [first], declarations: [] },
      { id: "second", modules: [moduleValue({ identity: changed })], declarations: [] }] };
    assert.deepEqual(product.verifyLibraryCatalogue((input)), []);
  }
});

test("dense library type IDs and every direct reference position preserve exact error sites and values", () => {
  const module = identity();
  const sparse = new Array(1);
  assert.deepEqual(product.verifyLibraryCatalogue((catalogue([moduleValue({ types: sparse })]))),
    [finding("type-id-dense", { kind: "module", module }, "0")]);
  for (const id of [-1, -0, 1, 0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.deepEqual(product.verifyLibraryCatalogue((catalogue([moduleValue({ types: [{ id, kind: "unknown" }] })]))),
      [finding("type-id-dense", { kind: "type", module, type: id }, "0")]);
  }
  for (const type of [
    { id: 0, kind: "array", elementType: 9 }, { id: 0, kind: "tuple", elementTypes: [9] },
    { id: 0, kind: "union", types: [9] }, { id: 0, kind: "intersection", types: [9] },
    { id: 0, kind: "source-global", name: "Global", typeArguments: [9] },
    { id: 0, kind: "provider-ref", moduleSpecifier: "provider", exportName: "name", localName: null, namespaceImport: null, typeArguments: [9] },
    { id: 0, kind: "function", signature: signature({ returnType: 9 }) },
  ]) assert.deepEqual(product.verifyLibraryCatalogue((catalogue([moduleValue({ types: [type] })]))),
    [finding("type-reference-resolves", { kind: "type", module, type: 0 }, encodeKey(9))]);
  for (const reference of [-1, -0, 0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.deepEqual(product.verifyLibraryCatalogue((catalogue([moduleValue({ types: [
      { id: 0, kind: "array", elementType: reference },
    ] })]))), [finding("type-reference-resolves", { kind: "type", module, type: 0 }, encodeKey(reference))]);
  }
});

test("every declaration/member/signature/default/constraint reference reports its actual owning full identity", () => {
  const module = identity();
  const root = exportIdentity(module);
  const memberIdentity = exportIdentity(module, "export", "member");
  const binder = { name: "T", constraints: [], defaultType: null, variance: "invariant" };
  const parameter = { name: "p", type: 0, passingMode: "by-value", optional: false, rest: false, defaultType: null };
  const scenarios = [
    [declaration({ type: 9 }), root],
    [declaration({ typeParameters: [{ ...binder, constraints: [9] }] }), root],
    [declaration({ typeParameters: [{ ...binder, defaultType: 9 }] }), root],
    [declaration({ heritage: [{ kind: "extends", type: 9 }] }), root],
    [declaration({ heritage: [{ kind: "implements", type: 9 }] }), root],
    [declaration({ members: [member({ type: 9 })] }), memberIdentity],
    [declaration({ signatures: [signature({ parameters: [{ ...parameter, type: 9 }] })] }), root],
    [declaration({ signatures: [signature({ parameters: [{ ...parameter, defaultType: 9 }] })] }), root],
    [declaration({ signatures: [signature({ returnType: 9 })] }), root],
    [declaration({ signatures: [signature({ typeParameters: [{ ...binder, constraints: [9] }] })] }), root],
    [declaration({ signatures: [signature({ typeParameters: [{ ...binder, defaultType: 9 }] })] }), root],
    [declaration({ members: [member({ signatures: [signature({ parameters: [{ ...parameter, type: 9 }] })] })] }), memberIdentity],
    [declaration({ members: [member({ signatures: [signature({ parameters: [{ ...parameter, defaultType: 9 }] })] })] }), memberIdentity],
    [declaration({ members: [member({ signatures: [signature({ returnType: 9 })] })] }), memberIdentity],
    [declaration({ members: [member({ signatures: [signature({ typeParameters: [{ ...binder, constraints: [9] }] })] })] }), memberIdentity],
    [declaration({ members: [member({ signatures: [signature({ typeParameters: [{ ...binder, defaultType: 9 }] })] })] }), memberIdentity],
  ];
  for (const [value, identity] of scenarios) {
    assert.deepEqual(product.verifyLibraryCatalogue((catalogue([moduleValue({ types: [{ id: 0, kind: "unknown" }], exports: [value] })]))),
      [finding("type-reference-resolves", { kind: "export", identity }, encodeKey(9))]);
  }
  for (const value of [signature({ parameters: [{ ...parameter, type: 9 }] }),
    signature({ parameters: [{ ...parameter, defaultType: 9 }] }), signature({ returnType: 9 }),
    signature({ typeParameters: [{ ...binder, constraints: [9] }] }), signature({ typeParameters: [{ ...binder, defaultType: 9 }] })]) {
    assert.deepEqual(product.verifyLibraryCatalogue((catalogue([moduleValue({ types: [
      { id: 0, kind: "function", signature: value },
    ] })]))), [finding("type-reference-resolves", { kind: "type", module, type: 0 }, encodeKey(9))]);
  }
  assert.deepEqual(product.verifyLibraryCatalogue((catalogue([moduleValue({ types: [{ id: 0, kind: "type-parameter", name: "T" }],
    exports: [declaration({ members: [member({ type: 0 })] })] })]))),
    [finding("type-parameter-resolves", { kind: "export", identity: memberIdentity }, "T")]);
});

test("declaration/member/signature/export-name uniqueness and rest-last are separately checked with full vectors", () => {
  const module = identity();
  const root = exportIdentity(module);
  for (const [exports, expected] of [
    [[declaration(), declaration({ exportName: "other" })], finding("declaration-ids-unique", { kind: "export", identity: root })],
    [[declaration(), declaration({ id: "other" })], finding("export-names-unique", { kind: "export", identity: exportIdentity(module, "other") }, "export")],
    [[declaration({ members: [member(), member()] })], finding("member-ids-unique", { kind: "export", identity: exportIdentity(module, "export", "member") })],
    [[declaration({ signatures: [signature(), signature()] })], finding("signature-ids-unique", { kind: "export", identity: root }, "signature")],
    [[declaration({ members: [member({ signatures: [signature(), signature()] })] })],
      finding("signature-ids-unique", { kind: "export", identity: exportIdentity(module, "export", "member") }, "signature")],
  ]) assert.deepEqual(product.verifyLibraryCatalogue((catalogue([moduleValue({ exports })]))), [expected]);
  const parameter = { name: "p", type: 0, passingMode: "by-value", optional: false, rest: false, defaultType: null };
  assert.deepEqual(product.verifyLibraryCatalogue((catalogue([moduleValue({ types: [{ id: 0, kind: "unknown" }],
    exports: [declaration({ signatures: [signature({ parameters: [{ ...parameter, rest: true }, parameter] })] })] })]))),
  [finding("rest-parameter-last", { kind: "export", identity: root }, "signature", "0")]);
});

test("duplicate arena IDs never overwrite a supplied row or mask its independent bad references", () => {
  const module = identity();
  const first = { id: 0, kind: "array", elementType: 9 };
  const second = { id: 0, kind: "number" };
  for (const types of [[first, second], [second, first]]) {
    assert.deepEqual(product.verifyLibraryCatalogue((catalogue([moduleValue({ types })]))), [
      finding("type-id-dense", { kind: "type", module, type: 0 }, "1"),
      finding("type-reference-resolves", { kind: "type", module, type: 0 }, encodeKey(9)),
    ]);
  }
  assert.deepEqual(product.verifyLibraryCatalogue((catalogue([moduleValue({ types: [
    { id: 1, kind: "array", elementType: 1 },
  ] })]))), [finding("type-id-dense", { kind: "type", module, type: 1 }, "0"),
    finding("type-reference-resolves", { kind: "type", module, type: 1 }, encodeKey(1))]);
});

test("absent dense arena slots retain the complete native missing-row findings", () => {
  const module = identity();
  const types = new Array(1);
  assert.deepEqual(product.verifyLibraryCatalogue((catalogue([moduleValue({ types })]))),
    [finding("type-id-dense", { kind: "module", module }, "0")]);
  const { input, summary } = summaryInput();
  const projections = new Array(1);
  assert.deepEqual(product.verifyAuthoredSummaries(input, ([{ ...summary, projections }])),
    [finding("authored-summary-id-dense", summarySite(summary.identity, "projection", 0))]);
});

test("generic family arity and binder names have independent exact valid/opposite cases", () => {
  const module = identity();
  const site = { kind: "export", identity: exportIdentity(module) };
  const parameter = { name: "T", constraints: [], defaultType: null, variance: "invariant" };
  const valid = declaration({ typeFamily: { exportName: "export", typeArgumentCount: 1 }, typeParameters: [parameter] });
  assert.deepEqual(product.verifyLibraryCatalogue((catalogue([moduleValue({ exports: [valid] })]))), []);
  assert.deepEqual(product.verifyLibraryCatalogue((catalogue([moduleValue({ exports: [
    declaration({ typeFamily: { exportName: "export", typeArgumentCount: 0 } }),
  ] })]))), []);
  assert.deepEqual(product.verifyLibraryCatalogue((catalogue([moduleValue({ exports: [
    declaration({ typeFamily: { exportName: "export", typeArgumentCount: -0 } }),
  ] })]))), [finding("type-family-arity-exact", site)]);
  for (const count of [-1, -0, 0, 2, 0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.deepEqual(product.verifyLibraryCatalogue((catalogue([moduleValue({ exports: [
      { ...valid, typeFamily: { exportName: "export", typeArgumentCount: count } },
    ] })]))), [finding("type-family-arity-exact", site)]);
  }
  assert.deepEqual(product.verifyLibraryCatalogue((catalogue([moduleValue({ exports: [
    declaration({ typeParameters: [parameter, { ...parameter }] }),
  ] })]))), [finding("type-parameter-names-unique", site, "T")]);
  assert.deepEqual(product.verifyLibraryCatalogue((catalogue([moduleValue({ exports: [
    declaration({ signatures: [signature({ typeParameters: [parameter, { ...parameter }] })] }),
  ] })]))), [finding("type-parameter-names-unique", site, "T")]);
  assert.deepEqual(product.verifyLibraryCatalogue((catalogue([moduleValue({ types: [
    { id: 0, kind: "function", signature: signature({ name: "actual callable name", typeParameters: [parameter, { ...parameter }] }) },
  ] })]))), [finding("type-parameter-names-unique", { kind: "type", module, type: 0 }, "T")]);
  assert.deepEqual(product.verifyLibraryCatalogue((catalogue([moduleValue({ exports: [
    declaration({ members: [member({ signatures: [signature({ typeParameters: [parameter, { ...parameter }] })] })] }),
  ] })]))), [finding("type-parameter-names-unique", { kind: "export", identity: exportIdentity(module, "export", "member") }, "T")]);
});

test("exact rationals reject each real malformed number/property value without rejecting negative zero or native precision", () => {
  const module = identity();
  const bad = [
    { numerator: 1n, denominator: 0n, negativeZero: false },
    { numerator: 1n, denominator: -1n, negativeZero: false },
    { numerator: 2n, denominator: 4n, negativeZero: false },
    { numerator: 1n, denominator: 1n, negativeZero: true },
    { numerator: 0n, denominator: 2n, negativeZero: false },
  ];
  for (const value of bad) {
    assert.deepEqual(product.verifyLibraryCatalogue((catalogue([moduleValue({ types: [
      { id: 0, kind: "literal", value: { kind: "number", value } },
    ] })]))), [finding("literal-exact", { kind: "type", module, type: 0 })]);
    assert.deepEqual(product.verifyLibraryCatalogue((catalogue([moduleValue({ exports: [
      declaration({ members: [member({ name: { kind: "number-literal", value } })] }),
    ] })]))), [finding("literal-exact", { kind: "export", identity: exportIdentity(module, "export", "member") })]);
  }
  for (const value of [
    { numerator: 0n, denominator: 1n, negativeZero: false },
    { numerator: 0n, denominator: 1n, negativeZero: true },
    { numerator: 9007199254740993n, denominator: 2n, negativeZero: false },
    { numerator: -9007199254740993n, denominator: 2n, negativeZero: false },
  ]) assert.deepEqual(product.verifyLibraryCatalogue((catalogue([moduleValue({ types: [
    { id: 0, kind: "literal", value: { kind: "number", value } },
  ] })]))), []);
});

test("binder visibility follows actual signature/declaration roots through shared and cyclic arena references", () => {
  const module = identity();
  const binder = { name: "T", constraints: [], defaultType: null, variance: "invariant" };
  const types = [
    { id: 0, kind: "type-parameter", name: "T" },
    { id: 1, kind: "array", elementType: 0 },
    { id: 2, kind: "function", signature: signature({ typeParameters: [binder], returnType: 1 }) },
    { id: 3, kind: "tuple", elementTypes: [1, 1, 4] },
    { id: 4, kind: "union", types: [3] },
  ];
  assert.deepEqual(product.verifyLibraryCatalogue((catalogue([moduleValue({ types, exports: [
    declaration({ id: "bound", exportName: "bound", type: 3, typeParameters: [binder] }),
    declaration({ id: "nested", exportName: "nested", type: 2 }),
  ] })]))), []);
  assert.deepEqual(product.verifyLibraryCatalogue((catalogue([moduleValue({ types, exports: [
    declaration({ id: "bound", exportName: "bound", type: 3, typeParameters: [binder] }),
    declaration({ id: "free", exportName: "free", type: 3 }),
  ] })]))), [finding("type-parameter-resolves", { kind: "export", identity: exportIdentity(module, "free") }, "T")]);
  assert.deepEqual(product.verifyLibraryCatalogue((catalogue([moduleValue({ types, exports: [
    declaration({ signatures: [signature({ returnType: 1, typeParameters: [binder] })] }),
  ] })]))), []);
});

test("local and outer generic scopes retain all missing names and coalesce repeated arena name seeds", () => {
  const module = identity();
  const parameter = name => ({ name, constraints: [], defaultType: null, variance: "invariant" });
  const types = [{ id: 0, kind: "type-parameter", name: "T" }, { id: 1, kind: "type-parameter", name: "U" },
    { id: 2, kind: "type-parameter", name: "T" }, { id: 3, kind: "tuple", elementTypes: [0, 1, 2] }];
  const valid = declaration({ type: 0, typeParameters: [parameter("T")],
    signatures: [signature({ returnType: 1, typeParameters: [parameter("U")] })] });
  assert.deepEqual(product.verifyLibraryCatalogue((catalogue([moduleValue({ types, exports: [valid] })]))), []);
  assert.deepEqual(product.verifyLibraryCatalogue((catalogue([moduleValue({ types,
    exports: [{ ...valid, signatures: [signature({ returnType: 0, typeParameters: [parameter("T")] })] }] })]))), []);
  assert.deepEqual(product.verifyLibraryCatalogue((catalogue([moduleValue({ types,
    exports: [{ ...valid, type: 1 }] })]))),
    [finding("type-parameter-resolves", { kind: "export", identity: exportIdentity(module) }, "U")]);
  assert.deepEqual(product.verifyLibraryCatalogue((catalogue([moduleValue({ types,
    exports: [declaration({ type: 3 })] })]))), [
    finding("type-parameter-resolves", { kind: "export", identity: exportIdentity(module) }, "T"),
    finding("type-parameter-resolves", { kind: "export", identity: exportIdentity(module) }, "U"),
  ]);
});

test("a real 100000-row reference chain and wide shared arena are checked iteratively without a hidden cap", () => {
  const types = Array.from({ length: 100000 }, (_, id) => id === 0
    ? { id, kind: "unknown" } : { id, kind: "array", elementType: id - 1 });
  const input = catalogue([moduleValue({ types, exports: [declaration({ type: 99999 })] })]);
  assert.deepEqual(product.verifyLibraryCatalogue((input)), []);
  const shared = [{ id: 0, kind: "number" }, { id: 1, kind: "tuple", elementTypes: Array(100000).fill(0) }];
  assert.deepEqual(product.verifyLibraryCatalogue((catalogue([moduleValue({ types: shared,
    exports: [declaration({ type: 1 })] })]))), []);
});

test("100000 nested generic functions and a fully bound shared-name arena do not copy visible scopes per node", () => {
  const binder = { name: "T", constraints: [], defaultType: null, variance: "invariant" };
  const types = Array.from({ length: 100000 }, (_, id) => id === 0 ? { id, kind: "type-parameter", name: "T" }
    : { id, kind: "function", signature: signature({ typeParameters: [binder], returnType: id - 1 }) });
  assert.deepEqual(product.verifyLibraryCatalogue((catalogue([moduleValue({ types,
    exports: [declaration({ type: 99999 })] })]))), []);
  const names = Array.from({ length: 10000 }, (_, index) => `T${index}`);
  const parameters = names.map(name => ({ ...binder, name }));
  const shared = names.map((name, id) => ({ id, kind: "type-parameter", name }));
  shared.push({ id: 10000, kind: "tuple", elementTypes: names.map((_, id) => id) });
  const signatures = Array.from({ length: 10000 }, (_, index) => signature({ id: `s${index}`, returnType: index }));
  assert.deepEqual(product.verifyLibraryCatalogue((catalogue([moduleValue({ types: shared,
    exports: [declaration({ type: 10000, typeParameters: parameters, signatures })] })]))), []);
});

test("roles resolve complete export/member/signature identities, not object identity or spelling", () => {
  const module = identity();
  const identities = [exportIdentity(module), exportIdentity(module, "export", null, "signature"),
    exportIdentity(module, "export", "member"), exportIdentity(module, "export", "member", "signature")];
  const roles = ["pointer", "raw-pointer", "load", "store"];
  const value = moduleValue({ identity: module, exports: [declaration({ signatures: [signature()],
    members: [member({ signatures: [signature()] })] })], roles: identities.map((identity, index) => ({ identity, role: roles[index] })) });
  const input = (catalogue([value]));
  assert.deepEqual(product.verifyLibraryCatalogue(input), []);
  for (const [index, selected] of identities.entries()) {
    assert.deepEqual(product.libraryRoleOf(input, { ...selected, module: { ...module } }), roles[index]);
  }
  for (const changes of [{ providerId: "other" }, { providerVersion: "2" }, { packageName: "null" },
    { moduleSpecifier: "other" }, { providerModuleId: "other" }]) {
    assert.deepEqual(product.libraryRoleOf(input, exportIdentity({ ...module, ...changes })), null);
  }
  assert.deepEqual(product.libraryRoleOf(input, exportIdentity(module, "missing")), null);
  assert.deepEqual(product.libraryRoleOf({ sources: [] }, identities[0]), null);
  assert.deepEqual(product.verifyLibraryCatalogue((catalogue([{ ...value, roles: [
    { identity: identities[1], role: "load" }, { identity: identities[0], role: "store" },
  ] }]))), [finding("role-identities-order", { kind: "export", identity: identities[0] })]);
  assert.deepEqual(product.verifyLibraryCatalogue((catalogue([{ ...value, roles: [
    { identity: identities[0], role: "load" }, { identity: identities[0], role: "load" },
  ] }]))), [finding("role-identities-unique", { kind: "export", identity: identities[0] })]);
  const missing = exportIdentity(module, "missing");
  assert.deepEqual(product.verifyLibraryCatalogue((catalogue([{ ...value, roles: [{ identity: missing, role: "load" }] }]))),
    [finding("role-export-resolves", { kind: "export", identity: missing })]);
});

test("role lookup duplicate identity is an exact caller defect, not an ambiguous fabricated answer", () => {
  const module = identity();
  const selected = exportIdentity(module);
  const key = encodeKey([[module.providerId, module.providerVersion, module.packageName, module.moduleSpecifier, module.providerModuleId],
    selected.exportId, selected.memberId, selected.signatureId]);
  const roles = [{ identity: selected, role: "pointer" }, { identity: selected, role: "load" }];
  for (const inputRoles of [roles, [...roles].reverse()]) {
    assert.throws(() => product.libraryRoleOf((catalogue([moduleValue({ roles: inputRoles })])), selected),
      { name: "TypeError", message: `libraries: duplicate role identity ${key}` });
  }
});

test("every role name and empty/single/multiple role-to-definition lookup uses canonical identity order", () => {
  const names = ["source-primitive", "js-string", "attribute", "default-value", "struct", "field", "fixed-array",
    "function-pointer", "pointer", "raw-pointer", "read-only-reference", "read-write-reference", "write-only-reference",
    "shared-borrow", "mutable-borrow", "move", "allocate", "address-of", "bind-pointer", "bind-raw-pointer",
    "project-pointer", "load", "store", "equal-pointer", "equal-raw-pointer", "hash-pointer", "hash-raw-pointer",
    "error-declaration", "error-storage-field"];
  const module = identity();
  for (const role of names) {
    const first = { identity: exportIdentity(module, "a"), role, definition: definitionId("z") };
    const second = { identity: exportIdentity(module, "z"), role, definition: definitionId("a") };
    assert.deepEqual(product.libraryRolesOf({ sources: [], sourceRoles: [] }, role), []);
    assert.deepEqual(product.libraryRolesOf(({ sources: [], sourceRoles: [first] }), role), [definitionId("z")]);
    const catalogueValue = catalogue([moduleValue({ exports: [declaration()], roles: [{ identity: exportIdentity(module), role }] })]);
    assert.deepEqual(product.libraryRoleOf((catalogueValue), exportIdentity(module)), role);
    assert.deepEqual(product.bindRoles(catalogueValue, onlyLookup(exportIdentity(module), definitionId("a"))), { kind: "ok", value: {
      sources: catalogueValue.sources, sourceRoles: [{ identity: exportIdentity(module), role, definition: definitionId("a") }],
    }, diagnostics: [] });
    for (const sourceRoles of [[first, second], [second, first]]) {
      assert.deepEqual(product.libraryRolesOf(({ sources: [], sourceRoles }), role), [definitionId("z"), definitionId("a")]);
    }
  }
  const first = { identity: exportIdentity(module, "a"), role: "pointer", definition: definitionId("same") };
  const second = { identity: exportIdentity(module, "z"), role: "pointer", definition: definitionId("same") };
  assert.deepEqual(product.libraryRolesOf(({ sources: [], sourceRoles: [second, first] }), "pointer"),
    [definitionId("same"), definitionId("same")]);
  assert.deepEqual(product.libraryRolesOf(({ sources: [], sourceRoles: [first, second] }), "load"), []);
});

test("role ordering is total over every module/export/member/signature field and same-identity definition ties", () => {
  const modules = [identity({ providerId: "a", moduleSpecifier: "a", providerModuleId: "a" }),
    identity({ providerId: "a", moduleSpecifier: "a", providerModuleId: "z" }),
    identity({ providerId: "a", moduleSpecifier: "z", providerModuleId: "a" }),
    identity({ providerId: "a", packageName: "", moduleSpecifier: "a", providerModuleId: "a" }),
    identity({ providerId: "a", packageName: "null", moduleSpecifier: "a", providerModuleId: "a" }),
    identity({ providerId: "a", providerVersion: "2", moduleSpecifier: "a", providerModuleId: "a" }),
    identity({ providerId: "z", moduleSpecifier: "a", providerModuleId: "a" })];
  const ordered = modules.map((module, index) => ({ identity: exportIdentity(module), role: "pointer", definition: definitionId(String(index)) }));
  for (let index = 1; index < ordered.length; index += 1) {
    for (const sourceRoles of [[ordered[index - 1], ordered[index]], [ordered[index], ordered[index - 1]]]) {
      assert.deepEqual(product.libraryRolesOf(({ sources: [], sourceRoles }), "pointer"),
        [ordered[index - 1].definition, ordered[index].definition]);
    }
  }
  const first = { identity: exportIdentity(modules[0]), role: "pointer", definition: definitionId("a") };
  const second = { ...first, definition: definitionId("z") };
  for (const sourceRoles of [[first, second], [second, first]]) {
    assert.deepEqual(product.libraryRolesOf(({ sources: [], sourceRoles }), "pointer"), [first.definition, second.definition]);
  }
  assert.deepEqual(product.libraryRolesOf(({ sources: [], sourceRoles: [first, { ...first }] }), "pointer"),
    [first.definition, first.definition]);
  const identities = [exportIdentity(modules[0], "a"), exportIdentity(modules[0], "a", null, "a"),
    exportIdentity(modules[0], "a", null, "z"), exportIdentity(modules[0], "a", "a"),
    exportIdentity(modules[0], "a", "a", "a"), exportIdentity(modules[0], "a", "a", "z"),
    exportIdentity(modules[0], "a", "z"), exportIdentity(modules[0], "z")];
  for (let index = 1; index < identities.length; index += 1) {
    const left = { identity: identities[index - 1], role: "pointer", definition: first.definition };
    const right = { identity: identities[index], role: "pointer", definition: second.definition };
    for (const sourceRoles of [[left, right], [right, left]]) {
      assert.deepEqual(product.libraryRolesOf(({ sources: [], sourceRoles }), "pointer"), [first.definition, second.definition]);
    }
  }
});

test("role binding is a pure exact supplied-identity projection in both catalogue input orders", () => {
  const module = identity();
  const firstIdentity = exportIdentity(module, "a");
  const secondIdentity = exportIdentity(module, "z");
  const first = { identity: firstIdentity, role: "pointer" };
  const second = { identity: secondIdentity, role: "load" };
  const definitions = new Map([[identityKey(firstIdentity), definitionId("z")], [identityKey(secondIdentity), definitionId("a")]]);
  for (const roles of [[first, second], [second, first]]) {
    const input = (catalogue([moduleValue({ identity: module, exports: [
      declaration({ id: "a", exportName: "same-a" }), declaration({ id: "z", exportName: "same-z" }),
    ], roles })]));
    const calls = [];
    const result = product.bindRoles(input, identity => {
      const key = identityKey(identity);
      assert.equal(definitions.has(key), true, "no spelling-based or invented export lookup");
      calls.push(key);
      return definitions.get(key);
    });
    assert.deepEqual(result, { kind: "ok", value: { sources: input.sources, sourceRoles: [
      { ...first, definition: definitionId("z") }, { ...second, definition: definitionId("a") },
    ] }, diagnostics: [] });
    assert.deepEqual(calls, [identityKey(firstIdentity), identityKey(secondIdentity)]);
    assert.equal(result.value.sources === input.sources, true, "binding retains the actual factual source vector");
  }
});

test("role binding refuses every missing, foreign-owner, duplicate and ambiguous export without a resolver fallback", () => {
  const module = identity();
  const selected = exportIdentity(module);
  const missing = exportIdentity(module, "missing");
  const foreign = exportIdentity(identity({ providerId: "other" }));
  const inputs = [
    [catalogue([moduleValue({ roles: [{ identity: missing, role: "pointer" }] })]), missing],
    [catalogue([moduleValue({ identity: module, roles: [{ identity: foreign, role: "pointer" }] })]), foreign],
    [catalogue([moduleValue({ exports: [declaration()], roles: [
      { identity: selected, role: "pointer" }, { identity: selected, role: "load" },
    ] })]), selected],
    [catalogue([moduleValue({ exports: [declaration(), declaration({ exportName: "other" })],
      roles: [{ identity: selected, role: "pointer" }] })]), selected],
  ];
  for (const [input, invalidIdentity] of inputs) {
    assert.deepEqual(product.bindRoles((input), () => {
      throw new Error("No resolver is admitted for an invalid authored role identity.");
    }), { kind: "refused", diagnostics: [roleError(invalidIdentity)] });
  }
  const multiple = (catalogue([moduleValue({ roles: [
    { identity: exportIdentity(module, "z"), role: "load" }, { identity: exportIdentity(module, "a"), role: "pointer" },
  ] })]));
  assert.deepEqual(product.bindRoles(multiple, () => { throw new Error("No invalid lookup."); }),
    { kind: "refused", diagnostics: [roleError(exportIdentity(module, "a")), roleError(exportIdentity(module, "z"))] });
  const local = moduleValue({ identity: module, exports: [declaration()], roles: [{ identity: selected, role: "pointer" }] });
  const foreignOwner = moduleValue({ identity: identity({ providerId: "elsewhere" }), roles: [{ identity: selected, role: "pointer" }] });
  for (const modules of [[local, foreignOwner], [foreignOwner, local]]) {
    assert.deepEqual(product.bindRoles((catalogue(modules)), () => { throw new Error("Duplicate cross-owner identity never projects."); }),
      { kind: "refused", diagnostics: [roleError(selected)] });
  }
});

test("bound-role existence and authoritative correspondence are independent complete rules", () => {
  const module = identity();
  const selected = exportIdentity(module);
  const input = (catalogue([moduleValue({ exports: [declaration()], roles: [{ identity: selected, role: "pointer" }] })]));
  const first = definitionId("a");
  const wrong = definitionId("z");
  const binding = { identity: selected, role: "pointer", definition: first };
  const site = { kind: "export", identity: selected };
  const context = (existing, expected = first) => ({
    definitionExists: value => existing.includes(value),
    definitionOfExport: identity => {
      assert.equal(identityKey(identity), identityKey(selected), "only the actual authored export is looked up");
      return expected;
    },
  });
  assert.deepEqual(product.verifyBoundLibraries(({ sources: input.sources, sourceRoles: [binding] }), context([first])), []);
  assert.deepEqual(product.verifyBoundLibraries(({ sources: input.sources, sourceRoles: [{ ...binding, definition: wrong }] }),
    context([first, wrong])), [finding("role-binding-exact", site)]);
  assert.deepEqual(product.verifyBoundLibraries(({ sources: input.sources, sourceRoles: [binding] }), context([])),
    [finding("role-definition-resolves", site)]);
  assert.deepEqual(product.verifyBoundLibraries(({ sources: input.sources, sourceRoles: [{ ...binding, definition: wrong }] }),
    context([first])), [finding("role-binding-exact", site), finding("role-definition-resolves", site)]);
  assert.deepEqual(product.verifyBoundLibraries(({ sources: input.sources, sourceRoles: [{ ...binding, role: "load" }] }),
    context([first])), [finding("role-binding-exact", site)]);
  assert.deepEqual(product.verifyBoundLibraries(({ sources: input.sources, sourceRoles: [binding, { ...binding }] }),
    context([first])), [finding("role-binding-exact", site)]);
  assert.deepEqual(product.verifyBoundLibraries(({ sources: input.sources, sourceRoles: [] }), context([first])),
    [finding("role-binding-exact", site)]);
  assert.deepEqual(product.verifyBoundLibraries(({ sources: catalogue([moduleValue({ exports: [declaration()] })]).sources,
    sourceRoles: [binding] }), context([first])), [finding("role-binding-exact", site)]);
});

test("bound-role global ordering uses every identity component and does not mutate actual supplied rows", () => {
  const firstModule = identity({ providerId: "a" });
  const secondModule = identity({ providerId: "z" });
  const first = { identity: exportIdentity(firstModule), role: "pointer", definition: definitionId("a") };
  const second = { identity: exportIdentity(secondModule), role: "load", definition: definitionId("z") };
  const sources = catalogue([moduleValue({ identity: firstModule, exports: [declaration()], roles: [{ identity: first.identity, role: first.role }] }),
    moduleValue({ identity: secondModule, exports: [declaration()], roles: [{ identity: second.identity, role: second.role }] })]).sources;
  const context = {
    definitionExists: value => value === first.definition || value === second.definition,
    definitionOfExport: identity => {
      if (identityKey(identity) === identityKey(first.identity)) return first.definition;
      assert.equal(identityKey(identity), identityKey(second.identity), "no undeclared lookup");
      return second.definition;
    },
  };
  assert.deepEqual(product.verifyBoundLibraries(({ sources, sourceRoles: [first, second] }), context), []);
  assert.deepEqual(product.verifyBoundLibraries(({ sources, sourceRoles: [second, first] }), context),
    [finding("role-bindings-order", { kind: "export", identity: first.identity })]);
  assert.deepEqual(product.verifyBoundLibraries(({ sources: [], sourceRoles: [] }), {
    definitionExists: () => { throw new Error("No empty definition lookup."); },
    definitionOfExport: () => { throw new Error("No empty export lookup."); },
  }), []);
});

test("ambiguous authored role rows yield their entire catalogue-and-bound vector without choosing either role", () => {
  const module = identity();
  const identityValue = exportIdentity(module);
  const role = { identity: identityValue, role: "pointer" };
  const sources = catalogue([moduleValue({ exports: [declaration()], roles: [role, { ...role }] })]).sources;
  const definition = definitionId("api");
  const context = { definitionExists: value => value === definition,
    definitionOfExport: () => { throw new Error("An ambiguous authored role never projects a winning definition."); } };
  const exact = finding("role-binding-exact", { kind: "export", identity: identityValue });
  const unique = finding("role-identities-unique", { kind: "export", identity: identityValue });
  assert.deepEqual(product.verifyBoundLibraries(({ sources, sourceRoles: [{ ...role, definition }] }), context), [exact, unique]);
  assert.deepEqual(product.verifyBoundLibraries(({ sources, sourceRoles: [] }), context), [exact, exact, unique]);
});

test("authored summaries accept a genuine empty function law and reject absent export/member/signature identities", () => {
  const { input, summary } = summaryInput();
  assert.deepEqual(product.verifyAuthoredSummaries((input), ([])), []);
  assert.deepEqual(product.verifyAuthoredSummaries(input, ([summary])), []);
  for (const identity of [exportIdentity(summary.identity.module, "missing", null, "signature"),
    exportIdentity(summary.identity.module, "export", "missing", "signature"),
    exportIdentity(summary.identity.module, "export", null, "missing"),
    exportIdentity(summary.identity.module)]) {
    assert.deepEqual(product.verifyAuthoredSummaries(input, ([{ ...summary, identity }])),
      [finding("authored-summary-identity-resolves", summarySite(identity, "parameter", null))]);
  }
});

test("authored identity order and uniqueness are independent of source object identity", () => {
  const module = identity();
  const first = authoredSummary(exportIdentity(module, "a", null, "signature"));
  const second = authoredSummary(exportIdentity(module, "z", null, "signature"));
  const input = (catalogue([moduleValue({ exports: [
    declaration({ id: "a", exportName: "a", signatures: [signature()] }),
    declaration({ id: "z", exportName: "z", signatures: [signature()] }),
  ] })]));
  assert.deepEqual(product.verifyAuthoredSummaries(input, ([first, second])), []);
  assert.deepEqual(product.verifyAuthoredSummaries(input, ([second, first])),
    [finding("authored-summaries-order", summarySite(first.identity, "parameter", null))]);
  assert.deepEqual(product.verifyAuthoredSummaries(input, ([first, { ...first, identity: {
    ...first.identity, module: { ...module },
  } }])), [finding("authored-summary-identity-unique", summarySite(first.identity, "parameter", null))]);
});

test("every authored ID table checks dense own slots and preserves the complete dependent-reference vector", () => {
  const { input, summary } = summaryInput();
  const receiver = { id: 0, kind: "receiver", path: null };
  for (const [table, changes] of [
    ["projection", { projections: [{ id: 1, parent: null, projection: { kind: "element" } }] }],
    ["producer", { producers: [{ ...receiver, id: 1 }] }],
    ["boundary", { producers: [receiver], boundaries: [{ id: 1, kind: "external-input", site: 0, subject: 0, owner: null, detail: "actual" }] }],
  ]) assert.deepEqual(product.verifyAuthoredSummaries(input, ([{ ...summary, ...changes }])),
    [finding("authored-summary-id-dense", summarySite(summary.identity, table, 0))]);
  const malformed = { ...summary, origins: [{ id: 1, kind: "complete", producers: [], includesAbsence: false }] };
  assert.deepEqual(product.verifyAuthoredSummaries(input, ([malformed])), expectedSummaryOrder([
    finding("authored-summary-id-dense", summarySite(summary.identity, "origins", 0)),
    finding("authored-summary-reference-resolves", summarySite(summary.identity, "origins", null), "result", encodeKey(0)),
    finding("authored-summary-reference-resolves", summarySite(summary.identity, "origins", null), "thrown", encodeKey(0)),
  ]));
  const sparse = new Array(1);
  assert.deepEqual(product.verifyAuthoredSummaries(input, ([{ ...summary, projections: sparse }])),
    [finding("authored-summary-id-dense", summarySite(summary.identity, "projection", 0))]);
  for (const id of [-1, -0, 0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    for (const [table, changes] of [
      ["projection", { projections: [{ id, parent: null, projection: { kind: "element" } }] }],
      ["producer", { producers: [{ ...receiver, id }] }],
      ["boundary", { producers: [receiver], boundaries: [{ id, kind: "external-input", site: 0, subject: 0, owner: null, detail: "reason" }] }],
    ]) assert.deepEqual(product.verifyAuthoredSummaries(input, ([{ ...summary, ...changes }])),
      [finding("authored-summary-id-dense", summarySite(summary.identity, table, 0))]);
    assert.deepEqual(product.verifyAuthoredSummaries(input, ([{ ...summary,
      origins: [{ id, kind: "complete", producers: [], includesAbsence: false }],
    }])), expectedSummaryOrder([
      finding("authored-summary-id-dense", summarySite(summary.identity, "origins", 0)),
      finding("authored-summary-reference-resolves", summarySite(summary.identity, "origins", null), "result", encodeKey(0)),
      finding("authored-summary-reference-resolves", summarySite(summary.identity, "origins", null), "thrown", encodeKey(0)),
    ]));
  }
  for (const [table, property] of [["producer", "producers"], ["boundary", "boundaries"]]) {
    assert.deepEqual(product.verifyAuthoredSummaries(input, ([{ ...summary, [property]: new Array(1) }])),
      [finding("authored-summary-id-dense", summarySite(summary.identity, table, 0))]);
  }
  assert.deepEqual(product.verifyAuthoredSummaries(input, ([{ ...summary, origins: new Array(1) }])), expectedSummaryOrder([
    finding("authored-summary-id-dense", summarySite(summary.identity, "origins", 0)),
    finding("authored-summary-reference-resolves", summarySite(summary.identity, "origins", null), "result", encodeKey(0)),
    finding("authored-summary-reference-resolves", summarySite(summary.identity, "origins", null), "thrown", encodeKey(0)),
  ]));
});

test("authored projection references and parent-before-child are separately verified without a path repair", () => {
  const { input, summary } = summaryInput();
  const owner = summarySite(summary.identity, "projection", 0);
  assert.deepEqual(product.verifyAuthoredSummaries((input), ([{ ...summary, projections: [
    { id: 0, parent: 0, projection: { kind: "element" } },
  ] }])), [finding("authored-summary-path-parent-precedes", owner)]);
  assert.deepEqual(product.verifyAuthoredSummaries(input, ([{ ...summary, projections: [
    { id: 0, parent: 9, projection: { kind: "element" } },
  ] }])), expectedSummaryOrder([
    finding("authored-summary-path-parent-precedes", owner),
    finding("authored-summary-reference-resolves", owner, "projection", encodeKey(9)),
  ]));
  const missing = exportIdentity(summary.identity.module, "missing");
  for (const kind of ["field", "method-value"]) {
    assert.deepEqual(product.verifyAuthoredSummaries(input, ([{ ...summary, projections: [
      { id: 0, parent: null, projection: { kind, identity: missing } },
    ] }])), [finding("authored-summary-reference-resolves", owner, "export", identityKey(missing))]);
  }
  const valid = [{ id: 0, parent: null, projection: { kind: "element" } },
    { id: 1, parent: 0, projection: { kind: "index", constant: 9007199254740993n } },
    { id: 2, parent: 1, projection: { kind: "deref" } }];
  assert.deepEqual(product.verifyAuthoredSummaries(input, ([{ ...summary, projections: valid }])), []);
});

test("every declared parameter/capture/logical-site use has its own exact valid and out-of-range opposite", () => {
  const { input, summary } = summaryInput();
  const receiver = { id: 0, kind: "receiver", path: null };
  const complete = { kind: "complete", paths: [] };
  for (const index of [-1, -0, 0, 0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.deepEqual(product.verifyAuthoredSummaries((input), ([{ ...summary, producers: [
      { id: 0, kind: "parameter", index, path: null },
    ] }])), [finding("authored-summary-parameter-range", summarySite(summary.identity, "producer", 0), encodeKey(index))]);
  }
  assert.deepEqual(product.verifyAuthoredSummaries(input, ([{ ...summary, producers: [
    { id: 0, kind: "capture", index: 0, path: null },
  ] }])), [finding("authored-summary-capture-range", summarySite(summary.identity, "producer", 0), encodeKey(0))]);
  assert.deepEqual(product.verifyAuthoredSummaries(input, ([{ ...summary, captures: [
    { index: 1, reads: complete, writes: complete },
  ] }])), [finding("authored-summary-capture-range", summarySite(summary.identity, "capture", 0), encodeKey(1))]);
  for (const site of [-1, -0, 0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.deepEqual(product.verifyAuthoredSummaries(input, ([{ ...summary, producers: [
      { id: 0, kind: "allocation", site, path: null },
    ] }])), [finding("authored-summary-site-integral", summarySite(summary.identity, "producer", 0), encodeKey(site))]);
    assert.deepEqual(product.verifyAuthoredSummaries(input, ([{ ...summary, producers: [receiver], boundaries: [
      { id: 0, kind: "external-input", site, subject: 0, owner: null, detail: "original" },
    ] }])), [finding("authored-summary-site-integral", summarySite(summary.identity, "boundary", 0), encodeKey(site))]);
    for (const kind of ["callback", "suspension"]) {
      assert.deepEqual(product.verifyAuthoredSummaries(input, ([{ ...summary, producers: [receiver], retention: [
        { source: 0, into: { kind, site } },
      ] }])), [finding("authored-summary-site-integral", summarySite(summary.identity, "retention", 0), encodeKey(site))]);
    }
  }
});

test("authored producers use complete value identity while preserving valid distinct paths and kinds", () => {
  const { input, summary } = summaryInput(1);
  const complete = { kind: "complete", paths: [] };
  const producers = [{ id: 0, kind: "receiver", path: null }, { id: 1, kind: "receiver", path: null }];
  assert.deepEqual(product.verifyAuthoredSummaries((input), ([{ ...summary, producers }])),
    [finding("authored-summary-producer-unique", summarySite(summary.identity, "producer", 1))]);
  assert.deepEqual(product.verifyAuthoredSummaries(input, ([{ ...summary,
    projections: [{ id: 0, parent: null, projection: { kind: "element" } }],
    producers: [{ id: 0, kind: "receiver", path: null }, { id: 1, kind: "receiver", path: 0 },
      { id: 2, kind: "parameter", index: 0, path: null }, { id: 3, kind: "capture", index: 0, path: null },
      { id: 4, kind: "shared", identity: exportIdentity(summary.identity.module), path: null },
      { id: 5, kind: "allocation", site: 0, path: null }],
    captures: [{ index: 0, reads: complete, writes: complete }],
  }])), []);
});

test("every authored reference-bearing table has a minimal complete dangling-reference opposite", () => {
  const { input, summary } = summaryInput(1);
  const receiver = { id: 0, kind: "receiver", path: null };
  const boundary = { id: 0, kind: "external-input", site: 0, subject: 0, owner: null, detail: "reason" };
  const complete = { kind: "complete", paths: [] };
  const scenarios = [
    [{ producers: [{ ...receiver, path: 9 }] }, "producer", 0, "projection"],
    [{ origins: [{ id: 0, kind: "complete", producers: [9], includesAbsence: false }] }, "origins", 0, "producer"],
    [{ origins: [{ id: 0, kind: "open", producers: [], includesAbsence: false, boundaries: [9] }] }, "origins", 0, "boundary"],
    [{ producers: [receiver], boundaries: [{ ...boundary, subject: 9 }] }, "boundary", 0, "producer"],
    [{ producers: [receiver], boundaries: [{ ...boundary, owner: 9 }] }, "boundary", 0, "producer"],
    [{ parameters: [{ slot: { kind: "parameter", index: 0 }, reads: { kind: "complete", paths: [9] }, writes: complete }] }, "parameter", 0, "projection"],
    [{ parameters: [{ slot: { kind: "parameter", index: 0 }, reads: complete, writes: { kind: "open", paths: [], boundaries: [9] } }] }, "parameter", 0, "boundary"],
    [{ captures: [{ index: 0, reads: { kind: "complete", paths: [9] }, writes: complete }] }, "capture", 0, "projection"],
    [{ writes: [{ target: 9, value: 0 }] }, "write", 0, "producer"],
    [{ producers: [receiver], writes: [{ target: 0, value: 9 }] }, "write", 0, "origins"],
    [{ retention: [{ source: 9, into: { kind: "return" } }] }, "retention", 0, "producer"],
    [{ producers: [receiver], retention: [{ source: 0, into: { kind: "external", boundary: 9 } }] }, "retention", 0, "boundary"],
    [{ producers: [receiver], retention: [{ source: 0, into: { kind: "receiver", path: 9 } }] }, "retention", 0, "projection"],
    [{ result: 9 }, "origins", null, "result"],
    [{ thrown: 9 }, "origins", null, "thrown"],
  ];
  for (const [changes, table, index, target] of scenarios) {
    assert.deepEqual(product.verifyAuthoredSummaries((input), ([{ ...summary, ...changes }])),
      [finding("authored-summary-reference-resolves", summarySite(summary.identity, table, index), target, encodeKey(9))]);
  }
  const missing = exportIdentity(summary.identity.module, "missing");
  for (const [changes, table] of [
    [{ producers: [{ id: 0, kind: "shared", identity: missing, path: null }] }, "producer"],
    [{ producers: [receiver], retention: [{ source: 0, into: { kind: "shared", identity: missing, path: null } }] }, "retention"],
  ]) assert.deepEqual(product.verifyAuthoredSummaries(input, ([{ ...summary, ...changes }])),
    [finding("authored-summary-reference-resolves", summarySite(summary.identity, table, 0), "export", identityKey(missing))]);
  for (const value of [-1, -0, 0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.deepEqual(product.verifyAuthoredSummaries(input, ([{ ...summary, producers: [receiver],
      origins: [{ id: 0, kind: "complete", producers: [value], includesAbsence: false }],
    }])), [finding("authored-summary-reference-resolves", summarySite(summary.identity, "origins", 0), "producer", encodeKey(value))]);
  }
});

test("complete/open origins and read/write footprints retain strict ordered alternatives and boundaries", () => {
  const { input, summary } = summaryInput(1);
  const complete = { kind: "complete", paths: [] };
  const producers = [{ id: 0, kind: "receiver", path: null }, { id: 1, kind: "allocation", site: 0, path: null }];
  const projections = [{ id: 0, parent: null, projection: { kind: "element" } },
    { id: 1, parent: 0, projection: { kind: "deref" } }];
  const boundaries = [0, 1].map(id => ({ id, kind: "external-input", site: id, subject: 0, owner: null, detail: "reason" }));
  for (const values of [[1, 0], [0, 0]]) {
    assert.deepEqual(product.verifyAuthoredSummaries((input), ([{ ...summary, producers, origins: [
      { id: 0, kind: "complete", producers: values, includesAbsence: false },
    ] }])), [finding("authored-summary-origins-order", summarySite(summary.identity, "origins", 0))]);
    assert.deepEqual(product.verifyAuthoredSummaries(input, ([{ ...summary, producers, boundaries, origins: [
      { id: 0, kind: "open", producers: [], includesAbsence: true, boundaries: values },
    ] }])), [finding("authored-summary-origins-order", summarySite(summary.identity, "origins", 0))]);
    for (const field of ["reads", "writes"]) {
      const effect = { slot: { kind: "parameter", index: 0 }, reads: complete, writes: complete,
        [field]: { kind: "complete", paths: values } };
      assert.deepEqual(product.verifyAuthoredSummaries(input, ([{ ...summary, projections, parameters: [effect] }])),
        [finding("authored-summary-effects-order", summarySite(summary.identity, "parameter", 0))]);
      const open = { ...effect, [field]: { kind: "open", paths: [], boundaries: values } };
      assert.deepEqual(product.verifyAuthoredSummaries(input, ([{ ...summary, producers, boundaries, parameters: [open] }])),
        [finding("authored-summary-effects-order", summarySite(summary.identity, "parameter", 0))]);
    }
  }
  const parameters = [{ slot: { kind: "receiver" }, reads: { kind: "complete", paths: [0, 1] }, writes: complete },
    { slot: { kind: "parameter", index: 0 }, reads: complete, writes: { kind: "open", paths: [], boundaries: [0, 1] } }];
  const valid = { ...summary, producers, projections, boundaries, parameters,
    origins: [{ id: 0, kind: "open", producers: [0, 1], includesAbsence: false, boundaries: [0, 1] }] };
  assert.deepEqual(product.verifyAuthoredSummaries(input, ([valid])), []);
});

test("every authored table ordering rule has its complete reversed or repeated-row opposite", () => {
  const { input, summary } = summaryInput(2);
  const complete = { kind: "complete", paths: [] };
  const producers = [{ id: 0, kind: "receiver", path: null }, { id: 1, kind: "allocation", site: 0, path: null }];
  for (const values of [[1, 0], [0, 0]]) {
    const parameters = values.map(index => ({ slot: { kind: "parameter", index }, reads: complete, writes: complete }));
    assert.deepEqual(product.verifyAuthoredSummaries((input), ([{ ...summary, parameters }])),
      [finding("authored-summary-effects-order", summarySite(summary.identity, "parameter", 1))]);
    const captures = values.map(index => ({ index, reads: complete, writes: complete }));
    assert.deepEqual(product.verifyAuthoredSummaries(input, ([{ ...summary, captures }])),
      [finding("authored-summary-effects-order", summarySite(summary.identity, "capture", 1))]);
    assert.deepEqual(product.verifyAuthoredSummaries(input, ([{ ...summary, invocationOnlyParameters: values }])),
      [finding("authored-summary-effects-order", summarySite(summary.identity, "parameter", null))]);
    const writes = values.map(target => ({ target, value: 0 }));
    assert.deepEqual(product.verifyAuthoredSummaries(input, ([{ ...summary, producers, writes }])),
      [finding("authored-summary-effects-order", summarySite(summary.identity, "write", 1))]);
    const retention = values.map(source => ({ source, into: { kind: "return" } }));
    assert.deepEqual(product.verifyAuthoredSummaries(input, ([{ ...summary, producers, retention }])),
      [finding("authored-summary-effects-order", summarySite(summary.identity, "retention", 1))]);
  }
});

test("a complete authored graph covers all producer/projection/origins/boundary/effect/escape/callback arms", () => {
  const module = identity();
  const parameter = index => ({ name: `p${index}`, type: 1, passingMode: "by-value", optional: false, rest: false, defaultType: null });
  const input = catalogue([moduleValue({ types: [
    { id: 0, kind: "unknown" }, { id: 1, kind: "function", signature: signature({ id: "callback", parameters: [
      { ...parameter(0), type: 0 }, { ...parameter(1), type: 0 },
    ] }) },
  ], exports: [declaration({ signatures: [signature({ parameters: [parameter(0), parameter(1)] })] })] })]);
  const identityValue = exportIdentity(module, "export", null, "signature");
  const complete = { kind: "complete", paths: [] };
  const producers = [{ id: 0, kind: "receiver", path: null }, { id: 1, kind: "parameter", index: 0, path: null },
    { id: 2, kind: "parameter", index: 1, path: 0 }, { id: 3, kind: "capture", index: 0, path: 1 },
    { id: 4, kind: "shared", identity: exportIdentity(module), path: 2 },
    ...[0, 1, 2, 3].map(site => ({ id: 5 + site, kind: "allocation", site, path: null }))];
  const boundaries = ["external-input", "external-write", "opaque-write", "opaque-result", "unclassified-exposure",
    "opaque-invocation", "unresolved-transport"].map((kind, id) => ({ id, kind, site: id, subject: 0,
    owner: id === 0 ? null : 1, detail: `reason${id}` }));
  const summary = authoredSummary(identityValue, {
    projections: [{ id: 0, parent: null, projection: { kind: "element" } },
      { id: 1, parent: 0, projection: { kind: "index", constant: -9007199254740993n } },
      { id: 2, parent: 1, projection: { kind: "deref" } }],
    producers, boundaries,
    origins: [{ id: 0, kind: "complete", producers: [0], includesAbsence: true },
      { id: 1, kind: "open", producers: [1, 2, 3, 4, 5, 6, 7, 8], includesAbsence: false, boundaries: [0, 1, 2, 3, 4, 5, 6] }],
    parameters: [{ slot: { kind: "receiver" }, reads: complete, writes: complete },
      { slot: { kind: "parameter", index: 0 }, reads: { kind: "complete", paths: [0, 1, 2] }, writes: complete },
      { slot: { kind: "parameter", index: 1 }, reads: complete, writes: { kind: "open", paths: [0], boundaries: [0, 1] } }],
    captures: [{ index: 0, reads: { kind: "complete", paths: [1] }, writes: complete }], result: 0, thrown: 1,
    writes: [{ target: 0, value: 0 }, { target: 1, value: 1 }], retention: [
      { source: 0, into: { kind: "return" } }, { source: 1, into: { kind: "throw" } },
      { source: 2, into: { kind: "shared", identity: exportIdentity(module), path: 0 } },
      { source: 3, into: { kind: "parameter", index: 0, path: 1 } }, { source: 4, into: { kind: "receiver", path: null } },
      { source: 5, into: { kind: "capture", index: 0, path: 2 } }, { source: 6, into: { kind: "callback", site: 0 } },
      { source: 7, into: { kind: "suspension", site: 1 } }, { source: 8, into: { kind: "external", boundary: 0 } },
    ], callbacks: [{ parameterIndex: 0, timing: "synchronous", rejection: 1, inputs: [
      { kind: "receiver-element", parameterIndex: 0 }, { kind: "argument-element", parameterIndex: 1, sourceParameterIndex: 1 },
    ] }, { parameterIndex: 1, timing: "deferred", rejection: null, inputs: [{ kind: "receiver-rejection", parameterIndex: 0 }] }],
    invocationOnlyParameters: [0, 1], suspends: true, bindingDependent: true,
  });
  assert.deepEqual(product.verifyAuthoredSummaries((input), ([summary])), []);
});

test("callbacks resolve the callback's formal parameters independently of the containing signature arity", () => {
  const module = identity();
  const parameter = type => ({ name: "callback", type, passingMode: "by-value", optional: false,
    rest: false, defaultType: null });
  const input = catalogue([moduleValue({ types: [{ id: 0, kind: "unknown" },
    { id: 1, kind: "function", signature: signature({ id: "inner", parameters: [parameter(0), parameter(0)] }) },
    { id: 2, kind: "union", types: [1, 3] }, { id: 3, kind: "intersection", types: [1, 2, 0] }],
  exports: [declaration({ signatures: [signature({ parameters: [parameter(2)] })] })] })]);
  const summary = authoredSummary(exportIdentity(module, "export", null, "signature"));
  const callback = { parameterIndex: 0, timing: "synchronous", rejection: 1,
    inputs: [{ kind: "receiver-element", parameterIndex: 0 },
      { kind: "argument-element", parameterIndex: 1, sourceParameterIndex: 0 }] };
  assert.deepEqual(product.verifyAuthoredSummaries((input), ([{ ...summary, callbacks: [callback] }])), []);
  for (const value of [-1, -0, 2, 0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.deepEqual(product.verifyAuthoredSummaries(input, ([{ ...summary, callbacks: [
      { ...callback, rejection: value },
    ] }])), [finding("authored-summary-parameter-range", summarySite(summary.identity, "callback", 0), "callback", encodeKey(value))]);
    assert.deepEqual(product.verifyAuthoredSummaries(input, ([{ ...summary, callbacks: [
      { ...callback, rejection: null, inputs: [{ kind: "receiver-rejection", parameterIndex: value }] },
    ] }])), [finding("authored-summary-parameter-range", summarySite(summary.identity, "callback", 0), "callback", encodeKey(value))]);
  }
  assert.deepEqual(product.verifyAuthoredSummaries(input, ([{ ...summary, callbacks: [
    { ...callback, rejection: null, inputs: [{ kind: "argument-element", parameterIndex: 0, sourceParameterIndex: 1 }] },
  ] }])), [finding("authored-summary-parameter-range", summarySite(summary.identity, "callback", 0), encodeKey(1))]);
  for (const inputs of [[{ kind: "receiver-element", parameterIndex: 1 }, { kind: "receiver-rejection", parameterIndex: 0 }],
    [{ kind: "receiver-element", parameterIndex: 0 }, { kind: "receiver-rejection", parameterIndex: 0 }]]) {
    assert.deepEqual(product.verifyAuthoredSummaries(input, ([{ ...summary, callbacks: [{ ...callback, inputs }] }])),
      [finding("authored-summary-effects-order", summarySite(summary.identity, "callback", 0))]);
  }
});

test("callbacks require every callable alternative to admit the inner parameter and keep exact outer ordering", () => {
  const module = identity();
  const parameter = type => ({ name: "p", type, passingMode: "by-value", optional: false, rest: false, defaultType: null });
  const input = catalogue([moduleValue({ types: [{ id: 0, kind: "unknown" },
    { id: 1, kind: "function", signature: signature({ id: "wide", parameters: [parameter(0), parameter(0)] }) },
    { id: 2, kind: "function", signature: signature({ id: "narrow", parameters: [parameter(0)] }) },
    { id: 3, kind: "union", types: [1, 2] }],
  exports: [declaration({ signatures: [signature({ parameters: [parameter(3), parameter(1), parameter(0)] })] })] })]);
  const summary = authoredSummary(exportIdentity(module, "export", null, "signature"));
  const callback = { parameterIndex: 0, timing: "deferred", rejection: null, inputs: [] };
  assert.deepEqual(product.verifyAuthoredSummaries((input), ([{ ...summary, callbacks: [callback] }])), []);
  assert.deepEqual(product.verifyAuthoredSummaries(input, ([{ ...summary, callbacks: [{ ...callback, rejection: 1 }] }])),
    [finding("authored-summary-parameter-range", summarySite(summary.identity, "callback", 0), "callback", encodeKey(1))]);
  assert.deepEqual(product.verifyAuthoredSummaries(input, ([{ ...summary, callbacks: [{ ...callback,
    parameterIndex: 2, inputs: [{ kind: "receiver-element", parameterIndex: 0 }] }] }])),
    [finding("authored-summary-parameter-range", summarySite(summary.identity, "callback", 0), "callback", encodeKey(0))]);
  for (const values of [[1, 0], [0, 0]]) {
    assert.deepEqual(product.verifyAuthoredSummaries(input, ([{ ...summary,
      callbacks: values.map(parameterIndex => ({ ...callback, parameterIndex })),
    }])), [finding("authored-summary-effects-order", summarySite(summary.identity, "callback", 1))]);
  }
  const { input: noParameters, summary: noParameterSummary } = summaryInput();
  assert.deepEqual(product.verifyAuthoredSummaries((noParameters), ([{ ...noParameterSummary,
    callbacks: [{ ...callback, inputs: [{ kind: "receiver-element", parameterIndex: 0 }] }],
  }])), expectedSummaryOrder([
    finding("authored-summary-parameter-range", summarySite(noParameterSummary.identity, "callback", 0), encodeKey(0)),
    finding("authored-summary-parameter-range", summarySite(noParameterSummary.identity, "callback", 0), "callback", encodeKey(0)),
  ]));
  const unresolved = exportIdentity(module, "missing", null, "signature");
  assert.deepEqual(product.verifyAuthoredSummaries(input, ([authoredSummary(unresolved, { callbacks: [callback] })])),
    [finding("authored-summary-identity-resolves", summarySite(unresolved, "parameter", null))]);
  const noSignature = exportIdentity(module);
  assert.deepEqual(product.verifyAuthoredSummaries(input, ([authoredSummary(noSignature, { callbacks: [
    { ...callback, inputs: [{ kind: "receiver-element", parameterIndex: 0 }] },
  ] })])), expectedSummaryOrder([
    finding("authored-summary-identity-resolves", summarySite(noSignature, "parameter", null)),
    finding("authored-summary-parameter-range", summarySite(noSignature, "callback", 0), "callback", encodeKey(0)),
  ]));
  const badType = catalogue([moduleValue({ exports: [declaration({ signatures: [signature({ parameters: [parameter(9)] })] })] })]);
  const badIdentity = exportIdentity(module, "export", null, "signature");
  assert.deepEqual(product.verifyAuthoredSummaries((badType), ([authoredSummary(badIdentity, { callbacks: [
    { ...callback, inputs: [{ kind: "receiver-element", parameterIndex: 0 }] },
  ] })])), [finding("type-reference-resolves", { kind: "export", identity: exportIdentity(module) }, encodeKey(9)),
    finding("authored-summary-parameter-range", summarySite(badIdentity, "callback", 0), "callback", encodeKey(0))]);
});

test("all unused required/optional/default/rest formals retain dense identities, origins and no-flow rows", async () => {
  const module = identity();
  const summary = authoredSummary(exportIdentity(module, "export", null, "signature"));
  const input = catalogue([moduleValue({ types: [{ id: 0, kind: "unknown" }], exports: [declaration({ signatures: [signature({
    parameters: ["required", "optional", "default", "rest"].map((kind, index) => ({ name: `p${index}`, type: 0,
      passingMode: "by-value", optional: kind === "optional" || kind === "default", rest: kind === "rest", defaultType: kind === "default" ? 0 : null })),
  })] })] })]);
  const definition = definitionId("api");
  const parameters = ["required", "optional", "default", "rest"].map((kind, index) => ({ declaration: definitionId(`p${index}`),
    kind, type: tyId(0), passing: "by-value", initializer: kind === "default"
      ? encodeBodyId({ owner: definitionId(`p${index}`), role: "initializer", ordinal: 0 }) : null }));
  const binding = (exportBinding(definition, { signature: declaredSignature(definition, { parameters }) }));
  const bound = ({ sources: input.sources, sourceRoles: [] });
  const complete = { kind: "complete", paths: [] };
  const expected = emptySummary(binding, {
    arena: { projections: [], producers: [0, 1, 2, 3].map(index => ({ id: index, kind: "parameter", index, path: null })),
      contexts: [{ id: 0, receiver: null, arguments: [1, 2, 3, 4], captures: [] }],
      boundProducers: [0, 1, 2, 3].map(id => ({ id, producer: id, bindings: binding.request.bindings.bindings, context: 0 })),
      origins: [{ id: 0, kind: "complete", producers: [], includesAbsence: false },
        ...[0, 1, 2, 3].map(id => ({ id: id + 1, kind: "complete", producers: [id], includesAbsence: false }))], boundaries: [] },
    parameters: [0, 1, 2, 3].map(index => ({ slot: { kind: "parameter", index }, reads: complete, writes: complete })),
  });
  assert.deepEqual(await bindNativeBatch(bound, ([summary]), [readyAssociation(summary.identity, binding)]),
    { kind: "ok", value: [expected], diagnostics: [] });
  const constructorBinding = { ...binding, signature: { ...binding.signature, id: sigId(1), kind: "construct" } };
  assert.deepEqual(await bindNativeBatch(bound, [summary], [readyAssociation(summary.identity, constructorBinding)]),
    { kind: "ok", value: [{ ...expected, signature: sigId(1) }], diagnostics: [] });
});

test("an unused actual receiver has its own formal identity/context and no-flow effect without an authored producer", async () => {
  const { input, summary } = summaryInput();
  const definition = definitionId("receiver-api");
  const binding = exportBinding(definition, { signature: declaredSignature(definition, { receiver: tyId(0) }) });
  const bound = ({ sources: input.sources, sourceRoles: [] });
  const complete = { kind: "complete", paths: [] };
  const expected = emptySummary(binding, { arena: { projections: [], producers: [{ id: 0, kind: "receiver", path: null }],
    contexts: [{ id: 0, receiver: 1, arguments: [], captures: [] }], boundProducers: [{ id: 0, producer: 0, bindings: binding.request.bindings.bindings, context: 0 }],
    origins: [{ id: 0, kind: "complete", producers: [], includesAbsence: false },
      { id: 1, kind: "complete", producers: [0], includesAbsence: false }], boundaries: [] },
  parameters: [{ slot: { kind: "receiver" }, reads: complete, writes: complete }] });
  assert.deepEqual(await bindNativeBatch(bound, ([summary]), [readyAssociation(summary.identity, binding)]),
    { kind: "ok", value: [expected], diagnostics: [] });
});

test("binding canonical write and escape keys include the complete secondary target/value facets", async () => {
  const { input, summary } = summaryInput(1);
  const definition = definitionId("api");
  const binding = exportBinding(definition, { signature: declaredSignature(definition, { parameters: [
    { declaration: definitionId("p"), kind: "required", type: tyId(0), passing: "byref-readwrite", initializer: null },
  ] }) });
  const raw = { ...summary, producers: [{ id: 0, kind: "parameter", index: 0, path: null }],
    origins: [{ id: 0, kind: "complete", producers: [], includesAbsence: false },
      { id: 1, kind: "complete", producers: [], includesAbsence: true }],
    writes: [{ target: 0, value: 0 }, { target: 0, value: 1 }], retention: [
      { source: 0, into: { kind: "throw" } }, { source: 0, into: { kind: "return" } },
      { source: 0, into: { kind: "parameter", index: 0, path: null } },
    ] };
  const complete = { kind: "complete", paths: [] };
  const expected = emptySummary(binding, { arena: { projections: [], producers: [{ id: 0, kind: "parameter", index: 0, path: null }],
    contexts: [{ id: 0, receiver: null, arguments: [2], captures: [] }], boundProducers: [{ id: 0, producer: 0, bindings: binding.request.bindings.bindings, context: 0 }],
    origins: [{ id: 0, kind: "complete", producers: [], includesAbsence: false },
      { id: 1, kind: "complete", producers: [], includesAbsence: true }, { id: 2, kind: "complete", producers: [0], includesAbsence: false }], boundaries: [] },
  parameters: [{ slot: { kind: "parameter", index: 0 }, reads: complete, writes: complete }],
  writes: [{ target: 0, value: 0 }, { target: 0, value: 1 }], retention: [
    { source: 0, into: { kind: "throw" } }, { source: 0, into: { kind: "return" } },
    { source: 0, into: { kind: "parameter", index: 0, path: null } },
  ] });
  const bound = ({ sources: input.sources, sourceRoles: [] });
  assert.deepEqual(await bindNativeBatch(bound, ([raw]), [readyAssociation(summary.identity, binding)]),
    { kind: "ok", value: [expected], diagnostics: [] });
});

test("capture and shared escapes preserve both nullable path forms and the canonical shared definition", async () => {
  const { input, summary } = summaryInput();
  const definition = definitionId("api");
  const binding = exportBinding(definition);
  const shared = exportIdentity(summary.identity.module);
  const sharedDefinition = definitionId("shared");
  const raw = { ...summary, projections: [{ id: 0, parent: null, projection: { kind: "element" } }],
    producers: [{ id: 0, kind: "capture", index: 0, path: null }],
    captures: [{ index: 0, reads: { kind: "complete", paths: [] }, writes: { kind: "complete", paths: [] } }],
    retention: [{ source: 0, into: { kind: "shared", identity: shared, path: null } },
      { source: 0, into: { kind: "capture", index: 0, path: 0 } }],
  };
  const expected = emptySummary(binding, { arena: { projections: [{ id: 0, parent: null, projection: { kind: "element" } }],
    producers: [{ id: 0, kind: "capture", index: 0, path: null }], contexts: [{ id: 0, receiver: null, arguments: [], captures: [{ index: 0, location: 0 }] }],
    boundProducers: [{ id: 0, producer: 0, bindings: binding.request.bindings.bindings, context: 0 }],
    origins: [{ id: 0, kind: "complete", producers: [], includesAbsence: false }], boundaries: [] },
  captures: [{ index: 0, reads: { kind: "complete", paths: [] }, writes: { kind: "complete", paths: [] } }],
  retention: [{ source: 0, into: { kind: "shared", definition: sharedDefinition, path: null } },
    { source: 0, into: { kind: "capture", index: 0, path: 0 } }] });
  const bound = ({ sources: input.sources, sourceRoles: [] });
  assert.deepEqual(await bindNativeBatch(bound, ([raw]), [readyAssociation(summary.identity, binding), readyAssociation(shared, exportBinding(sharedDefinition, { signature: null }))]),
  { kind: "ok", value: [expected], diagnostics: [] });
});

test("summary publication is canonical across input orders and shared unresolved projections are memoized by full identity", async () => {
  const module = identity();
  const first = exportIdentity(module, "a", null, "signature");
  const second = exportIdentity(module, "z", null, "signature");
  const field = exportIdentity(module, "m", "field");
  const sources = catalogue([moduleValue({ exports: [declaration({ id: "a", exportName: "a", signatures: [signature()] }),
    declaration({ id: "m", exportName: "m", members: [member({ id: "field", kind: "field" })] }),
    declaration({ id: "z", exportName: "z", signatures: [signature()] })] })]).sources;
  const bound = ({ sources, sourceRoles: [] });
  const firstBinding = exportBinding(definitionId("first"));
  const secondBinding = exportBinding(definitionId("second"),
    { signature: declaredSignature(definitionId("second"), { id: sigId(1) }) });
  const firstRaw = authoredSummary(first);
  const secondRaw = authoredSummary(second);
  for (const declared of [[firstRaw, secondRaw], [secondRaw, firstRaw]]) {
      assert.deepEqual(await bindNativeBatch(bound, declared, [readyAssociation(first, firstBinding), readyAssociation(second, secondBinding)]),
        { kind: "ok", value: [emptySummary(firstBinding), emptySummary(secondBinding)], diagnostics: [] });
  }
  const projection = { id: 0, parent: null, projection: { kind: "field", identity: field } };
  assert.deepEqual(await bindNativeBatch(bound, [{ ...secondRaw, projections: [projection] }, { ...firstRaw, projections: [projection] }],
    [readyAssociation(first, firstBinding), readyAssociation(second, secondBinding)]),
    { kind: "refused", diagnostics: [lateSummaryError(firstBinding.request), lateSummaryError(secondBinding.request)] });
});

test("legal aliases use one admitted native guarantee origin independent of encounter order", async () => {
  const module = identity();
  const first = exportIdentity(module, "a", null, "signature");
  const second = exportIdentity(module, "z", null, "signature");
  const bound = { sources: catalogue([moduleValue({ exports: [
    declaration({ id: "a", exportName: "a", signatures: [signature()] }),
    declaration({ id: "z", exportName: "z", signatures: [signature()] }),
  ] })]).sources, sourceRoles: [] };
  const binding = exportBinding(definitionId("shared-alias"));
  const raw = authoredSummary(first, {
    producers: [{ id: 0, kind: "allocation", site: 0, path: null }],
    origins: [{ id: 0, kind: "complete", producers: [0], includesAbsence: false }],
    retention: [{ source: 0, into: { kind: "callback", site: 1 } }],
  });
  const at = site => ({ kind: "declared", identity: first, site });
  const expected = emptySummary(binding, {
    arena: { projections: [], producers: [{ id: 0, kind: "allocation", at: at(0), path: null }],
      contexts: [{ id: 0, receiver: null, arguments: [], captures: [] }],
      boundProducers: [{ id: 0, producer: 0, bindings: binding.request.bindings.bindings, context: 0 }],
      origins: [{ id: 0, kind: "complete", producers: [0], includesAbsence: false }], boundaries: [] },
    retention: [{ source: 0, into: { kind: "callback", at: at(1) } }],
  });
  const aliases = [readyAssociation(first, binding, first), readyAssociation(second, binding, first)];
  for (const associations of [aliases, [...aliases].reverse()]) {
    const admitted = product.admitGuarantees(bound, [raw], associations);
    assert.equal(admitted.kind, "ok");
    assert.equal(admitted.value.guarantees.length, 1, "one authored origin is admitted, not one copy per alias");
    assert.equal(admitted.value.guarantees[0].statement === raw, true);
    assert.deepEqual(product.verifyLibraries(admitted.value, { definitionExists: () => true,
      definitionOfExport: () => { throw new Error("No roles."); }, associations }), []);
    assert.deepEqual(await bindNativeBatch(bound, [raw], associations), { kind: "ok", value: [expected], diagnostics: [] });
    assert.deepEqual(product.admitGuarantees(bound, [raw, authoredSummary(second)], associations),
      { kind: "refused", diagnostics: [summaryError(second)] }, "a second alias statement cannot replace or duplicate the canonical origin");
  }
  for (const identities of [[first, second], [second, first]]) {
    const absent = identities.map(identity => readyAssociation(identity, binding, null));
    assert.deepEqual(product.admitGuarantees(bound, [], absent),
      { kind: "ok", value: { ...bound, guarantees: [] }, diagnostics: [] }, "genuine no-guarantee aliases retain their known absence");
  }
});

test("contradictory, missing and unavailable native alias origins never become first-row selection or known absence", () => {
  const module = identity();
  const first = exportIdentity(module, "a", null, "signature");
  const second = exportIdentity(module, "z", null, "signature");
  const bound = { sources: catalogue([moduleValue({ exports: [
    declaration({ id: "a", exportName: "a", signatures: [signature()] }),
    declaration({ id: "z", exportName: "z", signatures: [signature()] }),
  ] })]).sources, sourceRoles: [] };
  const binding = exportBinding(definitionId("shared-alias"));
  const firstRaw = authoredSummary(first);
  const secondRaw = authoredSummary(second);
  const a = readyAssociation(first, binding);
  const z = readyAssociation(second, binding);
  const context = associations => ({ associations, definitionExists: () => true,
    definitionOfExport: () => { throw new Error("No roles."); } });
  const current = { ...bound, guarantees: [{ statement: firstRaw, declaration: binding.request.definition }] };
  for (const associations of [[a, z], [z, a], [a, z, { ...a }]]) {
    for (const declared of [[firstRaw, secondRaw], [secondRaw, firstRaw]]) {
      assert.deepEqual(product.admitGuarantees(bound, declared, associations),
        { kind: "refused", diagnostics: [summaryError(first), summaryError(second)] });
    }
  }
  for (const associations of [
    [a, { ...z, guarantee: null }],
    [{ ...z, guarantee: null }, a],
    [a, { ...z, guarantee: first, signature: { ...binding.signature, id: sigId(1) } }],
    [a, { ...z, guarantee: first, signature: { ...binding.signature, id: sigId(1) } }, { ...z, guarantee: first }],
  ]) {
    assert.deepEqual(product.admitGuarantees(bound, [firstRaw], associations),
      { kind: "refused", diagnostics: [summaryError(first)] });
    assert.equal(product.verifyLibraries(current, context(associations)).some(row => row.rule === "summary-binding-origin-exact"), true);
  }
  for (const selected of [{ ...a, guarantee: null }, { ...a, guarantee: second }]) {
    assert.equal(product.verifyLibraries(current, context([selected])).some(row => row.rule === "summary-binding-origin-exact"), true);
  }
  assert.deepEqual(product.admitGuarantees(bound, [], [a, { ...z, guarantee: first }]),
    { kind: "refused", diagnostics: [summaryError(first)] }, "a supplied guarantee reference must resolve its authored origin");
  for (const associations of [[a, z], [z, a]]) {
    assert.deepEqual(product.admitGuarantees(bound, [], associations),
      { kind: "refused", diagnostics: [summaryError(first), summaryError(second)] },
      "missing authored origins are reported once each in canonical native order");
  }
  const independent = readyAssociation(second, exportBinding(definitionId("independent")));
  for (const associations of [[a, independent], [independent, a]]) {
    assert.deepEqual(product.admitGuarantees(bound, [firstRaw], associations),
      { kind: "refused", diagnostics: [summaryError(second)] }, "a valid independent origin cannot hide another supplied missing origin");
  }
  assert.deepEqual(product.admitGuarantees(bound, [firstRaw], [{ ...z, guarantee: first }]),
    { kind: "refused", diagnostics: [summaryError(first)] }, "the canonical native origin requires its actual ready checked association");
  const { guarantee, ...unavailable } = a;
  assert.throws(() => product.admitGuarantees(bound, [], [unavailable]), /ready canonical guarantee-origin evidence/u);
});

test("summary member exactness has precisely the four presence/unresolved controls and no MemberSelection replay", async () => {
  const module = identity();
  const memberIdentity = exportIdentity(module, "export", "member", "signature");
  const rootIdentity = exportIdentity(module, "export", null, "signature");
  const input = ({ sources: catalogue([moduleValue({ exports: [declaration({ signatures: [signature()],
    members: [member({ signatures: [signature()] })] })] })]).sources, sourceRoles: [] });
  const actualMember = (selectedMember());
  const binding = (exportBinding(definitionId("api"), { member: actualMember }));
  assert.deepEqual(await bindNativeBatch(input, ([authoredSummary(memberIdentity)]), [readyAssociation(memberIdentity, binding)]), { kind: "ok", value: [emptySummary(binding)], diagnostics: [] });
  assert.deepEqual(await bindNativeBatch(input, ([authoredSummary(memberIdentity)]), [readyAssociation(memberIdentity, { ...binding, member: null })]),
    { kind: "refused", diagnostics: [summaryError(memberIdentity)] });
  assert.deepEqual(await bindNativeBatch(input, ([authoredSummary(rootIdentity)]), [readyAssociation(rootIdentity, binding)]),
    { kind: "refused", diagnostics: [summaryError(rootIdentity)] });
  assert.deepEqual(await bindNativeBatch(input, ([authoredSummary(memberIdentity)]), []),
    { kind: "refused", diagnostics: [summaryError(memberIdentity)] });
});

test("summary binding refuses missing endpoints/signatures/duplicate identities and wrong existing role correspondence completely", async () => {
  const { input, summary } = summaryInput();
  const staged = ({ sources: input.sources, sourceRoles: [] });
  const binding = (exportBinding(definitionId("api")));
  const missing = exportIdentity(summary.identity.module, "missing", null, "signature");
  assert.deepEqual(await bindNativeBatch(staged, ([authoredSummary(missing)]), []), { kind: "refused", diagnostics: [summaryError(missing)] });
  assert.deepEqual(await bindNativeBatch(staged, ([summary]), [readyAssociation(summary.identity, exportBinding(binding.request.definition, { signature: null }))]),
    { kind: "refused", diagnostics: [summaryError(summary.identity)] });
  assert.deepEqual(await bindNativeBatch(staged, ([summary, { ...summary }]), [readyAssociation(summary.identity, binding)]), { kind: "refused", diagnostics: [summaryError(summary.identity)] });
  const role = { identity: summary.identity, role: "pointer", definition: definitionId("wrong-but-existing") };
  assert.deepEqual(await bindNativeBatch(({ ...staged, sourceRoles: [role] }), ([summary]), [readyAssociation(summary.identity, binding)]),
    { kind: "refused", diagnostics: [summaryError(summary.identity)] });
  const exactRole = { ...role, definition: binding.request.definition };
  assert.deepEqual(await bindNativeBatch(({ ...staged, sourceRoles: [exactRole] }), ([summary]), [readyAssociation(summary.identity, binding)]),
    { kind: "ok", value: [emptySummary(binding)], diagnostics: [] });
  assert.deepEqual(await bindNativeBatch(({ ...staged, sourceRoles: [exactRole, { ...exactRole }] }), ([summary]), [readyAssociation(summary.identity, binding)]), { kind: "refused", diagnostics: [summaryError(summary.identity)] });
  assert.equal(product.bindSummaries, undefined, "the removed callback-based producer is not exported");
});

test("every relational binding failure refuses the complete row without a partial final value", async () => {
  const { input, summary } = summaryInput(1);
  const staged = ({ sources: input.sources, sourceRoles: [] });
  const definition = definitionId("api");
  const canonicalSignature = declaredSignature(definition, { parameters: [
    { declaration: definitionId("parameter"), kind: "required", type: tyId(0), passing: "by-value", initializer: null },
  ] });
  const binding = exportBinding(definition, { signature: canonicalSignature });
  const complete = { kind: "complete", paths: [] };
  const receiver = { id: 0, kind: "receiver", path: null };
  const parameter = { id: 0, kind: "parameter", index: 0, path: null };
  const boundary = { id: 0, kind: "external-input", site: 0, subject: 0, owner: null, detail: "reason" };
  const missing = exportIdentity(summary.identity.module, "missing");
  const scenarios = [
    { projections: new Array(1) }, { producers: new Array(1) }, { origins: new Array(1) }, { boundaries: new Array(1) },
    { projections: [{ id: 0, parent: null, projection: { kind: "field", identity: missing } }] },
    { producers: [receiver] }, { producers: [{ ...receiver, path: 0 }], projections: [{ id: 0, parent: null, projection: { kind: "element" } }] },
    { producers: [{ ...parameter, index: 1 }] },
    { producers: [{ ...parameter, index: 1, path: 0 }], projections: [{ id: 0, parent: null, projection: { kind: "element" } }] },
    { producers: [{ id: 0, kind: "capture", index: 0, path: null }] },
    { producers: [{ id: 0, kind: "capture", index: 1, path: 0 }], projections: [{ id: 0, parent: null, projection: { kind: "element" } }], captures: [{ index: 0, reads: complete, writes: complete }] },
    { producers: [{ id: 0, kind: "shared", identity: missing, path: null }] },
    { origins: [{ id: 0, kind: "complete", producers: [9], includesAbsence: false }] },
    { boundaries: [boundary] },
    { producers: [parameter], boundaries: [{ ...boundary, owner: 9 }] },
    { parameters: [{ slot: { kind: "receiver" }, reads: complete, writes: complete }] },
    { parameters: [{ slot: { kind: "parameter", index: 1 }, reads: complete, writes: complete }] },
    { captures: [{ index: 1, reads: complete, writes: complete }] },
    { writes: [{ target: 9, value: 0 }] },
    { retention: [{ source: 9, into: { kind: "return" } }] },
    { producers: [parameter], retention: [{ source: 0, into: { kind: "shared", identity: missing, path: null } }] },
    { producers: [parameter], retention: [{ source: 0, into: { kind: "parameter", index: 1, path: null } }] },
    { producers: [parameter], retention: [{ source: 0, into: { kind: "receiver", path: null } }] },
    { callbacks: [{ parameterIndex: 1, timing: "synchronous", rejection: null, inputs: [] }] },
    { callbacks: [{ parameterIndex: 0, timing: "synchronous", rejection: null,
      inputs: [{ kind: "argument-element", parameterIndex: 0, sourceParameterIndex: 1 }] }] },
    { callbacks: [{ parameterIndex: 0, timing: "synchronous", rejection: null, inputs: [{ kind: "receiver-element", parameterIndex: 0 }] }] },
    { invocationOnlyParameters: [1] },
    { projections: [{ id: 1, parent: null, projection: { kind: "element" } }] },
    { producers: [parameter], writes: [{ target: 0, value: 9 }] },
    { producers: [{ ...parameter, index: -0 }] },
    { producers: [{ id: 0, kind: "allocation", site: -0, path: null }] },
    { producers: [parameter], retention: [{ source: 0, into: { kind: "external", boundary: 9 } }] },
  ];
  const semanticReceiverFailures = new Set([5, 6, 15, 22]);
  for (const [index, changes] of scenarios.entries()) {
    const expected = semanticReceiverFailures.has(index) ? lateSummaryError(binding.request) : summaryError(summary.identity);
    assert.deepEqual(await bindNativeBatch(staged, ([{ ...summary, ...changes }]), [readyAssociation(summary.identity, binding)]),
      { kind: "refused", diagnostics: [expected] }, `relational failure ${index} stays at its actual structural or selected-signature owner`);
  }
  const memberIdentity = exportIdentity(summary.identity.module, "export", "member");
  const withMember = ({ sources: catalogue([moduleValue({ types: [{ id: 0, kind: "unknown" }], exports: [
    declaration({ signatures: [signature({ parameters: [{ name: "p", type: 0, passingMode: "by-value", optional: false, rest: false, defaultType: null }] })], members: [member()] }),
  ] })]).sources, sourceRoles: [] });
  for (const identity of [memberIdentity, exportIdentity(summary.identity.module)]) {
    const raw = { ...summary, projections: [{ id: 0, parent: null, projection: { kind: "field", identity } }] };
    const result = await bindNativeBatch(withMember, ([raw]), [readyAssociation(summary.identity, binding), ...(identity.memberId === null ? [readyAssociation(identity, exportBinding(binding.request.definition, { signature: null }))] : [])]);
    assert.deepEqual(result, { kind: "refused", diagnostics: [lateSummaryError(binding.request)] });
  }
});

for (const scenario of ["path-parent", "producer-path", "parameter-read", "parameter-write", "capture-read", "capture-write", "retention-path"]) {
  test(`binding missing ${scenario} is a complete public refusal with a full valid opposite`, async () => {
    const { input, summary } = summaryInput(1);
    const bound = ({ sources: input.sources, sourceRoles: [] });
    const definition = definitionId("api");
    const binding = exportBinding(definition, { signature: declaredSignature(definition, { parameters: [
      { declaration: definitionId("p"), kind: "required", type: tyId(0), passing: "by-value", initializer: null },
    ] }) });
    const complete = { kind: "complete", paths: [] };
    const paths = { kind: "complete", paths: [0] };
    const valid = { ...summary, projections: [{ id: 0, parent: null, projection: { kind: "element" } }] };
    const expected = emptySummary(binding, { arena: { projections: valid.projections,
      producers: [{ id: 0, kind: "parameter", index: 0, path: null }],
      boundProducers: [{ id: 0, producer: 0, bindings: binding.request.bindings.bindings, context: 0 }],
      origins: [{ id: 0, kind: "complete", producers: [], includesAbsence: false },
        { id: 1, kind: "complete", producers: [0], includesAbsence: false }],
      contexts: [{ id: 0, receiver: null, arguments: [1], captures: [] }], boundaries: [] },
    parameters: [{ slot: { kind: "parameter", index: 0 }, reads: complete, writes: complete }] });
    if (scenario === "producer-path") {
      valid.producers = [{ id: 0, kind: "parameter", index: 0, path: 0 }];
      expected.arena.producers.push({ id: 1, kind: "parameter", index: 0, path: 0 });
      expected.arena.boundProducers.push({ id: 1, producer: 1, bindings: binding.request.bindings.bindings, context: 0 });
    } else if (scenario === "parameter-read" || scenario === "parameter-write") {
      const effect = { slot: { kind: "parameter", index: 0 },
        reads: scenario === "parameter-read" ? paths : complete,
        writes: scenario === "parameter-write" ? paths : complete };
      valid.parameters = [effect];
      expected.parameters = [effect];
    } else if (scenario === "capture-read" || scenario === "capture-write") {
      const effect = { index: 0, reads: scenario === "capture-read" ? paths : complete,
        writes: scenario === "capture-write" ? paths : complete };
      valid.captures = [effect];
      expected.captures = [effect];
      expected.arena.producers.push({ id: 1, kind: "capture", index: 0, path: null });
      expected.arena.boundProducers.push({ id: 1, producer: 1, bindings: binding.request.bindings.bindings, context: 0 });
      expected.arena.contexts[0].captures = [{ index: 0, location: 1 }];
    } else if (scenario === "retention-path") {
      valid.producers = [{ id: 0, kind: "allocation", site: 0, path: null }];
      valid.retention = [{ source: 0, into: { kind: "parameter", index: 0, path: 0 } }];
      expected.arena.producers.push({ id: 1, kind: "allocation", path: null,
        at: { kind: "declared", identity: summary.identity, site: 0 } });
      expected.arena.boundProducers.push({ id: 1, producer: 1, bindings: binding.request.bindings.bindings, context: 0 });
      expected.retention = [{ source: 1, into: { kind: "parameter", index: 0, path: 0 } }];
    }
    const invalid = structuredClone(valid);
    if (scenario === "path-parent") invalid.projections[0].parent = 9;
    else if (scenario === "producer-path") invalid.producers[0].path = 9;
    else if (scenario === "parameter-read") invalid.parameters[0].reads.paths = [9];
    else if (scenario === "parameter-write") invalid.parameters[0].writes.paths = [9];
    else if (scenario === "capture-read") invalid.captures[0].reads.paths = [9];
    else if (scenario === "capture-write") invalid.captures[0].writes.paths = [9];
    else invalid.retention[0].into.path = 9;
    assert.deepEqual(await bindNativeBatch(bound, ([invalid]), [readyAssociation(summary.identity, binding)]),
      { kind: "refused", diagnostics: [summaryError(summary.identity)] });
    assert.deepEqual(await bindNativeBatch(bound, ([valid]), [readyAssociation(summary.identity, binding)]),
      { kind: "ok", value: [expected], diagnostics: [] });
  });
}

test("repeated canonical member queries retain complete small/large N-M values and genuine alias opposites", async () => {
  for (const count of [1, 4096]) for (const width of [1, 512]) for (const kind of ["field", "method-value"]) {
    const module = identity();
    const root = exportIdentity(module, "a", null, "signature");
    const identities = ["b", "c", "d"].map(id => exportIdentity(module, id, "member"));
    const names = Array.from({ length: width + 1 }, (_, index) => `selected${index}`);
    const definitions = names.map(definitionId);
    const sources = catalogue([moduleValue({ exports: [
      declaration({ id: "a", exportName: "a", signatures: [signature()] }),
      ...["b", "c", "d"].map(id => declaration({ id, exportName: id, members: [member()] })),
      ...names.map(id => declaration({ id, exportName: id })),
    ] })]).sources;
    const one = selectedMember({ decision: { ...selectedMember().decision, selectedDeclarations: definitions.slice(0, width) } });
    const same = structuredClone(one);
    const different = selectedMember({ decision: { ...one.decision,
      selectedDeclarations: [...definitions.slice(0, width - 1), definitions[width]] } });
    const binding = exportBinding(definitionId("api"));
    const entries = new Map([[identityKey(root), binding],
      [identityKey(identities[0]), exportBinding(definitionId("b"), { signature: null, member: one })],
      [identityKey(identities[1]), exportBinding(definitionId("c"), { signature: null, member: same })],
      [identityKey(identities[2]), exportBinding(definitionId("d"), { signature: null, member: different })]]);
    const raw = authoredSummary(root, { projections: [
      ...Array.from({ length: count }, (_, id) => ({ id, parent: null, projection: { kind, identity: identities[0] } })),
      { id: count, parent: null, projection: { kind, identity: identities[1] } },
      { id: count + 1, parent: null, projection: { kind, identity: identities[2] } },
    ] });
    const expected = emptySummary(binding);
    expected.arena.projections = [{ id: 0, parent: null, projection: { kind, member: one } },
      { id: 1, parent: null, projection: { kind, member: different } }];
    const bound = ({ sources, sourceRoles: [] });
      assert.deepEqual(product.verifyAuthoredSummaries({ sources }, [raw]), []);
    assert.deepEqual(await bindNativeBatch(bound, ([raw]), [root, ...identities].map(identity => readyAssociation(identity, entries.get(identityKey(identity))))), { kind: "ok", value: [expected], diagnostics: [] });
  }
});

test("repeated projected parameter producers carry one complete root environment across small/large N-M", async () => {
  for (const count of [1, 4096]) for (const width of [1, 512]) {
    const { input, summary } = summaryInput(1);
    const definition = definitionId("api");
    const names = Array.from({ length: width }, (_, index) => `T${index}`);
    const sources = input.sources.map(source => ({ ...source, modules: source.modules.map(module => ({ ...module,
      exports: module.exports.map(value => ({ ...value, signatures: value.signatures.map(value => ({ ...value,
        typeParameters: names.map(name => ({ name, constraints: [], defaultType: null, variance: "invariant" })),
      })) })),
    })) }));
    const bindings = emptyBindings({ methodBindings: names.map((name, index) => ({ kind: "bound",
      parameter: { owner: definition, index }, type: tyId(0) })) });
    const binding = exportBinding(definition, { bindings, signature: declaredSignature(definition, {
      typeParameters: names.map((name, index) => ({ identity: { owner: definition, index },
        declaration: definitionId(name), constraint: null, default: null })),
      parameters: [{ declaration: definitionId("p"), kind: "required", type: tyId(0), passing: "by-value", initializer: null }],
    }) });
    const raw = authoredSummary(summary.identity, {
      projections: Array.from({ length: count }, (_, id) => ({ id, parent: null, projection: { kind: "element" } })),
      producers: Array.from({ length: count }, (_, id) => ({ id, kind: "parameter", index: 0, path: id })),
      origins: [{ id: 0, kind: "complete", producers: Array.from({ length: count }, (_, id) => id), includesAbsence: false }],
      parameters: [{ slot: { kind: "parameter", index: 0 },
        reads: { kind: "complete", paths: Array.from({ length: count }, (_, id) => id) }, writes: { kind: "complete", paths: [] } }],
    });
    const expected = emptySummary(binding, { arena: {
      projections: [{ id: 0, parent: null, projection: { kind: "element" } }],
      producers: [{ id: 0, kind: "parameter", index: 0, path: null }, { id: 1, kind: "parameter", index: 0, path: 0 }],
      boundProducers: [{ id: 0, producer: 0, bindings, context: 0 }, { id: 1, producer: 1, bindings, context: 0 }],
      origins: [{ id: 0, kind: "complete", producers: [1], includesAbsence: false },
        { id: 1, kind: "complete", producers: [0], includesAbsence: false }],
      contexts: [{ id: 0, receiver: null, arguments: [1], captures: [] }], boundaries: [] },
    parameters: [{ slot: { kind: "parameter", index: 0 }, reads: { kind: "complete", paths: [0] },
      writes: { kind: "complete", paths: [] } }] });
    const bound = ({ sources, sourceRoles: [] });
      assert.deepEqual(product.verifyAuthoredSummaries({ sources }, [raw]), []);
    assert.deepEqual(await bindNativeBatch(bound, ([raw]), [readyAssociation(summary.identity, binding)]), { kind: "ok", value: [expected], diagnostics: [] });
  }
});

test("legal duplicate authored projections publish one canonical bound projection", async () => {
  const { input, summary } = summaryInput();
  const binding = (exportBinding(definitionId("api")));
  const raw = ({ ...summary, projections: [
    { id: 0, parent: null, projection: { kind: "element" } },
    { id: 1, parent: null, projection: { kind: "element" } },
  ] });
  const bound = ({ sources: input.sources, sourceRoles: [] });
  assert.deepEqual(product.verifyAuthoredSummaries(input, [raw]), []);
  const expected = emptySummary(binding);
  expected.arena.projections = [{ id: 0, parent: null, projection: { kind: "element" } }];
  assert.deepEqual(await bindNativeBatch(bound, [raw], [readyAssociation(summary.identity, binding)]),
    { kind: "ok", value: [expected], diagnostics: [] });
});

test("canonical duplicate paths and export aliases remap every bound Summary holder in both alias orders", async () => {
  const module = identity();
  const root = exportIdentity(module, "a", null, "signature");
  const first = exportIdentity(module, "b");
  const second = exportIdentity(module, "c");
  const distinct = exportIdentity(module, "d");
  const parameter = { name: "p", type: 0, passingMode: "by-value", optional: false, rest: false, defaultType: null };
  const sources = catalogue([moduleValue({ types: [{ id: 0, kind: "unknown" }], exports: [
    declaration({ id: "a", exportName: "a", signatures: [signature({ parameters: [parameter] })] }),
    ...["b", "c", "d"].map(id => declaration({ id, exportName: id })),
  ] })]).sources;
  const definition = definitionId("api");
  const sharedDefinition = definitionId("shared");
  const distinctDefinition = definitionId("distinct");
  const binding = exportBinding(definition, { signature: declaredSignature(definition, { receiver: tyId(0), parameters: [
    { declaration: definitionId("p"), kind: "required", type: tyId(0), passing: "by-value", initializer: null },
  ] }) });
  const sharedBindings = emptyBindings({ selfBindings: [{ kind: "rigid", owner: sharedDefinition }] });
  const complete = { kind: "complete", paths: [] };
  const paths = { kind: "complete", paths: [0, 1, 2, 3, 4, 5] };
  const open = { kind: "open", paths: [0, 1, 2, 3, 4, 5], boundaries: [0, 1] };
  const at = site => ({ kind: "declared", identity: root, site });
  const expected = emptySummary(binding, { arena: {
    projections: [{ id: 0, parent: null, projection: { kind: "element" } },
      { id: 1, parent: 0, projection: { kind: "index", constant: 7n } },
      { id: 2, parent: 1, projection: { kind: "deref" } }],
    producers: [{ id: 0, kind: "receiver", path: null }, { id: 1, kind: "parameter", index: 0, path: null },
      { id: 2, kind: "capture", index: 0, path: null }, { id: 3, kind: "allocation", at: at(0), path: 2 },
      { id: 4, kind: "receiver", path: 0 }, { id: 5, kind: "parameter", index: 0, path: 1 },
      { id: 6, kind: "capture", index: 0, path: 2 }, { id: 7, kind: "shared", definition: sharedDefinition, path: 2 },
      { id: 8, kind: "shared", definition: distinctDefinition, path: 2 }],
    boundProducers: Array.from({ length: 9 }, (_, id) => ({ id, producer: id,
      bindings: id >= 7 ? sharedBindings : binding.request.bindings.bindings, context: 0 })),
    origins: [{ id: 0, kind: "complete", producers: [0, 1, 2, 3, 4, 5, 6, 7, 8], includesAbsence: true },
      { id: 1, kind: "open", producers: [7], includesAbsence: false, boundaries: [0, 1] },
      { id: 2, kind: "complete", producers: [0], includesAbsence: false },
      { id: 3, kind: "complete", producers: [1], includesAbsence: false }],
    boundaries: [{ id: 0, kind: "opaque-result", at: at(1), subject: 7, owner: 3,
      bindings: binding.request.bindings.bindings, context: 0, detail: "result" },
    { id: 1, kind: "opaque-write", at: at(2), subject: 6, owner: 4,
      bindings: binding.request.bindings.bindings, context: 0, detail: "write" }],
    contexts: [{ id: 0, receiver: 2, arguments: [3], captures: [{ index: 0, location: 2 }] }],
  }, parameters: [{ slot: { kind: "receiver" }, reads: { kind: "complete", paths: [0, 1, 2] }, writes: complete },
    { slot: { kind: "parameter", index: 0 }, reads: complete,
      writes: { kind: "open", paths: [0, 1, 2], boundaries: [0, 1] } }],
  captures: [{ index: 0, reads: { kind: "open", paths: [0, 1, 2], boundaries: [0, 1] },
    writes: { kind: "complete", paths: [0, 1, 2] } }],
  result: 0, thrown: 1, writes: [{ target: 0, value: 1 }, { target: 3, value: 0 }, { target: 7, value: 1 }],
  retention: [{ source: 3, into: { kind: "shared", definition: sharedDefinition, path: 2 } },
    { source: 4, into: { kind: "receiver", path: 0 } },
    { source: 5, into: { kind: "parameter", index: 0, path: 1 } },
    { source: 6, into: { kind: "capture", index: 0, path: 2 } },
    { source: 7, into: { kind: "external", boundary: 0 } }, { source: 8, into: { kind: "return" } }],
  });
  const entries = new Map([[identityKey(root), binding],
    [identityKey(first), exportBinding(sharedDefinition, { signature: null, bindings: sharedBindings })],
    [identityKey(second), exportBinding(sharedDefinition, { signature: null, bindings: sharedBindings })],
    [identityKey(distinct), exportBinding(distinctDefinition, { signature: null, bindings: sharedBindings })]]);
  const bound = ({ sources, sourceRoles: [] });
  for (const aliases of [[first, second], [second, first]]) {
    const raw = (authoredSummary(root, {
      projections: [{ id: 0, parent: null, projection: { kind: "element" } },
        { id: 1, parent: null, projection: { kind: "element" } },
        { id: 2, parent: 0, projection: { kind: "index", constant: 7n } },
        { id: 3, parent: 1, projection: { kind: "index", constant: 7n } },
        { id: 4, parent: 2, projection: { kind: "deref" } }, { id: 5, parent: 3, projection: { kind: "deref" } }],
      producers: [{ id: 0, kind: "allocation", site: 0, path: 4 }, { id: 1, kind: "allocation", site: 0, path: 5 },
        { id: 2, kind: "receiver", path: 0 }, { id: 3, kind: "receiver", path: 1 },
        { id: 4, kind: "parameter", index: 0, path: 2 }, { id: 5, kind: "parameter", index: 0, path: 3 },
        { id: 6, kind: "capture", index: 0, path: 4 }, { id: 7, kind: "capture", index: 0, path: 5 },
        { id: 8, kind: "shared", identity: aliases[0], path: 4 },
        { id: 9, kind: "shared", identity: aliases[1], path: 5 },
        { id: 10, kind: "shared", identity: distinct, path: 5 }, { id: 11, kind: "receiver", path: null },
        { id: 12, kind: "parameter", index: 0, path: null }, { id: 13, kind: "capture", index: 0, path: null }],
      origins: [{ id: 0, kind: "complete", producers: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13], includesAbsence: true },
        { id: 1, kind: "open", producers: [8, 9], includesAbsence: false, boundaries: [0, 1] }],
      boundaries: [{ id: 0, kind: "opaque-result", site: 1, subject: 9, owner: 1, detail: "result" },
        { id: 1, kind: "opaque-write", site: 2, subject: 7, owner: 3, detail: "write" }],
      parameters: [{ slot: { kind: "receiver" }, reads: paths, writes: complete },
        { slot: { kind: "parameter", index: 0 }, reads: complete, writes: open }],
      captures: [{ index: 0, reads: open, writes: paths }], result: 0, thrown: 1,
      writes: [{ target: 0, value: 0 }, { target: 11, value: 1 }, { target: 1, value: 0 },
        { target: 8, value: 1 }, { target: 9, value: 1 }],
      retention: [{ source: 0, into: { kind: "shared", identity: first, path: 4 } },
        { source: 0, into: { kind: "shared", identity: second, path: 5 } },
        { source: 10, into: { kind: "return" } },
        { source: 1, into: { kind: "shared", identity: first, path: 5 } },
        { source: 2, into: { kind: "receiver", path: 0 } }, { source: 3, into: { kind: "receiver", path: 1 } },
        { source: 4, into: { kind: "parameter", index: 0, path: 2 } },
        { source: 5, into: { kind: "parameter", index: 0, path: 3 } },
        { source: 6, into: { kind: "capture", index: 0, path: 4 } },
        { source: 7, into: { kind: "capture", index: 0, path: 5 } },
        { source: 8, into: { kind: "external", boundary: 0 } }, { source: 9, into: { kind: "external", boundary: 0 } }],
    }));
    assert.deepEqual(product.verifyAuthoredSummaries({ sources }, [raw]), []);
    assert.deepEqual(await bindNativeBatch(bound, [raw], [root, first, second, distinct].map(identity => readyAssociation(identity, entries.get(identityKey(identity))))), { kind: "ok", value: [expected], diagnostics: [] });
  }
});

test("canonical shared producers retain distinct full binding alternatives without duplicating producer identity", async () => {
  const module = identity();
  const root = exportIdentity(module, "a", null, "signature");
  const shared = ["b", "c", "d"].map(id => exportIdentity(module, id));
  const bound = ({ sources: catalogue([moduleValue({ exports: [
    declaration({ id: "a", exportName: "a", signatures: [signature()] }),
    ...["b", "c", "d"].map(id => declaration({ id, exportName: id })),
  ] })]).sources, sourceRoles: [] });
  const binding = exportBinding(definitionId("api"));
  const sharedDefinition = definitionId("shared");
  const distinctDefinition = definitionId("distinct");
  const first = emptyBindings({ classBindings: [{ kind: "bound", parameter: { owner: sharedDefinition, index: 0 }, type: tyId(0) }] });
  const second = emptyBindings({ classBindings: [{ kind: "bound", parameter: { owner: sharedDefinition, index: 0 }, type: tyId(1) }] });
  const raw = (authoredSummary(root, {
    producers: shared.map((identity, id) => ({ id, kind: "shared", identity, path: null })),
    origins: [{ id: 0, kind: "complete", producers: [0, 1, 2], includesAbsence: false }],
    writes: [{ target: 0, value: 0 }, { target: 1, value: 0 }, { target: 2, value: 0 }],
    retention: [0, 1, 2].map(source => ({ source, into: { kind: "return" } })),
  }));
  const entries = new Map([[identityKey(root), binding],
    [identityKey(shared[0]), exportBinding(sharedDefinition, { signature: null, bindings: first })],
    [identityKey(shared[1]), exportBinding(sharedDefinition, { signature: null, bindings: second })],
    [identityKey(shared[2]), exportBinding(distinctDefinition, { signature: null, bindings: first })]]);
  const expected = emptySummary(binding, { arena: { projections: [],
    producers: [{ id: 0, kind: "shared", definition: sharedDefinition, path: null },
      { id: 1, kind: "shared", definition: distinctDefinition, path: null }],
    contexts: [{ id: 0, receiver: null, arguments: [], captures: [] }],
    boundProducers: [{ id: 0, producer: 0, bindings: first, context: 0 },
      { id: 1, producer: 0, bindings: second, context: 0 }, { id: 2, producer: 1, bindings: first, context: 0 }],
    origins: [{ id: 0, kind: "complete", producers: [0, 1, 2], includesAbsence: false }], boundaries: [] },
  writes: [{ target: 0, value: 0 }, { target: 1, value: 0 }],
  retention: [{ source: 0, into: { kind: "return" } }, { source: 1, into: { kind: "return" } }] });
  assert.deepEqual(product.verifyAuthoredSummaries({ sources: bound.sources }, [raw]), []);
  assert.deepEqual(await bindNativeBatch(bound, [raw], [root, ...shared].map(identity => readyAssociation(identity, entries.get(identityKey(identity))))), { kind: "ok", value: [expected], diagnostics: [] });
});

test("canonical member paths compare complete actual values rather than authored identity or object address", async () => {
  const module = identity();
  const root = exportIdentity(module, "a", null, "signature");
  const first = exportIdentity(module, "b", "member");
  const second = exportIdentity(module, "c", "member");
  const bound = ({ sources: catalogue([moduleValue({ exports: [
    declaration({ id: "a", exportName: "a", signatures: [signature()] }),
    ...["b", "c"].map(id => declaration({ id, exportName: id, members: [member()] })),
  ] })]).sources, sourceRoles: [] });
  const binding = exportBinding(definitionId("api"));
  const owner = definitionId("member-owner");
  const body = encodeBodyId({ owner, role: "function", ordinal: 0 });
  const endpoint = { declaration: owner, role: "advertised", signature: sigId(0), body };
  const callee = { decision: { candidate: 0, advertised: endpoint, api: { ...endpoint, role: "api-signature" },
    bindings: emptyBindings(), implementationBindings: emptyBindings(), parameters: [
      { kind: "argument", parameter: 0, argument: 0, component: null, passing: "by-value" },
      { kind: "default", parameter: 1, initializer: body }, { kind: "omitted", parameter: 2, type: tyId(0) },
      { kind: "rest", parameter: 3, arguments: [1, 2], passing: "by-value" }],
    completion: { signature: sigId(0), completion: tyId(0), yielded: null, sent: null }, result: tyId(0), activation: null },
  activation: { body, bindings: { kind: "parametric" } } };
  const base = selectedMember();
  const decisionChanges = [
    { key: { kind: "text", value: "other" } },
    { key: { kind: "number", value: { numerator: 0n, denominator: 1n, negativeZero: true } } },
    { key: { kind: "symbol", declaration: owner } },
    { origins: [{ kind: "declared", declaration: owner }] },
    { origins: [{ kind: "class-prototype", owner }] },
    { origins: [{ kind: "mapped", owner: { kind: "body", value: { body, node: nodeId(0) } }, key: { kind: "text", value: "k" } }] },
    { origins: [{ kind: "mapped", owner: { kind: "item", value: { owner, node: nodeId(0) } }, key: { kind: "symbol", declaration: owner } }] },
    { selectedDeclarations: [owner] }, { primary: owner }, { read: tyId(0) }, { write: tyId(0) },
    { getter: endpoint }, { setter: { ...endpoint, role: "api-body" } },
    { bindings: emptyBindings({ selfBindings: [{ kind: "bound", owner, type: tyId(0) }] }) },
    { location: { kind: "accessor" } },
    { location: { kind: "data", check: { kind: "none" }, receiver: "by-reference" } },
    { location: { kind: "data", check: { kind: "required", failure: "unwind" }, receiver: "in-place" } },
    { location: { kind: "data", check: { kind: "required", failure: "abort" }, receiver: "in-place" } },
  ];
  const variants = [...decisionChanges.map(change => selectedMember({ decision: { ...base.decision, ...change } })),
    selectedMember({ getter: callee }), selectedMember({ setter: callee }),
    selectedMember({ getter: { ...callee, activation: null } }),
    selectedMember({ getter: { ...callee, activation: { body, bindings: { kind: "instantiated", bindings: emptyBindings() } } } })];
  const comparisons = [{ one: base, two: structuredClone(base), different: false },
    ...variants.flatMap(value => [{ one: value, two: structuredClone(value), different: false },
      { one: base, two: value, different: true }]),
    ...[
      { candidate: 1 }, { advertised: { ...endpoint, signature: sigId(1) } },
      { api: { ...endpoint, role: "api-signature", body: null } },
      { bindings: emptyBindings({ selfBindings: [{ kind: "rigid", owner }] }) },
      { implementationBindings: emptyBindings({ selfBindings: [{ kind: "rigid", owner }] }) },
      { parameters: [{ kind: "argument", parameter: 0, argument: 0, component: 0, passing: "by-value" }] },
      { completion: { ...callee.decision.completion, sent: tyId(0) } }, { result: tyId(1) },
      { activation: "at-creation" }, { activation: "when-first-driven" },
    ].map(change => ({ one: selectedMember({ getter: callee }),
      two: selectedMember({ getter: { ...callee, decision: { ...callee.decision, ...change } } }), different: true }))];
  for (const kind of ["field", "method-value"]) {
    for (const comparison of comparisons) {
      const { different } = comparison;
      const one = (comparison.one);
      const two = (comparison.two);
      const raw = (authoredSummary(root, { projections: [
        { id: 0, parent: null, projection: { kind, identity: first } },
        { id: 1, parent: null, projection: { kind, identity: second } },
      ] }));
      const expected = emptySummary(binding);
      expected.arena.projections = [{ id: 0, parent: null, projection: { kind, member: one } },
        ...(different ? [{ id: 1, parent: null, projection: { kind, member: two } }] : [])];
      const entries = new Map([[identityKey(root), binding],
        [identityKey(first), exportBinding(definitionId("b"), { signature: null, member: one })],
        [identityKey(second), exportBinding(definitionId("c"), { signature: null, member: two })]]);
      assert.deepEqual(product.verifyAuthoredSummaries({ sources: bound.sources }, [raw]), []);
      assert.deepEqual(await bindNativeBatch(bound, [raw], [root, first, second].map(identity => readyAssociation(identity, entries.get(identityKey(identity))))), { kind: "ok", value: [expected], diagnostics: [] });
    }
  }
});

test("bound retention orders all nine complete canonical targets for the same source", async () => {
  const { input, summary } = summaryInput(1);
  const definition = definitionId("api");
  const shared = exportIdentity(summary.identity.module);
  const sharedDefinition = definitionId("shared");
  const binding = exportBinding(definition, { signature: declaredSignature(definition, { receiver: tyId(0), parameters: [
    { declaration: definitionId("p"), kind: "required", type: tyId(0), passing: "by-value", initializer: null },
  ] }) });
  const complete = { kind: "complete", paths: [] };
  const raw = ({ ...summary, projections: [{ id: 0, parent: null, projection: { kind: "element" } }],
    producers: [{ id: 0, kind: "allocation", site: 0, path: null }],
    origins: [{ id: 0, kind: "complete", producers: [0], includesAbsence: false }],
    boundaries: [{ id: 0, kind: "external-input", site: 1, subject: 0, owner: null, detail: "input" }],
    captures: [{ index: 0, reads: complete, writes: complete }],
    retention: [{ source: 0, into: { kind: "throw" } }, { source: 0, into: { kind: "return" } },
      { source: 0, into: { kind: "suspension", site: 2 } }, { source: 0, into: { kind: "callback", site: 2 } },
      { source: 0, into: { kind: "external", boundary: 0 } }, { source: 0, into: { kind: "receiver", path: 0 } },
      { source: 0, into: { kind: "shared", identity: shared, path: 0 } },
      { source: 0, into: { kind: "capture", index: 0, path: 0 } },
      { source: 0, into: { kind: "parameter", index: 0, path: 0 } }],
  });
  const at = site => ({ kind: "declared", identity: summary.identity, site });
  const expected = emptySummary(binding, { arena: { projections: raw.projections,
    producers: [{ id: 0, kind: "receiver", path: null }, { id: 1, kind: "parameter", index: 0, path: null },
      { id: 2, kind: "capture", index: 0, path: null }, { id: 3, kind: "allocation", at: at(0), path: null }],
    boundProducers: [0, 1, 2, 3].map(id => ({ id, producer: id, bindings: binding.request.bindings.bindings, context: 0 })),
    origins: [{ id: 0, kind: "complete", producers: [3], includesAbsence: false },
      { id: 1, kind: "complete", producers: [0], includesAbsence: false },
      { id: 2, kind: "complete", producers: [1], includesAbsence: false }],
    contexts: [{ id: 0, receiver: 1, arguments: [2], captures: [{ index: 0, location: 2 }] }],
    boundaries: [{ id: 0, kind: "external-input", at: at(1), subject: 3, owner: null,
      bindings: binding.request.bindings.bindings, context: 0, detail: "input" }] },
  parameters: [{ slot: { kind: "receiver" }, reads: complete, writes: complete },
    { slot: { kind: "parameter", index: 0 }, reads: complete, writes: complete }],
  captures: [{ index: 0, reads: complete, writes: complete }], retention: [
    { source: 3, into: { kind: "throw" } }, { source: 3, into: { kind: "return" } },
    { source: 3, into: { kind: "suspension", at: at(2) } }, { source: 3, into: { kind: "callback", at: at(2) } },
    { source: 3, into: { kind: "external", boundary: 0 } }, { source: 3, into: { kind: "receiver", path: 0 } },
    { source: 3, into: { kind: "shared", definition: sharedDefinition, path: 0 } },
    { source: 3, into: { kind: "capture", index: 0, path: 0 } },
    { source: 3, into: { kind: "parameter", index: 0, path: 0 } }],
  });
  const bound = ({ sources: input.sources, sourceRoles: [] });
  const entries = new Map([[identityKey(summary.identity), binding],
    [identityKey(shared), exportBinding(sharedDefinition, { signature: null })]]);
  assert.deepEqual(product.verifyAuthoredSummaries(input, [raw]), []);
  assert.deepEqual(await bindNativeBatch(bound, [raw], [summary.identity, shared].map(identity => readyAssociation(identity, entries.get(identityKey(identity))))), { kind: "ok", value: [expected], diagnostics: [] });
});

test("binding remaps the complete relational graph into signature-order formals with exact members/bindings and no lost edges", async () => {
  const module = identity();
  const root = exportIdentity(module, "a", null, "signature");
  const shared = exportIdentity(module, "b");
  const field = exportIdentity(module, "b", "field");
  const method = exportIdentity(module, "b", "method");
  const parameter = type => ({ name: "p", type, passingMode: "by-value", optional: false, rest: false, defaultType: null });
  const sources = catalogue([moduleValue({ types: [{ id: 0, kind: "unknown" },
    { id: 1, kind: "function", signature: signature({ id: "callback", parameters: [parameter(0), parameter(0)] }) }],
  exports: [declaration({ id: "a", exportName: "a", signatures: [signature({ parameters: [parameter(1), { ...parameter(1), rest: true }] })] }),
    declaration({ id: "b", exportName: "b", members: [member({ id: "field", kind: "field" }), member({ id: "method" })] })] })]).sources;
  const definition = definitionId("a");
  const sharedDefinition = definitionId("b");
  const binding = exportBinding(definition, { signature: declaredSignature(definition, { receiver: tyId(0), parameters: [
    { declaration: definitionId("parameter0"), kind: "required", type: tyId(0), passing: "by-value", initializer: null },
    { declaration: definitionId("parameter1"), kind: "rest", type: tyId(0), passing: "by-value", initializer: null },
  ] }) });
  const sharedBindings = emptyBindings({ methodBindings: [{ kind: "rigid", parameter: { owner: sharedDefinition, index: 0 } }] });
  const fieldMember = selectedMember();
  const methodMember = selectedMember({ decision: { ...selectedMember().decision,
    key: { kind: "number", value: { numerator: -9007199254740993n, denominator: 2n, negativeZero: false } } } });
  const entries = new Map([[identityKey(root), binding],
    [identityKey(shared), exportBinding(sharedDefinition, { signature: null, bindings: sharedBindings })],
    [identityKey(field), exportBinding(definitionId("field"), { signature: null, member: fieldMember })],
    [identityKey(method), exportBinding(definitionId("method"), { signature: null, member: methodMember })]]);
  const complete = { kind: "complete", paths: [] };
  const kinds = ["external-input", "external-write", "opaque-write", "opaque-result", "unclassified-exposure",
    "opaque-invocation", "unresolved-transport"];
  const raw = authoredSummary(root, {
    projections: [{ id: 0, parent: null, projection: { kind: "element" } },
      { id: 1, parent: 0, projection: { kind: "index", constant: -9007199254740993n } },
      { id: 2, parent: 1, projection: { kind: "deref" } },
      { id: 3, parent: 2, projection: { kind: "field", identity: field } },
      { id: 4, parent: 3, projection: { kind: "method-value", identity: method } }],
    producers: [{ id: 0, kind: "allocation", site: 0, path: null },
      { id: 1, kind: "parameter", index: 1, path: null }, { id: 2, kind: "receiver", path: null },
      { id: 3, kind: "capture", index: 0, path: null }, { id: 4, kind: "parameter", index: 0, path: null },
      { id: 5, kind: "shared", identity: shared, path: null }, { id: 6, kind: "parameter", index: 1, path: 0 },
      { id: 7, kind: "receiver", path: 1 }, { id: 8, kind: "capture", index: 0, path: 2 },
      { id: 9, kind: "allocation", site: 1, path: 3 }],
    origins: [{ id: 0, kind: "complete", producers: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], includesAbsence: true },
      { id: 1, kind: "open", producers: [], includesAbsence: false, boundaries: [0, 1, 2, 3, 4, 5, 6] }],
    boundaries: kinds.map((kind, id) => ({ id, kind, site: id + 2, subject: 0, owner: id === 0 ? null : 2, detail: `reason${id}` })),
    parameters: [{ slot: { kind: "receiver" }, reads: { kind: "complete", paths: [0, 1] },
      writes: { kind: "open", paths: [], boundaries: [0] } },
    { slot: { kind: "parameter", index: 0 }, reads: { kind: "complete", paths: [2, 3] }, writes: { kind: "complete", paths: [4] } }],
    captures: [{ index: 0, reads: { kind: "open", paths: [2], boundaries: [1] }, writes: complete }],
    result: 0, thrown: 1, writes: [{ target: 0, value: 0 }, { target: 1, value: 1 }, { target: 2, value: 0 }],
    retention: [{ source: 0, into: { kind: "return" } }, { source: 1, into: { kind: "throw" } },
      { source: 2, into: { kind: "shared", identity: shared, path: 0 } },
      { source: 3, into: { kind: "parameter", index: 1, path: 1 } }, { source: 4, into: { kind: "receiver", path: 2 } },
      { source: 4, into: { kind: "receiver", path: null } },
      { source: 5, into: { kind: "capture", index: 0, path: null } },
      { source: 6, into: { kind: "callback", site: 5 } }, { source: 7, into: { kind: "suspension", site: 6 } },
      { source: 8, into: { kind: "external", boundary: 1 } }],
    callbacks: [{ parameterIndex: 0, timing: "synchronous", rejection: 1, inputs: [
      { kind: "receiver-element", parameterIndex: 0 }, { kind: "argument-element", parameterIndex: 1, sourceParameterIndex: 1 },
    ] }, { parameterIndex: 1, timing: "deferred", rejection: null, inputs: [{ kind: "receiver-rejection", parameterIndex: 0 }] }],
    invocationOnlyParameters: [0, 1], suspends: true, bindingDependent: true,
  });
  const at = site => ({ kind: "declared", identity: root, site });
  const expected = { key: summaryExecutionKey(binding), signature: sigId(0), arena: {
    projections: [{ id: 0, parent: null, projection: { kind: "element" } },
      { id: 1, parent: 0, projection: { kind: "index", constant: -9007199254740993n } },
      { id: 2, parent: 1, projection: { kind: "deref" } }, { id: 3, parent: 2, projection: { kind: "field", member: fieldMember } },
      { id: 4, parent: 3, projection: { kind: "method-value", member: methodMember } }],
    producers: [{ id: 0, kind: "receiver", path: null }, { id: 1, kind: "parameter", index: 0, path: null },
      { id: 2, kind: "parameter", index: 1, path: null }, { id: 3, kind: "capture", index: 0, path: null },
      { id: 4, kind: "allocation", at: at(0), path: null }, { id: 5, kind: "shared", definition: sharedDefinition, path: null },
      { id: 6, kind: "parameter", index: 1, path: 0 }, { id: 7, kind: "receiver", path: 1 },
      { id: 8, kind: "capture", index: 0, path: 2 }, { id: 9, kind: "allocation", at: at(1), path: 3 }],
    contexts: [{ id: 0, receiver: 2, arguments: [3, 4], captures: [{ index: 0, location: 3 }] }],
    boundProducers: Array.from({ length: 10 }, (_, id) => ({ id, producer: id,
      bindings: id === 5 ? sharedBindings : binding.request.bindings.bindings, context: 0 })),
    origins: [{ id: 0, kind: "complete", producers: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], includesAbsence: true },
      { id: 1, kind: "open", producers: [], includesAbsence: false, boundaries: [0, 1, 2, 3, 4, 5, 6] },
      { id: 2, kind: "complete", producers: [0], includesAbsence: false },
      { id: 3, kind: "complete", producers: [1], includesAbsence: false },
      { id: 4, kind: "complete", producers: [2], includesAbsence: false }],
    boundaries: kinds.map((kind, id) => ({ id, kind, at: at(id + 2), subject: 4, owner: id === 0 ? null : 0,
      bindings: binding.request.bindings.bindings, context: 0, detail: `reason${id}` })),
  }, parameters: [{ slot: { kind: "receiver" }, reads: { kind: "complete", paths: [0, 1] }, writes: { kind: "open", paths: [], boundaries: [0] } },
    { slot: { kind: "parameter", index: 0 }, reads: { kind: "complete", paths: [2, 3] }, writes: { kind: "complete", paths: [4] } },
    { slot: { kind: "parameter", index: 1 }, reads: complete, writes: complete }],
  captures: [{ index: 0, reads: { kind: "open", paths: [2], boundaries: [1] }, writes: complete }],
  result: 0, thrown: 1, writes: [{ target: 0, value: 0 }, { target: 2, value: 1 }, { target: 4, value: 0 }],
  retention: [{ source: 0, into: { kind: "shared", definition: sharedDefinition, path: 0 } },
    { source: 1, into: { kind: "receiver", path: 2 } }, { source: 1, into: { kind: "receiver", path: null } },
    { source: 2, into: { kind: "throw" } },
    { source: 3, into: { kind: "parameter", index: 1, path: 1 } }, { source: 4, into: { kind: "return" } },
    { source: 5, into: { kind: "capture", index: 0, path: null } },
    { source: 6, into: { kind: "callback", at: at(5) } }, { source: 7, into: { kind: "suspension", at: at(6) } },
    { source: 8, into: { kind: "external", boundary: 1 } }],
  callbacks: [{ parameterIndex: 0, timing: "synchronous", rejection: 1, inputs: [
    { kind: "receiver-element", parameterIndex: 0 }, { kind: "argument-element", parameterIndex: 1, sourceParameterIndex: 1 },
  ] }, { parameterIndex: 1, timing: "deferred", rejection: null, inputs: [{ kind: "receiver-rejection", parameterIndex: 0 }] }],
  invocationOnlyParameters: [0, 1], suspends: true, bindingDependent: true };
  const bound = ({ sources, sourceRoles: [] });
  const result = await bindNativeBatch(bound, ([raw]), [root, field, method, shared].map(identity => readyAssociation(identity, entries.get(identityKey(identity)))));
  assert.deepEqual(result, { kind: "ok", value: [expected], diagnostics: [] });
  assert.equal(result.value[0].arena.projections[3].projection.member === fieldMember, true);
  assert.equal(result.value[0].arena.projections[4].projection.member === methodMember, true);
});

test("native guarantee admission preserves source/role vectors without constructing execution summaries", () => {
  const bound = { sources: [], sourceRoles: [] };
  assert.deepEqual(product.admitGuarantees(bound, [], []), { kind: "ok", value: { ...bound, guarantees: [] }, diagnostics: [] });
  const { input, summary } = summaryInput();
  const selected = readyAssociation(summary.identity, exportBinding(definitionId("api")));
  const staged = { sources: input.sources, sourceRoles: [] };
  const actual = product.admitGuarantees(staged, [summary], [selected]);
  assert.deepEqual(actual, { kind: "ok", value: { ...staged, guarantees: [{ statement: summary, declaration: selected.request.definition }] }, diagnostics: [] });
  assert.equal(actual.value.sources === staged.sources && actual.value.sourceRoles === staged.sourceRoles, true);
  assert.equal("declaredSummaries" in actual.value, false, "Libraries never publishes a premature Facts.Summary");
  for (const associations of [[], [selected, selected], [{ ...selected, kind: "noncallable", declaration: selected.request.definition,
    bindings: selected.request.bindings.bindings }]]) {
    assert.deepEqual(product.admitGuarantees(staged, [summary], associations), { kind: "refused", diagnostics: [summaryError(summary.identity)] });
  }
  assert.deepEqual(product.admitGuarantees(staged, [summary, summary], [selected]), { kind: "refused", diagnostics: [summaryError(summary.identity)] });
});

test("final admitted guarantees retain native identity, exact selected declaration and canonical authored order", () => {
  const { input, summary } = summaryInput();
  const first = summary.identity;
  const second = exportIdentity(first.module, "second", null, "signature");
  const source = input.sources[0];
  const module = source.modules[0];
  const sources = [{ ...source, modules: [{ ...module, exports: [...module.exports,
    declaration({ id: "second", exportName: "second", signatures: [signature()] })] }] }];
  const firstSelected = readyAssociation(first, exportBinding(definitionId("first")));
  const secondSelected = readyAssociation(second, exportBinding(definitionId("second")));
  const a = { statement: summary, declaration: firstSelected.request.definition };
  const b = { statement: authoredSummary(second), declaration: secondSelected.request.definition };
  const current = { sources, sourceRoles: [], guarantees: [a, b] };
  const context = { definitionExists: () => true, definitionOfExport: () => { throw new Error("No roles."); },
    associations: [firstSelected, secondSelected] };
  assert.deepEqual(product.verifyLibraries(current, context), []);
  assert.deepEqual(product.verifyLibraries({ ...current, guarantees: [b, a] }, context),
    [finding("declared-summaries-order", { kind: "export", identity: first })]);
  assert.deepEqual(product.verifyLibraries({ ...current, guarantees: [a, a] }, context),
    [finding("declared-summaries-order", { kind: "export", identity: first })]);
  for (const changed of [{ ...context, definitionExists: () => false },
    { ...context, associations: [{ ...firstSelected, request: { ...firstSelected.request, definition: secondSelected.request.definition } }] }]) {
    assert.equal(product.verifyLibraries({ ...current, guarantees: [a] }, changed).some(row => row.rule === "summary-binding-definition-exact"), true);
  }
  for (const associations of [[], [firstSelected, firstSelected], [{ ...firstSelected, kind: "noncallable",
    declaration: firstSelected.request.definition, bindings: emptyBindings() }]]) {
    assert.deepEqual(product.verifyLibraries({ ...current, guarantees: [a] }, { ...context, associations }),
      [finding("declared-summary-identity-resolves", { kind: "export", identity: first })]);
  }
  for (const selected of [{ ...firstSelected, member: selectedMember() }, { ...firstSelected,
    signature: { ...firstSelected.signature, declaration: secondSelected.request.definition } }]) {
    assert.deepEqual(product.verifyLibraries({ ...current, guarantees: [a] }, { ...context, associations: [selected] }),
      [finding("summary-binding-signature-exact", { kind: "export", identity: first })]);
  }
  assert.deepEqual(product.verifyLibraries({ sources: [], sourceRoles: [], guarantees: [] }, { ...context, associations: [] }), []);
});

test("the complete actual libraries module passes fresh strict isolation against genuine dependency value declarations", async () => {
  const areas = JSON.parse(readFileSync(resolve(repository, "test/architecture/quarantine/areas.json"), "utf8"));
  const deps = isolationDeps(tooling, areas.areas.map(area => area.directory));
  const { owner, interfaces, production } = isolationInputs(deps);
  const report = await compileIsolated(deps, owner, { root: repository, sourceFiles: ownedSources,
    interfaceSources: interfaces, declarationSources: production, outputDirectory: ".temp/host-f-libraries/isolation" });
  const evidence = resolve(evidenceDirectory, "isolation.json");
  writeFileSync(evidence, `${JSON.stringify(report, null, 2)}\n`);
  assert.equal(report.status, "passed", `complete isolation evidence: ${evidence}`);
  assert.deepEqual(report.findings, []);
  assert.equal(report.diagnostics.length, 2);
  assert.equal(report.sourceInventory.length, ownedSources.length + production.length);
  assert.equal(report.provenance.some(row => row.source.endsWith("/ids/index.ts")), true);
  assert.equal(report.provenance.some(row => row.source.endsWith("/diag/index.ts")), true);
  assert.equal(report.loadedInventory.every(path => report.expectedInventory.includes(path)), true);
  for (const source of interfaces) {
    const suffix = `/isolated/${source.replace(/\.ts$/u, ".d.ts")}`;
    assert.equal(report.loadedInventory.some(path => path.endsWith(suffix)), true, source);
  }
  assert.equal(report.loadedInventory.some(path => path.includes("/isolated/") &&
    path.endsWith(".ts") && !path.endsWith(".d.ts") && !ownedSources.some(source => path.endsWith(`/${source}`))), false);
});

test("late native specialization retains every bound and rigid family and refuses a different selected complete environment", async () => {
  const { bindDeclaredSummary } = await import("../../packages/host/dist/summaries/index.js");
  const { input, summary } = summaryInput();
  const owner = definitionId("method");
  const nominal = definitionId("class");
  const outer = definitionId("outer");
  const environment = emptyBindings({
    classBindings: [{ kind: "bound", parameter: { owner: nominal, index: 0 }, type: tyId(0) },
      { kind: "rigid", parameter: { owner: nominal, index: 1 } }],
    methodBindings: [{ kind: "rigid", parameter: { owner, index: 0 } },
      { kind: "bound", parameter: { owner, index: 1 }, type: tyId(1) }],
    capturedBindings: [{ kind: "bound", parameter: { owner: outer, index: 0 }, type: tyId(1) },
      { kind: "rigid", parameter: { owner: outer, index: 1 } }],
    selfBindings: [{ kind: "rigid", owner: outer }, { kind: "bound", owner: nominal, type: tyId(0) }],
  });
  const selected = readyAssociation(summary.identity, exportBinding(owner, { bindings: environment,
    signature: declaredSignature(owner, { typeParameters: [0, 1].map(index => ({ identity: { owner, index },
      declaration: definitionId(`method-T${index}`), constraint: null, default: null })) }) }));
  input.sources[0].modules[0].exports[0].signatures[0].typeParameters = [0, 1].map(index => ({
    name: `method-T${index}`, constraints: [], defaultType: null, variance: "invariant",
  }));
  const admitted = product.admitGuarantees({ sources: input.sources, sourceRoles: [] }, [summary], [selected]);
  assert.equal(admitted.kind, "ok");
  const deps = { signature: selected.signature, parameters: [], source: { kind: "item", value: { owner, node: nodeId(0) } } };
  const request = { kind: "native", guarantee: admitted.value.guarantees[0], associations: [selected],
    execution: summaryExecutionKey(selected).execution };
  const result = bindDeclaredSummary(deps, request);
  assert.deepEqual(result, { kind: "ok", value: emptySummary(selected), diagnostics: [] });
  for (const family of ["classBindings", "methodBindings", "capturedBindings", "selfBindings"]) {
    const bindings = { ...environment, [family]: [...environment[family]].reverse() };
    const changed = { ...request.execution.request, bindings: { kind: "instantiated", bindings } };
    assert.deepEqual(bindDeclaredSummary(deps, { ...request, execution: { ...request.execution, request: changed } }),
      { kind: "refused", diagnostics: [lateSummaryError(changed)] }, `${family} position/owner identity is part of the one complete request`);
  }
});

test("fresh actual public declarations accept all nine ports and reject complete readonly/closed-port opposites", () => {
  const areas = JSON.parse(readFileSync(resolve(repository, "test/architecture/quarantine/areas.json"), "utf8"));
  const deps = isolationDeps(tooling, areas.areas.map(area => area.directory));
  const { production } = isolationInputs(deps);
  const stage = mkdtempSync(resolve(evidenceDirectory, "consumer-"));
  writeFileSync(resolve(stage, "package.json"), '{"type":"module","private":true}\n');
  const declarations = new Map();
  for (const source of [...ownedSources, ...production]) {
    const local = source.slice("packages/host/src/".length).replace(/\.ts$/u, ".d.ts");
    const original = resolve(repository, "packages/host/dist", local);
    declarations.set(local, readFileSync(original, "utf8"));
  }
  for (const [local, text] of declarations) {
    const target = resolve(stage, local);
    mkdirSync(resolve(target, ".."), { recursive: true });
    writeFileSync(target, text);
  }
  const positive = `import * as Libraries from "./libraries/index.js";
import type * as Port from "./libraries/contract.js";
import type { LibraryAuthoredSummary, LibraryRole } from "./snapshot/contract.js";
import type { LibraryExportIdentity } from "./ids/contract.js";
export function inspect(catalogue: Port.LibraryCatalogue, bound: Port.BoundLibraries, libraries: Port.Libraries,
  declared: readonly LibraryAuthoredSummary[], context: Port.LibraryVerificationContext,
  identity: LibraryExportIdentity, role: LibraryRole): void {
  const ports: readonly [Port.BindRoles, Port.AdmitGuarantees, Port.LibraryExportKey, Port.LibraryRolesOf, Port.LibraryRoleOf,
    Port.VerifyLibraryCatalogue, Port.VerifyAuthoredSummaries, Port.VerifyBoundLibraries, Port.VerifyLibraries] = [
    Libraries.bindRoles, Libraries.admitGuarantees, Libraries.libraryExportKey, Libraries.libraryRolesOf, Libraries.libraryRoleOf,
    Libraries.verifyLibraryCatalogue, Libraries.verifyAuthoredSummaries, Libraries.verifyBoundLibraries, Libraries.verifyLibraries];
  const roles = Libraries.bindRoles(catalogue, context.definitionOfExport);
  const summaries = Libraries.admitGuarantees(bound, declared, context.associations);
  if (roles.kind === "ok") void roles.value.sourceRoles;
  else void roles.diagnostics;
  if (summaries.kind === "ok") void summaries.value.guarantees;
  else void summaries.diagnostics;
  void Libraries.libraryRolesOf(bound, role); void Libraries.libraryRoleOf(catalogue, identity);
  void Libraries.verifyLibraryCatalogue(catalogue); void Libraries.verifyAuthoredSummaries(catalogue, declared);
  void Libraries.verifyBoundLibraries(bound, context); void Libraries.verifyLibraries(libraries, context); void ports;
}
`;
  writeFileSync(resolve(stage, "positive.mts"), positive);
  const negatives = [
    ["readonly-source.mts", 'import type { LibraryCatalogue } from "./libraries/contract.js"; export function change(value: LibraryCatalogue): void { value.sources = []; }', 2540],
    ["readonly-binding.mts", 'import type { BoundLibraries } from "./libraries/contract.js"; export function change(value: BoundLibraries): void { value.sourceRoles.push(); }', 2339],
    ["readonly-summary.mts", 'import type { Libraries } from "./libraries/contract.js"; export function change(value: Libraries): void { value.guarantees.push(); }', 2339],
    ["missing-reader.mts", 'import { admitGuarantees } from "./libraries/index.js"; admitGuarantees({ sources: [], sourceRoles: [] }, []);', 2554],
    ["static-register.mts", 'import { registerLibraries } from "./libraries/index.js"; void registerLibraries;', 2305],
    ["mutable-verifier.mts", 'import { verifyLibraryCatalogue } from "./libraries/index.js"; import type { LibraryCatalogue, LibraryRule, LibrarySite } from "./libraries/contract.js"; import type { Violation } from "./diag/contract.js"; export const mutable: (input: LibraryCatalogue) => Violation<LibraryRule, LibrarySite>[] = verifyLibraryCatalogue;', 2322],
    ["incomplete-reader.mts", 'import type { NativeExportAssociation } from "./libraries/contract.js"; export const input: NativeExportAssociation = {};', 2322],
  ];
  for (const [name, text] of negatives) writeFileSync(resolve(stage, name), `${text}\n`);
  const configuration = files => ({ compilerOptions: { strict: true, noUncheckedIndexedAccess: true,
    exactOptionalPropertyTypes: true, noUnusedLocals: true, noUnusedParameters: true, noImplicitReturns: true,
    noFallthroughCasesInSwitch: true, forceConsistentCasingInFileNames: true, noEmit: true, skipLibCheck: false,
    target: "es2022", lib: ["es2022"], module: "nodenext", moduleResolution: "nodenext", types: [],
    verbatimModuleSyntax: true }, files });
  const run = (name, files) => {
    const config = resolve(stage, `${name}.json`);
    writeFileSync(config, `${JSON.stringify(configuration(files))}\n`);
    const result = spawnSync(process.execPath, [deps.compiler, "--project", config, "--listFiles", "--pretty", "false"], {
      cwd: stage, encoding: "utf8", timeout: 90_000, maxBuffer: 4_194_304,
    });
    assert.equal(result.error === undefined && result.signal === null, true, "actual guarded consumer compiler terminates normally");
    const output = `${result.stdout}${result.stderr}`;
    writeFileSync(resolve(stage, `${name}.log`), output);
    return { status: result.status, output };
  };
  const accepted = run("positive", ["positive.mts"]);
  assert.equal(accepted.status, 0, `complete consumer evidence: ${stage}/positive.log`);
  const graph = readImportGraph(parseSources(declarations), declarations);
  const reachable = new Set(["libraries/index.d.ts", "libraries/contract.d.ts", "snapshot/contract.d.ts", "ids/contract.d.ts"]);
  for (const path of reachable) for (const edge of graph) if (edge.source === path && edge.target !== null) reachable.add(edge.target);
  const loaded = accepted.output.split(/\r?\n/u).filter(path => path.startsWith(stage))
    .map(path => relative(stage, path).split(sep).join("/")).sort();
  assert.deepEqual(loaded, ["positive.mts", ...reachable].sort());
  const refused = run("negative", negatives.map(([name]) => name));
  assert.equal(refused.status, 1, `complete negative evidence: ${stage}/negative.log`);
  const actual = [...refused.output.matchAll(/^(?:(.+)\(\d+,\d+\): )?error TS(\d+):/gmu)]
    .map(match => [match[1] === undefined ? null : basename(match[1]), Number(match[2])]);
  assert.equal(actual.length, [...refused.output.matchAll(/error TS\d+:/gu)].length,
    "every located and unlocated compiler error belongs to the complete diagnostic inventory");
  const order = values => values.sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0);
  assert.deepEqual(order(actual), order(negatives.map(([name, , code]) => [name, code])), `complete negative evidence: ${stage}/negative.log`);
});

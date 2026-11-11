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
import { encodeDefId, encodeKey, encodeModuleId, encodePackageId } from "../../packages/host/dist/ids/index.js";

const repository = fileURLToPath(new URL("../../", import.meta.url));
const tooling = process.env.TSONIC_HOST_TOOLING_ROOT ?? repository;
const sourceDirectory = "packages/host/src/libraries";
const emittedDirectory = resolve(repository, "packages/host/dist/libraries");
const runtimeNames = ["index", "verify-catalogue", "roles", "bind-summaries", "verify-summaries", "verify-bound"];
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

function immutable(value) {
  const work = [value];
  const visited = new Set();
  for (const current of work) {
    if (current === null || typeof current !== "object" || visited.has(current)) continue;
    visited.add(current);
    for (const child of Object.values(current)) work.push(child);
    Object.freeze(current);
  }
  return value;
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

function roleError(identity) {
  return { code: { kind: "host", name: "TSONIC_LIBRARY_ROLE_BINDING_INVALID", rendered: "TSONIC_LIBRARY_ROLE_BINDING_INVALID" },
    severity: "error", site: { kind: "none" }, source: "libraries", evidence: [identityKey(identity)],
    message: "Library role binding does not resolve the declared export identity.", arguments: [], related: [], fix: null };
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

test("the public index has exactly the eight approved typed value ports and exact source owners", () => {
  assert.deepEqual(Object.keys(product).sort(), ["bindRoles", "bindSummaries", "libraryRoleOf", "libraryRolesOf",
    "verifyAuthoredSummaries", "verifyBoundLibraries", "verifyLibraries", "verifyLibraryCatalogue"]);
  assert.deepEqual(readdirSync(resolve(repository, sourceDirectory)).filter(name => name.endsWith(".ts")).sort(),
    ownedSources.map(path => basename(path)).sort());
});

for (const [level, name] of [["verifier", "empty-catalogue"], ["verifier", "duplicate-source"], ["function", "empty-role-binding"]]) {
  test(`independently authored complete JSON outcome ${level}/${name}`, async () => {
    const report = await runCase({
      modules: ["libraries"],
      readText: path => readFileSync(resolve(repository, path), "utf8"),
      canonical: path => relative(repository, realpathSync(resolve(repository, path))).split(sep).join("/"),
      list: path => readdirSync(resolve(repository, path)),
      decode: text => JSON.parse(text),
      adapters: {
        verifier: input => ({ kind: "accepted", value: product.verifyLibraryCatalogue(immutable(JSON.parse(input.text))), diagnostics: [] }),
        function: input => ({ kind: "accepted", value: product.bindRoles(immutable(JSON.parse(input.text)), () => {
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
  for (const input of inputs) assert.deepEqual(product.verifyLibraryCatalogue(immutable(input)), []);
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
    { kind: "unique-symbol", declaration: "D[M[P[project];input.ts];symbol]" },
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
  assert.deepEqual(product.verifyLibraryCatalogue(immutable(input)), []);
});

test("source IDs, complete module identities and associated text each have their minimal full opposite", () => {
  const firstIdentity = identity({ providerId: "a" });
  const secondIdentity = identity({ providerId: "z" });
  const first = moduleValue({ identity: firstIdentity });
  const second = moduleValue({ identity: secondIdentity });
  assert.deepEqual(product.verifyLibraryCatalogue(immutable(catalogue([second, first]))),
    [finding("module-identities-order", { kind: "module", module: firstIdentity })]);
  assert.deepEqual(product.verifyLibraryCatalogue(immutable(catalogue([first, { ...first, identity: { ...firstIdentity } }]))),
    [finding("module-identities-unique", { kind: "module", module: firstIdentity })]);
  assert.deepEqual(product.verifyLibraryCatalogue(immutable(catalogue([first], [
    { fileName: "missing.d.ts", sourceText: "unchanged", module: secondIdentity },
  ]))), [finding("text-module-resolves", { kind: "text", fileName: "missing.d.ts" })]);
  const variants = [
    firstIdentity, { ...firstIdentity, providerVersion: "2" }, { ...firstIdentity, packageName: "null" },
    { ...firstIdentity, moduleSpecifier: "other" }, { ...firstIdentity, providerModuleId: "other" },
  ];
  for (const changed of variants.slice(1)) {
    const input = { sources: [{ id: "first", modules: [first], declarations: [] },
      { id: "second", modules: [moduleValue({ identity: changed })], declarations: [] }] };
    assert.deepEqual(product.verifyLibraryCatalogue(immutable(input)), []);
  }
});

test("dense library type IDs and every direct reference position preserve exact error sites and values", () => {
  const module = identity();
  const sparse = new Array(1);
  assert.deepEqual(product.verifyLibraryCatalogue(immutable(catalogue([moduleValue({ types: sparse })]))),
    [finding("type-id-dense", { kind: "module", module }, "0")]);
  for (const id of [-1, -0, 1, 0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.deepEqual(product.verifyLibraryCatalogue(immutable(catalogue([moduleValue({ types: [{ id, kind: "unknown" }] })]))),
      [finding("type-id-dense", { kind: "type", module, type: id }, "0")]);
  }
  for (const type of [
    { id: 0, kind: "array", elementType: 9 }, { id: 0, kind: "tuple", elementTypes: [9] },
    { id: 0, kind: "union", types: [9] }, { id: 0, kind: "intersection", types: [9] },
    { id: 0, kind: "source-global", name: "Global", typeArguments: [9] },
    { id: 0, kind: "provider-ref", moduleSpecifier: "provider", exportName: "name", localName: null, namespaceImport: null, typeArguments: [9] },
    { id: 0, kind: "function", signature: signature({ returnType: 9 }) },
  ]) assert.deepEqual(product.verifyLibraryCatalogue(immutable(catalogue([moduleValue({ types: [type] })]))),
    [finding("type-reference-resolves", { kind: "type", module, type: 0 }, encodeKey(9))]);
  for (const reference of [-1, -0, 0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.deepEqual(product.verifyLibraryCatalogue(immutable(catalogue([moduleValue({ types: [
      { id: 0, kind: "array", elementType: reference },
    ] })]))), [finding("type-reference-resolves", { kind: "type", module, type: 0 }, encodeKey(reference))]);
  }
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
  ]) assert.deepEqual(product.verifyLibraryCatalogue(immutable(catalogue([moduleValue({ exports })]))), [expected]);
  const parameter = { name: "p", type: 0, passingMode: "by-value", optional: false, rest: false, defaultType: null };
  assert.deepEqual(product.verifyLibraryCatalogue(immutable(catalogue([moduleValue({ types: [{ id: 0, kind: "unknown" }],
    exports: [declaration({ signatures: [signature({ parameters: [{ ...parameter, rest: true }, parameter] })] })] })]))),
  [finding("rest-parameter-last", { kind: "export", identity: root }, "signature", "0")]);
});

test("generic family arity and binder names have independent exact valid/opposite cases", () => {
  const module = identity();
  const site = { kind: "export", identity: exportIdentity(module) };
  const parameter = { name: "T", constraints: [], defaultType: null, variance: "invariant" };
  const valid = declaration({ typeFamily: { exportName: "export", typeArgumentCount: 1 }, typeParameters: [parameter] });
  assert.deepEqual(product.verifyLibraryCatalogue(immutable(catalogue([moduleValue({ exports: [valid] })]))), []);
  for (const count of [-1, -0, 0, 2, 0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.deepEqual(product.verifyLibraryCatalogue(immutable(catalogue([moduleValue({ exports: [
      { ...valid, typeFamily: { exportName: "export", typeArgumentCount: count } },
    ] })]))), [finding("type-family-arity-exact", site)]);
  }
  assert.deepEqual(product.verifyLibraryCatalogue(immutable(catalogue([moduleValue({ exports: [
    declaration({ typeParameters: [parameter, { ...parameter }] }),
  ] })]))), [finding("type-parameter-names-unique", site, "T")]);
  assert.deepEqual(product.verifyLibraryCatalogue(immutable(catalogue([moduleValue({ exports: [
    declaration({ signatures: [signature({ typeParameters: [parameter, { ...parameter }] })] }),
  ] })]))), [finding("type-parameter-names-unique", site, "T")]);
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
    assert.deepEqual(product.verifyLibraryCatalogue(immutable(catalogue([moduleValue({ types: [
      { id: 0, kind: "literal", value: { kind: "number", value } },
    ] })]))), [finding("literal-exact", { kind: "type", module, type: 0 })]);
    assert.deepEqual(product.verifyLibraryCatalogue(immutable(catalogue([moduleValue({ exports: [
      declaration({ members: [member({ name: { kind: "number-literal", value } })] }),
    ] })]))), [finding("literal-exact", { kind: "export", identity: exportIdentity(module, "export", "member") })]);
  }
  for (const value of [
    { numerator: 0n, denominator: 1n, negativeZero: false },
    { numerator: 0n, denominator: 1n, negativeZero: true },
    { numerator: 9007199254740993n, denominator: 2n, negativeZero: false },
    { numerator: -9007199254740993n, denominator: 2n, negativeZero: false },
  ]) assert.deepEqual(product.verifyLibraryCatalogue(immutable(catalogue([moduleValue({ types: [
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
  assert.deepEqual(product.verifyLibraryCatalogue(immutable(catalogue([moduleValue({ types, exports: [
    declaration({ id: "bound", exportName: "bound", type: 3, typeParameters: [binder] }),
    declaration({ id: "nested", exportName: "nested", type: 2 }),
  ] })]))), []);
  assert.deepEqual(product.verifyLibraryCatalogue(immutable(catalogue([moduleValue({ types, exports: [
    declaration({ id: "bound", exportName: "bound", type: 3, typeParameters: [binder] }),
    declaration({ id: "free", exportName: "free", type: 3 }),
  ] })]))), [finding("type-parameter-resolves", { kind: "export", identity: exportIdentity(module, "free") }, "T")]);
  assert.deepEqual(product.verifyLibraryCatalogue(immutable(catalogue([moduleValue({ types, exports: [
    declaration({ signatures: [signature({ returnType: 1, typeParameters: [binder] })] }),
  ] })]))), []);
});

test("a real 100000-row reference chain and wide shared arena are checked iteratively without a hidden cap", () => {
  const types = Array.from({ length: 100000 }, (_, id) => id === 0
    ? { id, kind: "unknown" } : { id, kind: "array", elementType: id - 1 });
  const input = catalogue([moduleValue({ types, exports: [declaration({ type: 99999 })] })]);
  assert.deepEqual(product.verifyLibraryCatalogue(immutable(input)), []);
  const shared = [{ id: 0, kind: "number" }, { id: 1, kind: "tuple", elementTypes: Array(100000).fill(0) }];
  assert.deepEqual(product.verifyLibraryCatalogue(immutable(catalogue([moduleValue({ types: shared,
    exports: [declaration({ type: 1 })] })]))), []);
});

test("roles resolve complete export/member/signature identities, not object identity or spelling", () => {
  const module = identity();
  const identities = [exportIdentity(module), exportIdentity(module, "export", null, "signature"),
    exportIdentity(module, "export", "member"), exportIdentity(module, "export", "member", "signature")];
  const roles = ["pointer", "raw-pointer", "load", "store"];
  const value = moduleValue({ identity: module, exports: [declaration({ signatures: [signature()],
    members: [member({ signatures: [signature()] })] })], roles: identities.map((identity, index) => ({ identity, role: roles[index] })) });
  const input = immutable(catalogue([value]));
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
  assert.deepEqual(product.verifyLibraryCatalogue(immutable(catalogue([{ ...value, roles: [
    { identity: identities[1], role: "load" }, { identity: identities[0], role: "store" },
  ] }]))), [finding("role-identities-order", { kind: "export", identity: identities[0] })]);
  assert.deepEqual(product.verifyLibraryCatalogue(immutable(catalogue([{ ...value, roles: [
    { identity: identities[0], role: "load" }, { identity: identities[0], role: "load" },
  ] }]))), [finding("role-identities-unique", { kind: "export", identity: identities[0] })]);
  const missing = exportIdentity(module, "missing");
  assert.deepEqual(product.verifyLibraryCatalogue(immutable(catalogue([{ ...value, roles: [{ identity: missing, role: "load" }] }]))),
    [finding("role-export-resolves", { kind: "export", identity: missing })]);
});

test("role lookup duplicate identity is an exact caller defect, not an ambiguous fabricated answer", () => {
  const module = identity();
  const selected = exportIdentity(module);
  const key = encodeKey([[module.providerId, module.providerVersion, module.packageName, module.moduleSpecifier, module.providerModuleId],
    selected.exportId, selected.memberId, selected.signatureId]);
  const roles = [{ identity: selected, role: "pointer" }, { identity: selected, role: "load" }];
  for (const inputRoles of [roles, [...roles].reverse()]) {
    assert.throws(() => product.libraryRoleOf(immutable(catalogue([moduleValue({ roles: inputRoles })])), selected),
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
    assert.deepEqual(product.libraryRolesOf(immutable({ sources: [], sourceRoles: [first] }), role), [definitionId("z")]);
    for (const sourceRoles of [[first, second], [second, first]]) {
      assert.deepEqual(product.libraryRolesOf(immutable({ sources: [], sourceRoles }), role), [definitionId("z"), definitionId("a")]);
    }
  }
  const first = { identity: exportIdentity(module, "a"), role: "pointer", definition: definitionId("same") };
  const second = { identity: exportIdentity(module, "z"), role: "pointer", definition: definitionId("same") };
  assert.deepEqual(product.libraryRolesOf(immutable({ sources: [], sourceRoles: [second, first] }), "pointer"),
    [definitionId("same"), definitionId("same")]);
  assert.deepEqual(product.libraryRolesOf(immutable({ sources: [], sourceRoles: [first, second] }), "load"), []);
});

test("role binding is a pure exact supplied-identity projection in both catalogue input orders", () => {
  const module = identity();
  const firstIdentity = exportIdentity(module, "a");
  const secondIdentity = exportIdentity(module, "z");
  const first = { identity: firstIdentity, role: "pointer" };
  const second = { identity: secondIdentity, role: "load" };
  const definitions = new Map([[identityKey(firstIdentity), definitionId("z")], [identityKey(secondIdentity), definitionId("a")]]);
  for (const roles of [[first, second], [second, first]]) {
    const input = immutable(catalogue([moduleValue({ identity: module, exports: [
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
    assert.deepEqual(product.bindRoles(immutable(input), () => {
      throw new Error("No resolver is admitted for an invalid authored role identity.");
    }), { kind: "refused", diagnostics: [roleError(invalidIdentity)] });
  }
  const multiple = immutable(catalogue([moduleValue({ roles: [
    { identity: exportIdentity(module, "z"), role: "load" }, { identity: exportIdentity(module, "a"), role: "pointer" },
  ] })]));
  assert.deepEqual(product.bindRoles(multiple, () => { throw new Error("No invalid lookup."); }),
    { kind: "refused", diagnostics: [roleError(exportIdentity(module, "a")), roleError(exportIdentity(module, "z"))] });
});

test("bound-role existence and authoritative correspondence are independent complete rules", () => {
  const module = identity();
  const selected = exportIdentity(module);
  const input = immutable(catalogue([moduleValue({ exports: [declaration()], roles: [{ identity: selected, role: "pointer" }] })]));
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
  assert.deepEqual(product.verifyBoundLibraries(immutable({ sources: input.sources, sourceRoles: [binding] }), context([first])), []);
  assert.deepEqual(product.verifyBoundLibraries(immutable({ sources: input.sources, sourceRoles: [{ ...binding, definition: wrong }] }),
    context([first, wrong])), [finding("role-binding-exact", site)]);
  assert.deepEqual(product.verifyBoundLibraries(immutable({ sources: input.sources, sourceRoles: [binding] }), context([])),
    [finding("role-definition-resolves", site)]);
  assert.deepEqual(product.verifyBoundLibraries(immutable({ sources: input.sources, sourceRoles: [{ ...binding, definition: wrong }] }),
    context([first])), [finding("role-binding-exact", site), finding("role-definition-resolves", site)]);
  assert.deepEqual(product.verifyBoundLibraries(immutable({ sources: input.sources, sourceRoles: [{ ...binding, role: "load" }] }),
    context([first])), [finding("role-binding-exact", site)]);
  assert.deepEqual(product.verifyBoundLibraries(immutable({ sources: input.sources, sourceRoles: [binding, { ...binding }] }),
    context([first])), [finding("role-binding-exact", site)]);
  assert.deepEqual(product.verifyBoundLibraries(immutable({ sources: input.sources, sourceRoles: [] }), context([first])),
    [finding("role-binding-exact", site)]);
  assert.deepEqual(product.verifyBoundLibraries(immutable({ sources: catalogue([moduleValue({ exports: [declaration()] })]).sources,
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
  assert.deepEqual(product.verifyBoundLibraries(immutable({ sources, sourceRoles: [first, second] }), context), []);
  assert.deepEqual(product.verifyBoundLibraries(immutable({ sources, sourceRoles: [second, first] }), context),
    [finding("role-bindings-order", { kind: "export", identity: first.identity })]);
  assert.deepEqual(product.verifyBoundLibraries(immutable({ sources: [], sourceRoles: [] }), {
    definitionExists: () => { throw new Error("No empty definition lookup."); },
    definitionOfExport: () => { throw new Error("No empty export lookup."); },
  }), []);
});

test("authored summaries accept a genuine empty function law and reject absent export/member/signature identities", () => {
  const { input, summary } = summaryInput();
  assert.deepEqual(product.verifyAuthoredSummaries(immutable(input), immutable([])), []);
  assert.deepEqual(product.verifyAuthoredSummaries(input, immutable([summary])), []);
  for (const identity of [exportIdentity(summary.identity.module, "missing", null, "signature"),
    exportIdentity(summary.identity.module, "export", "missing", "signature"),
    exportIdentity(summary.identity.module, "export", null, "missing"),
    exportIdentity(summary.identity.module)]) {
    assert.deepEqual(product.verifyAuthoredSummaries(input, immutable([{ ...summary, identity }])),
      [finding("authored-summary-identity-resolves", summarySite(identity, "parameter", null))]);
  }
});

test("authored identity order and uniqueness are independent of source object identity", () => {
  const module = identity();
  const first = authoredSummary(exportIdentity(module, "a", null, "signature"));
  const second = authoredSummary(exportIdentity(module, "z", null, "signature"));
  const input = immutable(catalogue([moduleValue({ exports: [
    declaration({ id: "a", exportName: "a", signatures: [signature()] }),
    declaration({ id: "z", exportName: "z", signatures: [signature()] }),
  ] })]));
  assert.deepEqual(product.verifyAuthoredSummaries(input, immutable([first, second])), []);
  assert.deepEqual(product.verifyAuthoredSummaries(input, immutable([second, first])),
    [finding("authored-summaries-order", summarySite(first.identity, "parameter", null))]);
  assert.deepEqual(product.verifyAuthoredSummaries(input, immutable([first, { ...first, identity: {
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
  ]) assert.deepEqual(product.verifyAuthoredSummaries(input, immutable([{ ...summary, ...changes }])),
    [finding("authored-summary-id-dense", summarySite(summary.identity, table, 0))]);
  const malformed = { ...summary, origins: [{ id: 1, kind: "complete", producers: [], includesAbsence: false }] };
  assert.deepEqual(product.verifyAuthoredSummaries(input, immutable([malformed])), expectedSummaryOrder([
    finding("authored-summary-id-dense", summarySite(summary.identity, "origins", 0)),
    finding("authored-summary-reference-resolves", summarySite(summary.identity, "origins", null), "result", encodeKey(0)),
    finding("authored-summary-reference-resolves", summarySite(summary.identity, "origins", null), "thrown", encodeKey(0)),
  ]));
  const sparse = new Array(1);
  assert.deepEqual(product.verifyAuthoredSummaries(input, immutable([{ ...summary, projections: sparse }])),
    [finding("authored-summary-id-dense", summarySite(summary.identity, "projection", 0))]);
});

test("authored projection references and parent-before-child are separately verified without a path repair", () => {
  const { input, summary } = summaryInput();
  const owner = summarySite(summary.identity, "projection", 0);
  assert.deepEqual(product.verifyAuthoredSummaries(immutable(input), immutable([{ ...summary, projections: [
    { id: 0, parent: 0, projection: { kind: "element" } },
  ] }])), [finding("authored-summary-path-parent-precedes", owner)]);
  assert.deepEqual(product.verifyAuthoredSummaries(input, immutable([{ ...summary, projections: [
    { id: 0, parent: 9, projection: { kind: "element" } },
  ] }])), expectedSummaryOrder([
    finding("authored-summary-path-parent-precedes", owner),
    finding("authored-summary-reference-resolves", owner, "projection", encodeKey(9)),
  ]));
  const missing = exportIdentity(summary.identity.module, "missing");
  for (const kind of ["field", "method-value"]) {
    assert.deepEqual(product.verifyAuthoredSummaries(input, immutable([{ ...summary, projections: [
      { id: 0, parent: null, projection: { kind, identity: missing } },
    ] }])), [finding("authored-summary-reference-resolves", owner, "export", identityKey(missing))]);
  }
  const valid = [{ id: 0, parent: null, projection: { kind: "element" } },
    { id: 1, parent: 0, projection: { kind: "index", constant: 9007199254740993n } },
    { id: 2, parent: 1, projection: { kind: "deref" } }];
  assert.deepEqual(product.verifyAuthoredSummaries(input, immutable([{ ...summary, projections: valid }])), []);
});

test("every declared parameter/capture/logical-site use has its own exact valid and out-of-range opposite", () => {
  const { input, summary } = summaryInput();
  const receiver = { id: 0, kind: "receiver", path: null };
  const complete = { kind: "complete", paths: [] };
  for (const index of [-1, -0, 0, 0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.deepEqual(product.verifyAuthoredSummaries(immutable(input), immutable([{ ...summary, producers: [
      { id: 0, kind: "parameter", index, path: null },
    ] }])), [finding("authored-summary-parameter-range", summarySite(summary.identity, "producer", 0), encodeKey(index))]);
  }
  assert.deepEqual(product.verifyAuthoredSummaries(input, immutable([{ ...summary, producers: [
    { id: 0, kind: "capture", index: 0, path: null },
  ] }])), [finding("authored-summary-capture-range", summarySite(summary.identity, "producer", 0), encodeKey(0))]);
  assert.deepEqual(product.verifyAuthoredSummaries(input, immutable([{ ...summary, captures: [
    { index: 1, reads: complete, writes: complete },
  ] }])), [finding("authored-summary-capture-range", summarySite(summary.identity, "capture", 0), encodeKey(1))]);
  for (const site of [-1, -0, 0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.deepEqual(product.verifyAuthoredSummaries(input, immutable([{ ...summary, producers: [
      { id: 0, kind: "allocation", site, path: null },
    ] }])), [finding("authored-summary-site-integral", summarySite(summary.identity, "producer", 0), encodeKey(site))]);
    assert.deepEqual(product.verifyAuthoredSummaries(input, immutable([{ ...summary, producers: [receiver], boundaries: [
      { id: 0, kind: "external-input", site, subject: 0, owner: null, detail: "original" },
    ] }])), [finding("authored-summary-site-integral", summarySite(summary.identity, "boundary", 0), encodeKey(site))]);
    for (const kind of ["callback", "suspension"]) {
      assert.deepEqual(product.verifyAuthoredSummaries(input, immutable([{ ...summary, producers: [receiver], retention: [
        { source: 0, into: { kind, site } },
      ] }])), [finding("authored-summary-site-integral", summarySite(summary.identity, "retention", 0), encodeKey(site))]);
    }
  }
});

test("authored producers use complete value identity while preserving valid distinct paths and kinds", () => {
  const { input, summary } = summaryInput(1);
  const complete = { kind: "complete", paths: [] };
  const producers = [{ id: 0, kind: "receiver", path: null }, { id: 1, kind: "receiver", path: null }];
  assert.deepEqual(product.verifyAuthoredSummaries(immutable(input), immutable([{ ...summary, producers }])),
    [finding("authored-summary-producer-unique", summarySite(summary.identity, "producer", 1))]);
  assert.deepEqual(product.verifyAuthoredSummaries(input, immutable([{ ...summary,
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
    assert.deepEqual(product.verifyAuthoredSummaries(immutable(input), immutable([{ ...summary, ...changes }])),
      [finding("authored-summary-reference-resolves", summarySite(summary.identity, table, index), target, encodeKey(9))]);
  }
  const missing = exportIdentity(summary.identity.module, "missing");
  for (const [changes, table] of [
    [{ producers: [{ id: 0, kind: "shared", identity: missing, path: null }] }, "producer"],
    [{ producers: [receiver], retention: [{ source: 0, into: { kind: "shared", identity: missing, path: null } }] }, "retention"],
  ]) assert.deepEqual(product.verifyAuthoredSummaries(input, immutable([{ ...summary, ...changes }])),
    [finding("authored-summary-reference-resolves", summarySite(summary.identity, table, 0), "export", identityKey(missing))]);
});

test("complete/open origins and read/write footprints retain strict ordered alternatives and boundaries", () => {
  const { input, summary } = summaryInput(1);
  const complete = { kind: "complete", paths: [] };
  const producers = [{ id: 0, kind: "receiver", path: null }, { id: 1, kind: "allocation", site: 0, path: null }];
  const projections = [{ id: 0, parent: null, projection: { kind: "element" } },
    { id: 1, parent: 0, projection: { kind: "deref" } }];
  const boundaries = [0, 1].map(id => ({ id, kind: "external-input", site: id, subject: 0, owner: null, detail: "reason" }));
  for (const values of [[1, 0], [0, 0]]) {
    assert.deepEqual(product.verifyAuthoredSummaries(immutable(input), immutable([{ ...summary, producers, origins: [
      { id: 0, kind: "complete", producers: values, includesAbsence: false },
    ] }])), [finding("authored-summary-origins-order", summarySite(summary.identity, "origins", 0))]);
    assert.deepEqual(product.verifyAuthoredSummaries(input, immutable([{ ...summary, producers, boundaries, origins: [
      { id: 0, kind: "open", producers: [], includesAbsence: true, boundaries: values },
    ] }])), [finding("authored-summary-origins-order", summarySite(summary.identity, "origins", 0))]);
    for (const field of ["reads", "writes"]) {
      const effect = { slot: { kind: "parameter", index: 0 }, reads: complete, writes: complete,
        [field]: { kind: "complete", paths: values } };
      assert.deepEqual(product.verifyAuthoredSummaries(input, immutable([{ ...summary, projections, parameters: [effect] }])),
        [finding("authored-summary-effects-order", summarySite(summary.identity, "parameter", 0))]);
      const open = { ...effect, [field]: { kind: "open", paths: [], boundaries: values } };
      assert.deepEqual(product.verifyAuthoredSummaries(input, immutable([{ ...summary, producers, boundaries, parameters: [open] }])),
        [finding("authored-summary-effects-order", summarySite(summary.identity, "parameter", 0))]);
    }
  }
  const parameters = [{ slot: { kind: "receiver" }, reads: { kind: "complete", paths: [0, 1] }, writes: complete },
    { slot: { kind: "parameter", index: 0 }, reads: complete, writes: { kind: "open", paths: [], boundaries: [0, 1] } }];
  const valid = { ...summary, producers, projections, boundaries, parameters,
    origins: [{ id: 0, kind: "open", producers: [0, 1], includesAbsence: false, boundaries: [0, 1] }] };
  assert.deepEqual(product.verifyAuthoredSummaries(input, immutable([valid])), []);
});

test("every authored table ordering rule has its complete reversed or repeated-row opposite", () => {
  const { input, summary } = summaryInput(2);
  const complete = { kind: "complete", paths: [] };
  const producers = [{ id: 0, kind: "receiver", path: null }, { id: 1, kind: "allocation", site: 0, path: null }];
  for (const values of [[1, 0], [0, 0]]) {
    const parameters = values.map(index => ({ slot: { kind: "parameter", index }, reads: complete, writes: complete }));
    assert.deepEqual(product.verifyAuthoredSummaries(immutable(input), immutable([{ ...summary, parameters }])),
      [finding("authored-summary-effects-order", summarySite(summary.identity, "parameter", 1))]);
    const captures = values.map(index => ({ index, reads: complete, writes: complete }));
    assert.deepEqual(product.verifyAuthoredSummaries(input, immutable([{ ...summary, captures }])),
      [finding("authored-summary-effects-order", summarySite(summary.identity, "capture", 1))]);
    assert.deepEqual(product.verifyAuthoredSummaries(input, immutable([{ ...summary, invocationOnlyParameters: values }])),
      [finding("authored-summary-effects-order", summarySite(summary.identity, "parameter", null))]);
    const writes = values.map(target => ({ target, value: 0 }));
    assert.deepEqual(product.verifyAuthoredSummaries(input, immutable([{ ...summary, producers, writes }])),
      [finding("authored-summary-effects-order", summarySite(summary.identity, "write", 1))]);
    const retention = values.map(source => ({ source, into: { kind: "return" } }));
    assert.deepEqual(product.verifyAuthoredSummaries(input, immutable([{ ...summary, producers, retention }])),
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
  assert.deepEqual(product.verifyAuthoredSummaries(immutable(input), immutable([summary])), []);
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
  assert.deepEqual(product.verifyAuthoredSummaries(immutable(input), immutable([{ ...summary, callbacks: [callback] }])), []);
  for (const value of [-1, -0, 2, 0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.deepEqual(product.verifyAuthoredSummaries(input, immutable([{ ...summary, callbacks: [
      { ...callback, rejection: value },
    ] }])), [finding("authored-summary-parameter-range", summarySite(summary.identity, "callback", 0), "callback", encodeKey(value))]);
    assert.deepEqual(product.verifyAuthoredSummaries(input, immutable([{ ...summary, callbacks: [
      { ...callback, rejection: null, inputs: [{ kind: "receiver-rejection", parameterIndex: value }] },
    ] }])), [finding("authored-summary-parameter-range", summarySite(summary.identity, "callback", 0), "callback", encodeKey(value))]);
  }
  assert.deepEqual(product.verifyAuthoredSummaries(input, immutable([{ ...summary, callbacks: [
    { ...callback, rejection: null, inputs: [{ kind: "argument-element", parameterIndex: 0, sourceParameterIndex: 1 }] },
  ] }])), [finding("authored-summary-parameter-range", summarySite(summary.identity, "callback", 0), encodeKey(1))]);
  for (const inputs of [[{ kind: "receiver-element", parameterIndex: 1 }, { kind: "receiver-rejection", parameterIndex: 0 }],
    [{ kind: "receiver-element", parameterIndex: 0 }, { kind: "receiver-rejection", parameterIndex: 0 }]]) {
    assert.deepEqual(product.verifyAuthoredSummaries(input, immutable([{ ...summary, callbacks: [{ ...callback, inputs }] }])),
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
  assert.deepEqual(product.verifyAuthoredSummaries(immutable(input), immutable([{ ...summary, callbacks: [callback] }])), []);
  assert.deepEqual(product.verifyAuthoredSummaries(input, immutable([{ ...summary, callbacks: [{ ...callback, rejection: 1 }] }])),
    [finding("authored-summary-parameter-range", summarySite(summary.identity, "callback", 0), "callback", encodeKey(1))]);
  assert.deepEqual(product.verifyAuthoredSummaries(input, immutable([{ ...summary, callbacks: [{ ...callback,
    parameterIndex: 2, inputs: [{ kind: "receiver-element", parameterIndex: 0 }] }] }])),
    [finding("authored-summary-parameter-range", summarySite(summary.identity, "callback", 0), "callback", encodeKey(0))]);
  for (const values of [[1, 0], [0, 0]]) {
    assert.deepEqual(product.verifyAuthoredSummaries(input, immutable([{ ...summary,
      callbacks: values.map(parameterIndex => ({ ...callback, parameterIndex })),
    }])), [finding("authored-summary-effects-order", summarySite(summary.identity, "callback", 1))]);
  }
  const { input: noParameters, summary: noParameterSummary } = summaryInput();
  assert.deepEqual(product.verifyAuthoredSummaries(immutable(noParameters), immutable([{ ...noParameterSummary,
    callbacks: [{ ...callback, inputs: [{ kind: "receiver-element", parameterIndex: 0 }] }],
  }])), expectedSummaryOrder([
    finding("authored-summary-parameter-range", summarySite(noParameterSummary.identity, "callback", 0), encodeKey(0)),
    finding("authored-summary-parameter-range", summarySite(noParameterSummary.identity, "callback", 0), "callback", encodeKey(0)),
  ]));
  const unresolved = exportIdentity(module, "missing", null, "signature");
  assert.deepEqual(product.verifyAuthoredSummaries(input, immutable([authoredSummary(unresolved, { callbacks: [callback] })])),
    [finding("authored-summary-identity-resolves", summarySite(unresolved, "parameter", null))]);
});

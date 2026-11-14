import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import { basename, relative, resolve, sep } from "node:path";
import { Session } from "node:inspector";
import { fileURLToPath, pathToFileURL } from "node:url";
import test, { after, before } from "node:test";
import { runCase } from "../host-cases/case.mjs";
import { nativeFactsFixture } from "./fixtures/native-facts.mjs";

const repository = fileURLToPath(new URL("../../", import.meta.url));
const tooling = process.env.TSONIC_HOST_TOOLING_ROOT ?? repository;
const { hostCatalogue } = await import(pathToFileURL(resolve(tooling, "test/architecture/host/catalogue.mjs")).href);
const { checkCoverage } = await import(pathToFileURL(resolve(tooling, "test/architecture/host/coverage.mjs")).href);
const { parseSources } = await import(pathToFileURL(resolve(tooling, "test/architecture/host/import-graph.mjs")).href);
const { compileIsolated, isolationDeps } = await import(pathToFileURL(resolve(tooling, "test/architecture/host/isolation.mjs")).href);
const sourceDirectory = "packages/host/src/snapshot";
const emittedDirectory = resolve(repository, "packages/host/dist/snapshot");
const runtimeNames = ["index", "verify", "verify-packages", "verify-extensions"];
const runtimeFiles = runtimeNames.map(name => resolve(emittedDirectory, `${name}.js`));
const ownedSources = ["contract", ...runtimeNames].map(name => `${sourceDirectory}/${name}.ts`);
const dependencySources = ["contract", "index", "identity", "key"].map(name => `packages/host/src/ids/${name}.ts`)
  .concat(...["ir-types", "diag"].map(directory => readdirSync(resolve(repository, `packages/host/src/${directory}`))
    .filter(name => name.endsWith(".ts")).map(name => `packages/host/src/${directory}/${name}`)));
const coverageSession = new Session();
let product;
let identities;
let evidenceDirectory;
const post = (method, parameters = {}) => new Promise((done, reject) => {
  coverageSession.post(method, parameters, (error, result) => error === null ? done(result) : reject(error));
});

before(async () => {
  assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined && process.env.TSONIC_TEST_ADMISSION_OWNER !== undefined,
    true, "snapshot cases and compiler children require the admitted aggregate process group");
  const parent = resolve(repository, ".temp/host-f-snapshot");
  mkdirSync(parent, { recursive: true });
  evidenceDirectory = mkdtempSync(resolve(parent, "proof-"));
  coverageSession.connect();
  await post("Debugger.enable");
  await post("Profiler.enable");
  await post("Profiler.startPreciseCoverage", { callCount: true, detailed: true });
  product = await import(pathToFileURL(resolve(emittedDirectory, "index.js")).href);
  identities = await import(pathToFileURL(resolve(repository, "packages/host/dist/ids/index.js")).href);
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
    const report = checkCoverage({ canonical: realpathSync, readText: path => readFileSync(path, "utf8"),
      parse: parseSources, project: (url, text) => url.startsWith("file:") ? { path: fileURLToPath(url), text } : null,
    }, runtimeFiles, [{ result, sources }]);
    writeFileSync(resolve(evidenceDirectory, "coverage.json"), `${JSON.stringify(report, null, 2)}\n`);
    const inputs = [...ownedSources.map(path => resolve(repository, path)), ...runtimeFiles].map(path => ({ path,
      sha256: createHash("sha256").update(readFileSync(path)).digest("hex"),
    }));
    writeFileSync(resolve(evidenceDirectory, "source-inputs.json"), `${JSON.stringify(inputs, null, 2)}\n`);
    console.log(`F.snapshot actual product coverage: ${evidenceDirectory}`);
    assert.equal(result.length, 4, "all four actual executable owners have nonempty source-identified V8 rows");
    assert.deepEqual(report.findings, []);
    assert.equal(report.status, "passed", JSON.stringify(report.findings));
    assert.equal(report.files.length, 4);
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

function packageId(root = "/project") { return identities.encodePackageId(root); }
function moduleId(owner = packageId(), path = "src/main.ts") { return identities.encodeModuleId({ package: owner, path }); }
function packageSite(owner = packageId()) { return { kind: "package", package: owner }; }
function moduleSite(module = moduleId()) { return { kind: "module", module }; }
function fileSite(path) { return { kind: "file", path }; }
function issue(rule, site, ...details) { return { rule, site, detail: details.map(value => ({ kind: "text", value })) }; }
function sparseIssue(site, field, index = 0) {
  return { rule: "stable-order", site, detail: [{ kind: "text", value: field }, { kind: "number", value: index }] };
}
function nativeIssue(rule, field, index) {
  return issue("native-facts-valid", { kind: "snapshot" }, rule, field, index === null ? "root" : String(index));
}









function snapshot() {
  const root = packageId();
  const entry = moduleId();
  return {
    packages: { fingerprint: "captured-project-bytes", rootPackage: root,
      packages: [{ id: root, name: null, version: null, packageRoot: "/project", sourceRoot: "/project/src",
        manifestPath: null, dependencies: [], exports: [{ specifier: "./main.js", module: entry }],
        pluginEntry: null, libraryEntry: null }],
      components: [{ representative: root, packages: [root], dependencies: [] }],
      modules: [{ id: entry, package: root, path: "/project/src/main.ts", role: "source" }],
      files: [{ kind: "physical", path: "/project/src/main.ts", realPath: "/real/project/src/main.ts", text: "export {};\n" }],
      libraryData: [],
    },
    entryPoint: entry, roots: [entry],
    selection: { target: { id: "native", surfaces: [], options: { kind: "record", fields: [] } }, providerId: "native-provider", capabilityIds: [], surfaceIds: [] },
    contributions: { declarationFiles: [], declarationPolicy: { bundledLibraries: [], installedDeclarations: "none" },
      requiredProviderModules: [], compilerExtensions: [], declarationProviders: [], semanticModules: [], safetyProviders: [], dataLayouts: [] },
    nativeFacts: nativeFactsFixture(),
  };
}
function verify(value, expected, actual = []) {
  assert.deepEqual(product.verifySnapshot((value), (actual)), expected);
}
function peer(value, root = "/library") {
  const id = packageId(root);
  const module = moduleId(id, "lib.d.ts");
  const entry = { id, name: "library", version: "1.0.0", packageRoot: root, sourceRoot: root,
    manifestPath: `${root}/package.json`, dependencies: [], exports: [{ specifier: ".", module }],
    pluginEntry: `${root}/plugin.js`, libraryEntry: null };
  value.packages.packages.push(entry);
  value.packages.packages.sort((left, right) => left.id < right.id ? -1 : 1);
  value.packages.modules.push({ id: module, package: id, path: `${root}/lib.d.ts`, role: "declaration" });
  value.packages.modules.sort((left, right) => left.id < right.id ? -1 : 1);
  value.packages.files.push({ kind: "physical", path: `${root}/lib.d.ts`, realPath: `${root}/lib.d.ts`, text: "export {};" });
  value.packages.files.sort((left, right) => left.path < right.path ? -1 : 1);
  value.packages.components.push({ representative: id, packages: [id], dependencies: [] });
  value.packages.components.sort((left, right) => left.representative < right.representative ? -1 : 1);
  return { entry, id, module };
}
function library(value) {
  const owner = value.packages.packages[0];
  owner.libraryEntry = "/project/library.json";
  const file = { kind: "physical", path: owner.libraryEntry, realPath: owner.libraryEntry, text: "{}" };
  value.packages.files.unshift(file);
  const row = { package: owner.id, path: owner.libraryEntry, roles: [], declaredSummaries: [] };
  value.packages.libraryData.push(row);
  return row;
}
function extension(value, kind = "compiler-extension", exportId = "extension") {
  const reference = { package: packageId(), moduleSpecifier: "./plugin.js", exportId, version: "1" };
  const field = { "compiler-extension": "compilerExtensions", "declaration-provider": "declarationProviders", "semantics-module": "semanticModules" }[kind];
  value.contributions[field].push(reference);
  return { kind, reference };
}
function declaration(exportId = "layout", providerId = "provider") {
  return { providerId, providerVersion: "1", providerModuleId: "module", moduleSpecifier: "native/layout", exportId };
}
function layout(value, exportId = "layout", byteOrder = "little", addressWidth = 64) {
  const identity = declaration(exportId);
  const registration = { declaration: identity, layout: { fingerprint: "abi-layout", byteOrder, addressWidth } };
  value.nativeFacts.geometry.layouts.push(registration);
  value.contributions.dataLayouts.push(identity);
  return registration;
}

test("the sole approved public value and all four runtime owners are exact", () => {
  assert.deepEqual(Object.keys(product), ["verifySnapshot"]);
  assert.deepEqual(readdirSync(resolve(repository, sourceDirectory)).filter(name => name.endsWith(".ts")).sort(),
    ["contract.ts", "index.ts", "verify-extensions.ts", "verify-packages.ts", "verify.ts"]);
});
test("an unnamed root with separate canonical source root, captured real-path provenance and no extensions is valid", () => {
  verify(snapshot(), []);
});
test("snapshot-fingerprint is one nonempty opaque captured identity, never a hash or package-name reconstruction", () => {
  for (const fingerprint of ["opaque", " ", "\0", "\uD800", "not-a-sha256"]) {
    const value = snapshot();
    value.packages.fingerprint = fingerprint;
    verify(value, []);
  }
  const value = snapshot();
  value.packages.fingerprint = "";
  verify(value, [issue("snapshot-fingerprint", { kind: "snapshot" }, "fingerprint")]);
});
test("named packages, both module roles and both captured file arms preserve explicit identities", () => {
  const value = snapshot();
  const additional = peer(value);
  value.packages.files.push({ kind: "virtual", path: "/virtual/prelude.d.ts", owner: additional.id, text: "declare const value: number;" });
  value.contributions.declarationFiles.push("/virtual/prelude.d.ts");
  value.packages.packages.find(entry => entry.id === packageId()).dependencies = [
    { name: "library", range: "workspace:*", kind: "dependency", resolved: additional.id },
  ];
  value.packages.components.find(entry => entry.representative === packageId()).dependencies = [additional.id];
  verify(value, []);
});
test("package-id-unique reports each real duplicate without selecting an alternate record", () => {
  const value = snapshot();
  value.packages.packages.push({ ...value.packages.packages[0] });
  verify(value, [issue("package-id-unique", packageSite(), packageId())]);
});
test("root-package-resolves uses canonical package identity rather than optional package name", () => {
  const value = snapshot();
  value.packages.rootPackage = packageId("/missing");
  verify(value, [issue("entry-point-root", { kind: "snapshot" }, moduleId()),
    issue("root-package-resolves", { kind: "snapshot" }, packageId("/missing"))]);
});
test("module-id-unique preserves duplicate-record evidence", () => {
  const value = snapshot();
  value.packages.modules.push({ ...value.packages.modules[0] });
  verify(value, [issue("module-id-unique", moduleSite(), moduleId())]);
});
test("ambiguous repeated module identities never trigger a scan per export or select an arbitrary owner", () => {
  const value = snapshot();
  const additional = peer(value);
  value.packages.modules.push({ id: moduleId(), package: additional.id, path: "/library/lib.d.ts", role: "declaration" });
  verify(value, [issue("entry-point-root", { kind: "snapshot" }, moduleId()),
    issue("export-package-agrees", packageSite(), moduleId()), issue("module-id-unique", moduleSite(), moduleId())]);
});
test("module-package-resolves is independent from module ID spelling and package metadata", () => {
  const value = snapshot();
  value.packages.modules[0].package = packageId("/missing");
  verify(value, [issue("entry-point-root", { kind: "snapshot" }, moduleId()),
    issue("export-package-agrees", packageSite(), moduleId()),
    issue("module-package-resolves", moduleSite(), packageId("/missing"))]);
});
for (const [path, root] of [["/project/src-sibling/main.ts", "/project/src"], ["/elsewhere/main.ts", "/project/src"]]) {
  test(`module-path-contained respects a full segment boundary: ${path}`, () => {
    const value = snapshot();
    value.packages.modules[0].path = path;
    value.packages.files[0].path = path;
    verify(value, [issue("module-path-contained", moduleSite(), path, root)]);
  });
}
test("module-file-resolves requires the actual captured path rather than a real-path alias", () => {
  const value = snapshot();
  value.packages.files = [];
  verify(value, [issue("module-file-resolves", moduleSite(), "/project/src/main.ts")]);
});
test("file-path-unique rejects repeated physical and virtual rows at the same canonical path", () => {
  for (const duplicate of [
    { kind: "physical", path: "/project/src/main.ts", realPath: "/other/main.ts", text: "different" },
    { kind: "virtual", path: "/project/src/main.ts", owner: packageId(), text: "different" },
  ]) {
    const value = snapshot();
    value.packages.files.push(duplicate);
    verify(value, [issue("file-path-unique", fileSite(duplicate.path), duplicate.path)]);
  }
});
for (const invalid of ["", ".", "..", "folder/../file", "folder/./file", "folder//file", "folder/", "file\\name", "file\0name", "///file"]) {
  test(`canonical-path rejects one authored noncanonical real path ${JSON.stringify(invalid)}`, () => {
    const value = snapshot();
    value.packages.files[0].realPath = invalid;
    verify(value, [issue("canonical-path", fileSite("/project/src/main.ts"), invalid)]);
  });
}
test("canonical-path accepts platform-independent roots and normalized paths without filesystem queries", () => {
  for (const realPath of ["/", "C:/", "C:/source/main.ts", "//server/share/main.ts", "relative/source.ts", "a:b", "\uD800/source.ts"]) {
    const value = snapshot();
    value.packages.files[0].realPath = realPath;
    verify(value, []);
  }
});
test("source and library files are strictly below their roots, including canonical filesystem roots", () => {
  const root = snapshot();
  root.packages.packages[0].sourceRoot = "/";
  verify(root, []);
  const equal = snapshot();
  equal.packages.modules[0].path = "/project/src";
  equal.packages.files[0].path = "/project/src";
  verify(equal, [issue("module-path-contained", moduleSite(), "/project/src", "/project/src")]);
  const libraryRoot = snapshot();
  const row = library(libraryRoot);
  libraryRoot.packages.packages[0].libraryEntry = "/project";
  libraryRoot.packages.files[0].path = "/project";
  row.path = "/project";
  verify(libraryRoot, [issue("library-data-owner-exact", packageSite(), "/project")]);
});
for (const kind of ["dependency", "peer", "development"]) {
  test(`package-dependency-resolves refuses absent required ${kind} identity`, () => {
    const value = snapshot();
    value.packages.packages[0].dependencies = [{ name: "dependency", range: "*", kind, resolved: null }];
    verify(value, [issue("package-dependency-resolves", packageSite(), "dependency")]);
  });
}
test("optional absence is distinct from a present unresolved package identity", () => {
  const value = snapshot();
  value.packages.packages[0].dependencies = [{ name: "optional", range: "*", kind: "optional", resolved: null }];
  verify(value, []);
  const invalid = snapshot();
  invalid.packages.packages[0].dependencies = [{ name: "optional", range: "*", kind: "optional", resolved: packageId("/missing") }];
  verify(invalid, [issue("package-dependency-resolves", packageSite(), "optional", packageId("/missing"))]);
});
test("package-export-unique rejects the repeated specifier, not a repeated destination", () => {
  const value = snapshot();
  value.packages.packages[0].exports.push({ ...value.packages.packages[0].exports[0] });
  verify(value, [issue("package-export-unique", packageSite(), "./main.js")]);
  const valid = snapshot();
  valid.packages.packages[0].exports.unshift({ specifier: ".", module: moduleId() });
  verify(valid, []);
});
test("export-module-resolves requires the referenced module and export-package-agrees requires its real owner", () => {
  const missing = moduleId(packageId(), "missing.ts");
  const invalid = snapshot();
  invalid.packages.packages[0].exports[0].module = missing;
  verify(invalid, [issue("export-module-resolves", packageSite(), missing)]);
  const cross = snapshot();
  const additional = peer(cross);
  cross.packages.packages.find(entry => entry.id === packageId()).exports[0].module = additional.module;
  verify(cross, [issue("export-package-agrees", packageSite(), additional.module)]);
});
test("entry-point-root rejects a present selected entry from a different package and a missing root selection", () => {
  const cross = snapshot();
  const additional = peer(cross);
  cross.entryPoint = additional.module;
  cross.roots = [additional.module];
  verify(cross, [issue("entry-point-root", { kind: "snapshot" }, additional.module)]);
  const missing = snapshot();
  missing.roots = [];
  verify(missing, [issue("entry-point-root", { kind: "snapshot" }, moduleId())]);
});
test("entry-point-resolves and root-module-resolves retain their complete independent sites", () => {
  const invalid = snapshot();
  const missing = moduleId(packageId(), "missing.ts");
  invalid.entryPoint = missing;
  invalid.roots = [missing];
  verify(invalid, [issue("entry-point-resolves", { kind: "snapshot" }, missing),
    issue("root-module-resolves", moduleSite(missing), missing)]);
});
test("roots-unique never silently deduplicates the caller's authored root vector", () => {
  const value = snapshot();
  value.roots.push(moduleId());
  verify(value, [issue("roots-unique", moduleSite(), moduleId())]);
});
test("selection capabilities/surfaces are unique and surface correspondence preserves requested order", () => {
  const capabilities = snapshot();
  capabilities.selection.capabilityIds = ["core", "core"];
  verify(capabilities, [issue("selection-capability-unique", { kind: "selection", targetId: "native" }, "core")]);
  const surfaces = snapshot();
  surfaces.selection.target.surfaces = ["js", "js"];
  surfaces.selection.surfaceIds = ["js", "js"];
  verify(surfaces, [issue("selection-surface-unique", { kind: "selection", targetId: "native" }, "js")]);
  for (const selected of [["second", "first"], ["first"], ["first", "second", "extra"]]) {
    const value = snapshot();
    value.selection.target.surfaces = ["first", "second"];
    value.selection.surfaceIds = selected;
    verify(value, [issue("selection-surfaces-agree", { kind: "selection", targetId: "native" }, "surfaces")]);
  }
  for (const order of [["first", "second"], ["second", "first"]]) {
    const value = snapshot();
    value.selection.target.surfaces = [...order];
    value.selection.surfaceIds = [...order];
    value.selection.capabilityIds = ["one", "two", "three"];
    verify(value, []);
  }
});

test("component-package-resolves reports the exact foreign member without guessing another package", () => {
  const value = snapshot();
  const missing = packageId("/missing");
  value.packages.components.unshift({ representative: missing, packages: [missing], dependencies: [] });
  verify(value, [issue("component-package-resolves", packageSite(missing), missing)]);
});
test("component-membership-exact rejects missing, repeated and multiply assigned package rows", () => {
  const missing = snapshot();
  missing.packages.components = [];
  verify(missing, [issue("component-membership-exact", packageSite(), packageId())]);
  const repeated = snapshot();
  repeated.packages.components[0].packages.push(packageId());
  verify(repeated, [issue("component-membership-exact", packageSite(), packageId())]);
  const duplicate = snapshot();
  duplicate.packages.components.push({ representative: packageId(), packages: [packageId()], dependencies: [] });
  verify(duplicate, [issue("component-membership-exact", packageSite(), packageId()),
    issue("component-membership-exact", packageSite(), "representative", packageId())]);
});
test("component-representative is the genuine minimum member, and an empty supplied component has no invented representative", () => {
  const wrong = snapshot();
  wrong.packages.components[0].representative = packageId("/other");
  verify(wrong, [issue("component-representative", packageSite(packageId("/other")), packageId("/other"))]);
  const empty = snapshot();
  empty.packages.components[0].packages = [];
  verify(empty, [issue("component-membership-exact", packageSite(), packageId()),
    issue("component-representative", packageSite(), packageId())]);
});
test("package SCCs permit genuine cycles but reject unrelated or only one-way grouped packages", () => {
  for (const direction of ["none", "forward", "reverse", "cycle"]) {
    const value = snapshot();
    const additional = peer(value);
    const root = value.packages.packages.find(entry => entry.id === packageId());
    if (direction === "forward" || direction === "cycle") {
      additional.entry.dependencies = [{ name: "root", range: "*", kind: "peer", resolved: root.id }];
    }
    if (direction === "reverse" || direction === "cycle") {
      root.dependencies = [{ name: "library", range: "*", kind: "dependency", resolved: additional.id }];
    }
    value.packages.components = [{ representative: additional.id, packages: [additional.id, root.id], dependencies: [] }];
    verify(value, direction === "cycle" ? []
      : [issue("component-membership-exact", packageSite(additional.id), "strongly-connected")]);
  }
});
test("component-dependencies-exact checks real quotient edges, missing/extra entries and duplicate declared edges", () => {
  for (const actual of [[], [packageId("/missing")], [packageId("/library"), packageId("/library")]]) {
    const value = snapshot();
    const additional = peer(value);
    const root = value.packages.packages.find(entry => entry.id === packageId());
    root.dependencies = [{ name: "library", range: "*", kind: "dependency", resolved: additional.id }];
    value.packages.components.find(entry => entry.representative === root.id).dependencies = actual;
    verify(value, [issue("component-dependencies-exact", packageSite(), "dependencies")]);
  }
  const extra = snapshot();
  const additional = peer(extra);
  extra.packages.components.find(entry => entry.representative === packageId()).dependencies = [additional.id];
  verify(extra, [issue("component-dependencies-exact", packageSite(), "dependencies")]);
});
test("component-acyclic checks the supplied quotient without replacing it with a reconstructed graph", () => {
  const value = snapshot();
  value.packages.components[0].dependencies = [packageId()];
  verify(value, [issue("component-acyclic", { kind: "snapshot" }, "components"),
    issue("component-dependencies-exact", packageSite(), "dependencies")]);
  const cross = snapshot();
  const additional = peer(cross);
  additional.entry.dependencies = [{ name: "root", range: "*", kind: "peer", resolved: packageId() }];
  cross.packages.packages.find(entry => entry.id === packageId()).dependencies = [
    { name: "library", range: "*", kind: "dependency", resolved: additional.id },
  ];
  cross.packages.components.find(entry => entry.representative === packageId()).dependencies = [additional.id];
  cross.packages.components.find(entry => entry.representative === additional.id).dependencies = [packageId()];
  verify(cross, [issue("component-acyclic", { kind: "snapshot" }, "components")]);
});
test("library data has one explicit captured entry and remains source data, not a bound semantic registry", () => {
  const value = snapshot();
  const row = library(value);
  const identity = { module: { providerId: "provider", providerVersion: "1", packageName: null,
    moduleSpecifier: "native/lib", providerModuleId: "module" }, exportId: "value", memberId: null, signatureId: null };
  row.roles = [{ identity, role: "source-primitive" }];
  row.declaredSummaries = [{ identity, projections: [], producers: [{ id: 0, kind: "parameter", index: 0, path: null }],
    origins: [{ id: 0, kind: "complete", producers: [0], includesAbsence: false }], boundaries: [], parameters: [],
    captures: [], result: 0, thrown: 0, writes: [], retention: [], callbacks: [], invocationOnlyParameters: [],
    suspends: false, bindingDependent: false }];
  verify(value, []);
});
test("library-data-package-resolves never treats a package name as identity", () => {
  const value = snapshot();
  const row = library(value);
  value.packages.packages[0].libraryEntry = null;
  row.package = packageId("/missing");
  verify(value, [issue("library-data-package-resolves", packageSite(row.package), row.package)]);
});
test("library-data-path-resolves requires captured bytes for the actual authored library entry", () => {
  const value = snapshot();
  library(value);
  value.packages.files.shift();
  verify(value, [issue("library-data-path-resolves", packageSite(), "/project/library.json")]);
});
test("library-data-entry-exact rejects missing and changed entries without synthesizing a package name", () => {
  const missing = snapshot();
  missing.packages.packages[0].libraryEntry = "/project/library.json";
  verify(missing, [issue("library-data-entry-exact", packageSite(), "/project/library.json")]);
  const wrong = snapshot();
  library(wrong);
  wrong.packages.packages[0].libraryEntry = "/project/other.json";
  verify(wrong, [issue("library-data-entry-exact", packageSite(), "/project/library.json")]);
});
test("library-data-owner-exact rejects a foreign path and a different virtual owner", () => {
  const outside = snapshot();
  const row = library(outside);
  row.path = "/elsewhere/library.json";
  outside.packages.packages[0].libraryEntry = row.path;
  outside.packages.files[0].path = row.path;
  verify(outside, [issue("library-data-owner-exact", packageSite(), row.path)]);
  const virtual = snapshot();
  const additional = peer(virtual);
  const root = virtual.packages.packages.find(entry => entry.id === packageId());
  root.libraryEntry = "/project/library.json";
  virtual.packages.libraryData = [{ package: root.id, path: root.libraryEntry, roles: [], declaredSummaries: [] }];
  virtual.packages.files.splice(1, 0, { kind: "virtual", path: root.libraryEntry, owner: additional.id, text: "{}" });
  verify(virtual, [issue("library-data-owner-exact", packageSite(), root.libraryEntry)]);
});
test("library-data-unique reports the repeated package row", () => {
  const value = snapshot();
  const row = library(value);
  value.packages.libraryData.push({ ...row });
  verify(value, [issue("library-data-unique", packageSite(), packageId())]);
});
for (const kind of ["compiler-extension", "declaration-provider", "semantics-module"]) {
  test(`all ${kind} reference identity fields are compared against the same actual opaque-table view`, () => {
    const value = snapshot();
    const actual = extension(value, kind);
    verify(value, [], [actual]);
    for (const field of ["moduleSpecifier", "exportId", "version", "package"]) {
      const changed = snapshot();
      const entry = extension(changed, kind);
      const reference = { ...entry.reference, [field]: field === "package" ? packageId("/other") : "different" };
      verify(changed, [issue("extension-table-equality", { kind: "snapshot" }, "extensions")], [{ kind, reference }]);
    }
  });
}
test("extension-reference-unique rejects duplicates independently in declared and actual tables", () => {
  const expected = snapshot();
  const entry = extension(expected);
  expected.contributions.compilerExtensions.push({ ...entry.reference });
  verify(expected, [issue("extension-reference-unique", packageSite(), "compiler-extension", "./plugin.js", "extension")], [entry]);
  const actual = snapshot();
  const repeated = extension(actual);
  verify(actual, [issue("extension-reference-unique", packageSite(), "actual", "compiler-extension", "./plugin.js", "extension")],
    [repeated, { ...repeated }]);
});
test("extension-package-resolves uses the exact root identity even when the actual table agrees", () => {
  const value = snapshot();
  const entry = extension(value);
  entry.reference.package = packageId("/missing");
  verify(value, [issue("extension-package-resolves", packageSite(entry.reference.package), entry.reference.package)], [entry]);
});
test("extension-reference-kinds-exact rejects a mistagged same reference and retains the equality failure", () => {
  const value = snapshot();
  const entry = extension(value);
  verify(value, [issue("extension-reference-kinds-exact", packageSite(), "semantics-module", "./plugin.js", "extension"),
    issue("extension-table-equality", { kind: "snapshot" }, "extensions")], [{ kind: "semantics-module", reference: entry.reference }]);
});
test("extension-table-equality handles missing, extra, three-kind shared exports and both actual row orders", () => {
  const missing = snapshot();
  extension(missing);
  verify(missing, [issue("extension-table-equality", { kind: "snapshot" }, "extensions")]);
  const extra = { kind: "declaration-provider", reference: { package: packageId(), moduleSpecifier: "./extra.js", exportId: "extra", version: "1" } };
  verify(snapshot(), [issue("extension-table-equality", { kind: "snapshot" }, "extensions")], [extra]);
  for (const reverse of [false, true]) {
    const value = snapshot();
    const entries = [extension(value), extension(value, "declaration-provider"), extension(value, "semantics-module")];
    verify(value, [], reverse ? [...entries].reverse() : entries);
  }
});
test("contribution-files-resolve and virtual-file-owner-resolves retain their actual source paths", () => {
  const absent = snapshot();
  absent.contributions.declarationFiles = ["/virtual/missing.d.ts"];
  verify(absent, [issue("contribution-files-resolve", fileSite("/virtual/missing.d.ts"), "/virtual/missing.d.ts")]);
  const virtual = snapshot();
  virtual.packages.files.push({ kind: "virtual", path: "/virtual/prelude.d.ts", text: "", owner: packageId("/missing") });
  verify(virtual, [issue("virtual-file-owner-resolves", fileSite("/virtual/prelude.d.ts"), packageId("/missing"))]);
});
for (const byteOrder of ["little", "big"]) for (const addressWidth of [32, 64]) {
  test(`platform inputs preserve the explicit ${byteOrder}/${addressWidth} native ABI without a host guess`, () => {
    const value = snapshot();
    layout(value, "layout", byteOrder, addressWidth);
    verify(value, []);
  });
}
test("platform-layout-unique distinguishes a repeated exact ABI identity from a second declaration", () => {
  const value = snapshot();
  const entry = layout(value);
  value.nativeFacts.geometry.layouts.push({ ...entry });
  verify(value, [nativeIssue("native-fact-unique", "geometry.layouts", 1)]);
  const contributed = snapshot();
  layout(contributed);
  contributed.contributions.dataLayouts.push(declaration());
  verify(contributed, [issue("platform-layout-unique", { kind: "platform", declaration: declaration() }, "contribution")]);
});
test("the selected session native receipt is mandatory and never inferred from geometry or target identity", () => {
  for (const nativeFacts of [null, undefined]) {
    const value = snapshot();
    value.nativeFacts = nativeFacts;
    verify(value, [nativeIssue("native-fact-value", "nativeFacts", null)]);
  }
  const value = snapshot();
  value.nativeFacts.divisionByZero[0].law = "unknown";
  verify(value, [nativeIssue("native-fact-value", "divisionByZero", 0)]);
});
for (const field of ["providerId", "providerVersion", "providerModuleId", "moduleSpecifier", "exportId", "fingerprint"]) {
  test(`platform-layout-valid rejects an absent authored identity scalar ${field}`, () => {
    const value = snapshot();
    const entry = layout(value);
    if (field === "fingerprint") entry.layout.fingerprint = "";
    else entry.declaration[field] = "";
    verify(value, [nativeIssue("native-fact-value", "geometry.layouts", 0)]);
  });
}
test("contribution-layouts-exact compares all five declaration identity fields, missing rows and extra rows", () => {
  for (const field of ["providerId", "providerVersion", "providerModuleId", "moduleSpecifier", "exportId"]) {
    const value = snapshot();
    layout(value);
    value.contributions.dataLayouts[0] = { ...declaration(), [field]: "other" };
    verify(value, [issue("contribution-layouts-exact", { kind: "snapshot" }, "dataLayouts")]);
  }
  const absent = snapshot();
  layout(absent);
  absent.contributions.dataLayouts = [];
  verify(absent, [issue("contribution-layouts-exact", { kind: "snapshot" }, "dataLayouts")]);
  const extra = snapshot();
  extra.contributions.dataLayouts.push(declaration());
  verify(extra, [issue("contribution-layouts-exact", { kind: "snapshot" }, "dataLayouts")]);
});
test("provider-module-prefixes-disjoint respects exact namespaces, slash/colon ownership and nonoverlapping names", () => {
  for (const [first, second] of [["native", "native/path"], ["native/", "native/path"], ["node:", "node:fs"], ["native", "native"]]) {
    for (const prefixes of [[first, second], [second, first]]) {
      const value = snapshot();
      value.contributions.requiredProviderModules = prefixes.map(specifierPrefix => ({ specifierPrefix, providerId: null, message: "required" }));
      verify(value, [issue("provider-module-prefixes-disjoint", { kind: "snapshot" }, first, second)]);
    }
  }
  const value = snapshot();
  value.contributions.requiredProviderModules = ["native-other", "native", "node:fs", "other"].map(specifierPrefix => ({
    specifierPrefix, providerId: "provider", message: "explicit" }));
  verify(value, []);
});

for (const [name, prefixes, collisions] of [
  ["interposed slash sibling", ["native", "native-other", "native/path"], [["native", "native/path"]]],
  ["nonowning raw ancestors", ["a", "ab", "ab-other", "ab/path"], [["ab", "ab/path"]]],
  ["independent live namespace ancestors", ["native", "native-other", "native-other/path", "native/path"],
    [["native", "native/path"], ["native-other", "native-other/path"]]],
  ["duplicate before an interposed sibling", ["native", "native", "native-other", "native/path"],
    [["native", "native"], ["native", "native/path"]]],
  ["colon owner with an intermediate descendant", ["node:", "node:-other", "node:fs"],
    [["node:", "node:-other"], ["node:", "node:fs"]]],
  ["bare names do not acquire colon ownership", ["node", "node-other", "node:fs"], []],
  ["empty raw ancestor with an interposed sibling", ["", "-", "/root"], [["", "/root"]]],
]) {
  test(`provider-module-prefixes-disjoint retains ${name} in both input orders`, () => {
    for (const ordered of [prefixes, [...prefixes].reverse()]) {
      const value = snapshot();
      value.contributions.requiredProviderModules = ordered.map(specifierPrefix => ({
        specifierPrefix, providerId: null, message: "required",
      }));
      verify(value, collisions.map(([owner, prefix]) => issue("provider-module-prefixes-disjoint", { kind: "snapshot" }, owner, prefix)));
    }
  });
}

for (const [field, rule] of [["packages", "packages-order"], ["modules", "modules-order"], ["files", "files-order"], ["components", "components-order"]]) {
  test(`${rule} has a complete reversed-table opposite and a canonical several-row control`, () => {
    const valid = snapshot();
    peer(valid);
    verify(valid, []);
    const reversed = snapshot();
    peer(reversed);
    reversed.packages[field].reverse();
    verify(reversed, [issue(rule, { kind: "snapshot" }, field)]);
  });
}
test("exports-order has one canonical specifier order, independent of repeated module destinations", () => {
  const value = snapshot();
  value.packages.packages[0].exports.push({ specifier: ".", module: moduleId() });
  verify(value, [issue("exports-order", packageSite(), "exports")]);
});
test("library-data-order is the package-identity order without inferring identities from package names", () => {
  const value = snapshot();
  library(value);
  const additional = peer(value);
  additional.entry.libraryEntry = "/library/library.json";
  value.packages.files.push({ kind: "physical", path: additional.entry.libraryEntry, realPath: additional.entry.libraryEntry, text: "{}" });
  value.packages.files.sort((left, right) => left.path < right.path ? -1 : 1);
  value.packages.libraryData.push({ package: additional.id, path: additional.entry.libraryEntry, roles: [], declaredSummaries: [] });
  verify(value, [issue("library-data-order", { kind: "snapshot" }, "libraryData")]);
  const valid = snapshot();
  library(valid);
  const other = peer(valid);
  other.entry.libraryEntry = "/library/library.json";
  valid.packages.files.push({ kind: "physical", path: other.entry.libraryEntry, realPath: other.entry.libraryEntry, text: "{}" });
  valid.packages.files.sort((left, right) => left.path < right.path ? -1 : 1);
  valid.packages.libraryData.unshift({ package: other.id, path: other.entry.libraryEntry, roles: [], declaredSummaries: [] });
  verify(valid, []);
});
test("platform-layouts-order compares the complete declaration identity, not insertion or host-native values", () => {
  const valid = snapshot();
  layout(valid, "a");
  layout(valid, "b");
  verify(valid, []);
  const reversed = snapshot();
  layout(reversed, "a");
  layout(reversed, "b");
  reversed.nativeFacts.geometry.layouts.reverse();
  verify(reversed, [nativeIssue("native-fact-order", "geometry.layouts", 1)]);
});
test("stable-order validates actual dependency names and kinds without changing authored surface order", () => {
  const value = snapshot();
  value.packages.packages[0].dependencies = ["z", "a"].map(name => ({ name, kind: "optional", range: "*", resolved: null }));
  verify(value, [issue("stable-order", packageSite(), "dependencies")]);
  const sameName = snapshot();
  sameName.packages.packages[0].dependencies = ["peer", "optional"].map(kind => ({ name: "same", kind, range: "*", resolved: packageId() }));
  verify(sameName, [issue("stable-order", packageSite(), "dependencies")]);
});
test("stable-order validates member and quotient dependency vectors while preserving their complete relation failures", () => {
  const members = snapshot();
  const additional = peer(members);
  additional.entry.dependencies = [{ name: "root", range: "*", kind: "dependency", resolved: packageId() }];
  members.packages.packages.find(entry => entry.id === packageId()).dependencies = [{ name: "library", range: "*", kind: "dependency", resolved: additional.id }];
  members.packages.components = [{ representative: additional.id, packages: [packageId(), additional.id], dependencies: [] }];
  verify(members, [issue("stable-order", packageSite(additional.id), "component.packages")]);
  const dependencies = snapshot();
  const first = peer(dependencies);
  const second = peer(dependencies, "/secondx");
  dependencies.packages.packages.find(entry => entry.id === packageId()).dependencies = [
    { name: "a", kind: "dependency", range: "*", resolved: first.id },
    { name: "z", kind: "dependency", range: "*", resolved: second.id },
  ];
  dependencies.packages.components.find(entry => entry.representative === packageId()).dependencies = [second.id, first.id];
  verify(dependencies, [issue("component-dependencies-exact", packageSite(), "dependencies"),
    issue("stable-order", packageSite(), "component.dependencies")]);
});
test("a package-free malformed graph and an explicitly empty component are checked without recursive or fake records", () => {
  const value = snapshot();
  value.packages.packages = [];
  value.packages.modules = [];
  value.packages.files = [];
  value.packages.components[0].packages = [];
  verify(value, [issue("component-representative", packageSite(), packageId()),
    issue("entry-point-resolves", { kind: "snapshot" }, moduleId()),
    issue("root-module-resolves", moduleSite(), moduleId()),
    issue("root-package-resolves", { kind: "snapshot" }, packageId())]);
});
test("identical repeated violations retain multiplicity with a complete deterministic output vector", () => {
  const value = snapshot();
  value.packages.packages.push({ ...value.packages.packages[0] }, { ...value.packages.packages[0] });
  value.packages.files.push({ ...value.packages.files[0] }, { ...value.packages.files[0] });
  verify(value, [issue("file-path-unique", fileSite("/project/src/main.ts"), "/project/src/main.ts"),
    issue("file-path-unique", fileSite("/project/src/main.ts"), "/project/src/main.ts"),
    issue("package-id-unique", packageSite(), packageId()), issue("package-id-unique", packageSite(), packageId())]);
});

for (const field of ["packages", "modules", "files", "components", "libraryData"]) {
  test(`stable-order reports a native absent ${field} slot without losing later present rows`, () => {
    const value = snapshot();
    value.packages[field] = [null, ...value.packages[field]];
    verify(value, [sparseIssue({ kind: "snapshot" }, field)]);
  });
  test(`stable-order reports a type-correct sparse ${field} slot and still checks all later present rows`, () => {
    const value = snapshot();
    const original = value.packages[field];
    const sparse = new Array(original.length + 1);
    for (const [index, row] of original.entries()) sparse[index + 1] = row;
    value.packages[field] = sparse;
    verify(value, [sparseIssue({ kind: "snapshot" }, field)]);
  });
}
for (const field of ["dependencies", "exports"]) {
  test(`stable-order preserves the original sparse package ${field} position`, () => {
    const value = snapshot();
    const original = value.packages.packages[0][field];
    const sparse = new Array(original.length + 1);
    for (const [index, row] of original.entries()) sparse[index + 1] = row;
    value.packages.packages[0][field] = sparse;
    verify(value, [sparseIssue(packageSite(), field)]);
  });
}
for (const field of ["packages", "dependencies"]) {
  test(`stable-order checks sparse component ${field} without compacting an identity`, () => {
    const value = snapshot();
    const original = value.packages.components[0][field];
    const sparse = new Array(original.length + 1);
    for (const [index, row] of original.entries()) sparse[index + 1] = row;
    value.packages.components[0][field] = sparse;
    verify(value, [sparseIssue(packageSite(), `component.${field}`)]);
  });
}
for (const field of ["declarationFiles", "compilerExtensions", "declarationProviders", "semanticModules", "dataLayouts", "requiredProviderModules"]) {
  test(`stable-order checks sparse contributed ${field} through the same owner traversal`, () => {
    const value = snapshot();
    value.contributions[field] = new Array(1);
    verify(value, [sparseIssue({ kind: "snapshot" }, field)]);
  });
}
test("sparse platform layouts, actual extension references, roots and selection vectors retain original field locations", () => {
  const layouts = snapshot();
  layouts.nativeFacts.geometry.layouts = new Array(1);
  verify(layouts, [nativeIssue("native-fact-value", "geometry.layouts", 0)]);
  verify(snapshot(), [sparseIssue({ kind: "snapshot" }, "actualExtensionReferences")], new Array(1));
  const roots = snapshot();
  roots.roots = new Array(2);
  roots.roots[1] = moduleId();
  verify(roots, [sparseIssue({ kind: "snapshot" }, "roots")]);
  for (const field of ["capabilityIds", "surfaceIds"]) {
    const value = snapshot();
    value.selection[field] = new Array(1);
    verify(value, [sparseIssue({ kind: "selection", targetId: "native" }, field)]);
  }
  const requested = snapshot();
  requested.selection.target.surfaces = new Array(1);
  verify(requested, [sparseIssue({ kind: "selection", targetId: "native" }, "target.surfaces")]);
});
test("a 100000-package dependency chain uses bounded worklists rather than input-depth recursion", () => {
  const value = snapshot();
  const count = 100000;
  const ids = Array.from({ length: count }, (_, index) => packageId(`/dependency/${String(index).padStart(6, "0")}`));
  for (const [index, id] of ids.entries()) {
    const next = ids[index + 1];
    value.packages.packages.push({ id, name: "dependency", version: null,
      packageRoot: `/dependency/${String(index).padStart(6, "0")}`, sourceRoot: `/dependency/${String(index).padStart(6, "0")}`,
      manifestPath: null, dependencies: next === undefined ? [] : [{ name: "next", range: "*", kind: "dependency", resolved: next }],
      exports: [], pluginEntry: null, libraryEntry: null });
    value.packages.components.push({ representative: id, packages: [id], dependencies: next === undefined ? [] : [next] });
  }
  value.packages.packages[0].dependencies = [{ name: "first", range: "*", kind: "dependency", resolved: ids[0] }];
  value.packages.components[0].dependencies = [ids[0]];
  value.packages.packages.sort((left, right) => left.id < right.id ? -1 : 1);
  value.packages.components.sort((left, right) => left.representative < right.representative ? -1 : 1);
  verify(value, []);
});

test("an actual dependency with a missing component membership reports the owned relation without a fallback node", () => {
  const value = snapshot();
  const additional = peer(value);
  value.packages.packages.find(entry => entry.id === packageId()).dependencies = [
    { name: "library", kind: "dependency", range: "*", resolved: additional.id },
  ];
  value.packages.components = value.packages.components.filter(entry => entry.representative !== additional.id);
  verify(value, [issue("component-membership-exact", packageSite(additional.id), additional.id)]);
});
test("ambiguous package/file data never chooses a first or last matching library-owner authority", () => {
  const packages = snapshot();
  library(packages);
  packages.packages.packages.push({ ...packages.packages.packages[0] });
  verify(packages, [issue("package-id-unique", packageSite(), packageId())]);
  const files = snapshot();
  library(files);
  files.packages.files.splice(1, 0, { kind: "virtual", path: "/project/library.json", owner: packageId(), text: "{}" });
  verify(files, [issue("file-path-unique", fileSite("/project/library.json"), "/project/library.json")]);
});

for (const name of ["unnamed-root", "missing-root", "extensions-table-mismatch"]) {
  test(`authored complete verifier JSON outcome: ${name}`, async () => {
    const result = await runCase({ modules: ["snapshot"], evidenceDirectory: resolve(repository, ".temp/host-case-evidence"), readText: path => readFileSync(resolve(repository, path), "utf8"),
      canonical: path => relative(repository, realpathSync(resolve(repository, path))).split(sep).join("/"),
      list: path => readdirSync(resolve(repository, path)), decode: text => JSON.parse(text),
      adapters: { verifier: input => {
        assert.equal(input.format, "json");
        const value = JSON.parse(input.text);
        return { kind: "accepted", value: product.verifySnapshot((value.snapshot), (value.actualExtensionReferences)), diagnostics: [] };
      } },
    }, `test/host-cases/snapshot/verifier/${name}.case.json`);
    assert.equal(result.status, "passed", JSON.stringify(result));
  });
}

test("the whole snapshot module earns fresh strict isolation using real ids production and only admitted public declarations", async () => {
  const data = JSON.parse(readFileSync(resolve(repository, "test/architecture/quarantine/areas.json"), "utf8"));
  const report = await compileIsolated(isolationDeps(tooling, data.areas.map(area => area.directory)),
    hostCatalogue.find(module => module.name === "snapshot"), {
      root: repository, sourceFiles: ownedSources,
      interfaceSources: ["packages/host/src/ids/contract.ts", "packages/host/src/ids/index.ts", "packages/host/src/diag/contract.ts", "packages/host/src/diag/index.ts", "packages/host/src/ir-types/contract.ts", "packages/host/src/ir-types/index.ts"],
      declarationSources: dependencySources,
      outputDirectory: ".temp/host-f-snapshot/isolation",
    });
  writeFileSync(resolve(evidenceDirectory, "isolation.json"), `${JSON.stringify(report, null, 2)}\n`);
  assert.equal(report.status, "passed", `${JSON.stringify(report.findings)}\n${report.diagnostics.join("\n")}`);
  assert.deepEqual(report.findings, []);
  assert.equal(report.diagnostics.length, 2);
  assert.deepEqual(report.sourceInventory.map(entry => relative(repository, entry.path).split(sep).join("/")).sort(),
    [...ownedSources, ...dependencySources].sort());
  assert.deepEqual(report.provenance.map(entry => relative(repository, entry.source).split(sep).join("/")).sort(),
    ["diag/contract", "diag/index", "ids/contract", "ids/index", "ir-types/arena", "ir-types/contract", "ir-types/data", "ir-types/index", "ir-types/native-facts-data"]
      .map(name => `packages/host/src/${name}.ts`));
  assert.equal(report.loadedInventory.every(path => report.expectedInventory.includes(path)), true);
  for (const entry of ["ids/contract", "ids/index", "diag/contract", "ir-types/contract", "ir-types/index"]) {
    assert.equal(report.loadedInventory.some(path => path.endsWith(`/isolated/packages/host/src/${entry}.d.ts`)), true, entry);
    assert.equal(report.loadedInventory.some(path => path.endsWith(`/isolated/packages/host/src/${entry}.ts`)), false, entry);
  }
});

test("fresh real public declarations admit a cast-free consumer and reject exact readonly, port and shape opposites", () => {
  const stage = mkdtempSync(resolve(evidenceDirectory, "consumer-"));
  for (const [directory, names] of [["snapshot", ["contract", ...runtimeNames]], ["ids", ["contract", "index", "identity", "key"]], ["diag", ["contract"]], ["ir-types", ["contract", "data", "arena", "native-facts-data"]]]) {
    mkdirSync(resolve(stage, directory));
    for (const name of names) writeFileSync(resolve(stage, directory, `${name}.d.ts`),
      readFileSync(resolve(repository, "packages/host/dist", directory, `${name}.d.ts`)));
  }
  writeFileSync(resolve(stage, "package.json"), JSON.stringify({ type: "module", private: true }));
  const source = 'import { verifySnapshot } from "./snapshot/index.js";\n'
    + 'import { encodePackageId, encodeModuleId } from "./ids/index.js";\n'
    + 'import type { ModuleId } from "./ids/contract.js";\n'
    + 'import type { ProjectSnapshot, VerifySnapshot, ExtensionReferenceEntry, SnapshotRule, SnapshotSite } from "./snapshot/contract.js";\n'
    + 'import type { Violation } from "./diag/contract.js";\n'
    + 'import type { SelectedNativeFacts } from "./ir-types/contract.js"; export declare const selectedNativeFacts: SelectedNativeFacts;\n'
    + 'export const root = encodePackageId("/project"); export const entry = encodeModuleId({ package: root, path: "src/main.ts" });\n'
    + 'export const value: ProjectSnapshot = { packages: {fingerprint:"bytes",rootPackage:root,packages:[],components:[],modules:[],files:[],libraryData:[]},entryPoint:entry,roots:[],selection:{target:{id:"target",surfaces:[],options:{kind:"record",fields:[]}},providerId:"provider",capabilityIds:[],surfaceIds:[]},contributions:{declarationFiles:[],declarationPolicy:{bundledLibraries:[],installedDeclarations:"none"},requiredProviderModules:[],compilerExtensions:[],declarationProviders:[],semanticModules:[],safetyProviders:[],dataLayouts:[]},nativeFacts:selectedNativeFacts};\n'
    + 'export function consume(snapshot: ProjectSnapshot, references: readonly ExtensionReferenceEntry[]): readonly Violation<SnapshotRule,SnapshotSite>[] { const verify: VerifySnapshot = verifySnapshot; return verify(snapshot,references); }\n'
    + 'export function sparse(snapshot: ProjectSnapshot): readonly Violation<SnapshotRule,SnapshotSite>[] { return verifySnapshot({...snapshot,roots:new Array<ModuleId>(1)},[]); }\n';
  writeFileSync(resolve(stage, "consumer.ts"), source
    + 'export const nativeOptions: import("./snapshot/contract.js").TargetOptions = {kind:"record",fields:[["metadata",{kind:"record",fields:[["enabled",true],["values",[null,0,"text"]]]}]]};\n');
  const compiler = resolve(tooling, "node_modules/@typescript/native-preview/bin/tsgo.js");
  const configuration = files => ({ compilerOptions: {
    target: "ES2022", module: "NodeNext", moduleResolution: "NodeNext", lib: ["ES2022"], types: [],
    strict: true, noUncheckedIndexedAccess: true, exactOptionalPropertyTypes: true, noUnusedLocals: true,
    noUnusedParameters: true, noImplicitReturns: true, noFallthroughCasesInSwitch: true,
    skipLibCheck: false, noEmit: true, verbatimModuleSyntax: true,
  }, files });
  const run = (name, files) => {
    writeFileSync(resolve(stage, name), JSON.stringify(configuration(files)));
    const result = spawnSync(process.execPath, [compiler, "--project", resolve(stage, name), "--listFiles", "--pretty", "false"], {
      cwd: stage, encoding: "utf8", timeout: 90000, maxBuffer: 1048576,
    });
    assert.equal(result.error === undefined, true, "the actual pinned compiler completes without an application error");
    assert.equal(result.signal, null);
    const text = `${result.stdout}${result.stderr}`;
    writeFileSync(resolve(stage, `${name}.log`), text);
    return { status: result.status, text };
  };
  const positive = run("positive.json", ["consumer.ts"]);
  assert.equal(positive.status, 0, positive.text);
  assert.deepEqual(positive.text.split(/\r?\n/u).filter(path => path.startsWith(stage))
    .map(path => relative(stage, path).split(sep).join("/")).sort(),
  ["consumer.ts", "diag/contract.d.ts", "ids/contract.d.ts", "ids/index.d.ts", "ir-types/arena.d.ts", "ir-types/contract.d.ts", "ir-types/data.d.ts", "ir-types/native-facts-data.d.ts", "snapshot/contract.d.ts", "snapshot/index.d.ts"]);
  const negative = [
    ["removed-platform-receipt.ts", 2353, 'import type { ProjectSnapshot } from "./snapshot/contract.js"; export function old(value:ProjectSnapshot):void { const {nativeFacts,...rest}=value; const old:ProjectSnapshot={...rest,platform:{layouts:[]}}; void old; }'],
    ["missing-native-receipt.ts", 2741, 'import type { ProjectSnapshot } from "./snapshot/contract.js"; export function old(value:ProjectSnapshot):ProjectSnapshot { const {nativeFacts,...rest}=value; return rest; }'],
    ["removed-object-options.ts", 2739, 'import type { TargetOptions } from "./snapshot/contract.js"; export const old: TargetOptions = {};'],
    ["readonly-option-fields.ts", 2339, 'import type { TargetOptions } from "./snapshot/contract.js"; export function mutate(value: TargetOptions): void { value.fields.push(["enabled",true]); }'],
    ["json-excludes-bigint.ts", 2322, 'import type { TargetOptions } from "./snapshot/contract.js"; export const wrong: TargetOptions = {kind:"record",fields:[["bits",1n]]};'],
    ["readonly-result.ts", 2339, 'import { verifySnapshot } from "./snapshot/index.js"; import { value } from "./consumer.js"; verifySnapshot(value,[]).push();'],
    ["missing-reference-view.ts", 2554, 'import { verifySnapshot } from "./snapshot/index.js"; import { value } from "./consumer.js"; verifySnapshot(value);'],
    ["readonly-snapshot.ts", 2540, 'import type { ProjectSnapshot } from "./snapshot/contract.js"; export function update(value: ProjectSnapshot): void { value.entryPoint = value.entryPoint; }'],
    ["missing-library-data.ts", 2741, 'import type { PackageSnapshot } from "./snapshot/contract.js"; export function create(value: PackageSnapshot): PackageSnapshot { const result: PackageSnapshot = {fingerprint:value.fingerprint,rootPackage:value.rootPackage,packages:[],components:[],modules:[],files:[]}; return result; }'],
    ["wrong-extension-kind.ts", 2322, 'import type { ExtensionReferenceEntry } from "./snapshot/contract.js"; import { root } from "./consumer.js"; export const value: ExtensionReferenceEntry = {kind:"invalid",reference:{package:root,moduleSpecifier:"module",exportId:"entry",version:"1"}};'],
    ["mutable-return.ts", 2322, 'import { verifySnapshot } from "./snapshot/index.js"; import type { ProjectSnapshot,ExtensionReferenceEntry,SnapshotRule,SnapshotSite } from "./snapshot/contract.js"; import type { Violation } from "./diag/contract.js"; export const verify: (value:ProjectSnapshot,actual:readonly ExtensionReferenceEntry[])=>Violation<SnapshotRule,SnapshotSite>[] = verifySnapshot;'],
    ["missing-version.ts", 2322, 'import type { ExtensionReferenceEntry } from "./snapshot/contract.js"; import { root } from "./consumer.js"; export const value: ExtensionReferenceEntry = {kind:"compiler-extension",reference:{package:root,moduleSpecifier:"module",exportId:"entry",version:undefined}};'],
  ];
  for (const [name, , text] of negative) writeFileSync(resolve(stage, name), text);
  const refused = run("negative.json", negative.map(([name]) => name));
  assert.equal(refused.status, 1, refused.text);
  const diagnostics = [...refused.text.matchAll(/^(.+)\(\d+,\d+\): error TS(\d+):/gmu)]
    .map(match => [basename(match[1]), Number(match[2])]).sort(([left], [right]) => left < right ? -1 : 1);
  assert.equal([...refused.text.matchAll(/\berror TS\d+:/gu)].length, diagnostics.length,
    "every compiler error belongs to the complete located diagnostic vector");
  assert.deepEqual(diagnostics, negative.map(([name, code]) => [name, code]).sort(([left], [right]) => left < right ? -1 : 1), refused.text);
});

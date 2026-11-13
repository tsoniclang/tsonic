import assert from "node:assert/strict";
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { Session } from "node:inspector";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { after, before, test } from "node:test";
import { checkCoverage } from "../architecture/host/coverage.mjs";
import { parseSources } from "../architecture/host/import-graph.mjs";

const repository = fileURLToPath(new URL("../../", import.meta.url));
const runtimeFiles = ["index.js", "options.js", "checker.js", "handles.js"].map(name => resolve(repository, "packages/host/dist/front", name));
const session = new Session();
const post = (method, parameters = {}) => new Promise((done, reject) => {
  session.post(method, parameters, (error, result) => error === null ? done(result) : reject(error));
});
let front;
let optionModule;
let checkerModule;
let sdk;
let ids;
let snapshots;

before(async () => {
  assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined, true, "front tests run under the aggregate resource guard");
  session.connect();
  await post("Debugger.enable");
  await post("Profiler.enable");
  await post("Profiler.startPreciseCoverage", { callCount: true, detailed: true });
  front = await import("../../packages/host/dist/front/index.js");
  optionModule = await import("../../packages/host/dist/front/options.js");
  checkerModule = await import("../../packages/host/dist/front/checker.js");
  sdk = await import("@tsonic/tsts");
  ids = await import("../../packages/host/dist/ids/index.js");
  snapshots = await import("../../packages/host/dist/snapshot/index.js");
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
      project: (scriptUrl, text) => ({ path: fileURLToPath(scriptUrl), text }) }, runtimeFiles, raw);
    const directory = resolve(repository, ".temp/front-coverage");
    mkdirSync(directory, { recursive: true });
    writeFileSync(resolve(directory, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
    assert.equal(result.length, runtimeFiles.length, "each front runtime file has real V8 evidence");
    assert.equal(report.status, "passed", JSON.stringify(report.findings).slice(0, 6000));
    for (const file of report.files) {
      assert.equal(file.status, "covered", file.path);
      assert.equal(file.lines, 100, file.path);
      assert.equal(file.branches, 100, file.path);
      assert.equal(file.functions, 100, file.path);
    }
  } finally { session.disconnect(); }
});

const libraryDirectory = "/checker-libraries";
const sources = {
  "/project/src/main.mts": "import { twice } from \"./util.mjs\";\nexport const xs: number[] = [twice(1)];\nexport const n: number = xs.length;\nexport const m = new Map<string, number>();\n",
  "/project/src/util.mts": "export function twice(value: number): number { return value * 2; }\n",
};
const kinds = ["config", "program", "global", "syntactic", "semantic"];

function open(options, libraries, extraSources = {}) {
  const files = { ...sources, ...extraSources, ...Object.fromEntries(libraries.map(library => [`${libraryDirectory}/${library.name}`, library.text])) };
  const compilerSession = sdk.createCompilerSessionFromFiles({ currentDirectory: "/project", files, rootFiles: Object.keys(files),
    compilerOptions: options, useCaseSensitiveFileNames: true });
  const checked = compilerSession.checkSource();
  return {
    counts: Object.fromEntries(kinds.map(kind => [kind, compilerSession.getDiagnostics(kind).length])),
    codes: [...new Set(compilerSession.getDiagnostics("all").map(diagnostic => diagnostic.code))].sort(),
    files: checked.getSourceFiles().map(fileNameOf),
  };
}
function fileNameOf(file) {
  const read = file.FileName ?? file.fileName;
  const name = typeof read === "function" ? read.call(file) : read;
  assert.equal(typeof name, "string", "a program file of the checker has a name");
  return name;
}
const clean = { config: 0, program: 0, global: 0, syntactic: 0, semantic: 0 };

test("the option table is written once: eleven rows, each named once, each with its reason; the set has one entry per row and no other", () => {
  const names = optionModule.optionTable.map(row => row.name);
  assert.deepEqual(names, ["module", "moduleResolution", "target", "strict", "noEmit", "noLib", "allowImportingTsExtensions",
    "allowArbitraryExtensions", "preserveSymlinks", "rootDir", "types"]);
  assert.equal(new Set(names).size, names.length);
  for (const row of optionModule.optionTable) assert.equal(row.reason.length > 20, true, row.name);
  assert.deepEqual(optionModule.optionSet({ projectRoot: "/project", installedDeclarations: "package-contract" }), {
    module: "nodenext", moduleResolution: "nodenext", target: "es2024", strict: true, noEmit: true, noLib: true,
    allowImportingTsExtensions: true, allowArbitraryExtensions: true, preserveSymlinks: true, rootDir: "/project", types: ["*"] });
  assert.deepEqual(optionModule.optionSet({ projectRoot: "/other/root", installedDeclarations: "none" }), {
    module: "nodenext", moduleResolution: "nodenext", target: "es2024", strict: true, noEmit: true, noLib: true,
    allowImportingTsExtensions: true, allowArbitraryExtensions: true, preserveSymlinks: true, rootDir: "/other/root", types: [] });
});

test("F-7: the real checker opens a session on the whole option set with no diagnostic, on library texts supplied as files and on no other", () => {
  const libraries = sdk.getBundledLibraryClosure(["lib.es2024.d.ts"]);
  assert.equal(libraries.length > 10, true, "the stand-in for a snapshot's bundled libraries is a real closed set");
  const bundledPath = sdk.getBundledLibraryPath();
  for (const installedDeclarations of ["none", "package-contract"]) {
    const opened = open(optionModule.optionSet({ projectRoot: "/project", installedDeclarations }), libraries);
    assert.deepEqual(opened.counts, clean, installedDeclarations);
    assert.equal(opened.files.length, 2 + libraries.length);
    assert.deepEqual(opened.files.filter(name => name.startsWith(bundledPath)), [], "nothing is read from the libraries bundled with the installed SDK");
  }
  const options = optionModule.optionSet({ projectRoot: "/project", installedDeclarations: "none" });
  const marked = libraries.map(library => library.name === "lib.es5.d.ts"
    ? { name: library.name, text: `${library.text}\ninterface SuppliedTextMarker { readonly supplied: true }\n` } : library);
  const uses = { "/project/src/uses.mts": "export const marker: SuppliedTextMarker = { supplied: true };\n" };
  assert.deepEqual(open(options, marked, uses).counts, clean, "the session reads the supplied text of a library");
  assert.equal(open(options, libraries, uses).counts.semantic > 0, true, "and the declaration exists nowhere else");
  const without = open(options, []);
  assert.deepEqual({ config: without.counts.config, program: without.counts.program }, { config: 0, program: 0 },
    "the option set itself is accepted: no option diagnostic");
  assert.equal(without.counts.global > 0 && without.codes.includes(2318), true, "with no library file the global types are missing: nothing is read implicitly");
  const implicit = open({ ...options, noLib: false, lib: ["es2024"] }, []);
  assert.deepEqual(implicit.counts, clean);
  assert.equal(implicit.files.filter(name => name.startsWith(bundledPath)).length, libraries.length,
    "the opposite of noLib: the session reads the installed SDK's own library texts, which is why the row is true");
});

const identityKinds = new Set(["SourceFile", "FunctionDeclaration", "ClassDeclaration", "InterfaceDeclaration", "TypeAliasDeclaration", "EnumDeclaration",
  "EnumMember", "ModuleDeclaration", "VariableDeclaration", "BindingElement", "Parameter", "TypeParameter", "PropertyDeclaration", "MethodDeclaration",
  "GetAccessor", "SetAccessor", "Constructor", "ClassStaticBlockDeclaration", "PropertySignature", "MethodSignature", "CallSignature",
  "ConstructSignature", "IndexSignature", "FunctionExpression", "ArrowFunction", "ClassExpression", "ExportAssignment"]);

test("K-3236: the authored identity inputs obey the law they state: kinds of F-1, owners before members, ordinals counted across kinds per owner and name", () => {
  const { cases } = JSON.parse(readFileSync(resolve(repository, "test/host-units/fixtures/front/identity-cases.json"), "utf8"));
  assert.deepEqual(cases.map(entry => entry.name), ["type-then-value", "value-then-type", "type-and-value-uses", "overloads", "function-with-namespace",
    "class-with-interface", "unnamed-class-members", "unnamed-signatures", "augmentation-and-reexport", "default-expression", "default-declarations",
    "external-export-equals", "authored-export-equals"]);
  const key = path => JSON.stringify(path);
  for (const entry of cases) {
    assert.equal(entry.rule.length > 20, true, entry.name);
    const declared = new Map();
    for (const [file, rows] of Object.entries(entry.definitions ?? {})) {
      assert.equal(Object.hasOwn(entry.files, file), true, `${entry.name}: ${file} is a file of the case`);
      assert.deepEqual(rows[0], { kind: "SourceFile", path: [] }, `${entry.name}: the module's own definition comes first`);
      const seen = new Set();
      const counts = new Map();
      for (const row of rows) {
        assert.equal(identityKinds.has(row.kind), true, `${entry.name}: ${row.kind}`);
        assert.equal(seen.has(key(row.path)), false, `${entry.name}: one identity per declaration in ${file}`);
        seen.add(key(row.path));
        if (row.path.length === 0) continue;
        const owner = row.path.slice(0, -1);
        const [name, ordinal] = row.path.at(-1);
        assert.equal(seen.has(key(owner)), true, `${entry.name}: the owner of ${key(row.path)} is declared before it`);
        const counter = `${key(owner)} ${JSON.stringify(name)}`;
        assert.equal(ordinal, counts.get(counter) ?? 0, `${entry.name}: ${key(row.path)} is the next declaration of that name in its owner, whatever its kind`);
        counts.set(counter, ordinal + 1);
      }
      declared.set(file, seen);
    }
    const resolves = (file, member) => typeof member[0] === "string" && Array.isArray(member[1]) && typeof member[1][0] !== "string" && typeof member[1][0] !== "number"
      ? declared.get(member[0]).has(key(member[1])) : declared.get(file).has(key(member));
    for (const [file, names] of Object.entries(entry.exports ?? {})) for (const [name, group] of Object.entries(names)) {
      assert.equal(group.length > 0, true, `${entry.name}: the group of ${name} is not empty`);
      for (const member of group) assert.equal(resolves(file, member), true, `${entry.name}: ${name} names a declaration of the case`);
    }
    for (const use of entry.uses ?? []) for (const member of use.group) assert.equal(resolves(use.file, member), true, `${entry.name}: ${use.occurrence}`);
  }
});

test("the checker package that Host's built output loads is this worktree's own, and it is the one instance these cases use", () => {
  const fromHost = import.meta.resolve("@tsonic/tsts", pathToFileURL(resolve(repository, "packages/host/dist/front/checker.js")).href);
  const own = pathToFileURL(realpathSync(resolve(repository, "packages/tsts/dist/src/index.js"))).href;
  assert.equal(fromHost, own, "resolved inside the worktree");
  assert.equal(import.meta.resolve("@tsonic/tsts"), own, "the cases build their inputs with the same module instance");
  assert.equal([...process.execArgv, ...(process.env.NODE_OPTIONS ?? "").split(" ")].some(option => option.startsWith("--preserve-symlinks")), false,
    "symbolic-link preservation is off, so a linked and a direct path load one instance");
});

const navigationCapture = { maximumCallableExpressionDepth: 64, maximumCallableSelectionDepth: 64, maximumCallableAliasDeclarations: 64,
  maximumCallableReceiverDeclarations: 64, maximumCallableReceiverSteps: 64, maximumCallableMemberReferences: 64, maximumLexicalEnvironmentSteps: 64,
  maximumLexicalEvaluationSteps: 64, maximumSyntaxDepth: 256, maximumCapturedNodesPerModule: 100000, maximumCapturedFactsPerModule: 100000,
  maximumCapturedEdgesPerModule: 100000 };
const preparation = { roots: [], files: [], diagnostics: [] };
const packageOf = root => ids.encodePackageId(root);
const moduleOf = (owner, path) => ids.encodeModuleId({ package: owner, path });
const byId = (left, right) => left.id < right.id ? -1 : 1;
const bundled = () => sdk.getBundledLibraryClosure(["lib.es2024.d.ts"]).map(library => ({ name: library.name, text: library.text }));

/** A verifier-valid snapshot: a project package with source modules, a package holding the bundled libraries, and packages of providers. */
function projectSnapshot({ sourceFiles, libraries, providerPackages = [], declarationProviders = [], compilerExtensions = [], requiredProviderModules = [] }) {
  const project = packageOf("/project");
  const checker = packageOf("/checker");
  const packages = [
    { id: project, name: null, version: null, packageRoot: "/project", sourceRoot: "/project/src", manifestPath: null, dependencies: [], exports: [], pluginEntry: null, libraryEntry: null },
    { id: checker, name: "checker-libraries", version: "1.0.0", packageRoot: "/checker", sourceRoot: "/checker", manifestPath: "/checker/package.json", dependencies: [], exports: [], pluginEntry: null, libraryEntry: null },
    ...providerPackages.map(entry => ({ id: packageOf(entry.root), name: entry.name, version: "1.0.0", packageRoot: entry.root, sourceRoot: entry.root,
      manifestPath: `${entry.root}/package.json`, dependencies: [], exports: [], pluginEntry: `${entry.root}/plugin.js`, libraryEntry: null })),
  ].sort(byId);
  const modules = [];
  const files = [];
  for (const [name, text] of Object.entries(sourceFiles)) {
    modules.push({ id: moduleOf(project, `src/${name}`), package: project, path: `/project/src/${name}`, role: "source" });
    files.push({ kind: "physical", path: `/project/src/${name}`, realPath: `/project/src/${name}`, text });
  }
  for (const library of libraries) {
    modules.push({ id: moduleOf(checker, library.name), package: checker, path: `/checker/${library.name}`, role: "declaration" });
    files.push({ kind: "virtual", path: `/checker/${library.name}`, text: library.text, owner: checker });
  }
  modules.sort(byId);
  files.sort((left, right) => left.path < right.path ? -1 : 1);
  return {
    packages: { fingerprint: "captured", rootPackage: project, packages, modules, files, libraryData: [],
      components: packages.map(entry => ({ representative: entry.id, packages: [entry.id], dependencies: [] })) },
    entryPoint: moduleOf(project, `src/${Object.keys(sourceFiles)[0]}`),
    roots: Object.keys(sourceFiles).map(name => moduleOf(project, `src/${name}`)).sort(),
    selection: { target: { id: "native", surfaces: [], options: { kind: "record", fields: [] } }, providerId: "native-provider", capabilityIds: [], surfaceIds: [] },
    contributions: { declarationFiles: [], declarationPolicy: { bundledLibraries: libraries.map(library => moduleOf(checker, library.name)).sort(), installedDeclarations: "none" },
      requiredProviderModules, compilerExtensions, declarationProviders, semanticModules: [], safetyProviders: [], dataLayouts: [] },
    platform: { layouts: [] },
  };
}

function declarationProvider(id, specifier, providerModuleId, rangeStart = 9_900_000) {
  return { identity: { id, version: "1.0.0", extensionContractVersion: sdk.TstsSourceProviderContractVersion, diagnosticRange: { start: rangeStart, end: rangeStart + 99 } },
    declarationMaterialization: "complete",
    ownsModule: requested => requested === specifier ? { kind: "owned" } : { kind: "unowned" },
    resolveModule: requested => ({ kind: "virtual", moduleSpecifier: requested, virtualFileName: `/provider/${providerModuleId.replaceAll(".", "/")}.d.ts`, providerModuleId }),
    getDeclarationModel: () => ({ moduleSpecifier: specifier, providerModuleId, exports: [{ id: "Value", name: "Value", kind: "value", type: { kind: "number" } }] }) };
}
const reference = (root, exportId = "provider") => ({ package: packageOf(root), moduleSpecifier: "./plugin.js", exportId, version: "1" });
const providerRegistration = (root, provider) => ({ reference: reference(root), value: { kind: "declaration-provider", value: provider, roles: [] } });

function openAndCapture(snapshot, registrations = []) {
  const deps = { extensions: checkerModule.createExtensionTable(registrations), navigationCapture };
  assert.deepEqual(snapshots.verifySnapshot(snapshot, checkerModule.extensionReferences(deps.extensions)), [], "the case's snapshot is one the snapshot verifier accepts");
  const opened = front.openCheckedProgram(deps, snapshot, preparation);
  assert.equal(opened.kind, "ok");
  return { deps, program: opened.value, set: front.captureProgramModules(deps, opened.value) };
}
const plainSources = { "main.mts": "import { twice } from \"./util.mjs\";\nexport const xs: number[] = [twice(1)];\n",
  "util.mts": "export function twice(value: number): number { return value * 2; }\n" };
const failure = message => ({ owner: "front", query: null, origin: null, message });

test("the module set is the modules of the opened program: the snapshot's source modules and its bundled libraries as declaration modules of their package; no checker object leaves Front", () => {
  const libraries = bundled();
  const snapshot = projectSnapshot({ sourceFiles: plainSources, libraries });
  const { deps, program, set } = openAndCapture(snapshot);
  assert.deepEqual(Object.keys(JSON.parse(JSON.stringify(set))), ["modules"]);
  assert.deepEqual(set.modules, snapshot.packages.modules.map(module => ({ kind: "snapshot", module: module.id })),
    "every module of the snapshot is a program module here, once, in ascending order of identity");
  const checker = packageOf("/checker");
  const libraryModules = set.modules.filter(entry => ids.decodeModuleId(entry.module).value.package === checker);
  assert.equal(libraryModules.length, libraries.length, "each bundled library is a module of the package the snapshot gives it");
  assert.deepEqual(JSON.parse(JSON.stringify(set)), set, "the module set is plain data");
  assert.deepEqual(front.captureProgramModules(deps, program), set, "a repeated capture of one program gives the same set");
  assert.throws(() => front.captureProgramModules({ extensions: checkerModule.createExtensionTable([]), navigationCapture }, program),
    { name: "TypeError", message: "front: the extension table is not the one the program was opened with" });
  assert.deepEqual(openAndCapture(projectSnapshot({ sourceFiles: plainSources, libraries })).set, set, "and so does a second program opened on equal inputs");
});

test("a session document is captured once, with the package of the one loaded registration that supplied its provider, that package's name from the snapshot, and the provider module as supplied", () => {
  const libraries = bundled();
  const sourceFiles = { "main.mts": "import { Value } from \"native:thing\";\nimport { Value as Other } from \"native:other\";\nexport const v: number = Value + Other;\n" };
  const providerPackages = [{ root: "/provider-one", name: "provider-one-pkg" }, { root: "/provider-two", name: null }];
  const registrations = [providerRegistration("/provider-one", declarationProvider("test.provider.one", "native:thing", "native.thing")),
    providerRegistration("/provider-two", declarationProvider("test.provider.two", "native:other", "native.other", 9_900_100))];
  const snapshot = projectSnapshot({ sourceFiles, libraries, providerPackages, declarationProviders: registrations.map(entry => entry.reference),
    requiredProviderModules: [{ specifierPrefix: "native:thing", providerId: "test.provider.one", message: "native:thing needs its provider" },
      { specifierPrefix: "other-required:", providerId: null, message: "any provider" }] });
  const { set } = openAndCapture(snapshot, registrations);
  const documents = set.modules.filter(entry => entry.kind === "session-document").map(entry => entry.document);
  assert.equal(set.modules.length, 1 + libraries.length + documents.length);
  const of = providerModuleId => documents.filter(document => document.provider.providerModuleId === providerModuleId);
  for (const [providerModuleId, root, packageName, providerId, specifier] of [
    ["native.thing", "/provider-one", "provider-one-pkg", "test.provider.one", "native:thing"],
    ["native.other", "/provider-two", null, "test.provider.two", "native:other"]]) {
    const own = of(providerModuleId);
    assert.equal(own.length > 0, true, providerModuleId);
    for (const document of own) {
      assert.equal(document.package, packageOf(root), "the registering package");
      assert.deepEqual(document.provider, { providerId, providerVersion: "1.0.0", packageName, moduleSpecifier: specifier, providerModuleId });
      assert.deepEqual(ids.decodeModuleId(document.module).value.package, packageOf(root), "its module identity is in the registering package");
      assert.equal(["public", "canonical-export-owner"].includes(document.artifact), true);
      assert.equal(document.text.includes(`"${providerModuleId}"`), true, "the exact text of the checked file, which names its provider module");
    }
  }
  assert.equal(new Set(documents.map(document => document.module)).size, documents.length, "each document once");
});

test("provenance that is not a loaded declaration-provider registration is an invariant failure, never a guess: a provider that only a compiler extension registered, and a registering package the snapshot does not hold", () => {
  const libraries = bundled();
  const sourceFiles = { "main.mts": "import { Value } from \"native:thing\";\nexport const v: number = Value;\n" };
  const provider = declarationProvider("test.provider", "native:thing", "native.thing");
  const capture = (snapshot, registrations) => {
    const deps = { extensions: checkerModule.createExtensionTable(registrations), navigationCapture };
    const opened = front.openCheckedProgram(deps, snapshot, preparation);
    return () => front.captureProgramModules(deps, opened.value);
  };
  const viaExtension = { reference: reference("/provider-one", "extension"), value: { kind: "compiler-extension",
    value: { identity: { id: "test.registers.a.provider", version: "1.0.0" }, initialize: context => { context.registerSourceDeclarationProvider(provider); } } } };
  const packagesOne = [{ root: "/provider-one", name: "one" }];
  assert.throws(capture(projectSnapshot({ sourceFiles, libraries, providerPackages: packagesOne, compilerExtensions: [viaExtension.reference] }), [viaExtension]),
    error => { assert.deepEqual(error.cause, failure("A session document names a provider that no loaded registration supplied.")); return true; });
  const foreign = [providerRegistration("/not-in-the-snapshot", provider)];
  assert.throws(capture(projectSnapshot({ sourceFiles, libraries }), foreign),
    error => { assert.deepEqual(error.cause, failure("The registering package of a session document is not a package of the snapshot.")); return true; });
});

test("a program file that is no module of the snapshot is an invariant failure; two files with one module identity likewise", () => {
  const libraries = bundled();
  const stray = projectSnapshot({ sourceFiles: { "main.mts": "import { helper } from \"./helper.mjs\";\nexport const h: number = helper;\n" }, libraries });
  stray.packages.files.push({ kind: "physical", path: "/project/src/helper.mts", realPath: "/project/src/helper.mts", text: "export const helper: number = 1;\n" });
  stray.packages.files.sort((left, right) => left.path < right.path ? -1 : 1);
  const deps = { extensions: checkerModule.createExtensionTable([]), navigationCapture };
  const openedStray = front.openCheckedProgram(deps, stray, preparation);
  assert.throws(() => front.captureProgramModules(deps, openedStray.value),
    error => { assert.deepEqual(error.cause, failure("A file of the opened program is neither a module of the snapshot nor a session document.")); return true; });
  const repeated = projectSnapshot({ sourceFiles: plainSources, libraries });
  const sources = ["/project/src/util.mts", "/project/src/main.mts"].map(path => repeated.packages.modules.find(module => module.path === path));
  sources[0].id = repeated.entryPoint;
  repeated.packages.modules = [...sources, ...repeated.packages.modules.filter(module => !sources.includes(module))];
  repeated.roots = [repeated.entryPoint];
  const openedRepeated = front.openCheckedProgram(deps, repeated, preparation);
  assert.throws(() => front.captureProgramModules(deps, openedRepeated.value),
    error => { assert.deepEqual(error.cause, failure("Two files of the opened program have one module identity.")); return true; });
});

/**
 * The diagnostics of a session that is given what `openCheckedProgram` gives it: the snapshot's texts, the same roots and the
 * option set of the table. Front has no operation yet that returns a file's diagnostics (`captureModule`), so these cases read
 * them from such a session; the module set is always read through Front.
 */
function sessionDiagnostics(snapshot) {
  const pathOf = new Map(snapshot.packages.modules.map(module => [module.id, module.path]));
  const session = sdk.createCompilerSessionFromFiles({ currentDirectory: "/project", files: new Map(snapshot.packages.files.map(file => [file.path, file.text])),
    rootFiles: [...snapshot.roots, ...snapshot.contributions.declarationPolicy.bundledLibraries].map(module => pathOf.get(module)),
    compilerOptions: { ...optionModule.optionSet({ projectRoot: "/project", installedDeclarations: "none" }) }, useCaseSensitiveFileNames: true });
  const checked = session.checkSource();
  return session.getDiagnostics("all").map(diagnostic => `TS${diagnostic.code} ${diagnostic.file === undefined ? "(no file)" : checked.ast.getFileName(diagnostic.file)}`);
}
const usesMap = { "main.mts": "export const m = new Map<string, number>();\n" };
const collection = "lib.es2015.collection.d.ts";
const snapshotModules = snapshot => snapshot.packages.modules.map(module => ({ kind: "snapshot", module: module.id }));

test("libraries, present: a declaration of a library that is reached only through other libraries' references is visible, and every program file is a captured module", () => {
  const libraries = bundled();
  assert.deepEqual(libraries.filter(library => library.text.includes('reference lib="es2015.collection"')).map(library => library.name), ["lib.es2015.d.ts"],
    "the collection library is referred to by one other library and by no root");
  const snapshot = projectSnapshot({ sourceFiles: usesMap, libraries });
  assert.deepEqual(openAndCapture(snapshot).set.modules, snapshotModules(snapshot));
  assert.deepEqual(sessionDiagnostics(snapshot), []);
});

test("libraries, missing: a referenced library that the snapshot does not hold is read from nowhere; a use of its declarations is an ordinary diagnostic of the using file", () => {
  const libraries = bundled().filter(library => library.name !== collection);
  const used = projectSnapshot({ sourceFiles: usesMap, libraries });
  assert.deepEqual(openAndCapture(used).set.modules, snapshotModules(used),
    "the program has exactly the snapshot's modules: a file of the installed checker would be neither a module nor a session document and would stop the capture");
  assert.deepEqual(sessionDiagnostics(used), ["TS2585 /project/src/main.mts"], "the absent declarations are absent; no installed text stands in for them");
});

test("libraries, missing and unused, PENDING at the preparation boundary: the session itself reports nothing for a library reference that the captured set does not close", () => {
  const libraries = bundled().filter(library => library.name !== collection);
  const unused = projectSnapshot({ sourceFiles: { "main.mts": "export const n: number = 1;\n" }, libraries });
  assert.deepEqual(openAndCapture(unused).set.modules, snapshotModules(unused));
  assert.deepEqual(sessionDiagnostics(unused), [],
    "what the checker does today, under these options and equally under its own library root: the open reference is stated only by the import preparation's reference rows, where its report belongs");
});

test("libraries, transitive: the checker follows no library reference; the modules that the declaration policy lists are the whole library set", () => {
  const withoutAggregate = bundled().filter(library => library.name !== "lib.es2015.d.ts");
  const stillListed = projectSnapshot({ sourceFiles: usesMap, libraries: withoutAggregate });
  assert.deepEqual(sessionDiagnostics(stillListed), [], "the collection library is listed, so its declarations are present without the library whose reference led to it");
  assert.deepEqual(openAndCapture(stillListed).set.modules, snapshotModules(stillListed));
  const onlyTop = projectSnapshot({ sourceFiles: usesMap, libraries: bundled() });
  onlyTop.contributions.declarationPolicy.bundledLibraries = [moduleOf(packageOf("/checker"), "lib.es2024.d.ts")];
  assert.deepEqual(snapshots.verifySnapshot(onlyTop, []), []);
  assert.deepEqual([...new Set(sessionDiagnostics(onlyTop))], ["TS2318 (no file)", "TS2583 /project/src/main.mts"],
    "captured but unlisted libraries are not reached through the listed one's references: its chain of references is not followed");
  assert.throws(() => front.openCheckedProgram({ extensions: checkerModule.createExtensionTable([]), navigationCapture }, onlyTop, preparation),
    { name: "TypeError", message: "front: the session reported diagnostics that name no file (TS2318); the refusal that carries them waits for the checker's message accessor" });
});

test("libraries, captured text differing from the installed text: a declaration appended to a captured library is visible, and a captured library that lacks a declaration is not completed from the installed one", () => {
  const libraries = bundled().map(library => library.name === "lib.es5.d.ts" ? { name: library.name, text: `${library.text}\ndeclare const capturedOnlyMarker: number;\n` }
    : library.name === collection ? { name: library.name, text: "declare const collectionReplaced: 1;\n" } : library);
  const visible = projectSnapshot({ sourceFiles: { "main.mts": "export const a: number = capturedOnlyMarker;\nexport const b: 1 = collectionReplaced;\n" }, libraries });
  assert.deepEqual(sessionDiagnostics(visible), [], "both declarations exist only in the captured texts");
  assert.deepEqual(openAndCapture(visible).set.modules, snapshotModules(visible));
  const replaced = projectSnapshot({ sourceFiles: usesMap, libraries });
  assert.deepEqual(sessionDiagnostics(replaced), ["TS2585 /project/src/main.mts"], "the installed library of the same name declares Map; the captured one does not, and the captured one is what is checked");
});

test("caller defects of the extension table and of opening are refused as defects: a registration given twice, a root that names no module, a root package that is absent", () => {
  const libraries = bundled();
  const provider = declarationProvider("test.provider", "native:thing", "native.thing");
  assert.throws(() => checkerModule.createExtensionTable([providerRegistration("/provider-one", provider), providerRegistration("/provider-one", provider)]),
    { name: "TypeError", message: "front: a registration was given twice" });
  const semantics = moduleSpecifier => ({ reference: { package: packageOf("/semantics"), moduleSpecifier, exportId: "semantics", version: "1" },
    value: { kind: "semantics-module", value: { moduleSpecifier, exports: [] } } });
  const mixed = checkerModule.createExtensionTable([semantics("@test/one"), providerRegistration("/provider-one", provider), semantics("@test/two")]);
  assert.deepEqual(checkerModule.extensionReferences(mixed).map(entry => entry.kind), ["semantics-module", "declaration-provider", "semantics-module"],
    "the reference view is the registrations in their order");
  const table = checkerModule.createExtensionTable([]);
  const noModule = projectSnapshot({ sourceFiles: plainSources, libraries });
  noModule.roots = [moduleOf(packageOf("/project"), "src/absent.mts")];
  assert.throws(() => front.openCheckedProgram({ extensions: table, navigationCapture }, noModule, preparation),
    { name: "TypeError", message: "front: a root or bundled library of the snapshot names no module of the snapshot" });
  const noRoot = projectSnapshot({ sourceFiles: plainSources, libraries });
  noRoot.packages.rootPackage = packageOf("/absent");
  assert.throws(() => front.openCheckedProgram({ extensions: table, navigationCapture }, noRoot, preparation),
    { name: "TypeError", message: "front: the snapshot's root package is not among its packages" });
  const twiceRooted = projectSnapshot({ sourceFiles: plainSources, libraries });
  twiceRooted.contributions.declarationFiles = ["/project/src/util.mts"];
  assert.equal(openAndCapture(twiceRooted).set.modules.length, 2 + libraries.length, "a file that is a root twice over is one root");
});

test("PENDING the checker's message accessor: a session-level diagnostic stops the open as a defect that names the codes, not yet as a refusal with the diagnostic converted", () => {
  const snapshot = projectSnapshot({ sourceFiles: plainSources, libraries: [] });
  assert.throws(() => front.openCheckedProgram({ extensions: checkerModule.createExtensionTable([]), navigationCapture }, snapshot, preparation),
    { name: "TypeError", message: "front: the session reported diagnostics that name no file (TS2318); the refusal that carries them waits for the checker's message accessor" });
  const sourceFiles = { "main.mts": "import { Value } from \"native:thing\";\nexport const v: number = Value;\n" };
  const overlapping = [providerRegistration("/provider-one", declarationProvider("test.provider.one", "native:thing", "native.thing")),
    providerRegistration("/provider-two", declarationProvider("test.provider.two", "native:other", "native.other"))];
  const withProviders = projectSnapshot({ sourceFiles, libraries: bundled(), providerPackages: [{ root: "/provider-one", name: "one" }, { root: "/provider-two", name: "two" }],
    declarationProviders: overlapping.map(entry => entry.reference) });
  assert.throws(() => front.openCheckedProgram({ extensions: checkerModule.createExtensionTable(overlapping), navigationCapture }, withProviders, preparation),
    { name: "TypeError", message: "front: the session reported diagnostics that name no file (tsts.extension-host:DIAGNOSTIC_RANGE_INVALID); the refusal that carries them waits for the checker's message accessor" },
    "an extension-host diagnostic with no site (two providers with one diagnostic range) is session-level in the same way");
  const twice = [providerRegistration("/provider-one", declarationProvider("test.provider", "native:thing", "native.thing")),
    providerRegistration("/provider-two", declarationProvider("test.provider", "native:elsewhere", "native.elsewhere", 9_900_100))];
  const sameProvider = projectSnapshot({ sourceFiles, libraries: bundled(), providerPackages: [{ root: "/provider-one", name: "one" }, { root: "/provider-two", name: "two" }],
    declarationProviders: twice.map(entry => entry.reference) });
  assert.throws(() => front.openCheckedProgram({ extensions: checkerModule.createExtensionTable(twice), navigationCapture }, sameProvider, preparation),
    { name: "TypeError", message: "front: the session reported diagnostics that name no file (tsts.extension-host:DUPLICATE_EXTENSION_ID); the refusal that carries them waits for the checker's message accessor" },
    "two registrations of one provider identity do not open a program, so a session document never has two candidate registrations");
});

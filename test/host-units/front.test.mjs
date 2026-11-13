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

const identityKinds = new Set(["SourceFile", "FunctionDeclaration", "ClassDeclaration", "InterfaceDeclaration", "TypeAliasDeclaration", "EnumDeclaration",
  "EnumMember", "ModuleDeclaration", "VariableDeclaration", "BindingElement", "Parameter", "TypeParameter", "PropertyDeclaration", "MethodDeclaration",
  "GetAccessor", "SetAccessor", "Constructor", "ClassStaticBlockDeclaration", "PropertySignature", "MethodSignature", "CallSignature",
  "ConstructSignature", "IndexSignature", "FunctionExpression", "ArrowFunction", "ClassExpression", "ExportAssignment", "NamespaceExport"]);

test("K-3236: the authored identity inputs obey the law they state: kinds of F-1, owners before members, ordinals counted across kinds per owner and name", () => {
  const { cases } = JSON.parse(readFileSync(resolve(repository, "test/host-units/fixtures/front/identity-cases.json"), "utf8"));
  assert.deepEqual(cases.map(entry => entry.name), ["type-then-value", "value-then-type", "type-and-value-uses", "overloads", "function-with-namespace",
    "class-with-interface", "unnamed-class-members", "unnamed-signatures", "augmentation-and-reexport", "default-expression", "default-declarations",
    "external-export-equals", "authored-export-equals", "locals-in-blocks", "augmentation-before-original", "merged-class-interface-uses",
    "default-expression-order", "expression-owners", "accessors-and-static", "same-kind-merges", "enum-and-type-parameters", "binding-elements",
    "member-name-sources", "module-declaration-forms", "renamed-reexports", "object-literal-members"]);
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

test("the identity inputs agree with the parser: the declaration nodes the checker's parser finds in each source are the rows, kind by kind in preorder; each row's owner is the nearest enclosing node that has a row; each row's name is the name its node gives it", () => {
  const { cases } = JSON.parse(readFileSync(resolve(repository, "test/host-units/fixtures/front/identity-cases.json"), "utf8"));
  const expressions = new Set(["FunctionExpression", "ArrowFunction", "ClassExpression"]);
  const holdsNoIdentity = new Set(["VariableDeclaration", "BindingElement"]);
  const unnamed = new Set(["Constructor", "ClassStaticBlockDeclaration", "CallSignature", "ConstructSignature", "IndexSignature"]);
  let compared = 0;
  let otherwiseNamed = 0;
  for (const entry of cases) {
    const parsed = parseSources(new Map(Object.entries(entry.files).map(([path, text]) => [path.slice(1), text])));
    const { ast } = parsed;
    for (const [path, rows] of Object.entries(entry.definitions ?? {})) {
      const file = parsed.getSourceFiles().find(candidate => ast.getFileName(candidate) === `/host-gate${path}`);
      assert.notEqual(file, undefined, `${entry.name}: ${path} is parsed`);
      const queries = parsed.getSourceFileQueries(file);
      // The name a node gives its row, by F-1's name sources: an identifier or private name as written; a string or numeric name by its
      // text; a computed name by the constant key the checker resolved; no name for a constructor, static block, signature, expression
      // or pattern holder; the export name for an anonymous default declaration and for an export assignment.
      const nameOf = (node, kind) => {
        if (expressions.has(kind) || unnamed.has(kind)) return "";
        if (kind === "ExportAssignment") return /^export\s*=/u.test(ast.getSourceText(file).slice(ast.pos(node), ast.end(node)).trim()) ? "export=" : "default";
        const name = ast.name(node);
        if (name === undefined) return "default";
        if (ast.is.IsIdentifier(name)) return ast.text(name);
        if (ast.is.IsPrivateIdentifier(name) || ast.is.IsStringLiteral(name) || ast.is.IsNumericLiteral(name)) {
          otherwiseNamed += 1;
          return ast.text(name);
        }
        if (ast.is.IsComputedPropertyName(name)) {
          otherwiseNamed += 1;
          const expression = ast.as.AsComputedPropertyName(name).Expression;
          return ast.is.IsStringLiteral(expression) || ast.is.IsNumericLiteral(expression) ? ast.text(expression)
            : queries.typeShape.getStringLiteralTypeValue(queries.checker.getTypeAtLocation(expression));
        }
        return "";
      };
      const found = [];
      const visit = (node, owner) => {
        const kind = ast.kindName(node).replace(/^Kind/u, "");
        const name = identityKinds.has(kind) && kind !== "SourceFile" ? ast.name(node) : undefined;
        const holdsPattern = name !== undefined && !ast.is.IsIdentifier(name) && (holdsNoIdentity.has(kind) || kind === "Parameter");
        let inner = owner;
        // K-3268 items 1 and 2: a variable declaration or binding element that holds a pattern has no identity; a parameter that holds one has.
        if (identityKinds.has(kind) && !(holdsPattern && holdsNoIdentity.has(kind))) {
          found.push({ kind, name: kind === "SourceFile" ? null : nameOf(node, kind), owner });
          inner = found.length - 1;
        }
        // The fixture's stated reading of K-3268 item 1: the names a pattern-holding parameter binds stand in the parameter's own owner's
        // ordinal space, so its pattern is walked under that owner; everything else of the parameter is under the parameter.
        ast.forEachChild(node, child => { if (child !== undefined) visit(child, holdsPattern && kind === "Parameter" && child === name ? owner : inner); });
      };
      visit(file, null);
      assert.deepEqual(rows.map(row => row.kind), found.map(node => node.kind), `${entry.name}: ${path}: one row per declaration node, in preorder`);
      rows.forEach((row, index) => {
        const node = found[index];
        if (node.owner === null) return assert.deepEqual(row.path, [], `${entry.name}: ${path}: the module's own row`);
        assert.equal(row.path.at(-1)[0], node.name, `${entry.name}: ${path}: the name of row ${index} (${row.kind})`);
        assert.deepEqual(row.path.slice(0, -1), rows[node.owner].path, `${entry.name}: ${path}: the owner of row ${index} (${row.kind} ${JSON.stringify(row.path)})`);
      });
      compared += rows.length;
    }
  }
  assert.equal(compared > 200, true, "the comparison ran over the rows of every case");
  assert.equal(otherwiseNamed, 8, "the rows named by something other than an identifier are compared too: three string-named modules, a private name, two computed names, a numeric and a quoted member name");
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
function projectSnapshot({ sourceFiles, libraries, providerPackages = [], declarationProviders = [], compilerExtensions = [], requiredProviderModules = [],
  otherPackages = [], extraFiles = {}, installedDeclarations = "none" }) {
  const project = packageOf("/project");
  const checker = packageOf("/checker");
  const packages = [
    { id: project, name: null, version: null, packageRoot: "/project", sourceRoot: "/project/src", manifestPath: null, dependencies: [], exports: [], pluginEntry: null, libraryEntry: null },
    { id: checker, name: "checker-libraries", version: "1.0.0", packageRoot: "/checker", sourceRoot: "/checker", manifestPath: "/checker/package.json", dependencies: [], exports: [], pluginEntry: null, libraryEntry: null },
    ...providerPackages.map(entry => ({ id: packageOf(entry.root), name: entry.name, version: "1.0.0", packageRoot: entry.root, sourceRoot: entry.root,
      manifestPath: `${entry.root}/package.json`, dependencies: [], exports: [], pluginEntry: `${entry.root}/plugin.js`, libraryEntry: null })),
    ...otherPackages.map(entry => ({ id: packageOf(entry.root), name: entry.name, version: "1.0.0", packageRoot: entry.root, sourceRoot: entry.root,
      manifestPath: `${entry.root}/package.json`, dependencies: [], exports: [], pluginEntry: null, libraryEntry: null })),
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
  const otherRoots = [];
  for (const entry of otherPackages) {
    for (const [name, [role, text, rooted]] of Object.entries(entry.modules)) {
      modules.push({ id: moduleOf(packageOf(entry.root), name), package: packageOf(entry.root), path: `${entry.root}/${name}`, role });
      files.push({ kind: "physical", path: `${entry.root}/${name}`, realPath: `${entry.root}/${name}`, text });
      if (rooted === true) otherRoots.push(moduleOf(packageOf(entry.root), name));
    }
  }
  for (const [path, text] of Object.entries(extraFiles)) files.push({ kind: "physical", path, realPath: path, text });
  modules.sort(byId);
  files.sort((left, right) => left.path < right.path ? -1 : 1);
  return {
    packages: { fingerprint: "captured", rootPackage: project, packages, modules, files, libraryData: [],
      components: packages.map(entry => ({ representative: entry.id, packages: [entry.id], dependencies: [] })) },
    entryPoint: moduleOf(project, `src/${Object.keys(sourceFiles)[0]}`),
    roots: [...Object.keys(sourceFiles).map(name => moduleOf(project, `src/${name}`)), ...otherRoots].sort(),
    selection: { target: { id: "native", surfaces: [], options: { kind: "record", fields: [] } }, providerId: "native-provider", capabilityIds: [], surfaceIds: [] },
    contributions: { declarationModules: [], declarationPolicy: { bundledLibraries: libraries.map(library => moduleOf(checker, library.name)).sort(), installedDeclarations },
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
  const deps = { extensions: front.createCheckerExtensions(registrations), navigationCapture };
  assert.deepEqual(snapshots.verifySnapshot(snapshot, front.extensionReferencesOf(deps.extensions)), [], "the case's snapshot is one the snapshot verifier accepts");
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
  assert.throws(() => front.captureProgramModules({ extensions: front.createCheckerExtensions([]), navigationCapture }, program),
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
    const deps = { extensions: front.createCheckerExtensions(registrations), navigationCapture };
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
  const deps = { extensions: front.createCheckerExtensions([]), navigationCapture };
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
 * The diagnostics of a session created from the inputs that Front computes for a snapshot (`sessionInputs`, the function
 * `openCheckedProgram` itself uses). Front has no operation yet that returns a file's diagnostics (`captureModule`), so these
 * cases read them from such a session; the module set is always read through Front.
 */
function sessionDiagnostics(snapshot) {
  const inputs = checkerModule.sessionInputs(snapshot);
  const session = sdk.createCompilerSessionFromFiles({ currentDirectory: inputs.currentDirectory, configFileName: inputs.configurationFile, files: inputs.files,
    rootFiles: inputs.rootFiles, compilerOptions: inputs.options, useCaseSensitiveFileNames: true });
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

// PENDING, with its exact dependency: SDK-1 (`prepareSourceImports`, absent from the vendored checker SDK). The rule that closes this
// case: every reference-lib row that the import preparation reports for a bundled library module of the declaration policy is resolved, and
// to a module of that same set; an open one is reported at the preparation boundary. Its other half is not pending: that every member of
// the set is a captured declaration-role module is the Snapshot verifier's rule bundled-library-declaration (snapshot unit file).
test("libraries, missing and unused, PENDING on SDK-1: the session itself reports nothing for a library reference that the captured set does not close", () => {
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
  assert.throws(() => front.openCheckedProgram({ extensions: front.createCheckerExtensions([]), navigationCapture }, onlyTop, preparation),
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
  assert.throws(() => front.createCheckerExtensions([providerRegistration("/provider-one", provider), providerRegistration("/provider-one", provider)]),
    { name: "TypeError", message: "front: a registration was given twice" });
  const semantics = moduleSpecifier => ({ reference: { package: packageOf("/semantics"), moduleSpecifier, exportId: "semantics", version: "1" },
    value: { kind: "semantics-module", value: { moduleSpecifier, exports: [] } } });
  const mixed = front.createCheckerExtensions([semantics("@test/one"), providerRegistration("/provider-one", provider), semantics("@test/two")]);
  assert.deepEqual(front.extensionReferencesOf(mixed).map(entry => entry.kind), ["semantics-module", "declaration-provider", "semantics-module"],
    "the reference view is the registrations in their order");
  const table = front.createCheckerExtensions([]);
  const noModule = projectSnapshot({ sourceFiles: plainSources, libraries });
  noModule.roots = [moduleOf(packageOf("/project"), "src/absent.mts")];
  assert.throws(() => front.openCheckedProgram({ extensions: table, navigationCapture }, noModule, preparation),
    { name: "TypeError", message: "front: a root, contributed declaration or bundled library of the snapshot names no module of the snapshot" });
  const noRoot = projectSnapshot({ sourceFiles: plainSources, libraries });
  noRoot.packages.rootPackage = packageOf("/absent");
  assert.throws(() => front.openCheckedProgram({ extensions: table, navigationCapture }, noRoot, preparation),
    { name: "TypeError", message: "front: the snapshot's root package is not among its packages" });
  const twiceRooted = projectSnapshot({ sourceFiles: plainSources, libraries });
  twiceRooted.contributions.declarationModules = [twiceRooted.contributions.declarationPolicy.bundledLibraries[0]];
  assert.equal(openAndCapture(twiceRooted).set.modules.length, 2 + libraries.length, "a module that is a root twice over (a bundled library that is also contributed) is one root");
});

test("PENDING the checker's message accessor: a session-level diagnostic stops the open as a defect that names the codes, not yet as a refusal with the diagnostic converted", () => {
  const snapshot = projectSnapshot({ sourceFiles: plainSources, libraries: [] });
  assert.throws(() => front.openCheckedProgram({ extensions: front.createCheckerExtensions([]), navigationCapture }, snapshot, preparation),
    { name: "TypeError", message: "front: the session reported diagnostics that name no file (TS2318); the refusal that carries them waits for the checker's message accessor" });
  const sourceFiles = { "main.mts": "import { Value } from \"native:thing\";\nexport const v: number = Value;\n" };
  const overlapping = [providerRegistration("/provider-one", declarationProvider("test.provider.one", "native:thing", "native.thing")),
    providerRegistration("/provider-two", declarationProvider("test.provider.two", "native:other", "native.other"))];
  const withProviders = projectSnapshot({ sourceFiles, libraries: bundled(), providerPackages: [{ root: "/provider-one", name: "one" }, { root: "/provider-two", name: "two" }],
    declarationProviders: overlapping.map(entry => entry.reference) });
  assert.throws(() => front.openCheckedProgram({ extensions: front.createCheckerExtensions(overlapping), navigationCapture }, withProviders, preparation),
    { name: "TypeError", message: "front: the session reported diagnostics that name no file (tsts.extension-host:DIAGNOSTIC_RANGE_INVALID); the refusal that carries them waits for the checker's message accessor" },
    "an extension-host diagnostic with no site (two providers with one diagnostic range) is session-level in the same way");
  const twice = [providerRegistration("/provider-one", declarationProvider("test.provider", "native:thing", "native.thing")),
    providerRegistration("/provider-two", declarationProvider("test.provider", "native:elsewhere", "native.elsewhere", 9_900_100))];
  const sameProvider = projectSnapshot({ sourceFiles, libraries: bundled(), providerPackages: [{ root: "/provider-one", name: "one" }, { root: "/provider-two", name: "two" }],
    declarationProviders: twice.map(entry => entry.reference) });
  assert.throws(() => front.openCheckedProgram({ extensions: front.createCheckerExtensions(twice), navigationCapture }, sameProvider, preparation),
    { name: "TypeError", message: "front: the session reported diagnostics that name no file (tsts.extension-host:DUPLICATE_EXTENSION_ID); the refusal that carries them waits for the checker's message accessor" },
    "two registrations of one provider identity do not open a program, so a session document never has two candidate registrations");
});

const optionRecord = (policy, changes = {}) => ({ ...Object.fromEntries(optionModule.optionSet(policy).map(option => [option.name, option.value])), ...changes });
const tableNames = ["module", "moduleResolution", "target", "strict", "noEmit", "noLib", "allowImportingTsExtensions", "allowArbitraryExtensions",
  "types", "skipLibCheck", "noUncheckedIndexedAccess", "exactOptionalPropertyTypes", "useDefineForClassFields", "esModuleInterop",
  "resolveJsonModule", "allowJs"];

/** A real session on the given files with the captured libraries as roots, under the whole option set with the given changes. */
function checkedUnder(files, { policy = "none", changes = {}, libraries = bundled(), roots = [Object.keys(files)[0]] } = {}) {
  const supplied = new Map([...Object.entries(files), ...libraries.map(library => [`/checker/${library.name}`, library.text])]);
  const compilerSession = sdk.createCompilerSessionFromFiles({ currentDirectory: "/project", files: supplied,
    rootFiles: [...roots, ...libraries.map(library => `/checker/${library.name}`)], compilerOptions: optionRecord(policy, changes), useCaseSensitiveFileNames: true });
  const checked = compilerSession.checkSource();
  const names = checked.getSourceFiles().map(file => checked.ast.getFileName(file));
  return { diagnostics: [...new Set(compilerSession.getDiagnostics("all").map(diagnostic =>
      `TS${diagnostic.code} ${diagnostic.file === undefined ? "(no file)" : checked.ast.getFileName(diagnostic.file)}`))].sort(),
    notSupplied: names.filter(name => !supplied.has(name)).length,
    files: names.filter(name => !name.startsWith("/checker/")).sort() };
}
const main = "/project/src/main.mts";
const utility = { "/project/src/util.mts": "export function twice(value: number): number { return value * 2; }\n" };

test("the option table is written once: sixteen rows, each named once with its reason; the set has one entry per row in the table's order, and the declaration policy changes one entry", () => {
  assert.deepEqual(optionModule.optionTable.map(row => row.name), tableNames);
  assert.equal(new Set(tableNames).size, tableNames.length);
  for (const row of optionModule.optionTable) assert.equal(row.reason.length > 20, true, row.name);
  const constant = { module: "nodenext", moduleResolution: "nodenext", target: "es2024", strict: true, noEmit: true, noLib: true, allowImportingTsExtensions: true,
    allowArbitraryExtensions: true, skipLibCheck: false, noUncheckedIndexedAccess: false, exactOptionalPropertyTypes: false,
    useDefineForClassFields: true, esModuleInterop: true, resolveJsonModule: false, allowJs: false };
  for (const [policy, types] of [["package-contract", ["*"]], ["none", []]]) {
    assert.deepEqual(optionModule.optionSet(policy).map(option => option.name), tableNames, policy);
    assert.deepEqual(optionRecord(policy), { ...constant, types }, policy);
  }
});

test("F-7: the real checker accepts the whole option set, and a name it does not know is a diagnostic of the session's configuration, which Front treats as session-level", () => {
  const files = { [main]: "import { twice } from \"./util.mjs\";\nexport const xs: number[] = [twice(1)];\nexport const m = new Map<string, number>();\n", ...utility };
  for (const policy of ["none", "package-contract"]) {
    assert.deepEqual(checkedUnder(files, { policy }), { diagnostics: [], notSupplied: 0, files: [main, "/project/src/util.mts"] }, policy);
  }
  assert.deepEqual(checkedUnder(files, { changes: { noUncheckedIndexAccess: true } }).diagnostics, ["TS5023 /project/tsconfig.json"],
    "so the empty list above states that every name of the table is an option of this checker");
});

// For each row: one program, its checked result under the table, and under the opposite value of that row alone.
const rowCases = [
  { row: "module", opposite: "esnext", files: { [main]: "import { twice } from \"./util\";\nexport const t = twice(1);\n", ...utility },
    table: ["TS2835 /project/src/main.mts"], other: ["TS2835 /project/src/main.mts", "TS5110 /project/tsconfig.json"] },
  { row: "moduleResolution", opposite: "bundler", files: { [main]: "import { twice } from \"./util\";\nexport const t = twice(1);\n", ...utility },
    table: ["TS2835 /project/src/main.mts"], other: ["TS2307 /project/src/main.mts", "TS5095 /project/tsconfig.json", "TS5109 /project/tsconfig.json"] },
  { row: "target", opposite: "es2019", files: { [main]: "export const big = 1n;\n" }, table: [], other: ["TS2737 /project/src/main.mts"] },
  { row: "strict", opposite: false, files: { [main]: "export const n: number = null;\n" }, table: ["TS2322 /project/src/main.mts"], other: [] },
  { row: "noEmit", opposite: false, files: { [main]: "export const n: number = 1;\n" }, table: [], other: ["TS5096 /project/tsconfig.json"] },
  { row: "noLib", opposite: false, files: { [main]: "export const m = new Map<string, number>();\n" }, libraries: [],
    table: ["TS2318 (no file)", "TS2583 /project/src/main.mts"], other: [], otherReadsInstalledLibraries: true },
  { row: "allowImportingTsExtensions", opposite: false, files: { [main]: "import { twice } from \"./util.mts\";\nexport const t = twice(1);\n", ...utility },
    table: [], other: ["TS5097 /project/src/main.mts"] },
  { row: "allowArbitraryExtensions", opposite: false,
    files: { [main]: "import { sheet } from \"./a.css\";\nexport const d: string = sheet;\n", "/project/src/a.d.css.ts": "export declare const sheet: string;\n" },
    table: [], other: ["TS6263 /project/src/main.mts"] },
  { row: "skipLibCheck", opposite: true,
    files: { [main]: "import { x } from \"./bad.mjs\";\nexport const y = x;\n", "/project/src/bad.d.mts": "export declare const x: Missing;\n" },
    table: ["TS2304 /project/src/bad.d.mts"], other: [] },
  { row: "noUncheckedIndexedAccess", opposite: true, files: { [main]: "const xs: number[] = [1];\nexport const n: number = xs[0];\n" },
    table: [], other: ["TS2322 /project/src/main.mts"] },
  { row: "exactOptionalPropertyTypes", opposite: true, files: { [main]: "interface P { x?: number }\nexport const p: P = { x: undefined };\n" },
    table: [], other: ["TS2375 /project/src/main.mts"] },
  { row: "useDefineForClassFields", opposite: false, files: { [main]: "class A { x: number = 1; }\nexport class B extends A { x!: number; }\n" },
    table: ["TS2612 /project/src/main.mts"], other: [] },
  { row: "esModuleInterop", opposite: false,
    files: { [main]: "import { n } from \"./a.cjs\";\nexport const m = n;\n", "/project/src/a.d.cts": "import v from \"./lib.cjs\";\nexport declare const n: typeof v;\n",
      "/project/src/lib.d.cts": "declare const v: { n: number };\nexport = v;\n" },
    table: [], other: ["TS5108 /project/tsconfig.json"] },
  { row: "resolveJsonModule", opposite: true,
    files: { [main]: "import data from \"./data.json\" with { type: \"json\" };\nexport const d = data;\n", "/project/src/data.json": "{ \"a\": 1 }\n" },
    table: ["TS2732 /project/src/main.mts"], other: [], otherFiles: ["/project/src/data.json", main] },
  { row: "allowJs", opposite: true, files: { [main]: "import { j } from \"./j.mjs\";\nexport const k = j;\n", "/project/src/j.mjs": "export const j = 1;\n" },
    table: ["TS7016 /project/src/main.mts"], other: [], otherFiles: ["/project/src/j.mjs", main] },
];

test("each constant row decides a checked result: one program per row, checked under the whole table and under the opposite value of that row alone", () => {
  assert.deepEqual(rowCases.map(entry => entry.row), tableNames.filter(name => name !== "types"), "every constant row has its program; the types row has its own case");
  for (const entry of rowCases) {
    const libraries = entry.libraries ?? bundled();
    const underTable = checkedUnder(entry.files, { libraries });
    const underOpposite = checkedUnder(entry.files, { libraries, changes: { [entry.row]: entry.opposite } });
    assert.deepEqual(underTable.diagnostics, entry.table, `${entry.row}: under the table`);
    assert.equal(underTable.notSupplied, 0, `${entry.row}: under the table every program file is a supplied file`);
    assert.deepEqual(underOpposite.diagnostics, entry.other, `${entry.row}: under ${JSON.stringify(entry.opposite)}`);
    assert.equal(underOpposite.notSupplied > 0, entry.otherReadsInstalledLibraries === true, `${entry.row}: whether the opposite reads the installed checker's libraries`);
    if (entry.otherFiles !== undefined) assert.deepEqual(underOpposite.files, entry.otherFiles, `${entry.row}: the opposite admits a further program file`);
    assert.notEqual(JSON.stringify(underTable), JSON.stringify(underOpposite), `${entry.row}: the two values give different checked results`);
  }
});

const ambientPackage = { root: "/project/node_modules/@types/thing", name: "@types/thing", modules: { "index.d.ts": ["declaration", "declare const thingGlobal: number;\n"] } };

test("the types row: under package-contract an installed declaration package that the snapshot captured is ambient without an import; under none it is not; either way only captured files are program files", () => {
  const sourceFiles = { "main.mts": "export const g: number = thingGlobal;\n" };
  const ambient = moduleOf(packageOf(ambientPackage.root), "index.d.ts");
  const admitted = projectSnapshot({ sourceFiles, libraries: bundled(), otherPackages: [ambientPackage], installedDeclarations: "package-contract" });
  assert.deepEqual(sessionDiagnostics(admitted), []);
  const admittedSet = openAndCapture(admitted).set.modules;
  assert.deepEqual(admittedSet, snapshotModules(admitted), "the captured package's declaration file is a program module");
  assert.equal(admittedSet.some(entry => entry.module === ambient), true);
  const suppressed = projectSnapshot({ sourceFiles, libraries: bundled(), otherPackages: [ambientPackage], installedDeclarations: "none" });
  assert.deepEqual(sessionDiagnostics(suppressed), ["TS2304 /project/src/main.mts"]);
  assert.equal(openAndCapture(suppressed).set.modules.some(entry => entry.module === ambient), false, "captured, but not a file of the program");
  const absent = projectSnapshot({ sourceFiles, libraries: bundled(), installedDeclarations: "package-contract" });
  assert.deepEqual(sessionDiagnostics(absent), ["TS2304 /project/src/main.mts"], "the wildcard reaches what the snapshot captured and nothing else");
  assert.deepEqual(openAndCapture(absent).set.modules, snapshotModules(absent));
});

test("a source module of a second captured package is checked like any other: no option of the table restricts where sources stand", () => {
  const second = { root: "/dep", name: "dep", modules: { "src/x.mts": ["source", "export const dep: number = 1;\n", true] } };
  const snapshot = projectSnapshot({ sourceFiles: { "main.mts": "import { dep } from \"../../dep/src/x.mjs\";\nexport const d: number = dep;\n" }, libraries: bundled(), otherPackages: [second] });
  assert.deepEqual(sessionDiagnostics(snapshot), []);
  assert.deepEqual(openAndCapture(snapshot).set.modules, snapshotModules(snapshot));
  const files = { [main]: "import { dep } from \"../../dep/src/x.mjs\";\nexport const d: number = dep;\n", "/dep/src/x.mts": "export const dep: number = 1;\n" };
  assert.deepEqual(checkedUnder(files, { roots: [main, "/dep/src/x.mts"], changes: { rootDir: "/project" } }).diagnostics, ["TS6059 /project/src/main.mts"],
    "the opposite: with an emission root the checker refuses the second package's source, which is why the table has no such row");
});

test("the session's configuration is Front's: a configuration file captured at the project root is not a file of the session and changes nothing", () => {
  const sourceFiles = { "main.mts": "export const n: number = null;\n" };
  const projectConfiguration = "{ \"compilerOptions\": { \"strict\": false, \"noLib\": false }, \"files\": [\"src/main.mts\"] }\n";
  const snapshot = projectSnapshot({ sourceFiles, libraries: bundled(),
    extraFiles: { "/project/tsconfig.json": projectConfiguration, "/project/src/tsconfig.json": "{ \"compilerOptions\": { \"strict\": false } }\n" } });
  const inputs = checkerModule.sessionInputs(snapshot);
  assert.equal(inputs.configurationFile, "/project/tsconfig.json");
  assert.equal(inputs.files.has("/project/tsconfig.json"), false);
  assert.equal(inputs.files.has("/project/src/tsconfig.json"), true, "every other captured file is a file of the session");
  assert.deepEqual(sessionDiagnostics(snapshot), ["TS2322 /project/src/main.mts"], "strict, from the table");
  assert.deepEqual(openAndCapture(snapshot).set.modules, snapshotModules(snapshot), "and no library of the installed checker is a program file");
  const given = checkedUnder({ [main]: sourceFiles["main.mts"], "/project/tsconfig.json": projectConfiguration });
  assert.deepEqual({ diagnostics: given.diagnostics, readsInstalledLibraries: given.notSupplied > 0 }, { diagnostics: [], readsInstalledLibraries: true },
    "the opposite: a session that is given the project's file takes its options from it, not from the table");
});

test("a module is its captured path: one text captured under two paths is two modules with distinct identities, and link preservation is no option of the table", () => {
  assert.equal(tableNames.includes("preserveSymlinks"), false);
  const text = "export const copy: number = 1;\n";
  const snapshot = projectSnapshot({ sourceFiles: { "main.mts": "import { copy as a } from \"../../copy-a/x.mjs\";\nimport { copy as b } from \"../../copy-b/x.mjs\";\nexport const sum: number = a + b;\n" },
    libraries: bundled(), otherPackages: [{ root: "/copy-a", name: "copy-a", modules: { "x.mts": ["source", text, true] } }, { root: "/copy-b", name: "copy-b", modules: { "x.mts": ["source", text, true] } }] });
  snapshot.packages.files.find(file => file.path === "/copy-b/x.mts").realPath = "/copy-a/x.mts";
  const { set } = openAndCapture(snapshot);
  assert.deepEqual(set.modules, snapshotModules(snapshot));
  const copies = [moduleOf(packageOf("/copy-a"), "x.mts"), moduleOf(packageOf("/copy-b"), "x.mts")];
  assert.notEqual(copies[0], copies[1]);
  for (const copy of copies) assert.equal(set.modules.filter(entry => entry.module === copy).length, 1);
  assert.deepEqual(sessionDiagnostics(snapshot), []);
});

test("a contributed declaration module is a root of the program: its declarations are visible without an import, and it is a program module", () => {
  const contributed = { root: "/contributed", name: "contributed", modules: { "globals.d.ts": ["declaration", "declare const contributedGlobal: number;\n"] } };
  const identity = moduleOf(packageOf("/contributed"), "globals.d.ts");
  const sourceFiles = { "main.mts": "export const g: number = contributedGlobal;\n" };
  const captured = projectSnapshot({ sourceFiles, libraries: bundled(), otherPackages: [contributed] });
  assert.deepEqual(sessionDiagnostics(captured), ["TS2304 /project/src/main.mts"], "captured and not contributed: not a file of the program");
  assert.equal(openAndCapture(captured).set.modules.some(entry => entry.module === identity), false);
  const rooted = projectSnapshot({ sourceFiles, libraries: bundled(), otherPackages: [contributed] });
  rooted.contributions.declarationModules = [identity];
  assert.deepEqual(sessionDiagnostics(rooted), []);
  assert.deepEqual(openAndCapture(rooted).set.modules, snapshotModules(rooted));
  const unknown = projectSnapshot({ sourceFiles, libraries: bundled() });
  unknown.contributions.declarationModules = [identity];
  assert.deepEqual(snapshots.verifySnapshot(unknown, []).map(violation => violation.rule), ["contributed-declaration-module"], "the Snapshot verifier refuses it");
  assert.throws(() => front.openCheckedProgram({ extensions: front.createCheckerExtensions([]), navigationCapture }, unknown, preparation),
    { name: "TypeError", message: "front: a root, contributed declaration or bundled library of the snapshot names no module of the snapshot" });
});

// The program R2 named for the provider join. Its outcome was derived before it was run (package W5-7 part A): one identity names one
// provider in a session, so the open cannot succeed, whoever registers the second provider. The join of a session document therefore never
// has two candidates of one identity; what stays pending on W3's registrar is the provider that an initializer registers under its own identity.
test("two providers of one identity never open a program: an extension initializer that registers a provider under the identity of a directly loaded registration is refused by the session", () => {
  const libraries = bundled();
  const sourceFiles = { "main.mts": "import { Value } from \"native:thing\";\nimport { Value as Other } from \"native:elsewhere\";\nexport const v: number = Value + Other;\n" };
  const direct = providerRegistration("/provider-one", declarationProvider("test.provider", "native:thing", "native.thing"));
  const inner = declarationProvider("test.provider", "native:elsewhere", "native.elsewhere", 9_900_200);
  const viaInitializer = { reference: reference("/provider-two", "extension"), value: { kind: "compiler-extension",
    value: { identity: { id: "test.registers.under.a.loaded.identity", version: "1.0.0" }, initialize: context => { context.registerSourceDeclarationProvider(inner); } } } };
  const snapshot = projectSnapshot({ sourceFiles, libraries, providerPackages: [{ root: "/provider-one", name: "one" }, { root: "/provider-two", name: "two" }],
    declarationProviders: [direct.reference], compilerExtensions: [viaInitializer.reference] });
  const deps = { extensions: front.createCheckerExtensions([direct, viaInitializer]), navigationCapture };
  assert.deepEqual(snapshots.verifySnapshot(snapshot, front.extensionReferencesOf(deps.extensions)), []);
  const open = () => front.openCheckedProgram(deps, snapshot, preparation);
  assert.throws(open, error => error instanceof TypeError && error.message.startsWith("front: the session reported diagnostics that name no file (tsts.extension-host:"),
    "derived: the session reports a session-level diagnostic of the extension host and no program is opened");
  assert.throws(open, { name: "TypeError", message: "front: the session reported diagnostics that name no file (tsts.extension-host:DUPLICATE_SOURCE_DECLARATION_PROVIDER); the refusal that carries them waits for the checker's message accessor" },
    "recorded observation: the extension host's code for a second provider of one identity");
});

import assert from "node:assert/strict";
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { Session } from "node:inspector";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { after, before, test } from "node:test";
import { checkCoverage } from "../architecture/host/coverage.mjs";
import { parseSources } from "../architecture/host/import-graph.mjs";

const repository = fileURLToPath(new URL("../../", import.meta.url));
const runtimeFiles = ["index.js", "options.js"].map(name => resolve(repository, "packages/host/dist/front", name));
const session = new Session();
const post = (method, parameters = {}) => new Promise((done, reject) => {
  session.post(method, parameters, (error, result) => error === null ? done(result) : reject(error));
});
let front;
let sdk;

before(async () => {
  assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined, true, "front tests run under the aggregate resource guard");
  session.connect();
  await post("Debugger.enable");
  await post("Profiler.enable");
  await post("Profiler.startPreciseCoverage", { callCount: true, detailed: true });
  front = await import("../../packages/host/dist/front/index.js");
  sdk = await import("../../packages/tsts/dist/src/index.js");
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
  const names = front.checkerOptionTable.map(row => row.name);
  assert.deepEqual(names, ["module", "moduleResolution", "target", "strict", "noEmit", "noLib", "allowImportingTsExtensions",
    "allowArbitraryExtensions", "preserveSymlinks", "rootDir", "types"]);
  assert.equal(new Set(names).size, names.length);
  for (const row of front.checkerOptionTable) assert.equal(row.reason.length > 20, true, row.name);
  assert.deepEqual(front.checkerOptions({ projectRoot: "/project", installedDeclarations: "package-contract" }), {
    module: "nodenext", moduleResolution: "nodenext", target: "es2024", strict: true, noEmit: true, noLib: true,
    allowImportingTsExtensions: true, allowArbitraryExtensions: true, preserveSymlinks: true, rootDir: "/project", types: ["*"] });
  assert.deepEqual(front.checkerOptions({ projectRoot: "/other/root", installedDeclarations: "none" }), {
    module: "nodenext", moduleResolution: "nodenext", target: "es2024", strict: true, noEmit: true, noLib: true,
    allowImportingTsExtensions: true, allowArbitraryExtensions: true, preserveSymlinks: true, rootDir: "/other/root", types: [] });
});

test("F-7: the real checker opens a session on the whole option set with no diagnostic, on library texts supplied as files and on no other", () => {
  const libraries = sdk.getBundledLibraryClosure(["lib.es2024.d.ts"]);
  assert.equal(libraries.length > 10, true, "the stand-in for a snapshot's bundled libraries is a real closed set");
  const bundledPath = sdk.getBundledLibraryPath();
  for (const installedDeclarations of ["none", "package-contract"]) {
    const opened = open(front.checkerOptions({ projectRoot: "/project", installedDeclarations }), libraries);
    assert.deepEqual(opened.counts, clean, installedDeclarations);
    assert.equal(opened.files.length, 2 + libraries.length);
    assert.deepEqual(opened.files.filter(name => name.startsWith(bundledPath)), [], "nothing is read from the libraries bundled with the installed SDK");
  }
  const options = front.checkerOptions({ projectRoot: "/project", installedDeclarations: "none" });
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

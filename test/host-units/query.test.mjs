import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import { Session } from "node:inspector";
import { basename, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { after, before, test } from "node:test";
import { runCase } from "../host-cases/case.mjs";
import { hostCatalogue } from "../architecture/host/catalogue.mjs";
import { checkCoverage } from "../architecture/host/coverage.mjs";
import { parseSources } from "../architecture/host/import-graph.mjs";
import { compileIsolated, isolationDeps } from "../architecture/host/isolation.mjs";

const repository = fileURLToPath(new URL("../../", import.meta.url));
const tooling = process.env.TSONIC_HOST_TOOLING_ROOT ?? repository;
const sourceFiles = ["contract.ts", "database.ts", "index.ts", "memo.ts"]
  .map(name => `packages/host/src/query/${name}`);
const runtimeFiles = ["database.js", "index.js", "memo.js"]
  .map(name => resolve(repository, "packages/host/dist/query", name));
const dependencyFiles = [
  "diag/contract.ts", "diag/index.ts", "diag/invariant.ts", "diag/order.ts",
  "ids/contract.ts", "ids/identity.ts", "ids/index.ts", "ids/key.ts",
].map(path => `packages/host/src/${path}`);
const interfaceFiles = ["diag/contract.ts", "diag/index.ts", "ids/contract.ts", "ids/index.ts"]
  .map(path => `packages/host/src/${path}`);
const caseDirectory = "test/host-cases/query/function";
const casePaths = readdirSync(resolve(repository, caseDirectory)).filter(name => name.endsWith(".case.json")).sort()
  .map(name => `${caseDirectory}/${name}`);
const areaData = JSON.parse(readFileSync(resolve(repository, "test/architecture/quarantine/areas.json"), "utf8"));
const quarantineRoots = areaData.areas.map(area => area.directory);
const session = new Session();
const post = (method, parameters = {}) => new Promise((done, reject) => {
  session.post(method, parameters, (error, result) => error === null ? done(result) : reject(error));
});
let product;

before(async () => {
  assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined, true, "the complete suite requires aggregate admission");
  session.connect();
  await post("Debugger.enable");
  await post("Profiler.enable");
  await post("Profiler.startPreciseCoverage", { callCount: true, detailed: true });
  product = await import("../../packages/host/dist/query/index.js");
});

test("query exposes exactly the one agreed public value", () => {
  assert.deepEqual(Object.keys(product), ["createDatabase"]);
});

test("an untouched database exposes its exact inputs and empty immutable snapshots without computing", () => {
  const inputs = Object.freeze({ root: "analysis", count: 0 });
  const database = product.createDatabase(inputs, { maxActiveDepth: 0 });
  assert.equal(database.inputs, inputs);
  const statistics = database.stats();
  const diagnostics = database.diagnostics();
  assert.deepEqual(statistics, []);
  assert.deepEqual(diagnostics, []);
  assert.equal(Object.isFrozen(statistics), true);
  assert.equal(Object.isFrozen(diagnostics), true);
  assert.deepEqual(database.stats(), []);
  assert.deepEqual(database.diagnostics(), []);
});

test("invalid depth maxima are caller defects, not a refusal, rounding or a hidden default", () => {
  for (const maxActiveDepth of [-1, -0.5, 0.5, NaN, Infinity, -Infinity]) {
    assert.throws(() => product.createDatabase(null, { maxActiveDepth }), {
      name: "TypeError", message: "query: maxActiveDepth must be a finite nonnegative integer",
    });
  }
  for (const maxActiveDepth of [0, -0, 1, 2, 9007199254740992, 1e21]) {
    const database = product.createDatabase(null, { maxActiveDepth });
    assert.equal(database.inputs, null);
    assert.deepEqual(database.stats(), []);
    assert.deepEqual(database.diagnostics(), []);
  }
});

test("construction retains arbitrary actual Inputs rather than encoding, copying or defaulting them", () => {
  const callable = () => "input";
  for (const inputs of [undefined, null, false, 0, -0, 1n, "", callable, Object.freeze({ value: false })]) {
    const database = product.createDatabase(inputs, { maxActiveDepth: 1 });
    assert.equal(database.inputs, inputs);
    assert.deepEqual(database.stats(), []);
    assert.deepEqual(database.diagnostics(), []);
  }
});

test("the actual four-file query owner compiles against fresh real dependency public declarations", async () => {
  const deps = isolationDeps(tooling, quarantineRoots);
  const module = hostCatalogue.find(module => module.name === "query");
  const report = await compileIsolated(deps, module, { root: repository, sourceFiles,
    interfaceSources: interfaceFiles, declarationSources: dependencyFiles, outputDirectory: ".temp/query-isolation" });
  writeFileSync(resolve(repository, ".temp/query-isolation-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  assert.equal(report.status, "passed", JSON.stringify(report.findings).slice(0, 4000));
  assert.equal(report.sourceInventory.length, 12);
  assert.equal(report.loadedInventory.length > 12, true, "the actual compiler language closure is nonempty");
  assert.equal(report.loadedInventory.every(path => report.expectedInventory.includes(path)), true);
});

test("fresh actual declarations retain construction, snapshots, readonly fields and private-entry rejection", () => {
  const deps = isolationDeps(tooling, quarantineRoots);
  const parent = resolve(repository, ".temp/query-consumers");
  mkdirSync(parent, { recursive: true });
  const stage = mkdtempSync(resolve(parent, "case-"));
  writeFileSync(resolve(stage, "package.json"), '{"type":"module","private":true}\n');
  for (const owner of ["query", "ids", "diag"]) {
    mkdirSync(resolve(stage, owner));
    for (const name of ["contract", "index"]) {
      copyFileSync(resolve(repository, `packages/host/dist/${owner}/${name}.d.ts`), resolve(stage, `${owner}/${name}.d.ts`));
    }
  }
  const positive = resolve(stage, "positive.mts");
  writeFileSync(positive, `import { createDatabase } from "./query/index.js";
import type { ActiveKey, CreateDatabase, Database, QueryLimits, QueryStat } from "./query/contract.js";
import type { Diagnostic } from "./diag/contract.js";
const create: CreateDatabase = createDatabase;
const limits: QueryLimits = { maxActiveDepth: 2 };
const database: Database<{ readonly name: string }> = create({ name: "actual" }, limits);
const inputs: { readonly name: string } = database.inputs;
const statistics: readonly QueryStat[] = database.stats();
const diagnostics: readonly Diagnostic[] = database.diagnostics();
const chain: readonly ActiveKey[] = [{ query: "actual", encodedKey: "N" }];
void inputs; void statistics; void diagnostics; void chain;
`);
  const cases = [
    ["readonly-inputs", "database.inputs = database.inputs;", 2540, 3, 10],
    ["readonly-stats-port", "database.stats = database.stats;", 2540, 3, 10],
    ["readonly-diagnostics-port", "database.diagnostics = database.diagnostics;", 2540, 3, 10],
    ["readonly-statistics", "database.stats().push();", 2339, 3, 18],
    ["readonly-diagnostics", "database.diagnostics().push();", 2339, 3, 24],
    ["missing-depth", 'const wrong: Port.QueryLimits = {}; void wrong;', 2741, 3, 7],
    ["wrong-depth", 'const wrong: Port.QueryLimits = { maxActiveDepth: "2" }; void wrong;', 2322, 3, 35],
    ["undeclared-runtime-port", 'import { lookup } from "./query/index.js"; void lookup;', 2305, 3, 10],
    ["private-entry", 'import { snapshotChain } from "./query/memo.js"; void snapshotChain;', 2307, 3, 31],
  ];
  const files = [positive];
  const expected = [];
  for (const [name, body, code, line, column] of cases) {
    const file = `${name}.mts`;
    writeFileSync(resolve(stage, file), `import { createDatabase } from "./query/index.js"; import type * as Port from "./query/contract.js";\nconst database = createDatabase(null, { maxActiveDepth: 2 }); void database; const limits: Port.QueryLimits = { maxActiveDepth: 2 }; void limits;\n${body}\n`);
    files.push(resolve(stage, file));
    expected.push({ file, line, column, code });
  }
  const config = resolve(stage, "tsconfig.json");
  writeFileSync(config, JSON.stringify({ compilerOptions: { strict: true, noUncheckedIndexedAccess: true,
    exactOptionalPropertyTypes: true, noUnusedLocals: true, noUnusedParameters: true, noImplicitReturns: true,
    noFallthroughCasesInSwitch: true, noEmit: true, skipLibCheck: false, target: "es2022", lib: ["es2022"],
    module: "nodenext", moduleResolution: "nodenext", types: [] }, files }));
  const result = spawnSync(process.execPath, [deps.compiler, "--project", config, "--listFiles", "--pretty", "false"], {
    cwd: stage, encoding: "utf8", timeout: 90_000, maxBuffer: 4_194_304,
  });
  assert.equal(result.error === undefined && result.signal === null, true, "the real strict declaration consumer terminates");
  const output = `${result.stdout}${result.stderr}`;
  writeFileSync(resolve(stage, "diagnostics.log"), output);
  const actual = [...output.matchAll(/^(.+)\((\d+),(\d+)\): error TS(\d+):/gmu)].map(match => ({
    file: basename(match[1]), line: Number(match[2]), column: Number(match[3]), code: Number(match[4]),
  }));
  const order = rows => rows.sort((left, right) => left.file < right.file ? -1 : left.file > right.file ? 1 : 0);
  assert.deepEqual(order(actual), order(expected), output.slice(0, 4000));
  assert.equal(result.status, 1, "the pinned compiler rejects the exact negative programs with no emit");
  const loaded = result.stdout.split(/\r?\n/u).filter(path => path.startsWith("/"));
  const declarations = ["query/contract.d.ts", "query/index.d.ts", "diag/contract.d.ts", "ids/contract.d.ts"]
    .map(path => resolve(stage, path));
  const allowed = new Set([...files, ...declarations, ...deps.platform.language]);
  assert.equal(loaded.length > files.length, true);
  assert.equal(loaded.every(path => allowed.has(realpathSync(path))), true, "no original, private or stale dependency source is loaded");
  assert.deepEqual(loaded.filter(path => path.startsWith(stage) && path.endsWith(".d.ts")).sort(), declarations.sort());
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
    [...runtimeFiles, resolve(repository, "packages/host/src/query/contract.ts")], raw);
    const directory = resolve(repository, ".temp/query-coverage");
    mkdirSync(directory, { recursive: true });
    writeFileSync(resolve(directory, "raw-v8.json"), `${JSON.stringify(raw)}\n`);
    writeFileSync(resolve(directory, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
    writeFileSync(resolve(directory, "source-inputs.json"), `${JSON.stringify(sourceFiles.map(path => ({ path,
      hash: createHash("sha256").update(readFileSync(resolve(repository, path))).digest("hex") })), null, 2)}\n`);
    assert.equal(result.length, 3, "all three genuine runtime owners have nonempty real V8 evidence");
    assert.equal(report.status, "passed", JSON.stringify(report.findings).slice(0, 6000));
    assert.equal(report.files.filter(file => file.status === "covered").length, 3);
    assert.equal(report.files.filter(file => file.status === "not-applicable").length, 1, "the actual type-only contract is N/A");
    for (const file of report.files.filter(file => file.status === "covered")) {
      assert.equal(file.lines, 100, basename(file.path));
      assert.equal(file.branches, 100, basename(file.path));
      assert.equal(file.functions, 100, basename(file.path));
    }
  } finally { session.disconnect(); }
});

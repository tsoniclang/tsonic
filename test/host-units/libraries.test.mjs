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

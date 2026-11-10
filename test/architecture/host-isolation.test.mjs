import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { hostCatalogue } from "./host/catalogue.mjs";
import { compileIsolated, isolationDeps } from "./host/isolation.mjs";

const repository = fileURLToPath(new URL("../../", import.meta.url));
const tooling = process.env.TSONIC_HOST_TOOLING_ROOT ?? repository;
const host = "packages/host/src";
const module = name => hostCatalogue.find(candidate => candidate.name === name);
const path = (name, file = "contract.ts") => `${host}/${name}/${file}`;
const contract = path("ir-types");
const entry = path("ir-types", "index.ts");
const inferContract = path("infer");
const inferEntry = path("infer", "index.ts");
const substituteSources = Object.freeze([
  [contract, 'export type Term = { readonly kind: "parameter"; readonly index: number } | { readonly kind: "integer"; readonly value: number };\nexport type Substitute = (term: Term, bindings: readonly Term[]) => Term;'],
  [entry, 'import type { Substitute } from "./contract.js";\nexport const substitute: Substitute = (term, bindings) => term.kind === "parameter" ? bindings[term.index] ?? term : term;'],
  [inferContract, 'import type { Term } from "../ir-types/contract.js";\nexport interface InferDeps { readonly bindings: readonly Term[]; }\nexport type Infer = (deps: InferDeps, input: Term) => Term;'],
  [inferEntry, 'import type { Infer } from "./contract.js";\nimport { substitute } from "../ir-types/index.js";\nexport const infer: Infer = (deps, input) => substitute(input, deps.bindings);'],
]);

async function fixture(entries, action) {
  const parent = resolve(repository, ".temp/host-s1-isolation");
  mkdirSync(parent, { recursive: true });
  const root = mkdtempSync(resolve(parent, "case-"));
  const write = (file, text) => {
    mkdirSync(dirname(resolve(root, file)), { recursive: true });
    writeFileSync(resolve(root, file), text);
  };
  for (const [file, text] of entries) write(file, text);
  const deps = isolationDeps(tooling);
  try { await action({ root, deps, write }); }
  finally { rmSync(root, { recursive: true }); }
}

const inferInput = root => ({ root, sourceFiles: [inferContract, inferEntry], interfaceSources: [contract, entry], outputDirectory: ".temp/isolation" });
const label = report => report.diagnostics.join("\n").slice(-5000);

test("real infer imports actual contract-typed substitute through fresh strict public value declarations", async () => {
  await fixture(substituteSources, async ({ root, deps }) => {
    const report = await compileIsolated(deps, module("infer"), inferInput(root));
    assert.equal(report.status, "passed", label(report));
    assert.equal(report.diagnostics.length, 2, "fresh interface emission and strict owner compilation both execute");
    assert.equal(report.findings.length, 0);
    assert.equal(report.provenance.length, 2);
    assert.equal(report.loadedInventory.some(file => file.endsWith("/isolated/packages/host/src/ir-types/index.d.ts")), true);
    assert.equal(report.loadedInventory.some(file => file.includes("/isolated/") && file.endsWith("/ir-types/index.ts")), false);
    assert.equal(report.loadedInventory.every(file => report.expectedInventory.includes(file)), true);
    for (const provenance of report.provenance) {
      const hash = createHash("sha256").update(readFileSync(provenance.source)).digest("hex");
      assert.equal(provenance.sourceHash, hash);
      assert.equal(/^[0-9a-f]{64}$/u.test(provenance.declarationHash), true);
    }
    assert.equal(Object.isFrozen(report), true);
  });
});

for (const name of ["ids", "diag", "ir-types", "ir-hir", "ir-infer", "ir-tir", "ir-mir", "ir-facts", "ir-program", "dataflow", "query", "libraries", "snapshot"]) {
  test(`whole library ${name} compiles in strict isolation with its actual owned function signature`, async () => {
    const contract = path(name);
    const entry = path(name, "index.ts");
    await fixture([[contract, "export type Read = (input: number) => number;"],
      [entry, 'import type { Read } from "./contract.js"; export const read: Read = input => input + 1;']], async ({ root, deps }) => {
      const report = await compileIsolated(deps, module(name), { root, sourceFiles: [contract, entry], interfaceSources: [], outputDirectory: ".temp/isolation" });
      assert.equal(report.status, "passed", label(report));
      assert.equal(report.loadedInventory.length > 1, true, "real compiler language declarations loaded");
      assert.equal(report.loadedInventory.every(file => report.expectedInventory.includes(file)), true);
    });
  });
}

test("real Node platform declarations remain available only to the explicitly allowed effect owner", async () => {
  const contract = path("project");
  const entry = path("project", "paths.ts");
  await fixture([[contract, "export interface Path { readonly value: string; }"],
    [entry, 'import { isAbsolute } from "node:path"; export function absolute(input: string): boolean { return isAbsolute(input); }']], async ({ root, deps }) => {
    const report = await compileIsolated(deps, module("project"), { root, sourceFiles: [contract, entry], interfaceSources: [], outputDirectory: ".temp/isolation" });
    assert.equal(report.status, "passed", label(report));
    assert.equal(report.loadedInventory.some(file => file.includes("/@types/node/")), true);
  });
});

test("front uses the actual pinned SDK declarations while its contract stays checker-free", async () => {
  const contract = path("front");
  const entry = path("front", "capture.ts");
  await fixture([[contract, "export interface Observation { readonly flags: number; }"],
    [entry, 'import type { Type } from "@tsonic/tsts"; export function flags(deps: { readonly type: Type }, input: number): number { return deps.type.flags + input; }']], async ({ root, deps }) => {
    const report = await compileIsolated(deps, module("front"), { root, sourceFiles: [contract, entry], interfaceSources: [], outputDirectory: ".temp/isolation" });
    assert.equal(report.status, "passed", label(report));
    assert.equal(report.loadedInventory.some(file => file.includes("/packages/tsts/dist/")), true);
  });
});

test("private, stale and undeclared interface inputs cannot replace the genuine public value port", async () => {
  await fixture(substituteSources, async ({ root, deps, write }) => {
    const missing = await compileIsolated(deps, module("infer"), { ...inferInput(root), interfaceSources: [contract] });
    assert.equal(missing.status, "failed");
    assert.equal(missing.findings.some(finding => finding.code === "forbidden-import"), true);
    write(path("ir-types", "private.ts"), "export const privateValue = 1;");
    write(inferEntry, 'import { privateValue } from "../ir-types/private.js"; export function infer(deps: { readonly bias: number }, input: number): number { return privateValue + deps.bias + input; }');
    const privateRead = await compileIsolated(deps, module("infer"), inferInput(root));
    assert.equal(privateRead.status, "failed");
    assert.equal(privateRead.findings.some(finding => finding.code === "forbidden-import"), true);
    await assert.rejects(compileIsolated(deps, module("infer"), { ...inferInput(root), interfaceSources: [contract, path("ir-types", "private.ts")] }), /public interface/u);
    write("packages/host/dist/ir-types/contract.d.ts", "export interface Stale { readonly value: number; }");
    assert.equal(existsSync(resolve(root, "packages/host/dist/ir-types/contract.d.ts")), true);
  });
});

test("actual ambient-ancestor compiler loads are rejected against the entire exact declared domain", async () => {
  const contract = path("ids");
  await fixture([[contract, '/// <reference types="ambient-peer" />\nexport interface Data { readonly value: number; }'],
    ["node_modules/ambient-peer/package.json", '{"name":"ambient-peer","types":"index.d.ts"}'],
    ["node_modules/ambient-peer/index.d.ts", "interface HiddenPeer { readonly value: number; }"]], async ({ root, deps }) => {
    const report = await compileIsolated(deps, module("ids"), { root, sourceFiles: [contract], interfaceSources: [], outputDirectory: ".temp/isolation" });
    assert.equal(report.status, "failed");
    assert.equal(report.loadedInventory.some(file => file.endsWith("/ambient-peer/index.d.ts")), true, label(report));
    assert.equal(report.findings.some(finding => finding.code === "loaded-source-escape"), true);
  });
});

test("real strict readonly reads pass and the original four mutation diagnostics are retained", async () => {
  const contract = path("ids");
  const consumer = path("ids", "consumer.ts");
  const declaration = "export interface Data { readonly values: readonly number[]; readonly tuple: readonly [number, ...string[]]; readonly nested: ReadonlyArray<readonly number[]>; }";
  await fixture([[contract, declaration], [consumer, 'import type { Data } from "./contract.js"; export function read(view: Data): number { return view.values.length + view.tuple[0] + view.nested.length; }']], async ({ root, deps, write }) => {
    const input = { root, sourceFiles: [contract, consumer], interfaceSources: [], outputDirectory: ".temp/isolation" };
    const read = await compileIsolated(deps, module("ids"), input);
    assert.equal(read.status, "passed", label(read));
    write(consumer, 'import type { Data } from "./contract.js"; export function mutate(view: Data): void {\nview.values.push(1);\nview.tuple[0] = 2;\nview.nested[0] = [];\nview.values.splice(0);\n}');
    const mutation = await compileIsolated(deps, module("ids"), input);
    assert.equal(mutation.status, "failed");
    assert.equal(JSON.stringify([...mutation.diagnostics.join("\n").matchAll(/error TS(\d+):/gu)].map(match => Number(match[1]))), JSON.stringify([2339, 2540, 2542, 2551]), label(mutation));
  });
});

test("whole-source inventories, admission, paths and repeated fresh declarations fail closed", async () => {
  await fixture(substituteSources, async ({ root, deps, write }) => {
    const input = inferInput(root);
    await assert.rejects(compileIsolated({ ...deps, admitted: () => false }, module("infer"), input), /aggregate process-group/u);
    await assert.rejects(compileIsolated(deps, { ...module("infer") }, input), /exact declared/u);
    await assert.rejects(compileIsolated(deps, module("infer"), { ...input, sourceFiles: [inferContract] }), /complete exact/u);
    await assert.rejects(compileIsolated(deps, module("infer"), { ...input, interfaceSources: [contract, contract] }), /Distinct/u);
    await assert.rejects(compileIsolated(deps, module("infer"), { ...input, outputDirectory: "../outside" }), /owned .temp/u);
    const first = await compileIsolated(deps, module("infer"), input);
    assert.equal(first.status, "passed", label(first));
    write(contract, 'export type Term = { readonly kind: "integer"; readonly value: string }; export type Substitute = (term: Term, bindings: readonly Term[]) => Term;');
    const fresh = await compileIsolated(deps, module("infer"), input);
    assert.equal(fresh.status, "failed");
    assert.equal(fresh.diagnostics.join("\n").includes("TS"), true);
    symlinkSync(resolve(root, inferContract), resolve(root, path("infer", "alias.ts")));
    await assert.rejects(compileIsolated(deps, module("infer"), input), /symlinks/u);
  });
});

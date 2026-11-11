import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { hostCatalogue, publicEntry, sourceOwner } from "./host/catalogue.mjs";
import { compileIsolated, isolationDeps } from "./host/isolation.mjs";
import { createInspectionDeps, inspectHost } from "./host/inspect.mjs";

const repository = fileURLToPath(new URL("../../", import.meta.url));
const tooling = process.env.TSONIC_HOST_TOOLING_ROOT ?? repository;
const quarantineDataPath = process.env.TSONIC_HOST_QUARANTINE_AREAS ?? resolve(repository, "test/architecture/quarantine/areas.json");
const quarantineData = JSON.parse(readFileSync(quarantineDataPath, "utf8"));
const quarantineRoots = quarantineData.areas.map(area => area.directory);
const host = quarantineData.currentRoots.hostSource;
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

async function fixture(entries, action, catalogue = hostCatalogue) {
  const parent = resolve(repository, ".temp/host-s1-isolation");
  mkdirSync(parent, { recursive: true });
  const root = mkdtempSync(resolve(parent, "case-"));
  const write = (file, text) => {
    mkdirSync(dirname(resolve(root, file)), { recursive: true });
    writeFileSync(resolve(root, file), text);
  };
  for (const [file, text] of entries) write(file, text);
  const inspection = { ...createInspectionDeps(quarantineRoots), catalogue };
  const deps = { ...isolationDeps(tooling, quarantineRoots), inspect: (root, files) => inspectHost(inspection,
    { root, files, catalogue, loadedFiles: [], configurations: [] }) };
  try { await action({ root, deps, write }); }
  finally { rmSync(root, { recursive: true }); }
}

const inferInput = root => ({ root, sourceFiles: [inferContract, inferEntry], interfaceSources: [contract, entry], declarationSources: [contract, entry], outputDirectory: ".temp/isolation" });
const label = report => `${JSON.stringify(report.findings).slice(0, 2000)}\n${report.diagnostics.join("\n").slice(-5000)}`;

test("real infer imports actual contract-typed substitute through fresh strict public value declarations", async () => {
  await fixture(substituteSources, async ({ root, deps }) => {
    const report = await compileIsolated(deps, module("infer"), inferInput(root));
    assert.equal(report.status, "passed", label(report));
    assert.equal(report.diagnostics.length, 2, "fresh interface emission and strict owner compilation both execute");
    assert.equal(report.findings.length, 0);
    assert.equal(report.provenance.length, 2);
    assert.equal(report.loadedInventory.some(file => file.endsWith(`/isolated/${host}/ir-types/index.d.ts`)), true);
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

test("genuine public declaration production includes its explicit private implementation closure only in the producer stage", async () => {
  const helper = path("ir-types", "private.ts");
  for (const forwarding of [false, true]) {
    const contractText = "export type Substitute = (input: number) => number;";
    const privateText = forwarding
      ? 'import type { Substitute } from "./contract.js"; export const substitute: Substitute = input => input + 1;'
      : 'export function adjust(input: number): number { return input + 1; }';
    const entryText = forwarding ? 'export { substitute } from "./private.js";'
      : 'import type { Substitute } from "./contract.js"; import { adjust } from "./private.js"; export const substitute: Substitute = input => adjust(input);';
    await fixture([[contract, contractText], [entry, entryText], [helper, privateText],
      [inferContract, 'export interface InferDeps { readonly bias: number; } export type Infer = (deps: InferDeps, input: number) => number;'],
      [inferEntry, 'import type { Infer } from "./contract.js"; import { substitute } from "../ir-types/index.js"; export const infer: Infer = (deps, input) => substitute(input) + deps.bias;']], async ({ root, deps }) => {
      const report = await compileIsolated(deps, module("infer"), { ...inferInput(root), declarationSources: [contract, entry, helper] });
      assert.equal(report.status, "passed", label(report));
      assert.equal(report.loadedInventory.some(file => file.endsWith(`/interface-source/${helper}`)), true);
      assert.equal(report.loadedInventory.some(file => file.includes("/isolated/") && file.endsWith("/private.ts")), false);
      assert.equal(report.loadedInventory.some(file => file.endsWith(`/isolated/${host}/ir-types/private.d.ts`)), forwarding);
      assert.equal(report.sourceInventory.some(source => source.path === resolve(root, helper) && source.hash === createHash("sha256").update(privateText).digest("hex")), true);
      assert.equal(report.loadedInventory.every(file => report.expectedInventory.includes(file)), true);
      await assert.rejects(compileIsolated(deps, module("infer"), { ...inferInput(root), declarationSources: [contract, entry, helper, helper] }), /Distinct complete explicit/u);
      const missing = await compileIsolated(deps, module("infer"), inferInput(root));
      assert.equal(missing.status, "failed");
      assert.equal(missing.findings.some(finding => finding.code === "forbidden-import"), true);
      const orphan = path("ir-types", "unused.ts");
      mkdirSync(dirname(resolve(root, orphan)), { recursive: true });
      writeFileSync(resolve(root, orphan), "export const unused = 1;");
      await assert.rejects(compileIsolated(deps, module("infer"), { ...inferInput(root), declarationSources: [contract, entry, helper, orphan] }), /actual implementation closure/u);
    });
  }
});

for (const name of ["ids", "diag", "ir-types", "ir-hir", "ir-infer", "ir-tir", "ir-mir", "ir-facts", "ir-program", "dataflow", "query", "libraries", "snapshot"]) {
  test(`whole library ${name} compiles in strict isolation with its actual owned function signature`, async () => {
    const contract = path(name);
    const entry = path(name, "index.ts");
    await fixture([[contract, "export type Read = (input: number) => number;"],
      [entry, 'import type { Read } from "./contract.js"; export const read: Read = input => input + 1;']], async ({ root, deps }) => {
      const report = await compileIsolated(deps, module(name), { root, sourceFiles: [contract, entry], interfaceSources: [], declarationSources: [], outputDirectory: ".temp/isolation" });
      assert.equal(report.status, "passed", label(report));
      assert.equal(report.loadedInventory.length > 1, true, "real compiler language declarations loaded");
      assert.equal(report.loadedInventory.every(file => report.expectedInventory.includes(file)), true);
    });
  });
}

test("real Node platform declarations remain available only to the explicitly allowed effect owner", async () => {
  const contract = path("project");
  const entry = path("project", "effects.ts");
  const catalogue = hostCatalogue.map(module => module.name === "project" ? { ...module, effects: [{ path: entry, role: "effects" }] } : module);
  await fixture([[contract, "export interface Path { readonly value: string; }"],
    [entry, 'import { isAbsolute } from "node:path"; export function absolute(input: string): boolean { return isAbsolute(input); }']], async ({ root, deps }) => {
    const report = await compileIsolated(deps, module("project"), { root, sourceFiles: [contract, entry], interfaceSources: [], declarationSources: [], outputDirectory: ".temp/isolation" });
    assert.equal(report.status, "passed", label(report));
    assert.equal(report.loadedInventory.some(file => file.includes("/@types/node/")), true);
  }, catalogue);
});

test("strict contract typing accepts implementation parameter spelling, parentheses and const aliases", async () => {
  for (const implementation of ['export const infer: Infer = (other, input) => substitute(input, other.bindings);',
    'export const infer: Infer = ((other, input) => substitute(input, other.bindings));',
    'const original = (other: InferDeps, input: Term): Term => substitute(input, other.bindings); export const infer: Infer = original;']) {
    const text = `import type { Infer, InferDeps } from "./contract.js"; import type { Term } from "../ir-types/contract.js"; import { substitute } from "../ir-types/index.js"; ${implementation}`;
    const imports = implementation.includes("original") ? text : text.replace("Infer, InferDeps", "Infer").replace('import type { Term } from "../ir-types/contract.js"; ', "");
    await fixture(substituteSources.map(([path, source]) => [path, path === inferEntry ? imports : source]), async ({ root, deps }) => {
      const report = await compileIsolated(deps, module("infer"), inferInput(root));
      assert.equal(report.status, "passed", label(report));
      assert.equal(report.loadedInventory.every(file => report.expectedInventory.includes(file)), true);
    });
  }
});

test("canonical generic phase-slot records retain real strict isolated compilation", async () => {
  const contract = path("ir-hir");
  const entry = path("ir-hir", "index.ts");
  const text = 'export interface Phase { readonly ForInOrOfStatement: object | null; readonly Token: object | null; }\nexport interface SyntaxPhase extends Phase { readonly ForInOrOfStatement: null; readonly Token: null; }\nexport interface ForInOrOfStatement<P extends Phase> { readonly kind: "ForInStatement" | "ForOfStatement"; readonly tsonic: P["ForInOrOfStatement"]; }\nexport interface Token<P extends Phase, K extends string> { readonly kind: K; readonly tsonic: P["Token"]; }\nexport type Read = (input: ForInOrOfStatement<SyntaxPhase> | Token<SyntaxPhase, "Identifier">) => string;';
  await fixture([[contract, text], [entry, 'import type { Read } from "./contract.js"; export const read: Read = input => input.kind;']], async ({ root, deps }) => {
    const report = await compileIsolated(deps, module("ir-hir"), { root, sourceFiles: [contract, entry], interfaceSources: [], declarationSources: [], outputDirectory: ".temp/isolation" });
    assert.equal(report.status, "passed", label(report));
    assert.equal(report.loadedInventory.every(file => report.expectedInventory.includes(file)), true);
  });
});

const sdkRoles = 'export interface LibraryRoleEntry { readonly role: string; }';
const sdkContract = 'import type { CompilerExtension, SourceDeclarationProvider, SourceSemanticsModule } from "@tsonic/tsts";\nimport type { LibraryRoleEntry } from "../snapshot/contract.js";\nexport type CheckerExtensions = object & { readonly identityKind: "checker-extensions" };\nexport type CheckerExtensionValue = { readonly kind: "compiler-extension"; readonly value: CompilerExtension } | { readonly kind: "declaration-provider"; readonly value: SourceDeclarationProvider; readonly roles: readonly LibraryRoleEntry[] } | { readonly kind: "semantics-module"; readonly value: SourceSemanticsModule };\nexport type ExtensionOf = (table: CheckerExtensions, reference: number) => CheckerExtensionValue;';

test("front uses actual pinned SDK declarations and the sole closed ExtensionOf contract value port", async () => {
  const contract = path("front");
  const entry = path("front", "capture.ts");
  await fixture([[contract, sdkContract], [path("snapshot"), sdkRoles],
    [entry, 'import type { Type } from "@tsonic/tsts"; export function flags(deps: { readonly type: Type }, input: number): number { return deps.type.flags + input; }']], async ({ root, deps }) => {
    const report = await compileIsolated(deps, module("front"), { root, sourceFiles: [contract, entry], interfaceSources: [path("snapshot")], declarationSources: [path("snapshot")], outputDirectory: ".temp/isolation" });
    assert.equal(report.status, "passed", label(report));
    assert.equal(report.loadedInventory.some(file => file.includes("/packages/tsts/dist/")), true);
  });
});

test("real pipeline isolation emits only permitted component query types and the identical front brand", async () => {
  const contract = path("pipeline");
  const entry = path("pipeline", "index.ts");
  await fixture([[path("front"), sdkContract], [path("snapshot"), sdkRoles], [path("infer"), 'export type Infer = (deps: { readonly bias: number }, input: number) => number;'],
    [contract, 'import type { CheckerExtensions } from "../front/contract.js";\nexport type { CheckerExtensions } from "../front/contract.js";\nimport type { Infer } from "../infer/contract.js";\nexport interface Input { readonly extensions: CheckerExtensions; readonly infer: Infer; readonly value: number; }\nexport type Run = (input: Input) => number;'],
    [entry, 'import type { Run } from "./contract.js"; export const run: Run = input => input.infer({ bias: 1 }, input.value);']], async ({ root, deps }) => {
    const report = await compileIsolated(deps, module("pipeline"), { root, sourceFiles: [contract, entry], interfaceSources: [path("front"), path("snapshot"), path("infer")], declarationSources: [path("front"), path("snapshot"), path("infer")], outputDirectory: ".temp/isolation" });
    assert.equal(report.status, "passed", label(report));
    assert.equal(report.provenance.length, 3);
    assert.equal(report.loadedInventory.some(file => file.endsWith(`/isolated/${host}/front/contract.d.ts`)), true);
    assert.equal(report.loadedInventory.every(file => report.expectedInventory.includes(file)), true);
    assert.equal(report.loadedInventory.some(file => file.includes("/isolated/") && file.endsWith("/front/contract.ts")), false);
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
    write(inferEntry, 'import type { Stale } from "../../dist/ir-types/contract.js"; export function infer(deps: { readonly bias: number }, input: Stale): number { return input.value + deps.bias; }');
    const staleRead = await compileIsolated(deps, module("infer"), inferInput(root));
    assert.equal(staleRead.status, "failed");
    assert.equal(staleRead.findings.some(finding => finding.code === "forbidden-import"), true);
  });
});

test("actual ambient-ancestor compiler loads are rejected against the entire exact declared domain", async () => {
  const contract = path("ids");
  await fixture([[contract, '/// <reference types="ambient-peer" />\nexport interface Data { readonly value: number; }'],
    ["node_modules/ambient-peer/package.json", '{"name":"ambient-peer","types":"index.d.ts"}'],
    ["node_modules/ambient-peer/index.d.ts", "interface HiddenPeer { readonly value: number; }"]], async ({ root, deps }) => {
    const report = await compileIsolated(deps, module("ids"), { root, sourceFiles: [contract], interfaceSources: [], declarationSources: [], outputDirectory: ".temp/isolation" });
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
    const input = { root, sourceFiles: [contract, consumer], interfaceSources: [], declarationSources: [], outputDirectory: ".temp/isolation" };
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

test("all actual Host modules pass S1 inspection and fresh whole-module declaration isolation", async context => {
  const modules = hostCatalogue.filter(module => module.directory.startsWith(`${host}/`));
  assert.equal(modules.length, 36, "complete current contract owners");
  const deps = isolationDeps(tooling, quarantineRoots);
  const inventory = deps.enumerate(resolve(repository, host)).map(path => relative(repository, path)).sort();
  const files = new Map(inventory.map(path => [path, readFileSync(resolve(repository, path), "utf8")]));
  const inspection = inspectHost(createInspectionDeps(quarantineRoots), {
    root: repository, files: [...files.keys()], catalogue: hostCatalogue, loadedFiles: [], configurations: ["packages/host/tsconfig.json"],
  });
  assert.equal(JSON.stringify(inspection), "[]", `actual contract findings: ${JSON.stringify(inspection).slice(0, 6000)}`);
  const expectedInventory = [...modules.map(module => module.contract),
    ...["index.ts", "invariant.ts", "order.ts"].map(name => `${host}/diag/${name}`),
    ...["index.ts", "identity.ts", "key.ts"].map(name => `${host}/ids/${name}`),
    ...["index.ts", "verify-extensions.ts", "verify-packages.ts", "verify.ts"].map(name => `${host}/snapshot/${name}`),
    ...["database.ts", "index.ts", "memo.ts"].map(name => `${host}/query/${name}`)].sort();
  assert.equal(JSON.stringify(inventory), JSON.stringify(expectedInventory), "the complete actual current root equals the explicit reviewed inventory");
  const graph = deps.graph(files);
  for (const module of modules) await context.test(module.name, async () => {
    const ownSources = inventory.filter(path => sourceOwner(hostCatalogue, path)?.name === module.name);
    const closure = new Set(ownSources);
    for (const source of closure) for (const edge of graph) if (edge.source === source && edge.target !== null) closure.add(edge.target);
    const production = [...closure].filter(path => !ownSources.includes(path)).sort();
    const interfaces = production.filter(path => {
      const dependency = sourceOwner(hostCatalogue, path);
      return dependency !== undefined && publicEntry(dependency, path);
    });
    const report = await compileIsolated(deps, module, {
      root: repository, sourceFiles: ownSources, interfaceSources: interfaces, declarationSources: production,
      outputDirectory: ".temp/host-current-isolation",
    });
    assert.equal(report.status, "passed", `${module.name}: ${label(report)}`);
    assert.equal(report.loadedInventory.length > 0, true, "real compiler input inventory is nonempty");
    assert.equal(report.loadedInventory.every(path => report.expectedInventory.includes(path)), true, "no undeclared compiler source");
    assert.equal(report.provenance.length, interfaces.length, "every public dependency has genuine fresh declaration provenance");
    assert.equal(report.sourceInventory.length, closure.size, "complete explicit original module source closure");
  });
});

test("A7 through A12 genuine emitted contracts accept current forms and reject every superseded receiving form", async () => {
  await fixture([], async ({ root, deps, write }) => {
    const imports = entries => entries.map(([owner, names]) =>
      `import type { ${names} } from ${JSON.stringify(resolve(repository, "packages/host/dist", owner, "contract.js"))};`).join("\n");
    const rows = [
      ["old-mir", [["ir-mir", "VerifyMir, MirBody"], ["ir-tir", "TirBody"], ["ir-types", "TypeOf, SignatureOf"]],
        "export function read(verify: VerifyMir, body: MirBody, source: TirBody, typeOf: TypeOf, signatureOf: SignatureOf) { return verify(body, source, typeOf, signatureOf); }", 2554],
      ["old-mir-context", [["ir-mir", "MirVerificationContext"]],
        "export function read(context: MirVerificationContext) { const { bodyOwner, ...legacy } = context; void bodyOwner; const current: MirVerificationContext = legacy; return current; }", 2741],
      ["old-hir-body-path-context", [["ir-hir", "HirVerificationContext"]],
        "export function read(context: HirVerificationContext) { const { bodyPathOf, ...legacy } = context; void bodyPathOf; const current: HirVerificationContext = legacy; return current; }", 2741],
      ["old-hir-definition-path-context", [["ir-hir", "HirVerificationContext"]],
        "export function read(context: HirVerificationContext) { const { definitionPathOf, ...legacy } = context; void definitionPathOf; const current: HirVerificationContext = legacy; return current; }", 2741],
      ["old-backward", [["dataflow", "BackwardProblem, BlockState"], ["ir-mir", "MirTerminator"]],
        "export function read(problem: BackwardProblem<number>, term: MirTerminator, states: readonly BlockState<number>[]) { return problem.terminator(term, states); }", 2554],
      ["old-program-context", [["ir-program", "ProgramVerificationContext"]],
        "export function read(context: ProgramVerificationContext) { const { limits, ...legacy } = context; void limits; const current: ProgramVerificationContext = legacy; return current; }", 2741],
      ["old-program-signature-context", [["ir-program", "ProgramVerificationContext"]],
        "export function read(context: ProgramVerificationContext) { const { signatureIdOf, ...legacy } = context; void signatureIdOf; const current: ProgramVerificationContext = legacy; return current; }", 2741],
      ["old-program-module-path-context", [["ir-program", "ProgramVerificationContext"]],
        "export function read(context: ProgramVerificationContext) { const { modulePathOf, ...legacy } = context; void modulePathOf; const current: ProgramVerificationContext = legacy; return current; }", 2741],
      ["old-program-definition-path-context", [["ir-program", "ProgramVerificationContext"]],
        "export function read(context: ProgramVerificationContext) { const { definitionPathOf, ...legacy } = context; void definitionPathOf; const current: ProgramVerificationContext = legacy; return current; }", 2741],
      ["seed-without-table", [["ir-types", "SeedTypeInterner"]],
        "export function read(seed: SeedTypeInterner) { return seed(); }", 2554],
      ["publication-without-usage", [["ir-types", "TypePublication, TypePublicationResult"]],
        "export function read(value: TypePublication) { const result: TypePublicationResult = { kind: 'complete', value }; return result; }", 2322],
      ["tir-module-without-module", [["ir-tir", "VerifyTirModule, TirVerifierInput"]],
        "export function read(verify: VerifyTirModule, input: TirVerifierInput) { return verify(input); }", 2554],
      ["tir-site-with-body-node", [["ir-tir", "TirSite"], ["ids", "NodeRef"]],
        "export function read(node: NodeRef) { const site: TirSite = { kind: 'node', node }; return site; }", 2322],
      ["signature-with-type-root", [["ir-types", "SubstituteSignature, TypeInterner, BindingVector, TypeExpansionLimits"], ["ids", "TyId"]],
        "export function read(substitute: SubstituteSignature, interner: TypeInterner, type: TyId, bindings: BindingVector, limits: TypeExpansionLimits) { return substitute(interner, type, bindings, limits); }", 2345],
      ["deleted-program-id-history-rule", [["ir-program", "ProgramRule"]],
        "export function read() { const rule: ProgramRule = 'instantiation-preserves-existing-ids'; return rule; }", 2322],
      ["old-binding-element", [["ir-tir", "TypedBinding, TypedBindingElement"]],
        "export function read(binding: TypedBinding) { const current: TypedBindingElement = binding; return current; }", 2322],
      ["old-library-projection", [["libraries", "LibraryVerificationContext, LibraryExportBinding"], ["ids", "LibraryExportIdentity"]],
        "export function read(context: LibraryVerificationContext, identity: LibraryExportIdentity) { const current: LibraryExportBinding = context.signatureOfExport(identity); return current; }", 2322],
      ["unsupported-schema", [["ir-program", "SupportedProgramSchema"]],
        "export const value: SupportedProgramSchema = 2;", 2322],
      ...["block-terminator-total", "unwind-cleanup-complete", "suspension-return-cleanup", "effect-path-exact", "rvalue-effect-free"]
        .map(rule => ["removed-" + rule, [["ir-mir", "MirRule"]], `export const value: MirRule = ${JSON.stringify(rule)};`, 2322]),
      ...["module", "definition"].map(kind => ["removed-tir-" + kind, [["ir-tir", "TirSite"]],
        `export const value: TirSite["kind"] = ${JSON.stringify(kind)};`, 2322]),
      ["removed-library-member-rule", [["libraries", "LibraryRule"]],
        'export const value: LibraryRule = "summary-binding-member-exact";', 2322],
    ];
    const positive = imports([
      ["ir-mir", "VerifyMir, MirBody, MirVerificationContext, MirTerminator"],
      ["dataflow", "BackwardProblem, BlockState"], ["ir-program", "ProgramVerificationContext, SupportedProgramSchema, SignatureRecord, PublishedBody"],
      ["ir-types", "SeedTypeInterner, TypeTable, TypePublicationResult, SubstituteSignature, TypeInterner, BindingVector, TypeExpansionLimits"],
      ["ir-tir", "TypedBinding, TypedBindingElement, VerifyTir, VerifyTirModule, TirVerifierInput, TirModule, TirBody, TirSite"], ["libraries", "LibraryVerificationContext, LibraryExportBinding"],
      ["ids", "LibraryExportIdentity, ModuleId, NodeId"],
    ]) + '\nexport function current(verify: VerifyMir, body: MirBody, mir: MirVerificationContext, problem: BackwardProblem<number>, term: MirTerminator, states: readonly BlockState<number>[], program: ProgramVerificationContext, binding: TypedBinding, libraries: LibraryVerificationContext, identity: LibraryExportIdentity, seed: SeedTypeInterner, table: TypeTable, record: SignatureRecord) {\nconst element: TypedBindingElement = { ...binding, role: "binding" }; const hole: TypedBindingElement = { role: "hole" };\nconst schema: SupportedProgramSchema = 1; const projection: LibraryExportBinding | null = libraries.signatureOfExport(identity);\nreturn { findings: verify(body, mir), before: problem.terminator(term, states, null), limits: program.limits, element, hole, schema, projection, interner: seed(table), signature: program.signatureIdOf(record.definition, record.kind, record.ordinal, record.bindings) };\n}\n';
    write("positive.mts", positive + '\nexport function currentPublication(result: TypePublicationResult) { return result.kind === "complete" ? [result.work, result.createdRecords] : null; }\nexport function currentTir(verifyBody: VerifyTir, verifyModule: VerifyTirModule, input: TirVerifierInput, body: TirBody, module: TirModule) { return { body: verifyBody(input, body), outside: verifyModule(input, module) }; }\nexport function currentTirSite(module: ModuleId, node: NodeId): TirSite { return { kind: "node", module, node }; }\nexport function currentProgramSignature(substitute: SubstituteSignature, interner: TypeInterner, artifact: PublishedBody, bindings: BindingVector, limits: TypeExpansionLimits) { return substitute(interner, artifact.tir.signature, bindings, limits); }\n');
    write("positive-hir-paths.mts", imports([["ir-hir", "HirVerificationContext, HirRule"], ["ids", "BodyId, DefId"]]) +
      '\nexport function current(context: HirVerificationContext, body: BodyId, definition: DefId) { const rule: HirRule = "identity-path-exact"; return { body: context.bodyPathOf(body), definition: context.definitionPathOf(definition), rule }; }\n');
    write("positive-program-paths.mts", imports([["ir-program", "ProgramVerificationContext, ProgramRule"], ["ids", "ModuleId, DefId"]]) +
      '\nexport function current(context: ProgramVerificationContext, module: ModuleId, definition: DefId) { const rule: ProgramRule = "identity-path-exact"; return { module: context.modulePathOf(module), definition: context.definitionPathOf(definition), rule }; }\n');
    for (const [name, entries, text] of rows) write(name + ".mts", imports(entries) + "\n" + text + "\n");
    write("tsconfig.json", JSON.stringify({ compilerOptions: {
      strict: true, noUncheckedIndexedAccess: true, exactOptionalPropertyTypes: true, noUnusedLocals: true,
      noUnusedParameters: true, noImplicitReturns: true, noFallthroughCasesInSwitch: true, skipLibCheck: false,
      noEmit: true, target: "es2022", lib: ["es2022"], types: [], module: "nodenext", moduleResolution: "nodenext",
      verbatimModuleSyntax: true,
    }, files: ["positive.mts", "positive-hir-paths.mts", "positive-program-paths.mts", ...rows.map(([name]) => name + ".mts")] }));
    const result = spawnSync(process.execPath, [deps.compiler, "--project", resolve(root, "tsconfig.json"), "--pretty", "false"], {
      cwd: root, encoding: "utf8", maxBuffer: 4_194_304, timeout: 90_000,
    });
    if (result.error !== undefined) throw result.error;
    const output = `${result.stdout}${result.stderr}`;
    const diagnostics = [...output.matchAll(/^(.+)\((\d+),(\d+)\): error TS(\d+):/gmu)].map(match => ({
      file: match[1].split(/[\\/]/u).at(-1), code: Number(match[4]),
    })).sort((left, right) => left.file.localeCompare(right.file));
    const expected = rows.map(([name, , , code]) => ({ file: name + ".mts", code }))
      .sort((left, right) => left.file.localeCompare(right.file));
    const evidence = resolve(repository, ".temp/host-a7-consumer-evidence");
    mkdirSync(evidence, { recursive: true });
    writeFileSync(resolve(evidence, "compiler.log"), output);
    writeFileSync(resolve(evidence, "diagnostics.json"), `${JSON.stringify(diagnostics, null, 2)}\n`);
    assert.equal(result.status, 1, output.slice(-6000));
    assert.equal(result.signal, null);
    assert.equal([...output.matchAll(/error TS\d+:/gu)].length, diagnostics.length, "no unlocated error is ignored");
    assert.deepEqual(diagnostics, expected, "only the complete independently authored removed-form diagnostics occur");
  });
});

test("the real MJS public entrypoints and readonly tooling declarations pass the pinned strict compiler", () => {
  const deps = isolationDeps(tooling, quarantineRoots);
  const files = ["test/architecture/host/contracts.d.mts", "test/host-cases/contracts.d.mts",
    ...["catalogue", "import-graph", "inspect", "source-rules", "isolation", "coverage"].map(name => `test/architecture/host/${name}.mjs`),
    "test/host-cases/case.mjs", "test/host-cases/compare.mjs"];
  const result = spawnSync(process.execPath, [deps.compiler, "--ignoreConfig", "--strict", "--allowJs", "--checkJs", "false", "--noEmit",
    "--skipLibCheck", "false", "--types", "node", "--typeRoots", deps.nodeTypes, "--target", "es2022", "--module", "nodenext",
    ...files.map(file => resolve(repository, file))], { cwd: repository, encoding: "utf8", maxBuffer: 4_194_304, timeout: 90_000 });
  if (result.error !== undefined) throw result.error;
  assert.equal(result.status, 0, `${result.stdout}${result.stderr}`.slice(-6000));
});

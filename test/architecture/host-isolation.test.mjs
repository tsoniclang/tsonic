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
const substituteSources = ([
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
  });
});

test("a decision reader compiles against fresh ir-infer declarations; a module without the edge is refused", async () => {
  const decisionContract = path("ir-infer");
  const decisionEntry = path("ir-infer", "index.ts");
  const decisionSources = [
    [decisionContract, 'export interface OperationDecision { readonly kind: "selected"; readonly result: number; }\nexport type ReadDecision = (decision: OperationDecision) => number;'],
    [decisionEntry, 'import type { ReadDecision } from "./contract.js";\nexport const readDecision: ReadDecision = decision => decision.result;'],
  ];
  const readerSources = (name, up) => [
    [path(name), `import type { OperationDecision } from "${up}ir-infer/contract.js";\nexport interface ReaderDeps { readonly bias: number; }\nexport type Read = (deps: ReaderDeps, decision: OperationDecision) => number;`],
    [path(name, "index.ts"), 'import type { Read } from "./contract.js";\nexport const read: Read = (deps, decision) => decision.result + deps.bias;'],
  ];
  const input = (root, name) => ({ root, sourceFiles: [path(name), path(name, "index.ts")], interfaceSources: [decisionContract, decisionEntry],
    declarationSources: [decisionContract, decisionEntry], outputDirectory: ".temp/isolation" });
  for (const [name, up] of [["lower-mir", "../"], ["evaluate", "../"], ["summaries", "../"]]) {
    await fixture([...decisionSources, ...readerSources(name, up)], async ({ root, deps }) => {
      const report = await compileIsolated(deps, module(name), input(root, name));
      assert.equal(report.status, "passed", `${name}: ${label(report)}`);
      assert.deepEqual(report.findings, []);
      assert.equal(report.loadedInventory.some(file => file.endsWith(`/isolated/${host}/ir-infer/contract.d.ts`)), true, name);
      assert.equal(report.loadedInventory.some(file => file.includes("/isolated/") && file.endsWith("/ir-infer/contract.ts")), false, name);
      assert.equal(report.loadedInventory.every(file => report.expectedInventory.includes(file)), true, name);
    });
  }
  for (const [name, up] of [["analyses/body", "../../"], ["analyses/liveness", "../../"], ["metadata", "../"], ["front", "../"]]) {
    await fixture([...decisionSources, ...readerSources(name, up)], async ({ root, deps }) => {
      const report = await compileIsolated(deps, module(name), input(root, name));
      assert.equal(report.status, "failed", `${name}: ${label(report)}`);
      assert.equal(report.findings.some(finding => finding.code === "forbidden-import" && finding.path === path(name)), true, `${name}: ${label(report)}`);
    });
  }
});

test("genuine public declaration production includes its explicit private implementation closure only in the producer stage", async () => {
  const helper = path("ir-types", "private.ts");
  for (const forwarding of [false, true]) {
    const contractText = "export type Substitute = (input: number) => number;";
    const privateText = forwarding
      ? 'import type { Substitute } from "./contract.js"; export const substitute: Substitute = input => input + 1;'
      : 'export interface MutableState { value: number; }\nexport function adjust(input: number): number { return input + 1; }';
    const entryText = forwarding ? 'export { substitute } from "./private.js";'
      : 'import type { Substitute } from "./contract.js"; import { adjust } from "./private.js"; export const substitute: Substitute = input => adjust(input);';
    await fixture([[contract, contractText], [entry, entryText], [helper, privateText],
      [inferContract, 'export interface InferDeps { readonly bias: number; } export type Infer = (deps: InferDeps, input: number) => number;'],
      [inferEntry, 'import type { Infer } from "./contract.js"; import { substitute } from "../ir-types/index.js"; export const infer: Infer = (deps, input) => substitute(input) + deps.bias;']], async ({ root, deps }) => {
      const report = await compileIsolated(deps, module("infer"), { ...inferInput(root), declarationSources: [contract, entry, helper] });
      assert.equal(report.status, "passed", label(report));
      assert.deepEqual(report.findings, []);
      assert.equal(report.loadedInventory.some(file => file.endsWith(`/interface-source/${helper}`)), true);
      assert.equal(report.loadedInventory.some(file => file.includes("/isolated/") && file.endsWith("/private.ts")), false);
      assert.equal(report.loadedInventory.some(file => file.endsWith(`/isolated/${host}/ir-types/private.d.ts`)), forwarding);
      const expectedDeclarations = [contract, entry, ...(forwarding ? [helper] : [])].map(file => file.replace(/\.ts$/u, ".d.ts")).sort();
      assert.deepEqual(report.provenance.map(value => relative(root, value.source).replace(/\.ts$/u, ".d.ts")).sort(), expectedDeclarations);
      assert.deepEqual(report.loadedInventory.filter(file => file.includes("/isolated/") && file.endsWith(".d.ts")).sort(),
        report.provenance.map(value => value.declaration).sort());
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

test("reachable private declarations retain the complete contract-shape rejection vector", async () => {
  const helper = path("ir-types", "private.ts");
  const privateText = 'import type { Substitute } from "./contract.js";\nexport interface MutableState { value: number; }\nexport const substitute: Substitute = input => input + 1;';
  await fixture([[contract, "export type Substitute = (input: number) => number;"],
    [entry, 'export { substitute } from "./private.js";'], [helper, privateText],
    [inferContract, "export interface InferDeps { readonly bias: number; } export type Infer = (deps: InferDeps, input: number) => number;"],
    [inferEntry, 'import type { Infer } from "./contract.js"; import { substitute } from "../ir-types/index.js"; export const infer: Infer = (deps, input) => substitute(input) + deps.bias;']], async ({ root, deps }) => {
    const report = await compileIsolated(deps, module("infer"), { ...inferInput(root), declarationSources: [contract, entry, helper] });
    assert.equal(report.status, "failed", label(report));
    assert.deepEqual(report.findings, [{ code: "contract-shape", path: helper.replace(/\.ts$/u, ".d.ts"), line: 2, column: 1 }]);
    assert.deepEqual(report.provenance, []);
    assert.deepEqual(report.loadedInventory.filter(file => file.includes("/isolated/")), []);
    assert.equal(report.loadedInventory.some(file => file.endsWith(`/interface-source/${helper}`)), true);
  });
});

test("a bad actual dependency contract retains its complete rejection vector", async () => {
  await fixture([[contract, "export interface State { value: number; }\nexport type Substitute = (input: number) => number;"],
    [entry, 'import type { Substitute } from "./contract.js"; export const substitute: Substitute = input => input + 1;'],
    [inferContract, "export interface InferDeps { readonly bias: number; } export type Infer = (deps: InferDeps, input: number) => number;"],
    [inferEntry, 'import type { Infer } from "./contract.js"; import { substitute } from "../ir-types/index.js"; export const infer: Infer = (deps, input) => substitute(input) + deps.bias;']], async ({ root, deps }) => {
    const report = await compileIsolated(deps, module("infer"), inferInput(root));
    assert.equal(report.status, "failed", label(report));
    assert.deepEqual(report.findings, [{ code: "contract-shape", path: contract, line: 1, column: 1 }]);
    assert.deepEqual(report.provenance, []);
    assert.deepEqual(report.loadedInventory, []);
  });
});

for (const name of ["ids", "diag", "ir-types", "ir-hir", "ir-infer", "ir-tir", "ir-mir", "ir-facts", "ir-program", "dataflow", "query", "libraries", "snapshot", "step"]) {
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

test("HIR admits only the exact named phase copy slot with typed refusal", async () => {
  const declarations = [
    'export interface Phase { readonly Identifier: { readonly label: string } | null; readonly Other: null; }',
    'export type SyntaxCopyResult<Value, Stop> = { readonly kind: "copied"; readonly value: Value } | { readonly kind: "refused"; readonly stop: Stop };',
    'export type PreparedSyntaxSlot<Value, Image> = (image: Image) => Value;',
  ];
  const callback = 'export interface SyntaxPhaseCopy<P extends Phase, Stop, Image> { readonly Identifier: (value: P["Identifier"]) => SyntaxCopyResult<PreparedSyntaxSlot<P["Identifier"], Image>, Stop>; }';
  const shape = [...declarations, callback,
    'export type Copy = <P extends Phase, Stop, Image>(phase: SyntaxPhaseCopy<P, Stop, Image>) => SyntaxPhaseCopy<P, Stop, Image>;'].join("\n");
  const contract = path("ir-hir");
  const entry = path("ir-hir", "index.ts");
  const implementation = 'import type { Copy } from "./contract.js"; export const copy: Copy = phase => ({ Identifier: value => phase.Identifier(value) });';
  await fixture([[contract, shape], [entry, implementation]], async ({ root, deps }) => {
    const report = await compileIsolated(deps, module("ir-hir"),
      { root, sourceFiles: [contract, entry], interfaceSources: [], declarationSources: [], outputDirectory: ".temp/isolation" });
    assert.equal(report.status, "passed", label(report));
  });

  const opposites = [
    ["wrong slot", "ir-hir", callback.replace('PreparedSyntaxSlot<P["Identifier"]', 'PreparedSyntaxSlot<P["Other"]')],
    ["wrong name", "ir-hir", callback.replace("readonly Identifier:", "readonly Other:")],
    ["optional argument", "ir-hir", callback.replace("(value:", "(value?:")],
    ["rest argument", "ir-hir", callback.replace('(value: P["Identifier"])', '(...value: P["Identifier"][])')],
    ["mutable port", "ir-hir", callback.replace("readonly Identifier:", "Identifier:")],
    ["crossed phase", "ir-hir", callback.replace("Stop, Image>", "Stop extends Phase, Image>")
      .replace('PreparedSyntaxSlot<P["Identifier"]', 'PreparedSyntaxSlot<Stop["Identifier"]')],
    ["crossed image", "ir-hir", callback.replace('P["Identifier"], Image>', 'P["Identifier"], Stop>')],
    ["crossed stop", "ir-hir", callback.replace('Image>, Stop>', 'Image>, Image>')],
    ["runtime-selected slot", "ir-hir", callback.replace("(value: P", "<Slot extends keyof Phase>(value: P").replaceAll('["Identifier"]', "[Slot]")],
    ["unchecked port", "ir-hir", callback.replace('SyntaxCopyResult<PreparedSyntaxSlot<P["Identifier"], Image>, Stop>', 'P["Identifier"]')],
    ["retired direct result", "ir-hir", callback.replace('PreparedSyntaxSlot<P["Identifier"], Image>', 'P["Identifier"]')],
    ["mapped slot inventory", "ir-hir", 'export type SyntaxPhaseCopy<P extends Phase, Stop, Image> = { readonly [Slot in keyof Phase]: (value: P[Slot]) => SyntaxCopyResult<PreparedSyntaxSlot<P[Slot], Image>, Stop> };'],
    ["outside HIR", "ir-types", callback],
  ];
  for (const [description, owner, text] of opposites) {
    const invalid = path(owner);
    await fixture([[invalid, [...declarations, text].join("\n")]], async ({ root, deps }) => {
      const report = await compileIsolated(deps, module(owner),
        { root, sourceFiles: [invalid], interfaceSources: [], declarationSources: [], outputDirectory: ".temp/isolation" });
      assert.equal(report.status, "failed", description);
      assert.equal(report.findings.some(finding => finding.code === "contract-shape" && finding.path === invalid && finding.line === 4),
        true, `${description}: ${label(report)}`);
    });
  }
  for (const invalid of [
    [declarations[1].replace("readonly value: Value", "readonly value: Value | null"), declarations[2]],
    [declarations[1], declarations[2].replace("(image: Image)", "(image?: Image)")],
    [declarations[1], declarations[2].replace("=> Value", "=> Value | null")],
    [declarations[1], declarations[2].replace("(image: Image)", "(image: Value)")],
  ]) await fixture([[contract, [declarations[0], ...invalid, callback].join("\n")]], async ({ root, deps }) => {
      const report = await compileIsolated(deps, module("ir-hir"),
        { root, sourceFiles: [contract], interfaceSources: [], declarationSources: [], outputDirectory: ".temp/isolation" });
      assert.equal(report.status, "failed", label(report));
      assert.equal(report.findings.some(finding => finding.code === "contract-shape" && finding.path === contract && finding.line === 4),
        true, label(report));
    });
});

test("HIR admits only its own exact Parameter initializer field and ready-expression port", async () => {
  const phase = 'export interface Phase { readonly ParameterInitializer: object | null; readonly Other: null; }';
  const carrier = 'export interface ParameterDeclaration<P extends Phase> { readonly kind: "Parameter"; readonly initializer: P["ParameterInitializer"]; }';
  const expression = 'export interface Expression<P extends Phase> { readonly kind: "Expression"; readonly phase: P; }';
  const reader = 'export type SyntaxExpressionImage<P extends Phase> = (expression: Expression<P>) => Expression<P>;';
  const image = 'export type SyntaxInitializerImage<P extends Phase, Image> = (parameter: ParameterDeclaration<P>, expression: SyntaxExpressionImage<P>, image: Image) => P["ParameterInitializer"];';
  const contract = path("ir-hir");
  const entry = path("ir-hir", "index.ts");
  await fixture([[contract, [phase, carrier, expression, reader, image,
    'export type Copy = <P extends Phase, Image>(value: ParameterDeclaration<P>, expression: SyntaxExpressionImage<P>, image: Image, translate: SyntaxInitializerImage<P, Image>) => ParameterDeclaration<P>;'].join("\n")],
    [entry, 'import type { Copy } from "./contract.js"; export const copy: Copy = (value, expression, image, translate) => ({ kind: "Parameter", initializer: translate(value, expression, image) });']],
    async ({ root, deps }) => {
      const report = await compileIsolated(deps, module("ir-hir"), { root, sourceFiles: [contract, entry], interfaceSources: [], declarationSources: [], outputDirectory: ".temp/isolation" });
      assert.equal(report.status, "passed", label(report));
    });
  for (const [description, owner, selected, projected, line] of [
    ["foreign field", "ir-hir", carrier.replace("readonly initializer", "readonly unrelated"), null, 2],
    ["foreign owner", "ir-types", carrier, null, 2],
    ["wrong key", "ir-hir", carrier.replace('P["ParameterInitializer"]', 'P["Other"]'), null, 2],
    ["mutable", "ir-hir", carrier.replace("readonly initializer", "initializer"), null, 2],
    ["runtime key", "ir-hir", carrier.replace("P extends Phase>", "P extends Phase, Key extends keyof Phase>").replace('P["ParameterInitializer"]', "P[Key]"), null, 2],
    ["crossed phase", "ir-hir", carrier, image.replace("Image>", "Image extends Phase>").replace('=> P[', '=> Image['), 5],
    ["foreign expression", "ir-hir", carrier, image.replace("expression: SyntaxExpressionImage<P>", "expression: ParameterDeclaration<P>"), 5],
    ["wrong result", "ir-hir", carrier, image.replace('P["ParameterInitializer"]', 'P["Other"]'), 5],
    ["optional input", "ir-hir", carrier, image.replace("image: Image", "image?: Image"), 5],
    ["rest input", "ir-hir", carrier, image.replace("image: Image", "...image: Image[]"), 5],
  ]) {
    const invalid = path(owner);
    await fixture([[invalid, [phase, selected, expression, reader, projected ?? ""].join("\n")]], async ({ root, deps }) => {
      const report = await compileIsolated(deps, module(owner),
        { root, sourceFiles: [invalid], interfaceSources: [], declarationSources: [], outputDirectory: ".temp/isolation" });
      assert.equal(report.status, "failed", description);
      assert.equal(report.findings.some(finding => finding.code === "contract-shape" && finding.path === invalid && finding.line === line),
        true, `${description}: ${label(report)}`);
    });
  }
});

test("HIR CallArguments selects only the exact closed phase slot", async () => {
  const phase = 'export interface Phase { readonly CallArguments: { readonly loc: number }; readonly Other: null; }';
  const argumentsOf = 'export type SyntaxCallArguments<P extends Phase> = P["CallArguments"];';
  const contract = path("ir-hir");
  const entry = path("ir-hir", "index.ts");
  await fixture([[contract, `${phase}\n${argumentsOf}\nexport type Borrow = <P extends Phase>(value: SyntaxCallArguments<P>) => SyntaxCallArguments<P>;`],
    [entry, 'import type { Borrow } from "./contract.js"; export const borrow: Borrow = value => value;']],
    async ({ root, deps }) => {
      const report = await compileIsolated(deps, module("ir-hir"), { root, sourceFiles: [contract, entry], interfaceSources: [],
        declarationSources: [], outputDirectory: ".temp/isolation" });
      assert.equal(report.status, "passed", label(report));
    });
  for (const [description, owner, alias] of [
    ["foreign owner", "ir-tir", argumentsOf],
    ["wrong name", "ir-hir", argumentsOf.replace("SyntaxCallArguments", "OtherArguments")],
    ["wrong key", "ir-hir", argumentsOf.replace('["CallArguments"]', '["Other"]')],
    ["runtime key", "ir-hir", argumentsOf.replace("P extends Phase>", "P extends Phase, Key extends keyof Phase>").replace('["CallArguments"]', "[Key]")],
    ["crossed phase", "ir-hir", argumentsOf.replace("P extends Phase>", "P extends Phase, Other extends Phase>").replace('= P[', '= Other[')],
  ]) {
    const invalid = path(owner);
    await fixture([[invalid, `${phase}\n${alias}`]], async ({ root, deps }) => {
      const report = await compileIsolated(deps, module(owner), { root, sourceFiles: [invalid], interfaceSources: [],
        declarationSources: [], outputDirectory: ".temp/isolation" });
      assert.equal(report.status, "failed", description);
      assert.equal(report.findings.some(finding => finding.code === "contract-shape" && finding.path === invalid && finding.line === 2),
        true, `${description}: ${label(report)}`);
    });
  }
});

test("HIR named headers require the matching same-Phase syntax owner", async () => {
  const phase = 'export interface Phase { readonly SourceFile: null; readonly FunctionDeclaration: null; }';
  const source = 'export interface SourceFileHeader<P extends Phase> { readonly kind: "SourceFile"; readonly tsonic: P["SourceFile"]; }';
  const functionHeader = 'export interface FunctionDeclarationHeader<P extends Phase> { readonly kind: "FunctionDeclaration"; readonly tsonic: P["FunctionDeclaration"]; }';
  const syntax = 'export interface SourceFile<P extends Phase> extends SourceFileHeader<P> { readonly count: number; }';
  const callable = 'export interface FunctionDeclaration<P extends Phase> extends FunctionDeclarationHeader<P> { readonly count: number; }';
  const contract = path("ir-hir");
  const entry = path("ir-hir", "index.ts");
  await fixture([[contract, [phase, source, functionHeader, syntax, callable,
    'export type Read = (input: SourceFile<Phase> | FunctionDeclaration<Phase>) => number;'].join("\n")],
    [entry, 'import type { Read } from "./contract.js"; export const read: Read = input => input.count;']], async ({ root, deps }) => {
    const report = await compileIsolated(deps, module("ir-hir"), { root, sourceFiles: [contract, entry], interfaceSources: [],
      declarationSources: [], outputDirectory: ".temp/isolation" });
    assert.equal(report.status, "passed", label(report));
  });
  for (const [description, owner, header, consumer] of [
    ["wrong role literal", "ir-hir", source.replace('kind: "SourceFile"', 'kind: "FunctionDeclaration"'), syntax],
    ["wrong slot", "ir-hir", source.replace('P["SourceFile"]', 'P["FunctionDeclaration"]'), syntax],
    ["not extended", "ir-hir", source, syntax.replace("extends SourceFileHeader<P>", "").replace("count: number", "phase: P")],
    ["foreign owner", "ir-types", source, syntax],
    ["wrong Phase argument", "ir-hir", source, syntax.replace("SourceFileHeader<P>", "SourceFileHeader<Phase>").replace("count: number", "phase: P")],
  ]) {
    const invalid = path(owner);
    await fixture([[invalid, [phase, header, consumer].join("\n")]], async ({ root, deps }) => {
      const report = await compileIsolated(deps, module(owner), { root, sourceFiles: [invalid], interfaceSources: [],
        declarationSources: [], outputDirectory: ".temp/isolation" });
      assert.equal(report.status, "failed", description);
      assert.equal(report.findings.some(finding => finding.code === "contract-shape" && finding.path === invalid && finding.line === 2),
        true, `${description}: ${label(report)}`);
    });
  }
});

const sdkContract = 'import type { CompilerExtension, SourceDeclarationProvider, SourceSemanticsModule } from "@tsonic/tsts";\nexport type CheckerExtensions = object & { readonly identityKind: "checker-extensions" };\nexport type CheckerExtensionValue = { readonly kind: "compiler-extension"; readonly value: CompilerExtension } | { readonly kind: "declaration-provider"; readonly value: SourceDeclarationProvider } | { readonly kind: "semantics-module"; readonly value: SourceSemanticsModule };\nexport type ExtensionOf = (table: CheckerExtensions, reference: number) => CheckerExtensionValue;';

test("front uses actual pinned SDK declarations and the sole closed ExtensionOf contract value port", async () => {
  const contract = path("front");
  const entry = path("front", "capture.ts");
  await fixture([[contract, sdkContract],
    [entry, 'import type { Type } from "@tsonic/tsts"; export function flags(deps: { readonly type: Type }, input: number): number { return deps.type.flags + input; }']], async ({ root, deps }) => {
    const report = await compileIsolated(deps, module("front"), { root, sourceFiles: [contract, entry], interfaceSources: [], declarationSources: [], outputDirectory: ".temp/isolation" });
    assert.equal(report.status, "passed", label(report));
    assert.equal(report.loadedInventory.some(file => file.includes("/packages/tsts/dist/")), true);
  });
});

test("real pipeline isolation emits only permitted component query types and the identical front brand", async () => {
  const contract = path("pipeline");
  const entry = path("pipeline", "index.ts");
  await fixture([[path("front"), sdkContract], [path("infer"), 'export type Infer = (deps: { readonly bias: number }, input: number) => number;'],
    [contract, 'import type { CheckerExtensions } from "../front/contract.js";\nexport type { CheckerExtensions } from "../front/contract.js";\nimport type { Infer } from "../infer/contract.js";\nexport interface Input { readonly extensions: CheckerExtensions; readonly infer: Infer; readonly value: number; }\nexport type Run = (input: Input) => number;'],
    [entry, 'import type { Run } from "./contract.js"; export const run: Run = input => input.infer({ bias: 1 }, input.value);']], async ({ root, deps }) => {
    const report = await compileIsolated(deps, module("pipeline"), { root, sourceFiles: [contract, entry], interfaceSources: [path("front"), path("infer")], declarationSources: [path("front"), path("infer")], outputDirectory: ".temp/isolation" });
    assert.equal(report.status, "passed", label(report));
    assert.equal(report.provenance.length, 2);
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
  assert.equal(modules.length, 32, "complete current contract owners");
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
    ...["index.ts", "arena.ts", "data.ts", "publication-fields.ts", "publication-read.ts", "work.ts", "value.ts", "interner.ts", "canonical.ts", "copy.ts", "text-readers.ts", "text-values.ts", "text-components.ts", "text-records.ts",
      "substitute.ts", "graph-stage.ts", "intern-graph.ts", "print.ts", "parse.ts", "verify.ts", "verify-bindings.ts", "selector-path.ts", "native-facts.ts", "native-facts-data.ts", "native-carrier.ts", "literal-compatibility.ts", "source-choice.ts"].map(name => `${host}/ir-types/${name}`),
    ...["index.ts", "pragmas.ts", "endpoints.ts", "children.ts", "walk.ts", "declaration-scopes.ts", "grouping-frontier.ts", "print.ts", "parse.ts", "verify.ts", "verify-syntax.ts",
      "child-slot-storage.ts", "control-slots.ts", "declaration-slots.ts", "documentation-slots.ts", "expression-slots.ts", "header-slots.ts", "jsx-slots.ts", "module-slots.ts", "type-slots.ts",
      "copy-auxiliary.ts", "copy-expressions.ts", "copy-node.ts", "copy-statements.ts", "copy-syntax.ts", "copy-types.ts", "checked-phase-copy.ts",
      "binding-data.ts", "bindings.ts", "capture-data.ts", "verify-export-bindings.ts", "text-read-bindings.ts", "text-causes.ts",
      "verify-bindings.ts", "verify-captures.ts", "storage.ts", "storage-inputs.ts", "layout.ts", "text-data.ts", "text-syntax.ts", "text-construction.ts", "text-read-model.ts",
      "text-readers.ts", "text-read-scalars.ts", ...Array.from({ length: 10 }, (unusedValue, position) => `text-read-${position}.ts`),
      ...Array.from({ length: 14 }, (unusedValue, position) => `text-read-syntax-${position}.ts`)].map(name => `${host}/ir-hir/${name}`),
    ...["index.ts", "print.ts", "parse.ts", "text-layouts.ts", "text-construction.ts", "text-syntax-construction.ts",
      "text-model.ts", "text-body.ts", "text-phase-values.ts", "text-phase-declarations.ts", "text-type-values.ts",
      "text-rule-decisions.ts", "text-rule-inputs.ts", "text-captures.ts", "text-causes.ts", "text-memory.ts", "text-syntax-values.ts",
      "text-syntax-statements.ts", "text-syntax-types.ts", "text-syntax-jsx.ts", "text-syntax-docs.ts",
      "verify.ts", "verify-occurrences.ts", "verify-applications.ts", "verify-instances.ts", "chapter-syntax.ts", "selection-key.ts", "syntax-compare.ts",
      ...["common", "docs", "jsx", "statements", "types", "values"].map(name => `syntax-compare-${name}.ts`)].map(name => `${host}/ir-tir/${name}`),
    ...["capture-law.ts", "index.ts", "inferred-parts.ts", "parse.ts", "print.ts", "text-capture-values.ts", "text-captures.ts", "text-errors.ts",
      "text-constraints.ts", "text-contributions.ts", "text-data.ts", "text-decision-values.ts",
      "text-decisions.ts", "text-evidence.ts", "text-invocations.ts", "text-operations.ts", "text-pointers.ts",
      "text-rule-inputs.ts", "verify-contributions.ts", "verify-solution.ts", "verify.ts"].map(name => `${host}/ir-infer/${name}`),
    ...["constant-projection.ts", "index.ts", "local-ownership.ts", "parse.ts", "print.ts", "project-values.ts", "text-decisions.ts", "text.ts", "verify-control.ts",
      "verify-storage.ts", "verify-laws.ts", "verify-types.ts", "verify.ts"].map(name => `${host}/ir-mir/${name}`),
    ...["canonical-facts.ts", "canonical-phase.ts", "canonical-syntax.ts", "chapter-projection.ts",
      "canonical-tir.ts", "canonical-types.ts", "canonical.ts", "data.ts", "index.ts", "instantiate-facts.ts",
      "instantiate-phase.ts", "instantiate-syntax.ts", "instantiate-tir.ts",
      "instantiate.ts", "initialization-text.ts", "parse-core.ts", "parse-diagnostics.ts", "parse-inference.ts",
      "parse-phase-declarations.ts", "parse-phase.ts", "parse-syntax-auxiliary.ts",
      "parse-syntax-expressions.ts", "parse-syntax-jsdoc.ts", "parse-syntax-references.ts",
      "parse-syntax-statements.ts", "parse-syntax-types.ts", "parse-syntax-values.ts", "parse-syntax.ts",
      "parse-tir.ts", "parse-types.ts", "parse-values.ts", "parse.ts", "print-syntax-auxiliary.ts",
      "print-syntax-expressions.ts", "print-syntax-statements.ts", "print-syntax-types.ts", "print-syntax.ts",
      "print.ts", "program-values.ts", "syntax-arena.ts", "text-core.ts", "text-causes.ts", "text-inference.ts",
      "text-module-bindings.ts", "verify-module-bindings.ts",
      "text-phase-declarations.ts", "text-phase.ts", "text-tir.ts", "text-types.ts", "text-values.ts",
      "verify-index.ts", "verify-initialization.ts", "verify-module.ts", "verify-structure.ts", "verification-work.ts", "verify-metadata-operands.ts", "work.ts", "work-data.ts"].map(name => `${host}/ir-program/${name}`),
    ...["account.ts", "components.ts", "dominators.ts", "graph.ts", "index.ts", "loops.ts", "ordering.ts", "solve.ts"].map(name => `${host}/dataflow/${name}`),
    ...["index.ts", "conditions.ts", "conditions-data.ts", "parse.ts", "print.ts", "dependency-data.ts", "execution-entry.ts", "verify-dependencies.ts", "verify-facts.ts", "verify-metadata.ts",
      "verify-relations.ts", "verify-summary.ts", "summary-key.ts", "escape-key.ts", "verify-observations.ts", "application-data.ts", "apply-initialization.ts",
      "apply-summary.ts", "apply-values.ts", "arena-data.ts", "binding-inputs.ts", "cells-data.ts", "initialization-data.ts", "mir-point.ts",
      "relations-data.ts", "summary-data.ts", "summary-equals.ts", "verification.ts", "verify-bindings.ts", "verify-body-nodes.ts", "verify-cells.ts",
      "verify-initialization.ts", "verify-liveness.ts", "verify-position.ts"].map(name => `${host}/ir-facts/${name}`),
    ...["index.ts", "roles.ts", "verify-catalogue.ts", "admit-guarantees.ts", "verify-summaries.ts",
      "verify-bound.ts", "provider-catalogue.ts"].map(name => `${host}/libraries/${name}`),
    ...["index.ts", "bind-declared.ts", "declared-work.ts", "translate-native.ts", "unknown-declared.ts", "components.ts", "dependencies.ts", "converge.ts"].map(name => `${host}/summaries/${name}`),
    ...["index.ts", "round.ts", "storage.ts", "source.ts", "proof.ts", "calls.ts", "captures.ts", "exits.ts",
      "field-effects.ts", "initialization.ts", "open-calls.ts", "places.ts", "static-calls.ts", "value-flow.ts", "values.ts", "writes.ts"].map(name => `${host}/analyses/body/${name}`),
    ...["index.ts", "model.ts", "storage-use.ts"].map(name => `${host}/analyses/liveness/${name}`),
    ...["index.ts", "verify-extensions.ts", "verify-packages.ts", "verify.ts"].map(name => `${host}/snapshot/${name}`),
    ...["index.ts"].map(name => `${host}/step/${name}`),
    ...["database.ts", "index.ts", "memo.ts"].map(name => `${host}/query/${name}`),
    ...["bindings.ts", "capture.ts", "checker.ts", "diagnostics.ts", "handles.ts", "identities.ts", "index.ts",
      "interface-description.ts", "literals.ts", "lower.ts", "lower-calls.ts", "lower-exports.ts", "lower-imports.ts", "lower-layout.ts", "lower-members.ts", "checked-declarations.ts", "source-bodies.ts",
      "type-conversion.ts", "options.ts", "program-data.ts", "provider-model.ts", "syntax-capture.ts", "syntax-support.ts"].map(name => `${host}/front/${name}`),
    ...["definitions.ts", "index.ts", "placement.ts", "signatures.ts", "cycles.ts", "enums.ts", "members.ts", "type-production.ts"].map(name => `${host}/decls/${name}`),
    ...["embed.ts", "errors.ts", "frontier.ts", "index.ts", "literal-default.ts", "literal-fit.ts", "member-pause.ts", "operators.ts", "schemes.ts", "variables.ts",
      "candidates.ts", "captures.ts", "type-pattern.ts"].map(name => `${host}/rules/${name}`),
    ...["constraints.ts", "frontier.ts", "groups.ts", "index.ts", "member-pause.ts", "own-signature.ts", "solve.ts",
      "candidates.ts", "captures.ts"].map(name => `${host}/infer/${name}`),
    ...["elaborate.ts", "index.ts", "module.ts", "declarations.ts", "imports.ts"].map(name => `${host}/elaborate/${name}`),
    ...["checked-inputs.ts", "driver.ts", "external-entries.ts", "infer-deps-step.ts", "inference-step.ts", "lower-mir-step.ts", "module-initialization.ts", "semantic-queries.ts", "wiring.ts",
      "analysis-barrier.ts", "analysis-stop.ts", "index.ts", "layout-queries.ts", "publication.ts", "required-executions.ts", "source-barrier.ts", "static-values.ts", "typed-barrier.ts"].map(name => `${host}/pipeline/${name}`),
    ...["index.ts", "production.ts"].map(name => `${host}/validate/${name}`),
    ...["index.ts", "lower.ts", "state.ts", "model.ts", "operands.ts", "control.ts", "calls.ts", "bindings.ts"].map(name => `${host}/lower-mir/${name}`),
    ...["budget.ts", "comparison.ts", "conversions.ts", "data.ts", "index.ts", "integer.ts", "machine.ts", "pause.ts"].map(name => `${host}/evaluate/${name}`),
    ...["index.ts", "materialize.ts"].map(name => `${host}/metadata/${name}`)].sort();
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
    const declarations = new Set(interfaces);
    for (const source of declarations) for (const edge of graph) if (edge.source === source && edge.target !== null && edge.kind !== "loader")
      declarations.add(edge.target);
    assert.equal(report.provenance.length >= interfaces.length, true, "every public dependency has genuine fresh declaration provenance");
    assert.equal(report.provenance.every(entry => declarations.has(relative(repository, entry.source))), true,
      "every staged private type is in the actual public declaration-production closure");
    assert.deepEqual(report.loadedInventory.filter(path => path.includes("/isolated/") && path.endsWith(".d.ts")).sort(),
      report.provenance.map(entry => entry.declaration).sort(), "all actual staged declaration inputs have exact source provenance");
    assert.equal(report.sourceInventory.length, closure.size, "complete explicit original module source closure");
  });
});

test("A7 through A13 genuine emitted contracts accept current forms and reject every superseded receiving form", async () => {
  await fixture([], async ({ root, deps, write }) => {
    const imports = entries => entries.map(([owner, names]) =>
      `import type { ${names} } from ${JSON.stringify(resolve(repository, "packages/host/dist", owner, "contract.js"))};`).join("\n");
    const rows = [
      ["old-mir", [["ir-mir", "VerifyMir, MirBody"], ["ir-tir", "TirBody"], ["ir-types", "TypeOf, SignatureOf"]],
        "export function read(verify: VerifyMir, body: MirBody, source: TirBody, typeOf: TypeOf, signatureOf: SignatureOf) { return verify(body, source, typeOf, signatureOf); }", 2554],
      ["removed-decls-inputs-name", [["decls", "DeclsInputs"]],
        "export function read(deps: DeclsInputs) { return deps; }", 2305],
      ["removed-pipeline-error-data-alias", [["pipeline", "SemanticCycleErrorData"]],
        "export function read(data: SemanticCycleErrorData) { return data; }", 2305],
      ["old-mir-context", [["ir-mir", "MirVerificationContext"]],
        "export function read(context: MirVerificationContext) { const { bodyOwner, ...legacy } = context; void bodyOwner; const current: MirVerificationContext = legacy; return current; }", 2741],
      ["old-hir-body-path-context", [["ir-hir", "HirVerificationContext"]],
        "export function read(context: HirVerificationContext) { const { bodyPathOf, ...legacy } = context; void bodyPathOf; const current: HirVerificationContext = legacy; return current; }", 2741],
      ["old-hir-definition-path-context", [["ir-hir", "HirVerificationContext"]],
        "export function read(context: HirVerificationContext) { const { definitionPathOf, ...legacy } = context; void definitionPathOf; const current: HirVerificationContext = legacy; return current; }", 2741],
      ["old-backward", [["dataflow", "BackwardProblem, BlockState"], ["ir-mir", "MirTerminator"]],
        "export function read(problem: BackwardProblem<number>, term: MirTerminator, states: readonly BlockState<number>[]) { return problem.terminator(term, states); }", 2554],
      ["old-program-context", [["ir-program", "ProgramVerificationContext"]],
        "export function read(context: ProgramVerificationContext) { const { resources, ...legacy } = context; const current: ProgramVerificationContext = { ...legacy, limits: resources }; return current; }", 2353],
      ["old-program-signature-context", [["ir-program", "ProgramVerificationContext"]],
        "export function read(context: ProgramVerificationContext) { const { signatureIdOf, ...legacy } = context; void signatureIdOf; const current: ProgramVerificationContext = legacy; return current; }", 2741],
      ["old-program-module-path-context", [["ir-program", "ProgramVerificationContext"]],
        "export function read(context: ProgramVerificationContext) { const { modulePathOf, ...legacy } = context; void modulePathOf; const current: ProgramVerificationContext = legacy; return current; }", 2741],
      ["old-program-definition-path-context", [["ir-program", "ProgramVerificationContext"]],
        "export function read(context: ProgramVerificationContext) { const { definitionPathOf, ...legacy } = context; void definitionPathOf; const current: ProgramVerificationContext = legacy; return current; }", 2741],
      ["removed-unpaid-seed", [["ir-types", "SeedTypeInterner"]],
        "export type Removed = SeedTypeInterner;", 2724],
      ["admit-table-without-work", [["ir-types", "AdmitTypeTable, TypeTable"]],
        "export function read(admit: AdmitTypeTable, table: TypeTable) { return admit(table); }", 2554],
      ["publication-without-usage", [["ir-types", "TypePublication, TypePublicationResult"]],
        "export function read(value: TypePublication) { const result: TypePublicationResult = { kind: 'complete', value }; return result; }", 2322],
      ["tir-module-without-module", [["ir-tir", "VerifyTirModule, TirVerifierInput"]],
        "export function read(verify: VerifyTirModule, input: TirVerifierInput) { return verify(input); }", 2554],
      ["tir-without-admission", [["ir-tir", "VerifyTir, TirVerifierInput"]],
        "export function read(verify: VerifyTir, input: TirVerifierInput) { return verify(input); }", 2554],
      ["tir-without-bound-invocation", [["ir-tir", "VerifyTir, TirBody, TirReadyReadAdmission, TirVerifierInput"]],
        "export function read<Stop extends object>(verify: VerifyTir, input: TirVerifierInput, body: TirBody, admit: TirReadyReadAdmission<Stop>) { return verify(input, body, admit); }", 2554],
      ["tir-module-without-admission", [["ir-tir", "VerifyTirModule, TirVerifierInput"]],
        "export function read(verify: VerifyTirModule, input: TirVerifierInput) { return verify(input, input.module); }", 2554],
      ["tir-scope-without-subject-and-visitor", [["ir-tir", "TirBindingTarget, TirVerifierInput"]],
        "export function read(input: TirVerifierInput, target: TirBindingTarget) { return input.bindingScopesOf(target); }", 2554],
      ["tir-removed-binding-owner-projection", [["ir-tir", "TirBindingOwners"]],
        "export type Removed = TirBindingOwners;", 2724],
      ["tir-closed-source-file-phase", [["ir-tir", "TypedSourceFile"]],
        "export function read(phase: TypedSourceFile) { const invalid: TypedSourceFile = { ...phase, checker: phase }; return invalid; }", 2353],
      ["tir-closed-nested-phase", [["ir-types", "BindingVector"]],
        "export function read(bindings: BindingVector) { const invalid: BindingVector = { ...bindings, views: bindings }; return invalid; }", 2353],
      ["tir-removed-reflective-rule", [["ir-tir", "TirRule"]],
        "export function read(): TirRule { return 'no-checker-payload'; }", 2322],
      ["old-tir-flat-binding-scopes", [["ir-tir", "TirVerifierInput"]],
        "export function read(input: TirVerifierInput) { const { bindingScopesOf, ...legacy } = input; void bindingScopesOf; const old = { ...legacy, bindingScopes: [] }; const current: TirVerifierInput = old; return current; }", 2741],
      ["tir-site-with-body-node", [["ir-tir", "TirSite"], ["ids", "NodeRef"]],
        "export function read(node: NodeRef) { const site: TirSite = { kind: 'node', node }; return site; }", 2322],
      ["tir-module-with-body-site", [["ir-tir", "VerifyTirModule"], ["ids", "BodyId"]],
        "export function read(body: BodyId): VerifyTirModule { return () => ({ kind: 'complete', violations: [{ rule: 'body-owner', site: { kind: 'body', body }, detail: [] }] }); }", 2322],
      ["signature-with-type-root", [["ir-types", "SubstituteSignature, TypeInterner, BindingVector, TypeExpansionLimits, TypePublicationWork"], ["ids", "TyId"]],
        "export function read(substitute: SubstituteSignature, interner: TypeInterner, type: TyId, bindings: BindingVector, limits: TypeExpansionLimits, work: TypePublicationWork) { return substitute(interner, [type], bindings, limits, 'lexical', work); }", 2322],
      ["removed-scalar-substitute", [["ir-types", "Substitute, TypeInterner, BindingVector, TypeExpansionLimits, TypePublicationWork"], ["ids", "TyId"]],
        "export function read(substitute: Substitute, interner: TypeInterner, type: TyId, bindings: BindingVector, limits: TypeExpansionLimits, work: TypePublicationWork) { return substitute(interner, type, bindings, limits, work); }", 2345],
      ["removed-scalar-signature-substitute", [["ir-types", "SubstituteSignature, TypeInterner, BindingVector, TypeExpansionLimits, TypePublicationWork"], ["ids", "SigId"]],
        "export function read(substitute: SubstituteSignature, interner: TypeInterner, signature: SigId, bindings: BindingVector, limits: TypeExpansionLimits, work: TypePublicationWork) { return substitute(interner, signature, bindings, limits, 'selected', work); }", 2345],
      ["signature-without-substitution-mode", [["ir-types", "SubstituteSignature, TypeInterner, BindingVector, TypeExpansionLimits"], ["ids", "SigId"]],
        "export function read(substitute: SubstituteSignature, interner: TypeInterner, signature: SigId, bindings: BindingVector, limits: TypeExpansionLimits) { return substitute(interner, [signature], bindings, limits); }", 2554],
      ["signature-with-mode-without-commitment", [["ir-types", "SubstituteSignature, TypeInterner, BindingVector, TypeExpansionLimits"], ["ids", "SigId"]],
        "export function read(substitute: SubstituteSignature, interner: TypeInterner, signature: SigId, bindings: BindingVector, limits: TypeExpansionLimits) { return substitute(interner, [signature], bindings, limits, 'lexical'); }", 2554],
      ["signature-with-unknown-substitution-mode", [["ir-types", "SubstituteSignature, TypeInterner, BindingVector, TypeExpansionLimits, TypePublicationWork"], ["ids", "SigId"]],
        "export function read(substitute: SubstituteSignature, interner: TypeInterner, signature: SigId, bindings: BindingVector, limits: TypeExpansionLimits, work: TypePublicationWork) { return substitute(interner, [signature], bindings, limits, 'implicit', work); }", 2345],
      ["deleted-program-id-history-rule", [["ir-program", "ProgramRule"]],
        "export function read() { const rule: ProgramRule = 'instantiation-preserves-existing-ids'; return rule; }", 2322],
      ["old-binding-element", [["ir-tir", "TypedBinding, TypedBindingElement"]],
        "export function read(binding: TypedBinding) { const current: TypedBindingElement = binding; return current; }", 2322],
      ["old-library-binding", [["libraries", "LibraryExportBinding"]],
        "export type Removed = LibraryExportBinding;", 2724],
      ["old-library-context", [["libraries", "LibraryVerificationContext"]],
        "export type Removed = LibraryVerificationContext;", 2724],
      ["old-library-projection", [["libraries", "LibraryRoleVerificationContext"], ["ids", "LibraryExportIdentity"]],
        "export function read(context: LibraryRoleVerificationContext, identity: LibraryExportIdentity) { return context.signatureOfExport(identity); }", 2339],
      ["old-summary-single-input", [["summaries", "BindDeclaredSummary, DeclaredSummaryInput"]],
        "export function read(bind: BindDeclaredSummary, input: DeclaredSummaryInput) { return bind(input); }", 2554],
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
      ["dataflow", "BackwardProblem, BlockState, DataflowAccount"], ["ir-program", "ProgramVerificationContext, SupportedProgramSchema, SignatureRecord, PublishedBody"],
      ["ir-types", "AdmitTypeTable, TypeTableAdmissionStop, TypeTableAdmissionWork, TypePublicationWork, TypeTable, TypePublicationResult, SubstituteSignature, TypeInterner, BindingVector, TypeExpansionLimits"],
      ["ir-tir", "TypedBinding, TypedBindingElement, VerifyTir, VerifyTirModule, TirVerifierInput, TirModule, TirBody, TirSite, TirReadyReadAdmission"], ["libraries", "LibraryRoleVerificationContext"],
      ["ids", "LibraryExportIdentity, ModuleId, NodeId, BlockId, SigId"],
    ]) + '\nexport function current<Stop extends TypeTableAdmissionStop>(verify: VerifyMir, body: MirBody, mir: MirVerificationContext, problem: BackwardProblem<number>, account: DataflowAccount, term: MirTerminator, states: readonly BlockState<number>[], program: ProgramVerificationContext, binding: TypedBinding, libraries: LibraryRoleVerificationContext, identity: LibraryExportIdentity, admitTable: AdmitTypeTable, table: TypeTable, typeWork: TypeTableAdmissionWork<Stop>, record: SignatureRecord, block: BlockId) {\nconst element: TypedBindingElement = { ...binding, role: "binding" }; const hole: TypedBindingElement = { role: "hole" };\nconst schema: SupportedProgramSchema = 1; const definition = libraries.definitionOfExport(identity);\nreturn { findings: verify(body, mir), before: problem.terminator(term, states, null, account, block), resources: program.resources, mirVerification: program.mirVerification, element, hole, schema, definition, interner: admitTable(table, typeWork), signature: program.signatureIdOf(record.definition, record.kind, record.ordinal, record.bindings) };\n}\n';
    write("positive.mts", positive + '\nexport function currentPublication(result: TypePublicationResult) { return result.kind === "complete" ? [result.work, result.createdRecords] : null; }\nexport function currentTir<Stop extends object>(verifyBody: VerifyTir, verifyModule: VerifyTirModule, input: TirVerifierInput, body: TirBody, module: TirModule, admit: TirReadyReadAdmission<Stop>) { const outside = verifyModule(input, module, admit); return { body: verifyBody(input, admit)(body), outside: outside.kind === "complete" ? outside.violations.map(violation => [violation.site.module, violation.site.node]) : outside.stop }; }\nexport function currentTirSite(module: ModuleId, node: NodeId): TirSite { return { kind: "node", module, node }; }\nexport function currentProgramSignature(substitute: SubstituteSignature, interner: TypeInterner, artifact: PublishedBody, bindings: BindingVector, limits: TypeExpansionLimits, work: TypePublicationWork) { return substitute(interner, [artifact.tir.signature], bindings, limits, "lexical", work); }\nexport function currentSelectedSignature(substitute: SubstituteSignature, interner: TypeInterner, signature: SigId, bindings: BindingVector, limits: TypeExpansionLimits, work: TypePublicationWork) { return substitute(interner, [signature], bindings, limits, "selected", work); }\n');
    write("positive-hir-paths.mts", imports([["ir-hir", "HirVerificationContext, HirRule"], ["ids", "BodyId, DefId"]]) +
      '\nexport function current(context: HirVerificationContext, body: BodyId, definition: DefId) { const rule: HirRule = "identity-path-exact"; return { body: context.bodyPathOf(body), definition: context.definitionPathOf(definition), rule }; }\n');
    write("positive-program-paths.mts", imports([["ir-program", "ProgramVerificationContext, ProgramRule"], ["ids", "ModuleId, DefId"]]) +
      '\nexport function current(context: ProgramVerificationContext, module: ModuleId, definition: DefId) { const rule: ProgramRule = "identity-path-exact"; return { module: context.modulePathOf(module), definition: context.definitionPathOf(definition), rule }; }\n');
    write("positive-tir-scopes.mts", imports([["ir-tir", "TirVerifierInput, TirBindingTarget, TirBindingOwnerVisit, TirReadyReadAdmission, TirBody, VerifyTir, VerifyTirModule"], ["ir-types", "BodyInstance"]]) +
      '\nexport function current<Stop extends object>(input: TirVerifierInput, subject: TirBody, instance: BodyInstance, visit: TirBindingOwnerVisit<Stop>, admit: TirReadyReadAdmission<Stop>, verify: VerifyTir, verifyModule: VerifyTirModule): Stop | null { const body: TirBindingTarget = { kind: "body", instance }; const scope = input.bindingScopesOf(body, subject, visit); if (scope.kind === "resource-stop") return scope.stop; const checked = verify(input, admit)(subject); if (checked.kind === "resource-stop") return checked.stop; const chapter = verifyModule(input, input.module, admit); return chapter.kind === "resource-stop" ? chapter.stop : null; }\n');
    write("positive-decls-deps.mts", imports([["decls", "DeclsDeps"]]) +
      '\nexport function current(deps: DeclsDeps) { return deps.modules; }\n');
    write("positive-library-association.mts", imports([["summaries", "DeclaredSummaryInput"], ["libraries", "NativeExportAssociation"]]) +
      '\nexport function current(input: DeclaredSummaryInput): readonly NativeExportAssociation[] | null { return input.kind === "native" ? input.associations : null; }\n');
    for (const [name, entries, text] of rows) write(name + ".mts", imports(entries) + "\n" + text + "\n");
    write("tsconfig.json", JSON.stringify({ compilerOptions: {
      strict: true, noUncheckedIndexedAccess: true, exactOptionalPropertyTypes: true, noUnusedLocals: true,
      noUnusedParameters: true, noImplicitReturns: true, noFallthroughCasesInSwitch: true, skipLibCheck: false,
      noEmit: true, target: "es2022", lib: ["es2022"], types: [], module: "nodenext", moduleResolution: "nodenext",
      verbatimModuleSyntax: true,
    }, files: ["positive.mts", "positive-hir-paths.mts", "positive-program-paths.mts", "positive-tir-scopes.mts", "positive-decls-deps.mts",
      "positive-library-association.mts", ...rows.map(([name]) => name + ".mts")] }));
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

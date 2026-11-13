import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, posix, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { hostCatalogue } from "./host/catalogue.mjs";
import { parseSources } from "./host/import-graph.mjs";
import { createInspectionDeps, inspectHost } from "./host/inspect.mjs";

const repository = fileURLToPath(new URL("../../", import.meta.url));
const quarantineDataPath = process.env.TSONIC_HOST_QUARANTINE_AREAS ?? resolve(repository, "test/architecture/quarantine/areas.json");
const quarantineData = JSON.parse(readFileSync(quarantineDataPath, "utf8"));
const quarantineRoots = quarantineData.areas.map(area => area.directory);
const inspectionDeps = createInspectionDeps(quarantineRoots);
const referenceRoot = quarantineRoots[0];
const host = quarantineData.currentRoots.hostSource;
const file = (module, name = "unit.ts") => `${host}/${module}/${name}`;
const data = "export interface Data { readonly value: number; }";
const first = ["ids", "diag", "ir-types", "ir-hir", "ir-tir", "ir-mir", "ir-facts"];
const expectedImports = ([
  ["ids", []], ["diag", ["ids"]], ["ir-types", first.slice(0, 2)], ["ir-hir", first.slice(0, 3)],
  ["ir-infer", [...first.slice(0, 4), "step"]], ["ir-tir", [...first.slice(0, 4), "ir-infer"]], ["ir-mir", [...first.slice(0, 5), "ir-infer"]], ["ir-facts", [...first.slice(0, 6), "ir-infer", "snapshot"]],
  ["ir-program", [...first, "ir-infer"]], ["dataflow", ["ids", "diag", "ir-mir"]], ["query", ["ids", "diag"]],
  ["libraries", ["ids", "diag", "ir-types", "ir-facts", "ir-tir", "snapshot"]], ["snapshot", ["ids", "diag"]], ["step", []],
  ["front", [...first.slice(0, 4), "libraries", "snapshot"]], ["decls", [...first.slice(0, 4), "libraries", "ir-infer", "step"]],
  ["rules", [...first.slice(0, 4), "libraries", "ir-infer"]], ["infer", [...first.slice(0, 4), "dataflow", "ir-infer", "step"]],
  ["elaborate", [...first.slice(0, 5), "ir-infer", "step"]], ["validate", [...first.slice(0, 5), "libraries", "ir-infer"]],
  ["lower-mir", [...first.slice(0, 6), "ir-infer"]], ["evaluate", [...first.slice(0, 6), "libraries", "ir-infer", "step"]],
  ["metadata", [...first.slice(0, 4), "ir-facts", "step"]],
  ...["liveness", "initialization", "refinements", "origins", "suspension", "errorStorage", "pointerBacking"].map(name => [`analyses/${name}`, [...first, "dataflow", ...(["refinements", "origins", "pointerBacking"].includes(name) ? ["ir-infer"] : [])]]),
  ["summaries", [...first, "dataflow", "ir-infer"]],
  ["pipeline", [...first.slice(0, 4), "ir-infer", ...first.slice(4), "ir-program", "dataflow", "query", "libraries", "snapshot", "step", "front", "decls", "rules", "infer", "elaborate", "validate", "lower-mir", "evaluate", "metadata",
    "analyses/liveness", "analyses/initialization", "analyses/refinements", "analyses/origins", "analyses/suspension", "analyses/errorStorage", "analyses/pointerBacking", "summaries"]],
  ...["project", "packages", "plugins", "artifacts"].map(name => [name, ["ids", "diag", "snapshot"]]),
  ["orchestration", ["ids", "diag", "snapshot", "ir-program", "pipeline", "project", "packages", "plugins", "artifacts"]],
  ["cli", ["orchestration", "diag", "snapshot"]], ["create-tsonic", ["orchestration", "diag", "snapshot"]],
]);

const effectsCatalogue = (hostCatalogue.map(module => ["driver", "orchestration"].includes(module.kind)
  ? ({ ...module, effects: ([({ path: `${module.directory}/effects.ts`, role: module.name === "plugins" ? "plugin-loading" : "effects" })]) }) : module));

function inspect(entries, extra = {}, authority = hostCatalogue) {
  const parent = resolve(repository, ".temp/host-s1-structure");
  mkdirSync(parent, { recursive: true });
  const root = mkdtempSync(resolve(parent, "case-"));
  try {
    for (const [path, text] of entries) {
      mkdirSync(dirname(resolve(root, path)), { recursive: true });
      writeFileSync(resolve(root, path), text);
    }
    return inspectHost({ ...inspectionDeps, catalogue: authority }, { root, files: entries.map(([path]) => path), catalogue: authority,
      loadedFiles: [], configurations: [], ...extra });
  } finally { rmSync(root, { recursive: true }); }
}

function expect(entries, expected, authority = hostCatalogue) {
  const actual = inspect(entries, {}, authority);
  assert.equal(JSON.stringify(actual), JSON.stringify(expected), `${entries.map(([path]) => path).join(",")}: exact scalar findings ${JSON.stringify(actual)}`);
}

const at = (code, path, line = 1, column = 1) => ({ code, path, line, column });

test("the complete R6 catalogue and snapshot amendment have exactly one explicit row per owner", () => {
  assert.equal(hostCatalogue.length, 39);
  assert.equal(JSON.stringify(hostCatalogue.map(module => [module.name, module.imports])), JSON.stringify(expectedImports));
  assert.equal(hostCatalogue.filter(module => ["library", "component"].includes(module.kind)).every(module => module.effects.length === 0), true);
  assert.equal(JSON.stringify(hostCatalogue.filter(module => module.effects.length > 0).map(module => [module.name, module.effects])),
    JSON.stringify(["project", "packages", "plugins", "artifacts", "orchestration"].map(name => [name,
      [{ path: `${host}/${name}/effects.ts`, role: name === "plugins" ? "plugin-loading" : "effects" }]])));
  assert.equal(hostCatalogue.filter(module => module.kind === "library").length, 14);
  assert.equal(hostCatalogue.filter(module => module.kind === "component").length, 17);
});

test("invariant owners are exactly the written catalogue module names above ids", () => {
  const path = file("diag", "contract.ts");
  const source = parseSources(new Map([[path, readFileSync(resolve(repository, path), "utf8")]]));
  const actualFile = source.sourceFiles.find(candidate => candidate !== undefined && source.ast.getFileName(candidate) === `/host-gate/${path}`);
  const declaration = source.ast.statements(actualFile).find(candidate => source.ast.is.IsTypeAliasDeclaration(candidate) &&
    source.ast.text(source.ast.name(candidate)) === "InvariantOwner");
  assert.equal(declaration !== undefined, true, "diag declares the one invariant owner domain");
  const annotation = source.ast.typeNode(declaration);
  assert.equal(source.ast.is.IsUnionTypeNode(annotation), true, "the owner domain is a written union, not an alias or projection");
  const members = source.ast.children(annotation).filter(candidate => candidate !== undefined);
  assert.equal(members.every(member => source.ast.is.IsLiteralTypeNode(member)), true, "every owner arm is explicit");
  const literals = members.map(member => source.ast.as.AsLiteralTypeNode(member).Literal);
  assert.equal(literals.every(literal => source.ast.is.IsStringLiteral(literal)), true, "every owner is a literal module name");
  const actual = literals.map(literal => source.ast.text(literal)).sort();
  const expected = hostCatalogue.filter(module => module.name !== "ids").map(module => module.name).sort();
  assert.deepEqual(actual, expected);
});

for (const [name, imports] of expectedImports) {
  test(`catalogue ${name}: every actual allowed contract edge and one forbidden deep peer`, () => {
    const module = hostCatalogue.find(module => module.name === name);
    for (const targetName of imports) {
      const target = hostCatalogue.find(module => module.name === targetName);
      const sourcePath = `${module.directory}/unit.ts`;
      const specifier = posix.relative(module.directory, target.contract).replace(/\.ts$/u, ".js");
      expect([[sourcePath, `import type { Data } from "${specifier.startsWith(".") ? specifier : `./${specifier}`}"; export type Read = Data;`], [target.contract, data]], []);
    }
    const targetName = name === "ir-types" ? "ids" : "ir-types";
    const target = hostCatalogue.find(module => module.name === targetName);
    const sourcePath = `${module.directory}/unit.ts`;
    const targetPath = `${target.directory}/private.ts`;
    const relative = posix.relative(module.directory, targetPath).replace(/\.ts$/u, ".js");
    expect([[sourcePath, `import type { Data } from "${relative}"; export type Read = Data;`], [targetPath, data]], [at("forbidden-import", sourcePath)]);
  });
}

test("step is the one pause carrier: only the pausing operations, their rule contracts and Pipeline import it", () => {
  const importers = ["ir-infer", "decls", "infer", "elaborate", "evaluate", "metadata", "pipeline"];
  assert.deepEqual(hostCatalogue.filter(module => module.imports.includes("step")).map(module => module.name).sort(), [...importers].sort());
  const requestFree = hostCatalogue.filter(module => module.name.startsWith("analyses/") || module.name === "summaries");
  assert.equal(requestFree.length, 8);
  assert.equal(requestFree.some(module => module.imports.includes("step")), false, "request-free analysis and convergence have no pause path");
  const step = hostCatalogue.find(module => module.name === "step");
  assert.deepEqual(step.imports, []);
  for (const module of hostCatalogue.filter(candidate => candidate.name !== "step")) {
    const sourcePath = `${module.directory}/unit.ts`;
    const relative = posix.relative(module.directory, step.contract).replace(/\.ts$/u, ".js");
    expect([[sourcePath, `import type { Data } from "${relative.startsWith(".") ? relative : `./${relative}`}"; export type Read = Data;`], [step.contract, data]],
      importers.includes(module.name) ? [] : [at("forbidden-import", sourcePath)]);
  }
});

test("the decision vocabulary stays in ir-infer: the readers partition the catalogue, and a reader reaches no module outside its row", () => {
  const readers = ["ir-tir", "ir-mir", "ir-facts", "ir-program", "decls", "rules", "infer", "elaborate", "validate", "lower-mir", "evaluate",
    "analyses/refinements", "analyses/origins", "analyses/pointerBacking", "summaries", "pipeline"];
  const others = ["ids", "diag", "ir-types", "ir-hir", "ir-infer", "dataflow", "query", "libraries", "snapshot", "step", "front", "metadata",
    "analyses/liveness", "analyses/initialization", "analyses/suspension", "analyses/errorStorage",
    "project", "packages", "plugins", "artifacts", "orchestration", "cli", "create-tsonic"];
  assert.deepEqual([...readers, ...others].sort(), hostCatalogue.map(module => module.name).sort());
  assert.deepEqual(hostCatalogue.filter(module => module.imports.includes("ir-infer")).map(module => module.name).sort(), [...readers].sort());
  const decisions = hostCatalogue.find(module => module.name === "ir-infer");
  const privateFile = `${decisions.directory}/text-decision-values.ts`;
  for (const name of readers) {
    const module = hostCatalogue.find(candidate => candidate.name === name);
    const sourcePath = `${module.directory}/unit.ts`;
    const specifier = path => { const relative = posix.relative(module.directory, path).replace(/\.ts$/u, ".js"); return relative.startsWith(".") ? relative : `./${relative}`; };
    const importing = path => `import type { Data } from "${specifier(path)}"; export type Read = Data;`;
    expect([[sourcePath, importing(decisions.contract)], [decisions.contract, data]], []);
    expect([[sourcePath, importing(privateFile)], [privateFile, data]], [at("forbidden-import", sourcePath)]);
    for (const outside of hostCatalogue.filter(candidate => candidate.name !== name && !module.imports.includes(candidate.name)))
      expect([[sourcePath, importing(outside.contract)], [outside.contract, data]], [at("forbidden-import", sourcePath)]);
  }
  for (const name of others.filter(name => name !== "ir-infer")) {
    const module = hostCatalogue.find(candidate => candidate.name === name);
    const sourcePath = `${module.directory}/unit.ts`;
    const relative = posix.relative(module.directory, decisions.contract).replace(/\.ts$/u, ".js");
    expect([[sourcePath, `import type { Data } from "${relative.startsWith(".") ? relative : `./${relative}`}"; export type Read = Data;`], [decisions.contract, data]],
      [at("forbidden-import", sourcePath)]);
  }
});

test("actual type-only, import-type, value and re-export edges participate in cycles", () => {
  for (const prefix of ["import type { Data }", "import { Data }", "export type { Data }", "export { Data }"]) {
    const left = file("ids", "left.ts");
    const right = file("ids", "right.ts");
    expect([[left, `${prefix} from "./right.js";`], [right, `${prefix} from "./left.js";`]],
      [at("source-cycle", left), at("source-cycle", right)]);
  }
  expect([[file("ids", "left.ts"), 'export type Left = import("./right.js").Right;'],
    [file("ids", "right.ts"), 'export type Right = import("./left.js").Left;']],
  [at("source-cycle", file("ids", "left.ts"), 1, 20), at("source-cycle", file("ids", "right.ts"), 1, 21)]);
  expect([[file("unknown"), data]], [at("unknown-module", file("unknown"))]);
});

test("front alone owns the pinned SDK entry; all import forms keep the same boundary", () => {
  for (const text of ['import type { Type } from "@tsonic/tsts";', 'export type { Type } from "@tsonic/tsts";',
    'export type Raw = import("@tsonic/tsts").Type;', 'export function load(deps: { readonly input: number }, input: number): Promise<unknown> { return import("@tsonic/tsts"); }']) {
    assert.equal(inspect([[file("front"), text]]).length, 0, text);
    const result = inspect([[file("infer"), text]]);
    assert.equal(result.some(finding => finding.code === "forbidden-import"), true, text);
    assert.equal(result.every(finding => ["forbidden-import"].includes(finding.code)), true, text);
  }
  assert.equal(inspect([[file("front", "contract.ts"), 'import type { Type } from "@tsonic/tsts"; export type Raw = Type;']])
    .some(finding => finding.code === "forbidden-import"), true);
  expect([[file("front"), 'import type { Type } from "@tsonic/tsts/private";']], [at("forbidden-import", file("front"))]);
});

test("pipeline imports real component implementations; components do not import one another", () => {
  const component = file("infer");
  const implementation = "export function infer(deps: { readonly bias: number }, input: number): number { return deps.bias + input; }";
  expect([[file("pipeline"), 'import { infer } from "../infer/unit.js"; export function run(input: number): number { return infer({ bias: 1 }, input); }'],
    [component, implementation]], []);
  expect([[file("elaborate"), 'import { infer } from "../infer/unit.js"; export function run(deps: { readonly bias: number }, input: number): number { return infer(deps, input); }'],
    [component, implementation]], [at("forbidden-import", file("elaborate"))]);
  const ownTest = "test/host-cases/infer/function/owner.test.mjs";
  expect([[ownTest, `import { infer } from "../../../../${host}/infer/unit.js";`], [component, implementation]], []);
  const otherTest = "test/host-cases/elaborate/function/owner.test.mjs";
  expect([[otherTest, `import { infer } from "../../../../${host}/infer/unit.js";`], [component, implementation]], [at("forbidden-import", otherTest)]);
});

test("front's sole SDK-value port is the complete tagged ExtensionOf return union", () => {
  const imports = 'import type { CompilerExtension as Compiler, SourceDeclarationProvider, SourceSemanticsModule } from "@tsonic/tsts"; import type { LibraryRoleEntry as Role } from "../snapshot/contract.js";';
  const union = '{ readonly kind: "compiler-extension"; readonly value: Compiler } | { readonly kind: "declaration-provider"; readonly value: SourceDeclarationProvider; readonly roles: readonly Role[] } | { readonly kind: "semantics-module"; readonly value: SourceSemanticsModule }';
  const snapshot = [file("snapshot", "contract.ts"), 'export interface LibraryRoleEntry { readonly role: string; }'];
  const contract = file("front", "contract.ts");
  expect([snapshot, [contract, `${imports}\nexport type Payload = ${union};\nexport type ExtensionOf = (table: number, reference: number) => Payload;`]], []);
  expect([snapshot, [contract, `${imports}\nexport type ExtensionOf = (table: number, reference: number) => ${union};`]], []);
  for (const changed of [union.replace('"semantics-module"', '"wrong"'), union.replace("SourceSemanticsModule", "number"), `${union} | null`]) {
    const findings = inspect([snapshot, [contract, `${imports}\nexport type ExtensionOf = (table: number, reference: number) => ${changed};`]]);
    assert.equal(findings.some(finding => finding.code === "forbidden-import" && finding.line === 2), true);
  }
  expect([snapshot, [contract, `${imports}\nexport type Exposed = Compiler;`]], [at("forbidden-import", contract, 2)]);
  for (const [label, declaration, preamble] of [
    ["missing", union.replace("; readonly roles: readonly Role[]", ""), imports],
    ["mutable vector", union.replace("roles: readonly Role[]", "roles: Role[]"), imports],
    ["mutable field", union.replace("readonly roles:", "roles:"), imports],
    ["extra provider field", union.replace("readonly roles: readonly Role[]", "readonly roles: readonly Role[]; readonly extra: number"), imports],
    ["extra other arm field", union.replace("readonly value: Compiler", "readonly value: Compiler; readonly roles: readonly Role[]"), imports],
    ["wrong owner", union, imports.replace('import type { LibraryRoleEntry as Role } from "../snapshot/contract.js";', "interface Role { readonly role: string; }")],
  ]) {
    const findings = inspect([snapshot, [contract, `${preamble}\nexport type ExtensionOf = (table: number, reference: number) => ${declaration};`]]);
    assert.equal(findings.some(finding => finding.code === "forbidden-import" && finding.path === contract && finding.line === 2), true, label);
  }
});

test("raw capture provenance belongs to front; pipeline may store it only privately", () => {
  const contract = file("front", "contract.ts");
  const raw = 'export interface RawNode { readonly text: string; }\nexport interface RawModule { readonly nodes: readonly RawNode[]; }\nexport type Renamed = RawModule;';
  expect([[contract, raw]], []);
  expect([[contract, raw], [file("pipeline"), 'import type { Renamed } from "../front/contract.js"; export type Stored = { readonly rawModule: Renamed };']], []);
  for (const owner of ["decls", "pipeline"]) {
    const path = file(owner, "contract.ts");
    expect([[contract, raw], [path, 'import type { RawNode as Node } from "../front/contract.js";\nexport type Stored = Node;']],
      [at("forbidden-import", path), at("forbidden-import", path, 2)]);
  }
  const query = `${raw}\nexport type Query = (deps: { readonly limit: number }, input: number) => Renamed;`;
  expect([[contract, query], [file("pipeline", "contract.ts"), 'import type { Query } from "../front/contract.js";\nexport interface Wiring { readonly capture: Query; }']],
    [at("forbidden-import", file("pipeline", "contract.ts")), at("forbidden-import", file("pipeline", "contract.ts"), 2), at("unwired-operation", file("pipeline", "contract.ts"), 2)]);
  expect([[file("ir-hir", "contract.ts"), 'export interface RawModule { readonly text: string; }'],
    [file("decls", "contract.ts"), 'import type { RawModule } from "../ir-hir/contract.js"; export type Ordinary = RawModule;']], []);
});

test("allowed callers directly use contract-typed library values but never deep paths", () => {
  const contract = file("ir-types", "contract.ts");
  const entry = file("ir-types", "index.ts");
  const values = [[contract, "export type Substitute = (input: number) => number;"],
    [entry, 'import type { Substitute } from "./contract.js"; export const substitute: Substitute = input => input + 1;']];
  expect([...values, [file("infer"), 'import { substitute } from "../ir-types/index.js"; export function infer(deps: { readonly bias: number }, input: number): number { return substitute(input) + deps.bias; }']], []);
  expect([[file("ir-types", "index.ts"), "export const substitute = (input: number): number => input + 1;"]],
    [at("contract-shape", file("ir-types", "index.ts"))]);
  expect([...values, [file("infer", "contract.ts"), 'import type { Substitute } from "../ir-types/contract.js";\nexport interface InferDeps { readonly substitute: Substitute; }\nexport type Infer = (deps: InferDeps, input: number) => number;']],
    [at("impure-component", file("infer", "contract.ts"), 2)]);
});

test("real public value identities retain stage and library rules through export aliases and forwarding", () => {
  const component = file("infer", "index.ts");
  for (const suffix of ["export { run };", "export { run as analyze };"])
    expect([[component, `const run = (input: number): number => input;\n${suffix}`]], [at("contract-shape", component)]);
  const stageContract = [file("infer", "contract.ts"), 'export interface InferDeps { readonly bias: number; }\nexport type Run = (deps: InferDeps, input: number) => number;'];
  expect([stageContract, [component, 'import type { Run } from "./contract.js";\nconst run: Run = (other, input) => other.bias + input;\nexport { run };']], []);
  expect([stageContract, [component, 'import type { Run } from "./contract.js";\nconst run: Run = (deps, input) => deps.bias + input;\nexport { run };']], []);
  expect([stageContract, [component, 'import type { Run } from "./contract.js";\nconst run: Run = ((other, input) => other.bias + input);\nexport { run };']], []);
  expect([stageContract, [component, 'import type { Run, InferDeps } from "./contract.js";\nconst original = (other: InferDeps, input: number): number => other.bias + input;\nconst run: Run = original;\nexport { run };']], []);
  expect([stageContract, [component, 'import type { InferDeps } from "./contract.js";\nconst run: (deps: InferDeps, input: number) => number = (deps, input) => deps.bias + input;\nexport { run };']], [at("contract-shape", component, 2)]);
  expect([stageContract, [component, 'const run: number = 1; export { run };']], [at("contract-shape", component)]);
  expect([[stageContract[0], stageContract[1].replace("export type Run", "type Run")],
    [component, 'import type { Run } from "./contract.js"; const run: Run = (deps, input) => deps.bias + input; export { run };']], [at("contract-shape", component, 1, 43)]);
  const contract = [file("ir-types", "contract.ts"), "export type Substitute = (input: number) => number;"];
  const entry = file("ir-types", "index.ts");
  expect([contract, [entry, 'const substitute = (input: number): number => input;\nexport { substitute };']], [at("contract-shape", entry)]);
  expect([contract, [entry, 'import type { Substitute } from "./contract.js";\nconst substitute: Substitute = input => input;\nexport { substitute as replace };']], []);
  const privatePath = file("ir-types", "private.ts");
  for (const forwarding of ['export { substitute } from "./private.js";', 'export * from "./private.js";']) {
    expect([contract, [entry, forwarding], [privatePath, 'export const substitute = (input: number): number => input;']], [at("contract-shape", privatePath)]);
    expect([contract, [entry, forwarding], [privatePath, 'import type { Substitute } from "./contract.js";\nexport const substitute: Substitute = input => input;']], []);
  }
  expect([[component, 'const original = (input: number): number => input;\nconst run = original;\nexport { run };']], [at("contract-shape", component, 2)]);
  const privateStage = file("infer", "private.ts");
  expect([[component, 'export { run as analyze } from "./private.js";'],
    [privateStage, 'export function run(input: number): number { return input; }']], [at("contract-shape", privateStage)]);
});

test("Node-created loader tracing remains bounded while only the catalogue plugin effect owns loading", () => {
  const path = file("project", "effects.ts");
  const target = [file("front"), 'export function front(deps: { readonly bias: number }, input: number): number { return deps.bias + input; }'];
  for (const setup of ['import { createRequire } from "node:module";\nconst load = createRequire(import.meta.url);',
    'import { createRequire as make } from "module";\nconst factory = make; const original = factory(import.meta.url); const load = original;',
    'import * as modules from "node:module";\nconst factory = modules.createRequire; const load = factory(import.meta.url);']) {
    const [statement, local] = setup.split("\n");
    const prefix = `${statement}\nexport function run(input: string): boolean { ${local} return typeof `;
    const forbidden = `${prefix}load("../front/unit.js") === "function"; }`;
    expect([[path, forbidden], target], [at("forbidden-import", path), at("forbidden-import", path, 2, forbidden.split("\n")[1].indexOf('load("../front') + 1)], effectsCatalogue);
    const allowed = `${prefix}load("node:fs") === "object"; }`;
    expect([[path, allowed]], [at("forbidden-import", path)], effectsCatalogue);
    const dynamic = `${prefix}load(input) === "object"; }`;
    expect([[path, dynamic]], [at("forbidden-import", path), at("unsafe-type-escape", path, 2, dynamic.split("\n")[1].indexOf("load(input)") + 1)], effectsCatalogue);
  }
  expect([[path, 'export function run(input: string): boolean { function require(name: string): string { return name; } const load = require; return typeof load(input) === "string"; }']], [at("unsafe-type-escape", path)], effectsCatalogue);
  const direct = 'import { createRequire as make } from "node:module";\nexport function run(input: string): boolean { return typeof make(import.meta.url)(input) === "object"; }';
  expect([[path, direct]], [at("forbidden-import", path), at("unsafe-type-escape", path, 2, direct.split("\n")[1].indexOf("make(import.meta.url)(input)") + 1)], effectsCatalogue);
  expect([[path, 'import { createRequire as make } from "node:module";\nexport function run(input: string): string { function local(value: string): string { return value; } const make = local; return make(input); }']], [at("forbidden-import", path)], effectsCatalogue);
  const plugin = file("plugins", "effects.ts");
  expect([[plugin, 'import { createRequire } from "node:module"; export function load(input: string): boolean { const require = createRequire(import.meta.url); return typeof require(input) === "object"; }']], [], effectsCatalogue);
  expect([[plugin, 'export function load(input: string): Promise<unknown> { return import(input); }']], [], effectsCatalogue);
  const literal = 'export function load(): Promise<unknown> { return import("../front/unit.js"); }';
  expect([[plugin, literal], target], [at("forbidden-import", plugin, 1, literal.indexOf("import(") + 1)], effectsCatalogue);
});

test("Node effects are catalogue-file permissions and pure modules cannot import ambient loaders", () => {
  for (const owner of ["ids", "infer", "front"]) for (const text of ['import { createRequire } from "node:module";',
    'import * as modules from "node:module";', 'export * from "node:module";', 'import type { Module } from "node:module";'])
    expect([[file(owner), text]], [at("forbidden-import", file(owner))], effectsCatalogue);
  for (const local of ['const { createRequire: make } = modules;', 'const make = modules["createRequire"];']) {
    const text = `import * as modules from "node:module";\nexport function run(input: string): boolean { ${local} const load = make(import.meta.url); return typeof load(input) === "object"; }`;
    expect([[file("infer"), text]], [at("forbidden-import", file("infer"))], effectsCatalogue);
  }
  for (const module of effectsCatalogue.filter(module => ["driver", "orchestration"].includes(module.kind))) {
    const effect = module.effects[0].path;
    expect([[effect, 'import { readFile } from "node:fs";']], [], effectsCatalogue);
    expect([[`${module.directory}/unit.ts`, 'import { readFile } from "node:fs";']], [at("forbidden-import", `${module.directory}/unit.ts`)], effectsCatalogue);
  }
  const unadmittedEffects = (hostCatalogue.map(module => ({ ...module, effects: ([]) })));
  expect([[file("plugins", "effects.ts"), 'import { createRequire } from "node:module";']], [at("forbidden-import", file("plugins", "effects.ts"))], unadmittedEffects);
  assert.throws(() => inspect([[file("plugins", "effects.ts"), 'import { createRequire } from "node:module";']], { catalogue: unadmittedEffects }), /exact agreed/u);
  expect([[file("infer"), 'import type { Input } from "some-package";']], [at("forbidden-import", file("infer"))], effectsCatalogue);
});

test("ambient execution escapes are refused outside the sole plugin-loading effect", () => {
  for (const owner of ["infer", "front", "project", "plugins", "orchestration"]) {
    const path = file(owner);
    for (const expression of ['process.argv', 'globalThis.process', 'process.getBuiltinModule("fs")', 'require("fs")', 'eval("1")', 'new Function("return 1")'])
      expect([[path, `export function read(): boolean { return typeof ${expression} === "object"; }`]], [at("unsafe-type-escape", path)], effectsCatalogue);
  }
  expect([[file("plugins", "effects.ts"), 'export function read(): boolean { return typeof process.getBuiltinModule("fs") === "object"; }']], [], effectsCatalogue);
  const path = file("project", "effects.ts");
  const dynamic = 'export function read(input: string): Promise<unknown> { return import(input); }';
  expect([[path, dynamic]], [at("unsafe-type-escape", path, 1, dynamic.indexOf("import(") + 1)], effectsCatalogue);
});

test("pipeline admits only genuine clean component Deps and exact owner limits beside function types", () => {
  const pipeline = file("pipeline", "contract.ts");
  for (const [owner, limit] of [["front", "NavigationCaptureLimits"], ["front", "LiteralCaptureLimits"], ["infer", "InferenceLimits"],
    ["evaluate", "EvaluatorLimits"], ["summaries", "SummaryLimits"], ["metadata", "MetadataLimits"], ["analyses/liveness", "AnalysisLimits"]]) {
    const contract = file(owner, "contract.ts");
    const prefix = posix.relative(posix.dirname(pipeline), contract).replace(/\.ts$/u, ".js");
    const source = `export interface ${limit} { readonly maximum: number; }\nexport interface StageDeps { readonly limit: ${limit}; }\nexport type Stage = (deps: StageDeps, input: number) => number;\nexport interface OtherDeps { readonly maximum: number; }\nexport interface OtherData { readonly maximum: number; }`;
    expect([[contract, source], [pipeline, `import type { StageDeps, ${limit} } from "${prefix}";\nexport interface Limits { readonly deps: StageDeps; readonly limit: ${limit}; }`]], []);
    for (const forbidden of ["OtherDeps", "OtherData"])
      expect([[contract, source], [pipeline, `import type { ${forbidden} } from "${prefix}";`]], [at("forbidden-import", pipeline)]);
  }
  expect([[file("infer", "contract.ts"), 'export interface NavigationCaptureLimits { readonly maximum: number; }'],
    [pipeline, 'import type { NavigationCaptureLimits } from "../infer/contract.js";']], [at("forbidden-import", pipeline)]);
  for (const [owner, limit] of [["dataflow", "DataflowLimits"], ["ir-types", "TypeExpansionLimits"], ["query", "QueryLimits"], ["ir-program", "InstantiationLimits"]])
    expect([[file(owner, "contract.ts"), `export interface ${limit} { readonly maximum: number; }`],
      [pipeline, `import type { ${limit} } from "../${owner}/contract.js"; export interface CompilerLimits { readonly owner: ${limit}; }`]], []);
  const front = file("front", "contract.ts");
  const raw = 'export interface RawModule { readonly text: string; }\nexport interface LowerDeps { readonly raw: RawModule; }\nexport type LowerModule = (deps: LowerDeps, input: number) => number;\nexport interface CaptureDeps { readonly limit: number; }\nexport type CaptureModule = (deps: CaptureDeps, input: number) => RawModule;';
  const implemented = [file("front", "index.ts"), 'import type { CaptureModule, LowerModule } from "./contract.js";\nexport const lower: LowerModule = (deps, input) => input;\nexport const capture: CaptureModule = (deps, input) => ({ text: "" });'];
  expect([[front, raw], implemented, [file("pipeline"), 'import type { LowerDeps, LowerModule, CaptureModule } from "../front/contract.js"; export interface Wiring { readonly deps: LowerDeps; readonly lower: LowerModule; readonly capture: CaptureModule; }']], []);
  for (const name of ["LowerDeps", "LowerModule", "CaptureModule"])
    expect([[front, raw], [pipeline, `import type { ${name} } from "../front/contract.js";\nexport interface Wiring { readonly port: ${name}; }`]],
      [at("forbidden-import", pipeline), at("forbidden-import", pipeline, 2), ...(name === "LowerDeps" ? [] : [at("unwired-operation", pipeline, 2)])]);
  expect([[file("snapshot", "contract.ts"), 'export interface ImportPreparation { readonly specifiers: readonly string[]; }'],
    [front, 'import type { ImportPreparation } from "../snapshot/contract.js"; export type Capture = (deps: { readonly limit: number }, input: ImportPreparation) => number;'],
    [pipeline, 'import type { ImportPreparation } from "../snapshot/contract.js"; export type PrepareImports = (input: string) => ImportPreparation;']], []);
});

test("composition contracts preserve the one front brand and only named genuine component function types", () => {
  const front = [file("front", "contract.ts"), 'export type CheckerExtensions = object & { readonly identityKind: "checker-extensions" };'];
  const pipeline = [file("pipeline", "contract.ts"), 'export type { CheckerExtensions } from "../front/contract.js";'];
  expect([front, pipeline, [file("orchestration", "contract.ts"), 'import type { CheckerExtensions } from "../pipeline/contract.js"; export interface Input { readonly extensions: CheckerExtensions; }']], []);
  const query = [file("infer", "contract.ts"), 'export interface InferDeps { readonly bias: number; }\nexport type Infer = (deps: InferDeps, input: number) => number;'];
  expect([query, [file("infer", "index.ts"), 'import type { Infer } from "./contract.js";\nexport const infer: Infer = (deps, input) => input + deps.bias;'],
    [file("pipeline", "contract.ts"), 'import type { Infer } from "../infer/contract.js"; export interface Wiring { readonly infer: Infer; }']], []);
  for (const [owner, target, text] of [
    ["orchestration", front, 'import type { CheckerExtensions } from "../front/contract.js";'],
    ["decls", front, 'import type { CheckerExtensions } from "../front/contract.js";'],
    ["pipeline", query, 'import { Infer } from "../infer/contract.js";'],
    ["pipeline", query, 'import type * as Infer from "../infer/contract.js";'],
  ]) expect([target, [file(owner, "contract.ts"), text]], [at("forbidden-import", file(owner, "contract.ts"))]);
  const raw = [file("front", "contract.ts"), 'export interface RawModule { readonly text: string; }'];
  expect([raw, [file("pipeline", "contract.ts"), 'export type { RawModule } from "../front/contract.js";']], [at("forbidden-import", file("pipeline", "contract.ts"))]);
});

test("quarantined code is never executable input or an active configuration reference", () => {
  expect([[file("infer"), `import type { Data } from "../../../../${referenceRoot}/contract.js";`]], [at("forbidden-import", file("infer"))]);
  expect([[file("ids"), `export const path = "${referenceRoot}/source.ts";`]], [at("forbidden-import", file("ids"))]);
  expect([[file("ids"), 'export const text = "pending lease authenticate questionView";']], []);
  const config = "config.json";
  const result = inspect([[file("ids"), data], [config, JSON.stringify({ references: [`${referenceRoot}/program.ts`] })]], { files: [file("ids")], configurations: [config] });
  assert.equal(JSON.stringify(result), JSON.stringify([at("forbidden-import", config)]));
  const disguised = inspect([[file("ids"), data], [config, JSON.stringify({ metadata: { script: `${referenceRoot}/program.ts` } })]],
    { files: [file("ids")], configurations: [config] });
  assert.equal(JSON.stringify(disguised), JSON.stringify([at("forbidden-import", config)]));
});

test("current Host inventory rejects a file outside the catalogue", () => {
  const path = file("outside-catalogue", "contract.ts");
  expect([[path, data]], [at("unknown-module", path)]);
});

test("a public stage operation takes its inputs, and injected dependencies only as its own contract's Deps record in first place; state and try remain forbidden", () => {
  const contract = file("infer", "contract.ts");
  const entry = file("infer", "index.ts");
  const record = "export interface InferDeps { readonly bias: number; }\n";
  const stage = (signature, implementation, preamble = record) => [[contract, `${preamble}export type Run = ${signature};`],
    [entry, `import type { Run } from "./contract.js";\nexport const run: Run = ${implementation};`]];
  // Positive: an operation with one ready input and no injected dependency; several inputs; a real dependency record.
  expect(stage("(input: number) => number", "input => input"), []);
  expect(stage("(input: number) => number", "input => input", ""), []);
  expect(stage("(left: number, right: number) => number", "(left, right) => left + right"), []);
  expect(stage("(deps: InferDeps, input: number) => number", "(deps, input) => input + deps.bias"), []);
  expect(stage("(other: InferDeps, input: number) => number", "(other, input) => input + other.bias"), []);
  // Positive: an operation whose only parameter is its own dependency record, and one with no parameter: no input is invented.
  expect(stage("(deps: InferDeps) => number", "deps => deps.bias"), []);
  expect(stage("() => number", "() => 1"), []);
  // Positive: data however it is built carries no dependency: nested readonly arrays and maps, tuples, nullable unions, a
  // recursive record, a generic record of data, and an opaque handle of its owner though that holds a function inside.
  expect(stage("(input: Nested, rows: readonly (readonly Row[])[], pair: readonly [Row, number], choice: Row | null, box: Box<Row>, text: string, both: Row & Nested) => Nested",
    "(input, rows, pair, choice, box, text, both) => input",
    "export interface Row { readonly value: number; }\nexport interface Box<T> { readonly value: T; }\nexport interface Nested { readonly inner: Row; readonly rows: ReadonlyArray<Row>; readonly self: Nested | null; }\n"), []);
  // A native map is not contract data at all (the closed-data rule reports it); this rule does not take its methods for a service,
  // and still finds a callable among its type arguments.
  expect(stage("(input: number, table: ReadonlyMap<string, Row>) => number", "(input, table) => input", "export interface Row { readonly value: number; }\n"), [at("contract-shape", contract, 2)]);
  expect(stage("(input: number, table: ReadonlyMap<string, () => number>) => number", "(input, table) => input", "\n"), [at("contract-shape", contract, 2), at("impure-component", contract, 2)]);
  expect([[file("ir-types", "arena.ts"), "export class TypeArena { private readonly run: () => number = () => 1; private constructor() {} static create(): TypeArena { return new TypeArena(); } }"],
    [file("ir-types", "contract.ts"), 'import type { TypeArena } from "./arena.js";\nexport type TypeInterner = TypeArena;'],
    [contract, 'import type { TypeInterner } from "../ir-types/contract.js";\nexport type Run = (input: number, types: TypeInterner, all: readonly TypeInterner[]) => number;'],
    [entry, 'import type { Run } from "./contract.js";\nexport const run: Run = (input, types, all) => input;']], []);
  // Negative: a dependency record that is moved, repeated, alone, inline, not a record, or not named as one.
  for (const [signature, implementation] of [
    ["(input: number, deps: InferDeps) => number", "(input, deps) => input + deps.bias"],
    ["(input: number, other: InferDeps) => number", "(input, other) => input + other.bias"],
    ["(deps: InferDeps, more: InferDeps, input: number) => number", "(deps, more, input) => input + deps.bias + more.bias"],
    ["(deps: { readonly bias: number }, input: number) => number", "(deps, input) => input + deps.bias"],
    ["(deps: number, input: number) => number", "(deps, input) => input + deps"],
    ["(deps: InferOptions, input: number) => number", "(deps, input) => input + deps.bias"]])
    expect(stage(signature, implementation, `${record.trimEnd()} export interface InferOptions { readonly bias: number; }\n`), [at("impure-component", contract, 2)]);
  // Negative: hidden effects, which are dependencies injected outside the record: a callable input, an input record with a
  // callable member, and a library function handed in instead of used through its owner.
  expect(stage("(input: number, effect: () => number) => number", "(input, effect) => input + effect()"), [at("impure-component", contract, 2)]);
  expect(stage("(input: Carrier) => number", "input => input.run()",
    "export interface Carrier { readonly run: () => number; }\n"), [at("impure-component", contract, 2)]);
  expect(stage("(input: { run(): number }) => number", "input => input.run()", "\n"), [at("impure-component", contract, 2)]);
  // The same however the callable is wrapped: nested one record deeper, an interface with a call signature, in an array, a tuple,
  // a nullable union, a type argument of a record and of a native map, an index value, a constructor, an alias of an alias,
  // an extended interface, and a recursive type that reaches it only after its own cycle.
  for (const [signature, preamble] of [
    ["(input: number, tools: Tools) => number", "export interface Tools { readonly inner: { readonly read: (id: number) => number } }"],
    ["(input: number, read: Reader) => number", "export interface Reader { (id: number): number }"],
    ["(input: number, readers: readonly (() => number)[]) => number", ""],
    ["(input: number, readers: readonly [number, () => number]) => number", ""],
    ["(input: number, read: (() => number) | null) => number", ""],
    ["(input: number, box: Box<() => number>) => number", "export interface Box<T> { readonly value: T }"],
    ["(input: number, table: Table) => number", "export interface Table { readonly [name: string]: () => number }"],
    ["(input: number, make: Maker) => number", "export interface Maker { new (): Maker }"],
    ["(input: number, read: Second) => number", "export type First = () => number; export type Second = First;"],
    ["(input: number, read: Derived) => number", "export interface Base { run(): number } export interface Derived extends Base { readonly value: number }"],
    ["(input: number, list: Chain) => number", "export interface Chain { readonly next: Chain | null; readonly leaf: Leaf } export interface Leaf { readonly back: Chain; readonly run: () => number }"],
    ["(input: number, effect: (() => number)) => number", ""],
    ["(input: number, both: Data & { readonly run: () => number }) => number", "export interface Data { readonly value: number; }"],
    ["(input: number, wrapped: Readonly<Carrier>) => number", "export interface Carrier { readonly run: () => number; }"],
    ["(input: number, carrier: Carrier) => number", "export type Effect = () => number; export interface Carrier { readonly run: Effect; }"],
    ["(input: number, carrier: Carrier) => number", "export interface Carrier { readonly run?: () => number; }"],
    ["(input: number, outer: Outer) => number", "export interface Inner { readonly run: () => number; } export interface Outer { readonly inner: Inner; }"],
    ["(input: number, log: Function) => number", ""],
    ["(input: number, log: CallableFunction) => number", ""],
    ["(input: number, make: NewableFunction) => number", ""],
    ["(input: number, carrier: Carrier) => number", "export interface Carrier { get run(): () => number }"]])
    expect(stage(signature, "(input, other) => input", `${preamble}\n`), [at("impure-component", contract, 2)]);
  // A function type declared by another module's contract and handed in, instead of the library being used through its owner.
  expect([[file("ir-types", "contract.ts"), "export type Substitute = (input: number) => number;"],
    [contract, 'import type { Substitute } from "../ir-types/contract.js";\nexport type Run = (input: number, substitute: Substitute) => number;'],
    [entry, 'import type { Run } from "./contract.js";\nexport const run: Run = (input, substitute) => substitute(input);']], [at("impure-component", contract, 2)]);
  // A type taken from a value, from a member of another type or from a module has no declaration to walk: it is accepted only where the
  // checker says it is scalar. This rule's own findings are compared; the closed-data rule has its own for some of these forms.
  const own = entries => inspect(entries).filter(finding => finding.code === "impure-component");
  // A set accessor is not closed contract data, which that rule reports on its own; this rule still sees the callable it takes.
  assert.deepEqual(own(stage("(input: number, carrier: Carrier) => number", "(input, other) => input", "export interface Carrier { set run(value: () => number) }\n")), [at("impure-component", contract, 2)]);
  // A default type argument is walked where none is supplied.
  expect(stage("(input: number, box: Box) => number", "(input, other) => input", "export interface Box<T = () => number> { readonly run: T }\n"), [at("impure-component", contract, 2)]);
  assert.deepEqual(own(stage("(input: number, box: Box) => number", "(input, other) => input", "export interface Row { readonly value: number } export interface Box<T = Row> { readonly run: T }\n")), []);
  const queried = (parameter, preamble) => stage(`(input: number, other: ${parameter}) => number`, "(input, other) => input", `${preamble}\n`);
  assert.deepEqual(own(queried("typeof table", "export declare const table: { readonly first: () => number; readonly second: () => number };")), [at("impure-component", contract, 2)]);
  assert.deepEqual(own(queried("Carrier[\"run\"]", "export interface Carrier { readonly run: { readonly go: () => number } }")), [at("impure-component", contract, 2)]);
  assert.deepEqual(own(queried("import(\"../ir-types/contract.js\").Carrier", "")
    .concat([[file("ir-types", "contract.ts"), "export interface Carrier { readonly run: () => number; }"]])), [at("impure-component", contract, 2)]);
  assert.deepEqual(own(queried("typeof limit", "export declare const limit: number;")), []);
  assert.deepEqual(own(queried("typeof limits", "export declare const limits: { readonly depth: number; readonly rows: readonly { readonly value: number }[] };")), [],
    "a record of data named through a value's annotation is data");
  assert.deepEqual(own(queried("Row[\"value\"]", "export interface Row { readonly value: number }")), []);
  assert.deepEqual(own(queried("Row[\"inner\"]", "export interface Row { readonly inner: { readonly value: number } }")), [], "a data member named by an indexed access is data");
  assert.deepEqual(own(queried("import(\"../ir-types/contract.js\").Row", "")
    .concat([[file("ir-types", "contract.ts"), "export interface Row { readonly value: number; }"]])), [], "a data record named by an import type is data");
  // A type parameter of the stage itself is supplied by the caller: it is reported in a parameter or a result, whatever its constraint
  // (a subtype of a closed record may still carry a callable). A generic data record used with written arguments is walked through them.
  for (const [signature, preamble, reported] of [
    ["<T>(input: number, anything: T) => number", "", true],
    ["<T>(input: number, box: Box<T>) => number", "export interface Box<V> { readonly value: V }", true],
    ["<T>(input: number) => T", "", true],
    ["<T extends unknown>(input: number, anything: T) => number", "", true],
    ["<T extends () => number>(input: number, anything: T) => number", "", true],
    ["<T extends Carrier>(input: number, anything: T) => number", "export interface Carrier { readonly run: () => number }", true],
    ["<T extends Row>(input: number, anything: T) => number", "export interface Row { readonly value: number }", true],
    ["<T extends Row>(input: number) => T", "export interface Row { readonly value: number }", true],
    ["<T extends Row>(input: number, box: Box<T>) => number", "export interface Row { readonly value: number } export interface Box<V> { readonly value: V }", true],
    ["(input: number, box: Box<Row>) => Box<number>", "export interface Row { readonly value: number } export interface Box<V> { readonly value: V }", false],
    ["(input: number, box: Box<() => number>) => number", "export interface Box<V> { readonly value: V }", true]])
    assert.deepEqual(own(stage(signature, "(input, other) => input", `${preamble}\n`)), reported ? [at("impure-component", contract, 2)] : [], signature);
  // A slot of a type parameter of a generic data record (the HIR's phase slots) is decided by the record's argument at its use.
  const phased = "export interface Phase { readonly slot: object | null } export interface Node<P extends Phase> { readonly tsonic: P[\"slot\"] }";
  assert.deepEqual(own(stage("(input: number, node: Node<Checked>) => number", "(input, other) => input",
    `${phased} export interface Checked extends Phase { readonly slot: { readonly value: number } }\n`)), []);
  assert.deepEqual(own(stage("(input: number, node: Node<Checked>) => number", "(input, other) => input",
    `${phased} export interface Checked extends Phase { readonly slot: { readonly run: () => number } }\n`)), [at("impure-component", contract, 2)]);
  assert.deepEqual(own([[contract, "export interface Row { readonly value: number }\nexport type Run<T> = (input: number, anything: T) => number;"],
    [entry, 'import type { Run } from "./contract.js";\nexport const run: Run<number> = (input, other) => input;']]).length > 0, true, "a parameter of the alias itself, without a constraint");
  // A qualified type name is followed to its declaration.
  assert.deepEqual(own([[file("ir-types", "contract.ts"), "export interface Carrier { readonly run: () => number; }"],
    [contract, 'import type * as types from "../ir-types/contract.js";\nexport type Run = (input: number, carrier: types.Carrier) => number;'],
    [entry, 'import type { Run } from "./contract.js";\nexport const run: Run = (input, carrier) => input;']]), [at("impure-component", contract, 2)]);
  // An opaque handle is one by the opaque-owner table AND its form: a type with an opaque name whose target is an ordinary record is walked.
  assert.deepEqual(own([[file("front", "contract.ts"), "export type CheckerExtensions = { readonly run: () => number };"],
    [contract, 'import type { CheckerExtensions } from "../front/contract.js";\nexport type Run = (input: number, extensions: CheckerExtensions) => number;'],
    [entry, 'import type { Run } from "./contract.js";\nexport const run: Run = (input, extensions) => input;']]), [at("impure-component", contract, 2)]);
  assert.deepEqual(own([[file("front", "contract.ts"), 'export type CheckerExtensions = object & { readonly identityKind: "checker-extensions" };'],
    [contract, 'import type { CheckerExtensions } from "../front/contract.js";\nexport type Run = (input: number, extensions: CheckerExtensions) => number;'],
    [entry, 'import type { Run } from "./contract.js";\nexport const run: Run = (input, extensions) => input;']]), []);
  // The result of a stage is data, or a step of data: a result that carries a callable hands behaviour across the stage boundary.
  // The same walk as for a parameter. Positive: records, arrays, unions, a step-shaped union, data that describes a function, an opaque handle.
  const row = "export interface Row { readonly value: number; }";
  for (const [result, implementation, preamble] of [
    ["Row", "input => ({ value: input })", row],
    ["readonly Row[]", "input => [{ value: input }]", row],
    ["Row | null", "input => null", row],
    ["Stepped", "input => ({ kind: \"done\", value: { value: input } })",
      `${row} export type Stepped = { readonly kind: "done"; readonly value: Row } | { readonly kind: "paused"; readonly requests: readonly Row[]; readonly paused: Row; readonly earned: readonly Row[] };`],
    ["FunctionInfo", "input => ({ name: \"f\", parameters: [], returns: { value: input } })", `${row} export interface FunctionInfo { readonly name: string; readonly parameters: readonly Row[]; readonly returns: Row }`]])
    expect(stage(`(input: number) => ${result}`, implementation, `${preamble}\n`), []);
  expect([[file("ir-types", "arena.ts"), "export class TypeArena { private readonly run: () => number = () => 1; private constructor() {} static create(): TypeArena { return new TypeArena(); } }"],
    [file("ir-types", "contract.ts"), 'import type { TypeArena } from "./arena.js";\nexport type TypeInterner = TypeArena;'],
    [contract, 'import type { TypeInterner } from "../ir-types/contract.js";\nexport type Run = (types: TypeInterner) => TypeInterner;'],
    [entry, 'import type { Run } from "./contract.js";\nexport const run: Run = types => types;']], []);
  // Negative: a callable in the result, direct and however it is wrapped; and a table of operations returned by an operation that
  // no composition binds (no Pipeline source is inspected here).
  for (const [result, implementation, preamble] of [
    ["() => number", "input => () => input", ""],
    ["Out", "input => ({ run: () => input })", "export interface Out { readonly run: () => number }"],
    ["readonly (() => number)[]", "input => [() => input]", ""],
    ["(() => number) | null", "input => null", ""],
    ["readonly [number, () => number]", "input => [input, () => input]", ""],
    ["Data & { readonly run: () => number }", "input => ({ value: input, run: () => input })", "export interface Data { readonly value: number; }"],
    ["Readonly<Carrier>", "input => ({ run: () => input })", "export interface Carrier { readonly run: () => number; }"],
    ["Derived", "input => ({ value: input, run: () => input })", "export interface Base { run(): number } export interface Derived extends Base { readonly value: number }"],
    ["Box<() => number>", "input => ({ value: () => input })", "export interface Box<T> { readonly value: T }"]])
    expect(stage(`(input: number) => ${result}`, implementation, `${preamble}\n`), [at("impure-component", contract, 2)]);
  expect(stage("(deps: InferDeps) => Table", "deps => ({ first: input => input + deps.bias, second: input => input })",
    "export interface InferDeps { readonly bias: number; } export interface Table { readonly first: (input: number) => number; readonly second: (input: number) => number }\n"),
    [at("impure-component", contract, 2)]);
  // Negative: the implementation leaves out or adds a parameter of its contract type, in place or through a named function.
  expect(stage("(deps: InferDeps, input: number) => number", "deps => deps.bias"), [at("contract-shape", entry, 2)]);
  expect(stage("(input: number) => number", "(input, extra) => input"), [at("contract-shape", entry, 2)]);
  expect([[contract, "export type Run = (input: number) => number;"],
    [entry, 'import type { Run } from "./contract.js";\nfunction original(): number { return 1; }\nexport const run: Run = original;']], [at("contract-shape", entry, 3)]);
  expect([[contract, "export type Run = (input: number) => number;"], [file("infer", "work.ts"), "export function original(input: number, extra: number): number { return input + extra; }"],
    [entry, 'import type { Run } from "./contract.js";\nimport { original } from "./work.js";\nexport const run: Run = original;']], [at("contract-shape", entry, 3)]);
  expect([[contract, "export type Run = (input: number) => number;"], [file("infer", "work.ts"), "export function original(input: number): number { return input; }"],
    [entry, 'import type { Run } from "./contract.js";\nimport { original } from "./work.js";\nexport const run: Run = original;']], []);
  // The implementing function is found through any number of names, each followed once: twelve constants to a function with the
  // contract's parameters pass, and the same chain to a function with one parameter more is reported.
  const chain = Array.from({ length: 12 }, (unusedValue, position) => `const step${position + 1} = step${position};`).join(" ");
  for (const [original, expected] of [["function step0(input: number): number { return input; }", []],
    ["function step0(input: number, extra: number): number { return input + extra; }", [at("contract-shape", entry, 4)]]])
    expect([[contract, "export type Run = (input: number) => number;"],
      [entry, `import type { Run } from "./contract.js";\n${original}\n${chain}\nexport const run: Run = step12;`]], expected);
  // A source entry that declares the value and gives no implementation is reported; the same line in a declaration file is the emitted
  // form of an implemented value and passes.
  expect([[contract, "export type Run = (input: number) => number;"], [entry, 'import type { Run } from "./contract.js";\nexport declare const run: Run;']],
    [at("contract-shape", entry, 2)]);
  expect([[file("infer", "contract.d.ts"), "export type Run = (input: number) => number;"],
    [file("infer", "index.d.ts"), 'import type { Run } from "./contract.js";\nexport declare const run: Run;']], []);
  // An initializer that names no function declaration (a call's result, a selection, a condition, names that only name each other)
  // has no parameters to read: it is reported, never passed unchecked.
  for (const initializer of ["wrap(original)", "original.bind(null)", "true ? original : original", "first"])
    assert.deepEqual(inspect([[contract, "export type Run = (input: number) => number;"],
      [entry, `import type { Run } from "./contract.js";\nfunction original(input: number): number { return input; }\nfunction wrap(run: Run): Run { return run; }\nconst first: Run = second; const second: Run = first;\nexport const run: Run = ${initializer};`]])
      .filter(finding => finding.code === "contract-shape"), [at("contract-shape", entry, 5)], initializer);
  // Negative: a one-input operation is still a typed port of the contract. An untyped function, a helper or a table is not public.
  expect([[contract, "export type Run = (input: number) => number;"], [entry, "export const run = (input: number): number => input;"]], [at("contract-shape", entry)]);
  expect([[contract, "export type Run = (input: number) => number;"],
    [entry, 'import type { Run } from "./contract.js";\nexport const run: Run = input => input;\nexport const table: readonly number[] = [1];']], [at("contract-shape", entry, 3)]);
  expect([[contract, "export type Run = (input: number) => number;"],
    [entry, 'import type { Run } from "./contract.js";\nexport const run: Run = input => input;\nexport function helper(input: number): number { return input; }']], [at("contract-shape", entry, 3)]);
  // State and try stay forbidden, for a one-input operation as for any other.
  expect([[file("infer"), "let count = 0;\nexport function run(deps: { readonly bias: number }, input: number): number { count += 1; return input + deps.bias + count; }"]],
    [at("module-state", file("infer"))]);
  expect([[file("infer"), "let count = 0;\nexport function run(input: number): number { count += 1; return input + count; }"]], [at("module-state", file("infer"))]);
  expect([[file("infer"), "export function run(deps: { readonly bias: number }, input: number): number { return input + deps.bias; }"]], []);
  expect([[file("infer"), 'export function run(deps: { readonly limit: number }, input: number): { readonly kind: "refused"; readonly value: number } { return { kind: "refused", value: input + deps.limit }; }']], []);
  expect([[file("infer"), 'export function run(deps: { readonly limit: number }, input: number): number { try { return input + deps.limit; } catch { return 0; } }']], [at("impure-component", file("infer"))]);
  expect([[file("infer"), "export function run(input: number): number { try { return input; } catch { return 0; } }"]], [at("impure-component", file("infer"))]);
});

test("Pipeline's wiring names every public component operation once, and a table of operations is a stage result only where the composition binds it", () => {
  const tableFile = file("ir-infer", "contract.ts");
  const table = outcome => [tableFile, `export interface Outcome { ${outcome} }\nexport interface RuleTable {\n  readonly decide: (input: number) => Outcome;\n}`];
  const rulesContract = file("rules", "contract.ts");
  const rules = [[rulesContract, 'import type { RuleTable } from "../ir-infer/contract.js";\nexport interface RulesDeps { readonly bias: number; }\nexport type CreateRuleTable = (deps: RulesDeps) => RuleTable;'],
    [file("rules", "index.ts"), 'import type { CreateRuleTable } from "./contract.js";\nexport const createRuleTable: CreateRuleTable = deps => ({ decide: input => ({ value: input + deps.bias }) });']];
  const inferEntry = file("infer", "index.ts");
  const infer = [[file("infer", "contract.ts"), 'import type { RuleTable } from "../ir-infer/contract.js";\nexport interface InferDeps { readonly rules: RuleTable; }\nexport type Solve = (deps: InferDeps, input: number) => number;\nexport type Other = (input: number) => number;'],
    [inferEntry, 'import type { Solve } from "./contract.js";\nexport const solve: Solve = (deps, input) => deps.rules.decide(input).value;']];
  const pipeline = file("pipeline");
  const imports = 'import type { CreateRuleTable, RulesDeps } from "../rules/contract.js";\nimport type { InferDeps, Other, Solve } from "../infer/contract.js";\n';
  const wiring = (members = "") => `${imports}export interface Wiring {\n  readonly createRuleTable: CreateRuleTable;\n  readonly solve: Solve;\n${members}}\n`;
  const bound = "export function compose(wiring: Wiring, setup: RulesDeps, input: number): number { const rules = wiring.createRuleTable(setup); const deps: InferDeps = { rules }; return wiring.solve(deps, input); }";
  const data = "readonly value: number;";
  // The genuine form: the composition calls the operation through the wiring and its result becomes a member of a component's Deps record.
  expect([table(data), ...rules, ...infer, [pipeline, wiring() + bound]], []);
  expect([table(data), ...rules, ...infer, [pipeline, wiring() + bound.replace("const rules = wiring.createRuleTable(setup); const deps: InferDeps = { rules };", "const deps: InferDeps = { rules: wiring.createRuleTable(setup) };")]], []);
  // The same operation where no composition binds it: only declared in the wiring; or its result used as a value.
  expect([table(data), ...rules, ...infer, [pipeline, wiring()]], [at("impure-component", rulesContract, 3)]);
  expect([table(data), ...rules, ...infer, [pipeline, wiring() + "export function compose(wiring: Wiring, setup: RulesDeps, input: number): number { const rules = wiring.createRuleTable(setup); return rules.decide(input).value; }"]],
    [at("impure-component", rulesContract, 3)]);
  expect([table(data), ...rules, ...infer, [pipeline, wiring() + "export function compose(wiring: Wiring, setup: RulesDeps, input: number): number { const rules = wiring.createRuleTable(setup); const deps: InferDeps = { rules }; return wiring.solve(deps, input) + rules.decide(input).value; }"]],
    [at("impure-component", rulesContract, 3)]);
  // An operation of a bound table is a semantic invocation: a callable hidden in what it returns is reported at the table's declaration.
  for (const hidden of ["readonly value: number; readonly later: () => number;", "readonly values: readonly (() => number)[];", "readonly value: (() => number) | null;"])
    expect([table(hidden), ...rules, ...infer, [pipeline, wiring() + bound]], [at("impure-component", tableFile, 2)]);
  // Exhaustive both ways: a public operation that the wiring does not name, a member that no component implements, a member twice.
  const withoutSolve = `${imports}export interface Wiring {\n  readonly createRuleTable: CreateRuleTable;\n}\nexport function compose(wiring: Wiring, setup: RulesDeps): InferDeps { const deps: InferDeps = { rules: wiring.createRuleTable(setup) }; return deps; }`;
  expect([table(data), ...rules, ...infer, [pipeline, withoutSolve]], [at("unwired-operation", inferEntry, 2)]);
  expect([table(data), ...rules, ...infer, [pipeline, wiring("  readonly other: Other;\n") + bound]], [at("unwired-operation", pipeline, 3)]);
  expect([table(data), ...rules, ...infer, [pipeline, wiring("  readonly again: Solve;\n") + bound]], [at("unwired-operation", pipeline, 3)]);
  // A component's operation is reported as unwired as soon as any Pipeline source is inspected with it.
  expect([...infer.map(([path, text]) => [path, text.replace('import type { RuleTable } from "../ir-infer/contract.js";\n', "").replace("readonly rules: RuleTable;", "readonly bias: number;").replace("deps.rules.decide(input).value", "deps.bias + input")]),
    [pipeline, "export interface Unrelated { readonly value: number; }"]], [at("unwired-operation", inferEntry, 2)]);
});

test("original and emitted component ports require the same genuine owner Deps", () => {
  for (const suffix of ["ts", "d.ts"]) {
    const contract = file("infer", `contract.${suffix}`);
    const entry = file("infer", `index.${suffix}`);
    const implementation = suffix === "ts" ? 'export const run: Run = (deps, input) => input + deps.bias;'
      : 'export declare const run: Run;';
    const body = [entry, `import type { Run } from "./contract.js";\n${implementation}`];
    const deps = 'export interface InferDeps { readonly bias: number; }\n';
    expect([[contract, deps + 'export type Run = (deps: InferDeps, input: number) => number;'], body], []);
    expect([[contract, deps + 'export type Run = (input: number, deps: InferDeps) => number;'], body],
      [at("impure-component", contract, 2)]);
    const foreign = file("ids", `contract.${suffix}`);
    expect([[foreign, deps], [contract,
      'import type { InferDeps } from "../ids/contract.js";\nexport type Run = (deps: InferDeps, input: number) => number;'], body],
      [at("impure-component", contract, 2)]);
  }
});

test("non-owning opaque declarations retain their owner-qualified type-only brands", () => {
  for (const [owner, name, tag] of [["front", "CheckerExtensions", "checker-extensions"],
    ["front", "CheckedProgram", "checked-program"], ["plugins", "PluginModule", "plugin-module"], ["orchestration", "TargetSession", "target-session"]]) {
    const source = `export type ${name} = object & { readonly identityKind: "${tag}" };`;
    expect([[file(owner, "contract.ts"), source]], []);
    expect([[file("ids", "contract.ts"), source]], [at("contract-shape", file("ids", "contract.ts"))]);
  }
  expect([[file("ids", "contract.ts"), 'export type Mystery = object & { readonly identityKind: "mystery" };']], [at("contract-shape", file("ids", "contract.ts"))]);
  expect([[file("ir-types", "contract.ts"), 'export type TypeInterner = object & { readonly identityKind: "type-interner" };']], [at("contract-shape", file("ir-types", "contract.ts"))]);
});

test("a native owned opaque implementation has only private storage and a private constructor", () => {
  const contract = file("ir-types", "contract.ts");
  const implementation = file("ir-types", "arena.ts");
  const declaration = 'import type { Arena } from "./arena.js";\nexport type TypeInterner = Arena;';
  const body = 'export class Arena { private readonly rows: number[] = []; private constructor() {} static create(): Arena { return new Arena(); } }';
  expect([[contract, declaration], [implementation, body]], []);
  const rejected = [at("contract-shape", implementation), at("class", implementation),
    at("contract-shape", contract), at("contract-shape", contract, 2)]
    .sort((left, right) => left.path.localeCompare(right.path) || left.line - right.line || left.code.localeCompare(right.code));
  for (const replacement of [body.replace("private constructor", "public constructor"),
    body.replace("private readonly rows", "public readonly rows"),
    body.replace("private readonly rows", "private rows"),
    body.replace("static create", "create"),
    body.replace("private constructor() {}", "")]) {
    expect([[contract, declaration], [implementation, replacement]], rejected);
  }
  expect([[implementation, body]], [at("class", implementation)]);
  const foreign = file("ids", "arena.ts");
  expect([[contract, declaration.replace("./arena.js", "../ids/arena.js")], [foreign, body]],
    [at("class", foreign), at("contract-shape", contract), at("forbidden-import", contract), at("contract-shape", contract, 2)]);
  expect([[contract, declaration], [implementation, body],
    [file("ir-types", "index.ts"), 'export { Arena } from "./arena.js";']], rejected);
  const declaredContract = file("ir-types", "contract.d.ts");
  const declaredImplementation = file("ir-types", "arena.d.ts");
  const declaredBody = 'export declare class Arena { private readonly rows; private constructor(); static create(): Arena; }';
  expect([[declaredContract, declaration], [declaredImplementation, declaredBody]], []);
  expect([[declaredContract, declaration], [declaredImplementation, declaredBody.replace("private constructor", "public constructor")]],
    [at("class", declaredImplementation)]);
  expect([[declaredContract, declaration], [declaredImplementation, declaredBody],
    [file("ir-types", "index.d.ts"), 'export { Arena } from "./arena.js";']],
    [at("class", declaredImplementation), at("contract-shape", declaredImplementation)]);
});

test("strict unsafe and removed concepts retain their original opposites without banning authored text", () => {
  for (const text of ["export function run(input: any): number { return input; }",
    "export function run(input: number): number { return input as number; }",
    "export function run(input: number): number { return <number>input; }",
    "export function run(input?: number): number { return input!; }", "export enum State { Ready }", "export namespace State {}"])
    expect([[file("ids"), text]], [at("unsafe-type-escape", file("ids"))]);
  for (const directive of ["// @ts-ignore", "// @ts-expect-error", "// @ts-nocheck"])
    expect([[file("ids"), `${directive}\nexport const value = 1;`]], [at("unsafe-type-escape", file("ids"))]);
  expect([[file("ids"), 'export const authored = "@ts-ignore value: any as unknown";']], []);
  expect([[file("ids"), "export class View {}"]], [at("class", file("ids"))]);
  for (const member of ["seed", "register", "sealRegistration", "authenticate", "authorize", "lease", "questionView", "resourceScope"])
    expect([[file("ids", "contract.ts"), `export interface Removed { readonly ${member}: (input: number) => number; }`]], [at("removed-concept", file("ids", "contract.ts"))]);
  expect([[file("ids", "contract.ts"), "export function factory(): number { return 1; }"]], [at("contract-shape", file("ids", "contract.ts"))]);
});

test("only a canonical owner public constructor confers each nominal brand with its one assertion", () => {
  const contract = file("ids", "contract.ts");
  const entry = file("ids", "index.ts");
  const declaration = 'export type NodeId = number & { readonly identityKind: "node" }; export type NodeIdConstructor = (value: number) => NodeId;';
  const header = 'import type { NodeId, NodeIdConstructor } from "./contract.js"; ';
  expect([[contract, declaration], [entry, header + 'export const nodeId: NodeIdConstructor = value => value as NodeId;']], []);
  for (const implementation of [
    'export const nodeId: NodeIdConstructor = value => 0 as NodeId;',
    'export const other: NodeIdConstructor = value => value as NodeId;',
    'export const nodeId: NodeIdConstructor = value => (value as number) as NodeId;',
  ]) expect([[contract, declaration], [entry, header + implementation]], [at("unsafe-type-escape", entry, 1, header.length + 1)]);
  expect([[contract, declaration], [file("query", "index.ts"),
    'import type { NodeId } from "../ids/contract.js"; export const nodeId = (value: number): NodeId => value as NodeId;']],
  [at("contract-shape", file("query", "index.ts"), 1, 'import type { NodeId } from "../ids/contract.js"; '.length + 1),
    at("unsafe-type-escape", file("query", "index.ts"), 1, 'import type { NodeId } from "../ids/contract.js"; '.length + 1)]);
  expect([[contract, declaration], [file("ids"), header + 'export const nodeId: NodeIdConstructor = value => value as NodeId;']],
    [at("unsafe-type-escape", file("ids"), 1, header.length + 1)]);
});

test("canonical text encoders confer their own public brand without redecoding their output", () => {
  const contract = file("ids", "contract.ts");
  const implementation = file("ids", "identity.ts");
  const declaration = 'export type PackageId = string & { readonly identityKind: "package" }; export type EncodePackageId = (value: string) => PackageId;';
  const header = 'import type { PackageId, EncodePackageId } from "./contract.js"; ';
  const encoder = 'export const encodePackageId: EncodePackageId = value => `P[${value}]` as PackageId;';
  expect([[contract, declaration], [implementation, header + encoder],
    [file("ids", "index.ts"), 'export { encodePackageId } from "./identity.js";']], []);
  expect([[contract, declaration], [implementation, header + encoder],
    [file("ids", "index.ts"), 'import type { EncodePackageId } from "./contract.js"; import { encodePackageId as implementation } from "./identity.js"; export const encodePackageId: EncodePackageId = implementation;']], []);
  expect([[contract, declaration], [implementation, header + encoder]],
    [at("unsafe-type-escape", implementation, 1, header.length + 1)]);
  const renamed = encoder.replace("const encodePackageId:", "const other:");
  expect([[contract, declaration], [implementation, header + renamed],
    [file("ids", "index.ts"), 'export { other } from "./identity.js";']],
  [at("unsafe-type-escape", implementation, 1, header.length + 1)]);
  const forged = encoder.replace('`P[${value}]`', '"unvalidated"');
  expect([[contract, declaration], [implementation, header + forged],
    [file("ids", "index.ts"), 'export { encodePackageId } from "./identity.js";']],
  [at("unsafe-type-escape", implementation, 1, header.length + 1)]);
});

test("expected nonlocal unwinding belongs only to query and every new throw carries an Error", () => {
  for (const module of ["ids", "diag", "ir-types", "infer", "project"]) {
    const path = file(module);
    expect([[path, 'export function read(): number { try { return 1; } catch { return 0; } }']],
      [at("impure-component", path)]);
  }
  expect([[file("query"), 'export function read(): number { try { return 1; } catch { return 0; } }']], []);
  for (const value of ['{ kind: "resource-limit" }', "3", '"failure"', "null"]) {
    expect([[file("ids"), 'export function read(): never { throw ' + value + '; }']],
      [at("non-error-throw", file("ids"))]);
  }
  expect([[file("ids"), 'export function read(): never { throw new TypeError("caller defect"); }']], []);
  expect([[file("ids"), 'function failure(): TypeError { return new TypeError("caller defect"); } export function read(): never { throw failure(); }']], []);
  expect([[file("ids"), 'interface TypeError { readonly message: string; }\nfunction failure(): TypeError { return { message: "not a native Error" }; }\nexport function read(): never { throw failure(); }']],
    [at("non-error-throw", file("ids"), 3, 1)]);
  expect([[file("ids"), 'type TypeError = { readonly message: string };\nfunction failure(): TypeError { return { message: "not a native Error" }; }\nexport function read(): never { throw failure(); }']],
    [at("non-error-throw", file("ids"), 3, 1)]);
  expect([[file("ids"), 'type TypeError = { readonly kind: "left" } | { readonly kind: "right" };\nfunction failure(): TypeError { return { kind: "left" }; }\nexport function read(): never { throw failure(); }']],
    [at("non-error-throw", file("ids"), 3, 1)]);
  expect([[file("ids"), 'type TypeError = { readonly message: string } | { readonly detail: string };\nfunction failure(): TypeError { return { message: "not a native Error" }; }\nexport function read(): never { throw failure(); }']],
    [at("non-error-throw", file("ids"), 3, 1)]);
  expect([[file("query"), 'export function read(): never { const signal = new Error("private identity"); throw signal; }']], []);
  expect([[file("query"), 'export function read(): never { try { throw new Error("private identity"); } catch (error) { throw error; } }']], []);
});

const immutableTypes = ([
  "readonly number[]", "ReadonlyArray<readonly number[]>", "readonly [head: number, ...tail: string[]]",
  "readonly [number, ...Array<string>]", "{ readonly [key: string]: readonly number[] }", "{ get value(): number; }",
]);
const mutableTypes = ([
  "number[]", "[number, string?]", "Array<number>", "globalThis.Array<number>", "ReadonlyArray<number[]>", "ReadonlyMap<string, number>", "ReadonlySet<number>",
  "readonly [number[]]", "readonly (number[])[]", "readonly [...number[][]]", "{ value: number }",
  "{ [index: number]: number }", "{ set value(next: number); }", '{ -readonly [Key in "value"]: number }',
  '{ [Key in "value"]: number }', '{ [Key in never]: number }',
]);

test("immutable contracts retain readonly tuple repetitions and reject every mutable nested opposite", () => {
  const path = file("ids", "contract.ts");
  for (const type of immutableTypes) expect([[path, `export interface View { readonly values: ${type}; }`]], []);
  for (const type of mutableTypes) expect([[path, `export interface View { readonly values: ${type}; }`]],
    [at("contract-shape", path), ...(type.includes("globalThis") ? [at("unsafe-type-escape", path)] : [])]);
});

test("readonly, imported, generic, inherited, import-type and mapped forms share one transitive closure", () => {
  const origin = file("ids", "contract.ts");
  const consumer = file("diag", "contract.ts");
  for (const type of [...immutableTypes, ...mutableTypes]) {
    const allowed = immutableTypes.includes(type);
    const declaration = `export type Values = ${type};\nexport interface Wrapped<Value> { readonly value: Value; }`;
    for (const text of [
      'import type { Values } from "../ids/contract.js"; export interface View { readonly values: Values; }',
      'import type * as Data from "../ids/contract.js"; export interface View { readonly values: Data.Values; }',
      'export interface View { readonly values: import("../ids/contract.js").Values; }',
      'import type { Wrapped, Values } from "../ids/contract.js"; export interface View { readonly values: Wrapped<Values>; }',
    ]) {
      const result = inspect([[origin, declaration], [consumer, text]]);
      assert.equal(result.some(finding => finding.path === consumer && finding.code === "contract-shape"), !allowed, `${type}: ${text}`);
      assert.equal(result.every(finding => finding.code === "contract-shape" || type.includes("globalThis") && finding.code === "unsafe-type-escape" && finding.path === origin), true, `${type}: immutable closure and explicit ambient escape findings`);
    }
  }
  const mapped = `export type Copy<Value> = { [Key in keyof Value]: Value[Key] };
export type Keys<Value> = keyof Value;
export type Through<Value> = { [Key in Keys<Value>]: Value[Key] };
export type Readonly<Value> = { readonly [Key in keyof Value]: Value[Key] };
export type Partial<Value> = { [Key in keyof Value]?: Value[Key] };
export interface Input { readonly value: number; }
export interface Shared { readonly value: number; }
export interface Recursive { readonly next?: Recursive; readonly first: Shared; readonly second: Shared; }
export type Generic<Value> = Copy<Readonly<Value>>;`;
  for (const type of ["Copy<Input>", "Through<Input>", "Generic<{ value: number }>", "Partial<Readonly<{ value: number }>>",
    "Copy<Recursive>", "Copy<Input | { readonly other: boolean }>", "Copy<{ readonly child: Input & { readonly other: boolean } }>"])
    expect([[file("infer", "shape.ts"), mapped], [file("infer"), `import type { Copy, Through, Generic, Partial, Readonly, Input, Recursive } from "./shape.js"; export function read(deps: { readonly values: ${type} }, input: number): number { return deps.values === null ? 0 : input; }`]], []);
  const removed = 'export type Readonly<Value> = { readonly [Key in keyof Value]: Value[Key] };\nexport interface Authority { readonly seed: (value: number) => void; }';
  const result = inspect([[origin, removed], [consumer, 'import type { Readonly, Authority } from "../ids/contract.js"; export interface View { readonly source: Readonly<Authority>; }']]);
  assert.equal(result.some(finding => finding.path === consumer && finding.code === "removed-concept"), true);
});

test("contract records are declared by named arms, never derived by record operators", () => {
  const path = file("ids", "contract.ts");
  expect([[path, 'export interface First { readonly kind: "first"; readonly value: number; }\nexport interface Second { readonly kind: "second"; readonly value: string; }\nexport type Answer = First | Second;']], []);
  expect([[path, 'export type Passing = "value" | "place"; export type NonValue = Exclude<Passing, "value">;']], []);
  for (const expression of ['Omit<{ readonly value: number }, "value">', 'Pick<{ readonly value: number }, "value">',
    'Exclude<{ readonly value: number }, { readonly kind: "other" }>', '{ readonly [Key in "value"]: number }',
    'number extends string ? { readonly value: number } : { readonly other: string }', '{ readonly value: number }["value"]'])
    expect([[path, `export type Derived = ${expression};`]], [at("contract-shape", path)]);
});

test("A1 r2 admits only literal canonical record phase slots on their declared tsonic property", () => {
  const path = file("ir-hir", "contract.ts");
  const phase = 'export interface Phase { readonly BinaryExpression: object | null; readonly ForInOrOfStatement: object | null; readonly Token: object | null; }';
  const binary = 'export interface BinaryExpression<P extends Phase> { readonly kind: "BinaryExpression"; readonly tsonic: P["BinaryExpression"]; }';
  const shared = 'export interface ForInOrOfStatement<P extends Phase> { readonly kind: "ForInStatement" | "ForOfStatement"; readonly tsonic: P["ForInOrOfStatement"]; }';
  const token = 'export interface Token<P extends Phase, K extends string> { readonly kind: K; readonly tsonic: P["Token"]; }';
  const list = 'export interface NodeList<T> { readonly Loc: { readonly pos: number; readonly end: number }; readonly Nodes: readonly T[]; }';
  expect([[path, `${phase}\n${binary}\n${shared}\n${token}\n${list}`]], []);
  for (const record of [binary.replace('P["BinaryExpression"]', 'P["Token"]'),
    binary.replace('readonly tsonic:', 'readonly other:'), binary.replace('readonly tsonic:', 'readonly tsonic?:'),
    binary.replace('P extends Phase', 'P extends object'),
    binary.replace('P extends Phase', 'P extends OtherPhase'), binary.replace('P["BinaryExpression"]', 'Phase["BinaryExpression"]'),
    binary.replace('P["BinaryExpression"]', '{ readonly selected: P["BinaryExpression"] }'),
    token.replace('P["Token"]', 'P[K]'), shared.replace('P["ForInOrOfStatement"]', 'P["ForInStatement"]'),
    'export type Selection<P extends Phase> = P["BinaryExpression"];']) {
    const result = inspect([[path, `${phase}\nexport interface OtherPhase { readonly BinaryExpression: null; }\n${record}`]]);
    assert.equal(result.some(finding => finding.code === "contract-shape" && finding.line === 3), true, record);
  }
  expect([[path, phase.replace('object | null', 'object')]], [at("contract-shape", path)]);
  expect([[file("ir-tir", "contract.ts"), `${phase}\n${binary}`]],
    [at("contract-shape", file("ir-tir", "contract.ts")), at("contract-shape", file("ir-tir", "contract.ts"), 2)]);
});

const splitPhaseRecords = ([
  'export interface Phase { readonly ForInOrOfStatement: object | null; readonly CaseOrDefaultClause: object | null; readonly Token: object | null; }',
  'export interface ForInStatement<P extends Phase> { readonly kind: "ForInStatement"; readonly tsonic: P["ForInOrOfStatement"]; }',
  'export interface ForOfStatement<P extends Phase> { readonly kind: "ForOfStatement"; readonly tsonic: P["ForInOrOfStatement"]; }',
  'export interface CaseClause<Q extends Phase> { readonly kind: "CaseClause"; readonly tsonic: Q["CaseOrDefaultClause"]; }',
  'export interface DefaultClause<Q extends Phase> { readonly kind: "DefaultClause"; readonly tsonic: Q["CaseOrDefaultClause"]; }',
  'export type ForInOrOfStatement<P extends Phase> = ForInStatement<P> | ForOfStatement<P>;',
  'export type CaseOrDefaultClause<P extends Phase> = CaseClause<P> | DefaultClause<P>;',
]);

test("A4 admits both written kind-split Phase families with genuine renamed phase parameters", () => {
  expect([[file("ir-hir", "contract.ts"), splitPhaseRecords.join("\n")]], []);
});

test("A4 rejects an arm selecting a key outside its declared Phase family", () => {
  const path = file("ir-hir", "contract.ts");
  const records = splitPhaseRecords.map((record, index) => index === 1 ? record.replace('P["ForInOrOfStatement"]', 'P["Token"]') : record);
  expect([[path, records.join("\n")]], [at("contract-shape", path, 2), at("contract-shape", path, 3)]);
});

test("A4 rejects a Phase family when one member selects a different key", () => {
  const path = file("ir-hir", "contract.ts");
  const records = splitPhaseRecords.map((record, index) => index === 4 ? record.replace('Q["CaseOrDefaultClause"]', 'Q["Token"]') : record);
  expect([[path, records.join("\n")]], [at("contract-shape", path, 4), at("contract-shape", path, 5)]);
});

test("A4 rejects a Phase key naming an alias that is not a union", () => {
  const path = file("ir-hir", "contract.ts");
  const records = splitPhaseRecords.map((record, index) => index === 5 ? 'export type ForInOrOfStatement<P extends Phase> = ForOfStatement<P>;' : record);
  expect([[path, records.join("\n")]], [at("contract-shape", path, 2), at("contract-shape", path, 3)]);
});

test("A4 rejects a Phase key naming a union that does not contain its interface", () => {
  const path = file("ir-hir", "contract.ts");
  const records = splitPhaseRecords.map((record, index) => index === 5 ? 'export type ForInOrOfStatement<P extends Phase> = ForOfStatement<P> | CaseClause<P>;' : record);
  expect([[path, records.join("\n")]], [at("contract-shape", path, 2), at("contract-shape", path, 3)]);
});

test("A4 rejects a Phase key without its declared family alias", () => {
  const path = file("ir-hir", "contract.ts");
  expect([[path, splitPhaseRecords.filter((record, index) => index !== 5).join("\n")]],
    [at("contract-shape", path, 2), at("contract-shape", path, 3)]);
});

test("A4 does not borrow a Phase family alias from another contract", () => {
  const path = file("ir-hir", "contract.ts");
  const records = splitPhaseRecords.map((record, index) => index === 5 ? 'import type { ForInOrOfStatement } from "../ir-types/contract.js";' : record);
  const foreign = 'export interface First { readonly kind: "first"; }\nexport interface Second { readonly kind: "second"; }\nexport type ForInOrOfStatement<P> = First | Second;';
  expect([[path, records.join("\n")], [file("ir-types", "contract.ts"), foreign]],
    [at("contract-shape", path, 2), at("contract-shape", path, 3)]);
});

const compositionCases = ([
  ['const original: readonly (string | { readonly kind: string })[] = ["first", { kind: "second" }];', '["prefix", ...selected]', true],
  ['const first: readonly string[] = ["first"]; const original: readonly string[] = [...first, "second"];', '[...selected]', true],
  ['const original: readonly string[] = ["first", "second"];', 'selected[1]', true],
  ['const original: readonly string[] = ["first", "second"];', 'selected[0x1]', true],
  ['const original: readonly string[] = [];', '[...selected, "last"]', true],
  ['const original = "first";', '`head:${selected}:tail`', true],
  ['const original = "first";', 'selected + `:tail`', true],
  ['const original = ["first"];', '[...selected]', false],
  ['let original: readonly string[] = ["first"];', '[...selected]', false],
  ['const original: readonly { value: string }[] = [{ value: "first" }];', '[...selected]', false],
  ['const original: string[] = ["first"];', '[...selected]', false],
  ['const original: readonly string[] = ["first"];', '{ ...selected }', false],
  ['const original: { readonly value: string } = { value: "first" };', '[...selected]', false],
  ['const original: readonly string[] = ["first"];', 'selected[Number("0")]', false],
  ['const original: readonly string[] = ["first"];', 'selected[0 + 0]', false],
  ['const original: readonly string[] = ["first"];', 'selected[-1]', false],
  ['const original: readonly string[] = ["first"];', 'selected[0.5]', false],
  ['const original: readonly string[] = ["first"];', 'selected[1]', false],
  ['const original: readonly string[] = [];', 'selected[0]', false],
  ['declare const original: readonly string[];', 'selected[0]', false],
  ['const original = cycle; const cycle = original;', '[...selected]', false],
  ['const original: { readonly value: string } = { get value() { return "first"; } };', '[selected]', false],
  ['function original() { return "first"; }', '`${selected()}`', false],
  ['const original: readonly string[] = ["first"];', 'selected.slice()', false],
  ['const original: readonly string[] = ["first"];', 'selected.filter(() => true)', false],
]);

test("immutable module composition preserves actual local/imported originals and all scalar opposites", () => {
  const producer = file("ids", "original.ts");
  const consumer = file("ids", "consumer.ts");
  for (const [declaration, expression, allowed] of compositionCases) {
    const local = `\n${declaration}\nconst selected: readonly (string | { readonly kind: string })[] = original;\nexport const result: readonly (string | { readonly kind: string })[] = ${expression};`;
    const imported = `import { original as selected } from "./original.js";\nexport const result: readonly (string | { readonly kind: string })[] = ${expression};`;
    for (const entries of [[[consumer, local]], [[producer, `${declaration}\nexport { original };`], [consumer, imported]]]) {
      const result = inspect(entries);
      assert.equal(result.some(finding => finding.path === consumer && finding.code === "module-state"), !allowed, `${declaration} / ${expression}`);
      assert.equal(result.every(finding => finding.code === "module-state"), true, "no AST objects in diagnostics");
    }
  }
});

test("readonly indexed scalar data is immutable without admitting indexed mutable records", () => {
  const path = file("ids");
  for (const type of ["string", "number", "boolean", "bigint", "null", "string | number"]) {
    expect([[path, `interface Data { readonly value: ${type}; }\nconst values: readonly Data["value"][] = [];`]], []);
  }
  expect([[path, 'interface Data { readonly value: { field: number }; }\nconst values: readonly Data["value"][] = [];']],
    [at("module-state", path, 2)]);
  expect([[path, 'interface Data { readonly value: string | { field: number }; }\nconst values: readonly Data["value"][] = [];']],
    [at("module-state", path, 2)]);
});

test("portable product data rejects JavaScript object metadata and weak runtime mechanisms", () => {
  const path = file("ids");
  for (const method of ["freeze", "seal", "preventExtensions", "isFrozen", "isSealed", "isExtensible", "getPrototypeOf",
    "setPrototypeOf", "defineProperty", "defineProperties", "getOwnPropertyDescriptor", "getOwnPropertyDescriptors",
    "getOwnPropertyNames", "getOwnPropertySymbols", "create", "assign", "keys", "values", "entries", "hasOwn"]) {
    expect([[path, `export function read(value: object): unknown { return Object.${method}(value); }`]], [at("nonportable-runtime", path)]);
  }
  for (const name of ["Proxy", "WeakMap", "WeakSet", "WeakRef", "FinalizationRegistry"])
    expect([[path, `export function read(): unknown { return new ${name}(); }`]], [at("nonportable-runtime", path)]);
  for (const method of ["get", "set", "ownKeys", "has", "apply", "construct", "deleteProperty", "getPrototypeOf"])
    expect([[path, `export function read(value: object): unknown { return Reflect.${method}(value, "field"); }`]], [at("nonportable-runtime", path)]);
  for (const statement of [
    'Object["defineProperty"](value, "field", {});',
    'const nativeObject = Object; nativeObject.freeze(value);',
    'const { freeze: hold } = Object; hold(value);',
    'const nativeReflect = Reflect; nativeReflect.ownKeys(value);',
    'const Cache = WeakMap; return new Cache();',
  ]) expect([[path, `export function read(value: object): unknown { ${statement} }`]], [at("nonportable-runtime", path)]);
  expect([[path, 'export function read(Object: { readonly freeze: (value: number) => number }): number { return Object.freeze(1); }']], []);
  expect([[path, 'export function read(value: number): boolean { return Object.is(value, -0); }']], []);
  expect([[path, 'export function read(): string { return "Object.freeze is rejected"; }']], []);
});

test("actual compiler-loaded files, inventories and catalogue inputs cannot widen admission", () => {
  const path = file("ids");
  expect([[path, data]], []);
  const result = inspect([[path, data]], { loadedFiles: [fileURLToPath(import.meta.url)] });
  assert.equal(result.some(finding => finding.code === "loaded-source-escape"), true);
  assert.throws(() => inspect([[path, data]], { files: [path, path] }), /Distinct complete/u);
  assert.throws(() => inspect([[path, data]], { catalogue: [] }), /exact agreed/u);
  assert.throws(() => inspect([[path, data]], { files: ["../outside.ts"] }), /Canonical/u);
  const dynamic = 'export function load(deps: { readonly value: string }, input: string): Promise<unknown> { return import(input + deps.value); }';
  const expected = [at("unsafe-type-escape", file("front"), 1, dynamic.indexOf("import(") + 1)];
  expect([[file("front"), dynamic]], expected);
});

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { dirname, posix, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { hostCatalogue } from "./host/catalogue.mjs";
import { inspectHost, inspectionDeps } from "./host/inspect.mjs";

const repository = fileURLToPath(new URL("../../", import.meta.url));
const host = "packages/host/src";
const file = (module, name = "unit.ts") => `${host}/${module}/${name}`;
const data = "export interface Data { readonly value: number; }";
const first = ["ids", "diag", "ir-types", "ir-hir", "ir-tir", "ir-mir", "ir-facts"];
const expectedImports = Object.freeze([
  ["ids", []], ["diag", ["ids"]], ["ir-types", first.slice(0, 2)], ["ir-hir", first.slice(0, 3)],
  ["ir-infer", first.slice(0, 4)], ["ir-tir", [...first.slice(0, 4), "ir-infer"]], ["ir-mir", [...first.slice(0, 5), "ir-infer"]], ["ir-facts", [...first.slice(0, 6), "ir-infer"]],
  ["ir-program", [...first, "ir-infer"]], ["dataflow", ["ids", "ir-mir"]], ["query", ["ids", "diag"]],
  ["libraries", ["ids", "diag", "ir-types", "ir-facts"]], ["snapshot", ["ids", "diag"]],
  ["front", [...first.slice(0, 4), "libraries", "snapshot"]], ["decls", [...first.slice(0, 4), "libraries"]],
  ["rules", [...first.slice(0, 4), "libraries", "ir-infer"]], ["infer", [...first.slice(0, 4), "dataflow", "ir-infer"]],
  ["elaborate", [...first.slice(0, 5), "ir-infer"]], ["validate", [...first.slice(0, 5), "libraries", "ir-infer"]],
  ["lower-mir", first.slice(0, 6)], ["evaluate", [...first.slice(0, 6), "libraries"]],
  ["metadata", [...first.slice(0, 4), "ir-facts"]],
  ...["liveness", "initialization", "refinements", "origins", "suspension", "errorStorage", "pointerBacking"].map(name => [`analyses/${name}`, [...first, "dataflow"]]),
  ["summaries", [...first, "dataflow"]],
  ["pipeline", [...first.slice(0, 4), "ir-infer", ...first.slice(4), "ir-program", "dataflow", "query", "libraries", "snapshot", "front", "decls", "rules", "infer", "elaborate", "validate", "lower-mir", "evaluate", "metadata",
    "analyses/liveness", "analyses/initialization", "analyses/refinements", "analyses/origins", "analyses/suspension", "analyses/errorStorage", "analyses/pointerBacking", "summaries"]],
  ...["project", "packages", "plugins", "artifacts"].map(name => [name, ["ids", "diag", "snapshot"]]),
  ["orchestration", ["ids", "diag", "snapshot", "ir-program", "pipeline", "project", "packages", "plugins", "artifacts"]],
  ["cli", ["orchestration", "diag", "snapshot"]], ["create-tsonic", ["orchestration", "diag", "snapshot"]],
]);

function inspect(entries, extra = {}) {
  const parent = resolve(repository, ".temp/host-s1-structure");
  mkdirSync(parent, { recursive: true });
  const root = mkdtempSync(resolve(parent, "case-"));
  try {
    for (const [path, text] of entries) {
      mkdirSync(dirname(resolve(root, path)), { recursive: true });
      writeFileSync(resolve(root, path), text);
    }
    return inspectHost(inspectionDeps, { root, files: entries.map(([path]) => path), catalogue: hostCatalogue,
      loadedFiles: [], configurations: [], ...extra });
  } finally { rmSync(root, { recursive: true }); }
}

function expect(entries, expected) {
  const actual = inspect(entries);
  assert.equal(JSON.stringify(actual), JSON.stringify(expected), `${entries.map(([path]) => path).join(",")}: exact scalar findings ${JSON.stringify(actual)}`);
  assert.equal(Object.isFrozen(actual), true);
}

const at = (code, path, line = 1, column = 1) => ({ code, path, line, column });

test("the complete R6 catalogue and snapshot amendment have exactly one explicit row per owner", () => {
  assert.equal(hostCatalogue.length, 38);
  assert.equal(JSON.stringify(hostCatalogue.map(module => [module.name, module.imports])), JSON.stringify(expectedImports));
  assert.equal(hostCatalogue.every(module => Object.isFrozen(module) && Object.isFrozen(module.imports)), true);
  assert.equal(hostCatalogue.filter(module => module.kind === "library").length, 13);
  assert.equal(hostCatalogue.filter(module => module.kind === "component").length, 17);
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

test("actual type-only, import-type, value and re-export edges participate in cycles", () => {
  for (const prefix of ["import type { Data }", "import { Data }", "export type { Data }", "export { Data }"]) {
    const left = file("ids", "left.ts");
    const right = file("ids", "right.ts");
    expect([[left, `${prefix} from "./right.js";`], [right, `${prefix} from "./left.js";`]],
      [at("source-cycle", left), at("source-cycle", right)]);
  }
  expect([[file("ids", "left.ts"), 'export type Left = import("./right.js").Right;'],
    [file("ids", "right.ts"), 'export type Right = import("./left.js").Left;']],
  [at("source-cycle", file("ids", "left.ts")), at("source-cycle", file("ids", "right.ts"))]);
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
  expect([[ownTest, 'import { infer } from "../../../../packages/host/src/infer/unit.js";'], [component, implementation]], []);
  const otherTest = "test/host-cases/elaborate/function/owner.test.mjs";
  expect([[otherTest, 'import { infer } from "../../../../packages/host/src/infer/unit.js";'], [component, implementation]], [at("forbidden-import", otherTest)]);
});

test("allowed callers directly use contract-typed library values but never deep paths", () => {
  const contract = file("ir-types", "contract.ts");
  const entry = file("ir-types", "index.ts");
  const values = [[contract, "export type Substitute = (input: number) => number;"],
    [entry, 'import type { Substitute } from "./contract.js"; export const substitute: Substitute = input => input + 1;']];
  expect([...values, [file("infer"), 'import { substitute } from "../ir-types/index.js"; export function infer(deps: { readonly bias: number }, input: number): number { return substitute(input) + deps.bias; }']], []);
  expect([[file("ir-types", "index.ts"), "export const substitute = (input: number): number => input + 1;"]],
    [at("contract-shape", file("ir-types", "index.ts"))]);
});

test("quarantined code is never executable input; ordinary source and citation data remain ordinary data", () => {
  expect([[file("infer"), 'import type { Data } from "../../../../_old/reference/contract.js";']], [at("forbidden-import", file("infer"))]);
  expect([[file("ids"), 'export const path = "_old/reference/source.ts";']], [at("forbidden-import", file("ids"))]);
  expect([[file("ids"), 'export const text = "pending lease authenticate questionView";']], []);
  const config = "config.json";
  const result = inspect([[file("ids"), data], [config, JSON.stringify({ references: ["_old/reference/program.ts"] })]], { files: [file("ids")], configurations: [config] });
  assert.equal(JSON.stringify(result), JSON.stringify([at("forbidden-import", config)]));
  const citation = inspect([[file("ids"), data], [config, JSON.stringify({ oldSource: { area: "reference", path: "_old/reference/program.ts", test: "citation" } })]],
    { files: [file("ids")], configurations: [config] });
  assert.equal(citation.length, 0);
});

test("pure stages require deps first, typed immutable inputs and no captured module state", () => {
  for (const text of ["export function run(input: number): number { return input; }",
    "export function run(input: number, deps: { readonly bias: number }): number { return input + deps.bias; }",
    "export function run(deps: { bias: number }, input: number): number { return input + deps.bias; }",
    "export function run(deps, input) { return input; }"]) expect([[file("infer"), text]], [at("impure-component", file("infer"))]);
  expect([[file("infer"), "let count = 0;\nexport function run(deps: { readonly bias: number }, input: number): number { count += 1; return input + deps.bias + count; }"]],
    [at("module-state", file("infer"))]);
  expect([[file("infer"), "export function run(deps: { readonly bias: number }, input: number): number { return input + deps.bias; }"]], []);
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

const immutableTypes = Object.freeze([
  "readonly number[]", "ReadonlyArray<readonly number[]>", "readonly [head: number, ...tail: string[]]",
  "readonly [number, ...Array<string>]", "{ readonly [key: string]: readonly number[] }", "{ get value(): number; }",
]);
const mutableTypes = Object.freeze([
  "number[]", "[number, string?]", "Array<number>", "globalThis.Array<number>", "ReadonlyArray<number[]>",
  "readonly [number[]]", "readonly (number[])[]", "readonly [...number[][]]", "{ value: number }",
  "{ [index: number]: number }", "{ set value(next: number); }", '{ -readonly [Key in "value"]: number }',
  '{ [Key in "value"]: number }', '{ [Key in never]: number }',
]);

test("immutable contracts retain readonly tuple repetitions and reject every mutable nested opposite", () => {
  const path = file("ids", "contract.ts");
  for (const type of immutableTypes) expect([[path, `export interface View { readonly values: ${type}; }`]], []);
  for (const type of mutableTypes) expect([[path, `export interface View { readonly values: ${type}; }`]], [at("contract-shape", path)]);
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
      assert.equal(result.every(finding => finding.code === "contract-shape"), true, `${type}: only immutable closure findings`);
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
    expect([[origin, mapped], [consumer, `import type { Copy, Through, Generic, Partial, Readonly, Input, Recursive } from "../ids/contract.js"; export interface View { readonly values: ${type}; }`]], []);
  const removed = 'export type Readonly<Value> = { readonly [Key in keyof Value]: Value[Key] };\nexport interface Authority { readonly seed: (value: number) => void; }';
  const result = inspect([[origin, removed], [consumer, 'import type { Readonly, Authority } from "../ids/contract.js"; export interface View { readonly source: Readonly<Authority>; }']]);
  assert.equal(result.some(finding => finding.path === consumer && finding.code === "removed-concept"), true);
});

const compositionCases = Object.freeze([
  ['const original = Object.freeze(["first", Object.freeze({ kind: "second" })]);', 'Object.freeze(["prefix", ...selected])', true],
  ['const first = Object.freeze(["first"]); const original = Object.freeze([...first, "second"]);', 'Object.freeze([...selected])', true],
  ['const original = Object.freeze(["first", "second"]);', 'selected[1]', true],
  ['const original = Object.freeze(["first", "second"]);', 'selected[0x1]', true],
  ['const original = Object.freeze([]);', 'Object.freeze([...selected, "last"])', true],
  ['const original = "first";', '`head:${selected}:tail`', true],
  ['const original = "first";', 'selected + `:tail`', true],
  ['const original = ["first"];', 'Object.freeze([...selected])', false],
  ['let original = Object.freeze(["first"]);', 'Object.freeze([...selected])', false],
  ['const original = Object.freeze([{}]);', 'Object.freeze([...selected])', false],
  ['const original = Object.freeze(["first"]);', '[...selected]', false],
  ['const original = Object.freeze(["first"]);', 'Object.freeze({ ...selected })', false],
  ['const original = Object.freeze({ value: "first" });', 'Object.freeze([...selected])', false],
  ['const original = Object.freeze(["first"]);', 'selected[Number("0")]', false],
  ['const original = Object.freeze(["first"]);', 'selected[0 + 0]', false],
  ['const original = Object.freeze(["first"]);', 'selected[-1]', false],
  ['const original = Object.freeze(["first"]);', 'selected[0.5]', false],
  ['const original = Object.freeze(["first"]);', 'selected[1]', false],
  ['const original = Object.freeze([]);', 'selected[0]', false],
  ['declare const original: readonly string[];', 'selected[0]', false],
  ['const original = cycle; const cycle = original;', 'Object.freeze([...selected])', false],
  ['const original = Object.freeze({ get value() { return "first"; } });', 'Object.freeze([selected])', false],
  ['function original() { return "first"; }', '`${selected()}`', false],
  ['const original = Object.freeze(["first"]);', 'Object.freeze(selected.slice())', false],
  ['const original = Object.freeze(["first"]);', 'Object.freeze(selected.filter(() => true))', false],
]);

test("immutable module composition preserves actual local/imported originals and all scalar opposites", () => {
  const producer = file("ids", "original.ts");
  const consumer = file("ids", "consumer.ts");
  for (const [declaration, expression, allowed] of compositionCases) {
    const local = `\n${declaration}\nconst selected = original;\nexport const result = ${expression};`;
    const imported = `import { original as selected } from "./original.js";\nexport const result = ${expression};`;
    for (const entries of [[[consumer, local]], [[producer, `${declaration}\nexport { original };`], [consumer, imported]]]) {
      const result = inspect(entries);
      assert.equal(result.some(finding => finding.path === consumer && finding.code === "module-state"), !allowed, `${declaration} / ${expression}`);
      assert.equal(result.every(finding => finding.code === "module-state"), true, "no AST objects in diagnostics");
    }
  }
});

test("actual compiler-loaded files, inventories and catalogue inputs cannot widen admission", () => {
  const path = file("ids");
  expect([[path, data]], []);
  const result = inspect([[path, data]], { loadedFiles: [fileURLToPath(import.meta.url)] });
  assert.equal(result.some(finding => finding.code === "loaded-source-escape"), true);
  assert.throws(() => inspect([[path, data]], { files: [path, path] }), /Distinct complete/u);
  assert.throws(() => inspect([[path, data]], { catalogue: [] }), /exact agreed/u);
  assert.throws(() => inspect([[path, data]], { files: ["../outside.ts"] }), /Canonical/u);
});

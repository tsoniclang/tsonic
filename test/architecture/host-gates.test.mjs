import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { inspectHostStructure } from "./tooling/host-gates.mjs";
import { hostModules } from "./tooling/host-modules.mjs";

const temporary = resolve(".temp/host-gate-fixtures");
const model = "packages/host/src/model/contract.ts";
const facts = "export interface Facts { readonly value: number; }";

function fixture(files, body, declarationFiles = []) {
  mkdirSync(temporary, { recursive: true });
  const root = mkdtempSync(resolve(temporary, "case-"));
  try {
    for (const [file, text] of files) {
      mkdirSync(dirname(resolve(root, file)), { recursive: true });
      writeFileSync(resolve(root, file), text);
    }
    return body({ root, files: [...files.keys()], declarationFiles });
  } finally { rmSync(root, { recursive: true }); }
}

function expect(files, gates, declarationFiles = []) {
  return fixture(new Map(files), input => {
    const rows = inspectHostStructure(input);
    assert.equal(rows.length, gates.length, `complete finding domain: ${rows.map(row => `${row.gate}:${row.message}`).join("; ")}`);
    assert.deepEqual(rows.map(row => row.gate).sort(), [...gates].sort());
    assert.equal(Object.isFrozen(rows) && rows.every(Object.isFrozen), true);
    assert.equal(rows.every(row => Number.isSafeInteger(row.start) && row.start >= 0 &&
      input.files.includes(row.file) && typeof row.message === "string" && row.message.length > 0), true);
    return rows;
  }, declarationFiles);
}

test("Host catalogue is the complete immutable responsibility, layer and contract domain", () => {
  assert.deepEqual(hostModules.map(module => module.name), ["model", "context", "libraries", "ingress", "navigation",
    "descriptors", "relations", "constants", "enums", "objects", "profile", "core-facts", "callables", "type-flow",
    "admission", "protocols", "control-flow", "storage", "memory", "ownership", "error-storage", "safety", "publication",
    "project", "packages", "plugins", "artifacts", "orchestration", "command", "scaffolding"]);
  assert.equal(new Set(hostModules.map(module => module.directory)).size, 30);
  assert.equal(Object.isFrozen(hostModules) && hostModules.every(module => Object.isFrozen(module) &&
    Object.isFrozen(module.dependencies) && module.responsibility.length > 0 && module.contract === `${module.directory}/contract.ts`), true);
});

test("directory ownership rejects code in containers and undeclared nested modules", () => {
  for (const file of ["packages/host/src/value.ts", "packages/host/src/objects/private/value.ts", "packages/other/src/value.ts"])
    expect([[file, facts]], ["directory-ownership"]);
  expect([[model, facts]], []);
});

test("contract imports reject every static, export, dynamic and inline private path", () => {
  const privateFile = "packages/host/src/objects/private.ts";
  for (const text of [
    'import type { Facts } from "../objects/private.js";',
    'export type { Facts } from "../objects/private.js";',
    'type Facts = import("../objects/private.js").Facts;',
    'export function load() { return import("../objects/private.js"); }',
  ]) expect([["packages/host/src/descriptors/reader.ts", text], [privateFile, facts]], ["contract-imports"]);
  expect([["packages/host/src/descriptors/reader.ts", 'import type { Facts } from "../objects/contract.js";'],
    ["packages/host/src/objects/contract.ts", facts]], []);
});

test("layers reject upward type contracts and accept only declared lower or peer contracts", () => {
  expect([["packages/host/src/model/value.ts", 'import type { Facts } from "../navigation/contract.js";'],
    ["packages/host/src/navigation/contract.ts", facts]], ["layers"]);
  expect([["packages/host/src/constants/value.ts", 'import type { Facts } from "../model/contract.js";'], [model, facts]], []);
  expect([["packages/host/src/orchestration/owner.ts", 'import { register } from "../navigation/register.js";'],
    ["packages/host/src/navigation/register.ts", "export function register(): void {}"]], []);
  expect([["packages/host/src/constants/value.ts", 'import { register } from "../navigation/register.js";'],
    ["packages/host/src/navigation/register.ts", "export function register(): void {}"]], ["contract-imports"]);
  expect([["packages/host/src/model/contract.ts", 'import type { Facts } from "../navigation/private.js";'],
    ["packages/host/src/navigation/private.ts", facts]], ["contract-closure", "contract-imports", "layers"]);
});

test("lifetime rejects generic, static, nested and closure-owned mutable collections without exemptions", () => {
  for (const text of ["const cache = new WeakMap();", "const cache = new WeakSet<object>();",
    "const cache = new Map<object, number>();", "const cache = new Set<object>();",
    "const cache = Object.freeze(new Map());", "const state = { cache: new Set() };",
    "class View { static cache = new WeakMap<object, number>(); }",
    "class View { static { const cache = new WeakSet<object>(); } }",
    "const read = (() => { const cache = new WeakMap<object, number>(); return value => cache.get(value); })();"])
    expect([["packages/host/src/ingress/owner.ts", text]],
      text.startsWith("const read") ? ["program-lifetime", "program-lifetime"] : ["program-lifetime"]);
  expect([["packages/host/src/ingress/owner.ts", `
    const catalogue = Object.freeze({ names: Object.freeze(["one", "two"]) });
    const name = "entry"; const alias = name;
    const stable = Object.freeze({ alias });
    export function createOwner() { const cache = new WeakMap(); return { read(value) { return cache.get(value); } }; }
    class View { cache = new Map(); }
  `]], []);
  for (const text of ["let current = 1;", "var current = 1;", "class View { static current = 1; }",
    "const first = second; const second = first;", "const values = [];", "const values = {};",
    "const values = Object.freeze({ nested: [] });"])
    expect([["packages/host/src/ingress/owner.ts", text]],
      text.startsWith("const first") ? ["program-lifetime", "program-lifetime"] : ["program-lifetime"]);
  expect([["packages/host/src/ingress/owner.ts", "class View { static readonly names = Object.freeze([1, 2]); }"]], []);
});

test("checker types stay in Ingress implementation and never its contract", () => {
  expect([["packages/host/src/objects/reader.ts", 'import type { Type } from "@tsonic/tsts";']], ["ingress-checker"]);
  expect([["packages/host/src/ingress/contract.ts", 'import type { Type } from "@tsonic/tsts";']], ["ingress-checker"]);
  expect([["packages/host/src/ingress/reader.ts", 'import type { Type } from "@tsonic/tsts";']], []);
  expect([[model, facts]], []);
  expect([["packages/host/src/objects/reader.ts", 'export function load() { return import("@tsonic/tsts"); }']], ["ingress-checker"]);
  expect([["packages/host/src/objects/reader.ts", 'import * as Checker from "@tsonic/tsts";']], ["ingress-checker"]);
  expect([["packages/host/src/ingress/reader.ts", 'export function load() { return import("@tsonic/tsts"); }']], []);
});

test("raw checker aliases and transitive Publication authority cannot hide behind closed records", () => {
  expect([["packages/host/src/ingress/contract.ts", 'import type { Type } from "@tsonic/tsts"; export interface Raw { readonly child: Type; }'],
    ["packages/host/src/constants/contract.ts", 'import type { Raw } from "../ingress/contract.js"; export interface Answer { readonly data: Raw; }']],
  ["ingress-checker", "ingress-checker", "ingress-checker"]);
  expect([["packages/host/src/context/contract.ts", "export interface Authority { seed(): void; }"],
    ["packages/host/src/publication/contract.ts", 'import type { Authority } from "../context/contract.js"; export interface ReadOnly { readonly nested: Authority; }']],
  ["read-only-publication"]);
  expect([["packages/host/src/context/contract.ts", "export interface Authority { seed(): void; } export interface Inherited extends Authority {}"],
    ["packages/host/src/publication/contract.ts", 'import type { Inherited } from "../context/contract.js"; export interface ReadOnly extends Inherited {}']],
  ["read-only-publication"]);
  expect([[model, "export interface Opaque { readonly identity: unique symbol; }"]], []);
  expect([[model, 'import type { Solver } from "../type-flow/contract.js"; export interface Callback { readonly request: (provider: Solver) => number; }'],
    ["packages/host/src/type-flow/contract.ts", "export interface Solver { solve(): number; }"]], ["layers"]);
  expect([["packages/host/src/context/contract.ts", `
    declare const questionTypes: unique symbol;
    export type Retention<Answer> = unknown extends Answer ? never : object extends Answer ? never : "immutable";
    export interface Question<Input, Answer> { readonly [questionTypes]?: { readonly input: (value: Input) => Input; readonly answer: (value: Answer) => Answer; }; }
    export interface Scope { withDepth<T>(action: () => T): T; }
    export type Provider<Input, Answer> = (input: Input, scope: Scope) => Answer;
    export interface Context { provide<Input, Answer>(provider: Provider<Input, Answer>): void; }
  `]], []);
  expect([[model, "export interface Operation { readonly apply: (value: number) => number; }"]], []);
});

test("one current name rejects renamed imports, exports, wildcard and forwarding facades", () => {
  expect([[model, 'const value = 1; export { value as second };']], ["one-current-name"]);
  expect([[model, 'export * from "./facts.js";'], ["packages/host/src/model/facts.ts", facts]], ["one-current-name"]);
  expect([["packages/host/src/model/value.ts", 'import { bound as other } from "./facts.js";'],
    ["packages/host/src/model/facts.ts", "export function bound(value: number): boolean { return value > 0; }"]], ["one-current-name"]);
  expect([["packages/host/src/model/value.ts", 'import { bound } from "./facts.js"; export function second(value: number) { return bound(value); }'],
    ["packages/host/src/model/facts.ts", "export function bound(value: number): boolean { return value > 0; }"]], ["one-current-name"]);
  expect([["packages/host/src/model/value.ts", 'import { bound } from "./facts.js"; export function transformed(value: number) { return bound(value + 1); }'],
    ["packages/host/src/model/facts.ts", "export function bound(value: number): boolean { return value > 0; }"]], []);
  expect([["packages/host/src/model/value.ts", 'import { bound } from "./facts.js"; export function configured(value = 1) { return bound(value); }'],
    ["packages/host/src/model/facts.ts", "export function bound(value: number): boolean { return value > 0; }"]], []);
  expect([["packages/host/src/model/value.ts", 'import { collect } from "./facts.js"; export const second = (...values: number[]) => collect(...values);'],
    ["packages/host/src/model/facts.ts", "export function collect(...values: number[]): number { return values.length; }"]], ["one-current-name"]);
  expect([["packages/host/src/model/value.ts", 'import { bound } from "./facts.js"; export function transformed(first: number, second: number) { return bound(first + second); }'],
    ["packages/host/src/model/facts.ts", "export function bound(value: number): boolean { return value > 0; }"]], []);
  expect([[model, facts]], []);
});

test("strict source rejects every assertion form and runtime-shape shortcut, not authored fixture text", () => {
  for (const text of ["export function read(value: any) { return value; }", "export function read(value: number) { return value as number; }",
    "export function read(value: number) { return <number>value; }", "export function read(value?: number) { return value!; }",
    "export enum State { Ready }", "export namespace State {}"])
    expect([["packages/host/src/model/value.ts", text]], ["strict-source"]);
  expect([["packages/host/src/model/value.ts", 'export const authored = "const value: any = original as unknown";']], []);
  expect([["packages/host/src/model/value.ts", "export function read(value: number | undefined): number { return value === undefined ? 0 : value; }"]], []);
});

test("external consumers use only Publication, never a private service or retired package", () => {
  expect([["consumer.ts", 'import type { Facts } from "./packages/host/src/model/contract.js";'], [model, facts]], ["publication-consumer"]);
  expect([["consumer.ts", 'import type { Facts } from "./packages/host/src/publication/contract.js";'],
    ["packages/host/src/publication/contract.ts", facts]], []);
  expect([["consumer.ts", 'import type { Facts } from "@tsonic/host/private";']], ["publication-consumer"]);
  expect([["consumer.ts", 'import { readFile } from "node:fs";']], []);
});

test("Publication exposes immutable answers, not builders, seeds or program back-pointers", () => {
  for (const member of ["seed", "register", "intern", "set", "seal", "resourceScope", "evidence"])
    expect([["packages/host/src/publication/contract.ts", `export interface View { ${member}(value: number): void; }`]], ["read-only-publication"]);
  expect([["packages/host/src/publication/contract.ts", "export interface View { readonly source: { seed(value: number): void; }; }"]], ["read-only-publication"]);
  expect([["packages/host/src/publication/contract.ts", "export interface View { readonly seed: (value: number) => void; }"]], ["read-only-publication"]);
  expect([["packages/host/src/publication/contract.ts", "export interface View { readonly programIdentity: string; value(): number; }"]], []);
  expect([["packages/host/src/publication/contract.ts", "export interface View { readonly values: Map<string, number>; }"]],
    ["contract-closure", "read-only-publication"]);
  expect([["packages/host/src/publication/contract.ts", "export interface View { readonly values: ReadonlyMap<string, number>; }"]], []);
});

test("retired package entries and semantic accessors are rejected rather than aliased", () => {
  for (const name of ["@tsonic/target-api", "@tsonic/target-api/source", "@tsonic/source-core/facts", "@tsonic/js-source-profile"])
    expect([["packages/host/src/objects/value.ts", `import type { Facts } from "${name}";`]], ["retired-api"]);
  expect([["packages/host/src/storage/contract.ts", "export interface View { readonly effectiveTypes: string; }"]], ["retired-api"]);
  expect([["packages/host/src/storage/contract.ts", facts]], []);
  expect([["packages/host/src/storage/owner.ts", "export function read(view: View) { return view.effectiveTypes; }"]], ["retired-api"]);
});

test("declaration closure rejects private dependencies, inferred factories and capability disguises", () => {
  expect([[model, 'import type { Facts } from "./facts.js";'], ["packages/host/src/model/facts.ts", facts]], []);
  expect([[model, "export type Facts = ReturnType<typeof createFacts>; function createFacts() { return 1; }"]], ["contract-closure", "contract-closure"]);
  expect([[model, 'import type { Facts } from "./private.js";'],
    ["packages/host/src/model/private.ts", "export function createFacts() { return 1; }"]], ["contract-closure"]);
  expect([[model, "export interface Facts { value: number; }"]], ["contract-closure"]);
  expect([[model, "export interface Facts { readonly value: unknown; }"]], ["contract-closure"]);
  expect([[model, "export interface Facts { readonly value: object; }"]], ["contract-closure"]);
  expect([[model, "export interface Facts { readonly value: string | unknown; }"]], ["contract-closure"]);
  expect([[model, "export interface Facts { readonly value: () => (() => number); }"]], []);
  expect([[model, facts]], []);
  const declaration = "packages/host/src/model/contract.d.ts";
  expect([[declaration, facts]], [], [declaration]);
});

test("isolation's structural half rejects unresolved or ambiguous implementation dependencies", () => {
  expect([["packages/host/src/model/value.ts", 'import { value } from "./missing.js";']], ["isolated-compile"]);
  expect([["packages/host/src/model/value.ts", 'import { value } from "./same.js";'],
    ["packages/host/src/model/same.ts", "export const value = 1;"],
    ["packages/host/src/model/same.mts", "export const value = 2;"]], ["isolated-compile"]);
  expect([["packages/host/src/model/value.ts", 'import type { Facts } from "./contract.js";'], [model, facts]], []);
  expect([["packages/host/src/constants/value.ts", 'import type { Facts } from "@tsonic/host/private";']], ["contract-imports"]);
  expect([["packages/host/src/constants/value.ts", 'import type { Facts } from "unlisted-peer";']], ["isolated-compile"]);
  expect([[model, 'import type { FileHandle } from "node:fs/promises";']], ["layers"]);
  expect([["packages/host/src/project/files.ts", 'import { readFile } from "node:fs/promises";']], []);
});

test("tool failures, traversal, foreign symlinks and duplicate inputs never become an empty gate result", () => {
  fixture(new Map([[model, facts]]), input => {
    assert.throws(() => inspectHostStructure({ ...input, files: [], declarationFiles: [] }), /complete distinct/u);
    assert.throws(() => inspectHostStructure({ ...input, files: [model, model] }), /distinct/u);
    assert.throws(() => inspectHostStructure({ ...input, files: ["../foreign.ts"] }), /canonical/u);
    assert.throws(() => inspectHostStructure({ ...input, files: ["/absolute.ts"] }), /canonical/u);
    assert.throws(() => inspectHostStructure({ ...input, files: ["missing.ts"] }), /ENOENT/u);
    symlinkSync(resolve("package.json"), resolve(input.root, "foreign.ts"));
    assert.throws(() => inspectHostStructure({ ...input, files: ["foreign.ts"] }), /escapes/u);
    symlinkSync(resolve(input.root, model), resolve(input.root, "alias.ts"));
    assert.throws(() => inspectHostStructure({ ...input, files: ["alias.ts"] }), /original owned/u);
  });
});

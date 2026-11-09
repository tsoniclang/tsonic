import assert from "node:assert/strict";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { inspectHostMigration, inspectHostStructure } from "./tooling/host-gates.mjs";
import { hostModules, hostReferenceCommit, hostUnmigratedFiles } from "./tooling/host-modules.mjs";
import { readSourceInventory } from "./tooling/file-inventory.mjs";

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

test("the whole current Host is gated and each unchanged reference file is explicitly UNMIGRATED, never PASS", context => {
  const root = resolve(new URL("../..", import.meta.url).pathname);
  const manifest = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
  assert.equal(manifest.scripts["test:host:architecture"], "node --test --test-concurrency=1 " + [
    "test/architecture/host-gates.test.mjs", "test/architecture/host-isolated.test.mjs",
    "test/architecture/module-imports.test.mjs", "test/architecture/source-boundary-rules.test.mjs",
    "test/architecture/keel-tooling-reuse.test.mjs",
  ].join(" "), "the current command owns all gate fixtures and the whole current-C1 live inspection");
  const packages = readdirSync(resolve(root, "packages"), { withFileTypes: true })
    .filter(entry => entry.isDirectory() && entry.name !== "tsts").map(entry => entry.name).sort();
  const sources = new Map();
  for (const name of packages) {
    const prefix = `packages/${name}`;
    const directory = resolve(root, prefix, "src");
    if (existsSync(directory)) {
      assert.equal(lstatSync(directory).isSymbolicLink(), false, `${prefix}/src must be original source`);
      assert.equal(readdirSync(directory, { recursive: true, withFileTypes: true }).some(entry => entry.isSymbolicLink()), false,
        `${prefix}/src must not hide source behind symlinks`);
      for (const [file, text] of readSourceInventory(directory, { extensions: [".ts", ".tsx", ".mts", ".cts", ".js", ".mjs", ".cjs"] }))
        sources.set(`${prefix}/src/${file}`, text);
    }
    const manifest = `${prefix}/package.json`;
    if (existsSync(resolve(root, manifest))) sources.set(manifest, readFileSync(resolve(root, manifest), "utf8"));
  }
  const reference = execFileSync("git", ["ls-tree", "-r", hostReferenceCommit, "--",
    ...["host", "target-api", "source-core", "js-source-profile", "cli", "create-tsonic"]
      .flatMap(name => [`packages/${name}/src`, `packages/${name}/package.json`])], { cwd: root, encoding: "utf8" });
  const originals = reference.trim().split("\n").map(line => {
    const match = /^\d+ blob ([a-f0-9]{40})\t(.+)$/u.exec(line);
    assert.equal(match !== null, true, "every original is an actual Git blob with an exact path");
    return { file: match[2], blob: match[1] };
  });
  assert.equal(originals.length > 0 && sources.size > 0, true, "both complete original and current source domains exist");
  const active = hostModules.filter(module => sources.has(module.contract) || sources.has(`${module.directory}/register.ts`));
  const expected = originals.filter(original => {
    if (!sources.has(original.file) || /\/(?:contract|register)(?:\.d)?\.(?:[cm]?[jt]sx?)$/u.test(original.file) ||
      active.some(module => original.file.startsWith(`${module.directory}/`))) return false;
    const bytes = readFileSync(resolve(root, original.file));
    return createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex") === original.blob;
  }).map(original => original.file).sort();
  assert.deepEqual(hostUnmigratedFiles.map(entry => entry.file).sort(), expected,
    "the shrink-only catalogue is exactly the remaining original files, not a prefix, stale entry or new exemption");
  assert.equal(Object.isFrozen(hostUnmigratedFiles) && hostUnmigratedFiles.every(entry => Object.isFrozen(entry) &&
    Object.isFrozen(entry.destinations) && entry.destinations.length > 0 && entry.retiringUnit.length > 0 &&
    entry.destinations.every(name => hostModules.some(module => module.name === name)) &&
    originals.some(original => original.file === entry.file && original.blob === entry.referenceBlob)), true);
  const report = inspectHostMigration({ root, files: [...sources.keys()], complete: process.env.TSONIC_HOST_DONE === "1" });
  assert.deepEqual([...report.currentFiles, ...report.unmigrated.map(entry => entry.file)].sort(), [...sources.keys()].sort(),
    "every actual source or manifest has exactly one reported disposition before any gate iteration");
  assert.deepEqual(report.unmigrated.map(entry => entry.file), expected);
  for (const entry of report.unmigrated)
    context.diagnostic(`UNMIGRATED (${entry.retiringUnit}) ${entry.file} -> ${entry.destinations.join(", ")} [${entry.referenceBlob}]`);
  if (report.currentFiles.length === 0) {
    context.diagnostic("No current C1 implementation exists in this tree yet; fixture proof only, NOT Host Source acceptance.");
  } else {
    const findings = inspectHostStructure({ root, files: report.currentFiles,
      declarationFiles: report.currentFiles.filter(file => /\.d\.[cm]?ts$/u.test(file)) });
    assert.deepEqual(findings, [], findings.slice(0, 8).map(row => `${row.file}:${row.start}:${row.gate}`).join("\n"));
  }
});

test("migration disposition authenticates exact bytes and paths and never exempts a new port or modified plugin", () => {
  const file = "packages/host/src/plugins/discovery.ts";
  const entry = hostUnmigratedFiles.find(entry => entry.file === file);
  assert.equal(entry !== undefined, true, "the exact frozen plugin fixture owner precedes the assertions");
  const original = execFileSync("git", ["show", `${hostReferenceCommit}:${file}`], { encoding: "utf8" });
  fixture(new Map([[file, original]]), input => {
    const old = inspectHostMigration(input);
    assert.deepEqual(old.currentFiles, []);
    assert.deepEqual(old.unmigrated.map(entry => entry.file), [file]);
    assert.equal(Object.isFrozen(old) && Object.isFrozen(old.currentFiles) && Object.isFrozen(old.unmigrated), true);
    writeFileSync(resolve(input.root, file), `${original}\n`);
    const changed = inspectHostMigration(input);
    assert.deepEqual(changed.currentFiles, [file]);
    assert.deepEqual(changed.unmigrated, []);
    writeFileSync(resolve(input.root, file), "export const state = new Map();");
    const modified = inspectHostMigration(input);
    assert.deepEqual(modified.currentFiles, [file]);
    assert.deepEqual(modified.unmigrated, []);
    const findings = inspectHostStructure({ ...input, files: modified.currentFiles });
    assert.deepEqual(findings.map(row => row.gate), ["program-lifetime"],
      "the complete expected mutable-state finding proves modified old code really receives the current gates");
    writeFileSync(resolve(input.root, file), original);
    const port = "packages/host/src/plugins/contract.ts";
    writeFileSync(resolve(input.root, port), "export interface View { readonly values: number[]; }");
    const active = inspectHostMigration({ ...input, files: [file, port] });
    assert.deepEqual(active.currentFiles, [port, file].sort());
    assert.deepEqual(active.unmigrated, [], "a real module port brings its entire directory under the current model");
    const registration = "packages/host/src/plugins/register.ts";
    writeFileSync(resolve(input.root, registration), "export function register(): void {}");
    const registered = inspectHostMigration({ ...input, files: [file, registration] });
    assert.deepEqual(registered.currentFiles, [file, registration].sort());
    assert.deepEqual(registered.unmigrated, []);
    const fresh = "packages/host/src/plugins/new.ts";
    writeFileSync(resolve(input.root, fresh), "export const state = new Map();");
    const introduced = inspectHostMigration({ ...input, files: [fresh] });
    assert.deepEqual(introduced.currentFiles, [fresh]);
    assert.deepEqual(introduced.unmigrated, []);
    assert.deepEqual(inspectHostStructure({ ...input, files: introduced.currentFiles }).map(row => row.gate), ["program-lifetime"]);
    assert.throws(() => inspectHostMigration({ ...input, complete: true }), /empty unmigrated-file catalogue/u);
    assert.throws(() => inspectHostMigration({ ...input, files: [file, file] }), /complete distinct/u);
    assert.throws(() => inspectHostMigration({ ...input, files: undefined }), /complete distinct/u);
    assert.deepEqual(inspectHostMigration({ ...input, files: [] }), { currentFiles: [], unmigrated: [] });
    assert.throws(() => inspectHostMigration({ ...input, files: ["../foreign.ts"] }), /canonical/u);
    symlinkSync(resolve(input.root, file), resolve(input.root, "alias.ts"));
    assert.throws(() => inspectHostMigration({ ...input, files: ["alias.ts"] }), /original owned/u);
  });
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
    function pure(value: number): number { return value + 1; }
    const operations = Object.freeze({ pure });
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
  expect([["packages/host/src/publication/contract.ts", "export interface View { readonly seed: (() => void); }"]], ["read-only-publication"]);
  expect([["packages/host/src/publication/contract.ts", "export interface View { readonly programIdentity: string; value(): number; }"]], []);
  expect([["packages/host/src/publication/contract.ts", "export interface View { readonly values: Map<string, number>; }"]],
    ["contract-closure", "read-only-publication"]);
  expect([["packages/host/src/publication/contract.ts", "export interface View { readonly values: ReadonlyMap<string, number>; }"]], []);
});

test("readonly properties cannot expose mutable arrays, tuples or nested sequence elements", () => {
  const publication = "packages/host/src/publication/contract.ts";
  for (const type of ["number[]", "[number, string?]", "Array<number>", "globalThis.Array<number>",
    "Array<readonly number[]>", "ReadonlyArray<number[]>", "readonly [number[]]",
    "readonly (number[])[]", "readonly [...number[][]]"])
    expect([[publication, `export interface View { readonly values: ${type}; }`]],
      ["contract-closure", "read-only-publication"]);
  expect([[publication, "export interface View extends Array<number> {}"]], ["contract-closure", "read-only-publication"]);
  expect([[publication, "export interface View extends globalThis.Array<number> {}"]], ["contract-closure", "read-only-publication"]);
  expect([[publication, "export interface View { readonly nested: { values: number; }; }"]],
    ["contract-closure", "read-only-publication"]);
  expect([[publication, "export interface View { [index: number]: number; }"]], ["contract-closure", "read-only-publication"]);
  expect([[model, "export interface Facts { readonly values: number[]; }"]], ["contract-closure"]);
});

test("the same readonly closure follows imported, generic, inline, inherited and local aliases", () => {
  const publication = "packages/host/src/publication/contract.ts";
  const declarations = `
    export type Mutable = Array<number>;
    export type Indirect = Mutable;
    export interface Container { readonly values: Indirect; }
    export interface Wrapped<Value> { readonly value: Value; }
  `;
  for (const text of [
    'import type { Mutable } from "../model/contract.js"; export interface View { readonly values: Mutable; }',
    'import type { Container } from "../model/contract.js"; export interface View extends Container {}',
    'import type { Wrapped, Mutable } from "../model/contract.js"; export interface View { readonly values: Wrapped<Mutable>; }',
    'import type * as Data from "../model/contract.js"; export interface View { readonly values: Data.Indirect; }',
    'export interface View { readonly values: import("../model/contract.js").Mutable; }',
  ]) expect([[model, declarations], [publication, text]], ["contract-closure", "read-only-publication"]);
  expect([[publication, "export type Values = [number]; export type Indirect = Values; export interface View { readonly values: Indirect; }"]],
    ["contract-closure", "read-only-publication", "read-only-publication", "read-only-publication"]);
  expect([[model, "export interface Mutable { value: number; }"],
    [publication, 'import type { Mutable } from "../model/contract.js"; export interface View { readonly data: Mutable; }']],
  ["contract-closure", "read-only-publication"]);
});

test("deep readonly aliases, tuple repetitions, query methods and pure calculation signatures remain legitimate", () => {
  const declarations = `
    export type Values = readonly number[];
    export type Tuple = readonly [head: number, ...tail: string[]];
    export type Repeated = readonly [number, ...Array<string>];
    export interface Nested { readonly rows: ReadonlyArray<Values>; readonly tuple: Tuple; }
    export interface Indexed { readonly [index: number]: Nested; }
  `;
  expect([[model, declarations], ["packages/host/src/publication/contract.ts", `
    import type { Values, Tuple, Repeated, Nested, Indexed } from "../model/contract.js";
    export interface View {
      readonly values: Values; readonly tuple: Tuple; readonly repeated: Repeated;
      readonly nested: Nested; readonly indexed: Indexed;
      readonly mapping: ReadonlyMap<string, Values>;
      readonly 0: number; readonly "one": string; readonly ["two"]: boolean;
      read(key: string): ReadonlyArray<Nested>;
      readonly calculate: (values: Values, operation: (value: number) => number) => number;
    }
  `]], []);
  expect([[model, "export interface Array<Value> { readonly value: Value; } export interface Facts { readonly values: Array<number>; }"]], []);
});

test("mapped readonly removal and every setter use the same transitive mutable-data closure", () => {
  const publication = "packages/host/src/publication/contract.ts";
  for (const member of ["set value(next: number);", "get value(): number; set value(next: number);",
    'set ["value"](next: number);', "set 0(next: number);"])
    expect([[publication, `export interface View { ${member} }`]], ["contract-closure", "read-only-publication"]);
  for (const declarations of [
    'export type Writable = { -readonly [Key in "value"]: number };',
    'export interface Setter { set value(next: number); } export type Writable = Setter;',
    'export type Removing<Value> = { -readonly [Key in keyof Value]: Value[Key] }; export type Writable = Removing<{ readonly value: number }>;',
  ]) expect([[model, declarations],
    [publication, 'import type { Writable } from "../model/contract.js"; export interface View { readonly data: Writable; }']],
  ["contract-closure", "read-only-publication"]);
  expect([[publication, 'export type Writable = { -readonly [Key in "value"]: number }; export interface View { readonly data: Writable; }']],
    ["contract-closure", "read-only-publication", "read-only-publication"]);
  expect([[model, `
    export type Plain = { readonly [Key in "value"]: number };
    export type Explicit = { +readonly [Key in "value"]: number };
    export interface Getter { get value(): number; }
    export type GetterAlias = Getter;
  `], [publication, `
    import type { Plain, Explicit, GetterAlias } from "../model/contract.js";
    export interface View {
      readonly plain: Plain; readonly explicit: Explicit; readonly getter: GetterAlias;
      get value(): number;
      readonly ["-readonly"]: number;
      read(input: readonly number[]): readonly [number, ...string[]];
    }
  `]], []);
});

test("default mapped members are mutable unless the actual homomorphic input property is readonly", () => {
  const publication = "packages/host/src/publication/contract.ts";
  for (const declarations of [
    'export type Writable = { [Key in "value"]: number };',
    'export type Keys = "value"; export type Writable = { [Key in Keys]: number };',
    'export type Mapped<Keys extends string> = { [Key in Keys]: number }; export type Writable = Mapped<"value">;',
    'export type Copy<Value> = { [Key in keyof Value]: Value[Key] }; export type Writable = Copy<{ value: number }>;',
    'export type Copy<Value> = { [Key in keyof Value]: Value[Key] }; export type Alias<Value> = Copy<Value>; export type Writable = Alias<{ readonly left: number; right: number }>;',
    'export type Copy<Value> = { [Key in keyof Value]: Value[Key] }; export type Writable = Copy<{ [key: string]: number }>;',
  ]) expect([[model, declarations],
    [publication, 'import type { Writable } from "../model/contract.js"; export interface View { readonly data: Writable; }']],
  ["contract-closure", "read-only-publication"]);
  expect([[publication, 'export interface View { readonly data: { [Key in "value"]: number }; }']],
    ["contract-closure", "read-only-publication"]);
  expect([[model, 'export type Writable = { [Key in keyof { readonly left: number; right: number }]: number };'],
    [publication, 'import type { Writable } from "../model/contract.js"; export interface View { readonly data: Writable; }']],
  ["contract-closure", "contract-closure", "read-only-publication"]);
});

test("mapped readonly inheritance uses actual aliased and generic inputs without removing producer authority", () => {
  const publication = "packages/host/src/publication/contract.ts";
  const declarations = `
    export type Copy<Value> = { [Key in keyof Value]: Value[Key] };
    export type Keys<Value> = keyof Value;
    export type ThroughKeys<Value> = { [Key in Keys<Value>]: Value[Key] };
    export type Parenthesized<Value> = { [Key in (keyof Value)]: Value[Key] };
    export type Readonly<Value> = { readonly [Key in keyof Value]: Value[Key] };
    export type Partial<Value> = { [Key in keyof Value]?: Value[Key] };
    export interface Input { readonly value: number; readonly label: string; }
    export type InputAlias = Input;
    export type Inherited = Copy<InputAlias>;
    export type KeyAliasInherited = ThroughKeys<InputAlias>;
    export type Concrete = { [Key in keyof InputAlias]: InputAlias[Key] };
    export type ReadonlyInput = Readonly<{ value: number; label: string }>;
    export type PartialReadonly = Partial<Readonly<{ value: number; label: string }>>;
    export type Generic<Value> = Copy<Readonly<Value>>;
    export type Applied = Generic<{ value: number }>;
    export type ReadonlyTuple = Readonly<[number, string]>;
    export type ReadonlyIndex = Readonly<{ [key: string]: number }>;
    export type Query = Copy<{ read(): number }>;
    export interface Shared { readonly value: number; }
    export interface Recursive { readonly next?: Recursive; readonly first: Shared; readonly second: Shared; }
    export type RecursiveCopy = Copy<Recursive>;
    export type UnionCopy = Copy<InputAlias | { readonly other: boolean }>;
    export type ParenthesizedCopy = Parenthesized<InputAlias>;
  `;
  expect([[model, declarations], [publication, `
    import type { Inherited, KeyAliasInherited, Concrete, ReadonlyInput, PartialReadonly, Applied, ReadonlyTuple,
      ReadonlyIndex, Query, RecursiveCopy, UnionCopy, ParenthesizedCopy } from "../model/contract.js";
    export interface View {
      readonly inherited: Inherited; readonly keyAlias: KeyAliasInherited; readonly concrete: Concrete; readonly plain: ReadonlyInput;
      readonly partial: PartialReadonly; readonly applied: Applied; readonly tuple: ReadonlyTuple;
      readonly index: ReadonlyIndex; readonly query: Query; readonly recursive: RecursiveCopy;
      readonly union: UnionCopy; readonly parenthesized: ParenthesizedCopy;
    }
  `]], []);
  expect([[model, declarations], [publication, `
    import type { Copy, Readonly, Partial } from "../model/contract.js";
    export interface View {
      readonly inherited: Copy<({ readonly value: number })>;
      readonly plain: Readonly<{ value: number }>;
      readonly partial: Partial<Readonly<{ value: number }>>;
    }
  `]], []);
  expect([[model, `
    export type Readonly<Value> = { readonly [Key in keyof Value]: Value[Key] };
    export interface Authority { seed(value: number): void; }
  `], [publication, `
    import type { Readonly, Authority } from "../model/contract.js";
    export interface View { readonly authority: Readonly<Authority>; }
  `]], ["read-only-publication"]);
  expect([[model, declarations], [publication, `
    import type { Readonly } from "../model/contract.js";
    export interface View { readonly data: Readonly<Map<string, number>>; }
  `]], ["contract-closure", "read-only-publication"]);
  for (const value of ["{ readonly child: { value: number } }", "{ readonly values: number[] }"])
    fixture(new Map([[model, declarations], [publication, `
      import type { Readonly } from "../model/contract.js";
      export interface View { readonly data: Readonly<${value}>; }
    `]]), input => {
      const rows = inspectHostStructure(input);
      assert.deepEqual([...new Set(rows.map(row => row.gate))].sort(), ["contract-closure", "read-only-publication"],
        "a shallow mapped readonly modifier cannot erase a nested writable member or sequence");
      assert.equal(rows.every(row => row.file === publication), true);
    });
});

test("ordinary generic unknown and object constraints are type bounds rather than opaque contract payloads", () => {
  expect([[model, `
    export interface UnknownBound<Value extends unknown> { readonly value: Value; }
    export interface ObjectBound<Value extends object> { readonly value: Value; }
    export type UnknownAlias<Value extends unknown> = { readonly value: Value };
    export type ObjectAlias<Value extends object> = { readonly value: Value };
  `]], []);
  expect([[model, "export interface Opaque { readonly value: unknown; readonly object: object; }"]],
    ["contract-closure", "contract-closure"]);
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

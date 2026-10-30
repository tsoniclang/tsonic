import assert from "node:assert/strict";

import test from "node:test";

import { type Node } from "@tsonic/tsts";

import { analyzeSourcePropertyNames } from "../public/source.js";

import { targetSourceSyntaxProgram } from "../target-analysis/source-syntax.js";

import { checked } from "./property-names.split-fixtures.js";

test("already checked literal aliases retain exact keys without an alias-length restriction", () => {
  const aliases = Array.from({ length: 12 }, (_, index) =>
    `const text${index} = ${index === 0 ? '"value"' : `text${index - 1}`};
const numeric${index} = ${index === 0 ? "9007199254740993" : `numeric${index - 1}`};
const selected${index} = ${index === 0 ? "Key.Wide" : `selected${index - 1}`};`).join("\n");
  const source = checked(`enum Key { Wide = 9007199254740993 }
${aliases}
export const text = { [text11]: 1 };
export const numeric: Record<number, string> = { [numeric11]: "numeric" };
export const selected: Record<number, string> = { [selected11]: "enum" };`);
  const index = source.semantics.forFile(source.navigation.sourceFiles[0]!).propertyNames;
  assert.equal(index.issues.length, 0, "already typed aliases retain native indexed and named contracts");
  assert.equal(index.entries.length, 3, "each actual computed occurrence has one selection");
  assert.equal(index.entries[0]?.selection.kind === "resolved" && index.entries[0].selection.name === "value", true,
    "the checked string literal is not reconstructed by a new runtime field path");
  for (const entry of index.entries.slice(1)) {
    assert.equal(entry.selection.kind === "resolved" && (entry.selection.constant.kind === "numeric"
      ? entry.selection.constant.token.coefficient === 9007199254740993n
      : entry.selection.constant.kind === "enum-member" && entry.selection.constant.entry.value === 9007199254740993n), true,
    "the native integer is not replaced by its rounded checked member spelling");
  }
});

test("long checked alias chains cannot hide a forged native property-key assertion", () => {
  const aliases = Array.from({ length: 12 }, (_, index) =>
    `const alias${index} = ${index === 0 ? "(5 as unknown as 7)" : `alias${index - 1}`};`).join("\n");
  const source = checked(`${aliases}\nexport const result = { [alias11]: 1 };`);
  const index = source.semantics.forFile(source.navigation.sourceFiles[0]!).propertyNames;
  assert.equal(index.entries.length, 1, "one original computed property occurrence");
  assert.equal(index.issues.length, 1, "checked literal7 cannot replace the actual native operand5");
  assert.equal(index.entries[0]?.selection.kind, "rejected", "real assertion validation remains required at its owner");
});

test("numeric index admission uses checked key types independently of the stored value type", () => {
  const source = checked(`
enum Key { Wide = 9007199254740993 }
export const text: Record<number, string> = { 9007199254740993: "value" };
export const numeric: Record<number, number> = { 9007199254740993: 7 };
export const selected: Record<number, string> = { [Key.Wide]: "enum" };
`);
  const index = source.semantics.forFile(source.navigation.sourceFiles[0]!).propertyNames;
  assert.equal(index.entries.length, 3, "all three real indexed contexts retain their exact keys");
  assert.equal(index.issues.length, 0, "a string value cannot turn a proven numeric index into a named member");
  for (const [position, entry] of index.entries.entries()) {
    assert.equal(entry.selection.kind, "resolved", `indexed key ${position} is admitted`);
    assert.equal(entry.selection.kind === "resolved" ? entry.selection.name : undefined, "9007199254740992",
      `indexed key ${position} retains the single checked spelling separately from its native scalar`);
    assert.equal(entry.selection.kind === "resolved" && (entry.selection.constant.kind === "numeric"
      ? entry.selection.constant.token.coefficient === 9007199254740993n
      : entry.selection.constant.kind === "enum-member" && entry.selection.constant.entry.value === 9007199254740993n), true,
    `indexed key ${position} retains its exact native scalar without a Number round-trip`);
  }
});

test("erased unique-symbol contracts retain checked symbolic evidence without inventing native fields", () => {
  const source = checked(`
declare const storage: unique symbol;
interface Stored<Value> { readonly [storage]: Value; }
type Storage<Value> = Value extends Stored<infer Inner> ? Inner : Value;
export function read(value: Storage<number>): number { return value; }
`);
  const semantics = source.semantics.forFile(source.navigation.sourceFiles[0]!);
  const entry = semantics.propertyNames.entries[0]!;
  const checkedName = semantics.operations.propertyName(entry.node);
  assert.equal(semantics.propertyNames.issues.length, 0, "a checked phantom type key has no native storage obligation");
  assert.equal(entry.selection.kind === "unique-symbol" && entry.selection.type === checkedName?.type, true,
    "the source-only contract retains its actual unique checked type, not a fake string or well-known symbol");
  assert.equal(Object.isFrozen(entry.selection), true, "the identity selection is immutable");
});

test("runtime unique-symbol fields remain precisely refused without a native storage representation", () => {
  const source = checked(`
declare const storage: unique symbol;
export class Holder { [storage]: number = 1; }
`);
  const index = source.semantics.forFile(source.navigation.sourceFiles[0]!).propertyNames;
  assert.equal(index.issues.length, 1, "a runtime field still needs supported native member identity");
  assert.equal(index.entries[0]!.selection.kind, "rejected", "source-only symbolic evidence cannot admit emitted storage");
  assert.equal(index.issues[0]!.reason.includes("exact string or numeric literal"), true, "the actual key owner refuses precisely");
});

test("signed bound member identities refuse while completed object and binding zero identities agree", () => {
  const source = checked(`
class Holder { [+1] = 1; [-0] = 2; }
interface Contract { [+1]: number; [-0]: number; }
type Shape = { [+1]: number; [-0]: number; };
const object = { [-0]: 3 };
const { [-0]: value } = object;
`);
  const index = source.semantics.forFile(source.navigation.sourceFiles[0]!).propertyNames;
  assert.equal(index.entries.length, 8, "all checked member, object and binding names participate");
  assert.equal(index.issues.length, 6, "each actual signed bound-member disagreement is explicit");
  for (const [position, entry] of index.entries.entries()) {
    assert.equal(entry.selection.kind, position < 6 ? "rejected" : "resolved", `name ${position} follows actual checked identity`);
    if (position < 6) assert.equal(entry.selection.kind === "rejected" &&
      entry.selection.reason.includes(position % 2 === 0 ? 'checker key +1' : 'checker key -0'), true,
    `bound name ${position} reports its actual symbol identity`);
    else assert.equal(entry.selection.kind === "resolved" ? entry.selection.name : undefined, "0",
      `object/binding name ${position} agrees on canonical zero`);
  }
});

test("non-authored checked element arguments do not acquire generic static-key refusals", () => {
  const source = checked(`
enum Key { A = 1 }
declare const pair: { 1: number };
declare const record: Record<Key, number>;
export function read(key: Key.A): number { let index: 1 = 1; return pair[index] + record[key]; }
`);
  const index = source.semantics.forFile(source.navigation.sourceFiles[0]!).propertyNames;
  assert.equal(index.issues.length, 0, "literal-typed mutable variables and enum parameters need no authored key token");
});

test("computed literal, const-literal and enum names have one exact shared classification", () => {
  const source = checked(`
const textKey = "value";
const numberKey = 16;
enum Key { Text = "entry", Number = 17 }
export const result = [
  { ["literal"]: 1 },
  { [0x10]: 2 },
  { [textKey]: 3 },
  { [numberKey]: 4 },
  { [Key.Text]: 5 },
  { [Key.Number]: 6 },
  { [((textKey))]: 7 },
  { [-1]: 8 },
  { [-0]: 9 },
  { [9007199254740994]: 10 },
];
`);
  const file = source.navigation.sourceFiles[0]!;
  const index = source.semantics.forFile(file).propertyNames;
  assert.equal(index.entries.length, 10, "all exact computed occurrences have evidence");
  assert.equal(index.issues.length, 0, "admitted keys produce no issue");
  assert.deepEqual(index.entries.map(entry => entry.selection.kind === "resolved" ? entry.selection.name : "not-a-field"),
    ["literal", "16", "value", "16", "entry", "17", "value", "-1", "0", "9007199254740994"]);
  for (const entry of index.entries) {
    assert.equal(index.get(entry.node) === entry.selection, true, "one immutable selection per occurrence");
    assert.equal(Object.isFrozen(entry.selection), true, "selection is immutable");
  }
  assert.equal(Object.isFrozen(index), true, "index is immutable");
  assert.equal(Object.isFrozen(index.entries), true, "entry sequence is immutable");
  assert.equal(Object.isFrozen(index.issues), true, "issue sequence is immutable");
});

test("imported const literal keys use checked declaration identity", () => {
  const source = checked(`
import { key as imported } from "./key.js";
export const result = { [imported]: 1 };
`, { "/src/key.ts": 'export const key = "imported";' });
  const file = source.navigation.sourceFiles.find(candidate => source.ast.getFileName(candidate) === "/src/index.ts")!;
  const index = source.semantics.forFile(file).propertyNames;
  assert.equal(index.entries.length, 1, "one imported computed key");
  const selected = index.entries[0]!.selection;
  assert.equal(selected.kind, "resolved", "import resolves to its exact const declaration");
  assert.equal(selected.kind === "resolved" ? selected.name : undefined, "imported", "selected imported literal value");
});

test("authored integer, const and enum field keys refuse disagreeing checker identities", () => {
  const source = checked(`
const constant = 9007199254740995;
enum Key { Exact = 9007199254740997, Following }
export const direct = { [9007199254740993]: 1 };
export const indirect = { [constant]: 2 };
export const selected = { [Key.Exact]: 3 };
export const following = { [Key.Following]: 4 };
export const negative = { [-9007199254740993]: 5 };
`);
  const index = source.semantics.forFile(source.navigation.sourceFiles[0]!).propertyNames;
  assert.equal(index.issues.length, 5, "every conflicting numeric named identity is refused, not rounded");
  assert.deepEqual(index.entries.map(entry => entry.selection.kind === "resolved" ? entry.selection.name : "not-a-field"),
    ["not-a-field", "not-a-field", "not-a-field", "not-a-field", "not-a-field"]);
  assert.equal(index.issues.every(issue => issue.reason.includes("checker")), true, "R1 and R2 name the conflicting source authority");
});

test("numeric const return contracts and generic literal inputs retain their authored key evidence", () => {
  const source = checked(`
type Key = 9007199254740993;
function authored(): Key { return 9007199254740993; }
function identity<T>(value: T): T { return value; }
const returned = authored();
const inferred = identity(9007199254740995);
export const first = { [returned]: 1 };
export const second = { [inferred]: 2 };
`);
  const index = source.semantics.forFile(source.navigation.sourceFiles[0]!).propertyNames;
  assert.equal(index.issues.length, 2, "lossless source provenance does not erase a conflicting named identity");
  assert.deepEqual(index.entries.map(entry => entry.selection.kind === "resolved" ? entry.selection.name : "not-a-field"),
    ["not-a-field", "not-a-field"]);
});

test("dynamic and effectful keys reject even when a call or getter has a literal return type", () => {
  const source = checked(`
let mutable: "value" = "value";
function key(): "value" { return "value"; }
const holder = { get name(): "value" { return "value"; } };
export function make(dynamic: string, choice: "left" | "right") {
  return [{ [dynamic]: 1 }, { [mutable]: 2 }, { [key()]: 3 }, { [holder.name]: 4 }, { [choice]: 5 }];
}
`);
  const index = source.semantics.forFile(source.navigation.sourceFiles[0]!).propertyNames;
  const computed = index.entries.filter(entry => source.ast.is.IsComputedPropertyName(entry.node));
  assert.equal(computed.length, 5, "all dynamic occurrences are classified");
  assert.equal(index.issues.length, 5, "each unrepresentable field has one issue");
  for (const entry of computed) assert.equal(entry.selection.kind, "rejected", "no hidden dynamic emulation");
});

test("a const literal-valued initializer is never executed during property-name analysis", () => {
  const source = checked(`
function key(): "value" { throw new Error("must not be executed by the compiler"); }
const constant = key();
export const result = { [constant]: 1 };
`);
  const index = source.semantics.forFile(source.navigation.sourceFiles[0]!).propertyNames;
  assert.equal(index.issues.length, 0, "checked const literal type is sufficient without execution");
  const selected = index.entries[0]!.selection;
  assert.equal(selected.kind === "resolved" ? selected.name : undefined, "value", "const value has one exact field name");
});

test("selected well-known symbol names keep their existing native protocol", () => {
  const source = checked("export const result = { [Symbol.iterator]() { return [1][Symbol.iterator](); } };");
  const index = source.semantics.forFile(source.navigation.sourceFiles[0]!).propertyNames;
  assert.equal(index.entries.length, 1, "one well-known-symbol name");
  assert.equal(index.issues.length, 0, "existing well-known symbol remains admitted");
  const selected = index.entries[0]!.selection;
  assert.equal(selected.kind, "well-known-symbol", "symbol is not converted into a string key");
  assert.equal(selected.kind === "well-known-symbol" ? selected.symbol : undefined, "iterator", "exact checked symbol identity");
});

test("published property-name reads and source-syntax snapshots cannot rerun the selector", () => {
  const source = checked('const key = "value"; export const result = { [key]: 1 };');
  const file = source.navigation.sourceFiles[0]!;
  const semantics = source.semantics.forFile(file);
  let sealed = false;
  let reads = 0;
  const index = analyzeSourcePropertyNames(source.ast, file, {
    operations: semantics.operations,
    declarations: semantics.declarations,
    types: { ...semantics.types, expressionType(node: Node) {
      assert.equal(sealed, false, "a sealed lookup cannot read the checker");
      reads += 1;
      return semantics.types.expressionType(node);
    } },
  }, source.navigation, source.semantics.enumConstants);
  sealed = true;
  const entry = index.entries[0]!;
  assert.equal(reads, 1, "one source literal type selection");
  for (let indexOfRead = 0; indexOfRead < 10; indexOfRead += 1) {
    assert.equal(index.get(entry.node) === entry.selection, true, "published reader is a stable pure lookup");
  }
  assert.equal(reads, 1, "published reads performed no extra selection");
  const syntax = targetSourceSyntaxProgram(source);
  const original = semantics.propertyNames.entries[0]!;
  assert.equal(syntax.propertyNames.get(original.node) === original.selection, true, "backend consumes the identical admitted evidence");
});

test("missing raw property declarations refuse keys without reentering file construction", () => {
  const source = checked(`
interface Values { count: number; }
declare function hasExtra(value: unknown): value is { count: number; extra: boolean; };
export function make(value: number | Values) {
  if (typeof value === "number") return {};
  if (hasExtra(value)) return { [value.count]: 1 };
  return {};
}
`);
  const index = source.semantics.forFile(source.navigation.sourceFiles[0]!).propertyNames;
  const computed = index.entries.filter(entry => source.ast.is.IsComputedPropertyName(entry.node));
  assert.equal(computed.length, 1, "the raw ambiguous property is visited once");
  assert.equal(index.issues.length, 1, "a non-static property key is refused before target analysis");
  assert.equal(computed[0]!.selection.kind, "rejected", "refinement is not a property-key construction dependency");
});

test("unique-symbol types never erase call or getter key effects", () => {
  const source = checked(`
function key(): typeof Symbol.iterator { return Symbol.iterator; }
const holder = { get name(): typeof Symbol.iterator { return Symbol.iterator; } };
const alias: typeof Symbol.iterator = Symbol.iterator;
export const direct = { [Symbol.iterator]() { return [1][Symbol.iterator](); } };
export const indirect = { [alias]() { return [1][Symbol.iterator](); } };
export const call = { [key()]() { return [1][Symbol.iterator](); } };
export const getter = { [holder.name]() { return [1][Symbol.iterator](); } };
`);
  const index = source.semantics.forFile(source.navigation.sourceFiles[0]!).propertyNames;
  const computed = index.entries.filter(entry => source.ast.is.IsComputedPropertyName(entry.node));
  assert.equal(computed.length, 4, "all unique-symbol key expressions are classified");
  assert.equal(index.issues.length, 2, "only effectful symbol key expressions are rejected");
  assert.deepEqual(computed.map(entry => entry.selection.kind),
    ["well-known-symbol", "well-known-symbol", "rejected", "rejected"]);
});

test("const destructured singleton bindings preserve their exact checked origin", () => {
  const source = checked(`
const { key: objectKey, nested: { key: nestedKey } } = { key: "object", nested: { key: "nested" } } as const;
const [arrayKey, integerKey] = ["array", 9007199254740993] as const;
const { number: objectInteger } = { number: 9007199254740995 } as const;
let { key: mutable } = { key: "mutable" } as const;
export const object = { [objectKey]: 1 };
export const nested = { [nestedKey]: 2 };
export const array = { [arrayKey]: 3 };
export const integer = { [integerKey]: 4 };
export const other = { [objectInteger]: 5 };
export const rejected = { [mutable]: 6 };
`);
  const index = source.semantics.forFile(source.navigation.sourceFiles[0]!).propertyNames;
  const computed = index.entries.filter(entry => source.ast.is.IsComputedPropertyName(entry.node));
  assert.equal(computed.length, 6, "every const and mutable destructured binding has a classification");
  assert.equal(index.issues.length, 3, "mutable bindings and the two disagreeing numeric named identities are refused");
  assert.deepEqual(computed.map(entry => entry.selection.kind === "resolved" ? entry.selection.name : entry.selection.kind),
    ["object", "nested", "array", "rejected", "rejected", "rejected"]);
});

test("type-only singleton names do not acquire runtime key evaluation requirements", () => {
  const source = checked(`
export type Factory = (key: "value") => { [key]: number };
export type NumericFactory = (key: 9007199254740993) => { [key]: number };
enum Key { Text = "entry" }
export interface EnumField { [Key.Text]: number; }
export function answer(): number { return 42; }
`);
  const index = source.semantics.forFile(source.navigation.sourceFiles[0]!).propertyNames;
  assert.equal(index.issues.length, 1, "an erased numeric field still requires the same checked member identity");
  assert.deepEqual(index.entries.map(entry => entry.selection.kind === "resolved" ? entry.selection.name : entry.selection.kind),
    ["value", "rejected", "entry"]);
});

test("erased assertions preserve literal key evidence without disguising a dynamic expression", () => {
  const source = checked(`
const key = "value";
export const literal = { ["literal" as const]: 1 };
export const numeric = { [9007199254740993 as const]: 2 };
export const reference = { [key!]: 3 };
export function dynamic(key: string) { return { [key as "value"]: 4 }; }
`);
  const index = source.semantics.forFile(source.navigation.sourceFiles[0]!).propertyNames;
  assert.equal(index.issues.length, 2, "neither an assertion nor a conflicting numeric identity can define a static key");
  assert.deepEqual(index.entries.map(entry => entry.selection.kind === "resolved" ? entry.selection.name : entry.selection.kind),
    ["literal", "rejected", "value", "rejected"]);
});

test("source syntax snapshots retain checked declaration-file keys without target-side recomputation", () => {
  const source = checked('import type { External } from "./external.js"; export function read(value: External): number { return value.value; }', {
    "/src/external.d.ts": 'export interface External { ["value"]: number; }',
  });
  const file = source.sourceFiles.find(candidate => source.ast.getFileName(candidate) === "/src/external.d.ts");
  assert.equal(file !== undefined, true, "the checked declaration file belongs to the snapshot domain");
  const entry = source.semantics.forFile(file!).propertyNames.entries[0]!;
  assert.equal(source.navigation.sourceFiles.includes(file!), false, "project navigation excludes declaration files");
  const syntax = targetSourceSyntaxProgram(source);
  assert.equal(syntax.propertyNames.get(entry.node) === entry.selection, true, "declaration-file selections survive the data-only handoff");
});

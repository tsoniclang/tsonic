import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics, type Node } from "@tsonic/tsts";
import { analyzeSourcePropertyNames, createTargetSourceProgram } from "../public/source.js";
import { targetSourceSyntaxProgram } from "../target-analysis/source-syntax.js";

function checked(sourceText: string, files: Readonly<Record<string, string>> = {}) {
  const source = createCompilerSessionFromFiles({
    currentDirectory: "/src",
    files: { "/src/index.ts": sourceText, ...files },
    compilerOptions: { strict: true, target: "es2022", module: "esnext", moduleResolution: "bundler" },
  }).checkSource();
  assert.equal(source.diagnostics.length, 0, formatDiagnostics(source.diagnostics.filter(diagnostic => diagnostic !== undefined)));
  return createTargetSourceProgram(source);
}

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

test("const array origins follow checked tuple spread positions without rounding", () => {
  const source = checked(`
const prefix = [1, 9007199254740993] as const;
const [first, second, third] = [...prefix, 3] as const;
const repeated = [...prefix, ...prefix] as const;
const [, , fourth, fifth] = repeated;
export const values = [{ [first]: 1 }, { [second]: 2 }, { [third]: 3 }, { [fourth]: 4 }, { [fifth]: 5 }];
`);
  const index = source.semantics.forFile(source.navigation.sourceFiles[0]!).propertyNames;
  assert.equal(index.issues.length, 2, "fixed tuple spreads retain the exact conflicting numeric origins for refusal");
  assert.deepEqual(index.entries.map(entry => entry.selection.kind === "resolved" ? entry.selection.name : entry.selection.kind),
    ["1", "rejected", "3", "1", "rejected"]);
});

test("declared fixed tuples retain their exact literal type origins", () => {
  const source = checked(`
declare const declared: readonly [first: 9007199254740993, second: 9007199254740995];
const [first, second, after] = [...declared, 3] as const;
export const values = [{ [first]: 1 }, { [second]: 2 }, { [after]: 3 }];
`);
  const index = source.semantics.forFile(source.navigation.sourceFiles[0]!).propertyNames;
  assert.equal(index.issues.length, 2, "declared tuple contracts do not substitute a rounded named identity");
  assert.deepEqual(index.entries.map(entry => entry.selection.kind === "resolved" ? entry.selection.name : entry.selection.kind),
    ["rejected", "rejected", "3"]);
});

test("assertions cannot change the actual exact native property key", () => {
  const source = checked(`
const numeric = 5 as unknown as 7;
const text = "a" as unknown as "b";
const large = 9007199254740993 as unknown as 9007199254740992;
export const numericValue = { [numeric]: 1 };
export const textValue = { [text]: 2 };
export const largeValue = { [large]: 3 };
export const directText = { ["a" as unknown as "b"]: 4 };
export const directNumeric = { [5 as unknown as 7]: 5 };
export const exact = { [9007199254740993 as 9007199254740993]: 6 };
`);
  const index = source.semantics.forFile(source.navigation.sourceFiles[0]!).propertyNames;
  assert.equal(index.issues.length, 6, "conflicting contracts and exact/checker named identities are separately refused");
  assert.equal(index.entries.slice(0, 5).every(entry => entry.selection.kind === "rejected"), true,
    "neither checked rounding nor erased syntax can alter the actual key");
  const exact = index.entries[5]!.selection;
  assert.equal(exact.kind === "rejected" && exact.reason.includes("checker key 9007199254740992"), true,
    "an exact assertion cannot change the checker's rounded member identity");
});

test("nonfinite numeric keys and ambient unknown enum constants get precise distinct refusals", () => {
  const source = checked(`
declare enum Unknown { First, Second }
export const first = { [1e999]: 1 };
export const second = { [Unknown.First]: 2 };
export const third = { [Unknown.Second]: 3 };
`);
  const index = source.semantics.forFile(source.navigation.sourceFiles[0]!).propertyNames;
  assert.equal(index.issues.length, 3, "every unproven native constant is refused");
  assert.equal(index.issues[0]!.reason.includes("finite native literal bounds"), true, "overflow reason names the native finite bound");
  assert.equal(index.issues.slice(1).every(issue => issue.reason.includes("enum member has no exact compile-time constant")), true,
    "ambient members are not assigned invented ordinals");
});

test("computed and numeric binding names consume the same shared key selections", () => {
  const source = checked(`
const key = 9007199254740993;
const source = { [key]: 1, 16: 2 };
const { [key]: first, 0x10: second } = source;
export const total = first + second;
`);
  const index = source.semantics.forFile(source.navigation.sourceFiles[0]!).propertyNames;
  assert.equal(index.issues.length, 2, "object and binding names both refuse the same conflicting numeric identity");
  assert.deepEqual(index.entries.map(entry => entry.selection.kind === "resolved" ? entry.selection.name : entry.selection.kind),
    ["rejected", "16", "rejected", "16"]);
});

test("native key consumers receive immutable lossless scalar data without fabricated literal provenance", () => {
  const source = checked(`
enum Key { Entry = 9007199254740994 }
export const value = { ["text"]: 1, [1.250]: 2, [Key.Entry]: 3 };
`);
  const entries = source.semantics.forFile(source.navigation.sourceFiles[0]!).propertyNames.entries;
  const text = entries[0]!.selection;
  const numeric = entries[1]!.selection;
  const member = entries[2]!.selection;
  assert.equal(text.kind === "resolved" && text.constant.kind === "string" && text.constant.value === "text", true,
    "a decoded string key carries its existing scalar value");
  assert.equal(numeric.kind === "resolved" && numeric.constant.kind === "numeric" && numeric.constant.token.decimalText === "1.250", true,
    "an authored numeric key retains its exact token, including scale");
  assert.equal(member.kind === "resolved" && member.constant.kind === "enum-member" &&
    member.constant.entry === source.semantics.enumConstants.entries[0], true, "an enum key carries the identical shared entry");
  assert.equal(entries.every(item => item.selection.kind !== "resolved" || Object.isFrozen(item.selection.constant)), true,
    "the scalar transport is immutable");
});

test("ordinary and computed property names share one complete immutable scalar index", () => {
  const source = checked(`
const local = 1;
export const value = { ordinary: 1, "decoded-name": 2, 16: 3, ["computed"]: 4, local };
const { ordinary: binding, "decoded-name": other } = value;
export function unrelated(parameter: number): number { return parameter + binding + other; }
`);
  const index = source.semantics.forFile(source.navigation.sourceFiles[0]!).propertyNames;
  assert.equal(index.entries.length, 7, "five authored properties and two object-binding keys are indexed");
  assert.deepEqual(index.entries.map(entry => entry.selection.kind === "resolved" ? entry.selection.name : entry.selection.kind),
    ["ordinary", "decoded-name", "16", "computed", "local", "ordinary", "decoded-name"]);
  assert.equal(index.issues.length, 0, "ordinary keys introduce no source rejection");
  const syntax = targetSourceSyntaxProgram(source);
  for (const entry of index.entries) {
    assert.equal(index.get(entry.node) === entry.selection, true, "each occurrence has exactly one canonical scalar selection");
    assert.equal(syntax.propertyNames.get(entry.node) === entry.selection, true, "ordinary names use the same sealed transport");
    assert.equal(entry.selection.kind === "resolved" && Object.isFrozen(entry.selection.constant), true,
      "all native key consumers receive immutable source-owned scalar data");
  }
});

test("const bindings cannot hide a broad runtime key behind literal assertions", () => {
  const source = checked(`
declare function broad(): string;
declare function exact(): "value";
export function make(input: string) {
  const asserted = input as "value";
  const indirect = broad() as "value";
  const hidden = input as unknown as "value";
  const retained = exact() as "value";
  return [{ [asserted]: 1 }, { [indirect]: 2 }, { [hidden]: 3 }, { [retained]: 4 }];
}
`);
  const index = source.semantics.forFile(source.navigation.sourceFiles[0]!).propertyNames;
  const computed = index.entries.filter(entry => source.ast.is.IsComputedPropertyName(entry.node));
  assert.equal(index.issues.length, 3, "each disguised broad runtime key receives a precise source refusal");
  assert.deepEqual(computed.map(entry => entry.selection.kind), ["rejected", "rejected", "rejected", "resolved"]);
  assert.equal(index.issues.every(issue => issue.reason.includes("unproven runtime value")), true,
    "an erased assertion is not native key-value evidence");
  const retained = computed[3]!.selection;
  assert.equal(retained.kind === "resolved" ? retained.name : undefined, "value", "an actual checked singleton return contract is retained");
});

test("numeric named identities use one exact spelling predicate, not an integer representability cap", () => {
  for (const [key, name] of [
    ["9007199254740992", "9007199254740992"],
    ["9007199254740994", "9007199254740994"],
    ["1152921504606847000", "1152921504606847000"],
    ["0.1", "0.1"], ["1e21", "1e+21"], ["-0", "0"],
    ["0x3635c9adc5dea00000", "1e+21"],
  ]) {
    const source = checked(`export const value = { [${key}]: 1 };`);
    const index = source.semantics.forFile(source.navigation.sourceFiles[0]!).propertyNames;
    assert.equal(index.issues.length, 0, `${key} has the same exact and checked name`);
    const entry = index.entries[0]!.selection;
    assert.equal(entry.kind === "resolved" ? entry.name : undefined, name, `${key} uses the canonical checked spelling`);
  }
  for (const key of ["9007199254740993", "-9007199254740993", "1152921504606846976", "18446744073709551616", "1.0000000000000001", "1e-400"]) {
    const source = checked(`export const value = { [${key}]: 1 };`);
    const entry = source.semantics.forFile(source.navigation.sourceFiles[0]!).propertyNames.entries[0]!.selection;
    assert.equal(entry.kind === "rejected" && entry.reason.includes("checker key") && entry.reason.includes("exact string key"), true,
      `${key} is refused precisely even when its binary integer is representable`);
  }
});

test("numeric member-selecting element accesses refuse rounded keys without changing tuple or dictionary access", () => {
  const source = checked(`
declare const pair: { 9007199254740992: number };
declare const dictionary: { [key: number]: number };
declare const tuple: readonly [number];
export const refused = pair[9007199254740993];
export const exact = pair[9007199254740992];
export const dynamic = dictionary[9007199254740993];
export const ordinal = tuple[0];
`);
  const index = source.semantics.forFile(source.navigation.sourceFiles[0]!).propertyNames;
  assert.equal(index.issues.length, 1, "only the rounded named-member access adds a refusal entry");
  const issue = index.issues[0]!;
  assert.equal(source.ast.is.IsNumericLiteral(issue.node), true, "the issue points to the actual key argument");
  assert.equal(issue.reason.includes("9007199254740993") && issue.reason.includes("9007199254740992"), true,
    "the diagnostic preserves both disagreeing identities");
});

test("only proven numeric index signatures preserve exact native key tokens without named-identity admission", () => {
  const source = checked(`
const key = 9007199254740993;
export const ordinary: { [key: number]: number } = { 9007199254740993: 1 };
export const computed: Record<number, number> = { [key]: 2 };
export const named: { 9007199254740992: number; [key: number]: number } = { [key]: 3 };
export const inferred = { [key]: 4 };
`);
  const index = source.semantics.forFile(source.navigation.sourceFiles[0]!).propertyNames;
  const properties = index.entries.filter(entry => source.ast.is.IsPropertyAssignment(source.ast.parent(entry.node)));
  assert.equal(properties.length, 4, "all four object key contexts are checked");
  assert.deepEqual(properties.map(entry => entry.selection.kind), ["resolved", "resolved", "rejected", "rejected"]);
  for (const entry of properties.slice(0, 2)) {
    const selected = entry.selection;
    assert.equal(selected.kind === "resolved" && selected.constant.kind === "numeric" &&
      selected.constant.token.coefficient === 9007199254740993n, true, "the dictionary's physical numeric key retains the exact authored integer");
  }
});

test("enum numeric field keys reject conflicting checker spellings even when the enum value itself is coherent", () => {
  const source = checked(`
enum Key { Value = 1152921504606846976 }
export const value = { [Key.Value]: 1, "1152921504606846976": 2 };
`);
  const enumValue = source.semantics.enumConstants.entries[0]!;
  assert.equal(enumValue.kind === "resolved" ? enumValue.value : undefined, 1152921504606846976n, "the native enum value is still exact");
  const index = source.semantics.forFile(source.navigation.sourceFiles[0]!).propertyNames;
  assert.equal(index.issues.length, 1, "only the numeric named identity is refused");
  assert.equal(index.issues[0]!.reason.includes("1152921504606847000"), true, "the checker-owned key is named precisely");
  const text = index.entries[1]!.selection;
  assert.equal(text.kind === "resolved" ? text.name : undefined, "1152921504606846976", "an exact string key stays available");
});

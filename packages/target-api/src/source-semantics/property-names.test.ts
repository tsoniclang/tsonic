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

test("authored integer, const and enum field keys never round through a host Number", () => {
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
  assert.equal(index.issues.length, 0, "large native field names need no 53-bit cap");
  assert.deepEqual(index.entries.map(entry => entry.selection.kind === "resolved" ? entry.selection.name : "not-a-field"),
    ["9007199254740993", "9007199254740995", "9007199254740997", "9007199254740998", "-9007199254740993"]);
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
  assert.equal(index.issues.length, 0, "checked literal return contracts have lossless source provenance");
  assert.deepEqual(index.entries.map(entry => entry.selection.kind === "resolved" ? entry.selection.name : "not-a-field"),
    ["9007199254740993", "9007199254740995"]);
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
  assert.equal(index.issues.length, 1, "mutable destructured binding is not a const singleton");
  assert.deepEqual(computed.map(entry => entry.selection.kind === "resolved" ? entry.selection.name : entry.selection.kind),
    ["object", "nested", "array", "9007199254740993", "9007199254740995", "rejected"]);
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
  assert.equal(index.issues.length, 0, "erased singleton type names have exact native field identities");
  assert.deepEqual(index.entries.map(entry => entry.selection.kind === "resolved" ? entry.selection.name : entry.selection.kind),
    ["value", "9007199254740993", "entry"]);
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
  assert.equal(index.issues.length, 1, "an assertion cannot make a dynamic reference a static key");
  assert.deepEqual(index.entries.map(entry => entry.selection.kind === "resolved" ? entry.selection.name : entry.selection.kind),
    ["literal", "9007199254740993", "value", "rejected"]);
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
  assert.equal(index.issues.length, 0, "fixed tuple spreads retain exact source origins");
  assert.deepEqual(index.entries.map(entry => entry.selection.kind === "resolved" ? entry.selection.name : entry.selection.kind),
    ["1", "9007199254740993", "3", "1", "9007199254740993"]);
});

test("declared fixed tuples retain their exact literal type origins", () => {
  const source = checked(`
declare const declared: readonly [first: 9007199254740993, second: 9007199254740995];
const [first, second, after] = [...declared, 3] as const;
export const values = [{ [first]: 1 }, { [second]: 2 }, { [after]: 3 }];
`);
  const index = source.semantics.forFile(source.navigation.sourceFiles[0]!).propertyNames;
  assert.equal(index.issues.length, 0, "declared tuple contracts provide exact native literal evidence");
  assert.deepEqual(index.entries.map(entry => entry.selection.kind === "resolved" ? entry.selection.name : entry.selection.kind),
    ["9007199254740993", "9007199254740995", "3"]);
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
  assert.equal(index.issues.length, 5, "each conflicting asserted contract is refused without a 53-bit cap");
  assert.equal(index.entries.slice(0, 5).every(entry => entry.selection.kind === "rejected"), true,
    "neither checked rounding nor erased syntax can alter the actual key");
  const exact = index.entries[5]!.selection;
  assert.equal(exact.kind === "resolved" ? exact.name : undefined, "9007199254740993", "an agreeing exact assertion remains native-valid");
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
  assert.equal(index.issues.length, 0, "ordinary and computed binding keys have exact source evidence");
  assert.deepEqual(index.entries.map(entry => entry.selection.kind === "resolved" ? entry.selection.name : entry.selection.kind),
    ["9007199254740993", "16", "9007199254740993", "16"]);
});

test("native key consumers receive immutable lossless scalar data without fabricated literal provenance", () => {
  const source = checked(`
enum Key { Entry = 9007199254740993 }
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

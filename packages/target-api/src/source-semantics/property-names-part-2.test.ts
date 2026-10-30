import assert from "node:assert/strict";

import test from "node:test";

import { targetSourceSyntaxProgram } from "../target-analysis/source-syntax.js";

import { checked } from "./property-names-fixtures.js";

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

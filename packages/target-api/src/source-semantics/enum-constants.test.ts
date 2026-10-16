import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics, type Node } from "@tsonic/tsts";
import { analyzeSourceEnumConstants, createTargetSourceProgram } from "../public/source.js";
import { createSourceProgramNavigation } from "../source-navigation/index.js";

function checked(text: string, files: Readonly<Record<string, string>> = {}, valid = true) {
  const source = createCompilerSessionFromFiles({
    currentDirectory: "/src",
    files: { "/src/index.ts": text, ...files },
    compilerOptions: { strict: true, target: "es2022", module: "esnext", moduleResolution: "bundler" },
  }).checkSource();
  if (valid) assert.equal(source.diagnostics.length, 0,
    formatDiagnostics(source.diagnostics.filter(diagnostic => diagnostic !== undefined)));
  return source;
}

test("enum constants have one exact initialized, implicit and imported declaration authority", () => {
  const program = createTargetSourceProgram(checked(`
import { Base } from "./base.js";
export enum Value { First, Second, Exact = 9007199254740993, Next, Imported = Base.First + 3 }
`, { "/src/base.ts": "export enum Base { First = 9007199254740995 }" }));
  const selected = program.semantics.enumConstants.entries;
  assert.equal(selected.length, 6, "every actual checked member is indexed once");
  const values = selected.map(entry => entry.kind === "resolved" ? entry.value : entry.reason);
  assert.equal(values.includes(9007199254740995n), true, "imported member never passes through Number");
  assert.equal(values.includes(9007199254740993n), true, "initialized authored integer is exact");
  assert.equal(values.includes(9007199254740994n), true, "implicit ordinal increments the exact predecessor");
  assert.equal(values.includes(9007199254740998n), true, "imported arithmetic is exact");
  assert.equal(values.includes(0n), true, "a nonambient first implicit member starts at zero");
  assert.equal(values.includes(1n), true, "ordinary implicit successors remain unchanged");
});

test("enum source shifts and bitwise operations use 32-bit source semantics independent of native width", () => {
  const program = createTargetSourceProgram(checked(`
export enum Bits { Shift = 1 << 33, Signed = 0x80000000 >> 1, Unsigned = -1 >>> 0,
  Not = ~0x100000000, Or = 0x100000000 | 3, And = 0x100000003 & 7,
  Xor = 0xffffffff ^ 2, Masked = 1 << -1 }
`));
  const values = program.semantics.enumConstants.entries.map(entry => entry.kind === "resolved" ? entry.value : entry.reason);
  assert.deepEqual(values, [2n, -1073741824n, 4294967295n, -1n, 3n, 3n, -3n, -2147483648n]);
});

test("enum arithmetic preserves exact source tokens through all integral constant operations", () => {
  const program = createTargetSourceProgram(checked(`
export enum Arithmetic { Sum = 9007199254740993 + 2, Difference = Sum - 4,
  Product = Difference * 3, Quotient = Product / 3, Remainder = Sum % 4,
  Power = 2 ** 54, Negative = -(9007199254740993), Scientific = 1.25e3 }
`));
  assert.deepEqual(program.semantics.enumConstants.entries.map(entry => entry.kind === "resolved" ? entry.value : entry.reason),
    [9007199254740995n, 9007199254740991n, 27021597764222973n, 9007199254740991n, 3n,
      18014398509481984n, -9007199254740993n, 1250n]);
});

test("fractional enum constants and zero divisors are explicit refused selections, never truncations", () => {
  const program = createTargetSourceProgram(checked(`
export enum Refused { Fraction = 1.5, Division = 7 / 2, Zero = 1 / 0, Remainder = 1 % 0 }
`, {}, false));
  const entries = program.semantics.enumConstants.entries;
  assert.equal(entries.length, 4, "every refused member still has an immutable status");
  assert.equal(entries.every(entry => entry.kind === "rejected"), true, "no truncated integer or invented infinity");
  assert.equal(entries[0]!.kind === "rejected" && entries[0]!.reason.includes("fractional"), true, "fractional literal reason");
  assert.equal(entries[1]!.kind === "rejected" && entries[1]!.reason.includes("truncation"), true, "nonintegral division reason");
  assert.equal(entries[2]!.kind === "rejected" && entries[2]!.reason.includes("division by zero"), true, "division by zero reason");
  assert.equal(entries[3]!.kind === "rejected" && entries[3]!.reason.includes("remainder by zero"), true, "remainder by zero reason");
});

test("ambient unknown values never acquire invented ordinals and computed members never execute", () => {
  const program = createTargetSourceProgram(checked(`
declare enum Ambient { First, Second, Known = 7 }
function choose(): number { throw new Error("not compiler code"); }
export enum Runtime { Computed = choose(), Following }
`, {}, false));
  const entries = program.semantics.enumConstants.entries;
  assert.deepEqual(entries.map(entry => entry.kind), ["rejected", "rejected", "resolved", "rejected", "rejected"]);
  assert.equal(entries[0]!.kind === "rejected" && entries[0]!.reason.includes("ambient"), true, "unknown ambient reason");
  assert.equal(entries[2]!.kind === "resolved" ? entries[2]!.value : undefined, 7n, "an explicit ambient constant remains known");
  assert.equal(entries[3]!.kind === "rejected" && entries[3]!.reason.includes("supported constant expression"), true, "effectful constant is refused");
});

test("enum dependency cycles refuse without recursive evaluator calls", () => {
  const program = createTargetSourceProgram(checked("export enum Cycle { First = Second, Second = First }", {}, false));
  assert.equal(program.semantics.enumConstants.entries.length, 2, "all cyclic members remain indexed");
  assert.equal(program.semantics.enumConstants.entries.every(entry => entry.kind === "rejected" && entry.reason.includes("cycle")), true,
    "a cycle is a source refusal rather than a stack overflow or checker-number fallback");
});

test("regular string enum constants classify keys without admitting a native runtime enum representation", () => {
  const program = createTargetSourceProgram(checked(`
enum Key { Prefix = "en", Entry = Prefix + "try" }
export const value = { [Key.Entry]: 1 };
`));
  const entry = program.semantics.enumConstants.entries[1]!;
  assert.equal(entry.kind === "resolved" ? entry.value : undefined, "entry", "source string constant is known");
  const key = program.semantics.forFile(program.navigation.sourceFiles[0]!).propertyNames.entries[0]!.selection;
  assert.equal(key.kind === "resolved" ? key.name : undefined, "entry", "key spelling consumes the shared source constant");
  assert.equal(key.kind === "resolved" && key.enumConstant === entry, true, "the classifier carries the same checked member identity and immutable entry");
});

test("numeric enum keys are identical to the indexed discriminant and sealed reads perform no queries", () => {
  const source = checked('export enum Key { Entry = 9007199254740993 } export const value = { [Key.Entry]: 1 };');
  const navigation = createSourceProgramNavigation(source);
  let sealed = false;
  let queries = 0;
  const index = analyzeSourceEnumConstants({ ...source, getSourceFileQueries(file) {
    assert.equal(sealed, false, "sealed enum reads cannot query syntax or the checker");
    queries += 1;
    return source.getSourceFileQueries(file);
  } }, navigation);
  sealed = true;
  const entry = index.entries[0]!;
  const before = queries;
  for (let repeat = 0; repeat < 20; repeat += 1) assert.equal(index.get(entry.declaration) === entry, true, "stable frozen entry");
  assert.equal(queries, before, "the source index never recomputes after publication");
  assert.equal(Object.isFrozen(index) && Object.isFrozen(index.entries) && Object.isFrozen(entry), true, "index and entries are immutable");
  assert.equal(index.get({} as Node) === undefined, true, "a foreign identity is not an unknown actual member");
  const program = createTargetSourceProgram(source);
  const selected = program.semantics.forFile(program.navigation.sourceFiles[0]!).propertyNames.entries[0]!.selection;
  const constant = program.semantics.enumConstants.entries[0]!;
  assert.equal(selected.kind === "resolved" && selected.enumConstant === constant, true, "both paths consume the identical source decision");
  assert.equal(selected.kind === "resolved" ? selected.name : undefined,
    constant.kind === "resolved" ? String(constant.value) : undefined, "the discriminant and field name have the same exact value");
});

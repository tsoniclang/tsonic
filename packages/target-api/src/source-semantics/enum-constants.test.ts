import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics, type Node } from "@tsonic/tsts";
import { analyzeSourceEnumConstants, createTargetSourceProgram, selectSourceEnumIntegerWidth } from "../public/source.js";
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

test("merged enum symbols have one immutable refusal before constant evaluation, R2 and width selection", () => {
  for (const [label, text, count] of [
    ["ordinary", "enum Value { First = 1 } enum Value { Second = 2 }", 2],
    ["cross-declaration checker collision", "enum Value { First = 9007199254740992 } enum Value { Second = 9007199254740993 }", 2],
    ["empty", "enum Value {} enum Value {}", 2],
    ["unevaluated initializer", "enum Value { First = 2 ** 1000000000000 } enum Value { Second = 2 }", 2],
    ["three declarations", "enum Value { First = 1 } enum Value { Second = 2 } enum Value { Third = 3 }", 3],
  ] as const) {
    const source = checked(text, {}, label !== "unevaluated initializer");
    const program = createTargetSourceProgram(source);
    const index = program.semantics.enumConstants;
    assert.equal(index.issues.length, 1, `${label} has one issue for its one actual symbol`);
    const issue = index.issues[0]!;
    assert.equal(issue.code, "TSONIC_ENUM_MERGED_DECLARATIONS_NOT_SUPPORTED", `${label} has the shared scope code`);
    assert.equal(issue.message, `Enum 'Value' has ${count} declarations; tsonic supports one declaration per enum.`, `${label} has the precise count`);
    assert.equal(Object.isFrozen(issue) && Object.isFrozen(index.issues), true, `${label} publishes immutable diagnostics`);
    assert.equal(index.entries.every(entry => entry.kind === "rejected" && entry.reason === issue.message), true,
      `${label} never falls through to evaluation or checker collision precedence`);
    const declarations = program.ast.statements(program.navigation.sourceFiles[0]!).filter(
      (node): node is Node => node !== undefined && program.ast.is.IsEnumDeclaration(node));
    assert.equal(declarations.length, count, `${label} keeps each exact checked declaration`);
    for (const declaration of declarations) {
      const width = index.integerWidth(declaration);
      assert.equal(width?.kind === "rejected" && width.admissionIssue === issue, true,
        `${label} cannot publish any successful width or a second group issue`);
    }
  }
});

test("enum merging is actual symbol identity, not spelling or a namespace declaration", () => {
  const source = createTargetSourceProgram(checked(`
enum Value { First = 1 }
namespace Value { export const extra = 2; }
function first() { enum Local { First = 1 } return Local.First; }
function second() { enum Local { Second = 2 } return Local.Second; }
`));
  assert.equal(source.semantics.enumConstants.issues.length, 0, "separate lexical symbols and namespace augmentation are not merged enums");
  assert.equal(source.semantics.enumConstants.entries.every(entry => entry.kind === "resolved"), true,
    "all three ordinary constant owners remain unchanged");
});

test("enum constants have one exact initialized, implicit and imported declaration authority", () => {
  const program = createTargetSourceProgram(checked(`
import { Base } from "./base.js";
export enum Value { First, Second, Exact = 9007199254740993, Next, Imported = Base.First + 3 }
`, { "/src/base.ts": "export enum Base { First = 9007199254740995 }" }));
  const selected = program.semantics.enumConstants.entries;
  assert.equal(selected.length, 6, "every actual checked member is indexed once");
  const values = selected.map(entry => entry.kind === "resolved" ? entry.value : entry.reason);
  assert.equal(values.includes(9007199254740995n), true, "imported member never passes through Number");
  for (const name of ["Exact", "Next", "Imported"]) {
    const member = selected.find(entry => program.ast.text(program.ast.name(entry.declaration)) === name);
    assert.equal(member?.kind === "rejected" && member.reason.includes("checker value"), true,
      `${name} is refused where the exact value and the checker identity disagree`);
  }
  assert.equal(values.includes(0n), true, "a nonambient first implicit member starts at zero");
  assert.equal(values.includes(1n), true, "ordinary implicit successors remain unchanged");
});

test("enum source shifts and bitwise operations use 32-bit source semantics independent of native width", () => {
  const source = checked(`
export enum Bits { Shift = 1 << 33, Signed = 0x80000000 >> 1, Unsigned = -1 >>> 0,
  Not = ~0x100000000, Or = 0x100000000 | 3, And = 0x100000003 & 7,
  Xor = 0xffffffff ^ 2, Masked = 1 << -1 }
`, {}, false);
  assert.deepEqual(source.diagnostics.map(diagnostic => diagnostic?.code), [6807],
    "the source checker reports its existing literal-shift simplification diagnostic");
  const program = createTargetSourceProgram(source);
  const values = program.semantics.enumConstants.entries.map(entry => entry.kind === "resolved" ? entry.value : entry.reason);
  assert.deepEqual(values, [2n, -1073741824n, 4294967295n, -1n, 3n, 3n, -3n, -2147483648n]);
});

test("enum arithmetic preserves exact source tokens through all integral constant operations", () => {
  const program = createTargetSourceProgram(checked(`
export enum Arithmetic { Sum = 9007199254740993 + 2, Difference = Sum - 4,
  Product = Difference * 3, Quotient = Product / 3, Remainder = Sum % 4,
  Power = 2 ** 54, Negative = -(9007199254740993), Scientific = 1.25e3 }
`));
  const entries = program.semantics.enumConstants.entries;
  for (const [position, exact] of [9007199254740995n, 9007199254740991n, 27021597764222973n, 9007199254740991n, 3n].entries()) {
    const entry = entries[position]!;
    assert.equal(entry.kind === "rejected" && entry.reason.includes(`exact value ${exact}`) && entry.reason.includes("checker value"), true,
      `arithmetic member ${position} preserves the exact value in its coherence refusal`);
  }
  assert.deepEqual(entries.slice(5).map(entry => entry.kind === "resolved" ? entry.value : entry.reason),
    [18014398509481984n, -9007199254740993n, 1250n]);
});

test("checked const references refuse incoherent implicit enum ordinals without changing their values", () => {
  const program = createTargetSourceProgram(checked(`
import { exact } from "./constants.js";
export enum Value { First = exact, Second, Third }
const key = Value.Third;
export const result = { [key]: 1 };
`, { "/src/constants.ts": "export const exact = 9007199254740993;" }));
  const entries = program.semantics.enumConstants.entries;
  for (const [position, exact] of [9007199254740993n, 9007199254740994n, 9007199254740995n].entries()) {
    const entry = entries[position]!;
    assert.equal(entry.kind === "rejected" && entry.reason.includes(`exact value ${exact}`), true,
      `implicit ordinal ${position} has a precise exact/checker disagreement`);
  }
  const file = program.navigation.sourceFiles.find(candidate => program.ast.getFileName(candidate) === "/src/index.ts")!;
  const key = program.semantics.forFile(file).propertyNames.entries[0]!.selection;
  assert.equal(key.kind === "rejected" && entries[2]!.kind === "rejected" && key.reason === entries[2]!.reason, true,
    "the const alias carries the same refusal, not a second evaluator or a rounded value");
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
  assert.equal(key.kind === "resolved" && key.constant.kind === "enum-member" && key.constant.entry === entry, true,
    "the classifier carries the same checked member identity and immutable entry");
});

test("numeric enum keys are identical to the indexed discriminant and sealed reads perform no queries", () => {
  const source = checked('export enum Key { Entry = 9007199254740994 } export const value = { [Key.Entry]: 1 };');
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
  const declaration = source.ast.parent(entry.declaration)!;
  const width = index.integerWidth(declaration);
  assert.equal(width?.kind === "resolved" ? width.integerWidth : undefined, 64, "common width is complete before file semantics or native type analysis");
  for (let repeat = 0; repeat < 20; repeat += 1) assert.equal(index.integerWidth(declaration) === width, true, "width is one stable frozen decision");
  assert.equal(width !== undefined && Object.isFrozen(width), true, "published width is immutable");
  assert.equal(queries, before, "the source index never recomputes after publication");
  assert.equal(Object.isFrozen(index) && Object.isFrozen(index.entries) && Object.isFrozen(entry), true, "index and entries are immutable");
  assert.equal(index.get({} as Node) === undefined, true, "a foreign identity is not an unknown actual member");
  assert.equal(index.integerWidth({} as Node) === undefined, true, "a foreign identity is not an unknown actual enum");
  const program = createTargetSourceProgram(source);
  const selected = program.semantics.forFile(program.navigation.sourceFiles[0]!).propertyNames.entries[0]!.selection;
  const constant = program.semantics.enumConstants.entries[0]!;
  assert.equal(selected.kind === "resolved" && selected.constant.kind === "enum-member" && selected.constant.entry === constant, true,
    "both paths consume the identical source decision");
  assert.equal(selected.kind === "resolved" ? selected.name : undefined,
    constant.kind === "resolved" ? String(constant.value) : undefined, "the discriminant and field name have the same exact value");
});

test("one common finite-value owner selects i32 then i64 with no Number conversion or 53-bit cap", () => {
  assert.deepEqual(selectSourceEnumIntegerWidth([]), { kind: "resolved", integerWidth: 32 });
  assert.deepEqual(selectSourceEnumIntegerWidth([-2147483648n, 2147483647n]), { kind: "resolved", integerWidth: 32 });
  assert.deepEqual(selectSourceEnumIntegerWidth([-2147483649n]), { kind: "resolved", integerWidth: 64 });
  assert.deepEqual(selectSourceEnumIntegerWidth([9007199254740993n, -9223372036854775808n, 9223372036854775807n]),
    { kind: "resolved", integerWidth: 64 });
  for (const value of [-9223372036854775809n, 9223372036854775808n]) {
    const selected = selectSourceEnumIntegerWidth([1n, value]);
    assert.equal(selected.kind, "rejected", "only the actual common native i64 bound refuses");
    assert.equal(selected.kind === "rejected" ? selected.index : undefined, 1, "the precise offending member index is retained");
  }
  const text = selectSourceEnumIntegerWidth([1n, "entry"]);
  assert.equal(text.kind === "rejected" && text.reason.includes("string enums"), true, "known source strings do not invent a native enum representation");
});

test("common enum widths are eagerly cached for every declaration, including empty and refused declarations", () => {
  const program = createTargetSourceProgram(checked(`
export enum Empty {}
export enum Small { First = -2147483648, Last = 2147483647 }
export enum Wide { First = 9007199254740993, Same = 9007199254740993 }
export enum Outside { First = 9223372036854775808 }
export enum Text { Entry = "entry" }
`));
  const declarations = program.ast.statements(program.navigation.sourceFiles[0]!).filter((node): node is Node =>
    node !== undefined && program.ast.is.IsEnumDeclaration(node));
  const selections = declarations.map(declaration => program.semantics.enumConstants.integerWidth(declaration));
  assert.deepEqual(selections.map(selection => selection?.kind === "resolved" ? selection.integerWidth : selection?.kind),
    [32, 32, 64, "rejected", "rejected"]);
  assert.equal(selections.every((selection, index) => selection !== undefined && selection.declaration === declarations[index] && Object.isFrozen(selection)), true,
    "each actual enum declaration has its own immutable decision before a file-semantic read");
  const text = program.semantics.enumConstants.entries.find(entry =>
    program.ast.parent(entry.declaration) === declarations[4]);
  assert.equal(text?.kind === "resolved" ? text.value : undefined, "entry", "native admission never changes the source value index");
});

test("exact enum intermediates preserve native values and separately refuse checker disagreement", () => {
  const program = createTargetSourceProgram(checked(`
export enum Intermediate { Power = (2 ** 1000) / (2 ** 1000), Decimal = 1e400 / 1e400,
  One = 1 ** -9007199254740993, Odd = (-1) ** -9007199254740993, Even = (-1) ** -9007199254740994 }
`, {}, false));
  const values = program.semantics.enumConstants.entries;
  for (const [position, exact] of [1n, 1n, 1n, -1n, 1n].entries()) {
    const entry = values[position]!;
    assert.equal(entry.kind === "rejected" && entry.failure === "source" && entry.reason.includes(`exact value ${exact}`) &&
      entry.reason.includes("checker value"), true, `intermediate ${position} reaches coherence admission, not a resource or native-width cap`);
  }
  const declaration = program.ast.statements(program.navigation.sourceFiles[0]!)[0]!;
  assert.equal(program.semantics.enumConstants.integerWidth(declaration)?.kind, "rejected", "one source-incoherent member refuses its enum before the seal");
});

test("coherent exact enum intermediates remain independent of native-width and float-finiteness preflights", () => {
  const program = createTargetSourceProgram(checked(`
export enum Intermediate { Power = (2 ** 1000) / (2 ** 1000), One = 1 ** -9007199254740993, Even = (-1) ** -9007199254740994 }
`));
  assert.deepEqual(program.semantics.enumConstants.entries.map(entry => entry.kind === "resolved" ? entry.value : entry.reason),
    [1n, 1n, 1n]);
  const declaration = program.ast.statements(program.navigation.sourceFiles[0]!)[0]!;
  assert.equal(program.semantics.enumConstants.integerWidth(declaration)?.kind, "resolved",
    "large exact intermediates with coherent final values keep their actual native width");
});

test("explicit wide enum values retain exact native data while distinct checker collisions refuse", () => {
  const program = createTargetSourceProgram(checked(`
export enum Exact { First = 9007199254740993, Next = 9007199254740994, Same = First }
export enum Colliding { Low = 9007199254740992, High = 9007199254740993 }
export enum Remainder { Sum = 9007199254740993 + 2, Value = Sum % 4 }
`));
  const entries = program.semantics.enumConstants.entries;
  assert.deepEqual(entries.slice(0, 3).map(entry => entry.kind === "resolved" ? entry.value : entry.reason),
    [9007199254740993n, 9007199254740994n, 9007199254740993n]);
  for (const entry of entries.slice(3, 5)) {
    assert.equal(entry.kind === "rejected" && entry.reason.includes("Different exact enum values share this checker value"), true,
      "both different exact values lose the colliding checker identity");
  }
  for (const entry of entries.slice(5)) assert.equal(entry.kind === "rejected" && entry.reason.includes("checker value"), true,
    "arithmetic disagreement is refused even when only enum values are used");
  const declarations = program.ast.statements(program.navigation.sourceFiles[0]!).filter((node): node is Node =>
    node !== undefined && program.ast.is.IsEnumDeclaration(node));
  assert.deepEqual(declarations.map(declaration => program.semantics.enumConstants.integerWidth(declaration)?.kind),
    ["resolved", "rejected", "rejected"]);
});

test("enum resource refusals preflight huge allocations and preserve a distinct immutable failure", () => {
  const program = createTargetSourceProgram(checked(`
export enum Storage { Value = 2 ** 1000000000 }
export enum Work { Value = 2 ** 10000 }
export enum Exponent { Value = 1e1000000000 }
export enum Ordinary { Value = 7 }
export const values = { [Storage.Value]: 1 };
`, {}, false));
  const entries = program.semantics.enumConstants.entries;
  assert.equal(entries.length, 4, "refused and ordinary members all remain indexed");
  for (const [position, entry] of entries.slice(0, 3).entries()) {
    assert.equal(entry.kind === "rejected" && entry.failure === "resource", true, `resource case ${position}`);
    assert.equal(entry.kind === "rejected" && entry.reason.includes(position === 1 ? "work budget" : "storage budget"), true,
      `resource case ${position} names its actual budget`);
    const width = program.semantics.enumConstants.integerWidth(program.ast.parent(entry.declaration)!);
    assert.equal(width?.kind === "rejected" && width.failure === "resource", true, `width ${position} preserves the original resource refusal`);
    assert.equal(Object.isFrozen(entry) && width !== undefined && Object.isFrozen(width), true, `resource case ${position} is sealed data`);
  }
  assert.equal(entries[3]!.kind === "resolved" ? entries[3]!.value : undefined, 7n, "one refusal does not poison an independent evaluation");
  const key = program.semantics.forFile(program.navigation.sourceFiles[0]!).propertyNames.entries[0]!.selection;
  assert.equal(key.kind === "rejected" && key.failure === "resource", true, "key admission retains the same resource category");
});

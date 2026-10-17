import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../public/source.js";

function checked(text: string, files: Readonly<Record<string, string>> = {}) {
  const source = createCompilerSessionFromFiles({ currentDirectory: "/src", files: { "/src/index.ts": text, ...files },
    compilerOptions: { strict: true, target: "es2022", module: "esnext", moduleResolution: "bundler" } }).checkSource();
  assert.equal(source.diagnostics.length, 0, formatDiagnostics(source.diagnostics.filter(issue => issue !== undefined)));
  return createTargetSourceProgram(source);
}

const numericUses = [
  ["mixed equality", "export function use(value: Value, operand: number): boolean { return value === operand; }"],
  ["mixed inequality", "export function use(value: Value, operand: number): boolean { return value != operand; }"],
  ["same-enum ordering", "export function use(left: Value, right: Value): boolean { return left < right; }"],
  ["arithmetic", "export function use(value: Value): number { return value + 1; }"],
  ["unary minus", "export function use(value: Value): number { return -value; }"],
  ["unary plus", "export function use(value: Value): number { return +value; }"],
  ["increment", "export function use(value: Value): Value { value++; return value; }"],
  ["decrement", "export function use(value: Value): Value { --value; return value; }"],
  ["numeric local", "export function use(value: Value): number { const result: number = value; return result; }"],
  ["numeric return", "export function use(value: Value): number { return value; }"],
  ["numeric argument", "function consume(value: number): number { return value; } export function use(value: Value): number { return consume(value); }"],
  ["numeric assignment", "export function use(value: Value): number { let result = 0; result = value; return result; }"],
  ["mixed bitwise", "export function use(value: Value, operand: number): number { return value | operand; }"],
  ["shift", "export function use(value: Value): number { return value << 1; }"],
  ["complement numeric local", "export function use(value: Value): number { const result: number = ~value; return result; }"],
  ["complement arithmetic", "export function use(value: Value): number { return ~value + 1; }"],
  ["bitwise numeric return", "export function use(left: Value, right: Value): number { return left | right; }"],
  ["inferred complement return", "export function use(value: Value): number { const result = ~value; return result; }"],
  ["inferred complement copy return", "export function use(value: Value): number { const result = ~value; const copy = result; return copy; }"],
  ["inferred bitwise return", "export function use(left: Value, right: Value): number { const result = left | right; return result; }"],
  ["inferred complement argument", "function consume(value: number): number { return value; } export function use(value: Value): number { const result = ~value; return consume(result); }"],
  ["inferred complement assignment", "export function use(value: Value): number { const result = ~value; let copy = 0; copy = result; return copy; }"],
  ["inferred complement comparison", "export function use(value: Value): boolean { const result = ~value; return result === 0; }"],
  ["inferred complement arithmetic", "export function use(value: Value): number { const result = ~value; return result + 1; }"],
  ["unwritten inferred binding", "export function use(value: Value): number { let result = ~value; return result; }"],
] as const;

for (const [label, body] of numericUses) {
  test(`enum numeric admission refuses ${label} once before target analysis`, () => {
    const source = checked(`export enum Value { First = 1, Second = 2 } ${body}`);
    const issues = source.semantics.enumConstants.issues;
    assert.equal(issues.length, 1, `${label} has one owning use, not one diagnostic per operand`);
    assert.equal(issues[0]!.code, "TSONIC_ENUM_NUMERIC_USE_NOT_SUPPORTED", `${label} has the shared scope diagnostic`);
    assert.equal(issues[0]!.message, "Enum value 'Value' is used as a number; enum-numeric operations are not supported yet. Use equality or bitwise operations within the same enum instead.",
      `${label} uses the same target-neutral text`);
    assert.equal(Object.isFrozen(issues) && Object.isFrozen(issues[0]), true, `${label} publishes frozen issue data`);
  });
}

test("a wide enum and neighboring checker-equal literal are refused before native operation selection", () => {
  const source = checked(`export enum High { Value = 9007199254740993 }
export function equal(): boolean { return High.Value === 9007199254740992; }`);
  assert.equal(source.semantics.enumConstants.entries[0]!.kind, "resolved", "the exact standalone enum remains native-valid");
  assert.equal(source.semantics.enumConstants.issues[0]?.code, "TSONIC_ENUM_NUMERIC_USE_NOT_SUPPORTED",
    "the unsupported mixed comparison never reaches an internal missing-fact path");
});

test("checked provider enum identity is preserved even when its ambient constants are unknown", () => {
  const source = checked(`import { Value } from "./provider.js";
export function equal(value: Value, operand: number): boolean { return value === operand; }`,
  { "/src/provider.d.ts": "export declare enum Value { First, Second }" });
  assert.equal(source.semantics.enumConstants.issues.length, 1, "actual provider declaration identity owns the numeric use");
  assert.equal(source.semantics.enumConstants.issues[0]!.code, "TSONIC_ENUM_NUMERIC_USE_NOT_SUPPORTED",
    "unknown provider values are not mistaken for non-enum operands");
});

test("same-enum equality, complement, bitwise, initializers and static keys retain their native domain", () => {
  const source = checked(`
export enum Value { First = 1, Second = First << 1 }
export function equal(left: Value, right: Value): boolean { return left === right; }
export function unequal(left: Value, right: Value): boolean { return left !== right; }
export function combine(left: Value, right: Value): Value { return left | right; }
export function mask(left: Value, right: Value): Value { return left & right; }
export function toggle(left: Value, right: Value): Value { return left ^ right; }
export function complement(value: Value): Value { return ~value; }
export function combinedComplement(left: Value, right: Value): Value { return ~left & right; }
export function copiedComplement(value: Value): Value { const result = ~value; const copy = result; return copy; }
export function copiedBitwise(left: Value, right: Value): Value { const result = left | right; const copy = result; return copy; }
export function comparedComplement(value: Value): boolean { const result = ~value; return result === value; }
export function combinedCopy(left: Value, right: Value): Value { const result = ~left; return result & right; }
export const object = { [Value.First]: 1 };
`);
  assert.equal(source.semantics.enumConstants.issues.length, 0, "no supported same-enum operation or compile-time key is reclassified as numeric");
  assert.equal(source.semantics.enumConstants.entries.every(entry => entry.kind === "resolved"), true,
    "constant initializer operators retain their existing exact evaluator");
});

test("enum domain follows actual checked const origins across project source files", () => {
  const source = checked(`import { copied } from "./value.js"; export function use(): number { return copied; }`,
    { "/src/value.ts": "export enum Value { First = 1 } const result = ~Value.First; export const copied = result;" });
  assert.equal(source.semantics.enumConstants.issues.length, 1, "the imported immutable origin retains its actual enum identity");
  assert.equal(source.semantics.enumConstants.issues[0]?.code, "TSONIC_ENUM_NUMERIC_USE_NOT_SUPPORTED",
    "a module name or checker number does not hide the numeric return");
});

test("numeric and shadowed bindings do not inherit another declaration's enum domain", () => {
  const source = checked(`export enum Value { First = 1 }
export function normal(): number { const result = ~1; const copy = result; return copy; }
export function shadow(value: Value): number {
  const result = ~value;
  { const result = 1; return result + 1; }
}
`);
  assert.equal(source.semantics.enumConstants.issues.length, 0,
    "no spelling or ordinary numeric initializer becomes enum provenance");
});

test("explicit numeric source assertions are refused at the shared projection boundary", () => {
  const source = checked(`export enum Value { First = 1 }
export function convert(value: Value): number { const result = value as number; return result; }
`);
  assert.equal(source.semantics.enumConstants.issues.length, 1, "C-0124 refuses explicit numeric projection before either target implements M5");
  assert.equal(source.semantics.enumConstants.issues[0]?.code, "TSONIC_ENUM_NUMERIC_USE_NOT_SUPPORTED", "the conversion has the same precise shared refusal");
});

const compositionRefusals = [
  ["conditional complement", "export function use(left: Value, right: Value, flag: boolean): number { const result = flag ? ~left : ~right; return result; }"],
  ["conditional bitwise", "export function use(left: Value, right: Value, flag: boolean): number { const result = flag ? left | right : left & right; return result; }"],
  ["different-enum conditional", "enum Other { Third = 4 } export function use(left: Value, right: Other, flag: boolean): number { const result = flag ? ~left : ~right; return result; }"],
  ["mixed ordinary conditional", "export function use(left: Value, flag: boolean): number { const result = flag ? ~left : 42; return result; }"],
  ["checked enum and number choice", "export function use(left: Value, flag: boolean): number { const result = flag ? left : 42; return result; }"],
  ["comma complement", "function touch(): void {} export function use(value: Value): number { const result = (touch(), ~value); return result; }"],
  ["nested comma copy", "function touch(): void {} export function use(value: Value): number { const result = (touch(), (touch(), ~value)); const copy = result; return copy; }"],
  ["logical-and result", "export function use(left: Value, right: Value): number { const result = (~left) && (~right); return result; }"],
  ["logical-or result", "export function use(left: Value, right: Value): number { const result = (~left) || (~right); return result; }"],
  ["logical-or direct number destination", "export function use(left: Value, right: Value): number { return (~left) || (~right); }"],
  ["logical-or nested wrappers", "export function use(left: Value, right: Value): number { const result = (((~left)!)) || (((~right)!)); return result; }"],
  ["logical-or conditional result", "export function use(left: Value, right: Value, flag: boolean): number { const result = flag ? (~left || ~right) : (~right || ~left); return result; }"],
  ["logical-or comma result", "function touch(): void {} export function use(left: Value, right: Value): number { const result = (touch(), ~left || ~right); return result; }"],
  ["nullish inferred numeric right context", "export function use(left: number | undefined, right: Value): number { const result = left ?? ~right; return result; }"],
  ["nullish result", "export function use(right: Value, absent: undefined): number { const result = absent ?? ~right; return result; }"],
  ["mixed choice equality", "export function use(left: Value, flag: boolean): boolean { const result = flag ? ~left : 42; return result === left; }"],
  ["mixed logical equality", "export function use(left: Value): boolean { const result = (~left) || 42; return result === left; }"],
  ["choice numeric argument", "function consume(value: number): number { return value; } export function use(left: Value, right: Value, flag: boolean): number { const result = flag ? ~left : ~right; return consume(result); }"],
  ["choice numeric local", "export function use(left: Value, right: Value, flag: boolean): number { const result = flag ? ~left : ~right; const copy: number = result; return copy; }"],
  ["choice arithmetic", "export function use(left: Value, right: Value, flag: boolean): number { const result = flag ? ~left : ~right; return result + 1; }"],
  ["composed non-null alias", "function touch(): void {} export function use(left: Value, right: Value, flag: boolean): number { const result = (flag ? (touch(), ~left) : ~right)!; const copy = result; return copy; }"],
] as const;

for (const [label, body] of compositionRefusals) {
  test(`enum composition refuses ${label} without losing a possible native enum`, () => {
    const source = checked(`export enum Value { First = 1, Second = 2 } ${body}`);
    const issues = source.semantics.enumConstants.issues;
    assert.equal(issues.length, 1, `${label}: one actual use, not a diagnostic per operand`);
    assert.equal(issues[0]?.code, "TSONIC_ENUM_NUMERIC_USE_NOT_SUPPORTED", `${label}: shared pre-seal code`);
    assert.equal(issues[0]?.message, "Enum value 'Value' is used as a number; enum-numeric operations are not supported yet. Use equality or bitwise operations within the same enum instead.", `${label}: no guessed enum identity`);
    assert.equal(Object.isFrozen(issues) && Object.isFrozen(issues[0]), true, `${label}: immutable issue`);
  });
}

const compositionPreservations = [
  ["same-enum conditional", "export function use(left: Value, right: Value, flag: boolean): Value { const result = flag ? ~left : ~right; return result; }"],
  ["same-enum conditional bitwise", "export function use(left: Value, right: Value, flag: boolean): Value { const result = flag ? left | right : left & right; return result; }"],
  ["comma enum result", "function touch(): void {} export function use(value: Value): Value { const result = (touch(), ~value); return result; }"],
  ["same-enum logical-and", "export function use(left: Value, right: Value): Value { const result = (~left) && (~right); return result; }"],
  ["same-enum logical-or", "export function use(left: Value, right: Value): Value { const result = (~left) || (~right); return result; }"],
  ["same-enum direct logical-or destination", "export function use(left: Value, right: Value): Value { return (~left) || (~right); }"],
  ["same-enum logical-or nested wrappers", "export function use(left: Value, right: Value): Value { const result = (((~left)!)) || (((~right)!)); return result; }"],
  ["same-enum logical-or conditional result", "export function use(left: Value, right: Value, flag: boolean): Value { const result = flag ? (~left || ~right) : (~right || ~left); return result; }"],
  ["same-enum logical-or comma result", "function touch(): void {} export function use(left: Value, right: Value): Value { const result = (touch(), ~left || ~right); return result; }"],
  ["nullable enum nullish choice", "export function use(left: Value | undefined, right: Value): Value { const result = left ?? right; return result; }"],
  ["conditional same-enum equality", "export function use(left: Value, right: Value, flag: boolean): boolean { const result = flag ? ~left : ~right; return result === left; }"],
  ["conditional same-enum bitwise", "export function use(left: Value, right: Value, flag: boolean): Value { const result = flag ? ~left : ~right; return result & left; }"],
  ["ordinary numeric compositions", "export function use(left: number, right: number, flag: boolean): number { const result = flag ? ~left : ~right; return (result || 42) + 1; }"],
  ["same-enum authored assertion", "export function use(value: Value): Value { const result = value as Value; return result; }"],
  ["effectful comma with numeric result", "function touch(value: Value): void {} export function use(value: Value): number { const result = (touch(value), 42); return result; }"],
  ["lexical shadow", "export function use(value: Value, flag: boolean): number { const result = flag ? ~value : ~value; { const result = 42; return result; } }"],
  ["branded enum intersection", "type Branded = Value & { readonly tag: unique symbol }; export function use(value: Branded): boolean { return value === value; }"],
  ["nullable enum identity", "export function use(left: Value | undefined, right: Value | undefined): boolean { return left === right; }"],
  ["checked-false logical value", "export function use(value: Value): boolean { const result = false && ~value; return result; }"],
  ["nested effectful same-enum result", "function choose(flag: boolean): boolean { return flag; } function touch(): void {} export function use(left: Value, right: Value, flag: boolean): Value { const result = choose(flag) ? (touch(), ~left) : (touch(), ~right); const copy = result; return copy; }"],
] as const;

for (const [label, body] of compositionPreservations) {
  test(`enum composition preserves ${label} without manufacturing a numeric use`, () => {
    const source = checked(`export enum Value { First = 1, Second = 2 } ${body}`);
    assert.equal(source.semantics.enumConstants.issues.length, 0, `${label}: actual result identity and source effects remain unchanged`);
  });
}

const extraNumericRefusals = [
  ["numeric switch discriminant", "export function use(value: number): number { switch (value) { case Value.First: return 1; default: return 0; } }", 1],
  ["numeric switch case", "export function use(value: Value): number { switch (value) { case 1: return 1; default: return 0; } }", 1],
  ["inferred complement switch discriminant", "export function use(value: Value): number { const result = ~value; switch (result) { case 1: return 1; default: return 0; } }", 1],
  ["array numeric index", "export function use(values: number[], key: Value): number { return values[key]; }", 1],
  ["readonly array numeric index", "export function use(values: readonly number[], key: Value): number { return values[key]; }", 1],
  ["number index signature", "export function use(values: { [index: number]: number }, key: Value): number { return values[key]; }", 1],
  ["angle numeric assertion", "export function use(value: Value): number { return <number>value; }", 1],
  ["numeric branch assertions", "export function use(left: Value, right: Value, flag: boolean): number { const result = flag ? left as number : right as number; return result; }", 2],
  ["inferred object field escape", "export function use(): number { const object = { value: ~Value.First }; return object.value + 1; }", 1],
  ["inferred collection escape", "export function use(): number { const values = [~Value.First]; return values[0] + 1; }", 1],
  ["generic call numeric escape", "function identity<T>(value: T): T { return value; } export function use(value: Value): number { const result = identity(~value); return result; }", 1],
  ["inferred callable return escape", "function produce(value: Value) { return ~value; } export function use(value: Value): number { return produce(value); }", 1],
] as const;

for (const [label, body, expected] of extraNumericRefusals) {
  test(`enum boundary refuses ${label} before a target can lose the domain`, () => {
    const source = checked(`export enum Value { First = 1, Second = 2 } ${body}`);
    const issues = source.semantics.enumConstants.issues;
    assert.equal(issues.length, expected, `${label}: exactly one precise issue per actual source use`);
    assert.equal(issues.every(issue => issue.code === "TSONIC_ENUM_NUMERIC_USE_NOT_SUPPORTED" && issue.message.includes("used as a number")), true,
      `${label}: no native fallback, missing-fact invariant or string conversion`);
  });
}

test("enum composition preserves every actual condition, call and operand identity", () => {
  const original = createCompilerSessionFromFiles({ currentDirectory: "/src", files: { "/src/index.ts": `
export enum Value { First = 1, Second = 2 }
function condition(flag: boolean): boolean { return flag; }
function touch(): void {}
export function use(left: Value, right: Value, flag: boolean): Value {
  const result = condition(flag) ? (touch(), ~left) : (touch(), ~right);
  return result;
}
` }, compilerOptions: { strict: true, target: "es2022", module: "esnext", moduleResolution: "bundler" } }).checkSource();
  assert.equal(original.diagnostics.length, 0, "the identity control is actual checked source");
  const nodes: import("@tsonic/tsts").Node[] = [];
  const remaining: (import("@tsonic/tsts").Node | undefined)[] = [...original.sourceFiles];
  while (remaining.length !== 0) {
    const node = remaining.pop();
    if (node === undefined) continue;
    nodes.push(node);
    original.ast.forEachChild(node, child => { if (child !== undefined) remaining.push(child); });
  }
  const calls = nodes.filter(node => original.ast.is.IsCallExpression(node));
  const conditional = nodes.find(node => original.ast.is.IsConditionalExpression(node));
  assert.equal(calls.length, 3, "one condition call and exactly one original call per branch");
  assert.equal(conditional !== undefined, true, "the actual conditional expression exists");
  const source = createTargetSourceProgram(original);
  assert.equal(source.semantics.enumConstants.issues.length, 0, "the same-enum effectful result stays admitted");
  assert.equal(source.sourceFiles.every((file, index) => file === original.sourceFiles[index]), true, "source file identities are unchanged");
  assert.equal(calls.every(call => nodes.includes(call) && source.ast.parent(call) === original.ast.parent(call)), true,
    "source analysis does not replace, copy or reorder a call node");
  assert.equal(source.ast.as.AsConditionalExpression(conditional)?.WhenTrue === original.ast.as.AsConditionalExpression(conditional)?.WhenTrue &&
    source.ast.as.AsConditionalExpression(conditional)?.WhenFalse === original.ast.as.AsConditionalExpression(conditional)?.WhenFalse, true,
    "both exact actual branch expressions survive the shared query unchanged");
});

const extraPreservations = [
  ["same-enum switch", "export function use(value: Value): number { switch (value) { case Value.First: return 1; default: return 0; } }"],
  ["ordinary numeric switch", "export function use(value: number): number { switch (value) { case 1: return 1; default: return 0; } }"],
  ["nullable same-enum switch", "export function use(value: Value | undefined): number { switch (value) { case Value.First: return 1; default: return 0; } }"],
  ["ordinary numeric index", "export function use(values: number[], key: number): number { return values[key]; }"],
  ["fixed tuple enum index", "export function use(values: [number, number]): number { return values[Value.First]; }"],
  ["exact named enum field", "export function use(): number { const object = { [Value.First]: 7 }; return object[Value.First]; }"],
  ["unannotated object default", "export function use(): Value { const { value = 1 } = { value: Value.First }; return value; }"],
  ["unannotated array default", "export function use(): Value { const [value = 1] = [Value.First]; return value; }"],
  ["genuine enum destination", "export function use(value: Value): Value { const result: Value = ~value; return result; }"],
  ["ordinary numeric assertion", "export function use(value: number): number { return value as number; }"],
  ["explicit enum field", "export function use(value: Value): Value { const object: { value: Value } = { value: ~value }; return object.value; }"],
  ["explicit enum collection", "export function use(value: Value): Value { const values: Value[] = [~value]; return values[0]; }"],
  ["enum parameter destination", "function identity(value: Value): Value { return value; } export function use(value: Value): Value { return identity(~value); }"],
] as const;

for (const [label, body] of extraPreservations) {
  test(`enum boundary preserves ${label}`, () => {
    const source = checked(`export enum Value { First = 1, Second = 2 } ${body}`);
    assert.equal(source.semantics.enumConstants.issues.length, 0, `${label}: no implicit numeric projection is invented`);
  });
}

const stringRefusals = [
  ["template", "export function use(value: Value): string { return `enum:${value}`; }"],
  ["global String", "export function use(value: Value): string { return String(value); }"],
  ["global String alias", "export function use(value: Value): string { const convert = String; return convert(value); }"],
  ["enum toString", "export function use(value: Value): string { return value.toString(); }"],
  ["left concatenation", "export function use(value: Value): string { return '' + value; }"],
  ["right concatenation", "export function use(value: Value): string { return value + ''; }"],
  ["compound concatenation", "export function use(value: Value): string { let result = ''; result += value; return result; }"],
  ["string index", "export function use(values: { [key: string]: number }, key: Value): number { return values[key]; }"],
  ["toFixed", "export function use(value: Value): string { return value.toFixed(); }"],
  ["toPrecision", "export function use(value: Value): string { return value.toPrecision(); }"],
  ["toExponential", "export function use(value: Value): string { return value.toExponential(); }"],
  ["toLocaleString", "export function use(value: Value): string { return value.toLocaleString(); }"],
  ["computed toFixed", "export function use(value: Value): string { return value['toFixed'](); }"],
] as const;

for (const [label, body] of stringRefusals) {
  test(`enum string boundary refuses ${label} with string-specific wording`, () => {
    const source = checked(`export enum Value { First = 1, Second = 2 } ${body}`);
    assert.equal(source.semantics.enumConstants.issues.length, 1, `${label}: one owning string projection`);
    assert.equal(source.semantics.enumConstants.issues[0]?.code, "TSONIC_ENUM_NUMERIC_USE_NOT_SUPPORTED", `${label}: shared projection code`);
    assert.equal(source.semantics.enumConstants.issues[0]?.message,
      "Enum value 'Value' is converted to a string; enum-to-string conversion is not supported yet.", `${label}: no numeric wording or native Enum.ToString substitution`);
  });
}

for (const [label, body] of [
  ["module-local String", "function String(value: Value): string { return 'named'; } export function use(value: Value): string { return String(value); }"],
  ["shadowed String", "export function use(value: Value): string { function String(input: Value): string { return 'named'; } return String(value); }"],
  ["ordinary numeric String", "export function use(value: number): string { return String(value); }"],
  ["user enum formatting function", "function format(value: Value): string { return 'named'; } export function use(value: Value): string { return format(value); }"],
  ["checked object logical result", "export function use(value: Value, object: object): string { const result = object || ~value; return String(result); }"],
] as const) {
  test(`enum string boundary preserves ${label} by actual checked call identity`, () => {
    const source = checked(`export enum Value { First = 1, Second = 2 } ${body}`);
    assert.equal(source.semantics.enumConstants.issues.length, 0, `${label}: a name or string return type is not proof of conversion`);
  });
}

test("erroneous immutable origin cycles terminate without manufacturing a native enum domain", () => {
  const source = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/index.ts": "export enum Value { First = 1 } export const first = second; export const second = first;",
  }, compilerOptions: { strict: true, target: "es2022", module: "esnext", moduleResolution: "bundler" } }).checkSource();
  assert.equal(source.diagnostics.some(issue => issue?.category === 1), true, "the checked cycle remains a source error");
  const selected = createTargetSourceProgram(source);
  assert.equal(selected.semantics.enumConstants.issues.length, 0, "cycle termination does not invent an enum value or a second diagnostic");
});

const closedUseRefusals = [
  ["written inferred numeric local", "export function use(value: Value): number { let result = ~value; result = 3; return result; }"],
  ["numeric class field", "export class Holder { value: number = Value.First; }"],
  ["numeric parameter default", "export function use(value: number = Value.First): number { return value; }"],
  ["unknown assertion chain", "export function use(value: Value): number { return value as unknown as number; }"],
  ["any assertion chain", "export function use(value: Value): number { return <number><any>value; }"],
  ["unknown local store", "export function use(value: Value): void { const result: unknown = value; }"],
  ["any local store", "export function use(value: Value): void { const result: any = value; }"],
  ["unknown destination", "function accept(value: unknown): void {} export function use(value: Value): void { accept(value); }"],
  ["object assertion destination", "export function use(value: Value): object { return value as unknown as object; }"],
  ["any destination", "function accept(value: any): void {} export function use(value: Value): void { accept(value); }"],
  ["rest any destination", "function accept(...values: any[]): void {} export function use(value: Value): void { accept(value); }"],
  ["console log", "export function use(value: Value): void { console.log(value); }"],
  ["JSON stringify", "export function use(value: Value): string { return JSON.stringify(value); }"],
  ["Number valueOf", "export function use(value: Value): number { return value.valueOf(); }"],
  ["Number method value", "export function use(value: Value): () => number { return value.valueOf; }"],
  ["unknown conditional destination", "function accept(value: unknown): void {} export function use(left: Value, right: Value, flag: boolean): void { accept(flag ? left : right); }"],
  ["unknown logical destination", "function accept(value: unknown): void {} export function use(left: Value, right: Value): void { accept(left || right); }"],
  ["unknown nullish destination", "function accept(value: unknown): void {} export function use(left: Value | undefined, right: Value): void { accept(left ?? right); }"],
  ["unknown comma destination", "function touch(): void {} function accept(value: unknown): void {} export function use(value: Value): void { accept((touch(), value)); }"],
  ["unknown wrapped destination", "function accept(value: unknown): void {} export function use(value: Value): void { accept(((value)!)); }"],
  ["mutable union without enum destination", "export function use(value: Value): number | undefined { let result: number | undefined = value; result = undefined; return result; }"],
] as const;

for (const [label, body] of closedUseRefusals) {
  test(`closed enum use refuses ${label} at one actual runtime boundary`, () => {
    const source = checked(`export enum Value { First = 1, Second = 2 } ${body}`);
    const issues = source.semantics.enumConstants.issues;
    assert.equal(issues.length, 1, `${label}: composed operands are checked once at their use, not once per branch`);
    assert.equal(issues[0]?.code, "TSONIC_ENUM_NUMERIC_USE_NOT_SUPPORTED", `${label}: shared pre-seal admission`);
    assert.equal(issues[0]?.message, "Enum value 'Value' is used as a number; enum-numeric operations are not supported yet. Use equality or bitwise operations within the same enum instead.", `${label}: no missing-fact or target-specific substitute`);
  });
}

const closedUseTwins = [
  ["written same-enum local", "export function use(value: Value): Value { let result: Value = ~value; result = value; return result; }"],
  ["same-enum class field", "export class Holder { value: Value = Value.First; }"],
  ["same-enum parameter default", "export function use(value: Value = Value.First): Value { return value; }"],
  ["same-enum assertion", "export function use(value: Value): Value { return value as Value; }"],
  ["same-enum angle assertion", "export function use(value: Value): Value { return <Value>value; }"],
  ["actual generic T", "function accept<T>(value: T): T { return value; } export function use(value: Value): Value { return accept<Value>(value); }"],
  ["enum-containing union", "function accept(value: Value | string): void {} export function use(value: Value): void { accept(value); }"],
  ["same-enum rest", "function accept(...values: Value[]): void {} export function use(value: Value): void { accept(value); }"],
  ["ordinary Number method family", "export function use(value: number): string { return value.toString() + value.toFixed() + value.toPrecision() + value.toExponential() + value.toLocaleString() + value.valueOf(); }"],
  ["ordinary dynamic destinations", "export function use(value: number): string { const stored: unknown = value; console.log(stored); return JSON.stringify(value); }"],
  ["enum type query metadata", "const value = Value.First; type Selection = typeof value; export function use(input: Selection): Selection { return input; }"],
  ["enum key metadata", "interface Named { [Value.First]: number; } export function use(value: Named): number { return value[Value.First]; }"],
  ["conditional enum destination", "function accept(value: Value): void {} export function use(left: Value, right: Value, flag: boolean): void { accept(flag ? left : right); }"],
  ["logical enum destination", "function accept(value: Value): void {} export function use(left: Value, right: Value): void { accept(left || right); }"],
  ["nullish enum destination", "function accept(value: Value): void {} export function use(left: Value | undefined, right: Value): void { accept(left ?? right); }"],
  ["comma enum destination", "function touch(): void {} function accept(value: Value): void {} export function use(value: Value): void { accept((touch(), value)); }"],
] as const;

for (const [label, body] of closedUseTwins) {
  test(`closed enum use preserves ${label} from actual checked destination evidence`, () => {
    const source = checked(`export enum Value { First = 1, Second = 2 } ${body}`);
    assert.equal(source.semantics.enumConstants.issues.length, 0, `${label}: no projection inferred from operator, callee or declaration spelling`);
  });
}

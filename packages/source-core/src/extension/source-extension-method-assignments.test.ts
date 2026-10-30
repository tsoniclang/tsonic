import assert from "node:assert/strict";
import { test } from "node:test";
import { formatDiagnostics } from "@tsonic/tsts";
import { checkSource, createSourceCoreSession, definedDiagnostics } from "./source-extension.fixtures.js";

const replacement = "const replacement = (value: number): number => value + 1;";
const method = "type Operation = { run(value: number): number }; declare const target: Operation;";

const methodWrites = [
  ["interface declaration", `${method} target.run = replacement;`],
  ["authored object method", "const target = { run(value: number): number { return value; } }; target.run = replacement;"],
  ["class declaration", "class Operation { run(value: number): number { return value; } } const target = new Operation(); target.run = replacement;"],
  ["inherited declaration", "class Base { run(value: number): number { return value; } } class Operation extends Base {} const target = new Operation(); target.run = replacement;"],
  ["literal element access", `${method} target["run"] = replacement;`],
  ["checked literal key", `${method} const key = "run"; target[key] = replacement;`],
  ["receiver alias", `${method} const alias = target; alias.run = replacement;`],
  ["rest copy", `${method} const copied = { ...target }; copied.run = replacement;`],
  ["array assignment pattern", `${method} [target.run] = [replacement];`],
  ["object assignment pattern", `${method} ({ run: target.run } = { run: replacement });`],
  ["iteration assignment", `${method} for (target.run of [replacement]) {}`],
  ["closed generic declaration", "interface Operation<Value> { run(value: Value): Value } declare const target: Operation<number>; target.run = replacement;"],
  ["constructor assignment", "class Operation { run(value: number): number { return value; } constructor() { this.run = replacement; } }"],
] as const;

for (const [label, source] of methodWrites) {
  test(`source-core refuses only the selected METHOD assignment: ${label}`, () => {
    const { session } = createSourceCoreSession(`${replacement}\n${source}`);
    const checked = checkSource(session);
    const diagnostics = definedDiagnostics(checked.diagnostics);
    assert.equal(diagnostics.length, 0, formatDiagnostics(diagnostics, "/src"));
    assert.equal(checked.extensionDiagnostics.length, 1, "one actual checked method write is refused");
    const issue = checked.extensionDiagnostics[0]!;
    assert.equal(issue.extensionCode, "TSONIC_METHOD_ASSIGNMENT_UNSUPPORTED");
    assert.equal(issue.publicCode, "TSONIC_METHOD_ASSIGNMENT_UNSUPPORTED");
    assert.equal(issue.category, "error");
    assert.equal(issue.message,
      "Cannot assign to 'run': it is declared as a method. Declare 'run: (value: number) => number' for a replaceable function property.");
    assert.equal(issue.nodeOrSpan !== undefined, true, "the original checked write owns the refusal");
  });
}

const ordinarySources = [
  ["function-typed property", "type Operation = { run: (value: number) => number }; declare const target: Operation; target.run = replacement;"],
  ["aliased function property", "type Callback = (value: number) => number; interface Operation { run: Callback } declare const target: Operation; target.run = replacement;"],
  ["class arrow property", "class Operation { run = (value: number): number => value; } const target = new Operation(); target.run = replacement;"],
  ["authored function property", "const target = { run: (value: number): number => value }; target.run = replacement;"],
  ["element function property", "type Operation = { run: (value: number) => number }; declare const target: Operation; target[\"run\"] = replacement;"],
  ["native method call and extraction", `${method} target.run(1); let callback = target.run; callback = replacement; callback(2);`],
  ["class override", "class Base { run(value: number): number { return value; } } class Derived extends Base { override run(value: number): number { return super.run(value) + 1; } } new Derived().run(2);"],
  ["same-spelled distinct property", `${method} const other = { run: replacement }; other.run = target.run;`],
  ["callable dictionary entry", "declare const target: Record<string, (value: number) => number>; target[\"run\"] = replacement;"],
  ["function-valued accessor", "class Operation { private current = replacement; get run(): (value: number) => number { return this.current; } set run(value: (value: number) => number) { this.current = value; } } const target = new Operation(); target.run = replacement;"],
] as const;

for (const [label, source] of ordinarySources) {
  test(`source-core preserves ordinary native method/property behavior: ${label}`, () => {
    const { session } = createSourceCoreSession(`${replacement}\n${source}`);
    const checked = checkSource(session);
    const diagnostics = definedDiagnostics(checked.diagnostics);
    assert.equal(diagnostics.length, 0, formatDiagnostics(diagnostics, "/src"));
    assert.equal(checked.extensionDiagnostics.length, 0, "only actual method-syntax assignment is refused");
  });
}

test("distinct method writes retain separate original diagnostic identities", () => {
  const { session } = createSourceCoreSession(`${replacement}\n${method}\ntarget.run = replacement; target["run"] = replacement;`);
  const checked = checkSource(session);
  assert.equal(definedDiagnostics(checked.diagnostics).length, 0, "the original two writes are checked");
  const issues = checked.extensionDiagnostics;
  assert.equal(issues.length, 2, "both actual writes remain visible");
  assert.equal(issues.every(issue => issue.publicCode === "TSONIC_METHOD_ASSIGNMENT_UNSUPPORTED"), true,
    "both exact writes have the one settled refusal");
  assert.equal(issues[0]!.nodeOrSpan !== issues[1]!.nodeOrSpan && issues[0]!.identity !== issues[1]!.identity, true,
    "one refusal does not hide another source write");
});

test("a finite checked index retains each actual method declaration, not a guessed property name", () => {
  const { session } = createSourceCoreSession(`${replacement}
    type Operations = { run(value: number): number; other(value: number): number };
    export function replace(target: Operations, key: "run" | "other"): void { target[key] = replacement; }
  `);
  const checked = checkSource(session);
  const diagnostics = definedDiagnostics(checked.diagnostics);
  assert.equal(diagnostics.length, 0, formatDiagnostics(diagnostics, "/src"));
  const issues = checked.extensionDiagnostics;
  assert.equal(issues.length, 2, "both exact possible METHOD destinations are refused");
  assert.equal(issues.every(issue => issue.publicCode === "TSONIC_METHOD_ASSIGNMENT_UNSUPPORTED"), true);
  assert.deepEqual(issues.map(issue => issue.message).sort(), ["other", "run"].map(name =>
    `Cannot assign to '${name}': it is declared as a method. Declare '${name}: (value: number) => number' for a replaceable function property.`));
  assert.equal(issues[0]!.nodeOrSpan === issues[1]!.nodeOrSpan && issues[0]!.identity !== issues[1]!.identity, true,
    "one indexed write retains both actual declaration subjects");
});

test("a finite checked function-PROPERTY index remains replaceable", () => {
  const { session } = createSourceCoreSession(`${replacement}
    type Operations = { run: (value: number) => number; other: (value: number) => number };
    export function replace(target: Operations, key: "run" | "other"): void { target[key] = replacement; }
  `);
  const checked = checkSource(session);
  const diagnostics = definedDiagnostics(checked.diagnostics);
  assert.equal(diagnostics.length, 0, formatDiagnostics(diagnostics, "/src"));
  assert.equal(checked.extensionDiagnostics.length, 0, "finite indexing does not turn function properties into METHOD declarations");
});

test("mixed finite indexing refuses its exact METHOD and retains the distinct function-PROPERTY role", () => {
  const { session } = createSourceCoreSession(`${replacement}
    type Operations = { run(value: number): number; callback: (value: number) => number };
    export function replace(target: Operations, key: "run" | "callback"): void { target[key] = replacement; }
  `);
  const checked = checkSource(session);
  const diagnostics = definedDiagnostics(checked.diagnostics);
  assert.equal(diagnostics.length, 0, formatDiagnostics(diagnostics, "/src"));
  const issues = checked.extensionDiagnostics;
  assert.equal(issues.length, 1, "the property role is not converted into a METHOD by its union peer");
  assert.equal(issues[0]!.publicCode, "TSONIC_METHOD_ASSIGNMENT_UNSUPPORTED");
  assert.equal(issues[0]!.message,
    "Cannot assign to 'run': it is declared as a method. Declare 'run: (value: number) => number' for a replaceable function property.");
});

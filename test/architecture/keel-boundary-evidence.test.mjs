import assert from "node:assert/strict";
import test from "node:test";
import { analyzeKeelTypeScript } from "./tooling/keel-source-analysis.mjs";
import { evaluateKeelLayers } from "./tooling/keel-layer-checks.mjs";
import { keelFixtureHas, keelFixtureModel, keelFixtureReview } from "./tooling/keel-test-fixtures.mjs";

for (const repo of ["tsonic-csharp", "tsonic-rust"]) {
  for (const [label, expression, expected] of [
    ["direct push", "context.diagnostics.push(value)", true],
    ["collection alias", "const errors = context.diagnostics; errors.push(value)", true],
    ["method alias", "const append = context.diagnostics.push; append(value)", true],
    ["ordinary array", "const values: number[] = []; values.push(1)", false],
  ]) {
    test(`${repo}: exact diagnostics collection ownership survives ${label}`, () => {
      const file = "src/backend/planner/expressions/plan.ts";
      const types = "src/target-model/records/diagnostics.ts";
      const model = keelFixtureModel([
        [types, "export interface Diagnostic { code: string; } export interface Context { diagnostics: Diagnostic[]; }"],
        [file, `import type { Context, Diagnostic } from "../../../target-model/records/diagnostics.js"; export function plan(context: Context, value: Diagnostic): void { ${expression}; }`],
      ]);
      assert.equal(model.calls.some(call => call.target?.file === "libraries/lib.es5.d.ts" && call.target.symbol === "Array.push"), true);
      assert.equal(keelFixtureHas(evaluateKeelLayers(repo, model, {
        diagnosticSinks: [{ file: types, symbol: "Context.diagnostics" }],
      }), "AC4"), expected);
    });
  }

  for (const [label, expression] of [
    ["mutable inferred alias", "let errors = context.diagnostics; errors.push(value)"],
    ["destructured alias", "const { diagnostics: errors } = context; errors.push(value)"],
    ["parameterized collection alias", "const errors: Array<Diagnostic> = context.diagnostics; errors.push(value)"],
  ]) test(`${repo}: diagnostic receiver types retain exact ownership through ${label}`, () => {
    const file = "src/backend/planner/expressions/plan.ts";
    const types = "src/target-model/records/diagnostics.ts";
    const model = keelFixtureModel([
      [types, "export interface Diagnostic { code: string; } export interface Context { diagnostics: Diagnostic[]; }"],
      [file, `import type { Context, Diagnostic } from "../../../target-model/records/diagnostics.js"; export function plan(context: Context, value: Diagnostic): void { ${expression}; }`],
    ]);
    assert.equal(keelFixtureHas(evaluateKeelLayers(repo, model, {
      diagnosticCodeFields: [{ file: types, symbol: "Diagnostic.code" }],
    }), "AC4", "diagnostic sink"), true);
  });

  test(`${repo}: sensitive boundaries cannot disappear behind missing external type declarations`, () => {
    const file = "src/backend/planner/expressions/plan.ts";
    const model = keelFixtureModel([[file,
      'import type { MissingRecords as RemoteRecords } from "@missing/records"; export function plan(records: RemoteRecords): number { return records.get(1); }',
    ]]);
    const functions = [keelFixtureReview(model, file, "plan", "syntax")];
    const findings = evaluateKeelLayers(repo, model, {
      functions, externalBoundaryTypes: [{ file, symbol: "RemoteRecords", kind: "records" }],
    });
    assert.equal(keelFixtureHas(findings, "AC3", "no exact checked"), true);
  });

  test(`${repo}: exact supplied external declarations resolve sensitive interface members`, () => {
    const file = "src/backend/planner/expressions/plan.ts";
    const declaration = "external/records.d.ts";
    const model = analyzeKeelTypeScript(new Map([[file,
      'import type { Records } from "@external/records"; export function plan(records: Records): number { return records.get(1); }',
    ]]), {
      declarationFiles: new Map([[declaration, "export interface Records { get(subject: number): number; }"]]),
      modulePaths: { "@external/records": [declaration] },
    });
    assert.equal(model.calls.some(call => call.target?.file === declaration && call.target.symbol === "Records.get"), true);
    assert.equal(evaluateKeelLayers(repo, model, {
      recordReaders: [{ file: declaration, symbol: "Records.get" }],
      externalBoundaryTypes: [{ file, symbol: "Records", kind: "records" }],
    }).length, 0);
  });

  test(`${repo}: unresolved diagnostic types and member aliases fail closed without condemning ordinary calls`, () => {
    const file = "src/backend/planner/expressions/plan.ts";
    const model = keelFixtureModel([[file,
      'import type { MissingDiagnosticContext as RemoteContext } from "@missing/diagnostics"; declare function ordinary(value: number): number; export function plan(context: RemoteContext): number { const errors = context.errors; errors.push({ code: "REJECT" }); return ordinary(1); }',
    ]]);
    const findings = evaluateKeelLayers(repo, model, {
      externalBoundaryTypes: [{ file, symbol: "RemoteContext", kind: "diagnostics" }],
    });
    assert.equal(keelFixtureHas(findings, "AC4", "unresolved collection method"), true);
    const ordinary = keelFixtureModel([[file, "declare function ordinary(value: number): number; export function plan(value: number): number { return ordinary(value); }"]]);
    assert.equal(evaluateKeelLayers(repo, ordinary).length, 0);
  });

  test(`${repo}: sealed analysis interface readers are not guessed to be lazy by their location`, () => {
    const index = "src/analysis/program/ownership.ts";
    const planner = "src/backend/planner/expressions/plan.ts";
    const entries = [
      [index, "export interface LifetimePlan { canMove(reference: number): boolean; }"],
      [planner, 'import type { LifetimePlan } from "../../../analysis/program/ownership.js"; export function plan(lifetimes: LifetimePlan, reference: number): boolean { return lifetimes.canMove(reference); }'],
    ];
    const model = keelFixtureModel(entries);
    const contract = { recordReaders: [{ file: index, symbol: "LifetimePlan.canMove" }] };
    assert.equal(evaluateKeelLayers(repo, model, contract).length, 0);
    assert.equal(keelFixtureHas(evaluateKeelLayers(repo, model), "AC2", "no exact sealed-reader"), true);
  });

  test(`${repo}: pure policy-context delegation is a port, not a second semantic owner`, () => {
    const port = "src/policy/model/read.ts";
    const schema = "src/target-model/records/reader.ts";
    const model = keelFixtureModel([
      [schema, "export interface Reader { get(subject: number): number; }"],
      [port, 'import type { Reader } from "../../target-model/records/reader.js"; export function read(records: Reader, subject: number): number { return records.get(subject); }'],
    ]);
    const functions = [keelFixtureReview(model, port, "read", "sealed-reader")];
    assert.equal(evaluateKeelLayers(repo, model, { functions }).length, 0);
    const changed = keelFixtureModel([
      [schema, "export interface Reader { get(subject: number): number; }"],
      [port, 'import type { Reader } from "../../target-model/records/reader.js"; export function read(records: Reader, subject: number): number { subject += 1; return records.get(subject); }'],
    ]);
    assert.equal(keelFixtureHas(evaluateKeelLayers(repo, changed, {
      functions: [keelFixtureReview(changed, port, "read", "sealed-reader")],
    }), "AC3", "cannot compute"), true);
  });

  test(`${repo}: contextual diagnostic construction is checked by exact diagnostic vocabulary`, () => {
    const file = "src/backend/planner/expressions/plan.ts";
    const types = "src/target-model/records/diagnostics.ts";
    const model = keelFixtureModel([
      [types, "export interface Diagnostic { readonly code: string; readonly message: string; }"],
      [file, 'import type { Diagnostic } from "../../../target-model/records/diagnostics.js"; export function plan(value: string): Diagnostic { return { code: "SOURCE_REJECTION", message: value }; }'],
    ]);
    const findings = evaluateKeelLayers(repo, model, {
      diagnosticCodeFields: [{ file: types, symbol: "Diagnostic.code" }],
    });
    assert.equal(keelFixtureHas(findings, "AC4", "fixed internal-invariant"), true);
  });

  test(`${repo}: diagnostic collection types are acquired through aliased declarations, not field names`, () => {
    const file = "src/backend/planner/expressions/plan.ts";
    const types = "src/target-model/records/diagnostics.ts";
    const model = keelFixtureModel([
      [types, "export interface Diagnostic { readonly code: string; }"],
      [file, 'import type { Diagnostic as Failure } from "../../../target-model/records/diagnostics.js"; interface Context { notices: Failure[]; } export function plan(context: Context, value: Failure): void { context.notices.push(value); }'],
    ]);
    assert.equal(keelFixtureHas(evaluateKeelLayers(repo, model, {
      diagnosticCodeFields: [{ file: types, symbol: "Diagnostic.code" }],
    }), "AC4", "diagnostic sink"), true);
  });
}

test("Rust clone-inspection evidence fails closed for an unresolved imported native AST type", () => {
  const file = "src/backend/planner/expressions/plan.ts";
  const model = keelFixtureModel([[file,
    'import type { MissingExpression as NativeExpression } from "@missing/ast"; export function plan(expression: NativeExpression): boolean { return expression.method === "clone"; }',
  ]]);
  assert.equal(keelFixtureHas(evaluateKeelLayers("tsonic-rust", model, {
    externalBoundaryTypes: [{ file, symbol: "NativeExpression", kind: "syntax" }],
  }), "AC5", "missing native AST"), true);
});

test("standard generic containers retain exact compiler declarations", () => {
  const file = "src/analysis/program/records/store.ts";
  const model = keelFixtureModel([[file,
    "export function read(values: WeakMap<object, number>, key: object): number | undefined { return values.get(key); }",
  ]]);
  assert.equal(model.calls.some(call => call.target?.file === "libraries/lib.es2015.collection.d.ts" && call.target.symbol === "WeakMap.get"), true);
});

test("anonymous callable and accessor evidence has exact noncompeting authored owners", () => {
  const file = "src/policy/types/selected.ts";
  const model = keelFixtureModel([[file,
    `export function select(values: number[]): number[] {
      return values.map(value => { for (const item of [value]) { if (item < 0) return 0; } return value; })
        .filter(value => { for (const item of [value]) { if (item === 0) return false; } return true; });
    }
    export const bound = ((value: number): number => value);
    export class Holder { get value(): number { return 0; } set value(value: number) {} }`,
  ]]);
  const functions = model.functions.filter(entry => entry.file === file);
  assert.equal(new Set(functions.map(entry => entry.symbol)).size, functions.length,
    "distinct authored callable bodies never share a proof identity");
  assert.equal(functions.filter(entry => entry.symbol === "select").length, 1);
  assert.equal(functions.filter(entry => entry.symbol === "bound").length, 1,
    "transparent syntax retains the exact named binding");
  assert.equal(new Set(model.loops.filter(loop => loop.file === file).map(loop => loop.owner)).size, 2,
    "each callback traversal belongs to its actual callable, not the enclosing selector");
  assert.equal(functions.some(entry => entry.symbol === "Holder.value.<get>"), true);
  assert.equal(functions.some(entry => entry.symbol === "Holder.value.<set>"), true);
});

for (const repo of ["tsonic-csharp", "tsonic-rust"]) {
  test(`${repo}: immutable function-property readers and analysis-only writers retain checked ownership`, () => {
    const schema = "src/target-model/records/program.ts";
    const planner = "src/backend/planner/expressions/plan.ts";
    const model = keelFixtureModel([
      [schema, "export interface Reader { readonly get: (subject: number) => number; } export interface Writer extends Reader { readonly set: (subject: number, value: number) => void; }"],
      [planner, 'import type { Reader, Writer } from "../../../target-model/records/program.js"; export function plan(reader: Reader, writer: Writer): number { writer.set(1, 2); return reader.get(1); }'],
    ]);
    assert.equal(model.declarations.some(entry => entry.file === schema && entry.symbol === "Reader.get" && entry.functionProperty), true);
    const findings = evaluateKeelLayers(repo, model);
    const writes = findings.filter(entry => entry.check === "AC3");
    assert.equal(writes.length, 2, "both taking the writer and invoking it violate the same ownership boundary");
    assert.equal(writes.every(entry => entry.reason.includes("Only analysis") && entry.evidence.target === `${schema}#Writer.set`), true);
  });
}

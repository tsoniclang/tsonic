import assert from "node:assert/strict";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "../../packages/tsts/dist/src/index.js";
import { evaluateKeelLayers } from "./tooling/keel-layer-checks.mjs";
import { readKeelDeclarations } from "./tooling/keel-declarations.mjs";
import { readSourceInventory } from "./tooling/file-inventory.mjs";
import { analyzeKeelTypeScript } from "./tooling/keel-source-analysis.mjs";
import {
  keelFixtureHas, keelFixtureModel, keelFixtureReference, keelFixtureReview,
} from "./tooling/keel-test-fixtures.mjs";
import { publicMetadataInputs, checkedMetadataFixture } from './keel-layer-checks-fixtures.mjs';

for (const repo of ["tsonic-csharp"]){
for (const [name, imports, expression, extra] of [
    ["import alias", 'import { chooseCarrier as invoke } from "../../../policy/types/select.js";', "invoke(value)", []],
    ["namespace import", 'import * as policy from "../../../policy/types/select.js";', "policy.chooseCarrier(value)", []],
    ["local alias", 'import { chooseCarrier } from "../../../policy/types/select.js"; const invoke = chooseCarrier;', "invoke(value)", []],
    ["re-export", 'import { invoke } from "../../../policy/types/barrel.js";', "invoke(value)", [["src/policy/types/barrel.ts", 'export { chooseCarrier as invoke } from "./select.js";']]],
  ]){
test(`${repo}: AC2 follows the exact selected declaration through ${name}`, () => {
      const policy = "src/policy/types/select.ts";
      const planner = "src/backend/planner/expressions/plan.ts";
      const model = keelFixtureModel([
        [policy, "export function chooseCarrier(value: number): number { return value; }"],
        [planner, `${imports} export function plan(value: number): number { return ${expression}; }`],
        ...extra,
      ]);
      const functions = [
        keelFixtureReview(model, policy, "chooseCarrier", "selection"),
        keelFixtureReview(model, planner, "plan", "syntax"),
      ];
      assert.equal(model.calls.some(call => call.file === planner && call.target?.file === policy && call.target.symbol === "chooseCarrier"), true, name);
      assert.equal(keelFixtureHas(evaluateKeelLayers(repo, model, { functions }), "AC2", "sealed records"), true);
    });
}
}

for (const repo of ["tsonic-csharp"]){
test(`${repo}: AC2 rejects a renamed selection but does not guess from a shadowed binding`, () => {
    const file = "src/backend/planner/expressions/plan.ts";
    const model = keelFixtureModel([[file, "export function innocentName(value: number): number { return value; } export function plan(chooseCarrier: (value: number) => number): number { return chooseCarrier(1); }"]]);
    const functions = [
      keelFixtureReview(model, file, "innocentName", "selection"),
      keelFixtureReview(model, file, "plan", "syntax"),
    ];
    assert.equal(keelFixtureHas(evaluateKeelLayers(repo, model, { functions }), "AC2", "Per-construct"), true);
    functions[0] = { ...functions[0], role: "syntax" };
    assert.equal(evaluateKeelLayers(repo, model, { functions }).length, 0);
  });
}

for (const repo of ["tsonic-csharp"]){
test(`${repo}: AC2 distinguishes lazy analysis from a sealed reader`, () => {
    const compute = "src/analysis/storage/compute.ts";
    const reader = "src/analysis/program/records/read.ts";
    const planner = "src/backend/planner/expressions/plan.ts";
    const model = keelFixtureModel([
      [compute, "export function query(value: number): number { return value; }"],
      [reader, "export function read(value: number): number { return value; }"],
      [planner, 'import { query } from "../../../analysis/storage/compute.js"; import { read } from "../../../analysis/program/records/read.js"; export function plan(value: number): number { return query(read(value)); }'],
    ]);
    const functions = [
      keelFixtureReview(model, compute, "query", "analysis"),
      keelFixtureReview(model, reader, "read", "sealed-reader"),
      keelFixtureReview(model, planner, "plan", "syntax"),
    ];
    const findings = evaluateKeelLayers(repo, model, { functions, lazyQueries: [keelFixtureReference(compute, "query")] });
    assert.equal(findings.filter(entry => entry.check === "AC2" && entry.reason.includes("lazy analysis")).length, 1);
    assert.equal(keelFixtureHas(findings, "AC3"), false);
  });
}

for (const repo of ["tsonic-csharp"]){
test(`${repo}: AC3 permits private typed storage and rejects cross-layer reads and writes`, () => {
    const records = "src/analysis/program/records/store.ts";
    const planner = "src/backend/planner/expressions/plan.ts";
    const model = keelFixtureModel([
      [records, "export interface Keyed { getFact(subject: number): number; } export interface Writer { set(subject: number, value: number): void; } export function read(store: Keyed): number { return store.getFact(1); }"],
      [planner, 'import type { Keyed, Writer } from "../../../analysis/program/records/store.js"; export function plan(store: Keyed, writer: Writer): number { writer.set(1, 2); return store.getFact(1); }'],
    ]);
    const functions = [
      keelFixtureReview(model, records, "read", "sealed-reader"),
      keelFixtureReview(model, planner, "plan", "syntax"),
    ];
    const findings = evaluateKeelLayers(repo, model, {
      functions, keyReaders: [keelFixtureReference(records, "Keyed.getFact")],
      recordWriters: [keelFixtureReference(records, "Writer.set")],
    });
    assert.equal(findings.filter(entry => entry.check === "AC3").length, 4);
    assert.equal(findings.filter(entry => entry.check === "AC3").every(entry => entry.file === planner), true);
  });
}

for (const repo of ["tsonic-csharp"]){
test(`${repo}: AC3 does not confuse a homonymous method with the keyed API`, () => {
    const records = "src/analysis/program/records/store.ts";
    const planner = "src/backend/planner/expressions/plan.ts";
    const model = keelFixtureModel([
      [records, "export interface Keyed { getFact(subject: number): number; }"],
      [planner, "interface Other { getFact(subject: number): number; } export function plan(value: Other): number { return value.getFact(1); }"],
    ]);
    const findings = evaluateKeelLayers(repo, model, {
      functions: [keelFixtureReview(model, planner, "plan", "syntax")],
      keyReaders: [keelFixtureReference(records, "Keyed.getFact")],
    });
    assert.equal(findings.length, 0);
  });
}

for (const repo of ["tsonic-csharp"]){
test(`${repo}: AC4 permits one registered invariant owner, not ordinary planner rejections`, () => {
    const producer = "src/analysis/program/rejections.ts";
    const helper = "src/backend/planner/diagnostics.ts";
    const planner = "src/backend/planner/expressions/plan.ts";
    const model = keelFixtureModel([
      [producer, "export function diagnostic(code: string): string { return code; }"],
      [helper, 'import { diagnostic } from "../../analysis/program/rejections.js"; export function invariant(code: string): never { throw diagnostic(code); }'],
      [planner, 'import { diagnostic } from "../../../analysis/program/rejections.js"; export function plan(value: string): string { return diagnostic(value); }'],
    ]);
    const functions = [
      keelFixtureReview(model, producer, "diagnostic", "analysis"),
      keelFixtureReview(model, helper, "invariant", "planner-invariant"),
      keelFixtureReview(model, planner, "plan", "syntax"),
    ];
    const findings = evaluateKeelLayers(repo, model, {
      functions, diagnosticCalls: [keelFixtureReference(producer, "diagnostic")],
      invariantHelpers: [keelFixtureReference(helper, "invariant")],
    });
    assert.equal(keelFixtureHas(findings, "AC4"), true);
    assert.equal(findings.filter(entry => entry.check === "AC4").every(entry => entry.file === planner), true);
  });
}

for (const repo of ["tsonic-csharp"]){
test(`${repo}: AC4 checks the selected receiver, not diagnostic siblings in an aggregate context`, () => {
    const types = "src/target-model/records/provenance.ts";
    const planner = "src/backend/planner/program/worker-entries.ts";
    const model = keelFixtureModel([
      [types, "export interface Diagnostic { code: string; } export interface AstReader { getFileName(source: number): string; } export interface Registry { targets(): readonly number[]; }"],
      [planner, `import type { AstReader, Diagnostic, Registry } from "../../../target-model/records/provenance.js";
        export function direct(context: { ast: AstReader; diagnostics: Diagnostic[] }): string {
          return context.ast.getFileName(1);
        }
        export function nested(context: { planning: { source: { ast: AstReader } }; diagnostics: Diagnostic[] }): string {
          return context.planning.source.ast.getFileName(1);
        }
        export function readerAlias(context: { ast: AstReader; diagnostics: Diagnostic[] }): string {
          const reader = context.ast; return reader.getFileName(1);
        }
        export function contextAlias(context: { ast: AstReader; diagnostics: Diagnostic[] }): string {
          const copy = context; return copy.ast.getFileName(1);
        }
        export function destructured(context: { ast: AstReader; diagnostics: Diagnostic[] }): string {
          const { ast: reader } = context; return reader.getFileName(1);
        }
        export function element(context: { ast: AstReader; diagnostics: Diagnostic[] }): string {
          return context["ast"]["getFileName"](1);
        }
        export function callback(context: { ast: AstReader; sources: readonly number[]; diagnostics: Diagnostic[] }): string[] {
          return context.sources.map(source => context.ast.getFileName(source));
        }
        export function collection(context: { values: ReadonlyMap<number, string>; diagnostics: Diagnostic[] }): string | undefined {
          return context.values.get(1);
        }
        export function registry(context: { registry: Registry; diagnostics: Diagnostic[] }): readonly number[] {
          return context.registry.targets();
        }
        export function colocated(context: { read(source: number): string; diagnostics: Diagnostic[] }): string {
          return context.read(1);
        }
        export function functionProperty(context: { read: (source: Diagnostic) => string; diagnostics: Diagnostic[] }, value: Diagnostic): string {
          return context.read(value);
        }`],
    ]);
    const calls = model.calls.filter(call => call.target?.file === types && call.target.symbol === "AstReader.getFileName");
    assert.equal(calls.length, 7, "every ordinary call has the exact checked AST-reader declaration");
    assert.equal(calls.find(call => call.owner === "direct").through.some(reference => reference.file === types && reference.symbol === "Diagnostic"), true,
      "aggregate evidence remains available to record and syntax boundary checks");
    assert.equal(calls.every(call => call.receiverThrough.every(reference => reference.file !== types || reference.symbol !== "Diagnostic")), true,
      "the exact AST reader never inherits a sibling diagnostic collection");
    assert.equal(evaluateKeelLayers(repo, model, {
      diagnosticCodeFields: [keelFixtureReference(types, "Diagnostic.code")],
    }).filter(finding => finding.check === "AC4").length, 0);
  });
}

for (const repo of ["tsonic-csharp"]){
test(`${repo}: AC4 requires current checked receiver evidence rather than falling back to aggregate guesses`, () => {
    const planner = "src/backend/planner/expressions/plan.ts";
    const model = keelFixtureModel([[planner,
      "interface State { readonly count: number; } export function plan(values: number[]): void { values.push(1); }",
    ]]);
    for (const field of ["calls", "accesses", "typedDeclarations"]) {
      const incomplete = model[field].map(({ receiverThrough, ...entry }) => entry);
      assert.throws(() => evaluateKeelLayers(repo, { ...model, [field]: incomplete }), /requires checked receiver provenance/u, field);
    }
  });
}

for (const repo of ["tsonic-csharp"]){
for (const [label, expression] of [
    ["direct receiver", "context.diagnostics.push(value)"],
    ["inferred alias", "const errors = context.diagnostics; errors.push(value)"],
    ["mutable alias", "let errors = context.diagnostics; errors.push(value)"],
    ["destructured alias", "const { diagnostics: errors } = context; errors.push(value)"],
    ["method alias", "const append = context.diagnostics.push; append(value)"],
    ["element access", 'context["diagnostics"]["push"](value)'],
    ["bound method", "const append = context.diagnostics.push.bind(context.diagnostics); append(value)"],
    ["unresolved method", "context.diagnostics.missing(value)"],
    ["non-null receiver", "context.diagnostics!.push(value)"],
  ]){
test(`${repo}: AC4 retains exact diagnostic collection ownership through ${label}`, () => {
    const types = "src/target-model/records/provenance.ts";
    const planner = "src/backend/planner/expressions/plan.ts";
    const model = keelFixtureModel([
      [types, "export interface Diagnostic { code: string; } export interface Context { diagnostics: Diagnostic[]; }"],
      [planner, `import type { Context, Diagnostic } from "../../../target-model/records/provenance.js";
        export function plan(context: Context, value: Diagnostic): void { ${expression}; }`],
    ]);
    for (const vocabulary of [
      { diagnosticSinks: [keelFixtureReference(types, "Context.diagnostics")] },
      { diagnosticCodeFields: [keelFixtureReference(types, "Diagnostic.code")] },
    ]) {
      assert.equal(keelFixtureHas(evaluateKeelLayers(repo, model, vocabulary), "AC4", "diagnostic sink"), true, label);
    }
  });
}
}

for (const repo of ["tsonic-csharp"]){
for (const [label, annotation, expression] of [
    ["missing context", "RemoteContext", 'context.errors.push({ code: "REJECT" })'],
    ["missing collection alias", "RemoteContext", 'const errors = context.errors; errors.push({ code: "REJECT" })'],
    ["nullable missing context", "RemoteContext | null", 'context!.errors.push({ code: "REJECT" })'],
    ["missing member type", "{ errors: RemoteContext[] }", 'context.errors.push({ code: "REJECT" })'],
  ]){
test(`${repo}: AC4 fails closed for ${label} provenance`, () => {
    const planner = "src/backend/planner/expressions/plan.ts";
    const model = keelFixtureModel([[planner,
      `import type { MissingContext as RemoteContext } from "@missing/diagnostics";
        export function plan(context: ${annotation}): void { ${expression}; }`,
    ]]);
    assert.equal(keelFixtureHas(evaluateKeelLayers(repo, model, {
      externalBoundaryTypes: [{ file: planner, symbol: "RemoteContext", kind: "diagnostics" }],
    }), "AC4", "unresolved collection method"), true);
  });
}
}

for (const repo of ["tsonic-csharp"]){
test(`${repo}: AC4 receiver precision preserves unresolved aggregate record-boundary evidence`, () => {
    const planner = "src/backend/planner/expressions/plan.ts";
    const model = keelFixtureModel([[planner,
      'import type { MissingRecords as RemoteRecords } from "@missing/records"; export function plan(context: { records: RemoteRecords; diagnostics: string[] }): number { const record = context.records; return record.get(1); }',
    ]]);
    const call = model.calls.find(entry => entry.kind === "call");
    assert.equal(call !== undefined, true);
    assert.equal(call.through.some(reference => reference.file === planner && reference.symbol === "RemoteRecords"), true);
    assert.equal(keelFixtureHas(evaluateKeelLayers(repo, model, {
      externalBoundaryTypes: [{ file: planner, symbol: "RemoteRecords", kind: "records" }],
    }), "AC3", "no exact checked declaration"), true);
  });
}

for (const repo of ["tsonic-csharp"]){
test(`${repo}: AC6 approves only a reviewed local traversal and detects body changes`, () => {
    const file = "src/policy/types/local.ts";
    const source = "export function chooseCarrier(values: number[]): number { let result = 0; for (const value of values) result += value; return result; }";
    const model = keelFixtureModel([[file, source]]);
    const loop = model.loops[0];
    const functions = [keelFixtureReview(model, file, "chooseCarrier", "selection")];
    const localTraversals = [{
      file, symbol: "chooseCarrier", offset: loop.offset, bodySha256: loop.bodySha256,
      subjectParameter: "values", reason: "Only the current construct's parameter array is visited.",
    }];
    assert.equal(keelFixtureHas(evaluateKeelLayers(repo, model, { functions }), "AC6"), true);
    assert.equal(evaluateKeelLayers(repo, model, { functions, localTraversals }).length, 0);
    const changed = keelFixtureModel([[file, source.replace("result += value", "result += value * 2")]]);
    assert.equal(keelFixtureHas(evaluateKeelLayers(repo, changed, { functions, localTraversals }), "AC6"), true);
    assert.equal(keelFixtureHas(evaluateKeelLayers(repo, model, { functions, localTraversals: [{ ...localTraversals[0], subjectParameter: "program" }] }), "AC6"), true);
  });
}

import assert from "node:assert/strict";
import test from "node:test";
import { evaluateKeelLayers } from "./tooling/keel-layer-checks.mjs";
import {
  keelFixtureHas, keelFixtureModel, keelFixtureReference, keelFixtureReview,
} from "./tooling/keel-test-fixtures.mjs";

for (const repo of ["tsonic-csharp", "tsonic-rust"]) {
  test(`${repo}: AC1 distinguishes a native selection from same-named cross-construct analysis`, () => {
    const policy = "src/policy/types/select.ts";
    const analysis = "src/analysis/storage/select.ts";
    const model = keelFixtureModel([
      [policy, "export function chooseCarrier(value: number): number { return value; }"],
      [analysis, "export function selectCaptures(values: number[]): number { let count = 0; for (const value of values) count += value; return count; }"],
    ]);
    const functions = [
      keelFixtureReview(model, policy, "chooseCarrier", "selection"),
      keelFixtureReview(model, analysis, "selectCaptures", "analysis"),
    ];
    assert.equal(evaluateKeelLayers(repo, model, { functions }).length, 0);
    assert.equal(evaluateKeelLayers(repo, model).length, 0);
    functions[1] = { ...functions[1], role: "selection" };
    assert.equal(keelFixtureHas(evaluateKeelLayers(repo, model, { functions }), "AC1", "owned by policy"), true);
  });

  test(`${repo}: AC1 fails closed on stale or invented classification evidence`, () => {
    const file = "src/policy/types/select.ts";
    const model = keelFixtureModel([[file, "export function chooseCarrier(value: number): number { return value; }"]]);
    const valid = keelFixtureReview(model, file, "chooseCarrier", "selection");
    for (const invalid of [
      { ...valid, bodySha256: "a".repeat(64) },
      { ...valid, evidence: [{ kind: "parameter", name: "invented" }] },
      { ...valid, evidence: [{ kind: "import", file: "src/analysis/missing.ts" }] },
    ]) assert.equal(keelFixtureHas(evaluateKeelLayers(repo, model, { functions: [invalid] }), "AC1"), true);
    assert.throws(() => evaluateKeelLayers(repo, model, { functions: [valid, valid] }), /duplicate/u);
    assert.throws(() => evaluateKeelLayers(repo, model, { functions: [{ ...valid, file: "src/*" }] }), /exact/u);
  });

  for (const [name, imports, expression, extra] of [
    ["import alias", 'import { chooseCarrier as invoke } from "../../../policy/types/select.js";', "invoke(value)", []],
    ["namespace import", 'import * as policy from "../../../policy/types/select.js";', "policy.chooseCarrier(value)", []],
    ["local alias", 'import { chooseCarrier } from "../../../policy/types/select.js"; const invoke = chooseCarrier;', "invoke(value)", []],
    ["re-export", 'import { invoke } from "../../../policy/types/barrel.js";', "invoke(value)", [["src/policy/types/barrel.ts", 'export { chooseCarrier as invoke } from "./select.js";']]],
  ]) {
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

test("Rust AC5 detects inspection of the checked native AST clone field, not construction or homonyms", () => {
  const syntax = "src/backend/target-ast/syntax/nodes.ts";
  const planner = "src/backend/planner/expressions/plan.ts";
  const model = keelFixtureModel([
    [syntax, "export interface RustMethod { readonly method: string; }"],
    [planner, 'import type { RustMethod } from "../../target-ast/syntax/nodes.js"; interface Other { readonly method: string; } export function plan(value: RustMethod): boolean { return value.method === "clone"; } export function construct(value: string): RustMethod { return { method: "clone" }; } export function other(value: Other): boolean { return value.method === "clone"; }'],
  ]);
  const functions = ["plan", "construct", "other"].map(symbol => keelFixtureReview(model, planner, symbol, "syntax"));
  const findings = evaluateKeelLayers("tsonic-rust", model, {
    functions, cloneFields: [keelFixtureReference(syntax, "RustMethod.method")],
  });
  assert.equal(findings.filter(entry => entry.check === "AC5").length, 1);
  assert.equal(findings.find(entry => entry.check === "AC5")?.subject === "plan", true);
});

test("Rust AC5 preserves clone-field provenance through switch inspection rather than only binary equality", () => {
  const syntax = "src/backend/target-ast/syntax/nodes.ts";
  const planner = "src/backend/planner/expressions/plan.ts";
  const model = keelFixtureModel([
    [syntax, "export interface RustMethod { readonly method: string; }"],
    [planner, 'import type { RustMethod } from "../../target-ast/syntax/nodes.js"; export function plan(value: RustMethod): boolean { switch (value.method) { case "clone": return true; default: return false; } }'],
  ]);
  assert.equal(evaluateKeelLayers("tsonic-rust", model, {
    cloneFields: [keelFixtureReference(syntax, "RustMethod.method")],
  }).filter(row => row.check === "AC5").length, 1);
});

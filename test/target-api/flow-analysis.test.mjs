import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createTargetSourceProgram } from "../../packages/target-api/dist/public/source.js";
import * as publicAnalysis from "../../packages/target-api/dist/public/analysis.js";
import { createSourceControlFlow, createSourceControlFlowDomain, solveSourceFlow, analyzeSourceLiveness, analyzeSourceDefiniteAssignment,
  analyzeSourceWrites } from "../../packages/target-api/dist/target-analysis/flow/index.js";
import { checkedSource, namedDeclaration, namedVariable, projectSourceFile } from "../fixtures/source-navigation.mjs";
import { createSourceFlowCaptureQuery } from "../../packages/target-api/dist/target-analysis/flow/captures.js";

test("the public flow port exports the identical canonical graph and solver owners", () => {
  for (const [name, owner] of Object.entries({ createSourceControlFlow, createSourceControlFlowDomain, solveSourceFlow, analyzeSourceLiveness,
    analyzeSourceDefiniteAssignment, analyzeSourceWrites })) {
    assert.equal(publicAnalysis[name] === owner, true, name);
  }
});

let caseNumber = 0;
async function fixture(text, name = "run") {
  const source = createTargetSourceProgram(await checkedSource(`flow-analysis-${caseNumber++}`, { "src/index.ts": text }));
  const file = projectSourceFile(source, "src/index.ts");
  const selection = createSourceControlFlow(source, namedDeclaration(source.ast, file, name), { domain: { kind: "source" } });
  assert.equal(selection.kind, "resolved", selection.kind === "unresolved" ? selection.reason : "resolved");
  return { source, ast: source.ast, graph: selection.graph, file };
}
function resolved(selection) {
  assert.equal(selection.kind, "resolved", selection.kind === "unresolved" ? selection.reason : "resolved");
  return selection;
}
function reads(current, name) {
  return current.graph.points.filter(point => point.operation.kind === "read" && current.ast.text(point.source) === name)
    .sort((left, right) => current.ast.pos(left.source) - current.ast.pos(right.source));
}

test("flow liveness identifies last reads rather than last syntactic positions", async () => {
  const current = await fixture("function use(value: number) {} function run(value: number, flag: boolean) { if (flag) use(value); else use(value); }");
  const live = resolved(analyzeSourceLiveness(current.graph));
  const uses = reads(current, "value");
  assert.equal(uses.length, 2);
  for (const use of uses) assert.equal(live.lastUses.has(use.source), true);
  const sequential = await fixture("function run(value: number) { return value + value; }");
  const sequentialLive = resolved(analyzeSourceLiveness(sequential.graph));
  const both = reads(sequential, "value");
  assert.equal(sequentialLive.lastUses.has(both[0].source), false);
  assert.equal(sequentialLive.lastUses.has(both[1].source), true);
});

test("flow liveness includes captures and kills prior values at binding writes", async () => {
  const current = await fixture("function use(value: number) {} function run(value: number) { use(value); value = 2; const read = () => value; return read; }");
  const live = resolved(analyzeSourceLiveness(current.graph));
  const first = reads(current, "value")[0];
  assert.equal(live.lastUses.has(first.source), true, "the later closure observes the replacement value, not this read's value");
  const capture = current.graph.points.find(point => point.operation.kind === "capture");
  assert.equal(live.before.get(capture.id).has(capture.operation.binding), true);
});

for (const [name, expression] of [["direct helper", "() => later()"], ["nested environment", "() => () => pending"]]) {
  test(`flow captures retain the canonical ${name} source environment`, async () => {
    const current = await fixture(`function run(pending: string) {
      const before = pending;
      function later(): string { return pending; }
      const relay = ${expression};
      return relay;
    }`);
    const pending = current.ast.parameters(current.graph.declaration)[0];
    const relay = namedVariable(current.ast, current.file, "relay");
    const initializer = current.ast.as.AsVariableDeclaration(relay)?.Initializer;
    assert.equal(initializer !== undefined, true, "the original closure creation is checked");
    const captures = current.graph.points.filter(point => point.source === initializer && point.operation.kind === "capture");
    assert.equal(captures.length, 1, "the graph consumes one canonical expanded capture");
    assert.equal(captures[0].operation.binding === pending, true, "the source binding, not the direct callee handle, is retained");
    const live = resolved(analyzeSourceLiveness(current.graph));
    const first = reads(current, "pending")[0];
    assert.equal(live.lastUses.has(first.source), false, "a transitive environment is a real later use of the original binding");
    const domain = resolved(createSourceControlFlowDomain(current.source,
      [...function* walk(node) { yield node; for (const child of current.ast.children(node)) if (child !== undefined) yield* walk(child); }(current.file)]));
    const selected = resolved(createSourceControlFlow(current.source, current.graph.declaration, { domain: domain.domain }));
    const selectedCaptures = selected.graph.points.filter(point => point.source === initializer && point.operation.kind === "capture");
    assert.equal(selectedCaptures.length, 1, "the selected domain cannot silently omit the transitive capture");
    assert.equal(selectedCaptures[0].operation.binding === pending, true,
      "the identical selected domain keeps the same original capture identity");
  });
}

test("canonical flow capture expansion consumes the original caller's finite work budget", async () => {
  const current = await fixture(`function run(pending: string) {
    function later(): string { return pending; }
    const relay = () => later();
    return relay;
  }`);
  const relay = namedVariable(current.ast, current.file, "relay");
  const initializer = current.ast.as.AsVariableDeclaration(relay)?.Initializer;
  let visits = 0;
  const captures = createSourceFlowCaptureQuery(current.source, () => {
    visits += 1;
    if (visits > 3) throw new Error("original capture work budget exhausted");
  }, "source");
  assert.throws(() => captures(initializer), /original capture work budget exhausted/u,
    "transitive environment expansion cannot run outside the shared CFG accounting owner");
});

test("flow liveness reaches a fixed point through nested loops including labelled continue", async () => {
  const current = await fixture(`function use(value: number) {} function run(value: number, outer: boolean, inner: boolean) {
    loop: while (outer) { while (inner) { use(value); if (outer) continue loop; } use(value); } use(value);
  }`);
  const live = resolved(analyzeSourceLiveness(current.graph));
  const uses = reads(current, "value");
  assert.equal(uses.length, 3);
  assert.equal(live.lastUses.has(uses[0].source), false);
  assert.equal(live.lastUses.has(uses[1].source), false);
  assert.equal(live.lastUses.has(uses[2].source), true);
  assert.equal(live.steps < 10000, true);
});

test("flow backward solver visits nonterminating loops that cannot reach an exit", async () => {
  const current = await fixture("function run(value: number) { for (;;) { const observed = value; } }");
  const live = resolved(analyzeSourceLiveness(current.graph));
  const use = reads(current, "value")[0];
  assert.equal(live.reachable.has(current.graph.exit), false);
  assert.equal(live.reachable.has(current.graph.exceptionExit), false);
  assert.equal(live.lastUses.has(use.source), false);
  assert.equal(live.before.get(use.id).has(use.operation.binding), true);
});

test("flow definite assignment intersects branches and distinguishes parameters from uninitialized locals", async () => {
  for (const [body, expected] of [["if (flag) value = 1;", 1], ["if (flag) value = 1; else value = 2;", 0]]) {
    const current = await fixture(`function run(flag: boolean) { let value: number; ${body} return value; }`);
    const assigned = resolved(analyzeSourceDefiniteAssignment(current.graph));
    assert.equal(assigned.unassignedReads.size, expected);
    assert.equal(assigned.unassignedReads.has(reads(current, "flag")[0].source), false);
  }
});

test("flow definite assignment respects do-once versus possibly-empty loops", async () => {
  for (const [body, expected] of [["while (flag) { value = 1; }", 1], ["do { value = 1; } while (flag);", 0]]) {
    const current = await fixture(`function run(flag: boolean) { let value: number; ${body} return value; }`);
    assert.equal(resolved(analyzeSourceDefiniteAssignment(current.graph)).unassignedReads.size, expected);
  }
});

test("flow definite assignment excludes writes bypassed by an exception", async () => {
  const current = await fixture("function fail() { return 1; } function run() { let value: number; try { value = fail(); } catch {} return value; }");
  const assigned = resolved(analyzeSourceDefiniteAssignment(current.graph));
  assert.equal(assigned.unassignedReads.has(reads(current, "value")[0].source), true);
});

test("flow finally assignment occurs on normal, return and throw completion paths", async () => {
  const current = await fixture("function run(flag: boolean) { let value: number; try { if (flag) throw 1; } finally { value = 2; } return value; }");
  const assigned = resolved(analyzeSourceDefiniteAssignment(current.graph));
  assert.equal(assigned.unassignedReads.size, 0);
  const binding = namedVariable(current.ast, current.file, "value");
  assert.equal(assigned.before.get(current.graph.exceptionExit).has(binding), true);
});

test("flow definite assignment follows parameter defaults in source order and hoisted var initialization", async () => {
  const current = await fixture("function run(first: number = 1, second: number = first) { const before = hoisted; var hoisted: number | undefined; return second; }");
  assert.equal(resolved(analyzeSourceDefiniteAssignment(current.graph)).unassignedReads.size, 0);
});

test("flow writes saturate at two without counting exclusive branches twice", async () => {
  const exclusive = await fixture("function run(flag: boolean) { let value: number; if (flag) value = 1; else value = 2; return value; }");
  const single = resolved(analyzeSourceWrites(exclusive.graph));
  assert.equal(single.maximum.get(namedVariable(exclusive.ast, exclusive.file, "value")), 1);
  const loop = await fixture("function run(flag: boolean) { let value = 0; while (flag) { value++; } return value; }");
  assert.equal(resolved(analyzeSourceWrites(loop.graph)).maximum.get(namedVariable(loop.ast, loop.file, "value")), 2);
});

test("flow loop-local lifetimes reset write counts while function-scoped var stores do not", async () => {
  const current = await fixture("function run(flag: boolean) { while (flag) { let local = 1; var reused = 1; if (local) continue; } }");
  const writes = resolved(analyzeSourceWrites(current.graph));
  assert.equal(writes.maximum.get(namedVariable(current.ast, current.file, "local")), 1);
  assert.equal(writes.maximum.get(namedVariable(current.ast, current.file, "reused")), 2);
});

test("flow shadowed spellings remain independent checked binding identities", async () => {
  const current = await fixture("function run(value: number) { { let value = 2; value++; } return value; }");
  const writes = resolved(analyzeSourceWrites(current.graph));
  const declarations = [...current.graph.bindings].filter(binding => current.ast.text(current.ast.name(binding)) === "value");
  assert.equal(declarations.length, 2);
  const local = declarations.find(binding => current.ast.is.IsVariableDeclaration(binding));
  const parameter = declarations.find(binding => current.ast.is.IsParameterDeclaration(binding));
  assert.equal(writes.maximum.get(local), 2);
  assert.equal(writes.maximum.get(parameter), 1);
});

test("flow solver accepts the suspension witness lattice without a second control-flow walker", async () => {
  const current = await fixture("async function step() { return 1; } function use(value: number) {} async function run(value: number, flag: boolean) { if (flag) await step(); use(value); }");
  const pending = new Set();
  const solution = resolved(solveSourceFlow(current.graph, {
    direction: "forward",
    lattice: { empty: () => new Set(), join: (left, right) => new Set([...left, ...right]),
      equals: (left, right) => left.size === right.size && [...left].every(value => right.has(value)) },
    transfer(point, state) {
      if (point.operation.kind === "await") return new Set([...state, point.source]);
      if (point.operation.kind === "read" && current.ast.text(point.source) === "value") {
        for (const witness of state) pending.add(witness);
      }
      return state;
    },
  }));
  assert.equal(pending.size, 1);
  assert.equal(solution.steps < 10000, true);
});

test("flow solver excludes unreachable reads and write counts", async () => {
  const current = await fixture("function use(value: number) {} function run(value: number) { return value; value++; use(value); }");
  const liveness = resolved(analyzeSourceLiveness(current.graph));
  const uses = reads(current, "value");
  assert.equal(uses.length, 3);
  assert.equal(liveness.lastUses.has(uses[0].source), true);
  assert.equal(liveness.reachable.has(uses[1].id), false);
  assert.equal(liveness.reachable.has(uses[2].id), false);
  const parameter = current.source.ast.parameters(current.graph.declaration)[0];
  assert.equal(resolved(analyzeSourceWrites(current.graph)).maximum.get(parameter), 1);
});

test("flow solver returns unresolved for exhausted work and missing lattice premises", async () => {
  const current = await fixture("function run(value: number) { while (value > 0) value--; return value; }");
  const problem = { direction: "forward", lattice: { empty: () => 0, join: (left, right) => Math.max(left, right), equals: Object.is }, transfer: (_, state) => state };
  const limited = solveSourceFlow(current.graph, problem, { maximumSteps: 1 });
  assert.equal(limited.kind, "unresolved");
  assert.match(limited.reason, /work budget/u);
  const missing = solveSourceFlow(current.graph, { ...problem, transfer: () => undefined });
  assert.equal(missing.kind, "unresolved");
  assert.match(missing.reason, /premises and budget/u);
  const unbounded = solveSourceFlow(current.graph, { ...problem, transfer: (_, state) => state + 1 }, { maximumSteps: 2000 });
  assert.equal(unbounded.kind, "unresolved");
  assert.match(unbounded.reason, /work budget/u);
});

test("flow definite assignment and last use preserve conditional pattern defaults", async () => {
  const current = await fixture("function fallback() { return 1; } function run(input: { count?: number }) { const { count = fallback() } = input; return count; }");
  assert.equal(resolved(analyzeSourceDefiniteAssignment(current.graph)).unassignedReads.size, 0);
  const live = resolved(analyzeSourceLiveness(current.graph));
  const count = reads(current, "count");
  assert.equal(count.length, 1);
  assert.equal(live.lastUses.has(count[0].source), true);
});

test("flow solver charges instance lattice work and honors explicit finite edge bounds", async () => {
  const current = await fixture("function run(value: number) { return value; }");
  const problem = { direction: "forward", lattice: { empty: () => 0, join: (left, right) => Math.max(left, right), equals: Object.is },
    transfer: (_, value) => value };
  const edges = solveSourceFlow(current.graph, problem, { maximumEdges: 1 });
  assert.equal(edges.kind, "unresolved");
  assert.match(edges.reason, /edge budget/u);
  const expensive = solveSourceFlow(current.graph, { ...problem, transfer(_, value, work) {
    for (let index = 0; index < 1000; index += 1) work.step();
    return value;
  } }, { maximumSteps: 500 });
  assert.equal(expensive.kind, "unresolved");
  assert.match(expensive.reason, /work budget/u);
});

test("flow finally read is last only when every completion-specific occurrence is last", async () => {
  const current = await fixture("function use(value: number) {} function run(value: number, flag: boolean) { try { if (flag) return; } finally { use(value); } use(value); }");
  const live = resolved(analyzeSourceLiveness(current.graph));
  const uses = reads(current, "value");
  const sourceReads = [...new Set(uses.map(point => point.source))].sort((left, right) => current.ast.pos(left) - current.ast.pos(right));
  assert.equal(sourceReads.length, 2);
  assert.equal(live.lastUses.has(sourceReads[0]), false);
  assert.equal(live.lastUses.has(sourceReads[1]), true);
  const finallyPoints = uses.filter(point => point.source === sourceReads[0] && live.reachable.has(point.id));
  assert.equal(finallyPoints.some(point => live.lastUsePoints.has(point.id)), true);
  assert.equal(finallyPoints.some(point => !live.lastUsePoints.has(point.id)), true);
});

test("flow joined writes are independent of input traversal order", async () => {
  const current = await fixture("function run(first: boolean, second: boolean) { let value = 0; if (first) value++; if (second) value++; return value; }");
  const result = resolved(analyzeSourceWrites(current.graph));
  assert.equal(result.maximum.get(namedVariable(current.ast, current.file, "value")), 2);
  const reversed = { ...current.graph, points: current.graph.points.map(point => ({ ...point,
    predecessors: [...point.predecessors].reverse(), successors: [...point.successors].reverse() })) };
  const reordered = resolved(analyzeSourceWrites(reversed));
  assert.equal(reordered.maximum.size, result.maximum.size);
  for (const [binding, count] of result.maximum) assert.equal(reordered.maximum.get(binding), count);
});

test("flow boolean literal decisions are shared by if, conditionals, loops and short-circuit edges", async () => {
  for (const body of ["if ((true)) value = 1;", "true ? value = 1 : 0;", "true && (value = 1);", "false || (value = 1);",
    "while ((true)) { value = 1; break; }"]) {
    const current = await fixture(`function run() { let value: number; ${body} return value; }`);
    assert.equal(resolved(analyzeSourceDefiniteAssignment(current.graph)).unassignedReads.size, 0, body);
  }
});

test("flow nullish literal decisions preserve zero, false and empty strings as present", async () => {
  for (const [value, assigned] of [["null", true], ["void 0", true], ["0", false], ["false", false], ['""', false]]) {
    const current = await fixture(`function run() { let value: number; ${value} ?? (value = 1); return value; }`);
    assert.equal(resolved(analyzeSourceDefiniteAssignment(current.graph)).unassignedReads.size, assigned ? 0 : 1, value);
  }
});

test("flow transparent assignment and update references retain exact binding writes", async () => {
  const current = await fixture("function run() { let value: number; (value) = 1; (value)++; return value; }");
  assert.equal(resolved(analyzeSourceDefiniteAssignment(current.graph)).unassignedReads.size, 0);
  const binding = namedVariable(current.ast, current.file, "value");
  assert.equal(resolved(analyzeSourceWrites(current.graph)).maximum.get(binding), 2);
});

test("flow published fact collections reject mutation through the checked TypeScript API", () => {
  const directory = resolve(".temp/test-runs/flow-readonly-api", `${Date.now()}-${process.pid}`);
  mkdirSync(directory, { recursive: true });
  const path = resolve(directory, "consumer.ts");
  const owner = fileURLToPath(new URL("../../packages/target-api/dist/target-analysis/flow/index.js", import.meta.url));
  writeFileSync(path, `
    import { analyzeSourceLiveness, analyzeSourceDefiniteAssignment, analyzeSourceWrites } from ${JSON.stringify(owner)};
    import type { SourceControlFlowGraph } from ${JSON.stringify(owner)};
    export function consumer(graph: SourceControlFlowGraph): void {
      const live = analyzeSourceLiveness(graph);
      const assigned = analyzeSourceDefiniteAssignment(graph);
      const writes = analyzeSourceWrites(graph);
      if (live.kind === "resolved") {
        live.lastUses.add(graph.declaration);
        live.before.set(graph.entry, new Set());
      }
      if (assigned.kind === "resolved") assigned.unassignedReads.add(graph.declaration);
      if (writes.kind === "resolved") writes.maximum.set(graph.declaration, 2);
      graph.bindings.add(graph.declaration);
      graph.points[0]?.successors.push({ from: 0, to: 0, kind: "normal" });
    }
  `);
  const configuration = resolve(directory, "tsconfig.json");
  writeFileSync(configuration, JSON.stringify({ compilerOptions: { noEmit: true, strict: true, skipLibCheck: true,
    target: "ES2022", module: "NodeNext", moduleResolution: "NodeNext", types: ["node"] }, files: ["consumer.ts"] }));
  const result = spawnSync(resolve("node_modules/.bin/tsgo"), ["--project", configuration, "--pretty", "false"],
  { encoding: "utf8", timeout: 60000, maxBuffer: 65536 });
  assert.equal(result.error === undefined, true, "the real compiler finishes under the inherited process-group guard");
  assert.equal(result.status, 1, result.stdout.slice(0, 8192) || result.stderr.slice(0, 8192));
  const diagnostics = result.stdout.split("\n").filter(line => line.includes("error TS"));
  assert.equal(diagnostics.length, 6, result.stdout.slice(0, 8192));
  assert.equal(diagnostics.every(line => line.includes("error TS2339:")), true, diagnostics.join("\n"));
});

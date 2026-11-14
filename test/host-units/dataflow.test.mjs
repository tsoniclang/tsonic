import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import { Session } from "node:inspector";
import { basename, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { after, before, test } from "node:test";
import { checkCoverage } from "../architecture/host/coverage.mjs";
import { hostCatalogue } from "../architecture/host/catalogue.mjs";
import { parseSources } from "../architecture/host/import-graph.mjs";
import { compileIsolated, isolationDeps } from "../architecture/host/isolation.mjs";
import { runCase } from "../host-cases/case.mjs";

const repository = fileURLToPath(new URL("../../", import.meta.url));
const tooling = process.env.TSONIC_HOST_TOOLING_ROOT ?? repository;
const runtimeNames = ["index", "solve", "graph", "ordering", "dominators", "loops", "components"];
const sourceFiles = ["contract", ...runtimeNames].map(name => `packages/host/src/dataflow/${name}.ts`);
const runtimeFiles = runtimeNames.map(name => resolve(repository, `packages/host/dist/dataflow/${name}.js`));
const caseDirectory = "test/host-cases/dataflow/function";
const casePaths = readdirSync(resolve(repository, caseDirectory)).filter(name => name.endsWith(".case.json")).sort()
  .map(name => `${caseDirectory}/${name}`);
const limits = { maximumWork: 1_000_000, maximumResultEntries: 1_000_000 };
const interfaceNames = ["ids", "diag", "ir-types", "ir-hir", "ir-infer", "ir-tir", "ir-mir"];
const interfaceSources = [...interfaceNames.map(name => `packages/host/src/${name}/contract.ts`),
  "packages/host/src/diag/index.ts"];
const declarationSources = [...interfaceSources,
  "packages/host/src/ir-types/arena.ts", "packages/host/src/ir-types/data.ts", "packages/host/src/ir-types/native-facts-data.ts",
  "packages/host/src/diag/invariant.ts", "packages/host/src/diag/order.ts",
  "packages/host/src/ids/index.ts", "packages/host/src/ids/identity.ts", "packages/host/src/ids/key.ts"];
const quarantineRoots = JSON.parse(readFileSync(resolve(repository, "test/architecture/quarantine/areas.json"), "utf8"))
  .areas.map(area => area.directory);
const session = new Session();
const post = (method, parameters = {}) => new Promise((done, reject) => {
  session.post(method, parameters, (error, result) => error === null ? done(result) : reject(error));
});
let product;
let mir;
let identities;
let fixtureIdentity;

function complete(actual, expected, label) {
  assert.equal(isDeepStrictEqual(actual, expected), true, label);
}

before(async () => {
  assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined, true, "aggregate process-group admission is required");
  session.connect();
  await post("Debugger.enable");
  await post("Profiler.enable");
  await post("Profiler.startPreciseCoverage", { callCount: true, detailed: true });
  product = await import("../../packages/host/dist/dataflow/index.js");
  mir = await import("../../packages/host/dist/ir-mir/index.js");
  identities = await import("../../packages/host/dist/ids/index.js");
  const module = identities.encodeModuleId({ package: identities.encodePackageId("dataflow"), path: "entry.ts" });
  const definition = identities.encodeDefId({ module, segments: [{ name: "entry", ordinal: 0 }] });
  const body = identities.encodeBodyId({ owner: definition, role: "function", ordinal: 0 });
  fixtureIdentity = { module, definition, body };
});

function evaluate(input) {
  switch (input.operation) {
    case "predecessors": return product.predecessors(input.graph, input.limits);
    case "orderGraph": return product.orderGraph(input.graph, input.roots, input.limits);
    case "dominators": return product.dominators(input.graph, input.entry, input.limits);
    case "naturalLoops": return product.naturalLoops(input.graph, input.entry, input.limits);
    case "stronglyConnectedComponents": return product.stronglyConnectedComponents(input.graph, input.limits);
  }
  throw new Error(`Unrecognised authored operation ${input.operation}`);
}

for (const path of casePaths) {
  test(`dataflow authored function case ${basename(path, ".case.json")}`, async () => {
    const result = await runCase({
      modules: ["dataflow"],
      evidenceDirectory: resolve(repository, ".temp/host-case-evidence"),
      canonical: path => relative(repository, realpathSync(resolve(repository, path))).split("\\").join("/"),
      readText: path => readFileSync(resolve(repository, path), "utf8"),
      list: path => readdirSync(resolve(repository, path)),
      decode: (text, format) => { assert.equal(format, "json"); return JSON.parse(text); },
      adapters: { function: input => ({ kind: "accepted", value: evaluate(JSON.parse(input.text)), diagnostics: [] }) },
    }, path);
    assert.equal(result.status, "passed", JSON.stringify(result.status === "failed" ? result : { path }));
  });
}

function site() {
  return { origin: { module: fixtureIdentity.module, start: 0, length: 1, derived: [] },
    tir: { body: fixtureIdentity.body, node: identities.nodeId(0) } };
}

// Records that can be a protocol step carry their step; none of these fixtures is a protocol step.
const steppedTerminators = new Set(["switch", "call", "invoke", "await", "yield", "delegate"]);
const unstepped = record => record.kind === "assign" || steppedTerminators.has(record.kind) ? { step: null, ...record } : record;

function fixtureBody(terminators, statementRows) {
  assert.equal(terminators.length, statementRows.length, "all fixture statement rows are explicit");
  return {
    body: fixtureIdentity.body,
    bindings: { kind: "parametric" },
    // One entry at block 0 for a body with blocks; the fixture has no parameters.
    entries: terminators.length === 0 ? [] : [{ provided: 0, block: identities.blockId(0) }],
    locals: [{ id: identities.localId(0), storage: identities.tyId(0), role: { kind: "user" }, mode: "local", source: null, origin: site().origin }],
    constants: [
      { id: identities.constId(0), type: identities.tyId(0), value: { kind: "literal", value: { kind: "absence" } } },
      { id: identities.constId(1), type: identities.tyId(0), value: { kind: "literal", value: { kind: "boolean", value: true } } },
    ],
    places: [{ id: identities.placeId(0), base: { kind: "local", local: identities.localId(0) }, storage: identities.tyId(0), origin: site().origin }],
    blocks: terminators.map((terminator, index) => ({ ...site(), id: identities.blockId(index),
      statements: statementRows[index].map(statement => ({ ...site(), ...unstepped(statement) })),
      terminator: { ...site(), ...unstepped(terminator) } })),
    result: identities.tyId(0),
  };
}

function parsedBody(terminators, statementRows) {
  const body = fixtureBody(terminators, statementRows);
  const parsed = mir.parseMir(mir.printMir(body));
  complete(parsed, { kind: "parsed", value: body }, "the actual merged MIR codec produces the complete typed input");
  return parsed.value;
}

function operation() {
  return { decision: { kind: "selected", operation: { kind: "discard" }, operands: [identities.tyId(0)],
    result: identities.tyId(0), execution: { kind: "pure" } }, permissionScope: null };
}

function resolution() {
  const bindings = { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] };
  return {
    decision: {
      candidate: 0,
      advertised: { declaration: fixtureIdentity.definition, role: "advertised", signature: identities.sigId(0), body: null },
      api: { declaration: fixtureIdentity.definition, role: "api-signature", signature: identities.sigId(0), body: null },
      bindings,
      implementationBindings: bindings,
      parameters: [],
      completion: { signature: identities.sigId(0), completion: identities.tyId(0), yielded: null, sent: null },
      result: identities.tyId(0),
      activation: null,
    },
    activation: null,
  };
}

test("graphOfMir covers every terminator and every failure arm in declared order", () => {
  const operand = { kind: "constant", constant: identities.constId(0) };
  const escape = { kind: "escape" };
  const handler = { kind: "handler", exception: identities.placeId(0), target: identities.blockId(2) };
  const call = { callee: { kind: "direct", resolution: resolution() }, receiver: null,
    arguments: [], destination: null, next: identities.blockId(1) };
  const invoke = { operation: operation(), operands: [operand], destination: null, next: identities.blockId(1) };
  const suspension = { destination: identities.placeId(0), resume: identities.blockId(1),
    return: { destination: identities.placeId(0), target: identities.blockId(3) } };
  const terminators = [
    { kind: "goto", target: identities.blockId(1) },
    { kind: "switch", operand, targets: [{ constant: identities.constId(0), target: identities.blockId(2) },
      { constant: identities.constId(1), target: identities.blockId(3) }], otherwise: identities.blockId(4) },
    { kind: "switch", operand, targets: [], otherwise: identities.blockId(4) },
    { kind: "call", ...call, unwind: escape },
    { kind: "call", ...call, unwind: handler },
    { kind: "invoke", ...invoke, unwind: escape },
    { kind: "invoke", ...invoke, unwind: handler },
    { kind: "await", operand, destination: identities.placeId(0), resume: identities.blockId(1), unwind: escape },
    { kind: "await", operand, destination: identities.placeId(0), resume: identities.blockId(1), unwind: handler },
    { kind: "yield", operand: null, ...suspension, unwind: escape },
    { kind: "yield", operand, ...suspension, unwind: handler },
    { kind: "delegate", iterator: operand, ...suspension, unwind: escape },
    { kind: "delegate", iterator: operand, ...suspension, unwind: handler },
    { kind: "throw", operand, unwind: escape },
    { kind: "throw", operand, unwind: handler },
    { kind: "return", value: null },
    { kind: "unreachable" },
    // A check has a normal edge and, only when its failure goes to a handler, an unwind edge (graph law 1).
    { kind: "check", place: identities.placeId(0), next: identities.blockId(1), unwind: escape },
    { kind: "check", place: identities.placeId(0), next: identities.blockId(1), unwind: handler },
    { kind: "check", place: identities.placeId(0), next: identities.blockId(1), unwind: { kind: "abort" } },
    // A failure that ends the process and a control point that cannot fail have no edge.
    { kind: "invoke", ...invoke, unwind: { kind: "abort" } },
    { kind: "invoke", ...invoke, unwind: { kind: "none" } },
  ];
  const body = parsedBody(terminators, terminators.map(() => []));
  assert.deepEqual(product.graphOfMir(body), {

    successors: [[1], [2, 3, 4], [4], [1], [1, 2], [1], [1, 2], [1], [1, 2], [1, 3], [1, 3, 2],
      [1, 3], [1, 3, 2], [], [2], [], [], [1], [1, 2], [1], [1], [1]],
  });
});

test("all graph ports preserve their complete empty results at zero budgets", () => {
  const graph = { successors: [] };
  const zero = { maximumWork: 0, maximumResultEntries: 0 };
  complete(product.predecessors(graph, zero), { kind: "complete", value: [] }, "empty predecessors");
  complete(product.orderGraph(graph, [], zero), { kind: "complete", value: { preorder: [], postorder: [], reachable: [] } },
    "empty ordering");
  complete(product.dominators(graph, 0, zero), { kind: "complete", value: { immediate: [], reachable: [] } },
    "C2942 empty dominators has no invented entry");
  complete(product.naturalLoops(graph, 0, zero), { kind: "complete", value: [] }, "C2942 empty loops");
  complete(product.stronglyConnectedComponents(graph, zero),
    { kind: "complete", value: { components: [], componentOf: [] } }, "empty components");
  complete(product.graphOfMir(parsedBody([], [])), { successors: [] }, "empty typed MIR edge projection");
});

test("ordering preserves authored roots and successors rather than sorting the DFS", () => {
  const graph = { successors: [[1, 2], [3], [3], [], []] };
  complete(product.orderGraph(graph, [0], limits), { kind: "complete", value: {
    preorder: [0, 1, 3, 2], postorder: [3, 1, 2, 0], reachable: [true, true, true, true, false],
  } }, "authored diamond traversal");
  complete(product.orderGraph({ ...graph, successors: [[2, 1], [3], [3], [], []] }, [0], limits),
    { kind: "complete", value: { preorder: [0, 2, 3, 1], postorder: [3, 2, 1, 0], reachable: [true, true, true, true, false] } },
    "the second authored successor order");
  complete(product.orderGraph(graph, [4, 0, 4], limits), { kind: "complete", value: {
    preorder: [4, 0, 1, 3, 2], postorder: [4, 3, 1, 2, 0], reachable: [true, true, true, true, true],
  } }, "isolated root and repeated root");
  complete(product.orderGraph(graph, [], limits), { kind: "complete", value: {
    preorder: [], postorder: [], reachable: [false, false, false, false, false],
  } }, "no roots does not fabricate reachability");
});

test("vertex identity is exactly its dense adjacency position", () => {
  const graph = { successors: [[1], [2], [0], [4], [1]] };
  complete(product.predecessors(graph, limits), { kind: "complete", value: [[2], [0, 4], [1], [], [3]] },
    "numeric index predecessors retain every distinct position");
  complete(product.stronglyConnectedComponents(graph, limits),
    { kind: "complete", value: { components: [[0, 1, 2], [3], [4]], componentOf: [0, 0, 0, 1, 2] } },
    "distinct adjacency positions never collapse vertices");
  complete(product.dominators(graph, 0, limits), { kind: "complete", value: {
    immediate: [null, 0, 1, null, null], reachable: [true, true, true, false, false],
  } }, "unreachable incoming predecessors cannot change dominance");
  complete(product.naturalLoops(graph, 0, limits),
    { kind: "complete", value: [{ header: 0, backEdges: [2], members: [0, 1, 2] }] },
    "unreachable predecessors never join a natural loop");
  complete(product.stronglyConnectedComponents({ successors: [[3], [2], [1], [2]] }, limits),
    { kind: "complete", value: { components: [[0], [1, 2], [3]], componentOf: [0, 1, 1, 2] } },
    "the second-pass SCC root2 is not its minimum1; result order ignores discovery order");
});

test("semidominator compression and final idom correction retain complete dominance", () => {
  const graph = { successors: [[1, 2], [2, 4], [3], [], [3], [3]] };
  complete(product.dominators(graph, 0, limits), { kind: "complete", value: {
    immediate: [null, 0, 0, 0, 1, null], reachable: [true, true, true, true, true, false],
  } }, "node3 semi1 is not its immediate dominator0; node5 is unreachable");
  complete(product.dominators({ successors: [[], [2], []] }, 1, limits),
    { kind: "complete", value: { immediate: [null, null, 1], reachable: [false, true, true] } },
    "a nonzero actual entry has null idom and does not activate node0");
});

test("nested natural loops and irreducible components keep distinct complete meanings", () => {
  const graph = { successors: [[1], [2, 5], [3, 4], [2], [1], []] };
  complete(product.naturalLoops(graph, 0, limits), { kind: "complete", value: [
    { header: 1, backEdges: [4], members: [1, 2, 3, 4] },
    { header: 2, backEdges: [3], members: [2, 3] },
  ] }, "header order is canonical even when header2 is discovered first");
  const irreducible = { successors: [[1, 2], [3], [3], [1, 2]] };
  complete(product.naturalLoops(irreducible, 0, limits), { kind: "complete", value: [] },
    "an irreducible SCC is not fabricated into a natural loop");
  complete(product.stronglyConnectedComponents(irreducible, limits),
    { kind: "complete", value: { components: [[0], [1, 2, 3]], componentOf: [0, 1, 1, 1] } },
    "the same irreducible component still belongs to the SCC partition");
  complete(product.naturalLoops({ successors: [[0, 0]] }, 0, limits),
    { kind: "complete", value: [{ header: 0, backEdges: [0], members: [0] }] },
    "duplicate self-edges do not duplicate backedges or membership");
  complete(product.naturalLoops({ successors: [[1], [2], [3, 4], [1], [1]] }, 0, limits),
    { kind: "complete", value: [{ header: 1, backEdges: [3, 4], members: [1, 2, 3, 4] }] },
    "overlapping reverse membership shares one header union without losing a second backedge");
});

test("every graph work/result-entry limit admits its hand-derived boundary and refuses every smaller allowance", () => {
  const chain = { successors: [[1], [2], []] };
  const correction = { successors: [[1, 2], [2, 4], [3], [], [3]] };
  const loop = { successors: [[1], [2, 3, 4], [1], [1], []] };
  const cases = [
    { name: "predecessors", work: 8, entries: 5, run: budget => product.predecessors(chain, budget),
      expected: [[], [0], [1]] },
    { name: "ordering", work: 14, entries: 9, run: budget => product.orderGraph(chain, [0], budget),
      expected: { preorder: [0, 1, 2], postorder: [2, 1, 0], reachable: [true, true, true] } },
    { name: "components", work: 24, entries: 9, run: budget => product.stronglyConnectedComponents(chain, budget),
      expected: { components: [[0], [1], [2]], componentOf: [0, 1, 2] } },
    { name: "dominators", work: 65, entries: 10, run: budget => product.dominators(correction, 0, budget),
      expected: { immediate: [null, 0, 0, 0, 1], reachable: [true, true, true, true, true] } },
    { name: "loops", work: 102, entries: 6, run: budget => product.naturalLoops(loop, 0, budget),
      expected: [{ header: 1, backEdges: [2, 3], members: [1, 2, 3] }] },
  ];
  // Chain: build8; DFS6; SCC extra16; correction graph: build16+DFS12+init5+LT28+final4=65.
  // Shared-header loops: dom61+tree24+scan11+two reverse memberships6=102. No runtime count oracle.
  for (const entry of cases) {
    complete(entry.run({ maximumWork: entry.work, maximumResultEntries: entry.entries }),
      { kind: "complete", value: entry.expected }, `${entry.name} exactly at both limits`);
    complete(entry.run({ maximumWork: entry.work + 1, maximumResultEntries: entry.entries + 1 }),
      { kind: "complete", value: entry.expected }, `${entry.name} one allowance above both requirements`);
    for (let maximumWork = 0; maximumWork < entry.work; maximumWork += 1) {
      complete(entry.run({ maximumWork, maximumResultEntries: entry.entries }),
        { kind: "resource-limit", dimension: "work", maximum: maximumWork }, `${entry.name} work ${maximumWork}`);
    }
    for (let maximumResultEntries = 0; maximumResultEntries < entry.entries; maximumResultEntries += 1) {
      complete(entry.run({ maximumWork: entry.work, maximumResultEntries }),
        { kind: "resource-limit", dimension: "result-entries", maximum: maximumResultEntries },
        `${entry.name} result entries ${maximumResultEntries}`);
    }
  }
});

test("zero-work isolated and repeated-edge families obey the same literal accounting", () => {
  const isolated = { successors: [[]] };
  complete(product.predecessors(isolated, { maximumWork: 2, maximumResultEntries: 1 }),
    { kind: "complete", value: [[]] }, "isolated predecessor row build2/entry1");
  complete(product.orderGraph(isolated, [0], { maximumWork: 4, maximumResultEntries: 3 }),
    { kind: "complete", value: { preorder: [0], postorder: [0], reachable: [true] } }, "isolated ordering4/3");
  complete(product.dominators(isolated, 0, { maximumWork: 5, maximumResultEntries: 2 }),
    { kind: "complete", value: { immediate: [null], reachable: [true] } }, "isolated dominance5/2");
  complete(product.naturalLoops(isolated, 0, { maximumWork: 10, maximumResultEntries: 0 }),
    { kind: "complete", value: [] }, "a loop-free result has zero published entries");
  complete(product.stronglyConnectedComponents(isolated, { maximumWork: 6, maximumResultEntries: 3 }),
    { kind: "complete", value: { components: [[0]], componentOf: [0] } }, "isolated SCC6/3");
  const repeated = { successors: [[1, 1], [0]] };
  complete(product.stronglyConnectedComponents(repeated, { maximumWork: 20, maximumResultEntries: 5 }),
    { kind: "complete", value: { components: [[0, 1]], componentOf: [0, 0] } },
    "6V+2E+Ep=12+6+2=20, duplicate edges remain charged");
});

test("standalone graph density/range and actual invalid maxima are caller defects, not refusals", () => {
  const valid = { successors: [[]] };
  const ports = [
    budget => product.predecessors(valid, budget),
    budget => product.orderGraph(valid, [0], budget),
    budget => product.dominators(valid, 0, budget),
    budget => product.naturalLoops(valid, 0, budget),
    budget => product.stronglyConnectedComponents(valid, budget),
  ];
  for (const port of ports) for (const field of ["maximumWork", "maximumResultEntries"]) {
    for (const maximum of [-1, 0.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      assert.throws(() => port({ ...limits, [field]: maximum }),
        { name: "TypeError", message: `${field} must be a nonnegative safe integer` });
    }
  }
  for (const row of [undefined, null]) {
    assert.throws(() => product.predecessors({ successors: [row] }, limits),
      { name: "TypeError", message: "vertex 0 is missing" });
  }
  assert.throws(() => product.predecessors({ successors: new Array(1) }, limits),
    { name: "TypeError", message: "vertex 0 is missing" });
  for (const target of [-1, 0.5, NaN, Infinity, 1]) {
    assert.throws(() => product.predecessors({ successors: [[target]] }, limits),
      { name: "TypeError", message: `edge target ${target} is missing` });
    assert.throws(() => product.orderGraph(valid, [target], limits),
      { name: "TypeError", message: `root ${target} is missing` });
  }
  assert.throws(() => product.predecessors({ successors: [new Array(1)] }, limits),
    { name: "TypeError", message: "edge target undefined is missing" });
});

test("a hundred-thousand-vertex chain stays iterative with complete exact graph results", () => {
  const depth = 100_000;
  const vertices = Array.from({ length: depth }, (unusedValue, index) => index);
  const graph = { successors: vertices.map(index => index + 1 < depth ? [index + 1] : []) };
  const budget = { maximumWork: 8_000_000, maximumResultEntries: depth * 3 };
  complete(product.predecessors(graph, budget),
    { kind: "complete", value: vertices.map(index => index === 0 ? [] : [index - 1]) }, "complete deep predecessor rows");
  complete(product.orderGraph(graph, [0], budget), { kind: "complete", value: {
    preorder: vertices, postorder: [...vertices].reverse(), reachable: vertices.map(() => true),
  } }, "complete deep traversal");
  complete(product.dominators(graph, 0, budget), { kind: "complete", value: {
    immediate: vertices.map(index => index === 0 ? null : index - 1), reachable: vertices.map(() => true),
  } }, "complete deep dominator tree");
  complete(product.naturalLoops(graph, 0, budget), { kind: "complete", value: [] }, "no invented deep loop");
  complete(product.stronglyConnectedComponents(graph, budget),
    { kind: "complete", value: { components: vertices.map(index => [index]), componentOf: vertices } },
    "complete deep SCC partition");
});

function finiteLattice(stateBound = 16) {
  return { bottom: [], overflow: null, stateBound,
    join: (left, right) => {
      if (left === null || right === null) return null;
      const joined = new Set(left);
      for (const member of right) if (!joined.has(member)) {
        if (joined.size === stateBound) return null;
        joined.add(member);
      }
      return [...joined].sort((left, right) => left - right);
    },
    equals: isDeepStrictEqual,
    isOverflow: state => state === null };
}

function scalarProblem(direction) {
  const lattice = { bottom: 0, overflow: -1, stateBound: 1,
    join: (left, right) => left === -1 || right === -1 ? -1 : Math.max(left, right),
    equals: Object.is, isOverflow: state => state === -1 };
  return { direction, lattice, boundary: 1,
    statement: (unusedStatement, state) => state,
    terminator: direction === "forward"
      ? (terminator, state) => terminator.kind === "goto" ? [{ target: terminator.target, state }] : []
      : (unusedTerminator, successors, boundaryState) => successors.reduce((state, edge) => lattice.join(state, edge.state),
        boundaryState === null ? 0 : boundaryState) };
}

function unionStatement(lattice, member) {
  return (statement, state) => state === null ? null : statement.kind === "storage-live"
    ? lattice.join(state, [member]) : state.filter(value => value !== member);
}

function unionForwardTerminator(lattice) {
  return (terminator, state) => terminator.kind === "switch"
    ? [{ target: identities.blockId(1), state: lattice.join(state, [1]) },
      { target: identities.blockId(2), state: lattice.join(state, [2]) }]
    : terminator.kind === "goto" ? [{ target: terminator.target, state: state === null ? null : [...state] }] : [];
}

function unionBackwardTerminator(lattice) {
  return (unusedTerminator, successors, boundaryState) => successors.reduce((state, edge) => lattice.join(state, edge.state),
    boundaryState === null ? [] : boundaryState);
}

function chainBody(length) {
  return parsedBody(Array.from({ length }, (unusedValue, index) => index + 1 < length
    ? { kind: "goto", target: identities.blockId(index + 1) } : { kind: "return", value: null }),
  Array.from({ length }, () => []));
}

// An execution is a body instance and an entry, named by its supplied count (COMMON-DATA section 1); body facts are per
// execution. The body below offers supplied count 1 at block 0 and supplied count 0 at block 1, a prologue that block 0
// does not reach. The position of an entry in the list is not its name:
//   block 0: goto 3      block 1: [storage-live] goto 0      block 2: return      block 3: return
function twoEntryBody() {
  const body = fixtureBody([
    { kind: "goto", target: identities.blockId(3) },
    { kind: "goto", target: identities.blockId(0) },
    { kind: "return", value: null },
    { kind: "return", value: null },
  ], [[], [{ kind: "storage-live", local: identities.localId(0) }], [], []]);
  const parsed = mir.parseMir(mir.printMir({ ...body,
    entries: [{ provided: 1, block: identities.blockId(0) }, { provided: 0, block: identities.blockId(1) }] }));
  assert.equal(parsed.kind, "parsed");
  return parsed.value;
}

test("solve starts at the block of the selected entry and nowhere else", () => {
  const body = twoEntryBody();
  // The boundary is 1; the prologue's statement raises the state to 2; an unreached block keeps bottom, 0.
  const lattice = { bottom: 0, overflow: -1, stateBound: 2, join: (left, right) => left === -1 || right === -1 ? -1 : Math.max(left, right),
    equals: Object.is, isOverflow: state => state === -1 };
  const problem = { direction: "forward", lattice, boundary: 1,
    statement: (statement, state) => statement.kind === "storage-live" ? 2 : state,
    terminator: (terminator, state) => terminator.kind === "goto" ? [{ target: terminator.target, state }] : [] };
  // Supplied count 1: the boundary applies at block 0. The prologue of the other entry is not part of this execution:
  // block 1 is unreached and its statement does not change these facts.
  complete(product.solve(body, 1, problem, limits), { kind: "complete", value: {
    entry: [1, 0, 0, 1], exit: [1, 0, 0, 1], reachable: [true, false, false, true] } }, "supplied count 1");
  // Supplied count 0: its block is not reachable from block 0. The boundary applies at block 1 and not again at
  // block 0, which this execution enters with the prologue's state.
  complete(product.solve(body, 0, problem, limits), { kind: "complete", value: {
    entry: [2, 1, 0, 2], exit: [2, 2, 0, 2], reachable: [true, true, false, true] } }, "supplied count 0");
  // The same body with its entries listed in the other order gives the same two results: the count names the entry.
  const reordered = { ...body, entries: [...body.entries].reverse() };
  complete(product.solve(reordered, 1, problem, limits), product.solve(body, 1, problem, limits), "count 1, reordered");
  complete(product.solve(reordered, 0, problem, limits), product.solve(body, 0, problem, limits), "count 0, reordered");
  // A backward problem is bounded by the same execution: only blocks reached from the selected entry take part.
  const backward = product.solve(body, 0, scalarProblem("backward"), limits);
  assert.equal(backward.kind, "complete");
  assert.deepEqual(backward.value.reachable, [true, true, false, true]);
  assert.deepEqual(product.solve(body, 1, scalarProblem("backward"), limits).value.reachable, [true, false, false, true]);
});

test("a supplied count the body does not offer is an invariant failure, never block 0", () => {
  const body = twoEntryBody();
  for (const provided of [2, -1, 0.5, Number.NaN])
    assert.throws(() => product.solve(body, provided, scalarProblem("forward"), limits),
      error => error instanceof Error && error.message.includes("the body offers no entry for the supplied count"), String(provided));
});

test("solve retains complete forward per-edge unions, statement order and unreachable bottom", () => {
  const body = parsedBody([
    { kind: "switch", operand: { kind: "constant", constant: identities.constId(0) },
      targets: [{ constant: identities.constId(1), target: identities.blockId(1) }], otherwise: identities.blockId(2) },
    { kind: "goto", target: identities.blockId(3) }, { kind: "goto", target: identities.blockId(3) },
    { kind: "return", value: null }, { kind: "return", value: null },
  ], [[], [{ kind: "storage-live", local: identities.localId(0) }, { kind: "storage-dead", local: identities.localId(0) }],
    [{ kind: "storage-live", local: identities.localId(0) }], [], [{ kind: "storage-dead", local: identities.localId(0) }]]);
  const lattice = finiteLattice();
  const visits = [];
  const statementTransfer = unionStatement(lattice, 3);
  const problem = { direction: "forward", lattice, boundary: [7],
    statement: (statement, state) => {
      visits.push(statement.kind);
      return statementTransfer(statement, state);
    },
    terminator: unionForwardTerminator(lattice) };
  complete(product.solve(body, 0, problem, limits), { kind: "complete", value: {
    entry: [[7], [1, 7], [2, 7], [1, 2, 3, 7], []],
    exit: [[7], [1, 7], [2, 3, 7], [1, 2, 3, 7], []], reachable: [true, true, true, true, false],
  } }, "forward entry/exit are block boundaries, not the terminator's separate edge contributions");
  complete(visits, ["storage-live", "storage-live", "storage-dead"], "RPO visits block2 then both block1 statements");
});

test("backward liveness passes exit boundary explicitly and reverses statements without post-join forcing", () => {
  const body = parsedBody([{ kind: "goto", target: identities.blockId(1) }, { kind: "return", value: null },
    { kind: "return", value: null }], [[{ kind: "storage-live", local: identities.localId(0) },
    { kind: "storage-dead", local: identities.localId(0) }], [], []]);
  const lattice = finiteLattice();
  const observed = [];
  const terminatorTransfer = unionBackwardTerminator(lattice);
  const problem = { direction: "backward", lattice, boundary: [7],
    statement: unionStatement(lattice, 1),
    terminator: (terminator, successors, boundaryState) => {
      observed.push({ kind: terminator.kind, successors, boundaryState });
      return terminatorTransfer(terminator, successors, boundaryState);
    } };
  complete(product.solve(body, 0, problem, limits), { kind: "complete", value: {
    entry: [[1, 7], [7], []], exit: [[7], [7], []], reachable: [true, true, false],
  } }, "backward reverse live/dead order generates1 and never activates unreachable exit2");
  complete(observed, [{ kind: "return", successors: [], boundaryState: [7] },
    { kind: "goto", successors: [{ target: identities.blockId(1), state: [7] }], boundaryState: null }],
  "no fake boundary edge or callback for unreachable return");
  const kill = { ...problem, statement: (unusedStatement, state) => state, terminator: () => [] };
  complete(product.solve(chainBody(1), 0, kill, limits), { kind: "complete", value: {
    entry: [[]], exit: [[7]], reachable: [true],
  } }, "C2945 constant-bottom terminator kills entry while the actual exit retains boundary7");
});

test("all three actual statement arms pass through unchanged in forward or reverse order", () => {
  const body = parsedBody([{ kind: "return", value: null }], [[
    { kind: "assign", place: identities.placeId(0), value: { kind: "use", operand: { kind: "constant", constant: identities.constId(0) } } },
    { kind: "storage-live", local: identities.localId(0) }, { kind: "storage-dead", local: identities.localId(0) },
  ]]);
  for (const direction of ["forward", "backward"]) {
    const statements = [];
    complete(product.solve(body, 0, { ...scalarProblem(direction), statement: (statement, state) => {
      statements.push(statement); return state;
    } }, limits), { kind: "complete", value: { entry: [1], exit: [1], reachable: [true] } },
    `${direction} preserves actual complete block-boundary states`);
    complete(statements, direction === "forward" ? body.blocks[0].statements : [...body.blocks[0].statements].reverse(),
      `${direction} forwards every complete original statement payload rather than translating its arm`);
  }
});

test("backward preserves original duplicate successor slots and seeds each reachable exit independently", () => {
  const body = parsedBody([{ kind: "switch", operand: { kind: "constant", constant: identities.constId(0) },
    targets: [{ constant: identities.constId(1), target: identities.blockId(1) }], otherwise: identities.blockId(1) },
  { kind: "return", value: null }, { kind: "return", value: null }], [[], [], []]);
  const observed = [];
  const scalar = scalarProblem("backward");
  const problem = { ...scalar, terminator: (terminator, successors, boundaryState) => {
    observed.push({ kind: terminator.kind, successors, boundaryState });
    return scalar.terminator(terminator, successors, boundaryState);
  } };
  complete(product.solve(body, 0, problem, limits), { kind: "complete", value: {
    entry: [1, 1, 0], exit: [1, 1, 0], reachable: [true, true, false],
  } }, "duplicate CFG edges remain actual callback inputs while unreachable exit2 stays bottom");
  complete(observed, [{ kind: "return", successors: [], boundaryState: 1 },
    { kind: "switch", successors: [{ target: identities.blockId(1), state: 1 },
      { target: identities.blockId(1), state: 1 }], boundaryState: null }], "complete actual successor order and multiplicity");
  const exits = parsedBody([{ kind: "switch", operand: { kind: "constant", constant: identities.constId(0) },
    targets: [{ constant: identities.constId(1), target: identities.blockId(1) }], otherwise: identities.blockId(2) },
  { kind: "return", value: null }, { kind: "return", value: null }], [[], [], []]);
  complete(product.solve(exits, 0, scalarProblem("backward"), limits), { kind: "complete", value: {
    entry: [1, 1, 1], exit: [1, 1, 1], reachable: [true, true, true],
  } }, "both reachable exits receive the boundary; source block does not receive a fabricated seed");
});

test("content equality stabilizes cycles, duplicate returned edges join, and missing contributions are bottom", () => {
  const self = parsedBody([{ kind: "goto", target: identities.blockId(0) }], [[]]);
  const lattice = finiteLattice();
  let calls = 0;
  const problem = { direction: "forward", lattice, boundary: [1], statement: (unusedStatement, state) => state,
    terminator: (terminator, state) => { calls += 1; return [{ target: terminator.target, state: [...state] }]; } };
  complete(product.solve(self, 0, problem, limits), { kind: "complete", value: {
    entry: [[1]], exit: [[1]], reachable: [true],
  } }, "equal content in newly allocated states stabilizes");
  assert.equal(calls, 2, "one changed edge and one equal edge, not allocation-based requeue");
  const duplicate = { ...problem, terminator: terminator => [
    { target: terminator.target, state: [1] }, { target: terminator.target, state: [2] }] };
  complete(product.solve(self, 0, duplicate, limits), { kind: "complete", value: {
    entry: [[1, 2]], exit: [[1, 2]], reachable: [true],
  } }, "one declared edge joins all returned contributions rather than overwriting the first");
  complete(product.solve(chainBody(2), 0, { ...scalarProblem("forward"), terminator: () => [] }, limits),
    { kind: "complete", value: { entry: [1, 0], exit: [1, 0], reachable: [true, true] } },
    "structural reachability does not invent an omitted edge contribution");
  const reverse = { ...scalarProblem("backward"), boundary: -1 };
  complete(product.solve(self, 0, reverse, limits), { kind: "complete", value: {
    entry: [0], exit: [0], reachable: [true],
  } }, "an infinite reachable loop has no exit and never uses even an overflow boundary");
});

test("solve exactly admits hand-derived work/result boundaries in both directions and refuses every smaller allowance", () => {
  for (const direction of ["forward", "backward"]) for (const length of [1, 2, 3]) {
    const body = chainBody(length);
    const problem = scalarProblem(direction);
    const work = direction === "forward" ? 14 * length - 5 : 11 * length - 3;
    const entries = length * 3;
    const expected = { kind: "complete", value: { entry: Array(length).fill(1), exit: Array(length).fill(1),
      reachable: Array(length).fill(true) } };
    complete(product.solve(body, 0, problem, { maximumWork: work, maximumResultEntries: entries }), expected,
      `${direction} chain${length} exact literal event accounting`);
    complete(product.solve(body, 0, problem, { maximumWork: work + 1, maximumResultEntries: entries + 1 }), expected,
      `${direction} chain${length} one allowance above both requirements`);
    for (let maximumWork = 0; maximumWork < work; maximumWork += 1) {
      complete(product.solve(body, 0, problem, { maximumWork, maximumResultEntries: entries }),
        { kind: "resource-limit", dimension: "work", maximum: maximumWork }, `${direction} work ${maximumWork}`);
    }
    for (let maximumResultEntries = 0; maximumResultEntries < entries; maximumResultEntries += 1) {
      complete(product.solve(body, 0, problem, { maximumWork: work, maximumResultEntries }),
        { kind: "resource-limit", dimension: "result-entries", maximum: maximumResultEntries },
        `${direction} result entries ${maximumResultEntries}`);
    }
  }
});

test("every supplied overflow site produces the closed state refusal, never completed bottom", () => {
  const single = chainBody(1);
  const chain = chainBody(2);
  const self = parsedBody([{ kind: "goto", target: identities.blockId(0) }], [[]]);
  const statement = parsedBody([{ kind: "return", value: null }], [[{ kind: "storage-live", local: identities.localId(0) }]]);
  const forward = scalarProblem("forward");
  const backward = scalarProblem("backward");
  const cases = [
    ["bottom", single, { ...forward, lattice: { ...forward.lattice, bottom: -1 } }],
    ["forward boundary", single, { ...forward, boundary: -1 }],
    ["backward exit boundary", single, { ...backward, boundary: -1 }],
    ["forward boundary join", single, { ...forward, lattice: { ...forward.lattice, join: () => -1 } }],
    ["backward exit join", single, { ...backward, lattice: { ...backward.lattice, join: () => -1 } }],
    ["forward statement", statement, { ...forward, statement: () => -1 }],
    ["backward statement", statement, { ...backward, statement: () => -1 }],
    ["forward returned edge", chain, { ...forward, terminator: terminator => [{ target: terminator.target, state: -1 }] }],
    ["backward terminator", single, { ...backward, terminator: () => -1 }],
    ["forward incoming join", chain, { ...forward,
      lattice: { ...forward.lattice, join: (left, right) => right === 2 ? -1 : Math.max(left, right) },
      terminator: terminator => [{ target: terminator.target, state: 2 }] }],
    ["backward successor join", chain, { ...backward,
      lattice: { ...backward.lattice, join: (left, right) => right === 2 ? -1 : Math.max(left, right) },
      terminator: () => 2 }],
    ["duplicate returned-edge join", self, { direction: "forward", lattice: finiteLattice(1), boundary: [],
      statement: (unusedStatement, state) => state,
      terminator: terminator => [{ target: terminator.target, state: [1] }, { target: terminator.target, state: [2] }] }],
  ];
  for (const [name, body, problem] of cases) complete(product.solve(body, 0, problem, limits),
    { kind: "resource-limit", dimension: "state", maximum: 1 }, name);
  for (const direction of ["forward", "backward"]) {
    const lattice = finiteLattice(0);
    const problem = { ...scalarProblem(direction), lattice, boundary: [],
      terminator: direction === "forward" ? () => [] : (unusedTerminator, unusedSuccessors, boundaryState) => boundaryState };
    complete(product.solve(single, 0, problem, limits), { kind: "complete", value: {
      entry: [[]], exit: [[]], reachable: [true],
    } }, `${direction} state cardinality exactly0`);
    complete(product.solve(single, 0, { ...problem, boundary: [7], lattice: {
      ...lattice, isOverflow: state => state === null || state.length > 0 } }, limits),
    { kind: "resource-limit", dimension: "state", maximum: 0 }, `${direction} state cardinality past0`);
  }
  const one = finiteLattice(1);
  complete(product.solve(self, 0, { direction: "forward", lattice: one, boundary: [7],
    statement: (unusedStatement, state) => state,
    terminator: (terminator, state) => [{ target: terminator.target, state: [...state] }] }, limits),
  { kind: "complete", value: { entry: [[7]], exit: [[7]], reachable: [true] } }, "actual cardinality exactly1");
});

test("generic undefined/null states are values, empty bodies invoke no callbacks, and callback errors are not swallowed", () => {
  const body = chainBody(2);
  for (const bottom of [undefined, null]) {
    const overflow = Symbol("overflow");
    const problem = { direction: "forward", lattice: { bottom, overflow, stateBound: 0,
      join: (unusedLeft, right) => right, equals: Object.is, isOverflow: state => state === overflow },
    boundary: bottom, statement: (unusedStatement, state) => state,
    terminator: (terminator, state) => terminator.kind === "goto" ? [{ target: terminator.target, state }] : [] };
    complete(product.solve(body, 0, problem, limits), { kind: "complete", value: {
      entry: [bottom, bottom], exit: [bottom, bottom], reachable: [true, true],
    } }, "a stored undefined contribution is distinguished from an absent contribution");
  }
  for (const direction of ["forward", "backward"]) {
    const unexpected = () => { throw new Error("empty callback must not run"); };
    const problem = { direction, boundary: -1, statement: unexpected, terminator: unexpected,
      lattice: { bottom: -1, overflow: -1, stateBound: 0, join: unexpected, equals: unexpected, isOverflow: unexpected } };
    // A body without blocks has no entry: there is no execution to solve, and no block stands in for one.
    assert.throws(() => product.solve(parsedBody([], []), 0, problem, { maximumWork: 0, maximumResultEntries: 0 }),
      error => error instanceof Error && error.message.includes("the body offers no entry for the supplied count"), `${direction} empty domain`);
    const failure = new Error(`${direction} caller callback failed`);
    assert.throws(() => product.solve(chainBody(1), 0, { ...scalarProblem(direction), terminator: () => { throw failure; } }, limits),
      error => error === failure);
  }
  for (const field of ["maximumWork", "maximumResultEntries", "stateBound"]) {
    for (const value of [-1, 0.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      const problem = scalarProblem("forward");
      const budget = { ...limits };
      if (field === "stateBound") problem.lattice.stateBound = value;
      else budget[field] = value;
      assert.throws(() => product.solve(body, 0, problem, budget),
        { name: "TypeError", message: `${field} must be a nonnegative safe integer` });
    }
  }
  assert.throws(() => product.solve(body, 0, { ...scalarProblem("forward"),
    terminator: () => [{ target: identities.blockId(0), state: 1 }] }, limits),
  { name: "TypeError", message: "forward terminator target 0 is not an outgoing edge" });
  assert.throws(() => product.solve(body, 0, { ...scalarProblem("forward"), terminator: () => new Array(1) }, limits),
    { name: "TypeError", message: "terminator edge 0 is missing" });
});

test("a genuine sparse MIR statement row is a caller defect in both directions, beside a complete one-statement control", () => {
  const terminators = [{ kind: "return", value: null }];
  const sparse = fixtureBody(terminators, [[]]);
  sparse.blocks[0].statements = new Array(1);
  const present = parsedBody(terminators, [[{ kind: "storage-live", local: identities.localId(0) }]]);
  for (const direction of ["forward", "backward"]) {
    assert.throws(() => product.solve(sparse, 0, scalarProblem(direction), limits),
      { name: "TypeError", message: "statement 0 is missing" });
    complete(product.solve(present, 0, scalarProblem(direction), limits), { kind: "complete", value: {
      entry: [1], exit: [1], reachable: [true],
    } }, `${direction} retains a complete genuine statement input`);
  }
});

test("one header reuses its complete reverse closure across both tail orders and exact hand-derived limits", () => {
  const expected = { kind: "complete", value: [{ header: 0, backEdges: [3, 4], members: [0, 1, 2, 3, 4] }] };
  for (const tails of [[3, 4], [4, 3]]) {
    const graph = { successors: [[1], [2], tails, [0], [0]] };
    complete(product.naturalLoops(graph, 0, { maximumWork: 102, maximumResultEntries: 8 }), expected,
      "m2/k2: dom57 + tree24 + scan11 + shared closure10 =102; entries1+2+5=8");
    complete(product.naturalLoops(graph, 0, { maximumWork: 103, maximumResultEntries: 9 }), expected,
      "one allowance above both requirements");
    for (let maximumWork = 0; maximumWork < 102; maximumWork += 1) complete(
      product.naturalLoops(graph, 0, { maximumWork, maximumResultEntries: 8 }),
      { kind: "resource-limit", dimension: "work", maximum: maximumWork }, `same-header work${maximumWork}`);
    for (let maximumResultEntries = 0; maximumResultEntries < 8; maximumResultEntries += 1) complete(
      product.naturalLoops(graph, 0, { maximumWork: 102, maximumResultEntries }),
      { kind: "resource-limit", dimension: "result-entries", maximum: maximumResultEntries },
      `same-header entries${maximumResultEntries}`);
  }
  const chainLength = 1000;
  const tailCount = 1000;
  const vertices = Array.from({ length: chainLength + tailCount + 1 }, (unusedValue, index) => index);
  const tails = Array.from({ length: tailCount }, (unusedValue, index) => chainLength + index + 1);
  const graph = { successors: vertices.map(index => index < chainLength ? [index + 1]
    : index === chainLength ? tails : [0]) };
  complete(product.naturalLoops(graph, 0, { maximumWork: 46_010, maximumResultEntries: 3002 }),
    { kind: "complete", value: [{ header: 0, backEdges: tails, members: vertices }] },
    "21m+25k+10=46010 work and m+2k+2=3002 entries, not k repeated chain walks");
});

test("actual finite and scalar example lattices satisfy full join laws including absorbing overflow", () => {
  const families = [
    { lattice: finiteLattice(2), domain: [[], [1], [2], [1, 2], null], expected: [
      [[], [1], [2], [1, 2], null], [[1], [1], [1, 2], [1, 2], null],
      [[2], [1, 2], [2], [1, 2], null], [[1, 2], [1, 2], [1, 2], [1, 2], null], [null, null, null, null, null],
    ] },
    { lattice: finiteLattice(1), domain: [[], [1], [2], null], expected: [
      [[], [1], [2], null], [[1], [1], null, null], [[2], null, [2], null], [null, null, null, null],
    ] },
    { lattice: scalarProblem("forward").lattice, domain: [0, 1, -1], expected: [[0, 1, -1], [1, 1, -1], [-1, -1, -1]] },
  ];
  for (const { lattice, domain, expected } of families) {
    complete(domain.map(left => domain.map(right => lattice.join(left, right))), expected, "complete independently authored join table");
    complete(domain.map(state => lattice.isOverflow(state)), domain.map((unusedState, index) => index === domain.length - 1),
      "only the explicit top is overflow");
    for (const left of domain) {
      complete(lattice.join(left, left), left, "idempotence");
      complete(lattice.join(lattice.bottom, left), left, "left bottom identity");
      complete(lattice.join(left, lattice.bottom), left, "right bottom identity");
      complete(lattice.join(left, lattice.overflow), lattice.overflow, "right absorbing overflow");
      complete(lattice.join(lattice.overflow, left), lattice.overflow, "left absorbing overflow");
      for (const right of domain) {
        complete(lattice.join(left, right), lattice.join(right, left), "commutativity");
        for (const third of domain) complete(lattice.join(lattice.join(left, right), third),
          lattice.join(left, lattice.join(right, third)), "associativity over the complete finite domain");
      }
    }
  }
});

test("actual forward/backward example statement and edge transfers are monotone on complete finite domains", () => {
  const lattice = finiteLattice();
  const domain = [[]];
  for (const member of [1, 2, 3, 7]) domain.push(...domain.map(state => [...state, member]));
  domain.push(null);
  const below = (left, right) => left === null ? right === null : right === null || left.every(value => right.includes(value));
  const live = { ...site(), kind: "storage-live", local: identities.localId(0) };
  const dead = { ...site(), kind: "storage-dead", local: identities.localId(0) };
  const assign = { ...site(), kind: "assign", step: null, place: identities.placeId(0),
    value: { kind: "use", operand: { kind: "constant", constant: identities.constId(0) } } };
  const goto = { ...site(), kind: "goto", target: identities.blockId(1) };
  const branch = { ...site(), kind: "switch", operand: { kind: "constant", constant: identities.constId(0) },
    targets: [{ constant: identities.constId(1), target: identities.blockId(1) }], otherwise: identities.blockId(2) };
  const returned = { ...site(), kind: "return", value: null };
  const forwardStatement = unionStatement(lattice, 3);
  const backwardStatement = unionStatement(lattice, 1);
  const forwardEdges = unionForwardTerminator(lattice);
  const backwardEdges = unionBackwardTerminator(lattice);
  complete(domain.slice(0, 4).map(state => forwardStatement(live, state)), [[3], [1, 3], [2, 3], [1, 2, 3]],
    "actual forward live transfer has complete independent examples");
  complete(domain.slice(0, 4).map(state => backwardStatement(dead, state)), [[], [], [2], [2]],
    "actual backward dead transfer has complete independent examples");
  for (const left of domain) for (const right of domain) if (below(left, right)) {
    for (const statement of [assign, live, dead]) {
      assert.equal(below(forwardStatement(statement, left), forwardStatement(statement, right)), true, "forward statement monotonicity");
      assert.equal(below(backwardStatement(statement, left), backwardStatement(statement, right)), true, "backward statement monotonicity");
    }
    for (const terminator of [goto, branch, returned]) {
      const lesser = forwardEdges(terminator, left);
      const greater = forwardEdges(terminator, right);
      complete(lesser.map(edge => edge.target), greater.map(edge => edge.target), "same actual edge domain");
      assert.equal(lesser.every((edge, index) => below(edge.state, greater[index].state)), true, "per-edge forward monotonicity");
    }
    for (const boundaryState of [null, [7]]) assert.equal(below(
      backwardEdges(goto, [{ target: identities.blockId(1), state: left }], boundaryState),
      backwardEdges(goto, [{ target: identities.blockId(1), state: right }], boundaryState)), true,
    "actual backward successor join is monotone with either explicit seed disposition");
  }
  for (const direction of ["forward", "backward"]) {
    const problem = scalarProblem(direction);
    const scalarBelow = (left, right) => left === -1 ? right === -1 : right === -1 || left <= right;
    for (const left of [0, 1, -1]) for (const right of [0, 1, -1]) if (scalarBelow(left, right)) {
      assert.equal(scalarBelow(problem.statement(live, left), problem.statement(live, right)), true, "scalar statement monotonicity");
      if (direction === "forward") assert.equal(scalarBelow(problem.terminator(goto, left)[0].state,
        problem.terminator(goto, right)[0].state), true, "scalar forward edge monotonicity");
      else assert.equal(scalarBelow(problem.terminator(goto, [{ target: identities.blockId(1), state: left }], null),
        problem.terminator(goto, [{ target: identities.blockId(1), state: right }], null)), true, "scalar backward successor monotonicity");
    }
  }
});

test("cycle-specific limit events cover actual repeated transfer and predecessor scheduling", () => {
  const self = parsedBody([{ kind: "goto", target: identities.blockId(0) }], [[]]);
  const mutual = parsedBody([{ kind: "goto", target: identities.blockId(1) },
    { kind: "goto", target: identities.blockId(0) }], [[], []]);
  const backward = { ...scalarProblem("backward"), boundary: -1 };
  const generating = parsedBody([{ kind: "goto", target: identities.blockId(0) }],
    [[{ kind: "storage-live", local: identities.localId(0) }]]);
  const cases = [
    { body: self, problem: scalarProblem("forward"), work: 22, entry: [1], exit: [1] },
    { body: mutual, problem: scalarProblem("forward"), work: 36, entry: [1, 1], exit: [1, 1] },
    { body: self, problem: backward, work: 11, entry: [0], exit: [0] },
    { body: generating, problem: { ...backward, statement: () => 1 }, work: 18, entry: [1], exit: [1] },
  ];
  for (const entry of cases) {
    complete(product.solve(entry.body, 0, entry.problem, { maximumWork: entry.work, maximumResultEntries: 3 * entry.entry.length }),
      { kind: "complete", value: { entry: entry.entry, exit: entry.exit, reachable: entry.entry.map(() => true) } },
      `cycle ${entry.problem.direction} exact work${entry.work}`);
    for (let maximumWork = 0; maximumWork < entry.work; maximumWork += 1) complete(
      product.solve(entry.body, 0, entry.problem, { maximumWork, maximumResultEntries: 3 * entry.entry.length }),
      { kind: "resource-limit", dimension: "work", maximum: maximumWork }, `cycle work ${maximumWork}`);
  }
});

test("priority requeue handles several queued ranks, bottom-edge removal and unreachable backward predecessors", () => {
  const branching = parsedBody([
    { kind: "switch", operand: { kind: "constant", constant: identities.constId(0) },
      targets: [{ constant: identities.constId(1), target: identities.blockId(1) }], otherwise: identities.blockId(2) },
    { kind: "goto", target: identities.blockId(3) }, { kind: "goto", target: identities.blockId(0) },
    { kind: "goto", target: identities.blockId(4) }, { kind: "goto", target: identities.blockId(5) },
    { kind: "goto", target: identities.blockId(6) }, { kind: "goto", target: identities.blockId(1) },
  ], Array.from({ length: 7 }, () => []));
  const problem = { ...scalarProblem("forward"), terminator: (terminator, state) => terminator.kind === "switch"
    ? [{ target: identities.blockId(1), state }, { target: identities.blockId(2), state }]
    : [{ target: terminator.target, state }] };
  complete(product.solve(branching, 0, problem, limits), { kind: "complete", value: {
    entry: [1, 1, 1, 1, 1, 1, 1], exit: [1, 1, 1, 1, 1, 1, 1], reachable: [true, true, true, true, true, true, true],
  } }, "rank heap requeues an earlier rank while preserving all pending ranks");
  const lattice = finiteLattice();
  const changing = parsedBody([{ kind: "switch", operand: { kind: "constant", constant: identities.constId(0) },
    targets: [{ constant: identities.constId(1), target: identities.blockId(0) }], otherwise: identities.blockId(1) },
  { kind: "goto", target: identities.blockId(0) }], [[], [{ kind: "storage-live", local: identities.localId(0) }]]);
  complete(product.solve(changing, 0, { direction: "forward", lattice, boundary: [],
    statement: () => [1], terminator: (terminator, state) => terminator.kind === "goto"
      ? [{ target: terminator.target, state }]
      : [...(state.length === 0 ? [{ target: identities.blockId(0), state: [] }] : []),
        { target: identities.blockId(1), state }] }, limits), { kind: "complete", value: {
    entry: [[1], [1]], exit: [[1], [1]], reachable: [true, true],
  } }, "removing a previous bottom edge is still bottom, not a stale retained contribution");
  const unreachable = parsedBody([{ kind: "goto", target: identities.blockId(1) }, { kind: "return", value: null },
    { kind: "goto", target: identities.blockId(1) }], [[], [], []]);
  complete(product.solve(unreachable, 0, scalarProblem("backward"), limits), { kind: "complete", value: {
    entry: [1, 1, 0], exit: [1, 1, 0], reachable: [true, true, false],
  } }, "a changed entry never schedules an unreachable incoming predecessor");
});

test("work exhaustion bounds nonconverging caller transfers and never publishes a partial solution", () => {
  const self = parsedBody([{ kind: "goto", target: identities.blockId(0) }], [[]]);
  const problem = { ...scalarProblem("forward"), lattice: { ...scalarProblem("forward").lattice,
    stateBound: Number.MAX_SAFE_INTEGER, join: Math.max },
    terminator: (terminator, state) => [{ target: terminator.target, state: state + 1 }] };
  for (const maximumWork of [0, 1, 20, 100, 1000]) complete(product.solve(self, 0, problem,
    { maximumWork, maximumResultEntries: 3 }), { kind: "resource-limit", dimension: "work", maximum: maximumWork },
  `unbounded-height caller lattice still obeys exact work${maximumWork}`);
});

test("both solver directions retain complete hundred-thousand-block solutions without recursion", () => {
  const length = 100_000;
  const body = fixtureBody(Array.from({ length }, (unusedValue, index) => index + 1 < length
    ? { kind: "goto", target: identities.blockId(index + 1) } : { kind: "return", value: null }),
  Array.from({ length }, () => []));
  const expected = { kind: "complete", value: { entry: Array(length).fill(1), exit: Array(length).fill(1),
    reachable: Array(length).fill(true) } };
  for (const direction of ["forward", "backward"]) complete(product.solve(body, 0, scalarProblem(direction),
    { maximumWork: 3_000_000, maximumResultEntries: 300_000 }), expected, `${direction} complete deep solution`);
});

test("exact seven-port public inventory and complete eight-source owner compile in fresh strict isolation", async () => {
  complete(Object.keys(product).sort(), ["dominators", "graphOfMir", "naturalLoops", "orderGraph", "predecessors", "solve",
    "stronglyConnectedComponents"].sort(), "no legacy public path or unreceived runtime port");
  const deps = isolationDeps(tooling, quarantineRoots);
  const module = hostCatalogue.find(module => module.name === "dataflow");
  const report = await compileIsolated(deps, module, { root: repository, sourceFiles,
    interfaceSources, declarationSources, outputDirectory: ".temp/dataflow-isolation" });
  writeFileSync(resolve(repository, ".temp/dataflow-isolation-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  assert.equal(report.status, "passed", JSON.stringify(report.findings).slice(0, 4000));
  complete(report.sourceInventory.map(entry => relative(repository, entry.path)).sort(), [...sourceFiles, ...declarationSources].sort(),
    "eight owner files plus the exact native dependency-production closure");
  complete(report.provenance.map(entry => relative(repository, entry.source)).sort(), [...interfaceSources,
    "packages/host/src/ir-types/arena.ts", "packages/host/src/ir-types/data.ts", "packages/host/src/ir-types/native-facts-data.ts"].sort(),
    "public contracts retain their actual opaque and data declaration dependencies");
  assert.equal(report.loadedInventory.length > 21, true, "actual language declaration closure is nonempty");
  assert.equal(report.loadedInventory.every(path => report.expectedInventory.includes(path)), true);
});

test("actual emitted public declarations preserve generic ports, readonly results, brands and closed outcomes", () => {
  const deps = isolationDeps(tooling, quarantineRoots);
  const parent = resolve(repository, ".temp/dataflow-consumers");
  mkdirSync(parent, { recursive: true });
  const stage = mkdtempSync(resolve(parent, "case-"));
  writeFileSync(resolve(stage, "package.json"), '{"type":"module","private":true}\n');
  const declarationFiles = [...sourceFiles, ...interfaceSources,
    "packages/host/src/ir-types/arena.ts", "packages/host/src/ir-types/data.ts", "packages/host/src/ir-types/native-facts-data.ts"].map(path => path.replace("/src/", "/dist/")
    .replace(/\.ts$/u, ".d.ts"));
  const staged = [];
  for (const file of declarationFiles) {
    const local = file.replace("packages/host/dist/", "");
    const destination = resolve(stage, local);
    mkdirSync(resolve(destination, ".."), { recursive: true });
    copyFileSync(resolve(repository, file), destination);
    staged.push(destination);
  }
  const positive = `import * as Dataflow from "./dataflow/index.js";
import type * as Port from "./dataflow/contract.js";
import type { MirBody } from "./ir-mir/contract.js";
const ports: readonly [Port.Solve, Port.GraphOfMir, Port.Predecessors, Port.OrderGraph, Port.Dominators,
  Port.NaturalLoops, Port.StronglyConnectedComponents] = [Dataflow.solve, Dataflow.graphOfMir, Dataflow.predecessors,
  Dataflow.orderGraph, Dataflow.dominators, Dataflow.naturalLoops, Dataflow.stronglyConnectedComponents];
export function consume(body: MirBody, graph: Port.DirectedGraph, budget: Port.DataflowLimits): readonly boolean[] {
  const lattice: Port.Lattice<number> = { bottom: 0, overflow: -1, stateBound: 1,
    join: (left, right) => left === -1 || right === -1 ? -1 : Math.max(left, right),
    equals: Object.is, isOverflow: state => state === -1 };
  const forward: Port.ForwardProblem<number> = { direction: "forward", lattice, boundary: 1,
    statement: (statement, state) => statement.kind === "storage-live" ? 1 : state,
    terminator: (terminator, state) => terminator.kind === "goto" ? [{ target: terminator.target, state }] : [] };
  const backward: Port.BackwardProblem<number> = { direction: "backward", lattice, boundary: 1,
    statement: (statement, state) => statement.kind === "storage-dead" ? 0 : state,
    terminator: (terminator, successors, boundaryState) => terminator.kind === "return" && boundaryState !== null
      ? boundaryState : successors.reduce((state, successor) => lattice.join(state, successor.state), 0) };
  const directions: readonly Port.Problem<number>[] = [forward, backward];
  for (const problem of directions) {
    const result: Port.DataflowResult<Port.FlowSolution<number>> = Dataflow.solve(body, 0, problem, budget);
    if (result.kind === "complete") return result.value.reachable;
    const dimension: "work" | "result-entries" | "state" = result.dimension;
    const maximum: number = result.maximum;
    void dimension; void maximum;
  }
  const projected = Dataflow.graphOfMir(body);
  void projected; void ports; void Dataflow.predecessors(graph, budget); void Dataflow.orderGraph(graph, [0], budget);
  void Dataflow.dominators(graph, 0, budget); void Dataflow.naturalLoops(graph, 0, budget);
  void Dataflow.stronglyConnectedComponents(graph, budget);
  return [];
}
`;
  const programs = [{ file: "positive.mts", text: positive }];
  const negatives = [
    { file: "readonly-entry.mts", type: "FlowSolution<number>", body: "  value.entry[0] = 1;", code: 2542, column: 3 },
    { file: "readonly-exit.mts", type: "FlowSolution<number>", body: "  value.exit = [];", code: 2540, column: 9 },
    { file: "readonly-graph.mts", type: "DirectedGraph", body: "  value.successors.push([]);", code: 2339, column: 20 },
    { file: "removed-vertex-payload.mts", type: "DirectedGraph", body: "  value.vertices;", code: 2339, column: 9 },
    { file: "closed-result.mts", type: "DataflowResult<number>", body: "  value.partial;", code: 2339, column: 9 },
    { file: "closed-direction.mts", type: "Problem<number>",
      body: "  const wrong: Problem<number> = { ...value, direction: \"sideways\" };\n  void wrong;", code: 2322, column: 46 },
  ];
  for (const entry of negatives) programs.push({ file: entry.file, text:
    `import type { ${entry.type.replace(/<.*$/u, "")} } from "./dataflow/contract.js";\nexport function reject(value: ${entry.type}): void {\n${entry.body}\n}\n` });
  programs.push({ file: "edge-brand.mts", text:
    'import type { BlockState } from "./dataflow/contract.js";\nexport const wrong: BlockState<number> = { target: 0, state: 1 };\n' });
  const removedGeneric = 'export type Removed = DirectedGraph<number>;';
  programs.push({ file: "removed-generic-graph.mts", text:
    `import type { DirectedGraph } from "./dataflow/contract.js";\n${removedGeneric}\n` });
  programs.push({ file: "backward-boundary.mts", text:
    'import type { BackwardProblem } from "./dataflow/contract.js";\nimport type { MirTerminator } from "./ir-mir/contract.js";\nexport function reject(problem: BackwardProblem<number>, terminator: MirTerminator): number {\n  return problem.terminator(terminator, [], "seed");\n}\n' });
  const expected = [...negatives.map(entry => ({ file: entry.file, line: 3, column: entry.column, code: entry.code })),
    { file: "removed-generic-graph.mts", line: 2, column: removedGeneric.indexOf("DirectedGraph") + 1, code: 2315 },
    { file: "edge-brand.mts", line: 2, column: 44, code: 2322 },
    { file: "backward-boundary.mts", line: 4, column: 45, code: 2345 }];
  const files = programs.map(program => { const file = resolve(stage, program.file); writeFileSync(file, program.text); return file; });
  const config = resolve(stage, "tsconfig.json");
  writeFileSync(config, JSON.stringify({ compilerOptions: { strict: true, noUncheckedIndexedAccess: true,
    exactOptionalPropertyTypes: true, noUnusedLocals: true, noUnusedParameters: true, noImplicitReturns: true,
    noFallthroughCasesInSwitch: true, noEmit: true, skipLibCheck: false, target: "es2022", lib: ["es2022"],
    module: "nodenext", moduleResolution: "nodenext", types: [] }, files }));
  const result = spawnSync(process.execPath, [deps.compiler, "--project", config, "--listFiles", "--pretty", "false"], {
    cwd: stage, encoding: "utf8", timeout: 90_000, maxBuffer: 4_194_304,
  });
  assert.equal(result.error === undefined && result.signal === null, true, "the real strict declaration consumer terminated");
  const output = `${result.stdout}${result.stderr}`;
  writeFileSync(resolve(stage, "diagnostics.log"), output);
  const actual = [...output.matchAll(/^(.+)\((\d+),(\d+)\): error TS(\d+):/gmu)].map(match => ({
    file: basename(match[1]), line: Number(match[2]), column: Number(match[3]), code: Number(match[4]),
  }));
  const order = rows => rows.sort((left, right) => left.file < right.file ? -1 : left.file > right.file ? 1
    : left.line - right.line || left.column - right.column);
  complete(order(actual), order(expected), output.slice(0, 4000));
  assert.equal(result.status, 1, "the complete compiler outcome is its diagnostic refusal, not an unrelated nonzero exit");
  complete(output.split(/\r?\n/u).filter(line => /\berror TS\d+:/u.test(line) &&
    !/^.+\(\d+,\d+\): error TS\d+:/u.test(line)), [], "no extra unlocated compiler failure is ignored");
  const loaded = result.stdout.split(/\r?\n/u).filter(path => path.startsWith("/"));
  const allowed = new Set([...files, ...staged, ...deps.platform.language]);
  assert.equal(loaded.length > files.length, true);
  assert.equal(loaded.every(path => allowed.has(realpathSync(path))), true, "no stale, undeclared private or foreign input loaded");
});

after(async () => {
  try {
    const capture = await post("Profiler.takePreciseCoverage");
    const urls = new Set(runtimeFiles.map(path => pathToFileURL(path).href));
    const result = capture.result.filter(script => urls.has(script.url));
    const sources = [];
    for (const script of result) {
      const actual = await post("Debugger.getScriptSource", { scriptId: script.scriptId });
      sources.push({ scriptId: script.scriptId, url: script.url, text: actual.scriptSource });
    }
    await post("Profiler.stopPreciseCoverage");
    const raw = [{ ...capture, result, sources }];
    const report = checkCoverage({ canonical: realpathSync, readText: path => readFileSync(path, "utf8"), parse: parseSources,
      project: (url, text) => ({ path: fileURLToPath(url), text }) },
    [...runtimeFiles, resolve(repository, "packages/host/src/dataflow/contract.ts")], raw);
    const directory = resolve(repository, ".temp/dataflow-coverage");
    mkdirSync(directory, { recursive: true });
    writeFileSync(resolve(directory, "raw-v8.json"), `${JSON.stringify(raw)}\n`);
    writeFileSync(resolve(directory, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
    writeFileSync(resolve(directory, "source-inputs.json"), `${JSON.stringify(sourceFiles.map(path => ({ path,
      hash: createHash("sha256").update(readFileSync(resolve(repository, path))).digest("hex") })), null, 2)}\n`);
    assert.equal(result.length, 7, "all seven real runtime owners have nonempty source-identified V8 evidence");
    assert.equal(report.status, "passed", JSON.stringify(report.findings).slice(0, 6000));
    assert.equal(report.files.filter(file => file.status === "not-applicable").length, 1, "the type-only contract is N/A");
    for (const file of report.files.filter(file => file.status === "covered")) {
      assert.equal(file.lines, 100, basename(file.path));
      assert.equal(file.branches, 100, basename(file.path));
      assert.equal(file.functions, 100, basename(file.path));
    }
  } finally {
    session.disconnect();
  }
});

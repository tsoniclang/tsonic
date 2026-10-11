import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles } from "@tsonic/tsts";
import { createTargetSourceProgram, Node_Initializer } from "../../packages/target-api/dist/public/source.js";
import { createSourceStorageBudget, defaultSourceStorageLimits } from "../../packages/target-api/dist/target-analysis/source-storage/resource-budget.js";
import { createSourceStorageTransport } from "../../packages/target-api/dist/target-analysis/source-storage/transport.js";

const chain = `
class Chain {
  constructor(public parent: Chain | undefined, public value: object) {}
}
function build(parent: Chain, depth: number): Chain {
  return depth <= 0 ? parent : build(new Chain(parent, parent.value), depth - 1);
}
const leftValue = { left: 1 };
const rightValue = { right: 1 };
const left = build(new Chain(undefined, leftValue), 8);
const right = build(new Chain(undefined, rightValue), 9);
const leftRead = left.value;
const rightRead = right.value;
`;

function fixture(limits = {}) {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src",
    compilerOptions: { strict: true, target: "es2022", module: "esnext" },
    files: { "/src/index.ts": `export {}; ${chain}` },
  }).checkSource();
  assert.equal(checked.diagnostics.length === 0, true, "ordinary recursive class source checks without annotations");
  const source = createTargetSourceProgram(checked);
  const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits,
    maximumSteps: 65_536, maximumTransportRows: 4096, ...limits });
  const transport = createSourceStorageTransport(source, source.navigation.sourceFiles, budget);
  const pending = [...source.navigation.sourceFiles];
  const nodes = [];
  while (pending.length !== 0) {
    const node = pending.pop();
    nodes.push(node);
    source.ast.forEachChild(node, child => { if (child !== undefined) pending.push(child); });
  }
  const constructor = nodes.find(node => source.ast.is.IsConstructorDeclaration(node));
  const parent = transport.subject(source.ast.parameters(constructor)[0], "input");
  const subject = name => transport.subjectFor(Node_Initializer(source.ast, nodes.find(node =>
    source.ast.is.IsVariableDeclaration(node) && source.ast.text(source.ast.name(node)) === name)));
  return { budget, transport, parent, subject };
}

test("an exact recursive constructor-input frontier stops before unrelated transitive value closure", () => {
  const current = fixture({ maximumSteps: 1024 });
  let calls = 0;
  const selected = current.transport.substitutions.walk(current.parent, current.transport.substitutions.empty, input => {
    calls += 1;
    return input.subject === current.parent;
  });
  assert.equal(selected !== undefined && selected.origins.size === 1 && selected.origins.has(current.parent), true,
    "the exact external input is retained, not invented empty evidence or an arbitrary ancestor");
  assert.equal(selected.subjects.some(input => input.subject === current.parent && input.contributes), true,
    "the stopping witness preserves its original contributing identity");
  assert.equal(calls === 1, true, "one canonical scoped input has one frontier decision");
  assert.equal(current.budget.failure() === undefined, true, "the original finite budget protects only actually demanded work");
});

test("a stopped publication trace does not replace complete values or import another recursive caller", () => {
  const current = fixture();
  const selected = current.transport.substitutions.walk(current.parent, current.transport.substitutions.empty,
    input => input.subject === current.parent);
  assert.equal(selected?.origins.has(current.parent), true);
  for (const [name, own, foreign] of [["leftRead", "leftValue", "rightValue"], ["rightRead", "rightValue", "leftValue"]]) {
    const origins = current.transport.substitutions.origins(current.subject(name), current.transport.substitutions.empty);
    assert.equal(origins !== undefined && origins.has(current.subject(own)) && !origins.has(current.subject(foreign)), true,
      `${name}: a bounded trace never publishes an unfinished or mixed complete value family`);
    const traced = current.transport.substitutions.walk(current.subject(name), current.transport.substitutions.empty);
    assert.equal(traced !== undefined && traced.origins.size === origins.size && [...traced.origins].every(origin => origins.has(origin)), true,
      `${name}: an unstopped relation walk preserves every exact complete origin`);
  }
  assert.equal(current.budget.failure() === undefined, true);
});

test("a throwing frontier unwinds query ownership and a failed work owner cannot fabricate a stopped result", () => {
  const current = fixture({ maximumSteps: 4096 });
  const failure = new Error("exact frontier failure");
  assert.throws(() => current.transport.substitutions.walk(current.parent, current.transport.substitutions.empty,
    () => { throw failure; }), error => error === failure);
  const selected = current.transport.substitutions.walk(current.parent, current.transport.substitutions.empty,
    input => input.subject === current.parent);
  assert.equal(selected?.origins.has(current.parent), true, "unwind releases traversal state without losing canonical identities");
  while (current.budget.step()) {}
  assert.equal(current.transport.substitutions.walk(current.parent, current.transport.substitutions.empty, () => true) === undefined, true,
    "a known failed owner still rejects before publishing any stopped evidence");
  assert.match(current.budget.failure(), /analysis-work/u);
});

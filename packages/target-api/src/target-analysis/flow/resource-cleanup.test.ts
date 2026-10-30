import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, type Node } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../../source-semantics/target-source-program.js";
import { createSourceControlFlow, createSourceControlFlowDomain } from "./graph.js";
import { sourceNodesOutsideErasedSubtrees } from "../../source-navigation/callable-invocations.js";
import { analyzeSourceDefiniteAssignment, analyzeSourceLiveness } from "./instances.js";
import type { SourceControlFlowGraph, SourceFlowPoint } from "./model.js";
import { sourceFlowStatement } from "./statements.js";
import { SourceFlowFailure } from "./resources.js";

function fixture(body: string, declaration = "function run(flag: boolean): void") {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/index.ts": `class Resource { [Symbol.dispose](): void {} }
      class AsyncResource { async [Symbol.asyncDispose](): Promise<void> {} }
      declare function observe(value: unknown): void;
      declare function after(): void;
      ${declaration} { ${body} }`,
  }, compilerOptions: { strict: true, target: "esnext", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length, 0, "resource fixture is a checked source program");
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  assert.equal(file !== undefined, true, "resource fixture source exists");
  const nodes: Node[] = [];
  const visit = (node: Node): void => {
    nodes.push(node);
    source.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  visit(file!);
  const owner = nodes.find(node => source.ast.is.IsFunctionDeclaration(node) && source.ast.text(source.ast.name(node)) === "run");
  assert.equal(owner !== undefined, true, "resource fixture callable exists");
  const selection = createSourceControlFlow(source, owner!, { domain: { kind: "source" } });
  assert.equal(selection.kind, "resolved", selection.kind === "unresolved" ? selection.reason : "checked cleanup graph");
  if (selection.kind !== "resolved") throw new Error("Expected the checked resource flow graph.");
  const named = (name: string): Node => {
    const node = nodes.find(selected => source.ast.is.IsVariableDeclaration(selected) && source.ast.text(source.ast.name(selected)) === name);
    assert.equal(node !== undefined, true, `checked resource binding ${name}`);
    return node!;
  };
  const points = (predicate: (point: SourceFlowPoint) => boolean) => selection.graph.points.filter(predicate);
  const disposal = (name: string) => points(point => point.operation.kind === "dispose" && point.operation.declaration === named(name));
  const calls = (name: string) => points(point => point.operation.kind === "evaluate" && point.source !== undefined &&
    source.ast.is.IsCallExpression(point.source) && source.ast.text(source.ast.as.AsCallExpression(point.source)?.Expression) === name);
  return { source, owner: owner!, nodes, graph: selection.graph, named, points, disposal, calls };
}

function reachable(graph: SourceControlFlowGraph<unknown>, start: number, destination: number,
  blocked: ReadonlySet<number> = new Set(), exceptions = false): boolean {
  const pending = [start];
  const visited = new Set<number>();
  while (pending.length !== 0) {
    const point = pending.pop()!;
    if (visited.has(point) || blocked.has(point)) continue;
    if (point === destination) return true;
    visited.add(point);
    for (const edge of graph.points[point]!.successors) {
      if (exceptions || edge.kind !== "exception") pending.push(edge.to);
    }
  }
  return false;
}

test("cleanup keeps implicit resource reads live and disposes in reverse acquisition order", () => {
  const current = fixture("using first = new Resource(); observe(first); using second = new Resource(); after();");
  const after = current.calls("after")[0]!;
  const first = current.disposal("first");
  const second = current.disposal("second");
  assert.equal(first.length > 0 && second.length > 0, true, "both selected resources have cleanup points");
  const normalSecond = second.find(point => reachable(current.graph, after.id, point.id))!;
  assert.equal(normalSecond !== undefined, true, "normal completion enters second cleanup");
  assert.equal(first.some(point => reachable(current.graph, normalSecond.id, point.id)), true, "second cleanup precedes first cleanup");
  assert.equal(second.some(point => first.some(previous => reachable(current.graph, previous.id, point.id))), false, "first cleanup never precedes second cleanup");
  const liveness = analyzeSourceLiveness(current.graph, new Map());
  assert.equal(liveness.kind, "resolved", "resource liveness resolves");
  if (liveness.kind !== "resolved") throw new Error("Expected resource liveness.");
  const observed = current.points(point => point.operation.kind === "read" && point.source !== undefined &&
    current.source.ast.is.IsIdentifier(point.source) && current.source.ast.text(point.source) === "first")[0]!;
  assert.equal(liveness.lastUses.has(observed.source!), false, "an observed resource remains live until implicit cleanup");
  const assignments = analyzeSourceDefiniteAssignment(current.graph);
  assert.equal(assignments.kind, "resolved", "resource assignment resolves");
  if (assignments.kind !== "resolved") throw new Error("Expected resource assignment.");
  assert.equal(assignments.unassignedReads.size, 0, "cleanup reads only acquired resource bindings");
});

test("failed acquisition cleans earlier resources but never the unacquired resource", () => {
  const current = fixture("using first = new Resource(), second = new Resource(); after();");
  for (const [name, earlier] of [["first", undefined], ["second", "first"]] as const) {
    const initializer = current.source.ast.as.AsVariableDeclaration(current.named(name))?.Initializer;
    const acquisition = current.points(point => point.source === initializer && point.operation.kind === "evaluate")[0]!;
    const failure = acquisition.successors.find(edge => edge.kind === "exception")!;
    assert.equal(failure !== undefined, true, `${name}: checked acquisition failure exists`);
    assert.equal(current.disposal(name).some(point => reachable(current.graph, failure.to, point.id, new Set(), true)), false,
      `${name}: failed acquisition cannot enter its cleanup`);
    if (earlier !== undefined) assert.equal(current.disposal(earlier).some(point => reachable(current.graph, failure.to, point.id, new Set(), true)), true,
      `${name}: failed acquisition cleans the earlier resource`);
  }
});

test("return and throw flow through acquired cleanup before the selected completion", () => {
  for (const completion of ["return;", "throw new Error('body');"]) {
    const current = fixture(`using resource = new Resource(); ${completion}`);
    const abrupt = current.points(point => point.operation.kind === "return" || point.operation.kind === "throw")[0]!;
    const destination = completion.startsWith("return") ? current.graph.exit : current.graph.exceptionExit;
    const cleanups = current.disposal("resource");
    assert.equal(cleanups.some(point => reachable(current.graph, abrupt.id, point.id, new Set(), true)), true, `${completion}: cleanup is on the abrupt route`);
    assert.equal(reachable(current.graph, abrupt.id, destination, new Set(), true), true, `${completion}: original completion remains reachable`);
    assert.equal(cleanups.some(point => reachable(current.graph, point.id, current.graph.exceptionExit, new Set(), true)), true,
      `${completion}: cleanup failure reaches the exception route`);
  }
});

test("continue and break clean the iteration resource without ending an enclosing resource lifetime", () => {
  const current = fixture(`using outer = new Resource(); loop: while (flag) {
    using inner = new Resource(); if (flag) continue loop; break;
  } observe(outer);`);
  const loop = current.nodes.find(node => current.source.ast.is.IsWhileStatement(node))!;
  const anchor = current.points(point => point.source === loop && point.operation.kind === "merge")[0]!;
  const outerCleanup = new Set(current.disposal("outer").map(point => point.id));
  const continuation = current.points(point => point.successors.some(edge => edge.kind === "continue"))[0]!;
  const breaking = current.points(point => point.successors.some(edge => edge.kind === "break"))[0]!;
  assert.equal(current.disposal("inner").some(point => reachable(current.graph, continuation.id, point.id, outerCleanup)), true,
    "continue cleans the current iteration resource");
  assert.equal(reachable(current.graph, continuation.id, anchor.id, outerCleanup), true, "continue resumes the loop before outer cleanup");
  assert.equal(current.disposal("inner").some(point => reachable(current.graph, breaking.id, point.id, outerCleanup)), true,
    "break cleans the current iteration resource");
  assert.equal(reachable(current.graph, breaking.id, current.calls("observe")[0]!.id, outerCleanup), true,
    "break returns to the enclosing resource scope");
});

test("for-initializer cleanup surrounds the entire loop rather than each continue", () => {
  const current = fixture("for (using resource = new Resource(); flag;) { if (flag) continue; break; } after();");
  const loop = current.nodes.find(node => current.source.ast.is.IsForStatement(node))!;
  const anchor = current.points(point => point.source === loop && point.operation.kind === "merge")[0]!;
  const blocked = new Set(current.disposal("resource").map(point => point.id));
  const continuation = current.points(point => point.successors.some(edge => edge.kind === "continue"))[0]!;
  const breaking = current.points(point => point.successors.some(edge => edge.kind === "break"))[0]!;
  assert.equal(reachable(current.graph, continuation.id, anchor.id, blocked), true, "continue retains the for-initializer resource");
  assert.equal(current.disposal("resource").some(point => reachable(current.graph, breaking.id, point.id)), true,
    "breaking the complete loop disposes its initializer resource");
  assert.equal(reachable(current.graph, breaking.id, current.calls("after")[0]!.id), true, "after-loop execution remains reachable");
});

test("for-of acquisition and cleanup occur for each selected iteration binding", () => {
  const current = fixture("for (using resource of [new Resource()]) { observe(resource); if (flag) continue; break; }");
  const resource = current.named("resource");
  const writes = current.points(point => point.operation.kind === "write" && point.operation.binding === resource);
  assert.equal(writes.length, 1, "one checked write activates each iteration resource");
  const continuation = current.points(point => point.successors.some(edge => edge.kind === "continue"))[0]!;
  assert.equal(current.disposal("resource").some(point => reachable(current.graph, continuation.id, point.id)), true,
    "continue disposes the current iteration before another acquisition");
  const assignments = analyzeSourceDefiniteAssignment(current.graph);
  assert.equal(assignments.kind, "resolved", "iteration resource assignment resolves");
  if (assignments.kind !== "resolved") throw new Error("Expected iteration assignment.");
  assert.equal(assignments.unassignedReads.size, 0, "iteration cleanup never reads an unacquired binding");
});

test("async generator suspension keeps resources alive and closes through awaited cleanup", () => {
  const current = fixture("await using resource = new AsyncResource(); yield 1; observe(resource);",
    "async function* run(flag: boolean): AsyncGenerator<number, void, unknown>");
  const suspension = current.points(point => point.operation.kind === "yield")[0]!;
  const resume = suspension.successors.find(edge => edge.kind === "resume")!;
  const closing = suspension.successors.find(edge => edge.kind === "return")!;
  const cleanups = current.disposal("resource");
  const observed = current.calls("observe")[0]!;
  assert.equal(reachable(current.graph, resume.to, observed.id, new Set(cleanups.map(point => point.id))), true,
    "normal resume observes the resource before cleanup");
  assert.equal(reachable(current.graph, closing.to, observed.id, new Set(), true), false, "generator close does not resume its body");
  assert.equal(cleanups.some(point => reachable(current.graph, closing.to, point.id, new Set(), true)), true,
    "generator close reaches selected cleanup");
  for (const cleanup of cleanups) {
    assert.equal(cleanup.operation.kind === "dispose" && cleanup.operation.asynchronous, true, "await-using cleanup retains asynchronous source evidence");
    const success = cleanup.successors.find(edge => edge.kind === "normal")!;
    assert.equal(current.graph.points[success.to]!.operation.kind, "await", "cleanup invocation is followed by awaited completion");
  }
});

test("cleanup inside try runs before finally for returns and disposal failures", () => {
  const current = fixture("try { using resource = new Resource(); return; } finally { after(); }");
  const cleanups = current.disposal("resource");
  const finalizers = current.calls("after");
  for (const cleanup of cleanups) {
    assert.equal(finalizers.some(point => reachable(current.graph, cleanup.id, point.id, new Set(), true)), true,
      "every normal or exceptional cleanup route reaches finally");
  }
  const abrupt = current.points(point => point.operation.kind === "return")[0]!;
  assert.equal(reachable(current.graph, abrupt.id, current.graph.exit), true, "finally preserves the pending return");
});

test("nullable cleanup reads its binding once and branches before invoking the selected disposer", () => {
  const current = fixture("using resource: Resource | null = flag ? new Resource() : null; after();");
  const resource = current.named("resource");
  const branches = current.points(point => point.source === resource && point.operation.kind === "branch");
  assert.equal(branches.length > 0, true, "nullable resource has cleanup dispatch");
  for (const branch of branches) {
    const absent = branch.successors.find(edge => edge.kind === "nullish")!;
    const present = branch.successors.find(edge => edge.kind === "present")!;
    assert.equal(absent !== undefined && present !== undefined, true, "cleanup preserves the one native absence branch");
    assert.equal(current.graph.points[present.to]!.operation.kind, "dispose", "present cleanup invokes the selected disposal operation");
    assert.equal(current.graph.points[absent.to]!.operation.kind === "dispose", false, "absent cleanup skips disposal");
  }
});

test("direct resource lists require their lexical cleanup route instead of immediate disposal", () => {
  const current = fixture("using resource = new Resource(); after();");
  const list = current.nodes.find(node => current.source.ast.is.IsVariableDeclarationList(node) &&
    current.source.ast.variableDeclarationKind(node) === "using");
  assert.equal(list !== undefined, true, "the real checked declaration list is retained");
  assert.throws(() => sourceFlowStatement({ source: current.source } as Parameters<typeof sourceFlowStatement>[0],
    list!, current.graph.exit, {} as Parameters<typeof sourceFlowStatement>[3]),
  error => error instanceof SourceFlowFailure && error.message === "Resource acquisition requires its checked lexical cleanup scope.");
});

test("switch resource cleanup follows only acquired clause suffixes and preserves fall-through", () => {
  const current = fixture(`switch (flag) {
    case true: { using earlier = new Resource(); observe(earlier); }
    default: { using later = new Resource(); observe(later); break; }
  } after();`);
  const laterReads = current.calls("observe").filter(point =>
    current.source.ast.text(current.source.ast.arguments(point.source!)[0]) === "later");
  const earlierCleanup = new Set(current.disposal("earlier").map(point => point.id));
  const cases = current.points(point => point.operation.kind === "branch" &&
    current.source.ast.is.IsCaseClause(point.source));
  assert.equal(cases.length, 1, "the checked explicit case has one dispatch branch");
  const switchNode = current.nodes.find(node => current.source.ast.is.IsSwitchStatement(node))!;
  const defaultDispatch = current.points(point => point.source === switchNode && point.operation.kind === "merge")[0]!;
  const defaultDestination = defaultDispatch.successors.find(edge => edge.kind === "default")!.to;
  assert.equal(current.disposal("earlier").some(point => reachable(current.graph, defaultDestination, point.id)), false,
    "entering the later clause never cleans the unacquired earlier binding");
  assert.equal(laterReads.some(point => reachable(current.graph, defaultDestination, point.id, earlierCleanup)), true,
    "direct default entry evaluates its own acquired suffix");
  const laterCleanup = current.disposal("later");
  assert.equal(laterCleanup.some(point => laterReads.some(read => reachable(current.graph, read.id, point.id))), true,
    "break cleans the resource acquired in the later clause");
  const earlierRead = current.calls("observe").find(point =>
    current.source.ast.text(current.source.ast.arguments(point.source!)[0]) === "earlier")!;
  assert.equal(laterReads.some(point => reachable(current.graph, earlierRead.id, point.id)), true,
    "fall-through executes the later source clause");
  assert.equal(current.disposal("earlier").some(cleanup => reachable(current.graph, earlierRead.id, cleanup.id) &&
    laterReads.some(read => reachable(current.graph, cleanup.id, read.id))), true,
  "the earlier lexical block cleans its resource before falling through to the later block");
  for (const cleanup of laterCleanup) assert.equal(cleanup.successors.some(edge =>
    edge.kind !== "exception" && reachable(current.graph, edge.to, cleanup.id)), false,
  "a cleanup point cannot recur on the acyclic exit route");
});

test("selected native resource domains omit erased acquisition and preserve the real cleanup route", () => {
  const current = fixture("using erased = new Resource(); using retained = new Resource(); observe(retained); after();");
  const erased = current.named("erased");
  const retained = current.named("retained");
  const selected = sourceNodesOutsideErasedSubtrees(current.source.ast, current.nodes, node => node === erased);
  assert.equal(selected.kind, "resolved", "the original source participation owner closes erased descendants");
  if (selected.kind !== "resolved") throw new Error("Expected the original selected resource inventory.");
  const domain = createSourceControlFlowDomain(current.source, selected.nodes);
  assert.equal(domain.kind, "resolved", "the identical checked selected inventory is admitted");
  if (domain.kind !== "resolved") throw new Error("Expected the checked resource domain.");
  const result = createSourceControlFlow(current.source, current.owner, { domain: domain.domain });
  assert.equal(result.kind, "resolved", "the same cleanup graph handles the actual native domain");
  if (result.kind !== "resolved") throw new Error("Expected the selected resource flow graph.");
  const excluded = new Set(current.nodes.filter(node => !selected.nodes.includes(node)));
  assert.equal(result.graph.points.some(point => point.source !== undefined && excluded.has(point.source)), false,
    "erased acquisition, initializer and cleanup create no native points");
  assert.equal(result.graph.bindings.has(erased), false, "an erased resource contributes no native owned binding");
  const disposal = result.graph.points.filter(point => point.operation.kind === "dispose" && point.operation.declaration === retained);
  assert.equal(disposal.length > 0, true, "the genuinely acquired resource keeps every required cleanup route");
  const after = result.graph.points.find(point => point.operation.kind === "evaluate" && point.source !== undefined &&
    current.source.ast.is.IsCallExpression(point.source) &&
    current.source.ast.text(current.source.ast.as.AsCallExpression(point.source)?.Expression) === "after");
  assert.equal(after !== undefined, true, "the participating body retains its original effect");
  assert.equal(disposal.some(point => reachable(result.graph, after!.id, point.id)), true,
    "normal completion still performs native cleanup after the last real use");
  assert.equal(current.disposal("erased").length > 0, true,
    "explicit full-source mode retains its original acquisition and cleanup contract");
});

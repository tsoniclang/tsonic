import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles } from "@tsonic/tsts";
import { createTargetSourceProgram, Node_Initializer } from "../../packages/target-api/dist/public/source.js";
import { createSourceStorageBudget, defaultSourceStorageLimits } from "../../packages/target-api/dist/target-analysis/source-storage/resource-budget.js";
import { createSourceStorageTransport } from "../../packages/target-api/dist/target-analysis/source-storage/transport.js";
import { createSourceStorageExecutionRegions } from "../../packages/target-api/dist/target-analysis/source-storage/execution-regions.js";

function fixture(body) {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src",
    compilerOptions: { strict: true, target: "es2022", module: "esnext" },
    files: { "/src/index.ts": `export {}; ${body}` },
  }).checkSource();
  assert.equal(checked.diagnostics.length === 0, true, "ordinary authored source checks without execution annotations");
  const source = createTargetSourceProgram(checked);
  const budget = createSourceStorageBudget(defaultSourceStorageLimits);
  const transport = createSourceStorageTransport(source, source.navigation.sourceFiles, budget);
  assert.equal(budget.failure() === undefined, true, "checked execution construction fits its original bounds");
  const named = (name, predicate) => transport.visitedNodes.find(node => predicate(node) && source.ast.text(source.ast.name(node)) === name);
  return { source, budget, transport, named };
}

test("one execution index retains module, unused-result, nested-closure and default invocation identities", () => {
  const current = fixture(`
    function create(): object { return {}; }
    function write(value: object): void {}
    function outer(value: object = create()): () => void {
      write(value);
      const deferred = () => write(value);
      return deferred;
    }
    const callback = outer();
  `);
  const { ast } = current.source;
  const outer = current.named("outer", ast.is.IsFunctionDeclaration);
  const body = ast.body(outer);
  const parameter = ast.parameters(outer)[0];
  const initializer = Node_Initializer(ast, parameter);
  const deferred = current.named("deferred", ast.is.IsVariableDeclaration);
  const closure = Node_Initializer(ast, deferred);
  const closureBody = ast.body(closure);
  const file = ast.getSourceFile(outer);
  for (const region of [file, body, initializer, closureBody]) {
    const invocations = [...current.transport.regions.invocationsIn(region) ?? []];
    assert.equal(invocations.length === 1, true, "one original checked invocation belongs to exactly its authored region");
    assert.equal(current.transport.regions.enclosing(invocations[0]) === region, true, "the inverse index uses the same lexical owner");
    assert.equal(current.transport.invocations.has(invocations[0]), true);
  }
  const direct = [...current.transport.regions.invocationsIn(body)];
  const nested = [...current.transport.regions.invocationsIn(closureBody)];
  assert.equal(direct[0] !== nested[0] && !direct.includes(nested[0]), true,
    "creating a closure does not execute its separate writer even when its source call is otherwise identical");
  const entered = current.transport.regions.callable(outer, [...current.transport.regions.invocationsIn(file)][0]);
  assert.equal(entered.includes(body) && entered.includes(initializer) && !entered.includes(closureBody), true,
    "selected callable execution includes a missing argument's default, not a returned closure body");
});

test("instance initializers and accessor writes/reads share the exact execution-region index", () => {
  const current = fixture(`
    function create(): object { return {}; }
    class Box {
      value = create();
      get current(): object { return this.value; }
      set current(value: object) { this.value = value; }
      constructor() { create(); }
    }
    const box = new Box();
    box.current = create();
    const selected = box.current;
  `);
  const { ast } = current.source;
  const field = current.named("value", ast.is.IsPropertyDeclaration);
  const initializer = Node_Initializer(ast, field);
  const calls = [...current.transport.regions.invocationsIn(initializer) ?? []];
  assert.equal(calls.length === 1 && calls[0] === initializer, true, "initializer calls execute in the initializer region itself");
  const construction = current.transport.visitedNodes.find(ast.is.IsNewExpression);
  assert.equal(current.transport.regions.instance(construction).some(region => region.node === initializer), true);
  const file = ast.getSourceFile(field);
  const moduleInvocations = [...current.transport.regions.invocationsIn(file) ?? []];
  assert.equal(moduleInvocations.length === 4, true, "construction, RHS call, getter and setter all have original source identities");
  const accessors = [...current.transport.accessorTargets.keys()];
  assert.equal(accessors.length === 2 && accessors.every(node => moduleInvocations.includes(node)), true,
    "unused setter return and selected getter return are both actual checked invocations");
  const constructor = current.transport.visitedNodes.find(ast.is.IsConstructorDeclaration);
  assert.equal([...current.transport.regions.invocationsIn(ast.body(constructor)) ?? []].length === 1, true);
});

test("execution index reservations reject atomically and cannot resume after construction is sealed", () => {
  const current = fixture("function read(): object { return {}; } const value = read();");
  const invocation = [...current.transport.invocations][0];
  const file = current.source.ast.getSourceFile(invocation);
  const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, maximumTransportRows: 2 });
  const regions = createSourceStorageExecutionRegions(current.source, budget);
  assert.equal(regions.enclosing(invocation) === file, true, "one row is retained by the canonical lexical cache");
  regions.recordInvocation(invocation);
  assert.match(budget.failure(), /transport-row/u);
  assert.equal(regions.invocationsIn(file) === undefined, true, "no partial region-to-invocation index is published");
  const sealedBudget = createSourceStorageBudget(defaultSourceStorageLimits);
  const sealed = createSourceStorageExecutionRegions(current.source, sealedBudget);
  sealed.recordInvocation(invocation);
  sealed.recordInvocation(invocation);
  assert.equal([...sealed.invocationsIn(file)].length === 1, true, "repeated evidence is indexed once");
  sealed.seal();
  assert.equal([...sealed.invocationsIn(file)].length === 1, true, "sealing preserves completed read-only evidence");
  sealed.recordInvocation(invocation);
  assert.match(sealedBudget.failure(), /after construction is sealed/u);
  assert.equal(sealed.invocationsIn(file) === undefined, true, "failed construction owners cannot bypass rejection through cached reads");
});

test("selected defaults and failed region resolution cannot manufacture executed invocation evidence", () => {
  const current = fixture(`
    function create(): object { return {}; }
    function outer(value: object = create()): object { return value; }
    const explicit = outer({}); const absent = outer(undefined); const missing = outer();
  `);
  const { ast } = current.source;
  const outer = current.named("outer", ast.is.IsFunctionDeclaration);
  const body = ast.body(outer);
  const initializer = Node_Initializer(ast, ast.parameters(outer)[0]);
  for (const [name, defaults] of [["explicit", false], ["absent", true], ["missing", true]]) {
    const invocation = Node_Initializer(ast, current.named(name, ast.is.IsVariableDeclaration));
    const entered = current.transport.regions.callable(outer, invocation);
    assert.equal(entered.length === (defaults ? 2 : 1) && entered.includes(body) && entered.includes(initializer) === defaults, true,
      "default execution follows the checked argument selection, not the existence of source syntax alone");
  }
  const invocation = Node_Initializer(ast, current.named("missing", ast.is.IsVariableDeclaration));
  const file = ast.getSourceFile(invocation);
  const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, maximumSteps: 1 });
  const regions = createSourceStorageExecutionRegions(current.source, budget);
  regions.recordInvocation(invocation);
  assert.match(budget.failure(), /analysis-work/u);
  assert.equal(regions.invocationsIn(file) === undefined, true, "failed lexical selection cannot publish a partial inverse region entry");
  const unresolvedBudget = createSourceStorageBudget(defaultSourceStorageLimits);
  const unresolved = createSourceStorageExecutionRegions(current.source, unresolvedBudget);
  unresolved.recordInvocation(file);
  assert.equal(unresolvedBudget.failure() === "Source storage execution requires its exact checked invocation region.", true);
  assert.equal(unresolved.invocationsIn(file) === undefined, true, "a source file cannot be guessed to be its own invocation region");
});

test("default execution uses top-level checked absence rather than nested generic type variables", () => {
  const current = fixture(`
    function withDefault<Value>(value: Value | undefined = undefined): Value | undefined { return value; }
    function constrained<Value extends object>(input: Value): Value | undefined {
      const checked = withDefault(input); return checked;
    }
    function unconstrained<Value>(input: Value): Value | undefined {
      const uncertain = withDefault(input); return uncertain;
    }
    function container<Value>(input: Value[]): Value[] | undefined {
      const sequence = withDefault(input); return sequence;
    }
    declare const maybe: object | undefined;
    const nullable = withDefault(maybe);
  `);
  const { ast } = current.source;
  const target = current.named("withDefault", ast.is.IsFunctionDeclaration);
  const initializer = Node_Initializer(ast, ast.parameters(target)[0]);
  const body = ast.body(target);
  for (const [name, defaults] of [["checked", false], ["uncertain", true], ["sequence", false], ["nullable", true]]) {
    const invocation = Node_Initializer(ast, current.named(name, ast.is.IsVariableDeclaration));
    const entered = current.transport.regions.callable(target, invocation);
    assert.equal(entered.length === (defaults ? 2 : 1) && entered.includes(body) && entered.includes(initializer) === defaults, true,
      `${name}: exact absence eligibility is independent of generic variables inside a definite native container`);
  }
  assert.equal(current.budget.failure() === undefined, true);
});

import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, type Node } from "@tsonic/tsts";
import { createTargetSourceProgram } from "./target-source-program.js";
import { selectSourceGuardedValueMembers } from "./value-flow-conditions.js";
import { selectSourceNativeValueGuard } from "./native-value-guards.js";

function fixture(body: string) {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: { "/src/index.ts": `
    declare function observe(value: unknown): void;
    declare function execute(): void;
    declare function wait(): Promise<void>;
    async function run(other: unknown): Promise<void> {
      let value: unknown = undefined;
      const change = (next: unknown): void => { value = next; };
      change(other);
      ${body}
    }
  ` }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.deepEqual(checked.diagnostics, []);
  assert.deepEqual(checked.extensionDiagnostics, []);
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  assert.ok(file);
  const reads: Node[] = [];
  const visit = (node: Node): void => {
    const call = source.semantics.forNode(node).operations.call(node);
    if (call !== undefined && source.ast.text(call.sourceCallee.expression) === "observe") {
      assert.ok(call.sourceArguments[0]);
      reads.push(call.sourceArguments[0].expression);
    }
    source.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  visit(file);
  const context = { ast: source.ast, navigation: source.navigation, sourceFacts: source.sourceFacts,
    semanticsFor: (node: Node) => source.semantics.forNode(node) };
  return reads.map(reference => selectSourceGuardedValueMembers(context, reference, ["string", "object", "absence"], expression => {
    const guard = selectSourceNativeValueGuard(context, expression);
    return guard?.kind === "literal" ? { sourceOperand: guard.sourceOperand, predicate: guard } : undefined;
  }, (member, predicate) => member === predicate.category ? undefined : predicate.negated));
}

test("captured writes do not erase a stable immediate native literal guard", () => {
  for (const body of [
    'if (value === "route") observe(value);',
    'if (value === "route" || value === "router") { observe(value); }',
    'if ("route" === value || "router" === value) { const pure = false; observe(value); }',
    'value === "route" ? observe(value) : undefined;',
    'value === "route" && observe(value);',
    'while (other) { if (value === "route") observe(value); change(other); }',
  ]) assert.deepEqual(fixture(body), [["string"]], body);
});

test("captured guards reject writes, invocations, suspension, nested execution and mixed predicates", () => {
  for (const body of [
    'if (value === "route") { change(other); observe(value); }',
    'if (value === "route") { execute(); observe(value); }',
    'if (value === "route") { await wait(); observe(value); }',
    'if (value === "route") { value = other; observe(value); }',
    'if (value === "route") { const later = () => observe(value); later(); }',
    'if (value === "route" || other === "router") observe(value);',
    'if (value === "route" || execute() === undefined) observe(value);',
    'if (value === "route") while (other) { observe(value); change(other); }',
    'if (value === "route") do { observe(value); change(other); } while (other);',
    'if (value === "route") for (; other;) { observe(value); change(other); }',
    'if (value === "route") for (const next of [other]) { observe(value); change(next); }',
    'if (value === "route") for (const key in { other }) { observe(value); change(key); }',
  ]) assert.deepEqual(fixture(body), [undefined], body);
  assert.deepEqual(fixture('if (value !== "route") observe(value);'), [["string", "object", "absence"]]);
});

test("absence guard operands use their declared type rather than a stale captured refinement", () => {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: { "/src/index.ts": `
    function run(): void {
      let value: string | undefined = undefined;
      const change = (next: string): void => { value = next; };
      change("route");
      if (value === "route") return;
      if (value === undefined) return;
    }
  ` }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.deepEqual(checked.diagnostics, []);
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  assert.ok(file);
  const guards: ReturnType<typeof selectSourceNativeValueGuard>[] = [];
  const visit = (node: Node): void => {
    if (source.ast.is.IsIfStatement(node)) {
      const expression = source.ast.as.AsIfStatement(node)?.Expression;
      assert.ok(expression);
      guards.push(selectSourceNativeValueGuard({ ast: source.ast, navigation: source.navigation,
        semanticsFor: selected => source.semantics.forNode(selected) }, expression));
    }
    source.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  visit(file);
  assert.deepEqual(guards.map(guard => guard?.kind), ["literal", "absence"]);
  assert.ok(guards.every(guard => guard !== undefined && source.ast.text(guard.sourceOperand) === "value"));
});

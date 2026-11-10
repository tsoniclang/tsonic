import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, type Node } from "@tsonic/tsts";
import { createTargetSourceProgram } from "./target-source-program.js";
import { selectSourceNativeValueGuard } from "./native-value-guards.js";
import { selectSourceGuardedValueMembers } from "./value-flow-conditions.js";

test("native value guards retain exact operands, categories and nominal declaration identity", () => {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/model.ts": "export class Entry {}",
    "/src/alias.ts": 'export { Entry as Selected } from "./model.js";',
    "/src/index.ts": `
import { Selected } from "./alias.js";
declare function observe(value: unknown): void;
function run(value: unknown, other: unknown): void {
  if (typeof (value) === "string") observe(value);
  if ("object" !== (typeof value)) observe(value);
  if (typeof value == "function") observe(value);
  if ("number" != typeof value) observe(value);
  if ((value) instanceof (Selected)) observe(value);
  if (typeof other === "string") observe(value);
  if (typeof value === "string") { value = other; observe(value); }
  if (value === other) observe(value);
}
`,
  }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.deepEqual(checked.diagnostics, []);
  assert.deepEqual(checked.extensionDiagnostics, []);
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  assert.ok(file);
  const comparisons: Node[] = [];
  const reads: Node[] = [];
  const visit = (node: Node): void => {
    if (source.ast.is.IsBinaryExpression(node)) comparisons.push(node);
    if (source.ast.is.IsCallExpression(node)) {
      const call = source.semantics.forNode(node).operations.call(node);
      if (source.ast.text(call?.sourceCallee.expression) === "observe" && call?.sourceArguments[0] !== undefined) reads.push(call.sourceArguments[0].expression);
    }
    source.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  visit(file);
  const context = { ast: source.ast, navigation: source.navigation, sourceFacts: source.sourceFacts,
    semanticsFor: (node: Node) => source.semantics.forNode(node) };
  const guards = comparisons.map(node => selectSourceNativeValueGuard(context, node));
  assert.deepEqual(guards.slice(0, 4).map(guard => guard?.kind === "typeof" ? [guard.value, guard.negated] : undefined),
    [["string", false], ["object", true], ["function", false], ["number", true]]);
  assert.ok(guards.slice(0, 7).every(guard => guard === undefined || Object.isFrozen(guard)));
  const nominal = guards.find(guard => guard?.kind === "nominal");
  assert.ok(nominal?.kind === "nominal");
  assert.equal(source.ast.kindName(nominal.declaration), "KindClassDeclaration");
  assert.equal(source.ast.getFileName(source.ast.getSourceFile(nominal.declaration)), "/src/model.ts");
  assert.equal(source.ast.text(nominal.sourceConstructor), "Selected");
  assert.equal(source.navigation.sourceReferenceFor(nominal.sourceConstructor)?.declaration, nominal.declaration);
  assert.equal(guards[guards.length - 1], undefined);
  const select = (reference: Node) => selectSourceGuardedValueMembers(context, reference, ["string", "object", "function", "number"],
    expression => {
      const guard = selectSourceNativeValueGuard(context, expression);
      return guard?.kind === "typeof" ? { sourceOperand: guard.sourceOperand, predicate: guard } : undefined;
    }, (member, predicate) => (member === predicate.value) !== predicate.negated);
  assert.deepEqual(reads.slice(0, 4).map(select), [["string"], ["string", "function", "number"], ["function"], ["string", "object", "function"]]);
  assert.equal(select(reads[5]!), undefined);
  assert.equal(select(reads[6]!), undefined);
});

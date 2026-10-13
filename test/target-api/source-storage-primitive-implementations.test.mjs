import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../../packages/target-api/dist/public/source.js";
import { createSourceStorageTransport } from "../../packages/target-api/dist/target-analysis/source-storage/transport/transport.js";
import { createSourceStorageBudget, defaultSourceStorageLimits } from "../../packages/target-api/dist/target-analysis/source-storage/model/resource-budget.js";

function fixture(text) {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src",
    compilerOptions: { strict: true, target: "es2022", module: "esnext" },
    files: { "/src/index.ts": `export {}; ${text}` },
  }).checkSource();
  assert.equal(checked.diagnostics.length === 0, true, formatDiagnostics(checked.diagnostics));
  const source = createTargetSourceProgram(checked);
  const budget = createSourceStorageBudget(defaultSourceStorageLimits);
  const transport = createSourceStorageTransport(source, source.navigation.sourceFiles, budget);
  const invocation = transport.visitedNodes.find(node => source.ast.is.IsCallExpression(node));
  assert.equal(invocation !== undefined, true, "one exact checked method invocation");
  return { source, budget, transport, invocation };
}

for (const type of ["string", "number", "boolean", "bigint", "symbol"]) {
  test(`a checked ${type} method has no authored implementation frontier to discover through value origins`, () => {
    const { source, budget, transport, invocation } = fixture(`function convert(value: ${type}): string {
      return value.toString();
    }`);
    let reads = 0;
    const implementations = transport.invocationImplementations(invocation, subject => {
      reads += 1;
      return transport.ancestorSubjects(subject);
    });
    assert.equal(implementations.size === 0 && reads === 0, true,
      "primitive value provenance cannot manufacture an authored native method body");
    const boundary = transport.boundaries.find(boundary => boundary.invocation === invocation);
    const receiver = source.semantics.forNode(invocation).operations.call(invocation).sourceCalleeAccess.receiver.expression;
    assert.equal(boundary?.kind === "opaque-invocation" && boundary.subjects.includes(transport.subjectFor(receiver)), true,
      "selected native invocation and exact receiver effects remain an explicit boundary");
    assert.equal(budget.failure() === undefined, true, "original independent analysis guards remain intact");
  });
}

test("a source class with a primitive-looking name still requires exact authored receiver implementation evidence", () => {
  const { source, budget, transport, invocation } = fixture(`
    class String { toString(): string { return "authored"; } }
    const value = new String(); const result = value.toString();
  `);
  let reads = 0;
  const implementations = transport.invocationImplementations(invocation, subject => {
    reads += 1;
    return transport.ancestorSubjects(subject);
  });
  const method = transport.visitedNodes.find(node => source.ast.is.IsMethodDeclaration(node));
  assert.equal(implementations.size === 1 && implementations.has(method) && reads > 0, true,
    "class spellings never substitute for checked primitive type evidence");
  assert.equal(transport.boundaries.some(boundary => boundary.invocation === invocation), false,
    "the authored method remains a real project implementation");
  assert.equal(budget.failure() === undefined, true);
});

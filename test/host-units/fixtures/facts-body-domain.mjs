import assert from "node:assert/strict";
import { bodyNodes } from "../../../packages/host/dist/ir-facts/verify-body-nodes.js";
import { accountFailure, createAccount, refuseAccount, remainingWork } from "../../../packages/host/dist/dataflow/index.js";
import { encodeBodyId, encodeDefId, encodeModuleId, encodePackageId } from "../../../packages/host/dist/ids/index.js";

import { scaled } from "./lower-mir/programs/added.mjs";

const module = encodeModuleId({ package: encodePackageId("body-domain"), path: "main.ts" });
const definition = encodeDefId({ module, segments: [{ name: "inner", ordinal: 0 }] });
const nested = encodeBodyId({ owner: definition, role: "function", ordinal: 0 });
const account = (maximumWork = 10000, maximumResultEntries = 10000) => createAccount({ maximumWork, maximumResultEntries });

function body(kind) {
  const parameter = { kind: "Parameter", id: 3 };
  Object.defineProperty(parameter, "tsonic", { get() { assert.fail("Nested parameter/default payload is not this execution's occurrence."); } });
  const block = { kind: "Block", id: 4 };
  Object.defineProperty(block, "tsonic", { get() { assert.fail("The nested callable's body is not the creator execution."); } });
  const declaration = { kind, id: 2, modifiers: null, asteriskToken: null, name: null, postfixToken: null, typeParameters: null,
    parameters: { nodes: [parameter] }, type: null, fullSignature: null, body: block,
    equalsGreaterThanToken: { kind: "EqualsGreaterThanToken", id: 5, tsonic: null },
    tsonic: kind === "FunctionExpression" || kind === "ArrowFunction"
      ? { callable: { template: { body: nested } } } : { template: { body: nested } } };
  const literal = { kind: "NumericLiteral", id: 7, text: "1", tokenFlags: [], tsonic: { convertedType: 0 } };
  const root = { kind: "SourceFile", id: 0, tsonic: { module, template: null },
    statements: { nodes: [declaration, { kind: "ExpressionStatement", id: 6, tsonic: null, expression: literal }] },
    endOfFileToken: { kind: "EndOfFile", id: 1, tsonic: null } };
  return { root, params: [], nestedBodies: [nested] };
}

export async function bodyDomainCases(suite) {
await suite.test("Facts source domain excludes each nested callable's parameters and defaults, not creator values", () => {
  for (const kind of ["FunctionDeclaration", "FunctionExpression", "ArrowFunction", "Constructor", "MethodDeclaration", "GetAccessor", "SetAccessor"]) {
    const result = bodyNodes(body(kind), account());
    assert.equal(result.kind, "complete");
    assert.equal(result.value.nodes.has(2), true, kind);
    assert.equal(result.value.nodes.has(3), false, kind);
    assert.equal(result.value.nodes.has(4), false, kind);
    assert.deepEqual([...result.value.valueNodes], [7]);
  }
});

await suite.test("Facts source domain preserves original refusal before syntax, with cumulative work and row bounds", () => {
  const stopped = account();
  const refusal = { kind: "refused", diagnostics: [] };
  refuseAccount(stopped, refusal);
  const unread = new Proxy({}, { get() { assert.fail("No source read after the actual original refusal."); } });
  assert.equal(bodyNodes(unread, stopped), refusal);
  for (const dimension of ["work", "result-entries"]) {
    for (const maximum of [0, 1, 2, 3, 4, 5]) {
      const current = account(dimension === "work" ? maximum : 10000, dimension === "result-entries" ? maximum : 10000);
      const result = bodyNodes(body("FunctionDeclaration"), current);
      assert.equal(result.kind, "resource-limit");
      assert.equal(result.dimension, dimension);
      assert.equal(result, accountFailure(current));
      assert.equal(bodyNodes(unread, current), result);
    }
  }
});

await suite.test("Facts source domain retains actual selected headers without executing their separate initializer", () => {
  const { program, child } = scaled();
  const tir = program.tir;
  Object.defineProperty(child.tir.root, "tsonic", { get() { assert.fail("A parameter initializer remains a separate execution."); } });
  const work = 1 + 1 + 2 + 10 + 18;
  const rows = 4 + 1 + 2 + 20 + 18;
  const exact = account(work, rows);
  const result = bodyNodes(tir, exact);
  assert.equal(result.kind, "complete");
  assert.equal(remainingWork(exact), 0, "entry + nested/header rows + ten syntax nodes + eighteen iterator pulls");
  for (const parameter of tir.params) {
    assert.equal(result.value.nodes.get(parameter.id), parameter);
    assert.equal(result.value.nodes.get(parameter.name.id), parameter.name);
  }
  assert.equal(result.value.nodes.has(child.tir.root.id), false);
  assert.equal(result.value.nodes.size, 10);
  const unread = new Proxy({}, { get() { assert.fail("No source read after the actual original refusal."); } });
  for (const dimension of ["work", "result-entries"]) {
    for (let maximum = 0; maximum < (dimension === "work" ? work : rows); maximum++) {
      const current = account(dimension === "work" ? maximum : work, dimension === "result-entries" ? maximum : rows);
      const stopped = bodyNodes(tir, current);
      assert.equal(stopped.kind, "resource-limit");
      assert.equal(stopped.dimension, dimension);
      assert.equal(stopped, accountFailure(current));
      assert.equal(bodyNodes(unread, current), stopped);
    }
  }
  const shared = account(work * 2);
  assert.equal(bodyNodes(tir, shared).kind, "complete");
  assert.equal(bodyNodes(tir, shared).kind, "complete");
  assert.equal(remainingWork(shared), 0);
  const stopped = bodyNodes(unread, shared);
  assert.equal(stopped, accountFailure(shared));
  assert.equal(stopped.kind, "resource-limit");
});

await suite.test("Facts source domain rejects a sparse selected-header inventory rather than silently omitting its body", () => {
  const { program } = scaled();
  program.tir.params = Array(1);
  assert.throws(() => bodyNodes(program.tir, account()), {
    name: "TypeError", message: "ir-facts: selected parameter inventory must be dense.",
  });
});
}

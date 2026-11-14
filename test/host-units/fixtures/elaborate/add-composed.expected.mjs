import assert from "node:assert/strict";

const header = node => ({ id: node.id, origin: node.origin, parent: node.parent, flags: node.flags, loc: node.loc });
const emptyVector = () => ({ classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] });

export function expectedComposedAdd(hir, run) {
  const F = run.float64;
  assert.equal(hir.params.length, 2, "add has two parameter rows");
  for (const row of hir.params) {
    assert.equal(row.role, "required", "each parameter row is required");
    assert.equal(row.passing, "by-value", "each parameter row is passed by value");
    assert.equal(row.initializer, null, "no parameter has an initializer");
  }
  assert.deepEqual(hir.locals.map(local => local.role), ["parameter", "parameter"], "the body's locals are its two parameters");
  assert.deepEqual(hir.params.map(row => row.local), hir.locals.map(local => local.id), "row i names local i");
  assert.equal(hir.captures.length, 0);
  assert.equal(hir.nestedBodies.length, 0);
  assert.equal(hir.asynchronous, false);
  assert.equal(hir.generator, false);
  const root = hir.root;
  assert.equal(root.kind, "Block");
  assert.equal(root.statements.nodes.length, 1, "the block holds one statement");
  const returned = root.statements.nodes[0];
  assert.equal(returned.kind, "ReturnStatement");
  const binary = returned.expression;
  assert.equal(binary.kind, "BinaryExpression");
  assert.equal(binary.operatorToken.kind, "PlusToken");
  for (const [operand, text, position] of [[binary.left, "a", 0], [binary.right, "b", 1]]) {
    assert.equal(operand.kind, "Identifier");
    assert.equal(operand.text, text);
    assert.equal(operand.tsonic.role, "value");
    assert.deepEqual(operand.tsonic.resolution, { kind: "local", local: { body: hir.body, local: hir.params[position].local } });
  }

  const value = () => ({ type: F, convertedType: F, conversion: { kind: "identity" }, narrowing: null, evidenceIndex: null, demand: { kind: "always" } });
  const name = node => ({ ...header(node), kind: "Identifier", text: node.text,
    tsonic: { role: "value", resolution: { kind: "local", local: node.tsonic.resolution.local }, ...value() } });
  const decision = { kind: "selected", operation: { kind: "native-operator", operator: "+", carrier: "float64" }, operands: [F, F], result: F,
    execution: { kind: "pure" } };
  const typedBinary = { ...header(binary), kind: "BinaryExpression", modifiers: null, type: null, left: name(binary.left),
    operatorToken: { ...header(binary.operatorToken), kind: "PlusToken", tsonic: null }, right: name(binary.right),
    tsonic: { role: "arithmetic", operation: { kind: "decided", decision: { decision, permissionScope: null } }, ...value() } };
  const typedRoot = { ...header(root), kind: "Block", multiLine: root.multiLine, tsonic: null,
    statements: { loc: root.statements.loc, nodes: [{ ...header(returned), kind: "ReturnStatement", expression: typedBinary, tsonic: null }] } };
  return {
    body: hir.body, owner: hir.owner, bindings: { kind: "parametric" }, lexicalBindings: emptyVector(), dependence: "parametric",
    signature: run.signature, completion: F, yielded: null, sent: null,
    params: hir.params.map(row => ({ local: row.local, declaration: row.declaration, role: "required", passing: "by-value", initializer: null, storage: F })),
    locals: hir.locals.map(local => ({ id: local.id, declaration: local.declaration, name: local.name, role: "parameter", capturedFrom: null,
      mutable: local.mutable, storage: F })),
    root: typedRoot, nestedBodies: [], captures: [], scopes: hir.scopes, evidence: [], asynchronous: false, generator: false,
  };
}

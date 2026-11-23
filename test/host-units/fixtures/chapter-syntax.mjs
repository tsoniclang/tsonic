import assert from "node:assert/strict";

export function readyModuleRoot(tree) {
  assert.equal(tree.kind, "ready-root");
  return tree.root;
}

export function readyModuleStatements(root) {
  assert.equal(root.kind, "SourceFile");
  return root.statements.nodes.map(slot => {
    assert.equal(slot.kind === "ready-statement" || slot.kind === "ready-callable", true);
    return slot.node;
  });
}

export function readyDefaultRoot(formal) {
  assert.equal(formal.initializer.kind, "ready-default");
  return formal.initializer.root;
}

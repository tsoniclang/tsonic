import assert from "node:assert/strict";
import test from "node:test";
import { createSourceStorageStructuralFlow } from "../../packages/target-api/dist/target-analysis/source-storage/structural-flow.js";
import { createSourceStorageSubjects } from "../../packages/target-api/dist/target-analysis/source-storage/subjects.js";
import { createSourceStorageBudget, defaultSourceStorageLimits } from "../../packages/target-api/dist/target-analysis/source-storage/resource-budget.js";

test("structural Error flow never queries a declaration outside checked-file ownership", () => {
  const file = {};
  const checked = {};
  const detached = {};
  const foreign = {};
  const subject = createSourceStorageSubjects(createSourceStorageBudget(defaultSourceStorageLimits).subject, () => assert.fail("unexpected subject rejection"));
  const source = { ast: { name: () => undefined, getSourceFile: node => node === detached ? undefined : node === foreign ? foreign : file,
    is: { IsObjectLiteralExpression: () => false, IsArrayLiteralExpression: () => false } },
    semantics: { includes: selected => selected === file, forFile: selected => {
      assert.equal(selected === file, true, "unowned semantic query");
      return { declarations: { declaredValueType: node => {
        assert.equal(node === checked, true, "unowned declaration query");
        return undefined;
      } }, types: { expressionType: () => undefined } };
    } } };
  const flow = createSourceStorageStructuralFlow(source, () => true, subject, () => assert.fail("unproven structural edge"),
    selected => source.ast.getSourceFile(selected.node), () => assert.fail("unproven checked context"));
  flow(subject(detached), subject(checked));
  flow(subject(foreign), subject(checked));
});

test("recursive structural Error flow retains selected generic property types even for synthetic declaration identities", () => {
  const file = {};
  const roots = [{}, {}];
  const outer = [{}, {}];
  const inner = [{}, {}];
  const fields = [{}, {}, {}, {}];
  const checkedContexts = new Map();
  const subject = createSourceStorageSubjects(createSourceStorageBudget(defaultSourceStorageLimits).subject, () => assert.fail("unexpected subject rejection"));
  const edges = [];
  let queries = 0;
  let flow;
  const member = (source, destination, from, to) => ({ kind: "present",
    source: { read: "property", declarations: [source], property: { type: from } },
    destination: { read: "property", declarations: [destination], property: { type: to } } });
  const semantics = { sourceFile: file,
    declarations: { declaredValueType: node => node === roots[0] ? outer[0] : node === roots[1] ? outer[1] : undefined },
    types: { expressionType: () => undefined, isUnion: () => false, isTuple: () => false, isArrayLike: () => false,
      structuralMembers: (from, to) => {
      queries += 1;
      if (from === outer[0] && to === outer[1]) return { kind: "available", members: [member(fields[0], fields[1], inner[0], inner[1])] };
      assert.equal(from === inner[0] && to === inner[1], true, "exact selected inner types");
      return { kind: "available", members: [member(fields[2], fields[3], inner[0], inner[0])] };
    } } };
  const source = { ast: { name: () => undefined, getSourceFile: node => roots.includes(node) ? file : undefined,
    is: { IsGetAccessorDeclaration: () => false, IsObjectLiteralExpression: () => false, IsArrayLiteralExpression: () => false } },
    semantics: { includes: selected => selected === file, forFile: selected => {
      assert.equal(selected === file, true, "synthetic nodes retain their checked-file semantic owner");
      return semantics;
    } } };
  const connect = (from, to) => {
    edges.push([from.node, to.node]);
    flow(from, to);
  };
  flow = createSourceStorageStructuralFlow(source, () => true, subject, connect,
    selected => source.ast.getSourceFile(selected.node) ?? checkedContexts.get(selected.node),
    (node, selected) => {
      assert.equal(selected === file, true, "exact checked structural relation owner");
      const previous = checkedContexts.get(node);
      assert.equal(previous === undefined || previous === selected, true, "one checked synthetic declaration owner");
      checkedContexts.set(node, selected);
      return true;
    });
  flow(subject(roots[0]), subject(roots[1]));
  assert.equal(queries, 2);
  assert.equal(edges.length, 2);
  assert.equal(edges[0][0] === fields[0] && edges[0][1] === fields[1], true);
  assert.equal(edges[1][0] === fields[2] && edges[1][1] === fields[3], true);
});

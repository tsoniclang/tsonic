import assert from "node:assert/strict";
import test from "node:test";
import { createSourceErrorStructuralFlow } from "../../packages/target-api/dist/target-analysis/error-storage/error-structural-flow.js";
import { createSourceErrorStorageSubjects } from "../../packages/target-api/dist/target-analysis/error-storage/error-storage-subjects.js";

test("structural Error flow never queries a declaration outside checked-file ownership", () => {
  const file = {};
  const checked = {};
  const detached = {};
  const foreign = {};
  const subject = createSourceErrorStorageSubjects();
  const source = { ast: { name: () => undefined, getSourceFile: node => node === detached ? undefined : node === foreign ? foreign : file },
    semantics: { includes: selected => selected === file, forNode: node => {
      assert.equal(node === checked, true, "unowned semantic query");
      return { declarations: { declaredValueType: () => undefined }, types: { expressionType: () => undefined } };
    } } };
  const flow = createSourceErrorStructuralFlow(source, () => true, subject, () => assert.fail("unproven structural edge"));
  flow(subject(detached), subject(checked));
  flow(subject(foreign), subject(checked));
});

test("recursive structural Error flow retains selected generic property types even for synthetic declaration identities", () => {
  const file = {};
  const roots = [{}, {}];
  const outer = [{}, {}];
  const inner = [{}, {}];
  const fields = [{}, {}, {}, {}];
  const subject = createSourceErrorStorageSubjects();
  const edges = [];
  let queries = 0;
  let flow;
  const member = (source, destination, from, to) => ({ kind: "present",
    source: { read: "property", declarations: [source], property: { type: from } },
    destination: { read: "property", declarations: [destination], property: { type: to } } });
  const semantics = { declarations: { declaredValueType: node => node === roots[0] ? outer[0] : outer[1] },
    types: { isUnion: () => false, isTuple: () => false, isArrayLike: () => false,
      structuralMembers: (from, to) => {
      queries += 1;
      if (from === outer[0] && to === outer[1]) return { kind: "available", members: [member(fields[0], fields[1], inner[0], inner[1])] };
      assert.equal(from === inner[0] && to === inner[1], true, "exact selected inner types");
      return { kind: "available", members: [member(fields[2], fields[3], inner[0], inner[0])] };
    } } };
  const source = { ast: { name: () => undefined, getSourceFile: node => roots.includes(node) ? file : undefined,
    is: { IsGetAccessorDeclaration: () => false } },
    semantics: { includes: selected => selected === file, forNode: node => {
      assert.equal(roots.includes(node), true, "synthetic nodes have no checked-file semantic owner");
      return semantics;
    } } };
  const connect = (from, to) => {
    edges.push([from.node, to.node]);
    flow(from, to);
  };
  flow = createSourceErrorStructuralFlow(source, () => true, subject, connect);
  flow(subject(roots[0]), subject(roots[1]));
  assert.equal(queries, 2);
  assert.equal(edges.length, 2);
  assert.equal(edges[0][0] === fields[0] && edges[0][1] === fields[1], true);
  assert.equal(edges[1][0] === fields[2] && edges[1][1] === fields[3], true);
});

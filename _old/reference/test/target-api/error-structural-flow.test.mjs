import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../../packages/target-api/dist/public/source.js";
import { createSourceStorageQuery } from "../../packages/target-api/dist/public/analysis.js";
import { createSourceStorageStructuralFlow } from "../../packages/target-api/dist/target-analysis/source-storage/model/structural-flow.js";
import { createSourceStorageSubjects } from "../../packages/target-api/dist/target-analysis/source-storage/model/subjects.js";
import { createSourceStorageBudget, defaultSourceStorageLimits } from "../../packages/target-api/dist/target-analysis/source-storage/model/resource-budget.js";

test("structural value flow consumes exact supplied edge types without querying raw declarations", () => {
  const file = {};
  const from = {};
  const to = {};
  const subject = createSourceStorageSubjects(() => true, () => assert.fail("unexpected subject rejection"));
  let selected = false;
  const semantics = { types: {
    isUnion: () => false, isTuple: () => false, isArrayLike: () => false, indexInfos: () => [],
    structuralMembers(sourceType, destinationType, purpose) {
      assert.equal(sourceType === from && destinationType === to && purpose === "read", true,
        "the selected edge carries both instantiated types and the read operation");
      selected = true;
      return { kind: "available", members: [] };
    },
  } };
  const source = { ast: {}, semantics: { forFile: owner => {
    assert.equal(owner === file, true, "the original checked file owns the supplied edge");
    return semantics;
  } } };
  const flow = createSourceStorageStructuralFlow(source, () => true, subject,
    () => assert.fail("no descendant structural edge exists"), () => file,
    () => assert.fail("no descendant declaration exists"));
  flow(subject({}), subject({}), { from, to });
  assert.equal(selected, true, "the supplied relationship was analyzed");
});

test("instantiated conditional member stores do not expand raw generic declaration types", () => {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: { "/src/index.ts": `
interface Cell { payload: { token: object }; }
interface Input<Value> {
  readonly value: Value;
  readonly next: Input<Input<Value>>;
  readonly gated: Value extends Input<Input<Input<Input<Input<Input<object>>>>>> ? Cell : {};
}
const backing = { token: {} };
export function store(input: Input<object>): void {
  input.next.next.next.next.next.next.gated.payload = backing;
}
` }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length, 0, "the actual instantiated conditional store is checked");
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  const storage = createSourceStorageQuery(source, [file]);
  assert.equal(storage.failureReason(), undefined, "transport construction preserves finite exact instantiated member edges");
});

test("structural Error flow never queries a declaration outside checked-file ownership", () => {
  const file = {};
  const checked = {};
  const detached = {};
  const foreign = {};
  const subject = createSourceStorageSubjects(createSourceStorageBudget(defaultSourceStorageLimits).subject, () => assert.fail("unexpected subject rejection"));
  const source = { ast: { name: () => undefined, kindName: () => "test-node", getSourceFile: node => node === detached ? undefined : node === foreign ? foreign : file,
    is: { IsObjectLiteralExpression: () => false, IsArrayLiteralExpression: () => false, IsIdentifier: () => false,
      IsPropertyAccessExpression: () => false, IsElementAccessExpression: () => false, IsSpreadElement: () => false } },
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
    types: { expressionType: () => undefined, isUnion: () => false, isTuple: () => false, isArrayLike: () => false, indexInfos: () => [],
      structuralMembers: (from, to, purpose) => {
      assert.equal(purpose, "read", "structural value flow requires readable source members");
      queries += 1;
      if (from === outer[0] && to === outer[1]) return { kind: "available", members: [member(fields[0], fields[1], inner[0], inner[1])] };
      assert.equal(from === inner[0] && to === inner[1], true, "exact selected inner types");
      return { kind: "available", members: [member(fields[2], fields[3], inner[0], inner[0])] };
    } } };
  const source = { ast: { name: () => undefined, kindName: () => "test-node", getSourceFile: node => roots.includes(node) ? file : undefined,
    is: { IsGetAccessorDeclaration: () => false, IsObjectLiteralExpression: () => false, IsArrayLiteralExpression: () => false,
      IsIdentifier: () => false, IsPropertyDeclaration: () => false, IsPropertySignatureDeclaration: node => fields.includes(node),
      IsPropertyAccessExpression: () => false, IsElementAccessExpression: () => false, IsSpreadElement: () => false } },
    semantics: { includes: selected => selected === file, forFile: selected => {
      assert.equal(selected === file, true, "synthetic nodes retain their checked-file semantic owner");
      return semantics;
    } } };
  const connect = (from, to) => {
    assert.equal(from.kind === "member" && to.kind === "member", true, "exact data-member subjects");
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

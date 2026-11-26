import assert from "node:assert/strict";
import { test } from "node:test";
import { analysisInput } from "./fixtures/front/analysis-input.mjs";
import { loadFrontFixture } from "./fixtures/front/checked-module.mjs";

async function checkedSource(text) {
  const fixture = await loadFrontFixture();
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const input = analysisInput(fixture, "sdk-minimal", text);
  const result = captureSourceBarrier(input);
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const source = result.value;
  const record = source.modules.find(row => row.module.module === input.snapshot.entryPoint);
  assert.ok(record);
  return { fixture, source, module: record.module, input };
}

test("an interface instance and its same-named value use their distinct checked facets", async () => {
  const { fixture, source, module } = await checkedSource(`
    interface Item<Value> { value: Value }
    declare const Item: { readonly tag: string; new(value: boolean): Item<boolean> };
    export type Instance = Item<number>;
    export type Constructor = typeof Item;
  `);
  const [item, , instance, constructor] = module.tree.statements.nodes;
  const selected = fixture.types.readType(source.types, instance.type.tsonic.type.value);
  assert.equal(selected.kind, "declared");
  assert.equal(selected.facet, "instance");
  assert.equal(selected.definition, item.tsonic.definition);
  assert.deepEqual(selected.arguments.map(type => fixture.types.readType(source.types, type)),
    [{ kind: "primitive", primitive: "float64" }]);
  const separate = fixture.types.readType(source.types, constructor.type.tsonic.type.value);
  assert.equal(separate.kind, "shape");
  assert.equal(separate.constructs.length, 1);
  assert.deepEqual(separate.members.map(member => member.key), [{ kind: "text", value: "tag" }]);
});

test("an ambient module retains its actual ordered members without granting an execution", async () => {
  const { fixture, source, module } = await checkedSource(`
    declare namespace Shapes {
      function select(value: Entry): boolean;
      interface Entry { value: boolean }
    }
    declare namespace Other { interface Entry { value: string } }
    export type ShapeEntry = Shapes.Entry;
    export type OtherEntry = Other.Entry;
  `);
  const [shapes, other, selected, distinct] = module.tree.statements.nodes;
  const [select, entry] = shapes.body.statements.nodes;
  const [otherEntry] = other.body.statements.nodes;
  assert.deepEqual(shapes.tsonic.members, [select.tsonic.definition, entry.tsonic.definition]);
  assert.equal(select.tsonic.parent, shapes.tsonic.definition);
  assert.equal(select.body, null);
  assert.deepEqual(module.bodies.map(body => body.root.kind), ["SourceFile"]);
  assert.deepEqual(selected.type.tsonic.referencedDefinitions, [entry.tsonic.definition]);
  assert.deepEqual(distinct.type.tsonic.referencedDefinitions, [otherEntry.tsonic.definition]);
  assert.equal(fixture.hir.parseHir(fixture.hir.printHir(module)).kind, "parsed");
  const crossed = { ...shapes, tsonic: { ...shapes.tsonic, members: [select.tsonic.definition, otherEntry.tsonic.definition] } };
  const tree = { ...module.tree, statements: { ...module.tree.statements, nodes: [crossed, other, selected, distinct] } };
  const changed = { ...module, tree, bodies: module.bodies.map(body => ({ ...body, root: tree })) };
  const violations = fixture.verifyChecked(changed, source.types);
  assert.equal(violations.some(finding => finding.rule === "definition-reference" && finding.site.definition === shapes.tsonic.definition), true);
});

test("an exact intrinsic alias marker round trips but cannot close an executable type", async () => {
  const { fixture, source, module } = await checkedSource(`
    type Uppercase<Text extends string> = intrinsic;
    type Any = any;
    export type Applied = Uppercase<"mixed">;
  `);
  const { verifyTypeReferences } = await import("../../packages/host/dist/ir-mir/verify-types.js");
  const [intrinsic, ordinary, applied] = module.tree.statements.nodes;
  const table = fixture.types.viewTypes(source.types);
  const identity = alias => alias.type.tsonic.type.value;
  assert.equal(intrinsic.type.kind, "IntrinsicKeyword");
  assert.deepEqual(table.terms[identity(intrinsic)], { kind: "intrinsic", intrinsic: "alias-marker" });
  assert.deepEqual(table.terms[identity(ordinary)], { kind: "intrinsic", intrinsic: "any" });
  const selected = table.terms[identity(applied)];
  assert.equal(selected.kind, "literal");
  assert.deepEqual(selected.value, { kind: "string", value: "MIXED" });
  assert.deepEqual(fixture.types.parseTypes(fixture.types.printTypes(table)), { kind: "parsed", value: table });
  assert.equal(fixture.hir.parseHir(fixture.hir.printHir(module)).kind, "parsed");
  const verify = alias => verifyTypeReferences(table, [{ type: identity(alias), site: { kind: "local", body: module.bodies[0].body, local: 0 } }],
    [], { spent: 0, maximum: 1000, exhausted: false });
  assert.deepEqual(verify(ordinary), []);
  assert.deepEqual(verify(intrinsic).map(finding => finding.rule), ["type-closed"]);
});

test("one checked interface recipe supplies two distinct selected values without opening an unrelated member", async tester => {
  const fixture = await loadFrontFixture();
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { pipelineWiring } = await import("../../packages/host/dist/pipeline/wiring.js");
  const { membersOf, memberTypeOf } = await import("../../packages/host/dist/decls/index.js");
  const { checkedSourceViews } = await import("../../packages/host/dist/pipeline/checked-inputs.js");
  const { createSourceSemanticDatabase } = await import("../../packages/host/dist/pipeline/semantic-queries.js");
  const input = analysisInput(fixture, "sdk-minimal", `
    interface Box<Value> { value: Value; }
    interface Box<Value> { readonly unopened: Value; }
    export type NumberBox = Box<number>;
    export type TextBox = Box<string>;
    export type Selected<Receiver extends { value: number | string }> = Receiver["value"];
  `);
  const capture = pipelineWiring.front.captureModules;
  let unread = 0;
  let owners = 0;
  tester.mock.method(pipelineWiring.front, "captureModules", (...arguments_) => {
    const outcome = capture(...arguments_);
    if (outcome.kind !== "ok") return outcome;
    for (const raw of outcome.value) if (raw.module === input.snapshot.entryPoint) {
      for (const { shape } of raw.types.interfaceDescriptions) {
        const form = raw.types.types[shape].form.value;
        const member = raw.types.members[form.inventory].members.find(row => row.name === "unopened");
        if (member === undefined) continue;
        ++owners;
        const poison = () => { ++unread; assert.fail("the unrelated member type must stay unopened"); };
        Object.defineProperty(member, "read", { get: poison });
        Object.defineProperty(member, "write", { get: poison });
        const selected = raw.types.members[form.inventory].members.find(row => row.name === "value");
        assert.ok(selected !== undefined);
        Object.defineProperty(selected, "write", { get() { assert.fail("a read must not open the selected member's write type"); } });
      }
    }
    return outcome;
  });
  const outcome = captureSourceBarrier(input);
  assert.equal(outcome.kind, "ok", JSON.stringify(outcome.diagnostics));
  const source = outcome.value;
  const [first, second, numberBox, textBox, indexed] = source.modules
    .find(row => row.module.module === input.snapshot.entryPoint).module.tree.statements.nodes;
  assert.equal(owners, 1);
  assert.strictEqual(source.interfaceDescriptionOf(first.tsonic.definition), source.interfaceDescriptionOf(second.tsonic.definition));
  const deps = { modules: source.modules, types: source.types, typeWork: source.typeWork, interfaceDescriptionOf: source.interfaceDescriptionOf,
    typeExpansion: input.limits.instantiation.typeExpansion };
  const { database, bind } = createSourceSemanticDatabase({ declarations: deps, instantiation: input.limits.instantiation }, input.limits.query);
  const { queries } = bind({ groups: [], sources: checkedSourceViews(source.modules),
    bindingScopeOf: definition => source.descriptions.get(definition).generics });
  const owner = indexed.tsonic.definition;
  const parameter = indexed.typeParameters.nodes[0].tsonic.parameter.declaration;
  for (const [box, expected] of [[numberBox, { kind: "primitive", primitive: "float64" }], [textBox, { kind: "string" }]]) {
    const receiver = box.type.tsonic.type.value;
    const inventory = membersOf(deps, receiver).value;
    assert.equal(inventory.kind, "ok");
    assert.deepEqual(inventory.value.members.map(row => row.key.value), ["unopened", "value"]);
    const selected = memberTypeOf(deps, { receiver, member: 1, access: "read" }).value;
    assert.equal(selected.kind, "ok");
    assert.deepEqual(fixture.types.readType(source.types, selected.value.read), expected);
    assert.deepEqual(selected.value, { access: "read", read: selected.value.read });
    const projected = database.run(queries.produceType, {
      component: { root: { kind: "item", value: { owner, node: indexed.type.id } }, path: [] },
      bindings: { classBindings: [{ kind: "bound", parameter, type: receiver }], methodBindings: [], capturedBindings: [], selfBindings: [] },
    });
    assert.equal(projected.kind, "completed");
    assert.equal(projected.value.type, selected.value.read);
  }
  assert.equal(unread, 0);
  assert.equal(database.stats().find(row => row.name === "membersOf").computed, 2);
  assert.equal(database.stats().find(row => row.name === "memberTypeOf").computed, 2);
});

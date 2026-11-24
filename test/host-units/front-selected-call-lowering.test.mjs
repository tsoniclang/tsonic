import assert from "node:assert/strict";
import { test } from "node:test";
import { lowerSingleCheckedModule, captureSingleModule, loadFrontFixture } from "./fixtures/front/checked-module.mjs";

test("a supplied defaulted argument names its authored formal rather than the checker's synthetic absence shell", async () => {
  const fixture = await loadFrontFixture();
  const source = "function choose<T>(first:T, other:T=first):T { return other; } "
    + "export function run(flag:boolean):boolean { return choose(flag, flag); }";
  const { raw, checked } = fixture.checkedModuleOf(source);
  const [selected] = raw.calls;
  const signature = raw.types.signatures[selected.declarationOrder.value[0]];
  const [candidate] = raw.types.candidates[selected.candidates].candidates;
  const contributions = candidate.inferenceContributions.value;
  assert.deepEqual(contributions.map(row => [row.origin.kind, row.origin.parameterIndex]),
    [["argument", 0], ["argument", 1], ["contextual-result", undefined]]);
  const formal = raw.types.types[contributions[1].formal];
  const binder = raw.types.types[signature.parameters[1].type];
  assert.deepEqual(formal.form, binder.form);
  assert.equal(formal.form.value.kind, "parameter");
  assert.deepEqual(formal.form.value.parameter, contributions[1].declaration);
  assert.deepEqual(raw.types.components[formal.component].path.step,
    { kind: "parameter", signature: signature.id, index: 1 });
  const group = checked.bodies.find(body => body.candidateLists.length !== 0);
  assert.deepEqual(group.candidateLists[0].candidates[0].contributions[1].component.path.map(row => [row.kind, row.index]),
    [["parameter", 1]]);
  const authoredUnion = source.replace("other:T=first):T { return other;", "other:T|undefined=first):T { return first;");
  const { program, deps, module } = fixture.openedModule(authoredUnion);
  assert.throws(() => captureSingleModule(fixture.front, deps, program, module),
    /projected, tail or receiver inference contribution capture is not implemented/u);
});

test("checked calls retain their selected generic signatures and the real original inference components", async () => {
  assert.ok(process.env.TSONIC_TEST_ADMISSION);
  const fixture = await loadFrontFixture();
  const providerRoot = "/project/node_modules/typed-endpoints";
  const source = `import { pass as infer, field as select } from "typed-endpoints";
export type Flag = boolean;
export function fromArgument(flag: boolean): boolean { return infer(flag); }
export function fromType(): boolean { return select<Flag>(); }
`;
  const snapshot = fixture.projectSnapshot({ sourceFiles: { "main.ts": source },
    libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }],
    extraFiles: { [providerRoot + "/package.json"]: '{"name":"typed-endpoints","version":"1.0.0","types":"index.d.ts"}' },
    otherPackages: [{ root: providerRoot, name: "typed-endpoints", modules: {
      "index.d.ts": ["declaration", "export declare function pass<T>(value:T):T; export declare function field<T>():T;", true],
    } }],
  });
  const module = fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts");
  const provider = fixture.moduleOf(fixture.packageOf(providerRoot), "index.d.ts");
  const entries = [module, provider].map(id => snapshot.source.input.packages.modules.find(entry => entry.id === id));
  const { captured, deps, interner } = fixture.captureModulesOf(snapshot, entries);
  const [consumer, endpoints] = captured;
  assert.deepEqual(consumer.raw.checkerDiagnostics, []);
  assert.deepEqual(endpoints.raw.checkerDiagnostics, []);
  const checked = lowerSingleCheckedModule(fixture.front, deps, consumer.raw);
  assert.equal(checked.kind, "ok");
  const { hir, types } = fixture;
  const calls = hir.indexSyntaxTree(checked.value.tree).filter(node => node.kind === "CallExpression");
  assert.equal(calls.length, 2);
  for (const [index, call] of calls.entries()) {
    const authored = index === 1;
    const providerDeclaration = endpoints.raw.tree.statements.nodes[index];
    const binder = providerDeclaration.typeParameters.nodes[0];
    const declaration = deps.definitionOf({ module: provider, node: providerDeclaration.id });
    const parameter = deps.definitionOf({ module: provider, node: binder.id });
    const applied = call.tsonic.application.value;
    const selected = types.readSignature(interner, applied.resolvedSignature.value);
    const calleeType = types.readType(interner, call.expression.tsonic.value.views.read.value);
    assert.equal(calleeType.kind, "callable");
    assert.notEqual(calleeType.calls[0], selected.id);
    const original = types.readSignature(interner, calleeType.calls[0]);
    assert.equal(original.declaration, declaration);
    assert.equal(selected.declaration, declaration);
    assert.deepEqual(original.typeParameters, [{ declaration: parameter, constraint: null, default: null }]);
    assert.deepEqual(selected.typeParameters, []);
    assert.deepEqual(types.readType(interner, original.result), { kind: "param", parameter });
    assert.deepEqual(types.readType(interner, selected.result), { kind: "primitive", primitive: "bool" });
    const body = checked.value.bodies.find(entry => entry.candidateLists.some(list =>
      list.candidates.some(candidate => candidate.declaration === declaration)));
    const candidate = body.candidateLists[0].candidates[0];
    assert.equal(candidate.appliedSignature.value, selected.id);
    assert.deepEqual(candidate.bindings.value, { classBindings: [], methodBindings: [
      { kind: "bound", parameter, type: selected.result },
    ], capturedBindings: [], selfBindings: [] });
    assert.deepEqual(applied.typeArguments, authored ? [selected.result] : []);
    if (authored) {
      assert.deepEqual(candidate.contributions, []);
      const type = call.typeArguments.nodes[0];
      assert.equal(type.kind, "TypeReference");
      assert.equal(type.typeName.text, "Flag");
      const rawCall = consumer.raw.calls.find(selection => selection.invocation.node === call.id);
      const [rawCandidate] = consumer.raw.types.candidates[rawCall.candidates].candidates;
      assert.equal(type.id, rawCandidate.application.signatureArguments[0].explicitTypeNode.node);
    } else {
      const byRole = new Map(candidate.contributions.map(contribution => [contribution.role, contribution]));
      assert.deepEqual([...byRole.keys()].sort(), ["argument", "context"]);
      for (const [role, contribution] of byRole) {
        const root = role === "argument" ? call.arguments.nodes[0].id : call.id;
        assert.deepEqual(contribution.source, { kind: "body", value: { body: body.body, node: root } });
        assert.deepEqual(contribution.component, { root: { kind: "item", value: { owner: declaration, node: providerDeclaration.id } },
          path: [role === "argument" ? { kind: "parameter", signature: original.id, index: 0 } : { kind: "result", signature: original.id }] });
        assert.equal(contribution.parameter, parameter);
        assert.equal(contribution.type.value, selected.result);
      }
    }
  }
  const decoded = hir.parseHir(hir.printHir(checked.value));
  assert.equal(decoded.kind, "parsed");
  assert.deepEqual(decoded.value, checked.value);
  const table = types.viewTypes(interner);
  const authoredHeaders = new Map(captured.flatMap(entry => entry.definitions.rows.map(row => [row.definition, row.node])));
  assert.deepEqual(types.verifyTypes({ table, bindings: [], evidence: [], nominalOf: () => null,
    nodeExists: reference => reference.kind === "item" && authoredHeaders.get(reference.value.owner) === reference.value.node,
    localExists: () => false,
  }), []);
  const decodedTypes = types.parseTypes(types.printTypes(table));
  assert.equal(decodedTypes.kind, "parsed");
  assert.deepEqual(decodedTypes.value, table);

  const [inferred, explicit] = consumer.raw.calls;
  const candidateOf = call => consumer.raw.types.candidates[call.candidates].candidates[0];
  const [argument, context] = candidateOf(inferred).inferenceContributions.value;
  const explicitBinder = candidateOf(explicit).application.signatureArguments[0].parameter;
  const assertRejected = (transform, reason) => {
    const raw = { ...consumer.raw, types: { ...consumer.raw.types,
      candidates: consumer.raw.types.candidates.map(list => list.id !== inferred.candidates ? list : {
        ...list, candidates: [transform(list.candidates[0])],
      }),
    } };
    assert.throws(() => lowerSingleCheckedModule(fixture.front, { ...deps, types: types.createTypeInterner() }, raw), reason);
  };
  assertRejected(candidate => ({ ...candidate, application: { ...candidate.application,
    signature: inferred.declarationOrder.value[0],
  } }), /actual declared and applied signature association/);
  assertRejected(candidate => ({ ...candidate, application: { ...candidate.application,
    signatureArguments: [{ ...candidate.application.signatureArguments[0], parameter: explicitBinder }],
  } }), /actual original parameter/);
  assertRejected(candidate => ({ ...candidate, application: { ...candidate.application,
    signatureArguments: [{ ...candidate.application.signatureArguments[0], defaultTypeNode: explicitBinder }],
  } }), /actual non-defaulted argument/);
  assertRejected(candidate => ({ ...candidate,
    inferenceContributions: { kind: "available", value: [{ ...argument, source: context.source }, context] },
  }), /genuine source and original formal components/);
  assertRejected(candidate => ({ ...candidate,
    inferenceContributions: { kind: "available", value: [{ ...argument, formal: context.formal }, context] },
  }), /actual argument and original parameter selector/);
  assert.throws(() => lowerSingleCheckedModule(fixture.front, { ...deps, types: types.createTypeInterner(),
    sourceOccurrenceOf: reference => reference.module === argument.origin.subject.module
      && reference.node === argument.origin.subject.node ? null : deps.sourceOccurrenceOf(reference),
  }, consumer.raw), /actual qualified source/);
});

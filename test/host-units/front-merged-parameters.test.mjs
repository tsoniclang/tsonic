import assert from "node:assert/strict";
import { test } from "node:test";
import { primeCaptureReader, propertyRows, loadFrontFixture, rawComponentPath } from "./fixtures/front/checked-module.mjs";

test("unchanged selected signature arguments retain their actual foreign lexical slots", async () => {
  const fixture = await loadFrontFixture();
  const collection = fixture.moduleOf(fixture.packageOf("/checker"), "lib.es5.d.ts");
  const library = fixture.moduleOf(fixture.packageOf("/checker"), "lib.es2023.array.d.ts");
  const snapshot = fixture.projectSnapshot({ sourceFiles: { "main.ts": "export type Bound = Batch<boolean, string>;" }, libraries: [
    { name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent
      + "\ninterface Batch<K,V> { inspect(callback: (map: Batch<K,V>) => void): void; }" },
    { name: "lib.es2023.array.d.ts", text:
      "interface PairResult<A,B> { staticTag: boolean } interface TupleResult<T> { flag: boolean } "
      + "interface Batch<K,V> { values(): PairResult<V,K>; entries(): TupleResult<[K,V]>; set(value: V, key: K): void; }" },
  ] });
  const { captured } = fixture.captureModulesOf(snapshot);
  const foreign = captured.find(entry => entry.module === library).raw;
  const [pair, , batch] = foreign.tree.statements.nodes;
  const [method, entries, set] = batch.members.nodes;
  const source = node => ({ module: library, node: node.id });
  const inspect = captured.find(entry => entry.module === collection).raw.tree.statements.nodes
    .find(node => node.name?.text === "Batch");
  const [first] = inspect.members.nodes;
  const receivers = pair.typeParameters.nodes;
  const binders = [batch.typeParameters.nodes[1], batch.typeParameters.nodes[0]];
  const args = method.type.typeArguments.nodes;
  let originalCount = 0;
  let changedCount = 0;
  let tuples = 0;
  let formals = 0;
  for (const { raw } of captured) for (const signature of raw.types.signatures) {
    if (signature.target === null || signature.declaration?.module !== library) continue;
    if (signature.declaration.node === set.id && signature.owner?.module === collection && signature.owner.node === first.id) {
      const values = signature.parameters.map(parameter => raw.types.types[parameter.type]);
      assert.equal(values.every(row => row.authoredTypeNode === null && row.form.value.kind === "parameter"), true);
      assert.deepEqual(values.map(row => row.form.value.parameter), [1, 0].map(index =>
        ({ module: collection, node: inspect.typeParameters.nodes[index].id })));
      formals += 1;
      continue;
    }
    if (signature.declaration.node === entries.id) {
      const row = raw.types.types[signature.result.value];
      const argument = row.form.value.arguments[0];
      const tuple = raw.types.types[argument.argument.value].form.value;
      assert.equal(row.authoredTypeNode, null);
      assert.equal(tuple.kind, "tuple");
      const values = tuple.elements.map(item => raw.types.types[item.type].form.value);
      if (values.every(value => value.kind === "parameter")) {
        tuples += 1;
        assert.deepEqual(argument.explicitTypeNode, source(entries.type.typeArguments.nodes[0]));
        assert.deepEqual(values.map(value => value.parameter), [...binders].reverse().map(source));
      } else assert.equal(argument.explicitTypeNode, null);
      continue;
    }
    if (signature.declaration.node !== method.id) continue;
    assert.equal(signature.result.kind, "available");
    const row = raw.types.types[signature.result.value];
    assert.equal(row.authoredTypeNode, null);
    assert.equal(row.form.value.kind, "declared");
    const selected = row.form.value.arguments;
    assert.deepEqual(selected.map(item => item.parameter), receivers.map(source));
    const values = selected.map(item => raw.types.types[item.argument.value].form.value);
    if (values.every(value => value.kind === "parameter")) {
      originalCount += 1;
      assert.deepEqual(values.map(value => value.parameter), binders.map(source));
      assert.deepEqual(selected.map(item => item.explicitTypeNode), args.map(source));
    } else {
      changedCount += 1;
      assert.deepEqual(values.map(value => value.scalar), ["string", "boolean"]);
      assert.deepEqual(selected.map(item => item.explicitTypeNode), [null, null]);
    }
  }
  assert.equal(originalCount > 0, true, "actual foreign unchanged selected signature");
  assert.equal(changedCount > 0, true, "actual instantiated changed signature opposite");
  assert.equal(tuples > 0, true, "actual unchanged selected tuple slots");
  assert.equal(formals > 0, true, "selected formals from both actual receiver slots");
});

test("a genuine first receiver slot does not authorize an alias-wrapped second slot", async () => {
  const fixture = await loadFrontFixture();
  const snapshot = fixture.projectSnapshot({ sourceFiles: { "main.ts": `
    export type Identity<T> = T;
    export interface Pair<K,V> { set(value: V, key: K): void; direct: Pair<K,V>; checkpoint: boolean; }
    export interface Pair<K,V> { wrapped: Pair<K,Identity<V>>; }
  ` }, libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] });
  const { OpenedProgram } = await import("../../packages/host/dist/front/handles.js");
  const { program, deps } = fixture.openAndCapture(snapshot);
  const module = snapshot.entryPoint;
  const file = OpenedProgram.file(program, module).file;
  const { ast, checker } = OpenedProgram.checked(program).getSourceFileQueries(file);
  const [first, second] = ast.children(file).filter(node => ast.kindName(node) === "KindInterfaceDeclaration");
  const [direct] = ast.children(first).filter(node => ast.kindName(node) === "KindPropertySignature");
  const [wrapped] = ast.children(second).filter(node => ast.kindName(node) === "KindPropertySignature");
  const original = checker.getTypeFromTypeNode(ast.typeNode(direct));
  const opposite = checker.getTypeFromTypeNode(ast.typeNode(wrapped));
  assert.equal(original !== undefined && original.type === opposite?.type, true, "the whole native receiver is genuinely shared");
  assert.throws(() => fixture.front.captureModule(deps, program, module),
    /a merged type parameter requires its actual selected declaration association/u);
});

test("a recursively re-entered merged interface retains its changed argument and complete owning group", async () => {
  const fixture = await loadFrontFixture();
  const source = "export interface Chain<Item> { next: Chain<string>; }"
    + " export interface Chain<Item> { status: boolean; }"
    + " export type Ready = Chain<boolean>; export type Independent = Chain<string>;";
  const snapshot = fixture.projectSnapshot({ sourceFiles: { "main.ts": source },
    libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] });
  const { deps, program } = fixture.openAndCapture(snapshot);
  const module = snapshot.entryPoint;
  const result = fixture.front.captureModule(deps, program, module);
  assert.equal(result.kind, "ok");
  const raw = result.value;
  const [first, second, ready, independent] = raw.tree.statements.nodes;
  const qualified = node => ({ module, node: node.id });
  const roots = [ready, independent].map(node => raw.types.types.find(row => row.authoredTypeNode?.module === module
    && row.authoredTypeNode.node === node.type.id));
  assert.equal(roots.every(root => root?.form.value?.kind === "structure"), true);
  const recurrences = raw.types.types.filter(row => row.form.value?.kind === "merged-interface-dependency"
    && raw.types.components[row.component].root.node === ready.type.id);
  assert.ok(recurrences.length > 0);
  for (const row of recurrences) {
    const form = row.form.value;
    const position = raw.types.components[row.component];
    assert.deepEqual(form.declarations, [qualified(first), qualified(second)]);
    assert.equal(form.arguments.length, 1);
    const [argument] = form.arguments;
    assert.equal(argument.scope, "local");
    assert.deepEqual(argument.parameters, [qualified(first.typeParameters.nodes[0]), qualified(second.typeParameters.nodes[0])]);
    const captured = raw.types.types[argument.type];
    assert.deepEqual(captured.form, { kind: "available", value: { kind: "scalar", scalar: "string" } });
    assert.deepEqual(raw.types.components[captured.component].path,
      { prefix: position.path === null ? null : position.id, step: { kind: "argument-place", index: 0 } });
  }
});

test("nested native arguments retain the actual merged slot without assigning either authored parameter", async () => {
  const fixture = await loadFrontFixture();
  const library = "lib.es5.d.ts";
  const source = fixture.sdk.barebonesLibContent + "\ninterface Holder<Item> { readonly slot: Item; }"
    + " interface Chain<T> { turn(): Chain<Holder<T | number>>; } interface Chain<T> { readonly count: boolean; }";
  const snapshot = fixture.projectSnapshot({ sourceFiles: { "main.ts": "export type Root = Chain<string>;" },
    libraries: [{ name: library, text: source }] });
  const { deps, program } = fixture.openAndCapture(snapshot);
  const result = fixture.front.captureModule(deps, program, snapshot.entryPoint);
  assert.equal(result.kind, "ok");
  const { OpenedProgram } = await import("../../packages/host/dist/front/handles.js");
  const module = fixture.moduleOf(fixture.packageOf("/checker"), library);
  const file = OpenedProgram.file(program, module).file;
  const { ast } = OpenedProgram.checked(program);
  const numbering = OpenedProgram.syntax(program).get("/checker/" + library).outcome.numbering;
  const chain = ast.children(file).filter(node => ast.kindName(node) === "KindInterfaceDeclaration"
    && ast.text(ast.name(node)) === "Chain");
  const declarations = chain.map(node => ({ module, node: numbering.ids.get(ast.typeParameters(node)[0]) }));
  assert.equal(declarations.length, 2);
  assert.notEqual(declarations[0].node, declarations[1].node);
  const { types } = result.value;
  const rows = types.types.filter(row => row.form.value?.kind === "merged-slot-parameter");
  assert.ok(rows.length > 0);
  for (const row of rows) {
    assert.equal(row.authoredTypeNode, null);
    assert.deepEqual(row.form.value.declarations, declarations);
    assert.deepEqual(rawComponentPath(types.components, types.components[row.component]).map(step => step.kind),
      ["result", "argument-place", "argument-place", "union-member"]);
  }
});

test("a selected declared signature result retains its native tuple argument without claiming authored syntax", async () => {
  const fixture = await loadFrontFixture();
  const source = "export interface Result<Slot> { readonly slot: Slot; }"
    + " export interface Chain<Item> { entries(): Result<[number, Item]>; }"
    + " export interface Chain<Item> { status: boolean; } export type Ready = Chain<string>;";
  const snapshot = fixture.projectSnapshot({ sourceFiles: { "main.ts": source },
    libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] });
  const { deps, program } = fixture.openAndCapture(snapshot);
  const result = fixture.front.captureModule(deps, program, snapshot.entryPoint);
  assert.equal(result.kind, "ok");
  const { types } = result.value;
  const selected = types.types.find(row => row.form.value?.kind === "tuple" && row.authoredTypeNode === null
    && types.components[types.components[row.component].path?.prefix]?.path?.step.kind === "result"
    && types.components[row.component].path?.step.kind === "argument-place"
    && types.types[row.form.value.elements[1]?.type]?.form.value?.scalar === "string");
  assert.ok(selected);
  assert.equal(selected.form.value.readonly, false);
  assert.deepEqual(selected.form.value.elements.map(slot => [slot.kind, types.types[slot.type].form.value.scalar]),
    [["required", "number"], ["required", "string"]]);
  for (const [index, slot] of selected.form.value.elements.entries())
    assert.deepEqual(types.components[slot.component].path, { prefix: selected.component, step: { kind: "tuple-element", index } });
});

test("captured constraints retain each merged interface fragment's actual type parameter declaration", async () => {
  assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined, true);
  const fixture = await loadFrontFixture();
  const libraries = [
    { name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent +
      "\ninterface Array<T> { first<S extends T>(input: S): S; }\ndeclare var items: Array<boolean>;\n" },
    { name: "lib.es2023.array.d.ts", text: "interface Array<T> { second<S extends T>(input: S): S; }\n" },
  ];
  const snapshot = fixture.projectSnapshot({ sourceFiles: { "main.ts": "export type Selected = typeof items;\n" }, libraries });
  const { captured, deps, opened } = fixture.captureModulesOf(snapshot);
  const { program } = opened;
  const { OpenedProgram } = await import("../../packages/host/dist/front/handles.js");
  const checked = OpenedProgram.checked(program);
  const groups = [];
  const selected = [];
  for (const [index, library] of libraries.entries()) {
    const moduleId = fixture.moduleOf(fixture.packageOf("/checker"), library.name);
    const { module, raw, definitions } = captured.find(entry => entry.module === moduleId);
    const methodName = index === 0 ? "first" : "second";
    const syntax = raw.tree.statements.nodes.find(node => node.kind === "InterfaceDeclaration"
      && node.members.nodes.some(member => member.name?.text === methodName));
    const parameter = syntax.typeParameters.nodes[0];
    const constraint = syntax.members.nodes[0].typeParameters.nodes[0].constraint;
    const numbering = OpenedProgram.syntax(program).get("/checker/" + library.name).outcome.numbering;
    const checker = checked.getSourceFileQueries(OpenedProgram.file(program, module).file).checker;
    const source = numbering.nodes[constraint.id];
    const symbol = checker.getTypeSymbol(checker.getTypeFromTypeNode(source).type);
    const group = checker.getSymbolDeclarations(symbol);
    assert.equal(group.length, 3, "the test exercises a native merged parameter, not two independent symbols");
    assert.equal(group.includes(numbering.nodes[parameter.id]), true);
    groups.push(group);
    const rows = captured.flatMap(entry => entry.raw.types.types).filter(type =>
      type.authoredTypeNode?.module === module && type.authoredTypeNode.node === constraint.id);
    assert.ok(rows.length > 1, "the actual cross-module type graph captures the original constraint too");
    const definition = definitions.rows.find(row => row.node === parameter.id);
    assert.equal(definition?.kind, "TypeParameter");
    for (const row of rows) {
      assert.deepEqual(row.form, { kind: "available", value: { kind: "parameter",
        parameter: { module, node: parameter.id }, constraint: null, default: null } });
      assert.equal(deps.definitionOf(row.form.value.parameter), definition.definition);
    }
    selected.push(definition.definition);
  }
  assert.equal(groups[0].every(declaration => groups[1].includes(declaration)), true, "both checkers retain the same genuine merged group");
  assert.notEqual(selected[0], selected[1], "the checker merge must not collapse the authored F1 identities");
  const main = fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts");
  const raw = captured.find(entry => entry.module === main).raw;
  const imported = raw.types.types.filter(row => row.authoredTypeNode !== null && row.authoredTypeNode.module !== main
    && row.form.kind === "available" && row.form.value.kind === "parameter"
    && selected.includes(deps.definitionOf(row.form.value.parameter)));
  assert.ok(imported.length >= 2, "the same capture needs the merged owner index for more than one use");
  const declarations = new Set(groups[0]);
  const reads = [];
  const observed = OpenedProgram.create({ ...checked, ast: { ...checked.ast, parent(node) {
    if (declarations.has(node)) reads.push(node);
    return checked.ast.parent(node);
  } } }, OpenedProgram.table(program), OpenedProgram.modules(program).modules.map(entry =>
    OpenedProgram.file(program, entry.kind === "snapshot" ? entry.module : entry.document.module)),
  OpenedProgram.libraryData(program), OpenedProgram.contributions(program));
  const repeated = fixture.front.captureModule(opened.deps, observed, main);
  assert.equal(repeated.kind, "ok");
  assert.equal(reads.length, declarations.size, "one owner-index read per actual merged declaration, not per use");
  assert.equal(new Set(reads).size, declarations.size);
});

test("signature formals select the original merged interface fragment without turning the projection into an authored type view", async () => {
  assert.ok(process.env.TSONIC_TEST_ADMISSION);
  const fixture = await loadFrontFixture();
  const libraries = [
    { name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent
      + "\ninterface Array<T> { first(value: T): boolean; }\n" },
    { name: "lib.es2023.array.d.ts", text: "interface Array<T> { second(value: T): boolean; }\n" },
  ];
  const snapshot = fixture.projectSnapshot({ sourceFiles: {
    "main.ts": "export type Environment = typeof globalThis; export type Selected = Array<boolean>;",
  }, libraries });
  const { captured, opened } = fixture.captureModulesOf(snapshot);
  const { OpenedProgram } = await import("../../packages/host/dist/front/handles.js");
  const checked = OpenedProgram.checked(opened.program);
  const selected = [];
  for (const [index, library] of libraries.entries()) {
    const owner = fixture.moduleOf(fixture.packageOf("/checker"), library.name);
    const raw = captured.find(entry => entry.module === owner).raw;
    const name = index === 0 ? "first" : "second";
    const fragment = raw.tree.statements.nodes.find(node => node.kind === "InterfaceDeclaration"
      && node.members.nodes.some(member => member.name?.text === name));
    const member = fragment.members.nodes.find(node => node.name?.text === name);
    const parameter = { module: owner, node: fragment.typeParameters.nodes[0].id };
    const declaration = { module: owner, node: member.id };
    const file = OpenedProgram.file(opened.program, owner).file;
    const checker = checked.getSourceFileQueries(file).checker;
    const typeShape = checked.getSourceFileQueries(file).typeShape;
    const numbered = OpenedProgram.syntax(opened.program).get("/checker/" + library.name).outcome.numbering;
    const method = numbered.nodes[member.id];
    const signature = checker.getSignatureFromDeclaration(method);
    const [formal] = typeShape.getSignatureParameterInfos(signature);
    const annotation = checked.ast.typeNode(formal.declaration);
    assert.equal(formal.declaration === numbered.nodes[member.parameters.nodes[0].id], true);
    assert.equal(checker.getTypeFromTypeNode(annotation).type === formal.type, true);
    const symbol = checker.getTypeSymbol(formal.type);
    assert.equal(checker.getSymbolAtLocation(checked.ast.as.AsTypeReferenceNode(annotation).TypeName) === symbol, true);
    assert.equal(checker.getSymbolDeclarations(symbol).length, 3);

    const slots = captured.flatMap(entry => entry.raw.types.signatures.flatMap(row =>
      row.declaration?.module === declaration.module && row.declaration.node === declaration.node
        ? [{ signature: row, type: entry.raw.types.types[row.parameters[0].type] }] : []));
    const originals = slots.filter(slot => slot.signature.target === null);
    assert.ok(originals.length > 0);
    for (const { type } of originals) {
      assert.equal(type.authoredTypeNode, null);
      assert.deepEqual(type.form, { kind: "available", value: { kind: "parameter", parameter, constraint: null, default: null } });
    }
    const applied = slots.filter(slot => slot.signature.target !== null);
    assert.ok(applied.length > 0);
    for (const { type } of applied) {
      assert.equal(type.authoredTypeNode, null);
      assert.deepEqual(type.form, { kind: "available", value: { kind: "scalar", scalar: "boolean" } });
    }
    selected.push(parameter);
  }
  assert.notDeepEqual(selected[0], selected[1]);
});

test("applied method formals follow the authored receiver argument even when native signatures are shared", async () => {
  const fixture = await loadFrontFixture();
  const snapshot = fixture.projectSnapshot({ sourceFiles: { "main.ts": `
    export interface Box<T> { first(value: T): boolean; loop(value: T): Box<T>; left: Box<T>; }
    export interface Box<T> { right: Box<T>; again: Box<T>; }
    export interface AliasHost<T> {}
    export interface AliasHost<T> { aliased: Alias<T>; }
    export interface AliasTarget<V> { first(value: V): boolean; }
    export interface AliasTarget<V> {}
    export type Alias<U> = AliasTarget<U>;
  ` }, libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] });
  const { captured, deps, opened } = fixture.captureModulesOf(snapshot);
  const module = fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts");
  const { raw } = captured.find(entry => entry.module === module);
  const { OpenedProgram } = await import("../../packages/host/dist/front/handles.js");
  const checked = OpenedProgram.checked(opened.program);
  const { checker, typeShape } = checked.getSourceFileQueries(OpenedProgram.file(opened.program, module).file);
  const numbered = OpenedProgram.syntax(opened.program).get("/project/src/main.ts").outcome.numbering;
  const [left, right, , aliasHost, aliasTarget] = raw.tree.statements.nodes;
  const original = checker.getSignatureFromDeclaration(numbered.nodes[left.members.nodes[0].id]);
  const aliasOriginal = checker.getSignatureFromDeclaration(numbered.nodes[aliasTarget.members.nodes[0].id]);
  const capturedRows = [];
  const native = [];
  for (const [fragment, name] of [[left, "left"], [right, "right"], [right, "again"], [aliasHost, "aliased"]]) {
    const property = fragment.members.nodes.find(member => member.name.text === name);
    const syntax = checked.ast.typeNode(numbered.nodes[property.id]);
    const argument = checked.ast.as.AsTypeReferenceNode(syntax).TypeArguments.Nodes[0];
    const receiver = checker.getTypeFromTypeNode(syntax).type;
    const selected = propertyRows(typeShape, receiver).find(entry => entry.name === "first");
    const [signature] = typeShape.getCallSignatures(selected.type);
    assert.equal(signature.target === (fragment === aliasHost ? aliasOriginal : original), true);
    assert.equal(typeShape.getSignatureParameterInfos(signature)[0].type === checker.getTypeFromTypeNode(argument).type, true);
    native.push({ receiver, signature });
    const authored = raw.types.types.find(entry => entry.authoredTypeNode?.node === numbered.ids.get(syntax));
    const inventory = raw.types.members[authored.form.value.inventory];
    const method = inventory.members.find(entry => entry.name === "first");
    const callable = raw.types.types[method.read.value];
    const [id] = raw.types.members[callable.form.value.inventory].calls;
    const row = raw.types.signatures[id];
    const slot = raw.types.types[row.parameters[0].type];
    const parameter = { module, node: fragment.typeParameters.nodes[0].id };
    assert.notEqual(row.target, null);
    assert.equal(slot.authoredTypeNode, null);
    assert.deepEqual(slot.form, { kind: "available", value: { kind: "parameter", parameter, constraint: null, default: null } });
    assert.equal(deps.definitionOf(slot.form.value.parameter), deps.definitionOf(parameter));
    capturedRows.push(row);
    if (fragment !== aliasHost) {
      const forward = inventory.members.find(entry => entry.name === "left");
      assert.equal(propertyRows(typeShape, receiver).find(entry => entry.name === "left").type === receiver, true);
      assert.equal(raw.types.types[forward.read.value].form.value.inventory, inventory.id);
      assert.equal(raw.types.types[forward.write.value].form.value.inventory, inventory.id);

      const loop = inventory.members.find(entry => entry.name === "loop");
      const [nativeLoop] = typeShape.getCallSignatures(propertyRows(typeShape, receiver).find(entry => entry.name === "loop").type);
      assert.equal(checker.getReturnTypeOfSignature(nativeLoop)?.type === receiver, true);
      const call = entry => raw.types.members[raw.types.types[entry.read.value].form.value.inventory].calls[0];
      const loopSignature = raw.types.signatures[call(loop)];
      assert.deepEqual(raw.types.types[loopSignature.parameters[0].type].form.value.parameter, parameter);
      const returned = raw.types.members[raw.types.types[loopSignature.result.value].form.value.inventory];
      assert.equal(call(returned.members.find(entry => entry.name === "loop")), loopSignature.id);
    }
  }
  assert.equal(native[0].receiver === native[1].receiver, true);
  assert.equal(native[0].signature === native[1].signature, true);
  assert.equal(native[1].signature === native[2].signature, true);
  assert.notEqual(capturedRows[0].id, capturedRows[1].id);
  assert.equal(capturedRows[1].id, capturedRows[2].id);
  assert.equal(capturedRows[0].target, capturedRows[1].target);
  assert.notEqual(capturedRows[1].target, capturedRows[3].target);
});

test("an unproved alias chain cannot borrow another applied formal's declaration", async () => {
  const fixture = await loadFrontFixture();
  const snapshot = fixture.projectSnapshot({ sourceFiles: { "main.ts": `
    export interface Box<T> { first(value: T): boolean; }
    export interface Box<T> {}
    export type Direct<U> = Box<U>;
    export type Indirect<U> = Direct<U>;
    export interface Inputs<T> {}
    export interface Inputs<T> { direct: Direct<T>; unproved: Indirect<T>; }
  ` }, libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] });
  assert.throws(() => fixture.captureModulesOf(snapshot), {
    name: "TypeError", message: "front: a merged type parameter requires its actual selected declaration association",
  });
});

for (const nested of ["(Box<T>)", "Identity<Box<T>>", "Box<Identity<T>>"]) {
  test(`same-pointer ${nested} cannot borrow a qualified recursive receiver`, async () => {
    const fixture = await loadFrontFixture();
    const { OpenedProgram } = await import("../../packages/host/dist/front/handles.js");
    const snapshot = fixture.projectSnapshot({ sourceFiles: { "main.ts": `
      export type Identity<X> = X;
      export interface Box<T> { first(value: T): boolean; direct: Box<T>; checkpoint: boolean; }
      export interface Box<T> { unproved: ${nested}; }
    ` }, libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] });
    const { deps, program, set } = fixture.openAndCapture(snapshot);
    const module = fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts");
    const file = OpenedProgram.file(program, module).file;
    const checked = OpenedProgram.checked(program);
    const { ast } = checked;
    const { checker, typeShape } = checked.getSourceFileQueries(file);
    const [first, second] = ast.children(file).filter(node => ast.kindName(node) === "KindInterfaceDeclaration");
    const firstProperties = ast.children(first).filter(node => ast.kindName(node) === "KindPropertySignature");
    const [direct, checkpoint] = firstProperties.map(node => ast.typeNode(node));
    const nestedProperty = ast.children(second).find(node => ast.kindName(node) === "KindPropertySignature");
    const unproved = ast.typeNode(nestedProperty);
    const receiver = checker.getTypeFromTypeNode(direct).type;
    assert.equal(checker.getTypeFromTypeNode(unproved).type === receiver, true, nested);
    const actual = propertyRows(typeShape, receiver);
    assert.equal(actual.find(entry => entry.name === "direct").type === receiver, true, nested);
    assert.equal(actual.find(entry => entry.name === "unproved").type === receiver, true, nested);
    let reachedLater = false;
    const observed = OpenedProgram.create({ ...checked, getSourceFileQueries(sourceFile) {
      const views = checked.getSourceFileQueries(sourceFile);
      if (sourceFile !== file) return views;
      return { ...views, checker: { ...checker, getTypeFromTypeNode(node) {
        if (node === checkpoint) reachedLater = true;
        return checker.getTypeFromTypeNode(node);
      } } };
    } }, OpenedProgram.table(program), set.modules.map(entry =>
      OpenedProgram.file(program, entry.kind === "snapshot" ? entry.module : entry.document.module)),
    OpenedProgram.libraryData(program), OpenedProgram.contributions(program));
    assert.throws(() => fixture.front.captureModule(deps, observed, module), {
      name: "TypeError", message: "front: a merged type parameter requires its actual selected declaration association",
    });
    assert.equal(reachedLater, false, nested);
  });
}

test("recursive receiver admission preserves the actual source-reader stop before later syntax", async () => {
  const fixture = await loadFrontFixture();
  const { OpenedProgram } = await import("../../packages/host/dist/front/handles.js");
  const snapshot = fixture.projectSnapshot({ sourceFiles: { "main.ts": `
    export interface Box<T> { first(value: T): boolean; direct: Box<T>; checkpoint: boolean; }
    export interface Box<T> { recursive: Box<T>; }
  ` }, libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] });
  const { deps, program, set } = fixture.openAndCapture(snapshot);
  const module = fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts");
  const file = OpenedProgram.file(program, module).file;
  const checked = OpenedProgram.checked(program);
  const { ast } = checked;
  const { checker, typeShape } = checked.getSourceFileQueries(file);
  const [left, right] = ast.children(file).filter(node => ast.kindName(node) === "KindInterfaceDeclaration");
  const [direct, checkpoint] = ast.children(left).filter(node => ast.kindName(node) === "KindPropertySignature").map(node => ast.typeNode(node));
  const recursive = ast.typeNode(ast.children(right).find(node => ast.kindName(node) === "KindPropertySignature"));
  const receiver = checker.getTypeFromTypeNode(direct).type;
  assert.equal(checker.getTypeFromTypeNode(recursive).type === receiver, true);
  assert.equal(propertyRows(typeShape, receiver).find(entry => entry.name === "recursive").type === receiver, true);
  const stop = new Error("actual recursive source reader stopped");
  let reachedLater = false;
  let attempts = 0;
  const observed = OpenedProgram.create({ ...checked, getSourceFileQueries(sourceFile) {
    const views = checked.getSourceFileQueries(sourceFile);
    if (sourceFile !== file) return views;
    return { ...views, checker: { ...checker, getTypeFromTypeNode(node) {
      if (node === checkpoint) reachedLater = true;
      if (node === recursive) {
        attempts += 1;
        throw stop;
      }
      return checker.getTypeFromTypeNode(node);
    } } };
  } }, OpenedProgram.table(program), set.modules.map(entry =>
    OpenedProgram.file(program, entry.kind === "snapshot" ? entry.module : entry.document.module)),
  OpenedProgram.libraryData(program), OpenedProgram.contributions(program));
  for (const [limit, exact] of [["maximumCapturedFactsPerModule", 58], ["maximumCapturedEdgesPerModule", 67]]) {
    const captureAt = maximum => fixture.front.captureModule({ ...deps,
      navigationCapture: { ...deps.navigationCapture, [limit]: maximum } }, observed, module);
    primeCaptureReader(captureAt, deps.navigationCapture[limit], stop);
    attempts = 0;
    const refused = captureAt(exact - 1);
    assert.equal(refused.kind, "refused");
    assert.equal(refused.diagnostics.at(-1).code.name, "TSONIC_COMPILER_RESOURCE_LIMIT");
    assert.deepEqual(refused.diagnostics.at(-1).arguments, [
      { kind: "text", value: "front." + limit }, { kind: "number", value: exact - 1 },
    ]);
    assert.equal(attempts, 0);
    assert.throws(() => captureAt(exact), error => error === stop);
    assert.equal(attempts, 1);
    assert.equal(reachedLater, false);
  }
});

test("a direct optional callback keeps the selected receiver binder in each qualified applied signature", async () => {
  const fixture = await loadFrontFixture();
  const snapshot = fixture.projectSnapshot({ sourceFiles: { "main.ts": `
    export interface Box<T> { sort(compareFn?: (a: T, b: T) => boolean): boolean; left: Box<T>; }
    export interface Box<T> { right: Box<T>; }
  ` }, libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] });
  const { captured, deps, opened } = fixture.captureModulesOf(snapshot);
  const module = fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts");
  const { raw } = captured.find(entry => entry.module === module);
  const { OpenedProgram } = await import("../../packages/host/dist/front/handles.js");
  const { ast, getSourceFileQueries } = OpenedProgram.checked(opened.program);
  const { checker, typeShape } = getSourceFileQueries(OpenedProgram.file(opened.program, module).file);
  const numbered = OpenedProgram.syntax(opened.program).get("/project/src/main.ts").outcome.numbering;
  const [left, right] = raw.tree.statements.nodes;
  const originalMethod = checker.getSignatureFromDeclaration(numbered.nodes[left.members.nodes[0].id]);
  const formal = typeShape.getSignatureParameterInfos(originalMethod)[0];
  const originalSyntax = ast.typeNode(formal.declaration);
  const originalCallback = checker.getSignatureFromDeclaration(originalSyntax);
  const originalType = checker.getTypeFromTypeNode(originalSyntax).type;
  assert.equal(typeShape.getUnionOrIntersectionTypes(formal.type).includes(originalType), true);
  const originalBinder = { module, node: left.typeParameters.nodes[0].id };
  const native = [];
  const checkedRows = [];
  const fromStructure = type => raw.types.members[type.form.value.inventory];
  for (const [fragment, name] of [[left, "left"], [right, "right"]]) {
    const property = fragment.members.nodes.find(member => member.name.text === name);
    const syntax = ast.typeNode(numbered.nodes[property.id]);
    const receiver = checker.getTypeFromTypeNode(syntax).type;
    const methodType = propertyRows(typeShape, receiver).find(entry => entry.name === "sort").type;
    const [method] = typeShape.getCallSignatures(methodType);
    const selected = typeShape.getSignatureParameterInfos(method)[0];
    const selectedType = typeShape.getUnionOrIntersectionTypes(selected.type).find(arm => !typeShape.isNullish(arm));
    const [callback] = typeShape.getCallSignatures(selectedType);
    assert.equal(method.target === originalMethod && selected.declaration === formal.declaration, true);
    assert.equal(selectedType === originalType, false);
    assert.equal(typeShape.getTypeReferenceTarget(selectedType) === originalType && callback.target === originalCallback, true);
    assert.equal(callback.derivation.kind === "member" && callback.derivation.owner === selectedType, true);
    native.push({ receiver, callback });

    const authored = raw.types.types.find(entry => entry.authoredTypeNode?.node === numbered.ids.get(syntax));
    const member = fromStructure(authored).members.find(entry => entry.name === "sort");
    const rawMethod = raw.types.signatures[fromStructure(raw.types.types[member.read.value]).calls[0]];
    const arms = raw.types.types[rawMethod.parameters[0].type].form.value.members.map(id => raw.types.types[id]);
    assert.deepEqual(arms.find(arm => arm.form.value.kind === "scalar").form.value, { kind: "scalar", scalar: "undefined" });
    const selectedRow = raw.types.signatures[fromStructure(arms.find(arm => arm.form.value.kind === "structure")).calls[0]];
    const originalRow = raw.types.signatures[selectedRow.target];
    const expected = { module, node: fragment.typeParameters.nodes[0].id };
    for (const [signature, binder] of [[selectedRow, expected], [originalRow, originalBinder]]) {
      assert.equal(signature.parameters.length, 2);
      for (const parameter of signature.parameters) {
        const type = raw.types.types[parameter.type];
        assert.equal(type.authoredTypeNode, null);
        assert.deepEqual(type.form.value, { kind: "parameter", parameter: binder, constraint: null, default: null });
        assert.equal(deps.definitionOf(type.form.value.parameter), deps.definitionOf(binder));
      }
    }
    checkedRows.push(selectedRow);
  }
  assert.equal(native[0].receiver === native[1].receiver && native[0].callback === native[1].callback, true);
  assert.notEqual(checkedRows[0].id, checkedRows[1].id);
  assert.equal(checkedRows[0].target, checkedRows[1].target);
});

test("an alias-wrapped callback cannot borrow its inner FunctionType by native pointer", async () => {
  const fixture = await loadFrontFixture();
  const snapshot = fixture.projectSnapshot({ sourceFiles: { "main.ts": `
    export type Identity<X> = X;
    export interface Box<T> { sort(compareFn?: Identity<(a: T, b: T) => boolean>): boolean; exact: Box<T>; }
    export interface Box<T> {}
  ` }, libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] });
  const { deps, program } = fixture.openAndCapture(snapshot);
  const module = fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts");
  const { OpenedProgram } = await import("../../packages/host/dist/front/handles.js");
  const file = OpenedProgram.file(program, module).file;
  const { ast, getSourceFileQueries } = OpenedProgram.checked(program);
  const { checker, typeShape } = getSourceFileQueries(file);
  const owner = ast.children(file).find(node => ast.kindName(node) === "KindInterfaceDeclaration");
  const [method] = ast.children(owner).filter(node => ast.kindName(node) === "KindMethodSignature");
  const property = ast.children(owner).find(node => ast.kindName(node) === "KindPropertySignature");
  const receiver = checker.getTypeFromTypeNode(ast.typeNode(property)).type;
  const [selected] = typeShape.getCallSignatures(propertyRows(typeShape, receiver).find(entry => entry.name === "sort").type);
  const original = typeShape.getSignatureParameterInfos(selected.target)[0];
  const wrapped = ast.typeNode(original.declaration);
  const inner = ast.as.AsTypeReferenceNode(wrapped).TypeArguments.Nodes[0];
  assert.equal(selected.target === checker.getSignatureFromDeclaration(method), true);
  assert.equal(ast.kindName(wrapped), "KindTypeReference");
  assert.equal(ast.kindName(inner), "KindFunctionType");
  assert.equal(checker.getTypeFromTypeNode(wrapped).type === checker.getTypeFromTypeNode(inner).type, true);
  const selectedType = typeShape.getUnionOrIntersectionTypes(typeShape.getSignatureParameterInfos(selected)[0].type).find(arm => !typeShape.isNullish(arm));
  assert.equal(typeShape.getCallSignatures(selectedType)[0].target === checker.getSignatureFromDeclaration(inner), true);
  assert.throws(() => fixture.front.captureModule(deps, program, module), /a merged type parameter requires its actual selected declaration association/);
});

test("the exact callback evidence limits preserve the actual annotation reader stop", async () => {
  const fixture = await loadFrontFixture();
  const snapshot = fixture.projectSnapshot({ sourceFiles: { "main.ts": `
    export interface Box<T> { exact: Box<T>; checkpoint: boolean; sort(compareFn?: (a: T, b: T) => boolean): boolean; }
    export interface Box<T> {}
  ` }, libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] });
  const { deps, program, set } = fixture.openAndCapture(snapshot);
  const module = fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts");
  const { OpenedProgram } = await import("../../packages/host/dist/front/handles.js");
  const file = OpenedProgram.file(program, module).file;
  const checked = OpenedProgram.checked(program);
  const { ast } = checked;
  const { checker, typeShape } = checked.getSourceFileQueries(file);
  const owner = ast.children(file).find(node => ast.kindName(node) === "KindInterfaceDeclaration");
  const members = ast.children(owner);
  const [exact, later] = members.filter(node => ast.kindName(node) === "KindPropertySignature").map(node => ast.typeNode(node));
  const method = members.find(node => ast.kindName(node) === "KindMethodSignature");
  const syntax = ast.typeNode(ast.parameters(method)[0]);
  const receiver = checker.getTypeFromTypeNode(exact).type;
  const [signature] = typeShape.getCallSignatures(propertyRows(typeShape, receiver).find(row => row.name === "sort").type);
  const optional = typeShape.getSignatureParameterInfos(signature)[0].type;
  const selected = typeShape.getUnionOrIntersectionTypes(optional).find(arm => !typeShape.isNullish(arm));
  assert.equal(typeShape.getCallSignatures(selected)[0].target === checker.getSignatureFromDeclaration(syntax), true);
  const stop = new Error("actual callback annotation reader stop");
  let reads = 0;
  let readAfter = false;
  const observed = OpenedProgram.create({ ...checked, getSourceFileQueries(sourceFile) {
    const queries = checked.getSourceFileQueries(sourceFile);
    if (sourceFile !== file) return queries;
    return { ...queries, checker: { ...checker, getTypeFromTypeNode(node) {
      if (node === syntax) {
        reads += 1;
        throw stop;
      }
      if (node === later) readAfter = true;
      return checker.getTypeFromTypeNode(node);
    } } };
  } }, OpenedProgram.table(program), set.modules.map(entry =>
    OpenedProgram.file(program, entry.kind === "snapshot" ? entry.module : entry.document.module)),
  OpenedProgram.libraryData(program), OpenedProgram.contributions(program));
  for (const [limit, maximum] of [["maximumCapturedFactsPerModule", 46], ["maximumCapturedEdgesPerModule", 49]]) {
    const run = cap => fixture.front.captureModule({ ...deps, navigationCapture: { ...deps.navigationCapture, [limit]: cap } }, observed, module);
    primeCaptureReader(run, deps.navigationCapture[limit], stop);
    reads = 0;
    const refused = run(maximum - 1);
    assert.equal(refused.kind, "refused");
    assert.equal(refused.diagnostics.at(-1).code.name, "TSONIC_COMPILER_RESOURCE_LIMIT");
    assert.deepEqual(refused.diagnostics.at(-1).arguments, [
      { kind: "text", value: "front." + limit }, { kind: "number", value: maximum - 1 },
    ]);
    assert.equal(reads, 0);
    assert.throws(() => run(maximum), error => error === stop);
    assert.equal(reads, 1);
    assert.equal(readAfter, false);
  }
});

for (const [scenario, annotation, optional, admitted] of [
  ["direct required", "(value: T, index: number) => boolean", "", true],
  ["direct optional", "(value: T, index: number) => boolean", "?", true],
  ["required union", "((value: T, index: number) => boolean) | undefined", "", false],
  ["required alias", "Identity<(value: T, index: number) => boolean>", "", false],
  ["required overloads", "{ (value: T): boolean; (value: T, index: number): boolean; }", "", false],
]) {
  test(`changed-shape ${scenario} callback keeps only its proved authored input`, async () => {
    const fixture = await loadFrontFixture();
    const snapshot = fixture.projectSnapshot({ sourceFiles: { "main.ts": `
      export type Identity<X> = X;
      export interface Box<T> { find(predicate${optional}: ${annotation}): boolean; }
      export interface Box<T> {}
      export interface Holder<U> {}
      export interface Holder<U> { chosen: Box<U>; }
    ` }, libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] });
    const { deps, program } = fixture.openAndCapture(snapshot);
    const module = fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts");
    const { OpenedProgram } = await import("../../packages/host/dist/front/handles.js");
    const file = OpenedProgram.file(program, module).file;
    const { ast, getSourceFileQueries } = OpenedProgram.checked(program);
    const { checker, typeShape } = getSourceFileQueries(file);
    const interfaces = ast.children(file).filter(node => ast.kindName(node) === "KindInterfaceDeclaration");
    const chosen = ast.children(interfaces[3]).find(node => ast.kindName(node) === "KindPropertySignature");
    const use = ast.typeNode(chosen);
    const receiver = checker.getTypeFromTypeNode(use).type;
    const [mapping] = typeShape.getTypeReferenceArgumentInfos(receiver);
    const [method] = typeShape.getCallSignatures(propertyRows(typeShape, receiver).find(entry => entry.name === "find").type);
    const [original] = typeShape.getSignatureParameterInfos(method.target);
    const [applied] = typeShape.getSignatureParameterInfos(method);
    const payload = type => typeShape.isUnion(type)
      ? typeShape.getUnionOrIntersectionTypes(type).find(arm => !typeShape.isNullish(arm)) : type;
    const originals = typeShape.getCallSignatures(payload(original.type));
    const selected = typeShape.getCallSignatures(payload(applied.type));
    assert.equal(applied.parameterKind, optional ? "optional" : "required");
    assert.equal(applied.acceptsOmission, optional === "?");
    assert.equal(originals.length, scenario === "required overloads" ? 2 : 1);
    assert.equal(selected.length, originals.length);
    assert.equal(selected.every((signature, index) => signature.target === originals[index] &&
      signature.derivation?.owner === payload(applied.type) && signature.derivation?.index === index), true);
    assert.equal(mapping.parameter === mapping.argument, false);
    assert.equal(typeShape.getSignatureParameterInfos(originals[0])[0].type === mapping.parameter, true);
    assert.equal(typeShape.getSignatureParameterInfos(selected[0])[0].type === mapping.argument, true);
    const syntax = ast.typeNode(original.declaration);
    if (scenario === "required alias") {
      const inner = ast.as.AsTypeReferenceNode(syntax).TypeArguments.Nodes[0];
      assert.equal(checker.getTypeFromTypeNode(syntax).type === checker.getTypeFromTypeNode(inner).type, true);
    }
    if (scenario === "required union") assert.equal(typeShape.isUnion(applied.type), true);

    if (!admitted) {
      assert.throws(() => fixture.front.captureModule(deps, program, module), /a merged type parameter requires its actual selected declaration association/);
      return;
    }
    const captured = fixture.front.captureModule(deps, program, module);
    assert.equal(captured.kind, "ok");
    const raw = captured.value;
    const ids = OpenedProgram.syntax(program).get("/project/src/main.ts").outcome.numbering.ids;
    const inventory = type => raw.types.members[type.form.value.inventory];
    const authored = raw.types.types.find(type => type.authoredTypeNode?.node === ids.get(use));
    const read = inventory(authored).members.find(row => row.name === "find").read.value;
    const signature = raw.types.signatures[inventory(raw.types.types[read]).calls[0]];
    const parameter = raw.types.types[signature.parameters[0].type];
    const callbackType = optional ? parameter.form.value.members.map(id => raw.types.types[id])
      .find(row => row.form.value.kind === "structure") : parameter;
    assert.equal(parameter.form.value.kind, optional ? "union" : "structure");
    const callback = raw.types.signatures[inventory(callbackType).calls[0]];
    const sourceCallback = raw.types.signatures[callback.target];
    const originalBinder = { module, node: ids.get(ast.typeParameters(interfaces[0])[0]) };
    const selectedBinder = { module, node: ids.get(ast.typeParameters(interfaces[3])[0]) };
    assert.deepEqual(raw.types.types[sourceCallback.parameters[0].type].form.value.parameter, originalBinder);
    assert.deepEqual(raw.types.types[callback.parameters[0].type].form.value.parameter, selectedBinder);
    assert.deepEqual(raw.types.types[callback.parameters[1].type].form.value, { kind: "scalar", scalar: "number" });
  });
}

for (const annotation of ["T[]", "Identity<T[]>"]) {
  test(`a required callback's ${annotation} can reuse only a proved receiver backedge`, async () => {
    const fixture = await loadFrontFixture();
    const library = fixture.sdk.barebonesLibContent.replace(" [n: number]: T;", "");
    assert.notEqual(library, fixture.sdk.barebonesLibContent);
    const snapshot = fixture.projectSnapshot({ sourceFiles: { "main.ts": "export type Mode = boolean;" }, libraries: [
      { name: "lib.es5.d.ts", text: library },
      { name: "lib.es2023.array.d.ts", text: `
        type Identity<X> = X;
        interface Array<T> {
          exact: T[];
          checkpoint: boolean;
          find(predicate: (value: T, index: number, array: ${annotation}) => boolean): boolean;
        }
      ` },
    ] });
    const { deps, program, set } = fixture.openAndCapture(snapshot);
    const module = fixture.moduleOf(fixture.packageOf("/checker"), "lib.es2023.array.d.ts");
    const { OpenedProgram } = await import("../../packages/host/dist/front/handles.js");
    const file = OpenedProgram.file(program, module).file;
    const checked = OpenedProgram.checked(program);
    const { ast } = checked;
    const { checker, typeShape } = checked.getSourceFileQueries(file);
    const declaration = ast.children(file).find(node => ast.kindName(node) === "KindInterfaceDeclaration");
    const [use, checkpoint] = ast.children(declaration).filter(node => ast.kindName(node) === "KindPropertySignature").map(node => ast.typeNode(node));
    const receiver = checker.getTypeFromTypeNode(use).type;
    const [method] = typeShape.getCallSignatures(propertyRows(typeShape, receiver).find(row => row.name === "find").type);
    const [callback] = typeShape.getCallSignatures(typeShape.getSignatureParameterInfos(method)[0].type);
    const original = typeShape.getSignatureParameterInfos(callback.target)[2];
    const selected = typeShape.getSignatureParameterInfos(callback)[2];
    assert.equal(checker.getTypeFromTypeNode(ast.typeNode(original.declaration)).type === original.type, true);
    assert.equal(original.type === receiver && selected.type === receiver, true);
    assert.equal(checker.getRootSymbols(selected.sourceSymbol)[0] === original.sourceSymbol, true);
    if (annotation !== "T[]") {
      let readLater = false;
      const observed = OpenedProgram.create({ ...checked, getSourceFileQueries(sourceFile) {
        const queries = checked.getSourceFileQueries(sourceFile);
        if (sourceFile !== file) return queries;
        return { ...queries, checker: { ...checker, getTypeFromTypeNode(node) {
          if (node === checkpoint) readLater = true;
          return checker.getTypeFromTypeNode(node);
        } } };
      } }, OpenedProgram.table(program), set.modules.map(entry =>
        OpenedProgram.file(program, entry.kind === "snapshot" ? entry.module : entry.document.module)),
      OpenedProgram.libraryData(program), OpenedProgram.contributions(program));
      assert.throws(() => fixture.front.captureModule(deps, observed, module), /a merged type parameter requires its actual selected declaration association/);
      assert.equal(readLater, false);
      return;
    }
    const captured = fixture.front.captureModule(deps, program, module);
    assert.equal(captured.kind, "ok");
    const raw = captured.value;
    const ids = OpenedProgram.syntax(program).get("/checker/lib.es2023.array.d.ts").outcome.numbering.ids;
    const inventory = type => raw.types.members[type.form.value.inventory];
    const authored = raw.types.types.find(type => type.authoredTypeNode?.node === ids.get(use));
    const root = inventory(authored);
    const read = root.members.find(row => row.name === "find").read.value;
    const signature = raw.types.signatures[inventory(raw.types.types[read]).calls[0]];
    const predicate = raw.types.signatures[inventory(raw.types.types[signature.parameters[0].type]).calls[0]];
    assert.notEqual(predicate.target, null);
    assert.deepEqual(raw.types.types[predicate.parameters[0].type].form.value.parameter,
      { module, node: ids.get(ast.typeParameters(declaration)[0]) });
    const projected = raw.types.types[predicate.parameters[2].type];
    assert.equal(projected.authoredTypeNode, null);
    assert.equal(inventory(projected).id, root.id);
  });
}

test("an applied callback return retains the original callable and the selected receiver binder", async () => {
  const fixture = await loadFrontFixture();
  const snapshot = fixture.projectSnapshot({ sourceFiles: { "main.ts": `
    export interface Box<T> { left: Box<T>; fold(combine: (previous: T, current: T) => T): boolean; }
    export interface Box<T> { right: Box<T>; }
    export interface Holder<U> {}
    export interface Holder<U> { chosen: Box<U>; }
  ` }, libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] });
  const { captured, deps, interner, opened } = fixture.captureModulesOf(snapshot);
  const module = fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts");
  const { raw } = captured.find(entry => entry.module === module);
  const { OpenedProgram } = await import("../../packages/host/dist/front/handles.js");
  const checked = OpenedProgram.checked(opened.program);
  const { ast } = checked;
  const { checker, typeShape } = checked.getSourceFileQueries(OpenedProgram.file(opened.program, module).file);
  const numbering = OpenedProgram.syntax(opened.program).get("/project/src/main.ts").outcome.numbering;
  const [left, right, , holder] = raw.tree.statements.nodes;
  const method = numbering.nodes[left.members.nodes.find(member => member.name.text === "fold").id];
  const annotation = ast.typeNode(ast.parameters(method)[0]);
  const original = checker.getSignatureFromDeclaration(annotation);
  const authored = checker.getTypeFromTypeNode(ast.typeNode(annotation)).type;
  assert.equal(checker.getReturnTypeOfSignature(original)?.type === authored, true);
  const native = [];
  const capturedCallbacks = [];
  const inventory = row => raw.types.members[row.form.value.inventory];
  const { createTypeConversion, convertRawType } = await import("../../packages/host/dist/front/type-conversion.js");
  const conversion = createTypeConversion(deps, raw);
  function verifyResult(signature, owner) {
    assert.deepEqual(signature.declaration, { module, node: numbering.ids.get(annotation) });
    const row = raw.types.types[signature.result.value];
    const parameter = { module, node: owner.typeParameters.nodes[0].id };
    assert.equal(row.authoredTypeNode, null);
    assert.deepEqual(row.form.value.parameter, parameter);
    const result = convertRawType(conversion, row.id);
    assert.equal(result.kind, "complete");
    assert.deepEqual(fixture.types.readType(interner, result.value.type), { kind: "param", parameter: deps.definitionOf(parameter) });
    return result.value.type;
  }
  for (const [owner, property] of [[left, "left"], [right, "right"], [holder, "chosen"]]) {
    const node = numbering.nodes[owner.members.nodes.find(member => member.name.text === property).id];
    const syntax = ast.typeNode(node);
    const receiver = checker.getTypeFromTypeNode(syntax).type;
    const [argument] = typeShape.getTypeReferenceArgumentInfos(receiver);
    const [selected] = typeShape.getCallSignatures(propertyRows(typeShape, receiver).find(member => member.name === "fold").type);
    const callbackType = typeShape.getSignatureParameterInfos(selected)[0].type;
    const [callback] = typeShape.getCallSignatures(callbackType);
    assert.equal(callback.target === original && callback.mapper !== undefined, true);
    assert.equal(callback.derivation.kind === "member" && callback.derivation.owner === callbackType, true);
    assert.equal(argument.parameter === authored && checker.getReturnTypeOfSignature(callback)?.type === argument.argument, true);
    assert.equal(argument.argument === authored, owner !== holder);
    native.push(callback);
    const root = raw.types.types.find(row => row.authoredTypeNode?.node === numbering.ids.get(syntax));
    const folded = inventory(raw.types.types[inventory(root).members.find(member => member.name === "fold").read.value]);
    const outer = raw.types.signatures[folded.calls[0]];
    const [selectedId] = inventory(raw.types.types[outer.parameters[0].type]).calls;
    const selectedCallback = raw.types.signatures[selectedId];
    capturedCallbacks.push(selectedCallback);
    assert.equal(verifyResult(selectedCallback, owner) === verifyResult(raw.types.signatures[selectedCallback.target], left), owner === left);
  }
  assert.equal(native[0] === native[1], true);
  assert.notEqual(capturedCallbacks[0].id, capturedCallbacks[1].id);
  assert.equal(capturedCallbacks[0].target, capturedCallbacks[1].target);
});

for (const wrapped of [false, true]) test(wrapped ? "an alias-wrapped callback return cannot borrow the same native binder" :
  "the applied callback return preserves the original signature reader stop", async () => {
  const fixture = await loadFrontFixture();
  const snapshot = fixture.projectSnapshot({ sourceFiles: { "main.ts": `
    export interface Box<T> {
      exact: Box<T>; checkpoint: boolean;
      fold(combine: (previous: T, current: T) => ${wrapped ? "Identity<T>" : "T"}): boolean;
    }
    export interface Box<T> {}
    type Identity<X> = X;
  ` }, libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] });
  const { deps, program, set } = fixture.openAndCapture(snapshot);
  const module = fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts");
  const { OpenedProgram } = await import("../../packages/host/dist/front/handles.js");
  const checked = OpenedProgram.checked(program);
  const file = OpenedProgram.file(program, module).file;
  const { ast } = checked;
  const { checker, typeShape } = checked.getSourceFileQueries(file);
  const owner = ast.children(file).find(node => ast.kindName(node) === "KindInterfaceDeclaration");
  const members = ast.children(owner);
  const [exact, checkpoint] = members.filter(node => ast.kindName(node) === "KindPropertySignature").map(node => ast.typeNode(node));
  const method = members.find(node => ast.kindName(node) === "KindMethodSignature");
  const annotation = ast.typeNode(ast.parameters(method)[0]);
  const result = ast.typeNode(annotation);
  const inner = wrapped ? ast.as.AsTypeReferenceNode(result).TypeArguments.Nodes[0] : result;
  const receiver = checker.getTypeFromTypeNode(exact).type;
  const [argument] = typeShape.getTypeReferenceArgumentInfos(receiver);
  const [fold] = typeShape.getCallSignatures(propertyRows(typeShape, receiver).find(member => member.name === "fold").type);
  const [selected] = typeShape.getCallSignatures(typeShape.getSignatureParameterInfos(fold)[0].type);
  const original = checker.getSignatureFromDeclaration(annotation);
  assert.equal(selected.target === original, true);
  assert.equal(checker.getTypeFromTypeNode(result).type === argument.argument && checker.getTypeFromTypeNode(inner).type === argument.argument, true);
  assert.equal(checker.getReturnTypeOfSignature(original)?.type === argument.parameter && checker.getReturnTypeOfSignature(selected)?.type === argument.argument, true);
  const stop = new Error("original callback return reader stop");
  let originalReads = 0;
  let selectedReads = 0;
  let readAfter = false;
  const observed = OpenedProgram.create({ ...checked, getSourceFileQueries(sourceFile) {
    const queries = checked.getSourceFileQueries(sourceFile);
    if (sourceFile !== file) return queries;
    return { ...queries, checker: { ...checker, getReturnTypeOfSignature(signature) {
      if (signature === original) { originalReads += 1; throw stop; }
      if (signature === selected) selectedReads += 1;
      return checker.getReturnTypeOfSignature(signature);
    }, getTypeFromTypeNode(node) {
      if (node === result || node === inner || node === checkpoint) readAfter = true;
      return checker.getTypeFromTypeNode(node);
    } } };
  } }, OpenedProgram.table(program), set.modules.map(entry =>
    OpenedProgram.file(program, entry.kind === "snapshot" ? entry.module : entry.document.module)),
  OpenedProgram.libraryData(program), OpenedProgram.contributions(program));
  const run = (limit, maximum) => fixture.front.captureModule(limit === undefined ? deps
    : { ...deps, navigationCapture: { ...deps.navigationCapture, [limit]: maximum } }, observed, module);
  if (wrapped) {
    assert.throws(() => run(), /a merged type parameter requires its actual selected declaration association/u);
    assert.equal(originalReads, 0);
    assert.equal(selectedReads, 1);
    assert.equal(readAfter, false);
    return;
  }
  for (const [limit, maximum] of [["maximumCapturedFactsPerModule", 62], ["maximumCapturedEdgesPerModule", 77]]) {
    primeCaptureReader(cap => run(limit, cap), deps.navigationCapture[limit], stop);
    originalReads = 0;
    selectedReads = 0;
    const refused = run(limit, maximum - 1);
    assert.equal(refused.kind, "refused");
    assert.equal(refused.diagnostics.at(-1).code.name, "TSONIC_COMPILER_RESOURCE_LIMIT");
    assert.deepEqual(refused.diagnostics.at(-1).arguments, [
      { kind: "text", value: "front." + limit }, { kind: "number", value: maximum - 1 },
    ]);
    assert.equal(originalReads, 0);
    assert.equal(readAfter, false);
    selectedReads = 0;
    assert.throws(() => run(limit, maximum), error => error === stop);
    assert.equal(originalReads, 1);
    assert.equal(selectedReads, 1);
    assert.equal(readAfter, false);
  }
});

test("a direct undefined union retains the original result binder and each applied arm's qualified source", async () => {
  const fixture = await loadFrontFixture();
  const snapshot = fixture.projectSnapshot({ sourceFiles: { "main.ts": `
    export interface Box<T> { at(index: number): T | undefined; left: Box<T>; }
    export interface Box<T> { right: Box<T>; }
    export interface Holder<U> {}
    export interface Holder<U> { chosen: Box<U>; }
  ` }, libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] });
  const { captured, deps, opened } = fixture.captureModulesOf(snapshot);
  const module = fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts");
  const { raw } = captured.find(entry => entry.module === module);
  const { OpenedProgram } = await import("../../packages/host/dist/front/handles.js");
  const { ast, getSourceFileQueries } = OpenedProgram.checked(opened.program);
  const { checker, typeShape } = getSourceFileQueries(OpenedProgram.file(opened.program, module).file);
  const numbered = OpenedProgram.syntax(opened.program).get("/project/src/main.ts").outcome.numbering;
  const [left, right, , holder] = raw.tree.statements.nodes;
  const declaration = numbered.nodes[left.members.nodes[0].id];
  const original = checker.getSignatureFromDeclaration(declaration);
  const source = checker.getTypeFromTypeNode(ast.typeNode(declaration)).type;
  assert.equal(checker.getReturnTypeOfSignature(original)?.type === source, true);
  const sourceArms = typeShape.getUnionOrIntersectionTypes(source);
  const authored = ast.as.AsUnionTypeNode(ast.typeNode(declaration)).Types.Nodes;
  assert.equal(checker.getTypeFromTypeNode(authored[0]).type === sourceArms[1], true);
  assert.equal(checker.getTypeFromTypeNode(authored[1]).type === sourceArms[0], true);
  const nat = [];
  const rows = [];
  const inventory = type => raw.types.members[type.form.value.inventory];
  function verifyResult(signature, binder) {
    const result = raw.types.types[signature.result.value];
    assert.equal(result.authoredTypeNode, null);
    const arms = result.form.value.members.map(id => raw.types.types[id]);
    assert.deepEqual(arms.find(row => row.form.value.kind === "scalar").form.value, { kind: "scalar", scalar: "undefined" });
    const value = arms.find(row => row.form.value.kind === "parameter");
    assert.deepEqual(value.form.value.parameter, binder);
    return deps.definitionOf(binder);
  }
  for (const [owner, name] of [[left, "left"], [right, "right"], [holder, "chosen"]]) {
    const member = owner.members.nodes.find(row => row.name.text === name);
    const syntax = ast.typeNode(numbered.nodes[member.id]);
    const receiver = checker.getTypeFromTypeNode(syntax).type;
    const [mapping] = typeShape.getTypeReferenceArgumentInfos(receiver);
    const [signature] = typeShape.getCallSignatures(propertyRows(typeShape, receiver).find(row => row.name === "at").type);
    assert.equal(signature.target === original, true);
    const returned = checker.getReturnTypeOfSignature(signature)?.type;
    const selected = typeShape.getUnionOrIntersectionTypes(returned);
    assert.equal(selected.includes(mapping.argument) && selected.includes(sourceArms[0]), true);
    assert.equal(returned === source, owner !== holder);
    nat.push(signature);
    const root = raw.types.types.find(row => row.authoredTypeNode?.node === numbered.ids.get(syntax));
    const read = inventory(root).members.find(row => row.name === "at").read.value;
    const selectedRow = raw.types.signatures[inventory(raw.types.types[read]).calls[0]];
    rows.push(selectedRow);
    const originalDef = verifyResult(raw.types.signatures[selectedRow.target], { module, node: left.typeParameters.nodes[0].id });
    const selectedDef = verifyResult(selectedRow, { module, node: owner.typeParameters.nodes[0].id });
    assert.equal(originalDef === selectedDef, owner === left);
  }
  assert.equal(nat[0] === nat[1], true);
  assert.notEqual(rows[0].id, rows[1].id);
  assert.equal(rows[0].target, rows[1].target);
});

test("a declared result keeps the original authored argument and each selected receiver binder", async () => {
  const fixture = await loadFrontFixture();
  const snapshot = fixture.projectSnapshot({ sourceFiles: { "main.ts": `
    export interface Endpoint<V> {}
    export interface Box<T> { values(): Endpoint<T>; left: Box<T>; }
    export interface Box<T> { right: Box<T>; }
    export interface Holder<U> {}
    export interface Holder<U> { chosen: Box<U>; }
  ` }, libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] });
  const { captured, deps, interner, opened } = fixture.captureModulesOf(snapshot);
  const module = fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts");
  const { raw } = captured.find(entry => entry.module === module);
  const { OpenedProgram } = await import("../../packages/host/dist/front/handles.js");
  const { ast, getSourceFileQueries } = OpenedProgram.checked(opened.program);
  const { checker, typeShape } = getSourceFileQueries(OpenedProgram.file(opened.program, module).file);
  const numbered = OpenedProgram.syntax(opened.program).get("/project/src/main.ts").outcome.numbering;
  const [endpoint, left, right, , holder] = raw.tree.statements.nodes;
  const method = numbered.nodes[left.members.nodes[0].id];
  const original = checker.getSignatureFromDeclaration(method);
  const syntax = ast.as.AsTypeReferenceNode(ast.typeNode(method));
  const source = checker.getTypeFromTypeNode(syntax.TypeArguments.Nodes[0]).type;
  const oldResult = checker.getReturnTypeOfSignature(original)?.type;
  const [oldArgument] = typeShape.getTypeReferenceArgumentInfos(oldResult);
  const authored = { module, node: numbered.ids.get(syntax.TypeArguments.Nodes[0]) };
  assert.equal(oldArgument.argument === source, true);
  assert.equal(checker.getTypeFromTypeNode(ast.typeNode(method)).type === oldResult, true);
  const native = [];
  const rows = [];
  const inventory = row => raw.types.members[row.form.value.inventory];
  const parameter = { module, node: endpoint.typeParameters.nodes[0].id };
  const { createTypeConversion, convertRawType } = await import("../../packages/host/dist/front/type-conversion.js");
  const conversion = createTypeConversion(deps, raw);
  function verifyResult(signature, owner) {
    const result = raw.types.types[signature.result.value];
    assert.equal(result.authoredTypeNode, null);
    assert.equal(result.form.value.kind, "declared");
    assert.deepEqual(result.form.value.declaration, { module, node: endpoint.id });
    const [argument] = result.form.value.arguments;
    assert.deepEqual(argument.parameter, parameter);
    assert.deepEqual(argument.explicitTypeNode, authored);
    const associated = raw.types.types[argument.argument.value];
    assert.deepEqual(raw.types.components[associated.component].path?.step, { kind: "argument-place", index: 0 });
    const binder = associated.form.value;
    assert.deepEqual(binder, { kind: "parameter", parameter: { module, node: owner.typeParameters.nodes[0].id }, constraint: null, default: null });
    const expected = deps.definitionOf(binder.parameter);
    const converted = convertRawType(conversion, result.id);
    assert.equal(converted.kind, "complete");
    const { terms } = fixture.types.viewTypes(interner);
    const retained = terms[converted.value.type];
    assert.equal(retained.kind, "declared");
    assert.equal(retained.definition, deps.definitionOf(result.form.value.declaration));
    assert.equal(retained.arguments.length, 1);
    assert.deepEqual(terms[retained.arguments[0]], { kind: "param", parameter: expected });
    return expected;
  }
  for (const [owner, name] of [[left, "left"], [right, "right"], [holder, "chosen"]]) {
    const member = owner.members.nodes.find(row => row.name.text === name);
    const annotation = ast.typeNode(numbered.nodes[member.id]);
    const receiver = checker.getTypeFromTypeNode(annotation).type;
    const [mapping] = typeShape.getTypeReferenceArgumentInfos(receiver);
    const [signature] = typeShape.getCallSignatures(propertyRows(typeShape, receiver).find(row => row.name === "values").type);
    const returned = checker.getReturnTypeOfSignature(signature)?.type;
    const [argument] = typeShape.getTypeReferenceArgumentInfos(returned);
    assert.equal(signature.target === original && signature.mapper !== undefined, true);
    assert.equal(typeShape.getTypeReferenceTarget(returned) === typeShape.getTypeReferenceTarget(oldResult), true);
    assert.equal(argument.parameter === oldArgument.parameter && argument.argument === mapping.argument, true);
    assert.equal(returned === oldResult, owner !== holder);
    native.push(signature);
    const root = raw.types.types.find(row => row.authoredTypeNode?.node === numbered.ids.get(annotation));
    const read = inventory(root).members.find(row => row.name === "values").read.value;
    const applied = raw.types.signatures[inventory(raw.types.types[read]).calls[0]];
    rows.push(applied);
    assert.equal(verifyResult(raw.types.signatures[applied.target], left) === verifyResult(applied, owner), owner === left);
  }
  assert.equal(native[0] === native[1], true);
  assert.notEqual(rows[0].id, rows[1].id);
  assert.equal(rows[0].target, rows[1].target);
});

for (const wrapped of [false, true]) test(wrapped ? "an alias-wrapped self result cannot borrow the native receiver" :
  "an authored self result preserves the exact receiver and its downstream applied formal", async () => {
  const fixture = await loadFrontFixture();
  const snapshot = fixture.projectSnapshot({ sourceFiles: { "main.ts": `
    export interface Box<T> { left: Box<T>; revisit(): ${wrapped ? "Identity<this>" : "this"}; change(index: number, value: T): Box<T>; }
    export interface Box<T> { right: Box<T>; }
    export interface Holder<U> {}
    export interface Holder<U> { chosen: Box<U>; }
    type Identity<X> = X;
  ` }, libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] });
  const opened = fixture.openAndCapture(snapshot);
  const module = fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts");
  const { OpenedProgram } = await import("../../packages/host/dist/front/handles.js");
  const checked = OpenedProgram.checked(opened.program);
  const file = OpenedProgram.file(opened.program, module).file;
  const { ast } = checked;
  const { checker, typeShape } = checked.getSourceFileQueries(file);
  const fragments = ast.children(file).filter(node => ast.kindName(node) === "KindInterfaceDeclaration");
  const owner = fragments[0];
  const method = ast.children(owner).find(node => ast.kindName(node) === "KindMethodSignature");
  const annotation = ast.typeNode(method);
  const selfNode = wrapped ? ast.as.AsTypeReferenceNode(annotation).TypeArguments.Nodes[0] : annotation;
  const original = checker.getSignatureFromDeclaration(method);
  const self = checker.getTypeFromTypeNode(selfNode).type;
  const ownerSymbol = checker.getSymbolAtLocation(ast.name(owner));
  assert.equal(ast.kindName(selfNode), "KindThisType");
  assert.equal(checker.getTypeFromTypeNode(annotation).type === self && checker.getReturnTypeOfSignature(original)?.type === self, true);
  assert.equal(checker.getTypeSymbol(self) === ownerSymbol && self === checker.getDeclaredTypeOfSymbol(ownerSymbol).data.AsInterfaceType().thisType, true);
  const natives = [];
  for (const fragment of [fragments[0], fragments[1], fragments[3]]) {
    const property = ast.children(fragment).find(node => ast.kindName(node) === "KindPropertySignature");
    const receiverNode = ast.typeNode(property);
    const receiver = checker.getTypeFromTypeNode(receiverNode).type;
    const [argument] = typeShape.getTypeReferenceArgumentInfos(receiver);
    const properties = propertyRows(typeShape, receiver);
    const [selected] = typeShape.getCallSignatures(properties.find(value => value.name === "revisit").type);
    const [change] = typeShape.getCallSignatures(properties.find(value => value.name === "change").type);
    assert.equal(selected.target === original && selected.mapper !== undefined, true);
    assert.equal(checker.getReturnTypeOfSignature(selected)?.type === receiver && receiver !== self, true);
    assert.equal(typeShape.getSignatureParameterInfos(change)[1].type === argument.argument, true);
    natives.push({ selected, receiverNode, binder: ast.typeParameters(fragment)[0] });
  }
  assert.equal(natives[0].selected === natives[1].selected, true);
  assert.equal(natives[0].selected === natives[2].selected, false);
  if (wrapped) {
    let sourceReads = 0;
    let selectedReads = 0;
    const program = OpenedProgram.create({ ...checked, getSourceFileQueries(sourceFile) {
      const queries = checked.getSourceFileQueries(sourceFile);
      if (sourceFile !== file) return queries;
      return { ...queries, checker: { ...checker, getReturnTypeOfSignature(signature) {
        if (signature === original) sourceReads += 1;
        if (signature === natives[0].selected) selectedReads += 1;
        return checker.getReturnTypeOfSignature(signature);
      } } };
    } }, OpenedProgram.table(opened.program), opened.set.modules.map(entry =>
      OpenedProgram.file(opened.program, entry.kind === "snapshot" ? entry.module : entry.document.module)),
    OpenedProgram.libraryData(opened.program), OpenedProgram.contributions(opened.program));
    assert.throws(() => fixture.front.captureModule(opened.deps, program, module),
      /a merged type parameter requires its actual selected declaration association/u);
    assert.equal(sourceReads, 0);
    assert.equal(selectedReads, 1);
    return;
  }
  const captured = fixture.front.captureModule(opened.deps, opened.program, module);
  assert.equal(captured.kind, "ok");
  const raw = captured.value;
  const numbered = OpenedProgram.syntax(opened.program).get("/project/src/main.ts").outcome.numbering;
  const definitions = fixture.front.lowerModuleDefinitions({ module: raw,
    componentRoots: raw.types.components.map(component => component.root).filter(root => root.module === module) });
  assert.equal(definitions.kind, "ok");
  const interner = fixture.types.createTypeInterner();
  const deps = fixture.lowerDepsFor(definitions.value, interner, snapshot.source.input.packages.files.find(file => file.path === "/project/src/main.ts").text);
  const { createTypeConversion, convertRawType } = await import("../../packages/host/dist/front/type-conversion.js");
  const conversion = createTypeConversion(deps, raw);
  const inventory = row => raw.types.members[row.form.value.inventory];
  const originalOwner = { module, node: numbered.ids.get(owner) };
  function memberSignature(row, name) {
    const child = inventory(row).members.find(member => member.name === name).read.value;
    return raw.types.signatures[inventory(raw.types.types[child]).calls[0]];
  }
  for (const { receiverNode, binder } of natives) {
    const origin = raw.types.types.find(row => row.authoredTypeNode?.node === numbered.ids.get(receiverNode));
    const method = memberSignature(origin, "revisit");
    const selected = raw.types.types[method.result.value];
    assert.equal(selected.authoredTypeNode, null);
    assert.equal(selected.form.value.kind, "structure");
    assert.equal(memberSignature(selected, "revisit").id, method.id);
    const formal = memberSignature(selected, "change").parameters[1];
    assert.deepEqual(raw.types.types[formal.type].form.value.parameter, { module, node: numbered.ids.get(binder) });
    const originalResult = raw.types.types[raw.types.signatures[method.target].result.value];
    assert.deepEqual(originalResult.form.value, { kind: "self", owner: originalOwner });
    const published = convertRawType(conversion, originalResult.id);
    assert.equal(published.kind, "complete");
    assert.deepEqual(fixture.types.readType(interner, published.value.type), { kind: "self", owner: deps.definitionOf(originalOwner) });
  }
});

test("a nested callback annotation keeps the self owner of its actual interface", async () => {
  const fixture = await loadFrontFixture();
  const source = "export interface Left { use(callback: (items: this) => boolean): boolean; }"
    + " export interface Right { use(callback: (items: this) => boolean): boolean; }";
  const snapshot = fixture.projectSnapshot({ sourceFiles: { "main.ts": source },
    libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] });
  const { deps, program } = fixture.openAndCapture(snapshot);
  const module = snapshot.entryPoint;
  const result = fixture.front.captureModule(deps, program, module);
  assert.equal(result.kind, "ok");
  const { tree, types } = result.value;
  const owners = tree.statements.nodes.map(declaration => {
    const method = declaration.members.nodes[0];
    const callback = method.parameters.nodes[0].type;
    return { authored: { module, node: callback.parameters.nodes[0].type.id },
      owner: { module, node: declaration.id } };
  });
  assert.notEqual(owners[0].owner.node, owners[1].owner.node);
  for (const { authored, owner } of owners) {
    const rows = types.types.filter(row => row.form.value?.kind === "self"
      && row.form.value.owner.module === module && row.form.value.owner.node === owner.node);
    assert.equal(rows.length, 2);
    assert.ok(rows.some(row => row.authoredTypeNode?.node === authored.node
      && row.authoredTypeNode.module === module));
    assert.ok(rows.some(row => row.authoredTypeNode === null
      && types.components[row.component].path?.step.kind === "parameter"));
  }
});

test("a checked interface method keeps its actual self result owner", async () => {
  const fixture = await loadFrontFixture();
  const actual = fixture.checkedModuleOf("export interface Handle { revisit(): this; }");
  assert.deepEqual(fixture.verifyChecked(actual.checked, actual.interner), []);
  const [owner] = actual.checked.tree.statements.nodes;
  const result = owner.members.nodes[0].type;
  assert.equal(result.kind, "ThisType");
  assert.deepEqual(fixture.types.readType(actual.interner, result.tsonic.type.value), { kind: "self", owner: owner.tsonic.definition });
});

for (const wrapped of [false, true]) test(wrapped ? "a same-pointer wrapped rest array cannot borrow a receiver backedge" :
  "an actual whole rest array preserves the qualified receiver through its members", async () => {
  const fixture = await loadFrontFixture();
  const source = `
    interface Array<T> {
      anchor: T[];
      patch(index: number, ...items: ${wrapped ? "Identity<T[]>" : "T[]"}): T[];
      with(index: number, value: T): T[];
    }
    type Identity<X> = X;
  `;
  const library = "lib.es2023.array.d.ts";
  const foundation = fixture.sdk.barebonesLibContent.replace(" [n: number]: T;", "");
  const snapshot = fixture.projectSnapshot({ sourceFiles: { "main.ts": "export type Ready = boolean;" },
    libraries: [{ name: "lib.es5.d.ts", text: foundation }, { name: library, text: source }] });
  const { deps, program } = fixture.openAndCapture(snapshot);
  const module = fixture.moduleOf(fixture.packageOf("/checker"), library);
  const { OpenedProgram } = await import("../../packages/host/dist/front/handles.js");
  const checked = OpenedProgram.checked(program);
  const file = OpenedProgram.file(program, module).file;
  const { ast } = checked;
  const { checker, typeShape } = checked.getSourceFileQueries(file);
  const owner = ast.children(file).find(node => ast.kindName(node) === "KindInterfaceDeclaration");
  const members = ast.children(owner);
  const anchor = ast.typeNode(members.find(node => ast.kindName(node) === "KindPropertySignature"));
  const method = members.find(node => ast.kindName(node) === "KindMethodSignature");
  const original = checker.getSignatureFromDeclaration(method);
  const receiver = checker.getTypeFromTypeNode(anchor).type;
  const [selected] = typeShape.getCallSignatures(propertyRows(typeShape, receiver).find(property => property.name === "patch").type);
  const originalRest = typeShape.getSignatureParameterInfos(original)[1];
  const appliedRest = typeShape.getSignatureParameterInfos(selected)[1];
  const annotation = ast.typeNode(originalRest.declaration);
  assert.equal(selected.target === original && selected.mapper !== undefined, true);
  assert.deepEqual([originalRest.parameterKind, appliedRest.parameterKind], ["rest", "rest"]);
  assert.equal(originalRest.declaration === appliedRest.declaration && ast.parent(originalRest.declaration) === method, true);
  assert.equal(typeShape.isTuple(appliedRest.type), false);
  assert.equal(checker.getTypeFromTypeNode(annotation).type === receiver && appliedRest.type === receiver && originalRest.type === receiver, true);
  assert.equal(ast.kindName(annotation), wrapped ? "KindTypeReference" : "KindArrayType");
  assert.equal(ast.as.AsParameterDeclaration(originalRest.declaration).DotDotDotToken !== undefined, true);
  const run = () => fixture.front.captureModule(deps, program, module);
  if (wrapped) {
    assert.throws(run, /a merged type parameter requires its actual selected declaration association/u);
    return;
  }
  const captured = run();
  assert.equal(captured.kind, "ok");
  const raw = captured.value;
  const numbered = OpenedProgram.syntax(program).get("/checker/" + library).outcome.numbering;
  const root = raw.types.types.find(row => row.authoredTypeNode?.node === numbered.ids.get(anchor));
  const inventory = row => raw.types.members[row.form.value.inventory];
  function memberSignature(row, name) {
    const child = inventory(row).members.find(member => member.name === name).read.value;
    return raw.types.signatures[inventory(raw.types.types[child]).calls[0]];
  }
  const applied = memberSignature(root, "patch");
  const parameter = applied.parameters[1];
  assert.equal(parameter.kind, "rest");
  assert.equal(applied.parameters.length, 2);
  assert.deepEqual(parameter.declaration, { module, node: numbered.ids.get(originalRest.declaration) });
  const whole = raw.types.types[parameter.type];
  assert.equal(whole.authoredTypeNode, null);
  assert.equal(whole.form.value.kind, "structure");
  assert.equal(memberSignature(whole, "patch").id, applied.id);
  const later = memberSignature(whole, "with").parameters[1];
  assert.deepEqual(raw.types.types[later.type].form.value.parameter, { module, node: numbered.ids.get(ast.typeParameters(owner)[0]) });
});

test("a composed rest preserves original and applied native arm orders and their distinct authored arguments", async () => {
  const fixture = await loadFrontFixture();
  const foundation = fixture.sdk.barebonesLibContent.replace(" [n: number]: T;", "");
  const snapshot = fixture.projectSnapshot({ sourceFiles: { "main.ts": `
    export interface Wrapped<V> {}
    export interface Box<T> {
      left: Box<T>;
      first(...items: (Wrapped<T> | T)[]): boolean;
      second(...items: (T | Wrapped<T>)[]): boolean;
    }
    export interface Box<T> { right: Box<T>; }
    export interface Holder<U> {}
    export interface Holder<U> { chosen: Box<U>; }
  ` }, libraries: [{ name: "lib.es5.d.ts", text: foundation },
    { name: "lib.es2023.array.d.ts", text: "interface Array<T> { with(index: number, value: T): boolean; }" }] });
  const { captured, deps, opened } = fixture.captureModulesOf(snapshot);
  const module = fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts");
  const { raw } = captured.find(entry => entry.module === module);
  const { OpenedProgram } = await import("../../packages/host/dist/front/handles.js");
  const checked = OpenedProgram.checked(opened.program);
  const { ast } = checked;
  const { checker, typeShape } = checked.getSourceFileQueries(OpenedProgram.file(opened.program, module).file);
  const numbered = OpenedProgram.syntax(opened.program).get("/project/src/main.ts").outcome.numbering;
  const [wrapper, left, right, , holder] = raw.tree.statements.nodes;
  const inventory = row => raw.types.members[row.form.value.inventory];
  function member(rawType, name) {
    const property = inventory(rawType).members.find(member => member.name === name);
    return raw.types.signatures[inventory(raw.types.types[property.read.value]).calls[0]];
  }
  function recordedUnion(row, type, bare, argumentNode, expectedOwner) {
    assert.equal(row.form.value.kind, "union");
    const native = typeShape.getUnionOrIntersectionTypes(type);
    assert.equal(row.form.value.members.length, native.length);
    for (const [index, arm] of native.entries()) {
      const branch = raw.types.types[row.form.value.members[index]];
      assert.deepEqual(raw.types.components[branch.component].path?.step, { kind: "union-member", index });
      const parameter = { module, node: expectedOwner.typeParameters.nodes[0].id };
      if (arm === bare) {
        assert.deepEqual(branch.form.value.parameter, parameter);
      } else {
        assert.equal(branch.form.value.kind, "declared");
        assert.deepEqual(branch.form.value.declaration, { module, node: wrapper.id });
        const [binding] = branch.form.value.arguments;
        assert.deepEqual(binding.parameter, { module, node: wrapper.typeParameters.nodes[0].id });
        assert.deepEqual(binding.explicitTypeNode, { module, node: numbered.ids.get(argumentNode) });
        assert.deepEqual(raw.types.types[binding.argument.value].form.value.parameter, parameter);
        const [actual] = typeShape.getTypeReferenceArgumentInfos(arm);
        assert.equal(actual.argument === bare && actual.scope === "local", true);
      }
    }
    assert.equal(deps.definitionOf({ module, node: expectedOwner.typeParameters.nodes[0].id }) !== undefined, true);
  }
  const nativeWith = [];
  const rawWith = [];
  for (const [owner, property] of [[left, "left"], [right, "right"], [holder, "chosen"]]) {
    const receiverNode = ast.typeNode(numbered.nodes[owner.members.nodes.find(row => row.name.text === property).id]);
    const receiver = checker.getTypeFromTypeNode(receiverNode).type;
    const [argument] = typeShape.getTypeReferenceArgumentInfos(receiver);
    const root = raw.types.types.find(row => row.authoredTypeNode?.node === numbered.ids.get(receiverNode));
    const nativeMembers = propertyRows(typeShape, receiver);
    for (const name of ["first", "second"]) {
      const method = numbered.nodes[left.members.nodes.find(row => row.name.text === name).id];
      const original = checker.getSignatureFromDeclaration(method);
      const [selected] = typeShape.getCallSignatures(nativeMembers.find(property => property.name === name).type);
      assert.equal(selected.target === original, true);
      const [oldFormal] = typeShape.getSignatureParameterInfos(original);
      const [selectedFormal] = typeShape.getSignatureParameterInfos(selected);
      const syntax = ast.typeNode(oldFormal.declaration);
      const grouping = ast.as.AsArrayTypeNode(syntax).ElementType;
      const union = ast.as.AsParenthesizedTypeNode(grouping).Type;
      const arms = ast.as.AsUnionTypeNode(union).Types.Nodes;
      const reference = ast.as.AsTypeReferenceNode(arms[name === "first" ? 0 : 1]);
      const argumentNode = reference.TypeArguments.Nodes[0];
      const originalUnion = typeShape.getTypeReferenceArgumentInfos(oldFormal.type)[0].argument;
      const selectedUnion = typeShape.getTypeReferenceArgumentInfos(selectedFormal.type)[0].argument;
      assert.equal(checker.getTypeFromTypeNode(union).type === originalUnion, true);
      const branchTypes = typeShape.getUnionOrIntersectionTypes(originalUnion);
      assert.equal(checker.getTypeFromTypeNode(arms[0]).type === branchTypes[0], name !== "first");
      assert.equal(originalUnion === selectedUnion, owner !== holder);
      const rawSignature = member(root, name);
      const rawOriginal = raw.types.signatures[rawSignature.target];
      const parent = member(raw.types.types[rawOriginal.parameters[0].type], "with");
      const applied = member(raw.types.types[rawSignature.parameters[0].type], "with");
      recordedUnion(raw.types.types[parent.parameters[1].type], originalUnion, argument.parameter, argumentNode, left);
      recordedUnion(raw.types.types[applied.parameters[1].type], selectedUnion, argument.argument, argumentNode, owner);
      if (owner === left) {
        const property = propertyRows(typeShape, selectedFormal.type).find(row => row.name === "with");
        nativeWith.push(typeShape.getCallSignatures(property.type)[0]);
        rawWith.push(applied.id);
      }
    }
  }
  assert.equal(nativeWith[0] === nativeWith[1], true);
  assert.notEqual(rawWith[0], rawWith[1]);
});

test("a crossed rest arm cannot borrow the same native declared reference through an alias", async () => {
  const fixture = await loadFrontFixture();
  const foundation = fixture.sdk.barebonesLibContent.replace(" [n: number]: T;", "");
  const snapshot = fixture.projectSnapshot({ sourceFiles: { "main.ts": `
    export interface Wrapped<V> {}
    type Identity<V> = V;
    export interface Box<T> {
      anchor: Box<T>; direct: Wrapped<T>;
      crossed(...items: (Identity<Wrapped<T>> | T)[]): boolean;
    }
    export interface Box<T> {}
  ` }, libraries: [{ name: "lib.es5.d.ts", text: foundation },
    { name: "lib.es2023.array.d.ts", text: "interface Array<T> { with(index: number, value: T): boolean; }" }] });
  const { deps, program } = fixture.openAndCapture(snapshot);
  const module = fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts");
  const { OpenedProgram } = await import("../../packages/host/dist/front/handles.js");
  const checked = OpenedProgram.checked(program);
  const file = OpenedProgram.file(program, module).file;
  const { ast } = checked;
  const { checker, typeShape } = checked.getSourceFileQueries(file);
  const owner = ast.children(file).filter(node => ast.kindName(node) === "KindInterfaceDeclaration")[1];
  const members = ast.children(owner);
  const [anchor, direct] = members.filter(node => ast.kindName(node) === "KindPropertySignature").map(node => ast.typeNode(node));
  const method = members.find(node => ast.kindName(node) === "KindMethodSignature");
  const original = checker.getSignatureFromDeclaration(method);
  const receiver = checker.getTypeFromTypeNode(anchor).type;
  const [selected] = typeShape.getCallSignatures(propertyRows(typeShape, receiver).find(row => row.name === "crossed").type);
  const [old] = typeShape.getSignatureParameterInfos(original);
  const [applied] = typeShape.getSignatureParameterInfos(selected);
  const wrapped = ast.as.AsArrayTypeNode(ast.typeNode(old.declaration)).ElementType;
  const syntax = ast.as.AsParenthesizedTypeNode(wrapped).Type;
  const [crossed] = ast.as.AsUnionTypeNode(syntax).Types.Nodes;
  const fromOtherUse = checker.getTypeFromTypeNode(direct).type;
  assert.equal(selected.target === original && old.type === applied.type, true);
  assert.equal(checker.getTypeFromTypeNode(crossed).type === fromOtherUse, true);
  const [element] = typeShape.getTypeReferenceArgumentInfos(applied.type);
  assert.equal(typeShape.getUnionOrIntersectionTypes(element.argument).includes(fromOtherUse), true);
  assert.equal(checker.getSymbolAtLocation(ast.as.AsTypeReferenceNode(crossed).TypeName) === checker.getTypeSymbol(fromOtherUse), false);
  assert.throws(() => fixture.front.captureModule(deps, program, module), /a merged type parameter requires its actual selected declaration association/u);
});

test("the composed rest preserves the original authored argument reader stop", async () => {
  const fixture = await loadFrontFixture();
  const snapshot = fixture.projectSnapshot({ sourceFiles: { "main.ts": `
    export interface Wrapped<V> {}
    export interface Box<T> {
      anchor: Box<T>;
      join(...items: (T | Wrapped<T>)[]): boolean;
      later: boolean;
    }
    export interface Box<T> {}
  ` }, libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent.replace(" [n: number]: T;", "") }] });
  const { deps, program, set } = fixture.openAndCapture(snapshot);
  const module = fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts");
  const { OpenedProgram } = await import("../../packages/host/dist/front/handles.js");
  const { ast, getSourceFileQueries } = OpenedProgram.checked(program);
  const file = OpenedProgram.file(program, module).file;
  const [, owner] = ast.children(file).filter(node => ast.kindName(node) === "KindInterfaceDeclaration");
  const members = ast.children(owner);
  const method = members.find(node => ast.kindName(node) === "KindMethodSignature");
  const { checker } = getSourceFileQueries(file);
  const [formal] = getSourceFileQueries(file).typeShape.getSignatureParameterInfos(checker.getSignatureFromDeclaration(method));
  const grouping = ast.as.AsArrayTypeNode(ast.typeNode(formal.declaration)).ElementType;
  const union = ast.as.AsParenthesizedTypeNode(grouping).Type;
  const [bare, reference] = ast.as.AsUnionTypeNode(union).Types.Nodes;
  const argument = ast.as.AsTypeReferenceNode(reference).TypeArguments.Nodes[0];
  const checkpoint = ast.typeNode(members.filter(node => ast.kindName(node) === "KindPropertySignature")[1]);
  const stop = new Error("original composed rest argument reader stop");
  const reads = [];
  const observed = OpenedProgram.create({ ...OpenedProgram.checked(program), getSourceFileQueries(sourceFile) {
    const queries = getSourceFileQueries(sourceFile);
    if (sourceFile !== file) return queries;
    return { ...queries, checker: { ...checker, getTypeFromTypeNode(node) {
      if (node === bare || node === argument || node === reference || node === checkpoint) reads.push(node);
      if (node === argument) throw stop;
      return checker.getTypeFromTypeNode(node);
    } } };
  } }, OpenedProgram.table(program), set.modules.map(entry =>
    OpenedProgram.file(program, entry.kind === "snapshot" ? entry.module : entry.document.module)),
  OpenedProgram.libraryData(program), OpenedProgram.contributions(program));
  assert.throws(() => fixture.front.captureModule(deps, observed, module), error => error === stop);
  assert.equal(reads.length === 2 && reads[0] === bare && reads[1] === argument, true);
});

for (const scenario of ["direct", "crossed", "stop"]) test("a composed receiver result retains its actual authored union: " + scenario, async () => {
  const fixture = await loadFrontFixture();
  const library = "lib.es2023.array.d.ts";
  const opposite = scenario === "crossed" ? "crossed(): Identity<T | undefined>;" : "";
  const snapshot = fixture.projectSnapshot({ sourceFiles: { "main.ts": `
    export interface Wrapped<V> {}
    export interface Box<T> { anchor: Box<T>; collect(...items: (Wrapped<T> | T)[]): boolean; }
    export interface Box<T> {}
  ` }, libraries: [
    { name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent.replace(" [n: number]: T;", "") },
    { name: library, text: `type Identity<X> = X; interface Array<T> { last(): T | undefined; ${opposite} }` },
  ] });
  const { deps, program, set } = fixture.openAndCapture(snapshot);
  const module = fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts");
  const libraryModule = fixture.moduleOf(fixture.packageOf("/checker"), library);
  const { OpenedProgram } = await import("../../packages/host/dist/front/handles.js");
  const file = OpenedProgram.file(program, module).file;
  const libraryFile = OpenedProgram.file(program, libraryModule).file;
  const checked = OpenedProgram.checked(program);
  const { ast } = checked;
  const { checker, typeShape } = checked.getSourceFileQueries(file);
  const [, box] = ast.children(file).filter(node => ast.kindName(node) === "KindInterfaceDeclaration");
  const [anchor, collect] = ast.children(box).filter(node => ["KindPropertySignature", "KindMethodSignature"].includes(ast.kindName(node)));
  const annotation = ast.typeNode(anchor);
  const receiver = checker.getTypeFromTypeNode(annotation).type;
  const [appliedCollect] = typeShape.getCallSignatures(propertyRows(typeShape, receiver).find(row => row.name === "collect").type);
  assert.equal(appliedCollect.target === checker.getSignatureFromDeclaration(collect), true);
  const [rest] = typeShape.getSignatureParameterInfos(appliedCollect);
  const [actualElement] = typeShape.getTypeReferenceArgumentInfos(rest.type);
  const [bare, reference] = typeShape.getUnionOrIntersectionTypes(actualElement.argument);
  const array = ast.children(libraryFile).find(node => ast.kindName(node) === "KindInterfaceDeclaration");
  const [method, counter] = ast.children(array).filter(node => ast.kindName(node) === "KindMethodSignature");
  const methodSignature = name => typeShape.getCallSignatures(propertyRows(typeShape, rest.type).find(row => row.name === name).type)[0];
  const selected = methodSignature("last");
  const original = checker.getSignatureFromDeclaration(method);
  const authored = ast.typeNode(method);
  const oldResult = checker.getReturnTypeOfSignature(original)?.type;
  const selectedResult = checker.getReturnTypeOfSignature(selected)?.type;
  const oldArms = typeShape.getUnionOrIntersectionTypes(oldResult);
  const selectedArms = typeShape.getUnionOrIntersectionTypes(selectedResult);
  const [undefinedType] = oldArms.filter(type => typeShape.intrinsicNullishFlags(type).undefined);
  const [originalBinder] = oldArms.filter(type => type !== undefinedType);
  assert.equal(selected.target === original && selected.mapper !== undefined, true);
  assert.equal(checker.getTypeFromTypeNode(authored).type === oldResult, true);
  assert.equal(oldArms.length === 2 && selectedArms.length === 3 && bare !== originalBinder, true);
  assert.equal(selectedArms.includes(undefinedType) && selectedArms.includes(bare) && selectedArms.includes(reference), true);
  const stop = new Error("original composed receiver result reader stop");
  if (scenario !== "direct") {
    const oppositeSelected = scenario === "crossed" ? methodSignature("crossed") : undefined;
    const oppositeOriginal = counter === undefined ? undefined : checker.getSignatureFromDeclaration(counter);
    const oppositeSyntax = counter === undefined ? undefined : ast.typeNode(counter);
    if (scenario === "crossed") {
      assert.equal(oppositeSelected.target === oppositeOriginal && oppositeOriginal !== original, true);
      assert.equal(checker.getTypeFromTypeNode(oppositeSyntax).type === oldResult, true);
      assert.equal(checker.getReturnTypeOfSignature(oppositeSelected)?.type === selectedResult, true);
    }
    const reads = [];
    const observed = OpenedProgram.create({ ...checked, getSourceFileQueries(sourceFile) {
      const queries = checked.getSourceFileQueries(sourceFile);
      if (sourceFile !== file) return queries;
      return { ...queries, checker: { ...checker, getReturnTypeOfSignature(signature) {
        if (signature === selected || signature === original || signature === oppositeSelected || signature === oppositeOriginal) reads.push(signature);
        if (scenario === "stop" && signature === original) throw stop;
        return checker.getReturnTypeOfSignature(signature);
      }, getTypeFromTypeNode(node) {
        if (node === authored || node === oppositeSyntax) reads.push(node);
        return checker.getTypeFromTypeNode(node);
      } }, typeShape: { ...typeShape, getUnionOrIntersectionTypes(type) {
        if (type === selectedResult) reads.push(type);
        return typeShape.getUnionOrIntersectionTypes(type);
      } } };
    } }, OpenedProgram.table(program), set.modules.map(entry =>
      OpenedProgram.file(program, entry.kind === "snapshot" ? entry.module : entry.document.module)),
    OpenedProgram.libraryData(program), OpenedProgram.contributions(program));
    const run = () => fixture.front.captureModule(deps, observed, module);
    if (scenario === "stop") {
      assert.throws(run, error => error === stop);
      assert.equal(reads.length === 2 && reads[0] === selected && reads[1] === original, true);
    } else {
      assert.throws(run, /a merged type parameter requires its actual selected declaration association/u);
      assert.equal(reads.length === 2 && reads[0] === oppositeSelected && reads[1] === selectedResult, true);
    }
    return;
  }
  const captured = fixture.front.captureModule(deps, program, module);
  assert.equal(captured.kind, "ok");
  const raw = captured.value;
  const numbered = OpenedProgram.syntax(program).get("/project/src/main.ts").outcome.numbering;
  const libNumbered = OpenedProgram.syntax(program).get("/checker/" + library).outcome.numbering;
  function member(rawType, name) {
    const storage = raw.types.members[rawType.form.value.inventory].members.find(row => row.name === name);
    const callable = raw.types.types[storage.read.value];
    return raw.types.signatures[raw.types.members[callable.form.value.inventory].calls[0]];
  }
  const root = raw.types.types.find(row => row.authoredTypeNode?.node === numbered.ids.get(annotation));
  const rawSelected = member(raw.types.types[member(root, "collect").parameters[0].type], "last");
  const rawOriginal = raw.types.signatures[rawSelected.target];
  const restSyntax = ast.as.AsArrayTypeNode(ast.typeNode(rest.declaration)).ElementType;
  const restUnion = ast.as.AsParenthesizedTypeNode(restSyntax).Type;
  const [declared] = ast.as.AsUnionTypeNode(restUnion).Types.Nodes;
  const originalArgument = ast.as.AsTypeReferenceNode(declared).TypeArguments.Nodes[0];
  for (const [signature, arms, binder, definition] of [
    [rawOriginal, oldArms, originalBinder, { module: libraryModule, node: libNumbered.ids.get(ast.typeParameters(array)[0]) }],
    [rawSelected, selectedArms, bare, { module, node: numbered.ids.get(ast.typeParameters(box)[0]) }],
  ]) {
    const form = raw.types.types[signature.result.value].form.value;
    assert.equal(form.kind, "union");
    assert.equal(form.members.length, arms.length);
    for (const [index, arm] of arms.entries()) {
      const row = raw.types.types[form.members[index]];
      assert.deepEqual(rawComponentPath(raw.types.components, raw.types.components[row.component]), [
        { kind: "result", signature: signature.id }, { kind: "union-member", index },
      ]);
      if (arm === undefinedType) assert.deepEqual(row.form.value, { kind: "scalar", scalar: "undefined" });
      else if (arm === binder) assert.deepEqual(row.form.value.parameter, definition);
      else {
        assert.equal(arm === reference && row.form.value.kind === "declared", true);
        const [argument] = row.form.value.arguments;
        assert.deepEqual(argument.explicitTypeNode, { module, node: numbered.ids.get(originalArgument) });
        assert.deepEqual(raw.types.types[argument.argument.value].form.value.parameter, definition);
      }
    }
  }
});

test("a selected generic return captures tuple slots, not numeric-looking properties", async () => {
  const fixture = await loadFrontFixture();
  const snapshot = fixture.projectSnapshot({ sourceFiles: { "main.ts": `
    export interface Endpoint<V> {}
    export interface Box<T> { entries(): Endpoint<[number, T]>; left: Box<T>; }
    export interface Box<T> { right: Box<T>; }
    export interface Holder<U> {}
    export interface Holder<U> { chosen: Box<U>; }
    export type Pair = [number, boolean];
    export type ReadonlyPair = readonly [number, boolean];
    export type Lookalike = { "0": number; "1": boolean; length: number };
    export type Nested = [[number, boolean], [number, boolean]];
  ` }, libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] });
  const { captured, deps, interner, opened } = fixture.captureModulesOf(snapshot);
  const module = fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts");
  const { raw, definitions, text: source } = captured.find(entry => entry.module === module);
  const { OpenedProgram } = await import("../../packages/host/dist/front/handles.js");
  const { ast, getSourceFileQueries } = OpenedProgram.checked(opened.program);
  const { checker, typeShape } = getSourceFileQueries(OpenedProgram.file(opened.program, module).file);
  const numbered = OpenedProgram.syntax(opened.program).get("/project/src/main.ts").outcome.numbering;
  const [, left, right, , holder, pair, readonly, lookalike, nested] = raw.tree.statements.nodes;
  const method = numbered.nodes[left.members.nodes[0].id];
  const original = checker.getSignatureFromDeclaration(method);
  const syntax = ast.as.AsTypeReferenceNode(ast.typeNode(method)).TypeArguments.Nodes[0];
  const authored = ast.as.AsTupleTypeNode(syntax).Elements.Nodes;
  const [originalArgument] = typeShape.getTypeReferenceArgumentInfos(checker.getReturnTypeOfSignature(original)?.type);
  const originalTuple = checker.getTypeFromTypeNode(syntax).type;
  assert.equal(originalTuple === originalArgument.argument && typeShape.isTuple(originalTuple), true);
  const oldSlots = typeShape.getTupleInfo(originalTuple).elements;
  for (const [index, slot] of oldSlots.entries()) {
    assert.equal(slot.type === checker.getTypeFromTypeNode(authored[index]).type, true);
    assert.equal(slot.declaration, undefined);
  }

  const { createTypeConversion, convertRawType } = await import("../../packages/host/dist/front/type-conversion.js");
  const conversion = createTypeConversion(deps, raw);
  const inventory = row => raw.types.members[row.form.value.inventory];
  const authoredRow = node => raw.types.types.find(row => row.authoredTypeNode?.module === module && row.authoredTypeNode.node === node);
  function verifyTuple(signature, owner) {
    const result = raw.types.types[signature.result.value];
    const [argument] = result.form.value.arguments;
    assert.deepEqual(argument.explicitTypeNode, { module, node: numbered.ids.get(syntax) });
    const tuple = raw.types.types[argument.argument.value];
    assert.equal(tuple.authoredTypeNode, null);
    assert.equal(tuple.form.value.kind, "tuple");
    assert.equal(tuple.form.value.readonly, false);
    assert.equal(tuple.form.value.elements.length, 2);
    const slots = tuple.form.value.elements.map((slot, index) => {
      assert.equal(slot.kind, "required");
      assert.equal(slot.declaration, null);
      const row = raw.types.types[slot.type];
      assert.equal(row.component, slot.component);
      assert.deepEqual(rawComponentPath(raw.types.components, raw.types.components[row.component]), [
        { kind: "result", signature: signature.id }, { kind: "argument-place", index: 0 }, { kind: "tuple-element", index },
      ]);
      return row.form.value;
    });
    const parameter = { module, node: owner.typeParameters.nodes[0].id };
    assert.deepEqual(slots, [{ kind: "scalar", scalar: "number" }, { kind: "parameter", parameter, constraint: null, default: null }]);
    const converted = convertRawType(conversion, result.id);
    assert.equal(converted.kind, "complete");
    const { terms } = fixture.types.viewTypes(interner);
    const term = terms[terms[converted.value.type].arguments[0]];
    assert.equal(term.kind, "tuple");
    assert.equal(term.readonly, false);
    assert.deepEqual(term.elements.map(slot => [slot.kind, slot.declaration, terms[slot.type]]), [
      ["required", null, { kind: "primitive", primitive: "float64" }],
      ["required", null, { kind: "param", parameter: deps.definitionOf(parameter) }],
    ]);
    return tuple;
  }
  const signatures = [];
  const selectedTuples = [];
  for (const [owner, name] of [[left, "left"], [right, "right"], [holder, "chosen"]]) {
    const member = owner.members.nodes.find(row => row.name.text === name);
    const annotation = ast.typeNode(numbered.nodes[member.id]);
    const receiver = checker.getTypeFromTypeNode(annotation).type;
    const [binding] = typeShape.getTypeReferenceArgumentInfos(receiver);
    const [signature] = typeShape.getCallSignatures(propertyRows(typeShape, receiver).find(row => row.name === "entries").type);
    const [argument] = typeShape.getTypeReferenceArgumentInfos(checker.getReturnTypeOfSignature(signature)?.type);
    const slots = typeShape.getTupleInfo(argument.argument).elements;
    assert.equal(signature.target === original && signature.mapper !== undefined, true);
    assert.equal(typeShape.getTypeReferenceTarget(argument.argument) === typeShape.getTypeReferenceTarget(originalTuple), true);
    assert.equal(slots[0].type === oldSlots[0].type && slots[1].type === binding.argument, true);
    assert.equal(argument.argument === originalTuple, owner !== holder);
    signatures.push(signature);
    const read = inventory(authoredRow(numbered.ids.get(annotation))).members.find(row => row.name === "entries").read.value;
    const applied = raw.types.signatures[inventory(raw.types.types[read]).calls[0]];
    verifyTuple(raw.types.signatures[applied.target], left);
    selectedTuples.push(verifyTuple(applied, owner));
  }
  assert.equal(signatures[0] === signatures[1], true);
  const pairType = checker.getTypeFromTypeNode(numbered.nodes[pair.type.id]).type;
  const readonlyType = checker.getTypeFromTypeNode(numbered.nodes[readonly.type.id]).type;
  const objectType = checker.getTypeFromTypeNode(numbered.nodes[lookalike.type.id]).type;
  assert.equal(typeShape.getTypeReferenceTarget(readonlyType) !== typeShape.getTypeReferenceTarget(pairType), true);
  assert.equal(typeShape.isTuple(objectType), false);
  const objectFields = propertyRows(typeShape, objectType);
  for (const [index, slot] of typeShape.getTupleInfo(pairType).elements.entries())
    assert.equal(objectFields.find(field => field.name === String(index)).type === slot.type, true);
  assert.equal(authoredRow(pair.type.id).form.value.kind, "tuple");
  assert.equal(authoredRow(pair.type.id).form.value.readonly, false);
  assert.equal(authoredRow(readonly.type.id).form.value.readonly, true);
  assert.equal(authoredRow(lookalike.type.id).form.value.kind, "structure");
  const object = convertRawType(conversion, authoredRow(lookalike.type.id).id);
  assert.equal(object.kind, "complete");
  assert.equal(fixture.types.viewTypes(interner).terms[object.value.type].kind, "shape");

  const tuple = authoredRow(pair.type.id);
  const [first, second] = tuple.form.value.elements;
  const arenaSizes = () => {
    const { terms, signatures } = fixture.types.viewTypes(interner);
    return [terms.length, signatures.length];
  };
  const before = arenaSizes();
  const foreign = authoredRow(readonly.type.id);
  const [nestedLeft, nestedRight] = authoredRow(nested.type.id).form.value.elements.map(slot => raw.types.types[slot.type]);
  const originalComponent = raw.types.components[nestedLeft.component];
  const appliedComponent = raw.types.components[nestedRight.component];
  assert.deepEqual(originalComponent.root, appliedComponent.root);
  assert.notDeepEqual(originalComponent.path, appliedComponent.path);
  assert.notDeepEqual(raw.types.components[foreign.component].root, raw.types.components[tuple.component].root);
  for (const [owner, elements, error] of [
    [tuple, [undefined, second], /actual required or optional unlabelled slots/u],
    [tuple, [{ ...first, kind: "optional" }, second], /actual required or optional unlabelled slots/u],
    [tuple, [{ ...first, acceptsOmission: true }, second], /actual required or optional unlabelled slots/u],
    [tuple, [{ ...first, type: second.type }, second], /actual type component/u],
    [tuple, [second, first], /actual type component/u],
    [tuple, foreign.form.value.elements, /actual type component/u],
    [nestedRight, nestedLeft.form.value.elements, /actual type component/u],
  ]) {
    const rows = [...raw.types.types];
    rows[owner.id] = { ...owner, form: { kind: "available", value: { ...owner.form.value, elements } } };
    const corrupted = createTypeConversion(deps, { ...raw, types: { ...raw.types, types: rows } });
    assert.throws(() => convertRawType(corrupted, owner.id), error);
    assert.deepEqual(arenaSizes(), before);
    assert.equal(corrupted.convertedTypes.size, 0);
    assert.equal(corrupted.convertedSignatures.size, 0);
  }
  const displaced = [...raw.types.components];
  const firstPosition = displaced[first.component];
  displaced[first.component] = { ...firstPosition,
    path: { ...firstPosition.path, step: { kind: "tuple-element", index: -0 } } };
  const noncanonical = createTypeConversion(deps, { ...raw, types: { ...raw.types, components: displaced } });
  assert.throws(() => convertRawType(noncanonical, tuple.id), /actual type component/u);
  assert.deepEqual(arenaSizes(), before);
  const crossed = [...raw.types.components];
  crossed[nestedRight.component] = { ...appliedComponent, id: originalComponent.id };
  const crossedTypes = [...raw.types.types];
  crossedTypes[nestedRight.id] = { ...nestedRight, form: { kind: "available",
    value: { ...nestedRight.form.value, elements: nestedLeft.form.value.elements } } };
  const crossedConversion = createTypeConversion(deps, { ...raw,
    types: { ...raw.types, components: crossed, types: crossedTypes } });
  assert.throws(() => convertRawType(crossedConversion, nestedRight.id), /actual captured type and component/u);
  assert.deepEqual(arenaSizes(), before);
  assert.equal(crossedConversion.convertedTypes.size + crossedConversion.convertedSignatures.size, 0);
  const clonedComponents = createTypeConversion(deps, { ...raw,
    types: { ...raw.types, components: raw.types.components.map(component => structuredClone(component)) } });
  assert.equal(convertRawType(clonedComponents, selectedTuples[0].id).kind, "complete");

  const [firstNested] = nestedLeft.form.value.elements;
  const originalPosition = raw.types.components[firstNested.component];
  let slotReads = 0;
  let prefixReads = 0;
  const path = { ...originalPosition.path, get prefix() { prefixReads += 1; return originalPosition.path.prefix; } };
  const components = [...raw.types.components];
  components[firstNested.component] = { ...originalPosition, path };
  const slots = [...nestedLeft.form.value.elements];
  slots[0] = { ...firstNested, get type() { slotReads += 1; return firstNested.type; } };
  const rows = [...raw.types.types];
  rows[nestedLeft.id] = { ...nestedLeft, form: { kind: "available", value: { ...nestedLeft.form.value, elements: slots } } };
  const subject = { ...raw, types: { ...raw.types, types: rows, components } };
  const baseline = arenaSizes();
  for (const [maximumWork, observed] of [[0, [0, 0]], [1, [1, 0]], [2, [1, 1]]]) {
    slotReads = 0;
    prefixReads = 0;
    const limited = createTypeConversion({ ...deps, typeWork: fixture.lowerDepsFor(definitions, interner, source, { maximumWork }).typeWork }, subject);
    const stop = convertRawType(limited, nestedLeft.id);
    assert.deepEqual(stop, { kind: "resource-limit", dimension: "work", maximum: maximumWork });
    assert.deepEqual([slotReads, prefixReads], observed);
    assert.equal(convertRawType(limited, nestedLeft.id), stop);
    assert.deepEqual([slotReads, prefixReads], observed);
    assert.deepEqual(arenaSizes(), baseline);
    assert.equal(limited.convertedTypes.size + limited.convertedSignatures.size, 0);
  }
});

for (const wrapped of [false, true]) test(wrapped ? "a same-pointer alias cannot authorize a projected tuple binder" :
  "tuple slot admissions stop before the original authored slot reader", async () => {
  const fixture = await loadFrontFixture();
  const snapshot = fixture.projectSnapshot({ sourceFiles: { "main.ts": `
    export interface Endpoint<V> {}
    export interface Box<T> {
      exact: Box<T>; checkpoint: boolean;
      entries(): Endpoint<[number, ${wrapped ? "Identity<T>" : "T"}, boolean]>;
    }
    export interface Box<T> {}
    type Identity<V> = V;
  ` }, libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] });
  const { deps, program, set } = fixture.openAndCapture(snapshot);
  const module = fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts");
  const { OpenedProgram } = await import("../../packages/host/dist/front/handles.js");
  const file = OpenedProgram.file(program, module).file;
  const checked = OpenedProgram.checked(program);
  const { ast } = checked;
  const { checker, typeShape } = checked.getSourceFileQueries(file);
  const owner = ast.children(file).filter(node => ast.kindName(node) === "KindInterfaceDeclaration")[1];
  const members = ast.children(owner);
  const [exact, checkpoint] = members.filter(node => ast.kindName(node) === "KindPropertySignature").map(node => ast.typeNode(node));
  const method = members.find(node => ast.kindName(node) === "KindMethodSignature");
  const syntax = ast.as.AsTypeReferenceNode(ast.typeNode(method)).TypeArguments.Nodes[0];
  const [first, binder, later] = ast.as.AsTupleTypeNode(syntax).Elements.Nodes;
  const receiver = checker.getTypeFromTypeNode(exact).type;
  const [receiverBinding] = typeShape.getTypeReferenceArgumentInfos(receiver);
  const [selected] = typeShape.getCallSignatures(propertyRows(typeShape, receiver).find(row => row.name === "entries").type);
  const original = checker.getSignatureFromDeclaration(method);
  const returned = checker.getReturnTypeOfSignature(selected)?.type;
  assert.equal(selected.target === original && returned === checker.getReturnTypeOfSignature(original)?.type, true);
  const tuple = typeShape.getTypeReferenceArgumentInfos(returned)[0].argument;
  assert.equal(checker.getTypeFromTypeNode(syntax).type === tuple, true);
  assert.equal(typeShape.getTupleInfo(tuple).elements[1].type === receiverBinding.parameter, true);
  assert.equal(checker.getTypeFromTypeNode(binder).type === receiverBinding.parameter, true);
  const stop = new Error("original tuple slot reader stop");
  let tupleReads = 0;
  let propertyReads = 0;
  const read = [];
  const observed = OpenedProgram.create({ ...checked, getSourceFileQueries(sourceFile) {
    const queries = checked.getSourceFileQueries(sourceFile);
    if (sourceFile !== file) return queries;
    return { ...queries, typeShape: { ...typeShape, getTupleInfo(type) {
      if (type === tuple) tupleReads += 1;
      return typeShape.getTupleInfo(type);
    }, getStructuredInventory(type, admit) {
      if (type === tuple) propertyReads += 1;
      return typeShape.getStructuredInventory(type, admit);
    } }, checker: { ...checker, getTypeFromTypeNode(node) {
      if (node === first || node === binder || node === later || node === checkpoint) read.push(node);
      if (node === binder && !wrapped) throw stop;
      return checker.getTypeFromTypeNode(node);
    } } };
  } }, OpenedProgram.table(program), set.modules.map(entry =>
    OpenedProgram.file(program, entry.kind === "snapshot" ? entry.module : entry.document.module)),
  OpenedProgram.libraryData(program), OpenedProgram.contributions(program));
  const run = (limit, maximum) => fixture.front.captureModule(limit === undefined ? deps
    : { ...deps, navigationCapture: { ...deps.navigationCapture, [limit]: maximum } }, observed, module);
  if (wrapped) {
    assert.throws(() => run(), /projected tuple slot requires its actual authored binder/u);
    assert.equal(tupleReads, 1);
    assert.equal(propertyReads, 0);
    assert.equal(read.length === 2 && read[0] === first && read[1] === binder, true);
    return;
  }
  for (const [limit, maximum] of [["maximumCapturedFactsPerModule", 48], ["maximumCapturedEdgesPerModule", 58]]) {
    primeCaptureReader(cap => run(limit, cap), deps.navigationCapture[limit], stop);
    tupleReads = 0;
    propertyReads = 0;
    read.length = 0;
    const refused = run(limit, maximum - 1);
    assert.equal(refused.kind, "refused");
    assert.equal(refused.diagnostics.at(-1).code.name, "TSONIC_COMPILER_RESOURCE_LIMIT");
    assert.deepEqual(refused.diagnostics.at(-1).arguments, [
      { kind: "text", value: "front." + limit }, { kind: "number", value: maximum - 1 },
    ]);
    assert.equal(tupleReads, 1);
    assert.equal(propertyReads, 0);
    assert.equal(read.length === 1 && read[0] === first, true);
    tupleReads = 0;
    propertyReads = 0;
    read.length = 0;
    assert.throws(() => run(limit, maximum), error => error === stop);
    assert.equal(tupleReads, 1);
    assert.equal(propertyReads, 0);
    assert.equal(read.length === 2 && read[0] === first && read[1] === binder, true);
  }
});

test("checked declarations retain mutable and readonly authored tuples", async () => {
  const fixture = await loadFrontFixture();
  const actual = fixture.checkedModuleOf("export type Pair = [number, boolean]; export type ReadonlyPair = readonly [number, boolean];");
  assert.deepEqual(fixture.verifyChecked(actual.checked, actual.interner), []);
  const [plain, frozen] = actual.checked.tree.statements.nodes;
  assert.equal(plain.type.kind, "TupleType");
  assert.equal(frozen.type.kind, "TypeOperator");
  assert.equal(frozen.type.operator, "ReadonlyKeyword");
  assert.equal(frozen.type.type.kind, "TupleType");
  for (const [annotation, isReadonly] of [[plain.type, false], [frozen.type, true]]) {
    const tuple = fixture.types.readType(actual.interner, annotation.tsonic.type.value);
    assert.equal(tuple.kind, "tuple");
    assert.equal(tuple.readonly, isReadonly);
    assert.deepEqual(tuple.elements.map(slot => fixture.types.readType(actual.interner, slot.type)), [
      { kind: "primitive", primitive: "float64" }, { kind: "primitive", primitive: "bool" },
    ]);
  }
});

test("a natively flattened tuple cannot stand in for the authored slot vector", async () => {
  const fixture = await loadFrontFixture();
  const snapshot = fixture.projectSnapshot({ sourceFiles: { "main.ts": "export type Flattened = [number, ...[boolean, string]];" },
    libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] });
  const { deps, program } = fixture.openAndCapture(snapshot);
  const module = fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts");
  const { OpenedProgram } = await import("../../packages/host/dist/front/handles.js");
  const checked = OpenedProgram.checked(program);
  const file = OpenedProgram.file(program, module).file;
  const { ast } = checked;
  const { checker, typeShape } = checked.getSourceFileQueries(file);
  const declaration = ast.children(file).find(node => ast.kindName(node) === "KindTypeAliasDeclaration");
  const syntax = ast.typeNode(declaration);
  const tuple = checker.getTypeFromTypeNode(syntax).type;
  assert.equal(typeShape.isTuple(tuple), true);
  assert.equal(ast.as.AsTupleTypeNode(syntax).Elements.Nodes.length, 2);
  assert.equal(typeShape.getTupleInfo(tuple).elements.length, 3);
  assert.throws(() => fixture.front.captureModule(deps, program, module), /actual unflattened authored slots/u);
});

for (const forged of [false, true]) test(forged ? "an alias result cannot borrow the same native declared result" :
  "a declared result stops at the exact original signature reader", async () => {
  const fixture = await loadFrontFixture();
  const syntax = forged ? "Alias<T>" : "Endpoint<T>";
  const snapshot = fixture.projectSnapshot({ sourceFiles: { "main.ts": `
    export interface Endpoint<V> {}
    export interface Box<T> { exact: Box<T>; checkpoint: boolean; values(): ${syntax}; }
    export interface Box<T> {}
    type Alias<V> = Endpoint<V>;
  ` }, libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] });
  const { deps, program, set } = fixture.openAndCapture(snapshot);
  const module = fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts");
  const { OpenedProgram } = await import("../../packages/host/dist/front/handles.js");
  const file = OpenedProgram.file(program, module).file;
  const checked = OpenedProgram.checked(program);
  const { ast } = checked;
  const { checker, typeShape } = checked.getSourceFileQueries(file);
  const owner = ast.children(file).filter(node => ast.kindName(node) === "KindInterfaceDeclaration")[1];
  const members = ast.children(owner);
  const [exact, checkpoint] = members.filter(node => ast.kindName(node) === "KindPropertySignature").map(node => ast.typeNode(node));
  const method = members.find(node => ast.kindName(node) === "KindMethodSignature");
  const result = ast.typeNode(method);
  const authored = ast.as.AsTypeReferenceNode(result);
  const receiver = checker.getTypeFromTypeNode(exact).type;
  const [selected] = typeShape.getCallSignatures(propertyRows(typeShape, receiver).find(row => row.name === "values").type);
  const original = checker.getSignatureFromDeclaration(method);
  const returned = checker.getReturnTypeOfSignature(selected)?.type;
  assert.equal(selected.target === original && returned === checker.getReturnTypeOfSignature(original)?.type, true);
  assert.equal(returned === checker.getTypeFromTypeNode(result).type, true);
  const [argument] = typeShape.getTypeReferenceArgumentInfos(returned);
  assert.equal(argument.argument === checker.getTypeFromTypeNode(authored.TypeArguments.Nodes[0]).type, true);
  assert.equal(checker.getSymbolAtLocation(authored.TypeName) === checker.getTypeSymbol(typeShape.getTypeReferenceTarget(returned)), !forged);
  const stop = new Error("original declared result reader stop");
  let originalReads = 0;
  let selectedReads = 0;
  let readAfter = false;
  const observed = OpenedProgram.create({ ...checked, getSourceFileQueries(sourceFile) {
    const queries = checked.getSourceFileQueries(sourceFile);
    if (sourceFile !== file) return queries;
    return { ...queries, checker: { ...checker, getReturnTypeOfSignature(signature) {
      if (signature === selected) selectedReads += 1;
      if (signature === original) {
        originalReads += 1;
        throw stop;
      }
      return checker.getReturnTypeOfSignature(signature);
    }, getTypeFromTypeNode(node) {
      if (node === result || node === authored.TypeArguments.Nodes[0] || node === checkpoint) readAfter = true;
      return checker.getTypeFromTypeNode(node);
    } } };
  } }, OpenedProgram.table(program), set.modules.map(entry =>
    OpenedProgram.file(program, entry.kind === "snapshot" ? entry.module : entry.document.module)),
  OpenedProgram.libraryData(program), OpenedProgram.contributions(program));
  if (forged) {
    assert.throws(() => fixture.front.captureModule(deps, observed, module),
      /a merged type parameter requires its actual selected declaration association/u);
    assert.equal(selectedReads, 1);
    assert.equal(originalReads, 0);
    assert.equal(readAfter, false);
    return;
  }
  for (const [limit, exact] of [["maximumCapturedFactsPerModule", 44], ["maximumCapturedEdgesPerModule", 48]]) {
    const run = maximum => fixture.front.captureModule({ ...deps, navigationCapture: { ...deps.navigationCapture, [limit]: maximum } },
      observed, module);
    primeCaptureReader(run, deps.navigationCapture[limit], stop);
    originalReads = 0;
    selectedReads = 0;
    const refused = run(exact - 1);
    assert.equal(refused.kind, "refused");
    assert.equal(refused.diagnostics.at(-1).code.name, "TSONIC_COMPILER_RESOURCE_LIMIT");
    assert.deepEqual(refused.diagnostics.at(-1).arguments, [
      { kind: "text", value: "front." + limit }, { kind: "number", value: exact - 1 },
    ]);
    assert.equal(originalReads, 0);
    assert.equal(readAfter, false);
    selectedReads = 0;
    assert.throws(() => run(exact), error => error === stop);
    assert.equal(selectedReads, 1);
    assert.equal(originalReads, 1);
    assert.equal(readAfter, false);
  }
});

test("an alias-wrapped result cannot borrow a matching inner union by native pointer", async () => {
  const fixture = await loadFrontFixture();
  const snapshot = fixture.projectSnapshot({ sourceFiles: { "main.ts": `
    export type Identity<X> = X;
    export interface Box<T> { exact: Box<T>; at(index: number): Identity<T | undefined>; }
    export interface Box<T> {}
  ` }, libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] });
  const { deps, program, set } = fixture.openAndCapture(snapshot);
  const module = fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts");
  const { OpenedProgram } = await import("../../packages/host/dist/front/handles.js");
  const file = OpenedProgram.file(program, module).file;
  const checked = OpenedProgram.checked(program);
  const { ast } = checked;
  const { checker, typeShape } = checked.getSourceFileQueries(file);
  const owner = ast.children(file).find(node => ast.kindName(node) === "KindInterfaceDeclaration");
  const members = ast.children(owner);
  const declaration = members.find(node => ast.kindName(node) === "KindMethodSignature");
  const receiver = checker.getTypeFromTypeNode(ast.typeNode(members.find(node => ast.kindName(node) === "KindPropertySignature"))).type;
  const [selected] = typeShape.getCallSignatures(propertyRows(typeShape, receiver).find(row => row.name === "at").type);
  const syntax = ast.typeNode(declaration);
  const inner = ast.as.AsTypeReferenceNode(syntax).TypeArguments.Nodes[0];
  const old = checker.getTypeFromTypeNode(inner).type;
  assert.equal(ast.kindName(inner), "KindUnionType");
  assert.equal(checker.getTypeFromTypeNode(syntax).type === old, true);
  const original = checker.getSignatureFromDeclaration(declaration);
  assert.equal(selected.target === original, true);
  assert.equal(checker.getReturnTypeOfSignature(selected)?.type === old, true);
  let selectedReads = 0;
  let originalReads = 0;
  const observed = OpenedProgram.create({ ...checked, getSourceFileQueries(sourceFile) {
    const queries = checked.getSourceFileQueries(sourceFile);
    if (sourceFile !== file) return queries;
    return { ...queries, checker: { ...checker, getReturnTypeOfSignature(signature) {
      if (signature === selected) selectedReads += 1;
      if (signature === original) originalReads += 1;
      return checker.getReturnTypeOfSignature(signature);
    } } };
  } }, OpenedProgram.table(program), set.modules.map(entry =>
    OpenedProgram.file(program, entry.kind === "snapshot" ? entry.module : entry.document.module)),
  OpenedProgram.libraryData(program), OpenedProgram.contributions(program));
  assert.throws(() => fixture.front.captureModule(deps, observed, module), /a merged type parameter requires its actual selected declaration association/);
  assert.equal(selectedReads, 1);
  assert.equal(originalReads, 0);
});

test("the exact union result limits preserve the original signature reader stop", async () => {
  const fixture = await loadFrontFixture();
  const snapshot = fixture.projectSnapshot({ sourceFiles: { "main.ts": `
    export interface Box<T> { exact: Box<T>; checkpoint: boolean; at(index: number): T | undefined; }
    export interface Box<T> {}
  ` }, libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] });
  const { deps, program, set } = fixture.openAndCapture(snapshot);
  const module = fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts");
  const { OpenedProgram } = await import("../../packages/host/dist/front/handles.js");
  const file = OpenedProgram.file(program, module).file;
  const checked = OpenedProgram.checked(program);
  const { ast } = checked;
  const { checker, typeShape } = checked.getSourceFileQueries(file);
  const owner = ast.children(file).find(node => ast.kindName(node) === "KindInterfaceDeclaration");
  const members = ast.children(owner);
  const [exact, checkpoint] = members.filter(node => ast.kindName(node) === "KindPropertySignature").map(node => ast.typeNode(node));
  const method = members.find(node => ast.kindName(node) === "KindMethodSignature");
  const syntax = ast.typeNode(method);
  const [parameter, absent] = ast.as.AsUnionTypeNode(syntax).Types.Nodes;
  const receiver = checker.getTypeFromTypeNode(exact).type;
  const [selected] = typeShape.getCallSignatures(propertyRows(typeShape, receiver).find(row => row.name === "at").type);
  const original = checker.getSignatureFromDeclaration(method);
  assert.equal(selected.target === original && checker.getReturnTypeOfSignature(selected)?.type === checker.getReturnTypeOfSignature(original)?.type, true);
  const stop = new Error("original union result reader stop");
  let reads = 0;
  let selectedReads = 0;
  let readAfter = false;
  const observed = OpenedProgram.create({ ...checked, getSourceFileQueries(sourceFile) {
    const queries = checked.getSourceFileQueries(sourceFile);
    if (sourceFile !== file) return queries;
    return { ...queries, checker: { ...checker, getReturnTypeOfSignature(signature) {
      if (signature === selected) selectedReads += 1;
      if (signature === original) {
        reads += 1;
        throw stop;
      }
      return checker.getReturnTypeOfSignature(signature);
    }, getTypeFromTypeNode(node) {
      if (node === syntax || node === parameter || node === absent || node === checkpoint) readAfter = true;
      return checker.getTypeFromTypeNode(node);
    } } };
  } }, OpenedProgram.table(program), set.modules.map(entry =>
    OpenedProgram.file(program, entry.kind === "snapshot" ? entry.module : entry.document.module)),
  OpenedProgram.libraryData(program), OpenedProgram.contributions(program));
  for (const [limit, maximum] of [["maximumCapturedFactsPerModule", 48], ["maximumCapturedEdgesPerModule", 49]]) {
    const run = cap => fixture.front.captureModule({ ...deps, navigationCapture: { ...deps.navigationCapture, [limit]: cap } }, observed, module);
    primeCaptureReader(run, deps.navigationCapture[limit], stop);
    reads = 0;
    selectedReads = 0;
    const refused = run(maximum - 1);
    assert.equal(refused.kind, "refused");
    assert.equal(refused.diagnostics.at(-1).code.name, "TSONIC_COMPILER_RESOURCE_LIMIT");
    assert.deepEqual(refused.diagnostics.at(-1).arguments, [
      { kind: "text", value: "front." + limit }, { kind: "number", value: maximum - 1 },
    ]);
    assert.equal(reads, 0);
    assert.equal(readAfter, false);
    selectedReads = 0;
    assert.throws(() => run(maximum), error => error === stop);
    assert.equal(reads, 1);
    assert.equal(selectedReads, 1);
    assert.equal(readAfter, false);
  }
});

test("a union arm cannot classify a mixed declaration inventory from its first native row", async () => {
  const fixture = await loadFrontFixture();
  const snapshot = fixture.projectSnapshot({ sourceFiles: { "main.ts": `
    export interface Box<T> { at(index: number): T | undefined; }
    export interface Box<T> {}
  ` }, libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] });
  const { deps, program, set } = fixture.openAndCapture(snapshot);
  const module = fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts");
  const { OpenedProgram } = await import("../../packages/host/dist/front/handles.js");
  const file = OpenedProgram.file(program, module).file;
  const checked = OpenedProgram.checked(program);
  const { ast } = checked;
  const { checker } = checked.getSourceFileQueries(file);
  const owner = ast.children(file).find(node => ast.kindName(node) === "KindInterfaceDeclaration");
  const method = ast.children(owner).find(node => ast.kindName(node) === "KindMethodSignature");
  const [parameter] = ast.as.AsUnionTypeNode(ast.typeNode(method)).Types.Nodes;
  const symbol = checker.getTypeSymbol(checker.getTypeFromTypeNode(parameter).type);
  const declarations = checker.getSymbolDeclarations(symbol);
  assert.equal(declarations.length, 2);
  assert.equal(ast.kindName(declarations[0]), "KindTypeParameter");
  assert.equal(ast.kindName(method), "KindMethodSignature");
  let checkedSecond = 0;
  let readArm = 0;
  const mixed = [declarations[0], method];
  Object.defineProperty(mixed, 1, { get() { checkedSecond += 1; return method; } });
  const observed = OpenedProgram.create({ ...checked, getSourceFileQueries(sourceFile) {
    const views = checked.getSourceFileQueries(sourceFile);
    if (sourceFile !== file) return views;
    return { ...views, checker: { ...checker, getSymbolDeclarations(candidate) {
      return candidate === symbol ? mixed : checker.getSymbolDeclarations(candidate);
    }, getTypeFromTypeNode(node) {
      if (node === parameter) readArm += 1;
      return checker.getTypeFromTypeNode(node);
    } } };
  } }, OpenedProgram.table(program), set.modules.map(entry =>
    OpenedProgram.file(program, entry.kind === "snapshot" ? entry.module : entry.document.module)),
  OpenedProgram.libraryData(program), OpenedProgram.contributions(program));
  assert.throws(() => fixture.front.captureModule(deps, observed, module), /a merged type parameter requires its actual selected declaration association/);
  assert.equal(checkedSecond, 1);
  assert.equal(readArm, 0);
});

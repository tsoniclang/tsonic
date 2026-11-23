import assert from "node:assert/strict";
import { test } from "node:test";
import { primeCaptureReader, propertyRows, loadFrontFixture } from "./fixtures/front/checked-module.mjs";

async function opened(source, includeArrayIndex = true, foreignSource) {
  const fixture = await loadFrontFixture();
  const library = includeArrayIndex ? fixture.sdk.barebonesLibContent
    : fixture.sdk.barebonesLibContent.replace("[n: number]: T;", "");
  const snapshot = fixture.projectSnapshot({
    sourceFiles: { "main.ts": "export const flag: boolean = true;" },
    libraries: [{ name: "lib.es5.d.ts", text: library + source },
      ...(foreignSource === undefined ? [] : [{ name: "lib.es2023.array.d.ts", text: foreignSource }])],
  });
  const { program, deps, set } = fixture.openAndCapture(snapshot);
  const module = fixture.moduleOf(fixture.packageOf("/checker"), "lib.es5.d.ts");
  return { fixture, program, deps, set, module };
}

async function capture(source, inspect) {
  const { fixture, program, deps, module } = await opened(source);
  if (inspect !== undefined) {
    const { OpenedProgram } = await import("../../packages/host/dist/front/handles.js");
    const checked = OpenedProgram.checked(program);
    const file = OpenedProgram.file(program, module).file;
    inspect(checked.ast, checked.getSourceFileQueries(file), file);
  }
  return fixture.front.captureModule(deps, program, module);
}

const receiver = "interface ReadonlyArray<T> { select(value: T): boolean; } interface ReadonlyArray<T> { flag: boolean; }";
const direct = "readonly (readonly [K,V])[]";
const bracketed = (result = "T[]", other = "") =>
  `interface Build { new<K,V>(first?: ${direct} | null, second?: null | ${direct}): boolean; }
   interface Array<T> { take(value: T): boolean; }
   interface ReadonlyArray<T> { produce(): ${result}; select(value: T): boolean; ${other} }
   interface ReadonlyArray<T> { flag: boolean; }`;

test("actual optional formal arms and separate equal native tuple occurrences preserve their own selected formals", async () => {
  const result = await capture(receiver +
    `interface Build { new<K,V>(first?: ${direct} | null, second?: null | ${direct}): boolean; }`, (ast, queries, file) => {
    const build = ast.statements(file).find(node => ast.kindName(node) === "KindInterfaceDeclaration" && ast.text(ast.name(node)) === "Build");
    const original = queries.checker.getSignatureFromDeclaration(ast.members(build)[0]);
    const [first, second] = queries.typeShape.getSignatureParameterInfos(original);
    assert.equal(first.type === second.type, true, "both actual formals share the same native optional union");
    assert.equal(ast.typeNode(first.declaration) !== ast.typeNode(second.declaration), true, "the written annotations are distinct");
  });
  assert.equal(result.kind, "ok");
  const raw = result.value;
  const build = raw.tree.statements.nodes.find(node => node.name?.text === "Build").members.nodes[0];
  const selectedMethod = raw.tree.statements.nodes.find(node => node.name?.text === "ReadonlyArray").members.nodes[0];
  const original = raw.types.signatures.find(signature => signature.target === null && signature.declaration?.node === build.id);
  const selected = raw.types.signatures.filter(signature => signature.target !== null && signature.owner.node === build.id &&
    signature.declaration?.node === selectedMethod.id);
  assert.equal(selected.length, 2, "the same native selected signature must not conflate the two authored receiver occurrences");
  assert.equal(selected[0].target, selected[1].target, "both instances use the actual same original method");
  const form = id => {
    const fact = raw.types.types[id].form;
    assert.equal(fact.kind, "available");
    return fact.value;
  };
  for (const formal of original.parameters) {
    assert.equal(formal.acceptsOmission, true);
    const union = form(formal.type);
    assert.equal(union.kind, "union");
    assert.deepEqual(union.members.map(form).filter(arm => arm.kind === "scalar").map(arm => arm.scalar).sort(), ["null", "undefined"]);
  }
  for (const method of selected) {
    const argument = method.parameters[0];
    const tuple = form(argument.type);
    assert.equal(tuple.kind, "tuple");
    assert.equal(tuple.readonly, true);
    assert.deepEqual(tuple.elements.map(element => form(element.type).parameter),
      build.typeParameters.nodes.map(node => ({ module: raw.module, node: node.id })));
  }
});

test("the actual optional arm reader stops before the next written source arm", async () => {
  const { fixture, program, deps, set, module } = await opened(receiver +
    `interface Build { new<K,V>(value?: ${direct} | null): boolean; }`);
  const { OpenedProgram } = await import("../../packages/host/dist/front/handles.js");
  const checked = OpenedProgram.checked(program);
  const file = OpenedProgram.file(program, module).file;
  const { ast } = checked;
  const build = ast.statements(file).find(node => ast.kindName(node) === "KindInterfaceDeclaration" && ast.text(ast.name(node)) === "Build");
  const signature = ast.members(build)[0];
  const annotation = ast.typeNode(ast.parameters(signature)[0]);
  const [array, absent] = ast.as.AsUnionTypeNode(annotation).Types.Nodes;
  const stop = new Error("actual original array-arm read stopped");
  let arrayReads = 0;
  let absenceReads = 0;
  const observed = OpenedProgram.create({ ...checked, getSourceFileQueries(sourceFile) {
    const queries = checked.getSourceFileQueries(sourceFile);
    if (sourceFile !== file) return queries;
    return { ...queries, checker: { ...queries.checker, getTypeFromTypeNode(node) {
      if (node === absent) absenceReads += 1;
      if (node === array) { arrayReads += 1; throw stop; }
      return queries.checker.getTypeFromTypeNode(node);
    } } };
  } }, OpenedProgram.table(program), set.modules.map(entry =>
    OpenedProgram.file(program, entry.kind === "snapshot" ? entry.module : entry.document.module)),
  OpenedProgram.libraryData(program), OpenedProgram.contributions(program));
  const captureAt = maximumCapturedEdgesPerModule => fixture.front.captureModule({ ...deps,
    navigationCapture: { ...deps.navigationCapture, maximumCapturedEdgesPerModule } }, observed, module);
  assert.equal(captureAt(0).kind, "refused");
  assert.equal(arrayReads, 0);
  assert.throws(() => captureAt(deps.navigationCapture.maximumCapturedEdgesPerModule), error => error === stop);
  assert.equal(arrayReads, 1);
  assert.equal(absenceReads, 0);
});

test("an aliased element or a collapsed written arm cannot borrow the direct tuple association", async () => {
  for (const [declarations, union] of [
    ["", `${direct} | null | null`],
    ["type Pair<A,B> = readonly [A,B];", "readonly Pair<K,V>[] | null"],
  ]) {
    await assert.rejects(capture(receiver + declarations + `interface Build { new<K,V>(value?: ${union}): boolean; }`),
      /a tuple requires its actual authored, projected or inferred destructuring association/u);
  }
});

test("each actual bracketed result transports its tuple occurrence to the different mutable receiver", async () => {
  const { fixture, program, deps, module } = await opened(bracketed(), false);
  const result = fixture.front.captureModule(deps, program, module);
  assert.equal(result.kind, "ok");
  const raw = result.value;
  const build = raw.tree.statements.nodes.find(node => node.name?.text === "Build").members.nodes[0];
  const produce = raw.tree.statements.nodes.find(node => node.name?.text === "ReadonlyArray").members.nodes[0];
  const take = raw.tree.statements.nodes.filter(node => node.name?.text === "Array")[1].members.nodes[0];
  const methods = raw.types.signatures.filter(row => row.target !== null && row.owner.node === build.id && row.declaration?.node === produce.id);
  assert.equal(methods.length, 2);
  assert.equal(methods[0].target, methods[1].target);
  const form = id => raw.types.types[id].form.value;
  const results = methods.map(method => {
    assert.equal(raw.types.types[method.result.value].authoredTypeNode, null, "the applied root is not authored");
    const resultTable = raw.types.members[form(method.result.value).inventory];
    const read = resultTable.members.find(row => row.declarations.some(reference => reference.node === take.id)).read.value;
    const [selected] = raw.types.members[form(read).inventory].calls;
    const tuple = form(raw.types.signatures[selected].parameters[0].type);
    assert.equal(tuple.kind, "tuple");
    assert.equal(tuple.readonly, true);
    assert.deepEqual(tuple.elements.map(element => form(element.type).parameter),
      build.typeParameters.nodes.map(node => ({ module, node: node.id })));
    return selected;
  });
  assert.notEqual(results[0], results[1], "equal native result types retain the two distinct actual sources");
});

test("a named result alias is not a directly written bracketed result", async () => {
  const { checker, typeShape, arrays, selected, produce, capture } =
    await resultProbe(bracketed("Alias<T>", "direct(): T[];") + "type Alias<V> = V[];");
  const alias = checker.getReturnTypeOfSignature(produce);
  const direct = checker.getReturnTypeOfSignature(selected(arrays[0], "direct"));
  assert.equal(typeShape.isTypeIdenticalTo(alias.type, direct.type), true);
  assert.equal(typeShape.getTypeReferenceTarget(alias.type) === typeShape.getTypeReferenceTarget(direct.type), true);
  assert.throws(() => capture({}),
    /a tuple requires its actual authored, projected or inferred destructuring association/u);
});

async function resultProbe(source, observedMethod = "produce", foreignSource) {
  const { fixture, program, deps, set, module } = await opened(source, false, foreignSource);
  const { OpenedProgram } = await import("../../packages/host/dist/front/handles.js");
  const checked = OpenedProgram.checked(program);
  const file = OpenedProgram.file(program, module).file;
  const { ast } = checked;
  const { checker, typeShape } = checked.getSourceFileQueries(file);
  const build = ast.statements(file).find(node => ast.kindName(node) === "KindInterfaceDeclaration" && ast.text(ast.name(node)) === "Build");
  const constructor = checker.getSignatureFromDeclaration(ast.members(build)[0]);
  const arrays = typeShape.getSignatureParameterInfos(constructor).map(row =>
    typeShape.getUnionOrIntersectionTypes(row.type).find(arm => !typeShape.isNullish(arm)));
  const selected = (receiver, name) => typeShape.getCallSignatures(propertyRows(typeShape, receiver).find(row => row.name === name).type)[0];
  const produce = selected(arrays[0], observedMethod);
  let observedProgram = program;
  const capture = (query, limits = deps.navigationCapture, shape = {}) => {
    observedProgram = OpenedProgram.create({ ...checked, getSourceFileQueries(sourceFile) {
      const queries = checked.getSourceFileQueries(sourceFile);
      return sourceFile === file ? { ...queries, checker: { ...queries.checker, ...query }, typeShape: { ...queries.typeShape, ...shape } } : queries;
    } }, OpenedProgram.table(program), set.modules.map(entry =>
      OpenedProgram.file(program, entry.kind === "snapshot" ? entry.module : entry.document.module)),
    OpenedProgram.libraryData(program), OpenedProgram.contributions(program));
    return fixture.front.captureModule({ ...deps, navigationCapture: limits }, observedProgram, module);
  };
  const reference = node => {
    const path = ast.getFileName(ast.getSourceFile(node));
    return { module: OpenedProgram.moduleAt(observedProgram, path), node: OpenedProgram.syntax(observedProgram).get(path).outcome.numbering.ids.get(node) };
  };
  return { ast, checker, typeShape, arrays, selected, produce, capture, reference, limits: deps.navigationCapture };
}

test("neither a crossed native result target nor a different actual tuple argument earns the result association", async () => {
  const source = bracketed("T[]", "crossed(): readonly T[];").replace("second?: null | " + direct, "second?: null | readonly (readonly [V,K])[]");
  const { checker, typeShape, arrays, selected, produce, capture } = await resultProbe(source);
  const actual = checker.getReturnTypeOfSignature(produce);
  const crossed = checker.getReturnTypeOfSignature(selected(arrays[0], "crossed"));
  const unrelated = checker.getReturnTypeOfSignature(selected(arrays[1], "produce"));
  const target = type => typeShape.getTypeReferenceTarget(type);
  const firstArgument = type => typeShape.getTypeReferenceArgumentInfos(type)[0].argument;
  assert.equal(target(actual.type) === target(crossed.type), false);
  assert.equal(firstArgument(actual.type) === firstArgument(crossed.type), true);
  assert.equal(target(actual.type) === target(unrelated.type), true);
  assert.equal(firstArgument(actual.type) === firstArgument(unrelated.type), false);
  for (const wrong of [crossed, unrelated]) {
    let read = 0;
    assert.throws(() => capture({ getReturnTypeOfSignature(signature) {
      if (signature === produce) { read += 1; return wrong; }
      return checker.getReturnTypeOfSignature(signature);
    } }), /a tuple requires its actual authored, projected or inferred destructuring association/u);
    assert.equal(read, 1);
  }
});

test("the exact bracketed result allowance bounds every cut before the actual original result reader", async () => {
  const { ast, checker, produce, capture, limits } = await resultProbe(bracketed());
  const original = produce.target;
  const syntax = ast.typeNode(checker.getSignatureDeclaration(original));
  const stop = new Error("actual original result reader stopped");
  const reads = [];
  const overrides = {
    getReturnTypeOfSignature(signature) {
      if (signature === produce) reads.push("selected");
      if (signature === original) { reads.push("original"); throw stop; }
      return checker.getReturnTypeOfSignature(signature);
    },
    getTypeFromTypeNode(node) {
      if (node === syntax) reads.push("written");
      return checker.getTypeFromTypeNode(node);
    },
  };
  for (const [dimension, exact] of [["maximumCapturedFactsPerModule", 149], ["maximumCapturedEdgesPerModule", 133]]) {
    const run = cap => capture(overrides, { ...limits, [dimension]: cap });
    primeCaptureReader(run, limits[dimension], stop);
    for (let cap = 0; cap < exact; cap += 1) {
      reads.length = 0;
      const result = run(cap);
      assert.equal(result.kind, "refused", `${dimension} ${cap}`);
      assert.equal(result.diagnostics.at(-1).code.name, "TSONIC_COMPILER_RESOURCE_LIMIT");
      assert.equal(reads.includes("original") || reads.includes("written"), false, `${dimension} ${cap}`);
    }
    reads.length = 0;
    assert.throws(() => run(exact), error => error === stop, `${dimension} ${exact}`);
    assert.deepEqual(reads, ["selected", "original"]);
  }
});

function withComparator(signature) {
  return bracketed().replace("take(value: T): boolean;", `sort(compare?: ${signature}): boolean;`);
}

function tupleReceiverMemberResults(raw) {
  const build = raw.tree.statements.nodes.find(node => node.name?.text === "Build").members.nodes[0];
  const produce = raw.tree.statements.nodes.find(node => node.name?.text === "ReadonlyArray").members.nodes[0];
  const member = raw.tree.statements.nodes.filter(node => node.name?.text === "Array")[1].members.nodes[0];
  const results = raw.types.signatures.filter(row => row.target !== null && row.owner.node === build.id && row.declaration?.node === produce.id);
  assert.equal(results.length, 2);
  const form = id => raw.types.types[id].form.value;
  const signatures = results.map(method => {
    const resultTable = raw.types.members[form(method.result.value).inventory];
    const read = resultTable.members.find(row => row.declarations.some(reference => reference.node === member.id)).read.value;
    const [selected] = raw.types.members[form(read).inventory].calls;
    return raw.types.signatures[selected];
  });
  return { member, signatures };
}

function comparatorResults(raw) {
  const { member, signatures } = tupleReceiverMemberResults(raw);
  const form = id => raw.types.types[id].form.value;
  return signatures.map(method => {
    const compare = form(method.parameters[0].type);
    const callable = compare.members.map(form).find(arm => arm.kind === "structure");
    const [callback] = raw.types.members[callable.inventory].calls;
    const signature = raw.types.signatures[callback];
    assert.equal(signature.declaration.node, member.parameters.nodes[0].type.id);
    return signature;
  });
}

async function comparatorProbe(signature) {
  const probe = await resultProbe(withComparator(signature));
  const { checker, selected, typeShape, produce } = probe;
  const receiver = checker.getReturnTypeOfSignature(produce).type;
  const comparator = typeShape.getSignatureParameterInfos(selected(receiver, "sort"))[0].type;
  const callable = typeShape.getUnionOrIntersectionTypes(comparator).find(arm => !typeShape.isNullish(arm));
  const [applied] = typeShape.getCallSignatures(callable);
  return { ...probe, receiver, applied, formal: typeShape.getSignatureParameterInfos(applied) };
}

test("both actual required comparator formals retain the independently qualified tuple occurrences", async () => {
  const { capture, typeShape, receiver, applied, formal } = await comparatorProbe("(left: T, right: T) => number");
  const [slot] = typeShape.getTypeReferenceArgumentInfos(receiver);
  assert.equal(formal.every(parameter => parameter.parameterKind === "required" && parameter.type === slot.argument), true);
  assert.equal(typeShape.getSignatureParameterInfos(applied.target).every(parameter => parameter.type === slot.parameter), true);
  const result = capture({});
  assert.equal(result.kind, "ok");
  const raw = result.value;
  const build = raw.tree.statements.nodes.find(node => node.name?.text === "Build").members.nodes[0];
  const callbacks = comparatorResults(raw);
  assert.notEqual(callbacks[0].id, callbacks[1].id);
  assert.equal(callbacks[0].target, callbacks[1].target);
  const form = id => raw.types.types[id].form.value;
  for (const callback of callbacks) {
    assert.equal(callback.parameters.length, 2);
    for (const parameter of callback.parameters) {
      assert.equal(parameter.kind, "required");
      const row = raw.types.types[parameter.type];
      assert.equal(row.authoredTypeNode, null, "the selected callback formal itself is not authored");
      const tuple = row.form.value;
      assert.equal(tuple.kind, "tuple");
      assert.equal(tuple.readonly, true);
      assert.deepEqual(tuple.elements.map(element => form(element.type).parameter),
        build.typeParameters.nodes.map(node => ({ module: raw.module, node: node.id })));
    }
    assert.deepEqual(form(callback.result.value), { kind: "scalar", scalar: "number" });
  }
});

test("an optional, alias-wrapped, composite or result occurrence gains no callback-formal authority", async () => {
  for (const [signature, suffix] of [
    ["(value?: T) => number", ""],
    ["(value: Identity<T>) => number", "type Identity<Value> = Value;"],
    ["Comparator<T>", "type Comparator<Value> = (value: Value) => number;"],
    ["((left: T) => number) & ((right: T) => number)", ""],
    ["(value: T) => Identity<T>", "type Identity<Value> = Value;"],
  ]) {
    const { fixture, program, deps, module } = await opened(withComparator(signature) + suffix, false);
    assert.throws(() => fixture.front.captureModule(deps, program, module),
      /a tuple requires its actual authored, projected or inferred destructuring association/u, signature);
  }
});

test("an unexpanded rest remains one rest array, not a required tuple formal", async () => {
  const { capture, formal } = await comparatorProbe("(...values: T[]) => number");
  assert.equal(formal.length, 1);
  assert.equal(formal[0].parameterKind, "rest");
  const result = capture({});
  assert.equal(result.kind, "ok");
  for (const callback of comparatorResults(result.value)) {
    assert.equal(callback.parameters.length, 1);
    const [rest] = callback.parameters;
    const type = result.value.types.types[rest.type];
    assert.equal(rest.kind, "rest");
    assert.notEqual(type.form.value.kind, "tuple");
    assert.equal(type.authoredTypeNode, null);
  }
});

test("another actual callback parameter root cannot qualify the selected required formal", async () => {
  const { capture, checker, applied, formal } = await comparatorProbe("(left: T, right: T) => number");
  const [left, right] = formal;
  const [originalLeft, originalRight] = applied.target.parameters;
  assert.notEqual(originalLeft, originalRight);
  assert.equal(checker.getRootSymbols(left.sourceSymbol)[0] === originalLeft, true);
  const crossed = checker.getRootSymbols(right.sourceSymbol);
  assert.equal(crossed.length, 1);
  assert.equal(crossed[0] === originalRight, true);
  let reads = 0;
  assert.throws(() => capture({ getRootSymbols(symbol) {
    if (symbol === left.sourceSymbol) { reads += 1; return crossed; }
    return checker.getRootSymbols(symbol);
  } }), /a tuple requires its actual authored, projected or inferred destructuring association/u);
  assert.equal(reads, 1);
});

test("the callback formal proof stops at its actual original root without reading the next formal", async () => {
  const { capture, checker, formal, limits } = await comparatorProbe("(left: T, right: T) => number");
  const [left, right] = formal.map(parameter => parameter.sourceSymbol);
  const stop = new Error("actual callback formal root reader stopped");
  const reads = [];
  const overrides = { getRootSymbols(symbol) {
    if (symbol === right) reads.push("right");
    if (symbol === left) { reads.push("left"); throw stop; }
    return checker.getRootSymbols(symbol);
  } };
  for (const [dimension, exact] of [["maximumCapturedFactsPerModule", 207], ["maximumCapturedEdgesPerModule", 191]]) {
    const run = cap => capture(overrides, { ...limits, [dimension]: cap });
    primeCaptureReader(run, limits[dimension], stop);
    reads.length = 0;
    for (let cap = 0; cap < exact; cap += 1) {
      const result = run(cap);
      assert.equal(result.kind, "refused", `${dimension} ${cap}`);
      assert.equal(result.diagnostics.at(-1).code.name, "TSONIC_COMPILER_RESOURCE_LIMIT");
      assert.deepEqual(reads, [], `${dimension} ${cap}`);
    }
    assert.throws(() => run(exact), error => error === stop, `${dimension} ${exact}`);
    assert.deepEqual(reads, ["left"]);
    reads.length = 0;
  }
});

function withDeclaredTuple(result = "Iteration<[number, T]>", extra = "") {
  return bracketed().replace("take(value: T): boolean;", `entries(): ${result}; ${extra}`) +
    "interface Iteration<Item> { value: Item; }";
}

async function nestedResultProbe(source) {
  const probe = await resultProbe(source);
  const { checker, selected, produce } = probe;
  const receiver = checker.getReturnTypeOfSignature(produce).type;
  return { ...probe, receiver, entries: selected(receiver, "entries") };
}

test("a declared result retains only the authored occurrence at the actually changed tuple slot", async () => {
  const { capture, receiver, checker, typeShape, entries } = await nestedResultProbe(withDeclaredTuple());
  const selected = checker.getReturnTypeOfSignature(entries).type;
  const original = checker.getReturnTypeOfSignature(entries.target).type;
  const target = type => typeShape.getTypeReferenceTarget(type);
  const inner = type => typeShape.getTypeReferenceArgumentInfos(type)[0];
  const before = inner(original);
  const after = inner(selected);
  assert.equal(target(original) === target(selected) && before.parameter === after.parameter, true);
  assert.equal(target(before.argument) === target(after.argument), true);
  const originals = typeShape.getTupleInfo(before.argument).elements;
  const actuals = typeShape.getTupleInfo(after.argument).elements;
  const { parameter, argument } = inner(receiver);
  assert.equal(originals[0].type === actuals[0].type && originals[1].type === parameter && actuals[1].type === argument, true);
  const result = capture({});
  assert.equal(result.kind, "ok");
  const raw = result.value;
  const build = raw.tree.statements.nodes.find(node => node.name?.text === "Build").members.nodes[0];
  const form = id => raw.types.types[id].form.value;
  const { signatures: found } = tupleReceiverMemberResults(raw);
  assert.notEqual(found[0].id, found[1].id);
  assert.equal(found[0].target, found[1].target);
  for (const signature of found) {
    const resultId = signature.result.value;
    assert.equal(raw.types.types[resultId].authoredTypeNode, null);
    const argument = form(resultId).arguments[0];
    const outer = form(argument.argument.value);
    assert.equal(outer.kind, "tuple");
    assert.equal(outer.readonly, false);
    assert.deepEqual(form(outer.elements[0].type), { kind: "scalar", scalar: "number" });
    const selected = outer.elements[1].type;
    assert.equal(raw.types.types[selected].authoredTypeNode, null);
    const tuple = form(selected);
    assert.equal(tuple.kind, "tuple");
    assert.equal(tuple.readonly, true);
    assert.deepEqual(tuple.elements.map(element => form(element.type).parameter),
      build.typeParameters.nodes.map(node => ({ module: raw.module, node: node.id })));
  }
});

test("an alias cannot supply the written changed tuple slot, even at an identical native result", async () => {
  const { capture, checker, typeShape, receiver, selected, entries } = await nestedResultProbe(
    withDeclaredTuple("Iteration<[number, Identity<T>]>", "direct(): Iteration<[number, T]>;") + "type Identity<Value> = Value;");
  const actual = checker.getReturnTypeOfSignature(entries);
  const direct = checker.getReturnTypeOfSignature(selected(receiver, "direct"));
  assert.equal(typeShape.isTypeIdenticalTo(actual.type, direct.type), true);
  assert.throws(() => capture({}), /a projected tuple slot requires its actual authored binder/u);
});

test("a different tuple flag or changed unbound sibling cannot transport the nested source", async () => {
  const { capture, checker, typeShape, receiver, selected, entries } = await nestedResultProbe(
    withDeclaredTuple("Iteration<[number, T]>", "flags(): Iteration<readonly [number, T]>; sibling(): Iteration<[string, T]>;"));
  const actual = checker.getReturnTypeOfSignature(entries);
  const order = type => typeShape.getTupleInfo(typeShape.getTypeReferenceArgumentInfos(type)[0].argument);
  const original = order(actual.type);
  for (const [name, error] of [
    ["flags", /a tuple requires its actual unchanged native slot inventory/u],
    ["sibling", /a projected tuple slot requires its actual selected type association/u],
  ]) {
    const wrong = checker.getReturnTypeOfSignature(selected(receiver, name));
    assert.equal(typeShape.getTypeReferenceTarget(actual.type) === typeShape.getTypeReferenceTarget(wrong.type), true);
    const tuple = order(wrong.type);
    assert.equal(original.elements[1].type === tuple.elements[1].type, true);
    assert.equal(name === "flags" ? original.readonly !== tuple.readonly : original.elements[0].type !== tuple.elements[0].type, true);
    let received = 0;
    assert.throws(() => capture({ getReturnTypeOfSignature(signature) {
      if (signature === entries) { received += 1; return wrong; }
      return checker.getReturnTypeOfSignature(signature);
    } }), error, name);
    assert.equal(received, 1);
  }
});

test("the changed nested slot reads only after its unchanged sibling and the exact admission", async () => {
  const { ast, checker, capture, entries, limits } = await nestedResultProbe(withDeclaredTuple());
  const annotation = ast.typeNode(checker.getSignatureDeclaration(entries.target));
  const tuple = ast.as.AsTypeReferenceNode(annotation).TypeArguments.Nodes[0];
  const [unchanged, changed] = ast.as.AsTupleTypeNode(tuple).Elements.Nodes;
  const stop = new Error("actual original changed tuple element reader stopped");
  const reads = [];
  const overrides = { getTypeFromTypeNode(node) {
    if (node === unchanged) reads.push("unchanged");
    if (node === changed) { reads.push("changed"); throw stop; }
    return checker.getTypeFromTypeNode(node);
  } };
  for (const [dimension, exact] of [["maximumCapturedFactsPerModule", 201], ["maximumCapturedEdgesPerModule", 185]]) {
    const run = cap => capture(overrides, { ...limits, [dimension]: cap });
    primeCaptureReader(run, limits[dimension], stop);
    for (let cap = 0; cap < exact; cap += 1) {
      reads.length = 0;
      const result = run(cap);
      assert.equal(result.kind, "refused", `${dimension} ${cap}`);
      assert.equal(result.diagnostics.at(-1).code.name, "TSONIC_COMPILER_RESOURCE_LIMIT");
      assert.equal(reads.length === 0 || reads.length === 1 && reads[0] === "unchanged", true, `${dimension} ${cap}`);
    }
    reads.length = 0;
    assert.throws(() => run(exact), error => error === stop, `${dimension} ${exact}`);
    assert.deepEqual(reads, ["unchanged", "changed"]);
  }
});

function expectTupleResult(raw, id) {
  const build = raw.tree.statements.nodes.find(node => node.name?.text === "Build").members.nodes[0];
  const row = raw.types.types[id];
  assert.equal(row.authoredTypeNode, null);
  assert.equal(row.form.value.kind, "tuple");
  assert.equal(row.form.value.readonly, true);
  assert.deepEqual(row.form.value.elements.map(element => raw.types.types[element.type].form.value.parameter),
    build.typeParameters.nodes.map(node => ({ module: raw.module, node: node.id })));
}

function directMutableMembers(members) {
  return bracketed("boolean").replaceAll(direct, "(readonly [K,V])[]").replace("take(value: T): boolean;", members);
}

function memberSelections(raw) {
  const build = raw.tree.statements.nodes.find(node => node.name?.text === "Build").members.nodes[0];
  const member = raw.tree.statements.nodes.filter(node => node.name?.text === "Array")[1].members.nodes[0];
  return raw.types.signatures.filter(row => row.target !== null && row.owner.node === build.id && row.declaration?.node === member.id);
}

test("the direct member and callback results qualify independently of their unrelated formals", async () => {
  for (const callback of [false, true]) {
    const { capture } = await resultProbe(directMutableMembers(callback
      ? "take(compare?: (value: number) => T): boolean;" : "take(value: number): T;"), "take");
    const result = capture({});
    assert.equal(result.kind, "ok");
    const raw = result.value;
    const form = id => raw.types.types[id].form.value;
    const members = memberSelections(raw);
    assert.equal(members.length, 2);
    const signatures = callback ? members.map(method => {
      const compare = form(method.parameters[0].type).members.map(form).find(arm => arm.kind === "structure");
      return raw.types.signatures[raw.types.members[compare.inventory].calls[0]];
    }) : members;
    assert.notEqual(signatures[0].id, signatures[1].id);
    for (const signature of signatures) {
      assert.deepEqual(raw.types.types[signature.parameters[0].type].form.value, { kind: "scalar", scalar: "number" });
      expectTupleResult(raw, signature.result.value);
    }
  }
});

test("an identical native result of another authored member cannot replace the selected signature's declaration", async () => {
  const { capture, checker, arrays: [receiver], selected, typeShape } = await resultProbe(directMutableMembers("take(): T; other(): T;"), "take");
  const method = selected(receiver, "take");
  const unrelated = selected(receiver, "other");
  const wrong = checker.getSignatureDeclaration(unrelated);
  assert.notEqual(checker.getSignatureDeclaration(method), wrong);
  assert.equal(typeShape.isTypeIdenticalTo(checker.getReturnTypeOfSignature(method).type, checker.getReturnTypeOfSignature(unrelated).type), true);
  let reads = 0;
  assert.throws(() => capture({ getSignatureDeclaration(signature) {
    if (signature === method) { reads += 1; return wrong; }
    return checker.getSignatureDeclaration(signature);
  } }), /a tuple requires its actual authored, projected or inferred destructuring association/u);
  assert.ok(reads > 0);
});

test("the selected callback result cannot borrow the differently bound tuple from another receiver", async () => {
  const source = directMutableMembers("take(compare?: (value: T) => T): boolean;")
    .replace("second?: null | (readonly [K,V])[]", "second?: null | (readonly [V,K])[]");
  const { arrays, capture, checker, selected, typeShape } = await resultProbe(source, "take");
  const callbacks = arrays.map(receiver => {
    const [parameter] = typeShape.getSignatureParameterInfos(selected(receiver, "take"));
    const callable = typeShape.getUnionOrIntersectionTypes(parameter.type).find(arm => !typeShape.isNullish(arm));
    return typeShape.getCallSignatures(callable)[0];
  });
  const [actual, crossed] = callbacks;
  const original = checker.getReturnTypeOfSignature(actual);
  const replacement = checker.getReturnTypeOfSignature(crossed);
  assert.equal(actual.target === crossed.target, true);
  assert.equal(original.type === typeShape.getSignatureParameterInfos(actual)[0].type, true);
  assert.equal(original.type === replacement.type, false);
  assert.equal(capture({}).kind, "ok");
  let reads = 0;
  assert.throws(() => capture({ getReturnTypeOfSignature(signature) {
    if (signature === actual) { reads += 1; return replacement; }
    return checker.getReturnTypeOfSignature(signature);
  } }), /a tuple requires its actual authored, projected or inferred destructuring association/u);
  assert.equal(reads, 1);
});

function withIndexes() {
  return bracketed("boolean").replace(`second?: null | ${direct}`, "second?: null | (readonly [K,V])[]")
    .replace("take(value: T): boolean;", "take(value: T): boolean; [position: number]: T;")
    .replace("flag: boolean; }", "flag: boolean; readonly [position: number]: T; }");
}

test("the exact mutable and readonly index values retain the tuple without assigning it to their keys", async () => {
  const { capture, typeShape, arrays } = await resultProbe(withIndexes());
  for (const [index, receiver] of arrays.entries()) {
    const [applied] = typeShape.getIndexInfos(receiver);
    const [original] = typeShape.getIndexInfos(typeShape.getTypeReferenceTarget(receiver));
    const [slot] = typeShape.getTypeReferenceArgumentInfos(receiver);
    assert.equal(applied.declaration === original.declaration && applied.keyType === original.keyType, true);
    assert.equal(applied.readonly === original.readonly && applied.readonly === (index === 0), true);
    assert.equal(original.valueType === slot.parameter && applied.valueType === slot.argument, true);
  }
  const result = capture({});
  assert.equal(result.kind, "ok");
  const raw = result.value;
  const indexes = raw.types.members.flatMap(table => table.indexes).filter(row => raw.types.types[row.value].form.value.kind === "tuple");
  assert.equal(new Set(indexes.map(row => row.origin.node)).size, 2);
  assert.deepEqual([...new Set(indexes.map(row => row.readonly))].sort(), [false, true]);
  for (const row of indexes) {
    expectTupleResult(raw, row.value);
    assert.deepEqual(raw.types.types[row.key].form.value, { kind: "scalar", scalar: "number" });
  }
});

test("a selected index from the wrong owner or a crossed template row does not qualify its tuple value", async () => {
  const { capture, typeShape, arrays: [readonly, mutable], limits } = await resultProbe(withIndexes());
  const mutableTarget = typeShape.getTypeReferenceTarget(mutable);
  const readonlyTarget = typeShape.getTypeReferenceTarget(readonly);
  const [expected] = typeShape.getIndexInfos(mutable);
  const [crossed] = typeShape.getIndexInfos(readonly);
  assert.equal(crossed.valueType === expected.valueType && crossed.keyType === expected.keyType, true);
  assert.equal(crossed.readonly !== expected.readonly && crossed.declaration !== expected.declaration, true);
  for (const [subject, replacement] of [[mutable, readonly], [mutableTarget, readonlyTarget]]) {
    let reads = 0;
    assert.throws(() => capture({}, limits, { getIndexInfos(type) {
      if (type === subject) { reads += 1; return typeShape.getIndexInfos(replacement); }
      return typeShape.getIndexInfos(type);
    }, getStructuredInventory(type, admit) {
      const selected = typeShape.getStructuredInventory(type, admit);
      if (type !== subject || selected.kind !== "complete") return selected;
      reads += 1;
      return { kind: "complete", value: { ...selected.value, indexes: typeShape.getIndexInfos(replacement) } };
    } }), /a tuple requires its actual authored, projected or inferred destructuring association/u);
    assert.ok(reads > 0);
  }
});

test("direct result and index value binders preserve the exact paid stops", async () => {
  const member = await resultProbe(directMutableMembers("take(value: number): T;"), "take");
  const callback = await resultProbe(directMutableMembers("take(compare?: (value: number) => T): boolean;"), "take");
  const index = await resultProbe(withIndexes());
  const callbackOwner = callback.checker.getSignatureDeclaration(callback.produce.target);
  const callbackAnnotation = callback.ast.typeNode(callback.ast.parameters(callbackOwner)[0]);
  const indexDeclaration = index.typeShape.getIndexInfos(index.arrays[0])[0].declaration;
  const endpoints = [
    [member, member.checker.getSignatureDeclaration(member.produce.target), undefined, 115, 92],
    [callback, callbackAnnotation, undefined, 129, 110],
    [index, indexDeclaration, index.ast.typeNode(index.ast.parameters(indexDeclaration)[0]), 85, 73],
  ];
  for (const [probe, declaration, key, facts, edges] of endpoints) {
    const binder = probe.ast.typeNode(declaration);
    assert.notEqual(binder, undefined);
    const stop = new Error("actual direct endpoint's written binder reader stopped");
    const reads = [];
    const overrides = { getTypeFromTypeNode(node) {
      if (key !== undefined && node === key) reads.push("key");
      if (node === binder) { reads.push("binder"); throw stop; }
      return probe.checker.getTypeFromTypeNode(node);
    } };
    for (const [dimension, exact] of [["maximumCapturedFactsPerModule", facts], ["maximumCapturedEdgesPerModule", edges]]) {
      const run = cap => probe.capture(overrides, { ...probe.limits, [dimension]: cap });
      primeCaptureReader(run, probe.limits[dimension], stop);
      for (let cap = 0; cap < exact; cap += 1) {
        reads.length = 0;
        const result = run(cap);
        assert.equal(result.kind, "refused", `${dimension} ${cap}`);
        assert.equal(result.diagnostics.at(-1).code.name, "TSONIC_COMPILER_RESOURCE_LIMIT");
        assert.equal(reads.includes("binder"), false, `${dimension} ${cap}`);
      }
      reads.length = 0;
      assert.throws(() => run(exact), error => error === stop, `${dimension} ${exact}`);
      assert.deepEqual(reads, key === undefined ? ["binder"] : ["key", "binder"]);
    }
  }
});

async function restDependencyProbe(second = "K,V") {
  const source = "interface Wrapped<Value> {}" +
    directMutableMembers("take(...items: (Wrapped<T> | T)[]): boolean;")
      .replace("second?: null | (readonly [K,V])[]", `second?: null | (readonly [${second}])[]`);
  const probe = await resultProbe(source, "take");
  const selected = probe.arrays.map(receiver => probe.selected(receiver, "take"));
  const original = probe.typeShape.getSignatureParameterInfos(selected[0].target)[0];
  const rest = selected.map(signature => probe.typeShape.getSignatureParameterInfos(signature)[0]);
  const parameters = probe.arrays.map(receiver => probe.typeShape.getTypeReferenceArgumentInfos(receiver)[0]);
  const arguments_ = rest.map(formal => probe.typeShape.getTypeReferenceArgumentInfos(formal.type)[0]);
  const annotation = probe.ast.typeNode(original.declaration);
  const { ast, checker } = probe;
  const declarations = ast.statements(ast.getSourceFile(annotation)).filter(node => ast.kindName(node) === "KindInterfaceDeclaration");
  const build = declarations.find(node => ast.text(ast.name(node)) === "Build");
  const firstFormal = ast.typeNode(ast.parameters(ast.members(build)[0])[0]);
  const [firstArm] = ast.as.AsUnionTypeNode(firstFormal).Types.Nodes;
  const tuple = ast.as.AsParenthesizedTypeNode(ast.as.AsArrayTypeNode(firstArm).ElementType).Type;
  const [element] = ast.as.AsTupleTypeNode(ast.as.AsTypeOperatorNode(tuple).Type).Elements.Nodes;
  const otherOwner = declarations.find(node => ast.text(ast.name(node)) === "ReadonlyArray");
  const foreignTarget = checker.getDeclaredTypeOfSymbol(checker.getSymbolAtLocation(ast.name(otherOwner)));
  for (const [index, formal] of rest.entries()) {
    assert.equal(formal.parameterKind, "rest");
    assert.equal(formal.declaration === original.declaration, true);
    assert.equal(probe.typeShape.getTypeReferenceTarget(formal.type) === probe.typeShape.getTypeReferenceTarget(probe.arrays[index]), true);
    assert.equal(arguments_[index].parameter === parameters[index].parameter && arguments_[index].scope === "local", true);
    assert.equal(probe.typeShape.getUnionOrIntersectionTypes(arguments_[index].argument).includes(parameters[index].argument), true);
  }
  return { ...probe, rest, parameters, arguments_, element, foreignTarget };
}

test("the changed merged dependency retains each actual composed rest union's own tuple use", async () => {
  const { capture, typeShape, rest, parameters, arguments_ } = await restDependencyProbe();
  assert.equal(rest[0].type === rest[1].type, true);
  const result = capture({});
  assert.equal(result.kind, "ok");
  const raw = result.value;
  const signatures = memberSelections(raw);
  assert.equal(signatures.length, 2);
  const sources = [];
  for (const [index, signature] of signatures.entries()) {
    const dependency = raw.types.types[signature.parameters[0].type];
    assert.equal(dependency.authoredTypeNode, null);
    assert.equal(dependency.form.value.kind, "merged-interface-dependency");
    assert.equal(dependency.form.value.arguments.length, 1);
    const [argument] = dependency.form.value.arguments;
    assert.equal(argument.scope, "local");
    assert.equal(argument.parameters.length, 2);
    const union = raw.types.types[argument.type];
    assert.equal(union.authoredTypeNode, null);
    assert.equal(union.form.value.kind, "union");
    assert.deepEqual(raw.types.components[union.component].path,
      { prefix: dependency.component, step: { kind: "argument-place", index: 0 } });
    const arms = typeShape.getUnionOrIntersectionTypes(arguments_[index].argument);
    assert.equal(arms.length, 2);
    const bare = arms.indexOf(parameters[index].argument);
    const bareId = union.form.value.members[bare];
    const wrapped = raw.types.types[union.form.value.members[1 - bare]];
    assert.deepEqual(raw.types.components[raw.types.types[bareId].component].path,
      { prefix: union.component, step: { kind: "union-member", index: bare } });
    expectTupleResult(raw, bareId);
    assert.equal(wrapped.form.value.kind, "declared");
    const [binding] = wrapped.form.value.arguments;
    expectTupleResult(raw, binding.argument.value);
    assert.notEqual(binding.argument.value, bareId);
    sources.push(bareId);
  }
  assert.notEqual(sources[0], sources[1]);
});

test("a crossed changed target or slot cannot carry the earlier proved tuple into a different dependency", async () => {
  const { arrays: [active], rest: [first, second], arguments_, checker, typeShape, foreignTarget, element, capture, limits } =
    await restDependencyProbe("V,K");
  assert.equal(typeShape.getTypeReferenceTarget(first.type) === foreignTarget, false);
  assert.equal(first.type === second.type, false);
  assert.equal(arguments_[0].parameter === arguments_[1].parameter && arguments_[0].argument !== arguments_[1].argument, true);
  for (const kind of ["actual", "target", "slot"]) {
    let targetReads = 0;
    let slotReads = 0;
    let pairedRead = false;
    let changedRead = false;
    let elementReads = 0;
    const run = () => capture({ getTypeFromTypeNode(node) {
      if (changedRead && node === element) elementReads += 1;
      return checker.getTypeFromTypeNode(node);
    } }, limits, {
      getTypeReferenceTarget(type) {
        if (type === first.type && ++targetReads === 2 && kind === "target") {
          pairedRead = true;
          return foreignTarget;
        }
        if (pairedRead && type === active) { pairedRead = false; return foreignTarget; }
        return typeShape.getTypeReferenceTarget(type);
      },
      getTypeReferenceArgumentInfos(type) {
        if (type === first.type && ++slotReads === 2) {
          changedRead = true;
          if (kind === "slot") return [arguments_[1]];
        }
        return typeShape.getTypeReferenceArgumentInfos(type);
      },
    });
    if (kind === "actual") {
      assert.equal(run().kind, "ok");
      assert.ok(elementReads > 0);
    } else {
      assert.throws(run, /a tuple requires its actual authored, projected or inferred destructuring association/u);
      assert.equal(elementReads, 0, kind);
    }
    assert.equal(pairedRead, false);
    assert.equal(changedRead, true);
  }
});

test("the changed dependency target and slot readers preserve their paid original stops", async () => {
  const { rest: [first], capture, limits, typeShape, checker, element } = await restDependencyProbe();
  for (const [reader, facts, edges] of [["target", 128, 110], ["slot", 128, 112]]) {
    const stop = new Error(`actual changed dependency ${reader} reader stopped`);
    const run = navigationCapture => {
      let targets = 0;
      let slots = 0;
      let stopped = false;
      try {
        return capture({ getTypeFromTypeNode(node) {
          if (stopped) assert.equal(node === element, false);
          return checker.getTypeFromTypeNode(node);
        } }, navigationCapture, {
          getTypeReferenceTarget(type) {
            if (type === first.type && ++targets === 2 && reader === "target") { stopped = true; throw stop; }
            return typeShape.getTypeReferenceTarget(type);
          },
          getTypeReferenceArgumentInfos(type) {
            assert.equal(stopped, false);
            if (type === first.type && ++slots === 2 && reader === "slot") { stopped = true; throw stop; }
            return typeShape.getTypeReferenceArgumentInfos(type);
          },
        });
      } finally {
        if (stopped) assert.equal(slots, reader === "target" ? 1 : 2);
      }
    };
    for (const [dimension, exact] of [["maximumCapturedFactsPerModule", facts], ["maximumCapturedEdgesPerModule", edges]]) {
      primeCaptureReader(cap => run({ ...limits, [dimension]: cap }), limits[dimension], stop);
      for (let cap = 0; cap < exact; cap += 1) {
        const result = run({ ...limits, [dimension]: cap });
        assert.equal(result.kind, "refused", `${reader} ${dimension} ${cap}`);
        assert.equal(result.diagnostics.at(-1).code.name, "TSONIC_COMPILER_RESOURCE_LIMIT");
      }
      assert.throws(() => run({ ...limits, [dimension]: exact }), error => error === stop, `${reader} ${dimension} ${exact}`);
    }
  }
});

function declaredRestSource(annotation = "Wrapped<T>[]", second = "K,V") {
  return "interface Wrapped<Value> {} interface Unrelated<Value> {} type Alias<Value> = Wrapped<Value>;" +
    directMutableMembers(`take(...items: ${annotation}): boolean;`)
      .replace("second?: null | (readonly [K,V])[]", `second?: null | (readonly [${second}])[]`);
}

async function declaredRestProbe(annotation, second) {
  const probe = await resultProbe(declaredRestSource(annotation, second), "take");
  const selected = probe.arrays.map(receiver => probe.selected(receiver, "take"));
  const original = probe.typeShape.getSignatureParameterInfos(selected[0].target)[0];
  const selectedFormals = selected.map(signature => probe.typeShape.getSignatureParameterInfos(signature)[0]);
  const outer = [original, ...selectedFormals].map(formal => probe.typeShape.getTypeReferenceArgumentInfos(formal.type)[0]);
  const inner = outer.map(slot => probe.typeShape.getTypeReferenceArgumentInfos(slot.argument)[0]);
  const written = probe.ast.typeNode(original.declaration);
  return { ...probe, original, selectedFormals, outer, inner, written };
}

test("a directly declared rest element retains two ordered argument components without a union", async () => {
  const { ast, checker, typeShape, arrays, original, selectedFormals, outer, inner, written, capture } = await declaredRestProbe();
  const before = typeShape.getTypeReferenceArgumentInfos(arrays[0])[0];
  assert.equal(inner[0].argument === before.parameter && inner[1].argument === before.argument, true);
  assert.equal(checker.getTypeFromTypeNode(written).type === original.type && original.declaration === selectedFormals[0].declaration, true);
  assert.equal(outer[0].parameter === outer[1].parameter && inner[0].parameter === inner[1].parameter, true);
  assert.equal(outer.every(slot => slot.scope === "local" && !typeShape.isUnion(slot.argument)), true);
  assert.equal(selectedFormals[0].type === selectedFormals[1].type, true);
  assert.equal(ast.kindName(ast.as.AsArrayTypeNode(written).ElementType), "KindTypeReference");
  const result = capture({});
  assert.equal(result.kind, "ok");
  const raw = result.value;
  const wrapped = raw.tree.statements.nodes.find(node => node.name?.text === "Wrapped");
  const member = raw.tree.statements.nodes.filter(node => node.name?.text === "Array")[1].members.nodes[0];
  const binder = member.parameters.nodes[0].type.elementType.typeArguments.nodes[0];
  const tuples = [];
  for (const signature of memberSelections(raw)) {
    const parameter = signature.parameters[0];
    assert.equal(parameter.kind, "rest");
    const rest = raw.types.types[parameter.type];
    assert.equal(rest.authoredTypeNode, null);
    assert.equal(rest.form.value.kind, "merged-interface-dependency");
    const [application] = rest.form.value.arguments;
    const innerRow = raw.types.types[application.type];
    assert.deepEqual(raw.types.components[innerRow.component].path,
      { prefix: rest.component, step: { kind: "argument-place", index: 0 } });
    assert.equal(innerRow.authoredTypeNode, null);
    assert.equal(innerRow.form.value.kind, "declared");
    assert.deepEqual(innerRow.form.value.declaration, { module: raw.module, node: wrapped.id });
    const [binding] = innerRow.form.value.arguments;
    assert.deepEqual(binding.explicitTypeNode, { module: raw.module, node: binder.id });
    const tuple = raw.types.types[binding.argument.value];
    assert.deepEqual(raw.types.components[tuple.component].path,
      { prefix: innerRow.component, step: { kind: "argument-place", index: 0 } });
    expectTupleResult(raw, tuple.id);
    tuples.push(tuple.id);
  }
  assert.equal(tuples.length, 2);
  assert.notEqual(tuples[0], tuples[1]);
});

test("crossed declared rest outer or inner targets and slots do not read the written binder", async () => {
  const probe = await declaredRestProbe(undefined, "V,K");
  const { ast, checker, typeShape, capture, limits, selectedFormals, outer, inner, written } = probe;
  const element = ast.as.AsArrayTypeNode(written).ElementType;
  const [binder] = ast.as.AsTypeReferenceNode(element).TypeArguments.Nodes;
  const declarations = ast.statements(ast.getSourceFile(written)).filter(node => ast.kindName(node) === "KindInterfaceDeclaration");
  const declaredTarget = name => checker.getDeclaredTypeOfSymbol(checker.getSymbolAtLocation(ast.name(declarations.find(node => ast.text(ast.name(node)) === name))));
  const foreignOuter = declaredTarget("ReadonlyArray");
  const foreignInner = declaredTarget("Unrelated");
  assert.equal(typeShape.getTypeReferenceTarget(selectedFormals[0].type) === foreignOuter, false);
  assert.equal(typeShape.getTypeReferenceTarget(outer[1].argument) === foreignInner, false);
  assert.equal(outer[1].parameter === outer[2].parameter && outer[1].argument !== outer[2].argument, true);
  assert.equal(inner[1].parameter === inner[2].parameter && inner[1].argument !== inner[2].argument, true);
  const cases = [
    ["getTypeReferenceTarget", selectedFormals[0].type, foreignOuter, "outer target"],
    ["getTypeReferenceTarget", outer[1].argument, foreignInner, "inner target"],
    ["getTypeReferenceArgumentInfos", selectedFormals[0].type, [outer[2]], "outer slot"],
    ["getTypeReferenceArgumentInfos", outer[1].argument, [inner[2]], "inner slot"],
  ];
  for (const [read, type, crossed, label] of cases) {
    let replaced = false;
    let binderReads = 0;
    assert.throws(() => capture({ getTypeFromTypeNode(node) {
      if (replaced && node === binder) binderReads += 1;
      return checker.getTypeFromTypeNode(node);
    } }, limits, { [read](subject) {
      if (subject === type && !replaced) { replaced = true; return crossed; }
      return typeShape[read](subject);
    } }), /a tuple requires its actual authored, projected or inferred destructuring association/u, label);
    assert.equal(replaced, true, label);
    assert.equal(binderReads, 0, label);
  }
});

test("an alias spelling of the declared rest element supplies no authored slot relation", async () => {
  const { ast, checker, typeShape, outer, inner, written, capture } = await declaredRestProbe("Alias<T>[]");
  const element = ast.as.AsArrayTypeNode(written).ElementType;
  const name = ast.as.AsTypeReferenceNode(element).TypeName;
  const target = typeShape.getTypeReferenceTarget(outer[1].argument);
  assert.equal(typeShape.getTypeReferenceTarget(outer[0].argument) === target, true);
  assert.equal(checker.getSymbolAtLocation(name) === checker.getTypeSymbol(target), false);
  assert.equal(typeShape.isTuple(inner[1].argument), true);
  assert.throws(() => capture({}), /a tuple requires its actual authored, projected or inferred destructuring association/u);
});

test("the original declared rest inner target stop is paid before selected slots or the written binder", async () => {
  const { ast, checker, typeShape, outer, written, capture, limits } = await declaredRestProbe();
  const element = ast.as.AsArrayTypeNode(written).ElementType;
  const [binder] = ast.as.AsTypeReferenceNode(element).TypeArguments.Nodes;
  const selected = outer[1].argument;
  const stop = new Error("actual selected declared rest element target reader stopped");
  const run = navigationCapture => {
    let targetRead = false;
    return capture({ getTypeFromTypeNode(node) {
      if (targetRead) assert.equal(node === binder, false);
      return checker.getTypeFromTypeNode(node);
    } }, navigationCapture, {
      getTypeReferenceTarget(type) {
        if (type === selected) { targetRead = true; throw stop; }
        return typeShape.getTypeReferenceTarget(type);
      },
      getTypeReferenceArgumentInfos(type) {
        assert.equal(type === selected, false);
        return typeShape.getTypeReferenceArgumentInfos(type);
      },
    });
  };
  for (const [dimension, exact] of [["maximumCapturedFactsPerModule", 127], ["maximumCapturedEdgesPerModule", 109]]) {
    primeCaptureReader(cap => run({ ...limits, [dimension]: cap }), limits[dimension], stop);
    for (let cap = 0; cap < exact; cap += 1) {
      const result = run({ ...limits, [dimension]: cap });
      assert.equal(result.kind, "refused", `${dimension} ${cap}`);
      assert.equal(result.diagnostics.at(-1).code.name, "TSONIC_COMPILER_RESOURCE_LIMIT");
    }
    assert.throws(() => run({ ...limits, [dimension]: exact }), error => error === stop, dimension);
  }
});

function recursiveTupleProbe(right = "T[]") {
  const original = "interface Build { new<K,V>(first?: (readonly [K,V])[] | null): boolean; } type Same<Value> = Value;";
  return resultProbe(original, "left", `interface Array<T> { left(): T[]; right(): ${right}; consume(value: T): T; }`);
}

function signatureForMember(raw, receiver, declaration) {
  const slot = raw.types.members[receiver.form.value.inventory].members.find(member => member.declarations.some(ref =>
    ref.node === declaration.node && ref.module === declaration.module));
  const call = raw.types.members[raw.types.types[slot.read.value].form.value.inventory].calls[0];
  return raw.types.signatures[call];
}

test("recursive results with the same native receiver and tuple still own distinct callable application evidence", async () => {
  const { ast, checker, typeShape, arrays: [receiver], selected, capture, reference } = await recursiveTupleProbe();
  const [leftNative, rightNative] = ["left", "right"].map(name => selected(receiver, name));
  const [leftOwner, rightOwner] = [leftNative, rightNative].map(signature => checker.getSignatureDeclaration(signature.target));
  assert.equal(leftOwner === rightOwner || ast.typeNode(leftOwner) === ast.typeNode(rightOwner), false);
  const [leftType, rightType] = [leftNative, rightNative].map(signature => checker.getReturnTypeOfSignature(signature).type);
  assert.equal(leftType === receiver && rightType === receiver, true);
  assert.equal(selected(leftType, "consume") === selected(rightType, "consume"), true);
  const [nativeSlot] = typeShape.getTypeReferenceArgumentInfos(receiver);
  assert.equal(nativeSlot.scope === "local" && typeShape.isTuple(nativeSlot.argument), true);
  const captured = capture({});
  assert.equal(captured.kind, "ok");
  const raw = captured.value;
  const build = raw.tree.statements.nodes.find(node => node.name?.text === "Build").members.nodes[0];
  const [leftDeclaration, rightDeclaration, consumeDeclaration] = [leftOwner, rightOwner,
    checker.getSignatureDeclaration(selected(receiver, "consume").target)].map(reference);
  const rootSignature = raw.types.signatures.find(signature => signature.target === null && signature.declaration?.node === build.id);
  const union = raw.types.types[rootSignature.parameters[0].type].form.value;
  const root = union.members.map(id => raw.types.types[id]).find(row => row.form.value.kind === "structure");
  const left = signatureForMember(raw, root, leftDeclaration);
  const leftResult = raw.types.types[left.result.value];
  const firstBranch = raw.types.types[signatureForMember(raw, root, rightDeclaration).result.value];
  const leftInFirstBranch = signatureForMember(raw, firstBranch, leftDeclaration);
  const completed = raw.types.types[leftInFirstBranch.result.value];
  const leftAgain = signatureForMember(raw, completed, leftDeclaration);
  const leftAgainResult = raw.types.types[leftAgain.result.value];
  const right = signatureForMember(raw, leftResult, rightDeclaration);
  const rightResult = raw.types.types[right.result.value];
  assert.deepEqual(left.declaration, leftDeclaration);
  assert.deepEqual(leftAgain.declaration, leftDeclaration);
  assert.deepEqual(right.declaration, rightDeclaration);
  assert.equal(new Set([leftResult.component, completed.component, leftAgainResult.component, rightResult.component]).size, 4);
  assert.equal(leftAgainResult.form.value.inventory, completed.form.value.inventory, "the exact active application reuses its ordinary inventory");
  assert.notEqual(rightResult.form.value.inventory, leftResult.form.value.inventory, "another authored application cannot borrow the active inventory");
  for (const [signature, result] of [[left, leftResult], [leftInFirstBranch, completed], [leftAgain, leftAgainResult], [right, rightResult]]) {
    assert.deepEqual(raw.types.components[result.component].path?.step, { kind: "result", signature: signature.id });
  }
  assert.notEqual(completed.form.value.inventory, leftResult.form.value.inventory, "a completed exact sibling is not active evidence");
  const leftConsume = signatureForMember(raw, leftResult, consumeDeclaration);
  const rightConsume = signatureForMember(raw, rightResult, consumeDeclaration);
  assert.equal(leftConsume.target !== null && leftConsume.target === rightConsume.target, true);
  assert.notEqual(leftConsume.id, rightConsume.id, "an active receiver cannot lend another result application's signature evidence");
  for (const signature of [leftConsume, rightConsume]) {
    expectTupleResult(raw, signature.parameters[0].type);
    expectTupleResult(raw, signature.result.value);
  }
});

test("an equal native recursive result with an unproved authored owner cannot use the active receiver's tuple evidence", async () => {
  const { ast, checker, arrays: [receiver], selected, capture } = await recursiveTupleProbe("Same<T[]>");
  const [left, right] = ["left", "right"].map(name => selected(receiver, name));
  const leftOwner = checker.getSignatureDeclaration(left.target);
  const rightOwner = checker.getSignatureDeclaration(right.target);
  assert.equal(checker.getReturnTypeOfSignature(left).type === receiver && checker.getReturnTypeOfSignature(right).type === receiver, true);
  assert.equal(ast.kindName(ast.typeNode(leftOwner)), "KindArrayType");
  assert.equal(ast.kindName(ast.typeNode(rightOwner)), "KindTypeReference");
  assert.throws(() => capture({}), /a tuple requires its actual authored, projected or inferred destructuring association/u);
});

test("an active inventory key is paid before the next native inventory reader and retains its original stop", async () => {
  const { arrays: [receiver], typeShape, capture, limits } = await recursiveTupleProbe();
  const stop = new Error("the first projected native inventory reader stopped");
  let reads = 0;
  const run = navigationCapture => {
    reads = 0;
    return capture({}, navigationCapture, {
      getStructuredInventory(type, admit) {
        if (type === receiver && ++reads === 2) throw stop;
        return typeShape.getStructuredInventory(type, admit);
      },
    });
  };
  for (const [dimension, exact] of [["maximumCapturedFactsPerModule", 179], ["maximumCapturedEdgesPerModule", 171]]) {
    primeCaptureReader(cap => run({ ...limits, [dimension]: cap }), limits[dimension], stop);
    for (let cap = 0; cap < exact; cap += 1) {
      const result = run({ ...limits, [dimension]: cap });
      assert.equal(result.kind, "refused", `${dimension} ${cap}`);
      assert.equal(result.diagnostics.at(-1).code.name, "TSONIC_COMPILER_RESOURCE_LIMIT");
      assert.ok(reads < 2, `${dimension} ${cap}`);
    }
    assert.throws(() => run({ ...limits, [dimension]: exact }), error => error === stop, dimension);
    assert.equal(reads, 2);
  }
  assert.equal(capture({}).kind, "ok", "a stopped capture leaves no inventory in the next capture");
});

test("equal native multi-slot receivers in different merged owners retain both actual binder origins", async () => {
  const fixture = await loadFrontFixture();
  const source = `
    export interface Pair<Left, Right> { first: Pair<Left, Right>; consult(pick: Left, drop: Right): boolean; }
    export interface Pair<Left, Right> { second: Pair<Left, Right>; }
  `;
  const snapshot = fixture.projectSnapshot({ sourceFiles: { "main.ts": source },
    libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] });
  const { OpenedProgram } = await import("../../packages/host/dist/front/handles.js");
  const { program, deps } = fixture.openAndCapture(snapshot);
  const module = snapshot.entryPoint;
  const checked = OpenedProgram.checked(program);
  const file = OpenedProgram.file(program, module).file;
  const { ast } = checked;
  const { checker, typeShape } = checked.getSourceFileQueries(file);
  const [firstOwner, secondOwner] = ast.statements(file);
  const firstUse = ast.typeNode(ast.members(firstOwner)[0]);
  const secondUse = ast.typeNode(ast.members(secondOwner)[0]);
  const first = checker.getTypeFromTypeNode(firstUse).type;
  const second = checker.getTypeFromTypeNode(secondUse).type;
  assert.equal(first === second && typeShape.getTypeReferenceTarget(first) === typeShape.getTypeReferenceTarget(second), true);
  const slots = typeShape.getTypeReferenceArgumentInfos(first);
  assert.equal(slots.length, 2);
  assert.equal(slots.every(slot => slot.scope === "local" && slot.parameter === slot.argument), true);
  const captured = fixture.front.captureModule(deps, program, module);
  assert.equal(captured.kind, "ok");
  const raw = captured.value;
  const owners = raw.tree.statements.nodes;
  const declaration = owners[0].members.nodes[1];
  const signatures = owners.map(owner => {
    const [property] = owner.members.nodes;
    const row = raw.types.types.find(type => type.authoredTypeNode?.module === module && type.authoredTypeNode.node === property.type.id);
    const signature = signatureForMember(raw, row, { module, node: declaration.id });
    assert.deepEqual(signature.parameters.map(formal => raw.types.types[formal.type].form.value.parameter),
      owner.typeParameters.nodes.map(parameter => ({ module, node: parameter.id })));
    return signature;
  });
  assert.equal(signatures[0].target, signatures[1].target);
  assert.notEqual(signatures[0].id, signatures[1].id);
});

async function jointRestResultProbe() {
  const probe = await resultProbe("interface Wrapped<Value> {} interface Build { new<K,V>(first?: (readonly [K,V])[] | null): boolean; }", "take",
    "interface Array<T> { take(...items: Wrapped<T>[]): T[]; other(): T[]; }");
  const { ast, arrays: [receiver], checker, selected, typeShape } = probe;
  const signature = selected(receiver, "take");
  const actualDeclaration = checker.getSignatureDeclaration(signature.target);
  const other = selected(receiver, "other");
  const opposite = checker.getSignatureDeclaration(other.target);
  assert.equal(actualDeclaration === opposite, false);
  assert.equal(checker.getSignatureDeclaration(signature) === actualDeclaration && checker.getReturnTypeOfSignature(signature).type === receiver &&
    checker.getReturnTypeOfSignature(other).type === receiver, true);
  const [formal] = typeShape.getSignatureParameterInfos(signature);
  assert.equal(ast.parent(formal.declaration) === actualDeclaration, true);
  assert.equal(formal.parameterKind, "rest");
  return { ...probe, receiver, signature, actualDeclaration, opposite, formal };
}

test("wrapped rest and a bracketed result retain their own occurrences under one selected declaration", async () => {
  const { receiver, signature, actualDeclaration, opposite, reference, capture, checker } = await jointRestResultProbe();
  const result = capture({});
  assert.equal(result.kind, "ok");
  const raw = result.value;
  const build = raw.tree.statements.nodes.find(node => node.name?.text === "Build").members.nodes[0];
  const rootSignature = raw.types.signatures.find(row => row.target === null && row.declaration?.node === build.id);
  const union = raw.types.types[rootSignature.parameters[0].type].form.value;
  const root = union.members.map(id => raw.types.types[id]).find(row => row.form.value.kind === "structure");
  const applied = signatureForMember(raw, root, reference(actualDeclaration));
  const rest = raw.types.types[applied.parameters[0].type];
  const answer = raw.types.types[applied.result.value];
  assert.equal(rest.form.value.kind, "merged-interface-dependency");
  const wrapper = raw.types.types[rest.form.value.arguments[0].type];
  expectTupleResult(raw, wrapper.form.value.arguments[0].argument.value);
  assert.equal(answer.form.value.kind, "structure");
  assert.notEqual(rest.component, answer.component);
  assert.equal(checker.getReturnTypeOfSignature(signature).type === receiver, true);
  let crossed = 0;
  assert.throws(() => capture({ getSignatureDeclaration(projection) {
    if (projection === signature) { crossed += 1; return opposite; }
    return checker.getSignatureDeclaration(projection);
  } }), /a tuple requires its actual authored, projected or inferred destructuring association/u);
  assert.ok(crossed > 0);
});

test("the joint rest and result declaration proof keeps its first paid reader stop", async () => {
  const { checker, signature, formal, capture, limits } = await jointRestResultProbe();
  const stop = new Error("the actual selected declaration reader stopped");
  const reads = [];
  const run = navigationCapture => {
    reads.length = 0;
    return capture({
      getSignatureDeclaration(selected) {
        if (selected === signature) { reads.push("selected declaration"); throw stop; }
        return checker.getSignatureDeclaration(selected);
      },
      getRootSymbols(symbol) {
        if (symbol === formal.sourceSymbol) reads.push("formal root");
        return checker.getRootSymbols(symbol);
      },
      getReturnTypeOfSignature(selected) {
        if (selected === signature) reads.push("selected result");
        return checker.getReturnTypeOfSignature(selected);
      },
    }, navigationCapture);
  };
  for (const [dimension, exact] of [["maximumCapturedFactsPerModule", 191], ["maximumCapturedEdgesPerModule", 171]]) {
    primeCaptureReader(cap => run({ ...limits, [dimension]: cap }), limits[dimension], stop);
    for (let cap = 0; cap < exact; cap += 1) {
      const result = run({ ...limits, [dimension]: cap });
      assert.equal(result.kind, "refused", `${dimension} ${cap}`);
      assert.equal(result.diagnostics.at(-1).code.name, "TSONIC_COMPILER_RESOURCE_LIMIT");
      assert.deepEqual(reads, [], `${dimension} ${cap}`);
    }
    assert.throws(() => run({ ...limits, [dimension]: exact }), error => error === stop, dimension);
    assert.deepEqual(reads, ["selected declaration"]);
  }
});

test("a callable inventory does not fetch the next native signature before its edge is paid", async () => {
  const { fixture, program, deps, set, module } = await opened(
    "interface Build { make(): { (value: boolean): boolean; (value: string): string }; }");
  const { OpenedProgram } = await import("../../packages/host/dist/front/handles.js");
  const checked = OpenedProgram.checked(program);
  const file = OpenedProgram.file(program, module).file;
  const { ast } = checked;
  const { checker, typeShape } = checked.getSourceFileQueries(file);
  const build = ast.statements(file).find(node => ast.kindName(node) === "KindInterfaceDeclaration" && ast.text(ast.name(node)) === "Build");
  const target = checker.getReturnTypeOfSignature(checker.getSignatureFromDeclaration(ast.members(build)[0])).type;
  const expected = typeShape.getCallSignatures(target);
  assert.equal(expected.length, 2);
  assert.equal(expected[0] !== expected[1], true);
  const stop = new Error("actual second call signature row stopped");
  const reads = [];
  const observed = OpenedProgram.create({ ...checked, getSourceFileQueries(sourceFile) {
    const queries = checked.getSourceFileQueries(sourceFile);
    if (sourceFile !== file) return queries;
    return { ...queries, typeShape: { ...queries.typeShape, getStructuredInventory(type, admit) {
      const selected = queries.typeShape.getStructuredInventory(type, admit);
      if (type !== target || selected.kind !== "complete") return selected;
      const signatures = new Proxy(selected.value.signatures, { get(source, key, receiver) {
        const value = Reflect.get(source, key, receiver);
        if (key === "0" || key === "1") {
          assert.equal(value === expected[Number(key)], true, key);
          reads.push(Number(key));
          if (key === "1") throw stop;
        }
        return value;
      } });
      return { kind: "complete", value: { ...selected.value, signatures } };
    } } };
  } }, OpenedProgram.table(program), set.modules.map(entry =>
    OpenedProgram.file(program, entry.kind === "snapshot" ? entry.module : entry.document.module)),
  OpenedProgram.libraryData(program), OpenedProgram.contributions(program));
  const run = maximumCapturedEdgesPerModule => {
    reads.length = 0;
    return fixture.front.captureModule({ ...deps,
      navigationCapture: { ...deps.navigationCapture, maximumCapturedEdgesPerModule } }, observed, module);
  };
  primeCaptureReader(run, deps.navigationCapture.maximumCapturedEdgesPerModule, stop);
  const secondRowEdge = 46;
  for (let cap = 0; cap < secondRowEdge; cap += 1) {
    const result = run(cap);
    assert.equal(result.kind, "refused", String(cap));
    assert.equal(result.diagnostics.at(-1).code.name, "TSONIC_COMPILER_RESOURCE_LIMIT", String(cap));
    assert.equal(reads.includes(1), false, String(cap));
  }
  assert.deepEqual(reads, [0]);
  assert.throws(() => run(secondRowEdge), error => error === stop);
  assert.deepEqual(reads, [0, 1]);
  assert.equal(fixture.front.captureModule(deps, program, module).kind, "ok");
});

test("type-form classification does not fetch the next native declaration before its edge is paid", async () => {
  const { fixture, program, deps, set, module } = await opened(
    "interface Build { make(): Joined; } interface Joined { first: boolean; } interface Joined { second: string; }");
  const { OpenedProgram } = await import("../../packages/host/dist/front/handles.js");
  const checked = OpenedProgram.checked(program);
  const file = OpenedProgram.file(program, module).file;
  const { ast } = checked;
  const { checker } = checked.getSourceFileQueries(file);
  const build = ast.statements(file).find(node => ast.kindName(node) === "KindInterfaceDeclaration" && ast.text(ast.name(node)) === "Build");
  const target = checker.getReturnTypeOfSignature(checker.getSignatureFromDeclaration(ast.members(build)[0])).type;
  const symbol = checker.getTypeSymbol(target);
  const expected = checker.getSymbolDeclarations(symbol);
  const authored = ast.statements(file).filter(node => ast.kindName(node) === "KindInterfaceDeclaration" && ast.text(ast.name(node)) === "Joined");
  assert.equal(expected.length, 2);
  assert.equal(expected[0] === authored[0] && expected[1] === authored[1], true);
  const stop = new Error("actual second merged declaration row stopped");
  const reads = [];
  const observed = OpenedProgram.create({ ...checked, getSourceFileQueries(sourceFile) {
    const queries = checked.getSourceFileQueries(sourceFile);
    if (sourceFile !== file) return queries;
    return { ...queries, checker: { ...queries.checker, getSymbolDeclarations(candidate) {
      const rows = queries.checker.getSymbolDeclarations(candidate);
      if (candidate !== symbol) return rows;
      return new Proxy(rows, { get(source, key, receiver) {
        const value = Reflect.get(source, key, receiver);
        if (key === "0" || key === "1") {
          assert.equal(value === expected[Number(key)], true, key);
          reads.push(Number(key));
          if (key === "1") throw stop;
        }
        return value;
      } });
    } } };
  } }, OpenedProgram.table(program), set.modules.map(entry =>
    OpenedProgram.file(program, entry.kind === "snapshot" ? entry.module : entry.document.module)),
  OpenedProgram.libraryData(program), OpenedProgram.contributions(program));
  const run = maximumCapturedEdgesPerModule => {
    reads.length = 0;
    return fixture.front.captureModule({ ...deps,
      navigationCapture: { ...deps.navigationCapture, maximumCapturedEdgesPerModule } }, observed, module);
  };
  const secondRowEdge = 42;
  for (let cap = 0; cap < secondRowEdge; cap += 1) {
    const result = run(cap);
    assert.equal(result.kind, "refused", String(cap));
    assert.equal(result.diagnostics.at(-1).code.name, "TSONIC_COMPILER_RESOURCE_LIMIT", String(cap));
    assert.equal(reads.includes(1), false, String(cap));
  }
  assert.deepEqual(reads, [0]);
  assert.throws(() => run(secondRowEdge), error => error === stop);
  assert.deepEqual(reads, [0, 1]);
  assert.equal(fixture.front.captureModule(deps, program, module).kind, "ok");
});

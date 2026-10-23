import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles } from "@tsonic/tsts";
import { createTargetSourceProgram, Node_Initializer } from "../../packages/target-api/dist/public/source.js";
import { createSourceStorageQuery } from "../../packages/target-api/dist/public/analysis.js";
import { createSourceStorageTransport } from "../../packages/target-api/dist/target-analysis/source-storage/transport/transport.js";
import { createSourceStorageStoredValues } from "../../packages/target-api/dist/target-analysis/source-storage/graph/stored-values.js";
import { createSourceStorageBudget, defaultSourceStorageLimits } from "../../packages/target-api/dist/target-analysis/source-storage/model/resource-budget.js";

function fixture(body) {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src",
    compilerOptions: { strict: true, target: "es2022", module: "esnext" },
    files: { "/src/index.ts": `export {}; ${body}` },
  }).checkSource();
  assert.equal(checked.diagnostics.length === 0, true, "ordinary authored source is checked");
  const source = createTargetSourceProgram(checked);
  const budget = createSourceStorageBudget(defaultSourceStorageLimits);
  const transport = createSourceStorageTransport(source, source.navigation.sourceFiles, budget);
  assert.equal(budget.failure() === undefined, true, "original construction bounds remain intact");
  const declaration = (name, predicate) => transport.visitedNodes.find(node =>
    predicate(node) && source.ast.text(source.ast.name(node)) === name);
  const field = name => declaration(name, source.ast.is.IsPropertyDeclaration);
  const variable = name => declaration(name, source.ast.is.IsVariableDeclaration);
  const stores = (node, kind) => [...transport.storesFor(transport.subject(node, kind)) ?? []];
  return { source, budget, transport, declaration, field, variable, stores };
}

function memberWrites(current, ownerName = "owner", memberName = "read") {
  const { ast } = current.source;
  const query = createSourceStorageQuery(current.source, current.source.navigation.sourceFiles);
  const literal = Node_Initializer(ast, current.variable(ownerName));
  const declaration = query.nodes.find(node => ast.is.IsMethodDeclaration(node) && ast.parent(node) === literal &&
    ast.text(ast.name(node)) === memberName);
  assert.equal(declaration !== undefined, true, "the exact authored object method exists");
  const selected = query.memberSubjectFor(declaration);
  assert.equal(selected.kind, "resolved", "the identical graph owns the physical slot");
  return { query, subject: selected.subject, selected: query.memberWritesFor(selected.subject) };
}

test("member-write inventory proves a closed empty local method slot from complete checked source", () => {
  const current = fixture("const owner = { value: 1, read() { return this.value; } }; owner.read();");
  const { selected } = memberWrites(current);
  assert.equal(selected.kind, "complete", "no caller or outside writer remains unknown");
  assert.equal(selected.writes.length, 0, "calling a method does not replace its physical slot");
  assert.equal(Object.isFrozen(selected) && Object.isFrozen(selected.writes), true, "the proof is immutable");
});

for (const [name, mutation] of [
  ["direct replacement", "owner.read = () => 2;"],
  ["same-value assignment", "owner.read = owner.read;"],
  ["structural alias", "interface View { read(): number; } const alias: View = owner; alias.read = () => 2;"],
  ["source parameter", "function replace(input: { read(): number }): void { input.read = () => 2; } replace(owner);"],
  ["returned alias", "function pass(input: { read(): number }) { return input; } pass(owner).read = () => 2;"],
  ["captured alias", "function replace(): void { owner.read = () => 2; } replace();"],
  ["unknown replacement value", "declare const replacement: () => number; owner.read = replacement;"],
]) {
  test(`member-write inventory retains the original occurrence through ${name}`, () => {
    const current = fixture(`const owner = { read() { return 1; } }; ${mutation}`);
    const { query, subject, selected } = memberWrites(current);
    assert.equal(selected.kind, "complete", `${name}: all possible writers are checked source`);
    assert.equal(selected.writes.length, 1, `${name}: the actual mutation is not inferred from a changed value`);
    const write = selected.writes[0];
    assert.equal(write.kind === "mutation" && write.destination === "member", true, `${name}: native slot mutation`);
    assert.equal(write.destinations.includes(subject), true, `${name}: alias correspondence reaches the physical slot`);
    const published = query.writeAt(write.reference, query.emptyBindings);
    assert.equal(published.kind === "resolved" && published.write === write, true, `${name}: one canonical occurrence owner`);
    assert.equal(Object.isFrozen(write) && Object.isFrozen(write.destinations), true, `${name}: destinations are sealed`);
  });
}

test("equal method signatures do not identify distinct physical member slots", () => {
  const current = fixture("const owner = { read() { return 1; } }; const other = { read() { return 1; } }; other.read = () => 2;");
  const first = memberWrites(current);
  const second = memberWrites(current, "other");
  assert.equal(first.selected.kind === "complete" && first.selected.writes.length === 0, true,
    "a different creation's writer does not contaminate the original physical slot");
  assert.equal(second.selected.kind === "complete" && second.selected.writes.length === 1, true,
    "the identical signature does not hide the other creation's actual mutation");
});

test("missing dynamic member correspondence is unresolved rather than an empty writer proof", () => {
  const current = fixture(`
    const owner: { [key: string]: () => number } = { read() { return 1; } };
    declare const key: string;
    owner[key] = () => 2;
  `);
  const { selected } = memberWrites(current);
  assert.equal(selected.kind === "unresolved" && selected.reason.includes("physical destination correspondence"), true,
    "a possible write with no exact selected field cannot certify a non-replaceable method");
});

test("member-write queries reject foreign identities and exhausted construction without claiming empty", () => {
  const current = fixture("const owner = { read() { return 1; } };");
  const { query, subject } = memberWrites(current);
  const foreign = createSourceStorageQuery(current.source, current.source.navigation.sourceFiles);
  for (const selected of [foreign.memberWritesFor(subject), query.memberWritesFor(Object.freeze({ ...subject }))])
    assert.equal(selected.kind === "unresolved", true, "only the identical canonical physical identity is admitted");
  const refused = createSourceStorageQuery(current.source, current.source.navigation.sourceFiles,
    { ...defaultSourceStorageLimits, maximumSteps: 1 });
  const selected = refused.memberWritesFor(subject);
  assert.equal(selected.kind === "unresolved" && refused.failureReason() !== undefined, true,
    "a resource refusal never becomes complete with no writes");
});

test("a native class method is not manufactured into an authored per-instance writable slot", () => {
  const current = fixture("class Owner { read() { return 1; } } const owner = new Owner(); owner.read();");
  const query = createSourceStorageQuery(current.source, current.source.navigation.sourceFiles);
  const declaration = current.declaration("read", current.source.ast.is.IsMethodDeclaration);
  const selected = query.memberSubjectFor(declaration);
  assert.equal(selected.kind, "resolved", "the class declaration still owns its method value");
  const writes = query.memberWritesFor(selected.subject);
  assert.equal(writes.kind === "unresolved" && writes.reason.includes("authored physical member slot"), true,
    "fixed native methods use their native declaration rather than an invented object slot");
});

test("initializer-less declared iteration has one loop-owned initialization and no invented declaration store", () => {
  const current = fixture(`
    const values: object[] = [{}];
    for (const item of values) void item;
    for (const key in values) void key;
    let assigned: object;
    for (assigned of values) void assigned;
  `);
  const { ast } = current.source;
  for (const name of ["item", "key"]) {
    const declaration = current.variable(name);
    const stores = current.stores(declaration);
    assert.equal(stores.length, 1, `${name}: one actual per-iteration store`);
    const store = stores[0];
    assert.equal(store.kind === "initialization", true, `${name}: declared iteration initializes its binding`);
    assert.equal(ast.is.IsForInStatement(store.operation) || ast.is.IsForOfStatement(store.operation), true,
      `${name}: the loop, not its initializer-less declaration, owns the write`);
    assert.equal(store.reference === ast.name(declaration), true, `${name}: exact checked write reference`);
    assert.equal(current.transport.writeAt(store.reference)?.operation === store.operation, true,
      `${name}: publication retains the identical canonical owner`);
  }
  const assigned = current.stores(current.variable("assigned"));
  assert.equal(assigned.length === 1 && assigned[0].kind === "mutation" && ast.is.IsForOfStatement(assigned[0].operation), true,
    "an uninitialized declaration is not a value-producing initialization");
  const originalInputs = [...current.transport.storedInputsFor(current.transport.subject(current.variable("assigned"))) ?? []];
  assert.equal(originalInputs.length === 1 && originalInputs[0] === assigned[0].value, true,
    "the actual mutation of a checked binding retains its physical value without a fabricated initialization store");
});

test("duplicate occurrence admission rejects conflicting original values without replacing the first owner", () => {
  const current = fixture("const first = {}; const second = {}; const value = first;");
  const storage = current.transport.subject(current.variable("value"));
  const reference = Node_Initializer(current.source.ast, current.variable("value"));
  const original = current.transport.subjectFor(reference);
  const replacement = current.transport.subjectFor(Node_Initializer(current.source.ast, current.variable("second")));
  const budget = createSourceStorageBudget(defaultSourceStorageLimits);
  const inventory = createSourceStorageStoredValues(current.source.ast, budget, current.transport.regions.enclosing, () => undefined);
  inventory.initialize(storage, reference, original);
  inventory.initialize(storage, reference, replacement);
  assert.equal(budget.failure()?.includes("one exact checked occurrence owner"), true,
    "the same operation and location cannot silently substitute a different original value");
  const retained = [...inventory.storesFor(storage)];
  assert.equal(retained.length === 1 && retained[0].value === original, true, "the conflicting contribution is never published");
});

test("declaration names retain binding storage rather than manufacturing a runtime read", () => {
  const current = fixture(`
    const value = {};
    function accept(input: object): object { return input; }
  `);
  const callable = current.declaration("accept", current.source.ast.is.IsFunctionDeclaration);
  for (const declaration of [current.variable("value"), callable, current.source.ast.parameters(callable)[0]]) {
    const name = current.source.ast.name(declaration);
    assert.equal(current.transport.subjectFor(name) === current.transport.subjectFor(declaration), true,
      "the authored name is the same checked binding, not an evaluated read occurrence");
  }
  assert.equal(current.budget.failure(), undefined);
});

test("omitted slots have no value and every named binding is complete before the transport seals", () => {
  const current = fixture(`
    function consume(pair: [object, object]): void {
      const [, second = {}] = pair;
      const [unused] = pair;
      const [[nestedUnused]] = [pair];
      void second;
    }
  `);
  const { ast } = current.source;
  const before = current.transport.identities.size;
  let omitted = 0;
  let named = 0;
  for (const node of current.transport.visitedNodes.filter(ast.is.IsBindingElement)) {
    const value = current.transport.subjectFor(node);
    if (ast.name(node) === undefined) {
      omitted += 1;
      assert.equal(value === undefined, true, "an omitted slot is not a physical binding or original value");
      assert.equal(current.transport.writeAt(node) === undefined, true, "an omitted slot has no store occurrence");
    } else {
      named += 1;
      assert.equal(value !== undefined && current.transport.subjectFor(node) === value, true,
        "the existing named binding is an immutable completed lookup");
    }
  }
  assert.equal(omitted, 1, "the exact omitted tuple position was exercised");
  assert.equal(named, 4, "used, unused and nested binding subjects were exercised");
  assert.equal(current.transport.identities.size, before, "post-seal binding lookups create no additional subject");
  assert.equal(current.budget.failure(), undefined, "no post-seal lookup attempts to add a physical edge");
});

test("rest creation retains its exact original value and checked projected inputs without becoming a recursive assignment", () => {
  const current = fixture(`
    interface Pair { first: object; second: object; }
    const first = {};
    const second = {};
    const last = {};
    const source: Pair = { first, second };
    const nested: [[object, object], object] = [[first, second], last];
    const { first: removed, ...rest } = source;
    const [[head], ...tail] = nested;
    void rest.second;
    void tail[0];
  `);
  const { ast } = current.source;
  const query = createSourceStorageQuery(current.source, current.source.navigation.sourceFiles);
  const binding = name => current.transport.visitedNodes.find(node => ast.is.IsBindingElement(node) &&
    ast.is.IsIdentifier(ast.name(node)) && ast.text(ast.name(node)) === name);
  for (const name of ["rest", "tail"]) {
    const declaration = binding(name);
    const selected = query.subjectFor(declaration);
    assert.equal(selected.kind, "resolved", `${name}: the original checked binding has its published value`);
    const occurrences = current.stores(declaration);
    assert.equal(occurrences.length, 1, `${name}: one original initialization, not an invented extra write`);
    assert.equal(occurrences[0].reason, undefined, `${name}: the exact producer and component correspondence are proven`);
    assert.equal(occurrences[0].value === occurrences[0].storage, true,
      `${name}: the native rest creation retains its own original identity`);
    assert.equal(occurrences[0].birth !== undefined && Object.isFrozen(occurrences[0].birth) &&
      occurrences[0].birth.every(component => Object.isFrozen(component) && component.destination.node === declaration), true,
      `${name}: the producer publishes the immutable checked original-birth component mapping`);
    const origins = query.closedOriginsFor(selected.subject);
    assert.equal(origins.kind, "complete", `${name}: original creation is not an empty recursive relation`);
    assert.equal(origins.origins.length === 1 && origins.origins[0].subject === selected.subject, true,
      `${name}: the original creation is the unique complete value producer`);
    const original = occurrences[0];
    const rows = 11 + 3 * original.birth.length;
    const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, maximumTransportRows: rows });
    assert.equal(budget.row(), true, `${name}: exactly one canonical birth record no longer fits`);
    const inventory = createSourceStorageStoredValues(ast, budget, current.transport.regions.enclosing, () => undefined);
    inventory.recordWrite(original.storage, original);
    assert.equal(budget.failure(), "Source storage transport exceeds its finite transport-row budget.",
      `${name}: original component mappings reserve every retained cell before insertion`);
    assert.equal(inventory.storesFor(original.storage) === undefined && inventory.storesIn(original.region) === undefined, true,
      `${name}: a failed birth reservation never publishes either store index`);
  }
  const rest = current.transport.subjectFor(binding("rest"));
  const secondField = current.transport.visitedNodes.find(node => ast.is.IsPropertySignatureDeclaration(node) && ast.text(ast.name(node)) === "second");
  const firstField = current.transport.visitedNodes.find(node => ast.is.IsPropertySignatureDeclaration(node) && ast.text(ast.name(node)) === "first");
  const remaining = current.transport.subject(rest.node, rest.kind, [{ kind: "member", declaration: secondField }]);
  assert.equal(current.transport.incomingFor(remaining).size > 0, true, "the retained field has its checked source-member edge");
  const selectedRest = query.subjectFor(binding("rest"));
  const selectedRemaining = query.subject(selectedRest.subject.node, selectedRest.subject.kind, remaining.projection);
  assert.equal(selectedRemaining.kind, "resolved", "the retained rest member is an exact checked component");
  const retained = query.closedOriginsFor(selectedRemaining.subject);
  const originalSecond = Node_Initializer(ast, current.variable("second"));
  assert.equal(retained.kind === "complete" && retained.origins.length === 1 &&
    retained.origins[0].subject.node === originalSecond, true,
  "the retained rest component has exactly its original checked producer, not its self-value or later incoming edges");
  const excluded = current.transport.subject(rest.node, rest.kind, [{ kind: "member", declaration: firstField }]);
  assert.equal(current.transport.incomingFor(excluded).size, 0, "the removed field is not copied to the original rest value");
  const selectedTail = query.subjectFor(binding("tail"));
  const tailElement = query.subject(selectedTail.subject.node, "value", [{ kind: "tuple-element", index: 0 }]);
  assert.equal(tailElement.kind, "resolved", "the first destination tuple element is checked");
  const tailOrigins = query.closedOriginsFor(tailElement.subject);
  assert.equal(tailOrigins.kind, "complete", "the tuple slice has a correlated component producer");
  const originalLast = Node_Initializer(ast, current.variable("last"));
  assert.equal(tailOrigins.origins.some(origin => origin.subject.node === originalLast), true,
    "destination tuple index zero comes from original index one, not index zero");
  assert.equal(query.failureReason(), undefined, "all rest lookups preserve the completed transport");
});

test("an arbitrary self-assignment cannot forge the producer's original rest birth", () => {
  const current = fixture("const value = {};");
  const declaration = current.variable("value");
  const storage = current.transport.subject(declaration);
  const reference = Node_Initializer(current.source.ast, declaration);
  const budget = createSourceStorageBudget(defaultSourceStorageLimits);
  const inventory = createSourceStorageStoredValues(current.source.ast, budget, current.transport.regions.enclosing, () => undefined);
  inventory.recordWrite(storage, { reference, operation: declaration, kind: "initialization", value: storage, birth: Object.freeze([]),
    values: Object.freeze([Object.freeze({ source: Object.freeze({ kind: "value", expression: reference, projection: Object.freeze([]) }),
      subjects: Object.freeze([storage]), reason: undefined })]) });
  assert.equal(budget.failure(), "An original source rest birth requires its exact checked initialization and projected producer.",
    "only the exact checked producer can admit an original birth");
  assert.equal(inventory.storesFor(storage) === undefined, true, "a forged self-birth never enters the canonical store inventory");
});

test("one store inventory retains exact creator, constructor, method, accessor and helper write regions", () => {
  const current = fixture(`
    class Box {
      value: object = {};
      constructor(token: object) { this.value = token; }
      set(next: object): void { this.value = next; }
      set current(next: object) { this.value = next; }
    }
    function write(box: Box, token: object): void { box.value = token; }
    const initial = {}; const replacement = {}; const box = new Box(initial);
    box.set(replacement); box.current = replacement; write(box, replacement);
  `);
  const { ast } = current.source;
  const field = current.field("value");
  const stores = current.stores(field);
  assert.equal(stores.length === 5, true, "the initializer and four independent write occurrences survive");
  const initializer = Node_Initializer(ast, field);
  const original = stores.find(store => store.kind === "initialization");
  assert.equal(original.reference === initializer && original.operation === field && original.region === initializer, true,
    "an instance initializer is its own region, not the class definition's source-file region");
  for (const store of stores) {
    assert.equal(Object.isFrozen(store), true);
    assert.equal(store.storage === current.transport.subject(field), true);
    assert.equal([...current.transport.storesIn(store.region)].some(candidate => candidate === store), true,
      "the region index references the identical canonical record");
    if (store.kind === "initialization") continue;
    assert.equal(ast.is.IsPropertyAccessExpression(store.reference) && ast.is.IsBinaryExpression(store.operation), true);
    assert.equal(current.transport.regions.enclosing(store.reference) === store.region, true);
    const assignment = ast.as.AsBinaryExpression(store.operation);
    assert.equal(assignment.Left === store.reference && current.transport.subjectFor(assignment.Right) === store.value, true,
      "exact checked destination and RHS are not replaced by the later reader's scope");
    const selection = current.source.semantics.forNode(store.reference).operations.propertyAccess(store.reference);
    assert.equal(current.transport.subjectFor(selection.receiver.expression) === store.receiver, true);
  }
});

test("equal RHS producers retain distinct write occurrences and checked computed receiver aliases", () => {
  const current = fixture(`
    const token = {};
    const box = { value: {} };
    const alias: { value: object } = box;
    box.value = token; alias["value"] = token;
  `);
  const property = current.transport.visitedNodes.find(current.source.ast.is.IsPropertyAssignment);
  const mutations = current.stores(property).filter(store => store.kind === "mutation");
  assert.equal(mutations.length === 2 && mutations[0].reference !== mutations[1].reference, true,
    "equal stored values cannot erase different writer occurrences");
  assert.equal(mutations[0].value !== mutations[1].value && mutations[0].receiver !== mutations[1].receiver, true,
    "separate RHS and receiver reads retain their authored occurrence identity");
  for (const store of mutations) {
    const assignment = current.source.ast.as.AsBinaryExpression(store.operation);
    const receiver = current.source.ast.as.AsPropertyAccessExpression(store.reference)?.Expression ??
      current.source.ast.as.AsElementAccessExpression(store.reference)?.Expression;
    assert.equal(store.value?.node === assignment.Right && store.receiver?.node === receiver, true,
      "stored value and receiver are the exact checked reads, not reconstructed declarations");
    const inputs = current.transport.incomingFor(store.value);
    assert.equal(inputs.size === 1 && inputs.has(current.transport.subject(current.variable("token"))), true,
      "both read occurrences retain the identical producer declaration");
    const owner = current.source.ast.is.IsPropertyAccessExpression(store.reference) ? "box" : "alias";
    const receivers = current.transport.incomingFor(store.receiver);
    assert.equal(receivers.size === 1 && receivers.has(current.transport.subject(current.variable(owner))), true,
      "structural reconciliation retains each exact authored receiver alias");
  }
});

test("constructor parameter-property initialization uses its actual formal in the constructor region", () => {
  const current = fixture(`class Box { constructor(public value: object = {}) {} } const box = new Box();`);
  const parameter = current.declaration("value", current.source.ast.is.IsParameterDeclaration);
  const stores = current.stores(parameter, "member");
  const constructor = current.source.ast.parent(parameter);
  assert.equal(stores.length === 1 && stores[0].kind === "initialization", true);
  assert.equal(stores[0].reference === parameter && stores[0].operation === parameter &&
    stores[0].storage === current.transport.subject(parameter, "member") &&
    stores[0].value === current.transport.subject(parameter, "input") && stores[0].region === current.source.ast.body(constructor), true,
  "the physical property receives the selected argument/default formal, not an unconditional default initializer");
});

test("store indexing does not invent execution of uninvoked bodies or ambient declaration storage", () => {
  const current = fixture(`
    declare class Native { readonly value: object; }
    function unused(box: { value: object }, token: object): void { box.value = token; }
    const local = { value: {} };
  `);
  assert.equal(current.stores(current.field("value")).length === 0, true, "ambient storage has no authored stores");
  const unused = current.declaration("unused", current.source.ast.is.IsFunctionDeclaration);
  const body = current.source.ast.body(unused);
  const stores = [...current.transport.storesIn(body) ?? []];
  assert.equal(stores.length === 1 && stores[0].kind === "mutation" && stores[0].region === body, true,
    "checked writer evidence survives even before its formal receiver has a selected invocation");
  const property = current.transport.visitedNodes.find(current.source.ast.is.IsPropertyAssignment);
  assert.equal(stores[0].storage !== current.transport.subject(property), true,
    "an uninstantiated formal destination is not guessed to be a local physical member");
  assert.equal(current.transport.storedInputsFor(stores[0].storage) === undefined, true,
    "a checked writer view does not manufacture initialized authored storage");
  assert.equal(current.stores(property).every(store => store.kind === "initialization"), true);
});

test("store rows reserve canonical records and both indexes before insertion and preserve sticky failure", () => {
  const current = fixture("const original = {}; const value = original;");
  const node = current.variable("value");
  const storage = current.transport.subject(node);
  const occurrence = Node_Initializer(current.source.ast, node);
  const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, maximumTransportRows: 11 });
  assert.equal(budget.row(), true, "an independent live row leaves insufficient capacity for the complete store and indexes");
  const inventory = createSourceStorageStoredValues(current.source.ast, budget, current.transport.regions.enclosing, () => undefined);
  inventory.initialize(storage, occurrence, current.transport.subjectFor(occurrence));
  assert.match(budget.failure(), /transport-row/u);
  assert.equal(budget.failure(), "Source storage transport exceeds its finite transport-row budget.",
    "the same eleven-row record refuses atomically when only ten rows remain");
  assert.equal(inventory.storesFor(storage) === undefined, true, "no partial canonical record or empty location index is installed");
  assert.equal(inventory.storesIn(current.transport.regions.enclosing(occurrence)) === undefined, true);
  inventory.initialize(storage, occurrence, current.transport.subjectFor(occurrence));
  assert.equal([...inventory.storesFor(storage) ?? []].length === 0, true, "failed owners cannot resume insertion");
});

test("the identical eleven-row store refuses an individually oversized capacity of ten without publishing any index", () => {
  const current = fixture("const original = {}; const value = original;");
  const node = current.variable("value");
  const storage = current.transport.subject(node);
  const occurrence = Node_Initializer(current.source.ast, node);
  const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, maximumTransportRows: 10 });
  const inventory = createSourceStorageStoredValues(current.source.ast, budget, current.transport.regions.enclosing, () => undefined);
  inventory.initialize(storage, occurrence, current.transport.subjectFor(occurrence));
  assert.equal(budget.failure(), "Source storage rows require a live owner and a finite positive reservation.",
    "the exact original individually-oversized reservation refusal remains authoritative");
  assert.equal(inventory.storesFor(storage) === undefined &&
    inventory.storesIn(current.transport.regions.enclosing(occurrence)) === undefined, true,
    "no canonical record or secondary index is partially retained");
  inventory.initialize(storage, occurrence, current.transport.subjectFor(occurrence));
  assert.equal([...inventory.storesFor(storage) ?? []].length === 0, true, "the exhausted owner cannot publish on retry");
});

test("parameter binding writes are distinct from the constructor's physical member initialization and member writes", () => {
  for (const memberWrite of [false, true]) {
    const current = fixture(`
      class Box { constructor(public readonly value: object, other: object) {
        value = other; ${memberWrite ? "this.value = other;" : ""}
      } }
      const original = {}; const replacement = {}; const box = new Box(original, replacement);
    `);
    const parameter = current.declaration("value", current.source.ast.is.IsParameterDeclaration);
    const stores = current.stores(parameter, "member");
    const bindings = current.stores(parameter, "value");
    const binding = bindings.find(store => store.kind === "mutation" && store.destination === "binding");
    assert.equal(binding !== undefined && current.source.ast.is.IsIdentifier(binding.reference), true,
      "rebinding the local parameter remains genuine checked writer evidence");
    assert.equal(bindings.length === 1 && binding.storage !== stores[0].storage &&
      stores[0].value === current.transport.subject(parameter, "input"), true,
    "entry, mutable local binding and physical member retain three exact identities at the same source declaration");
    const physical = [...current.transport.storedInputsFor(current.transport.subject(parameter, "member"))];
    assert.equal(physical.length === (memberWrite ? 2 : 1), true,
      "only physical member initialization and actual this.member writes enter the field producer inventory");
    assert.equal(stores.filter(store => store.destination === "member").length === physical.length, true);
  }
});

test("assignment-pattern properties and abstract declarations do not create authored physical initializations", () => {
  const current = fixture(`
    let item = {}; ({ item } = { item: {} });
    abstract class Base { abstract value: object; }
  `);
  const shorthand = current.transport.visitedNodes.find(current.source.ast.is.IsShorthandPropertyAssignment);
  assert.equal(current.stores(shorthand).length === 0 && current.stores(current.field("value")).length === 0, true);
  const stores = current.stores(current.variable("item"));
  const mutation = stores.find(store => store.kind === "mutation");
  assert.equal(mutation !== undefined && mutation.reason === undefined && mutation.values.length === 1 &&
    mutation.values[0].source.projection[0] === shorthand && mutation.values[0].subjects.length === 1 &&
    mutation.values[0].subjects[0].projection[0].kind === "member", true,
  "destructuring retains the exact checked selected component without fabricating an object slot");
  assert.equal(stores.filter(store => store.kind === "initialization").length === 1, true,
    "the actual variable initialization remains, but the assignment pattern creates no second object slot");
});

test("published write selections keep each nested input and default projection at its original occurrence", () => {
  const current = fixture(`
    const first = {}; const second = {}; const fallback = {};
    let source: { nested?: { value?: object } } = { nested: { value: first } };
    const outer = { value: second };
    let { nested: { value = fallback } = outer } = source;
    ({ nested: { value = fallback } = outer } = source);
    const rows: [object?][] = [[first], [second]];
    for (const [item = fallback] of rows) void item;
  `);
  const { ast } = current.source;
  const binding = current.transport.visitedNodes.find(node => ast.is.IsBindingElement(node) &&
    ast.is.IsIdentifier(ast.name(node)) && ast.text(ast.name(node)) === "value");
  const selected = current.transport.subjectFor(binding);
  assert.equal(selected.node === binding && selected.projection.length === 0, true,
    "a mutable destructured binding is not the original owner's component storage");
  const stores = [...current.transport.storesFor(selected)];
  assert.equal(stores.length === 2 && stores[0].reference !== stores[1].reference &&
    stores.every(store => store.reason === undefined && store.values.length === 3), true,
  "initialization and mutation each retain all original checked alternatives without RHS identity filtering");
  for (const store of stores) {
    assert.deepEqual(store.values.map(value => ast.text(value.source.expression)), ["source", "outer", "fallback"]);
    assert.deepEqual(store.values.map(value => value.source.projection.length), [2, 1, 0]);
    assert.equal(store.values.every(value => value.reason === undefined && value.subjects.length > 0 &&
      Object.isFrozen(value) && Object.isFrozen(value.subjects)), true, "every alternative has its exact immutable selected subjects");
    const published = current.transport.writeAt(store.reference);
    assert.equal(published.values === store.values && published.destinations.includes(selected) && Object.isFrozen(published), true,
      "the canonical published record preserves original selection and exact destination identity");
  }
  const item = current.transport.visitedNodes.find(node => ast.is.IsBindingElement(node) &&
    ast.is.IsIdentifier(ast.name(node)) && ast.text(ast.name(node)) === "item");
  const iteration = [...current.transport.storesFor(current.transport.subjectFor(item))][0];
  assert.equal(iteration.kind === "initialization" && iteration.reason === undefined && iteration.values.length === 2, true,
    "the loop produces its actual element and conditional default once per iteration");
  assert.equal(iteration.values[0].subjects[0].projection.length === 2 &&
    iteration.values[0].subjects[0].projection.every(component => component.kind === "array-element" || component.kind === "tuple-element"), true,
  "iteration selects collection element then tuple component, not the collection or a first-element guess");
});

test("write selections reject forged contexts, foreign nodes, and post-publication mutations", () => {
  const current = fixture("const original = {}; let value = original; value = original;");
  const other = fixture("const original = {}; let value = original; value = original;");
  const query = createSourceStorageQuery(current.source, current.source.navigation.sourceFiles);
  const mutation = current.stores(current.variable("value")).find(store => store.kind === "mutation");
  const selected = query.writeAt(mutation.reference, query.emptyBindings);
  assert.equal(selected.kind === "resolved" && selected.write.reference === mutation.reference &&
    selected.bindings === query.emptyBindings, true, "one exact authored occurrence is paired with the actual query-owned context");
  assert.equal(query.writeAt(mutation.reference, Object.freeze({ ...query.emptyBindings })).kind === "unresolved", true,
    "same-shaped bindings cannot impersonate the canonical context");
  assert.equal(query.writeAt(other.stores(other.variable("value"))[1].reference, query.emptyBindings).kind === "unresolved", true,
    "a foreign checked occurrence cannot impersonate this source program");
  const budget = createSourceStorageBudget(defaultSourceStorageLimits);
  const inventory = createSourceStorageStoredValues(current.source.ast, budget, current.transport.regions.enclosing, () => undefined);
  inventory.initialize(mutation.storage, mutation.reference, mutation.value);
  inventory.publish();
  assert.throws(() => inventory.publish(), /publish exactly once/u);
  assert.throws(() => inventory.initialize(mutation.storage, mutation.reference, mutation.value), /cannot change/u);
});

test("unproven computed destructuring retains its exact unresolved writer rather than claiming an empty loan set", () => {
  const current = fixture(`let value = {}; const source: { [key: string]: object } = {};
    const key: string = "value"; ({ [key]: value } = source);`);
  const mutation = current.stores(current.variable("value")).find(store => store.kind === "mutation");
  assert.equal(mutation !== undefined && mutation.reason !== undefined && mutation.values.length === 1 &&
    mutation.values[0].subjects.length === 0 && mutation.values[0].reason === mutation.reason, true,
  "missing exact checked projection evidence is explicitly unresolved, never a fabricated safe value");
  assert.equal(mutation.reason,
    "Source storage writes require their exact checked original value producer, iteration element and component projection.",
    "the missing computed projection retains its exact producer refusal");
});

test("receiver resolution failure cannot publish a store or either secondary index", () => {
  const current = fixture("const box = { value: {} }; box.value = {};");
  const reference = current.transport.visitedNodes.find(current.source.ast.is.IsPropertyAccessExpression);
  const storage = current.transport.subjectFor(reference);
  const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, maximumSteps: 1 });
  const inventory = createSourceStorageStoredValues(current.source.ast, budget, current.transport.regions.enclosing,
    () => { budget.step(); return undefined; });
  const write = { reference, operation: current.source.ast.parent(reference), kind: "mutation", value: storage,
    values: Object.freeze([{ source: undefined, subjects: Object.freeze([storage]), reason: undefined }]) };
  inventory.recordWrite(storage, write);
  assert.match(budget.failure(), /analysis-work/u);
  assert.equal(inventory.storesFor(storage) === undefined &&
    inventory.storesIn(current.transport.regions.enclosing(reference)) === undefined, true,
  "failed dependency resolution precedes every canonical record and index insertion");
});

test("physical producer values and rejection reasons use the identical member-versus-binding projection", () => {
  for (const memberWrite of [false, true]) {
    const current = fixture(`
      class Box { constructor(public value: object, replacements: object[]) {
        for (${memberWrite ? "this.value" : "value"} of replacements) {}
      } }
      const box = new Box({}, [{}]);
    `);
    const parameter = current.declaration("value", current.source.ast.is.IsParameterDeclaration);
    const storage = current.transport.subject(parameter, "member");
    const stores = current.stores(parameter, memberWrite ? "member" : "value");
    assert.equal(stores.some(store => store.kind === "mutation" && store.reason === undefined &&
      store.values.length === 1 && store.values[0].source.kind === "iteration-value" &&
      store.values[0].subjects.length === 1 && store.values[0].subjects[0].projection[0]?.kind === "array-element"), true,
    "the identical original iteration writer carries its checked element rather than the collection");
    const reason = current.transport.unresolvedStoredInputsFor(storage);
    assert.equal(reason === undefined, true,
      "only an actual member writer can poison its physical producer evidence");
    const physical = [...current.transport.storedInputsFor(storage)];
    assert.equal(physical.length === (memberWrite ? 2 : 1) &&
      physical.includes(current.transport.subject(parameter, "input")), true,
      "the initialization remains exact and only an actual member write adds the checked iteration element");
  }
});

test("unproven iteration-key writers retain exact refusal without confusing local and physical member storage", () => {
  const expected = "Source storage writes require their exact checked original value producer, iteration element and component projection.";
  for (const memberWrite of [false, true]) {
    const current = fixture(`
      class Box { constructor(public value: string, replacements: object) {
        for (${memberWrite ? "this.value" : "value"} in replacements) {}
      } }
      const box = new Box("", {});
    `);
    const parameter = current.declaration("value", current.source.ast.is.IsParameterDeclaration);
    const mutation = current.stores(parameter, memberWrite ? "member" : "value").find(store => store.kind === "mutation");
    assert.equal(mutation?.reason, expected, "the still-unproven key producer is refused at the canonical occurrence");
    assert.equal(mutation.values.length === 1 && mutation.values[0].source.kind === "iteration-key" &&
      mutation.values[0].subjects.length === 0 && mutation.values[0].reason === expected, true,
      "the original checked key occurrence remains explicit rather than fabricating a value");
    const physical = current.transport.subject(parameter, "member");
    assert.equal(current.transport.unresolvedStoredInputsFor(physical), memberWrite ? expected : undefined,
      "only the actual physical member writer contributes its refusal");
    const inputs = [...current.transport.storedInputsFor(physical)];
    assert.equal(inputs.length === 1 && inputs[0] === current.transport.subject(parameter, "input"), true,
      "the exact real initialization is retained independently of the unsupported writer");
  }
});

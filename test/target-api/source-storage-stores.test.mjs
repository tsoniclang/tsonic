import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles } from "@tsonic/tsts";
import { createTargetSourceProgram, Node_Initializer } from "../../packages/target-api/dist/public/source.js";
import { createSourceStorageTransport } from "../../packages/target-api/dist/target-analysis/source-storage/transport.js";
import { createSourceStorageStoredValues } from "../../packages/target-api/dist/target-analysis/source-storage/stored-values.js";
import { createSourceStorageBudget, defaultSourceStorageLimits } from "../../packages/target-api/dist/target-analysis/source-storage/resource-budget.js";

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
  const stores = node => [...transport.storedValuesFor(transport.subject(node)) ?? []];
  return { source, budget, transport, declaration, field, variable, stores };
}

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
  assert.equal(mutations.every(store => store.value === current.transport.subject(current.variable("token"))), true);
  assert.equal(mutations.some(store => store.receiver === current.transport.subject(current.variable("box"))) &&
    mutations.some(store => store.receiver === current.transport.subject(current.variable("alias"))), true,
  "structural reconciliation retains each occurrence's selected receiver, not only the physical member");
});

test("constructor parameter-property initialization uses its actual formal in the constructor region", () => {
  const current = fixture(`class Box { constructor(public value: object = {}) {} } const box = new Box();`);
  const parameter = current.declaration("value", current.source.ast.is.IsParameterDeclaration);
  const stores = current.stores(parameter);
  const constructor = current.source.ast.parent(parameter);
  assert.equal(stores.length === 1 && stores[0].kind === "initialization", true);
  assert.equal(stores[0].reference === parameter && stores[0].operation === parameter &&
    stores[0].value === current.transport.subject(parameter) && stores[0].region === current.source.ast.body(constructor), true,
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
  const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, maximumTransportRows: 6 });
  assert.equal(budget.row(), true, "an independent live row leaves insufficient capacity for the complete store and indexes");
  const inventory = createSourceStorageStoredValues(current.source.ast, budget, current.transport.regions.enclosing, () => undefined);
  inventory.initialize(storage, occurrence, current.transport.subjectFor(occurrence));
  assert.match(budget.failure(), /transport-row/u);
  assert.equal(inventory.storesFor(storage) === undefined, true, "no partial canonical record or empty location index is installed");
  assert.equal(inventory.storesIn(current.transport.regions.enclosing(occurrence)) === undefined, true);
  inventory.initialize(storage, occurrence, current.transport.subjectFor(occurrence));
  assert.equal([...inventory.storesFor(storage) ?? []].length === 0, true, "failed owners cannot resume insertion");
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
    const stores = current.stores(parameter);
    const binding = stores.find(store => store.kind === "mutation" && store.destination === "binding");
    assert.equal(binding !== undefined && current.source.ast.is.IsIdentifier(binding.reference), true,
      "rebinding the local parameter remains genuine checked writer evidence");
    const physical = [...current.transport.storedInputsFor(current.transport.subject(parameter))];
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
  assert.equal(stores.some(store => store.kind === "mutation" && store.reason?.includes("component producer")), true,
    "unsupported destructuring retains its exact unresolved component evidence, never a fabricated value");
  assert.equal(stores.filter(store => store.kind === "initialization").length === 1, true,
    "the actual variable initialization remains, but the assignment pattern creates no second object slot");
});

test("receiver resolution failure cannot publish a store or either secondary index", () => {
  const current = fixture("const box = { value: {} }; box.value = {};");
  const reference = current.transport.visitedNodes.find(current.source.ast.is.IsPropertyAccessExpression);
  const storage = current.transport.subjectFor(reference);
  const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, maximumSteps: 1 });
  const inventory = createSourceStorageStoredValues(current.source.ast, budget, current.transport.regions.enclosing,
    () => { budget.step(); return undefined; });
  const write = { reference, operation: current.source.ast.parent(reference), value: storage };
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
    const storage = current.transport.subject(parameter);
    const stores = current.stores(parameter);
    assert.equal(stores.some(store => store.kind === "mutation" && store.reason?.includes("iteration writes")), true,
      "the underlying checked unsupported writer remains in the canonical inventory");
    const reason = current.transport.unresolvedStoredInputsFor(storage);
    assert.equal(memberWrite ? reason?.includes("iteration writes") === true : reason === undefined, true,
      "only an actual member writer can poison its physical producer evidence");
    assert.equal([...current.transport.storedInputsFor(storage)].length === 1, true,
      "both cases retain the exact initialization producer independently of unresolved writer evidence");
  }
});

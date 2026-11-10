import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../../packages/target-api/dist/public/source.js";
import { createSourceStorageQuery, defaultSourceStorageLimits } from "../../packages/target-api/dist/public/analysis.js";
import { namedVariable, projectSourceFile } from "../fixtures/source-navigation.mjs";

function fixture(limits = defaultSourceStorageLimits) {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src",
    compilerOptions: { strict: true, target: "es2022", module: "esnext" }, files: {
      "/src/classes.ts": `
        export function fallback() { return {}; }
        export class Base { base = 1; constructor(value: object = fallback()) {} }
        export class Middle extends Base { middle = 2; }
        export class Derived extends Middle { derived = 3; }
        export class GenericBase<Value> { constructor(public value?: Value) {} }
        export class GenericDerived<Item> extends GenericBase<Item> { other = 4; }
        export class Empty { base = 5; }
        export class ImplicitMiddle extends Empty { middle = 6; }
        export class ImplicitDerived extends ImplicitMiddle { derived = 7; }
      `,
      "/src/external.d.ts": "export declare class External { constructor(value?: object); }",
      "/src/index.ts": `
        import { Base, Middle, Derived, GenericBase, GenericDerived, ImplicitDerived } from "./classes.js";
        import { External } from "./external.js";
        const Alias = Derived; const GenericAlias = GenericDerived;
        const provided = { value: 17 };
        const supplied = new Alias(provided); const omitted = new Derived();
        const generic = new GenericAlias(provided); const empty = new GenericDerived<number>();
        const zero = new ImplicitDerived();
        function forward(value?: object) { return new Derived(value); }
        const forwardedSupplied = forward(provided); const forwardedOmitted = forward();
        function maybe(value?: object) { return forward(value); }
        class NativeDerived extends External { field = 8; }
        const native = new NativeDerived();
        export let changing: typeof Derived = Derived; const mutable = new changing();
        function dynamic(factory: typeof Derived) { return new factory(); }
      `,
    },
  }).checkSource();
  assert.equal(checked.diagnostics.length === 0, true, "actual cross-file inherited and generic construction checks");
  const source = createTargetSourceProgram(checked);
  const storage = createSourceStorageQuery(source, source.navigation.sourceFiles, limits);
  const ast = source.ast;
  const named = name => storage.nodes.find(node => (ast.is.IsClassDeclaration(node) || ast.is.IsFunctionDeclaration(node) ||
    ast.is.IsVariableDeclaration(node)) && ast.text(ast.name(node)) === name);
  const initializer = name => ast.as.AsVariableDeclaration(named(name)).Initializer;
  const constructor = name => ast.members(named(name)).find(ast.is.IsConstructorDeclaration);
  const construction = (name, bindings) => storage.constructionFor(initializer(name), bindings);
  return { source, storage, ast, named, initializer, constructor, construction };
}

function resolved(selected, label) {
  assert.equal(selected.kind === "resolved", true, selected.kind === "unresolved" ? `${label}: ${selected.reason}` : label);
  return selected;
}


function oneConstruction(selected, label) {
  const result = resolved(selected, label);
  assert.equal(result.alternatives.length, 1, label);
  assert.equal(Object.isFrozen(result) && Object.isFrozen(result.alternatives), true, "The finite construction result is sealed.");
  return result.alternatives[0];
}

test("implicit source heritage supplies one checked constructor correspondence and exact original regions", () => {
  const current = fixture();
  for (const name of ["supplied", "omitted"]) {
    const selected = oneConstruction(current.construction(name), name);
    assert.equal(selected.root === current.named("Derived") && selected.allocation === current.initializer(name), true);
    assert.equal(selected.implementation.declaration === current.constructor("Base"), true);
    assert.equal(selected.implementation.body === current.ast.body(current.constructor("Base")), true);
    assert.equal(selected.classes.length === 3 && selected.classes.every((entry, index) =>
      entry.owner === current.named(["Derived", "Middle", "Base"][index])), true, "source lineage, not an execution-order claim");
    for (const entry of selected.classes) {
      const property = current.ast.members(entry.owner).find(current.ast.is.IsPropertyDeclaration);
      assert.equal(entry.regions.length === 1 && entry.regions[0].node === current.ast.as.AsPropertyDeclaration(property).Initializer, true);
      const bindings = resolved(entry.regions[0].selection, "class initializer binding");
      const activations = resolved(current.storage.boundActivationsFor(entry.owner, bindings.bindings), "class activation");
      assert.equal(activations.activations.length === 1 && activations.activations[0].kind === "invocation" &&
        activations.activations[0].invocation === current.initializer(name), true);
    }
    const initializer = current.ast.as.AsParameterDeclaration(current.ast.parameters(current.constructor("Base"))[0]).Initializer;
    assert.equal(selected.implementation.regions.includes(initializer), name === "omitted", "only checked supplied values exclude the inherited default");
    assert.equal(Object.isFrozen(selected) && Object.isFrozen(selected.classes) &&
      selected.classes.every(entry => Object.isFrozen(entry) && Object.isFrozen(entry.regions)) &&
      Object.isFrozen(selected.implementation) && Object.isFrozen(selected.implementation.regions), true);
    for (let repeat = 0; repeat < 12; repeat += 1) assert.equal(oneConstruction(current.construction(name), name) === selected, true, "one memoized checked correspondence");
  }
  assert.equal(current.storage.failureReason() === undefined, true);
});

test("generic inherited aliases preserve supplied values and cannot leak a sibling origin into an omitted formal", () => {
  const current = fixture();
  const constructor = current.constructor("GenericBase");
  const formal = resolved(current.storage.subject(current.ast.parameters(constructor)[0], "input"), "generic formal").subject;
  const supplied = oneConstruction(current.construction("generic"), "supplied generic");
  const omitted = oneConstruction(current.construction("empty"), "omitted generic");
  const suppliedBinding = resolved(supplied.implementation.selection, "supplied generic binding").bindings;
  const omittedBinding = resolved(omitted.implementation.selection, "omitted generic binding").bindings;
  const actual = resolved(current.storage.boundOriginsFor(formal, suppliedBinding), "supplied generic origins");
  const empty = resolved(current.storage.boundOriginsFor(formal, omittedBinding), "omitted generic origins");
  assert.equal(supplied.implementation.declaration === constructor && omitted.implementation.declaration === constructor, true);
  assert.equal(actual.subjects.length === 1 && actual.subjects[0].node === current.initializer("provided"), true);
  assert.equal(empty.subjects.length === 1 && empty.subjects[0] === formal, true, "real omitted input leaf, not the sibling supplied object");
  assert.equal(empty.subjects.some(subject => subject.node === current.initializer("provided")), false);
  assert.equal(suppliedBinding !== omittedBinding, true, "identical inherited formals retain distinct actual invocation frames");
  for (const [name, bindings] of [["generic", suppliedBinding], ["empty", omittedBinding]]) {
    const activation = resolved(current.storage.boundActivationsFor(constructor, bindings), name);
    assert.equal(activation.activations.length === 1 && activation.activations[0].kind === "invocation" &&
      activation.activations[0].invocation === current.initializer(name), true);
  }
  assert.equal(current.storage.failureReason() === undefined, true);
});

test("forwarded actual caller substitutions select inherited defaults without replacing the caller with the callee frame", () => {
  const current = fixture();
  const inner = current.storage.invocations.find(node => current.ast.is.IsNewExpression(node) &&
    current.ast.text(current.ast.as.AsNewExpression(node).Expression) === "Derived" && current.ast.arguments(node).length === 1);
  const initializer = current.ast.as.AsParameterDeclaration(current.ast.parameters(current.constructor("Base"))[0]).Initializer;
  for (const [name, included] of [["forwardedSupplied", false], ["forwardedOmitted", true]]) {
    const caller = resolved(current.storage.bindingsForInvocation(current.named("forward"), current.initializer(name)), name);
    const selected = oneConstruction(current.storage.constructionFor(inner, caller.bindings), name);
    assert.equal(selected.implementation.regions.includes(initializer), included, name);
    assert.equal(oneConstruction(current.storage.constructionFor(inner, caller.bindings), name) === selected, true);
  }
  const generic = oneConstruction(current.storage.constructionFor(inner), "unspecialized caller");
  assert.equal(generic.implementation.regions.includes(initializer), true);
  assert.equal(current.storage.failureReason() === undefined, true);
});

test("a wholly implicit source lineage supplies original class roots without fabricating a constructor body", () => {
  const current = fixture();
  const selected = oneConstruction(current.construction("zero"), "zero-body source lineage");
  assert.equal(selected.implementation === undefined, true);
  assert.equal(selected.root === current.named("ImplicitDerived"), true);
  assert.equal(selected.classes.length === 3 && selected.classes.every((entry, index) =>
    entry.owner === current.named(["ImplicitDerived", "ImplicitMiddle", "Empty"][index])), true);
  assert.equal(selected.classes.every(entry => entry.regions.length === 1 && entry.regions[0].selection.kind === "resolved"), true);
});

test("construction correspondence rejects foreign identities, dynamic class values and missing native bodies", () => {
  const current = fixture();
  const foreign = fixture();
  for (const [call, bindings] of [
    [foreign.initializer("supplied"), current.storage.emptyBindings],
    [current.initializer("supplied"), foreign.storage.emptyBindings],
    [current.initializer("supplied"), { ...current.storage.emptyBindings }],
    [current.initializer("forwardedOmitted"), current.storage.emptyBindings],
  ]) assert.equal(current.storage.constructionFor(call, bindings).kind, "unresolved", "exact source invocation and canonical bindings are required");
  for (const name of ["native", "mutable"]) {
    const selected = current.construction(name);
    assert.equal(selected.kind, "unresolved", name);
    if (name === "native") assert.match(selected.reason, /native body/u);
  }
  const dynamic = current.storage.invocations.find(node => current.ast.is.IsNewExpression(node) &&
    current.ast.text(current.ast.as.AsNewExpression(node).Expression) === "factory");
  assert.equal(current.storage.constructionFor(dynamic).kind, "unresolved", "a formal constructor signature is not a checked class value");
});

test("source construction cannot publish partial correspondence after its finite work or retained-data guard fails", () => {
  for (const limits of [{ maximumSteps: 1 }, { maximumTransportRows: 1 }]) {
    const current = fixture({ ...defaultSourceStorageLimits, ...limits });
    const invocation = namedVariable(current.ast, projectSourceFile(current.source, "index.ts"), "supplied");
    const call = current.ast.as.AsVariableDeclaration(invocation).Initializer;
    assert.equal(current.storage.constructionFor(call).kind, "unresolved");
    assert.equal(current.storage.failureReason() !== undefined, true);
    assert.equal(current.storage.constructionFor(call).kind, "unresolved", "a failed owner stays failed");
  }
});

for (const reverse of [false, true]) test(`recursive explicit super initializers retain only their actual allocation, reverse=${reverse}`, () => {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src",
    compilerOptions: { strict: true, target: "es2022", module: "esnext" }, files: {
      "/src/index.ts": `
        class Base { base = 1;
          constructor(value: number, count: number) {
            if (count > 0) { new Left(11, count - 1); new Right(22, count - 1); }
          }
        }
        class Left extends Base { left = 2; constructor(value: number, count: number) { super(value, count); } }
        class Right extends Base { right = 3; constructor(value: number, count: number) { super(value, count); } }
        const instance = new Base(0, 2);
      `,
    },
  }).checkSource();
  assert.equal(checked.diagnostics.length === 0, true, "The original recursive explicit constructors are checked source.");
  const source = createTargetSourceProgram(checked);
  const storage = createSourceStorageQuery(source, source.sourceFiles);
  const { ast } = source;
  const named = name => storage.nodes.find(node => ast.is.IsClassDeclaration(node) && ast.text(ast.name(node)) === name);
  const constructor = name => ast.members(named(name)).find(ast.is.IsConstructorDeclaration);
  const allocation = name => storage.invocations.find(node => ast.is.IsNewExpression(node) &&
    ast.text(ast.as.AsNewExpression(node).Expression) === name);
  const root = oneConstruction(storage.constructionFor(allocation("Base")), "actual recursive entry");
  const names = reverse ? ["Right", "Left"] : ["Left", "Right"];
  for (const name of names) {
    const entry = oneConstruction(storage.constructionFor(allocation(name), root.implementation.selection.bindings), name);
    const invocation = storage.invocations.find(node => ast.is.IsCallExpression(node) &&
      ast.kindName(ast.as.AsCallExpression(node).Expression) === "KindSuperKeyword" &&
      storage.enclosingRegionFor(node) === ast.body(constructor(name)));
    assert.equal(invocation !== undefined, true, `${name}: the original checked super call exists.`);
    const selected = oneConstruction(storage.constructionFor(invocation, entry.implementation.selection.bindings), name);
    assert.equal(selected.allocation === allocation(name) && selected.root === named("Base"), true,
      `${name}: a parametric constructor receiver retains its actual New origin, never a sibling or the first SCC frame.`);
    assert.equal(selected.classes.length === 1 && selected.classes[0].owner === named("Base"), true,
      `${name}: only this checked base initializer domain is selected.`);
    const region = selected.classes[0].regions[0];
    const activations = resolved(storage.boundActivationsFor(named("Base"), region.selection.bindings), name);
    assert.equal(activations.activations.length === 1 && activations.activations[0].kind === "invocation" &&
      activations.activations[0].invocation === allocation(name), true, `${name}: initializer allocation identity stays exact.`);
  }
  assert.equal(storage.failureReason() === undefined, true, "Both query orders use the same finite correlated equations.");
});

for (const body of [false, true]) for (const reverse of [false, true]) {
  test(`same-constructor recursive super entries retain their actual captures and arguments, body=${body}, reverse=${reverse}`, () => {
    const checked = createCompilerSessionFromFiles({ currentDirectory: "/src",
      compilerOptions: { strict: true, target: "es2022", module: "esnext" }, files: {
        "/src/index.ts": `
          interface Holder { readonly fromBase: number; }
          type HolderConstructor = new (value: number, count: number) => Holder;
          function makeBase(lease: number) {
            return class Base {
              readonly fromBase = lease;
              ${body ? "readonly fromBody: number; readonly argument: number;" : ""}
              constructor(value: number, count: number) {
                ${body ? "this.fromBody = lease; this.argument = value;" : ""}
                if (count > 0) new Second(${body ? "7" : "value"}, count - 1);
              }
            };
          }
          function makeDerived(Parent: HolderConstructor) {
            return class Derived extends Parent {
              constructor(value: number, count: number) { super(value, count); }
            };
          }
          const BaseA = makeBase(11);
          const BaseB = makeBase(22);
          const First = makeDerived(BaseA);
          const Second = makeDerived(BaseB);
          const instance = new First(0, 2);
          const actual = instance.fromBase;
          if (actual !== 11) throw new Error("The first allocation must retain its own BaseA capture.");
        `,
      },
    }).checkSource();
    assert.equal(checked.diagnostics.length === 0, true, "The actual independently reviewed captured-base program checks.");
    const source = createTargetSourceProgram(checked);
    const storage = createSourceStorageQuery(source, source.sourceFiles);
    const { ast } = source;
    const allocation = name => storage.invocations.find(node => ast.is.IsNewExpression(node) &&
      ast.text(ast.as.AsNewExpression(node).Expression) === name);
    const superCall = storage.invocations.find(node => ast.is.IsCallExpression(node) &&
      ast.kindName(ast.as.AsCallExpression(node).Expression) === "KindSuperKeyword");
    const first = oneConstruction(storage.constructionFor(allocation("First")), "actual First entry");
    const firstBase = oneConstruction(storage.constructionFor(superCall, first.implementation.selection.bindings), "actual BaseA super entry");
    const second = oneConstruction(storage.constructionFor(allocation("Second"), firstBase.implementation.selection.bindings), "actual nested Second entry");
    const secondBase = oneConstruction(storage.constructionFor(superCall, second.implementation.selection.bindings), "actual BaseB super entry");
    assert.equal(firstBase.root === secondBase.root && firstBase.implementation.declaration === secondBase.implementation.declaration, true,
      "The two selected captures belong to the identical source class and constructor, not different nominal ASTs.");
    const observe = (selection, expected, expectedArgument, expectedAllocation) => {
      assert.equal(selection.allocation === expectedAllocation, true, "Actual constructor entry and receiver allocation remain one relation.");
      const property = ast.members(selection.root).find(node => node !== undefined && ast.is.IsPropertyDeclaration(node) &&
        ast.text(ast.name(node)) === "fromBase");
      const initializer = property === undefined ? undefined : ast.as.AsPropertyDeclaration(property).Initializer;
      assert.equal(initializer !== undefined && selection.classes.length === 1 && selection.classes[0].owner === selection.root &&
        selection.classes[0].regions.length === 1 && selection.classes[0].regions[0].node === initializer, true,
      "Exactly the original Base/fromBase initializer is required; an empty class or region list is not a passing proof.");
      for (const selectedClass of selection.classes) for (const region of selectedClass.regions) {
        const subject = resolved(storage.subjectFor(region.node), "actual captured field initializer");
        const producers = storage.storageProducersFor(subject.subject, region.selection.bindings);
        assert.equal(producers.kind === "complete" && producers.producers.length === 1 &&
          ast.is.IsNumericLiteral(producers.producers[0].subject.node) && ast.text(producers.producers[0].subject.node) === expected, true,
        `Captured initializer keeps only ${expected}, not the other actual base's payload.`);
      }
      if (!body) return;
      const constructor = selection.implementation.declaration;
      for (const [name, expectedValue] of [["lease", expected], ["value", expectedArgument]]) {
        const assignment = storage.nodes.find(node => ast.is.IsBinaryExpression(node) &&
          ast.is.IsIdentifier(ast.as.AsBinaryExpression(node).Right) && ast.text(ast.as.AsBinaryExpression(node).Right) === name &&
          storage.enclosingRegionFor(node) === ast.body(constructor));
        assert.equal(assignment !== undefined, true, `${name}: the original constructor-body assignment exists.`);
        const subject = resolved(storage.subjectFor(ast.as.AsBinaryExpression(assignment).Right), `${name}: actual body read`);
        const producers = storage.storageProducersFor(subject.subject, selection.implementation.selection.bindings);
        assert.equal(producers.kind === "complete" && producers.producers.length === 1 &&
          ast.is.IsNumericLiteral(producers.producers[0].subject.node) && ast.text(producers.producers[0].subject.node) === expectedValue, true,
        `${name}: the body retains ${expectedValue} from this actual capture/argument pair, never a sibling.`);
      }
    };
    const entries = [[firstBase, "11", "0", allocation("First")], [secondBase, "22", "7", allocation("Second")]];
    for (const entry of reverse ? entries.reverse() : entries) observe(...entry);
    assert.equal(storage.failureReason() === undefined, true, "Same-equation entry selection closes without a larger key, ancestry unrolling or budget increase.");
  });
}

test("finite factory and copied conditional class values preserve each Base and Derived captured environment", () => {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: { "/src/index.ts": `
    export {}; declare const flag: boolean;
    interface Shape { base: number; }
    type Constructor = new (input?: number) => Shape;
    function makeBase(value: number) {
      return class Base { base = value; constructor(input?: number) {} };
    }
    function makeDerived(Parent: Constructor, value: number) {
      return class Derived extends Parent { derived = value; };
    }
    const first = makeDerived(makeBase(1), 2); const second = makeDerived(makeBase(3), 4);
    const copied = first; const Chosen = flag ? copied : second; const instance = new Chosen();
  ` }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length, 0);
  const source = createTargetSourceProgram(checked);
  const storage = createSourceStorageQuery(source, source.sourceFiles);
  const instance = storage.nodes.find(node => source.ast.is.IsVariableDeclaration(node) && source.ast.text(source.ast.name(node)) === "instance");
  const invocation = source.ast.as.AsVariableDeclaration(instance).Initializer;
  const selected = resolved(storage.constructionFor(invocation), "the finite selected source class domain");
  assert.equal(selected.alternatives.length, 2, "Two actual factory activations of one Derived AST stay distinct.");
  const pairs = new Set();
  for (const alternative of selected.alternatives) {
    assert.equal(alternative.classes.length, 2, "The inherited implemented Base and Derived initializer owners are both retained.");
    const values = new Map();
    for (const owner of alternative.classes) {
      assert.equal(owner.regions.length, 1, "One original initializer belongs to each class.");
      const region = owner.regions[0];
      const subject = resolved(storage.subjectFor(region.node), "the actual original initializer");
      const origins = storage.storageProducersFor(subject.subject, region.selection.bindings);
      assert.equal(origins.kind === "complete" && origins.producers.length === 1, true,
        "An initializer uses exactly its selected factory activation, never the sibling or subclass scope.");
      if (origins.kind !== "complete") return;
      values.set(source.ast.text(source.ast.name(owner.owner)), source.ast.text(origins.producers[0].subject.node));
    }
    pairs.add(`${values.get("Base")}/${values.get("Derived")}`);
  }
  assert.equal(pairs.size === 2 && pairs.has("1/2") && pairs.has("3/4"), true,
    "Only the two actual Base/Derived factory pairs are admitted; no cross-product or origin-only merge.");
  assert.equal(storage.constructionFor(invocation) === selected, true, "Alternative identity is owned by the existing sealed construction cache.");
  assert.equal(storage.failureReason() === undefined, true, "The existing graph budget closes the finite class domain.");
});

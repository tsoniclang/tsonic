import assert from "node:assert/strict";
import test from "node:test";
import { createTargetSourceProgram } from "../../packages/target-api/dist/public/source.js";
import { createSourceErrorStorageDemandQuery, createSourceStorageQuery, defaultSourceStorageLimits } from "../../packages/target-api/dist/public/analysis.js";
import { checkedSource, namedDeclaration, namedVariable, projectSourceFile, requiredNode, requiredStorageSubject } from "../fixtures/source-navigation.mjs";

const globals = `
interface Object {} interface Function {} interface CallableFunction extends Function {}
interface NewableFunction extends Function {} interface IArguments {} interface Boolean {}
interface Number {} interface String {} interface RegExp {} interface Array<T> { [index: number]: T; }
`;

async function analyzed(name, body, limits = defaultSourceStorageLimits) {
  const checked = await checkedSource(name, {
    "globals.d.ts": globals,
    "src/index.ts": `
      export {};
      interface Stored { message: string; }
      declare function opaque(value: Stored): string;
      ${body}
    `,
  });
  assert.equal(checked.diagnostics.length === 0, true, `${name}: checked source`);
  const source = createTargetSourceProgram(checked);
  const file = projectSourceFile(source, "src/index.ts");
  const stored = namedDeclaration(source.ast, file, "Stored");
  const field = source.ast.members(stored)[0];
  const storage = createSourceStorageQuery(source, source.navigation.sourceFiles, limits);
  const demand = createSourceErrorStorageDemandQuery(source, { fields: [field], constructors: [], stackCaptures: [],
    storageMutators: [], retention: () => ({ kind: "ordinary" }) }, storage);
  const variable = name => namedVariable(source.ast, file, name);
  const declaration = name => namedDeclaration(source.ast, file, name);
  const call = name => requiredNode(source.ast, file, node => {
    if (!source.ast.is.IsCallExpression(node)) return false;
    const expression = source.ast.as.AsCallExpression(node).Expression;
    if (source.ast.is.IsIdentifier(expression)) return source.ast.text(expression) === name;
    const access = source.ast.as.AsPropertyAccessExpression(expression);
    return access !== undefined && source.ast.is.IsIdentifier(access.Expression) &&
      `${source.ast.text(access.Expression)}.${source.ast.text(source.ast.name(expression))}` === name;
  });
  const write = name => requiredNode(source.ast, file, node => {
    if (!source.ast.is.IsBinaryExpression(node)) return false;
    const left = source.ast.as.AsBinaryExpression(node).Left;
    const selected = source.ast.as.AsPropertyAccessExpression(left);
    return selected !== undefined && source.ast.is.IsIdentifier(selected.Expression) &&
      source.ast.text(selected.Expression) === name && source.ast.text(source.ast.name(left)) === "message";
  });
  return { source, storage, demand, variable, declaration, call, write };
}

test("external Error formals do not prove mutation or opaque-call disjointness from separate observed inputs", async () => {
  const current = await analyzed("error-origin-public-formals", `
    export function inspect(owner: Stored, other: Stored): string {
      other.message = "changed";
      opaque(other);
      return owner.message;
    }
    const left = { message: "left" };
    const right = { message: "right" };
    inspect(left, right);
  `);
  const owner = current.source.ast.parameters(current.declaration("inspect"))[0];
  const domain = current.demand.closedStorageOriginsFor(requiredStorageSubject(current.storage, owner));
  assert.equal(domain.kind === "open", true, "public formal has an external admission boundary");
  assert.equal(domain.boundaries.some(boundary => boundary.kind === "external-input"), true);
  for (const expression of [current.write("other"), current.call("opaque")]) {
    assert.equal(current.demand.invalidationFor(owner, expression, new Set()).kind === "unproven", true,
      "observed distinct inputs do not exclude an external same-owner call");
  }
  assert.equal(current.demand.storageOriginsFor(requiredStorageSubject(current.storage, owner)).kind === "resolved", true, "observed contract remains available");
});

test("pure and source-readonly operations preserve externally admitted Error owners without an alias claim", async () => {
  const current = await analyzed("error-origin-public-pure", `
    function read(value: Stored): string { return value.message; }
    export function inspect(owner: Stored, other: Stored): string {
      return read(other) + opaque(other) + owner.message;
    }
  `);
  const owner = current.source.ast.parameters(current.declaration("inspect"))[0];
  assert.equal(current.demand.invalidationFor(owner, current.call("read"), new Set()).kind === "preserved", true);
  const invocation = current.call("opaque");
  assert.equal(current.demand.invalidationFor(owner, invocation, new Set([invocation])).kind === "preserved", true,
    "exact supplied pure invocation does not require a disjointness proof");
});

test("private distinct Error owners stay preserved while exact alias mutations invalidate", async () => {
  const current = await analyzed("error-origin-private-distinct", `
    const owner = { message: "owner" };
    const other = { message: "other" };
    const alias = owner;
    other.message = "changed";
    alias.message = "changed again";
  `);
  assert.equal(current.demand.closedStorageOriginsFor(requiredStorageSubject(current.storage, current.variable("owner"))).kind === "complete", true);
  assert.equal(current.demand.invalidationFor(current.variable("owner"), current.write("other"), new Set()).kind === "preserved", true);
  assert.equal(current.demand.invalidationFor(current.variable("owner"), current.write("alias"), new Set()).kind === "invalidated", true);
});

test("opaque native construction cannot invent fresh disjoint Error owners from new syntax", async () => {
  const current = await analyzed("error-origin-opaque-construction", `
    interface Constructor { new(): Stored; }
    declare const Native: Constructor;
    const owner = new Native();
    const other = new Native();
    other.message = "changed";
  `);
  for (const name of ["owner", "other"]) {
    const subject = requiredStorageSubject(current.storage, current.variable(name));
    const shared = current.storage.closedOriginsFor(subject);
    const selected = current.demand.closedStorageOriginsFor(subject);
    assert.equal(selected.kind === shared.kind, true,
      `${name}: the actual shared origin proof is not replaced by a different mutation-demand question`);
    assert.equal(selected.kind === "open", true, `${name}: opaque native result lacks an allocation contract`);
    assert.equal(shared.kind === "open" && selected.origins.length === shared.origins.length &&
      selected.origins.every((origin, index) => origin.subject === shared.origins[index].subject) &&
      selected.boundaries.length === shared.boundaries.length && selected.boundaries.every((boundary, index) =>
        boundary.kind === shared.boundaries[index].kind && boundary.subject === shared.boundaries[index].subject &&
        boundary.exposure === shared.boundaries[index].exposure), true,
    `${name}: exact canonical producer and external boundary identities remain unchanged`);
    assert.equal(selected.boundaries.some(boundary => boundary.kind === "opaque-result"), true);
  }
  assert.equal(current.demand.invalidationFor(current.variable("owner"), current.write("other"), new Set()).kind === "unproven", true,
    "two new occurrences are not proof of distinct native physical owners");
});

test("Error mutation proof follows exact generic invocation bindings rather than merged formal roots", async () => {
  const current = await analyzed("error-origin-bound-invocations", `
    function mutate<Value extends Stored>(value: Value): void { value.message = "changed"; }
    const owner = { message: "owner" };
    const other = { message: "other" };
    function changeOwner(): void { mutate(owner); }
    function changeOther(): void { mutate(other); }
    changeOwner();
    changeOther();
  `);
  assert.equal(current.demand.invalidationFor(current.variable("owner"), current.call("changeOwner"), new Set()).kind === "invalidated", true);
  assert.equal(current.demand.invalidationFor(current.variable("owner"), current.call("changeOther"), new Set()).kind === "preserved", true,
    "the second activation binds only the other owner");
});

for (const changesOwner of [false, true]) {
  test(`opaque construction retains uncertainty and evaluates its arguments (${changesOwner})`, async () => {
    const current = await analyzed(`error-origin-opaque-constructor-argument-${changesOwner}`, `
      interface Constructor { new(value: Stored): Stored; }
      export function inspect(owner: Stored, factory: Constructor): Stored {
        function argument(): Stored { ${changesOwner ? 'owner.message = "changed";' : ""} return owner; }
        return new factory(argument());
      }
    `);
    const owner = current.source.ast.parameters(current.declaration("inspect"))[0];
    const construction = requiredNode(current.source.ast, projectSourceFile(current.source, "src/index.ts"),
      node => current.source.ast.is.IsNewExpression(node));
    const result = current.demand.invalidationFor(owner, construction, new Set());
    assert.equal(result.kind === (changesOwner ? "invalidated" : "unproven"), true,
      "an open constructor is not preserved and cannot suppress an argument's real owner mutation");
  });
}

for (const inherited of [false, true]) {
  test(`closed constructor footprints retain the actual bound owner (${inherited})`, async () => {
    const current = await analyzed(`error-origin-bound-construction-${inherited}`, `
      function create(value: Stored): object {
        class Base {
          ${inherited ? 'initialized = (() => { value.message = "changed"; return value; })();'
            : 'constructor() { value.message = "changed"; }'}
        }
        ${inherited ? "class Derived extends Base {}" : ""}
        const Factory = ${inherited ? "Derived" : "Base"};
        return new Factory();
      }
      const owner = { message: "owner" };
      const other = { message: "other" };
      function changeOwner(): void { create(owner); }
      function changeOther(): void { create(other); }
      changeOwner();
      changeOther();
    `);
    assert.equal(current.demand.invalidationFor(current.variable("owner"), current.call("changeOwner"), new Set()).kind === "invalidated", true,
      "the admitted constructor and inherited initializer use the original bound owner");
    assert.equal(current.demand.invalidationFor(current.variable("owner"), current.call("changeOther"), new Set()).kind === "preserved", true,
      "an independent construction never rebinds its initializer to the owner's activation");
  });
}

test("unknown opaque Error access cannot prove preservation while a known alias remains observed", async () => {
  const current = await analyzed("error-origin-opaque-alias", `
    const owner = { message: "owner" };
    const alias = owner;
    opaque(alias);
  `);
  const invalidation = current.demand.invalidationFor(current.variable("owner"), current.call("opaque"), new Set());
  assert.equal(invalidation.kind === "unproven", true, "valid uncertain effects require releasing the borrow, not inventing preservation");
  assert.equal(Object.isFrozen(invalidation) && invalidation.reason.length > 0, true);
  const observed = current.demand.storageOriginsFor(requiredStorageSubject(current.storage, current.variable("alias")));
  assert.equal(observed.kind === "resolved" && observed.origins.length === 1, true);
  const complete = current.demand.closedStorageOriginsFor(requiredStorageSubject(current.storage, current.variable("alias")));
  assert.equal(complete.kind === "complete", true, "opaque field writes do not replace the owner identity");
  assert.equal(Object.isFrozen(complete) && Object.isFrozen(complete.origins) && complete.origins.every(Object.isFrozen), true);
});

test("Error complete-origin wrappers preserve projected typed roots and reject exhausted shared budgets", async () => {
  const current = await analyzed("error-origin-projection", `
    const owner = { message: "owner" };
    const box: [Stored] = [owner];
  `);
  const projection = [{ kind: "tuple-element", index: 0 }];
  const selected = current.storage.storageSubjectFor(current.variable("box"), projection);
  assert.equal(selected.kind === "resolved", true);
  const actual = current.demand.closedStorageOriginsFor(requiredStorageSubject(current.storage, current.variable("box"), projection));
  const expected = current.storage.closedOriginsFor(selected.subject);
  assert.equal(actual.kind === "complete" && expected.kind === "complete", true);
  assert.equal(actual.origins.length === expected.origins.length && actual.origins.every((origin, index) =>
    origin.subject === expected.origins[index].subject && origin.sourceFile === expected.origins[index].sourceFile &&
    current.source.semantics.forFile(origin.sourceFile).types.isIdentical(origin.type, expected.origins[index].type)), true,
    "one canonical typed origin owner");
  const bounded = await analyzed("error-origin-budget", `const owner = { message: "owner" };`,
    { ...defaultSourceStorageLimits, maximumSteps: 1 });
  assert.equal(bounded.demand.closedStorageOriginsFor(selected.subject).kind === "unresolved", true);
  assert.equal(bounded.demand.invalidationFor(bounded.variable("owner"), bounded.variable("owner"), new Set()).kind === "unresolved", true);
});

test("observed local implementations never close an externally supplied receiver's mutation footprint", async () => {
  const current = await analyzed("error-origin-open-dispatch", `
    interface Reporter { describe(value: Stored): string; }
    class Plain implements Reporter { describe(_value: Stored): string { return "plain"; } }
    export function inspect(reporter: Reporter): string {
      const owner: Stored = { message: "owner" };
      return owner.message + reporter.describe(owner);
    }
    const plain = new Plain();
    const original: Stored = { message: "original" };
    const local = plain.describe(original);
    const observed = inspect(plain);
  `);
  const invocation = current.call("reporter.describe");
  const selected = current.storage.invocationImplementationsFor(invocation);
  assert.equal(selected.kind, "resolved");
  assert.equal(selected.nodes.length, 1, "the local implementation is still reported");
  assert.equal(selected.exact, false, "observations do not close an exported interface input");
  assert.equal(current.demand.invalidationFor(current.variable("owner"), invocation, new Set()).kind, "unproven");
  const field = current.source.ast.members(current.declaration("Stored"))[0];
  const projected = current.storage.storageSubjectFor(current.variable("owner"), [{ kind: "member", declaration: field }]);
  assert.equal(projected.kind, "resolved");
  assert.equal(current.storage.closedOriginsFor(projected.subject).kind, "open");
  const exact = current.storage.invocationImplementationsFor(current.call("plain.describe"));
  assert.equal(exact.kind, "resolved");
  assert.equal(exact.exact, true, "a constructed local receiver keeps its exact implementation");
  assert.equal(current.demand.invalidationFor(current.variable("original"), current.call("plain.describe"), new Set()).kind, "preserved");
});

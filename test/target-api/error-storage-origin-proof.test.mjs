import assert from "node:assert/strict";
import test from "node:test";
import { createTargetSourceProgram } from "../../packages/target-api/dist/public/source.js";
import { createSourceErrorDeclarationQuery, createSourceStorageQuery, defaultSourceStorageLimits } from "../../packages/target-api/dist/public/analysis.js";
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
  const demand = createSourceErrorDeclarationQuery(source, { fields: [{ declaration: field, component: { declaration: field,
    selectedType: source.semantics.forNode(field).declarations.declaredValueType(field) } }], constructors: [], scalarMutators: [] });
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
  const other = current.source.ast.parameters(current.declaration("inspect"))[1];
  const domain = current.storage.closedOriginsFor(requiredStorageSubject(current.storage, owner));
  assert.equal(domain.kind === "open", true, "the independent storage owner retains the real external input");
  assert.equal(domain.boundaries.some(boundary => boundary.kind === "external-input"), true);
  const readonly = current.demand.parameterFor(owner);
  assert.equal(readonly.kind === "resolved" && readonly.value.access === "read-only", true,
    "the declaration's observer ABI is unchanged by export or distant caller values");
  const writable = current.demand.parameterFor(other);
  assert.equal(writable.kind === "resolved" && writable.value.access === "writable", true, "the actual own-body write remains a capability use");
  const write = current.source.ast.as.AsBinaryExpression(current.write("other")).Left;
  const selected = current.demand.mutationFor(write);
  assert.equal(selected.kind === "resolved" && selected.value[0].kind === "field", true, "the original checked mutation is not a disjointness guess");
  assert.equal(current.storage.originsFor(requiredStorageSubject(current.storage, owner)).kind, "resolved");
  assert.equal(current.demand.invalidationFor(owner, current.call("opaque")).kind, "unresolved",
    "a declaration alone cannot impersonate the required original field read");
});

test("pure and source-readonly operations preserve externally admitted Error owners without an alias claim", async () => {
  const current = await analyzed("error-origin-public-pure", `
    function read(value: Stored): string { return value.message; }
    export function inspect(owner: Stored, other: Stored): string {
      return read(other) + opaque(other) + owner.message;
    }
  `);
  const owner = current.source.ast.parameters(current.declaration("inspect"))[0];
  const read = current.source.ast.parameters(current.declaration("read"))[0];
  for (const parameter of [owner, read]) {
    const selected = current.demand.parameterFor(parameter);
    assert.equal(selected.kind === "resolved" && selected.value.access === "read-only", true,
      "the real declaration keeps its exact readonly field requirement");
  }
  const invocation = current.call("opaque");
  const selected = current.source.semantics.forNode(invocation).operations.call(invocation);
  assert.equal(selected.sourceCallee.declaration === current.declaration("opaque"), true, "the original checked opaque signature is retained");
  assert.equal(current.demand.invalidationFor(owner, invocation).kind, "unresolved",
    "a supplied historical purity set cannot replace an actual checked read/effect pair");
});

test("private distinct Error owners stay preserved while exact alias mutations invalidate", async () => {
  const current = await analyzed("error-origin-private-distinct", `
    const owner = { message: "owner" };
    const other = { message: "other" };
    const alias = owner;
    other.message = "changed";
    alias.message = "changed again";
  `);
  assert.equal(current.storage.closedOriginsFor(requiredStorageSubject(current.storage, current.variable("owner"))).kind, "complete");
  const mutations = ["other", "alias"].map(name => current.demand.mutationFor(current.source.ast.as.AsBinaryExpression(current.write(name)).Left));
  assert.equal(mutations.every(selected => selected.kind === "resolved" && selected.value.length === 1 && selected.value[0].kind === "field"), true,
    "both actual checked mutations retain their selected field and receiver");
  assert.equal(mutations[0].value[0].field.receiver.node !== mutations[1].value[0].field.receiver.node, true, "distinct authored receiver identities remain distinct");
  const owner = current.storage.closedOriginsFor(requiredStorageSubject(current.storage, current.variable("owner")));
  const alias = current.storage.closedOriginsFor(requiredStorageSubject(current.storage, current.variable("alias")));
  assert.equal(owner.kind === "complete" && alias.kind === "complete" && alias.origins.length === 1 &&
    alias.origins[0].subject === owner.origins[0].subject, true, "the independent storage owner retains exact alias identity without deciding an Error carrier");
  assert.equal(Object.isFrozen(mutations[0].value[0].field) && Object.isFrozen(mutations[1].value[0].field), true);
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
    const selected = current.storage.closedOriginsFor(subject);
    assert.equal(selected.kind, "open", "an opaque native result has no independently proved allocation contract");
    assert.equal(selected.boundaries.some(boundary => boundary.kind === "opaque-result"), true);
    const expression = current.source.ast.as.AsVariableDeclaration(current.variable(name)).Initializer;
    const checked = current.source.semantics.forNode(expression).operations.call(expression);
    assert.equal(checked !== undefined && checked.sourceResultType !== undefined, true, "the original constructor's exact selected result remains checked");
    assert.equal(current.demand.constructorFor(expression).kind, "not-applicable", "new syntax does not invent a registered Error constructor");
    assert.equal(Object.isFrozen(selected) && Object.isFrozen(selected.origins), true);
  }
  assert.equal(current.demand.invalidationFor(current.variable("owner"), current.write("other")).kind, "unresolved",
    "two new expressions do not manufacture a read or native disjointness contract");
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
  const declaration = current.declaration("mutate");
  const parameter = current.source.ast.parameters(declaration)[0];
  const formal = current.demand.parameterFor(parameter);
  assert.equal(formal.kind === "resolved" && formal.value.access === "writable", true, "the generic declaration retains its actual local write");
  const calls = current.source.navigation.nodes.filter(node => current.source.ast.is.IsCallExpression(node) &&
    current.source.ast.as.AsCallExpression(node)?.Expression !== undefined &&
    current.source.ast.text(current.source.ast.as.AsCallExpression(node).Expression) === "mutate");
  assert.equal(calls.length, 2, "both unchanged generic invocations remain");
  for (const [index, invocation] of calls.entries()) {
    const selected = current.source.semantics.forNode(invocation).operations.call(invocation);
    const signature = current.source.semantics.forNode(invocation).declarations.signatureDeclaration(selected.selectedSignature);
    assert.equal(signature === declaration, true, "the exact checked generic declaration owns the selected slot");
    assert.equal(selected.sourceSelectedSignatureParameters[0].parameterDeclaration === parameter, true);
    assert.equal(selected.sourceSelectedSignatureParameters[0].selectedType !== undefined, true, "the instantiated scalar component is present");
    assert.equal(current.source.navigation.sourceReferenceFor(selected.sourceArguments[0].expression)?.declaration ===
      current.variable(index === 0 ? "owner" : "other"), true, "each actual argument keeps its original declaration");
  }
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
    const selected = current.source.semantics.forNode(construction).operations.call(construction);
    assert.equal(selected !== undefined && selected.sourceArguments.length === 1, true, "the real construction retains its argument evaluation");
    assert.equal(selected.sourceArguments[0].expression === current.call("argument"), true, "the exact original argument call remains, never erased as pure");
    const formal = current.demand.parameterFor(owner);
    assert.equal(formal.kind === "resolved" && formal.value.access === "writable", true, "capture/opaque return never proves readonly or purity");
    const writes = current.source.navigation.nodes.map(node => current.demand.mutationFor(node)).filter(result =>
      result.kind === "resolved" && result.value.some(mutation => mutation.kind === "field"));
    assert.equal(writes.length, changesOwner ? 1 : 0, "the original argument's real mutation is preserved without a readless oracle");
    assert.equal(current.demand.constructorFor(construction).kind, "not-applicable", "an external constructor signature is not invented Error ownership");
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
    const parameter = current.source.ast.parameters(current.declaration("create"))[0];
    const selected = current.demand.parameterFor(parameter);
    assert.equal(selected.kind === "resolved" && selected.value.access === "writable", true,
      "the actual captured constructor/initializer reference does not become a readonly or purity proof");
    const construction = requiredNode(current.source.ast, projectSourceFile(current.source, "src/index.ts"),
      node => current.source.ast.is.IsNewExpression(node));
    const call = current.source.semantics.forNode(construction).operations.call(construction);
    assert.equal(call !== undefined && call.sourceResultType !== undefined, true, "the selected constructor/result component remains exact");
    const mutations = current.source.navigation.nodes.map(node => current.demand.mutationFor(node)).filter(result =>
      result.kind === "resolved" && result.value.some(mutation => mutation.kind === "field"));
    assert.equal(mutations.length, 1, "the unchanged constructor or inherited initializer retains its actual checked write");
    assert.equal(mutations[0].value[0].field.receiver.component.declaration === parameter, true,
      "the selected field receiver keeps its original captured declaration, not another caller's root");
    assert.equal(current.demand.invalidationFor(current.variable("owner"), current.call("changeOther")).kind, "unresolved",
      "no cached read or a closed-history purity service is fabricated");
  });
}

test("unknown opaque Error access cannot prove preservation while a known alias remains observed", async () => {
  const current = await analyzed("error-origin-opaque-alias", `
    const owner = { message: "owner" };
    const alias = owner;
    opaque(alias);
  `);
  const invalidation = current.demand.invalidationFor(current.variable("owner"), current.call("opaque"));
  assert.equal(invalidation.kind, "unresolved", "without an actual read/effect pair no preservation can be published");
  assert.equal(Object.isFrozen(invalidation) && invalidation.reason.length > 0, true);
  const observed = current.storage.originsFor(requiredStorageSubject(current.storage, current.variable("alias")));
  assert.equal(observed.kind === "resolved" && observed.origins.length === 1, true);
  const complete = current.storage.closedOriginsFor(requiredStorageSubject(current.storage, current.variable("alias")));
  assert.equal(complete.kind, "complete", "opaque field writes do not replace independently checked owner identity");
  assert.equal(Object.isFrozen(complete) && Object.isFrozen(complete.origins) && complete.origins.every(Object.isFrozen), true);
});

test("Error complete-origin wrappers preserve projected typed roots and reject exhausted shared budgets", async () => {
  const current = await analyzed("error-origin-projection", `
    const owner = { message: "owner" };
    const box: [Stored] = [owner];
  `);
  const projection = [{ kind: "tuple-element", index: 0 }];
  const selected = current.storage.storageSubjectFor(current.variable("box"), projection);
  assert.equal(selected.kind, "resolved");
  const actual = current.storage.closedOriginsFor(requiredStorageSubject(current.storage, current.variable("box"), projection));
  const expected = current.storage.closedOriginsFor(selected.subject);
  assert.equal(actual.kind === "complete" && expected.kind === "complete", true);
  assert.equal(actual.origins.length === expected.origins.length && actual.origins.every((origin, index) =>
    origin.subject === expected.origins[index].subject && origin.sourceFile === expected.origins[index].sourceFile &&
    current.source.semantics.forFile(origin.sourceFile).types.isIdentical(origin.type, expected.origins[index].type)), true,
    "one canonical independent typed origin owner");
  const bounded = await analyzed("error-origin-budget", `const owner = { message: "owner" };`,
    { ...defaultSourceStorageLimits, maximumSteps: 1 });
  assert.equal(bounded.storage.closedOriginsFor(selected.subject).kind, "unresolved");
  assert.equal(bounded.demand.invalidationFor(bounded.variable("owner"), bounded.variable("owner")).kind, "unresolved",
    "resource exhaustion or a declaration cannot fabricate an original checked field read");
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
  const fieldRead = requiredNode(current.source.ast, current.source.ast.body(current.declaration("inspect")), node => {
    const access = current.source.ast.as.AsPropertyAccessExpression(node);
    return access !== undefined && current.source.ast.text(access.Expression) === "owner" &&
      current.source.ast.text(current.source.ast.name(node)) === "message";
  });
  const read = current.demand.fieldFor(fieldRead);
  assert.equal(read.kind, "resolved", "the original program contains an actual field read before the opaque operation");
  assert.equal(current.demand.invalidationFor(read.value, invocation).kind, "invalidated", "unknown dispatch cannot preserve the original read");
  const field = current.source.ast.members(current.declaration("Stored"))[0];
  const projected = current.storage.storageSubjectFor(current.variable("owner"), [{ kind: "member", declaration: field }]);
  assert.equal(projected.kind, "resolved");
  assert.equal(current.storage.closedOriginsFor(projected.subject).kind, "open");
  const exact = current.storage.invocationImplementationsFor(current.call("plain.describe"));
  assert.equal(exact.kind, "resolved");
  assert.equal(exact.exact, true, "a constructed local receiver retains its independent exact implementation");
  const parameter = current.source.ast.parameters(selected.nodes[0])[0];
  const formal = current.demand.parameterFor(parameter);
  assert.equal(formal.kind === "resolved" && formal.value.access === "read-only", true,
    "the actual local declaration retains its readonly requirement without inventing a readless invalidation service");
});

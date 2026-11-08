import { createJsSourceApiFacts } from "../../packages/js-source-profile/dist/index.js";
import assert from "node:assert/strict";
import test from "node:test";
import { createHostSourceProgram } from "../../packages/target-api/dist/public/host.js";
import { sourceTypeDescriptorsEqual } from "../../packages/target-api/dist/public/source.js";
import { createSourceErrorStorageDemandQuery, createSourceStorageQuery, defaultSourceStorageLimits } from "../../packages/target-api/dist/target-analysis/index.js";
import { checkedSource, namedDeclaration, namedVariable, projectSourceFile, requiredNode, requiredStorageSubject } from "../fixtures/source-navigation.mjs";
import { formatDiagnostics } from "@tsonic/tsts";
import { typescriptNoLibUtilityDeclarations } from "../../packages/target-api/dist/public/provider.js";
import { jsSurfaceSourceProfileDeclarations, sourceNoLibBaseDeclarations, sourcePrimitiveProfileDeclarations }
  from "../../packages/js-source-profile/dist/index.js";
import { errorConstructorFootprintSource, errorOriginDomainSource } from "../fixtures/error-origin-domains.mjs";

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
  const source = createHostSourceProgram(checked, { profile: createJsSourceApiFacts, platform: { kind: "known", nativeIntegerBits: 64, basis: "test" } });
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
    assert.equal(selected.kind === "open", true,
      `${name}: opaque native result lacks an allocation contract (${selected.kind}${selected.kind === "unresolved" ? `: ${selected.reason}` : ""})`);
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
    sourceTypeDescriptorsEqual(origin.type, expected.origins[index].type)), true,
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

// The Error storage-demand origin, domain and footprint cases of the baseline C# test
// (keel-baseline-20261107-1648 tsonic-csharp test/analysis/objects/error-storage-origin-proof.test.mjs), as Host tests
// (R-T6-5, REVIEW-R4 #62). Both source profiles: the JS surface profile and another target's profile over the shared
// base declarations. The JS API storage effects are the Host's own (facts.profile through facts.analyses.storage).
const nativeProfileDeclarations = `
${sourcePrimitiveProfileDeclarations}
${sourceNoLibBaseDeclarations}

interface String { readonly length: int32; }
interface Array<T> extends Iterable<T> { readonly length: int32; [index: number]: T; }
interface ReadonlyArray<T> extends Iterable<T> { readonly length: int32; readonly [index: number]: T; }
`;
const sourceErrorNames = ["Error", "RangeError", "TypeError", "URIError"];

/** The Error protocol of the profile declarations: Error fields, Error constructor signatures, stack captures. */
function profileErrorProtocol(source) {
  const { ast } = source;
  const interfaces = source.sourceFiles.filter(file => ast.getFileName(file).includes("/.tsonic/source-profiles/"))
    .flatMap(file => ast.statements(file).filter(statement => statement !== undefined && ast.is.IsInterfaceDeclaration(statement)));
  const nameOf = node => { const name = ast.name(node); return name === undefined ? undefined : ast.text(name); };
  const membersOf = names => interfaces.filter(declaration => names.includes(nameOf(declaration)))
    .flatMap(declaration => ast.members(declaration).filter(member => member !== undefined));
  const stackCaptures = membersOf(["ErrorConstructor"]).filter(member => nameOf(member) === "captureStackTrace");
  return Object.freeze({
    fields: membersOf(["Error"]).filter(member => ["name", "message", "stack"].includes(nameOf(member))),
    constructors: membersOf(sourceErrorNames.map(name => `${name}Constructor`))
      .filter(member => ast.is.IsCallSignatureDeclaration(member) || ast.is.IsConstructSignatureDeclaration(member)),
    stackCaptures,
    storageMutators: stackCaptures.map(signature => ({ signature, sourceParameterIndex: 0 })),
    retention: () => ({ kind: "ordinary" }),
  });
}

async function profiled(name, body, jsEnabled) {
  const profile = jsEnabled
    ? { ".tsonic/source-profiles/js/typescript-utilities.d.ts": typescriptNoLibUtilityDeclarations,
      ".tsonic/source-profiles/js/js-globals.d.ts": jsSurfaceSourceProfileDeclarations }
    : { ".tsonic/source-profiles/native/typescript-utilities.d.ts": typescriptNoLibUtilityDeclarations,
      ".tsonic/source-profiles/native/native-globals.d.ts": nativeProfileDeclarations };
  const checked = await checkedSource(name, { ...profile, "src/index.ts": body }, { sourceCore: true, jsSurface: jsEnabled });
  assert.equal(checked.diagnostics.length, 0, formatDiagnostics(checked.diagnostics, "/src"));
  assert.equal(checked.extensionDiagnostics.length, 0, "exact source facts admitted");
  const source = createHostSourceProgram(checked, { profile: createJsSourceApiFacts, platform: { kind: "known", nativeIntegerBits: 64, basis: "test" } });
  const file = projectSourceFile(source, "src/index.ts");
  const protocol = profileErrorProtocol(source);
  assert.equal(protocol.fields.length === 3 && protocol.constructors.length >= 2 && protocol.stackCaptures.length === 1, true,
    "the profile declares the Error protocol");
  const storage = source.facts.analyses.storage({ sourceFiles: [file] });
  const demand = createSourceErrorStorageDemandQuery(source, protocol, storage);
  return { source, file, storage, demand };
}

for (const jsEnabled of [false, true]) {
  const profileName = jsEnabled ? "JS" : "native";
  for (const called of [false, true]) {
    test(`${profileName} ${called ? "call" : "new"} Error storage origins require complete admitted origins`, async () => {
      const { source, file, storage, demand } = await profiled(`error-origin-domains-${profileName}-${called}`,
        errorOriginDomainSource(called), jsEnabled);
      const { ast } = source;
      for (const [name, expectedDomain] of [["inspect", "open"], ["privateInspect", "complete"]]) {
        const formal = ast.parameters(namedDeclaration(ast, file, name))[0];
        const observed = demand.storageOriginsFor(requiredStorageSubject(storage, formal));
        assert.equal(observed.kind === "resolved" && observed.origins.length > 0 &&
          observed.origins.every(origin => demand.isNativeConstructor(origin.node)), true, `${name}: same observed native roots`);
        assert.equal(demand.closedStorageOriginsFor(requiredStorageSubject(storage, formal)).kind, expectedDomain,
          `${name}: exact admission proof`);
      }
      const construct = namedDeclaration(ast, file, "construct");
      const external = requiredNode(ast, file, node => ast.is.IsReturnStatement(node) && ast.parent(ast.parent(node)) === construct);
      const returned = ast.as.AsReturnStatement(external).Expression;
      assert.equal(demand.closedStorageOriginsFor(requiredStorageSubject(storage, namedVariable(ast, file, "aliased"))).kind, "complete",
        "immutable owned global constructor alias");
      assert.equal(demand.closedStorageOriginsFor(requiredStorageSubject(storage, returned)).kind, "open",
        "signature identity does not own an external constructor value");
      assert.equal(demand.invalidationFor(ast.parameters(construct)[1], returned, new Set()).kind, "unproven",
        "a valid external constructor is not evidence that a guarded Error read is preserved");
      assert.equal(demand.closedStorageOriginsFor(requiredStorageSubject(storage, namedVariable(ast, file, "unowned"))).kind, "open",
        "ambient external values are not owned global constructors");
    });
  }
  for (const [footprint, expected] of [["mutating", "invalidated"], ["readonly", "preserved"], ["deferred", "preserved"],
    ["receiver", "preserved"], ["bound", "invalidated"]]) {
    test(`${profileName} native Error allocation preserves exact ${footprint} inherited initialization`, async () => {
      const { source, file, storage, demand } = await profiled(`error-footprint-${profileName}-${footprint}`,
        errorConstructorFootprintSource(footprint), jsEnabled);
      const owner = namedVariable(source.ast, file, "original");
      const expression = source.ast.as.AsVariableDeclaration(namedVariable(source.ast, file, "created"))?.Initializer;
      assert.equal(expression !== undefined, true);
      assert.equal(demand.isNativeConstructor(expression), true, "the inherited constructor selects the owned native Error protocol");
      assert.equal(demand.closedStorageOriginsFor(requiredStorageSubject(storage, expression)).kind, "complete",
        "fresh result ownership is complete but is not a purity proof");
      assert.equal(demand.invalidationFor(owner, expression, new Set()).kind, expected);
    });
  }
}

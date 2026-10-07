import assert from "node:assert/strict";
import test from "node:test";
import { formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../../packages/target-api/dist/public/source.js";
import { createSourceStorageQuery, defaultSourceStorageLimits } from "../../packages/target-api/dist/public/analysis.js";
import { sourceErrorDeclarations } from "../../packages/js-source-profile/dist/index.js";
import { errorConstructorFootprintSource } from "../fixtures/error-origin-domains.mjs";
import { checkedSource, namedDeclaration, namedVariable, projectSourceFile } from "../fixtures/source-navigation.mjs";

const globals = `
interface Object {} interface Function {} interface CallableFunction extends Function {}
interface NewableFunction extends Function {} interface IArguments {} interface Boolean {}
interface Number {} interface String {} interface RegExp {}
interface Array<T> { [index: number]: T; length: number; }
interface ReadonlyArray<T> { readonly [index: number]: T; readonly length: number; }
`;

async function fixture(name, body, files = {}, transform = source => source) {
  const checked = await checkedSource(name, {
    "globals.d.ts": `${globals}${sourceErrorDeclarations}`,
    "src/index.ts": `export {}; ${body}`,
    ...files,
  });
  assert.equal(checked.diagnostics.length === 0, true, formatDiagnostics(checked.diagnostics, "/src"));
  assert.equal(checked.extensionDiagnostics.length === 0, true, "exact source facts admitted");
  const source = transform(createTargetSourceProgram(checked));
  const file = projectSourceFile(source, "src/index.ts");
  const storage = createSourceStorageQuery(source, source.navigation.sourceFiles, defaultSourceStorageLimits);
  const initializer = name => source.ast.as.AsVariableDeclaration(namedVariable(source.ast, file, name)).Initializer;
  const selection = name => {
    const subject = storage.subjectFor(namedVariable(source.ast, file, name));
    assert.equal(subject.kind === "resolved", true, `${name}: checked storage subject`);
    return storage.closedOriginsFor(subject.subject);
  };
  return { source, file, storage, initializer, selection };
}

function complete(current, name) {
  const selected = current.selection(name);
  assert.equal(selected.kind === "complete", true, `${name}: complete source construction`);
  assert.equal(selected.origins.length > 0, true, `${name}: nonempty exact roots`);
  assert.equal(Object.isFrozen(selected) && Object.isFrozen(selected.origins) && selected.origins.every(Object.isFrozen), true);
  return selected.origins;
}

function open(current, name, boundary) {
  const selected = current.selection(name);
  assert.equal(selected.kind === "open", true, `${name}: construction is not universally closed`);
  assert.equal(selected.boundaries.some(value => value.kind === boundary), true, `${name}: exact ${boundary} witness`);
}

for (const footprint of ["mutating", "readonly", "deferred", "receiver", "bound"]) {
  test(`implicit source allocation retains ${footprint} inherited initialization without native catalog authority`, async () => {
    const current = await fixture(`storage-implicit-error-${footprint}`, errorConstructorFootprintSource(footprint));
    const invocation = current.initializer("created");
    const selected = current.source.semantics.forNode(invocation).operations.call(invocation);
    const signature = current.source.semantics.forNode(invocation).declarations.signatureDeclaration(selected.selectedSignature);
    assert.equal(signature !== undefined && !current.source.navigation.isProjectDeclaration(signature), true,
      "the effective native signature exists without owning the source class allocation");
    const derived = namedDeclaration(current.source.ast, current.file, "Derived");
    const constructors = current.source.navigation.classConstructors(derived);
    assert.equal(constructors.kind === "resolved" && constructors.implicit, true, "exact authored implicit class");
    assert.equal(current.storage.boundaries.some(boundary => boundary.invocation === invocation), false,
      "source construction is not an opaque global native invocation");
    const origins = complete(current, "created");
    assert.equal(origins.length === 1 && origins[0].subject.node === invocation, true, "exact new source instance identity");
    const regions = current.storage.instanceRegionsFor(invocation);
    assert.equal(regions.kind === "resolved" && regions.regions.length === 1, true, "inherited initializer remains executable");
    assert.equal(regions.regions[0].owner === namedDeclaration(current.source.ast, current.file, "Base"), true,
      "exact inherited initializer owner is retained");
    open(current, "original", "opaque-result");
  });
}

test("source implicit allocation preserves both declared inherited and declaration-free effective signatures", async () => {
  const current = await fixture("storage-implicit-cross-file", `
    import { Empty, Derived } from "./classes.js";
    const alias = Derived;
    const empty = new Empty();
    const direct = new Derived("direct");
    const aliased = new alias("alias");
  `, { "src/classes.ts": `export class Empty {} export class Base extends Error {} export class Derived extends Base {}` });
  const empty = current.initializer("empty");
  const selected = current.source.semantics.forNode(empty).operations.call(empty);
  assert.equal(current.source.semantics.forNode(empty).declarations.signatureDeclaration(selected.selectedSignature) === undefined, true,
    "declaration-free constructor control genuinely exercises the previous owner path");
  for (const name of ["empty", "direct", "aliased"]) {
    const invocation = current.initializer(name);
    const origins = complete(current, name);
    assert.equal(origins.length === 1 && origins[0].subject.node === invocation, true, `${name}: exact independent instance`);
  }
});

test("implicit constructor classification requires exact selected parameter declarations", async () => {
  const current = await fixture("storage-implicit-parameter-identity", `
    class Derived extends Error {}
    function unrelated(message?: string): void {}
    const created = new Derived("message");
  `, {}, source => {
    const file = projectSourceFile(source, "src/index.ts");
    const invocation = source.ast.as.AsVariableDeclaration(namedVariable(source.ast, file, "created")).Initializer;
    const parameter = source.ast.parameters(namedDeclaration(source.ast, file, "unrelated"))[0];
    const selected = source.semantics.forNode(invocation).operations.call(invocation);
    assert.equal(selected.sourceSelectedSignatureParameters.length === 1 &&
      selected.sourceSelectedSignatureParameters[0].parameterDeclaration !== parameter, true,
      "same spelling and type do not establish parameter declaration identity");
    const changed = { ...selected, sourceSelectedSignatureParameters: selected.sourceSelectedSignatureParameters.map(value =>
      ({ ...value, parameterDeclaration: parameter })) };
    return { ...source, semantics: { ...source.semantics, forNode(node) {
      const scope = source.semantics.forNode(node);
      return node !== invocation ? scope : { ...scope, operations: { ...scope.operations,
        call(call) { return call === invocation ? changed : scope.operations.call(call); } } };
    } } };
  });
  open(current, "created", "opaque-result");
});

test("foreign and externally selected constructors do not acquire source allocation ownership", async () => {
  const current = await fixture("storage-implicit-external", `
    class Derived extends Error {}
    export let constructorSlot: typeof Derived = Derived;
    const dynamic = new constructorSlot("dynamic");
    const foreign = new Foreign("foreign");
    export function construct(factory: typeof Derived): Derived { return new factory("external"); }
  `, { "foreign.d.ts": `declare class Foreign extends Error {}` });
  open(current, "dynamic", "external-write");
  open(current, "foreign", "opaque-result");
  const construct = namedDeclaration(current.source.ast, current.file, "construct");
  const returned = current.storage.subject(construct, "return");
  assert.equal(returned.kind === "resolved", true);
  const selected = current.storage.closedOriginsFor(returned.subject);
  assert.equal(selected.kind === "open" && selected.boundaries.some(boundary => boundary.kind === "external-input"), true,
    "a constructor formal signature cannot supply actual class identity");
});

test("inherited source constructor return transport is not replaced by an implicit fresh-only assumption", async () => {
  const current = await fixture("storage-implicit-returned-object", `
    const existing = {};
    class Reuse { constructor() { return existing; } }
    class Derived extends Reuse {}
    const direct = new Reuse();
    const inherited = new Derived();
  `);
  for (const name of ["direct", "inherited"]) {
    const origins = complete(current, name);
    assert.equal(origins.some(origin => origin.subject.node === current.initializer("existing")), true,
      `${name}: exact returned object remains a possible root`);
    assert.equal(origins.every(origin => origin.subject.node === current.initializer(name)), false,
      `${name}: construction syntax cannot certify exclusively fresh roots`);
  }
});

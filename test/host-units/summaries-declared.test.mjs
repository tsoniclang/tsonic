import assert from "node:assert/strict";
import { test } from "node:test";
import { isDeepStrictEqual } from "node:util";
import { encodeBodyId, encodeDefId, encodeModuleId, encodePackageId } from "../../packages/host/dist/ids/index.js";
import { admitGuarantees } from "../../packages/host/dist/libraries/index.js";
import { bindDeclaredSummary } from "../../packages/host/dist/summaries/index.js";
import { rigidBindings, signatureRequestKey } from "../../packages/host/dist/ir-types/index.js";

const definition = name => encodeDefId({ module: encodeModuleId({ package: encodePackageId("summary-kernel"), path: "api.ts" }), segments: [{ name, ordinal: 0 }] });
const empty = () => ({ classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] });
const scope = () => ({ classParameters: [], methodParameters: [], capturedParameters: [], selfOwners: [] });

function fixture(parameters = []) {
  const declaration = definition("operation");
  const module = { providerId: "native-provider", providerVersion: "1", packageName: null, moduleSpecifier: "native-api", providerModuleId: "catalogue" };
  const identity = { module, exportId: "operation", memberId: null, signatureId: "native-signature" };
  const statement = { identity, projections: [], producers: [], origins: [{ id: 0, kind: "complete", producers: [], includesAbsence: false }],
    boundaries: [], parameters: [], captures: [], result: 0, thrown: 0, writes: [], retention: [], callbacks: [], invocationOnlyParameters: [], suspends: false, bindingDependent: false };
  const signature = { id: 7, declaration, owner: { kind: "item", value: { owner: declaration, node: 3 } }, composition: null, kind: "call", typeParameters: [],
    receiver: null, parameters, result: 0 };
  const request = { definition: declaration, endpoint: "api-signature", ordinal: 2, bindings: { kind: "parametric" } };
  const association = { kind: "callable", identity, request, signature, scope: scope(), member: null, guarantee: identity };
  const nativeSignature = { id: "native-signature", name: null, accessibility: "public", parameters: parameters.map((parameter, position) => ({ name: `p${position}`, type: 0,
    passingMode: parameter.passing, optional: parameter.kind === "optional" || parameter.kind === "default", rest: parameter.kind === "rest", defaultType: parameter.kind === "default" ? 0 : null })),
    returnType: 0, typeParameters: [], documentation: null };
  const exported = { id: "operation", name: "operation", exportName: "operation", exportKind: "named", kind: "function", typeFamily: null, type: null,
    typeParameters: [], heritage: [], members: [], signatures: [nativeSignature], documentation: null };
  const bound = { sources: [{ id: "source", modules: [{ identity: module, types: [{ id: 0, kind: "unknown" }], imports: [], exports: [exported], roles: [] }], declarations: [] }], sourceRoles: [] };
  const provided = parameters.filter(parameter => parameter.kind !== "rest").length;
  const mappings = parameters.map((parameter, position) => parameter.kind === "rest"
    ? { kind: "rest", parameter: position, arguments: [], passing: parameter.passing }
    : { kind: "argument", parameter: position, argument: position, component: null, passing: parameter.passing });
  const input = { kind: "native", execution: { request, provided }, signature, parameters: mappings,
    source: signature.owner, guarantee: { statement, declaration }, associations: [association] };
  return { declaration, identity, statement, signature, request, association, bound, input };
}

function summary(input) {
  const result = bindDeclaredSummary(input);
  assert.equal(result.kind, "ok", "the actual selected native/unknown binding kernel completed");
  return result.value;
}

test("Libraries admits a raw guarantee once without publishing any premature semantic Summary", () => {
  assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined, true);
  const value = fixture();
  const result = admitGuarantees(value.bound, [value.statement], [value.association]);
  assert.equal(result.kind, "ok");
  assert.equal(result.value.sources === value.bound.sources, true);
  assert.equal(result.value.sourceRoles === value.bound.sourceRoles, true);
  assert.equal(result.value.guarantees[0].statement === value.statement, true);
  assert.deepEqual(Object.keys(result.value).sort(), ["guarantees", "sourceRoles", "sources"]);
  assert.deepEqual(result.value.guarantees.map(row => row.declaration), [value.declaration]);
});

test("late binding retains the complete endpoint request, provided count and selected semantic signature", () => {
  const value = fixture();
  const result = summary(value.input);
  assert.equal(result.key.kind, "declared");
  assert.equal(signatureRequestKey(result.key.execution.request), signatureRequestKey(value.request));
  assert.equal(result.key.execution.provided, 0);
  assert.equal(result.signature, 7);
  assert.deepEqual(result.parameters, []);
  assert.equal(result.arena.origins[result.result].kind, "complete");
  assert.equal(result.key.execution.request.ordinal, 2, "native signature strings are not semantic signature IDs or endpoint ordinals");
});

test("supplied native guarantees never become unknown when exact selected association evidence is missing", () => {
  for (const amend of [
    value => { value.input.associations = []; },
    value => { value.input.associations.push(structuredClone(value.association)); },
    value => { value.input.execution.request = { ...value.request, endpoint: "advertised" }; },
    value => { value.input.execution.request = { ...value.request, ordinal: 0 }; },
    value => { value.input.execution.request = { ...value.request, bindings: { kind: "instantiated", bindings: empty() } }; },
    value => { value.input.signature = { ...value.signature, id: 8 }; },
    value => { value.input.associations = [{ ...value.association, guarantee: null }]; },
    value => { value.input.associations = [{ ...value.association, guarantee: { ...value.identity, exportId: "alias-origin" } }]; },
    value => { value.input.guarantee = { ...value.input.guarantee, declaration: definition("other") }; },
    value => { value.input.guarantee.statement = { ...value.statement, identity: { ...value.identity, signatureId: "other-native-signature" } }; },
    value => { value.input.associations = [{ ...value.association, kind: "noncallable", declaration: value.declaration, bindings: empty() }]; },
  ]) {
    const value = fixture(); amend(value);
    const result = bindDeclaredSummary(value.input);
    assert.equal(result.kind, "refused");
    assert.deepEqual(result.diagnostics.map(row => row.code.rendered), ["TSONIC_LIBRARY_SUMMARY_BINDING_INVALID"]);
  }
});

test("parametric native environments use genuine ready rigid slots across all four binding families", () => {
  const value = fixture();
  const classParameter = { owner: definition("class"), index: 0 };
  const methodParameter = { owner: value.declaration, index: 1 };
  const capturedParameter = { owner: definition("outer"), index: 2 };
  value.association.scope = { classParameters: [classParameter], methodParameters: [methodParameter], capturedParameters: [capturedParameter], selfOwners: [definition("self")] };
  const result = summary(value.input);
  assert.equal(result.key.execution.request.bindings.kind, "parametric");
  assert.deepEqual(result.arena.contexts, [{ id: 0, receiver: null, arguments: [], captures: [] }]);
  const unknown = summary({ kind: "unknown", execution: value.input.execution, signature: value.signature, parameters: [], source: value.input.source,
    scope: value.association.scope, suspends: false, bindingDependent: true });
  assert.equal(isDeepStrictEqual(unknown.arena.boundProducers[0].bindings, rigidBindings(value.association.scope)), true, "genuine qualified scope, never an invented empty environment");
});

test("genuine no-guarantee invocation retains the exact ready declaration source witness and explicit channels", () => {
  for (const kind of ["item", "body"]) {
    const value = fixture();
    const source = kind === "item" ? value.input.source : { kind: "body", value: {
      body: encodeBodyId({ owner: definition("enclosing"), role: "function", ordinal: 0 }), node: 9 } };
    const result = summary({ kind: "unknown", execution: value.input.execution, signature: value.signature, parameters: [], source,
      scope: scope(), suspends: true, bindingDependent: true });
    assert.equal(isDeepStrictEqual(result.arena.boundaries[0].at, { kind: "node", node: source }), true);
    assert.deepEqual(result.arena.producers, [{ id: 0, kind: "shared", definition: value.declaration, path: null }]);
    assert.equal(result.arena.origins[result.result].kind, "open");
    assert.equal(result.arena.origins[result.thrown].includesAbsence, true);
    assert.equal(result.suspends, true);
    assert.equal(result.bindingDependent, true);
  }
});

test("default, optional and rest transports stay distinct from actual supplied fixed arguments", () => {
  const declaration = definition("default-parameter");
  const parameters = [{ declaration, kind: "optional", type: 0, passing: "by-value", initializer: null },
    { declaration: definition("rest-parameter"), kind: "rest", type: 0, passing: "by-value", initializer: null }];
  const value = fixture(parameters);
  value.input.execution.provided = 0;
  value.input.parameters = [{ kind: "omitted", parameter: 0, type: 0 }, { kind: "rest", parameter: 1, arguments: [], passing: "by-value" }];
  const result = summary(value.input);
  assert.equal(result.key.execution.provided, 0);
  assert.deepEqual(result.arena.producers.map(row => [row.kind, row.index]), [["parameter", 0], ["parameter", 1]], "formal slots remain formal identities, not fictitious supplied arguments");
  for (const invalid of [NaN, Infinity, -1, -0, 0.5, 2]) {
    assert.throws(() => bindDeclaredSummary({ ...value.input, execution: { ...value.input.execution, provided: invalid } }), TypeError);
  }
  assert.throws(() => bindDeclaredSummary({ ...value.input, parameters: [] }), /complete parameter transport/u);
  assert.throws(() => bindDeclaredSummary({ ...value.input, parameters: [{ kind: "argument", argument: 0, parameter: 0, component: null, passing: "by-value" }, value.input.parameters[1]] }), /actual passing mode/u);
  const initializer = encodeBodyId({ owner: declaration, role: "initializer", ordinal: 0 });
  const defaults = fixture([{ declaration, kind: "default", type: 0, passing: "by-value", initializer }]);
  defaults.input.execution.provided = 0;
  defaults.input.parameters = [{ kind: "default", parameter: 0, initializer }];
  assert.equal(summary(defaults.input).key.execution.provided, 0);
  assert.throws(() => bindDeclaredSummary({ ...defaults.input, parameters: [{ kind: "default", parameter: 0,
    initializer: encodeBodyId({ owner: declaration, role: "initializer", ordinal: 1 }) }] }), /actual selected initializer/u);
});

import type { ErrorValue, Result, UnitRequest, UnitValue } from "../diag/contract.js";
import { throwInvariant } from "../diag/index.js";
import type { DefId, TyId } from "../ids/contract.js";
import { decodeBodyId, encodeKey } from "../ids/index.js";
import type { CheckedPhase, HirBody, HirNode, ParameterDeclaration } from "../ir-hir/contract.js";
import type { PlacedSignature } from "../ir-infer/contract.js";
import type { InferredPartType } from "../ir-infer/contract.js";
import type { Signature, SignatureParameter, SignatureRequest } from "../ir-types/contract.js";
import { admitTypePublicationStep, readSignature, readType, refuseTypeConstruction } from "../ir-types/index.js";
import type { DeclsDeps, DeclsModule, DeclsStep, PlaceSignature } from "./contract.js";
import { assembleSignature, bindSignature, constructSignature, endpointOf, findAscending, inferredParts, moduleOf, resolvePart, signatureValue } from "./signatures.js";

function fail(unit: UnitRequest, message: string): never {
  return throwInvariant({ owner: "decls", query: { name: unit.query, encodedKey: encodeKey(unit.key) }, origin: null, message });
}

function nodeOf(checked: DeclsModule, definition: DefId, unit: UnitRequest): HirNode {
  if (definition === checked.module.tree.tsonic.definition) return checked.module.tree;
  const entry = findAscending(checked.module.items, definition, item => item.definition);
  const node = entry === undefined ? undefined : checked.nodes[entry.node];
  if (node === undefined) return fail(unit, "The placement owner is not a declaration of its checked module.");
  return node;
}

function placed(answer: UnitValue<Signature>, request: SignatureRequest | null): UnitValue<PlacedSignature> {
  return { value: { request, signature: answer.value }, positions: answer.positions };
}

function endpointPlacement(inputs: DeclsDeps, request: SignatureRequest, ready: readonly InferredPartType[], unit: UnitRequest): DeclsStep<PlacedSignature, never> {
  const selected = endpointOf(inputs, request);
  const bound = bindSignature(inputs, request.bindings, readSignature(inputs.types, selected.endpoint.signature), selected.origin, unit);
  if (bound.kind === "refused") return { kind: "done", value: bound };
  const parts = inferredParts(request, selected, bound.value);
  if (parts.length !== ready.length || parts.some((expected, index) => {
    const actual = ready[index]?.part;
    return actual === undefined || actual.definition !== expected.part.definition || actual.part.kind !== expected.part.part.kind
      || (expected.part.part.kind === "parameter-initializer"
        && (actual.part.kind !== "parameter-initializer" || actual.part.index !== expected.part.part.index));
  })) return fail(unit, "Signature placement requires exactly the actual inferred parts in their canonical order.");
  const [first, ...rest] = parts;
  if (first === undefined)
    return { kind: "done", value: { kind: "ok", ...placed(signatureValue(inputs, unit, bound.value, new Map()), request), diagnostics: [], emissions: [] } };
  const stop = admitTypePublicationStep(inputs.typeWork, ready.length);
  if (stop !== null) return { kind: "done", value: refuseTypeConstruction(inputs.typeWork, stop, selected.origin, unit) };
  const value = assembleSignature(inputs, { request, signature: bound.value, parts: [first, ...rest] },
    ready.map(answer => resolvePart(answer, unit)), selected, unit);
  return { kind: "done", value: value.kind === "refused" ? value : { kind: "ok", ...placed(value.value, request), diagnostics: [], emissions: [] } };
}

function parameterNode(checked: DeclsModule, body: HirBody, local: number, unit: UnitRequest): ParameterDeclaration<CheckedPhase> {
  const reference = body.locals[local]?.declaration;
  const node = reference === undefined ? undefined : checked.nodes[reference.value.node];
  if (node?.kind !== "Parameter")
    return fail(unit, "An execution parameter needs its actual checked declared type, not a checker-slot guess.");
  return node;
}

type OmissionInventory = ReadonlyMap<DefId, {
  readonly node: ParameterDeclaration<CheckedPhase>;
  readonly formal: SignatureParameter;
}>;

function omissionInventory(inputs: DeclsDeps, checked: DeclsModule, owner: DefId, unit: UnitRequest): Result<OmissionInventory> {
  const callable = nodeOf(checked, owner, unit);
  if (callable.tsonic === null || !("signatures" in callable.tsonic))
    return fail(unit, "An execution formal has no genuine checked owning callable endpoint inventory.");
  const inventory = new Map<DefId, { readonly node: ParameterDeclaration<CheckedPhase>; readonly formal: SignatureParameter }>();
  const endpoints = admitTypePublicationStep(inputs.typeWork, callable.tsonic.signatures.length);
  if (endpoints !== null) return refuseTypeConstruction(inputs.typeWork, endpoints, callable.origin, unit);
  for (const endpoint of callable.tsonic.signatures) {
    const signature = readSignature(inputs.types, endpoint.signature);
    if (signature.declaration !== owner)
      return fail(unit, "A checked endpoint signature must retain its actual callable declaration.");
    const formals = admitTypePublicationStep(inputs.typeWork, signature.parameters.length);
    if (formals !== null) return refuseTypeConstruction(inputs.typeWork, formals, callable.origin, unit);
    for (const formal of signature.parameters) {
      const entry = findAscending(checked.module.items, formal.declaration, item => item.definition);
      const node = entry === undefined ? undefined : checked.nodes[entry.node];
      if (node?.kind !== "Parameter" || node.tsonic.parent !== owner)
        return fail(unit, "A checked formal must retain its actual parameter declaration and owning callable occurrence.");
      const previous = inventory.get(formal.declaration);
      if (previous !== undefined && (previous.node !== node || previous.formal.acceptsOmission !== formal.acceptsOmission))
        return fail(unit, "Genuine checked endpoints disagree on their parameter's omission evidence.");
      inventory.set(formal.declaration, { node, formal });
    }
  }
  return { kind: "ok", value: inventory, diagnostics: [] };
}

export const placeSignature: PlaceSignature = (inputs, placement, unit, cuts) => {
  if (placement.kind === "endpoint") {
    const cut = cuts.declaration(placement.request.definition);
    if (cut !== null) return { kind: "done", value: { kind: "refused", diagnostics: cut.diagnostics } };
    return endpointPlacement(inputs, placement.request, placement.parts, unit);
  }
  if (placement.kind !== "callable-body" && placement.kind !== "execution-body")
    return fail(unit, "Signature placement has no such closed request arm.");
  const cut = cuts.body(placement.instance.body);
  if (cut !== null) return { kind: "done", value: { kind: "refused", diagnostics: cut.diagnostics } };
  const path = decodeBodyId(placement.instance.body);
  if (path.kind !== "decoded") return fail(unit, "The placement body has no body path.");
  const checked = moduleOf(inputs, path.value.owner, unit);
  const body = findAscending(checked.module.bodies, placement.instance.body, item => item.body);
  if (body === undefined || body.owner !== path.value.owner) return fail(unit, "The placement body is not an actual body of its owner.");
  if (placement.kind === "callable-body") {
    if (path.value.role !== "function") return fail(unit, "A callable placement must name a function body.");
    const node = nodeOf(checked, body.owner, unit);
    if (node.tsonic === null || !("signatures" in node.tsonic)) return fail(unit, "The callable body owner has no endpoint inventory.");
    let selected: SignatureRequest | undefined;
    const ordinals = new Map<SignatureRequest["endpoint"], number>();
    for (const endpoint of node.tsonic.signatures) {
      const ordinal = ordinals.get(endpoint.role) ?? 0;
      ordinals.set(endpoint.role, ordinal + 1);
      if (endpoint.body !== body.body) continue;
      if (selected !== undefined) return fail(unit, "A callable execution body belongs to more than one endpoint.");
      selected = { definition: body.owner, endpoint: endpoint.role, ordinal, bindings: placement.instance.bindings };
    }
    if (selected === undefined) return fail(unit, "The callable body is not carried by any actual endpoint.");
    return endpointPlacement(inputs, selected, placement.parts, unit);
  }
  if (path.value.role === "function") return fail(unit, "An execution-only placement cannot replace a callable endpoint.");
  const completion = readType(inputs.types, placement.completion);
  if ((path.value.role === "module" || path.value.role === "class-static-initializer")
    && !(completion.kind === "intrinsic" && completion.intrinsic === "void") && completion.kind !== "error")
    return fail(unit, "Module and static-statement execution require their actual void normal completion.");
  let receiver: TyId | null = null;
  const parameters: SignatureParameter[] = [];
  const owners = new Map<DefId, OmissionInventory>();
  const formals = admitTypePublicationStep(inputs.typeWork, body.params.length);
  if (formals !== null) return { kind: "done", value: refuseTypeConstruction(inputs.typeWork, formals, body.root.origin, unit) };
  for (const [index, parameter] of body.params.entries()) {
    const node = parameterNode(checked, body, parameter.local, unit);
    const declaredType = node.tsonic.declaredType;
    if (declaredType.kind !== "available" || declaredType.value === null)
      return fail(unit, "An execution parameter needs its actual checked declared type, not a checker-slot guess.");
    const type = declaredType.value;
    if (parameter.role === "this") {
      if (index !== 0) return fail(unit, "An execution receiver must be the leading actual parameter.");
      receiver = type;
    } else {
      const owner = node.tsonic.parent;
      if (owner === null) return fail(unit, "An execution formal has no genuine checked owning callable endpoint inventory.");
      let inventory = owners.get(owner);
      if (inventory === undefined) {
        const admitted = omissionInventory(inputs, checked, owner, unit);
        if (admitted.kind === "refused") return { kind: "done", value: admitted };
        inventory = admitted.value;
        owners.set(owner, inventory);
      }
      const evidence = inventory.get(parameter.declaration);
      if (evidence === undefined || evidence.node !== node)
        return fail(unit, "An execution parameter has no matching checked declaration and source occurrence in its owning callable inventory.");
      parameters.push({ declaration: parameter.declaration, kind: parameter.role, type, passing: parameter.passing,
        initializer: parameter.initializer, acceptsOmission: evidence.formal.acceptsOmission });
    }
  }
  const signature = constructSignature(inputs, { declaration: null, owner: { kind: "body", value: { body: body.body, node: body.root.id } },
    composition: null, kind: "call", typeParameters: [], receiver, parameters, result: placement.completion }, unit, body.root.origin);
  if (signature.kind === "refused") return { kind: "done", value: signature };
  const bound = bindSignature(inputs, placement.instance.bindings, signature.value, body.root.origin, unit);
  if (bound.kind === "refused") return { kind: "done", value: bound };
  const errors = new Map<number | "receiver" | "result", ErrorValue>();
  if (placement.error !== null) errors.set("result", placement.error);
  return { kind: "done", value: { kind: "ok", ...placed(signatureValue(inputs, unit, bound.value, errors), null), diagnostics: [], emissions: [] } };
};

import type { ErrorValue, UnitRequest } from "../diag/contract.js";
import { throwInvariant } from "../diag/index.js";
import type { DefId, TyId } from "../ids/contract.js";
import { decodeBodyId, encodeKey } from "../ids/index.js";
import type { HirBody, HirNode } from "../ir-hir/contract.js";
import type { InferredPartType } from "../ir-infer/contract.js";
import type { Signature, SignatureParameter, SignatureRequest } from "../ir-types/contract.js";
import { internSignature, readSignature, readType } from "../ir-types/index.js";
import type { DeclsInputs, DeclsModule, DeclsStep, PlaceSignature } from "./contract.js";
import { assembleSignature, bindSignature, endpointOf, findAscending, inferredParts, moduleOf, resolvePart, signatureValue } from "./signatures.js";

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

function endpointPlacement(inputs: DeclsInputs, request: SignatureRequest, ready: readonly InferredPartType[], unit: UnitRequest): DeclsStep<Signature, never> {
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
  const value = first === undefined ? signatureValue(inputs, unit, bound.value, new Map())
    : assembleSignature(inputs, { request, signature: bound.value, parts: [first, ...rest] },
      ready.map(answer => resolvePart(answer, unit)), selected, unit);
  return { kind: "done", value: { kind: "ok", ...value, diagnostics: [], emissions: [] } };
}

function parameterType(checked: DeclsModule, body: HirBody, local: number, unit: UnitRequest): TyId {
  const reference = body.locals[local]?.declaration;
  const node = reference === undefined ? undefined : checked.nodes[reference.value.node];
  if (node?.kind !== "Parameter" || node.tsonic.declaredType.kind !== "available" || node.tsonic.declaredType.value === null)
    return fail(unit, "An execution parameter needs its actual checked declared type, not a checker-slot guess.");
  return node.tsonic.declaredType.value;
}

export const placeSignature: PlaceSignature = (inputs, placement, unit) => {
  if (placement.kind === "endpoint") return endpointPlacement(inputs, placement.request, placement.parts, unit);
  if (placement.kind !== "callable-body" && placement.kind !== "execution-body")
    return fail(unit, "Signature placement has no such closed request arm.");
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
  for (const [index, parameter] of body.params.entries()) {
    const type = parameterType(checked, body, parameter.local, unit);
    if (parameter.role === "this") {
      if (index !== 0) return fail(unit, "An execution receiver must be the leading actual parameter.");
      receiver = type;
    } else parameters.push({ declaration: parameter.declaration, kind: parameter.role, type, passing: parameter.passing,
      initializer: parameter.initializer });
  }
  const id = internSignature(inputs.types, { declaration: null, owner: { kind: "body", value: { body: body.body, node: body.root.id } },
    composition: null, kind: "call", typeParameters: [], receiver, parameters, result: placement.completion });
  const bound = bindSignature(inputs, placement.instance.bindings, readSignature(inputs.types, id), body.root.origin, unit);
  if (bound.kind === "refused") return { kind: "done", value: bound };
  const errors = new Map<number | "receiver" | "result", ErrorValue>();
  if (placement.error !== null) errors.set("result", placement.error);
  return { kind: "done", value: { kind: "ok", ...signatureValue(inputs, unit, bound.value, errors), diagnostics: [], emissions: [] } };
};

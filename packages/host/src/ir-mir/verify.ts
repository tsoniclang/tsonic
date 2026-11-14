import type { Violation } from "../diag/contract.js";
import type { BodyId, DefId, KeyData, LocalId, LocalRef, SigId, TyId } from "../ids/contract.js";
import { encodeKey } from "../ids/index.js";
import type { ArtifactBindings, BindingScope, BindingVector, BodyInstance, LiteralValue, PassingMode, TypeComponent, TypeTable, TypeTerm } from "../ir-types/contract.js";
import { artifactBindingsData, artifactBindingsKey, constantReferenceKey, instanceKey } from "../ir-types/index.js";
import type { ApplicationDecision, EmbeddingDecision, InferenceDeclaration } from "../ir-infer/contract.js";
import type { MemberSelection, ResolvedCallee, TirBody, TypedOperation } from "../ir-tir/contract.js";
import type { MirBody, MirConstantValue, MirRule, MirVerification, MirVerificationContext, MirViolationSite } from "./contract.js";
import { chargeWork, createWireTexts, densePosition, sourceNodes, validOrigin, verifyEdges, verifySelections } from "./verify-control.js";
import type { WorkMeter } from "./verify-control.js";
import { placeLocations, verifyStorage, verifyValues } from "./verify-storage.js";
import { verifyLaws } from "./verify-laws.js";
import type { SignatureReference } from "./verify-storage.js";
import { childPath, createScalarWires, rootPath, showPath } from "./text.js";
import { createDecisionWires } from "./text-decisions.js";
import type { TextPath } from "./text.js";

export interface TypeReference {
  readonly type: TyId;
  readonly site: MirViolationSite;
}

type GraphReference =
  | { readonly kind: "type"; readonly value: TyId }
  | { readonly kind: "signature"; readonly value: SigId };

interface TypeGraphNode {
  readonly reference: GraphReference;
  readonly parents: TypeGraphNode[];
  unresolved: boolean;
  open: boolean;
}

function componentReferences(component: TypeComponent, at: TextPath): readonly GraphReference[] {
  const references: GraphReference[] = [];
  const active = new Set<TypeComponent>();
  const pending: { readonly component: TypeComponent; readonly path: TextPath; readonly leave: boolean }[] =
    [{ component, path: at, leave: false }];
  for (let current = pending.pop(); current !== undefined; current = pending.pop()) {
      if (current.leave) { active.delete(current.component); continue; }
      if (active.has(current.component)) throw new TypeError(`Cyclic MIR value at ${showPath(current.path)}`);
      active.add(current.component);
      pending.push({ ...current, leave: true });
      for (let index = current.component.path.length - 1; index >= 0; index -= 1) {
        const selector = current.component.path[index];
        if (selector === undefined) throw new TypeError(`Sparse MIR value at ${showPath(current.path)}.path[${index}]`);
        switch (selector.kind) {
          case "sum-arm":
            for (const role of selector.family.roles) references.push({ kind: "type", value: role.member });
            pending.push({ component: selector.family.component,
              path: childPath(childPath(current.path, `.path[${index}]`), ".family.component"), leave: false });
            break;
          case "parameter": case "receiver": case "signature-tail": case "result":
            references.push({ kind: "signature", value: selector.signature });
            break;
          case "class-value": case "construction-argument": case "optional-value": case "array-element":
          case "tuple-element": case "union-member": case "argument-place": case "parameter-place":
          case "intersection-member": case "intersection-result": case "argument-tail": case "parameter-tail":
          case "member": case "index-key": case "index-value": case "projection-source": case "tuple-slice":
          case "type-argument": case "awaited": break;
        }
      }
  }
  return references;
}

function termReferences(term: TypeTerm, path: TextPath): readonly GraphReference[] {
  const references: GraphReference[] = [];
  const append = (values: readonly TyId[]): void => { for (const value of values) references.push({ kind: "type", value }); };
  switch (term.kind) {
    case "literal": append([term.base]); break;
    case "union": case "intersection": append(term.members); break;
    case "optional": append([term.value]); break;
    case "array": case "fixed-array": append([term.element]); break;
    case "tuple": for (const element of term.elements) append([element.type]); break;
    case "shape":
      for (const member of term.members) {
        if (member.read !== null) append([member.read]);
        if (member.write !== null) append([member.write]);
      }
      for (const index of term.indexes) {
        append([index.key, index.read]);
        if (index.write !== null) append([index.write]);
      }
      for (const signature of term.calls) references.push({ kind: "signature", value: signature });
      for (const signature of term.constructs) references.push({ kind: "signature", value: signature });
      break;
    case "callable":
      for (const signature of term.calls) references.push({ kind: "signature", value: signature });
      for (const signature of term.constructs) references.push({ kind: "signature", value: signature });
      break;
    case "declared": case "construction-reference": append(term.arguments); break;
    case "projection":
      append([term.source]);
      if (term.projection.kind === "component") for (const reference of componentReferences(term.projection.component, childPath(path, ".projection.component")))
        references.push(reference);
      break;
    case "primitive": case "string": case "intrinsic": case "enum": case "param": case "self": case "open": case "error": break;
  }
  return references;
}

export function verifyTypeReferences(
  types: TypeTable, references: readonly TypeReference[], signatures: readonly SignatureReference[],
): readonly Violation<MirRule, MirViolationSite>[] {
  const nodes = new Map<string, TypeGraphNode>();
  const pending: TypeGraphNode[] = [];
  const ensure = (reference: GraphReference): TypeGraphNode => {
    const key = encodeKey([reference.kind, reference.value]);
    const known = nodes.get(key);
    if (known !== undefined) return known;
    const node: TypeGraphNode = { reference, parents: [], unresolved: false, open: false };
    nodes.set(key, node);
    pending.push(node);
    return node;
  };
  const roots: { readonly site: MirViolationSite; readonly value: number; readonly node: TypeGraphNode }[] = [];
  const rootKeys = new Set<string>();
  const root = (reference: GraphReference, site: MirViolationSite): void => {
    const fields: KeyData[] = [site.kind, site.body];
    if ("local" in site) fields.push(site.local);
    if ("constant" in site) fields.push(site.constant);
    if ("place" in site) fields.push(site.place);
    if ("block" in site) fields.push(site.block);
    if ("statement" in site) fields.push(site.statement);
    fields.push(reference.kind, reference.value);
    const key = encodeKey(fields);
    if (rootKeys.has(key)) return;
    rootKeys.add(key);
    roots.push({ site, value: reference.value, node: ensure(reference) });
  };
  for (const reference of references) root({ kind: "type", value: reference.type }, reference.site);
  for (const reference of signatures) root({ kind: "signature", value: reference.signature }, reference.site);
  for (const node of pending) {
    const reference = node.reference;
    const children: GraphReference[] = [];
    if (reference.kind === "type") {
      const term = densePosition(reference.value, types.terms.length) ? types.terms[reference.value] : undefined;
      if (term === undefined) { node.unresolved = true; continue; }
      node.open = term.kind === "open" || term.kind === "error";
      for (const child of termReferences(term, childPath(rootPath, `.types.terms[${reference.value}]`))) children.push(child);
    } else {
      const signature = densePosition(reference.value, types.signatures.length) ? types.signatures[reference.value] : undefined;
      if (signature === undefined || !Object.is(signature.id, reference.value)) { node.unresolved = true; continue; }
      if (signature.receiver !== null) children.push({ kind: "type", value: signature.receiver });
      children.push({ kind: "type", value: signature.result });
      for (const parameter of signature.parameters) {
        if (parameter === undefined) { node.unresolved = true; continue; }
        children.push({ kind: "type", value: parameter.type });
      }
      for (const parameter of signature.typeParameters) {
        if (parameter === undefined) { node.unresolved = true; continue; }
        if (parameter.constraint !== null) children.push({ kind: "type", value: parameter.constraint });
        if (parameter.default !== null) children.push({ kind: "type", value: parameter.default });
      }
      if (signature.composition !== null) for (const composed of signature.composition.signatures)
        children.push({ kind: "signature", value: composed });
    }
    for (const child of children) ensure(child).parents.push(node);
  }
  for (const flag of ["unresolved", "open"]) {
    const waiting = Array.from(nodes.values()).filter(node => flag === "unresolved" ? node.unresolved : node.open);
    for (const node of waiting) {
      for (const parent of node.parents) {
        if (flag === "unresolved" ? parent.unresolved : parent.open) continue;
        if (flag === "unresolved") parent.unresolved = true;
        else parent.open = true;
        waiting.push(parent);
      }
    }
  }
  const violations: Violation<MirRule, MirViolationSite>[] = [];
  for (const { site, value, node } of roots) {
    if (node.unresolved) violations.push({ rule: "type-resolves", site, detail: [{ kind: "number", value }] });
    if (node.open) violations.push({ rule: "type-closed", site, detail: [{ kind: "number", value }] });
  }
  return violations;
}

function bindingsPresent(bindings: ArtifactBindings): boolean {
  if (bindings.kind === "parametric") return true;
  const vector = bindings.bindings;
  for (const rows of [vector.classBindings, vector.methodBindings, vector.capturedBindings, vector.selfBindings])
    for (const row of rows) if (row === undefined) return false;
  return true;
}

function literalKey(value: LiteralValue): KeyData {
  switch (value.kind) {
    case "number": return { kind: "record", fields: [["kind", value.kind], ["token", value.token],
      ["value", { kind: "record", fields: [["numerator", value.value.numerator], ["denominator", value.value.denominator],
        ["negativeZero", value.value.negativeZero]] }]] };
    case "bigint": return { kind: "record", fields: [["kind", value.kind], ["token", value.token], ["value", value.value]] };
    case "string": case "boolean": return { kind: "record", fields: [["kind", value.kind], ["value", value.value]] };
    case "absence": return { kind: "record", fields: [["kind", value.kind]] };
    case "unique-symbol": return { kind: "record", fields: [["kind", value.kind], ["declaration", value.declaration]] };
  }
}

/** The one ordering and uniqueness key of a constant, for the verifier and for producers. */
export function constantKey(type: TyId, value: MirConstantValue): string | null {
  const selected = constantValueKey(value);
  return selected === null ? null : encodeKey([type, selected]);
}

function constantValueKey(value: MirConstantValue): KeyData | null {
  switch (value.kind) {
    case "literal": return { kind: "record", fields: [["kind", value.kind], ["value", literalKey(value.value)]] };
    case "definition": case "metadata": {
      return !bindingsPresent(value.bindings) ? null : { kind: "record", fields: [["kind", value.kind],
        ["definition", value.definition], ["bindings", artifactBindingsData(value.bindings)]] };
    }
    case "observation": return { kind: "record", fields: [["kind", value.kind], ["at", { kind: "record", fields: [["body", value.at.body], ["node", value.at.node]] }]] };
    case "constant": {
      const selected = value.reference.initializer;
      return !bindingsPresent(selected.bindings) ? null : { kind: "record", fields: [["kind", value.kind],
        ["reference", constantReferenceKey(value.reference)]] };
    }
  }
}

function sameLocal(left: LocalRef, right: LocalRef): boolean {
  return left.body === right.body && Object.is(left.local, right.local);
}

export function verifyRows(
  body: MirBody, source: TirBody, types: TypeTable,
  declarationOf: (definition: DefId) => InferenceDeclaration | null,
): readonly Violation<MirRule, MirViolationSite>[] {
  const violations: Violation<MirRule, MirViolationSite>[] = [];
  const bodySite: MirViolationSite = { kind: "body", body: body.body };
  if (body.body !== source.body)
    violations.push({ rule: "body-owner", site: bodySite, detail: [] });
  if (!bindingsPresent(body.bindings) || artifactBindingsKey(body.bindings) !== artifactBindingsKey(source.bindings))
    violations.push({ rule: "bindings-complete", site: bodySite, detail: [] });
  if (declarationOf(source.owner) === null) violations.push({ rule: "definition-resolves", site: bodySite, detail: [] });
  const selectedSignature = densePosition(source.signature, types.signatures.length) ? types.signatures[source.signature] : undefined;
  const signature = selectedSignature !== undefined && Object.is(selectedSignature.id, source.signature) ? selectedSignature : undefined;
  if (signature === undefined) violations.push({ rule: "type-resolves", site: bodySite,
    detail: [{ kind: "number", value: source.signature }] });
  let receiverCount = 0;
  let receiverStorage: TyId | null = null;
  for (const local of body.locals) if (local !== undefined && local.role.kind === "receiver") {
    receiverCount += 1;
    receiverStorage = local.storage;
  }
  if (signature !== undefined && (signature.receiver === null ? receiverCount !== 0
    : receiverCount !== 1 || !Object.is(receiverStorage, signature.receiver)))
    violations.push({ rule: "body-receiver-exact", site: bodySite, detail: [] });
  const parameterModes = new Map<LocalId, PassingMode>();
  let receiverRow: TirBody["params"][number] | undefined;
  const parameterRows: TirBody["params"][number][] = [];
  for (const parameter of source.params) {
    parameterModes.set(parameter.local, parameter.passing);
    if (parameter.role === "this") receiverRow = parameter;
    else parameterRows.push(parameter);
  }
  for (const [position, local] of body.locals.entries()) {
    if (local === undefined || !Object.is(local.id, position)) violations.push({ rule: "local-id-dense", site: bodySite,
      detail: [{ kind: "number", value: position }] });
    if (local === undefined) continue;
    const site: MirViolationSite = { kind: "local", body: body.body, local: local.id };
    if (!validOrigin(local.origin)) violations.push({ rule: "origin-valid", site, detail: [] });
    if (local.role.kind === "capture") {
      const captured = densePosition(local.role.index, source.captures.length) ? source.captures[local.role.index] : undefined;
      // A capture row states its mode in every ready instance; it is null only in the parametric template of a body
      // whose creator saved the closure rule for instantiation.
      const template = source.dependence === "binding-dependent" && source.bindings.kind === "parametric";
      if (captured === undefined || local.source === null || !sameLocal(local.source, captured.local) || captured.capture === null && !template)
        violations.push({ rule: "capture-location-exact", site, detail: [] });
      if (captured !== undefined && local.mode !== captured.capture)
        violations.push({ rule: "local-storage-exact", site, detail: [] });
    } else {
      const parameter = local.role.kind === "receiver" ? receiverRow : local.role.kind === "parameter"
        ? densePosition(local.role.index, parameterRows.length) ? parameterRows[local.role.index] : undefined : null;
      const expectedMode = parameter === null ? local.source !== null && local.source.body === source.body
        ? parameterModes.get(local.source.local) ?? "local" : "local" : parameter?.passing;
      if (expectedMode !== undefined && local.mode !== expectedMode) violations.push({ rule: "local-storage-exact", site, detail: [] });
      if (local.source !== null) {
        const selected = densePosition(local.source.local, source.locals.length) ? source.locals[local.source.local] : undefined;
        if (local.source.body !== source.body || selected === undefined || !Object.is(selected.id, local.source.local))
          violations.push({ rule: "cross-owner-qualified", site, detail: [] });
        else if (!Object.is(local.storage, selected.storage)) violations.push({ rule: "projection-type", site, detail: [] });
      }
    }
  }
  // A local of role `receiver` or `parameter` names the source local of its row: the receiver the row of role `this`,
  // parameter i the i-th of the other rows. The laws read from that row whether the local is the caller's storage.
  for (const local of body.locals) {
    if (local === undefined || local.role.kind !== "receiver" && local.role.kind !== "parameter") continue;
    const row = local.role.kind === "receiver" ? receiverRow
      : densePosition(local.role.index, parameterRows.length) ? parameterRows[local.role.index] : undefined;
    if (row === undefined || local.source === null || local.source.body !== source.body || !Object.is(local.source.local, row.local))
      violations.push({ rule: "parameter-source-exact", site: { kind: "local", body: body.body, local: local.id }, detail: [] });
  }
  const constants = new Set<string>();
  let previous: string | null = null;
  for (const [position, constant] of body.constants.entries()) {
    if (constant === undefined || !Object.is(constant.id, position)) violations.push({ rule: "constant-id-dense", site: bodySite,
      detail: [{ kind: "number", value: position }] });
    if (constant === undefined) continue;
    const site: MirViolationSite = { kind: "constant", body: body.body, constant: constant.id };
    const key = constantKey(constant.type, constant.value);
    if (key === null) { violations.push({ rule: "bindings-complete", site, detail: [] }); continue; }
    if (constants.has(key)) violations.push({ rule: "constant-unique", site, detail: [] });
    constants.add(key);
    if (previous !== null && previous > key) violations.push({ rule: "constants-order", site, detail: [] });
    previous = key;
    if ((constant.value.kind === "definition" || constant.value.kind === "metadata") && declarationOf(constant.value.definition) === null)
      violations.push({ rule: "definition-resolves", site, detail: [] });
    if (constant.value.kind === "literal" && constant.value.value.kind === "unique-symbol"
      && declarationOf(constant.value.value.declaration) === null) violations.push({ rule: "definition-resolves", site, detail: [] });
  }
  for (const [position, place] of body.places.entries()) {
    if (place === undefined || !Object.is(place.id, position)) violations.push({ rule: "place-id-dense", site: bodySite,
      detail: [{ kind: "number", value: position }] });
    if (place === undefined) continue;
    const site: MirViolationSite = { kind: "place", body: body.body, place: place.id };
    if (!validOrigin(place.origin)) violations.push({ rule: "origin-valid", site, detail: [] });
    switch (place.base.kind) {
      case "local": {
        const local = densePosition(place.base.local, body.locals.length) ? body.locals[place.base.local] : undefined;
        if (local === undefined || !Object.is(local.id, place.base.local)) violations.push({ rule: "place-root-resolves", site, detail: [] });
        else if (!Object.is(local.storage, place.storage)) violations.push({ rule: "projection-type", site, detail: [] });
        break;
      }
      case "static":
        if (declarationOf(place.base.definition) === null) violations.push({ rule: "definition-resolves", site, detail: [] });
        break;
      case "place": case "checked":
        if (!densePosition(place.base.place, position)) violations.push({ rule: "place-parent-precedes", site, detail: [] });
        else if (body.places[place.base.place] === undefined) violations.push({ rule: "place-root-resolves", site, detail: [] });
        break;
    }
  }
  for (const [position, block] of body.blocks.entries()) {
    if (block === undefined || !Object.is(block.id, position)) violations.push({ rule: "block-id-dense", site: bodySite,
      detail: [{ kind: "number", value: position }] });
  }
  return violations;
}

function vectorFits(vector: BindingVector, scope: BindingScope): boolean {
  for (const family of [
    { bindings: vector.classBindings, parameters: scope.classParameters },
    { bindings: vector.methodBindings, parameters: scope.methodParameters },
    { bindings: vector.capturedBindings, parameters: scope.capturedParameters },
  ]) {
    const { bindings, parameters } = family;
    if (bindings.length !== parameters.length) return false;
    for (const [position, binding] of bindings.entries()) {
      const parameter = parameters[position];
      if (binding === undefined || parameter === undefined || binding.parameter.owner !== parameter.owner
        || !Object.is(binding.parameter.index, parameter.index)) return false;
    }
  }
  if (vector.selfBindings.length !== scope.selfOwners.length) return false;
  for (const [position, binding] of vector.selfBindings.entries()) {
    if (binding === undefined || binding.owner !== scope.selfOwners[position]) return false;
  }
  return true;
}

function decisionReferences(
  body: MirBody, context: MirVerificationContext, types: TypeReference[], signatures: SignatureReference[],
): readonly Violation<MirRule, MirViolationSite>[] {
  const violations: Violation<MirRule, MirViolationSite>[] = [];
  const vector = (value: BindingVector, owner: DefId | null, site: MirViolationSite): void => {
    for (const family of [value.classBindings, value.methodBindings, value.capturedBindings])
      for (const binding of family) if (binding !== undefined && binding.kind === "bound") types.push({ type: binding.type, site });
    for (const binding of value.selfBindings) if (binding !== undefined && binding.kind === "bound") types.push({ type: binding.type, site });
    if (owner !== null) {
      const declaration = context.declarationOf(owner);
      if (declaration !== null && !vectorFits(value, declaration.scope)) violations.push({ rule: "bindings-complete", site, detail: [] });
    }
  };
  const artifact = (value: ArtifactBindings, owner: DefId | null, site: MirViolationSite): void => {
    if (value.kind === "instantiated") vector(value.bindings, owner, site);
  };
  const instance = (value: BodyInstance, site: MirViolationSite): void => {
    const owner = context.bodyOwner(value.body);
    if (owner === null || context.declarationOf(owner) === null)
      violations.push({ rule: "definition-resolves", site, detail: [] });
    artifact(value.bindings, owner, site);
  };
  const component = (value: TypeComponent, site: MirViolationSite, path: TextPath): void => {
    for (const reference of componentReferences(value, path)) {
      if (reference.kind === "type") types.push({ type: reference.value, site });
      else signatures.push({ signature: reference.value, site });
    }
  };
  const embedding = (value: EmbeddingDecision, site: MirViolationSite, path: TextPath): void => {
    if (value.kind === "conversion") for (const [position, step] of value.proof.steps.entries()) {
      const stepPath = childPath(path, `.proof.steps[${position}]`);
      component(step.from, site, childPath(stepPath, ".from"));
      component(step.to, site, childPath(stepPath, ".to"));
    }
  };
  const application = (value: ApplicationDecision, site: MirViolationSite): void => {
    vector(value.bindings, value.advertised.declaration, site);
    vector(value.implementationBindings, value.api.declaration, site);
    for (const endpoint of [value.advertised, value.api, value.completion]) signatures.push({ signature: endpoint.signature, site });
    types.push({ type: value.result, site }, { type: value.completion.completion, site });
    if (value.completion.yielded !== null) types.push({ type: value.completion.yielded, site });
    if (value.completion.sent !== null) types.push({ type: value.completion.sent, site });
    for (const parameter of value.parameters) if (parameter.kind === "omitted") types.push({ type: parameter.type, site });
  };
  const callee = (value: ResolvedCallee, site: MirViolationSite): void => {
    application(value.decision, site);
    if (value.activation !== null) instance(value.activation, site);
  };
  const member = (value: MemberSelection, site: MirViolationSite): void => {
    const decision = value.decision;
    vector(decision.bindings, decision.primary, site);
    if (decision.read !== null) types.push({ type: decision.read, site });
    if (decision.write !== null) types.push({ type: decision.write, site });
    if (decision.getter !== null) signatures.push({ signature: decision.getter.signature, site });
    if (decision.setter !== null) signatures.push({ signature: decision.setter.signature, site });
    if (value.getter !== null) callee(value.getter, site);
    if (value.setter !== null) callee(value.setter, site);
  };
  const operation = (value: TypedOperation, site: MirViolationSite, path: TextPath): void => {
    for (const type of value.decision.operands) types.push({ type, site });
    types.push({ type: value.decision.result, site });
    const selected = value.decision.operation;
    const identityPath = childPath(path, ".decision.operation");
    switch (selected.kind) {
      case "library": case "core": vector(selected.bindings, selected.declaration, site); break;
      case "conversion":
        types.push({ type: selected.from, site }, { type: selected.to, site });
        embedding(selected.embedding, site, childPath(identityPath, ".embedding"));
        break;
      case "object-construction": case "array-construction":
        for (const [position, part] of selected.parts.entries()) {
          const partPath = childPath(identityPath, `.parts[${position}]`);
          component(part.destination, site, childPath(partPath, ".destination"));
          embedding(part.embedding, site, childPath(partPath, ".embedding"));
          if (part.member !== null) {
            vector(part.member.bindings, part.member.primary, site);
            if (part.member.read !== null) types.push({ type: part.member.read, site });
            if (part.member.write !== null) types.push({ type: part.member.write, site });
          }
        }
        break;
      case "protocol":
        types.push({ type: selected.value, site }, { type: selected.completion, site }, { type: selected.thrown, site });
        if (selected.yielded !== null) types.push({ type: selected.yielded, site });
        if (selected.sent !== null) types.push({ type: selected.sent, site });
        for (const step of selected.steps) {
          for (const type of step.operands) types.push({ type, site });
          types.push({ type: step.result, site });
          switch (step.operation.kind) {
            case "call": application(step.operation.application, site); break;
            case "core": vector(step.operation.bindings, step.operation.declaration, site); break;
            case "completion": break;
          }
        }
        break;
      case "native-operator": case "bigint-operator": case "string-operator": case "boolean-operator": case "absence-test":
      case "pointer-address": case "pointer-read": case "pointer-write": case "pointer-offset": case "type-query": case "discard": break;
    }
  };
  artifact(body.bindings, context.source.owner, { kind: "body", body: body.body });
  for (const constant of body.constants) {
    if (constant === undefined) continue;
    const site: MirViolationSite = { kind: "constant", body: body.body, constant: constant.id };
    const value = constant.value;
    if (value.kind === "definition" || value.kind === "metadata") artifact(value.bindings, value.definition, site);
    if (value.kind === "constant") instance(value.reference.initializer, site);
  }
  for (const place of body.places) if (place !== undefined && (place.base.kind === "place" || place.base.kind === "checked") && place.base.projection.kind === "field")
    member(place.base.projection.member, { kind: "place", body: body.body, place: place.id });
  for (const [blockPosition, block] of body.blocks.entries()) {
    if (block === undefined) continue;
    const blockPath = childPath(rootPath, `.blocks[${blockPosition}]`);
    for (const [position, statement] of block.statements.entries()) {
      if (statement.kind !== "assign") continue;
      const site: MirViolationSite = { kind: "instruction", body: body.body, block: block.id, statement: position };
      const value = statement.value;
      if (value.kind === "unary" || value.kind === "binary" || value.kind === "convert")
        operation(value.operation, site, childPath(blockPath, `.statements[${position}].value.operation`));
      if (value.kind === "aggregate" && (value.aggregate.kind === "object" || value.aggregate.kind === "record"))
        for (const field of value.aggregate.fields) member(field.member, site);
      if (value.kind === "closure") instance(value.instance, site);
    }
    const site: MirViolationSite = { kind: "instruction", body: body.body, block: block.id, statement: null };
    if (block.terminator.kind === "call") {
      if (block.terminator.callee.kind === "body") instance(block.terminator.callee.instance, site);
      else callee(block.terminator.callee.resolution, site);
    }
    if (block.terminator.kind === "invoke") operation(block.terminator.operation, site, childPath(blockPath, ".terminator.operation"));
  }
  return violations;
}

export function verifyBody(body: MirBody, context: MirVerificationContext): MirVerification {
  // The caller sets the limit; a value that is not a count is the caller's defect, as in the query kernel.
  const maximumWork = context.limits.maximumWork;
  if (!Number.isInteger(maximumWork) || maximumWork < 0) throw new TypeError("ir-mir: maximumWork must be a finite nonnegative integer");
  // One account for this body: every pass charges it, and it is not reset between passes.
  const meter: WorkMeter = { spent: 0, maximum: maximumWork, exhausted: false };
  const refusal: MirVerification = { kind: "resource-limit", body: body.body, dimension: "work", maximum: meter.maximum };
  const declarations = new Map<DefId, InferenceDeclaration | null>();
  const owners = new Map<BodyId, DefId | null>();
  const declarationOf = (definition: DefId): InferenceDeclaration | null => {
    const known = declarations.get(definition);
    if (known !== undefined) return known;
    const selected = context.declarationOf(definition);
    declarations.set(definition, selected);
    return selected;
  };
  const bodyOwner = (body: BodyId): DefId | null => {
    const known = owners.get(body);
    if (known !== undefined) return known;
    const selected = context.bodyOwner(body);
    owners.set(body, selected);
    return selected;
  };
  const input: MirVerificationContext = { limits: context.limits, source: context.source, bodyOf: context.bodyOf, types: context.types, declarationOf, bodyOwner };
  const wires = createDecisionWires(createScalarWires());
  const texts = createWireTexts(wires);
  const nodes = sourceNodes(input.source, texts);
  const rows = verifyRows(body, input.source, input.types, declarationOf);
  const places = placeLocations(body);
  const values = verifyValues(body, input, nodes, places, meter);
  if (meter.exhausted) return refusal;
  const types: TypeReference[] = [...values.types];
  const signatures: SignatureReference[] = [...values.signatures];
  const decisions = decisionReferences(body, input, types, signatures);
  const edges = verifyEdges(body);
  const keyOf = (selected: BodyInstance): string | null => {
    const bindings = selected.bindings;
    const size = bindings.kind === "parametric" ? 0 : bindings.bindings.classBindings.length + bindings.bindings.methodBindings.length
      + bindings.bindings.capturedBindings.length + bindings.bindings.selfBindings.length;
    chargeWork(meter, 1 + size);
    return meter.exhausted || !bindingsPresent(bindings) ? null : instanceKey(selected);
  };
  const internal = new Map<string, TirBody | null>();
  const selections = verifySelections(body, input, nodes, texts, selected => {
    const key = keyOf(selected);
    if (key === null) return undefined;
    let target = internal.get(key);
    if (target === undefined) {
      target = input.bodyOf(selected);
      if (target !== null) {
        const actual = keyOf({ body: target.body, bindings: target.bindings });
        if (meter.exhausted) return undefined;
        if (actual !== key) target = null;
      }
      internal.set(key, target);
    }
    return target ?? undefined;
  }, meter);
  if (meter.exhausted) return refusal;
  const storage = verifyStorage(body, places, meter);
  if (meter.exhausted) return refusal;
  const laws = verifyLaws(body, input, nodes, texts, places, meter);
  // Past the limit the body is neither accepted nor found invalid: the findings gathered so far are not an answer,
  // and the remaining passes are not run.
  if (meter.exhausted) return refusal;
  const violations: Violation<MirRule, MirViolationSite>[] = [];
  for (const family of [rows, values.violations, edges, selections, storage, laws, decisions,
    verifyTypeReferences(input.types, types, signatures)]) for (const violation of family) violations.push(violation);
  return { kind: "complete", violations };
}

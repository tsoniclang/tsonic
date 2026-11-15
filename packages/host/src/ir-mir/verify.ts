import type { Violation } from "../diag/contract.js";
import type { BodyId, DefId, KeyData, LocalId, LocalRef, TyId } from "../ids/contract.js";
import { encodeKey } from "../ids/index.js";
import type { ArtifactBindings, BindingScope, BindingVector, BodyInstance, LiteralValue, PassingMode, TypeComponent, TypeTable } from "../ir-types/contract.js";
import { artifactBindingsData, artifactBindingsKey, constantReferenceKey, instanceKey } from "../ir-types/index.js";
import type { ApplicationDecision, EmbeddingDecision, InferenceDeclaration } from "../ir-infer/contract.js";
import type { MemberSelection, ResolvedCallee, TirBody, TypedOperation } from "../ir-tir/contract.js";
import type { MirBody, MirConstantValue, MirRule, MirVerification, MirVerificationContext, MirViolationSite } from "./contract.js";
import { chargeWork, createWireTexts, densePosition, sourceNodes, validOrigin, verifyEdges, verifySelections } from "./verify-control.js";
import type { WorkMeter } from "./verify-control.js";
import { placeLocations, verifyStorage, verifyValues } from "./verify-storage.js";
import { verifyLaws } from "./verify-laws.js";
import { componentReferences, verifyTypeReferences } from "./verify-types.js";
import type { SignatureReference, TypeReference } from "./verify-types.js";
import { childPath, createScalarWires, rootPath } from "./text.js";
import { createDecisionWires } from "./text-decisions.js";
import type { TextPath } from "./text.js";


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
  let receiverRow: TirBody["params"][number]["tsonic"] | undefined;
  const parameterRows: TirBody["params"][number]["tsonic"][] = [];
  for (const header of source.params) {
    const parameter = header.tsonic;
    parameterModes.set(parameter.local.local, parameter.passing);
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
    if (row === undefined || local.source === null || local.source.body !== source.body || !Object.is(local.source.local, row.local.local))
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

function vectorFits(vector: BindingVector, scope: BindingScope, meter: WorkMeter): boolean {
  for (const family of [
    { bindings: vector.classBindings, parameters: scope.classParameters },
    { bindings: vector.methodBindings, parameters: scope.methodParameters },
    { bindings: vector.capturedBindings, parameters: scope.capturedParameters },
  ]) {
    const { bindings, parameters } = family;
    if (bindings.length !== parameters.length) return false;
    chargeWork(meter, bindings.length);
    if (meter.exhausted) return false;
    for (const [position, binding] of bindings.entries()) {
      const parameter = parameters[position];
      if (binding === undefined || parameter === undefined || binding.parameter.owner !== parameter.owner
        || !Object.is(binding.parameter.index, parameter.index)) return false;
    }
  }
  if (vector.selfBindings.length !== scope.selfOwners.length) return false;
  chargeWork(meter, vector.selfBindings.length);
  if (meter.exhausted) return false;
  for (const [position, binding] of vector.selfBindings.entries()) {
    if (binding === undefined || binding.owner !== scope.selfOwners[position]) return false;
  }
  return true;
}

export function decisionReferences(
  body: MirBody, context: MirVerificationContext, types: TypeReference[], signatures: SignatureReference[], meter: WorkMeter,
): readonly Violation<MirRule, MirViolationSite>[] {
  const violations: Violation<MirRule, MirViolationSite>[] = [];
  if (meter.exhausted) return violations;
  const admit = (count: number): boolean => { chargeWork(meter, count); return !meter.exhausted; };
  const vector = (value: BindingVector, owner: DefId | null, site: MirViolationSite): void => {
    for (const family of [value.classBindings, value.methodBindings, value.capturedBindings]) {
      if (!admit(family.length)) return;
      for (const binding of family) if (binding !== undefined && binding.kind === "bound") types.push({ type: binding.type, site });
    }
    if (!admit(value.selfBindings.length)) return;
    for (const binding of value.selfBindings) if (binding !== undefined && binding.kind === "bound") types.push({ type: binding.type, site });
    if (owner !== null) {
      if (!admit(1)) return;
      const declaration = context.declarationOf(owner);
      if (declaration !== null) {
        const fits = vectorFits(value, declaration.scope, meter);
        if (meter.exhausted) return;
        if (!fits) violations.push({ rule: "bindings-complete", site, detail: [] });
      }
    }
  };
  const artifact = (value: ArtifactBindings, owner: DefId | null, site: MirViolationSite): void => {
    if (value.kind === "instantiated") vector(value.bindings, owner, site);
  };
  const instance = (value: BodyInstance, site: MirViolationSite): void => {
    if (!admit(1)) return;
    const owner = context.bodyOwner(value.body);
    if (owner === null || context.declarationOf(owner) === null)
      violations.push({ rule: "definition-resolves", site, detail: [] });
    artifact(value.bindings, owner, site);
  };
  const component = (value: TypeComponent, site: MirViolationSite, path: TextPath): void => {
    const references = componentReferences(value, path, meter, []);
    if (!admit(references.length)) return;
    for (const reference of references) {
      if (reference.kind === "type") types.push({ type: reference.value, site });
      else signatures.push({ signature: reference.value, site });
    }
  };
  const embedding = (value: EmbeddingDecision, site: MirViolationSite, path: TextPath): void => {
    if (value.kind === "conversion") {
      if (!admit(value.proof.steps.length)) return;
      for (const [position, step] of value.proof.steps.entries()) {
      const stepPath = childPath(path, `.proof.steps[${position}]`);
      component(step.from, site, childPath(stepPath, ".from"));
      if (meter.exhausted) return;
      component(step.to, site, childPath(stepPath, ".to"));
      if (meter.exhausted) return;
      }
    }
  };
  const application = (value: ApplicationDecision, site: MirViolationSite): void => {
    if (!admit(7 + value.parameters.length)) return;
    vector(value.bindings, value.advertised.declaration, site);
    if (meter.exhausted) return;
    vector(value.implementationBindings, value.api.declaration, site);
    if (meter.exhausted) return;
    for (const endpoint of [value.advertised, value.api, value.completion]) signatures.push({ signature: endpoint.signature, site });
    types.push({ type: value.result, site }, { type: value.completion.completion, site });
    if (value.completion.yielded !== null) types.push({ type: value.completion.yielded, site });
    if (value.completion.sent !== null) types.push({ type: value.completion.sent, site });
    for (const parameter of value.parameters) if (parameter.kind === "omitted") types.push({ type: parameter.type, site });
  };
  const callee = (value: ResolvedCallee, site: MirViolationSite): void => {
    application(value.decision, site);
    if (meter.exhausted) return;
    if (value.activation !== null) instance(value.activation, site);
  };
  const member = (value: MemberSelection, site: MirViolationSite): void => {
    if (!admit(4)) return;
    const decision = value.decision;
    vector(decision.bindings, decision.primary, site);
    if (meter.exhausted) return;
    if (decision.read !== null) types.push({ type: decision.read, site });
    if (decision.write !== null) types.push({ type: decision.write, site });
    if (decision.getter !== null) signatures.push({ signature: decision.getter.signature, site });
    if (decision.setter !== null) signatures.push({ signature: decision.setter.signature, site });
    if (value.getter !== null) callee(value.getter, site);
    if (meter.exhausted) return;
    if (value.setter !== null) callee(value.setter, site);
  };
  const operation = (value: TypedOperation, site: MirViolationSite, path: TextPath): void => {
    if (!admit(value.decision.operands.length + 1)) return;
    for (const type of value.decision.operands) types.push({ type, site });
    types.push({ type: value.decision.result, site });
    const selected = value.decision.operation;
    const identityPath = childPath(path, ".decision.operation");
    switch (selected.kind) {
      case "library": case "core": vector(selected.bindings, selected.declaration, site); break;
      case "conversion":
        if (!admit(2)) return;
        types.push({ type: selected.from, site }, { type: selected.to, site });
        embedding(selected.embedding, site, childPath(identityPath, ".embedding"));
        break;
      case "object-construction": case "array-construction":
        if (!admit(selected.parts.length)) return;
        for (const [position, part] of selected.parts.entries()) {
          const partPath = childPath(identityPath, `.parts[${position}]`);
          component(part.destination, site, childPath(partPath, ".destination"));
          if (meter.exhausted) return;
          embedding(part.embedding, site, childPath(partPath, ".embedding"));
          if (meter.exhausted) return;
          if (part.member !== null) {
            vector(part.member.bindings, part.member.primary, site);
            if (!admit(2)) return;
            if (part.member.read !== null) types.push({ type: part.member.read, site });
            if (part.member.write !== null) types.push({ type: part.member.write, site });
          }
        }
        break;
      case "protocol":
        if (!admit(5 + selected.steps.length)) return;
        types.push({ type: selected.value, site }, { type: selected.completion, site }, { type: selected.thrown, site });
        if (selected.yielded !== null) types.push({ type: selected.yielded, site });
        if (selected.sent !== null) types.push({ type: selected.sent, site });
        for (const step of selected.steps) {
          if (!admit(step.operands.length + 1)) return;
          for (const type of step.operands) types.push({ type, site });
          types.push({ type: step.result, site });
          switch (step.operation.kind) {
            case "call": application(step.operation.application, site); break;
            case "core": vector(step.operation.bindings, step.operation.declaration, site); break;
            case "completion": break;
          }
          if (meter.exhausted) return;
        }
        break;
      case "native-operator": case "bigint-operator": case "string-operator": case "boolean-operator": case "absence-test":
      case "pointer-address": case "pointer-read": case "pointer-write": case "pointer-offset": case "type-query": case "discard": break;
    }
  };
  artifact(body.bindings, context.source.owner, { kind: "body", body: body.body });
  if (meter.exhausted) return [];
  if (!admit(body.constants.length)) return [];
  for (const constant of body.constants) {
    if (constant === undefined) continue;
    const site: MirViolationSite = { kind: "constant", body: body.body, constant: constant.id };
    const value = constant.value;
    if (value.kind === "definition" || value.kind === "metadata") artifact(value.bindings, value.definition, site);
    if (meter.exhausted) return [];
    if (value.kind === "constant") instance(value.reference.initializer, site);
    if (meter.exhausted) return [];
  }
  if (!admit(body.places.length)) return [];
  for (const place of body.places) {
    if (place !== undefined && (place.base.kind === "place" || place.base.kind === "checked") && place.base.projection.kind === "field")
      member(place.base.projection.member, { kind: "place", body: body.body, place: place.id });
    if (meter.exhausted) return [];
  }
  if (!admit(body.blocks.length)) return [];
  for (const [blockPosition, block] of body.blocks.entries()) {
    if (block === undefined) continue;
    const blockPath = childPath(rootPath, `.blocks[${blockPosition}]`);
    if (!admit(block.statements.length + 1)) return [];
    for (const [position, statement] of block.statements.entries()) {
      if (statement.kind !== "assign") continue;
      const site: MirViolationSite = { kind: "instruction", body: body.body, block: block.id, statement: position };
      const value = statement.value;
      if (value.kind === "unary" || value.kind === "binary" || value.kind === "convert")
        operation(value.operation, site, childPath(blockPath, `.statements[${position}].value.operation`));
      if (meter.exhausted) return [];
      if (value.kind === "aggregate" && (value.aggregate.kind === "object" || value.aggregate.kind === "record")) {
        if (!admit(value.aggregate.fields.length)) return [];
        for (const field of value.aggregate.fields) {
          member(field.member, site);
          if (meter.exhausted) return [];
        }
      }
      if (value.kind === "closure") instance(value.instance, site);
      if (meter.exhausted) return [];
    }
    const site: MirViolationSite = { kind: "instruction", body: body.body, block: block.id, statement: null };
    if (block.terminator.kind === "call") {
      if (block.terminator.callee.kind === "body") instance(block.terminator.callee.instance, site);
      else callee(block.terminator.callee.resolution, site);
    }
    if (block.terminator.kind === "invoke") operation(block.terminator.operation, site, childPath(blockPath, ".terminator.operation"));
    if (meter.exhausted) return [];
  }
  return violations;
}

export function verifyBody(body: MirBody, context: MirVerificationContext): MirVerification {
  // The caller sets the limit; a value that is not a count is the caller's defect, as in the query kernel.
  const maximumWork = context.limits.maximumWork;
  if (!Number.isSafeInteger(maximumWork) || maximumWork < 0 || Object.is(maximumWork, -0)) throw new TypeError("ir-mir: maximumWork must be a safe nonnegative count");
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
  const input: MirVerificationContext = { selectedNativeFacts: context.selectedNativeFacts, limits: context.limits,
    source: context.source, bodyOf: context.bodyOf, types: context.types, declarationOf, bodyOwner };
  const wires = createDecisionWires(createScalarWires());
  const texts = createWireTexts(wires);
  const nodes = sourceNodes(input.source, texts);
  const rows = verifyRows(body, input.source, input.types, declarationOf);
  const places = placeLocations(body);
  const values = verifyValues(body, input, nodes, places, meter);
  if (meter.exhausted) return refusal;
  const types = values.types;
  const signatures = values.signatures;
  const decisions = decisionReferences(body, input, types, signatures, meter);
  if (meter.exhausted) return refusal;
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
  const references = verifyTypeReferences(input.types, types, signatures, meter);
  if (meter.exhausted) return refusal;
  const violations: Violation<MirRule, MirViolationSite>[] = [];
  for (const family of [rows, values.violations, edges, selections, storage, laws, decisions,
    references]) for (const violation of family) violations.push(violation);
  return { kind: "complete", violations };
}

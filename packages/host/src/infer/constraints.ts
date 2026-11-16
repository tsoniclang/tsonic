import type { Diagnostic } from "../diag/contract.js";
import type { BodyId, DefId, LocalId, LocalRef, NodeId, NodeRef, SourceNodeRef, TyId } from "../ids/contract.js";
import type { BindingVector, CategoryEvidence, Signature } from "../ir-types/contract.js";
import type { Expression, HirBody, HirNode, HirParam, CheckedPhase } from "../ir-hir/contract.js";
import type { CallConstraint, FlowConstraint, InferenceCandidateList, InferenceGroup, InferenceValue, InferenceVariable, InferredPartType, InferredSignaturePart, MemberConstraint, OperatorConstraint } from "../ir-infer/contract.js";
import type { ConstraintsOf, ConstraintsPaused, ConstraintsRequest, GroupConstraints, InferDeps, InferStep, ResumeConstraintsOf } from "./contract.js";
import { requirePresent, resourceLimitDiagnostic } from "../diag/index.js";
import { internType, readType, signatureRequestKey } from "../ir-types/index.js";
import { inferredPartKey, inferredPartsOf } from "../ir-infer/index.js";
import { resolveModuleBinding } from "../ir-hir/index.js";
import { callerDefect, notInferredYet, validateInferenceLimits } from "./frontier.js";
import { ownSignatureRequest } from "./own-signature.js";
import { callableEndpoints, candidateEndpoint, endpointRequest, unavailableCandidate } from "./candidates.js";

const PORT = "ConstraintsOf";
const RESUME = "ResumeConstraintsOf";
const TEMPLATE: BindingVector = { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] };

type Output = InferStep<GroupConstraints, ConstraintsRequest, ConstraintsPaused>;
type Slot = TyId | { readonly part: InferredSignaturePart };
interface ParameterPosition {
  readonly parameter: HirParam;
  readonly index: number;
}
type ParameterIndex = Map<BodyId, ReadonlyMap<LocalId, ParameterPosition>>;
type DraftConstraint =
  | Omit<FlowConstraint, "from" | "to"> & { readonly from: Slot; readonly to: Slot }
  | Omit<OperatorConstraint, "operands" | "result"> & { readonly operands: readonly Slot[]; readonly result: Slot }
  | Omit<MemberConstraint, "receiver" | "result"> & { readonly receiver: Slot; readonly result: Slot }
  | CallConstraint;

interface Draft {
  readonly body: HirBody;
  readonly variables: InferenceVariable[];
  readonly constraints: DraftConstraint[];
  readonly evidence: { readonly type: Slot; readonly node: Expression<CheckedPhase> | HirNode; readonly component: SourceNodeRef }[];
}

interface Generation {
  readonly deps: InferDeps;
  readonly group: InferenceGroup;
  readonly parts: ReadonlyMap<BodyId, readonly InferredSignaturePart[]>;
  readonly partTypes: Map<string, TyId>;
  readonly ownParts: ReadonlySet<string>;
  readonly ownDefinitions: ReadonlySet<DefId>;
  readonly signatures: ReadonlyMap<string, Signature>;
  readonly parameters: ParameterIndex;
  readonly outsideParts: ReadonlyMap<string, InferredPartType>;
  nextVariable: number;
}

interface Walk {
  readonly generation: Generation;
  readonly draft: Draft;
  readonly signature: Signature | undefined;
  readonly typeOf: Map<NodeId, Slot>;
  readonly operators: Map<NodeId, TyId>;
}

type Frame = { readonly kind: "enter" | "leave"; readonly node: HirNode };

export const constraintsOf: ConstraintsOf = (deps, group) => {
  validateInferenceLimits(PORT, deps.limits, deps.graph);
  if (group.bodies.length === 0) return callerDefect(PORT, "a constraint invocation requires a nonempty group");
  const requests: ConstraintsRequest[] = [];
  const requestBodies: BodyId[] = [];
  const ownDefinitions = new Set(group.signatures.map(part => part.definition));
  const ownParts = new Set(group.signatures.map(inferredPartKey));
  const requestedParts = new Set<string>();
  const requestedSignatures = new Set<string>();
  const parameters: ParameterIndex = new Map();
  const signatureRequest = (body: BodyId, request: Extract<ConstraintsRequest, { readonly kind: "declaredSignatureOf" }>): void => {
    const key = signatureRequestKey(request.request);
    if (requestedSignatures.has(key)) return;
    requestedSignatures.add(key);
    requests.push(request);
    requestBodies.push(body);
  };
  for (const reference of group.bodies) {
    const body = deps.hirBody(reference);
    if (body.body !== reference) return callerDefect(PORT, "a checked body belongs to another complete body identity");
    const request = ownSignatureRequest(deps, body, PORT, ownDefinitions);
    if (request !== null) signatureRequest(reference, request);
    else if (ownDefinitions.has(body.owner)) for (const part of inferredPartsOf(body.owner, deps.itemOf(body.owner))) {
      const key = inferredPartKey(part);
      if (!ownParts.has(key) && !requestedParts.has(key)) {
        requestedParts.add(key);
        requests.push({ kind: "inferred-part", part });
        requestBodies.push(reference);
      }
    }
    for (const local of body.locals) {
      if (local.role !== "binding") continue;
      const binding = localBinding(deps, { body: reference, local: local.id });
      const declared = binding.declaration.tsonic.declaredType;
      if (declared.kind !== "available") return notInferredYet(PORT, "the actual declaration type availability of a local", binding.declaration.origin);
      if (declared.value !== null) continue;
      const part: InferredSignaturePart = { definition: binding.definition, part: { kind: "variable" } };
      const key = inferredPartKey(part);
      if (!ownParts.has(key) && !requestedParts.has(key)) {
        requestedParts.add(key);
        requests.push({ kind: "inferred-part", part });
        requestBodies.push(reference);
      }
    }
    for (const capture of body.captures) {
      const owner = deps.hirBody(capture.body);
      const selected = parametersOf(parameters, owner).get(capture.local);
      if (selected === undefined) continue;
      const declaration = parameterDeclaration(deps, owner, selected.parameter);
      const checked = declaration.tsonic.declaredType;
      if (checked.kind !== "available") return notInferredYet(PORT, "the actual captured parameter type availability", declaration.origin);
      if (checked.value !== null || selected.parameter.initializer === null) continue;
      const part: InferredSignaturePart = { definition: owner.owner, part: { kind: "parameter-initializer", index: selected.index } };
      const key = inferredPartKey(part);
      if (!ownParts.has(key) && !requestedParts.has(key)) {
        requestedParts.add(key);
        requests.push({ kind: "inferred-part", part });
        requestBodies.push(reference);
      }
    }
    for (const list of body.candidateLists) for (const candidate of list.candidates) {
      if (unavailableCandidate(candidate) !== null) continue;
      const endpoint = candidateEndpoint(deps, candidate);
      if (candidate.bindings.kind !== "available") return callerDefect(PORT, "a candidate must retain its actual complete bindings");
      signatureRequest(reference, { kind: "declaredSignatureOf", request: endpointRequest(deps, endpoint,
        { kind: "instantiated", bindings: candidate.bindings.value }) });
    }
  }
  const [first, ...rest] = requests;
  if (first === undefined) return generate(deps, group, new Map(), []);
  const pending: readonly [ConstraintsRequest, ...ConstraintsRequest[]] = [first, ...rest];
  return { kind: "paused", requests: pending, paused: { group, requestBodies, requests: pending }, earned: [] };
};

export const resumeConstraintsOf: ResumeConstraintsOf = (deps, paused, answers) => {
  validateInferenceLimits(RESUME, deps.limits, deps.graph);
  if (answers.length !== paused.requests.length)
    return callerDefect(RESUME, `${answers.length} answers for ${paused.requests.length} requests`);
  if (paused.requestBodies.length !== paused.requests.length)
    return callerDefect(RESUME, "every pending semantic request must retain its actual requesting body");
  const members = new Set(paused.group.bodies);
  const signatures = new Map<string, Signature>();
  const outsideParts: InferredPartType[] = [];
  for (const [index, request] of paused.requests.entries()) {
    const body = present(paused.requestBodies[index], "the actual requesting body");
    if (!members.has(body)) return callerDefect(RESUME, "a pending semantic request belongs to a body outside its actual group");
    const answer = present(answers[index], "an actual semantic request answer");
    if (request.kind === "inferred-part") {
      if (!("part" in answer) || inferredPartKey(answer.part) !== inferredPartKey(request.part))
        return callerDefect(RESUME, "an outside-part answer must retain the actual requested part identity");
      const origin = answer.origin;
      if (origin === undefined || origin.position.kind !== "inference-variable"
        || origin.request.key !== origin.position.group || origin.position.group === paused.group.id
        || !Number.isSafeInteger(origin.position.variable) || origin.position.variable < 0 || Object.is(origin.position.variable, -0))
        return callerDefect(RESUME, "an outside part requires its actual different group's finalized variable origin");
      outsideParts.push(answer);
    } else {
      if (request.kind !== "declaredSignatureOf" || !("kind" in answer) || answer.kind !== "declaredSignatureOf")
        return callerDefect(RESUME, "a signature request requires its signature answer");
      const key = signatureRequestKey(request.request);
      if (signatures.has(key)) return callerDefect(RESUME, "a complete signature request was repeated in one pause");
      if (answer.value.declaration !== request.request.definition)
        return callerDefect(RESUME, "a signature answer must retain the actual requested declaration");
      signatures.set(key, answer.value);
    }
  }
  return generate(deps, paused.group, signatures, outsideParts);
};

function ownedParts(deps: InferDeps, group: InferenceGroup): ReadonlyMap<BodyId, readonly InferredSignaturePart[]> {
  const parts = new Map<BodyId, InferredSignaturePart[]>();
  const members = new Set(group.bodies);
  for (const part of group.signatures) {
    const owner = deps.itemOf(part.definition);
    let target: BodyId | null;
    switch (owner.kind) {
      case "FunctionDeclaration": case "FunctionExpression": case "ArrowFunction":
      case "MethodDeclaration": case "GetAccessor": case "SetAccessor": case "Constructor": {
        if (part.part.kind === "parameter-initializer") {
          const first = owner.parameters.nodes[0];
          const receiver = first?.name.kind === "Identifier" && first.name.text === "this" ? 1 : 0;
          target = owner.parameters.nodes[part.part.index + receiver]?.tsonic.initializer ?? null;
        } else target = owner.tsonic.body;
        break;
      }
      case "VariableDeclaration": case "PropertyDeclaration": target = owner.tsonic.initializer; break;
      default: return callerDefect(PORT, "an inferred part belongs to no actual executable declaration");
    }
    if (target === null || !members.has(target)) return callerDefect(PORT, "an inferred part has no producer execution in its group");
    const own = parts.get(target) ?? [];
    own.push(part);
    parts.set(target, own);
  }
  return parts;
}

function generate(deps: InferDeps, group: InferenceGroup, signatures: ReadonlyMap<string, Signature>, outsideParts: readonly InferredPartType[]): Output {
  const generation: Generation = { deps, group, parts: ownedParts(deps, group), partTypes: new Map(), nextVariable: 0,
    ownParts: new Set(group.signatures.map(inferredPartKey)), ownDefinitions: new Set(group.signatures.map(part => part.definition)), signatures, parameters: new Map(),
    outsideParts: new Map(outsideParts.map(part => [inferredPartKey(part.part), part])) };
  const drafts: Draft[] = [];
  for (const reference of group.bodies) {
    const body = deps.hirBody(reference);
    const draft: Draft = { body, variables: [], constraints: [], evidence: [] };
    const own = ownSignatureRequest(deps, body, PORT, generation.ownDefinitions);
    const walk: Walk = { generation, draft, signature: own === null ? undefined : signatures.get(signatureRequestKey(own.request)), typeOf: new Map(), operators: new Map() };
    for (const part of generation.parts.get(reference) ?? []) {
      const diagnostic = allocate(walk, { kind: "signature", signature: part, occurrence: refOf(walk, body.root) });
      if (diagnostic !== null) return refused(diagnostic);
    }
    if (body.root.kind === "SourceFile") {
      for (const statement of body.root.statements.nodes)
        if (statement.kind !== "FunctionDeclaration" && statement.kind !== "VariableStatement"
          && statement.kind !== "InterfaceDeclaration" && statement.kind !== "TypeAliasDeclaration"
          && statement.kind !== "ImportDeclaration" && statement.kind !== "ExportDeclaration")
          return notInferredYet(PORT, `a ${statement.kind} in a module body`, statement.origin);
    } else {
      const pending: Frame[] = [{ kind: "enter", node: body.root }];
      for (let frame = pending.pop(); frame !== undefined; frame = pending.pop()) {
        if (frame.kind === "enter") {
          if (frame.node.kind === "BinaryExpression" && frame.node.tsonic.role !== "assignment"
            || frame.node.kind === "PrefixUnaryExpression" || frame.node.kind === "CallExpression"
            || frame.node.kind === "PropertyAccessExpression") {
            const diagnostic = allocate(walk, { kind: "local", local: null, occurrence: refOf(walk, frame.node) });
            if (diagnostic !== null) return refused(diagnostic);
            walk.operators.set(frame.node.id, internType(deps.types,
              { kind: "open", group: group.id, variable: generation.nextVariable - 1 }));
          }
          const children = childrenOf(frame.node);
          pending.push({ kind: "leave", node: frame.node });
          for (let index = children.length - 1; index >= 0; index -= 1)
            pending.push({ kind: "enter", node: present(children[index], "a checked syntax child") });
        } else leave(walk, frame.node);
      }
      if (body.root.kind !== "Block") {
        const part = (generation.parts.get(reference) ?? []).find(candidate => candidate.part.kind === "parameter-initializer"
          || candidate.part.kind === "variable" || candidate.part.kind === "field");
        if (part === undefined) {
          const owner = deps.itemOf(body.owner);
          if (owner.kind !== "Parameter" && owner.kind !== "VariableDeclaration" && owner.kind !== "PropertyDeclaration"
            || owner.tsonic.initializer !== body.body || owner.type === null
            || owner.tsonic.declaredType.kind !== "available" || owner.tsonic.declaredType.value === null
            || owner.type.tsonic.type.kind !== "available" || owner.type.tsonic.type.value !== owner.tsonic.declaredType.value)
            return notInferredYet(PORT, "an expression execution without its actual inferred part or checked declaration annotation", body.root.origin);
          flow(walk, body.root, typeAt(walk, body.root), owner.tsonic.declaredType.value, "initialization",
            { kind: "item", value: { owner: body.owner, node: owner.type.id } });
        } else flow(walk, body.root, typeAt(walk, body.root), { part }, "initialization", { kind: "body", value: refOf(walk, body.root) });
      }
    }
    drafts.push(draft);
  }
  const typeOf = (slot: Slot): TyId => typeof slot === "number" ? slot
    : generation.partTypes.get(inferredPartKey(slot.part))
      ?? present(generation.outsideParts.get(inferredPartKey(slot.part)), "the actual ready outside part").type;
  return { kind: "done", value: { kind: "ok", value: { outsideParts, constraints: drafts.map(draft => ({
    group: group.id, body: draft.body.body, variables: draft.variables, candidates: readyCandidates(generation, draft.body),
    constraints: draft.constraints.map(constraint => constraint.kind === "flow"
      ? { ...constraint, from: typeOf(constraint.from), to: typeOf(constraint.to) }
      : constraint.kind === "op" ? { ...constraint, operands: constraint.operands.map(typeOf), result: typeOf(constraint.result) }
      : constraint.kind === "member" ? { ...constraint, receiver: typeOf(constraint.receiver), result: typeOf(constraint.result) }
      : constraint),
    evidence: draft.evidence.map(entry => {
      const part = typeof entry.type === "number" ? undefined : generation.outsideParts.get(inferredPartKey(entry.type.part));
      const error: InferenceValue["error"] = part === undefined || part.error === null
        ? null : { kind: "error", causes: [{ kind: "unit", unit: part.origin }] };
      return evidenceOf(deps, group, typeOf(entry.type), entry.node, entry.component, error);
    }),
  })) }, diagnostics: [] } };
}

function allocate(walk: Walk, variable: Omit<Extract<InferenceVariable, { readonly kind: "signature" }>, "id">
  | Omit<Extract<InferenceVariable, { readonly kind: "local" }>, "id">): Diagnostic | null {
  const state = walk.generation;
  if (state.nextVariable >= state.deps.limits.maximumVariablesPerGroup)
    return resourceLimitDiagnostic({ owner: "infer", limit: "inference variables per group",
      maximum: state.deps.limits.maximumVariablesPerGroup, site: { kind: "source", origin: walk.draft.body.root.origin },
      unit: { request: { query: "constraintsOf", key: state.group.id }, position: { kind: "result" } } });
  const id = state.nextVariable++;
  walk.draft.variables.push({ ...variable, id });
  if (variable.kind === "signature") {
    const key = inferredPartKey(variable.signature);
    if (state.partTypes.has(key)) return callerDefect(PORT, "an inferred part was allocated twice");
    state.partTypes.set(key, internType(state.deps.types, { kind: "open", group: state.group.id, variable: id }));
  }
  return null;
}

function childrenOf(node: HirNode): readonly HirNode[] {
  switch (node.kind) {
    case "Block": return node.statements.nodes;
    case "ReturnStatement": return node.expression === null ? [] : [node.expression];
    case "ThrowStatement": case "ExpressionStatement": return [node.expression];
    case "IfStatement": return node.elseStatement === null ? [node.expression, node.thenStatement]
      : [node.expression, node.thenStatement, node.elseStatement];
    case "VariableStatement": return [];
    case "ParenthesizedExpression": return [node.expression];
    case "PrefixUnaryExpression": return [node.operand];
    case "BinaryExpression": return [node.left, node.right];
    case "CallExpression": return [node.expression, ...node.arguments.nodes];
    case "PropertyAccessExpression": return [node.expression];
    case "Identifier": case "TrueKeyword": case "FalseKeyword": case "StringLiteral": case "NullKeyword": return [];
    default: return notInferredYet(PORT, `a ${node.kind}`, node.origin);
  }
}

function leave(walk: Walk, node: HirNode): void {
  if (node.kind === "Identifier") walk.typeOf.set(node.id, localType(walk, node));
  else if (node.kind === "TrueKeyword" || node.kind === "FalseKeyword" || node.kind === "StringLiteral" || node.kind === "NullKeyword") {
    if (node.tsonic.role !== "value" || node.tsonic.value.views.read.kind !== "available")
      return notInferredYet(PORT, "the actual checked literal value type", node.origin);
    walk.typeOf.set(node.id, node.tsonic.value.views.read.value);
  }
  else if (node.kind === "ParenthesizedExpression") walk.typeOf.set(node.id, typeAt(walk, node.expression));
  else if (node.kind === "PropertyAccessExpression") {
    if (node.questionDotToken !== null || node.tsonic.role !== "value" || node.tsonic.origins.kind !== "available"
      || node.name.kind !== "Identifier" || node.name.tsonic.role !== "property-name" || node.name.tsonic.key.kind !== "available")
      return notInferredYet(PORT, "the actual checked member key and declaration origins", node.origin);
    const result = present(walk.operators.get(node.id), "the actual member result position");
    const receiver = typeAt(walk, node.expression);
    walk.draft.constraints.push({ kind: "member", occurrence: refOf(walk, node), receiver,
      key: node.name.tsonic.key.value, access: "read", result, origins: node.tsonic.origins.value, bindings: TEMPLATE });
    walk.draft.evidence.push({ type: receiver, node: node.expression, component: { kind: "body", value: refOf(walk, node.expression) } },
      { type: result, node, component: { kind: "body", value: refOf(walk, node) } });
    walk.typeOf.set(node.id, result);
  }
  else if (node.kind === "PrefixUnaryExpression") {
    if (node.operator !== "ExclamationToken" || node.tsonic.role !== "value")
      return notInferredYet(PORT, `the unary operator ${node.operator} of role ${node.tsonic.role}`, node.origin);
    const result = present(walk.operators.get(node.id), "the actual unary operator result position");
    const operand = typeAt(walk, node.operand);
    walk.draft.constraints.push({ kind: "op", occurrence: refOf(walk, node), operator: "!",
      operands: [operand], result, permissionScope: null });
    walk.draft.evidence.push({ type: operand, node: node.operand, component: { kind: "body", value: refOf(walk, node.operand) } },
      { type: result, node, component: { kind: "body", value: refOf(walk, node) } });
    walk.typeOf.set(node.id, result);
  }
  else if (node.kind === "BinaryExpression") {
    if (node.operatorToken.kind === "EqualsToken" && node.tsonic.role === "assignment") {
      const target = node.tsonic.target;
      if (node.left.kind !== "Identifier" || node.left.tsonic.role !== "assignment-target" || node.left.tsonic.access !== "write"
        || node.left.tsonic.resolution.kind !== "local" || node.left.tsonic.place.kind !== "available"
        || node.left.tsonic.place.value.write.kind !== "available"
        || target.kind !== "available" || target.value.base.kind !== "root" || target.value.base.resolution.kind !== "local"
        || target.value.base.resolution.local.body !== node.left.tsonic.resolution.local.body
        || target.value.base.resolution.local.local !== node.left.tsonic.resolution.local.local
        || target.value.step !== null || target.value.write.kind !== "available" || target.value.write.value === null
        || target.value.write.value !== node.left.tsonic.place.value.write.value)
        return notInferredYet(PORT, "the actual writable local assignment target", node.origin);
      const storage = typeAt(walk, node.left);
      flow(walk, node.right, typeAt(walk, node.right), storage, "assignment", { kind: "body", value: refOf(walk, node.left) });
      walk.typeOf.set(node.id, storage);
      return;
    }
    if (node.operatorToken.kind !== "PlusToken" || node.tsonic.role !== "arithmetic")
      return notInferredYet(PORT, `the binary operator ${node.operatorToken.kind}`, node.origin);
    const result = present(walk.operators.get(node.id), "the actual operator result position");
    const left = typeAt(walk, node.left);
    const right = typeAt(walk, node.right);
    walk.draft.constraints.push({ kind: "op", occurrence: refOf(walk, node), operator: "+",
      operands: [left, right], result, permissionScope: null });
    const evidence: readonly (readonly [Slot, HirNode])[] = [[left, node.left], [right, node.right], [result, node]];
    for (const [type, source] of evidence)
      walk.draft.evidence.push({ type, node: source, component: { kind: "body", value: refOf(walk, source) } });
    walk.typeOf.set(node.id, result);
  } else if (node.kind === "CallExpression") {
    const captured = node.tsonic.application;
    if (captured.kind !== "available" || captured.value.kind !== "call" || captured.value.candidates.kind !== "available")
      return notInferredYet(PORT, "the actual captured call candidate inventory", node.origin);
    if (captured.value.receiver !== null || captured.value.typeArguments.length !== 0)
      return notInferredYet(PORT, "the authoritative receiver, argument and binder contributions of a call", node.origin);
    if (captured.value.arguments.length !== node.arguments.nodes.length)
      return callerDefect(PORT, "a call retains its actual captured source argument inventory");
    const arguments_ = captured.value.arguments.map((argument, index) => {
      const source = node.arguments.nodes[index];
      if (source === undefined || argument.kind !== "value" || argument.expression !== source.id)
        return notInferredYet(PORT, "the actual selected source transport of a spread call argument", node.origin);
      const type = typeAt(walk, source);
      if (typeof type !== "number")
        return notInferredYet(PORT, "the actual argument inferred-part contribution", source.origin);
      return { occurrence: refOf(walk, source), kind: argument.kind, type, tuple: null, closure: null };
    });
    const result = present(walk.operators.get(node.id), "the actual application result position");
    const callee = typeAt(walk, node.expression);
    if (typeof callee !== "number") return notInferredYet(PORT, "a callee whose signature is an unresolved inferred part", node.origin);
    walk.draft.constraints.push({ kind: "call", occurrence: refOf(walk, node), application: {
      captured: node.tsonic.core, permissionScope: null, callee, receiver: null, typeArguments: [], arguments: arguments_,
      candidates: captured.value.candidates.value, result,
    } });
    walk.draft.evidence.push({ type: callee, node: node.expression, component: { kind: "body", value: refOf(walk, node.expression) } },
      { type: result, node, component: { kind: "body", value: refOf(walk, node) } });
    for (const [index, argument] of arguments_.entries()) {
      const source = node.arguments.nodes[index];
      if (source === undefined) return callerDefect(PORT, "a call retains every actual argument occurrence");
      walk.draft.evidence.push({ type: argument.type, node: source, component: { kind: "body", value: argument.occurrence } });
    }
    walk.typeOf.set(node.id, result);
  } else if (node.kind === "ReturnStatement") {
    if (node.expression === null) return notInferredYet(PORT, "a return without a value", node.origin);
    const own = (walk.generation.parts.get(walk.draft.body.body) ?? []).find(part => part.part.kind === "return");
    const target = own === undefined ? present(walk.signature, "the ready external declared signature").result : { part: own };
    flow(walk, node.expression, typeAt(walk, node.expression), target, "return", own === undefined
      ? returnComponent(walk, target) : { kind: "body", value: refOf(walk, node.expression) });
  }
}

function localType(walk: Walk, node: Extract<HirNode, { readonly kind: "Identifier" }>): Slot {
  const name = node.tsonic;
  if (name.role !== "value" && name.role !== "assignment-target") return notInferredYet(PORT, "a local occurrence without its checked value or target role", node.origin);
  if (name.role === "assignment-target") {
    const place = name.place;
    if (name.access !== "write" || name.resolution.kind !== "local" || place.kind !== "available"
      || place.value.step !== null || place.value.base.kind !== "root" || place.value.base.resolution.kind !== "local"
      || place.value.base.resolution.local.body !== name.resolution.local.body
      || place.value.base.resolution.local.local !== name.resolution.local.local
      || place.value.write.kind !== "available" || place.value.write.value === null)
      return notInferredYet(PORT, "the actual qualified writable local storage", node.origin);
  }
  const binding = name.resolution.kind === "binding" ? resolveModuleBinding(walk.generation.deps, name.resolution.occurrence) : null;
  const resolution = binding === null ? name.resolution : binding.target.kind === "available" ? binding.target.value
    : notInferredYet(PORT, "a binding whose actual nearest target is unavailable (" + binding.target.reason + ")", node.origin);
  if (resolution.kind === "declarations") {
    const signatures = resolution.definitions.flatMap(definition => callableEndpoints(walk.generation.deps, definition).map(endpoint => {
      const request = endpointRequest(walk.generation.deps, endpoint, { kind: "instantiated", bindings: TEMPLATE });
      return present(walk.generation.signatures.get(signatureRequestKey(request)), "the actual declared callee signature").id;
    }));
    return internType(walk.generation.deps.types, { kind: "callable", calls: signatures, constructs: [] });
  }
  if (resolution.kind !== "local")
    return notInferredYet(PORT, "a value read that is not an actual local", node.origin);
  const reference = resolution.local;
  const owner = walk.generation.deps.hirBody(reference.body);
  const parameter = parametersOf(walk.generation.parameters, owner).get(reference.local);
  if (parameter !== undefined) return parameterType(walk.generation, owner, parameter);
  const { definition, declaration } = localBinding(walk.generation.deps, reference);
  const declared = declaration.tsonic.declaredType;
  if (declared.kind !== "available") return notInferredYet(PORT, "the actual declaration type availability of a local", node.origin);
  if (declared.value !== null) return declared.value;
  const part: InferredSignaturePart = { definition, part: { kind: "variable" } };
  const key = inferredPartKey(part);
  return walk.generation.ownParts.has(key) || walk.generation.outsideParts.has(key) ? { part }
    : notInferredYet(PORT, "the actual finalized initializer type of an unannotated local", node.origin);
}

function localBinding(deps: InferDeps, reference: LocalRef): {
  readonly definition: DefId; readonly declaration: Extract<HirNode, { readonly kind: "VariableDeclaration" }>;
} {
  const local = deps.hirBody(reference.body).locals[reference.local];
  if (local === undefined || !Object.is(local.id, reference.local) || local.role !== "binding" || local.declaration.kind !== "item")
    return callerDefect(PORT, "a local binding read requires its actual qualified declaration inventory");
  const declaration = deps.itemOf(local.declaration.value.owner);
  if (declaration.kind !== "VariableDeclaration" || declaration.id !== local.declaration.value.node
    || declaration.tsonic.declaration.kind !== "local" || declaration.tsonic.declaration.local.body !== reference.body
    || !Object.is(declaration.tsonic.declaration.local.local, reference.local))
    return callerDefect(PORT, "a local binding read retains its actual checked variable and selected local");
  return { definition: local.declaration.value.owner, declaration };
}

function parametersOf(cache: ParameterIndex, owner: HirBody): ReadonlyMap<LocalId, ParameterPosition> {
  const existing = cache.get(owner.body);
  if (existing !== undefined) return existing;
  const parameters = new Map<LocalId, ParameterPosition>();
  let index = 0;
  for (const parameter of owner.params) {
    if (parameters.has(parameter.local)) return callerDefect(PORT, "a formal inventory repeats its actual qualified local");
    parameters.set(parameter.local, { parameter, index });
    if (parameter.role !== "this") index += 1;
  }
  cache.set(owner.body, parameters);
  return parameters;
}

function parameterDeclaration(deps: InferDeps, owner: HirBody, parameter: HirParam): Extract<HirNode, { readonly kind: "Parameter" }> {
  const local = owner.locals[parameter.local];
  const declaration = deps.itemOf(parameter.declaration);
  if (local === undefined || !Object.is(local.id, parameter.local) || local.declaration.kind !== "item"
    || local.declaration.value.owner !== parameter.declaration || declaration.kind !== "Parameter"
    || declaration.id !== local.declaration.value.node || declaration.tsonic.declaration.kind !== "local"
    || declaration.tsonic.declaration.local.body !== owner.body
    || !Object.is(declaration.tsonic.declaration.local.local, parameter.local))
    return callerDefect(PORT, "a demanded parameter retains its actual qualified local and checked declaration");
  return declaration;
}

function parameterType(state: Generation, owner: HirBody, selected: ParameterPosition): Slot {
  const declaration = parameterDeclaration(state.deps, owner, selected.parameter);
  const checked = declaration.tsonic.declaredType;
  if (checked.kind !== "available") return notInferredYet(PORT, "the actual parameter type availability", declaration.origin);
  if (checked.value !== null) return checked.value;
  const part: InferredSignaturePart = { definition: owner.owner, part: { kind: "parameter-initializer", index: selected.index } };
  const key = inferredPartKey(part);
  if (state.ownParts.has(key) || state.outsideParts.has(key)) return { part };
  const signature = present(ownReadySignature(state, owner), "the ready external parameter signature");
  return selected.parameter.role === "this" ? signature.receiver ?? callerDefect(PORT, "a demanded receiver retains its actual signature type")
    : present(signature.parameters[selected.index], "the actual parameter type").type;
}

function returnComponent(walk: Walk, type: Slot): SourceNodeRef {
  const owner = walk.generation.deps.itemOf(walk.draft.body.owner);
  switch (owner.kind) {
    case "FunctionDeclaration": case "FunctionExpression": case "ArrowFunction": case "MethodDeclaration": case "GetAccessor": {
      const annotation = owner.type;
      if (annotation === null || annotation.tsonic.type.kind !== "available" || annotation.tsonic.type.value !== type)
        return callerDefect(PORT, "the ready return type requires its actual checked annotation component");
      return { kind: "item", value: { owner: walk.draft.body.owner, node: annotation.id } };
    }
    default: return notInferredYet(PORT, `the actual return type component of ${owner.kind}`, owner.origin);
  }
}

function flow(walk: Walk, source: HirNode, from: Slot, to: Slot, role: FlowConstraint["role"], target: SourceNodeRef): void {
  walk.draft.constraints.push({ kind: "flow", occurrence: refOf(walk, source), from, to, role, bindings: TEMPLATE });
  walk.draft.evidence.push({ type: from, node: source, component: { kind: "body", value: refOf(walk, source) } },
    { type: to, node: source, component: target });
}

function typeAt(walk: Walk, node: HirNode): Slot {
  return present(walk.typeOf.get(node.id), `the type position of node ${node.id}`);
}

function refOf(walk: Walk, node: HirNode): NodeRef { return { body: walk.draft.body.body, node: node.id }; }

function evidenceOf(deps: InferDeps, group: InferenceGroup, type: TyId, node: HirNode, component: SourceNodeRef, error: InferenceValue["error"]): InferenceValue {
  const term = readType(deps.types, type);
  if ((term.kind === "error") !== (error !== null))
    return notInferredYet(PORT, "the actual checked error association of a constraint type position", node.origin);
  if (term.kind === "open" || term.kind === "error" || term.kind === "shape")
    return { value: { type, component, category: { kind: "dynamic" }, numeric: null, sum: null, nominal: null, pointer: null }, error };
  if (term.kind === "callable") return { value: { type, component, category: { kind: "known", category: "callable" },
    numeric: null, sum: null, nominal: null, pointer: null }, error: null };
  if (term.kind === "intrinsic" && term.intrinsic === "absence")
    return { value: { type, component, category: { kind: "known", category: "absence" },
      numeric: null, sum: null, nominal: null, pointer: null }, error: null };
  if (term.kind === "string" || term.kind === "primitive" && term.primitive === "bool"
    || term.kind === "literal" && (term.value.kind === "boolean" || term.value.kind === "string"))
    return { value: { type, component, category: { kind: "known", category: term.kind === "string"
      || term.kind === "literal" && term.value.kind === "string" ? "string" : "boolean" },
      numeric: null, sum: null, nominal: null, pointer: null }, error: null };
  if (term.kind !== "primitive" || term.primitive !== "float64")
    return notInferredYet(PORT, `evidence of a ${term.kind} type in group ${group.id}`, node.origin);
  const category: CategoryEvidence = { kind: "known", category: "number" };
  return { value: { type, component, category, numeric: component.kind === "body"
    ? { producer: component.value, kind: "declared", category, authored: null } : null,
    sum: null, nominal: null, pointer: null }, error: null };
}

function ownReadySignature(state: Generation, body: HirBody): Signature | undefined {
  const request = ownSignatureRequest(state.deps, body, PORT, state.ownDefinitions);
  return request === null ? undefined : state.signatures.get(signatureRequestKey(request.request));
}

function readyCandidates(state: Generation, body: HirBody): readonly InferenceCandidateList[] {
  return body.candidateLists.map(list => ({ id: list.id, candidates: list.candidates.map(candidate => {
    const unavailable = unavailableCandidate(candidate);
    if (unavailable !== null) return { ...candidate, endpoints: unavailable };
    const endpoint = candidateEndpoint(state.deps, candidate);
    if (candidate.bindings.kind !== "available") return callerDefect(PORT, "a candidate must retain its complete bindings");
    const request = endpointRequest(state.deps, endpoint, { kind: "instantiated", bindings: candidate.bindings.value });
    const signature = present(state.signatures.get(signatureRequestKey(request)), "the actual authoritative candidate signature");
    const selected = { ...endpoint, signature: signature.id };
    return { ...candidate, endpoints: { kind: "available", value: { advertised: selected, api: selected } } };
  }) }));
}

function present<Value>(value: Value | undefined, what: string): Value {
  return requirePresent(value, { owner: "infer", query: null, origin: null, message: `${PORT}: ${what} is missing` });
}

function refused(diagnostic: Diagnostic): Output {
  return { kind: "done", value: { kind: "refused", diagnostics: [diagnostic] } };
}

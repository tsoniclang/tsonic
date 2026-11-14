import type { Diagnostic } from "../diag/contract.js";
import type { BodyId, LocalId, NodeId, NodeRef, SourceNodeRef, TyId } from "../ids/contract.js";
import type { BindingVector, CategoryEvidence, Signature } from "../ir-types/contract.js";
import type { Expression, HirBody, HirNode, CheckedPhase } from "../ir-hir/contract.js";
import type { FlowConstraint, InferenceGroup, InferenceValue, InferenceVariable, InferredPartType, InferredSignaturePart, OperatorConstraint } from "../ir-infer/contract.js";
import type { ConstraintsOf, ConstraintsPaused, ConstraintsRequest, GroupConstraints, InferDeps, InferStep, ResumeConstraintsOf } from "./contract.js";
import { requirePresent, resourceLimitDiagnostic } from "../diag/index.js";
import { internType, readType } from "../ir-types/index.js";
import { inferredPartKey, inferredPartsOf } from "../ir-infer/index.js";
import { callerDefect, notInferredYet, validateInferenceLimits } from "./frontier.js";
import { ownSignatureRequest } from "./own-signature.js";

const PORT = "ConstraintsOf";
const RESUME = "ResumeConstraintsOf";
const TEMPLATE: BindingVector = { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] };

type Output = InferStep<GroupConstraints, ConstraintsRequest, ConstraintsPaused>;
type Slot = TyId | { readonly part: InferredSignaturePart };
type DraftConstraint =
  | Omit<FlowConstraint, "from" | "to"> & { readonly from: Slot; readonly to: Slot }
  | Omit<OperatorConstraint, "operands" | "result"> & { readonly operands: readonly Slot[]; readonly result: Slot };

interface Draft {
  readonly body: HirBody;
  readonly variables: InferenceVariable[];
  readonly constraints: DraftConstraint[];
  readonly evidence: { readonly type: Slot; readonly node: Expression<CheckedPhase> | HirNode }[];
}

interface Generation {
  readonly deps: InferDeps;
  readonly group: InferenceGroup;
  readonly parts: ReadonlyMap<BodyId, readonly InferredSignaturePart[]>;
  readonly partTypes: Map<string, TyId>;
  readonly ownParts: ReadonlySet<string>;
  readonly signatures: ReadonlyMap<BodyId, Signature>;
  readonly parameters: Map<BodyId, ReadonlyMap<LocalId, Slot>>;
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
  for (const reference of group.bodies) {
    const body = deps.hirBody(reference);
    if (body.body !== reference) return callerDefect(PORT, "a checked body belongs to another complete body identity");
    const request = ownSignatureRequest(deps, body, PORT, ownDefinitions);
    if (request !== null) { requestBodies.push(reference); requests.push(request); }
    else if (ownDefinitions.has(body.owner)) for (const part of inferredPartsOf(body.owner, deps.itemOf(body.owner))) {
      const key = inferredPartKey(part);
      if (!ownParts.has(key) && !requestedParts.has(key)) {
        requestedParts.add(key);
        requests.push({ kind: "inferred-part", part });
        requestBodies.push(reference);
      }
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
  const signatures = new Map<BodyId, Signature>();
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
      if (signatures.has(body)) return callerDefect(RESUME, "a body requested its own signature more than once in one pause");
      signatures.set(body, answer.value);
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

function generate(deps: InferDeps, group: InferenceGroup, signatures: ReadonlyMap<BodyId, Signature>, outsideParts: readonly InferredPartType[]): Output {
  const generation: Generation = { deps, group, parts: ownedParts(deps, group), partTypes: new Map(), nextVariable: 0,
    ownParts: new Set(group.signatures.map(inferredPartKey)), signatures, parameters: new Map(),
    outsideParts: new Map(outsideParts.map(part => [inferredPartKey(part.part), part])) };
  const drafts: Draft[] = [];
  for (const reference of group.bodies) {
    const body = deps.hirBody(reference);
    const draft: Draft = { body, variables: [], constraints: [], evidence: [] };
    const walk: Walk = { generation, draft, signature: signatures.get(reference), typeOf: new Map(), operators: new Map() };
    for (const part of generation.parts.get(reference) ?? []) {
      const diagnostic = allocate(walk, { kind: "signature", signature: part, occurrence: refOf(walk, body.root) });
      if (diagnostic !== null) return refused(diagnostic);
    }
    if (body.root.kind === "SourceFile") {
      for (const statement of body.root.statements.nodes)
        if (statement.kind !== "FunctionDeclaration") return notInferredYet(PORT, `a ${statement.kind} in a module body`, statement.origin);
    } else {
      const pending: Frame[] = [{ kind: "enter", node: body.root }];
      for (let frame = pending.pop(); frame !== undefined; frame = pending.pop()) {
        if (frame.kind === "enter") {
          if (frame.node.kind === "BinaryExpression") {
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
        if (part === undefined) return notInferredYet(PORT, "an expression execution with no actual inferred part", body.root.origin);
        flow(walk, body.root, typeAt(walk, body.root), { part }, "initialization");
      }
    }
    drafts.push(draft);
  }
  const typeOf = (slot: Slot): TyId => typeof slot === "number" ? slot
    : generation.partTypes.get(inferredPartKey(slot.part))
      ?? present(generation.outsideParts.get(inferredPartKey(slot.part)), "the actual ready outside part").type;
  return { kind: "done", value: { kind: "ok", value: { outsideParts, constraints: drafts.map(draft => ({
    group: group.id, body: draft.body.body, variables: draft.variables, candidates: draft.body.candidateLists,
    constraints: draft.constraints.map(constraint => constraint.kind === "flow"
      ? { ...constraint, from: typeOf(constraint.from), to: typeOf(constraint.to) }
      : { ...constraint, operands: constraint.operands.map(typeOf), result: typeOf(constraint.result) }),
    evidence: draft.evidence.map(entry => {
      const part = typeof entry.type === "number" ? undefined : generation.outsideParts.get(inferredPartKey(entry.type.part));
      const error: InferenceValue["error"] = part === undefined || part.error === null
        ? null : { kind: "error", causes: [{ kind: "unit", unit: part.origin }] };
      return evidenceOf(deps, draft.body.body, group, typeOf(entry.type), entry.node, error);
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
    case "ParenthesizedExpression": return [node.expression];
    case "BinaryExpression": return [node.left, node.right];
    case "Identifier": return [];
    default: return notInferredYet(PORT, `a ${node.kind}`, node.origin);
  }
}

function leave(walk: Walk, node: HirNode): void {
  if (node.kind === "Identifier") walk.typeOf.set(node.id, parameterType(walk, node));
  else if (node.kind === "ParenthesizedExpression") walk.typeOf.set(node.id, typeAt(walk, node.expression));
  else if (node.kind === "BinaryExpression") {
    if (node.operatorToken.kind !== "PlusToken" || node.tsonic.role !== "arithmetic")
      return notInferredYet(PORT, `the binary operator ${node.operatorToken.kind}`, node.origin);
    const result = present(walk.operators.get(node.id), "the actual operator result position");
    const left = typeAt(walk, node.left);
    const right = typeAt(walk, node.right);
    walk.draft.constraints.push({ kind: "op", occurrence: refOf(walk, node), operator: "+",
      operands: [left, right], result, permissionScope: null });
    for (const [type, source] of [[left, node.left], [right, node.right], [result, node]] as const)
      walk.draft.evidence.push({ type, node: source });
    walk.typeOf.set(node.id, result);
  } else if (node.kind === "ReturnStatement") {
    if (node.expression === null) return notInferredYet(PORT, "a return without a value", node.origin);
    const own = (walk.generation.parts.get(walk.draft.body.body) ?? []).find(part => part.part.kind === "return");
    const target = own === undefined ? present(walk.signature, "the ready external declared signature").result : { part: own };
    flow(walk, node.expression, typeAt(walk, node.expression), target, "return");
  }
}

function parameterType(walk: Walk, node: Extract<HirNode, { readonly kind: "Identifier" }>): Slot {
  const name = node.tsonic;
  if (name.role !== "value" || name.resolution.kind !== "local")
    return notInferredYet(PORT, "a value read that is not an actual local parameter", node.origin);
  const reference = name.resolution.local;
  const parameters = parametersOf(walk.generation, reference.body);
  return parameters.get(reference.local) ?? notInferredYet(PORT, "a read of a non-parameter local", node.origin);
}

function parametersOf(state: Generation, body: BodyId): ReadonlyMap<LocalId, Slot> {
  const existing = state.parameters.get(body);
  if (existing !== undefined) return existing;
  const owner = state.deps.hirBody(body);
  const parameters = new Map<LocalId, Slot>();
  let index = 0;
  for (const parameter of owner.params) {
    const declaration = state.deps.itemOf(parameter.declaration);
    if (declaration.kind !== "Parameter") return callerDefect(PORT, "a parameter local has no actual parameter declaration");
    const checked = declaration.tsonic.declaredType;
    const part: InferredSignaturePart = { definition: owner.owner, part: { kind: "parameter-initializer", index } };
    const type: Slot = checked.kind === "available" && checked.value !== null ? checked.value
      : state.ownParts.has(inferredPartKey(part)) ? { part }
      : state.outsideParts.has(inferredPartKey(part)) ? { part }
      : present(present(state.signatures.get(body), "the ready external parameter signature").parameters[index], "the actual parameter type").type;
    parameters.set(parameter.local, type);
    if (parameter.role !== "this") index += 1;
  }
  state.parameters.set(body, parameters);
  return parameters;
}

function flow(walk: Walk, source: HirNode, from: Slot, to: Slot, role: FlowConstraint["role"]): void {
  walk.draft.constraints.push({ kind: "flow", occurrence: refOf(walk, source), from, to, role, bindings: TEMPLATE });
  walk.draft.evidence.push({ type: from, node: source }, { type: to, node: source });
}

function typeAt(walk: Walk, node: HirNode): Slot {
  return present(walk.typeOf.get(node.id), `the type position of node ${node.id}`);
}

function refOf(walk: Walk, node: HirNode): NodeRef { return { body: walk.draft.body.body, node: node.id }; }

function evidenceOf(deps: InferDeps, body: BodyId, group: InferenceGroup, type: TyId, node: HirNode, error: InferenceValue["error"]): InferenceValue {
  const component: SourceNodeRef = { kind: "body", value: { body, node: node.id } };
  const term = readType(deps.types, type);
  if ((term.kind === "error") !== (error !== null))
    return notInferredYet(PORT, "the actual checked error association of a constraint type position", node.origin);
  if (term.kind === "open" || term.kind === "error")
    return { value: { type, component, category: { kind: "dynamic" }, numeric: null, sum: null, nominal: null, pointer: null }, error };
  if (term.kind !== "primitive" || term.primitive !== "float64")
    return notInferredYet(PORT, `evidence of a ${term.kind} type in group ${group.id}`, node.origin);
  const category: CategoryEvidence = { kind: "known", category: "number" };
  return { value: { type, component, category, numeric: { producer: { body, node: node.id }, kind: "declared", category, authored: null },
    sum: null, nominal: null, pointer: null }, error: null };
}

function present<Value>(value: Value | undefined, what: string): Value {
  return requirePresent(value, { owner: "infer", query: null, origin: null, message: `${PORT}: ${what} is missing` });
}

function refused(diagnostic: Diagnostic): Output {
  return { kind: "done", value: { kind: "refused", diagnostics: [diagnostic] } };
}

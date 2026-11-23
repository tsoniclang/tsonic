import type { Diagnostic, Result } from "../diag/contract.js";
import type { BodyId, CandidateListId, DefId, LocalId, LocalRef, NodeId, NodeRef, Origin, SourceNodeRef, TyId } from "../ids/contract.js";
import type { BindingScope, BindingVector, CategoryEvidence, Signature } from "../ir-types/contract.js";
import type { CallExpression, CapturedFact, Expression, HirApplication, HirBody, HirCandidateList, HirNode, HirParam, HirResolution, CheckedPhase } from "../ir-hir/contract.js";
import type { CallConstraint, DefaultConstraint, FlowConstraint, InferenceCandidateList, InferenceGroup, InferenceValue, InferenceVariable, InferredPartType, InferredSignaturePart, LiteralConstraint, LiteralConstructionConstraint, LiteralPart, MemberConstraint, OperatorConstraint } from "../ir-infer/contract.js";
import type { ConstraintsOf, ConstraintsPaused, ConstraintsRequest, GroupConstraints, InferenceInputs, InferStep, ResumeConstraintsOf, SelectionConstraintContext } from "./contract.js";
import { requirePresent, resourceLimitDiagnostic } from "../diag/index.js";
import { admitTypePublicationStep, internType, internTypeGraph, optionalValueDomainOf, readSignature, readType, rigidBindings,
  refuseTypeConstruction, signatureRequestKey, viewTypes } from "../ir-types/index.js";
import { inferredPartKey, inferredPartsOf } from "../ir-infer/index.js";
import { binaryOperatorOf, checkedMemberStorageOf, checkedVariableStorageOf, compoundAssignmentOperatorOf, prefixOperatorOf, readWriteRootStorageOf, resolveModuleBinding, shortCircuitOperatorOf, unparenthesizedExpression, writableRootStorageOf } from "../ir-hir/index.js";
import { callerDefect, notInferredYet, validateInferenceLimits } from "./frontier.js";
import { checkedVoidCompletion, ownSignatureRequest } from "./own-signature.js";
import { candidateEndpoint, endpointRequest, endpointsOf, unavailableCandidate } from "./candidates.js";

const PORT = "ConstraintsOf";
const RESUME = "ResumeConstraintsOf";
const TEMPLATE: BindingVector = { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] };

type Output = InferStep<GroupConstraints, ConstraintsRequest, ConstraintsPaused>;
type FormCutRequest = Extract<ConstraintsRequest, { readonly kind: "form-cut" }>;
type Slot = TyId | { readonly part: InferredSignaturePart };
type Refusal = Extract<Result<never>, { readonly kind: "refused" }>;
interface ParameterPosition {
  readonly parameter: HirParam;
  readonly index: number;
}
type ParameterIndex = Map<BodyId, ReadonlyMap<LocalId, ParameterPosition>>;
type DraftProperty = Omit<Extract<LiteralPart, { readonly kind: "property" }>, "type"> & { readonly type: Slot };
type DraftArgument = Omit<CallConstraint["application"]["arguments"][number], "type"> & { readonly type: Slot };
type DraftCall = Omit<CallConstraint, "application"> & {
  readonly application: Omit<CallConstraint["application"], "arguments"> & { readonly arguments: readonly DraftArgument[] };
};
type DraftConstraint =
  | Omit<FlowConstraint, "from" | "to"> & { readonly from: Slot; readonly to: Slot }
  | Omit<OperatorConstraint, "operands" | "result"> & { readonly operands: readonly Slot[]; readonly result: Slot }
  | Omit<MemberConstraint, "receiver" | "result"> & { readonly receiver: Slot; readonly result: Slot }
  | Omit<LiteralConstraint, "destination"> & { readonly destination: Slot }
  | Omit<LiteralConstructionConstraint, "parts"> & { readonly parts: readonly DraftProperty[] }
  | DraftCall | DefaultConstraint;

interface Draft {
  readonly body: HirBody;
  readonly scope: BindingScope;
  readonly bindings: BindingVector;
  readonly candidates: ReadonlyMap<CandidateListId, InferenceCandidateList>;
  readonly variables: InferenceVariable[];
  readonly constraints: DraftConstraint[];
  readonly evidence: { readonly type: Slot; readonly node: Expression<CheckedPhase> | HirNode; readonly component: SourceNodeRef }[];
}

interface Generation {
  readonly deps: InferenceInputs;
  readonly group: InferenceGroup;
  readonly parts: ReadonlyMap<BodyId, readonly InferredSignaturePart[]>;
  readonly partTypes: Map<string, TyId>;
  readonly ownParts: ReadonlySet<string>;
  readonly ownDefinitions: ReadonlySet<DefId>;
  readonly signatures: ReadonlyMap<string, Signature>;
  readonly parameters: ParameterIndex;
  readonly outsideParts: ReadonlyMap<string, InferredPartType>;
  readonly selectionContexts: SelectionConstraintContext[];
  nextVariable: number;
}

interface Walk {
  readonly generation: Generation;
  readonly draft: Draft;
  readonly signature: Signature | undefined;
  readonly typeOf: Map<NodeId, Slot>;
  readonly operators: Map<NodeId, TyId>;
  readonly returnPart: InferredSignaturePart | undefined;
  returnedOperand: boolean;
  bareReturn: Origin | null;
}

type Frame = { readonly node: HirNode; readonly readWriteTarget: boolean; readonly caseSubject?: Expression<CheckedPhase> } &
  ({ readonly kind: "enter"; readonly statementList: boolean; readonly nativeDefault: "none" | "owned" | "operand" }
    | { readonly kind: "leave" });

export const constraintsOf: ConstraintsOf = (deps, group) => {
  validateInferenceLimits(PORT, deps.limits, deps.graph);
  if (group.bodies.length === 0) return callerDefect(PORT, "a constraint invocation requires a nonempty group");
  const requests: ConstraintsRequest[] = [];
  const requestBodies: BodyId[] = [];
  const ownDefinitions = new Set(group.signatures.map(part => part.definition));
  const ownParts = new Set(group.signatures.map(inferredPartKey));
  const requestedParts = new Set<string>();
  const requestedSignatures = new Set<string>();
  const eligibleCandidates: (readonly HirCandidateList[])[] = [];
  const parameters: ParameterIndex = new Map();
  const originalDiagnostics = new Set<Diagnostic>();
  const pauseForCut = (cut: FormCutRequest): Output => {
    const pending: readonly [FormCutRequest] = [cut];
    return { kind: "paused", requests: pending,
      paused: { group, requestBodies: [cut.at.body], requests: pending, eligibleCandidates }, earned: [...originalDiagnostics] };
  };
  const requestPart = (body: BodyId, part: InferredSignaturePart): void => {
    const key = inferredPartKey(part);
    if (ownParts.has(key) || requestedParts.has(key)) return;
    requestedParts.add(key);
    requests.push({ kind: "inferred-part", part });
    requestBodies.push(body);
  };
  const inspectBinding = (body: BodyId, local: LocalRef): void => {
    const reference = deps.hirBody(local.body).locals[local.local]?.declaration;
    if (reference?.kind === "item" && deps.cuts.declaration(reference.value.owner) !== null) return;
    const binding = localBinding(deps, local);
    const declared = binding.declaration.tsonic.declaredType;
    if (declared.kind === "unavailable" && declared.reason === "checker-error") {
      collectOriginalFact(deps, declared, originalDiagnostics);
      return;
    }
    if (originalDiagnostics.size !== 0) return;
    if (declared.kind !== "available")
      return notInferredYet(PORT, "the actual declaration type availability of a local", binding.declaration.origin);
    if (declared.value === null) requestPart(body, { definition: binding.definition, part: { kind: "variable" } });
  };
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
    if (originalDiagnostics.size === 0) {
      const request = ownSignatureRequest(deps, body, PORT, ownDefinitions);
      if (request !== null) signatureRequest(reference, request);
      else if (ownDefinitions.has(body.owner)) for (const part of inferredPartsOf(body.owner, deps.itemOf(body.owner))) requestPart(reference, part);
    }
    for (const local of body.locals)
      if (local.role === "binding") inspectBinding(reference, { body: reference, local: local.id });
    for (const capture of body.captures) {
      if (originalDiagnostics.size !== 0) break;
      const owner = deps.hirBody(capture.body);
      const selected = parametersOf(parameters, owner).get(capture.local);
      const captured = owner.locals[capture.local]?.declaration;
      if (captured?.kind === "item" && deps.structuralCuts.declaration(captured.value.owner))
        return pauseForCut({ kind: "form-cut", definition: captured.value.owner, at: { body: reference, node: body.root.id } });
      if (selected === undefined) {
        if (owner.locals[capture.local]?.role === "binding") inspectBinding(reference, capture);
        continue;
      }
      const declaration = parameterDeclaration(deps, owner, selected.parameter);
      const checked = declaration.tsonic.declaredType;
      if (checked.kind !== "available") return notInferredYet(PORT, "the actual captured parameter type availability", declaration.origin);
      if (checked.value !== null || selected.parameter.initializer === null) continue;
      requestPart(reference, { definition: owner.owner, part: { kind: "parameter-initializer", index: selected.index } });
    }
    const inspected = inspectCheckedExecution(deps, body, originalDiagnostics, part => requestPart(reference, part));
    if (inspected.kind === "form-cut") return pauseForCut(inspected);
    const lists = inspected.lists;
    eligibleCandidates.push(lists);
    if (originalDiagnostics.size !== 0) continue;
    for (const list of lists) for (const candidate of list.candidates) {
      if (unavailableCandidate(candidate) !== null) continue;
      const endpoint = candidateEndpoint(deps, candidate);
      if (candidate.bindings.kind !== "available") return callerDefect(PORT, "a candidate must retain its actual complete bindings");
      signatureRequest(reference, { kind: "declaredSignatureOf", request: endpointRequest(deps, endpoint,
        { kind: "instantiated", bindings: candidate.bindings.value }) });
    }
  }
  if (originalDiagnostics.size !== 0) {
    const [first, ...rest] = originalDiagnostics;
    return { kind: "done", value: { kind: "refused", diagnostics: [present(first, "the actual original checker refusal"), ...rest] } };
  }
  const [first, ...rest] = requests;
  if (first === undefined) return generate(deps, group, new Map(), [], eligibleCandidates);
  const pending: readonly [ConstraintsRequest, ...ConstraintsRequest[]] = [first, ...rest];
  return { kind: "paused", requests: pending, paused: { group, requestBodies, requests: pending, eligibleCandidates }, earned: [] };
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
  return generate(deps, paused.group, signatures, outsideParts, paused.eligibleCandidates);
};

function ownedParts(deps: InferenceInputs, group: InferenceGroup): ReadonlyMap<BodyId, readonly InferredSignaturePart[]> {
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

function generate(deps: InferenceInputs, group: InferenceGroup, signatures: ReadonlyMap<string, Signature>, outsideParts: readonly InferredPartType[],
  eligibleCandidates: readonly (readonly HirCandidateList[])[]): Output {
  const generation: Generation = { deps, group, parts: ownedParts(deps, group), partTypes: new Map(), nextVariable: 0, selectionContexts: [],
    ownParts: new Set(group.signatures.map(inferredPartKey)), ownDefinitions: new Set(group.signatures.map(part => part.definition)), signatures, parameters: new Map(),
    outsideParts: new Map(outsideParts.map(part => [inferredPartKey(part.part), part])) };
  const drafts: Draft[] = group.bodies.map((reference, position) => {
    const body = deps.hirBody(reference);
    const candidates = readyCandidates(generation, present(eligibleCandidates[position], "the body's eligible candidate rows"));
    const scope = deps.bindingScopeOf(body.owner);
    return { body, scope, bindings: rigidBindings(scope), candidates: new Map(candidates.map(list => [list.id, list])),
      variables: [], constraints: [], evidence: [] };
  });
  const enumInitializers: { readonly occurrence: NodeRef; readonly type: Slot }[] = [];
  for (const draft of drafts) {
    const { body } = draft;
    const reference = body.body;
    const own = ownSignatureRequest(deps, body, PORT, generation.ownDefinitions);
    const owned = generation.parts.get(reference) ?? [];
    const returnPart = owned.find(part => part.part.kind === "return");
    const walk: Walk = { generation, draft, signature: own === null ? undefined : signatures.get(signatureRequestKey(own.request)),
      typeOf: new Map(), operators: new Map(), returnPart, returnedOperand: false, bareReturn: null };
    const inferReturn = returnPart !== undefined;
    const inferInitializer = deps.itemOf(body.owner).kind === "EnumMember" ||
      owned.some(part => part.part.kind === "variable" || part.part.kind === "parameter-initializer");
    for (const part of owned) {
      const diagnostic = allocate(walk, { kind: "signature", signature: part, occurrence: refOf(walk, body.root) });
      if (diagnostic !== null) return refused(diagnostic);
    }
    const pending: Frame[] = [{ kind: "enter", node: body.root, statementList: false,
      nativeDefault: inferInitializer ? "owned" : "none", readWriteTarget: false }];
    for (let frame = pending.pop(); frame !== undefined; frame = pending.pop()) {
      if (frame.kind === "enter") {
        if (deps.cuts.syntax(frame.node) !== null || !inCurrentExecution(body, frame.node)) continue;
        const node = frame.node;
        if (node.kind === "NumericLiteral" && node.tsonic.role === "value"
          && (frame.nativeDefault === "owned" || frame.nativeDefault === "operand"
            && node.tsonic.value.views.contextual.kind === "available" && node.tsonic.value.views.contextual.value === null)) {
          const occurrence = refOf(walk, node);
          const variable = generation.nextVariable;
          const diagnostic = allocate(walk, { kind: "literal", value: node.tsonic.literal, occurrence });
          if (diagnostic !== null) return refused(diagnostic);
          draft.constraints.push({ kind: "default", occurrence, variable, rule: "literal-native-default", type: null });
          walk.typeOf.set(node.id, internType(deps.types, { kind: "open", group: group.id, variable }));
        }
        const compound = node.kind === "BinaryExpression" && compoundAssignmentOperatorOf(node.operatorToken.kind) !== null;
        const logical = node.kind === "BinaryExpression" && shortCircuitOperatorOf(node.operatorToken.kind, "assignment") !== null;
        const sequence = node.kind === "BinaryExpression" && node.tsonic.role === "sequence";
        if (frame.node.kind === "BinaryExpression" && (compound || frame.node.tsonic.role === "arithmetic" || frame.node.tsonic.role === "comparison")
          || frame.node.kind === "PrefixUnaryExpression" || frame.node.kind === "PostfixUnaryExpression" || frame.node.kind === "VoidExpression" || frame.node.kind === "CallExpression"
          || frame.node.kind === "PropertyAccessExpression" && frame.node.tsonic.role === "value") {
          const diagnostic = allocate(walk, { kind: "local", local: null, occurrence: refOf(walk, frame.node) });
          if (diagnostic !== null) return refused(diagnostic);
          walk.operators.set(frame.node.id, internType(deps.types,
            { kind: "open", group: group.id, variable: generation.nextVariable - 1 }));
        }
        const children = Array.from(childrenOf(node, frame.statementList));
        const operatorOperand = node.kind === "BinaryExpression" && (node.tsonic.role === "arithmetic" || node.tsonic.role === "comparison")
          || node.kind === "PrefixUnaryExpression" && node.operator !== "ExclamationToken" && node.tsonic.role === "value";
        const nativeDefault = node.kind === "ReturnStatement" ? inferReturn ? "owned" : "none"
          : node.kind === "ParenthesizedExpression" ? frame.nativeDefault : operatorOperand ? "operand" : "none";
        const readWriteTarget = node.kind === "ParenthesizedExpression" && frame.readWriteTarget
          || (node.kind === "PostfixUnaryExpression" || node.kind === "PrefixUnaryExpression")
            && (node.operator === "PlusPlusToken" || node.operator === "MinusMinusToken");
        pending.push({ ...frame, kind: "leave" });
        for (let index = children.length - 1; index >= 0; index -= 1) {
          const child = present(children[index], "a checked syntax child");
          const caseSubject = node.kind === "SwitchStatement" && child === node.caseBlock ? node.expression
            : node.kind === "CaseBlock" && child.kind === "CaseClause" ? frame.caseSubject : undefined;
          pending.push({ kind: "enter", node: child, nativeDefault: sequence && index === 1 ? frame.nativeDefault : nativeDefault,
            statementList: isStatementListEntry(node, index),
            readWriteTarget: readWriteTarget || (compound || logical) && index === 0,
            ...(caseSubject === undefined ? {} : { caseSubject }) });
        }
      } else {
        const result = leave(walk, frame.node, frame.readWriteTarget, frame.caseSubject);
        if (result !== undefined) return { kind: "done", value: result };
      }
    }
    if (returnPart !== undefined && !walk.returnedOperand) {
      const type = checkedVoidCompletion(deps, body);
      if (type === null) return notInferredYet(PORT, "a no-value result without its actual checked void completion", walk.bareReturn ?? body.root.origin);
      const slot = present(readySlotType(generation, { part: returnPart }), "the allocated result slot");
      const term = readType(deps.types, slot);
      if (term.kind !== "open" || term.group !== group.id)
        return callerDefect(PORT, "a no-value completion must name its actual inferred result variable");
      draft.constraints.push({ kind: "default", occurrence: refOf(walk, body.root), variable: term.variable, rule: "signature-producers", type });
    } else if (walk.bareReturn !== null) {
      return notInferredYet(PORT, "an inferred signature mixing bare and value returns", walk.bareReturn);
    }
    if (body.root.kind !== "Block" && body.root.kind !== "SourceFile") {
      const part = (generation.parts.get(reference) ?? []).find(candidate => candidate.part.kind === "parameter-initializer"
        || candidate.part.kind === "variable" || candidate.part.kind === "field");
      if (part === undefined) {
        const owner = deps.itemOf(body.owner);
        if (owner.kind === "EnumMember") {
          if (owner.tsonic.initializer !== body.body || owner.initializer !== body.root)
            return callerDefect(PORT, "an enum initializer must be its actual member's qualified expression");
          enumInitializers.push({ occurrence: refOf(walk, body.root), type: typeAt(walk, body.root) });
          continue;
        }
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
  const typeOf = (slot: Slot): TyId => present(readySlotType(generation, slot), "the actual owned or ready outside type slot");
  return { kind: "done", value: { kind: "ok", value: { outsideParts, selectionContexts: generation.selectionContexts,
    enumInitializers: enumInitializers.map(entry => ({ occurrence: entry.occurrence, type: typeOf(entry.type) })), constraints: drafts.map(draft => ({
    group: group.id, body: draft.body.body, variables: draft.variables, candidates: [...draft.candidates.values()],
    constraints: draft.constraints.map(constraint => constraint.kind === "flow"
      ? { ...constraint, from: typeOf(constraint.from), to: typeOf(constraint.to) }
      : constraint.kind === "op" ? { ...constraint, operands: constraint.operands.map(typeOf), result: typeOf(constraint.result) }
      : constraint.kind === "member" ? { ...constraint, receiver: typeOf(constraint.receiver), result: typeOf(constraint.result) }
      : constraint.kind === "literal" ? { ...constraint, destination: typeOf(constraint.destination) }
      : constraint.kind === "call" ? { ...constraint, application: { ...constraint.application,
        arguments: constraint.application.arguments.map(argument => ({ ...argument, type: typeOf(argument.type) })) } }
      : constraint.kind === "construct-literal" ? { ...constraint, parts: constraint.parts.map(part => ({ ...part, type: typeOf(part.type) })) }
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
  | Omit<Extract<InferenceVariable, { readonly kind: "local" }>, "id">
  | Omit<Extract<InferenceVariable, { readonly kind: "literal" }>, "id">): Diagnostic | null {
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

function inCurrentExecution(body: HirBody, node: HirNode): boolean {
  if (body.root.kind !== "SourceFile" || node.parent !== body.root.id
    || node.kind === "ExpressionStatement" || node.kind === "ThrowStatement" || node.kind === "EmptyStatement"
    || node.kind === "VariableStatement" || node.kind === "Block" || node.kind === "IfStatement" || node.kind === "LabeledStatement"
    || node.kind === "WhileStatement" || node.kind === "DoStatement" || node.kind === "ForStatement"
    || node.kind === "SwitchStatement") return true;
  if (node.kind === "FunctionDeclaration" || node.kind === "InterfaceDeclaration"
    || node.kind === "TypeAliasDeclaration" || node.kind === "EnumDeclaration"
    || node.kind === "ImportDeclaration" || node.kind === "ExportDeclaration") return false;
  return notInferredYet(PORT, `a ${node.kind} in a module body`, node.origin);
}

function isStatementListEntry(parent: HirNode, index: number): boolean {
  return parent.kind === "Block" || parent.kind === "DefaultClause" || parent.kind === "CaseClause" && index > 0;
}

function* childrenOf(node: HirNode, statementList: boolean): Generator<HirNode, void, undefined> {
  switch (node.kind) {
    case "Block": case "SourceFile": yield* node.statements.nodes; return;
    case "ReturnStatement": { const expression = node.expression; if (expression !== null) yield expression; return; }
    case "ThrowStatement": case "ExpressionStatement": yield node.expression; return;
    case "BreakStatement": case "ContinueStatement": return;
    case "LabeledStatement": yield node.statement; return;
    case "IfStatement": {
      yield node.expression;
      yield node.thenStatement;
      const alternate = node.elseStatement;
      if (alternate !== null) yield alternate;
      return;
    }
    case "SwitchStatement": yield node.expression; yield node.caseBlock; return;
    case "CaseBlock": yield* node.clauses.nodes; return;
    case "CaseClause": yield node.expression; yield* node.statements.nodes; return;
    case "DefaultClause": yield* node.statements.nodes; return;
    case "WhileStatement": yield node.expression; yield node.statement; return;
    case "DoStatement": yield node.statement; yield node.expression; return;
    case "ForStatement": {
      const initializer = node.initializer;
      if (initializer?.kind === "MissingDeclaration")
        return notInferredYet(PORT, "a for initializer with a missing declaration", node.origin);
      if (initializer !== null) yield initializer;
      const condition = node.condition;
      if (condition !== null) yield condition;
      const incrementor = node.incrementor;
      if (incrementor !== null) yield incrementor;
      yield node.statement;
      return;
    }
    case "EmptyStatement": case "VariableStatement": case "VariableDeclarationList": return;
    case "InterfaceDeclaration": case "TypeAliasDeclaration": case "EnumDeclaration":
      if (statementList) return;
      return notInferredYet(PORT, `a ${node.kind}`, node.origin);
    case "ParenthesizedExpression": case "AsExpression": case "TypeAssertionExpression": case "SatisfiesExpression":
    case "NonNullExpression": case "VoidExpression": yield node.expression; return;
    case "PrefixUnaryExpression": case "PostfixUnaryExpression": yield node.operand; return;
    case "BinaryExpression": yield node.left; yield node.right; return;
    case "ConditionalExpression": yield node.condition; yield node.whenTrue; yield node.whenFalse; return;
    case "CallExpression": yield node.expression; yield* node.arguments.nodes; return;
    case "ObjectLiteralExpression": yield* node.properties.nodes; return;
    case "PropertyAssignment": yield node.initializer; return;
    case "PropertyAccessExpression": yield node.expression; return;
    case "Identifier": case "TrueKeyword": case "FalseKeyword": case "NumericLiteral": case "StringLiteral":
    case "NoSubstitutionTemplateLiteral": case "NullKeyword": return;
    default: return notInferredYet(PORT, `a ${node.kind}`, node.origin);
  }
}

function collectOriginalDiagnostics(deps: InferenceInputs, body: HirBody, node: HirNode, diagnostics: Set<Diagnostic>): void {
  const annotation = node.tsonic;
  let fact = annotation === null || !("role" in annotation) ? null : annotation.role === "value" ? annotation.value.views.read
    : annotation.role === "assignment-target" ? annotation.place.kind === "available" ? annotation.place.value.read : annotation.place : null;
  if (node.kind === "ConditionalExpression" || node.kind === "VoidExpression") fact = node.tsonic.views.read;
  else if (node.kind === "AsExpression" || node.kind === "TypeAssertionExpression" || node.kind === "SatisfiesExpression") {
    const target = node.type.tsonic.type;
    fact = target.kind === "unavailable" && target.reason === "checker-error" ? target : node.tsonic.views.read;
  }
  else if (node.kind === "BinaryExpression" && node.tsonic.role === "short-circuit") fact = node.tsonic.value.views.read;
  if (node.kind === "CallExpression") {
    const application = node.tsonic.application;
    if (application.kind === "unavailable") fact = application;
    else {
      const { candidates, resolvedSignature } = application.value;
      if (resolvedSignature.kind === "unavailable" && resolvedSignature.reason === "checker-error") {
        const group = candidates.kind === "available" ? body.candidateLists[candidates.value] : undefined;
        if (group === undefined || candidates.kind !== "available" || group.id !== candidates.value || group.candidates.length !== 0)
          return callerDefect(PORT, "an original rejected call retains its actual empty candidate list");
        fact = resolvedSignature;
      }
    }
  }
  if (fact !== null) collectOriginalFact(deps, fact, diagnostics);
  if (node.kind === "CallExpression" && node.typeArguments !== null)
    for (const argument of node.typeArguments.nodes) collectOriginalFact(deps, argument.tsonic.type, diagnostics);
}

function collectOriginalFact(deps: InferenceInputs, fact: CapturedFact<unknown>, diagnostics: Set<Diagnostic>): void {
  if (fact.kind !== "unavailable" || fact.reason !== "checker-error") return;
  if (fact.causes.length === 0) return callerDefect(PORT, "a checker failure retains a nonempty original cause");
  for (const cause of fact.causes) {
    if (cause.kind !== "diagnostic" || cause.diagnostic.kind !== "checker")
      return callerDefect(PORT, "an original checker failure retains its actual checker diagnostic identity");
    const reference = cause.diagnostic.diagnostic;
    const diagnostic = deps.checkerDiagnosticsOf(reference.module)[reference.index];
    if (diagnostic === undefined) return callerDefect(PORT, "a checker failure names its actual published diagnostic");
    diagnostics.add(diagnostic);
  }
}

function resolvedValueName(deps: InferenceInputs, resolution: HirResolution): HirResolution {
  if (resolution.kind !== "binding") return resolution;
  const answer = resolveModuleBinding(deps, resolution.occurrence).target;
  return answer.kind === "available" ? answer.value : answer;
}

function* checkerCallChildren(deps: InferenceInputs, body: BodyId, call: CallExpression<CheckedPhase>, application: HirApplication): Generator<HirNode> {
  yield call.expression;
  for (const argument of application.arguments) {
    const actual = deps.checkedNodeOf({ kind: "body", value: { body, node: argument.expression } });
    if (actual === null || actual.id !== argument.expression)
      return callerDefect(PORT, "checker evidence requires its verified qualified application argument");
    yield actual;
  }
}

function inspectCheckedExecution(deps: InferenceInputs, body: HirBody, diagnostics: Set<Diagnostic>,
  request: (part: InferredSignaturePart) => void): FormCutRequest | { readonly kind: "complete";
    readonly lists: readonly HirCandidateList[] } {
  const pending: { readonly parent: HirNode; readonly children: Iterator<HirNode>; next: number }[] = [];
  let node: HirNode | undefined = body.root;
  let statementList = false;
  const selectedLists = new Set<HirCandidateList>();
  let cut: { readonly request: FormCutRequest; readonly depth: number } | null = null;
  while (node !== undefined || pending.length !== 0) {
    if (node === undefined) {
      if (cut !== null && pending.length === cut.depth) {
        if (diagnostics.size === 0) return cut.request;
        cut = null;
      }
      const cursor = pending.at(-1);
      if (cursor === undefined) return callerDefect(PORT, "the checked discovery cursor has no active source frame");
      const child = cursor.children.next();
      if (child.done) pending.pop();
      else {
        statementList = isStatementListEntry(cursor.parent, cursor.next);
        cursor.next += 1;
        node = present(child.value, "a checked syntax child");
      }
      continue;
    }
    const current = node;
    node = undefined;
    if (deps.cuts.syntax(current) !== null || !inCurrentExecution(body, current)) continue;
    if (current.kind === "FunctionDeclaration" && current.tsonic.body !== null) continue;
    collectOriginalDiagnostics(deps, body, current, diagnostics);
    if (cut === null && diagnostics.size === 0 && current.kind === "CallExpression" && current.tsonic.application.kind === "available") {
      const candidates = current.tsonic.application.value.candidates;
      if (candidates.kind === "available") {
        const list = body.candidateLists[candidates.value];
        if (list === undefined || list.id !== candidates.value)
          return callerDefect(PORT, "a checked call must retain its actual candidate list");
        if (!selectedLists.has(list)) {
          for (const candidate of list.candidates) {
            const definition = candidate.declaration;
            if (deps.structuralCuts.declaration(definition)) {
              cut = { depth: pending.length, request: { kind: "form-cut", definition, at: { body: body.body, node: current.id } } };
              break;
            }
          }
          if (cut === null) selectedLists.add(list);
        }
      }
    }
    if (cut === null && diagnostics.size === 0 && current.kind === "Identifier" && (current.tsonic.role === "value" || current.tsonic.role === "assignment-target")) {
      const selected = resolvedValueName(deps, current.tsonic.resolution);
      const definition = selected.kind === "declarations" && selected.definitions.length === 1 ? selected.definitions[0] : undefined;
      if (definition !== undefined) {
        if (deps.structuralCuts.declaration(definition))
          return { kind: "form-cut", definition, at: { body: body.body, node: current.id } };
        const item = deps.itemOf(definition);
        if (item.kind === "VariableDeclaration" && item.tsonic.declaration.kind === "definition"
          && item.tsonic.declaration.definition === definition && item.tsonic.declaredType.kind === "available"
          && item.tsonic.declaredType.value === null)
          for (const part of inferredPartsOf(definition, item)) request(part);
      } else if (selected.kind === "local") {
        const declaration = deps.hirBody(selected.local.body).locals[selected.local.local]?.declaration;
        if (declaration?.kind === "item") {
          const owner = declaration.value.owner;
          if (deps.structuralCuts.declaration(owner))
            return { kind: "form-cut", definition: owner, at: { body: body.body, node: current.id } };
        }
      }
    }
    const children = cut !== null && current.kind === "CallExpression" && current.tsonic.application.kind === "available"
      ? checkerCallChildren(deps, body.body, current, current.tsonic.application.value) : childrenOf(current, statementList);
    pending.push({ parent: current, children, next: 0 });
  }
  if (cut !== null && diagnostics.size === 0) return cut.request;
  const lists = [...selectedLists];
  lists.sort((left, right) => left.id - right.id);
  return { kind: "complete", lists };
}

function unaryConstraint(walk: Walk, node: HirNode, source: Expression<CheckedPhase>, operator: OperatorConstraint["operator"]): void {
  const occurrence = refOf(walk, node);
  const result = present(walk.operators.get(node.id), "the actual unary operator result position");
  const operand = typeAt(walk, source);
  walk.draft.constraints.push({ kind: "op", occurrence, operator, operands: [operand], result, permissionScope: null });
  walk.draft.evidence.push({ type: operand, node: source, component: { kind: "body", value: refOf(walk, source) } },
    { type: result, node, component: { kind: "body", value: occurrence } });
  walk.typeOf.set(node.id, result);
}

function leave(walk: Walk, node: HirNode, readWriteTarget: boolean, caseSubject?: Expression<CheckedPhase>): Refusal | undefined {
  if (node.kind === "Identifier") {
    const result = localType(walk, node, readWriteTarget);
    if (typeof result === "object" && "kind" in result) return result;
    walk.typeOf.set(node.id, result);
  }
  else if (node.kind === "TrueKeyword" || node.kind === "FalseKeyword" || node.kind === "NumericLiteral" || node.kind === "StringLiteral"
    || node.kind === "NoSubstitutionTemplateLiteral" || node.kind === "NullKeyword") {
    if (node.tsonic.role !== "value" || node.tsonic.value.views.read.kind !== "available")
      return notInferredYet(PORT, "the actual checked literal value type", node.origin);
    if (!walk.typeOf.has(node.id)) walk.typeOf.set(node.id, node.tsonic.value.views.read.value);
  }
  else if (node.kind === "ParenthesizedExpression") walk.typeOf.set(node.id, typeAt(walk, node.expression));
  else if (node.kind === "CaseClause") {
    const subject = present(caseSubject, "the actual enclosing switch subject");
    const { deps } = walk.generation;
    if (deps.cuts.syntax(subject) !== null || deps.cuts.syntax(node.expression) !== null) return;
    const occurrence = refOf(walk, node);
    const subjectType = typeAt(walk, subject);
    const labelType = typeAt(walk, node.expression);
    const result = internType(deps.types, { kind: "primitive", primitive: "bool" });
    walk.draft.constraints.push({ kind: "op", occurrence, operator: "===", operands: [subjectType, labelType], result, permissionScope: null });
    walk.draft.evidence.push({ type: subjectType, node: subject, component: { kind: "body", value: refOf(walk, subject) } },
      { type: labelType, node: node.expression, component: { kind: "body", value: refOf(walk, node.expression) } },
      { type: result, node, component: { kind: "body", value: occurrence } });
  }
  else if (node.kind === "NonNullExpression") {
    const result = node.tsonic.views.read;
    if (result.kind !== "available")
      return notInferredYet(PORT, "a non-null assertion without its actual checked result", node.origin);
    walk.typeOf.set(node.id, result.value);
  }
  else if (node.kind === "AsExpression" || node.kind === "TypeAssertionExpression" || node.kind === "SatisfiesExpression") {
    const target = node.type.tsonic.type;
    const result = node.tsonic.views.read;
    if (target.kind !== "available" || result.kind !== "available" || target.value !== result.value)
      return notInferredYet(PORT, "an assertion without the same ready authored target and checked result", node.origin);
    walk.typeOf.set(node.id, result.value);
  }
  else if (node.kind === "ConditionalExpression") {
    const result = node.tsonic.views.read;
    if (result.kind !== "available") return notInferredYet(PORT, "a conditional expression without its actual checked result", node.origin);
    walk.typeOf.set(node.id, result.value);
  }
  else if (node.kind === "ObjectLiteralExpression") objectConstruction(walk, node);
  else if (node.kind === "PropertyAccessExpression") {
    const access = node.tsonic.role === "value" ? "read" : node.tsonic.access;
    const storage = access === "read" ? null : checkedMemberStorageOf(node);
    if (node.questionDotToken !== null || node.tsonic.origins.kind !== "available"
      || access !== "read" && storage === null
      || node.name.kind !== "Identifier" || node.name.tsonic.role !== "property-name" || node.name.tsonic.key.kind !== "available")
      return notInferredYet(PORT, "the actual checked member key and declaration origins", node.origin);
    const result = storage === null ? present(walk.operators.get(node.id), "the actual member result position")
      : storage.read ?? storage.write;
    const receiver = typeAt(walk, node.expression);
    const occurrence = refOf(walk, node);
    walk.generation.selectionContexts.push({ kind: "member", occurrence, origin: node.origin });
    walk.draft.constraints.push({ kind: "member", occurrence, receiver,
      key: node.name.tsonic.key.value, access, result, origins: node.tsonic.origins.value, bindings: walk.draft.bindings });
    walk.draft.evidence.push({ type: receiver, node: node.expression, component: { kind: "body", value: refOf(walk, node.expression) } },
      { type: result, node, component: { kind: "body", value: refOf(walk, node) } });
    walk.typeOf.set(node.id, result);
  }
  else if (node.kind === "VoidExpression") unaryConstraint(walk, node, node.expression, "void");
  else if (node.kind === "PrefixUnaryExpression" || node.kind === "PostfixUnaryExpression") {
    const operator = prefixOperatorOf(node.operator);
    if (operator === "++" || operator === "--") {
      const leaf = unparenthesizedExpression<CheckedPhase>(node.operand);
      const target = leaf.kind === "Identifier" ? leaf.tsonic : null;
      const storage = target?.role === "assignment-target" && target.access === "read-write"
        ? readWriteRootStorageOf(target.place, target.resolution) : null;
      if (node.tsonic.role !== "update" || target === null || target.role !== "assignment-target" || storage === null
        || readWriteRootStorageOf(node.tsonic.target, target.resolution) !== storage)
        return notInferredYet(PORT, "the actual selected read-write root update target", node.origin);
    } else if (node.tsonic.role !== "value")
      return notInferredYet(PORT, `the unary operator ${node.operator} of role ${node.tsonic.role}`, node.origin);
    unaryConstraint(walk, node, node.operand, operator);
  }
  else if (node.kind === "BinaryExpression") {
    if (node.tsonic.role === "sequence") {
      if (node.operatorToken.kind !== "CommaToken") return callerDefect(PORT, "a sequence without its authored comma");
      walk.typeOf.set(node.id, typeAt(walk, node.right));
      return;
    }
    if (node.tsonic.role === "short-circuit") {
      const result = node.tsonic.value.views.read;
      if (shortCircuitOperatorOf(node.operatorToken.kind, "short-circuit") === null || result.kind !== "available")
        return notInferredYet(PORT, "a short-circuit expression without its authored operator and checked result", node.origin);
      walk.typeOf.set(node.id, result.value);
      return;
    }
    const compoundOperator = compoundAssignmentOperatorOf(node.operatorToken.kind);
    const reads = compoundOperator !== null || shortCircuitOperatorOf(node.operatorToken.kind, "assignment") !== null;
    if ((node.operatorToken.kind === "EqualsToken" || reads) && node.tsonic.role === "assignment") {
      const target = node.tsonic.target;
      const leaf = unparenthesizedExpression<CheckedPhase>(node.left);
      const name = leaf.kind === "Identifier" ? leaf.tsonic : null;
      const storageOf = reads ? readWriteRootStorageOf : writableRootStorageOf;
      if (leaf.kind === "PropertyAccessExpression") {
        const member = leaf.tsonic;
        const storage = checkedMemberStorageOf(leaf);
        if (member.role !== "assignment-target" || member.place !== target || member.access !== (reads ? "read-write" : "write")
          || storage === null || (reads && storage.read !== storage.write))
          return notInferredYet(PORT, "the actual selected writable member target", node.origin);
      } else {
        const selected = name?.role === "assignment-target" && name.access === (reads ? "read-write" : "write")
          && (!reads || compoundOperator !== null || name.resolution.kind === "local") ? storageOf(target, name.resolution) : null;
        if (selected === null || name?.role !== "assignment-target" || storageOf(name.place, name.resolution) !== selected)
          return notInferredYet(PORT, "the actual writable root assignment target", node.origin);
      }
      const storage = typeAt(walk, node.left);
      const targetComponent: SourceNodeRef = { kind: "body", value: refOf(walk, leaf) };
      const literal = unparenthesizedExpression<CheckedPhase>(node.right);
      let right = typeAt(walk, node.right);
      if (literal.kind === "NumericLiteral" && literal.tsonic.role === "value" && literal.tsonic.literal.kind === "number") {
        const types = walk.generation.deps.types;
        const checked = typeof right === "number" && !reads ? readType(types, right) : null;
        const optional = checked?.kind === "literal" && typeof storage === "number" && checked.base !== storage
          ? optionalValueDomainOf(readType(types, storage), type => readType(types, type)) : null;
        if (checked?.kind !== "literal" || (checked.base !== storage
          && (optional?.kind !== "optional-value" || optional.payload !== "float64" || optional.present !== checked.base))) {
          const occurrence = refOf(walk, literal);
          walk.draft.constraints.push({ kind: "literal", occurrence, value: literal.tsonic.literal, destination: storage });
          walk.draft.evidence.push({ type: storage, node: leaf, component: targetComponent });
          walk.typeOf.set(node.right.id, storage);
          right = storage;
        }
      }
      if (compoundOperator !== null) {
        const occurrence = refOf(walk, node);
        const result = present(walk.operators.get(node.id), "the actual assignment calculation result position");
        walk.draft.constraints.push({ kind: "op", occurrence, operator: compoundOperator,
          operands: [storage, right], result, permissionScope: null });
        walk.draft.evidence.push({ type: storage, node: leaf, component: targetComponent },
          { type: right, node: node.right, component: { kind: "body", value: refOf(walk, node.right) } },
          { type: result, node, component: { kind: "body", value: occurrence } });
        walk.typeOf.set(node.id, result);
      } else {
        flow(walk, node.right, right, storage, "assignment", targetComponent);
        walk.typeOf.set(node.id, storage);
      }
      return;
    }
    const operator = binaryOperatorOf(node.operatorToken.kind);
    const arithmetic = operator === "+" || operator === "-" || operator === "*" || operator === "/" || operator === "%"
      || operator === "&" || operator === "|" || operator === "^" || operator === "<<" || operator === ">>" || operator === ">>>";
    if (reads || operator === null || (arithmetic ? node.tsonic.role !== "arithmetic" : node.tsonic.role !== "comparison"))
      return notInferredYet(PORT, `the binary operator ${node.operatorToken.kind}`, node.origin);
    const result = present(walk.operators.get(node.id), "the actual operator result position");
    const left = typeAt(walk, node.left);
    const right = typeAt(walk, node.right);
    walk.draft.constraints.push({ kind: "op", occurrence: refOf(walk, node), operator,
      operands: [left, right], result, permissionScope: null });
    const evidence: readonly (readonly [Slot, HirNode])[] = [[left, node.left], [right, node.right], [result, node]];
    for (const [type, source] of evidence)
      walk.draft.evidence.push({ type, node: source, component: { kind: "body", value: refOf(walk, source) } });
    walk.typeOf.set(node.id, result);
  } else if (node.kind === "CallExpression") {
    const captured = node.tsonic.application;
    if (captured.kind !== "available" || captured.value.kind !== "call" || captured.value.candidates.kind !== "available")
      return notInferredYet(PORT, "the actual captured call candidate inventory", node.origin);
    if (captured.value.receiver !== null)
      return notInferredYet(PORT, "the authoritative receiver contribution of a call", node.origin);
    const authoredTypes = node.typeArguments?.nodes ?? [];
    const typeArguments = captured.value.typeArguments;
    if (typeArguments.length !== authoredTypes.length)
      return callerDefect(PORT, "a call retains its actual authored type-argument inventory");
    if (captured.value.arguments.length !== node.arguments.nodes.length)
      return callerDefect(PORT, "a call retains its actual captured source argument inventory");
    const candidates = walk.draft.candidates.get(captured.value.candidates.value);
    const candidate = candidates?.id === captured.value.candidates.value && candidates.candidates.length === 1
      ? candidates.candidates[0] : undefined;
    const signature = candidate?.endpoints.kind === "available" && candidate.conditionalFailure.kind === "available"
      && candidate.conditionalFailure.value === null && node.tsonic.core.provider.kind === "available"
      && node.tsonic.core.provider.value === null && captured.value.arguments.length !== 0
      ? readSignature(walk.generation.deps.types, candidate.endpoints.value.apiSignature) : null;
    const arguments_ = captured.value.arguments.map((argument, index): DraftArgument => {
      const source = node.arguments.nodes[index];
      if (source === undefined || argument.kind !== "value" || argument.expression !== source.id)
        return notInferredYet(PORT, "the actual selected source transport of a spread call argument", node.origin);
      return { occurrence: refOf(walk, source), kind: argument.kind, type: typeAt(walk, source), tuple: null, closure: null };
    });
    const result = present(walk.operators.get(node.id), "the actual application result position");
    const callee = typeAt(walk, node.expression);
    if (typeof callee !== "number") return notInferredYet(PORT, "a callee whose signature is an unresolved inferred part", node.origin);
    const occurrence = refOf(walk, node);
    walk.generation.selectionContexts.push({ kind: "call", occurrence, origin: node.origin, scope: walk.draft.scope });
    walk.draft.constraints.push({ kind: "call", occurrence, application: {
      captured: node.tsonic.core, permissionScope: null, callee, receiver: null, typeArguments, arguments: arguments_,
      candidates: captured.value.candidates.value, result,
    } });
    walk.draft.evidence.push({ type: callee, node: node.expression, component: { kind: "body", value: refOf(walk, node.expression) } },
      { type: result, node, component: { kind: "body", value: refOf(walk, node) } });
    for (const [index, source] of authoredTypes.entries()) {
      const type = typeArguments[index];
      if (type === undefined || source.tsonic.type.kind !== "available" || source.tsonic.type.value !== type)
        return callerDefect(PORT, "a type argument requires its actual checked source association");
      walk.draft.evidence.push({ type, node: source, component: { kind: "body", value: refOf(walk, source) } });
    }
    for (const [index, argument] of arguments_.entries()) {
      const source = node.arguments.nodes[index];
      if (source === undefined) return callerDefect(PORT, "a call retains every actual argument occurrence");
      walk.draft.evidence.push({ type: argument.type, node: source, component: { kind: "body", value: argument.occurrence } });
    }
    if (signature !== null && signature.kind === "call" && signature.receiver === null && signature.typeParameters.length === 0
      && arguments_.length <= signature.parameters.length) for (const [index, argument] of arguments_.entries()) {
      const formal = signature.parameters[index];
      const actual = readySlotType(walk.generation, argument.type);
      if (formal === undefined || formal.kind === "rest" || formal.passing !== "by-value"
        || actual === undefined || formal.type === actual) continue;
      const originalType = readType(walk.generation.deps.types, actual);
      if (originalType.kind === "open" || originalType.kind === "error") continue;
      const source = present(node.arguments.nodes[index], "the actual argument requiring a flow");
      if (formal.kind === "optional" && candidate?.endpoints.kind === "available" && candidate.endpoints.value.api.body !== null) {
        const selected = candidate.endpoints.value.api.body;
        const body = walk.generation.deps.hirBody(selected);
        const row = body.params[index];
        if (body.body !== selected || row?.role !== "optional" || row.declaration !== formal.declaration || row.initializer !== formal.initializer)
          return callerDefect(PORT, "an optional formal component requires its actual selected checked parameter slot");
        const declaration = parameterDeclaration(walk.generation.deps, body, row);
        const slot = body.locals[row.local]?.checkerSlot;
        if (slot?.kind !== "available" || slot.value !== formal.type)
          return callerDefect(PORT, "an optional formal component requires its actual selected checked parameter type");
        flow(walk, source, argument.type, formal.type, "argument", { kind: "item", value: { owner: formal.declaration, node: declaration.id } });
        continue;
      }
      const declaration = walk.generation.deps.itemOf(formal.declaration);
      if (declaration.kind !== "Parameter" || declaration.type === null || declaration.type.tsonic.type.kind !== "available"
        || declaration.type.tsonic.type.value !== formal.type)
        return notInferredYet(PORT, "the actual selected argument's formal type component", source.origin);
      flow(walk, source, argument.type, formal.type, "argument", { kind: "item", value: { owner: formal.declaration, node: declaration.type.id } });
    }
    walk.typeOf.set(node.id, result);
  } else if (node.kind === "ReturnStatement") {
    const own = walk.returnPart;
    if (node.expression === null) {
      if (own !== undefined) {
        walk.bareReturn ??= node.origin;
        return;
      }
      const result = walk.signature === undefined ? null : readType(walk.generation.deps.types, walk.signature.result);
      if (result?.kind !== "intrinsic" || result.intrinsic !== "void")
        return notInferredYet(PORT, "a bare return without an actual declared void completion", node.origin);
      return;
    }
    walk.returnedOperand = true;
    const target = own === undefined ? present(walk.signature, "the ready external declared signature").result : { part: own };
    if (typeof target === "number") {
      let operand = node.expression;
      while (operand.kind === "ParenthesizedExpression") operand = operand.expression;
      if (operand.kind === "CallExpression" && operand.tsonic.views.read.kind === "available" && operand.tsonic.views.read.value === target) {
        const completion = readType(walk.generation.deps.types, target);
        if (completion.kind === "intrinsic" && completion.intrinsic === "void") return;
      }
    }
    flow(walk, node.expression, typeAt(walk, node.expression), target, "return", own === undefined
      ? returnComponent(walk, target) : { kind: "body", value: refOf(walk, node.expression) });
  }
  return undefined;
}

function objectConstruction(walk: Walk, node: Extract<HirNode, { readonly kind: "ObjectLiteralExpression" }>): void {
  if (node.tsonic.role !== "value") return notInferredYet(PORT, "an object assignment pattern", node.origin);
  const { read, contextual } = node.tsonic.value.views;
  if (read.kind !== "available" || contextual.kind !== "available")
    return notInferredYet(PORT, "the actual object construction's checked result and contextual destination", node.origin);
  const parts: DraftProperty[] = [];
  for (const property of node.properties.nodes) {
    if (property.kind !== "PropertyAssignment" || property.tsonic.key.kind !== "available"
      || property.tsonic.origins.kind !== "available")
      return notInferredYet(PORT, "the actual checked data-property construction part", property.origin);
    const occurrence = refOf(walk, property);
    if (!property.tsonic.origins.value.some(origin => origin.kind === "source-member"
      && origin.occurrence.body === occurrence.body && origin.occurrence.node === occurrence.node))
      return callerDefect(PORT, "an object construction part retains its actual checked source property");
    const type = typeAt(walk, property.initializer);
    parts.push({ kind: "property", occurrence, key: property.tsonic.key.value, type });
    walk.draft.evidence.push({ type, node: property.initializer, component: { kind: "body", value: refOf(walk, property.initializer) } });
  }
  const occurrence = refOf(walk, node);
  const component: SourceNodeRef = { kind: "body", value: occurrence };
  if (contextual.value !== null) walk.draft.evidence.push({ type: contextual.value, node, component });
  walk.draft.evidence.push({ type: read.value, node, component });
  walk.draft.constraints.push({ kind: "construct-literal", occurrence, construction: "object", parts, destination: contextual.value, result: read.value });
  walk.typeOf.set(node.id, read.value);
}

function localType(walk: Walk, node: Extract<HirNode, { readonly kind: "Identifier" }>, readWriteTarget: boolean): Slot | Refusal {
  const name = node.tsonic;
  if (name.role !== "value" && name.role !== "assignment-target") return notInferredYet(PORT, "a local occurrence without its checked value or target role", node.origin);
  const selectedStorage = name.role !== "assignment-target" || name.access !== (readWriteTarget ? "read-write" : "write") ? null
    : readWriteTarget ? readWriteRootStorageOf(name.place, name.resolution) : writableRootStorageOf(name.place, name.resolution);
  if (name.role === "assignment-target" && selectedStorage === null)
    return notInferredYet(PORT, "the actual qualified writable root storage", node.origin);
  const resolution = resolvedValueName(walk.generation.deps, name.resolution);
  if (name.resolution.kind === "binding" && resolution.kind === "unavailable")
    return notInferredYet(PORT, "a binding whose actual nearest target is unavailable (" + resolution.reason + ")", node.origin);
  if (resolution.kind === "intrinsic-value") {
    if (name.role !== "value" || name.value.views.read.kind !== "available")
      return callerDefect(PORT, "an intrinsic value requires its actual checked read type");
    const type = name.value.views.read.value;
    const term = readType(walk.generation.deps.types, type);
    if (term.kind !== "intrinsic" || term.intrinsic !== "absence")
      return callerDefect(PORT, "the resolved intrinsic undefined value must retain its native absence type");
    return type;
  }
  if (resolution.kind === "declarations") {
    const { deps, group } = walk.generation;
    const unit = { query: "solutionOf", key: group.id };
    const declarationWork = admitTypePublicationStep(deps.typeWork, resolution.definitions.length);
    if (declarationWork !== null) return refuseTypeConstruction(deps.typeWork, declarationWork, node.origin, unit);
    const signatures: Signature["id"][] = [];
    for (const definition of resolution.definitions) {
      const item = walk.generation.deps.itemOf(definition);
      if (resolution.definitions.length === 1 && item.kind === "VariableDeclaration") {
        const target = item.tsonic.declaration;
        if (target.kind !== "definition" || target.definition !== definition)
          return callerDefect(PORT, "a static read retains its actual qualified variable declaration");
        if (name.role === "assignment-target" && selectedStorage !== checkedVariableStorageOf(item))
          return callerDefect(PORT, "a static assignment retains the actual checked storage type");
        const type = item.tsonic.declaredType;
        if (type.kind !== "available")
          return notInferredYet(PORT, "a static variable's actual finalized declaration type", node.origin);
        if (type.value === null) {
          const part: InferredSignaturePart = { definition, part: { kind: "variable" } };
          const key = inferredPartKey(part);
          const ready = walk.generation.outsideParts.get(key);
          if (ready !== undefined || walk.generation.ownParts.has(key)) return { part };
          return notInferredYet(PORT, "a static variable's actual finalized declaration type", node.origin);
        }
        return type.value;
      }
      if (name.role === "assignment-target") return callerDefect(PORT, "a static assignment targets an actual variable declaration");
      const endpoints = endpointsOf(item, definition);
      const endpointStop = admitTypePublicationStep(deps.typeWork, endpoints.length);
      if (endpointStop !== null) return refuseTypeConstruction(deps.typeWork, endpointStop, node.origin, unit);
      for (const endpoint of endpoints) {
        if (readSignature(walk.generation.deps.types, endpoint.signature).typeParameters.length !== 0) {
          signatures.push(endpoint.signature);
          continue;
        }
        const request = endpointRequest(walk.generation.deps, endpoint, { kind: "instantiated", bindings: TEMPLATE });
        signatures.push(present(walk.generation.signatures.get(signatureRequestKey(request)), "the actual declared callee signature").id);
      }
    }
    const table = viewTypes(deps.types);
    const result = internTypeGraph({ types: deps.types, work: deps.typeWork }, {
      typeBase: table.terms.length, signatureBase: table.signatures.length,
      terms: [{ kind: "callable", calls: signatures, constructs: [] }], signatures: [],
    });
    if (result.kind !== "complete") return refuseTypeConstruction(deps.typeWork, result, node.origin, unit);
    return present(result.value.types[0], "one admitted callable type");
  }
  if (resolution.kind !== "local")
    return notInferredYet(PORT, "a value read that is not an actual local", node.origin);
  const reference = resolution.local;
  const owner = walk.generation.deps.hirBody(reference.body);
  if (name.role === "assignment-target") {
    const checked = owner.locals[reference.local]?.checkerSlot;
    if (checked?.kind !== "available" || checked.value !== selectedStorage)
      return callerDefect(PORT, "a local assignment retains the actual checked storage type");
  }
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

function localBinding(deps: InferenceInputs, reference: LocalRef): {
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

function parameterDeclaration(deps: InferenceInputs, owner: HirBody, parameter: HirParam): Extract<HirNode, { readonly kind: "Parameter" }> {
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
  if (selected.parameter.role === "optional") {
    const formal = ownReadySignature(state, owner)?.parameters[selected.index];
    if (formal?.kind !== "optional" || formal.declaration !== selected.parameter.declaration
      || formal.initializer !== selected.parameter.initializer)
      return notInferredYet(PORT, "the actual selected optional parameter read type", declaration.origin);
    return formal.type;
  }
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
  walk.draft.constraints.push({ kind: "flow", occurrence: refOf(walk, source), from, to, role, bindings: walk.draft.bindings });
  walk.draft.evidence.push({ type: from, node: source, component: { kind: "body", value: refOf(walk, source) } },
    { type: to, node: source, component: target });
}

function typeAt(walk: Walk, node: HirNode): Slot {
  return present(walk.typeOf.get(node.id), `the type position of node ${node.id}`);
}

function readySlotType(generation: Generation, slot: Slot): TyId | undefined {
  if (typeof slot === "number") return slot;
  const key = inferredPartKey(slot.part);
  return generation.partTypes.get(key) ?? generation.outsideParts.get(key)?.type;
}

function refOf(walk: Walk, node: HirNode): NodeRef { return { body: walk.draft.body.body, node: node.id }; }

function evidenceOf(deps: InferenceInputs, group: InferenceGroup, type: TyId, node: HirNode, component: SourceNodeRef, error: InferenceValue["error"]): InferenceValue {
  const term = readType(deps.types, type);
  if ((term.kind === "error") !== (error !== null))
    return notInferredYet(PORT, "the actual checked error association of a constraint type position", node.origin);
  if (term.kind === "open" || term.kind === "error" || term.kind === "shape" || term.kind === "param")
    return { value: { type, component, category: { kind: "dynamic" }, numeric: null, sum: null, nominal: null, pointer: null }, error };
  if (term.kind === "callable") return { value: { type, component, category: { kind: "known", category: "callable" },
    numeric: null, sum: null, nominal: null, pointer: null }, error: null };
  if (term.kind === "intrinsic" && term.intrinsic === "absence")
    return { value: { type, component, category: { kind: "known", category: "absence" },
      numeric: null, sum: null, nominal: null, pointer: null }, error: null };
  if (term.kind === "optional") {
    const domain = optionalValueDomainOf(term, value => readType(deps.types, value));
    if (domain.kind === "optional-value")
      return { value: { type, component, category: domain.category, numeric: null, sum: null, nominal: null, pointer: null }, error: null };
  }
  if (term.kind === "literal" && term.value.kind === "number") {
    const category: CategoryEvidence = { kind: "known", category: "number" };
    const authored = node.kind === "NumericLiteral" && node.tsonic.role === "value" && node.tsonic.literal.kind === "number"
      ? node.tsonic.literal : null;
    return { value: { type, component, category, numeric: component.kind === "body" && component.value.node === node.id && authored !== null
      ? { producer: component.value, kind: "literal", category, authored } : null,
    sum: null, nominal: null, pointer: null }, error: null };
  }
  if (term.kind === "string" || term.kind === "primitive" && term.primitive === "bool"
    || term.kind === "literal" && (term.value.kind === "boolean" || term.value.kind === "string"))
    return { value: { type, component, category: { kind: "known", category: term.kind === "string"
      || term.kind === "literal" && term.value.kind === "string" ? "string" : "boolean" },
      numeric: null, sum: null, nominal: null, pointer: null }, error: null };
  if (term.kind !== "primitive" || term.primitive !== "float64" && term.primitive !== "int64")
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

function readyCandidates(state: Generation, lists: readonly HirCandidateList[]): readonly InferenceCandidateList[] {
  return lists.map(list => ({ id: list.id, candidates: list.candidates.map(candidate => {
    const unavailable = unavailableCandidate(candidate);
    if (unavailable !== null) return { ...candidate, endpoints: unavailable };
    const endpoint = candidateEndpoint(state.deps, candidate);
    if (candidate.bindings.kind !== "available") return callerDefect(PORT, "a candidate must retain its complete bindings");
    const request = endpointRequest(state.deps, endpoint, { kind: "instantiated", bindings: candidate.bindings.value });
    const signature = present(state.signatures.get(signatureRequestKey(request)), "the actual authoritative candidate signature");
    const endpointSignature = readSignature(state.deps.types, endpoint.signature);
    if ((endpoint.body === null || endpointSignature.typeParameters.length !== 0)
      && (candidate.appliedSignature.kind !== "available" || signature.id !== candidate.appliedSignature.value))
      return callerDefect(PORT, "the authoritative applied signature differs from the checked declared application");
    return { ...candidate, endpoints: { kind: "available", value: { advertised: endpoint, advertisedSignature: signature.id,
      api: endpoint, apiSignature: signature.id } } };
  }) }));
}

function present<Value>(value: Value | undefined, what: string): Value {
  return requirePresent(value, { owner: "infer", query: null, origin: null, message: `${PORT}: ${what} is missing` });
}

function refused(diagnostic: Diagnostic): Output {
  return { kind: "done", value: { kind: "refused", diagnostics: [diagnostic] } };
}

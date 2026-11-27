import type { InvariantFailure, Result } from "../diag/contract.js";
import { requirePresent, throwInvariant } from "../diag/index.js";
import type { BodyId, ItemNodeRef, LocalId, NodeId, NodeRef, Origin, SourceNodeRef, TyId } from "../ids/contract.js";
import { decodeBodyId } from "../ids/index.js";
import type { BinaryExpression, Block, CheckedPhase, Expression, HirBody, HirNode, Identifier, NodeHeader, ParameterDeclaration, Statement, TypeArgumentList, TypeNode, VariableDeclaration, VariableDeclarationList } from "../ir-hir/contract.js";
import { checkedLayoutConstructionOf, checkedLayoutGeometryOperands, checkedLayoutRoleOf, checkedMemberStorageOf, checkedVariableStorageOf, compoundAssignmentOperatorOf, prefixOperatorOf, readWriteRootStorageOf, resolveModuleBinding, shortCircuitOperatorOf, unparenthesizedExpression, walkSyntaxTree, writableRootStorageOf } from "../ir-hir/index.js";
import type { ApplicationDecision, BodyTyping, ConstraintDecision, EmbeddingDecision, FlowRole, IndexDecision, InferredSignaturePart, RuleOutcome } from "../ir-infer/contract.js";
import type { MemberSelection, TargetAccess, TirApplication, TirArgument, TirBody, TirCallArguments, TirLayoutOperand,
  TirLocal, TirResolution, TirSelection, TypedBinary, TypedIndex, TypedMember, TypedOperation, TypedPhase, TypedValue } from "../ir-tir/contract.js";
import type { TirEnumResolution } from "../ir-tir/contract.js";
import type { BodyInstance, LiteralValue } from "../ir-types/contract.js";
import { artifactBindingsKey, optionalValueDomainOf, readType, rigidBindings } from "../ir-types/index.js";
import type { ElaborateDeps, ElaborateInput, ElaborateSelectedCall, ElaborationChild, ElaborationNoResult, ElaborationResult } from "./contract.js";
import { attachFormalDefault, elaborateCatchBinding, elaborateModuleSyntax, elaborateParameter, elaborateVariable, isInlineModuleStatement } from "./module.js";
import { declarationAlias, declarationInterface, declarationModifiers, declarationType } from "./declarations.js";

const failure = (kind: string, what: string, origin: Origin | null): InvariantFailure =>
  ({ owner: "elaborate", query: null, origin, message: `${kind}: ${what}` });

const notElaboratedYet = (what: string, origin: Origin | null): never => throwInvariant(failure("not elaborated yet", what, origin));
const callerDefect = (what: string, origin: Origin | null): never => throwInvariant(failure("caller defect", what, origin));
const compilerDefect = (what: string, origin: Origin | null): never => throwInvariant(failure("compiler defect", what, origin));

function matchesNumericLiteral(node: HirNode | undefined, value: LiteralValue): boolean {
  if (node?.kind !== "NumericLiteral" || node.tsonic.role !== "value" || value.kind !== "number") return false;
  const actual = node.tsonic.literal;
  return actual.kind === "number" && value.token === node.text && actual.token === node.text
    && value.value.numerator === actual.value.numerator && value.value.denominator === actual.value.denominator
    && value.value.negativeZero === actual.value.negativeZero;
}

interface Flow {
  readonly embedding: EmbeddingDecision;
  readonly destination: TyId;
  readonly role: FlowRole;
}

const header = (node: NodeHeader): NodeHeader =>
  ({ id: node.id, origin: node.origin, parent: node.parent, flags: node.flags, loc: node.loc });

export const elaborateSelectedCall: ElaborateSelectedCall = ({ signatureOf }, application, bindings, { provided, argumentAt }, origin) => {
  if (provided > application.parameters.length) return notElaboratedYet("the selected argument and receiver transport of this call", origin);
  const implementation = application.implementationBindings;
  const parametricSelection = bindings.kind === "parametric" && implementation.classBindings.length === 0
    && implementation.methodBindings.length === 0 && implementation.capturedBindings.length === 0
    && implementation.selfBindings.length === 0;
  const activation: BodyInstance | null = application.api.body === null ? null : { body: application.api.body,
    bindings: parametricSelection ? bindings : { kind: "instantiated", bindings: implementation } };
  const formals = provided === application.parameters.length ? null : signatureOf(application.completion.signature).parameters;
  const operands = application.parameters.map((mapping, parameter): TirArgument => {
    if (parameter >= provided) {
      const formal = formals?.[parameter];
      if (mapping.parameter !== parameter || activation === null || formal === undefined || !formal.acceptsOmission)
        return callerDefect("an omitted argument retains its actual selected omission and callee activation", origin);
      if (mapping.kind === "omitted" && formal.kind === "optional" && formal.initializer === null && mapping.type === formal.type)
        return { kind: "omitted", parameter, value: { kind: "absence" } };
      if (mapping.kind !== "default" || formal.kind !== "default" || mapping.initializer !== formal.initializer)
        return callerDefect("an omitted argument retains its actual selected default and callee activation", origin);
      return { kind: "omitted", parameter, value: { kind: "initializer",
        instance: { body: mapping.initializer, bindings: activation.bindings } } };
    }
    const source = argumentAt(parameter);
    if (source === undefined || mapping.kind !== "argument" || mapping.parameter !== parameter || mapping.argument !== parameter
      || mapping.component !== null || mapping.passing !== "by-value")
      return notElaboratedYet("the actual fixed by-value source argument mapping", origin);
    return { kind: "provided", parameter, expression: source };
  });
  return { callee: { decision: application, activation }, receiver: null, arguments: operands };
};

function signaturePartType<State>(deps: ElaborateDeps<State>, body: HirBody, typing: BodyTyping, part: InferredSignaturePart): TyId {
  const origin = body.root.origin;
  if (part.part.kind === "return" || part.part.kind === "yield") {
    if (part.definition !== body.owner)
      return callerDefect("an inferred callable channel belongs to another declaration", origin);
    const declaration = body.root.parent === null ? null
      : deps.nodeOf({ kind: "item", value: { owner: body.owner, node: body.root.parent } });
    if (declaration === null || declaration.kind !== "FunctionDeclaration" && declaration.kind !== "FunctionExpression"
      && declaration.kind !== "ArrowFunction" && declaration.kind !== "MethodDeclaration" && declaration.kind !== "GetAccessor"
      || declaration.body !== body.root || declaration.type !== null)
      return callerDefect("an inferred callable channel has no matching unannotated checked callable execution", origin);
    return part.part.kind === "return" ? typing.completion
      : typing.yielded ?? callerDefect("an inferred yield part has no solved yield channel", origin);
  }
  const root = body.root;
  if (root.kind === "Block" || root.kind === "SourceFile" || root.parent === null)
    return callerDefect("an inferred initializer part requires its actual checked expression execution", origin);
  const declaration = deps.nodeOf({ kind: "item", value: { owner: body.owner, node: root.parent } });
  if (declaration === null || declaration.kind !== "Parameter" && declaration.kind !== "VariableDeclaration" &&
    declaration.kind !== "PropertyDeclaration" && declaration.kind !== "EnumMember"
    || declaration.initializer !== root || declaration.tsonic.initializer !== body.body)
    return callerDefect("an inferred initializer part is not its checked declaration's own expression execution", origin);
  if (part.part.kind === "enum-member-value") {
    if (declaration.kind !== "EnumMember" || part.definition !== body.owner || declaration.tsonic.declaration.kind !== "definition"
      || declaration.tsonic.declaration.definition !== part.definition)
      return callerDefect("an enum value part has no matching checked member and owner", origin);
    return typing.completion;
  }
  if (declaration.kind === "EnumMember") return callerDefect("an enum initializer requires its actual enum value part", origin);
  if (part.part.kind === "parameter-initializer") {
    if (declaration.kind !== "Parameter" || declaration.type !== null || declaration.tsonic.parent !== part.definition)
      return callerDefect("an inferred formal part has no matching checked parameter and callable owner", origin);
    const owner = declaration.parent === null ? null
      : deps.nodeOf({ kind: "item", value: { owner: part.definition, node: declaration.parent } });
    if (owner === null || owner.kind !== "FunctionDeclaration" && owner.kind !== "FunctionExpression" && owner.kind !== "ArrowFunction"
      && owner.kind !== "MethodDeclaration" && owner.kind !== "GetAccessor" && owner.kind !== "Constructor" && owner.kind !== "SetAccessor")
      return callerDefect("an inferred formal part has no actual checked callable parameter inventory", origin);
    const first = owner.parameters.nodes[0];
    const offset = first !== undefined && first.name.kind === "Identifier" && first.name.text === "this" ? 1 : 0;
    const index = part.part.index;
    if (!Number.isSafeInteger(index) || index < 0 || Object.is(index, -0)
      || owner.parameters.nodes[index + offset] !== declaration)
      return callerDefect("an inferred formal part does not name its actual checked formal position", origin);
  } else if (part.definition !== body.owner || declaration.type !== null
    || (part.part.kind === "variable" ? declaration.kind !== "VariableDeclaration" : declaration.kind !== "PropertyDeclaration"))
    return callerDefect("an inferred initializer part has no matching checked declaration kind and owner", origin);
  return typing.completion;
}

export function elaborateBody<State>(deps: ElaborateDeps<State>, input: ElaborateInput): ElaborationResult {
  const { instance, body, typing } = input;
  const cut = deps.cuts.body(body.body);
  if (cut !== null) return { kind: "no-result", instance, causes: [{ kind: "form", cut }], diagnostics: [] };
  const childStates = new Map<BodyId, ElaborationChild>();
  const bindings = artifactBindingsKey(instance.bindings);
  for (const child of input.nestedBodies) {
    const owner = "kind" in child ? child.instance : child;
    if (childStates.has(owner.body) || artifactBindingsKey(owner.bindings) !== bindings)
      return callerDefect("a nested initializer must be its unique completed body or exact no-result under the same actual bindings", body.root.origin);
    childStates.set(owner.body, child);
  }
  if (childStates.size !== body.nestedBodies.length || body.nestedBodies.some(nested => !childStates.has(nested)))
    return callerDefect("the nested execution inputs must retain the actual direct body inventory", body.root.origin);
  const normalize = (refusal: Extract<Result<never>, { readonly kind: "refused" }>): ElaborationNoResult =>
    ({ kind: "no-result", instance, causes: [{ kind: "producer", refusal }], diagnostics: refusal.diagnostics });
  if (typing.kind === "no-result") {
    if (typing.instance.body !== instance.body || artifactBindingsKey(typing.instance.bindings) !== bindings)
      return callerDefect("an unavailable typing result must retain its actual body instance", body.root.origin);
    if (body.root.kind !== "SourceFile") return typing;
    const produced = elaborateModuleSyntax(deps, body.root, childStates, instance, typing);
    if (produced.kind === "ok") return compilerDefect("a blocked module cannot produce a complete source tree", body.root.origin);
    return produced.kind === "refused" ? normalize(produced) : produced;
  }
  const result = elaborateReady(deps, input, typing, childStates);
  return result.kind === "refused" ? normalize(result) : result;
}

function elaborateReady<State>(deps: ElaborateDeps<State>, input: ElaborateInput,
  ready: Extract<ElaborateInput["typing"], { readonly kind: "ready" }>, childStates: ReadonlyMap<BodyId, ElaborationChild>,
): Result<TirBody> | ElaborationNoResult {
  const { instance, body } = input;
  const { constraints, solution, template } = ready;
  const root = body.root;
  const rootOrigin = root.origin;
  if (instance.body !== body.body) callerDefect("the instance names another body than the checked body", rootOrigin);
  const scope = input.scope;
  const scopeUsesBindings = scope.classParameters.length !== 0 || scope.methodParameters.length !== 0
    || scope.capturedParameters.length !== 0 || scope.selfOwners.length !== 0;
  if (instance.bindings.kind === "instantiated") {
    if (scopeUsesBindings) notElaboratedYet("substitution and decision replay over a nonempty qualified binding scope", rootOrigin);
    if (template === null) return callerDefect("a bound instance without its template", rootOrigin);
    const bindings = instance.bindings.bindings;
    if (bindings.classBindings.length !== 0 || bindings.methodBindings.length !== 0 || bindings.capturedBindings.length !== 0 || bindings.selfBindings.length !== 0)
      callerDefect("the selected bindings are not the complete vector of the actual empty scope", rootOrigin);
    if (template.body !== body.body || template.owner !== body.owner || template.bindings.kind !== "parametric")
      callerDefect("the selected instance does not retain its actual parametric body template", rootOrigin);
  }
  if (instance.bindings.kind === "parametric" && template !== null) callerDefect("a template instance given a template", rootOrigin);
  if (constraints.body !== body.body) callerDefect("the constraint system of another body", rootOrigin);
  if (solution.group !== constraints.group) callerDefect("a solution of another group", rootOrigin);
  const typing = solution.bodies.find(candidate => candidate.body === body.body)
    ?? callerDefect("the solution has no body typing for the body", rootOrigin);
  if (typing.captures.length !== body.captures.length || typing.captures.some((row, index) => {
    const captured = body.captures[index];
    return captured === undefined || row.local.body !== captured.body || !Object.is(row.local.local, captured.local);
  })) return callerDefect("the solved capture modes must retain the actual ordered qualified body captures", rootOrigin);
  if (template !== null && (template.signature !== typing.signature || template.completion !== typing.completion ||
    template.yielded !== typing.yielded || template.sent !== typing.sent))
    callerDefect("the selected closed-scope replay does not retain the solved template body channels", rootOrigin);
  const moduleStatements = root.kind === "SourceFile" ? root.statements.nodes : null;
  if (moduleStatements !== null && (input.initializers.length !== 0 || body.params.length !== 0
    || body.captures.length !== 0))
    return callerDefect("a module has no formal inputs or captures", rootOrigin);
  const children = new Map<BodyId, TirBody>();
  for (const [id, child] of childStates) if (!("kind" in child)) children.set(id, child);

  const skipped: NodeId[] = [];
  if (moduleStatements !== null) {
    for (const statement of moduleStatements) if (!isInlineModuleStatement(statement)) skipped.push(statement.id);
    for (const child of children.values()) skipped.push(child.root.id);
  } else {
    for (const child of children.values()) {
      const path = decodeBodyId(child.body);
      if (path.kind === "decoded" && path.value.role === "layout-operand") skipped.push(child.root.id);
    }
  }
  const nodes = walkSyntaxTree(root, skipped);
  const first = root.id;
  const modulePositions = moduleStatements === null && skipped.length === 0 ? null : new Map<NodeId, number>();
  let previous = -1;
  for (const [position, node] of nodes.entries()) {
    if (modulePositions === null) {
      if (node.id !== first + position) callerDefect("the body's node identities are not one preorder range", node.origin);
    } else {
      if (node.id <= previous) return callerDefect(moduleStatements === null
        ? "the body's executing identities must follow source preorder" : "the module's executing identities must follow source preorder", node.origin);
      modulePositions.set(node.id, position);
      previous = node.id;
    }
  }
  const nodePosition = (id: NodeId): number => modulePositions === null ? id - first : modulePositions.get(id) ?? -1;
  const positionOf = (reference: NodeRef): number => {
    if (reference.body !== body.body) callerDefect("an occurrence of another body", rootOrigin);
    const position = nodePosition(reference.node);
    return position >= 0 && position < nodes.length ? position : callerDefect("an occurrence outside the body", rootOrigin);
  };
  const originAt = (position: number): Origin => requirePresent(nodes[position], failure("compiler defect", "a position without a node", rootOrigin)).origin;

  const operations: (TypedOperation | undefined)[] = [];
  const flows: (Flow | undefined)[] = [];
  const variables: ({ readonly kind: "local" | "literal" | "literal-decision"; readonly id: number; readonly type: TyId }
    | { readonly kind: "contextual-literal"; readonly type: TyId; target: number | null } | undefined)[] = [];
  const applications: (RuleOutcome<ApplicationDecision> | undefined)[] = [];
  const members: (Extract<ConstraintDecision, { readonly kind: "member" }> | undefined)[] = [];
  const indexes: (IndexDecision | undefined)[] = [];
  const calleeTypes = new Map<NodeId, TyId>();
  const read = { operations: new Set<number>(), flows: new Set<number>(), variables: new Set<number>(), applications: new Set<number>(),
    members: new Set<number>(), indexes: new Set<number>() };
  const finals: (TyId | undefined)[] = [];
  for (const final of solution.variables) finals[final.variable] = final.value.type;
  const finalType = (type: TyId, origin: Origin): TyId => {
    const term = deps.typeOf(type);
    if (term.kind !== "open") return type;
    if (term.group !== solution.group) return callerDefect("a flow references an inference variable of another group", origin);
    return finals[term.variable] ?? callerDefect("a flow references an unfinalized inference variable", origin);
  };
  for (const solved of solution.constraints) {
    if (solved.constraint.body !== body.body) continue;
    const constraint = constraints.constraints[solved.constraint.index]
      ?? callerDefect("a solved constraint names no constraint of the body", rootOrigin);
    const position = positionOf(constraint.occurrence);
    const origin = originAt(position);
    const decision = solved.decision;
    if (constraint.kind === "op") {
      if (operations[position] !== undefined) callerDefect("two operator decisions at one occurrence", origin);
      if (decision.kind === "deferred") notElaboratedYet("a retained (deferred) operator decision", origin);
      if (decision.kind !== "op") return callerDefect(`an operator constraint solved by a decision of kind ${decision.kind}`, origin);
      const node = nodes[position];
      if (node?.kind === "PrefixUnaryExpression" && prefixOperatorOf(node.operator) !== constraint.operator)
        return callerDefect("the unary operator constraint must retain its authored operator", origin);
      if (node?.kind === "VoidExpression" && constraint.operator !== "void")
        return callerDefect("the void operator constraint must retain its authored operator", origin);
      if (node?.kind === "CaseClause" && constraint.operator !== "===")
        return callerDefect("a case comparison must retain strict equality", origin);
      if (node?.kind === "BinaryExpression") {
        const authored = compoundAssignmentOperatorOf(node.operatorToken.kind);
        if (authored !== null && constraint.operator !== authored)
          return callerDefect("the compound assignment must retain its authored operator", origin);
      }
      if (decision.operation.operation.kind === "native-operator" && decision.operation.operation.operator !== constraint.operator)
        return callerDefect("the native operator decision must retain its selected operator", origin);
      const scope = constraint.permissionScope;
      if (scope !== null) positionOf(scope);
      operations[position] = { decision: decision.operation, permissionScope: scope === null ? null : scope.node };
    } else if (constraint.kind === "flow") {
      if (flows[position] !== undefined) callerDefect("two flow decisions at one occurrence", origin);
      if (decision.kind === "deferred") notElaboratedYet("a deferred conversion", origin);
      if (decision.kind !== "flow") return callerDefect(`a flow constraint solved by a decision of kind ${decision.kind}`, origin);
      flows[position] = { embedding: decision.embedding, destination: finalType(constraint.to, origin), role: constraint.role };
    } else if (constraint.kind === "member") {
      if (constraint.access === "call" || decision.kind !== "member" || members[position] !== undefined)
        return callerDefect("a member access retains its one actual selected member decision", origin);
      const result = decision.refinement === null
        ? constraint.access === "write" ? decision.member.write : decision.member.read
        : decision.refinement.result;
      if (decision.refinement !== null && (constraint.access !== "read" || decision.refinement.source !== decision.member.read))
        return callerDefect("a refined field value must retain its selected read storage", origin);
      if (result === null || result !== finalType(constraint.result, origin))
        return callerDefect("a selected member access retains its actual finalized result type", origin);
      members[position] = decision;
    } else if (constraint.kind === "index") {
      if (decision.kind !== "index" || indexes[position] !== undefined || nodes[position]?.kind !== "ElementAccessExpression")
        return callerDefect("an index must retain its one actual selected operand decision", origin);
      const result = finalType(constraint.result, origin);
      const selected = decision.index;
      if (selected.receiver !== finalType(constraint.receiver, origin) || selected.key !== finalType(constraint.key, origin)
        || selected.read !== (constraint.access === "write" ? null : result)
        || selected.write !== (constraint.access === "read" ? null : result))
        return callerDefect("an index must retain its finalized receiver, key and reached types", origin);
      indexes[position] = selected;
    } else if (constraint.kind === "call") {
      if (applications[position] !== undefined)
        return callerDefect("a call must retain its one selected application decision", origin);
      const node = nodes[position];
      if (node?.kind !== "CallExpression") return callerDefect("a call decision must name its actual call syntax", origin);
      if (decision.kind === "call" && decision.operation === null) applications[position] = { kind: "decided", decision: decision.application };
      else if (decision.kind === "deferred" && decision.deferred.invocation.rule === "candidate"
        && decision.deferred.invocation.input.kind === "call") applications[position] = decision;
      else return callerDefect("a call must retain its actual selected or binding-dependent candidate", origin);
      calleeTypes.set(node.expression.id, finalType(constraint.application.callee, origin));
    } else if (constraint.kind === "default") {
      if (constraint.rule === "signature-producers") {
        if (position !== 0 || root.kind !== "Block" || decision.kind !== "default"
          || decision.type !== constraint.type || decision.type !== finals[constraint.variable] || decision.type !== typing.completion)
          return callerDefect("a no-value default must retain the actual checked body completion", origin);
        continue;
      }
      if (constraint.rule !== "literal-native-default" || decision.kind !== "default" || constraint.type !== null
        || decision.type !== finals[constraint.variable] || nodes[position]?.kind !== "NumericLiteral" || variables[position] !== undefined)
        return callerDefect("a literal default must retain the selected type of its actual solved occurrence", origin);
      variables[position] = { kind: "literal-decision", id: constraint.variable, type: decision.type };
    } else if (constraint.kind === "literal") {
      if (decision.kind !== "literal" || variables[position] !== undefined || !matchesNumericLiteral(nodes[position], constraint.value))
        return callerDefect("a contextual literal requires its one actual decision and exact authored payload", origin);
      if (decision.embedding.kind !== "identity")
        return notElaboratedYet("an authored literal that does not fit its selected native destination", origin);
      variables[position] = { kind: "contextual-literal", type: finalType(constraint.destination, origin), target: null };
    } else {
      notElaboratedYet(`a solved ${constraint.kind} constraint`, origin);
    }
  }
  for (const variable of constraints.variables) {
    const position = positionOf(variable.occurrence);
    const origin = originAt(position);
    if (variable.kind === "signature") {
      if (position !== 0) return callerDefect("an inferred signature part is not at its actual execution root", origin);
      const expected = signaturePartType(deps, body, typing, variable.signature);
      if (finals[variable.id] === undefined || finals[variable.id] !== expected)
        return callerDefect("an inferred signature part and its solved body channel disagree", origin);
      continue;
    }
    if (variable.kind === "literal") {
      const node = nodes[position];
      const selected = variables[position];
      if (selected?.kind !== "literal-decision" || selected.id !== variable.id || !matchesNumericLiteral(node, variable.value))
        return callerDefect("a native literal decision requires the actual variable, exact payload and syntax", origin);
      variables[position] = { ...selected, kind: "literal" };
      continue;
    }
    if (variable.kind !== "local" || variable.local !== null) notElaboratedYet(`an inference variable of kind ${variable.kind}`, origin);
    if (variables[position] !== undefined) return callerDefect("two inferred values at the same occurrence", origin);
    variables[position] = { kind: "local", id: variable.id,
      type: finals[variable.id] ?? compilerDefect(`open position: variable ${variable.id} has no final value`, origin) };
  }

  const signature = deps.signatureOf(typing.signature);
  if (signature.typeParameters.length !== 0 && (instance.bindings.kind !== "parametric"
    || signature.typeParameters.length !== scope.methodParameters.length
    || signature.typeParameters.some((parameter, ordinal) => parameter.declaration !== scope.methodParameters[ordinal])))
    callerDefect("the signature must retain the actual ordered callable binders", rootOrigin);
  if (signature.parameters.length !== body.params.length) callerDefect("the signature and the body differ in their parameter count", rootOrigin);
  const storageOf: (TyId | undefined)[] = [];
  const params: ParameterDeclaration<TypedPhase>[] = [];
  const expectedInitializers = new Set<BodyId>();
  for (const parameter of body.params) if (parameter.initializer !== null) expectedInitializers.add(parameter.initializer);
  const initializers = new Map<BodyId, Exclude<ElaborationChild, ElaborationNoResult>>();
  const bindingsKey = artifactBindingsKey(instance.bindings);
  for (const child of input.initializers) {
    const initializer = "kind" in child ? child.instance : child;
    if (!expectedInitializers.has(initializer.body) || initializers.has(initializer.body)
      || artifactBindingsKey(initializer.bindings) !== bindingsKey)
      return callerDefect("a formal initializer must be its unique completed body under the same actual bindings", rootOrigin);
    if ("kind" in child && child.kind === "no-result") return { ...child, instance, diagnostics: [] };
    initializers.set(initializer.body, child);
  }
  if (initializers.size !== expectedInitializers.size)
    return callerDefect("the formal initializer inputs must be exactly the actual selected parameter initializers", rootOrigin);
  for (const [position, row] of body.params.entries()) {
    if (row.role !== "required" && row.role !== "optional" && row.role !== "default") notElaboratedYet(`a parameter of role ${row.role}`, rootOrigin);
    const parameter = requirePresent(signature.parameters[position], failure("compiler defect", "a parameter position past the count", rootOrigin));
    if (parameter.kind !== row.role || parameter.initializer !== row.initializer)
      callerDefect("the selected parameter and its signature disagree on kind or initializer body", rootOrigin);
    storageOf[row.local] = parameter.type;
    const local = body.locals[row.local];
    const header = local === undefined ? null : deps.nodeOf(local.declaration);
    if (header?.kind !== "Parameter" || header.id !== local?.declaration.value.node
      || local.declaration.kind !== "item" || local.declaration.value.owner !== row.declaration
      || header.tsonic.parent !== body.owner || parameter.declaration !== row.declaration)
      return callerDefect("the parameter header is not its actual checked item and owning callable occurrence", rootOrigin);
    const initializer = row.initializer === null ? null : initializers.get(row.initializer)
      ?? callerDefect("the actual formal initializer body is missing", header.origin);
    if (initializer !== null && "kind" in initializer && (initializer.body.root !== header.initializer
      || initializer.body.owner !== row.declaration || header.initializer === null))
      return callerDefect("an unopened default requires its actual checked initializer and formal owner", header.origin);
    const authored = header.initializer;
    const slot: ParameterDeclaration<TypedPhase>["initializer"] = initializer === null ? { kind: "none" }
      : { kind: "checked-default", root: authored ?? callerDefect("an unopened default has no checked root", header.origin) };
    const selected = elaborateParameter(deps, header, body.body, { local: { body: body.body, local: row.local }, declaration: row.declaration,
      role: row.role, passing: row.passing, initializer: row.initializer, storage: parameter.type }, slot);
    if (selected.kind === "refused") return selected;
    if (initializer !== null && slot.kind === "checked-default") {
      const formal = selected.value;
      const attach = (ready: TirBody) => attachFormalDefault(deps, formal, slot, ready);
      const stopped = "kind" in initializer ? initializer.onRequired(attach) : attach(initializer);
      if (stopped.kind === "refused") return stopped;
    }
    params.push(selected.value);
  }
  const variablesByNode = new Map<NodeId, VariableDeclaration<TypedPhase>>();
  const captureLocals = new Map<BodyId, Map<LocalId, LocalId | null>>();
  for (const row of typing.captures) {
    let rows = captureLocals.get(row.local.body);
    if (rows === undefined) { rows = new Map(); captureLocals.set(row.local.body, rows); }
    if (rows.has(row.local.local)) return callerDefect("a body cannot repeat a qualified capture", rootOrigin);
    rows.set(row.local.local, null);
  }
  for (const local of body.locals) if (local.role === "capture") {
    const captured = local.capturedFrom;
    const rows = captured === null ? undefined : captureLocals.get(captured.body);
    if (captured === null || rows === undefined || !rows.has(captured.local))
      return callerDefect("an actual capture slot must name a retained qualified capture", rootOrigin);
    if (rows.get(captured.local) !== null) return callerDefect("a body cannot duplicate its actual captured local slot", rootOrigin);
    rows.set(captured.local, local.id);
  }
  for (const rows of captureLocals.values()) for (const slot of rows.values())
    if (slot === null) return callerDefect("a retained capture requires its actual local slot", rootOrigin);
  const readEvidence = new Set<NodeId>();
  for (const evidence of constraints.evidence) {
    const component = evidence.value.component;
    if (component.kind !== "body" || component.value.body !== body.body || readEvidence.has(component.value.node)) continue;
    readEvidence.add(component.value.node);
    const node = nodes[positionOf(component.value)];
    if (node?.kind !== "Identifier" || node.tsonic.role !== "value" && node.tsonic.role !== "assignment-target"
      || node.tsonic.resolution.kind !== "local") continue;
    const reference = node.tsonic.resolution.local;
    const slot = captureLocals.get(reference.body)?.get(reference.local);
    if (slot === undefined || slot === null) continue;
    const storage = finalType(evidence.value.type, node.origin);
    if (storageOf[slot] !== undefined && storageOf[slot] !== storage)
      return callerDefect("the actual captured local reads disagree on their finalized storage type", node.origin);
    storageOf[slot] = storage;
  }
  for (const local of body.locals) {
    if (local.role === "parameter" || local.role === "capture") continue;
    if (local.declaration.kind === "item" && deps.cuts.declaration(local.declaration.value.owner) !== null) continue;
    const declaration = deps.nodeOf(local.declaration);
    if (local.role !== "binding" && local.role !== "catch" || local.declaration.kind !== "item" || declaration?.kind !== "VariableDeclaration"
      || declaration.id !== local.declaration.value.node || declaration.tsonic.declaration.kind !== "local"
      || declaration.tsonic.declaration.local.body !== body.body || !Object.is(declaration.tsonic.declaration.local.local, local.id))
      return notElaboratedYet("the actual checked declaration of a non-parameter local", rootOrigin);
    const parent = local.role === "catch" && declaration.parent !== null ? nodes[nodePosition(declaration.parent)] : undefined;
    if (local.role === "catch" && (parent?.kind !== "CatchClause" || parent.variableDeclaration !== declaration))
      return callerDefect("a typed handler binding must retain its actual checked declaration", declaration.origin);
    const selected = local.role === "catch" ? elaborateCatchBinding(deps, declaration, local)
      : elaborateVariable(deps, declaration, children, local.declaration.value.owner);
    if (selected.kind === "refused") return selected;
    storageOf[local.id] = selected.value.tsonic.storage;
    variablesByNode.set(declaration.id, selected.value);
  }
  const locals: TirLocal[] = [];
  for (const local of body.locals) {
    if (local.declaration.kind === "item" && deps.cuts.declaration(local.declaration.value.owner) !== null) continue;
    locals.push({ id: local.id, declaration: local.declaration, name: local.name, role: local.role,
      capturedFrom: local.capturedFrom, mutable: local.mutable,
      storage: storageOf[local.id] ?? notElaboratedYet(`the local ${local.name}, which no parameter names`, rootOrigin) });
  }

  const statements: (Statement<TypedPhase> | undefined)[] = [];
  const expressions: (Expression<TypedPhase> | undefined)[] = [];
  const values: (TypedValue | undefined)[] = [];
  const demands: (TypedValue["demand"] | undefined)[] = [];
  const built = (node: HirNode): string => `a ${node.kind} read before it was typed`;
  const statementOf = (node: HirNode): Statement<TypedPhase> => requirePresent(statements[nodePosition(node.id)], failure("compiler defect", built(node), node.origin));
  const expressionOf = (node: HirNode): Expression<TypedPhase> => requirePresent(expressions[nodePosition(node.id)], failure("compiler defect", built(node), node.origin));

  const valueOf = (position: number, type: TyId, origin: Origin, narrowing: TypedValue["narrowing"] = null): TypedValue => {
    const variable = variables[position]?.type;
    read.variables.add(position);
    if (variable !== undefined && variable !== type) callerDefect("the variable at the occurrence and its decision disagree on its type", origin);
    const flow = flows[position];
    read.flows.add(position);
    let conversion: TypedValue["conversion"] = { kind: "identity" };
    let convertedType = type;
    if (flow !== undefined) {
      if (flow.embedding.kind === "identity") {
        if (flow.destination !== type) callerDefect("an identity flow whose destination is not the value's type", origin);
      } else if (flow.embedding.kind === "conversion" && flow.embedding.check.kind === "none"
        && (flow.embedding.conversion === "literal-fit"
          || (flow.embedding.conversion === "absence" || flow.embedding.conversion === "union-injection")
            && optionalValueDomainOf(readType(deps.types, flow.destination), value => readType(deps.types, value)).kind === "optional-value")) {
        convertedType = flow.destination;
        conversion = { kind: "convert", role: flow.role, operation: { permissionScope: null, decision: {
          kind: "selected", operation: { kind: "conversion", from: type, to: convertedType, embedding: flow.embedding },
          operands: [type], result: convertedType, execution: { kind: "pure" },
        } } };
      } else notElaboratedYet(`a conversion of kind ${flow.embedding.kind}`, origin);
    }
    const value: TypedValue = { type, convertedType, conversion, narrowing, evidenceIndex: null, demand: demands[position] ?? { kind: "always" } };
    values[position] = value;
    return value;
  };

  const block = (node: Block<CheckedPhase>): Block<TypedPhase> => ({ ...header(node), kind: "Block", multiLine: node.multiLine, tsonic: null,
    statements: { loc: node.statements.loc, nodes: node.statements.nodes.map(statementOf) } });
  const blockOf = (node: Block<CheckedPhase>): Block<TypedPhase> => {
    const result = statementOf(node);
    return result.kind === "Block" ? result : callerDefect("a protected block must retain its actual typed block", node.origin);
  };

  const binaryRoles: (TypedBinary["role"] | undefined)[] = [];
  type ShortCircuitOperator = NonNullable<ReturnType<typeof shortCircuitOperatorOf>>;
  const demandArm = (control: NodeId, arm: Expression<CheckedPhase>, when: "true" | "false" | "absent"): void => {
    demands[nodePosition(arm.id)] = { kind: "selected", control, when };
  };
  const demandRight = (node: BinaryExpression<CheckedPhase>, logical: ShortCircuitOperator): void => {
    demandArm(node.left.id, node.right, logical === "and" ? "true" : logical === "or" ? "false" : "absent");
  };
  const names: ({ readonly resolution: TirResolution; readonly storage: TyId; readonly role: "value" | "assignment-target" } | undefined)[] = [];
  const visited = (node: HirNode): InvariantFailure => failure("compiler defect", `a ${node.kind} built without its visit`, node.origin);

  const enumConstant = (node: HirNode, declaration: ItemNodeRef, aliases: readonly SourceNodeRef[]):
    { readonly resolution: TirEnumResolution; readonly storage: TyId } => {
    const item = deps.itemOf(declaration.owner);
    const parent = item.kind !== "EnumMember" || item.tsonic.parent === null ? null : deps.itemOf(item.tsonic.parent);
    if (item.kind !== "EnumMember" || parent?.kind !== "EnumDeclaration" || item.id !== declaration.node
      || item.tsonic.declaration.kind !== "definition" || item.tsonic.declaration.definition !== declaration.owner)
      return callerDefect("an enum constant read requires its actual closed member", node.origin);
    const storage = deps.enumValueTypeOf(item);
    if (storage === null)
      return callerDefect("an enum constant read requires the completed value type of its actual member", node.origin);
    return { storage, resolution: { kind: "enum-member", declaration,
      bindings: { kind: "instantiated", bindings: { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] } }, aliases } };
  };

  const admitName = (node: Identifier<CheckedPhase>, position: number): void => {
    const checked = node.tsonic;
    if (checked.role !== "value" && checked.role !== "assignment-target") return notElaboratedYet(`a name of role ${checked.role}`, node.origin);
    const alias = input.layoutAlias;
    if (alias !== null && alias.read.body === body.body && alias.read.node === node.id) {
      if (checked.role !== "value" || checked.value.views.read.kind !== "available")
        return callerDefect("a descriptor alias must retain its actual checked read type", node.origin);
      names[position] = { resolution: { kind: "layout-descriptor", descriptor: alias.descriptor },
        storage: checked.value.views.read.value, role: "value" };
      return;
    }
    const binding = checked.resolution.kind === "binding" ? resolveModuleBinding(deps, checked.resolution.occurrence) : null;
    const resolution = binding === null ? checked.resolution : binding.target.kind === "available" ? binding.target.value
      : notElaboratedYet("a binding whose actual nearest target is unavailable (" + binding.target.reason + ")", node.origin);
    if (resolution.kind === "intrinsic-value") {
      if (checked.role !== "value" || checked.value.views.read.kind !== "available")
        return callerDefect("an intrinsic value requires its actual checked read type", node.origin);
      names[position] = { resolution, storage: checked.value.views.read.value, role: checked.role };
      return;
    }
    if (resolution.kind === "declarations") {
      const definition = resolution.definitions[0];
      if (resolution.definitions.length !== 1 || definition === undefined)
        return notElaboratedYet("the selected declaration-value type and alias relation", node.origin);
      const aliases = binding?.aliases ?? [];
      const callee = calleeTypes.get(node.id);
      if (callee !== undefined && checked.role === "value") {
        names[position] = { resolution: { kind: "definition", definition, aliases }, storage: callee, role: checked.role };
        return;
      }
      const item = deps.itemOf(definition);
      if (item.kind === "EnumMember" && checked.role === "value") {
        names[position] = { ...enumConstant(node, { owner: definition, node: item.id }, aliases), role: checked.role };
        return;
      }
      if (item.kind !== "VariableDeclaration" || item.tsonic.declaration.kind !== "definition"
        || item.tsonic.declaration.definition !== definition)
        return notElaboratedYet("the selected declaration-value type and alias relation", node.origin);
      const declaration = { owner: definition, node: item.id };
      const storage = deps.staticStorageOf(declaration);
      if (storage === null) return notElaboratedYet("the actual completed static declaration storage type", node.origin);
      if (checked.role === "assignment-target") {
        const checkedStorage = checkedVariableStorageOf(item);
        const selected = checked.access === "read-write" ? readWriteRootStorageOf(checked.place, checked.resolution)
          : writableRootStorageOf(checked.place, checked.resolution);
        if (checkedStorage === null || selected !== checkedStorage)
          return callerDefect("a static assignment target retains its actual qualified writable storage type", node.origin);
      }
      names[position] = { resolution: { kind: "static", declaration, aliases }, storage, role: checked.role };
      return;
    }
    if (resolution.kind !== "local") return notElaboratedYet(`a name resolving to a ${resolution.kind}`, node.origin);
    const slot = resolution.local.body === body.body ? resolution.local.local
      : captureLocals.get(resolution.local.body)?.get(resolution.local.local);
    const storage = slot === undefined || slot === null ? undefined : storageOf[slot];
    if (storage === undefined) return callerDefect("a name resolving to no actual owned or captured local storage", node.origin);
    if (checked.role === "assignment-target") {
      const checkedSlot = slot === undefined || slot === null ? undefined : body.locals[slot]?.checkerSlot;
      const selected = checked.access === "write" ? writableRootStorageOf(checked.place, checked.resolution)
        : readWriteRootStorageOf(checked.place, checked.resolution);
      if (checkedSlot?.kind !== "available" || selected !== checkedSlot.value)
        return callerDefect("an assignment target retains its actual qualified writable storage type", node.origin);
    }
    names[position] = { resolution: { kind: "local", local: resolution.local }, storage, role: checked.role };
  };
  const admitBinary = (node: BinaryExpression<CheckedPhase>, position: number): void => {
    if (node.modifiers !== null || node.type !== null) notElaboratedYet("a binary expression with modifiers or a type", node.origin);
    const role = node.tsonic.role;
    if (role !== "arithmetic" && role !== "comparison" && role !== "assignment" && role !== "short-circuit" && role !== "sequence")
      return notElaboratedYet(`a binary expression of role ${role}`, node.origin);
    if (role === "short-circuit") {
      const logical = shortCircuitOperatorOf(node.operatorToken.kind, role);
      if (logical === null) return callerDefect("a short-circuit expression without its authored operator", node.origin);
      demandRight(node, logical);
    } else if (role === "assignment") {
      const logical = shortCircuitOperatorOf(node.operatorToken.kind, "assignment");
      const reads = logical !== null || compoundAssignmentOperatorOf(node.operatorToken.kind) !== null;
      const leaf = unparenthesizedExpression<CheckedPhase>(node.left);
      const name = leaf.kind === "Identifier" ? leaf.tsonic : null;
      const storageOf = reads ? readWriteRootStorageOf : writableRootStorageOf;
      let selected = name?.role === "assignment-target" && name.access === (reads ? "read-write" : "write")
        && (logical === null || name.resolution.kind === "local") ? storageOf(node.tsonic.target, name.resolution) : null;
      if ((leaf.kind === "PropertyAccessExpression" || leaf.kind === "ElementAccessExpression")
        && leaf.tsonic.role === "assignment-target") {
        const member = checkedMemberStorageOf(leaf);
        if (leaf.tsonic.place === node.tsonic.target && leaf.tsonic.access === (reads ? "read-write" : "write")
          && member !== null && (!reads || member.read === member.write)) selected = member.write;
      } else if (selected !== null && (name?.role !== "assignment-target" || storageOf(name.place, name.resolution) !== selected)) selected = null;
      if (node.operatorToken.kind !== "EqualsToken" && !reads || selected === null)
        return notElaboratedYet(reads ? "an assignment without its checked read-write root target" : "a plain assignment without its checked writable root target", node.origin);
      if (logical !== null) demandRight(node, logical);
      const literal = unparenthesizedExpression<CheckedPhase>(node.right);
      if (literal.kind === "NumericLiteral") {
        const decision = variables[nodePosition(literal.id)];
        if (decision?.kind === "contextual-literal" && decision.target === null) {
          decision.target = nodePosition(leaf.id);
        } else {
          const ordinary = flows[nodePosition(node.right.id)];
          if (decision !== undefined || reads || ordinary?.role !== "assignment"
            || ordinary.embedding.kind !== "conversion"
            || (ordinary.embedding.conversion !== "literal-fit"
              && (ordinary.embedding.conversion !== "union-injection" || ordinary.destination !== selected)))
            return callerDefect("a numeric assignment requires its actual contextual literal or exact embedding decision", literal.origin);
        }
      }
    }
    binaryRoles[position] = role;
  };

  const identifier = (node: Identifier<CheckedPhase>, position: number): Identifier<TypedPhase> => {
    const name = requirePresent(names[position], visited(node));
    if (name.role === "assignment-target") {
      const access: TargetAccess = node.tsonic.role === "assignment-target" && node.tsonic.access === "read-write"
        ? { kind: "read-write", storage: name.storage, read: name.storage, narrowing: null, evidenceIndex: null }
        : { kind: "write", storage: name.storage };
      return { ...header(node), kind: "Identifier", text: node.text,
        tsonic: { role: "assignment-target", resolution: name.resolution, access } };
    }
    return { ...header(node), kind: "Identifier", text: node.text,
      tsonic: { role: "value", resolution: name.resolution, ...valueOf(position, name.storage, node.origin) } };
  };

  const shortCircuitOf = (node: BinaryExpression<CheckedPhase>, logical: ShortCircuitOperator, result: TyId,
    read: TyId | undefined, right: TypedValue | undefined): TirSelection => {
    const type = readType(deps.types, result);
    const checked = node.tsonic.value.views.read;
    const domain = logical === "coalesce" ? optionalValueDomainOf(type, value => readType(deps.types, value)) : null;
    const guard = node.tsonic.role === "short-circuit" && logical !== "coalesce" && read !== undefined
      ? read === result ? type : readType(deps.types, read) : null;
    const takesRight = guard?.kind === "literal" && guard.value.kind === "boolean"
      ? guard.value.value === (logical === "and") : null;
    const supported = takesRight !== null
      ? (type.kind === "primitive" && type.primitive === "bool" || type.kind === "literal" && type.value.kind === "boolean")
        && (takesRight ? right?.convertedType === result : read === result)
      : read === result && right?.convertedType === result && (logical === "coalesce"
        ? domain?.kind === "optional-value" && right.type === result
          && checked.kind === "available" && checked.value === result
        : type.kind === "primitive" && type.primitive === "bool");
    if (!supported)
      return notElaboratedYet("a logical selection without its selected read and same-carrier result", node.origin);
    return { kind: logical, control: node.left.id, right: node.right.id, disposition: "dynamic" };
  };

  const binary = (node: BinaryExpression<CheckedPhase>, position: number): BinaryExpression<TypedPhase> => {
    const role = requirePresent(binaryRoles[position], visited(node));
    if (role === "sequence") {
      if (node.operatorToken.kind !== "CommaToken") return callerDefect("a sequence without its authored comma", node.origin);
      const right = requirePresent(values[nodePosition(node.right.id)], visited(node.right));
      return { ...header(node), kind: "BinaryExpression", modifiers: null, type: null,
        left: expressionOf(node.left), operatorToken: { ...header(node.operatorToken), kind: node.operatorToken.kind, tsonic: null },
        right: expressionOf(node.right), tsonic: { role, ...valueOf(position, right.convertedType, node.origin) } };
    }
    if (role === "short-circuit") {
      const logical = shortCircuitOperatorOf(node.operatorToken.kind, role);
      const result = node.tsonic.value.views.read;
      if (logical === null || result.kind !== "available")
        return callerDefect("a short-circuit expression without its actual checked operator and result", node.origin);
      const selection = shortCircuitOf(node, logical, result.value, values[nodePosition(node.left.id)]?.convertedType, values[nodePosition(node.right.id)]);
      return { ...header(node), kind: "BinaryExpression", modifiers: null, type: null, left: expressionOf(node.left),
        operatorToken: { ...header(node.operatorToken), kind: node.operatorToken.kind, tsonic: null }, right: expressionOf(node.right),
        tsonic: { role, selection, ...valueOf(position, result.value, node.origin) } };
    }
    if (role === "assignment") {
      const left = expressionOf(node.left);
      const target = unparenthesizedExpression<TypedPhase>(left);
      const right = expressionOf(node.right);
      const compound = compoundAssignmentOperatorOf(node.operatorToken.kind) !== null;
      const logical = shortCircuitOperatorOf(node.operatorToken.kind, "assignment");
      if ((target.kind !== "Identifier" && target.kind !== "PropertyAccessExpression" && target.kind !== "ElementAccessExpression")
        || target.tsonic.role !== "assignment-target"
        || target.tsonic.access.kind !== (compound || logical !== null ? "read-write" : "write"))
        return callerDefect("an assignment retains its actual typed storage access", node.origin);
      const access = target.tsonic.access;
      const storage = access.storage;
      let calculation: RuleOutcome<TypedOperation> | null = null;
      let selection: TirSelection | null = null;
      const endpoint = values[nodePosition(node.right.id)];
      if (compound) {
        const operation = operations[position] ?? compilerDefect("open position: no compound assignment decision", node.origin);
        const operands = operation.decision.operands;
        if (access.kind !== "read-write" || operands.length !== 2 || operands[0] !== access.read
          || endpoint === undefined || operands[1] !== endpoint.convertedType || operation.decision.result !== storage)
          return notElaboratedYet("a compound assignment without its selected read, operand and same-storage result", node.origin);
        read.operations.add(position);
        calculation = { kind: "decided", decision: operation };
      } else if (logical !== null) {
        selection = shortCircuitOf(node, logical, storage, access.kind === "read-write" ? access.read : undefined, endpoint);
      }
      return { ...header(node), kind: "BinaryExpression", modifiers: null, type: null, left,
        operatorToken: { ...header(node.operatorToken), kind: node.operatorToken.kind, tsonic: null }, right,
        tsonic: { role, storage, calculation, selection, ...valueOf(position, storage, node.origin) } };
    }
    const operation = operations[position] ?? compilerDefect("open position: no operator decision at the binary expression", node.origin);
    read.operations.add(position);
    const token = node.operatorToken;
    return { ...header(node), kind: "BinaryExpression", modifiers: null, type: null,
      left: expressionOf(node.left), operatorToken: { ...header(token), kind: token.kind, tsonic: null }, right: expressionOf(node.right),
      tsonic: { role, operation: { kind: "decided", decision: operation }, ...valueOf(position, operation.decision.result, node.origin) } };
  };

  interface Frame { readonly phase: "visit" | "build"; readonly node: HirNode; readonly loop: NodeId | null;
    readonly breakTarget: NodeId | null; readonly parent: NodeId | null }
  const labelOf = (node: Identifier<CheckedPhase>):
    Identifier<TypedPhase> & { readonly tsonic: Extract<Identifier<TypedPhase>["tsonic"], { readonly role: "label" }> } => {
    const checked = node.tsonic;
    if (checked.role !== "label" || checked.target === null || checked.target.body !== body.body)
      return notElaboratedYet("a label without its actual enclosing checked control target", node.origin);
    return { ...header(node), kind: node.kind, text: node.text, tsonic: { role: "label", target: checked.target } };
  };
  const variableList = (list: VariableDeclarationList<CheckedPhase>): Result<VariableDeclarationList<TypedPhase>> => {
    const nodes: VariableDeclaration<TypedPhase>[] = [];
    for (const declaration of list.declarations.nodes) {
      const target = declaration.tsonic.declaration;
      if (target.kind === "definition" && moduleStatements !== null) {
        const selected = elaborateVariable(deps, declaration, children, target.definition);
        if (selected.kind === "refused") return selected;
        nodes.push(selected.value);
      } else nodes.push(requirePresent(variablesByNode.get(declaration.id),
        failure("compiler defect", "a variable has no actual selected local binding", declaration.origin)));
    }
    return { kind: "ok", diagnostics: [], value: { ...header(list), kind: list.kind, tsonic: { role: "ordinary" },
      declarations: { loc: list.declarations.loc, nodes } } };
  };
  const stack: Frame[] = [];
  const blocked = new Map<NodeId, ElaborationNoResult>();
  let enclosingLoop: NodeId | null = null;
  let enclosingBreak: NodeId | null = null;
  let visiting: NodeId | null = null;
  const visit = (node: HirNode, loop = enclosingLoop, breakTarget = enclosingBreak): void => {
    stack.push({ phase: "visit", node, loop, breakTarget, parent: visiting });
  };
  const visitList = (list: readonly HirNode[], origin: Origin, breakTarget = enclosingBreak): void => {
    for (let index = list.length - 1; index >= 0; index -= 1)
      visit(requirePresent(list[index], failure("compiler defect", "a child index past its list", origin)), enclosingLoop, breakTarget);
  };
  const step = (frame: Frame): Extract<Result<never>, { readonly kind: "refused" }> | void => {
    enclosingLoop = frame.loop;
    enclosingBreak = frame.breakTarget;
    const node = frame.node;
    visiting = node.id;
    const cut = deps.cuts.syntax(node);
    const unavailable: ElaborationNoResult | undefined = cut === null ? blocked.get(node.id)
      : { kind: "no-result", instance, diagnostics: [], causes: [{ kind: "form", cut }] };
    if (unavailable !== undefined) {
      blocked.set(node.id, unavailable);
      if (frame.parent !== null && !blocked.has(frame.parent)) blocked.set(frame.parent, unavailable);
      return;
    }
    const position = nodePosition(node.id);
    const building = frame.phase === "build";
    if (!building) stack.push({ ...frame, phase: "build" });
    switch (node.kind) {
      case "Block":
        if (building) statements[position] = block(node);
        else visitList(node.statements.nodes, node.origin);
        return;
      case "TryStatement": {
        const handler = node.catchClause;
        if (building) {
          const variable = handler?.variableDeclaration ?? null;
          const binding = variable === null ? null : requirePresent(variablesByNode.get(variable.id),
            failure("compiler defect", "a handler binding without its actual local declaration", variable.origin));
          statements[position] = { ...header(node), kind: node.kind, tryBlock: blockOf(node.tryBlock),
            catchClause: handler === null ? null : { ...header(handler), kind: handler.kind, variableDeclaration: binding,
              block: blockOf(handler.block), tsonic: null },
            finallyBlock: node.finallyBlock === null ? null : blockOf(node.finallyBlock), tsonic: null };
        } else {
          if (node.finallyBlock !== null) visit(node.finallyBlock);
          if (handler !== null) visit(handler.block);
          visit(node.tryBlock);
        }
        return;
      }
      case "ReturnStatement": {
        const value = node.expression;
        if (value === null) {
          const completion = readType(deps.types, typing.completion);
          if (completion.kind !== "intrinsic" || completion.intrinsic !== "void")
            return callerDefect("a bare return without its actual selected void completion", node.origin);
        }
        if (building) statements[position] = { ...header(node), kind: "ReturnStatement", expression: value === null ? null : expressionOf(value), tsonic: null };
        else if (value !== null) visit(value);
        return;
      }
      case "ExpressionStatement":
        if (building) statements[position] = { ...header(node), kind: "ExpressionStatement", expression: expressionOf(node.expression), tsonic: null };
        else visit(node.expression);
        return;
      case "ThrowStatement":
        if (building) {
          const expression = expressionOf(node.expression);
          let producer = expression;
          while (producer.kind === "ParenthesizedExpression") {
            const child = producer.expression;
            const value = values[nodePosition(child.id)];
            const wrapper = values[nodePosition(producer.id)];
            if (value === undefined || wrapper === undefined || wrapper.type !== value.convertedType)
              return callerDefect("a throw parenthesis does not retain its actual child value endpoint", producer.origin);
            producer = child;
          }
          const slot = nodePosition(producer.id);
          const value = requirePresent(values[slot], failure("compiler defect", "a throw without a selected operand endpoint", node.expression.origin));
          const occurrence = { body: body.body, node: producer.id };
          const application = producer.kind === "CallExpression" ? applications[slot] : undefined;
          if (producer.kind === "CallExpression" && (application === undefined
            || (application.kind === "decided" ? application.decision.result : application.deferred.result) !== value.type))
            return callerDefect("a throw call must retain its actual selected result endpoint", producer.origin);
          const checked = deps.rules.checkThrowOperandUse({ instance, statement: { body: body.body, node: node.id },
            operand: { body: body.body, node: node.expression.id }, origin: node.expression.origin,
            selected: application?.kind === "decided" ? { kind: "application", producer: occurrence, decision: application.decision }
              : { kind: "value", producer: occurrence, type: value.type } });
          if (checked.kind === "refused") return checked;
          statements[position] = { ...header(node), kind: "ThrowStatement", expression, tsonic: null };
        } else visit(node.expression);
        return;
      case "EmptyStatement":
        if (building) statements[position] = { ...header(node), kind: node.kind, tsonic: null };
        return;
      case "InterfaceDeclaration": case "TypeAliasDeclaration":
        if (building) {
          const declaration = node.kind === "InterfaceDeclaration" ? declarationInterface(deps, node) : declarationAlias(deps, node);
          if (declaration.kind === "refused") return declaration;
          statements[position] = declaration.value;
        }
        return;
      case "BreakStatement": case "ContinueStatement": {
        if (node.label !== null) {
          if (building) {
            const label = labelOf(node.label);
            statements[position] = { ...header(node), kind: node.kind, label, tsonic: { target: label.tsonic.target } };
          }
          return;
        }
        const target = node.kind === "ContinueStatement" ? enclosingLoop : enclosingBreak;
        if (target === null) return callerDefect("an unlabelled transfer has no enclosing target in its own execution", node.origin);
        if (building) statements[position] = { ...header(node), kind: node.kind, label: null,
          tsonic: { target: { body: body.body, node: target } } };
        return;
      }
      case "LabeledStatement": {
        if (building) {
          const label = labelOf(node.label);
          if (label.tsonic.target.node !== node.id) return callerDefect("a label does not name its own checked declaration", node.origin);
          statements[position] = { ...header(node), kind: node.kind, label, statement: statementOf(node.statement),
            tsonic: { target: label.tsonic.target } };
        } else visit(node.statement);
        return;
      }
      case "IfStatement":
        if (building) statements[position] = { ...header(node), kind: "IfStatement", expression: expressionOf(node.expression),
          thenStatement: statementOf(node.thenStatement), elseStatement: node.elseStatement === null ? null : statementOf(node.elseStatement), tsonic: null };
        else {
          if (node.elseStatement !== null) visit(node.elseStatement);
          visit(node.thenStatement);
          visit(node.expression);
        }
        return;
      case "SwitchStatement": {
        const { caseBlock } = node;
        if (!building) {
          for (let index = caseBlock.clauses.nodes.length - 1; index >= 0; index -= 1) {
            const clause = requirePresent(caseBlock.clauses.nodes[index], failure("compiler defect", "a switch clause list has a hole", caseBlock.origin));
            visitList(clause.statements.nodes, clause.origin, node.id);
            if (clause.kind === "CaseClause") visit(clause.expression);
          }
          visit(node.expression);
          return;
        }
        statements[position] = { ...header(node), kind: node.kind, expression: expressionOf(node.expression),
          caseBlock: { ...header(caseBlock), kind: caseBlock.kind, tsonic: null, clauses: { loc: caseBlock.clauses.loc,
            nodes: caseBlock.clauses.nodes.map(clause => {
              const statements = { loc: clause.statements.loc, nodes: clause.statements.nodes.map(statementOf) };
              const common = { ...header(clause), statements };
              if (clause.kind === "DefaultClause") return { ...common, kind: clause.kind, expression: null, tsonic: null };
              const casePosition = nodePosition(clause.id);
              const operation = operations[casePosition] ?? compilerDefect("open position: no operator decision at the case", clause.origin);
              if (operation.decision.operands.length !== 2
                || operation.decision.operands[0] !== values[nodePosition(node.expression.id)]?.convertedType
                || operation.decision.operands[1] !== values[nodePosition(clause.expression.id)]?.convertedType)
                return callerDefect("a case comparison must retain its actual switch subject and label", clause.origin);
              read.operations.add(casePosition);
              return { ...common, kind: clause.kind, expression: expressionOf(clause.expression),
                tsonic: { operation: { kind: "decided", decision: operation } } };
            }) } }, tsonic: null };
        return;
      }
      case "WhileStatement": case "DoStatement":
        if (building) statements[position] = { ...header(node), kind: node.kind, expression: expressionOf(node.expression),
          statement: statementOf(node.statement), tsonic: null };
        else if (node.kind === "WhileStatement") {
          visit(node.statement, node.id, node.id);
          visit(node.expression);
        } else {
          visit(node.expression);
          visit(node.statement, node.id, node.id);
        }
        return;
      case "ForStatement": {
        const initializer = node.initializer;
        if (initializer?.kind === "MissingDeclaration")
          return notElaboratedYet("a for initializer with a missing declaration", node.origin);
        if (initializer?.kind === "VariableDeclarationList" && (initializer.flags.includes("Using") || initializer.flags.includes("AwaitUsing")))
          return notElaboratedYet("a disposal declaration in a for initializer", node.origin);
        if (building) {
          let selectedInitializer: Expression<TypedPhase> | VariableDeclarationList<TypedPhase> | null;
          if (initializer?.kind === "VariableDeclarationList") {
            const variables = variableList(initializer);
            if (variables.kind === "refused") return variables;
            selectedInitializer = variables.value;
          } else selectedInitializer = initializer === null ? null : expressionOf(initializer);
          statements[position] = { ...header(node), kind: node.kind,
            initializer: selectedInitializer,
            condition: node.condition === null ? null : expressionOf(node.condition),
            incrementor: node.incrementor === null ? null : expressionOf(node.incrementor),
            statement: statementOf(node.statement), tsonic: null };
        }
        else {
          visit(node.statement, node.id, node.id);
          if (node.incrementor !== null) visit(node.incrementor);
          if (node.condition !== null) visit(node.condition);
          if (initializer !== null && initializer.kind !== "VariableDeclarationList") visit(initializer);
        }
        return;
      }
      case "VariableStatement":
        if (building) {
          const variables = variableList(node.declarationList);
          if (variables.kind === "refused") return variables;
          statements[position] = { ...header(node), kind: "VariableStatement", modifiers: declarationModifiers(node.modifiers),
            declarationList: variables.value, tsonic: null };
        }
        return;
      case "ConditionalExpression": {
        if (!building) {
          demandArm(node.condition.id, node.whenTrue, "true");
          demandArm(node.condition.id, node.whenFalse, "false");
          visit(node.whenFalse);
          visit(node.whenTrue);
          visit(node.condition);
          return;
        }
        const result = node.tsonic.views.read;
        if (result.kind !== "available") return callerDefect("a conditional expression without its actual checked result", node.origin);
        const guard = values[nodePosition(node.condition.id)]?.convertedType;
        const control = guard === undefined ? null : readType(deps.types, guard);
        const type = readType(deps.types, result.value);
        const optional = optionalValueDomainOf(type, value => readType(deps.types, value));
        const booleanControl = control?.kind === "primitive" && control.primitive === "bool" || control?.kind === "literal" && control.value.kind === "boolean";
        const selectedResult = type.kind === "primitive" || type.kind === "string" || optional.kind === "optional-value";
        if (!booleanControl || !selectedResult || values[nodePosition(node.whenTrue.id)]?.convertedType !== result.value
          || values[nodePosition(node.whenFalse.id)]?.convertedType !== result.value)
          return notElaboratedYet("a conditional expression without its Boolean control and same-carrier arms", node.origin);
        expressions[position] = { ...header(node), kind: "ConditionalExpression", condition: expressionOf(node.condition),
          questionToken: { ...header(node.questionToken), kind: "QuestionToken", tsonic: null }, whenTrue: expressionOf(node.whenTrue),
          colonToken: { ...header(node.colonToken), kind: "ColonToken", tsonic: null }, whenFalse: expressionOf(node.whenFalse),
          tsonic: { ...valueOf(position, result.value, node.origin), selection: { kind: "conditional", control: node.condition.id,
            whenTrue: node.whenTrue.id, whenFalse: node.whenFalse.id, disposition: "dynamic" } } };
        return;
      }
      case "BinaryExpression":
        if (building) {
          expressions[position] = binary(node, position);
        } else {
          admitBinary(node, position);
          visit(node.right);
          visit(node.left);
        }
        return;
      case "VoidExpression": {
        if (!building) {
          visit(node.expression);
          return;
        }
        const operation = operations[position] ?? compilerDefect("open position: no operator decision at the void expression", node.origin);
        const checked = node.tsonic.views.read;
        const operand = values[nodePosition(node.expression.id)];
        if (checked.kind !== "available" || checked.value !== operation.decision.result
          || operation.decision.operation.kind !== "discard" || operation.decision.execution.kind !== "pure"
          || operation.decision.operands.length !== 1 || operation.decision.operands[0] !== operand?.convertedType)
          return callerDefect("a typed void expression retains its checked result and one actual discarded value", node.origin);
        read.operations.add(position);
        expressions[position] = { ...header(node), kind: node.kind, expression: expressionOf(node.expression),
          tsonic: { ...valueOf(position, checked.value, node.origin), operation: { kind: "decided", decision: operation } } };
        return;
      }
      case "PrefixUnaryExpression": case "PostfixUnaryExpression": {
        const operator = prefixOperatorOf(node.operator);
        const update = operator === "++" || operator === "--";
        if (update) {
          const leaf = unparenthesizedExpression<CheckedPhase>(node.operand);
          const target = leaf.kind === "Identifier" ? leaf.tsonic : null;
          const storage = target?.role === "assignment-target" && target.access === "read-write"
            ? readWriteRootStorageOf(target.place, target.resolution) : null;
          if (node.tsonic.role !== "update" || target === null || target.role !== "assignment-target" || storage === null
            || readWriteRootStorageOf(node.tsonic.target, target.resolution) !== storage)
            return notElaboratedYet("the actual selected read-write root update target", node.origin);
        } else if (node.tsonic.role !== "value")
          return notElaboratedYet(`the unary operator ${node.operator} of role ${node.tsonic.role}`, node.origin);
        if (building) {
          const operation = operations[position] ?? compilerDefect("open position: no operator decision at the unary expression", node.origin);
          read.operations.add(position);
          const operand = expressionOf(node.operand);
          const outcome: RuleOutcome<TypedOperation> = { kind: "decided", decision: operation };
          const selected = { operation: outcome, ...valueOf(position, operation.decision.result, node.origin) };
          if (update) {
            const target = unparenthesizedExpression<TypedPhase>(operand);
            if (target.kind !== "Identifier" || target.tsonic.role !== "assignment-target" || target.tsonic.access.kind !== "read-write")
              return callerDefect("a typed update retains its actual read-write root", node.origin);
            const { storage, read: operandType } = target.tsonic.access;
            if (operation.decision.result !== storage || operation.decision.operands.length !== 1 || operation.decision.operands[0] !== operandType)
              return callerDefect("a typed update retains its selected read and write endpoints", node.origin);
            expressions[position] = node.kind === "PostfixUnaryExpression"
              ? { ...header(node), kind: node.kind, operator: node.operator, operand, tsonic: { ...selected, storage } }
              : { ...header(node), kind: node.kind, operator: node.operator, operand, tsonic: { ...selected, role: "update", storage } };
          } else if (node.kind === "PrefixUnaryExpression") {
            expressions[position] = { ...header(node), kind: node.kind, operator: node.operator, operand, tsonic: { ...selected, role: "value" } };
          }
        } else visit(node.operand);
        return;
      }
      case "ElementAccessExpression":
        if (!building) { visit(node.expression); visit(node.argumentExpression); return; }
        {
          const index = indexes[position] ?? compilerDefect("an element access has no actual selected index decision", node.origin);
          if (node.questionDotToken !== null || node.tsonic.role === "enum-member")
            return callerDefect("a native index retains its actual nonoptional index occurrence", node.origin);
          let tsonic: TypedIndex;
          if (node.tsonic.role === "assignment-target") {
            const storage = checkedMemberStorageOf(node);
            if (storage === null || index.write !== storage.write || index.read !== storage.read)
              return callerDefect("an index target requires its actual selected storage", node.origin);
            const access: TargetAccess = storage.read === null ? { kind: "write", storage: storage.write }
              : { kind: "read-write", storage: storage.write, read: storage.read, narrowing: null, evidenceIndex: null };
            tsonic = { role: "assignment-target", index, access };
          } else {
            if (index.read === null || index.write !== null) return callerDefect("an index read requires its selected read alone", node.origin);
            tsonic = { role: "value", index, ...valueOf(position, index.read, node.origin) };
          }
          read.indexes.add(position);
          expressions[position] = { ...header(node), kind: "ElementAccessExpression", expression: expressionOf(node.expression),
            questionDotToken: null, argumentExpression: expressionOf(node.argumentExpression), tsonic };
          return;
        }
      case "PropertyAccessExpression":
        if (node.tsonic.role === "array-extent") {
          if (!building) { visit(node.expression); return; }
          const operation = operations[position] ?? compilerDefect("an array extent has no selected native operation", node.origin);
          const extent = operation.decision.operation;
          const name = node.name;
          if (node.questionDotToken !== null || extent.kind !== "array-extent"
            || extent.declaration.owner !== node.tsonic.selectedMember.owner || extent.declaration.node !== node.tsonic.selectedMember.node
            || name.kind !== "Identifier" || name.tsonic.role !== "property-name" || name.tsonic.key.kind !== "available")
            return callerDefect("an array extent must retain its actual checked declaration and selector", node.origin);
          read.operations.add(position);
          expressions[position] = { ...header(node), kind: node.kind, expression: expressionOf(node.expression), questionDotToken: null,
            name: { ...header(name), kind: "Identifier", text: name.text, tsonic: { role: "property-name", key: name.tsonic.key.value } },
            tsonic: { ...valueOf(position, operation.decision.result, node.origin), role: "array-extent",
              operation: { kind: "decided", decision: operation } } };
          return;
        }
        if (node.tsonic.role === "enum-member") {
          if (!building) return;
          const qualifier = node.expression;
          const selectedName = node.name;
          if (node.questionDotToken !== null || qualifier.kind !== "Identifier" || qualifier.tsonic.role !== "enum-qualifier"
            || selectedName.kind !== "Identifier" || selectedName.tsonic.role !== "property-name" || selectedName.tsonic.key.kind !== "available")
            return callerDefect("a qualified enum read retains its actual selector and declaration qualifier", node.origin);
          const { nominal, resolution } = qualifier.tsonic;
          const binding = resolution.kind === "binding" ? resolveModuleBinding(deps, resolution.occurrence) : null;
          const target = binding === null ? resolution : binding.target.kind === "available" ? binding.target.value : null;
          const item = deps.itemOf(node.tsonic.selectedMember.owner);
          const part = item.kind !== "EnumMember" || item.tsonic.parent === null ? null : deps.itemOf(item.tsonic.parent);
          if (part?.kind !== "EnumDeclaration" || part.tsonic.nominal !== nominal || target?.kind !== "declarations"
            || !target.definitions.some(definition => {
              const resolved = deps.itemOf(definition);
              return resolved.kind === "EnumDeclaration" && resolved.tsonic.nominal === nominal;
            }))
            return callerDefect("a qualified enum read retains its actual owning declaration group", node.origin);
          const member = enumConstant(node, node.tsonic.selectedMember, binding?.aliases ?? []);
          expressions[position] = { ...header(node), kind: node.kind, questionDotToken: null,
            expression: { ...header(qualifier), kind: qualifier.kind, text: qualifier.text, tsonic: { role: "enum-qualifier", nominal } },
            name: { ...header(selectedName), kind: selectedName.kind, text: selectedName.text,
              tsonic: { role: "property-name", key: selectedName.tsonic.key.value } },
            tsonic: { role: "enum-member", resolution: member.resolution, ...valueOf(position, member.storage, node.origin) } };
          return;
        }
        if (building) {
          const { member, refinement } = members[position] ?? compilerDefect("a property access has no actual selected member decision", node.origin);
          if (node.questionDotToken !== null || node.name.kind !== "Identifier" || node.name.tsonic.role !== "property-name")
            return callerDefect("a property access retains its actual checked nonoptional name", node.origin);
          if (member.getter !== null || member.setter !== null)
            return notElaboratedYet("the actual selected accessor application transport", node.origin);
          const checked = node.tsonic;
          const selection = { kind: "decided", decision: { decision: member, getter: null, setter: null } } satisfies RuleOutcome<MemberSelection>;
          let tsonic: TypedMember;
          if (checked.role === "assignment-target") {
            const storage = checkedMemberStorageOf(node);
            if (storage === null || member.write !== storage.write || storage.read !== null && member.read !== storage.read)
              return callerDefect("a property target requires its actual selected writable type", node.origin);
            const access: TargetAccess = storage.read === null ? { kind: "write", storage: storage.write }
              : { kind: "read-write", storage: storage.write, read: storage.read, narrowing: null, evidenceIndex: null };
            tsonic = { role: "assignment-target", selection, access };
          } else {
            if (member.read === null) return callerDefect("a property read requires its actual selected type", node.origin);
            tsonic = { role: "value", ...valueOf(position, refinement === null ? member.read : refinement.result, node.origin, refinement), selection };
          }
          read.members.add(position);
          expressions[position] = { ...header(node), kind: "PropertyAccessExpression", expression: expressionOf(node.expression),
            questionDotToken: null, name: { ...header(node.name), kind: "Identifier", text: node.name.text,
              tsonic: { role: "property-name", key: member.key } }, tsonic };
        } else visit(node.expression);
        return;
      case "CallExpression":
        if (building) {
          const application = applications[position] ?? compilerDefect("a call has no solved selected application", node.origin);
          if (node.questionDotToken !== null)
            return notElaboratedYet("the selected argument and receiver transport of this call", node.origin);
          const result = application.kind === "decided" ? application.decision.result : application.deferred.result;
          const selected: RuleOutcome<TirApplication> = application.kind === "deferred" ? application
            : { kind: "decided", decision: elaborateSelectedCall(deps, application.decision, instance.bindings,
              { provided: node.arguments.nodes.length, argumentAt: at => node.arguments.nodes[at]?.id }, node.origin) };
          const layout = checkedLayoutRoleOf(node);
          const construction = checkedLayoutConstructionOf(node);
          let arguments_: TirCallArguments;
          if (layout === "field-offset") {
            const operand = node.arguments.nodes[0];
            const selector = node.arguments.nodes[1];
            if (node.arguments.nodes.length !== 2 || operand === undefined || selector?.kind !== "ArrowFunction"
              || !("role" in selector.tsonic) || selector.tsonic.call.body !== body.body || selector.tsonic.call.node !== node.id)
              return callerDefect("a field offset requires its actual selected layout operand and checked selector", node.origin);
            arguments_ = { kind: "field-offset-quote", loc: node.arguments.loc, layout: expressionOf(operand), selector };
          } else if (construction === null) {
            arguments_ = { loc: node.arguments.loc, nodes: node.arguments.nodes.map(expressionOf) };
          } else {
            const descriptor = node.arguments.nodes[0];
            if (node.arguments.nodes.length !== 1 || descriptor?.kind !== "ObjectLiteralExpression" ||
              descriptor.tsonic.role !== "layout-quote" || descriptor.tsonic.call.body !== body.body || descriptor.tsonic.call.node !== node.id)
              return callerDefect("a layout construction requires its actual checked descriptor quotation", node.origin);
            const geometry = checkedLayoutGeometryOperands(construction);
            if (geometry.length !== (construction.kind === "field" ? 2 : construction.kind === "array" ? 4 : 3))
              return callerDefect("a layout construction requires its full checked geometry operand inventory", node.origin);
            const operands: TirLayoutOperand[] = [];
            for (const reference of geometry) {
              if (reference.kind !== "body")
                return callerDefect("a checked layout operand must retain its actual qualified source", node.origin);
              const root = children.get(reference.value.body)?.root;
              if (root === undefined || root.id !== reference.value.node || root.kind === "Block" || root.kind === "SourceFile")
                return callerDefect("a checked layout operand must borrow its own ready expression body", node.origin);
              operands.push({ source: reference.value, root });
            }
            arguments_ = { kind: "layout-quote", loc: node.arguments.loc, descriptor, operands };
          }
          read.applications.add(position);
          let typeArguments: TypeArgumentList<TypedPhase> | null = null;
          if (node.typeArguments !== null) {
            const typedArguments: TypeNode<TypedPhase>[] = [];
            for (const type of node.typeArguments.nodes) {
              const selected = declarationType(deps, type);
              if (selected.kind === "refused") return selected;
              typedArguments.push(selected.value ?? compilerDefect("a selected call has no typed source argument", type.origin));
            }
            typeArguments = { ...node.typeArguments, nodes: typedArguments };
          }
          expressions[position] = { ...header(node), kind: "CallExpression", expression: expressionOf(node.expression),
            arguments: arguments_, typeArguments, questionDotToken: null,
            tsonic: layout === null ? { ...valueOf(position, result, node.origin), operation: null, application: selected }
              : { ...valueOf(position, result, node.origin), layout, application: selected } };
        } else {
          if (checkedLayoutRoleOf(node) === "field-offset") {
            const operand = node.arguments.nodes[0];
            if (operand === undefined) return callerDefect("a field offset requires its actual layout operand", node.origin);
            visit(operand);
          } else if (checkedLayoutConstructionOf(node) === null) visitList(node.arguments.nodes, node.origin);
          visit(node.expression);
        }
        return;
      case "ParenthesizedExpression":
        if (building) {
          const expression = expressionOf(node.expression);
          const type = expression.kind === "Identifier" && expression.tsonic.role === "assignment-target"
            ? expression.tsonic.access.storage
            : requirePresent(values[nodePosition(node.expression.id)], failure("compiler defect", "an operand without a typed value", node.origin)).convertedType;
          expressions[position] = { ...header(node), kind: "ParenthesizedExpression", expression, tsonic: valueOf(position, type, node.origin) };
        } else {
          visit(node.expression);
        }
        return;
      case "NonNullExpression": {
        if (!building) {
          visit(node.expression);
          return;
        }
        const result = node.tsonic.views.read;
        const operand = values[nodePosition(node.expression.id)];
        if (result.kind !== "available" || operand?.convertedType !== result.value)
          return notElaboratedYet("a non-null assertion without an already-present native operand", node.origin);
        const type = readType(deps.types, result.value);
        if (type.kind !== "primitive" && type.kind !== "string" && !(type.kind === "literal" && type.value.kind !== "absence"))
          return notElaboratedYet("a non-null assertion without an already-present native operand", node.origin);
        expressions[position] = { ...header(node), kind: node.kind, expression: expressionOf(node.expression),
          tsonic: valueOf(position, result.value, node.origin) };
        return;
      }
      case "AsExpression": case "TypeAssertionExpression": case "SatisfiesExpression": {
        if (!building) {
          visit(node.expression);
          return;
        }
        const type = declarationType(deps, node.type);
        if (type.kind === "refused") return type;
        const result = node.tsonic.views.read;
        const target = node.type.tsonic.type;
        const operand = values[nodePosition(node.expression.id)];
        if (target.kind !== "available" || result.kind !== "available" || target.value !== result.value || operand?.convertedType !== result.value)
          return notElaboratedYet("an assertion without the same selected operand, target and result type", node.origin);
        expressions[position] = { ...header(node), kind: node.kind, expression: expressionOf(node.expression),
          type: type.value ?? compilerDefect("an assertion has no typed annotation", node.origin),
          tsonic: valueOf(position, result.value, node.origin) };
        return;
      }
      case "Identifier":
        if (building) expressions[position] = identifier(node, position);
        else admitName(node, position);
        return;
      case "TrueKeyword": case "FalseKeyword": case "NumericLiteral": case "BigIntLiteral": case "StringLiteral":
      case "NoSubstitutionTemplateLiteral": case "NullKeyword": {
        if (node.tsonic.role !== "value" || node.tsonic.value.views.read.kind !== "available")
          return callerDefect("a literal has no actual checked value type", node.origin);
        if (building) {
          const variable = variables[position];
          if (variable?.kind === "literal-decision") return callerDefect("a literal decision has no actual declared variable", node.origin);
          if (variable?.kind === "contextual-literal" && (variable.target === null || names[variable.target]?.storage !== variable.type))
            return callerDefect("a contextual literal must use its actual qualified assignment destination", node.origin);
          const value = valueOf(position, variable?.kind === "literal" || variable?.kind === "contextual-literal"
            ? variable.type : node.tsonic.value.views.read.value, node.origin);
          if (node.kind === "NumericLiteral") {
            if (node.tsonic.literal.kind !== "number" || node.tsonic.literal.token !== node.text)
              return callerDefect("a numeric occurrence has no actual captured exact token and value", node.origin);
            expressions[position] = { ...header(node), kind: "NumericLiteral", text: node.text, tokenFlags: node.tokenFlags,
              tsonic: { role: "value", value: node.tsonic.literal.value, ...value } };
          } else if (node.kind === "BigIntLiteral") {
            if (node.tsonic.literal.kind !== "bigint" || node.tsonic.literal.token !== node.text)
              return callerDefect("a bigint occurrence has no actual captured exact token and value", node.origin);
            expressions[position] = { ...header(node), kind: "BigIntLiteral", text: node.text, tokenFlags: node.tokenFlags,
              tsonic: { role: "value", value: node.tsonic.literal.value, ...value } };
          } else if (node.kind === "StringLiteral" || node.kind === "NoSubstitutionTemplateLiteral") {
            if (node.tsonic.literal.kind !== "string")
              return callerDefect("a string occurrence has no actual captured string value", node.origin);
            const tsonic: TypedPhase["StringLiteral"] = { role: "value", value: node.tsonic.literal.value, ...value };
            const spelling = { ...header(node), text: node.text, tokenFlags: node.tokenFlags, tsonic };
            expressions[position] = node.kind === "StringLiteral" ? { ...spelling, kind: node.kind }
              : { ...spelling, kind: node.kind, rawText: node.rawText, templateFlags: node.templateFlags };
          } else expressions[position] = { ...header(node), kind: node.kind, tsonic: { role: "value", ...value } };
        }
        return;
      }
      default:
        notElaboratedYet(`a ${node.kind}`, node.origin);
    }
  };
  visiting = root.id;
  if (moduleStatements !== null) {
    for (let index = moduleStatements.length - 1; index >= 0; index -= 1) {
      const statement = moduleStatements[index];
      if (statement !== undefined && isInlineModuleStatement(statement)) visit(statement);
    }
  }
  else if (root.kind === "Block") visitList(root.statements.nodes, root.origin);
  else { visiting = null; visit(root); }
  for (let frame = stack.pop(); frame !== undefined; frame = stack.pop()) {
    const refusal = step(frame);
    if (refusal !== undefined) return refusal;
  }

  const lexicalBindings = instance.bindings.kind === "instantiated" ? instance.bindings.bindings : rigidBindings(scope);
  const dependence = "parametric";
  const moduleRoot = root.kind === "SourceFile" ? elaborateModuleSyntax(deps, root, childStates, instance, {
    kind: "ready", template: { body: body.body, lexicalBindings, dependence },
    statementOf: statement => blocked.get(statement.id) ?? statementOf(statement),
  }) : null;
  if (moduleRoot !== null && moduleRoot.kind !== "ok") return moduleRoot;
  const rootBlock = blocked.get(root.id);
  if (rootBlock !== undefined) return rootBlock;
  for (const child of childStates.values()) if ("kind" in child) {
    if (child.kind === "no-result") return { ...child, instance, diagnostics: [] };
    if (root.kind !== "SourceFile") return callerDefect("only an actual module declaration may have an unopened child", rootOrigin);
  }
  const typedRoot = moduleRoot === null ? root.kind === "Block" ? block(root) : expressionOf(root) : moduleRoot.value;
  const refuseUnread = (entries: readonly unknown[], seen: ReadonlySet<number>, label: string): void => {
    for (const [position, entry] of entries.entries()) {
      if (entry !== undefined && !seen.has(position)) {
        const node = requirePresent(nodes[position], failure("compiler defect", "a decision position without a node", rootOrigin));
        callerDefect(`a solved ${label} at a ${node.kind}, which the typed body does not read`, node.origin);
      }
    }
  };
  refuseUnread(operations, read.operations, "operator decision");
  refuseUnread(flows, read.flows, "flow decision");
  refuseUnread(variables, read.variables, "variable");
  refuseUnread(applications, read.applications, "application decision");
  refuseUnread(members, read.members, "member decision");
  refuseUnread(indexes, read.indexes, "index decision");

  return { kind: "ok", diagnostics: [], value: {
    body: body.body, owner: body.owner, bindings: instance.bindings,
    lexicalBindings,
    dependence, signature: typing.signature, completion: typing.completion, yielded: typing.yielded, sent: typing.sent,
    params, locals, root: typedRoot, nestedBodies: body.nestedBodies, captures: typing.captures, scopes: body.scopes, evidence: [],
    asynchronous: body.asynchronous, generator: body.generator } };
}

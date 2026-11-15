import type { InvariantFailure, Result } from "../diag/contract.js";
import { requirePresent, throwInvariant } from "../diag/index.js";
import type { BodyId, NodeId, NodeRef, Origin, TyId } from "../ids/contract.js";
import type { BinaryExpression, Block, CheckedPhase, Expression, HirBody, HirNode, Identifier, NodeHeader, ParameterDeclaration, Statement, VariableDeclaration } from "../ir-hir/contract.js";
import { resolveModuleBinding, walkSyntaxTree } from "../ir-hir/index.js";
import type { ApplicationDecision, BodyTyping, EmbeddingDecision, FlowRole, InferredSignaturePart } from "../ir-infer/contract.js";
import type { TirArgument, TirBody, TirLocal, TirResolution, TypedOperation, TypedPhase, TypedValue } from "../ir-tir/contract.js";
import { artifactBindingsKey } from "../ir-types/index.js";
import type { ElaborateDeps, ElaborateInput } from "./contract.js";
import { elaborateModuleBody, elaborateParameter, elaborateVariable } from "./module.js";
import { declarationModifiers } from "./declarations.js";

const failure = (kind: string, what: string, origin: Origin | null): InvariantFailure =>
  ({ owner: "elaborate", query: null, origin, message: `${kind}: ${what}` });

const notElaboratedYet = (what: string, origin: Origin | null): never => throwInvariant(failure("not elaborated yet", what, origin));
const callerDefect = (what: string, origin: Origin | null): never => throwInvariant(failure("caller defect", what, origin));
const compilerDefect = (what: string, origin: Origin | null): never => throwInvariant(failure("compiler defect", what, origin));

interface Flow {
  readonly embedding: EmbeddingDecision;
  readonly destination: TyId;
  readonly role: FlowRole;
}

const header = (node: NodeHeader): NodeHeader =>
  ({ id: node.id, origin: node.origin, parent: node.parent, flags: node.flags, loc: node.loc });

function signaturePartType(deps: ElaborateDeps, body: HirBody, typing: BodyTyping, part: InferredSignaturePart): TyId {
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
  if (declaration === null || declaration.kind !== "Parameter" && declaration.kind !== "VariableDeclaration" && declaration.kind !== "PropertyDeclaration"
    || declaration.initializer !== root || declaration.tsonic.initializer !== body.body)
    return callerDefect("an inferred initializer part is not its checked declaration's own expression execution", origin);
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

export function elaborateBody(deps: ElaborateDeps, input: ElaborateInput): Result<TirBody> {
  const { instance, body, constraints, solution, template } = input;
  const root = body.root;
  const rootOrigin = root.origin;
  if (body.captures.length !== 0) notElaboratedYet("the creator's actual capture decisions", rootOrigin);
  if (instance.body !== body.body) callerDefect("the instance names another body than the checked body", rootOrigin);
  const scope = input.scope;
  if (scope.classParameters.length !== 0 || scope.methodParameters.length !== 0 || scope.capturedParameters.length !== 0 || scope.selfOwners.length !== 0)
    notElaboratedYet("substitution and decision replay over a nonempty qualified binding scope", rootOrigin);
  if (instance.bindings.kind === "instantiated") {
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
  if (template !== null && (template.signature !== typing.signature || template.completion !== typing.completion ||
    template.yielded !== typing.yielded || template.sent !== typing.sent))
    callerDefect("the selected closed-scope replay does not retain the solved template body channels", rootOrigin);
  if (root.kind === "SourceFile") {
    if (input.initializers.length !== 0) return callerDefect("a module has no formal initializer inputs", rootOrigin);
    return elaborateModuleBody(deps, input, root, typing);
  }
  const children = new Map<BodyId, TirBody>();
  for (const child of input.nestedBodies) {
    if (children.has(child.body) || artifactBindingsKey(child.bindings) !== artifactBindingsKey(instance.bindings))
      return callerDefect("a nested initializer must be its unique completed body under the same actual bindings", rootOrigin);
    children.set(child.body, child);
  }
  if (children.size !== body.nestedBodies.length || body.nestedBodies.some(nested => !children.has(nested)))
    return callerDefect("the nested execution inputs must retain the actual direct body inventory", rootOrigin);

  const nodes = walkSyntaxTree(root, []);
  const first = root.id;
  for (const [position, node] of nodes.entries()) {
    if (node.id !== first + position) callerDefect("the body's node identities are not one preorder range", node.origin);
  }
  const positionOf = (reference: NodeRef): number => {
    if (reference.body !== body.body) callerDefect("an occurrence of another body", rootOrigin);
    const position = reference.node - first;
    return position >= 0 && position < nodes.length ? position : callerDefect("an occurrence outside the body", rootOrigin);
  };
  const originAt = (position: number): Origin => requirePresent(nodes[position], failure("compiler defect", "a position without a node", rootOrigin)).origin;

  const operations: (TypedOperation | undefined)[] = [];
  const flows: (Flow | undefined)[] = [];
  const variables: (TyId | undefined)[] = [];
  const applications: (ApplicationDecision | undefined)[] = [];
  const calleeTypes = new Map<NodeId, TyId>();
  const read = { operations: new Set<number>(), flows: new Set<number>(), variables: new Set<number>(), applications: new Set<number>() };
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
      const scope = constraint.permissionScope;
      if (scope !== null) positionOf(scope);
      operations[position] = { decision: decision.operation, permissionScope: scope === null ? null : scope.node };
    } else if (constraint.kind === "flow") {
      if (flows[position] !== undefined) callerDefect("two flow decisions at one occurrence", origin);
      if (decision.kind === "deferred") notElaboratedYet("a deferred conversion", origin);
      if (decision.kind !== "flow") return callerDefect(`a flow constraint solved by a decision of kind ${decision.kind}`, origin);
      flows[position] = { embedding: decision.embedding, destination: finalType(constraint.to, origin), role: constraint.role };
    } else if (constraint.kind === "call") {
      if (decision.kind !== "call" || decision.operation !== null || applications[position] !== undefined)
        return callerDefect("a call must retain its one selected application decision", origin);
      const node = nodes[position];
      if (node?.kind !== "CallExpression") return callerDefect("a call decision must name its actual call syntax", origin);
      applications[position] = decision.application;
      calleeTypes.set(node.expression.id, finalType(constraint.application.callee, origin));
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
    if (variable.kind !== "local" || variable.local !== null) notElaboratedYet(`an inference variable of kind ${variable.kind}`, origin);
    variables[position] = finals[variable.id] ?? compilerDefect(`open position: variable ${variable.id} has no final value`, origin);
  }

  const signature = deps.signatureOf(typing.signature);
  if (signature.typeParameters.length !== 0) notElaboratedYet("a generic signature", rootOrigin);
  if (signature.parameters.length !== body.params.length) callerDefect("the signature and the body differ in their parameter count", rootOrigin);
  const storageOf: (TyId | undefined)[] = [];
  const params: ParameterDeclaration<TypedPhase>[] = [];
  const expectedInitializers = new Set<BodyId>();
  for (const parameter of body.params) if (parameter.initializer !== null) expectedInitializers.add(parameter.initializer);
  const initializers = new Map<BodyId, TirBody>();
  const bindingsKey = artifactBindingsKey(instance.bindings);
  for (const initializer of input.initializers) {
    if (!expectedInitializers.has(initializer.body) || initializers.has(initializer.body)
      || artifactBindingsKey(initializer.bindings) !== bindingsKey)
      return callerDefect("a formal initializer must be its unique completed body under the same actual bindings", rootOrigin);
    initializers.set(initializer.body, initializer);
  }
  if (initializers.size !== expectedInitializers.size)
    return callerDefect("the formal initializer inputs must be exactly the actual selected parameter initializers", rootOrigin);
  for (const [position, row] of body.params.entries()) {
    if (row.role !== "required" && row.role !== "default") notElaboratedYet(`a parameter of role ${row.role}`, rootOrigin);
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
    let initializerRoot: Expression<TypedPhase> | null = null;
    if (initializer !== null) {
      const root = initializer.root;
      if (root.kind === "SourceFile" || root.kind === "Block" || initializer.owner !== row.declaration
        || root.id !== header.initializer?.id || initializer.completion !== parameter.type
        || deps.signatureOf(initializer.signature).result !== parameter.type)
        return callerDefect("the completed formal initializer must retain its checked owner, expression and selected result", header.origin);
      initializerRoot = root;
    }
    params.push(elaborateParameter(header, body.body, { local: { body: body.body, local: row.local }, declaration: row.declaration,
      role: row.role, passing: row.passing, initializer: row.initializer, storage: parameter.type }, initializerRoot));
  }
  const variablesByNode = new Map<NodeId, VariableDeclaration<TypedPhase>>();
  for (const local of body.locals) {
    if (local.role === "parameter") continue;
    const declaration = deps.nodeOf(local.declaration);
    if (local.role !== "binding" || local.declaration.kind !== "item" || declaration?.kind !== "VariableDeclaration"
      || declaration.id !== local.declaration.value.node || declaration.tsonic.declaration.kind !== "local"
      || declaration.tsonic.declaration.local.body !== body.body || !Object.is(declaration.tsonic.declaration.local.local, local.id))
      return notElaboratedYet("the actual checked declaration of a non-parameter local", rootOrigin);
    const selected = elaborateVariable(deps, declaration, children, local.declaration.value.owner);
    storageOf[local.id] = selected.tsonic.storage;
    variablesByNode.set(declaration.id, selected);
  }
  const locals: TirLocal[] = body.locals.map(local => ({ id: local.id, declaration: local.declaration, name: local.name, role: local.role,
    capturedFrom: local.capturedFrom, mutable: local.mutable,
    storage: storageOf[local.id] ?? notElaboratedYet(`the local ${local.name}, which no parameter names`, rootOrigin) }));

  const statements: (Statement<TypedPhase> | undefined)[] = [];
  const expressions: (Expression<TypedPhase> | undefined)[] = [];
  const values: (TypedValue | undefined)[] = [];
  const built = (node: HirNode): string => `a ${node.kind} read before it was typed`;
  const statementOf = (node: HirNode): Statement<TypedPhase> => requirePresent(statements[node.id - first], failure("compiler defect", built(node), node.origin));
  const expressionOf = (node: HirNode): Expression<TypedPhase> => requirePresent(expressions[node.id - first], failure("compiler defect", built(node), node.origin));

  const valueOf = (position: number, type: TyId, origin: Origin): TypedValue => {
    const variable = variables[position];
    read.variables.add(position);
    if (variable !== undefined && variable !== type) callerDefect("the variable at the occurrence and its decision disagree on its type", origin);
    const flow = flows[position];
    read.flows.add(position);
    let conversion: TypedValue["conversion"] = { kind: "identity" };
    let convertedType = type;
    if (flow !== undefined) {
      if (flow.embedding.kind === "identity") {
        if (flow.destination !== type) callerDefect("an identity flow whose destination is not the value's type", origin);
      } else if (flow.embedding.kind === "conversion" && flow.embedding.conversion === "literal-fit"
        && flow.embedding.check.kind === "none") {
        convertedType = flow.destination;
        conversion = { kind: "convert", role: flow.role, operation: { permissionScope: null, decision: {
          kind: "selected", operation: { kind: "conversion", from: type, to: convertedType, embedding: flow.embedding },
          operands: [type], result: convertedType, execution: { kind: "pure" },
        } } };
      } else notElaboratedYet(`a conversion of kind ${flow.embedding.kind}`, origin);
    }
    const value: TypedValue = { type, convertedType, conversion, narrowing: null, evidenceIndex: null, demand: { kind: "always" } };
    values[position] = value;
    return value;
  };

  const block = (node: Block<CheckedPhase>): Block<TypedPhase> => ({ ...header(node), kind: "Block", multiLine: node.multiLine, tsonic: null,
    statements: { loc: node.statements.loc, nodes: node.statements.nodes.map(statementOf) } });

  const binaryRoles: ("arithmetic" | "comparison" | undefined)[] = [];
  const names: ({ readonly resolution: TirResolution; readonly storage: TyId } | undefined)[] = [];
  const visited = (node: HirNode): InvariantFailure => failure("compiler defect", `a ${node.kind} built without its visit`, node.origin);

  const admitName = (node: Identifier<CheckedPhase>, position: number): void => {
    const checked = node.tsonic;
    if (checked.role !== "value") return notElaboratedYet(`a name of role ${checked.role}`, node.origin);
    const binding = checked.resolution.kind === "binding" ? resolveModuleBinding(deps, checked.resolution.occurrence) : null;
    const resolution = binding === null ? checked.resolution : binding.target.kind === "available" ? binding.target.value
      : notElaboratedYet("a binding whose actual nearest target is unavailable (" + binding.target.reason + ")", node.origin);
    if (resolution.kind === "declarations") {
      const definition = resolution.definitions[0];
      const storage = calleeTypes.get(node.id);
      if (resolution.definitions.length !== 1 || definition === undefined || storage === undefined)
        return notElaboratedYet("the selected declaration-value type and alias relation", node.origin);
      names[position] = { resolution: { kind: "definition", definition, aliases: binding?.aliases ?? [] }, storage };
      return;
    }
    if (resolution.kind !== "local") return notElaboratedYet(`a name resolving to a ${resolution.kind}`, node.origin);
    if (resolution.local.body !== body.body) notElaboratedYet("a name resolving to a local of another body", node.origin);
    const storage = storageOf[resolution.local.local] ?? callerDefect("a name resolving to a local the body does not have", node.origin);
    names[position] = { resolution: { kind: "local", local: resolution.local }, storage };
  };
  const admitBinary = (node: BinaryExpression<CheckedPhase>, position: number): void => {
    if (node.modifiers !== null || node.type !== null) notElaboratedYet("a binary expression with modifiers or a type", node.origin);
    const role = node.tsonic.role;
    if (role !== "arithmetic" && role !== "comparison") return notElaboratedYet(`a binary expression of role ${role}`, node.origin);
    binaryRoles[position] = role;
  };

  const identifier = (node: Identifier<CheckedPhase>, position: number): Identifier<TypedPhase> => {
    const name = requirePresent(names[position], visited(node));
    return { ...header(node), kind: "Identifier", text: node.text,
      tsonic: { role: "value", resolution: name.resolution, ...valueOf(position, name.storage, node.origin) } };
  };

  const binary = (node: BinaryExpression<CheckedPhase>, position: number): BinaryExpression<TypedPhase> => {
    const role = requirePresent(binaryRoles[position], visited(node));
    const operation = operations[position] ?? compilerDefect("open position: no operator decision at the binary expression", node.origin);
    read.operations.add(position);
    const token = node.operatorToken;
    return { ...header(node), kind: "BinaryExpression", modifiers: null, type: null,
      left: expressionOf(node.left), operatorToken: { ...header(token), kind: token.kind, tsonic: null }, right: expressionOf(node.right),
      tsonic: { role, operation: { kind: "decided", decision: operation }, ...valueOf(position, operation.decision.result, node.origin) } };
  };

  interface Frame { readonly phase: "visit" | "build"; readonly node: HirNode }
  const stack: Frame[] = [];
  const visit = (node: HirNode): void => { stack.push({ phase: "visit", node }); };
  const visitList = (list: readonly HirNode[], origin: Origin): void => {
    for (let index = list.length - 1; index >= 0; index -= 1) visit(requirePresent(list[index], failure("compiler defect", "a child index past its list", origin)));
  };
  const step = (frame: Frame): void => {
    const node = frame.node;
    const position = node.id - first;
    const building = frame.phase === "build";
    if (!building) stack.push({ phase: "build", node });
    switch (node.kind) {
      case "Block":
        if (building) statements[position] = block(node);
        else visitList(node.statements.nodes, node.origin);
        return;
      case "ReturnStatement": {
        const value = node.expression;
        if (value === null) return notElaboratedYet("a return statement without a value", node.origin);
        if (building) statements[position] = { ...header(node), kind: "ReturnStatement", expression: expressionOf(value), tsonic: null };
        else visit(value);
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
      case "VariableStatement":
        if (building) statements[position] = { ...header(node), kind: "VariableStatement", modifiers: declarationModifiers(node.modifiers),
          declarationList: { ...header(node.declarationList), kind: "VariableDeclarationList", tsonic: { role: "ordinary" },
            declarations: { loc: node.declarationList.declarations.loc, nodes: node.declarationList.declarations.nodes.map(declaration =>
              requirePresent(variablesByNode.get(declaration.id), failure("compiler defect", "a variable has no actual selected local binding", declaration.origin))) } },
          tsonic: null };
        return;
      case "BinaryExpression":
        if (building) {
          expressions[position] = binary(node, position);
        } else {
          admitBinary(node, position);
          visit(node.right);
          visit(node.left);
        }
        return;
      case "PrefixUnaryExpression":
        if (node.operator !== "ExclamationToken" || node.tsonic.role !== "value")
          return notElaboratedYet(`the unary operator ${node.operator} of role ${node.tsonic.role}`, node.origin);
        if (building) {
          const operation = operations[position] ?? compilerDefect("open position: no operator decision at the unary expression", node.origin);
          read.operations.add(position);
          expressions[position] = { ...header(node), kind: "PrefixUnaryExpression", operator: node.operator,
            operand: expressionOf(node.operand), tsonic: { role: "value", operation: { kind: "decided", decision: operation },
              ...valueOf(position, operation.decision.result, node.origin) } };
        } else visit(node.operand);
        return;
      case "CallExpression":
        if (building) {
          const application = applications[position] ?? compilerDefect("a call has no solved selected application", node.origin);
          if (node.typeArguments !== null || node.questionDotToken !== null
            || application.parameters.length !== node.arguments.nodes.length)
            return notElaboratedYet("the selected argument and receiver transport of this call", node.origin);
          const arguments_ = application.parameters.map((mapping, parameter): TirArgument => {
            const source = node.arguments.nodes[parameter];
            if (source === undefined || mapping.kind !== "argument" || mapping.parameter !== parameter || mapping.argument !== parameter
              || mapping.component !== null || mapping.passing !== "by-value")
              return notElaboratedYet("the actual fixed by-value source argument mapping", node.origin);
            return { kind: "provided", parameter, expression: source.id };
          });
          read.applications.add(position);
          expressions[position] = { ...header(node), kind: "CallExpression", expression: expressionOf(node.expression),
            arguments: { ...node.arguments, nodes: node.arguments.nodes.map(expressionOf) }, typeArguments: null, questionDotToken: null,
            tsonic: { ...valueOf(position, application.result, node.origin), operation: null,
              application: { kind: "decided", decision: { callee: { decision: application,
                activation: application.api.body === null ? null : { body: application.api.body,
                  bindings: instance.bindings.kind === "parametric" ? instance.bindings
                    : { kind: "instantiated", bindings: application.implementationBindings } } }, receiver: null, arguments: arguments_ } } } };
        } else {
          visitList(node.arguments.nodes, node.origin);
          visit(node.expression);
        }
        return;
      case "ParenthesizedExpression":
        if (building) {
          const inner = requirePresent(values[node.expression.id - first], failure("compiler defect", "an operand without a typed value", node.origin));
          expressions[position] = { ...header(node), kind: "ParenthesizedExpression", expression: expressionOf(node.expression),
            tsonic: valueOf(position, inner.convertedType, node.origin) };
        } else {
          visit(node.expression);
        }
        return;
      case "Identifier":
        if (building) expressions[position] = identifier(node, position);
        else admitName(node, position);
        return;
      case "TrueKeyword": case "FalseKeyword": case "StringLiteral": case "NullKeyword": {
        if (node.tsonic.role !== "value" || node.tsonic.value.views.read.kind !== "available")
          return callerDefect("a literal has no actual checked value type", node.origin);
        if (building) {
          const value = valueOf(position, node.tsonic.value.views.read.value, node.origin);
          if (node.kind === "StringLiteral") {
            if (node.tsonic.literal.kind !== "string")
              return callerDefect("a string occurrence has no actual captured string value", node.origin);
            expressions[position] = { ...header(node), kind: "StringLiteral", text: node.text, tokenFlags: node.tokenFlags,
              tsonic: { role: "value", value: node.tsonic.literal.value, ...value } };
          } else expressions[position] = { ...header(node), kind: node.kind, tsonic: { role: "value", ...value } };
        }
        return;
      }
      default:
        notElaboratedYet(`a ${node.kind}`, node.origin);
    }
  };
  if (root.kind === "Block") visitList(root.statements.nodes, root.origin);
  else visit(root);
  for (let frame = stack.pop(); frame !== undefined; frame = stack.pop()) step(frame);

  const typedRoot = root.kind === "Block" ? block(root) : expressionOf(root);
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

  return { kind: "ok", diagnostics: [], value: {
    body: body.body, owner: body.owner, bindings: instance.bindings,
    lexicalBindings: instance.bindings.kind === "instantiated" ? instance.bindings.bindings
      : { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] },
    dependence: "parametric", signature: typing.signature, completion: typing.completion, yielded: typing.yielded, sent: typing.sent,
    params, locals, root: typedRoot, nestedBodies: body.nestedBodies, captures: [], scopes: body.scopes, evidence: [],
    asynchronous: body.asynchronous, generator: body.generator } };
}

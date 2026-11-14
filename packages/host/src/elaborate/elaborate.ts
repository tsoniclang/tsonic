import type { InvariantFailure, Result } from "../diag/contract.js";
import { requirePresent, throwInvariant } from "../diag/index.js";
import type { LocalRef, NodeRef, Origin, TyId } from "../ids/contract.js";
import type { BinaryExpression, Block, CheckedPhase, Expression, HirNode, Identifier, NodeHeader, Statement } from "../ir-hir/contract.js";
import { walkSyntaxTree } from "../ir-hir/index.js";
import type { EmbeddingDecision } from "../ir-infer/contract.js";
import type { TirBody, TirLocal, TirParam, TypedOperation, TypedPhase, TypedValue } from "../ir-tir/contract.js";
import type { ElaborateDeps, ElaborateInput } from "./contract.js";
import { elaborateModuleBody } from "./module.js";

const failure = (kind: string, what: string, origin: Origin | null): InvariantFailure =>
  ({ owner: "elaborate", query: null, origin, message: `${kind}: ${what}` });

const notElaboratedYet = (what: string, origin: Origin | null): never => throwInvariant(failure("not elaborated yet", what, origin));
const callerDefect = (what: string, origin: Origin | null): never => throwInvariant(failure("caller defect", what, origin));
const compilerDefect = (what: string, origin: Origin | null): never => throwInvariant(failure("compiler defect", what, origin));

interface Flow {
  readonly embedding: EmbeddingDecision;
  readonly destination: TyId;
}

const header = (node: NodeHeader): NodeHeader =>
  ({ id: node.id, origin: node.origin, parent: node.parent, flags: node.flags, loc: node.loc });

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
  if (root.kind === "SourceFile") return elaborateModuleBody(deps, input, root, typing);
  if (root.kind !== "Block") return notElaboratedYet(`a body whose root is a ${root.kind}`, rootOrigin);
  if (input.nestedBodies.length !== 0 || body.nestedBodies.length !== 0)
    return notElaboratedYet("nested execution inside a callable body", rootOrigin);

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
  const read = { operations: new Set<number>(), flows: new Set<number>(), variables: new Set<number>() };
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
      flows[position] = { embedding: decision.embedding, destination: constraint.to };
    } else {
      notElaboratedYet(`a solved ${constraint.kind} constraint`, origin);
    }
  }
  const finals: (TyId | undefined)[] = [];
  for (const final of solution.variables) finals[final.variable] = final.value.type;
  for (const variable of constraints.variables) {
    const position = positionOf(variable.occurrence);
    const origin = originAt(position);
    if (variable.kind !== "local" || variable.local !== null) notElaboratedYet(`an inference variable of kind ${variable.kind}`, origin);
    variables[position] = finals[variable.id] ?? compilerDefect(`open position: variable ${variable.id} has no final value`, origin);
  }

  const signature = deps.signatureOf(typing.signature);
  if (signature.typeParameters.length !== 0) notElaboratedYet("a generic signature", rootOrigin);
  if (signature.parameters.length !== body.params.length) callerDefect("the signature and the body differ in their parameter count", rootOrigin);
  const storageOf: (TyId | undefined)[] = [];
  const params: TirParam[] = [];
  for (const [position, row] of body.params.entries()) {
    if (row.role !== "required") notElaboratedYet(`a parameter of role ${row.role}`, rootOrigin);
    const parameter = requirePresent(signature.parameters[position], failure("compiler defect", "a parameter position past the count", rootOrigin));
    if (parameter.kind !== "required") callerDefect("a required parameter row whose signature parameter is not required", rootOrigin);
    storageOf[row.local] = parameter.type;
    params.push({ local: row.local, declaration: row.declaration, role: row.role, passing: row.passing, initializer: row.initializer,
      storage: parameter.type });
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
    if (flow !== undefined) {
      if (flow.embedding.kind !== "identity") notElaboratedYet(`a conversion of kind ${flow.embedding.kind}`, origin);
      if (flow.destination !== type) callerDefect("an identity flow whose destination is not the value's type", origin);
    }
    const value: TypedValue = { type, convertedType: type, conversion: { kind: "identity" }, narrowing: null, evidenceIndex: null, demand: { kind: "always" } };
    values[position] = value;
    return value;
  };

  const block = (node: Block<CheckedPhase>): Block<TypedPhase> => ({ ...header(node), kind: "Block", multiLine: node.multiLine, tsonic: null,
    statements: { loc: node.statements.loc, nodes: node.statements.nodes.map(statementOf) } });

  const binaryRoles: ("arithmetic" | "comparison" | undefined)[] = [];
  const names: ({ readonly local: LocalRef; readonly storage: TyId } | undefined)[] = [];
  const visited = (node: HirNode): InvariantFailure => failure("compiler defect", `a ${node.kind} built without its visit`, node.origin);

  const admitName = (node: Identifier<CheckedPhase>, position: number): void => {
    const checked = node.tsonic;
    if (checked.role !== "value") return notElaboratedYet(`a name of role ${checked.role}`, node.origin);
    const resolution = checked.resolution;
    if (resolution.kind !== "local") return notElaboratedYet(`a name resolving to a ${resolution.kind}`, node.origin);
    if (resolution.local.body !== body.body) notElaboratedYet("a name resolving to a local of another body", node.origin);
    const storage = storageOf[resolution.local.local] ?? callerDefect("a name resolving to a local the body does not have", node.origin);
    names[position] = { local: resolution.local, storage };
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
      tsonic: { role: "value", resolution: { kind: "local", local: name.local }, ...valueOf(position, name.storage, node.origin) } };
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
      case "BinaryExpression":
        if (building) {
          expressions[position] = binary(node, position);
        } else {
          admitBinary(node, position);
          visit(node.right);
          visit(node.left);
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
      default:
        notElaboratedYet(`a ${node.kind}`, node.origin);
    }
  };
  visitList(root.statements.nodes, root.origin);
  for (let frame = stack.pop(); frame !== undefined; frame = stack.pop()) step(frame);

  const typedRoot = block(root);
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

  return { kind: "ok", diagnostics: [], value: {
    body: body.body, owner: body.owner, bindings: instance.bindings,
    lexicalBindings: instance.bindings.kind === "instantiated" ? instance.bindings.bindings
      : { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] },
    dependence: "parametric", signature: typing.signature, completion: typing.completion, yielded: typing.yielded, sent: typing.sent,
    params, locals, root: typedRoot, nestedBodies: body.nestedBodies, captures: [], scopes: body.scopes, evidence: [],
    asynchronous: body.asynchronous, generator: body.generator } };
}

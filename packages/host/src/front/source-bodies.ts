import type { BodyId, DefId, NodeId } from "../ids/contract.js";
import { decodeBodyId, encodeBodyId } from "../ids/index.js";
import { throwInvariant } from "../diag/index.js";
import type { SyntaxNode, SyntaxPhase } from "../ir-hir/contract.js";
import type { RawLayoutConstruction, RawModule } from "./contract.js";

export interface SourceBodyScope {
  readonly body: BodyId;
  readonly lexicalBody: BodyId;
  readonly callableBody: BodyId | null;
}

interface SourceBodyBoundary {
  readonly kind: "function" | "initializer";
  readonly root: SyntaxNode<SyntaxPhase> | null;
  readonly body: BodyId;
  readonly parent: BodyId;
}

export interface SourceBodyTransition extends SourceBodyScope {
  readonly boundary: SourceBodyBoundary | null;
}

export function layoutConstructionArity(construction: RawLayoutConstruction["construction"], count: number): boolean {
  return construction === "value" ? count >= 4 : count === (construction === "array" ? 6 : 4);
}

export function enterSourceBody(node: SyntaxNode<SyntaxPhase>, scope: SourceBodyScope,
  definitions: ReadonlyMap<NodeId, DefId>): SourceBodyTransition {
  if (node.kind === "FunctionDeclaration" || node.kind === "FunctionExpression" || node.kind === "ArrowFunction"
    || node.kind === "Constructor" || node.kind === "MethodDeclaration" || node.kind === "GetAccessor" || node.kind === "SetAccessor") {
    const definition = definitions.get(node.id);
    if (definition === undefined) return throwInvariant({ owner: "front", query: null, origin: null,
      message: "A function has no checked definition identity." });
    return { ...scope, boundary: { kind: "function", root: node.body,
      body: encodeBodyId({ owner: definition, role: "function", ordinal: 0 }), parent: scope.body } };
  }
  if ((node.kind === "Parameter" || node.kind === "EnumMember" || node.kind === "VariableDeclaration" && node.name.kind === "Identifier") && node.initializer !== null) {
    const definition = definitions.get(node.id);
    if (definition === undefined) return throwInvariant({ owner: "front", query: null, origin: null,
      message: "An owned initializer has no checked definition identity." });
    let parent = scope.body;
    if (node.kind === "Parameter") {
      if (scope.callableBody === null) return throwInvariant({ owner: "front", query: null, origin: null,
        message: "A default parameter has no enclosing callable execution." });
      parent = scope.callableBody;
    }
    return { ...scope, boundary: { kind: "initializer", root: node.initializer, parent,
      body: encodeBodyId({ owner: definition, role: node.kind === "Parameter" ? "default-argument"
        : node.kind === "EnumMember" ? "enum-member-initializer" : "initializer", ordinal: 0 }) } };
  }
  return { ...scope, boundary: null };
}

export function layoutOperandOwners(raw: RawModule): ReadonlyMap<NodeId, NodeId> | null {
  if (raw.types.memoryDescriptors.length === 0) return null;
  const result = new Map<NodeId, NodeId>();
  for (const descriptor of raw.types.memoryDescriptors) {
    if (!layoutConstructionArity(descriptor.construction, descriptor.operands.length)) continue;
    const invocation = descriptor.application.invocation;
    const positions = descriptor.construction === "value" ? [1, 2, 3]
      : descriptor.construction === "array" ? [1, 2, 3, 5] : [1, 2];
    for (const position of positions) {
      const operand = descriptor.operands[position];
      if (operand?.kind !== "value") continue;
      const expression = operand.expression;
      if (invocation.module !== raw.module || expression.module !== raw.module || result.has(expression.node))
        return throwInvariant({ owner: "front", query: null, origin: null,
          message: "A layout constant operand must retain its one actual construction and authored occurrence." });
      result.set(expression.node, invocation.node);
    }
  }
  return result;
}

export function childSourceBody(parent: SourceBodyTransition, child: SyntaxNode<SyntaxPhase>,
  layoutOperands: ReadonlyMap<NodeId, NodeId> | null): SourceBodyScope {
  const layout = layoutOperands?.get(child.id);
  if (layout !== undefined) {
    const enclosing = decodeBodyId(parent.body);
    if (enclosing.kind !== "decoded" || child.parent !== layout)
      return throwInvariant({ owner: "front", query: null, origin: child.origin,
        message: "A layout operand body belongs to its actual construction inside the enclosing execution." });
    const body = encodeBodyId({ owner: enclosing.value.owner, role: "layout-operand", ordinal: child.id });
    return { body, lexicalBody: body, callableBody: parent.callableBody };
  }
  const boundary = parent.boundary;
  const entersRoot = boundary !== null && child === boundary.root;
  return { body: boundary !== null && (entersRoot
    || boundary.kind === "function" && boundary.root !== null && child.kind === "Parameter")
    ? boundary.body : parent.body,
    lexicalBody: boundary !== null && entersRoot ? boundary.body : parent.lexicalBody,
    callableBody: boundary?.kind === "function" ? boundary.body : parent.callableBody };
}

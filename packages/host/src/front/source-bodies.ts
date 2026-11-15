import type { BodyId, DefId, NodeId } from "../ids/contract.js";
import { encodeBodyId } from "../ids/index.js";
import { throwInvariant } from "../diag/index.js";
import type { SyntaxNode, SyntaxPhase } from "../ir-hir/contract.js";

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
  if ((node.kind === "Parameter" || node.kind === "VariableDeclaration") && node.initializer !== null) {
    const definition = definitions.get(node.id);
    if (definition === undefined) return throwInvariant({ owner: "front", query: null, origin: null,
      message: "A default parameter has no checked definition identity." });
    let parent = scope.body;
    if (node.kind === "Parameter") {
      if (scope.callableBody === null) return throwInvariant({ owner: "front", query: null, origin: null,
        message: "A default parameter has no enclosing callable execution." });
      parent = scope.callableBody;
    }
    return { ...scope, boundary: { kind: "initializer", root: node.initializer, parent,
      body: encodeBodyId({ owner: definition, role: node.kind === "Parameter" ? "default-argument" : "initializer", ordinal: 0 }) } };
  }
  return { ...scope, boundary: null };
}

export function childSourceBody(parent: SourceBodyTransition, child: SyntaxNode<SyntaxPhase>): SourceBodyScope {
  const boundary = parent.boundary;
  const entersRoot = boundary !== null && child === boundary.root;
  return { body: boundary !== null && (entersRoot
    || boundary.kind === "function" && boundary.root !== null && child.kind === "Parameter")
    ? boundary.body : parent.body,
    lexicalBody: boundary !== null && entersRoot ? boundary.body : parent.lexicalBody,
    callableBody: boundary?.kind === "function" ? boundary.body : parent.callableBody };
}

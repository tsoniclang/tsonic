import type { BodyId, DefId, NodeId } from "../ids/contract.js";
import { decodeBodyId, encodeBodyId } from "../ids/index.js";
import { throwInvariant } from "../diag/index.js";
import type { SyntaxNode, SyntaxPhase } from "../ir-hir/contract.js";
import type { RawLayoutSelector, RawModule, RawNodeRef } from "./contract.js";

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
  definitions: ReadonlyMap<NodeId, DefId>, layout: LayoutSourceRoles | null): SourceBodyTransition {
  if (node.kind === "ArrowFunction" && layout?.selectors.has(node.id) === true)
    return { ...scope, boundary: null };
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

export interface LayoutSelectorRole {
  readonly call: RawNodeRef;
  readonly selector: RawLayoutSelector;
}

export interface LayoutSourceRoles {
  readonly declarations: ReadonlySet<NodeId>;
  readonly operands: ReadonlyMap<NodeId, NodeId>;
  readonly quotes: ReadonlyMap<NodeId, NodeId>;
  readonly selectors: ReadonlyMap<NodeId, LayoutSelectorRole>;
}

export function layoutSourceRoles(raw: RawModule): LayoutSourceRoles | null {
  let selectors: Map<NodeId, LayoutSelectorRole> | null = null;
  const addSelector = (call: RawNodeRef, selector: RawLayoutSelector): void => {
    if (call.module !== raw.module || selector.expression.module !== raw.module || selectors?.has(selector.expression.node) === true)
      return throwInvariant({ owner: "front", query: null, origin: null,
        message: "A layout selector belongs once to its actual selected call and source module." });
    (selectors ??= new Map()).set(selector.expression.node, { call, selector });
  };
  for (const call of raw.calls) {
    const row = raw.core[call.invocation.node];
    const observation = row?.layoutQuery.kind === "available" ? row.layoutQuery.value : null;
    if (observation?.operation !== "field-offset") continue;
    if (row === undefined || row.node.node !== call.invocation.node || row.node.module !== raw.module
      || observation.application.invocation.node !== call.invocation.node || observation.application.invocation.module !== raw.module)
      return throwInvariant({ owner: "front", query: null, origin: null,
        message: "A field query selector must come from the actual call's captured core association." });
    addSelector(call.invocation, observation.selector);
  }
  if (raw.types.memoryDescriptors.length === 0 && selectors === null) return null;
  const declarations = new Set<NodeId>();
  const operands = new Map<NodeId, NodeId>();
  const quotes = new Map<NodeId, NodeId>();
  for (const descriptor of raw.types.memoryDescriptors) {
    const invocation = descriptor.application.invocation;
    if (invocation.module !== raw.module || declarations.has(invocation.node))
      return throwInvariant({ owner: "front", query: null, origin: null,
        message: "A layout declaration belongs once to its actual captured constructor occurrence." });
    declarations.add(invocation.node);
    if (descriptor.construction === "field") addSelector(invocation, descriptor.selector);
    const quotesOf = descriptor.construction === "value" ? [descriptor.descriptor, descriptor.fieldList] : [descriptor.descriptor];
    for (const quote of quotesOf) {
      if (quote.module !== raw.module || quotes.has(quote.node))
        return throwInvariant({ owner: "front", query: null, origin: null, message: "A layout quote belongs to its actual selected constructor." });
      quotes.set(quote.node, invocation.node);
    }
    const selected = descriptor.construction === "field" ? [descriptor.byteOffset, descriptor.byteAlignment]
      : [descriptor.geometry.byteSize, descriptor.geometry.byteAlignment, descriptor.geometry.stride];
    if (descriptor.construction === "array") selected.push(descriptor.length);
    for (const operand of selected) {
      const expression = operand.expression;
      if (expression.module !== raw.module || operands.has(expression.node))
        return throwInvariant({ owner: "front", query: null, origin: null,
          message: "A layout constant operand must retain its one actual construction and authored occurrence." });
      operands.set(expression.node, operand.parent);
    }
  }
  return { declarations, operands, quotes, selectors: selectors ?? new Map() };
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

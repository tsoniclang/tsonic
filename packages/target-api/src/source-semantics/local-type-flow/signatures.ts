import type { AstReader, Node } from "@tsonic/tsts";
import { Node_Expression, Node_Initializer } from "../../source-model/ast.js";
import { sourceEnclosing } from "../../source-model/callable-boundaries.js";
import { createSourceTypeFlowDeclaredSlotReader } from "./declared-slots.js";
import type {
  SourceTypeFlowAnalysisContext,
  SourceTypeFlowGraph,
  SourceTypeFlowPathPart,
  SourceTypeFlowSignature,
  SourceTypeFlowVariable,
} from "./types.js";

interface SignatureOrigin {
  readonly site: Node;
  readonly owner: Node;
}

interface SignatureVariable {
  readonly variable: SourceTypeFlowVariable;
  readonly dependencies: Set<SignatureVariable>;
  origin?: SignatureOrigin;
}

interface SignatureVariablePath {
  readonly members: Map<string, SignatureVariablePath>;
  readonly binders: Map<Node, SignatureVariablePath>;
  readonly tuples: Map<number, SignatureVariablePath>;
  element?: SignatureVariablePath;
  optionalValue?: SignatureVariablePath;
  value?: SignatureVariable;
}

function variablePath(): SignatureVariablePath {
  return { members: new Map(), binders: new Map(), tuples: new Map() };
}

export function collectSourceTypeFlowSignatures(
  context: SourceTypeFlowAnalysisContext,
  graph: SourceTypeFlowGraph,
  isInference: (variable: SourceTypeFlowVariable) => boolean,
): readonly SourceTypeFlowSignature[] {
  const variables = new Map<Node, SignatureVariablePath>();
  const entries: SignatureVariable[] = [];
  const seeds: { readonly variable: SignatureVariable; readonly origin: SignatureOrigin }[] = [];
  const { ast } = context.source;
  const declaredSlots = createSourceTypeFlowDeclaredSlotReader(context);

  const entry = (variable: SourceTypeFlowVariable): SignatureVariable => {
    let path = variables.get(variable.node);
    if (path === undefined) {
      path = variablePath();
      variables.set(variable.node, path);
    }
    for (const part of variable.path) {
      if (part.kind === "element") {
        path.element ??= variablePath();
        path = path.element;
      } else if (part.kind === "optional-value") {
        path.optionalValue ??= variablePath();
        path = path.optionalValue;
      } else {
        if (part.kind === "member") {
          let child = path.members.get(part.name);
          if (child === undefined) {
            child = variablePath();
            path.members.set(part.name, child);
          }
          path = child;
        } else if (part.kind === "tuple") {
          let child = path.tuples.get(part.index);
          if (child === undefined) {
            child = variablePath();
            path.tuples.set(part.index, child);
          }
          path = child;
        } else {
          let child = path.binders.get(part.declaration);
          if (child === undefined) {
            child = variablePath();
            path.binders.set(part.declaration, child);
          }
          path = child;
        }
      }
    }
    if (path.value === undefined) {
      path.value = { variable, dependencies: new Set() };
      entries.push(path.value);
    }
    return path.value;
  };

  const seed = (node: Node, variable: SourceTypeFlowVariable): void => {
    if (!isInference(variable)) return;
    const origin = signatureOrigin(ast, node, declaration =>
      context.source.navigation.declarationUseSummary(declaration).exported);
    if (origin !== undefined && declaredSlots.returned(origin.owner, context.input.at(origin.owner)) === undefined) {
      seeds.push({ variable: entry(variable), origin });
    }
  };

  for (const node of graph.nodes) {
    const selected = entry(node.variable);
    if (node.publish && node.kind !== "binder") {
      seed(node.node, node.variable);
      if (node.initializer !== undefined) seed(node.initializer, node.variable);
    }
    if (node.term?.kind === "array") selected.dependencies.add(entry(node.term.element));
    if (node.term?.kind === "optional") selected.dependencies.add(entry(node.term.value));
    if (node.term?.kind === "tuple") {
      for (const element of node.term.elements) selected.dependencies.add(entry(element.variable));
    }
    if (node.term?.kind === "declared") {
      for (const argument of node.term.typeArguments) selected.dependencies.add(entry(argument));
    }
    if (node.term?.kind === "shape") {
      for (const member of node.term.members) selected.dependencies.add(entry(member.variable));
    }
  }
  for (const link of graph.links) {
    const source = entry(link.source);
    const target = entry(link.target);
    source.dependencies.add(target);
    target.dependencies.add(source);
  }
  for (const derived of graph.derived) {
    const result = entry(derived.result);
    seed(derived.node, derived.result);
    for (const operand of derived.operands) result.dependencies.add(entry(operand));
  }
  for (const call of graph.calls) {
    if (call.result !== undefined) seed(call.node, call.result);
  }

  const compareNodes = (left: Node, right: Node): number => {
    const first = context.order(left);
    const second = context.order(right);
    return first.start - second.start || first.preorder - second.preorder;
  };
  seeds.sort((left, right) => compareNodes(left.origin.site, right.origin.site) ||
    compareNodes(left.origin.owner, right.origin.owner));
  for (const selected of seeds) {
    const pending = [selected.variable];
    while (pending.length > 0) {
      const current = pending.pop()!;
      if (current.origin !== undefined || !isInference(current.variable)) continue;
      current.origin = selected.origin;
      for (const dependency of current.dependencies) pending.push(dependency);
    }
  }

  return Object.freeze(entries.filter(selected => selected.origin !== undefined)
    .map(selected => Object.freeze({ ...selected.origin!, variable: selected.variable }))
    .sort((left, right) => compareNodes(left.site, right.site) ||
      compareNodes(left.variable.node, right.variable.node) ||
      comparePaths(left.variable.path, right.variable.path, compareNodes)));
}

function signatureOrigin(
  ast: AstReader,
  node: Node,
  exported: (declaration: Node) => boolean,
): SignatureOrigin | undefined {
  if ((ast.is.IsParameterDeclaration(node) || ast.is.IsPropertyDeclaration(node)) &&
    Node_Initializer(ast, node) !== undefined) return initializerSignature(ast, node);
  if (ast.is.IsVariableDeclaration(node) && exported(node)) {
    return { site: node, owner: node };
  }
  let current = node;
  for (;;) {
    const parent = ast.parent(current);
    if (parent === undefined) return undefined;
    if ((ast.is.IsParenthesizedExpression(parent) || ast.is.IsNonNullExpression(parent) ||
      ast.is.IsAwaitExpression(parent)) && Node_Expression(ast, parent) === current) {
      current = parent;
      continue;
    }
    if ((ast.is.IsReturnStatement(parent) || ast.is.IsYieldExpression(parent)) &&
      Node_Expression(ast, parent) === current) {
      // The callable whose body the return / yield completes (E13 purpose callable-body, Q5).
      const owner = sourceEnclosing(ast, parent, "callable-body");
      return owner !== undefined && ast.typeNode(owner) === undefined && !inlineArgument(ast, owner)
        ? { site: parent, owner } : undefined;
    }
    if (ast.is.IsArrowFunction(parent) && ast.body(parent) === current) {
      return ast.typeNode(parent) === undefined && !inlineArgument(ast, parent)
        ? { site: parent, owner: parent } : undefined;
    }
    if ((ast.is.IsParameterDeclaration(parent) || ast.is.IsPropertyDeclaration(parent)) &&
      Node_Initializer(ast, parent) === current) return initializerSignature(ast, parent);
    if (ast.is.IsExportAssignment(parent) && Node_Expression(ast, parent) === current) {
      return { site: parent, owner: parent };
    }
    return ast.is.IsVariableDeclaration(parent) && Node_Initializer(ast, parent) === current &&
      exported(parent) ? { site: parent, owner: parent } : undefined;
  }
}

function initializerSignature(ast: AstReader, declaration: Node): SignatureOrigin | undefined {
  if (ast.typeNode(declaration) !== undefined) return undefined;
  if (ast.is.IsParameterDeclaration(declaration)) {
    // The signature that declares the parameter (E13 purpose callable-signature).
    const owner = sourceEnclosing(ast, declaration, "callable-signature");
    if (owner === undefined || inlineArgument(ast, owner)) return undefined;
  }
  return { site: declaration, owner: declaration };
}

function inlineArgument(ast: AstReader, callable: Node): boolean {
  if (!ast.is.IsArrowFunction(callable) && !ast.is.IsFunctionExpression(callable)) return false;
  let current = callable;
  for (;;) {
    const parent = ast.parent(current);
    if (parent === undefined) return false;
    if ((ast.is.IsParenthesizedExpression(parent) || ast.is.IsAsExpression(parent) ||
      ast.is.IsSatisfiesExpression(parent)) && Node_Expression(ast, parent) === current) {
      current = parent;
      continue;
    }
    return (ast.is.IsCallExpression(parent) || ast.is.IsNewExpression(parent)) &&
      ast.arguments(parent).some(argument => argument === current);
  }
}

function comparePaths(
  left: readonly SourceTypeFlowPathPart[],
  right: readonly SourceTypeFlowPathPart[],
  compareNodes: (left: Node, right: Node) => number,
): number {
  for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
    const first = left[index]!;
    const second = right[index]!;
    if (first.kind !== second.kind) return first.kind < second.kind ? -1 : 1;
    if (first.kind === "member" && second.kind === "member" && first.name !== second.name) {
      return first.name < second.name ? -1 : 1;
    }
    if (first.kind === "tuple" && second.kind === "tuple" && first.index !== second.index) {
      return first.index - second.index;
    }
    if (first.kind === "binder" && second.kind === "binder") {
      const comparison = compareNodes(first.declaration, second.declaration);
      if (comparison !== 0) return comparison;
    }
  }
  return left.length - right.length;
}

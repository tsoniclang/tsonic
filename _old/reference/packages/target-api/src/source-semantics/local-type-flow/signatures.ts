import type { AstReader, Node } from "@tsonic/tsts";
import { Node_Expression, Node_Initializer } from "../../source-navigation/ast.js";
import { createSourceTypeFlowVariableIndex } from "./variable-index.js";
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

export function collectSourceTypeFlowSignatures(
  context: SourceTypeFlowAnalysisContext,
  graph: SourceTypeFlowGraph,
  isInference: (variable: SourceTypeFlowVariable) => boolean,
): readonly SourceTypeFlowSignature[] {
  const entries: SignatureVariable[] = [];
  const seeds: { readonly variable: SignatureVariable; readonly origin: SignatureOrigin }[] = [];
  const { ast } = context.source;

  const entry = createSourceTypeFlowVariableIndex<SignatureVariable>(variable => {
    const selected: SignatureVariable = { variable, dependencies: new Set() };
    entries.push(selected);
    return selected;
  });

  const seed = (node: Node, variable: SourceTypeFlowVariable): void => {
    if (!isInference(variable)) return;
    const origin = signatureOrigin(ast, context.source.navigation, node, declaration =>
      context.source.navigation.declarationUseSummary(declaration).exported);
    if (origin !== undefined && ast.typeNode(origin.owner) === undefined) {
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
  for (const input of graph.producerInputs) entry(input.target).dependencies.add(entry(input.source));
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
  navigation: SourceTypeFlowAnalysisContext["source"]["navigation"],
  node: Node,
  exported: (declaration: Node) => boolean,
): SignatureOrigin | undefined {
  if ((ast.is.IsParameterDeclaration(node) || ast.is.IsPropertyDeclaration(node)) &&
    Node_Initializer(ast, node) !== undefined) return initializerSignature(ast, navigation, node);
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
      const owner = navigation.enclosing(parent, "body");
      return owner !== undefined && ast.typeNode(owner) === undefined
        ? { site: parent, owner } : undefined;
    }
    if (ast.is.IsArrowFunction(parent) && ast.body(parent) === current) {
      return ast.typeNode(parent) === undefined
        ? { site: parent, owner: parent } : undefined;
    }
    if ((ast.is.IsParameterDeclaration(parent) || ast.is.IsPropertyDeclaration(parent)) &&
      Node_Initializer(ast, parent) === current) return initializerSignature(ast, navigation, parent);
    if (ast.is.IsExportAssignment(parent) && Node_Expression(ast, parent) === current) {
      return { site: parent, owner: parent };
    }
    return ast.is.IsVariableDeclaration(parent) && Node_Initializer(ast, parent) === current &&
      exported(parent) ? { site: parent, owner: parent } : undefined;
  }
}

function initializerSignature(ast: AstReader, navigation: SourceTypeFlowAnalysisContext["source"]["navigation"], declaration: Node): SignatureOrigin | undefined {
  if (ast.typeNode(declaration) !== undefined) return undefined;
  if (ast.is.IsParameterDeclaration(declaration)) {
    const owner = navigation.enclosing(declaration, "body");
    if (owner === undefined) return undefined;
  }
  return { site: declaration, owner: declaration };
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

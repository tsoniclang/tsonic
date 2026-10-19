import type { AstReader, Node } from "@tsonic/tsts";
import { sourceControlTransferTarget } from "../../source-navigation/control-targets.js";

export interface SourceStatementExitFacts {
  readonly erased: (node: Node) => boolean;
  readonly expressionExits: (node: Node) => boolean;
  readonly guardResult: (node: Node) => boolean | undefined;
}

export function analyzeSourceStatementExits(
  ast: AstReader,
  nodes: readonly Node[],
  facts: SourceStatementExitFacts,
): ReadonlyMap<Node, boolean> {
  const breaks = new Set<Node>();
  const continues = new Set<Node>();
  for (const node of nodes) {
    if (facts.erased(node)) continue;
    if (!ast.is.IsBreakStatement(node) && !ast.is.IsContinueStatement(node)) continue;
    const target = sourceControlTransferTarget(ast, node);
    if (target !== undefined) (ast.is.IsBreakStatement(node) ? breaks : continues).add(target);
  }
  const exits = new Map<Node, boolean>();
  const sequence = (node: Node): readonly (Node | undefined)[] =>
    ast.is.IsCaseClause(node) || ast.is.IsDefaultClause(node)
      ? ast.as.AsCaseOrDefaultClause(node)?.Statements?.Nodes ?? [] : ast.statements(node);
  const clauses = (node: Node): readonly (Node | undefined)[] => {
    const block = ast.as.AsSwitchStatement(node)?.CaseBlock;
    return block === undefined ? [] : ast.as.AsCaseBlock(block)?.Clauses?.Nodes ?? [];
  };
  const children = (node: Node): readonly (Node | undefined)[] => {
    if (facts.erased(node)) return [];
    switch (ast.kindName(node)) {
      case "KindBlock": case "KindSourceFile": case "KindCaseClause": case "KindDefaultClause":
        return sequence(node);
      case "KindIfStatement": {
        const statement = ast.as.AsIfStatement(node);
        return [statement?.ThenStatement, statement?.ElseStatement];
      }
      case "KindTryStatement": {
        const statement = ast.as.AsTryStatement(node);
        const caught = statement?.CatchClause;
        return [statement?.TryBlock, caught === undefined ? undefined : ast.as.AsCatchClause(caught)?.Block,
          statement?.FinallyBlock];
      }
      case "KindLabeledStatement": return [ast.as.AsLabeledStatement(node)?.Statement];
      case "KindSwitchStatement": return clauses(node);
      case "KindDoStatement": return [ast.as.AsDoStatement(node)?.Statement];
      default: return [];
    }
  };
  const knownGuard = (node: Node | undefined): boolean | undefined => {
    if (node === undefined) return undefined;
    const selected = facts.guardResult(node);
    if (selected !== undefined) return selected;
    return ast.kindName(node) === "KindTrueKeyword" ? true
      : ast.kindName(node) === "KindFalseKeyword" ? false : undefined;
  };
  const hasLoopBreak = (node: Node): boolean => {
    if (breaks.has(node)) return true;
    for (let parent = ast.parent(node); parent !== undefined && ast.is.IsLabeledStatement(parent);
      parent = ast.parent(parent)) {
      if (breaks.has(parent)) return true;
    }
    return false;
  };
  const selectedExits = (node: Node | undefined): boolean => node !== undefined && exits.get(node) === true;
  const expressionExits = (node: Node | undefined): boolean => node !== undefined && facts.expressionExits(node);
  const evaluate = (node: Node): boolean => {
    if (facts.erased(node)) return false;
    switch (ast.kindName(node)) {
      case "KindReturnStatement": case "KindThrowStatement": case "KindBreakStatement": case "KindContinueStatement":
        return true;
      case "KindBlock": case "KindSourceFile": case "KindCaseClause": case "KindDefaultClause":
        return sequence(node).some(selectedExits);
      case "KindExpressionStatement": return expressionExits(ast.as.AsExpressionStatement(node)?.Expression);
      case "KindVariableStatement": {
        const list = ast.as.AsVariableStatement(node)?.DeclarationList;
        const declarations = list === undefined ? [] : ast.as.AsVariableDeclarationList(list)?.Declarations?.Nodes ?? [];
        return declarations.some(declaration => declaration !== undefined &&
          expressionExits(ast.as.AsVariableDeclaration(declaration)?.Initializer));
      }
      case "KindIfStatement": {
        const statement = ast.as.AsIfStatement(node);
        if (expressionExits(statement?.Expression)) return true;
        const guard = knownGuard(statement?.Expression);
        return guard === undefined ? selectedExits(statement?.ThenStatement) && selectedExits(statement?.ElseStatement)
          : selectedExits(guard ? statement?.ThenStatement : statement?.ElseStatement);
      }
      case "KindTryStatement": {
        const statement = ast.as.AsTryStatement(node);
        const caught = statement?.CatchClause;
        return selectedExits(statement?.FinallyBlock) || selectedExits(statement?.TryBlock) &&
          (caught === undefined || selectedExits(ast.as.AsCatchClause(caught)?.Block));
      }
      case "KindLabeledStatement":
        return !breaks.has(node) && selectedExits(ast.as.AsLabeledStatement(node)?.Statement);
      case "KindSwitchStatement": {
        if (expressionExits(ast.as.AsSwitchStatement(node)?.Expression)) return true;
        const selected = clauses(node);
        return !breaks.has(node) && selected.some(clause => clause !== undefined && ast.is.IsDefaultClause(clause)) &&
          selectedExits(selected[selected.length - 1]);
      }
      case "KindWhileStatement": {
        const condition = ast.as.AsWhileStatement(node)?.Expression;
        return expressionExits(condition) || knownGuard(condition) === true && !hasLoopBreak(node);
      }
      case "KindForStatement": {
        const statement = ast.as.AsForStatement(node);
        return expressionExits(statement?.Initializer) || expressionExits(statement?.Condition) ||
          (statement?.Condition === undefined || knownGuard(statement.Condition) === true) && !hasLoopBreak(node);
      }
      case "KindDoStatement": {
        const statement = ast.as.AsDoStatement(node);
        return !hasLoopBreak(node) && (knownGuard(statement?.Expression) === true ||
          selectedExits(statement?.Statement) && !continues.has(node));
      }
      default: return false;
    }
  };
  const pending: { readonly node: Node; readonly expanded: boolean }[] = [];
  for (const node of nodes) {
    if (ast.is.IsBlock(node) || ast.is.IsCaseClause(node) || ast.is.IsDefaultClause(node)) {
      pending.push({ node, expanded: false });
    }
  }
  while (pending.length > 0) {
    const current = pending.pop()!;
    if (exits.has(current.node)) continue;
    if (!current.expanded) {
      pending.push({ node: current.node, expanded: true });
      for (const child of children(current.node)) {
        if (child !== undefined && !exits.has(child)) pending.push({ node: child, expanded: false });
      }
    } else exits.set(current.node, evaluate(current.node));
  }
  return exits;
}

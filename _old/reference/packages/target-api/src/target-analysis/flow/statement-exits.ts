import { AsCaseBlock, AsCatchClause, AsDoStatement, AsExpressionStatement, AsForInOrOfStatement, AsForStatement, AsIfStatement, AsLabeledStatement, AsSwitchStatement, AsTryStatement, AsVariableDeclaration, AsVariableDeclarationList, AsVariableStatement, AsWhileStatement } from "../../source-navigation/checked-casts.js";
import type { AstReader, Node } from "@tsonic/tsts";
import { sourceControlTransferTarget } from "../../source-navigation/control-targets.js";

export interface SourceStatementExitFacts {
  readonly erased: (node: Node) => boolean;
  readonly expressionExits: (node: Node) => boolean;
  readonly guardResult: (node: Node) => boolean | undefined;
  readonly controlTarget?: (node: Node) => Node | undefined;
  readonly continueFallsThrough?: (node: Node, target: Node | undefined) => boolean;
  /**
   * Whether a switch without a default clause has a case for every value of its checked discriminant
   * (`createSourceSwitchCoverage`). Without this fact such a switch keeps its normal fallthrough exit.
   */
  readonly switchCoversDiscriminant?: (node: Node) => boolean;
}

export function analyzeSourceStatementExits(
  ast: AstReader,
  nodes: readonly Node[],
  facts: SourceStatementExitFacts,
): ReadonlyMap<Node, boolean> {
  const breaks = new Set<Node>();
  const continues = new Set<Node>();
  const controlNodes = [...nodes];
  const seenControlNodes = new Set<Node>();
  while (controlNodes.length > 0) {
    const node = controlNodes.pop()!;
    if (seenControlNodes.has(node) || facts.erased(node)) continue;
    seenControlNodes.add(node);
    if (ast.is.IsBreakStatement(node) || ast.is.IsContinueStatement(node)) {
      const target = facts.controlTarget === undefined ? sourceControlTransferTarget(ast, node) : facts.controlTarget(node);
      if (target !== undefined) (ast.is.IsBreakStatement(node) ? breaks : continues).add(target);
    }
    ast.forEachChild(node, child => { if (child !== undefined) controlNodes.push(child); });
  }
  const exits = new Map<Node, boolean>();
  const sequence = (node: Node): readonly (Node | undefined)[] =>
    ast.is.IsCaseClause(node) || ast.is.IsDefaultClause(node)
      ? ast.as.AsCaseOrDefaultClause(node)?.Statements?.Nodes ?? [] : ast.statements(node);
  const clauses = (node: Node): readonly (Node | undefined)[] => {
    const block = AsSwitchStatement(ast, node)?.CaseBlock;
    return block === undefined ? [] : AsCaseBlock(ast, block)?.Clauses?.Nodes ?? [];
  };
  const children = (node: Node): readonly (Node | undefined)[] => {
    if (facts.erased(node)) return [];
    switch (ast.kindName(node)) {
      case "KindBlock": case "KindSourceFile": case "KindCaseClause": case "KindDefaultClause":
        return sequence(node);
      case "KindIfStatement": {
        const statement = AsIfStatement(ast, node);
        return [statement?.ThenStatement, statement?.ElseStatement];
      }
      case "KindTryStatement": {
        const statement = AsTryStatement(ast, node);
        const caught = statement?.CatchClause;
        return [statement?.TryBlock, caught === undefined ? undefined : AsCatchClause(ast, caught)?.Block,
          statement?.FinallyBlock];
      }
      case "KindLabeledStatement": return [AsLabeledStatement(ast, node)?.Statement];
      case "KindSwitchStatement": return clauses(node);
      case "KindDoStatement": return [AsDoStatement(ast, node)?.Statement];
      case "KindWhileStatement": return [AsWhileStatement(ast, node)?.Statement];
      case "KindForStatement": return [AsForStatement(ast, node)?.Statement];
      case "KindForInStatement": case "KindForOfStatement": return [AsForInOrOfStatement(ast, node)?.Statement];
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
      case "KindReturnStatement": case "KindThrowStatement": case "KindBreakStatement":
        return true;
      case "KindContinueStatement": {
        const target = facts.controlTarget === undefined ? sourceControlTransferTarget(ast, node) : facts.controlTarget(node);
        return facts.continueFallsThrough?.(node, target) !== true;
      }
      case "KindBlock": case "KindSourceFile": case "KindCaseClause": case "KindDefaultClause":
        return sequence(node).some(selectedExits);
      case "KindExpressionStatement": return expressionExits(AsExpressionStatement(ast, node)?.Expression);
      case "KindVariableStatement": {
        const list = AsVariableStatement(ast, node)?.DeclarationList;
        const declarations = list === undefined ? [] : AsVariableDeclarationList(ast, list)?.Declarations?.Nodes ?? [];
        return declarations.some(declaration => declaration !== undefined &&
          expressionExits(AsVariableDeclaration(ast, declaration)?.Initializer));
      }
      case "KindIfStatement": {
        const statement = AsIfStatement(ast, node);
        if (expressionExits(statement?.Expression)) return true;
        const guard = knownGuard(statement?.Expression);
        return guard === undefined ? selectedExits(statement?.ThenStatement) && selectedExits(statement?.ElseStatement)
          : selectedExits(guard ? statement?.ThenStatement : statement?.ElseStatement);
      }
      case "KindTryStatement": {
        const statement = AsTryStatement(ast, node);
        const caught = statement?.CatchClause;
        return selectedExits(statement?.FinallyBlock) || selectedExits(statement?.TryBlock) &&
          (caught === undefined || selectedExits(AsCatchClause(ast, caught)?.Block));
      }
      case "KindLabeledStatement":
        return !breaks.has(node) && selectedExits(AsLabeledStatement(ast, node)?.Statement);
      case "KindSwitchStatement": {
        if (expressionExits(AsSwitchStatement(ast, node)?.Expression)) return true;
        const selected = clauses(node);
        // Every entered clause falls through to the last one, so the switch exits when that clause exits and some
        // clause is always entered: a default clause exists or the cases cover every discriminant value.
        const entered = selected.some(clause => clause !== undefined && ast.is.IsDefaultClause(clause)) ||
          facts.switchCoversDiscriminant?.(node) === true;
        return !breaks.has(node) && entered && selectedExits(selected[selected.length - 1]);
      }
      case "KindWhileStatement": {
        const condition = AsWhileStatement(ast, node)?.Expression;
        return expressionExits(condition) || knownGuard(condition) === true && !hasLoopBreak(node);
      }
      case "KindForStatement": {
        const statement = AsForStatement(ast, node);
        return expressionExits(statement?.Initializer) || expressionExits(statement?.Condition) ||
          (statement?.Condition === undefined || knownGuard(statement.Condition) === true) && !hasLoopBreak(node);
      }
      case "KindDoStatement": {
        const statement = AsDoStatement(ast, node);
        return !hasLoopBreak(node) && (knownGuard(statement?.Expression) === true ||
          selectedExits(statement?.Statement) && !continues.has(node));
      }
      default: return false;
    }
  };
  const pending: { readonly node: Node; readonly expanded: boolean }[] = [];
  for (const node of nodes) {
    if (statementKinds.has(ast.kindName(node))) {
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

const statementKinds: ReadonlySet<string> = new Set([
  "KindSourceFile", "KindBlock", "KindCaseClause", "KindDefaultClause", "KindFunctionDeclaration",
  "KindClassDeclaration", "KindTypeAliasDeclaration", "KindVariableStatement", "KindExpressionStatement",
  "KindReturnStatement", "KindThrowStatement", "KindBreakStatement", "KindContinueStatement", "KindIfStatement",
  "KindWhileStatement", "KindDoStatement", "KindForStatement", "KindForInStatement", "KindForOfStatement",
  "KindLabeledStatement", "KindSwitchStatement", "KindTryStatement", "KindEmptyStatement", "KindDebuggerStatement",
]);

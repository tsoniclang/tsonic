import type { AstReader, Node, Symbol } from "@tsonic/tsts";
import type {
  SourceBindingWrite,
  SourceCountedLoop,
  SourceDeclarationReference,
} from "./types.js";

export function sourceCountedLoop(
  ast: AstReader,
  statement: Node,
  sourceReferenceFor: (node: Node | undefined) => SourceDeclarationReference | undefined,
  bindingWritesWithin: (symbol: Symbol, root: Node) => readonly SourceBindingWrite[],
): SourceCountedLoop | undefined {
  if (!ast.is.IsForStatement(statement)) {
    return undefined;
  }
  const loop = ast.as.AsForStatement(statement);
  const initializer = loop?.Initializer;
  const condition = loop?.Condition;
  const incrementor = loop?.Incrementor;
  const body = loop?.Statement;
  if (initializer === undefined || condition === undefined || incrementor === undefined ||
    body === undefined || !ast.is.IsVariableDeclarationList(initializer) ||
    ast.variableDeclarationKind(initializer) !== "let") {
    return undefined;
  }
  const declarationSlots = ast.as.AsVariableDeclarationList(initializer)?.Declarations?.Nodes;
  const counterDeclaration = declarationSlots?.length === 1 ? declarationSlots[0] : undefined;
  const counterName = counterDeclaration === undefined ? undefined : ast.name(counterDeclaration);
  const start = counterDeclaration === undefined || !ast.is.IsVariableDeclaration(counterDeclaration)
    ? undefined
    : ast.as.AsVariableDeclaration(counterDeclaration)?.Initializer;
  if (counterDeclaration === undefined || counterName === undefined || start === undefined ||
    !ast.is.IsIdentifier(counterName) || !ast.is.IsBinaryExpression(condition) ||
    ast.operatorKindName(condition) !== "KindLessThanToken") {
    return undefined;
  }
  const comparison = ast.as.AsBinaryExpression(condition);
  const counterReference = comparison?.Left;
  const bound = comparison?.Right;
  const selectedCounter = sourceReferenceFor(counterReference);
  if (counterReference === undefined || bound === undefined ||
    selectedCounter === undefined ||
    selectedCounter.symbol === undefined ||
    selectedCounter.declaration !== counterDeclaration ||
    sourceContainsDeclarationReference(
      ast,
      bound,
      counterDeclaration,
      sourceReferenceFor,
    )) {
    return undefined;
  }
  const incrementOperand = ast.is.IsPostfixUnaryExpression(incrementor)
    ? ast.as.AsPostfixUnaryExpression(incrementor)?.Operand
    : ast.is.IsPrefixUnaryExpression(incrementor)
      ? ast.as.AsPrefixUnaryExpression(incrementor)?.Operand
      : undefined;
  if (incrementOperand === undefined ||
    ast.operatorKindName(incrementor) !== "KindPlusPlusToken" ||
    sourceReferenceFor(incrementOperand)?.declaration !== counterDeclaration ||
    bindingWritesWithin(selectedCounter.symbol, body).length !== 0) {
    return undefined;
  }
  return Object.freeze({
    statement,
    counterDeclaration,
    counterSymbol: selectedCounter.symbol,
    start,
    bound,
    body,
    direction: "ascending",
    comparison: "exclusive-upper-bound",
    step: 1,
  });
}

function sourceContainsDeclarationReference(
  ast: AstReader,
  root: Node,
  declaration: Node,
  sourceReferenceFor: (node: Node | undefined) => SourceDeclarationReference | undefined,
): boolean {
  let found = false;
  const visit = (node: Node | undefined): void => {
    if (node === undefined || found) {
      return;
    }
    const selected = sourceReferenceFor(node);
    if (selected?.declaration === declaration) {
      found = true;
      return;
    }
    ast.forEachChild(node, visit);
  };
  visit(root);
  return found;
}

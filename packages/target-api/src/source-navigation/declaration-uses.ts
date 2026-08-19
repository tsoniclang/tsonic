import type { AstReader, Node } from "@tsonic/tsts";
import type { SourceDeclarationUse } from "./types.js";
import { sourceNodesEqual } from "./identity.js";
import { Node_Expression } from "./ast.js";
import { isTypeSyntaxNode } from "./syntax.js";

const sourceLinkageKinds = new Set([
  "KindImportSpecifier",
  "KindImportClause",
  "KindNamespaceImport",
  "KindNamedImports",
  "KindImportDeclaration",
  "KindExportSpecifier",
  "KindNamedExports",
  "KindNamespaceExport",
  "KindExportDeclaration",
]);

export function sourceDeclarationUses(
  ast: AstReader,
  declaration: Node,
  references: readonly Node[],
): readonly SourceDeclarationUse[] {
  return Object.freeze(references.map((reference) => {
    const kind = sourceDeclarationUseKind(ast, reference);
    const role = sourceDeclarationUseRole(ast, reference);
    return Object.freeze({
      reference,
      kind,
      role: role.role,
      captured: kind === "direct-call" || kind === "first-class"
        ? sourceReferenceIsCaptured(ast, declaration, reference)
        : false,
      throughMember: role.throughMember,
    });
  }));
}

function sourceDeclarationUseKind(
  ast: AstReader,
  reference: Node,
): SourceDeclarationUse["kind"] {
  if (belongsToSourceLinkage(ast, reference)) {
    return "source-linkage";
  }
  if (belongsToTypeSyntax(ast, reference)) {
    return "type-only";
  }
  let target = reference;
  let parent = ast.parent(target);
  if (parent !== undefined && ast.is.IsPropertyAccessExpression(parent) &&
    sourceNodesEqual(ast, ast.name(parent), target)) {
    target = parent;
    parent = ast.parent(target);
  }
  while (parent !== undefined && transparentExpressionContains(ast, parent, target)) {
    target = parent;
    parent = ast.parent(target);
  }
  return parent !== undefined && ast.is.IsCallExpression(parent) &&
      sourceNodesEqual(ast, Node_Expression(ast, parent), target)
    ? "direct-call"
    : "first-class";
}

function belongsToSourceLinkage(ast: AstReader, reference: Node): boolean {
  let current: Node | undefined = reference;
  while (current !== undefined) {
    const kind = ast.kindName(current);
    if (sourceLinkageKinds.has(kind)) {
      return true;
    }
    if (ast.is.IsSourceFile(current)) {
      return false;
    }
    current = ast.parent(current);
  }
  return false;
}

function sourceDeclarationUseRole(
  ast: AstReader,
  reference: Node,
): Pick<SourceDeclarationUse, "role" | "throughMember"> {
  if (belongsToSourceLinkage(ast, reference)) {
    return { role: "source-linkage", throughMember: false };
  }
  if (belongsToTypeSyntax(ast, reference)) {
    return { role: "type-only", throughMember: false };
  }
  let current = reference;
  let receiverPath = false;
  for (;;) {
    const parent = ast.parent(current);
    if (parent === undefined) {
      return { role: receiverPath ? "receiver" : "value", throughMember: receiverPath };
    }
    if (transparentExpressionContains(ast, parent, current)) {
      current = parent;
      continue;
    }
    if (ast.is.IsPropertyAccessExpression(parent)) {
      const access = ast.as.AsPropertyAccessExpression(parent);
      if (sourceNodesEqual(ast, access?.Expression, current)) {
        receiverPath = true;
        current = parent;
        continue;
      }
      if (sourceNodesEqual(ast, ast.name(parent), current)) {
        receiverPath = true;
        current = parent;
        continue;
      }
      return { role: "value", throughMember: receiverPath };
    }
    if (ast.is.IsElementAccessExpression(parent)) {
      const access = ast.as.AsElementAccessExpression(parent);
      if (sourceNodesEqual(ast, access?.Expression, current)) {
        receiverPath = true;
        current = parent;
        continue;
      }
      return { role: "value", throughMember: receiverPath };
    }
    if (ast.is.IsCallExpression(parent)) {
      if (sourceNodesEqual(ast, Node_Expression(ast, parent), current)) {
        return {
          role: receiverPath ? "receiver" : "call-target",
          throughMember: receiverPath,
        };
      }
      return {
        role: ast.arguments(parent).some((argument) =>
        sourceNodesEqual(ast, argument, current))
          ? "argument"
          : "value",
        throughMember: receiverPath,
      };
    }
    if (ast.is.IsNewExpression(parent)) {
      if (sourceNodesEqual(ast, Node_Expression(ast, parent), current)) {
        return {
          role: receiverPath ? "receiver" : "call-target",
          throughMember: receiverPath,
        };
      }
      return {
        role: ast.arguments(parent).some((argument) =>
        sourceNodesEqual(ast, argument, current))
          ? "argument"
          : "value",
        throughMember: receiverPath,
      };
    }
    if (ast.is.IsReturnStatement(parent)) {
      return { role: "return", throughMember: receiverPath };
    }
    if (ast.is.IsYieldExpression(parent)) {
      return { role: "yield", throughMember: receiverPath };
    }
    if (sourceReferenceIsWriteTarget(ast, parent, current)) {
      return { role: "write", throughMember: receiverPath };
    }
    if (sourceReferenceIsStored(ast, parent, current)) {
      return { role: "storage", throughMember: receiverPath };
    }
    if (sourceReferenceIsCompared(ast, parent, current)) {
      return { role: "comparison", throughMember: receiverPath };
    }
    if (sourceReferenceIsCondition(ast, parent, current)) {
      return { role: "condition", throughMember: receiverPath };
    }
    return {
      role: receiverPath ? "receiver" : "value",
      throughMember: receiverPath,
    };
  }
}

function belongsToTypeSyntax(ast: AstReader, reference: Node): boolean {
  let current: Node | undefined = reference;
  while (current !== undefined) {
    if (ast.is.IsTypeQueryNode(current) || isTypeSyntaxNode(ast, current)) {
      return true;
    }
    if (ast.is.IsSourceFile(current)) {
      return false;
    }
    current = ast.parent(current);
  }
  return false;
}

function sourceReferenceIsWriteTarget(
  ast: AstReader,
  parent: Node,
  current: Node,
): boolean {
  if (ast.is.IsBinaryExpression(parent)) {
    const binary = ast.as.AsBinaryExpression(parent);
    return sourceNodesEqual(ast, binary?.Left, current) &&
      assignmentOperators.has(ast.operatorKindName(parent) ?? "");
  }
  if (ast.is.IsPrefixUnaryExpression(parent)) {
    const unary = ast.as.AsPrefixUnaryExpression(parent);
    return sourceNodesEqual(ast, unary?.Operand, current) &&
      updateOperators.has(ast.operatorKindName(parent) ?? "");
  }
  if (ast.is.IsPostfixUnaryExpression(parent)) {
    const unary = ast.as.AsPostfixUnaryExpression(parent);
    return sourceNodesEqual(ast, unary?.Operand, current) &&
      updateOperators.has(ast.operatorKindName(parent) ?? "");
  }
  if (ast.is.IsForInStatement(parent) || ast.is.IsForOfStatement(parent)) {
    return sourceNodesEqual(
      ast,
      ast.as.AsForInOrOfStatement(parent)?.Initializer,
      current,
    );
  }
  return false;
}

function sourceReferenceIsStored(
  ast: AstReader,
  parent: Node,
  current: Node,
): boolean {
  if (ast.is.IsVariableDeclaration(parent)) {
    return sourceNodesEqual(ast, ast.as.AsVariableDeclaration(parent)?.Initializer, current);
  }
  if (ast.is.IsPropertyDeclaration(parent)) {
    return sourceNodesEqual(ast, ast.as.AsPropertyDeclaration(parent)?.Initializer, current);
  }
  if (ast.is.IsPropertyAssignment(parent)) {
    return sourceNodesEqual(ast, ast.as.AsPropertyAssignment(parent)?.Initializer, current);
  }
  if (ast.is.IsShorthandPropertyAssignment(parent)) {
    return sourceNodesEqual(ast, ast.name(parent), current);
  }
  if (ast.is.IsArrayLiteralExpression(parent)) {
    return ast.elements(parent).some((element) => sourceNodesEqual(ast, element, current));
  }
  if (ast.is.IsObjectLiteralExpression(parent)) {
    return ast.properties(parent).some((property) => sourceNodesEqual(ast, property, current));
  }
  if (ast.is.IsBinaryExpression(parent)) {
    const binary = ast.as.AsBinaryExpression(parent);
    return sourceNodesEqual(ast, binary?.Right, current) &&
      assignmentOperators.has(ast.operatorKindName(parent) ?? "");
  }
  return false;
}

function sourceReferenceIsCondition(
  ast: AstReader,
  parent: Node,
  current: Node,
): boolean {
  if (ast.is.IsIfStatement(parent)) {
    return sourceNodesEqual(ast, ast.as.AsIfStatement(parent)?.Expression, current);
  }
  if (ast.is.IsWhileStatement(parent)) {
    return sourceNodesEqual(ast, ast.as.AsWhileStatement(parent)?.Expression, current);
  }
  if (ast.is.IsDoStatement(parent)) {
    return sourceNodesEqual(ast, ast.as.AsDoStatement(parent)?.Expression, current);
  }
  if (ast.is.IsConditionalExpression(parent)) {
    return sourceNodesEqual(ast, ast.as.AsConditionalExpression(parent)?.Condition, current);
  }
  if (ast.is.IsForStatement(parent)) {
    return sourceNodesEqual(ast, ast.as.AsForStatement(parent)?.Condition, current);
  }
  return false;
}

function sourceReferenceIsCompared(
  ast: AstReader,
  parent: Node,
  current: Node,
): boolean {
  if (!ast.is.IsBinaryExpression(parent) ||
    !comparisonOperators.has(ast.operatorKindName(parent) ?? "")) {
    return false;
  }
  const binary = ast.as.AsBinaryExpression(parent);
  return sourceNodesEqual(ast, binary?.Left, current) ||
    sourceNodesEqual(ast, binary?.Right, current);
}

function sourceReferenceIsCaptured(
  ast: AstReader,
  declaration: Node,
  reference: Node,
): boolean {
  const declarationOwner = enclosingCallable(ast, declaration);
  return declarationOwner !== undefined &&
    enclosingCallable(ast, reference) !== declarationOwner;
}

function enclosingCallable(ast: AstReader, node: Node): Node | undefined {
  let current: Node | undefined = node;
  while (current !== undefined) {
    if (ast.is.IsFunctionDeclaration(current) ||
      ast.is.IsFunctionExpression(current) ||
      ast.is.IsArrowFunction(current) ||
      ast.is.IsMethodDeclaration(current) ||
      ast.is.IsConstructorDeclaration(current) ||
      ast.is.IsGetAccessorDeclaration(current) ||
      ast.is.IsSetAccessorDeclaration(current)) {
      return current;
    }
    current = ast.parent(current);
  }
  return undefined;
}

const assignmentOperators = new Set([
  "KindEqualsToken",
  "KindPlusEqualsToken",
  "KindMinusEqualsToken",
  "KindAsteriskEqualsToken",
  "KindAsteriskAsteriskEqualsToken",
  "KindSlashEqualsToken",
  "KindPercentEqualsToken",
  "KindLessThanLessThanEqualsToken",
  "KindGreaterThanGreaterThanEqualsToken",
  "KindGreaterThanGreaterThanGreaterThanEqualsToken",
  "KindAmpersandEqualsToken",
  "KindBarEqualsToken",
  "KindCaretEqualsToken",
  "KindBarBarEqualsToken",
  "KindAmpersandAmpersandEqualsToken",
  "KindQuestionQuestionEqualsToken",
]);

const updateOperators = new Set([
  "KindPlusPlusToken",
  "KindMinusMinusToken",
]);

const comparisonOperators = new Set([
  "KindEqualsEqualsToken",
  "KindExclamationEqualsToken",
  "KindEqualsEqualsEqualsToken",
  "KindExclamationEqualsEqualsToken",
]);

function transparentExpressionContains(
  ast: AstReader,
  wrapper: Node,
  expression: Node,
): boolean {
  if (ast.is.IsParenthesizedExpression(wrapper)) {
    return sourceNodesEqual(ast, ast.as.AsParenthesizedExpression(wrapper)?.Expression, expression);
  }
  if (ast.is.IsAsExpression(wrapper)) {
    return sourceNodesEqual(ast, ast.as.AsAsExpression(wrapper)?.Expression, expression);
  }
  if (ast.is.IsSatisfiesExpression(wrapper)) {
    return sourceNodesEqual(ast, ast.as.AsSatisfiesExpression(wrapper)?.Expression, expression);
  }
  if (ast.is.IsNonNullExpression(wrapper)) {
    return sourceNodesEqual(ast, ast.as.AsNonNullExpression(wrapper)?.Expression, expression);
  }
  if (ast.is.IsTypeAssertion(wrapper)) {
    return sourceNodesEqual(ast, ast.as.AsTypeAssertion(wrapper)?.Expression, expression);
  }
  return false;
}

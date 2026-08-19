import type { AstReader, Node } from "@tsonic/tsts";

export function AsArrayLiteralExpression(ast: AstReader, node: Node | undefined): ReturnType<typeof ast.as.AsArrayLiteralExpression> | undefined {
  return node !== undefined && (ast.is.IsArrayLiteralExpression(node))
    ? ast.as.AsArrayLiteralExpression(node)
    : undefined;
}

export function AsArrowFunction(ast: AstReader, node: Node | undefined): ReturnType<typeof ast.as.AsArrowFunction> | undefined {
  return node !== undefined && (ast.is.IsArrowFunction(node))
    ? ast.as.AsArrowFunction(node)
    : undefined;
}

export function AsAsExpression(ast: AstReader, node: Node | undefined): ReturnType<typeof ast.as.AsAsExpression> | undefined {
  return node !== undefined && (ast.is.IsAsExpression(node))
    ? ast.as.AsAsExpression(node)
    : undefined;
}

export function AsAwaitExpression(ast: AstReader, node: Node | undefined): ReturnType<typeof ast.as.AsAwaitExpression> | undefined {
  return node !== undefined && (ast.is.IsAwaitExpression(node))
    ? ast.as.AsAwaitExpression(node)
    : undefined;
}

export function AsBigIntLiteral(ast: AstReader, node: Node | undefined): ReturnType<typeof ast.as.AsBigIntLiteral> | undefined {
  return node !== undefined && (ast.is.IsBigIntLiteral(node))
    ? ast.as.AsBigIntLiteral(node)
    : undefined;
}

export function AsBinaryExpression(ast: AstReader, node: Node | undefined): ReturnType<typeof ast.as.AsBinaryExpression> | undefined {
  return node !== undefined && (ast.is.IsBinaryExpression(node))
    ? ast.as.AsBinaryExpression(node)
    : undefined;
}

export function AsBindingElement(ast: AstReader, node: Node | undefined): ReturnType<typeof ast.as.AsBindingElement> | undefined {
  return node !== undefined && (ast.is.IsBindingElement(node))
    ? ast.as.AsBindingElement(node)
    : undefined;
}

export function AsBindingPattern(ast: AstReader, node: Node | undefined): ReturnType<typeof ast.as.AsBindingPattern> | undefined {
  return node !== undefined && (ast.is.IsArrayBindingPattern(node) || ast.is.IsObjectBindingPattern(node))
    ? ast.as.AsBindingPattern(node)
    : undefined;
}

export function AsBlock(ast: AstReader, node: Node | undefined): ReturnType<typeof ast.as.AsBlock> | undefined {
  return node !== undefined && (ast.is.IsBlock(node))
    ? ast.as.AsBlock(node)
    : undefined;
}

export function AsBreakStatement(ast: AstReader, node: Node | undefined): ReturnType<typeof ast.as.AsBreakStatement> | undefined {
  return node !== undefined && (ast.is.IsBreakStatement(node))
    ? ast.as.AsBreakStatement(node)
    : undefined;
}

export function AsCallExpression(ast: AstReader, node: Node | undefined): ReturnType<typeof ast.as.AsCallExpression> | undefined {
  return node !== undefined && (ast.is.IsCallExpression(node))
    ? ast.as.AsCallExpression(node)
    : undefined;
}

export function AsCaseBlock(ast: AstReader, node: Node | undefined): ReturnType<typeof ast.as.AsCaseBlock> | undefined {
  return node !== undefined && (ast.is.IsCaseBlock(node))
    ? ast.as.AsCaseBlock(node)
    : undefined;
}

export function AsCaseOrDefaultClause(ast: AstReader, node: Node | undefined): ReturnType<typeof ast.as.AsCaseOrDefaultClause> | undefined {
  return node !== undefined && (ast.is.IsCaseClause(node) || ast.is.IsDefaultClause(node))
    ? ast.as.AsCaseOrDefaultClause(node)
    : undefined;
}

export function AsCatchClause(ast: AstReader, node: Node | undefined): ReturnType<typeof ast.as.AsCatchClause> | undefined {
  return node !== undefined && (ast.is.IsCatchClause(node))
    ? ast.as.AsCatchClause(node)
    : undefined;
}

export function AsClassDeclaration(ast: AstReader, node: Node | undefined): ReturnType<typeof ast.as.AsClassDeclaration> | undefined {
  return node !== undefined && (ast.is.IsClassDeclaration(node))
    ? ast.as.AsClassDeclaration(node)
    : undefined;
}

export function AsClassStaticBlockDeclaration(ast: AstReader, node: Node | undefined): ReturnType<typeof ast.as.AsClassStaticBlockDeclaration> | undefined {
  return node !== undefined && (ast.is.IsClassStaticBlockDeclaration(node))
    ? ast.as.AsClassStaticBlockDeclaration(node)
    : undefined;
}

export function AsConditionalExpression(ast: AstReader, node: Node | undefined): ReturnType<typeof ast.as.AsConditionalExpression> | undefined {
  return node !== undefined && (ast.is.IsConditionalExpression(node))
    ? ast.as.AsConditionalExpression(node)
    : undefined;
}

export function AsConstructorDeclaration(ast: AstReader, node: Node | undefined): ReturnType<typeof ast.as.AsConstructorDeclaration> | undefined {
  return node !== undefined && (ast.is.IsConstructorDeclaration(node))
    ? ast.as.AsConstructorDeclaration(node)
    : undefined;
}

export function AsContinueStatement(ast: AstReader, node: Node | undefined): ReturnType<typeof ast.as.AsContinueStatement> | undefined {
  return node !== undefined && (ast.is.IsContinueStatement(node))
    ? ast.as.AsContinueStatement(node)
    : undefined;
}

export function AsDeleteExpression(ast: AstReader, node: Node | undefined): ReturnType<typeof ast.as.AsDeleteExpression> | undefined {
  return node !== undefined && (ast.is.IsDeleteExpression(node))
    ? ast.as.AsDeleteExpression(node)
    : undefined;
}

export function AsDoStatement(ast: AstReader, node: Node | undefined): ReturnType<typeof ast.as.AsDoStatement> | undefined {
  return node !== undefined && (ast.is.IsDoStatement(node))
    ? ast.as.AsDoStatement(node)
    : undefined;
}

export function AsElementAccessExpression(ast: AstReader, node: Node | undefined): ReturnType<typeof ast.as.AsElementAccessExpression> | undefined {
  return node !== undefined && (ast.is.IsElementAccessExpression(node))
    ? ast.as.AsElementAccessExpression(node)
    : undefined;
}

export function AsEnumDeclaration(ast: AstReader, node: Node | undefined): ReturnType<typeof ast.as.AsEnumDeclaration> | undefined {
  return node !== undefined && (ast.is.IsEnumDeclaration(node))
    ? ast.as.AsEnumDeclaration(node)
    : undefined;
}

export function AsEnumMember(ast: AstReader, node: Node | undefined): ReturnType<typeof ast.as.AsEnumMember> | undefined {
  return node !== undefined && (ast.is.IsEnumMember(node))
    ? ast.as.AsEnumMember(node)
    : undefined;
}

export function AsExportAssignment(ast: AstReader, node: Node | undefined): ReturnType<typeof ast.as.AsExportAssignment> | undefined {
  return node !== undefined && (ast.is.IsExportAssignment(node))
    ? ast.as.AsExportAssignment(node)
    : undefined;
}

export function AsExpressionStatement(ast: AstReader, node: Node | undefined): ReturnType<typeof ast.as.AsExpressionStatement> | undefined {
  return node !== undefined && (ast.is.IsExpressionStatement(node))
    ? ast.as.AsExpressionStatement(node)
    : undefined;
}

export function AsExpressionWithTypeArguments(ast: AstReader, node: Node | undefined): ReturnType<typeof ast.as.AsExpressionWithTypeArguments> | undefined {
  return node !== undefined && (ast.is.IsExpressionWithTypeArguments(node))
    ? ast.as.AsExpressionWithTypeArguments(node)
    : undefined;
}

export function AsForInOrOfStatement(ast: AstReader, node: Node | undefined): ReturnType<typeof ast.as.AsForInOrOfStatement> | undefined {
  return node !== undefined && (ast.is.IsForInStatement(node) || ast.is.IsForOfStatement(node))
    ? ast.as.AsForInOrOfStatement(node)
    : undefined;
}

export function AsForStatement(ast: AstReader, node: Node | undefined): ReturnType<typeof ast.as.AsForStatement> | undefined {
  return node !== undefined && (ast.is.IsForStatement(node))
    ? ast.as.AsForStatement(node)
    : undefined;
}

export function AsFunctionDeclaration(ast: AstReader, node: Node | undefined): ReturnType<typeof ast.as.AsFunctionDeclaration> | undefined {
  return node !== undefined && (ast.is.IsFunctionDeclaration(node))
    ? ast.as.AsFunctionDeclaration(node)
    : undefined;
}

export function AsFunctionExpression(ast: AstReader, node: Node | undefined): ReturnType<typeof ast.as.AsFunctionExpression> | undefined {
  return node !== undefined && (ast.is.IsFunctionExpression(node))
    ? ast.as.AsFunctionExpression(node)
    : undefined;
}

export function AsGetAccessorDeclaration(ast: AstReader, node: Node | undefined): ReturnType<typeof ast.as.AsGetAccessorDeclaration> | undefined {
  return node !== undefined && (ast.is.IsGetAccessorDeclaration(node))
    ? ast.as.AsGetAccessorDeclaration(node)
    : undefined;
}

export function AsHeritageClause(ast: AstReader, node: Node | undefined): ReturnType<typeof ast.as.AsHeritageClause> | undefined {
  return node !== undefined && (ast.is.IsHeritageClause(node))
    ? ast.as.AsHeritageClause(node)
    : undefined;
}

export function AsIdentifier(ast: AstReader, node: Node | undefined): ReturnType<typeof ast.as.AsIdentifier> | undefined {
  return node !== undefined && (ast.is.IsIdentifier(node))
    ? ast.as.AsIdentifier(node)
    : undefined;
}

export function AsIfStatement(ast: AstReader, node: Node | undefined): ReturnType<typeof ast.as.AsIfStatement> | undefined {
  return node !== undefined && (ast.is.IsIfStatement(node))
    ? ast.as.AsIfStatement(node)
    : undefined;
}

export function AsIndexSignatureDeclaration(ast: AstReader, node: Node | undefined): ReturnType<typeof ast.as.AsIndexSignatureDeclaration> | undefined {
  return node !== undefined && (ast.is.IsIndexSignatureDeclaration(node))
    ? ast.as.AsIndexSignatureDeclaration(node)
    : undefined;
}

export function AsInterfaceDeclaration(ast: AstReader, node: Node | undefined): ReturnType<typeof ast.as.AsInterfaceDeclaration> | undefined {
  return node !== undefined && (ast.is.IsInterfaceDeclaration(node))
    ? ast.as.AsInterfaceDeclaration(node)
    : undefined;
}

export function AsLabeledStatement(ast: AstReader, node: Node | undefined): ReturnType<typeof ast.as.AsLabeledStatement> | undefined {
  return node !== undefined && (ast.is.IsLabeledStatement(node))
    ? ast.as.AsLabeledStatement(node)
    : undefined;
}

export function AsMethodDeclaration(ast: AstReader, node: Node | undefined): ReturnType<typeof ast.as.AsMethodDeclaration> | undefined {
  return node !== undefined && (ast.is.IsMethodDeclaration(node))
    ? ast.as.AsMethodDeclaration(node)
    : undefined;
}

export function AsMethodSignatureDeclaration(ast: AstReader, node: Node | undefined): ReturnType<typeof ast.as.AsMethodSignatureDeclaration> | undefined {
  return node !== undefined && (ast.is.IsMethodSignatureDeclaration(node))
    ? ast.as.AsMethodSignatureDeclaration(node)
    : undefined;
}

export function AsNewExpression(ast: AstReader, node: Node | undefined): ReturnType<typeof ast.as.AsNewExpression> | undefined {
  return node !== undefined && (ast.is.IsNewExpression(node))
    ? ast.as.AsNewExpression(node)
    : undefined;
}

export function AsNoSubstitutionTemplateLiteral(ast: AstReader, node: Node | undefined): ReturnType<typeof ast.as.AsNoSubstitutionTemplateLiteral> | undefined {
  return node !== undefined && (ast.is.IsNoSubstitutionTemplateLiteral(node))
    ? ast.as.AsNoSubstitutionTemplateLiteral(node)
    : undefined;
}

export function AsNonNullExpression(ast: AstReader, node: Node | undefined): ReturnType<typeof ast.as.AsNonNullExpression> | undefined {
  return node !== undefined && (ast.is.IsNonNullExpression(node))
    ? ast.as.AsNonNullExpression(node)
    : undefined;
}

export function AsNumericLiteral(ast: AstReader, node: Node | undefined): ReturnType<typeof ast.as.AsNumericLiteral> | undefined {
  return node !== undefined && (ast.is.IsNumericLiteral(node))
    ? ast.as.AsNumericLiteral(node)
    : undefined;
}

export function AsObjectLiteralExpression(ast: AstReader, node: Node | undefined): ReturnType<typeof ast.as.AsObjectLiteralExpression> | undefined {
  return node !== undefined && (ast.is.IsObjectLiteralExpression(node))
    ? ast.as.AsObjectLiteralExpression(node)
    : undefined;
}

export function AsParameterDeclaration(ast: AstReader, node: Node | undefined): ReturnType<typeof ast.as.AsParameterDeclaration> | undefined {
  return node !== undefined && (ast.is.IsParameterDeclaration(node))
    ? ast.as.AsParameterDeclaration(node)
    : undefined;
}

export function AsParenthesizedExpression(ast: AstReader, node: Node | undefined): ReturnType<typeof ast.as.AsParenthesizedExpression> | undefined {
  return node !== undefined && (ast.is.IsParenthesizedExpression(node))
    ? ast.as.AsParenthesizedExpression(node)
    : undefined;
}

export function AsPostfixUnaryExpression(ast: AstReader, node: Node | undefined): ReturnType<typeof ast.as.AsPostfixUnaryExpression> | undefined {
  return node !== undefined && (ast.is.IsPostfixUnaryExpression(node))
    ? ast.as.AsPostfixUnaryExpression(node)
    : undefined;
}

export function AsPrefixUnaryExpression(ast: AstReader, node: Node | undefined): ReturnType<typeof ast.as.AsPrefixUnaryExpression> | undefined {
  return node !== undefined && (ast.is.IsPrefixUnaryExpression(node))
    ? ast.as.AsPrefixUnaryExpression(node)
    : undefined;
}

export function AsPrivateIdentifier(ast: AstReader, node: Node | undefined): ReturnType<typeof ast.as.AsPrivateIdentifier> | undefined {
  return node !== undefined && (ast.is.IsPrivateIdentifier(node))
    ? ast.as.AsPrivateIdentifier(node)
    : undefined;
}

export function AsPropertyAccessExpression(ast: AstReader, node: Node | undefined): ReturnType<typeof ast.as.AsPropertyAccessExpression> | undefined {
  return node !== undefined && (ast.is.IsPropertyAccessExpression(node))
    ? ast.as.AsPropertyAccessExpression(node)
    : undefined;
}

export function AsPropertyAssignment(ast: AstReader, node: Node | undefined): ReturnType<typeof ast.as.AsPropertyAssignment> | undefined {
  return node !== undefined && (ast.is.IsPropertyAssignment(node))
    ? ast.as.AsPropertyAssignment(node)
    : undefined;
}

export function AsPropertyDeclaration(ast: AstReader, node: Node | undefined): ReturnType<typeof ast.as.AsPropertyDeclaration> | undefined {
  return node !== undefined && (ast.is.IsPropertyDeclaration(node))
    ? ast.as.AsPropertyDeclaration(node)
    : undefined;
}

export function AsPropertySignatureDeclaration(ast: AstReader, node: Node | undefined): ReturnType<typeof ast.as.AsPropertySignatureDeclaration> | undefined {
  return node !== undefined && (ast.is.IsPropertySignatureDeclaration(node))
    ? ast.as.AsPropertySignatureDeclaration(node)
    : undefined;
}

export function AsRegularExpressionLiteral(ast: AstReader, node: Node | undefined): ReturnType<typeof ast.as.AsRegularExpressionLiteral> | undefined {
  return node !== undefined && (ast.is.IsRegularExpressionLiteral(node))
    ? ast.as.AsRegularExpressionLiteral(node)
    : undefined;
}

export function AsReturnStatement(ast: AstReader, node: Node | undefined): ReturnType<typeof ast.as.AsReturnStatement> | undefined {
  return node !== undefined && (ast.is.IsReturnStatement(node))
    ? ast.as.AsReturnStatement(node)
    : undefined;
}

export function AsSatisfiesExpression(ast: AstReader, node: Node | undefined): ReturnType<typeof ast.as.AsSatisfiesExpression> | undefined {
  return node !== undefined && (ast.is.IsSatisfiesExpression(node))
    ? ast.as.AsSatisfiesExpression(node)
    : undefined;
}

export function AsSetAccessorDeclaration(ast: AstReader, node: Node | undefined): ReturnType<typeof ast.as.AsSetAccessorDeclaration> | undefined {
  return node !== undefined && (ast.is.IsSetAccessorDeclaration(node))
    ? ast.as.AsSetAccessorDeclaration(node)
    : undefined;
}

export function AsShorthandPropertyAssignment(ast: AstReader, node: Node | undefined): ReturnType<typeof ast.as.AsShorthandPropertyAssignment> | undefined {
  return node !== undefined && (ast.is.IsShorthandPropertyAssignment(node))
    ? ast.as.AsShorthandPropertyAssignment(node)
    : undefined;
}

export function AsSpreadAssignment(ast: AstReader, node: Node | undefined): ReturnType<typeof ast.as.AsSpreadAssignment> | undefined {
  return node !== undefined && (ast.is.IsSpreadAssignment(node))
    ? ast.as.AsSpreadAssignment(node)
    : undefined;
}

export function AsSpreadElement(ast: AstReader, node: Node | undefined): ReturnType<typeof ast.as.AsSpreadElement> | undefined {
  return node !== undefined && (ast.is.IsSpreadElement(node))
    ? ast.as.AsSpreadElement(node)
    : undefined;
}

export function AsStringLiteral(ast: AstReader, node: Node | undefined): ReturnType<typeof ast.as.AsStringLiteral> | undefined {
  return node !== undefined && (ast.is.IsStringLiteral(node))
    ? ast.as.AsStringLiteral(node)
    : undefined;
}

export function AsSwitchStatement(ast: AstReader, node: Node | undefined): ReturnType<typeof ast.as.AsSwitchStatement> | undefined {
  return node !== undefined && (ast.is.IsSwitchStatement(node))
    ? ast.as.AsSwitchStatement(node)
    : undefined;
}

export function AsTemplateExpression(ast: AstReader, node: Node | undefined): ReturnType<typeof ast.as.AsTemplateExpression> | undefined {
  return node !== undefined && (ast.is.IsTemplateExpression(node))
    ? ast.as.AsTemplateExpression(node)
    : undefined;
}

export function AsTemplateSpan(ast: AstReader, node: Node | undefined): ReturnType<typeof ast.as.AsTemplateSpan> | undefined {
  return node !== undefined && (ast.is.IsTemplateSpan(node))
    ? ast.as.AsTemplateSpan(node)
    : undefined;
}

export function AsThrowStatement(ast: AstReader, node: Node | undefined): ReturnType<typeof ast.as.AsThrowStatement> | undefined {
  return node !== undefined && (ast.is.IsThrowStatement(node))
    ? ast.as.AsThrowStatement(node)
    : undefined;
}

export function AsTryStatement(ast: AstReader, node: Node | undefined): ReturnType<typeof ast.as.AsTryStatement> | undefined {
  return node !== undefined && (ast.is.IsTryStatement(node))
    ? ast.as.AsTryStatement(node)
    : undefined;
}

export function AsTypeAssertion(ast: AstReader, node: Node | undefined): ReturnType<typeof ast.as.AsTypeAssertion> | undefined {
  return node !== undefined && (ast.is.IsTypeAssertion(node))
    ? ast.as.AsTypeAssertion(node)
    : undefined;
}

export function AsTypeParameterDeclaration(ast: AstReader, node: Node | undefined): ReturnType<typeof ast.as.AsTypeParameterDeclaration> | undefined {
  return node !== undefined && (ast.is.IsTypeParameterDeclaration(node))
    ? ast.as.AsTypeParameterDeclaration(node)
    : undefined;
}

export function AsTypeReferenceNode(ast: AstReader, node: Node | undefined): ReturnType<typeof ast.as.AsTypeReferenceNode> | undefined {
  return node !== undefined && (ast.is.IsTypeReferenceNode(node))
    ? ast.as.AsTypeReferenceNode(node)
    : undefined;
}

export function AsVariableDeclaration(ast: AstReader, node: Node | undefined): ReturnType<typeof ast.as.AsVariableDeclaration> | undefined {
  return node !== undefined && (ast.is.IsVariableDeclaration(node))
    ? ast.as.AsVariableDeclaration(node)
    : undefined;
}

export function AsVariableDeclarationList(ast: AstReader, node: Node | undefined): ReturnType<typeof ast.as.AsVariableDeclarationList> | undefined {
  return node !== undefined && (ast.is.IsVariableDeclarationList(node))
    ? ast.as.AsVariableDeclarationList(node)
    : undefined;
}

export function AsVariableStatement(ast: AstReader, node: Node | undefined): ReturnType<typeof ast.as.AsVariableStatement> | undefined {
  return node !== undefined && (ast.is.IsVariableStatement(node))
    ? ast.as.AsVariableStatement(node)
    : undefined;
}

export function AsVoidExpression(ast: AstReader, node: Node | undefined): ReturnType<typeof ast.as.AsVoidExpression> | undefined {
  return node !== undefined && (ast.is.IsVoidExpression(node))
    ? ast.as.AsVoidExpression(node)
    : undefined;
}

export function AsWhileStatement(ast: AstReader, node: Node | undefined): ReturnType<typeof ast.as.AsWhileStatement> | undefined {
  return node !== undefined && (ast.is.IsWhileStatement(node))
    ? ast.as.AsWhileStatement(node)
    : undefined;
}

export function AsYieldExpression(ast: AstReader, node: Node | undefined): ReturnType<typeof ast.as.AsYieldExpression> | undefined {
  return node !== undefined && (ast.is.IsYieldExpression(node))
    ? ast.as.AsYieldExpression(node)
    : undefined;
}

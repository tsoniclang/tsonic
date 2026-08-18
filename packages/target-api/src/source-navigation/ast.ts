import type { AstReader, ExtensionFactSubject, Node } from "@tsonic/tsts";

export function asSourceNode(
  subject: ExtensionFactSubject | undefined,
  ast: Pick<AstReader, "kind">,
): Node | undefined {
  if (subject === undefined) {
    return undefined;
  }
  return ast.kind(subject as Node) === undefined ? undefined : subject as Node;
}

export function Node_Name(ast: AstReader, node: Node | undefined): Node | undefined {
  return node === undefined ? undefined : ast.name(node);
}

export function Node_Expression(ast: AstReader, node: Node | undefined): Node | undefined {
  if (node === undefined) {
    return undefined;
  }
  if (ast.is.IsExpressionStatement(node)) return ast.as.AsExpressionStatement(node)?.Expression;
  if (ast.is.IsReturnStatement(node)) return ast.as.AsReturnStatement(node)?.Expression;
  if (ast.is.IsThrowStatement(node)) return ast.as.AsThrowStatement(node)?.Expression;
  if (ast.is.IsIfStatement(node)) return ast.as.AsIfStatement(node)?.Expression;
  if (ast.is.IsWhileStatement(node)) return ast.as.AsWhileStatement(node)?.Expression;
  if (ast.is.IsDoStatement(node)) return ast.as.AsDoStatement(node)?.Expression;
  if (ast.is.IsForOfStatement(node) || ast.is.IsForInStatement(node)) {
    return ast.as.AsForInOrOfStatement(node)?.Expression;
  }
  if (ast.is.IsPropertyAccessExpression(node)) return ast.as.AsPropertyAccessExpression(node)?.Expression;
  if (ast.is.IsElementAccessExpression(node)) return ast.as.AsElementAccessExpression(node)?.Expression;
  if (ast.is.IsCallExpression(node)) return ast.as.AsCallExpression(node)?.Expression;
  if (ast.is.IsNewExpression(node)) return ast.as.AsNewExpression(node)?.Expression;
  if (ast.is.IsParenthesizedExpression(node)) return ast.as.AsParenthesizedExpression(node)?.Expression;
  if (ast.is.IsAwaitExpression(node)) return ast.as.AsAwaitExpression(node)?.Expression;
  if (ast.is.IsAsExpression(node)) return ast.as.AsAsExpression(node)?.Expression;
  if (ast.is.IsSatisfiesExpression(node)) return ast.as.AsSatisfiesExpression(node)?.Expression;
  if (ast.is.IsNonNullExpression(node)) return ast.as.AsNonNullExpression(node)?.Expression;
  if (ast.is.IsTypeAssertion(node)) return ast.as.AsTypeAssertion(node)?.Expression;
  if (ast.is.IsDeleteExpression(node)) return ast.as.AsDeleteExpression(node)?.Expression;
  if (ast.is.IsVoidExpression(node)) return ast.as.AsVoidExpression(node)?.Expression;
  if (ast.is.IsTypeOfExpression(node)) return ast.as.AsTypeOfExpression(node)?.Expression;
  if (ast.is.IsYieldExpression(node)) return ast.as.AsYieldExpression(node)?.Expression;
  if (ast.is.IsSpreadElement(node)) return ast.as.AsSpreadElement(node)?.Expression;
  if (ast.is.IsExportAssignment(node)) return ast.as.AsExportAssignment(node)?.Expression;
  return undefined;
}

export function ClassStaticBlock_Body(
  ast: AstReader,
  node: Node | undefined,
): Node | undefined {
  return node === undefined || !ast.is.IsClassStaticBlockDeclaration(node)
    ? undefined
    : ast.as.AsClassStaticBlockDeclaration(node)?.Body;
}

export function ExportAssignment_IsExportEquals(
  ast: AstReader,
  node: Node | undefined,
): boolean | undefined {
  return node === undefined || !ast.is.IsExportAssignment(node)
    ? undefined
    : ast.as.AsExportAssignment(node)?.IsExportEquals === true;
}

export function SpreadAssignment_Expression(
  ast: AstReader,
  node: Node | undefined,
): Node | undefined {
  return node === undefined || !ast.is.IsSpreadAssignment(node)
    ? undefined
    : ast.as.AsSpreadAssignment(node)?.Expression;
}

export function ConditionalExpression_Condition(ast: AstReader, node: Node | undefined): Node | undefined {
  return node === undefined || !ast.is.IsConditionalExpression(node)
    ? undefined
    : ast.as.AsConditionalExpression(node)?.Condition;
}

export function ConditionalExpression_WhenTrue(ast: AstReader, node: Node | undefined): Node | undefined {
  return node === undefined || !ast.is.IsConditionalExpression(node)
    ? undefined
    : ast.as.AsConditionalExpression(node)?.WhenTrue;
}

export function ConditionalExpression_WhenFalse(ast: AstReader, node: Node | undefined): Node | undefined {
  return node === undefined || !ast.is.IsConditionalExpression(node)
    ? undefined
    : ast.as.AsConditionalExpression(node)?.WhenFalse;
}

export function TemplateExpression_Head(ast: AstReader, node: Node | undefined): Node | undefined {
  return node === undefined || !ast.is.IsTemplateExpression(node)
    ? undefined
    : ast.as.AsTemplateExpression(node)?.Head;
}

export function TemplateExpression_TemplateSpans(
  ast: AstReader,
  node: Node | undefined,
): readonly (Node | undefined)[] | undefined {
  return node === undefined || !ast.is.IsTemplateExpression(node)
    ? undefined
    : ast.as.AsTemplateExpression(node)?.TemplateSpans?.Nodes;
}

export function TemplateSpan_Expression(ast: AstReader, node: Node | undefined): Node | undefined {
  return node === undefined || !ast.is.IsTemplateSpan(node)
    ? undefined
    : ast.as.AsTemplateSpan(node)?.Expression;
}

export function TemplateSpan_Literal(ast: AstReader, node: Node | undefined): Node | undefined {
  return node === undefined || !ast.is.IsTemplateSpan(node)
    ? undefined
    : ast.as.AsTemplateSpan(node)?.Literal;
}

export function Node_Type(ast: AstReader, node: Node | undefined): Node | undefined {
  return node === undefined ? undefined : ast.typeNode(node);
}

export function TypeOperatorNode_Type(ast: AstReader, node: Node | undefined): Node | undefined {
  return node === undefined || !ast.is.IsTypeOperatorNode(node)
    ? undefined
    : ast.as.AsTypeOperatorNode(node)?.Type;
}

export function Node_Initializer(ast: AstReader, node: Node | undefined): Node | undefined {
  if (node === undefined) {
    return undefined;
  }
  if (ast.is.IsVariableDeclaration(node)) return ast.as.AsVariableDeclaration(node)?.Initializer;
  if (ast.is.IsParameterDeclaration(node)) return ast.as.AsParameterDeclaration(node)?.Initializer;
  if (ast.is.IsPropertyDeclaration(node)) return ast.as.AsPropertyDeclaration(node)?.Initializer;
  if (ast.is.IsBindingElement(node)) return ast.as.AsBindingElement(node)?.Initializer;
  if (ast.is.IsPropertyAssignment(node)) return ast.as.AsPropertyAssignment(node)?.Initializer;
  if (ast.is.IsEnumMember(node)) return ast.as.AsEnumMember(node)?.Initializer;
  return undefined;
}

export function ObjectLiteralProperty_Value(
  ast: AstReader,
  node: Node | undefined,
): Node | undefined {
  if (node === undefined) {
    return undefined;
  }
  if (ast.is.IsPropertyAssignment(node)) {
    return ast.as.AsPropertyAssignment(node)?.Initializer;
  }
  if (!ast.is.IsShorthandPropertyAssignment(node)) {
    return undefined;
  }
  const shorthand = ast.as.AsShorthandPropertyAssignment(node);
  return shorthand?.ObjectAssignmentInitializer === undefined
    ? shorthand?.name
    : undefined;
}

export function BindingElement_PropertyName(ast: AstReader, node: Node | undefined): Node | undefined {
  return node === undefined || !ast.is.IsBindingElement(node)
    ? undefined
    : ast.as.AsBindingElement(node)?.PropertyName;
}

export function BindingElement_IsRest(ast: AstReader, node: Node | undefined): boolean {
  return node !== undefined && ast.is.IsBindingElement(node) &&
    ast.as.AsBindingElement(node)?.DotDotDotToken !== undefined;
}

export function VariableDeclarationList_Declarations(
  ast: AstReader,
  node: Node | undefined,
): readonly (Node | undefined)[] | undefined {
  if (node === undefined || !ast.is.IsVariableDeclarationList(node)) {
    return undefined;
  }
  return ast.as.AsVariableDeclarationList(node)?.Declarations?.Nodes;
}

export function VariableStatement_DeclarationList(
  ast: AstReader,
  node: Node | undefined,
): Node | undefined {
  if (node === undefined || !ast.is.IsVariableStatement(node)) {
    return undefined;
  }
  return ast.as.AsVariableStatement(node)?.DeclarationList;
}

export function BinaryExpression_Left(ast: AstReader, node: Node | undefined): Node | undefined {
  return node === undefined || !ast.is.IsBinaryExpression(node)
    ? undefined
    : ast.as.AsBinaryExpression(node)?.Left;
}

export function BinaryExpression_Right(ast: AstReader, node: Node | undefined): Node | undefined {
  return node === undefined || !ast.is.IsBinaryExpression(node)
    ? undefined
    : ast.as.AsBinaryExpression(node)?.Right;
}

export function BinaryExpression_OperatorToken(ast: AstReader, node: Node | undefined): Node | undefined {
  return node === undefined || !ast.is.IsBinaryExpression(node)
    ? undefined
    : ast.as.AsBinaryExpression(node)?.OperatorToken;
}

export function PrefixUnaryExpression_Operand(ast: AstReader, node: Node | undefined): Node | undefined {
  return node === undefined || !ast.is.IsPrefixUnaryExpression(node)
    ? undefined
    : ast.as.AsPrefixUnaryExpression(node)?.Operand;
}

export function IfStatement_ThenStatement(ast: AstReader, node: Node | undefined): Node | undefined {
  return node === undefined || !ast.is.IsIfStatement(node)
    ? undefined
    : ast.as.AsIfStatement(node)?.ThenStatement;
}

export function DoStatement_Statement(ast: AstReader, node: Node | undefined): Node | undefined {
  return node === undefined || !ast.is.IsDoStatement(node)
    ? undefined
    : ast.as.AsDoStatement(node)?.Statement;
}

export function LabeledStatement_Label(ast: AstReader, node: Node | undefined): Node | undefined {
  return node === undefined || !ast.is.IsLabeledStatement(node)
    ? undefined
    : ast.as.AsLabeledStatement(node)?.Label;
}

export function LabeledStatement_Statement(ast: AstReader, node: Node | undefined): Node | undefined {
  return node === undefined || !ast.is.IsLabeledStatement(node)
    ? undefined
    : ast.as.AsLabeledStatement(node)?.Statement;
}

export function SwitchStatement_Expression(ast: AstReader, node: Node | undefined): Node | undefined {
  return node === undefined || !ast.is.IsSwitchStatement(node)
    ? undefined
    : ast.as.AsSwitchStatement(node)?.Expression;
}

export function SwitchStatement_CaseBlock(ast: AstReader, node: Node | undefined): Node | undefined {
  return node === undefined || !ast.is.IsSwitchStatement(node)
    ? undefined
    : ast.as.AsSwitchStatement(node)?.CaseBlock;
}

export function CaseBlock_Clauses(
  ast: AstReader,
  node: Node | undefined,
): readonly (Node | undefined)[] | undefined {
  return node === undefined || !ast.is.IsCaseBlock(node)
    ? undefined
    : ast.as.AsCaseBlock(node)?.Clauses?.Nodes;
}

export function CaseOrDefaultClause_Expression(
  ast: AstReader,
  node: Node | undefined,
): Node | undefined {
  return node === undefined ||
      (!ast.is.IsCaseClause(node) && !ast.is.IsDefaultClause(node))
    ? undefined
    : ast.as.AsCaseOrDefaultClause(node)?.Expression;
}

export function CaseOrDefaultClause_Statements(
  ast: AstReader,
  node: Node | undefined,
): readonly (Node | undefined)[] | undefined {
  return node === undefined ||
      (!ast.is.IsCaseClause(node) && !ast.is.IsDefaultClause(node))
    ? undefined
    : ast.as.AsCaseOrDefaultClause(node)?.Statements?.Nodes;
}

export function IfStatement_ElseStatement(ast: AstReader, node: Node | undefined): Node | undefined {
  return node === undefined || !ast.is.IsIfStatement(node)
    ? undefined
    : ast.as.AsIfStatement(node)?.ElseStatement;
}

export function ForStatement_Initializer(ast: AstReader, node: Node | undefined): Node | undefined {
  return node === undefined || !ast.is.IsForStatement(node)
    ? undefined
    : ast.as.AsForStatement(node)?.Initializer;
}

export function ForStatement_Condition(ast: AstReader, node: Node | undefined): Node | undefined {
  return node === undefined || !ast.is.IsForStatement(node)
    ? undefined
    : ast.as.AsForStatement(node)?.Condition;
}

export function ForStatement_Incrementor(ast: AstReader, node: Node | undefined): Node | undefined {
  return node === undefined || !ast.is.IsForStatement(node)
    ? undefined
    : ast.as.AsForStatement(node)?.Incrementor;
}

export function ElementAccessExpression_ArgumentExpression(ast: AstReader, node: Node | undefined): Node | undefined {
  return node === undefined || !ast.is.IsElementAccessExpression(node)
    ? undefined
    : ast.as.AsElementAccessExpression(node)?.ArgumentExpression;
}

export function ArrayTypeNode_ElementType(ast: AstReader, node: Node | undefined): Node | undefined {
  return node === undefined || !ast.is.IsArrayTypeNode(node)
    ? undefined
    : ast.as.AsArrayTypeNode(node)?.ElementType;
}

export function ForInOrOfStatement_Initializer(ast: AstReader, node: Node | undefined): Node | undefined {
  return node !== undefined &&
      (ast.is.IsForInStatement(node) || ast.is.IsForOfStatement(node))
    ? ast.as.AsForInOrOfStatement(node)?.Initializer
    : undefined;
}

export function ForInOrOfStatement_Statement(ast: AstReader, node: Node | undefined): Node | undefined {
  return node !== undefined &&
      (ast.is.IsForInStatement(node) || ast.is.IsForOfStatement(node))
    ? ast.as.AsForInOrOfStatement(node)?.Statement
    : undefined;
}

export function IterationStatement_Statement(ast: AstReader, node: Node | undefined): Node | undefined {
  if (node === undefined) {
    return undefined;
  }
  if (ast.is.IsForStatement(node)) return ast.as.AsForStatement(node)?.Statement;
  if (ast.is.IsWhileStatement(node)) return ast.as.AsWhileStatement(node)?.Statement;
  if (ast.is.IsDoStatement(node)) return ast.as.AsDoStatement(node)?.Statement;
  if (ast.is.IsForOfStatement(node) || ast.is.IsForInStatement(node)) {
    return ast.as.AsForInOrOfStatement(node)?.Statement;
  }
  return undefined;
}

export function TypeReferenceNode_TypeName(ast: AstReader, node: Node | undefined): Node | undefined {
  return node === undefined || !ast.is.IsTypeReferenceNode(node)
    ? undefined
    : ast.as.AsTypeReferenceNode(node)?.TypeName;
}

export function Node_Operand(ast: AstReader, node: Node | undefined): Node | undefined {
  if (node === undefined) {
    return undefined;
  }
  return ast.is.IsPrefixUnaryExpression(node)
    ? ast.as.AsPrefixUnaryExpression(node)?.Operand
    : ast.is.IsPostfixUnaryExpression(node)
      ? ast.as.AsPostfixUnaryExpression(node)?.Operand
      : undefined;
}

export function TryStatement_TryBlock(ast: AstReader, node: Node | undefined): Node | undefined {
  return node === undefined || !ast.is.IsTryStatement(node)
    ? undefined
    : ast.as.AsTryStatement(node)?.TryBlock;
}

export function TryStatement_CatchClause(ast: AstReader, node: Node | undefined): Node | undefined {
  return node === undefined || !ast.is.IsTryStatement(node)
    ? undefined
    : ast.as.AsTryStatement(node)?.CatchClause;
}

export function TryStatement_FinallyBlock(ast: AstReader, node: Node | undefined): Node | undefined {
  return node === undefined || !ast.is.IsTryStatement(node)
    ? undefined
    : ast.as.AsTryStatement(node)?.FinallyBlock;
}

export function CatchClause_VariableDeclaration(ast: AstReader, node: Node | undefined): Node | undefined {
  return node === undefined || !ast.is.IsCatchClause(node)
    ? undefined
    : ast.as.AsCatchClause(node)?.VariableDeclaration;
}

export function CatchClause_Block(ast: AstReader, node: Node | undefined): Node | undefined {
  return node === undefined || !ast.is.IsCatchClause(node)
    ? undefined
    : ast.as.AsCatchClause(node)?.Block;
}

export function BreakOrContinueStatement_Label(
  ast: AstReader,
  node: Node | undefined,
): Node | undefined {
  if (node === undefined) {
    return undefined;
  }
  return ast.is.IsBreakStatement(node)
    ? ast.as.AsBreakStatement(node)?.Label
    : ast.is.IsContinueStatement(node)
      ? ast.as.AsContinueStatement(node)?.Label
      : undefined;
}

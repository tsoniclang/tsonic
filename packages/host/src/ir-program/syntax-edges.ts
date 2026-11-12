import type { SyntaxNode } from "../ir-hir/contract.js";
import type { TypedPhase } from "../ir-tir/contract.js";

export interface SyntaxEdge {
  readonly node: SyntaxNode<TypedPhase>;
  readonly segment: string;
}

function* child(node: SyntaxNode<TypedPhase> | null, segment: string): Generator<SyntaxEdge, void> {
  if (node !== null) yield { node, segment };
}

function* children(nodes: readonly SyntaxNode<TypedPhase>[] | null, segment: string): Generator<SyntaxEdge, void> {
  if (nodes === null) return;
  for (const [position, node] of nodes.entries()) yield { node, segment: segment + "[" + position + "]" };
}

export function syntaxEdges(node: SyntaxNode<TypedPhase>): readonly SyntaxEdge[] {
  return [...iterateSyntaxEdges(node)];
}

export function* iterateSyntaxEdges(node: SyntaxNode<TypedPhase>): Generator<SyntaxEdge, void> {
  switch (node.kind) {
    case "Unknown": case "EndOfFile": case "SingleLineCommentTrivia": case "MultiLineCommentTrivia":
    case "NewLineTrivia": case "WhitespaceTrivia": case "ConflictMarkerTrivia": case "NonTextFileMarkerTrivia":
    case "JsxTextAllWhiteSpaces": case "OpenBraceToken": case "CloseBraceToken": case "OpenParenToken":
    case "CloseParenToken": case "OpenBracketToken": case "CloseBracketToken": case "DotToken":
    case "DotDotDotToken": case "SemicolonToken": case "CommaToken": case "QuestionDotToken":
    case "LessThanToken": case "LessThanSlashToken": case "GreaterThanToken": case "LessThanEqualsToken":
    case "GreaterThanEqualsToken": case "EqualsEqualsToken": case "ExclamationEqualsToken": case "EqualsEqualsEqualsToken":
    case "ExclamationEqualsEqualsToken": case "EqualsGreaterThanToken": case "PlusToken": case "MinusToken":
    case "AsteriskToken": case "AsteriskAsteriskToken": case "SlashToken": case "PercentToken":
    case "PlusPlusToken": case "MinusMinusToken": case "LessThanLessThanToken": case "GreaterThanGreaterThanToken":
    case "GreaterThanGreaterThanGreaterThanToken": case "AmpersandToken": case "BarToken": case "CaretToken":
    case "ExclamationToken": case "TildeToken": case "AmpersandAmpersandToken": case "BarBarToken":
    case "QuestionToken": case "ColonToken": case "AtToken": case "QuestionQuestionToken":
    case "BacktickToken": case "HashToken": case "EqualsToken": case "PlusEqualsToken":
    case "MinusEqualsToken": case "AsteriskEqualsToken": case "AsteriskAsteriskEqualsToken": case "SlashEqualsToken":
    case "PercentEqualsToken": case "LessThanLessThanEqualsToken": case "GreaterThanGreaterThanEqualsToken": case "GreaterThanGreaterThanGreaterThanEqualsToken":
    case "AmpersandEqualsToken": case "BarEqualsToken": case "BarBarEqualsToken": case "AmpersandAmpersandEqualsToken":
    case "QuestionQuestionEqualsToken": case "CaretEqualsToken": case "JSDocCommentTextToken": case "BreakKeyword":
    case "CaseKeyword": case "CatchKeyword": case "ClassKeyword": case "ConstKeyword":
    case "ContinueKeyword": case "DebuggerKeyword": case "DefaultKeyword": case "DeleteKeyword":
    case "DoKeyword": case "ElseKeyword": case "EnumKeyword": case "ExportKeyword":
    case "ExtendsKeyword": case "FinallyKeyword": case "ForKeyword": case "FunctionKeyword":
    case "IfKeyword": case "InKeyword": case "InstanceOfKeyword": case "NewKeyword":
    case "ReturnKeyword": case "SwitchKeyword": case "ThrowKeyword": case "TryKeyword":
    case "TypeOfKeyword": case "VarKeyword": case "WhileKeyword": case "WithKeyword":
    case "ImplementsKeyword": case "InterfaceKeyword": case "LetKeyword": case "PackageKeyword":
    case "PrivateKeyword": case "ProtectedKeyword": case "PublicKeyword": case "StaticKeyword":
    case "YieldKeyword": case "AbstractKeyword": case "AccessorKeyword": case "AsKeyword":
    case "AssertsKeyword": case "AssertKeyword": case "AsyncKeyword": case "AwaitKeyword":
    case "ConstructorKeyword": case "DeclareKeyword": case "GetKeyword": case "ImmediateKeyword":
    case "InferKeyword": case "IsKeyword": case "KeyOfKeyword": case "ModuleKeyword":
    case "NamespaceKeyword": case "OutKeyword": case "ReadonlyKeyword": case "RequireKeyword":
    case "SatisfiesKeyword": case "SetKeyword": case "TypeKeyword": case "UniqueKeyword":
    case "UsingKeyword": case "FromKeyword": case "GlobalKeyword": case "OverrideKeyword":
    case "OfKeyword": case "DeferKeyword": case "Identifier": case "PrivateIdentifier":
    case "EmptyStatement": case "DebuggerStatement": case "NotEmittedStatement": case "NotEmittedTypeElement":
    case "SemicolonClassElement": case "OmittedExpression": case "NullKeyword": case "TrueKeyword":
    case "FalseKeyword": case "ThisKeyword": case "SuperKeyword": case "ImportKeyword":
    case "StringLiteral": case "NumericLiteral": case "BigIntLiteral": case "RegularExpressionLiteral":
    case "NoSubstitutionTemplateLiteral": case "AnyKeyword": case "BigIntKeyword": case "BooleanKeyword":
    case "IntrinsicKeyword": case "NeverKeyword": case "NumberKeyword": case "ObjectKeyword":
    case "StringKeyword": case "SymbolKeyword": case "UndefinedKeyword": case "UnknownKeyword":
    case "VoidKeyword": case "ThisType": case "TemplateHead": case "TemplateMiddle":
    case "TemplateTail": case "JsxOpeningFragment": case "JsxClosingFragment": case "JsxText":
    case "JSDocAllType": case "JSDocText":
return;
    case "QualifiedName":
yield* child(node.left, ".left");
      yield* child(node.right, ".right");
      return;
    case "ComputedPropertyName":
yield* child(node.expression, ".expression");
      return;
    case "Decorator":
yield* child(node.expression, ".expression");
      return;
    case "IfStatement":
yield* child(node.expression, ".expression");
      yield* child(node.thenStatement, ".thenStatement");
      yield* child(node.elseStatement, ".elseStatement");
      return;
    case "DoStatement":
yield* child(node.statement, ".statement");
      yield* child(node.expression, ".expression");
      return;
    case "WhileStatement":
yield* child(node.statement, ".statement");
      yield* child(node.expression, ".expression");
      return;
    case "ForStatement":
yield* child(node.statement, ".statement");
      yield* child(node.initializer, ".initializer");
      yield* child(node.condition, ".condition");
      yield* child(node.incrementor, ".incrementor");
      return;
    case "ForInStatement":
yield* child(node.initializer, ".initializer");
      yield* child(node.expression, ".expression");
      yield* child(node.statement, ".statement");
      return;
    case "ForOfStatement":
yield* child(node.awaitModifier, ".awaitModifier");
      yield* child(node.initializer, ".initializer");
      yield* child(node.expression, ".expression");
      yield* child(node.statement, ".statement");
      return;
    case "BreakStatement":
yield* child(node.label, ".label");
      return;
    case "ContinueStatement":
yield* child(node.label, ".label");
      return;
    case "ReturnStatement":
yield* child(node.expression, ".expression");
      return;
    case "WithStatement":
yield* child(node.expression, ".expression");
      yield* child(node.statement, ".statement");
      return;
    case "SwitchStatement":
yield* child(node.expression, ".expression");
      yield* child(node.caseBlock, ".caseBlock");
      return;
    case "CaseBlock":
yield* children(node.clauses.nodes, ".clauses.nodes");
      return;
    case "CaseClause":
yield* child(node.expression, ".expression");
      yield* children(node.statements.nodes, ".statements.nodes");
      return;
    case "DefaultClause":
yield* children(node.statements.nodes, ".statements.nodes");
      return;
    case "ThrowStatement":
yield* child(node.expression, ".expression");
      return;
    case "TryStatement":
yield* child(node.tryBlock, ".tryBlock");
      yield* child(node.catchClause, ".catchClause");
      yield* child(node.finallyBlock, ".finallyBlock");
      return;
    case "CatchClause":
yield* child(node.variableDeclaration, ".variableDeclaration");
      yield* child(node.block, ".block");
      return;
    case "LabeledStatement":
yield* child(node.label, ".label");
      yield* child(node.statement, ".statement");
      return;
    case "ExpressionStatement":
yield* child(node.expression, ".expression");
      return;
    case "Block":
yield* children(node.statements.nodes, ".statements.nodes");
      return;
    case "VariableStatement":
yield* children(node.modifiers?.nodes ?? null, ".modifiers.nodes");
      yield* child(node.declarationList, ".declarationList");
      return;
    case "VariableDeclaration":
yield* child(node.name, ".name");
      yield* child(node.exclamationToken, ".exclamationToken");
      yield* child(node.type, ".type");
      yield* child(node.initializer, ".initializer");
      return;
    case "VariableDeclarationList":
yield* children(node.declarations.nodes, ".declarations.nodes");
      return;
    case "ObjectBindingPattern": case "ArrayBindingPattern":
yield* children(node.elements.nodes, ".elements.nodes");
      return;
    case "Parameter":
yield* children(node.modifiers?.nodes ?? null, ".modifiers.nodes");
      yield* child(node.dotDotDotToken, ".dotDotDotToken");
      yield* child(node.name, ".name");
      yield* child(node.questionToken, ".questionToken");
      yield* child(node.type, ".type");
      yield* child(node.initializer, ".initializer");
      return;
    case "BindingElement":
yield* child(node.dotDotDotToken, ".dotDotDotToken");
      yield* child(node.propertyName, ".propertyName");
      yield* child(node.name, ".name");
      yield* child(node.initializer, ".initializer");
      return;
    case "MissingDeclaration":
yield* children(node.modifiers?.nodes ?? null, ".modifiers.nodes");
      return;
    case "FunctionDeclaration":
yield* children(node.modifiers?.nodes ?? null, ".modifiers.nodes");
      yield* children(node.typeParameters?.nodes ?? null, ".typeParameters.nodes");
      yield* children(node.parameters.nodes, ".parameters.nodes");
      yield* child(node.type, ".type");
      yield* child(node.fullSignature, ".fullSignature");
      yield* child(node.asteriskToken, ".asteriskToken");
      yield* child(node.body, ".body");
      yield* child(node.name, ".name");
      return;
    case "ClassDeclaration":
yield* children(node.modifiers?.nodes ?? null, ".modifiers.nodes");
      yield* child(node.name, ".name");
      yield* children(node.typeParameters?.nodes ?? null, ".typeParameters.nodes");
      yield* children(node.heritageClauses?.nodes ?? null, ".heritageClauses.nodes");
      yield* children(node.members.nodes, ".members.nodes");
      return;
    case "ClassExpression":
yield* children(node.modifiers?.nodes ?? null, ".modifiers.nodes");
      yield* child(node.name, ".name");
      yield* children(node.typeParameters?.nodes ?? null, ".typeParameters.nodes");
      yield* children(node.heritageClauses?.nodes ?? null, ".heritageClauses.nodes");
      yield* children(node.members.nodes, ".members.nodes");
      return;
    case "HeritageClause":
yield* children(node.types.nodes, ".types.nodes");
      return;
    case "InterfaceDeclaration":
yield* children(node.modifiers?.nodes ?? null, ".modifiers.nodes");
      yield* child(node.name, ".name");
      yield* children(node.typeParameters?.nodes ?? null, ".typeParameters.nodes");
      yield* children(node.heritageClauses?.nodes ?? null, ".heritageClauses.nodes");
      yield* children(node.members.nodes, ".members.nodes");
      return;
    case "TypeAliasDeclaration": case "JSTypeAliasDeclaration":
yield* children(node.modifiers?.nodes ?? null, ".modifiers.nodes");
      yield* child(node.name, ".name");
      yield* children(node.typeParameters?.nodes ?? null, ".typeParameters.nodes");
      yield* child(node.type, ".type");
      return;
    case "EnumMember":
yield* children(node.modifiers?.nodes ?? null, ".modifiers.nodes");
      yield* child(node.name, ".name");
      yield* child(node.postfixToken, ".postfixToken");
      yield* child(node.initializer, ".initializer");
      return;
    case "EnumDeclaration":
yield* children(node.modifiers?.nodes ?? null, ".modifiers.nodes");
      yield* child(node.name, ".name");
      yield* children(node.members.nodes, ".members.nodes");
      return;
    case "ModuleBlock":
yield* children(node.statements.nodes, ".statements.nodes");
      return;
    case "ImportDeclaration": case "JSImportDeclaration":
yield* children(node.modifiers?.nodes ?? null, ".modifiers.nodes");
      yield* child(node.importClause, ".importClause");
      yield* child(node.moduleSpecifier, ".moduleSpecifier");
      yield* child(node.attributes, ".attributes");
      return;
    case "ExternalModuleReference":
yield* child(node.expression, ".expression");
      return;
    case "NamespaceImport":
yield* child(node.name, ".name");
      return;
    case "NamedImports":
yield* children(node.elements.nodes, ".elements.nodes");
      return;
    case "ExportAssignment":
yield* children(node.modifiers?.nodes ?? null, ".modifiers.nodes");
      yield* child(node.type, ".type");
      yield* child(node.expression, ".expression");
      return;
    case "NamespaceExportDeclaration":
yield* children(node.modifiers?.nodes ?? null, ".modifiers.nodes");
      yield* child(node.name, ".name");
      return;
    case "NamespaceExport":
yield* child(node.name, ".name");
      return;
    case "NamedExports":
yield* children(node.elements.nodes, ".elements.nodes");
      return;
    case "ExportSpecifier":
yield* child(node.propertyName, ".propertyName");
      yield* child(node.name, ".name");
      return;
    case "CallSignature":
yield* children(node.typeParameters?.nodes ?? null, ".typeParameters.nodes");
      yield* children(node.parameters.nodes, ".parameters.nodes");
      yield* child(node.type, ".type");
      yield* child(node.fullSignature, ".fullSignature");
      return;
    case "ConstructSignature":
yield* children(node.typeParameters?.nodes ?? null, ".typeParameters.nodes");
      yield* children(node.parameters.nodes, ".parameters.nodes");
      yield* child(node.type, ".type");
      yield* child(node.fullSignature, ".fullSignature");
      return;
    case "Constructor":
yield* children(node.modifiers?.nodes ?? null, ".modifiers.nodes");
      yield* children(node.typeParameters?.nodes ?? null, ".typeParameters.nodes");
      yield* children(node.parameters.nodes, ".parameters.nodes");
      yield* child(node.type, ".type");
      yield* child(node.fullSignature, ".fullSignature");
      yield* child(node.asteriskToken, ".asteriskToken");
      yield* child(node.body, ".body");
      return;
    case "GetAccessor":
yield* children(node.modifiers?.nodes ?? null, ".modifiers.nodes");
      yield* child(node.name, ".name");
      yield* child(node.postfixToken, ".postfixToken");
      yield* children(node.typeParameters?.nodes ?? null, ".typeParameters.nodes");
      yield* children(node.parameters.nodes, ".parameters.nodes");
      yield* child(node.type, ".type");
      yield* child(node.fullSignature, ".fullSignature");
      yield* child(node.asteriskToken, ".asteriskToken");
      yield* child(node.body, ".body");
      return;
    case "SetAccessor":
yield* children(node.modifiers?.nodes ?? null, ".modifiers.nodes");
      yield* child(node.name, ".name");
      yield* child(node.postfixToken, ".postfixToken");
      yield* children(node.typeParameters?.nodes ?? null, ".typeParameters.nodes");
      yield* children(node.parameters.nodes, ".parameters.nodes");
      yield* child(node.type, ".type");
      yield* child(node.fullSignature, ".fullSignature");
      yield* child(node.asteriskToken, ".asteriskToken");
      yield* child(node.body, ".body");
      return;
    case "IndexSignature":
yield* children(node.modifiers?.nodes ?? null, ".modifiers.nodes");
      yield* children(node.typeParameters?.nodes ?? null, ".typeParameters.nodes");
      yield* children(node.parameters.nodes, ".parameters.nodes");
      yield* child(node.type, ".type");
      yield* child(node.fullSignature, ".fullSignature");
      return;
    case "MethodSignature":
yield* children(node.modifiers?.nodes ?? null, ".modifiers.nodes");
      yield* child(node.name, ".name");
      yield* child(node.postfixToken, ".postfixToken");
      yield* children(node.typeParameters?.nodes ?? null, ".typeParameters.nodes");
      yield* children(node.parameters.nodes, ".parameters.nodes");
      yield* child(node.type, ".type");
      yield* child(node.fullSignature, ".fullSignature");
      return;
    case "MethodDeclaration":
yield* children(node.modifiers?.nodes ?? null, ".modifiers.nodes");
      yield* child(node.name, ".name");
      yield* child(node.postfixToken, ".postfixToken");
      yield* children(node.typeParameters?.nodes ?? null, ".typeParameters.nodes");
      yield* children(node.parameters.nodes, ".parameters.nodes");
      yield* child(node.type, ".type");
      yield* child(node.fullSignature, ".fullSignature");
      yield* child(node.asteriskToken, ".asteriskToken");
      yield* child(node.body, ".body");
      return;
    case "PropertySignature":
yield* children(node.modifiers?.nodes ?? null, ".modifiers.nodes");
      yield* child(node.name, ".name");
      yield* child(node.postfixToken, ".postfixToken");
      yield* child(node.type, ".type");
      yield* child(node.initializer, ".initializer");
      return;
    case "PropertyDeclaration":
yield* children(node.modifiers?.nodes ?? null, ".modifiers.nodes");
      yield* child(node.name, ".name");
      yield* child(node.postfixToken, ".postfixToken");
      yield* child(node.type, ".type");
      yield* child(node.initializer, ".initializer");
      return;
    case "ClassStaticBlockDeclaration":
yield* children(node.modifiers?.nodes ?? null, ".modifiers.nodes");
      yield* child(node.body, ".body");
      return;
    case "BinaryExpression":
yield* children(node.modifiers?.nodes ?? null, ".modifiers.nodes");
      yield* child(node.left, ".left");
      yield* child(node.type, ".type");
      yield* child(node.operatorToken, ".operatorToken");
      yield* child(node.right, ".right");
      return;
    case "PrefixUnaryExpression":
yield* child(node.operand, ".operand");
      return;
    case "PostfixUnaryExpression":
yield* child(node.operand, ".operand");
      return;
    case "YieldExpression":
yield* child(node.asteriskToken, ".asteriskToken");
      yield* child(node.expression, ".expression");
      return;
    case "ArrowFunction":
yield* children(node.modifiers?.nodes ?? null, ".modifiers.nodes");
      yield* children(node.typeParameters?.nodes ?? null, ".typeParameters.nodes");
      yield* children(node.parameters.nodes, ".parameters.nodes");
      yield* child(node.type, ".type");
      yield* child(node.fullSignature, ".fullSignature");
      yield* child(node.asteriskToken, ".asteriskToken");
      yield* child(node.body, ".body");
      yield* child(node.equalsGreaterThanToken, ".equalsGreaterThanToken");
      return;
    case "FunctionExpression":
yield* children(node.modifiers?.nodes ?? null, ".modifiers.nodes");
      yield* children(node.typeParameters?.nodes ?? null, ".typeParameters.nodes");
      yield* children(node.parameters.nodes, ".parameters.nodes");
      yield* child(node.type, ".type");
      yield* child(node.fullSignature, ".fullSignature");
      yield* child(node.asteriskToken, ".asteriskToken");
      yield* child(node.body, ".body");
      yield* child(node.name, ".name");
      return;
    case "AsExpression":
yield* child(node.expression, ".expression");
      yield* child(node.type, ".type");
      return;
    case "SatisfiesExpression":
yield* child(node.expression, ".expression");
      yield* child(node.type, ".type");
      return;
    case "ConditionalExpression":
yield* child(node.condition, ".condition");
      yield* child(node.questionToken, ".questionToken");
      yield* child(node.whenTrue, ".whenTrue");
      yield* child(node.colonToken, ".colonToken");
      yield* child(node.whenFalse, ".whenFalse");
      return;
    case "PropertyAccessExpression":
yield* child(node.expression, ".expression");
      yield* child(node.questionDotToken, ".questionDotToken");
      yield* child(node.name, ".name");
      return;
    case "ElementAccessExpression":
yield* child(node.expression, ".expression");
      yield* child(node.questionDotToken, ".questionDotToken");
      yield* child(node.argumentExpression, ".argumentExpression");
      return;
    case "CallExpression":
yield* child(node.expression, ".expression");
      yield* child(node.questionDotToken, ".questionDotToken");
      yield* children(node.typeArguments?.nodes ?? null, ".typeArguments.nodes");
      yield* children(node.arguments.nodes, ".arguments.nodes");
      return;
    case "NewExpression":
yield* child(node.expression, ".expression");
      yield* children(node.typeArguments?.nodes ?? null, ".typeArguments.nodes");
      yield* children(node.arguments?.nodes ?? null, ".arguments.nodes");
      return;
    case "MetaProperty":
yield* child(node.name, ".name");
      return;
    case "NonNullExpression":
yield* child(node.expression, ".expression");
      return;
    case "SpreadElement":
yield* child(node.expression, ".expression");
      return;
    case "TemplateExpression":
yield* child(node.head, ".head");
      yield* children(node.templateSpans.nodes, ".templateSpans.nodes");
      return;
    case "TemplateSpan":
yield* child(node.expression, ".expression");
      yield* child(node.literal, ".literal");
      return;
    case "TaggedTemplateExpression":
yield* child(node.tag, ".tag");
      yield* child(node.questionDotToken, ".questionDotToken");
      yield* children(node.typeArguments?.nodes ?? null, ".typeArguments.nodes");
      yield* child(node.template, ".template");
      return;
    case "ParenthesizedExpression":
yield* child(node.expression, ".expression");
      return;
    case "ArrayLiteralExpression":
yield* children(node.elements.nodes, ".elements.nodes");
      return;
    case "ObjectLiteralExpression":
yield* children(node.properties.nodes, ".properties.nodes");
      return;
    case "SpreadAssignment":
yield* child(node.expression, ".expression");
      return;
    case "PropertyAssignment":
yield* children(node.modifiers?.nodes ?? null, ".modifiers.nodes");
      yield* child(node.name, ".name");
      yield* child(node.postfixToken, ".postfixToken");
      yield* child(node.type, ".type");
      yield* child(node.initializer, ".initializer");
      return;
    case "ShorthandPropertyAssignment":
yield* children(node.modifiers?.nodes ?? null, ".modifiers.nodes");
      yield* child(node.name, ".name");
      yield* child(node.postfixToken, ".postfixToken");
      yield* child(node.type, ".type");
      yield* child(node.equalsToken, ".equalsToken");
      yield* child(node.objectAssignmentInitializer, ".objectAssignmentInitializer");
      return;
    case "DeleteExpression":
yield* child(node.expression, ".expression");
      return;
    case "TypeOfExpression":
yield* child(node.expression, ".expression");
      return;
    case "VoidExpression":
yield* child(node.expression, ".expression");
      return;
    case "AwaitExpression":
yield* child(node.expression, ".expression");
      return;
    case "TypeAssertionExpression":
yield* child(node.type, ".type");
      yield* child(node.expression, ".expression");
      return;
    case "UnionType":
yield* children(node.types.nodes, ".types.nodes");
      return;
    case "IntersectionType":
yield* children(node.types.nodes, ".types.nodes");
      return;
    case "ConditionalType":
yield* child(node.checkType, ".checkType");
      yield* child(node.extendsType, ".extendsType");
      yield* child(node.trueType, ".trueType");
      yield* child(node.falseType, ".falseType");
      return;
    case "TypeOperator":
yield* child(node.type, ".type");
      return;
    case "InferType":
yield* child(node.typeParameter, ".typeParameter");
      return;
    case "ArrayType":
yield* child(node.elementType, ".elementType");
      return;
    case "IndexedAccessType":
yield* child(node.objectType, ".objectType");
      yield* child(node.indexType, ".indexType");
      return;
    case "TypeReference":
yield* children(node.typeArguments?.nodes ?? null, ".typeArguments.nodes");
      yield* child(node.typeName, ".typeName");
      return;
    case "ExpressionWithTypeArguments":
yield* child(node.expression, ".expression");
      yield* children(node.typeArguments?.nodes ?? null, ".typeArguments.nodes");
      return;
    case "LiteralType":
yield* child(node.literal, ".literal");
      return;
    case "TypePredicate":
yield* child(node.assertsModifier, ".assertsModifier");
      yield* child(node.parameterName, ".parameterName");
      yield* child(node.type, ".type");
      return;
    case "ImportAttribute":
yield* child(node.name, ".name");
      yield* child(node.value, ".value");
      return;
    case "ImportAttributes":
yield* children(node.attributes.nodes, ".attributes.nodes");
      return;
    case "TypeQuery":
yield* children(node.typeArguments?.nodes ?? null, ".typeArguments.nodes");
      yield* child(node.exprName, ".exprName");
      return;
    case "MappedType":
yield* child(node.readonlyToken, ".readonlyToken");
      yield* child(node.typeParameter, ".typeParameter");
      yield* child(node.nameType, ".nameType");
      yield* child(node.questionToken, ".questionToken");
      yield* child(node.type, ".type");
      yield* children(node.members?.nodes ?? null, ".members.nodes");
      return;
    case "TypeLiteral":
yield* children(node.members.nodes, ".members.nodes");
      return;
    case "TupleType":
yield* children(node.elements.nodes, ".elements.nodes");
      return;
    case "NamedTupleMember":
yield* child(node.dotDotDotToken, ".dotDotDotToken");
      yield* child(node.name, ".name");
      yield* child(node.questionToken, ".questionToken");
      yield* child(node.type, ".type");
      return;
    case "OptionalType":
yield* child(node.type, ".type");
      return;
    case "RestType":
yield* child(node.type, ".type");
      return;
    case "ParenthesizedType":
yield* child(node.type, ".type");
      return;
    case "FunctionType":
yield* children(node.modifiers?.nodes ?? null, ".modifiers.nodes");
      yield* children(node.typeParameters?.nodes ?? null, ".typeParameters.nodes");
      yield* children(node.parameters.nodes, ".parameters.nodes");
      yield* child(node.type, ".type");
      yield* child(node.fullSignature, ".fullSignature");
      return;
    case "ConstructorType":
yield* children(node.modifiers?.nodes ?? null, ".modifiers.nodes");
      yield* children(node.typeParameters?.nodes ?? null, ".typeParameters.nodes");
      yield* children(node.parameters.nodes, ".parameters.nodes");
      yield* child(node.type, ".type");
      yield* child(node.fullSignature, ".fullSignature");
      return;
    case "TemplateLiteralType":
yield* child(node.head, ".head");
      yield* children(node.templateSpans.nodes, ".templateSpans.nodes");
      return;
    case "TemplateLiteralTypeSpan":
yield* child(node.type, ".type");
      yield* child(node.literal, ".literal");
      return;
    case "PartiallyEmittedExpression":
yield* child(node.expression, ".expression");
      return;
    case "JsxElement":
yield* child(node.openingElement, ".openingElement");
      yield* children(node.children.nodes, ".children.nodes");
      yield* child(node.closingElement, ".closingElement");
      return;
    case "JsxAttributes":
yield* children(node.properties.nodes, ".properties.nodes");
      return;
    case "JsxNamespacedName":
yield* child(node.namespace, ".namespace");
      yield* child(node.name, ".name");
      return;
    case "JsxOpeningElement":
yield* child(node.tagName, ".tagName");
      yield* children(node.typeArguments?.nodes ?? null, ".typeArguments.nodes");
      yield* child(node.attributes, ".attributes");
      return;
    case "JsxSelfClosingElement":
yield* child(node.tagName, ".tagName");
      yield* children(node.typeArguments?.nodes ?? null, ".typeArguments.nodes");
      yield* child(node.attributes, ".attributes");
      return;
    case "JsxFragment":
yield* child(node.openingFragment, ".openingFragment");
      yield* children(node.children.nodes, ".children.nodes");
      yield* child(node.closingFragment, ".closingFragment");
      return;
    case "JsxAttribute":
yield* child(node.name, ".name");
      yield* child(node.initializer, ".initializer");
      return;
    case "JsxSpreadAttribute":
yield* child(node.expression, ".expression");
      return;
    case "JsxClosingElement":
yield* child(node.tagName, ".tagName");
      return;
    case "JsxExpression":
yield* child(node.dotDotDotToken, ".dotDotDotToken");
      yield* child(node.expression, ".expression");
      return;
    case "SyntaxList":
yield* children(node.children, ".children");
      return;
    case "JSDoc":
yield* children(node.comment.nodes, ".comment.nodes");
      yield* children(node.tags?.nodes ?? null, ".tags.nodes");
      return;
    case "JSDocTypeExpression":
yield* child(node.type, ".type");
      return;
    case "JSDocNonNullableType":
yield* child(node.type, ".type");
      return;
    case "JSDocNullableType":
yield* child(node.type, ".type");
      return;
    case "JSDocVariadicType":
yield* child(node.type, ".type");
      return;
    case "JSDocOptionalType":
yield* child(node.type, ".type");
      return;
    case "JSDocTypeTag":
yield* child(node.tagName, ".tagName");
      yield* children(node.comment?.nodes ?? null, ".comment.nodes");
      yield* child(node.typeExpression, ".typeExpression");
      return;
    case "JSDocUnknownTag":
yield* child(node.tagName, ".tagName");
      yield* children(node.comment?.nodes ?? null, ".comment.nodes");
      return;
    case "JSDocTemplateTag":
yield* child(node.tagName, ".tagName");
      yield* children(node.comment?.nodes ?? null, ".comment.nodes");
      yield* child(node.constraint, ".constraint");
      yield* children(node.typeParameters.nodes, ".typeParameters.nodes");
      return;
    case "JSDocReturnTag":
yield* child(node.tagName, ".tagName");
      yield* children(node.comment?.nodes ?? null, ".comment.nodes");
      yield* child(node.typeExpression, ".typeExpression");
      return;
    case "JSDocPublicTag":
yield* child(node.tagName, ".tagName");
      yield* children(node.comment?.nodes ?? null, ".comment.nodes");
      return;
    case "JSDocPrivateTag":
yield* child(node.tagName, ".tagName");
      yield* children(node.comment?.nodes ?? null, ".comment.nodes");
      return;
    case "JSDocProtectedTag":
yield* child(node.tagName, ".tagName");
      yield* children(node.comment?.nodes ?? null, ".comment.nodes");
      return;
    case "JSDocReadonlyTag":
yield* child(node.tagName, ".tagName");
      yield* children(node.comment?.nodes ?? null, ".comment.nodes");
      return;
    case "JSDocOverrideTag":
yield* child(node.tagName, ".tagName");
      yield* children(node.comment?.nodes ?? null, ".comment.nodes");
      return;
    case "JSDocDeprecatedTag":
yield* child(node.tagName, ".tagName");
      yield* children(node.comment?.nodes ?? null, ".comment.nodes");
      return;
    case "JSDocSeeTag":
yield* child(node.tagName, ".tagName");
      yield* children(node.comment?.nodes ?? null, ".comment.nodes");
      yield* child(node.nameExpression, ".nameExpression");
      return;
    case "JSDocImplementsTag":
yield* child(node.tagName, ".tagName");
      yield* children(node.comment?.nodes ?? null, ".comment.nodes");
      yield* child(node.className, ".className");
      return;
    case "JSDocAugmentsTag":
yield* child(node.tagName, ".tagName");
      yield* children(node.comment?.nodes ?? null, ".comment.nodes");
      yield* child(node.className, ".className");
      return;
    case "JSDocSatisfiesTag":
yield* child(node.tagName, ".tagName");
      yield* children(node.comment?.nodes ?? null, ".comment.nodes");
      yield* child(node.typeExpression, ".typeExpression");
      return;
    case "JSDocThrowsTag":
yield* child(node.tagName, ".tagName");
      yield* children(node.comment?.nodes ?? null, ".comment.nodes");
      yield* child(node.typeExpression, ".typeExpression");
      return;
    case "JSDocThisTag":
yield* child(node.tagName, ".tagName");
      yield* children(node.comment?.nodes ?? null, ".comment.nodes");
      yield* child(node.typeExpression, ".typeExpression");
      return;
    case "JSDocImportTag":
yield* child(node.tagName, ".tagName");
      yield* children(node.comment?.nodes ?? null, ".comment.nodes");
      yield* child(node.importClause, ".importClause");
      yield* child(node.moduleSpecifier, ".moduleSpecifier");
      yield* child(node.attributes, ".attributes");
      return;
    case "JSDocCallbackTag":
yield* child(node.tagName, ".tagName");
      yield* children(node.comment?.nodes ?? null, ".comment.nodes");
      yield* child(node.typeExpression, ".typeExpression");
      yield* child(node.name, ".name");
      return;
    case "JSDocOverloadTag":
yield* child(node.tagName, ".tagName");
      yield* children(node.comment?.nodes ?? null, ".comment.nodes");
      yield* child(node.typeExpression, ".typeExpression");
      return;
    case "JSDocTypedefTag":
yield* child(node.tagName, ".tagName");
      yield* children(node.comment?.nodes ?? null, ".comment.nodes");
      yield* child(node.typeExpression, ".typeExpression");
      yield* child(node.name, ".name");
      return;
    case "JSDocSignature":
yield* children(node.typeParameters?.nodes ?? null, ".typeParameters.nodes");
      yield* children(node.parameters.nodes, ".parameters.nodes");
      yield* child(node.type, ".type");
      yield* child(node.fullSignature, ".fullSignature");
      return;
    case "JSDocNameReference":
yield* child(node.name, ".name");
      return;
    case "SourceFile":
yield* children(node.statements.nodes, ".statements.nodes");
      yield* child(node.endOfFileToken, ".endOfFileToken");
      return;
    case "ModuleDeclaration":
yield* children(node.modifiers?.nodes ?? null, ".modifiers.nodes");
      yield* child(node.asteriskToken, ".asteriskToken");
      yield* child(node.body, ".body");
      yield* child(node.name, ".name");
      return;
    case "ImportEqualsDeclaration":
yield* children(node.modifiers?.nodes ?? null, ".modifiers.nodes");
      yield* child(node.name, ".name");
      yield* child(node.moduleReference, ".moduleReference");
      return;
    case "ExportDeclaration":
yield* children(node.modifiers?.nodes ?? null, ".modifiers.nodes");
      yield* child(node.exportClause, ".exportClause");
      yield* child(node.moduleSpecifier, ".moduleSpecifier");
      yield* child(node.attributes, ".attributes");
      return;
    case "ImportType":
yield* children(node.typeArguments?.nodes ?? null, ".typeArguments.nodes");
      yield* child(node.argument, ".argument");
      yield* child(node.attributes, ".attributes");
      yield* child(node.qualifier, ".qualifier");
      return;
    case "ImportClause":
yield* child(node.name, ".name");
      yield* child(node.namedBindings, ".namedBindings");
      return;
    case "ImportSpecifier":
yield* child(node.propertyName, ".propertyName");
      yield* child(node.name, ".name");
      return;
    case "JSDocLink":
yield* child(node.name, ".name");
      return;
    case "JSDocLinkPlain":
yield* child(node.name, ".name");
      return;
    case "JSDocLinkCode":
yield* child(node.name, ".name");
      return;
    case "TypeParameter":
yield* children(node.modifiers?.nodes ?? null, ".modifiers.nodes");
      yield* child(node.name, ".name");
      yield* child(node.constraint, ".constraint");
      yield* child(node.expression, ".expression");
      yield* child(node.defaultType, ".defaultType");
      return;
    case "SyntheticReferenceExpression":
yield* child(node.expression, ".expression");
      yield* child(node.thisArg, ".thisArg");
      return;
    case "JSDocTypeLiteral":
yield* children(node.jsDocPropertyTags, ".jsDocPropertyTags");
      return;
    case "JSDocParameterTag": case "JSDocPropertyTag":
yield* child(node.tagName, ".tagName");
      yield* children(node.comment?.nodes ?? null, ".comment.nodes");
      yield* child(node.name, ".name");
      yield* child(node.typeExpression, ".typeExpression");
      return;
  }
}

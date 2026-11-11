import type { ChildrenOfSyntax, Phase, SyntaxNode, NodeList } from "./contract.js";

const emptyChildren: readonly never[] = Object.freeze([]);

export interface SyntaxChild<PhaseType extends Phase> {
  readonly node: SyntaxNode<PhaseType>;
  readonly fields: readonly (string | number)[];
}

type ChildProjection<PhaseType extends Phase, Value> = (
  node: SyntaxNode<PhaseType>, field: string, index: number | null, list: boolean,
) => Value;

function children<PhaseType extends Phase, Value>(
  project: ChildProjection<PhaseType, Value>,
  ...parts: readonly (readonly [string, SyntaxNode<PhaseType> | NodeList<SyntaxNode<PhaseType>> | readonly SyntaxNode<PhaseType>[] | null])[]
): readonly Value[] {
  const result: Value[] = [];
  for (const [field, part] of parts) {
    if (part === null) continue;
    if ("kind" in part) result.push(project(part, field, null, false));
    else if ("nodes" in part) {
      for (const [index, node] of part.nodes.entries()) result.push(project(node, field, index, true));
    } else {
      for (const [index, node] of part.entries()) result.push(project(node, field, index, false));
    }
  }
  return Object.freeze(result);
}

export const childrenOfSyntax: ChildrenOfSyntax = <PhaseType extends Phase>(
  node: SyntaxNode<PhaseType>,
): readonly SyntaxNode<PhaseType>[] => projectSyntax(node, child => child);

export function syntaxChildEdges<PhaseType extends Phase>(
  node: SyntaxNode<PhaseType>,
): readonly SyntaxChild<PhaseType>[] {
  return projectSyntax(node, (child, field, index, list) => ({ node: child,
    fields: index === null ? [field] : list ? [field, "nodes", index] : [field, index] }));
}

function projectSyntax<PhaseType extends Phase, Value>(
  node: SyntaxNode<PhaseType>, project: ChildProjection<PhaseType, Value>,
): readonly Value[] {
  switch (node.kind) {
    case "QualifiedName":
      return children<PhaseType, Value>(project, ["left", node.left], ["right", node.right]);
    case "ComputedPropertyName":
    case "Decorator":
    case "ReturnStatement":
    case "ThrowStatement":
    case "ExpressionStatement":
    case "ExternalModuleReference":
    case "NonNullExpression":
    case "SpreadElement":
    case "ParenthesizedExpression":
    case "SpreadAssignment":
    case "DeleteExpression":
    case "TypeOfExpression":
    case "VoidExpression":
    case "AwaitExpression":
    case "PartiallyEmittedExpression":
    case "JsxSpreadAttribute":
      return children<PhaseType, Value>(project, ["expression", node.expression]);
    case "IfStatement":
      return children<PhaseType, Value>(project, ["expression", node.expression], ["thenStatement", node.thenStatement], ["elseStatement", node.elseStatement]);
    case "DoStatement":
      return children<PhaseType, Value>(project, ["statement", node.statement], ["expression", node.expression]);
    case "WhileStatement":
    case "WithStatement":
      return children<PhaseType, Value>(project, ["expression", node.expression], ["statement", node.statement]);
    case "ForStatement":
      return children<PhaseType, Value>(project, ["initializer", node.initializer], ["condition", node.condition], ["incrementor", node.incrementor], ["statement", node.statement]);
    case "ForInStatement":
    case "ForOfStatement":
      return children<PhaseType, Value>(project, ["awaitModifier", node.awaitModifier], ["initializer", node.initializer], ["expression", node.expression], ["statement", node.statement]);
    case "BreakStatement":
    case "ContinueStatement":
      return children<PhaseType, Value>(project, ["label", node.label]);
    case "SwitchStatement":
      return children<PhaseType, Value>(project, ["expression", node.expression], ["caseBlock", node.caseBlock]);
    case "CaseBlock":
      return children<PhaseType, Value>(project, ["clauses", node.clauses]);
    case "CaseClause":
    case "DefaultClause":
      return children<PhaseType, Value>(project, ["expression", node.expression], ["statements", node.statements]);
    case "TryStatement":
      return children<PhaseType, Value>(project, ["tryBlock", node.tryBlock], ["catchClause", node.catchClause], ["finallyBlock", node.finallyBlock]);
    case "CatchClause":
      return children<PhaseType, Value>(project, ["variableDeclaration", node.variableDeclaration], ["block", node.block]);
    case "LabeledStatement":
      return children<PhaseType, Value>(project, ["label", node.label], ["statement", node.statement]);
    case "Block":
    case "ModuleBlock":
      return children<PhaseType, Value>(project, ["statements", node.statements]);
    case "VariableStatement":
      return children<PhaseType, Value>(project, ["modifiers", node.modifiers], ["declarationList", node.declarationList]);
    case "VariableDeclaration":
      return children<PhaseType, Value>(project, ["name", node.name], ["exclamationToken", node.exclamationToken], ["type", node.type], ["initializer", node.initializer]);
    case "VariableDeclarationList":
      return children<PhaseType, Value>(project, ["declarations", node.declarations]);
    case "ObjectBindingPattern":
    case "ArrayBindingPattern":
      return children<PhaseType, Value>(project, ["elements", node.elements]);
    case "Parameter":
      return children<PhaseType, Value>(project, ["modifiers", node.modifiers], ["dotDotDotToken", node.dotDotDotToken], ["name", node.name],
        ["questionToken", node.questionToken], ["type", node.type], ["initializer", node.initializer]);
    case "BindingElement":
      return children<PhaseType, Value>(project, ["dotDotDotToken", node.dotDotDotToken], ["propertyName", node.propertyName], ["name", node.name], ["initializer", node.initializer]);
    case "MissingDeclaration":
      return children<PhaseType, Value>(project, ["modifiers", node.modifiers]);
    case "FunctionDeclaration":
    case "FunctionExpression":
      return children<PhaseType, Value>(project, ["modifiers", node.modifiers], ["asteriskToken", node.asteriskToken], ["name", node.name],
        ["typeParameters", node.typeParameters], ["parameters", node.parameters], ["type", node.type], ["fullSignature", node.fullSignature], ["body", node.body]);
    case "ClassDeclaration":
    case "ClassExpression":
    case "InterfaceDeclaration":
      return children<PhaseType, Value>(project, ["modifiers", node.modifiers], ["name", node.name], ["typeParameters", node.typeParameters],
        ["heritageClauses", node.heritageClauses], ["members", node.members]);
    case "HeritageClause":
      return children<PhaseType, Value>(project, ["types", node.types]);
    case "TypeAliasDeclaration":
    case "JSTypeAliasDeclaration":
      return children<PhaseType, Value>(project, ["modifiers", node.modifiers], ["name", node.name], ["typeParameters", node.typeParameters], ["type", node.type]);
    case "EnumMember":
      return children<PhaseType, Value>(project, ["modifiers", node.modifiers], ["name", node.name], ["postfixToken", node.postfixToken], ["initializer", node.initializer]);
    case "EnumDeclaration":
      return children<PhaseType, Value>(project, ["modifiers", node.modifiers], ["name", node.name], ["members", node.members]);
    case "ImportDeclaration":
    case "JSImportDeclaration":
      return children<PhaseType, Value>(project, ["modifiers", node.modifiers], ["importClause", node.importClause], ["moduleSpecifier", node.moduleSpecifier], ["attributes", node.attributes]);
    case "NamespaceImport":
    case "NamespaceExport":
    case "JSDocNameReference":
    case "JSDocLink":
    case "JSDocLinkPlain":
    case "JSDocLinkCode":
      return children<PhaseType, Value>(project, ["name", node.name]);
    case "NamedImports":
    case "NamedExports":
      return children<PhaseType, Value>(project, ["elements", node.elements]);
    case "ExportAssignment":
      return children<PhaseType, Value>(project, ["modifiers", node.modifiers], ["type", node.type], ["expression", node.expression]);
    case "NamespaceExportDeclaration":
      return children<PhaseType, Value>(project, ["modifiers", node.modifiers], ["name", node.name]);
    case "ExportSpecifier":
    case "ImportSpecifier":
      return children<PhaseType, Value>(project, ["propertyName", node.propertyName], ["name", node.name]);
    case "CallSignature":
    case "ConstructSignature":
    case "JSDocSignature":
      return children<PhaseType, Value>(project, ["typeParameters", node.typeParameters], ["parameters", node.parameters], ["type", node.type], ["fullSignature", node.fullSignature]);
    case "FunctionType":
      return children<PhaseType, Value>(project, ["modifiers", node.modifiers], ["typeParameters", node.typeParameters], ["parameters", node.parameters], ["type", node.type], ["fullSignature", node.fullSignature]);
    case "Constructor":
      return children<PhaseType, Value>(project, ["modifiers", node.modifiers], ["typeParameters", node.typeParameters], ["parameters", node.parameters],
        ["type", node.type], ["fullSignature", node.fullSignature], ["asteriskToken", node.asteriskToken], ["body", node.body]);
    case "GetAccessor":
    case "SetAccessor":
      return children<PhaseType, Value>(project, ["modifiers", node.modifiers], ["asteriskToken", node.asteriskToken], ["name", node.name], ["postfixToken", node.postfixToken],
        ["typeParameters", node.typeParameters], ["parameters", node.parameters], ["type", node.type], ["fullSignature", node.fullSignature], ["body", node.body]);
    case "IndexSignature":
      return children<PhaseType, Value>(project, ["modifiers", node.modifiers], ["typeParameters", node.typeParameters], ["parameters", node.parameters], ["type", node.type], ["fullSignature", node.fullSignature]);
    case "MethodSignature":
      return children<PhaseType, Value>(project, ["modifiers", node.modifiers], ["name", node.name], ["postfixToken", node.postfixToken],
        ["typeParameters", node.typeParameters], ["parameters", node.parameters], ["type", node.type], ["fullSignature", node.fullSignature]);
    case "MethodDeclaration":
      return children<PhaseType, Value>(project, ["modifiers", node.modifiers], ["asteriskToken", node.asteriskToken], ["name", node.name], ["postfixToken", node.postfixToken],
        ["typeParameters", node.typeParameters], ["parameters", node.parameters], ["type", node.type], ["fullSignature", node.fullSignature], ["body", node.body]);
    case "PropertySignature":
    case "PropertyDeclaration":
    case "PropertyAssignment":
      return children<PhaseType, Value>(project, ["modifiers", node.modifiers], ["name", node.name], ["postfixToken", node.postfixToken], ["type", node.type], ["initializer", node.initializer]);
    case "ClassStaticBlockDeclaration":
      return children<PhaseType, Value>(project, ["modifiers", node.modifiers], ["body", node.body]);
    case "BinaryExpression":
      return children<PhaseType, Value>(project, ["modifiers", node.modifiers], ["left", node.left], ["type", node.type], ["operatorToken", node.operatorToken], ["right", node.right]);
    case "PrefixUnaryExpression":
    case "PostfixUnaryExpression":
      return children<PhaseType, Value>(project, ["operand", node.operand]);
    case "YieldExpression":
      return children<PhaseType, Value>(project, ["asteriskToken", node.asteriskToken], ["expression", node.expression]);
    case "ArrowFunction":
      return children<PhaseType, Value>(project, ["modifiers", node.modifiers], ["typeParameters", node.typeParameters], ["parameters", node.parameters],
        ["type", node.type], ["fullSignature", node.fullSignature], ["asteriskToken", node.asteriskToken], ["equalsGreaterThanToken", node.equalsGreaterThanToken], ["body", node.body]);
    case "AsExpression":
    case "SatisfiesExpression":
      return children<PhaseType, Value>(project, ["expression", node.expression], ["type", node.type]);
    case "ConditionalExpression":
      return children<PhaseType, Value>(project, ["condition", node.condition], ["questionToken", node.questionToken], ["whenTrue", node.whenTrue], ["colonToken", node.colonToken], ["whenFalse", node.whenFalse]);
    case "PropertyAccessExpression":
      return children<PhaseType, Value>(project, ["expression", node.expression], ["questionDotToken", node.questionDotToken], ["name", node.name]);
    case "ElementAccessExpression":
      return children<PhaseType, Value>(project, ["expression", node.expression], ["questionDotToken", node.questionDotToken], ["argumentExpression", node.argumentExpression]);
    case "CallExpression":
      return children<PhaseType, Value>(project, ["expression", node.expression], ["questionDotToken", node.questionDotToken], ["typeArguments", node.typeArguments], ["arguments", node.arguments]);
    case "NewExpression":
      return children<PhaseType, Value>(project, ["expression", node.expression], ["typeArguments", node.typeArguments], ["arguments", node.arguments]);
    case "MetaProperty":
      return children<PhaseType, Value>(project, ["name", node.name]);
    case "TemplateExpression":
    case "TemplateLiteralType":
      return children<PhaseType, Value>(project, ["head", node.head], ["templateSpans", node.templateSpans]);
    case "TemplateSpan":
      return children<PhaseType, Value>(project, ["expression", node.expression], ["literal", node.literal]);
    case "TaggedTemplateExpression":
      return children<PhaseType, Value>(project, ["tag", node.tag], ["questionDotToken", node.questionDotToken], ["typeArguments", node.typeArguments], ["template", node.template]);
    case "ArrayLiteralExpression":
      return children<PhaseType, Value>(project, ["elements", node.elements]);
    case "ObjectLiteralExpression":
      return children<PhaseType, Value>(project, ["properties", node.properties]);
    case "ShorthandPropertyAssignment":
      return children<PhaseType, Value>(project, ["modifiers", node.modifiers], ["name", node.name], ["postfixToken", node.postfixToken], ["type", node.type],
        ["equalsToken", node.equalsToken], ["objectAssignmentInitializer", node.objectAssignmentInitializer]);
    case "TypeAssertionExpression":
      return children<PhaseType, Value>(project, ["type", node.type], ["expression", node.expression]);
    case "UnionType":
    case "IntersectionType":
      return children<PhaseType, Value>(project, ["types", node.types]);
    case "ConditionalType":
      return children<PhaseType, Value>(project, ["checkType", node.checkType], ["extendsType", node.extendsType], ["trueType", node.trueType], ["falseType", node.falseType]);
    case "TypeOperator":
    case "JSDocTypeExpression":
    case "JSDocNonNullableType":
    case "JSDocNullableType":
    case "JSDocVariadicType":
    case "JSDocOptionalType":
    case "OptionalType":
    case "RestType":
    case "ParenthesizedType":
      return children<PhaseType, Value>(project, ["type", node.type]);
    case "InferType":
      return children<PhaseType, Value>(project, ["typeParameter", node.typeParameter]);
    case "ArrayType":
      return children<PhaseType, Value>(project, ["elementType", node.elementType]);
    case "IndexedAccessType":
      return children<PhaseType, Value>(project, ["objectType", node.objectType], ["indexType", node.indexType]);
    case "TypeReference":
      return children<PhaseType, Value>(project, ["typeName", node.typeName], ["typeArguments", node.typeArguments]);
    case "ExpressionWithTypeArguments":
      return children<PhaseType, Value>(project, ["expression", node.expression], ["typeArguments", node.typeArguments]);
    case "LiteralType":
      return children<PhaseType, Value>(project, ["literal", node.literal]);
    case "TypePredicate":
      return children<PhaseType, Value>(project, ["assertsModifier", node.assertsModifier], ["parameterName", node.parameterName], ["type", node.type]);
    case "ImportAttribute":
      return children<PhaseType, Value>(project, ["name", node.name], ["value", node.value]);
    case "ImportAttributes":
      return children<PhaseType, Value>(project, ["attributes", node.attributes]);
    case "TypeQuery":
      return children<PhaseType, Value>(project, ["exprName", node.exprName], ["typeArguments", node.typeArguments]);
    case "MappedType":
      return children<PhaseType, Value>(project, ["readonlyToken", node.readonlyToken], ["typeParameter", node.typeParameter], ["nameType", node.nameType],
        ["questionToken", node.questionToken], ["type", node.type], ["members", node.members]);
    case "TypeLiteral":
      return children<PhaseType, Value>(project, ["members", node.members]);
    case "TupleType":
      return children<PhaseType, Value>(project, ["elements", node.elements]);
    case "NamedTupleMember":
      return children<PhaseType, Value>(project, ["dotDotDotToken", node.dotDotDotToken], ["name", node.name], ["questionToken", node.questionToken], ["type", node.type]);
    case "ConstructorType":
      return children<PhaseType, Value>(project, ["modifiers", node.modifiers], ["typeParameters", node.typeParameters], ["parameters", node.parameters], ["type", node.type], ["fullSignature", node.fullSignature]);
    case "TemplateLiteralTypeSpan":
      return children<PhaseType, Value>(project, ["type", node.type], ["literal", node.literal]);
    case "JsxElement":
      return children<PhaseType, Value>(project, ["openingElement", node.openingElement], ["children", node.children], ["closingElement", node.closingElement]);
    case "JsxAttributes":
      return children<PhaseType, Value>(project, ["properties", node.properties]);
    case "JsxNamespacedName":
      return children<PhaseType, Value>(project, ["namespace", node.namespace], ["name", node.name]);
    case "JsxOpeningElement":
    case "JsxSelfClosingElement":
      return children<PhaseType, Value>(project, ["tagName", node.tagName], ["typeArguments", node.typeArguments], ["attributes", node.attributes]);
    case "JsxFragment":
      return children<PhaseType, Value>(project, ["openingFragment", node.openingFragment], ["children", node.children], ["closingFragment", node.closingFragment]);
    case "JsxAttribute":
      return children<PhaseType, Value>(project, ["name", node.name], ["initializer", node.initializer]);
    case "JsxClosingElement":
      return children<PhaseType, Value>(project, ["tagName", node.tagName]);
    case "JsxExpression":
      return children<PhaseType, Value>(project, ["dotDotDotToken", node.dotDotDotToken], ["expression", node.expression]);
    case "SyntaxList":
      return children<PhaseType, Value>(project, ["children", node.children]);
    case "JSDoc":
      return children<PhaseType, Value>(project, ["comment", node.comment], ["tags", node.tags]);
    case "JSDocTypeTag":
    case "JSDocReturnTag":
    case "JSDocSatisfiesTag":
    case "JSDocThrowsTag":
    case "JSDocThisTag":
    case "JSDocOverloadTag":
      return children<PhaseType, Value>(project, ["tagName", node.tagName], ["typeExpression", node.typeExpression], ["comment", node.comment]);
    case "JSDocUnknownTag":
    case "JSDocPublicTag":
    case "JSDocPrivateTag":
    case "JSDocProtectedTag":
    case "JSDocReadonlyTag":
    case "JSDocOverrideTag":
    case "JSDocDeprecatedTag":
      return children<PhaseType, Value>(project, ["tagName", node.tagName], ["comment", node.comment]);
    case "JSDocSeeTag":
      return children<PhaseType, Value>(project, ["tagName", node.tagName], ["nameExpression", node.nameExpression], ["comment", node.comment]);
    case "JSDocTemplateTag":
      return children<PhaseType, Value>(project, ["tagName", node.tagName], ["constraint", node.constraint], ["typeParameters", node.typeParameters], ["comment", node.comment]);
    case "JSDocImplementsTag":
    case "JSDocAugmentsTag":
      return children<PhaseType, Value>(project, ["tagName", node.tagName], ["className", node.className], ["comment", node.comment]);
    case "JSDocImportTag":
      return children<PhaseType, Value>(project, ["tagName", node.tagName], ["importClause", node.importClause], ["moduleSpecifier", node.moduleSpecifier],
        ["attributes", node.attributes], ["comment", node.comment]);
    case "JSDocCallbackTag":
    case "JSDocTypedefTag":
      return children<PhaseType, Value>(project, ["tagName", node.tagName], ["typeExpression", node.typeExpression], ["name", node.name], ["comment", node.comment]);
    case "SourceFile":
      return children<PhaseType, Value>(project, ["statements", node.statements], ["endOfFileToken", node.endOfFileToken]);
    case "ModuleDeclaration":
      return children<PhaseType, Value>(project, ["modifiers", node.modifiers], ["asteriskToken", node.asteriskToken], ["name", node.name], ["body", node.body]);
    case "ImportEqualsDeclaration":
      return children<PhaseType, Value>(project, ["modifiers", node.modifiers], ["name", node.name], ["moduleReference", node.moduleReference]);
    case "ExportDeclaration":
      return children<PhaseType, Value>(project, ["modifiers", node.modifiers], ["exportClause", node.exportClause], ["moduleSpecifier", node.moduleSpecifier], ["attributes", node.attributes]);
    case "ImportType":
      return children<PhaseType, Value>(project, ["argument", node.argument], ["attributes", node.attributes], ["qualifier", node.qualifier], ["typeArguments", node.typeArguments]);
    case "ImportClause":
      return children<PhaseType, Value>(project, ["name", node.name], ["namedBindings", node.namedBindings]);
    case "TypeParameter":
      return children<PhaseType, Value>(project, ["modifiers", node.modifiers], ["name", node.name], ["constraint", node.constraint], ["expression", node.expression], ["defaultType", node.defaultType]);
    case "SyntheticReferenceExpression":
      return children<PhaseType, Value>(project, ["expression", node.expression], ["thisArg", node.thisArg]);
    case "JSDocTypeLiteral":
      return children<PhaseType, Value>(project, ["jsDocPropertyTags", node.jsDocPropertyTags]);
    case "JSDocParameterTag":
    case "JSDocPropertyTag":
      return children<PhaseType, Value>(project, ["tagName", node.tagName], ["name", node.name], ["typeExpression", node.typeExpression], ["comment", node.comment]);
    case "AnyKeyword":
    case "BigIntKeyword":
    case "BooleanKeyword":
    case "IntrinsicKeyword":
    case "NeverKeyword":
    case "NumberKeyword":
    case "ObjectKeyword":
    case "StringKeyword":
    case "SymbolKeyword":
    case "UndefinedKeyword":
    case "UnknownKeyword":
    case "VoidKeyword":
    case "NullKeyword":
    case "TrueKeyword":
    case "FalseKeyword":
    case "ThisKeyword":
    case "SuperKeyword":
    case "ImportKeyword":
    case "Unknown":
    case "EndOfFile":
    case "SingleLineCommentTrivia":
    case "MultiLineCommentTrivia":
    case "NewLineTrivia":
    case "WhitespaceTrivia":
    case "ConflictMarkerTrivia":
    case "NonTextFileMarkerTrivia":
    case "JsxTextAllWhiteSpaces":
    case "OpenBraceToken":
    case "CloseBraceToken":
    case "OpenParenToken":
    case "CloseParenToken":
    case "OpenBracketToken":
    case "CloseBracketToken":
    case "DotToken":
    case "DotDotDotToken":
    case "SemicolonToken":
    case "CommaToken":
    case "QuestionDotToken":
    case "LessThanToken":
    case "LessThanSlashToken":
    case "GreaterThanToken":
    case "LessThanEqualsToken":
    case "GreaterThanEqualsToken":
    case "EqualsEqualsToken":
    case "ExclamationEqualsToken":
    case "EqualsEqualsEqualsToken":
    case "ExclamationEqualsEqualsToken":
    case "EqualsGreaterThanToken":
    case "PlusToken":
    case "MinusToken":
    case "AsteriskToken":
    case "AsteriskAsteriskToken":
    case "SlashToken":
    case "PercentToken":
    case "PlusPlusToken":
    case "MinusMinusToken":
    case "LessThanLessThanToken":
    case "GreaterThanGreaterThanToken":
    case "GreaterThanGreaterThanGreaterThanToken":
    case "AmpersandToken":
    case "BarToken":
    case "CaretToken":
    case "ExclamationToken":
    case "TildeToken":
    case "AmpersandAmpersandToken":
    case "BarBarToken":
    case "QuestionToken":
    case "ColonToken":
    case "AtToken":
    case "QuestionQuestionToken":
    case "BacktickToken":
    case "HashToken":
    case "EqualsToken":
    case "PlusEqualsToken":
    case "MinusEqualsToken":
    case "AsteriskEqualsToken":
    case "AsteriskAsteriskEqualsToken":
    case "SlashEqualsToken":
    case "PercentEqualsToken":
    case "LessThanLessThanEqualsToken":
    case "GreaterThanGreaterThanEqualsToken":
    case "GreaterThanGreaterThanGreaterThanEqualsToken":
    case "AmpersandEqualsToken":
    case "BarEqualsToken":
    case "BarBarEqualsToken":
    case "AmpersandAmpersandEqualsToken":
    case "QuestionQuestionEqualsToken":
    case "CaretEqualsToken":
    case "JSDocCommentTextToken":
    case "BreakKeyword":
    case "CaseKeyword":
    case "CatchKeyword":
    case "ClassKeyword":
    case "ConstKeyword":
    case "ContinueKeyword":
    case "DebuggerKeyword":
    case "DefaultKeyword":
    case "DeleteKeyword":
    case "DoKeyword":
    case "ElseKeyword":
    case "EnumKeyword":
    case "ExportKeyword":
    case "ExtendsKeyword":
    case "FinallyKeyword":
    case "ForKeyword":
    case "FunctionKeyword":
    case "IfKeyword":
    case "InKeyword":
    case "InstanceOfKeyword":
    case "NewKeyword":
    case "ReturnKeyword":
    case "SwitchKeyword":
    case "ThrowKeyword":
    case "TryKeyword":
    case "TypeOfKeyword":
    case "VarKeyword":
    case "WhileKeyword":
    case "WithKeyword":
    case "ImplementsKeyword":
    case "InterfaceKeyword":
    case "LetKeyword":
    case "PackageKeyword":
    case "PrivateKeyword":
    case "ProtectedKeyword":
    case "PublicKeyword":
    case "StaticKeyword":
    case "YieldKeyword":
    case "AbstractKeyword":
    case "AccessorKeyword":
    case "AsKeyword":
    case "AssertsKeyword":
    case "AssertKeyword":
    case "AsyncKeyword":
    case "AwaitKeyword":
    case "ConstructorKeyword":
    case "DeclareKeyword":
    case "GetKeyword":
    case "ImmediateKeyword":
    case "InferKeyword":
    case "IsKeyword":
    case "KeyOfKeyword":
    case "ModuleKeyword":
    case "NamespaceKeyword":
    case "OutKeyword":
    case "ReadonlyKeyword":
    case "RequireKeyword":
    case "SatisfiesKeyword":
    case "SetKeyword":
    case "TypeKeyword":
    case "UniqueKeyword":
    case "UsingKeyword":
    case "FromKeyword":
    case "GlobalKeyword":
    case "OverrideKeyword":
    case "OfKeyword":
    case "DeferKeyword":
    case "Identifier":
    case "PrivateIdentifier":
    case "EmptyStatement":
    case "DebuggerStatement":
    case "NotEmittedStatement":
    case "NotEmittedTypeElement":
    case "SemicolonClassElement":
    case "OmittedExpression":
    case "StringLiteral":
    case "NumericLiteral":
    case "BigIntLiteral":
    case "RegularExpressionLiteral":
    case "NoSubstitutionTemplateLiteral":
    case "ThisType":
    case "TemplateHead":
    case "TemplateMiddle":
    case "TemplateTail":
    case "JsxText":
    case "JsxOpeningFragment":
    case "JsxClosingFragment":
    case "JSDocAllType":
    case "JSDocText":
      return emptyChildren;
  }
}

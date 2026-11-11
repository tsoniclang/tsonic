import type { ChildrenOfSyntax, Phase, SyntaxNode, NodeList } from "./contract.js";

const emptyChildren: readonly never[] = Object.freeze([]);

export interface SyntaxChild<PhaseType extends Phase> {
  readonly node: SyntaxNode<PhaseType>;
  readonly fields: readonly (string | number)[];
}

function children<PhaseType extends Phase>(
  ...parts: readonly (readonly [string, SyntaxNode<PhaseType> | NodeList<SyntaxNode<PhaseType>> | readonly SyntaxNode<PhaseType>[] | null])[]
): readonly SyntaxChild<PhaseType>[] {
  const result: SyntaxChild<PhaseType>[] = [];
  for (const [field, part] of parts) {
    if (part === null) continue;
    if ("kind" in part) result.push({ node: part, fields: [field] });
    else if ("nodes" in part) {
      for (const [index, node] of part.nodes.entries()) result.push({ node, fields: [field, "nodes", index] });
    } else {
      for (const [index, node] of part.entries()) result.push({ node, fields: [field, index] });
    }
  }
  return Object.freeze(result);
}

export const childrenOfSyntax: ChildrenOfSyntax = <PhaseType extends Phase>(
  node: SyntaxNode<PhaseType>,
): readonly SyntaxNode<PhaseType>[] => Object.freeze(syntaxChildEdges(node).map(child => child.node));

export function syntaxChildEdges<PhaseType extends Phase>(
  node: SyntaxNode<PhaseType>,
): readonly SyntaxChild<PhaseType>[] {
  switch (node.kind) {
    case "QualifiedName":
      return children<PhaseType>(["left", node.left], ["right", node.right]);
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
      return children<PhaseType>(["expression", node.expression]);
    case "IfStatement":
      return children<PhaseType>(["expression", node.expression], ["thenStatement", node.thenStatement], ["elseStatement", node.elseStatement]);
    case "DoStatement":
      return children<PhaseType>(["statement", node.statement], ["expression", node.expression]);
    case "WhileStatement":
    case "WithStatement":
      return children<PhaseType>(["expression", node.expression], ["statement", node.statement]);
    case "ForStatement":
      return children<PhaseType>(["initializer", node.initializer], ["condition", node.condition], ["incrementor", node.incrementor], ["statement", node.statement]);
    case "ForInStatement":
    case "ForOfStatement":
      return children<PhaseType>(["awaitModifier", node.awaitModifier], ["initializer", node.initializer], ["expression", node.expression], ["statement", node.statement]);
    case "BreakStatement":
    case "ContinueStatement":
      return children<PhaseType>(["label", node.label]);
    case "SwitchStatement":
      return children<PhaseType>(["expression", node.expression], ["caseBlock", node.caseBlock]);
    case "CaseBlock":
      return children<PhaseType>(["clauses", node.clauses]);
    case "CaseClause":
    case "DefaultClause":
      return children<PhaseType>(["expression", node.expression], ["statements", node.statements]);
    case "TryStatement":
      return children<PhaseType>(["tryBlock", node.tryBlock], ["catchClause", node.catchClause], ["finallyBlock", node.finallyBlock]);
    case "CatchClause":
      return children<PhaseType>(["variableDeclaration", node.variableDeclaration], ["block", node.block]);
    case "LabeledStatement":
      return children<PhaseType>(["label", node.label], ["statement", node.statement]);
    case "Block":
    case "ModuleBlock":
      return children<PhaseType>(["statements", node.statements]);
    case "VariableStatement":
      return children<PhaseType>(["modifiers", node.modifiers], ["declarationList", node.declarationList]);
    case "VariableDeclaration":
      return children<PhaseType>(["name", node.name], ["exclamationToken", node.exclamationToken], ["type", node.type], ["initializer", node.initializer]);
    case "VariableDeclarationList":
      return children<PhaseType>(["declarations", node.declarations]);
    case "ObjectBindingPattern":
    case "ArrayBindingPattern":
      return children<PhaseType>(["elements", node.elements]);
    case "Parameter":
      return children<PhaseType>(["modifiers", node.modifiers], ["dotDotDotToken", node.dotDotDotToken], ["name", node.name],
        ["questionToken", node.questionToken], ["type", node.type], ["initializer", node.initializer]);
    case "BindingElement":
      return children<PhaseType>(["dotDotDotToken", node.dotDotDotToken], ["propertyName", node.propertyName], ["name", node.name], ["initializer", node.initializer]);
    case "MissingDeclaration":
      return children<PhaseType>(["modifiers", node.modifiers]);
    case "FunctionDeclaration":
    case "FunctionExpression":
      return children<PhaseType>(["modifiers", node.modifiers], ["asteriskToken", node.asteriskToken], ["name", node.name],
        ["typeParameters", node.typeParameters], ["parameters", node.parameters], ["type", node.type], ["fullSignature", node.fullSignature], ["body", node.body]);
    case "ClassDeclaration":
    case "ClassExpression":
    case "InterfaceDeclaration":
      return children<PhaseType>(["modifiers", node.modifiers], ["name", node.name], ["typeParameters", node.typeParameters],
        ["heritageClauses", node.heritageClauses], ["members", node.members]);
    case "HeritageClause":
      return children<PhaseType>(["types", node.types]);
    case "TypeAliasDeclaration":
    case "JSTypeAliasDeclaration":
      return children<PhaseType>(["modifiers", node.modifiers], ["name", node.name], ["typeParameters", node.typeParameters], ["type", node.type]);
    case "EnumMember":
      return children<PhaseType>(["modifiers", node.modifiers], ["name", node.name], ["postfixToken", node.postfixToken], ["initializer", node.initializer]);
    case "EnumDeclaration":
      return children<PhaseType>(["modifiers", node.modifiers], ["name", node.name], ["members", node.members]);
    case "ImportDeclaration":
    case "JSImportDeclaration":
      return children<PhaseType>(["modifiers", node.modifiers], ["importClause", node.importClause], ["moduleSpecifier", node.moduleSpecifier], ["attributes", node.attributes]);
    case "NamespaceImport":
    case "NamespaceExport":
    case "JSDocNameReference":
    case "JSDocLink":
    case "JSDocLinkPlain":
    case "JSDocLinkCode":
      return children<PhaseType>(["name", node.name]);
    case "NamedImports":
    case "NamedExports":
      return children<PhaseType>(["elements", node.elements]);
    case "ExportAssignment":
      return children<PhaseType>(["modifiers", node.modifiers], ["type", node.type], ["expression", node.expression]);
    case "NamespaceExportDeclaration":
      return children<PhaseType>(["modifiers", node.modifiers], ["name", node.name]);
    case "ExportSpecifier":
    case "ImportSpecifier":
      return children<PhaseType>(["propertyName", node.propertyName], ["name", node.name]);
    case "CallSignature":
    case "ConstructSignature":
    case "JSDocSignature":
      return children<PhaseType>(["typeParameters", node.typeParameters], ["parameters", node.parameters], ["type", node.type], ["fullSignature", node.fullSignature]);
    case "FunctionType":
      return children<PhaseType>(["modifiers", node.modifiers], ["typeParameters", node.typeParameters], ["parameters", node.parameters], ["type", node.type], ["fullSignature", node.fullSignature]);
    case "Constructor":
      return children<PhaseType>(["modifiers", node.modifiers], ["typeParameters", node.typeParameters], ["parameters", node.parameters],
        ["type", node.type], ["fullSignature", node.fullSignature], ["asteriskToken", node.asteriskToken], ["body", node.body]);
    case "GetAccessor":
    case "SetAccessor":
      return children<PhaseType>(["modifiers", node.modifiers], ["asteriskToken", node.asteriskToken], ["name", node.name], ["postfixToken", node.postfixToken],
        ["typeParameters", node.typeParameters], ["parameters", node.parameters], ["type", node.type], ["fullSignature", node.fullSignature], ["body", node.body]);
    case "IndexSignature":
      return children<PhaseType>(["modifiers", node.modifiers], ["typeParameters", node.typeParameters], ["parameters", node.parameters], ["type", node.type], ["fullSignature", node.fullSignature]);
    case "MethodSignature":
      return children<PhaseType>(["modifiers", node.modifiers], ["name", node.name], ["postfixToken", node.postfixToken],
        ["typeParameters", node.typeParameters], ["parameters", node.parameters], ["type", node.type], ["fullSignature", node.fullSignature]);
    case "MethodDeclaration":
      return children<PhaseType>(["modifiers", node.modifiers], ["asteriskToken", node.asteriskToken], ["name", node.name], ["postfixToken", node.postfixToken],
        ["typeParameters", node.typeParameters], ["parameters", node.parameters], ["type", node.type], ["fullSignature", node.fullSignature], ["body", node.body]);
    case "PropertySignature":
    case "PropertyDeclaration":
    case "PropertyAssignment":
      return children<PhaseType>(["modifiers", node.modifiers], ["name", node.name], ["postfixToken", node.postfixToken], ["type", node.type], ["initializer", node.initializer]);
    case "ClassStaticBlockDeclaration":
      return children<PhaseType>(["modifiers", node.modifiers], ["body", node.body]);
    case "BinaryExpression":
      return children<PhaseType>(["modifiers", node.modifiers], ["left", node.left], ["type", node.type], ["operatorToken", node.operatorToken], ["right", node.right]);
    case "PrefixUnaryExpression":
    case "PostfixUnaryExpression":
      return children<PhaseType>(["operand", node.operand]);
    case "YieldExpression":
      return children<PhaseType>(["asteriskToken", node.asteriskToken], ["expression", node.expression]);
    case "ArrowFunction":
      return children<PhaseType>(["modifiers", node.modifiers], ["typeParameters", node.typeParameters], ["parameters", node.parameters],
        ["type", node.type], ["fullSignature", node.fullSignature], ["asteriskToken", node.asteriskToken], ["equalsGreaterThanToken", node.equalsGreaterThanToken], ["body", node.body]);
    case "AsExpression":
    case "SatisfiesExpression":
      return children<PhaseType>(["expression", node.expression], ["type", node.type]);
    case "ConditionalExpression":
      return children<PhaseType>(["condition", node.condition], ["questionToken", node.questionToken], ["whenTrue", node.whenTrue], ["colonToken", node.colonToken], ["whenFalse", node.whenFalse]);
    case "PropertyAccessExpression":
      return children<PhaseType>(["expression", node.expression], ["questionDotToken", node.questionDotToken], ["name", node.name]);
    case "ElementAccessExpression":
      return children<PhaseType>(["expression", node.expression], ["questionDotToken", node.questionDotToken], ["argumentExpression", node.argumentExpression]);
    case "CallExpression":
      return children<PhaseType>(["expression", node.expression], ["questionDotToken", node.questionDotToken], ["typeArguments", node.typeArguments], ["arguments", node.arguments]);
    case "NewExpression":
      return children<PhaseType>(["expression", node.expression], ["typeArguments", node.typeArguments], ["arguments", node.arguments]);
    case "MetaProperty":
      return children<PhaseType>(["name", node.name]);
    case "TemplateExpression":
    case "TemplateLiteralType":
      return children<PhaseType>(["head", node.head], ["templateSpans", node.templateSpans]);
    case "TemplateSpan":
      return children<PhaseType>(["expression", node.expression], ["literal", node.literal]);
    case "TaggedTemplateExpression":
      return children<PhaseType>(["tag", node.tag], ["questionDotToken", node.questionDotToken], ["typeArguments", node.typeArguments], ["template", node.template]);
    case "ArrayLiteralExpression":
      return children<PhaseType>(["elements", node.elements]);
    case "ObjectLiteralExpression":
      return children<PhaseType>(["properties", node.properties]);
    case "ShorthandPropertyAssignment":
      return children<PhaseType>(["modifiers", node.modifiers], ["name", node.name], ["postfixToken", node.postfixToken], ["type", node.type],
        ["equalsToken", node.equalsToken], ["objectAssignmentInitializer", node.objectAssignmentInitializer]);
    case "TypeAssertionExpression":
      return children<PhaseType>(["type", node.type], ["expression", node.expression]);
    case "UnionType":
    case "IntersectionType":
      return children<PhaseType>(["types", node.types]);
    case "ConditionalType":
      return children<PhaseType>(["checkType", node.checkType], ["extendsType", node.extendsType], ["trueType", node.trueType], ["falseType", node.falseType]);
    case "TypeOperator":
    case "JSDocTypeExpression":
    case "JSDocNonNullableType":
    case "JSDocNullableType":
    case "JSDocVariadicType":
    case "JSDocOptionalType":
    case "OptionalType":
    case "RestType":
    case "ParenthesizedType":
      return children<PhaseType>(["type", node.type]);
    case "InferType":
      return children<PhaseType>(["typeParameter", node.typeParameter]);
    case "ArrayType":
      return children<PhaseType>(["elementType", node.elementType]);
    case "IndexedAccessType":
      return children<PhaseType>(["objectType", node.objectType], ["indexType", node.indexType]);
    case "TypeReference":
      return children<PhaseType>(["typeName", node.typeName], ["typeArguments", node.typeArguments]);
    case "ExpressionWithTypeArguments":
      return children<PhaseType>(["expression", node.expression], ["typeArguments", node.typeArguments]);
    case "LiteralType":
      return children<PhaseType>(["literal", node.literal]);
    case "TypePredicate":
      return children<PhaseType>(["assertsModifier", node.assertsModifier], ["parameterName", node.parameterName], ["type", node.type]);
    case "ImportAttribute":
      return children<PhaseType>(["name", node.name], ["value", node.value]);
    case "ImportAttributes":
      return children<PhaseType>(["attributes", node.attributes]);
    case "TypeQuery":
      return children<PhaseType>(["exprName", node.exprName], ["typeArguments", node.typeArguments]);
    case "MappedType":
      return children<PhaseType>(["readonlyToken", node.readonlyToken], ["typeParameter", node.typeParameter], ["nameType", node.nameType],
        ["questionToken", node.questionToken], ["type", node.type], ["members", node.members]);
    case "TypeLiteral":
      return children<PhaseType>(["members", node.members]);
    case "TupleType":
      return children<PhaseType>(["elements", node.elements]);
    case "NamedTupleMember":
      return children<PhaseType>(["dotDotDotToken", node.dotDotDotToken], ["name", node.name], ["questionToken", node.questionToken], ["type", node.type]);
    case "ConstructorType":
      return children<PhaseType>(["modifiers", node.modifiers], ["typeParameters", node.typeParameters], ["parameters", node.parameters], ["type", node.type], ["fullSignature", node.fullSignature]);
    case "TemplateLiteralTypeSpan":
      return children<PhaseType>(["type", node.type], ["literal", node.literal]);
    case "JsxElement":
      return children<PhaseType>(["openingElement", node.openingElement], ["children", node.children], ["closingElement", node.closingElement]);
    case "JsxAttributes":
      return children<PhaseType>(["properties", node.properties]);
    case "JsxNamespacedName":
      return children<PhaseType>(["namespace", node.namespace], ["name", node.name]);
    case "JsxOpeningElement":
    case "JsxSelfClosingElement":
      return children<PhaseType>(["tagName", node.tagName], ["typeArguments", node.typeArguments], ["attributes", node.attributes]);
    case "JsxFragment":
      return children<PhaseType>(["openingFragment", node.openingFragment], ["children", node.children], ["closingFragment", node.closingFragment]);
    case "JsxAttribute":
      return children<PhaseType>(["name", node.name], ["initializer", node.initializer]);
    case "JsxClosingElement":
      return children<PhaseType>(["tagName", node.tagName]);
    case "JsxExpression":
      return children<PhaseType>(["dotDotDotToken", node.dotDotDotToken], ["expression", node.expression]);
    case "SyntaxList":
      return children<PhaseType>(["children", node.children]);
    case "JSDoc":
      return children<PhaseType>(["comment", node.comment], ["tags", node.tags]);
    case "JSDocTypeTag":
    case "JSDocReturnTag":
    case "JSDocSatisfiesTag":
    case "JSDocThrowsTag":
    case "JSDocThisTag":
    case "JSDocOverloadTag":
      return children<PhaseType>(["tagName", node.tagName], ["typeExpression", node.typeExpression], ["comment", node.comment]);
    case "JSDocUnknownTag":
    case "JSDocPublicTag":
    case "JSDocPrivateTag":
    case "JSDocProtectedTag":
    case "JSDocReadonlyTag":
    case "JSDocOverrideTag":
    case "JSDocDeprecatedTag":
      return children<PhaseType>(["tagName", node.tagName], ["comment", node.comment]);
    case "JSDocSeeTag":
      return children<PhaseType>(["tagName", node.tagName], ["nameExpression", node.nameExpression], ["comment", node.comment]);
    case "JSDocTemplateTag":
      return children<PhaseType>(["tagName", node.tagName], ["constraint", node.constraint], ["typeParameters", node.typeParameters], ["comment", node.comment]);
    case "JSDocImplementsTag":
    case "JSDocAugmentsTag":
      return children<PhaseType>(["tagName", node.tagName], ["className", node.className], ["comment", node.comment]);
    case "JSDocImportTag":
      return children<PhaseType>(["tagName", node.tagName], ["importClause", node.importClause], ["moduleSpecifier", node.moduleSpecifier],
        ["attributes", node.attributes], ["comment", node.comment]);
    case "JSDocCallbackTag":
    case "JSDocTypedefTag":
      return children<PhaseType>(["tagName", node.tagName], ["typeExpression", node.typeExpression], ["name", node.name], ["comment", node.comment]);
    case "SourceFile":
      return children<PhaseType>(["statements", node.statements], ["endOfFileToken", node.endOfFileToken]);
    case "ModuleDeclaration":
      return children<PhaseType>(["modifiers", node.modifiers], ["asteriskToken", node.asteriskToken], ["name", node.name], ["body", node.body]);
    case "ImportEqualsDeclaration":
      return children<PhaseType>(["modifiers", node.modifiers], ["name", node.name], ["moduleReference", node.moduleReference]);
    case "ExportDeclaration":
      return children<PhaseType>(["modifiers", node.modifiers], ["exportClause", node.exportClause], ["moduleSpecifier", node.moduleSpecifier], ["attributes", node.attributes]);
    case "ImportType":
      return children<PhaseType>(["argument", node.argument], ["attributes", node.attributes], ["qualifier", node.qualifier], ["typeArguments", node.typeArguments]);
    case "ImportClause":
      return children<PhaseType>(["name", node.name], ["namedBindings", node.namedBindings]);
    case "TypeParameter":
      return children<PhaseType>(["modifiers", node.modifiers], ["name", node.name], ["constraint", node.constraint], ["expression", node.expression], ["defaultType", node.defaultType]);
    case "SyntheticReferenceExpression":
      return children<PhaseType>(["expression", node.expression], ["thisArg", node.thisArg]);
    case "JSDocTypeLiteral":
      return children<PhaseType>(["jsDocPropertyTags", node.jsDocPropertyTags]);
    case "JSDocParameterTag":
    case "JSDocPropertyTag":
      return children<PhaseType>(["tagName", node.tagName], ["name", node.name], ["typeExpression", node.typeExpression], ["comment", node.comment]);
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

import type { ChildrenOfSyntax, Phase, SyntaxNode, NodeList } from "./contract.js";

const emptyChildren: readonly never[] = Object.freeze([]);

function children<PhaseType extends Phase>(
  ...parts: readonly (SyntaxNode<PhaseType> | NodeList<SyntaxNode<PhaseType>> | null)[]
): readonly SyntaxNode<PhaseType>[] {
  const result: SyntaxNode<PhaseType>[] = [];
  for (const part of parts) {
    if (part === null) continue;
    if ("nodes" in part) {
      for (const node of part.nodes) result.push(node);
    } else {
      result.push(part);
    }
  }
  return Object.freeze(result);
}

export const childrenOfSyntax: ChildrenOfSyntax = <PhaseType extends Phase>(
  node: SyntaxNode<PhaseType>,
): readonly SyntaxNode<PhaseType>[] => {
  switch (node.kind) {
    case "QualifiedName":
      return children<PhaseType>(node.left, node.right);
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
      return children<PhaseType>(node.expression);
    case "IfStatement":
      return children<PhaseType>(node.expression, node.thenStatement, node.elseStatement);
    case "DoStatement":
      return children<PhaseType>(node.statement, node.expression);
    case "WhileStatement":
    case "WithStatement":
      return children<PhaseType>(node.expression, node.statement);
    case "ForStatement":
      return children<PhaseType>(node.initializer, node.condition, node.incrementor, node.statement);
    case "ForInStatement":
    case "ForOfStatement":
      return children<PhaseType>(node.awaitModifier, node.initializer, node.expression, node.statement);
    case "BreakStatement":
    case "ContinueStatement":
      return children<PhaseType>(node.label);
    case "SwitchStatement":
      return children<PhaseType>(node.expression, node.caseBlock);
    case "CaseBlock":
      return children<PhaseType>(node.clauses);
    case "CaseClause":
    case "DefaultClause":
      return children<PhaseType>(node.expression, node.statements);
    case "TryStatement":
      return children<PhaseType>(node.tryBlock, node.catchClause, node.finallyBlock);
    case "CatchClause":
      return children<PhaseType>(node.variableDeclaration, node.block);
    case "LabeledStatement":
      return children<PhaseType>(node.label, node.statement);
    case "Block":
    case "ModuleBlock":
      return children<PhaseType>(node.statements);
    case "VariableStatement":
      return children<PhaseType>(node.modifiers, node.declarationList);
    case "VariableDeclaration":
      return children<PhaseType>(node.name, node.exclamationToken, node.type, node.initializer);
    case "VariableDeclarationList":
      return children<PhaseType>(node.declarations);
    case "ObjectBindingPattern":
    case "ArrayBindingPattern":
      return children<PhaseType>(node.elements);
    case "Parameter":
      return children<PhaseType>(node.modifiers, node.dotDotDotToken, node.name,
        node.questionToken, node.type, node.initializer);
    case "BindingElement":
      return children<PhaseType>(node.dotDotDotToken, node.propertyName, node.name, node.initializer);
    case "MissingDeclaration":
      return children<PhaseType>(node.modifiers);
    case "FunctionDeclaration":
    case "FunctionExpression":
      return children<PhaseType>(node.modifiers, node.asteriskToken, node.name,
        node.typeParameters, node.parameters, node.type, node.fullSignature, node.body);
    case "ClassDeclaration":
    case "ClassExpression":
    case "InterfaceDeclaration":
      return children<PhaseType>(node.modifiers, node.name, node.typeParameters,
        node.heritageClauses, node.members);
    case "HeritageClause":
      return children<PhaseType>(node.types);
    case "TypeAliasDeclaration":
    case "JSTypeAliasDeclaration":
      return children<PhaseType>(node.modifiers, node.name, node.typeParameters, node.type);
    case "EnumMember":
      return children<PhaseType>(node.modifiers, node.name, node.postfixToken, node.initializer);
    case "EnumDeclaration":
      return children<PhaseType>(node.modifiers, node.name, node.members);
    case "ImportDeclaration":
    case "JSImportDeclaration":
      return children<PhaseType>(node.modifiers, node.importClause, node.moduleSpecifier, node.attributes);
    case "NamespaceImport":
    case "NamespaceExport":
    case "JSDocNameReference":
    case "JSDocLink":
    case "JSDocLinkPlain":
    case "JSDocLinkCode":
      return children<PhaseType>(node.name);
    case "NamedImports":
    case "NamedExports":
      return children<PhaseType>(node.elements);
    case "ExportAssignment":
      return children<PhaseType>(node.modifiers, node.type, node.expression);
    case "NamespaceExportDeclaration":
      return children<PhaseType>(node.modifiers, node.name);
    case "ExportSpecifier":
    case "ImportSpecifier":
      return children<PhaseType>(node.propertyName, node.name);
    case "CallSignature":
    case "ConstructSignature":
    case "JSDocSignature":
      return children<PhaseType>(node.typeParameters, node.parameters, node.type, node.fullSignature);
    case "FunctionType":
      return children<PhaseType>(node.modifiers, node.typeParameters, node.parameters, node.type, node.fullSignature);
    case "Constructor":
      return children<PhaseType>(node.modifiers, node.typeParameters, node.parameters,
        node.type, node.fullSignature, node.asteriskToken, node.body);
    case "GetAccessor":
    case "SetAccessor":
      return children<PhaseType>(node.modifiers, node.asteriskToken, node.name, node.postfixToken,
        node.typeParameters, node.parameters, node.type, node.fullSignature, node.body);
    case "IndexSignature":
      return children<PhaseType>(node.modifiers, node.typeParameters, node.parameters, node.type, node.fullSignature);
    case "MethodSignature":
      return children<PhaseType>(node.modifiers, node.name, node.postfixToken,
        node.typeParameters, node.parameters, node.type, node.fullSignature);
    case "MethodDeclaration":
      return children<PhaseType>(node.modifiers, node.asteriskToken, node.name, node.postfixToken,
        node.typeParameters, node.parameters, node.type, node.fullSignature, node.body);
    case "PropertySignature":
    case "PropertyDeclaration":
    case "PropertyAssignment":
      return children<PhaseType>(node.modifiers, node.name, node.postfixToken, node.type, node.initializer);
    case "ClassStaticBlockDeclaration":
      return children<PhaseType>(node.modifiers, node.body);
    case "BinaryExpression":
      return children<PhaseType>(node.modifiers, node.left, node.type, node.operatorToken, node.right);
    case "PrefixUnaryExpression":
    case "PostfixUnaryExpression":
      return children<PhaseType>(node.operand);
    case "YieldExpression":
      return children<PhaseType>(node.asteriskToken, node.expression);
    case "ArrowFunction":
      return children<PhaseType>(node.modifiers, node.typeParameters, node.parameters,
        node.type, node.fullSignature, node.asteriskToken, node.equalsGreaterThanToken, node.body);
    case "AsExpression":
    case "SatisfiesExpression":
      return children<PhaseType>(node.expression, node.type);
    case "ConditionalExpression":
      return children<PhaseType>(node.condition, node.questionToken, node.whenTrue, node.colonToken, node.whenFalse);
    case "PropertyAccessExpression":
      return children<PhaseType>(node.expression, node.questionDotToken, node.name);
    case "ElementAccessExpression":
      return children<PhaseType>(node.expression, node.questionDotToken, node.argumentExpression);
    case "CallExpression":
      return children<PhaseType>(node.expression, node.questionDotToken, node.typeArguments, node.arguments);
    case "NewExpression":
      return children<PhaseType>(node.expression, node.typeArguments, node.arguments);
    case "MetaProperty":
      return children<PhaseType>(node.name);
    case "TemplateExpression":
    case "TemplateLiteralType":
      return children<PhaseType>(node.head, node.templateSpans);
    case "TemplateSpan":
      return children<PhaseType>(node.expression, node.literal);
    case "TaggedTemplateExpression":
      return children<PhaseType>(node.tag, node.questionDotToken, node.typeArguments, node.template);
    case "ArrayLiteralExpression":
      return children<PhaseType>(node.elements);
    case "ObjectLiteralExpression":
      return children<PhaseType>(node.properties);
    case "ShorthandPropertyAssignment":
      return children<PhaseType>(node.modifiers, node.name, node.postfixToken, node.type,
        node.equalsToken, node.objectAssignmentInitializer);
    case "TypeAssertionExpression":
      return children<PhaseType>(node.type, node.expression);
    case "UnionType":
    case "IntersectionType":
      return children<PhaseType>(node.types);
    case "ConditionalType":
      return children<PhaseType>(node.checkType, node.extendsType, node.trueType, node.falseType);
    case "TypeOperator":
    case "JSDocTypeExpression":
    case "JSDocNonNullableType":
    case "JSDocNullableType":
    case "JSDocVariadicType":
    case "JSDocOptionalType":
    case "OptionalType":
    case "RestType":
    case "ParenthesizedType":
      return children<PhaseType>(node.type);
    case "InferType":
      return children<PhaseType>(node.typeParameter);
    case "ArrayType":
      return children<PhaseType>(node.elementType);
    case "IndexedAccessType":
      return children<PhaseType>(node.objectType, node.indexType);
    case "TypeReference":
      return children<PhaseType>(node.typeName, node.typeArguments);
    case "ExpressionWithTypeArguments":
      return children<PhaseType>(node.expression, node.typeArguments);
    case "LiteralType":
      return children<PhaseType>(node.literal);
    case "TypePredicate":
      return children<PhaseType>(node.assertsModifier, node.parameterName, node.type);
    case "ImportAttribute":
      return children<PhaseType>(node.name, node.value);
    case "ImportAttributes":
      return children<PhaseType>(node.attributes);
    case "TypeQuery":
      return children<PhaseType>(node.exprName, node.typeArguments);
    case "MappedType":
      return children<PhaseType>(node.readonlyToken, node.typeParameter, node.nameType,
        node.questionToken, node.type, node.members);
    case "TypeLiteral":
      return children<PhaseType>(node.members);
    case "TupleType":
      return children<PhaseType>(node.elements);
    case "NamedTupleMember":
      return children<PhaseType>(node.dotDotDotToken, node.name, node.questionToken, node.type);
    case "ConstructorType":
      return children<PhaseType>(node.modifiers, node.typeParameters, node.parameters, node.type, node.fullSignature);
    case "TemplateLiteralTypeSpan":
      return children<PhaseType>(node.type, node.literal);
    case "JsxElement":
      return children<PhaseType>(node.openingElement, node.children, node.closingElement);
    case "JsxAttributes":
      return children<PhaseType>(node.properties);
    case "JsxNamespacedName":
      return children<PhaseType>(node.namespace, node.name);
    case "JsxOpeningElement":
    case "JsxSelfClosingElement":
      return children<PhaseType>(node.tagName, node.typeArguments, node.attributes);
    case "JsxFragment":
      return children<PhaseType>(node.openingFragment, node.children, node.closingFragment);
    case "JsxAttribute":
      return children<PhaseType>(node.name, node.initializer);
    case "JsxClosingElement":
      return children<PhaseType>(node.tagName);
    case "JsxExpression":
      return children<PhaseType>(node.dotDotDotToken, node.expression);
    case "SyntaxList":
      return Object.freeze([...node.children]);
    case "JSDoc":
      return children<PhaseType>(node.comment, node.tags);
    case "JSDocTypeTag":
    case "JSDocReturnTag":
    case "JSDocSatisfiesTag":
    case "JSDocThrowsTag":
    case "JSDocThisTag":
    case "JSDocOverloadTag":
      return children<PhaseType>(node.tagName, node.typeExpression, node.comment);
    case "JSDocUnknownTag":
    case "JSDocPublicTag":
    case "JSDocPrivateTag":
    case "JSDocProtectedTag":
    case "JSDocReadonlyTag":
    case "JSDocOverrideTag":
    case "JSDocDeprecatedTag":
      return children<PhaseType>(node.tagName, node.comment);
    case "JSDocSeeTag":
      return children<PhaseType>(node.tagName, node.nameExpression, node.comment);
    case "JSDocTemplateTag":
      return children<PhaseType>(node.tagName, node.constraint, node.typeParameters, node.comment);
    case "JSDocImplementsTag":
    case "JSDocAugmentsTag":
      return children<PhaseType>(node.tagName, node.className, node.comment);
    case "JSDocImportTag":
      return children<PhaseType>(node.tagName, node.importClause, node.moduleSpecifier,
        node.attributes, node.comment);
    case "JSDocCallbackTag":
    case "JSDocTypedefTag":
      return children<PhaseType>(node.tagName, node.typeExpression, node.name, node.comment);
    case "SourceFile":
      return children<PhaseType>(node.statements, node.endOfFileToken);
    case "ModuleDeclaration":
      return children<PhaseType>(node.modifiers, node.asteriskToken, node.name, node.body);
    case "ImportEqualsDeclaration":
      return children<PhaseType>(node.modifiers, node.name, node.moduleReference);
    case "ExportDeclaration":
      return children<PhaseType>(node.modifiers, node.exportClause, node.moduleSpecifier, node.attributes);
    case "ImportType":
      return children<PhaseType>(node.argument, node.attributes, node.qualifier, node.typeArguments);
    case "ImportClause":
      return children<PhaseType>(node.name, node.namedBindings);
    case "TypeParameter":
      return children<PhaseType>(node.modifiers, node.name, node.constraint, node.expression, node.defaultType);
    case "SyntheticReferenceExpression":
      return children<PhaseType>(node.expression, node.thisArg);
    case "JSDocTypeLiteral":
      return Object.freeze([...(node.jsDocPropertyTags ?? [])]);
    case "JSDocParameterTag":
    case "JSDocPropertyTag":
      return children<PhaseType>(node.tagName, node.name, node.typeExpression, node.comment);
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
};

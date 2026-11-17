import type * as Hir from "./contract.js";
import type { NodeList } from "./contract.js";
import { orderPragmaArguments } from "./pragmas.js";
import type { HirDataField, HirDataWork, HirRecordWork, HirScalar } from "./walk.js";
import { hirArrayData, hirFieldData, hirNodeIdData, hirNullableData, hirOriginData, hirRangeData,
  hirRecordData, hirScalarData } from "./walk.js";

interface CallableFields {
  readonly typeParameters: NodeList<Hir.HirNode> | null;
  readonly parameters: NodeList<Hir.HirNode>;
  readonly type: Hir.HirNode | null;
  readonly fullSignature: Hir.HirNode | null;
}

interface PropertyFields {
  readonly modifiers: Hir.ModifierList<Hir.CheckedPhase> | null;
  readonly name: Hir.HirNode;
  readonly postfixToken: Hir.HirNode | null;
}

interface TagFields {
  readonly tagName: Hir.HirNode;
  readonly comment: NodeList<Hir.HirNode> | null;
}

export function hirSyntaxData(node: Hir.HirNode, metadata: (node: Hir.HirNode) => HirDataWork): HirRecordWork {
  return hirRecordData(node.kind, node, () => [
    hirFieldData("id", hirNodeIdData(node.id)), hirFieldData("origin", hirOriginData(node.origin)),
    hirFieldData("parent", hirNullableData(node.parent, hirNodeIdData)),
    hirFieldData("flags", hirArrayData(node.flags, hirScalarData)), hirFieldData("loc", hirRangeData(node.loc)),
    ...syntaxFields(node, metadata), hirFieldData("tsonic", metadata(node)),
  ], undefined, node);
}

function syntaxFields(node: Hir.HirNode, metadata: (node: Hir.HirNode) => HirDataWork): readonly HirDataField[] {
  const read = (value: Hir.HirNode): HirDataWork => hirSyntaxData(value, metadata);
  const one = (name: string, value: Hir.HirNode | null): HirDataField => hirFieldData(name, hirNullableData(value, read));
  const list = (name: string, value: NodeList<Hir.HirNode> | null, label: "NodeList" | "ModifierList" = "NodeList"): HirDataField => hirFieldData(name,
    hirNullableData(value, rows => hirRecordData(label, rows, () => [
      hirFieldData("loc", hirRangeData(rows.loc)), hirFieldData("nodes", hirArrayData(rows.nodes, read)),
    ])));
  const modifiers = (value: Hir.ModifierList<Hir.CheckedPhase> | null): HirDataField => list("modifiers", value, "ModifierList");
  const scalar = (name: string, value: HirScalar): HirDataField => hirFieldData(name, hirScalarData(value));
  const call = (value: CallableFields): readonly HirDataField[] => [
    list("typeParameters", value.typeParameters), list("parameters", value.parameters),
    one("type", value.type), one("fullSignature", value.fullSignature),
  ];
  const property = (value: PropertyFields): readonly HirDataField[] => [
    modifiers(value.modifiers), one("name", value.name), one("postfixToken", value.postfixToken),
  ];
  const tag = (value: TagFields): readonly HirDataField[] => [one("tagName", value.tagName), list("comment", value.comment)];
  switch (node.kind) {
    case "Identifier": case "PrivateIdentifier": return [scalar("text", node.text)];
    case "QualifiedName": return [one("left", node.left), one("right", node.right)];
    case "ComputedPropertyName": case "Decorator": case "ExpressionStatement": case "ThrowStatement":
    case "ReturnStatement": case "ExternalModuleReference": case "NonNullExpression": case "SpreadElement":
    case "ParenthesizedExpression": case "SpreadAssignment": case "DeleteExpression": case "TypeOfExpression":
    case "VoidExpression": case "AwaitExpression": case "PartiallyEmittedExpression": case "JsxSpreadAttribute":
      return [one("expression", node.expression)];
    case "IfStatement": return [one("expression", node.expression), one("thenStatement", node.thenStatement), one("elseStatement", node.elseStatement)];
    case "DoStatement": case "WhileStatement":
      return [one("statement", node.statement), one("expression", node.expression)];
    case "WithStatement": return [one("expression", node.expression), one("statement", node.statement)];
    case "ForStatement": return [one("statement", node.statement), one("initializer", node.initializer), one("condition", node.condition), one("incrementor", node.incrementor)];
    case "ForInStatement": case "ForOfStatement": return [one("awaitModifier", node.awaitModifier), one("initializer", node.initializer), one("expression", node.expression), one("statement", node.statement)];
    case "BreakStatement": case "ContinueStatement": return [one("label", node.label)];
    case "SwitchStatement": return [one("expression", node.expression), one("caseBlock", node.caseBlock)];
    case "CaseBlock": return [list("clauses", node.clauses)];
    case "CaseClause": case "DefaultClause": return [one("expression", node.expression), list("statements", node.statements)];
    case "TryStatement": return [one("tryBlock", node.tryBlock), one("catchClause", node.catchClause), one("finallyBlock", node.finallyBlock)];
    case "CatchClause": return [one("variableDeclaration", node.variableDeclaration), one("block", node.block)];
    case "LabeledStatement": return [one("label", node.label), one("statement", node.statement)];
    case "Block": return [list("statements", node.statements), scalar("multiLine", node.multiLine)];
    case "ModuleBlock": return [list("statements", node.statements)];
    case "VariableStatement": return [modifiers(node.modifiers), one("declarationList", node.declarationList)];
    case "VariableDeclaration": return [one("name", node.name), one("exclamationToken", node.exclamationToken), one("type", node.type), one("initializer", node.initializer)];
    case "VariableDeclarationList": return [list("declarations", node.declarations)];
    case "ObjectBindingPattern": case "ArrayBindingPattern": return [list("elements", node.elements)];
    case "Parameter": return [modifiers(node.modifiers), one("dotDotDotToken", node.dotDotDotToken), one("name", node.name), one("questionToken", node.questionToken), one("type", node.type), one("initializer", node.initializer)];
    case "BindingElement": return [one("dotDotDotToken", node.dotDotDotToken), one("propertyName", node.propertyName), one("name", node.name), one("initializer", node.initializer)];
    case "MissingDeclaration": return [modifiers(node.modifiers)];
    case "FunctionDeclaration": case "FunctionExpression": return [modifiers(node.modifiers), ...call(node), one("asteriskToken", node.asteriskToken), one("body", node.body), one("name", node.name)];
    case "ClassDeclaration": case "ClassExpression": return [modifiers(node.modifiers), one("name", node.name), list("typeParameters", node.typeParameters), list("heritageClauses", node.heritageClauses), list("members", node.members)];
    case "HeritageClause": return [scalar("token", node.token), list("types", node.types)];
    case "InterfaceDeclaration": return [modifiers(node.modifiers), one("name", node.name), list("typeParameters", node.typeParameters), list("heritageClauses", node.heritageClauses), list("members", node.members)];
    case "TypeAliasDeclaration": case "JSTypeAliasDeclaration": return [modifiers(node.modifiers), one("name", node.name), list("typeParameters", node.typeParameters), one("type", node.type)];
    case "EnumMember": return [...property(node), one("initializer", node.initializer)];
    case "EnumDeclaration": return [modifiers(node.modifiers), one("name", node.name), list("members", node.members)];
    case "ImportDeclaration": case "JSImportDeclaration": return [modifiers(node.modifiers), one("importClause", node.importClause), one("moduleSpecifier", node.moduleSpecifier), one("attributes", node.attributes)];
    case "NamespaceImport": return [one("name", node.name)];
    case "NamedImports": case "NamedExports": return [list("elements", node.elements)];
    case "ExportAssignment": return [modifiers(node.modifiers), scalar("isExportEquals", node.isExportEquals), one("type", node.type), one("expression", node.expression)];
    case "NamespaceExportDeclaration": return [modifiers(node.modifiers), one("name", node.name)];
    case "NamespaceExport": return [one("name", node.name)];
    case "ExportSpecifier": case "ImportSpecifier": return [scalar("isTypeOnly", node.isTypeOnly), one("propertyName", node.propertyName), one("name", node.name)];
    case "CallSignature": case "ConstructSignature": case "JSDocSignature": return call(node);
    case "Constructor": return [modifiers(node.modifiers), ...call(node), one("asteriskToken", node.asteriskToken), one("body", node.body)];
    case "GetAccessor": case "SetAccessor": case "MethodDeclaration": return [...property(node), ...call(node), one("asteriskToken", node.asteriskToken), one("body", node.body)];
    case "IndexSignature": case "FunctionType": case "ConstructorType": return [modifiers(node.modifiers), ...call(node)];
    case "MethodSignature": return [...property(node), ...call(node)];
    case "PropertySignature": case "PropertyDeclaration": return [...property(node), one("type", node.type), one("initializer", node.initializer)];
    case "ClassStaticBlockDeclaration": return [modifiers(node.modifiers), one("body", node.body)];
    case "StringLiteral": case "NumericLiteral": case "BigIntLiteral": case "RegularExpressionLiteral":
      return [scalar("text", node.text), hirFieldData("tokenFlags", hirArrayData(node.tokenFlags, hirScalarData))];
    case "NoSubstitutionTemplateLiteral": case "TemplateHead": case "TemplateMiddle": case "TemplateTail":
      return [scalar("text", node.text), hirFieldData("tokenFlags", hirArrayData(node.tokenFlags, hirScalarData)), scalar("rawText", node.rawText), hirFieldData("templateFlags", hirArrayData(node.templateFlags, hirScalarData))];
    case "BinaryExpression": return [modifiers(node.modifiers), one("left", node.left), one("type", node.type), one("operatorToken", node.operatorToken), one("right", node.right)];
    case "PrefixUnaryExpression": return [scalar("operator", node.operator), one("operand", node.operand)];
    case "PostfixUnaryExpression": return [one("operand", node.operand), scalar("operator", node.operator)];
    case "YieldExpression": return [one("asteriskToken", node.asteriskToken), one("expression", node.expression)];
    case "ArrowFunction": return [modifiers(node.modifiers), ...call(node), one("asteriskToken", node.asteriskToken), one("body", node.body), one("equalsGreaterThanToken", node.equalsGreaterThanToken)];
    case "AsExpression": case "SatisfiesExpression": return [one("expression", node.expression), one("type", node.type)];
    case "ConditionalExpression": return [one("condition", node.condition), one("questionToken", node.questionToken), one("whenTrue", node.whenTrue), one("colonToken", node.colonToken), one("whenFalse", node.whenFalse)];
    case "PropertyAccessExpression": return [one("expression", node.expression), one("questionDotToken", node.questionDotToken), one("name", node.name)];
    case "ElementAccessExpression": return [one("expression", node.expression), one("questionDotToken", node.questionDotToken), one("argumentExpression", node.argumentExpression)];
    case "CallExpression": return [one("expression", node.expression), one("questionDotToken", node.questionDotToken), list("typeArguments", node.typeArguments), list("arguments", node.arguments)];
    case "NewExpression": return [one("expression", node.expression), list("typeArguments", node.typeArguments), list("arguments", node.arguments)];
    case "MetaProperty": return [scalar("keywordToken", node.keywordToken), one("name", node.name)];
    case "TemplateExpression": case "TemplateLiteralType": return [one("head", node.head), list("templateSpans", node.templateSpans)];
    case "TemplateSpan": return [one("expression", node.expression), one("literal", node.literal)];
    case "TaggedTemplateExpression": return [one("tag", node.tag), one("questionDotToken", node.questionDotToken), list("typeArguments", node.typeArguments), one("template", node.template)];
    case "ArrayLiteralExpression": return [list("elements", node.elements), scalar("multiLine", node.multiLine)];
    case "ObjectLiteralExpression": return [list("properties", node.properties), scalar("multiLine", node.multiLine)];
    case "PropertyAssignment": return [...property(node), one("type", node.type), one("initializer", node.initializer)];
    case "ShorthandPropertyAssignment": return [...property(node), one("type", node.type), one("equalsToken", node.equalsToken), one("objectAssignmentInitializer", node.objectAssignmentInitializer)];
    case "TypeAssertionExpression": return [one("type", node.type), one("expression", node.expression)];
    case "UnionType": case "IntersectionType": return [list("types", node.types)];
    case "ConditionalType": return [one("checkType", node.checkType), one("extendsType", node.extendsType), one("trueType", node.trueType), one("falseType", node.falseType)];
    case "TypeOperator": return [scalar("operator", node.operator), one("type", node.type)];
    case "InferType": return [one("typeParameter", node.typeParameter)];
    case "ArrayType": return [one("elementType", node.elementType)];
    case "IndexedAccessType": return [one("objectType", node.objectType), one("indexType", node.indexType)];
    case "TypeReference": return [list("typeArguments", node.typeArguments), one("typeName", node.typeName)];
    case "ExpressionWithTypeArguments": return [one("expression", node.expression), list("typeArguments", node.typeArguments)];
    case "LiteralType": return [one("literal", node.literal)];
    case "TypePredicate": return [one("assertsModifier", node.assertsModifier), one("parameterName", node.parameterName), one("type", node.type)];
    case "ImportAttribute": return [one("name", node.name), one("value", node.value)];
    case "ImportAttributes": return [scalar("token", node.token), list("attributes", node.attributes), scalar("multiLine", node.multiLine)];
    case "TypeQuery": return [list("typeArguments", node.typeArguments), one("exprName", node.exprName)];
    case "MappedType": return [one("readonlyToken", node.readonlyToken), one("typeParameter", node.typeParameter), one("nameType", node.nameType), one("questionToken", node.questionToken), one("type", node.type), list("members", node.members)];
    case "TypeLiteral": return [list("members", node.members)];
    case "TupleType": return [list("elements", node.elements)];
    case "NamedTupleMember": return [one("dotDotDotToken", node.dotDotDotToken), one("name", node.name), one("questionToken", node.questionToken), one("type", node.type)];
    case "OptionalType": case "RestType": case "ParenthesizedType": case "JSDocTypeExpression":
    case "JSDocNonNullableType": case "JSDocNullableType": case "JSDocVariadicType": case "JSDocOptionalType":
      return [one("type", node.type)];
    case "TemplateLiteralTypeSpan": return [one("type", node.type), one("literal", node.literal)];
    case "JsxElement": return [one("openingElement", node.openingElement), list("children", node.children), one("closingElement", node.closingElement)];
    case "JsxAttributes": return [list("properties", node.properties)];
    case "JsxNamespacedName": return [one("namespace", node.namespace), one("name", node.name)];
    case "JsxOpeningElement": case "JsxSelfClosingElement": return [one("tagName", node.tagName), list("typeArguments", node.typeArguments), one("attributes", node.attributes)];
    case "JsxFragment": return [one("openingFragment", node.openingFragment), list("children", node.children), one("closingFragment", node.closingFragment)];
    case "JsxAttribute": return [one("name", node.name), one("initializer", node.initializer)];
    case "JsxClosingElement": return [one("tagName", node.tagName)];
    case "JsxExpression": return [one("dotDotDotToken", node.dotDotDotToken), one("expression", node.expression)];
    case "JsxText": return [scalar("text", node.text), hirFieldData("tokenFlags", hirArrayData(node.tokenFlags, hirScalarData)), scalar("containsOnlyTriviaWhiteSpaces", node.containsOnlyTriviaWhiteSpaces)];
    case "SyntaxList": return [hirFieldData("children", hirArrayData(node.children, read))];
    case "JSDoc": return [list("comment", node.comment), list("tags", node.tags)];
    case "JSDocTypeTag": return [...tag(node), one("typeExpression", node.typeExpression)];
    case "JSDocUnknownTag": case "JSDocPublicTag": case "JSDocPrivateTag": case "JSDocProtectedTag":
    case "JSDocReadonlyTag": case "JSDocOverrideTag": case "JSDocDeprecatedTag": return tag(node);
    case "JSDocTemplateTag": return [...tag(node), one("constraint", node.constraint), list("typeParameters", node.typeParameters)];
    case "JSDocReturnTag": case "JSDocThrowsTag": case "JSDocSatisfiesTag": case "JSDocThisTag":
    case "JSDocOverloadTag": return [...tag(node), one("typeExpression", node.typeExpression)];
    case "JSDocSeeTag": return [...tag(node), one("nameExpression", node.nameExpression)];
    case "JSDocImplementsTag": case "JSDocAugmentsTag": return [...tag(node), one("className", node.className)];
    case "JSDocImportTag": return [...tag(node), one("importClause", node.importClause), one("moduleSpecifier", node.moduleSpecifier), one("attributes", node.attributes)];
    case "JSDocCallbackTag": case "JSDocTypedefTag": return [...tag(node), one("typeExpression", node.typeExpression), one("name", node.name)];
    case "JSDocNameReference": return [one("name", node.name)];
    case "SourceFile": return [list("statements", node.statements), one("endOfFileToken", node.endOfFileToken),
      scalar("languageVariant", node.languageVariant), scalar("scriptKind", node.scriptKind),
      hirFieldData("commentDirectives", hirArrayData(node.commentDirectives, commentDirectiveData)),
      hirFieldData("pragmas", hirArrayData(node.pragmas, pragmaData)),
      hirFieldData("checkJsDirective", hirNullableData(node.checkJsDirective, checkJsData))];
    case "ModuleDeclaration": return [modifiers(node.modifiers), one("asteriskToken", node.asteriskToken), one("body", node.body), scalar("keyword", node.keyword), one("name", node.name)];
    case "ImportEqualsDeclaration": return [modifiers(node.modifiers), scalar("isTypeOnly", node.isTypeOnly), one("name", node.name), one("moduleReference", node.moduleReference)];
    case "ExportDeclaration": return [modifiers(node.modifiers), scalar("isTypeOnly", node.isTypeOnly), one("exportClause", node.exportClause), one("moduleSpecifier", node.moduleSpecifier), one("attributes", node.attributes)];
    case "ImportType": return [list("typeArguments", node.typeArguments), scalar("isTypeOf", node.isTypeOf), one("argument", node.argument), one("attributes", node.attributes), one("qualifier", node.qualifier)];
    case "ImportClause": return [scalar("phaseModifier", node.phaseModifier), one("name", node.name), one("namedBindings", node.namedBindings)];
    case "JSDocText": return [hirFieldData("text", hirArrayData(node.text, hirScalarData))];
    case "JSDocLink": case "JSDocLinkPlain": case "JSDocLinkCode": return [hirFieldData("text", hirArrayData(node.text, hirScalarData)), one("name", node.name)];
    case "TypeParameter": return [modifiers(node.modifiers), one("name", node.name), one("constraint", node.constraint), one("expression", node.expression), one("defaultType", node.defaultType)];
    case "SyntheticReferenceExpression": return [one("expression", node.expression), one("thisArg", node.thisArg)];
    case "JSDocTypeLiteral": return [hirFieldData("jsDocPropertyTags", hirNullableData(node.jsDocPropertyTags, values => hirArrayData(values, read))), scalar("isArrayType", node.isArrayType)];
    case "JSDocParameterTag": case "JSDocPropertyTag": return [...tag(node), one("name", node.name), scalar("isBracketed", node.isBracketed), one("typeExpression", node.typeExpression), scalar("isNameFirst", node.isNameFirst)];
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
    case "EmptyStatement":
    case "DebuggerStatement":
    case "NotEmittedStatement":
    case "NotEmittedTypeElement":
    case "SemicolonClassElement":
    case "OmittedExpression":
    case "ThisType":
    case "JsxOpeningFragment":
    case "JsxClosingFragment":
    case "JSDocAllType":
      return [];
  }
}

function commentDirectiveData(value: Hir.CommentDirective): HirDataWork {
  return hirRecordData(value.kind, value, () => [hirFieldData("loc", hirRangeData(value.loc))]);
}

function commentRangeFields(value: Hir.CommentRange): readonly HirDataField[] {
  return [hirFieldData("pos", hirScalarData(value.pos)), hirFieldData("end", hirScalarData(value.end)),
    hirFieldData("hasTrailingNewLine", hirScalarData(value.hasTrailingNewLine))];
}

function commentRangeData(value: Hir.CommentRange): HirDataWork {
  return hirRecordData(value.kind, value, () => commentRangeFields(value));
}

function pragmaData(value: Hir.Pragma): HirDataWork {
  return hirRecordData(value.kind, value, () => [...commentRangeFields(value), hirFieldData("name", hirScalarData(value.name)),
    hirFieldData("args", hirRecordData("PragmaArguments", value.args, () => orderPragmaArguments(value.args)
      .map(({ name, value: argument }) =>
      hirFieldData(name, hirRecordData("PragmaArgument", argument, () => [
        hirFieldData("pos", hirScalarData(argument.pos)), hirFieldData("end", hirScalarData(argument.end)),
        hirFieldData("name", hirScalarData(argument.name)), hirFieldData("value", hirScalarData(argument.value)),
      ])))))]);
}

function checkJsData(value: Hir.CheckJsDirective): HirDataWork {
  return hirRecordData("CheckJsDirective", value, () => [hirFieldData("enabled", hirScalarData(value.enabled)), hirFieldData("range", commentRangeData(value.range))]);
}


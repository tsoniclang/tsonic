import type { SyntaxNode } from "../ir-hir/contract.js";
import type { InvariantFailure } from "../diag/contract.js";
import { requirePresent } from "../diag/index.js";
import { encodeKey } from "../ids/index.js";
import { inventorySyntax, moduleSyntaxRoots } from "./syntax-arena.js";
import type { TypedPhase } from "../ir-tir/contract.js";
import type { ModuleBodies } from "./contract.js";
import type { SyntaxTextContext, TextWork } from "./text-values.js";
import { field, record, textSyntaxHeader, token } from "./text-values.js";
import { printEmptyStatement, printIfStatement, printDoStatement, printWhileStatement, printForStatement, printForInStatement, printForOfStatement, printBreakStatement, printContinueStatement, printReturnStatement, printWithStatement, printSwitchStatement, printCaseBlock, printCaseClause, printDefaultClause, printThrowStatement, printTryStatement, printCatchClause, printDebuggerStatement, printLabeledStatement, printExpressionStatement, printBlock, printVariableStatement, printVariableDeclaration, printVariableDeclarationList, printBindingPattern, printParameterDeclaration, printBindingElement, printMissingDeclaration, printFunctionDeclaration, printClassDeclaration, printClassExpression, printHeritageClause, printInterfaceDeclaration, printTypeAliasDeclaration, printEnumMember, printEnumDeclaration, printModuleBlock, printNotEmittedStatement, printNotEmittedTypeElement, printCallSignatureDeclaration, printConstructSignatureDeclaration, printConstructorDeclaration, printGetAccessorDeclaration, printSetAccessorDeclaration, printIndexSignatureDeclaration, printMethodSignatureDeclaration, printMethodDeclaration, printPropertySignatureDeclaration, printPropertyDeclaration, printSemicolonClassElement, printClassStaticBlockDeclaration } from "./print-syntax-statements.js";
import { printIdentifier, printPrivateIdentifier, printQualifiedName, printComputedPropertyName, printDecorator, printOmittedExpression, printKeywordExpression, printStringLiteral, printNumericLiteral, printBigIntLiteral, printRegularExpressionLiteral, printNoSubstitutionTemplateLiteral, printBinaryExpression, printPrefixUnaryExpression, printPostfixUnaryExpression, printYieldExpression, printArrowFunction, printFunctionExpression, printAsExpression, printSatisfiesExpression, printConditionalExpression, printPropertyAccessExpression, printElementAccessExpression, printCallExpression, printNewExpression, printMetaProperty, printNonNullExpression, printSpreadElement, printTemplateExpression, printTemplateSpan, printTaggedTemplateExpression, printParenthesizedExpression, printArrayLiteralExpression, printObjectLiteralExpression, printSpreadAssignment, printPropertyAssignment, printShorthandPropertyAssignment, printDeleteExpression, printTypeOfExpression, printVoidExpression, printAwaitExpression, printTypeAssertion, printExpressionWithTypeArguments, printTemplateHead, printTemplateMiddle, printTemplateTail, printPartiallyEmittedExpression, printSyntheticReferenceExpression } from "./print-syntax-expressions.js";
import { printKeywordTypeNode, printUnionTypeNode, printIntersectionTypeNode, printConditionalTypeNode, printTypeOperatorNode, printInferTypeNode, printArrayTypeNode, printIndexedAccessTypeNode, printTypeReferenceNode, printLiteralTypeNode, printThisTypeNode, printTypePredicateNode, printImportAttribute, printImportAttributes, printTypeQueryNode, printMappedTypeNode, printTypeLiteralNode, printTupleTypeNode, printNamedTupleMember, printOptionalTypeNode, printRestTypeNode, printParenthesizedTypeNode, printFunctionTypeNode, printConstructorTypeNode, printTemplateLiteralTypeNode, printTemplateLiteralTypeSpan, printTypeParameterDeclaration } from "./print-syntax-types.js";
import { printImportDeclaration, printExternalModuleReference, printNamespaceImport, printNamedImports, printExportAssignment, printNamespaceExportDeclaration, printNamespaceExport, printNamedExports, printExportSpecifier, printJsxElement, printJsxAttributes, printJsxNamespacedName, printJsxOpeningElement, printJsxSelfClosingElement, printJsxFragment, printJsxOpeningFragment, printJsxClosingFragment, printJsxAttribute, printJsxSpreadAttribute, printJsxClosingElement, printJsxExpression, printJsxText, printSyntaxList, printJSDoc, printJSDocTypeExpression, printJSDocNonNullableType, printJSDocNullableType, printJSDocAllType, printJSDocVariadicType, printJSDocOptionalType, printJSDocTypeTag, printJSDocUnknownTag, printJSDocTemplateTag, printJSDocReturnTag, printJSDocPublicTag, printJSDocPrivateTag, printJSDocProtectedTag, printJSDocReadonlyTag, printJSDocOverrideTag, printJSDocDeprecatedTag, printJSDocSeeTag, printJSDocImplementsTag, printJSDocAugmentsTag, printJSDocSatisfiesTag, printJSDocThrowsTag, printJSDocThisTag, printJSDocImportTag, printJSDocCallbackTag, printJSDocOverloadTag, printJSDocTypedefTag, printJSDocSignature, printJSDocNameReference, printSourceFile, printModuleDeclaration, printImportEqualsDeclaration, printExportDeclaration, printImportTypeNode, printImportClause, printImportSpecifier, printJSDocText, printJSDocLink, printJSDocLinkPlain, printJSDocLinkCode, printJSDocTypeLiteral, printJSDocParameterOrPropertyTag } from "./print-syntax-auxiliary.js";

export function syntaxText(node: SyntaxNode<TypedPhase>, context: SyntaxTextContext): TextWork {
  switch (node.kind) {
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
      return record(node.kind, [...textSyntaxHeader(node), field("tsonic", token("null"))]);
    case "Identifier":
      return printIdentifier(node, context);
    case "PrivateIdentifier":
      return printPrivateIdentifier(node, context);
    case "QualifiedName":
      return printQualifiedName(node, context);
    case "ComputedPropertyName":
      return printComputedPropertyName(node, context);
    case "Decorator":
      return printDecorator(node, context);
    case "EmptyStatement":
      return printEmptyStatement(node, context);
    case "IfStatement":
      return printIfStatement(node, context);
    case "DoStatement":
      return printDoStatement(node, context);
    case "WhileStatement":
      return printWhileStatement(node, context);
    case "ForStatement":
      return printForStatement(node, context);
    case "ForInStatement":
      return printForInStatement(node, context);
    case "ForOfStatement":
      return printForOfStatement(node, context);
    case "BreakStatement":
      return printBreakStatement(node, context);
    case "ContinueStatement":
      return printContinueStatement(node, context);
    case "ReturnStatement":
      return printReturnStatement(node, context);
    case "WithStatement":
      return printWithStatement(node, context);
    case "SwitchStatement":
      return printSwitchStatement(node, context);
    case "CaseBlock":
      return printCaseBlock(node, context);
    case "CaseClause":
      return printCaseClause(node, context);
    case "DefaultClause":
      return printDefaultClause(node, context);
    case "ThrowStatement":
      return printThrowStatement(node, context);
    case "TryStatement":
      return printTryStatement(node, context);
    case "CatchClause":
      return printCatchClause(node, context);
    case "DebuggerStatement":
      return printDebuggerStatement(node, context);
    case "LabeledStatement":
      return printLabeledStatement(node, context);
    case "ExpressionStatement":
      return printExpressionStatement(node, context);
    case "Block":
      return printBlock(node, context);
    case "VariableStatement":
      return printVariableStatement(node, context);
    case "VariableDeclaration":
      return printVariableDeclaration(node, context);
    case "VariableDeclarationList":
      return printVariableDeclarationList(node, context);
    case "ObjectBindingPattern":
    case "ArrayBindingPattern":
      return printBindingPattern(node, context);
    case "Parameter":
      return printParameterDeclaration(node, context);
    case "BindingElement":
      return printBindingElement(node, context);
    case "MissingDeclaration":
      return printMissingDeclaration(node, context);
    case "FunctionDeclaration":
      return printFunctionDeclaration(node, context);
    case "ClassDeclaration":
      return printClassDeclaration(node, context);
    case "ClassExpression":
      return printClassExpression(node, context);
    case "HeritageClause":
      return printHeritageClause(node, context);
    case "InterfaceDeclaration":
      return printInterfaceDeclaration(node, context);
    case "TypeAliasDeclaration":
    case "JSTypeAliasDeclaration":
      return printTypeAliasDeclaration(node, context);
    case "EnumMember":
      return printEnumMember(node, context);
    case "EnumDeclaration":
      return printEnumDeclaration(node, context);
    case "ModuleBlock":
      return printModuleBlock(node, context);
    case "NotEmittedStatement":
      return printNotEmittedStatement(node, context);
    case "NotEmittedTypeElement":
      return printNotEmittedTypeElement(node, context);
    case "ImportDeclaration":
    case "JSImportDeclaration":
      return printImportDeclaration(node, context);
    case "ExternalModuleReference":
      return printExternalModuleReference(node, context);
    case "NamespaceImport":
      return printNamespaceImport(node, context);
    case "NamedImports":
      return printNamedImports(node, context);
    case "ExportAssignment":
      return printExportAssignment(node, context);
    case "NamespaceExportDeclaration":
      return printNamespaceExportDeclaration(node, context);
    case "NamespaceExport":
      return printNamespaceExport(node, context);
    case "NamedExports":
      return printNamedExports(node, context);
    case "ExportSpecifier":
      return printExportSpecifier(node, context);
    case "CallSignature":
      return printCallSignatureDeclaration(node, context);
    case "ConstructSignature":
      return printConstructSignatureDeclaration(node, context);
    case "Constructor":
      return printConstructorDeclaration(node, context);
    case "GetAccessor":
      return printGetAccessorDeclaration(node, context);
    case "SetAccessor":
      return printSetAccessorDeclaration(node, context);
    case "IndexSignature":
      return printIndexSignatureDeclaration(node, context);
    case "MethodSignature":
      return printMethodSignatureDeclaration(node, context);
    case "MethodDeclaration":
      return printMethodDeclaration(node, context);
    case "PropertySignature":
      return printPropertySignatureDeclaration(node, context);
    case "PropertyDeclaration":
      return printPropertyDeclaration(node, context);
    case "SemicolonClassElement":
      return printSemicolonClassElement(node, context);
    case "ClassStaticBlockDeclaration":
      return printClassStaticBlockDeclaration(node, context);
    case "OmittedExpression":
      return printOmittedExpression(node, context);
    case "NullKeyword":
    case "TrueKeyword":
    case "FalseKeyword":
    case "ThisKeyword":
    case "SuperKeyword":
    case "ImportKeyword":
      return printKeywordExpression(node, context);
    case "StringLiteral":
      return printStringLiteral(node, context);
    case "NumericLiteral":
      return printNumericLiteral(node, context);
    case "BigIntLiteral":
      return printBigIntLiteral(node, context);
    case "RegularExpressionLiteral":
      return printRegularExpressionLiteral(node, context);
    case "NoSubstitutionTemplateLiteral":
      return printNoSubstitutionTemplateLiteral(node, context);
    case "BinaryExpression":
      return printBinaryExpression(node, context);
    case "PrefixUnaryExpression":
      return printPrefixUnaryExpression(node, context);
    case "PostfixUnaryExpression":
      return printPostfixUnaryExpression(node, context);
    case "YieldExpression":
      return printYieldExpression(node, context);
    case "ArrowFunction":
      return printArrowFunction(node, context);
    case "FunctionExpression":
      return printFunctionExpression(node, context);
    case "AsExpression":
      return printAsExpression(node, context);
    case "SatisfiesExpression":
      return printSatisfiesExpression(node, context);
    case "ConditionalExpression":
      return printConditionalExpression(node, context);
    case "PropertyAccessExpression":
      return printPropertyAccessExpression(node, context);
    case "ElementAccessExpression":
      return printElementAccessExpression(node, context);
    case "CallExpression":
      return printCallExpression(node, context);
    case "NewExpression":
      return printNewExpression(node, context);
    case "MetaProperty":
      return printMetaProperty(node, context);
    case "NonNullExpression":
      return printNonNullExpression(node, context);
    case "SpreadElement":
      return printSpreadElement(node, context);
    case "TemplateExpression":
      return printTemplateExpression(node, context);
    case "TemplateSpan":
      return printTemplateSpan(node, context);
    case "TaggedTemplateExpression":
      return printTaggedTemplateExpression(node, context);
    case "ParenthesizedExpression":
      return printParenthesizedExpression(node, context);
    case "ArrayLiteralExpression":
      return printArrayLiteralExpression(node, context);
    case "ObjectLiteralExpression":
      return printObjectLiteralExpression(node, context);
    case "SpreadAssignment":
      return printSpreadAssignment(node, context);
    case "PropertyAssignment":
      return printPropertyAssignment(node, context);
    case "ShorthandPropertyAssignment":
      return printShorthandPropertyAssignment(node, context);
    case "DeleteExpression":
      return printDeleteExpression(node, context);
    case "TypeOfExpression":
      return printTypeOfExpression(node, context);
    case "VoidExpression":
      return printVoidExpression(node, context);
    case "AwaitExpression":
      return printAwaitExpression(node, context);
    case "TypeAssertionExpression":
      return printTypeAssertion(node, context);
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
      return printKeywordTypeNode(node, context);
    case "UnionType":
      return printUnionTypeNode(node, context);
    case "IntersectionType":
      return printIntersectionTypeNode(node, context);
    case "ConditionalType":
      return printConditionalTypeNode(node, context);
    case "TypeOperator":
      return printTypeOperatorNode(node, context);
    case "InferType":
      return printInferTypeNode(node, context);
    case "ArrayType":
      return printArrayTypeNode(node, context);
    case "IndexedAccessType":
      return printIndexedAccessTypeNode(node, context);
    case "TypeReference":
      return printTypeReferenceNode(node, context);
    case "ExpressionWithTypeArguments":
      return printExpressionWithTypeArguments(node, context);
    case "LiteralType":
      return printLiteralTypeNode(node, context);
    case "ThisType":
      return printThisTypeNode(node, context);
    case "TypePredicate":
      return printTypePredicateNode(node, context);
    case "ImportAttribute":
      return printImportAttribute(node, context);
    case "ImportAttributes":
      return printImportAttributes(node, context);
    case "TypeQuery":
      return printTypeQueryNode(node, context);
    case "MappedType":
      return printMappedTypeNode(node, context);
    case "TypeLiteral":
      return printTypeLiteralNode(node, context);
    case "TupleType":
      return printTupleTypeNode(node, context);
    case "NamedTupleMember":
      return printNamedTupleMember(node, context);
    case "OptionalType":
      return printOptionalTypeNode(node, context);
    case "RestType":
      return printRestTypeNode(node, context);
    case "ParenthesizedType":
      return printParenthesizedTypeNode(node, context);
    case "FunctionType":
      return printFunctionTypeNode(node, context);
    case "ConstructorType":
      return printConstructorTypeNode(node, context);
    case "TemplateHead":
      return printTemplateHead(node, context);
    case "TemplateMiddle":
      return printTemplateMiddle(node, context);
    case "TemplateTail":
      return printTemplateTail(node, context);
    case "TemplateLiteralType":
      return printTemplateLiteralTypeNode(node, context);
    case "TemplateLiteralTypeSpan":
      return printTemplateLiteralTypeSpan(node, context);
    case "PartiallyEmittedExpression":
      return printPartiallyEmittedExpression(node, context);
    case "JsxElement":
      return printJsxElement(node, context);
    case "JsxAttributes":
      return printJsxAttributes(node, context);
    case "JsxNamespacedName":
      return printJsxNamespacedName(node, context);
    case "JsxOpeningElement":
      return printJsxOpeningElement(node, context);
    case "JsxSelfClosingElement":
      return printJsxSelfClosingElement(node, context);
    case "JsxFragment":
      return printJsxFragment(node, context);
    case "JsxOpeningFragment":
      return printJsxOpeningFragment(node, context);
    case "JsxClosingFragment":
      return printJsxClosingFragment(node, context);
    case "JsxAttribute":
      return printJsxAttribute(node, context);
    case "JsxSpreadAttribute":
      return printJsxSpreadAttribute(node, context);
    case "JsxClosingElement":
      return printJsxClosingElement(node, context);
    case "JsxExpression":
      return printJsxExpression(node, context);
    case "JsxText":
      return printJsxText(node, context);
    case "SyntaxList":
      return printSyntaxList(node, context);
    case "JSDoc":
      return printJSDoc(node, context);
    case "JSDocTypeExpression":
      return printJSDocTypeExpression(node, context);
    case "JSDocNonNullableType":
      return printJSDocNonNullableType(node, context);
    case "JSDocNullableType":
      return printJSDocNullableType(node, context);
    case "JSDocAllType":
      return printJSDocAllType(node, context);
    case "JSDocVariadicType":
      return printJSDocVariadicType(node, context);
    case "JSDocOptionalType":
      return printJSDocOptionalType(node, context);
    case "JSDocTypeTag":
      return printJSDocTypeTag(node, context);
    case "JSDocUnknownTag":
      return printJSDocUnknownTag(node, context);
    case "JSDocTemplateTag":
      return printJSDocTemplateTag(node, context);
    case "JSDocReturnTag":
      return printJSDocReturnTag(node, context);
    case "JSDocPublicTag":
      return printJSDocPublicTag(node, context);
    case "JSDocPrivateTag":
      return printJSDocPrivateTag(node, context);
    case "JSDocProtectedTag":
      return printJSDocProtectedTag(node, context);
    case "JSDocReadonlyTag":
      return printJSDocReadonlyTag(node, context);
    case "JSDocOverrideTag":
      return printJSDocOverrideTag(node, context);
    case "JSDocDeprecatedTag":
      return printJSDocDeprecatedTag(node, context);
    case "JSDocSeeTag":
      return printJSDocSeeTag(node, context);
    case "JSDocImplementsTag":
      return printJSDocImplementsTag(node, context);
    case "JSDocAugmentsTag":
      return printJSDocAugmentsTag(node, context);
    case "JSDocSatisfiesTag":
      return printJSDocSatisfiesTag(node, context);
    case "JSDocThrowsTag":
      return printJSDocThrowsTag(node, context);
    case "JSDocThisTag":
      return printJSDocThisTag(node, context);
    case "JSDocImportTag":
      return printJSDocImportTag(node, context);
    case "JSDocCallbackTag":
      return printJSDocCallbackTag(node, context);
    case "JSDocOverloadTag":
      return printJSDocOverloadTag(node, context);
    case "JSDocTypedefTag":
      return printJSDocTypedefTag(node, context);
    case "JSDocSignature":
      return printJSDocSignature(node, context);
    case "JSDocNameReference":
      return printJSDocNameReference(node, context);
    case "SourceFile":
      return printSourceFile(node, context);
    case "ModuleDeclaration":
      return printModuleDeclaration(node, context);
    case "ImportEqualsDeclaration":
      return printImportEqualsDeclaration(node, context);
    case "ExportDeclaration":
      return printExportDeclaration(node, context);
    case "ImportType":
      return printImportTypeNode(node, context);
    case "ImportClause":
      return printImportClause(node, context);
    case "ImportSpecifier":
      return printImportSpecifier(node, context);
    case "JSDocText":
      return printJSDocText(node, context);
    case "JSDocLink":
      return printJSDocLink(node, context);
    case "JSDocLinkPlain":
      return printJSDocLinkPlain(node, context);
    case "JSDocLinkCode":
      return printJSDocLinkCode(node, context);
    case "TypeParameter":
      return printTypeParameterDeclaration(node, context);
    case "SyntheticReferenceExpression":
      return printSyntheticReferenceExpression(node, context);
    case "JSDocTypeLiteral":
      return printJSDocTypeLiteral(node, context);
    case "JSDocParameterTag":
    case "JSDocPropertyTag":
      return printJSDocParameterOrPropertyTag(node, context);
  }
}

export function createSyntaxText(module: ModuleBodies): {
  readonly nodes: readonly SyntaxNode<TypedPhase>[];
  readonly context: SyntaxTextContext;
} {
  const { nodes, wire } = inventorySyntax(moduleSyntaxRoots(module, "ModuleBodies"));
  const missingWire: InvariantFailure = {
    owner: "ir-program",
    query: { name: "print.syntax-wire", encodedKey: encodeKey([module.module]) },
    origin: module.tree.origin,
    message: "Syntax object is not in the module wire inventory",
  };
  const context: SyntaxTextContext = {
    reference: value => {
      const position = requirePresent(wire.get(value), missingWire);
      return token(`n:${position}`);
    },
  };
  return { nodes, context };
}

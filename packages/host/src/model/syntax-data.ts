import type { Original, Presence } from "./foundation-data.js";

export type SyntaxKind =
  | "KindUnknown" | "KindEndOfFile" | "KindSingleLineCommentTrivia" | "KindMultiLineCommentTrivia"
  | "KindNewLineTrivia" | "KindWhitespaceTrivia" | "KindConflictMarkerTrivia" | "KindNonTextFileMarkerTrivia"
  | "KindNumericLiteral" | "KindBigIntLiteral" | "KindStringLiteral" | "KindJsxText"
  | "KindJsxTextAllWhiteSpaces" | "KindRegularExpressionLiteral" | "KindNoSubstitutionTemplateLiteral" | "KindTemplateHead"
  | "KindTemplateMiddle" | "KindTemplateTail" | "KindOpenBraceToken" | "KindCloseBraceToken"
  | "KindOpenParenToken" | "KindCloseParenToken" | "KindOpenBracketToken" | "KindCloseBracketToken"
  | "KindDotToken" | "KindDotDotDotToken" | "KindSemicolonToken" | "KindCommaToken"
  | "KindQuestionDotToken" | "KindLessThanToken" | "KindLessThanSlashToken" | "KindGreaterThanToken"
  | "KindLessThanEqualsToken" | "KindGreaterThanEqualsToken" | "KindEqualsEqualsToken" | "KindExclamationEqualsToken"
  | "KindEqualsEqualsEqualsToken" | "KindExclamationEqualsEqualsToken" | "KindEqualsGreaterThanToken" | "KindPlusToken"
  | "KindMinusToken" | "KindAsteriskToken" | "KindAsteriskAsteriskToken" | "KindSlashToken"
  | "KindPercentToken" | "KindPlusPlusToken" | "KindMinusMinusToken" | "KindLessThanLessThanToken"
  | "KindGreaterThanGreaterThanToken" | "KindGreaterThanGreaterThanGreaterThanToken" | "KindAmpersandToken" | "KindBarToken"
  | "KindCaretToken" | "KindExclamationToken" | "KindTildeToken" | "KindAmpersandAmpersandToken"
  | "KindBarBarToken" | "KindQuestionToken" | "KindColonToken" | "KindAtToken"
  | "KindQuestionQuestionToken" | "KindBacktickToken" | "KindHashToken" | "KindEqualsToken"
  | "KindPlusEqualsToken" | "KindMinusEqualsToken" | "KindAsteriskEqualsToken" | "KindAsteriskAsteriskEqualsToken"
  | "KindSlashEqualsToken" | "KindPercentEqualsToken" | "KindLessThanLessThanEqualsToken" | "KindGreaterThanGreaterThanEqualsToken"
  | "KindGreaterThanGreaterThanGreaterThanEqualsToken" | "KindAmpersandEqualsToken" | "KindBarEqualsToken" | "KindBarBarEqualsToken"
  | "KindAmpersandAmpersandEqualsToken" | "KindQuestionQuestionEqualsToken" | "KindCaretEqualsToken" | "KindIdentifier"
  | "KindPrivateIdentifier" | "KindJSDocCommentTextToken" | "KindBreakKeyword" | "KindCaseKeyword"
  | "KindCatchKeyword" | "KindClassKeyword" | "KindConstKeyword" | "KindContinueKeyword"
  | "KindDebuggerKeyword" | "KindDefaultKeyword" | "KindDeleteKeyword" | "KindDoKeyword"
  | "KindElseKeyword" | "KindEnumKeyword" | "KindExportKeyword" | "KindExtendsKeyword"
  | "KindFalseKeyword" | "KindFinallyKeyword" | "KindForKeyword" | "KindFunctionKeyword"
  | "KindIfKeyword" | "KindImportKeyword" | "KindInKeyword" | "KindInstanceOfKeyword"
  | "KindNewKeyword" | "KindNullKeyword" | "KindReturnKeyword" | "KindSuperKeyword"
  | "KindSwitchKeyword" | "KindThisKeyword" | "KindThrowKeyword" | "KindTrueKeyword"
  | "KindTryKeyword" | "KindTypeOfKeyword" | "KindVarKeyword" | "KindVoidKeyword"
  | "KindWhileKeyword" | "KindWithKeyword" | "KindImplementsKeyword" | "KindInterfaceKeyword"
  | "KindLetKeyword" | "KindPackageKeyword" | "KindPrivateKeyword" | "KindProtectedKeyword"
  | "KindPublicKeyword" | "KindStaticKeyword" | "KindYieldKeyword" | "KindAbstractKeyword"
  | "KindAccessorKeyword" | "KindAsKeyword" | "KindAssertsKeyword" | "KindAssertKeyword"
  | "KindAnyKeyword" | "KindAsyncKeyword" | "KindAwaitKeyword" | "KindBooleanKeyword"
  | "KindConstructorKeyword" | "KindDeclareKeyword" | "KindGetKeyword" | "KindImmediateKeyword"
  | "KindInferKeyword" | "KindIntrinsicKeyword" | "KindIsKeyword" | "KindKeyOfKeyword"
  | "KindModuleKeyword" | "KindNamespaceKeyword" | "KindNeverKeyword" | "KindOutKeyword"
  | "KindReadonlyKeyword" | "KindRequireKeyword" | "KindNumberKeyword" | "KindObjectKeyword"
  | "KindSatisfiesKeyword" | "KindSetKeyword" | "KindStringKeyword" | "KindSymbolKeyword"
  | "KindTypeKeyword" | "KindUndefinedKeyword" | "KindUniqueKeyword" | "KindUnknownKeyword"
  | "KindUsingKeyword" | "KindFromKeyword" | "KindGlobalKeyword" | "KindBigIntKeyword"
  | "KindOverrideKeyword" | "KindOfKeyword" | "KindDeferKeyword" | "KindQualifiedName"
  | "KindComputedPropertyName" | "KindTypeParameter" | "KindParameter" | "KindDecorator"
  | "KindPropertySignature" | "KindPropertyDeclaration" | "KindMethodSignature" | "KindMethodDeclaration"
  | "KindClassStaticBlockDeclaration" | "KindConstructor" | "KindGetAccessor" | "KindSetAccessor"
  | "KindCallSignature" | "KindConstructSignature" | "KindIndexSignature" | "KindTypePredicate"
  | "KindTypeReference" | "KindFunctionType" | "KindConstructorType" | "KindTypeQuery"
  | "KindTypeLiteral" | "KindArrayType" | "KindTupleType" | "KindOptionalType"
  | "KindRestType" | "KindUnionType" | "KindIntersectionType" | "KindConditionalType"
  | "KindInferType" | "KindParenthesizedType" | "KindThisType" | "KindTypeOperator"
  | "KindIndexedAccessType" | "KindMappedType" | "KindLiteralType" | "KindNamedTupleMember"
  | "KindTemplateLiteralType" | "KindTemplateLiteralTypeSpan" | "KindImportType" | "KindObjectBindingPattern"
  | "KindArrayBindingPattern" | "KindBindingElement" | "KindArrayLiteralExpression" | "KindObjectLiteralExpression"
  | "KindPropertyAccessExpression" | "KindElementAccessExpression" | "KindCallExpression" | "KindNewExpression"
  | "KindTaggedTemplateExpression" | "KindTypeAssertionExpression" | "KindParenthesizedExpression" | "KindFunctionExpression"
  | "KindArrowFunction" | "KindDeleteExpression" | "KindTypeOfExpression" | "KindVoidExpression"
  | "KindAwaitExpression" | "KindPrefixUnaryExpression" | "KindPostfixUnaryExpression" | "KindBinaryExpression"
  | "KindConditionalExpression" | "KindTemplateExpression" | "KindYieldExpression" | "KindSpreadElement"
  | "KindClassExpression" | "KindOmittedExpression" | "KindExpressionWithTypeArguments" | "KindAsExpression"
  | "KindNonNullExpression" | "KindMetaProperty" | "KindSyntheticExpression" | "KindSatisfiesExpression"
  | "KindTemplateSpan" | "KindSemicolonClassElement" | "KindBlock" | "KindEmptyStatement"
  | "KindVariableStatement" | "KindExpressionStatement" | "KindIfStatement" | "KindDoStatement"
  | "KindWhileStatement" | "KindForStatement" | "KindForInStatement" | "KindForOfStatement"
  | "KindContinueStatement" | "KindBreakStatement" | "KindReturnStatement" | "KindWithStatement"
  | "KindSwitchStatement" | "KindLabeledStatement" | "KindThrowStatement" | "KindTryStatement"
  | "KindDebuggerStatement" | "KindVariableDeclaration" | "KindVariableDeclarationList" | "KindFunctionDeclaration"
  | "KindClassDeclaration" | "KindInterfaceDeclaration" | "KindTypeAliasDeclaration" | "KindEnumDeclaration"
  | "KindModuleDeclaration" | "KindModuleBlock" | "KindCaseBlock" | "KindNamespaceExportDeclaration"
  | "KindImportEqualsDeclaration" | "KindImportDeclaration" | "KindImportClause" | "KindNamespaceImport"
  | "KindNamedImports" | "KindImportSpecifier" | "KindExportAssignment" | "KindExportDeclaration"
  | "KindNamedExports" | "KindNamespaceExport" | "KindExportSpecifier" | "KindMissingDeclaration"
  | "KindExternalModuleReference" | "KindJsxElement" | "KindJsxSelfClosingElement" | "KindJsxOpeningElement"
  | "KindJsxClosingElement" | "KindJsxFragment" | "KindJsxOpeningFragment" | "KindJsxClosingFragment"
  | "KindJsxAttribute" | "KindJsxAttributes" | "KindJsxSpreadAttribute" | "KindJsxExpression"
  | "KindJsxNamespacedName" | "KindCaseClause" | "KindDefaultClause" | "KindHeritageClause"
  | "KindCatchClause" | "KindImportAttributes" | "KindImportAttribute" | "KindPropertyAssignment"
  | "KindShorthandPropertyAssignment" | "KindSpreadAssignment" | "KindEnumMember" | "KindSourceFile"
  | "KindJSDocTypeExpression" | "KindJSDocNameReference" | "KindJSDocAllType" | "KindJSDocNullableType"
  | "KindJSDocNonNullableType" | "KindJSDocOptionalType" | "KindJSDocVariadicType" | "KindJSDoc"
  | "KindJSDocText" | "KindJSDocTypeLiteral" | "KindJSDocSignature" | "KindJSDocLink"
  | "KindJSDocLinkCode" | "KindJSDocLinkPlain" | "KindJSDocUnknownTag" | "KindJSDocAugmentsTag"
  | "KindJSDocImplementsTag" | "KindJSDocDeprecatedTag" | "KindJSDocPublicTag" | "KindJSDocPrivateTag"
  | "KindJSDocProtectedTag" | "KindJSDocReadonlyTag" | "KindJSDocOverrideTag" | "KindJSDocCallbackTag"
  | "KindJSDocOverloadTag" | "KindJSDocParameterTag" | "KindJSDocReturnTag" | "KindJSDocThisTag"
  | "KindJSDocTypeTag" | "KindJSDocTemplateTag" | "KindJSDocTypedefTag" | "KindJSDocSeeTag"
  | "KindJSDocPropertyTag" | "KindJSDocThrowsTag" | "KindJSDocSatisfiesTag" | "KindJSDocImportTag"
  | "KindSyntaxList" | "KindJSTypeAliasDeclaration" | "KindJSImportDeclaration" | "KindNotEmittedStatement"
  | "KindPartiallyEmittedExpression" | "KindSyntheticReferenceExpression" | "KindNotEmittedTypeElement";
export type SyntaxRole = "name" | "property-name" | "expression" | "receiver"
  | "left" | "right" | "operator" | "condition" | "when-true" | "when-false"
  | "argument" | "type-argument" | "parameter" | "type-parameter" | "type"
  | "constraint" | "default-type" | "initializer" | "body" | "statement"
  | "member" | "element" | "property" | "binding" | "rest" | "decorator"
  | "modifier" | "heritage" | "clause" | "case" | "catch" | "finally"
  | "incrementor" | "then" | "else" | "label" | "module-specifier"
  | "import-clause" | "import-binding" | "export-clause" | "export-binding"
  | "attribute" | "qualifier" | "template-head" | "template-span"
  | "template-tail" | "jsx-tag" | "jsx-attribute" | "jsx-child"
  | "type-member" | "check-type" | "extends-type" | "true-type"
  | "false-type" | "object-type" | "index-type" | "name-type" | "assertion"
  | "token" | "documentation";
export interface SyntaxChild {
  readonly role: SyntaxRole;
  readonly index: number;
  readonly original: Original;
}
export interface SyntaxObservation {
  readonly original: Original;
  readonly document: Original;
  readonly kind: SyntaxKind;
  readonly start: number;
  readonly length: number;
  readonly parent: Presence<Original>;
  readonly spelling: Presence<string>;
  readonly children: readonly SyntaxChild[];
  readonly optionalChain: boolean;
  readonly definite: boolean;
  readonly readonly: boolean;
  readonly optional: boolean;
  readonly rest: boolean;
  readonly declarationFile: boolean;
}
